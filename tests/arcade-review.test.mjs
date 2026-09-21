import test from "node:test";
import assert from "node:assert/strict";
import { ammoReward, missionPacing } from "../src/progression.mjs";
import { addRuins } from "../src/ruins.mjs";
import { missionStory } from "../src/story.mjs";
import { WEAPONS } from "../src/arsenal.ts";
import { moveCircle } from "../src/rules.mjs";

test("arcade ammo rewards refill one finite weapon, respect difficulty and never waste a full pickup", () => {
  const reserves = { 0: Infinity, 2: 0, 7: 0, 9: 0 };
  for (const [mode, expected] of [
    ["easy", 120],
    ["normal", 120],
    ["hard", 24],
    ["crazy", 12],
  ])
    assert.deepEqual(ammoReward([0, 2, 7, 9], reserves, WEAPONS, 2, mode), {
      index: 2,
      amount: expected,
    });
  assert.deepEqual(
    ammoReward([0, 2, 7], { ...reserves, 2: 480 }, WEAPONS, 2, "normal"),
    { index: 7, amount: 1 },
  );
  assert.deepEqual(ammoReward([2], { 2: 479 }, WEAPONS, 2, "normal"), {
    index: 2,
    amount: 1,
  });
  assert.equal(
    ammoReward([0, 2], { 0: Infinity, 2: 480 }, WEAPONS, 0, "normal"),
    null,
  );
  assert.equal(ammoReward([0], reserves, WEAPONS, 0, "hard"), null);
  assert.deepEqual(ammoReward([9], reserves, WEAPONS, 9, "crazy"), {
    index: 9,
    amount: 1,
  });
});

test("city compounds stay inside old footprints and allow infantry through both doorways", () => {
  const footprint = { x: 0, z: 0, w: 5, d: 7, kind: "building" };
  const boxes = [footprint];
  addRuins(
    { biome: "city", stage: 4, level: 0, route: [{ x: 0, z: 10 }] },
    boxes,
  );
  assert.equal(boxes.length, 9);
  assert.ok(
    boxes.every(
      (b) =>
        Math.abs(b.x) + b.w / 2 <= 2.500001 &&
        Math.abs(b.z) + b.d / 2 <= 3.500001,
    ),
  );
  let pos = { x: 0, z: 5 };
  for (const goal of [
    { x: 0, z: 2 },
    { x: 1.2, z: 2 },
    { x: 1.2, z: -2 },
    { x: 0, z: -2 },
    { x: 0, z: -5 },
  ]) {
    for (let i = 0; i < 100; i++) {
      const dx = goal.x - pos.x,
        dz = goal.z - pos.z,
        d = Math.hypot(dx, dz);
      if (d < 0.02) break;
      pos = moveCircle(
        pos.x,
        pos.z,
        (dx / d) * Math.min(0.1, d),
        (dz / d) * Math.min(0.1, d),
        0.52,
        boxes,
        { x: 20, minZ: -20, maxZ: 20 },
      );
    }
    assert.ok(
      Math.hypot(pos.x - goal.x, pos.z - goal.z) < 0.03,
      JSON.stringify({ pos, goal }),
    );
  }
});

test("opening progression is gentler while later density and causal mission outcomes remain distinct", () => {
  assert.deepEqual(
    [0, 1, 2].map((l) => missionPacing(0, l).density),
    [1, 2, 2],
  );
  assert.equal(missionPacing(1, 0).density, 4);
  const outcomes = new Set();
  for (let stage = 0; stage < 7; stage++)
    for (let level = 0; level < 3; level++) {
      const story = missionStory(stage, level);
      assert.ok(story.stakes.length > 20);
      outcomes.add(story.success);
    }
  assert.equal(outcomes.size, 21);
});

test("every city level contains four compounds and permanent relay houses", async () => {
  const { MISSIONS, COVER, buildLayout } = await import("../src/missions.ts");
  for (const m of MISSIONS.filter((m) => m.biome === "city")) {
    buildLayout(m);
    assert.equal(COVER.filter((b) => b.asset === "ruinWall").length, 36);
    assert.equal(COVER.filter((b) => b.asset === "relayHouse").length, 3);
  }
});
