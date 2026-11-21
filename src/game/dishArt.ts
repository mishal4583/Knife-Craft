import { DISH_ART_IDS } from "./dishArtFiles";
import type { LevelDefinition } from "./levels/levelTypes";

/**
 * A dish's own painted picture (a transparent top-down plate, `public/dishes/<recipe id>.webp`), or null when it has none yet. The starting card and the plate set on the table while
 * serving use it; without it they show the dish's painted icon on a plate (the dish still reads, and nothing waits on the art).
 */
export function dishArtUrl(recipeId: string | null | undefined): string | null {
  if (!recipeId || !DISH_ART_IDS.has(recipeId)) return null;
  return `${import.meta.env?.BASE_URL ?? "/"}dishes/${recipeId}.webp`;
}

/**
 * The pictures of every dish a level serves (developer 2026-11-21: "Summer Salmon & Chicken" showed only the salmon): the batch group, else the recipe pool, else the headline recipe;
 * only the dishes that have a picture, no repeats, at most `max` (a plate cluster of three is the most the Kitchen's card holds; 69 of the 91 levels serve 2 or 3 dishes).
 */
export function levelDishArts(level: LevelDefinition, max = 3): string[] {
  const ids = level.batchGroupRecipeIds ?? level.recipePoolIds ?? [level.recipeId];
  const out: string[] = [];
  for (const id of [...new Set(ids)]) {
    const url = dishArtUrl(id);
    if (url) out.push(url);
    if (out.length >= max) break;
  }
  return out;
}
