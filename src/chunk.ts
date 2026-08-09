import { CONFIG } from "./config";
import type { BlockId } from "./blockTypes";

/**
 * Block grid and chunk math, plus the Chunk data container.
 *
 * A block cell is CONFIG.block.size pixels. World pixel coordinates convert to
 * block coordinates via Math.floor so negative coordinates work correctly.
 *
 * World columns are grouped into chunks of CONFIG.chunk.size blocks and world
 * rows into chunks of CONFIG.chunk.depth rows. A chunk is therefore a
 * rectangular region of the block grid, addressed by both a horizontal index
 * (chunkX) and a vertical index (chunkY). Because rows are chunked vertically
 * too, the world extends upward and downward without limit — placement is no
 * longer capped at CONFIG.chunk.depth rows above the sky.
 */

// --- Block grid math (world pixels <-> block cells) ---

export function worldToBlockX(x: number): number {
  return Math.floor(x / CONFIG.block.size);
}

export function worldToBlockY(y: number): number {
  return Math.floor(y / CONFIG.block.size);
}

export function blockToWorldX(blockX: number): number {
  return blockX * CONFIG.block.size;
}

export function blockToWorldY(blockY: number): number {
  return blockY * CONFIG.block.size;
}

// --- Chunk math (2D: chunkX over columns, chunkY over rows) ---

export function getChunkIndex(blockX: number): number {
  return Math.floor(blockX / CONFIG.chunk.size);
}

export function getChunkStartBlockX(chunkIndex: number): number {
  return chunkIndex * CONFIG.chunk.size;
}

export function getChunkY(blockY: number): number {
  return Math.floor(blockY / CONFIG.chunk.depth);
}

export function getChunkStartRow(chunkY: number): number {
  return chunkY * CONFIG.chunk.depth;
}

/**
 * Stable, unambiguous map key for a chunk. String keys avoid any collision
 * between packed numeric keys for arbitrarily large negative coordinates.
 */
export function chunkKey(chunkIndex: number, chunkY: number): string {
  return `${chunkIndex},${chunkY}`;
}

/** Horizontal chunk indices overlapping the block range [startBlockX, endBlockX] inclusive. */
export function getChunksInRange(
  startBlockX: number,
  endBlockX: number,
): number[] {
  const first = getChunkIndex(startBlockX);
  const last = getChunkIndex(endBlockX);
  const chunks: number[] = [];
  for (let c = first; c <= last; c++) {
    chunks.push(c);
  }
  return chunks;
}

/** Vertical chunk indices overlapping the block range [startBlockY, endBlockY] inclusive. */
export function getChunksInRangeY(
  startBlockY: number,
  endBlockY: number,
): number[] {
  const first = getChunkY(startBlockY);
  const last = getChunkY(endBlockY);
  const chunks: number[] = [];
  for (let c = first; c <= last; c++) {
    chunks.push(c);
  }
  return chunks;
}

/** A chunk address in the 2D chunk grid. */
export interface ChunkCoord {
  readonly chunkIndex: number;
  readonly chunkY: number;
}

/**
 * Chunk coordinates covering the rectangular block range
 * [startBlockX, endBlockX] x [startBlockY, endBlockY] inclusive. This is the
 * full 2D query the future chunk loader uses to decide which chunks to load or
 * unload around the player, and what the renderer would iterate if it needed
 * chunk objects instead of per-cell reads.
 */
export function getChunksInRect(
  startBlockX: number,
  endBlockX: number,
  startBlockY: number,
  endBlockY: number,
): ChunkCoord[] {
  const coords: ChunkCoord[] = [];
  for (const chunkIndex of getChunksInRange(startBlockX, endBlockX)) {
    for (const chunkY of getChunksInRangeY(startBlockY, endBlockY)) {
      coords.push({ chunkIndex, chunkY });
    }
  }
  return coords;
}

// --- Chunk data container ---

/**
 * A Chunk owns the raw block data for one rectangular region of the block
 * grid: CONFIG.chunk.size columns by CONFIG.chunk.depth rows, located at
 * (chunkIndex, chunkY). Blocks are stored as a flat Uint8Array:
 * data[row * size + col]. The buffer holds only numeric block ids; all
 * meaning lives in the block type registry.
 */
export class Chunk {
  readonly chunkIndex: number;
  readonly chunkY: number;
  readonly blocks: Uint8Array;

  /**
   * Whether any cell has been written after generation (placement or
   * destruction). The World sets this on every player-driven write. It is the
   * seam future save/load and chunk unloading build on: a pristine chunk is
   * fully described by (seed, chunkIndex, chunkY) and can be discarded and
   * regenerated for free; a modified chunk must be diffed or persisted first.
   */
  modified = false;

  constructor(chunkIndex: number, chunkY: number) {
    this.chunkIndex = chunkIndex;
    this.chunkY = chunkY;
    this.blocks = new Uint8Array(CONFIG.chunk.size * CONFIG.chunk.depth);
  }

  /** Reads a block id by local (col, row). Out of range cells read as Air. */
  getBlock(localX: number, localY: number): BlockId {
    if (
      localX < 0 ||
      localX >= CONFIG.chunk.size ||
      localY < 0 ||
      localY >= CONFIG.chunk.depth
    ) {
      return 0;
    }
    return this.blocks[localY * CONFIG.chunk.size + localX] as BlockId;
  }

  /** Writes a block id by local (col, row). False if out of range. */
  setBlock(localX: number, localY: number, id: BlockId): boolean {
    if (
      localX < 0 ||
      localX >= CONFIG.chunk.size ||
      localY < 0 ||
      localY >= CONFIG.chunk.depth
    ) {
      return false;
    }
    this.blocks[localY * CONFIG.chunk.size + localX] = id;
    return true;
  }
}
