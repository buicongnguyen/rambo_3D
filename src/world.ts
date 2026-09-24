import { followAxis } from "./camera-follow.mjs";
import { ActorBatches } from "./batching";
import { WORLD_BOUNDS } from "./campaign.mjs";
import { sampleRoute, routeLength } from "./routes.mjs";
import { segmentBox } from "./rules.mjs";
import { WEAPONS } from "./arsenal";
import { surface, grassGeometry, groundPaint, GROUND_PAINT } from "./surfaces";
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
  "relayHouse",
  "prisonHouse",
  "money",
  "gold",
  "diamond",
  "ruinWall",
  "fuelDrum",
  "spider",
  "laserTank",
  "quadMech",
  "rocketMech",
  "missileTruck",
  ...WEAPONS.map((w) => "weapon_" + w.id),
  "projectile_rocket",
  "projectile_arrow",
  "projectile_grenade",
  "weapon_knife",
  "weapon_sword",
  "projectile_knife",
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
/** Rotate asymmetric cover with the collision layout, including paired crates. */
export function coverModel(box: Box, layout: number) {
  const root = new T.Group(),
    parts = new T.Group();
  if (box.asset === "tent" || box.asset === "tower")
    parts.add(model(box.asset));
  else for (const x of [-0.8, 0.8]) parts.add(model("crate", x, 0, 1.1));
  const bounds = new T.Box3().setFromObject(parts),
    size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const width = box.originalW ?? box.w,
    depth = box.originalD ?? box.d;
  box.height ??= size.y; // Match grenade clearance to the actual Blender asset.
  parts.scale.set(
    width / size.x,
    box.height ? box.height / size.y : 1,
    depth / size.z,
  );
  parts.position.set(
    -center.x * parts.scale.x,
    -bounds.min.y * parts.scale.y,
    -center.z * parts.scale.z,
  );
  root.add(parts);
  root.position.set(box.x, 0, box.z);
  root.rotation.y = -([0, Math.PI / 2, Math.PI / 4, Math.PI][layout] ?? 0);
  return root;
}

/** Blender rock silhouettes share the exact ground footprint used for collision. */
export function landformModel(box: Box, material: T.Material) {
  const root = new T.Group(),
    rock = model("rock");
  rock.rotation.y = (box.x * 1.73 + box.z * 0.37) % (Math.PI * 2);
  const bounds = new T.Box3().setFromObject(rock),
    size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const height =
    Math.min(box.w, box.d) *
    (box.kind === "basalt" ? 0.58 : 0.44) *
    (0.82 + Math.abs(Math.sin(box.x + box.z)) * 0.18);
  const wrapper = new T.Group();
  wrapper.add(rock);
  wrapper.scale.set(box.w / size.x, height / size.y, box.d / size.z);
  wrapper.position.set(
    -center.x * wrapper.scale.x,
    -bounds.min.y * wrapper.scale.y,
    -center.z * wrapper.scale.z,
  );
  rock.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.material = material;
      o.userData.highDetail = false;
    }
  });
  root.add(wrapper);
  // A low bedrock plinth joins neighboring outcrops without invisible ground gaps.
  const base = new T.Mesh(new T.BoxGeometry(box.w, 0.08, box.d), material);
  base.position.y = -0.065;
  base.castShadow = base.receiveShadow = true;
  root.add(base);
  root.position.set(box.x, 0, box.z);
  return root;
}

export class World {
  scene = new T.Scene();
  lowDetail = false;
  private missionIndex = 0;
  private explosiveLabel = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#e2ad22";
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#241b13";
    c.font = "bold 37px sans-serif";
    c.textAlign = "center";
    c.fillText("EXPLOSIVE", 128, 51);
    c.font = "bold 45px sans-serif";
    c.fillText("TNT", 128, 107);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  })();
  /** Camera trauma (0..1) from Feel; zero with reduced motion. */
  shake = 0;
  /** Player ring scale: 1 on foot, larger around an occupied vehicle. */
  indicatorScale = 1;
  /** Guide arrow target: `point` is where to head now, `goal` the objective. */
  guide: {
    point: { x: number; z: number };
    goal: { x: number; z: number };
    kind: string;
  } | null = null;
  goalArrow = new T.Group();
  private arrowParts: T.Mesh<T.ShapeGeometry, T.MeshBasicMaterial>[] = [];
  private arrowAngle = 0;
  private arrowKind = "";
  private soilMap = surface("soil");
  private groundTexture?: T.Texture;
  private roadMap = surface("road");
  private waterMap = surface("water");
  private wind = { value: 0 };
  private followTarget = new T.Vector3();
  private renderTime: number | undefined;
  private wasMenu = true;
  playerIndicator = new T.Group();
  /**
   * Portrait phones see far less to the sides than landscape screens: pull the
   * gameplay camera back so riflemen (7-11 m) and rocketeers stay in view.
   */
  private viewReach() {
    return this.camera.aspect < 1
      ? Math.min(1.5, 0.85 / this.camera.aspect)
      : 1;
  }
  resetCamera(focus: T.Vector3) {
    this.followTarget.set(focus.x, 0, focus.z);
    const reach = this.viewReach();
    this.camera.position.set(focus.x, 27 * reach, focus.z + 25 * reach);
    this.camera.lookAt(this.followTarget);
    this.wasMenu = false;
  }
  camera = new T.PerspectiveCamera(43, 1, 0.1, 230);
  renderer: T.WebGLRenderer;
  terrain = new T.Group();
  actors = new T.Group();
  private actorBatches = new ActorBatches(this.actors);
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
    // Khronos PBR Neutral keeps the painted Blender colours saturated and on-hue;
    // ACES/AgX desaturated the stylized palette.
    this.renderer.toneMapping = T.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    const pmrem = new T.PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(studio, 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    studio.dispose();
    pmrem.dispose();
    // Cool sky fill and warm bounce under a warm key: the hand-painted light rig.
    this.scene.add(new T.HemisphereLight(0xd6ecff, 0x6b5436, 1.25));
    this.sun = new T.DirectionalLight(0xffdca8, 3.0);
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
    for (const [inner, outer, color] of [
      [0.83, 1.13, 0x10232c],
      [0.91, 1.05, 0x38ecff],
    ]) {
      const ring = new T.Mesh(
        new T.RingGeometry(inner, outer, 40),
        // Depth-tested so the soldier (or vehicle) stands on the ring, not under it.
        new T.MeshBasicMaterial({
          color,
          side: T.DoubleSide,
          depthWrite: false,
          transparent: true,
          opacity: 0.95,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = color === 0x38ecff ? 2 : 1;
      this.playerIndicator.add(ring);
    }
    // A chevron orbiting the player ring points toward the next goal.
    const chevron = new T.Shape();
    chevron.moveTo(0, 0.5);
    chevron.lineTo(0.46, -0.3);
    chevron.lineTo(0, -0.08);
    chevron.lineTo(-0.46, -0.3);
    chevron.closePath();
    for (const [scale, color, order] of [
      [1.95, 0x10232c, 3],
      [1.5, 0xffd84a, 4],
    ] as const) {
      const arrow = new T.Mesh(
        new T.ShapeGeometry(chevron),
        new T.MeshBasicMaterial({
          color,
          side: T.DoubleSide,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 0.96,
          toneMapped: false,
        }),
      );
      arrow.rotation.x = -Math.PI / 2;
      arrow.scale.setScalar(scale);
      arrow.renderOrder = order;
      this.arrowParts.push(arrow);
      this.goalArrow.add(arrow);
    }
    this.goalArrow.name = "goal-guide-arrow";
    this.goalArrow.visible = false;
    this.scene.add(this.goalArrow);
    this.playerIndicator.name = "player-identity-ring";
    this.playerIndicator.visible = false;
    this.scene.add(this.playerIndicator);
    this.camera.position.set(35, 42, 48);
    this.camera.lookAt(0, 0, 0);
    this.resize();
  }
  private explosiveCrate(box: Box) {
    const root = new T.Group(),
      crate = model("crate");
    const bounds = new T.Box3().setFromObject(crate),
      size = bounds.getSize(new T.Vector3());
    crate.scale.set(box.w / size.x, 0.7 / size.y, box.d / size.z);
    crate.position.y = -bounds.min.y * crate.scale.y;
    root.add(crate);
    root.position.set(box.x, 0, box.z);
    const red = this.mat(0x9e271e),
      warning = this.mat(0xffffff, {
        map: this.explosiveLabel,
        roughness: 0.85,
      });
    root.add(
      this.mesh(
        new T.BoxGeometry(box.w + 0.015, 0.17, box.d + 0.015),
        red,
        0,
        0.56,
        0,
      ),
    );
    for (const side of [-1, 1]) {
      const sign = this.mesh(
        new T.PlaneGeometry(box.w * 0.94, 0.38),
        warning,
        0,
        0.31,
        side * (box.d / 2 + 0.012),
      );
      sign.rotation.y = side === 1 ? 0 : Math.PI;
      root.add(sign);
    }
    return root;
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
  private rescueFloors: Box[] = [];
  groundHeight(x: number, z: number) {
    return this.rescueFloors.some(
      (b) => Math.abs(x - b.x) < 2.05 && Math.abs(z - b.z) < 2.05,
    )
      ? 0.24
      : 0;
  }
  build(index: number) {
    this.missionIndex = index;
    this.actorBatches.clear();
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
    this.rescueFloors = COVER.filter((b) => b.kind === "prison");
    this.scene.background = new T.Color(mission.fog);
    this.scene.fog = new T.FogExp2(mission.fog, 0.006);
    const width = WORLD_BOUNDS.x * 2,
      depth = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
    const centerZ = (WORLD_BOUNDS.maxZ + WORLD_BOUNDS.minZ) / 2;
    this.soilMap.repeat.set(width / 3.5, depth / 3.5);
    this.roadMap.repeat.set(2, 42);
    const soil = this.mat(mission.ground, {
      map: this.soilMap,
      bumpMap: this.soilMap,
      bumpScale: 0.09,
    });
    const palette = GROUND_PAINT[biome] ?? GROUND_PAINT.jungle;
    this.groundTexture?.dispose();
    this.groundTexture = groundPaint(
      biome,
      mission.ground,
      width + 9,
      depth + 9,
    );
    this.mesh(
      new T.BoxGeometry(width + 9, 1.6, depth + 9),
      this.mat(0xffffff, {
        map: this.groundTexture,
        bumpMap: this.soilMap,
        bumpScale: 0.09,
      }),
      0,
      -0.85,
      centerZ,
    );
    this.mesh(
      new T.PlaneGeometry(260, 330),
      this.mat(mission.ground),
      0,
      -1.68,
      -43,
    ).rotation.x = -Math.PI / 2;
    const road = this.mat(palette.road, {
      map: this.roadMap,
      bumpMap: this.roadMap,
      bumpScale: 0.035,
    });
    const roadSegments = [
      ...mission.roads.flatMap((route) =>
        route.slice(1).map((p, i) => [route[i], p]),
      ),
    ];
    for (const [a, b] of roadSegments) {
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const strip = this.mesh(
        new T.BoxGeometry(7, 0.015, Math.hypot(dx, dz)),
        road,
        (a.x + b.x) / 2,
        0.009,
        (a.z + b.z) / 2,
      );
      strip.rotation.y = Math.atan2(dx, dz);
    }
    for (const p of mission.roads.flat())
      this.mesh(
        new T.CylinderGeometry(3.5, 3.5, 0.018, 24),
        road,
        p.x,
        0.01,
        p.z,
      );
    const line = this.mat(biome === "ice" ? 0xeef6f8 : 0xbab88a);
    for (const route of mission.roads) {
      const length = routeLength(route);
      for (let d = 3; d < length; d += 6) {
        const p = sampleRoute(route, d / length);
        const stripe = this.mesh(
          new T.BoxGeometry(0.13, 0.025, 1.7),
          line,
          p.x,
          0.035,
          p.z,
        );
        stripe.rotation.y = Math.atan2(p.nz, -p.nx);
      }
    }
    const concrete = this.mat(0x969c98, {
      map: this.soilMap,
      bumpMap: this.soilMap,
      bumpScale: 0.04,
    });
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
    const bedrock = this.mat(
      biome === "volcano" ? 0x49413b : biome === "ice" ? 0xa7b7bf : 0x65634f,
      {
        map: this.soilMap,
        bumpMap: this.soilMap,
        bumpScale: 0.13,
        roughness: 1,
      },
    );
    for (const box of COVER) {
      if (box.kind === "hill" || box.kind === "basalt") {
        const landform = landformModel(box, bedrock);
        this.ownedGeometries.push((landform.children[1] as T.Mesh).geometry);
        this.terrain.add(landform);
      } else if (box.asset === "ruinWall") {
        const mesh = model("ruinWall", box.x, box.z);
        const horizontal = box.w >= box.d;
        mesh.scale.set(
          (horizontal ? box.w : box.d) / 4,
          (box.height ?? 2.4) / 2.4,
          (horizontal ? box.d : box.w) / 0.45,
        );
        mesh.rotation.y = horizontal ? 0 : Math.PI / 2;
        mesh.userData.lowRange = 58;
        mesh.userData.batchActor = true;
        mesh.userData.batchRadius = Math.max(box.w, box.d) / 2 + 2;
        this.actors.add(mesh);
        this.destructibles.push({ box, mesh, hp: box.hp!, kind: box.kind! });
      } else if (
        box.kind === "tree" ||
        box.kind === "snowTree" ||
        box.kind === "fuel" ||
        box.kind === "explosive"
      ) {
        const mesh =
          box.kind === "explosive"
            ? this.explosiveCrate(box)
            : model(
                box.kind === "tree"
                  ? "palm"
                  : box.kind === "snowTree"
                    ? "snowPine"
                    : "fuelDrum",
                box.x,
                box.z,
                box.scale ?? (box.kind === "tree" ? 1.2 : 1),
              );
        mesh.userData.lowRange = 52;
        mesh.userData.batchActor = true;
        mesh.userData.batchRadius = ["fuel", "explosive"].includes(box.kind)
          ? 2
          : 6;
        this.actors.add(mesh);
        this.destructibles.push({ box, mesh, hp: box.hp!, kind: box.kind });
      } else if (box.kind === "concrete" || box.kind === "boundary") {
        // The stripe is a solid band, not a second face laid on the wall.
        // Coplanar concrete/stripe sides caused flickering as the camera moved.
        for (const [bottom, top, material] of [
          [0, 1.16, concrete],
          [1.16, 1.28, line],
          [1.28, 1.35, concrete],
        ] as const)
          this.mesh(
            new T.BoxGeometry(box.w, top - bottom, box.d),
            material,
            box.x,
            (bottom + top) / 2,
            box.z,
          );
        this.mesh(
          new T.BoxGeometry(box.w + 0.12, 0.18, box.d + 0.12),
          concrete,
          box.x,
          0.09,
          box.z,
        );
        if (box.kind === "boundary") {
          const horizontal = box.w > box.d,
            length = horizontal ? box.w : box.d;
          for (let offset = -length / 2 + 4; offset < length / 2; offset += 8) {
            const seam = this.mesh(
              new T.BoxGeometry(
                horizontal ? 0.12 : box.w + 0.04,
                1.42,
                horizontal ? box.d + 0.04 : 0.12,
              ),
              concrete,
              box.x + (horizontal ? offset : 0),
              0.71,
              box.z + (horizontal ? 0 : offset),
            );
            seam.userData.boundary = true;
          }
        }
      } else if (box.kind === "building") {
        const house = model(
          box.asset === "relayHouse" ? "relayHouse" : "house",
          box.x,
          box.z,
        );
        if (box.asset === "relayHouse") house.rotation.y = box.rotation!;
        else house.scale.set(box.w / 5, 1 + (index % 3) * 0.15, box.d / 7);
        this.terrain.add(house);
      } else if (box.kind !== "prison")
        this.terrain.add(coverModel(box, mission.layout));
    }
    let seed = 19 + mission.stage * 13 + mission.level * 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 180; i++) {
      const x = (rand() - 0.5) * (width + 30),
        z = WORLD_BOUNDS.maxZ + 12 - rand() * (depth + 24);
      // Interior trees have real, destructible collision; these dress the boundaries.
      if (
        Math.abs(x) < WORLD_BOUNDS.x + 1 &&
        z > WORLD_BOUNDS.minZ - 1 &&
        z < WORLD_BOUNDS.maxZ + 1
      )
        continue;
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
    const grass = this.mat(palette.grass, {
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
      const x = (rand() - 0.5) * width,
        z = WORLD_BOUNDS.maxZ - rand() * depth;
      if (
        mission.roads.some((route) =>
          route
            .slice(1)
            .some(
              (p, i) =>
                segmentBox(
                  route[i].x,
                  route[i].z,
                  p.x,
                  p.z,
                  { x, z, w: 0.1, d: 0.1 },
                  3.7,
                ) !== Infinity,
            ),
        ) ||
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
        (i % 2 ? 1 : -1) * (WORLD_BOUNDS.x + 24 + rand() * 15),
        4,
        WORLD_BOUNDS.maxZ - (i * depth) / 14,
      );
      hill.scale.set(14, 10 + rand() * 15, 16);
      hill.userData.highDetail = i % 2 === 0;
    }
    if (biome === "volcano") {
      const lava = this.mat(0xdd3f10, {
        emissive: 0xf54b12,
        emissiveIntensity: 1.4,
      });
      this.mesh(
        new T.ConeGeometry(15, 24, 20),
        soil,
        WORLD_BOUNDS.x + 18,
        9,
        centerZ,
      );
      this.mesh(
        new T.CylinderGeometry(5, 3, 1, 20),
        lava,
        WORLD_BOUNDS.x + 18,
        21,
        centerZ,
      );
      for (let i = 0; i < 7; i++)
        this.mesh(
          new T.BoxGeometry(1.3, 0.06, 7),
          lava,
          WORLD_BOUNDS.x - 1,
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
    this.terrain.updateMatrixWorld(true);
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
  render(
    time: number,
    focus: T.Vector3,
    menu: boolean,
    reduced: boolean,
    alive = true,
  ) {
    for (const actor of this.actors.children)
      if (actor.userData.lowRange)
        actor.visible =
          Math.hypot(actor.position.x - focus.x, actor.position.z - focus.z) <
          Math.min(actor.userData.lowRange, this.lowDetail ? 34 : 48);
    this.wind.value = reduced || this.lowDetail ? 0 : time;
    this.waterMap.offset.set(
      reduced || this.lowDetail ? 0 : time * 0.012,
      reduced ? 0 : time * 0.006,
    );
    const dt =
      this.renderTime === undefined
        ? 1 / 60
        : Math.max(0, time - this.renderTime);
    this.renderTime = time;
    const menuFocus = sampleRoute(MISSIONS[this.missionIndex].route, 0.18);
    if (!menu && this.wasMenu) this.resetCamera(focus);
    if (!menu) {
      // Narrow portrait screens need a smaller horizontal dead zone.
      const horizontal = Math.min(4.5, Math.max(1.8, this.camera.aspect * 4));
      this.followTarget.x = followAxis(
        this.followTarget.x,
        focus.x,
        horizontal,
        dt,
      );
      this.followTarget.z = followAxis(this.followTarget.z, focus.z, 3.5, dt);
      const reach = this.viewReach();
      this.camera.position.set(
        this.followTarget.x,
        27 * reach,
        this.followTarget.z + 25 * reach,
      );
      this.camera.lookAt(this.followTarget);
      if (!reduced && this.shake > 0.001) {
        // Trauma-squared shake with layered sines: smooth, never a random jitter.
        const s = this.shake * this.shake,
          t = time * 38;
        this.camera.position.x +=
          (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 2.9 + 1.1)) * 0.42 * s;
        this.camera.position.z +=
          (Math.sin(t * 1.7 + 2.3) + 0.5 * Math.sin(t * 3.3)) * 0.42 * s;
        this.camera.position.y += Math.sin(t * 2.1 + 0.7) * 0.22 * s;
        this.camera.rotateZ(Math.sin(t * 1.9 + 4.2) * 0.012 * s);
      }
    } else {
      const target = new T.Vector3(menuFocus.x, 0, menuFocus.z);
      const desired = new T.Vector3(
        target.x + 34 + (reduced ? 0 : Math.sin(time * 0.07) * 2),
        43,
        target.z + 50,
      );
      this.camera.position.lerp(
        desired,
        1 - Math.exp(-1.5 * Math.min(dt, 0.1)),
      );
      this.camera.lookAt(target);
    }
    this.wasMenu = menu;
    const target = menu
      ? new T.Vector3(menuFocus.x, 0, menuFocus.z)
      : this.followTarget;
    this.sun.position.set(target.x - 20, 35, target.z + 12);
    this.sun.target.position.copy(target);
    this.playerIndicator.position.set(
      focus.x,
      this.groundHeight(focus.x, focus.z) + 0.07,
      focus.z,
    );
    this.playerIndicator.scale.setScalar(this.indicatorScale);
    const guide = this.guide;
    this.goalArrow.visible =
      !menu &&
      alive &&
      !!guide &&
      Math.hypot(guide.goal.x - focus.x, guide.goal.z - focus.z) > 4.5;
    if (guide && this.goalArrow.visible) {
      const target = Math.atan2(
        -(guide.point.x - focus.x),
        -(guide.point.z - focus.z),
      );
      // Ease the heading so road look-ahead switches never snap the arrow.
      const turn = Math.atan2(
        Math.sin(target - this.arrowAngle),
        Math.cos(target - this.arrowAngle),
      );
      this.arrowAngle +=
        this.arrowKind === guide.kind ? turn * (1 - Math.exp(-dt * 10)) : turn;
      if (this.arrowKind !== guide.kind) {
        this.arrowKind = guide.kind;
        this.arrowParts[1].material.color.setHex(
          guide.kind === "extract"
            ? 0x5df29a
            : guide.kind === "boss"
              ? 0xff4a3a
              : guide.kind === "guard"
                ? 0xff8a2f
                : 0xffd84a,
        );
      }
      const radius =
        1.13 * this.indicatorScale +
        1.15 +
        (reduced ? 0 : Math.sin(time * 5) * 0.12);
      this.goalArrow.position.set(
        focus.x,
        this.groundHeight(focus.x, focus.z) + 0.09,
        focus.z,
      );
      this.goalArrow.rotation.y = this.arrowAngle;
      for (const part of this.arrowParts) part.position.z = -radius;
    }
    this.playerIndicator.visible = !menu && alive;
    this.sun.target.updateMatrixWorld();
    this.marker.rotation.z = time * 0.6;
    this.marker.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    this.exit.rotation.z = -time * 0.12;
    this.camera.updateMatrixWorld();
    // Top-level groups have identity transforms; terrain was baked at build time.
    // Refresh visible dynamic objects, while the batcher handles visible source rigs.
    for (const object of this.scene.children)
      if (object !== this.terrain && object !== this.actors)
        object.updateMatrixWorld(true);
    for (const actor of this.actors.children)
      if (actor.visible && !actor.userData.batchActor)
        actor.updateMatrixWorld(true);
    this.actorBatches.update(this.camera);
    // The visible transforms above are already current. Suppress the renderer's
    // second full-scene traversal, then restore the normal Three.js contract.
    const autoUpdate = this.scene.matrixWorldAutoUpdate;
    this.scene.matrixWorldAutoUpdate = false;
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.scene.matrixWorldAutoUpdate = autoUpdate;
    }
  }
}
