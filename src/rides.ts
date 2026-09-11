import * as T from "three";
import { model } from "./world";
import { COVER } from "./missions";
import { moveCircle, segmentBox } from "./rules.mjs";
import { VEHICLES, type VehicleKind } from "./arsenal";
export class Ride {
  mesh: T.Group;
  hp: number;
  ammo: number;
  cool = 0;
  speed = 0;
  heading = 0;
  private heldWeapon = "";
  wheels: T.Object3D[] = [];
  turret?: T.Object3D;
  rider: T.Group;
  constructor(
    public kind: VehicleKind,
    x: number,
    z: number,
  ) {
    const spec = this.spec;
    this.mesh = model(kind, x, z, spec.scale);
    this.hp = spec.hp;
    this.ammo = spec.ammo;
    this.mesh.traverse((o) => {
      if (String(o.userData.joint).startsWith("Wheel")) this.wheels.push(o);
      if (o.userData.joint === "Turret") this.turret = o;
    });
    this.rider = model("commando");
    this.rider.scale.setScalar(0.83);
    this.rider.position.set(
      kind === "jeep" ? -0.45 : 0,
      kind === "tank" ? 1.65 : 0.55,
      kind === "jeep" ? 0.15 : 0,
    );
    this.rider.traverse((o) => {
      const j = o.userData.joint;
      if (j === "ThighL" || j === "ThighR") o.rotation.x = -1.2;
      if (j === "ShinL" || j === "ShinR") o.rotation.x = 1.1;
    });
    this.rider.visible = false;
    this.mesh.add(this.rider);
  }
  showWeapon(id: string) {
    if (this.heldWeapon === id) return;
    this.rider.traverse((o) => {
      if (o.userData.joint === "Weapon") {
        o.clear();
        o.add(model("weapon_" + id));
      }
    });
    this.heldWeapon = id;
  }
  get spec() {
    return VEHICLES[this.kind];
  }
  get box() {
    return {
      x: this.mesh.position.x,
      z: this.mesh.position.z,
      w: this.spec.radius * 2,
      d: this.spec.radius * 2,
    };
  }
  drive(
    dt: number,
    x: number,
    z: number,
    aim: number,
    others: Ride[],
    river = false,
  ) {
    const len = Math.min(1, Math.hypot(x, z));
    this.speed = T.MathUtils.damp(
      this.speed,
      len * this.spec.speed,
      len ? this.spec.accel : 12,
      dt,
    );
    if (len > 0.01) {
      const desired = Math.atan2(x, z);
      this.heading +=
        Math.atan2(
          Math.sin(desired - this.heading),
          Math.cos(desired - this.heading),
        ) * Math.min(1, dt * (this.kind === "tank" ? 3 : 6));
    }
    const obstacles = [
      ...COVER,
      ...(river
        ? [
            { x: -18.25, z: -14, w: 29.5, d: 7 },
            { x: 18.25, z: -14, w: 29.5, d: 7 },
          ]
        : []),
      ...others.filter((v) => v !== this && v.hp > 0).map((v) => v.box),
    ];
    const before = this.mesh.position.clone(),
      m = moveCircle(
        before.x,
        before.z,
        Math.sin(this.heading) * this.speed * dt,
        Math.cos(this.heading) * this.speed * dt,
        this.spec.radius,
        obstacles,
        28.5,
      );
    this.mesh.position.set(m.x, before.y, m.z);
    this.mesh.rotation.y = this.heading;
    const traveled = Math.hypot(m.x - before.x, m.z - before.z);
    if (traveled < 0.001) this.speed = 0;
    for (const wheel of this.wheels) wheel.rotation.x += traveled / 0.38;
    if (this.turret) this.turret.rotation.y = aim - this.heading;
    this.mesh.rotation.z =
      this.kind === "motorcycle"
        ? -Math.sin(aim - this.heading) * Math.min(0.13, traveled * 1.5)
        : 0;
  }
  exitPoint(others: Ride[], river = false) {
    for (let i = 0; i < 16; i++) {
      const a = this.heading + Math.PI / 2 + (i * Math.PI) / 8,
        d = this.spec.radius + 1.05;
      const x = this.mesh.position.x + Math.sin(a) * d,
        z = this.mesh.position.z + Math.cos(a) * d;
      if (Math.abs(x) > 27.8 || Math.abs(z) > 27.8) continue;
      const boxes = [
        ...COVER,
        ...others.filter((v) => v !== this && v.hp > 0).map((v) => v.box),
      ];
      if (boxes.some((b) => segmentBox(x, z, x, z, b, 0.5) !== Infinity))
        continue;
      if (
        COVER.some(
          (b) =>
            segmentBox(
              this.mesh.position.x,
              this.mesh.position.z,
              x,
              z,
              b,
              0.48,
            ) !== Infinity,
        )
      )
        continue;
      return { x, z };
    }
    return null;
  }
}
