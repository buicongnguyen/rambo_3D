import { segmentBox } from "./rules.mjs";
import { sampleRoute, vehicleAnchors, routeFormation } from "./routes.mjs";

/** Roadside barracks reserve a straight, unobstructed doorway-to-relay approach. */
export function addRelayHouses(m, boxes, patches) {
  const houses = [],
    candidates = [],
    roads = m.roads;
  const overlaps = (a, b, pad = 0) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
  const bays = vehicleAnchors(roads).flatMap(({ route, fraction }) =>
    [-0.07, 0, 0.07].flatMap((df) => {
      const a = sampleRoute(route, fraction + df);
      return [-8, 8].map((o) => ({ a, x: a.x + a.nx * o, z: a.z + a.nz * o }));
    }),
  );
  const fixed = (b) =>
    ["building", "boundary", "hill", "basalt", "fuel", "explosive"].includes(
      b.kind,
    );
  for (let dx = -24; dx <= 24; dx += 3)
    for (let dz = -24; dz <= 24; dz += 3) {
      const distance = Math.hypot(dx, dz);
      if (distance < 11 || distance > 25) continue;
      const nx = Math.abs(dx) > Math.abs(dz) ? -Math.sign(dx) : 0;
      const nz = nx ? 0 : -Math.sign(dz);
      const x = m.objective.x + dx,
        z = m.objective.z + dz;
      const b = {
        x,
        z,
        w: nx ? 6 : 5,
        d: nx ? 5 : 6,
        kind: "building",
        asset: "relayHouse",
        height: 4.1,
        rotation: Math.atan2(nx, nz),
        entrance: { x: x + nx * 2.25, z: z + nz * 2.25 },
        exit: { x: x + nx * 4.4, z: z + nz * 4.4 },
      };
      if (
        Math.abs(x) + b.w / 2 + 1 > m.bounds.x ||
        z - b.d / 2 - 1 < m.bounds.minZ ||
        z + b.d / 2 + 1 > m.bounds.maxZ
      )
        continue;
      if (
        roads.some((r) =>
          r
            .slice(1)
            .some(
              (p, i) =>
                segmentBox(r[i].x, r[i].z, p.x, p.z, b, 3.8) !== Infinity,
            ),
        )
      )
        continue;
      if (
        [m.start, m.extract, ...routeFormation(m.route, 0.9, 4)].some(
          (p) => segmentBox(p.x, p.z, p.x, p.z, b, 4) !== Infinity,
        )
      )
        continue;
      if (
        bays.some((p) => segmentBox(p.a.x, p.a.z, p.x, p.z, b, 3) !== Infinity)
      )
        continue;
      if (
        boxes.some(
          (a) =>
            fixed(a) &&
            (overlaps(a, b, 1) ||
              segmentBox(
                b.entrance.x,
                b.entrance.z,
                m.objective.x,
                m.objective.z,
                a,
                1.4,
              ) !== Infinity),
        )
      )
        continue;
      candidates.push({ b, cost: distance + Math.abs(nx ? dz : dx) * 0.35 });
    }
  candidates.sort((a, b) => a.cost - b.cost);
  const count = m.stage === 0 && m.level === 0 ? 2 : 3;
  for (const { b } of candidates) {
    if (
      houses.some(
        (h) =>
          Math.hypot(h.x - b.x, h.z - b.z) < 11 ||
          segmentBox(
            h.entrance.x,
            h.entrance.z,
            m.objective.x,
            m.objective.z,
            b,
            1.4,
          ) !== Infinity ||
          segmentBox(
            b.entrance.x,
            b.entrance.z,
            m.objective.x,
            m.objective.z,
            h,
            1.4,
          ) !== Infinity,
      )
    )
      continue;
    // Replace only local clutter; roads, fixed cover, boss arenas and vehicle bays stay clear.
    for (let i = boxes.length - 1; i >= 0; i--) {
      const a = boxes[i];
      if (
        !fixed(a) &&
        (overlaps(a, b, 1.2) ||
          segmentBox(
            b.entrance.x,
            b.entrance.z,
            m.objective.x,
            m.objective.z,
            a,
            1.4,
          ) !== Infinity)
      )
        boxes.splice(i, 1);
    }
    for (let i = patches.length - 1; i >= 0; i--)
      if (
        patches[i].kind !== "ice" &&
        segmentBox(
          b.x,
          b.z,
          b.exit.x,
          b.exit.z,
          {
            ...patches[i],
            w: patches[i].radius * 2,
            d: patches[i].radius * 2,
          },
          1.5,
        ) !== Infinity
      )
        patches.splice(i, 1);
    boxes.push(b);
    houses.push(b);
    if (houses.length === count) break;
  }
  if (houses.length < 2)
    throw new Error(
      `No safe relay houses for stage ${m.stage}, level ${m.level}`,
    );
  return houses;
}
