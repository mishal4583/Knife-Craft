/**
 * SUPPLIER CREDIT (developer 2026-10-10: "small cash loan" in place of
 * Grandma's lending). From Level 10, when a service is short of stock or
 * supplies, the player can't afford them and no rewarded ad can be shown
 * (or the ad was declined), the supplier delivers on account — buying on
 * credit, as real restaurants do:
 *
 *  - the goods arrive now at their Market price (serviceCover.ts); no money
 *    moves, so no ledger entry, and `owed` grows by that price;
 *  - what's owed is repaid automatically from the next earnings — when a
 *    level is completed (and when an Endless day closes) — one
 *    "supplier-credit-repayment" ledger entry for exactly what was repaid;
 *  - a repayment is min(owed, what was just earned, the wallet), so the
 *    wallet never goes below $0 and nothing can soft-lock.
 *
 * State: the optional `business.supplierCredit` (absent = nothing owed),
 * read through `supplierCreditOf` (whole cents, never negative). Pure;
 * nothing here reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { appendLedgerEntry } from "../economy/EconomyLedger";

export type SupplierCreditState = {
  /** What the restaurant owes its supplier now (cents). */
  owed: number;
  /** Every delivery ever taken on credit (cents). */
  taken: number;
  /** Everything ever repaid (cents). */
  repaid: number;
};

const cents = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;

/** The save's supplier credit (zeros for a save that never used it). */
export function supplierCreditOf(save: SaveData): SupplierCreditState {
  const s = save.business.supplierCredit;
  return { owed: cents(s?.owed), taken: cents(s?.taken), repaid: cents(s?.repaid) };
}

function withCredit(save: SaveData, credit: SupplierCreditState): SaveData {
  return { ...save, business: { ...save.business, supplierCredit: credit } };
}

/** Goods worth `amount` taken on credit: owed grows; no money moves. */
export function takeOnCredit(save: SaveData, amount: number): SaveData {
  const add = cents(amount);
  if (add === 0) return save;
  const c = supplierCreditOf(save);
  return withCredit(save, { ...c, owed: c.owed + add, taken: c.taken + add });
}

/**
 * Repays what's owed from money just earned (`earned`, cents): at most what
 * was earned, what's owed and what's in the wallet. One ledger entry for the
 * repayment; none when nothing is repaid.
 */
export function repayFromEarnings(
  save: SaveData,
  earned: number,
  description?: string,
): { save: SaveData; repaid: number; owed: number } {
  const c = supplierCreditOf(save);
  const pay = Math.min(c.owed, cents(earned), cents(save.credits));
  if (pay === 0) return { save, repaid: 0, owed: c.owed };
  const paid = appendLedgerEntry(
    { ...save, credits: save.credits - pay },
    "supplier-credit-repayment",
    -pay,
    description,
  );
  const owed = c.owed - pay;
  return {
    save: withCredit(paid, { ...c, owed, repaid: c.repaid + pay }),
    repaid: pay,
    owed,
  };
}
