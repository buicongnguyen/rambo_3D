import { SpatialGrid } from "./combat.mjs";
import { LEVEL_COUNT } from "./campaign.mjs";
/** Earliest segment intersection t in [0,1], or Infinity. Expanded boxes support projectile radii. */
export function segmentBox(ax, az, bx, bz, box, pad = 0) {
  // Two scalar slab tests; this is the innermost collision primitive, so it
  // must not allocate.
  let lo = 0,
    hi = 1;
  const minX = box.x - box.w / 2 - pad,
    maxX = box.x + box.w / 2 + pad,
    minZ = box.z - box.d / 2 - pad,
    maxZ = box.z + box.d / 2 + pad;
  const vx = bx - ax;
  if (Math.abs(vx) < 1e-9) {
    if (ax < minX || ax > maxX) return Infinity;
  } else {
    let t0 = (minX - ax) / vx,
      t1 = (maxX - ax) / vx;
    if (t0 > t1) {
      const t = t0;
      t0 = t1;
      t1 = t;
    }
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (lo > hi) return Infinity;
  }
  const vz = bz - az;
  if (Math.abs(vz) < 1e-9) {
    if (az < minZ || az > maxZ) return Infinity;
  } else {
    let t0 = (minZ - az) / vz,
      t1 = (maxZ - az) / vz;
    if (t0 > t1) {
      const t = t0;
      t0 = t1;
      t1 = t;
    }
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (lo > hi) return Infinity;
  }
  return lo;
}
export function segmentCircle(ax, az, bx, bz, x, z, r) {
  const dx = bx - ax,
    dz = bz - az,
    fx = ax - x,
    fz = az - z,
    c = fx * fx + fz * fz - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return Infinity;
  const b = 2 * (fx * dx + fz * dz),
    disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}
/** @param {number | {x:number,minZ:number,maxZ:number}} bound */
export function moveCircle(x, z, dx, dz, r, boxes, bound = 29) {
  const limits =
    typeof bound === "number" ? { x: bound, minZ: -bound, maxZ: bound } : bound;
  const blocked = (px, pz) =>
    boxes.some((b) => {
      const qx = Math.max(b.x - b.w / 2, Math.min(px, b.x + b.w / 2)),
        qz = Math.max(b.z - b.d / 2, Math.min(pz, b.z + b.d / 2));
      return (px - qx) ** 2 + (pz - qz) ** 2 < r * r;
    });
  // Substep movement so dash cannot cross thin obstacles.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.65)));
  for (let i = 0; i < steps; i++) {
    const nx = Math.max(-limits.x + r, Math.min(limits.x - r, x + dx / steps));
    if (!blocked(nx, z)) x = nx;
    const nz = Math.max(
      limits.minZ + r,
      Math.min(limits.maxZ - r, z + dz / steps),
    );
    if (!blocked(x, nz)) z = nz;
  }
  return { x, z };
}
export function freshSave() {
  return {
    version: 2,
    mission: 0,
    armor: 0,
    power: 0,
    mobility: 0,
    best: 0,
    completed: false,
    credits: 0,
    squad: 0,
    fieldKit: 0,
    stars: [],
    loadout: [],
  };
}
export const SUPPLY_IDS = [
  "shotgun",
  "machineGun",
  "launcher",
  "missile",
  "laser",
];
export function validateSave(raw) {
  const fallback = freshSave();
  if (raw?.version === 1)
    return {
      ...fallback,
      best:
        Number.isSafeInteger(raw.best) && raw.best >= 0 && raw.best <= 100000000
          ? raw.best
          : 0,
    };
  if (!raw || raw.version !== 2) return fallback;
  for (const k of ["mission", "armor", "power", "mobility", "best"])
    if (!Number.isSafeInteger(raw[k]) || raw[k] < 0) return fallback;
  if (
    raw.mission >= LEVEL_COUNT ||
    (raw.completed && raw.mission !== LEVEL_COUNT - 1) ||
    raw.armor + raw.power + raw.mobility > raw.mission ||
    raw.best > 100000000 ||
    typeof raw.completed !== "boolean"
  )
    return fallback;
  for (const [k, limit] of [
    ["credits", 1000000],
    ["squad", 3],
    ["fieldKit", 3],
  ])
    if (
      raw[k] !== undefined &&
      (!Number.isSafeInteger(raw[k]) || raw[k] < 0 || raw[k] > limit)
    )
      return fallback;
  return {
    version: 2,
    credits: raw.credits ?? 0,
    squad: raw.squad ?? 0,
    fieldKit: raw.fieldKit ?? 0,
    // Optional fields are sanitised rather than rejecting an otherwise good save.
    stars: Array.isArray(raw.stars)
      ? raw.stars
          .slice(0, LEVEL_COUNT)
          .map((n) =>
            Number.isSafeInteger(n) ? Math.min(3, Math.max(0, n)) : 0,
          )
      : [],
    loadout: Array.isArray(raw.loadout)
      ? [...new Set(raw.loadout.filter((id) => SUPPLY_IDS.includes(id)))]
      : [],
    mission: raw.mission,
    armor: raw.armor,
    power: raw.power,
    mobility: raw.mobility,
    best: raw.best,
    completed: raw.completed,
  };
}
export function advanceCampaign(save, upgrade, score, rewards = {}) {
  const next = validateSave(save);
  if (next.completed) return next;
  next.best = Math.max(
    next.best,
    Number.isFinite(score)
      ? Math.min(100000000, Math.floor(Math.max(0, score)))
      : 0,
  );
  const credits =
    Number.isSafeInteger(rewards.credits) && rewards.credits >= 0
      ? Math.min(rewards.credits, 10000)
      : 0;
  const squad =
    Number.isSafeInteger(rewards.squad) && rewards.squad >= 0
      ? Math.min(3, rewards.squad)
      : next.squad;
  next.credits = Math.min(1000000, next.credits + credits);
  next.squad = squad;
  if (next.mission === LEVEL_COUNT - 1) {
    next.completed = true;
    return next;
  }
  if (!["armor", "power", "mobility"].includes(upgrade))
    throw new Error("Choose a valid upgrade");
  next[upgrade]++;
  next.mission++;
  return next;
}
/** Clearance-aware A* with visible start connections and smoothed waypoints. */
/** @param {number | {x:number,minZ:number,maxZ:number}} bound */
export function routeStep(x, z, tx, tz, boxes, r = 0.45, bound = 29) {
  const limits =
    typeof bound === "number" ? { x: bound, minZ: -bound, maxZ: bound } : bound;
  const grid = new SpatialGrid(6);
  for (const box of boxes) grid.insert(box, box.x, box.z, box.w, box.d);
  const clear = (ax, az, bx, bz) =>
    !grid.segment(ax, az, bx, bz, r).some((b) => {
      // Broad-phase rejection avoids repeated intersection math for distant cover.
      if (
        b.x + b.w / 2 + r < Math.min(ax, bx) ||
        b.x - b.w / 2 - r > Math.max(ax, bx) ||
        b.z + b.d / 2 + r < Math.min(az, bz) ||
        b.z - b.d / 2 - r > Math.max(az, bz)
      )
        return false;
      // Match moveCircle's rounded corners, including starts already touching cover.
      const pad = r - 0.000001;
      if (
        segmentBox(ax, az, bx, bz, { ...b, w: b.w + 2 * pad }) !== Infinity ||
        segmentBox(ax, az, bx, bz, { ...b, d: b.d + 2 * pad }) !== Infinity
      )
        return true;
      return [-1, 1].some((sx) =>
        [-1, 1].some(
          (sz) =>
            segmentCircle(
              ax,
              az,
              bx,
              bz,
              b.x + (sx * b.w) / 2,
              b.z + (sz * b.d) / 2,
              pad,
            ) !== Infinity,
        ),
      );
    });
  if (clear(x, z, tx, tz)) return { x: tx, z: tz };
  const valid = (px, pz) =>
    Math.abs(px) <= limits.x - r &&
    pz >= limits.minZ + r &&
    pz <= limits.maxZ - r &&
    clear(px, pz, px, pz);
  const key = (a, b) => a + "," + b;
  const open = [],
    best = new Map();
  const enqueue = (node) => {
    let i = open.length;
    open.push(node);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (open[parent].f <= node.f) break;
      open[i] = open[parent];
      i = parent;
    }
    open[i] = node;
  };
  const dequeue = () => {
    const first = open[0],
      last = open.pop();
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let child = i * 2 + 1;
        if (child + 1 < open.length && open[child + 1].f < open[child].f)
          child++;
        if (open[child].f >= last.f) break;
        open[i] = open[child];
        i = child;
      }
      open[i] = last;
    }
    return first;
  };
  // Rounding the start into cover used to create unreachable first waypoints.
  for (let a = Math.floor(x) - 1; a <= Math.ceil(x) + 1; a++)
    for (let b = Math.floor(z) - 1; b <= Math.ceil(z) + 1; b++) {
      if (!valid(a, b) || !clear(x, z, a, b)) continue;
      const g = Math.hypot(a - x, b - z);
      enqueue({
        x: a,
        z: b,
        g,
        f: g + Math.hypot(a - tx, b - tz),
        parent: null,
      });
      best.set(key(a, b), g);
    }
  let found = null;
  for (let i = 0; i < 4000 && open.length; i++) {
    const n = dequeue();
    if (n.g !== best.get(key(n.x, n.z))) continue;
    if (
      Math.hypot(n.x - tx, n.z - tz) < 1.5 &&
      !boxes.some((b) => segmentBox(n.x, n.z, tx, tz, b) !== Infinity)
    ) {
      found = n;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = n.x + dx,
        nz = n.z + dz,
        k = key(nx, nz),
        g = n.g + Math.hypot(dx, dz);
      if (
        !valid(nx, nz) ||
        !clear(n.x, n.z, nx, nz) ||
        g >= (best.get(k) ?? Infinity)
      )
        continue;
      best.set(k, g);
      enqueue({
        x: nx,
        z: nz,
        g,
        f: g + Math.hypot(nx - tx, nz - tz),
        parent: n,
      });
    }
  }
  if (!found) return { x, z };
  // Choose the furthest reachable waypoint to avoid grid-node oscillation.
  while (found && !clear(x, z, found.x, found.z)) found = found.parent;
  return found ? { x: found.x, z: found.z } : { x, z };
}
