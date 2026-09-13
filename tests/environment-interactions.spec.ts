import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  await page.evaluate(async () => {
    const { game: g } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    COVER.length = 0;
    PATCHES.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
    g.quakeTime = 10000;
    g.invincible = 0;
  });
}
test("fuel and marked explosive crates burst outward, damage by distance and respect walls in both qualities", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    const rows = [];
    for (const low of [true, false])
      for (const kind of ["fuel", "explosive"]) {
        w.quality(low);
        g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
        g.quakeTime = 10000;
        g.invincible = 0;
        PATCHES.length = 0;
        g.enemies.forEach((e: any) => (e.hp = 0));
        const prop = w.destructibles.find((p: any) => p.kind === kind);
        prop.box.x = 0;
        prop.box.z = 0;
        prop.mesh.position.set(0, 0, 0);
        w.destructibles = [prop];
        COVER.splice(0, COVER.length, prop.box, {
          x: 3,
          z: 0,
          w: 0.8,
          d: 6,
          kind: "boundary",
        });
        g.rides.forEach((v: any, i: number) =>
          v.mesh.position.set(-22 + i * 10, 0, -20),
        );
        g.pos.set(0, 0, 3);
        g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
        for (const [index, x, z] of [
          [0, 1, 0],
          [1, -5, 0],
          [2, 4.5, 0],
          [3, 0, -12],
        ]) {
          const e = g.enemies[index];
          e.hp = 65;
          e.x = x;
          e.z = z;
          e.mesh.position.set(x, 0, z);
        }
        g.fireWeapon(WEAPONS[0], Math.PI);
        for (let i = 0; i < 40 && COVER.includes(prop.box); i++)
          g.update(1 / 60, {
            ...input,
            x: 0,
            z: 0,
            fire: false,
            interact: false,
          });
        const wave = g.impacts.bursts.find(
          (b: any) => b.kind === "fuel" && b.blast && b.group.visible,
        );
        const killed = g.enemies[0].hp <= 0,
          wounded = g.enemies[1].hp > 0 && g.enemies[1].hp < 65,
          shielded = g.enemies[2].hp === 65,
          distant = g.enemies[3].hp === 65;
        const damaged = g.hp > 0 && g.hp < 150;
        const score = g.score;
        g.damageProp(prop.box, 999);
        const once = g.score === score;
        g.updatePresentation(0.25);
        const outward =
          !!wave &&
          wave.sparks.some(
            (s: any) => Math.hypot(s.position.x, s.position.z) > 1,
          );
        rows.push({
          low,
          kind,
          killed,
          wounded,
          shielded,
          distant,
          damaged,
          once,
          outward,
          removed: !COVER.includes(prop.box) && !prop.mesh.parent,
          radius: wave?.radius,
        });
      }
    return rows;
  });
  for (const row of rows)
    expect(row, JSON.stringify(row)).toMatchObject({
      killed: true,
      wounded: true,
      shielded: true,
      distant: true,
      damaged: true,
      once: true,
      outward: true,
      removed: true,
      radius: 5.5,
    });
});
test("mixed fuel and explosive stores chain once, while occupied vehicle armor absorbs the blast", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, world: w } = (window as any).__nightfall;
    const { COVER } = await import("/src/missions.ts");
    const first = w.destructibles.find((p: any) => p.kind === "fuel"),
      second = w.destructibles.find((p: any) => p.kind === "explosive");
    first.box.x = 0;
    first.box.z = 0;
    first.mesh.position.set(0, 0, 0);
    second.box.x = 2;
    second.box.z = 0;
    second.mesh.position.set(2, 0, 0);
    w.destructibles = [first, second];
    COVER.push(first.box, second.box);
    g.rides.forEach((v: any, i: number) =>
      v.mesh.position.set(-20 + i * 10, 0, -20),
    );
    const tank = g.rides[2];
    tank.mesh.position.set(0, 0, 4);
    g.pos.copy(tank.mesh.position);
    g.useRide();
    g.invincible = 0;
    g.damageProp(first.box, 43);
    const result = {
      chain: w.destructibles.length === 0 && COVER.length === 0,
      armor: tank.hp < tank.spec.hp && tank.hp > 0,
      health: g.hp === 150,
      waves: g.impacts.bursts.filter(
        (b: any) => b.kind === "fuel" && b.group.visible,
      ).length,
    };
    for (let i = 0; i < 250; i++) g.updatePresentation(1 / 60);
    return {
      ...result,
      expired:
        g.destruction.fragments.length === 0 && g.impacts.activeCount === 0,
    };
  });
  expect(result).toMatchObject({
    chain: true,
    armor: true,
    health: true,
    expired: true,
  });
  expect(result.waves).toBeGreaterThanOrEqual(1);
});
test("tanks crush small trees at half speed, recover afterward, and leave big trees and walls intact", async ({
  page,
}) => {
  await ready(page);
  const rows = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const rows = [];
    for (const scenario of ["tank", "jeep", "motorcycle", "big", "wall"]) {
      g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
      g.enemies.forEach((e: any) => (e.hp = 0));
      g.quakeTime = 10000;
      g.invincible = 10000;
      g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
      PATCHES.length = 0;
      const tree = w.destructibles.find((p: any) => p.box.scale === 0.65);
      tree.box.x = 0;
      tree.box.z = 20;
      tree.mesh.position.set(0, 0, 20);
      if (scenario === "big") tree.box.scale = 1;
      w.destructibles = [tree];
      COVER.splice(0, COVER.length, tree.box);
      if (scenario === "wall")
        COVER.push({ x: -2, z: 20, w: 0.8, d: 12, kind: "boundary" });
      g.rides.forEach((v: any, i: number) =>
        v.mesh.position.set(-20 + i * 10, 0, -20),
      );
      const v = g.rides.find(
        (v: any) =>
          v.kind ===
          (["tank", "big", "wall"].includes(scenario) ? "tank" : scenario),
      );
      v.mesh.position.set(-10, 0, 20);
      v.heading = Math.PI / 2;
      v.speed = v.spec.speed;
      g.pos.copy(v.mesh.position);
      g.useRide();
      const ratios = [];
      let recovered = false,
        drag = false;
      for (let i = 0; i < 350 && v.mesh.position.x < 6; i++) {
        const x = v.mesh.position.x;
        g.update(1 / 60, {
          ...input,
          x: 1,
          z: 0,
          fire: false,
          interact: false,
        });
        const traveled = v.mesh.position.x - x;
        if (v.treeSlowdown === 0.5 && traveled > 0.001) {
          drag = true;
          ratios.push(traveled / (v.speed / 60));
        }
        if (drag && v.treeSlowdown === 1 && traveled > 0.05) recovered = true;
      }
      rows.push({
        scenario,
        removed: !COVER.includes(tree.box),
        drag,
        recovered,
        ratio: ratios.length
          ? ratios.reduce((a, b) => a + b, 0) / ratios.length
          : 0,
        x: v.mesh.position.x,
      });
    }
    return rows;
  });
  expect(rows[0]).toMatchObject({ removed: true, drag: true, recovered: true });
  expect(rows[0].ratio).toBeCloseTo(0.5, 3);
  expect(rows[0].x).toBeGreaterThan(5);
  for (const r of rows.slice(1)) {
    expect(r.removed, JSON.stringify(r)).toBe(false);
    expect(r.x).toBeLessThan(0);
  }
});
for (const mobile of [false, true])
  test(`${mobile ? "mobile" : "PC"} interaction hints expire once while boarding and exiting remain usable`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:5177",
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
      deviceScaleFactor: 0.5,
    });
    const page = await context.newPage();
    // These custom contexts do not inherit the runner's Low graphics storage state.
    await page.addInitScript(() =>
      localStorage.setItem(
        "nightfall-prefs",
        JSON.stringify({ low: true, sound: false }),
      ),
    );
    await ready(page);
    await page.evaluate(() => {
      const { game: g } = (window as any).__nightfall;
      const prompt = document.querySelector<HTMLElement>("#interact-prompt")!;
      const events: { text: string; visible: boolean }[] = [];
      (window as any).__hintEvents = events;
      // Capture one-second transitions in the browser, even when remote assertions arrive later.
      const record = () => {
        const event = {
          text: prompt.textContent ?? "",
          visible: !prompt.hidden,
        };
        const previous = events.at(-1);
        if (
          event.text !== previous?.text ||
          event.visible !== previous?.visible
        )
          events.push(event);
      };
      new MutationObserver(record).observe(prompt, {
        attributes: true,
        attributeFilter: ["hidden"],
        childList: true,
        subtree: true,
      });
      record();
      g.rides.forEach((v: any, i: number) =>
        v.mesh.position.set(i ? -20 : 8, 0, i ? -60 - i * 10 : 5),
      );
      g.pos.copy(g.rides[0].mesh.position);
    });
    const hint = page.locator("#interact-prompt");
    const appearances = (label: string) =>
      page.evaluate(
        (text) =>
          (window as any).__hintEvents.filter(
            (e: any) => e.visible && e.text.includes(text),
          ).length,
        label,
      );
    const checkHint = async (label: string, count: number) => {
      await expect.poll(() => appearances(label)).toBe(count);
      await expect(hint).toContainText(label);
      await expect(hint).toBeHidden({ timeout: 10000 });
    };
    // Deliberately inspect after the one-second window; the observer must retain the appearance.
    await page.waitForTimeout(1200);
    await checkHint("BOARD", 1);
    const act = async () =>
      mobile
        ? await page.locator('[data-action="interact"]').tap()
        : await page.keyboard.press("KeyE");
    await act();
    await checkHint("EXIT", 1);
    await page.waitForTimeout(1200);
    await expect(hint).toBeHidden();
    expect(await appearances("EXIT")).toBe(1);
    await expect(page.locator('[data-action="interact"]')).toHaveText("EXIT");
    await act();
    await expect
      .poll(() =>
        page.evaluate(() => !!(window as any).__nightfall.game.riding),
      )
      .toBe(false);
    // Exiting can produce another BOARD hint; count only the subsequent leave/return transition.
    await page.evaluate(() => {
      (window as any).__nightfall.game.pos.set(-15, 0, 0);
    });
    await expect(page.locator('[data-action="interact"]')).toHaveText("USE");
    const beforeReturn = await appearances("BOARD");
    await page.evaluate(() => {
      const { game: g } = (window as any).__nightfall;
      g.pos.copy(g.rides[0].mesh.position);
    });
    await checkHint("BOARD", beforeReturn + 1);
    await context.close();
  });
test("visible concrete perimeter matches blocked movement and gunfire, and cannot be destroyed", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WORLD_BOUNDS } = await import("/src/campaign.mjs");
    const { WEAPONS } = await import("/src/arsenal.ts");
    g.start(0, { armor: 0, power: 0, mobility: 0 }, "normal");
    g.quakeTime = 10000;
    g.enemies.forEach((e: any) => {
      e.hp = 0;
      e.mesh.removeFromParent();
    });
    const walls = COVER.filter((b: any) => b.kind === "boundary");
    COVER.splice(0, COVER.length, ...walls);
    PATCHES.length = 0;
    g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
    g.pos.set(WORLD_BOUNDS.x - 4, 0, 0);
    const e = g.enemies[0];
    e.hp = 65;
    e.x = WORLD_BOUNDS.x + 2;
    e.z = 0;
    g.fireWeapon(WEAPONS[0], Math.PI / 2);
    for (let i = 0; i < 50; i++)
      g.update(1 / 60, { ...input, x: 0, z: 0, fire: false });
    const blocked = e.hp === 65;
    g.damageProp(walls[1], 99999);
    const intact = COVER.includes(walls[1]);
    for (let i = 0; i < 120; i++)
      g.update(1 / 60, { ...input, x: 1, z: 0, fire: false });
    const within = g.pos.x <= WORLD_BOUNDS.x - 0.48;
    g.phase = "won";
    g.pos.set(WORLD_BOUNDS.x - 7, 0, WORLD_BOUNDS.maxZ - 9);
    for (let i = 0; i < 40; i++) w.render(0, g.pos, false, true);
    return { blocked, intact, within, walls: walls.length };
  });
  expect(result).toEqual({
    blocked: true,
    intact: true,
    within: true,
    walls: 4,
  });
  await page.screenshot({ path: "docs/perimeter-explosives.png" });
});
