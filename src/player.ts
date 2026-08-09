import { CONFIG } from "./config";
import { isSolid } from "./blockTypes";
import type { Input } from "./input";
import type { World } from "./world";

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * The Player is a solid rectangle moving through the block grid.
 *
 * Collision is resolved against the actual blocks the player's body overlaps
 * (an axis-aligned bounding box), never against an imaginary ray:
 *
 *   - Horizontal and vertical movement are resolved independently, clamped by
 *     direction of motion, so a wall stops the player and a ceiling stops a
 *     jump.
 *   - Each axis moves in sub-steps no larger than one block, so fast falls and
 *     dashes cannot tunnel through thin walls or floors.
 *   - The player is only ever "grounded" when a solid block sits directly
 *     below the feet. Blocks above or beside the player can never pull the
 *     player upward.
 */
export class Player {
  readonly width: number;
  readonly height: number;

  position: Vec2;
  velocity: Vec2;
  grounded = false;

  constructor() {
    this.width = CONFIG.player.width;
    this.height = CONFIG.player.height;
    this.position = {
      x: CONFIG.player.spawn.x,
      y: CONFIG.player.spawn.y,
    };
    this.velocity = { x: 0, y: 0 };
  }

  update(deltaSeconds: number, input: Input, world: World): void {
    const { moveSpeed, gravity } = CONFIG.player;

    let moveX = 0;
    if (input.isLeftDown()) {
      moveX -= 1;
    }
    if (input.isRightDown()) {
      moveX += 1;
    }

    this.velocity.x = moveX * moveSpeed;
    this.velocity.y += gravity * deltaSeconds;

    // Resolve each axis separately; sub-steps prevent tunneling.
    this.moveX(world, this.velocity.x * deltaSeconds);
    this.moveY(world, this.velocity.y * deltaSeconds);

    this.grounded = this.isGrounded(world);

    // Manual jump while standing on the ground.
    if (input.isJumpDown() && this.grounded) {
      this.startJump();
    }
    // Auto-jump: while running, hop over low obstacles blocking the way.
    if (this.grounded && this.shouldAutoJump(world, moveX)) {
      this.startJump();
    }
  }

  /**
   * Whether the player, while running, should automatically jump over a low
   * obstacle ahead: a solid block right in front of the feet whose column is
   * at most `maxAutoJumpHeight` blocks tall. Taller walls are not jumped; the
   * player simply stops at them.
   */
  private shouldAutoJump(world: World, direction: number): boolean {
    if (direction === 0) {
      return false;
    }

    const feetRow = Math.floor(
      (this.position.y + this.height - EPSILON) / BLOCK_SIZE,
    );
    const aheadCol =
      direction > 0
        ? Math.floor((this.position.x + this.width + EPSILON) / BLOCK_SIZE)
        : Math.floor((this.position.x - EPSILON) / BLOCK_SIZE);

    // No obstacle directly in front of the feet.
    if (!isSolid(world.getBlockAt(aheadCol, feetRow))) {
      return false;
    }

    // Count how tall the obstacle column is above the feet row.
    let height = 0;
    let row = feetRow;
    while (isSolid(world.getBlockAt(aheadCol, row))) {
      height++;
      row--;
    }
    return height <= CONFIG.player.maxAutoJumpHeight;
  }

  private startJump(): void {
    this.velocity.y = -CONFIG.player.jumpVelocity;
    this.grounded = false;
    // Note: no manual position lift here. The player starts rising from the
    // exact resting position; resolveY handles the ceiling on the next frame.
    // A fixed -2px lift used to nudge the feet off the ground, but that could
    // push the head into a ceiling block and looked like a small vertical
    // hitch every jump.
  }

  get centerX(): number {
    return this.position.x + this.width / 2;
  }

  get centerY(): number {
    return this.position.y + this.height / 2;
  }

  private moveX(world: World, deltaX: number): void {
    if (deltaX === 0) {
      return;
    }
    const movingRight = deltaX > 0;
    const steps = Math.max(1, Math.ceil(Math.abs(deltaX) / BLOCK_SIZE));
    const step = deltaX / steps;
    for (let i = 0; i < steps; i++) {
      this.position.x += step;
      if (this.resolveX(world, movingRight)) {
        break;
      }
    }
  }

  private moveY(world: World, deltaY: number): void {
    if (deltaY === 0) {
      return;
    }
    const movingDown = deltaY > 0;
    const steps = Math.max(1, Math.ceil(Math.abs(deltaY) / BLOCK_SIZE));
    const step = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      this.position.y += step;
      if (this.resolveY(world, movingDown)) {
        break;
      }
    }
  }

  /**
   * Clamp horizontally if the moving edge enters a solid block. Returns true
   * when the movement was blocked.
   */
  private resolveX(world: World, movingRight: boolean): boolean {
    const edgeBlockX = movingRight
      ? Math.floor((this.position.x + this.width - EPSILON) / BLOCK_SIZE)
      : Math.floor((this.position.x + EPSILON) / BLOCK_SIZE);

    const { top, bottom } = this.blockYRange();
    for (let by = top; by <= bottom; by++) {
      if (isSolid(world.getBlockAt(edgeBlockX, by))) {
        if (movingRight) {
          this.position.x = edgeBlockX * BLOCK_SIZE - this.width;
        } else {
          this.position.x = (edgeBlockX + 1) * BLOCK_SIZE;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Clamp vertically against the block at the moving edge (feet when falling,
   * head when rising). Returns true when the movement was blocked.
   */
  private resolveY(world: World, movingDown: boolean): boolean {
    const { left, right } = this.blockXRange();

    if (movingDown) {
      const row = Math.floor(
        (this.position.y + this.height - EPSILON) / BLOCK_SIZE,
      );
      for (let bx = left; bx <= right; bx++) {
        if (isSolid(world.getBlockAt(bx, row))) {
          this.position.y = row * BLOCK_SIZE - this.height;
          this.velocity.y = 0;
          return true;
        }
      }
    } else {
      const row = Math.floor((this.position.y + EPSILON) / BLOCK_SIZE);
      for (let bx = left; bx <= right; bx++) {
        if (isSolid(world.getBlockAt(bx, row))) {
          this.position.y = (row + 1) * BLOCK_SIZE;
          this.velocity.y = 0;
          return true;
        }
      }
    }
    return false;
  }

  /** Grounded only when a solid block is directly below the feet. */
  private isGrounded(world: World): boolean {
    const row = Math.floor(
      (this.position.y + this.height + EPSILON) / BLOCK_SIZE,
    );
    const { left, right } = this.blockXRange();
    for (let bx = left; bx <= right; bx++) {
      if (isSolid(world.getBlockAt(bx, row))) {
        return true;
      }
    }
    return false;
  }

  private blockXRange(): { left: number; right: number } {
    const left = Math.floor((this.position.x + EPSILON) / BLOCK_SIZE);
    const right = Math.floor(
      (this.position.x + this.width - EPSILON) / BLOCK_SIZE,
    );
    return { left, right };
  }

  private blockYRange(): { top: number; bottom: number } {
    const top = Math.floor((this.position.y + EPSILON) / BLOCK_SIZE);
    const bottom = Math.floor(
      (this.position.y + this.height - EPSILON) / BLOCK_SIZE,
    );
    return { top, bottom };
  }
}

const EPSILON = 0.001;
const BLOCK_SIZE = CONFIG.block.size;
