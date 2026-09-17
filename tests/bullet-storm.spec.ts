import { stickPoint } from "./stick-helper";
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
    g.invincible = 10000;
    g.quakeTime = 10000;
  });
}
test("infantry fall along the shot, powerful hits throw farther, walls stop bodies and blood fades", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const T = await import("/tests/scene-fixtures.ts");
    const fall = (index: number, spec: any, wall: boolean) => {
      const e = g.enemies[index];
      e.hp = 1;
      e.x = 0;
      e.z = 0;
      e.mesh.position.set(0, 0, 0);
      if (wall) COVER.push({ x: 4, z: 0, w: 1, d: 10, kind: "building" });
      g.hurt(e, spec.damage, spec, undefined, { x: 1, z: 0 });
      const body = g.corpses.at(-1);
      for (let i = 0; i < 55; i++) g.updatePresentation(1 / 60);
      const bounds = new T.Box3().setFromObject(e.mesh);
      return {
        x: e.mesh.position.x,
        z: e.mesh.position.z,
        edge: bounds.max.x,
        opacity: body.opacity,
      };
    };
    const rifle = fall(0, WEAPONS[0], false);
    const rocket = fall(1, WEAPONS[7], false);
    const wall = fall(2, WEAPONS[7], true);
    const blood = g.destruction.fragments.some(
      (f: any) => f.ground && f.materials[0].color.getHex() === 0x951d2c,
    );
    for (let i = 0; i < 240; i++) g.updatePresentation(1 / 60);
    return {
      rifle,
      rocket,
      wall,
      blood,
      expired: g.corpses.length === 0 && g.destruction.fragments.length === 0,
    };
  });
  expect(result.rifle.x).toBeGreaterThan(1);
  expect(result.rocket.x).toBeGreaterThan(result.rifle.x + 1);
  expect(Math.abs(result.rocket.z)).toBeLessThan(0.01);
  expect(result.wall.x).toBeLessThan(3);
  expect(result.wall.edge).toBeLessThanOrEqual(3.6);
  expect(result.blood && result.expired).toBe(true);
});
test("rocket-killed tanks split into model parts that fly, land and fade with bounded effects", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    const result = [];
    for (const low of [true, false]) {
      g.world.quality(low);
      g.destruction.clear();
      g.spawn(5, 5, false, 222, "laserTank", true);
      const e = g.enemies.at(-1);
      e.hp = 1;
      g.hurt(e, 300, WEAPONS[7], undefined, { x: 1, z: 0 });
      const pieces = g.destruction.fragments.map((f: any) => ({
        f,
        y: f.root.position.y,
        x: f.root.position.x,
        z: f.root.position.z,
      }));
      g.updatePresentation(0.2);
      const flies = pieces.some(
        (p: any) =>
          p.f.root.position.y > p.y + 0.1 &&
          Math.hypot(p.f.root.position.x - p.x, p.f.root.position.z - p.z) >
            0.1,
      );
      for (let i = 0; i < 170; i++) g.updatePresentation(1 / 60);
      const lands = g.destruction.fragments.every(
        (f: any) => f.ground && f.materials[0].opacity < 1,
      );
      for (let i = 0; i < 80; i++) g.updatePresentation(1 / 60);
      result.push({
        low,
        count: pieces.length,
        removed: !e.mesh.parent,
        flies,
        lands,
        expired: g.destruction.fragments.length === 0,
      });
    }
    return result;
  });
  for (const r of result) {
    expect(r, JSON.stringify(r)).toMatchObject({
      removed: true,
      flies: true,
      lands: true,
      expired: true,
    });
    expect(r.count).toBeGreaterThanOrEqual(4);
    expect(r.count).toBeLessThanOrEqual(r.low ? 6 : 10);
  }
});
test("Turbo consumes independent magazines, reloads, locks swaps, cools down and clears on restart", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    (window as any).__nightfall.game.inventory = [0, 1];
  });
  await page.keyboard.press("KeyF");
  await expect(page.locator("#turbo")).toContainText("TURBO 2.");
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      swap: false,
      turbo: false,
    };
    const active = g.turboTime > 0;
    const first = g.weapon;
    g.update(1 / 60, { ...cmd, swap: true });
    const locked = g.weapon === first && !g.canSwapWeapon;
    g.ammo = 24;
    g.magazines[1] = 6;
    g.update(1 / 60, { ...cmd, fire: true });
    const spent = g.ammo === 23 && g.magazines[1] === 5;
    const cannotStack = !g.activateTurbo();
    for (let i = 0; i < 190; i++) g.update(1 / 60, { ...cmd });
    const cooldown =
      g.turboCooldown > 12 && g.turboCooldown <= 14 && !g.canTurbo;
    for (let i = 0; i < 850; i++) g.update(1 / 60, { ...cmd });
    const ready = g.canTurbo;
    g.magazines[1] = 0;
    g.reserves[1] = 6;
    g.activateTurbo();
    for (let i = 0; i < 150; i++) g.update(1 / 60, { ...cmd, fire: true });
    const reload =
      g.reserves[1] === 0 && g.magazines[1] > 0 && g.magazines[1] < 6;
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    return {
      active,
      locked,
      spent,
      cannotStack,
      cooldown,
      ready,
      reload,
      reset:
        g.turboTime === 0 && g.turboCooldown === 0 && g.turboBanks.length === 0,
    };
  });
  expect(result).toEqual({
    active: true,
    locked: true,
    spent: true,
    cannotStack: true,
    cooldown: true,
    ready: true,
    reload: true,
    reset: true,
  });
});
test("upgraded bike jeep and tank support extra weapons without duplicating cannon or personal ammunition", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    const rows = [];
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      turbo: false,
      swap: false,
    };
    for (const kind of ["motorcycle", "jeep", "tank"]) {
      g.rides.forEach((ride: any, i: number) =>
        ride.mesh.position.set(-30 + i * 12, 0, 0),
      );
      const v = g.rides.find((v: any) => v.kind === kind);
      v.mesh.position.set(15, 0, 20);
      g.pos.copy(v.mesh.position);
      g.power = 0;
      g.useRide();
      const locked = !g.canTurbo;
      g.power = 3;
      g.inventory = [0, 1, 2, 3, 8];
      g.weapon = 0;
      g.ammo = 24;
      g.magazines[2] = 70;
      g.magazines[3] = 6;
      g.magazines[8] = 8;
      v.ammo = v.spec.ammo;
      v.cool = 0;
      g.shotTime = 0;
      const activated = g.activateTurbo();
      const guns = g.turboBanks.length + 1;
      const bankBefore = g.turboBanks.map((b: any) => g.magazines[b.index]);
      g.update(1 / 60, { ...cmd, fire: true });
      const consumed = g.turboBanks.every(
        (b: any, i: number) => g.magazines[b.index] === bankBefore[i] - 1,
      );
      const primary =
        kind === "motorcycle" ? g.ammo === 23 : v.ammo === v.spec.ammo - 1;
      g.useRide();
      rows.push({
        kind,
        locked,
        activated,
        guns,
        consumed,
        primary,
        ended: g.turboTime === 0 && g.turboBanks.length === 0,
      });
      g.turboCooldown = 0;
    }
    return rows;
  });
  for (const row of result)
    expect(row, JSON.stringify(row)).toMatchObject({
      locked: true,
      activated: true,
      guns: 3,
      consumed: true,
      primary: true,
      ended: true,
    });
});
test("touch Turbo remains reachable beside simultaneous move and fire controls", async ({
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
  const button = page.locator('[data-action="turbo"]');
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await button.tap();
  await expect(button).toContainText("TURBO 2.");
  await page
    .locator('[data-hold="fire"]')
    .dispatchEvent("pointerdown", { pointerId: 71 });
  await page
    .locator("#move-pad")
    .dispatchEvent("pointerdown", {
      pointerId: 72,
      button: 0,
      ...(await stickPoint(page, "left")),
    });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { game: g } = (window as any).__nightfall;
        return g.ammo < 24 && g.magazines[9] < 1 && g.pos.x < 15;
      }),
    )
    .toBe(true);
  await page
    .locator('[data-hold="fire"]')
    .dispatchEvent("pointercancel", { pointerId: 71 });
  await page
    .locator("#move-pad")
    .dispatchEvent("pointercancel", { pointerId: 72 });
  await context.close();
});

test("render batches preserve movement and fading without drawing original meshes twice", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, world: w } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    const e = g.enemies[0];
    e.hp = 65;
    e.x = 17;
    e.z = 20;
    e.mesh.position.set(17, 0, 20);
    w.render(0, g.pos, false, true);
    g.hurt(e, 100, WEAPONS[0], undefined, { x: 1, z: 0 });
    g.updatePresentation(0.3);
    w.render(0.3, g.pos, false, true);
    const parts: any[] = [];
    e.mesh.traverse((o: any) => {
      if (o.isMesh) parts.push(o);
    });
    const sourcesHidden = parts.every((p) => !p.visible);
    const instances = w.actors.children.filter(
      (o: any) => o.isInstancedMesh && o.visible && o.count > 0,
    );
    const fadeDrawn = instances.some((o: any) =>
      [o.material].flat().some((m: any) => m.userData.batchBase),
    );
    const moved = e.mesh.position.x > 17;
    for (let i = 0; i < 250; i++) g.updatePresentation(1 / 60);
    w.render(5, g.pos, false, true);
    const faded =
      !e.mesh.parent &&
      !w.actors.children.some(
        (o: any) =>
          o.isInstancedMesh &&
          o.visible &&
          [o.material].flat().some((m: any) => m.userData.batchBase),
      );
    return { sourcesHidden, fadeDrawn, moved, faded };
  });
  expect(result).toEqual({
    sourcesHidden: true,
    fadeDrawn: true,
    moved: true,
    faded: true,
  });
});
