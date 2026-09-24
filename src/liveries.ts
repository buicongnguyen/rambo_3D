import * as T from "three";

const variants = new Map<string, T.Material>();
/**
 * Recolour named Blender materials with shared clones, so every actor wearing the
 * same livery still instances together (see ActorBatches). Colours are sRGB hex.
 */
export function repaint(
  root: T.Object3D,
  colors: Record<string, number>,
  livery: string,
) {
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const hex = colors[o.material.name];
    if (hex === undefined) return;
    const key = livery + ":" + o.material.uuid;
    let material = variants.get(key);
    if (!material) {
      material = o.material.clone() as T.MeshStandardMaterial;
      (material as T.MeshStandardMaterial).color.setHex(hex);
      variants.set(key, material);
    }
    o.material = material;
  });
}
/** Enemy armour shares tank.glb with the player's green tank: desert hostile paint. */
export const HOSTILE_ARMOR = {
  "Vehicle paint": 0xc9964a,
  "Vehicle trim": 0x6e4f2b,
};
/** Rescued allies share commando.glb with the hero: cyan bandanas mark them. */
export const ALLY_MARKS = { "Hero bandana": 0x22d3f0 };
