import type { AssetDef } from "./assetTypes";

/**
 * The registry of every asset the game knows about, declared statically.
 *
 * This is a small, explicit, versioned list — not hundreds of entries. A block
 * type maps to an asset by id through blockTypes.ts (BlockType.assetId). The
 * files themselves are placeholders today; when a file is missing the loader
 * fails gracefully and the renderer falls back to flat colors.
 *
 * Source/license fields are intentionally required for non-placeholder assets:
 * anything shipped must be traceable to an author and license.
 */
export const ASSET_REGISTRY: readonly AssetDef[] = [
  {
    id: "block.grass",
    type: "block",
    src: "/assets/blocks/grass.png",
    width: 96,
    height: 96,
    source: {
      name: "Grass001 (seamless, photoscanned)",
      author: "Lennart Demes (ambientCG)",
      source: "https://ambientcg.com/view?id=Grass001 (CC0, downscaled to 96px)",
      license: "CC0",
      attribution: "Grass001 by ambientCG — CC0",
    },
  },
  {
    id: "block.dirt",
    type: "block",
    src: "/assets/blocks/dirt.png",
    width: 96,
    height: 96,
    source: {
      name: "Ground048 (seamless, photoscanned)",
      author: "Lennart Demes (ambientCG)",
      source: "https://ambientcg.com/view?id=Ground048 (CC0, downscaled to 96px)",
      license: "CC0",
      attribution: "Ground048 by ambientCG — CC0",
    },
  },
  {
    id: "block.stone",
    type: "block",
    src: "/assets/blocks/stone.png",
    width: 96,
    height: 96,
    source: {
      name: "Rock028 (seamless, photoscanned)",
      author: "Lennart Demes (ambientCG)",
      source: "https://ambientcg.com/view?id=Rock028 (CC0, downscaled to 96px)",
      license: "CC0",
      attribution: "Rock028 by ambientCG — CC0",
    },
  },
];

/** Lookup a registered asset definition by id, or undefined if unknown. */
export function getAssetDef(assetId: string): AssetDef | undefined {
  return ASSET_REGISTRY.find((def) => def.id === assetId);
}
