/**
 * PHASE 3 SMOKE TEST — pure-logic assertions for the Levels 1-40 campaign
 * (brief §48), run the same way as scripts/phase1/2-smoke-test.mts:
 *   node --experimental-strip-types scripts/phase3-smoke-test.mts
 * (bundled with esbuild first).
 */
import { INGREDIENTS, TECHNIQUES } from "../src/game/definitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import {
  poolUnlockedByLevel,
  createServiceSession,
  recordAllComponents,
  sharesComponentWithNext,
  createBatchGroupSession,
  recordBatchGroupComponents,
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

// 0. Every campaign recipe only asks for ingredient/technique combos the engine actually supports.
let sawUnsupported = false;
for (const r of CAMPAIGN_RECIPES) {
  for (const c of r.components) {
    const supported = INGREDIENTS[c.ingredientId].techniques.includes(c.technique);
    if (!supported) {
      sawUnsupported = true;
      console.error(`  unsupported: ${r.id} -> ${c.ingredientId}/${c.technique}`);
    }
  }
}
assert(
  !sawUnsupported,
  "every campaign recipe's ingredient/technique combos are supported by definitions.ts",
);

// 1-8: level->pool wiring and technique introduction schedule.
const level1 = LEVELS.find((l) => l.id === "level-1")!;
const level10 = LEVELS.find((l) => l.id === "level-10")!;
const level11 = LEVELS.find((l) => l.id === "level-11")!;
const level20 = LEVELS.find((l) => l.id === "level-20")!;
const level21 = LEVELS.find((l) => l.id === "level-21")!;
const level30 = LEVELS.find((l) => l.id === "level-30")!;
const level31 = LEVELS.find((l) => l.id === "level-31")!;
const level40 = LEVELS.find((l) => l.id === "level-40")!;

function poolFor(level: (typeof LEVELS)[number]) {
  return (level.recipePoolIds ?? []).map((id) => CAMPAIGN_RECIPES.find((r) => r.id === id)!);
}

assert(
  !!level1.recipePoolIds?.length,
  "Level 1 has a real recipe pool (not a hardcoded single recipe)",
);
assert(
  poolFor(level1).every((r) => r.unlockLevel <= 1),
  "Level 1's pool contains only recipes valid at level 1",
);
assert(!!level10.recipePoolIds?.length, "Level 10 has a valid recipe pool");
assert(
  poolFor(level11).some((r) => r.cuisineId === "italian"),
  "Level 11 introduces an Italian-cuisine recipe",
);
assert(
  poolFor(level20).some((r) => r.cuisineId === "italian"),
  "Level 20 is still Italian",
);
assert(
  poolFor(level21).some((r) => r.components.some((c) => c.technique === "julienne")),
  "Level 21 introduces Julienne",
);
assert(poolFor(level30).length > 0, "Level 30 has a valid (reused) recipe pool");
assert(
  poolFor(level31).some((r) => r.cuisineId === "french"),
  "Level 31 introduces French cuisine",
);

const allPhase3Techniques = new Set(
  CAMPAIGN_RECIPES.flatMap((r) => r.components.map((c) => c.technique)),
);
assert(
  allPhase3Techniques.size === 11,
  `all 11 techniques appear across the Phase 3 recipe library (${allPhase3Techniques.size}/11)`,
);
const level40Pool = poolFor(level40);
assert(level40Pool.length > 0, "Level 40 has a valid recipe pool");

// 9-10: locked ingredient/technique rejection via unlockLevel gating.
const earlyPool = CAMPAIGN_RECIPES.filter((r) => r.unlockLevel <= 5);
assert(
  earlyPool.every((r) =>
    r.components.every((c) => c.technique !== "chiffonade" && c.technique !== "rockMince"),
  ),
  "no recipe reachable by level 5 uses a not-yet-introduced technique (chiffonade/rockMince)",
);
const gated = poolUnlockedByLevel(CAMPAIGN_RECIPES, 20);
assert(
  !gated.some((r) => r.id === "camp-rock-minced-garlic-herb"),
  "poolUnlockedByLevel(20) excludes a French Chapter 4 recipe (unlockLevel 34)",
);

// 11-12: cuisine filtering + recipe reuse across levels.
const italianOnly = CAMPAIGN_RECIPES.filter((r) => r.cuisineId === "italian");
assert(italianOnly.length >= 9, `at least 9 Italian recipes exist (${italianOnly.length})`);
const bruschettaTrioLevels = LEVELS.filter((l) =>
  l.recipePoolIds?.includes("camp-bruschetta-trio"),
);
assert(
  bruschettaTrioLevels.length >= 2,
  "camp-bruschetta-trio is reused across more than one level's pool",
);

// 13: controlled repetition avoidance — 200 draws from a 2-recipe pool should hit both.
const batchPool = [
  CAMPAIGN_RECIPES.find((r) => r.id === "camp-bruschetta-trio")!,
  CAMPAIGN_RECIPES.find((r) => r.id === "camp-garden-tomato-cup")!,
];
const seen = new Set<string>();
for (let i = 0; i < 200; i++) {
  const picked = generateOrder(
    { unlockedRecipes: batchPool, recentRecipeIds: [], recentCuisineIds: [] },
    Math.random,
  );
  if (picked) seen.add(picked.id);
}
assert(seen.size === 2, "generateOrder over a 2-recipe pool eventually produces both (200 draws)");

// 14: batching — Level 26 (bruschetta trio + garden tomato cup) shares tomato/dice.
// KnifeCraft_Level_System_v2.docx turned Level 26 from a random 2-order pool into a REAL
// batch group (batchGroupRecipeIds) of the same two recipes — so this now
// checks the stronger property: dicing the tomato once really serves both.
const level26 = LEVELS.find((l) => l.id === "level-26")!;
const level26Recipes = (level26.batchGroupRecipeIds ?? [])
  .map((id) => CAMPAIGN_RECIPES.find((r) => r.id === id))
  .filter((r): r is NonNullable<typeof r> => !!r);
assert(level26Recipes.length === 2, "Level 26 is a real 2-order batching scenario");
let level26Group = createBatchGroupSession("level-26", level26Recipes, () => 0);
level26Group = recordBatchGroupComponents(level26Group, level26Group.orders[0]!.order.id);
const sharedTomato = level26Group.session.outputs.find(
  (o) => o.ingredientId === "tomato" && o.preparationState === "diced",
);
assert(
  !!sharedTomato && sharedTomato.assignedTo.length === 2,
  "Level 26's pool shares a real batching opportunity (tomato/dice)",
);

// 15: branching — Onion Two Ways (Level 28).
// Phase 7.1 (Bug B fix) gave each of this recipe's two independent onion
// instances its own Peel step first (onion is peel-mandatory —
// PreparationScene.requiresPeelFirst() — and stepsForRecipe.ts never
// inserted one automatically), so this recipe now has 4 components/
// outputs (peel+slice, peel+dice) instead of the old, actually-unplayable
// 2 (slice, dice). The branching property under test — 2 independent,
// non-shared destinations — is unchanged; only the honest component count
// changed alongside the real gameplay fix.
const onionTwoWays = CAMPAIGN_RECIPES.find((r) => r.id === "camp-onion-two-ways")!;
assert(
  onionTwoWays.components.length === 4 && onionTwoWays.destinations.length === 2,
  "Onion Two Ways is a real 2-destination branching recipe (peel + slice, peel + dice)",
);
let branchSession = createServiceSession("level-28", [onionTwoWays], Math.random);
branchSession = recordAllComponents(branchSession);
assert(
  branchSession.current!.order.status === "READY",
  "Onion Two Ways becomes READY once both independent cuts are recorded",
);
assert(
  branchSession.current!.session.outputs.length === 4,
  "Onion Two Ways produces 4 independent outputs (2 peels + 2 non-shared cuts)",
);

// 16: destination allocation — Family Antipasto for Two (Level 29), one output feeding two named destinations.
const familyAntipasto = CAMPAIGN_RECIPES.find((r) => r.id === "camp-family-antipasto-for-two")!;
let sharedSession = createServiceSession("level-29", [familyAntipasto], Math.random);
sharedSession = recordAllComponents(sharedSession);
assert(
  sharedSession.current!.order.status === "READY",
  "Family Antipasto for Two becomes READY after one shared preparation pass",
);
// KnifeCraft_Level_System_v2.docx gave this recipe a third shared component (mozzarella);
// the property is unchanged: ONE output per component, each feeding BOTH plates.
assert(
  sharedSession.current!.session.outputs.length === familyAntipasto.components.length &&
    familyAntipasto.components.length === 3 &&
    sharedSession.current!.session.outputs.every((o) => o.assignedTo.length === 2),
  `each of Family Antipasto's ${familyAntipasto.components.length} components produced exactly 1 output, each assigned to both named plates`,
);

// 17-19: service completion / full payment / no duplicate payment — reuse Phase 2's own proven mechanics; here we
// just confirm the campaign recipes' basePayment values are all positive, flat, and never derived from time/score.
assert(
  CAMPAIGN_RECIPES.every((r) => r.basePayment > 0 && Number.isInteger(r.basePayment)),
  "every campaign recipe has a flat, positive integer basePayment",
);

// Chapter/coverage sanity.
assert(
  CHAPTER_TITLES[1] !== undefined && CHAPTER_TITLES[4] !== undefined,
  "Chapters 1-4 titles exist",
);
const ch1to4Levels = LEVELS.filter((l) => l.chapter >= 1 && l.chapter <= 4);
assert(
  ch1to4Levels.length === 40,
  `Chapters 1-4 contain exactly 40 levels (${ch1to4Levels.length})`,
);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
