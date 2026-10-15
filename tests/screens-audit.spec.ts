import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * The UI rules the sibling games enforce (Steel Front, Frontier Command,
 * Kitehaven): no text under 11 px, 44 px touch targets, no sideways scroll;
 * plus the screens this pass added (failure debrief, settle guard, haptics).
 */
const SIZES: [number, number, boolean][] = [
  [360, 640, true],
  [390, 844, true],
  [568, 320, true],
  [844, 390, true],
  [820, 1180, true],
  [1440, 900, false],
];
async function open(browser: Browser, w: number, h: number, touch: boolean) {
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    localStorage.setItem("nightfall-prefs", JSON.stringify({ sound: false })),
  );
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  return { context, page };
}
/** Small text, small touch targets and sideways overflow on the open screen. */
const audit = (page: Page) =>
  page.evaluate(() => {
    const out = {
      small: [] as string[],
      taps: [] as string[],
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
    const coarse = matchMedia("(pointer: coarse)").matches;
    const scope = document.querySelector("#overlay:not([hidden])") ?? document.body;
    for (const el of scope.querySelectorAll<HTMLElement>("*")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent!.trim(),
      );
      if (own && parseFloat(cs.fontSize) < 11)
        out.small.push(`${el.className || el.tagName}:${cs.fontSize}`);
      if (!coarse) continue;
      if (!el.matches("button, a[href], summary, select, [role=radio], [role=button], input"))
        continue;
      // A switch inside a full-row label is tapped through its label.
      const target = el.closest("label") ?? el;
      const t = target.getBoundingClientRect();
      if (t.height < 44 || t.width < 44)
        out.taps.push(`${el.id || el.textContent!.trim()}:${t.width}x${t.height}`);
    }
    return out;
  });
const clean = { small: [], taps: [], overflow: false };

for (const [w, h, touch] of SIZES)
  test(`${w}×${h}: menu, settings, shop, pause and HUD keep 11 px text, 44 px taps and no sideways scroll`, async ({
    browser,
  }) => {
    const { context, page } = await open(browser, w, h, touch);
    expect(await audit(page), "menu").toEqual(clean);
    await page.locator("#menu-settings").click();
    expect(await audit(page), "settings").toEqual(clean);
    await page.locator("#close-settings").click();
    await page.locator("#field-shop").click();
    await expect(page.locator("#close-shop")).toBeVisible();
    expect(await audit(page), "shop").toEqual(clean);
    await page.locator("#close-shop").click();
    await page.locator("#deploy").click();
    await expect(page.locator("#hud")).toBeVisible();
    expect(await audit(page), "hud").toEqual(clean);
    await page.locator("#pause").click();
    await expect(page.locator("#resume")).toBeVisible();
    expect(await audit(page), "pause").toEqual(clean);
    await context.close();
  });

for (const [w, h, touch] of SIZES)
  test(`${w}×${h}: the Field Manual and both debriefs keep the same rules`, async ({
    browser,
  }) => {
    const { context, page } = await open(browser, w, h, touch);
    await page.locator("#controls-open").click();
    await page.evaluate(() =>
      document
        .querySelectorAll<HTMLDetailsElement>("#overlay details")
        .forEach((d) => (d.open = true)),
    );
    expect(await audit(page), "manual").toEqual(clean);
    await page.keyboard.press("Escape");
    await page.locator("#deploy").click();
    await page.evaluate(async () => {
      const { game: g, input } = (window as any).__nightfall;
      const { WEAPONS } = await import("/src/arsenal.ts");
      g.invincible = 1e6;
      for (const e of g.enemies) if (e.hp > 0) g.hurt(e, 999, WEAPONS[0]);
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    });
    await expect(page.locator(".grade")).toBeVisible({ timeout: 15000 });
    expect(await audit(page), "won").toEqual(clean);
    await page.reload();
    await expect(page.locator("#deploy")).toBeEnabled();
    await page.locator("#deploy").click();
    await page.evaluate(() => {
      const g = (window as any).__nightfall.game;
      g.invincible = 0;
      g.shield = 0;
      g.takeDamage(1e6, { x: g.pos.x + 3, z: g.pos.z }, { cause: "rocket" });
    });
    await expect(page.locator(".defeat")).toBeVisible({ timeout: 15000 });
    expect(await audit(page), "lost").toEqual(clean);
    await context.close();
  });

test("the full-screen button is a styled bar in the menu tiles and the pause actions", async ({
  browser,
}) => {
  const { context, page } = await open(browser, 390, 844, true);
  const bar = page.locator(".menu-tiles > [data-mobile-display]");
  await expect(bar).toBeVisible();
  const style = await bar.evaluate((b) => {
    const cs = getComputedStyle(b);
    const row = b.parentElement!.getBoundingClientRect(),
      r = b.getBoundingClientRect();
    return {
      spans: Math.abs(r.width - row.width) < 2,
      tall: r.height >= 44,
      font: cs.fontFamily.includes("Barlow"),
    };
  });
  expect(style).toEqual({ spans: true, tall: true, font: true });
  await page.locator("#deploy").click();
  await page.locator("#pause").click();
  await expect(
    page.locator(".modal-actions > [data-mobile-display]"),
  ).toBeVisible();
  await context.close();
});

test("a lethal boss hit names the boss on the failure debrief and teaches its counter", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nightfall-prefs",
      JSON.stringify({ sound: false, reduced: true }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  // Secure the first finale's relay so COBRA FANG arrives, then let it fight
  // until one of its real attacks lands.
  const hit = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    g.start(2, { armor: 0, power: 0, mobility: 0 }, "normal");
    const m = MISSIONS[2];
    g.pos.set(m.objective.x, 0, m.objective.z);
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    for (const e of g.enemies) if (!e.boss) e.hp = 0;
    g.maxHp = g.hp = 1e6;
    for (let i = 0; i < 60 * 40 && !g.lastHit; i++) {
      g.invincible = 0;
      // Late guards would shoot first: keep only the boss in the fight.
      for (const e of g.enemies) if (!e.boss && e.hp > 0) e.hp = 0;
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    }
    return g.lastHit;
  });
  expect(hit).toEqual({ cause: "boss", boss: "gunship" });
  await page.evaluate(() => {
    const g = (window as any).__nightfall.game;
    g.hp = 1;
    g.shield = 0;
    g.invincible = 0;
    g.takeDamage(50, { x: g.pos.x + 4, z: g.pos.z }, g.lastHit);
  });
  const card = page.locator(".defeat");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).toHaveAttribute("data-cause", "boss");
  await expect(card.locator("b")).toHaveText("COBRA FANG");
  await expect(card.locator(".defeat-tip")).not.toBeEmpty();
  expect(
    await card
      .locator(".defeat-portrait")
      .evaluate((p) => getComputedStyle(p).backgroundImage),
  ).toContain("sprites/gunship.webp");
  // Retry still starts the mission again.
  await page.locator("#result-checkpoint, #result-primary").first().click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.mode))
    .toBe("playing");
});

test("hit causes name the attacker: rockets, throwers, blades, tanks, bosses and blasts", async ({
  page,
}) => {
  await page.goto("/");
  const causes = await page.evaluate(async () => {
    const { hitCause } = await import("/src/game.ts");
    const { ENEMY_WEAPONS } = await import("/src/arsenal.ts");
    return [
      hitCause(undefined, ENEMY_WEAPONS.rocket),
      hitCause(undefined, ENEMY_WEAPONS.knife),
      hitCause({ role: "ninja" } as any),
      hitCause({ role: "swordsman" } as any),
      hitCause({ armored: true } as any),
      hitCause({ boss: true, bossKind: "walker" } as any),
      hitCause({ role: "rifleman" } as any),
    ];
  });
  expect(causes).toEqual([
    { cause: "rocket" },
    { cause: "thrower" },
    { cause: "ninja" },
    { cause: "swordsman" },
    { cause: "tank" },
    { cause: "boss", boss: "walker" },
    { cause: "gunfire" },
  ]);
});

test("a debrief that lands mid-fight ignores taps and Enter until it settles", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nightfall-prefs",
      JSON.stringify({ sound: false, reduced: true }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  // Ghost is firing with Space when the last enemy falls.
  await page.keyboard.down("Space");
  // Checked in the same task as the reveal, so a slow machine cannot let
  // the settle window pass before the probe.
  const landed = await page.evaluate(async () => {
    const { game: g, input } = (window as any).__nightfall;
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.invincible = 1e6;
    for (const e of g.enemies) if (e.hp > 0) g.hurt(e, 999, WEAPONS[0]);
    g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    const overlay = document.querySelector("#overlay")!;
    const armor = document.querySelector('[data-upgrade="armor"]')!;
    const r = armor.getBoundingClientRect();
    // The FIRE finger keeps tapping where the panel landed; Enter is held.
    const under = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(enter);
    return {
      settling: overlay.classList.contains("settling"),
      tapReachesButton: !!under && armor.contains(under),
      enterBlocked: enter.defaultPrevented,
      focused: document.activeElement === armor,
    };
  });
  expect(landed).toEqual({
    settling: true,
    tapReachesButton: false,
    enterBlocked: true,
    focused: false,
  });
  const armor = page.locator('[data-upgrade="armor"]');
  // Once settled, the panel takes focus and answers normally.
  await expect(page.locator("#overlay")).not.toHaveClass(/settling/);
  await expect(armor).toBeFocused();
  // Releasing the Space held from the fight onto the focused button, or its
  // auto-repeat, presses nothing; a fresh Space press does.
  await page.evaluate(() => {
    const armor = document.activeElement!;
    armor.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true, cancelable: true }),
    );
  });
  await page.keyboard.up("Space");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__nightfall.mode)).toBe(
    "result",
  );
  const blocked = await page.evaluate(() => {
    const up = new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(up);
    return up.defaultPrevented;
  });
  expect(blocked).toBe(true);
  await armor.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__nightfall.mode))
    .toBe("menu");
});

test("phones buzz on hits; the Vibration setting turns it off and persists", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as any).__buzz = [];
    Object.defineProperty(Navigator.prototype, "vibrate", {
      configurable: true,
      value: (p: unknown) => ((window as any).__buzz.push(p), true),
    });
    if (!localStorage.getItem("nightfall-prefs"))
      localStorage.setItem("nightfall-prefs", JSON.stringify({ sound: false }));
  });
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  const hurt = () =>
    page.evaluate(async () => {
      const g = (window as any).__nightfall.game;
      g.invincible = 0;
      g.takeDamage(30, { x: g.pos.x + 3, z: g.pos.z }, { cause: "gunfire" });
      await new Promise((r) => setTimeout(r, 300));
      return (window as any).__buzz.length;
    });
  expect(await hurt()).toBeGreaterThan(0);
  // Going down right after a hit still buzzes (hits are rate-limited, the
  // knockdown and boss cues are not).
  expect(
    await page.evaluate(() => {
      const { haptics } = (window as any).__nightfall;
      const n = (window as any).__buzz.length;
      haptics.hurt(30);
      haptics.down();
      haptics.hurt(30); // inside the quiet window: dropped
      return (window as any).__buzz.length - n;
    }),
  ).toBe(2);
  // Turn it off in the pause menu: hits stop buzzing, and the choice persists.
  await page.locator("#pause").click();
  const row = page.locator("label.setting", { hasText: "Vibration" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator("#setting-vibrate")).not.toBeChecked();
  await page.locator("#resume").click();
  // Switching off stops any buzz in progress (vibrate(0)); hits add nothing.
  expect(await page.evaluate(() => (window as any).__buzz.at(-1))).toBe(0);
  const before = await page.evaluate(() => (window as any).__buzz.length);
  expect(await hurt()).toBe(before);
  await page.reload();
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#menu-settings").click();
  await expect(page.locator("#setting-vibrate")).not.toBeChecked();
  await context.close();
});

test("desktops do not offer Vibration", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#menu-settings").click();
  await expect(page.locator("#setting-sound")).toBeAttached();
  await expect(page.locator("#setting-vibrate")).toHaveCount(0);
});

test("the paused world is drawn once, and again only when a setting changes its look", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  await page.locator("#pause").click();
  await expect(page.locator("#resume")).toBeVisible();
  const frames = () =>
    page.evaluate(
      () => (window as any).__nightfall.world.renderer.info.render.frame,
    );
  await page.waitForTimeout(300);
  const idle = await frames();
  await page.waitForTimeout(600);
  expect(await frames()).toBe(idle);
  await page.locator('[data-quality="low"]').click();
  await expect.poll(frames).toBeGreaterThan(idle);
  const after = await frames();
  await page.waitForTimeout(600);
  expect(await frames()).toBe(after);
  // Resuming draws every frame again.
  await page.locator("#resume").click();
  await expect.poll(frames).toBeGreaterThan(after + 3);
});
