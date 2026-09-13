import { segmentBox, segmentCircle } from "./rules.mjs";
import { ENV_BLAST } from "./environment.mjs";

export const ENEMY_TANK = {
  shell: 36,
  gun: 8,
  interval: 2.7,
  gunInterval: 0.95,
  warning: 0.8,
};
export const isExplosive = (box) => ["fuel", "explosive"].includes(box.kind);
const blastSolid = (box) =>
  !["tree", "snowTree", "fuel", "explosive"].includes(box.kind);
/** Small arms suppress infantry; rockets, grenades and laser retain their anti-armor role. */
export function armorMultiplier(actor, spec) {
  if (
    !spec ||
    !(actor.armored || ["laserTank", "missileTruck"].includes(actor.bossKind))
  )
    return 1;
  if (spec.visual === "tracer") return 0.2;
  if (spec.visual === "sniper") return 0.7;
  if (spec.visual === "flame") return 0.15;
  if (spec.visual === "gas") return 0.1;
  return 1;
}
/** Preserve Easy's recovery; extra difficulty density must not multiply medical supply. */
export function healthDropEvery(difficulty) {
  return { easy: 2, normal: 6, hard: 12, crazy: 24 }[difficulty] ?? 6;
}
/** Reassign existing infantry, never add enemies or move objective/cache defenders. */
export function depotGuardPositions(
  actors,
  boxes,
  bounds,
  start,
  vehicles = [],
) {
  const placements = [],
    used = new Set(),
    depots = [];
  const occupied = actors.map((a) => ({ ...a }));
  for (const depot of boxes.filter(isExplosive)) {
    if (depots.length >= 3) break;
    if (
      Math.hypot(depot.x - start.x, depot.z - start.z) < 20 ||
      depots.some((d) => Math.hypot(d.x - depot.x, d.z - depot.z) < 18)
    )
      continue;
    let count = 0;
    for (let i = 0; i < 24 && count < 4; i++) {
      const angle = (i * Math.PI) / 6,
        r = i < 12 ? 2.1 : 2.9;
      const x = depot.x + Math.cos(angle) * r,
        z = depot.z + Math.sin(angle) * r;
      if (
        Math.abs(x) > bounds.x - 1 ||
        z < bounds.minZ + 1 ||
        z > bounds.maxZ - 1 ||
        boxes.some((b) => segmentBox(x, z, x, z, b, 0.65) !== Infinity) ||
        boxes.some(
          (b) =>
            b !== depot && segmentBox(depot.x, depot.z, x, z, b) !== Infinity,
        ) ||
        vehicles.some((v) => Math.hypot(x - v.x, z - v.z) < v.radius + 0.8)
      )
        continue;
      const index = occupied
        .map((a, index) => ({ a, index }))
        .filter(
          ({ a, index }) =>
            !used.has(index) &&
            a.hp > 0 &&
            !a.armored &&
            !a.boss &&
            !a.guard &&
            !a.cacheGuard,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.a.x - x, a.a.z - z) - Math.hypot(b.a.x - x, b.a.z - z),
        )[0]?.index;
      if (index === undefined) break;
      if (
        occupied.some(
          (a, j) =>
            j !== index &&
            a.hp > 0 &&
            Math.hypot(a.x - x, a.z - z) < (a.radius ?? 0.55) + 0.7,
        )
      )
        continue;
      occupied[index].x = x;
      occupied[index].z = z;
      placements.push({ index, x, z, depot });
      used.add(index);
      count++;
    }
    if (count) depots.push(depot);
  }
  return placements;
}
/** Explicit BLAST aim refuses unsafe chain reactions, blocked shots and out-of-range stores. */
export function explosiveTarget(
  player,
  enemies,
  boxes,
  range,
  playerRadius = 0.5,
  visible = (box) => true,
) {
  const stores = boxes.filter(isExplosive),
    solid = boxes.filter(blastSolid);
  const clearBlast = (a, b) =>
    !solid.some((box) => segmentBox(a.x, a.z, b.x, b.z, box) !== Infinity);
  let best,
    bestScore = -Infinity;
  for (const store of stores) {
    if (!visible(store)) continue;
    const distance = Math.hypot(store.x - player.x, store.z - player.z);
    if (
      distance > range ||
      boxes.some(
        (b) =>
          b !== store &&
          segmentBox(player.x, player.z, store.x, store.z, b) !== Infinity,
      )
    )
      continue;
    if (
      enemies.some(
        (e) =>
          e.hp > 0 &&
          segmentCircle(
            player.x,
            player.z,
            store.x,
            store.z,
            e.x,
            e.z,
            e.radius,
          ) < 1,
      )
    )
      continue;
    const chain = [store],
      seen = new Set(chain);
    for (let i = 0; i < chain.length; i++)
      for (const next of stores)
        if (
          !seen.has(next) &&
          Math.hypot(next.x - chain[i].x, next.z - chain[i].z) <
            ENV_BLAST.radius &&
          clearBlast(chain[i], next)
        ) {
          seen.add(next);
          chain.push(next);
        }
    if (
      chain.some(
        (b) =>
          Math.hypot(b.x - player.x, b.z - player.z) <
            ENV_BLAST.radius + playerRadius + 2 && clearBlast(b, player),
      )
    )
      continue;
    const victims = enemies.filter(
      (e) =>
        e.hp > 0 &&
        chain.some(
          (b) =>
            Math.hypot(e.x - b.x, e.z - b.z) < ENV_BLAST.radius + e.radius &&
            clearBlast(b, e),
        ),
    ).length;
    const score = victims * 100 - distance;
    if (score > bestScore) {
      best = store;
      bestScore = score;
    }
  }
  return best;
}
