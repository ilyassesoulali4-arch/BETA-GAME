import { describe, expect, it, vi } from "vitest";

/**
 * Startup smoke test: runs the real main.ts bootstrap and a few animation
 * frames under a DOM stub. Guards against any runtime error that would leave
 * the game canvas black in a browser — the single most common "black screen"
 * cause is a crash somewhere between module load and the first frame.
 */

function makeCtx(calls: unknown[]) {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    fillRect: (...a: unknown[]) => void calls.push(["fillRect", ...a]),
    strokeRect: (...a: unknown[]) => void calls.push(["strokeRect", ...a]),
    fillText: (...a: unknown[]) => void calls.push(["fillText", ...a]),
    drawImage: (...a: unknown[]) => void calls.push(["drawImage", ...a]),
    beginPath: () => void calls.push(["beginPath"]),
    moveTo: (...a: unknown[]) => void calls.push(["moveTo", ...a]),
    lineTo: (...a: unknown[]) => void calls.push(["lineTo", ...a]),
    arc: (...a: unknown[]) => void calls.push(["arc", ...a]),
    ellipse: (...a: unknown[]) => void calls.push(["ellipse", ...a]),
    closePath: () => void calls.push(["closePath"]),
    fill: () => void calls.push(["fill"]),
    stroke: () => void calls.push(["stroke"]),
    save: () => void calls.push(["save"]),
    restore: () => void calls.push(["restore"]),
    translate: (...a: unknown[]) => void calls.push(["translate", ...a]),
  } as unknown as CanvasRenderingContext2D;
}

function stubDom() {
  const calls: unknown[] = [];
  const storage = new Map<string, string>();
  const rafCallbacks: Array<(t: number) => void> = [];

  const canvasStub = {
    width: 0,
    height: 0,
    style: {},
    addEventListener: () => undefined,
    getContext: () => makeCtx(calls),
  };

  const documentStub = {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return canvasStub;
      }
      return { style: {}, textContent: "" };
    },
    body: { appendChild: () => undefined },
    getElementById: () => null,
  };
  const windowStub = {
    innerWidth: 960,
    innerHeight: 540,
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, String(v)),
      removeItem: (k: string) => void storage.delete(k),
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: (fn: (t: number) => void) => {
      rafCallbacks.push(fn);
      return rafCallbacks.length;
    },
    performance: { now: () => 0 },
  };

  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
  });
  vi.stubGlobal("requestAnimationFrame", (fn: (t: number) => void) => {
    rafCallbacks.push(fn);
    return rafCallbacks.length;
  });
  vi.stubGlobal("Image", class { src = ""; width = 24; height = 24; });

  return {
    calls,
    rafCallbacks,
    runFrames: (n: number) => {
      for (let i = 0; i < n; i++) {
        const fn = rafCallbacks.shift();
        if (!fn) break;
        fn((i + 1) * 16.6);
      }
    },
  };
}

describe("startup smoke test", () => {
  it("boots main.ts and renders frames without throwing", async () => {
    const dom = stubDom();
    await import("../src/main");
    dom.runFrames(3);

    // The loop keeps scheduling frames (requestAnimationFrame was called and
    // the three queued frames ran, leaving the loop alive).
    expect(dom.rafCallbacks.length).toBeGreaterThan(0);

    // The scene painted: at least one fill (sky/blocks) and at least one layer
    // blit (drawImage of the cached background/world layers).
    expect(dom.calls.some((c) => Array.isArray(c) && c[0] === "fillRect")).toBe(true);
    expect(dom.calls.some((c) => Array.isArray(c) && c[0] === "drawImage")).toBe(true);
  });
});
