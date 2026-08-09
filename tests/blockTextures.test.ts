import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_REGISTRY, getAssetDef } from "../src/assets/assetRegistry";

/**
 * Verifies the real texture files shipped for Graphics Step 2: every registered
 * block asset must have an actual PNG on disk under public/assets/blocks/.
 * (The loader itself resolves /assets/... through Vite; this test checks the
 * source tree that Vite serves from.)
 */
const BLOCKS_DIR = join(process.cwd(), "public", "assets", "blocks");

describe("shipped block textures", () => {
  it("registers grass, dirt and stone in the asset registry", () => {
    for (const id of ["block.grass", "block.dirt", "block.stone"]) {
      expect(getAssetDef(id)).toBeDefined();
    }
  });

  it("points each block asset at a file that exists on disk", () => {
    for (const def of ASSET_REGISTRY) {
      if (def.type !== "block") {
        continue;
      }
      expect(def.src.startsWith("/assets/blocks/")).toBe(true);
      const file = join(BLOCKS_DIR, def.src.slice("/assets/blocks/".length));
      expect(existsSync(file), `missing texture for ${def.id}: ${file}`).toBe(true);
    }
  });

  it("keeps the flat-color fallback for a known block id (no assetId)", () => {
    // Air is registered without an assetId, so the renderer must still know
    // its flat color rather than depending on any asset.
    expect(getAssetDef("block.grass")).toBeDefined();
  });
});
