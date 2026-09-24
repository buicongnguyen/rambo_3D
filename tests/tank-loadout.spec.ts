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
}

async function boardTank(page: Page) {
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
    const v = g.rides.find((r: any) => r.kind === "tank");
    v.mesh.position.set(15, 0, 20);
    v.heading = 0;
    g.pos.copy(v.mesh.position);
    g.useRide();
  });
}

test("tank and jeep crush moving infantry contacts once, respect cover and bosses; bike does not", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      swap: false,
      reload: false,
      dodge: false,
      interact: false,
    };
    const results = [];
    for (const kind of ["tank", "jeep", "motorcycle"]) {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
      COVER.length = 0;
      PATCHES.length = 0;
      g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.quakeTime = 100; // Hold infantry still to isolate vehicle contact.
      const v = g.rides.find((r: any) => r.kind === kind);
      v.mesh.position.set(15, 0, 20);
      v.heading = 0;
      g.pos.copy(v.mesh.position);
      g.useRide();
      const soldiers = g.enemies.slice(0, 2);
      soldiers.forEach((e: any, i: number) => {
        e.hp = 65;
        e.cool = 100;
        e.index = i * 2 + 1;
        e.x = 15 + i * 0.2;
        e.z = 20 + v.spec.radius + e.radius + 0.05;
        e.mesh.position.set(e.x, 0, e.z);
      });
      g.spawn(30, 20, true, 999, "laserTank");
      const boss = g.enemies.at(-1);
      boss.x = 15;
      boss.z = 20;
      boss.cool = 100;
      const bossHp = boss.hp;
      g.update(1 / 60, { ...cmd });
      const idleSafe = soldiers.every((e: any) => e.hp === 65);
      g.update(0.1, { ...cmd, z: 1 });
      const killed = soldiers.filter((e: any) => e.hp <= 0).length;
      const kills = g.kills,
        score = g.score;
      g.update(0.1, { ...cmd, z: 1 });
      const scoredOnce = g.kills === kills && g.score === score;
      const bossSafe = boss.hp === bossHp;
      const corpse = g.corpses[0];
      g.updatePresentation(3);
      const fading = corpse ? corpse.opacity > 0 && corpse.opacity < 1 : null;
      g.updatePresentation(1.1);
      const removed = corpse ? corpse.disposed && !corpse.mesh.parent : null;
      // Drive parallel to a thin wall while collision radii overlap a protected soldier.
      COVER.push({ x: 15, z: 23, w: 12, d: 0.1 });
      v.mesh.position.set(15, 0, 22.9 - v.spec.radius);
      v.speed = 0;
      v.heading = Math.PI / 2;
      g.pos.copy(v.mesh.position);
      const shielded = g.enemies[2];
      shielded.hp = 65;
      shielded.x = 15;
      shielded.z = 23.15;
      shielded.cool = 100;
      g.update(0.1, { ...cmd, x: 1 });
      results.push({
        kind,
        idleSafe,
        killed,
        scoredOnce,
        bossSafe,
        fading,
        removed,
        wallSafe: shielded.hp === 65,
        movedAlongWall: v.mesh.position.x > 15,
      });
    }
    return results;
  });
  for (const r of results) {
    expect(
      r.idleSafe &&
        r.scoredOnce &&
        r.bossSafe &&
        r.wallSafe &&
        r.movedAlongWall,
      JSON.stringify(r),
    ).toBe(true);
    expect(r.killed, r.kind).toBe(r.kind === "motorcycle" ? 0 : 2);
    if (r.kind !== "motorcycle") expect(r.fading && r.removed).toBe(true);
  }
});

test("tank sixteen-shell bank survives swaps, reload cancellation and dismount; empty cannon falls back", async ({
  page,
}) => {
  await ready(page);
  await boardTank(page);
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    const v = g.riding;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: true,
      swap: false,
      reload: false,
      dodge: false,
      interact: false,
    };
    const step = (n: number, extra = {}) => {
      for (let i = 0; i < n; i++) g.update(1 / 60, { ...cmd, ...extra });
    };
    const initial = v.ammo;
    step(1, { fire: true });
    const firstShot = {
      shells: v.ammo,
      personal: g.ammo,
      projectile: g.bullets.some((b: any) => b.spec?.visual === "rocket"),
    };
    step(1, { swap: true, fire: true });
    const switchLocked = g.ammo === 24 && v.ammo === 15;
    step(65);
    step(1, { fire: true });
    const rifleShot = g.ammo === 23 && v.ammo === 15;
    step(1, { reload: true });
    const reloading = g.reloadTime > 0;
    step(1, { swap: true });
    step(1, { swap: true }); // Back to cannon.
    const cancelled = !v.personalWeapon && g.reloadTime === 0;
    step(150, { reload: true });
    const shellsNotReloaded = v.ammo === 15 && g.reloadTime === 0;
    step(1, { swap: true });
    const magazinePreserved = g.weapon === 0 && g.ammo === 23;
    g.useRide();
    const exited = !g.riding && g.ammo === 23;
    g.pos.copy(v.mesh.position);
    g.useRide();
    // Boarding picks the strongest loaded option: the cannon outranks the rifle.
    const reboarded =
      g.riding === v && !v.personalWeapon && v.ammo === 15 && g.ammo === 23;
    step(65);
    for (let i = 0; i < 15; i++) {
      step(1, { fire: true });
      step(65);
    }
    const empty = v.ammo === 0 && !v.personalWeapon;
    // Limited frag grenades are never auto-equipped while the rifle has ammo.
    const fallbackAmmo = g.magazines[0]; // The held frag is not auto-fired.
    const frags = g.reserves[9] + g.magazines[9];
    step(1, { fire: true });
    step(20);
    step(1, { fire: true });
    const fallback =
      v.personalWeapon &&
      g.weapon === 0 &&
      g.ammo === fallbackAmmo - 1 &&
      g.reserves[9] + g.magazines[9] === frags &&
      v.ammo === 0;
    return {
      initial,
      firstShot,
      switchLocked,
      rifleShot,
      reloading,
      cancelled,
      shellsNotReloaded,
      magazinePreserved,
      exited,
      reboarded,
      empty,
      fallback,
    };
  });
  expect(result.initial).toBe(16);
  expect(result.firstShot).toEqual({
    shells: 15,
    personal: 24,
    projectile: true,
  });
  for (const [key, value] of Object.entries(result).slice(2))
    expect(value, key).toBe(true);
});

test("tank picks up and fires all eleven personal weapons with their own ammo and reserves", async ({
  page,
}) => {
  await ready(page);
  await boardTank(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    const v = g.riding;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: true,
      swap: false,
      reload: false,
      dodge: false,
      interact: false,
    };
    const hits = [];
    for (let index = 0; index < WEAPONS.length; index++) {
      const drop = g.weaponDrops.find((d: any) => d.index === index);
      if (drop) {
        drop.mesh.position.copy(v.mesh.position);
        g.update(1 / 60, { ...cmd });
      }
      {
        // Auto-equip may keep a stronger weapon; Q can still select every owned weapon.
        for (
          let i = 0;
          i < 13 && (!v.personalWeapon || g.weapon !== index);
          i++
        )
          g.update(1 / 60, { ...cmd, swap: true });
      }
      const selected = g.usesPersonalWeapon && g.weapon === index;
      for (let i = 0; i < 150; i++) g.update(1 / 60, { ...cmd });
      const target = g.enemies[0];
      target.hp = 10000;
      target.cool = 100;
      target.x = 20;
      target.z = 20;
      g.quakeTime = 100;
      const before = g.ammo;
      g.update(1 / 60, { ...cmd, fire: true });
      const spent = g.ammo === before - 1;
      for (let i = 0; i < 110; i++) g.update(1 / 60, { ...cmd });
      hits.push({
        id: WEAPONS[index].id,
        selected,
        spent,
        damage: 10000 - target.hp,
        shells: v.ammo,
      });
      target.hp = 0;
    }
    // A special-weapon reload must consume only its finite reserve.
    g.weapon = 3;
    g.ammo = 0;
    g.reserves[3] = 2;
    g.reloadTime = 0;
    g.update(1 / 60, { ...cmd, reload: true });
    for (let i = 0; i < 130; i++) g.update(1 / 60, { ...cmd });
    return {
      hits,
      inventory: g.inventory.length,
      ammo: g.ammo,
      reserve: g.reserves[3],
      shells: v.ammo,
    };
  });
  expect(result).toMatchObject({
    inventory: 11,
    ammo: 2,
    reserve: 0,
    shells: 16,
  });
  for (const h of result.hits) {
    expect(h.selected && h.spent, JSON.stringify(h)).toBe(true);
    expect(h.damage, h.id).toBeGreaterThan(0);
    expect(h.shells).toBe(16);
  }
});

test("PC tank Q and visible swap button expose cannon and personal ammo", async ({
  page,
}) => {
  await ready(page);
  await boardTank(page);
  await expect(page.locator("#weapon-name")).toHaveText("TANK / CANNON");
  await expect(page.locator("#ammo")).toHaveText("16");
  await expect(page.locator("#ammo-reserve")).toHaveText("/ SHELLS");
  await expect(page.locator("#weapon-swap")).toBeEnabled();
  await page.keyboard.press("KeyQ");
  await expect(page.locator("#weapon-name")).toContainText("RIFLE");
  await expect(page.locator("#ammo")).toHaveText("24");
  await page.locator("#weapon-swap").click();
  await expect(page.locator("#weapon-name")).toContainText(
    "FRAGMENTATION GRENADE",
  );
  await page.locator("#weapon-swap").click();
  await expect(page.locator("#weapon-name")).toHaveText("TANK / CANNON");
  await expect(page.locator("#ammo")).toHaveText("16");
  await page.screenshot({ path: test.info().outputPath("tank-cannon-pc.png") });
});

test("mobile tank SWAP and FIRE use the selected weapon in portrait and landscape", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 0.5,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    localStorage.setItem(
      "nightfall-prefs",
      JSON.stringify({ low: true, sound: false }),
    ),
  );
  await page.goto("http://127.0.0.1:5177");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").tap();
  await boardTank(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator("#weapon-name")).toHaveText("TANK / CANNON");
    const swap = page.locator('[data-action="swap"]');
    await expect(swap).toBeEnabled();
    await swap.tap();
    await expect(page.locator("#weapon-name")).toContainText("RIFLE");
    const before = await page.evaluate(
      () => (window as any).__nightfall.game.ammo,
    );
    await page
      .locator('[data-hold="fire"]')
      .dispatchEvent("pointerdown", { pointerId: 51 });
    await expect
      .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo))
      .toBeLessThan(before);
    await page
      .locator('[data-hold="fire"]')
      .dispatchEvent("pointercancel", { pointerId: 51 });
    await swap.tap();
    await expect(page.locator("#weapon-name")).toContainText(
      "FRAGMENTATION GRENADE",
    );
    await swap.tap();
    await expect(page.locator("#weapon-name")).toHaveText("TANK / CANNON");
    await expect(page.locator("#ammo")).toHaveText("16");
    const usable = await swap.evaluate((button) => {
      const r = button.getBoundingClientRect();
      return (
        r.width >= 44 &&
        r.height >= 44 &&
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) ===
          button
      );
    });
    expect(usable).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`tank-mobile-${viewport.width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await context.close();
});
