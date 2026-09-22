import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("prison rescue opens its gate once, recruits an armed ally and releases a diamond", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    const { segmentBox, moveCircle } = await import("/src/rules.mjs");
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const p = g.prisons[0],
      cmd = { ...input, x: 0, z: 0, fire: false, assist: false, blast: false };
    g.pos.set(p.box.exit.x, 0, p.box.exit.z);
    g.update(1 / 60, { ...cmd });
    const rescued = {
      count: g.rescued,
      allies: g.squad.allies.length,
      credits: g.credits,
      freed: p.freed,
      gun: g.squad.allies[0].motion.joints.get("Weapon").node.children.length,
    };
    for (let i = 0; i < 180; i++) g.update(1 / 60, { ...cmd });
    const a = g.squad.allies[0],
      position = a.mesh.position;
    const clear = COVER.every(
      (b: any) =>
        segmentBox(position.x, position.z, position.x, position.z, b, 0.39) ===
        Infinity,
    );
    let walker = { x: p.box.exit.x, z: p.box.exit.z };
    for (let i = 0; i < 200; i++) {
      const dx = p.box.x - walker.x,
        dz = p.box.z - walker.z,
        d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      walker = moveCircle(
        walker.x,
        walker.z,
        (dx / d) * 0.04,
        (dz / d) * 0.04,
        0.52,
        COVER,
      );
    }
    const doorwayClear =
      !COVER.includes(p.box) &&
      Math.hypot(walker.x - p.box.x, walker.z - p.box.z) < 0.1;
    const floor = g.world.groundHeight(p.box.x, p.box.z);
    g.phase = "won";
    return {
      doorwayClear,
      floor,
      rescued,
      after: g.rescued,
      allies: g.squad.allies.length,
      credits: g.credits,
      gate: p.gate.position.y,
      emerged: !a.emerging,
      clear,
    };
  });
  expect(r).toMatchObject({
    doorwayClear: true,
    floor: 0.24,
    rescued: { count: 1, allies: 1, credits: 75, freed: true, gun: 1 },
    after: 1,
    allies: 1,
    credits: 75,
    emerged: true,
    clear: true,
  });
  expect(r.gate).toBeCloseTo(2.6);
  await expect(page.locator("#shield-text")).toContainText("ALLIES 1");
  await page.screenshot({ path: ".tools/rescue-desktop.png" });
});

test("squad routes around walls, fires aligned bursts and dismounts outside vehicle collision", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { segmentBox } = await import("/src/rules.mjs");
    const s = g.squad;
    g.phase = "won";
    s.clear();
    s.add(-5, 0);
    const wall = { x: 0, z: 0, w: 2, d: 8, kind: "building" },
      target = { x: 5, z: 0 },
      shots: any[] = [];
    let crossed = false;
    for (let i = 0; i < 900; i++) {
      s.update(1 / 60, target, false, false, 0, [wall], () => {});
      const p = s.allies[0].mesh.position;
      crossed ||= segmentBox(p.x, p.z, p.x, p.z, wall, 0.39) !== Infinity;
    }
    const p = s.allies[0].mesh.position,
      distance = Math.hypot(p.x - 5, p.z);
    const ammo = g.ammo,
      reserves = [...g.reserves];
    for (let i = 0; i < 300; i++)
      s.update(
        1 / 60,
        target,
        false,
        true,
        0.7,
        [],
        (x: number, z: number, angle: number) => shots.push({ x, z, angle }),
      );
    const fire = {
      count: shots.length,
      aligned: shots.every((p) => p.angle === 0.7),
      ownAmmo:
        g.ammo === ammo &&
        g.reserves.every((v: number, i: number) => Object.is(v, reserves[i])),
    };
    s.add(3, 1);
    s.add(3, -1);
    const fourth = s.add(4, 0);
    s.update(1 / 60, { x: 0, z: 0 }, true, true, 0, [], () => {});
    const hidden = s.allies.every((a: any) => a.passenger && !a.mesh.visible);
    const car = { x: 0, z: 0, w: 4, d: 6 };
    s.update(1 / 60, { x: 3, z: 0 }, false, false, 0, [car], () => {});
    const emerged = s.allies.every(
      (a: any) =>
        !a.passenger &&
        a.mesh.visible &&
        segmentBox(
          a.mesh.position.x,
          a.mesh.position.z,
          a.mesh.position.x,
          a.mesh.position.z,
          car,
          0.4,
        ) === Infinity,
    );
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    const clean =
      g.squad.allies.length === 0 &&
      g.prisons.length === 1 &&
      g.rescued === 0 &&
      g.credits === 0;
    g.phase = "won";
    return { crossed, distance, fire, fourth, hidden, emerged, clean };
  });
  expect(r.crossed).toBe(false);
  expect(r.distance).toBeLessThan(1.8);
  expect(r.fire.count).toBeGreaterThan(10);
  expect(r.fire.count).toBeLessThan(16);
  expect(r).toMatchObject({
    fire: { aligned: true, ownAmmo: true },
    fourth: false,
    hidden: true,
    emerged: true,
    clean: true,
  });
});

test("bonus weapon has finite ammunition; treasure works on foot and in vehicles but not through walls", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
    };
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const bonus = g.weaponDrops.find((d: any) => d.mesh.userData.bonusRounds);
    g.pos.copy(bonus.mesh.position);
    g.update(1 / 60, { ...cmd });
    const weapon = { index: g.weapon, ammo: g.ammo, reserve: g.reserves[2] };
    g.start(2, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.enemies.forEach((e: any) => (e.hp = 0));
    COVER.length = 0;
    PATCHES.length = 0;
    g.prisons = [];
    const t = g.treasures[0];
    g.treasures = [t];
    t.position.set(0.5, 0, 0);
    g.pos.set(-0.5, 0, 0);
    COVER.push({ x: 0, z: 0, w: 0.2, d: 3, kind: "building" });
    g.updateRescues(0.01);
    const wallBlocked = g.credits === 0 && g.treasures.length === 1;
    COVER.length = 0;
    g.updateRescues(0.01);
    const foot = g.credits === 10;
    const collected = [];
    for (const kind of ["motorcycle", "jeep", "tank"]) {
      const v = g.rides.find((r: any) => r.kind === kind);
      g.riding = v;
      v.mesh.position.set(0, 0, 0);
      g.pos.set(0, 0, 0);
      g.addTreasure("gold", v.spec.radius + 0.6, 0);
      g.updateRescues(0.01);
      collected.push(g.credits);
    }
    g.riding = undefined;
    g.phase = "won";
    return { weapon, wallBlocked, foot, collected };
  });
  expect(r).toEqual({
    weapon: { index: 2, ammo: 60, reserve: 0 },
    wallBlocked: true,
    foot: true,
    collected: [35, 60, 85],
  });
});

test("extraction banks rescue rewards once; shop and retry preserve purchased kit and squad", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const cmd = {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
    };
    const gold = g.treasures.find((t: any) => t.userData.kind === "gold");
    g.pos.copy(gold.position);
    g.update(1 / 60, { ...cmd });
    const p = g.prisons[0];
    g.pos.set(p.box.exit.x, 0, p.box.exit.z);
    g.update(1 / 60, { ...cmd });
    g.objective = true;
    g.bossDead = true;
    g.pos.set(MISSIONS[0].extract.x, 0, MISSIONS[0].extract.z);
    g.update(1 / 60, { ...cmd });
  });
  await expect(page.locator(".rescue-result")).toContainText("1 rescued");
  await expect(page.locator(".rescue-result")).toContainText(
    "100 credits recovered",
  );
  const atExtraction = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-campaign")!),
  );
  expect(atExtraction).toMatchObject({
    mission: 1,
    credits: 100,
    squad: 1,
    armor: 1,
  });
  await page.locator('[data-upgrade="power"]').click();
  await page.locator("#field-shop").click();
  await expect(page.locator("#buy-kit")).toBeEnabled();
  await page.locator("#buy-kit").click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-campaign")!),
  );
  expect(saved).toMatchObject({
    mission: 1,
    armor: 0,
    power: 1,
    credits: 0,
    squad: 1,
    fieldKit: 1,
  });
  await page.reload();
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const before = await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.phase = "won";
    return {
      allies: g.squad.allies.length,
      shield: g.shield,
      frags: g.magazines[9] + g.reserves[9],
    };
  });
  expect(before).toEqual({ allies: 1, shield: 10, frags: 5 });
  // A restart rebuilds the same paid loadout without spending or banking field rewards.
  await page.evaluate(() => {
    const n = (window as any).__nightfall;
    n.game.credits = 999;
    n.start();
  });
  const after = await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.phase = "won";
    return {
      credits: g.credits,
      allies: g.squad.allies.length,
      shield: g.shield,
      save: JSON.parse(localStorage.getItem("nightfall-campaign")!),
    };
  });
  expect(after).toMatchObject({
    credits: 0,
    allies: 1,
    shield: 10,
    save: { credits: 0, squad: 1, fieldKit: 1 },
  });
});
test("support bullets damage enemies, stop at cover, and never use the player magazine", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const checks = [];
    for (const blocked of [false, true]) {
      g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.weaponDrops = [];
      g.pickups = [];
      g.prisons = [];
      g.treasures = [];
      COVER.length = 0;
      PATCHES.length = 0;
      g.squad.clear();
      g.squad.add(0, 0);
      g.pos.set(-8, 0, 0);
      g.invincible = 1000;
      const e = g.enemies[0];
      e.hp = 100;
      e.x = 0;
      e.z = 6;
      e.cool = 1000;
      e.mesh.rotation.y = 0;
      e.alerted = false;
      e.memory = 0;
      e.mesh.position.set(0, 0, 6);
      if (blocked)
        COVER.push({ x: 0, z: 3, w: 4, d: 0.4, kind: "building", height: 3 });
      const ammo = g.ammo;
      g.squad.update(
        0.2,
        { x: 0, z: 0 },
        false,
        true,
        0,
        COVER,
        (x: number, z: number, a: number) =>
          g.shoot(x, z, a, false, 12, WEAPONS[0].speed, WEAPONS[0]),
      );
      const shots = g.bullets.length;
      for (let i = 0; i < 30; i++)
        g.update(1 / 60, {
          ...input,
          x: 0,
          z: 0,
          fire: false,
          assist: false,
          blast: false,
        });
      checks.push({
        blocked,
        shots,
        damage: 100 - e.hp,
        ammoUnchanged: g.ammo === ammo,
      });
    }
    g.phase = "won";
    return checks;
  });
  expect(result[0]).toMatchObject({
    blocked: false,
    shots: 1,
    ammoUnchanged: true,
  });
  expect(result[0].damage).toBeGreaterThanOrEqual(12);
  expect(result[1]).toMatchObject({
    blocked: true,
    shots: 1,
    damage: 0,
    ammoUnchanged: true,
  });
});

test("mobile rescue needs no extra button and squad status stays compact after saving", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 0.5,
  });
  const page = await context.newPage();
  await ready(page);
  await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const p = g.prisons[0];
    g.pos.set(p.box.exit.x, 0, p.box.exit.z);
    g.update(1 / 60, {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      interact: false,
    });
    for (let i = 0; i < 150; i++)
      g.update(1 / 60, {
        ...input,
        x: 0,
        z: 0,
        fire: false,
        assist: false,
        interact: false,
      });
    g.phase = "won";
  });
  await expect(page.locator("#shield-text")).toContainText("ALLIES 1");
  expect(
    (await page.locator(".health-panel").boundingBox())!.height,
  ).toBeLessThan(65);
  expect(await page.locator("#touch button").count()).toBe(7);
  const fits = await page
    .locator("#shield-text")
    .evaluate((e) => e.scrollWidth <= e.clientWidth);
  expect(fits).toBe(true);
  await page.screenshot({ path: ".tools/rescue-mobile.png" });
  await context.close();
});

test("refreshing the result retains rescued allies and treasure without replaying the reward", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const p = g.prisons[0];
    g.pos.set(p.box.exit.x, 0, p.box.exit.z);
    g.update(1 / 60, {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
    });
    g.objective = true;
    g.bossDead = true;
    g.pos.set(MISSIONS[0].extract.x, 0, MISSIONS[0].extract.z);
    g.update(1 / 60, {
      ...input,
      x: 0,
      z: 0,
      fire: false,
      assist: false,
      blast: false,
    });
    g.onEnd(true); // duplicate completion callbacks must not bank twice.
  });
  await expect(page.locator(".rescue-result")).toContainText(
    "75 credits recovered",
  );
  await page.reload();
  await expect(page.locator("#deploy")).toBeEnabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-campaign")!),
  );
  expect(saved).toMatchObject({ mission: 1, credits: 75, squad: 1, armor: 1 });
  await page.locator("#field-shop").click();
  await expect(page.locator("#buy-kit")).toBeDisabled();
  await expect(page.locator("#close-shop")).toBeFocused();
  await page.locator("#close-shop").click();
});
