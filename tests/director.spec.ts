import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
}
/** Secure the finale relay of mission `index` so its command bosses arrive. */
const bossesArrive = (page: Page, index: number) =>
  page.evaluate(async (index) => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    g.start(index, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.invincible = 1e6;
    const m = MISSIONS[index];
    g.pos.set(m.objective.x, 0, m.objective.z);
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    return g.bossSpawned;
  }, index);

test("command bosses arrive with a held, letterboxed camera intro that input can skip", async ({
  page,
}) => {
  await ready(page);
  expect(await bossesArrive(page, 2)).toBe(true);
  await expect(page.locator("#boss-intro")).toHaveClass(/show/);
  await expect(page.locator("#boss-intro-name")).toHaveText("COBRA FANG");
  const held = await page.evaluate(async () => {
    const { game: g, world } = (window as any).__nightfall;
    const t = g.elapsed;
    await new Promise((r) => setTimeout(r, 400));
    return { frozen: g.elapsed === t, camera: !!world.cameraOverride };
  });
  expect(held).toEqual({ frozen: true, camera: true });
  // Any key skips to the pan back; play resumes well before the full 2.65 s.
  await page.keyboard.press("KeyE");
  await expect(page.locator("#boss-intro")).not.toHaveClass(/show/, {
    timeout: 1500,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { world, director } = (window as any).__nightfall;
        return !director.busy && world.cameraOverride === null;
      }),
    )
    .toBe(true);
  const resumed = await page.evaluate(async () => {
    const g = (window as any).__nightfall.game;
    const t = g.elapsed;
    await new Promise((r) => setTimeout(r, 300));
    const moved = g.elapsed > t;
    g.phase = "won";
    return moved;
  });
  expect(resumed).toBe(true);
});

test("the mission's final kill plays in slow motion before the debrief appears", async ({
  page,
}) => {
  await ready(page);
  const at = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.invincible = 1e6;
    for (const e of g.enemies) if (e.hp > 0) g.hurt(e, 999, WEAPONS[0]);
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    return {
      phase: g.phase,
      blow: !!g.finalBlow,
      overlay: !document.querySelector("#overlay")!.hasAttribute("hidden"),
    };
  });
  expect(at).toEqual({ phase: "won", blow: true, overlay: false });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { world, director } = (window as any).__nightfall;
        return !!director.slowmo && !!world.cameraOverride;
      }),
    )
    .toBe(true);
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator(".grade-star")).toHaveCount(3, { timeout: 4000 });
});

test("the last command boss drops in slow motion while the finale keeps running", async ({
  page,
}) => {
  await ready(page);
  await bossesArrive(page, 2);
  await expect(page.locator("#boss-intro")).toHaveClass(/show/);
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE"); // skip the rest of the intro
  await expect
    .poll(
      () => page.evaluate(() => !(window as any).__nightfall.director.busy),
      { timeout: 10000 },
    )
    .toBe(true);
  const r = await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    // Game seconds per real second, measured on this machine.
    const rate = async () => {
      const t = g.elapsed,
        real = performance.now();
      await new Promise((r) => setTimeout(r, 600));
      return (g.elapsed - t) / ((performance.now() - real) / 1000);
    };
    const normal = await rate();
    for (const e of g.enemies) if (e.boss) g.hurt(e, 1e6, WEAPONS[0]);
    const blow = !!g.finalBlow;
    await new Promise((r) => requestAnimationFrame(() => r(0)));
    const slow = await rate();
    return { blow, phase: g.phase, normal, slow };
  });
  expect(r.blow).toBe(true);
  expect(r.phase).toBe("playing");
  expect(r.slow).toBeLessThan(r.normal * 0.6);
  await page.evaluate(() => ((window as any).__nightfall.game.phase = "won"));
});

test("stage music plays as synced stems whose combat layer follows the fighting", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nightfall-prefs",
      JSON.stringify({ low: true, sound: true, music: true }),
    ),
  );
  await ready(page);
  const stems = () =>
    page.evaluate(() => {
      const a = (window as any).__nightfall.audio;
      return {
        playing: !!a.themeSource && !!a.combatSource,
        synced:
          a.themeSource?.buffer?.length === a.combatSource?.buffer?.length,
        loops: !!a.themeSource?.loop && !!a.combatSource?.loop,
        intensity: a.intensity,
      };
    });
  await expect
    .poll(async () => (await stems()).playing, { timeout: 40000 })
    .toBe(true);
  expect(await stems()).toMatchObject({ synced: true, loops: true });
  await expect.poll(async () => (await stems()).intensity).toBeLessThan(0.2);
  // Start a firefight: nearby alerted soldiers and fresh gunfire.
  await page.evaluate(() => {
    const { game: g } = (window as any).__nightfall;
    g.invincible = 1e6;
    for (const e of g.enemies.slice(0, 4)) {
      e.alerted = true;
      e.x = g.pos.x + 6;
      e.z = g.pos.z - 6;
    }
    (window as any).__fight = setInterval(() => {
      g.lastCombat = g.elapsed;
    }, 100);
  });
  await expect
    .poll(async () => (await stems()).intensity, { timeout: 4000 })
    .toBeGreaterThan(0.6);
  await page.evaluate(() => {
    clearInterval((window as any).__fight);
    (window as any).__nightfall.game.phase = "won";
  });
});
