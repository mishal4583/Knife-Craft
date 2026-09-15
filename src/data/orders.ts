/**
 * PREP_ORDERS — the real, separately-playable orders. Each pairs an
 * ingredient with the technique it's actually cut by (knifecraft.html's
 * recipes: "tomato-slice-6", "tomato-dice-3x3", "carrot-julienne-10") —
 * see definitions.ts for the technique/ingredient definitions themselves.
 */
import { INGREDIENTS, TECHNIQUES, type IngredientId, type TechniqueId } from "@/game/definitions";
import type { DailyOrder, Ingredient } from "@/types/game";

export type PrepOrder = {
  order: DailyOrder;
  ingredient: Ingredient;
  ingredientId: IngredientId;
  techniqueId: TechniqueId;
};

export const PREP_ORDERS: PrepOrder[] = [
  {
    order: {
      day: "Today",
      recipeId: "garden-salad",
      name: "Garden Salad",
      emoji: "🥗",
      ingredients: ["Tomato", "Cucumber", "Onion"],
      reward: 120,
      note: "The café's quiet bestseller.",
    },
    ingredient: {
      id: INGREDIENTS.tomato.id,
      name: INGREDIENTS.tomato.name,
      glyph: "🍅",
      technique: TECHNIQUES.slice.name,
      targetPieces: TECHNIQUES.slice.requiredCuts,
    },
    ingredientId: "tomato",
    techniqueId: "slice",
  },
  {
    order: {
      day: "Today",
      recipeId: "tomato-dice",
      name: "Diced Tomato",
      emoji: "🍲",
      ingredients: ["Tomato"],
      reward: 140,
      note: "For the soup base — a neat 3×3 grid.",
    },
    ingredient: {
      id: INGREDIENTS.tomato.id,
      name: INGREDIENTS.tomato.name,
      glyph: "🍅",
      technique: TECHNIQUES.dice.name,
      targetPieces: TECHNIQUES.dice.requiredCuts,
    },
    ingredientId: "tomato",
    techniqueId: "dice",
  },
  {
    order: {
      day: "Today",
      recipeId: "carrot-julienne",
      name: "Carrot Julienne",
      emoji: "🥕",
      ingredients: ["Carrot"],
      reward: 160,
      note: "Fine, even batons — every cut follows the first.",
    },
    ingredient: {
      id: INGREDIENTS.carrot.id,
      name: INGREDIENTS.carrot.name,
      glyph: "🥕",
      technique: TECHNIQUES.julienne.name,
      targetPieces: TECHNIQUES.julienne.requiredCuts,
    },
    ingredientId: "carrot",
    techniqueId: "julienne",
  },
  {
    order: {
      day: "Today",
      recipeId: "cucumber-slice",
      name: "Cucumber Rounds",
      emoji: "🥒",
      ingredients: ["Cucumber"],
      reward: 130,
      note: "Tap your way down the whole thing — clean, crisp rounds.",
    },
    ingredient: {
      id: INGREDIENTS.cucumber.id,
      name: INGREDIENTS.cucumber.name,
      glyph: "🥒",
      technique: TECHNIQUES.slice.name,
      targetPieces: TECHNIQUES.slice.requiredCuts,
    },
    ingredientId: "cucumber",
    techniqueId: "slice",
  },
];

export const DEFAULT_PREP_ORDER = PREP_ORDERS[0]!;

export function findPrepOrder(recipeId: string): PrepOrder {
  return PREP_ORDERS.find((o) => o.order.recipeId === recipeId) ?? DEFAULT_PREP_ORDER;
}
