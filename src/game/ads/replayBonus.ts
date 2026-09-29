/**
 * REPLAY_BONUS — the one rewarded-ad feature: after REPLAYING an already
 * completed Campaign level (which normally pays nothing), the player may
 * choose to watch a YouTube rewarded ad for a small bonus.
 *
 * Source of truth = the save's ledger. A claimed bonus IS a "rewarded-ad"
 * ledger entry whose `description` is that offer's unique reward id; the
 * daily cap counts today's such entries. No extra save field, no second
 * record, no UI flag that could disagree with the wallet. (EconomyLedger
 * keeps recent rewarded-ad entries when it trims, so the cap can't be
 * reopened by a busy day.)
 *
 * Flow (App.tsx drives it; the phases below are the only states the UI shows):
 *   OFFER_SHOWN → REQUESTING_AD (button disabled; the SDK call is in flight,
 *   which covers the ad being on screen) → SDK result
 *     result !== true            → FAILED (nothing changes)
 *     true → REWARD_COMMITTING:  commitReplayBonus → verifyReplayBonusCommit
 *            → SaveManager.save → re-read the persisted save → confirm the
 *            entry is there → REWARD_COMMITTED → UI says "Reward Granted".
 *     any step fails             → FAILED (the in-memory save is left as it was)
 * "Committed" is never a UI flag: the sheet shows success only when the
 * current save's ledger contains this offer's entry (isReplayBonusClaimed).
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import type { EconomyLedgerEntry } from "../economy/ledgerTypes";
import { dollars } from "../money";
import { paidLevelReward } from "../levels/levelRewards";
import { dailyKeyFor } from "../daily/DailyOrderManager";

/** Bonus = this share of the level's own first-completion reward… */
export const REPLAY_BONUS_SHARE = 0.2;
/** …rounded to whole dollars, never below this (cents)… */
export const REPLAY_BONUS_MIN = dollars(10);
/** …and never above this (cents) — Economy V2.5: at most $200 × 3/day = $600/day from Replay Bonuses. */
export const REPLAY_BONUS_MAX = dollars(200);
/** Rewarded Replay Bonuses per calendar day (device-local day, like Today's Special). */
export const REPLAY_BONUS_DAILY_CAP = 3;

export const REWARD_ID_PREFIX = "knifecraft-replay-bonus-";

export type ReplayBonusPhase =
  "OFFER_SHOWN" | "REQUESTING_AD" | "REWARD_COMMITTING" | "REWARD_COMMITTED" | "FAILED";

export type ReplayBonusFailure =
  | "adUnavailable"
  | "notRewarded"
  | "adFailed"
  | "busy"
  | "alreadyClaimed"
  | "dailyCapReached"
  | "commitMismatch"
  | "saveFailed";

/** The bonus for replaying `level`, in cents: 20% of its paid first-completion reward (levelRewards.ts), whole dollars, min $10, max $200. */
export function replayBonusAmount(level: Pick<LevelDefinition, "id" | "reward">): number {
  const share = paidLevelReward(level) * REPLAY_BONUS_SHARE;
  return Math.min(REPLAY_BONUS_MAX, Math.max(REPLAY_BONUS_MIN, Math.round(share / 100) * 100));
}

/** A fresh, unguessable id for one offer. Contains no user data — only the level id and a random UUID. */
export function newReplayBonusRewardId(levelId: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `${REWARD_ID_PREFIX}${levelId}-${uuid}`;
}

function rewardEntries(save: SaveData): EconomyLedgerEntry[] {
  return save.economyLedger.filter((e) => e.category === "rewarded-ad");
}

/** Has this exact offer's reward been committed to the save? (The only "claimed" signal.) */
export function isReplayBonusClaimed(save: SaveData, rewardId: string): boolean {
  return rewardEntries(save).some((e) => e.description === rewardId);
}

export function replayBonusesClaimedToday(save: SaveData, now: Date): number {
  const today = dailyKeyFor(now);
  return rewardEntries(save).filter((e) => dailyKeyFor(new Date(e.timestamp)) === today).length;
}

export function replayBonusesLeftToday(save: SaveData, now: Date): number {
  return Math.max(0, REPLAY_BONUS_DAILY_CAP - replayBonusesClaimedToday(save, now));
}

export type ReplayBonusOffer = { levelId: string; rewardId: string; amount: number };

/**
 * The offer for a just-finished replay, or null when there is nothing to
 * offer (not a replay, daily cap reached, or rewarded ads unavailable).
 */
export function replayBonusOfferFor(
  save: SaveData,
  level: LevelDefinition,
  wasReplay: boolean,
  adsAvailable: boolean,
  now: Date,
): ReplayBonusOffer | null {
  if (!wasReplay || !adsAvailable) return null;
  if (replayBonusesLeftToday(save, now) === 0) return null;
  return {
    levelId: level.id,
    rewardId: newReplayBonusRewardId(level.id),
    amount: replayBonusAmount(level),
  };
}

export type CommitResult =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "alreadyClaimed" | "dailyCapReached" | "invalidAmount" };

/**
 * Pure: credits the bonus and records its ledger entry in ONE new save.
 * Idempotent by reward id — committing the same offer twice returns
 * "alreadyClaimed" and changes nothing.
 */
export function commitReplayBonus(
  save: SaveData,
  offer: ReplayBonusOffer,
  now: Date,
): CommitResult {
  if (isReplayBonusClaimed(save, offer.rewardId)) return { ok: false, reason: "alreadyClaimed" };
  if (replayBonusesLeftToday(save, now) === 0) return { ok: false, reason: "dailyCapReached" };
  if (!Number.isInteger(offer.amount) || offer.amount <= 0) {
    return { ok: false, reason: "invalidAmount" };
  }
  const credited = { ...save, credits: save.credits + offer.amount };
  return {
    ok: true,
    save: appendLedgerEntry(credited, "rewarded-ad", offer.amount, offer.rewardId),
  };
}

/** Step D: the new save really contains exactly this reward — wallet delta and exactly one matching ledger entry. */
export function verifyReplayBonusCommit(
  before: SaveData,
  after: SaveData,
  offer: ReplayBonusOffer,
): boolean {
  const matching = rewardEntries(after).filter((e) => e.description === offer.rewardId);
  return (
    after.credits === before.credits + offer.amount &&
    matching.length === 1 &&
    matching[0]!.amount === offer.amount &&
    !isReplayBonusClaimed(before, offer.rewardId)
  );
}
