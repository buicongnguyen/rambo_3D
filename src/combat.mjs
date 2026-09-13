/** Small broad-phase grid shared by projectile queries and local crowd spacing. */
export class SpatialGrid {
  constructor(size = 8) {
    this.size = size;
    this.cells = new Map();
  }
  clear() {
    this.cells.clear();
  }
  insert(item, x, z, w = 0, d = w) {
    const s = this.size;
    for (
      let ix = Math.floor((x - w / 2) / s);
      ix <= Math.floor((x + w / 2) / s);
      ix++
    )
      for (
        let iz = Math.floor((z - d / 2) / s);
        iz <= Math.floor((z + d / 2) / s);
        iz++
      ) {
        const key = ix + "," + iz;
        const cell = this.cells.get(key) ?? [];
        cell.push(item);
        this.cells.set(key, cell);
      }
  }
  rect(minX, minZ, maxX, maxZ) {
    const found = new Set(),
      s = this.size;
    for (let x = Math.floor(minX / s); x <= Math.floor(maxX / s); x++)
      for (let z = Math.floor(minZ / s); z <= Math.floor(maxZ / s); z++)
        for (const item of this.cells.get(x + "," + z) ?? []) found.add(item);
    return [...found];
  }
  near(x, z, r) {
    return this.rect(x - r, z - r, x + r, z + r);
  }
  segment(ax, az, bx, bz, pad = 0) {
    return this.rect(
      Math.min(ax, bx) - pad,
      Math.min(az, bz) - pad,
      Math.max(ax, bx) + pad,
      Math.max(az, bz) + pad,
    );
  }
}

export const PATROL_DENSITY = 4;
export function turboStats(power, mobility, mounted = false) {
  return {
    duration: Math.min(5, 3 + power * 0.4),
    cooldown: Math.max(8, 14 - mobility * 0.75),
    guns: mounted && power >= 3 ? 3 : 2,
    unlocked: !mounted || power >= 1,
  };
}
export function knockbackDistance(damage, priority = 0, splash = 0) {
  return Math.min(6.5, 0.8 + damage * 0.012 + priority * 0.016 + splash * 0.4);
}
/** Replace broad barriers with small trunks, leaving the original roads/clearings intact. */
export function softenObstacles(boxes, biome) {
  return boxes.flatMap((b) => {
    if (!["hill", "basalt", "concrete", "cover"].includes(b.kind)) return [b];
    const nx = Math.max(1, Math.ceil(b.w / 3.2)),
      nz = Math.max(1, Math.ceil(b.d / 3.2));
    const trees = [];
    for (let x = 0; x < nx; x++)
      for (let z = 0; z < nz; z++)
        trees.push({
          x: b.x + ((x + 0.5) / nx - 0.5) * b.w,
          z: b.z + ((z + 0.5) / nz - 0.5) * b.d,
          w: 0.65,
          d: 0.65,
          kind: biome === "ice" ? "snowTree" : "tree",
          hp: 180,
          scale: 0.65,
        });
    return trees;
  });
}
