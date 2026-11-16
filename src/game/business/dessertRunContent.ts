import { DESSERTS_BY_TIER, type DessertId } from "./dessertGallery";
import { runTierForLevel, type RunTier } from "./dessertRun";
import { DESSERT_RUN_SEEDS } from "./dessertSeeds";

export type DessertRunPick = { tier: RunTier; dessertId: DessertId; seed: number };

/**
 * Which plate a level and a business day get (developer 2026-11-16: a fixed gallery by tier, never the
 * menu's dish of the day). `round` moves to the next plate after a win. Every seed is proven by
 * `dessert-run-qa`, so the same call is the same plate on every phone.
 */
export function dessertRunFor(level: number, day: number, round = 0): DessertRunPick {
  const tier = runTierForLevel(level);
  const desserts = DESSERTS_BY_TIER[tier.id];
  const step = Math.imul(level, 31) + day - 1 + round;
  const dessertId = desserts[((step % desserts.length) + desserts.length) % desserts.length]!;
  const seeds = DESSERT_RUN_SEEDS[`${dessertId}-${tier.id}`]!;
  const seed =
    seeds[((Math.floor(step / desserts.length) % seeds.length) + seeds.length) % seeds.length]!;
  return { tier, dessertId, seed };
}
