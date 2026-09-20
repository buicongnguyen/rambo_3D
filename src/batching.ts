import * as T from "three";
/** Draw repeated Blender parts together while retaining each actor's animated hierarchy. */
export class ActorBatches {
  private sources = new Map<T.Object3D, T.Mesh[]>();
  private batches = new Map<string, T.InstancedMesh>();
  private groups = new Map<
    string,
    { source: T.Mesh | undefined; matrices: T.Matrix4[] }
  >();
  private keys = new WeakMap<
    T.Mesh,
    {
      geometry: T.BufferGeometry;
      material: T.Material | T.Material[];
      shadow: boolean;
      key: string;
    }
  >();
  private frustum = new T.Frustum();
  private projection = new T.Matrix4();
  private sphere = new T.Sphere();
  constructor(private scene: T.Group) {}
  update(camera: T.Camera) {
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    const groups = this.groups;
    for (const group of groups.values()) {
      group.matrices.length = 0;
      group.source = undefined;
    }
    for (const [root, parts] of this.sources)
      if (root.parent !== this.scene || !root.userData.batchActor) {
        parts.forEach((p) => (p.visible = true));
        this.sources.delete(root);
      }
    for (const root of this.scene.children) {
      if (!root.userData.batchActor) continue;
      let parts = this.sources.get(root);
      if (!parts) {
        parts = [];
        root.traverse((o) => {
          if (o instanceof T.Mesh) {
            parts!.push(o);
            o.visible = false;
          }
        });
        this.sources.set(root, parts);
      }
      // Death animation may restore a source mesh before its fade batch is refreshed.
      // Always suppress the originals so they cannot render twice.
      for (const part of parts) part.visible = false;
      this.sphere.center.copy(root.position);
      this.sphere.center.y += 1.5;
      this.sphere.radius = root.userData.batchRadius ?? 3;
      if (!root.visible || !this.frustum.intersectsSphere(this.sphere))
        continue;
      root.updateMatrixWorld(true);
      for (const part of parts) {
        const materials = Array.isArray(part.material)
          ? part.material
          : [part.material];
        const fading = materials.some((m) => !!m.userData.batchBase);
        let cached = this.keys.get(part);
        if (
          fading ||
          !cached ||
          cached.geometry !== part.geometry ||
          cached.material !== part.material ||
          cached.shadow !== part.castShadow
        ) {
          const material = materials
            .map((m) =>
              m.userData.batchBase
                ? m.userData.batchBase + ":fade" + Math.round(m.opacity * 8)
                : m.uuid,
            )
            .join(",");
          cached = {
            geometry: part.geometry,
            material: part.material,
            shadow: part.castShadow,
            key: part.geometry.uuid + ":" + material + ":" + part.castShadow,
          };
          this.keys.set(part, cached);
        }
        const key = cached.key;
        let group = groups.get(key);
        if (!group) {
          group = { source: part, matrices: [] };
          groups.set(key, group);
        }
        group.source = part;
        group.matrices.push(part.matrixWorld);
      }
    }
    for (const mesh of this.batches.values()) {
      mesh.count = 0;
      mesh.visible = false;
    }
    for (const [key, { source, matrices }] of groups) {
      if (!source || !matrices.length) continue;
      let mesh = this.batches.get(key);
      if (!mesh || mesh.instanceMatrix.count < matrices.length) {
        if (mesh) this.disposeBatch(mesh);
        const copyFade = (m: T.Material) => {
          if (!m.userData.batchBase) return m;
          const copy = m.clone();
          copy.opacity = Math.round(m.opacity * 8) / 8;
          return copy;
        };
        mesh = new T.InstancedMesh(
          source.geometry,
          Array.isArray(source.material)
            ? source.material.map(copyFade)
            : copyFade(source.material),
          Math.max(32, 2 ** Math.ceil(Math.log2(matrices.length))),
        );
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = source.castShadow;
        mesh.receiveShadow = source.receiveShadow;
        this.batches.set(key, mesh);
      }
      if (mesh.parent !== this.scene) this.scene.add(mesh);
      mesh.visible = true;
      mesh.count = matrices.length;
      matrices.forEach((matrix, i) => mesh!.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  private disposeBatch(mesh: T.InstancedMesh) {
    mesh.removeFromParent();
    mesh.dispose();
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material])
      if (material.userData.batchBase) material.dispose();
  }
  clear() {
    for (const parts of this.sources.values())
      parts.forEach((p) => (p.visible = true));
    this.sources.clear();
    this.groups.clear();
    this.keys = new WeakMap();
    for (const mesh of this.batches.values()) {
      this.disposeBatch(mesh);
    }
    this.batches.clear();
  }
}
