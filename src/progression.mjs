import { sampleRoute, vehicleAnchors } from "./routes.mjs";
import { segmentBox } from "./rules.mjs";

// Campaign gear is earned in the first biome; later stage selection remains self-contained.
export function missionPacing(stage, level) {
  if (stage === 0 && level === 0)
    return {
      density: 1,
      tanks: 0,
      guards: 2,
      vehicles: [],
      weapons: [9],
      supplies: ["weapon", "health", "shield", "health"],
    };
  if (stage === 0 && level === 1)
    return {
      density: 2,
      tanks: 1,
      guards: 3,
      vehicles: ["motorcycle", "jeep"],
      weapons: [1, 2, 5, 9],
      supplies: [
        "weapon",
        "health",
        "weapon",
        "shield",
        "weapon",
        "health",
        "weapon",
        "shield",
      ],
    };
  return {
    density: stage === 0 ? 2 : 4,
    tanks: stage === 0 ? 2 : null,
    guards: 3,
    vehicles: ["motorcycle", "jeep", "tank"],
    weapons: [2, 3, 4, 5, 6, 7, 8, 1, 10],
    supplies: null,
  };
}
export function openingLayout() {
  return {
    boxes: [
      { x: -7, z: 10, w: 5, d: 2, kind: "screen", height: 2.4 },
      { x: 10, z: 6, w: 5, d: 2, kind: "screen", height: 1.3 },
      { x: -8, z: 0, w: 4, d: 3, kind: "screen", height: 2.4 },
      { x: 9, z: -14, w: 5, d: 2, kind: "screen", height: 1.3 },
      { x: -12, z: -24, w: 4, d: 2, kind: "screen", height: 2.4 },
      ...[
        [-16, 3],
        [16, -7],
        [-16, -16],
        [14, -30],
      ].map(([x, z]) => ({
        x,
        z,
        w: 0.65,
        d: 0.65,
        kind: "snowTree",
        hp: 180,
        scale: 0.65,
      })),
      ...[
        [14, 1],
        [-13, -10],
        [10, -24],
      ].map(([x, z]) => ({ x, z, w: 0.8, d: 0.8, kind: "fuel", hp: 25 })),
    ],
    patches: [
      { x: 5, z: -8, radius: 3, kind: "ice" },
      { x: -13, z: -31, radius: 3, kind: "ice" },
    ],
    spawns: [
      [-8, 6],
      [-11, 4],
      [12, -4],
      [14, -5],
      [-12, -8],
      [-13, -13],
      [-5, -20],
      [5, -25],
      [7, -25],
      [9, -26],
      [-5, -32],
      [5, -33],
    ],
  };
}
/** Shoulder screens provide alternate approaches while preserving all tank-width roads and bays. */
export function tacticalCover(m, boxes) {
  const bays = vehicleAnchors(m.roads).flatMap(({ route, fraction }) =>
    [-0.07, 0, 0.07].flatMap((df) => {
      const a = sampleRoute(route, fraction + df);
      return [-8, 8].map((o) => ({ a, x: a.x + a.nx * o, z: a.z + a.nz * o }));
    }),
  );
  for (let i = 0; i < 12; i++) {
    const p = sampleRoute(m.roads[i % m.roads.length], 0.12 + i * 0.065),
      side = i % 2 ? 1 : -1;
    const b = {
      x: p.x + p.nx * side * 9,
      z: p.z + p.nz * side * 9,
      w: 5,
      d: 2,
      kind: "screen",
      height: i % 3 ? 2.4 : 1.3,
    };
    if (
      Math.abs(b.x) > m.bounds.x - 4 ||
      b.z < m.bounds.minZ + 4 ||
      b.z > m.bounds.maxZ - 4
    )
      continue;
    if (
      [m.start, m.objective, m.extract, ...bays].some(
        (a) => Math.hypot(a.x - b.x, a.z - b.z) < 9,
      )
    )
      continue;
    if (bays.some((p) => segmentBox(p.a.x, p.a.z, p.x, p.z, b, 3) !== Infinity))
      continue;
    if (
      m.roads.some((r) =>
        r
          .slice(1)
          .some(
            (p, i) => segmentBox(r[i].x, r[i].z, p.x, p.z, b, 3.8) !== Infinity,
          ),
      )
    )
      continue;
    if (
      boxes.some(
        (a) =>
          Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 1.5 &&
          Math.abs(a.z - b.z) < (a.d + b.d) / 2 + 1.5,
      )
    )
      continue;
    boxes.push(b);
  }
}

// Independent chance per defeat, including bosses. A package contains one reward, not three.
export function enemyLoot(chance = Math.random(), reward = Math.random()) {
  if (chance >= 1 / 3) return null;
  return reward < 1 / 3 ? "health" : reward < 2 / 3 ? "shield" : "ammo";
}
export function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
export function turnToward(a, b, step) {
  return a + Math.max(-step, Math.min(step, angleDelta(a, b)));
}
export function seesPlayer(actor, player, cover, heading) {
  const distance = Math.hypot(player.x - actor.x, player.z - actor.z);
  if (distance > (actor.alerted ? 42 : actor.armored ? 30 : 24)) return false;
  const angle = Math.atan2(player.x - actor.x, player.z - actor.z);
  if (
    distance > 2.5 &&
    Math.abs(angleDelta(heading, angle)) >
      (actor.alerted ? Math.PI * 0.4 : Math.PI / 3)
  )
    return false;
  return !cover.some(
    (b) =>
      segmentBox(actor.x, actor.z, player.x, player.z, b, 0.06) !== Infinity,
  );
}
export function rearHit(actor, spec, direction, heading) {
  if (
    !spec ||
    spec.splash > 0 ||
    !["tracer", "sniper", "laser"].includes(spec.visual) ||
    !direction ||
    actor.boss
  )
    return false;
  const d = Math.hypot(direction.x, direction.z);
  return (
    d > 0 &&
    (Math.sin(heading) * direction.x + Math.cos(heading) * direction.z) / d >
      Math.cos(Math.PI / 3)
  );
}
export function grenadeHeight(age, life, origin = 0.95) {
  const t = Math.max(0, Math.min(1, age / life));
  return origin * (1 - t) + 4 * 3.2 * t * (1 - t);
}
export function coverHeight(box) {
  return (
    box.height ??
    (["building", "tree", "snowTree"].includes(box.kind)
      ? 6
      : box.kind === "boundary"
        ? 1.4
        : 1.8)
  );
}

/** One finite weapon per package; ordinary rifle/shotgun reserves stay unlimited. */
export function ammoReward(inventory, reserves, weapons, selected, difficulty) {
  const eligible = inventory.filter(
    (i) => Number.isFinite(reserves[i]) && reserves[i] < weapons[i].mag * 4,
  );
  if (!eligible.length) return null;
  const index = eligible.includes(selected)
    ? selected
    : eligible.reduce((a, b) =>
        reserves[a] / weapons[a].mag <= reserves[b] / weapons[b].mag ? a : b,
      );
  const fraction =
    difficulty === "crazy" ? 0.1 : difficulty === "hard" ? 0.2 : 1;
  const amount = Math.min(
    weapons[index].mag * 4 - reserves[index],
    Math.max(1, Math.ceil(weapons[index].mag * fraction)),
  );
  return { index, amount };
}
