/**
 * BUSINESS_FINANCE_MANAGER — Economy V3 Phase 15. The Business Mode P&L
 * layer, built ENTIRELY on top of the transactions the real, already-
 * live Business Mode pipeline (Phase 2-14) actually produces — never a
 * second wallet, never a second ledger, never simulated/invented
 * revenue. Two kinds of numbers feed the P&L, and this file is
 * deliberately explicit about which is which:
 *
 *   1. CASH numbers — every real `credits +=`/`credits -=` this game
 *      performs already has exactly one corresponding
 *      `SaveData.economyLedger` entry (see EconomyLedger.ts's own
 *      audit). The P&L's lifetime/cumulative figures are computed
 *      DIRECTLY from that existing ledger — `businessLedgerEntries`
 *      below is the one place that filters it down to the 7 real
 *      Business-only categories (never Campaign's own
 *      campaign-settlement/completion-reward/daily-reward/
 *      endless-revenue/service-revenue/investment-upkeep/knife-purchase/
 *      board-purchase/kitchen-investment-purchase/staff-purchase/
 *      sharpening categories, which share the SAME ledger array but
 *      must never be counted as Business Mode activity).
 *
 *   2. COGS — the one genuinely NEW figure this phase introduces. Real
 *      restaurant accounting recognizes ingredient cost at CONSUMPTION
 *      time, not at purchase time (master spec §16's own "Accounting
 *      model": "Inventory purchase: cash decreases, inventory asset
 *      increases. Never also booked as an immediate P&L expense — that
 *      happens at consumption/spoilage, not at purchase"). Since
 *      consuming inventory for a serve moves no SECOND cash amount
 *      (the cash already left at purchase time), COGS recognition is
 *      NOT a wallet mutation and therefore correctly has NO ledger
 *      entry of its own — putting one there would conflate a non-cash
 *      accrual with the cash ledger and break the checkpoint's own
 *      "Opening Cash + Signed Ledger Cash Flow = Closing Cash"
 *      reconciliation identity. Instead, `realCogsFor` computes the
 *      ACTUAL cost of what was just consumed from the real, existing
 *      weighted-average `InventoryEntry.unitCost` (businessInventory.ts
 *      — the same authoritative "what did the business actually pay"
 *      number `addStock` already maintains for every purchase,
 *      including event/contract/staff-discounted ones) — never the
 *      abstract, portion-scaled `recipeCostBasis` menu-pricing figure
 *      (businessMenu.ts), which answers a different question ("what
 *      should this dish cost on the menu today") and can legitimately
 *      differ from what was actually paid for the specific units in
 *      stock. `BusinessServiceManager.serveBusinessOrder` calls this
 *      BEFORE consumption removes the stock it needs to read.
 *
 * The result is recorded in a small persisted `BusinessFinanceState` —
 * a `dailyAccumulator` (reset to zero by `BusinessDayManager.endBusinessDay`
 * at every day boundary, since ledger `timestamp`s are real wall-clock
 * time and cannot reconstruct "what happened since this business day
 * started") plus a `lifetimeCogs` running total (never reset — the one
 * number the ledger itself structurally cannot hold, per the point
 * above).
 *
 * LIFETIME TOTALS (Economy V3 Phase 16 final remediation, P1 fix): the
 * shared ledger is a 200-entry FIFO window across Campaign AND Business
 * (EconomyLedger.MAX_LEDGER_ENTRIES, frozen Economy V2 design), so
 * "lifetime" revenue/order/expense figures derived from it silently
 * shrank to a recent window once an active player passed 200 entries,
 * while `lifetimeCogs` kept counting — mixing two time spans. `lifetime`
 * below is a set of running totals bumped INSIDE the same record
 * functions that already fire exactly once per Business transaction
 * (recordRevenueAndCogs / recordInventoryPurchase /
 * recordCapitalExpenditure / recordMaintenanceCost / recordSupplierCost
 * / closeBusinessDay for payroll + fines), so each is counted exactly
 * once, only for Business, never for Campaign. It is BOOKKEEPING ONLY —
 * it never moves cash and is never a second ledger: the ledger stays the
 * record of cash movements and the reconciliation source; these totals
 * only summarize the Business side of it without the window limit.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import type { BusinessInventory, IngredientRequirement } from "./businessInventory";
import type { EconomyLedgerEntry, LedgerCategory } from "../economy/ledgerTypes";
import { MAX_LEDGER_ENTRIES } from "../economy/EconomyLedger";

export type BusinessDailyAccumulator = {
  /** Sum of `business-revenue` ledger amounts since the current Business Day began. */
  revenue: number;
  /** Non-cash — real ingredient cost of everything consumed by a successful serve since the current Business Day began (see `realCogsFor`). Never a ledger amount. */
  cogs: number;
  /** Cash spent on ingredient purchases since the current Business Day began — an ASSET purchase (inventory), never itself a P&L expense; shown only in the Cash Flow view. */
  inventoryPurchaseCost: number;
  /** Sum of `refrigerator-maintenance` ledger amounts since the current Business Day began. */
  maintenanceCost: number;
  /** Sum of `supplier-contract-cancellation` ledger amounts since the current Business Day began. */
  supplierCost: number;
  /** Sum of `refrigerator-purchase` ledger amounts since the current Business Day began — CAPITAL, never ordinary operating expense. */
  capitalExpenditure: number;
  /**
   * Economy V3 Phase 16 (popularity model D2) — Business orders successfully
   * served since the current Business Day began (a $0 dish counts). Not
   * money: only End Business Day's bounded daily service score reads it
   * (PopularityManager.dailyServiceDelta). A save written before this
   * field existed migrates it as 0 (migrateBusinessFinanceState's own
   * dailyAccumulator default merge).
   */
  ordersServed: number;
};

export const DEFAULT_DAILY_ACCUMULATOR: BusinessDailyAccumulator = {
  revenue: 0,
  cogs: 0,
  inventoryPurchaseCost: 0,
  maintenanceCost: 0,
  supplierCost: 0,
  capitalExpenditure: 0,
  ordersServed: 0,
};

/**
 * True running lifetime totals for Business Mode — see file header. All
 * whole US cents except `orderCount`. COGS is deliberately NOT repeated
 * here: `BusinessFinanceState.lifetimeCogs` already is that running
 * total (one source of truth).
 */
export type BusinessLifetimeTotals = {
  revenue: number;
  /** One per successfully served Business order (including a $0-priced dish, which the ledger's 0-amount no-op never recorded). */
  orderCount: number;
  /** Cash spent on ingredients — an asset purchase, never an operating expense. */
  inventoryPurchaseCost: number;
  staffCost: number;
  maintenanceCost: number;
  supplierCost: number;
  inspectionFines: number;
  /** Refrigerator purchases — capital, never operating expense. */
  capitalExpenditure: number;
  /**
   * "complete" — every Business transaction this save ever made is in the
   * totals. "partial" — the save was migrated from a point where some
   * history was already unrecoverable (see `migrateBusinessFinanceState`),
   * so the totals start at the earliest record the save still held. The
   * Finance screen says so rather than claiming precision it doesn't have.
   */
  coverage: "complete" | "partial";
};

export const DEFAULT_LIFETIME_TOTALS: BusinessLifetimeTotals = {
  revenue: 0,
  orderCount: 0,
  inventoryPurchaseCost: 0,
  staffCost: 0,
  maintenanceCost: 0,
  supplierCost: 0,
  inspectionFines: 0,
  capitalExpenditure: 0,
  coverage: "complete",
};

export type BusinessFinanceState = {
  dailyAccumulator: BusinessDailyAccumulator;
  /** Never reset — the ledger has no entry for non-cash COGS recognition (see file header), so this is the one place a lifetime total for it can live. */
  lifetimeCogs: number;
  /** The full P&L for the most recently COMPLETED Business Day, persisted so the Finance screen survives reload/navigation (checkpoint requirement) — `null` before the player has ever ended a Business Day. Overwritten, never accumulated, by every `BusinessDayManager.endBusinessDay` call. */
  lastDailyPnL: DailyPnL | null;
  /** Economy V3 Phase 16 — running lifetime totals independent of the 200-entry ledger window. See `BusinessLifetimeTotals`. */
  lifetime: BusinessLifetimeTotals;
};

export const DEFAULT_BUSINESS_FINANCE_STATE: BusinessFinanceState = {
  dailyAccumulator: { ...DEFAULT_DAILY_ACCUMULATOR },
  lifetimeCogs: 0,
  lastDailyPnL: null,
  lifetime: { ...DEFAULT_LIFETIME_TOTALS },
};

/**
 * The REAL cost of what a serve is about to consume — sum over each
 * distinct ingredient of (total quantity consumed × that ingredient's
 * CURRENT weighted-average paid `unitCost`), read from `inventory`
 * BEFORE `consumeUsableIngredients` removes the stock. Requirements are
 * pre-summed per ingredient first (mirrors `consumeIngredients`'s own
 * totals map) so a dish using one ingredient across two components is
 * priced once, correctly, not double-counted per component instance.
 */
export function realCogsFor(
  inventory: BusinessInventory,
  requirements: readonly IngredientRequirement[],
): number {
  const totals = new Map<IngredientId, number>();
  for (const r of requirements) {
    totals.set(r.ingredientId, (totals.get(r.ingredientId) ?? 0) + r.quantity);
  }
  let cogs = 0;
  for (const [ingredientId, quantity] of totals) {
    cogs += quantity * (inventory[ingredientId]?.unitCost ?? 0);
  }
  return Math.round(cogs);
}

/** Applied atomically by `BusinessServiceManager.serveBusinessOrder`, once per successful serve, in the SAME returned save as the credits/inventory changes — never a separate mutation the caller could apply only half of. Also counts the serve toward today's `ordersServed` (popularity model D2). */
export function recordRevenueAndCogs(save: SaveData, revenue: number, cogs: number): SaveData {
  const finance = save.business.finance;
  return {
    ...save,
    business: {
      ...save.business,
      finance: {
        ...finance,
        dailyAccumulator: {
          ...finance.dailyAccumulator,
          revenue: finance.dailyAccumulator.revenue + revenue,
          cogs: finance.dailyAccumulator.cogs + cogs,
          ordersServed: (finance.dailyAccumulator.ordersServed ?? 0) + 1,
        },
        lifetimeCogs: finance.lifetimeCogs + cogs,
        lifetime: {
          ...finance.lifetime,
          revenue: finance.lifetime.revenue + revenue,
          orderCount: finance.lifetime.orderCount + 1,
        },
      },
    },
  };
}

function recordAccumulatorDelta(
  save: SaveData,
  key: keyof Omit<BusinessDailyAccumulator, "revenue" | "cogs" | "ordersServed">,
  amount: number,
): SaveData {
  if (amount === 0) return save;
  const finance = save.business.finance;
  return {
    ...save,
    business: {
      ...save.business,
      finance: {
        ...finance,
        dailyAccumulator: {
          ...finance.dailyAccumulator,
          [key]: finance.dailyAccumulator[key] + amount,
        },
        lifetime: { ...finance.lifetime, [key]: finance.lifetime[key] + amount },
      },
    },
  };
}

/** Called by App.tsx's purchaseIngredient wrapper on a successful purchase only — mirrors that wrapper's own "only on success" ledger-append gating. */
export function recordInventoryPurchase(save: SaveData, totalCost: number): SaveData {
  return recordAccumulatorDelta(save, "inventoryPurchaseCost", totalCost);
}

/** Called by App.tsx's purchaseRefrigerator wrapper on a successful purchase only. */
export function recordCapitalExpenditure(save: SaveData, price: number): SaveData {
  return recordAccumulatorDelta(save, "capitalExpenditure", price);
}

/** Called by App.tsx's performRefrigeratorMaintenance wrapper on a successful repair only. */
export function recordMaintenanceCost(save: SaveData, cost: number): SaveData {
  return recordAccumulatorDelta(save, "maintenanceCost", cost);
}

/** Called by App.tsx's cancelSupplierContract wrapper on a successful cancellation only (appendLedgerEntry's own 0-amount no-op precedent is mirrored here: a free/no-fee cancellation records nothing). */
export function recordSupplierCost(save: SaveData, fee: number): SaveData {
  return recordAccumulatorDelta(save, "supplierCost", fee);
}

/**
 * Called once by BusinessDayManager.endBusinessDay, on the save it's
 * about to return: the day that just ended gets its full `DailyPnL`
 * persisted as `lastDailyPnL` (so the Finance screen survives reload),
 * and the accumulator resets to zero for the fresh Business Day that's
 * starting.
 */
export function closeBusinessDay(save: SaveData, dailyPnL: DailyPnL): SaveData {
  return {
    ...save,
    business: {
      ...save.business,
      finance: {
        ...save.business.finance,
        dailyAccumulator: { ...DEFAULT_DAILY_ACCUMULATOR },
        lastDailyPnL: dailyPnL,
        // Payroll and inspection fines settle only here, once per End Business Day.
        lifetime: {
          ...save.business.finance.lifetime,
          staffCost: save.business.finance.lifetime.staffCost + dailyPnL.staffCost,
          inspectionFines:
            save.business.finance.lifetime.inspectionFines + dailyPnL.inspectionFines,
        },
      },
    },
  };
}

export type DailyPnL = {
  openingCash: number;
  revenue: number;
  /** Non-cash — see file header. */
  cogs: number;
  grossProfit: number;
  staffCost: number;
  maintenanceCost: number;
  supplierCost: number;
  /** Master spec §17's own Daily P&L line — currently always 0, since every real Business Mode operating expense category (maintenance/supplier-cancellation/inspection-fine/staff) is already itemized separately; kept as its own explicit line rather than silently dropped, so a genuinely new expense category added by a later phase has somewhere honest to appear. */
  otherOperatingCost: number;
  inspectionFines: number;
  /** P&L (accrual) operating profit: grossProfit - staffCost - maintenanceCost - supplierCost - otherOperatingCost - inspectionFines. Never includes inventoryPurchaseCost or capitalExpenditure (see file header). */
  operatingProfit: number;
  /** Non-cash, informational only — spoilage never moves cash (confirmed: BusinessDayManager.endBusinessDay creates zero ledger entries for it). */
  spoilageValue: number;
  /** Cash Flow view — the ACTUAL cash outflow for ingredients bought today (an asset purchase, never a P&L expense). */
  inventoryPurchaseCost: number;
  /** Cash Flow view — revenue - inventoryPurchaseCost - staffCost - maintenanceCost - supplierCost - otherOperatingCost - inspectionFines (excludes capital). */
  operatingCashFlow: number;
  /** Cash Flow view — refrigerator purchases today; capital, never ordinary operating expense. */
  capitalExpenditure: number;
  /** closingCash - openingCash. `closingCash` is the real, directly-read `save.credits`; `openingCash` is reconstructed from it by reversing this day's own accumulator deltas (see `computeDailyPnL`'s own doc for why `cashBeforeSettlement` alone is NOT the day's true opening balance). */
  netCashChange: number;
  closingCash: number;
};

/**
 * Built from the accumulator BusinessDayManager.endBusinessDay is about
 * to reset, plus the payroll/fine/spoilage figures that SAME call
 * already computes for the day being closed.
 *
 * `cashBeforeSettlement` is `save.credits` at the moment
 * `endBusinessDay` was called — by then, this Business Day's OWN
 * revenue/purchases/maintenance/supplier/capital actions have already
 * happened (they're real-time player actions, not something
 * `endBusinessDay` itself does), so it is NOT the day's true opening
 * balance; only payroll/inspection fines are still pending at that
 * point. `openingCash` below is reconstructed by reversing every
 * accumulator-tracked delta out of it — the balance the day actually
 * STARTED at, before any of its own activity. Skipping this
 * reconstruction (an earlier version of this function took
 * `cashBeforeSettlement` directly as `openingCash`) silently produced
 * `netCashChange = closingCash - cashBeforeSettlement`, which only
 * reflects the settlement step and understates the day's real net cash
 * movement — caught by this checkpoint's own live browser verification
 * (a served order's revenue and its ingredient purchase both vanished
 * from the displayed Net Cash Change even though the wallet correctly
 * held the right balance throughout). `closingCash` (after
 * payroll/fines) IS taken directly, never re-derived, so it can never
 * drift from what actually happened to the wallet.
 */
export function computeDailyPnL(params: {
  cashBeforeSettlement: number;
  closingCash: number;
  accumulator: BusinessDailyAccumulator;
  staffCost: number;
  inspectionFines: number;
  spoilageValue: number;
}): DailyPnL {
  const {
    cashBeforeSettlement,
    closingCash,
    accumulator,
    staffCost,
    inspectionFines,
    spoilageValue,
  } = params;
  const openingCash =
    cashBeforeSettlement -
    accumulator.revenue +
    accumulator.inventoryPurchaseCost +
    accumulator.maintenanceCost +
    accumulator.supplierCost +
    accumulator.capitalExpenditure;
  const grossProfit = accumulator.revenue - accumulator.cogs;
  const otherOperatingCost = 0;
  const operatingProfit =
    grossProfit -
    staffCost -
    accumulator.maintenanceCost -
    accumulator.supplierCost -
    otherOperatingCost -
    inspectionFines;
  const operatingCashFlow =
    accumulator.revenue -
    accumulator.inventoryPurchaseCost -
    staffCost -
    accumulator.maintenanceCost -
    accumulator.supplierCost -
    otherOperatingCost -
    inspectionFines;
  return {
    openingCash,
    revenue: accumulator.revenue,
    cogs: accumulator.cogs,
    grossProfit,
    staffCost,
    maintenanceCost: accumulator.maintenanceCost,
    supplierCost: accumulator.supplierCost,
    otherOperatingCost,
    inspectionFines,
    operatingProfit,
    spoilageValue,
    inventoryPurchaseCost: accumulator.inventoryPurchaseCost,
    operatingCashFlow,
    capitalExpenditure: accumulator.capitalExpenditure,
    netCashChange: closingCash - openingCash,
    closingCash,
  };
}

/** The 7 real Business Mode ledger categories — never Campaign's own (see file header). The one place this filter is defined; every lifetime figure below reuses it. */
const BUSINESS_LEDGER_CATEGORIES: readonly LedgerCategory[] = [
  "business-revenue",
  "inventory-purchase",
  "refrigerator-purchase",
  "refrigerator-maintenance",
  "supplier-contract-cancellation",
  "business-staff-salary",
  "inspection-fine",
];

export function businessLedgerEntries(
  entries: readonly EconomyLedgerEntry[],
): EconomyLedgerEntry[] {
  return entries.filter((e) => BUSINESS_LEDGER_CATEGORIES.includes(e.category));
}

export type LifetimeSummary = {
  /** Lifetime Business revenue — `finance.lifetime.revenue` (running total, independent of the ledger window). */
  cumulativeRevenue: number;
  /** Every real Business cash outflow (inventory purchases, refrigerator purchases, maintenance, supplier cancellations, staff payroll, inspection fines) — a CASH FLOW total, includes capital expenditure. */
  cumulativeCashExpenses: number;
  /** `save.business.finance.lifetimeCogs` — non-cash, ingredient cost of everything ever actually consumed by a successful serve. */
  cumulativeCogs: number;
  /** revenue - cogs. */
  cumulativeGrossProfit: number;
  cumulativeLabor: number;
  /** maintenance + supplier fees + inspection fines (other operating cost is always 0 — see DailyPnL). */
  cumulativeOperatingCosts: number;
  /** Refrigerator purchases — capital, excluded from `cumulativeOperatingProfit`. */
  cumulativeCapitalExpenditure: number;
  /** gross profit - labor - operating costs — deliberately excludes both inventory purchases (an asset purchase, not this metric's expense) and capital expenditure (investment, not operating). */
  cumulativeOperatingProfit: number;
  /** One per successfully served order, never per generated/cancelled/failed order. */
  orderCount: number;
  /** 0 when `orderCount` is 0 — never NaN/Infinity. */
  averageRevenuePerOrder: number;
  /** cumulativeCogs / cumulativeRevenue, as a percentage — 0 when revenue is 0. */
  foodCostPercent: number;
  /** See `BusinessLifetimeTotals.coverage`. */
  coverage: "complete" | "partial";
};

/** Economy V3 Phase 16 — read from the running `finance.lifetime` totals, never from the 200-entry ledger window (see file header). */
export function lifetimeSummary(save: SaveData): LifetimeSummary {
  const l = save.business.finance.lifetime;
  const cumulativeCogs = save.business.finance.lifetimeCogs;
  const cumulativeGrossProfit = l.revenue - cumulativeCogs;
  const cumulativeOperatingCosts = l.maintenanceCost + l.supplierCost + l.inspectionFines;
  const cumulativeOperatingProfit = cumulativeGrossProfit - l.staffCost - cumulativeOperatingCosts;
  return {
    cumulativeRevenue: l.revenue,
    cumulativeCashExpenses:
      l.inventoryPurchaseCost + l.capitalExpenditure + l.staffCost + cumulativeOperatingCosts,
    cumulativeCogs,
    cumulativeGrossProfit,
    cumulativeLabor: l.staffCost,
    cumulativeOperatingCosts,
    cumulativeCapitalExpenditure: l.capitalExpenditure,
    cumulativeOperatingProfit,
    orderCount: l.orderCount,
    averageRevenuePerOrder: l.orderCount > 0 ? Math.round(l.revenue / l.orderCount) : 0,
    foodCostPercent: l.revenue > 0 ? Math.round((cumulativeCogs / l.revenue) * 1000) / 10 : 0,
    coverage: l.coverage,
  };
}

/** Sums the Business entries a ledger window still holds into lifetime totals — used ONLY to seed a save that predates `finance.lifetime` (see `migrateBusinessFinanceState`). */
function lifetimeTotalsFromLedger(
  entries: readonly EconomyLedgerEntry[],
): Omit<BusinessLifetimeTotals, "coverage"> {
  const sum = (category: LedgerCategory) =>
    entries.filter((e) => e.category === category).reduce((acc, e) => acc + Math.abs(e.amount), 0);
  return {
    revenue: sum("business-revenue"),
    orderCount: entries.filter((e) => e.category === "business-revenue").length,
    inventoryPurchaseCost: sum("inventory-purchase"),
    staffCost: sum("business-staff-salary"),
    maintenanceCost: sum("refrigerator-maintenance"),
    supplierCost: sum("supplier-contract-cancellation"),
    inspectionFines: sum("inspection-fine"),
    capitalExpenditure: sum("refrigerator-purchase"),
  };
}

/**
 * The ONE migration for `business.finance` (called by SaveManager.load).
 * Nested-merge pattern, like `business` itself: every known field of a
 * stored finance object is kept; any missing one gets its default.
 *
 * `lifetime` did not exist before Economy V3 Phase 16. For such a save
 * the running totals are SEEDED from the Business entries the save's
 * ledger still holds — never invented:
 *   - ledger shorter than MAX_LEDGER_ENTRIES: the FIFO window has never
 *     dropped anything (it only drops when a 201st entry is appended),
 *     so the seed is exact and coverage is "complete" — provided the save
 *     also had V3-15's finance state (so `lifetimeCogs` covered every
 *     serve the revenue figure includes).
 *   - ledger AT the cap (history may already have been dropped), or a
 *     save that predates V3-15's finance state AND has Business serves
 *     in its ledger (their revenue is known but their COGS was never
 *     recorded): coverage is "partial" — the totals start at the
 *     earliest record the save still holds, and the Finance screen says
 *     so. A pre-V3-15 save with no Business serves has nothing missing
 *     and stays "complete".
 * A save that already has `lifetime` is left exactly as stored.
 */
export function migrateBusinessFinanceState(
  stored: unknown,
  ledger: readonly EconomyLedgerEntry[],
): BusinessFinanceState {
  const raw = (stored && typeof stored === "object" ? stored : {}) as Partial<BusinessFinanceState>;
  const hadFinance = stored !== undefined && stored !== null;
  const base: BusinessFinanceState = {
    ...DEFAULT_BUSINESS_FINANCE_STATE,
    ...raw,
    dailyAccumulator: { ...DEFAULT_DAILY_ACCUMULATOR, ...raw.dailyAccumulator },
    lifetime: { ...DEFAULT_LIFETIME_TOTALS },
  };
  if (raw.lifetime) return { ...base, lifetime: { ...DEFAULT_LIFETIME_TOTALS, ...raw.lifetime } };
  const windowMayHaveDropped = ledger.length >= MAX_LEDGER_ENTRIES;
  const seeded = lifetimeTotalsFromLedger(businessLedgerEntries(ledger));
  // Pre-V3-15 serves have ledger revenue but no recorded COGS — only a gap if such serves exist.
  const untrackedCogs = !hadFinance && seeded.orderCount > 0;
  return {
    ...base,
    lifetime: {
      ...seeded,
      coverage: windowMayHaveDropped || untrackedCogs ? "partial" : "complete",
    },
  };
}
