/** Canonical northbound geometry is rotated together with every mission object. */
export function routePoint(level, x, z) {
  const angle =
    level === 1
      ? Math.PI / 2
      : level === 2
        ? Math.PI / 4
        : level === 3
          ? Math.PI
          : 0;
  return {
    x: x * Math.cos(angle) - (z + 43) * Math.sin(angle),
    z: -43 + x * Math.sin(angle) + (z + 43) * Math.cos(angle),
  };
}
export function routeBox(level, box) {
  const p = routePoint(level, box.x, box.z);
  const a =
    level === 1
      ? Math.PI / 2
      : level === 2
        ? Math.PI / 4
        : level === 3
          ? Math.PI
          : 0;
  return {
    ...box,
    ...p,
    originalW: box.w,
    originalD: box.d,
    w: box.w * Math.abs(Math.cos(a)) + box.d * Math.abs(Math.sin(a)),
    d: box.d * Math.abs(Math.cos(a)) + box.w * Math.abs(Math.sin(a)),
  };
}
export function missionRoute(level) {
  return [
    [0, 23],
    [0, 10],
    [10, -10],
    [-10, -30],
    [10, -50],
    [-10, -70],
    [0, -76],
    [0, -87],
    [0, -108],
  ].map(([x, z]) => routePoint(level, x, z));
}
export function routeLength(route) {
  return route
    .slice(1)
    .reduce(
      (sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.z - route[i].z),
      0,
    );
}
export function sampleRoute(route, fraction) {
  let remaining = Math.max(0, Math.min(1, fraction)) * routeLength(route);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz);
    if (remaining <= len || i === route.length - 1)
      return {
        x: a.x + (dx * remaining) / len,
        z: a.z + (dz * remaining) / len,
        nx: -dz / len,
        nz: dx / len,
      };
    remaining -= len;
  }
  throw new Error("A route needs at least two points");
}
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Distance to the whole road, including the adjacent arm of a hairpin. */
export function distanceToRoute(route, x, z) {
  return Math.min(
    ...route.slice(1).map((b, i) => {
      const a = route[i],
        dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
      );
      return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    }),
  );
}

/** Square expedition layouts. Coordinates are shared by terrain, loot and encounters. */
export function expeditionRoute(shape) {
  const paths = {
    S: [
      [-50, 14],
      [32, 14],
      [44, 8],
      [50, -4],
      [50, -14],
      [44, -25],
      [32, -32],
      [-32, -32],
      [-44, -39],
      [-50, -50],
      [-50, -60],
      [-44, -72],
      [-32, -80],
      [50, -80],
      [50, -96],
    ],
    O: [
      [0, 14],
      [-34, 14],
      [-46, 5],
      [-50, -8],
      [-50, -70],
      [-46, -85],
      [-34, -96],
      [0, -96],
      [0, -108],
    ],
    U: [
      [-50, -96],
      [-50, -8],
      [-46, 5],
      [-34, 14],
      [34, 14],
      [46, 5],
      [50, -8],
      [50, -96],
    ],
  };
  const diagonal = shape.endsWith(" 45°"),
    base = shape.replace(" 45°", "");
  const path = paths[base === "MIRRORED S" ? "S" : base];
  return path.map(([x, z]) => {
    const mirroredX = base === "MIRRORED S" ? -x : x;
    return diagonal ? routePoint(2, mirroredX, z) : { x: mirroredX, z };
  });
}
export function routePlan(stage, level) {
  if (stage === 0 && level === 0) {
    const route = [
      [0, 18],
      [0, 8],
      [7, 0],
      [-7, -13],
      [0, -23],
      [0, -30],
      [0, -37],
    ].map(([x, z]) => ({ x, z }));
    return {
      shape: "ZIGZAG",
      diagonal: false,
      square: false,
      layout: 0,
      route,
      roads: [route],
      bounds: { x: 22, minZ: -44, maxZ: 25 },
      direction: "NORTHBOUND",
      start: route[0],
      extract: route.at(-1),
      objective: { x: 0, z: -25 },
      bossPos: { x: 0, z: -32 },
    };
  }
  const diagonal = level === 2 && stage % 4 >= 2;
  const baseShape =
    level === 0
      ? "ZIGZAG"
      : level === 1
        ? stage % 2
          ? "U"
          : "O"
        : stage % 2
          ? "MIRRORED S"
          : "S";
  const shape = baseShape + (diagonal ? " 45°" : "");
  const square = shape !== "ZIGZAG";
  const layout = square ? 0 : stage === 5 ? 3 : 0;
  const route = square ? expeditionRoute(shape) : missionRoute(layout);
  const roads =
    shape === "O"
      ? [route, route.map((p) => ({ x: -p.x || 0, z: p.z }))]
      : [route];
  const bounds = diagonal
    ? { x: 98, minZ: -141, maxZ: 55 }
    : square
      ? { x: 68, minZ: -111, maxZ: 25 }
      : { x: 28.5, minZ: -115, maxZ: 28.5 };
  return {
    shape,
    diagonal,
    square,
    layout,
    route,
    roads,
    bounds,
    direction: square ? shape : layout === 3 ? "SOUTHBOUND" : "NORTHBOUND",
    start: route[0],
    extract: route.at(-1),
    objective:
      shape === "O"
        ? { x: 0, z: -96 }
        : square
          ? sampleRoute(route, 0.78)
          : routePoint(layout, 0, -76),
    bossPos: square ? sampleRoute(route, 0.9) : routePoint(layout, 0, -94),
  };
}
/** Keep every reinforcement on the final road arm, independent of compass direction. */
export function routeFormation(route, fraction, count, width = 5, spacing = 7) {
  const length = routeLength(route);
  return Array.from({ length: count }, (_, i) => {
    const p = sampleRoute(
      route,
      Math.min(0.96, fraction + (Math.floor(i / 2) * spacing) / length),
    );
    const side = count === 1 ? 0 : i % 2 ? width : -width;
    return { x: p.x + p.nx * side, z: p.z + p.nz * side };
  });
}

/** All O branches join before the relay fight; either approach completes the mission. */
export function relayFormation(mission, count) {
  return mission.shape === "O"
    ? routeFormation(
        [
          { x: 0, z: -80 },
          { x: 0, z: -110 },
        ],
        0.5,
        count,
        3.5,
        3,
      )
    : routeFormation(mission.route, 0.82, count, 3.5, 3);
}
export function vehicleAnchors(roads) {
  return [0.13, 0.4, 0.67].map((fraction, i) => ({
    fraction,
    branch: i % roads.length,
    route: roads[i % roads.length],
  }));
}
export function distanceToRoads(roads, x, z) {
  return Math.min(...roads.map((route) => distanceToRoute(route, x, z)));
}
