import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("the last kill ends the stage, the debrief grades stars and banks treasure plus the star bonus", async ({
  page,
}) => {
  await ready(page);
  const phase = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.invincible = 1000;
    g.loot = { money: 2, gold: 1, diamond: 1 };
    g.credits = 2 * 10 + 25 + 75;
    // Kill every hostile for real: no pending guards, so the stage is clear.
    for (const e of g.enemies) if (e.hp > 0) g.hurt(e, 999, WEAPONS[0]);
    g.update(1 / 60, { ...(window as any).__nightfall.input, fire: false });
    return g.phase;
  });
  expect(phase).toBe("won");
  await expect(page.locator(".grade-star")).toHaveCount(3);
  const earned = await page.locator(".grade-star.earned").count();
  expect(earned).toBeGreaterThanOrEqual(1);
  await expect(page.locator(".tally-row")).toHaveCount(4);
  const banked = Number(
    await page.locator("#banked").getAttribute("data-total"),
  );
  expect(banked).toBe(120 + earned * 10);
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-campaign")!),
  );
  expect(save).toMatchObject({ mission: 1, credits: banked, loadout: [] });
  expect(save.stars[0]).toBe(earned);
  // Quartermaster: buy a supply drop, then it is delivered at deployment.
  await page.locator('[data-upgrade="armor"]').click();
  await expect(page.locator(".card-stars").first()).toContainText(
    `★ ${earned}/9`,
  );
  await page.locator("#field-shop").click();
  await expect(page.locator(".shop-card")).toHaveCount(6);
  await page.locator('[data-buy="machineGun"]').click();
  await expect(page.locator('[data-buy="machineGun"]')).toBeDisabled();
  const afterBuy = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-campaign")!),
  );
  expect(afterBuy).toMatchObject({
    credits: banked - 70,
    loadout: ["machineGun"],
  });
  await page.locator("#close-shop").click();
  await page.locator("#deploy").click();
  const deployed = await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.phase = "won";
    return { inventory: g.inventory, weapon: g.weapon };
  });
  expect(deployed.inventory).toContain(2);
  expect(deployed.weapon).toBe(2); // The M249 outranks the starter rifle.
});

test("volcano rockfalls are fewer and give a longer warning", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.start(4, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.invincible = 1e6;
    g.eventClock = 0.001;
    g.update(1 / 60, { ...input, fire: false });
    const rocks = g.hazards.filter((h: any) => h.rock);
    const warning = Math.max(...rocks.map((h: any) => h.time));
    const next = g.eventClock;
    g.phase = "won";
    return { count: rocks.length, warning, next };
  });
  expect(r.count).toBeLessThanOrEqual(2);
  expect(r.warning).toBeGreaterThan(2.9);
  expect(r.next).toBeGreaterThan(8);
});
