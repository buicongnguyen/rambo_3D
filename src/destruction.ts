import * as T from "three";
import { COVER } from "./missions";
import { WORLD_BOUNDS } from "./campaign.mjs";
import { moveCircle } from "./rules.mjs";

type Fragment = {
  root: T.Object3D;
  velocity: T.Vector3;
  spin: T.Vector3;
  materials: T.Material[];
  radius: number;
  age: number;
  life: number;
  ground: boolean;
};
/** Cosmetic fragments have a strict budget and never deal collision damage. */
export class DestructionEffects {
  fragments: Fragment[] = [];
  private chip = new T.IcosahedronGeometry(0.15, 0);
  private wood = new T.BoxGeometry(0.12, 0.35, 0.12);
  private stain = new T.CircleGeometry(1, 9);
  constructor(
    private scene: T.Group,
    private groundHeight: (x: number, z: number) => number,
  ) {}
  private remove(f: Fragment) {
    f.root.removeFromParent();
    f.materials.forEach((m) => m.dispose());
    this.fragments.splice(this.fragments.indexOf(f), 1);
  }
  private add(
    root: T.Object3D,
    velocity: T.Vector3,
    materials: T.Material[],
    low: boolean,
    radius = 0.12,
    ground = false,
  ) {
    while (this.fragments.length >= (low ? 64 : 144))
      this.remove(this.fragments[0]);
    root.userData.lowRange = 44;
    this.scene.add(root);
    this.fragments.push({
      root,
      velocity,
      materials,
      radius,
      ground,
      age: 0,
      life: 4,
      spin: ground ? new T.Vector3() : new T.Vector3(2.4, 1.7, 2.9),
    });
  }
  blood(x: number, z: number, dx: number, dz: number, low: boolean) {
    for (let i = 0; i < (low ? 3 : 5); i++) {
      const material = new T.MeshBasicMaterial({
        color: 0x951d2c,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: T.DoubleSide,
      });
      const mesh = new T.Mesh(this.stain, material);
      const a = i * 2.4,
        d = 0.2 + i * 0.09;
      mesh.position.set(x + Math.sin(a) * d, 0, z + Math.cos(a) * d);
      mesh.position.y =
        this.groundHeight(mesh.position.x, mesh.position.z) + 0.018;
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = a;
      mesh.scale.set(0.12 + i * 0.025, 0.2 + i * 0.02, 1);
      this.add(mesh, new T.Vector3(), [material], low, 0.1, true);
    }
    for (let i = 0; i < 2; i++) {
      const material = new T.MeshBasicMaterial({
        color: 0xa92735,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new T.Mesh(this.chip, material);
      mesh.scale.setScalar(0.25);
      mesh.position.set(x, this.groundHeight(x, z) + 0.8, z);
      this.add(
        mesh,
        new T.Vector3(dx * 2 + i * 0.3, 1.6 + i * 0.3, dz * 2 - i * 0.3),
        [material],
        low,
      );
    }
  }
  masonry(x: number, z: number, low: boolean) {
    for (let i = 0; i < (low ? 5 : 10); i++) {
      const material = new T.MeshBasicMaterial({
        color: i % 2 ? 0x8e8777 : 0xb5a58b,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new T.Mesh(this.chip, material);
      mesh.scale.set(1.5 + (i % 3), 1.2, 1.4);
      mesh.position.set(x, this.groundHeight(x, z) + 1 + (i % 3) * 0.3, z);
      const a = i * 2.4;
      this.add(
        mesh,
        new T.Vector3(Math.sin(a) * 2.8, 2 + (i % 3), Math.cos(a) * 2.8),
        [material],
        low,
      );
    }
  }
  tree(x: number, z: number, low: boolean) {
    for (let i = 0; i < (low ? 7 : 13); i++) {
      const wood = i % 4 === 0;
      const material = new T.MeshBasicMaterial({
        color: wood ? 0x896039 : i % 2 ? 0x63a63a : 0x2f702b,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new T.Mesh(wood ? this.wood : this.chip, material);
      mesh.scale.setScalar(wood ? 1.8 : 1 + (i % 3) * 0.3);
      mesh.position.set(x, this.groundHeight(x, z) + 1.2 + (i % 3) * 0.4, z);
      const a = i * 2.4;
      this.add(
        mesh,
        new T.Vector3(Math.sin(a) * 3.2, 2.2 + (i % 3), Math.cos(a) * 3.2),
        [material],
        low,
      );
    }
  }
  vehicle(root: T.Group, low: boolean) {
    root.updateMatrixWorld(true);
    const parts: { mesh: T.Mesh; volume: number }[] = [];
    root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      o.geometry.computeBoundingBox();
      const size = o.geometry.boundingBox!.getSize(new T.Vector3());
      parts.push({ mesh: o, volume: size.x * size.y * size.z });
    });
    parts.sort((a, b) => b.volume - a.volume);
    for (const { mesh } of parts.slice(0, low ? 6 : 10)) {
      const center = mesh.geometry.boundingBox!.getCenter(new T.Vector3());
      const rootPart = new T.Group(),
        copy = mesh.clone(false);
      const materials = (
        Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      ).map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.depthWrite = false;
        return c;
      });
      copy.visible = true;
      copy.material = Array.isArray(mesh.material) ? materials : materials[0];
      copy.position.copy(center).negate();
      copy.quaternion.identity();
      copy.scale.setScalar(1);
      rootPart.add(copy);
      mesh.matrixWorld.decompose(
        rootPart.position,
        rootPart.quaternion,
        rootPart.scale,
      );
      rootPart.position.copy(center.applyMatrix4(mesh.matrixWorld));
      const index = parts.findIndex((p) => p.mesh === mesh),
        a = index * 2.4;
      const size = new T.Box3()
        .setFromObject(rootPart)
        .getSize(new T.Vector3());
      this.add(
        rootPart,
        new T.Vector3(
          Math.sin(a) * (3 + (index % 3)),
          5 + (index % 4),
          Math.cos(a) * (3 + (index % 3)),
        ),
        materials,
        low,
        Math.min(1.5, Math.max(0.2, Math.max(size.x, size.z) * 0.35)),
      );
    }
    root.removeFromParent();
  }
  update(dt: number) {
    for (const f of [...this.fragments]) {
      f.age += dt;
      if (f.age >= f.life) {
        this.remove(f);
        continue;
      }
      if (!f.ground) {
        const p = f.root.position;
        const moved = moveCircle(
          p.x,
          p.z,
          f.velocity.x * dt,
          f.velocity.z * dt,
          f.radius,
          COVER,
          WORLD_BOUNDS,
        );
        if (Math.abs(moved.x - p.x) < Math.abs(f.velocity.x * dt) * 0.5)
          f.velocity.x = 0;
        if (Math.abs(moved.z - p.z) < Math.abs(f.velocity.z * dt) * 0.5)
          f.velocity.z = 0;
        p.x = moved.x;
        p.z = moved.z;
        f.velocity.y -= dt * 12;
        p.y += f.velocity.y * dt;
        const floor = this.groundHeight(p.x, p.z) + 0.08;
        if (p.y <= floor) {
          p.y = floor;
          f.root.updateMatrixWorld(true);
          const bottom = new T.Box3().setFromObject(f.root).min.y;
          p.y += Math.max(0, floor - bottom);
          f.velocity.set(0, 0, 0);
          f.spin.set(0, 0, 0);
          f.ground = true;
        }
        f.root.rotation.x += f.spin.x * dt;
        f.root.rotation.y += f.spin.y * dt;
        f.root.rotation.z += f.spin.z * dt;
      }
      const opacity = Math.min(1, (f.life - f.age) / 1.6);
      for (const material of f.materials)
        material.opacity =
          opacity *
          (f.root instanceof T.Mesh && f.root.geometry === this.stain
            ? 0.7
            : 1);
    }
  }
  clear() {
    for (const f of [...this.fragments]) this.remove(f);
  }
}
