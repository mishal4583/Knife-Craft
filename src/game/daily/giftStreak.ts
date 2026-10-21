import type { SaveData } from "../SaveManager";
import type { EconomyLedgerEntry } from "../economy/ledgerTypes";
import { dollars } from "../money";
import { dailyKeyFor, previousDayKey } from "./DailyOrderManager";

/**
 * GIFT_STREAK — Phase 5 (B, developer 2026-10-21): the daily gift's streak
 * and its Day 3 / Day 7 rewards. Developer decisions (2026-10-21): the
 * streak counts days in a row the free daily gift was TAKEN (not Today's
 * Special — that keeps its own `dailyOrder.streak`, untouched), and the
 * rewards are a fixed $100 on Day 3 and $300 on Day 7.
 *
 * NO SAVE FIELD. Everything is read from the ledger the gift already writes:
 * - a taken gift IS one "daily-reward" entry described
 *   `knifecraft-daily-gift-<YYYY-MM-DD>` (ads/adBonuses.ts);
 * - a streak reward IS one "daily-reward" entry described
 *   `knifecraft-gift-streak-day<3|7>-<YYYY-MM-DD>` (the day it was paid).
 * EconomyLedger keeps both kinds for RETAIN_DAYS (they used to be kept 36 h;
 * at most one gift and one reward a day, so the window stays tiny), which is
 * more than a cycle needs.
 *
 * THE CYCLE. Days 1–7: the gift taken on consecutive device-local days
 * (dailyKeyFor — the same day the gift itself uses). The day a Day 7 reward
 * is paid closes the cycle; the next day's gift is Day 1 again. Missing a day
 * just starts a new streak at Day 1 with the next gift — nothing earned is
 * taken back, no gameplay is locked, nothing is charged.
 *
 * ONCE. A reward is paid inside the same save as the gift that reaches its
 * day (takeDailyGift), and only when no reward entry for that day exists;
 * the gift itself can only be taken once a day. So refreshing, double taps
 * or reopening the Kitchen can never pay one twice.
 */
export const GIFT_STREAK = {
  CYCLE: 7,
  REWARDS: { 3: dollars(100), 7: dollars(300) } as Record<number, number>,
  /** How long the ledger keeps gift and streak entries (EconomyLedger's trim). */
  RETAIN_DAYS: 9,
} as const;

export const GIFT_ID_PREFIX = "knifecraft-daily-gift-";
export const STREAK_ID_PREFIX = "knifecraft-gift-streak-day";

function isGift(e: EconomyLedgerEntry): boolean {
  return e.category === "daily-reward" && !!e.description?.startsWith(GIFT_ID_PREFIX);
}
function isStreakReward(e: EconomyLedgerEntry): boolean {
  return e.category === "daily-reward" && !!e.description?.startsWith(STREAK_ID_PREFIX);
}

/** The days a gift was taken (YYYY-MM-DD). */
export function giftDays(ledger: readonly EconomyLedgerEntry[]): Set<string> {
  return new Set(ledger.filter(isGift).map((e) => e.description!.slice(GIFT_ID_PREFIX.length)));
}

/** The streak rewards paid: day number and the day it was paid. */
export function streakRewardsPaid(
  ledger: readonly EconomyLedgerEntry[],
): { day: number; on: string }[] {
  return ledger.filter(isStreakReward).flatMap((e) => {
    const m = /^knifecraft-gift-streak-day(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(e.description!);
    return m ? [{ day: Number(m[1]), on: m[2]! }] : [];
  });
}

export type GiftStreakState = {
  today: string;
  takenToday: boolean;
  /** Days of the current cycle already done (0–7), today included when taken. */
  done: number;
  /** The cycle day today's gift is (or was) — 1–7. */
  todayDay: number;
  /** A streak was going and a day was missed: today starts over at Day 1. */
  restarted: boolean;
  /** The next reward ahead (or reached today): its day and amount. */
  next: { day: number; amount: number } | null;
};

/** Where the gift streak stands on `now`'s day — pure, from the ledger alone. */
export function giftStreakState(save: Pick<SaveData, "economyLedger">, now: Date): GiftStreakState {
  const days = giftDays(save.economyLedger);
  const closed = new Set(
    streakRewardsPaid(save.economyLedger)
      .filter((r) => r.day === GIFT_STREAK.CYCLE)
      .map((r) => r.on),
  );
  const today = dailyKeyFor(now);
  const yesterday = previousDayKey(today);
  const takenToday = days.has(today);
  const anchor = takenToday ? today : yesterday;
  // Count back from the anchor: consecutive gift days, stopping at a day that
  // closed an earlier cycle (a Day 7 paid on it) — at most one cycle.
  let run = 0;
  let d = anchor;
  while (run < GIFT_STREAK.CYCLE && days.has(d)) {
    if (run > 0 && closed.has(d)) break;
    run += 1;
    d = previousDayKey(d);
  }
  const cycleClosedAtAnchor = closed.has(anchor);
  let done: number;
  let todayDay: number;
  if (takenToday) {
    done = run;
    todayDay = run;
  } else {
    // Today's gift continues yesterday's run (or starts Day 1 after a closed
    // cycle, a full one, or a gap).
    done = cycleClosedAtAnchor || run >= GIFT_STREAK.CYCLE ? 0 : run;
    todayDay = done + 1;
  }
  const hadEarlier = [...days].some((k) => k < yesterday);
  const restarted = !takenToday && run === 0 && hadEarlier;
  // Taken today: the next reward is a later day (today's, if any, was just paid).
  const from = takenToday ? todayDay + 1 : todayDay;
  const upcoming = Object.keys(GIFT_STREAK.REWARDS)
    .map(Number)
    .sort((a, b) => a - b)
    .find((n) => n >= from);
  return {
    today,
    takenToday,
    done,
    todayDay,
    restarted,
    next: upcoming ? { day: upcoming, amount: GIFT_STREAK.REWARDS[upcoming]! } : null,
  };
}

/**
 * The streak reward that taking today's gift pays (or null): when today's
 * gift is the cycle's Day 3 or Day 7 and no reward has been paid for today.
 * Call BEFORE the gift is recorded.
 */
export function streakRewardOnTake(
  save: Pick<SaveData, "economyLedger">,
  now: Date,
): { day: number; amount: number; id: string } | null {
  const s = giftStreakState(save, now);
  if (s.takenToday) return null;
  const amount = GIFT_STREAK.REWARDS[s.todayDay];
  if (!amount) return null;
  const id = `${STREAK_ID_PREFIX}${s.todayDay}-${s.today}`;
  if (save.economyLedger.some((e) => e.category === "daily-reward" && e.description === id))
    return null;
  return { day: s.todayDay, amount, id };
}
