/**
 * Seeded randomness utilities.
 *
 * Every function here is deterministic: the same input always produces the
 * same output, regardless of machine or time. This is what lets the same
 * world seed always rebuild the same world.
 */

/**
 * FNV-1a hash of a string, returned as an unsigned 32-bit integer.
 * Used to turn a world seed string into a numeric value the generator uses.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A deterministic integer hash mixing three integers into a float in [0, 1).
 * Used to sample noise at lattice points: the same (seed, a, b) always gives
 * the same value.
 */
export function hash3(seed: number, a: number, b: number): number {
  let h = seed ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
