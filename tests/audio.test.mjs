import { test } from "node:test";
import assert from "node:assert/strict";
import { GameAudio, stingerSeconds } from "../src/audio.ts";

test("music is short one-shot stingers only, never a long or looping track", () => {
  for (const cue of ["start", "win", "lose", "rampage", "bossDown"]) {
    assert.ok(GameAudio.isMusic(cue), cue);
    const seconds = stingerSeconds(cue);
    assert.ok(
      seconds > 0.3 && seconds <= 2.1,
      `${cue}: ${seconds.toFixed(2)}s`,
    );
  }
  assert.ok(stingerSeconds("rampage") < 1);
  assert.equal(GameAudio.isMusic("explosion"), false);
  assert.equal(stingerSeconds("explosion"), 0);
});

test("muted cues are dropped before any audio context is created", () => {
  const audio = new GameAudio();
  audio.configure(false, false);
  // No AudioContext exists in Node: a muted play must return without touching it.
  assert.doesNotThrow(() => {
    audio.play("explosion");
    audio.play("win");
  });
});
