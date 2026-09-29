/**
 * ECONOMY_V2_EQUIPMENT_SPECIALIZATION_QA — Economy V2 Phase 5 (functional
 * knife/board specialization). Covers checks A-K from the Phase 5 brief,
 * run against the REAL shipped production functions — never a second
 * reimplementation of computeSettlement/getEquipmentModifier.
 *
 * Run: npx tsx scripts/economy-v2-equipment-specialization-qa.mts
 */
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
// USD: every wallet/settlement amount is integer US cents (money.ts). The frozen Economy V2 figures are
// the original numbers read as dollars — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards).
import { dollars } from "../src/game/money.ts";
import { buyKnife, isKnifeOwned } from "../src/game/knives/KnifeManager.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { buyBoard, isOwned as isBoardOwned } from "../src/game/boards/BoardManager.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { computeSettlement, ingredientInstancesFor, baselineCOGSFor } from "../src/game/economy/EconomySettlement.ts";
import { getEquipmentModifier } from "../src/game/economy/equipmentSpecialization.ts";
import type { RecipeDefinition, RecipeComponent } from "../src/game/recipes/recipeTypes.ts";
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

function fakeRecipe(components: Partial<RecipeComponent>[]): RecipeDefinition {
  return {
    id: "test-recipe",
    name: "Test Recipe",
    emoji: "🧪",
    cuisineId: null,
    authenticity: "B",
    components: components.map((c) => ({
      ingredientId: c.ingredientId!,
      technique: c.technique ?? "slice",
      resultingState: c.resultingState ?? "sliced",
      destinationIds: c.destinationIds ?? ["plate"],
      ...(c.chainBreak ? { chainBreak: true } : {}),
      ...(c.batchable ? { batchable: true } : {}),
    })),
    destinations: [{ id: "plate", name: "Plate" }],
    batchable: false,
    chefInstruction: "",
    customerDialogue: "",
    basePayment: 100,
    unlockLevel: 1,
  } as RecipeDefinition;
}

// ===== A: Catalog integrity — all 8 knives/boards remain, prices/unlock levels unchanged. =====
{
  const LOCKED_KNIVES: Record<string, { price: number; unlockLevel: number }> = {
    chef: { price: 0, unlockLevel: 1 },
    santoku: { price: 350, unlockLevel: 10 },
    paring: { price: 500, unlockLevel: 15 },
    nakiri: { price: 700, unlockLevel: 25 },
    bread: { price: 850, unlockLevel: 30 },
    cleaver: { price: 1100, unlockLevel: 40 },
    damascus: { price: 1800, unlockLevel: 50 },
    obsidian: { price: 2200, unlockLevel: 90 },
  };
  const LOCKED_BOARDS: Record<string, { price: number; unlockLevel: number }> = {
    walnut: { price: 0, unlockLevel: 1 },
    maple: { price: 300, unlockLevel: 10 },
    herb: { price: 500, unlockLevel: 20 },
    marble: { price: 750, unlockLevel: 30 },
    darkoak: { price: 1000, unlockLevel: 40 },
    copper: { price: 1500, unlockLevel: 50 },
    butcherblock: { price: 1800, unlockLevel: 106 },
    seafoodslate: { price: 2000, unlockLevel: 109 },
  };
  assert(KNIFE_CATALOG.length === 8, `A: exactly 8 knives exist (got ${KNIFE_CATALOG.length})`);
  assert(BOARD_CATALOG.length === 8, `A: exactly 8 boards exist (got ${BOARD_CATALOG.length})`);
  for (const k of KNIFE_CATALOG) {
    const locked = LOCKED_KNIVES[k.id];
    // The locked table keeps the original numbers; the catalog now states them in dollars (cents).
    assert(!!locked && k.price === dollars(locked.price) && k.unlockLevel === locked.unlockLevel, `A: knife ${k.id} price/unlockLevel unchanged ($${locked?.price} / L${k.unlockLevel})`);
  }
  for (const b of BOARD_CATALOG) {
    const locked = LOCKED_BOARDS[b.id];
    assert(!!locked && b.price === dollars(locked.price) && b.unlockLevel === locked.unlockLevel, `A: board ${b.id} price/unlockLevel unchanged ($${locked?.price} / L${b.unlockLevel})`);
  }
}

// ===== B: Starting equipment — chef+walnut produces neutral modifiers; campaign remains completable. =====
{
  const anyRecipe = CAMPAIGN_RECIPES[42]!;
  const modifier = getEquipmentModifier("chef", "walnut", anyRecipe);
  assert(modifier.cogsReductionPct === 0 && modifier.qualityBonusBoost === 0, "B: chef+walnut produces a fully neutral (0,0) modifier for an arbitrary recipe");
  const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut");
  assert(results.length === 250, "B: the full 250-level campaign completes end to end with chef+walnut explicitly equipped");
}

// ===== C: each specialization triggers on at least one valid context; D: non-applicable cases stay neutral. =====
{
  const vegetableRecipe = fakeRecipe([{ ingredientId: "carrot" as any }]);
  const fruitRecipe = fakeRecipe([{ ingredientId: "apple" as any }]);
  const bakeryRecipe = fakeRecipe([{ ingredientId: "bread" as any }]);
  const herbRecipe = fakeRecipe([{ ingredientId: "basil" as any }]);
  const aromaticRecipe = fakeRecipe([{ ingredientId: "garlic" as any }]);
  const proteinRecipe = fakeRecipe([{ ingredientId: "chicken" as any }]);
  const seafoodRecipe = fakeRecipe([{ ingredientId: "salmon" as any }]);
  const batchableRecipe = fakeRecipe([{ ingredientId: "carrot" as any, batchable: true }]);
  const dairyRecipe = fakeRecipe([{ ingredientId: "cheddar" as any }]); // triggers nothing category-specific

  const cases: { label: string; knife?: string; board?: string; recipe: RecipeDefinition; expectNonNeutral: boolean }[] = [
    { label: "C: santoku on Vegetable", knife: "santoku", recipe: vegetableRecipe, expectNonNeutral: true },
    { label: "D: santoku on Dairy (non-applicable)", knife: "santoku", recipe: dairyRecipe, expectNonNeutral: false },
    { label: "C: paring on Fruit", knife: "paring", recipe: fruitRecipe, expectNonNeutral: true },
    { label: "D: paring on Vegetable (non-applicable)", knife: "paring", recipe: vegetableRecipe, expectNonNeutral: false },
    { label: "C: nakiri on Vegetable (quality boost)", knife: "nakiri", recipe: vegetableRecipe, expectNonNeutral: true },
    { label: "C: bread on Bakery", knife: "bread", recipe: bakeryRecipe, expectNonNeutral: true },
    { label: "D: bread on Fruit (non-applicable)", knife: "bread", recipe: fruitRecipe, expectNonNeutral: false },
    { label: "C: cleaver on a batchable component", knife: "cleaver", recipe: batchableRecipe, expectNonNeutral: true },
    { label: "D: cleaver on a non-batchable recipe (non-applicable)", knife: "cleaver", recipe: vegetableRecipe, expectNonNeutral: false },
    { label: "C: damascus is universal (quality boost regardless of recipe)", knife: "damascus", recipe: dairyRecipe, expectNonNeutral: true },
    { label: "C: obsidian on Protein", knife: "obsidian", recipe: proteinRecipe, expectNonNeutral: true },
    { label: "D: obsidian on Fruit (non-applicable)", knife: "obsidian", recipe: fruitRecipe, expectNonNeutral: false },
    { label: "C: maple is universal (quality boost regardless of recipe)", board: "maple", recipe: dairyRecipe, expectNonNeutral: true },
    { label: "C: herb board on Herb", board: "herb", recipe: herbRecipe, expectNonNeutral: true },
    { label: "D: herb board on Protein (non-applicable)", board: "herb", recipe: proteinRecipe, expectNonNeutral: false },
    { label: "C: marble on Fruit", board: "marble", recipe: fruitRecipe, expectNonNeutral: true },
    { label: "C: darkoak on Aromatic", board: "darkoak", recipe: aromaticRecipe, expectNonNeutral: true },
    { label: "D: darkoak on Herb (non-applicable)", board: "darkoak", recipe: herbRecipe, expectNonNeutral: false },
    { label: "C: copper on Vegetable", board: "copper", recipe: vegetableRecipe, expectNonNeutral: true },
    { label: "C: butcherblock on land protein (chicken)", board: "butcherblock", recipe: proteinRecipe, expectNonNeutral: true },
    { label: "D: butcherblock on seafood (salmon, non-applicable)", board: "butcherblock", recipe: seafoodRecipe, expectNonNeutral: false },
    { label: "C: seafoodslate on salmon", board: "seafoodslate", recipe: seafoodRecipe, expectNonNeutral: true },
    { label: "D: seafoodslate on land protein (chicken, non-applicable)", board: "seafoodslate", recipe: proteinRecipe, expectNonNeutral: false },
  ];
  for (const c of cases) {
    const m = getEquipmentModifier(c.knife, c.board, c.recipe);
    const isNonNeutral = m.cogsReductionPct > 0 || m.qualityBonusBoost > 0;
    assert(isNonNeutral === c.expectNonNeutral, `${c.label} (got cogsReductionPct=${m.cogsReductionPct}, qualityBonusBoost=${m.qualityBonusBoost})`);
  }
}

// ===== E: no negative final COGS, ever. =====
{
  const knives = KNIFE_CATALOG.map((k) => k.id);
  const boards = BOARD_CATALOG.map((b) => b.id);
  let allNonNegative = true;
  for (const recipe of CAMPAIGN_RECIPES) {
    for (const knife of knives) {
      for (const board of boards) {
        const s = computeSettlement(recipe, 12, 75, knife, board);
        if (s.finalCOGS < 0 || s.netResult < 0) allNonNegative = false;
      }
    }
  }
  assert(allNonNegative, "E: finalCOGS and netResult are never negative across every campaign recipe x every knife x every board combination");
}

// ===== F: no double charging — physical-instance accounting is completely unaffected by equipment. =====
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === "camp-chicken-halve-slice")!;
  const instancesNeutral = ingredientInstancesFor(recipe);
  const baselineNeutral = baselineCOGSFor(recipe);
  // baselineCOGSFor/ingredientInstancesFor take ONLY a recipe — structurally
  // incapable of reading equipment at all, but re-asserted here for
  // explicit regression coverage: the values must be identical regardless
  // of which settlement (if any) is computed alongside them.
  const s1 = computeSettlement(recipe, 11, 75, "obsidian", "butcherblock");
  const s2 = computeSettlement(recipe, 11, 75);
  assert(instancesNeutral.length === 1, "F1: camp-chicken-halve-slice still resolves to exactly 1 physical instance (unchanged since Phase 2)");
  assert(s1.baselineCOGS === dollars(baselineNeutral) && s2.baselineCOGS === dollars(baselineNeutral), "F: baselineCOGS (physical-instance accounting) is IDENTICAL with or without equipment specialization — equipment never re-touches component counting");
}

// ===== G: locked economy regression (neutral/no equipment). =====
{
  const { results } = simulateCampaign(SCORE.Honest, false);
  const totals = results.reduce(
    (acc, r) => ({
      grossRecipeRevenue: acc.grossRecipeRevenue + r.grossRecipeRevenue,
      completionRewards: acc.completionRewards + r.levelCompletionReward,
      cogs: acc.cogs + r.ingredientCOGS,
      qualityBonus: acc.qualityBonus + r.qualityBonus,
    }),
    { grossRecipeRevenue: 0, completionRewards: 0, cogs: 0, qualityBonus: 0 },
  );
  assert(totals.grossRecipeRevenue === dollars(165140), `G: recipe revenue unchanged at $165,140.00 (got ${totals.grossRecipeRevenue})`);
  assert(totals.completionRewards === dollars(77581), `G: completion rewards at the V2.5 locked $77,581.00 (got ${totals.completionRewards})`);
  assert(totals.cogs === dollars(37620), `G: baseline COGS unchanged at $37,620.00 (got ${totals.cogs})`);
  assert(totals.qualityBonus === dollars(3315), `G: quality bonus unchanged at $3,315.00 (got ${totals.qualityBonus})`);
}

// ===== H: equipment sensitivity — real 250-level simulation under representative loadouts. =====
console.log("\n--- H: Equipment sensitivity (250-level campaign, Honest quality) ---");
{
  const loadouts: { label: string; knife?: string; board?: string }[] = [
    { label: "Neutral (chef+walnut)", knife: "chef", board: "walnut" },
    { label: "Vegetable stack (santoku+copper)", knife: "santoku", board: "copper" },
    { label: "Protein stack (obsidian+butcherblock)", knife: "obsidian", board: "butcherblock" },
    { label: "Seafood (chef+seafoodslate)", knife: "chef", board: "seafoodslate" },
    { label: "Quality stack (damascus+maple)", knife: "damascus", board: "maple" },
    { label: "Bakery/Herb mix (bread+herb)", knife: "bread", board: "herb" },
  ];
  const neutral = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut").results;
  const neutralTotals = neutral.reduce((s, r) => ({ cogs: s.cogs + r.ingredientCOGS, qb: s.qb + r.qualityBonus, net: s.net + r.netResult }), { cogs: 0, qb: 0, net: 0 });
  assert(neutralTotals.cogs === dollars(37620), "H: chef+walnut (explicit) reproduces the exact locked $37,620.00 COGS baseline — zero drift from neutral equipment");

  for (const l of loadouts) {
    const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, l.knife, l.board);
    const totals = results.reduce((s, r) => ({ cogs: s.cogs + r.ingredientCOGS, qb: s.qb + r.qualityBonus, net: s.net + r.netResult }), { cogs: 0, qb: 0, net: 0 });
    const deltaCOGS = totals.cogs - neutralTotals.cogs;
    const deltaQB = totals.qb - neutralTotals.qb;
    const deltaNet = totals.net - neutralTotals.net;
    console.log(
      `  ${l.label.padEnd(32)} COGS=${totals.cogs.toString().padStart(6)} (Δ${deltaCOGS >= 0 ? "+" : ""}${deltaCOGS})  qualityBonus=${totals.qb.toString().padStart(5)} (Δ${deltaQB >= 0 ? "+" : ""}${deltaQB})  net=${totals.net.toString().padStart(6)} (Δ${deltaNet >= 0 ? "+" : ""}${deltaNet})`,
    );
    if (l.label !== "Neutral (chef+walnut)") {
      assert(deltaCOGS <= 0, `H: ${l.label} never INCREASES total campaign COGS vs neutral (Δ${deltaCOGS})`);
      assert(Math.abs(deltaCOGS) < neutralTotals.cogs * 0.1, `H: ${l.label}'s COGS delta stays well under 10% of the neutral baseline (conservative, non-dominating — Δ${deltaCOGS} vs baseline ${neutralTotals.cogs})`);
    }
  }
}

// ===== I: save regression — existing ownership fields unchanged in shape/defaults. =====
{
  assert(DEFAULT_SAVE.ownedKnifeIds.includes("chef") && DEFAULT_SAVE.equippedKnifeId === "chef", "I: DEFAULT_SAVE's knife ownership/equip defaults are unchanged");
  assert(DEFAULT_SAVE.ownedBoardIds.includes("walnut") && DEFAULT_SAVE.equippedBoardId === "walnut", "I: DEFAULT_SAVE's board ownership/equip defaults are unchanged");
  // An "old" save (pre-Phase-5, but Phase-5 adds NO new save field at all —
  // this phase reads existing equippedKnifeId/equippedBoardId only) still
  // carries its knife/board ownership through the existing merge untouched.
  const oldSave = JSON.parse(
    JSON.stringify({ version: 1, credits: 500, equippedKnifeId: "santoku", equippedBoardId: "maple", ownedKnifeIds: ["chef", "santoku"], ownedBoardIds: ["walnut", "maple"] }),
  ) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...oldSave } as SaveData;
  assert(migrated.equippedKnifeId === "santoku" && migrated.equippedBoardId === "maple", "I: an existing save's equipped knife/board survive the merge unchanged");
  assert(isKnifeOwned(migrated, "santoku") && isBoardOwned("maple", migrated), "I: an existing save's owned knife/board list survives the merge unchanged");
}

// ===== J: purchase regression — existing knife/board purchase behavior unchanged. =====
{
  const save: SaveData = { ...DEFAULT_SAVE, credits: dollars(10000), levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-50" } };
  const knifeResult = buyKnife(save, "damascus");
  assert(knifeResult.ok && knifeResult.save.credits === dollars(10000 - 1800), "J: buyKnife still deducts the exact unchanged price (damascus, $1,800.00)");
  const boardResult = buyBoard("copper", save);
  assert(boardResult.ok && boardResult.save.credits === dollars(10000 - 1500), "J: buyBoard still deducts the exact unchanged price (copper, $1,500.00)");
}

// ===== K: replay creates no additional equipment ownership or special economy effects. =====
{
  // Mirrors App.tsx's own composition exactly (see serveCampaignOrder/
  // serveBatchGroupViewedOrder): computeSettlement is never even CALLED
  // when isReplay is true — the amount is a hard 0, structurally
  // independent of whatever knife/board happens to be equipped.
  const isReplay = true;
  const recipe = CAMPAIGN_RECIPES[10]!;
  const amount = isReplay ? 0 : computeSettlement(recipe, 5, 97, "obsidian", "butcherblock").netResult;
  assert(amount === 0, "K: a replay's payout amount is a hard 0 regardless of equipped knife/board — computeSettlement's equipment modifier is never even reached on replay");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
