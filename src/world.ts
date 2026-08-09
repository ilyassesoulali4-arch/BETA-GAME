import { CONFIG } from "./config";
import { BlockId } from "./blockTypes";
import { TerrainGenerator } from "./terrainGenerator";
import { ChunkGenerator } from "./chunkGenerator";
import { hashString } from "./random";
import {
  chunkKey,
  getChunkIndex,
  getChunkStartBlockX,
  getChunkStartRow,
  getChunkY,
  getChunksInRange,
  Chunk,
} from "./chunk";

/** A single cell that differs from the deterministically generated terrain. */
export interface CellDiff {
  readonly localX: number;
  readonly localY: number;
  readonly id: BlockId;
}

/** The cells a chunk needs to replay on top of regenerated terrain. */
export interface ChunkDiff {
  readonly chunkIndex: number;
  readonly chunkY: number;
  readonly cells: CellDiff[];
}

/**
 * World is the single owner of all persistent world state.
 *
 * The world is a block grid stored in a 2D chunk cache: chunks are keyed by
 * (horizontal chunk index, vertical chunkY) and created lazily on first
 * access, then generated deterministically from the seed. Because rows are
 * chunked vertically as well as columns horizontally, the world is infinite in
 * every direction — there is no fixed ceiling on how high blocks can be built.
 *
 * World is the future home of: chunk loading/unloading around the player,
 * world objects, player modifications (placement/destruction) and saved state.
 */
export class World {
  private readonly terrain: TerrainGenerator;
  private readonly generator: ChunkGenerator;
  readonly seed: string;
  private readonly chunks = new Map<string, Chunk>();

  /**
   * Monotonic revision of the world's block data, bumped on every successful
   * write (placement, destruction, save replay). The renderer keys its cached
   * block layer on this value so any edit instantly forces a repaint without
   * needing to diff the world every frame.
   */
  private revision = 0;

  /**
   * Hot cache of the most recently resolved chunk. Reads and writes are
   * spatially local (rendering walks cells, collision walks the player's few
   * cells), so the vast majority of calls hit the same chunk. This avoids a
   * string-key allocation plus a Map lookup on the per-cell hot path. The
   * cache is a pure performance shortcut: it never changes which chunk is
   * returned, only how fast it is found.
   */
  private cachedChunk: Chunk | null = null;
  private cachedChunkKey = "";

  constructor(seed: string) {
    this.seed = seed;
    const seedNumber = hashString(seed);
    this.terrain = new TerrainGenerator(seed);
    this.generator = new ChunkGenerator(this.terrain, seedNumber);
  }

  /**
   * The chunk covering a block cell, generated on first access. This remains
   * the authoritative, non-cached lookup used by external queries.
   */
  getChunk(chunkIndex: number, chunkY: number): Chunk {
    const key = chunkKey(chunkIndex, chunkY);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(chunkIndex, chunkY);
      this.generator.generate(chunk);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** Hot-cached chunk lookup used by per-cell reads and writes. */
  private resolveChunk(chunkIndex: number, chunkY: number): Chunk {
    const key = chunkKey(chunkIndex, chunkY);
    if (this.cachedChunk && this.cachedChunkKey === key) {
      return this.cachedChunk;
    }
    const chunk = this.getChunk(chunkIndex, chunkY);
    this.cachedChunk = chunk;
    this.cachedChunkKey = key;
    return chunk;
  }

  /** Block id at a block cell; the covering chunk is created on demand. */
  getBlockAt(blockX: number, blockY: number): BlockId {
    const chunkIndex = getChunkIndex(blockX);
    const chunkY = getChunkY(blockY);
    const chunk = this.resolveChunk(chunkIndex, chunkY);
    return chunk.getBlock(
      blockX - getChunkStartBlockX(chunkIndex),
      blockY - getChunkStartRow(chunkY),
    );
  }

  /**
   * Writes a block id at a block cell, at any height. This is the single entry
   * point placement and destruction use (destruction writes BlockId.Air).
   *
   * Every successful write marks the covering chunk modified, which is the
   * foundation for both future systems:
   *
   *   - save/load: only modified chunks need persisting (as a diff against the
   *     deterministically regenerated terrain);
   *   - chunk unloading: a modified chunk must be persisted before it can be
   *     discarded, while a pristine chunk can be dropped and regenerated.
   */
  setBlockAt(blockX: number, blockY: number, id: BlockId): void {
    const chunkIndex = getChunkIndex(blockX);
    const chunkY = getChunkY(blockY);
    const chunk = this.resolveChunk(chunkIndex, chunkY);
    const wrote = chunk.setBlock(
      blockX - getChunkStartBlockX(chunkIndex),
      blockY - getChunkStartRow(chunkY),
      id,
    );
    if (wrote) {
      chunk.modified = true;
      this.revision++;
    }
  }

  /** The world's block-data revision (see the private `revision` field). */
  get version(): number {
    return this.revision;
  }

  /** Chunks that differ from their generated terrain, in insertion order. */
  getModifiedChunks(): Chunk[] {
    const modified: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.modified) {
        modified.push(chunk);
      }
    }
    return modified;
  }

  /**
   * The world's persistent state, as a list of per-chunk diffs. For every
   * modified chunk the covering terrain is regenerated in memory and compared
   * cell by cell, so only the cells that actually differ are recorded. This is
   * what keeps a save small regardless of how much of the (infinite) world has
   * been explored or built.
   */
  getSaveData(): ChunkDiff[] {
    const diffs: ChunkDiff[] = [];
    for (const chunk of this.getModifiedChunks()) {
      const diff = this.diffChunk(chunk);
      // A chunk can be flagged modified yet match its generated terrain after
      // the player reverts an edit; such chunks need no save entry at all.
      if (diff.cells.length > 0) {
        diffs.push(diff);
      }
    }
    return diffs;
  }

  /**
   * Replays saved diffs onto the world. For each diff the covering chunk is
   * regenerated from the seed (deterministic), then its cells are overwritten.
   * Replaying is therefore safe in any order and on any previously generated or
   * regenerated chunk. This is the exact inverse of getSaveData.
   */
  applySaveData(diffs: ChunkDiff[]): void {
    for (const diff of diffs) {
      const chunk = this.getChunk(diff.chunkIndex, diff.chunkY);
      for (const cell of diff.cells) {
        chunk.setBlock(cell.localX, cell.localY, cell.id);
      }
      chunk.modified = true;
      this.revision++;
    }
  }

  /** Cells where a modified chunk differs from its freshly regenerated self. */
  private diffChunk(chunk: Chunk): ChunkDiff {
    const pristine = new Chunk(chunk.chunkIndex, chunk.chunkY);
    this.generator.generate(pristine);

    const cells: CellDiff[] = [];
    for (let localY = 0; localY < CONFIG.chunk.depth; localY++) {
      for (let localX = 0; localX < CONFIG.chunk.size; localX++) {
        const index = localY * CONFIG.chunk.size + localX;
        if (chunk.blocks[index] !== pristine.blocks[index]) {
          cells.push({ localX, localY, id: chunk.blocks[index] as BlockId });
        }
      }
    }
    return {
      chunkIndex: chunk.chunkIndex,
      chunkY: chunk.chunkY,
      cells,
    };
  }

  /**
   * Horizontal chunk indices overlapping the block range [startBlockX,
   * endBlockX] inclusive. Exactly the query the future chunk loader uses to
   * decide which chunks to load or unload around the player; the vertical axis
   * is covered by getChunksInRangeY / getChunksInRect in chunk.ts.
   */
  getChunksInRange(startBlockX: number, endBlockX: number): number[] {
    return getChunksInRange(startBlockX, endBlockX);
  }
}
