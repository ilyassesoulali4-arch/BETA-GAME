import { describe, expect, it } from "vitest";
import { SaveSystem } from "../src/saveSystem";
import { World } from "../src/world";
import { BlockId } from "../src/blockTypes";
import { Inventory } from "../src/inventory";

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
}

function makePlayer() {
  return { position: { x: 0, y: 0 } };
}

describe("SaveSystem (world + inventory)", () => {
  it("round-trips edits, player position and inventory", () => {
    const storage = makeStorage();
    const ss = new SaveSystem(storage);

    const world = new World("save-ok");
    world.setBlockAt(0, 15, BlockId.Stone);
    world.setBlockAt(-520, -20, BlockId.Dirt);
    const player = { position: { x: 12, y: 34 } };
    const inventory = new Inventory();
    inventory.addItem(BlockId.Stone, 64);
    inventory.addItem(BlockId.Grass, 7);

    ss.save(ss.capture(world, player, inventory));
    const loaded = ss.load();
    expect(loaded).not.toBeNull();

    const world2 = new World("save-ok");
    const player2 = makePlayer();
    const inventory2 = new Inventory();
    ss.restore(world2, player2, inventory2, loaded!);

    expect(world2.getBlockAt(0, 15)).toBe(BlockId.Stone);
    expect(world2.getBlockAt(-520, -20)).toBe(BlockId.Dirt);
    expect(player2.position).toEqual({ x: 12, y: 34 });
    expect(inventory2.getSaveData()).toEqual(inventory.getSaveData());
  });

  it("rejects future format versions", () => {
    const storage = makeStorage();
    const ss = new SaveSystem(storage);
    storage.setItem(
      "endless-world:world",
      JSON.stringify({ version: 999, seed: "x", chunks: [] }),
    );
    expect(ss.load()).toBeNull();
  });

  it("clear removes persisted state", () => {
    const storage = makeStorage();
    const ss = new SaveSystem(storage);
    const world = new World("clear-me");
    const inventory = new Inventory();
    ss.save(ss.capture(world, makePlayer(), inventory));
    expect(ss.load()).not.toBeNull();
    ss.clear();
    expect(ss.load()).toBeNull();
  });
});
