import * as T from "three";

type Burst = {
  group: T.Group;
  glow: T.Sprite;
  core: T.Sprite;
  ring: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  sparks: T.Sprite[];
  smoke: T.Sprite[];
  age: number;
  life: number;
  radius: number;
  kind: string;
  blast: boolean;
};

/** Reusable billboard bursts: no new geometry, textures or lights per impact. */
export class ImpactEffects {
  private bursts: Burst[] = [];
  private texture: T.CanvasTexture;
  private fireTexture: T.CanvasTexture;
  private ringGeometry = new T.RingGeometry(0.85, 1, 32);
  constructor(private scene: T.Group) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,255,255,.95)");
    gradient.addColorStop(0.45, "rgba(255,255,255,.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    this.texture = new T.CanvasTexture(canvas);
    const fire = document.createElement("canvas");
    fire.width = fire.height = 128;
    const paint = fire.getContext("2d")!;
    const flame = (x: number, y: number, radius: number) => {
      const g = paint.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, "rgba(255,250,180,1)");
      g.addColorStop(0.22, "rgba(255,203,65,1)");
      g.addColorStop(0.5, "rgba(248,100,16,.95)");
      g.addColorStop(0.76, "rgba(164,43,8,.75)");
      g.addColorStop(1, "rgba(75,25,10,0)");
      paint.fillStyle = g;
      paint.beginPath();
      paint.arc(x, y, radius, 0, Math.PI * 2);
      paint.fill();
    };
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9;
      flame(
        64 + Math.cos(a) * (23 + (i % 3) * 5),
        64 + Math.sin(a) * (23 + (i % 3) * 5),
        23 + (i % 2) * 8,
      );
    }
    flame(64, 64, 35);
    this.fireTexture = new T.CanvasTexture(fire);
    this.fireTexture.colorSpace = T.SRGBColorSpace;
  }
  get activeCount() {
    return this.bursts.filter((b) => b.group.visible).length;
  }
  get capacity() {
    return this.bursts.length;
  }
  private makeBurst() {
    const group = new T.Group();
    const sprite = (additive = true) => {
      const s = new T.Sprite(
        new T.SpriteMaterial({
          map: this.texture,
          transparent: true,
          depthWrite: false,
          blending: additive ? T.AdditiveBlending : T.NormalBlending,
          toneMapped: false,
        }),
      );
      group.add(s);
      return s;
    };
    const glow = sprite(),
      core = sprite();
    const ring = new T.Mesh(
      this.ringGeometry,
      new T.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        side: T.DoubleSide,
        toneMapped: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const burst: Burst = {
      group,
      glow,
      core,
      ring,
      sparks: Array.from({ length: 6 }, () => sprite()),
      smoke: Array.from({ length: 3 }, () => sprite(false)),
      age: 0,
      life: 0,
      radius: 1,
      kind: "tracer",
      blast: false,
    };
    group.visible = false;
    this.scene.add(group);
    this.bursts.push(burst);
    return burst;
  }
  emit(
    x: number,
    y: number,
    z: number,
    kind: string,
    low: boolean,
    radius = 0.8,
    blast = false,
  ) {
    // Shotgun pellets and sustained flames share one readable flash per nearby contact.
    if (
      this.bursts.some(
        (b) =>
          b.group.visible &&
          b.age < 0.065 &&
          b.kind === kind &&
          b.blast === blast &&
          (b.group.position.x - x) ** 2 +
            (b.group.position.y - y) ** 2 +
            (b.group.position.z - z) ** 2 <
            0.5,
      )
    )
      return;
    const limit = low ? 12 : 28;
    while (this.activeCount >= limit) {
      const oldest = this.bursts
        .filter((b) => b.group.visible)
        .sort((a, b) => b.age - a.age)[0];
      oldest.group.visible = false;
    }
    const b = this.bursts.find((b) => !b.group.visible) ?? this.makeBurst();
    if (b.group.parent !== this.scene) this.scene.add(b.group);
    b.age = 0;
    b.life = blast || kind === "leaf" ? 1.15 : 0.65;
    b.radius = radius;
    b.kind = kind;
    b.blast = blast;
    b.group.position.set(x, y, z);
    b.group.visible = true;
    const color =
      kind === "laser"
        ? 0x65eaff
        : kind === "gas" || kind === "leaf"
          ? 0x9be747
          : kind === "flame"
            ? 0xff681c
            : 0xffb336;
    b.glow.material.color.setHex(color);
    const fiery = (blast && kind !== "gas") || kind === "flame";
    b.core.material.map = fiery ? this.fireTexture : this.texture;
    b.core.material.blending = T.NormalBlending;
    b.core.material.color.setHex(fiery ? 0xffffff : color);
    b.ring.material.color.setHex(color);
    b.sparks.forEach((s, i) => {
      s.visible = i < (low ? 3 : 6);
      s.material.color.setHex(color);
    });
    b.smoke.forEach((s, i) => {
      s.visible = i < (low ? 1 : 3);
      s.material.color.setHex(
        kind === "leaf" ? 0x40862c : kind === "gas" ? 0x779541 : 0x655f56,
      );
    });
    this.pose(b);
  }
  private pose(b: Burst) {
    const t = b.age,
      r = b.radius;
    const flash = Math.max(0, 1 - t / (b.blast ? 0.38 : 0.22));
    b.core.scale.setScalar(r * (0.7 + t * 3.8));
    b.core.material.opacity = flash * (b.kind === "leaf" ? 0.15 : 1);
    b.glow.scale.setScalar(r * (1.25 + t * 4));
    b.glow.material.opacity = flash * (b.kind === "leaf" ? 0.04 : 0.45);
    b.ring.scale.setScalar(r * (0.35 + t * 1.5));
    b.ring.material.opacity =
      Math.max(0, 1 - t / 0.42) * (b.kind === "leaf" ? 0 : 0.65);
    for (let i = 0; i < b.sparks.length; i++) {
      const a = (i * Math.PI * 2) / b.sparks.length + 0.3;
      const speed = r * (2.3 + (i % 2) * 1.2);
      const s = b.sparks[i];
      s.position.set(
        Math.cos(a) * t * speed,
        t * (1.4 + i * 0.2) - 3 * t * t,
        Math.sin(a) * t * speed,
      );
      s.scale.set(r * 0.075, r * 0.4 * Math.max(0.3, 1 - t), 1);
      s.material.rotation = -a;
      s.material.opacity = Math.max(0, 1 - t / 0.5);
    }
    for (let i = 0; i < b.smoke.length; i++) {
      const a = i * 2.4;
      const s = b.smoke[i];
      s.position.set(
        Math.cos(a) * t * r * 0.6,
        t * (0.8 + i * 0.2),
        Math.sin(a) * t * r * 0.6,
      );
      s.scale.setScalar(r * (0.65 + t * 1.9));
      s.material.opacity = Math.min(0.5, t * 4) * Math.max(0, 1 - t / b.life);
    }
  }
  update(dt: number) {
    for (const b of this.bursts)
      if (b.group.visible) {
        b.age += dt;
        if (b.age >= b.life) b.group.visible = false;
        else this.pose(b);
      }
  }
  clear() {
    for (const b of this.bursts) b.group.visible = false;
  }
}
