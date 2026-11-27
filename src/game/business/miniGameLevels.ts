import { CRATE_FIRST_LEVEL, crateTierAt } from "./crateDispatch";
import { DESSERT_RUN_FIRST_LEVEL } from "./dessertRun";
import { RUN_LAST_LEVEL, ladderLevelFor } from "./dessertRunContent";

/**
 * Choosing a level in the free-play mini-games (developer 2026-11-26: "there is no option to choose the levels for replaying or viewing previous levels"). Dessert Run and Unload the Van give no
 * reward, so a choice is only which round to play: every level up to the player's own can be chosen and replayed; later ones show what opens them. Nothing is saved. Pure.
 */

/** The desserts of the list a player level has reached: 1 up to this number. */
export const dessertsOpenAt = (playerLevel: number): number => ladderLevelFor(playerLevel);

/** The first campaign level at which dessert `ladder` (1 to 50) is open. */
export function levelOpeningDessert(ladder: number): number {
  for (let level = DESSERT_RUN_FIRST_LEVEL; level < RUN_LAST_LEVEL; level++)
    if (ladderLevelFor(level) >= ladder) return level;
  return RUN_LAST_LEVEL;
}

/** Every level Unload the Van has a board for, in order. */
export const VAN_LEVELS: readonly number[] = Array.from(
  { length: RUN_LAST_LEVEL - CRATE_FIRST_LEVEL + 1 },
  (_, i) => CRATE_FIRST_LEVEL + i,
);

/** What a van level's board is like, in a few words. */
export function vanLevelLine(level: number): string {
  const tier = crateTierAt(level);
  const [least, most] = tier.bricks;
  const blocked = tier.trapped ? ` · ${tier.trapped} blocked` : "";
  return `${tier.cols}×${tier.rows} · ${least === most ? least : `${least}-${most}`} crates${blocked}`;
}
