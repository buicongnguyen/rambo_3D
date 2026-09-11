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
test("all three objective/boss/extraction transitions and upgrades persist", async ({
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
      g.update(1 / 60, { ...h.input, x: 0, z: 0, fire: false, interact: true });
      return { objective: g.objective, boss: g.boss?.max };
    }, index);
    expect(state.objective).toBe(true);
    expect(state.boss).toBeGreaterThan(500);
    // Controlled lethal projectile exercises real swept collision, damage and extraction, not a win flag.
    await page.evaluate(async (index) => {
      const h = (window as any).__nightfall,
        g = h.game;
      const { MISSIONS } = await import("/src/missions.ts");
      const boss = g.boss;
      g.shoot(boss.x, boss.z, 0, false, boss.max + 1);
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
    if (index < 2) {
      await expect(page.locator('[data-upgrade="armor"]')).toBeVisible();
      await page
        .locator(`[data-upgrade="${index === 0 ? "armor" : "power"}"]`)
        .click();
      await page.reload();
      await expect(page.locator("#deploy")).toBeEnabled();
      expect(
        await page.evaluate(() => (window as any).__nightfall.save.mission),
      ).toBe(index + 1);
    } else {
      await expect(page.locator(".modal h2")).toHaveText(
        "Everyone comes home.",
      );
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("nightfall-campaign")!).completed,
        ),
      ).toBe(true);
    }
  }
});
test("mobile layout and touch input release", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
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
  await page
    .locator('[data-hold="up"]')
    .dispatchEvent("pointerdown", { pointerId: 1 });
  await page.waitForTimeout(400);
  await page
    .locator('[data-hold="up"]')
    .dispatchEvent("pointercancel", { pointerId: 1 });
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.pos.z),
  ).toBeLessThan(z);
  await page.screenshot({ path: "docs/gameplay-mobile.png" });
  await context.close();
});

test("story mission can be completed through simulated movement and normal weapon damage", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator('[data-difficulty="story"]').click();
  await page.locator("#deploy").click();
  const result = await page.evaluate(async () => {
    const h = (window as any).__nightfall,
      g = h.game;
    const { routeStep } = await import("/src/rules.mjs");
    const { COVER, MISSIONS } = await import("/src/missions.ts");
    const m = MISSIONS[0];
    g.onSound = () => {};
    let next = { x: g.pos.x, z: g.pos.z };
    for (let frame = 0; frame < 18000 && g.phase === "playing"; frame++) {
      let target = !g.objective
        ? m.objective
        : !g.bossDead
          ? { x: 0, z: -7 }
          : m.extract;
      if (frame % 15 === 0)
        next = routeStep(g.pos.x, g.pos.z, target.x, target.z, COVER);
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
        interact: true,
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
