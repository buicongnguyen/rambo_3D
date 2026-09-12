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
