import { CONFIG } from "./config";
import { BlockId } from "./blockTypes";
import { hash3 } from "./random";
import { blockToWorldX, getChunkStartBlockX, getChunkStartRow } from "./chunk";
import type { Chunk } from "./chunk";
import type { TerrainGenerator } from "./terrainGenerator";

/**
 * ChunkGenerator fills a Chunk's block buffer deterministically from the world
 * seed. It is the bridge between the smooth height-map terrain and the block
 * grid:
 *
 *   - the surface height sampler decides which absolute row a column's surface
 *     is on
 *   - the row above the surface is Grass, a deterministic band below it is
 *     Dirt, and everything deeper is Stone; everything above the surface is
 *     Air.
 *
 * Because generation is a pure function of (seed, chunk index, chunkY), any
 * chunk can be (re)built at any time, at any height. Chunks entirely above the
 * surface come out as Air, chunks entirely below come out as Stone, and only
 * the chunks near the surface actually shape terrain. This is what makes the
 * world infinite in both directions and enables chunk loading/unloading and a
 * diff-based save system.
 */
export class ChunkGenerator {
  private readonly terrain: TerrainGenerator;
  private readonly seed: number;

  constructor(terrain: TerrainGenerator, seed: number) {
    this.terrain = terrain;
    this.seed = seed;
  }

  generate(chunk: Chunk): void {
    const startBlockX = getChunkStartBlockX(chunk.chunkIndex);
    // Absolute row of this chunk's first local row; lets every chunkY, whether
    // far above or far below the surface, be classified against the terrain.
    const startBlockY = getChunkStartRow(chunk.chunkY);

    for (let col = 0; col < CONFIG.chunk.size; col++) {
      const blockX = startBlockX + col;
      const surfaceRow = this.surfaceRowAt(blockX);
      const dirtDepth = this.dirtDepthAt(blockX);

      for (let localRow = 0; localRow < CONFIG.chunk.depth; localRow++) {
        const row = startBlockY + localRow;
        let id: BlockId = BlockId.Air;
        if (row === surfaceRow) {
          id = BlockId.Grass;
        } else if (row > surfaceRow && row <= surfaceRow + dirtDepth) {
          id = BlockId.Dirt;
        } else if (row > surfaceRow + dirtDepth) {
          id = BlockId.Stone;
        }
        chunk.setBlock(col, localRow, id);
      }
    }
  }

  /** Row of the surface block for a column, sampled at the column's center. */
  private surfaceRowAt(blockX: number): number {
    const centerX = blockToWorldX(blockX) + CONFIG.block.size / 2;
    return Math.floor(this.terrain.getHeightAt(centerX) / CONFIG.block.size);
  }

  /** Deterministic dirt band depth (rows) per column, 3 to 5. */
  private dirtDepthAt(blockX: number): number {
    return 3 + Math.floor(hash3(this.seed, 1000, blockX) * 3);
  }
}
