/** Physical map limits and shared environmental combat rules. */
export function perimeterWalls(bounds) {
  const t = 1.2,
    length = bounds.maxZ - bounds.minZ,
    z = (bounds.maxZ + bounds.minZ) / 2;
  return [
    { x: -bounds.x - t / 2, z, w: t, d: length + 2 * t, kind: "boundary" },
    { x: bounds.x + t / 2, z, w: t, d: length + 2 * t, kind: "boundary" },
    { x: 0, z: bounds.minZ - t / 2, w: bounds.x * 2, d: t, kind: "boundary" },
    { x: 0, z: bounds.maxZ + t / 2, w: bounds.x * 2, d: t, kind: "boundary" },
  ];
}
export function finishEnvironment(boxes, bounds) {
  // Keep established safe depot footprints; mix marked explosives with fuel drums.
  let depot = 0;
  for (const box of boxes)
    if (box.kind === "fuel" && depot++ % 3 === 2) {
      box.kind = "explosive";
      box.hp = 25;
    }
  boxes.push(...perimeterWalls(bounds));
}
export const ENV_BLAST = {
  radius: 5.5,
  enemy: 180,
  player: 55,
  vehicle: 100,
  prop: 240,
};
export function blastDamage(distance, radius, maximum, targetRadius = 0) {
  const reach = radius + targetRadius;
  return distance >= reach ? 0 : maximum * Math.max(0.25, 1 - distance / reach);
}
export function isSmallTree(box) {
  return (
    (box.kind === "tree" || box.kind === "snowTree") && (box.scale ?? 1) <= 0.7
  );
}
export class InteractionHint {
  key = null;
  until = 0;
  update(key, now) {
    if (key !== this.key) {
      this.key = key;
      this.until = now + 1000;
    }
    return key !== null && now < this.until;
  }
  reset() {
    this.key = null;
    this.until = 0;
  }
}
