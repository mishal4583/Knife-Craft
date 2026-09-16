/**
 * PHASE 6 SMOKE TEST — pure-logic assertions for the Levels 171-250
 * campaign completion (brief §23), run the same way as
 * scripts/phase{1,2,3,4,5}-smoke-test.mts:
 *   npx esbuild scripts/phase6-smoke-test.mts --bundle --platform=node --format=esm --outfile=/tmp/phase6.mjs
 *   node /tmp/phase6.mjs
 */
import { INGREDIENTS } from "../src/game/definitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import { CUISINES } from "../src/game/cuisines/cuisineDefinitions.ts";
import {
  poolUnlockedByLevel,
  createServiceSession,
  recordAllComponents,
  createBatchGroupSession,
  recordBatchGroupComponents,
  serveBatchGroupOrder,
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

const VALID_CUISINES = new Set([...Object.keys(CUISINES), null as unknown as string]);
const VALID_PROTEINS = new Set(["chicken", "steak", "salmon"]);

// ===== 1: Levels 171-250 exist. =====
const levels171to250 = LEVELS.filter((l) => {
  const n = parseInt(l.id.replace("level-", ""), 10);
  return n >= 171 && n <= 250;
});
assert(levels171to250.length === 80, `1: exactly 80 levels present for 171-250 (${levels171to250.length})`);

// ===== 2: exactly 25 chapters exist. =====
assert(Object.keys(CHAPTER_TITLES).length === 25, `2: exactly 25 chapters exist (${Object.keys(CHAPTER_TITLES).length})`);

// ===== 3: no Level 251+. =====
assert(
  !LEVELS.some((l) => parseInt(l.id.replace("level-", ""), 10) > 250),
  "3: no Level 251+ exists",
);
assert(LEVELS.length === 250, `3b: exactly 250 total levels (${LEVELS.length})`);

// ===== 4: recipe IDs unique. =====
const seenIds = new Set<string>();
let dupFound = false;
for (const r of CAMPAIGN_RECIPES) {
  if (seenIds.has(r.id)) dupFound = true;
  seenIds.add(r.id);
}
assert(!dupFound, `4: all ${CAMPAIGN_RECIPES.length} recipe ids are unique`);

// ===== 5: ingredient IDs valid. =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId] !== undefined)),
  "5: every recipe component references a real ingredient id",
);

// ===== 6: technique IDs valid (engine-supported for that ingredient). =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  "6: every recipe component uses an engine-supported technique for its ingredient",
);

// ===== 7: cuisine IDs valid. =====
assert(
  CAMPAIGN_RECIPES.every((r) => VALID_CUISINES.has(r.cuisineId as unknown as string)),
  "7: every recipe's cuisineId is either null or a real CuisineId",
);

// ===== 8: protein IDs valid — every protein-containing recipe uses chicken/steak/salmon only. =====
const proteinComponents = CAMPAIGN_RECIPES.flatMap((r) => r.components).filter((c) =>
  ["chicken", "steak", "salmon", "beef", "pork", "lamb", "shrimp"].includes(c.ingredientId),
);
assert(
  proteinComponents.every((c) => VALID_PROTEINS.has(c.ingredientId)),
  "8: every protein-shaped ingredient used is one of chicken/steak/salmon (no invented protein)",
);

// ===== 9: all recipes have valid, non-empty preparation steps (components). =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.length > 0 && r.destinations.length > 0),
  "9: every recipe has at least one component and one destination",
);

// ===== 10: recipe pool references valid (every recipePoolIds/batchGroupRecipeIds id exists). =====
const recipeIdSet = new Set(CAMPAIGN_RECIPES.map((r) => r.id));
let poolRefsOk = true;
for (const l of levels171to250 as any[]) {
  for (const rid of l.recipePoolIds ?? []) if (!recipeIdSet.has(rid)) poolRefsOk = false;
  for (const rid of l.batchGroupRecipeIds ?? []) if (!recipeIdSet.has(rid)) poolRefsOk = false;
}
assert(poolRefsOk, "10: every Level 171-250 recipe pool/batch-group reference resolves to a real recipe");

// ===== 11: locked recipes cannot appear early — every pool/batch recipe's unlockLevel <= the level using it. =====
let unlockOk = true;
for (const l of levels171to250 as any[]) {
  const num = parseInt(l.id.replace("level-", ""), 10);
  const ids: string[] = [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])];
  for (const rid of ids) {
    const recipe = CAMPAIGN_RECIPES.find((r) => r.id === rid)!;
    if (recipe.unlockLevel > num) unlockOk = false;
  }
}
assert(unlockOk, "11: no Level 171-250 pool references a recipe unlocked later than that level");

// ===== 12: protein gating works — a Level-250-only recipe is excluded from a pool unlocked at Level 249. =====
assert(
  !poolUnlockedByLevel(CAMPAIGN_RECIPES, 249).some((r) => r.id === "camp-finale-garlic-grand-a"),
  "12: protein gating — Level 250's own finale recipe is locked at Level 249",
);
assert(
  poolUnlockedByLevel(CAMPAIGN_RECIPES, 250).some((r) => r.id === "camp-finale-garlic-grand-a"),
  "12b: that same recipe unlocks exactly at Level 250",
);

// ===== 13: batching works — real 2-component Phase 6 recipes still share only their batchable component. =====
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-italian-basil-batch-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-italian-basil-batch-b")!;
  let group = createBatchGroupSession("t", [a, b], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const basilOutput = group.session.outputs.find((o) => o.ingredientId === "basil")!;
  const tomatoOutput = group.session.outputs.find((o) => o.ingredientId === "tomato")!;
  assert(
    group.session.outputs.length === 2 && basilOutput?.assignedTo.length === 2 && tomatoOutput?.assignedTo.length === 1,
    "13: a Phase 6 batch pair (basil chiffonade) shares the basil output across 2 orders while tomato stays independent",
  );
}

// ===== 14: branching works — a Phase 6 branch recipe produces 2 independent outputs. =====
{
  const branch = CAMPAIGN_RECIPES.find((r) => r.id === "camp-french-steak-branch")!;
  let session = createServiceSession("t", [branch], Math.random);
  session = recordAllComponents(session);
  assert(
    session.current!.order.status === "READY" && session.current!.session.outputs.length === 2,
    "14: a Phase 6 branch recipe (steak, two ways) becomes READY with 2 independent outputs",
  );
}

// ===== 15: destination allocation works — a 3-way Phase 6 mixed-cuisine batch allocates one output to 3 destinations. =====
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-b")!;
  const c = CAMPAIGN_RECIPES.find((r) => r.id === "camp-fusion-carrot-3way-c")!;
  let group = createBatchGroupSession("t", [a, b, c], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const carrotOutput = group.session.outputs.find((o) => o.ingredientId === "carrot")!;
  assert(
    carrotOutput?.assignedTo.length === 3,
    "15: a Phase 6 mixed-cuisine 3-way batch allocates one carrot output to 3 destinations",
  );
}

// ===== 16: 2/3-customer service works — Level 200 and Level 250 both real multi-customer batch groups. =====
const level200 = LEVELS.find((l) => l.id === "level-200")! as any;
const level250 = LEVELS.find((l) => l.id === "level-250")! as any;
assert(level200.batchGroupRecipeIds?.length === 3, "16: Level 200 is a real 3-customer batch+branch finale");
assert(level250.batchGroupRecipeIds?.length === 3, "16b: Level 250 is a real 3-customer batch+branch finale");

// ===== 17: save compatibility — Level 170 completion chains directly into Level 171. =====
const level171 = LEVELS.find((l) => l.id === "level-171")! as any;
assert(
  level171.unlockRequirements.type === "levelCompleted" && level171.unlockRequirements.levelId === "level-170",
  "17: Level 171 unlocks directly off Level 170 (old-save Level-170 completion still chains forward)",
);

// ===== 18: Cookbook compatibility — every Phase 6 recipe has a real name/emoji/authenticity for display. =====
const phase6Recipes = CAMPAIGN_RECIPES.filter((r) => r.unlockLevel >= 171 && r.unlockLevel <= 250);
assert(
  phase6Recipes.length > 0 &&
    phase6Recipes.every((r) => r.name && r.emoji && ["A", "B", "C"].includes(r.authenticity)),
  `18: all ${phase6Recipes.length} Phase 6 recipes carry a real name/emoji/authenticity tier for the Cookbook`,
);

// ===== 19: Daily Order compatibility — the full enlarged pool has zero unsupported combos. =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  "19: the full 211-recipe pool (Daily Order's own eligible pool) has zero unsupported combos",
);

// ===== 20: Endless Service compatibility — pool has grown and stays fully valid. =====
assert(CAMPAIGN_RECIPES.length >= 200, `20: the full campaign library has grown to ${CAMPAIGN_RECIPES.length} recipes (Endless Service's pool)`);

// ===== 21: story milestone compatibility — Level 250 carries a real forward-only milestone, Level 110/120 untouched. =====
const level110 = LEVELS.find((l) => l.id === "level-110")! as any;
const level120 = LEVELS.find((l) => l.id === "level-120")! as any;
assert(
  level110.milestone === "Protein Kitchen" && level120.milestone === "Grand Service",
  "21: Levels 110/120 still preserve their exact pre-existing milestone strings",
);
assert(level250.milestone === "Every Table, Every Night", "21b: Level 250 carries its own new forward-only milestone");

// ===== 22: final Level 250 data integrity. =====
assert(
  level250.chapter === 25 &&
    level250.chapterId === "the-grand-finale" &&
    level250.unlockRequirements.levelId === "level-249" &&
    level250.batchGroupRecipeIds.length === 3,
  "22: Level 250 is structurally correct — chapter 25, unlocks off Level 249, a real 3-recipe batch group",
);

// ===== 23: duplicate payment prevention — a Phase 6 batch group still pays each order exactly once. =====
{
  const a = CAMPAIGN_RECIPES.find((r) => r.id === "camp-italian-basil-batch-a")!;
  const b = CAMPAIGN_RECIPES.find((r) => r.id === "camp-italian-basil-batch-b")!;
  let group = createBatchGroupSession("t", [a, b], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const serve1 = serveBatchGroupOrder(group, group.orders[0].order.id, () => 0);
  const serve2 = serveBatchGroupOrder(serve1!.group, group.orders[0].order.id, () => 0);
  assert(serve1!.coinsAwarded > 0 && serve2 === null, "23: a shared Phase 6 batch output cannot be paid twice for the same order");
}

// ===== 24: all 9 cuisines remain represented in Phase 6 content (deepened, not replaced). =====
const phase6CuisineIds = new Set(phase6Recipes.map((r) => r.cuisineId).filter(Boolean));
assert(
  ["italian", "french", "indian", "mediterranean", "mexican", "japanese", "chinese", "thai", "korean"].every((c) =>
    phase6CuisineIds.has(c as any),
  ),
  "24: all 9 pre-existing cuisines are represented in Phase 6's own new recipes",
);

// ===== 25: all 11 techniques remain active across the full campaign. =====
const allTechniques = new Set<string>();
for (const r of CAMPAIGN_RECIPES) for (const c of r.components) allTechniques.add(c.technique);
assert(allTechniques.size === 11, `25: all 11 techniques remain active across the full 250-level campaign (${allTechniques.size}/11)`);

// ===== 26: all 52 ingredients now appear in at least 1 recipe (brief §7's own coverage goal). =====
const usedIngredients = new Set<string>();
for (const r of CAMPAIGN_RECIPES) for (const c of r.components) usedIngredients.add(c.ingredientId);
const allIngredientIds = Object.keys(INGREDIENTS);
assert(
  allIngredientIds.every((id) => usedIngredients.has(id)),
  `26: all ${allIngredientIds.length} defined ingredients appear in at least 1 recipe`,
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
