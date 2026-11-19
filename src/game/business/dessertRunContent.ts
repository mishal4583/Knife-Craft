import { DESSERTS_BY_TIER, type DessertId } from "./dessertGallery";
import { DESSERT_RUN_FIRST_LEVEL, RUN_TIERS, runTierForLevel, type RunTier } from "./dessertRun";
import { DESSERT_RUN_SEEDS } from "./dessertSeeds";

export type DessertRunPick = { tier: RunTier; dessertId: DessertId; seed: number };

/** The campaign's last level: the top tier's ramp ends here. */
export const RUN_LAST_LEVEL = 91;
/** How far a day or a round may move a level's plate along the ramp (seeds either side). */
export const RAMP_JITTER = 4;

/** The first and the last player level a tier is played at. Tier 1 starts where the game opens. */
export function tierLevels(tier: RunTier): { first: number; last: number } {
  const next = RUN_TIERS.find((t) => t.id === tier.id + 1);
  return {
    first: tier.id === 1 ? DESSERT_RUN_FIRST_LEVEL : tier.fromLevel,
    last: next ? next.fromLevel - 1 : RUN_LAST_LEVEL,
  };
}

/**
 * Which plate a level and a business day get (developer 2026-11-16: a fixed gallery by tier, never the
 * menu's dish of the day). `round` moves to the next plate after a win.
 *
 * Developer 2026-11-19 ("increase the quality of the levels"): every plate is RATED by a careful player (`ratePlate`) and the seeds of a
 * tier are stored easiest first, inside the tier's own difficulty window, so a tier gets harder as the player's LEVEL climbs it: the first level
 * of a tier gets the gentle plates, its last level the hardest of that tier. The day and the round only move the plate a few seeds either
 * way (`RAMP_JITTER`) and swap the picture. Every seed is proven by `dessert-run-qa`, so the same call is the same plate on every phone.
 */
export function dessertRunFor(level: number, day: number, round = 0): DessertRunPick {
  const tier = runTierForLevel(level);
  const desserts = DESSERTS_BY_TIER[tier.id];
  const step = Math.imul(level, 31) + day - 1 + round;
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const dessertId = desserts[mod(step, desserts.length)]!;
  const seeds = DESSERT_RUN_SEEDS[`${dessertId}-${tier.id}`]!;
  const { first, last } = tierLevels(tier);
  const progress = Math.min(1, Math.max(0, (level - first) / Math.max(1, last - first)));
  const along = Math.round(progress * (seeds.length - 1));
  const jitter = mod(Math.floor(step / desserts.length), RAMP_JITTER * 2 + 1) - RAMP_JITTER;
  const index = Math.min(seeds.length - 1, Math.max(0, along + jitter));
  return { tier, dessertId, seed: seeds[index]! };
}
