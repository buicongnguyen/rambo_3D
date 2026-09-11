import { test, expect } from "@playwright/test";
test("detailed Blender assets retain textures and efficient batches", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const result = await page.evaluate(async () => {
    const h = (window as any).__nightfall;
    const { model } = await import("/src/world.ts");
    const T = await import("/tests/scene-fixtures.ts");
    h.game.phase = "won";
    h.world.actors.clear();
    h.world.terrain.clear();
    h.world.scene.fog = null;
    h.world.marker.visible = false;
    h.world.exit.visible = false;
    h.world.scene.background = new T.Color("#29332f");
    const floor = new T.Mesh(
      new T.PlaneGeometry(80, 80),
      new T.MeshStandardMaterial({ color: 0x62685d, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    h.world.terrain.add(floor);
    let textured = 0;
    for (const [name, x, z, scale] of [
      ["tank", -5, 0, 1],
      ["gunship", 4, -3, 1],
      ["commando", -3, 6, 1.6],
      ["crate", 1, 6, 1.4],
      ["barge", 8, 6, 0.65],
    ] as const) {
      const g = model(name, x, z, scale);
      g.rotation.y = 0.35;
      g.traverse((o: any) => {
        if (o.isMesh && o.material.map) textured++;
      });
      h.world.actors.add(g);
    }
    h.world.render = () => {
      h.world.camera.position.set(12, 12, 21);
      h.world.camera.lookAt(1, 1, 2);
      h.world.renderer.render(h.world.scene, h.world.camera);
    };
    document
      .querySelectorAll("#hud,#brand,#menu,.vignette")
      .forEach((e) => ((e as HTMLElement).hidden = true));
    h.world.render();
    return { textured, calls: h.world.renderer.info.render.calls };
  });
  expect(result.textured).toBeGreaterThan(10);
  expect(result.calls).toBeLessThan(450);
  await page.screenshot({ path: "docs/art-upgrade.png" });
  expect(errors).toEqual([]);
});
