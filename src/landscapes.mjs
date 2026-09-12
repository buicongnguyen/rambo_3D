import {
  sampleRoute,
  routeFormation,
  seededRandom,
  routeBox,
} from "./routes.mjs";
import { segmentBox } from "./rules.mjs";

/** Permanent ridge belts divide the arms; props are carved back from the road. */
export function squareLandscape(m) {
  const boxes = [],
    patches = [],
    spawns = [];
  const rand = seededRandom(412 + m.stage * 31 + m.level);
  const landmarks = [
    m.start,
    m.objective,
    m.extract,
    ...routeFormation(m.route, 0.9, 4),
  ];
  const bays = [0.13, 0.4, 0.67].flatMap((f) => {
    const p = sampleRoute(m.route, f);
    return [-7, 7].map((offset) => ({
      x: p.x + p.nx * offset,
      z: p.z + p.nz * offset,
      anchor: p,
    }));
  });
  const clearLandmark = (b, pad = 6) =>
    landmarks.every(
      (p) => segmentBox(p.x, p.z, p.x, p.z, b, pad) === Infinity,
    ) &&
    bays.every(
      (p) =>
        segmentBox(
          p.anchor.x,
          p.anchor.z,
          p.x,
          p.z,
          b,
          b.kind === "fuel" ? 7 : 3.2,
        ) === Infinity,
    );
  const onRoad = (b, pad = 3.8) =>
    m.route
      .slice(1)
      .some(
        (p, i) =>
          segmentBox(m.route[i].x, m.route[i].z, p.x, p.z, b, pad) !== Infinity,
      );
  const overlaps = (b, pad = 0.8) =>
    boxes.some(
      (a) =>
        Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad &&
        Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad,
    );
  const permanent =
    m.biome === "volcano" || m.biome === "quake" ? "basalt" : "hill";
  // Continuous belts reach the map boundary. Only the road's hairpin opens them.
  const ridge = (x, z, w, d) => {
    const source = { x, z, w, d, kind: permanent };
    const b = m.diagonal ? routeBox(2, source) : source;
    // Extend diagonal ridge belts to the square map boundary, then discard exterior tiles.
    if (
      b.x - b.w / 2 > m.bounds.x ||
      b.x + b.w / 2 < -m.bounds.x ||
      b.z - b.d / 2 > m.bounds.maxZ ||
      b.z + b.d / 2 < m.bounds.minZ
    )
      return;
    if (!onRoad(b) && clearLandmark(b)) boxes.push(b);
  };
  if (m.shape.includes("S")) {
    const mirror = m.shape.startsWith("MIRRORED") ? -1 : 1;
    const reach = m.diagonal ? 144 : 64;
    for (let x = -reach; x <= 24; x += 8) ridge(x * mirror, -9, 8.1, 9);
    for (let x = -24; x <= reach; x += 8) ridge(x * mirror, -56, 8.1, 9);
  } else {
    // Broad rocky interior prevents a diagonal shortcut through an L or U.
    for (let x = -30; x <= (m.shape === "L" ? 66 : 30); x += 12)
      for (let z = -105; z <= -21; z += 12) ridge(x, z, 12.1, 12.1);
  }
  // Biome dressing covers the full square; the playable corridor stays tank-wide.
  const attempts = m.biome === "jungle" ? 220 : m.biome === "ice" ? 150 : 100;
  for (let i = 0; i < attempts; i++) {
    const x = -m.bounds.x + 7 + rand() * (m.bounds.x * 2 - 14),
      z = m.bounds.minZ + 7 + rand() * (m.bounds.maxZ - m.bounds.minZ - 14);
    const tree = m.biome === "jungle" || m.biome === "ice";
    const b = tree
      ? {
          x,
          z,
          w: 0.85,
          d: 0.85,
          kind: m.biome === "ice" ? "snowTree" : "tree",
          hp: 65,
        }
      : m.biome === "city"
        ? { x, z, w: 5, d: 7, kind: "building" }
        : { x, z, w: 3 + rand() * 2, d: 3 + rand() * 2, kind: permanent };
    if (!onRoad(b) && clearLandmark(b) && !overlaps(b)) boxes.push(b);
  }
  for (let i = 0; i < 34; i++) {
    const p = sampleRoute(m.route, 0.04 + i * 0.025),
      side = i % 2 ? 1 : -1;
    const b = {
      x: p.x + p.nx * side * 7.5,
      z: p.z + p.nz * side * 7.5,
      w: 0.8,
      d: 0.8,
      kind: "fuel",
      hp: 25,
    };
    if (clearLandmark(b) && !onRoad(b) && !overlaps(b, 1.5)) boxes.push(b);
  }
  if (["ice", "sand", "mud"].includes(m.biome))
    for (let i = 0; i < 20; i++) {
      const p = sampleRoute(m.route, 0.05 + i * 0.042),
        side = (i % 3) - 1;
      const patch = {
        x: p.x + p.nx * side * 7,
        z: p.z + p.nz * side * 7,
        radius: m.biome === "ice" ? 7 : 3.5,
        kind: m.biome,
      };
      if (
        [...landmarks, ...bays].every(
          (l) => Math.hypot(l.x - patch.x, l.z - patch.z) > patch.radius + 4,
        )
      )
        patches.push(patch);
    }
  const soldiers = 24 + m.level * 4 + (m.biome === "city" ? 8 : 0);
  for (let i = 0; i < soldiers; i++) {
    const p = sampleRoute(m.route, 0.075 + (i / (soldiers - 1)) * 0.85);
    const side = i % 2 ? 1 : -1;
    let x = p.x + p.nx * side * 5,
      z = p.z + p.nz * side * 5;
    if (boxes.some((b) => segmentBox(x, z, x, z, b, 2.2) !== Infinity)) {
      x = p.x;
      z = p.z;
    }
    spawns.push([x, z]);
  }
  return { boxes, patches, spawns };
}
