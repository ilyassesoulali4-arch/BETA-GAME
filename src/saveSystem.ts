import type { ChunkDiff } from "./world";
import type { ItemStack } from "./inventory";
import type { Player } from "./player";
import type { World } from "./world";
import type { Inventory } from "./inventory";

const STORAGE_KEY = "endless-world:world";
const FORMAT_VERSION = 2;

/**
 * The complete persistent state of a world: the seed (identity), the player's
 * position, the inventory (item stacks), and the chunk diffs (player
 * modifications on top of the deterministically generated terrain).
 *
 * The chunk diffs alone are enough to rebuild any touched area, because
 * terrain generation is a pure function of the seed. Restoring a world is:
 * construct World(seed), replay each diff's cells onto its regenerated chunk.
 */
export interface WorldSave {
  version: number;
  seed: string;
  player: { x: number; y: number };
  inventory: ItemStack[];
  chunks: ChunkDiff[];
}

/**
 * SaveSystem handles serializing World state to and from localStorage.
 *
 * It owns only the persistence format and lifecycle — not the world's rules.
 * World exposes the raw diffs (getSaveData / applySaveData); SaveSystem wraps
 * them with the seed and player position, writes them to localStorage, and
 * validates the stored version on load. A version bump later can migrate old
 * saves instead of discarding them.
 */
export class SaveSystem {
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;

  constructor(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
    this.storage = storage;
  }

  /** Serializes the world's current state into a WorldSave payload. */
  capture(world: World, player: Player, inventory: Inventory): WorldSave {
    return {
      version: FORMAT_VERSION,
      seed: world.seed,
      player: { x: player.position.x, y: player.position.y },
      inventory: inventory.getSaveData(),
      chunks: world.getSaveData(),
    };
  }

  /** Persists a payload to storage. */
  save(save: WorldSave): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(save));
  }

  /** Loads a payload from storage, or null if absent or incompatible. */
  load(): WorldSave | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as WorldSave;
      if (parsed.version !== FORMAT_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /** Removes any persisted state. */
  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  /**
   * Applies a payload onto a freshly constructed world, player and inventory.
   * The world must have been created with the payload's seed. This is the
   * inverse of capture + save.
   */
  restore(world: World, player: Player, inventory: Inventory, save: WorldSave): void {
    world.applySaveData(save.chunks);
    player.position.x = save.player.x;
    player.position.y = save.player.y;
    inventory.applySaveData(save.inventory);
  }
}
