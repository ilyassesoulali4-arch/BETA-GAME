import { canvasViewport, CONFIG } from "./config";
import { blockToWorldX, blockToWorldY } from "./chunk";
import { SkyRenderer } from "./sky";
import { ParallaxMountains } from "./parallaxMountains";
import { CloudLayer } from "./clouds";
import { HotbarRenderer } from "./hotbar";
import type { Camera } from "./camera";
import type { Player } from "./player";
import type { World } from "./world";
import type { BlockRenderer } from "./blockRenderer";
import type { BlockTarget } from "./blockInteraction";
import type { Inventory } from "./inventory";

/**
 * Image rendering strategy.
 *
 * The visual direction is realistic 2D: natural materials, soft shading, no
 * forced pixel look. Assets are drawn at their on-screen size (block textures
 * are up to CONFIG.block.size or higher resolution), so the canvas should
 * smooth when resampling.
 *
 *   - imageSmoothingEnabled = true  (default) — realistic scaling; do NOT
 *     switch to nearest-neighbor, which would force a pixel-art look.
 *   - imageSmoothingQuality = "high" — better bilinear filtering for
 *     downscaling higher-res textures onto the screen.
 *
 * This is set once on the context at construction. It does not apply to the
 * flat-color fallback paths, which draw with fillRect and are unaffected by
 * smoothing.
 */

/**
 * The Renderer draws the whole scene onto the canvas, layer by layer.
 *
 * It composes the block terrain, the interaction target highlight and the
 * player. It knows nothing about game logic; it only reads state and draws it.
 *
 * The canvas is kept in sync with the browser window (fullscreen): its
 * internal resolution equals the viewport, and it is re-created/resized on
 * window resize, updating canvasViewport so the camera and renderer compute
 * the visible world area from the actual screen size.
 *
 * Layer pipeline (bottom to top, see renderLayers.ts):
 *   sky (gradient) -> parallaxMountains -> clouds -> world (BlockRenderer) ->
 *   player -> target highlight -> lighting -> ui (hotbar).
 *
 * The renderer owns only the layers that exist today; the rest are slots that
 * future steps will insert. A future lighting pass has an explicit seam
 * (applyLighting) between the world/player layers and the foreground/UI.
 *
 * Performance: the expensive layers — sky, parallax mountains and the block
 * grid — are painted into offscreen layer canvases and cached. Each frame
 * only re-blits them (two cheap, GPU-accelerated drawImage calls) and redraws
 * the genuinely dynamic layers (clouds, player, target, hotbar). The cached
 * layers are rebuilt only when their inputs change:
 *
 *   - sky + mountains: the camera's rounded position or a viewport resize;
 *   - block grid: the camera's view origin, a world edit (World.version), an
 *     asset finishing loading (BlockRenderer.assetVersion), or a resize.
 *
 * Standing still therefore costs a handful of draws per frame instead of
 * re-painting every visible block cell (~tens of thousands of canvas ops).
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly blockRenderer: BlockRenderer;
  private readonly skyRenderer: SkyRenderer;
  private readonly mountains: ParallaxMountains;
  private readonly clouds: CloudLayer;
  private readonly hotbar: HotbarRenderer;

  // Cached offscreen layers and the input signatures they were built from.
  private backgroundLayer: HTMLCanvasElement | null = null;
  private worldLayer: HTMLCanvasElement | null = null;
  private lastBgX = NaN;
  private lastBgY = NaN;
  private lastViewX = NaN;
  private lastViewY = NaN;
  private lastWorldVersion = -1;
  private lastAssetVersion = -1;

  constructor(
    blockRenderer: BlockRenderer,
    skyRenderer: SkyRenderer = new SkyRenderer(),
    mountains: ParallaxMountains = new ParallaxMountains(),
    clouds: CloudLayer = new CloudLayer(),
    hotbar: HotbarRenderer = new HotbarRenderer(),
  ) {
    this.blockRenderer = blockRenderer;
    this.skyRenderer = skyRenderer;
    this.mountains = mountains;
    this.clouds = clouds;
    this.hotbar = hotbar;

    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
    this.resizeCanvas();

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available.");
    }
    this.ctx = ctx;
    this.configureImageSmoothing();

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  private configureImageSmoothing(): void {
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  private resizeCanvas(): void {
    // Bound the internal resolution so the per-frame fill cost cannot blow up
    // on very large or high-DPI displays. The CSS stretches the bitmap back to
    // the full window (canvas { width: 100vw; height: 100vh }) with smoothing,
    // so a larger-than-1920px window simply renders slightly softer instead of
    // grinding the GPU. Input mapping already accounts for the scale
    // (Pointer scales by canvas.width / bounds.width).
    const MAX_DIMENSION = 1920;
    const largest = Math.max(window.innerWidth, window.innerHeight);
    const scale = largest > MAX_DIMENSION ? MAX_DIMENSION / largest : 1;
    canvasViewport.width = Math.round(window.innerWidth * scale);
    canvasViewport.height = Math.round(window.innerHeight * scale);
    this.canvas.width = canvasViewport.width;
    this.canvas.height = canvasViewport.height;
  }

  /** The game canvas, e.g. for attaching mouse input listeners. */
  get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  render(
    camera: Camera,
    player: Player,
    world: World,
    target: BlockTarget | null,
    inventory: Inventory,
    timeSeconds = 0,
  ): void {
    // Layers are painted in RENDER_LAYERS order. Only the implemented layers
    // have bodies today; the rest are documented slots. Keep this method
    // layer-driven so inserting a new layer never touches existing painters.
    // The static layers are rebuilt lazily (see ensureBackground/renderWorldLayer)
    // and re-blitted here; the dynamic layers draw fresh every frame.
    this.ensureLayerSize();
    this.renderBackground(camera);
    this.renderWorldLayer(camera, world);

    if (this.backgroundLayer) {
      this.ctx.drawImage(this.backgroundLayer, 0, 0);
    }
    this.renderClouds(camera, timeSeconds);
    if (this.worldLayer) {
      this.ctx.drawImage(this.worldLayer, 0, 0);
    }
    this.renderPlayer(camera, player);
    this.renderTarget(camera, target);
    this.applyLighting();
    this.renderHotbar(inventory);
  }

  /** (Re)creates the cached layer canvases to match the current viewport. */
  private ensureLayerSize(): void {
    const { width, height } = canvasViewport;
    if (
      this.backgroundLayer &&
      this.backgroundLayer.width === width &&
      this.backgroundLayer.height === height
    ) {
      return;
    }
    this.backgroundLayer = document.createElement("canvas");
    this.backgroundLayer.width = width;
    this.backgroundLayer.height = height;
    this.worldLayer = document.createElement("canvas");
    this.worldLayer.width = width;
    this.worldLayer.height = height;
    // Layers were discarded/resized: force a full rebuild on next render.
    this.lastBgX = NaN;
    this.lastBgY = NaN;
    this.lastViewX = NaN;
    this.lastViewY = NaN;
    this.lastWorldVersion = -1;
    this.lastAssetVersion = -1;
  }

  /**
   * Rebuilds the sky + mountains layer only when the camera's rounded position
   * (or the viewport) changed; otherwise it is reused as-is.
   */
  private renderBackground(camera: Camera): void {
    const x = Math.round(camera.x);
    const y = Math.round(camera.y);
    if (this.backgroundLayer && x === this.lastBgX && y === this.lastBgY) {
      return;
    }
    const layer = this.backgroundLayer!;
    // Reset the canvas: clears it and restores the identity transform.
    layer.width = layer.width;
    const ctx = layer.getContext("2d");
    if (!ctx) {
      return;
    }
    this.skyRenderer.render(ctx);
    this.mountains.render(ctx, camera);
    this.lastBgX = x;
    this.lastBgY = y;
  }

  /**
   * Rebuilds the block-grid layer only when the camera view origin, the world
   * or the loaded assets changed; otherwise it is reused as-is.
   */
  private renderWorldLayer(camera: Camera, world: World): void {
    const viewX = camera.viewX;
    const viewY = camera.viewY;
    const assetVersion = this.blockRenderer.assetVersion;
    if (
      this.worldLayer &&
      viewX === this.lastViewX &&
      viewY === this.lastViewY &&
      world.version === this.lastWorldVersion &&
      assetVersion === this.lastAssetVersion
    ) {
      return;
    }
    const layer = this.worldLayer!;
    // Reset the canvas: clears it and restores the identity transform.
    layer.width = layer.width;
    const ctx = layer.getContext("2d");
    if (!ctx) {
      return;
    }
    // Draw the grid in the same camera-translated space as before, so the
    // cached layer lines up exactly with the cursor-highlight layer.
    ctx.translate(-viewX, -viewY);
    this.blockRenderer.render(ctx, camera, world);
    this.lastViewX = viewX;
    this.lastViewY = viewY;
    this.lastWorldVersion = world.version;
    this.lastAssetVersion = assetVersion;
  }

  private renderClouds(camera: Camera, timeSeconds: number): void {
    this.clouds.render(this.ctx, camera, timeSeconds);
  }

  private renderTarget(camera: Camera, target: BlockTarget | null): void {
    if (!target) {
      return;
    }
    const size = CONFIG.block.size;
    const tx = blockToWorldX(target.x);
    const ty = blockToWorldY(target.y);

    this.ctx.save();
    // Draw the outline in the same camera-translated space as the block grid.
    // Before this fix the outline was drawn in world coordinates while the
    // blocks were camera-translated, so the highlighted cell drifted away from
    // the mouse as soon as the camera moved away from the origin.
    this.ctx.translate(-camera.viewX, -camera.viewY);

    // Soft translucent fill so the targeted cell clearly stands out.
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    this.ctx.fillRect(tx, ty, size, size);

    // Crisp outer glow ring.
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(tx + 1, ty + 1, size - 2, size - 2);

    // Inner accent corners for a subtle "handled" feel.
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    this.ctx.lineWidth = 1;
    const inset = 4;
    this.ctx.strokeRect(tx + inset, ty + inset, size - inset * 2, size - inset * 2);

    this.ctx.restore();
  }

  private renderPlayer(camera: Camera, player: Player): void {
    const { x, y } = player.position;
    const w = player.width;
    const h = player.height;

    this.ctx.save();
    this.ctx.translate(-camera.viewX, -camera.viewY);

    // Soft drop shadow on the ground beneath the player.
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    this.ctx.beginPath();
    this.ctx.ellipse(x + w / 2, y + h + 3, w * 0.45, 5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Base body rectangle (kept for gameplay-shaped collision box), drawn in
    // the player's flat colour so the character reads even before shading.
    this.ctx.fillStyle = CONFIG.player.color;
    this.ctx.fillRect(x, y, w, h);

    // Body shading: a soft vertical gradient (lighter top, darker bottom)
    // gives the character volume instead of a flat box.
    const body = this.ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, "rgba(255, 255, 255, 0.22)");
    body.addColorStop(0.55, "rgba(255, 255, 255, 0)");
    body.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    this.ctx.fillStyle = body;
    this.ctx.fillRect(x, y, w, h);

    // Rounded head: a lighter cap near the top blends the box into a figure.
    const headR = w * 0.5;
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    this.ctx.beginPath();
    this.ctx.ellipse(x + w / 2, y + headR * 0.85, headR * 0.62, headR * 0.85, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Simple face: two eyes for a friendly, alive look.
    this.ctx.fillStyle = "rgba(40, 30, 20, 0.85)";
    const eyeY = y + h * 0.3;
    const eyeDX = w * 0.16;
    const eyeR = Math.max(1.6, w * 0.055);
    this.ctx.beginPath();
    this.ctx.arc(x + w / 2 - eyeDX, eyeY, eyeR, 0, Math.PI * 2);
    this.ctx.arc(x + w / 2 + eyeDX, eyeY, eyeR, 0, Math.PI * 2);
    this.ctx.fill();

    // Feet: a subtle darker band at the bottom anchors the character.
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    this.ctx.fillRect(x + 1, y + h - 4, w - 2, 3);

    this.ctx.restore();
  }

  /**
   * Lighting pass seam.
   *
   * A future dynamic lighting/shadows pass runs here, after the world and
   * player are painted and before any foreground/UI layers. It is a screen
   * or world-space compositor (e.g. an offscreen canvas multiplied over the
   * scene). Deliberately empty for now — this is the insertion point only.
   */
  private applyLighting(): void {
    // Reserved for the lighting pass. No-op in this step.
  }

  /** The hotbar HUD, drawn last in screen space (ui layer). */
  private renderHotbar(inventory: Inventory): void {
    this.hotbar.render(this.ctx, inventory);
  }
}
