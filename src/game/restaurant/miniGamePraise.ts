/**
 * PAIGE'S PRAISE FOR A PERFECT MINI-GAME (developer 2026-11-14: "add more appreciation from Paige when the players go back to the kitchen home
 * page after finishing a mini-game with 3 stars"). Pure rules, no clock and no random: which words she says for a three-star round of which
 * mini-game. It moves no money, stock or Hype and writes nothing to the save; the app holds the praise until the player is back on a home
 * screen (`paigeCalm`), then she says it in the same big bubble as her tips (a celebration, the green leaf).
 *
 * Only a REAL round earns it (a practice round gives and keeps nothing, so it earns no praise: nothing to farm). Every line is one short
 * sentence (MAX_LINE_CHARS) and never names a level (ui-copy-qa U1).
 */
import type { AssistantBeat, PaigePose } from "./assistant";

export type PraiseGame = "fridge-sort" | "stockroom" | "inspection" | "sauce" | "fridge-check";

export const PRAISE_STARS = 3;

/** Three or more perfect rounds in a row get the "on fire" lines. */
export const PRAISE_STREAK = 3;

export const PRAISE_LINES: Record<PraiseGame, readonly string[]> = {
  "fridge-sort": [
    "Every crate in its place. Perfect sorting!",
    "Three stars on the fridge! Nothing spoils on your watch.",
    "That fridge is a work of art. Well done!",
    "Not one piece in the wrong spot. I'm impressed!",
  ],
  stockroom: [
    "Those shelves look like a picture. Three stars!",
    "Neat, tidy and fast. The shelves love you!",
    "Perfect stocking! I could find anything blindfolded.",
    "Every product exactly where it belongs. Lovely!",
  ],
  inspection: [
    "Sharp eyes! Nothing bad got past you.",
    "A perfect inspection. The guests are safe with you!",
    "Not a single bad one missed. I'm so proud!",
    "You spotted everything. What a keen eye!",
  ],
  sauce: [
    "That sauce is perfect! Guests will love it.",
    "Smooth, bright and just right. Chef's kiss!",
    "Three stars of pure flavour. Beautiful sauce!",
    "You whisked it like a pro. Wonderful!",
  ],
  "fridge-check": [
    "Fresh and safe. You never miss a thing!",
    "A perfect Fridge Check. Nothing old stays on your shelf!",
    "Spot on, every card. The kitchen is in good hands!",
    "Spotless judgement! I'd trust you with my own lunch.",
  ],
};

/** After a perfect round that follows another one (the streak counts this one). */
export const PRAISE_STREAK_LINES: readonly string[] = [
  "Another three stars! You're on a roll.",
  "Three perfect rounds in a row! You're on fire!",
];

export type PraiseInput = {
  game: PraiseGame;
  stars: number;
  /** Perfect (3-star) real rounds in a row, THIS one included (1 = just this one). */
  streak: number;
  /** How many praises she has given so far (picks the line, so the same game does not repeat at once). */
  given: number;
};

/** The id of a praise beat (`praise:<game>:<n>`); the host and the app tell it from a tip by this prefix. */
export const PRAISE_PREFIX = "praise:";
export const isPraiseId = (id: string): boolean => id.startsWith(PRAISE_PREFIX);

/** What she says, and the pose that goes with it. */
export function praiseLine(input: PraiseInput): { text: string; pose: PaigePose } | null {
  if (input.stars < PRAISE_STARS) return null;
  const n = Math.max(0, Math.floor(input.given));
  const streak = Math.max(1, Math.floor(input.streak));
  const pose: PaigePose = n % 2 === 0 ? "cheer" : "clap";
  if (streak >= 2) {
    const pool = PRAISE_STREAK_LINES;
    // the second line is the 3-in-a-row one; longer runs keep it
    return { text: pool[streak >= PRAISE_STREAK ? 1 : 0]!, pose };
  }
  const pool = PRAISE_LINES[input.game];
  return { text: pool[n % pool.length]!, pose };
}

/** The praise as a beat for her bubble (a celebration, shown once, never written to her notebook), or null under three stars. */
export function praiseBeat(input: PraiseInput): AssistantBeat | null {
  const line = praiseLine(input);
  if (!line) return null;
  return {
    id: `${PRAISE_PREFIX}${input.game}:${Math.max(0, Math.floor(input.given))}`,
    lines: [line],
    tone: "success",
    priority: 100,
    when: () => true,
  };
}
