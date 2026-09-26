/**
 * Presentation "director": cinematic beats and music intensity layered on top
 * of the simulation. Game.update never sees any of this, so tests that step the
 * game directly are unaffected; the main loop asks the director each frame
 * whether to hold or slow the simulation and where the camera should look.
 *
 * - Boss intro: when command bosses arrive, the simulation holds while the
 *   camera pans to them, names them under letterbox bars and pans back.
 * - Slow-motion final kill: the last command boss (or the mission's last
 *   hostile) drops at quarter speed while the camera leans in.
 * Reduced motion keeps the name card but skips camera moves, holds and slow
 * motion.
 */
export const INTRO = { pan: 0.6, hold: 1.5, back: 0.55, zoom: 0.8, card: 1.4 };
export const SLOWMO = {
  seconds: 1.5,
  scale: 0.25,
  lean: 0.55,
  zoom: 0.82,
  ease: 0.3,
};

const smooth = (t) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

export class Director {
  constructor() {
    this.intro = null;
    this.slowmo = null;
  }
  reset() {
    this.intro = this.slowmo = null;
  }
  /** Command bosses arrived at `point`. */
  startIntro(point, reduced = false) {
    this.intro = {
      t: 0,
      point: { x: point.x, z: point.z },
      reduced,
      total: reduced ? INTRO.card : INTRO.pan + INTRO.hold + INTRO.back,
    };
  }
  /** Any input skips to the pan back (after a short minimum). */
  skipIntro() {
    const i = this.intro;
    if (!i || i.reduced || i.t < 0.4) return;
    i.t = Math.max(i.t, INTRO.pan + INTRO.hold);
  }
  /** The final kill landed at `point`. */
  startSlowmo(point, reduced = false) {
    if (reduced) return;
    this.slowmo = { t: 0, point: { x: point.x, z: point.z } };
  }
  get busy() {
    return !!(this.intro || this.slowmo);
  }
  /**
   * Advance by `dt` real seconds. Returns what this frame should do:
   * hold (pause the simulation), scale (simulation time scale), camera
   * ({x, z, zoom} override or null), card (show the boss name card) and
   * slow (0-1 weight of the slow-motion beat, for audio).
   */
  update(dt, player) {
    let hold = false,
      scale = 1,
      camera = null,
      card = false,
      slow = 0;
    const i = this.intro;
    if (i) {
      i.t += dt;
      if (i.reduced) card = i.t < i.total;
      else {
        hold = true;
        const w =
          i.t < INTRO.pan
            ? smooth(i.t / INTRO.pan)
            : i.t < INTRO.pan + INTRO.hold
              ? 1
              : 1 - smooth((i.t - INTRO.pan - INTRO.hold) / INTRO.back);
        camera = {
          x: mix(player.x, i.point.x, w),
          z: mix(player.z, i.point.z, w),
          zoom: mix(1, INTRO.zoom, w),
        };
        card =
          i.t > INTRO.pan * 0.5 &&
          i.t < INTRO.pan + INTRO.hold + INTRO.back * 0.4;
      }
      if (i.t >= i.total) this.intro = null;
    }
    const s = this.slowmo;
    if (s) {
      s.t += dt;
      const out = smooth((s.t - (SLOWMO.seconds - SLOWMO.ease)) / SLOWMO.ease);
      scale = mix(SLOWMO.scale, 1, out);
      slow = smooth(s.t / 0.2) * (1 - out);
      camera ??= {
        x: mix(player.x, s.point.x, SLOWMO.lean * slow),
        z: mix(player.z, s.point.z, SLOWMO.lean * slow),
        zoom: mix(1, SLOWMO.zoom, slow),
      };
      if (s.t >= SLOWMO.seconds) this.slowmo = null;
    }
    return { hold, scale, camera, card, slow };
  }
}

/**
 * Combat intensity target (0-1) for the adaptive music: alerted hostiles close
 * by, how recently shots were fired or damage taken, and being seen.
 */
export function combatTarget({ alertedNear, sinceCombat, spotted }) {
  const threat = Math.min(1, alertedNear / 4);
  const recency =
    sinceCombat < 2 ? 1 : sinceCombat < 8 ? 1 - (sinceCombat - 2) / 6 : 0;
  return Math.min(1, 0.55 * threat + 0.45 * recency + (spotted ? 0.15 : 0));
}

/** Music reacts fast to a fight (0.5 s) and settles slowly afterwards (3.5 s). */
export function smoothIntensity(current, target, dt) {
  const tau = target > current ? 0.5 : 3.5;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Low health muffles the music: nothing above 35% health, fully at 10%. */
export function healthMuffle(ratio) {
  return smooth((0.35 - ratio) / 0.25);
}
