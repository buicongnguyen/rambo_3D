import { test, expect } from "@playwright/test";
test("M249 delivers 30-round-per-second reduced-damage fire on foot, in vehicles and Turbo, and tank armor absorbs damage", async ({
  page,
}) => {
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
  const result = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const rows = [];
    for (const mode of ["foot", "motorcycle", "tank", "turbo"]) {
      g.start(3, { armor: 0, power: 1, mobility: 0 }, "normal");
      COVER.length = 0;
      PATCHES.length = 0;
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.pickups.forEach((p: any) => p.removeFromParent());
      g.pickups = [];
      g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
      g.rides.forEach((v: any, i: number) =>
        v.mesh.position.set(-20 + i * 10, 0, -70),
      );
      g.quakeTime = 10000;
      g.invincible = 10000;
      g.pos.set(15, 0, 20);
      g.inventory = mode === "turbo" ? [0, 2] : [2];
      g.weapon = 2;
      g.ammo = 120;
      g.magazines[2] = 120;
      if (mode === "motorcycle" || mode === "tank") {
        const v = g.rides.find((v: any) => v.kind === mode);
        v.mesh.position.copy(g.pos);
        g.useRide();
        v.personalWeapon = true;
        v.cool = 0;
      }
      g.shotTime = 0;
      if (mode === "turbo") g.activateTurbo();
      const original = g.fireWeapon.bind(g);
      let shots = 0,
        wrongDamage = false;
      g.fireWeapon = (spec: any, ...args: any[]) => {
        if (spec.id === "machineGun") {
          shots++;
          wrongDamage ||= spec.damage !== 10;
        }
        return original(spec, ...args);
      };
      const cmd = {
        ...input,
        x: 0,
        z: 0,
        fire: true,
        assist: false,
        interact: false,
        swap: false,
        turbo: false,
        reload: false,
      };
      cmd.aim.set(15, 0, -20);
      for (let i = 0; i < 60; i++) g.update(1 / 60, cmd);
      rows.push({ mode, shots, spent: 120 - g.ammo, wrongDamage });
      if (mode === "foot") {
        for (let i = 60; i < 240; i++) g.update(1 / 60, cmd);
        rows.push({ mode: "belt", shots, empty: g.ammo === 0 });
        for (let i = 0; i < 175; i++) g.update(1 / 60, cmd);
        rows.push({
          mode: "reload",
          reserve: g.reserves[2],
          resumed: shots > 120,
          ammo: g.ammo,
        });
      }
      g.fireWeapon = original;
    }
    g.endTurbo();
    const v = g.rides[2];
    v.mesh.position.copy(g.pos);
    g.useRide();
    const armorBefore = v.hp;
    g.invincible = 0;
    g.takeDamage(420);
    const armor = {
      before: armorBefore,
      after: v.hp,
      health: g.hp,
      riding: g.riding === v,
      shells: v.ammo,
    };
    g.phase = "won";
    return { rows, armor };
  });
  for (const row of result.rows.filter((r: any) =>
    ["foot", "motorcycle", "tank", "turbo"].includes(r.mode),
  ))
    expect(row).toMatchObject({ shots: 30, spent: 30, wrongDamage: false });
  expect(result.rows.find((r: any) => r.mode === "belt")).toMatchObject({
    shots: 120,
    empty: true,
  });
  expect(result.rows.find((r: any) => r.mode === "reload")).toMatchObject({
    reserve: 240,
    resumed: true,
  });
  expect(result.armor).toEqual({
    before: 1680,
    after: 1260,
    health: 150,
    riding: true,
    shells: 16,
  });
});
