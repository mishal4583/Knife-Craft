/**
 * FLOOD amounts (spec 2026-11-02, "rich the idle-game way"): finishing a level sends a surge of guests to the Second Floor.
 * The free part lies on the Pickup Counter; an optional ad brings the bigger one. Both follow what the player is saving for, not
 * a fixed dollar figure, so the reward stays exciting from the first Coffee machine to the last branch. The goal is the
 * best-payback purchase the player cannot afford yet (or the dearest one when they can afford everything):
 *
 *   free = max(15 minutes of the floor's income, 5 % of the goal)
 *   ad   = max(60 minutes of the floor's income, 20 % of the goal)   (the ad pays the part above `free`)
 *
 * Needs at least one machine (the surge is the floor's own); pure and deterministic.
 */
import type { SaveData } from "../SaveManager";
import { floorGoals } from "./floorGoal";
import { floorEarnings, floorPerHour, isSecondFloorOpen, secondFloorOf } from "./secondFloor";

export const FLOOD_FREE_MINUTES = 15;
export const FLOOD_FREE_GOAL_PERCENT = 5;
export const FLOOD_AD_MINUTES = 60;
export const FLOOD_AD_GOAL_PERCENT = 20;

export type FloodAmounts = {
  /** Cents the surge adds to the Pickup Counter for free. */
  free: number;
  /** Extra cents (above `free`) a rewarded ad adds. */
  adExtra: number;
};

const NONE: FloodAmounts = { free: 0, adExtra: 0 };

export function floodAmounts(save: SaveData, reachedLevel: number, now: number): FloodAmounts {
  if (!isSecondFloorOpen(reachedLevel)) return NONE;
  const floor = secondFloorOf(save);
  if (Object.keys(floor.stations).length === 0) return NONE;
  const perHour = floorPerHour(save);
  // What the player is saving for: the best-payback purchase they cannot afford yet (a cheap step they could buy now is not the
  // goal); when everything is affordable, the dearest one.
  const funds = save.credits + floorEarnings(save, now);
  const goals = floorGoals(save, reachedLevel);
  const target =
    goals.find((g) => g.price > funds) ?? [...goals].sort((a, b) => b.price - a.price)[0];
  const goalPrice = target?.price ?? 0;
  const part = (minutes: number, percent: number) => {
    const byRate = Math.floor((perHour * minutes) / 60);
    const byGoal = Math.floor((goalPrice * percent) / 100);
    return Math.max(byRate, byGoal);
  };
  const free = part(FLOOD_FREE_MINUTES, FLOOD_FREE_GOAL_PERCENT);
  const total = Math.max(free, part(FLOOD_AD_MINUTES, FLOOD_AD_GOAL_PERCENT));
  return { free, adExtra: total - free };
}

/** Skip ahead (a rewarded "timer skip", Playgama's pattern): two hours of the floor's income. */
export const SKIP_AHEAD_HOURS = 2;
export const SKIP_AHEAD_GOAL_PERCENT = 30;

/**
 * What a rewarded "skip ahead" pays (cents): the larger of two hours of the floor's income and 30 % of the goal the player is
 * saving for. Offered only with a machine and a goal still ahead of the wallet (nothing to skip otherwise).
 */
export function skipAheadAmount(save: SaveData, reachedLevel: number, now: number): number {
  if (!isSecondFloorOpen(reachedLevel)) return 0;
  if (Object.keys(secondFloorOf(save).stations).length === 0) return 0;
  const funds = save.credits + floorEarnings(save, now);
  const target = floorGoals(save, reachedLevel).find((g) => g.price > funds);
  if (!target) return 0;
  return Math.max(
    floorPerHour(save) * SKIP_AHEAD_HOURS,
    Math.floor((target.price * SKIP_AHEAD_GOAL_PERCENT) / 100),
  );
}

/** The rewarded Rush Hour: ten minutes at x3 is two extra "ten-minute" blocks of income, paid now. */
export const RUSH_AD_MINUTES = 10;
export const RUSH_AD_GOAL_PERCENT = 10;

/**
 * What the rewarded Rush Hour pays (cents): the EXTRA a x3 rush of ten minutes would earn (2 x ten minutes of income), at least
 * 10 % of the goal the player is saving for. Paid at once through the normal ad path (one `rewarded-ad` entry); no timer.
 */
export function rushAdAmount(save: SaveData, reachedLevel: number, now: number): number {
  if (!isSecondFloorOpen(reachedLevel)) return 0;
  if (Object.keys(secondFloorOf(save).stations).length === 0) return 0;
  const funds = save.credits + floorEarnings(save, now);
  const target = floorGoals(save, reachedLevel).find((g) => g.price > funds);
  const byRate = Math.floor((floorPerHour(save) * 2 * RUSH_AD_MINUTES) / 60);
  const byGoal = Math.floor(((target?.price ?? 0) * RUSH_AD_GOAL_PERCENT) / 100);
  return Math.max(byRate, byGoal);
}
