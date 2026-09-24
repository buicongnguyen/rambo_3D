import {
  INFANTRY,
  infantryRole,
  pressureLimits,
  inMeleeSector,
} from "./enemy-roles.mjs";
import { equipInfantry, infantryWarnings, type InfantryRole } from "./infantry";
import { Squad } from "./squad";
import { fieldBonuses, openedPrisonWalls, TREASURE } from "./rescue.mjs";
import {
  ENEMY_TANK,
  armorMultiplier,
  depotGuardPositions,
  explosiveTarget,
} from "./tactics.mjs";
import {
  missionPacing,
  enemyLoot,
  ammoReward,
  seesPlayer,
  turnToward,
  angleDelta,
  rearHit,
  grenadeHeight,
  coverHeight,
} from "./progression.mjs";
import { ENV_BLAST, blastDamage } from "./environment.mjs";
import {
  BOSS_ATTACKS,
  placeSupplies,
  placeVehicles,
  guardedPatrols,
} from "./encounters.mjs";
import {
  BOSS_DEFS,
  AUX_GUN,
  QUAD_GUNS,
  ROCKET_GUNS,
  MISSILE_SALVOS,
} from "./bosses.mjs";
import { routeFormation } from "./routes.mjs";
import { difficultyConfig, terrainFactor, WORLD_BOUNDS } from "./campaign.mjs";
import { WEAPONS, ENEMY_WEAPONS, type WeaponSpec } from "./arsenal";
import { Ride } from "./rides";
import { ImpactEffects } from "./impacts";
import { DestructionEffects } from "./destruction";
import { tracerGeometry } from "./tracers";
import { SpatialGrid, knockbackDistance, turboStats } from "./combat.mjs";
import { Feel, hurtAngle } from "./feel.mjs";
import { nextGoal } from "./guidance.mjs";
import { repaint, HOSTILE_ARMOR } from "./liveries";
import * as T from "three";
import { CharacterMotion, FallenBody, VehicleMotion } from "./animation";
import { World, model } from "./world";
import { MISSIONS, COVER, SPAWNS, PATCHES, type Box } from "./missions";
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
  turbo?: boolean;
  blast?: boolean;
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
  armored?: boolean;
  role?: InfantryRole;
  attack?: { time: number; aim: number; reach: number; fired: boolean };
  bossKind?: string;
  guard?: boolean;
  cacheGuard?: boolean;
  alerted?: boolean;
  lastSeen?: { x: number; z: number };
  memory?: number;
  state?: string;
  anchor?: { x: number; z: number };
  volleys?: number;
  auxCool?: number;
  muzzles?: Map<string, T.Object3D>;
  laserAim?: number;
  beam?: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  index: number;
  warn: T.Mesh;
  reinforced?: boolean;
  emerging?: Box;
  motion?: CharacterMotion;
  vehicleMotion?: VehicleMotion;
  routeTime?: number;
  routeTarget?: { x: number; z: number };
  /** Game time until which the HUD shows this boss's heavy-salvo warning. */
  salvoUntil?: number;
  landingCover?: Box;
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
  from?: T.Vector3;
  duration?: number;
};
type Bullet = {
  originX: number;
  originZ: number;
  originY: number;
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
  impacts: ImpactEffects;
  destruction: DestructionEffects;
  private enemyGrid = new SpatialGrid(5);
  private coverGrid = new SpatialGrid(8);
  private coverCount = -1;
  private liveCover = new Set<(typeof COVER)[number]>();
  private friendlyTracer = tracerGeometry(0xff9418);
  private hostileTracer = tracerGeometry(0xff7914, true);
  private tracerMaterial = new T.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  player: T.Group;
  squad: Squad;
  prisons: {
    box: Box;
    mesh: T.Group;
    captive: T.Group;
    marker: T.Mesh;
    gate?: T.Object3D;
    freed: boolean;
    open: number;
    collisionOpen: boolean;
  }[] = [];
  treasures: T.Group[] = [];
  credits = 0;
  rescued = 0;
  playerMotion!: CharacterMotion;
  corpses: FallenBody[] = [];
  private deathClock = 0;
  private dodgeVector = { x: 0, z: 0 };
  enemies: Actor[] = [];
  private roleHints = new Set<InfantryRole>();
  bullets: Bullet[] = [];
  effects: Effect[] = [];
  pickups: T.Object3D[] = [];
  shield = 0;
  readonly maxShield = 80;
  supplySeed = 0;
  combatNotice = "";
  combatNoticeUntil = 0;
  blastTarget?: (typeof COVER)[number];
  private blastAimTime = 0;
  private blastDepth = 0;
  private blastAimWeapon = "";
  private blastMarker = new T.Mesh(
    new T.RingGeometry(0.7, 0.85, 24),
    new T.MeshBasicMaterial({
      color: 0xff8b24,
      transparent: true,
      opacity: 0.9,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  private combatMessage(text: string, seconds = 1.2) {
    if (
      this.elapsed < this.combatNoticeUntil &&
      this.combatNotice.startsWith("CHAIN BLAST") &&
      !text.startsWith("CHAIN BLAST")
    )
      return;
    this.combatNotice = text;
    this.combatNoticeUntil = this.elapsed + seconds;
  }
  hazards: Hazard[] = [];
  private throwDistance = 12.75;
  private grenadeMarker = new T.Mesh(
    new T.RingGeometry(2.9, 3, 40),
    new T.MeshBasicMaterial({
      color: 0xffc466,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  spotted = false;
  index = 0;
  hp = 150;
  maxHp = 150;
  ammo = 24;
  private magazines: number[] = WEAPONS.map((w) => w.mag);
  reserves: number[] = WEAPONS.map((w, i) => (i < 2 ? Infinity : w.mag * 3));
  inventory = [0, 9];
  rides: Ride[] = [];
  riding?: Ride;
  weaponDrops: { mesh: T.Group; index: number }[] = [];
  gas: { x: number; z: number; time: number; tick: number; mesh: T.Mesh }[] =
    [];
  turboTime = 0;
  turboCooldown = 0;
  private turboBanks: {
    index: number;
    cool: number;
    reload: number;
    mesh: T.Group;
    side: number;
  }[] = [];
  private deferredSelection = false;
  get turboConfig() {
    return turboStats(this.power, this.mobility, !!this.riding);
  }
  private get auxiliaryWeapons() {
    return this.inventory
      .filter(
        (i) =>
          WEAPONS[i] !== this.activeWeaponSpec &&
          ((i === this.weapon ? this.ammo : this.magazines[i]) > 0 ||
            this.reserves[i] > 0),
      )
      .sort((a, b) => WEAPONS[b].priority - WEAPONS[a].priority);
  }
  private get primaryHasAmmo() {
    return this.usesPersonalWeapon
      ? this.ammo > 0 || this.reserves[this.weapon] > 0
      : this.riding!.ammo > 0;
  }
  get canTurbo() {
    return (
      this.phase === "playing" &&
      this.turboTime === 0 &&
      this.turboCooldown === 0 &&
      this.turboConfig.unlocked &&
      this.primaryHasAmmo &&
      this.auxiliaryWeapons.length > 0
    );
  }
  get turboLabel() {
    if (this.turboTime > 0) return `TURBO ${this.turboTime.toFixed(1)}s`;
    if (!this.turboConfig.unlocked) return "TURBO / UPGRADE";
    if (this.turboCooldown > 0)
      return `TURBO / ${Math.ceil(this.turboCooldown)}s`;
    if (!this.primaryHasAmmo) return "TURBO / PRIMARY EMPTY";
    if (!this.auxiliaryWeapons.length) return "TURBO / NEED 2 GUNS";
    return "TURBO READY";
  }
  activateTurbo() {
    if (!this.canTurbo) return false;
    this.magazines[this.weapon] = this.ammo;
    this.turboTime = this.turboConfig.duration;
    this.turboBanks = this.auxiliaryWeapons
      .slice(0, this.turboConfig.guns - 1)
      .map((index, n) => {
        const mesh = model("weapon_" + WEAPONS[index].id);
        const side = (n === 0 ? -1 : 1) * (this.riding ? 0.9 : 0.48);
        this.world.actors.add(mesh);
        return { index, cool: 0, reload: 0, mesh, side };
      });
    this.onRadio(
      `Turbo engaged: ${1 + this.turboBanks.length} guns for ${this.turboTime.toFixed(1)}s. Hold FIRE.`,
    );
    return true;
  }
  private endTurbo() {
    if (this.turboTime > 0) this.turboCooldown = this.turboConfig.cooldown;
    this.turboTime = 0;
    for (const bank of this.turboBanks) bank.mesh.removeFromParent();
    this.turboBanks = [];
    if (this.deferredSelection) {
      this.deferredSelection = false;
      this.selectStrongestWeapon();
    }
  }
  private updateTurbo(dt: number, fire: boolean, angle: number) {
    if (this.turboTime <= 0) return;
    for (const bank of this.turboBanks) {
      const spec = WEAPONS[bank.index];
      bank.mesh.position.set(
        this.pos.x + Math.cos(angle) * bank.side,
        this.pos.y + (this.riding ? 1.5 : 1.25),
        this.pos.z - Math.sin(angle) * bank.side,
      );
      bank.mesh.rotation.y = angle;
      bank.cool = Math.max(0, bank.cool - dt);
      if (bank.reload > 0) {
        bank.reload = Math.max(0, bank.reload - dt);
        if (bank.reload === 0) {
          const add = Math.min(
            spec.mag - this.magazines[bank.index],
            this.reserves[bank.index],
          );
          this.magazines[bank.index] += add;
          this.reserves[bank.index] -= add;
        }
      }
      if (fire && bank.cool === 0 && bank.reload === 0) {
        if (this.magazines[bank.index] > 0) {
          this.magazines[bank.index]--;
          // The personal gun may be auxiliary to a mounted cannon. Keep its live bank in sync.
          if (bank.index === this.weapon)
            this.ammo = this.magazines[bank.index];
          this.fireWeapon(spec, angle, !!this.riding, bank.side);
          bank.cool = spec.cool;
        } else if (this.reserves[bank.index] > 0) bank.reload = spec.reload;
      }
      if (bank.index === this.weapon) this.ammo = this.magazines[bank.index];
    }
    if (this.turboTime <= dt) this.endTurbo();
    else this.turboTime -= dt;
  }
  private shownWeapon = -1;
  get weaponSpec() {
    return WEAPONS[this.weapon];
  }
  get usesPersonalWeapon() {
    return (
      !this.riding ||
      this.riding.kind === "motorcycle" ||
      (this.riding.kind === "tank" && this.riding.personalWeapon)
    );
  }
  get activeWeaponSpec() {
    return this.usesPersonalWeapon
      ? this.weaponSpec
      : WEAPONS[this.riding!.spec.weapon];
  }
  get canSwapWeapon() {
    return this.riding?.kind !== "jeep" && this.turboTime === 0;
  }
  private selectStrongestWeapon() {
    if (this.turboTime > 0) {
      this.deferredSelection = true;
      return;
    }
    this.magazines[this.weapon] = this.ammo;
    const usable = this.inventory.filter(
      (i) => this.magazines[i] > 0 || this.reserves[i] > 0,
    );
    // Limited grenades are deliberate picks: never auto-equip one while any gun
    // still has ammunition, or held auto-fire would lob the whole supply.
    const thrown = (i: number) =>
      WEAPONS[i].visual === "grenade" || WEAPONS[i].visual === "gas";
    const guns = usable.filter((i) => !thrown(i));
    const best = (guns.length ? guns : usable).sort(
      (a, b) => WEAPONS[b].priority - WEAPONS[a].priority,
    )[0];
    const tank = this.riding?.kind === "tank" ? this.riding : undefined;
    const cannon =
      !!tank &&
      tank.ammo > 0 &&
      (best === undefined ||
        WEAPONS[tank.spec.weapon].priority >= WEAPONS[best].priority);
    if (best === undefined && !cannon) return;
    const selected = best ?? this.weapon;
    const changed =
      this.weapon !== selected || (!!tank && tank.personalWeapon === cannon);
    this.weapon = selected;
    this.ammo = this.magazines[selected];
    if (tank) tank.personalWeapon = !cannon;
    if (changed) {
      this.reloadTime = 0;
      this.shotTime = Math.max(this.shotTime, 0.25);
    }
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
  pendingGuards = 0;
  private reinforcementClock = 0;
  private reinforcementNext = 0;
  /** Presentation-only feedback (shake, hit-stop, streaks, hit numbers). */
  readonly feel = new Feel();
  onRadio: (text: string) => void = () => {};
  onSound: (type: string) => void = () => {};
  onEnd: (win: boolean) => void = () => {};
  private rescueMarkerGeo = new T.RingGeometry(1.05, 1.22, 32);
  private rescueMarkerMat = new T.MeshBasicMaterial({
    color: 0x57eaff,
    toneMapped: false,
    side: T.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private bulletGeo = new T.BoxGeometry(0.1, 0.1, 0.65);
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
    ammo: new T.MeshStandardMaterial({
      color: 0xe7ad44,
      emissive: 0x604015,
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
    this.squad = new Squad(world);
    this.impacts = new ImpactEffects(world.actors);
    this.destruction = new DestructionEffects(world.actors, (x, z) =>
      world.groundHeight(x, z),
    );
    this.player = model("commando");
  }
  get mag() {
    return this.weaponSpec.mag;
  }
  get pos() {
    return this.player.position;
  }
  /** The next mission goal for the guide arrow and HUD (presentation only). */
  get goal() {
    const m = MISSIONS[this.index];
    return nextGoal({
      from: this.pos,
      relaySecured: this.objective,
      cleared: this.bossDead,
      finale: m.finale,
      relay: m.objective,
      extract: m.extract,
      hostiles: m.finale
        ? this.enemies.filter((e) => e.boss && e.hp > 0)
        : [...this.guardIds].filter((e) => e.hp > 0),
    });
  }
  get boss() {
    return this.enemies.find((e) => e.boss && e.hp > 0);
  }
  start(
    index: number,
    save: {
      armor: number;
      power: number;
      mobility: number;
      squad?: number;
      fieldKit?: number;
    },
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
    this.pendingGuards = 0;
    this.reinforcementClock = 0;
    this.reinforcementNext = 0;
    this.world.build(index);
    const mission = MISSIONS[index];
    this.friendlyTracer.dispose();
    this.friendlyTracer = tracerGeometry(
      ["ice", "sand", "city"].includes(mission.biome) ? 0xff9418 : 0xffc62b,
    );
    this.refreshCoverGrid();
    this.player = model("commando", mission.start.x, mission.start.z);
    this.world.resetCamera(this.player.position);
    this.playerMotion = new CharacterMotion(this.player);
    this.deathClock = 0;
    this.world.actors.add(this.player);
    this.difficulty = difficulty;
    this.power = save.power;
    this.combatNotice = "";
    this.combatNoticeUntil = 0;
    this.roleHints.clear();
    this.blastAimTime = 0;
    this.blastTarget = undefined;
    this.blastMarker.visible = false;
    this.blastMarker.rotation.x = -Math.PI / 2;
    this.world.actors.add(this.blastMarker);
    this.grenadeMarker.visible = false;
    this.grenadeMarker.rotation.x = -Math.PI / 2;
    this.world.actors.add(this.grenadeMarker);
    this.mobility = save.mobility;
    this.maxHp = difficultyConfig(difficulty).health + save.armor * 35;
    this.hp = this.maxHp;
    this.shield = Math.min(3, Math.max(0, save.fieldKit ?? 0)) * 10;
    this.credits = this.rescued = 0;
    this.ammo = 24;
    this.magazines = WEAPONS.map((w) => w.mag);
    this.reserves = WEAPONS.map((w, i) => (i < 2 ? Infinity : w.mag * 3));
    this.reserves[9] += Math.min(3, Math.max(0, save.fieldKit ?? 0));
    this.inventory = [0, 9];
    this.shownWeapon = -1;
    this.weapon = 0;
    this.reloadTime = 0;
    this.shotTime = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.invincible = 0;
    this.elapsed = 0;
    this.feel.reset();
    this.kills = 0;
    this.score = 0;
    this.objective = false;
    this.bossSpawned = false;
    this.bossDead = false;
    this.phase = "playing";
    const pacing = missionPacing(mission.stage, mission.level);
    const vehicleBays = placeVehicles(
      mission.route,
      COVER,
      PATCHES,
      WORLD_BOUNDS,
      mission.roads,
      pacing,
    );
    this.rides = vehicleBays.map((p) => {
      const ride = new Ride(p.kind as "motorcycle" | "jeep" | "tank", p.x, p.z);
      ride.heading = Math.atan2(p.anchor.nz, -p.anchor.nx);
      ride.mesh.rotation.y = ride.heading;
      return ride;
    });
    for (const v of this.rides) this.world.actors.add(v.mesh);
    this.supplySeed = crypto.getRandomValues(new Uint32Array(1))[0];
    const drops = placeSupplies(
      mission.route,
      [...COVER, ...this.rides.map((v) => v.box)],
      PATCHES,
      WORLD_BOUNDS,
      this.supplySeed,
      mission.roads,
      pacing,
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
    const obstacles = [...COVER, ...this.rides.map((v) => v.box)];
    this.squad.deploy(save.squad ?? 0, mission.start, obstacles);
    for (const box of COVER.filter((b) => b.kind === "prison")) {
      const mesh = model("prisonHouse", box.x, box.z),
        captive = model("captive", box.entrance!.x, box.entrance!.z);
      mesh.rotation.y = box.rotation!;
      captive.rotation.y = box.rotation!;
      captive.position.y = this.world.groundHeight(
        captive.position.x,
        captive.position.z,
      );
      mesh.userData.batchActor = true;
      mesh.userData.batchRadius = 5;
      captive.userData.batchActor = true;
      let gate: T.Object3D | undefined;
      mesh.traverse((o) => {
        if (o.userData.joint === "Gate") gate = o;
      });
      const marker = new T.Mesh(this.rescueMarkerGeo, this.rescueMarkerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(box.exit!.x, 0.055, box.exit!.z);
      this.world.actors.add(mesh, captive, marker);
      this.prisons.push({
        box,
        mesh,
        captive,
        marker,
        gate,
        freed: false,
        open: 0,
        collisionOpen: false,
      });
    }
    for (const p of fieldBonuses(mission, obstacles, PATCHES, drops)) {
      if (p.kind === "weapon") {
        const mesh = this.supplyCrate("weapon", p.x, p.z, 2);
        mesh.userData.bonusRounds = 60;
        this.weaponDrops.push({ mesh, index: 2 });
      } else this.addTreasure(p.kind as keyof typeof TREASURE, p.x, p.z);
    }
    const patrols = guardedPatrols(
      SPAWNS,
      [
        ...vehicleBays,
        ...drops.filter(
          (d) => d.kind === "weapon" && [3, 7, 8].includes(d.index),
        ),
      ],
      obstacles,
      WORLD_BOUNDS,
    );
    const multiplier = difficultyConfig(difficulty).soldiers * pacing.density;
    patrols.forEach(
      (p: { x: number; z: number; cacheGuard: boolean }, i: number) => {
        for (let n = 0; n < multiplier; n++) {
          const before = this.enemies.length;
          this.spawn(
            p.x +
              ((n % Math.ceil(Math.sqrt(multiplier))) -
                (Math.ceil(Math.sqrt(multiplier)) - 1) / 2) *
                1.6,
            p.z - Math.floor(n / Math.ceil(Math.sqrt(multiplier))) * 1.6,
            false,
            i * multiplier + n,
            undefined,
            false,
            undefined,
            infantryRole(this.index, i * multiplier + n) as InfantryRole,
          );
          if (p.cacheGuard && this.enemies.length > before)
            this.enemies.at(-1)!.cacheGuard = true;
        }
      },
    );
    for (const p of depotGuardPositions(
      this.enemies,
      COVER,
      WORLD_BOUNDS,
      mission.start,
      this.rides.map((v) => ({
        x: v.mesh.position.x,
        z: v.mesh.position.z,
        radius: v.spec.radius,
      })),
    )) {
      const e = this.enemies[p.index];
      e.x = p.x;
      e.z = p.z;
      e.mesh.position.set(p.x, this.world.groundHeight(p.x, p.z), p.z);
    }
    const tanks =
      (pacing.tanks ?? Math.max(3, Math.floor(patrols.length / 8))) *
      difficultyConfig(difficulty).soldiers;
    for (let i = 0; i < tanks; i++) {
      const p =
        patrols[
          Math.min(
            patrols.length - 1,
            Math.floor(((i + 1) * patrols.length) / (tanks + 1)),
          )
        ];
      this.spawn(p.x, p.z - 3, false, 10000 + i, mission.bossModel, true);
    }
    this.showWeapon();
  }
  private addTreasure(kind: keyof typeof TREASURE, x: number, z: number) {
    const mesh = model(kind, x, z);
    mesh.userData.kind = kind;
    mesh.userData.batchActor = true;
    this.treasures.push(mesh);
    this.world.actors.add(mesh);
  }
  private updateRescues(dt: number) {
    for (const prison of this.prisons) {
      const exit = prison.box.exit!;
      if (
        !prison.freed &&
        this.canCollect(new T.Vector3(exit.x, 0, exit.z), 1.8)
      ) {
        prison.freed = true;
        prison.marker.visible = false;
        prison.captive.removeFromParent();
        this.rescued++;
        const joined = this.squad.add(
          prison.box.entrance!.x,
          prison.box.entrance!.z,
          prison.box,
        );
        this.score += 250;
        this.addTreasure("diamond", exit.x, exit.z);
        this.onRadio(
          joined
            ? "Prisoner freed! Your ally follows and fires in your direction. Recover the diamond, then extract to keep your squad and treasure."
            : "Prisoner evacuated. Your three-person support squad is full; recover the rescue diamond.",
        );
        this.combatMessage(
          joined ? "ALLY RESCUED · SQUAD +1" : "PRISONER EVACUATED",
          2,
        );
        this.onSound("objective");
      }
      if (prison.freed) {
        prison.open = Math.min(1, prison.open + dt * 1.6);
        if (prison.gate) prison.gate.position.y = prison.open * 2.6;
        if (prison.open === 1 && !prison.collisionOpen) {
          prison.collisionOpen = true;
          const index = COVER.indexOf(prison.box);
          if (index !== -1) {
            COVER.splice(index, 1, ...openedPrisonWalls(prison.box));
            this.coverCount = -1; // Length alone cannot detect same-tick swaps.
            this.refreshCoverGrid();
          }
        }
      }
    }
    for (let i = this.treasures.length - 1; i >= 0; i--) {
      const t = this.treasures[i];
      t.position.y =
        this.world.groundHeight(t.position.x, t.position.z) +
        0.22 +
        Math.sin(this.elapsed * 2 + i) * 0.08;
      t.rotation.y += dt * 0.6;
      if (this.canCollect(t.position, 1.4)) {
        const kind = t.userData.kind as keyof typeof TREASURE;
        this.credits += TREASURE[kind];
        this.score += TREASURE[kind];
        t.removeFromParent();
        this.treasures.splice(i, 1);
        this.combatMessage(
          `${kind.toUpperCase()} +${TREASURE[kind]} · EXTRACT TO BANK`,
          1.2,
        );
        this.onSound("objective");
      }
    }
  }
  private supplyCrate(
    kind: "health" | "shield" | "weapon" | "ammo",
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
    } else if (kind === "ammo") {
      for (const offset of [-0.16, 0, 0.16]) {
        const stripe = new T.Mesh(this.supplyCrossGeo, this.insigniaMat);
        stripe.scale.set(0.25, 1, 0.7);
        stripe.position.set(offset, 0.86, 0);
        root.add(stripe);
      }
    } else {
      const weapon = model("weapon_" + WEAPONS[index].id, 0, 0, 1.25);
      weapon.position.y = 1.05;
      weapon.rotation.z = Math.PI / 2;
      root.add(weapon);
    }
    this.world.actors.add(root);
    return root;
  }
  private refreshCoverGrid() {
    if (this.coverCount === COVER.length) return;
    this.coverCount = COVER.length;
    this.coverGrid.clear();
    this.liveCover = new Set(COVER);
    for (const box of COVER)
      this.coverGrid.insert(box, box.x, box.z, box.w, box.d);
  }
  private rebuildEnemyGrid() {
    this.enemyGrid.clear();
    for (const e of this.enemies)
      if (e.hp > 0) this.enemyGrid.insert(e, e.x, e.z, e.radius * 2);
  }
  cleanup() {
    this.deferredSelection = false;
    this.endTurbo();
    this.turboCooldown = 0;
    this.destruction.clear();
    this.enemyGrid.clear();
    this.coverGrid.clear();
    this.coverCount = -1;
    this.impacts.clear();
    for (const corpse of this.corpses) corpse.dispose();
    this.corpses = [];
    this.squad.clear();
    for (const p of this.prisons) {
      p.mesh.removeFromParent();
      p.captive.removeFromParent();
      p.marker.removeFromParent();
    }
    for (const t of this.treasures) t.removeFromParent();
    this.prisons = [];
    this.treasures = [];
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
    this.enemies = [];
    this.bullets = [];
    this.effects = [];
    this.pickups = [];
  }
  spawn(
    x: number,
    z: number,
    boss: boolean,
    index: number,
    bossKind = MISSIONS[this.index].bossModel,
    armored = false,
    entrance?: Box,
    role: InfantryRole = "rifleman",
  ) {
    const def = BOSS_DEFS[bossKind as keyof typeof BOSS_DEFS];
    if (!boss || def.ground) {
      const clearance = boss ? def.radius : armored ? 1.7 : 0.65;
      this.refreshCoverGrid();
      const obstacles = [
        ...this.rides.filter((v) => v.hp > 0).map((v) => v.box),
      ];
      const clear = (px: number, pz: number) =>
        Math.abs(px) < WORLD_BOUNDS.x - clearance &&
        pz > WORLD_BOUNDS.minZ + 2 &&
        pz < WORLD_BOUNDS.maxZ - 2 &&
        ![...obstacles, ...this.coverGrid.near(px, pz, clearance)].some(
          (b: any) =>
            b !== entrance &&
            segmentBox(px, pz, px, pz, b, clearance) !== Infinity,
        ) &&
        !this.enemyGrid
          .near(px, pz, clearance + 3)
          .some(
            (other: any) =>
              other.hp > 0 &&
              Math.hypot(px - other.x, pz - other.z) <
                clearance + other.radius + 0.12,
          );
      if (!clear(x, z)) {
        if (entrance) return; // An occupied door waits; guards never teleport elsewhere.
        let found = false;
        for (let r = 1; r <= 18 && !found; r++)
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
      boss ? bossKind : armored ? "tank" : "rifleman",
      x,
      z,
      boss ? def.scale : armored ? 0.62 : 1,
    );
    if (!boss && !armored) equipInfantry(mesh, role);
    if (armored && !boss) repaint(mesh, HOSTILE_ARMOR, "hostile");
    if (boss && bossKind === "gunship") mesh.position.y = 4;
    if (!boss) mesh.rotation.y = ((index % 4) * Math.PI) / 2;
    mesh.userData.lowRange = 48;
    mesh.userData.batchActor = !boss;
    const max = boss
      ? def.hp + MISSIONS[this.index].stage * 100
      : armored
        ? 230 + MISSIONS[this.index].stage * 25
        : INFANTRY[role].hp + MISSIONS[this.index].level * 8;
    const warn = new T.Mesh(
      !boss && !armored && role !== "rifleman"
        ? infantryWarnings[role]
        : this.warnGeo,
      this.warnMat,
    );
    warn.visible = false;
    warn.rotation.x = -Math.PI / 2;
    warn.position.set(x, 0.07, z);
    this.world.actors.add(mesh, warn);
    const muzzles = new Map<string, T.Object3D>();
    mesh.traverse((o) => {
      if (o.userData.joint) muzzles.set(o.userData.joint, o);
    });
    this.enemies.push({
      mesh,
      muzzles,
      auxCool: 1.4 + (index % 4) * 0.2,
      motion:
        (!boss && !armored) || (boss && def.humanoid)
          ? new CharacterMotion(mesh)
          : undefined,
      vehicleMotion:
        boss || armored
          ? new VehicleMotion(
              mesh,
              armored || bossKind === "laserTank" ? "tank" : bossKind,
            )
          : undefined,
      x,
      z,
      hp: max,
      max,
      cool: 1.1 + (index % 8) * 0.22,
      bossKind: boss ? bossKind : undefined,
      anchor: boss ? { x, z } : undefined,
      radius: boss ? def.radius : armored ? 1.7 : 0.65,
      armored,
      role: !boss && !armored ? role : undefined,
      boss,
      index,
      warn,
    });
    const actor = this.enemies.at(-1)!;
    this.enemyGrid.insert(actor, x, z, actor.radius * 2);
    return actor;
  }
  showWeapon() {
    if (this.riding && this.usesPersonalWeapon)
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
      this.endTurbo();
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
    this.endTurbo();
    this.riding = v;
    v.rider.visible = true;
    this.player.visible = false;
    this.dashTime = 0;
    this.reloadTime = 0;
    this.pos.copy(v.mesh.position);
    this.onRadio(
      v.spec.name +
        " boarded. Move to drive, FIRE to shoot, USE to exit." +
        (v.kind === "tank"
          ? " Q / SWAP cycles cannon and collected weapons."
          : ""),
    );
  }
  private damageHealth(damage: number) {
    const absorbed = Math.min(this.shield, damage);
    this.shield -= absorbed;
    this.hp = Math.max(0, this.hp - (damage - absorbed));
  }
  takeDamage(damage: number, from?: { x: number; z: number }) {
    if (damage > 0) this.feel.hurt(damage, hurtAngle(this.pos, from));
    if (this.riding) {
      const v = this.riding;
      v.hp = Math.max(0, v.hp - damage);
      if (v.hp === 0) {
        const exit = v.exitPoint(this.rides, false);
        this.endTurbo();
        this.riding = undefined;
        v.rider.visible = false;
        this.player.visible = true;
        v.speed = 0;
        if (exit) this.pos.set(exit.x, 0, exit.z);
        this.damageHealth(25);
        this.spark(v.mesh.position.x, v.mesh.position.z, true);
        this.addCorpse(new FallenBody(v.mesh, undefined, v.kind));
        this.invincible = 1;
        this.onRadio("Vehicle destroyed! Emergency evacuation.");
      }
    } else this.damageHealth(damage);
  }
  blast(
    x: number,
    z: number,
    spec: WeaponSpec,
    damage: number,
    height?: number,
    hostile = false,
  ) {
    this.impacts.emit(
      x,
      height ?? this.world.groundHeight(x, z) + 0.6,
      z,
      spec.visual,
      this.world.lowDetail,
      spec.splash,
      true,
    );
    this.onSound("explosion");
    this.feel.blast(Math.hypot(this.pos.x - x, this.pos.z - z), spec.splash);
    for (const enemy of this.enemies) {
      const d = Math.hypot(enemy.x - x, enemy.z - z);
      if (!hostile && enemy.hp > 0 && !enemy.boss && d < 14) {
        enemy.alerted = true;
        enemy.memory = 6;
        enemy.lastSeen = { x, z };
        enemy.routeTime = 0;
      }
      if (
        !hostile &&
        enemy.hp > 0 &&
        d < spec.splash + enemy.radius &&
        !COVER.some((b) => segmentBox(x, z, enemy.x, enemy.z, b) !== Infinity)
      )
        this.hurt(
          enemy,
          damage * Math.max(0.25, 1 - d / (spec.splash + enemy.radius)),
          spec,
          undefined,
          { x: enemy.x - x, z: enemy.z - z },
        );
    }
    if (
      hostile &&
      this.invincible === 0 &&
      Math.hypot(this.pos.x - x, this.pos.z - z) <
        spec.splash + (this.riding?.spec.radius ?? 0.5) &&
      !COVER.some(
        (box) => segmentBox(x, z, this.pos.x, this.pos.z, box) !== Infinity,
      )
    ) {
      this.takeDamage(damage, { x, z });
      this.invincible = Math.max(this.invincible, 0.18);
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
  fireWeapon(spec: WeaponSpec, angle: number, mounted = false, side = 0) {
    // Gunfire reveals its source locally; concealed enemies investigate that position.
    for (const e of this.enemyGrid.near(
      this.pos.x,
      this.pos.z,
      14,
    ) as Actor[]) {
      if (
        spec.id === "throwBomb" ||
        e.hp <= 0 ||
        e.boss ||
        Math.hypot(e.x - this.pos.x, e.z - this.pos.z) > 14
      )
        continue;
      e.alerted = true;
      e.memory = 6;
      if (
        !e.lastSeen ||
        Math.hypot(e.lastSeen.x - this.pos.x, e.lastSeen.z - this.pos.z) > 2
      )
        e.routeTime = 0;
      e.lastSeen = { x: this.pos.x, z: this.pos.z };
    }
    const x = this.pos.x + Math.cos(angle) * side,
      z = this.pos.z - Math.sin(angle) * side,
      damage = spec.damage * (1 + this.power * 0.2);
    if (spec.visual === "laser") {
      const tx = x + Math.sin(angle) * 40,
        tz = z + Math.cos(angle) * 40;
      let t = 1;
      for (const b of COVER) t = Math.min(t, segmentBox(x, z, tx, tz, b));
      for (const e of this.enemies)
        if (e.hp > 0 && segmentCircle(x, z, tx, tz, e.x, e.z, e.radius) < t)
          this.hurt(
            e,
            damage,
            spec,
            undefined,
            {
              x: Math.sin(angle),
              z: Math.cos(angle),
            },
            { x, z },
          );
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
        this.shoot(
          x,
          z,
          angle + spread,
          false,
          damage,
          spec.id === "throwBomb" ? this.throwDistance / spec.life : spec.speed,
          spec,
        );
      }
    if (!mounted) this.playerMotion.kick();
    this.onSound(
      spec.id === "throwBomb" ? "throw" : spec.splash ? "explosion" : "shot",
    );
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
    originY = 0.95,
    flashOffset = 0.7,
  ) {
    if (spec?.visual !== "knife") {
      const flash = new T.Mesh(this.effectGeo, this.effectMat.clone());
      flash.position.set(
        x + Math.sin(angle) * flashOffset,
        originY,
        z + Math.cos(angle) * flashOffset,
      );
      flash.scale.set(0.32, 0.32, 0.8);
      flash.rotation.y = angle;
      flash.material.color.setHex(0xffe8a5);
      this.world.actors.add(flash);
      this.effects.push({ mesh: flash, life: 0.055, max: 0.055 });
    }
    let mesh: T.Object3D;
    const visual = spec?.visual;
    if (visual === "knife") {
      mesh = new T.Group();
      mesh.add(model("projectile_knife"));
      const trail = new T.Mesh(this.hostileTracer, this.tracerMaterial);
      trail.scale.set(0.8, 0.8, 0.9);
      trail.position.z = -0.3;
      mesh.add(trail); // Small warm streak keeps the spinning steel readable over snow.
    } else if (
      visual === "rocket" ||
      visual === "arrow" ||
      visual === "grenade" ||
      visual === "gas"
    )
      mesh = model("projectile_" + (visual === "gas" ? "grenade" : visual));
    else {
      mesh = new T.Mesh(
        visual === "flame"
          ? this.effectGeo
          : enemy
            ? this.hostileTracer
            : this.friendlyTracer,
        visual === "flame" ? this.effectMat : this.tracerMaterial,
      );
      if (visual === "sniper") mesh.scale.z = 3;
    }

    mesh.position.set(x, originY, z);
    mesh.rotation.y = angle;
    this.world.actors.add(mesh);
    this.bullets.push({
      mesh,
      originX: x,
      originZ: z,
      originY,
      spec,
      age: 0,
      maxLife:
        enemy && !spec?.id.startsWith("enemy") ? 4 : (spec?.life ?? 1.05),
      hits: new Set(),
      x,
      z,
      vx: Math.sin(angle) * speed,
      vz: Math.cos(angle) * speed,
      life: enemy && !spec?.id.startsWith("enemy") ? 4 : (spec?.life ?? 1.05),
      damage,
      enemy,
    });
  }
  hurt(
    e: Actor,
    damage: number,
    spec?: WeaponSpec,
    contact?: { x: number; z: number },
    direction?: { x: number; z: number },
    source?: { x: number; z: number },
  ) {
    if (e.hp <= 0) return; // A dead actor can award score only once.
    const rear = rearHit(e, spec, direction, e.mesh.rotation.y);
    const armor =
      rear && e.armored
        ? Math.max(0.65, armorMultiplier(e, spec))
        : armorMultiplier(e, spec);
    damage *= armor * (rear && !e.armored ? 1.75 : 1);
    e.alerted = true;
    e.memory = 8;
    // A delayed hit reveals where the shot originated, never the shooter's current hidden position.
    if (source) e.lastSeen = { ...source };
    else if (spec && spec.splash === 0 && direction) {
      const distance = Math.hypot(direction.x, direction.z) || 1;
      e.lastSeen = {
        x: e.x - (direction.x / distance) * 12,
        z: e.z - (direction.z / distance) * 12,
      };
    } else e.lastSeen ??= { x: e.x, z: e.z };
    e.routeTime = 0;
    if (rear)
      this.combatMessage(
        e.armored ? "REAR ARMOR BREACHED" : "REAR HIT · 1.75× DAMAGE",
      );
    e.motion?.hit();
    const dealt = Math.min(damage, Math.max(0, e.hp)); // Never show overkill.
    e.hp -= damage;
    if (dealt > 0)
      this.feel.hit(
        contact?.x ?? e.x,
        e.mesh.position.y + (e.boss ? 3.2 : e.armored ? 2.2 : 2),
        contact?.z ?? e.z,
        dealt,
        e.hp <= 0 ? "kill" : armor < 1 ? "armor" : rear ? "rear" : "hit",
      );
    if (armor < 1 && e.hp > 0 && !rear)
      this.combatMessage("ARMOR DEFLECTS · USE ROCKETS / LASER");
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
    if (spec) {
      if (spec.splash === 0 || spec.visual === "gas")
        this.impacts.emit(
          contact?.x ?? e.x,
          e.mesh.position.y + (e.boss ? 1.5 : 1),
          contact?.z ?? e.z,
          armor < 1 ? "armor" : spec.visual,
          this.world.lowDetail,
          spec.visual === "sniper"
            ? 1.2
            : spec.visual === "flame"
              ? 1.05
              : 0.85,
        );
      this.onSound(armor < 1 ? "armor" : "hit");
    } else this.spark(e.x, e.z);
    if (e.hp <= 0) {
      this.kills++;
      this.feel.kill(this.elapsed, e.boss ? 1 : e.armored ? 0.5 : 0);
      if (this.feel.banner?.time === this.elapsed) this.onSound("streak");
      this.score += e.boss ? 1500 : e.armored ? 350 : 100;
      if (rear) {
        this.score += 50;
        const gained = Math.min(5, this.maxShield - this.shield);
        this.shield += gained;
        this.combatMessage(`FLANK FINISH · +50 SCORE · +${gained} SHIELD`, 2);
      }
      this.world.actors.remove(e.warn);
      const tank = e.armored || e.bossKind === "laserTank";
      const dx = direction?.x ?? e.x - this.pos.x,
        dz = direction?.z ?? e.z - this.pos.z;
      const length = Math.hypot(dx, dz) || 1;
      if (tank && spec && spec.splash > 0)
        this.destruction.vehicle(e.mesh, this.world.lowDetail);
      else
        this.addCorpse(
          new FallenBody(
            e.mesh,
            e.motion,
            e.boss ? e.bossKind : e.armored ? "tank" : "human",
            !e.boss && !e.armored
              ? {
                  x: dx,
                  z: dz,
                  distance: knockbackDistance(
                    damage,
                    spec?.priority ?? 0,
                    spec?.splash ?? 0,
                  ),
                }
              : undefined,
          ),
        );
      if (!e.boss && !e.armored)
        this.destruction.blood(
          e.x,
          e.z,
          dx / length,
          dz / length,
          this.world.lowDetail,
        );
      if (e.boss) this.spark(e.x, e.z, true);
      if (e.beam) {
        this.world.actors.remove(e.beam);
        e.beam.material.dispose();
        e.beam = undefined;
      }
      if (e.boss || this.guardIds.has(e)) {
        this.checkExtraction();
      }
      const loot = enemyLoot();
      if (loot) {
        // Bounded, temporary enemy loot keeps Crazy mode affordable on mobile.
        const existing = this.pickups.filter(
          (p) => p.userData.expires !== undefined,
        );
        if (existing.length >= 48) {
          this.world.actors.remove(existing[0]);
          this.pickups.splice(this.pickups.indexOf(existing[0]), 1);
        }
        const p = this.supplyCrate(loot, e.x, e.z);
        p.userData.expires = this.elapsed + 45;
        this.pickups.push(p);
      }
    }
  }
  private updateInfantryAttack(e: Actor, dt: number, cover: Box[]) {
    const attack = e.attack;
    if (!attack || !e.role || e.role === "rifleman") {
      e.warn.visible = false;
      return;
    }
    const profile = INFANTRY[e.role];
    attack.time += dt;
    e.warn.visible = !attack.fired;
    e.warn.rotation.set(-Math.PI / 2, 0, attack.aim);
    if (profile.melee) e.warn.scale.setScalar(attack.reach);
    else if (e.role === "rocketeer") e.warn.scale.set(1, attack.reach, 1);
    else e.warn.scale.setScalar(1.2);
    if (!attack.fired && attack.time >= profile.warning) {
      attack.fired = true;
      e.warn.visible = false;
      e.cool = profile.recovery;
      if (profile.melee) {
        const radius = this.riding?.spec.radius ?? 0.52;
        if (
          this.invincible === 0 &&
          inMeleeSector(
            e,
            this.pos,
            attack.aim,
            profile.reach,
            profile.arc,
            radius,
          ) &&
          !cover.some(
            (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) !== Infinity,
          )
        ) {
          // Blades cannot meaningfully penetrate a tank; boots/jeeps remain vulnerable.
          this.takeDamage(this.riding?.kind === "tank" ? 1 : profile.damage, {
            x: e.x,
            z: e.z,
          });
          this.invincible = Math.max(this.invincible, 0.25);
          this.playerMotion.hit();
          this.spark(this.pos.x, this.pos.z);
          this.onSound("damage");
        }
      } else {
        const spec =
          e.role === "rocketeer" ? ENEMY_WEAPONS.rocket : ENEMY_WEAPONS.knife;
        this.shoot(
          e.x,
          e.z,
          attack.aim,
          true,
          spec.damage,
          spec.speed,
          spec,
          this.world.groundHeight(e.x, e.z) + 1.15,
        );
        e.motion?.kick();
      }
    }
    if (attack.time >= profile.warning + 0.24) e.attack = undefined;
  }
  private updateReinforcements(dt: number) {
    if (!this.pendingGuards || this.quakeTime > 0 || this.hp <= 0) return;
    this.reinforcementClock -= dt;
    if (this.reinforcementClock > 0) return;
    this.reinforcementClock = 0.25;
    const houses = COVER.filter((b) => b.asset === "relayHouse");
    for (let offset = 0; offset < houses.length; offset++) {
      const index = (this.reinforcementNext + offset) % houses.length;
      const house = houses[index],
        entry = house.entrance!,
        exit = house.exit!;
      const clearance = this.riding ? this.riding.spec.radius + 0.8 : 1.5;
      if (
        Math.hypot(this.pos.x - exit.x, this.pos.z - exit.z) < clearance ||
        this.rides.some(
          (v) =>
            v.hp > 0 &&
            segmentBox(entry.x, entry.z, exit.x, exit.z, v.box, 0.7) !==
              Infinity,
        ) ||
        this.enemies.some(
          (e) =>
            e.hp > 0 &&
            (e.emerging === house ||
              Math.hypot(e.x - exit.x, e.z - exit.z) < e.radius + 0.9),
        )
      )
        continue;
      const guard = this.spawn(
        entry.x,
        entry.z,
        false,
        200 + this.guardIds.size,
        undefined,
        false,
        house,
        // Opening relay guards stay simple. Later garrisons also field specialists.
        this.index === 0
          ? "rifleman"
          : (infantryRole(this.index, this.guardIds.size + 2) as InfantryRole),
      );
      if (!guard) continue;
      guard.emerging = house;
      guard.mesh.rotation.y = house.rotation!;
      guard.alerted = true;
      guard.memory = 12;
      guard.lastSeen = { ...MISSIONS[this.index].objective };
      guard.warn.visible = false;
      this.guardIds.add(guard);
      this.pendingGuards--;
      this.reinforcementNext = index + 1;
      this.reinforcementClock = 0.85;
      break;
    }
  }
  private checkExtraction() {
    if (!this.objective || this.bossDead) return;
    const cleared = MISSIONS[this.index].finale
      ? this.bossSpawned && !this.enemies.some((e) => e.boss && e.hp > 0)
      : this.pendingGuards === 0 && [...this.guardIds].every((e) => e.hp <= 0);
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
    if (prop.hp > 0) {
      if (box.asset === "ruinWall")
        this.impacts.emit(box.x, 1, box.z, "stone", this.world.lowDetail, 0.55);
      if (prop.kind === "tree" || prop.kind === "snowTree")
        this.impacts.emit(box.x, 1, box.z, "leaf", this.world.lowDetail, 0.4);
      return;
    }
    this.world.destructibles.splice(this.world.destructibles.indexOf(prop), 1);
    COVER.splice(COVER.indexOf(box), 1);
    this.coverCount = -1;
    this.liveCover.delete(box);
    if (box.asset === "ruinWall") {
      prop.mesh.removeFromParent();
      this.impacts.emit(box.x, 0.6, box.z, "stone", this.world.lowDetail, 1.8);
      this.destruction.masonry(box.x, box.z, this.world.lowDetail);
      this.combatMessage("WALL BREACHED · FLANKING ROUTE OPEN", 1.5);
      return;
    }
    if (prop.kind !== "fuel" && prop.kind !== "explosive") {
      prop.mesh.removeFromParent();
      this.impacts.emit(box.x, 1.2, box.z, "leaf", this.world.lowDetail, 1.8);
      this.destruction.tree(box.x, box.z, this.world.lowDetail);
      return;
    }
    this.destruction.vehicle(prop.mesh, this.world.lowDetail);
    this.environmentExplosion(box.x, box.z);
  }
  private environmentExplosion(x: number, z: number) {
    const { radius } = ENV_BLAST;
    const beforeKills = this.kills;
    const rootBlast = this.blastDepth++ === 0;
    this.onSound("explosion");
    this.feel.blast(Math.hypot(this.pos.x - x, this.pos.z - z), 5);
    // Walls and buildings contain a blast; soft foliage and other explosive stores do not.
    const solid = COVER.filter(
      (b) => !["tree", "snowTree", "fuel", "explosive"].includes(b.kind ?? ""),
    );
    const damageAt = (
      tx: number,
      tz: number,
      maximum: number,
      r = 0,
      target?: Box,
    ) =>
      solid.some(
        (b) => b !== target && segmentBox(x, z, tx, tz, b) !== Infinity,
      )
        ? 0
        : blastDamage(Math.hypot(tx - x, tz - z), radius, maximum, r);
    for (const e of this.enemies) {
      const damage = damageAt(e.x, e.z, ENV_BLAST.enemy, e.radius);
      if (e.hp > 0 && damage > 0)
        this.hurt(e, damage, WEAPONS[7], undefined, { x: e.x - x, z: e.z - z });
    }
    const occupied = this.riding;
    const personal = damageAt(
      this.pos.x,
      this.pos.z,
      occupied ? ENV_BLAST.vehicle : ENV_BLAST.player,
      occupied?.spec.radius ?? 0.5,
    );
    if (personal > 0 && this.invincible === 0) {
      this.takeDamage(personal, { x, z });
      this.invincible = Math.max(this.invincible, 0.25);
      this.playerMotion.hit();
      this.onSound("damage");
    }
    for (const v of this.rides) {
      const damage = damageAt(
        v.mesh.position.x,
        v.mesh.position.z,
        ENV_BLAST.vehicle,
        v.spec.radius,
      );
      if (v === occupied || v.hp <= 0 || damage <= 0) continue;
      v.hp = Math.max(0, v.hp - damage);
      if (v.hp === 0) this.destruction.vehicle(v.mesh, this.world.lowDetail);
    }
    // Each store was removed before detonation, so reciprocal chains cannot score or explode twice.
    for (const next of [...this.world.destructibles]) {
      const damage = damageAt(
        next.box.x,
        next.box.z,
        ENV_BLAST.prop,
        0,
        next.box,
      );
      if (damage > 0) this.damageProp(next.box, damage);
    }
    this.impacts.emit(
      x,
      this.world.groundHeight(x, z) + 0.2,
      z,
      "fuel",
      this.world.lowDetail,
      radius,
      true,
    );
    this.blastDepth--;
    // Nested store detonations belong to one chain: award each kill only once.
    const defeated = this.kills - beforeKills;
    if (rootBlast && defeated > 0) {
      const bonus = Math.max(0, defeated - 1) * 75;
      const protection = Math.min(
        15,
        Math.max(0, defeated - 1) * 5,
        this.maxShield - this.shield,
      );
      this.score += bonus;
      this.shield += protection;
      this.combatMessage(
        `CHAIN BLAST · ${defeated} HOSTILES DOWN${bonus ? ` · +${bonus} SCORE · +${protection} SHIELD` : ""}`,
        2.5,
      );
    }
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
      // The anchor never moves: pick solid landing cover once, and again only
      // if that cover is destroyed. Saplings and explosive stores are not cover.
      if (!e.landingCover || !this.liveCover.has(e.landingCover))
        e.landingCover = COVER.filter(
          (b) =>
            !["fuel", "tree", "snowTree", "explosive"].includes(b.kind ?? ""),
        ).sort(
          (a, b) =>
            Math.hypot(a.x - anchor.x, a.z - anchor.z) -
            Math.hypot(b.x - anchor.x, b.z - anchor.z),
        )[0];
      const cover = e.landingCover;
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
    } else if (kind === "laserTank") {
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
    if (kind === "quadMech" || kind === "rocketMech" || kind === "missileTruck")
      this.moveCommandBoss(e, dt, aim);
    e.x = T.MathUtils.clamp(e.x, -WORLD_BOUNDS.x + 3, WORLD_BOUNDS.x - 3);
    e.z = T.MathUtils.clamp(e.z, WORLD_BOUNDS.minZ + 3, WORLD_BOUNDS.maxZ - 3);
    e.mesh.position.x = e.x;
    e.mesh.position.z = e.z;
    // Keep the weapon aimed along the locked warning while the laser charges.
    const facing = kind === "laserTank" ? (e.laserAim ?? aim) : aim;
    e.mesh.rotation.y = facing;
    e.vehicleMotion?.update(
      dt,
      (e.x - beforeX) / dt,
      facing,
      this.elapsed,
      (e.z - beforeZ) / dt,
      e.cool < 1.3,
    );
    e.motion?.update(dt, {
      vx: (e.x - beforeX) / dt / 1.8,
      vz: (e.z - beforeZ) / dt / 1.8,
      aiming: true,
    });
    e.mesh.updateMatrixWorld(true);
    e.cool -= dt;
    const sight = !COVER.some(
      (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) !== Infinity,
    );
    e.warn.visible = e.cool < 0.6 && sight;
    e.warn.position.set(e.x, 0.08, e.z);
    e.warn.scale.setScalar(3);
    this.updateSecondaryGun(e, dt, sight);
    if (
      kind === "quadMech" ||
      kind === "rocketMech" ||
      kind === "missileTruck"
    ) {
      this.commandBossAttack(e, sight);
      return;
    }
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
            this.takeDamage(BOSS_ATTACKS.laserTank.damage, { x: e.x, z: e.z });
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
  private moveCommandBoss(e: Actor, dt: number, aim: number) {
    const truck = e.bossKind === "missileTruck";
    const reloading =
      e.bossKind === "quadMech" &&
      !!e.volleys &&
      e.volleys % QUAD_GUNS.volleys === 0 &&
      e.cool > QUAD_GUNS.interval;
    const targetVisible =
      Math.hypot(this.pos.x - e.x, this.pos.z - e.z) <= 36 &&
      !COVER.some(
        (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) !== Infinity,
      );
    const charging =
      e.bossKind !== "quadMech" && e.cool <= 1.3 && targetVisible;
    e.state = reloading
      ? "GUNS COOLING / RELOAD"
      : charging
        ? "MISSILES LOCKING"
        : "TRACKING / ADVANCING";
    e.mesh.position.y = this.world.groundHeight(e.x, e.z);
    if (reloading || charging) return;
    const obstacles = [
      ...COVER,
      ...this.rides.filter((v) => v.hp > 0).map((v) => v.box),
    ];
    const distance = Math.hypot(this.pos.x - e.x, this.pos.z - e.z);
    const blocked = obstacles.some(
      (b) =>
        segmentBox(e.x, e.z, this.pos.x, this.pos.z, b, e.radius) !== Infinity,
    );
    let vx = 0,
      vz = 0;
    if (blocked) {
      e.routeTime = (e.routeTime ?? 0) - dt;
      if (e.routeTime <= 0 || !e.routeTarget) {
        e.routeTarget = routeStep(
          e.x,
          e.z,
          this.pos.x,
          this.pos.z,
          obstacles,
          e.radius,
          WORLD_BOUNDS,
        );
        e.routeTime = 0.8 + (e.index % 4) * 0.1;
      }
      const dx = e.routeTarget!.x - e.x,
        dz = e.routeTarget!.z - e.z,
        d = Math.hypot(dx, dz);
      if (d > 0.01) {
        vx = dx / d;
        vz = dz / d;
      }
    } else {
      const desired = truck ? 18 : 12;
      const advance =
        distance > desired ? 1 : distance < desired * 0.6 ? -0.6 : 0;
      const strafe = truck ? 0 : Math.sin(this.elapsed * 0.6 + e.index) * 0.3;
      vx = Math.sin(aim) * advance + Math.cos(aim) * strafe;
      vz = Math.cos(aim) * advance - Math.sin(aim) * strafe;
    }
    for (const other of this.enemyGrid.near(
      e.x,
      e.z,
      e.radius + 2.5,
    ) as Actor[]) {
      if (other === e || !other.boss || other.hp <= 0) continue;
      const dx = e.x - other.x,
        dz = e.z - other.z,
        d = Math.hypot(dx, dz);
      if (d > 0.01 && d < e.radius + other.radius + 1) {
        vx += (dx / d) * 0.8;
        vz += (dz / d) * 0.8;
      }
    }
    const speed = truck ? 1.5 : 2.2;
    const move = moveCircle(
      e.x,
      e.z,
      vx * dt * speed,
      vz * dt * speed,
      e.radius,
      obstacles,
      WORLD_BOUNDS,
    );
    e.x = move.x;
    e.z = move.z;
  }
  private fireMountedGuns(
    e: Actor,
    keys: string[],
    damage: number,
    speed: number,
    spread = 0,
  ) {
    e.mesh.updateMatrixWorld(true);
    for (let i = 0; i < keys.length; i++) {
      const mount = e.muzzles?.get(keys[i]);
      if (!mount) throw new Error(`${e.bossKind} is missing ${keys[i]}`);
      const p = mount.getWorldPosition(new T.Vector3());
      // Never let a long gun muzzle fire through the cover that surrounds its owner.
      if (
        COVER.some((b) => segmentBox(e.x, e.z, p.x, p.z, b, 0.05) !== Infinity)
      )
        continue;
      const aim =
        Math.atan2(this.pos.x - p.x, this.pos.z - p.z) +
        (i - (keys.length - 1) / 2) * spread;
      this.shoot(p.x, p.z, aim, true, damage, speed, undefined, p.y, 0);
    }
    e.motion?.kick();
    this.onSound("shot");
  }
  private updateSecondaryGun(e: Actor, dt: number, sight: boolean) {
    if (!e.muzzles?.has("MuzzleAux") && e.bossKind !== "rocketMech") return;
    e.auxCool = Math.max(-0.1, (e.auxCool ?? 1.4) - dt);
    const resting = e.state === "RESTING" || e.state === "LANDED / REARMING";
    if (resting) {
      e.auxCool = Math.max(e.auxCool, 0.65);
      return;
    }
    if (
      !sight ||
      Math.hypot(this.pos.x - e.x, this.pos.z - e.z) > AUX_GUN.range ||
      e.auxCool > 0
    )
      return;
    const rocket = e.bossKind === "rocketMech",
      profile = rocket ? ROCKET_GUNS : AUX_GUN;
    this.fireMountedGuns(
      e,
      rocket ? ["Muzzle0", "Muzzle1"] : ["MuzzleAux"],
      profile.damage,
      profile.speed,
      0.04,
    );
    e.auxCool = profile.interval;
  }
  private commandBossAttack(e: Actor, sight: boolean) {
    if (e.cool > 0) return;
    if (!sight || Math.hypot(this.pos.x - e.x, this.pos.z - e.z) > 36) {
      e.cool = 0.3;
      return;
    }
    if (e.bossKind === "quadMech") {
      this.fireMountedGuns(
        e,
        ["Muzzle0", "Muzzle1", "Muzzle2", "Muzzle3"],
        QUAD_GUNS.damage,
        QUAD_GUNS.speed,
        0.045,
      );
      e.volleys = (e.volleys ?? 0) + 1;
      e.cool =
        e.volleys % QUAD_GUNS.volleys === 0
          ? QUAD_GUNS.reload
          : QUAD_GUNS.interval;
    } else {
      const profile = MISSILE_SALVOS[e.bossKind as keyof typeof MISSILE_SALVOS];
      this.bossSalvo(
        e,
        Math.atan2(this.pos.x - e.x, this.pos.z - e.z),
        profile,
      );
      e.cool = profile.interval;
    }
  }
  private bossSalvo(e: Actor, aim: number, profile = BOSS_ATTACKS.heavy) {
    e.state = "HEAVY SALVO / TAKE COVER";
    // Movement states overwrite e.state every tick; keep the warning readable
    // until the blast zones resolve.
    e.salvoUntil = this.elapsed + profile.warning + 0.4;
    this.onRadio(
      "Heavy salvo! Leave the orange blast zones or get behind concrete.",
    );
    for (let i = 0; i < profile.count; i++) {
      const offset = (i - (profile.count - 1) / 2) * (profile.radius * 1.5);
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
      const launch = e.muzzles?.get("Launch" + (i % 2));
      const from = launch
        ? launch.getWorldPosition(new T.Vector3())
        : new T.Vector3(e.x, e.mesh.position.y + 2, e.z);
      rock.position.copy(from);
      rock.lookAt(x, 8, z);
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
        from,
        duration: profile.warning,
      });
    }
  }

  private addCorpse(body: FallenBody) {
    while (this.corpses.length >= (this.world.lowDetail ? 32 : 64))
      this.corpses.shift()!.dispose();
    this.corpses.push(body);
  }
  private beginDefeat() {
    if (this.phase !== "playing") return;
    this.endTurbo();
    this.phase = "dying";
    this.deathClock = 0;
    this.addCorpse(new FallenBody(this.player, this.playerMotion));
    this.onRadio("Ghost is down. Signal fading...");
  }
  updatePresentation(dt: number) {
    this.impacts.update(dt);
    this.destruction.update(dt);
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
    this.spotted = false;
    this.elapsed += dt;
    this.turboCooldown = Math.max(0, this.turboCooldown - dt);
    if (input.turbo) this.activateTurbo();
    input.turbo = false;
    this.refreshCoverGrid();
    this.rebuildEnemyGrid();
    let navigationBudget = 3;
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
    if (input.swap && this.canSwapWeapon) {
      this.magazines[this.weapon] = this.ammo;
      const next = this.inventory.indexOf(this.weapon) + 1;
      if (this.riding?.kind === "tank") {
        // Cannon -> collected weapons in inventory order -> cannon.
        if (!this.riding.personalWeapon) {
          this.riding.personalWeapon = true;
          this.weapon = this.inventory[0];
        } else if (next >= this.inventory.length) {
          this.riding.personalWeapon = false;
        } else this.weapon = this.inventory[next];
      } else this.weapon = this.inventory[next % this.inventory.length];
      this.ammo = this.magazines[this.weapon];
      this.reloadTime = 0;
      this.shotTime = Math.max(this.shotTime, 0.25);
      input.swap = false;
      this.onSound("reload");
    }
    input.swap = false;
    if (
      this.usesPersonalWeapon &&
      this.ammo === 0 &&
      this.reserves[this.weapon] === 0 &&
      this.turboTime === 0
    ) {
      this.selectStrongestWeapon();
      this.onRadio(
        "Ammunition depleted. Strongest usable weapon selected: " +
          this.activeWeaponSpec.name +
          ".",
      );
    }
    if (
      this.usesPersonalWeapon &&
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
    this.blastAimTime -= dt;
    if (!input.blast) {
      this.blastTarget = undefined;
      this.blastAimTime = 0;
    } else if (
      this.blastAimTime <= 0 ||
      this.blastAimWeapon !== this.activeWeaponSpec.id ||
      (this.blastTarget && !COVER.includes(this.blastTarget))
    ) {
      const spec = this.activeWeaponSpec;
      this.blastTarget = explosiveTarget(
        this.pos,
        this.enemies,
        [...COVER, ...parked],
        spec.visual === "laser" ? 38 : Math.min(35, spec.speed * spec.life - 1),
        this.riding?.spec.radius ?? 0.5,
        (box: (typeof COVER)[number]) => {
          const screen = new T.Vector3(
            box.x,
            this.world.groundHeight(box.x, box.z) + 0.5,
            box.z,
          ).project(this.world.camera);
          return (
            Math.abs(screen.x) < 0.9 &&
            screen.y > -0.65 &&
            screen.y < 0.65 &&
            Math.abs(screen.z) <= 1
          );
        },
      );
      this.blastAimTime = 0.12;
      this.blastAimWeapon = spec.id;
    }
    this.blastMarker.visible = !!input.blast && !!this.blastTarget;
    if (this.blastTarget)
      this.blastMarker.position.set(
        this.blastTarget.x,
        this.world.groundHeight(this.blastTarget.x, this.blastTarget.z) + 0.15,
        this.blastTarget.z,
      );
    // A hold is a deliberate fire command. No safe target means no ammunition spent.
    const firing = input.blast ? !!this.blastTarget : input.fire;
    if (input.blast && !this.blastTarget)
      this.combatMessage("NO SAFE EXPLOSIVE IN SIGHT", 0.3);
    const nearest =
      input.assist && !input.blast
        ? this.enemies
            .filter(
              (e) =>
                e.hp > 0 &&
                Math.hypot(e.x - this.pos.x, e.z - this.pos.z) <
                  (this.activeWeaponSpec.id === "throwBomb"
                    ? 12.75
                    : this.activeWeaponSpec.visual === "flame"
                      ? 8
                      : 38) &&
                !this.coverGrid
                  .segment(this.pos.x, this.pos.z, e.x, e.z)
                  .some(
                    (b: (typeof COVER)[number]) =>
                      segmentBox(this.pos.x, this.pos.z, e.x, e.z, b) < 1 &&
                      (this.activeWeaponSpec.id !== "throwBomb" ||
                        coverHeight(b) > 3),
                  ),
            )
            .sort(
              (a, b) =>
                Math.hypot(a.x - this.pos.x, a.z - this.pos.z) -
                Math.hypot(b.x - this.pos.x, b.z - this.pos.z),
            )[0]
        : undefined;
    if (input.blast && this.blastTarget)
      aim = new T.Vector3(this.blastTarget.x, 0, this.blastTarget.z);
    else if (input.assist && nearest)
      aim = new T.Vector3(nearest.x, 0, nearest.z);
    else if (input.assist)
      aim = new T.Vector3(
        this.pos.x + dx * 4,
        0,
        this.pos.z + (length ? dz * 4 : -4),
      );
    const angle = Math.atan2(aim.x - this.pos.x, aim.z - this.pos.z);
    this.throwDistance = T.MathUtils.clamp(
      Math.hypot(aim.x - this.pos.x, aim.z - this.pos.z),
      3,
      12.75,
    );
    this.grenadeMarker.visible = this.activeWeaponSpec.id === "throwBomb";
    this.grenadeMarker.position.set(
      this.pos.x + Math.sin(angle) * this.throwDistance,
      0.12,
      this.pos.z + Math.cos(angle) * this.throwDistance,
    );
    const moving =
      Math.hypot(this.pos.x - previousX, this.pos.z - previousZ) > 0.001;
    if (firing || this.reloadTime > 0) this.player.rotation.y = angle;
    else if (moving)
      this.player.rotation.y = Math.atan2(
        this.pos.x - previousX,
        this.pos.z - previousZ,
      );
    if (
      !this.riding &&
      firing &&
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
        (box) => this.damageProp(box, 9999),
      );
      v.mesh.position.y = this.world.groundHeight(
        v.mesh.position.x,
        v.mesh.position.z,
      );
      this.pos.copy(v.mesh.position);
      if (
        (v.kind === "tank" || v.kind === "jeep") &&
        Math.hypot(this.pos.x - previousX, this.pos.z - previousZ) > 0.002
      ) {
        for (const enemy of this.enemies) {
          if (enemy.boss || enemy.armored || enemy.hp <= 0) continue;
          const contact = segmentCircle(
            previousX,
            previousZ,
            this.pos.x,
            this.pos.z,
            enemy.x,
            enemy.z,
            v.spec.radius + enemy.radius,
          );
          if (!Number.isFinite(contact)) continue;
          // Contact must be reachable: overlapping radii alone cannot crush through cover.
          const x = previousX + (this.pos.x - previousX) * contact;
          const z = previousZ + (this.pos.z - previousZ) * contact;
          if (
            !COVER.some((box) =>
              Number.isFinite(segmentBox(x, z, enemy.x, enemy.z, box)),
            )
          )
            this.hurt(enemy, enemy.hp);
        }
      }
      v.cool = Math.max(0, v.cool - dt);
      if (
        firing &&
        v.cool === 0 &&
        this.shotTime === 0 &&
        this.reloadTime === 0
      ) {
        const spec = this.activeWeaponSpec;
        if (this.usesPersonalWeapon ? this.ammo > 0 : v.ammo > 0) {
          this.fireWeapon(spec, angle, true);
          v.cool = spec.cool;
          this.shotTime = spec.cool;
          if (this.usesPersonalWeapon) this.ammo--;
          else v.ammo--;
        } else if (this.usesPersonalWeapon && this.reserves[this.weapon] > 0) {
          this.reloadTime = this.weaponSpec.reload;
          this.onSound("reload");
        } else if (
          v.kind === "tank" &&
          !v.personalWeapon &&
          this.turboTime === 0
        ) {
          this.selectStrongestWeapon();
          this.shotTime = Math.max(this.shotTime, 0.25);
          this.onRadio(
            "Cannon empty. Strongest usable personal weapon selected. Q / SWAP cycles your loadout.",
          );
        }
      }
    }
    this.updateTurbo(dt, firing, angle);
    for (let i = this.weaponDrops.length - 1; i >= 0; i--) {
      const drop = this.weaponDrops[i];

      if (this.canCollect(drop.mesh.position, 1.5)) {
        this.magazines[this.weapon] = this.ammo;
        if (!this.inventory.includes(drop.index)) {
          this.inventory.push(drop.index);
          if (drop.mesh.userData.bonusRounds) {
            this.magazines[drop.index] = drop.mesh.userData.bonusRounds;
            this.reserves[drop.index] = 0;
          }
        } else if (Number.isFinite(this.reserves[drop.index]))
          // A pickup never lowers reserves (Field Kit ranks can exceed the cap).
          this.reserves[drop.index] = Math.max(
            this.reserves[drop.index],
            Math.min(
              WEAPONS[drop.index].mag * 4,
              this.reserves[drop.index] +
                (drop.mesh.userData.bonusRounds ?? WEAPONS[drop.index].mag * 2),
            ),
          );
        this.selectStrongestWeapon();
        this.showWeapon();
        this.world.actors.remove(drop.mesh);
        this.weaponDrops.splice(i, 1);
        this.onRadio(
          WEAPONS[drop.index].name +
            " acquired. Strongest usable weapon selected. Q / SWAP still cycles your loadout.",
        );
      }
    }
    this.playerMotion.update(dt, {
      vx: (this.pos.x - previousX) / dt,
      vz: (this.pos.z - previousZ) / dt,
      aiming: firing,
      reload:
        this.reloadTime > 0 ? 1 - this.reloadTime / this.weaponSpec.reload : 0,
      dodging: this.dashTime > 0,
    });
    const mission = MISSIONS[this.index];
    if (
      this.hp > 0 &&
      !this.objective &&
      Math.hypot(
        this.pos.x - mission.objective.x,
        this.pos.z - mission.objective.z,
      ) < 3 &&
      !COVER.some(
        (box) =>
          segmentBox(
            this.pos.x,
            this.pos.z,
            mission.objective.x,
            mission.objective.z,
            box,
          ) !== Infinity,
      )
    ) {
      this.objective = true;
      this.score += 500;
      this.world.marker.visible = false;
      if (mission.finale) {
        const count = difficultyConfig(this.difficulty).bosses;
        for (let n = 0; n < count; n++) {
          const p = routeFormation(mission.route, 0.9, count)[n];
          this.spawn(p.x, p.z, true, 100 + n);
        }
        this.bossSpawned = true;
        this.onRadio(
          `${count} command boss${count > 1 ? "es" : ""} inbound. Defeat them all to open extraction.`,
        );
      } else {
        this.pendingGuards =
          missionPacing(mission.stage, mission.level).guards *
          difficultyConfig(this.difficulty).soldiers;
        this.reinforcementClock = 0.8;
        this.onRadio(
          "Relay secured. Guards are leaving the nearby houses. Clear the counterattack to open extraction.",
        );
      }
      this.onSound("objective");
    }
    this.updateReinforcements(dt);
    input.interact = false;
    this.updateRescues(dt);
    const navigationCover = [...COVER, ...parked];
    this.squad.update(
      dt,
      this.pos,
      !!this.riding,
      firing,
      angle,
      navigationCover,
      (x, z, direction) =>
        this.shoot(x, z, direction, false, 12, WEAPONS[0].speed, WEAPONS[0]),
    );
    const limits = pressureLimits(this.difficulty);
    const pressure = { melee: 0, thrower: 0, rocket: 0 };
    const attackGroup = (role: InfantryRole) =>
      role === "rocketeer"
        ? "rocket"
        : role === "thrower"
          ? "thrower"
          : "melee";
    for (const e of this.enemies)
      if (e.hp > 0 && e.attack && !e.attack.fired && e.role)
        pressure[attackGroup(e.role)]++;
    for (const b of this.bullets)
      if (b.spec?.id === "enemyRocket") pressure.rocket++;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (
        this.quakeTime > 0 &&
        !(e.bossKind === "gunship" && e.mesh.position.y > 2)
      ) {
        if (Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < 30)
          e.motion?.update(dt, { vx: 0, vz: 0 });
        e.warn.visible = false;
        e.attack = undefined;
        e.cool = Math.max(e.cool, 0.7);
        continue;
      }
      if (e.emerging) {
        const house = e.emerging,
          exit = house.exit!;
        const dx = exit.x - e.x,
          dz = exit.z - e.z,
          distance = Math.hypot(dx, dz);
        const step = Math.min(distance, dt * 3.2);
        const beforeX = e.x,
          beforeZ = e.z;
        const next = moveCircle(
          e.x,
          e.z,
          distance ? (dx / distance) * step : 0,
          distance ? (dz / distance) * step : 0,
          e.radius,
          [
            ...this.coverGrid.near(e.x, e.z, 2).filter((b: Box) => b !== house),
            ...this.rides.filter((v) => v.hp > 0).map((v) => v.box),
          ],
          WORLD_BOUNDS,
        );
        e.x = next.x;
        e.z = next.z;
        e.mesh.position.set(e.x, this.world.groundHeight(e.x, e.z), e.z);
        e.motion?.update(dt, {
          vx: (e.x - beforeX) / dt,
          vz: (e.z - beforeZ) / dt,
        });
        e.warn.visible = false;
        e.cool = 0.9; // Always finish the doorway walk and gun warning before firing.
        if (Math.hypot(e.x - exit.x, e.z - exit.z) < 0.05)
          e.emerging = undefined;
        continue;
      }
      if (e.boss) {
        if (
          Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < 35 &&
          !navigationCover.some(
            (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) !== Infinity,
          )
        )
          this.spotted = true;
        this.updateBoss(e, dt);
        continue;
      }
      const role = e.role ?? "rifleman",
        profile = INFANTRY[role];
      const specialist = !e.armored && role !== "rifleman";
      const beforeX = e.x,
        beforeZ = e.z;
      const distance = Math.hypot(e.x - this.pos.x, e.z - this.pos.z);
      const active = distance < (e.alerted ? 42 : e.armored ? 30 : 27);
      if (!active) {
        e.memory = Math.max(0, (e.memory ?? 0) - dt);
        if (!e.memory) {
          e.alerted = false;
          e.lastSeen = undefined;
          e.routeTarget = undefined;
        }
        e.warn.visible = false;
        e.attack = undefined;
        e.cool = Math.max(e.cool, 0.6);
        continue;
      }
      const seen = seesPlayer(e, this.pos, navigationCover, e.mesh.rotation.y);
      if (seen) this.spotted = true;
      if (seen) {
        e.alerted = true;
        e.memory = 6;
        e.lastSeen = { x: this.pos.x, z: this.pos.z };
      } else e.memory = Math.max(0, (e.memory ?? 0) - dt);
      if (!seen && !e.memory) {
        e.alerted = false;
        e.lastSeen = undefined;
        e.routeTarget = undefined;
      }
      if (!e.alerted || !e.lastSeen) {
        e.attack = undefined;
        e.mesh.rotation.y += dt * 0.18;
        e.warn.visible = false;
        e.motion?.update(dt, { vx: 0, vz: 0 });
        continue;
      }
      const target = seen ? this.pos : e.lastSeen;
      const a = Math.atan2(target.x - e.x, target.z - e.z);
      e.mesh.rotation.y = e.attack
        ? e.attack.aim
        : turnToward(
            e.mesh.rotation.y,
            a,
            dt * (e.armored ? 1.1 : profile.melee ? 4 : 2.2),
          );
      const hasSight =
        seen && Math.abs(angleDelta(e.mesh.rotation.y, a)) < 0.22;
      // Keep a readable windup after an enemy emerges from cover.
      if (specialist) {
        if (!seen && e.attack) {
          e.attack = undefined;
          e.cool = Math.max(e.cool, 0.6);
        }
        if (!e.attack) e.cool = Math.max(0, e.cool - dt);
        const reach =
          profile.reach +
          (profile.melee ? (this.riding?.spec.radius ?? 0.52) : 0);
        const group = attackGroup(role);
        if (
          !e.attack &&
          hasSight &&
          e.cool <= 0 &&
          distance <= reach &&
          (!profile.melee || distance > 0.1) &&
          (role !== "rocketeer" || distance >= 6) &&
          pressure[group] < limits[group]
        ) {
          e.attack = {
            time: 0,
            aim: a,
            reach: profile.melee ? reach : distance,
            fired: false,
          };
          pressure[group]++;
          if (!this.roleHints.has(role)) {
            this.roleHints.add(role);
            const hints = {
              rusher: "KNIFE RUSHER · BACKSTEP OR DODGE",
              swordsman: "SWORD SWEEP · LEAVE THE ORANGE ARC",
              thrower: "KNIFE THROWER · SIDESTEP OR USE COVER",
              rocketeer: "ROCKET AIMING · MOVE OFF THE ORANGE LINE",
              rifleman: "",
            };
            this.combatMessage(hints[role], 2.2);
          }
        }
      } else
        e.cool = hasSight
          ? e.cool - dt
          : Math.max(e.cool, e.armored ? ENEMY_TANK.warning : 0.6);
      e.warn.visible =
        !specialist &&
        hasSight &&
        e.cool < (e.armored ? ENEMY_TANK.warning : 0.6);
      e.warn.position.set(e.x, this.world.groundHeight(e.x, e.z) + 0.08, e.z);
      e.warn.scale.setScalar(e.armored ? 2 : 1.2);
      if (!e.boss) {
        let vx = 0,
          vz = 0;
        if (!seen) {
          e.routeTime = (e.routeTime ?? 0) - dt;
          if ((e.routeTime <= 0 || !e.routeTarget) && navigationBudget > 0) {
            navigationBudget--;
            e.routeTarget = routeStep(
              e.x,
              e.z,
              target.x,
              target.z,
              navigationCover,
              e.armored ? 1.7 : 0.55,
              WORLD_BOUNDS,
            );
            e.routeTime = 0.6 + (e.index % 4) * 0.1;
          }
          const rx = (e.routeTarget?.x ?? e.x) - e.x,
            rz = (e.routeTarget?.z ?? e.z) - e.z;
          const d = Math.hypot(rx, rz);
          const step = Math.min(d, dt * (specialist ? profile.speed : 1.9));
          if (d > 0.001) {
            vx = (rx / d) * step;
            vz = (rz / d) * step;
          }
        } else {
          // Adapt the original 2D range keeping and strafing to world meters.
          const desired = e.armored
            ? 16
            : specialist
              ? profile.melee
                ? profile.reach * 0.78 + (this.riding?.spec.radius ?? 0.52)
                : role === "thrower"
                  ? 9
                  : 16
              : e.index % 3 === 0
                ? 11
                : 7;
          const advance =
            distance > desired + (profile.melee ? 0.05 : 1)
              ? 1
              : distance < desired * 0.55
                ? -0.7
                : 0;
          const strafe = profile.melee
            ? 0
            : Math.sin(this.elapsed * 1.2 + e.index * 2.4) *
              (role === "thrower" ? 0.75 : 0.45);
          const speed = specialist ? profile.speed : 1.9;
          vx = (Math.sin(a) * advance + Math.cos(a) * strafe) * dt * speed;
          vz = (Math.cos(a) * advance - Math.sin(a) * strafe) * dt * speed;
          e.routeTime = 0;
        }
        if (e.attack) {
          vx = 0;
          vz = 0;
        }
        // Local spacing keeps riflemen from collapsing into one visible body.
        for (const other of this.enemyGrid.near(
          e.x,
          e.z,
          e.radius + 2.5,
        ) as Actor[]) {
          if (e.attack || other === e || other.hp <= 0 || other.boss) continue;
          const ox = e.x - other.x,
            oz = e.z - other.z,
            d = Math.hypot(ox, oz);
          const separation = e.radius + other.radius + 0.1;
          if (d < separation) {
            const angle =
              d > 0.001
                ? Math.atan2(ox, oz)
                : e.index < other.index
                  ? -Math.PI / 2
                  : Math.PI / 2;
            vx += Math.sin(angle) * (separation - d) * dt * 2;
            vz += Math.cos(angle) * (separation - d) * dt * 2;
          }
        }
        const move = moveCircle(
          e.x,
          e.z,
          vx,
          vz,
          e.armored ? 1.7 : 0.55,
          [
            ...this.coverGrid.near(e.x, e.z, e.radius + 1),
            ...this.rides.filter((v) => v.hp > 0).map((v) => v.box),
          ],
          WORLD_BOUNDS,
        );
        e.x = move.x;
        e.z = move.z;
      }
      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;
      e.warn.position.set(e.x, this.world.groundHeight(e.x, e.z) + 0.08, e.z);
      e.vehicleMotion?.update(
        dt,
        (e.x - beforeX) / dt,
        e.mesh.rotation.y,
        this.elapsed,
        (e.z - beforeZ) / dt,
        false,
        false,
      );
      if (!e.boss) e.mesh.position.y = this.world.groundHeight(e.x, e.z);
      e.motion?.update(dt, {
        vx: (e.x - beforeX) / dt,
        vz: (e.z - beforeZ) / dt,
        aiming: !!e.attack || e.cool < 0.6,
        melee: specialist && profile.melee,
        attack: e.attack
          ? { kind: role, progress: e.attack.time / profile.warning }
          : undefined,
      });
      if (specialist) {
        this.updateInfantryAttack(e, dt, navigationCover);
        continue;
      }
      if (e.armored && hasSight) {
        e.auxCool = (e.auxCool ?? 1) - dt;
        if (e.auxCool <= 0) {
          this.shoot(e.x, e.z, a, true, ENEMY_TANK.gun, 12);
          e.auxCool = ENEMY_TANK.gunInterval;
        }
      }
      if (hasSight && e.cool <= 0) {
        if (
          !COVER.some(
            (b) => segmentBox(e.x, e.z, this.pos.x, this.pos.z, b) < 1,
          )
        ) {
          e.motion?.kick();
          if (e.armored)
            this.shoot(e.x, e.z, a, true, ENEMY_TANK.shell, 12, WEAPONS[7]);
          else
            for (const spread of [-0.07, 0.07])
              this.shoot(e.x, e.z, a + spread, true, 6, 9);
        }
        e.cool = e.armored ? ENEMY_TANK.interval : 1.6 + (e.index % 8) * 0.06;
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
      for (const box of this.coverGrid.segment(
        b.x,
        b.z,
        nx,
        nz,
        0.1,
      ) as typeof COVER) {
        if (!this.liveCover.has(box)) continue;
        const hit = segmentBox(b.x, b.z, nx, nz, box, 0.06);
        if (
          b.spec?.id === "throwBomb" &&
          Number.isFinite(hit) &&
          grenadeHeight(b.age - dt + dt * hit, b.maxLife, b.originY) >
            coverHeight(box)
        )
          continue;
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
        for (const e of this.enemyGrid.segment(
          b.x,
          b.z,
          nx,
          nz,
          1.2,
        ) as Actor[]) {
          if (e.hp <= 0 || b.hits.has(e) || b.spec?.id === "throwBomb")
            continue;
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
            this.addCorpse(
              new FallenBody(parkedVictim.mesh, undefined, parkedVictim.kind),
            );
          }
        }
        if (victim) {
          this.hurt(
            victim,
            b.damage,
            b.spec,
            {
              x: b.x + (nx - b.x) * t,
              z: b.z + (nz - b.z) * t,
            },
            { x: b.vx, z: b.vz },
            { x: b.originX, z: b.originZ },
          );
          b.hits.add(victim);
        }
        if (hitPlayer && this.invincible === 0) {
          this.takeDamage(b.damage, { x: b.originX, z: b.originZ });
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
          victim ? victim.mesh.position.y + 1 : undefined,
          b.enemy,
        );
      }
      b.mesh.position.set(
        nx,
        b.spec?.id === "throwBomb"
          ? grenadeHeight(b.age, b.maxLife, b.originY)
          : T.MathUtils.lerp(b.originY, 0.95, Math.min(1, b.age / 0.55)) +
              (b.spec?.visual === "grenade" || b.spec?.visual === "gas"
                ? Math.sin(Math.min(1, b.age / b.maxLife) * Math.PI) * 2
                : 0),
        nz,
      );
      if (b.spec?.visual === "knife")
        b.mesh.children[0].rotation.x = b.age * 22;
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
            this.hurt(e, 12, WEAPONS[10]);
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
      if (h.rock && h.from && h.duration) {
        const t = T.MathUtils.clamp(1 - h.time / h.duration, 0, 1);
        const position = (u: number) =>
          new T.Vector3()
            .lerpVectors(h.from!, new T.Vector3(h.x, 0.2, h.z), u)
            .add(new T.Vector3(0, Math.sin(u * Math.PI) * 8, 0));
        h.rock.position.copy(position(t));
        h.rock.lookAt(position(Math.min(1.001, t + 0.01)));
      } else if (h.rock) h.rock.position.y = Math.max(0, h.time * 12);
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
          this.takeDamage(h.damage ?? 28, { x: h.x, z: h.z });
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
      if (
        p.userData.expires !== undefined &&
        this.elapsed >= p.userData.expires
      ) {
        this.world.actors.remove(p);
        this.pickups.splice(i, 1);
        continue;
      }
      const isAmmo = p.userData.kind === "ammo",
        isLoot = p.userData.expires !== undefined;
      const isShield = p.userData.kind === "shield";
      const reward = isAmmo
        ? ammoReward(
            this.inventory,
            this.reserves,
            WEAPONS,
            this.weapon,
            this.difficulty,
          )
        : null;
      if (
        this.canCollect(p.position, 1.1) &&
        (isAmmo
          ? reward !== null
          : isShield
            ? this.shield < this.maxShield
            : this.hp < this.maxHp ||
              (this.riding && this.riding.hp < this.riding.spec.hp))
      ) {
        if (isAmmo) {
          // Respect a manual weapon choice unless the held weapon is dry.
          const dry =
            this.usesPersonalWeapon &&
            this.ammo === 0 &&
            this.reserves[this.weapon] === 0;
          this.reserves[reward!.index] += reward!.amount;
          if (dry) this.selectStrongestWeapon();
          this.showWeapon();
        } else if (isShield)
          this.shield = Math.min(
            this.maxShield,
            this.shield + (isLoot ? 20 : 40),
          );
        else {
          this.hp = Math.min(this.maxHp, this.hp + (isLoot ? 15 : 30));
          if (this.riding)
            this.riding.hp = Math.min(
              this.riding.spec.hp,
              this.riding.hp + (isLoot ? 15 : 30),
            );
        }
        this.onRadio(
          isAmmo
            ? `Ammunition recovered: +${reward!.amount} ${WEAPONS[reward!.index].name} rounds.`
            : isShield
              ? `Shield charged: +${isLoot ? 20 : 40} protection.`
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
      ) < 2.5
    ) {
      this.endTurbo();
      this.phase = "won";
      this.score +=
        Math.max(0, 1200 - Math.floor(this.elapsed * 3)) +
        Math.floor(this.hp * 4);
      this.onEnd(true);
    }
  }
}
