import { test, expect } from "@playwright/test";
test("Low reduces rendered detail and preserves the mission when switching", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const before = await page.evaluate(() => {
    const { world: w, game: g } = (window as any).__nightfall;
    w.quality(false);
    w.render(0, g.pos, false, false);
    return { triangles: w.renderer.info.render.triangles, hp: g.hp };
  });
  await page.locator("#pause").click();
  await page.locator("#setting-low").selectOption("low");
  const low = await page.evaluate(() => {
    const { world: w, game: g } = (window as any).__nightfall;
    w.render(0, g.pos, false, false);
    g.spark(0, 0, true);
    return {
      triangles: w.renderer.info.render.triangles,
      hp: g.hp,
      low: w.lowDetail,
      shadows: w.renderer.shadowMap.enabled,
      smoke: g.effects.filter((e: any) => e.smoke).length,
    };
  });
  expect(low.low).toBe(true);
  expect(low.shadows).toBe(false);
  expect(low.triangles).toBeLessThan(before.triangles * 0.8);
  expect(low.hp).toBe(before.hp);
  expect(low.smoke).toBe(2);
  await page.locator("#setting-low").selectOption("high");
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.lowDetail),
  ).toBe(false);
  await page.reload();
  await expect(page.locator("#deploy")).toBeEnabled();
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.lowDetail),
  ).toBe(false);
});
