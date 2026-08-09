import { describe, expect, it, vi } from "vitest";
import { AssetLoader } from "../src/assets/assetLoader";
import type { AssetDef } from "../src/assets/assetTypes";

const GRASS: AssetDef = {
  id: "block.grass",
  type: "block",
  src: "/assets/blocks/grass.png",
};

/**
 * A controllable fake image. The loader treats the image as opaque; we drive
 * onload/onerror manually to simulate the browser decoding pipeline without a
 * real DOM.
 */
function fakeImage() {
  const listeners: Record<string, (() => void) | null> = {
    load: null,
    error: null,
  };
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
    fireLoad() {
      listeners.load?.();
    },
    fireError() {
      listeners.error?.();
    },
    src: "",
  };
  return image as unknown as HTMLImageElement & {
    fireLoad: () => void;
    fireError: () => void;
  };
}

describe("AssetLoader", () => {
  it("loads an asset and caches it", async () => {
    const img = fakeImage();
    const loader = new AssetLoader([GRASS], () => img);
    expect(loader.has("block.grass")).toBe(true);
    expect(loader.get("block.grass")).toBeNull();

    const promise = loader.load("block.grass");
    img.fireLoad();
    const asset = await promise;

    expect(asset).not.toBeNull();
    expect(asset!.image).toBe(img);
    expect(asset!.def.id).toBe("block.grass");
    expect(loader.get("block.grass")).toBe(asset);
  });

  it("does not create a second Image for a repeated load", async () => {
    const create = vi.fn(fakeImage);
    const loader = new AssetLoader([GRASS], create);

    const p1 = loader.load("block.grass");
    const p2 = loader.load("block.grass");
    create.mock.results[0].value.fireLoad();
    await Promise.all([p1, p2]);

    // Two concurrent loads must share one fetch / one decoded image.
    expect(create).toHaveBeenCalledTimes(1);
    expect(await p1).toBe(await p2);
  });

  it("caches null for a failed load and does not retry", async () => {
    const img = fakeImage();
    const loader = new AssetLoader([GRASS], () => img);

    const promise = loader.load("block.grass");
    img.fireError();
    expect(await promise).toBeNull();
    expect(loader.get("block.grass")).toBeNull();

    // A second load resolves immediately from the cached null.
    const again = loader.load("block.grass");
    expect(await again).toBeNull();
  });

  it("returns null for an unknown asset id", async () => {
    const loader = new AssetLoader([], () => fakeImage());
    expect(await loader.load("block.nope")).toBeNull();
    expect(loader.get("block.nope")).toBeNull();
    expect(loader.has("block.nope")).toBe(false);
  });

  it("loadAll resolves after every id settles", async () => {
    const img = fakeImage();
    const loader = new AssetLoader([GRASS], () => img);
    const all = loader.loadAll(["block.grass", "block.missing"]);
    img.fireLoad();
    await all;
    expect(loader.get("block.grass")).not.toBeNull();
  });
});
