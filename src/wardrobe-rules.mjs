// The hero's look: which body Ghost has and which outfit Ghost wears. Outfits are
// cosmetic and unlock with stars, so mastery (not grinding) dresses the hero.
// The 3D side is src/wardrobe.ts; the art is art/build_disguises.py.

export const HEROES = [
  { id: "commando", name: "Commando" },
  { id: "commandoWoman", name: "Commando woman" },
];
/** In wardrobe order; `stars` is the campaign star total that unlocks it. */
export const OUTFITS = [
  { id: "none", name: "Field fatigues", stars: 0 },
  { id: "navy", name: "Sailor", stars: 3 },
  { id: "pirate", name: "Pirate captain", stars: 6 },
  { id: "knight", name: "Sun knight", stars: 12 },
  { id: "aodai", name: "Áo dài", stars: 18 },
  { id: "vietnam", name: "Golden star", stars: 27 },
  { id: "mecha", name: "Battle robot", stars: 40 },
];
const HERO_IDS = HEROES.map((h) => h.id);
const OUTFIT_IDS = OUTFITS.map((o) => o.id);

export const starTotal = (stars) =>
  (Array.isArray(stars) ? stars : []).reduce(
    (n, s) => n + (Number.isSafeInteger(s) ? s : 0),
    0,
  );

/** The look fields of a save, sanitised: unknown or locked choices fall back. */
export function validLook(raw) {
  const outfits = [
    "none",
    ...new Set(
      (Array.isArray(raw?.outfits) ? raw.outfits : []).filter(
        (id) => id !== "none" && OUTFIT_IDS.includes(id),
      ),
    ),
  ];
  return {
    hero: HERO_IDS.includes(raw?.hero) ? raw.hero : "commando",
    outfit: outfits.includes(raw?.outfit) ? raw.outfit : "none",
    outfits,
  };
}

/**
 * Unlock every outfit the save's stars have earned. Unlocks are kept for good,
 * so starting a new campaign never takes an outfit away.
 */
export function unlockOutfits(save) {
  const total = starTotal(save.stars);
  const fresh = OUTFITS.filter(
    (o) => o.stars <= total && !save.outfits.includes(o.id),
  ).map((o) => o.id);
  if (!fresh.length) return { save, unlocked: [] };
  return {
    save: {
      ...save,
      outfits: OUTFITS.map((o) => o.id).filter(
        (id) => save.outfits.includes(id) || fresh.includes(id),
      ),
    },
    unlocked: fresh,
  };
}

/** Put on a body or an owned outfit; anything else leaves the save unchanged. */
export function wear(save, { hero, outfit } = {}) {
  const next = { ...save };
  if (hero !== undefined && HERO_IDS.includes(hero)) next.hero = hero;
  if (outfit !== undefined && save.outfits.includes(outfit))
    next.outfit = outfit;
  return next;
}

/** The 2.5D sprite variant for a look ("look-<outfit>"), or none in fatigues. */
export const lookVariant = (outfit) =>
  outfit && outfit !== "none" ? "look-" + outfit : undefined;
