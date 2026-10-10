/**
 * COVERING A SHORT SERVICE (developer 2026-10-10: "don't use Grandma lending
 * anywhere any more — use watch ad; don't miss any monetization
 * opportunity"; with no ad, "a small cash loan"). Replaces Grandma's pantry
 * (from Level 10) and her spares. When the Pre-Service Check is short of
 * ingredients or supplies and the wallet can't pay for them:
 *
 *  - 🎬 WATCH AN AD (`coverWithAd`): only after Bridge reports `rewarded`
 *    (App.coverServiceWithAd), exactly what's missing arrives free — goods
 *    at cost 0, no money, no ledger entry (the Rush Restock ad rule). No
 *    penalty: the service earns its full pay.
 *  - 💳 SUPPLIER CREDIT (`coverWithCredit`): when no ad can be shown or the
 *    ad didn't finish, the supplier delivers on account — the same goods a
 *    Market purchase would bring (whole Market units / packs at Market
 *    prices), paid later from the next earnings (supplierCredit.ts).
 *
 * Before Level 10 nothing can be bought yet, so Grandma's pantry stays
 * there (campaignStock.pantryForMissing) — the tutorial levels. Pure;
 * nothing here reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { addStock, normalizeQuantity } from "../business/businessInventory";
import { discardExpiredStock } from "../business/discardExpired";
import { measureOf, stockForMarketUnits } from "../business/measure";
import { getSupplyItem, supplyPackPrice } from "../business/businessSupplies";
import { purchaseSupply } from "../business/BusinessSuppliesManager";
import type { ServiceStockCheck } from "./campaignStock";
import type { ServiceSuppliesCheck } from "./serviceSupplies";
import { FIRST_PURCHASE_LEVEL } from "./firstLevels";
import { takeOnCredit } from "./supplierCredit";

/** What a cover brings: the service's missing ingredients, or its missing supplies. */
export type CoverPart = "stock" | "supplies";

export type CoverOffer = {
  part: CoverPart;
  /** What the same goods cost in the Market today (what supplier credit would owe). */
  creditCost: number;
  /** "2 items", for the buttons. */
  items: number;
};

type Short = {
  levelNumber: number;
  check: ServiceStockCheck;
  supplies: ServiceSuppliesCheck;
};

/**
 * The cover on offer for `part`, or null: only from Level 10, only when that
 * part is short AND the wallet can't pay for it (otherwise the player buys
 * it — "ask the user to purchase it").
 */
export function coverFor(plan: Short, part: CoverPart): CoverOffer | null {
  if (plan.levelNumber < FIRST_PURCHASE_LEVEL) return null;
  if (part === "stock") {
    const c = plan.check;
    if (!c.applies || c.ready || c.affordable) return null;
    return { part, creditCost: c.missingCost, items: c.missingRows.length };
  }
  const s = plan.supplies;
  if (!s.applies || s.ready || s.affordable) return null;
  const rows = s.rows.filter((r) => r.blocking && r.missing > 0);
  return { part, creditCost: s.missingCost, items: rows.length };
}

function withoutExpired(save: SaveData): SaveData {
  const discarded = discardExpiredStock(save);
  return discarded.ok ? discarded.save : save;
}

/**
 * The ad's reward: exactly what's missing, at cost 0 (no money, no ledger).
 * Null when nothing is on offer for `part`.
 */
export function coverWithAd(save: SaveData, plan: Short, part: CoverPart): SaveData | null {
  if (!coverFor(plan, part)) return null;
  if (part === "stock") {
    const check = plan.check;
    if (!check.applies) return null;
    // Freshness is one weighted average per ingredient: expired stock goes
    // first (recorded as waste) so the new stock doesn't make it look usable.
    const base = check.hasExpired ? withoutExpired(save) : save;
    const day = base.business.calendar.businessDay;
    let inventory = base.business.inventory;
    for (const row of check.missingRows)
      inventory = addStock(inventory, row.ingredientId, row.missing, 0, day);
    return { ...base, business: { ...base.business, inventory } };
  }
  const stock = { ...save.business.supplies.stock };
  for (const r of plan.supplies.applies ? plan.supplies.rows : []) {
    if (!r.blocking || r.missing === 0) continue;
    const prev = stock[r.id] ?? { units: 0, costBasis: 0 };
    stock[r.id] = { units: prev.units + r.missing, costBasis: prev.costBasis };
  }
  return {
    ...save,
    business: { ...save.business, supplies: { ...save.business.supplies, stock } },
  };
}

/**
 * Supplier credit: the goods a Market purchase would bring (whole Market
 * units / packs, at today's Market price), delivered now; `owed` grows by
 * their price. The wallet doesn't move, so no ledger entry until it's
 * repaid. Null when nothing is on offer for `part`.
 */
export function coverWithCredit(save: SaveData, plan: Short, part: CoverPart): SaveData | null {
  const offer = coverFor(plan, part);
  if (!offer) return null;
  if (part === "stock") {
    const check = plan.check;
    if (!check.applies) return null;
    const base = check.hasExpired ? withoutExpired(save) : save;
    const day = base.business.calendar.businessDay;
    const measure = measureOf(base);
    let inventory = base.business.inventory;
    for (const row of check.missingRows) {
      const quantity = normalizeQuantity(
        stockForMarketUnits(row.ingredientId, row.buyUnits, measure),
      );
      const cost = row.quote?.totalCost ?? 0;
      inventory = addStock(
        inventory,
        row.ingredientId,
        quantity,
        quantity > 0 ? Math.round(cost / quantity) : 0,
        day,
      );
    }
    return takeOnCredit({ ...base, business: { ...base.business, inventory } }, offer.creditCost);
  }
  // Supplies: the same packs the Market would sell, recorded exactly like a
  // purchase (stock, cost basis, lifetime totals) — the wallet lent the price
  // for that moment only, so it ends where it started.
  let next = save;
  let owed = 0;
  for (const r of plan.supplies.applies ? plan.supplies.rows : []) {
    if (!r.blocking || r.missing === 0) continue;
    const item = getSupplyItem(r.id);
    if (!item) continue;
    const price = supplyPackPrice(item) * r.packs;
    const bought = purchaseSupply({ ...next, credits: next.credits + price }, r.id, r.packs);
    if (!bought.ok) continue;
    next = { ...bought.save, credits: next.credits };
    owed += bought.totalCost;
  }
  return takeOnCredit(next, owed);
}

/** A fresh id for one cover ad (never sent as a placement — placements are fixed per spot). */
export function newServiceCoverRewardId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `knifecraft-service-cover-${uuid}`;
}
