import { test, expect } from "@playwright/test";
test("analog movement clamps diagonals, ignores extra fingers and resets on resize", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5177");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").tap();
  const pad = page.locator("#move-pad"),
    r = (await pad.boundingBox())!;
  const cx = r.x + r.width / 2,
    cy = r.y + r.height / 2;
  const axes = () =>
    page.evaluate(() => {
      const i = (window as any).__nightfall.input;
      return [i.x, i.z];
    });
  await pad.dispatchEvent("pointerdown", {
    pointerId: 55,
    button: 0,
    clientX: cx + 2,
    clientY: cy,
  });
  await expect.poll(axes).toEqual([0, 0]);
  await pad.dispatchEvent("pointermove", {
    pointerId: 55,
    clientX: cx + 20,
    clientY: cy,
  });
  await expect.poll(async () => (await axes())[0]).toBeGreaterThan(0.3);
  expect((await axes())[0]).toBeLessThan(0.7);
  await pad.dispatchEvent("pointerdown", {
    pointerId: 56,
    button: 0,
    clientX: cx - 40,
    clientY: cy,
  });
  expect((await axes())[0]).toBeGreaterThan(0);
  await pad.dispatchEvent("pointermove", {
    pointerId: 55,
    clientX: cx + 200,
    clientY: cy - 200,
  });
  await expect.poll(async () => (await axes())[1]).toBeLessThan(-0.7);
  expect(Math.hypot(...(await axes()))).toBeCloseTo(1);
  await pad.dispatchEvent("lostpointercapture", { pointerId: 55 });
  await expect.poll(axes).toEqual([0, 0]);
  await pad.dispatchEvent("pointerdown", {
    pointerId: 57,
    button: 0,
    clientX: cx - 40,
    clientY: cy,
  });
  await expect.poll(async () => (await axes())[0]).toBe(-1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(axes).toEqual([0, 0]);
  await expect(pad).not.toHaveClass(/engaged/);
  await page.screenshot({ path: "docs/joystick-landscape.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/joystick-portrait.png" });
  await context.close();
});
