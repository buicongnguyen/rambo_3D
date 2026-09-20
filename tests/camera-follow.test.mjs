import test from "node:test";
import assert from "node:assert/strict";
import { followAxis } from "../src/camera-follow.mjs";
test("camera remains stationary inside dead zone and never overshoots", () => {
  for (const x of [-4, -2, 0, 2, 4])
    assert.equal(followAxis(0, x, 4, 1 / 60), 0);
  let a = 0;
  for (let i = 0; i < 600; i++) {
    const next = followAxis(a, 20, 4, 1 / 60);
    assert.ok(next >= a && next <= 16);
    a = next;
  }
  assert.ok(Math.abs(a - 16) < 1e-8);
});
test("camera smoothing is independent of render frequency", () => {
  const simulate = (fps) => {
    let a = 0;
    for (let i = 0; i < fps; i++) a = followAxis(a, 20, 4, 1 / fps);
    return a;
  };
  assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-9);
  assert.equal(followAxis(7, 20, 4, 0), 7);
});
