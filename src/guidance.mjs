/**
 * Objective guidance: which goal comes next, and where a guide arrow should
 * point so it follows the mission roads instead of pointing through walls.
 */

/** Closest point on a polyline: metres along it and lateral offset. */
export function projectOnRoute(route, x, z) {
  let best = { along: 0, offset: Infinity },
    walked = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      len2 = dx * dx + dz * dz,
      len = Math.sqrt(len2);
    const t = len2
      ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2))
      : 0;
    const offset = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (offset < best.offset) best = { along: walked + len * t, offset };
    walked += len;
  }
  return best;
}

/** Point `along` metres from the start of a polyline (clamped to its ends). */
export function pointAlong(route, along) {
  let remaining = Math.max(0, along);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      len = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining <= len || i === route.length - 1) {
      const t = len ? Math.min(1, remaining / len) : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    remaining -= len;
  }
  return { x: route[0].x, z: route[0].z };
}

export const ROAD_SNAP = 12;
export const ROAD_LOOKAHEAD = 10;

/**
 * Where the arrow should point: a look-ahead point on the road the player is
 * travelling, toward the goal; straight at the goal when close or off-road.
 */
export function guidePoint(roads, from, goal, ahead = ROAD_LOOKAHEAD) {
  let best;
  for (const road of roads) {
    if (!road || road.length < 2) continue;
    const p = projectOnRoute(road, from.x, from.z),
      g = projectOnRoute(road, goal.x, goal.z);
    if (p.offset > ROAD_SNAP || g.offset > ROAD_SNAP) continue;
    if (!best || p.offset < best.p.offset) best = { road, p, g };
  }
  if (!best || Math.abs(best.g.along - best.p.along) <= ahead)
    return { x: goal.x, z: goal.z };
  const direction = Math.sign(best.g.along - best.p.along);
  return pointAlong(best.road, best.p.along + direction * ahead);
}

/**
 * The next goal in the mission loop: secure the relay, clear its guards (or the
 * finale bosses), then extract. Returns null while guards are still emerging.
 */
export function nextGoal({
  from,
  relaySecured,
  cleared,
  finale,
  relay,
  extract,
  hostiles,
}) {
  if (!relaySecured) return { x: relay.x, z: relay.z, kind: "relay" };
  if (!cleared) {
    let target,
      nearest = Infinity;
    for (const h of hostiles) {
      const d = Math.hypot(h.x - from.x, h.z - from.z);
      if (d < nearest) {
        nearest = d;
        target = h;
      }
    }
    return target
      ? { x: target.x, z: target.z, kind: finale ? "boss" : "guard" }
      : null;
  }
  return { x: extract.x, z: extract.z, kind: "extract" };
}
