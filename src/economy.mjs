import { validateSave } from "./rules.mjs";
import { KIT_COSTS } from "./rescue.mjs";
export function fieldKitCost(save) {
  return KIT_COSTS[save.fieldKit ?? 0] ?? null;
}
export function buyFieldKit(save) {
  const next = validateSave(save),
    cost = fieldKitCost(next);
  if (cost === null || next.credits < cost) return next;
  next.credits -= cost;
  next.fieldKit++;
  return next;
}

/** One-mission weapon supply drops, delivered at deployment until a mission is won. */
export const SUPPLIES = [
  { id: "shotgun", weapon: 1, price: 40 },
  { id: "machineGun", weapon: 2, price: 70 },
  { id: "launcher", weapon: 5, price: 90 },
  { id: "missile", weapon: 7, price: 120 },
  { id: "laser", weapon: 8, price: 180 },
];
export function buySupply(save, id) {
  const next = validateSave(save),
    item = SUPPLIES.find((s) => s.id === id);
  if (!item || next.loadout.includes(id) || next.credits < item.price)
    return next;
  next.credits -= item.price;
  next.loadout = [...next.loadout, id];
  return next;
}
