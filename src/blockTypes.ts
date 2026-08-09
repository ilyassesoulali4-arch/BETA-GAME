/**
 * Block definitions: the static metadata of every block type.
 *
 * This file defines WHAT blocks are (id, name, color, solidity). It never
 * stores any per-world state. World data (a Chunk's block buffer) only holds
 * the numeric ids defined here, which is what keeps definitions and data
 * cleanly separated and trivially extensible: adding a block type is adding
 * one entry to the registry.
 */

export const BlockId = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
} as const;

export type BlockId = (typeof BlockId)[keyof typeof BlockId];

export interface BlockType {
  readonly id: BlockId;
  readonly name: string;
  readonly color: string;
  readonly solid: boolean;
  /** Optional asset id in the Asset system (see assets/). When missing or
   *  unloaded, rendering falls back to the flat color. */
  readonly assetId?: string;
}

const BLOCK_TYPES: readonly BlockType[] = [
  { id: BlockId.Air, name: "air", color: "#000000", solid: false },
  {
    id: BlockId.Grass,
    name: "grass",
    color: "#4a7c3f",
    solid: true,
    assetId: "block.grass",
  },
  {
    id: BlockId.Dirt,
    name: "dirt",
    color: "#7a5230",
    solid: true,
    assetId: "block.dirt",
  },
  {
    id: BlockId.Stone,
    name: "stone",
    color: "#8d8d8d",
    solid: true,
    assetId: "block.stone",
  },
];

/** Returns the definition for a block id; unknown ids fall back to Air. */
export function getBlockType(id: number): BlockType {
  return BLOCK_TYPES[id] ?? BLOCK_TYPES[BlockId.Air];
}

/** Whether a block id is solid (blocks movement / is rendered as a body). */
export function isSolid(id: number): boolean {
  return getBlockType(id).solid;
}
