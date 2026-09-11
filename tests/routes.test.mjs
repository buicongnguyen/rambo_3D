import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, COVER, PATCHES, buildLayout } from "../src/missions.ts";
import { WORLD_BOUNDS } from "../src/campaign.mjs";
import { routeLength, distanceToRoute } from "../src/routes.mjs";
import { placeSupplies, BOSS_ATTACKS } from "../src/encounters.mjs";
import { moveCircle, segmentBox } from "../src/rules.mjs";

test("all 21 winding roads and relay spurs are traversable by a tank", () => {
  for (const m of MISSIONS) {
    buildLayout(m);
    assert.ok(routeLength(m.route) > 155);
    assert.ok(COVER.some((b) => b.kind === "concrete"));
    const segments = [
      ...m.route.slice(1).map((p, i) => [m.route[i], p]),
      [m.route[5], m.objective],
      [m.objective, m.route[6]],
    ];
    for (const [a, b] of segments) {
      assert.ok(
        COVER.every(
          (box) => segmentBox(a.x, a.z, b.x, b.z, box, 2.5) === Infinity,
        ),
        `${m.name}/${m.level} road obstructed`,
      );
      let pos = { ...a };
      for (let i = 0; i < 200; i++) {
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
    assert.ok(
      m.layout === 3
        ? m.extract.z > m.start.z
        : m.level === 0
          ? m.extract.z < m.start.z
          : m.extract.x > m.start.x,
    );
  }
});
test("seeded roadside crates keep quotas, clearance and varied distribution across every biome", () => {
  for (const m of MISSIONS) {
    buildLayout(m);
    for (let seed = 0; seed < 30; seed++) {
      const drops = placeSupplies(m.route, COVER, PATCHES, WORLD_BOUNDS, seed);
      assert.equal(drops.length, 20);
      assert.equal(drops.filter((d) => d.kind === "health").length, 6);
      assert.equal(drops.filter((d) => d.kind === "shield").length, 5);
      assert.deepEqual(
        drops.filter((d) => d.kind === "weapon").map((d) => d.index),
        [2, 3, 4, 5, 6, 7, 8, 9, 10],
      );
      assert.ok(Math.min(...drops.map((d) => d.fraction)) < 0.15);
      assert.ok(Math.max(...drops.map((d) => d.fraction)) > 0.8);
      for (const d of drops) {
        assert.ok(Math.abs(d.offset) >= 4.4 && Math.abs(d.offset) <= 6.4);
        assert.ok(distanceToRoute(m.route, d.x, d.z) >= 4.2);
        assert.ok(
          COVER.every(
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
