import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
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
  await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    COVER.length = 0;
    PATCHES.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
    g.pos.set(15, 0, 20);
    g.quakeTime = 100;
  });
}

test("all eleven weapon hits create visible impact bursts, including elevated explosions", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      interact: false,
      swap: false,
      reload: false,
    };
    const target = g.enemies[0];
    const results = [];
    for (const low of [true, false]) {
      g.world.quality(low);
      for (const spec of WEAPONS) {
        for (const b of g.bullets) b.mesh.removeFromParent();
        g.bullets = [];
        g.impacts.clear();
        g.gas.forEach((c: any) => c.mesh.removeFromParent());
        g.gas = [];
        target.hp = 10000;
        target.x = 20;
        target.z = 20;
        target.cool = 100;
        target.mesh.position.set(20, spec.id === "missile" ? 5 : 0, 20);
        g.throwDistance = 5;
        g.fireWeapon(spec, Math.PI / 2);
        for (let i = 0; i < 130 && target.hp === 10000; i++)
          g.update(1 / 60, { ...cmd });
        const active = g.impacts.bursts.filter((b: any) => b.group.visible);
        results.push({
          low,
          id: spec.id,
          hit: target.hp < 10000,
          visible: active.some(
            (b: any) =>
              b.group.parent === g.world.actors && b.core.material.opacity > 0,
          ),
          kind: active.some((b: any) => b.kind === spec.visual),
          elevated:
            spec.id !== "missile" ||
            active.some((b: any) => b.blast && b.group.position.y === 6),
        });
      }
    }
    return results;
  });
  for (const r of result)
    expect(r.hit && r.visible && r.kind && r.elevated, JSON.stringify(r)).toBe(
      true,
    );
});

test("auto-equip selects strongest usable weapons without downgrades, ammo duplication or forced manual swaps", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      interact: false,
      swap: false,
      reload: false,
    };
    const take = (index: number) => {
      const d = g.weaponDrops.find((d: any) => d.index === index);
      d.mesh.position.copy(g.pos);
      g.update(1 / 60, { ...cmd });
    };
    take(8);
    const laser = g.weapon === 8;
    g.ammo = 0;
    g.update(1 / 60, { ...cmd, reload: true });
    take(2);
    take(10);
    const weakPickup = g.weapon === 8 && g.ammo === 0 && g.reloadTime > 0;
    for (let i = 0; i < 130; i++) g.update(1 / 60, { ...cmd });
    const reloaded = g.ammo === 8 && g.reserves[8] === 16;
    take(7);
    const stillBest = g.weapon === 8;
    g.update(1 / 60, { ...cmd, swap: true });
    const manualWeapon = g.weapon;
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd });
    const manual = manualWeapon === 2 && g.weapon === manualWeapon;
    // Collect another weaker gun to re-evaluate the complete owned inventory.
    take(3);
    const bestAgain = g.weapon === 8;
    g.ammo = 0;
    g.reserves[8] = 0;
    g.update(1 / 60, { ...cmd });
    const fallback = g.weapon === 7;
    g.ammo = 0;
    g.reserves[7] = 0;
    g.update(1 / 60, { ...cmd });
    const secondFallback = g.weapon === 2;
    const v = g.rides.find((v: any) => v.kind === "tank");
    v.mesh.position.copy(g.pos);
    g.useRide();
    take(4);
    const tankBest = !v.personalWeapon && v.ammo === 6;
    v.ammo = 0;
    v.cool = 0;
    g.shotTime = 0;
    g.update(1 / 60, { ...cmd, fire: true });
    const cannonFallback = v.personalWeapon && g.weapon === 2 && v.ammo === 0;
    // Cannon remains eligible even if every personal weapon is exhausted.
    g.inventory = [7, 8];
    g.weapon = 7;
    g.ammo = 0;
    g.magazines[8] = 0;
    g.reserves[8] = 0;
    v.ammo = 6;
    v.personalWeapon = true;
    g.update(1 / 60, { ...cmd });
    const cannonOnly = !v.personalWeapon && v.ammo === 6;
    return {
      cannonOnly,
      laser,
      weakPickup,
      reloaded,
      stillBest,
      manual,
      bestAgain,
      fallback,
      secondFallback,
      tankBest,
      cannonFallback,
    };
  });
  for (const [name, passed] of Object.entries(result))
    expect(passed, name).toBe(true);
});

test("impact pool stays bounded, fades cleanly and works after a mission restart", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const { game: g } = (window as any).__nightfall;
    const hp = g.hp;
    for (let i = 0; i < 400; i++) g.impacts.emit(i * 2, 1, 20, "flame", true);
    const low = g.impacts.activeCount <= 12 && g.impacts.capacity <= 12;
    for (let i = 0; i < 400; i++) g.impacts.emit(i * 2, 1, 20, "laser", false);
    const high = g.impacts.activeCount <= 28 && g.impacts.capacity <= 28;
    g.impacts.update(2);
    const cleared = g.impacts.activeCount === 0;
    const capacity = g.impacts.capacity;
    const cosmetic = g.hp === hp;
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.impacts.emit(15, 1, 20, "tracer", true);
    const restarted =
      g.impacts.activeCount === 1 &&
      g.impacts.capacity === capacity &&
      g.impacts.bursts.some(
        (b: any) => b.group.visible && b.group.parent === g.world.actors,
      );
    g.cleanup();
    return {
      low,
      high,
      cleared,
      cosmetic,
      restarted,
      cleanup: g.impacts.activeCount === 0,
    };
  });
  for (const [name, passed] of Object.entries(result))
    expect(passed, name).toBe(true);
});

test("impact visuals remain readable in both graphics modes", async ({
  page,
}) => {
  await ready(page);
  for (const low of [true, false]) {
    await page.evaluate((low) => {
      const { game: g, world: w } = (window as any).__nightfall;
      w.quality(low);
      g.phase = "won";
      g.impacts.clear();
      g.pos.set(15, 0, 20);
      g.impacts.emit(12, 1.1, 18, "tracer", low, 0.85);
      g.impacts.emit(15, 1.1, 18, "flame", low, 1.05);
      g.impacts.emit(18, 1.1, 18, "laser", low, 0.85);
      g.impacts.emit(15, 0.6, 12, "rocket", low, 3.2, true);
      g.impacts.update(0.08);
    }, low);
    await page.screenshot({
      path: test.info().outputPath(`impacts-${low ? "low" : "high"}.png`),
    });
  }
});
