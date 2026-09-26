/**
 * PHASE 7.2 SMOKE TEST — final release-candidate QA regression suite
 * (brief §37), run the same way as scripts/phase{1..6,7-1}-smoke-test.mts:
 *   npx esbuild scripts/phase7-2-smoke-test.mts --bundle --platform=node --format=esm --outfile=/tmp/phase72.mjs
 *   node /tmp/phase72.mjs
 *
 * Meaningful final-state assertions only (brief's own "do not artificially
 * inflate the assertion count") — everything Phase 7.1's own suite already
 * covers well is not duplicated here except where this phase changed
 * something (recipeBook.ts's Cookbook fix) or the brief explicitly asks
 * for a final-state check.
 */
import { INGREDIENTS } from "../src/game/definitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import { CUISINES } from "../src/game/cuisines/cuisineDefinitions.ts";
import { getRecipeBookEntries } from "../src/game/levels/recipeBook.ts";
import { recipePrerequisiteIssues, isRecipePlayable } from "../src/game/service/RecipeValidator.ts";
import {
  createServiceSession,
  recordAllComponents,
  createBatchGroupSession,
  recordBatchGroupComponents,
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

// ===== 1: exactly 250 levels, no Level 251+. =====
assert(LEVELS.length === 250, `1: exactly 250 levels (${LEVELS.length})`);
assert(!LEVELS.some((l) => parseInt(l.id.replace("level-", ""), 10) > 250), "1b: no Level 251+ exists");

// ===== 2: exactly 25 chapters. =====
assert(Object.keys(CHAPTER_TITLES).length === 25, `2: exactly 25 chapters (${Object.keys(CHAPTER_TITLES).length})`);

// ===== 3: exactly 211 recipes (content frozen this phase). =====
// KnifeCraft_Level_System_v2.docx migration: 211 -> 221 (see phase7-1-smoke-test / ingredient-realism-qa).
assert(CAMPAIGN_RECIPES.length === 221, `3: exactly 221 recipes, content frozen since Level System v2 (${CAMPAIGN_RECIPES.length})`);

// ===== 4: ingredients/techniques/cuisines resolve (57 ingredients — 52 campaign + the New-Ingredient Integration pack's 5). =====
assert(Object.keys(INGREDIENTS).length === 57, "4a: 57 ingredients resolve");
const allTechniques = new Set<string>();
for (const r of CAMPAIGN_RECIPES) for (const c of r.components) allTechniques.add(c.technique);
assert(allTechniques.size === 11, `4b: 11 techniques remain active (${allTechniques.size})`);
assert(Object.keys(CUISINES).length === 9, "4c: 9 cuisines resolve");

// ===== 5: valid recipe pools — every level's pool/batch reference resolves to a real recipe. =====
const recipeById = new Map(CAMPAIGN_RECIPES.map((r) => [r.id, r]));
let brokenPoolRefs = 0;
for (const l of LEVELS as any[]) {
  for (const rid of [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])]) {
    if (!recipeById.has(rid)) brokenPoolRefs++;
  }
}
assert(brokenPoolRefs === 0, `5: every level pool/batch reference resolves to a real recipe (${brokenPoolRefs} broken)`);

// ===== 6: valid ingredient/technique combinations across all 211 recipes. =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  "6: zero unsupported ingredient/technique combinations",
);

// ===== 7: zero blocked recipes / zero blocked levels. =====
const blockedRecipes = CAMPAIGN_RECIPES.filter((r) => !isRecipePlayable(r));
assert(blockedRecipes.length === 0, `7a: zero blocked recipes (${blockedRecipes.length}/${CAMPAIGN_RECIPES.length})`);
let blockedLevels = 0;
for (const l of LEVELS as any[]) {
  const ids: string[] = [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])];
  if (ids.some((id) => !recipeById.get(id) || !isRecipePlayable(recipeById.get(id)!))) blockedLevels++;
}
assert(blockedLevels === 0, `7b: zero blocked levels (${blockedLevels}/${LEVELS.length})`);

// ===== 8: valid peel prerequisites — the authoritative check, zero issues. =====
const allIssues = CAMPAIGN_RECIPES.flatMap((r) => recipePrerequisiteIssues(r));
assert(allIssues.length === 0, `8: zero peel-prerequisite issues across the campaign (${allIssues.length})`);

// ===== 9: Garlic Rock Mince / Garlic Smash / Onion paths remain valid. =====
const garlicRockMince = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => c.ingredientId === "garlic" && c.technique === "rockMince"));
const garlicSmash = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => c.ingredientId === "garlic" && c.technique === "smash"));
const onionRecipes = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => c.ingredientId === "onion"));
assert(garlicRockMince.length > 0 && garlicRockMince.every(isRecipePlayable), `9a: all ${garlicRockMince.length} Garlic Rock Mince recipes valid`);
assert(garlicSmash.length > 0 && garlicSmash.every(isRecipePlayable), `9b: all ${garlicSmash.length} Garlic Smash recipes valid`);
assert(onionRecipes.length > 0 && onionRecipes.every(isRecipePlayable), `9c: all ${onionRecipes.length} Onion recipes valid`);

// ===== 10: batching / branching / allocation / 3-customer service still validate. =====
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-onion-batch-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-indian-onion-batch-b")!;
  let group = createBatchGroupSession("t", [a, b], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const onionOut = group.session.outputs.find((o) => o.ingredientId === "onion" && o.preparationState === "ringed");
  assert(onionOut !== undefined && onionOut.assignedTo.length === 2, "10a: batching validates (shared onion-rings output across 2 orders)");
}
{
  const branch = CAMPAIGN_RECIPES.find((r) => r.id === "camp-onion-two-ways")!;
  let session = createServiceSession("t", [branch], Math.random);
  session = recordAllComponents(session);
  assert(session.current!.order.status === "READY", "10b: branching validates (Onion Two Ways reaches READY)");
}
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-b")!;
  const c = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-c")!;
  let group = createBatchGroupSession("t", [a, b, c], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const carrotOut = group.session.outputs.find((o) => o.ingredientId === "carrot")!;
  assert(carrotOut?.assignedTo.length === 3, "10c: destination allocation validates (1 output -> 3 destinations)");
  assert(group.orders.length === 3, "10d: 3-customer service validates (3 simultaneous orders)");
}

// ===== 11: Level 250 resolves, all 3 recipes playable, real 3-order batch group. =====
const level250 = LEVELS.find((l) => l.id === "level-250")! as any;
assert(
  level250.chapter === 25 &&
    level250.batchGroupRecipeIds.length === 3 &&
    level250.batchGroupRecipeIds.every((id: string) => isRecipePlayable(recipeById.get(id)!)),
  "11: Level 250 resolves correctly, all 3 finale recipes playable",
);

// ===== 12: story milestone — Level 250 carries its own forward-only bit, earlier milestones untouched. =====
const level110 = LEVELS.find((l) => l.id === "level-110")! as any;
const level120 = LEVELS.find((l) => l.id === "level-120")! as any;
assert(
  level110.milestone === "Protein Kitchen" && level120.milestone === "Grand Service" && level250.milestone === "Every Table, Every Night",
  "12: story milestones intact (Level 110/120 unchanged, Level 250 carries its own)",
);

// ===== 13: save compatibility — Level 171/Level 250 unlock chains are unbroken. =====
const level171 = LEVELS.find((l) => l.id === "level-171")! as any;
assert(
  level171.unlockRequirements.type === "levelCompleted" && level171.unlockRequirements.levelId === "level-170",
  "13a: Level 171 still unlocks off Level 170",
);
assert(
  level250.unlockRequirements.type === "levelCompleted" && level250.unlockRequirements.levelId === "level-249",
  "13b: Level 250 still unlocks off Level 249",
);

// ===== 14: Cookbook — every recipe has display metadata, AND batch-group levels now show their real (post-Peel-fix) steps. =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.name && r.emoji && ["A", "B", "C"].includes(r.authenticity)),
  "14a: every recipe carries real Cookbook display metadata",
);
{
  const entries = getRecipeBookEntries();
  const l250Entry = entries.find((e) => e.level.id === "level-250")!;
  const l200Entry = entries.find((e) => e.level.id === "level-200")!;
  assert(
    l250Entry.steps.includes("Peel Garlic") && l200Entry.steps.includes("Peel Onion"),
    "14b: Cookbook now shows the real Peel-first steps for batch-group levels (Phase 7.2 fix to recipeBook.ts)",
  );
}

// ===== 15: Daily Order / Endless Service pool integrity — no unsupported combos, pool stays large. =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  "15a: Daily Order's full pool has zero unsupported combos",
);
assert(CAMPAIGN_RECIPES.length >= 200, `15b: Endless Service's pool stays >= 200 recipes (${CAMPAIGN_RECIPES.length})`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
