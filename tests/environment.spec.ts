import { test, expect } from "@playwright/test";
test("mud surfaces render without shader errors and transient effects expire", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const result = await page.evaluate(() => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    w.quality(false);
    g.start(18, { armor: 0, power: 0, mobility: 0 }, "story");
    g.onSound = () => {};
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.pos.set(0, 0.36, -14);
    g.spark(5, -12, true);
    const smoke = g.effects.filter((e: any) => e.smoke).length;
    for (let i = 0; i < 150; i++)
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    w.render(5, g.pos, false, false);
    return { smoke, effects: g.effects.length, water: !!w.water };
  });
  expect(result.smoke).toBe(8);
  expect(result.effects).toBe(0);
  expect(result.water).toBe(true);
  await page.screenshot({ path: "docs/environment-upgrade.png" });
  expect(errors).toEqual([]);
});
