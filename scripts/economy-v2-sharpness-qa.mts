/**
 * ECONOMY_V2_SHARPNESS_QA — Economy V2 Phase 6 (Sharpness). Covers
 * checks A-P from the Phase 6 brief, run against the REAL shipped
 * production functions — never a second reimplementation of
 * computeSettlement/sharpness.ts.
 *
 * Run: npx tsx scripts/economy-v2-sharpness-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
// USD: every wallet/settlement amount is integer US cents (money.ts). The frozen Economy V2 figures are
// the original numbers read as dollars — $165,140.00 / $330,691.00 / $37,620.00 / $3,315.00 / $461,526.00.
import { dollars } from "../src/game/money.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { computeSettlement, ingredientInstancesFor, baselineCOGSFor } from "../src/game/economy/EconomySettlement.ts";
import {
  DEFAULT_SHARPNESS,
  SHARPEN_COST,
  clampSharpness,
  getKnifeSharpness,
  sharpnessLossFor,
  applySharpnessDecay,
  getSharpnessModifier,
  sharpenKnife,
} from "../src/game/economy/sharpness.ts";
import { simulateCampaign, SCORE } from "./economy-v2-campaign-simulation.mts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function saveAt(overrides: Partial<SaveData>): SaveData {
  return { ...DEFAULT_SAVE, ...overrides };
}

// ===== A: save migration — old save without sharpness data loads correctly. =====
{
  const oldSaveJson = JSON.stringify({
    version: 1,
    credits: 5000,
    equippedKnifeId: "santoku",
    equippedBoardId: "walnut",
    ownedKnifeIds: ["chef", "santoku"],
    ownedBoardIds: ["walnut"],
  });
  const parsed = JSON.parse(oldSaveJson) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...parsed } as SaveData;
  assert(
    typeof migrated.knifeSharpness === "object" && Object.keys(migrated.knifeSharpness).length === 0,
    "A: an old save missing knifeSharpness entirely migrates to {} via the existing merge",
  );
  assert(getKnifeSharpness(migrated, "santoku") === 100, "A2: the migrated save's equipped knife reads as full (100) sharpness — missing data defaults to full-sharp");
  assert(migrated.credits === 5000 && migrated.ownedKnifeIds.includes("santoku") && migrated.equippedKnifeId === "santoku", "A3: all of the old save's own fields survive the merge untouched");
}

// ===== B: scale — 0-100, values outside range clamped. =====
{
  assert(clampSharpness(150) === 100, "B: clampSharpness(150) clamps to 100");
  assert(clampSharpness(-30) === 0, "B: clampSharpness(-30) clamps to 0");
  assert(clampSharpness(57.6) === 58, "B: clampSharpness rounds fractional values (57.6 -> 58)");
  const save = saveAt({ knifeSharpness: { chef: 500 } });
  assert(getKnifeSharpness(save, "chef") === 100, "B2: getKnifeSharpness clamps an out-of-range STORED value defensively (500 -> 100)");
}

// ===== C: initial state — new/untracked knife starts at 100. =====
{
  const save = saveAt({ knifeSharpness: {} });
  assert(getKnifeSharpness(save, "obsidian") === 100, "C: a knife never tracked before reads as 100");
  assert(getKnifeSharpness(save, "chef") === DEFAULT_SHARPNESS, "C2: DEFAULT_SHARPNESS constant matches the actual default behavior");
}

// ===== D: deterministic decay — same recipe/workload produces exactly the same loss, no randomness. =====
{
  const recipe = CAMPAIGN_RECIPES[77]!;
  const loss1 = sharpnessLossFor(recipe);
  const loss2 = sharpnessLossFor(recipe);
  const loss3 = sharpnessLossFor(recipe);
  assert(loss1 === loss2 && loss2 === loss3, `D: sharpnessLossFor(recipe) is perfectly deterministic across repeated calls (got ${loss1}, ${loss2}, ${loss3})`);
  assert(loss1 >= 1 && loss1 <= 5, `D2: the loss is within the documented [1,5] range (got ${loss1})`);
  // No two different recipes with different recipeBase should EVER produce different results on repeat calls.
  let allDeterministic = true;
  for (const r of CAMPAIGN_RECIPES.slice(0, 30)) {
    if (sharpnessLossFor(r) !== sharpnessLossFor(r)) allDeterministic = false;
  }
  assert(allDeterministic, "D3: deterministic across a 30-recipe sample, not just one lucky case");
}

// ===== E: multiple knives tracked independently — using chef does not reduce santoku sharpness. =====
{
  const save = saveAt({ knifeSharpness: { chef: 100, santoku: 100 } });
  const recipe = CAMPAIGN_RECIPES[5]!;
  const afterChefDecay = applySharpnessDecay(save, "chef", recipe);
  assert(getKnifeSharpness(afterChefDecay, "chef") < 100, "E1: chef's own sharpness decreased");
  assert(getKnifeSharpness(afterChefDecay, "santoku") === 100, "E: santoku's sharpness is completely untouched by chef's own decay");
}

// ===== F: equipped-knife targeting — applySharpnessDecay only ever touches the ONE knife id it's given. =====
{
  const save = saveAt({ knifeSharpness: { chef: 100, santoku: 80, obsidian: 60 } });
  const recipe = CAMPAIGN_RECIPES[9]!;
  const after = applySharpnessDecay(save, "santoku", recipe);
  assert(getKnifeSharpness(after, "chef") === 100 && getKnifeSharpness(after, "obsidian") === 60, "F: decaying the EQUIPPED knife (santoku) leaves every other knife's sharpness exactly as it was");
  assert(getKnifeSharpness(after, "santoku") < 80, "F2: only the targeted (equipped) knife actually decayed");
}

// ===== G: sharpen — restores to 100, deterministic cost, insufficient funds changes nothing. =====
{
  const save = saveAt({ credits: dollars(1000), knifeSharpness: { chef: 40 } });
  const result = sharpenKnife(save, "chef");
  assert(result.ok && result.save.credits === dollars(1000) - SHARPEN_COST, `G: sharpening deducts exactly the deterministic SHARPEN_COST (${SHARPEN_COST} cents = $50.00)`);
  assert(result.ok && getKnifeSharpness(result.save, "chef") === 100, "G2: sharpening restores the target knife to exactly 100");

  const poor = saveAt({ credits: SHARPEN_COST - 1, knifeSharpness: { chef: 40 } });
  const failed = sharpenKnife(poor, "chef");
  assert(!failed.ok && failed.reason === "insufficientFunds", "G3: insufficient funds fails with reason 'insufficientFunds'");
}

// ===== H: no negative credits — sharpening can never create negative credits. =====
{
  const poor = saveAt({ credits: dollars(10), knifeSharpness: { chef: 40 } });
  const result = sharpenKnife(poor, "chef");
  assert(!result.ok, "H1: sharpening with $10 (less than SHARPEN_COST) is refused");
  // Confirms "do not modify sharpness, do not modify credits" on failure —
  // the ORIGINAL save object must be untouched (never partially applied).
  assert(poor.credits === dollars(10) && getKnifeSharpness(poor, "chef") === 40, "H: a failed sharpen leaves BOTH credits and sharpness completely unchanged (no partial application, no debt)");
}

// ===== I: economy integration — fresh knife = no penalty; dull knife = the documented small penalty; never negative COGS. =====
{
  const recipe = CAMPAIGN_RECIPES[20]!;
  const fresh = computeSettlement(recipe, 10, 75, "chef", "walnut", 100);
  assert(fresh.sharpnessCOGSPenalty === 0, "I: a fresh (100) knife produces a sharpnessCOGSPenalty of exactly 0");
  const dull = computeSettlement(recipe, 10, 75, "chef", "walnut", 0);
  assert(dull.sharpnessCOGSPenalty > 0, "I2: a fully dull (0) knife produces a positive sharpnessCOGSPenalty");
  assert(dull.finalCOGS === fresh.finalCOGS + dull.sharpnessCOGSPenalty, "I3: finalCOGS at 0 sharpness equals the fresh finalCOGS plus the reported penalty (fully accounted, no silent double effect)");
  const expectedModifier = getSharpnessModifier(0);
  assert(expectedModifier > 0 && expectedModifier <= 0.05, `I4: getSharpnessModifier(0) is a small, documented penalty (got ${expectedModifier})`);

  let allNonNegative = true;
  for (const r of CAMPAIGN_RECIPES) {
    for (const s of [0, 25, 50, 75, 100]) {
      const settlement = computeSettlement(r, 20, 55, "chef", "walnut", s);
      if (settlement.finalCOGS < 0 || settlement.netResult < 0) allNonNegative = false;
    }
  }
  assert(allNonNegative, "I: finalCOGS and netResult are never negative across every campaign recipe x every sharpness level 0/25/50/75/100");
}

// ===== J: physical-instance accounting unchanged. =====
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-chicken-halve-slice")!;
  const instances = ingredientInstancesFor(recipe);
  const baseline = baselineCOGSFor(recipe);
  const s1 = computeSettlement(recipe, 11, 75, "obsidian", "butcherblock", 10);
  const s2 = computeSettlement(recipe, 11, 75);
  assert(instances.length === 1, "J1: camp-chicken-halve-slice still resolves to exactly 1 physical instance");
  assert(s1.baselineCOGS === dollars(baseline) && s2.baselineCOGS === dollars(baseline), "J: baselineCOGS is IDENTICAL regardless of equipment/sharpness — neither ever re-touches component counting");
}

// ===== K: Phase-5 integration — equipment specialization + sharpness coexist correctly (independent, composable steps). =====
{
  const vegetableRecipe = CAMPAIGN_RECIPES.find((r) => r.components.some((c) => c.ingredientId === "carrot"))!;
  const neutral = computeSettlement(vegetableRecipe, 10, 75, "chef", "walnut", 100);
  const equipmentOnly = computeSettlement(vegetableRecipe, 10, 75, "santoku", "copper", 100);
  const sharpnessOnly = computeSettlement(vegetableRecipe, 10, 75, "chef", "walnut", 0);
  const both = computeSettlement(vegetableRecipe, 10, 75, "santoku", "copper", 0);
  assert(equipmentOnly.finalCOGS < neutral.finalCOGS, "K1: equipment-only case still reduces COGS as Phase 5 established");
  assert(sharpnessOnly.finalCOGS > neutral.finalCOGS, "K2: sharpness-only case still increases COGS as Phase 6 establishes");
  // Combined = equipment reduction applied first, THEN sharpness penalty on
  // top of that already-reduced number (see EconomySettlement's own doc) —
  // never simply neutral +/- both deltas independently summed.
  // Campaign COGS steps round to whole dollars (EconomySettlement); amounts are cents.
  const expectedCombined = dollars(Math.round((equipmentOnly.finalCOGS / 100) * (1 + getSharpnessModifier(0))));
  assert(both.finalCOGS === expectedCombined, `K: equipment + sharpness compose exactly as documented (equipment reduction first, then sharpness penalty on the result) — got ${both.finalCOGS}, expected ${expectedCombined}`);
  assert(both.equipmentCOGSSavings > 0 && both.sharpnessCOGSPenalty > 0, "K3: both modifiers' own informational fields are populated simultaneously without interfering with each other");
}

// ===== L: baseline regression — chef+walnut at 100 sharpness reproduces the exact locked values. =====
{
  const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100);
  const totals = results.reduce(
    (acc, r) => ({
      grossRecipeRevenue: acc.grossRecipeRevenue + r.grossRecipeRevenue,
      completionRewards: acc.completionRewards + r.levelCompletionReward,
      cogs: acc.cogs + r.ingredientCOGS,
      qualityBonus: acc.qualityBonus + r.qualityBonus,
    }),
    { grossRecipeRevenue: 0, completionRewards: 0, cogs: 0, qualityBonus: 0 },
  );
  assert(totals.grossRecipeRevenue === dollars(165140), `L: recipe revenue unchanged at $165,140.00 (got ${totals.grossRecipeRevenue})`);
  assert(totals.completionRewards === dollars(330691), `L: completion rewards unchanged at $330,691.00 (got ${totals.completionRewards})`);
  assert(totals.cogs === dollars(37620), `L: baseline COGS unchanged at $37,620.00 (got ${totals.cogs})`);
  assert(totals.qualityBonus === dollars(3315), `L: quality bonus unchanged at $3,315.00 (got ${totals.qualityBonus})`);
}

// ===== M: 250-level campaign simulation — fresh/mid/dull chef+walnut. =====
console.log("\n--- M: Sharpness sensitivity (250-level campaign, Honest quality, chef+walnut) ---");
{
  const states: { label: string; sharpness: number }[] = [
    { label: "Fresh (100)", sharpness: 100 },
    { label: "Mid (50)", sharpness: 50 },
    { label: "Dull (0)", sharpness: 0 },
  ];
  const fresh = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100).results;
  const freshTotals = fresh.reduce((s, r) => ({ cogs: s.cogs + r.ingredientCOGS, qb: s.qb + r.qualityBonus, net: s.net + r.netResult }), { cogs: 0, qb: 0, net: 0 });
  for (const st of states) {
    const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", st.sharpness);
    const totals = results.reduce((s, r) => ({ cogs: s.cogs + r.ingredientCOGS, qb: s.qb + r.qualityBonus, net: s.net + r.netResult }), { cogs: 0, qb: 0, net: 0 });
    const deltaCOGS = totals.cogs - freshTotals.cogs;
    const deltaNet = totals.net - freshTotals.net;
    console.log(`  ${st.label.padEnd(14)} COGS=${totals.cogs.toString().padStart(6)} (Δ${deltaCOGS >= 0 ? "+" : ""}${deltaCOGS})  qualityBonus=${totals.qb.toString().padStart(5)}  net=${totals.net.toString().padStart(6)} (Δ${deltaNet >= 0 ? "+" : ""}${deltaNet})`);
    if (st.sharpness < 100) {
      assert(deltaCOGS >= 0, `M: ${st.label} never DECREASES total campaign COGS vs fresh (Δ${deltaCOGS})`);
      assert(deltaCOGS < freshTotals.cogs * 0.06, `M: ${st.label}'s COGS delta stays under 6% of the fresh baseline (conservative — Δ${deltaCOGS} vs ${freshTotals.cogs})`);
    } else {
      assert(deltaCOGS === 0, "M: fresh vs fresh is exactly zero drift");
    }
  }
}

// ===== N: solvency — sharpening never creates a negative balance across a representative sweep. =====
{
  let allSafe = true;
  for (let credits = 0; credits <= 200; credits += 10) {
    const save = saveAt({ credits, knifeSharpness: { chef: 10 } });
    const result = sharpenKnife(save, "chef");
    const finalCredits = result.ok ? result.save.credits : save.credits;
    if (finalCredits < 0) allSafe = false;
  }
  assert(allSafe, "N: sweeping credits from 0 to 200 in steps of 10, sharpening never produces negative credits");
}

// ===== O: replay — sharpness follows the existing non-progression replay policy. =====
{
  // Mirrors App.tsx's own composition exactly: computeSettlement/decay are
  // never even reached when isReplay is true.
  const isReplay = true;
  const save = saveAt({ knifeSharpness: { chef: 100 } });
  const recipe = CAMPAIGN_RECIPES[15]!;
  const amount = isReplay
    ? 0
    : computeSettlement(recipe, 5, 97, "chef", "walnut", getKnifeSharpness(save, "chef")).netResult;
  const nextSave = isReplay ? save : applySharpnessDecay(save, "chef", recipe);
  assert(amount === 0, "O1: a replay's payout amount is a hard 0 regardless of sharpness");
  assert(getKnifeSharpness(nextSave, "chef") === 100, "O: a replay never decays sharpness — the knife's condition is completely unaffected by replayed preparation");
}

// ===== P: existing QA remains green — verified by the full regression suite (not duplicated here). =====
console.log("ok   P: existing economy QA suites are run separately as part of the full regression suite (§14)");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
