/**
 * BUSINESS_DAY_HISTORY — the latest 30 completed restaurant (Business) days,
 * for long-term history (task #10). Data first: each record is copied from
 * the day's own settlement — the `DailyPnL` End Business Day already
 * computes and the day's order count — never recomputed, never estimated.
 * Nothing here moves money or writes a ledger entry.
 *
 * Stored in the optional `business.finance.history` (oldest first, at most
 * HISTORY_DAYS). A save without it has an empty history; old ledger entries
 * are never rewritten into records.
 *
 * Costs, as the settlement records them:
 *  - P&L costs (accrual): ingredients + packaging USED by the day's orders
 *    (`cogs` — packaging used is part of an order's COGS), staff wages,
 *    maintenance, supplier fees, inspection fines, other operating costs
 *    (always 0 today). `totalCosts` is their sum; `profit` = revenue −
 *    totalCosts (the P&L's operating profit).
 *  - Cash purchases (assets, not P&L costs): ingredients, takeaway
 *    packaging, equipment & tableware (capital).
 *  - Waste: the value of stock that spoiled or was thrown out (non-cash).
 *
 * In the restaurant build the specialist chefs are paid right after End
 * Business Day (staffRequirements.paySpecialists); that payment is added to
 * the same day's wages and costs, so the record matches the wallet.
 */
import type { SaveData } from "../SaveManager";
import type { DailyPnL } from "./BusinessFinanceManager";

export const HISTORY_DAYS = 30;

export type BusinessDayRecord = {
  /** The Business Day that was completed (the calendar's day number; the game has no real dates). */
  day: number;
  revenue: number;
  /** Ingredients + takeaway packaging used by the day's orders (the P&L's COGS). */
  goodsUsed: number;
  staffWages: number;
  maintenance: number;
  supplierFees: number;
  inspectionFines: number;
  otherOperating: number;
  /** goodsUsed + staffWages + maintenance + supplierFees + inspectionFines + otherOperating. */
  totalCosts: number;
  /** revenue − totalCosts (the P&L's operating profit). */
  profit: number;
  /** Value of stock that spoiled or was thrown out that day (non-cash). */
  waste: number;
  /** Cash spent on ingredients that day (stock, not a P&L cost). */
  ingredientPurchases: number;
  /** Cash spent on takeaway packaging that day (stock, not a P&L cost). */
  packagingPurchases: number;
  /** Cash spent on equipment and tableware that day (capital). */
  equipmentPurchases: number;
  /** The wallet's change over the day. */
  netCash: number;
  /** Orders served (each customer places one order). */
  ordersServed: number;
  customersServed: number;
  /** revenue ÷ orders, whole cents; null on a day with no orders. */
  averageOrderValue: number | null;
  /** Endless Restaurant only: the day's stars (0–3, status only — restaurantStanding.ts). */
  stars?: number;
};

/** A day's record from its settlement (`DailyPnL`) and its order count. */
export function dayRecordFrom(day: number, pnl: DailyPnL, ordersServed: number): BusinessDayRecord {
  const orders = Math.max(0, Math.floor(ordersServed));
  const totalCosts =
    pnl.cogs +
    pnl.staffCost +
    pnl.maintenanceCost +
    pnl.supplierCost +
    pnl.inspectionFines +
    pnl.otherOperatingCost;
  return {
    day,
    revenue: pnl.revenue,
    goodsUsed: pnl.cogs,
    staffWages: pnl.staffCost,
    maintenance: pnl.maintenanceCost,
    supplierFees: pnl.supplierCost,
    inspectionFines: pnl.inspectionFines,
    otherOperating: pnl.otherOperatingCost,
    totalCosts,
    profit: pnl.operatingProfit,
    waste: pnl.spoilageValue,
    ingredientPurchases: pnl.inventoryPurchaseCost,
    packagingPurchases: pnl.packagingPurchaseCost ?? 0,
    equipmentPurchases: pnl.capitalExpenditure,
    netCash: pnl.netCashChange,
    ordersServed: orders,
    customersServed: orders,
    averageOrderValue: orders > 0 ? Math.round(pnl.revenue / orders) : null,
  };
}

/** Appends a day and keeps only the latest HISTORY_DAYS (the oldest is dropped first). */
export function withDayRecord(
  history: readonly BusinessDayRecord[] | undefined,
  record: BusinessDayRecord,
): BusinessDayRecord[] {
  return [...(history ?? []), record].slice(-HISTORY_DAYS);
}

/** The stored history, oldest first (empty for a save that has none). */
export function dayHistoryOf(save: SaveData): readonly BusinessDayRecord[] {
  return save.business.finance.history ?? [];
}

const NUMBER_FIELDS: Array<keyof BusinessDayRecord> = [
  "day",
  "revenue",
  "goodsUsed",
  "staffWages",
  "maintenance",
  "supplierFees",
  "inspectionFines",
  "otherOperating",
  "totalCosts",
  "profit",
  "waste",
  "ingredientPurchases",
  "packagingPurchases",
  "equipmentPurchases",
  "netCash",
  "ordersServed",
  "customersServed",
];

/** Load-time check of a stored history: keeps well-formed records only (latest 30). Undefined when there was none. */
export function sanitizeDayHistory(raw: unknown): BusinessDayRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ok = raw.filter(
    (r): r is BusinessDayRecord =>
      !!r &&
      typeof r === "object" &&
      NUMBER_FIELDS.every((k) => Number.isFinite((r as Record<string, unknown>)[k])) &&
      ((r as BusinessDayRecord).averageOrderValue === null ||
        Number.isFinite((r as BusinessDayRecord).averageOrderValue)) &&
      ((r as BusinessDayRecord).stars === undefined ||
        Number.isFinite((r as BusinessDayRecord).stars)),
  );
  return ok.slice(-HISTORY_DAYS);
}

/**
 * Restaurant build: the specialist chefs' wages, paid right after End
 * Business Day, belong to the day that just closed (its latest record).
 * No-op without a record or a payment.
 */
export function addSpecialistWagesToLatestDay(save: SaveData, cents: number): SaveData {
  const history = save.business.finance.history;
  if (!history?.length || cents <= 0) return save;
  const last = history[history.length - 1]!;
  const updated: BusinessDayRecord = {
    ...last,
    staffWages: last.staffWages + cents,
    totalCosts: last.totalCosts + cents,
    profit: last.profit - cents,
    netCash: last.netCash - cents,
  };
  return {
    ...save,
    business: {
      ...save.business,
      finance: { ...save.business.finance, history: [...history.slice(0, -1), updated] },
    },
  };
}
