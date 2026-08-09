import { BlockId } from "./blockTypes";
import { CONFIG } from "./config";

/** A single stack of one block type in a hotbar slot. */
export interface ItemStack {
  readonly id: BlockId;
  count: number;
}

/** The blocks a fresh game starts with, in slots 0-2. */
export const STARTER_STACKS: readonly ItemStack[] = [
  { id: BlockId.Grass, count: 64 },
  { id: BlockId.Dirt, count: 64 },
  { id: BlockId.Stone, count: 64 },
];

/**
 * Inventory is the player's block storage: a hotbar of stacks.
 *
 *   - exactly `hotbarSlots` slots (9); an empty slot is null;
 *   - stacks cap at `maxStack` (64); overflow fills the next same-id slot with
 *     room, then the next empty slot;
 *   - one selected slot drives placement (consumeSelected) — selection follows
 *     the 1-9 hotbar keys;
 *   - starting inventory is the starter stacks; a restored save replaces them.
 *
 * It is a pure data/logic class: no rendering (see HotbarRenderer), no world
 * access. It only tracks what the player carries.
 */
export class Inventory {
  readonly slots: (ItemStack | null)[];
  private selected = 0;

  constructor() {
    this.slots = new Array(CONFIG.inventory.hotbarSlots).fill(null);
  }

  /** A new inventory preloaded with the starter stacks. */
  static starter(): Inventory {
    const inventory = new Inventory();
    for (const stack of STARTER_STACKS) {
      inventory.addItem(stack.id, stack.count);
    }
    return inventory;
  }

  get selectedIndex(): number {
    return this.selected;
  }

  /** Selects a hotbar slot (0-based, driven by the 1-9 keys). */
  selectSlot(index: number): void {
    if (index >= 0 && index < this.slots.length) {
      this.selected = index;
    }
  }

  /** The stack in the selected slot, or null when it is empty. */
  getSelectedStack(): ItemStack | null {
    return this.slots[this.selected];
  }

  /** Block id the player would place, or Air when the selected slot is empty. */
  selectedBlockId(): BlockId {
    return this.slots[this.selected]?.id ?? BlockId.Air;
  }

  /** Adds `count` of a block, filling existing stacks then empty slots. */
  addItem(id: BlockId, count = 1): void {
    if (count <= 0) {
      return;
    }
    const max = CONFIG.inventory.maxStack;
    for (const slot of this.slots) {
      if (count === 0) {
        return;
      }
      if (slot && slot.id === id && slot.count < max) {
        const added = Math.min(max - slot.count, count);
        slot.count += added;
        count -= added;
      }
    }
    for (let i = 0; i < this.slots.length; i++) {
      if (count === 0) {
        return;
      }
      if (this.slots[i] === null) {
        const added = Math.min(max, count);
        this.slots[i] = { id, count: added };
        count -= added;
      }
    }
  }

  /**
   * Consumes `count` from the selected slot, emptying it at 0. Returns false
   * (and changes nothing) when the slot is empty or holds too few items.
   */
  consumeSelected(count = 1): boolean {
    const slot = this.slots[this.selected];
    if (!slot || slot.count < count) {
      return false;
    }
    slot.count -= count;
    if (slot.count === 0) {
      this.slots[this.selected] = null;
    }
    return true;
  }

  /** The non-empty stacks, for persistence. */
  getSaveData(): ItemStack[] {
    return this.slots.filter((slot): slot is ItemStack => slot !== null);
  }

  /** Replaces all slots from persisted stacks. */
  applySaveData(data: readonly ItemStack[]): void {
    this.slots.fill(null);
    for (const stack of data) {
      this.addItem(stack.id, stack.count);
    }
  }
}
