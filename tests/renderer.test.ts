import { describe, expect, it, vi } from "vitest";
import { Renderer } from "../src/render";
import { BlockRenderer } from "../src/blockRenderer";
import { World } from "../src/world";
import { Player } from "../src/player";
import { Camera } from "../src/camera";
import { Inventory } from "../src/inventory";
import { CONFIG } from "../src/config";

interface RecordedCall {
  op: string;
  args: unknown[];
  fillStyle?: string;
}

/**
 * Renderer tests run in Node without a DOM. We install a minimal fake canvas
 * whose 2D context records every call and the active fillStyle, plus a stub
 * document/window that Renderer uses at construction.
 */
function installDom() {
  const calls: RecordedCall[] = [];
  let fillStyle = "";
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    createLinearGradient: () => ({
      addColorStop: () => undefined,
    }),
    createRadialGradient: () => ({
      addColorStop: () => undefined,
    }),
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args, fillStyle }),
    strokeRect: (...args: unknown[]) => calls.push({ op: "strokeRect", args }),
    fillText: (...args: unknown[]) => calls.push({ op: "fillText", args, fillStyle }),
    drawImage: (...args: unknown[]) => calls.push({ op: "drawImage", args }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...args: unknown[]) => calls.push({ op: "moveTo", args }),
    lineTo: (...args: unknown[]) => calls.push({ op: "lineTo", args }),
    arc: (...args: unknown[]) => calls.push({ op: "arc", args }),
    ellipse: (...args: unknown[]) => calls.push({ op: "ellipse", args }),
    closePath: () => calls.push({ op: "closePath", args: [] }),
    fill: () => calls.push({ op: "fill", args: [], fillStyle }),
    globalAlpha: 1,
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    translate: (...args: unknown[]) => calls.push({ op: "translate", args }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx as unknown as CanvasRenderingContext2D,
  };
  const document = {
    createElement: () => canvas,
    body: { appendChild: () => undefined },
  };
  const window = {
    innerWidth: 960,
    innerHeight: 540,
    addEventListener: () => undefined,
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  return { canvas, ctx, calls };
}

describe("Renderer (layer pipeline)", () => {
  it("draws the player as a rectangle at its position with its color", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    player.position.x = 100;
    player.position.y = 200;
    const camera = new Camera();

    renderer.render(camera, player, world, null, new Inventory());

    const playerRect = calls.find(
      (c) =>
        c.op === "fillRect" &&
        c.args[0] === 100 &&
        c.args[1] === 200 &&
        c.args[2] === CONFIG.player.width &&
        c.args[3] === CONFIG.player.height,
    );
    expect(playerRect).toBeDefined();
    expect(playerRect!.fillStyle).toBe(CONFIG.player.color);
  });

  it("renders the sky as a gradient fill before anything else", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    const camera = new Camera();

    renderer.render(camera, player, world, null, new Inventory());

    // The very first fillRect is the full-screen sky gradient. It is the only
    // fill whose style is a gradient object (createLinearGradient result), not
    // a flat CSS color string.
    const skyFill = calls.find(
      (c) => c.op === "fillRect" && typeof c.fillStyle !== "string",
    );
    expect(skyFill).toBeDefined();
    expect(calls.indexOf(skyFill!)).toBeLessThan(calls.length);
    const first = calls[0];
    expect(first!.op).toBe("fillRect");
    expect(first!.args[0]).toBe(0);
    expect(first!.args[1]).toBe(0);
  });

  it("draws mountain silhouettes behind the world and player", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    const camera = new Camera();

    renderer.render(camera, player, world, null, new Inventory());

    // Mountains produce path drawing ops with their fill color.
    const mountainFills = calls.filter(
      (c) => c.op === "fill" && c.fillStyle === CONFIG.parallax.mountains.farColor,
    );
    expect(mountainFills.length).toBeGreaterThan(0);

    // Every mountain fill happens before the player rectangle (behind world).
    const playerIdx = calls.findIndex(
      (c) =>
        c.op === "fillRect" &&
        c.fillStyle === CONFIG.player.color &&
        c.args[0] === CONFIG.player.spawn.x &&
        c.args[1] === CONFIG.player.spawn.y,
    );
    expect(playerIdx).toBeGreaterThan(-1);
    // The last mountain fill (base ridge colour) must come before the player
    // rectangle. Only fills using the ridge colours count; the player's own
    // head/eye/shadow fills are not mountains.
    const ridgeColors = new Set([
      CONFIG.parallax.mountains.farColor,
      CONFIG.parallax.mountains.nearColor,
    ]);
    const lastMountainIdx = calls.reduce(
      (last, c, i) => (c.op === "fill" && ridgeColors.has(c.fillStyle as string) ? i : last),
      -1,
    );
    expect(lastMountainIdx).toBeGreaterThan(-1);
    expect(lastMountainIdx).toBeLessThan(playerIdx);
  });

  it("applies the parallax factor to the mountain translation", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    const camera = new Camera();
    camera.x = 200;
    camera.y = 100;

    renderer.render(camera, player, world, null, new Inventory());

    // The near ridge translates by -camera * factor (0.3 here).
    const nearRidgeTranslate = calls.find(
      (c) =>
        c.op === "translate" &&
        c.args[0] === -camera.x * CONFIG.parallax.mountains.factor &&
        c.args[1] === -camera.y * CONFIG.parallax.mountains.factor,
    );
    expect(nearRidgeTranslate).toBeDefined();

    // The far ridge uses half the layer factor.
    const farRidgeTranslate = calls.find(
      (c) =>
        c.op === "translate" &&
        c.args[0] === -camera.x * CONFIG.parallax.mountains.factor * 0.5,
    );
    expect(farRidgeTranslate).toBeDefined();
  });

  it("draws cloud arcs after the mountains and before the player", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    const camera = new Camera();

    renderer.render(camera, player, world, null, new Inventory());

    const firstMountainFill = calls.findIndex(
      (c) => c.op === "fill" && c.fillStyle === CONFIG.parallax.mountains.farColor,
    );
    const firstCloudArc = calls.findIndex((c) => c.op === "arc");
    const playerIdx = calls.findIndex(
      (c) =>
        c.op === "fillRect" &&
        c.fillStyle === CONFIG.player.color &&
        c.args[0] === CONFIG.player.spawn.x &&
        c.args[1] === CONFIG.player.spawn.y,
    );

    expect(firstMountainFill).toBeGreaterThan(-1);
    expect(firstCloudArc).toBeGreaterThan(firstMountainFill);
    expect(firstCloudArc).toBeLessThan(playerIdx);
  });

  it("draws the target outline when a block is targeted", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    const camera = new Camera();

    renderer.render(camera, player, world, { x: 2, y: 3 }, new Inventory());

    const stroke = calls.find((c) => c.op === "strokeRect");
    expect(stroke).toBeDefined();
  });

  it("reuses the cached block layer when nothing changed, repainting only on camera move", () => {
    const { calls } = installDom();
    const renderer = new Renderer(new BlockRenderer());
    const world = new World("renderer-test");
    const player = new Player();
    const camera = new Camera();

    // Block-grid work is a full-cell fill (block size x block size): base
    // colour plus the tone overlay. Player and hotbar fills are other sizes,
    // so this count isolates the block layer's cost.
    const countBlockFills = () =>
      calls.filter(
        (c) =>
          c.op === "fillRect" &&
          c.args[2] === CONFIG.block.size &&
          c.args[3] === CONFIG.block.size,
      ).length;

    renderer.render(camera, player, world, null, new Inventory());
    const first = countBlockFills();
    expect(first).toBeGreaterThan(0);

    // Identical camera and world: the cached layer is reused, so no block-grid
    // cells are repainted on the second frame.
    renderer.render(camera, player, world, null, new Inventory());
    expect(countBlockFills()).toBe(first);

    // Moving the camera invalidates the cache and repaints the block grid.
    camera.x = CONFIG.block.size;
    renderer.render(camera, player, world, null, new Inventory());
    expect(countBlockFills()).toBeGreaterThan(first);
  });
});
