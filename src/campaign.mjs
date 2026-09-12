export const STAGES = [
  {
    name: "White Horizon",
    biome: "ice",
    boss: "gunship",
    ground: 0xc5d8df,
    fog: 0xb9ced8,
    tip: "Ice carries your momentum. Snow-covered trees shelter fuel depots.",
  },
  {
    name: "Cinderfall",
    biome: "volcano",
    boss: "spider",
    ground: 0x514743,
    fog: 0x95766d,
    tip: "Volcanic rockfalls strike both sides. Leave the orange warning rings.",
  },
  {
    name: "Dune Lifeline",
    biome: "sand",
    boss: "missileTruck",
    ground: 0xc1a56c,
    fog: 0xc8b58b,
    tip: "Sand traps slow movement to one quarter. Follow the firm routes.",
  },
  {
    name: "Canopy Hold",
    biome: "jungle",
    boss: "quadMech",
    ground: 0x354d30,
    fog: 0x6c8568,
    tip: "Dense trees block movement and gunfire. Blast a path through the jungle.",
  },
  {
    name: "Citadel Dawn",
    biome: "city",
    boss: "laserTank",
    ground: 0x676d71,
    fog: 0x929d9f,
    tip: "Patrols flank through streets. Use buildings and barricades against laser fire.",
  },
  {
    name: "Faultline Zero",
    biome: "quake",
    boss: "rocketMech",
    ground: 0x797164,
    fog: 0xa19481,
    tip: "Dust plumes warn of tremors. Soldiers and ground bosses freeze for 1–2 seconds.",
  },
  {
    name: "Mire Crossing",
    biome: "mud",
    boss: "spider",
    ground: 0x454d34,
    fog: 0x7c8770,
    tip: "Dark water holes pull you down. Keep moving to escape the mud.",
  },
];
export const LEVELS_PER_STAGE = 3;
export const LEVEL_COUNT = STAGES.length * LEVELS_PER_STAGE;
export const WORLD_BOUNDS = { x: 28.5, minZ: -115, maxZ: 28.5 };
export const DIFFICULTIES = {
  easy: { health: 230, soldiers: 1, bosses: 1 },
  normal: { health: 150, soldiers: 1, bosses: 1 },
  hard: { health: 150, soldiers: 2, bosses: 2 },
  crazy: { health: 150, soldiers: 4, bosses: 4 },
};
export function difficultyConfig(value) {
  return (
    DIFFICULTIES[value === "story" ? "easy" : value] ?? DIFFICULTIES.normal
  );
}
export function terrainFactor(kind, depth = 0) {
  return kind === "sand"
    ? 0.25
    : kind === "mud"
      ? Math.max(0.25, 0.6 - depth * 0.45)
      : 1;
}
