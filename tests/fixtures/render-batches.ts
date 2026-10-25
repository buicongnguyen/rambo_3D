import * as T from "three";
import { ActorBatches, batchColorVariant } from "../../src/batching";
import { SpriteActors } from "../../src/sprites";
const check = (value: boolean, message: string) => {
  if (!value) throw new Error(message);
};
export function checkColorBatches() {
  const scene = new T.Group(),
    camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 6, 15);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const geometry = new T.BoxGeometry(),
    texture = new T.Texture();
  const base = new T.MeshStandardMaterial({
    color: 0x91743d,
    roughness: 0.73,
    metalness: 0.21,
    map: texture,
  });
  const actor = (x: number, material: T.MeshStandardMaterial) => {
    const root = new T.Group(),
      joint = new T.Group(),
      part = new T.Mesh(geometry, material);
    root.position.x = x;
    root.userData.batchActor = true;
    part.castShadow = part.receiveShadow = true;
    joint.add(part);
    root.add(joint);
    scene.add(root);
    return { root, joint, part };
  };
  const a = actor(-2, base),
    batcher = new ActorBatches(scene);
  const visible = () =>
    scene.children.filter(
      (o) => o instanceof T.InstancedMesh && o.visible,
    ) as T.InstancedMesh[];
  batcher.update(camera);
  // Registration after the base was already cached must still consolidate it.
  const variant = batchColorVariant(base, 0xbe4425),
    b = actor(2, variant);
  batcher.update(camera);
  let draws = visible();
  check(
    draws.length === 1 && draws[0].count === 2,
    "Colour variants did not share one draw",
  );
  const shared = draws[0].material as T.MeshStandardMaterial;
  check(
    shared !== base && shared.color.getHex() === 0xffffff,
    "Instancing changed the source material",
  );
  check(
    shared.map === texture &&
      shared.roughness === base.roughness &&
      shared.metalness === base.metalness,
    "Surface finish changed",
  );
  const color = new T.Color();
  draws[0].getColorAt(0, color);
  check(Math.abs(color.r - base.color.r) < 1e-6, "Base tint changed");
  draws[0].getColorAt(1, color);
  check(
    Math.abs(color.r - variant.color.r) < 1e-6 &&
      Math.abs(color.g - variant.color.g) < 1e-6,
    "Variant tint changed",
  );
  a.joint.rotation.z = 0.4;
  a.part.position.y = 1;
  batcher.update(camera);
  const matrix = new T.Matrix4();
  draws[0].getMatrixAt(0, matrix);
  check(
    matrix.elements.every(
      (n, i) => Math.abs(n - a.part.matrixWorld.elements[i]) < 1e-6,
    ),
    "Joint animation was lost",
  );
  b.part.receiveShadow = false;
  batcher.update(camera);
  check(visible().length === 2, "Different shadow receivers shared a batch");
  b.part.receiveShadow = true;
  batcher.update(camera);
  check(
    visible().length === 1,
    "Shadow receiver change did not update the key",
  );
  b.root.visible = false;
  batcher.update(camera);
  check(
    visible()[0].count === 1 && !a.part.visible && !b.part.visible,
    "Hidden originals rendered twice",
  );
  b.root.visible = true;
  const faded = variant.clone();
  faded.userData.batchBase = variant.uuid;
  faded.opacity = 0.5;
  faded.transparent = true;
  b.part.material = faded;
  batcher.update(camera);
  draws = visible();
  const fadeDraw = draws.find(
    (m) => (m.material as T.Material).userData.batchBase,
  )!;
  check(
    draws.length === 2 && !!fadeDraw && !fadeDraw.instanceColor,
    "Fade mixed into an opaque tint batch",
  );
  check(
    (fadeDraw.material as T.MeshStandardMaterial).color.equals(variant.color) &&
      (fadeDraw.material as T.Material).opacity === 0.5,
    "Fade lost colour or opacity",
  );
  faded.opacity = 0.3;
  batcher.update(camera);
  check(
    visible().some((m) => (m.material as T.Material).opacity === 0.25),
    "Fade bucket stopped updating",
  );
  b.root.removeFromParent();
  batcher.update(camera);
  check(
    b.part.visible && visible().length === 1,
    "Removed actor remained in a draw batch",
  );
  let disposed = 0,
    sharedDisposed = 0;
  shared.addEventListener("dispose", () => sharedDisposed++);
  const buffers = scene.children.filter((o) => o instanceof T.InstancedMesh);
  buffers.forEach((mesh) => mesh.addEventListener("dispose", () => disposed++));
  batcher.clear();
  check(
    disposed === buffers.length && sharedDisposed === 0 && a.part.visible,
    "Clear leaked buffers or disposed shared material",
  );
  batcher.update(camera);
  check(
    visible()[0].material === shared,
    "Mission rebuild recompiled the shared tint material",
  );
  batcher.clear();
  base.dispose();
  variant.dispose();
  faded.dispose();
  geometry.dispose();
  texture.dispose();
  return true;
}
export async function checkSpriteGrowth() {
  const scene = new T.Scene(),
    actors = new T.Group(),
    camera = new T.PerspectiveCamera();
  scene.add(actors);
  const sprites = new SpriteActors(actors);
  await sprites.load("/");
  const sheet = (sprites as any).sheets.get("rifleman"),
    old = sheet.mesh;
  let meshDisposed = 0,
    geometryDisposed = 0;
  old.addEventListener("dispose", () => meshDisposed++);
  old.geometry.addEventListener("dispose", () => geometryDisposed++);
  for (let i = 0; i < old.instanceMatrix.count + 1; i++) {
    const root = new T.Group();
    root.userData.model = "rifleman";
    actors.add(root);
  }
  sprites.update(camera, 1 / 60);
  sprites.restore();
  check(
    meshDisposed === 1 && geometryDisposed === 1 && old.parent === null,
    "Sprite growth leaked the old GPU buffers",
  );
  check(
    sheet.mesh.count === actors.children.length &&
      actors.children.every((o) => o.visible),
    "Sprite growth lost actors or their visibility",
  );
  return true;
}
