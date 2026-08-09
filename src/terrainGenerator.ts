import { CONFIG } from "./config";
import { hash3, hashString } from "./random";

/**
 * TerrainGenerator deterministically computes the ground surface height for
 * any world x coordinate from a single world seed.
 *
 * It builds layered value noise: several octaves of smoothly interpolated
 * random values are summed together. Because every hash lookup is pure, the
 * same seed always produces exactly the same terrain, and a different seed
 * produces completely different terrain.
 *
 * The height of any column can be computed on demand and in any order, which
 * is exactly what future chunk loading needs (chunks are loaded lazily and
 * may be revisited after being unloaded).
 */
export class TerrainGenerator {
  private readonly seed: number;

  constructor(worldSeed: string) {
    this.seed = hashString(worldSeed);
  }

  /** The world y coordinate of the ground surface above the column at x. */
  getHeightAt(x: number): number {
    let sum = 0;
    let weight = 0;

    const { octaves, baseY, amplitude } = CONFIG.terrain;
    for (let o = 0; o < octaves.length; o++) {
      sum += this.sampleOctave(o, x) * octaves[o].weight;
      weight += octaves[o].weight;
    }

    const normalized = sum / weight; // 0..1
    return baseY - normalized * amplitude;
  }

  /** Smooth value noise for one octave, normalized to [0, 1). */
  private sampleOctave(octave: number, x: number): number {
    const size = CONFIG.terrain.octaves[octave].size;

    const latticeX = Math.floor(x / size);
    const fraction = x / size - latticeX;
    const smooth = fraction * fraction * (3 - 2 * fraction);

    const left = hash3(this.seed, octave, latticeX);
    const right = hash3(this.seed, octave, latticeX + 1);

    return left + (right - left) * smooth;
  }
}
