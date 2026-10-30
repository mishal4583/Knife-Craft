/**
 * LEVEL REWARDS — Economy V2.5. The ONE rule that turns a level's stored
 * `reward.coins` (levelDefinitions.ts, untouched) into the completion
 * reward the player is actually paid, in wallet cents. Every place that
 * pays or shows a level's reward goes through `paidLevelReward`: first
 * completion (LevelManager.completeLevel), the Kitchen/Journal/Preparation
 * displays, Restaurant Progress, Endless Service and the Replay Bonus — so
 * the "+$X" a player sees is always exactly what they receive.
 *
 * Why a schedule instead of new level data: the campaign's dish revenue
 * and item prices stay as they are; only the flat completion reward tapers
 * as the campaign goes on, which (with paid Restaurant Development and the
 * milestone rewards) lands a completionist at ~$100k–$120k after Level 250
 * instead of ~$400k with nothing left to buy. (The curated 150-level
 * campaign uses `curatedLevelReward` below instead of these bands.) Early levels keep 100% so a
 * new player can afford the first knives and boards on time; Level 250
 * keeps 100% and also pays the one-time Family Legacy
 * (progression/milestoneRewards.ts). Already-paid rewards are never
 * recalculated — this only decides what a NEW completion pays.
 */
import type { LevelDefinition } from "./levelTypes";
import { dollars } from "../money";
import { CAMPAIGN_150_SOURCE_LEVEL_NUMBERS } from "./campaignSelection";

/** Inclusive level-number bands and the share of the stored reward paid for them. */
export const LEVEL_REWARD_SCHEDULE: ReadonlyArray<{ from: number; to: number; percent: number }> = [
  { from: 1, to: 20, percent: 100 },
  { from: 21, to: 40, percent: 90 },
  { from: 41, to: 60, percent: 75 },
  { from: 61, to: 80, percent: 60 },
  { from: 81, to: 100, percent: 50 },
  { from: 101, to: 120, percent: 40 },
  { from: 121, to: 160, percent: 30 },
  { from: 161, to: 200, percent: 20 },
  { from: 201, to: 249, percent: 15 },
  { from: 250, to: 250, percent: 100 },
];

function levelNumberOf(level: Pick<LevelDefinition, "id">): number {
  const match = /-(\d+)$/.exec(level.id);
  return match ? Number(match[1]) : 1;
}

/** The share (0–100) of the stored reward that `level` pays. */
export function levelRewardPercent(level: Pick<LevelDefinition, "id" | "campaignRewardBasisLevel">): number {
  const n = level.campaignRewardBasisLevel ?? levelNumberOf(level);
  return LEVEL_REWARD_SCHEDULE.find((b) => n >= b.from && n <= b.to)?.percent ?? 100;
}

/**
 * The completion reward `level` pays on first completion, in wallet cents:
 * stored reward × its band's percent, rounded to whole dollars (the stored
 * rewards are whole dollars, and so is every reward a player sees).
 */
export function paidLevelReward(level: Pick<LevelDefinition, "id" | "reward" | "campaignRewardBasisLevel">): number {
  // The curated 150-level campaign (developer 2026-10-16): one smooth curve by the
  // NEW level number, instead of the old 250-level bands that zig-zagged.
  if (level.campaignRewardBasisLevel !== undefined) return curatedLevelReward(level);
  const wholeDollars = Math.round((level.reward.coins * levelRewardPercent(level)) / 100);
  return dollars(Math.max(0, wholeDollars));
}

/** The curated campaign's last level: it keeps its stored finale reward. */
export const CURATED_FINAL_LEVEL = CAMPAIGN_150_SOURCE_LEVEL_NUMBERS.length;
/**
 * First-clear reward curve for the curated campaign (developer 2026-10-30, re-planned): the player
 * earns fast while the first goals are in sight — $50 at Level 1, then `CURATED_REWARD_STEP_EARLY`
 * more each level up to the knee, and a gentler `CURATED_REWARD_STEP_LATE` after it. This is what
 * makes the first kitchen tier reachable around Level 40 and puts the completionist well above $150k.
 * ONE function (`curatedRewardAt`) — level pay and the ad bonuses both read it.
 */
export const CURATED_REWARD_BASE = 50;
export const CURATED_REWARD_KNEE = 40;
export const CURATED_REWARD_STEP_EARLY = 40;
export const CURATED_REWARD_STEP_LATE = 6;

/** The curated pay (whole dollars) for level `n`, before the finale rule. */
export function curatedRewardAt(n: number): number {
  const early = Math.min(n, CURATED_REWARD_KNEE) - 1;
  const late = Math.max(0, n - CURATED_REWARD_KNEE);
  return Math.round(
    CURATED_REWARD_BASE + CURATED_REWARD_STEP_EARLY * early + CURATED_REWARD_STEP_LATE * late,
  );
}

/**
 * Economy plan 2026-10-16: `round(50 + 3.1 × (n − 1))` whole dollars, rising
 * every level (L1 $50, L75 $279); a level that pays nothing stays $0, and
 * the final campaign level keeps its stored finale reward
 * finale. The total stays where it was (~$46.6k vs $46.3k before), so this only removes the
 * zig-zag the old bands caused on the renumbered levels.
 */
function curatedLevelReward(level: Pick<LevelDefinition, "id" | "reward">): number {
  if (level.reward.coins <= 0) return 0;
  const n = levelNumberOf(level);
  if (n >= CURATED_FINAL_LEVEL) return dollars(Math.max(0, Math.round(level.reward.coins)));
  return dollars(curatedRewardAt(n));
}
