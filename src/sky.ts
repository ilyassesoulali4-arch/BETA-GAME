import { canvasViewport, CONFIG } from "./config";

/**
 * SkyRenderer paints the daytime sky: a rich vertical gradient with a warm
 * sun glow and a soft horizon haze.
 *
 * This is the bottom-most layer (RENDER_LAYERS: "sky"), drawn once per frame
 * before anything else, covering the whole canvas.
 *
 * Realism passes layered on top of the base gradient:
 *
 *   - a radial sun glow high in the sky (soft, warm halo);
 *   - a warm horizontal band hugging the horizon that fades upward, giving
 *     the depth-of-atmosphere look of a real daytime scene.
 *
 * All passes are cheap (two gradients + fills) and stateless.
 */
export class SkyRenderer {
  private readonly gradient: string[];

  constructor(gradientStops: readonly { offset: number; color: string }[] = CONFIG.sky.gradient) {
    this.gradient = gradientStops.map((stop) => stop.color);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderBaseGradient(ctx);
    this.renderSunGlow(ctx);
    this.renderHorizonWarmth(ctx);
  }

  private renderBaseGradient(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasViewport.height);
    for (let i = 0; i < CONFIG.sky.gradient.length; i++) {
      gradient.addColorStop(CONFIG.sky.gradient[i].offset, this.gradient[i]);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasViewport.width, canvasViewport.height);
  }

  /** A soft radial glow near the top-right of the sky (the sun). */
  private renderSunGlow(ctx: CanvasRenderingContext2D): void {
    const sunX = canvasViewport.width * 0.72;
    const sunY = canvasViewport.height * 0.16;
    const radius = Math.max(canvasViewport.width, canvasViewport.height) * 0.5;

    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, radius);
    glow.addColorStop(0, "rgba(255, 250, 230, 0.6)");
    glow.addColorStop(0.22, "rgba(255, 244, 210, 0.2)");
    glow.addColorStop(1, "rgba(255, 244, 210, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvasViewport.width, canvasViewport.height);
  }

  /** A warm band along the horizon for atmospheric depth. */
  private renderHorizonWarmth(ctx: CanvasRenderingContext2D): void {
    const height = canvasViewport.height * 0.22;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(255, 214, 160, 0.3)");
    gradient.addColorStop(1, "rgba(255, 214, 160, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasViewport.width, height);
  }
}
