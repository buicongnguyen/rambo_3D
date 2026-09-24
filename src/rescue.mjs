import { sampleRoute, vehicleAnchors } from "./routes.mjs";
import { segmentBox } from "./rules.mjs";

export const MAX_SQUAD = 3;
export const TREASURE = { money: 10, gold: 25, diamond: 75 };
export const KIT_COSTS = [100, 200, 300];

/** Reserve accessible roadside cells without closing roads, vehicle bays or barracks exits. */
export function addPrisons(m, boxes, patches) {
  const prisons = [];
  const bays = (
    m.stage === 0 && m.level === 0 ? [] : vehicleAnchors(m.roads)
  ).flatMap(({ route, fraction }) =>
    [-0.07, 0, 0.07].flatMap((df) => {
      const a = sampleRoute(route, fraction + df);
      return [-8, 8].map((o) => ({ a, x: a.x + a.nx * o, z: a.z + a.nz * o }));
    }),
  );
  const overlap = (a, b, pad) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
  const soft = (b) => ["tree", "snowTree"].includes(b.kind);
  const count = m.stage === 0 && m.level === 0 ? 1 : 2;
  for (const target of [0.12, 0.56]) {
    if (prisons.length >= count) break;
    const candidates = [];
    for (const road of m.roads)
      for (let f = 0.07; f < 0.78; f += 0.025) {
        const a = sampleRoute(road, f);
        for (const offset of [-6.6, 6.6, -9, 9, -12, 12]) {
          const x = a.x + a.nx * offset,
            z = a.z + a.nz * offset;
          const nx =
            Math.abs(a.nx) >= Math.abs(a.nz) ? -Math.sign(a.nx * offset) : 0;
          const nz = nx ? 0 : -Math.sign(a.nz * offset);
          const b = {
            x,
            z,
            w: 4.2,
            d: 4.2,
            kind: "prison",
            asset: "prisonHouse",
            height: 3.2,
            rotation: Math.atan2(nx, nz),
            entrance: { x: x + nx * 1.5, z: z + nz * 1.5 },
            exit: { x: x + nx * 3.4, z: z + nz * 3.4 },
          };
          if (
            Math.abs(x) + 3 > m.bounds.x ||
            z - 3 < m.bounds.minZ ||
            z + 3 > m.bounds.maxZ
          )
            continue;
          if (
            [m.start, m.objective, m.extract].some(
              (p) => Math.hypot(p.x - x, p.z - z) < 8,
            )
          )
            continue;
          if (prisons.some((p) => Math.hypot(p.x - x, p.z - z) < 20)) continue;
          if (
            m.roads.some((r) =>
              r
                .slice(1)
                .some(
                  (p, i) =>
                    segmentBox(r[i].x, r[i].z, p.x, p.z, b, 3.6) !== Infinity,
                ),
            )
          )
            continue;
          if (
            bays.some(
              (p) => segmentBox(p.a.x, p.a.z, p.x, p.z, b, 3) !== Infinity,
            )
          )
            continue;
          if (
            boxes.some(
              (p) =>
                !soft(p) &&
                (overlap(p, b, 1) ||
                  segmentBox(a.x, a.z, b.exit.x, b.exit.z, p, 1.5) !==
                    Infinity ||
                  segmentBox(
                    b.entrance.x,
                    b.entrance.z,
                    b.exit.x,
                    b.exit.z,
                    p,
                    1,
                  ) !== Infinity),
            )
          )
            continue;
          if (
            boxes.some(
              (p) =>
                p.asset === "relayHouse" &&
                segmentBox(
                  p.entrance.x,
                  p.entrance.z,
                  m.objective.x,
                  m.objective.z,
                  b,
                  1.5,
                ) !== Infinity,
            )
          )
            continue;
          if (
            patches.some(
              (p) =>
                p.kind !== "ice" &&
                segmentBox(
                  x,
                  z,
                  a.x,
                  a.z,
                  { ...p, w: p.radius * 2, d: p.radius * 2 },
                  2,
                ) !== Infinity,
            )
          )
            continue;
          candidates.push({
            b,
            a,
            cost: Math.abs(f - target) * 100 + Math.abs(offset) * 0.2,
          });
        }
      }
    candidates.sort((a, b) => a.cost - b.cost);
    if (!candidates.length) continue;
    const { b, a } = candidates[0];
    for (let i = boxes.length - 1; i >= 0; i--)
      if (
        soft(boxes[i]) &&
        (overlap(boxes[i], b, 1) ||
          segmentBox(a.x, a.z, b.exit.x, b.exit.z, boxes[i], 1.5) !==
            Infinity ||
          segmentBox(
            b.entrance.x,
            b.entrance.z,
            b.exit.x,
            b.exit.z,
            boxes[i],
            1,
          ) !== Infinity)
      )
        boxes.splice(i, 1);
    boxes.push(b);
    prisons.push(b);
  }
  return prisons;
}

/** Small bonuses occupy clear road shoulders; every location has a clear approach. */
export function fieldBonuses(m, boxes, patches, occupied = []) {
  const placed = [];
  for (const [fraction, kind] of [
    [0.065, "money"],
    [0.12, "weapon"],
    [0.27, "gold"],
    [0.48, "money"],
    [0.72, "gold"],
  ]) {
    if (kind === "weapon" && !(m.stage === 0 && m.level === 0)) continue;
    let found = null;
    for (const df of [0, 0.015, -0.015, 0.03, -0.03]) {
      const a = sampleRoute(m.route, fraction + df);
      for (const offset of [1.8, -1.8, 0, 3, -3]) {
        const p = { x: a.x + a.nx * offset, z: a.z + a.nz * offset, kind };
        if (
          Math.abs(p.x) > m.bounds.x - 2 ||
          p.z < m.bounds.minZ + 2 ||
          p.z > m.bounds.maxZ - 2
        )
          continue;
        if (
          boxes.some((b) => segmentBox(a.x, a.z, p.x, p.z, b, 1.2) !== Infinity)
        )
          continue;
        if (
          patches.some(
            (b) =>
              b.kind !== "ice" &&
              Math.hypot(p.x - b.x, p.z - b.z) < b.radius + 1,
          )
        )
          continue;
        if (
          [...placed, ...occupied].some(
            (b) => Math.hypot(p.x - b.x, p.z - b.z) < 2.2,
          )
        )
          continue;
        found = p;
        break;
      }
      if (found) break;
    }
    if (found) placed.push(found);
  }
  return placed;
}

/** Once the bars have risen, the doorway and interior become usable cover. */
export function openedPrisonWalls(box) {
  const c = Math.cos(box.rotation),
    s = Math.sin(box.rotation);
  // Every wall stays inside the closed prison's 4.2 m footprint, so swapping
  // collision when the gate opens can never land a wall on a soldier at the door.
  return [
    [-1.92, 0, 0.3, 4.2],
    [1.92, 0, 0.3, 4.2],
    [0, -1.92, 4.2, 0.3],
    [-1.5, 2.025, 1.2, 0.15],
    [1.5, 2.025, 1.2, 0.15],
  ].map(([x, z, w, d]) => ({
    x: box.x + x * c + z * s,
    z: box.z - x * s + z * c,
    w: w * Math.abs(c) + d * Math.abs(s),
    d: d * Math.abs(c) + w * Math.abs(s),
    kind: "prisonWall",
    height: 3.2,
  }));
}
