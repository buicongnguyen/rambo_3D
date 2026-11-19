import { expect, type Page } from "@playwright/test";

/** Reach the opening relay and let its guards deploy through the barracks doors. */
export async function reachOpeningCounterattack(page: Page) {
  const response = await page.evaluate(async () => {
    const { game, input } = (window as any).__nightfall;
    const { MISSIONS } = await import("/src/missions.ts");
    const { x, z } = MISSIONS[0].objective;
    game.invincible = 1e6;
    game.pos.set(x, 0, z);
    const idle = { ...input, x: 0, z: 0, fire: false, assist: false, blast: false };
    game.update(1 / 60, idle);
    for (let i = 0; i < 360 && game.pendingGuards > 0; i++)
      game.update(1 / 60, idle);
    return { secured: game.objective, waiting: game.pendingGuards, guards: game.guardIds.size };
  });
  expect(response).toEqual({ secured: true, waiting: 0, guards: 2 });
}
