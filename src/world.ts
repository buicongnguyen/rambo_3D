import { WEAPONS } from "./arsenal";
import { surface, grassGeometry } from "./surfaces";
import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { COVER, MISSIONS, PATCHES, buildLayout, type Box } from "./missions";
const templates = new Map<string, T.Group>();
const names = [
  "commando",
  "rifleman",
  "captive",
  "palm",
  "rock",
  "crate",
  "tent",
  "tower",
  "tank",
  "gunship",
  "barge",
  "motorcycle",
  "jeep",
  "snowPine",
  "house",
  "fuelDrum",
  "spider",
  "laserTank",
  ...WEAPONS.map((w) => "weapon_" + w.id),
  "projectile_rocket",
  "projectile_arrow",
  "projectile_grenade",
];
export async function loadAssets(progress: (n: number) => void) {
  let done = 0;
  await Promise.all(
    names.map(async (name) => {
      const g = await new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}models/${name}.glb`,
      );
      g.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      // Batch rigid geometry inside each joint, never across animated pivots.
      {
        const joints: T.Object3D[] = [g.scene];
        g.scene.traverse((o) => {
          if (o.userData.joint) joints.push(o);
        });
        for (const joint of joints) {
          const groups = new Map<string, T.Mesh[]>();
          for (const child of joint.children) {
            if (
              child instanceof T.Mesh &&
              !Array.isArray(child.material) &&
              child.children.length === 0
            ) {
              const key =
                child.material.uuid +
                Boolean(child.geometry.index) +
                Object.keys(child.geometry.attributes).sort().join();
              const list = groups.get(key) ?? [];
              list.push(child);
              groups.set(key, list);
            }
          }
          for (const parts of groups.values()) {
            const material = parts[0].material;
            if (parts.length < 2) continue;
            const geometries = parts.map((part) => {
              part.updateMatrix();
              return part.geometry.clone().applyMatrix4(part.matrix);
            });
            const geometry = mergeGeometries(geometries);
            for (const item of geometries) item.dispose();
            if (!geometry) continue;
            for (const part of parts) joint.remove(part);
            const mesh = new T.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            joint.add(mesh);
          }
        }
      }
      templates.set(name, g.scene);
      progress(++done / names.length);
    }),
  );
}
export function model(name: string, x = 0, z = 0, scale = 1) {
  const original = templates.get(name);
  if (!original) throw new Error(`Missing model: ${name}`);
  const g = original.clone(true);
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}
export class World {
  scene = new T.Scene();
  lowDetail = false;
  private missionIndex = 0;
  private soilMap = surface("soil");
  private roadMap = surface("road");
  private waterMap = surface("water");
  private wind = { value: 0 };
  camera = new T.PerspectiveCamera(43, 1, 0.1, 230);
  renderer: T.WebGLRenderer;
  terrain = new T.Group();
  actors = new T.Group();
  decor: T.Object3D[] = [];
  destructibles: { box: Box; mesh: T.Group; hp: number; kind: string }[] = [];
  sun: T.DirectionalLight;
  marker: T.Mesh;
  exit: T.Mesh;
  water?: T.Mesh;
  private ownedGeometries: T.BufferGeometry[] = [];
  private ownedMaterials: T.Material[] = [];
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const pmrem = new T.PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(studio, 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    studio.dispose();
    pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xdfeddf, 0x384332, 1.3));
    this.sun = new T.DirectionalLight(0xffe3b0, 3.4);
    this.sun.position.set(-20, 35, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      near: 0.5,
      far: 100,
    });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.terrain, this.actors);
    this.marker = new T.Mesh(
      new T.TorusGeometry(1.3, 0.07, 6, 40),
      new T.MeshBasicMaterial({ color: 0xe4f39a }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.exit = new T.Mesh(
      new T.RingGeometry(2.2, 2.35, 48),
      new T.MeshBasicMaterial({ color: 0xa4f1d4, side: T.DoubleSide }),
    );
    this.exit.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker, this.exit);
    this.camera.position.set(35, 42, 48);
    this.camera.lookAt(0, 0, 0);
    this.resize();
  }
  mat(color: number, extra: T.MeshStandardMaterialParameters = {}) {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
    this.ownedMaterials.push(m);
    return m;
  }
  mesh(g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) {
    this.ownedGeometries.push(g);
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    this.terrain.add(o);
    return o;
  }
  groundHeight(_x: number, _z: number) {
    return 0;
  }
  build(index: number) {
    this.missionIndex = index;
    this.terrain.clear();
    this.actors.clear();
    this.destructibles = [];
    this.decor = [];
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedGeometries = [];
    this.ownedMaterials = [];
    this.water = undefined;
    const mission = MISSIONS[index],
      biome = mission.biome;
    buildLayout(mission);
    this.scene.background = new T.Color(mission.fog);
    this.scene.fog = new T.FogExp2(mission.fog, 0.009);
    this.soilMap.repeat.set(18, 42);
    this.roadMap.repeat.set(2, 42);
    const soil = this.mat(mission.ground, {
      map: this.soilMap,
      bumpMap: this.soilMap,
      bumpScale: 0.09,
    });
    this.mesh(new T.BoxGeometry(66, 1.6, 152), soil, 0, -0.85, -43);
    this.mesh(
      new T.PlaneGeometry(260, 330),
      this.mat(mission.ground),
      0,
      -1.68,
      -43,
    ).rotation.x = -Math.PI / 2;
    const road = this.mat(
      biome === "city" ? 0x383e42 : biome === "ice" ? 0xa2bdc9 : 0x91836a,
      { map: this.roadMap, bumpMap: this.roadMap, bumpScale: 0.035 },
    );
    this.mesh(new T.PlaneGeometry(7, 144), road, 0, 0.005, -43).rotation.x =
      -Math.PI / 2;
    for (const z of [1, -39, -79])
      this.mesh(new T.PlaneGeometry(56, 4.5), road, 0, 0.01, z).rotation.x =
        -Math.PI / 2;
    if (biome === "city")
      for (const x of [-16, 16])
        this.mesh(new T.PlaneGeometry(5, 135), road, x, 0.008, -43).rotation.x =
          -Math.PI / 2;
    const line = this.mat(biome === "ice" ? 0xeef6f8 : 0xbab88a);
    for (let z = -111; z < 27; z += 6)
      this.mesh(new T.BoxGeometry(0.13, 0.025, 1.7), line, 0.1, 0.035, z);
    for (const patch of PATCHES) {
      const color =
        patch.kind === "ice"
          ? 0x8cc8df
          : patch.kind === "sand"
            ? 0x9b793d
            : 0x283e30;
      const mat = this.mat(color, {
        metalness: patch.kind === "ice" ? 0.35 : 0.12,
        roughness: patch.kind === "sand" ? 1 : 0.15,
        bumpMap: this.waterMap,
        bumpScale: 0.1,
      });
      const water = this.mesh(
        new T.CircleGeometry(patch.radius, 32),
        mat,
        patch.x,
        0.045,
        patch.z,
      );
      water.rotation.x = -Math.PI / 2;
      if (patch.kind === "mud") this.water = water;
      if (patch.kind === "sand")
        for (let ring = 0; ring < 3; ring++) {
          const rim = this.mesh(
            new T.RingGeometry(
              patch.radius * (0.3 + ring * 0.22),
              patch.radius * (0.31 + ring * 0.22),
              32,
            ),
            this.mat(0xc9a364),
            patch.x,
            0.05,
            patch.z,
          );
          rim.rotation.x = -Math.PI / 2;
        }
    }
    for (const box of COVER) {
      if (
        box.kind === "tree" ||
        box.kind === "snowTree" ||
        box.kind === "fuel"
      ) {
        const mesh = model(
          box.kind === "tree"
            ? "palm"
            : box.kind === "snowTree"
              ? "snowPine"
              : "fuelDrum",
          box.x,
          box.z,
          box.kind === "tree" ? 1.2 : 1,
        );
        this.actors.add(mesh);
        this.destructibles.push({ box, mesh, hp: box.hp!, kind: box.kind });
      } else if (box.kind === "building") {
        const house = model("house", box.x, box.z);
        house.scale.set(box.w / 5, 1 + (index % 3) * 0.15, box.d / 7);
        this.terrain.add(house);
      } else if (box.w === 4) this.terrain.add(model("tent", box.x, box.z));
      else if (box.d === 3) this.terrain.add(model("tower", box.x, box.z));
      else
        for (const x of [-0.8, 0.8])
          this.terrain.add(model("crate", box.x + x, box.z, 1.1));
    }
    let seed = 19 + mission.stage * 13 + mission.level * 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 180; i++) {
      const x = (rand() - 0.5) * 88,
        z = 28 - rand() * 150;
      // Interior trees have real, destructible collision; these dress the boundaries.
      if (Math.abs(x) < 29) continue;
      const name =
        biome === "ice"
          ? "snowPine"
          : ["sand", "volcano", "quake", "city"].includes(biome)
            ? "rock"
            : "palm";
      const g = model(name, x, z, 0.75 + rand() * 1.1);
      g.rotation.y = rand() * 6.28;
      g.traverse((o) => (o.userData.highDetail = i % 3 !== 0));
      this.terrain.add(g);
    }
    const grass = this.mat(biome === "ice" ? 0xe8f3f4 : 0x657644, {
      side: T.DoubleSide,
    });
    grass.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = this.wind;
      shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n transformed.x += sin(windTime*1.4+position.x*2.0+position.z)*0.045*max(0.0,position.y);",
      );
    };
    for (let i = 0; i < 850; i++) {
      const x = (rand() - 0.5) * 58,
        z = 27 - rand() * 138;
      if (
        Math.abs(x) < 4 ||
        COVER.some(
          (b) =>
            Math.abs(x - b.x) < b.w / 2 + 0.4 &&
            Math.abs(z - b.z) < b.d / 2 + 0.4,
        )
      )
        continue;
      const tuft = this.mesh(grassGeometry(), grass, x, 0.02, z);
      tuft.userData.highDetail = true;
      tuft.scale.setScalar(0.7 + rand() * 0.8);
    }
    for (let i = 0; i < 14; i++) {
      const hill = this.mesh(
        new T.IcosahedronGeometry(1, 1),
        soil,
        (i % 2 ? 1 : -1) * (52 + rand() * 15),
        4,
        25 - i * 11,
      );
      hill.scale.set(14, 10 + rand() * 15, 16);
      hill.userData.highDetail = i % 2 === 0;
    }
    if (biome === "volcano") {
      const lava = this.mat(0xdd3f10, {
        emissive: 0xf54b12,
        emissiveIntensity: 1.4,
      });
      this.mesh(new T.ConeGeometry(15, 24, 20), soil, 38, 9, -66);
      this.mesh(new T.CylinderGeometry(5, 3, 1, 20), lava, 38, 21, -66);
      for (let i = 0; i < 7; i++)
        this.mesh(
          new T.BoxGeometry(1.3, 0.06, 7),
          lava,
          27,
          0.05,
          5 - i * 17,
        ).rotation.y = 0.3;
    }
    if (biome === "quake")
      for (let i = 0; i < 16; i++) {
        const crack = this.mesh(
          new T.BoxGeometry(0.13, 0.025, 5),
          this.mat(0x332d28),
          i % 2 ? 18 : -18,
          0.06,
          16 - i * 8,
        );
        crack.rotation.y = ((i % 3) - 1) * 0.4;
      }
    this.marker.position.set(mission.objective.x, 0.15, mission.objective.z);
    this.marker.visible = true;
    this.exit.position.set(mission.extract.x, 0.12, mission.extract.z);
    this.exit.visible = false;
    this.terrain.add(model("crate", mission.objective.x, mission.objective.z));
    this.mesh(
      new T.BoxGeometry(0.8, 0.55, 0.1),
      this.mat(0x80e5d1, { emissive: 0x3dcbb2, emissiveIntensity: 0.9 }),
      mission.objective.x,
      1.55,
      mission.objective.z + 0.5,
    );
    this.mesh(
      new T.CylinderGeometry(3.5, 3.5, 0.09, 48),
      this.mat(0x4b5e51),
      mission.extract.x,
      0.01,
      mission.extract.z,
    );
    for (const x of [-1, 1])
      this.mesh(
        new T.BoxGeometry(0.16, 0.03, 2),
        line,
        mission.extract.x + x,
        0.075,
        mission.extract.z,
      );
    this.mesh(
      new T.BoxGeometry(2, 0.03, 0.16),
      line,
      mission.extract.x,
      0.075,
      mission.extract.z,
    );
    this.batchTerrain();
    this.quality(this.lowDetail);
  }
  batchTerrain() {
    this.terrain.updateMatrixWorld(true);
    const batches = new Map<
      string,
      {
        material: T.Material;
        geometries: T.BufferGeometry[];
        highDetail: boolean;
      }
    >();
    this.terrain.traverse((o) => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
      const key =
        o.material.uuid +
        Boolean(o.geometry.index) +
        Object.keys(o.geometry.attributes).sort().join() +
        Boolean(o.userData.highDetail);
      let batch = batches.get(key);
      if (!batch) {
        batch = {
          material: o.material,
          geometries: [],
          highDetail: Boolean(o.userData.highDetail),
        };
        batches.set(key, batch);
      }
      batch.geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    });
    this.terrain.clear();
    for (const batch of batches.values()) {
      const geometry = mergeGeometries(batch.geometries);
      for (const g of batch.geometries) g.dispose();
      if (!geometry) throw new Error("Static terrain batch failed");
      this.ownedGeometries.push(geometry);
      const mesh = new T.Mesh(geometry, batch.material);
      mesh.userData.highDetail = batch.highDetail;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.terrain.add(mesh);
    }
  }
  quality(low: boolean) {
    this.lowDetail = low;
    this.terrain.traverse((o) => {
      if (o.userData.highDetail) o.visible = !low;
    });
    this.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(m instanceof T.MeshStandardMaterial)) continue;
        if (m.bumpMap && !m.userData.detailBump)
          m.userData.detailBump = m.bumpMap;
        const map = low ? null : (m.userData.detailBump ?? m.bumpMap);
        if (m.bumpMap !== map) {
          m.bumpMap = map;
          m.needsUpdate = true;
        }
      }
    });
    this.renderer.shadowMap.enabled = !low;

    this.resize();
  }
  resize() {
    this.renderer.setPixelRatio(
      this.lowDetail
        ? Math.min(
            devicePixelRatio,
            1,
            1280 / Math.max(innerWidth, innerHeight),
          )
        : Math.min(devicePixelRatio, 1.6),
    );
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
  render(time: number, focus: T.Vector3, menu: boolean, reduced: boolean) {
    for (const actor of this.actors.children)
      if (actor.userData.lowRange)
        actor.visible =
          !this.lowDetail ||
          Math.hypot(actor.position.x - focus.x, actor.position.z - focus.z) <
            actor.userData.lowRange;
    this.wind.value = reduced || this.lowDetail ? 0 : time;
    this.waterMap.offset.set(
      reduced || this.lowDetail ? 0 : time * 0.012,
      reduced ? 0 : time * 0.006,
    );
    const target = menu ? new T.Vector3(6, 0, 1) : focus;
    const desired = menu
      ? new T.Vector3(40 + (reduced ? 0 : Math.sin(time * 0.07) * 2), 43, 51)
      : new T.Vector3(focus.x, focus.y + 27, focus.z + 25);
    this.camera.position.lerp(desired, menu ? 0.025 : 0.09);
    this.camera.lookAt(target);
    this.sun.position.set(target.x - 20, 35, target.z + 12);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
    this.marker.rotation.z = time * 0.6;
    this.marker.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    this.exit.rotation.z = -time * 0.12;
    this.renderer.render(this.scene, this.camera);
  }
}
