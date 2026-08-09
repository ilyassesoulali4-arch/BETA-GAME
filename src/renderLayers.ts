/**
 * Render layer order.
 *
 * Every visual element in the game belongs to exactly one layer, and layers
 * are painted bottom-to-top in this exact order. The current game only fills a
 * few of them; the others are documented slots that future graphics steps will
 * populate (parallax, clouds, objects, foreground effects, UI...).
 *
 * Adding a layer later means inserting it here and providing its painter;
 * nothing about the existing world/player painting changes.
 */
export const RENDER_LAYERS = [
  "sky", // full-screen background gradient
  "farBackground", // distant static backdrop
  "parallaxMountains", // distant terrain, camera-followed at a lower factor
  "clouds", // drifting sky objects
  "world", // the block grid (BlockRenderer)
  "objects", // world objects / decorations
  "player", // the player character
  "lighting", // screen-space lighting/shadow pass (future)
  "foregroundEffects", // foreground particles/overlay
  "ui", // HUD, crosshair, etc.
] as const;

export type RenderLayer = (typeof RENDER_LAYERS)[number];
