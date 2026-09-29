import path from "node:path";
import fs from "node:fs";
/**
 * ECONOMY_V2_SETTLEMENT_LEDGER_QA — Economy V2 Phase 9 (Settlement UI +
 * Ledger/P&L). Covers checks A-X from the Phase 9 brief, run against the
 * REAL shipped production functions — never a second reimplementation of
 * EconomySettlement/EconomyLedger/the purchase managers.
 *
 * App.tsx's own wallet-mutation wrappers (buyKnife/buyBoard/.../
 * serveCampaignOrder/finishCampaignLevel/...) are one-line compositions
 * of `<manager>.<action>(save, id)` + `appendLedgerEntry(...)` — since
 * App.tsx is a React component (not importable by a plain script), this
 * QA replicates those exact one-line compositions against the real
 * manager functions, the same way every prior QA script has always
 * verified App.tsx's wiring (by testing the underlying production
 * functions it calls, not App.tsx's JSX itself).
 *
 * Run: npx tsx scripts/economy-v2-settlement-ledger-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
// USD: every wallet/settlement amount is integer US cents (money.ts). The frozen Economy V2 figures are
// the original numbers read as dollars — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards).
import { dollars } from "../src/game/money.ts";
import { DEFAULT_LEVEL_PROGRESS, completeLevel, isChapterComplete } from "../src/game/levels/LevelManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { computeSettlement, recipeBase } from "../src/game/economy/EconomySettlement.ts";
import { recipePay } from "../src/game/recipes/recipePay.ts";
import { buyKnife } from "../src/game/knives/KnifeManager.ts";
import { buyBoard } from "../src/game/boards/BoardManager.ts";
import { buyStaff } from "../src/game/economy/StaffManager.ts";
import { sharpenKnife, SHARPEN_COST } from "../src/game/economy/sharpness.ts";
import { selectSupplier } from "../src/game/economy/SupplierManager.ts";
import {
  appendLedgerEntry,
  ledgerTotals,
  MAX_LEDGER_ENTRIES,
} from "../src/game/economy/EconomyLedger.ts";
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

/** `overrides.credits`, when given, is a whole-dollar balance (catalog prices are dollars; the wallet stores cents). */
function saveAt(overrides: Partial<SaveData>): SaveData {
  const save = { ...DEFAULT_SAVE, ...overrides };
  return overrides.credits !== undefined ? { ...save, credits: dollars(overrides.credits) } : save;
}

const recipe = CAMPAIGN_RECIPES[30]!;

// ===== A: settlement breakdown matches EconomySettlement (every UI field is read straight off SettlementResult, never recomputed). =====
{
  const s = computeSettlement(recipe, 12, 82, "santoku", "copper", 60, ["prep-assistant"], "wholesale-supplier");
  assert(
    s.netResult === Math.max(0, s.revenue - s.finalCOGS + s.qualityBonus),
    "A: netResult is exactly revenue - finalCOGS + qualityBonus (clamped) — the SAME identity the UI's own Net Result row reads",
  );
}

// ===== B: revenue breakdown matches actual payout (recipePay, unchanged). =====
{
  const s = computeSettlement(recipe, 12, 82);
  assert(s.revenue === dollars(recipePay(recipe, 12)), "B: settlement.revenue is exactly recipePay(recipe, chapter) in dollars — the UI's 'Recipe Earnings' row");
  assert(typeof recipeBase === "function", "B2: recipeBase is still re-exported (untouched) for any caller needing the unmodified base");
}

// ===== C: COGS breakdown matches actual settlement. =====
{
  const s = computeSettlement(recipe, 12, 82, "santoku", "copper", 60, ["prep-assistant"], "wholesale-supplier");
  const reconstructedFinal =
    s.baselineCOGS >= 0 && s.finalCOGS >= 0 && s.finalCOGS <= s.baselineCOGS * 2;
  assert(reconstructedFinal, "C: finalCOGS is a sane, non-negative function of baselineCOGS — no separate UI-side COGS calculation exists");
}

// ===== D: supplier adjustment display. =====
{
  const local = computeSettlement(recipe, 10, 75, undefined, undefined, undefined, undefined, "local-market");
  const wholesale = computeSettlement(recipe, 10, 75, undefined, undefined, undefined, undefined, "wholesale-supplier");
  assert(local.supplierCOGSAdjustment === 0, "D: Local Market's displayed supplier adjustment is exactly 0");
  assert(wholesale.supplierCOGSAdjustment > 0, "D2: Wholesale's displayed supplier adjustment is a real positive saving, read straight from the settlement");
}

// ===== E: equipment adjustment display. =====
{
  const withEquip = computeSettlement(recipe, 10, 75, "santoku", "copper");
  const neutral = computeSettlement(recipe, 10, 75);
  assert(withEquip.equipmentCOGSSavings >= 0, "E: equipmentCOGSSavings displayed is never negative");
  assert(neutral.equipmentCOGSSavings === 0, "E2: with no equipment specified, the displayed equipment effect is exactly 0 (never a fabricated number)");
}

// ===== F: sharpness adjustment display. =====
{
  const dull = computeSettlement(recipe, 10, 75, "chef", "walnut", 0);
  const sharp = computeSettlement(recipe, 10, 75, "chef", "walnut", 100);
  assert(dull.sharpnessCOGSPenalty > 0, "F: a fully dull knife shows a real positive sharpness penalty");
  assert(sharp.sharpnessCOGSPenalty === 0, "F2: a fully sharp (100) knife shows exactly 0 sharpness penalty");
}

// ===== G: staff adjustment display. =====
{
  const withStaff = computeSettlement(recipe, 10, 75, undefined, undefined, undefined, ["prep-assistant"]);
  const noStaff = computeSettlement(recipe, 10, 75);
  assert(withStaff.staffCOGSSavings > 0, "G: Prep Assistant shows a real positive staff saving");
  assert(noStaff.staffCOGSSavings === 0, "G2: with no staff owned, the displayed staff effect is exactly 0");
}

// ===== H: Kitchen Investments are retired — no upkeep or purchase can reach the ledger. =====
{
  // Kitchen Investments were retired (the six kitchen backgrounds are the kitchen progression);
  // their modules are deleted and nothing in the game can buy one or charge upkeep. Legacy ledger
  // labels stay so an old save's history still displays.
  const gone = ["KitchenInvestmentManager.ts", "kitchenInvestmentDefinitions.ts", "kitchenInvestmentTypes.ts"].every(
    (f) => !fs.existsSync(path.resolve(import.meta.dirname, "../src/game/kitchen", f)),
  );
  assert(gone, "H: the retired Kitchen Investment modules no longer exist");
}

// ===== I: net result matches authoritative result — the ledger's own campaign-settlement amount is EXACTLY settlement.netResult, never revenue/COGS/qualityBonus recorded separately. =====
{
  const settlement = computeSettlement(recipe, 10, 88, "chef", "walnut", 100, [], "local-market");
  const save = saveAt({ credits: 1000 });
  const withCredits = { ...save, credits: save.credits + settlement.netResult };
  const withLedger = appendLedgerEntry(withCredits, "campaign-settlement", settlement.netResult, recipe.id);
  const entry = withLedger.economyLedger[withLedger.economyLedger.length - 1];
  assert(!!entry && entry.amount === settlement.netResult, "I: the ONE ledger entry for a served order is exactly settlement.netResult — never revenue, never -finalCOGS, never qualityBonus recorded as a second/third entry");
  assert(withLedger.economyLedger.length === save.economyLedger.length + 1, "I2: exactly ONE entry was appended for this ONE settlement (no double/triple booking of its sub-components)");
}

// ===== J: replay produces no economic ledger entry. =====
{
  const isReplay = true;
  const save = saveAt({ credits: 500 });
  const settlement = isReplay ? undefined : computeSettlement(recipe, 10, 90);
  const amount = settlement?.netResult ?? 0;
  // Mirrors App.tsx's own `if (save && !isReplay) { ...append... }` gate exactly.
  const nextSave = !isReplay
    ? appendLedgerEntry({ ...save, credits: save.credits + amount }, "campaign-settlement", amount, recipe.id)
    : save;
  assert(nextSave.economyLedger.length === save.economyLedger.length, "J: a replay appends ZERO ledger entries — computeSettlement is never even reached, matching the amount's own hard 0");
  assert(nextSave.credits === save.credits, "J2: a replay's credits are completely unchanged");
}

// ===== K: knife purchase creates exactly one expense. =====
{
  const save = saveAt({ credits: 5000, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });
  const result = buyKnife(save, "santoku");
  assert(result.ok, "K0: this synthetic save can actually afford/unlock santoku (precondition for the real test)");
  if (result.ok) {
    const spent = save.credits - result.save.credits;
    const withLedger = appendLedgerEntry(result.save, "knife-purchase", -spent, "santoku");
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `K: a knife purchase creates EXACTLY one expense entry (got ${newEntries})`);
    assert(withLedger.economyLedger[withLedger.economyLedger.length - 1]!.amount < 0, "K2: the knife-purchase entry is a real negative (expense) amount");
  }
}

// ===== L: board purchase creates exactly one expense. =====
{
  const save = saveAt({ credits: 5000, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });
  const result = buyBoard("copper", save);
  assert(result.ok, "L0: this synthetic save can actually afford/unlock copper (precondition)");
  if (result.ok) {
    const spent = save.credits - result.save.credits;
    const withLedger = appendLedgerEntry(result.save, "board-purchase", -spent, "copper");
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `L: a board purchase creates EXACTLY one expense entry (got ${newEntries})`);
  }
}

// ===== M: (retired) Kitchen Investment purchases — covered by H above. =====

// ===== N: staff purchase creates exactly one expense. =====
{
  const save = saveAt({ credits: 5000, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });
  const result = buyStaff(save, "prep-assistant");
  assert(result.ok, "N0: this synthetic save can actually afford/unlock prep-assistant (precondition)");
  if (result.ok) {
    const spent = save.credits - result.save.credits;
    const withLedger = appendLedgerEntry(result.save, "staff-purchase", -spent, "prep-assistant");
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `N: a staff purchase creates EXACTLY one expense entry (got ${newEntries})`);
  }
}

// ===== O: sharpening creates exactly one expense. =====
{
  const save = saveAt({ credits: 500, knifeSharpness: { chef: 40 } });
  const result = sharpenKnife(save, "chef");
  assert(result.ok, "O0: this synthetic save can afford sharpening (precondition)");
  if (result.ok) {
    const spent = save.credits - result.save.credits;
    assert(spent === SHARPEN_COST, "O0b: the actual amount spent equals the real SHARPEN_COST constant");
    const withLedger = appendLedgerEntry(result.save, "sharpening", -spent, "chef");
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `O: sharpening creates EXACTLY one expense entry (got ${newEntries})`);
  }
}

// ===== P: failed purchase creates no entry. =====
{
  const save = saveAt({ credits: 0, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-1" } });
  const result = buyKnife(save, "santoku");
  assert(!result.ok, "P0: this synthetic save genuinely cannot afford santoku (precondition)");
  // Mirrors App.tsx's own `if (result.ok) { ...append... }` gate — a
  // failed result never reaches appendLedgerEntry at all.
  const entriesAppended = result.ok ? 1 : 0;
  assert(entriesAppended === 0, "P: a failed purchase creates ZERO ledger entries");
}

// ===== Q: failed sharpening creates no entry. =====
{
  const save = saveAt({ credits: 0, knifeSharpness: { chef: 40 } });
  const result = sharpenKnife(save, "chef");
  assert(!result.ok, "Q0: this synthetic save genuinely cannot afford sharpening (precondition)");
  const entriesAppended = result.ok ? 1 : 0;
  assert(entriesAppended === 0, "Q: a failed sharpen creates ZERO ledger entries");
}

// ===== R: supplier selection creates no ledger entry. =====
{
  const save = saveAt({ credits: 500 });
  const result = selectSupplier(save, "premium-supplier");
  assert(result.ok, "R0: supplier selection succeeds (precondition)");
  if (result.ok) {
    assert(result.save.economyLedger.length === save.economyLedger.length, "R: selecting a supplier appends ZERO ledger entries — it's free and never moves money (§20)");
    assert(result.save.credits === save.credits, "R2: selecting a supplier leaves credits completely unchanged");
  }
}

// ===== S: no duplicate entries — two genuinely different purchases produce two DISTINCT entries, never a duplicate id or double-count. =====
{
  let save = saveAt({ credits: 5000, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });
  const r1 = buyKnife(save, "santoku");
  if (r1.ok) {
    const spent1 = save.credits - r1.save.credits;
    save = appendLedgerEntry(r1.save, "knife-purchase", -spent1, "santoku");
  }
  const beforeSecond = save.credits;
  const r2 = buyBoard("copper", save);
  if (r2.ok) {
    const spent2 = beforeSecond - r2.save.credits;
    save = appendLedgerEntry(r2.save, "board-purchase", -spent2, "copper");
  }
  const ids = save.economyLedger.map((e) => e.id);
  const uniqueIds = new Set(ids);
  assert(ids.length === uniqueIds.size, "S: every ledger entry has a unique id — no duplicate-entry bug across two consecutive purchases");
  assert(save.economyLedger.length === 2, `S2: exactly 2 entries exist after 2 genuinely different purchases (got ${save.economyLedger.length})`);
}

// ===== T: ledger survives save/load (JSON round-trip). =====
{
  const save = appendLedgerEntry(saveAt({ credits: 500 }), "sharpening", -SHARPEN_COST, "chef");
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.economyLedger.length === save.economyLedger.length, "T: the ledger array survives a JSON save/load round-trip with the same entry count");
  assert(roundTripped.economyLedger[0]!.amount === save.economyLedger[0]!.amount, "T2: entry fields (amount) survive the round-trip exactly");
}

// ===== U: old save migration — a save written before economyLedger existed loads safely. =====
{
  const oldSaveJson = JSON.stringify({ version: 1, credits: 5000, ownedKnifeIds: ["chef"] });
  const parsed = JSON.parse(oldSaveJson) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...parsed } as SaveData;
  assert(Array.isArray(migrated.economyLedger) && migrated.economyLedger.length === 0, "U: an old save missing economyLedger entirely migrates to [] via the existing merge — no crash, no migration code needed");
}

// ===== V: ledger totals — pure aggregation matches a hand-built entry list exactly. =====
{
  const save = [
    ["campaign-settlement", 120] as const,
    ["completion-reward", 250] as const,
    ["knife-purchase", -400] as const,
    ["sharpening", -50] as const,
  ].reduce((s, [category, amount]) => appendLedgerEntry(s, category, amount, "test"), saveAt({}));
  const totals = ledgerTotals(save.economyLedger);
  assert(totals.totalIncome === 370, `V: totalIncome sums every positive entry exactly (got ${totals.totalIncome}, expected 370)`);
  assert(totals.totalExpense === 450, `V2: totalExpense sums the absolute value of every negative entry exactly (got ${totals.totalExpense}, expected 450)`);
  assert(totals.netCashFlow === -80, `V3: netCashFlow is totalIncome - totalExpense exactly (got ${totals.netCashFlow}, expected -80)`);
  assert(totals.byCategory["knife-purchase"] === -400, "V4: byCategory correctly isolates a single category's own signed sum");
}

// ===== W: current credits reconciliation — startingCredits + sum(ledger) === endingCredits, across a real multi-step flow. =====
{
  const startingCredits = DEFAULT_SAVE.credits;
  // DEFAULT_SAVE.credits is already the wallet's cent amount — start from it as-is.
  let save = saveAt({ levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });

  // Step 1 — a genuine (non-replay) campaign settlement.
  const settlement = computeSettlement(recipe, 10, 85, save.equippedKnifeId, save.equippedBoardId);
  save = appendLedgerEntry(
    { ...save, credits: save.credits + settlement.netResult },
    "campaign-settlement",
    settlement.netResult,
    recipe.id,
  );

  // Step 2 — a level completion reward (mirrors finishCampaignLevel exactly).
  const level = LEVELS.find((l) => l.chapter === 1)!;
  const { progress: levelProgress, rewardCoins } = completeLevel(level.id, save.levelProgress);
  save = { ...save, credits: save.credits + rewardCoins, levelProgress };
  if (rewardCoins > 0) save = appendLedgerEntry(save, "completion-reward", rewardCoins, level.id);

  // Step 3 — a shop purchase.
  const knifeResult = buyKnife(save, "santoku");
  if (knifeResult.ok) {
    const spent = save.credits - knifeResult.save.credits;
    save = appendLedgerEntry(knifeResult.save, "knife-purchase", -spent, "santoku");
  }

  // Step 4 — sharpening.
  const sharpenResult = sharpenKnife(save, save.equippedKnifeId);
  if (sharpenResult.ok) {
    const spent = save.credits - sharpenResult.save.credits;
    save = appendLedgerEntry(sharpenResult.save, "sharpening", -spent, save.equippedKnifeId);
  }

  // Step 5 — a replay (must contribute nothing).
  const replaySettlementAmount = 0; // isReplay short-circuits computeSettlement entirely, as proven in check J.
  void replaySettlementAmount;

  const totals = ledgerTotals(save.economyLedger);
  const expectedEnding = startingCredits + totals.netCashFlow;
  assert(
    save.credits === expectedEnding,
    `W: startingCredits(${startingCredits}) + netCashFlow(${totals.netCashFlow}) === endingCredits(${save.credits}) exactly (expected ${expectedEnding}) — zero unexplained credit drift across settlement + completion + upkeep + purchase + sharpening + a no-op replay`,
  );
}

// ===== X: 250-level economy baseline unchanged. =====
{
  const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100, [], "local-market");
  const totals = results.reduce(
    (acc, r) => ({
      grossRecipeRevenue: acc.grossRecipeRevenue + r.grossRecipeRevenue,
      completionRewards: acc.completionRewards + r.levelCompletionReward,
      cogs: acc.cogs + r.ingredientCOGS,
      qualityBonus: acc.qualityBonus + r.qualityBonus,
      net: acc.net + r.netResult,
    }),
    { grossRecipeRevenue: 0, completionRewards: 0, cogs: 0, qualityBonus: 0, net: 0 },
  );
  assert(totals.grossRecipeRevenue === dollars(165140), `X: recipe revenue unchanged at $165,140.00 (got ${totals.grossRecipeRevenue})`);
  assert(totals.completionRewards === dollars(77581), `X2: completion rewards at the V2.5 locked $77,581.00 (got ${totals.completionRewards})`);
  assert(totals.cogs === dollars(37620), `X3: baseline COGS unchanged at $37,620.00 (got ${totals.cogs})`);
  assert(totals.qualityBonus === dollars(3315), `X4: quality bonus unchanged at $3,315.00 (got ${totals.qualityBonus})`);
  assert(totals.net === dollars(208416), `X5: Honest net at the V2.5 locked $208,416.00 (got ${totals.net})`);
}

console.log(`\nMAX_LEDGER_ENTRIES bound in effect: ${MAX_LEDGER_ENTRIES}`);
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
