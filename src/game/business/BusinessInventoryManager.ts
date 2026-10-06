/**
 * BUSINESS_INVENTORY_MANAGER — Economy V3 Phase 2. The one purchase
 * action for Business Mode inventory, mirroring KnifeManager.buyKnife/
 * StaffManager.buyStaff exactly: a pure function taking a `SaveData`
 * snapshot and returning either a new save or a typed failure reason.
 * The caller (App.tsx) persists the result and — exactly like every
 * other purchase wrapper already does — records the ledger entry
 * itself, using the real credits delta this function reports. This
 * function never touches `SaveData.economyLedger` directly, the same
 * way buyKnife/buyStaff never do either.
 */
import { discountedUnitCost } from "../restaurant/bulkBuying";
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import { businessUnitCostFor } from "./businessPricing";
import { addStock, normalizeQuantity } from "./businessInventory";
import { canStoreQuantity, getAvailableStorageCapacity } from "./RefrigeratorManager";
import { effectiveUnitCost } from "./businessSupplierContract";
import {
  eventForDay,
  eventAdjustedUnitCost,
  maxPurchaseQuantityFor,
} from "./businessSupplierEvents";
import { staffUnitCostDiscount } from "./businessStaff";
import { applyStockingWear } from "./businessEquipmentCondition";
import { usableQuantity } from "./perishability";
import { businessDishRequirements } from "./businessServiceCatalog";
import { businessOrderAvailability } from "./BusinessServiceManager";
import type { BusinessDish } from "./businessDishCatalog";
import {
  rushUnitCost,
  type RushRestockLine,
  type RushRestockPayment,
  type RushRestockPlan,
  type RushRestockResult,
} from "./businessRushRestock";

export type PurchaseIngredientResult =
  | { ok: true; save: SaveData; quantity: number; unitCost: number; totalCost: number }
  | {
      ok: false;
      reason:
        | "unknownIngredient"
        | "invalidQuantity"
        | "insufficientFunds"
        | "insufficientStorage"
        | "exceedsShortageLimit";
    };

function isKnownIngredient(id: string): id is IngredientId {
  return Object.prototype.hasOwnProperty.call(INGREDIENTS, id);
}

/**
 * What one unit of `ingredientId` costs today when `quantity` units are
 * bought at once — the pricing layers described on `purchaseIngredient`
 * below (category base -> today's supplier event -> the active contract's
 * discount -> a hired Prep Cook's discount). `null` when today's shortage
 * event caps a single purchase below `quantity`. The one place this price
 * is computed; rushRestockPlan below prices its rush fee on top of it.
 */
export function todaysUnitCost(
  save: SaveData,
  ingredientId: IngredientId,
  quantity: number,
): number | null {
  const event = eventForDay(save.business.calendar.businessDay);
  const maxQuantity = maxPurchaseQuantityFor(event);
  if (maxQuantity !== undefined && quantity > maxQuantity) return null;
  const eventCost = eventAdjustedUnitCost(businessUnitCostFor(ingredientId), event);
  const contractCost = event?.suspendsContractDiscount
    ? eventCost
    : effectiveUnitCost(
        eventCost,
        save.business.supplierContract,
        save.business.calendar.businessDay,
        quantity,
      );
  return staffUnitCostDiscount(contractCost, save.business.staff.hiredRoles);
}

export type PurchaseQuote = {
  /** Today's unit price at this quantity (todaysUnitCost); for a quantity over today's shortage cap, the price the cap itself would pay — shown, never charged. */
  unitCost: number;
  totalCost: number;
  /** What `purchaseIngredient` would answer right now — the SAME checks, in the same order (shortage cap -> wallet -> fridge space). */
  verdict: "ok" | "exceedsShortageLimit" | "insufficientFunds" | "insufficientStorage";
  /** Today's single-purchase cap (Temporary Shortage), or undefined. */
  maxQuantity: number | undefined;
  /** `save.credits - totalCost` — negative when the wallet is short. */
  remainingCredits: number;
  /** Fridge units free right now (RefrigeratorManager). */
  availableStorage: number;
  /** Unified Restaurant bulk discount applied (a fraction; 0 in the classic game). */
  bulkDiscount: number;
  /** The same quantity before the bulk discount (equals totalCost without one). */
  listTotal: number;
};

/**
 * The Market's purchase preview for `quantity` of `ingredientId` — the ONE
 * decision `purchaseIngredient` below also makes, so what a card promises
 * before the tap is exactly what the tap does. Read-only.
 */
export function purchaseQuote(
  save: SaveData,
  ingredientId: IngredientId,
  quantity: number,
  /** Unified Restaurant bulk discount (restaurant/bulkBuying.ts) — the LAST layer; 0 = none. */
  bulkDiscount = 0,
  /** Unified Restaurant: the Campaign Supplier's price factor (restaurant/restaurantEconomy.ts); 1 = none. */
  supplierFactor = 1,
): PurchaseQuote {
  const maxQuantity = maxPurchaseQuantityFor(eventForDay(save.business.calendar.businessDay));
  const capped = todaysUnitCost(save, ingredientId, quantity);
  const marketUnitCost =
    capped ?? todaysUnitCost(save, ingredientId, Math.min(quantity, maxQuantity ?? quantity)) ?? 0;
  const listUnitCost =
    supplierFactor === 1
      ? marketUnitCost
      : Math.max(0, Math.round(marketUnitCost * supplierFactor));
  const unitCost = bulkDiscount > 0 ? discountedUnitCost(listUnitCost, bulkDiscount) : listUnitCost;
  const totalCost = quantity * unitCost;
  const refrigeratorId = save.business.refrigerator.refrigeratorId;
  const verdict: PurchaseQuote["verdict"] =
    capped === null
      ? "exceedsShortageLimit"
      : save.credits < totalCost
        ? "insufficientFunds"
        : !canStoreQuantity(save.business.inventory, refrigeratorId, quantity)
          ? "insufficientStorage"
          : "ok";
  return {
    unitCost,
    totalCost,
    verdict,
    maxQuantity,
    remainingCredits: save.credits - totalCost,
    availableStorage: getAvailableStorageCapacity(save.business.inventory, refrigeratorId),
    bulkDiscount,
    listTotal: quantity * listUnitCost,
  };
}

/**
 * Atomic (brief: "Atomically deduct wallet credits... Add inventory"):
 * either credits drop by exactly `quantity * businessUnitCostFor(id)`
 * AND inventory gains exactly `quantity`, or NOTHING changes at all.
 * Never creates debt — the insufficient-funds path returns the save
 * completely untouched, exactly like sharpenKnife's own doc.
 *
 * Economy V3 Phase 3 — asks RefrigeratorManager "can this quantity fit?"
 * before completing the purchase (brief: "The inventory manager should
 * ask the refrigerator/storage system"). This is the ONLY place that
 * question is asked — never a second, duplicate storage-capacity check
 * anywhere else in the purchase path.
 *
 * Economy V3 Phase 7 — asks businessSupplierContract.effectiveUnitCost
 * for the real, wired discount an active contract grants once this
 * purchase meets its minimum order size. Never re-derives that math
 * inline — a save with no contract (`supplierContract: null`) resolves
 * to the exact same `businessUnitCostFor` this function always used.
 *
 * Economy V3 Phase 8 — asks businessSupplierEvents.eventForDay whether
 * today has a deterministic event active. Order of operations: category
 * base price -> today's event price modifier -> the active contract's
 * discount (skipped entirely on a "Supplier Delay" day — the ONE place
 * that suspension is applied) -> a hired Prep Cook's own discount. A
 * quiet day with no contract and no Prep Cook resolves to the exact
 * same pricing V3-2 always used.
 *
 * Economy V3 Phase 9 — asks businessStaff.staffUnitCostDiscount for a
 * hired Prep Cook's discount, applied as the FINAL layer after the
 * event/contract pricing above. Never re-derives that math inline.
 *
 * Economy V3 Phase 10 — a successful purchase wears the refrigerator by
 * businessEquipmentCondition.applyStockingWear (Phase 16: per unit
 * stocked, split-invariant) — real usage, not a timer. Never applied on a
 * rejected purchase (no inventory changed, no condition changed either).
 */
export function purchaseIngredient(
  save: SaveData,
  ingredientId: string,
  quantity: number,
  /** Unified Restaurant bulk discount (the same one the quote showed); 0 = none. */
  bulkDiscount = 0,
  /** Unified Restaurant supplier price factor (the same one the quote showed); 1 = none. */
  supplierFactor = 1,
  /** Unified Restaurant: days this stock starts ageing later (a Premium supplier's longer freshness); 0 = none. */
  freshnessBonusDays = 0,
): PurchaseIngredientResult {
  if (!isKnownIngredient(ingredientId)) return { ok: false, reason: "unknownIngredient" };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "invalidQuantity" };
  if (!(bulkDiscount >= 0 && bulkDiscount < 1)) return { ok: false, reason: "invalidQuantity" };
  if (!(supplierFactor > 0 && supplierFactor < 2)) return { ok: false, reason: "invalidQuantity" };
  if (!(Number.isInteger(freshnessBonusDays) && freshnessBonusDays >= 0 && freshnessBonusDays <= 7))
    return { ok: false, reason: "invalidQuantity" };
  const quote = purchaseQuote(save, ingredientId, quantity, bulkDiscount, supplierFactor);
  if (quote.verdict !== "ok") return { ok: false, reason: quote.verdict };
  const { unitCost, totalCost } = quote;
  const inventory = addStock(
    save.business.inventory,
    ingredientId,
    quantity,
    unitCost,
    save.business.calendar.businessDay + freshnessBonusDays,
  );
  const equipmentCondition = applyStockingWear(save.business.equipmentCondition, quantity);
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - totalCost,
      business: {
        ...save.business,
        inventory,
        equipmentCondition,
      },
    },
    quantity,
    unitCost,
    totalCost,
  };
}

/**
 * What restocking `dish` right now would buy, or a failure reason when it
 * can't be priced (the dish isn't blocked, or today's shortage caps a
 * purchase below the shortfall). Read-only — the UI shows its prices.
 */
export function rushRestockPlan(
  save: SaveData,
  dish: BusinessDish,
):
  | { ok: true; plan: RushRestockPlan }
  | { ok: false; reason: "notBlocked" | "exceedsShortageLimit" } {
  const availability = businessOrderAvailability(save, dish);
  if (availability.available) return { ok: false, reason: "notBlocked" };
  const day = save.business.calendar.businessDay;
  const needed = new Map<IngredientId, number>();
  for (const r of businessDishRequirements(dish)) {
    needed.set(r.ingredientId, normalizeQuantity((needed.get(r.ingredientId) ?? 0) + r.quantity));
  }
  const lines: RushRestockLine[] = [];
  for (const ingredientId of availability.missing) {
    const shortfall = normalizeQuantity(
      (needed.get(ingredientId) ?? 0) - usableQuantity(save.business.inventory, ingredientId, day),
    );
    const quantity = Math.max(1, Math.ceil(shortfall));
    const marketUnitCost = todaysUnitCost(save, ingredientId, quantity);
    if (marketUnitCost === null) return { ok: false, reason: "exceedsShortageLimit" };
    const unit = rushUnitCost(marketUnitCost);
    lines.push({
      ingredientId,
      quantity,
      marketUnitCost,
      rushUnitCost: unit,
      rushTotal: quantity * unit,
    });
  }
  return {
    ok: true,
    plan: {
      lines,
      totalQuantity: lines.reduce((s, l) => s + l.quantity, 0),
      cashCost: lines.reduce((s, l) => s + l.rushTotal, 0),
      marketCost: lines.reduce((s, l) => s + l.quantity * l.marketUnitCost, 0),
    },
  };
}

/**
 * RUSH RESTOCK (businessRushRestock.ts) — stocks exactly what `dish` is
 * missing, without a trip to the Market. Same rules as purchaseIngredient
 * above: today's Market price (`todaysUnitCost`, + RUSH_RESTOCK_FEE for
 * cash), fridge capacity, today's shortage limit, fridge wear per unit.
 * Stock is bought in whole units (a fractional shortfall rounds up). An ad
 * restock is free and stocked at a unit cost of 0 — the player paid
 * nothing, which is what its food cost later reports. The caller (App.tsx)
 * records the cash restock's ledger entries, one "inventory-purchase" per
 * ingredient, exactly like a Market purchase; the ad restock moves no
 * money and has none.
 *
 * Stocks exactly what `dish` is missing — paid in cash with the rush fee,
 * or free after a rewarded ad. All-or-nothing: on any failure the save is
 * returned untouched (no credits, no stock, no fridge wear).
 */
export function rushRestock(
  save: SaveData,
  dish: BusinessDish,
  payment: RushRestockPayment,
): RushRestockResult {
  const planned = rushRestockPlan(save, dish);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const totalCost = payment === "cash" ? plan.cashCost : 0;
  if (save.credits < totalCost) return { ok: false, reason: "insufficientFunds" };
  if (
    !canStoreQuantity(
      save.business.inventory,
      save.business.refrigerator.refrigeratorId,
      plan.totalQuantity,
    )
  ) {
    return { ok: false, reason: "insufficientStorage" };
  }
  const day = save.business.calendar.businessDay;
  let inventory = save.business.inventory;
  for (const line of plan.lines) {
    inventory = addStock(
      inventory,
      line.ingredientId,
      line.quantity,
      payment === "cash" ? line.rushUnitCost : 0,
      day,
    );
  }
  const next: SaveData = {
    ...save,
    credits: save.credits - totalCost,
    business: {
      ...save.business,
      inventory,
      equipmentCondition: applyStockingWear(save.business.equipmentCondition, plan.totalQuantity),
    },
  };
  // Buying the shortfall can still leave an order blocked when old stock of
  // the same ingredient has expired (the merged entry stays expired). Never
  // charge for a restock that doesn't unblock the order.
  if (!businessOrderAvailability(next, dish).available) {
    return { ok: false, reason: "wouldNotUnblock" };
  }
  return { ok: true, save: next, payment, lines: plan.lines, totalCost };
}
