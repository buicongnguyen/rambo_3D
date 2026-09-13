import test from "node:test";
import assert from "node:assert/strict";
import { tracerGeometry } from "../src/tracers.ts";
import { WEAPONS, VEHICLES } from "../src/arsenal.ts";
test("compact rounds have a half-size envelope and only warm vertex colors", () => {
  for (const [color, enemy] of [
    [0xff9418, false],
    [0xffc62b, false],
    [0xff7914, true],
  ]) {
    const g = tracerGeometry(color, enemy);
    g.computeBoundingBox();
    const b = g.boundingBox;
    assert.ok(b.max.z - b.min.z <= 0.476);
    assert.ok(b.max.x - b.min.x <= 0.101);
    assert.ok(b.max.y - b.min.y < 0.1);
    const c = g.getAttribute("color");
    for (let i = 0; i < c.count; i++)
      assert.ok(
        c.getX(i) >= c.getY(i) && c.getY(i) > c.getZ(i),
        "orange/yellow/red without magenta",
      );
    g.dispose();
  }
});
test("machine-gun ammo damage budget is preserved while tank armor is quadrupled", () => {
  const m = WEAPONS.find((w) => w.id === "machineGun");
  assert.equal(m.damage * 2, 30);
  assert.equal(m.mag, 120);
  assert.equal(m.cool * 2, 0.061);
  assert.equal(m.mag * 4 * m.damage, 60 * 4 * 30);
  assert.equal(m.reload, 2.4);
  assert.equal(VEHICLES.tank.hp, 420 * 4);
  assert.equal(VEHICLES.tank.ammo, 6);
});
