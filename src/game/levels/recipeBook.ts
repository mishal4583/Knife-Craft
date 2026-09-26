/**
 * RECIPE_BOOK — a pure, derived VIEW over the existing level data (Phase
 * 12B). Not a second recipe database: every field here is computed
 * straight from LevelDefinition/CHAPTER_TITLES/INGREDIENTS/TECHNIQUES,
 * which already fully describe every real recipe in the game. Recipes.tsx
 * (and Journal.tsx's "Best Preparations" list) read from this instead of
 * the old hand-written mock RECIPES array.
 */
import { LEVELS, CHAPTER_TITLES } from "./levelDefinitions";
import type { LevelDefinition } from "./levelTypes";
import { INGREDIENTS, TECHNIQUES, type IngredientId, type TechniqueId } from "../definitions";
import { CAMPAIGN_RECIPES } from "../recipes/campaignRecipes";

export type RecipeBookEntry = {
  /** The underlying level — Recipes.tsx uses this directly with the existing isUnlocked/isCompleted (LevelManager.ts), no parallel unlock/progress concept. */
  level: LevelDefinition;
  chapterTitle: string;
  /** Deduped, display-ready ingredient names in first-appearance order. */
  ingredientNames: string[];
  /** Deduped, display-ready technique names in first-appearance order. */
  techniqueNames: string[];
  /** One line per preparation step, e.g. "Peel Onion", "Halve Onion", "Slice Onion" — only what the level's own data actually contains. */
  steps: string[];
};

function uniqueInOrder<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/**
 * Phase 3 — for a "Level ≠ Recipe" level (recipePoolIds set, §3/§40/§41),
 * the level's own `preparationSteps` is only an adapter snapshot of the
 * pool's FIRST recipe (see levelDefinitions.ts's header doc). The real
 * Cookbook page should show every ingredient/technique/step across the
 * WHOLE pool the player might actually be served, not just that first
 * one — this is the migration step §41 asks for ("begin migrating the
 * Cookbook to the real RecipeDefinition system"), scoped to what's
 * cheap and safe: read the real recipes when they exist, fall back to
 * the legacy `preparationSteps` derivation for every level this phase
 * doesn't touch (41-120).
 *
 * PHASE 7.2 — `batchGroupRecipeIds` (Phase 4's real-batching levels,
 * mutually exclusive with `recipePoolIds` per levelTypes.ts) was missing
 * from this check, so every batch-group level (39 of them, including
 * Level 200 and the Level 250 finale) fell into the legacy branch and
 * showed its stale `preparationSteps` snapshot in the Cookbook — which,
 * after Phase 7.1's Peel-prerequisite fix, no longer matches what the
 * level actually serves (e.g. Level 250 would show "Rock Mince Garlic"
 * with no "Peel Garlic" step). Checking both pool fields, exactly the
 * same way ServiceManager/App.tsx already treat them as the two
 * equivalent "this level has a real recipe pool" shapes, fixes the
 * display without touching the pool/batch mechanism itself.
 */
function stepsFromPool(
  level: LevelDefinition,
): { ingredient: IngredientId; technique: TechniqueId; name: string }[] {
  const poolIds = level.recipePoolIds?.length
    ? level.recipePoolIds
    : level.batchGroupRecipeIds?.length
      ? level.batchGroupRecipeIds
      : null;
  if (!poolIds) {
    return level.preparationSteps.map((s) => ({
      ingredient: s.ingredient,
      technique: s.technique,
      name: `${TECHNIQUES[s.technique].name} ${INGREDIENTS[s.ingredient].name}`,
    }));
  }
  const pool = poolIds
    .map((id) => CAMPAIGN_RECIPES.find((r) => r.id === id))
    .filter((r): r is (typeof CAMPAIGN_RECIPES)[number] => !!r);
  return pool.flatMap((r) =>
    r.components.map((c) => ({
      ingredient: c.ingredientId,
      technique: c.technique,
      name: `${TECHNIQUES[c.technique].name} ${INGREDIENTS[c.ingredientId].name}`,
    })),
  );
}

function toEntry(level: LevelDefinition): RecipeBookEntry {
  const steps = stepsFromPool(level);
  return {
    level,
    chapterTitle: CHAPTER_TITLES[level.chapter] ?? level.chapterId,
    ingredientNames: uniqueInOrder(steps.map((s) => INGREDIENTS[s.ingredient].name)),
    techniqueNames: uniqueInOrder(steps.map((s) => TECHNIQUES[s.technique].name)),
    steps: steps.map((s) => s.name),
  };
}

export function getRecipeBookEntries(): RecipeBookEntry[] {
  return LEVELS.map(toEntry);
}

/** Chapter titles in campaign order, deduped — the Recipe Book's real category list (replaces the old hardcoded, mostly-empty RECIPE_CATEGORIES). */
export function getRecipeBookCategories(): string[] {
  return uniqueInOrder(LEVELS.map((l) => CHAPTER_TITLES[l.chapter] ?? l.chapterId));
}
