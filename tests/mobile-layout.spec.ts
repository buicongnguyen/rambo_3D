import { test, expect } from "@playwright/test";
test("mobile status leaves bottom thumb controls clear across phone sizes", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5177");
  await expect(page.locator("#deploy")).toBeEnabled();
  await page.locator("#deploy").tap();
  for (const [width, height] of [
    [390, 844],
    [320, 568],
    [844, 390],
    [568, 320],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("#radio")).toBeHidden();
    await expect(page.locator("#mission-label")).toBeHidden();
    await expect(page.locator("#score")).toBeHidden();
    await expect(page.locator("#objectives span:visible")).toHaveCount(1);
    expect(
      (await page.locator(".objective-panel").boundingBox())!.height,
    ).toBeLessThan(65);
    expect(
      (await page.locator(".health-panel").boundingBox())!.height,
    ).toBeLessThan(65);
    const layout = await page.evaluate(() => {
      const pad = document.querySelector("#move-pad")!.getBoundingClientRect();
      const controls = [
        ...document.querySelectorAll("#move-pad,#touch button"),
      ];
      const panels = [
        ...document.querySelectorAll(
          ".health-panel,.ammo-panel,.objective-panel,#minimap,#radio",
        ),
      ].map((e) => e.getBoundingClientRect());
      return {
        bottom: innerHeight - pad.bottom,
        clear: controls.every((e) => {
          const r = e.getBoundingClientRect(),
            hit = document.elementFromPoint(
              r.x + r.width / 2,
              r.y + r.height / 2,
            );
          return (
            r.width >= 44 &&
            r.height >= 44 &&
            r.x >= 0 &&
            r.y >= 0 &&
            r.right <= innerWidth &&
            r.bottom <= innerHeight &&
            (hit === e || e.contains(hit)) &&
            panels.every(
              (p) =>
                r.right <= p.left ||
                r.left >= p.right ||
                r.bottom <= p.top ||
                r.top >= p.bottom,
            )
          );
        }),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout, `${width}x${height}`).toEqual({
      bottom: width > height ? 16 : 20,
      clear: true,
      overflow: false,
    });
  }
  await context.close();
});
