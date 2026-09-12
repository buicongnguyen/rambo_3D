import {
  sampleRoute,
  seededRandom,
  distanceToRoads,
  vehicleAnchors,
} from "./routes.mjs";
import { segmentBox } from "./rules.mjs";
/** Every candidate has a tank-width connection to the road, not just an empty center. */
export function placeSupplies(
  route,
  boxes,
  patches,
  bounds,
  seed,
  roads = [route],
) {
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
  for (let branch = 0; branch < roads.length; branch++)
    for (let f = 0.035; f < 0.94; f += 0.004) {
      const anchor = sampleRoute(roads[branch], f);
      for (const offset of [-6.4, -5.4, -4.4, 4.4, 5.4, 6.4]) {
        const x = anchor.x + anchor.nx * offset,
          z = anchor.z + anchor.nz * offset;
        if (
          distanceToRoads(roads, x, z) < 4.2 ||
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
        candidates.push({ x, z, anchor, offset, fraction: f, branch });
      }
    }
  let weapon = 2;
  for (let i = 0; i < kinds.length; i++) {
    const target = 0.04 + ((i + rand() * 0.65) / kinds.length) * 0.89,
      side = rand() < 0.5 ? -1 : 1;
    const ranked = candidates
      .filter((p) => p.branch === i % roads.length)
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

/** Stagger upgrades in shoulder bays, with a clear lane past every parked vehicle. */
export function placeVehicles(route, boxes, patches, bounds, roads = [route]) {
  const kinds = ["motorcycle", "jeep", "tank"],
    radii = [0.85, 1.65, 2.3];
  const plans = vehicleAnchors(roads),
    targets = plans.map((p) => p.fraction),
    result = [];
  for (let i = 0; i < kinds.length; i++) {
    const candidates = [];
    for (let f = targets[i] - 0.07; f <= targets[i] + 0.07; f += 0.004) {
      const anchor = sampleRoute(plans[i].route, f);
      for (const offset of [-8, -7, -6.4, 6.4, 7, 8]) {
        const x = anchor.x + anchor.nx * offset,
          z = anchor.z + anchor.nz * offset;
        if (
          distanceToRoads(roads, x, z) < radii[i] + 3.6 ||
          Math.abs(x) > bounds.x - radii[i] - 1 ||
          z < bounds.minZ + radii[i] + 1 ||
          z > bounds.maxZ - radii[i] - 1 ||
          boxes.some(
            (b) => segmentBox(anchor.x, anchor.z, x, z, b, 2.5) !== Infinity,
          ) ||
          boxes.some(
            (b) => b.kind === "fuel" && Math.hypot(x - b.x, z - b.z) < 7,
          ) ||
          patches.some(
            (p) =>
              p.kind !== "ice" &&
              Math.hypot(x - p.x, z - p.z) < p.radius + radii[i] + 1,
          )
        )
          continue;
        candidates.push({
          branch: plans[i].branch,
          kind: kinds[i],
          x,
          z,
          anchor,
          fraction: f,
          radius: radii[i],
          cost: Math.abs(f - targets[i]) * 100 + Math.abs(offset) * 0.1,
        });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    if (!candidates.length) throw new Error(`No safe ${kinds[i]} bay`);
    result.push(candidates[0]);
  }
  return result;
}
/** Reuse patrol slots for visible defenders instead of increasing difficulty counts. */
export function guardedPatrols(spawns, targets, boxes, bounds) {
  const result = spawns.map(([x, z]) => ({ x, z, cacheGuard: false })),
    placed = [];
  let slot = 0;
  for (const target of targets) {
    let defenders = 0;
    for (let ring = 0; ring < 3 && defenders < 2; ring++)
      for (let i = 0; i < 16 && defenders < 2; i++) {
        const a = (i * Math.PI) / 8,
          r = 4 + ring * 1.3,
          x = target.x + Math.cos(a) * r,
          z = target.z + Math.sin(a) * r;
        if (
          Math.abs(x) > bounds.x - 2 ||
          z < bounds.minZ + 2 ||
          z > bounds.maxZ - 2 ||
          boxes.some((b) => segmentBox(x, z, x, z, b, 0.85) !== Infinity) ||
          boxes.some(
            (b) =>
              segmentBox(target.x, target.z, x, z, b, 0.05) !== Infinity &&
              !(
                Math.abs(target.x - b.x) < b.w / 2 &&
                Math.abs(target.z - b.z) < b.d / 2
              ),
          ) ||
          placed.some((p) => Math.hypot(x - p.x, z - p.z) < 2)
        )
          continue;
        const p = { x, z, cacheGuard: true };
        result[slot++] = p;
        placed.push(p);
        defenders++;
      }
    if (defenders < 2)
      throw new Error("Guarded cache has no reachable defenders");
  }
  return result;
}
