import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, COVER, buildLayout } from "../src/missions.ts";
import {
  perimeterWalls,
  ENV_BLAST,
  blastDamage,
  InteractionHint,
  isSmallTree,
} from "../src/environment.mjs";
import { moveCircle, segmentBox } from "../src/rules.mjs";
test("all 21 maps have continuous indestructible concrete edges and mixed explosive depots", () => {
  for (const m of MISSIONS) {
    buildLayout(m);
    const walls = COVER.filter((b) => b.kind === "boundary");
    assert.deepEqual(walls, perimeterWalls(m.bounds));
    assert.ok(walls.every((b) => !b.hp));
    assert.ok(
      COVER.some((b) => b.kind === "fuel"),
      m.name,
    );
    assert.ok(
      COVER.some((b) => b.kind === "explosive"),
      m.name,
    );
    const { x, minZ, maxZ } = m.bounds;
    for (const r of [0.48, 0.85, 1.65, 2.3]) {
      const a = moveCircle(x - 5, (minZ + maxZ) / 2, 30, 0, r, walls, m.bounds);
      assert.ok(a.x <= x - r);
      const b = moveCircle(0, minZ + 5, 0, -30, r, walls, m.bounds);
      assert.ok(b.z >= minZ + r);
    }
    assert.ok(
      Number.isFinite(
        segmentBox(0, (minZ + maxZ) / 2, x + 10, (minZ + maxZ) / 2, walls[1]),
      ),
    );
  }
});
test("environment blasts kill close soldiers, wound at the edge and have a finite radius", () => {
  const { radius, enemy, player } = ENV_BLAST;
  assert.ok(blastDamage(1, radius, enemy, 0.65) > 81);
  assert.ok(blastDamage(5, radius, enemy, 0.65) < 65);
  assert.equal(blastDamage(radius + 0.65, radius, enemy, 0.65), 0);
  assert.ok(blastDamage(3, radius, player, 0.5) > 0);
  assert.equal(isSmallTree({ kind: "tree", scale: 0.65 }), true);
  assert.equal(isSmallTree({ kind: "snowTree", scale: 0.65 }), true);
  assert.equal(isSmallTree({ kind: "tree" }), false);
  assert.equal(isSmallTree({ kind: "boundary", scale: 0.65 }), false);
});
test("interaction hints expire at one second, do not repeat, and re-arm only for a new context", () => {
  const hint = new InteractionHint();
  assert.equal(hint.update("board:0", 10), true);
  assert.equal(hint.update("board:0", 1009), true);
  assert.equal(hint.update("board:0", 1010), false);
  assert.equal(hint.update("board:0", 2000), false);
  assert.equal(hint.update("exit:0", 2001), true);
  assert.equal(hint.update("exit:0", 3001), false);
  hint.update(null, 3100);
  assert.equal(hint.update("board:0", 3200), true);
  hint.reset();
  assert.equal(hint.update("board:0", 3300), true);
});
