import { stickPoint } from "./stick-helper";
import { test, expect } from "@playwright/test";
test("renders Blender assets, accepts movement/fire, pauses and retries", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.screenshot({ path: "docs/briefing-desktop.png" });
  await page.locator("#deploy").click();
  await expect(page.locator("#hud")).toBeVisible();
  const z = await page.evaluate(() => (window as any).__nightfall.game.pos.z);
  await page.keyboard.down("KeyW");
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.pos.z), {
      timeout: 15000,
    })
    .toBeLessThan(z - 1);
  await page.keyboard.up("KeyW");
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.pos.z),
  ).toBeLessThan(z - 1);
  await page.keyboard.down("Space");
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo), {
      timeout: 15000,
    })
    .toBeLessThan(24);
  await page.keyboard.up("Space");
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.ammo),
  ).toBeLessThan(24);
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo), {
      timeout: 15000,
    })
    .toBe(24);
  expect(await page.evaluate(() => (window as any).__nightfall.game.ammo)).toBe(
    24,
  );
  await page.screenshot({ path: "docs/gameplay-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#resume")).toBeVisible();
  const elapsed = await page.evaluate(
    () => (window as any).__nightfall.game.elapsed,
  );
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.elapsed),
  ).toBe(elapsed);
  await page.locator("#resume").click();
  await page.evaluate(() => {
    (window as any).__nightfall.game.hp = 0;
  });
  await expect(page.locator("#result-primary")).toContainText("RETRY", {
    timeout: 20000,
  });
  await page.locator("#result-primary").click();
  await expect(page.locator("#hud")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__nightfall.game.hp)).toBe(
    150,
  );
  expect(errors).toEqual([]);
});
test("three levels progress through relay guards and finale bosses with persistent upgrades", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  for (let index = 0; index < 3; index++) {
    await page.locator("#deploy").click();
    const state = await page.evaluate(async (index) => {
      const h = (window as any).__nightfall,
        g = h.game;
      const { MISSIONS } = await import("/src/missions.ts");
      const m = MISSIONS[index];
      g.pos.set(m.objective.x, 0, m.objective.z);
      g.invincible = 1000;
      for (let i = 0; i < 300; i++)
        g.update(1 / 60, {
          ...h.input,
          x: 0,
          z: 0,
          fire: false,
          interact: false,
        });
      return { objective: g.objective, boss: g.boss?.max };
    }, index);
    expect(state.objective).toBe(true);
    if (index === 2) expect(state.boss).toBeGreaterThan(500);
    else expect(state.boss).toBeUndefined();
    // Controlled lethal projectile exercises real swept collision, damage and extraction, not a win flag.
    await page.evaluate(async (index) => {
      const h = (window as any).__nightfall,
        g = h.game;
      const { MISSIONS } = await import("/src/missions.ts");
      const boss = g.boss;
      if (boss) g.shoot(boss.x, boss.z, 0, false, boss.max + 1);
      else for (const guard of g.guardIds) g.hurt(guard, 999);
      g.update(1 / 60, {
        ...h.input,
        x: 0,
        z: 0,
        fire: false,
        interact: false,
      });
      const m = MISSIONS[index];
      g.pos.set(m.extract.x, 0, m.extract.z);
      for (let i = 0; i < 900 && g.phase === "playing"; i++)
        g.update(1 / 60, {
          ...h.input,
          x: 0,
          z: 0,
          fire: false,
          interact: false,
        });
    }, index);
    if (index < 3) {
      await expect(page.locator('[data-upgrade="armor"]')).toBeVisible();
      await page
        .locator(`[data-upgrade="${index === 0 ? "armor" : "power"}"]`)
        .click();
      await page.reload();
      await expect(page.locator("#deploy")).toBeEnabled();
      expect(
        await page.evaluate(() => (window as any).__nightfall.save.mission),
      ).toBe(index + 1);
    }
  }
});
test("mobile layout and touch input release", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: process.env.CI ? 0.5 : 1,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5177");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.screenshot({ path: "docs/briefing-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.locator("#deploy").tap();
  await expect(page.locator("#touch")).toBeVisible();
  const z = await page.evaluate(() => (window as any).__nightfall.game.pos.z);
  await page.locator("#move-pad").dispatchEvent("pointerdown", {
    pointerId: 1,
    button: 0,
    ...(await stickPoint(page, "up")),
  });
  await page.waitForTimeout(400);
  await page
    .locator("#move-pad")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.pos.z),
  ).toBeLessThan(z);
  await page.screenshot({ path: "docs/gameplay-mobile.png" });
  await context.close();
});

test("short opening can be completed on Easy through simulated movement and normal weapon damage", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator('[data-difficulty="easy"]').click();
  await page.locator("#deploy").click();
  const result = await page.evaluate(async () => {
    const h = (window as any).__nightfall,
      g = h.game;
    const { routeStep } = await import("/src/rules.mjs");
    const { COVER, MISSIONS } = await import("/src/missions.ts");
    const { WORLD_BOUNDS } = await import("/src/campaign.mjs");
    const m = MISSIONS[0];
    g.onSound = () => {};
    let next = { x: g.pos.x, z: g.pos.z };
    for (let frame = 0; frame < 18000 && g.phase === "playing"; frame++) {
      let target = !g.objective
        ? m.objective
        : !g.bossDead
          ? m.objective
          : m.extract;
      if (frame % 15 === 0)
        next = routeStep(
          g.pos.x,
          g.pos.z,
          target.x,
          target.z,
          [
            ...COVER,
            ...g.rides.filter((v: any) => v.hp > 0).map((v: any) => v.box),
          ],
          0.48,
          WORLD_BOUNDS,
        );
      const dx = next.x - g.pos.x,
        dz = next.z - g.pos.z,
        len = Math.hypot(dx, dz);
      let x = len > 0.25 ? dx / Math.max(1, len) : 0,
        z = len > 0.25 ? dz / Math.max(1, len) : 0;
      if (
        g.objective &&
        !g.bossDead &&
        Math.hypot(g.pos.x - target.x, g.pos.z - target.z) < 2
      ) {
        x = Math.sin(frame / 90) * 0.7;
        z = 0;
      }
      g.update(1 / 60, {
        ...h.input,
        x,
        z,
        fire: true,
        assist: true,
        interact: false,
        dodge: frame % 170 === 0,
        reload: false,
        swap: false,
      });
    }
    return {
      phase: g.phase,
      hp: g.hp,
      kills: g.kills,
      elapsed: g.elapsed,
      objective: g.objective,
      bossDead: g.bossDead,
      position: { x: g.pos.x, z: g.pos.z },
      companion: g.companion?.position.toArray(),
    };
  });
  console.log("Story route simulation:", result);
  expect(result.phase).toBe("won");
});

test("Retry appears promptly when rendering is throttled to two frames per second", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  await page.evaluate(() => {
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      nativeFrame(() => {
        setTimeout(() => callback(performance.now()), 500);
      });
    (window as any).__nightfall.game.hp = 0;
  });
  await expect(page.locator("#result-primary")).toContainText("RETRY", {
    timeout: 12000,
  });
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.phase),
  ).toBe("lost");
});
