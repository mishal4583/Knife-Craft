/**
 * CASH_BURST — Phase 2 (B): the physical bills and coins a customer's
 * payment drops on the counter, which the player sweeps into the wallet.
 *
 * Presentation over money that is ALREADY in the wallet. App credits the
 * order (and any tip) and writes its ledger entries in one save the moment
 * Serve is tapped; nothing here, and nothing in CashVacuum.tsx, ever
 * credits, records or saves anything. The pieces only stand for that
 * payment: their cents add up to it exactly (cashPieces), sweeping one up
 * only moves the wallet counter on screen toward the real balance, and
 * leaving the screen with cash still on the counter loses nothing.
 */
export const CASH = {
  /** Pieces for a payment: more for bigger ones, within these bounds (so a huge payment can't flood the screen). */
  MIN_PIECES: 4,
  MAX_PIECES: 14,
  /** How close (px) a swipe must pass to a piece's edge to pick it up — generous on purpose. */
  HIT_RADIUS_PX: 34,
  /** A collected piece's flight to the wallet. */
  FLY_MS: 420,
  /** Auto-collect: the pause before it starts, then one piece every AUTO_STEP_MS. */
  AUTO_DELAY_MS: 500,
  AUTO_STEP_MS: 70,
  /** The wallet counter's roll toward its new value. */
  COUNTER_MS: 260,
} as const;

export type CashPiece = {
  id: number;
  /** The cents this piece stands for. All of a payment's pieces add up to it exactly. */
  cents: number;
  kind: "bill" | "coin";
  /** Part of the tip (drawn gold), not of the order pay. */
  tip: boolean;
  /** Where it lands on the counter, in % of the tray. */
  x: number;
  y: number;
  /** Degrees. */
  rot: number;
};

/** How many pieces a payment of `cents` shows. */
export function cashPieceCount(cents: number): number {
  const dollars = Math.max(0, cents) / 100;
  return Math.min(
    CASH.MAX_PIECES,
    Math.max(CASH.MIN_PIECES, 3 + Math.floor(Math.log2(dollars + 1))),
  );
}

/** Splits `cents` into `n` whole-cent shares that add up to it exactly (the first ones get the leftover cents). */
function split(cents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * The pieces for a payment of `payCents` order pay plus `tipCents` tip.
 * Deterministic (the same payment always lands the same way), laid out on
 * a golden-angle spiral so they spread over the tray without stacking.
 * Every piece is worth at least a cent; a payment of 0 has no pieces.
 */
export function cashPieces(payCents: number, tipCents: number): CashPiece[] {
  const pay = Math.max(0, Math.round(payCents));
  const tip = Math.max(0, Math.round(tipCents));
  const total = pay + tip;
  if (total <= 0) return [];
  const n = Math.min(cashPieceCount(total), total);
  const tipN =
    tip > 0 ? (pay > 0 ? Math.min(n - 1, Math.max(1, Math.round((n * tip) / total))) : n) : 0;
  const payN = n - tipN;
  const shares = [
    ...split(pay, payN).map((cents) => ({ cents, tip: false })),
    ...split(tip, tipN).map((cents) => ({ cents, tip: true })),
  ];
  return shares.map((s, i) => {
    const angle = i * 2.39996;
    const r = 0.18 + 0.82 * Math.sqrt((i + 0.5) / n);
    return {
      id: i,
      cents: s.cents,
      kind: s.tip || i % 3 !== 2 ? "bill" : "coin",
      tip: s.tip,
      x: 50 + Math.cos(angle) * r * 38,
      y: 50 + Math.sin(angle) * r * 30,
      rot: ((i * 37) % 50) - 25,
    };
  });
}

/** The money still on the counter: what hasn't been swept up yet. */
export function cashRemaining(pieces: readonly CashPiece[], collected: readonly boolean[]): number {
  return pieces.reduce((sum, p, i) => (collected[i] ? sum : sum + p.cents), 0);
}

/**
 * Auto-collect, for the session only (no save field — the brief allows a
 * non-persistent option when a saved one would need a new field). With
 * the game's Reduced Motion on, collection is always automatic.
 */
let autoCollect = false;
export function autoCollectOn(): boolean {
  return autoCollect;
}
export function setAutoCollect(on: boolean): void {
  autoCollect = on;
}

/** The player's Reduced Motion setting (App mirrors it onto <html>) or the system's. */
export function reducedMotionOn(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("kc-reduced-motion") ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}
