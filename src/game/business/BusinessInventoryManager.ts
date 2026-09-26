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
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import { businessUnitCostFor } from "./businessPricing";
import { addStock } from "./businessInventory";
import { canStoreQuantity } from "./RefrigeratorManager";
import { effectiveUnitCost } from "./businessSupplierContract";
import {
  eventForDay,
  eventAdjustedUnitCost,
  maxPurchaseQuantityFor,
} from "./businessSupplierEvents";
import { staffUnitCostDiscount } from "./businessStaff";
import { applyStockingWear } from "./businessEquipmentCondition";

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
): PurchaseIngredientResult {
  if (!isKnownIngredient(ingredientId)) return { ok: false, reason: "unknownIngredient" };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "invalidQuantity" };
  const event = eventForDay(save.business.calendar.businessDay);
  const maxQuantity = maxPurchaseQuantityFor(event);
  if (maxQuantity !== undefined && quantity > maxQuantity) {
    return { ok: false, reason: "exceedsShortageLimit" };
  }
  const eventCost = eventAdjustedUnitCost(businessUnitCostFor(ingredientId), event);
  const contractCost = event?.suspendsContractDiscount
    ? eventCost
    : effectiveUnitCost(
        eventCost,
        save.business.supplierContract,
        save.business.calendar.businessDay,
        quantity,
      );
  const unitCost = staffUnitCostDiscount(contractCost, save.business.staff.hiredRoles);
  const totalCost = quantity * unitCost;
  if (save.credits < totalCost) return { ok: false, reason: "insufficientFunds" };
  if (
    !canStoreQuantity(save.business.inventory, save.business.refrigerator.refrigeratorId, quantity)
  ) {
    return { ok: false, reason: "insufficientStorage" };
  }
  const inventory = addStock(
    save.business.inventory,
    ingredientId,
    quantity,
    unitCost,
    save.business.calendar.businessDay,
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
