import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAR_BONUS,
  missionGrade,
  missionPar,
  recordStars,
  rewardBreakdown,
} from "../src/debrief.mjs";
import { SUPPLIES, buySupply } from "../src/economy.mjs";
import { SUPPLY_IDS, freshSave, validateSave } from "../src/rules.mjs";

test("three stars: complete, beat par, finish above half health", () => {
  const par = missionPar(164);
  assert.equal(par, 223);
  assert.equal(missionPar(372, true), 500);
  const grade = (elapsed, hpRatio, win = true) =>
    missionGrade({ win, elapsed, par, hpRatio }).stars;
  assert.equal(grade(200, 0.9), 3);
  assert.equal(grade(300, 0.9), 2);
  assert.equal(grade(300, 0.2), 1);
  assert.equal(grade(100, 1, false), 0);
});

test("the tally multiplies treasure by value and adds the star bonus", () => {
  const { rows, total } = rewardBreakdown({ money: 3, gold: 1, diamond: 1 }, 2);
  assert.deepEqual(
    rows.map((r) => [r.id, r.value]),
    [
      ["money", 30],
      ["gold", 25],
      ["diamond", 75],
      ["star", 2 * STAR_BONUS],
    ],
  );
  assert.equal(total, 150);
  assert.deepEqual(recordStars([1], 3, 2), [1, 0, 0, 2]);
  assert.deepEqual(recordStars([3], 0, 1), [3]);
});

test("weapon supplies cost credits once and survive save validation", () => {
  assert.deepEqual(
    SUPPLIES.map((s) => s.id),
    SUPPLY_IDS,
  );
  let save = { ...freshSave(), credits: 100 };
  save = buySupply(save, "machineGun");
  assert.equal(save.credits, 30);
  assert.deepEqual(save.loadout, ["machineGun"]);
  assert.deepEqual(buySupply(save, "machineGun").credits, 30);
  assert.deepEqual(buySupply(save, "laser").loadout, ["machineGun"]);
  const odd = validateSave({
    ...save,
    stars: [3, 9, -1, 1.5],
    loadout: ["laser", "laser", "nuke"],
  });
  assert.deepEqual(odd.stars, [3, 3, 0, 0]);
  assert.deepEqual(odd.loadout, ["laser"]);
});
