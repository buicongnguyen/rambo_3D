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
test("articulated run/walk, blocked gait, reload and dodge direction", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.onSound = () => {};
    const command = { ...input, x: 1, z: 0, fire: false, assist: true };
    for (let i = 0; i < 19; i++) g.update(1 / 60, command);
    const a = g.playerMotion,
      j = a.joints;
    const run = {
      state: a.state,
      left: j.get("ThighL").node.quaternion.toArray(),
      right: j.get("ThighR").node.quaternion.toArray(),
    };
    for (let i = 0; i < 25; i++) g.update(1 / 60, { ...command, fire: true });
    const walk = a.state;
    g.pos.set(-7, 0, 16.49);
    for (let i = 0; i < 45; i++) g.update(1 / 60, { ...command, x: 0, z: -1 });
    const stopped = a.speed;
    g.pos.set(0, 0, 23);
    g.dashCooldown = 0;
    g.update(1 / 60, { ...command, x: 1, z: 0, dodge: true });
    const before = g.pos.x;
    g.update(1 / 60, { ...command, x: 0, z: 0, dodge: false });
    const after = g.pos.x;
    return {
      run,
      walk,
      stopped,
      dashContinues: after > before,
      joints: j.size,
    };
  });
  expect(r.joints).toBeGreaterThanOrEqual(13);
  expect(r.run.state).toBe("run");
  expect(r.run.left).not.toEqual(r.run.right);
  expect(r.walk).toBe("walk");
  expect(r.stopped).toBeLessThan(0.05);
  expect(r.dashContinues).toBe(true);
});
test("death falls, holds, fades independently and is cleaned on retry", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { game: g } = (window as any).__nightfall;
    g.onSound = () => {};
    const e = g.enemies[0],
      other = g.enemies[1];
    const mats = (root: any) => {
      const a: any[] = [];
      root.traverse((o: any) => {
        if (o.isMesh)
          a.push(...(Array.isArray(o.material) ? o.material : [o.material]));
      });
      return a;
    };
    g.hurt(e, 999);
    const kills = g.kills;
    g.hurt(e, 999);
    const once = g.kills === kills;
    const corpse = g.corpses[0];
    g.updatePresentation(0.8);
    const fall = e.motion.joints.get("Motion").node.rotation.x,
      held = corpse.opacity,
      parent = !!e.mesh.parent;
    g.updatePresentation(2.2);
    const faded = corpse.opacity,
      alive = mats(other.mesh).every((m) => m.opacity === 1);
    g.updatePresentation(1.1);
    const removed = !e.mesh.parent && corpse.disposed;
    g.hurt(other, 999);
    g.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
    return {
      once,
      fall,
      held,
      parent,
      faded,
      alive,
      removed,
      remaining: g.corpses.length,
    };
  });
  expect(r.once).toBe(true);
  expect(Math.abs(r.fall)).toBeGreaterThan(1);
  expect(r.held).toBe(1);
  expect(r.parent).toBe(true);
  expect(r.faded).toBeGreaterThan(0);
  expect(r.faded).toBeLessThan(1);
  expect(r.alive).toBe(true);
  expect(r.removed).toBe(true);
  expect(r.remaining).toBe(0);
});
test("player defeat finishes visibly before retry, and bridge supports feet", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const h = (window as any).__nightfall,
      g = h.game;
    g.onSound = () => {};
    g.hp = 0;
    g.update(1 / 60, h.input);
    const early = g.phase;
    for (let i = 0; i < 180; i++) g.update(1 / 60, h.input);
    const middle = g.phase,
      opacity = g.corpses[0].opacity;
    for (let i = 0; i < 66; i++) g.update(1 / 60, h.input);
    return { early, middle, opacity, end: g.phase };
  });
  expect(result.early).toBe("dying");
  expect(result.middle).toBe("dying");
  expect(result.opacity).toBeLessThan(1);
  expect(result.end).toBe("lost");
  await expect(page.locator("#result-primary")).toBeVisible();
  const y = await page.evaluate(() => {
    const h = (window as any).__nightfall;
    h.game.start(1, { armor: 0, power: 0, mobility: 0 }, "normal");
    h.game.pos.set(0, 0, -14);
    h.game.update(1 / 60, { ...h.input, x: 0, z: 0, fire: false });
    return h.game.pos.y;
  });
  expect(y).toBe(0);
});
test("animation pose reference sheet", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const h = (window as any).__nightfall;
    const { model } = await import("/src/world.ts");
    const { CharacterMotion, FallenBody } = await import("/src/animation.ts");
    const T = await import("/tests/scene-fixtures.ts");
    h.game.onSound = () => {};
    h.game.phase = "won";
    h.world.terrain.clear();
    h.world.actors.clear();
    h.world.scene.fog = null;
    h.world.scene.background = new T.Color("#263b34");
    const floor = new T.Mesh(
      new T.PlaneGeometry(50, 50),
      new T.MeshStandardMaterial({ color: 0x64745a }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    h.world.terrain.add(floor);
    for (let i = 0; i < 4; i++) {
      const g = model("commando", (i - 1.5) * 2.8, 0, 1.5);
      h.world.actors.add(g);
      const m = new CharacterMotion(g);
      g.rotation.y = 0.4;
      if (i === 0) m.update(0.1, { vx: 0, vz: 0 });
      if (i === 1)
        for (let k = 0; k < 12; k++) m.update(1 / 60, { vx: 0, vz: 2 });
      if (i === 2)
        for (let k = 0; k < 10; k++) m.update(1 / 60, { vx: 0, vz: 6.2 });
      if (i === 3) {
        const corpse = new FallenBody(g, m);
        corpse.update(1);
      }
    }
    h.world.render = () => {
      h.world.camera.position.set(5, 6, 14);
      h.world.camera.lookAt(0, 1, 0);
      h.world.renderer.render(h.world.scene, h.world.camera);
    };
    document
      .querySelectorAll("#hud,#brand,#menu,.vignette")
      .forEach((e) => ((e as HTMLElement).hidden = true));
    const title = document.createElement("div");
    title.textContent = "IDLE   /   WALK   /   RUN   /   FALLEN";
    title.style.cssText =
      "position:fixed;left:30px;top:30px;color:#eff0dc;font:20px monospace;letter-spacing:3px";
    document.body.append(title);
  });
  await page.screenshot({ path: "docs/animation-poses.png" });
});

test("weapon switches preserve magazines without granting ammunition", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.onSound = () => {};
    g.ammo = 9;
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, swap: true });
    const secondary = g.ammo;
    g.ammo = 0;
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, swap: true });
    const primary = g.ammo;
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false, swap: true });
    return { secondary, primary, returned: g.ammo };
  });
  expect(result).toEqual({ secondary: 1, primary: 9, returned: 0 });
});
