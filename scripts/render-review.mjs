#!/usr/bin/env node
// Adapted from Claude's smooth-dense-scenes review: real draws, seeded scenes,
// separate phone modes, unchanged geometry and deterministic canvas captures.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { installDrawProbe } from "./render-probe.mjs";
const url = process.argv[2] ?? "http://127.0.0.1:4197/";
const output = process.argv[3] ?? ".tools/render-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-gpu", "--ignore-gpu-blocklist"],
});
const results = [];
try {
  for (const profile of [
    { name: "opening-high", mission: 0 },
    { name: "jungle-high", mission: 11 },
    { name: "city-high", mission: 14 },
    { name: "city-phone-3d", mission: 14, phone: true },
    { name: "city-phone-25d", mission: 14, phone: true, sprites: true },
  ]) {
    const context = await browser.newContext({
      viewport: profile.phone
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      isMobile: !!profile.phone,
      hasTouch: !!profile.phone,
      deviceScaleFactor: profile.phone ? 2 : 1,
    });
    await context.addInitScript(installDrawProbe);
    await context.addInitScript(() => {
      let seed = 123456;
      Math.random = () =>
        (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) =>
        raf.call(window, (time) => {
          if (!window.__holdReview) callback(time);
        });
      localStorage.setItem(
        "nightfall-prefs",
        JSON.stringify({ sound: false, low: true, view: "3d", reduced: true }),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.locator("#deploy").click({ timeout: 60000 });
    await page.evaluate(() => {
      window.__holdReview = true;
    });
    await page.waitForTimeout(100);
    const result = await page.evaluate(async (profile) => {
      const { game: g, world: w } = window.__nightfall;
      w.setMode25d(!!profile.sprites);
      if (profile.sprites) await w.sprites.load("/");
      const captures = [];
      // A -> A rebuild checks both repeatability and renderer resource growth.
      for (let repeat = 0; repeat < 2; repeat++) {
        let seed = 98765;
        Math.random = () =>
          (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        g.start(
          profile.mission,
          { armor: 0, power: 3, mobility: 3 },
          "crazy",
          98765,
        );
        g.phase = "won";
        w.quality(!!profile.phone);
        w.cameraOverride = undefined;
        w.guide = undefined;
        if (profile.mission) {
          const enemy = g.enemies[Math.floor(g.enemies.length * 0.45)];
          g.pos.set(enemy.x, 0, enemy.z);
        }
        g.player.position.copy(g.pos);
        w.resetCamera(g.pos);
        for (let i = 0; i < 3; i++) w.render(100, g.pos, false, true);
        const probe = window.__drawReview;
        Object.assign(probe, {
          calls: 0,
          triangles: 0,
          instanced: 0,
          active: true,
        });
        try {
          w.render(100, g.pos, false, true);
        } finally {
          probe.active = false;
        }
        const png = w.renderer.domElement.toDataURL();
        const buffers = new Set();
        w.scene.traverse((o) => {
          const geo = o.geometry;
          if (!geo) return;
          for (const attribute of [
            ...Object.values(geo.attributes),
            geo.index,
          ]) {
            const array = attribute?.array ?? attribute?.data?.array;
            if (array) buffers.add(array.buffer);
          }
        });
        captures.push({
          calls: probe.calls,
          instanced: probe.instanced,
          triangles: probe.triangles,
          mainCalls: w.renderer.info.render.calls,
          geometryBytes: [...buffers].reduce((n, b) => n + b.byteLength, 0),
          memory: { ...w.renderer.info.memory },
          programs: w.renderer.info.programs.length,
          png,
        });
      }
      const gl = w.renderer.getContext(),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        captures,
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unknown",
        canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        msaa: gl.getContextAttributes().antialias,
      };
    }, profile);
    for (let i = 0; i < result.captures.length; i++) {
      const capture = result.captures[i];
      await writeFile(
        `${output}/${profile.name}-${i}.png`,
        Buffer.from(capture.png.split(",")[1], "base64"),
      );
      delete capture.png;
    }
    results.push({ ...profile, ...result, errors });
    console.log(profile.name, JSON.stringify(result.captures));
    await context.close();
    if (errors.length) throw new Error(errors.join("\n"));
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
