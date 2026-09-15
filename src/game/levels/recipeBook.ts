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
import { INGREDIENTS, TECHNIQUES } from "../definitions";

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

function toEntry(level: LevelDefinition): RecipeBookEntry {
  return {
    level,
    chapterTitle: CHAPTER_TITLES[level.chapter] ?? level.chapterId,
    ingredientNames: uniqueInOrder(
      level.preparationSteps.map((s) => INGREDIENTS[s.ingredient].name),
    ),
    techniqueNames: uniqueInOrder(level.preparationSteps.map((s) => TECHNIQUES[s.technique].name)),
    steps: level.preparationSteps.map(
      (s) => `${TECHNIQUES[s.technique].name} ${INGREDIENTS[s.ingredient].name}`,
    ),
  };
}

export function getRecipeBookEntries(): RecipeBookEntry[] {
  return LEVELS.map(toEntry);
}

/** Chapter titles in campaign order, deduped — the Recipe Book's real category list (replaces the old hardcoded, mostly-empty RECIPE_CATEGORIES). */
export function getRecipeBookCategories(): string[] {
  return uniqueInOrder(LEVELS.map((l) => CHAPTER_TITLES[l.chapter] ?? l.chapterId));
}
