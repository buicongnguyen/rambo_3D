import { missionPacing } from "./progression.mjs";
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
  pacing = missionPacing(1, 0),
) {
  const rand = seededRandom(seed),
    drops = [];
  const kinds = pacing.supplies ?? [
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
  let weapon = 0;
  // Balance each reward type independently: the kind list is not parity-neutral.
  const nextBranch = { weapon: 0, health: 0, shield: 1 };
  for (let i = 0; i < kinds.length; i++) {
    const branch = nextBranch[kinds[i]]++ % roads.length;
    const target = 0.04 + ((i + rand() * 0.65) / kinds.length) * 0.89,
      side = rand() < 0.5 ? -1 : 1;
    const ranked = candidates
      .filter((p) => p.branch === branch)
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
      index: kinds[i] === "weapon" ? pacing.weapons[weapon++] : -1,
    });
  }
  return drops;
}
/**
 * Route-progress ambushes: a squad bursts in from the flanks ahead of you when
 * you are part-way down the road to the relay. `at` is the share of the road
 * distance to the relay. None in the first two stages; one from stage 3 and
 * two from stage 5. Size scales with the difficulty soldier multiplier.
 */
export function ambushPlan(stage, soldiers = 1) {
  if (stage < 2) return [];
  const size = (stage >= 4 ? 4 : 3) * soldiers;
  return (stage >= 4 ? [0.35, 0.7] : [0.5]).map((at) => ({ at, size }));
}
/**
 * Where an ambush squad appears: further down the road on alternating flanks,
 * each point at least `minDistance` m from the player in a straight line, so
 * squads never pop in beside you where a winding road doubles back.
 */
export function ambushPoints(
  road,
  along,
  count,
  pointAt,
  from,
  minDistance = 22,
) {
  const points = [];
  for (let d = along + 20; points.length < count && d < along + 90; d += 2.5) {
    const a = pointAt(road, d),
      b = pointAt(road, d + 1);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len,
      nz = (b.x - a.x) / len;
    const offset = 9 + (points.length % 3) * 1.5;
    for (const side of points.length % 2 ? [1, -1] : [-1, 1]) {
      const p = { x: a.x + nx * side * offset, z: a.z + nz * side * offset };
      if (Math.hypot(p.x - from.x, p.z - from.z) < minDistance) continue;
      if (points.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.2)) continue;
      points.push(p);
      break;
    }
  }
  return points;
}
export const BOSS_ATTACKS = {
  gunship: { damage: 10, interval: 0.6, count: 3, spread: 0.1, speed: 15 },
  spider: { damage: 12, interval: 0.72, count: 3, spread: 0.12, speed: 13 },
  heavy: { damage: 28, interval: 4.4, warning: 1.4, radius: 3.4, count: 3 },
  laserTank: { damage: 32, interval: 3.8, warning: 1.2, width: 3.2 },
};

/** Stagger upgrades in shoulder bays, with a clear lane past every parked vehicle. */
export function placeVehicles(
  route,
  boxes,
  patches,
  bounds,
  roads = [route],
  pacing = missionPacing(1, 0),
) {
  const kinds = ["motorcycle", "jeep", "tank"],
    radii = [0.85, 1.65, 2.3];
  const plans = vehicleAnchors(roads),
    targets = plans.map((p) => p.fraction),
    result = [];
  for (let i = 0; i < kinds.length; i++) {
    if (!pacing.vehicles.includes(kinds[i])) continue;
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
            (b) =>
              ["fuel", "explosive"].includes(b.kind) &&
              Math.hypot(x - b.x, z - b.z) < 7,
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
