/**
 * ECONOMY STATE — the small piece of Economy V2.5 bookkeeping the ledger
 * alone can't hold (the ledger keeps only its most recent 200 entries).
 *
 *  - `version`: which economy rules this save has been migrated to. 0 means
 *    the save predates Economy V2.5 and still needs its one-time migration
 *    (progression/economyMigration.ts); a new save starts at ECONOMY_VERSION.
 *  - `claimedMilestoneIds`: every milestone whose reward is settled — paid,
 *    or waived by the migration because the save reached it under the old
 *    economy (`waivedMilestoneIds`, a subset). A claimed milestone is never
 *    paid (again). "Completed" is derived from the save; "claimed" is this.
 *  - `lifetime`: the exact running total of every ledger category, updated
 *    by EconomyLedger.appendLedgerEntry — the one function every wallet
 *    movement is recorded through — so it is never trimmed and never
 *    recalculated. The Progress screen's historical figures read it.
 *  - `lifetimeSince`: "start" when the totals cover the save's whole life;
 *    "migration" when they were reconstructed at the V2.5 migration (see
 *    economyMigration.ts for exactly what is reconstructed and how).
 */
import type { LedgerCategory } from "./ledgerTypes";

export const ECONOMY_VERSION = 1;

export type EconomyState = {
  version: number;
  claimedMilestoneIds: string[];
  waivedMilestoneIds: string[];
  lifetime: Partial<Record<LedgerCategory, number>>;
  lifetimeSince: "start" | "migration";
};

export const DEFAULT_ECONOMY_STATE: EconomyState = {
  version: ECONOMY_VERSION,
  claimedMilestoneIds: [],
  waivedMilestoneIds: [],
  lifetime: {},
  lifetimeSince: "start",
};

/** What a save written before Economy V2.5 (no `economy` field) loads as — migrated once on load. */
export const LEGACY_ECONOMY_STATE: EconomyState = { ...DEFAULT_ECONOMY_STATE, version: 0 };

/** Adds one ledger movement to the lifetime totals. Pure. */
export function addToLifetime(
  state: EconomyState | undefined,
  category: LedgerCategory,
  amount: number,
): EconomyState {
  const base = state ?? DEFAULT_ECONOMY_STATE;
  return {
    ...base,
    lifetime: { ...base.lifetime, [category]: (base.lifetime[category] ?? 0) + amount },
  };
}

/** The lifetime total of one category (signed, cents; 0 when it never fired). */
export function lifetimeTotal(state: EconomyState | undefined, category: LedgerCategory): number {
  return state?.lifetime[category] ?? 0;
}
