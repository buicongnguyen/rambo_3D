import test from "node:test";
import assert from "node:assert/strict";
import {
  MISSIONS,
  COVER,
  PATCHES,
  SPAWNS,
  buildLayout,
} from "../src/missions.ts";
import { WORLD_BOUNDS } from "../src/campaign.mjs";
import {
  routeLength,
  distanceToRoute,
  routeFormation,
  expeditionRoute,
  routePoint,
  relayFormation,
  distanceToRoads,
} from "../src/routes.mjs";
import {
  placeSupplies,
  BOSS_ATTACKS,
  placeVehicles,
  guardedPatrols,
} from "../src/encounters.mjs";
import { moveCircle, segmentBox } from "../src/rules.mjs";

test("all 21 winding roads and relay spurs are traversable by a tank", () => {
  for (const m of MISSIONS) {
    buildLayout(m);
    assert.ok(
      routeLength(m.route) > (m.stage === 0 && m.level === 0 ? 60 : 155),
    );
    assert.ok(
      COVER.some((b) => ["tree", "snowTree"].includes(b.kind) && b.hp >= 180),
    );
    const segments = m.roads.flatMap((route) =>
      route.slice(1).map((p, i) => [route[i], p]),
    );
    for (const [a, b] of segments) {
      assert.ok(
        COVER.every(
          (box) => segmentBox(a.x, a.z, b.x, b.z, box, 2.5) === Infinity,
        ),
        `${m.name}/${m.level} road obstructed`,
      );
      let pos = { ...a };
      for (let i = 0; i < 400; i++) {
        const dx = b.x - pos.x,
          dz = b.z - pos.z,
          d = Math.hypot(dx, dz);
        if (d < 0.01) break;
        pos = moveCircle(
          pos.x,
          pos.z,
          (dx / d) * Math.min(d, 0.4),
          (dz / d) * Math.min(d, 0.4),
          2.5,
          COVER,
          WORLD_BOUNDS,
        );
      }
      assert.ok(
        Math.hypot(pos.x - b.x, pos.z - b.z) < 0.01,
        `${m.name}/${m.level} tank stuck`,
      );
    }
    assert.ok(distanceToRoute(m.route, m.objective.x, m.objective.z) < 0.01);
    for (const p of routeFormation(m.route, 0.9, 4)) {
      assert.ok(
        COVER.every(
          (box) => segmentBox(p.x, p.z, p.x, p.z, box, 2.5) === Infinity,
        ),
        `${m.name} boss arena blocked`,
      );
      assert.ok(
        Math.abs(p.x) < WORLD_BOUNDS.x - 3 &&
          p.z > WORLD_BOUNDS.minZ + 3 &&
          p.z < WORLD_BOUNDS.maxZ - 3,
      );
    }
    if (m.square) {
      assert.equal(WORLD_BOUNDS.x * 2, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
      assert.ok(
        Math.max(...m.roads.flat().map((p) => p.x)) -
          Math.min(...m.roads.flat().map((p) => p.x)) >=
          100,
      );
      assert.ok(
        Math.max(...m.roads.flat().map((p) => p.z)) -
          Math.min(...m.roads.flat().map((p) => p.z)) >=
          100,
      );
    }
  }
});
test("seeded roadside crates keep quotas, clearance and varied distribution across every biome", () => {
  for (const m of MISSIONS.slice(2)) {
    buildLayout(m);
    const vehicles = placeVehicles(
      m.route,
      COVER,
      PATCHES,
      WORLD_BOUNDS,
      m.roads,
    );
    const obstacles = [
      ...COVER,
      ...vehicles.map((v) => ({
        x: v.x,
        z: v.z,
        w: v.radius * 2,
        d: v.radius * 2,
      })),
    ];
    assert.deepEqual(
      vehicles.map((v) => v.kind),
      ["motorcycle", "jeep", "tank"],
    );
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      assert.ok(v.fraction > 0.05 && v.fraction < 0.75);
      if (i) assert.ok(v.fraction > vehicles[i - 1].fraction + 0.1);
      assert.ok(distanceToRoads(m.roads, v.x, v.z) >= v.radius + 3.6);
      assert.ok(
        COVER.every(
          (b) =>
            segmentBox(v.anchor.x, v.anchor.z, v.x, v.z, b, 2.5) === Infinity,
        ),
      );
    }
    for (let seed = 0; seed < 30; seed++) {
      const drops = placeSupplies(
        m.route,
        obstacles,
        PATCHES,
        WORLD_BOUNDS,
        seed,
        m.roads,
      );
      const targets = [
        ...vehicles,
        ...drops.filter(
          (d) => d.kind === "weapon" && [3, 7, 8].includes(d.index),
        ),
      ];
      const guards = guardedPatrols(SPAWNS, targets, obstacles, WORLD_BOUNDS);
      assert.equal(guards.length, SPAWNS.length);
      assert.equal(guards.filter((g) => g.cacheGuard).length, 12);
      for (const target of targets)
        assert.ok(
          guards.filter(
            (g) =>
              g.cacheGuard && Math.hypot(g.x - target.x, g.z - target.z) < 7,
          ).length >= 2,
        );
      assert.equal(drops.length, 20);
      assert.equal(drops.filter((d) => d.kind === "health").length, 6);
      assert.equal(drops.filter((d) => d.kind === "shield").length, 5);
      assert.deepEqual(
        drops.filter((d) => d.kind === "weapon").map((d) => d.index),
        [2, 3, 4, 5, 6, 7, 8, 1, 10],
      );
      assert.ok(Math.min(...drops.map((d) => d.fraction)) < 0.15);
      assert.ok(Math.max(...drops.map((d) => d.fraction)) > 0.8);
      for (const d of drops) {
        assert.ok(Math.abs(d.offset) >= 4.4 && Math.abs(d.offset) <= 6.4);
        assert.ok(distanceToRoads(m.roads, d.x, d.z) >= 4.2);
        assert.ok(
          obstacles.every(
            (b) =>
              segmentBox(d.anchor.x, d.anchor.z, d.x, d.z, b, 2.5) === Infinity,
          ),
        );
        assert.ok(
          PATCHES.every(
            (p) =>
              p.kind === "ice" ||
              Math.hypot(d.x - p.x, d.z - p.z) >= p.radius + 1,
          ),
        );
      }
    }
    assert.deepEqual(
      placeSupplies(m.route, COVER, PATCHES, WORLD_BOUNDS, 7),
      placeSupplies(m.route, COVER, PATCHES, WORLD_BOUNDS, 7),
    );
    assert.notDeepEqual(
      placeSupplies(m.route, COVER, PATCHES, WORLD_BOUNDS, 7),
      placeSupplies(m.route, COVER, PATCHES, WORLD_BOUNDS, 8),
    );
  }
});
test("light boss bullets have faster cadence than heavy attacks and heavy footprints are broad", () => {
  for (const light of [BOSS_ATTACKS.gunship, BOSS_ATTACKS.spider]) {
    assert.ok(light.damage < BOSS_ATTACKS.heavy.damage);
    assert.ok(
      light.interval < 0.8 && light.interval < BOSS_ATTACKS.heavy.interval,
    );
  }
  assert.ok(
    BOSS_ATTACKS.heavy.warning >= 1.2 && BOSS_ATTACKS.heavy.radius >= 3,
  );
  assert.ok(BOSS_ATTACKS.laserTank.width >= 3);
});

test("square S routes span every quadrant with destructible shortcut cover", () => {
  assert.deepEqual(
    new Set(MISSIONS.map((m) => m.shape)),
    new Set(["ZIGZAG", "S", "O", "MIRRORED S", "U", "S 45°", "MIRRORED S 45°"]),
  );
  for (const m of MISSIONS.filter((m) => m.square)) {
    buildLayout(m);
    assert.ok(
      COVER.some((b) => ["tree", "snowTree"].includes(b.kind) && b.hp === 180),
      `${m.name} destructible shortcut cover`,
    );
    assert.ok(
      !COVER.some((b) =>
        ["hill", "basalt", "concrete", "cover"].includes(b.kind),
      ),
    );
    if (m.shape.includes("S")) {
      const quadrants = new Set(m.route.map((p) => `${p.x < 0}:${p.z < -43}`));
      assert.equal(quadrants.size, 4);
    }
  }
});

test("diagonal S variants are true 45 degree rotations with unchanged road length and safe map edges", () => {
  for (const base of ["S", "MIRRORED S"]) {
    const original = expeditionRoute(base),
      rotated = expeditionRoute(base + " 45°");
    assert.equal(original.length, rotated.length);
    assert.ok(Math.abs(routeLength(original) - routeLength(rotated)) < 1e-8);
    for (let i = 0; i < original.length; i++) {
      const expected = routePoint(2, original[i].x, original[i].z);
      assert.ok(
        Math.hypot(rotated[i].x - expected.x, rotated[i].z - expected.z) < 1e-8,
      );
    }
  }
  const diagonal = MISSIONS.filter((m) => m.diagonal);
  assert.deepEqual(
    diagonal.map((m) => m.stage),
    [2, 3, 6],
  );
  for (const m of diagonal) {
    buildLayout(m);
    for (const p of m.route) {
      assert.ok(
        Math.abs(p.x) < m.bounds.x - 10 &&
          p.z > m.bounds.minZ + 10 &&
          p.z < m.bounds.maxZ - 10,
      );
    }
  }
});

test("route length rises within each biome and both O arms reach the common relay", () => {
  for (let stage = 0; stage < 7; stage++) {
    const missions = MISSIONS.filter((m) => m.stage === stage);
    const shortest = missions.map((m) => Math.min(...m.roads.map(routeLength)));
    assert.ok(
      shortest[0] < shortest[1] && shortest[1] < shortest[2],
      `${stage}: ${shortest}`,
    );
    assert.ok(missions[2].shape.includes("S"));
  }
  for (const m of MISSIONS.filter((m) => m.shape === "O")) {
    buildLayout(m);
    assert.equal(m.roads.length, 2);
    for (const road of m.roads) {
      assert.deepEqual(road[0], m.start);
      assert.ok(
        Math.hypot(road.at(-1).x - m.extract.x, road.at(-1).z - m.extract.z) <
          1e-8,
      );
      assert.ok(distanceToRoute(road, m.objective.x, m.objective.z) < 0.01);
    }
    const drops = placeSupplies(
      m.route,
      COVER,
      PATCHES,
      WORLD_BOUNDS,
      45,
      m.roads,
    );
    assert.equal(drops.filter((d) => d.branch === 0).length, 10);
    assert.equal(drops.filter((d) => d.branch === 1).length, 10);
    for (const branch of [0, 1]) {
      const arm = drops.filter((d) => d.branch === branch);
      assert.ok(arm.filter((d) => d.kind === "weapon").length >= 4);
      assert.equal(arm.filter((d) => d.kind === "health").length, 3);
      assert.ok(arm.filter((d) => d.kind === "shield").length >= 2);
    }
    for (const p of relayFormation(m, 12))
      assert.ok(
        COVER.every(
          (b) => segmentBox(p.x, p.z, p.x, p.z, b, 0.85) === Infinity,
        ),
      );
  }
});
