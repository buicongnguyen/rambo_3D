import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
test("all forty-one Blender GLBs are valid glTF 2, contain real geometry, and meet asset budget", () => {
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
    ...[
      "rifle",
      "shotgun",
      "machineGun",
      "sniper",
      "flame",
      "launcher",
      "explosiveArrow",
      "missile",
      "laser",
      "throwBomb",
      "poisonBomb",
    ].map((id) => "weapon_" + id),
    "projectile_rocket",
    "projectile_arrow",
    "projectile_grenade",
  ];
  let bytes = 0;
  for (const name of names) {
    const buffer = fs.readFileSync(path.join("public/models", name + ".glb"));
    bytes += buffer.length;
    assert.equal(buffer.toString("ascii", 0, 4), "glTF");
    assert.equal(buffer.readUInt32LE(4), 2);
    assert.equal(buffer.readUInt32LE(8), buffer.length);
    const json = JSON.parse(
      buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)),
    );
    assert.ok(json.meshes.length > 0);
    assert.ok(json.accessors.some((a) => a.type === "VEC3"));
    assert.equal(json.asset.version, "2.0");
  }
  assert.ok(bytes < 9_650_000);
  assert.ok(fs.statSync("art/nightfall.blend").size > 100_000);
});

test("character exports contain hip, knee, shoulder and elbow hierarchies", () => {
  for (const name of [
    "commando",
    "rifleman",
    "captive",
    "quadMech",
    "rocketMech",
  ]) {
    const b = fs.readFileSync(`public/models/${name}.glb`),
      g = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12)));
    const joints = new Map(
      g.nodes.filter((n) => n.extras?.joint).map((n) => [n.extras.joint, n]),
    );
    for (const joint of [
      "Motion",
      "Hips",
      "Spine",
      "Head",
      "ThighL",
      "ThighR",
      "ShinL",
      "ShinR",
      "ArmL",
      "ArmR",
      "ForearmL",
      "ForearmR",
    ])
      assert.ok(
        joints.get(joint)?.children?.length > 0,
        `${name}: ${joint} must control child geometry`,
      );
  }
});

test("all boss weapons expose real articulated muzzle and launcher mounts", () => {
  const expected = {
    quadMech: ["Muzzle0", "Muzzle1", "Muzzle2", "Muzzle3"],
    rocketMech: ["Muzzle0", "Muzzle1", "Launch0", "Launch1"],
    missileTruck: ["Launch0", "Launch1", "Pod0", "Pod1", "Wheel0", "Wheel5"],
    gunship: ["AuxGun", "MuzzleAux"],
    spider: ["AuxGun", "MuzzleAux"],
    laserTank: ["AuxGun", "MuzzleAux"],
  };
  for (const [name, keys] of Object.entries(expected)) {
    const b = fs.readFileSync(`public/models/${name}.glb`);
    const g = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12)));
    const joints = g.nodes
      .filter((n) => n.extras?.joint)
      .map((n) => n.extras.joint);
    for (const key of keys)
      assert.equal(joints.filter((j) => j === key).length, 1, `${name}/${key}`);
  }
});
test("rescue assets expose an animated gate and keep the added download under 110 KB", () => {
  let bytes = 0;
  for (const name of ["prisonHouse", "money", "gold", "diamond"]) {
    const buffer = fs.readFileSync(`public/models/${name}.glb`);
    bytes += buffer.length;
    const gltf = JSON.parse(
      buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)),
    );
    assert.ok(gltf.materials.length >= 2);
    if (name === "prisonHouse") {
      const gate = gltf.nodes.filter((n) => n.extras?.joint === "Gate");
      assert.equal(gate.length, 1);
      assert.ok(gate[0].children.length >= 8);
    }
  }
  assert.ok(bytes < 110000);
  assert.ok(fs.statSync("art/rescue-kit.blend").size > 100000);
});
