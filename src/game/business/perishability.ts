/**
 * PERISHABILITY — Economy V3 Phase 4. Pure ageing/expiry logic layered on
 * top of the EXISTING `BusinessInventory` aggregate entries — no second
 * inventory, no per-batch/lot model. Reuses `INGREDIENTS[id].category`
 * exactly the way `businessPricing.ts`'s own `CATEGORY_BASE_UNIT_COST`
 * does (one small calibration table keyed by the existing category
 * field), so this file adds no new ingredient metadata either.
 *
 * Every function here is a pure function of (ingredientId, purchaseDay,
 * currentBusinessDay) — deterministic, no Math.random() anywhere. The
 * same saved state and the same business day always produce the same
 * state.
 */
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import type { BusinessInventory, IngredientRequirement } from "./businessInventory";
import {
  consumeIngredients,
  normalizeQuantity,
  type ConsumeIngredientsResult,
} from "./businessInventory";

export type PerishabilityState = "FRESH" | "AGING" | "NEAR_EXPIRY" | "EXPIRED";

/** Shelf life in Business Days, by ingredient category — same shape/pattern as businessPricing.ts's CATEGORY_BASE_UNIT_COST. Protein/Herb/Dairy spoil fastest, Aromatic slowest. */
const CATEGORY_SHELF_LIFE_DAYS: Record<string, number> = {
  Protein: 3,
  Herb: 3,
  Dairy: 4,
  Bakery: 5,
  Fruit: 6,
  Vegetable: 7,
  Aromatic: 12,
};

const DEFAULT_SHELF_LIFE_DAYS = 6;

export function shelfLifeForIngredient(ingredientId: IngredientId): number {
  const category = INGREDIENTS[ingredientId]?.category;
  return (category ? CATEGORY_SHELF_LIFE_DAYS[category] : undefined) ?? DEFAULT_SHELF_LIFE_DAYS;
}

/** Clamped to >= 0 — a corrupted/future-dated `purchaseDay` never produces a negative age. */
export function ageInDays(purchaseDay: number, currentBusinessDay: number): number {
  return Math.max(0, currentBusinessDay - purchaseDay);
}

/**
 * Deterministic thresholds as a fraction of the ingredient's own shelf
 * life: EXPIRED at 100%+, NEAR_EXPIRY at 75%+, AGING at 35%+, FRESH below
 * that. No randomness, no per-ingredient special-casing beyond the shelf
 * life table above.
 */
export function perishabilityStateFor(
  ingredientId: IngredientId,
  purchaseDay: number,
  currentBusinessDay: number,
): PerishabilityState {
  const shelfLife = shelfLifeForIngredient(ingredientId);
  const age = ageInDays(purchaseDay, currentBusinessDay);
  if (age >= shelfLife) return "EXPIRED";
  const fraction = age / shelfLife;
  if (fraction >= 0.75) return "NEAR_EXPIRY";
  if (fraction >= 0.35) return "AGING";
  return "FRESH";
}

export function isServable(state: PerishabilityState): boolean {
  return state !== "EXPIRED";
}

/**
 * The aggregate model (see businessInventory.ts) keeps ONE entry per
 * ingredient, so an entry is either wholly usable or wholly expired —
 * there is no partial expiry within a single entry. Returns 0 for an
 * ingredient never stocked or one whose entire entry has expired.
 */
export function usableQuantity(
  inventory: BusinessInventory,
  ingredientId: IngredientId,
  currentBusinessDay: number,
): number {
  const entry = inventory[ingredientId];
  if (!entry) return 0;
  const state = perishabilityStateFor(ingredientId, entry.purchaseDay, currentBusinessDay);
  return isServable(state) ? entry.quantity : 0;
}

/**
 * True only when EVERY requirement is satisfiable from non-expired
 * stock — mirrors businessInventory.ts's own hasIngredients exactly,
 * just gated on usableQuantity instead of raw getQuantity.
 *
 * Economy V3 Phase 14, Checkpoint 3 fix — pre-sums same-ingredient
 * requirement entries by ingredientId BEFORE checking, exactly like
 * `consumeUsableIngredients` below already does. Fixed because
 * `businessDishRequirements` (a dish with an ingredient used in more
 * than one component, e.g. Garlic Bread's two garlic components)
 * deliberately produces one entry PER COMPONENT rather than deduping —
 * checking each entry independently against the raw usable quantity
 * (the old behavior) let a dish needing 2 garlic pass availability with
 * only 1 in stock, since both entries independently saw the same
 * un-decremented quantity. Business QA scenario D caught this
 * regression; this brings the read-only check back into agreement with
 * the atomic consumption it's supposed to predict.
 */
export function hasUsableIngredients(
  inventory: BusinessInventory,
  requirements: readonly IngredientRequirement[],
  currentBusinessDay: number,
): boolean {
  const totals = new Map<IngredientId, number>();
  for (const r of requirements) {
    totals.set(r.ingredientId, normalizeQuantity((totals.get(r.ingredientId) ?? 0) + r.quantity));
  }
  return [...totals].every(
    ([ingredientId, quantity]) =>
      usableQuantity(inventory, ingredientId, currentBusinessDay) >= quantity,
  );
}

export type ConsumeUsableIngredientsResult =
  ConsumeIngredientsResult | { ok: false; reason: "expiredStock"; expired: IngredientId[] };

/**
 * The one "expired ingredients cannot be served" gate (brief's own
 * phrasing) — checks usable (non-expired) quantity for every requirement
 * BEFORE removing anything, then delegates the actual removal to the
 * existing `consumeIngredients` (removal itself doesn't need to know
 * about freshness: every unit of an aggregate entry shares the same
 * effective age, so if the requirement passed the usable-quantity gate,
 * the entry it removes from was already proven non-expired). Atomic,
 * same as `consumeIngredients` — a rejected call changes nothing.
 */
export function consumeUsableIngredients(
  inventory: BusinessInventory,
  requirements: readonly IngredientRequirement[],
  currentBusinessDay: number,
): ConsumeUsableIngredientsResult {
  const totals = new Map<IngredientId, number>();
  for (const r of requirements) {
    totals.set(r.ingredientId, normalizeQuantity((totals.get(r.ingredientId) ?? 0) + r.quantity));
  }
  const expired: IngredientId[] = [];
  const missing: IngredientId[] = [];
  for (const [ingredientId, quantity] of totals) {
    if (usableQuantity(inventory, ingredientId, currentBusinessDay) >= quantity) continue;
    const entry = inventory[ingredientId];
    const entryExpired =
      !!entry &&
      !isServable(perishabilityStateFor(ingredientId, entry.purchaseDay, currentBusinessDay));
    if (entryExpired) expired.push(ingredientId);
    else missing.push(ingredientId);
  }
  if (expired.length > 0) return { ok: false, reason: "expiredStock", expired };
  if (missing.length > 0) return { ok: false, reason: "insufficientStock", missing };
  return consumeIngredients(inventory, requirements);
}
