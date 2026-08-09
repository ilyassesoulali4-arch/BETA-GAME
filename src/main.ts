import { Seed } from "./seed";
import { Input } from "./input";
import { Pointer } from "./pointer";
import { World } from "./world";
import { Player } from "./player";
import { Camera } from "./camera";
import { BlockInteraction } from "./blockInteraction";
import { BlockRenderer } from "./blockRenderer";
import { Renderer } from "./render";
import { SaveSystem } from "./saveSystem";
import { Inventory } from "./inventory";
import { installErrorOverlay } from "./errorOverlay";
import { globalAssetLoader } from "./assets/assetLoader";

// Install first so any later startup/render error is visible on screen instead
// of leaving a silent black canvas.
installErrorOverlay();

try {
  // The save system restores the world from persistent state if present; only
  // otherwise does a fresh seed get created. The world is always rebuilt
  // deterministically from its seed, then the saved modifications are replayed.
  const saveSystem = new SaveSystem(window.localStorage);
  const saved = saveSystem.load();

  const seed = saved ? saved.seed : Seed.load().value;
  const seedDisplay = document.getElementById("seed-display");
  if (seedDisplay) {
    seedDisplay.textContent = `Seed: ${seed}`;
  }

  // Kick off asset loading once. Textures load in the background; the renderer
  // falls back to flat colors until they arrive, so the game runs immediately.
  const blockAssetIds = ["block.grass", "block.dirt", "block.stone"];
  void globalAssetLoader.loadAll(blockAssetIds);

  const input = new Input();
  const world = new World(seed);
  const player = new Player();
  const camera = new Camera();
  const renderer = new Renderer(new BlockRenderer(globalAssetLoader));
  const pointer = new Pointer(renderer.canvasElement);
  // A fresh game spawns with the starter stacks; a loaded game replaces them
  // with the saved inventory during restore.
  const inventory = saved ? new Inventory() : Inventory.starter();
  const blockInteraction = new BlockInteraction(inventory);

  if (saved) {
    saveSystem.restore(world, player, inventory, saved);
  }

  let previousTime = performance.now();

  function loop(currentTime: number): void {
    const deltaSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;

    const hotbarSlot = input.consumeHotbarSlot();
    if (hotbarSlot !== null) {
      inventory.selectSlot(hotbarSlot);
    }

    player.update(deltaSeconds, input, world);
    camera.follow(player, deltaSeconds);
    blockInteraction.update(pointer, camera, world, player);
    renderer.render(
      camera,
      player,
      world,
      blockInteraction.target,
      inventory,
      currentTime / 1000,
    );

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Persist on page leave so every played session is restored next launch.
  window.addEventListener("pagehide", () => {
    saveSystem.save(saveSystem.capture(world, player, inventory));
  });
} catch (error) {
  // Surface synchronous startup failures instead of leaving a black canvas.
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error("Startup failed:", error);
  let el = document.getElementById("error-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "error-overlay";
    el.style.position = "fixed";
    el.style.left = "8px";
    el.style.bottom = "40px";
    el.style.right = "8px";
    el.style.zIndex = "10000";
    el.style.background = "rgba(150, 0, 0, 0.92)";
    el.style.color = "#fff";
    el.style.fontFamily = "monospace";
    el.style.fontSize = "12px";
    el.style.padding = "8px 10px";
    el.style.whiteSpace = "pre-wrap";
    el.style.borderRadius = "4px";
    document.body.appendChild(el);
  }
  el.textContent = `Startup failed: ${message}`;
}

