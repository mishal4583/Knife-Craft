/**
 * Beginner coaching — the ghost demonstration PreparationScene plays on the
 * board (a glowing line where the next cut goes; a see-through knife and a
 * fingertip showing SWIPE, then TAP; a fingertip sweeping the skin for
 * Peel; a press for Smash; a tap and the next ring for Rings) and the HUD's
 * how-to card that appears with it.
 *
 * Shown only to beginners, and only when it helps:
 * - only in a campaign level played for the FIRST time (App passes
 *   `coachLevelId` only then — never on a replay, Today's Special, Endless,
 *   Restaurant Service or Business);
 * - only for TAUGHT techniques: every step of Levels 1–5, and each
 *   technique in the one campaign level that introduces it (its steps, its
 *   order pool and inserted peels counted);
 * - on such a step it plays as the step starts and hides on the first
 *   touch; it returns after a pause only while the player has made NO
 *   progress on that step (stuck). Once they've cut or peeled anything it
 *   stays away for that step.
 * Derived from the level data and the step's own progress; nothing is stored.
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
export const TEACH_FIRST_LEVELS = 1;
/** The plain one-line gesture hint ("tap to cut, or swipe for precision") shows only up to this level. */
export const BEGINNER_HINT_THROUGH_LEVEL = 10;
/** A taught step's demonstration starts this long after the step begins. */
export const COACH_FIRST_DELAY_MS = 700;
/** A taught step the player hasn't made any progress on demonstrates again after this long without input. */
export const COACH_STUCK_IDLE_MS = 4000;

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

/** Whether the plain one-line gesture hint shows: a beginner level played for the first time. */
export function showsBeginnerHint(coachLevelId: string | undefined): boolean {
  return !!coachLevelId && levelNumber(coachLevelId) <= BEGINNER_HINT_THROUGH_LEVEL;
}

/** The how-to card: what to do, and why a chef cuts it that way. */
export const COACH_TEXT: Record<TechniqueId, { title: string; how: string; why: string }> = {
  slice: {
    title: "How to slice",
    how: "Cut on the glowing line, then the next one — work across the whole thing.",
    why: "Even slices cook evenly and look neat on the plate.",
  },
  dice: {
    title: "How to dice",
    how: "Cut the glowing lines one way, then across them, to make little squares.",
    why: "Same-size cubes cook at the same speed.",
  },
  julienne: {
    title: "How to julienne",
    how: "Cut the glowing lines one after another — every cut runs the same way.",
    why: "Thin matchsticks cook fast and stay crisp.",
  },
  chop: {
    title: "How to chop",
    how: "Cut the glowing lines quickly — chopping is about rhythm.",
    why: "Rough, bite-size pieces are perfect for bowls and stews.",
  },
  halve: {
    title: "How to halve",
    how: "One cut on the glowing line splits it in two.",
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
    how: "Cut the glowing line through the middle — every cut passes the center.",
    why: "Cutting through the center makes equal wedges.",
  },
  rockMince: {
    title: "How to mince",
    how: "Cut the glowing lines again and again — rock the blade until it is fine.",
    why: "A fine mince spreads its flavor through the whole dish.",
  },
  chiffonade: {
    title: "How to chiffonade",
    how: "Cut the glowing lines one by one to turn the rolled leaves into ribbons.",
    why: "Thin ribbons of herbs look delicate and taste fresh.",
  },
};

/**
 * Shown on cutting steps under the how-to line: the two ways to cut, with
 * the same labels the ghost shows by its fingertip (SWIPE, then TAP).
 */
export const CUT_WAYS: ReadonlyArray<{ label: string; text: string }> = [
  { label: "TAP", text: "the line — the knife slices along it for you." },
  { label: "SWIPE", text: "along it — guide the blade for the neatest cut." },
];
