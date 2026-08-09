import { describe, expect, it } from "vitest";
import { BlockInteraction } from "../src/blockInteraction";
import { BlockId } from "../src/blockTypes";
import { World } from "../src/world";
import { Player } from "../src/player";
import { Camera } from "../src/camera";
import { Inventory } from "../src/inventory";
import { blockToWorldX, blockToWorldY } from "../src/chunk";

/**
 * BlockInteraction tests drive update() with a fake pointer (screen coords +
 * button state) and a camera at the origin, so screen coords equal world coords.
 */
function fakePointer(x = 0, y = 0, left = false, right = false) {
  return { x, y, leftDown: left, rightDown: right };
}

describe("BlockInteraction", () => {
  it("destroys a solid block on left press and collects it", () => {
    const world = new World("interaction-test");
    const player = new Player();
    const camera = new Camera();
    const inventory = new Inventory();
    const interaction = new BlockInteraction(inventory);

    // Place a stone block in the sky so the pointer can target it directly.
    world.setBlockAt(10, 100, BlockId.Stone);
    const pointer = fakePointer(
      blockToWorldX(10) + 1,
      blockToWorldY(100) + 1,
      true,
      false,
    );

    interaction.update(pointer, camera, world, player);
    expect(world.getBlockAt(10, 100)).toBe(BlockId.Air);
    expect(inventory.getSelectedStack()).toEqual({ id: BlockId.Stone, count: 1 });
  });

  it("does not destroy air nor collect anything", () => {
    const world = new World("interaction-test");
    const player = new Player();
    const camera = new Camera();
    const inventory = new Inventory();
    const interaction = new BlockInteraction(inventory);

    // Row 3 is safely above the terrain surface in every seed (surface rows
    // are in [10,25]), so this cell is genuine Air.
    expect(world.getBlockAt(10, 3)).toBe(BlockId.Air);
    const pointer = fakePointer(
      blockToWorldX(10) + 1,
      blockToWorldY(3) + 1,
      true,
      false,
    );
    interaction.update(pointer, camera, world, player);
    // Cell was already air; stays air and nothing is collected.
    expect(world.getBlockAt(10, 3)).toBe(BlockId.Air);
    expect(inventory.getSaveData()).toEqual([]);
  });

  it("places the selected block into air on right press and consumes it", () => {
    const world = new World("interaction-test");
    const player = new Player();
    const camera = new Camera();
    const inventory = new Inventory();
    inventory.addItem(BlockId.Grass, 2);
    const interaction = new BlockInteraction(inventory);

    const pointer = fakePointer(
      blockToWorldX(10) + 1,
      blockToWorldY(3) + 1,
      false,
      true,
    );
    interaction.update(pointer, camera, world, player);
    expect(world.getBlockAt(10, 3)).toBe(BlockId.Grass);
    expect(inventory.getSelectedStack()).toEqual({ id: BlockId.Grass, count: 1 });
  });

  it("consumes the slot to empty and then refuses to place", () => {
    const world = new World("interaction-test");
    const player = new Player();
    const camera = new Camera();
    const inventory = new Inventory();
    inventory.addItem(BlockId.Grass, 1);
    const interaction = new BlockInteraction(inventory);

    // First placement consumes the single grass.
    const first = fakePointer(
      blockToWorldX(10) + 1,
      blockToWorldY(3) + 1,
      false,
      true,
    );
    interaction.update(first, camera, world, player);
    expect(world.getBlockAt(10, 3)).toBe(BlockId.Grass);
    expect(inventory.getSelectedStack()).toBeNull();

    // A second click (new press edge) on a fresh air cell places nothing.
    const second = fakePointer(
      blockToWorldX(11) + 1,
      blockToWorldY(3) + 1,
      false,
      true,
    );
    interaction.update(second, camera, world, player);
    expect(world.getBlockAt(11, 3)).toBe(BlockId.Air);
  });

  it("does not place into an occupied cell", () => {
    const world = new World("interaction-test");
    const player = new Player();
    const camera = new Camera();
    const inventory = new Inventory();
    inventory.addItem(BlockId.Dirt, 1);
    const interaction = new BlockInteraction(inventory);

    world.setBlockAt(10, 3, BlockId.Dirt);
    const pointer = fakePointer(
      blockToWorldX(10) + 1,
      blockToWorldY(3) + 1,
      false,
      true,
    );
    interaction.update(pointer, camera, world, player);
    expect(world.getBlockAt(10, 3)).toBe(BlockId.Dirt);
    expect(inventory.getSelectedStack()).toEqual({ id: BlockId.Dirt, count: 1 });
  });

  it("acts on press edges only, not hold", () => {
    const world = new World("interaction-test");
    const player = new Player();
    const camera = new Camera();
    const inventory = new Inventory();
    const interaction = new BlockInteraction(inventory);

    world.setBlockAt(10, 100, BlockId.Stone);
    const pointer = fakePointer(
      blockToWorldX(10) + 1,
      blockToWorldY(100) + 1,
      true,
      false,
    );
    interaction.update(pointer, camera, world, player);
    expect(world.getBlockAt(10, 100)).toBe(BlockId.Air);

    // Place a block, then hold the button across frames: only the first press
    // should act, so the cell must not be destroyed again while held.
    world.setBlockAt(10, 100, BlockId.Stone);
    interaction.update(pointer, camera, world, player);
    interaction.update(pointer, camera, world, player);
    // A second press edge never fires while the button stays down, so the
    // block placed after the first press is preserved.
    expect(world.getBlockAt(10, 100)).toBe(BlockId.Stone);
  });
});
