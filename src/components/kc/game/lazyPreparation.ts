import { lazy } from "react";

/**
 * Preparation — and the Phaser engine it pulls in (~1.1 MB) — as its own
 * chunk, so a returning player's first screen (the Kitchen) doesn't wait
 * for the game engine to download and parse. `preloadPreparation()` starts
 * fetching it in the background right after first paint, so by the time
 * the player taps "Prepare" it's already there. Every importer of
 * Preparation must go through this module, or Phaser rejoins the main
 * bundle.
 */
const load = () => import("./Preparation");

let pending: ReturnType<typeof load> | null = null;

export function preloadPreparation(): void {
  pending ??= load();
}

export const Preparation = lazy(() => {
  preloadPreparation();
  return pending!.then((m) => ({ default: m.Preparation }));
});
