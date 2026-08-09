import { describe, expect, it } from "vitest";
import { Inventory, STARTER_STACKS } from "../src/inventory";
import { BlockId } from "../src/blockTypes";
import { CONFIG } from "../src/config";

describe("Inventory", () => {
  it("starts empty with the configured number of slots", () => {
    const inventory = new Inventory();
    expect(inventory.slots.length).toBe(CONFIG.inventory.hotbarSlots);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
  });

  it("starter inventory fills the first three slots", () => {
    const inventory = Inventory.starter();
    expect(inventory.getSelectedStack()).toEqual(STARTER_STACKS[0]);
    expect(inventory.slots[1]).toEqual(STARTER_STACKS[1]);
    expect(inventory.slots[2]).toEqual(STARTER_STACKS[2]);
    expect(inventory.slots[3]).toBeNull();
  });

  it("addItem stacks into an existing slot up to maxStack", () => {
    const inventory = new Inventory();
    inventory.addItem(BlockId.Stone, 10);
    inventory.addItem(BlockId.Stone, 20);
    expect(inventory.slots[0]).toEqual({ id: BlockId.Stone, count: 30 });
  });

  it("addItem overflows into a second slot beyond maxStack", () => {
    const inventory = new Inventory();
    inventory.addItem(BlockId.Stone, CONFIG.inventory.maxStack);
    inventory.addItem(BlockId.Stone, 3);
    expect(inventory.slots[0]).toEqual({
      id: BlockId.Stone,
      count: CONFIG.inventory.maxStack,
    });
    expect(inventory.slots[1]).toEqual({ id: BlockId.Stone, count: 3 });
  });

  it("addItem fills the first empty slot for a new block id", () => {
    const inventory = new Inventory();
    inventory.addItem(BlockId.Grass, 1);
    inventory.addItem(BlockId.Dirt, 2);
    expect(inventory.slots[0]).toEqual({ id: BlockId.Grass, count: 1 });
    expect(inventory.slots[1]).toEqual({ id: BlockId.Dirt, count: 2 });
  });

  it("selectSlot changes the selected block id", () => {
    const inventory = Inventory.starter();
    inventory.selectSlot(2);
    expect(inventory.selectedIndex).toBe(2);
    expect(inventory.selectedBlockId()).toBe(BlockId.Stone);
  });

  it("ignores out-of-range slot selection", () => {
    const inventory = Inventory.starter();
    inventory.selectSlot(99);
    expect(inventory.selectedIndex).toBe(0);
    inventory.selectSlot(-1);
    expect(inventory.selectedIndex).toBe(0);
  });

  it("selectedBlockId is Air for an empty slot", () => {
    const inventory = new Inventory();
    expect(inventory.selectedBlockId()).toBe(BlockId.Air);
    expect(inventory.getSelectedStack()).toBeNull();
  });

  it("consumeSelected reduces the stack and empties the slot at 0", () => {
    const inventory = new Inventory();
    inventory.addItem(BlockId.Grass, 2);
    expect(inventory.consumeSelected(1)).toBe(true);
    expect(inventory.slots[0]).toEqual({ id: BlockId.Grass, count: 1 });
    expect(inventory.consumeSelected(1)).toBe(true);
    expect(inventory.slots[0]).toBeNull();
  });

  it("consumeSelected fails without changes on an empty slot", () => {
    const inventory = new Inventory();
    expect(inventory.consumeSelected(1)).toBe(false);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
  });

  it("consumeSelected fails without changes when the stack is too small", () => {
    const inventory = new Inventory();
    inventory.addItem(BlockId.Dirt, 1);
    expect(inventory.consumeSelected(2)).toBe(false);
    expect(inventory.slots[0]).toEqual({ id: BlockId.Dirt, count: 1 });
  });

  it("getSaveData omits empty slots and applySaveData restores stacks", () => {
    const inventory = new Inventory();
    inventory.addItem(BlockId.Stone, 64);
    inventory.addItem(BlockId.Grass, 5);
    const data = inventory.getSaveData();
    expect(data).toEqual([
      { id: BlockId.Stone, count: 64 },
      { id: BlockId.Grass, count: 5 },
    ]);

    const restored = new Inventory();
    restored.applySaveData(data);
    expect(restored.getSaveData()).toEqual(data);
  });
});
