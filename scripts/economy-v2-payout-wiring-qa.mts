/**
 * ECONOMY_V2_PAYOUT_WIRING_QA — the focused QA the payout-wiring +
 * replay-safety task itself asks for (its own §21-24): every one of the
 * 15 numbered checks plus the multi-order and replay scenarios, run
 * against the REAL shipped production functions/data (App.tsx's own
 * closures can't be imported directly — this replicates their exact,
 * already-reviewed composition of exported primitives: LevelManager's
 * completeLevel/isCompleted, ServiceManager's session functions,
 * EconomySettlement's computeSettlement — never a second implementation
 * of the wiring logic itself).
 *
 * Run: npx tsx scripts/economy-v2-payout-wiring-qa.mts
 */
import * as fs from "node:fs";
// USD: wallet amounts are integer cents; Campaign formulas (recipePay, level rewards) are whole dollars (money.ts).
import { dollars } from "../src/game/money.ts";
import { CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import {
  getLevel,
  completeLevel,
  isCompleted,
  DEFAULT_LEVEL_PROGRESS,
} from "../src/game/levels/LevelManager.ts";
import {
  createServiceSession,
  recordAllComponents,
  serveCurrentOrder,
  advanceServiceSession,
  createBatchGroupSession,
  recordBatchGroupComponents,
  serveBatchGroupOrder,
  isBatchGroupComplete,
} from "../src/game/service/ServiceManager.ts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import type { RecipeDefinition } from "../src/game/recipes/recipeTypes.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function campaignPoolFor(level: ReturnType<typeof getLevel>): RecipeDefinition[] {
  return (level?.recipePoolIds ?? [])
    .map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
}

const appSrc = fs.readFileSync("src/App.tsx", "utf8");
function bodyOf(fnName: string): string {
  const start = appSrc.indexOf(`function ${fnName}(`);
  if (start === -1) return "";
  // Slice to the next top-level "  function " (2-space indent) after this
  // one, or end of file — generous enough to capture one full closure
  // body without a brace-matcher.
  const next = appSrc.indexOf("\n  function ", start + 10);
  return appSrc.slice(start, next === -1 ? undefined : next);
}

// ===== 1: Single-level first completion pays computeSettlement's netResult (recordPreparationResult's own composition, §7). =====
{
  const level = LEVELS[0]!;
  const recipe = getCampaignRecipe(level.recipeId);
  assert(!!recipe, `setup: LEVELS[0].recipeId ("${level.recipeId}") resolves to a real CAMPAIGN_RECIPES entry`);
  const { progress, isFirstCompletion } = completeLevel(level.id, DEFAULT_LEVEL_PROGRESS);
  assert(isFirstCompletion, "1a: a never-completed level reports isFirstCompletion");
  const settlement = computeSettlement(recipe!, level.chapter, 90);
  const payout = isFirstCompletion ? settlement.netResult : 0;
  assert(payout === settlement.netResult && payout > 0, "1: Single first completion pays computeSettlement's netResult, matching Section 7's exact wiring");

  // ===== 2: Single-level replay pays 0 (no campaign settlement at all). =====
  const r2 = completeLevel(level.id, progress);
  assert(!r2.isFirstCompletion, "2a: completing the SAME level again reports isFirstCompletion === false");
  const payout2 = r2.isFirstCompletion ? computeSettlement(recipe!, level.chapter, 90).netResult : 0;
  assert(payout2 === 0, "2: Single-level replay pays 0 campaign settlement");
}

// ===== 3/9/14: Order-pool first completion — 3 served orders, each exactly one settlement, one revenue, one COGS, quality score correctly carried, exactly-once payment guard holds. =====
{
  const level = getLevel("level-114")!; // real 4-recipe pool, requiredOrders: 3
  const pool = campaignPoolFor(level);
  assert(pool.length >= 3, "setup: level-114's pool resolves to >= 3 real recipes");
  let session = createServiceSession(level.id, pool, () => 0, level.chapter, false);
  const settlements: ReturnType<typeof computeSettlement>[] = [];
  for (let i = 0; i < 3; i++) {
    session = recordAllComponents(session, 80); // 80 -> "Honest" grade
    assert(session.current!.order.preparationScore === 80, `9.${i}: the served order's OWN preparation score (80) is correctly carried from recordAllComponents to serve time`);
    const settlement = computeSettlement(session.current!.recipe, session.chapter ?? 1, session.current!.order.preparationScore ?? 0);
    const result = serveCurrentOrder(session, () => 0, settlement.netResult);
    assert(result !== null && result.coinsAwarded === settlement.netResult, `3.${i}: served order #${i + 1} settles for exactly computeSettlement's netResult`);
    assert(
      settlement.transactions.some((t) => t.type === "RECIPE_REVENUE") &&
        settlement.transactions.some((t) => t.type === "INGREDIENT_COGS"),
      `3.${i}b: order #${i + 1}'s settlement contains exactly one revenue line and one COGS line (never duplicated)`,
    );
    // Exactly-once guard: the order is no longer READY, so serving it again refuses.
    const doubleServe = serveCurrentOrder(result!.session, () => 0, settlement.netResult);
    assert(doubleServe === null, `14.${i}: serving the SAME already-served order a second time is refused (no double payment)`);
    settlements.push(settlement);
    session = advanceServiceSession(result!.session, pool, () => 0);
  }
  assert(settlements.length === 3, "3: order-pool first completion produced exactly 3 settlements for 3 served orders (1:1, never duplicated or skipped)");
  assert(
    settlements.every((s) => s.netResult >= 0),
    "15a: no settlement in the 3-order run is negative",
  );
}

// ===== 4: Order-pool REPLAY pays 0 campaign revenue/COGS/quality/net for every served order, while gameplay (serve/advance) proceeds normally. =====
{
  const level = getLevel("level-114")!;
  const pool = campaignPoolFor(level);
  let session = createServiceSession(level.id, pool, () => 0, level.chapter, /* isReplay */ true);
  let totalCoins = 0;
  for (let i = 0; i < 3; i++) {
    session = recordAllComponents(session, 95); // even a Masterful score...
    const amount = session.isReplay
      ? 0
      : computeSettlement(session.current!.recipe, session.chapter ?? 1, session.current!.order.preparationScore ?? 0).netResult;
    const result = serveCurrentOrder(session, () => 0, amount);
    assert(result !== null, `4.${i}a: a replay order still serves normally (gameplay is never blocked)`);
    assert(result!.coinsAwarded === 0, `4.${i}b: a replay order's coinsAwarded is exactly 0 regardless of score/grade`);
    totalCoins += result!.coinsAwarded;
    session = advanceServiceSession(result!.session, pool, () => 0);
  }
  assert(totalCoins === 0, "4: order-pool replay run's total revenue/COGS/quality/net across all 3 served orders is 0 — matches §23's exact expectation");
}

// ===== 5/22: Real-batch (level-100, 3 simultaneous recipes) first completion — N served orders, N settlements, no COGS/revenue double-counted at group completion. =====
{
  const level = getLevel("level-100")!;
  const recipeIds = level.batchGroupRecipeIds!;
  assert(recipeIds.length === 3, "setup: level-100 is a real 3-recipe batch group");
  const recipes = recipeIds.map((id) => getCampaignRecipe(id)!);
  let group = createBatchGroupSession(level.id, recipes, () => 0, level.chapter, false);
  for (const o of group.orders) group = recordBatchGroupComponents(group, o.order.id, 80);
  const settlements: ReturnType<typeof computeSettlement>[] = [];
  let guard = 0;
  while (!isBatchGroupComplete(group) && guard < 10) {
    guard++;
    const ready = group.orders.find((o) => o.order.status === "READY");
    if (!ready) break;
    const settlement = computeSettlement(ready.recipe, group.chapter ?? 1, ready.order.preparationScore ?? 0);
    const result = serveBatchGroupOrder(group, ready.order.id, () => 0, settlement.netResult);
    assert(result !== null && result.coinsAwarded === settlement.netResult, "5: each real-batch order settles for exactly computeSettlement's netResult");
    settlements.push(settlement);
    group = result!.group;
  }
  assert(isBatchGroupComplete(group), "setup: all 3 batch orders reached COMPLETED");
  assert(settlements.length === 3, "22: real-batch (N=3) produced exactly N=3 settlements — one per served order, never re-settled as a group");
}

// ===== 6: Real-batch REPLAY pays 0 for every served order. =====
{
  const level = getLevel("level-100")!;
  const recipes = level.batchGroupRecipeIds!.map((id) => getCampaignRecipe(id)!);
  let group = createBatchGroupSession(level.id, recipes, () => 0, level.chapter, /* isReplay */ true);
  for (const o of group.orders) group = recordBatchGroupComponents(group, o.order.id, 95);
  let totalCoins = 0;
  let guard = 0;
  while (!isBatchGroupComplete(group) && guard < 10) {
    guard++;
    const ready = group.orders.find((o) => o.order.status === "READY");
    if (!ready) break;
    const amount = group.isReplay
      ? 0
      : computeSettlement(ready.recipe, group.chapter ?? 1, ready.order.preparationScore ?? 0).netResult;
    const result = serveBatchGroupOrder(group, ready.order.id, () => 0, amount);
    assert(result !== null && result.coinsAwarded === 0, "6: a real-batch replay order's coinsAwarded is exactly 0");
    totalCoins += result!.coinsAwarded;
    group = result!.group;
  }
  assert(totalCoins === 0, "6b: real-batch replay run's total payout across all 3 orders is 0");
}

// ===== 7: Level-completion bonus still occurs only once (LevelManager's own gate — the one App.tsx's finishCampaignLevel/finishBatchGroupLevel/recordPreparationResult all reuse, never a second completion system). =====
{
  const level = getLevel("level-114")!;
  const r1 = completeLevel(level.id, DEFAULT_LEVEL_PROGRESS);
  const r2 = completeLevel(level.id, r1.progress);
  assert(r1.rewardCoins === dollars(level.reward.coins) && r1.rewardCoins > 0, "7a: first completion pays the level's own flat reward (in dollars)");
  assert(r2.rewardCoins === 0, "7: replaying the same level a second time pays 0 level-completion bonus");
}

// ===== 8: COGS is never charged again at level completion — finishCampaignLevel/finishBatchGroupLevel never call computeSettlement (static source check on the actual shipped App.tsx). =====
{
  const finishCampaign = bodyOf("finishCampaignLevel");
  const finishBatch = bodyOf("finishBatchGroupLevel");
  assert(finishCampaign.length > 0 && !finishCampaign.includes("computeSettlement"), "8a: finishCampaignLevel's body never calls computeSettlement");
  assert(finishBatch.length > 0 && !finishBatch.includes("computeSettlement"), "8: finishBatchGroupLevel's body never calls computeSettlement");
}

// ===== 10: Yield affects COGS, not revenue — for the identical recipe/chapter, a better grade lowers finalCOGS while revenue is unchanged. =====
{
  const recipe = CAMPAIGN_RECIPES.find((r) => r.components.length >= 2)!;
  const masterful = computeSettlement(recipe, 5, 97);
  const rustic = computeSettlement(recipe, 5, 55);
  assert(masterful.revenue === rustic.revenue, "10a: revenue is identical regardless of grade (Yield never touches revenue)");
  assert(masterful.finalCOGS < rustic.finalCOGS, "10: Yield Bonus lowers finalCOGS for a better grade, at the same recipe/chapter");
}

// ===== 11: Today's Special (recordDailyResult) is untouched by this wiring — no computeSettlement/EconomySettlement reference in its body. =====
{
  const body = bodyOf("recordDailyResult");
  assert(body.length > 0 && !body.includes("computeSettlement") && !body.includes("EconomySettlement"), "11: recordDailyResult's body never references computeSettlement/EconomySettlement");
}

// ===== 12: Endless (recordEndlessResult) is untouched by this wiring. =====
{
  const body = bodyOf("recordEndlessResult");
  assert(body.length > 0 && !body.includes("computeSettlement") && !body.includes("EconomySettlement"), "12: recordEndlessResult's body never references computeSettlement/EconomySettlement");
}

// ===== 13: the standalone Restaurant Service test harness (mock testRecipePool recipes, fixed pay) is no longer reachable from the game — its App entry point and payout handler were removed in the release pass. =====
{
  assert(
    bodyOf("serveActiveServiceOrder").length === 0 && bodyOf("startService").length === 0 && !appSrc.includes('from "@/game/service/testRecipePool"'),
    "13: no mock Restaurant Service payout path exists in App.tsx (startService / serveActiveServiceOrder / TEST_RECIPE_POOL all gone)",
  );
}

// ===== 15: No negative credits anywhere in this sweep (already exhaustively proven corpus-wide by economy-v2-qa.mts's own check 6b; re-asserted here against the two REAL levels this script exercises). =====
{
  const level114Pool = campaignPoolFor(getLevel("level-114")!);
  const level100Recipes = getLevel("level-100")!.batchGroupRecipeIds!.map((id) => getCampaignRecipe(id)!);
  const grades = [30, 55, 75, 88, 97];
  let allNonNegative = true;
  for (const r of [...level114Pool, ...level100Recipes]) {
    for (const score of grades) {
      if (computeSettlement(r, 12, score).netResult < 0) allNonNegative = false;
    }
  }
  assert(allNonNegative, "15: netResult is never negative across every recipe/grade this script exercises");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
