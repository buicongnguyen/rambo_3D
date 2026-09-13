import test from "node:test";
import assert from "node:assert/strict";
import { WEAPONS } from "../src/arsenal.ts";
import {
  armorMultiplier,
  depotGuardPositions,
  explosiveTarget,
} from "../src/tactics.mjs";
import { MISSIONS, buildLayout, COVER, SPAWNS } from "../src/missions.ts";
import { segmentBox } from "../src/rules.mjs";

const store = (x, z = 0, kind = "fuel") => ({ x, z, w: 0.8, d: 0.8, kind });
test("weapon roles reward anti-armor equipment without making infantry bullet sponges", () => {
  const mg = WEAPONS[2],
    rifle = WEAPONS[0];
  assert.equal(armorMultiplier({}, mg), 1);
  assert.ok(Math.ceil(65 / mg.damage) <= 7);
  assert.ok(Math.ceil(81 / rifle.damage) <= 3);
  assert.ok(
    Math.ceil(230 / (mg.damage * armorMultiplier({ armored: true }, mg))) >=
      100,
  );
  for (const id of [
    "missile",
    "laser",
    "launcher",
    "explosiveArrow",
    "throwBomb",
  ])
    assert.equal(
      armorMultiplier(
        { armored: true },
        WEAPONS.find((w) => w.id === id),
      ),
      1,
    );
  assert.equal(
    armorMultiplier({ armored: true }),
    1,
    "environment and collision damage bypass armor",
  );
  assert.equal(armorMultiplier({ bossKind: "laserTank" }, mg), 0.2);
  assert.equal(armorMultiplier({ bossKind: "gunship" }, mg), 1);
});
test("BLAST aims at crowd stores but refuses obstructed, short-range and unsafe chain shots", () => {
  const player = { x: 0, z: 0 },
    near = store(10, -4),
    crowd = store(20);
  const enemies = [
    { x: 20, z: 2, hp: 65, radius: 0.55 },
    { x: 22, z: -1, hp: 65, radius: 0.55 },
  ];
  assert.equal(explosiveTarget(player, enemies, [near, crowd], 35), crowd);
  assert.equal(
    explosiveTarget(
      player,
      enemies,
      [near, crowd],
      35,
      0.5,
      (b) => b !== crowd,
    ),
    near,
    "offscreen stores cannot be selected",
  );
  assert.equal(explosiveTarget(player, enemies, [crowd], 6), undefined);
  const wall = { x: 10, z: 0, w: 1, d: 4, kind: "building" };
  assert.equal(explosiveTarget(player, enemies, [crowd, wall], 35), undefined);
  assert.equal(
    explosiveTarget(
      player,
      [{ x: 10, z: 0, hp: 65, radius: 0.55 }],
      [crowd],
      35,
    ),
    undefined,
  );
  assert.equal(explosiveTarget(player, [], [store(7)], 35), undefined);
  assert.equal(
    explosiveTarget(player, [], [store(10), store(6, 2, "explosive")], 35),
    undefined,
    "remote store chains into player safety buffer",
  );
  assert.equal(
    explosiveTarget(player, [], [store(9)], 35, 2.3),
    undefined,
    "occupied tank has a wider unsafe radius",
  );
});
test("full-equipment maps support reachable explosive ambushes without adding or moving protected enemies", () => {
  for (const m of MISSIONS.slice(2)) {
    buildLayout(m);
    const actors = SPAWNS.flatMap(([x, z], i) =>
      Array.from({ length: 4 }, (_, n) => ({
        x: x + (n % 2 ? 0.8 : -0.8),
        z: z - Math.floor(n / 2) * 1.6,
        hp: 65,
        radius: 0.55,
        cacheGuard: i < 6,
      })),
    );
    const old = structuredClone(actors);
    const placements = depotGuardPositions(actors, COVER, m.bounds, m.start);
    assert.deepEqual(actors, old, "planning is pure");
    assert.ok(
      placements.length >= 4,
      `${m.name}/${m.level} has ${placements.length} depot guards`,
    );
    assert.equal(
      new Set(placements.map((p) => p.index)).size,
      placements.length,
    );
    for (const p of placements) {
      assert.ok(!actors[p.index].cacheGuard);
      assert.ok(Math.hypot(p.x - p.depot.x, p.z - p.depot.z) <= 3);
      assert.ok(
        COVER.every((b) => segmentBox(p.x, p.z, p.x, p.z, b, 0.6) === Infinity),
      );
    }
  }
});
