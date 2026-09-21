import { test, expect } from "@playwright/test";
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("relay secures automatically, then guards walk out of houses in waves before extraction", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    g.start(1, { armor: 0, power: 0, mobility: 0 }, "crazy");
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const m = MISSIONS[1],
      cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.pos.set(m.objective.x, 0, m.objective.z + 3.2);
    g.update(1 / 60, { ...cmd });
    const outside = !g.objective;
    g.pos.z = m.objective.z + 2.5;
    g.update(1 / 60, { ...cmd });
    const auto = g.objective,
      score = g.score;
    const delayed =
      g.guardIds.size === 0 && g.pendingGuards === 12 && !g.bossDead;
    const origins: boolean[] = [],
      walked: boolean[] = [];
    let gateHolds = true,
      firstKilled = false,
      lastSize = 0;
    const startPositions = new Map<any, any>();
    for (let frame = 0; frame < 1800 && !g.bossDead; frame++) {
      g.update(1 / 60, { ...cmd });
      for (const e of g.guardIds as Set<any>) {
        if (!startPositions.has(e)) {
          const h = e.emerging;
          origins.push(
            !!h && Math.hypot(e.x - h.entrance.x, e.z - h.entrance.z) < 0.1,
          );
          startPositions.set(e, { x: e.x, z: e.z, house: h });
          gateHolds &&= g.guardIds.size - lastSize === 1;
          lastSize = g.guardIds.size;
        }
        if (e.hp > 0 && !e.emerging) {
          const p = startPositions.get(e);
          walked.push(
            Math.hypot(e.x - p.x, e.z - p.z) > 1.9 &&
              COVER.every(
                (b: any) =>
                  segmentBox(e.x, e.z, e.x, e.z, b, 0.65) === Infinity,
              ),
          );
          g.hurt(e, 9999);
          if (!firstKilled) {
            firstKilled = true;
            gateHolds &&= g.pendingGuards > 0 && !g.bossDead;
          }
        }
      }
    }
    const cleared = g.pendingGuards === 0 && g.bossDead && g.world.exit.visible;
    const oneCapture = g.score - score === 12 * 100;
    g.phase = "won";
    return {
      outside,
      auto,
      delayed,
      origins,
      walked,
      gateHolds,
      cleared,
      oneCapture,
    };
  });
  expect(result).toMatchObject({
    outside: true,
    auto: true,
    delayed: true,
    gateHolds: true,
    cleared: true,
    oneCapture: true,
  });
  expect(result.origins).toHaveLength(12);
  expect(result.origins.every(Boolean)).toBe(true);
  expect(result.walked).toHaveLength(12);
  expect(result.walked.every(Boolean)).toBe(true);
});

test("blocked house doors wait without teleporting, resume after clearing, and reset on restart", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.invincible = 1000;
    const m = MISSIONS[0],
      houses = COVER.filter((b: any) => b.asset === "relayHouse");
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.pos.set(m.objective.x, 0, m.objective.z);
    g.update(1 / 60, { ...cmd });
    for (const h of houses) g.spawn(h.exit.x, h.exit.z, false, 900);
    // Park ordinary guards across both doors; their unalerted idle behavior keeps the test deterministic.
    for (const e of g.enemies)
      if (e.hp > 0) {
        e.alerted = false;
        e.memory = 0;
        e.mesh.rotation.y = Math.PI;
      }
    const blockers = g.enemies.filter((e: any) => e.hp > 0);
    g.pos.set(m.start.x, 0, m.start.z);
    for (let i = 0; i < 120; i++) g.update(1 / 60, { ...cmd });
    const waited =
      g.guardIds.size === 0 && g.pendingGuards === 2 && !g.bossDead;
    for (const e of blockers) e.hp = 0;
    for (let i = 0; i < 120; i++) g.update(1 / 60, { ...cmd });
    const resumed = g.guardIds.size === 2 && g.pendingGuards === 0;
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    const reset =
      !g.objective && g.pendingGuards === 0 && g.guardIds.size === 0;
    g.phase = "won";
    return { waited, resumed, reset };
  });
  expect(result).toEqual({ waited: true, resumed: true, reset: true });
});

test("vehicles secure relays without exiting, walls block remote activation, and paused play cannot secure", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.enemies.forEach((e: any) => (e.hp = 0));
    const m = MISSIONS[3],
      cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    g.pos.set(m.objective.x, 0, m.objective.z + 2);
    COVER.push({
      x: m.objective.x,
      z: m.objective.z + 1,
      w: 2,
      d: 0.2,
      kind: "screen",
    });
    g.update(1 / 60, { ...cmd });
    const blocked = !g.objective;
    COVER.pop();
    g.phase = "won";
    g.update(1 / 60, { ...cmd });
    const paused = !g.objective;
    g.phase = "playing";
    const tank = g.rides.find((v: any) => v.kind === "tank");
    tank.mesh.position.set(m.objective.x, 0, m.objective.z);
    g.riding = tank;
    g.pos.copy(tank.mesh.position);
    g.update(1 / 60, { ...cmd });
    const captured = g.objective && g.riding === tank && g.pendingGuards > 0;
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.pos.set(MISSIONS[0].objective.x, 0, MISSIONS[0].objective.z);
    g.hp = 0;
    g.update(1 / 60, { ...cmd });
    const dead = !g.objective && g.pendingGuards === 0;
    g.phase = "won";
    return { blocked, paused, captured, dead };
  });
  expect(result).toEqual({
    blocked: true,
    paused: true,
    captured: true,
    dead: true,
  });
});

test("relay houses and emerging infantry render in the snow battlefield", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { game: g, input, world: w } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    const { model } = await import("/src/world.ts");
    const T = await import("/tests/scene-fixtures.ts");
    const house = model("relayHouse");
    house.updateMatrixWorld(true);
    const throughDoor = new T.Raycaster(
      new T.Vector3(0, 1.3, 5),
      new T.Vector3(0, 0, -1),
    ).intersectObject(house, true)[0];
    const intoWall = new T.Raycaster(
      new T.Vector3(1.7, 1.3, 5),
      new T.Vector3(0, 0, -1),
    ).intersectObject(house, true)[0];
    if (
      !throughDoor ||
      throughDoor.distance < 3.7 ||
      !intoWall ||
      intoWall.distance > 2.1
    )
      throw new Error(
        "Barracks doorway must be open while its facade stays solid",
      );
    w.quality(false);
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.enemies.forEach((e: any) => {
      e.hp = 0;
      e.mesh.removeFromParent();
      e.warn.removeFromParent();
    });
    g.pos.set(MISSIONS[0].objective.x, 0, MISSIONS[0].objective.z + 1);
    g.invincible = 1000;
    for (let i = 0; i < 70; i++)
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, interact: false });
    g.phase = "won";
    w.resetCamera(g.pos);
  });
  await expect(page.locator("#objectives")).toContainText(
    "✓ Find their signal",
  );
  await expect(page.locator("#interact-prompt")).toBeHidden();
  await page.screenshot({ path: "docs/relay-houses.png" });
});
