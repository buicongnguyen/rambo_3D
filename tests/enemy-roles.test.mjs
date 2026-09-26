import { test } from "node:test";
import assert from "node:assert/strict";
import {
  infantryRole,
  INFANTRY,
  inMeleeSector,
  pressureLimits,
  SWORD_STAGE,
  NINJA_STAGE,
} from "../src/enemy-roles.mjs";
test("specialists introduce gradually without changing patrol counts or rifle backbone", () => {
  const intro = Array.from({ length: 12 }, (_, i) => infantryRole(0, i));
  assert.equal(intro.filter((r) => r === "rusher").length, 2);
  assert.ok(intro.every((r) => ["rifleman", "rusher"].includes(r)));
  const second = Array.from({ length: 24 }, (_, i) => infantryRole(1, i));
  assert.ok(second.includes("swordsman") && second.includes("thrower"));
  assert.ok(!second.includes("rocketeer"));
  for (let mission = 2; mission < 21; mission++) {
    const stage = Math.floor(mission / 3);
    const roles = Array.from({ length: 100 }, (_, i) =>
      infantryRole(mission, i),
    );
    const count = (role) => roles.filter((r) => r === role).length;
    assert.equal(roles.length, 100);
    for (const role of ["rifleman", "rusher", "swordsman", "thrower"])
      assert.ok(roles.includes(role));
    assert.equal(count("rocketeer"), 5);
    assert.equal(count("thrower"), 10);
    // Early stages stay gentle; later ones trade riflemen and rushers for blades.
    assert.equal(count("swordsman"), stage < SWORD_STAGE ? 10 : 20);
    assert.equal(
      count("ninja"),
      stage < NINJA_STAGE ? 0 : stage === NINJA_STAGE ? 15 : 20,
    );
    assert.equal(
      count("rifleman"),
      stage < SWORD_STAGE ? 55 : stage <= NINJA_STAGE ? 45 : 40,
    );
  }
  assert.equal(SWORD_STAGE, 2);
  assert.equal(NINJA_STAGE, 4);
});
test("ninjas are fast, fragile late-stage blades with a short but readable swing", () => {
  const n = INFANTRY.ninja,
    r = INFANTRY.rifleman;
  assert.ok(n.speed >= r.speed * 2.5 && n.speed <= r.speed * 3);
  assert.ok(n.hp < r.hp && n.melee);
  assert.ok(n.warning >= 0.4 && n.warning < INFANTRY.swordsman.warning);
  assert.ok(n.damage < INFANTRY.swordsman.damage);
});
test("melee sectors allow range and flank evasion, including vehicle hull sizes", () => {
  const origin = { x: 0, z: 0 },
    s = INFANTRY.swordsman;
  assert.ok(inMeleeSector(origin, { x: 0, z: 2.5 }, 0, s.reach, s.arc));
  assert.ok(!inMeleeSector(origin, { x: 0, z: 3 }, 0, s.reach, s.arc));
  assert.ok(!inMeleeSector(origin, { x: 2, z: 0 }, 0, s.reach, s.arc));
  assert.ok(!inMeleeSector(origin, { x: 0, z: -1 }, 0, s.reach, s.arc));
  assert.ok(
    inMeleeSector(origin, { x: 4, z: 0 }, Math.PI / 2, s.reach, s.arc, 2.3),
  );
});
test("difficulty limits specialist pressure and preserves readable reaction windows", () => {
  assert.deepEqual(pressureLimits("easy"), { melee: 2, thrower: 2, rocket: 1 });
  assert.deepEqual(pressureLimits("normal"), {
    melee: 3,
    thrower: 3,
    rocket: 1,
  });
  assert.deepEqual(pressureLimits("hard"), { melee: 3, thrower: 3, rocket: 2 });
  assert.deepEqual(pressureLimits("crazy"), {
    melee: 4,
    thrower: 3,
    rocket: 2,
  });
  assert.ok(INFANTRY.rusher.hp < INFANTRY.rifleman.hp);
  assert.ok(INFANTRY.rocketeer.warning >= 1);
  assert.ok(INFANTRY.swordsman.warning >= 0.8);
});
