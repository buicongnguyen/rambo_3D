import { test, expect } from "@playwright/test";
test("snow perimeter stripe has one exposed surface on every side and quality", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const results = await page.evaluate(async () => {
    const { world: w, game: g } = (window as any).__nightfall;
    const T = await import("/tests/scene-fixtures.ts");
    const { WORLD_BOUNDS: b } = await import("/src/campaign.mjs");
    const rows: any[] = [];
    for (const stage of [0, 1, 2]) {
      g.start(stage, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.phase = "won";
      for (const low of [true, false]) {
        w.quality(low);
        w.render(performance.now() / 1000, g.pos, false, true);
        for (const [x, z, dx, dz] of [
          [b.x - 3, 1.137, 1, 0],
          [-b.x + 3, 1.137, -1, 0],
          [1.137, b.minZ + 3, 0, -1],
          [1.137, b.maxZ - 3, 0, 1],
        ]) {
          for (const [height, color] of [
            [0.807, 0x969c98],
            [1.207, 0xeef6f8],
            [1.317, 0x969c98],
          ]) {
            const ray = new T.Raycaster(
              new T.Vector3(x, height, z),
              new T.Vector3(dx, 0, dz),
            );
            const hits = ray
              .intersectObject(w.terrain, true)
              .filter((h: any) => Math.abs(h.distance - 3) < 0.001);
            rows.push({
              stage,
              low,
              height,
              hits: hits.length,
              color: hits[0]?.object.material.color.getHex(),
              expected: color,
            });
          }
        }
      }
    }
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.phase = "won";
    g.pos.set(b.x - 7, 0, 0);
    w.resetCamera(g.pos);
    return rows;
  });
  expect(results).toHaveLength(72);
  for (const row of results) {
    expect(row.hits, JSON.stringify(row)).toBe(1);
    expect(row.color).toBe(row.expected);
  }
  await page.screenshot({ path: "docs/snow-border-fixed.png" });
});
