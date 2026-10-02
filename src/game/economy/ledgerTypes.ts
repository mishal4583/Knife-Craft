/**
 * LEDGER_TYPES — Economy V2 Phase 9 (Settlement UI + Ledger/P&L). The
 * ACTUAL, persisted wallet-transaction history — deliberately a SEPARATE
 * concept from `economyTypes.ts`'s `EconomyTransaction`/
 * `EconomyTransactionType`, which describe the CONCEPTUAL breakdown of
 * one settlement (revenue/COGS/quality-bonus lines that never move the
 * wallet independently — see EconomySettlement.ts's own doc: only the
 * combined `netResult` is ever actually credited). Conflating the two
 * would risk recording COGS/quality-bonus as fake separate cash
 * transactions when the real wallet only ever moves once per settlement
 * (Phase 9 brief §14/§21's explicit "do not invent transactions" rule).
 *
 * Every `LedgerCategory` here corresponds to exactly one real,
 * already-existing `credits +=`/`credits -=` site App.tsx performs —
 * see EconomyLedger.ts's own doc for the full audit. No category is
 * speculative or added "because it might be useful".
 */
export type LedgerCategory =
  | "campaign-settlement"
  | "completion-reward"
  | "daily-reward"
  | "endless-revenue"
  | "service-revenue"
  | "investment-upkeep"
  | "knife-purchase"
  | "board-purchase"
  | "kitchen-investment-purchase"
  | "staff-purchase"
  | "sharpening"
  /** Blacksmith knife upgrade (blacksmith.upgradeKnife) — Campaign coins, one entry per upgrade step. */
  | "blacksmith-upgrade"
  /** Economy V3 Phase 2 — Business Mode ingredient purchases (BusinessInventoryManager.purchaseIngredient). Never used by Campaign, which has no ingredient-purchasing concept. */
  | "inventory-purchase"
  /** Economy V3 Phase 3 — Business Mode refrigerator purchase/upgrade (RefrigeratorManager.purchaseRefrigerator). */
  | "refrigerator-purchase"
  /** Business Supplies (master spec §25) — a Market purchase of culinary smallwares or tableware (BusinessSuppliesManager.purchaseSupply). Durable equipment: capital in the Business P&L, like the refrigerator. `description` is the supply id. */
  | "supply-equipment-purchase"
  /** Business Supplies (master spec §25) — a Market purchase of takeaway packaging (BusinessSuppliesManager.purchaseSupply). A stock asset: it becomes COGS only when a served order uses it. `description` is the supply id. */
  | "supply-packaging-purchase"
  /** Economy V3 Phase 7 — Business Mode early supplier-contract cancellation fee (BusinessSupplierManager.cancelContract). Signing a contract itself moves no money and never appears here. */
  | "supplier-contract-cancellation"
  /** Economy V3 Phase 9 — Business Mode daily staff payroll (BusinessDayManager.endBusinessDay). Distinct from Campaign's own "staff-purchase" category — Campaign staff is purchase-only and never has a recurring cost. Hiring/firing a Business Mode employee itself moves no money and never appears here. */
  | "business-staff-salary"
  /** Economy V3 Phase 11 — Business Mode refrigerator maintenance/repair (businessMaintenance.ts's own performRefrigeratorMaintenance). Distinct from "refrigerator-purchase" — this is repairing the OWNED unit, never buying/upgrading it. */
  | "refrigerator-maintenance"
  /** Economy V3 Phase 13 — Business Mode inspection fine (businessInspectionFines.ts's own determineInspectionFine, applied by BusinessDayManager.endBusinessDay). Never created for a zero-amount (NONE-severity) result — appendLedgerEntry's own 0-amount no-op guarantees that. */
  | "inspection-fine"
  /** Economy V3 Phase 14 (Checkpoint 3) — Business Mode order revenue (BusinessServiceManager.serveBusinessOrder, applied by App.tsx's serveActiveBusinessOrder). Distinct from Campaign's "service-revenue" — this is a real Business Dish sold at its own current menu price, never Restaurant Service's flat basePayment. COGS is never charged here: the ingredients were already paid for at "inventory-purchase" time, so this entry is revenue only, exactly once per successful serve. */
  | "business-revenue"
  /** Platform rewarded ad (Playgama Bridge) — the optional Campaign Replay Bonus (src/game/ads/replayBonus.ts). Written ONLY after requestRewardedAd() reported the Bridge state `rewarded`; `description` is that ad's unique reward id, which makes the entry itself the record that the bonus was claimed (no separate save field). Its own category so ad income is always measurable apart from the Economy V2 Campaign baseline. */
  | "rewarded-ad"
  /** Economy V2.5 — a one-time Restaurant Progress milestone reward (progression/milestoneRewards.ts). `description` is the milestone id; the entry itself is the record that it was paid, and EconomyLedger never trims it. */
  | "milestone-reward"
  /** Economy V2.5 — the one-time Level 250 FAMILY LEGACY reward ($50,000, milestoneRewards.ts). `description` is "campaign-complete"; never trimmed, so it can never be paid twice. */
  | "family-legacy";

/**
 * One real wallet-transaction record. `amount` is signed and is always
 * the EXACT credits delta the transaction caused — never a settlement
 * sub-component, never invented, never zero (EconomyLedger.appendLedgerEntry
 * is a no-op for a zero amount, so a zero-value entry can never exist).
 */
export type EconomyLedgerEntry = {
  id: string;
  timestamp: number;
  category: LedgerCategory;
  /** Signed: positive = income, negative = expense. Integer currency units, exactly like SaveData.credits itself. */
  amount: number;
  /** Opaque provenance — a recipe id, level id, chapter label, catalog item id. Never parsed by ledger logic itself. */
  description?: string;
};
