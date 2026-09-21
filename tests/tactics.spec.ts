import { stickPoint } from "./stick-helper";
import { test, expect } from "@playwright/test";

for (const mobile of [false, true])
  test(`BLAST uses actual ${mobile ? "touch" : "keyboard"} input to detonate a crowd store and releases cleanly`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
      deviceScaleFactor: 0.5,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        "nightfall-prefs",
        JSON.stringify({ low: true, sound: false }),
      ),
    );
    await page.goto("/");
    await expect(page.locator("#deploy")).toBeEnabled();
    await page.locator("#deploy").click();
    await page.evaluate(() =>
      (window as any).__nightfall.game.start(
        3,
        { armor: 0, power: 0, mobility: 0 },
        "normal",
      ),
    );
    await page.evaluate(async () => {
      const { game: g, world: w } = (window as any).__nightfall;
      const { COVER, PATCHES } = await import("/src/missions.ts");
      PATCHES.length = 0;
      const p = w.destructibles.find((p: any) => p.kind === "explosive");
      p.box.x = 0;
      p.box.z = 0;
      p.mesh.position.set(0, 0, 0);
      p.hp = 25;
      COVER.splice(0, COVER.length, p.box);
      w.destructibles = [p];
      g.enemies.forEach((e: any) => {
        e.hp = 0;
        e.mesh.visible = false;
        e.warn.visible = false;
      });
      for (let i = 0; i < 3; i++) {
        const e = g.enemies[i];
        e.hp = 65;
        e.armored = false;
        e.boss = false;
        e.x = i === 0 ? -2 : 2;
        e.z = i === 2 ? -1.5 : 0;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.visible = true;
      }
      g.rides.forEach((v: any, i: number) =>
        v.mesh.position.set(-35 + i * 8, 0, -30),
      );
      g.pickups.forEach((p: any) => p.removeFromParent());
      g.pickups = [];
      g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
      g.pos.set(0, 0, 12);
      g.player.position.copy(g.pos);
      g.quakeTime = 10000;
      g.power = 0;
      g.weapon = 0;
      g.ammo = 24;
      g.reloadTime = 0;
      g.shotTime = 0;
      (window as any).__blastShots = 0;
      const originalFire = g.fireWeapon.bind(g);
      g.fireWeapon = (...args: any[]) => {
        (window as any).__blastShots++;
        return originalFire(...args);
      };
      g.kills = 0;
      g.hp = 150;
      g.invincible = 0;
      (window as any).__blastEvents = [];
      const notice = document.querySelector("#combat-notice")!;
      new MutationObserver(() =>
        (window as any).__blastEvents.push(notice.textContent),
      ).observe(notice, { childList: true, subtree: true });
    });
    const hold = page.locator('[data-hold="blast"]');
    if (mobile) {
      await expect(hold).toBeVisible();
      const box = await hold.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await hold.dispatchEvent("pointerdown", {
        pointerId: 81,
        pointerType: "touch",
      });
      await page.locator("#move-pad").dispatchEvent("pointerdown", {
        pointerId: 82,
        button: 0,
        ...(await stickPoint(page, "left")),
      });
    } else await page.keyboard.down("KeyB");
    await expect
      .poll(() => page.evaluate(() => (window as any).__nightfall.game.kills))
      .toBe(3);
    if (mobile) {
      await hold.dispatchEvent("pointercancel", { pointerId: 81 });
      await page
        .locator("#move-pad")
        .dispatchEvent("pointercancel", { pointerId: 82 });
    } else await page.keyboard.up("KeyB");
    await expect
      .poll(() => page.evaluate(() => (window as any).__nightfall.input.blast))
      .toBe(false);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__blastEvents.some((s: string) =>
            s.startsWith("CHAIN BLAST · 3 HOSTILES DOWN"),
          ),
        ),
      )
      .toBe(true);
    const state = await page.evaluate(() => {
      const { game: g } = (window as any).__nightfall;
      return {
        ammo: g.ammo,
        hp: g.hp,
        x: g.pos.x,
        events: (window as any).__blastEvents,
        shots: (window as any).__blastShots,
      };
    });
    expect(state.shots).toBeGreaterThan(0);
    expect(state.ammo).toBe(24 - state.shots);
    expect(state.hp).toBe(150);
    if (mobile) expect(state.x).toBeLessThan(0);
    // With no store left, a second hold must not silently fire at soldiers or spend ammo.
    if (mobile) await hold.dispatchEvent("pointerdown", { pointerId: 83 });
    else await page.keyboard.down("KeyB");
    await expect(page.locator("#combat-notice")).toHaveText(
      "NO SAFE EXPLOSIVE IN SIGHT",
    );
    expect(
      await page.evaluate(() => (window as any).__nightfall.game.ammo),
    ).toBe(state.ammo);
    if (mobile)
      await hold.dispatchEvent("lostpointercapture", { pointerId: 83 });
    else await page.keyboard.up("KeyB");
    await expect
      .poll(() => page.evaluate(() => (window as any).__nightfall.input.blast))
      .toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (mobile) {
      await page.setViewportSize({ width: 844, height: 390 });
      const layout = await page.evaluate(() => {
        const controls = [...document.querySelectorAll("#touch button")].map(
          (b) => b.getBoundingClientRect(),
        );
        const panels = [
          "#radio",
          "#minimap",
          ".objective-panel",
          ".health-panel",
          ".ammo-panel",
        ].map((s) => document.querySelector(s)!.getBoundingClientRect());
        return {
          usable: controls.every(
            (r) =>
              r.width >= 44 &&
              r.height >= 44 &&
              r.x >= 0 &&
              r.y >= 0 &&
              r.right <= innerWidth &&
              r.bottom <= innerHeight,
          ),
          separated: controls.every((r) =>
            panels.every(
              (p) =>
                r.right <= p.left ||
                r.left >= p.right ||
                r.bottom <= p.top ||
                r.top >= p.bottom,
            ),
          ),
        };
      });
      expect(layout).toEqual({ usable: true, separated: true });
    }
    expect(errors).toEqual([]);
    await context.close();
  });

test("live damage paths apply tank armor, doubled enemy attacks, warning and long-range retaliation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").click();
  await page.evaluate(() =>
    (window as any).__nightfall.game.start(
      3,
      { armor: 0, power: 0, mobility: 0 },
      "normal",
    ),
  );
  const result = await page.evaluate(async () => {
    const { game: g, world: w, input } = (window as any).__nightfall;
    const { COVER, PATCHES } = await import("/src/missions.ts");
    const { WEAPONS } = await import("/src/arsenal.ts");
    COVER.length = 0;
    PATCHES.length = 0;
    g.enemies.forEach((e: any) => (e.hp = 0));
    g.rides.forEach((v: any) => v.mesh.position.set(-50, 0, -80));
    g.weaponDrops.forEach((d: any) => d.mesh.position.set(-80, 0, -80));
    g.pickups.forEach((p: any) => p.removeFromParent());
    g.pickups = [];
    g.pos.set(10, 0, 20);
    g.quakeTime = 0;
    g.invincible = 10000;
    const e = g.enemies.find((e: any) => e.armored);
    e.hp = 230;
    e.max = 230;
    e.x = 10;
    e.z = 6;
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = 0;
    e.cool = 0.79;
    e.auxCool = 100;
    g.hurt(e, WEAPONS[2].damage, WEAPONS[2]);
    const mgDamage = 230 - e.hp;
    const armorFeedback =
      g.combatNotice.includes("ARMOR DEFLECTS") &&
      g.impacts.bursts.some((b: any) => b.kind === "armor" && b.group.visible);
    g.hurt(e, WEAPONS[7].damage, WEAPONS[7]);
    const rocketDamage = 230 - mgDamage - e.hp;
    e.hp = 10000;
    const cmd = {
      ...input,
      fire: false,
      blast: false,
      assist: false,
      x: 0,
      z: 0,
      interact: false,
      reload: false,
      swap: false,
      turbo: false,
    };
    g.update(1 / 60, { ...cmd });
    const warning = e.warn.visible;
    e.cool = 0;
    e.auxCool = 0;
    g.update(1 / 60, { ...cmd });
    const attacks = g.bullets
      .filter((b: any) => b.enemy)
      .map((b: any) => b.damage);
    e.hp = 0;
    const distant = g.enemies.find((a: any) => !a.armored && !a.boss);
    distant.hp = 65;
    distant.x = 10;
    distant.z = -17;
    distant.mesh.rotation.y = 0;
    distant.cool = 0;
    distant.alerted = false;
    g.hurt(distant, 1, WEAPONS[0]);
    const before = distant.z;
    g.update(1 / 60, { ...cmd });
    const retaliates =
      distant.z > before &&
      g.bullets.some((b: any) => b.enemy && b.damage === 6);
    g.phase = "won";
    return {
      mgDamage,
      rocketDamage,
      armorFeedback,
      warning,
      attacks,
      retaliates,
    };
  });
  expect(result).toMatchObject({
    mgDamage: 2,
    rocketDamage: 206,
    armorFeedback: true,
    warning: true,
    retaliates: true,
  });
  expect(result.attacks.sort((a: number, b: number) => a - b)).toEqual([8, 36]);
});
