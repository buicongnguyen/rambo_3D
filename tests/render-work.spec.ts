import { test, expect } from "@playwright/test";
test("selective staged uploads and effect reuse preserve rendering", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(async () =>
      (await import("/tests/fixtures/render-work.ts")).verifyRenderWork(),
    ),
  ).toBe(true);
});
