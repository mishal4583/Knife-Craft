import type { IngredientId } from "../definitions";
import type { AudioId } from "./audioFiles";

/**
 * Knife on a wooden board, one family of RECORDED cuts per kind of food (developer 2026-11-22: "realistic cutting sounds ... different for different
 * ingredients"). The files `cut-<family><n>` are built by scripts/make-audio-assets.py from Freesound CC0 recordings (docs/AUDIO-CREDITS.md).
 * A "chop" family is single knife-and-board hits (the recording carries its own thud); a "stroke" family is the blade drawn through the food, so the board
 * is sounded separately when the blade lands (`boardtap`). "dense" (potato, pumpkin, coconut) keeps the first recordings: the pumpkin cuts.
 */
export type CutFamily =
  | "crunch"
  | "juicy"
  | "leaf"
  | "bulb"
  | "bread"
  | "melon"
  | "citrus"
  | "mushroom"
  | "cheese"
  | "meat"
  | "dense";

export const CUT_FILES: Record<CutFamily, readonly AudioId[]> = {
  crunch: ["cut-crunch1", "cut-crunch2", "cut-crunch3", "cut-crunch4"],
  juicy: ["cut-juicy1", "cut-juicy2", "cut-juicy3", "cut-juicy4"],
  leaf: ["cut-leaf1", "cut-leaf2", "cut-leaf3"],
  bulb: ["cut-bulb1", "cut-bulb2", "cut-bulb3", "cut-bulb4"],
  bread: ["cut-bread1", "cut-bread2", "cut-bread3", "cut-bread4"],
  melon: ["cut-melon1", "cut-melon2"],
  citrus: ["cut-citrus1", "cut-citrus2"],
  mushroom: ["cut-mushroom1", "cut-mushroom2", "cut-mushroom3", "cut-mushroom4"],
  cheese: ["cut-cheese1", "cut-cheese2"],
  meat: ["cut-meat1", "cut-meat2"],
  dense: ["slice1", "slice2", "slice3"],
};

/** The families whose recording is a blade drawn through the food: the board is heard when the blade lands. */
export const STROKE_FAMILIES: ReadonlySet<CutFamily> = new Set<CutFamily>([
  "bread",
  "melon",
  "citrus",
  "cheese",
  "meat",
  "dense",
]);

const OF: Record<CutFamily, readonly IngredientId[]> = {
  crunch: [
    "carrot", "cucumber", "celery", "radish", "turnip", "beetroot", "sweetpotato", "apple", "pear", "asparagus",
    "greenbean", "peapod", "corn", "fennel", "zucchini", "pepper", "chilli", "broccoli", "cauliflower", "artichoke",
  ],
  juicy: ["tomato", "strawberry", "peach", "mango", "kiwi", "pomegranate", "grapes"],
  leaf: ["lettuce", "cabbage", "spinach", "basil", "parsley", "cilantro", "springonion"],
  bulb: ["onion", "garlic", "ginger"],
  bread: ["bread", "baguette"],
  melon: ["watermelon", "pineapple"],
  citrus: ["orange", "lemon", "lime"],
  mushroom: ["mushroom", "tofu", "eggplant", "avocado"],
  cheese: ["mozzarella", "cheddar", "butter"],
  meat: ["chicken", "steak", "salmon"],
  dense: ["potato", "pumpkin", "coconut"],
};

/** Which family of cut sounds an ingredient uses. */
export const CUT_FAMILY: Record<string, CutFamily> = Object.fromEntries(
  (Object.entries(OF) as [CutFamily, readonly IngredientId[]][]).flatMap(([fam, ids]) =>
    ids.map((id) => [id, fam] as const),
  ),
);
