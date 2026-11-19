export const STAGES = [
  {
    name: "White Horizon",
    biome: "ice",
    boss: "gunship",
    ground: 0xe4eff5,
    tip: "Ice carries your momentum. Snow-covered trees shelter fuel depots.",
  },
  {
    name: "Cinderfall",
    biome: "volcano",
    boss: "spider",
    ground: 0x4f3a33,
    tip: "Volcanic rockfalls strike both sides. Leave the orange warning rings.",
  },
  {
    name: "Dune Lifeline",
    biome: "sand",
    boss: "missileTruck",
    ground: 0xe2b873,
    tip: "Sand traps slow movement to one quarter. Follow the firm routes.",
  },
  {
    name: "Canopy Hold",
    biome: "jungle",
    boss: "quadMech",
    ground: 0x4f8c35,
    tip: "Dense trees block movement and gunfire. Blast a path through the jungle.",
  },
  {
    name: "Citadel Dawn",
    biome: "city",
    boss: "laserTank",
    ground: 0xaaa295,
    tip: "Patrols flank through streets. Use buildings and barricades against laser fire.",
  },
  {
    name: "Faultline Zero",
    biome: "quake",
    boss: "rocketMech",
    escort: "walker",
    ground: 0xb5936a,
    tip: "Dust plumes warn of tremors. Soldiers and ground bosses freeze for 1–2 seconds.",
  },
  {
    name: "Mire Crossing",
    biome: "mud",
    boss: "skyWraith",
    escort: "walker",
    ground: 0x5f6d3b,
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
/** The force that answers this stage's final relay, in spawn order. */
export function finaleRoster(stage, difficulty) {
  const { boss, escort } = STAGES[stage];
  const config = difficultyConfig(difficulty);
  const kinds =
    escort && config !== DIFFICULTIES.easy ? [boss, escort] : [boss];
  return Array.from(
    { length: Math.max(config.bosses, kinds.length) },
    (_, i) => kinds[i % kinds.length],
  );
}
export function terrainFactor(kind, depth = 0) {
  return kind === "sand"
    ? 0.25
    : kind === "mud"
      ? Math.max(0.25, 0.6 - depth * 0.45)
      : 1;
}
