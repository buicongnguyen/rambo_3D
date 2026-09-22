import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { ENEMY_WEAPONS } = await import("/src/arsenal.ts");
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    for (const e of g.enemies) {
      e.mesh.removeFromParent();
      e.warn.removeFromParent();
    }
    g.enemies = [];
    g.rides = [];
    g.squad.clear();
    g.prisons = [];
    g.treasures = [];
    g.pickups = [];
    g.weaponDrops = [];
    g.world.destructibles = [];
    COVER.length = 0;
    PATCHES.length = 0;
    g.coverCount = -1;
    g.updateTerrainEvents = () => {};
    g.onSound = () => {};
    g.onRadio = () => {};
    g.shield = 0;
    g.hp = 200;
    g.invincible = 0;
    g.quakeTime = 0;
    g.pos.set(0, 0, 8);
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      dodge: false,
      swap: false,
      interact: false,
      blast: false,
      turbo: false,
      reload: false,
    };
    const step = (frames: number) => {
      g.phase = "playing";
      for (let i = 0; i < frames; i++) g.update(1 / 60, { ...cmd });
      g.phase = "won";
    };
    const spawn = (role: string, x = 0, z = 0) => {
      const e = g.spawn(
        x,
        z,
        false,
        g.enemies.length * 4,
        undefined,
        false,
        undefined,
        role,
      );
      e.mesh.rotation.y = 0;
      e.cool = 0;
      return e;
    };
    (window as any).infantryFixture = {
      g,
      COVER,
      step,
      spawn,
      cmd,
      ENEMY_WEAPONS,
    };
    g.phase = "won";
  });
}

test("knife rushers need an alarm, run with articulated legs and investigate last-seen cover", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, COVER, step, spawn } = (window as any).infantryFixture;
    const e = spawn("rusher");
    g.pos.set(0, 0, -12);
    step(30);
    const idle = !e.alerted && Math.hypot(e.x, e.z) < 0.01;
    g.hurt(e, 1, undefined, undefined, undefined, { x: 0, z: -12 });
    step(30);
    const run = {
      moved: Math.hypot(e.x, e.z),
      pose: e.motion.state,
      legs:
        e.motion.joints.get("ThighL").node.quaternion.toArray().join() !==
        e.motion.joints.get("ThighR").node.quaternion.toArray().join(),
    };
    COVER.push({ x: 0, z: -5, w: 4, d: 1, kind: "screen", height: 3 });
    g.pos.set(0, 0, -14);
    step(20);
    const remembered = { ...e.lastSeen };
    const outsideWall = Math.abs(e.x) > 2.5 || Math.abs(e.z + 5) > 1;
    return { idle, run, remembered, outsideWall };
  });
  expect(r.idle).toBe(true);
  expect(r.run.moved).toBeGreaterThan(2);
  expect(r.run.pose).toBe("run");
  expect(r.run.legs).toBe(true);
  expect(r.remembered).toEqual({ x: 0, z: -12 });
  expect(r.outsideWall).toBe(true);
});

test("melee windup is stationary and causes one hit, with real wall and sidestep evasion", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, COVER, step, spawn } = (window as any).infantryFixture;
    const e = spawn("rusher");
    g.pos.set(0, 0, 1.6);
    step(27);
    const warning = {
      hp: g.hp,
      visible: e.warn.visible,
      pose: e.motion.state,
      z: e.z,
    };
    step(30);
    const damage = 200 - g.hp;
    step(25);
    const repeated = 200 - g.hp;
    e.hp = 0;
    e.mesh.removeFromParent();
    e.warn.removeFromParent();
    const sword = spawn("swordsman", 5, 0);
    g.pos.set(5, 0, 2.3);
    g.hp = 200;
    g.invincible = 0;
    step(25);
    const fixedAim = sword.attack.aim;
    g.pos.set(7.2, 0, 1);
    step(38);
    const dodged = g.hp === 200;
    sword.attack = undefined;
    sword.cool = 0;
    sword.mesh.rotation.y = 0;
    g.pos.set(sword.x, 0, sword.z + 2.3);
    step(20);
    COVER.push({
      x: sword.x,
      z: sword.z + 1.2,
      w: 5,
      d: 0.25,
      kind: "screen",
      height: 3,
    });
    step(50);
    const wallSafe = g.hp === 200 && !sword.attack;
    return { warning, damage, repeated, dodged, wallSafe, fixedAim };
  });
  expect(r.warning).toMatchObject({
    hp: 200,
    visible: true,
    pose: "windup",
    z: 0,
  });
  expect(r.damage).toBe(10);
  expect(r.repeated).toBe(10);
  expect(r.dodged).toBe(true);
  expect(r.wallSafe).toBe(true);
  expect(r.fixedAim).toBeCloseTo(0);
});

test("thrown knives use swept collisions, visible spinning blades, finite range and no gun flash", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, COVER, step, spawn, ENEMY_WEAPONS } = (window as any)
      .infantryFixture;
    const e = spawn("thrower");
    step(30);
    const warned = e.warn.visible && g.bullets.length === 0;
    step(18);
    const b = g.bullets.find((b: any) => b.spec?.id === "enemyKnife");
    const launch = {
      actualBlade: b?.mesh.type === "Group",
      spin: b?.mesh.children[0].rotation.x,
      life: b?.maxLife,
      flashes: g.effects.length,
      count: g.bullets.length,
    };
    e.hp = 0;
    step(60);
    const damage = 200 - g.hp;
    g.hp = 200;
    g.invincible = 0;
    g.pos.set(0, 0, 8);
    COVER.push({ x: 0, z: 4, w: 5, d: 1, kind: "screen", height: 3 });
    g.shoot(0, 0, 0, true, 10, 11, ENEMY_WEAPONS.knife);
    step(70);
    const coverSafe = g.hp === 200 && g.bullets.length === 0;
    COVER.length = 0;
    g.shoot(20, 0, 0, true, 10, 11, ENEMY_WEAPONS.knife);
    step(100);
    return {
      warned,
      launch,
      damage,
      coverSafe,
      expired: g.bullets.length === 0,
    };
  });
  expect(r.warned).toBe(true);
  expect(r.launch).toMatchObject({
    actualBlade: true,
    life: 1.6,
    flashes: 0,
    count: 1,
  });
  expect(r.launch.spin).toBeGreaterThan(0);
  expect(r.damage).toBe(10);
  expect(r.coverSafe).toBe(true);
  expect(r.expired).toBe(true);
});

test("rocket aim locks, caps include live rockets, and sidestepping avoids the blast", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, step, spawn } = (window as any).infantryFixture;
    const a = spawn("rocketeer"),
      b = spawn("rocketeer", 3, 0);
    b.mesh.rotation.y = Math.atan2(-3, 8);
    step(30);
    const aiming = g.enemies.filter(
      (e: any) => e.attack && !e.attack.fired,
    ).length;
    const line = a.warn.visible && a.warn.scale.y === 8;
    g.pos.set(5, 0, 8);
    step(39);
    const rocket = g.bullets.find((b: any) => b.spec?.id === "enemyRocket");
    const locked =
      rocket && Math.abs(rocket.vx) < 0.001 && rocket.damage === 24;
    let maxPressure = 0;
    for (let i = 0; i < 90; i++) {
      step(1);
      maxPressure = Math.max(
        maxPressure,
        g.enemies.filter((e: any) => e.attack && !e.attack.fired).length +
          g.bullets.filter((b: any) => b.spec?.id === "enemyRocket").length,
      );
    }
    const safe = g.hp === 200;
    return { aiming, line, locked, maxPressure, safe };
  });
  expect(r.aiming).toBe(1);
  expect(r.line).toBe(true);
  expect(r.locked).toBe(true);
  expect(r.maxPressure).toBeLessThanOrEqual(1);
  expect(r.safe).toBe(true);
});

test("death and tremors cancel specialist windups; retry removes attacks and airborne gear", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, step, spawn } = (window as any).infantryFixture;
    const e = spawn("rocketeer");
    step(35);
    g.hurt(e, 999);
    step(60);
    const deathSafe = g.bullets.length === 0 && !e.warn.parent;
    const sword = spawn("swordsman", 4, 0);
    g.pos.set(4, 0, 2.3);
    step(30);
    g.quakeTime = 1;
    step(30);
    const quakeSafe = !sword.attack && !sword.warn.visible && g.hp === 200;
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.phase = "won";
    return {
      deathSafe,
      quakeSafe,
      reset: g.bullets.length === 0 && g.enemies.every((e: any) => !e.attack),
    };
  });
  expect(r).toEqual({ deathSafe: true, quakeSafe: true, reset: true });
});

test("melee respects tank armor and soldier variants share batchable gear", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, step, spawn } = (window as any).infantryFixture;
    const e = spawn("swordsman");
    g.pos.set(0, 0, 3.8);
    // Use the real occupied-vehicle damage path with a stationary tank hull.
    g.riding = {
      kind: "tank",
      spec: { radius: 2.3, speed: 5.3 },
      hp: 100,
      mesh: g.player,
      speed: 0,
      update: () => {},
      showWeapon: () => {},
      rider: { visible: true },
    };
    e.attack = { time: 0.84, aim: 0, reach: 4.4, fired: false };
    g.updateInfantryAttack(e, 1 / 60, []);
    const tankDamage = 100 - g.riding.hp;
    g.riding = undefined;
    const a = spawn("rusher", 6, 0),
      b = spawn("rusher", 9, 0);
    const meshes = (e: any) => {
      const out: any[] = [];
      e.mesh.traverse((o: any) => {
        if (o.isMesh) out.push(o);
      });
      return out;
    };
    const am = meshes(a),
      bm = meshes(b);
    return {
      tankDamage,
      shared: am.every(
        (m: any, i: number) =>
          m.geometry === bm[i].geometry && m.material === bm[i].material,
      ),
      sword: e.motion.joints.get("Weapon").node.children[0].name,
    };
  });
  expect(r.tankDamage).toBe(1);
  expect(r.shared).toBe(true);
  expect(r.sword).toBe("swordsman_gear");
});

test("all five silhouettes render in High and Low detail with shared batches", async ({
  page,
}) => {
  await ready(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1200, height: 720 });
  const r = await page.evaluate(() => {
    const { g, spawn } = (window as any).infantryFixture,
      w = g.world;
    const roles = ["rifleman", "rusher", "swordsman", "thrower", "rocketeer"];
    const actors = roles.map((r, i) => spawn(r, (i - 2) * 3, 0));
    g.player.visible = false;
    w.terrain.visible = false;
    w.actors.clear();
    actors.forEach((e) => {
      w.actors.add(e.mesh);
      e.mesh.visible = true;
      e.mesh.rotation.y = 0.35;
      e.motion.update(0.1, {
        vx: 0,
        vz: 0,
        melee: ["rusher", "swordsman"].includes(e.role),
        attack:
          e.role === "rifleman" ? undefined : { kind: e.role, progress: 0.85 },
      });
    });
    // Art-review camera only: ordinary gameplay retains its smooth overhead camera.
    w.render = () => {
      w.camera.position.set(0, 5, 12);
      w.camera.lookAt(0, 1, 0);
      w.camera.updateMatrixWorld();
      w.scene.updateMatrixWorld(true);
      w.actorBatches.update(w.camera);
      w.renderer.render(w.scene, w.camera);
    };
    const counts = [];
    for (const low of [true, false]) {
      w.quality(low);
      w.render();
      counts.push(w.renderer.info.render.calls);
    }
    return counts;
  });
  await page.screenshot({ path: ".tools/infantry-lineup.png" });
  expect(r.every((n) => n > 0 && n < 400)).toBe(true);
  expect(errors).toEqual([]);
});

test("direct rockets deal one bounded hit and a wall blocks their blast", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, COVER, step, ENEMY_WEAPONS } = (window as any).infantryFixture;
    g.shoot(0, 0, 0, true, 24, 11, ENEMY_WEAPONS.rocket);
    step(50);
    const direct = 200 - g.hp;
    g.hp = 200;
    g.invincible = 0;
    COVER.push({ x: 0, z: 7, w: 6, d: 0.5, kind: "screen", height: 3 });
    g.shoot(0, 0, 0, true, 24, 11, ENEMY_WEAPONS.rocket);
    step(55);
    return { direct, wallSafe: g.hp === 200, expired: g.bullets.length === 0 };
  });
  expect(r).toEqual({ direct: 24, wallSafe: true, expired: true });
});

test("melee arcs and rocket line remain visible at ordinary mobile gameplay scale", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 0.5,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    localStorage.setItem(
      "nightfall-prefs",
      JSON.stringify({ low: true, sound: false }),
    ),
  );
  await ready(page);
  const r = await page.evaluate(() => {
    const { g, spawn, step } = (window as any).infantryFixture;
    const enemies = [
      spawn("rusher", -1, 6.8),
      spawn("swordsman", 2, 6.7),
      spawn("rocketeer", 0, -8),
    ];
    enemies.forEach(
      (e) => (e.mesh.rotation.y = Math.atan2(g.pos.x - e.x, g.pos.z - e.z)),
    );
    step(15);
    g.world.resetCamera(g.pos);
    g.world.render(g.elapsed, g.pos, false, true);
    return enemies.map((e) => ({
      role: e.role,
      visible: e.warn.visible,
      attack: !!e.attack,
      width: e.warn.scale.x,
      depth: e.warn.scale.y,
    }));
  });
  expect(r.every((e) => e.visible && e.attack)).toBe(true);
  expect(r[2].depth).toBeCloseTo(16);
  await expect(page.locator('[data-action="swap"]')).toBeVisible();
  await expect(page.locator('[data-hold="fire"]')).toBeVisible();
  await page.screenshot({ path: ".tools/infantry-mobile.png" });
  await context.close();
});
