import { describe, expect, it } from "vitest";
import { ParallaxMountains } from "../src/parallaxMountains";
import { Camera } from "../src/camera";
import { CONFIG } from "../src/config";

function fakeContext() {
  const calls: { op: string; args: unknown[]; fillStyle?: unknown }[] = [];
  let fillStyle: unknown = "";
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: unknown) {
      fillStyle = v;
    },
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    translate: (...args: unknown[]) => calls.push({ op: "translate", args }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...args: unknown[]) => calls.push({ op: "moveTo", args }),
    lineTo: (...args: unknown[]) => calls.push({ op: "lineTo", args }),
    closePath: () => calls.push({ op: "closePath", args: [] }),
    createLinearGradient: () => ({
      addColorStop: () => undefined,
    }),
    fill: () => calls.push({ op: "fill", args: [], fillStyle }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("ParallaxMountains", () => {
  it("draws two ridge silhouettes with their colors", () => {
    const { ctx, calls } = fakeContext();
    const mountains = new ParallaxMountains();
    const camera = new Camera();

    mountains.render(ctx, camera);

    const farFill = calls.find(
      (c) => c.op === "fill" && c.fillStyle === CONFIG.parallax.mountains.farColor,
    );
    const nearFill = calls.find(
      (c) => c.op === "fill" && c.fillStyle === CONFIG.parallax.mountains.nearColor,
    );
    expect(farFill).toBeDefined();
    expect(nearFill).toBeDefined();

    // Silhouette paths: beginPath + moveTo + many lineTo + closePath.
    expect(calls.some((c) => c.op === "beginPath")).toBe(true);
    expect(calls.filter((c) => c.op === "lineTo").length).toBeGreaterThan(0);
  });

  it("translates the near ridge by -camera * factor and the far by half", () => {
    const { ctx, calls } = fakeContext();
    const mountains = new ParallaxMountains();
    const camera = new Camera();
    camera.x = 500;
    camera.y = 300;

    mountains.render(ctx, camera);

    const near = calls.find(
      (c) =>
        c.op === "translate" &&
        c.args[0] === -camera.x * CONFIG.parallax.mountains.factor &&
        c.args[1] === -camera.y * CONFIG.parallax.mountains.factor,
    );
    const far = calls.find(
      (c) =>
        c.op === "translate" &&
        c.args[0] === -camera.x * CONFIG.parallax.mountains.factor * 0.5,
    );
    expect(near).toBeDefined();
    expect(far).toBeDefined();
  });

  it("moves slower than the camera (parallax scroll check)", () => {
    const { ctx, calls } = fakeContext();
    const mountains = new ParallaxMountains();
    const camera = new Camera();

    mountains.render(ctx, camera);
    const nearAt0 = calls.find(
      (c) =>
        c.op === "translate" &&
        c.args[0] === -0 * CONFIG.parallax.mountains.factor,
    );
    expect(nearAt0).toBeDefined();

    // Move the camera far right; the near ridge must translate by only
    // factor * camera.x, not camera.x itself.
    calls.length = 0;
    camera.x = 1000;
    mountains.render(ctx, camera);
    const nearAt1000 = calls.find(
      (c) => c.op === "translate" && c.args[0] === -1000 * CONFIG.parallax.mountains.factor,
    );
    expect(nearAt1000).toBeDefined();
    // And there must be no translation equal to the full camera offset.
    expect(
      calls.some((c) => c.op === "translate" && c.args[0] === -camera.x),
    ).toBe(false);
  });

  it("cost is independent of chunk count (bounded path points)", () => {
    const { ctx, calls } = fakeContext();
    const mountains = new ParallaxMountains();
    const camera = new Camera();

    mountains.render(ctx, camera);

    // Two ridges; each draws a handful of path points plus closure, far below
    // anything chunk-count dependent (a 512-wide chunk would be hundreds of
    // blocks). This documents the O(viewport/step) bound.
    const lineTos = calls.filter((c) => c.op === "lineTo").length;
    expect(lineTos).toBeLessThan(200);
  });
});
