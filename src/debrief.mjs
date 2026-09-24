/**
 * Mission debrief rules: a three-star grade, par time and the credit tally
 * banked at extraction. Pure functions shared by the UI and unit tests.
 */
import { TREASURE } from "./rescue.mjs";

/** Credits per star earned, banked with the recovered treasure. */
export const STAR_BONUS = 10;

/** Par time (s): a brisk run of the mission road plus a fight allowance. */
export function missionPar(routeMetres, finale = false) {
  return Math.round(75 + routeMetres * 0.9 + (finale ? 90 : 0));
}

/** One star each: complete the mission, beat par, finish above half health. */
export function missionGrade({ win, elapsed, par, hpRatio }) {
  const criteria = [
    { id: "complete", label: "Mission complete", met: !!win },
    { id: "par", label: "Beat par time", met: !!win && elapsed <= par },
    {
      id: "health",
      label: "Finish above 50% health",
      met: !!win && hpRatio >= 0.5,
    },
  ];
  return { stars: criteria.filter((c) => c.met).length, criteria };
}

/** Treasure counts × value, plus the star bonus; `total` is what gets banked. */
export function rewardBreakdown(loot, stars) {
  const rows = [
    {
      id: "money",
      label: "Banknotes",
      count: loot.money ?? 0,
      each: TREASURE.money,
    },
    {
      id: "gold",
      label: "Gold bars",
      count: loot.gold ?? 0,
      each: TREASURE.gold,
    },
    {
      id: "diamond",
      label: "Diamonds",
      count: loot.diamond ?? 0,
      each: TREASURE.diamond,
    },
    { id: "star", label: "Star bonus", count: stars, each: STAR_BONUS },
  ].map((row) => ({ ...row, value: row.count * row.each }));
  return { rows, total: rows.reduce((sum, row) => sum + row.value, 0) };
}

/** Keep each level's best star grade (0–3). */
export function recordStars(stars, index, earned) {
  const next = Array.isArray(stars) ? [...stars] : [];
  while (next.length <= index) next.push(0);
  next[index] = Math.max(next[index] ?? 0, Math.min(3, Math.max(0, earned)));
  return next;
}
