import { DESSERT_LADDER, tierOfLadderLevel, type DessertId } from "./dessertGallery";
import { DESSERT_RUN_FIRST_LEVEL, RUN_TIERS, type RunTier } from "./dessertRun";
import { DESSERT_RUN_SEEDS } from "./dessertSeeds";

export type DessertRunPick = {
  tier: RunTier;
  dessertId: DessertId;
  seed: number;
  /** The dessert's level on the list (1 to 50). */
  ladderLevel: number;
};

/** The campaign's last level: the list's last dessert is played here. */
export const RUN_LAST_LEVEL = 91;
/** How many deals (seeds) each dessert keeps: a different business day deals a different one. */
export const SEEDS_PER_DESSERT = 6;

/**
 * Which dessert of the list a player level plays (developer 2026-11-26, the 50-level list): Dessert Run opens at `DESSERT_RUN_FIRST_LEVEL` with the list's first dessert and reaches the 50th at the
 * campaign's last level, so the pictures climb easy to hard as the player does (the 72 levels share the 50 desserts, a few levels playing the same one; never the same one over and over).
 */
export function ladderLevelFor(level: number): number {
  const along = (level - DESSERT_RUN_FIRST_LEVEL) / (RUN_LAST_LEVEL - DESSERT_RUN_FIRST_LEVEL);
  return 1 + Math.min(49, Math.max(0, Math.round(along * 49)));
}

/**
 * Which plate a level and a business day get. The DESSERT is the list's (`ladderLevelFor`, moved on by `round`: "Next dessert" after a win goes up the list and wraps round after the 50th);
 * its difficulty is its band's tier (lanes, waiter size, hardness window: `BAND_TIERS`); the DEAL is one of the dessert's proven seeds, a different one each business day. Every seed is proven
 * by `dessert-run-qa`, so the same call is the same plate on every phone.
 */
export function dessertRunFor(level: number, day: number, round = 0): DessertRunPick {
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const ladderLevel = mod(ladderLevelFor(level) - 1 + round, 50) + 1;
  const dessertId = DESSERT_LADDER[ladderLevel - 1]!;
  const tier = RUN_TIERS[tierOfLadderLevel(ladderLevel) - 1]!;
  const seeds = DESSERT_RUN_SEEDS[`${dessertId}-${tier.id}`]!;
  const seed = seeds[mod(day - 1 + Math.imul(level, 7), seeds.length)]!;
  return { tier, dessertId, seed, ladderLevel };
}
