import { describe, expect, it } from "vitest";
import { ASSET_REGISTRY, getAssetDef } from "../src/assets/assetRegistry";

describe("asset registration", () => {
  it("registers the block assets", () => {
    const ids = ASSET_REGISTRY.map((d) => d.id);
    expect(ids).toContain("block.grass");
    expect(ids).toContain("block.dirt");
    expect(ids).toContain("block.stone");
  });

  it("declares type, src and provenance for every asset", () => {
    for (const def of ASSET_REGISTRY) {
      expect(def.type).toBeTruthy();
      expect(def.src).toMatch(/^\/assets\//);
      expect(def.source?.author).toBeTruthy();
      expect(def.source?.license).toBeTruthy();
      expect(def.source?.source).toBeTruthy();
    }
  });

  it("has no duplicate ids", () => {
    const ids = ASSET_REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("asset lookup", () => {
  it("finds a known id", () => {
    const def = getAssetDef("block.grass");
    expect(def).toBeDefined();
    expect(def?.src).toBe("/assets/blocks/grass.png");
  });

  it("returns undefined for an unknown id", () => {
    expect(getAssetDef("block.does-not-exist")).toBeUndefined();
  });
});
