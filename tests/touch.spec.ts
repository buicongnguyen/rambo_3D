import { stickPoint } from "./stick-helper";
import { test, expect } from "@playwright/test";
test("mobile buttons work with simultaneous touches and survive cancellation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: process.env.CI ? 0.5 : 1,
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
    up = await stickPoint(page, "up").then((p) => ({
      x: p.clientX,
      y: p.clientY,
    })),
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
    .toBe(9);
  await page.evaluate(() => {
    (window as any).__nightfall.game.ammo = 0;
  });
  await page.locator('[data-action="reload"]').tap();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.reserves[9]),
  ).toBe(2);
  await page.locator("#move-pad").dispatchEvent("pointerdown", {
    pointerId: 40,
    button: 0,
    ...(await stickPoint(page, "up")),
  });
  await page.locator('[data-action="dodge"]').tap();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__nightfall.game.dashCooldown),
    )
    .toBeGreaterThan(0);
  await page
    .locator("#move-pad")
    .dispatchEvent("pointercancel", { pointerId: 40 });
  await page.evaluate(async () => {
    const { MISSIONS } = await import("/src/missions.ts");
    const g = (window as any).__nightfall.game;
    g.dashTime = 0;
    g.iceVelocity.set(0, 0);
    g.invincible = 1000;
    (window as any).__nightfall.game.pos.set(
      MISSIONS[0].objective.x,
      0,
      MISSIONS[0].objective.z,
    );
  });
  // Proximity secures the relay without a tap, even on a touch device.
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
    await expect(page.locator("#radio")).toBeHidden();
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

test("PC Q shortcut and visible swap button both cycle the loadout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const swap = page.locator("#weapon-swap");
  await expect(swap).toBeVisible();
  await expect(swap).toContainText("Q - SWAP WEAPON");
  await page.keyboard.press("KeyQ");
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.weapon))
    .toBe(9);
  await swap.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.weapon))
    .toBe(0);
  await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.pos.copy(g.rides[1].mesh.position);
    g.useRide();
  });
  // The jeep's mounted gun joins the loadout, so Q still cycles weapons.
  await expect(swap).toBeEnabled();
  await expect(swap).toContainText("Q - SWAP WEAPON");
  // Q cycles carried weapons and the mounted gun: press until it is up.
  const name = page.locator("#weapon-name");
  for (let i = 0; i < 3; i++) {
    const shown = (await name.textContent())!;
    if (shown.includes("MOUNTED")) break;
    await swap.click();
    await expect(name).not.toHaveText(shown);
  }
  await expect(name).toHaveText("JEEP / MOUNTED SHOTGUN");
});
