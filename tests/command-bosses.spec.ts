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
test("either O arm allows movement, rewards, a shared relay fight and extraction", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    const result = [];
    for (const index of [1, 7])
      for (const side of [-1, 1]) {
        g.start(index, { armor: 0, power: 0, mobility: 0 }, "normal");
        g.invincible = 1000;
        const m = MISSIONS[index],
          cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
        const rewards = [
          ...g.weaponDrops.map((d: any) => d.mesh),
          ...g.pickups,
        ].filter((p: any) => p.position.x * side > 12).length;
        const defendedVehicle = g.rides.some(
          (v: any) => v.mesh.position.x * side > 12,
        );
        g.enemies.forEach((e: any) => (e.hp = 0));
        for (let i = 0; i < 120; i++) g.update(1 / 60, { ...cmd, x: side });
        const moved = g.pos.x * side > 8;
        g.pos.set(m.objective.x, 0, m.objective.z);
        g.update(1 / 60, { ...cmd });
        for (let i = 0; i < 300; i++) g.update(1 / 60, { ...cmd });
        const guards = g.enemies.filter(
          (e: any) => g.guardIds.has(e) && e.hp > 0,
        );
        const accessible = guards.every((e: any) =>
          COVER.every(
            (b: any) =>
              segmentBox(m.objective.x, m.objective.z, e.x, e.z, b, 0.55) ===
              Infinity,
          ),
        );
        for (const e of guards) g.hurt(e, 9999);
        g.pos.set(m.extract.x, 0, m.extract.z);
        g.update(1 / 60, { ...cmd });
        result.push({
          index,
          side,
          rewards,
          defendedVehicle,
          moved,
          accessible,
          guards: guards.length,
          won: g.phase === "won",
        });
      }
    return result;
  });
  for (const row of rows) {
    expect(row, JSON.stringify(row)).toMatchObject({
      defendedVehicle: true,
      moved: true,
      accessible: true,
      guards: 3,
      won: true,
    });
    expect(row.rewards).toBeGreaterThanOrEqual(row.index === 1 ? 2 : 4);
  }
});

test("new Blender bosses articulate, fire from real mounts, warn before missiles and fall away", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const result = [];
    for (const kind of ["quadMech", "rocketMech", "missileTruck"]) {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
      COVER.length = PATCHES.length = 0;
      g.rides.forEach((v: any) => (v.hp = 0));
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.spawn(0, 0, true, 100, kind);
      const e = g.boss;
      g.pos.set(0, 0, 24);
      g.invincible = 1000;
      e.cool = 0;
      e.auxCool = 0;
      g.updateBoss(e, 0.01);
      const bullets = g.bullets.map((b: any) => ({
        x: b.x,
        y: b.originY,
        z: b.z,
        damage: b.damage,
      }));
      const hazards = g.hazards.map((h: any) => ({
        radius: h.radius,
        damage: h.damage,
        time: h.time,
        duration: h.duration,
        distance: h.rock.position.distanceTo(h.from),
        from: h.from.toArray(),
      }));
      const pivot = e.muzzles.get(
        kind === "missileTruck" ? "Wheel0" : "ThighL",
      );
      const before = pivot.quaternion.clone();
      // Reposition between attacks: wheels and knees must change with actual displacement.
      e.cool = 3;
      const startX = e.x,
        startZ = e.z;
      for (let i = 0; i < 20; i++) {
        g.elapsed += 0.03;
        g.updateBoss(e, 0.03);
      }
      const articulated = before.angleTo(pivot.quaternion) > 0.01;
      const moved = Math.hypot(e.x - startX, e.z - startZ) > 0.1;
      if (g.hazards.length) {
        const h = g.hazards[0],
          beforeFlight = h.rock.position.clone();
        g.update(0.1, { ...input, x: 0, z: 0, fire: false, interact: false });
        if (h.rock.position.distanceTo(beforeFlight) < 0.1)
          throw new Error("Missile did not leave its launcher");
      }
      const hpBefore = g.hp;
      g.hurt(e, 100000);
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, interact: false });
      const canceled = !g.hazards.some((h: any) => h.owner === e);
      g.updatePresentation(4.1);
      result.push({
        kind,
        bullets,
        hazards,
        articulated,
        moved,
        canceled,
        removed: !e.mesh.parent,
        noEarlyDamage: hpBefore === 150,
      });
    }
    return result;
  });
  for (const row of rows)
    expect(row, JSON.stringify(row)).toMatchObject({
      articulated: true,
      moved: true,
      canceled: true,
      removed: true,
      noEarlyDamage: true,
    });
  expect(rows[0].bullets).toHaveLength(4);
  expect(new Set(rows[0].bullets.map((b) => Math.round(b.x * 100))).size).toBe(
    4,
  );
  expect(rows[0].bullets.every((b) => b.y > 2 && b.damage === 10)).toBe(true);
  expect(rows[1].bullets).toHaveLength(2);
  expect(rows[1].hazards).toHaveLength(3);
  expect(rows[2].hazards).toHaveLength(4);
  for (const row of rows.slice(1)) {
    expect(
      row.hazards.every(
        (h) => h.time >= 1.6 && h.radius >= 3.6 && h.distance < 0.01,
      ),
    ).toBe(true);
    expect(new Set(row.hazards.map((h) => h.from[0].toFixed(2))).size).toBe(2);
  }
});

test("legacy bosses use independent light guns and cover blocks their secondary shots", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    return ["gunship", "spider", "laserTank"].map((kind) => {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
      COVER.length = PATCHES.length = 0;
      g.rides.forEach((v: any) => (v.hp = 0));
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.spawn(0, 0, true, 100, kind);
      const e = g.boss;
      e.cool = 100;
      e.auxCool = 0;
      g.elapsed = 0;
      g.pos.set(0, 0, 18);
      g.updateBoss(e, 0.01);
      const bullets = g.bullets.length,
        damage = g.bullets[0]?.damage;
      const light = e.muzzles.has("MuzzleAux") && e.muzzles.has("AuxGun");
      COVER.push({ x: 0, z: 9, w: 20, d: 1 });
      e.auxCool = 0;
      g.updateBoss(e, 0.1);
      return {
        kind,
        bullets,
        damage,
        light,
        blocked: g.bullets.length === bullets,
        mainIndependent: e.cool > 99,
      };
    });
  });
  for (const row of rows)
    expect(row, JSON.stringify(row)).toMatchObject({
      bullets: 1,
      damage: 6,
      light: true,
      blocked: true,
      mainIndependent: true,
    });
});

test("every finale includes four correctly fitted command bosses in Crazy mode", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    return MISSIONS.map((m: any, index: number) => ({ m, index }))
      .filter(({ m }: any) => m.finale)
      .map(({ m, index }: any) => {
        g.start(index, { armor: 0, power: 0, mobility: 0 }, "crazy");
        g.invincible = 1000;
        g.pos.set(m.objective.x, 0, m.objective.z);
        g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, interact: true });
        const bosses = g.enemies.filter((e: any) => e.boss);
        return {
          kind: m.bossModel,
          count: bosses.length,
          matches: bosses.every((e: any) =>
            [m.bossModel, m.bossEscort].includes(e.bossKind),
          ),
          escorts: bosses.filter((e: any) => e.bossKind === m.bossEscort)
            .length,
          clear: bosses.every(
            (e: any) =>
              ["spider", "gunship", "skyWraith"].includes(e.bossKind) ||
              COVER.every(
                (b: any) =>
                  segmentBox(e.x, e.z, e.x, e.z, b, e.radius) === Infinity,
              ),
          ),
        };
      });
  });
  // Seven stage bosses; the last two finales alternate with the walker escort.
  expect(new Set(rows.map((r) => r.kind)).size).toBe(7);
  for (const [i, row] of rows.entries())
    expect(row, JSON.stringify(row)).toMatchObject({
      count: 4,
      matches: true,
      escorts: i >= 5 ? 2 : 0,
      clear: true,
    });
});

test("missile bosses seek a firing position around cover instead of waiting forever to launch", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    return ["rocketMech", "missileTruck"].map((kind) => {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
      COVER.length = PATCHES.length = 0;
      g.rides.forEach((v: any) => (v.hp = 0));
      g.enemies.forEach((e: any) => (e.hp = 0));
      COVER.push({ x: 0, z: 8, w: 5, d: 2, kind: "basalt" });
      g.spawn(0, 0, true, 100, kind);
      const e = g.boss;
      e.cool = 0;
      g.pos.set(0, 0, 20);
      let collision = false,
        moved = false;
      for (let i = 0; i < 450; i++) {
        g.elapsed += 1 / 30;
        g.updateBoss(e, 1 / 30);
        collision ||= COVER.some(
          (b: any) =>
            Math.hypot(
              Math.max(0, Math.abs(e.x - b.x) - b.w / 2),
              Math.max(0, Math.abs(e.z - b.z) - b.d / 2),
            ) <
            e.radius - 0.02,
        );
        moved ||= Math.hypot(e.x, e.z) > 4;
      }
      return { kind, moved, collision, fired: g.hazards.length > 0 };
    });
  });
  for (const row of result)
    expect(row, JSON.stringify(row)).toMatchObject({
      moved: true,
      collision: false,
      fired: true,
    });
});
