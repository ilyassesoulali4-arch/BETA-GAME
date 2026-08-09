/**
 * Asset type definitions: the static contract of the asset pipeline.
 *
 * This layer only describes what assets ARE. It never loads images, never
 * stores per-world state, and has no knowledge of blocks or the game. Loading
 * and caching live in assetLoader.ts; the set of known assets lives in
 * assetRegistry.ts.
 */

/** The visual category an asset belongs to; drives which pipeline uses it. */
export type AssetType =
  | "block"
  | "character"
  | "environment"
  | "background"
  | "effect";

/**
 * Provenance metadata for an external asset. Every shipped asset must be
 * traceable: where it came from, who made it, and under which license it may
 * be used. No copyrighted game assets are permitted (Minecraft, Terraria,
 * Stardew Valley, etc.); anything without a verifiable source stays a
 * placeholder and the renderer falls back to flat colors.
 */
export interface AssetSource {
  readonly name: string;
  readonly author: string;
  readonly source: string;
  readonly license: string;
  /** Optional required attribution text to display when the asset is used. */
  readonly attribution?: string;
}

/** The declared definition of an asset, before it is loaded. */
export interface AssetDef {
  readonly id: string;
  readonly type: AssetType;
  /** URL of the image, served from /public by Vite (e.g. "/assets/blocks/grass.png"). */
  readonly src: string;
  readonly source?: AssetSource;
  /** Logical width/height in world pixels; falls back to natural size. */
  readonly width?: number;
  readonly height?: number;
  /** Reserved for future animated assets (sprite sheets). Not used yet. */
  readonly animated?: boolean;
}

/** An asset that has been fetched, decoded and cached. */
export interface LoadedAsset {
  readonly def: AssetDef;
  readonly image: HTMLImageElement;
  readonly width: number;
  readonly height: number;
}
