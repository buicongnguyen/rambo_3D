import { test, expect } from "@playwright/test";
test("camera holds small movement, tracks without rotating, and identifies player across missions", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5177");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const result = await page.evaluate(() => {
    const { game: g, world: w } = (window as any).__nightfall;
    g.phase = "won";
    const origin = g.pos.clone();
    w.resetCamera(origin);
    let time = performance.now() / 1000;
    w.render(time, origin, false, true);
    const initial = w.camera.position.clone(),
      rotation = w.camera.quaternion.clone();
    const small = origin.clone().add({ x: 1, y: 0, z: 1 });
    for (let i = 0; i < 10; i++) w.render((time += 1 / 60), small, false, true);
    const stayed = w.camera.position.distanceTo(initial);
    const far = origin.clone().add({ x: 10, y: 0, z: 12 });
    w.render((time += 1 / 60), far, false, true);
    const first = w.camera.position.distanceTo(initial);
    for (let i = 0; i < 30; i++) w.render((time += 1 / 60), far, false, true);
    const angle = rotation.angleTo(w.camera.quaternion);
    const marker = w.playerIndicator;
    const tracked =
      marker.position.x === far.x &&
      marker.position.z === far.z &&
      marker.visible;
    w.render((time += 1 / 60), far, false, true, false);
    const hiddenOnDeath = !marker.visible;
    g.start(3, { power: 0, armor: 0, mobility: 0 }, "normal");
    g.phase = "won";
    const centered =
      Math.abs(w.camera.position.x - g.pos.x) < 0.001 &&
      Math.abs(w.camera.position.z - g.pos.z - 25) < 0.001;
    return { stayed, first, angle, tracked, hiddenOnDeath, centered };
  });
  expect(result.stayed).toBe(0);
  expect(result.first).toBeGreaterThan(0);
  expect(result.first).toBeLessThan(2);
  expect(result.angle).toBeLessThan(0.000001);
  expect(result.tracked).toBe(true);
  expect(result.hiddenOnDeath).toBe(true);
  expect(result.centered).toBe(true);
  await page.screenshot({ path: "docs/player-camera-desktop.png" });
});
