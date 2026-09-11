import { test } from "node:test";
import assert from "node:assert/strict";
import {
  segmentBox,
  segmentCircle,
  moveCircle,
  freshSave,
  validateSave,
  advanceCampaign,
} from "../src/rules.mjs";
test("swept projectile hits thin cover even when endpoints are beyond it", () => {
  assert.equal(segmentBox(-10, 0, 10, 0, { x: 0, z: 0, w: 1, d: 2 }), 0.475);
  assert.equal(segmentBox(-10, 5, 10, 5, { x: 0, z: 0, w: 1, d: 2 }), Infinity);
});
test("parallel and inside-box cases remain well defined", () => {
  assert.equal(segmentBox(0, 0, 0, 3, { x: 0, z: 0, w: 2, d: 2 }), 0);
  assert.equal(segmentBox(2, -3, 2, 3, { x: 0, z: 0, w: 2, d: 2 }), Infinity);
});
test("swept actor collision catches high speed shots and rejects misses", () => {
  assert.equal(segmentCircle(-5, 0, 5, 0, 0, 0, 1), 0.4);
  assert.equal(segmentCircle(-5, 2, 5, 2, 0, 0, 1), Infinity);
  assert.equal(segmentCircle(0, 0, 0, 0, 0, 0, 1), 0);
});
test("dash substeps prevent crossing thin walls while allowing sliding", () => {
  const wall = { x: 0, z: 0, w: 0.2, d: 8 };
  const p = moveCircle(-3, 0, 8, 2, 0.5, [wall]);
  assert.ok(p.x < -0.59);
  assert.ok(p.z > 1.9);
});
test("world boundaries clamp diagonal movement", () => {
  const p = moveCircle(28, 28, 50, 50, 0.5, [], 29);
  assert.equal(p.x, 28.5);
  assert.equal(p.z, 28.5);
});
test("invalid saves do not grant upgrades or break progression", () => {
  for (const bad of [
    null,
    {},
    { ...freshSave(), mission: 5 },
    { ...freshSave(), armor: 9 },
    { ...freshSave(), power: -1 },
    { ...freshSave(), best: Infinity },
    { ...freshSave(), mission: "1" },
  ])
    assert.deepEqual(validateSave(bad), freshSave());
});
test("campaign upgrades, best score, final completion, and resume survive round trip", () => {
  let s = advanceCampaign(freshSave(), "armor", 2500);
  assert.equal(s.mission, 1);
  assert.equal(s.armor, 1);
  s = advanceCampaign(s, "power", 1800);
  assert.equal(s.mission, 2);
  assert.equal(s.best, 2500);
  s = advanceCampaign(s, "mobility", 3200);
  assert.equal(s.completed, true);
  assert.equal(s.mobility, 0);
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
});
test("unknown upgrades cannot silently corrupt a campaign", () =>
  assert.throws(() => advanceCampaign(freshSave(), "bad", 2)));
import { routeStep } from "../src/rules.mjs";
test("follower path steers around solid cover and uses clear direct paths", () => {
  assert.deepEqual(routeStep(-5, 0, 5, 0, []), { x: 5, z: 0 });
  const wall = { x: 0, z: 0, w: 2, d: 6 };
  let p = { x: -5, z: 0 };
  for (let i = 0; i < 50 && Math.hypot(p.x - 5, p.z) > 1.5; i++)
    p = routeStep(p.x, p.z, 5, 0, [wall]);
  assert.ok(Math.hypot(p.x - 5, p.z) <= 1.5);
});

test("completed saves cannot bypass unfinished missions", () => {
  assert.deepEqual(
    validateSave({ ...freshSave(), completed: true }),
    freshSave(),
  );
});
