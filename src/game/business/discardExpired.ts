/**
 * DISCARD_EXPIRED — the Inventory screen's "Throw Out Expired" action.
 *
 * Expired stock is unusable (perishability.ts) but stays in the fridge,
 * taking space, until End Business Day sweeps it. This lets the player
 * clear it now. It is the SAME sweep, run early:
 *
 *   - only EXPIRED entries go (SpoilageManager.clearExpiredStock at
 *     today's Business Day) — nothing still usable is ever touched;
 *   - the waste value uses End Business Day's own multipliers (a Cleaner
 *     lowers it, a worn fridge raises it), so throwing out early is never
 *     cheaper or dearer than waiting;
 *   - it is waste, not a payment: no credits move and no ledger entry is
 *     written (spoilage never is);
 *   - it counts at once in the lifetime spoilage totals, and in today's
 *     `discardedQuantity` / `discardedValue`, which End Business Day adds
 *     to its own sweep — so the day's inspection (kitchen cleanliness) and
 *     the day's P&L waste line see exactly what they would have if the
 *     stock had waited for the night.
 *
 * Pure: returns a new save, or a reason and the save untouched.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { normalizeQuantity } from "./businessInventory";
import { clearExpiredStock } from "./SpoilageManager";
import { staffSpoilageValueMultiplier } from "./businessStaff";
import { refrigeratorSpoilagePenaltyMultiplier } from "./businessEquipmentCondition";

export type DiscardExpiredResult =
  | {
      ok: true;
      save: SaveData;
      quantity: number;
      /** Waste value recorded, whole cents (same multipliers as End Business Day). */
      value: number;
      ingredientIds: IngredientId[];
    }
  | { ok: false; reason: "nothingExpired" };

/** The waste value End Business Day would record for `rawValue` of spoiled stock today. */
export function wasteValueFor(save: SaveData, rawValue: number): number {
  return Math.round(
    rawValue *
      staffSpoilageValueMultiplier(save.business.staff.hiredRoles) *
      refrigeratorSpoilagePenaltyMultiplier(save.business.equipmentCondition.refrigeratorCondition),
  );
}

function withoutIds(
  inventory: SaveData["business"]["inventory"],
  ids: readonly IngredientId[],
): SaveData["business"]["inventory"] {
  const next = { ...inventory };
  for (const id of ids) delete next[id];
  return next;
}

/**
 * Freshness is ONE weighted average per ingredient (businessInventory.ts), so new stock bought on top of an expired lot of the same food
 * is averaged with it and can come out expired too (developer 2026-11-17: "Buy all" left two ingredients still needed, buying more
 * one by one finally cleared it). Every purchase therefore clears the expired stock of the ingredients it adds first: the same sweep as
 * "Throw Out Expired", recorded as waste, no money, no ledger. The save is returned unchanged when none of them is expired.
 */
export function withoutExpiredOf(save: SaveData, ids: readonly IngredientId[]): SaveData {
  const cleared = discardExpiredStock(save, ids);
  return cleared.ok ? cleared.save : save;
}

/** What "Throw Out Expired" would remove right now (for the button's label). */
export function expiredStockPreview(save: SaveData): {
  quantity: number;
  value: number;
  count: number;
} {
  const swept = clearExpiredStock(save.business.inventory, save.business.calendar.businessDay);
  return {
    quantity: swept.spoiledQuantity,
    value: wasteValueFor(save, swept.spoiledValue),
    count: swept.spoiledIngredientIds.length,
  };
}

export function discardExpiredStock(
  save: SaveData,
  /** Only these ingredients (a purchase clears the expired stock of what it is about to add); left out = the whole fridge. */
  only?: readonly IngredientId[],
): DiscardExpiredResult {
  const business = save.business;
  const scope = only
    ? Object.fromEntries(
        Object.entries(business.inventory).filter(([id]) => only.includes(id as IngredientId)),
      )
    : business.inventory;
  let swept = clearExpiredStock(scope, business.calendar.businessDay);
  if (only)
    swept = { ...swept, inventory: withoutIds(business.inventory, swept.spoiledIngredientIds) };
  if (swept.spoiledIngredientIds.length === 0) return { ok: false, reason: "nothingExpired" };
  const value = wasteValueFor(save, swept.spoiledValue);
  const acc = business.finance.dailyAccumulator;
  return {
    ok: true,
    quantity: swept.spoiledQuantity,
    value,
    ingredientIds: swept.spoiledIngredientIds,
    save: {
      ...save,
      business: {
        ...business,
        inventory: swept.inventory,
        spoilage: {
          totalSpoiledQuantity: normalizeQuantity(
            business.spoilage.totalSpoiledQuantity + swept.spoiledQuantity,
          ),
          totalSpoiledValue: business.spoilage.totalSpoiledValue + value,
        },
        finance: {
          ...business.finance,
          dailyAccumulator: {
            ...acc,
            discardedQuantity: normalizeQuantity(acc.discardedQuantity + swept.spoiledQuantity),
            discardedValue: acc.discardedValue + value,
          },
        },
      },
    },
  };
}
