import { test } from "node:test";
import assert from "node:assert/strict";
import { Feel, STREAK_WINDOW, streakLabel, hurtAngle } from "../src/feel.mjs";

test("kill streaks chain inside the window and reset after it", () => {
  const f = new Feel();
  f.kill(0);
  assert.equal(f.streak, 1);
  assert.equal(f.drain().banner, null);
  f.kill(1);
  assert.equal(f.drain().banner.label, "DOUBLE KILL");
  f.kill(1 + STREAK_WINDOW);
  assert.equal(f.drain().banner.label, "TRIPLE KILL");
  f.kill(10);
  assert.equal(f.streak, 1);
  assert.equal(f.bestStreak, 3);
  assert.equal(streakLabel(5), "RAMPAGE");
  assert.equal(streakLabel(9), "UNSTOPPABLE");
  assert.equal(streakLabel(20), "ONE-MAN ARMY");
});

test("hit-stop is brief, capped by a cooldown, and trauma stays in 0..1", () => {
  const f = new Feel();
  f.kill(0, 1);
  assert.equal(f.drain().banner.label, "COMMANDER DOWN");
  const first = f.hitStop;
  assert.ok(first > 0 && first <= 0.13);
  f.decay(first);
  f.kill(0.1);
  assert.equal(f.hitStop, 0, "automatic fire must not chain freezes");
  f.decay(1);
  f.kill(2);
  assert.ok(f.hitStop > 0);
  for (let i = 0; i < 20; i++) f.blast(0, 6);
  assert.equal(f.trauma, 1);
  f.decay(10);
  assert.equal(f.trauma, 0);
});

test("hit events are pooled and hurt angles point from player to source on screen", () => {
  const f = new Feel();
  for (let i = 0; i < 100; i++) f.hit(0, 1, 0, 12.4);
  const { hits } = f.drain();
  assert.equal(hits.length, 32);
  assert.equal(hits[0].damage, 12);
  assert.equal(f.drain().hits.length, 0);
  const p = { x: 0, z: 0 };
  assert.equal(hurtAngle(p, { x: 0, z: -5 }), 0); // Up-screen.
  assert.ok(Math.abs(hurtAngle(p, { x: 5, z: 0 }) - Math.PI / 2) < 1e-9);
  assert.equal(hurtAngle(p, undefined), null);
  assert.equal(hurtAngle(p, { x: 0.01, z: 0 }), null);
});
