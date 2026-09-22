import { test } from "node:test";
import assert from "node:assert/strict";
import {
  infantryRole,
  INFANTRY,
  inMeleeSector,
  pressureLimits,
} from "../src/enemy-roles.mjs";
test("specialists introduce gradually without changing patrol counts or rifle backbone", () => {
  const intro = Array.from({ length: 12 }, (_, i) => infantryRole(0, i));
  assert.equal(intro.filter((r) => r === "rusher").length, 2);
  assert.ok(intro.every((r) => ["rifleman", "rusher"].includes(r)));
  const second = Array.from({ length: 24 }, (_, i) => infantryRole(1, i));
  assert.ok(second.includes("swordsman") && second.includes("thrower"));
  assert.ok(!second.includes("rocketeer"));
  for (let mission = 2; mission < 21; mission++) {
    const roles = Array.from({ length: 100 }, (_, i) =>
      infantryRole(mission, i),
    );
    assert.equal(roles.length, 100);
    for (const role of Object.keys(INFANTRY)) assert.ok(roles.includes(role));
    assert.equal(roles.filter((r) => r === "rifleman").length, 55);
    assert.equal(roles.filter((r) => r === "rocketeer").length, 5);
  }
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
