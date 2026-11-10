/**
 * THE LEVEL-END TEASER (developer 2026-11-10, plan docs/planning/FIRST-20-LEVELS-ENGAGEMENT-PLAN-2026-11-10.md §5): the last plate of each of the
 * first 20 levels ends with one line about what the NEXT level brings, so the player has a reason to open it. Pure text, no money, no state.
 * `scripts/level-teaser-qa.mts` checks the lines against the schedule (config/earlyLevels.ts, the mini-games' first levels), so a moved unlock
 * cannot leave a teaser that promises the wrong thing.
 */

/** Index = the level just finished (1-based); the line says what the next level brings. */
const NEXT_UP: Readonly<Record<number, string>> = {
  1: "Next: carrots, and peeling potatoes",
  2: "Next: garlic bread and a daily gift",
  3: "Next: caprese, and your first cleaning night",
  4: "Next: mushrooms, and the menu opens!",
  5: "Next: your first chicken!",
  6: "Next: garden plates and the Sauce Station!",
  7: "Next: onion rings and the frying pans",
  8: "Next: eggplant, and delivery checks",
  9: "Next: minestrone and the fridge check",
  10: "Next: beetroot, orange and the Second Floor!",
  11: "Next: peppers, corn and dishwashing",
  12: "Next: Italian Service Night",
  13: "Next: julienne, your fanciest cut yet",
  14: "Next: your first steak!",
  15: "Next: your first salmon!",
  16: "Next: kiwi and watermelon peels",
  17: "Next: steak service",
  18: "Next: the salmon bistro",
  19: "Next: the Meat & Fish Night finale!",
  20: "Next: one chicken, two tables",
};

export const TEASER_LAST_LEVEL = 20;

/** The teaser for the level just finished, or null after Level 20. */
export function levelTeaser(finishedLevel: number): string | null {
  return NEXT_UP[finishedLevel] ?? null;
}
