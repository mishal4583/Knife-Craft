/**
 * PHASE 4 SMOKE TEST — pure-logic assertions for the Levels 41-100 campaign
 * (brief §52) plus the REAL-batching TEST A/B/C/D (brief §53), run the same
 * way as scripts/phase1/2/3-smoke-test.mts:
 *   npx esbuild scripts/phase4-smoke-test.mts --bundle --platform=node --format=esm --outfile=/tmp/phase4.mjs
 *   node /tmp/phase4.mjs
 *
 * Folds in and replaces the throwaway scripts/_batchgroup-quick-test.mts
 * and scripts/_validate-recipes.mts / _validate-levels-41-100.mts checks.
 */
import { INGREDIENTS } from "../src/game/definitions.ts";
// USD: an order pays its recipe's whole-dollar basePayment as wallet cents (money.ts dollars()).
import { dollars } from "../src/game/money.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import {
  createServiceSession,
  recordAllComponents,
  createBatchGroupSession,
  recordBatchGroupComponents,
  serveBatchGroupOrder,
  isBatchGroupComplete,
  currentBatchOrder,
  nextBatchOrder,
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

const tomatoDiceA = { ingredientId: "tomato", technique: "dice", resultingState: "diced", destinationIds: ["plate"], batchable: true };
const tomatoDiceB = { ingredientId: "tomato", technique: "dice", resultingState: "diced", destinationIds: ["bowl"], batchable: true };
const tomatoSliceC = { ingredientId: "tomato", technique: "slice", resultingState: "sliced", destinationIds: ["plate"], batchable: true };

// ===== 1: every campaign recipe (all 80, Phase 1-4) uses only engine-supported ingredient/technique combos. =====
let sawUnsupported = false;
const seenIds = new Set<string>();
let dupId = false;
for (const r of CAMPAIGN_RECIPES) {
  if (seenIds.has(r.id)) dupId = true;
  seenIds.add(r.id);
  for (const c of r.components) {
    if (!INGREDIENTS[c.ingredientId].techniques.includes(c.technique)) {
      sawUnsupported = true;
      console.error(`  unsupported: ${r.id} -> ${c.ingredientId}/${c.technique}`);
    }
  }
}
assert(!sawUnsupported, "1: every campaign recipe's ingredient/technique combos are engine-supported");
assert(!dupId, "2: no duplicate recipe ids across all 80 campaign recipes");
// >= not === : this is a permanent regression suite spanning every phase —
// later phases (Phase 5+) grow the library further, so a fixed count would
// go stale by design. 80 was Phase 4's own end-of-phase total.
assert(CAMPAIGN_RECIPES.length >= 80, `3: at least 80 total campaign recipes exist (${CAMPAIGN_RECIPES.length})`);

// ===== 4: Levels 41-100 exist, exactly 60, no gaps. =====
const levels41to100 = LEVELS.filter((l) => {
  const n = parseInt(l.id.replace("level-", ""), 10);
  return n >= 41 && n <= 100;
});
assert(levels41to100.length === 60, `4: exactly 60 levels present for 41-100 (${levels41to100.length})`);

// ===== 5: chapters 5-10 titles exist with their new Phase 4 identity. =====
assert(
  CHAPTER_TITLES[5] === "French Precision" &&
    CHAPTER_TITLES[6] === "Indian Kitchen" &&
    CHAPTER_TITLES[7] === "Indian Aromatics & Service" &&
    CHAPTER_TITLES[8] === "Mediterranean & Levant" &&
    CHAPTER_TITLES[9] === "Mexican & Latin Kitchen" &&
    CHAPTER_TITLES[10] === "Latin Service",
  "5: Chapters 5-10 all carry their Phase 4 titles",
);

// ===== 6: old-save compatibility — Levels 1-40 untouched (ids/chapter/coins spot-check). =====
const level40 = LEVELS.find((l) => l.id === "level-40")!;
assert(
  level40.chapter === 4 && level40.reward.coins === 158 && level40.milestone === "Breakfast Shelf",
  "6: Level 40 (last Phase 3 level) is untouched by the Phase 4 splice",
);

// ===== 7: milestone/unlockReward preserved exactly at L50/60/70/80/90/100. =====
const milestoneChecks: [string, string, string][] = [
  ["level-50", "Premium Knife Collection", "damascus"],
  ["level-60", "Herb Knife", "garden-cafe"],
  ["level-70", "Order Board", "pasta-kitchen"],
  ["level-80", "Bistro Kitchen", "drinks-counter"],
  ["level-90", "Chef's Special", "obsidian"],
  ["level-100", "Chef's Service", "grand-cafe"],
];
let milestonesOk = true;
for (const [id, milestone, rewardId] of milestoneChecks) {
  const lvl = LEVELS.find((l) => l.id === id)!;
  if (lvl.milestone !== milestone || (lvl.unlockReward as any)?.id !== rewardId) {
    milestonesOk = false;
    console.error(`  mismatch at ${id}: milestone=${lvl.milestone}, unlockReward.id=${(lvl.unlockReward as any)?.id}`);
  }
}
assert(milestonesOk, "7: all 6 milestone/unlockReward pairs (L50/60/70/80/90/100) preserved exactly");

// ===== 8: recipePoolIds/batchGroupRecipeIds are mutually exclusive and every referenced id exists. =====
const recipeIdSet = new Set(CAMPAIGN_RECIPES.map((r) => r.id));
let refsOk = true;
for (const lvl of levels41to100) {
  const l = lvl as any;
  if (l.recipePoolIds && l.batchGroupRecipeIds) refsOk = false;
  if (!l.recipePoolIds && !l.batchGroupRecipeIds) refsOk = false;
  for (const rid of l.recipePoolIds ?? []) if (!recipeIdSet.has(rid)) refsOk = false;
  for (const rid of l.batchGroupRecipeIds ?? []) if (!recipeIdSet.has(rid)) refsOk = false;
}
assert(refsOk, "8: every Level 41-100 has exactly one of recipePoolIds/batchGroupRecipeIds, all referencing real recipes");

// ===== 9: no chicken/steak/salmon anywhere in the Chapter 6-10 (Indian/Mediterranean/Mexican) recipes. =====
const chapter6to10LevelIds = new Set(
  LEVELS.filter((l) => l.chapter >= 6 && l.chapter <= 10).map((l) => l.id),
);
const chapter6to10RecipeIds = new Set<string>();
for (const lvl of LEVELS) {
  if (!chapter6to10LevelIds.has(lvl.id)) continue;
  const l = lvl as any;
  for (const rid of l.recipePoolIds ?? []) chapter6to10RecipeIds.add(rid);
  for (const rid of l.batchGroupRecipeIds ?? []) chapter6to10RecipeIds.add(rid);
}
let noProteinEarly = true;
for (const rid of chapter6to10RecipeIds) {
  const r = CAMPAIGN_RECIPES.find((r) => r.id === rid);
  if (r?.components.some((c) => ["chicken", "steak", "salmon"].includes(c.ingredientId))) {
    noProteinEarly = false;
    console.error(`  protein found early in ${rid}`);
  }
}
assert(noProteinEarly, "9: no chicken/steak/salmon in any Chapter 6-10 recipe (protein curve preserved)");

// ===== 10: at least 5 batchGroupRecipeIds levels exist within 61-100. =====
const batchLevels61to100 = LEVELS.filter((l) => {
  const n = parseInt(l.id.replace("level-", ""), 10);
  return n >= 61 && n <= 100 && (l as any).batchGroupRecipeIds;
});
assert(batchLevels61to100.length >= 5, `10: at least 5 batch levels in 61-100 (${batchLevels61to100.length})`);

// ===== 11: at least one 2-customer and one 3-customer batch scenario. =====
const has2 = batchLevels61to100.some((l) => (l as any).batchGroupRecipeIds.length === 2);
const has3 = batchLevels61to100.some((l) => (l as any).batchGroupRecipeIds.length === 3);
assert(has2, "11a: at least one 2-customer real batch scenario exists");
assert(has3, "11b: at least one 3-customer real batch scenario exists");

// ===== 12: Levels 45/70/100 (story milestones) are SERVICE type and reachable. =====
const l45 = LEVELS.find((l) => l.id === "level-45")!;
const l70 = LEVELS.find((l) => l.id === "level-70")!;
const l100 = LEVELS.find((l) => l.id === "level-100")!;
assert(
  l45.type === "SERVICE" && l70.type === "SERVICE" && l100.type === "SERVICE",
  "12: Levels 45/70/100 (story milestones) are all SERVICE-type levels",
);

// ===== 13: Level 70 is a genuine 3-customer real batch (not just a pool). =====
assert(
  (l70 as any).batchGroupRecipeIds?.length === 3,
  "13: Level 70 is a real 3-customer batch scenario",
);

// ===== 14: Level 100 is a genuine batch scenario too (grand finale). =====
assert(
  (l100 as any).batchGroupRecipeIds?.length >= 2,
  "14: Level 100 (grand finale) is a real multi-customer batch scenario",
);

// ===== TEST A — 2 orders, same batchable component, ONE output, assignedTo.length===2. =====
{
  const recipeA = recipe("A", [tomatoDiceA], ["plate"]);
  const recipeB = recipe("B", [tomatoDiceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1, "TEST A: exactly ONE PreparedOutput created");
  assert(group.session.outputs[0].assignedTo.length === 2, "TEST A: assignedTo.length === 2");
  assert(group.orders[0].order.status === "READY", "TEST A: order A is READY");
  assert(group.orders[1].order.status === "READY", "TEST A: order B is READY too (batched, never cut)");
}

// ===== TEST B — Tomato Slice vs Tomato Dice must NOT share. =====
{
  const recipeA = recipe("A", [tomatoSliceC], ["plate"]);
  const recipeB = recipe("B", [tomatoDiceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1, "TEST B: one output created for A");
  assert(group.session.outputs[0].assignedTo.length === 1, "TEST B: NOT shared with B (incompatible technique)");
  assert(group.orders[0].order.status === "READY", "TEST B: A is READY");
  assert(group.orders[1].order.status !== "READY", "TEST B: B is NOT ready (still needs its own dice)");
}

// ===== TEST C — 3 orders, one shared output, assignedTo.length===3. =====
{
  const recipeA = recipe("A", [{ ...tomatoDiceA, destinationIds: ["plate"] }], ["plate"]);
  const recipeB = recipe("B", [{ ...tomatoDiceA, destinationIds: ["bowl"] }], ["bowl"]);
  const recipeC = recipe("C", [{ ...tomatoDiceA, destinationIds: ["cup"] }], ["cup"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB, recipeC], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  assert(group.session.outputs.length === 1, "TEST C: exactly ONE output for all 3");
  assert(group.session.outputs[0].assignedTo.length === 3, "TEST C: assignedTo.length === 3");
  assert(group.orders.every((o) => o.order.status === "READY"), "TEST C: all 3 orders READY");
}

// ===== TEST D — a shared output cannot be paid twice; each order pays independently, exactly once. =====
{
  const recipeA = recipe("A", [tomatoDiceA], ["plate"]);
  const recipeB = recipe("B", [tomatoDiceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  group = recordBatchGroupComponents(group, group.orders[0].order.id);
  const serve1 = serveBatchGroupOrder(group, group.orders[0].order.id, () => 0);
  assert(serve1 !== null && serve1.coinsAwarded === dollars(100), "TEST D: first serve pays $100");
  const serve2 = serveBatchGroupOrder(serve1!.group, group.orders[0].order.id, () => 0);
  assert(serve2 === null, "TEST D: serving the same order again is refused (no double payment)");
  const serve3 = serveBatchGroupOrder(serve1!.group, group.orders[1].order.id, () => 0);
  assert(serve3 !== null && serve3.coinsAwarded === dollars(100), "TEST D: the OTHER order still pays its own $100 independently");
  assert(isBatchGroupComplete(serve3!.group), "TEST D: group complete once both served");
}

// ===== 15-16: branching — Pepper Two Ways (Levels 96/99), real 2-destination branch. =====
const pepperTwoWays = CAMPAIGN_RECIPES.find((r) => r.id === "camp-pepper-two-ways")!;
assert(
  pepperTwoWays.components.length === 2 && pepperTwoWays.destinations.length === 2,
  "15: Pepper Two Ways is a real 2-destination branching recipe",
);
let branchSession = createServiceSession("level-96", [pepperTwoWays], Math.random);
branchSession = recordAllComponents(branchSession);
assert(
  branchSession.current!.order.status === "READY",
  "16a: Pepper Two Ways becomes READY once both independent cuts are recorded",
);
assert(
  branchSession.current!.session.outputs.length === 2,
  "16b: Pepper Two Ways produces 2 independent outputs (not shared)",
);

// ===== 17: currentBatchOrder/nextBatchOrder progression through a batch group. =====
{
  const recipeA = recipe("A", [tomatoDiceA], ["plate"]);
  const recipeB = recipe("B", [tomatoDiceB], ["bowl"]);
  let group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  const first = currentBatchOrder(group);
  const second = nextBatchOrder(group);
  assert(first?.order.id === group.orders[0].order.id, "17a: currentBatchOrder returns the first unserved order");
  assert(second?.order.id === group.orders[1].order.id, "17b: nextBatchOrder returns the order after current");
}

// ===== 18: batchHintForGroup surfaces a real share, and returns null when there is none. =====
{
  const recipeA = recipe("A", [tomatoDiceA], ["plate"]);
  const recipeB = recipe("B", [tomatoDiceB], ["bowl"]);
  const group = createBatchGroupSession("t", [recipeA, recipeB], () => 0);
  const hint = batchHintForGroup(group, group.orders[0].order.id);
  assert(typeof hint === "string" && hint.length > 0, "18a: batchHintForGroup returns a real hint when a share exists");

  const recipeC = recipe("C", [tomatoSliceC], ["plate"]);
  const recipeD = recipe("D", [tomatoDiceB], ["bowl"]);
  const noShareGroup = createBatchGroupSession("t2", [recipeC, recipeD], () => 0);
  const noHint = batchHintForGroup(noShareGroup, noShareGroup.orders[0].order.id);
  assert(noHint === null, "18b: batchHintForGroup returns null when there is no real share");
}

// ===== 19: recipe count target sanity — total campaign library is honestly reported (not silently short). =====
assert(CAMPAIGN_RECIPES.length >= 50, `19: at least 50 campaign recipes exist (${CAMPAIGN_RECIPES.length})`);

// ===== 20: all 11 techniques remain reachable across the full Phase 1-4 recipe library. =====
const allTechniques = new Set<string>();
for (const r of CAMPAIGN_RECIPES) for (const c of r.components) allTechniques.add(c.technique);
assert(
  allTechniques.size === 11,
  `20: all 11 techniques appear across the full campaign recipe library (${allTechniques.size}/11)`,
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
