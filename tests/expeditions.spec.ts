import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}
test("square expeditions offer guarded vehicle bays, collectable weapons and clear exits", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    const result = [];
    for (const index of [1, 4, 2, 5, 7, 10, 19]) {
      g.start(index, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.invincible = 10000;
      const m = MISSIONS[index],
        cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
      const targets = [
        ...g.rides.map((v: any) => v.mesh.position),
        ...g.weaponDrops
          .filter((d: any) => [3, 7, 8].includes(d.index))
          .map((d: any) => d.mesh.position),
      ];
      const defended = targets.every(
        (p) =>
          g.enemies.filter(
            (e: any) => e.cacheGuard && Math.hypot(e.x - p.x, e.z - p.z) < 7,
          ).length >= 2,
      );
      // Clearing actual defenders leaves the reward available, and each bay can be exited.
      for (const e of g.enemies.filter((e: any) => e.cacheGuard))
        g.hurt(e, 999);
      g.enemies.forEach((e: any) => (e.hp = 0));
      const rides = [];
      for (const v of g.rides) {
        g.pos.copy(v.mesh.position);
        g.useRide();
        const boarded = g.riding === v;
        g.useRide();
        rides.push(
          boarded &&
            !g.riding &&
            COVER.every(
              (b: any) =>
                segmentBox(g.pos.x, g.pos.z, g.pos.x, g.pos.z, b, 0.5) ===
                Infinity,
            ),
        );
      }
      for (const d of [...g.weaponDrops]) {
        g.pos.copy(d.mesh.position);
        g.update(1 / 60, { ...cmd });
      }
      result.push({
        shape: m.shape,
        defended,
        rides,
        inventory: g.inventory.length,
        remaining: g.weaponDrops.length,
      });
    }
    return result;
  });
  for (const row of rows)
    expect(row, JSON.stringify(row)).toMatchObject({
      defended: true,
      rides: [true, true, true],
      inventory: 11,
      remaining: 0,
    });
});
test("permanent volcanic rock blocks bullets, laser and blasts in both detail modes", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const { landformModel } = await import("/src/world.ts");
    const T = await import("/tests/scene-fixtures.ts");
    g.start(4, { armor: 0, power: 0, mobility: 0 }, "normal");
    const rock = COVER.find(
      (b: any) => b.kind === "basalt" && b.z === -9 && Math.abs(b.x) < 10,
    );
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    const initial = COVER.length;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.pos.set(rock.x, 0, rock.z + rock.d / 2 + 2);
    const enemy = g.enemies[0];
    enemy.hp = 1000;
    enemy.x = rock.x;
    enemy.z = rock.z - rock.d / 2 - 2;
    enemy.cool = 999;
    // Keep a stationary target behind the real ridge while simulation handles projectiles.
    g.quakeTime = 1000;
    for (const spec of [WEAPONS[0], WEAPONS[7], WEAPONS[8]]) {
      g.fireWeapon(spec, Math.PI);
      for (let i = 0; i < 90; i++) g.update(1 / 60, { ...cmd });
    }
    g.blast(rock.x, rock.z + rock.d / 2, WEAPONS[7], 9999);
    g.damageProp(rock, 999999);
    const persists =
      COVER.includes(rock) && !w.destructibles.some((p: any) => p.box === rock);
    const material = new T.MeshStandardMaterial();
    const root = landformModel(rock, material),
      bounds = new T.Box3().setFromObject(root);
    const fitted =
      Math.abs(bounds.min.x - (rock.x - rock.w / 2)) < 0.05 &&
      Math.abs(bounds.max.z - (rock.z + rock.d / 2)) < 0.05;
    root.children[1].geometry.dispose();
    material.dispose();
    w.quality(true);
    const low = COVER.includes(rock);
    w.quality(false);
    return {
      persists,
      low,
      fitted,
      hp: enemy.hp,
      initial,
      cover: COVER.length,
    };
  });
  expect(result).toMatchObject({
    persists: true,
    low: true,
    fitted: true,
    hp: 1000,
  });
  expect(result.cover).toBe(result.initial);
});
