import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("explosions survive dense contacts, downshift within budget, and fully expire", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const g = (window as any).__nightfall.game,
      fx = g.impacts;
    g.phase = "won";
    const modes = [];
    for (const low of [true, false]) {
      fx.clear();
      fx.emit(0, 1, 0, "fuel", low, 5.5, true);
      fx.update(0.15);
      for (let i = 0; i < 100; i++) fx.emit(i * 2, 1, 3, "tracer", low);
      const protectedBlast = fx.bursts.some(
        (b: any) => b.group.visible && b.blast && b.group.position.x === 0,
      );
      fx.update(1.3);
      const lingeringSmoke = fx.bursts.some(
        (b: any) =>
          b.group.visible && b.blast && b.smoke[0].material.opacity > 0,
      );
      const budget = fx.activeCount <= (low ? 12 : 28);
      fx.update(2);
      modes.push({
        protectedBlast,
        lingeringSmoke,
        budget,
        expired: fx.activeCount === 0,
      });
    }
    for (let i = 0; i < 28; i++) fx.emit(i * 2, 1, 0, "fuel", false, 2, true);
    fx.emit(0, 1, 5, "tracer", true);
    return { modes, downshift: fx.activeCount <= 12 };
  });
  expect(result).toEqual({
    modes: [0, 1].map(() => ({
      protectedBlast: true,
      lingeringSmoke: true,
      budget: true,
      expired: true,
    })),
    downshift: true,
  });
});

test("real bullets breach masonry, opening collision and emitting stone debris rather than leaves", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts"),
      { WEAPONS } = await import("/src/arsenal.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    const prop = g.world.destructibles.find(
      (p: any) => p.box.asset === "ruinWall",
    );
    const b = prop.box;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.pickups = [];
    g.weaponDrops = [];
    g.invincible = 1000;
    g.pos.set(b.x, 0, b.z + 4);
    g.quakeTime = 1000;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
    };
    const before = segmentBox(b.x, b.z + 4, b.x, b.z - 4, b) !== Infinity;
    for (let shot = 0; shot < 4; shot++) {
      g.shoot(b.x, b.z + 4, Math.PI, false, 28, 45, WEAPONS[0]);
      for (let f = 0; f < 9; f++) g.update(1 / 60, { ...cmd });
    }
    const breached =
      !COVER.includes(b) &&
      !g.liveCover.has(b) &&
      !g.world.destructibles.includes(prop) &&
      !prop.mesh.parent;
    const dust = g.impacts.bursts.some(
      (p: any) => p.kind === "stone" && p.group.visible,
    );
    const fragments = g.destruction.fragments.length > 0;
    g.phase = "won";
    return { before, breached, dust, fragments };
  });
  expect(result).toEqual({
    before: true,
    breached: true,
    dust: true,
    fragments: true,
  });
});

test("flank finishes and nested explosive chains grant one bounded tactical reward", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts"),
      { WEAPONS } = await import("/src/arsenal.ts");
    const enemy = g.enemies[0];
    enemy.mesh.rotation.y = 0;
    enemy.hp = 10;
    g.shield = 78;
    const initial = g.score;
    g.hurt(enemy, 28, WEAPONS[0], undefined, { x: 0, z: 1 });
    const flank = { score: g.score - initial, shield: g.shield };
    g.hurt(enemy, 999, WEAPONS[0], undefined, { x: 0, z: 1 });
    const once = g.score - initial === 150;
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    const props = g.world.destructibles
      .filter((p: any) => ["fuel", "explosive"].includes(p.kind))
      .slice(0, 2);
    props.forEach((p: any, i: number) => {
      p.box.x = i * 4;
      p.box.z = 0;
      p.mesh.position.set(i * 4, 0, 0);
    });
    g.world.destructibles = [...props];
    COVER.splice(0, COVER.length, ...props.map((p: any) => p.box));
    g.enemies.forEach((e: any, i: number) => {
      e.hp = i < 3 ? 1 : 0;
      e.x = [0, 6.5, 8][i] ?? 20;
      e.z = 1;
      e.mesh.position.set(e.x, 0, e.z);
    });
    g.pos.set(0, 0, 20);
    g.pickups = [];
    g.shield = 0;
    g.damageProp(props[0].box, 999);
    const chain = { kills: g.kills, score: g.score, shield: g.shield };
    g.damageProp(props[1].box, 999);
    const chainOnce = g.score === chain.score;
    g.phase = "won";
    return { flank, once, chain, chainOnce };
  });
  expect(result).toEqual({
    flank: { score: 150, shield: 80 },
    once: true,
    chain: { kills: 3, score: 450, shield: 10 },
    chainOnce: true,
  });
});

test("phone quick start hides advanced text but keeps controls accessible", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#controls-open").tap();
  await expect(page.locator(".manual-section")).toHaveCount(3);
  expect(await page.locator(".manual-section[open]").count()).toBe(0);
  await expect(page.getByText("Rifle ↔ frag grenade")).toBeVisible();
  await page.getByText("Smart moves & rewards", { exact: true }).tap();
  await expect(page.locator(".manual-section[open]")).toHaveCount(1);
  await page.locator("#close-manual").tap();
  await page.locator("#deploy").tap();
  await expect(page.locator("#move-pad")).toBeVisible();
  await expect(page.locator('[data-action="swap"]')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("arcade-phone.png") });
  await context.close();
});

test("fuel blasts break the facing wall while protecting the soldier behind it for that blast", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__nightfall.game;
    const { COVER } = await import("/src/missions.ts");
    const wall = g.world.destructibles.find(
      (p: any) => p.box.asset === "ruinWall",
    );
    const fuel = g.world.destructibles.find((p: any) => p.kind === "fuel");
    Object.assign(wall.box, { x: 2, z: 0, w: 0.45, d: 5 });
    wall.mesh.position.set(2, 0, 0);
    Object.assign(fuel.box, { x: 0, z: 0 });
    fuel.mesh.position.set(0, 0, 0);
    g.world.destructibles = [wall, fuel];
    COVER.splice(0, COVER.length, wall.box, fuel.box);
    g.enemies.forEach((e: any, i: number) => {
      e.hp = i ? 0 : 65;
      e.x = 4;
      e.z = 0;
    });
    g.pos.set(0, 0, 20);
    g.damageProp(fuel.box, 100);
    g.phase = "won";
    return {
      wallDestroyed: !COVER.includes(wall.box),
      protectedEnemy: g.enemies[0].hp === 65,
    };
  });
  expect(result).toEqual({ wallDestroyed: true, protectedEnemy: true });
});
