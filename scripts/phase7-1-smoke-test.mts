/**
 * PHASE 7.1 SMOKE TEST — bug-fix + preparation-prerequisite-audit
 * regression suite (brief §30/§31), run the same way as
 * scripts/phase{1,2,3,4,5,6}-smoke-test.mts:
 *   npx esbuild scripts/phase7-1-smoke-test.mts --bundle --platform=node --format=esm --outfile=/tmp/phase71.mjs
 *   node /tmp/phase71.mjs
 *
 * Covers two independent bugs (brief §29 — treated as independent here
 * too):
 *   BUG A — the batch tip HUD overlap (GameHUD.tsx layout fix). No DOM
 *     test framework exists in this repo (no vitest/jsdom/testing-
 *     library — brief §6's own fallback applies), so this is a
 *     lightweight STRUCTURAL check against GameHUD.tsx's own source: the
 *     regression this guards against is the old hardcoded `top-[Npx]`
 *     absolute-overlay stacking coming back, which live/DOM behavior
 *     can't be asserted here anyway. Full layout verification is live
 *     browser testing (see the Phase 7.1 report's own §S).
 *   BUG B — the peel-mandatory-ingredient prerequisite dead-end
 *     (RecipeValidator.ts's new recipePrerequisiteIssues/isRecipePlayable,
 *     campaignRecipes.ts data fixes). Fully testable as pure logic.
 */
import { readFileSync } from "node:fs";
import { INGREDIENTS } from "../src/game/definitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import { CUISINES } from "../src/game/cuisines/cuisineDefinitions.ts";
import { recipePrerequisiteIssues, isRecipePlayable } from "../src/game/service/RecipeValidator.ts";
import {
  createServiceSession,
  recordAllComponents,
  createBatchGroupSession,
  recordBatchGroupComponents,
  batchHintFor,
  batchHintForGroup,
} from "../src/game/service/ServiceManager.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== 1: exactly 250 levels. =====
assert(LEVELS.length === 250, `1: exactly 250 levels (${LEVELS.length})`);

// ===== 2: exactly 25 chapters. =====
assert(Object.keys(CHAPTER_TITLES).length === 25, `2: exactly 25 chapters (${Object.keys(CHAPTER_TITLES).length})`);

// ===== 3: recipe count unchanged — this was a correctness pass, not content (brief §44 "do not pad"). =====
// KnifeCraft_Level_System_v2.docx migration: 211 -> 221 (Butter's 3 recipes and 5 obsolete finale-band
// recipes removed, 18 v2 recipes added — same authoritative total ingredient-realism-qa uses).
assert(CAMPAIGN_RECIPES.length === 221, `3: still exactly 221 recipes — no content added since Level System v2 (${CAMPAIGN_RECIPES.length})`);

// ===== 4: all recipe IDs unique. =====
const seenIds = new Set<string>();
let dupFound = false;
for (const r of CAMPAIGN_RECIPES) {
  if (seenIds.has(r.id)) dupFound = true;
  seenIds.add(r.id);
}
assert(!dupFound, `4: all ${CAMPAIGN_RECIPES.length} recipe ids are unique`);

// ===== 5: all defined ingredients resolve (52 campaign + 5 from the New-Ingredient Integration pack). =====
const allIngredientIds = Object.keys(INGREDIENTS);
assert(
  allIngredientIds.length === 57,
  `5: all 57 ingredients resolve — 52 campaign + Ginger/Green Chili/Lime/Cilantro/Green Onion (${allIngredientIds.length})`,
);

// ===== 6: all 11 techniques resolve (still active across the campaign). =====
const allTechniques = new Set<string>();
for (const r of CAMPAIGN_RECIPES) for (const c of r.components) allTechniques.add(c.technique);
assert(allTechniques.size === 11, `6: all 11 techniques still resolve/remain active (${allTechniques.size}/11)`);

// ===== 7: all 9 cuisines resolve. =====
const VALID_CUISINES = new Set(Object.keys(CUISINES));
assert(VALID_CUISINES.size === 9, `7: all 9 cuisines resolve (${VALID_CUISINES.size})`);

// ===== 8: no unsupported ingredient/technique combinations anywhere in the 211-recipe library. =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  "8: zero unsupported ingredient/technique combinations across all 211 recipes",
);

// ===== 9: every prerequisite-dependent technique has a reachable prerequisite path. =====
const allIssues = CAMPAIGN_RECIPES.flatMap((r) => recipePrerequisiteIssues(r));
assert(allIssues.length === 0, `9: every peel-mandatory ingredient use has a reachable Peel path (${allIssues.length} issues)`);
if (allIssues.length) for (const i of allIssues) console.error(`     ${i}`);

// ===== 10: zero blocked recipes (RecipeValidator.isRecipePlayable across all 211). =====
const blockedRecipes = CAMPAIGN_RECIPES.filter((r) => !isRecipePlayable(r));
assert(blockedRecipes.length === 0, `10: zero blocked recipes (${blockedRecipes.length}/${CAMPAIGN_RECIPES.length})`);

// ===== 11: zero blocked level recipe pools — every recipePoolIds/batchGroupRecipeIds reference is both real and playable. =====
const recipeById = new Map(CAMPAIGN_RECIPES.map((r) => [r.id, r]));
let blockedLevelPools = 0;
for (const l of LEVELS as any[]) {
  const ids: string[] = [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])];
  for (const rid of ids) {
    const r = recipeById.get(rid);
    if (!r || !isRecipePlayable(r)) blockedLevelPools++;
  }
}
assert(blockedLevelPools === 0, `11: zero blocked level recipe-pool references (${blockedLevelPools})`);

// ===== 12: Garlic Rock Mince path is valid — the Level 250 finale recipe specifically. =====
const garlicGrandA = CAMPAIGN_RECIPES.find((r) => r.id === "camp-finale-garlic-grand-a")!;
assert(
  garlicGrandA.components[0]!.technique === "peel" &&
    garlicGrandA.components[1]!.technique === "rockMince" &&
    isRecipePlayable(garlicGrandA),
  "12: Garlic Rock Mince (Level 250's own finale recipe) has a valid Peel -> Rock Mince path",
);

// ===== 13: Garlic Smash path is valid where used. =====
const garlicSmashRecipes = CAMPAIGN_RECIPES.filter((r) =>
  r.components.some((c) => c.ingredientId === "garlic" && c.technique === "smash"),
);
assert(
  garlicSmashRecipes.length > 0 && garlicSmashRecipes.every((r) => isRecipePlayable(r)),
  `13: every Garlic Smash recipe (${garlicSmashRecipes.length}) has a valid Peel -> Smash path`,
);

// ===== 14: Onion technique paths are valid across every Onion recipe. =====
const onionRecipes = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => c.ingredientId === "onion"));
assert(
  onionRecipes.length > 0 && onionRecipes.every((r) => isRecipePlayable(r)),
  `14: every Onion recipe (${onionRecipes.length}) has a valid preparation path`,
);

// ===== 15: every Peel-required recipe includes a valid Peel path (all 6 peel-mandatory ingredients). =====
const PEEL_MANDATORY = ["onion", "potato", "garlic", "pineapple", "watermelon", "coconut"];
const peelMandatoryRecipes = CAMPAIGN_RECIPES.filter((r) =>
  r.components.some((c) => PEEL_MANDATORY.includes(c.ingredientId)),
);
assert(
  peelMandatoryRecipes.length > 0 && peelMandatoryRecipes.every((r) => isRecipePlayable(r)),
  `15: every recipe using a peel-mandatory ingredient (${peelMandatoryRecipes.length}: onion/potato/garlic/pineapple/watermelon/coconut) has a valid Peel path`,
);

// ===== 16: batching still validates (a real 2-order batch pair correctly shares its batchable output). =====
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-onion-batch-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-onion-batch-b")!;
  let group = createBatchGroupSession("t", [a, b], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const onionOutput = group.session.outputs.find((o) => o.ingredientId === "onion" && o.preparationState === "ringed");
  assert(
    onionOutput !== undefined && onionOutput.assignedTo.length === 2,
    "16: batching still validates post-fix — the onion-rings batch pair still shares one output across 2 orders",
  );
}

// ===== 17: branching still validates (a real branch recipe still becomes READY with independent outputs). =====
{
  const branch = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-potato-branch")!;
  let session = createServiceSession("t", [branch], Math.random);
  session = recordAllComponents(session);
  assert(
    session.current!.order.status === "READY",
    "17: branching still validates post-fix — a peel-mandatory (potato) branch recipe still reaches READY",
  );
}

// ===== 18: destination allocation still validates (shared output reaches every destination it should). =====
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-b")!;
  const c = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-c")!;
  let group = createBatchGroupSession("t", [a, b, c], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const carrotOutput = group.session.outputs.find((o) => o.ingredientId === "carrot")!;
  assert(carrotOutput?.assignedTo.length === 3, "18: destination allocation still validates post-fix — a 3-way batch allocates to 3 destinations");
}

// ===== 19: 3-customer service still validates — Level 250's own batch group. =====
const level250 = LEVELS.find((l) => l.id === "level-250")! as any;
{
  const ids: string[] = level250.batchGroupRecipeIds;
  const recipes = ids.map((id) => recipeById.get(id)!);
  let group = createBatchGroupSession("level-250", recipes, () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const garlicOutput = group.session.outputs.find((o) => o.ingredientId === "garlic" && o.preparationState === "minced");
  assert(
    group.orders.length === 3 && garlicOutput !== undefined && garlicOutput.assignedTo.length === 2,
    "19: 3-customer service still validates post-fix — Level 250's garlic batch shares across 2 of its 3 tables",
  );
}

// ===== 20: Level 250 still resolves correctly (structural). =====
assert(
  level250.chapter === 25 &&
    level250.batchGroupRecipeIds.length === 3 &&
    level250.batchGroupRecipeIds.every((id: string) => isRecipePlayable(recipeById.get(id)!)),
  "20: Level 250 still resolves correctly and all 3 of its recipes are now playable",
);

// ===== 21: batch tip data remains present when a real batch/share exists. =====
{
  const level26ish = CAMPAIGN_RECIPES.filter((r) => r.unlockLevel <= 30 && r.batchable);
  assert(level26ish.length > 0, "21a: batchable recipes still exist pre-fix pool (sanity)");
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-onion-batch-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-onion-batch-b")!;
  const group = createBatchGroupSession("t", [a, b], () => 0);
  const hint = batchHintForGroup(group, group.orders[0].order.id);
  assert(hint !== null && hint.length > 0, "21: batch tip data (batchHintForGroup) remains present for a real batch group");
}

// ===== 22: non-batch levels do not incorrectly receive batch tips. =====
{
  const soloRecipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-peeled-potato-bowl")!;
  let session = createServiceSession("t", [soloRecipe], () => 0);
  const hint = batchHintFor(session);
  assert(hint === null, "22: a single-recipe (non-batch) session never produces a batch tip");
}

// ===== 23 (Bug A): GameHUD.tsx no longer stacks the batch tip / step / progress rows as independent hardcoded-offset absolute overlays. =====
{
  const hudSource = readFileSync("src/components/kc/game/GameHUD.tsx", "utf8");
  // Only flag an actual className string containing the old magic-number
  // offset — the fix's own doc comment above mentions `top-[68px]`/
  // `top-[102px]` in backticks as history, which must not trip this.
  const hasOldHardcodedOffsets = /"[^"\n]*top-\[(68|74|102)px\][^"\n]*"/.test(hudSource);
  const hasBatchTipBlock = hudSource.includes("batchHint ?") && hudSource.includes("flex justify-center");
  const hasStepLabelBlock = hudSource.includes("stepLabel ?");
  assert(
    !hasOldHardcodedOffsets && hasBatchTipBlock && hasStepLabelBlock,
    "23: GameHUD.tsx uses normal-flow layout for the batch tip/step indicator (no reintroduced hardcoded top-[Npx] overlay stacking)",
  );
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
