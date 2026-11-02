/**
 * MONEY — the game's ONE currency: US dollars.
 *
 * There is exactly one wallet (`SaveData.credits`) and one ledger
 * (`SaveData.economyLedger`), shared by Campaign and Business Mode. Every
 * money value the game stores or moves is an integer number of US CENTS —
 * the money-safe representation (no floating-point drift such as
 * $215.189999). Players only ever see dollars, always through `formatUsd`.
 *
 *   - Catalog prices and fixed amounts are written in dollars with
 *     `dollars()` (e.g. `price: dollars(350)` is $350.00, stored as 35000).
 *   - Campaign's pricing formulas (recipePay, the ingredient cost
 *     registry, level rewards, EconomySettlement's internal steps) work in
 *     whole dollars, exactly as designed; their results are converted with
 *     `dollars()` at the one point where they become real money (a wallet
 *     change, a ledger entry, or a price shown to the player).
 *   - Business Mode prices were already calibrated in cents against real
 *     restaurant benchmarks (e.g. a $2.49/lb tomato is 249) and are used
 *     as-is.
 *
 * Saves written before this (save version 1) stored Campaign amounts in
 * whole units that now mean dollars; SaveManager's version-2 migration
 * converts them exactly once (see migrateMoneyToUsd).
 */

/** A money amount in integer US cents. */
export type Cents = number;

/** Dollars → the stored integer-cent amount: dollars(350) = 35000 ($350.00), dollars(2.49) = 249. */
export function dollars(amount: number): Cents {
  return Math.round(amount * 100);
}

/** The one player-facing money format: "$0.00", "$61.00", "$215.19", "$2,200.00", "−$2.33". */
export function formatUsd(cents: Cents): string {
  const text = `$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return cents < 0 ? `−${text}` : text;
}

/** Names for each power of a thousand, up to a number no wallet reaches (the Second Floor's branches grow tenfold each). */
const BIG_SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp"] as const;

/**
 * Money for the Second Floor's big numbers (the idle-game way): the plain "$61.00" format below $100,000, then "$123K",
 * "$1.23M", "$45.6B", "$7.89T" ... with three significant digits. Never used for the ledger or the wallet's own math.
 */
export function formatUsdBig(cents: Cents): string {
  const dollarsAbs = Math.abs(cents) / 100;
  if (dollarsAbs < 100_000) return formatUsd(cents);
  let tier = Math.min(BIG_SUFFIXES.length - 1, Math.floor(Math.log10(dollarsAbs) / 3));
  let value = dollarsAbs / 1000 ** tier;
  // 999.6K rounds up to 1000K: move to the next name instead.
  if (Number(value.toPrecision(3)) >= 1000 && tier < BIG_SUFFIXES.length - 1) {
    tier += 1;
    value = dollarsAbs / 1000 ** tier;
  }
  const r = Number(value.toPrecision(3));
  const shown = r >= 100 ? r.toFixed(0) : r >= 10 ? r.toFixed(1) : r.toFixed(2);
  const text = `$${shown}${BIG_SUFFIXES[tier]}`;
  return cents < 0 ? `−${text}` : text;
}

/** A signed change for rewards/ledger lines: "+$223.00", "−$350.00", "$0.00". */
export function formatUsdChange(cents: Cents): string {
  return cents > 0 ? `+${formatUsd(cents)}` : formatUsd(cents);
}
