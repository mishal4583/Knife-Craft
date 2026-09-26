/**
 * PREP_STEP_GUARDS — keeps every preparation session completable.
 *
 * PreparationScene will not let a knife touch an ingredient that has to be
 * peeled first (onion, potato, garlic… — any ingredient whose techniques
 * include "peel" and that isn't `peelDecoupled`) until that ingredient has
 * actually been peeled in the current chain. A recipe that asks to dice an
 * onion with no peel step before it therefore used to be a hard soft-lock:
 * no cut was ever accepted and the step could never finish.
 *
 * `withRequiredPeelSteps` closes that hole for EVERY content source at once
 * (campaign levels, Restaurant Service, Business Mode dishes): wherever a
 * fresh ingredient chain would be cut/smashed/ringed without being peeled,
 * a Peel step is inserted at the start of that chain and the original step
 * continues the same chain on the now-peeled ingredient. It is idempotent —
 * running it on its own output changes nothing — so Preparation.tsx (which
 * indexes its HUD by step) and PreparationScene can both apply it and stay
 * aligned. Nothing is removed or reordered.
 */
import { INGREDIENTS, type IngredientId, type TechniqueId } from "./definitions";

/** True when this ingredient must be peeled before this technique can be used on it. */
export function mustPeelBefore(ingredientId: IngredientId, techniqueId: TechniqueId): boolean {
  const ing = INGREDIENTS[ingredientId];
  return ing.techniques.includes("peel") && !ing.peelDecoupled && techniqueId !== "peel";
}

type StepShape = { ingredient: IngredientId; technique: TechniqueId; chainBreak?: boolean };

export function withRequiredPeelSteps<T>(
  steps: readonly T[],
  read: (s: T) => StepShape,
  /** Build a Peel step for `s`'s ingredient that starts the chain exactly where `s` would have (same chainBreak/destination). */
  makePeel: (s: T) => T,
  /** `s` as a continuation of the chain the inserted Peel step just started (chainBreak removed). */
  continueChain: (s: T) => T,
): T[] {
  const out: T[] = [];
  let prev: StepShape | null = null;
  let chainPeeled = false;
  for (const step of steps) {
    const s = read(step);
    const fresh = prev === null || prev.ingredient !== s.ingredient || !!s.chainBreak;
    if (fresh) chainPeeled = false;
    if (s.technique === "peel") {
      chainPeeled = true;
      out.push(step);
    } else if (fresh && !chainPeeled && mustPeelBefore(s.ingredient, s.technique)) {
      out.push(makePeel(step), continueChain(step));
      chainPeeled = true;
    } else {
      out.push(step);
    }
    prev = s;
  }
  return out;
}
