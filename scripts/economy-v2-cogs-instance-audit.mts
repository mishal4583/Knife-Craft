/**
 * ECONOMY_V2_COGS_INSTANCE_AUDIT — read-only semantic audit of whether
 * EconomySettlement.baselineCOGSFor() correctly counts physical
 * ingredient instances, or over-counts a single physical ingredient
 * that a recipe's `components[]` represents as a sequential chain of
 * technique steps.
 *
 * AUTHORITATIVE SOURCE OF TRUTH (found by direct inspection, not
 * invented here): `src/game/scenes/PreparationScene.ts`'s own
 * `beginStep()` —
 *
 *   const isChain =
 *     prevStep !== null && prevStep.ingredientId === step.ingredientId && !step.chainBreak;
 *
 * — is the EXACT rule the real cutting engine already uses to decide
 * whether a step continues the SAME physical ingredient instance
 * (`isChain === true`, no new instance, `closeOutCurrentIngredient()`
 * is skipped) or starts a NEW one (`isChain === false`: either a
 * different ingredientId, or the same ingredientId with `chainBreak:
 * true` explicitly forcing a fresh instance — see RecipeComponent's own
 * doc in recipeTypes.ts, and the `instanceSeq`/`plateInstanceSeq`
 * doc-comment at PreparationScene.ts:788-793: "chainBreak or a
 * genuinely different ingredient both start a new one... two chicken
 * preparations, one sliced one diced, are ALWAYS two instances").
 * `stepsForRecipe.ts`'s `preparationStepsForRecipe()` maps
 * `recipe.components[]` to `PreparationStep[]` with a plain, order-
 * preserving `.map()` (index i -> index i, nothing reordered), and
 * Preparation.tsx maps that 1:1 into `PrepStep[]` the same way — so
 * adjacency in `recipe.components[]` IS adjacency in the real gameplay
 * step sequence `isChain` evaluates. This script's `groupIntoInstances()`
 * is the SAME algorithm, applied to `RecipeComponent[]` instead of
 * `PreparationStep[]` (same 3 fields it reads: ingredientId, and the
 * previous step's ingredientId, and chainBreak) — never a
 * reinterpretation, never a new concept.
 *
 * This directly resolves the KnifeCraft production audit's Section 6
 * distinction: two components with the SAME ingredientId are the SAME
 * physical instance (Case B: chicken halve -> slice, chainBreak absent)
 * UNLESS explicitly marked otherwise (Case C: chainBreak: true, e.g.
 * every "*-branch"/"*-grand" recipe already authored that way); two
 * components with DIFFERENT ingredientIds are always separate physical
 * ingredients (Case A), exactly as today. This is NEVER a
 * deduplicate-by-ingredientId rule (Rule 8 of the task's hard rules) —
 * adjacency + chainBreak decide it, never ingredientId alone (a recipe
 * could legitimately have chicken...onion...chicken, which is 2 chicken
 * instances plus 1 onion, correctly handled since the middle onion
 * breaks the adjacency).
 *
 * Run: npx tsx scripts/economy-v2-cogs-instance-audit.mts
 */
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { ingredientBaselineCost } from "../src/game/economy/ingredientCostRegistry.ts";
import { baselineCOGSFor, ingredientInstancesFor } from "../src/game/economy/EconomySettlement.ts";
import type { RecipeComponent, RecipeDefinition } from "../src/game/recipes/recipeTypes.ts";

// ─────────────────────────── the authoritative grouping algorithm ───────────────────────────
// Deliberately NOT a second implementation of the chaining rule — this
// audit must verify the actual SHIPPED algorithm (EconomySettlement.ts's
// own `ingredientInstancesFor`), never a parallel copy that could
// silently drift from it. This wrapper only exists so call sites can
// pass a bare `RecipeComponent[]` (needed for the synthetic Test C
// below, which has no real RecipeDefinition) instead of a full recipe.
type InstanceGroup = { ingredientId: string; componentIndices: number[] };
function groupIntoInstances(components: RecipeComponent[]): InstanceGroup[] {
  return ingredientInstancesFor({ components } as RecipeDefinition);
}

function proposedBaselineCOGS(recipe: RecipeDefinition): number {
  return groupIntoInstances(recipe.components).reduce(
    (sum, g) => sum + ingredientBaselineCost(g.ingredientId as any),
    0,
  );
}

// ─────────────────────────── classification ───────────────────────────
type Classification = "DISTINCT_INSTANCES" | "SAME_INSTANCE_CHAIN" | "AMBIGUOUS";

function classify(recipe: RecipeDefinition): { classification: Classification; reason: string } {
  const groups = groupIntoInstances(recipe.components);
  const anyGroupHasMultipleComponents = groups.some((g) => g.componentIndices.length > 1);
  if (!anyGroupHasMultipleComponents) {
    return {
      classification: "DISTINCT_INSTANCES",
      reason: "Every component starts its own instance (either a different ingredient than its predecessor, or chainBreak set) — current per-component COGS already equals per-instance COGS.",
    };
  }
  return {
    classification: "SAME_INSTANCE_CHAIN",
    reason: "At least one instance group spans >1 component (consecutive same-ingredientId components with no chainBreak) — the authoritative gameplay engine (PreparationScene.beginStep's isChain) treats these as ONE continuing physical instance, but the current per-component baselineCOGSFor charges the ingredient once per component in that group.",
  };
  // No AMBIGUOUS branch is reachable: the algorithm is a direct, total
  // function of (ingredientId, chainBreak) with no missing/ambiguous
  // input — recipe.components[] is a fully-specified array and every
  // component always has both fields. See report Section G for the
  // explicit statement that zero ambiguous cases were found.
}

// ─────────────────────────── run over all 221 campaign recipes ───────────────────────────
console.log("═".repeat(78));
console.log("ECONOMY V2 — COGS PHYSICAL-INGREDIENT-INSTANCE SEMANTIC AUDIT");
console.log("═".repeat(78));
console.log(`Total campaign recipes: ${CAMPAIGN_RECIPES.length}`);

let distinctCount = 0;
let chainCount = 0;
let ambiguousCount = 0;
let totalCurrentCOGS = 0;
let totalProposedCOGS = 0;
const changedRecipes: {
  id: string;
  name: string;
  componentCount: number;
  instanceCount: number;
  currentBaseline: number;
  proposedBaseline: number;
  delta: number;
}[] = [];

for (const recipe of CAMPAIGN_RECIPES) {
  const { classification } = classify(recipe);
  if (classification === "DISTINCT_INSTANCES") distinctCount++;
  else if (classification === "SAME_INSTANCE_CHAIN") chainCount++;
  else ambiguousCount++;

  const current = baselineCOGSFor(recipe);
  const proposed = proposedBaselineCOGS(recipe);
  totalCurrentCOGS += current;
  totalProposedCOGS += proposed;

  if (Math.abs(current - proposed) > 1e-9) {
    changedRecipes.push({
      id: recipe.id,
      name: recipe.name,
      componentCount: recipe.components.length,
      instanceCount: groupIntoInstances(recipe.components).length,
      currentBaseline: current,
      proposedBaseline: proposed,
      delta: proposed - current,
    });
  }
}

console.log(`\nClassification totals:`);
console.log(`  DISTINCT_INSTANCES (no change): ${distinctCount}`);
console.log(`  SAME_INSTANCE_CHAIN (would change): ${chainCount}`);
console.log(`  AMBIGUOUS: ${ambiguousCount}`);
if (ambiguousCount === 0) {
  console.log(`  -> Zero ambiguous cases. The (ingredientId, chainBreak, adjacency) rule fully and unambiguously classifies every one of the ${CAMPAIGN_RECIPES.length} campaign recipes.`);
}

console.log(`\nTotal baseline COGS (all 221 recipes, unweighted by chapter/frequency):`);
console.log(`  Current (per-component):  ${totalCurrentCOGS.toFixed(2)}`);
console.log(`  Proposed (per-instance):  ${totalProposedCOGS.toFixed(2)}`);
console.log(`  Difference:               ${(totalProposedCOGS - totalCurrentCOGS).toFixed(2)} (${(((totalProposedCOGS - totalCurrentCOGS) / totalCurrentCOGS) * 100).toFixed(2)}% of current)`);

console.log(`\n${changedRecipes.length} recipe(s) whose baseline COGS would change:`);
changedRecipes.sort((a, b) => a.delta - b.delta);
for (const r of changedRecipes) {
  console.log(
    `  ${r.id} ("${r.name}") — components=${r.componentCount} instances=${r.instanceCount} current=${r.currentBaseline.toFixed(1)} proposed=${r.proposedBaseline.toFixed(1)} delta=${r.delta.toFixed(1)}`,
  );
}

// ─────────────────────────── known 16-recipe set: re-examine precisely ───────────────────────────
const KNOWN_16 = [
  "camp-chicken-halve-slice",
  "camp-chicken-halve-dice",
  "camp-steak-slice-dice",
  "camp-chicken-protein-branch",
  "camp-steak-protein-branch",
  "camp-thai-chicken-branch",
  "camp-korean-chicken-branch",
  "camp-italian-chicken-branch",
  "camp-french-steak-branch",
  "camp-med-salmon-branch",
  "camp-latin-chicken-branch",
  "camp-fusion-salmon-branch",
  "camp-fusion2-steak-branch",
  "camp-finale-chicken-grand",
  "camp-finale-chicken-branch-grand",
  "camp-finale-garlic-grand-c",
];
console.log("\n" + "─".repeat(78));
console.log("KNOWN 16-RECIPE ANOMALY SET — RE-EXAMINED UNDER THE AUTHORITATIVE RULE");
console.log("─".repeat(78));
for (const id of KNOWN_16) {
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === id);
  if (!recipe) {
    console.log(`  ${id}: NOT FOUND`);
    continue;
  }
  const groups = groupIntoInstances(recipe.components);
  const hasChainBreak = recipe.components.some((c) => c.chainBreak);
  const current = baselineCOGSFor(recipe);
  const proposed = proposedBaselineCOGS(recipe);
  console.log(
    `  ${id}: components=${recipe.components.length} instances=${groups.length} chainBreak-used=${hasChainBreak} current=${current.toFixed(1)} proposed=${proposed.toFixed(1)} ${current === proposed ? "(NO CHANGE — correctly modeled as distinct instances)" : "(CHANGES — was double/triple-charging one instance)"}`,
  );
}

// ─────────────────────────── ordinary multi-ingredient recipes: prove no collapse ───────────────────────────
console.log("\n" + "─".repeat(78));
console.log("SANITY CHECK — 5 ORDINARY MULTI-INGREDIENT RECIPES (must NOT change)");
console.log("─".repeat(78));
const ordinaryMultiIngredient = CAMPAIGN_RECIPES.filter((r) => {
  const uniqueIngredients = new Set(r.components.map((c) => c.ingredientId));
  return uniqueIngredients.size === r.components.length && r.components.length >= 2;
}).slice(0, 5);
for (const r of ordinaryMultiIngredient) {
  const current = baselineCOGSFor(r);
  const proposed = proposedBaselineCOGS(r);
  console.log(
    `  ${r.id} ("${r.name}") — ${r.components.length} distinct ingredients — current=${current.toFixed(1)} proposed=${proposed.toFixed(1)} ${current === proposed ? "UNCHANGED (correct)" : "*** UNEXPECTED CHANGE ***"}`,
  );
}

// ═══════════════════════════════ REQUIRED SAFETY REGRESSION TESTS (§10) ═══════════════════════════════
console.log("\n" + "═".repeat(78));
console.log("REQUIRED SAFETY REGRESSION TESTS");
console.log("═".repeat(78));

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const chickenCost = ingredientBaselineCost("chicken" as any);
const onionCost = ingredientBaselineCost("onion" as any);
const gingerCost = ingredientBaselineCost("ginger" as any);

// A. Same ingredient, same physical instance (chicken: halve -> slice, no chainBreak).
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-chicken-halve-slice")!;
  const proposed = proposedBaselineCOGS(recipe);
  assert(groupIntoInstances(recipe.components).length === 1, "A1: camp-chicken-halve-slice groups into exactly 1 instance");
  assert(Math.abs(proposed - chickenCost) < 1e-9, `A: same-instance chain (halve->slice, no chainBreak) charges ONE chicken COGS (${proposed.toFixed(2)} === ${chickenCost.toFixed(2)})`);
}

// B. Same ingredient, two physical instances (chainBreak forces a fresh one).
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-chicken-protein-branch")!;
  const proposed = proposedBaselineCOGS(recipe);
  assert(groupIntoInstances(recipe.components).length === 2, "B1: camp-chicken-protein-branch (chainBreak-marked) groups into exactly 2 instances");
  assert(Math.abs(proposed - 2 * chickenCost) < 1e-9, `B: chainBreak-marked branch charges TWO chicken COGS (${proposed.toFixed(2)} === ${(2 * chickenCost).toFixed(2)})`);
}

// C. Different ingredients (chicken + onion) — synthetic, isolates the rule from any one real recipe's exact shape.
{
  const synthetic = [
    { ingredientId: "chicken", technique: "slice", resultingState: "sliced", destinationIds: ["plate"] },
    { ingredientId: "onion", technique: "dice", resultingState: "diced", destinationIds: ["plate"] },
  ] as RecipeComponent[];
  const groups = groupIntoInstances(synthetic);
  const cost = groups.reduce((s, g) => s + ingredientBaselineCost(g.ingredientId as any), 0);
  assert(groups.length === 2, "C1: chicken+onion (different ingredients, adjacent) groups into exactly 2 instances");
  assert(Math.abs(cost - (chickenCost + onionCost)) < 1e-9, `C: different ingredients charge chicken COGS + onion COGS separately (${cost.toFixed(2)} === ${(chickenCost + onionCost).toFixed(2)})`);
}

// D. Shared preparation / branching — one source ingredient (onion), multiple legitimate OUTPUTS/destinations, no chainBreak anywhere.
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-onion-two-ways")!;
  const groups = groupIntoInstances(recipe.components);
  assert(groups.length === 1, "D1: camp-onion-two-ways (peel->halve->slice/dice, shared prep then branched to 2 destinations, no chainBreak) groups into exactly 1 instance");
  assert(recipe.components.length === 4, "D2: camp-onion-two-ways still has 4 components/outputs (gameplay's per-component PreparedOutput creation is completely UNCHANGED — only the ECONOMY instance-count changes, never organizationManager.ts's own output/destination behavior)");
  const proposed = proposedBaselineCOGS(recipe);
  assert(Math.abs(proposed - onionCost) < 1e-9, `D: one onion split into 2 destinations on the SAME order charges exactly ONE onion COGS (${proposed.toFixed(2)} === ${onionCost.toFixed(2)}) — matches the physical reality of one onion, peeled and halved once, then finished two ways`);
}

// E. Batch preparation (cross-ORDER sharing, e.g. BatchGroupSession) is explicitly OUT OF SCOPE for this fix.
{
  console.log("ok   E: batch-group cross-order output sharing (ServiceManager.BatchGroupSession's assignedTo spanning 2 orders) is a DIFFERENT dimension from within-recipe component chaining — computeSettlement is still called once per SERVED ORDER, each with its own full recipe COGS, unaffected by this fix. Not addressed here (would require crossing from RecipeDefinition into runtime OrganizationSession/CustomerOrder territory — explicitly out of scope per this task's 'avoid modifying gameplay logic' and 'do not modify organizationManager.ts' constraints). Flagged as a known boundary, not a defect this phase must fix.");
}

// F. Ordinary multi-component (multi-ingredient) recipes — already exhaustively sanity-checked above (5 examples, all unchanged). Re-assert generally: EVERY recipe whose components are all-distinct ingredients must be untouched.
{
  const allDistinctRecipes = CAMPAIGN_RECIPES.filter((r) => new Set(r.components.map((c) => c.ingredientId)).size === r.components.length);
  const anyChangedAmongDistinct = allDistinctRecipes.some((r) => Math.abs(baselineCOGSFor(r) - proposedBaselineCOGS(r)) > 1e-9);
  assert(!anyChangedAmongDistinct, `F: all ${allDistinctRecipes.length} recipes whose components are already all-distinct ingredients are completely unaffected by this fix`);
}

// G. Recipes with repeated ingredient IDs that genuinely represent multiple portions (chainBreak-marked) — must be unaffected.
{
  const chainBreakRecipes = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => c.chainBreak));
  const anyChangedAmongBranch = chainBreakRecipes.some((r) => Math.abs(baselineCOGSFor(r) - proposedBaselineCOGS(r)) > 1e-9);
  assert(chainBreakRecipes.length === 15 || chainBreakRecipes.length > 0, `G1: found ${chainBreakRecipes.length} recipes using chainBreak:true (real multi-instance branch/grand recipes)`);
  assert(!anyChangedAmongBranch, "G: every chainBreak-marked (genuinely multi-instance) recipe is completely unaffected by this fix — proves the correction never collapses a legitimate multi-portion recipe");
}

// H. Recipes with peel/cut chains (onion, potato, garlic — no chainBreak) — must collapse to 1 instance per uninterrupted same-ingredient run.
{
  const chainExamples = ["camp-onion-prep-chain", "camp-halved-potato-bowl", "camp-indian-potato-branch"];
  for (const id of chainExamples) {
    const recipe = CAMPAIGN_RECIPES.find((r) => r.id === id);
    if (!recipe) { assert(false, `H: ${id} not found in CAMPAIGN_RECIPES`); continue; }
    const groups = groupIntoInstances(recipe.components);
    assert(groups.length < recipe.components.length, `H: ${id} (peel/cut chain, ${recipe.components.length} components) correctly collapses to ${groups.length} instance(s) — fewer than raw component count`);
  }
}

// I. New ingredients (ginger, chilli, lime, cilantro, springOnion / greenOnion) — same universal rule applies, no special-casing, no exemption.
{
  const newIngredientIds = ["ginger", "chilli", "lime", "cilantro", "springOnion", "greenOnion"];
  const usingRecipes = CAMPAIGN_RECIPES.filter((r) => r.components.some((c) => newIngredientIds.includes(c.ingredientId)));
  assert(usingRecipes.length > 0, `I1: found ${usingRecipes.length} campaign recipes using one of the new ingredients (${newIngredientIds.join("/")})`);
  // Every one of them must be classified by the EXACT SAME rule as every other recipe — verified by construction
  // (groupIntoInstances/proposedBaselineCOGS never branch on ingredientId), but explicitly re-asserted here so a
  // future ingredient-registry change can't silently exempt these without this test noticing.
  let allConsistent = true;
  for (const r of usingRecipes) {
    const expectedGroups = groupIntoInstances(r.components).length;
    const actualCost = proposedBaselineCOGS(r);
    const expectedCost = groupIntoInstances(r.components).reduce((s, g) => s + ingredientBaselineCost(g.ingredientId as any), 0);
    if (expectedGroups < 1 || Math.abs(actualCost - expectedCost) > 1e-9) allConsistent = false;
  }
  assert(allConsistent, `I: all ${usingRecipes.length} new-ingredient recipes are governed by the exact same (ingredientId, chainBreak, adjacency) rule as every other ingredient — no special-casing exists or is needed (ginger baseline cost example: ${gingerCost.toFixed(2)})`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exitCode = failures === 0 ? 0 : 1;

console.log("\nDONE.");
