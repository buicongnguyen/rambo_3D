import { test, expect } from "@playwright/test";
test("vehicle and weapon Blender gallery renders", async ({ page }) => {
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
  await page.evaluate(async () => {
    const h = (window as any).__nightfall;
    const { model } = await import("/src/world.ts"),
      { WEAPONS } = await import("/src/arsenal.ts"),
      T = await import("/tests/scene-fixtures.ts");
    h.game.phase = "won";
    h.world.terrain.clear();
    h.world.actors.clear();
    h.world.scene.fog = null;
    h.world.scene.background = new T.Color("#26372e");
    h.world.marker.visible = false;
    h.world.exit.visible = false;
    const floor = new T.Mesh(
      new T.PlaneGeometry(70, 70),
      new T.MeshStandardMaterial({ color: 0x647366, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    h.world.terrain.add(floor);
    for (let i = 0; i < 3; i++) {
      const v = h.game.rides[i];
      v.mesh.position.set((i - 1) * 5, 0, -2);
      v.mesh.rotation.y = 0.35;
      v.rider.visible = true;
      h.world.actors.add(v.mesh);
    }
    for (let i = 0; i < WEAPONS.length; i++) {
      const mesh = model(
        "weapon_" + WEAPONS[i].id,
        ((i % 6) - 2.5) * 2.2,
        4 + Math.floor(i / 6) * 2.5,
        2.5,
      );
      mesh.position.y = 0.65;
      mesh.rotation.y = 0.4;
      h.world.actors.add(mesh);
    }
    h.world.render = () => {
      h.world.camera.position.set(12, 16, 23);
      h.world.camera.lookAt(0, 0.8, 2);
      h.world.renderer.render(h.world.scene, h.world.camera);
    };
    document
      .querySelectorAll("#hud,#brand,#menu,.vignette")
      .forEach((e) => ((e as HTMLElement).hidden = true));
    const caption = document.createElement("p");
    caption.textContent = "MOTORCYCLE / JEEP / TANK  —  ELEVEN WEAPON TYPES";
    caption.style.cssText =
      "position:fixed;top:24px;left:30px;color:#eff0dc;font:16px monospace;letter-spacing:2px";
    document.body.append(caption);
  });
  await page.screenshot({ path: "docs/vehicles-weapons.png" });
});
