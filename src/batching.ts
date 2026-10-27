import * as T from "three";
import { stagingComponents, commitComponents } from "./render-work";
// Only variants made here share a draw: every property except colour is identical.
const tintBases = new WeakMap<T.Material, T.MeshStandardMaterial>();
const tintMaterials = new WeakMap<T.Material, T.MeshStandardMaterial>();
export function batchColorVariant(base: T.MeshStandardMaterial, color: number) {
  const variant = base.clone();
  variant.onBeforeCompile = base.onBeforeCompile;
  variant.customProgramCacheKey = base.customProgramCacheKey;
  variant.color.setHex(color);
  tintBases.set(base, base);
  tintBases.set(variant, base);
  return variant;
}
function tintMaterial(base: T.MeshStandardMaterial) {
  let material = tintMaterials.get(base);
  if (!material) {
    material = base.clone();
    material.onBeforeCompile = base.onBeforeCompile;
    material.customProgramCacheKey = base.customProgramCacheKey;
    material.color.setHex(0xffffff);
    material.name = base.name + " (instance colours)";
    tintMaterials.set(base, material);
  }
  return material;
}

/** Draw repeated Blender parts together while retaining each actor's animated hierarchy. */
export class ActorBatches {
  private sources = new Map<T.Object3D, T.Mesh[]>();
  private batches = new Map<string, T.InstancedMesh>();
  private groups = new Map<
    string,
    {
      source: T.Mesh | undefined;
      matrices: T.Matrix4[];
      colors?: T.Color[];
      tint?: T.MeshStandardMaterial;
    }
  >();
  private keys = new WeakMap<
    T.Mesh,
    {
      geometry: T.BufferGeometry;
      material: T.Material | T.Material[];
      shadow: boolean;
      receiveShadow: boolean;
      tint?: T.MeshStandardMaterial;
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
      if (group.colors) group.colors.length = 0;
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
        // Fades keep their existing opacity buckets and owned materials.
        const tint =
          !fading && !Array.isArray(part.material)
            ? tintBases.get(part.material)
            : undefined;
        let cached = this.keys.get(part);
        if (
          fading ||
          !cached ||
          cached.geometry !== part.geometry ||
          cached.material !== part.material ||
          cached.shadow !== part.castShadow ||
          cached.receiveShadow !== part.receiveShadow ||
          cached.tint !== tint
        ) {
          const material = materials
            .map((m) =>
              m.userData.batchBase
                ? m.userData.batchBase + ":fade" + Math.round(m.opacity * 8)
                : tint
                  ? "tint:" + tint.uuid
                  : m.uuid,
            )
            .join(",");
          cached = {
            geometry: part.geometry,
            material: part.material,
            shadow: part.castShadow,
            receiveShadow: part.receiveShadow,
            tint,
            key:
              part.geometry.uuid +
              ":" +
              material +
              ":" +
              part.castShadow +
              ":" +
              part.receiveShadow,
          };
          this.keys.set(part, cached);
        }
        const key = cached.key;
        let group = groups.get(key);
        if (!group) {
          group = {
            source: part,
            matrices: [],
            tint,
            colors: tint ? [] : undefined,
          };
          groups.set(key, group);
        }
        group.source = part;
        group.matrices.push(part.matrixWorld);
        group.colors?.push((part.material as T.MeshStandardMaterial).color);
      }
    }
    for (const mesh of this.batches.values()) {
      mesh.count = 0;
      mesh.visible = false;
    }
    for (const [key, { source, matrices, colors, tint }] of groups) {
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
          tint
            ? tintMaterial(tint)
            : Array.isArray(source.material)
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
      const matrixData = stagingComponents(mesh.instanceMatrix);
      matrices.forEach((matrix, i) => matrix.toArray(matrixData, i * 16));
      commitComponents(mesh.instanceMatrix, matrixData, matrices.length * 16);
      if (colors) {
        if (!mesh.instanceColor)
          mesh.instanceColor = new T.InstancedBufferAttribute(
            new Float32Array(mesh.instanceMatrix.count * 3),
            3,
          ).setUsage(T.DynamicDrawUsage);
        const colorData = stagingComponents(mesh.instanceColor);
        colors.forEach((color, i) => color.toArray(colorData, i * 3));
        commitComponents(mesh.instanceColor, colorData, colors.length * 3);
      }
    }
  }
  private disposeBatch(mesh: T.InstancedMesh) {
    mesh.removeFromParent();
    mesh.dispose();
    // Shared prefab/tint materials outlive mission rebuilds; fade copies do not.
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
