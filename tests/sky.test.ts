import { describe, expect, it } from "vitest";
import { SkyRenderer } from "../src/sky";
import { CONFIG } from "../src/config";

interface FakeGradient {
  stops: { offset: number; color: string }[];
}

function fakeContext() {
  let fillStyleValue: unknown = "";
  const calls: { op: string; args: unknown[] }[] = [];
  const gradients: FakeGradient[] = [];
  let gradient: FakeGradient | null = null;

  const ctx = {
    get fillStyle() {
      return fillStyleValue;
    },
    set fillStyle(v: unknown) {
      fillStyleValue = v;
    },
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      calls.push({ op: "createLinearGradient", args: [x0, y0, x1, y1] });
      gradient = { stops: [] };
      gradients.push(gradient);
      return {
        addColorStop: (offset: number, color: string) => {
          gradient!.stops.push({ offset, color });
        },
      };
    },
    createRadialGradient: (...args: unknown[]) => {
      calls.push({ op: "createRadialGradient", args });
      gradient = { stops: [] };
      gradients.push(gradient);
      return {
        addColorStop: (offset: number, color: string) => {
          gradient!.stops.push({ offset, color });
        },
      };
    },
    fillRect: (...args: unknown[]) => calls.push({ op: "fillRect", args }),
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    calls,
    getGradient: () => gradients[0] ?? null,
    getAllGradients: () => gradients,
  };
}

describe("SkyRenderer", () => {
  it("renders a vertical gradient covering the full viewport", () => {
    const { ctx, calls, getGradient } = fakeContext();
    const sky = new SkyRenderer();

    sky.render(ctx);

    const grad = calls.find((c) => c.op === "createLinearGradient");
    expect(grad).toBeDefined();
    // Vertical gradient: (0,0) -> (0,height).
    expect(grad!.args[0]).toBe(0);
    expect(grad!.args[1]).toBe(0);
    expect(grad!.args[2]).toBe(0);
    expect(grad!.args[3]).toBeGreaterThan(0);

    const fill = calls.find((c) => c.op === "fillRect");
    expect(fill).toBeDefined();
    expect(fill!.args[0]).toBe(0);
    expect(fill!.args[1]).toBe(0);
    expect(fill!.args[2]).toBeGreaterThan(0);
    expect(fill!.args[3]).toBeGreaterThan(0);

    // Uses CONFIG.sky.gradient stops.
    expect(getGradient()!.stops).toEqual(CONFIG.sky.gradient);
  });

  it("uses three gradient stops (top, mid, horizon)", () => {
    const { ctx, getGradient } = fakeContext();
    const sky = new SkyRenderer();

    sky.render(ctx);

    // The first gradient is the base sky gradient.
    expect(getGradient()!.stops).toHaveLength(3);
    expect(getGradient()!.stops[0].offset).toBe(0);
    expect(getGradient()!.stops[2].offset).toBe(1);
  });

  it("adds a warm radial sun glow and a horizon haze", () => {
    const { ctx, calls } = fakeContext();
    const sky = new SkyRenderer();

    sky.render(ctx);

    // The sun glow is a radial gradient.
    const radial = calls.filter((c) => c.op === "createRadialGradient");
    expect(radial.length).toBe(1);

    // The horizon warmth is a second linear gradient after the base sky.
    const linear = calls.filter((c) => c.op === "createLinearGradient");
    expect(linear.length).toBe(2);

    // Three full-screen fill passes: base sky, sun glow, horizon warmth.
    const fills = calls.filter((c) => c.op === "fillRect");
    expect(fills.length).toBe(3);
  });
});
