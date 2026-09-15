import type { DailyOrder, Ingredient } from "@/types/game";

export const mockDailyOrder: DailyOrder = {
  day: "Today",
  recipeId: "garden-salad",
  name: "Garden Salad",
  emoji: "🥗",
  ingredients: ["Tomato", "Cucumber", "Onion"],
  reward: 120,
  note: "The regulars will be in around nine.",
};

export const mockIngredient: Ingredient = {
  id: "tomato",
  name: "Tomato",
  glyph: "🍅",
  technique: "Slice",
  targetPieces: 4,
};