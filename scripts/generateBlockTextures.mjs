/**
 * Procedural block texture generator (Graphics Step 2).
 *
 * Generates original, project-owned placeholder textures for the three
 * terrain blocks — grass, dirt, stone — directly as PNG files. Nothing here is
 * copied from any game; each texture is built from layered value noise tuned
 * per material, so it is reproducible from its seed.
 *
 * Pure Node: uses only built-in modules (zlib for PNG compression, fs for
 * output). Run with: node scripts/generateBlockTextures.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 96; // texture resolution; downscaled to CONFIG.block.size at draw
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "blocks");

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Value noise
// ---------------------------------------------------------------------------
function makeValueNoise(random) {
  const gridSize = 8;
  const cells = new Float64Array(gridSize * gridSize);
  for (let i = 0; i < cells.length; i++) cells[i] = random();
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = ((x % gridSize) + gridSize) % gridSize;
    const gy = ((y % gridSize) + gridSize) % gridSize;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = fade(gx - ix);
    const fy = fade(gy - iy);
    const a = cells[((iy % gridSize) * gridSize) + (ix % gridSize)];
    const b = cells[((iy % gridSize) * gridSize) + ((ix + 1) % gridSize)];
    const c = cells[(((iy + 1) % gridSize) * gridSize) + (ix % gridSize)];
    const d = cells[(((iy + 1) % gridSize) * gridSize) + ((ix + 1) % gridSize)];
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  };
}

// ---------------------------------------------------------------------------
// Material palettes (base color + subtle variation + fine speckle)
// ---------------------------------------------------------------------------
const MATERIALS = {
  grass: {
    base: [0x4a, 0x7c, 0x3f],
    variation: [-28, -10, 8],
    speckle: [-20, 14],
    scale: 0.9,
  },
  dirt: {
    base: [0x7a, 0x52, 0x30],
    variation: [-18, -6, 10],
    speckle: [-16, 14],
    scale: 1.4,
  },
  stone: {
    base: [0x8d, 0x8d, 0x8d],
    variation: [-22, 16, 16],
    speckle: [-14, 14],
    scale: 1.8,
  },
};

// ---------------------------------------------------------------------------
// PNG writer (minimal, filter 0 rows, RGB 8-bit)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter none
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Per-block rendering
// ---------------------------------------------------------------------------
function renderBlock(name, seed) {
  const material = MATERIALS[name];
  const random = mulberry32(seed);
  const noise = makeValueNoise(random);
  const detail = makeValueNoise(random);

  const rgb = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = noise(x * material.scale, y * material.scale) * 2 - 1;
      const s = detail(x * 6, y * 6) * 2 - 1;

      const r = material.base[0] + n * material.variation[0] + s * material.speckle[0];
      const g = material.base[1] + n * material.variation[1] + s * material.speckle[1];
      const b = material.base[2] + n * material.variation[2] + s * material.speckle[0];

      const idx = (y * SIZE + x) * 3;
      rgb[idx] = Math.max(0, Math.min(255, Math.round(r)));
      rgb[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgb[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
  return encodePng(SIZE, SIZE, rgb);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
const SPECS = [
  { name: "grass", seed: 2024_08_01 },
  { name: "dirt", seed: 2024_08_02 },
  { name: "stone", seed: 2024_08_03 },
];

for (const { name, seed } of SPECS) {
  const file = join(OUT_DIR, `${name}.png`);
  writeFileSync(file, renderBlock(name, seed));
  console.log(`wrote ${file} (${SIZE}x${SIZE}, ${"procedural"})`);
}
