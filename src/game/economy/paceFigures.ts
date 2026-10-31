/**
 * THE DAY'S FIGURES (idle phase 5A, developer 2026-10-31): what a closed restaurant day earned and
 * cost, read from the wallet's own ledger entries written during that day. Split from pace.ts so
 * `restaurantDay.closeDay` can save them without importing the screens' numbers (no import cycle).
 */
import type { EconomyLedgerEntry, LedgerCategory } from "./ledgerTypes";

/** What the restaurant EARNS by serving: order pay, level pay, tips, sales. (Not ads, gifts, milestones or the Second Floor.) */
export const PACE_INCOME: readonly LedgerCategory[] = [
  "campaign-settlement",
  "completion-reward",
  "customer-tip",
  "service-revenue",
  "business-revenue",
  "endless-revenue",
];

/** What it COSTS to run: groceries, packaging, wages, fridge upkeep, fines. (Not purchases of knives, boards, kitchens, machines or hires.) */
export const PACE_COSTS: readonly LedgerCategory[] = [
  "inventory-purchase",
  "supply-packaging-purchase",
  "business-staff-salary",
  "refrigerator-maintenance",
  "inspection-fine",
  "sharpening",
];

/** One closed day's takings and running costs, in whole cents (costs positive). */
export type PaceDay = { gross: number; costs: number };

/** A day's figures from the ledger entries written during it. */
export function dayFigures(entries: readonly EconomyLedgerEntry[]): PaceDay {
  let gross = 0;
  let costs = 0;
  for (const e of entries) {
    if (e.amount > 0 && PACE_INCOME.includes(e.category)) gross += e.amount;
    if (e.amount < 0 && PACE_COSTS.includes(e.category)) costs += -e.amount;
  }
  return { gross, costs };
}
