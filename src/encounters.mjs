import { sampleRoute, seededRandom, distanceToRoute } from "./routes.mjs";
import { segmentBox } from "./rules.mjs";
/** Every candidate has a tank-width connection to the road, not just an empty center. */
export function placeSupplies(route, boxes, patches, bounds, seed) {
  const rand = seededRandom(seed),
    drops = [];
  const kinds = [
    "weapon",
    "health",
    "shield",
    "weapon",
    "health",
    "weapon",
    "shield",
    "weapon",
    "health",
    "weapon",
    "shield",
    "weapon",
    "health",
    "weapon",
    "shield",
    "weapon",
    "health",
    "weapon",
    "shield",
    "health",
  ];
  const candidates = [];
  for (let f = 0.035; f < 0.94; f += 0.004) {
    const anchor = sampleRoute(route, f);
    for (const offset of [-6.4, -5.4, -4.4, 4.4, 5.4, 6.4]) {
      const x = anchor.x + anchor.nx * offset,
        z = anchor.z + anchor.nz * offset;
      if (
        distanceToRoute(route, x, z) < 4.2 ||
        Math.abs(x) > bounds.x - 3 ||
        z < bounds.minZ + 3 ||
        z > bounds.maxZ - 3 ||
        boxes.some(
          (b) => segmentBox(anchor.x, anchor.z, x, z, b, 2.5) !== Infinity,
        ) ||
        patches.some(
          (p) =>
            p.kind !== "ice" && Math.hypot(x - p.x, z - p.z) < p.radius + 1,
        )
      )
        continue;
      candidates.push({ x, z, anchor, offset, fraction: f });
    }
  }
  let weapon = 2;
  for (let i = 0; i < kinds.length; i++) {
    const target = 0.04 + ((i + rand() * 0.65) / kinds.length) * 0.89,
      side = rand() < 0.5 ? -1 : 1;
    const ranked = candidates
      .filter((p) => drops.every((d) => Math.hypot(p.x - d.x, p.z - d.z) > 2.5))
      .map((p) => ({
        p,
        cost:
          Math.abs(p.fraction - target) * 100 +
          (Math.sign(p.offset) === side ? 0 : 1.5) +
          rand() * 0.8,
      }))
      .sort((a, b) => a.cost - b.cost);
    if (!ranked.length)
      throw new Error(`No accessible supply location for slot ${i}`);
    drops.push({
      ...ranked[0].p,
      kind: kinds[i],
      index: kinds[i] === "weapon" ? weapon++ : -1,
    });
  }
  return drops;
}
export const BOSS_ATTACKS = {
  gunship: { damage: 10, interval: 0.6, count: 3, spread: 0.1, speed: 15 },
  spider: { damage: 12, interval: 0.72, count: 3, spread: 0.12, speed: 13 },
  heavy: { damage: 28, interval: 4.4, warning: 1.4, radius: 3.4, count: 3 },
  laserTank: { damage: 32, interval: 3.8, warning: 1.2, width: 3.2 },
};
