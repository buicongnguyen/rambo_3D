import * as T from "three";
import { repaint, ALLY_MARKS } from "./liveries";
import { CharacterMotion } from "./animation";
import { model, type World } from "./world";
import { moveCircle, resolveOverlap, routeStep, segmentBox } from "./rules.mjs";
import { WORLD_BOUNDS } from "./campaign.mjs";
import { MAX_SQUAD } from "./rescue.mjs";
import type { Box } from "./missions";

type Point = { x: number; z: number };
export type Ally = {
  mesh: T.Group;
  motion: CharacterMotion;
  target: Point;
  pathClock: number;
  cool: number;
  rounds: number;
  reload: number;
  passenger: boolean;
  wait: number;
  emerging?: Box;
};
/** Protected arcade support. Friends never obstruct the player or turn rescue into an escort failure. */
export class Squad {
  allies: Ally[] = [];
  private trail: Point[] = [];
  private ringGeo = new T.RingGeometry(0.5, 0.62, 16);
  private pinGeo = new T.OctahedronGeometry(0.14);
  private mat = new T.MeshBasicMaterial({
    color: 0x57eaff,
    toneMapped: false,
    side: T.DoubleSide,
  });
  constructor(private world: World) {}
  clear() {
    for (const a of this.allies) a.mesh.removeFromParent();
    this.allies = [];
    this.trail = [];
  }
  add(x: number, z: number, emerging?: Box) {
    if (this.allies.length >= MAX_SQUAD) return false;
    const mesh = model("commando", x, z),
      motion = new CharacterMotion(mesh);
    repaint(mesh, ALLY_MARKS, "ally");
    const grip = motion.joints.get("Weapon")?.node;
    if (grip) {
      grip.clear();
      grip.add(model("weapon_rifle"));
    }
    const ring = new T.Mesh(this.ringGeo, this.mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    const pin = new T.Mesh(this.pinGeo, this.mat);
    pin.position.y = 2.25;
    mesh.add(ring, pin);
    mesh.userData.batchActor = true;
    this.world.actors.add(mesh);
    this.allies.push({
      mesh,
      motion,
      target: { x, z },
      pathClock: this.allies.length * 0.14,
      cool: 0.15 + this.allies.length * 0.1,
      rounds: 12,
      reload: 0,
      passenger: false,
      wait: emerging ? 0.55 : 0,
      emerging,
    });
    return true;
  }
  private freePoint(origin: Point, boxes: Box[], slot: number): Point | null {
    for (const radius of [1.4, 2.5, 3.8, 5])
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 + slot * 2.1,
          x = origin.x + Math.sin(angle) * radius,
          z = origin.z + Math.cos(angle) * radius;
        if (
          Math.abs(x) > WORLD_BOUNDS.x - 0.6 ||
          z < WORLD_BOUNDS.minZ + 0.6 ||
          z > WORLD_BOUNDS.maxZ - 0.6
        )
          continue;
        if (
          boxes.every((b) => segmentBox(x, z, x, z, b, 0.5) === Infinity) &&
          boxes.every(
            (b) => segmentBox(origin.x, origin.z, x, z, b) === Infinity,
          )
        )
          return { x, z };
      }
    return null;
  }
  deploy(count: number, origin: Point, boxes: Box[]) {
    for (let i = 0; i < Math.min(MAX_SQUAD, count); i++) {
      const p = this.freePoint(origin, boxes, i);
      if (p) this.add(p.x, p.z);
    }
    this.trail = [{ x: origin.x, z: origin.z }];
  }
  update(
    dt: number,
    player: Point,
    riding: boolean,
    firing: boolean,
    angle: number,
    boxes: Box[],
    shoot: (x: number, z: number, angle: number) => void,
  ) {
    if (!this.allies.length) return;
    const last = this.trail.at(-1);
    if (!last || Math.hypot(last.x - player.x, last.z - player.z) > 0.8) {
      this.trail.push({ x: player.x, z: player.z });
      if (this.trail.length > 160) this.trail.shift();
    }
    for (const [slot, a] of this.allies.entries()) {
      const p = a.mesh.position;
      let oldX = p.x,
        oldZ = p.z;
      if (riding) {
        a.passenger = true;
        a.mesh.visible = false;
        p.x = player.x;
        p.z = player.z;
        a.emerging = undefined;
        a.wait = 0;
        continue;
      }
      if (a.passenger) {
        const q = this.freePoint(player, boxes, slot);
        if (!q) continue;
        p.x = q.x;
        p.z = q.z;
        a.mesh.visible = true;
        a.passenger = false;
        a.pathClock = 0;
        this.trail = [{ x: player.x, z: player.z }];
        oldX = p.x;
        oldZ = p.z;
      }
      if (a.wait > 0) {
        a.wait = Math.max(0, a.wait - dt);
        p.y = this.world.groundHeight(p.x, p.z);
        a.motion.update(dt, { vx: 0, vz: 0 });
        continue;
      }
      let target: Point = player,
        remaining = 2.2 + slot * 1.35;
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const q = this.trail[i],
          d = Math.hypot(q.x - target.x, q.z - target.z);
        if (d >= remaining && d > 0) {
          target = {
            x: target.x + ((q.x - target.x) * remaining) / d,
            z: target.z + ((q.z - target.z) * remaining) / d,
          };
          break;
        }
        remaining -= d;
        target = q;
      }
      // When stationary or newly recruited, keep a small formation instead of stacking on the player.
      if (remaining > 0) target = this.freePoint(player, boxes, slot) ?? target;
      // A cell has a reserved exit lane. Ignore only its own walls while walking out.
      const navigation = a.emerging
        ? boxes.filter((b) => b !== a.emerging)
        : boxes;
      if (a.emerging) target = a.emerging.exit!;
      a.pathClock -= dt;
      const distance = Math.hypot(target.x - p.x, target.z - p.z);
      if (distance > 0.25) {
        if (a.pathClock <= 0) {
          a.target = routeStep(
            p.x,
            p.z,
            target.x,
            target.z,
            navigation,
            0.44,
            WORLD_BOUNDS,
          );
          a.pathClock = 0.45 + slot * 0.04;
        }
        const d = Math.hypot(a.target.x - p.x, a.target.z - p.z);
        if (d > 0.01) {
          const step = Math.min(
            d,
            dt * (Math.hypot(player.x - p.x, player.z - p.z) > 10 ? 8.2 : 6.6),
          );
          const free = resolveOverlap(p.x, p.z, 0.4, navigation);
          const n = moveCircle(
            free.x,
            free.z,
            ((a.target.x - p.x) * step) / d,
            ((a.target.z - p.z) * step) / d,
            0.4,
            navigation,
            WORLD_BOUNDS,
          );
          p.x = n.x;
          p.z = n.z;
        }
      }
      if (a.emerging && Math.hypot(p.x - target.x, p.z - target.z) < 0.3) {
        a.emerging = undefined;
        a.pathClock = 0;
      }
      p.y = this.world.groundHeight(p.x, p.z);
      a.cool = Math.max(0, a.cool - dt);
      if (a.reload > 0) {
        a.reload = Math.max(0, a.reload - dt);
        if (a.reload === 0) a.rounds = 12;
      }
      const engaged =
        firing &&
        !a.emerging &&
        Math.hypot(p.x - player.x, p.z - player.z) < 22;
      const vx = (p.x - oldX) / dt,
        vz = (p.z - oldZ) / dt;
      if (engaged) a.mesh.rotation.y = angle;
      else if (Math.hypot(vx, vz) > 0.1) a.mesh.rotation.y = Math.atan2(vx, vz);
      if (
        engaged &&
        a.cool === 0 &&
        a.reload === 0 &&
        !boxes.some(
          (b) =>
            segmentBox(
              p.x,
              p.z,
              p.x + Math.sin(angle) * 0.9,
              p.z + Math.cos(angle) * 0.9,
              b,
              0.06,
            ) !== Infinity,
        )
      ) {
        shoot(p.x, p.z, angle);
        a.motion.kick();
        a.cool = 0.34;
        a.rounds--;
        if (a.rounds === 0) a.reload = 1.6;
      }
      a.motion.update(dt, {
        vx,
        vz,
        aiming: engaged,
        reload: a.reload > 0 ? 1 - a.reload / 1.6 : 0,
      });
    }
  }
}
