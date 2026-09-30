import { test, expect, type Browser } from "@playwright/test";

const SAVE = {
  version: 2,
  mission: 4,
  armor: 2,
  power: 1,
  mobility: 1,
  best: 23150,
  completed: false,
  credits: 640,
  squad: 2,
  women: 1,
  fieldKit: 1,
  stars: [3, 2, 3, 1],
  loadout: [],
};
async function phone(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.addInitScript(
    (save) => localStorage.setItem("nightfall-campaign", JSON.stringify(save)),
    SAVE,
  );
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  return { context, page };
}
/** Boxes of the given selectors, as plain rectangles. */
const boxes = (page: any, selector: string) =>
  page.locator(selector).evaluateAll((els: Element[]) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        id:
          e.id ||
          (e as HTMLElement).dataset.action ||
          (e as HTMLElement).dataset.hold ||
          e.className,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      };
    }),
  );
/** Round buttons: circles must not touch each other or any HUD panel. */
const circle = (r: any) => ({
  x: (r.left + r.right) / 2,
  y: (r.top + r.bottom) / 2,
  r: (r.right - r.left) / 2,
});
const circlesTouch = (a: any, b: any) => {
  const p = circle(a),
    q = circle(b);
  return Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r - 1;
};
const circleOverRect = (a: any, rect: any) => {
  const c = circle(a);
  const x = Math.max(rect.left, Math.min(c.x, rect.right)),
    y = Math.max(rect.top, Math.min(c.y, rect.bottom));
  return Math.hypot(c.x - x, c.y - y) < c.r - 1;
};
const overlap = (a: any, b: any) =>
  a.left < b.right - 1 &&
  b.left < a.right - 1 &&
  a.top < b.bottom - 1 &&
  b.top < a.bottom - 1;

for (const [width, height] of [
  [390, 844],
  [844, 390],
  [360, 740],
]) {
  test(`briefing on a ${width}×${height} phone shows Deploy, shop, settings and manual above the fold`, async ({
    browser,
  }) => {
    const { context, page } = await phone(browser, width, height);
    const view = { width, height };
    for (const selector of [
      "#deploy",
      "#field-shop",
      "#menu-settings",
      "#controls-open",
      "#sound",
      "#wallet-chip",
    ]) {
      const b = (await page.locator(selector).boundingBox())!;
      expect(b.y + b.height, selector).toBeLessThanOrEqual(view.height);
      expect(b.x + b.width, selector).toBeLessThanOrEqual(view.width);
      // Tappable controls meet the 44 px touch target (the wallet is a label).
      if (selector !== "#wallet-chip")
        expect(b.height, selector).toBeGreaterThanOrEqual(44);
    }
    // No clipped labels or horizontal overflow; header items stay on one line.
    expect(
      await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth <= innerWidth,
        tiles: [...document.querySelectorAll(".tile b")].every(
          (b) =>
            (b as HTMLElement).scrollWidth <=
            (b as HTMLElement).clientWidth + 1,
        ),
        credits: document.querySelector("#wallet-credits")!.textContent,
      })),
    ).toMatchObject({ overflow: true, tiles: true, credits: "640" });
    expect(
      await page.evaluate(
        () => document.querySelector("#sound")!.getBoundingClientRect().height,
      ),
    ).toBeLessThan(52);
    await page.screenshot({
      path: test.info().outputPath(`briefing-${width}.png`),
    });
    await context.close();
  });
}

test("stage cards pick the stage; the briefing battlefield rebuilds only when the mission changes", async ({
  browser,
}) => {
  const { context, page } = await phone(browser, 390, 844);
  await page.evaluate(() => {
    const w = (window as any).__nightfall.world;
    w.builds = 0;
    const build = w.build.bind(w);
    w.build = (i: number) => {
      w.builds++;
      return build(i);
    };
  });
  // A shop purchase refreshes the briefing without rebuilding the battlefield.
  await page.locator("#field-shop").tap();
  await page.locator('[data-buy="shotgun"]').tap();
  await expect(page.locator("#wallet-credits")).toHaveText("600");
  await expect(page.locator('[data-buy="shotgun"]')).toContainText("PACKED");
  await expect(page.locator(".shop-modal")).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.builds),
  ).toBe(0);
  await page.locator("#close-shop").tap();
  await expect(page.locator("#field-shop")).toBeFocused();
  // Tapping another stage's card previews it (one rebuild).
  await page.locator('#mission-cards [data-stage="3"]').tap();
  await expect(page.locator("#deploy")).toContainText("DEPLOY TO STAGE 4");
  await expect(page.locator('[data-stage="3"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.builds),
  ).toBe(1);
  await context.close();
});

test("settings open from the briefing with switches and a graphics toggle, and Escape returns focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#menu-settings").click();
  await expect(page.locator(".settings-modal")).toBeVisible();
  await page.locator("#setting-music").uncheck();
  await page.locator('[data-quality="low"]').click();
  const prefs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-prefs")!),
  );
  expect(prefs).toMatchObject({ music: false, low: true });
  expect(
    await page.evaluate(() => (window as any).__nightfall.world.lowDetail),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#menu-settings")).toBeFocused();
});

test("pause asks for a second tap before restarting and shows help for the input in use", async ({
  browser,
}) => {
  const { context, page } = await phone(browser, 390, 844);
  await page.locator("#deploy").tap();
  await page.evaluate(() => ((window as any).__nightfall.game.kills = 7));
  await page.locator("#pause").tap();
  await expect(page.locator(".help-touch")).toBeVisible();
  await expect(page.locator(".help-keys")).toBeHidden();
  await page.locator("#restart").tap();
  await expect(page.locator("#restart")).toHaveText("TAP AGAIN TO RESTART");
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.kills),
  ).toBe(7);
  await page.locator("#restart").tap();
  await expect(page.locator("#overlay")).toBeHidden();
  expect(
    await page.evaluate(() => (window as any).__nightfall.game.kills),
  ).toBe(0);
  await context.close();
});

for (const [width, height] of [
  [390, 844],
  [844, 390],
  [320, 568],
  [667, 375],
]) {
  test(`touch controls on a ${width}×${height} phone are round icon buttons that never overlap`, async ({
    browser,
  }) => {
    const { context, page } = await phone(browser, width, height);
    await page.locator("#deploy").tap();
    await expect(page.locator("#touch")).toBeVisible();
    const buttons = await boxes(page, "#touch button");
    const blockers = await boxes(
      page,
      "#move-pad, .health-panel, .ammo-panel, .objective-panel, #minimap, #pause",
    );
    expect(buttons.length).toBe(7);
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++)
        expect(
          circlesTouch(buttons[i], buttons[j]),
          `${buttons[i].id}/${buttons[j].id}`,
        ).toBe(false);
      for (const b of blockers)
        expect(
          circleOverRect(buttons[i], b),
          `${buttons[i].id} over ${b.id}`,
        ).toBe(false);
    }
    const style = await page.locator("#touch button").evaluateAll((els) =>
      els.map((e) => {
        const s = getComputedStyle(e);
        return {
          round: parseFloat(s.borderRadius) >= e.clientWidth / 2 - 1,
          icon: /hud-/.test(s.backgroundImage),
          fits: (e as HTMLElement).scrollWidth <= e.clientWidth + 1,
        };
      }),
    );
    expect(style.every((s) => s.round && s.icon && s.fits)).toBe(true);
    // Full size where it fits; compact (0.8) on narrow or short phones, where
    // the small buttons stay at the 44 px minimum.
    const compact = width <= 360 || height <= 380;
    const fire = (await page.locator('[data-hold="fire"]').boundingBox())!;
    expect(fire.width).toBeGreaterThanOrEqual(compact ? 76 : 90);
    for (const b of buttons)
      expect(b.right - b.left, b.id).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: test.info().outputPath(`hud-${width}.png`) });
    await context.close();
  });
}

test("the quartermaster shows stats, prices on the buy buttons and clear owned and locked states", async ({
  page,
}) => {
  await page.addInitScript(
    (save) =>
      localStorage.setItem(
        "nightfall-campaign",
        JSON.stringify({ ...save, credits: 80, loadout: ["machineGun"] }),
      ),
    SAVE,
  );
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#field-shop").click();
  const cards = await page.locator(".shop-grid .shop-card").evaluateAll((els) =>
    els.map((e) => ({
      state: e.classList.contains("owned")
        ? "owned"
        : e.classList.contains("locked")
          ? "locked"
          : "ready",
      stats: e.querySelectorAll(".stat").length,
      role: e.querySelector(".role")?.textContent,
      button: e.querySelector("button")!.textContent!.trim(),
      disabled: (e.querySelector("button") as HTMLButtonElement).disabled,
    })),
  );
  expect(cards.map((c) => c.state)).toEqual([
    "ready",
    "owned",
    "locked",
    "locked",
    "locked",
  ]);
  expect(cards.every((c) => c.stats === 2 && !!c.role)).toBe(true);
  expect(cards[0]).toMatchObject({ button: "40", disabled: false });
  expect(cards[1]).toMatchObject({ button: "PACKED ✓", disabled: true });
  expect(cards[4]).toMatchObject({ button: "180", disabled: true });
  await expect(page.locator("#buy-kit")).toBeDisabled();
});
