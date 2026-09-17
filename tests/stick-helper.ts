import type { Page } from "@playwright/test";
export async function stickPoint(page: Page, direction: "up" | "left") {
  const r = (await page.locator("#move-pad").boundingBox())!;
  return {
    clientX: r.x + r.width / 2 - (direction === "left" ? 40 : 0),
    clientY: r.y + r.height / 2 - (direction === "up" ? 40 : 0),
  };
}
