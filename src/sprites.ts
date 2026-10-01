import * as T from "three";

/**
 * 2.5D renderer for phones: every actor with a baked sprite sheet (see
 * art/bake_sprites.py) is drawn as one camera-facing quad instead of its 3D
 * rig. One InstancedMesh per sheet plus one for ground shadows replaces
 * dozens of part batches, and hidden rigs skip their matrix updates entirely.
 * The simulation keeps using the real rigs (joints, muzzles), so gameplay is
 * identical in both renderers.
 */
type Entry = {
  file: string;
  cell: number;
  frames: number;
  dirs: number;
  size: number;
  centre: number;
};
type Sheet = {
  entry: Entry;
  mesh: T.InstancedMesh;
  uv: T.InstancedBufferAttribute;
  fade: T.InstancedBufferAttribute;
  count: number;
  /** Pushes the quad toward the camera so its lower edge clears the ground. */
  lift: number;
};
type Track = { x: number; z: number; stride: number };

const VERTEX = /* glsl */ `
attribute vec4 aUv;
attribute float aFade;
varying vec2 vUv;
varying float vFade;
void main() {
  vUv = aUv.xy + uv * aUv.zw;
  vFade = aFade;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying float vFade;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  // Dithered fade keeps sprites in the opaque pass (no sorting) while bodies fade.
  if (vFade < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > vFade) discard;
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
/** The game camera's view direction from target to eye (it never rotates). */
const TO_CAMERA = new T.Vector3(0, 27, 25).normalize();
const CAPACITY = 64;

export class SpriteActors {
  ready = false;
  loading?: Promise<void>;
  private sheets = new Map<string, Sheet>();
  private tracks = new WeakMap<T.Object3D, Track>();
  private hidden: T.Object3D[] = [];
  private shadow!: T.InstancedMesh;
  private shadowCount = 0;
  private quad = new T.PlaneGeometry(1, 1);
  private m = new T.Matrix4();
  private q = new T.Quaternion();
  private v = new T.Vector3();
  private s = new T.Vector3();
  private e = new T.Euler();
  /** Actors drawn as sprites in the last frame (for tests and the perf HUD). */
  drawn = 0;
  constructor(private actors: T.Group) {}

  load(base: string) {
    this.loading ??= (async () => {
      const manifest: Record<string, Entry> = await (
        await fetch(`${base}sprites/manifest.json`)
      ).json();
      const loader = new T.TextureLoader();
      await Promise.all(
        Object.entries(manifest).map(async ([key, entry]) => {
          const map = await loader.loadAsync(`${base}sprites/${entry.file}`);
          map.colorSpace = T.SRGBColorSpace;
          map.generateMipmaps = false;
          map.minFilter = map.magFilter = T.LinearFilter;
          const material = new T.ShaderMaterial({
            uniforms: { map: { value: map } },
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
          });
          this.sheets.set(key, this.makeSheet(entry, material, CAPACITY));
        }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const g = canvas.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(0,0,0,0.45)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.shadow = new T.InstancedMesh(
        new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new T.MeshBasicMaterial({
          map: new T.CanvasTexture(canvas),
          transparent: true,
          depthWrite: false,
        }),
        512,
      );
      this.shadow.frustumCulled = false;
      this.shadow.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.ready = true;
    })();
    return this.loading;
  }

  private makeSheet(
    entry: Entry,
    material: T.ShaderMaterial,
    capacity: number,
  ) {
    const mesh = new T.InstancedMesh(this.quad, material, capacity);
    const uv = new T.InstancedBufferAttribute(
      new Float32Array(capacity * 4),
      4,
    );
    const fade = new T.InstancedBufferAttribute(new Float32Array(capacity), 1);
    uv.setUsage(T.DynamicDrawUsage);
    fade.setUsage(T.DynamicDrawUsage);
    mesh.geometry = this.quad.clone();
    mesh.geometry.setAttribute("aUv", uv);
    mesh.geometry.setAttribute("aFade", fade);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    // The quad faces the camera from its centre: lift it toward the camera
    // until its lower edge is above the ground it stands on.
    // The lower edge sits 0.68 * size/2 below the centre (camera up is about
    // (0, 0.68, -0.73)); each metre toward the camera raises it 0.73 m.
    const below = 0.68 * (entry.size / 2) - entry.centre;
    const lift = below > 0 ? below / TO_CAMERA.y + 0.1 : 0;
    return { entry, mesh, uv, fade, count: 0, lift };
  }

  private grow(sheet: Sheet) {
    const old = sheet.mesh;
    const next = this.makeSheet(
      sheet.entry,
      old.material as T.ShaderMaterial,
      old.instanceMatrix.count * 2,
    );
    old.removeFromParent();
    old.geometry.dispose();
    sheet.mesh = next.mesh;
    sheet.uv = next.uv;
    sheet.fade = next.fade;
  }

  /** The sheet that draws this actor, if any (model name plus livery/role). */
  key(root: T.Object3D) {
    const model = root.userData.model as string | undefined;
    if (!model) return undefined;
    const variant = root.userData.variant as string | undefined;
    const key = variant ? `${model}:${variant}` : model;
    return this.sheets.has(key) ? key : undefined;
  }

  /**
   * Before rendering: draw sprite actors as quads and hide their rigs. Call
   * restore() after rendering so game logic sees the rigs' real visibility.
   */
  update(camera: T.Camera, dt: number) {
    for (const sheet of this.sheets.values()) sheet.count = 0;
    this.shadowCount = 0;
    this.drawn = 0;
    camera.getWorldQuaternion(this.q);
    for (const root of this.actors.children) {
      if (!root.visible) continue;
      const key = this.key(root);
      if (!key) continue;
      const sheet = this.sheets.get(key)!;
      if (sheet.count >= sheet.mesh.instanceMatrix.count) this.grow(sheet);
      const { entry } = sheet;
      const scale = root.scale.x;
      // Direction: the actor's yaw in eighths (the camera never rotates).
      this.e.setFromQuaternion(root.quaternion, "YXZ");
      const dir =
        ((Math.round(this.e.y / ((Math.PI * 2) / entry.dirs)) % entry.dirs) +
          entry.dirs) %
        entry.dirs;
      // Frame: fallen, walking (stride by distance) or idle.
      let frame = 0;
      const fade =
        root.userData.fallen === true
          ? ((root.userData.fade as number) ?? 1)
          : 1;
      if (entry.frames > 1) {
        let track = this.tracks.get(root);
        if (!track) {
          track = { x: root.position.x, z: root.position.z, stride: 0 };
          this.tracks.set(root, track);
        }
        const moved = Math.hypot(
          root.position.x - track.x,
          root.position.z - track.z,
        );
        track.x = root.position.x;
        track.z = root.position.z;
        if (root.userData.fallen) frame = entry.frames - 1;
        else if (moved > 0.25 * Math.max(dt, 1 / 120)) {
          track.stride += moved;
          frame = 1 + (Math.floor(track.stride / 0.55) % 2);
        }
      }
      const i = sheet.count++;
      this.v
        .copy(root.position)
        .addScaledVector(TO_CAMERA, sheet.lift * scale).y +=
        entry.centre * scale;
      this.s.setScalar(entry.size * scale);
      this.m.compose(this.v, this.q, this.s);
      sheet.mesh.setMatrixAt(i, this.m);
      sheet.uv.setXYZW(
        i,
        dir / entry.dirs,
        1 - (frame + 1) / entry.frames,
        1 / entry.dirs,
        1 / entry.frames,
      );
      sheet.fade.setX(i, fade);
      if (fade > 0.5 && this.shadowCount < this.shadow.instanceMatrix.count) {
        const r = (entry.frames > 1 ? 1.1 : entry.size * 0.42) * scale;
        this.m.makeScale(r, 1, r * 0.7);
        this.m.setPosition(
          root.position.x,
          root.position.y + 0.04,
          root.position.z,
        );
        this.shadow.setMatrixAt(this.shadowCount++, this.m);
      }
      // Hide the rig for this frame (restored after rendering).
      root.visible = false;
      this.hidden.push(root);
      this.drawn++;
    }
    for (const sheet of this.sheets.values()) {
      const { mesh } = sheet;
      if (mesh.parent !== this.actors.parent) this.actors.parent?.add(mesh);
      mesh.count = sheet.count;
      mesh.visible = sheet.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      sheet.uv.needsUpdate = true;
      sheet.fade.needsUpdate = true;
    }
    if (this.shadow.parent !== this.actors.parent)
      this.actors.parent?.add(this.shadow);
    this.shadow.count = this.shadowCount;
    this.shadow.visible = this.shadowCount > 0;
    this.shadow.instanceMatrix.needsUpdate = true;
  }

  /** Give the rigs back their real visibility after the frame is drawn. */
  restore() {
    for (const root of this.hidden) root.visible = true;
    this.hidden.length = 0;
  }

  /** Leave 2.5D mode: remove every quad from the scene. */
  hide() {
    this.restore();
    for (const sheet of this.sheets.values()) sheet.mesh.visible = false;
    if (this.shadow) this.shadow.visible = false;
  }
}
