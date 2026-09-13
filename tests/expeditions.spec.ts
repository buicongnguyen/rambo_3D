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
    for (const index of [7, 4, 2, 5, 8, 11, 20]) {
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
test("replacement trees absorb several hits, block fire and clear collision in both detail modes", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const result = [];
    for (const low of [true, false]) {
      w.quality(low);
      g.start(5, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.quakeTime = 1000;
      const tree = w.destructibles.find((p: any) => p.box.scale === 0.65);
      const initialHp = tree.hp;
      const expectedHits = Math.ceil(initialHp / WEAPONS[0].damage);
      COVER.splice(0, COVER.length, tree.box);
      g.pos.set(tree.box.x, 0, tree.box.z + 3);
      const enemy = g.enemies[0];
      enemy.hp = 1000;
      enemy.x = tree.box.x;
      enemy.z = tree.box.z - 3;
      enemy.mesh.position.set(enemy.x, 0, enemy.z);
      enemy.cool = 999;
      g.fireWeapon(WEAPONS[0], Math.PI);
      for (let i = 0; i < 30; i++)
        g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
      const blocks =
        enemy.hp === 1000 && COVER.includes(tree.box) && tree.hp < initialHp;
      let hits = 1;
      while (COVER.includes(tree.box) && hits < expectedHits + 1) {
        g.damageProp(tree.box, WEAPONS[0].damage);
        hits++;
      }
      const green = g.impacts.bursts.some(
        (b: any) => b.kind === "leaf" && b.group.visible,
      );
      const chips = g.destruction.fragments.length;
      const removed =
        !COVER.includes(tree.box) && !w.destructibles.includes(tree);
      g.fireWeapon(WEAPONS[8], Math.PI);
      result.push({
        low,
        blocks,
        hits,
        expectedHits,
        green,
        chips,
        removed,
        clearShot: enemy.hp < 1000,
      });
    }
    return result;
  });
  for (const row of rows) {
    expect(row, JSON.stringify(row)).toMatchObject({
      blocks: true,
      green: true,
      removed: true,
      clearShot: true,
    });
    expect(row.expectedHits).toBeGreaterThan(1);
    expect(row.hits).toBe(row.expectedHits);
    expect(row.chips).toBeGreaterThan(5);
  }
});
