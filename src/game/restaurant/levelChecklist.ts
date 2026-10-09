/**
 * The light half of levelGoals.ts (pass 3) that the cutting screen needs —
 * kept free of stock/economy imports so the lazy Preparation chunk stays
 * small: the multi-step checklist and the star text.
 */
import { INGREDIENTS, TECHNIQUES, type IngredientId, type TechniqueId } from "../definitions";

/** "★★☆" */
export function starText(stars: number): string {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

export type ChecklistItem = { label: string; state: "done" | "now" | "todo" };

/**
 * The dish's real steps ("Onion — peel"), ticked from the scene's step
 * events: steps before the active one are done; `finished` ticks them all.
 * Empty for a single-step dish (no panel).
 */
export function checklistFor(
  steps: readonly { ingredientId: IngredientId; techniqueId: TechniqueId }[],
  activeIndex: number,
  finished: boolean,
): ChecklistItem[] {
  if (steps.length < 2) return [];
  return steps.map((s, i) => ({
    label: `${INGREDIENTS[s.ingredientId].name} — ${TECHNIQUES[s.techniqueId].name.toLowerCase()}`,
    state: finished || i < activeIndex ? "done" : i === activeIndex ? "now" : "todo",
  }));
}
