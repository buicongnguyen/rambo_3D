import { test, expect } from "@playwright/test";
// Let the audio context run without a click so voices can finish and release.
test.use({
  launchOptions: {
    args: [
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
});
async function ready(page: any) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}

test("rescuing beside a prison door never pins the soldier when the gate opens", async ({
  page,
}) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const { game: g, input } = (window as any).__nightfall;
    g.invincible = 1e6;
    g.enemies.forEach((e: any) => (e.hp = 0));
    const prison = g.prisons[0],
      box = prison.box,
      c = Math.cos(box.rotation),
      s = Math.sin(box.rotation);
    // Stand against the closed door, in front of the right-hand wall stub.
    const lx = 1.5,
      lz = 2.1 + 0.48 + 1e-4;
    g.pos.set(box.x + lx * c + lz * s, 0, box.z - lx * s + lz * c);
    const cmd = { ...input, x: 0, z: 0, fire: false, interact: false };
    for (let i = 0; i < 80 && !prison.collisionOpen; i++)
      g.update(1 / 60, { ...cmd });
    const opened = prison.collisionOpen;
    const before = { x: g.pos.x, z: g.pos.z };
    // Walk sideways along the door (local +x), then back the other way.
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd, x: c, z: -s });
    const side = Math.hypot(g.pos.x - before.x, g.pos.z - before.z);
    const mid = { x: g.pos.x, z: g.pos.z };
    for (let i = 0; i < 30; i++) g.update(1 / 60, { ...cmd, x: -c, z: s });
    const back = Math.hypot(g.pos.x - mid.x, g.pos.z - mid.z);
    g.phase = "won";
    return { opened, side, back };
  });
  expect(r.opened).toBe(true);
  expect(r.side).toBeGreaterThan(1);
  expect(r.back).toBeGreaterThan(1);
});

test("sound and music can be switched off in settings, and cues are cheap to schedule", async ({
  page,
}) => {
  await ready(page);
  const perf = await page.evaluate(async () => {
    const { GameAudio, stingerSeconds } = await import("/src/audio.ts");
    const audio = new GameAudio();
    const cues = [
      "fire:rifle",
      "fire:shotgun",
      "fire:machineGun",
      "fire:sniper",
      "fire:missile",
      "fire:laser",
      "cannon",
      "enemyShot",
      "explosion",
      "hit",
      "coin",
      "warn",
      "win",
    ];
    const started = performance.now();
    for (let i = 0; i < 20; i++)
      for (const cue of cues) audio.play(cue, { gain: 0.5, pan: 0.3 });
    const scheduleMs = performance.now() - started;
    await new Promise((resolve) =>
      setTimeout(resolve, (stingerSeconds("win") + 1) * 1000),
    );
    const voices = (audio as any).voices;
    audio.configure(false, false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { scheduleMs, voices, state: (audio as any).ctx?.state };
  });
  // Rate limits and the voice cap keep a 260-cue burst cheap, and every voice ends.
  expect(perf.scheduleMs).toBeLessThan(250);
  expect(perf.voices).toBe(0);
  expect(perf.state).toBe("suspended");
  // Settings: pause, switch both toggles off, and the choice persists.
  await page.keyboard.press("Escape");
  await page.locator("#setting-music").uncheck();
  await page.locator("#setting-sound").uncheck();
  const prefs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-prefs")!),
  );
  expect(prefs).toMatchObject({ sound: false, music: false });
  await page.locator("#to-menu").click();
  await expect(page.locator("#sound")).toHaveText("SOUND OFF");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveText("SOUND ON");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("nightfall-prefs")!),
    ),
  ).toMatchObject({ sound: true, music: true });
});
