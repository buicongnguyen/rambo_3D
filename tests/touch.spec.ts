import { test, expect } from "@playwright/test";
test("mobile buttons work with simultaneous touches and survive cancellation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5177");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").tap();
  for (const selector of [
    '[data-action="swap"]',
    '[data-action="reload"]',
    '[data-action="dodge"]',
    '[data-action="interact"]',
    '[data-hold="fire"]',
    "#pause",
  ])
    await expect(page.locator(selector)).toBeVisible();
  const center = async (s: string) => {
    const b = await page.locator(s).boundingBox();
    return { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
  };
  const cdp = await context.newCDPSession(page),
    up = await center('[data-hold="up"]'),
    fire = await center('[data-hold="fire"]');
  const before = await page.evaluate(
    () => (window as any).__nightfall.game.pos.z,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { ...up, id: 1 },
      { ...fire, id: 2 },
    ],
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo))
    .toBeLessThan(24);
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.pos.z))
    .toBeLessThan(before);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [{ ...up, id: 1 }],
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.input.z))
    .toBe(0);
  expect(
    await page.evaluate(() => (window as any).__nightfall.input.fire),
  ).toBe(true);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.input.fire))
    .toBe(false);
  await page.locator('[data-action="swap"]').tap();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.weapon))
    .toBe(1);
  await page.evaluate(() => {
    (window as any).__nightfall.game.ammo = 1;
  });
  await page.locator('[data-action="reload"]').tap();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo))
    .toBe(6);
  await page
    .locator('[data-hold="up"]')
    .dispatchEvent("pointerdown", { pointerId: 40 });
  await page.locator('[data-action="dodge"]').tap();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__nightfall.game.dashCooldown),
    )
    .toBeGreaterThan(0);
  await page
    .locator('[data-hold="up"]')
    .dispatchEvent("pointercancel", { pointerId: 40 });
  await page.evaluate(() => {
    (window as any).__nightfall.game.pos.set(15, 0, 0);
  });
  await page.locator('[data-action="interact"]').tap();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.objective))
    .toBe(true);
  await page.locator("#pause").tap();
  await expect(page.locator("#resume")).toBeVisible();
  await page.locator("#resume").tap();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const usable = await page.locator("#touch button").evaluateAll((buttons) =>
      buttons.every((b) => {
        const r = b.getBoundingClientRect();
        return (
          r.width >= 44 &&
          r.height >= 44 &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b
        );
      }),
    );
    expect(usable).toBe(true);
  }
  await context.close();
});
