/**
 * Presentation feedback ("game feel") collected by the simulation and consumed by
 * the UI: camera trauma, brief hit-stop, kill streaks, hit and damage events.
 * Nothing here feeds back into combat, so tests that step Game.update directly
 * keep deterministic results.
 */
export const STREAK_WINDOW = 2.6;
export const HIT_STOP_COOLDOWN = 0.28;
const LABELS = ["", "", "DOUBLE KILL", "TRIPLE KILL", "QUAD KILL", "RAMPAGE"];

export function streakLabel(count) {
  if (count < 2) return "";
  if (count >= 12) return "ONE-MAN ARMY";
  if (count >= 8) return "UNSTOPPABLE";
  return LABELS[Math.min(count, LABELS.length - 1)];
}

/** Screen angle (radians, 0 = up, clockwise) from the player toward a damage source. */
export function hurtAngle(player, source) {
  if (!source) return null;
  const dx = source.x - player.x,
    dz = source.z - player.z;
  if (Math.hypot(dx, dz) < 0.05) return null;
  // The gameplay camera looks down -Z, so world -Z is screen up and +X is right.
  return Math.atan2(dx, -dz);
}

export class Feel {
  constructor() {
    this.reset();
  }
  reset() {
    this.trauma = 0;
    this.hitStop = 0;
    this.stopCooldown = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lastKill = -Infinity;
    this.banner = null;
    this.hits = [];
    this.hurts = [];
  }
  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }
  /** A short freeze sells impact; a cooldown stops automatic fire from stuttering. */
  freeze(seconds) {
    if (this.stopCooldown > 0 || this.hitStop > 0) return;
    this.hitStop = seconds;
    this.stopCooldown = seconds + HIT_STOP_COOLDOWN;
  }
  hit(x, y, z, damage, kind = "hit") {
    if (this.hits.length < 32)
      this.hits.push({
        x,
        y,
        z,
        damage: Math.max(1, Math.round(damage)),
        kind,
      });
  }
  /** weight: 0 infantry, ~0.5 armour, 1 boss. */
  kill(time, weight = 0) {
    this.streak = time - this.lastKill <= STREAK_WINDOW ? this.streak + 1 : 1;
    this.lastKill = time;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.addTrauma(0.08 + 0.5 * weight);
    this.freeze(0.035 + 0.09 * weight);
    const label = weight >= 1 ? "COMMANDER DOWN" : streakLabel(this.streak);
    if (label) this.banner = { label, count: this.streak, time };
  }
  hurt(damage, angle) {
    this.addTrauma(Math.min(0.45, 0.1 + damage / 70));
    if (this.hurts.length < 8) this.hurts.push({ damage, angle });
  }
  blast(distance, splash = 3) {
    const reach = 9 + splash * 3;
    if (distance < reach) this.addTrauma((1 - distance / reach) * 0.55);
  }
  /** Advance presentation timers with real (unscaled) frame time. */
  decay(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    this.hitStop = Math.max(0, this.hitStop - dt);
    this.stopCooldown = Math.max(0, this.stopCooldown - dt);
  }
  /**
   * @returns {{
   *   hits: { x: number; y: number; z: number; damage: number; kind: string }[];
   *   hurts: { damage: number; angle: number | null }[];
   *   banner: { label: string; count: number; time: number } | null;
   * }}
   */
  drain() {
    const out = { hits: this.hits, hurts: this.hurts, banner: this.banner };
    this.hits = [];
    this.hurts = [];
    this.banner = null;
    return out;
  }
}
