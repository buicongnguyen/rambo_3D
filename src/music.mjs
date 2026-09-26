/**
 * Background music composition: one original heroic "Nightfall" theme, arranged
 * per stage. Pure data, so it is deterministic and unit-testable; src/audio.ts
 * renders a theme once into a looping buffer, which costs almost nothing per frame.
 *
 * The melody climbs (bars 1-4), struggles (5-6), then resolves on a rising
 * cadence (7-8); the B section (9-16) answers it higher and brighter.
 */

/** [beat within bar, scale degree ("7r" = raised seventh), length in beats]. */
const MELODY = [
  [
    [0, 1, 1.5],
    [1.5, 5, 0.5],
    [2, 5, 2],
  ],
  [
    [0, 4, 1],
    [1, 3, 1],
    [2, 2, 1],
    [3, 3, 1],
  ],
  [
    [0, 1, 1.5],
    [1.5, 5, 0.5],
    [2, 8, 2],
  ],
  [
    [0, 7, 2],
    [2, 5, 2],
  ],
  [
    [0, 6, 1.5],
    [1.5, 5, 0.5],
    [2, 4, 1],
    [3, 3, 1],
  ],
  [
    [0, 3, 1.5],
    [1.5, 2, 0.5],
    [2, 1, 2],
  ],
  [
    [0, 5, 1],
    [1, "7r", 1],
    [2, 9, 2],
  ],
  [[0, 8, 4]],
  [
    [0, 8, 1.5],
    [1.5, 7, 0.5],
    [2, 5, 2],
  ],
  [
    [0, 6, 1],
    [1, 5, 1],
    [2, 3, 2],
  ],
  [
    [0, 5, 1.5],
    [1.5, 6, 0.5],
    [2, 7, 2],
  ],
  [
    [0, 9, 2],
    [2, 7, 2],
  ],
  [
    [0, 8, 1.5],
    [1.5, 6, 0.5],
    [2, 4, 2],
  ],
  [
    [0, 8, 1],
    [1, 6, 1],
    [2, 3, 1],
    [3, 5, 1],
  ],
  [
    [0, 5, 1],
    [1, "7r", 1],
    [2, 9, 1],
    [3, "7r", 1],
  ],
  [[0, 8, 4]],
];
/** Chord root per bar (scale degree): i VI III VII iv VI V i, twice. */
const CHORDS = [1, 6, 3, 7, 4, 6, 5, 1, 1, 6, 3, 7, 4, 6, 5, 1];
/** Major-key homecoming: I vi IV V IV vi V I, twice. */
const MAJOR_CHORDS = [1, 6, 4, 5, 4, 6, 5, 1, 1, 6, 4, 5, 4, 6, 5, 1];

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
};

/**
 * Per-stage arrangement: key, tempo, drum style and lead colour. The final
 * stage turns the theme to major for the homecoming.
 */
export const THEMES = {
  title: { root: 62, mode: "minor", bpm: 100, style: "anthem", lead: "brass" },
  ice: { root: 62, mode: "minor", bpm: 96, style: "march", lead: "bell" },
  volcano: { root: 60, mode: "minor", bpm: 118, style: "taiko", lead: "brass" },
  sand: { root: 64, mode: "minor", bpm: 108, style: "desert", lead: "pluck" },
  jungle: { root: 57, mode: "minor", bpm: 112, style: "jungle", lead: "flute" },
  city: { root: 55, mode: "minor", bpm: 124, style: "city", lead: "brass" },
  quake: { root: 53, mode: "minor", bpm: 100, style: "quake", lead: "brass" },
  mud: { root: 58, mode: "major", bpm: 110, style: "anthem", lead: "brass" },
};

/** Semitone offset of a scale degree (1-based; 8 = octave, 9 = second above). */
export function degree(mode, value, raise = false) {
  const scale = SCALES[mode] ?? SCALES.minor;
  if (value === "7r") return 11;
  const d = value - 1,
    octave = Math.floor(d / 7),
    step = ((d % 7) + 7) % 7;
  let semis = scale[step] + octave * 12;
  if (raise && step === 6 && mode !== "major") semis = 11 + octave * 12;
  return semis;
}

/** Triad (semitones above the key root) on a scale degree. */
function triad(mode, root) {
  // The dominant (V) borrows the raised seventh for a heroic cadence.
  const raise = root === 5;
  return [0, 2, 4].map((step) =>
    degree(mode === "major" ? "major" : "minor", root + step, raise),
  );
}

/**
 * Compose a theme into note events: { at, beats, note, voice, velocity }.
 * `boss` gives the faster, drum-heavy finale variant.
 */
export function composeTheme(name, boss = false) {
  const theme = THEMES[name] ?? THEMES.title;
  const bpm = Math.round(theme.bpm * (boss ? 1.1 : 1));
  const events = [];
  const add = (at, beats, note, voice, velocity = 1) =>
    events.push({ at, beats, note, voice, velocity });
  const key = theme.root,
    roots = theme.mode === "major" ? MAJOR_CHORDS : CHORDS;
  for (let bar = 0; bar < 16; bar++) {
    const t = bar * 4,
      sectionB = bar >= 8,
      chord = triad(theme.mode, roots[bar]);
    // Melody: lead colour in A; B doubles it an octave up with brass or strings.
    for (const [beat, value, beats] of MELODY[bar]) {
      const note = key + 12 + degree(theme.mode, value, roots[bar] === 5);
      add(t + beat, beats, note, theme.lead, sectionB ? 0.9 : 1);
      if (sectionB) add(t + beat, beats, note - 12, "strings", 0.5);
    }
    // Harmony: sustained string pad; bass on the chord root.
    for (const semis of chord) add(t, 4, key + semis, "pad", 0.55);
    const bassRoot = key - 24 + chord[0];
    const bassBeats =
      theme.style === "taiko" || theme.style === "city"
        ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
        : theme.style === "jungle"
          ? [0, 1.5, 2, 3.5]
          : [0, 2];
    for (const b of bassBeats)
      add(
        t + b,
        theme.style === "march" || theme.style === "anthem" ? 1.8 : 0.45,
        bassRoot + (theme.style === "city" && b % 1 ? 12 : 0),
        "bass",
        b === 0 ? 1 : 0.8,
      );
    // Percussion by stage style.
    const every = (beats, voice, velocity = 1) =>
      beats.forEach((b) =>
        // Timpani are tuned to the chord root; other drums are unpitched.
        add(
          t + b,
          0.25,
          voice === "timpani" ? bassRoot + 12 : 0,
          voice,
          velocity,
        ),
      );
    switch (theme.style) {
      case "march":
      case "anthem":
        every([0, 2], "timpani");
        every([1, 3], "snare", 0.8);
        if (bar % 4 === 3) every([3, 3.25, 3.5, 3.75], "snare", 0.55);
        if (theme.style === "anthem" && sectionB) every([0, 2], "kick");
        break;
      case "taiko":
        every([0, 0.75, 1.5, 2, 2.75, 3.5], "taiko");
        every([1, 3], "snare", 0.6);
        break;
      case "desert":
        every([0, 0.75, 1.5, 2.5, 3], "tom");
        every([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], "shaker", 0.5);
        break;
      case "jungle":
        every([0, 0.5, 1.25, 2, 2.5, 3.25], "bongo");
        every([0.25, 0.75, 1.75, 2.75, 3.75], "shaker", 0.45);
        every([0, 2], "kick", 0.8);
        break;
      case "city":
        every([0, 1.5, 2.5], "kick");
        every([1, 3], "snare");
        every([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], "hat", 0.45);
        break;
      case "quake":
        every([0, 2.5], "timpani");
        every([0], "boom");
        every([3], "snare", 0.6);
        break;
    }
    if (bar % 4 === 0) add(t, 2, 0, "crash", sectionB ? 0.7 : 0.45);
    if (boss) {
      every([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], "taiko", 0.7);
      for (const semis of chord) add(t, 0.5, key + semis, "brass", 0.6);
    }
  }
  return { name, bpm, beats: 64, seconds: (64 * 60) / bpm, events };
}

/** Which theme a mission plays: its stage biome (the title theme on the menu). */
export function themeFor(biome) {
  return THEMES[biome] ? biome : "title";
}

/** Voices that belong to the combat layer: all percussion. */
export const COMBAT_VOICES = new Set([
  "timpani",
  "boom",
  "snare",
  "kick",
  "taiko",
  "tom",
  "bongo",
  "shaker",
  "hat",
  "crash",
]);

/**
 * Adaptive music: the stage theme split into two stems that loop in sync.
 * `base` (melody, strings, pad, bass) always plays; `combat` (all percussion
 * plus a driving bass ostinato and brass stabs) fades in with combat intensity.
 * Both share the theme's tempo and length, so they stay phase-locked.
 */
export function themeStems(name) {
  const full = composeTheme(name);
  const theme = THEMES[name] ?? THEMES.title;
  const base = full.events.filter((e) => !COMBAT_VOICES.has(e.voice));
  const combat = full.events.filter((e) => COMBAT_VOICES.has(e.voice));
  const roots = theme.mode === "major" ? MAJOR_CHORDS : CHORDS;
  for (let bar = 0; bar < 16; bar++) {
    const t = bar * 4,
      chord = triad(theme.mode, roots[bar]);
    // Driving eighth-note bass an octave above the pedal, accenting the beat.
    for (let b = 0; b < 4; b += 0.5)
      combat.push({
        at: t + b,
        beats: 0.4,
        note: theme.root - 12 + chord[0],
        voice: "bass",
        velocity: b % 1 ? 0.45 : 0.65,
      });
    // Syncopated brass stabs on the chord: the "battle" hits.
    for (const b of [0, 1.5, 3])
      for (const semis of chord)
        combat.push({
          at: t + b,
          beats: 0.3,
          note: theme.root + semis,
          voice: "brass",
          velocity: b ? 0.35 : 0.45,
        });
  }
  const stem = (events) => ({ ...full, events });
  return { base: stem(base), combat: stem(combat) };
}
