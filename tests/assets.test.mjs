import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
test("all eleven Blender GLBs are valid glTF 2, contain real geometry, and meet asset budget", () => {
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
  assert.ok(bytes < 5_000_000);
  assert.ok(fs.statSync("art/nightfall.blend").size > 100_000);
});
