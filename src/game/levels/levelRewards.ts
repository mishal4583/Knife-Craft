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
 * instead of ~$400k with nothing left to buy. Early levels keep 100% so a
 * new player can afford the first knives and boards on time; Level 250
 * keeps 100% and also pays the one-time Family Legacy
 * (progression/milestoneRewards.ts). Already-paid rewards are never
 * recalculated — this only decides what a NEW completion pays.
 */
import type { LevelDefinition } from "./levelTypes";
import { dollars } from "../money";

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
export function levelRewardPercent(level: Pick<LevelDefinition, "id">): number {
  const n = levelNumberOf(level);
  return LEVEL_REWARD_SCHEDULE.find((b) => n >= b.from && n <= b.to)?.percent ?? 100;
}

/**
 * The completion reward `level` pays on first completion, in wallet cents:
 * stored reward × its band's percent, rounded to whole dollars (the stored
 * rewards are whole dollars, and so is every reward a player sees).
 */
export function paidLevelReward(level: Pick<LevelDefinition, "id" | "reward">): number {
  const wholeDollars = Math.round((level.reward.coins * levelRewardPercent(level)) / 100);
  return dollars(Math.max(0, wholeDollars));
}
