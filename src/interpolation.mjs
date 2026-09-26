import * as T from "three";

/** Metres covered in one 1/60 s step above which a move is a teleport (spawns, respawns). */
export const TELEPORT = 4;
const scratch = new T.Quaternion();

/**
 * Render interpolation for the fixed 60 Hz simulation.
 *
 * On 120/144 Hz displays two or three frames fall between simulation steps, so
 * actors used to hold still and then jump. Each frame now draws every
 * top-level actor between its previous and current step state, using the
 * accumulator fraction. The exact simulation state (position and Euler
 * rotation, which game logic reads) is restored straight after rendering.
 * Restoring the Euler matters: a quaternion round trip can turn a 2.5 rad yaw
 * into (pi, 0.64, pi).
 */
export class Interpolator {
  constructor() {
    /** @type {WeakMap<T.Object3D, {p: T.Vector3, q: T.Quaternion, step: number}>} */
    this.previous = new WeakMap();
    this.step = 0;
    /** @type {{o: T.Object3D | null, p: T.Vector3, r: T.Euler}[]} */
    this.saved = [];
    this.count = 0;
    this.blended = 0;
  }
  /** Call before every fixed step: remember where each actor starts it. */
  capture(root) {
    this.step++;
    for (const o of root.children) {
      let s = this.previous.get(o);
      if (!s) {
        s = { p: new T.Vector3(), q: new T.Quaternion(), step: 0 };
        this.previous.set(o, s);
      }
      s.p.copy(o.position);
      s.q.copy(o.quaternion);
      s.step = this.step;
    }
  }
  /** Draw each actor `alpha` of the way from its previous to its current step state. */
  apply(root, alpha) {
    this.restore();
    this.blended = 0;
    if (!(alpha < 1)) return;
    alpha = Math.max(0, alpha);
    for (const o of root.children) {
      const s = this.previous.get(o);
      // Actors created during the last step have no earlier state to blend from.
      if (!s || s.step !== this.step) continue;
      const moved = !s.p.equals(o.position),
        turned = !s.q.equals(o.quaternion);
      if (!moved && !turned) continue;
      if (s.p.distanceToSquared(o.position) > TELEPORT * TELEPORT) continue;
      const slot = this.slot();
      slot.o = o;
      slot.p.copy(o.position);
      slot.r.copy(o.rotation);
      if (moved) o.position.lerpVectors(s.p, slot.p, alpha);
      if (turned)
        o.quaternion.slerpQuaternions(s.q, scratch.copy(o.quaternion), alpha);
      this.blended++;
    }
  }
  /** Put every blended actor back at its exact simulation state. */
  restore() {
    for (let i = 0; i < this.count; i++) {
      const s = this.saved[i];
      s.o.position.copy(s.p);
      s.o.rotation.copy(s.r);
      s.o = null;
    }
    this.count = 0;
  }
  /** Forget earlier steps (new mission, checkpoint restore): draw the current state. */
  reset() {
    this.restore();
    this.step++;
  }
  slot() {
    if (this.count === this.saved.length)
      this.saved.push({ o: null, p: new T.Vector3(), r: new T.Euler() });
    return this.saved[this.count++];
  }
}
