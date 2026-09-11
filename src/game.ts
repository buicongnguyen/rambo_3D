import { BOSS_ATTACKS, placeSupplies } from "./encounters.mjs";
import { routePoint } from "./routes.mjs";
import { difficultyConfig, terrainFactor, WORLD_BOUNDS } from "./campaign.mjs";
import { WEAPONS, type WeaponSpec } from "./arsenal";
import { Ride } from "./rides";
import * as T from "three";
import { CharacterMotion, FallenBody, VehicleMotion } from "./animation";
import { World, model } from "./world";
import { MISSIONS, COVER, SPAWNS, PATCHES } from "./missions";
import { moveCircle, segmentBox, segmentCircle, routeStep } from "./rules.mjs";
export type Input = {
  x: number;
  z: number;
  fire: boolean;
  assist: boolean;
  aim: T.Vector3;
  dodge: boolean;
  reload: boolean;
  interact: boolean;
  swap: boolean;
};
export type Actor = {
  mesh: T.Group;
  hp: number;
  max: number;
  x: number;
  z: number;
  cool: number;
  radius: number;
  boss: boolean;
  bossKind?: string;
  guard?: boolean;
  state?: string;
  anchor?: { x: number; z: number };
  volleys?: number;
  laserAim?: number;
  beam?: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  index: number;
  warn: T.Mesh;
  reinforced?: boolean;
  motion?: CharacterMotion;
  vehicleMotion?: VehicleMotion;
  routeTime?: number;
  routeTarget?: { x: number; z: number };
};
type Hazard = {
  mesh: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  x: number;
  z: number;
  time: number;
  rock?: T.Group;
  bothSides?: boolean;
  radius?: number;
  damage?: number;
  owner?: Actor;
};
type Bullet = {
  mesh: T.Object3D;
  spec?: WeaponSpec;
  age: number;
  maxLife: number;
  hits: Set<Actor>;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
  enemy: boolean;
};
type Effect = {
  mesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  life: number;
  max: number;
  velocity?: T.Vector3;
  smoke?: boolean;
};
export class Game {
  world: World;
  player: T.Group;
  companion?: T.Group;
  playerMotion!: CharacterMotion;
  companionMotion?: CharacterMotion;
  corpses: FallenBody[] = [];
  private deathClock = 0;
  private dodgeVector = { x: 0, z: 0 };
  enemies: Actor[] = [];
  bullets: Bullet[] = [];
  effects: Effect[] = [];
  pickups: T.Object3D[] = [];
  shield = 0;
  readonly maxShield = 80;
  supplySeed = 0;
  hazards: Hazard[] = [];
  private followTarget = { x: 0, z: 0 };
  private followClock = 0;
  index = 0;
  hp = 150;
  maxHp = 150;
  ammo = 24;
  private magazines: number[] = WEAPONS.map((w) => w.mag);
  reserves: number[] = WEAPONS.map((w, i) => (i < 2 ? Infinity : w.mag * 3));
  inventory = [0, 1];
  rides: Ride[] = [];
  riding?: Ride;
  weaponDrops: { mesh: T.Group; index: number }[] = [];
  gas: { x: number; z: number; time: number; tick: number; mesh: T.Mesh }[] =
    [];
  private shownWeapon = -1;
  get weaponSpec() {
    return WEAPONS[this.weapon];
  }
  get nearestRide() {
    return this.rides.find(
      (v) =>
        v.hp > 0 &&
        Math.hypot(
          v.mesh.position.x - this.pos.x,
          v.mesh.position.z - this.pos.z,
        ) <
          v.spec.radius + 1.8,
    );
  }
  get interaction() {
    return this.riding
      ? "EXIT " + this.riding.spec.name
      : this.nearestRide
        ? "BOARD " + this.nearestRide.spec.name
        : "";
  }
  weapon = 0;
  reloadTime = 0;
  shotTime = 0;
  dashTime = 0;
  dashCooldown = 0;
  invincible = 0;
  elapsed = 0;
  kills = 0;
  score = 0;
  objective = false;
  bossSpawned = false;
  bossDead = false;
  phase: "playing" | "dying" | "won" | "lost" = "playing";
  power = 0;
  mobility = 0;
  difficulty = "normal";
  quakeTime = 0;
  private eventClock = 7;
  private quakeCount = 0;
  sink = 0;
  private iceVelocity = new T.Vector2();
  private guardIds = new Set<Actor>();
  onRadio: (text: string) => void = () => {};
  onSound: (type: string) => void = () => {};
  onEnd: (win: boolean) => void = () => {};
  private bulletGeo = new T.BoxGeometry(0.1, 0.1, 0.65);
  private bulletFriendly = new T.MeshBasicMaterial({ color: 0xf2f7b0 });
  private bulletEnemy = new T.MeshBasicMaterial({ color: 0xff8557 });
  private effectGeo = new T.IcosahedronGeometry(0.25, 0);
  private effectMat = new T.MeshBasicMaterial({
    color: 0xffbc70,
    transparent: true,
  });
  private supplyBadgeGeo = new T.BoxGeometry(0.65, 0.06, 0.65);
  private supplyCrossGeo = new T.BoxGeometry(0.14, 0.025, 0.48);
  private supplyMats = {
    health: new T.MeshStandardMaterial({
      color: 0x168a45,
      emissive: 0x0f5020,
      emissiveIntensity: 0.25,
    }),
    shield: new T.MeshStandardMaterial({
      color: 0x1581b9,
      emissive: 0x0b3860,
      emissiveIntensity: 0.25,
    }),
    weapon: new T.MeshStandardMaterial({
      color: 0x74449b,
      emissive: 0x352045,
      emissiveIntensity: 0.25,
    }),
  };
  private shieldGlyphGeo = new T.BufferGeometry().setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        -0.2, 0.22, 0, 0.2, 0.22, 0, 0.17, -0.1, 0, -0.2, 0.22, 0, 0.17, -0.1,
        0, 0, -0.25, 0, -0.2, 0.22, 0, 0, -0.25, 0, -0.17, -0.1, 0,
      ],
      3,
    ),
  );
  private insigniaMat = new T.MeshBasicMaterial({
    color: 0xf5fff8,
    side: T.DoubleSide,
  });
  private warnGeo = new T.RingGeometry(0.65, 0.74, 24);
  private warnMat = new T.MeshBasicMaterial({
    color: 0xf2a56e,
    side: T.DoubleSide,
  });
  constructor(world: World) {
    this.world = world;
    this.player = model("commando");
  }
  get mag() {
    return this.weaponSpec.mag;
  }
  get pos() {
    return this.player.position;
  }
  get boss() {
    return this.enemies.find((e) => e.boss && e.hp > 0);
  }
  start(
    index: number,
    save: { armor: number; power: number; mobility: number },
    difficulty: string,
  ) {
    this.cleanup();
    this.index = index;
    this.eventClock = 7;
    this.quakeTime = 0;
    this.quakeCount = 0;
    this.sink = 0;
    this.iceVelocity.set(0, 0);
    this.guardIds.clear();
    this.world.build(index);
    const mission = MISSIONS[index];
    this.player = model("commando", mission.start.x, mission.start.z);
    this.world.camera.position.set(mission.start.x, 27, mission.start.z + 25);
    this.world.camera.lookAt(this.player.position);
    this.playerMotion = new CharacterMotion(this.player);
    this.deathClock = 0;
    this.world.actors.add(this.player);
    this.difficulty = difficulty;
    this.power = save.power;
    this.mobility = save.mobility;
    this.maxHp = difficultyConfig(difficulty).health + save.armor * 35;
    this.hp = this.maxHp;
    this.shield = 0;
    this.ammo = 24;
    this.magazines = WEAPONS.map((w) => w.mag);
    this.reserves = WEAPONS.map((w, i) => (i < 2 ? Infinity : w.mag * 3));
    this.inventory = [0, 1];
    this.shownWeapon = -1;
    this.weapon = 0;
    this.reloadTime = 0;
    this.shotTime = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.invincible = 0;
    this.elapsed = 0;
    this.kills = 0;
    this.score = 0;
    this.objective = false;
    this.bossSpawned = false;
    this.bossDead = false;
    this.phase = "playing";
    const multiplier = difficultyConfig(difficulty).soldiers;
    SPAWNS.forEach(([x, z], i) => {
      for (let n = 0; n < multiplier; n++)
        this.spawn(
          x + (n % 2) * 1.5,
          z - Math.floor(n / 2) * 1.5,
          false,
          i * multiplier + n,
        );
    });
    this.rides = (
      [
        ["motorcycle", -4, 23],
        ["jeep", 7, 21],
        ["tank", -14, 21],
      ] as const
    ).map(([kind, x, z]) => {
      const p = routePoint(mission.layout, x, z);
      return new Ride(kind, p.x, p.z);
    });
    for (const v of this.rides) this.world.actors.add(v.mesh);
    this.supplySeed = crypto.getRandomValues(new Uint32Array(1))[0];
    const drops = placeSupplies(
      mission.route,
      [...COVER, ...this.rides.map((v) => v.box)],
      PATCHES,
      WORLD_BOUNDS,
      this.supplySeed,
    );
    for (const drop of drops) {
      const mesh = this.supplyCrate(
        drop.kind as "health" | "shield" | "weapon",
        drop.x,
        drop.z,
        drop.index,
      );
      if (drop.kind === "weapon")
        this.weaponDrops.push({ mesh, index: drop.index });
      else this.pickups.push(mesh);
    }
    this.showWeapon();
  }
  private supplyCrate(
    kind: "health" | "shield" | "weapon",
    x: number,
    z: number,
    index = -1,
  ) {
    const root = new T.Group();
    root.position.set(x, 0, z);
    root.userData.kind = kind;
    root.add(model("crate", 0, 0, 0.62));
    const badge = new T.Mesh(this.supplyBadgeGeo, this.supplyMats[kind]);
    badge.position.y = 0.82;
    root.add(badge);
    if (kind === "health") {
      for (const angle of [0, Math.PI / 2]) {
        const cross = new T.Mesh(this.supplyCrossGeo, this.insigniaMat);
        cross.position.y = 0.86;
        cross.rotation.y = angle;
        root.add(cross);
      }
    } else if (kind === "shield") {
      const glyph = new T.Mesh(this.shieldGlyphGeo, this.insigniaMat);
      glyph.position.y = 0.86;
      glyph.rotation.x = -Math.PI / 2;
      root.add(glyph);
    } else {
      const weapon = model("weapon_" + WEAPONS[index].id, 0, 0, 1.25);
      weapon.position.y = 1.05;
      weapon.rotation.z = Math.PI / 2;
      root.add(weapon);
    }
    this.world.actors.add(root);
    return root;
  }
  cleanup() {
    for (const corpse of this.corpses) corpse.dispose();
    this.corpses = [];
    this.companionMotion = undefined;
    this.riding = undefined;
    this.rides = [];
    this.weaponDrops = [];
    for (const cloud of this.gas) {
      cloud.mesh.geometry.dispose();
      (cloud.mesh.material as T.Material).dispose();
      this.world.actors.remove(cloud.mesh);
    }
    this.gas = [];
    for (const e of this.enemies)
      if (e.beam) {
        this.world.actors.remove(e.beam);
        e.beam.material.dispose();
      }
    for (const b of this.bullets) this.world.actors.remove(b.mesh);
    for (const e of this.effects) {
      e.mesh.material.dispose();
      this.world.actors.remove(e.mesh);
    }
    for (const h of this.hazards) {
      h.mesh.geometry.dispose();
      h.mesh.material.dispose();
      this.world.actors.remove(h.mesh);
      if (h.rock) this.world.actors.remove(h.rock);
    }
    this.hazards = [];
    this.followClock = 0;
    this.enemies = [];
    this.bullets = [];
    this.effects = [];
    this.pickups = [];
    this.companion = undefined;
  }
  spawn(x: number, z: number, boss: boolean, index: number) {
    if (!boss || MISSIONS[this.index].bossModel === "laserTank") {
      const clearance = boss ? 2.4 : 0.6;
      const obstacles = [
        ...COVER,
        ...this.rides.filter((v) => v.hp > 0).map((v) => v.box),
      ];
      const clear = (px: number, pz: number) =>
        Math.abs(px) < WORLD_BOUNDS.x - clearance &&
        pz > WORLD_BOUNDS.minZ + 2 &&
        pz < WORLD_BOUNDS.maxZ - 2 &&
        !obstacles.some(
          (b) => segmentBox(px, pz, px, pz, b, clearance) !== Infinity,
        );
      if (!clear(x, z)) {
        let found = false;
        for (let r = 1; r <= 6 && !found; r++)
          for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8,
              px = x + Math.sin(a) * r,
              pz = z + Math.cos(a) * r;
            if (clear(px, pz)) {
              x = px;
              z = pz;
              found = true;
              break;
            }
          }
        if (!found) return;
      }
    }
    const mesh = model(
      boss ? MISSIONS[this.index].bossModel : "rifleman",
      x,
      z,
      boss ? 0.83 : 1,
    );
    if (boss && MISSIONS[this.index].bossModel === "gunship")
      mesh.position.y = 4;
    mesh.userData.lowRange = 48;
    const max = boss
      ? 1100 + MISSIONS[this.index].stage * 100
      : 65 + MISSIONS[this.index].level * 8;
    const warn = new T.Mesh(this.warnGeo, this.warnMat);
    warn.rotation.x = -Math.PI / 2;
    warn.position.set(x, 0.07, z);
    this.world.actors.add(mesh, warn);
    this.enemies.push({
      mesh,
      motion: boss ? undefined : new CharacterMotion(mesh),
      vehicleMotion: boss
        ? new VehicleMotion(
            mesh,
            MISSIONS[this.index].bossModel === "laserTank"
              ? "tank"
              : MISSIONS[this.index].bossModel,
          )
        : undefined,
      x,
      z,
      hp: max,
      max,
      cool: 1.1 + (index % 8) * 0.22,
      bossKind: boss ? MISSIONS[this.index].bossModel : undefined,
      anchor: boss ? { x, z } : undefined,
      radius: boss ? 2.4 : 0.65,
      boss,
      index,
      warn,
    });
  }
  showWeapon() {
    if (this.riding?.kind === "motorcycle")
      this.riding.showWeapon(this.weaponSpec.id);
    if (this.shownWeapon === this.weapon) return;
    let grip: T.Object3D | undefined;
    this.player.traverse((o) => {
      if (o.userData.joint === "Weapon") grip = o;
    });
    if (grip) {
      grip.clear();
      grip.add(model("weapon_" + this.weaponSpec.id));
    }
    this.shownWeapon = this.weapon;
  }
  private canCollect(position: T.Vector3, footRange: number) {
    const range = this.riding ? this.riding.spec.radius + 0.8 : footRange;
    return (
      this.hp > 0 &&
      Math.hypot(position.x - this.pos.x, position.z - this.pos.z) < range &&
      !COVER.some((box) =>
        Number.isFinite(
          segmentBox(this.pos.x, this.pos.z, position.x, position.z, box),
        ),
      )
    );
  }
  useRide() {
    if (this.riding) {
      const v = this.riding,
        exit = v.exitPoint(this.rides, false);
      if (!exit) {
        this.onRadio("Exit blocked. Move into open ground first.");
        return;
      }
      this.riding = undefined;
      v.rider.visible = false;
      v.speed = 0;
      this.player.visible = true;
      this.pos.set(exit.x, this.world.groundHeight(exit.x, exit.z), exit.z);
      this.invincible = Math.max(this.invincible, 0.6);
      this.onRadio("On foot. Weapon ready.");
      return;
    }
    const v = this.nearestRide;
    if (!v) return;
    this.riding = v;
    v.rider.visible = true;
    this.player.visible = false;
    this.dashTime = 0;
    this.reloadTime = 0;
    this.pos.copy(v.mesh.position);
    this.onRadio(
      v.spec.name + " boarded. Move to drive, FIRE to shoot, USE to exit.",
    );
  }
  private damageHealth(damage: number) {
    const absorbed = Math.min(this.shield, damage);
    this.shield -= absorbed;
    this.hp = Math.max(0, this.hp - (damage - absorbed));
  }
  takeDamage(damage: number) {
    if (this.riding) {
      const v = this.riding;
      v.hp = Math.max(0, v.hp - damage);
      if (v.hp === 0) {
        const exit = v.exitPoint(this.rides, false);
        this.riding = undefined;
        v.rider.visible = false;
        this.player.visible = true;
        v.speed = 0;
        if (exit) this.pos.set(exit.x, 0, exit.z);
        this.damageHealth(25);
        this.spark(v.mesh.position.x, v.mesh.position.z, true);
        this.corpses.push(new FallenBody(v.mesh, undefined, v.kind));
        this.invincible = 1;
        this.onRadio("Vehicle destroyed! Emergency evacuation.");
      }
    } else this.damageHealth(damage);
  }
  blast(x: number, z: number, spec: WeaponSpec, damage: number) {
    this.spark(x, z, true);
    for (const enemy of this.enemies) {
      const d = Math.hypot(enemy.x - x, enemy.z - z);
      if (
        enemy.hp > 0 &&
        d < spec.splash + enemy.radius &&
        !COVER.some((b) => segmentBox(x, z, enemy.x, enemy.z, b) !== Infinity)
      )
        this.hurt(
          enemy,
          damage * Math.max(0.25, 1 - d / (spec.splash + enemy.radius)),
        );
    }
    for (const prop of [...this.world.destructibles])
      if (Math.hypot(prop.box.x - x, prop.box.z - z) < spec.splash + 0.5)
        this.damageProp(prop.box, damage);
    if (spec.id === "poisonBomb") {
      const mesh = new T.Mesh(
        new T.SphereGeometry(1, 12, 8),
        new T.MeshBasicMaterial({
          color: 0x9aae46,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
      );
      mesh.scale.set(spec.splash, 0.5, spec.splash);
      mesh.position.set(x, 0.45, z);
      this.world.actors.add(mesh);
      this.gas.push({ x, z, time: 4, tick: 0, mesh });
    }
  }
  fireWeapon(spec: WeaponSpec, angle: number, mounted = false) {
    const x = this.pos.x,
      z = this.pos.z,
      damage = spec.damage * (1 + this.power * 0.2);
    if (spec.visual === "laser") {
      const tx = x + Math.sin(angle) * 40,
        tz = z + Math.cos(angle) * 40;
      let t = 1;
      for (const b of COVER) t = Math.min(t, segmentBox(x, z, tx, tz, b));
      for (const e of this.enemies)
        if (e.hp > 0 && segmentCircle(x, z, tx, tz, e.x, e.z, e.radius) < t)
          this.hurt(e, damage);
      const hitProp = this.world.destructibles.find(
        (p) => Math.abs(segmentBox(x, z, tx, tz, p.box) - t) < 0.001,
      );
      if (hitProp) this.damageProp(hitProp.box, damage);
      const beam = new T.Mesh(this.bulletGeo, this.effectMat.clone());
      beam.material.color.setHex(0x8efaff);
      beam.position.set(x + ((tx - x) * t) / 2, 1.1, z + ((tz - z) * t) / 2);
      beam.rotation.y = angle;
      beam.scale.set(0.5, 0.5, (40 * t) / 0.65);
      this.world.actors.add(beam);
      this.effects.push({ mesh: beam, life: 0.13, max: 0.13 });
    } else
      for (let i = 0; i < spec.pellets; i++) {
        const spread =
          spec.pellets > 1
            ? (i - (spec.pellets - 1) / 2) * spec.spread
            : (Math.random() - 0.5) * spec.spread;
        this.shoot(x, z, angle + spread, false, damage, spec.speed, spec);
      }
    if (!mounted) this.playerMotion.kick();
    this.onSound(spec.splash ? "explosion" : "shot");
  }
  spark(x: number, z: number, big = false) {
    for (
      let i = 0;
      i < (this.world.lowDetail ? (big ? 4 : 1) : big ? 12 : 3);
      i++
    ) {
      const mesh = new T.Mesh(this.effectGeo, this.effectMat.clone());
      mesh.position.set(
        x + (Math.random() - 0.5) * (big ? 2 : 0.5),
        0.7 + Math.random(),
        z + (Math.random() - 0.5) * (big ? 2 : 0.5),
      );
      mesh.scale.setScalar(big ? 1.4 : 0.35);
      this.world.actors.add(mesh);
      this.effects.push({
        mesh,
        life: 0.3 + Math.random() * 0.3,
        max: 0.6,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * 5,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 5,
        ),
      });
    }
    if (big)
      for (let i = 0; i < (this.world.lowDetail ? 2 : 8); i++) {
        const mesh = new T.Mesh(this.effectGeo, this.effectMat.clone());
        mesh.material.color.setHex(0x55534d);
        mesh.material.depthWrite = false;
        mesh.position.set(
          x + (Math.random() - 0.5),
          0.7,
          z + (Math.random() - 0.5),
        );
        mesh.scale.setScalar(2 + Math.random());
        this.world.actors.add(mesh);
        this.effects.push({
          mesh,
          life: 1.8,
          max: 1.8,
          smoke: true,
          velocity: new T.Vector3(0.25, 1.1 + Math.random(), 0.15),
        });
      }
    this.onSound(big ? "explosion" : "hit");
  }
  shoot(
    x: number,
    z: number,
    angle: number,
    enemy: boolean,
    damage: number,
    speed = enemy ? 11 : 45,
    spec?: WeaponSpec,
  ) {
    const flash = new T.Mesh(this.effectGeo, this.effectMat.clone());
    flash.position.set(
      x + Math.sin(angle) * 0.7,
      1.1,
      z + Math.cos(angle) * 0.7,
    );
    flash.scale.set(0.32, 0.32, 0.8);
    flash.rotation.y = angle;
    flash.material.color.setHex(0xffe8a5);
    this.world.actors.add(flash);
    this.effects.push({ mesh: flash, life: 0.055, max: 0.055 });
    let mesh: T.Object3D;
    const visual = spec?.visual;
    if (
      visual === "rocket" ||
      visual === "arrow" ||
      visual === "grenade" ||
      visual === "gas"
    )
      mesh = model("projectile_" + (visual === "gas" ? "grenade" : visual));
    else {
      mesh = new T.Mesh(
        visual === "flame" ? this.effectGeo : this.bulletGeo,
        visual === "flame"
          ? this.effectMat
          : enemy
            ? this.bulletEnemy
            : this.bulletFriendly,
      );
      if (visual === "sniper") mesh.scale.z = 3;
    }

    mesh.position.set(x, 0.95, z);
    mesh.rotation.y = angle;
    this.world.actors.add(mesh);
    this.bullets.push({
      mesh,
      spec,
      age: 0,
      maxLife: enemy ? 4 : (spec?.life ?? 1.05),
      hits: new Set(),
      x,
      z,
      vx: Math.sin(angle) * speed,
      vz: Math.cos(angle) * speed,
      life: enemy ? 4 : (spec?.life ?? 1.05),
      damage,
      enemy,
    });
  }
  hurt(e: Actor, damage: number) {
    if (e.hp <= 0) return; // A dead actor can award score only once.
    e.motion?.hit();
    e.hp -= damage;
    if (e.boss && e.hp > 0 && e.hp < e.max * 0.5 && !e.reinforced) {
      e.reinforced = true;
      for (let n = 0; n < 2 * difficultyConfig(this.difficulty).soldiers; n++)
        this.spawn(
          e.x + (n % 2 ? 6 : -6),
          e.z + 5 + Math.floor(n / 2) * 2,
          false,
          300 + n,
        );
      this.onRadio(
        "Reinforcements on both flanks. Keep moving; the boss is escalating.",
      );
    }
    this.spark(e.x, e.z);
    if (e.hp <= 0) {
      this.kills++;
      this.score += e.boss ? 1500 : 100;
      this.world.actors.remove(e.warn);
      this.corpses.push(
        new FallenBody(
          e.mesh,
          e.motion,
          e.boss ? MISSIONS[this.index].bossModel : "human",
        ),
      );
      if (e.boss) this.spark(e.x, e.z, true);
      if (e.beam) {
        this.world.actors.remove(e.beam);
        e.beam.material.dispose();
        e.beam = undefined;
      }
      if (e.boss) {
        this.checkExtraction();
      } else if (e.index % 2 === 0) {
        const p = this.supplyCrate("health", e.x, e.z);
        this.pickups.push(p);
        this.world.actors.add(p);
      }
    }
  }
  private checkExtraction() {
    if (!this.objective || this.bossDead) return;
    const cleared = MISSIONS[this.index].finale
      ? this.bossSpawned && !this.enemies.some((e) => e.boss && e.hp > 0)
      : [...this.guardIds].every((e) => e.hp <= 0);
    if (cleared) {
      this.bossDead = true;
      this.world.exit.visible = true;
      this.onRadio(
        "Sector secure. Follow the road to the green extraction marker.",
      );
    }
  }
  damageProp(box: (typeof COVER)[number], damage: number) {
    const prop = this.world.destructibles.find((p) => p.box === box);
    if (!prop || prop.hp <= 0) return;
    prop.hp -= damage;
    if (prop.hp > 0) return;
    this.world.destructibles.splice(this.world.destructibles.indexOf(prop), 1);
    COVER.splice(COVER.indexOf(box), 1);
    this.corpses.push(new FallenBody(prop.mesh, undefined, prop.kind));
    if (prop.kind !== "fuel") {
      this.spark(box.x, box.z);
      return;
    }
    this.spark(box.x, box.z, true);
    for (const e of this.enemies)
      if (e.hp > 0 && Math.hypot(e.x - box.x, e.z - box.z) < 4.8 + e.radius)
        this.hurt(e, 140);
    if (
      Math.hypot(this.pos.x - box.x, this.pos.z - box.z) <
      4.8 + (this.riding?.spec.radius ?? 0.5)
    ) {
      this.takeDamage(45);
      this.invincible = Math.max(this.invincible, 0.25);
    }
    for (const v of this.rides)
      if (
        v !== this.riding &&
        v.hp > 0 &&
        Math.hypot(v.mesh.position.x - box.x, v.mesh.position.z - box.z) <
          4.8 + v.spec.radius
      ) {
        v.hp = Math.max(0, v.hp - 70);
        if (!v.hp) this.corpses.push(new FallenBody(v.mesh, undefined, v.kind));
      }
    for (const next of [...this.world.destructibles])
      if (Math.hypot(next.box.x - box.x, next.box.z - box.z) < 4.8)
        this.damageProp(next.box, 90);
  }
  private updateTerrainEvents(dt: number) {
    this.quakeTime = Math.max(0, this.quakeTime - dt);
    const biome = MISSIONS[this.index].biome;
    if (biome !== "quake" && biome !== "volcano") return;
    this.eventClock -= dt;
    if (this.eventClock > 0) return;
    this.eventClock = biome === "quake" ? 10 : 5;
    if (biome === "quake") {
      this.quakeTime = 1 + (this.quakeCount++ % 2);
      this.onRadio(
        "EARTHQUAKE! Ground enemies are staggered. Push through the dust.",
      );
      for (let i = 0; i < (this.world.lowDetail ? 6 : 14); i++) {
        const mesh = new T.Mesh(this.effectGeo, this.effectMat.clone());
        mesh.material.color.setHex(0xb7a58a);
        mesh.material.depthWrite = false;
        mesh.position.set(
          this.pos.x + Math.sin(i * 2.4) * 9,
          0.05,
          this.pos.z + Math.cos(i * 2.4) * 9,
        );
        mesh.scale.setScalar(2);
        this.world.actors.add(mesh);
        this.effects.push({
          mesh,
          life: 2,
          max: 2,
          smoke: true,
          velocity: new T.Vector3(0.2, 2.8, 0.1),
        });
      }
    } else {
      const nearest = this.enemies
        .filter((e) => e.hp > 0)
        .sort(
          (a, b) =>
            Math.hypot(a.x - this.pos.x, a.z - this.pos.z) -
            Math.hypot(b.x - this.pos.x, b.z - this.pos.z),
        )[0];
      for (const point of [
        { x: this.pos.x, z: this.pos.z },
        ...(nearest ? [nearest] : []),
        { x: this.pos.x + 5, z: this.pos.z - 7 },
      ])
        this.rockfall(point.x, point.z);
      this.onRadio(
        "ROCKFALL! Clear the orange impact rings. Falling rock can hit either side.",
      );
    }
  }
  rockfall(x: number, z: number) {
    const mesh = new T.Mesh(
      new T.RingGeometry(1.85, 2, 36),
      new T.MeshBasicMaterial({
        color: 0xff8557,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.08, z);
    const rock = model("rock", x, z, 0.6);
    rock.position.y = 21.6;
    this.world.actors.add(mesh, rock);
    this.hazards.push({ mesh, rock, x, z, time: 1.8, bothSides: true });
  }
  private updateBoss(e: Actor, dt: number) {
    const beforeX = e.x,
      beforeZ = e.z,
      anchor = e.anchor!,
      kind = e.bossKind;
    const aim = Math.atan2(this.pos.x - e.x, this.pos.z - e.z);
    const cycle = (this.elapsed + e.index * 1.7) % 14;
    if (kind === "gunship") {
      const cover = COVER.filter(
        (b) => b.kind !== "fuel" && b.kind !== "tree",
      ).sort(
        (a, b) =>
          Math.hypot(a.x - anchor.x, a.z - anchor.z) -
          Math.hypot(b.x - anchor.x, b.z - anchor.z),
      )[0];
      const land = cover
        ? {
            x: cover.x,
            z: Math.max(WORLD_BOUNDS.minZ + 4, cover.z - cover.d / 2 - 3.5),
          }
        : anchor;
      const target =
        cycle >= 6
          ? land
          : {
              x: anchor.x + Math.sin(this.elapsed * 0.5 + e.index) * 6,
              z: anchor.z + Math.cos(this.elapsed * 0.4 + e.index) * 4,
            };
      const distance = Math.hypot(target.x - e.x, target.z - e.z),
        step = Math.min(distance, dt * 6);
      if (distance > 0.01) {
        e.x += ((target.x - e.x) / distance) * step;
        e.z += ((target.z - e.z) / distance) * step;
      }
      const landed =
        cycle >= 9 &&
        cycle < 12 &&
        distance < 1 &&
        !COVER.some((b) => segmentBox(e.x, e.z, e.x, e.z, b, 1.5) !== Infinity);
      e.mesh.position.y = T.MathUtils.damp(
        e.mesh.position.y,
        landed ? 0.4 : 4.5,
        4,
        dt,
      );
      e.state = landed ? "LANDED / REARMING" : "AIRBORNE";
      if (landed) e.cool = Math.max(e.cool, 1.5);
    } else if (kind === "spider") {
      const resting = cycle > 11;
      e.state = resting ? "RESTING" : "CLIMBING";
      if (!resting) {
        const d = Math.hypot(this.pos.x - e.x, this.pos.z - e.z);
        if (d > 8) {
          e.x += Math.sin(aim) * dt * 2.8;
          e.z += Math.cos(aim) * dt * 2.8;
        } else {
          e.x += Math.cos(aim) * dt * 0.8;
          e.z -= Math.sin(aim) * dt * 0.8;
        }
      }
      const onCover = COVER.some(
        (b) => segmentBox(e.x, e.z, e.x, e.z, b, 0.6) !== Infinity,
      );
      e.mesh.position.y = T.MathUtils.damp(
        e.mesh.position.y,
        onCover ? 4.4 : 0.15,
        8,
        dt,
      );
      e.mesh.traverse((o) => {
        if (String(o.userData.joint).startsWith("Leg"))
          o.rotation.y = resting
            ? 0
            : Math.sin(
                this.elapsed * 7 + Number(String(o.userData.joint).slice(3)),
              ) * 0.22;
      });
      if (resting) e.cool = Math.max(e.cool, 1.2);
    } else {
      e.state = e.cool < 1.2 ? "LASER CHARGING" : "REPOSITIONING";
      if (e.cool > 1.2) {
        const m = moveCircle(
          e.x,
          e.z,
          Math.cos(aim) * dt,
          -Math.sin(aim) * dt,
          2,
          [...COVER],
          WORLD_BOUNDS,
        );
        e.x = m.x;
        e.z = m.z;
      }
    }
    e.x = T.MathUtils.clamp(e.x, -WORLD_BOUNDS.x + 3, WORLD_BOUNDS.x - 3);
    e.z = T.MathUtils.clamp(e.z, WORLD_BOUNDS.minZ + 3, WORLD_BOUNDS.maxZ - 3);
    e.mesh.position.x = e.x;
    e.mesh.position.z = e.z;
    // Keep the weapon aimed along the locked warning while the laser charges.
    const facing = kind === "laserTank" ? (e.laserAim ?? aim) : aim;
    e.mesh.rotation.y = facing;
    e.vehicleMotion?.update(dt, (e.x - beforeX) / dt, facing, this.elapsed);
    e.cool -= dt;
    const sight = !COVER.some(
      (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) !== Infinity,
    );
    e.warn.visible = e.cool < 0.6 && sight;
    e.warn.position.set(e.x, 0.08, e.z);
    e.warn.scale.setScalar(3);
    if (kind === "laserTank") {
      if (e.cool <= 1.2) {
        e.laserAim ??= aim;
        const a = e.laserAim,
          tx = e.x + Math.sin(a) * 45,
          tz = e.z + Math.cos(a) * 45;
        let t = 1;
        for (const box of COVER)
          t = Math.min(
            t,
            segmentBox(e.x, e.z, tx, tz, box, BOSS_ATTACKS.laserTank.width / 2),
          );
        if (!e.beam) {
          e.beam = new T.Mesh(this.bulletGeo, this.effectMat.clone());
          this.world.actors.add(e.beam);
        }
        e.beam.material.color.setHex(e.cool <= 0 ? 0x9dfaff : 0xff534c);
        e.beam.position.set(
          e.x + ((tx - e.x) * t) / 2,
          1,
          e.z + ((tz - e.z) * t) / 2,
        );
        e.beam.rotation.y = a;
        e.beam.scale.set(
          BOSS_ATTACKS.laserTank.width / 0.1,
          0.8,
          (45 * t) / 0.65,
        );
        if (e.cool <= 0) {
          if (
            this.invincible === 0 &&
            segmentCircle(
              e.x,
              e.z,
              tx,
              tz,
              this.pos.x,
              this.pos.z,
              (this.riding?.spec.radius ?? 0.55) +
                BOSS_ATTACKS.laserTank.width / 2,
            ) < t &&
            !COVER.some(
              (box) =>
                segmentBox(e.x, e.z, this.pos.x, this.pos.z, box) !== Infinity,
            )
          ) {
            this.takeDamage(BOSS_ATTACKS.laserTank.damage);
            this.invincible = 0.3;
          }
          this.effects.push({ mesh: e.beam, life: 0.22, max: 0.22 });
          e.beam = undefined;
          e.laserAim = undefined;
          e.cool = BOSS_ATTACKS.laserTank.interval;
          this.onSound("shot");
        }
      }
    } else if (e.cool <= 0) {
      const profile =
        kind === "gunship" ? BOSS_ATTACKS.gunship : BOSS_ATTACKS.spider;
      if (sight) {
        e.volleys = (e.volleys ?? 0) + 1;
        if (e.volleys % 6 === 0) {
          this.bossSalvo(e, aim);
          e.cool = BOSS_ATTACKS.heavy.interval;
        } else {
          for (let i = 0; i < profile.count; i++)
            this.shoot(
              e.x,
              e.z,
              aim + (i - 1) * profile.spread,
              true,
              profile.damage,
              profile.speed,
            );
          e.cool = profile.interval * (e.hp < e.max * 0.5 ? 0.82 : 1);
        }
      } else e.cool = 0.3;
    }
  }
  private bossSalvo(e: Actor, aim: number) {
    const profile = BOSS_ATTACKS.heavy;
    e.state = "HEAVY SALVO / TAKE COVER";
    this.onRadio(
      "Heavy salvo! Leave the orange blast zones or get behind concrete.",
    );
    for (let i = 0; i < profile.count; i++) {
      const offset = (i - 1) * 5;
      const x = T.MathUtils.clamp(
        this.pos.x + Math.cos(aim) * offset,
        -WORLD_BOUNDS.x + profile.radius,
        WORLD_BOUNDS.x - profile.radius,
      );
      const z = T.MathUtils.clamp(
        this.pos.z - Math.sin(aim) * offset,
        WORLD_BOUNDS.minZ + profile.radius,
        WORLD_BOUNDS.maxZ - profile.radius,
      );
      const mesh = new T.Mesh(
        new T.RingGeometry(profile.radius - 0.14, profile.radius, 40),
        new T.MeshBasicMaterial({
          color: 0xff7646,
          side: T.DoubleSide,
          transparent: true,
        }),
      );
      mesh.position.set(x, 0.09, z);
      mesh.rotation.x = -Math.PI / 2;
      const rock = model("projectile_rocket", x, z, 1.6);
      rock.position.y = profile.warning * 12;
      rock.rotation.x = Math.PI / 2;
      this.world.actors.add(mesh, rock);
      this.hazards.push({
        mesh,
        rock,
        x,
        z,
        time: profile.warning,
        radius: profile.radius,
        damage: profile.damage,
        owner: e,
      });
    }
  }

  private beginDefeat() {
    if (this.phase !== "playing") return;
    this.phase = "dying";
    this.deathClock = 0;
    this.corpses.push(new FallenBody(this.player, this.playerMotion));
    this.onRadio("Ghost is down. Signal fading...");
  }
  updatePresentation(dt: number) {
    for (let i = this.corpses.length - 1; i >= 0; i--)
      if (this.corpses[i].update(dt)) this.corpses.splice(i, 1);
  }
  update(dt: number, input: Input) {
    if (this.phase === "dying") {
      this.updatePresentation(dt);
      this.deathClock += dt;
      if (this.deathClock >= 4.05) {
        this.phase = "lost";
        this.onEnd(false);
      }
      return;
    }
    if (this.phase !== "playing") return;
    this.updatePresentation(dt);
    if (this.hp <= 0) {
      this.beginDefeat();
      return;
    }
    this.elapsed += dt;
    this.updateTerrainEvents(dt);
    this.shotTime = Math.max(0, this.shotTime - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    if (this.reloadTime > 0) {
      this.reloadTime = Math.max(0, this.reloadTime - dt);
      if (this.reloadTime === 0) {
        const add = Math.min(this.mag - this.ammo, this.reserves[this.weapon]);
        this.ammo += add;
        this.reserves[this.weapon] -= add;
      }
    }
    if (input.swap && (!this.riding || this.riding.kind === "motorcycle")) {
      this.magazines[this.weapon] = this.ammo;
      this.weapon =
        this.inventory[
          (this.inventory.indexOf(this.weapon) + 1) % this.inventory.length
        ];
      this.ammo = this.magazines[this.weapon];
      this.reloadTime = 0;
      this.shotTime = Math.max(this.shotTime, 0.25);
      input.swap = false;
      this.onSound("reload");
    }
    input.swap = false;
    if (
      (!this.riding || this.riding.kind === "motorcycle") &&
      this.ammo === 0 &&
      this.reserves[this.weapon] === 0
    ) {
      this.magazines[this.weapon] = 0;
      const at = this.inventory.indexOf(this.weapon);
      for (let step = 1; step <= this.inventory.length; step++) {
        const next = this.inventory[(at + step) % this.inventory.length];
        if (this.magazines[next] > 0 || this.reserves[next] > 0) {
          this.weapon = next;
          this.ammo = this.magazines[next];
          this.reloadTime = 0;
          this.shotTime = Math.max(this.shotTime, 0.25);
          this.onRadio(
            "Ammunition depleted. Switched to " + this.weaponSpec.name + ".",
          );
          break;
        }
      }
    }
    if (
      (!this.riding || this.riding.kind === "motorcycle") &&
      input.reload &&
      this.ammo < this.mag &&
      this.reloadTime === 0 &&
      this.reserves[this.weapon] > 0
    ) {
      this.reloadTime = this.weaponSpec.reload;
      this.onSound("reload");
    }
    input.reload = false;
    if (input.interact && (this.riding || this.nearestRide)) {
      this.useRide();
      input.interact = false;
    }
    this.showWeapon();
    let dx = input.x,
      dz = input.z;
    const length = Math.hypot(dx, dz);
    if (length > 1) {
      dx /= length;
      dz /= length;
    }
    if (!this.riding && input.dodge && this.dashCooldown === 0 && length > 0) {
      this.dodgeVector = {
        x: dx / Math.min(length, 1),
        z: dz / Math.min(length, 1),
      };
      this.dashTime = 0.22;
      this.invincible = 0.32;
      this.dashCooldown = Math.max(1.1, 2.8 - this.mobility * 0.55);
      this.onSound("dash");
    }
    input.dodge = false;
    if (this.dashTime > 0) {
      dx = this.dodgeVector.x;
      dz = this.dodgeVector.z;
    }
    const movementSpeed = input.fire ? 3.8 : 6.2;
    const previousX = this.pos.x,
      previousZ = this.pos.z;
    const patch = PATCHES.find(
      (p) => Math.hypot(this.pos.x - p.x, this.pos.z - p.z) < p.radius,
    );
    this.sink = T.MathUtils.damp(
      this.sink,
      patch?.kind === "mud" ? 0.65 : 0,
      patch?.kind === "mud" ? 1.2 : 4,
      dt,
    );
    const terrainSpeed = terrainFactor(patch?.kind, this.sink);
    let speedX = dx * (this.dashTime > 0 ? 23 : movementSpeed) * terrainSpeed;
    let speedZ = dz * (this.dashTime > 0 ? 23 : movementSpeed) * terrainSpeed;
    if (patch?.kind === "ice" && !this.riding) {
      this.iceVelocity.x = T.MathUtils.damp(
        this.iceVelocity.x,
        speedX,
        length ? 2.5 : 0.9,
        dt,
      );
      this.iceVelocity.y = T.MathUtils.damp(
        this.iceVelocity.y,
        speedZ,
        length ? 2.5 : 0.9,
        dt,
      );
      speedX = this.iceVelocity.x;
      speedZ = this.iceVelocity.y;
    } else this.iceVelocity.set(speedX, speedZ);
    const parked = this.rides
      .filter((v) => v.hp > 0 && v !== this.riding)
      .map((v) => v.box);
    const moved = this.riding
      ? { x: this.pos.x, z: this.pos.z }
      : moveCircle(
          this.pos.x,
          this.pos.z,
          speedX * dt,
          speedZ * dt,
          0.48,
          [...COVER, ...parked],
          WORLD_BOUNDS,
        );
    this.pos.x = moved.x;
    this.pos.z = moved.z;
    // Root remains grounded; articulated joints provide all locomotion motion.
    this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z) - this.sink;
    let aim = input.aim;
    const nearest = this.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - this.pos.x, e.z - this.pos.z) <
            (this.weaponSpec.visual === "flame" ? 8 : 38) &&
          !COVER.some(
            (b) => segmentBox(this.pos.x, this.pos.z, e.x, e.z, b) < 1,
          ),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.pos.x, a.z - this.pos.z) -
          Math.hypot(b.x - this.pos.x, b.z - this.pos.z),
      )[0];
    if (input.assist && nearest) aim = new T.Vector3(nearest.x, 0, nearest.z);
    else if (input.assist)
      aim = new T.Vector3(
        this.pos.x + dx * 4,
        0,
        this.pos.z + (length ? dz * 4 : -4),
      );
    const angle = Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z);
    const moving =
      Math.hypot(this.pos.x - previousX, this.pos.z - previousZ) > 0.001;
    if (input.fire || this.reloadTime > 0) this.player.rotation.y = angle;
    else if (moving)
      this.player.rotation.y = Math.atan2(
        this.pos.x - previousX,
        this.pos.z - previousZ,
      );
    if (
      !this.riding &&
      input.fire &&
      this.shotTime === 0 &&
      this.reloadTime === 0
    ) {
      if (this.ammo === 0 && this.reserves[this.weapon] > 0) {
        this.reloadTime = this.weaponSpec.reload;
        this.onSound("reload");
      } else if (this.ammo > 0) {
        this.playerMotion.kick();
        this.ammo--;
        this.shotTime = this.weaponSpec.cool;
        this.fireWeapon(this.weaponSpec, angle);
      }
    }
    if (this.riding) {
      const v = this.riding;
      v.drive(
        dt,
        dx,
        dz,
        angle,
        this.rides,
        false,
        terrainSpeed,
        patch?.kind === "ice",
      );
      v.mesh.position.y = this.world.groundHeight(
        v.mesh.position.x,
        v.mesh.position.z,
      );
      this.pos.copy(v.mesh.position);
      if (
        v.kind === "tank" &&
        Math.hypot(this.pos.x - previousX, this.pos.z - previousZ) > 0.002
      )
        for (const enemy of this.enemies)
          if (
            !enemy.boss &&
            enemy.hp > 0 &&
            segmentCircle(
              previousX,
              previousZ,
              this.pos.x,
              this.pos.z,
              enemy.x,
              enemy.z,
              v.spec.radius + enemy.radius,
            ) !== Infinity
          )
            this.hurt(enemy, enemy.hp);
      v.cool = Math.max(0, v.cool - dt);
      if (input.fire && v.cool === 0 && this.reloadTime === 0) {
        const spec =
          v.kind === "motorcycle" ? this.weaponSpec : WEAPONS[v.spec.weapon];
        if (v.kind === "motorcycle" ? this.ammo > 0 : v.ammo > 0) {
          this.fireWeapon(spec, angle, true);
          v.cool = spec.cool;
          if (v.kind === "motorcycle") this.ammo--;
          else v.ammo--;
        } else if (v.kind === "motorcycle" && this.reserves[this.weapon] > 0)
          this.reloadTime = this.weaponSpec.reload;
      }
    }
    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];

      if (this.canCollect(drop.mesh.position, 1.5)) {
        this.magazines[this.weapon] = this.ammo;
        if (!this.inventory.includes(drop.index))
          this.inventory.push(drop.index);
        this.weapon = drop.index;
        this.ammo = this.magazines[this.weapon];
        this.reloadTime = 0;
        this.showWeapon();
        this.world.actors.remove(drop.mesh);
        this.weaponDrops.splice(i, 1);
        this.onRadio(
          WEAPONS[drop.index].name +
            " acquired. WEAPON / Q cycles your loadout.",
        );
      }
    }
    this.playerMotion.update(dt, {
      vx: (this.pos.x - previousX) / dt,
      vz: (this.pos.z - previousZ) / dt,
      aiming: input.fire,
      reload:
        this.reloadTime > 0 ? 1 - this.reloadTime / this.weaponSpec.reload : 0,
      dodging: this.dashTime > 0,
    });
    const mission = MISSIONS[this.index];
    if (
      input.interact &&
      !this.riding &&
      !this.objective &&
      Math.hypot(
        this.pos.x - mission.objective.x,
        this.pos.z - mission.objective.z,
      ) < 3
    ) {
      this.objective = true;
      this.score += 500;
      this.world.marker.visible = false;
      if (mission.finale) {
        const count = difficultyConfig(this.difficulty).bosses;
        for (let n = 0; n < count; n++) {
          const p = routePoint(
            mission.layout,
            count === 1 ? 0 : n % 2 ? 8 : -8,
            -94 - Math.floor(n / 2) * 9,
          );
          this.spawn(p.x, p.z, true, 100 + n);
        }
        this.bossSpawned = true;
        this.onRadio(
          `${count} command boss${count > 1 ? "es" : ""} inbound. Defeat them all to open extraction.`,
        );
      } else {
        const count = 3 * difficultyConfig(this.difficulty).soldiers;
        for (let n = 0; n < count; n++) {
          const before = this.enemies.length;
          this.spawn(
            mission.objective.x + (n % 2 ? 4 : -4),
            mission.objective.z - 6 - Math.floor(n / 2) * 2,
            false,
            200 + n,
          );
          if (this.enemies.length > before)
            this.guardIds.add(this.enemies[this.enemies.length - 1]);
        }
        this.onRadio(
          "Relay guards incoming. Clear the counterattack to open extraction.",
        );
      }
      this.onSound("objective");
    }
    input.interact = false;
    if (this.companion) {
      this.companion.visible = !(this.riding && this.objective);
      if (this.riding && this.objective) this.companion.position.copy(this.pos);
    }
    const navigationCover = [...COVER, ...parked];
    const companionBefore = this.companion?.position.clone();
    if (this.companion && this.objective && !this.riding) {
      const p = this.companion.position,
        d = p.distanceTo(this.pos);
      if (d > 2) {
        this.followClock -= dt;
        if (this.followClock <= 0) {
          this.followTarget = routeStep(
            p.x,
            p.z,
            this.pos.x,
            this.pos.z,
            navigationCover,
            0.45,
            WORLD_BOUNDS,
          );
          this.followClock = 0.35;
        }
        const fd = Math.max(
          0.1,
          Math.hypot(this.followTarget.x - p.x, this.followTarget.z - p.z),
        );
        const next = moveCircle(
          p.x,
          p.z,
          ((this.followTarget.x - p.x) / fd) * Math.min(fd, dt * 6.6),
          ((this.followTarget.z - p.z) / fd) * Math.min(fd, dt * 6.6),
          0.4,
          navigationCover,
          WORLD_BOUNDS,
        );
        p.x = next.x;
        p.z = next.z;
        this.companion.rotation.y = Math.atan2(
          this.pos.x - p.x,
          this.pos.z - p.z,
        );
      }
    }
    if (this.companion && companionBefore) {
      this.companion.position.y = this.world.groundHeight(
        this.companion.position.x,
        this.companion.position.z,
      );
      this.companionMotion?.update(dt, {
        vx: (this.companion.position.x - companionBefore.x) / dt,
        vz: (this.companion.position.z - companionBefore.z) / dt,
      });
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (
        this.quakeTime > 0 &&
        !(e.bossKind === "gunship" && e.mesh.position.y > 2)
      ) {
        e.motion?.update(dt, { vx: 0, vz: 0 });
        e.warn.visible = false;
        continue;
      }
      if (e.boss) {
        this.updateBoss(e, dt);
        continue;
      }
      const beforeX = e.x,
        beforeZ = e.z;
      const distance = Math.hypot(e.x - this.pos.x, e.z - this.pos.z);
      const active = e.boss || distance < 19;
      if (!active) {
        e.warn.visible = false;
        e.motion?.update(dt, { vx: 0, vz: 0 });
        continue;
      }
      const a = Math.atan2(this.pos.x - e.x, this.pos.z - e.z);
      e.mesh.rotation.y = a;
      const hasSight = !navigationCover.some(
        (b) =>
          segmentBox(e.x, e.z, this.pos.x, this.pos.z, b, 0.06) !== Infinity,
      );
      // Keep a readable windup after an enemy emerges from cover.
      e.cool = hasSight ? e.cool - dt : Math.max(e.cool, 0.6);
      e.warn.visible = hasSight && e.cool < 0.6;
      e.warn.position.set(e.x, this.world.groundHeight(e.x, e.z) + 0.08, e.z);
      e.warn.scale.setScalar(e.boss ? 3.5 : 1.2);
      if (!e.boss) {
        let vx = 0,
          vz = 0;
        if (!hasSight) {
          e.routeTime = (e.routeTime ?? 0) - dt;
          if (e.routeTime <= 0 || !e.routeTarget) {
            e.routeTarget = routeStep(
              e.x,
              e.z,
              this.pos.x,
              this.pos.z,
              navigationCover,
              0.55,
              WORLD_BOUNDS,
            );
            e.routeTime = 0.6 + (e.index % 4) * 0.1;
          }
          const rx = e.routeTarget!.x - e.x,
            rz = e.routeTarget!.z - e.z;
          const d = Math.hypot(rx, rz);
          const step = Math.min(d, dt * 1.9);
          if (d > 0.001) {
            vx = (rx / d) * step;
            vz = (rz / d) * step;
          }
        } else {
          // Adapt the original 2D range keeping and strafing to world meters.
          const desired = e.index % 3 === 0 ? 11 : 7;
          const advance =
            distance > desired + 1 ? 1 : distance < desired * 0.55 ? -0.7 : 0;
          const strafe = Math.sin(this.elapsed * 1.2 + e.index * 2.4) * 0.45;
          vx = (Math.sin(a) * advance + Math.cos(a) * strafe) * dt * 1.9;
          vz = (Math.cos(a) * advance - Math.sin(a) * strafe) * dt * 1.9;
          e.routeTime = 0;
        }
        // Local spacing keeps riflemen from collapsing into one visible body.
        for (const other of this.enemies) {
          if (other === e || other.hp <= 0 || other.boss) continue;
          const ox = e.x - other.x,
            oz = e.z - other.z,
            d = Math.hypot(ox, oz);
          if (d < 1.3) {
            const angle =
              d > 0.001
                ? Math.atan2(ox, oz)
                : e.index < other.index
                  ? -Math.PI / 2
                  : Math.PI / 2;
            vx += Math.sin(angle) * (1.3 - d) * dt * 2;
            vz += Math.cos(angle) * (1.3 - d) * dt * 2;
          }
        }
        const move = moveCircle(
          e.x,
          e.z,
          vx,
          vz,
          0.55,
          [...COVER, ...this.rides.filter((v) => v.hp > 0).map((v) => v.box)],
          WORLD_BOUNDS,
        );
        e.x = move.x;
        e.z = move.z;
      }
      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;
      e.warn.position.set(e.x, this.world.groundHeight(e.x, e.z) + 0.08, e.z);
      e.vehicleMotion?.update(dt, (e.x - beforeX) / dt, a, this.elapsed);
      if (!e.boss) e.mesh.position.y = this.world.groundHeight(e.x, e.z);
      e.motion?.update(dt, {
        vx: (e.x - beforeX) / dt,
        vz: (e.z - beforeZ) / dt,
        aiming: e.cool < 0.6,
      });
      if (e.cool <= 0) {
        if (
          !COVER.some(
            (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) < 1,
          )
        ) {
          e.motion?.kick();
          this.shoot(e.x, e.z, a, true, 9, 10);
        }
        e.cool = 2.2 + (e.index % 8) * 0.09;
      }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.age += dt;
      const nx = b.x + b.vx * dt,
        nz = b.z + b.vz * dt;
      let t = Infinity;
      let victim: Actor | undefined;
      let parkedVictim: Ride | undefined;
      let hitPlayer = false;
      let coverHit: (typeof COVER)[number] | undefined;
      for (const box of COVER) {
        const hit = segmentBox(b.x, b.z, nx, nz, box, 0.06);
        if (hit < t) {
          t = hit;
          coverHit = box;
        }
      }
      if (b.enemy)
        for (const v of this.rides) {
          if (v === this.riding || v.hp <= 0) continue;
          const vt = segmentCircle(
            b.x,
            b.z,
            nx,
            nz,
            v.mesh.position.x,
            v.mesh.position.z,
            v.spec.radius,
          );
          if (vt < t) {
            t = vt;
            parkedVictim = v;
          }
        }
      if (b.enemy) {
        const pt = segmentCircle(
          b.x,
          b.z,
          nx,
          nz,
          this.pos.x,
          this.pos.z,
          this.riding?.spec.radius ?? 0.52,
        );
        if (pt < t) {
          t = pt;
          hitPlayer = true;
          parkedVictim = undefined;
        }
      } else
        for (const e of this.enemies) {
          if (e.hp <= 0 || b.hits.has(e)) continue;
          const et = segmentCircle(b.x, b.z, nx, nz, e.x, e.z, e.radius);
          if (et < t) {
            t = et;
            victim = e;
          }
        }
      if (t !== Infinity) {
        if (coverHit && !victim && !hitPlayer && !parkedVictim)
          this.damageProp(coverHit, b.damage);
        if (parkedVictim) {
          parkedVictim.hp = Math.max(0, parkedVictim.hp - b.damage);
          if (parkedVictim.hp === 0) {
            this.spark(
              parkedVictim.mesh.position.x,
              parkedVictim.mesh.position.z,
              true,
            );
            this.corpses.push(
              new FallenBody(parkedVictim.mesh, undefined, parkedVictim.kind),
            );
          }
        }
        if (victim) {
          this.hurt(victim, b.damage);
          b.hits.add(victim);
        }
        if (hitPlayer && this.invincible === 0) {
          this.takeDamage(b.damage);
          this.playerMotion.hit();
          this.invincible = Math.max(this.invincible, 0.18);
          this.spark(this.pos.x, this.pos.z);
          this.onSound("damage");
        }
        if (b.spec?.visual !== "sniper" || !victim || b.hits.size >= 4)
          b.life = 0;
      }
      b.x = nx;
      b.z = nz;
      if (b.life <= 0 && b.spec && b.spec.splash > 0) {
        const at = t === Infinity ? 1 : Math.max(0, t - 0.005);
        this.blast(
          b.x - b.vx * dt + b.vx * dt * at,
          b.z - b.vz * dt + b.vz * dt * at,
          b.spec,
          b.damage * 0.8,
        );
      }
      b.mesh.position.set(
        nx,
        0.95 +
          (b.spec?.visual === "grenade" || b.spec?.visual === "gas"
            ? Math.sin(Math.min(1, b.age / b.maxLife) * Math.PI) * 2
            : 0),
        nz,
      );
      if (b.spec?.visual === "flame") b.mesh.scale.setScalar(0.3 + b.age * 4);
      if (
        b.spec?.visual === "rocket" &&
        Math.floor(b.age * 15) !== Math.floor((b.age - dt) * 15)
      ) {
        const puff = new T.Mesh(this.effectGeo, this.effectMat.clone());
        puff.material.color.setHex(0x9c998d);
        puff.material.depthWrite = false;
        puff.position.copy(b.mesh.position);
        puff.scale.setScalar(0.5);
        this.world.actors.add(puff);
        this.effects.push({ mesh: puff, life: 0.4, max: 0.4, smoke: true });
      }
      if (b.life <= 0) {
        this.world.actors.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.gas.length - 1; i >= 0; i--) {
      const cloud = this.gas[i];
      cloud.time -= dt;
      cloud.tick -= dt;
      (cloud.mesh.material as T.MeshBasicMaterial).opacity = Math.min(
        0.18,
        cloud.time * 0.12,
      );
      if (cloud.tick <= 0) {
        cloud.tick = 0.5;
        for (const e of this.enemies)
          if (
            e.hp > 0 &&
            Math.hypot(e.x - cloud.x, e.z - cloud.z) < 2.8 &&
            !COVER.some(
              (b) => segmentBox(cloud.x, cloud.z, e.x, e.z, b) !== Infinity,
            )
          )
            this.hurt(e, 12);
      }
      if (cloud.time <= 0) {
        this.world.actors.remove(cloud.mesh);
        cloud.mesh.geometry.dispose();
        (cloud.mesh.material as T.Material).dispose();
        this.gas.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.velocity) {
        e.mesh.position.addScaledVector(e.velocity, dt);
        if (!e.smoke) e.velocity.y -= dt * 8;
      } else e.mesh.position.y += dt * 1.8;
      e.mesh.scale.multiplyScalar(1 + dt * (e.smoke ? 0.7 : 2));
      e.mesh.material.opacity =
        Math.max(0, e.life / e.max) * (e.smoke ? 0.45 : 1);
      if (e.life <= 0) {
        this.world.actors.remove(e.mesh);
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (h.owner && h.owner.hp <= 0) {
        this.world.actors.remove(h.mesh);
        if (h.rock) this.world.actors.remove(h.rock);
        h.mesh.geometry.dispose();
        h.mesh.material.dispose();
        this.hazards.splice(i, 1);
        continue;
      }
      h.time -= dt;
      if (h.rock) h.rock.position.y = Math.max(0, h.time * 12);
      h.mesh.material.opacity = 0.4 + Math.abs(Math.sin(h.time * 10)) * 0.5;
      if (h.time <= 0) {
        this.spark(h.x, h.z, true);
        if (h.bothSides)
          for (const e of this.enemies)
            if (e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) < 2 + e.radius)
              this.hurt(e, 90);
        if (h.bothSides)
          for (const p of [...this.world.destructibles])
            if (Math.hypot(p.box.x - h.x, p.box.z - h.z) < 3)
              this.damageProp(p.box, 90);
        if (
          Math.hypot(this.pos.x - h.x, this.pos.z - h.z) <
            (h.radius ?? 2) + (this.riding?.spec.radius ?? 0) &&
          (!h.owner ||
            !COVER.some(
              (b) =>
                segmentBox(h.x, h.z, this.pos.x, this.pos.z, b) !== Infinity,
            )) &&
          this.invincible === 0
        ) {
          this.takeDamage(h.damage ?? 28);
          this.playerMotion.hit();
          this.invincible = Math.max(this.invincible, 0.2);
          this.onSound("damage");
        }
        this.world.actors.remove(h.mesh);
        if (h.rock) this.world.actors.remove(h.rock);
        h.mesh.geometry.dispose();
        h.mesh.material.dispose();
        this.hazards.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const isShield = p.userData.kind === "shield";
      if (
        this.canCollect(p.position, 1.1) &&
        (isShield
          ? this.shield < this.maxShield
          : this.hp < this.maxHp ||
            (this.riding && this.riding.hp < this.riding.spec.hp))
      ) {
        if (isShield) this.shield = Math.min(this.maxShield, this.shield + 40);
        else {
          this.hp = Math.min(this.maxHp, this.hp + 30);
          if (this.riding)
            this.riding.hp = Math.min(this.riding.spec.hp, this.riding.hp + 30);
        }
        this.onRadio(
          isShield
            ? "Shield charged: +40 protection."
            : this.riding
              ? "Supplies collected. Health and vehicle armor restored."
              : "Medical supplies collected.",
        );
        this.world.actors.remove(p);
        this.pickups.splice(i, 1);
        this.onSound("objective");
      }
    }
    this.checkExtraction();
    // Hit reactions preserve silhouette instead of blinking the entire actor away.
    if (this.hp <= 0) {
      this.beginDefeat();
    } else if (
      this.bossDead &&
      !this.riding &&
      Math.hypot(
        this.pos.x - mission.extract.x,
        this.pos.z - mission.extract.z,
      ) < 2.5 &&
      (!this.companion ||
        Math.hypot(
          this.companion.position.x - mission.extract.x,
          this.companion.position.z - mission.extract.z,
        ) < 5)
    ) {
      this.phase = "won";
      this.score +=
        Math.max(0, 1200 - Math.floor(this.elapsed * 3)) +
        Math.floor(this.hp * 4);
      this.onEnd(true);
    }
  }
}
