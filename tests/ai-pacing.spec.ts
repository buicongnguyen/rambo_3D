import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("route-progress ambushes flank the road ahead from stage 3, once each, never earlier", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    const { projectOnRoute, pointAlong } = await import("/src/guidance.mjs");
    const radio: string[] = [];
    const onRadio = g.onRadio;
    g.onRadio = (t: string) => radio.push(t);
    const cmd = { ...input, x: 0, z: 0, fire: false };
    // Stand `share` of the way down the road to the relay and take one step.
    const advance = (index: number, share: number) => {
      const m = MISSIONS[index];
      const relay = projectOnRoute(m.route, m.objective.x, m.objective.z).along;
      const p = pointAlong(m.route, relay * share);
      g.pos.set(p.x, 0, p.z);
      const before = g.enemies.length;
      g.update(1 / 60, cmd);
      return g.enemies.slice(before);
    };
    const run = (index: number, shares: number[]) => {
      g.start(index, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.invincible = 1e6;
      return shares.map((s) => advance(index, s));
    };
    const early = run(3, [0.6, 0.95]).map((a) => a.length);
    const [before, first, repeat] = run(9, [0.3, 0.55, 0.6]);
    const pos = { x: g.pos.x, z: g.pos.z };
    const squad = {
      sizes: [before.length, first.length, repeat.length],
      alerted: first.every((e: any) => e.alerted && e.lastSeen),
      ahead: first.every((e: any) => {
        const d = Math.hypot(e.x - pos.x, e.z - pos.z);
        return d > 18 && d < 60;
      }),
    };
    const late = run(12, [0.4, 0.75]).map((a) => a.length);
    g.onRadio = onRadio;
    g.phase = "won";
    return { early, squad, late, radio: radio.filter((t) => /Ambush/.test(t)) };
  });
  expect(r.early).toEqual([0, 0]);
  expect(r.squad).toEqual({ sizes: [0, 3, 0], alerted: true, ahead: true });
  expect(r.late).toEqual([4, 4]);
  expect(r.radio.length).toBe(3);
});

test("a soldier who spots you calls out to nearby squadmates, except on Easy", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const trial = (difficulty: string) => {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, difficulty);
      COVER.length = PATCHES.length = 0;
      g.invincible = 1e6;
      g.pos.set(0, 0, 0);
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
      const [a, b] = g.enemies.filter((e: any) => e.role === "rifleman");
      for (const e of g.enemies) if (e !== a && e !== b) e.hp = 0;
      const put = (e: any, x: number, z: number, yaw: number) => {
        Object.assign(e, {
          x,
          z,
          alerted: false,
          lastSeen: undefined,
          memory: 0,
        });
        e.mesh.position.set(x, 0, z);
        e.mesh.rotation.y = yaw;
      };
      put(a, 0, 10, Math.PI); // facing the player
      put(b, 4, 12, 0); // facing away, 4.5 m from the spotter
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
      return { spotter: a.alerted, squadmate: b.alerted, reaction: a.cool };
    };
    const result = { normal: trial("normal"), easy: trial("easy") };
    g.phase = "won";
    return result;
  });
  expect(r.normal).toMatchObject({ spotter: true, squadmate: true });
  expect(r.easy).toMatchObject({ spotter: true, squadmate: false });
  expect(r.easy.reaction).toBeGreaterThan(1);
});

test("Crazy riflemen lead a moving player; Normal riflemen aim at where you are", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const trial = (difficulty: string) => {
      g.start(3, { armor: 0, power: 0, mobility: 0 }, difficulty);
      COVER.length = PATCHES.length = 0;
      g.invincible = 1e6;
      g.pos.set(0, 0, 0);
      const e = g.enemies.find((a: any) => a.role === "rifleman");
      for (const o of g.enemies) if (o !== e) o.hp = 0;
      Object.assign(e, { x: 0, z: 12, alerted: true, memory: 6, cool: 1e6 });
      e.lastSeen = { x: 0, z: 0 };
      e.mesh.position.set(0, 0, 12);
      e.mesh.rotation.y = Math.PI;
      const cmd = { ...input, x: 0, z: 0, fire: false };
      for (let i = 0; i < 20; i++) {
        g.pos.x += 0.07; // 4.2 m/s to the right
        g.update(1 / 60, cmd);
      }
      e.cool = 0;
      const before = g.bullets.length;
      g.pos.x += 0.07;
      g.update(1 / 60, cmd);
      const shots = g.bullets.slice(before).filter((b: any) => b.enemy);
      // Compare aim directions as vectors (angles near pi would wrap).
      const vx = shots.reduce((s: number, b: any) => s + b.vx, 0),
        vz = shots.reduce((s: number, b: any) => s + b.vz, 0);
      const dx = g.pos.x - e.x,
        dz = g.pos.z - e.z;
      const turn = Math.atan2(vx * dz - vz * dx, vx * dx + vz * dz);
      // Lateral aim component toward +x (the way the player runs), per metre.
      const lead = vx / Math.hypot(vx, vz) - dx / Math.hypot(dx, dz);
      return { shots: shots.length, offset: turn, lead };
    };
    const result = { normal: trial("normal"), crazy: trial("crazy") };
    g.phase = "won";
    return result;
  });
  expect(r.normal.shots).toBe(2);
  expect(r.crazy.shots).toBe(2);
  expect(Math.abs(r.normal.offset)).toBeLessThan(0.02);
  expect(Math.abs(r.crazy.offset)).toBeGreaterThan(0.15);
  // The player runs toward +x, so a leading shot aims further toward +x.
  expect(r.crazy.lead).toBeGreaterThan(0.1);
});

test("render interpolation blends a crowded Crazy city cheaply and restores the simulation", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { game: g, world, interpolator: it } = (window as any).__nightfall;
    g.start(14, { armor: 0, power: 0, mobility: 0 }, "crazy");
    const actors = world.actors.children.length;
    const start = g.pos.clone();
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      it.capture(world.actors);
      g.pos.x += 0.1;
      for (const e of g.enemies) e.mesh.position.x += 0.05;
      it.apply(world.actors, 0.5);
      it.restore();
    }
    const cost = (performance.now() - t0) / 20;
    it.capture(world.actors);
    g.pos.x += 0.1;
    it.apply(world.actors, 0.25);
    const blended = g.pos.x - start.x;
    it.restore();
    const restored = g.pos.x - start.x;
    g.phase = "won";
    return { actors, cost, blended, restored };
  });
  expect(r.actors).toBeGreaterThan(500);
  expect(r.cost).toBeLessThan(4);
  expect(r.blended).toBeCloseTo(2.025, 5);
  expect(r.restored).toBeCloseTo(2.1, 5);
});
