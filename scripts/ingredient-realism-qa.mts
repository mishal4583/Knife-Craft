/**
 * INGREDIENT_REALISM_QA — final content-consistency regression suite
 * (brief §31), run the same way as scripts/phase{1..6,7-1,7-2}-smoke-test.mts:
 *   npx esbuild scripts/ingredient-realism-qa.mts --bundle --platform=node --format=esm --outfile=/tmp/realism.mjs
 *   node /tmp/realism.mjs
 *
 * Covers this pass's own audit findings (recipe name must match its own
 * ingredients; duplicate-step recipes must be genuinely distinct
 * variants) plus the brief's required final-state checks. Does not
 * duplicate every assertion phase7-1/7-2 already made — only what this
 * pass verified fresh or fixed.
 */
import { INGREDIENTS } from "../src/game/definitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { CUISINES } from "../src/game/cuisines/cuisineDefinitions.ts";
import { getRecipeBookEntries } from "../src/game/levels/recipeBook.ts";
import { isRecipePlayable } from "../src/game/service/RecipeValidator.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== 1: all defined ingredients exist (52 campaign + 5 from the New-Ingredient Integration pack). =====
assert(
  Object.keys(INGREDIENTS).length === 57,
  `1: all 57 ingredients exist — 52 campaign + Ginger/Green Chili/Lime/Cilantro/Green Onion (${Object.keys(INGREDIENTS).length})`,
);

// ===== 2: all 221 recipes resolve (unique ids, real objects). =====
// KnifeCraft_Level_System_v2.docx migration: 211 -> 221 (Butter's 3
// recipes removed, 5 obsolete finale-band recipes removed, 18 v2 recipes
// added — see the migration's own final report). This count is v2's own
// authoritative total, not a re-guess.
const seenIds = new Set<string>();
let dup = false;
for (const r of CAMPAIGN_RECIPES) {
  if (seenIds.has(r.id)) dup = true;
  seenIds.add(r.id);
}
assert(CAMPAIGN_RECIPES.length === 221 && !dup, `2: all 221 recipes resolve with unique ids (${CAMPAIGN_RECIPES.length})`);

// ===== 3: all technique references resolve (engine-supported per ingredient). =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId]?.techniques.includes(c.technique))),
  "3: all technique references resolve against their ingredient's supported techniques",
);

// ===== 4: all cuisine references resolve (real cuisine id or intentional null). =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.cuisineId === null || !!CUISINES[r.cuisineId]),
  "4: every recipe's cuisineId is either a real cuisine or the intentional null",
);

// ===== 5: all prerequisite rules resolve — zero impossible preparation paths. =====
const blocked = CAMPAIGN_RECIPES.filter((r) => !isRecipePlayable(r));
assert(blocked.length === 0, `5: zero impossible preparation paths (${blocked.length} blocked)`);

// ===== 6: zero broken recipe references from any level pool. =====
const recipeById = new Map(CAMPAIGN_RECIPES.map((r) => [r.id, r]));
let brokenRecipeRefs = 0;
for (const l of LEVELS as any[]) {
  for (const rid of [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])]) {
    if (!recipeById.has(rid)) brokenRecipeRefs++;
  }
}
assert(brokenRecipeRefs === 0, `6: zero broken level->recipe references (${brokenRecipeRefs})`);

// ===== 7: zero broken level references — every level has a resolvable pool. =====
let brokenLevels = 0;
for (const l of LEVELS as any[]) {
  const ids: string[] = [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])];
  if (ids.length === 0) brokenLevels++;
}
assert(brokenLevels === 0, `7: every one of ${LEVELS.length} levels has a non-empty recipe pool (${brokenLevels} empty)`);

// ===== 8: zero invalid protein references — Chicken/Steak/Salmon only use their own real ingredient ids. =====
const PROTEIN_IDS = new Set(["chicken", "steak", "salmon"]);
const proteinRecipes = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => PROTEIN_IDS.has(c.ingredientId)));
assert(
  proteinRecipes.every((r) => r.components.every((c) => (PROTEIN_IDS.has(c.ingredientId) ? !!INGREDIENTS[c.ingredientId] : true))),
  `8: all ${proteinRecipes.length} protein recipes reference only real protein ingredient ids`,
);

// ===== 9: zero duplicate recipe IDs (re-stated explicitly per brief §31). =====
assert(seenIds.size === CAMPAIGN_RECIPES.length, "9: zero duplicate recipe ids");

// ===== 10: Cookbook data agrees with authoritative recipes — no stale preparationSteps mismatch. =====
{
  const entries = getRecipeBookEntries();
  const l250 = entries.find((e) => e.level.id === "level-250")!;
  const l200 = entries.find((e) => e.level.id === "level-200")!;
  assert(
    l250.steps.includes("Peel Garlic") && l200.steps.includes("Peel Onion"),
    "10: Cookbook agrees with the authoritative (post-Peel-fix) recipe data for batch-group levels",
  );
}

// ===== 11: Level 250 resolves correctly. =====
const level250 = LEVELS.find((l) => l.id === "level-250")! as any;
assert(
  level250.chapter === 25 &&
    level250.batchGroupRecipeIds?.length === 3 &&
    level250.batchGroupRecipeIds.every((id: string) => isRecipePlayable(recipeById.get(id)!)),
  "11: Level 250 resolves correctly — chapter 25, real 3-recipe batch group, all playable",
);

// ===== 12: recipe name matches its own ingredients — the defect this pass originally found and fixed. =====
// UPDATED for the Level System v2 migration: v2 §2.1 removes Butter from
// the campaign entirely, replacing camp-french-butter-3way-a/b/c (this
// test's original targets — a Butter+Carrot recipe whose b/c variants'
// names falsely claimed Turnip/Asparagus) with three genuinely distinct
// recipes at the same level (L189): Salmon/Turnip/Asparagus Persillade,
// sharing one parsley chiffonade batch. The old targets no longer exist,
// so this checks the same property (name matches own ingredients) on
// their replacements instead of on a recipe that's gone.
{
  const salmon = recipeById.get("camp-salmon-persillade")!;
  const turnip = recipeById.get("camp-turnip-persillade-bowl")!;
  const asparagus = recipeById.get("camp-asparagus-persillade-cup")!;
  const usesIngredient = (r: typeof salmon, id: string) =>
    r.components.some((comp) => comp.ingredientId === id);
  assert(
    usesIngredient(salmon, "salmon") &&
      usesIngredient(turnip, "turnip") &&
      usesIngredient(asparagus, "asparagus") &&
      !CAMPAIGN_RECIPES.some((r) => r.components.some((c) => c.ingredientId === "butter")),
    "12: L189's three persillade recipes each name the ingredient they actually use, and Butter is gone campaign-wide",
  );
}

// ===== 13: no recipe name mentions a specific ingredient it does not actually use (general regression). =====
{
  const CANON: Record<string, string> = {
    tomato: "Tomato", carrot: "Carrot", cucumber: "Cucumber", onion: "Onion",
    garlic: "Garlic", basil: "Basil", parsley: "Parsley", mushroom: "Mushroom", pepper: "Pepper",
    zucchini: "Zucchini", strawberry: "Strawberry", apple: "Apple", orange: "Orange",
    eggplant: "Eggplant", broccoli: "Broccoli", corn: "Corn", celery: "Celery", lettuce: "Lettuce",
    cabbage: "Cabbage", cauliflower: "Cauliflower", spinach: "Spinach", asparagus: "Asparagus",
    radish: "Radish", beetroot: "Beetroot", greenbean: "Green Bean",
    fennel: "Fennel", artichoke: "Artichoke", peapod: "Pea Pod", pumpkin: "Pumpkin", turnip: "Turnip",
    lemon: "Lemon", avocado: "Avocado", pear: "Pear", peach: "Peach", pineapple: "Pineapple",
    watermelon: "Watermelon", mango: "Mango", kiwi: "Kiwi", pomegranate: "Pomegranate", grapes: "Grapes",
    coconut: "Coconut", cheddar: "Cheddar", mozzarella: "Mozzarella", tofu: "Tofu",
    baguette: "Baguette", chicken: "Chicken", steak: "Steak", salmon: "Salmon",
    // "Potato"/"Butter" deliberately excluded: "Sweet Potato" and "Herb Butter" (a flavor
    // descriptor, not a literal component) are legitimate substring/flavor false positives.
  };
  // "Green Onion" (production id springonion, v2's own display name for it) is a
  // legitimate substring false positive against CANON's "onion" -> "Onion" the exact
  // same way "Sweet Potato"/"Herb Butter" already are — added for the Level System v2
  // migration's new "Eggplant & Green Onion Wok Bowl".
  const SUBSTRING_EXCLUSIONS: Record<string, RegExp> = {
    onion: /Green Onion/i,
  };
  let mismatches = 0;
  for (const r of CAMPAIGN_RECIPES) {
    const used = new Set(r.components.map((c) => c.ingredientId));
    for (const [id, disp] of Object.entries(CANON)) {
      const exclusion = SUBSTRING_EXCLUSIONS[id];
      const name = exclusion ? r.name.replace(exclusion, "") : r.name;
      if (new RegExp(`\\b${disp}\\b`, "i").test(name) && !used.has(id)) {
        console.error(`     ${r.id}: name "${r.name}" mentions unused ingredient "${disp}"`);
        mismatches++;
      }
    }
  }
  assert(mismatches === 0, `13: no recipe name mentions a specific ingredient absent from its own components (${mismatches} mismatches)`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
