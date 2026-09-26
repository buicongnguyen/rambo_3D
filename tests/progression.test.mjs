import test from "node:test";
import assert from "node:assert/strict";
import {
  enemyLoot,
  seesPlayer,
  rearHit,
  grenadeHeight,
  turnToward,
  missionPacing,
} from "../src/progression.mjs";
import { WEAPONS } from "../src/arsenal.ts";
import {
  MISSIONS,
  COVER,
  PATCHES,
  SPAWNS,
  buildLayout,
} from "../src/missions.ts";
import { routeLength } from "../src/routes.mjs";
import { placeSupplies, placeVehicles } from "../src/encounters.mjs";

test("opening is compact, equipment unlocks gradually, and seeded rewards remain reachable", () => {
  const areas = MISSIONS.slice(0, 3).map(
    (m) => m.bounds.x * 2 * (m.bounds.maxZ - m.bounds.minZ),
  );
  assert.ok(areas[0] < areas[1] / 4);
  assert.ok(routeLength(MISSIONS[0].route) < 85);
  for (let i = 0; i < 3; i++) {
    const m = MISSIONS[i],
      p = missionPacing(m.stage, m.level);
    buildLayout(m);
    assert.equal(SPAWNS.length, i === 0 ? 12 : i === 1 ? 12 : 32);
    const rides = placeVehicles(m.route, COVER, PATCHES, m.bounds, m.roads, p);
    assert.equal(rides.length, [0, 2, 3][i]);
    for (let seed = 0; seed < 30; seed++) {
      const drops = placeSupplies(
        m.route,
        [
          ...COVER,
          ...rides.map((v) => ({
            x: v.x,
            z: v.z,
            w: v.radius * 2,
            d: v.radius * 2,
          })),
        ],
        PATCHES,
        m.bounds,
        seed,
        m.roads,
        p,
      );
      assert.deepEqual(
        drops.filter((d) => d.kind === "weapon").map((d) => d.index),
        p.weapons,
      );
      if (i === 0) assert.equal(drops.length, 4);
    }
  }
});
test("loot drops one time in three and favours ammo boxes over medical kits", () => {
  const results = Array.from({ length: 900 }, (_, i) =>
    enemyLoot((i + 0.5) / 900, ((i % 6) + 0.5) / 6),
  );
  assert.equal(results.filter(Boolean).length, 300);
  const count = (kind) => results.filter((k) => k === kind).length;
  assert.equal(count("health"), 50);
  assert.equal(count("shield"), 100);
  assert.equal(count("ammo"), 150);
  assert.equal(enemyLoot(1 / 3, 0), null);
});
test("vision requires a forward cone and unbroken sight, and rear hits reward direction", () => {
  const e = { x: 0, z: 0, alerted: false },
    player = { x: 0, z: 10 };
  assert.equal(seesPlayer(e, player, [], 0), true);
  assert.equal(seesPlayer(e, { x: 0, z: -10 }, [], 0), false);
  assert.equal(seesPlayer(e, player, [{ x: 0, z: 5, w: 5, d: 2 }], 0), false);
  assert.equal(rearHit(e, WEAPONS[0], { x: 0, z: 1 }, 0), true);
  assert.equal(rearHit(e, WEAPONS[0], { x: 0, z: -1 }, 0), false);
  assert.equal(
    rearHit({ ...e, boss: true }, WEAPONS[0], { x: 0, z: 1 }, 0),
    false,
  );
  assert.equal(rearHit(e, WEAPONS[9], { x: 0, z: 1 }, 0), false);
  assert.ok(Math.abs(turnToward(0, Math.PI, 0.1)) <= 0.100001);
});
test("grenade trajectory leaves the hand, clears low cover and lands at ground height", () => {
  assert.equal(grenadeHeight(0, 0.85), 0.95);
  assert.ok(grenadeHeight(0.425, 0.85) > 3);
  assert.equal(grenadeHeight(0.85, 0.85), 0);
  assert.equal(grenadeHeight(2, 0.85), 0);
});
