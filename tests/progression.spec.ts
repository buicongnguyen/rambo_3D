import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("opening kit, short relay objective and earned vehicles work through extraction", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    const initial = {
      inventory: [...g.inventory],
      grenades: g.magazines[9] + g.reserves[9],
      enemies: g.enemies.length,
      rides: g.rides.length,
      drops: g.weaponDrops.map((d: any) => d.index),
    };
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
      swap: false,
      interact: false,
    };
    g.invincible = 1000;
    g.pos.set(0, 0, -25);
    g.update(1 / 60, { ...cmd });
    for (let i = 0; i < 240; i++) g.update(1 / 60, { ...cmd });
    const guards = [...g.guardIds] as any[],
      blocked = !g.bossDead;
    for (const e of guards) g.hurt(e, 999);
    const opened = g.bossDead;
    g.pos.set(0, 0, -37);
    g.update(1 / 60, { ...cmd });
    const won = g.phase === "won";
    g.start(1, { armor: 0, power: 0, mobility: 0 }, "normal");
    const next = {
      enemies: g.enemies.length,
      rides: g.rides.map((v: any) => v.kind),
      weapons: g.weaponDrops.map((d: any) => d.index),
    };
    g.phase = "won";
    return { initial, guards: guards.length, blocked, opened, won, next };
  });
  expect(r).toMatchObject({
    initial: {
      inventory: [0, 9],
      grenades: 4,
      enemies: 12,
      rides: 0,
      drops: [9],
    },
    guards: 2,
    blocked: true,
    opened: true,
    won: true,
    next: { enemies: 49, rides: ["motorcycle", "jeep"], weapons: [1, 2, 5, 9] },
  });
});

test("enemies cannot track a concealed player and real rear impacts penetrate weak armor", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    COVER.length = 0;
    PATCHES.length = 0;
    g.rides = [];
    g.pickups = [];
    g.weaponDrops = [];
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.updateTerrainEvents = () => {};
    g.quakeTime = 0;
    g.invincible = 1000;
    const e = g.enemies[0];
    e.hp = 500;
    e.x = 0;
    e.z = 0;
    e.mesh.rotation.y = 0;
    e.alerted = false;
    e.memory = 0;
    e.cool = 10;
    g.pos.set(0, 0, -10);
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
      swap: false,
      interact: false,
    };
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd });
    const unseen = !e.alerted && Math.hypot(e.x, e.z) < 0.01;
    g.hurt(e, 28, WEAPONS[0], undefined, { x: 0, z: 1 });
    const rearDamage = 500 - e.hp,
      feedback = g.combatNotice.includes("REAR HIT");
    e.hp = 500;
    e.armored = true;
    e.mesh.rotation.y = 0;
    g.hurt(e, 28, WEAPONS[0], undefined, { x: 0, z: 1 });
    const rearArmor = 500 - e.hp;
    e.armored = false;
    e.x = 0;
    e.z = 0;
    e.mesh.rotation.y = 0;
    g.pos.set(0, 0, 10);
    g.update(1 / 60, { ...cmd });
    const seen = e.alerted && g.spotted;
    COVER.push({ x: 0, z: 5, w: 40, d: 2, kind: "screen", height: 2.4 });
    g.pos.set(4, 0, 10);
    g.update(1 / 60, { ...cmd });
    const remembered = { ...e.lastSeen },
      concealed = !g.spotted;
    for (let i = 0; i < 400; i++) g.update(1 / 60, { ...cmd });
    const expired = !e.alerted;
    g.phase = "won";
    return {
      unseen,
      rearDamage,
      feedback,
      rearArmor,
      seen,
      remembered,
      concealed,
      expired,
    };
  });
  expect(r).toMatchObject({
    unseen: true,
    rearDamage: 49,
    feedback: true,
    seen: true,
    remembered: { x: 0, z: 10 },
    concealed: true,
    expired: true,
  });
  expect(r.rearArmor).toBeCloseTo(18.2);
});

test("aimed frag clears low cover, lands with area damage and is stopped by tall cover", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, input, world: w } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const rows = [];
    for (const low of [true, false])
      for (const height of [1.3, 6]) {
        w.quality(low);
        g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
        COVER.length = 0;
        PATCHES.length = 0;
        g.rides = [];
        g.pickups = [];
        g.weaponDrops = [];
        g.updateTerrainEvents = () => {};
        g.quakeTime = 100;
        g.invincible = 1000;
        g.enemies.forEach((e: any) => (e.hp = 0));
        const e = g.enemies[0];
        e.hp = 200;
        e.x = 10;
        e.z = 0;
        e.mesh.position.set(10, 0, 0);
        COVER.push({ x: 4, z: 0, w: 1, d: 5, kind: "screen", height });
        g.coverCount = -1;
        g.pos.set(0, 0, 0);
        g.weapon = 9;
        g.ammo = 1;
        g.shotTime = 0;
        const cmd = {
          ...input,
          x: 0,
          z: 0,
          fire: false,
          assist: false,
          blast: false,
          swap: false,
          interact: false,
          aim: g.pos.clone().set(10, 0, 0),
        };
        g.update(1 / 60, { ...cmd, fire: true });
        let peak = 0,
          passed = false;
        for (let i = 0; i < 60; i++) {
          const b = g.bullets.find((b: any) => !b.enemy);
          if (b) {
            peak = Math.max(peak, b.mesh.position.y);
            passed ||= b.x > 5;
          }
          g.update(1 / 60, { ...cmd });
        }
        rows.push({
          low,
          height,
          peak,
          passed,
          damage: 200 - e.hp,
          spent: g.ammo === 0,
        });
      }
    g.phase = "won";
    return rows;
  });
  for (const r of rows) {
    expect(r.spent).toBe(true);
    if (r.height === 1.3) {
      expect(r.passed).toBe(true);
      expect(r.peak).toBeGreaterThan(3);
      expect(r.damage).toBeGreaterThan(60);
    } else {
      expect(r.passed).toBe(false);
      expect(r.damage).toBe(0);
    }
  }
});

test("mobile starter swap throws a grenade and enemy loot is bounded, collectable and expires", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 0.5,
  });
  const page = await context.newPage();
  await ready(page);
  await page.locator('[data-action="swap"]').tap();
  await expect(page.locator("#weapon-name")).toContainText(
    "FRAGMENTATION GRENADE",
  );
  await page
    .locator('[data-hold="fire"]')
    .dispatchEvent("pointerdown", { pointerId: 91 });
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.game.ammo))
    .toBe(0);
  await page
    .locator('[data-hold="fire"]')
    .dispatchEvent("pointercancel", { pointerId: 91 });
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    COVER.length = 0;
    PATCHES.length = 0;
    g.enemies = [];
    g.rides = [];
    g.pickups = [];
    g.weaponDrops = [];
    g.updateTerrainEvents = () => {};
    g.pos.set(0, 0, 0);
    g.invincible = 1000;
    g.elapsed = 0;
    const random = Math.random;
    try {
      Math.random = () => 0.1;
      for (let i = 0; i < 60; i++) {
        g.spawn(10, 0, false, i);
        g.hurt(g.enemies.at(-1), 999);
      }
    } finally {
      Math.random = random;
    }
    const count = g.pickups.length;
    g.hp = 100;
    g.pos.copy(g.pickups.at(-1).position);
    g.pickups.slice(0, -1).forEach((p: any) => p.position.set(15, 0, -20));
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
      swap: false,
      interact: false,
    };
    g.update(1 / 60, { ...cmd });
    const health = g.hp;
    g.elapsed = 46;
    g.update(1 / 60, { ...cmd });
    const remaining = g.pickups.length;
    g.phase = "won";
    return { count, health, remaining };
  });
  expect(r).toEqual({ count: 48, health: 115, remaining: 0 });
  await context.close();
});

test("moving enemy tank can turn and fire in all four compass directions", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const rows = [];
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
      COVER.length = 0;
      PATCHES.length = 0;
      g.rides = [];
      g.pickups = [];
      g.weaponDrops = [];
      g.updateTerrainEvents = () => {};
      g.quakeTime = 0;
      g.invincible = 1000;
      g.enemies.forEach((e: any) => (e.hp = 0));
      const e = g.enemies.find((e: any) => e.armored);
      e.hp = 1000;
      e.x = 0;
      e.z = -20;
      e.mesh.rotation.y = angle + 0.9;
      e.cool = 0.8;
      e.auxCool = 100;
      e.alerted = true;
      e.memory = 8;
      g.pos.set(Math.sin(angle) * 20, 0, -20 + Math.cos(angle) * 20);
      e.lastSeen = { x: g.pos.x, z: g.pos.z };
      const cmd = {
        ...input,
        x: 0,
        z: 0,
        fire: false,
        assist: false,
        blast: false,
        swap: false,
        interact: false,
      };
      let shots = 0;
      const shoot = g.shoot.bind(g);
      g.shoot = (...args: any[]) => {
        if (args[3] && args[4] === 36) shots++;
        return shoot(...args);
      };
      for (let i = 0; i < 360; i++) g.update(1 / 60, { ...cmd });
      g.shoot = shoot;
      rows.push({ angle, shots, moved: Math.hypot(e.x, e.z + 20) });
    }
    g.phase = "won";
    return rows;
  });
  for (const r of results) {
    expect(r.shots, JSON.stringify(r)).toBeGreaterThanOrEqual(1);
    expect(r.moved).toBeGreaterThan(0.5);
  }
});

test("loot refills finite weapon reserves and shields without creating new equipment", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    COVER.length = 0;
    PATCHES.length = 0;
    g.pickups = [];
    g.weaponDrops = [];
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.pos.set(0, 0, 0);
    g.invincible = 1000;
    g.inventory = [0, 9];
    g.reserves[9] = 0;
    g.magazines[9] = 0;
    g.weapon = 0;
    g.ammo = 12;
    g.shield = 0;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
      swap: false,
      interact: false,
    };
    const ammo = g.supplyCrate("ammo", 0, 0);
    ammo.userData.expires = g.elapsed + 45;
    g.pickups.push(ammo);
    g.update(1 / 60, { ...cmd });
    const reserve = g.reserves[9],
      selected = g.weapon,
      rifle = g.magazines[0];
    const shield = g.supplyCrate("shield", 0, 0);
    shield.userData.expires = g.elapsed + 45;
    g.pickups.push(shield);
    g.update(1 / 60, { ...cmd });
    const enemy = g.enemies[0];
    enemy.hp = 500;
    enemy.x = 10;
    enemy.z = 0;
    enemy.alerted = false;
    enemy.lastSeen = undefined;
    g.pos.set(-15, 0, 0);
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.blast(9, 0, WEAPONS[9], 80);
    const heard = { ...enemy.lastSeen };
    g.phase = "won";
    return {
      reserve,
      selected,
      rifle,
      shield: g.shield,
      inventory: g.inventory,
      heard,
    };
  });
  expect(r).toEqual({
    reserve: 1,
    selected: 9,
    rifle: 12,
    shield: 20,
    inventory: [0, 9],
    heard: { x: 9, z: 0 },
  });
});

test("a delayed bullet reveals its launch point rather than tracking a shooter behind cover", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    COVER.splice(0, COVER.length, {
      x: 8,
      z: 5,
      w: 2,
      d: 20,
      kind: "screen",
      height: 2.4,
    });
    PATCHES.length = 0;
    g.rides = [];
    g.pickups = [];
    g.weaponDrops = [];
    g.updateTerrainEvents = () => {};
    g.quakeTime = 100;
    g.invincible = 1000;
    g.enemies.forEach((e: any) => (e.hp = 0));
    const e = g.enemies[0];
    e.hp = 200;
    e.x = 0;
    e.z = 10;
    e.mesh.rotation.y = Math.PI / 2;
    e.lastSeen = undefined;
    g.shoot(0, 0, 0, false, 1, 10, WEAPONS[0]);
    g.pos.set(15, 0, 0);
    for (let i = 0; i < 80; i++)
      g.update(1 / 60, {
        ...input,
        x: 0,
        z: 0,
        fire: false,
        assist: false,
        blast: false,
        swap: false,
        interact: false,
      });
    g.phase = "won";
    return { hp: e.hp, known: e.lastSeen, player: { x: g.pos.x, z: g.pos.z } };
  });
  expect(r).toEqual({
    hp: 199,
    known: { x: 0, z: 0 },
    player: { x: 15, z: 0 },
  });
});
