import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { installDrawProbe } from "./render-probe.mjs";
const url = process.argv[2] ?? "http://127.0.0.1:4197/",
  out = process.argv[3] ?? ".tools/performance";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--enable-precise-memory-info",
  ],
});
const results = [];
try {
  for (const config of [
    { name: "desktop-idle" },
    { name: "phone-3d-idle", phone: true },
    { name: "phone-25d-idle", phone: true, sprites: true },
    { name: "desktop-combat", combat: true },
    { name: "phone-25d-combat", phone: true, sprites: true, combat: true },
    { name: "desktop-blast-tail", effects: true },
  ]) {
    const context = await browser.newContext({
      viewport: config.phone
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      isMobile: !!config.phone,
      hasTouch: !!config.phone,
      deviceScaleFactor: config.phone ? 2 : 1,
    });
    await context.addInitScript(installDrawProbe);
    await context.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__nativeRaf = raf;
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          if (!window.__holdReview) cb(t);
        });
      localStorage.setItem(
        "nightfall-prefs",
        JSON.stringify({ low: true, sound: false, view: "3d" }),
      );
      const p = window.__drawReview;
      p.uploadCalls = p.uploadBytes = p.allocCalls = p.allocBytes = 0;
      for (const proto of [
        WebGLRenderingContext.prototype,
        WebGL2RenderingContext.prototype,
      ])
        for (const name of ["bufferSubData", "bufferData"]) {
          const original = proto[name];
          proto[name] = function (...a) {
            if (p.active) {
              const src = a[name === "bufferData" ? 1 : 2],
                offset = name === "bufferData" ? a[3] : a[3],
                length = name === "bufferData" ? a[4] : a[4];
              let bytes =
                typeof src === "number" ? src : (src?.byteLength ?? 0);
              if (ArrayBuffer.isView(src))
                bytes =
                  (length || (src.length ?? src.byteLength) - (offset ?? 0)) *
                  (src.BYTES_PER_ELEMENT ?? 1);
              if (name === "bufferData") {
                p.allocCalls++;
                p.allocBytes += bytes;
              } else {
                p.uploadCalls++;
                p.uploadBytes += bytes;
              }
            }
            return original.apply(this, a);
          };
        }
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.locator("#deploy").click({ timeout: 60000 });
    await page.evaluate(() => (window.__holdReview = true));
    await page.waitForTimeout(100);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: config.phone ? 4 : 1,
    });
    await page.evaluate(async (config) => {
      const { world: w } = window.__nightfall;
      w.setMode25d(!!config.sprites);
      if (config.sprites) await w.sprites.load("/");
      window.__work = (
        await import("/scripts/performance-fixture.ts")
      ).workFixture(config);
      for (let i = 0; i < 8; i++) window.__work.step();
    }, config);
    const measurement = await page.evaluate(() => {
      const f = window.__work,
        p = window.__drawReview;
      for (const k of Object.keys(p)) if (typeof p[k] === "number") p[k] = 0;
      f.counts.compose = f.counts.multiply = 0;
      f.instrument(true);
      p.active = true;
      for (let i = 0; i < 30; i++) f.step();
      p.active = false;
      f.instrument(false);
      return {
        ...p,
        ...f.counts,
        mainCalls: f.mainCalls(),
        memory: f.memory(),
      };
    });
    // CPU samples and work durations run with the matrix wrappers removed and counters disabled.
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    const timing = await page.evaluate(async () => {
      const durations = [],
        gaps = [];
      let last = 0;
      for (let i = 0; i < 90; i++) {
        await new Promise(window.__nativeRaf);
        const now = performance.now();
        if (last) gaps.push(now - last);
        last = now;
        window.__work.step();
        durations.push(performance.now() - now);
      }
      return { durations, gaps };
    });
    const { profile } = await cdp.send("Profiler.stop");
    await writeFile(
      `${out}/${config.name}.cpuprofile`,
      JSON.stringify(profile),
    );
    const png = await page.evaluate(() => window.__work.png());
    await writeFile(
      `${out}/${config.name}.png`,
      Buffer.from(png.split(",")[1], "base64"),
    );
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const renderer = await page.evaluate(() => {
      const gl = window.__nightfall.world.renderer.getContext(),
        d = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown",
        canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      };
    });
    const times = new Map();
    profile.samples?.forEach((id, i) =>
      times.set(id, (times.get(id) || 0) + (profile.timeDeltas[i] || 0)),
    );
    const top = profile.nodes
      .map((n) => ({
        fn: n.callFrame.functionName,
        file: n.callFrame.url.split("/").pop(),
        selfMs: (times.get(n.id) || 0) / 1000,
      }))
      .sort((a, b) => b.selfMs - a.selfMs)
      .slice(0, 12);
    const stats = (a) => {
      a.sort((x, y) => x - y);
      return {
        median: a[Math.floor(a.length * 0.5)],
        p95: a[Math.floor(a.length * 0.95)],
      };
    };
    const row = {
      ...config,
      sampledFrames: 30,
      measurement,
      cpuWorkMs: stats(timing.durations),
      frameGapMs: stats(timing.gaps),
      heap,
      ...renderer,
      cpuTop: top,
      errors,
    };
    results.push(row);
    console.log(
      config.name,
      JSON.stringify({
        measurement,
        cpuWorkMs: row.cpuWorkMs,
        heapUsed: heap.usedSize,
      }),
    );
    await context.close();
    if (errors.length) throw new Error(errors.join("\n"));
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
