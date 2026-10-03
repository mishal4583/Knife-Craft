/**
 * BUSINESS_SUPPLIES_MANAGER — pure, deterministic functions over
 * `SaveData.business.supplies` (businessSupplies.ts): the Market purchase,
 * the per-order packaging use, and the read-only figures Business shows.
 *
 * A purchase is all-or-nothing. Every check (known item, a whole pack count
 * from 1 to MAX_SUPPLY_PACKS, enough money) happens before anything changes;
 * a failure returns the save untouched, with no wallet, stock, finance or
 * ledger change. The caller (App.tsx purchaseSupply) adds the ONE ledger
 * entry and the P&L record, then persists once. Supplies have no storage
 * limit: they are not food and never use the refrigerator.
 */
import type { SaveData } from "../SaveManager";
import { debitWallet } from "../economy/wallet";
import {
  SUPPLY_CATALOG,
  getSupplyItem,
  isConsumableSupply,
  supplyPackPrice,
  type BusinessSuppliesState,
  type SupplyId,
  type SupplyItem,
  type SupplySection,
  type SupplyStock,
} from "./businessSupplies";

/** The most packs one purchase can buy (the stepper's limit). */
export const MAX_SUPPLY_PACKS = 99;

export type SupplyQuote = {
  item: SupplyItem;
  packs: number;
  units: number;
  packPrice: number;
  totalCost: number;
  /** The same packs at retail (businessSupplies.ts) — display only. */
  retailCost: number;
  remainingCredits: number;
  verdict: "ok" | "insufficientFunds";
};

export function supplyQuote(save: SaveData, item: SupplyItem, packs: number): SupplyQuote {
  const packPrice = supplyPackPrice(item);
  const totalCost = packPrice * packs;
  return {
    item,
    packs,
    units: item.packSize * packs,
    packPrice,
    totalCost,
    retailCost: item.retailPackCents * packs,
    remainingCredits: save.credits - totalCost,
    verdict: save.credits >= totalCost ? "ok" : "insufficientFunds",
  };
}

export type PurchaseSupplyResult =
  | {
      ok: true;
      save: SaveData;
      item: SupplyItem;
      packs: number;
      units: number;
      totalCost: number;
      retailCost: number;
    }
  | { ok: false; reason: "unknownSupply" | "invalidQuantity" | "insufficientFunds" };

export function purchaseSupply(
  save: SaveData,
  supplyId: string,
  packs: number,
): PurchaseSupplyResult {
  const item = getSupplyItem(supplyId);
  if (!item) return { ok: false, reason: "unknownSupply" };
  if (!Number.isInteger(packs) || packs < 1 || packs > MAX_SUPPLY_PACKS)
    return { ok: false, reason: "invalidQuantity" };
  const quote = supplyQuote(save, item, packs);
  const debit = debitWallet(save, quote.totalCost);
  if (!debit.ok) return { ok: false, reason: "insufficientFunds" };
  const supplies = save.business.supplies;
  const prev: SupplyStock = supplies.stock[item.id] ?? { units: 0, costBasis: 0 };
  const totals = supplies.lifetime[item.section];
  return {
    ok: true,
    save: {
      ...debit.save,
      business: {
        ...save.business,
        supplies: {
          stock: {
            ...supplies.stock,
            [item.id]: {
              units: prev.units + quote.units,
              costBasis: prev.costBasis + quote.totalCost,
            },
          },
          lifetime: {
            ...supplies.lifetime,
            [item.section]: {
              ...totals,
              spent: totals.spent + quote.totalCost,
              retailValue: totals.retailValue + quote.retailCost,
              purchases: totals.purchases + 1,
            },
          },
        },
      },
    },
    item,
    packs,
    units: quote.units,
    totalCost: quote.totalCost,
    retailCost: quote.retailCost,
  };
}

/** Packaging a served order uses, in this order of preference: one container, one carry bag. */
export const ORDER_CONTAINER_PRIORITY: readonly SupplyId[] = [
  "microwave-containers",
  "kraft-boxes",
  "foil-containers",
  "thali-containers",
  "burger-boxes",
];
export const ORDER_BAG_PRIORITY: readonly SupplyId[] = ["paper-bags", "carry-bags"];

export type PackagingUse = {
  supplies: BusinessSuppliesState;
  used: Array<{ id: SupplyId; cost: number }>;
  /** The cost basis of what was used — this order's packaging COGS (whole cents). */
  cost: number;
};

/** Removes one unit of `id`, taking its share of the cost basis (rounded; the last unit takes what's left). */
function takeOne(
  stock: BusinessSuppliesState["stock"],
  id: SupplyId,
): { stock: BusinessSuppliesState["stock"]; cost: number } | null {
  const entry = stock[id];
  if (!entry || entry.units < 1) return null;
  const cost = entry.units === 1 ? entry.costBasis : Math.round(entry.costBasis / entry.units);
  const units = entry.units - 1;
  const next = { ...stock };
  if (units === 0) delete next[id];
  else next[id] = { units, costBasis: Math.max(0, entry.costBasis - cost) };
  return { stock: next, cost };
}

/**
 * A served Business order uses one container and one carry bag, the first
 * of each priority list that's in stock. With none in stock it uses none,
 * and nothing else changes: packaging never blocks or delays a serve.
 */
export function takePackagingForOrder(supplies: BusinessSuppliesState): PackagingUse {
  let stock = supplies.stock;
  const used: PackagingUse["used"] = [];
  for (const list of [ORDER_CONTAINER_PRIORITY, ORDER_BAG_PRIORITY]) {
    for (const id of list) {
      const took = takeOne(stock, id);
      if (took) {
        stock = took.stock;
        used.push({ id, cost: took.cost });
        break;
      }
    }
  }
  if (used.length === 0) return { supplies, used, cost: 0 };
  const cost = used.reduce((sum, u) => sum + u.cost, 0);
  const totals = supplies.lifetime.packaging;
  return {
    supplies: {
      stock,
      lifetime: {
        ...supplies.lifetime,
        packaging: {
          ...totals,
          unitsUsed: totals.unitsUsed + used.length,
          usedCost: totals.usedCost + cost,
        },
      },
    },
    used,
    cost,
  };
}

export function supplyUnits(supplies: BusinessSuppliesState, id: SupplyId): number {
  return supplies.stock[id]?.units ?? 0;
}

/**
 * A packaging line is low when it can't cover today's customers (one unit
 * each). Durable equipment is never "low": it isn't used up.
 */
export function isLowSupply(
  supplies: BusinessSuppliesState,
  item: SupplyItem,
  customersToday: number,
): boolean {
  return isConsumableSupply(item) && supplyUnits(supplies, item.id) < Math.max(1, customersToday);
}

export type SupplySectionSummary = {
  lines: number;
  linesStocked: number;
  unitsOnHand: number;
  /** What was actually paid for the units on hand (cost basis), whole cents. */
  stockValue: number;
  spent: number;
  purchases: number;
  /** Retail value of everything bought minus what was paid — display only, never money. */
  savedVsRetail: number;
  unitsUsed: number;
  usedCost: number;
};

export function supplySectionSummary(
  supplies: BusinessSuppliesState,
  section: SupplySection,
): SupplySectionSummary {
  const items = SUPPLY_CATALOG.filter((item) => item.section === section);
  const totals = supplies.lifetime[section];
  let unitsOnHand = 0;
  let stockValue = 0;
  let linesStocked = 0;
  for (const item of items) {
    const entry = supplies.stock[item.id];
    if (!entry) continue;
    linesStocked++;
    unitsOnHand += entry.units;
    stockValue += entry.costBasis;
  }
  return {
    lines: items.length,
    linesStocked,
    unitsOnHand,
    stockValue,
    spent: totals.spent,
    purchases: totals.purchases,
    savedVsRetail: Math.max(0, totals.retailValue - totals.spent),
    unitsUsed: totals.unitsUsed,
    usedCost: totals.usedCost,
  };
}

/**
 * How many takeaway orders the packaging on hand still covers: each served
 * order uses one container and one bag (takePackagingForOrder), so it is the
 * smaller of the two totals across their priority lists.
 */
export function packagingOrdersCovered(supplies: BusinessSuppliesState): {
  containers: number;
  bags: number;
  orders: number;
} {
  const containers = ORDER_CONTAINER_PRIORITY.reduce((n, id) => n + supplyUnits(supplies, id), 0);
  const bags = ORDER_BAG_PRIORITY.reduce((n, id) => n + supplyUnits(supplies, id), 0);
  return { containers, bags, orders: Math.min(containers, bags) };
}
