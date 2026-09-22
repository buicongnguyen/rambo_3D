import { test, expect } from "@playwright/test";
async function ready(page: any) {
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

test("every rotated mission preserves exact Crazy patrols, clear vehicle starts and roadside quotas", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    return MISSIONS.map((m: any, index: number) => {
      g.start(index, { armor: 0, power: 0, mobility: 0 }, "crazy");
      const patrols = 24 + m.level * 4 + (m.biome === "city" ? 8 : 0);
      const expected =
        index < 3
          ? [48, 100, 264][index]
          : patrols * 16 + Math.max(3, Math.floor(patrols / 8)) * 4;
      return {
        index,
        count: g.enemies.length,
        expected,
        weapons: g.weaponDrops.length,
        health: g.pickups.filter((p: any) => p.userData.kind === "health")
          .length,
        shield: g.pickups.filter((p: any) => p.userData.kind === "shield")
          .length,
        carsClear: g.rides.every((v: any) =>
          COVER.every(
            (b: any) =>
              segmentBox(
                v.mesh.position.x,
                v.mesh.position.z,
                v.mesh.position.x,
                v.mesh.position.z,
                b,
                v.spec.radius,
              ) === Infinity,
          ),
        ),
        soldiersClear: g.enemies.every((e: any) =>
          COVER.every(
            (b: any) =>
              segmentBox(e.x, e.z, e.x, e.z, b, e.radius) === Infinity,
          ),
        ),
      };
    });
  });
  for (const row of rows) {
    expect(row.count, JSON.stringify(row)).toBe(row.expected);
    expect(row).toMatchObject({
      weapons: row.index === 0 ? 2 : row.index === 1 ? 4 : 9,
      health: row.index < 2 ? 2 : 6,
      shield: row.index === 0 ? 1 : row.index === 1 ? 2 : 5,
      carsClear: true,
      soldiersClear: true,
    });
  }
});

test("shield crates absorb personal damage, remain at capacity and preserve vehicle armor rules", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.enemies.forEach((e: any) => (e.hp = 0));
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    const crates = g.pickups.filter((p: any) => p.userData.kind === "shield");
    g.pos.copy(crates[0].position);
    g.update(1 / 60, { ...cmd });
    const gained = g.shield;
    g.takeDamage(15);
    const absorbed = { hp: g.hp, shield: g.shield };
    g.takeDamage(40);
    const overflow = { hp: g.hp, shield: g.shield };
    g.shield = 80;
    g.pos.copy(crates[1].position);
    g.update(1 / 60, { ...cmd });
    const kept = g.pickups.includes(crates[1]);
    const v = g.rides[2];
    g.pos.copy(v.mesh.position);
    g.useRide();
    const armor = v.hp;
    g.takeDamage(10);
    const vehicle = { shield: g.shield, armorLost: armor - v.hp };
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    return { gained, absorbed, overflow, kept, vehicle, reset: g.shield };
  });
  expect(result).toEqual({
    gained: 40,
    absorbed: { hp: 150, shield: 25 },
    overflow: { hp: 135, shield: 0 },
    kept: true,
    vehicle: { shield: 80, armorLost: 10 },
    reset: 0,
  });
  await expect(page.locator("#shield-text")).toHaveText(
    "SHIELD 0 · ALLIES 0 · ¤0",
  );
});

test("boss light volleys are frequent and heavy salvos warn, cover broad areas and respect cover", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    COVER.length = 0;
    PATCHES.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.spawn(0, 10, true, 100);
    const boss = g.boss;
    boss.cool = 0;
    boss.auxCool = 100; // Isolate the primary volley; the independent light gun has its own regression.
    g.elapsed = 0;
    for (let i = 0; i < 160; i++) g.updateBoss(boss, 0.01);
    const light = { bullets: g.bullets.length, damage: g.bullets[0].damage };
    boss.volleys = 5;
    boss.cool = 0;
    g.updateBoss(boss, 0.01);
    const warned = {
      count: g.hazards.length,
      radius: g.hazards[0].radius,
      hp: g.hp,
      cool: boss.cool,
    };
    for (const b of g.bullets) g.world.actors.remove(b.mesh);
    g.bullets = [];
    boss.cool = 100;
    const h = g.hazards[1];
    g.hazards.forEach((h: any) => (h.time = 100));
    h.time = 0.01;
    g.pos.set(h.x + 2.8, 0, h.z);
    g.invincible = 0;
    g.update(1 / 60, { ...cmd });
    const wideDamage = 150 - g.hp;
    g.bossSalvo(boss, 0);
    const covered = g.hazards.at(-2);
    g.hazards.forEach((h: any) => (h.time = 100));
    covered.time = 0.01;
    g.pos.set(covered.x + 2.8, 0, covered.z);
    COVER.push({ x: covered.x + 1.4, z: covered.z, w: 0.3, d: 4 });
    g.invincible = 0;
    const hp = g.hp;
    g.update(1 / 60, { ...cmd });
    const coverSafe = g.hp === hp;
    g.hurt(boss, 100000);
    g.update(1 / 60, { ...cmd });
    const canceled = g.hazards.length === 0;
    return { light, warned, wideDamage, coverSafe, canceled };
  });
  expect(result.light).toEqual({ bullets: 9, damage: 12 });
  expect(result.warned).toEqual({ count: 3, radius: 3.4, hp: 150, cool: 4.4 });
  expect(result.wideDamage).toBe(28);
  expect(result.coverSafe && result.canceled).toBe(true);
});

test("heavy laser warning matches its wide hit zone and concrete blocks damage", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    g.start(12, { armor: 0, power: 0, mobility: 0 }, "normal");
    COVER.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.spawn(0, 10, true, 100);
    const boss = g.boss;
    boss.cool = 1.1;
    boss.laserAim = 0;
    g.pos.set(1.8, 0, 20);
    g.invincible = 0;
    g.updateBoss(boss, 0.01);
    const warning = { width: boss.beam.scale.x * 0.1, hp: g.hp };
    g.pos.set(-2, 0, 20);
    g.updateBoss(boss, 0.1);
    const lockedFacing = Math.abs(boss.mesh.rotation.y) < 0.00001;
    g.pos.set(1.8, 0, 20);
    g.updateBoss(boss, 1.2);
    const hit = 150 - g.hp;
    boss.x = 0;
    boss.z = 10;
    boss.cool = 0.01;
    boss.laserAim = 0;
    g.invincible = 0;
    COVER.push({ x: 0, z: 15, w: 5, d: 1 });
    const hp = g.hp;
    g.updateBoss(boss, 0.02);
    return { warning, hit, blocked: g.hp === hp, lockedFacing };
  });
  expect(result).toEqual({
    warning: { width: 3.2, hp: 150 },
    hit: 32,
    blocked: true,
    lockedFacing: true,
  });
});

test("rotated crates, tents and towers remain inside their collision footprint", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { coverModel } = await import("/src/world.ts");
    const { routeBox } = await import("/src/routes.mjs");
    const T = await import("/tests/scene-fixtures.ts");
    return [0, 1, 2, 3].flatMap((layout) =>
      ["crate", "tent", "tower"].map((asset) => {
        const box = routeBox(layout, {
          x: 4,
          z: 12,
          w: asset === "tent" ? 4 : 3,
          d: asset === "tent" ? 4 : asset === "tower" ? 3 : 2,
          asset,
        });
        const root = coverModel(box, layout),
          bounds = new T.Box3().setFromObject(root);
        return {
          layout,
          asset,
          inside:
            bounds.min.x >= box.x - box.w / 2 - 0.05 &&
            bounds.max.x <= box.x + box.w / 2 + 0.05 &&
            bounds.min.z >= box.z - box.d / 2 - 0.05 &&
            bounds.max.z <= box.z + box.d / 2 + 0.05,
        };
      }),
    );
  });
  expect(
    result.every((r) => r.inside),
    JSON.stringify(result),
  ).toBe(true);
});
