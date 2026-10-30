/**
 * PENDING CASH — what a served order left on the table (developer 2026-10-29: the
 * money only enters the wallet when the player sweeps it up).
 *
 * The amount still on the table is saved in `business.pendingCash`, in the SAME save
 * that marks the order paid, so closing the game mid-sweep never loses it. Each swept
 * piece moves exactly its cents from the table into the wallet in one save, and into
 * the order's ONE settlement entry (and ONE tip entry) of the ledger
 * (`accumulateLedgerEntry`): the wallet always equals the signed ledger, and an order
 * never floods the bounded ledger. Whatever is still on the table when the player leaves
 * it, or when the game loads, is settled the same way (`settlePendingCash`), so money is
 * never stranded. No new wallet, ledger or event bus; pure, no randomness.
 */
import type { SaveData } from "../SaveManager";
import { accumulateLedgerEntry } from "./EconomyLedger";
import type { LedgerCategory } from "./ledgerTypes";

export type PendingCash = {
  /** Ties this order's pieces to its ledger entries. */
  batch: string;
  /** The pay's ledger category (the tip is always "customer-tip"). */
  category: LedgerCategory;
  description: string;
  tipDescription?: string;
  /** Cents of the pay / the tip still on the table. */
  payCents: number;
  tipCents: number;
};

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/**
 * A deterministic, unique id for this order's cash: one past the highest `cash-N` batch the
 * ledger still holds (no clock, no extra save field). An entry that was trimmed away can no
 * longer be folded into, so its number may be reused safely.
 */
function batchIdFor(save: SaveData): string {
  let top = 0;
  for (const e of save.economyLedger) {
    const m = e.batch ? /^cash-(\d+)$/.exec(e.batch) : null;
    if (m) top = Math.max(top, Number(m[1]));
  }
  return `cash-${top + 1}`;
}

/** The cash on the table, clamped (null when nothing is owed or the record is odd). */
export function pendingCashOf(save: SaveData): PendingCash | null {
  const raw = save.business.pendingCash;
  if (!raw || typeof raw !== "object" || typeof raw.batch !== "string") return null;
  const payCents = whole(raw.payCents);
  const tipCents = whole(raw.tipCents);
  if (payCents + tipCents <= 0) return null;
  return {
    batch: raw.batch,
    category: raw.category,
    description: typeof raw.description === "string" ? raw.description : "",
    ...(typeof raw.tipDescription === "string" ? { tipDescription: raw.tipDescription } : {}),
    payCents,
    tipCents,
  };
}

/** Cents still on the table. */
export function pendingCashTotal(save: SaveData): number {
  const p = pendingCashOf(save);
  return p ? p.payCents + p.tipCents : 0;
}

const withPending = (save: SaveData, pendingCash: PendingCash | null): SaveData => {
  const { pendingCash: _old, ...business } = save.business;
  void _old;
  return {
    ...save,
    business: pendingCash ? { ...business, pendingCash } : business,
  } as SaveData;
};

/**
 * Leaves an order's pay (and tip) on the table. Call it on the very save that marks the
 * order served. Cash already on the table is settled first — two orders never share a batch.
 */
export function withPendingCash(
  save: SaveData,
  cash: {
    amount: number;
    tip?: number;
    category: LedgerCategory;
    description: string;
    tipDescription?: string;
  },
): SaveData {
  const base = settlePendingCash(save);
  const payCents = whole(cash.amount);
  const tipCents = whole(cash.tip ?? 0);
  if (payCents + tipCents <= 0) return base;
  return withPending(base, {
    batch: batchIdFor(base),
    category: cash.category,
    description: cash.description,
    ...(cash.tipDescription ? { tipDescription: cash.tipDescription } : {}),
    payCents,
    tipCents,
  });
}

/**
 * One swept piece: exactly its cents (never more than what is left of that kind) move
 * from the table to the wallet and into the order's ledger entry, in this one save.
 * Nothing owed, or a second sweep of the same piece's cents beyond the table: unchanged.
 */
export function collectPendingCashPiece(save: SaveData, cents: number, isTip: boolean): SaveData {
  const p = pendingCashOf(save);
  const want = whole(cents);
  if (!p || want <= 0) return save;
  const left = isTip ? p.tipCents : p.payCents;
  const amount = Math.min(want, left);
  if (amount <= 0) return save;
  const paid = accumulateLedgerEntry(
    { ...save, credits: save.credits + amount },
    p.batch,
    isTip ? "customer-tip" : p.category,
    amount,
    isTip ? (p.tipDescription ?? p.description) : p.description,
  );
  const next: PendingCash = {
    ...p,
    payCents: isTip ? p.payCents : p.payCents - amount,
    tipCents: isTip ? p.tipCents - amount : p.tipCents,
  };
  return withPending(paid, next.payCents + next.tipCents > 0 ? next : null);
}

/** Sweeps everything still on the table into the wallet (leaving the table, loading the game). */
export function settlePendingCash(save: SaveData): SaveData {
  const p = pendingCashOf(save);
  if (!p) return save.business.pendingCash === undefined ? save : withPending(save, null);
  let next = save;
  if (p.payCents > 0) next = collectPendingCashPiece(next, p.payCents, false);
  if (p.tipCents > 0) next = collectPendingCashPiece(next, p.tipCents, true);
  return next;
}
