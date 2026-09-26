import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}
// Static parts are merged per joint at export, so identify parts by material.
const named = (root: any, material: string) => {
  let found = false;
  root.traverse((o: any) => {
    const m = o.material;
    if (m && (Array.isArray(m) ? m : [m]).some((x: any) => x.name === material))
      found = true;
  });
  return found;
};

test("enemy ammo boxes use the Blender ammo can and also restock a boarded tank", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(
    async ({ namedSrc }) => {
      const named = new Function(`return ${namedSrc}`)();
      const { game: g, input } = (window as any).__nightfall;
      const { COVER, PATCHES } = await import("/src/missions.ts");
      g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
      COVER.length = PATCHES.length = 0;
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.invincible = 1e6;
      const v = g.rides.find((r: any) => r.kind === "tank");
      v.mesh.position.set(10, 0, 10);
      g.pos.copy(v.mesh.position);
      g.useRide();
      v.ammo = 10;
      const box = g.supplyCrate("ammo", 10.4, 10.2);
      box.userData.expires = g.elapsed + 45;
      g.pickups.push(box);
      const can = named(box, "Ammo can olive") && named(box, "Brass");
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
      const result = {
        can,
        shells: v.ammo,
        taken: !g.pickups.includes(box),
      };
      g.phase = "won";
      return result;
    },
    { namedSrc: named.toString() },
  );
  expect(r).toEqual({ can: true, shells: 14, taken: true });
});

test("women prisoners join as women allies and stay in the saved squad", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(
    async ({ namedSrc }) => {
      const named = new Function(`return ${namedSrc}`)();
      const { game: g, input } = (window as any).__nightfall;
      g.start(1, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.invincible = 1e6;
      const cells = g.prisons.map((p: any) => ({
        woman: p.woman,
        braid: named(p.captive, "Auburn hair") && named(p.captive, "Hemp rope"),
      }));
      const p = g.prisons.find((p: any) => p.woman);
      g.pos.set(p.box.exit.x, 0, p.box.exit.z);
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
      const ally = g.squad.allies[0];
      const joined = {
        woman: ally.woman,
        ponytail:
          named(ally.mesh, "Auburn hair") &&
          named(ally.mesh, "Tied jacket olive"),
        armed: ally.motion.joints.get("Weapon").node.children.length > 0,
      };
      g.phase = "won";
      g.onEnd(true);
      return { cells, joined };
    },
    { namedSrc: named.toString() },
  );
  expect(r.cells[0]).toEqual({ woman: true, braid: true });
  if (r.cells[1]) expect(r.cells[1]).toEqual({ woman: false, braid: false });
  expect(r.joined).toEqual({ woman: true, ponytail: true, armed: true });
  const saved = await page.evaluate(() => {
    const { save, game: g } = (window as any).__nightfall;
    // The saved woman ally deploys with the squad on the next mission.
    g.start(2, save, "normal");
    const women = g.squad.allies.filter((a: any) => a.woman).length;
    g.phase = "won";
    return { squad: save.squad, women: save.women, deployed: women };
  });
  expect(saved).toEqual({ squad: 1, women: 1, deployed: 1 });
});

test("ninjas arrive from stage 5 with katanas and outrun riflemen; early stages have none", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(
    async ({ namedSrc }) => {
      const named = new Function(`return ${namedSrc}`)();
      const { game: g, input } = (window as any).__nightfall;
      const { COVER, PATCHES } = await import("/src/missions.ts");
      const early = [0, 3, 6, 9].map((m) => {
        g.start(m, { armor: 0, power: 0, mobility: 0 }, "normal");
        return g.enemies.filter((e: any) => e.role === "ninja").length;
      });
      g.start(12, { armor: 0, power: 0, mobility: 0 }, "normal");
      const ninjas = g.enemies.filter((e: any) => e.role === "ninja");
      const look = ninjas.every(
        (e: any) =>
          named(e.mesh, "Ninja indigo") &&
          !!e.mesh.getObjectByName("ninja_gear"),
      );
      const swords = g.enemies.filter(
        (e: any) => e.role === "swordsman",
      ).length;
      COVER.length = PATCHES.length = 0;
      g.invincible = 1e6;
      g.pos.set(0, 0, 0);
      const ninja = ninjas[0],
        rifleman = g.enemies.find((e: any) => e.role === "rifleman");
      for (const e of g.enemies) if (e !== ninja && e !== rifleman) e.hp = 0;
      const place = (e: any, x: number) => {
        Object.assign(e, { x, z: 22, alerted: true, cool: 1e6 });
        e.mesh.position.set(x, 0, 22);
        e.mesh.rotation.y = Math.PI;
      };
      place(ninja, -6);
      place(rifleman, 6);
      for (let i = 0; i < 40; i++)
        g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
      const moved = (e: any, x: number) => Math.hypot(e.x - x, e.z - 22);
      const result = {
        early,
        count: ninjas.length,
        look,
        swords,
        ratio: moved(ninja, -6) / moved(rifleman, 6),
      };
      g.phase = "won";
      return result;
    },
    { namedSrc: named.toString() },
  );
  expect(r.early).toEqual([0, 0, 0, 0]);
  expect(r.count).toBeGreaterThan(0);
  expect(r.look).toBe(true);
  expect(r.swords).toBeGreaterThan(0);
  expect(r.ratio).toBeGreaterThan(2);
});

test("late finales add the IRON SOVEREIGN escort (not on Easy) and stage 7 is led by the SKY WRAITH", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    const kinds = (index: number, difficulty: string) => {
      g.start(index, { armor: 0, power: 0, mobility: 0 }, difficulty);
      g.invincible = 1e6;
      const m = MISSIONS[index];
      g.pos.set(m.objective.x, 0, m.objective.z);
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, interact: true });
      return g.enemies
        .filter((e: any) => e.boss)
        .map((e: any) => e.bossKind)
        .join(",");
    };
    const rows = {
      early: kinds(2, "normal"),
      faultline: kinds(17, "normal"),
      faultlineEasy: kinds(17, "easy"),
      mire: kinds(20, "normal"),
      mireCrazy: kinds(20, "crazy"),
    };
    g.phase = "won";
    return rows;
  });
  expect(rows).toEqual({
    early: "gunship",
    faultline: "rocketMech,walker",
    faultlineEasy: "rocketMech",
    mire: "skyWraith,walker",
    mireCrazy: "skyWraith,walker,skyWraith,walker",
  });
});

test("IRON SOVEREIGN locks three lines, fires one shell down each and vents its core every third volley", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { SOVEREIGN } = await import("/src/bosses.mjs");
    g.start(17, { armor: 0, power: 0, mobility: 0 }, "normal");
    COVER.length = PATCHES.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1e6;
    g.pos.set(0, 0, 0);
    const e = g.spawn(0, 12, true, 100, "walker");
    const cmd = { ...input, x: 0, z: 0, fire: false };
    const step = (s: number) => {
      for (let i = 0; i < Math.round(s * 60); i++) g.update(1 / 60, cmd);
    };
    const hostile = () => g.bullets.filter((b: any) => b.enemy).length;
    e.cool = 0;
    step(2 / 60);
    const lock = {
      locked: e.lockTime !== undefined,
      fan: e.warn.visible && e.warn.geometry.attributes.position.count === 12,
      state: e.state,
    };
    const before = hostile();
    step(SOVEREIGN.lock + 0.05);
    const volley = hostile() - before;
    for (let v = 0; v < 2; v++) {
      e.cool = 0;
      step(SOVEREIGN.lock + 0.1);
    }
    step(0.4);
    const vent = e.muzzles.get("Vent0").rotation.z;
    const result = {
      lock,
      volley,
      venting: e.vent > 0,
      state: e.state,
      exposed: g.bossExposed(e),
      vent,
    };
    g.phase = "won";
    return result;
  });
  expect(r.lock).toEqual({ locked: true, fan: true, state: "CANNONS LOCKING" });
  expect(r.volley).toBe(3);
  expect(r.venting).toBe(true);
  expect(r.state).toBe("VENTING / CORE EXPOSED");
  expect(r.exposed).toBe(true);
  expect(r.vent).toBeGreaterThan(0.5);
});

test("SKY WRAITH alternates rocket rain and a gun run, then hovers low and exposed", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WRAITH } = await import("/src/bosses.mjs");
    g.start(20, { armor: 0, power: 0, mobility: 0 }, "normal");
    COVER.length = PATCHES.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.pos.set(0, 0, 0);
    g.invincible = 1e6;
    const e = g.spawn(0, 13, true, 100, "skyWraith");
    const cmd = { ...input, x: 0, z: 0, fire: false };
    const step = (s: number) => {
      for (let i = 0; i < Math.round(s * 60); i++) g.update(1 / 60, cmd);
    };
    const rotor = e.muzzles.get("Rotor").quaternion.clone();
    e.cool = 0;
    step(1 / 60);
    const rain = {
      rings: g.hazards.length,
      rockets: g.hazards.filter((h: any) => h.rock).length,
      airborne: e.mesh.position.y > 3,
    };
    step(WRAITH.rain.warning + 0.2);
    // The gun run lines up on the player: stand still and take one hit.
    g.invincible = 0;
    g.hp = 1000;
    e.cool = 0;
    step(2 / 60);
    const run = {
      rings: g.hazards.length,
      state: e.state,
      active: !!e.run,
    };
    step(WRAITH.run.warning + WRAITH.run.count * WRAITH.run.step + 0.5);
    const hurt = 1000 - g.hp;
    g.invincible = 1e6;
    step(1.2);
    const result = {
      rain,
      run,
      hurt,
      state: e.state,
      exposed: g.bossExposed(e),
      low: e.mesh.position.y < 2.2,
      spun: e.muzzles.get("Rotor").quaternion.angleTo(rotor) > 0.1,
      tail: Math.abs(e.muzzles.get("TailRotor").rotation.x) > 0.1,
    };
    g.phase = "won";
    return result;
  });
  expect(r.rain).toEqual({ rings: 3, rockets: 3, airborne: true });
  expect(r.run).toEqual({
    rings: 7,
    state: "GUN RUN / MOVE OFF THE LINE",
    active: true,
  });
  expect(r.hurt).toBeGreaterThan(0);
  expect(r.hurt).toBeLessThan(40);
  expect(r).toMatchObject({
    state: "LOW HOVER / REARMING",
    exposed: true,
    low: true,
    spun: true,
    tail: true,
  });
});
