/** Roles replace existing patrol slots; difficulty never silently adds extra bodies. */
export const INFANTRY = {
  rifleman: {
    hp: 65,
    speed: 1.9,
    reach: 11,
    warning: 0.6,
    recovery: 1.6,
    damage: 6,
    arc: 0.22,
    melee: false,
  },
  rusher: {
    hp: 42,
    speed: 4.8,
    reach: 1.25,
    warning: 0.5,
    recovery: 1.2,
    damage: 10,
    arc: 0.6,
    melee: true,
  },
  swordsman: {
    hp: 90,
    speed: 2.8,
    reach: 2.1,
    warning: 0.85,
    recovery: 2,
    damage: 18,
    arc: 1.05,
    melee: true,
  },
  thrower: {
    hp: 56,
    speed: 2.6,
    reach: 15,
    warning: 0.75,
    recovery: 2.5,
    damage: 10,
    arc: 0.22,
    melee: false,
  },
  rocketeer: {
    hp: 75,
    speed: 1.5,
    reach: 22,
    warning: 1.1,
    recovery: 4.5,
    damage: 24,
    arc: 0.22,
    melee: false,
  },
};
const roster = [
  "rifleman",
  "rifleman",
  "rusher",
  "rifleman",
  "thrower",
  "rifleman",
  "rusher",
  "swordsman",
  "rifleman",
  "rocketeer",
  "rifleman",
  "rusher",
  "rifleman",
  "thrower",
  "rifleman",
  "swordsman",
  "rifleman",
  "rusher",
  "rifleman",
  "rifleman",
];
export function infantryRole(mission, slot) {
  if (mission === 0) return slot % 6 === 4 ? "rusher" : "rifleman";
  const role = roster[((slot % roster.length) + roster.length) % roster.length];
  return mission === 1 && role === "rocketeer" ? "rifleman" : role;
}
export function pressureLimits(difficulty) {
  return {
    melee: difficulty === "easy" ? 2 : difficulty === "crazy" ? 4 : 3,
    thrower: difficulty === "easy" ? 2 : 3,
    rocket: ["hard", "crazy"].includes(difficulty) ? 2 : 1,
  };
}
/** A locked swing is a finite sector, not a contact-damage aura. Cover is checked by the caller. */
export function inMeleeSector(
  origin,
  target,
  aim,
  reach,
  halfArc,
  radius = 0.52,
) {
  const dx = target.x - origin.x,
    dz = target.z - origin.z,
    d = Math.hypot(dx, dz);
  const delta = Math.atan2(
    Math.sin(Math.atan2(dx, dz) - aim),
    Math.cos(Math.atan2(dx, dz) - aim),
  );
  return d <= reach + radius && Math.abs(delta) <= halfArc;
}
