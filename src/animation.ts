import * as T from "three";
import { moveCircle, segmentBox } from "./rules.mjs";
import { COVER } from "./missions";
import { WORLD_BOUNDS } from "./campaign.mjs";
export type Knockback = { x: number; z: number; distance: number };

type Joint = { node: T.Object3D; position: T.Vector3; rotation: T.Quaternion };
export type MotionState = {
  vx: number;
  vz: number;
  aiming?: boolean;
  reload?: number;
  dodging?: boolean;
  melee?: boolean;
  attack?: { kind: string; progress: number };
};
// Shared scratch objects: poses run for every joint of every actor each tick.
const scratchQuat = new T.Quaternion(),
  scratchEuler = new T.Euler(),
  scratchVec = new T.Vector3();
const ease = (t: number) => {
  t = T.MathUtils.clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
/** Distance-driven articulated animation. Collision-stopped actors stop stepping. */
export class CharacterMotion {
  joints = new Map<string, Joint>();
  state = "idle";
  phase = 0;
  speed = 0;
  recoil = 0;
  impact = 0;
  private clock = 0;
  private twist = 0;
  constructor(public root: T.Group) {
    root.traverse((o) => {
      if (typeof o.userData.joint === "string")
        this.joints.set(o.userData.joint, {
          node: o,
          position: o.position.clone(),
          rotation: o.quaternion.clone(),
        });
    });
    if (!this.joints.has("Motion"))
      throw new Error("Character GLB is missing its articulated Motion pivot");
  }
  private pose(name: string, x = 0, y = 0, z = 0) {
    const j = this.joints.get(name);
    if (j)
      j.node.quaternion
        .copy(j.rotation)
        .multiply(scratchQuat.setFromEuler(scratchEuler.set(x, y, z)));
  }
  private offset(name: string, y: number, z = 0) {
    const j = this.joints.get(name);
    if (j) j.node.position.copy(j.position).add(scratchVec.set(0, y, z));
  }
  kick() {
    this.recoil = 1;
  }
  hit() {
    this.impact = 1;
  }
  update(dt: number, s: MotionState) {
    this.clock += dt;
    const actual = Math.hypot(s.vx, s.vz);
    this.speed = T.MathUtils.damp(this.speed, actual, 18, dt);
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.impact = Math.max(0, this.impact - dt * 5);
    const moving = actual > 0.06,
      run = this.speed > 4,
      weight = Math.min(1, this.speed / 1.5);
    this.phase += ((actual * dt) / (run ? 2.65 : 1.6)) * Math.PI * 2;
    const stride = Math.sin(this.phase),
      opposite = -stride;
    if (moving) {
      const heading = Math.atan2(s.vx, s.vz) - this.root.rotation.y;
      const desired = Math.atan2(Math.sin(heading), Math.cos(heading));
      this.twist +=
        Math.atan2(
          Math.sin(desired - this.twist),
          Math.cos(desired - this.twist),
        ) *
        (1 - Math.exp(-dt * 14));
    }
    this.state = s.dodging
      ? "dodge"
      : s.reload
        ? "reload"
        : moving
          ? run
            ? "run"
            : "walk"
          : s.aiming
            ? "aim"
            : "idle";
    this.pose("Hips", 0, this.twist, Math.sin(this.phase) * 0.04 * weight);
    const amplitude = (run ? 0.65 : 0.38) * weight;
    this.pose("ThighL", stride * amplitude);
    this.pose("ThighR", opposite * amplitude);
    this.pose("ShinL", Math.max(0, -stride) * (run ? 1.05 : 0.65) * weight);
    this.pose("ShinR", Math.max(0, stride) * (run ? 1.05 : 0.65) * weight);
    this.offset(
      "Motion",
      Math.abs(Math.cos(this.phase)) * weight * (run ? 0.05 : 0.022) +
        Math.sin(this.clock * 2) * 0.008,
    );
    this.pose("Motion", s.dodging ? 0.65 : 0, 0, s.dodging ? 0.18 : 0);
    this.pose(
      "Spine",
      (run ? 0.1 : 0) * weight - this.recoil * 0.1 + this.impact * 0.22,
      Math.sin(this.phase) * 0.045 * weight,
      Math.sin(this.phase) * 0.025 * weight,
    );
    this.pose("Head", -0.03 * weight - this.impact * 0.15);
    const swing = (s.aiming ? 0.05 : 0.28) * weight;
    this.pose("ArmL", opposite * swing, 0, -0.035);
    this.pose("ArmR", stride * swing, 0, 0.035);
    this.pose("ForearmL", -0.08 - this.recoil * 0.12);
    this.pose("ForearmR", -this.recoil * 0.1);
    this.offset("Weapon", 0, -this.recoil * 0.065);
    this.pose("Weapon");
    if (s.melee) {
      this.pose("ArmL", opposite * swing + 0.35, 0, -0.12);
      this.pose("ForearmL", 0.25);
      this.pose("Weapon", -0.3);
    }
    if (s.attack) {
      const { kind, progress } = s.attack;
      const wind = Math.min(1, progress),
        strike = Math.min(1, Math.max(0, progress - 1) * 5);
      this.state = progress < 1 ? "windup" : "strike";
      if (kind === "rusher" || kind === "swordsman") {
        this.pose(
          "Spine",
          -0.1 * wind + 0.2 * strike,
          -0.4 * wind + 0.8 * strike,
        );
        this.pose(
          "ArmR",
          -0.65 * wind + 1.15 * strike,
          -0.35 * wind + 0.8 * strike,
          0.2 * wind,
        );
        this.pose("ForearmR", -0.4 * wind + 0.5 * strike);
        this.pose("Weapon", -0.6 * wind + 0.75 * strike, -0.5 * wind + strike);
      } else if (kind === "thrower") {
        this.pose("ArmR", -1.65 * wind + 1.8 * strike, 0.2, 0.2);
        this.pose("ForearmR", -0.6 * wind + 0.6 * strike);
      }
    }
    if (s.reload) {
      const cycle = Math.sin(ease(s.reload) * Math.PI);
      this.pose("Spine", -0.04, cycle * 0.14);
      this.pose("ArmL", -0.2 * cycle, 0, -0.32 * cycle);
      this.pose("ForearmL", -0.9 * cycle, 0, 0.3 * cycle);
      this.pose("ArmR", 0.4 * cycle);
    }
    if (s.dodging) {
      this.pose("ThighL", -0.8);
      this.pose("ThighR", 0.6);
      this.pose("ShinL", 1.25);
      this.pose("ShinR", 0.6);
      this.offset("Motion", -0.25);
    }
  }
  fall(t: number, backward = false, maxLean = 1.48) {
    this.state = "fallen";
    const p = ease(t);
    this.pose(
      "Motion",
      (backward ? -1 : 1) * Math.min(p * 1.48, maxLean),
      0,
      p * 0.16,
    );
    this.offset("Motion", p * 0.24);
    this.pose("Spine", p * 0.15, 0, -p * 0.1);
    this.pose("ThighL", -0.2 * p);
    this.pose("ThighR", 0.25 * p);
    this.pose("ShinL", 0.6 * p);
    this.pose("ShinR", 0.25 * p);
    this.pose("ArmL", 0.3 * p, 0, -0.45 * p);
    this.pose("ArmR", 0.15 * p, 0, 0.6 * p);
    this.pose("Head", 0.12 * p);
  }
}
/** Owns only cloned fade materials. Shared prefab materials/textures remain untouched. */
export class FallenBody {
  age = 0;
  opacity = 1;
  disposed = false;
  private materials: T.Material[] = [];
  private startY: number;
  private initial: T.Quaternion;
  private slide = 0;
  private maxLean = 1.48;
  private stopped = false;
  private shadowsOff = false;
  constructor(
    public mesh: T.Group,
    private motion?: CharacterMotion,
    private kind = "human",
    private knock?: Knockback,
  ) {
    if (knock) {
      const len = Math.hypot(knock.x, knock.z);
      if (len > 0.001) {
        this.knock = { ...knock, x: knock.x / len, z: knock.z / len };
        mesh.rotation.y = Math.atan2(knock.x, knock.z) + Math.PI;
        // Reserve space for the entire fallen silhouette, including a death already near a wall.
        const reach = knock.distance + 1.85;
        let hit = 1;
        for (const box of COVER)
          hit = Math.min(
            hit,
            segmentBox(
              mesh.position.x,
              mesh.position.z,
              mesh.position.x + this.knock.x * reach,
              mesh.position.z + this.knock.z * reach,
              box,
              0.45,
            ),
          );
        const space = Math.max(0, reach * hit - 0.05);
        this.knock.distance = Math.min(
          knock.distance,
          Math.max(0, space - 1.85),
        );
        this.maxLean = Math.min(1.48, Math.asin(Math.min(1, space / 1.85)));
      } else this.knock = undefined;
    }
    mesh.userData.batchActor = true;
    this.startY = mesh.position.y;
    this.initial = mesh.quaternion.clone();
    mesh.visible = true;
    const clones = new Map<T.Material, T.Material>();
    mesh.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      o.visible = true;
      const copy = (m: T.Material) => {
        let c = clones.get(m);
        if (!c) {
          c = m.clone();
          c.userData.batchBase = m.userData.batchBase ?? m.uuid;
          c.transparent = true;
          c.depthWrite = false;
          clones.set(m, c);
          this.materials.push(c);
        }
        return c;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(copy)
        : copy(o.material);
    });
  }
  update(dt: number) {
    this.age += dt;
    const fall = ease(this.age / (this.kind === "gunship" ? 1.2 : 0.7));
    if (this.knock && !this.stopped) {
      const next =
        this.knock.distance * (1 - (1 - Math.min(1, this.age / 0.7)) ** 3);
      const step = next - this.slide;
      const p = this.mesh.position;
      const moved = moveCircle(
        p.x,
        p.z,
        this.knock.x * step,
        this.knock.z * step,
        0.55,
        COVER,
        WORLD_BOUNDS,
      );
      if (Math.hypot(moved.x - p.x, moved.z - p.z) < step * 0.9)
        this.stopped = true;
      p.x = moved.x;
      p.z = moved.z;
      this.slide = next;
    }
    if (this.motion) this.motion.fall(fall, !!this.knock, this.maxLean);
    else {
      this.mesh.quaternion
        .copy(this.initial)
        .multiply(
          new T.Quaternion().setFromEuler(
            new T.Euler(
              fall * (this.kind === "gunship" ? 0.35 : 0.08),
              0,
              fall * (this.kind === "barge" ? 0.22 : 0.15),
            ),
          ),
        );
      this.mesh.position.y =
        this.startY +
        (this.kind === "gunship"
          ? 0.12 - this.startY
          : this.kind === "barge"
            ? -0.8
            : -0.12) *
          fall;
    }
    this.opacity = 1 - ease((this.age - 2) / 2);
    for (const m of this.materials) m.opacity = this.opacity;
    if (this.age > 2 && !this.shadowsOff) {
      this.shadowsOff = true;
      this.mesh.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = false;
      });
    }
    if (this.age >= 4) {
      this.dispose();
      return true;
    }
    return false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    for (const m of this.materials) m.dispose();
    this.materials = [];
  }
}

export class VehicleMotion {
  private rotor?: T.Object3D;
  private turret?: T.Object3D;
  private turretRest?: T.Quaternion;
  private rotorRest?: T.Quaternion;
  private spin = 0;
  private wheels: Joint[] = [];
  private pods: Joint[] = [];
  private wheelSpin = 0;
  constructor(
    private root: T.Group,
    private kind: string,
  ) {
    root.traverse((o) => {
      if (String(o.userData.joint).startsWith("Wheel"))
        this.wheels.push({
          node: o,
          position: o.position.clone(),
          rotation: o.quaternion.clone(),
        });
      if (String(o.userData.joint).startsWith("Pod"))
        this.pods.push({
          node: o,
          position: o.position.clone(),
          rotation: o.quaternion.clone(),
        });
      if (o.userData.joint === "Rotor") {
        this.rotor = o;
        this.rotorRest = o.quaternion.clone();
      }
      if (o.userData.joint === "Turret") {
        this.turret = o;
        this.turretRest = o.quaternion.clone();
      }
    });
  }
  update(
    dt: number,
    vx: number,
    aim: number,
    time: number,
    vz = 0,
    charging = false,
    steerHull = true,
  ) {
    this.wheelSpin +=
      ((vx * Math.sin(this.root.rotation.y) +
        vz * Math.cos(this.root.rotation.y)) *
        dt) /
      0.6;
    for (const w of this.wheels)
      w.node.quaternion
        .copy(w.rotation)
        .multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(1, 0, 0),
            this.wheelSpin,
          ),
        );
    for (const p of this.pods)
      p.node.quaternion.slerp(
        p.rotation
          .clone()
          .multiply(
            new T.Quaternion().setFromAxisAngle(
              new T.Vector3(1, 0, 0),
              charging ? -0.22 : -0.05,
            ),
          ),
        1 - Math.exp(-dt * 4),
      );
    if (this.rotor) {
      this.spin += dt * 38;
      this.rotor.quaternion
        .copy(this.rotorRest!)
        .multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(0, 1, 0),
            this.spin,
          ),
        );
    }
    if (this.kind === "tank" && this.turret) {
      if (steerHull && Math.abs(vx) > 0.05)
        this.root.rotation.y = T.MathUtils.damp(
          this.root.rotation.y,
          vx > 0 ? Math.PI / 2 : -Math.PI / 2,
          3,
          dt,
        );
      this.turret.quaternion
        .copy(this.turretRest!)
        .multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(0, 1, 0),
            aim - this.root.rotation.y,
          ),
        );
    }
    if (this.kind === "gunship") {
      this.root.rotation.z = T.MathUtils.damp(
        this.root.rotation.z,
        -vx * 0.045,
        4,
        dt,
      );
      this.root.rotation.x = 0.045 + Math.sin(time * 1.7) * 0.015;
    }
    if (this.kind === "barge") {
      this.root.position.y = 0.04 + Math.sin(time * 1.5) * 0.045;
      this.root.rotation.z = Math.sin(time * 1.2) * 0.022;
    }
  }
}
