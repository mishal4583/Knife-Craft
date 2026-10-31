/**
 * PENDING CASH — what served orders left on the table (developer 2026-10-29: the
 * money only enters the wallet when the player sweeps it up).
 *
 * The amount still on the table is saved in `business.pendingCash`, in the SAME save
 * that marks the order paid, so closing the game never loses it. Each collected piece
 * moves exactly its cents from the table into the wallet in one save, and into
 * the pile's ONE settlement entry (and ONE tip entry) of the ledger
 * (`accumulateLedgerEntry`): the wallet always equals the signed ledger, and a pile
 * never floods the bounded ledger.
 *
 * It PILES UP (developer 2026-10-31, like an idle game): serving the next order, leaving the
 * service or loading the game never collects it. It stays on the table, saved, until the
 * player collects it (`settlePendingCash`, one tap), and the night cannot be counted or
 * closed before it is in the till. Orders of the same pay kind share one pile (one ledger
 * entry when collected); a different kind (menu guests' revenue) is its own pile in `more`.
 * No new wallet, ledger or event bus; pure, no randomness.
 */
import type { SaveData } from "../SaveManager";
import { accumulateLedgerEntry } from "./EconomyLedger";
import type { LedgerCategory } from "./ledgerTypes";

export type PendingPile = {
  /** Ties this pile's pieces to its ledger entries. */
  batch: string;
  /** The pay's ledger category (the tip is always "customer-tip"). */
  category: LedgerCategory;
  description: string;
  tipDescription?: string;
  /** Cents of the pay / the tip still on the table. */
  payCents: number;
  tipCents: number;
};

/** The cash on the table: the first pile, and the piles of any other pay kind behind it. */
export type PendingCash = PendingPile & { more?: PendingPile[] };

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/** One raw pile, clamped (null when it is odd or empty). */
function cleanPile(raw: unknown): PendingPile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<PendingPile>;
  if (typeof r.batch !== "string" || r.category === undefined) return null;
  const payCents = whole(r.payCents);
  const tipCents = whole(r.tipCents);
  if (payCents + tipCents <= 0) return null;
  return {
    batch: r.batch,
    category: r.category,
    description: typeof r.description === "string" ? r.description : "",
    ...(typeof r.tipDescription === "string" ? { tipDescription: r.tipDescription } : {}),
    payCents,
    tipCents,
  };
}

/** Every pile on the table, in order (the first is the one a swipe takes from). */
export function pendingPiles(save: SaveData): PendingPile[] {
  const raw = save.business.pendingCash;
  if (!raw || typeof raw !== "object") return [];
  const more = Array.isArray(raw.more) ? raw.more : [];
  return [raw, ...more].map(cleanPile).filter((p): p is PendingPile => p !== null);
}

/**
 * A deterministic, unique id for a new pile: one past the highest `cash-N` batch the ledger
 * still holds or a pile on the table already uses (no clock, no extra save field). An entry
 * that was trimmed away can no longer be folded into, so its number may be reused safely.
 */
function batchIdFor(save: SaveData): string {
  let top = 0;
  const see = (batch: string | undefined) => {
    const m = batch ? /^cash-(\d+)$/.exec(batch) : null;
    if (m) top = Math.max(top, Number(m[1]));
  };
  for (const e of save.economyLedger) see(e.batch);
  for (const p of pendingPiles(save)) see(p.batch);
  return `cash-${top + 1}`;
}

/** The first pile on the table (null when nothing is owed or the record is odd). */
export function pendingCashOf(save: SaveData): PendingCash | null {
  const [first, ...more] = pendingPiles(save);
  return first ? { ...first, ...(more.length ? { more } : {}) } : null;
}

/** Cents still on the table, in every pile. */
export function pendingCashTotal(save: SaveData): number {
  return pendingPiles(save).reduce((t, p) => t + p.payCents + p.tipCents, 0);
}

const withPiles = (save: SaveData, piles: readonly PendingPile[]): SaveData => {
  const { pendingCash: _old, ...business } = save.business;
  void _old;
  const [first, ...more] = piles;
  return {
    ...save,
    business: first
      ? { ...business, pendingCash: { ...first, ...(more.length ? { more } : {}) } }
      : business,
  } as SaveData;
};

/**
 * Leaves an order's pay (and tip) on the table. Call it on the very save that marks the
 * order served. The cash already there STAYS: an order of the same pay kind joins its pile,
 * another kind starts its own. Nothing is collected for the player.
 */
export function withPendingCash(
  save: SaveData,
  cash: {
    amount: number;
    tip?: number;
    category: LedgerCategory;
    description: string;
    tipDescription?: string;
    /** Kept for old callers: orders of one pay kind always share a pile now. */
    merge?: boolean;
  },
): SaveData {
  const payCents = whole(cash.amount);
  const tipCents = whole(cash.tip ?? 0);
  if (payCents + tipCents <= 0) return save;
  const piles = pendingPiles(save);
  const at = piles.findIndex((p) => p.category === cash.category);
  if (at >= 0) {
    return withPiles(
      save,
      piles.map((p, i) =>
        i === at ? { ...p, payCents: p.payCents + payCents, tipCents: p.tipCents + tipCents } : p,
      ),
    );
  }
  return withPiles(save, [
    ...piles,
    {
      batch: batchIdFor(save),
      category: cash.category,
      description: cash.description,
      ...(cash.tipDescription ? { tipDescription: cash.tipDescription } : {}),
      payCents,
      tipCents,
    },
  ]);
}

/**
 * One swept piece: exactly its cents (never more than what is left of that kind in the first
 * pile) move from the table to the wallet and into the pile's ledger entry, in this one save.
 * Nothing owed, or a second sweep of the same piece's cents beyond the table: unchanged.
 */
export function collectPendingCashPiece(save: SaveData, cents: number, isTip: boolean): SaveData {
  const [p, ...rest] = pendingPiles(save);
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
  const next: PendingPile = {
    ...p,
    payCents: isTip ? p.payCents : p.payCents - amount,
    tipCents: isTip ? p.tipCents - amount : p.tipCents,
  };
  return withPiles(paid, next.payCents + next.tipCents > 0 ? [next, ...rest] : rest);
}

/** Collects everything on the table into the wallet: the player's one-tap Collect. */
export function settlePendingCash(save: SaveData): SaveData {
  let next = save;
  // Every pass empties the first pile; the cap only guards against an odd record.
  for (let i = 0; i < 64; i++) {
    const p = pendingPiles(next)[0];
    if (!p) break;
    if (p.payCents > 0) next = collectPendingCashPiece(next, p.payCents, false);
    if (p.tipCents > 0) next = collectPendingCashPiece(next, p.tipCents, true);
  }
  return next.business.pendingCash === undefined ? next : withPiles(next, []);
}
