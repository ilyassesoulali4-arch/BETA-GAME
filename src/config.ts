export const CONFIG = {
  canvas: {
    width: 960,
    height: 540,
  },

  terrain: {
    // The reference surface level and how far hills rise above it (world y).
    baseY: 430,
    amplitude: 180,
    // Layered noise: larger sizes shape the land, smaller ones add detail.
    octaves: [
      { size: 160, weight: 1.0 },
      { size: 80, weight: 0.5 },
      { size: 40, weight: 0.25 },
    ],
  },

  block: {
    // Pixel size of one block cell in the world grid.
    size: 24,
  },

  chunk: {
    // A chunk is a vertical strip of block columns; size = width in blocks,
    // depth = height in rows. Chunk data is a Uint8Array of size * depth ids.
    size: 512,
    depth: 256,
  },

  sky: {
    // Clean natural daytime sky: a vertical gradient. The stops are relative
    // offsets from the top of the viewport down to the horizon line.
    gradient: [
      { offset: 0, color: "#4a8fd6" }, // soft blue at zenith
      { offset: 0.55, color: "#8fc2ea" }, // lighter blue mid-sky
      { offset: 1, color: "#f0e3c4" }, // pale, slightly warm near horizon
    ],
  },

  parallax: {
    // How much farther (as a fraction of camera movement) the mountain layer
    // scrolls. 0.3 means the mountains move 30% as fast as the world.
    mountains: {
      factor: 0.3,
      // Colors for the two silhouette ridges (far is lighter, near is darker).
      farColor: "#8fa7c0",
      nearColor: "#6d829e",
      // Vertical reach (world px) of the silhouettes above their base line.
      farHeight: 240,
      nearHeight: 340,
    },
  },

  clouds: {
    // Drift speed of the cloud layer in px/second, screen space.
    speed: 8,
    // Clouds move with the camera at this fraction (slower than the world).
    parallaxFactor: 0.1,
    // How many clouds exist in the visible band (fixed, independent of chunks).
    count: 10,
    // The screen-space band where clouds live.
    baseY: 80,
    bandHeight: 180,
    // Cloud puff size range (pixels).
    minScale: 24,
    maxScale: 64,
    color: "#ffffff",
    opacity: 0.85,
  },

  inventory: {
    // Number of hotbar slots; the 1..N number keys select them.
    hotbarSlots: 9,
    // Max items one stack can hold.
    maxStack: 64,
    // Hotbar UI geometry, in screen pixels.
    slotSize: 52,
    slotGap: 4,
    bottomMargin: 12,
  },

  player: {
    width: 32,
    height: 48,
    color: "#e0b45c",
    moveSpeed: 220,
    jumpVelocity: 420,
    gravity: 1200,
    // Max obstacle height (in blocks) the player auto-jumps over while running.
    maxAutoJumpHeight: 2,
    spawn: { x: 0, y: 0 },
  },

  camera: {
    // How fast the camera eases toward its target (0..1 per frame-ish).
    followLerp: 6,
  },
} as const;

/**
 * The runtime on-screen canvas size. Unlike CONFIG.canvas (the default/logical
 * size), this is updated to fill the browser window so the game is fullscreen.
 * Everything that depends on the visible area (canvas element, renderer,
 * camera centering) reads from here.
 */
export const canvasViewport: { width: number; height: number } = {
  width: CONFIG.canvas.width,
  height: CONFIG.canvas.height,
};
