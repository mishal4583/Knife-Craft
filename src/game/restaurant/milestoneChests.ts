/**
 * MILESTONE CHESTS (developer 2026-11-10, "do the best plan"; docs/planning/FIRST-20-LEVELS-ENGAGEMENT-PLAN-2026-11-10.md §5): the first time
 * Level 5, 10, 15 and 20 is finished, a chest opens with a Congratulations card: a gift of Hype (the Second Floor's Rush meter; the same Hype the
 * mini-games give) and Paige's words. A ten-minute reward between the small ones.
 *
 * NEVER money, stock or the ledger (so the frozen economy baseline cannot move). No new save field: it opens on a level's FIRST completion only
 * (`isFirstCompletion`), so the level record itself is the memory. Pure: the app adds the Hype with `addHype` and shows the card.
 */
import type { Celebration } from "./celebrations";

export type Chest = { level: number; hype: number; title: string; paige: string };

export const CHESTS: readonly Chest[] = [
  {
    level: 5,
    hype: 15,
    title: "The menu is open!",
    paige: "Your own menu! This is the start of something big.",
  },
  {
    level: 10,
    hype: 25,
    title: "Ten services done!",
    paige: "Word is spreading. The Second Floor is next!",
  },
  {
    level: 15,
    hype: 30,
    title: "Halfway to the finale!",
    paige: "Steak on the menu. You're a real chef now!",
  },
  {
    level: 20,
    hype: 40,
    title: "Chapter finale!",
    paige: "Twenty levels. I'm so proud of you. There is so much more ahead!",
  },
];

export const chestAt = (level: number): Chest | null =>
  CHESTS.find((c) => c.level === level) ?? null;

/** The Congratulations card for an opened chest; `extra` lines (a ranking climb, popularity) are appended so none is lost. */
export function chestCelebration(chest: Chest, extra: readonly string[] = []): Celebration {
  return {
    kind: "chest",
    emoji: "🎁",
    title: chest.title,
    lines: [`⚡ +${chest.hype} Hype`, ...extra],
    paige: chest.paige,
    pose: "cheer",
  };
}
