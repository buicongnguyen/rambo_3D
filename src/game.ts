import * as T from "three";
import { CharacterMotion, FallenBody, VehicleMotion } from "./animation";
import { World, model } from "./world";
import { MISSIONS, COVER, SPAWNS } from "./missions";
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
};
type Bullet = {
  mesh: T.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
  enemy: boolean;
};
type Effect = {
  mesh: T.Mesh<T.IcosahedronGeometry, T.MeshBasicMaterial>;
  life: number;
  max: number;
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
  pickups: T.Mesh[] = [];
  hazards: Hazard[] = [];
  private followTarget = { x: 0, z: 0 };
  private followClock = 0;
  index = 0;
  hp = 150;
  maxHp = 150;
  ammo = 24;
  private magazines = [24, 6];
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
  private pickupGeo = new T.OctahedronGeometry(0.38);
  private pickupMat = new T.MeshStandardMaterial({
    color: 0xa1f0c0,
    emissive: 0x4b9f70,
    emissiveIntensity: 0.8,
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
    return this.weapon === 0 ? 24 : 6;
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
    this.world.build(index);
    this.player = model("commando", 0, 23);
    this.playerMotion = new CharacterMotion(this.player);
    this.deathClock = 0;
    this.world.actors.add(this.player);
    this.difficulty = difficulty;
    this.power = save.power;
    this.mobility = save.mobility;
    this.maxHp = (difficulty === "story" ? 230 : 150) + save.armor * 35;
    this.hp = this.maxHp;
    this.ammo = 24;
    this.magazines = [24, 6];
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
    SPAWNS.forEach(([x, z], i) => this.spawn(x, z, false, i));
    if (index === 0) {
      this.companion = model("captive", 15, 0);
      this.companionMotion = new CharacterMotion(this.companion);
      this.world.actors.add(this.companion);
    }
  }
  cleanup() {
    for (const corpse of this.corpses) corpse.dispose();
    this.corpses = [];
    this.companionMotion = undefined;
    for (const b of this.bullets) this.world.actors.remove(b.mesh);
    for (const e of this.effects) {
      e.mesh.material.dispose();
      this.world.actors.remove(e.mesh);
    }
    for (const h of this.hazards) {
      h.mesh.geometry.dispose();
      h.mesh.material.dispose();
      this.world.actors.remove(h.mesh);
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
    const mesh = model(
      boss ? MISSIONS[this.index].bossModel : "rifleman",
      x,
      z,
      boss ? 0.83 : 1,
    );
    if (boss && this.index === 0) mesh.position.y = 3.8;
    const max = boss ? 1100 + this.index * 400 : 65 + this.index * 8;
    const warn = new T.Mesh(this.warnGeo, this.warnMat);
    warn.rotation.x = -Math.PI / 2;
    warn.position.set(x, 0.07, z);
    this.world.actors.add(mesh, warn);
    this.enemies.push({
      mesh,
      motion: boss ? undefined : new CharacterMotion(mesh),
      vehicleMotion: boss
        ? new VehicleMotion(mesh, MISSIONS[this.index].bossModel)
        : undefined,
      x,
      z,
      hp: max,
      max,
      cool: 1.1 + index * 0.22,
      radius: boss ? 2.4 : 0.65,
      boss,
      index,
      warn,
    });
  }
  spark(x: number, z: number, big = false) {
    for (let i = 0; i < (big ? 12 : 3); i++) {
      const mesh = new T.Mesh(this.effectGeo, this.effectMat.clone());
      mesh.position.set(
        x + (Math.random() - 0.5) * (big ? 2 : 0.5),
        0.7 + Math.random(),
        z + (Math.random() - 0.5) * (big ? 2 : 0.5),
      );
      mesh.scale.setScalar(big ? 1.7 : 1);
      this.world.actors.add(mesh);
      this.effects.push({ mesh, life: 0.3 + Math.random() * 0.3, max: 0.6 });
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
  ) {
    const mesh = new T.Mesh(
      this.bulletGeo,
      enemy ? this.bulletEnemy : this.bulletFriendly,
    );
    mesh.position.set(x, 0.95, z);
    mesh.rotation.y = angle;
    this.world.actors.add(mesh);
    this.bullets.push({
      mesh,
      x,
      z,
      vx: Math.sin(angle) * speed,
      vz: Math.cos(angle) * speed,
      life: enemy ? 4 : this.weapon ? 0.42 : 1.05,
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
      this.spawn(-15, -18, false, 20);
      this.spawn(15, -18, false, 21);
      this.spawn(0, -25, false, 22);
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
      if (e.boss) {
        this.bossDead = true;
        this.world.exit.visible = true;
        this.onRadio(
          "Target down. Extraction is open — reach the marked landing zone.",
        );
      } else if (e.index % 2 === 0) {
        const p = new T.Mesh(this.pickupGeo, this.pickupMat);
        p.position.set(e.x, 0.65, e.z);
        this.pickups.push(p);
        this.world.actors.add(p);
      }
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
    this.shotTime = Math.max(0, this.shotTime - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    if (this.reloadTime > 0) {
      this.reloadTime = Math.max(0, this.reloadTime - dt);
      if (this.reloadTime === 0) this.ammo = this.mag;
    }
    if (input.swap) {
      this.magazines[this.weapon] = this.ammo;
      this.weapon = 1 - this.weapon;
      this.ammo = this.magazines[this.weapon];
      this.reloadTime = 0;
      this.shotTime = Math.max(this.shotTime, 0.25);
      input.swap = false;
      this.onSound("reload");
    }
    if (input.reload && this.ammo < this.mag && this.reloadTime === 0) {
      this.reloadTime = this.weapon ? 1.7 : 1.25;
      this.onSound("reload");
    }
    input.reload = false;
    let dx = input.x,
      dz = input.z;
    const length = Math.hypot(dx, dz);
    if (length > 1) {
      dx /= length;
      dz /= length;
    }
    if (input.dodge && this.dashCooldown === 0 && length > 0) {
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
    const terrainSpeed =
      this.index === 1 &&
      Math.abs(this.pos.z + 14) < 3.5 &&
      Math.abs(this.pos.x) > 3.5
        ? 0.56
        : 1;
    const moved = moveCircle(
      this.pos.x,
      this.pos.z,
      dx * dt * (this.dashTime > 0 ? 23 : movementSpeed) * terrainSpeed,
      dz * dt * (this.dashTime > 0 ? 23 : movementSpeed) * terrainSpeed,
      0.48,
      COVER,
      28.5,
    );
    this.pos.x = moved.x;
    this.pos.z = moved.z;
    // Root remains grounded; articulated joints provide all locomotion motion.
    this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z);
    let aim = input.aim;
    const nearest = this.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - this.pos.x, e.z - this.pos.z) <
            (this.weapon ? 18 : 27) &&
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
    if (input.fire && this.shotTime === 0 && this.reloadTime === 0) {
      if (this.ammo === 0) {
        this.reloadTime = this.weapon ? 1.7 : 1.25;
        this.onSound("reload");
      } else {
        this.playerMotion.kick();
        this.ammo--;
        this.shotTime = this.weapon ? 0.57 : 0.14;
        const pellets = this.weapon ? 5 : 1;
        for (let i = 0; i < pellets; i++) {
          const a = angle + (i - (pellets - 1) / 2) * 0.085;
          this.shoot(
            this.pos.x,
            this.pos.z,
            a,
            false,
            (this.weapon ? 17 : 26) * (1 + this.power * 0.2),
          );
        }
        this.onSound("shot");
      }
    }
    this.playerMotion.update(dt, {
      vx: (this.pos.x - previousX) / dt,
      vz: (this.pos.z - previousZ) / dt,
      aiming: input.fire,
      reload:
        this.reloadTime > 0
          ? 1 - this.reloadTime / (this.weapon ? 1.7 : 1.25)
          : 0,
      dodging: this.dashTime > 0,
    });
    const mission = MISSIONS[this.index];
    if (
      input.interact &&
      !this.objective &&
      Math.hypot(
        this.pos.x - mission.objective.x,
        this.pos.z - mission.objective.z,
      ) < 3
    ) {
      this.objective = true;
      this.score += 500;
      this.world.marker.visible = false;
      this.spawn(mission.bossPos.x, mission.bossPos.z, true, 9);
      this.bossSpawned = true;
      this.onRadio(
        this.index === 0
          ? "Mara: I am with you. Cobra Fang is inbound — stay out of its firing line!"
          : `${mission.boss} is responding. Watch for the warning ring, then move.`,
      );
      this.onSound("objective");
    }
    input.interact = false;
    const companionBefore = this.companion?.position.clone();
    if (this.companion && this.objective) {
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
            COVER,
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
          COVER,
          28.5,
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
      if (!e.boss || this.index !== 2) e.mesh.rotation.y = a;
      const hasSight = !COVER.some(
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
              COVER,
              0.55,
            );
            e.routeTime = 0.4;
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
        const move = moveCircle(e.x, e.z, vx, vz, 0.55, COVER, 28);
        e.x = move.x;
        e.z = move.z;
      } else if (e.boss) {
        const targetX = mission.bossPos.x + Math.sin(this.elapsed * 0.6) * 6;
        e.x +=
          Math.sign(targetX - e.x) * Math.min(Math.abs(targetX - e.x), dt * 2);
        if (this.index === 0) {
          e.mesh.position.y = 4 + Math.sin(this.elapsed * 2) * 0.25;
        }
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
          const count = e.boss
            ? this.index === 1
              ? 3
              : e.hp < e.max * 0.5
                ? 7
                : 5
            : 1;
          for (let i = 0; i < count; i++)
            this.shoot(
              e.x,
              e.z,
              Math.atan2(this.pos.x - e.x, this.pos.z - e.z) +
                (i - (count - 1) / 2) * (this.index === 1 ? 0.07 : 0.15),
              true,
              (e.boss ? 14 : 9) * (this.difficulty === "story" ? 0.65 : 1),
              e.boss ? (this.index === 1 ? 16 : 12) : 10,
            );
          if (e.boss && this.index === 2) {
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
            mesh.position.set(this.pos.x, 0.08, this.pos.z);
            this.world.actors.add(mesh);
            this.hazards.push({
              mesh,
              x: this.pos.x,
              z: this.pos.z,
              time: 1.35,
            });
          }
        }
        e.cool = e.boss
          ? this.index === 1
            ? 0.9
            : e.hp < e.max * 0.5
              ? 1.2
              : 1.8
          : 2.2 + e.index * 0.09;
      }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      const nx = b.x + b.vx * dt,
        nz = b.z + b.vz * dt;
      let t = Infinity;
      let victim: Actor | undefined;
      let hitPlayer = false;
      for (const box of COVER)
        t = Math.min(t, segmentBox(b.x, b.z, nx, nz, box, 0.06));
      if (b.enemy) {
        const pt = segmentCircle(
          b.x,
          b.z,
          nx,
          nz,
          this.pos.x,
          this.pos.z,
          0.52,
        );
        if (pt < t) {
          t = pt;
          hitPlayer = true;
        }
      } else
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const et = segmentCircle(b.x, b.z, nx, nz, e.x, e.z, e.radius);
          if (et < t) {
            t = et;
            victim = e;
          }
        }
      if (t !== Infinity) {
        if (victim) this.hurt(victim, b.damage);
        if (hitPlayer && this.invincible === 0) {
          this.hp = Math.max(0, this.hp - b.damage);
          this.playerMotion.hit();
          this.invincible = 0.18;
          this.spark(this.pos.x, this.pos.z);
          this.onSound("damage");
        }
        b.life = 0;
      }
      b.x = nx;
      b.z = nz;
      b.mesh.position.set(nx, 0.95, nz);
      if (b.life <= 0) {
        this.world.actors.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.mesh.position.y += dt * 1.8;
      e.mesh.scale.multiplyScalar(1 + dt * 2);
      e.mesh.material.opacity = Math.max(0, e.life / e.max);
      if (e.life <= 0) {
        this.world.actors.remove(e.mesh);
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.time -= dt;
      h.mesh.material.opacity = 0.4 + Math.abs(Math.sin(h.time * 10)) * 0.5;
      if (h.time <= 0) {
        this.spark(h.x, h.z, true);
        if (
          Math.hypot(this.pos.x - h.x, this.pos.z - h.z) < 2 &&
          this.invincible === 0
        ) {
          this.hp = Math.max(
            0,
            this.hp - (this.difficulty === "story" ? 17 : 28),
          );
          this.playerMotion.hit();
          this.invincible = 0.2;
          this.onSound("damage");
        }
        this.world.actors.remove(h.mesh);
        h.mesh.geometry.dispose();
        h.mesh.material.dispose();
        this.hazards.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.rotation.y += dt * 2;
      p.position.y = 0.7 + Math.sin(this.elapsed * 3) * 0.12;
      if (
        Math.hypot(p.position.x - this.pos.x, p.position.z - this.pos.z) <
          1.1 &&
        this.hp > 0 &&
        this.hp < this.maxHp
      ) {
        this.hp = Math.min(this.maxHp, this.hp + 30);
        this.world.actors.remove(p);
        this.pickups.splice(i, 1);
        this.onSound("objective");
      }
    }
    // Hit reactions preserve silhouette instead of blinking the entire actor away.
    if (this.hp <= 0) {
      this.beginDefeat();
    } else if (
      this.bossDead &&
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
