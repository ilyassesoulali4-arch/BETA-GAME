import { canvasViewport, CONFIG } from "./config";
import { getBlockType, BlockId } from "./blockTypes";
import { blockToWorldX, blockToWorldY, worldToBlockX, worldToBlockY } from "./chunk";
import type { BlockType } from "./blockTypes";
import type { LoadedAsset } from "./assets/assetTypes";
import type { AssetLoader } from "./assets/assetLoader";
import type { Camera } from "./camera";
import type { World } from "./world";

/** Deterministic per-block tone variation in [0, 1). */
function hash01(x: number, y: number): number {
  const n = x * 374761393 + y * 668265263;
  const s = Math.sin(n) * 1274123.5453;
  return s - Math.floor(s);
}

/**
 * The per-cell brightness variation is quantized into a tiny palette of
 * precomputed translucent overlay strings. The render loop then only assigns
 * a pre-parsed string (no per-cell rgba string allocation, no .toFixed, no
 * color parsing) on the hot path. Buckets near the neutral midpoint are
 * skipped entirely — their alpha is below the visible threshold anyway.
 */
const TONE_BUCKETS = 8;
const NEUTRAL_BUCKET_LO = Math.floor(TONE_BUCKETS / 2) - 1;
const NEUTRAL_BUCKET_HI = Math.floor(TONE_BUCKETS / 2);
const TONE_OVERLAYS: readonly string[] = (() => {
  const colors: string[] = [];
  for (let i = 0; i < TONE_BUCKETS; i++) {
    const lift = ((i + 0.5) / TONE_BUCKETS - 0.5) * 0.1;
    const alpha = Math.abs(lift * 0.5).toFixed(3);
    colors.push(
      lift >= 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`,
    );
  }
  return colors;
})();

/**
 * BlockRenderer draws the block grid into the camera view.
 *
 * Only the cells currently visible are drawn, gathered chunk by chunk so the
 * seam to the chunk cache stays explicit. It reads block ids from the World
 * every frame, so any placement/destruction shows up immediately.
 *
 * The painter renders each cell with soft, realistic shading:
 *
 *   - the base layer is the block's texture when an asset is loaded, else its
 *     flat color (a missing asset can never break the renderer);
 *   - a deterministic per-block tone overlay breaks up tile repetition, so two
 *     identical grass cells never look like a copy-pasted grid;
 *   - ambient occlusion darkens each cell toward its corners and bottom, and a
 *     subtle top light catches the upper edge, giving the blocks a soft,
 *     rounded, dimensional look instead of hard flat squares.
 *
 * All overlays are pure 2D fills, so the pass stays cheap (a handful of
 * fillRect per visible cell, independent of texture resolution).
 */
export class BlockRenderer {
  constructor(private readonly assets?: AssetLoader) {}

  /**
   * The loader's load revision, for consumers that cache asset-dependent
   * rendering. -1 when no loader is present, which keeps a cache key stable.
   */
  get assetVersion(): number {
    return this.assets?.version ?? -1;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, world: World): void {
    const startBlockX = worldToBlockX(camera.viewX);
    const endBlockX = worldToBlockX(camera.viewX + canvasViewport.width);
    const startBlockY = worldToBlockY(camera.viewY);
    const endBlockY = worldToBlockY(camera.viewY + canvasViewport.height);

    // Column-major walk so the cell above each cell is known from the previous
    // iteration: the grass-surface check needs no second world lookup per cell.
    for (let bx = startBlockX; bx <= endBlockX; bx++) {
      let cellAboveSolid = false;
      for (let by = startBlockY; by <= endBlockY; by++) {
        const id = world.getBlockAt(bx, by);
        const type = getBlockType(id);
        if (type.solid) {
          const asset = type.assetId ? this.assets?.get(type.assetId) : null;
          // A grass cell with air above it is the exposed surface: draw grass
          // blades along its top edge so the terrain reads as a grassy ground
          // rather than a flat textured layer.
          const exposedSurface =
            type.id === BlockId.Grass && !cellAboveSolid;
          this.drawBlock(ctx, bx, by, type, asset, exposedSurface);
        }
        cellAboveSolid = type.solid;
      }
    }
  }

  /** Draws one block cell with texture/color base plus soft shading. */
  private drawBlock(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    type: BlockType,
    asset: LoadedAsset | null | undefined,
    exposedSurface: boolean,
  ): void {
    const x = blockToWorldX(bx);
    const y = blockToWorldY(by);
    const size = CONFIG.block.size;

    // Base layer: texture when available, else the flat material color.
    if (asset) {
      ctx.drawImage(asset.image, x, y, size, size);
    } else {
      ctx.fillStyle = type.color;
      ctx.fillRect(x, y, size, size);
    }

    // Deterministic brightness variation per cell (breaks tile repetition),
    // served from the precomputed tone palette.
    const bucket = Math.floor(hash01(bx, by) * TONE_BUCKETS);
    if (bucket !== NEUTRAL_BUCKET_LO && bucket !== NEUTRAL_BUCKET_HI) {
      ctx.fillStyle = TONE_OVERLAYS[bucket];
      ctx.fillRect(x, y, size, size);
    }

    // Soft ambient occlusion: darken the corners and the bottom edge so cells
    // read as softly rounded blocks rather than hard squares. The gradient
    // band is kept narrow relative to the cell so seams between cells stay
    // smooth (blocks visually meld instead of showing a pixel grid).
    const ao = Math.round(size * 0.35);
    ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
    ctx.fillRect(x, y + size - ao, size, ao); // bottom shadow
    ctx.fillRect(x, y, ao, size); // left shadow
    ctx.fillRect(x + size - ao, y, ao, size); // right shadow

    // Top-light: a soft highlight band under the upper edge (sun from above).
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(x, y, size, Math.round(size * 0.22));

    // Grass blades along an exposed surface: short tapered strokes with a
    // deterministic pattern per cell, tinted to match the grass texture.
    if (exposedSurface) {
      const blade = (bx * 7 + by * 13) % 4; // 0..3 deterministic offset
      ctx.fillStyle = "rgba(70, 115, 55, 0.75)";
      for (let i = 0; i < 3; i++) {
        const bxw = x + 3 + ((blade + i * 5) % 7) * 3;
        const bh = 4 + ((blade + i * 3) % 3);
        ctx.fillRect(bxw, y - bh, 2, bh);
      }
    }
  }
}
