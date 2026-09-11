/** Earliest segment intersection t in [0,1], or Infinity. Expanded boxes support projectile radii. */
export function segmentBox(ax, az, bx, bz, box, pad = 0) {
  let lo = 0,
    hi = 1;
  for (const [a, b, min, max] of [
    [ax, bx, box.x - box.w / 2 - pad, box.x + box.w / 2 + pad],
    [az, bz, box.z - box.d / 2 - pad, box.z + box.d / 2 + pad],
  ]) {
    const v = b - a;
    if (Math.abs(v) < 1e-9) {
      if (a < min || a > max) return Infinity;
      continue;
    }
    let t0 = (min - a) / v,
      t1 = (max - a) / v;
    if (t0 > t1) [t0, t1] = [t1, t0];
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
export function moveCircle(x, z, dx, dz, r, boxes, bound = 29) {
  const blocked = (px, pz) =>
    boxes.some((b) => {
      const qx = Math.max(b.x - b.w / 2, Math.min(px, b.x + b.w / 2)),
        qz = Math.max(b.z - b.d / 2, Math.min(pz, b.z + b.d / 2));
      return (px - qx) ** 2 + (pz - qz) ** 2 < r * r;
    });
  // Substep movement so dash cannot cross thin obstacles.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.65)));
  for (let i = 0; i < steps; i++) {
    const nx = Math.max(-bound + r, Math.min(bound - r, x + dx / steps));
    if (!blocked(nx, z)) x = nx;
    const nz = Math.max(-bound + r, Math.min(bound - r, z + dz / steps));
    if (!blocked(x, nz)) z = nz;
  }
  return { x, z };
}
export function freshSave() {
  return {
    version: 1,
    mission: 0,
    armor: 0,
    power: 0,
    mobility: 0,
    best: 0,
    completed: false,
  };
}
export function validateSave(raw) {
  const fallback = freshSave();
  if (!raw || raw.version !== 1) return fallback;
  for (const k of ["mission", "armor", "power", "mobility", "best"])
    if (!Number.isSafeInteger(raw[k]) || raw[k] < 0) return fallback;
  if (
    raw.mission > 2 ||
    (raw.completed && raw.mission !== 2) ||
    raw.armor + raw.power + raw.mobility > raw.mission ||
    raw.best > 100000000 ||
    typeof raw.completed !== "boolean"
  )
    return fallback;
  return {
    version: 1,
    mission: raw.mission,
    armor: raw.armor,
    power: raw.power,
    mobility: raw.mobility,
    best: raw.best,
    completed: raw.completed,
  };
}
export function advanceCampaign(save, upgrade, score) {
  const next = validateSave(save);
  next.best = Math.max(next.best, Math.floor(Math.max(0, score)));
  if (next.mission === 2) {
    next.completed = true;
    return next;
  }
  if (!["armor", "power", "mobility"].includes(upgrade))
    throw new Error("Choose a valid upgrade");
  next[upgrade]++;
  next.mission++;
  return next;
}
/** Grid A* steering for followers. */
export function routeStep(x, z, tx, tz, boxes, r = 0.45) {
  const blocked = (px, pz) =>
    Math.abs(px) > 28 ||
    Math.abs(pz) > 28 ||
    boxes.some(
      (b) =>
        px > b.x - b.w / 2 - r &&
        px < b.x + b.w / 2 + r &&
        pz > b.z - b.d / 2 - r &&
        pz < b.z + b.d / 2 + r,
    );
  if (!boxes.some((b) => segmentBox(x, z, tx, tz, b, r) < 1))
    return { x: tx, z: tz };
  const sx = Math.round(x),
    sz = Math.round(z),
    gx = Math.round(tx),
    gz = Math.round(tz),
    key = (a, b) => `${a},${b}`;
  const open = [{ x: sx, z: sz, g: 0, f: 0, parent: null }],
    best = new Map([[key(sx, sz), 0]]);
  let found = null;
  for (let i = 0; i < 2200 && open.length; i++) {
    open.sort((a, b) => a.f - b.f);
    const n = open.shift();
    if (Math.hypot(n.x - gx, n.z - gz) < 1.5) {
      found = n;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = n.x + dx,
        nz = n.z + dz,
        k = key(nx, nz),
        cost = n.g + 1;
      if (blocked(nx, nz) || cost >= (best.get(k) ?? Infinity)) continue;
      best.set(k, cost);
      open.push({
        x: nx,
        z: nz,
        g: cost,
        f: cost + Math.abs(nx - gx) + Math.abs(nz - gz),
        parent: n,
      });
    }
  }
  if (!found) return { x, z };
  while (found.parent?.parent) found = found.parent;
  return { x: found.x, z: found.z };
}
