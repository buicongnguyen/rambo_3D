import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
});

test("squad follows a turn at staggered distances along the player's trail", async ({
  page,
}) => {
  const positions = await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.phase = "won";
    const squad = g.squad;
    squad.clear();
    squad.deploy(2, { x: 0, z: 0 }, []);
    function step(x: number, z: number) {
      squad.update(1 / 60, { x, z }, false, false, 0, [], () => {});
    }
    for (let tick = 0; tick <= 240; tick++) step(tick / 60, 0);
    for (let tick = 1; tick <= 120; tick++) step(4, tick / 60);
    for (let tick = 0; tick < 120; tick++) step(4, 2);
    return squad.allies.map(({ mesh }: any) => ({
      x: mesh.position.x,
      z: mesh.position.z,
    }));
  });
  // The leader is just before the turn. The second ally is still on the first leg.
  expect(positions[0].x).toBeCloseTo(3.7, 0);
  expect(positions[1].x).toBeCloseTo(2.4, 0);
  for (const p of positions) expect(Math.abs(p.z)).toBeLessThan(0.5);
});

test("boarding uses the closest accessible hull and respects intervening cover", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const g = (window as any).__nightfall.game;
    const { COVER } = await import("/src/missions.ts");
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal", 247);
    g.phase = "won";
    COVER.length = 0;
    const [bike, jeep, tank] = g.rides;
    g.pos.set(0, 0, 0);
    bike.mesh.position.set(-2.5, 0, 0);
    jeep.mesh.position.set(2.4, 0, 0);
    tank.mesh.position.set(15, 0, 15);
    const closest = g.nearestRide?.kind;
    COVER.push({ x: 0.5, z: 0, w: 0.2, d: 4, kind: "building" });
    const reachable = g.nearestRide?.kind;
    bike.hp = 0;
    const available = !!g.nearestRide;
    g.useRide();
    return { closest, reachable, available, boarded: !!g.riding, x: g.pos.x };
  });
  expect(result).toEqual({
    closest: "jeep",
    reachable: "motorcycle",
    available: false,
    boarded: false,
    x: 0,
  });
});

test("relay retry regroups returning and freshly rescued allies at the relay", async ({
  page,
}) => {
  const squad = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS, COVER } = await import("/src/missions.ts");
    const { segmentBox } = await import("/src/rules.mjs");
    const kit = { armor: 0, power: 0, mobility: 0, squad: 1, women: 1 };
    g.start(0, kit, "normal", 247);
    const cmd = { ...input, x: 0, z: 0, fire: false };
    const cell = g.prisons[0].box;
    g.pos.set(cell.exit.x, 0, cell.exit.z);
    g.update(1 / 60, { ...cmd });
    const relay = MISSIONS[0].objective;
    g.pos.set(relay.x, 0, relay.z);
    g.update(1 / 60, { ...cmd });
    g.restoreCheckpoint(kit, "normal");
    g.phase = "won";
    const boxes = [
      ...COVER,
      ...g.rides.filter((v: any) => v.hp > 0).map((v: any) => v.box),
    ];
    return {
      women: g.squad.women,
      positions: g.squad.allies.map(({ mesh }: any) => {
        const { x, z } = mesh.position;
        return {
          distance: Math.hypot(x - g.pos.x, z - g.pos.z),
          clear: boxes.every(
            (b) => segmentBox(x, z, x, z, b, 0.4) === Infinity,
          ),
        };
      }),
    };
  });
  expect(squad.women).toBe(1);
  expect(squad.positions).toHaveLength(2);
  for (const p of squad.positions) {
    expect(p.distance).toBeLessThan(6);
    expect(p.clear).toBe(true);
  }
});
