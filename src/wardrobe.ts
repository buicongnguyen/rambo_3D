import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { model } from "./world";
import { lookVariant } from "./wardrobe-rules.mjs";

/**
 * Dresses the hero rig in an outfit from disguises.glb (art/build_disguises.py;
 * art/disguise_dress.py is the Blender twin used for cards and sprites):
 * - `tints` recolour body materials with shared clones, so looks still instance;
 * - `hide` removes body parts ("Joint:Material") from the clone, because a fallen
 *   body is redrawn from every mesh it still holds;
 * - pieces hang on the body's joints, scaled by `fit` on the commando woman.
 * The outfit file loads the first time a look needs it, never at boot.
 */
export type Look = { hero: string; outfit: string };
let kit: T.Group | undefined;
let loading: Promise<void> | undefined;
let current: Look = { hero: "commando", outfit: "none" };
const tinted = new Map<string, T.Material>();

export function loadWardrobe() {
  loading ??= new GLTFLoader()
    .loadAsync(`${import.meta.env.BASE_URL}models/disguises.glb`)
    .then((g) => {
      g.scene.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
      });
      kit = g.scene;
    })
    .catch((error) => {
      loading = undefined; // let a later look try again
      throw error;
    });
  return loading;
}
/** The look every new hero rig gets (the player, vehicle riders, the briefing). */
export function setLook(look: Look) {
  current = { hero: look.hero, outfit: look.outfit };
  if (current.outfit !== "none") void loadWardrobe().catch(() => {});
}

/** A hero rig in the current look. */
export function heroModel(x = 0, z = 0, look = current) {
  const root = model(look.hero, x, z);
  dress(root, look);
  return root;
}

function joints(root: T.Object3D) {
  const map = new Map<string, T.Object3D>();
  root.traverse((o) => {
    if (typeof o.userData.joint === "string") map.set(o.userData.joint, o);
  });
  return map;
}

/** Put `look.outfit` on a fresh hero rig; waits for the outfit file if needed. */
function dress(root: T.Object3D, look: Look) {
  if (look.outfit === "none") return root;
  root.userData.variant = lookVariant(look.outfit); // the 2.5D sheet
  if (!kit) {
    void loadWardrobe()
      .then(() => dress(root, look))
      .catch(() => {});
    return root;
  }
  const top = kit.getObjectByName("dz_" + look.outfit);
  if (!top || root.userData.dressed === look.outfit) return root;
  root.userData.dressed = look.outfit;
  const tints = JSON.parse(String(top.userData.tints || "{}")) as Record<
    string,
    string
  >;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const hex = tints[o.material.name];
    if (hex === undefined) return;
    const key = look.outfit + ":" + o.material.uuid;
    let material = tinted.get(key);
    if (!material) {
      const copy = o.material.clone() as T.MeshStandardMaterial;
      copy.color.set(hex);
      tinted.set(key, (material = copy));
    }
    o.material = material;
  });
  const byJoint = joints(root);
  for (const entry of String(top.userData.hide || "").split("|")) {
    const [joint, material] = entry.split(":");
    const node = byJoint.get(joint);
    if (!node || !material) continue;
    // Joint meshes are single meshes, or groups of one mesh per material
    // (the cast's merged joints); nested joints keep their own parts.
    const parts: T.Object3D[] = [];
    for (const child of node.children)
      if (!child.userData.joint)
        parts.push(...(child instanceof T.Mesh ? [child] : child.children));
    for (const part of parts)
      if (
        part instanceof T.Mesh &&
        !Array.isArray(part.material) &&
        part.material.name === material
      )
        part.removeFromParent();
  }
  const woman = look.hero === "commandoWoman";
  for (const wear of top.children) {
    const node = byJoint.get(String(wear.userData.wear));
    if (!node) continue;
    const holder = new T.Group();
    holder.name = "outfit " + look.outfit;
    const fit = wear.userData.fit as number[] | undefined;
    if (woman && fit) holder.scale.fromArray(fit);
    for (const piece of wear.children) holder.add(piece.clone(true));
    node.add(holder);
  }
  return root;
}
