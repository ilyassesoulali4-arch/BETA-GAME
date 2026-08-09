import type { AssetDef, LoadedAsset } from "./assetTypes";
import { ASSET_REGISTRY } from "./assetRegistry";

/** A strategy for creating an HTMLImageElement; injectable for tests. */
export type ImageFactory = () => HTMLImageElement;

/**
 * AssetLoader fetches, decodes and caches assets for the whole session.
 *
 * Rules that keep the render loop cheap:
 *   - every asset id is fetched at most once; later requests reuse the cache
 *   - a failed load is cached as null (known-missing) so it is never retried
 *   - the render loop only ever calls the synchronous get(id)
 *   - no Image objects are created during rendering
 *
 * Missing assets are a supported state, not an error: get(id) returns null and
 * callers fall back to flat-color rendering.
 */
export class AssetLoader {
  private readonly defs = new Map<string, AssetDef>();
  private readonly loaded = new Map<string, LoadedAsset | null>();
  private readonly inflight = new Map<string, Promise<LoadedAsset | null>>();
  private readonly createImage: ImageFactory;

  /**
   * Monotonic revision of the loaded set, bumped whenever an asset finishes
   * loading (success or known-missing). Consumers that cache asset-dependent
   * rendering key their cache on this value so textures appearing mid-session
   * always trigger a repaint.
   */
  private revision = 0;

  constructor(defs: readonly AssetDef[], createImage?: ImageFactory) {
    for (const def of defs) {
      this.defs.set(def.id, def);
    }
    this.createImage = createImage ?? (() => new Image());
  }

  /** The loaded-set revision (see the private `revision` field). */
  get version(): number {
    return this.revision;
  }

  /** Whether an asset id is known to the registry. */
  has(id: string): boolean {
    return this.defs.has(id);
  }

  /** Synchronous cached access; null if not loaded or known-missing. */
  get(id: string): LoadedAsset | null {
    return this.loaded.get(id) ?? null;
  }

  /**
   * Asynchronously ensure an asset is loaded (fetch + decode), at most once
   * per id per session. Resolves with the asset, or null when the id is
   * unknown or the image failed to load. Callers must handle null (fallback).
   */
  load(id: string): Promise<LoadedAsset | null> {
    if (this.loaded.has(id)) {
      return Promise.resolve(this.loaded.get(id) ?? null);
    }
    const pending = this.inflight.get(id);
    if (pending) {
      return pending;
    }

    const def = this.defs.get(id);
    if (!def) {
      // Unknown id: remember as missing so we never retry.
      this.loaded.set(id, null);
      this.revision++;
      return Promise.resolve(null);
    }

    const promise = this.fetch(def).then(
      (asset) => {
        this.loaded.set(id, asset);
        this.inflight.delete(id);
        this.revision++;
        return asset;
      },
      () => {
        this.loaded.set(id, null);
        this.inflight.delete(id);
        this.revision++;
        return null;
      },
    );
    this.inflight.set(id, promise);
    return promise;
  }

  /** Concurrently ensure a set of ids is loaded. Resolves when all settle. */
  async loadAll(ids: readonly string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.load(id)));
  }

  /** A single fetch+decode. Resolves null on load/decoding failure. */
  private fetch(def: AssetDef): Promise<LoadedAsset | null> {
    return new Promise((resolve) => {
      const image = this.createImage();
      const finish = (): void => {
        const width = def.width ?? image.naturalWidth ?? image.width;
        const height = def.height ?? image.naturalHeight ?? image.height;
        resolve({ def, image, width, height });
      };
      image.onload = finish;
      image.onerror = (): void => resolve(null);
      image.src = def.src;
    });
  }
}

/** The singleton loader backed by the static registry. */
export const globalAssetLoader = new AssetLoader(ASSET_REGISTRY);
