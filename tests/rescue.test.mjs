import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, COVER, PATCHES, buildLayout } from "../src/missions.ts";
import {
  segmentBox,
  freshSave,
  validateSave,
  advanceCampaign,
} from "../src/rules.mjs";
import { fieldBonuses, TREASURE, MAX_SQUAD } from "../src/rescue.mjs";
import { buyFieldKit, fieldKitCost } from "../src/economy.mjs";
import { placeVehicles, placeSupplies } from "../src/encounters.mjs";
import { missionPacing } from "../src/progression.mjs";

test("all 21 missions have reachable prisons without blocking roads, barracks or seeded supplies", () => {
  for (const [index, m] of MISSIONS.entries()) {
    buildLayout(m);
    const prisons = COVER.filter((b) => b.kind === "prison");
    assert.ok(
      prisons.length >= 1 && prisons.length <= (index === 0 ? 1 : 2),
      `mission ${index}`,
    );
    for (const p of prisons) {
      assert.ok(
        COVER.every(
          (b) =>
            b === p ||
            segmentBox(
              p.entrance.x,
              p.entrance.z,
              p.exit.x,
              p.exit.z,
              b,
              0.5,
            ) === Infinity,
        ),
        `exit ${index}`,
      );
      assert.ok(
        COVER.every(
          (b) =>
            segmentBox(p.exit.x, p.exit.z, p.exit.x, p.exit.z, b, 0.7) ===
            Infinity,
        ),
      );
      for (const road of m.roads)
        for (let i = 1; i < road.length; i++)
          assert.equal(
            segmentBox(
              road[i - 1].x,
              road[i - 1].z,
              road[i].x,
              road[i].z,
              p,
              3.6,
            ),
            Infinity,
          );
    }
    const pacing = missionPacing(m.stage, m.level);
    const rides = placeVehicles(
      m.route,
      COVER,
      PATCHES,
      m.bounds,
      m.roads,
      pacing,
    );
    const obstacles = [
      ...COVER,
      ...rides.map((v) => ({
        x: v.x,
        z: v.z,
        w: v.radius * 2,
        d: v.radius * 2,
      })),
    ];
    for (const seed of [1, 31, 1024, 98271]) {
      const supplies = placeSupplies(
        m.route,
        obstacles,
        PATCHES,
        m.bounds,
        seed,
        m.roads,
        pacing,
      );
      const bonuses = fieldBonuses(m, obstacles, PATCHES, supplies);
      assert.ok(
        bonuses.filter((b) => b.kind === "money" || b.kind === "gold").length >=
          3,
        `treasure ${index}/${seed}`,
      );
      if (index === 0)
        assert.equal(
          bonuses.filter((b) => b.kind === "weapon").length,
          1,
          `early weapon ${seed}`,
        );
      for (const b of bonuses)
        assert.ok(
          obstacles.every(
            (o) => segmentBox(b.x, b.z, b.x, b.z, o, 1.1) === Infinity,
          ),
        );
    }
  }
});

test("legacy saves migrate economy safely; extracted treasure buys bounded permanent field kits", () => {
  const old = {
    version: 2,
    mission: 1,
    armor: 1,
    power: 0,
    mobility: 0,
    best: 1000,
    completed: false,
  };
  const legacy = validateSave(old);
  assert.equal(legacy.credits, 0);
  assert.equal(legacy.squad, 0);
  assert.equal(legacy.fieldKit, 0);
  let s = advanceCampaign(freshSave(), "power", 1500, {
    credits: TREASURE.money + TREASURE.gold + TREASURE.diamond,
    squad: 1,
  });
  assert.equal(s.credits, 110);
  assert.equal(s.squad, 1);
  s = buyFieldKit(s);
  assert.equal(s.credits, 10);
  assert.equal(s.fieldKit, 1);
  assert.equal(s.power, 1);
  assert.deepEqual(buyFieldKit(s), s);
  assert.equal(fieldKitCost(s), 200);
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
  for (const [key, value] of [
    ["credits", -1],
    ["credits", Infinity],
    ["squad", 4],
    ["squad", 1.5],
    ["fieldKit", 4],
  ])
    assert.deepEqual(validateSave({ ...s, [key]: value }), freshSave());
  const capped = advanceCampaign(
    { ...freshSave(), credits: 999999 },
    "armor",
    Infinity,
    { credits: 99999, squad: 40 },
  );
  assert.equal(capped.credits, 1000000);
  assert.equal(capped.squad, MAX_SQUAD);
  assert.equal(capped.best, 0);
  const max = { ...s, fieldKit: 3, credits: 1000 };
  assert.equal(fieldKitCost(max), null);
  assert.deepEqual(buyFieldKit(max), max);
  const final = advanceCampaign({ ...freshSave(), mission: 20 }, "armor", 100, {
    credits: 100,
    squad: 3,
  });
  assert.deepEqual(
    advanceCampaign(final, "armor", 999, { credits: 100, squad: 3 }),
    final,
  );
});

test("opened prison walls allow foot access through every rotated door while the back stays solid", async () => {
  const { openedPrisonWalls } = await import("../src/rescue.mjs");
  const { moveCircle } = await import("../src/rules.mjs");
  for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const box = { x: 0, z: 0, w: 4.2, d: 4.2, rotation },
      walls = openedPrisonWalls(box);
    let p = { x: Math.sin(rotation) * 3.4, z: Math.cos(rotation) * 3.4 };
    for (let i = 0; i < 100; i++) {
      const d = Math.hypot(p.x, p.z);
      if (d < 0.03) break;
      p = moveCircle(
        p.x,
        p.z,
        (-p.x / d) * 0.04,
        (-p.z / d) * 0.04,
        0.52,
        walls,
      );
    }
    assert.ok(Math.hypot(p.x, p.z) < 0.05, `open door ${rotation}`);
    const blocked = moveCircle(
      0,
      0,
      -Math.sin(rotation) * 6,
      -Math.cos(rotation) * 6,
      0.52,
      walls,
    );
    assert.ok(Math.hypot(blocked.x, blocked.z) < 1.4, `back wall ${rotation}`);
  }
});

test("opening a prison never lands a wall on a soldier standing at the closed door", async () => {
  const { openedPrisonWalls } = await import("../src/rescue.mjs");
  const { moveCircle, resolveOverlap } = await import("../src/rules.mjs");
  const r = 0.48,
    bound = { x: 60, minZ: -60, maxZ: 60 };
  for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const box = { x: 3, z: -7, w: 4.2, d: 4.2, rotation },
      c = Math.cos(rotation),
      s = Math.sin(rotation),
      walls = openedPrisonWalls(box);
    for (let lx = -2.5; lx <= 2.5; lx += 0.25) {
      // Touching the closed box's front face, anywhere along the door side.
      const lz = 2.1 + r + 1e-6;
      const x = box.x + lx * c + lz * s,
        z = box.z - lx * s + lz * c;
      const free = resolveOverlap(x, z, r, walls);
      assert.ok(
        Math.hypot(free.x - x, free.z - z) < 1e-9,
        `wall landed on soldier at ${lx} (${rotation})`,
      );
      // Sideways movement along the door stays possible.
      const side = moveCircle(x, z, c * 0.1, -s * 0.1, r, walls, bound);
      assert.ok(Math.hypot(side.x - x, side.z - z) > 0.05);
    }
  }
});

test("resolveOverlap frees a circle pinned inside or against a box", async () => {
  const { resolveOverlap } = await import("../src/rules.mjs");
  const wall = { x: 0, z: 0, w: 2, d: 0.4 };
  const grazing = resolveOverlap(0.2, 0.5, 0.48, [wall]);
  assert.ok(grazing.z >= 0.2 + 0.48 - 1e-6);
  const buried = resolveOverlap(0.9, 0.05, 0.48, [wall]);
  assert.ok(buried.x >= 1 + 0.48 - 1e-6, JSON.stringify(buried));
  assert.deepEqual(resolveOverlap(5, 5, 0.48, [wall]), { x: 5, z: 5 });
});
