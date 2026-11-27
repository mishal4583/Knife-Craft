/**
 * THE RIVAL STALL. It is not a person and never pretends to be: its whole round is fixed before the round starts, from the round itself and its seed.
 * Its final score is a share (the pace's `rivalShare`) of what a fast simulated player scores on the very same customers, so a harder round asks for
 * more and no round asks for the impossible. There is no rubber-banding: nothing the player does changes the rival.
 */
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { playRound } from "./bot";
import type { RoundConfig } from "./types";

/** The fast simulated player the rival is measured against: one tap in this many milliseconds. */
export const PAR_REACTION_MS = 550;
/** The rival works this much more slowly than the fast player, so it can be seen and passed. */
export const RIVAL_PACE = 1.25;

export type RivalMoment = {
  /** When, in the round's milliseconds. */
  at: number;
  /** Its score from this moment on. */
  score: number;
  orders: number;
  /** A visible stumble: it lost a moment. */
  slip: boolean;
};

export type RivalPlan = {
  final: number;
  /** The fast player's score it was measured from. */
  par: number;
  moments: readonly RivalMoment[];
};

export function rivalPlan(round: RoundConfig, seed: number): RivalPlan {
  const run = playRound(round, PAR_REACTION_MS);
  const par = run.state.score;
  const final = Math.max(1, Math.round(par * round.pace.rivalShare));
  const rand = makeSeededRand(seed ^ 0x7269766c);
  const count = round.orders.length;
  // each order's points: the order's size, a little more or less, adding up to the final score
  const weights = round.orders.map((o) => o.items.length * (0.85 + rand() * 0.3) + 0.4);
  const total = weights.reduce((a, b) => a + b, 0);
  const slips = new Set<number>();
  while (slips.size < Math.min(round.pace.rivalSlips, Math.max(0, count - 2)))
    slips.add(1 + Math.floor(rand() * (count - 1)));
  const length = run.ms * RIVAL_PACE;
  let score = 0;
  let upTo = 0;
  let late = 0;
  const moments: RivalMoment[] = weights.map((w, i) => {
    upTo += w;
    const slip = slips.has(i);
    if (slip) late += length * 0.04;
    score = i === count - 1 ? final : Math.round((final * upTo) / total);
    const at = Math.round((length * (i + 0.75 + rand() * 0.2)) / count + late);
    return { at, score, orders: i + 1, slip };
  });
  // (a slip can never put a later order before an earlier one)
  for (let i = 1; i < moments.length; i++)
    if (moments[i]!.at <= moments[i - 1]!.at) moments[i]!.at = moments[i - 1]!.at + 500;
  return { final, par, moments };
}

/** Where the rival is at a time. */
export function rivalAt(plan: RivalPlan, ms: number): RivalMoment {
  let here: RivalMoment = { at: 0, score: 0, orders: 0, slip: false };
  for (const m of plan.moments) {
    if (m.at > ms) break;
    here = m;
  }
  return here;
}
