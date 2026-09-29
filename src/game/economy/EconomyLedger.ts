/**
 * ECONOMY_LEDGER — Economy V2 Phase 9. The one place that appends to
 * SaveData.economyLedger, and the one place that derives P&L summaries
 * from it. Pure functions only, mirroring every other economy manager's
 * shape (KnifeManager/StaffManager/SupplierManager) — App.tsx persists
 * whatever these return, exactly like every other manager.
 *
 * AUDIT (Phase 9 brief §19 — every real `credits +=`/`credits -=` site in
 * App.tsx, and the LedgerCategory each maps to):
 *   serveCampaignOrder / serveBatchGroupViewedOrder / recordPreparationResult
 *     -> "campaign-settlement" (the settlement's own netResult, the ONE
 *        amount actually credited — never the revenue/COGS/qualityBonus
 *        sub-components separately, see ledgerTypes.ts's own doc)
 *   finishCampaignLevel / finishBatchGroupLevel -> "completion-reward"
 *   finishCampaignLevel / finishBatchGroupLevel / recordPreparationResult's
 *     chargeChapterUpkeep() charge -> "investment-upkeep"
 *   recordDailyResult -> "daily-reward"
 *   recordEndlessResult -> "endless-revenue"
 *   serveActiveServiceOrder (Restaurant Service — deliberately still on
 *     its own raw basePayment, never computeSettlement) -> "service-revenue"
 *   buyKnife/buyBoard/buyKitchenInvestment/buyStaff/sharpenKnife ->
 *     their own purchase categories
 *   selectSupplier -> NO ledger entry (free selection, §20: "does not
 *     move money")
 *   Economy V3 Phase 2 — purchaseIngredient (Business Mode only, never
 *     reachable from Campaign) -> "inventory-purchase"
 *   Economy V3 Phase 3 — purchaseRefrigerator (Business Mode only) ->
 *     "refrigerator-purchase"
 *   Economy V3 Phase 7 — signContract -> NO ledger entry (free, mirrors
 *     Campaign's own selectSupplier); cancelContract's fee (Business
 *     Mode only) -> "supplier-contract-cancellation"
 *   Economy V3 Phase 9 — hireStaff/fireStaff -> NO ledger entry (free);
 *     endBusinessDay's own payroll deduction (Business Mode only) ->
 *     "business-staff-salary"
 *   Economy V3 Phase 11 — performRefrigeratorMaintenance (Business Mode
 *     only) -> "refrigerator-maintenance"
 *   Economy V3 Phase 13 — endBusinessDay's own inspection-fine deduction
 *     (Business Mode only) -> "inspection-fine" (never created for a
 *     waived/zero fine)
 *   Economy V3 Phase 14 (Checkpoint 3) — serveActiveBusinessOrder (Business
 *     Mode only, BusinessServiceManager.serveBusinessOrder's own atomic
 *     inventory-consumption + payment) -> "business-revenue" (the Business
 *     Dish's current menu price, never Restaurant Service's flat
 *     basePayment, never Campaign settlement; COGS is not re-charged here
 *     since ingredients were already paid for at "inventory-purchase" time)
 * Every one of these App.tsx call sites appends its entry in the SAME
 * expression that builds the save object persist() receives — so a
 * failed purchase/settlement (which never reaches persist()) can never
 * leave a dangling ledger entry, and a successful one can never skip it.
 */
import { addToLifetime } from "./economyState";
import type { SaveData } from "../SaveManager";
import type { EconomyLedgerEntry, LedgerCategory } from "./ledgerTypes";

/**
 * Bounded history (Phase 9 brief §17 — "if unlimited is unsafe, implement
 * a sensible bounded history and document the limit"). 200 entries is
 * generous for a mobile save (a campaign playthrough's real transaction
 * count — one settlement + occasional completion/upkeep/purchase per
 * level across 250 levels — comfortably exceeds this, so the ledger is
 * always a genuine RECENT-history window, never the player's very first
 * transaction ever). Oldest entries are dropped first (FIFO) — never a
 * silent full-history discard, and never a truncation that could make
 * lifetime totals negative or inconsistent (ledgerTotals only ever sums
 * whatever's actually present, it never claims to be complete history
 * beyond this window).
 */
export const MAX_LEDGER_ENTRIES = 200;

let ledgerSeq = 0;
function nextLedgerId(): string {
  ledgerSeq += 1;
  return `ledger-${Date.now()}-${ledgerSeq}`;
}

/**
 * Appends one real wallet transaction, atomically with whatever credits
 * change the caller already folded into `save` (the caller passes the
 * SAME save object it's about to persist() — this never mutates credits
 * itself, only records that a change already happened). A zero `amount`
 * is a deliberate no-op (Phase 9 brief §22/§23/§24 — "if charged/earned
 * is 0, do not create a fake entry"), so a caller never needs its own
 * `if (amount > 0)` guard before calling this.
 */
export function appendLedgerEntry(
  save: SaveData,
  category: LedgerCategory,
  amount: number,
  description?: string,
): SaveData {
  if (amount === 0) return save;
  const entry: EconomyLedgerEntry = {
    id: nextLedgerId(),
    timestamp: Date.now(),
    category,
    amount,
    ...(description ? { description } : {}),
  };
  const economyLedger = trimLedger([...save.economyLedger, entry], entry.timestamp);
  // Economy V2.5 — the never-trimmed lifetime total of this category (economyState.ts).
  return { ...save, economyLedger, economy: addToLifetime(save.economy, category, amount) };
}

/**
 * Recent "rewarded-ad" entries survive trimming: they ARE the record of
 * which Replay Bonuses were claimed today (replayBonus.ts derives the daily
 * cap and "already claimed" from them), so a busy day of 200+ other
 * transactions must not push them out and silently re-open the cap. 36 h
 * always covers "today" in any timezone; at most the daily cap's worth of
 * entries (x2) can be retained this way, so the window stays bounded.
 */
const RETAIN_REWARDED_AD_MS = 36 * 60 * 60 * 1000;

/**
 * Economy V2.5 — milestone rewards and the Family Legacy are kept forever:
 * each entry IS the record that the reward was paid
 * (progression/milestoneRewards.ts), so trimming one would let it be paid
 * again. There are at most 22 of them, so the window stays bounded.
 */
const PERMANENT_CATEGORIES: ReadonlySet<LedgerCategory> = new Set<LedgerCategory>([
  "milestone-reward",
  "family-legacy",
]);

function trimLedger(entries: EconomyLedgerEntry[], now: number): EconomyLedgerEntry[] {
  if (entries.length <= MAX_LEDGER_ENTRIES) return entries;
  const retained = (e: EconomyLedgerEntry) =>
    PERMANENT_CATEGORIES.has(e.category) ||
    (e.category === "rewarded-ad" && now - e.timestamp < RETAIN_REWARDED_AD_MS);
  const keepCount = Math.max(0, MAX_LEDGER_ENTRIES - entries.filter(retained).length);
  const others = entries.filter((e) => !retained(e));
  const keptOthers = new Set(others.slice(others.length - keepCount));
  return entries.filter((e) => retained(e) || keptOthers.has(e));
}

export type LedgerTotals = {
  /** Sum of every positive entry in the window. */
  totalIncome: number;
  /** Sum of the ABSOLUTE VALUE of every negative entry in the window (a plain positive "how much was spent" figure, not signed). */
  totalExpense: number;
  /** totalIncome - totalExpense — the ledger window's own net cash effect (not the same as current credits unless the window covers the account's entire history; see the QA script's reconciliation check for the exact identity this satisfies on a fresh save). */
  netCashFlow: number;
  /** Signed per-category sum — a category that never fired for this save is simply absent, never a fabricated 0 row. */
  byCategory: Partial<Record<LedgerCategory, number>>;
};

/** Pure aggregation — never called by anything that also mutates SaveData; a P&L view recomputes this from `save.economyLedger` on every render rather than storing any derived total (Phase 9 brief §17 — "do not store redundant derived totals"). */
export function ledgerTotals(entries: readonly EconomyLedgerEntry[]): LedgerTotals {
  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Partial<Record<LedgerCategory, number>> = {};
  for (const entry of entries) {
    if (entry.amount > 0) totalIncome += entry.amount;
    else totalExpense += -entry.amount;
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.amount;
  }
  return { totalIncome, totalExpense, netCashFlow: totalIncome - totalExpense, byCategory };
}

export const INCOME_CATEGORIES: readonly LedgerCategory[] = [
  "campaign-settlement",
  "completion-reward",
  "daily-reward",
  "endless-revenue",
  "service-revenue",
  "business-revenue",
  "rewarded-ad",
];

export const EXPENSE_CATEGORIES: readonly LedgerCategory[] = [
  "investment-upkeep",
  "knife-purchase",
  "board-purchase",
  "kitchen-investment-purchase",
  "staff-purchase",
  "sharpening",
  "blacksmith-upgrade",
  "inventory-purchase",
  "refrigerator-purchase",
  "supplier-contract-cancellation",
  "business-staff-salary",
  "refrigerator-maintenance",
  "inspection-fine",
];

/** Short, warm, player-facing labels — never the raw category string, mirroring every other catalog's own `name` field convention. */
export const LEDGER_CATEGORY_LABEL: Record<LedgerCategory, string> = {
  "campaign-settlement": "Recipe Settlement",
  "completion-reward": "Completion Reward",
  "daily-reward": "Daily Bonus",
  "endless-revenue": "Endless Service",
  "service-revenue": "Restaurant Service",
  "investment-upkeep": "Kitchen Investment Upkeep",
  "knife-purchase": "Knife Purchase",
  "board-purchase": "Board Purchase",
  "kitchen-investment-purchase": "Restaurant Development",
  "staff-purchase": "Staff Hire",
  sharpening: "Sharpening",
  "blacksmith-upgrade": "Blacksmith Upgrade",
  "inventory-purchase": "Ingredient Purchase",
  "refrigerator-purchase": "Refrigerator",
  "supplier-contract-cancellation": "Contract Cancellation Fee",
  "business-staff-salary": "Staff Payroll",
  "refrigerator-maintenance": "Refrigerator Maintenance",
  "inspection-fine": "Inspection Fine",
  "business-revenue": "Business Order Revenue",
  "rewarded-ad": "Replay Bonus (ad)",
  "milestone-reward": "Milestone Reward",
  "family-legacy": "Family Legacy",
};
