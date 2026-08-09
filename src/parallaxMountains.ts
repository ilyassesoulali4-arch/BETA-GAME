import { canvasViewport, CONFIG } from "./config";
import type { Camera } from "./camera";

/**
 * A single procedural mountain ridge.
 *
 * The silhouette is a height function of world X (layered sines), so it is
 * deterministic, continuous across the infinite world and computed in O(1) per
 * sample — never per block, never per chunk. `factor` is the parallax factor:
 * the ridge scrolls at `factor * camera` speed.
 */
interface MountainRidge {
  readonly factor: number;
  readonly color: string;
  readonly maxHeight: number;
  /** Phase seed so the two ridges do not overlap exactly. */
  readonly seed: number;
  /** Horizontal sampling step in world px; bounds the per-frame cost. */
  readonly step: number;
}

/**
 * ParallaxMountains paints the mountain silhouettes behind the world
 * (RENDER_LAYERS: "parallaxMountains").
 *
 * Two ridges give depth: a far, lighter ridge at half the layer parallax and a
 * near, darker ridge at the full layer parallax. Both are drawn in world space
 * under a `translate(-camera * factor)` so they move slower than the world but
 * stay anchored to world coordinates.
 *
 * Each ridge is filled with a vertical gradient (a darker shade at its base
 * fading to its given colour near the peaks) plus a subtle haze band across
 * the bottom, so the mountains read as layered, atmospheric silhouettes rather
 * than flat two-tone shapes.
 *
 * Cost is O(viewport.width / step) path points per ridge per frame, entirely
 * independent of the number of chunks or blocks.
 */
export class ParallaxMountains {
  private readonly ridges: readonly MountainRidge[];

  constructor(
    factor: number = CONFIG.parallax.mountains.factor,
    farColor: string = CONFIG.parallax.mountains.farColor,
    nearColor: string = CONFIG.parallax.mountains.nearColor,
    farHeight: number = CONFIG.parallax.mountains.farHeight,
    nearHeight: number = CONFIG.parallax.mountains.nearHeight,
  ) {
    this.ridges = [
      { factor: factor * 0.5, color: farColor, maxHeight: farHeight, seed: 1.7, step: 24 },
      { factor, color: nearColor, maxHeight: nearHeight, seed: 3.9, step: 24 },
    ];
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const ridge of this.ridges) {
      this.renderRidge(ctx, camera, ridge);
    }
  }

  private renderRidge(ctx: CanvasRenderingContext2D, camera: Camera, ridge: MountainRidge): void {
    ctx.save();
    ctx.translate(-camera.x * ridge.factor, -camera.y * ridge.factor);

    const startX = camera.x * ridge.factor;
    const endX = startX + canvasViewport.width;
    const baseY = CONFIG.terrain.baseY;
    const belowScreen = baseY + 10000;

    ctx.beginPath();
    ctx.moveTo(startX, baseY);
    for (let wx = startX; wx <= endX; wx += ridge.step) {
      ctx.lineTo(wx, baseY - this.ridgeHeight(wx, ridge));
    }
    ctx.lineTo(endX, baseY);
    ctx.lineTo(endX, belowScreen);
    ctx.lineTo(startX, belowScreen);
    ctx.closePath();

    // Base silhouette in the ridge's colour.
    ctx.fillStyle = ridge.color;
    ctx.fill();

    // Atmospheric depth: a soft dark gradient from the base upward, then a
    // pale haze band along the base. Both are translucent overlays, so the
    // ridge colour remains the anchor and the range reads as layered volume
    // rather than a flat two-tone shape.
    const gradient = ctx.createLinearGradient(0, baseY - ridge.maxHeight, 0, baseY);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    ctx.fillStyle = gradient;
    ctx.fill();

    const haze = ctx.createLinearGradient(0, baseY - ridge.maxHeight * 0.25, 0, baseY);
    haze.addColorStop(0, "rgba(255, 255, 255, 0)");
    haze.addColorStop(1, "rgba(255, 255, 255, 0.22)");
    ctx.fillStyle = haze;
    ctx.fill();
    ctx.restore();
  }

  /** Deterministic ridge height at a world X; bounded in [0, maxHeight]. */
  private ridgeHeight(worldX: number, ridge: MountainRidge): number {
    const a = Math.sin(worldX * 0.0013 + ridge.seed);
    const b = Math.sin(worldX * 0.0037 + ridge.seed * 2.3);
    const c = Math.sin(worldX * 0.009 + ridge.seed * 5.1);
    const undulation = 0.5 + 0.5 * Math.sin(worldX * 0.0006 + ridge.seed * 0.7);
    const ridgeShape = 0.4 + 0.6 * Math.pow(Math.abs(a * 0.5 + b * 0.3 + c * 0.2), 1.5);
    return Math.min(ridge.maxHeight, undulation * ridgeShape * ridge.maxHeight);
  }
}
