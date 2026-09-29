/**
 * WALLET — Economy V2.5's central safety rules for `SaveData.credits`.
 *
 * The invariant: credits are always a whole number of cents and NEVER
 * below 0. There is no debt, no overdraft and no bankruptcy: an expense the
 * wallet can't cover is refused (nothing changes), and the player can
 * always earn again through play (campaign levels, Endless Service,
 * Today's Special, the Replay Bonus).
 *
 * Two layers enforce it:
 *  1. Every expense is all-or-nothing and checks the balance first —
 *     `debitWallet` below, or the same `credits < price` guard every
 *     purchase manager already applies (knives, boards, staff, Blacksmith,
 *     sharpening, kitchen development, fridge, repairs, ingredients,
 *     contract fees); Business payroll and inspection fines are paid only
 *     in full when affordable (BusinessDayManager).
 *  2. The one save funnel refuses a wallet that breaks the invariant:
 *     App.tsx `persist` checks `walletInvariantViolation` before accepting
 *     a save, and SaveManager.save refuses to write one — so even a future
 *     bug elsewhere can never persist negative money.
 */
import type { SaveData } from "../SaveManager";

/** Null when `credits` is valid; otherwise why it isn't. */
export function walletInvariantViolation(save: Pick<SaveData, "credits">): string | null {
  const c = save.credits;
  if (typeof c !== "number" || !Number.isFinite(c)) return `credits is not a finite number (${c})`;
  if (!Number.isInteger(c)) return `credits is not whole cents (${c})`;
  if (c < 0) return `credits would be negative (${c})`;
  return null;
}

export type DebitResult =
  | { ok: true; save: SaveData; amount: number }
  | { ok: false; reason: "invalidAmount" | "insufficientFunds" };

/**
 * Takes `amount` cents out of the wallet — all or nothing. Refused (save
 * untouched) for a negative/non-integer amount or when the wallet can't
 * cover it in full; `amount === balance` is allowed and leaves exactly $0.
 * The caller records the ledger entry for the amount it reports.
 */
export function debitWallet(save: SaveData, amount: number): DebitResult {
  if (!Number.isInteger(amount) || amount < 0) return { ok: false, reason: "invalidAmount" };
  if (save.credits < amount) return { ok: false, reason: "insufficientFunds" };
  return { ok: true, save: { ...save, credits: save.credits - amount }, amount };
}
