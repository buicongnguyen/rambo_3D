import { test } from "node:test";
import assert from "node:assert/strict";
import {
  difficultyConfig,
  finaleRoster,
  STAGES,
  LEVEL_COUNT,
  WORLD_BOUNDS,
  terrainFactor,
} from "../src/campaign.mjs";
import {
  moveCircle,
  routeStep,
  validateSave,
  freshSave,
  advanceCampaign,
} from "../src/rules.mjs";
test("seven stages have 21 levels and exact soldier and boss multipliers", () => {
  assert.equal(STAGES.length, 7);
  assert.equal(LEVEL_COUNT, 21);
  assert.deepEqual(
    ["easy", "normal", "hard", "crazy"].map(
      (d) => difficultyConfig(d).soldiers,
    ),
    [1, 1, 2, 4],
  );
  assert.deepEqual(
    ["easy", "normal", "hard", "crazy"].map((d) => difficultyConfig(d).bosses),
    [1, 1, 2, 4],
  );
  assert.ok(
    difficultyConfig("easy").health > difficultyConfig("normal").health,
  );
  assert.equal(terrainFactor("sand"), 0.25);
});
test("finales use the stage lead and add its escort from Normal onward", () => {
  assert.deepEqual(finaleRoster(0, "normal"), ["gunship"]);
  assert.deepEqual(finaleRoster(0, "hard"), ["gunship", "gunship"]);
  for (const stage of [5, 6]) {
    const { boss, escort } = STAGES[stage];
    assert.deepEqual(finaleRoster(stage, "easy"), [boss]);
    assert.deepEqual(finaleRoster(stage, "story"), [boss]);
    assert.deepEqual(finaleRoster(stage, "normal"), [boss, escort]);
    assert.deepEqual(finaleRoster(stage, "hard"), [boss, escort]);
    assert.deepEqual(finaleRoster(stage, "crazy"), [
      boss,
      escort,
      boss,
      escort,
    ]);
  }
});
test("long map movement and navigation reach northern extraction without escaping bounds", () => {
  assert.equal(moveCircle(0, -80, 0, -50, 0.5, [], WORLD_BOUNDS).z, -114.5);
  assert.deepEqual(routeStep(0, -80, 0, -108, [], 0.5, WORLD_BOUNDS), {
    x: 0,
    z: -108,
  });
  const near = moveCircle(
    0,
    -60,
    0,
    -12,
    0.5,
    [{ x: 0, z: -65, w: 4, d: 1 }],
    WORLD_BOUNDS,
  );
  assert.ok(near.z > -64);
});
test("old campaign score migrates and new campaign completes only after 21 levels", () => {
  assert.deepEqual(
    validateSave({ version: 1, mission: 2, completed: true, best: 5100 }),
    { ...freshSave(), best: 5100 },
  );
  let s = freshSave();
  for (let i = 0; i < 20; i++) {
    s = advanceCampaign(s, "armor", 50);
    assert.equal(s.completed, false);
  }
  assert.equal(s.mission, 20);
  s = advanceCampaign(s, "armor", 55);
  assert.equal(s.completed, true);
});
