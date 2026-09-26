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
  // Late-stage blade specialist: about 2.7x rifleman speed, a zig-zag approach
  // and the shortest swing warning, but fragile and light-hitting.
  ninja: {
    hp: 58,
    speed: 5.1,
    reach: 1.7,
    warning: 0.42,
    recovery: 1.05,
    damage: 12,
    arc: 0.75,
    melee: true,
  },
};
/** Stages (0-based) where the roster escalates: more swordsmen, then ninjas. */
export const SWORD_STAGE = 2;
export const NINJA_STAGE = 4;
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
  const i = ((slot % roster.length) + roster.length) % roster.length;
  const stage = Math.floor(mission / 3);
  // The first two stages stay gentle; later stages trade riflemen for blades.
  if (stage >= NINJA_STAGE && [2, 11, 17].includes(i)) return "ninja";
  if (stage >= NINJA_STAGE + 1 && i === 18) return "ninja";
  if (stage >= SWORD_STAGE && [5, 12].includes(i)) return "swordsman";
  const role = roster[i];
  return mission === 1 && role === "rocketeer" ? "rifleman" : role;
}
/**
 * Difficulty changes how soldiers fight, not just how many there are.
 * - reaction: seconds from first sighting to a gunner's first shot. Never
 *   below the 0.6 s ground warning ring, so every shot stays telegraphed.
 *   Blade and throw specialists keep their own windup as the telegraph.
 * - spread: half-angle of the rifle pair (radians).
 * - interval: multiplier on the rifle re-fire time.
 * - lead: share of your velocity riflemen aim ahead of you.
 * - share: metres within which a soldier who spots you alerts nearby soldiers.
 * - flank: share of riflemen that circle to your side instead of holding a
 *   firing line (from stage 3; the first two stages stay gentle).
 */
export const AI_PROFILES = {
  easy: {
    reaction: 1.1,
    spread: 0.1,
    interval: 1.25,
    lead: 0,
    share: 0,
    flank: 0,
  },
  normal: {
    reaction: 0.6,
    spread: 0.07,
    interval: 1,
    lead: 0,
    share: 6,
    flank: 0.2,
  },
  hard: {
    reaction: 0.6,
    spread: 0.06,
    interval: 0.9,
    lead: 0.5,
    share: 10,
    flank: 0.35,
  },
  crazy: {
    reaction: 0.6,
    spread: 0.05,
    interval: 0.85,
    lead: 0.75,
    share: 14,
    flank: 0.5,
  },
};
export function aiProfile(difficulty) {
  return AI_PROFILES[difficulty] ?? AI_PROFILES.normal;
}
/** Deterministic, evenly spread subset of patrol indices that flank. */
export function isFlanker(index, share) {
  return share > 0 && (((index * 0.6180339887) % 1) + 1) % 1 < share;
}
/**
 * Aim angle that leads a moving target: `lead` 0 aims straight at it, 1 at
 * where it will be when a `speed` m/s bullet arrives. The lead is capped at
 * 6 m so a sprinting player is anticipated, never predicted perfectly.
 */
export function leadAngle(from, target, velocity, speed, lead) {
  const d = Math.hypot(target.x - from.x, target.z - from.z);
  const t = speed > 0 ? d / speed : 0;
  let ax = velocity.x * t * lead,
    az = velocity.z * t * lead;
  const reach = Math.hypot(ax, az);
  if (reach > 6) {
    ax *= 6 / reach;
    az *= 6 / reach;
  }
  return Math.atan2(target.x + ax - from.x, target.z + az - from.z);
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
