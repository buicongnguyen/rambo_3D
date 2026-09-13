import { test, expect } from "@playwright/test";
async function setup(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}
test("stage layouts, difficulty spawn ratios and multi-boss extraction gates", async ({
  page,
}) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { game: g, input, world: w } = (window as any).__nightfall;
    const { MISSIONS, COVER, PATCHES, buildLayout } =
      await import("/src/missions.ts");
    const layouts = MISSIONS.map((m: any) => {
      buildLayout(m);
      return {
        name: m.name,
        level: m.level,
        finale: m.finale,
        trees: COVER.filter((b: any) => b.kind === "tree").length,
        buildings: COVER.filter((b: any) => b.kind === "building").length,
        patches: PATCHES.length,
        length: m.route
          .slice(1)
          .reduce(
            (n: number, p: any, i: number) =>
              n + Math.hypot(p.x - m.route[i].x, p.z - m.route[i].z),
            0,
          ),
      };
    });
    const counts = [];
    for (const difficulty of ["easy", "normal", "hard", "crazy"]) {
      g.start(0, { armor: 0, power: 0, mobility: 0 }, difficulty);
      counts.push({ count: g.enemies.length, hp: g.hp });
    }
    g.start(2, { armor: 0, power: 0, mobility: 0 }, "crazy");
    g.invincible = 1000;
    const m = MISSIONS[2];
    g.pos.set(m.objective.x, 0, m.objective.z);
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.update(1 / 60, { ...cmd, interact: true });
    const bosses = g.enemies.filter((e: any) => e.boss),
      count = bosses.length;
    for (const e of bosses.slice(0, -1)) g.hurt(e, 100000);
    const blocked = !g.bossDead && !w.exit.visible;
    g.hurt(bosses.at(-1), 100000);
    const opened = g.bossDead && w.exit.visible;
    g.pos.set(m.extract.x, 0, m.extract.z);
    g.update(1 / 60, { ...cmd });
    return { layouts, counts, count, blocked, opened, phase: g.phase };
  });
  expect(result.layouts).toHaveLength(21);
  expect(
    result.layouts.every(
      (m: any) => m.length > 120 && m.finale === (m.level === 2),
    ),
  ).toBe(true);
  expect(result.layouts[9].trees).toBeGreaterThan(20);
  expect(result.layouts[12].buildings).toBeGreaterThan(10);
  expect(result.layouts[0].patches).toBeGreaterThan(10);
  expect(result.counts.map((c: any) => c.count)).toEqual([99, 99, 198, 396]);
  expect(result.counts[0].hp).toBeGreaterThan(result.counts[1].hp);
  expect(result).toMatchObject({
    count: 4,
    blocked: true,
    opened: true,
    phase: "won",
  });
});
test("ice inertia, sand slowdown, mud recovery and earthquake freeze", async ({
  page,
}) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { PATCHES } = await import("/src/missions.ts");
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    const start = (n: number) => {
      g.start(n, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.enemies.forEach((e: any) => (e.hp = 0));
    };
    start(0);
    g.pos.set(0, 0, 10);
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd, z: -1 });
    const iceZ = g.pos.z;
    for (let i = 0; i < 15; i++) g.update(1 / 60, { ...cmd });
    const slide = iceZ - g.pos.z;
    start(6);
    g.pos.set(0, 0, 10);
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd, z: -1 });
    const sand = 10 - g.pos.z;
    start(18);
    g.pos.set(0, 0, 10);
    for (let i = 0; i < 120; i++) g.update(1 / 60, { ...cmd });
    const sunk = g.pos.y;
    g.pos.set(0, 0, 24);
    for (let i = 0; i < 120; i++) g.update(1 / 60, { ...cmd });
    const recovered = g.pos.y;
    start(15);
    g.pos.set(0, 0, 23); // Keep the freeze fixture near its soldier on the southbound map.
    const e = g.enemies[0];
    e.hp = 100;
    e.x = 0;
    e.z = 16;
    e.cool = 100;
    g.eventClock = 0.01;
    g.update(1 / 60, { ...cmd });
    const before = { x: e.x, z: e.z };
    const duration = g.quakeTime;
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd });
    const frozen = e.x === before.x && e.z === before.z;
    const dust = g.effects.some((e: any) => e.smoke);
    for (let i = 0; i < 120; i++) g.update(1 / 60, { ...cmd });
    const resumed = Math.hypot(e.x - before.x, e.z - before.z) > 0.05;
    return { slide, sand, sunk, recovered, duration, frozen, dust, resumed };
  });
  expect(result.slide).toBeGreaterThan(0.2);
  expect(result.sand).toBeCloseTo(6.2 * 0.25 * 0.5, 1);
  expect(result.sunk).toBeLessThan(-0.4);
  expect(result.recovered).toBeGreaterThan(-0.01);
  expect(result.duration).toBeGreaterThanOrEqual(1);
  expect(result.duration).toBeLessThanOrEqual(2);
  expect(result.frozen && result.dust && result.resumed).toBe(true);
});
test("fuel chains, destructible trees, warned rockfalls and tank run-over damage", async ({
  page,
}) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { game: g, input, world: w } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.start(9, { armor: 0, power: 0, mobility: 0 }, "normal");
    const tree = w.destructibles.find((p: any) => p.kind === "tree");
    g.damageProp(tree.box, tree.hp + 1);
    const felled = !COVER.includes(tree.box) && !w.destructibles.includes(tree);
    const fuels = w.destructibles
      .filter((p: any) => p.kind === "fuel")
      .slice(0, 2);
    fuels[1].box.x = fuels[0].box.x + 2;
    fuels[1].box.z = fuels[0].box.z;
    g.damageProp(fuels[0].box, 100);
    const chain = fuels.every((p: any) => !w.destructibles.includes(p));
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.enemies.forEach((e: any) => (e.hp = 0));
    const e = g.enemies[0];
    e.hp = 65;
    e.x = 0;
    e.z = 23;
    e.cool = 100;
    e.index = 1; // No health drop masking the impact damage.
    g.rockfall(0, 23);
    g.update(1 / 60, { ...cmd });
    const warned = g.hp === 150 && e.hp === 65 && g.hazards.length === 1;
    e.x = 0;
    e.z = 23;
    g.hazards[0].time = 0.01;
    g.update(1 / 60, { ...cmd });
    const bothHit = g.hp < 150 && e.hp <= 0;
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.enemies.forEach((e: any) => (e.hp = 0));
    const v = g.rides[2];
    v.mesh.position.set(15, 0, 20);
    g.pos.copy(v.mesh.position);
    g.useRide();
    const soldier = g.enemies[0];
    soldier.hp = 65;
    soldier.x = 15;
    soldier.z = 23;
    soldier.cool = 100;
    g.update(1 / 60, { ...cmd });
    const stationarySafe = soldier.hp === 65;
    for (let i = 0; i < 90 && soldier.hp > 0; i++)
      g.update(1 / 60, { ...cmd, z: 1 });
    return {
      felled,
      chain,
      warned,
      bothHit,
      stationarySafe,
      crushed: soldier.hp <= 0,
      kills: g.kills,
    };
  });
  expect(result).toMatchObject({
    felled: true,
    chain: true,
    warned: true,
    bothHit: true,
    stationarySafe: true,
    crushed: true,
    kills: 1,
  });
});
test("helicopter lands, spider climbs and rests, laser tank warns before firing", async ({
  page,
}) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, MISSIONS } = await import("/src/missions.ts");
    const start = (index: number) => {
      g.start(index, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.enemies.forEach((e: any) => (e.hp = 0));
      const anchor = MISSIONS[index].bossPos;
      g.spawn(anchor.x, anchor.z, true, 100);
      return g.boss;
    };
    const heli = start(2);
    let landed = false,
      flew = false;
    for (let i = 0; i < 1100; i++) {
      g.elapsed = i / 60;
      g.updateBoss(heli, 1 / 60);
      landed ||= heli.state === "LANDED / REARMING";
      flew ||= heli.mesh.position.y > 3;
    }
    const spider = start(5),
      b = COVER[0];
    spider.x = b.x;
    spider.z = b.z;
    g.pos.set(b.x, 0, b.z);
    g.elapsed = 1;
    g.updateBoss(spider, 0.3);
    const climbed = spider.mesh.position.y > 2;
    g.elapsed = 12 - ((spider.index * 1.7) % 14);
    g.updateBoss(spider, 1 / 60);
    const resting = spider.state === "RESTING";
    const tank = start(14);
    tank.x = 0;
    tank.z = 20;
    g.pos.set(0, 0, 25);
    tank.cool = 1.1;
    g.updateBoss(tank, 0.01);
    const warning = !!tank.beam && g.hp === 150;
    g.updateBoss(tank, 1.2);
    const laserDamage = g.hp < 150;
    return { landed, flew, climbed, resting, warning, laserDamage };
  });
  expect(Object.values(result).every(Boolean), JSON.stringify(result)).toBe(
    true,
  );
});

test("Crazy city patrol count is exact and laser bosses spawn clear of buildings", async ({
  page,
}) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    g.start(14, { armor: 0, power: 0, mobility: 0 }, "crazy");
    const soldiers = g.enemies.length;
    const m = MISSIONS[14];
    g.pos.set(m.objective.x, 0, m.objective.z);
    g.invincible = 1000;
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, interact: true });
    const bosses = g.enemies.filter((e: any) => e.boss);
    return {
      soldiers,
      bosses: bosses.length,
      clear: bosses.every(
        (e: any) =>
          !COVER.some(
            (box: any) => segmentBox(e.x, e.z, e.x, e.z, box, 2.4) !== Infinity,
          ),
      ),
    };
  });
  expect(result).toEqual({ soldiers: 660, bosses: 4, clear: true });
});
