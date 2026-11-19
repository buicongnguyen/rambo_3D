import { test, expect } from "@playwright/test";

for (const phone of [false, true]) {
  test.describe(phone ? "Phone HUD" : "Desktop HUD", () => {
    test.use({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
      isMobile: phone,
      hasTouch: phone,
      deviceScaleFactor: 0.5,
    });

    test("marks the active objective and explains how to extract in a vehicle", async ({
      page,
    }) => {
      await page.goto("/");
      await page.locator("#deploy").click();
      const current = page.locator('#objectives [aria-current="step"]');
      await expect(current).toHaveText(/Find their signal/);
      if (phone)
        await expect(page.locator("#objectives span:visible")).toHaveCount(1);
      await page.evaluate(() => {
        const { game } = (window as any).__nightfall;
        game.start(3, { armor: 0, power: 0, mobility: 0 }, "normal");
        game.invincible = 100;
        game.objective = true;
        game.pendingGuards = 2;
        game.reinforcementClock = 100;
      });
      await expect(current).toContainText(
        "Neutralize relay guards · 2 incoming",
      );
      await page.evaluate(() => {
        const { game } = (window as any).__nightfall;
        const ride = game.rides[0];
        game.pos.copy(ride.mesh.position);
        game.useRide();
        if (game.riding !== ride)
          throw Error("Fixture could not board vehicle");
        game.bossDead = true;
      });
      await expect(current).toContainText(
        phone ? "Tap EXIT at extraction" : "Press E at extraction",
      );
      if (phone) await page.locator('[data-action="interact"]').tap();
      else await page.keyboard.press("e");
      await expect(current).toContainText("Reach extraction");
    });

    if (phone)
      test("shows reload progress and restores the existing button when ready", async ({
        page,
      }) => {
        await page.goto("/");
        await page.locator("#deploy").click();
        const reload = page.getByRole("button", {
          name: "Reload",
          exact: true,
        });
        await expect(page.locator("#reload-label")).toBeHidden();
        await page.evaluate(() => {
          const { game } = (window as any).__nightfall;
          game.ammo = 1;
          game.invincible = 100;
        });
        await reload.tap();
        await expect(reload).toHaveAttribute("aria-busy", "true");
        await expect(reload).toHaveText(/^\d+\.\d+s$/);
        await expect(reload).toHaveText("RELOAD", { timeout: 10000 });
        await expect(reload).toHaveAttribute("aria-busy", "false");
        await expect(page.locator("#ammo")).toHaveText("24");
      });
  });
}
