import { missionRoute, routePoint, routeBox } from "./routes.mjs";
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
  originalW?: number;
  originalD?: number;
};
export type Patch = { x: number; z: number; radius: number; kind: string };
export type Mission = {
  name: string;
  stage: number;
  level: number;
  layout: number;
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
  color: number;
  ground: number;
  fog: number;
  route: { x: number; z: number }[];
  start: { x: number; z: number };
  direction: string;
  objective: { x: number; z: number };
  extract: { x: number; z: number };
  bossPos: { x: number; z: number };
};
const bossNames: Record<string, string> = {
  gunship: "COBRA FANG",
  spider: "IRON WIDOW",
  laserTank: "PRISM MAMMOTH",
};
const layoutFor = (stage: number, level: number) =>
  stage === 5 && level === 0 ? 3 : level;
export const MISSIONS: Mission[] = STAGES.flatMap((s, stage) =>
  Array.from({ length: LEVELS_PER_STAGE }, (_, level) => ({
    name: s.name,
    stage,
    level,
    layout: layoutFor(stage, level),
    biome: s.biome,
    finale: level === 2,
    region: s.name.toUpperCase(),
    tag: ["BREACH / APPROACH", "RECOVER / HOLD", "COMMAND / FINALE"][level],
    description: s.tip,
    brief: `${s.tip} Level ${level + 1}/3: follow the winding road and concrete chicanes, secure the relay, ${level === 2 ? "destroy the command bosses" : "defeat the relay guards"} and reach extraction. Vale is coordinating the evacuation from the air.`,
    radio: `${s.name}. ${s.tip} Follow the ${["northbound", "eastbound", "diagonal northeast", "southbound"][layoutFor(stage, level)]} zigzag road. Your relay is marked yellow.`,
    success:
      level === 2
        ? `${s.name} secured. The evacuation route is open. Choose your next advantage.`
        : "Relay secured. Refit your equipment before the next level.",
    action: [
      "Secure forward relay",
      "Recover evacuation codes",
      "Disable command uplink",
    ][level],
    boss: bossNames[s.boss],
    bossModel: s.boss,
    color: 0xe1ed98,
    ground: s.ground,
    fog: s.fog,
    route: missionRoute(layoutFor(stage, level)),
    start: routePoint(layoutFor(stage, level), 0, 23),
    direction: ["NORTHBOUND", "EASTBOUND", "NORTHEAST", "SOUTHBOUND"][
      layoutFor(stage, level)
    ],
    objective: routePoint(layoutFor(stage, level), 0, -76),
    extract: routePoint(layoutFor(stage, level), 0, -108),
    bossPos: routePoint(layoutFor(stage, level), 0, -94),
  })),
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
  Object.assign(
    WORLD_BOUNDS,
    m.layout === 1
      ? { x: 72, minZ: -71.5, maxZ: -14.5 }
      : { x: m.layout === 2 ? 72 : 28.5, minZ: -115, maxZ: 28.5 },
  );
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
}
