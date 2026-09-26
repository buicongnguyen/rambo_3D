/** Authored sizes and attack identities; a separate light weapon never replaces the main attack. */
export const BOSS_DEFS = {
  gunship: {
    hp: 1100,
    radius: 2.4,
    scale: 0.83,
    ground: false,
    humanoid: false,
  },
  spider: {
    hp: 1100,
    radius: 2.4,
    scale: 0.83,
    ground: false,
    humanoid: false,
  },
  laserTank: {
    hp: 1100,
    radius: 2.4,
    scale: 0.83,
    ground: true,
    humanoid: false,
  },
  quadMech: { hp: 1250, radius: 2.4, scale: 0.9, ground: true, humanoid: true },
  rocketMech: {
    hp: 1400,
    radius: 2.4,
    scale: 0.9,
    ground: true,
    humanoid: true,
  },
  missileTruck: {
    hp: 1500,
    radius: 2.5,
    scale: 0.83,
    ground: true,
    humanoid: false,
  },
  // Late-stage bosses adapted from Steel Front, rescaled for a 150 HP commando.
  skyWraith: {
    hp: 1150,
    radius: 2.6,
    scale: 0.83,
    ground: false,
    humanoid: false,
  },
  walker: { hp: 850, radius: 2.8, scale: 0.8, ground: true, humanoid: false },
};
/**
 * SKY WRAITH attack helicopter. It circles the player and alternates a ROCKET
 * RAIN (three wide rings) with a GUN RUN (a line of small rings detonating in
 * sequence as it strafes), then hovers low and exposed while it rearms.
 * Steel Front's 70-damage rockets against 240 HP become 30 against 150 HP.
 */
export const WRAITH = {
  orbit: 13,
  speed: 5.5,
  rain: { damage: 30, interval: 5, warning: 2, radius: 3.6, count: 3 },
  // An odd ring count centres one ring on the player: step sideways to escape.
  run: {
    damage: 14,
    warning: 1.3,
    step: 0.22,
    radius: 2,
    count: 7,
    spacing: 4,
  },
  hover: 2.6,
};
/**
 * IRON SOVEREIGN walker: a 0.9 s three-line aim lock, then three cannon shells
 * along those locked lines (dodge sideways). Every third volley it overheats
 * and vents, exposing its core. Steel Front's 33-damage shells become 16.
 */
export const SOVEREIGN = {
  damage: 16,
  speed: 18,
  spread: 0.2,
  lock: 0.9,
  interval: 2.4,
  range: 30,
  volleys: 3,
  vent: 2.4,
};
export const AUX_GUN = { damage: 6, interval: 0.95, speed: 16, range: 28 };
export const QUAD_GUNS = {
  damage: 10,
  interval: 0.8,
  speed: 16,
  volleys: 6,
  reload: 2.4,
};
export const ROCKET_GUNS = { damage: 8, interval: 0.9, speed: 16 };
export const MISSILE_SALVOS = {
  rocketMech: {
    damage: 34,
    interval: 5.2,
    warning: 1.6,
    radius: 3.6,
    count: 3,
  },
  missileTruck: {
    damage: 40,
    interval: 6.5,
    warning: 1.9,
    radius: 4,
    count: 4,
  },
};
