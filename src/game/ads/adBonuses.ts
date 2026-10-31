/**
 * AD_BONUSES — the optional rewarded-ad cash bonuses (developer 2026-10-18,
 * "build 1–5", Playgama monetization guide): each is a clear offer the
 * player chooses, says what it gives before the ad, and pays only after the
 * Bridge reported `rewarded`. None is ever needed to progress.
 *
 *  1. floating_cash — a bag of cash drifting over the Kitchen / map.
 *  2. level_double  — Level Complete: +50% of a first clear's reward.
 *  3. shortfall     — a purchase a little out of reach: the missing dollars.
 *  4. floor_double  — Second Floor: collect the stations' income ×2.
 *  5. daily_gift    — the day's welcome gift (free), doubled by an ad.
 *  6. welcome_back  — back after 30+ minutes: a few hours of earnings, ONLY for an ad
 *                     (developer 2026-10-31; not a doubling, there is no free part).
 *
 * Source of truth = the save's ledger, as for the Replay Bonus: a claimed
 * bonus IS one "rewarded-ad" entry whose description is the offer's reward
 * id (`knifecraft-adbonus-<kind>-<uuid>`); today's count per kind is read
 * from those entries (EconomyLedger keeps recent rewarded-ad entries when it
 * trims). The free daily gift is one "daily-reward" entry described
 * `knifecraft-daily-gift-<day>`. No new save field, no second record.
 *
 * The amounts follow the level's own pay, with small caps, so a player who
 * takes every offer ends the campaign at most ~20% richer
 * (scripts/ad-bonuses-qa.mts measures it); a player who never watches is
 * unchanged.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import type { EconomyLedgerEntry } from "../economy/ledgerTypes";
import { dollars } from "../money";
import { CURATED_FINAL_LEVEL, curatedRewardAt, paidLevelReward } from "../levels/levelRewards";
import { dailyKeyFor } from "../daily/DailyOrderManager";
import { streakRewardOnTake } from "../daily/giftStreak";

export type AdBonusKind =
  "floating_cash" | "level_double" | "shortfall" | "floor_double" | "daily_gift" | "welcome_back";

/** Offers a day (device-local day, like the Replay Bonus) per kind. */
export const AD_BONUS_DAILY_CAP: Record<AdBonusKind, number> = {
  floating_cash: 6,
  level_double: 3,
  shortfall: 2,
  floor_double: 2,
  daily_gift: 1,
  welcome_back: 1,
};

/** Nothing before the Market opens (Level 3): the first levels stay a plain tutorial. */
export const AD_BONUSES_FROM_LEVEL = 3;

/* ── amounts (cents, whole dollars) ── */

/** Floating cash: 10% of the current level's pay, $5–$50. */
export const FLOATING_CASH_SHARE = 0.1;
export const FLOATING_CASH_MIN = dollars(5);
export const FLOATING_CASH_MAX = dollars(50);
/** Level Complete: +50% of the first clear's reward, at most $250. */
export const LEVEL_DOUBLE_SHARE = 0.5;
export const LEVEL_DOUBLE_MAX = dollars(250);
/** Short by: offered when the gap is at most 25% of the price and at most $150. */
export const SHORTFALL_PRICE_SHARE = 0.25;
export const SHORTFALL_MAX = dollars(150);
/** Second Floor ×2: a collection of at least $50; the extra is at most $250. */
export const FLOOR_DOUBLE_MIN = dollars(50);
export const FLOOR_DOUBLE_MAX = dollars(250);
/** Daily gift: 10% of the current level's pay, $20–$60 (the ad doubles it). */
export const DAILY_GIFT_SHARE = 0.1;
export const DAILY_GIFT_MIN = dollars(20);
export const DAILY_GIFT_MAX = dollars(60);

/**
 * Welcome back (developer 2026-10-31: "when the player returns he gets the money of only a few hours,
 * but to get it he needs to watch the ad, not twice the amount"). Away at least 30 minutes, the
 * offer covers the time away up to 3 hours: 15% of the level's pay for the full 3 hours, $10–$90,
 * once a day. There is no free part, and a player who never watches is unchanged.
 */
export const WELCOME_BACK_MIN_AWAY_MS = 30 * 60_000;
export const WELCOME_BACK_MAX_AWAY_MS = 3 * 60 * 60_000;
export const WELCOME_BACK_SHARE = 0.15;
export const WELCOME_BACK_MIN = dollars(10);
export const WELCOME_BACK_MAX = dollars(90);

const wholeDollars = (cents: number) => Math.round(cents / 100) * 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A level's first-clear pay on the curated curve (Level 150's finale excluded). */
function levelPay(levelNumber: number): number {
  const n = clamp(Math.floor(levelNumber), 1, CURATED_FINAL_LEVEL - 1);
  return dollars(curatedRewardAt(n));
}

export function floatingCashAmount(levelNumber: number): number {
  return clamp(
    wholeDollars(levelPay(levelNumber) * FLOATING_CASH_SHARE),
    FLOATING_CASH_MIN,
    FLOATING_CASH_MAX,
  );
}

/** The +50% for a first clear (0 when the level paid nothing). */
export function levelDoubleAmount(
  level: Pick<LevelDefinition, "id" | "reward" | "campaignRewardBasisLevel">,
): number {
  const reward = paidLevelReward(level);
  if (reward <= 0) return 0;
  return Math.min(LEVEL_DOUBLE_MAX, wholeDollars(reward * LEVEL_DOUBLE_SHARE));
}

/** The dollars a purchase is short by, rounded up — or 0 when it isn't a small gap. */
export function shortfallAmount(price: number, credits: number): number {
  const gap = price - credits;
  if (!(price > 0) || gap <= 0) return 0;
  const rounded = Math.ceil(gap / 100) * 100;
  if (gap > price * SHORTFALL_PRICE_SHARE || rounded > SHORTFALL_MAX) return 0;
  return rounded;
}

/** The extra for collecting the Second Floor ×2 — or 0 for a small collection. */
export function floorDoubleAmount(collected: number): number {
  if (collected < FLOOR_DOUBLE_MIN) return 0;
  return Math.min(FLOOR_DOUBLE_MAX, collected);
}

export function dailyGiftAmount(levelNumber: number): number {
  return clamp(
    wholeDollars(levelPay(levelNumber) * DAILY_GIFT_SHARE),
    DAILY_GIFT_MIN,
    DAILY_GIFT_MAX,
  );
}

/** When the player last did anything with money (the newest ledger entry), or null for a new game. */
export function lastActivityAt(save: SaveData): number | null {
  let last: number | null = null;
  for (const e of save.economyLedger) if (last === null || e.timestamp > last) last = e.timestamp;
  return last;
}

/** How long the player was away at `now` (ms), or null when there is nothing to measure. */
export function awayMsSince(save: SaveData, now: number): number | null {
  const last = lastActivityAt(save);
  return last === null || now < last ? null : now - last;
}

/** The hours that pay: the time away, never more than 3 h. */
export const welcomeBackPaidMs = (awayMs: number) => Math.min(awayMs, WELCOME_BACK_MAX_AWAY_MS);

/** What the ad pays on return: 0 when the player was away less than 30 minutes. */
export function welcomeBackAmount(levelNumber: number, awayMs: number | null): number {
  if (awayMs === null || !(awayMs >= WELCOME_BACK_MIN_AWAY_MS)) return 0;
  const share = welcomeBackPaidMs(awayMs) / WELCOME_BACK_MAX_AWAY_MS;
  return clamp(
    wholeDollars(levelPay(levelNumber) * WELCOME_BACK_SHARE * share),
    WELCOME_BACK_MIN,
    WELCOME_BACK_MAX,
  );
}

/** "45 min" or "2 h": the time the offer pays for (shown before the ad). */
export function welcomeBackPaidText(awayMs: number): string {
  const minutes = Math.round(welcomeBackPaidMs(awayMs) / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`;
}

/* ── claims, read from the ledger ── */

export const AD_BONUS_ID_PREFIX = "knifecraft-adbonus-";
export const DAILY_GIFT_ID_PREFIX = "knifecraft-daily-gift-";

const kindOf = (e: EconomyLedgerEntry): AdBonusKind | null => {
  if (e.category !== "rewarded-ad" || !e.description?.startsWith(AD_BONUS_ID_PREFIX)) return null;
  const rest = e.description.slice(AD_BONUS_ID_PREFIX.length);
  const kind = (Object.keys(AD_BONUS_DAILY_CAP) as AdBonusKind[]).find((k) =>
    rest.startsWith(`${k}-`),
  );
  return kind ?? null;
};

export function adBonusesClaimedToday(save: SaveData, kind: AdBonusKind, now: Date): number {
  const today = dailyKeyFor(now);
  return save.economyLedger.filter(
    (e) => kindOf(e) === kind && dailyKeyFor(new Date(e.timestamp)) === today,
  ).length;
}

export function adBonusesLeftToday(save: SaveData, kind: AdBonusKind, now: Date): number {
  return Math.max(0, AD_BONUS_DAILY_CAP[kind] - adBonusesClaimedToday(save, kind, now));
}

export function isAdBonusClaimed(save: SaveData, rewardId: string): boolean {
  return save.economyLedger.some((e) => e.category === "rewarded-ad" && e.description === rewardId);
}

/** A fresh reward id for one offer: the kind and a random UUID, no user data. */
export function newAdBonusRewardId(kind: AdBonusKind): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `${AD_BONUS_ID_PREFIX}${kind}-${uuid}`;
}

export type AdBonusOffer = {
  kind: AdBonusKind;
  rewardId: string;
  /** What the ad pays, in cents. */
  amount: number;
};

/** An offer of `kind` for `amount`, or null (nothing to give, or today's cap is reached). */
export function adBonusOffer(
  save: SaveData,
  kind: AdBonusKind,
  amount: number,
  now: Date,
): AdBonusOffer | null {
  if (!Number.isInteger(amount) || amount <= 0) return null;
  if (adBonusesLeftToday(save, kind, now) === 0) return null;
  return { kind, rewardId: newAdBonusRewardId(kind), amount };
}

export type AdBonusCommit =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "alreadyClaimed" | "dailyCapReached" | "invalidAmount" };

/**
 * Pure: credits the bonus and records its ONE ledger entry in one new save.
 * Idempotent by reward id; refuses past today's cap. Call it only after the
 * Bridge reported `rewarded`, with the latest save.
 */
export function commitAdBonus(save: SaveData, offer: AdBonusOffer, now: Date): AdBonusCommit {
  if (isAdBonusClaimed(save, offer.rewardId)) return { ok: false, reason: "alreadyClaimed" };
  if (adBonusesLeftToday(save, offer.kind, now) === 0)
    return { ok: false, reason: "dailyCapReached" };
  if (
    !Number.isInteger(offer.amount) ||
    offer.amount <= 0 ||
    !offer.rewardId.startsWith(`${AD_BONUS_ID_PREFIX}${offer.kind}-`)
  ) {
    return { ok: false, reason: "invalidAmount" };
  }
  const credited = { ...save, credits: save.credits + offer.amount };
  return {
    ok: true,
    save: appendLedgerEntry(credited, "rewarded-ad", offer.amount, offer.rewardId),
  };
}

/* ── the free daily gift ── */

export function dailyGiftId(now: Date): string {
  return `${DAILY_GIFT_ID_PREFIX}${dailyKeyFor(now)}`;
}

export function dailyGiftTakenToday(save: SaveData, now: Date): boolean {
  const id = dailyGiftId(now);
  return save.economyLedger.some((e) => e.category === "daily-reward" && e.description === id);
}

/** Today's gift, or 0 when it was taken or the restaurant isn't open yet. */
export function dailyGiftDue(save: SaveData, levelNumber: number, now: Date): number {
  if (levelNumber < AD_BONUSES_FROM_LEVEL || dailyGiftTakenToday(save, now)) return 0;
  return dailyGiftAmount(levelNumber);
}

/**
 * Pure: takes today's free gift (one "daily-reward" entry). Once a day.
 * Phase 5 (B): when today's gift is the gift streak's Day 3 or Day 7
 * (daily/giftStreak.ts), its fixed reward is paid in the SAME save as its own
 * "daily-reward" entry; `amount` stays the gift alone, `streak` the reward.
 */
export function takeDailyGift(
  save: SaveData,
  levelNumber: number,
  now: Date,
):
  | { ok: true; save: SaveData; amount: number; streak: { day: number; amount: number } | null }
  | { ok: false } {
  const amount = dailyGiftDue(save, levelNumber, now);
  if (amount <= 0) return { ok: false };
  const reward = streakRewardOnTake(save, now);
  const credited = { ...save, credits: save.credits + amount };
  let next = appendLedgerEntry(credited, "daily-reward", amount, dailyGiftId(now));
  if (reward) {
    next = appendLedgerEntry(
      { ...next, credits: next.credits + reward.amount },
      "daily-reward",
      reward.amount,
      reward.id,
    );
  }
  return {
    ok: true,
    amount,
    save: next,
    streak: reward ? { day: reward.day, amount: reward.amount } : null,
  };
}
