import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOSS_DEFS } from "../src/bosses.mjs";
import { INFANTRY } from "../src/enemy-roles.mjs";

test("the 2.5D manifest covers every actor the game spawns, in 8 directions", () => {
  const manifest = JSON.parse(fs.readFileSync("public/sprites/manifest.json"));
  const keys = [
    "commando",
    "commando:ally",
    "commandoWoman:ally",
    "captive",
    "captiveWoman",
    "ninja",
    "tank",
    "tank:hostile",
    "jeep",
    "motorcycle",
    ...Object.keys(BOSS_DEFS),
    ...Object.keys(INFANTRY)
      .filter((r) => r !== "ninja")
      .map((r) => (r === "rifleman" ? "rifleman" : `rifleman:${r}`)),
  ];
  let bytes = 0;
  for (const key of keys) {
    const e = manifest[key];
    assert.ok(e, key);
    assert.equal(e.dirs, 8, key);
    assert.ok(e.size > 0 && e.cell >= 96, key);
    bytes += fs.statSync(`public/sprites/${e.file}`).size;
  }
  // People have idle, two walk frames and a fallen frame.
  assert.equal(manifest.rifleman.frames, 4);
  assert.ok(bytes < 1_500_000, `${bytes} bytes`);
});
