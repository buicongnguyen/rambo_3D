import * as T from "three";

/**
 * One instanced layer of motes in the air around the camera target: snow, embers,
 * blowing sand, pollen, dust or fireflies (see AIR in atmosphere.mjs). Every mote
 * moves on the GPU and wraps inside a box that follows the view, so the layer is
 * one draw call with no per-frame CPU work beyond a few uniforms.
 */
type Spec = {
  count: number;
  color: number;
  size: number;
  vel: number[];
  sway: number;
  twinkle: number;
  glow: boolean;
  opacity: number;
};
const BOX = new T.Vector3(76, 13, 62);
const MAX = 520;

const VERTEX = /* glsl */ `
attribute vec4 seed;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uVel;
uniform float uTime;
uniform float uSway;
uniform float uSize;
uniform float uScale;
uniform float uTwinkle;
varying float vAlpha;
void main() {
  float phase = seed.w * 6.2832;
  vec3 p = seed.xyz * uBox + uVel * uTime;
  p.x += sin(uTime * 0.7 + phase) * uSway;
  p.z += cos(uTime * 0.55 + phase * 1.3) * uSway;
  vec2 origin = uCenter.xz - uBox.xz * 0.5;
  p.xz = mod(p.xz - origin, uBox.xz) + origin;
  p.y = mod(p.y, uBox.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uSize * uScale / -mv.z);
  vAlpha = mix(1.0, 0.25 + 0.75 * max(0.0, sin(uTime * 2.6 + phase * 7.0)), uTwinkle);
  // Fade in near the ground and out at the top so wrapping never pops.
  vAlpha *= smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(uBox.y - 2.0, uBox.y, p.y));
}`;
const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vAlpha * uOpacity;
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export class Air {
  readonly points: T.Points;
  private material: T.ShaderMaterial;
  private geometry = new T.BufferGeometry();
  private size = new T.Vector2();
  constructor() {
    const seeds = new Float32Array(MAX * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    this.geometry.setAttribute("seed", new T.BufferAttribute(seeds, 4));
    // Positions are computed in the shader; three.js still wants a position attribute.
    this.geometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(MAX * 3), 3),
    );
    this.material = new T.ShaderMaterial({
      uniforms: {
        uCenter: { value: new T.Vector3() },
        uBox: { value: BOX },
        uVel: { value: new T.Vector3() },
        uTime: { value: 0 },
        uSway: { value: 0 },
        uSize: { value: 0.1 },
        uScale: { value: 500 },
        uTwinkle: { value: 0 },
        uColor: { value: new T.Color() },
        uOpacity: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.points = new T.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.name = "air";
  }
  /** Switch to a biome's motes; Low draws half as many. */
  set(spec: Spec | undefined, low: boolean) {
    this.points.visible = !!spec;
    if (!spec) return;
    const u = this.material.uniforms;
    u.uColor.value.setHex(spec.color);
    u.uVel.value.fromArray(spec.vel);
    u.uSway.value = spec.sway;
    u.uSize.value = spec.size;
    u.uTwinkle.value = spec.twinkle;
    u.uOpacity.value = spec.opacity;
    this.material.blending = spec.glow ? T.AdditiveBlending : T.NormalBlending;
    this.material.needsUpdate = true;
    this.geometry.setDrawRange(
      0,
      Math.min(MAX, Math.round(spec.count * (low ? 0.5 : 1))),
    );
  }
  update(
    time: number,
    center: T.Vector3,
    renderer: T.WebGLRenderer,
    camera: T.PerspectiveCamera,
  ) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uCenter.value.set(center.x, 0, center.z - 6);
    renderer.getDrawingBufferSize(this.size);
    u.uScale.value =
      this.size.y / (2 * Math.tan(T.MathUtils.degToRad(camera.fov) / 2));
  }
}
