import * as T from "three";
import { model } from "./world";
import { INFANTRY } from "./enemy-roles.mjs";
export type InfantryRole = keyof typeof INFANTRY;
const uniforms = new Map<string, T.Material>();
const colors = {
  rusher: 0xad4d32,
  swordsman: 0x70685c,
  thrower: 0xbe903e,
  rocketeer: 0xb8642e,
};
/** Shared material variants and prefab gear preserve instancing across every patrol. */
export function equipInfantry(root: T.Group, role: InfantryRole) {
  if (role === "rifleman") return;
  const joints = new Map<string, T.Object3D>();
  root.traverse((o) => {
    if (o.userData.joint) joints.set(o.userData.joint, o);
    if (
      o instanceof T.Mesh &&
      !Array.isArray(o.material) &&
      o.material.name === "Sand canvas"
    ) {
      const key = role + o.material.uuid;
      if (!uniforms.has(key)) {
        const m = o.material.clone() as T.MeshStandardMaterial;
        m.color.setHex(colors[role]);
        uniforms.set(key, m);
      }
      o.material = uniforms.get(key)!;
    }
  });
  const grip = joints.get("Weapon");
  if (grip) {
    grip.clear();
    const gear = model(
      role === "rocketeer"
        ? "weapon_missile"
        : role === "swordsman"
          ? "weapon_sword"
          : "weapon_knife",
    );
    gear.name = role + "_gear";
    if (role === "rocketeer") gear.scale.setScalar(1.2);
    grip.add(gear);
  }
  // The spare blades/tube read from the overhead camera as well as from the front.
  const spine = joints.get("Spine");
  if (spine && (role === "thrower" || role === "rocketeer")) {
    for (const side of role === "thrower" ? [-1, 1] : [1]) {
      const gear = model(
        role === "thrower" ? "weapon_knife" : "weapon_missile",
      );
      gear.position.set(side * 0.22, 0.2, -0.3);
      gear.rotation.x = -Math.PI / 2;
      gear.rotation.z = side * 0.35;
      gear.scale.setScalar(role === "thrower" ? 0.85 : 0.8);
      spine.add(gear);
    }
  }
}
const sector = (arc: number) =>
  new T.RingGeometry(0.82, 1, 24, 1, -Math.PI / 2 - arc, arc * 2);
export const infantryWarnings = {
  rusher: sector(INFANTRY.rusher.arc),
  swordsman: sector(INFANTRY.swordsman.arc),
  thrower: new T.RingGeometry(0.65, 0.76, 24),
  rocketeer: new T.PlaneGeometry(0.1, 1).translate(0, -0.5, 0),
};
