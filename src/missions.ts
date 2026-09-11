export type Mission = {
  name: string;
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
  objective: { x: number; z: number };
  extract: { x: number; z: number };
  bossPos: { x: number; z: number };
};
export const MISSIONS: Mission[] = [
  {
    name: "Emerald Killbox",
    region: "THE KHE SAN VALLEY",
    tag: "RESCUE / INFILTRATION",
    description: "A voice in the static. A promise to keep.",
    brief:
      "Mara Vale went silent after intercepting HELIX targeting orders. Find her in the jungle outpost, take down the gunship, and bring her home.",
    radio:
      "Ghost, this is Vale. They moved me to the east camp. Watch the patrols. I knew you would come.",
    success:
      "Vale is safe. The targeting archive is moving upriver. We have one chance to intercept it.",
    action: "Free Mara Vale",
    boss: "COBRA FANG",
    bossModel: "gunship",
    color: 0xdceba0,
    ground: 0x42563a,
    fog: 0x889885,
    objective: { x: 15, z: 0 },
    extract: { x: 20, z: -22 },
    bossPos: { x: 3, z: -16 },
  },
  {
    name: "River Run",
    region: "THE NAM SONG RIVER",
    tag: "RECOVER / INTERCEPT",
    description: "Cut the supply line. Change the outcome.",
    brief:
      "The convoy is carrying a targeting archive that marks civilian evacuation routes. Recover it from the river relay and sink the Iron Viper before it escapes.",
    radio:
      "Vale here. The relay is across the river. Recover the archive first; the patrol barge will come to you.",
    success:
      "The archive names a launch controller at Blacksite Nine. Stop that launch and the valley gets another dawn.",
    action: "Recover targeting archive",
    boss: "IRON VIPER",
    bossModel: "barge",
    color: 0x8adbd0,
    ground: 0x465d50,
    fog: 0x72938f,
    objective: { x: -17, z: -1 },
    extract: { x: 20, z: -22 },
    bossPos: { x: 0, z: -17 },
  },
  {
    name: "Blacksite Siege",
    region: "BLACKSITE NINE",
    tag: "SABOTAGE / EXTRACTION",
    description: "One last signal. No one left behind.",
    brief:
      "HELIX is preparing the strike. Disable the launch relay, destroy the War Mammoth command tank, and make the final extraction. This ends tonight.",
    radio:
      "The launch relay is on the east side. Kill its uplink and the command tank will expose itself. I have your exit covered.",
    success:
      "Launch aborted. The evacuation corridor is open. For everyone who made it out, the night is finally over.",
    action: "Disable launch relay",
    boss: "WAR MAMMOTH",
    bossModel: "tank",
    color: 0xf0b78b,
    ground: 0x53564a,
    fog: 0x969181,
    objective: { x: 17, z: -3 },
    extract: { x: 20, z: -22 },
    bossPos: { x: 0, z: -17 },
  },
];
export type Box = { x: number; z: number; w: number; d: number };
export const COVER: Box[] = [
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
export const SPAWNS = [
  [-10, 12],
  [10, 7],
  [-7, -2],
  [9, -7],
  [-17, -9],
  [17, -12],
  [-7, -19],
  [8, -22],
];
