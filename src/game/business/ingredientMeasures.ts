/**
 * INGREDIENT_MEASURES — what one item of each ingredient really weighs, and
 * how much of it one plate really uses (developer 2026-10-08: "in 1 lb there
 * will be more than 3 tomatoes, right? Fix it for every ingredient").
 *
 * Before this, every prepared ingredient used ONE WHOLE purchase unit per
 * technique step: a sliced tomato took 1 lb of tomato, and an onion that was
 * peeled, halved and sliced took 3 lb. Now:
 *
 *  - `pieceLb`: the weight of one item as the Market sells it and the
 *    cutting board shows it (a medium tomato ≈ 0.3 lb, so 1 lb ≈ 3
 *    tomatoes). Used for "≈ N tomatoes" and for kg/lb conversions of the
 *    items sold by the piece (a loaf, a bunch).
 *  - `serving`: how much ONE prepared ingredient on one plate uses, in the
 *    ingredient's purchase unit (lb, or the piece: loaf / baguette / bunch).
 *    A tomato that is diced uses one tomato (0.3 lb); a whole pumpkin or
 *    watermelon is never one plate, so those use a realistic plate's share.
 *  - `noun` / `plural`: what one item is called ("tomato" / "tomatoes",
 *    "clove" of garlic, "head" of lettuce, "bunch" of basil).
 *
 * Weights are typical U.S. retail sizes (USDA FoodData Central "medium"
 * portions, rounded); servings are a home-plate portion of that item. They
 * are data, never money: the Market's prices stay per lb / per piece
 * (businessPricing.ts). Recipe stock (restaurant/recipeRequirements.ts) is
 * one `serving` per PHYSICAL item prepared — the same instance rule the
 * cutting scene and Campaign COGS use (EconomySettlement.ingredientInstancesFor),
 * so peel → halve → slice of one onion is one onion.
 */
import type { IngredientId } from "../definitions";

export type IngredientMeasure = {
  /** Weight of one whole item, lb (for a piece-sold item: one loaf / baguette / bunch). */
  pieceLb: number;
  /** One plate's use of one prepared item, in the purchase unit (lb, or pieces). */
  serving: number;
  noun: string;
  plural: string;
};

const m = (pieceLb: number, serving: number, noun: string, plural: string): IngredientMeasure => ({
  pieceLb,
  serving,
  noun,
  plural,
});

export const INGREDIENT_MEASURES: Record<IngredientId, IngredientMeasure> = {
  // Vegetables (sold by the lb)
  tomato: m(0.3, 0.3, "tomato", "tomatoes"), // medium ~140 g — 1 lb ≈ 3
  carrot: m(0.15, 0.15, "carrot", "carrots"), // ~70 g
  cucumber: m(0.6, 0.3, "cucumber", "cucumbers"), // ~280 g; half a cucumber a plate
  onion: m(0.35, 0.35, "onion", "onions"), // ~160 g
  potato: m(0.45, 0.45, "potato", "potatoes"), // ~200 g
  mushroom: m(0.05, 0.25, "mushroom", "mushrooms"), // ~20 g each; 5 a plate
  pepper: m(0.35, 0.35, "pepper", "peppers"), // bell pepper ~160 g
  zucchini: m(0.45, 0.45, "zucchini", "zucchini"), // ~200 g
  eggplant: m(1, 0.5, "eggplant", "eggplants"), // ~450 g; half a plate
  broccoli: m(0.75, 0.35, "head", "heads"), // a head ~340 g
  corn: m(0.5, 0.5, "ear", "ears"), // an ear ~230 g
  celery: m(0.1, 0.2, "stalk", "stalks"), // a stalk ~45 g; 2 a plate
  lettuce: m(1, 0.25, "head", "heads"), // a head ~450 g; a quarter a plate
  cabbage: m(2, 0.35, "head", "heads"), // ~900 g
  cauliflower: m(1.5, 0.35, "head", "heads"), // ~680 g
  spinach: m(0.6, 0.2, "bunch", "bunches"), // a bunch ~270 g
  asparagus: m(0.04, 0.3, "spear", "spears"), // ~18 g each; ~8 a plate
  radish: m(0.03, 0.12, "radish", "radishes"), // ~14 g; 4 a plate
  beetroot: m(0.3, 0.3, "beet", "beets"), // ~140 g
  sweetpotato: m(0.45, 0.45, "sweet potato", "sweet potatoes"), // ~200 g
  greenbean: m(0.012, 0.25, "bean", "beans"), // ~5.5 g each
  fennel: m(0.5, 0.5, "bulb", "bulbs"), // ~230 g
  artichoke: m(0.35, 0.35, "artichoke", "artichokes"), // ~160 g
  peapod: m(0.01, 0.2, "pod", "pods"), // ~4.5 g each
  pumpkin: m(4, 0.5, "pumpkin", "pumpkins"), // a pie pumpkin ~1.8 kg
  turnip: m(0.3, 0.3, "turnip", "turnips"), // ~140 g
  chilli: m(0.03, 0.06, "chili", "chilies"), // ~14 g; 2 a plate
  springonion: m(0.03, 0.06, "scallion", "scallions"), // ~15 g; 2 a plate
  // Fruit (by the lb)
  strawberry: m(0.03, 0.3, "strawberry", "strawberries"), // ~12 g; ~10 a plate
  apple: m(0.4, 0.4, "apple", "apples"), // ~180 g
  orange: m(0.35, 0.35, "orange", "oranges"), // ~160 g
  lemon: m(0.25, 0.25, "lemon", "lemons"), // ~110 g
  avocado: m(0.45, 0.45, "avocado", "avocados"), // ~200 g
  pear: m(0.4, 0.4, "pear", "pears"), // ~180 g
  peach: m(0.33, 0.33, "peach", "peaches"), // ~150 g
  pineapple: m(3.5, 0.5, "pineapple", "pineapples"), // ~1.6 kg
  watermelon: m(10, 0.75, "watermelon", "watermelons"), // a small one ~4.5 kg
  mango: m(0.75, 0.5, "mango", "mangoes"), // ~340 g
  kiwi: m(0.17, 0.17, "kiwi", "kiwis"), // ~75 g
  pomegranate: m(0.6, 0.3, "pomegranate", "pomegranates"), // ~280 g
  grapes: m(0.012, 0.25, "grape", "grapes"), // ~5 g each
  coconut: m(1.5, 0.3, "coconut", "coconuts"), // ~680 g
  lime: m(0.15, 0.15, "lime", "limes"), // ~67 g
  // Herbs (sold by the bunch)
  basil: m(0.15, 0.25, "bunch", "bunches"), // a bunch ~70 g; a quarter a plate
  parsley: m(0.25, 0.2, "bunch", "bunches"),
  cilantro: m(0.2, 0.2, "bunch", "bunches"),
  // Aromatics (by the lb)
  garlic: m(0.01, 0.025, "clove", "cloves"), // a clove ~5 g; 2–3 a plate
  ginger: m(0.05, 0.025, "knob", "knobs"), // a 1-inch knob ~25 g
  // Bakery (sold by the piece)
  bread: m(1.5, 0.25, "loaf", "loaves"), // a loaf ~680 g; 4 slices a plate
  baguette: m(0.55, 0.5, "baguette", "baguettes"), // ~250 g; half a plate
  // Dairy & tofu (by the lb)
  cheddar: m(0.5, 0.2, "block", "blocks"), // an 8 oz block; ~3 oz a plate
  mozzarella: m(0.5, 0.25, "ball", "balls"), // an 8 oz ball; 4 oz a plate
  butter: m(0.25, 0.06, "stick", "sticks"), // a stick 4 oz; 1 oz a plate
  tofu: m(0.875, 0.4, "block", "blocks"), // a 14 oz block
  // Protein (by the lb)
  chicken: m(0.5, 0.5, "breast", "breasts"), // ~230 g
  steak: m(0.75, 0.75, "steak", "steaks"), // a 12 oz ribeye
  salmon: m(0.4, 0.4, "fillet", "fillets"), // a 6–7 oz fillet
};

export function measureFor(ingredientId: IngredientId): IngredientMeasure {
  return INGREDIENT_MEASURES[ingredientId];
}

/** One plate's use of one prepared `ingredientId`, in its purchase unit. */
export function servingFor(ingredientId: IngredientId): number {
  return INGREDIENT_MEASURES[ingredientId].serving;
}
