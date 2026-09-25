import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("allies engage visible hostiles on their own but never through walls", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const cmd = { ...input, x: 0, z: 0, fire: false, assist: false };
    const out = [];
    for (const blocked of [false, true]) {
      g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.invincible = 1e6;
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.prisons = [];
      COVER.length = PATCHES.length = 0;
      if (blocked)
        COVER.push({ x: 0, z: 5, w: 50, d: 0.6, kind: "building", height: 3 });
      g.pos.set(-12, 0, 0);
      g.squad.clear();
      g.squad.add(0, 0);
      const e = g.enemies[0];
      Object.assign(e, { hp: 400, x: 0, z: 10, cool: 1e6, alerted: false });
      e.mesh.position.set(0, 0, 10);
      for (let i = 0; i < 90; i++) g.update(1 / 60, { ...cmd });
      out.push({ blocked, damage: 400 - e.hp });
    }
    g.phase = "won";
    return out;
  });
  expect(r[0].damage).toBeGreaterThan(20); // Player held fire; the ally engaged.
  expect(r[1].damage).toBe(0);
});

test("command bosses expose weak points in downtime and enrage at half health", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.start(2, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.invincible = 1e6;
    g.spawn(g.pos.x, g.pos.z - 20, true, 10000, "spider");
    const boss = g.enemies.at(-1);
    boss.hp = boss.max = 1000;
    boss.state = "CLIMBING";
    g.hurt(boss, 100, WEAPONS[0]);
    const normal = 1000 - boss.hp;
    boss.state = "RESTING";
    const exposed = g.bossExposed(boss);
    const before = boss.hp;
    g.hurt(boss, 100, WEAPONS[0]);
    const weak = before - boss.hp;
    boss.state = "CLIMBING";
    g.hurt(boss, boss.hp - 400, WEAPONS[0]);
    return { normal, weak, exposed, enraged: !!boss.enraged };
  });
  expect(r).toEqual({ normal: 100, weak: 150, exposed: true, enraged: true });
  await expect(page.locator("#boss-phase")).toContainText("ENRAGED");
  await page.evaluate(() => ((window as any).__nightfall.game.phase = "won"));
});

test("dying after the relay offers a retry that restores the checkpoint", async ({
  page,
}) => {
  await ready(page);
  const before = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const cmd = { ...input, x: 0, z: 0, fire: false, assist: false };
    g.invincible = 1e6;
    // Kill two patrols and bank a treasure before reaching the relay.
    g.hurt(g.enemies[0], 999, WEAPONS[0]);
    g.hurt(g.enemies[1], 999, WEAPONS[0]);
    const treasure = g.treasures[0];
    g.pos.copy(treasure.position);
    g.update(1 / 60, { ...cmd });
    const relay = MISSIONS[0].objective;
    g.pos.set(relay.x, 0, relay.z);
    for (let i = 0; i < 5 && !g.objective; i++) g.update(1 / 60, { ...cmd });
    return {
      objective: g.objective,
      checkpoint: !!g.checkpoint,
      credits: g.credits,
      score: g.score,
    };
  });
  expect(before.objective && before.checkpoint).toBe(true);
  expect(before.credits).toBeGreaterThan(0);
  // Defeat: the result screen offers the relay retry first.
  await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.phase = "lost";
    g.onEnd(false);
  });
  await expect(page.locator("#result-checkpoint")).toBeVisible();
  await expect(page.locator("#result-primary")).toContainText("RETRY");
  await page.locator("#result-checkpoint").click();
  const after = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    const relay = MISSIONS[0].objective;
    return {
      phase: g.phase,
      objective: g.objective,
      guards: g.pendingGuards,
      dead: [g.enemies[0].hp <= 0, g.enemies[1].hp <= 0, g.enemies[2].hp > 0],
      credits: g.credits,
      score: g.score,
      nearRelay: Math.hypot(g.pos.x - relay.x, g.pos.z - relay.z) < 3,
      marker: g.world.marker.visible,
    };
  });
  expect(after).toEqual({
    phase: "playing",
    objective: true,
    guards: expect.any(Number),
    dead: [true, true, true],
    credits: before.credits,
    score: before.score,
    nearRelay: true,
    marker: false,
  });
  expect(after.guards).toBeGreaterThan(0);
  await page.evaluate(() => ((window as any).__nightfall.game.phase = "won"));
});
