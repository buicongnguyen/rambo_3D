// Operation Nightfall's light: each stage moves from its day grade at level 1 to
// dusk at its finale, and the last finale (Mire Crossing) is fought at night under
// the moon with a light on the hero. Pure data and maths; src/world.ts applies it,
// src/air.ts draws each biome's motes.

/** One grade. Colours are sRGB hex; `sun` is the key light's offset from the view. */
const grade = (key, keyI, sky, ground, fill, fog, density, sun, extra = {}) => ({
  key,
  keyI,
  sky,
  ground,
  fill,
  fog,
  density,
  sun,
  exposure: 1,
  env: 0.5,
  heroLight: 0,
  ...extra,
});
const HIGH = [-20, 35, 12],
  LOW = [-34, 17, 20];
/** Dusk: a lower, warmer key and less studio fill, so the colour of the sky wins. */
const DUSK = { env: 0.28 };
export const LIGHT = {
  ice: {
    day: grade(0xfff1d8, 3.0, 0xd6ecff, 0x6b6f7a, 1.25, 0xc9e1ef, 0.006, HIGH),
    dusk: grade(0xffb07c, 2.15, 0xa9b4e6, 0x5e4a6e, 0.85, 0xeab8b6, 0.007, LOW, DUSK),
  },
  volcano: {
    day: grade(0xffd8a8, 3.0, 0xffdcc6, 0x6b3a2a, 1.2, 0xa87a64, 0.006, HIGH),
    dusk: grade(0xff8c4c, 2.15, 0xd88c7c, 0x5a2418, 0.85, 0x8e4a3a, 0.008, LOW, DUSK),
  },
  sand: {
    day: grade(0xffe2b0, 3.1, 0xdcecff, 0x8a6a3a, 1.25, 0xf0cf95, 0.006, HIGH),
    dusk: grade(0xffa244, 2.35, 0xf0b892, 0x7a4a2a, 0.85, 0xf2a870, 0.007, LOW, DUSK),
  },
  jungle: {
    day: grade(0xffe8b8, 2.9, 0xd6f0e0, 0x4a5a2a, 1.25, 0x9cc58a, 0.006, HIGH),
    dusk: grade(0xffb062, 2.05, 0xbcd2a2, 0x3a3a1a, 0.85, 0xc8b070, 0.007, LOW, DUSK),
  },
  city: {
    // Citadel Dawn opens on a pink dawn.
    day: grade(0xffd2c0, 2.9, 0xe2dcf2, 0x6a5a52, 1.25, 0xe4c8c8, 0.006, LOW),
    dusk: grade(0xffa060, 2.15, 0xc4a8c0, 0x4e3e3e, 0.85, 0xd0987c, 0.007, LOW, DUSK),
  },
  quake: {
    day: grade(0xffe0b0, 3.0, 0xe0e4ec, 0x7a5a3a, 1.25, 0xd9bd93, 0.006, HIGH),
    dusk: grade(0xff9850, 2.15, 0xc8a090, 0x5a3a28, 0.85, 0xd09070, 0.007, LOW, DUSK),
  },
  mud: {
    day: grade(0xffe4b8, 2.9, 0xd0e4d8, 0x4a4a2a, 1.25, 0xa2b184, 0.006, HIGH),
    // Blue hour before the last night.
    dusk: grade(0xff9a6a, 1.95, 0x8a96c4, 0x3a3a3a, 0.85, 0x6e7496, 0.007, LOW, DUSK),
  },
};
/**
 * The night of the last finale. The moon keeps at least 45% of a day key so
 * the fight stays readable; the hero's light warms the ground around Ghost.
 */
export const NIGHT = grade(
  0x9fb8ff,
  1.5,
  0x34508e,
  0x0c120e,
  0.6,
  0x0b1730,
  0.005,
  [-24, 32, -14],
  { exposure: 1, env: 0.12, heroLight: 30 },
);

const mix = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  let out = 0;
  for (const shift of [16, 8, 0])
    out |= Math.round(mix((a >> shift) & 255, (b >> shift) & 255, t)) << shift;
  return out;
};

/** The grade of a mission: level 0..2 of its stage, finales at dusk or night. */
export function gradeFor(biome, level, lastFinale = false) {
  if (lastFinale) return NIGHT;
  const { day, dusk } = LIGHT[biome] ?? LIGHT.jungle;
  const t = Math.max(0, Math.min(1, level / 2));
  return {
    key: mixHex(day.key, dusk.key, t),
    keyI: mix(day.keyI, dusk.keyI, t),
    sky: mixHex(day.sky, dusk.sky, t),
    ground: mixHex(day.ground, dusk.ground, t),
    fill: mix(day.fill, dusk.fill, t),
    fog: mixHex(day.fog, dusk.fog, t),
    density: mix(day.density, dusk.density, t),
    sun: day.sun.map((v, i) => mix(v, dusk.sun[i], t)),
    exposure: mix(day.exposure, dusk.exposure, t),
    env: mix(day.env, dusk.env, t),
    heroLight: 0,
  };
}

/**
 * Each biome's motes (src/air.ts): count at full detail, colour, world size,
 * drift velocity (m/s), sway (m), twinkle (0..1) and additive glow.
 */
export const AIR = {
  ice: { count: 520, color: 0xffffff, size: 0.16, vel: [0.6, -1.3, 0.25], sway: 0.6, twinkle: 0, glow: false, opacity: 0.9 },
  volcano: { count: 300, color: 0xff8a2a, size: 0.12, vel: [0.3, 0.9, -0.2], sway: 0.5, twinkle: 0.7, glow: true, opacity: 0.95 },
  sand: { count: 360, color: 0xf6dca8, size: 0.09, vel: [3.2, -0.15, 0.6], sway: 0.25, twinkle: 0, glow: false, opacity: 0.6 },
  jungle: { count: 260, color: 0xfff0a0, size: 0.1, vel: [0.15, 0.08, 0.1], sway: 0.9, twinkle: 0.5, glow: true, opacity: 0.75 },
  city: { count: 200, color: 0xfff2dc, size: 0.08, vel: [0.35, 0.05, 0.15], sway: 0.6, twinkle: 0.3, glow: false, opacity: 0.55 },
  quake: { count: 320, color: 0xe8c89a, size: 0.12, vel: [0.9, 0.12, 0.3], sway: 0.6, twinkle: 0, glow: false, opacity: 0.55 },
  mud: { count: 220, color: 0xd8ff7a, size: 0.12, vel: [0.1, 0.05, 0.08], sway: 1.1, twinkle: 0.9, glow: true, opacity: 0.9 },
};
