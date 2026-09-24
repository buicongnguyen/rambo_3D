import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guidePoint,
  nextGoal,
  pointAlong,
  projectOnRoute,
} from "../src/guidance.mjs";

// An L-shaped road: north 40 m, then east 40 m.
const road = [
  { x: 0, z: 0 },
  { x: 0, z: -40 },
  { x: 40, z: -40 },
];

test("routes project and sample by metres along the road", () => {
  assert.deepEqual(projectOnRoute(road, 2, -10), { along: 10, offset: 2 });
  assert.equal(projectOnRoute(road, 20, -38).along, 60);
  assert.deepEqual(pointAlong(road, 50), { x: 10, z: -40 });
  assert.deepEqual(pointAlong(road, 500), { x: 40, z: -40 });
});

test("the arrow follows the road around a corner instead of cutting across", () => {
  const goal = { x: 40, z: -40 };
  // Straight-line direction points north-east; the road first heads north.
  assert.deepEqual(guidePoint([road], { x: 0, z: -5 }, goal), {
    x: 0,
    z: -15,
  });
  // Near the goal along the road, or off every road: point straight at it.
  assert.deepEqual(guidePoint([road], { x: 34, z: -40 }, goal), goal);
  assert.deepEqual(guidePoint([road], { x: 30, z: 20 }, goal), goal);
  // Walking back along the road when the goal is behind the player.
  assert.deepEqual(guidePoint([road], { x: 20, z: -40 }, { x: 0, z: 0 }), {
    x: 10,
    z: -40,
  });
});

test("goals run relay → nearest hostile → extraction", () => {
  const base = {
    from: { x: 0, z: 0 },
    relay: { x: 5, z: -30 },
    extract: { x: 0, z: -90 },
    finale: false,
    hostiles: [
      { x: 30, z: 0 },
      { x: -6, z: 2 },
    ],
  };
  assert.equal(
    nextGoal({ ...base, relaySecured: false, cleared: false }).kind,
    "relay",
  );
  assert.deepEqual(nextGoal({ ...base, relaySecured: true, cleared: false }), {
    x: -6,
    z: 2,
    kind: "guard",
  });
  assert.equal(
    nextGoal({ ...base, finale: true, relaySecured: true, cleared: false })
      .kind,
    "boss",
  );
  assert.equal(
    nextGoal({ ...base, hostiles: [], relaySecured: true, cleared: false }),
    null,
  );
  assert.equal(
    nextGoal({ ...base, relaySecured: true, cleared: true }).kind,
    "extract",
  );
});
