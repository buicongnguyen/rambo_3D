import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, composeTheme, degree, themeFor } from "../src/music.mjs";

test("every stage theme is a short 16-bar loop of the same heroic melody", () => {
  const melodies = new Set();
  for (const name of Object.keys(THEMES)) {
    const theme = composeTheme(name);
    assert.equal(theme.beats, 64);
    assert.ok(
      theme.seconds >= 25 && theme.seconds <= 42,
      `${name}: ${theme.seconds.toFixed(1)}s`,
    );
    const lead = theme.events.filter((e) => e.voice === THEMES[name].lead);
    assert.ok(lead.length >= 40, name);
    for (const e of theme.events) {
      assert.ok(e.at >= 0 && e.at < 64, `${name} timing`);
      if (e.note) assert.ok(e.note >= 24 && e.note <= 96, `${name} range`);
    }
    // Same contour (intervals between melody notes) in every key.
    const contour = lead
      .filter((e) => e.at < 32)
      .map((e, i, all) => (i ? e.note - all[i - 1].note : 0))
      .join(",");
    melodies.add(THEMES[name].mode === "major" ? "major" : contour);
  }
  assert.equal(melodies.size, 2, "one minor contour plus the major homecoming");
});

test("boss variants are faster and drum-heavier; biomes map to themes", () => {
  const calm = composeTheme("volcano"),
    boss = composeTheme("volcano", true);
  assert.ok(boss.bpm > calm.bpm);
  const drums = (t) => t.events.filter((e) => e.voice === "taiko").length;
  assert.ok(drums(boss) > drums(calm));
  assert.equal(themeFor("ice"), "ice");
  assert.equal(themeFor("nowhere"), "title");
  assert.equal(degree("minor", 8), 12);
  assert.equal(degree("minor", 7, true), 11);
  assert.equal(degree("major", 3), 4);
});
