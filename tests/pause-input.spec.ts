import { expect, test } from "@playwright/test";

test("holding Escape or releasing fire cannot dismiss pause", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#deploy").click();
  await page.keyboard.down("Space");
  await page.keyboard.down("Escape");
  await expect(page.locator("#resume")).toBeFocused();
  await page.keyboard.down("Escape");
  await page.keyboard.up("Escape");
  await expect(page.locator("#resume")).toBeFocused();

  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(page.locator("#resume")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#scene")).toBeFocused();
});

test("restarting from pause restores the mission music level", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#deploy").click();
  const themeLevel = () =>
    page.evaluate(() => (window as any).__nightfall.audio.themeLevel);
  const missionLevel = await themeLevel();
  await page.locator("#pause").click();
  expect(await themeLevel()).toBeLessThan(missionLevel);
  await page.locator("#restart").click();
  await page.locator("#restart").click();
  await expect(page.locator("#overlay")).toBeHidden();
  expect(await themeLevel()).toBe(missionLevel);
});
