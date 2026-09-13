import test from "node:test";
import assert from "node:assert/strict";
import {
  SpatialGrid,
  turboStats,
  knockbackDistance,
  PATROL_DENSITY,
} from "../src/combat.mjs";
import { MISSIONS, COVER, buildLayout } from "../src/missions.ts";
import { segmentBox, segmentCircle } from "../src/rules.mjs";
test("spatial broad phase preserves swept hits across negative cells and large armored radii", () => {
  const grid = new SpatialGrid(5);
  const items = [];
  for (let i = 0; i < 200; i++) {
    const item = {
      x: Math.sin(i * 2.4) * 80,
      z: Math.cos(i * 1.7) * 80,
      w: 1 + (i % 9),
      d: 1 + (i % 5),
    };
    items.push(item);
    grid.insert(item, item.x, item.z, item.w, item.d);
  }
  for (let i = 0; i < 100; i++) {
    const ax = Math.sin(i) * 85,
      az = Math.cos(i) * 85,
      bx = ax + Math.sin(i * 0.7) * 18,
      bz = az + Math.cos(i * 0.7) * 18;
    const candidates = grid.segment(ax, az, bx, bz, 1.2);
    assert.equal(new Set(candidates).size, candidates.length);
    for (const b of items)
      if (Number.isFinite(segmentBox(ax, az, bx, bz, b, 1.2)))
        assert.ok(candidates.includes(b));
  }
  const tank = {};
  grid.insert(tank, -5, -5, 8, 8);
  assert.ok(grid.segment(-10, -5, 0, -5).includes(tank));
  grid.clear();
  assert.equal(grid.near(0, 0, 100).length, 0);
});
test("all 21 stages replace broad barriers with multi-hit trees while keeping city buildings", () => {
  assert.equal(PATROL_DENSITY, 4);
  for (const m of MISSIONS) {
    buildLayout(m);
    assert.ok(
      !COVER.some((b) =>
        ["hill", "basalt", "cover", "concrete"].includes(b.kind),
      ),
      m.name,
    );
    const replacements = COVER.filter((b) => b.scale === 0.65);
    assert.ok(replacements.length > 0);
    assert.ok(
      replacements.every((b) => b.w === 0.65 && b.d === 0.65 && b.hp === 180),
    );
    if (m.biome === "ice")
      assert.ok(replacements.every((b) => b.kind === "snowTree"));
    if (m.biome === "city") assert.ok(COVER.some((b) => b.kind === "building"));
  }
});
test("knockback grows with impact power and blast force but is bounded", () => {
  assert.ok(knockbackDistance(206, 90, 4) > knockbackDistance(43, 30, 0));
  assert.equal(knockbackDistance(10000, 100, 8), 6.5);
});
test("Turbo upgrade progression respects duration, cooldown and vehicle gun limits", () => {
  assert.deepEqual(turboStats(0, 0), {
    duration: 3,
    cooldown: 14,
    guns: 2,
    unlocked: true,
  });
  assert.equal(turboStats(0, 0, true).unlocked, false);
  assert.equal(turboStats(1, 0, true).guns, 2);
  assert.equal(turboStats(3, 0, true).guns, 3);
  assert.equal(turboStats(3, 0).guns, 2);
  assert.equal(turboStats(20, 20, true).duration, 5);
  assert.equal(turboStats(20, 20, true).cooldown, 8);
});
