import { test, expect } from "vitest";
import { World } from "../src/world";
import { Player } from "../src/player";
import { CONFIG } from "../src/config";
import { BlockId } from "../src/blockTypes";
import type { Input } from "../src/input";

/**
 * Builds a flat, clean world: air everywhere above row 20, solid dirt from
 * row 20 down. No generated terrain is used so results are deterministic.
 */
function flatWorld(): World {
  const world = new World("flat-test");
  for (let c = -40; c <= 80; c++) {
    for (let r = 0; r < 20; r++) {
      world.setBlockAt(c, r, BlockId.Air);
    }
    for (let r = 20; r < 32; r++) {
      world.setBlockAt(c, r, BlockId.Dirt);
    }
  }
  return world;
}

/** Player standing on the flat floor, its feet one pixel above row 20. */
function playerOnFloor(world: World, x: number): Player {
  const p = new Player();
  p.position.x = x;
  p.position.y = 20 * CONFIG.block.size - p.height - 0.001;
  return p;
}

const right = (): Input =>
  ({
    isLeftDown: () => false,
    isRightDown: () => true,
    isJumpDown: () => false,
  }) as Input;

const standing = (): Input =>
  ({
    isLeftDown: () => false,
    isRightDown: () => false,
    isJumpDown: () => true,
  }) as Input;

const STEP = 1 / 60;

test("runs at full speed on flat ground with uniform deltas", () => {
  const world = flatWorld();
  const p = playerOnFloor(world, 0);
  for (let i = 0; i < 10; i++) p.update(STEP, right(), world);
  const x0 = p.position.x;
  const xs: number[] = [];
  for (let i = 0; i < 120; i++) {
    p.update(STEP, right(), world);
    xs.push(p.position.x);
  }
  const dx = p.position.x - x0;
  // 2 seconds of movement at moveSpeed px/s.
  expect(dx).toBeCloseTo(CONFIG.player.moveSpeed * 2, 0);

  // Every frame advances by the same amount (no stutter/jitter). Round to
  // hide floating-point noise from the multiplication.
  const deltas = new Set(xs.slice(1).map((v, i) => (v - xs[i]).toFixed(4)));
  expect(deltas.size).toBe(1);
});

test("auto-jumps over a one-block obstacle and continues", () => {
  const world = flatWorld();
  world.setBlockAt(12, 19, BlockId.Dirt);
  const p = playerOnFloor(world, 8 * CONFIG.block.size);
  for (let i = 0; i < 10; i++) p.update(STEP, right(), world);
  for (let i = 0; i < 240; i++) p.update(STEP, right(), world);
  // Cleared the obstacle and is past its column.
  expect(p.position.x).toBeGreaterThan(13 * CONFIG.block.size);
});

test("stops at a three-block wall without repeated auto-jumps", () => {
  const world = flatWorld();
  // Player body occupies rows 18-19 while standing on the row-20 floor.
  // A 3-block-tall wall rises from the floor into rows 17, 18 and 19.
  for (let r = 17; r < 20; r++) {
    world.setBlockAt(12, r, BlockId.Stone);
  }
  const p = playerOnFloor(world, 0);
  for (let i = 0; i < 10; i++) p.update(STEP, right(), world);
  let jumps = 0;
  let prevVy = 0;
  for (let i = 0; i < 300; i++) {
    p.update(STEP, right(), world);
    if (p.velocity.y < -100 && prevVy >= -100) jumps++;
    prevVy = p.velocity.y;
  }
  expect(jumps).toBe(0);
  expect(p.position.x).toBeGreaterThan(10 * CONFIG.block.size);
  expect(p.position.x).toBeLessThan(12 * CONFIG.block.size);
});

test("jump under a low ceiling never pushes the head into the ceiling", () => {
  const world = flatWorld();
  // Player body occupies rows 18-19 while standing, so the head is directly
  // below row 17. A ceiling at rows 16-17 leaves no room to jump.
  for (let c = 0; c <= 8; c++) {
    world.setBlockAt(c, 16, BlockId.Stone);
    world.setBlockAt(c, 17, BlockId.Stone);
  }
  const p = playerOnFloor(world, 3 * CONFIG.block.size);
  for (let i = 0; i < 120; i++) p.update(STEP, standing(), world);
  // Head (position.y) must stay below the ceiling bottom edge (row 17's bottom
  // is at y = 18 * BLOCK_SIZE).
  expect(p.position.y).toBeGreaterThanOrEqual(18 * CONFIG.block.size);
});
