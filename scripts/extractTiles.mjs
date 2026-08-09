import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function decodePng(filePath) {
  const b = readFileSync(filePath);
  const sig = b.toString("hex", 0, 8);
  if (sig !== "89504e470d0a1a0a") throw new Error("Not a PNG: " + filePath);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  const bitDepth = b.readUInt8(24);
  const colorType = b.readUInt8(25);
  if (bitDepth !== 8) throw new Error("Only 8-bit supported");
  let bpp;
  if (colorType === 6) bpp = 4;
  else if (colorType === 2) bpp = 3;
  else if (colorType === 3) bpp = 1;
  else throw new Error("colorType " + colorType + " unsupported");

  let p = 8;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("ascii", p + 4, p + 8);
    if (type === "IDAT") idat.push(b.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);

  const paeth = (a, bb, c) => {
    const pa = Math.abs(bb - c);
    const pb = Math.abs(a - c);
    const pc = Math.abs(a + bb - 2 * c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return bb;
    return c;
  };

  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      let v = row[x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + prev[x]) & 255;
      else if (f === 3) v = (v + Math.floor((a + prev[x]) / 2)) & 255;
      else if (f === 4) v = (v + paeth(a, prev[x], c)) & 255;
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

let crcTable = null;
function crc32(buf) {
  let c;
  let table = crcTable;
  if (!table) {
    crcTable = table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const rawOut = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    rawOut[y * (stride + 1)] = 0;
    rgba.copy(rawOut, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(rawOut, { level: 9 });
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const src = join(root, "assests", "brackeys_platformer_assets", "sprites", "world_tileset.png");
const { w, h, bpp, data } = decodePng(src);
const TILE = 16;
const cols = w / TILE;
const rows = h / TILE;

const picks = {
  grass: { row: 4, col: 0 },
  dirt: { row: 0, col: 2 },
  stone: { row: 15, col: 3 },
};

const rgba = Buffer.alloc(TILE * TILE * 4);
for (const [name, { row, col }] of Object.entries(picks)) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const sx = col * TILE + x;
      const sy = row * TILE + y;
      const si = (sy * w + sx) * bpp;
      const di = (y * TILE + x) * 4;
      if (bpp === 4) {
        rgba[di] = data[si];
        rgba[di + 1] = data[si + 1];
        rgba[di + 2] = data[si + 2];
        rgba[di + 3] = data[si + 3];
      } else if (bpp === 3) {
        rgba[di] = data[si];
        rgba[di + 1] = data[si + 1];
        rgba[di + 2] = data[si + 2];
        rgba[di + 3] = 255;
      }
    }
  }
  const outPath = join(root, "public", "assets", "blocks", name + ".png");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, encodePng(TILE, TILE, rgba));
  console.log(name, "->", outPath, "(cols:" + cols + ",rows:" + rows + ")");
}
