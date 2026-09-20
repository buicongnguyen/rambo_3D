import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MISSIONS, COVER, PATCHES, buildLayout } from "../src/missions.ts";
import { segmentBox } from "../src/rules.mjs";
import { placeSupplies, placeVehicles } from "../src/encounters.mjs";
import { missionPacing } from "../src/progression.mjs";

test("every campaign relay has open approaches and houses outside all tank-width roads", () => {
  for (const m of MISSIONS) {
    buildLayout(m);
    const houses = COVER.filter((b) => b.asset === "relayHouse");
    assert.equal(houses.length, m.stage === 0 && m.level === 0 ? 2 : 3);
    for (const h of houses) {
      assert.ok(Math.hypot(h.x - m.objective.x, h.z - m.objective.z) <= 25);
      for (const road of m.roads)
        for (let i = 1; i < road.length; i++)
          assert.equal(
            segmentBox(
              road[i - 1].x,
              road[i - 1].z,
              road[i].x,
              road[i].z,
              h,
              3.8,
            ),
            Infinity,
          );
      for (const b of COVER) {
        if (b !== h)
          assert.equal(
            segmentBox(
              h.entrance.x,
              h.entrance.z,
              m.objective.x,
              m.objective.z,
              b,
              0.7,
            ),
            Infinity,
          );
        assert.equal(
          segmentBox(h.exit.x, h.exit.z, h.exit.x, h.exit.z, b, 0.7),
          Infinity,
        );
      }
    }
    const pacing = missionPacing(m.stage, m.level);
    assert.equal(
      placeVehicles(m.route, COVER, PATCHES, m.bounds, m.roads, pacing).length,
      pacing.vehicles.length,
    );
    assert.equal(
      placeSupplies(m.route, COVER, PATCHES, m.bounds, 714, m.roads, pacing)
        .length,
      pacing.supplies?.length ?? 20,
    );
    const before = JSON.stringify(houses);
    buildLayout(m);
    assert.equal(
      JSON.stringify(COVER.filter((b) => b.asset === "relayHouse")),
      before,
    );
  }
});

test("Blender barracks exports an actual opening with enough clearance for infantry", () => {
  const buffer = fs.readFileSync("public/models/relayHouse.glb");
  const data = JSON.parse(
    buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)),
  );
  const house = data.nodes.find((n) => n.name === "RelayHouse");
  assert.equal(house.extras.doorWidth, 1.9);
  assert.equal(house.extras.doorHeight, 2.55);
  assert.ok(
    data.nodes.some(
      (n) =>
        n.name.startsWith("Open_steel_door") ||
        n.name.startsWith("Open steel door"),
    ),
  );
  assert.ok(fs.statSync("art/relay-house.blend").size > 100000);
  assert.ok(buffer.length < 400000);
});
