import { test, expect } from "@playwright/test";

const SAVE = {
  version: 2,
  mission: 3,
  armor: 1,
  power: 1,
  mobility: 1,
  best: 0,
  completed: false,
  credits: 0,
  // 7 stars: Sailor (3) and Pirate captain (6) unlock, Sun knight (12) does not.
  stars: [3, 3, 1],
};

test("the wardrobe dresses Ghost: body and star-unlocked outfit carry into the mission", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (save) => localStorage.setItem("nightfall-campaign", JSON.stringify(save)),
    SAVE,
  );
  await page.goto("/");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#field-shop").click();
  await expect(page.locator('[data-outfit="knight"]')).toBeDisabled();
  await expect(page.locator('[data-outfit="knight"]')).toContainText("★ 12");
  await page.locator('[data-hero="commandoWoman"]').click();
  await expect(page.locator('[data-hero="commandoWoman"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator('[data-outfit="pirate"]')).toBeEnabled();
  await page.locator('[data-outfit="navy"]').click();
  await expect(page.locator('[data-outfit="navy"]')).toContainText("WEARING");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nightfall-campaign")!),
  );
  expect([saved.hero, saved.outfit, saved.outfits]).toEqual([
    "commandoWoman",
    "navy",
    ["none", "navy", "pirate"],
  ]);
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>("#close-shop")!.click(),
  );
  await page.locator("#deploy").click();
  await expect(page.locator("#hud")).toBeVisible();
  const rig = await page.evaluate(() => {
    const { game } = (window as any).__nightfall;
    let pieces = 0,
      pack = 0,
      tint = "";
    game.player.traverse((o: any) => {
      if (o.name === "outfit navy") pieces++;
      // Webbing whose nearest joint is the spine: the rifle sling the sailor collar replaces.
      let joint = o.parent;
      while (joint && !joint.userData.joint) joint = joint.parent;
      if (
        o.isMesh &&
        joint?.userData.joint === "Spine" &&
        o.material.name === "Webbing tan"
      )
        pack++;
      if (o.isMesh && o.material.name === "Hero fatigues")
        tint = o.material.color.getHexString();
    });
    return {
      model: game.player.userData.model,
      variant: game.player.userData.variant,
      pieces,
      pack,
      tint,
    };
  });
  // Cap on the head and collar on the spine; the sling is gone; fatigues are white.
  expect(rig).toEqual({
    model: "commandoWoman",
    variant: "look-navy",
    pieces: 2,
    pack: 0,
    tint: "f4f6f9",
  });
  expect(errors).toEqual([]);
});
