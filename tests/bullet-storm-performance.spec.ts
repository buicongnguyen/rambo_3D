import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("all stages deploy mixed dense patrols and dense combat stays bounded in both graphics profiles", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const result = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    const stages = [];
    for (let index = 0; index < 21; index++) {
      g.start(index, { armor: 0, power: 0, mobility: 0 }, "normal");
      const soldiers = g.enemies.filter((e: any) => !e.armored && !e.boss),
        tanks = g.enemies.filter((e: any) => e.armored);
      stages.push({
        index,
        infantry: soldiers.length,
        tanks: tanks.length,
        trees: COVER.filter((b: any) => b.scale === 0.65).length,
        clear: g.enemies.every(
          (e: any) =>
            !COVER.some((b: any) =>
              Number.isFinite(segmentBox(e.x, e.z, e.x, e.z, b, e.radius)),
            ),
        ),
      });
    }
    const profiles = [];
    for (const low of [true, false]) {
      w.quality(low);
      g.start(14, { armor: 0, power: 3, mobility: 3 }, "crazy");
      g.invincible = 10000;
      g.quakeTime = 0;
      const e = g.enemies[Math.floor(g.enemies.length * 0.45)];
      g.pos.set(e.x, 0, e.z);
      g.inventory = [0, 1, 2];
      g.activateTurbo();
      const durations = [];
      let maxBullets = 0;
      for (let frame = 0; frame < 120; frame++) {
        const start = performance.now();
        g.update(1 / 60, {
          ...input,
          x: 0,
          z: 0,
          assist: true,
          fire: true,
          interact: false,
          swap: false,
          turbo: false,
        });
        durations.push(performance.now() - start);
        maxBullets = Math.max(maxBullets, g.bullets.length);
      }
      w.render(g.elapsed, g.pos, false, true);
      durations.sort((a, b) => a - b);
      profiles.push({
        low,
        population: g.enemies.length,
        active: g.enemies.filter(
          (e: any) => e.hp > 0 && Math.hypot(e.x - g.pos.x, e.z - g.pos.z) < 30,
        ).length,
        meanUpdateMs: durations.reduce((a, b) => a + b, 0) / durations.length,
        p95UpdateMs: durations[Math.floor(durations.length * 0.95)],
        maxBullets,
        drawCalls: w.renderer.info.render.calls,
        triangles: w.renderer.info.render.triangles,
        fragments: g.destruction.fragments.length,
        corpses: g.corpses.length,
      });
    }
    g.phase = "won";
    return {
      stages,
      profiles,
      renderer: w.renderer
        .getContext()
        .getParameter(w.renderer.getContext().RENDERER),
    };
  });
  writeFileSync(
    "docs/bullet-storm-validation.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  for (const row of result.stages) {
    expect(row.clear, JSON.stringify(row)).toBe(true);
    expect(row.infantry).toBeGreaterThanOrEqual(
      row.index === 0 ? 12 : row.index === 1 ? 48 : 96,
    );
    expect(row.infantry % 4).toBe(0);
    expect(row.tanks).toBeGreaterThanOrEqual(
      row.index === 0 ? 0 : row.index === 1 ? 1 : 3,
    );
    expect(row.trees).toBeGreaterThan(0);
  }
  for (const row of result.profiles) {
    expect(row.population).toBe(660);
    expect(row.drawCalls).toBeLessThan(row.low ? 1500 : 2000);
    expect(row.maxBullets).toBeGreaterThan(10);
    expect(row.fragments).toBeLessThanOrEqual(row.low ? 64 : 144);
    expect(row.corpses).toBeLessThanOrEqual(row.low ? 32 : 64);
  }
  expect(errors).toEqual([]);
  console.log("Bullet Storm profile:", JSON.stringify(result.profiles));
  await page.screenshot({ path: "docs/bullet-storm.png" });
});
