import { canvasViewport, CONFIG } from "./config";
import type { Player } from "./player";

/**
 * The Camera converts world coordinates into the view shown on screen.
 *
 * For version 0.1 it simply eases toward the player's center. Later it will be
 * the point of contact with chunk loading and the procedural world.
 */
export class Camera {
  x: number;
  y: number;

  constructor() {
    this.x = 0;
    this.y = 0;
  }

  follow(target: Player, deltaSeconds: number): void {
    const lerp = 1 - Math.exp(-CONFIG.camera.followLerp * deltaSeconds);
    const targetX = target.centerX - canvasViewport.width / 2;
    const targetY = target.centerY - canvasViewport.height / 2;

    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;
  }

  /**
   * The camera's view origin as whole pixels (camera.x/y rounded). Rendering,
   * target highlighting and mouse targeting all use these values so every
   * layer shares the exact same translation. Rounding keeps blocks and the
   * target outline on the pixel grid: a fractional camera eased by follow()
   * would otherwise put sub-pixel offsets between block cells and the cursor
   * highlight (visible as seams and a target that drifts away from the mouse).
   */
  get viewX(): number {
    return Math.round(this.x);
  }

  get viewY(): number {
    return Math.round(this.y);
  }
}
