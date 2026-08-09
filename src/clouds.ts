import { canvasViewport, CONFIG } from "./config";
import type { Camera } from "./camera";

/** Deterministic hash of a small non-negative integer -> [0, 1). */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A single drifting cloud: a fixed screen-space band position (y, scale, puff
 * count are deterministic per cloud index) whose horizontal position moves
 * slowly over time and with a small parallax response to the camera.
 */
interface Cloud {
  readonly baseX: number; // deterministic ordering position in px
  readonly y: number; // screen y of the cloud centre
  readonly scale: number; // puff radius
  readonly puffs: number; // how many overlapping circles build the cloud
  readonly offsetY: number; // vertical jitter per puff
  readonly shade: number; // 0..1 shading strength, varies per cloud
}

/**
 * CloudLayer paints drifting clouds between the parallax mountains and the
 * world (RENDER_LAYERS: "clouds").
 *
 * Clouds are a screen-space sky layer: a fixed number of clouds (CONFIG.clouds
 * .count, chunk-independent) whose shape is deterministic per index but whose
 * horizontal position drifts with time and follows the camera at a small
 * parallax factor. Cost is O(count * puffs) circles per frame, never O(chunks).
 *
 * Each cloud is drawn as soft, puffy volume rather than a flat disc:
 *
 *   - a cool under-shadow body, offset slightly downward, gives the shaded
 *     underside of a real cumulus;
 *   - a bright white body sits on top, its puffs slightly flattened so the
 *     top edge reads rounded and full;
 *   - a warm subtle glow along the top catches sunlight from above.
 *
 * All passes are plain circles with translucent fills, so the layer stays
 * cheap and needs no textures.
 */
export class CloudLayer {
  private readonly clouds: Cloud[];

  constructor(
    count: number = CONFIG.clouds.count,
    baseY: number = CONFIG.clouds.baseY,
    bandHeight: number = CONFIG.clouds.bandHeight,
    minScale: number = CONFIG.clouds.minScale,
    maxScale: number = CONFIG.clouds.maxScale,
  ) {
    this.clouds = [];
    for (let i = 0; i < count; i++) {
      const scale = minScale + hash01(i + 1000) * (maxScale - minScale);
      const puffs = 3 + Math.floor(hash01(i + 2000) * 4);
      this.clouds.push({
        baseX: i * 260,
        y: baseY + hash01(i + 3000) * bandHeight,
        scale,
        puffs,
        offsetY: (hash01(i + 4000) - 0.5) * scale * 0.3,
        shade: 0.5 + hash01(i + 5000) * 0.5,
      });
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    timeSeconds: number,
  ): void {
    const { speed, parallaxFactor, opacity } = CONFIG.clouds;
    const spacing = canvasViewport.width + 260; // wrap band
    const drift = timeSeconds * speed - camera.x * parallaxFactor;

    for (const cloud of this.clouds) {
      const raw = cloud.baseX + drift;
      const x = ((raw % spacing) + spacing) % spacing - 130;
      this.drawCloud(ctx, x, cloud, opacity);
    }
  }

  private drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    cloud: Cloud,
    opacity: number,
  ): void {
    const { y, scale, shade } = cloud;

    // Under-shadow: a cool, slightly translucent body offset downward.
    ctx.globalAlpha = opacity * (0.5 + shade * 0.15);
    ctx.fillStyle = "rgba(108, 128, 158, 1)";
    this.traceCloud(ctx, x, y + scale * 0.28, cloud);
    ctx.fill();

    // Lit body: bright white, puffs flattened so the cloud reads full and soft.
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    this.traceCloud(ctx, x, y, cloud);
    ctx.fill();

    // Sunlit top: a warm tint over the upper puffs.
    ctx.globalAlpha = opacity * (0.3 + shade * 0.2);
    ctx.fillStyle = "rgba(255, 242, 220, 1)";
    this.traceCloud(ctx, x, y - scale * 0.16, cloud);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  /** Traces the cloud's overlapping puff circles as a single path. */
  private traceCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cloud: Cloud,
  ): void {
    const { scale, puffs, offsetY } = cloud;
    ctx.beginPath();
    for (let p = 0; p < puffs; p++) {
      const t = puffs > 1 ? p / (puffs - 1) : 0.5;
      const px = x + (t - 0.5) * scale * 2.2;
      const radius =
        scale * (0.5 + (puffs > 1 ? 1 - Math.abs(t - 0.5) * 2 : 0) * 0.5);
      ctx.moveTo(px + radius, y + offsetY);
      ctx.arc(px, y + offsetY, radius, 0, Math.PI * 2);
    }
  }
}
