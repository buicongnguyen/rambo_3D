import { test, expect } from "@playwright/test";
import { installDrawProbe } from "../scripts/render-probe.mjs";

test("coloured instance batches preserve finishes, animation, fades and buffer lifetime", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(async () => {
      const { checkColorBatches } =
        await import("/tests/fixtures/render-batches.ts");
      return checkColorBatches();
    }),
  ).toBe(true);
});
test("growing mobile sprite sheets releases the replaced instance buffers", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(async () => {
      const { checkSpriteGrowth } =
        await import("/tests/fixtures/render-batches.ts");
      return checkSpriteGrowth();
    }),
  ).toBe(true);
});
for (const profile of [
  { name: "desktop shadows", low: false, sprites: false, calls: 530 },
  { name: "phone 3D", low: true, sprites: false, calls: 250 },
  { name: "phone 2.5D", low: true, sprites: true, calls: 90 },
])
  test(`real GPU draw budget includes every pass: ${profile.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      profile.low ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    );
    await page.addInitScript(installDrawProbe);
    await page.goto("/");
    await expect(page.locator("#deploy")).toBeEnabled();
    await page.locator("#deploy").click();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const result = await page.evaluate(async (profile) => {
      const { game: g, world: w } = (window as any).__nightfall;
      w.setMode25d(profile.sprites);
      if (profile.sprites) await w.sprites.load("/");
      const captures = [];
      let material: any;
      for (let repeat = 0; repeat < 3; repeat++) {
        // Revisit the city after another mission, not just the same scene.
        if (repeat)
          g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal", 98765);
        g.start(14, { armor: 0, power: 3, mobility: 3 }, "crazy", 98765);
        g.phase = "won";
        w.quality(profile.low);
        w.cameraOverride = undefined;
        w.guide = undefined;
        const enemy = g.enemies[Math.floor(g.enemies.length * 0.45)];
        g.pos.set(enemy.x, 0, enemy.z);
        g.player.position.copy(g.pos);
        w.resetCamera(g.pos);
        for (let i = 0; i < 3; i++) w.render(100, g.pos, false, true);
        const probe = (window as any).__drawReview;
        Object.assign(probe, {
          active: true,
          calls: 0,
          triangles: 0,
          instanced: 0,
        });
        try {
          w.render(100, g.pos, false, true);
        } finally {
          probe.active = false;
        }
        const tint = w.actors.children.find(
          (o: any) => o.isInstancedMesh && o.visible && o.instanceColor,
        )?.material;
        const sameMaterial = !material || material === tint;
        material = tint;
        captures.push({
          calls: probe.calls,
          main: w.renderer.info.render.calls,
          triangles: probe.triangles,
          memory: { ...w.renderer.info.memory },
          programs: w.renderer.info.programs.length,
          sameMaterial,
        });
      }
      return captures;
    }, profile);
    for (const row of result) {
      expect(row.calls).toBeGreaterThan(0);
      expect(row.calls).toBeLessThanOrEqual(profile.calls);
      expect(row.calls - row.main).toBeGreaterThanOrEqual(
        profile.low ? 0 : 200,
      );
      if (profile.low) expect(row.calls).toBe(row.main);
      expect(row.triangles).toBeLessThan(profile.low ? 600000 : 2400000);
      expect(row.sameMaterial).toBe(true);
    }
    expect(result[2].memory).toEqual(result[1].memory);
    expect(result[2].programs).toBe(result[1].programs);
    expect(errors).toEqual([]);
  });
