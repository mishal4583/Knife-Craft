/**
 * Curated 150-level campaign source selection.
 * Source numbers refer to the former 250-level catalog; LEVELS renumbers the
 * selected services sequentially while keeping their recipe identities.
 */
export const CAMPAIGN_150_SOURCE_LEVEL_NUMBERS: readonly number[] = [
  // Required opening: first slice, training, first paid mixed order, potato
  // chain, then the recognizable dishes and a composed-salad checkpoint.
  1, 2, 4, 8, 11, 12, 13, 14, 15, 10,
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

/**
 * The chapters as the player meets them, strictly in play order (2026-10-15
 * review: the encore services used to rejoin their cuisine's earlier chapter,
 * so the chapter number went backwards from Level 107). Each entry is the
 * chapter's first level.
 */
export const CAMPAIGN_150_CHAPTERS: readonly { firstLevel: number; id: string; title: string }[] = [
  { firstLevel: 1, id: "opening-the-restaurant", title: "Opening the Restaurant" },
  { firstLevel: 5, id: "italian-kitchen-service", title: "Italian Kitchen & Service" },
  { firstLevel: 21, id: "french-bistro-precision", title: "French Bistro & Precision" },
  { firstLevel: 35, id: "indian-kitchen-service", title: "Indian Kitchen & Service" },
  { firstLevel: 46, id: "mediterranean-latin", title: "Mediterranean & Latin" },
  { firstLevel: 59, id: "japanese-kitchen", title: "Japanese Kitchen" },
  { firstLevel: 76, id: "chinese-wok", title: "Chinese Wok" },
  { firstLevel: 88, id: "thai-southeast-asian", title: "Thai & Southeast Asian" },
  { firstLevel: 101, id: "korean-kitchen", title: "Korean Kitchen" },
  { firstLevel: 107, id: "italian-french-encore", title: "Italian & French Encore" },
  { firstLevel: 117, id: "mediterranean-latin-encore", title: "Mediterranean & Latin Encore" },
  { firstLevel: 133, id: "east-asian-fusion", title: "East Asian Fusion" },
  { firstLevel: 143, id: "the-grand-finale", title: "The Grand Finale" },
];

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
 * Source chapter → CUISINE chapter (1–12 of the first curated layout). Encore
 * services keep their cuisine here. Pay (recipePay's chapter ramp) and the
 * cuisine identity read this, so the display renumbering above moves no money
 * (economy re-plan pending, developer 2026-10-15).
 */
export const CAMPAIGN_150_CHAPTER_BY_SOURCE_CHAPTER: Record<number, number> = {
  1: 1,
  2: 2, 3: 2, 18: 2,
  4: 3, 5: 3, 19: 3,
  6: 4, 7: 4, 20: 4,
  8: 5, 21: 5,
  9: 6, 10: 6, 22: 6,
  11: 7, 12: 7,
  13: 8, 14: 8, 24: 8,
  15: 9, 16: 9,
  17: 10,
  23: 11,
  25: 12,
};

/** Maps a retained old source level to its sequential new level number. */
export const CAMPAIGN_150_OLD_TO_NEW: Readonly<Record<number, number>> = Object.freeze(
  Object.fromEntries(CAMPAIGN_150_SOURCE_LEVEL_NUMBERS.map((oldLevel, index) => [oldLevel, index + 1])),
);

/** First retained new level at or after an old progression threshold. */
export function remapCampaignThreshold(oldLevel: number): number {
  const exact = CAMPAIGN_150_OLD_TO_NEW[oldLevel];
  if (exact !== undefined) return exact;
  const retained = CAMPAIGN_150_SOURCE_LEVEL_NUMBERS
    .filter((n) => n >= oldLevel)
    .reduce<number | undefined>((best, n) => best === undefined || n < best ? n : best, undefined);
  return retained === undefined
    ? CAMPAIGN_150_SOURCE_LEVEL_NUMBERS.length
    : CAMPAIGN_150_OLD_TO_NEW[retained]!;
}

/** First curated campaign level that teaches/uses each cutting technique. */
export const CAMPAIGN_150_TECHNIQUE_FIRST_USE_LEVEL: Readonly<Record<string, number>> = {
  slice: 1,
  dice: 2,
  peel: 2,
  halve: 4,
  smash: 5,
  chop: 6,
  rings: 11,
  radial: 16,
  julienne: 20,
  rockMince: 23,
  chiffonade: 24,
};

/** First curated campaign level that uses each ingredient in a recipe. */
export const CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL: Readonly<Record<string, number>> = {
  tomato: 1,
  cucumber: 2,
  carrot: 2,
  garlic: 2,
  potato: 4,
  bread: 5,
  basil: 6,
  mushroom: 7,
  zucchini: 8,
  mozzarella: 9,
  onion: 11,
  beetroot: 16,
  orange: 16,
  eggplant: 16,
  pepper: 20,
  fennel: 20,
  lemon: 20,
  celery: 21,
  spinach: 26,
  asparagus: 28,
  butter: 32,
  apple: 33,
  parsley: 34,
  ginger: 36,
  mango: 38,
  chilli: 38,
  pumpkin: 39,
  peapod: 40,
  cauliflower: 41,
  baguette: 47,
  avocado: 47,
  corn: 49,
  lime: 50,
  pineapple: 51,
  sweetpotato: 52,
  cilantro: 53,
  chicken: 59,
  cabbage: 62,
  steak: 63,
  salmon: 66,
  radish: 67,
  tofu: 70,
  broccoli: 76,
  springonion: 77,
  coconut: 89,
  greenbean: 90,
  pear: 104,
  artichoke: 107,
  lettuce: 108,
  turnip: 112,
  peach: 114,
  cheddar: 114,
  kiwi: 117,
  watermelon: 117,
  pomegranate: 120,
  grapes: 125,
  strawberry: 125,
};
