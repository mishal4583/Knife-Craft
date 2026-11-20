import { DISH_ART_IDS } from "./dishArtFiles";

/**
 * A dish's own painted picture (a transparent top-down plate, `public/dishes/<recipe id>.webp`), or null when it has none yet. The starting card and the plate set on the table while
 * serving use it; without it they show the dish's painted icon on a plate (the dish still reads, and nothing waits on the art).
 */
export function dishArtUrl(recipeId: string | null | undefined): string | null {
  if (!recipeId || !DISH_ART_IDS.has(recipeId)) return null;
  return `${import.meta.env?.BASE_URL ?? "/"}dishes/${recipeId}.webp`;
}
