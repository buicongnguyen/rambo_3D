import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** One draw call per tracer: colored core above a darker red/magenta edge. */
export function tracerGeometry(color: number, enemy = false) {
  const outer = new T.BoxGeometry(0.2, 0.1, 0.95).translate(0, -0.035, 0);
  const inner = new T.BoxGeometry(0.11, 0.04, 0.82).translate(0, 0.04, 0);
  for (const [geometry, hex] of [
    [outer, enemy ? 0x401137 : 0x7c2018],
    [inner, color],
  ] as const) {
    const tint = new T.Color(hex),
      colors = [];
    for (let i = 0; i < geometry.getAttribute("position").count; i++)
      colors.push(tint.r, tint.g, tint.b);
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  }
  const merged = mergeGeometries([outer, inner])!;
  outer.dispose();
  inner.dispose();
  return merged;
}
