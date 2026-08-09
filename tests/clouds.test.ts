import { describe, expect, it } from "vitest";
import { CloudLayer } from "../src/clouds";
import { Camera } from "../src/camera";
import { CONFIG } from "../src/config";

function fakeContext() {
  const calls: { op: string; args: unknown[] }[] = [];
  let globalAlphaValue = 1;
  const ctx = {
    get globalAlpha() {
      return globalAlphaValue;
    },
    set globalAlpha(v: number) {
      globalAlphaValue = v;
    },
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...args: unknown[]) => calls.push({ op: "moveTo", args }),
    arc: (...args: unknown[]) => calls.push({ op: "arc", args }),
    fill: () => calls.push({ op: "fill", args: [] }),
    closePath: () => calls.push({ op: "closePath", args: [] }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("CloudLayer", () => {
  it("draws the configured number of clouds as arcs", () => {
    const { ctx, calls } = fakeContext();
    const clouds = new CloudLayer(8);
    const camera = new Camera();

    clouds.render(ctx, camera, 0);

    // Each cloud is built from overlapping arcs and painted in three passes
    // (under-shadow, lit body, top highlight), so 8 clouds produce several
    // arcs and exactly 8 * 3 fills.
    const arcs = calls.filter((c) => c.op === "arc");
    expect(arcs.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.op === "fill").length).toBe(8 * 3);
  });

  it("drifts horizontally over time (parallax/drift)", () => {
    const { ctx, calls } = fakeContext();
    const clouds = new CloudLayer(1);
    const camera = new Camera();

    clouds.render(ctx, camera, 0);
    const firstX = calls.find((c) => c.op === "moveTo")!.args[0] as number;

    calls.length = 0;
    clouds.render(ctx, camera, 100);
    const secondX = calls.find((c) => c.op === "moveTo")!.args[0] as number;

    // Drift speed is small; after 100s the cloud must have moved by
    // speed * 100 px, so its on-screen x must differ.
    expect(secondX).not.toBe(firstX);
    expect(Math.abs(secondX - firstX)).toBeCloseTo(CONFIG.clouds.speed * 100 % 1000, 0);
  });

  it("cost is independent of chunk count (bounded arcs)", () => {
    const { ctx, calls } = fakeContext();
    const clouds = new CloudLayer(CONFIG.clouds.count);
    const camera = new Camera();

    clouds.render(ctx, camera, 0);

    // Each cloud traces its puffs once per paint pass (3 passes), so the arc
    // count stays a small constant multiple of the cloud count — far below
    // anything chunk-count dependent.
    const arcs = calls.filter((c) => c.op === "arc").length;
    expect(arcs).toBeLessThan(10 * 6 * 3);
  });
});
