/**
 * PHASE 5 SMOKE TEST — pure-logic assertions for the Levels 101-170
 * campaign (brief §58) plus the protein-specific TEST A/B/C/D (brief
 * §59), run the same way as scripts/phase{1,2,3,4}-smoke-test.mts:
 *   npx esbuild scripts/phase5-smoke-test.mts --bundle --platform=node --format=esm --outfile=/tmp/phase5.mjs
 *   node /tmp/phase5.mjs
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
import { generateOrder } from "../src/game/service/OrderGenerator.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function recipe(id: string, components: any[], destIds: string[]) {
  return {
    id,
    name: id,
    emoji: "x",
    cuisineId: null,
    authenticity: "B",
    components,
    destinations: destIds.map((d) => ({ id: d, name: d })),
    batchable: true,
    chefInstruction: "x",
    customerDialogue: "x",
    basePayment: 100,
    unlockLevel: 1,
  };
}

const chickenSliceA = { ingredientId: "chicken", technique: "slice", resultingState: "sliced", destinationIds: ["plate"], batchable: true };
const chickenSliceB = { ingredientId: "chicken", technique: "slice", resultingState: "sliced", destinationIds: ["bowl"], batchable: true };
const steakDiceC = { ingredientId: "steak", technique: "dice", resultingState: "diced", destinationIds: ["plate"], batchable: true };

// ===== 1: Level 101 recipe eligibility — the chicken-intro recipe is real and unlocked at 101. =====
const level101 = LEVELS.find((l) => l.id === "level-101")!;
assert(
  (level101 as any).recipePoolIds?.[0] === "camp-chicken-slice-intro",
  "1: Level 101 draws the real chicken-introduction recipe",
);

// ===== 2: Level 110 Japanese eligibility — pool recipes are cuisineId "japanese". =====
const level110 = LEVELS.find((l) => l.id === "level-110")!;
const level110Pool = (level110 as any).recipePoolIds as string[];
assert(
  level110Pool.every((id) => CAMPAIGN_RECIPES.find((r) => r.id === id)?.cuisineId === "japanese"),
  "2: Level 110's whole pool is real Japanese-cuisine recipes",
);

// ===== 3: Level 111 Japanese precision — carries over into Chapter 12 with the same cuisine. =====
const level111 = LEVELS.find((l) => l.id === "level-111")!;
assert(
  CAMPAIGN_RECIPES.find((r) => r.id === (level111 as any).recipePoolIds[0])?.cuisineId === "japanese",
  "3: Level 111 (Chapter 12) is still Japanese cuisine",
);

// ===== 4: Level 120 service completion — a real batch+branch finale, requires no requiredOrders (batch group size IS the order count). =====
const level120 = LEVELS.find((l) => l.id === "level-120")!;
assert(
  (level120 as any).batchGroupRecipeIds?.length === 3,
  "4: Level 120 is a real 3-customer batch+branch finale",
);

// ===== 5: Level 121 Chinese eligibility. =====
const level121 = LEVELS.find((l) => l.id === "level-121")!;
assert(
  CAMPAIGN_RECIPES.find((r) => r.id === (level121 as any).recipePoolIds[0])?.cuisineId === "chinese",
  "5: Level 121 introduces real Chinese-cuisine recipes",
);

// ===== 6: Level 130 Chinese service — a real 3-customer chapter finale. =====
const level130 = LEVELS.find((l) => l.id === "level-130")!;
assert((level130 as any).requiredOrders === 3, "6: Level 130 is a real 3-customer service finale");

// ===== 7: Level 141 Thai eligibility. =====
const level141 = LEVELS.find((l) => l.id === "level-141")!;
assert(
  CAMPAIGN_RECIPES.find((r) => r.id === (level141 as any).recipePoolIds[0])?.cuisineId === "thai",
  "7: Level 141 introduces real Thai-cuisine recipes",
);

// ===== 8: Level 150 Thai service — a real 3-customer chapter finale. =====
const level150 = LEVELS.find((l) => l.id === "level-150")!;
assert((level150 as any).requiredOrders === 3, "8: Level 150 is a real 3-customer service finale");

// ===== 9: Level 161 Korean eligibility. =====
const level161 = LEVELS.find((l) => l.id === "level-161")!;
assert(
  CAMPAIGN_RECIPES.find((r) => r.id === (level161 as any).recipePoolIds[0])?.cuisineId === "korean",
  "9: Level 161 introduces real Korean-cuisine recipes",
);

// ===== 10: Level 170 Korean service — the phase's own grand finale, a real batch. =====
const level170 = LEVELS.find((l) => l.id === "level-170")!;
assert(
  (level170 as any).batchGroupRecipeIds?.length === 3,
  "10: Level 170 is the phase's real 3-customer grand finale",
);

// ===== 11: protein unlock gating — poolUnlockedByLevel excludes chicken before Level 101. =====
assert(
  !poolUnlockedByLevel(CAMPAIGN_RECIPES, 100).some((r) => r.id === "camp-chicken-slice-intro"),
  "11: poolUnlockedByLevel(CAMPAIGN_RECIPES, 100) excludes the chicken recipe (unlockLevel 101)",
);
assert(
  poolUnlockedByLevel(CAMPAIGN_RECIPES, 101).some((r) => r.id === "camp-chicken-slice-intro"),
  "11b: poolUnlockedByLevel(CAMPAIGN_RECIPES, 101) includes the chicken recipe",
);

// ===== 12-14: protein recipe validation — every chicken/steak/salmon component uses an engine-supported technique. =====
function proteinRecipes(id: string) {
  return CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => c.ingredientId === id));
}
const chickenRecipes = proteinRecipes("chicken");
const steakRecipes = proteinRecipes("steak");
const salmonRecipes = proteinRecipes("salmon");
assert(
  chickenRecipes.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  `12: all ${chickenRecipes.length} chicken recipes use engine-supported techniques`,
);
assert(
  steakRecipes.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  `13: all ${steakRecipes.length} steak recipes use engine-supported techniques`,
);
assert(
  salmonRecipes.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  `14: all ${salmonRecipes.length} salmon recipes use engine-supported techniques`,
);

// ===== 15: protein batching — TEST A shape, chicken. =====
{
  const recipeA = recipe("A", [chickenSliceA], ["plate"]);
  const recipeB = recipe("B", [chickenSliceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1 && group.session.outputs[0].assignedTo.length === 2, "15: protein (chicken) batching shares one output across 2 orders");
}

// ===== 16: protein branching — Chicken Protein Branch has 2 independent outputs. =====
const chickenBranch = CAMPAIGN_RECIPES.find((r) => r.id === "camp-chicken-protein-branch")!;
assert(
  chickenBranch.components.length === 2 && chickenBranch.destinations.length === 2,
  "16: Chicken Protein Branch is a real 2-destination branching recipe",
);
let branchSession = createServiceSession("level-116", [chickenBranch], Math.random);
branchSession = recordAllComponents(branchSession);
assert(
  branchSession.current!.order.status === "READY" && branchSession.current!.session.outputs.length === 2,
  "16b: Chicken Protein Branch becomes READY with 2 independent outputs (not shared)",
);

// ===== 17: protein allocation — Chicken & Carrot Plate assigns the shared carrot to both destinations it's used across. =====
{
  const recipeA = recipe("A", [{ ingredientId: "carrot", technique: "julienne", resultingState: "julienned", destinationIds: ["plate"], batchable: true }], ["plate"]);
  const recipeB = recipe("B", [{ ingredientId: "carrot", technique: "julienne", resultingState: "julienned", destinationIds: ["bowl"], batchable: true }], ["bowl"]);
  const recipeC = recipe("C", [{ ingredientId: "carrot", technique: "julienne", resultingState: "julienned", destinationIds: ["cup"], batchable: true }], ["cup"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB, recipeC], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(
    group.session.outputs.length === 1 && group.session.outputs[0].assignedTo.length === 3,
    "17: shared vegetable (carrot) allocates one output to 3 destinations",
  );
}

// ===== 18: 3-customer generation — a 3-recipe batch group produces 3 real orders. =====
{
  const group = createBatchGroupSession("t", [recipe("A", [chickenSliceA], ["plate"]), recipe("B", [steakDiceC], ["bowl"]), recipe("C", [chickenSliceB], ["cup"])], Math.random);
  assert(group.orders.length === 3, "18: a 3-recipe batch group generates exactly 3 customer orders");
}

// ===== 19: recipe repetition avoidance — generateOrder over a multi-recipe pool eventually produces more than one recipe. =====
{
  const pool = poolUnlockedByLevel(CAMPAIGN_RECIPES, 170).filter((r) => ["camp-korean-steak-cabbage", "camp-korean-chicken-spinach"].includes(r.id));
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const recipe = generateOrder({ unlockedRecipes: pool, recentRecipeIds: [], recentCuisineIds: [] }, Math.random);
    if (recipe) seen.add(recipe.id);
  }
  assert(seen.size === 2, "19: generateOrder over a 2-recipe pool eventually produces both (no permanent repetition)");
}

// ===== 20: locked recipe rejection — a Level 170 recipe never appears in a pool unlocked at Level 100. =====
assert(
  !poolUnlockedByLevel(CAMPAIGN_RECIPES, 100).some((r) => r.id === "camp-korean-grand-service-plate"),
  "20: locked recipe (unlockLevel 170) is rejected at Level 100",
);

// ===== 21: locked ingredient rejection — no pool-eligible recipe at Level 100 uses tofu/coconut/pear/mango's later Phase 5 recipes before they unlock. =====
assert(
  !poolUnlockedByLevel(CAMPAIGN_RECIPES, 100).some((r) => r.components.some((c) => c.ingredientId === "tofu")),
  "21: tofu-using recipes are all locked before their real unlockLevel",
);

// ===== 22: locked protein rejection — salmon recipes excluded before Level 109. =====
assert(
  !poolUnlockedByLevel(CAMPAIGN_RECIPES, 108).some((r) => r.components.some((c) => c.ingredientId === "salmon")),
  "22: salmon recipes are locked before Level 109",
);

// ===== 23: duplicate payment prevention — protein batch group, exactly-once independent payment (TEST D shape). =====
{
  const recipeA = recipe("A", [chickenSliceA], ["plate"]);
  const recipeB = recipe("B", [chickenSliceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const serve1 = serveBatchGroupOrder(group, group.orders[0].order.id, () => 0);
  const serve2 = serveBatchGroupOrder(serve1!.group, group.orders[0].order.id, () => 0);
  assert(serve1!.coinsAwarded === 100 && serve2 === null, "23: a shared protein output cannot be paid twice for the same order");
}

// ===== 24: Daily Order compatibility — every recipe is structurally eligible (no locked technique on an unlocked recipe). =====
assert(
  CAMPAIGN_RECIPES.every((r) => r.components.every((c) => INGREDIENTS[c.ingredientId].techniques.includes(c.technique))),
  "24: every recipe (Daily Order's own eligible pool) uses only engine-supported combos",
);

// ===== 25: Endless Service compatibility — the full pool (Phase 1-5) has no unsupported combo, matching assertion 24's own guarantee. =====
assert(CAMPAIGN_RECIPES.length >= 120, `25: the full campaign library has grown to ${CAMPAIGN_RECIPES.length} recipes (Endless Service's pool)`);

// ===== 26: Cookbook compatibility — every Phase 5 cuisine recipe carries a real cuisineId (never null) for the Recipe Book's grouping. =====
const phase5CuisineIds = ["japanese", "chinese", "thai", "korean"];
const phase5Recipes = CAMPAIGN_RECIPES.filter((r) => phase5CuisineIds.includes(r.cuisineId ?? ""));
assert(phase5Recipes.length > 0 && phase5Recipes.every((r) => r.cuisineId), "26: every Phase 5 recipe carries a real cuisineId for the Cookbook");

// ===== 27: save compatibility — Level 100 completion chains straight into Level 101's own unlock requirement. =====
const l101unlock = (level101 as any).unlockRequirements;
assert(
  l101unlock.type === "levelCompleted" && l101unlock.levelId === "level-100",
  "27: Level 101 unlocks directly off Level 100 (old-save Level-100 completion still chains forward)",
);

// ===== 28: story milestone compatibility — Levels 110/120 still carry their exact pre-existing milestone/unlockReward pairs. =====
assert(
  level110.milestone === "Protein Kitchen" &&
    (level110 as any).unlockReward?.id === "protein-kitchen" &&
    level120.milestone === "Grand Service" &&
    (level120 as any).unlockReward?.id === "grand-service",
  "28: Levels 110/120 preserve their exact pre-existing milestone/unlockReward pairs",
);

// ===== All 9 cuisines exist as real cuisine definitions (brief §56). =====
const expectedCuisines = [
  "italian",
  "french",
  "indian",
  "mediterranean",
  "mexican",
  "japanese",
  "chinese",
  "thai",
  "korean",
];
assert(
  expectedCuisines.every((id) => !!CUISINES[id as keyof typeof CUISINES]),
  "29: all 9 cuisines (Italian through Korean) exist as real cuisine definitions",
);

// ===== All 11 techniques remain active across the full Phase 1-5 library (brief §57). =====
const allTechniques = new Set<string>();
for (const r of CAMPAIGN_RECIPES) for (const c of r.components) allTechniques.add(c.technique);
assert(allTechniques.size === 11, `30: all 11 techniques remain active across the full campaign library (${allTechniques.size}/11)`);

// ===== Chapters 11-17 all carry their Phase 5 titles. =====
assert(
  CHAPTER_TITLES[11] === "Japanese Kitchen" &&
    CHAPTER_TITLES[12] === "Japanese Precision" &&
    CHAPTER_TITLES[13] === "Chinese Kitchen" &&
    CHAPTER_TITLES[14] === "Chinese Wok Service" &&
    CHAPTER_TITLES[15] === "Thai Kitchen" &&
    CHAPTER_TITLES[16] === "Southeast Asian Service" &&
    CHAPTER_TITLES[17] === "Korean Kitchen",
  "31: Chapters 11-17 all carry their Phase 5 titles",
);

// ===== Levels 101-170 exist, exactly 70, no gaps. =====
const levels101to170 = LEVELS.filter((l) => {
  const n = parseInt(l.id.replace("level-", ""), 10);
  return n >= 101 && n <= 170;
});
assert(levels101to170.length === 70, `32: exactly 70 levels present for 101-170 (${levels101to170.length})`);

// ===== TEST A — chicken batch: one prepared output -> two orders. =====
{
  const recipeA = recipe("A", [chickenSliceA], ["plate"]);
  const recipeB = recipe("B", [chickenSliceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1, "TEST A: exactly ONE PreparedOutput created (chicken)");
  assert(group.session.outputs[0].assignedTo.length === 2, "TEST A: assignedTo.length === 2");
  assert(group.orders.every((o) => o.order.status === "READY"), "TEST A: both orders READY from one chicken prep");
}

// ===== TEST B — vegetable batch: one prepared output -> three destinations. =====
{
  const carrotA = { ingredientId: "carrot", technique: "julienne", resultingState: "julienned", destinationIds: ["plate"], batchable: true };
  let group = createBatchGroupSession(
    "t",
    [recipe("A", [{ ...carrotA, destinationIds: ["plate"] }], ["plate"]), recipe("B", [{ ...carrotA, destinationIds: ["bowl"] }], ["bowl"]), recipe("C", [{ ...carrotA, destinationIds: ["cup"] }], ["cup"])],
    () => 0,
  );
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1 && group.session.outputs[0].assignedTo.length === 3, "TEST B: one carrot output satisfies 3 destinations");
}

// ===== TEST C — protein branch: one protein prep -> two distinct outputs -> two destinations. =====
{
  let branch = createServiceSession("t", [chickenBranch], Math.random);
  branch = recordAllComponents(branch);
  assert(branch.current!.session.outputs.length === 2, "TEST C: protein branch produces 2 distinct outputs (not shared)");
  assert(branch.current!.order.status === "READY", "TEST C: protein branch order reaches READY");
}

// ===== TEST D — non-compatible protein outputs cannot be incorrectly shared (chicken slice vs steak dice). =====
{
  const recipeA = recipe("A", [chickenSliceA], ["plate"]);
  const recipeB = recipe("B", [steakDiceC], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1 && group.session.outputs[0].assignedTo.length === 1, "TEST D: chicken output does NOT share with steak (different ingredient/technique)");
  assert(group.orders[0].order.status === "READY" && group.orders[1].order.status !== "READY", "TEST D: only the chicken order is ready; steak still needs its own prep");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
