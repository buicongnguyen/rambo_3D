import { test, expect } from "@playwright/test";
test("drawing skips hidden rigs while refreshing visible actors, effects and terrain", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const result = await page.evaluate(async () => {
    const { game: g, world: w } = (window as any).__nightfall;
    g.start(8, { armor: 0, power: 0, mobility: 0 }, "crazy");
    g.phase = "won";
    const far = g.enemies.find(
      (e: any) => Math.hypot(e.x - g.pos.x, e.z - g.pos.z) > 70,
    );
    let calls = 0;
    const original = far.mesh.updateMatrixWorld;
    far.mesh.updateMatrixWorld = function (force: boolean) {
      calls++;
      return original.call(this, force);
    };
    g.player.position.x += 0.5;
    const ride = g.rides[0];
    ride.mesh.position.copy(g.pos);
    ride.mesh.position.x += 4;
    const time = performance.now() / 1000;
    w.resetCamera(g.pos);
    w.render(time, g.pos, false, true);
    const hiddenUpdates = calls;
    const playerWorld = g.player.matrixWorld.elements[12];
    const vehicleWorld = ride.mesh.matrixWorld.elements[12];
    const terrainTriangles = w.terrain.children.reduce(
      (sum: number, m: any) =>
        sum +
        (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3,
      0,
    );
    w.quality(true);
    w.render(time + 0.016, g.pos, false, true);
    const low = w.renderer.info.render.triangles;
    w.quality(false);
    w.render(time + 0.032, g.pos, false, true);
    const high = w.renderer.info.render.triangles;
    return {
      hiddenUpdates,
      playerWorld,
      playerX: g.pos.x,
      vehicleWorld,
      vehicleX: ride.mesh.position.x,
      terrainTriangles,
      terrainChunks: w.terrain.children.length,
      low,
      high,
      auto: w.scene.matrixWorldAutoUpdate,
    };
  });
  expect(result.hiddenUpdates).toBe(0);
  expect(result.playerWorld).toBeCloseTo(result.playerX);
  expect(result.vehicleWorld).toBeCloseTo(result.vehicleX);
  expect(result.terrainTriangles).toBeGreaterThan(1000);
  expect(result.terrainChunks).toBeGreaterThan(0);
  expect(result.high).toBeGreaterThan(result.low);
  expect(result.auto).toBe(true);
  await page.screenshot({ path: "docs/render-optimized-desktop.png" });
});
