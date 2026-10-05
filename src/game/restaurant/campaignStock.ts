/**
 * CAMPAIGN_STOCK — campaign orders use the restaurant's real ingredients
 * (Unified Restaurant phases 3–4).
 *
 *  - `serviceStockCheck`: the Pre-Service Check's ingredient rows. For a
 *    level whose service uses stock (`ingredient-stock`, Level 15 on), what
 *    its tickets need, what is usable (fresh, never expired), what is
 *    missing, how many whole units the Market would sell to cover it, at
 *    what price (the Market's own `purchaseQuote`), and whether the wallet
 *    and the fridge allow it.
 *  - `consumeCampaignOrderStock`: takes ONE served order's stock with the
 *    same function Business orders use (`consumeUsableIngredients`:
 *    never expired stock, atomic), and returns what it cost at the paid
 *    average (`realCogsFor`) for the report. Nothing about the order's pay
 *    changes (developer decision 2026-10-04: the built-in food cost stays;
 *    double charging is Economy TODO P0).
 *  - `pantryForMissing`: the soft-lock safety net. Only when the wallet
 *    cannot cover the missing stock, the Pre-Service Check offers Grandma's
 *    pantry: exactly the missing quantities, added to the fridge at cost 0,
 *    visible and opt-in (no money, no ledger entry, never automatic).
 *    Economy TODO #17.
 *
 * Replays and orders a level no longer owes use no stock (they pay
 * nothing either). Levels 1–10 never use stock.
 *
 * Pure: every function returns new objects; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import {
  addStock,
  getQuantity,
  normalizeQuantity,
  type IngredientRequirement,
} from "../business/businessInventory";
import { consumeUsableIngredients, usableQuantity } from "../business/perishability";
import type { PurchaseQuote } from "../business/BusinessInventoryManager";
import { realCogsFor } from "../business/BusinessFinanceManager";
import { getAvailableStorageCapacity } from "../business/RefrigeratorManager";
import { discardExpiredStock } from "../business/discardExpired";
import { isSystemLive } from "./unlocks";
import { recipeRequirements, sumRequirements } from "./recipeRequirements";
import { restaurantQuote, stockUseFor } from "./restaurantEconomy";

/**
 * Economy pass ("move to real stock"): the stock an order really uses —
 * its recipe portion × `stockUseFor` (knife/board/helper savings, a dull
 * knife's extra waste). `which` = "factor" (planned) or "floor" (the most
 * a serve may fall back to).
 */
export function orderRequirements(
  save: SaveData,
  recipe: RecipeDefinition,
  which: "factor" | "floor" = "factor",
): IngredientRequirement[] {
  const k = stockUseFor(save, recipe)[which];
  return sumRequirements(
    recipeRequirements(recipe).map((r) => ({
      ingredientId: r.ingredientId,
      quantity: normalizeQuantity(r.quantity * k),
    })),
  );
}

export type StockRow = {
  ingredientId: IngredientId;
  /** What today's tickets use in all. */
  needed: number;
  /** Fresh enough to serve. */
  usable: number;
  /** In the fridge, usable or not. */
  onHand: number;
  /** On hand but expired: it can't be served and should be thrown out. */
  expired: number;
  missing: number;
  /** Whole units the Market sells to cover `missing` (purchases are whole units). */
  buyUnits: number;
  /** The Market's own answer for buying `buyUnits` now (null when nothing is missing). */
  quote: PurchaseQuote | null;
};

export type ServiceStockCheck =
  | { applies: false }
  | {
      applies: true;
      rows: StockRow[];
      missingRows: StockRow[];
      ready: boolean;
      /** What buying every missing item costs today. */
      missingCost: number;
      /** The wallet covers `missingCost`. */
      affordable: boolean;
      /** Fridge units the missing purchases need, and free now. */
      storageNeeded: number;
      storageFree: number;
      hasExpired: boolean;
    };

/** True when this level's service uses real stock. */
export function serviceUsesStock(levelNumber: number): boolean {
  return isSystemLive("ingredient-stock", levelNumber);
}

export function serviceStockCheck(
  save: SaveData,
  levelNumber: number,
  tickets: readonly RecipeDefinition[],
): ServiceStockCheck {
  if (!serviceUsesStock(levelNumber)) return { applies: false };
  const day = save.business.calendar.businessDay;
  const inventory = save.business.inventory;
  const rows: StockRow[] = sumRequirements(
    tickets.flatMap((recipe) => orderRequirements(save, recipe)),
  ).map(({ ingredientId, quantity }) => {
    const onHand = getQuantity(inventory, ingredientId);
    const usable = usableQuantity(inventory, ingredientId, day);
    const missing = normalizeQuantity(Math.max(0, quantity - usable));
    const buyUnits = missing > 0 ? Math.ceil(missing - 1e-9) : 0;
    return {
      ingredientId,
      needed: quantity,
      usable,
      onHand,
      expired: normalizeQuantity(onHand - usable),
      missing,
      buyUnits,
      quote: buyUnits > 0 ? restaurantQuote(save, ingredientId, buyUnits) : null,
    };
  });
  const missingRows = rows.filter((r) => r.missing > 0);
  const missingCost = missingRows.reduce((sum, r) => sum + (r.quote?.totalCost ?? 0), 0);
  const storageNeeded = missingRows.reduce((sum, r) => sum + r.buyUnits, 0);
  return {
    applies: true,
    rows,
    missingRows,
    ready: missingRows.length === 0,
    missingCost,
    affordable: save.credits >= missingCost,
    storageNeeded,
    storageFree: getAvailableStorageCapacity(inventory, save.business.refrigerator.refrigeratorId),
    hasExpired: rows.some((r) => r.expired > 0),
  };
}

export type ConsumeOrderStockResult =
  | { ok: true; save: SaveData; used: boolean; cost: number; requirements: IngredientRequirement[] }
  | { ok: false; reason: "missingStock"; missing: IngredientId[] };

/**
 * Takes one served order's stock. `owesOrder` is false for a replay or an
 * order the level no longer pays for: nothing is used. Atomic: on failure
 * the save is untouched.
 */
export function consumeCampaignOrderStock(
  save: SaveData,
  levelNumber: number,
  recipe: RecipeDefinition,
  owesOrder: boolean,
): ConsumeOrderStockResult {
  if (!owesOrder || !serviceUsesStock(levelNumber))
    return { ok: true, save, used: false, cost: 0, requirements: [] };
  // Planned use; where today's stock is short of it (a knife dulled during
  // the service), the serve uses what's there, never less than the floor.
  const inventory = save.business.inventory;
  const day = save.business.calendar.businessDay;
  const floor = new Map(
    orderRequirements(save, recipe, "floor").map((r) => [r.ingredientId, r.quantity]),
  );
  const requirements = orderRequirements(save, recipe).map((r) => {
    const usable = usableQuantity(inventory, r.ingredientId, day);
    const least = floor.get(r.ingredientId) ?? r.quantity;
    return usable < r.quantity && usable >= least
      ? { ingredientId: r.ingredientId, quantity: usable }
      : r;
  });
  const cost = realCogsFor(inventory, requirements);
  const consumed = consumeUsableIngredients(inventory, requirements, day);
  if (!consumed.ok) {
    const missing = requirements
      .filter((r) => usableQuantity(inventory, r.ingredientId, day) < r.quantity)
      .map((r) => r.ingredientId);
    return { ok: false, reason: "missingStock", missing };
  }
  return {
    ok: true,
    save: { ...save, business: { ...save.business, inventory: consumed.inventory } },
    used: true,
    cost,
    requirements,
  };
}

/**
 * Grandma's pantry: only when the check is not ready AND the wallet can't
 * cover the missing stock, adds exactly the missing quantities at cost 0.
 * Null when it doesn't apply. It never moves money.
 */
export function pantryForMissing(save: SaveData, check: ServiceStockCheck): SaveData | null {
  if (!check.applies || check.ready || check.affordable) return null;
  // Freshness is one weighted average per ingredient, so fresh stock added
  // on top of expired stock would make the expired part look usable again.
  // Expired stock goes first, recorded as waste (Throw Out Expired).
  const base = check.hasExpired ? withoutExpired(save) : save;
  const day = base.business.calendar.businessDay;
  let inventory = base.business.inventory;
  for (const row of check.missingRows) {
    inventory = addStock(inventory, row.ingredientId, row.missing, 0, day);
  }
  return { ...base, business: { ...base.business, inventory } };
}

function withoutExpired(save: SaveData): SaveData {
  const discarded = discardExpiredStock(save);
  return discarded.ok ? discarded.save : save;
}
