import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Interpolator, TELEPORT } from "../src/interpolation.mjs";
import {
  AI_PROFILES,
  aiProfile,
  isFlanker,
  leadAngle,
} from "../src/enemy-roles.mjs";
import { ambushPlan, ambushPoints } from "../src/encounters.mjs";
import { relayProgress, pointAlong } from "../src/guidance.mjs";

test("render interpolation blends between steps and restores the exact simulation state", () => {
  const root = new T.Group(),
    walker = new T.Object3D(),
    still = new T.Object3D(),
    jumper = new T.Object3D();
  root.add(walker, still, jumper);
  walker.rotation.y = 2.5; // beyond 90 degrees: a quaternion round trip would flip the Euler
  const it = new Interpolator();
  it.capture(root);
  walker.position.set(1, 0, 0);
  walker.rotation.y = 2.7;
  jumper.position.set(TELEPORT + 1, 0, 0);
  const late = new T.Object3D();
  late.position.set(3, 0, 0);
  root.add(late); // created during the step: nothing to blend from
  it.apply(root, 0.5);
  assert.ok(Math.abs(walker.position.x - 0.5) < 1e-9);
  const yaw = new T.Euler().setFromQuaternion(walker.quaternion, "YXZ").y;
  assert.ok(Math.abs(yaw - 2.6) < 1e-6);
  assert.equal(jumper.position.x, TELEPORT + 1, "teleports snap");
  assert.equal(late.position.x, 3);
  assert.equal(it.blended, 1);
  it.restore();
  assert.equal(walker.position.x, 1);
  assert.equal(walker.rotation.y, 2.7);
  assert.equal(walker.rotation.x, 0);
  assert.equal(walker.rotation.z, 0);
  // Alpha 1 (menus, hit-stop) draws the current state untouched.
  it.apply(root, 1);
  assert.equal(it.blended, 0);
  assert.equal(walker.position.x, 1);
  // A reset forgets older steps.
  it.capture(root);
  walker.position.set(2, 0, 0);
  it.reset();
  it.apply(root, 0.5);
  assert.equal(walker.position.x, 2);
});

test("difficulty scales soldier behaviour monotonically and keeps every shot telegraphed", () => {
  const order = ["easy", "normal", "hard", "crazy"].map((d) => AI_PROFILES[d]);
  for (let i = 1; i < order.length; i++) {
    const [a, b] = [order[i - 1], order[i]];
    assert.ok(b.reaction <= a.reaction && b.spread <= a.spread);
    assert.ok(b.interval <= a.interval);
    assert.ok(b.lead >= a.lead && b.share >= a.share && b.flank >= a.flank);
  }
  for (const p of order)
    assert.ok(p.reaction >= 0.6, "never below the warning ring");
  // Normal keeps the established rifle balance; Easy has no tactics at all.
  assert.deepEqual(
    {
      spread: AI_PROFILES.normal.spread,
      interval: AI_PROFILES.normal.interval,
    },
    { spread: 0.07, interval: 1 },
  );
  assert.deepEqual(
    [AI_PROFILES.easy.lead, AI_PROFILES.easy.share, AI_PROFILES.easy.flank],
    [0, 0, 0],
  );
  assert.equal(aiProfile("unknown"), AI_PROFILES.normal);
  const flankers = (share) =>
    Array.from({ length: 1000 }, (_, i) => isFlanker(i, share)).filter(Boolean)
      .length;
  assert.equal(flankers(0), 0);
  assert.ok(Math.abs(flankers(0.35) - 350) < 15);
});

test("riflemen lead a moving target by a capped amount", () => {
  const from = { x: 0, z: 0 },
    target = { x: 0, z: 9 };
  const still = leadAngle(from, target, { x: 0, z: 0 }, 9, 1);
  assert.equal(still, 0);
  const moving = leadAngle(from, target, { x: 4, z: 0 }, 9, 0.5);
  assert.ok(Math.abs(moving - Math.atan2(2, 9)) < 1e-9, "half of 4 m/s x 1 s");
  const sprint = leadAngle(from, target, { x: 40, z: 0 }, 9, 1);
  assert.ok(Math.abs(sprint - Math.atan2(6, 9)) < 1e-9, "capped at 6 m");
});

test("route-progress ambushes start at stage 3 and flank the road ahead", () => {
  assert.deepEqual(ambushPlan(0), []);
  assert.deepEqual(ambushPlan(1), []);
  assert.deepEqual(ambushPlan(2), [{ at: 0.5, size: 3 }]);
  assert.deepEqual(ambushPlan(4, 2), [
    { at: 0.35, size: 8 },
    { at: 0.7, size: 8 },
  ]);
  const road = [
    { x: 0, z: 0 },
    { x: 0, z: -100 },
  ];
  const relay = { x: 0, z: -80 };
  const p = relayProgress([road], relay, 2, -40);
  assert.equal(p.fraction, 0.5);
  assert.equal(p.along, 40);
  const points = ambushPoints(road, p.along, 4, pointAlong, { x: 2, z: -40 });
  assert.equal(points.length, 4);
  for (const q of points) {
    assert.ok(q.z <= -60 && q.z >= -75, "further down the road");
    assert.ok(Math.hypot(q.x - 2, q.z + 40) >= 22, "never beside the player");
    assert.ok(Math.abs(q.x) >= 9, "off the road on a flank");
  }
  // A road that doubles back: points are pushed out until 22 m away.
  const hairpin = [
    { x: 0, z: 0 },
    { x: 0, z: -30 },
    { x: 10, z: -30 },
    { x: 10, z: 0 },
    { x: 10, z: 60 },
  ];
  for (const q of ambushPoints(hairpin, 20, 3, pointAlong, { x: 0, z: -20 }))
    assert.ok(Math.hypot(q.x, q.z + 20) >= 22);
  assert.ok(points.some((q) => q.x < 0) && points.some((q) => q.x > 0));
});
