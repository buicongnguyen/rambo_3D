import { test, expect } from "@playwright/test";
test("enemies relocate behind close cover, retreat, separate, and respect shot windup", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  await page.evaluate(() =>
    (window as any).__nightfall.game.start(
      3,
      { armor: 0, power: 0, mobility: 0 },
      "normal",
    ),
  );
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.onSound = () => {};
    g.invincible = 1000;
    const e = g.enemies[0];
    g.enemies = g.enemies.slice(0, 1);
    g.pos.set(-7, 0, 13.4);
    e.x = -7;
    e.z = 16.6;
    e.cool = 0;
    e.alerted = true;
    e.memory = 8;
    e.lastSeen = { x: g.pos.x, z: g.pos.z };
    g.update(1 / 60, { ...cmd });
    const hiddenWarning = e.warn.visible,
      hiddenShots = g.bullets.length;
    for (let i = 0; i < 420; i++) g.update(1 / 60, { ...cmd });
    const relocated = Math.hypot(e.x + 7, e.z - 16.6);
    g.pos.set(0, 0, 23);
    e.x = 0;
    e.z = 21;
    e.cool = 10;
    for (let i = 0; i < 90; i++) g.update(1 / 60, { ...cmd });
    const retreat = Math.hypot(e.x, e.z - 23);
    g.spawn(e.x, e.z, false, 1);
    const other = g.enemies[1];
    for (let i = 0; i < 90; i++) g.update(1 / 60, { ...cmd });
    return {
      hiddenWarning,
      hiddenShots,
      relocated,
      retreat,
      separation: Math.hypot(e.x - other.x, e.z - other.z),
    };
  });
  expect(result.hiddenWarning).toBe(false);
  expect(result.hiddenShots).toBe(0);
  expect(result.relocated).toBeGreaterThan(2);
  expect(result.retreat).toBeGreaterThan(3);
  expect(result.separation).toBeGreaterThan(0.8);
});
