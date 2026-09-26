import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Director,
  INTRO,
  SLOWMO,
  combatTarget,
  smoothIntensity,
  healthMuffle,
} from "../src/director.mjs";
import { themeStems, composeTheme, COMBAT_VOICES } from "../src/music.mjs";

const run = (d, seconds, player = { x: 0, z: 0 }) => {
  const frames = [];
  for (let t = 0; t < seconds; t += 1 / 60)
    frames.push(d.update(1 / 60, player));
  return frames;
};

test("the boss intro holds the simulation, pans to the bosses, names them and returns", () => {
  const d = new Director();
  d.startIntro({ x: 30, z: -40 });
  const frames = run(d, INTRO.pan + INTRO.hold + INTRO.back + 0.1);
  assert.ok(
    frames.slice(0, -10).every((f) => f.hold),
    "holds throughout",
  );
  const mid = frames[Math.round((INTRO.pan + 0.5) * 60)];
  assert.deepEqual(
    { x: mid.camera.x, z: mid.camera.z, card: mid.card },
    { x: 30, z: -40, card: true },
  );
  assert.ok(mid.camera.zoom < 1);
  const last = frames.at(-1);
  assert.deepEqual([last.hold, last.camera, last.card], [false, null, false]);
  assert.equal(d.busy, false);
  // Input skips straight to the pan back, but never in the first 0.4 s.
  d.startIntro({ x: 30, z: -40 });
  run(d, 0.2);
  d.skipIntro();
  assert.ok(d.intro.t < 0.4);
  run(d, 0.3);
  d.skipIntro();
  assert.ok(run(d, INTRO.back + 0.05).at(-1).hold === false);
});

test("reduced motion keeps the name card but never holds, pans or slows", () => {
  const d = new Director();
  d.startIntro({ x: 30, z: -40 }, true);
  d.startSlowmo({ x: 5, z: 5 }, true);
  const frames = run(d, 1);
  assert.ok(frames.every((f) => !f.hold && !f.camera && f.scale === 1));
  assert.ok(frames[10].card);
});

test("the final kill plays at quarter speed, leans the camera in, then eases back", () => {
  const d = new Director();
  d.startSlowmo({ x: 10, z: 0 });
  const frames = run(d, SLOWMO.seconds + 0.05);
  const mid = frames[Math.round(0.6 * 60)];
  assert.equal(mid.scale, SLOWMO.scale);
  assert.ok(mid.camera.x > 5 && mid.camera.x <= 10 * SLOWMO.lean + 1e-9);
  assert.ok(mid.slow > 0.9);
  assert.ok(frames.at(-2).scale > 0.9, "eases back to full speed");
  assert.equal(frames.at(-1).camera, null);
  // Game time during the beat is well under the real time it takes.
  const game = frames.reduce((n, f) => n + f.scale / 60, 0);
  assert.ok(game < SLOWMO.seconds * 0.45);
});

test("music intensity rises fast in a fight, settles slowly, and low health muffles", () => {
  assert.equal(
    combatTarget({ alertedNear: 0, sinceCombat: 99, spotted: false }),
    0,
  );
  assert.equal(
    combatTarget({ alertedNear: 6, sinceCombat: 0, spotted: true }),
    1,
  );
  const mid = combatTarget({ alertedNear: 2, sinceCombat: 5, spotted: false });
  assert.ok(mid > 0.3 && mid < 0.8);
  let up = 0,
    down = 1;
  for (let i = 0; i < 10; i++) {
    up = smoothIntensity(up, 1, 0.1);
    down = smoothIntensity(down, 0, 0.1);
  }
  assert.ok(up > 0.8, "one second of combat is nearly full");
  assert.ok(down > 0.7, "one second of calm barely lowers it");
  assert.equal(healthMuffle(0.8), 0);
  assert.equal(healthMuffle(0.35), 0);
  assert.equal(healthMuffle(0.1), 1);
});

test("stage themes split into phase-locked base and combat stems", () => {
  const full = composeTheme("jungle");
  const { base, combat } = themeStems("jungle");
  assert.equal(base.seconds, full.seconds);
  assert.equal(combat.seconds, full.seconds);
  assert.ok(base.events.every((e) => !COMBAT_VOICES.has(e.voice)));
  assert.ok(
    base.events.some((e) => e.voice === "flute"),
    "melody stays calm",
  );
  const drums = full.events.filter((e) => COMBAT_VOICES.has(e.voice)).length;
  assert.ok(
    combat.events.filter((e) => COMBAT_VOICES.has(e.voice)).length === drums,
  );
  assert.ok(
    combat.events.some((e) => e.voice === "brass"),
    "battle stabs",
  );
  assert.equal(base.events.length + drums, full.events.length);
});
