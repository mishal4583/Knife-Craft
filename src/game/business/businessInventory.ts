/**
 * BUSINESS_INVENTORY — Economy V3 Phase 2. Physical restaurant stock,
 * Business Mode only — never read by Campaign settlement, campaign
 * payout wiring, or the 250-level campaign simulation. Reuses the
 * EXISTING ingredient registry (`definitions.ts`'s `IngredientId`/
 * `INGREDIENTS`) as its only ingredient vocabulary — this module adds
 * no ingredient IDs, no ingredient definitions, no second registry.
 *
 * ONE aggregate entry per ingredient (a `Partial<Record<IngredientId,
 * InventoryEntry>>`), not a list of batches — perishability/freshness/
 * expiry (a later phase) is exactly the reason a real per-batch model
 * will eventually matter, but this phase's own brief is explicit that
 * batching is premature before any of those exist. `unitCost` on the
 * aggregate entry is a quantity-weighted average across every purchase
 * that ever fed it, so `quantity * unitCost` (see `inventoryValue`
 * below) is always an honest total value, never just "the last price
 * paid" once two purchases at different prices have merged.
 *
 * Every operation here is a pure function over a plain `BusinessInventory`
 * value — the caller (BusinessInventoryManager.ts, and eventually a
 * business order/consumption flow) is responsible for persisting the
 * result, exactly like `KnifeManager`/`StaffManager` never touch
 * SaveData themselves either. No `Math.random()` anywhere in this file.
 */
import type { IngredientId } from "../definitions";

export type InventoryEntry = {
  ingredientId: IngredientId;
  /** Always > 0 while the entry exists — a quantity that would reach 0 removes the entry entirely (see `removeStock`), so a stored entry with `quantity: 0` can never exist. Whole units when bought; may hold a fraction (3 decimals, see `normalizeQuantity`) once portions are served from it. */
  quantity: number;
  /** Integer currency units — a quantity-weighted average across every purchase merged into this entry (see this file's own header doc). */
  unitCost: number;
  /**
   * A quantity-weighted average `business.calendar.businessDay` across
   * every purchase merged into this entry (see `addStock`) — NOT simply
   * "the most recent purchase day". A single-entry aggregate has no way
   * to represent per-batch age, so Economy V3 Phase 4 (perishability)
   * needs this average to be honest: overwriting to the newest day on
   * every top-up would let a player fully "refresh" a large expiring
   * stock with a token 1-unit purchase, which weighted-averaging (like
   * `unitCost` above) makes proportionally hard to game. Not touched by
   * consumption.
   */
  purchaseDay: number;
};

/** Keyed by ingredientId — the canonical one-entry-per-ingredient representation this phase's own brief asks for ("prefer one aggregate stock entry per ingredient"). A `Partial` record, not a full one: an ingredient the restaurant has never stocked is simply absent, never a zero-value placeholder. */
export type BusinessInventory = Partial<Record<IngredientId, InventoryEntry>>;

export const DEFAULT_BUSINESS_INVENTORY: BusinessInventory = {};

/** 0 for an ingredient never stocked — never `undefined`, so every caller can compare directly against a plain number. */
export function getQuantity(inventory: BusinessInventory, ingredientId: IngredientId): number {
  return inventory[ingredientId]?.quantity ?? 0;
}

export function hasQuantity(
  inventory: BusinessInventory,
  ingredientId: IngredientId,
  quantity: number,
): boolean {
  return getQuantity(inventory, ingredientId) >= quantity;
}

export type IngredientRequirement = { ingredientId: IngredientId; quantity: number };

/** True only when EVERY requirement is independently satisfiable — never partially. */
export function hasIngredients(
  inventory: BusinessInventory,
  requirements: readonly IngredientRequirement[],
): boolean {
  return requirements.every((r) => hasQuantity(inventory, r.ingredientId, r.quantity));
}

/**
 * Adds stock, merging into any existing entry with a quantity-weighted
 * average `unitCost` (see this file's own header doc). Pure — never
 * mutates `inventory`. Callers (BusinessInventoryManager.purchaseIngredient)
 * are responsible for validating `quantity`/`unitCost` themselves before
 * calling this, exactly like KnifeManager.buyKnife validates before ever
 * touching `ownedKnifeIds` — this keeps the one real validation boundary
 * at the purchase action, not duplicated here.
 */
export function addStock(
  inventory: BusinessInventory,
  ingredientId: IngredientId,
  quantity: number,
  unitCost: number,
  businessDay: number,
): BusinessInventory {
  const existing = inventory[ingredientId];
  const newQuantity = (existing?.quantity ?? 0) + quantity;
  const newUnitCost = existing
    ? Math.round((existing.quantity * existing.unitCost + quantity * unitCost) / newQuantity)
    : unitCost;
  const newPurchaseDay = existing
    ? Math.round((existing.quantity * existing.purchaseDay + quantity * businessDay) / newQuantity)
    : businessDay;
  return {
    ...inventory,
    [ingredientId]: {
      ingredientId,
      quantity: newQuantity,
      unitCost: newUnitCost,
      purchaseDay: newPurchaseDay,
    },
  };
}

/**
 * Economy V3 Phase 16 (final audit, P1 fix) — Business stock is BOUGHT in
 * whole purchase units (BusinessInventoryManager keeps its own integer
 * gate), but a served portion may draw down a documented FRACTION of a
 * unit (businessPortionModel.ts — e.g. 0.025 lb of garlic per step), so
 * the stockroom draw-down matches the exact portion the menu price and
 * food cost are calibrated on. Quantities are held to 3 decimal places
 * (0.001 of a lb/piece) so repeated fractional draw-downs never
 * accumulate floating-point drift.
 */
export const QUANTITY_PRECISION = 1000;

export function normalizeQuantity(quantity: number): number {
  return Math.round(quantity * QUANTITY_PRECISION) / QUANTITY_PRECISION;
}

/** Player-facing quantity: whole numbers as-is, fractions to at most 3 decimals (trailing zeros trimmed). */
export function formatQuantity(quantity: number): string {
  const q = normalizeQuantity(quantity);
  return Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export type RemoveStockResult =
  | { ok: true; inventory: BusinessInventory }
  | { ok: false; reason: "insufficientStock" | "invalidQuantity" };

/**
 * Removes stock — never below 0 (brief: "the player must never be able
 * to have quantity < 0"). An entry that reaches exactly 0 is deleted
 * outright (operation #7: "clear/remove an ingredient if quantity
 * reaches zero"), never left behind as a stale zero-quantity record.
 */
export function removeStock(
  inventory: BusinessInventory,
  ingredientId: IngredientId,
  quantity: number,
): RemoveStockResult {
  const amount = normalizeQuantity(quantity);
  if (!Number.isFinite(quantity) || amount <= 0) return { ok: false, reason: "invalidQuantity" };
  const existing = inventory[ingredientId];
  const available = existing?.quantity ?? 0;
  if (available < amount) return { ok: false, reason: "insufficientStock" };
  const remaining = normalizeQuantity(available - amount);
  const next = { ...inventory };
  if (remaining <= 0) {
    delete next[ingredientId];
  } else {
    next[ingredientId] = { ...existing!, quantity: remaining };
  }
  return { ok: true, inventory: next };
}

export type ConsumeIngredientsResult =
  | { ok: true; inventory: BusinessInventory }
  | { ok: false; reason: "insufficientStock"; missing: IngredientId[] };

/**
 * Atomic multi-ingredient consumption (brief's own Tomato/Onion/Chicken
 * example) — every requirement is checked against the ORIGINAL inventory
 * (with same-ingredient requirements summed first, so a caller can never
 * be fooled into passing e.g. two separate {tomato:3} requirements and
 * having each checked independently against the same stock) before ANY
 * stock is removed. If even one requirement can't be met, the returned
 * inventory is byte-identical to the input — no partial consumption.
 */
export function consumeIngredients(
  inventory: BusinessInventory,
  requirements: readonly IngredientRequirement[],
): ConsumeIngredientsResult {
  const totals = new Map<IngredientId, number>();
  for (const r of requirements) {
    totals.set(r.ingredientId, normalizeQuantity((totals.get(r.ingredientId) ?? 0) + r.quantity));
  }
  const missing: IngredientId[] = [];
  for (const [ingredientId, quantity] of totals) {
    if (!hasQuantity(inventory, ingredientId, quantity)) missing.push(ingredientId);
  }
  if (missing.length > 0) return { ok: false, reason: "insufficientStock", missing };
  let next = inventory;
  for (const [ingredientId, quantity] of totals) {
    const result = removeStock(next, ingredientId, quantity);
    // Safe: every requirement was already proven satisfiable above, and
    // totals were pre-summed per ingredient, so this can never fail here.
    if (result.ok) next = result.inventory;
  }
  return { ok: true, inventory: next };
}

/** sum(quantity * unitCost) in whole cents — informational only, never an automatic wallet mutation (brief: "It is informational only"). Rounded once at the end, since a partly-used entry can hold a fractional quantity (see normalizeQuantity). */
export function inventoryValue(inventory: BusinessInventory): number {
  let total = 0;
  for (const entry of Object.values(inventory)) {
    if (entry) total += entry.quantity * entry.unitCost;
  }
  return Math.round(total);
}
