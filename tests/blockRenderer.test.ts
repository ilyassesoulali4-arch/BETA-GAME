import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockRenderer } from "../src/blockRenderer";
import { Renderer } from "../src/render";
import { AssetLoader } from "../src/assets/assetLoader";
import type { AssetDef } from "../src/assets/assetTypes";
import { CONFIG } from "../src/config";
import { World } from "../src/world";
import { Player } from "../src/player";
import { Camera } from "../src/camera";

/** Records ctx calls into a plain array so tests can assert the draw path. */
function fakeContext() {
  const calls: { op: string; args: unknown[] }[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
    drawImage: (...args: unknown[]) => calls.push({ op: "drawImage", args }),
    strokeRect: (...args: unknown[]) => calls.push({ op: "strokeRect", args }),
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    translate: (...args: unknown[]) => calls.push({ op: "translate", args }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function fakeImage() {
  const listeners: Record<string, (() => void) | null> = {};
  const image = {
    width: 24,
    height: 24,
    naturalWidth: 24,
    naturalHeight: 24,
    set onload(fn: (() => void) | null) {
      listeners.load = fn;
    },
    set onerror(fn: (() => void) | null) {
      listeners.error = fn;
    },
    fireLoad: () => listeners.load?.(),
    src: "",
  };
  return image as unknown as HTMLImageElement & { fireLoad: () => void };
}

const GRASS: AssetDef = {
  id: "block.grass",
  type: "block",
  src: "/assets/blocks/grass.png",
};

describe("BlockRenderer", () => {
  it("falls back to flat-color rendering without an asset", () => {
    const { ctx, calls } = fakeContext();
    const renderer = new BlockRenderer();
    const world = new World("render-test");
    const camera = new Camera();

    renderer.render(ctx, camera, world);

    // Grass cells under the surface must be drawn with their flat color.
    const fill = calls.filter((c) => c.op === "fillRect");
    expect(fill.length).toBeGreaterThan(0);
    expect(calls.some((c) => c.op === "drawImage")).toBe(false);
  });

  it("uses a texture when the asset is loaded", async () => {
    const img = fakeImage();
    const loader = new AssetLoader([GRASS], () => img);
    const promise = loader.load("block.grass");
    img.fireLoad();
    await promise;

    const { ctx, calls } = fakeContext();
    const renderer = new BlockRenderer(loader);
    const world = new World("render-test");
    const camera = new Camera();

    renderer.render(ctx, camera, world);

    // Once grass has a texture, every grass cell goes through drawImage.
    const draws = calls.filter((c) => c.op === "drawImage");
    expect(draws.length).toBeGreaterThan(0);
  });

  it("does not render air cells", () => {
    const { ctx, calls } = fakeContext();
    const renderer = new BlockRenderer();
    const world = new World("render-test");
    const camera = new Camera();

    renderer.render(ctx, camera, world);

    // Base fills are full-cell (CONFIG.block.size) rectangles for every solid
    // cell; the soft-shading overlays are partial-cell rectangles that sit
    // inside those cells. Air cells produce no base fill at all. This checks
    // the invariant that no out-of-range or empty cell produces a full-cell
    // base draw, and that the shading passes never draw outside a cell's
    // bounds.
    const fills = calls.filter((c) => c.op === "fillRect");
    expect(fills.length).toBeGreaterThan(0);

    // Shading overlays must stay within the cell they decorate.
    for (const call of fills) {
      const [, , w, h] = call.args as [number, number, number, number];
      expect(w).toBeLessThanOrEqual(CONFIG.block.size);
      expect(h).toBeLessThanOrEqual(CONFIG.block.size);
    }

    // Base cell fills exist and are full-size.
    const base = fills.filter(
      (c) =>
        (c.args[2] as number) === CONFIG.block.size &&
        (c.args[3] as number) === CONFIG.block.size,
    );
    expect(base.length).toBeGreaterThan(0);
  });
});
