// Run against the Vite development server; __nightfall is absent in production.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const low of [true, false]) {
    const page = await browser.newPage({
      viewport: low
        ? { width: 390, height: 844 }
        : { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      hasTouch: low,
    });
    await page.addInitScript((low) => {
      localStorage.setItem(
        "nightfall-prefs",
        JSON.stringify({ low, sound: false }),
      );
      let seed = 12345;
      Math.random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    }, low);
    await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:5198");
    await page.waitForFunction(() => window.__nightfall);
    const data = await page.evaluate(async (low) => {
      const { game: g, world: w, input } = window.__nightfall;
      const { MISSIONS } = await import("/src/missions.ts");
      const { sampleRoute } = await import("/src/routes.mjs");
      const results = [];
      for (const index of [0, 8]) {
        let seed = 12345;
        Math.random = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        g.start(
          index,
          { power: 0, armor: 0, mobility: 0 },
          index === 0 ? "normal" : "crazy",
        );
        const p = sampleRoute(MISSIONS[index].route, index === 0 ? 0.15 : 0.5);
        g.pos.set(p.x, 0, p.z);
        g.invincible = 10000;
        w.resetCamera(g.pos);
        const sim = [],
          batch = [],
          render = [];
        let t = performance.now() / 1000;
        const original = w.actorBatches.update;
        for (let i = 0; i < 45; i++) {
          let a = performance.now();
          g.update(1 / 60, input);
          let b = performance.now();
          let bt = 0;
          w.actorBatches.update = (c) => {
            const s = performance.now();
            original.call(w.actorBatches, c);
            bt = performance.now() - s;
          };
          w.render((t += 1 / 60), g.pos, false, true);
          w.actorBatches.update = original;
          if (i > 9) {
            sim.push(b - a);
            batch.push(bt);
            render.push(performance.now() - b);
          }
        }
        const avg = (x) =>
          +(x.reduce((a, b) => a + b, 0) / x.length).toFixed(2);
        let nodes = 0;
        w.scene.traverse(() => nodes++);
        results.push({
          index,
          enemies: g.enemies.length,
          nodes,
          updateMs: avg(sim),
          batchMs: avg(batch),
          renderSubmitMs: avg(render),
          calls: w.renderer.info.render.calls,
          triangles: w.renderer.info.render.triangles,
        });
      }
      return {
        low,
        renderer: w.renderer
          .getContext()
          .getParameter(
            w.renderer.getContext().getExtension("WEBGL_debug_renderer_info")
              .UNMASKED_RENDERER_WEBGL,
          ),
        results,
      };
    }, low);
    results.push(data);
    await page.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  process.argv[2] ?? "docs/render-profile-local.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
