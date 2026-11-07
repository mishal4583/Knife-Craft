/**
 * Curated campaign selection.
 *
 * The campaign is the 91-level plan in `campaignPlan.ts` (developer 2026-11-07: fewer, richer levels; chicken, steak and salmon in the
 * first 16 levels; docs/planning/CAMPAIGN-V2-PLAN-2026-11-07.md). Three numberings meet here:
 *  - "old": the former 250-level catalog (`SOURCE_LEVELS` in levelDefinitions.ts). Items such as knives, boards, chefs, staff and menu
 *    unlocks were authored against these numbers and still are; `remapCampaignThreshold` maps one to the new level that now holds that
 *    content.
 *  - "previous": the 148-level campaign that shipped until 2026-11-07 (`CAMPAIGN_148_SOURCE_LEVEL_NUMBERS`). The plan's `from` lists
 *    use these numbers, and the save migration reads them.
 *  - "new": the 91 levels the player plays now.
 */
import { CAMPAIGN_PLAN_CHAPTERS, PLAN_TEMPLATE_FROM } from "./campaignPlan";

/** The 148-level campaign that shipped until 2026-11-07: previous level number n is the old 250-level source number at index n-1. */
export const CAMPAIGN_148_SOURCE_LEVEL_NUMBERS: readonly number[] = [
  // Start with Garden Prep: a first order with two complementary ingredients.
  // The standalone tomato and cucumber tutorials are removed.
  4, 8, 11, 12, 13, 14, 15, 10,
  // Italian learning progresses into real dishes, branching and service.
  16, 18, 20, 17, 29, 24, 26, 28, 30, 27,
  // Selected from the remainder of the 250-level catalog after the quality pass.
  // 2026-10-15 review: old 61, 91, 112 and 152 repeated another retained level's
  // exact recipes; old 68, 90, 119 and 157 (new dishes / a mixed pool) replace them.
  32,33,34,35,36,37,39,40,41,43,44,45,46,50,
  51,52,54,57,58,60,68,62,64,67,70,71,74,76,
  81,82,84,85,87,89,90,94,98,100,
  101,102,104,105,106,107,108,109,110,111,119,113,114,115,116,118,120,
  121,123,124,125,127,128,130,132,133,135,139,140,142,143,144,145,146,149,150,
  157,153,154,156,158,160,161,162,163,165,166,170,171,172,173,175,178,181,183,184,185,188,
  201,202,203,204,206,208,209,210,211,212,213,214,216,218,219,220,
  221,222,223,224,226,228,230,233,238,240,
  241,242,243,244,245,246,248,250,
];

/** The plan, flattened: every new level with its chapter. */
export const CAMPAIGN_PLAN_LEVELS = CAMPAIGN_PLAN_CHAPTERS.flatMap((chapter, chapterIndex) =>
  chapter.levels.map((level) => ({ ...level, chapterIndex })),
);

/** For each NEW level (index n-1), the old 250-level number of the level whose definition it inherits (rewards, unlock items, story). */
export const CAMPAIGN_150_SOURCE_LEVEL_NUMBERS: readonly number[] = CAMPAIGN_PLAN_LEVELS.map(
  (level) => CAMPAIGN_148_SOURCE_LEVEL_NUMBERS[(level.from[0] ?? PLAN_TEMPLATE_FROM) - 1]!,
);

/**
 * Previous (148-level) level number → the new level that now holds its content. A level the plan cuts (its dishes live on in the
 * Menu) maps to the new level of the next surviving previous level, so progress and thresholds never fall back.
 */
export const CAMPAIGN_148_TO_NEW: readonly number[] = (() => {
  const direct = new Map<number, number>();
  CAMPAIGN_PLAN_LEVELS.forEach((level, i) => level.from.forEach((n) => direct.set(n, i + 1)));
  const out: number[] = [];
  for (let n = 1; n <= CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.length; n += 1) {
    let m = n;
    while (!direct.has(m) && m <= CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.length) m += 1;
    out.push(direct.get(m) ?? CAMPAIGN_PLAN_LEVELS.length);
  }
  return out;
})();

/**
 * The chapters as the player meets them, strictly in play order. Each entry is the chapter's first level. (Order changed 2026-11-07:
 * the old Japanese chapter is now "The Meat & Fish Counter", chapter 3; Chinese precedes the two Encore chapters.)
 */
export const CAMPAIGN_150_CHAPTERS: readonly { firstLevel: number; id: string; title: string }[] = (() => {
  let first = 1;
  return CAMPAIGN_PLAN_CHAPTERS.map((chapter) => {
    const entry = { firstLevel: first, id: chapter.id, title: chapter.title };
    first += chapter.levels.length;
    return entry;
  });
})();

/** The display chapter (1–13) of new campaign level `n`. */
export function campaignChapterOf(n: number): number {
  let chapter = 1;
  CAMPAIGN_150_CHAPTERS.forEach((c, i) => {
    if (n >= c.firstLevel) chapter = i + 1;
  });
  return chapter;
}

export const CAMPAIGN_150_CHAPTER_TITLES: Record<number, string> = Object.fromEntries(
  CAMPAIGN_150_CHAPTERS.map((c, i) => [i + 1, c.title]),
);

export const CAMPAIGN_150_CHAPTER_IDS: Record<number, string> = Object.fromEntries(
  CAMPAIGN_150_CHAPTERS.map((c, i) => [i + 1, c.id]),
);

/**
 * The CUISINE chapter (1–12) that sets a level's pay ramp (recipePay's chapter multiplier): the display chapter, capped at 12, so
 * pay now rises with the play order (the old Japanese chapter used to pay at ramp 6 although it is played third).
 */
export function campaignCuisineChapterOf(n: number): number {
  return Math.min(12, campaignChapterOf(n));
}

/** Maps a retained old source level to its new level number (any old level whose content the plan keeps, moves or merges). */
export const CAMPAIGN_150_OLD_TO_NEW: Readonly<Record<number, number>> = Object.freeze(
  Object.fromEntries(CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.map((oldLevel, index) => [oldLevel, CAMPAIGN_148_TO_NEW[index]!])),
);

/** The previous level (1–148) that an old threshold falls on: the first retained old level at or after it (149 = past the end). */
function previousLevelAtOrAfter(oldLevel: number): number {
  // The list is not sorted (the opening levels come from the middle of the old catalog): take the smallest old number at or after it.
  let best = Infinity;
  for (const n of CAMPAIGN_148_SOURCE_LEVEL_NUMBERS) if (n >= oldLevel && n < best) best = n;
  return best === Infinity ? CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.length + 1 : CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.indexOf(best) + 1;
}

/**
 * Where an old (250-level) threshold lands in the new campaign by CONTENT: the new level that now holds the first retained old level at
 * or after it. Use it for things tied to a dish or a chapter (a cuisine opening with its chapter, the ribeye with its Butcher Block).
 * It is not monotone: the Meat & Fish Counter holds the old Japanese chapter, so old 101-120 land on new levels 6-22.
 */
export function remapCampaignContent(oldLevel: number): number {
  const p = previousLevelAtOrAfter(oldLevel);
  return p > CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.length ? CAMPAIGN_PLAN_LEVELS.length : CAMPAIGN_148_TO_NEW[p - 1]!;
}

/** Previous levels 1-56 (everything before the old Japanese chapter) keep their play order in the new campaign. */
const PREVIOUS_BEFORE_MOVED_BLOCK = 56;

/**
 * For those levels: the content level, made monotone in the OLD number (the opening levels were picked out of order from the old
 * catalog: old 15 is played before old 10, but a threshold at 15 must never come before one at 10, e.g. the Santoku before the Paring).
 * Used by the price ladders (knives, boards, kitchen tiers) through `remapCampaignOrdered`.
 */
const PROGRESS_BY_OLD_NUMBER: (oldNumber: number) => number = (() => {
  const firstPart = CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.slice(0, PREVIOUS_BEFORE_MOVED_BLOCK)
    .map((n, i) => ({ n, level: CAMPAIGN_148_TO_NEW[i]! }))
    .sort((a, b) => a.n - b.n);
  const best = new Map<number, number>();
  let top = 0;
  for (const e of firstPart) {
    top = Math.max(top, e.level);
    best.set(e.n, top);
  }
  return (n) => best.get(n) ?? top;
})();

/**
 * Where an old (250-level) threshold lands in the new campaign by PROGRESS: monotone, so systems, the menu curve, the day, the staff
 * and the supplies keep their order. Up to old 100 it is the content mapping; after that the remaining new levels are spread evenly
 * over the remaining previous ones (the Meat & Fish Counter moved ahead, so old 101-120 are not "early" for these thresholds).
 */
export function remapCampaignThreshold(oldLevel: number): number {
  const p = previousLevelAtOrAfter(oldLevel);
  const last = CAMPAIGN_PLAN_LEVELS.length;
  if (p > CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.length) return last;
  if (p <= PREVIOUS_BEFORE_MOVED_BLOCK) return CAMPAIGN_148_TO_NEW[p - 1]!;
  const base = CAMPAIGN_148_TO_NEW[PREVIOUS_BEFORE_MOVED_BLOCK - 1]!;
  const span = CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.length - PREVIOUS_BEFORE_MOVED_BLOCK;
  return Math.min(last, base + Math.ceil(((p - PREVIOUS_BEFORE_MOVED_BLOCK) * (last - base)) / span));
}

/** `remapCampaignThreshold`, made monotone in the old number: for catalogs whose prices rise with their unlock level. */
export function remapCampaignOrdered(oldLevel: number): number {
  const p = previousLevelAtOrAfter(oldLevel);
  if (p > PREVIOUS_BEFORE_MOVED_BLOCK) return remapCampaignThreshold(oldLevel);
  return PROGRESS_BY_OLD_NUMBER(CAMPAIGN_148_SOURCE_LEVEL_NUMBERS[p - 1]!);
}

/** First curated campaign level that teaches/uses each cutting technique (checked against the plan by level-system-v2-qa). */
export const CAMPAIGN_150_TECHNIQUE_FIRST_USE_LEVEL: Readonly<Record<string, number>> = {
  slice: 1,
  peel: 2,
  halve: 2,
  smash: 3,
  dice: 4,
  chop: 4,
  rings: 8,
  radial: 11,
  julienne: 14,
  rockMince: 24,
  chiffonade: 24,
};

/** First curated campaign level that uses each ingredient in a recipe (checked against the plan by level-system-v2-qa). */
export const CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL: Readonly<Record<string, number>> = {
  tomato: 1,
  cucumber: 1,
  potato: 2,
  carrot: 2,
  bread: 3,
  garlic: 3,
  basil: 4,
  mozzarella: 4,
  mushroom: 5,
  baguette: 5,
  chicken: 6,
  zucchini: 7,
  onion: 8,
  eggplant: 9,
  beetroot: 11,
  orange: 11,
  pepper: 12,
  corn: 12,
  avocado: 13,
  lime: 13,
  fennel: 14,
  lemon: 14,
  steak: 15,
  salmon: 16,
  kiwi: 17,
  watermelon: 17,
  cabbage: 18,
  radish: 19,
  asparagus: 19,
  ginger: 20,
  celery: 23,
  spinach: 26,
  tofu: 26,
  butter: 28,
  apple: 29,
  parsley: 30,
  mango: 33,
  chilli: 33,
  pumpkin: 34,
  coconut: 34,
  peapod: 35,
  cauliflower: 37,
  pineapple: 42,
  sweetpotato: 43,
  cilantro: 44,
  broccoli: 47,
  springonion: 47,
  artichoke: 50,
  lettuce: 50,
  turnip: 58,
  peach: 59,
  cheddar: 59,
  pomegranate: 63,
  grapes: 64,
  strawberry: 64,
  greenbean: 71,
  pear: 78,
};
