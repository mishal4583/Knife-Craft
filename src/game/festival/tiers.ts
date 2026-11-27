/**
 * THE FESTIVALS' RAMP (developer 2026-11-27: "start from 5 or something, then gradually increase the toughness of the game (reduce the cooking time and
 * all and add more customers if possible, don't let players wait too much time)"). One row an event, 1 to 15: more customers and more of them at once,
 * shorter cooking and a shorter window before food spoils, a faster rival. Cooking is short at every tier and an empty counter fills at once, so the
 * player is never left waiting. Every tier is proved winnable by a simulated player (scripts/festival-rival-qa.mts).
 */
import type { Pace } from "./types";

const row = (
  tier: number,
  orders: number,
  atOnce: number,
  patienceS: number,
  arriveS: number,
  cookSpeed: number,
  readyS: number,
  overS: number,
  grillSlots: number,
  plates: number,
  rivalShare: number,
  rivalSlips: number,
): Pace => ({
  tier,
  orders,
  atOnce,
  patienceMs: patienceS * 1000,
  arriveMs: arriveS * 1000,
  cookSpeed,
  readyMs: readyS * 1000,
  overMs: overS * 1000,
  grillSlots,
  plates,
  rivalShare,
  rivalSlips,
  accuracyGoal: 0.9,
});

export const PACES: readonly Pace[] = [
  row(1, 5, 2, 32, 3.5, 1.0, 8, 4.5, 2, 2, 0.52, 2),
  row(2, 6, 2, 31, 3.4, 0.97, 7.5, 4.2, 2, 2, 0.55, 2),
  row(3, 7, 3, 36, 3.4, 0.94, 7.2, 4, 3, 2, 0.56, 2),
  row(4, 8, 3, 36, 3.3, 0.92, 7, 4, 3, 3, 0.57, 2),
  row(5, 9, 3, 36, 3.2, 0.89, 6.8, 3.8, 3, 3, 0.58, 2),
  row(6, 10, 3, 36, 3.1, 0.86, 6.6, 3.6, 3, 3, 0.59, 2),
  row(7, 11, 3, 35, 3.0, 0.83, 6.4, 3.5, 4, 3, 0.6, 1),
  row(8, 12, 4, 44, 3.2, 0.81, 6.4, 3.5, 4, 3, 0.61, 1),
  row(9, 13, 4, 43, 3.1, 0.79, 6.2, 3.4, 4, 4, 0.62, 1),
  row(10, 14, 4, 42, 3.0, 0.77, 6, 3.3, 4, 4, 0.63, 1),
  row(11, 15, 4, 41, 2.9, 0.76, 5.8, 3.2, 4, 4, 0.64, 1),
  row(12, 16, 4, 40, 2.8, 0.74, 5.6, 3.1, 4, 4, 0.65, 1),
  row(13, 17, 4, 39, 2.7, 0.72, 5.4, 3, 4, 4, 0.66, 1),
  row(14, 18, 4, 38, 2.6, 0.7, 5.2, 2.9, 4, 4, 0.67, 0),
  row(15, 20, 4, 37, 2.5, 0.68, 5, 2.8, 4, 4, 0.68, 0),
];

/**
 * THE STAGES' RAMP (RULE CHANGE, developer 2026-11-28: "keep only 3 stages ... try to increase customers as players progress stages and festivals").
 * CUSTOMERS: every stage has 3 more than the one before it, and every festival has 1 more than the festival before at the same stage (Burger 5, 8, 11;
 * the Championship 19, 22, 25). A new festival starts below the last one's final, since its food is new. WAITING AT ONCE never falls from a festival to
 * the next at the same stage: Burger 2, 3, 3; four at once comes in later festivals (in the simulation it, more than the count, is what makes a round
 * hard). The timing (cooking, patience, spoiling, the rival) comes from the table above: the first stage a row an event, the other two three rows on.
 */
const STAGE_ROW = [1, 4, 4] as const;
const AT_ONCE = [
  { to: 1, stages: [2, 3, 3] },
  { to: 4, stages: [3, 3, 3] },
  { to: 7, stages: [3, 3, 4] },
  { to: 11, stages: [3, 4, 4] },
  { to: 15, stages: [4, 4, 4] },
] as const;
/** Burners and plates (the same number of each). */
const STATIONS = [
  { to: 1, stages: [2, 3, 4] },
  { to: 4, stages: [3, 3, 4] },
  { to: 15, stages: [4, 4, 4] },
] as const;

/** The pace of a stage (1-3) of an event number (1-15), both clamped. */
export function stagePace(event: number, stage: number): Pace {
  const e = Math.min(15, Math.max(1, Math.floor(event) || 1));
  const s = Math.min(3, Math.max(1, Math.floor(stage) || 1)) - 1;
  const timing = PACES[Math.min(PACES.length, STAGE_ROW[s]! + e - 1) - 1]!;
  const stations = STATIONS.find((row) => e <= row.to)!.stages[s]!;
  return {
    ...timing,
    orders: 5 + (e - 1) + 3 * s,
    atOnce: AT_ONCE.find((row) => e <= row.to)!.stages[s]!,
    grillSlots: stations,
    plates: stations,
  };
}

/** A row of the table (1-15), clamped. */
export const paceFor = (tier: number): Pace =>
  PACES[Math.min(PACES.length, Math.max(1, Math.floor(tier) || 1)) - 1]!;
