import { CONFIG } from "./config";
import { BlockId, isSolid } from "./blockTypes";
import {
  blockToWorldX,
  blockToWorldY,
  worldToBlockX,
  worldToBlockY,
} from "./chunk";
import type { Pointer } from "./pointer";
import type { Camera } from "./camera";
import type { Player } from "./player";
import type { World } from "./world";
import type { Inventory } from "./inventory";

export interface BlockTarget {
  x: number;
  y: number;
}

/**
 * BlockInteraction is the first world interaction system: destroy and place
 * blocks with the mouse. It keeps concerns separated:
 *
 *   - Pointer provides raw mouse state (screen coords + buttons).
 *   - This system translates that into a targeted block cell and applies the
 *     policy (only solid blocks can be destroyed; blocks can only be placed
 *     into Air and never inside the player's body).
 *   - World.setBlockAt is the only path that modifies the world, so changes
 *     are instantly visible (the renderer reads the chunk buffer every frame)
 *     and work across chunk boundaries (World owns all chunk math).
 *
 * The private destroyBlock/placeBlock methods are the seams where tools and
 * inventory plug in: tools will gate destruction speed/power, and the
 * inventory already supplies the block id to place and records destroyed
 * blocks (collect on break, consume on place).
 */
export class BlockInteraction {
  private readonly inventory: Inventory;
  private wasLeftDown = false;
  private wasRightDown = false;

  /** The block cell currently under the mouse cursor. */
  target: BlockTarget;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
    this.target = { x: 0, y: 0 };
  }

  update(pointer: Pointer, camera: Camera, world: World, player: Player): void {
    // Screen -> world conversion uses the same pixel-rounded camera origin the
    // renderer translates by (camera.viewX/viewY), so the targeted cell is
    // exactly the cell under the cursor on screen. Using raw camera.x/y here
    // while rendering rounded would desync the highlight by up to a pixel and
    // (after a resize) by more.
    const worldX = pointer.x + camera.viewX;
    const worldY = pointer.y + camera.viewY;
    this.target.x = worldToBlockX(worldX);
    this.target.y = worldToBlockY(worldY);

    // Act on press edges (not hold) so clicks never repeat while held.
    if (pointer.leftDown && !this.wasLeftDown) {
      this.destroyBlock(world, this.target);
    }
    if (pointer.rightDown && !this.wasRightDown) {
      this.placeBlock(world, player, this.target);
    }

    this.wasLeftDown = pointer.leftDown;
    this.wasRightDown = pointer.rightDown;
  }

  private destroyBlock(world: World, target: BlockTarget): void {
    const id = world.getBlockAt(target.x, target.y);
    if (!isSolid(id)) {
      return;
    }
    world.setBlockAt(target.x, target.y, BlockId.Air);
    this.inventory.addItem(id, 1);
  }

  private placeBlock(world: World, player: Player, target: BlockTarget): void {
    const id = this.inventory.selectedBlockId();
    if (!isSolid(id)) {
      return;
    }
    if (world.getBlockAt(target.x, target.y) !== BlockId.Air) {
      return;
    }
    if (this.intersectsPlayer(player, target)) {
      return;
    }
    world.setBlockAt(target.x, target.y, id);
    this.inventory.consumeSelected(1);
  }

  private intersectsPlayer(player: Player, target: BlockTarget): boolean {
    const left = blockToWorldX(target.x);
    const top = blockToWorldY(target.y);
    const right = left + CONFIG.block.size;
    const bottom = top + CONFIG.block.size;

    return (
      left < player.position.x + player.width &&
      right > player.position.x &&
      top < player.position.y + player.height &&
      bottom > player.position.y
    );
  }
}
