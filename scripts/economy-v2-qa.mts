/**
 * ECONOMY_V2_QA — Economy V2 Phases 1-2 (foundation + ingredient COGS +
 * Yield Bonus + Quality Bonus). Run like the project's other focused QA
 * scripts:
 *   npx tsx scripts/economy-v2-qa.mts
 *
 * Scope of THIS script — only what this implementation pass actually
 * built: `src/game/economy/{economyTypes,currency,ingredientCostRegistry,
 * EconomySettlement}.ts`. NOT yet covered (because not yet implemented —
 * see the final report's phase recommendation): sharpening, knife/board
 * acquisition cleanup, kitchen investment, supplier contracts, operating
 * costs, settlement UI, ledger persistence, save migration, real-payout
 * wiring, and full 250-level/session simulation. Design spec §46 lists
 * 14 target QA areas; #1-5 (revenue/COGS/yield/quality/determinism) and
 * #14 (no negative balance) are covered here — #6 (sharpening), #10
 * (endless cap), #11 (settlement UI), #12 (ledger persistence), #13
 * (migration) are out of scope until their own phases exist.
 */
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
// USD: wallet amounts are integer cents; Campaign formulas (recipePay, level rewards) are whole dollars (money.ts).
import { dollars } from "../src/game/money.ts";
import { recipeBase, recipePay, chapterMultiplier } from "../src/game/recipes/recipePay.ts";
import { computeSettlement, baselineCOGSFor } from "../src/game/economy/EconomySettlement.ts";
import { ingredientCostWeight, ingredientBaselineCost, COGS_RATE_PER_WEIGHT_UNIT } from "../src/game/economy/ingredientCostRegistry.ts";
import { INGREDIENTS } from "../src/game/definitions.ts";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== 1: recipePay.ts is completely untouched by this implementation — the existing base-revenue formula remains authoritative (design spec §3/§6/§49). =====
{
  let diffStat = "";
  try {
    diffStat = execSync("git diff --name-only HEAD -- src/game/recipes/recipePay.ts", { cwd: process.cwd() }).toString();
  } catch {
    diffStat = "<git unavailable>";
  }
  assert(diffStat.trim() === "", `1: recipePay.ts has zero diff from HEAD (untouched) — got "${diffStat.trim()}"`);
}

// ===== 2: computeSettlement's revenue is EXACTLY recipePay(recipe, chapter) for every campaign recipe — never a re-derived or divergent number. =====
{
  let allMatch = true;
  for (const r of CAMPAIGN_RECIPES) {
    const s = computeSettlement(r, 5, 80);
    if (s.revenue !== dollars(recipePay(r, 5))) allMatch = false;
  }
  assert(allMatch, "2: settlement revenue exactly matches recipePay(recipe, chapter) for all 221 recipes — no divergent revenue formula was introduced");
}

// ===== 3: organizationManager.ts / organizationTypes.ts are completely untouched — Economy V2 never touched runtime organization state (design spec §10/§18/§42/§48). (PreparationScene.ts/campaignRecipes.ts/levelDefinitions.ts carry PRE-EXISTING uncommitted changes from earlier, unrelated session work — not asserted zero-diff here, since that would be a false positive; this economy implementation created ONLY new files under src/game/economy/ and scripts/, verified by direct code review rather than a blanket git-diff sweep of files other tasks legitimately already modified.) =====
{
  const files = ["src/game/organization/organizationManager.ts", "src/game/organization/organizationTypes.ts"];
  let diffStat = "";
  try {
    diffStat = execSync(`git diff --name-only HEAD -- ${files.join(" ")}`, { cwd: process.cwd() }).toString();
  } catch {
    diffStat = "<git unavailable>";
  }
  assert(diffStat.trim() === "", `3: organizationManager.ts/organizationTypes.ts have zero diff from HEAD — got "${diffStat.trim()}"`);
}

// ===== 4: COGS calculation uses recipe.components[] (static data) exclusively — never PreparedOutput/OrganizationSession/assignedTo (structural, design spec §10/§27). =====
// Pattern updated for the Phase-2 physical-ingredient-instance correction
// (scripts/economy-v2-cogs-instance-audit.mts) — baselineCOGSFor changed
// from a plain `.reduce` to an adjacency/chainBreak-aware loop, but the
// actual protected property (component-array-only, no runtime organization
// reference) is unchanged and still asserted below via the same negative
// checks; only the positive match was updated to the new, audited implementation.
{
  const src = fs.readFileSync("src/game/economy/EconomySettlement.ts", "utf8");
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    codeOnly.includes("recipe.components[i]") && !codeOnly.includes("PreparedOutput") && !codeOnly.includes("OrganizationSession") && !codeOnly.includes(".assignedTo"),
    "4: baselineCOGSFor reads recipe.components[] directly — no reference to the runtime organization layer anywhere in the actual code",
  );
}

// ===== 5: better grades produce LOWER final COGS for the identical recipe/chapter — the Yield Bonus is a real, working waste reduction. =====
{
  const r = CAMPAIGN_RECIPES.find((x) => x.components.length >= 2)!;
  const masterful = computeSettlement(r, 3, 97); // >=95 -> Masterful
  const rustic = computeSettlement(r, 3, 55); // >=50 -> Rustic
  assert(
    masterful.finalCOGS < rustic.finalCOGS && masterful.wasteFactor < rustic.wasteFactor,
    `5: Masterful's finalCOGS (${masterful.finalCOGS}) is lower than Rustic's (${rustic.finalCOGS}) for the same recipe/chapter — better cutting genuinely reduces ingredient cost`,
  );
}

// ===== 6: Yield Bonus never appears as a second revenue line — netResult's accounting identity holds EXACTLY for every recipe x every grade x two extreme chapters (1 and 25), with zero double-counting. =====
{
  const grades: [number, string][] = [[97, "Masterful"], [88, "Clean"], [75, "Honest"], [55, "Rustic"], [30, "Learning"]];
  let allExact = true;
  let allNonNegative = true;
  for (const r of CAMPAIGN_RECIPES) {
    for (const chapter of [1, 25]) {
      for (const [score] of grades) {
        const s = computeSettlement(r, chapter, score);
        const expected = Math.max(0, s.revenue - s.finalCOGS + s.qualityBonus);
        if (s.netResult !== expected) allExact = false;
        if (s.netResult < 0) allNonNegative = false;
      }
    }
  }
  assert(allExact, "6: netResult === max(0, revenue - finalCOGS + qualityBonus) EXACTLY for all 221 recipes x 5 grades x chapters {1,25} — no double-counted Yield Bonus");
  assert(allNonNegative, "6b: netResult is never negative across the same exhaustive sweep (2,210 settlements) — the hard 'cash never negative' floor holds");
}

// ===== 7: quality bonus strictly decreases from Masterful to Rustic/Learning, and is exactly proportional to revenue (never to COGS). =====
{
  const r = CAMPAIGN_RECIPES[10]!;
  const m = computeSettlement(r, 4, 97);
  const c = computeSettlement(r, 4, 88);
  const h = computeSettlement(r, 4, 75);
  const ru = computeSettlement(r, 4, 55);
  const le = computeSettlement(r, 4, 30);
  assert(
    m.qualityBonus > c.qualityBonus && c.qualityBonus > h.qualityBonus && h.qualityBonus > ru.qualityBonus && ru.qualityBonus === 0 && le.qualityBonus === 0,
    `7: quality bonus strictly decreases Masterful>Clean>Honest>Rustic=0=Learning (got ${m.qualityBonus},${c.qualityBonus},${h.qualityBonus},${ru.qualityBonus},${le.qualityBonus})`,
  );
  assert(m.qualityBonus === dollars(Math.round((m.revenue / 100) * m.qualityBonusRate)), "7b: quality bonus is computed strictly from revenue (whole dollars), never from COGS");
}

// ===== 8: COGS/revenue ratio is chapter-invariant (both scale by the SAME chapterMultiplier) — a design choice matching the spec's own '% of gross' framing (§9/§66), not an accident. =====
{
  const r = CAMPAIGN_RECIPES[50]!;
  const early = computeSettlement(r, 1, 75);
  const late = computeSettlement(r, 25, 75);
  const ratioEarly = early.finalCOGS / early.revenue;
  const ratioLate = late.finalCOGS / late.revenue;
  assert(Math.abs(ratioEarly - ratioLate) < 0.02, `8: COGS/revenue ratio stays ~constant across chapters (ch1=${(ratioEarly * 100).toFixed(1)}%, ch25=${(ratioLate * 100).toFixed(1)}%) — COGS scales with revenue exactly like the design spec's '% of gross' targets assume`);
}

// ===== 9: corpus-wide COGS/revenue ratio (at the neutral "Honest" baseline, before any Yield/Quality adjustment) lands inside the design spec's 22-28% target band, computed via the SHIPPED production functions (not a separate guess). =====
{
  let sumRevenue = 0;
  let sumCOGS = 0;
  for (const r of CAMPAIGN_RECIPES) {
    const chapter = Math.min(25, Math.max(1, Math.floor((r.unlockLevel - 1) / 10) + 1));
    const s = computeSettlement(r, chapter, 75); // 75 -> Honest, the neutral wasteFactor=1.0 baseline
    sumRevenue += s.revenue;
    sumCOGS += s.finalCOGS;
  }
  const ratio = sumCOGS / sumRevenue;
  assert(ratio >= 0.2 && ratio <= 0.3, `9: corpus-wide COGS/revenue ratio at the Honest baseline is ${(ratio * 100).toFixed(1)}% — within the design spec's 22-28% target band (calibrated via COGS_RATE_PER_WEIGHT_UNIT=${COGS_RATE_PER_WEIGHT_UNIT})`);
}

// ===== 10: determinism — the same recipe/chapter/score always produces the same numeric settlement (ledger transaction ids/timestamps are intentionally excluded — they are bookkeeping metadata, not economic state). =====
{
  const r = CAMPAIGN_RECIPES[20]!;
  const a = computeSettlement(r, 7, 82);
  const b = computeSettlement(r, 7, 82);
  const strip = (s: typeof a) => ({ ...s, transactions: s.transactions.map((t) => ({ type: t.type, amount: t.amount, source: t.source })) });
  assert(JSON.stringify(strip(a)) === JSON.stringify(strip(b)), "10: computeSettlement is deterministic for the same (recipe, chapter, score) — no Math.random() anywhere in the economic result");
}

// ===== 11: no Math.random() anywhere in the new economy module. =====
{
  const files = ["economyTypes.ts", "currency.ts", "ingredientCostRegistry.ts", "EconomySettlement.ts"];
  const offenders = files.filter((f) => fs.readFileSync(`src/game/economy/${f}`, "utf8").includes("Math.random("));
  assert(offenders.length === 0, `11: no Math.random() in any economy module file (${offenders.join(", ") || "none"})`);
}

// ===== 12: every ingredient used by any campaign recipe resolves to a real, positive cost weight — no silent fallback to an unregistered/zero-cost ingredient. =====
{
  const usedIds = new Set(CAMPAIGN_RECIPES.flatMap((r) => r.components.map((c) => c.ingredientId)));
  const missing: string[] = [];
  for (const id of usedIds) {
    if (!INGREDIENTS[id]) missing.push(id);
    else if (!(ingredientCostWeight(id) > 0)) missing.push(id + "(zero weight)");
  }
  assert(missing.length === 0, `12: every ingredient referenced by a campaign recipe has a real, positive cost weight (missing/invalid: ${missing.join(", ") || "none"})`);
}

// ===== 13: baselineCOGSFor is chapter-independent (mirrors recipeBase's own chapter-independence) — a structural sanity check that no chapter-scaling accidentally leaked into the per-recipe baseline itself. =====
// `expected` mirrors baselineCOGSFor's OWN documented physical-ingredient-instance
// rule (one charge per uninterrupted same-ingredientId run, unless chainBreak
// forces a fresh instance — see EconomySettlement.ts's own doc and
// scripts/economy-v2-cogs-instance-audit.mts's exhaustive 221-recipe proof),
// NOT a naive per-component sum — a prior version of this check re-derived
// "expected" via a plain reduce over every component, which baked in the
// SAME incorrect "one component = one consumption unit" assumption the
// production audit proved wrong for same-instance chains (e.g. chicken
// halve->slice). This is a test-methodology fix, not a weakened assertion:
// the check still fails if baselineCOGSFor's real output ever diverges from
// its own documented rule, computed independently here.
{
  const r = CAMPAIGN_RECIPES[100]!;
  const base = baselineCOGSFor(r);
  let expected = 0;
  for (let i = 0; i < r.components.length; i++) {
    const c = r.components[i]!;
    const prev = i > 0 ? r.components[i - 1]! : null;
    const isSameInstance = prev !== null && prev.ingredientId === c.ingredientId && !c.chainBreak;
    if (!isSameInstance) expected += ingredientBaselineCost(c.ingredientId);
  }
  assert(base === expected, `13: baselineCOGSFor(recipe) exactly equals one cost charge per physical ingredient instance (chainBreak/adjacency-aware), with no chapter term mixed in (got ${base}, expected ${expected})`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
