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
