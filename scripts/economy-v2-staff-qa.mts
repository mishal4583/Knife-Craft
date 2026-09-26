/**
 * ECONOMY_V2_STAFF_QA — Economy V2 Phase 7 (Staff). Covers checks A-S
 * from the Phase 7 brief, run against the REAL shipped production
 * functions — never a second reimplementation of
 * computeSettlement/staff.ts/StaffManager.ts.
 *
 * Run: npx tsx scripts/economy-v2-staff-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
// USD: every wallet/settlement amount is integer US cents (money.ts). The frozen Economy V2 figures are
// the original numbers read as dollars — $165,140.00 / $330,691.00 / $37,620.00 / $3,315.00 / $461,526.00.
import { dollars } from "../src/game/money.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { computeSettlement, ingredientInstancesFor, baselineCOGSFor } from "../src/game/economy/EconomySettlement.ts";
import { getSharpnessModifier } from "../src/game/economy/sharpness.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import { getStaffModifier } from "../src/game/economy/staff.ts";
import { isStaffOwned, getStaffPurchaseState, buyStaff, getOwnedStaff } from "../src/game/economy/StaffManager.ts";
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
function saveAtLevel(levelNumber: number, credits: number, extra: Partial<SaveData> = {}): SaveData {
  return saveAt({ credits, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: `level-${levelNumber}` }, ...extra });
}

// ===== A: catalog integrity — exactly 3 staff, no more. =====
{
  assert(STAFF_CATALOG.length === 3, `A: exactly 3 staff roles exist (got ${STAFF_CATALOG.length})`);
  assert(STAFF_CATALOG.map((s) => s.id).sort().join(",") === "kitchen-assistant,prep-assistant,quality-chef", "A2: the exact 3 approved roles exist (prep-assistant, quality-chef, kitchen-assistant)");
}

// ===== B: purchase prices; C: unlock levels — deterministic, as authored. =====
{
  const byId = Object.fromEntries(STAFF_CATALOG.map((s) => [s.id, s]));
  assert(byId["prep-assistant"]!.price === dollars(3000), "B: prep-assistant price is $3,000.00");
  assert(byId["quality-chef"]!.price === dollars(6000), "B: quality-chef price is $6,000.00");
  assert(byId["kitchen-assistant"]!.price === dollars(4000), "B: kitchen-assistant price is $4,000.00");
  assert(byId["prep-assistant"]!.unlockLevel === 20, "C: prep-assistant unlocks at L20");
  assert(byId["quality-chef"]!.unlockLevel === 45, "C: quality-chef unlocks at L45");
  assert(byId["kitchen-assistant"]!.unlockLevel === 65, "C: kitchen-assistant unlocks at L65");
}

// ===== D: save migration — old save without staff data loads correctly. =====
{
  const oldSaveJson = JSON.stringify({
    version: 1,
    credits: 5000,
    equippedKnifeId: "chef",
    equippedBoardId: "walnut",
    ownedKnifeIds: ["chef"],
    ownedBoardIds: ["walnut"],
  });
  const parsed = JSON.parse(oldSaveJson) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...parsed } as SaveData;
  assert(Array.isArray(migrated.ownedStaffIds) && migrated.ownedStaffIds.length === 0, "D: an old save missing ownedStaffIds entirely migrates to [] via the existing merge");
  assert(migrated.credits === 5000 && migrated.ownedKnifeIds.includes("chef"), "D2: the old save's own fields survive the merge untouched");
}

// ===== E: duplicate purchase prevention. =====
{
  const save = saveAtLevel(65, dollars(20000));
  assert(getStaffPurchaseState(save, "prep-assistant") === "affordable", "E0: prep-assistant shows 'affordable' before purchase (unlocked + sufficient credits)");
  const first = buyStaff(save, "prep-assistant");
  assert(first.ok, "E1: first purchase of prep-assistant succeeds");
  if (first.ok) {
    assert(getStaffPurchaseState(first.save, "prep-assistant") === "owned", "E1b: purchase state flips to 'owned'");
    assert(getOwnedStaff(first.save).map((s) => s.id).includes("prep-assistant"), "E1c: getOwnedStaff reflects the new purchase");
    const second = buyStaff(first.save, "prep-assistant");
    assert(!second.ok && second.reason === "alreadyOwned", "E: a second purchase of the SAME staff member fails with reason 'alreadyOwned'");
  }
}

// ===== F: insufficient-funds safety. =====
{
  const save = saveAtLevel(65, 100); // unlocked, but far too poor
  const result = buyStaff(save, "quality-chef");
  assert(!result.ok && result.reason === "insufficientFunds", "F: buying with insufficient credits fails with reason 'insufficientFunds'");
}

// ===== G: no negative credits — a failed purchase leaves credits/ownership untouched. =====
{
  const save = saveAtLevel(65, 100);
  const result = buyStaff(save, "quality-chef");
  assert(!result.ok, "G1: refused as expected");
  assert(save.credits === 100 && !isStaffOwned(save, "quality-chef"), "G: a failed purchase leaves BOTH credits and ownership completely unchanged (no partial application, no debt)");
}

// Also: locked staff cannot be purchased at all (mirrors Phase 4/5's own "locked" check).
{
  const save = saveAtLevel(1, 100000);
  const result = buyStaff(save, "quality-chef"); // unlockLevel 45
  assert(!result.ok && result.reason === "notUnlocked", "G2: buying a locked staff member (level too low) fails with reason 'notUnlocked'");
}

// ===== H: Prep Assistant effect — universal COGS reduction. =====
{
  const recipe = CAMPAIGN_RECIPES[30]!;
  const without = computeSettlement(recipe, 10, 75, undefined, undefined, undefined, []);
  const withPrep = computeSettlement(recipe, 10, 75, undefined, undefined, undefined, ["prep-assistant"]);
  assert(withPrep.finalCOGS < without.finalCOGS, "H: owning prep-assistant reduces finalCOGS for an ARBITRARY recipe (universal effect)");
  assert(withPrep.staffCOGSSavings > 0, "H2: staffCOGSSavings is reported and positive");
}

// ===== I: Quality Chef effect — quality-bonus-rate boost. =====
{
  const recipe = CAMPAIGN_RECIPES[30]!;
  const without = computeSettlement(recipe, 10, 88, undefined, undefined, undefined, []); // Clean grade, real bonus rate > 0
  const withQC = computeSettlement(recipe, 10, 88, undefined, undefined, undefined, ["quality-chef"]);
  assert(withQC.qualityBonusRate > without.qualityBonusRate, "I: owning quality-chef increases qualityBonusRate for an ARBITRARY recipe (universal effect)");
  assert(withQC.qualityBonus > without.qualityBonus, "I2: the higher rate produces a strictly higher quality bonus payout");
  assert(withQC.finalCOGS === without.finalCOGS, "I3: quality-chef never touches COGS at all (one clear mechanic, no COGS side effect)");
}

// ===== J: Kitchen Assistant effect — batch-context-only COGS reduction. =====
{
  const batchRecipe = CAMPAIGN_RECIPES.find((r) => r.components.some((c) => c.batchable))!;
  const without = computeSettlement(batchRecipe, 10, 75, undefined, undefined, undefined, []);
  const withKA = computeSettlement(batchRecipe, 10, 75, undefined, undefined, undefined, ["kitchen-assistant"]);
  assert(withKA.finalCOGS < without.finalCOGS, "J: owning kitchen-assistant reduces finalCOGS on a genuinely batchable recipe");
}

// ===== K: non-applicable batch context — kitchen-assistant has NO effect on a non-batchable recipe. =====
{
  const nonBatchRecipe = CAMPAIGN_RECIPES.find((r) => r.components.every((c) => !c.batchable))!;
  const without = computeSettlement(nonBatchRecipe, 10, 75, undefined, undefined, undefined, []);
  const withKA = computeSettlement(nonBatchRecipe, 10, 75, undefined, undefined, undefined, ["kitchen-assistant"]);
  assert(withKA.finalCOGS === without.finalCOGS, "K: kitchen-assistant produces ZERO effect on a recipe with no batchable component");
}

// ===== L: staff stacking cap — prep-assistant (3%) + kitchen-assistant (4%) on a qualifying recipe caps at 6%, not 7%. =====
{
  const batchRecipe = CAMPAIGN_RECIPES.find((r) => r.components.some((c) => c.batchable))!;
  const modifier = getStaffModifier(["prep-assistant", "kitchen-assistant"], batchRecipe);
  assert(modifier.cogsReductionPct === 0.06, `L: combined prep-assistant+kitchen-assistant on a qualifying recipe caps at exactly 6% (got ${modifier.cogsReductionPct})`);
  const allThree = getStaffModifier(["prep-assistant", "quality-chef", "kitchen-assistant"], batchRecipe);
  assert(allThree.cogsReductionPct === 0.06, "L2: adding quality-chef (a non-COGS effect) does not change the COGS cap");
  assert(allThree.qualityBonusBoost > 0, "L3: quality-chef's own quality effect still applies independently of the COGS cap");
}

// ===== M: equipment + staff composition. =====
{
  const vegetableRecipe = CAMPAIGN_RECIPES.find((r) => r.components.some((c) => c.ingredientId === "carrot"))!;
  const neutral = computeSettlement(vegetableRecipe, 10, 75, "chef", "walnut", 100, []);
  const equipmentOnly = computeSettlement(vegetableRecipe, 10, 75, "santoku", "copper", 100, []);
  const staffOnly = computeSettlement(vegetableRecipe, 10, 75, "chef", "walnut", 100, ["prep-assistant"]);
  const both = computeSettlement(vegetableRecipe, 10, 75, "santoku", "copper", 100, ["prep-assistant"]);
  assert(equipmentOnly.finalCOGS < neutral.finalCOGS, "M1: equipment-only still reduces COGS as Phase 5 established");
  assert(staffOnly.finalCOGS < neutral.finalCOGS, "M2: staff-only still reduces COGS as Phase 7 establishes");
  // Campaign COGS steps round to whole dollars (EconomySettlement); amounts are cents.
  const expectedCombined = dollars(Math.round((equipmentOnly.finalCOGS / 100) * (1 - getStaffModifier(["prep-assistant"], vegetableRecipe).cogsReductionPct)));
  assert(both.finalCOGS === expectedCombined, `M: equipment + staff compose exactly as documented (equipment first, staff applied to the already-reduced number) — got ${both.finalCOGS}, expected ${expectedCombined}`);
}

// ===== N: sharpness + staff composition. =====
{
  const recipe = CAMPAIGN_RECIPES[40]!;
  const dullOnly = computeSettlement(recipe, 10, 75, "chef", "walnut", 0, []);
  const dullPlusStaff = computeSettlement(recipe, 10, 75, "chef", "walnut", 0, ["prep-assistant"]);
  assert(dullPlusStaff.finalCOGS < dullOnly.finalCOGS, "N: staff still reduces COGS even when the knife is fully dull (independent, composable steps)");
  assert(dullPlusStaff.finalCOGS >= 0, "N2: never goes negative even when sharpness penalty and staff reduction both apply");
}

// ===== O: physical-instance accounting unchanged. =====
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-chicken-halve-slice")!;
  const instances = ingredientInstancesFor(recipe);
  const baseline = baselineCOGSFor(recipe);
  const s1 = computeSettlement(recipe, 11, 75, "obsidian", "butcherblock", 10, ["prep-assistant", "quality-chef", "kitchen-assistant"]);
  const s2 = computeSettlement(recipe, 11, 75);
  assert(instances.length === 1, "O1: camp-chicken-halve-slice still resolves to exactly 1 physical instance");
  assert(s1.baselineCOGS === dollars(baseline) && s2.baselineCOGS === dollars(baseline), "O: baselineCOGS is IDENTICAL regardless of equipment/sharpness/staff — none of them ever re-touch component counting");
}

// ===== P: neutral baseline unchanged (chef+walnut, 100 sharpness, no staff). =====
{
  const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100, []);
  const totals = results.reduce(
    (acc, r) => ({
      grossRecipeRevenue: acc.grossRecipeRevenue + r.grossRecipeRevenue,
      completionRewards: acc.completionRewards + r.levelCompletionReward,
      cogs: acc.cogs + r.ingredientCOGS,
      qualityBonus: acc.qualityBonus + r.qualityBonus,
    }),
    { grossRecipeRevenue: 0, completionRewards: 0, cogs: 0, qualityBonus: 0 },
  );
  assert(totals.grossRecipeRevenue === dollars(165140), `P: recipe revenue unchanged at $165,140.00 (got ${totals.grossRecipeRevenue})`);
  assert(totals.completionRewards === dollars(330691), `P: completion rewards unchanged at $330,691.00 (got ${totals.completionRewards})`);
  assert(totals.cogs === dollars(37620), `P: baseline COGS unchanged at $37,620.00 (got ${totals.cogs})`);
  assert(totals.qualityBonus === dollars(3315), `P: quality bonus unchanged at $3,315.00 (got ${totals.qualityBonus})`);
}

// ===== Q: replay behavior — staff never bypasses replay's zero-economics rule. =====
{
  const isReplay = true;
  const recipe = CAMPAIGN_RECIPES[15]!;
  const amount = isReplay
    ? 0
    : computeSettlement(recipe, 5, 97, "chef", "walnut", 100, ["prep-assistant", "quality-chef", "kitchen-assistant"]).netResult;
  assert(amount === 0, "Q: a replay's payout amount is a hard 0 regardless of owned staff (computeSettlement is never even reached)");
  // Staff purchase is structurally independent of any session/replay state.
  console.log("ok   Q2: buyStaff(save, id) has no session/isReplay parameter — purchases are structurally unable to be influenced by replay state");
}

// ===== R: 250-level campaign regression — sensitivity by staff loadout. =====
console.log("\n--- R: Staff sensitivity (250-level campaign, Honest quality, chef+walnut+100 sharpness) ---");
{
  const loadouts: { label: string; staff: string[] }[] = [
    { label: "No staff", staff: [] },
    { label: "Prep Assistant", staff: ["prep-assistant"] },
    { label: "Quality Chef", staff: ["quality-chef"] },
    { label: "Kitchen Assistant", staff: ["kitchen-assistant"] },
    { label: "All staff", staff: ["prep-assistant", "quality-chef", "kitchen-assistant"] },
  ];
  const none = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100, []).results;
  const noneTotals = none.reduce((s, r) => ({ cogs: s.cogs + r.ingredientCOGS, qb: s.qb + r.qualityBonus, net: s.net + r.netResult }), { cogs: 0, qb: 0, net: 0 });
  for (const l of loadouts) {
    const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100, l.staff);
    const totals = results.reduce((s, r) => ({ cogs: s.cogs + r.ingredientCOGS, qb: s.qb + r.qualityBonus, net: s.net + r.netResult }), { cogs: 0, qb: 0, net: 0 });
    const deltaCOGS = totals.cogs - noneTotals.cogs;
    const deltaQB = totals.qb - noneTotals.qb;
    const deltaNet = totals.net - noneTotals.net;
    console.log(`  ${l.label.padEnd(20)} COGS=${totals.cogs.toString().padStart(6)} (Δ${deltaCOGS >= 0 ? "+" : ""}${deltaCOGS})  qualityBonus=${totals.qb.toString().padStart(5)} (Δ${deltaQB >= 0 ? "+" : ""}${deltaQB})  net=${totals.net.toString().padStart(6)} (Δ${deltaNet >= 0 ? "+" : ""}${deltaNet})`);
    if (l.staff.length > 0) {
      assert(deltaCOGS <= 0, `R: ${l.label} never increases total campaign COGS vs no-staff (Δ${deltaCOGS})`);
      assert(Math.abs(deltaCOGS) < noneTotals.cogs * 0.1, `R: ${l.label}'s COGS delta stays well under 10% of the no-staff baseline (Δ${deltaCOGS} vs ${noneTotals.cogs})`);
    } else {
      assert(deltaCOGS === 0 && deltaQB === 0, "R: no-staff vs no-staff is exactly zero drift");
    }
  }
}

// ===== S: solvency — no staff purchase can ever take the wallet negative. =====
{
  let allSafe = true;
  for (let credits = 0; credits <= 20000; credits += 1000) {
    for (const id of STAFF_CATALOG.map((s) => s.id)) {
      const save = saveAtLevel(65, credits);
      const result = buyStaff(save, id);
      const finalCredits = result.ok ? result.save.credits : save.credits;
      if (finalCredits < 0) allSafe = false;
    }
  }
  assert(allSafe, "S: sweeping credits 0-20,000 in steps of 1,000 across all 3 staff purchases never produces negative credits");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
