import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}
test("all three vehicles board, move with wheels, fire, retain ammo and eject safely", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.onSound = () => {};
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: true,
      interact: false,
    };
    const results = [];
    for (let index = 0; index < 3; index++) {
      g.start(0, { armor: 0, power: 0, mobility: 0 }, "story");
      g.enemies.forEach((e: any) => (e.hp = 0));
      const v = g.rides[index];
      g.pos.copy(v.mesh.position);
      g.update(1 / 60, { ...cmd, interact: true });
      const boarded = g.riding === v && !g.player.visible;
      const initial = v.mesh.position.clone();
      for (let i = 0; i < 90; i++) g.update(1 / 60, { ...cmd, x: 0, z: 1 });
      const moved = v.mesh.position.distanceTo(initial),
        wheel = v.wheels.some((w: any) => Math.abs(w.rotation.x) > 0.01);
      const ammo = index === 0 ? g.ammo : v.ammo;
      g.update(1 / 60, { ...cmd, fire: true });
      const fired = (index === 0 ? g.ammo : v.ammo) < ammo;
      const hp = g.hp;
      g.takeDamage(10);
      const protectedPlayer = g.hp === hp && v.hp === v.spec.hp - 10;
      g.update(1 / 60, { ...cmd, interact: true });
      const exited = !g.riding && g.player.visible;
      const exitDistance = Math.hypot(
        g.pos.x - v.mesh.position.x,
        g.pos.z - v.mesh.position.z,
      );
      g.pos.copy(v.mesh.position);
      g.useRide();
      const remaining = v.ammo;
      // Test the actual armor boundary instead of assuming a fixed hit is lethal.
      g.takeDamage(v.hp - 1);
      const lastArmorProtects = g.riding === v && v.hp === 1 && g.hp === hp;
      g.takeDamage(1);
      const destroyed =
        !g.riding && g.player.visible && v.hp === 0 && g.corpses.length > 0;
      results.push({
        boarded,
        moved,
        wheel,
        fired,
        protectedPlayer,
        exited,
        exitDistance,
        radius: v.spec.radius,
        destroyed,
        lastArmorProtects,
        remaining,
      });
    }
    return results;
  });
  for (const r of results) {
    expect(r.boarded).toBe(true);
    expect(r.moved).toBeGreaterThan(1);
    expect(r.wheel).toBe(true);
    expect(r.fired).toBe(true);
    expect(r.protectedPlayer).toBe(true);
    expect(r.exited).toBe(true);
    expect(r.exitDistance).toBeGreaterThan(r.radius);
    expect(r.lastArmorProtects).toBe(true);
    expect(r.destroyed).toBe(true);
  }
});
test("vehicle extended map boundaries and mission restart preserve valid state", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.start(1, { armor: 0, power: 0, mobility: 0 }, "story");
    g.enemies.forEach((e: any) => (e.hp = 0));
    const v = g.rides[1];
    v.mesh.position.set(-5, 0, -110);
    g.pos.copy(v.mesh.position);
    g.useRide();
    v.heading = Math.PI;
    for (let i = 0; i < 180; i++)
      g.update(1 / 60, { ...input, x: 0, z: -1, fire: false, interact: false });
    const stopped = v.mesh.position.z >= -115 + v.spec.radius - 0.05;
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "story");
    return {
      stopped,
      reset: !g.riding && g.player.visible && g.rides.length === 3,
    };
  });
  expect(r.stopped).toBe(true);
  expect(r.reset).toBe(true);
});
test("eleven collectible weapons shoot distinct projectiles and respect finite reserves", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.onSound = () => {};
    g.invincible = 1000;
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    for (const drop of [...g.weaponDrops]) {
      g.pos.copy(drop.mesh.position);
      g.update(1 / 60, { ...cmd });
    }
    const count = g.inventory.length;
    const hits = [];
    for (let index = 0; index < WEAPONS.length; index++) {
      for (const b of g.bullets) g.world.actors.remove(b.mesh);
      g.bullets = [];
      g.pos.set(15, 0, 20);
      const enemy = g.enemies[0];
      g.enemies.forEach((e: any) => (e.hp = 0));
      enemy.hp = 10000;
      enemy.x = 20;
      enemy.z = 20;
      enemy.cool = 999;
      g.weapon = index;
      g.showWeapon();
      g.fireWeapon(WEAPONS[index], Math.PI / 2);
      for (let t = 0; t < 100; t++) {
        enemy.x = 20;
        enemy.z = 20;
        g.update(1 / 60, { ...cmd });
      }
      hits.push({ id: WEAPONS[index].id, damage: 10000 - enemy.hp });
    }
    g.weapon = 3;
    g.ammo = 0;
    g.reserves[3] = 2;
    g.reloadTime = 0;
    g.update(1 / 60, { ...cmd, reload: true });
    for (let i = 0; i < 130; i++) g.update(1 / 60, { ...cmd });
    return { count, hits, ammo: g.ammo, reserve: g.reserves[3] };
  });
  expect(results.count).toBe(11);
  for (const hit of results.hits) expect(hit.damage, hit.id).toBeGreaterThan(0);
  expect(results.ammo).toBe(2);
  expect(results.reserve).toBe(0);
});

test("empty special weapon falls back and laser cannot penetrate solid cover", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall,
      { WEAPONS } = await import("/src/arsenal.ts");
    g.inventory = [0, 1, 7];
    g.weapon = 7;
    g.ammo = 0;
    g.reserves[7] = 0;
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, interact: false });
    const fallback = g.weapon;
    g.enemies.forEach((e: any) => (e.hp = 0));
    const target = g.enemies[0];
    target.hp = 500;
    target.x = 0;
    target.z = 4;
    const { COVER } = await import("/src/missions.ts");
    COVER.push({ x: -4, z: 4, w: 3, d: 2 });
    g.pos.set(-10, 0, 4);
    g.fireWeapon(WEAPONS[8], Math.PI / 2);
    const blocked = target.hp;
    g.pos.set(-1, 0, 4);
    g.fireWeapon(WEAPONS[8], Math.PI / 2);
    return { fallback, blocked, clear: target.hp };
  });
  expect(r.fallback).toBe(0);
  expect(r.blocked).toBe(500);
  expect(r.clear).toBeLessThan(500);
});

test("riders collect nearby weapons and supplies without losing mounted ammo", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    const results = [];
    for (let index = 0; index < 3; index++) {
      g.start(0, { armor: 0, power: 0, mobility: 0 }, "story");
      g.enemies.forEach((e: any) => (e.hp = 0));
      const v = g.rides[index];
      v.mesh.position.set(15, 0, 20);
      g.pos.copy(v.mesh.position);
      g.useRide();
      const drop = g.weaponDrops[0],
        weapon = drop.index;
      drop.mesh.position.set(15 + v.spec.radius + 0.4, 0.7, 20);
      const supply = drop.mesh.clone();
      g.world.actors.add(supply);
      g.pickups.push(supply);
      const ammo = v.ammo;
      const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
      g.update(1 / 60, { ...cmd });
      const keptAtFull = g.pickups.includes(supply);
      v.hp -= 20;
      g.hp -= 15;
      g.update(1 / 60, { ...cmd });
      results.push({
        collected:
          g.inventory.includes(weapon) && !g.weaponDrops.includes(drop),
        keptAtFull,
        repaired: v.hp === v.spec.hp,
        healed: g.hp === g.maxHp,
        consumed: !g.pickups.includes(supply),
        mountedAmmo: v.ammo === ammo,
        stillRiding: g.riding === v,
      });
    }
    return results;
  });
  for (const r of results)
    for (const value of Object.values(r)) expect(value).toBe(true);
});
