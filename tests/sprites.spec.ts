import { test, expect } from "@playwright/test";

test("phones default to the light 2.5D renderer; PCs stay 3D; Settings can switch", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.mode25d),
  ).toBe(false);
  await page.locator("#menu-settings").click();
  await page.locator('[data-view="25d"]').click();
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.mode25d),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("nightfall-prefs")!).view,
    ),
  ).toBe("25d");
  const phone = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await phone.newPage();
  await p.goto("/");
  await expect(p.locator("#deploy")).toBeEnabled();
  expect(
    await p.evaluate(() => (window as any).__nightfall.world.mode25d),
  ).toBe(true);
  await phone.close();
});

test("2.5D draws a crowded map as sprites with far fewer draw calls and keeps rigs intact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const r = await page.evaluate(async () => {
    const { game: g, world: w } = (window as any).__nightfall;
    w.setMode25d(true);
    await w.sprites.loading;
    g.start(14, { armor: 0, power: 0, mobility: 0 }, "crazy", 98765);
    // Compare the same scene: live AI/projectiles during an arbitrary RAF wait
    // changed this ratio with machine speed, especially after optimizing 3D.
    g.phase = "won";
    const e = g.enemies[Math.floor(g.enemies.length * 0.45)];
    g.pos.set(e.x, 0, e.z);
    w.cameraOverride = undefined;
    w.resetCamera(g.pos);
    const measure = (on: boolean) => {
      w.setMode25d(on);
      w.render(0, g.pos, false, true);
      w.render(1 / 60, g.pos, false, true);
      return w.renderer.info.render.calls;
    };
    const before = measure(false);
    const d25 = measure(true);
    const d3 = Math.max(before, measure(false));
    measure(true);
    const drawn = w.sprites.drawn;
    // After rendering, every rig is visible again for game logic.
    const rigs = g.enemies
      .filter((a: any) => a.hp > 0)
      .every((a: any) => a.mesh.visible || a.mesh.userData.lowRange);
    // A fallen body switches frame and fades instead of vanishing.
    const victim = g.enemies.find(
      (a: any) => !a.boss && !a.armored && a.hp > 0,
    );
    g.hurt(victim, 1e6);
    w.render(2 / 60, g.pos, false, true);
    const fallen =
      victim.mesh.userData.fallen === true && victim.mesh.userData.fade === 1;
    g.phase = "won";
    return { d3, d25, drawn, rigs, fallen };
  });
  expect(r.drawn).toBeGreaterThan(100);
  expect(r.d25 * 2, JSON.stringify(r)).toBeLessThan(r.d3);
  expect(r).toMatchObject({ rigs: true, fallen: true });
});
