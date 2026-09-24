export const STAGES = [
  {
    name: "White Horizon",
    biome: "ice",
    boss: "gunship",
    ground: 0xe4eff5,
    fog: 0xc9e1ef,
    tip: "Ice carries your momentum. Snow-covered trees shelter fuel depots.",
  },
  {
    name: "Cinderfall",
    biome: "volcano",
    boss: "spider",
    ground: 0x4f3a33,
    fog: 0xa87a64,
    tip: "Volcanic rockfalls strike both sides. Leave the orange warning rings.",
  },
  {
    name: "Dune Lifeline",
    biome: "sand",
    boss: "missileTruck",
    ground: 0xe2b873,
    fog: 0xf0cf95,
    tip: "Sand traps slow movement to one quarter. Follow the firm routes.",
  },
  {
    name: "Canopy Hold",
    biome: "jungle",
    boss: "quadMech",
    ground: 0x4f8c35,
    fog: 0x9cc58a,
    tip: "Dense trees block movement and gunfire. Blast a path through the jungle.",
  },
  {
    name: "Citadel Dawn",
    biome: "city",
    boss: "laserTank",
    ground: 0xaaa295,
    fog: 0xc4c9c6,
    tip: "Patrols flank through streets. Use buildings and barricades against laser fire.",
  },
  {
    name: "Faultline Zero",
    biome: "quake",
    boss: "rocketMech",
    ground: 0xb5936a,
    fog: 0xd9bd93,
    tip: "Dust plumes warn of tremors. Soldiers and ground bosses freeze for 1–2 seconds.",
  },
  {
    name: "Mire Crossing",
    biome: "mud",
    boss: "spider",
    ground: 0x5f6d3b,
    fog: 0xa2b184,
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
