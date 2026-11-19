import { test } from "node:test";
import assert from "node:assert/strict";
import { AIR, LIGHT, NIGHT, gradeFor } from "../src/atmosphere.mjs";
import { STAGES } from "../src/campaign.mjs";
import { MISSIONS } from "../src/missions.ts";

test("every stage moves from day at level 1 to a lower, warmer dusk at its finale", () => {
  for (const { biome } of STAGES) {
    const { day, dusk } = LIGHT[biome];
    assert.ok(day && dusk, biome);
    assert.deepEqual(gradeFor(biome, 0), { ...day, heroLight: 0 }, biome);
    const last = gradeFor(biome, 2);
    assert.equal(last.key, dusk.key, biome);
    assert.ok(
      last.sun[1] < day.sun[1] || biome === "city",
      `${biome} sun sets`,
    );
    assert.ok(last.keyI < day.keyI, `${biome} key dims`);
    // The middle level is halfway, so the light falls as the stage goes on.
    const mid = gradeFor(biome, 1);
    assert.ok(mid.keyI < day.keyI && mid.keyI > last.keyI, biome);
  }
});

test("only the last finale is fought at night, and the moon keeps the fight readable", () => {
  const nights = MISSIONS.map((m, i) =>
    gradeFor(m.biome, m.level, m.finale && i === MISSIONS.length - 1),
  ).filter((g) => g === NIGHT);
  assert.equal(nights.length, 1);
  const weakestDay = Math.min(...Object.values(LIGHT).map((l) => l.day.keyI));
  assert.ok(NIGHT.keyI >= 0.45 * weakestDay, "moonlight floor");
  assert.ok(NIGHT.heroLight > 0);
  for (const { day, dusk } of Object.values(LIGHT))
    assert.equal(day.heroLight + dusk.heroLight, 0);
});

test("each biome has one bounded layer of motes", () => {
  for (const { biome } of STAGES) {
    const air = AIR[biome];
    assert.ok(air, biome);
    assert.ok(air.count > 0 && air.count <= 520, biome);
    assert.equal(air.vel.length, 3, biome);
    assert.ok(air.opacity > 0 && air.opacity <= 1, biome);
  }
});
