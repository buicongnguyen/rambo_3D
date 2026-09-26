import { addPrisons } from "./rescue.mjs";
import { missionStory } from "./story.mjs";
import { addRuins } from "./ruins.mjs";
import { addRelayHouses } from "./relay-houses.mjs";
import { openingLayout, tacticalCover } from "./progression.mjs";
import { finishEnvironment } from "./environment.mjs";
import { routePlan, routePoint, routeBox } from "./routes.mjs";
import { squareLandscape } from "./landscapes.mjs";
import { softenObstacles } from "./combat.mjs";
import { segmentBox } from "./rules.mjs";
import { STAGES, LEVELS_PER_STAGE, WORLD_BOUNDS } from "./campaign.mjs";
export type Box = {
  x: number;
  z: number;
  w: number;
  d: number;
  kind?: string;
  hp?: number;
  asset?: string;
  scale?: number;
  height?: number;
  originalW?: number;
  originalD?: number;
  rotation?: number;
  entrance?: { x: number; z: number };
  exit?: { x: number; z: number };
};
export type Patch = { x: number; z: number; radius: number; kind: string };
export type Mission = {
  name: string;
  stage: number;
  level: number;
  layout: number;
  shape: string;
  square: boolean;
  diagonal: boolean;
  bounds: { x: number; minZ: number; maxZ: number };
  biome: string;
  finale: boolean;
  region: string;
  tag: string;
  description: string;
  brief: string;
  radio: string;
  success: string;
  action: string;
  boss: string;
  bossModel: string;
  /** A second command boss that joins the finale (late stages, not on Easy). */
  bossEscort?: string;
  color: number;
  ground: number;
  fog: number;
  route: { x: number; z: number }[];
  roads: { x: number; z: number }[][];
  start: { x: number; z: number };
  direction: string;
  objective: { x: number; z: number };
  extract: { x: number; z: number };
  bossPos: { x: number; z: number };
};
export const BOSS_NAMES: Record<string, string> = {
  gunship: "COBRA FANG",
  spider: "IRON WIDOW",
  laserTank: "PRISM MAMMOTH",
  quadMech: "FOURFOLD TITAN",
  rocketMech: "SIEGE COLOSSUS",
  missileTruck: "TWIN TEMPEST",
  skyWraith: "SKY WRAITH",
  walker: "IRON SOVEREIGN",
};
export const MISSIONS: Mission[] = STAGES.flatMap((s, stage) =>
  Array.from({ length: LEVELS_PER_STAGE }, (_, level) => {
    const plan = routePlan(stage, level);
    const story = missionStory(stage, level);
    return {
      ...plan,
      name: s.name,
      stage,
      level,
      biome: s.biome,
      finale: level === 2,
      region: s.name.toUpperCase(),
      tag: ["BREACH / APPROACH", "RECOVER / HOLD", "COMMAND / FINALE"][level],
      description: s.tip,
      brief:
        stage === 0 && level === 0
          ? `${story.stakes} Reach the yellow radio relay, defeat its two response guards, then reach green extraction. Rifle ammunition is unlimited; four frag grenades are ready. An early M249 cache and blue prison door offer optional bonuses: approach the door to free a soldier who follows and fires with you. Clearing every patrol is optional.`
          : `${story.stakes} ${story.action}. ${s.tip} Follow the ${plan.shape.toLowerCase()} road${plan.shape === "O" ? " — choose either arm around the central woodland" : ""}, fight for vehicles and weapon caches, secure the relay, ${level === 2 ? "destroy the command bosses" : "defeat the relay guards"} and reach extraction. Free prisoners at blue doors to grow your squad; extract treasure to upgrade your field kit. Vale is coordinating the evacuation from the air.`,
      radio:
        stage === 0 && level === 0
          ? "Vale: Find their signal. Reach the yellow relay, clear two response guards, then follow green extraction. Blue prison doors rescue allies automatically. Collect the nearby M249 cache; clearing other patrols is optional."
          : `${s.name}. ${s.tip} Follow the ${plan.direction.toLowerCase()}. ${plan.shape === "O" ? "Both sides of the loop lead to the relay. Choose your approach. " : ""}Patrols hold vehicles and weapon caches ahead. Shoot small trees to open firing lanes. Approach the yellow relay to secure it automatically; response guards leave nearby houses.`,
      success: story.success,
      action: story.action,
      boss:
        BOSS_NAMES[s.boss] +
        ("escort" in s && s.escort ? " + " + BOSS_NAMES[s.escort] : ""),
      bossModel: s.boss,
      bossEscort: "escort" in s ? s.escort : undefined,
      color: 0xe1ed98,
      ground: s.ground,
      fog: s.fog,
    };
  }),
);
export const COVER: Box[] = [];
export const PATCHES: Patch[] = [];
export const SPAWNS: number[][] = [];
const base: Box[] = [
  { x: -7, z: 15, w: 3, d: 2 },
  { x: 8, z: 11, w: 3, d: 2 },
  { x: -4, z: 4, w: 3, d: 2 },
  { x: 5, z: -3, w: 3, d: 2 },
  { x: -11, z: -8, w: 3, d: 2 },
  { x: 11, z: -12, w: 3, d: 2 },
  { x: -20, z: 5, w: 4, d: 4 },
  { x: 20, z: 6, w: 4, d: 4 },
  { x: -21, z: -15, w: 3, d: 3 },
];
export function buildLayout(m: Mission) {
  COVER.length = PATCHES.length = SPAWNS.length = 0;
  Object.assign(WORLD_BOUNDS, m.bounds);
  if (m.stage === 0 && m.level === 0) {
    const opening = openingLayout();
    COVER.push(...opening.boxes);
    PATCHES.push(...opening.patches);
    SPAWNS.push(...opening.spawns);
    addRelayHouses(m, COVER, PATCHES);
    addRuins(m, COVER);
    addPrisons(m, COVER, PATCHES);
    finishEnvironment(COVER, m.bounds);
    return;
  }
  if (m.square) {
    const landscape = squareLandscape(m);
    COVER.push(...landscape.boxes);
    PATCHES.push(...landscape.patches);
    SPAWNS.push(...landscape.spawns);
    tacticalCover(m, COVER);
    addRelayHouses(m, COVER, PATCHES);
    addRuins(m, COVER);
    addPrisons(m, COVER, PATCHES);
    finishEnvironment(COVER, m.bounds);
    return;
  }
  const clearLandmark = (x: number, z: number, r = 6) =>
    [
      { x: 0, z: -76 },
      { x: 0, z: -108 },
      { x: 0, z: -94 },
      { x: 0, z: 23 },
    ].every((p) => Math.hypot(x - p.x, z - p.z) > r);
  for (let zone = 0; zone < 3; zone++)
    for (const b of base) {
      const box = {
        ...b,
        asset: b.w === 4 ? "tent" : b.d === 3 ? "tower" : "crate",
        x: m.level === 1 ? -b.x : b.x,
        z: b.z - zone * 40 - (m.level === 2 ? 2 : 0),
        kind: m.biome === "city" && b.w === 4 ? "building" : "cover",
      };
      if (clearLandmark(box.x, box.z)) COVER.push(box);
    }
  if (m.biome === "city")
    for (let z = -24; z > -100; z -= 24)
      for (const x of [-21, -11, 11, 21]) {
        if (clearLandmark(x, z))
          COVER.push({ x, z, w: 5, d: 7, kind: "building" });
      }
  if (m.biome === "jungle" || m.biome === "ice")
    for (let i = 0; i < (m.biome === "jungle" ? 64 : 34); i++) {
      const x = (i % 2 ? 1 : -1) * (7 + ((i * 7) % 18)),
        z = 12 - ((i * 19) % 109);
      if (
        clearLandmark(x, z, 7) &&
        !COVER.some(
          (b) =>
            Math.abs(x - b.x) < b.w / 2 + 2 && Math.abs(z - b.z) < b.d / 2 + 2,
        )
      )
        COVER.push({
          x,
          z,
          w: 0.85,
          d: 0.85,
          kind: m.biome === "ice" ? "snowTree" : "tree",
          hp: 65,
        });
    }
  for (let i = 0; i < 18; i++) {
    const x = (i % 2 ? 1 : -1) * (5 + ((i * 3) % 15)),
      z = 8 - i * 6;
    if (
      clearLandmark(x, z, 5) &&
      !COVER.some(
        (b) =>
          Math.abs(x - b.x) < b.w / 2 + 1.4 &&
          Math.abs(z - b.z) < b.d / 2 + 1.4,
      )
    )
      COVER.push({ x, z, w: 0.8, d: 0.8, kind: "fuel", hp: 25 });
  }
  if (["ice", "sand", "mud"].includes(m.biome))
    for (let i = 0; i < 17; i++) {
      const x = i % 3 === 0 ? 0 : i % 3 === 1 ? -15 : 15,
        z = 10 - i * 6.5;
      if (clearLandmark(x, z, 5))
        PATCHES.push({
          x,
          z,
          radius: m.biome === "ice" ? 8 : 3.5 + (i % 2),
          kind: m.biome,
        });
    }
  const soldiers = 24 + m.level * 4 + (m.biome === "city" ? 8 : 0);
  for (let i = 0; i < soldiers; i++)
    SPAWNS.push([
      (i % 2 ? 1 : -1) * (7 + ((i * 5) % 15)),
      14 - (Math.floor(i / 2) * 102) / (Math.ceil(soldiers / 2) - 1),
    ]);

  for (const box of COVER) Object.assign(box, routeBox(m.layout, box));
  for (const patch of PATCHES)
    Object.assign(patch, routePoint(m.layout, patch.x, patch.z));
  for (const spawn of SPAWNS) {
    const p = routePoint(m.layout, spawn[0], spawn[1]);
    spawn[0] = p.x;
    spawn[1] = p.z;
  }
  const routes = [...m.route.slice(1).map((p, i) => [m.route[i], p])];
  const onRoad = (b: Box) =>
    routes.some(
      ([a, p]) => segmentBox(a.x, a.z, p.x, p.z, b, 3.6) !== Infinity,
    );
  const gates: Box[] = [];
  for (let row = 0; row < 4; row++) {
    const z = -10 - row * 20,
      gap = row % 2 ? -10 : 10;
    for (let x = -27; x <= 27; x += 3) {
      if (Math.abs(x - gap) < 9) continue;
      const b = routeBox(m.layout, { x, z, w: 3, d: 1.4, kind: "concrete" });
      if (!onRoad(b)) gates.push(b);
    }
  }
  for (let i = COVER.length - 1; i >= 0; i--) {
    const b = COVER[i];
    if (
      onRoad(b) ||
      gates.some(
        (g) =>
          Math.abs(g.x - b.x) < (g.w + b.w) / 2 + 0.5 &&
          Math.abs(g.z - b.z) < (g.d + b.d) / 2 + 0.5,
      )
    )
      COVER.splice(i, 1);
  }
  COVER.push(...gates);
  const trees = softenObstacles(COVER, m.biome);
  COVER.splice(0, COVER.length, ...trees);
  tacticalCover(m, COVER);
  addRelayHouses(m, COVER, PATCHES);
  addRuins(m, COVER);
  addPrisons(m, COVER, PATCHES);
  finishEnvironment(COVER, m.bounds);
}
