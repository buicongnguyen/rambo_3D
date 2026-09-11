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
