import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** Compact rounded rounds, warm cores and a small red tail; one draw call each. */
export function tracerGeometry(color: number, enemy = false) {
  // The former tracer was 0.95 m long and 0.20 m wide. Keep the new envelope at half size.
  const body = new T.CapsuleGeometry(0.05, 0.375, 2, 6)
    .rotateX(Math.PI / 2)
    .scale(1, 0.7, 1);
  const core = new T.CapsuleGeometry(0.031, 0.3, 2, 6)
    .rotateX(Math.PI / 2)
    .scale(1, 0.55, 1)
    .translate(0, 0.032, 0.025);
  const tip = new T.SphereGeometry(0.032, 6, 4)
    .scale(1, 0.6, 1.25)
    .translate(0, 0.025, 0.195);
  const tail = new T.CylinderGeometry(0.045, 0.045, 0.04, 6)
    .rotateX(Math.PI / 2)
    .scale(1, 0.7, 1)
    .translate(0, 0, -0.185);
  const parts = [
    [body, color],
    [core, enemy ? 0xffb82e : 0xffd95b],
    [tip, 0xffed8b],
    [tail, 0xc23b17],
  ] as const;
  for (const [geometry, hex] of parts) {
    const tint = new T.Color(hex),
      colors = [];
    for (let i = 0; i < geometry.getAttribute("position").count; i++)
      colors.push(tint.r, tint.g, tint.b);
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  }
  const merged = mergeGeometries(parts.map(([g]) => g))!;
  parts.forEach(([g]) => g.dispose());
  return merged;
}
