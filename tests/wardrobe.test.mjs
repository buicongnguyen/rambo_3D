import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  HEROES,
  OUTFITS,
  lookVariant,
  starTotal,
  unlockOutfits,
  validLook,
  wear,
} from "../src/wardrobe-rules.mjs";
import { freshSave, validateSave } from "../src/rules.mjs";

const glb = (file) => {
  const buffer = fs.readFileSync(file);
  return {
    bytes: buffer.length,
    json: JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12))),
  };
};

test("a fresh or broken save wears the commando's fatigues; unknown looks fall back", () => {
  assert.deepEqual(
    { hero: freshSave().hero, outfit: freshSave().outfit, outfits: freshSave().outfits },
    { hero: "commando", outfit: "none", outfits: ["none"] },
  );
  assert.deepEqual(validLook({ hero: "tank", outfit: "mecha", outfits: ["mecha", "x", "mecha"] }), {
    hero: "commando",
    outfit: "mecha",
    outfits: ["none", "mecha"],
  });
  // An outfit that was never unlocked cannot be worn from an edited save.
  assert.equal(validLook({ outfit: "pirate", outfits: [] }).outfit, "none");
  const saved = { ...freshSave(), hero: "commandoWoman", outfit: "navy", outfits: ["none", "navy"] };
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(saved))), saved);
});

test("outfits unlock with campaign stars, stay unlocked, and only owned ones can be worn", () => {
  assert.deepEqual(OUTFITS.map((o) => o.stars), [0, 3, 6, 12, 18, 27, 40]);
  assert.ok(OUTFITS.at(-1).stars <= 21 * 3, "every outfit is reachable");
  let save = { ...freshSave(), stars: [3, 3, 1] };
  assert.equal(starTotal(save.stars), 7);
  const first = unlockOutfits(save);
  assert.deepEqual(first.unlocked, ["navy", "pirate"]);
  save = first.save;
  assert.deepEqual(unlockOutfits(save).unlocked, []);
  // A new campaign wipes stars, never outfits.
  save = { ...freshSave(), outfits: save.outfits };
  assert.deepEqual(unlockOutfits(save).save.outfits, ["none", "navy", "pirate"]);
  assert.equal(wear(save, { outfit: "knight" }).outfit, "none");
  assert.equal(wear(save, { outfit: "pirate" }).outfit, "pirate");
  assert.equal(wear(save, { hero: "commandoWoman" }).hero, "commandoWoman");
  assert.equal(wear(save, { hero: "rifleman" }).hero, "commando");
  assert.equal(lookVariant("none"), undefined);
  assert.equal(lookVariant("navy"), "look-navy");
});

test("disguises.glb holds every outfit, fitted for both bodies, and loads only when worn", () => {
  const { bytes, json } = glb("public/models/disguises.glb");
  assert.ok(bytes < 170_000, `${bytes} bytes`);
  let tris = 0;
  for (const m of json.meshes)
    for (const p of m.primitives) tris += json.accessors[p.indices].count / 3;
  assert.ok(tris < 4000, `${tris} triangles`);
  const joints = (file) =>
    new Set(glb(file).json.nodes.map((n) => n.extras?.joint).filter(Boolean));
  const bodies = HEROES.map((h) => joints(`public/models/${h.id}.glb`));
  const roots = json.nodes.filter((n) => n.name.startsWith("dz_") && !n.name.includes("@"));
  assert.deepEqual(
    roots.map((n) => n.name.slice(3)).sort(),
    OUTFITS.filter((o) => o.id !== "none").map((o) => o.id).sort(),
  );
  for (const root of roots) {
    const tints = JSON.parse(root.extras.tints);
    for (const hex of Object.values(tints)) assert.match(hex, /^#[0-9a-f]{6}$/);
    for (const entry of root.extras.hide.split("|").filter(Boolean)) {
      const [joint] = entry.split(":");
      for (const body of bodies) assert.ok(body.has(joint), `${root.name} hides on ${joint}`);
    }
    for (const i of root.children) {
      const wearNode = json.nodes[i];
      for (const body of bodies) assert.ok(body.has(wearNode.extras.wear), wearNode.name);
      assert.equal(wearNode.extras.fit.length, 3);
      assert.ok(wearNode.children?.length, `${wearNode.name} has pieces`);
    }
  }
  // Not one of the boot models (the 5.5 MB boot budget is in assets.test.mjs).
  assert.ok(!fs.readFileSync("src/world.ts", "utf8").includes('"disguises"'));
});

test("every body and look has a wardrobe card and a lazy 2.5D sheet", () => {
  const manifest = JSON.parse(fs.readFileSync("public/sprites/manifest.json"));
  for (const hero of HEROES)
    for (const outfit of OUTFITS) {
      assert.ok(fs.statSync(`public/ui/look-${hero.id}-${outfit.id}.webp`).size > 1000);
      const variant = lookVariant(outfit.id);
      const key = variant ? `${hero.id}:${variant}` : hero.id;
      const entry = manifest[key];
      assert.ok(entry, key);
      assert.equal(entry.frames, 4, key);
      assert.equal(entry.dirs, 8, key);
      // The plain commando is everyone's default; the other looks load when worn.
      assert.equal(!!entry.lazy, key !== "commando", key);
      assert.ok(fs.statSync(`public/sprites/${entry.file}`).size < 70_000, key);
    }
});
