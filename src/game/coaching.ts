/**
 * Beginner coaching — the ghost demonstration PreparationScene plays on the
 * board (a glowing line where the next cut goes, a see-through knife
 * dropping onto it and a fingertip tapping it; a fingertip sweeping the
 * skin for Peel; a press for Smash; a tap and the next ring for Rings) and
 * the HUD's how-to card that appears with it.
 *
 * Which steps are TAUGHT (the demonstration plays as soon as the step
 * starts and until the first touch, then again after a short pause): every
 * step of Levels 1–5, and each technique in the first two campaign levels
 * that use it — in the level's own steps or in any recipe its customers can
 * order, a Peel the game inserts before cutting included. Every other
 * step — later levels, Restaurant Service, Business — still gets the
 * demonstration after a longer pause without input, for a player who is
 * stuck. Derived from the level data; nothing is stored.
 */
import type { TechniqueId } from "./definitions";
import type { LevelDefinition } from "./levels/levelTypes";
import { LEVELS } from "./levels/levelDefinitions";
import { mustPeelBefore } from "./prepStepGuards";
import { levelNumber } from "./levels/levelMastery";
import { getCampaignRecipe } from "./recipes/campaignRecipes";

/** Every step of Levels 1..TEACH_ALL_THROUGH_LEVEL is taught. */
export const TEACH_ALL_THROUGH_LEVEL = 5;
/** Each technique is taught in this many of the first campaign levels that use it. */
export const TEACH_FIRST_LEVELS = 2;
/** A taught step's demonstration starts this long after the step begins. */
export const COACH_FIRST_DELAY_MS = 700;
/** After a touch, a taught step demonstrates again after this long without input. */
export const COACH_TAUGHT_IDLE_MS = 4000;
/** Any other step demonstrates after this long without input. */
export const COACH_IDLE_MS = 8000;

function techniquesUsedBy(level: LevelDefinition): Set<TechniqueId> {
  const used = new Set<TechniqueId>();
  const add = (ingredient: Parameters<typeof mustPeelBefore>[0], technique: TechniqueId) => {
    used.add(technique);
    if (mustPeelBefore(ingredient, technique)) used.add("peel");
  };
  for (const s of level.preparationSteps) add(s.ingredient, s.technique);
  for (const id of [...(level.recipePoolIds ?? []), ...(level.batchGroupRecipeIds ?? [])]) {
    for (const c of getCampaignRecipe(id)?.components ?? []) add(c.ingredientId, c.technique);
  }
  return used;
}

const FIRST_LEVELS: ReadonlyMap<TechniqueId, readonly number[]> = (() => {
  const first = new Map<TechniqueId, number[]>();
  const ordered = [...LEVELS].sort((a, b) => levelNumber(a.id) - levelNumber(b.id));
  for (const level of ordered) {
    for (const t of techniquesUsedBy(level)) {
      const list = first.get(t) ?? [];
      if (list.length < TEACH_FIRST_LEVELS) list.push(levelNumber(level.id));
      first.set(t, list);
    }
  }
  return first;
})();

/** Of `techniques` (what this session actually asks for), the ones campaign level `levelId` teaches with the ghost demonstration. */
export function taughtTechniques(
  levelId: string,
  techniques: Iterable<TechniqueId>,
): TechniqueId[] {
  const n = levelNumber(levelId);
  return [...new Set(techniques)].filter(
    (t) => n <= TEACH_ALL_THROUGH_LEVEL || (FIRST_LEVELS.get(t) ?? []).includes(n),
  );
}

/** The how-to card: what to do, and why a chef cuts it that way. */
export const COACH_TEXT: Record<TechniqueId, { title: string; how: string; why: string }> = {
  slice: {
    title: "How to slice",
    how: "Tap the glowing line — the knife cuts right there. Work across the whole thing.",
    why: "Even slices cook evenly and look neat on the plate.",
  },
  dice: {
    title: "How to dice",
    how: "Tap the glowing lines one way, then across them, to make little squares.",
    why: "Same-size cubes cook at the same speed.",
  },
  julienne: {
    title: "How to julienne",
    how: "Tap the glowing lines one after another — every cut runs the same way.",
    why: "Thin matchsticks cook fast and stay crisp.",
  },
  chop: {
    title: "How to chop",
    how: "Tap the glowing lines quickly — chopping is about rhythm.",
    why: "Rough, bite-size pieces are perfect for bowls and stews.",
  },
  halve: {
    title: "How to halve",
    how: "Tap the glowing line once to cut it in two.",
    why: "A flat half sits steady on the board for the next cuts.",
  },
  peel: {
    title: "How to peel",
    how: "Drag your finger across the skin, back and forth, until it's all gone.",
    why: "The tough skin comes off before any knife work.",
  },
  smash: {
    title: "How to smash",
    how: "Press once in the middle to crush it flat.",
    why: "Smashing garlic releases its flavor and loosens the skin.",
  },
  rings: {
    title: "How to cut rings",
    how: "Tap the onion — each tap cuts away one ring, from the outside in.",
    why: "Whole rings keep their shape for frying and garnish.",
  },
  radial: {
    title: "How to cut wedges",
    how: "Tap the glowing line through the middle — every cut passes the center.",
    why: "Cutting through the center makes equal wedges.",
  },
  rockMince: {
    title: "How to mince",
    how: "Tap again and again across the glowing lines to rock the blade.",
    why: "A fine mince spreads its flavor through the whole dish.",
  },
  chiffonade: {
    title: "How to chiffonade",
    how: "Tap the glowing lines one by one to cut the rolled leaves into ribbons.",
    why: "Thin ribbons of herbs look delicate and taste fresh.",
  },
};

/** Shown under the how-to line on cutting steps: the precise, advanced input. */
export const SWIPE_TIP = "Tip: swipe along the line for a precise cut.";
