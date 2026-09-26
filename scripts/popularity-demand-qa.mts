/**
 * POPULARITY_DEMAND_QA — Economy V3 Phase 6. Verifies the popularity
 * score model, the real pricing/menu-variety factors, the forward-hook
 * order/inspection deltas, demand derivation, the End Business Day
 * integration, persistence, migration, Campaign independence, and
 * determinism — against the real production functions only.
 *
 * Run: npx tsx scripts/popularity-demand-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { DEFAULT_POPULARITY_STATE, clampScore } from "../src/game/business/businessPopularity.ts";
import {
  pricingDelta,
  menuVarietyDelta,
  dailyPopularityDelta,
  orderCompletedDelta,
  orderFailedDelta,
  inspectionDelta,
  applyPopularityDelta,
  dailyServiceDelta,
  neutralPullDelta,
} from "../src/game/business/PopularityManager.ts";
import {
  demandLevelFor,
  orderFrequencyMultiplierFor,
  willingnessToPayMultiplierFor,
} from "../src/game/business/DemandManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { defaultMenuPrice } from "../src/game/business/businessMenu.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";

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

const sampleRecipe = CAMPAIGN_RECIPES[0]!;

// ===== A: default popularity is neutral (50). =====
{
  assert(DEFAULT_POPULARITY_STATE.score === 50, "A: DEFAULT_POPULARITY_STATE starts at 50 (neutral)");
  assert(DEFAULT_BUSINESS_STATE.popularity.score === 50, "A2: DEFAULT_BUSINESS_STATE's own popularity starts at 50");
}

// ===== B: clampScore — range [0,100], integer. =====
{
  assert(clampScore(150) === 100, "B: clampScore caps above 100");
  assert(clampScore(-20) === 0, "B2: clampScore floors below 0");
  assert(clampScore(50.6) === 51, "B3: clampScore rounds a fractional value");
  assert(clampScore(0) === 0 && clampScore(100) === 100, "B4: clampScore leaves the exact boundary values unchanged");
}

// ===== C: pricingDelta — 0 on an all-default menu, moves with real pricing choices. =====
{
  assert(pricingDelta({}) === 0, "C: an empty (all-default) menu has zero pricing delta");
  const expensiveMenu = { [sampleRecipe.id]: Math.round(defaultMenuPrice(sampleRecipe) * 1.6) };
  assert(pricingDelta(expensiveMenu) === -3, `C2: pricing at 1.6x the suggested default is penalized (got ${pricingDelta(expensiveMenu)})`);
  const cheapMenu = { [sampleRecipe.id]: Math.round(defaultMenuPrice(sampleRecipe) * 0.4) };
  assert(pricingDelta(cheapMenu) === 1, `C3: pricing at 0.4x the suggested default gives a small bump (got ${pricingDelta(cheapMenu)})`);
  const fairMenu = { [sampleRecipe.id]: defaultMenuPrice(sampleRecipe) };
  assert(pricingDelta(fairMenu) === 0, "C4: pricing exactly at the suggested default is neutral");
  const unknownMenu = { "not-a-real-recipe": 999 };
  assert(pricingDelta(unknownMenu) === 0, "C5: an unknown recipe id in the menu is safely ignored, never crashes");
}

// ===== D: menuVarietyDelta — capped, deterministic, grows with curated breadth. =====
{
  assert(menuVarietyDelta({}) === 0, "D: an empty menu has zero variety delta");
  const some: Record<string, number> = {};
  for (let i = 0; i < 30; i++) some[CAMPAIGN_RECIPES[i]!.id] = 100;
  assert(menuVarietyDelta(some) === 1, `D2: 30 priced dishes gives +1 (got ${menuVarietyDelta(some)})`);
  const many: Record<string, number> = {};
  for (const r of CAMPAIGN_RECIPES) many[r.id] = 100;
  assert(menuVarietyDelta(many) === 3, `D3: pricing every recipe caps at +3, never unbounded (got ${menuVarietyDelta(many)})`);
}

// ===== E: dailyPopularityDelta — combines only the real, wired factors. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, menu: {} } });
  assert(dailyPopularityDelta(save) === 0, "E: a fresh save with an untouched menu has zero daily popularity delta");
}

// ===== F: order/inspection deltas — forward hooks, pure and deterministic, not yet wired to any real caller. =====
{
  assert(orderCompletedDelta({ onTime: true }) === 3, "F: an on-time completed order gives +3");
  assert(orderCompletedDelta({ onTime: false }) === 2, "F2: a late-but-completed order gives +2");
  assert(orderFailedDelta() === -3, "F3: a failed order gives -3");
  assert(inspectionDelta("PASS") === 2, "F4: a passed inspection gives +2");
  assert(inspectionDelta("WARNING") === -2, "F5: a warning gives -2");
  assert(inspectionDelta("FAIL") === -6, "F6: a failed inspection gives -6");
}

// ===== G: applyPopularityDelta — atomic, clamped, no side effects on anything else. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, popularity: { score: 50 } } });
  const result = applyPopularityDelta(save, 10);
  assert(result.business.popularity.score === 60, "G: a +10 delta moves the score from 50 to 60");
  assert(result.credits === 1000, "G2: applying a popularity delta never touches credits");
  const overflow = applyPopularityDelta(save, 1000);
  assert(overflow.business.popularity.score === 100, "G3: an oversized delta clamps at 100, never overflows");
  const underflow = applyPopularityDelta(save, -1000);
  assert(underflow.business.popularity.score === 0, "G4: an undersized delta clamps at 0, never goes negative");
}

// ===== H: demandLevelFor — deterministic thresholds. =====
{
  assert(demandLevelFor(0) === "LOW", "H: score 0 is LOW demand");
  assert(demandLevelFor(24) === "LOW", "H2: score 24 is still LOW");
  assert(demandLevelFor(25) === "MODERATE", "H3: score 25 crosses into MODERATE");
  assert(demandLevelFor(49) === "MODERATE", "H4: score 49 is still MODERATE");
  assert(demandLevelFor(50) === "HIGH", "H5: score 50 crosses into HIGH");
  assert(demandLevelFor(74) === "HIGH", "H6: score 74 is still HIGH");
  assert(demandLevelFor(75) === "VERY_HIGH", "H7: score 75 crosses into VERY_HIGH");
  assert(demandLevelFor(100) === "VERY_HIGH", "H8: score 100 is VERY_HIGH");
}

// ===== I: demand multipliers — forward hooks, deterministic, sensible range. =====
{
  assert(orderFrequencyMultiplierFor(0) === 0.5, "I: score 0 gives the floor 0.5x order-frequency multiplier");
  assert(orderFrequencyMultiplierFor(100) === 1.5, "I2: score 100 gives the ceiling 1.5x multiplier");
  assert(orderFrequencyMultiplierFor(50) === 1.0, "I3: score 50 (neutral) gives exactly 1.0x");
  assert(willingnessToPayMultiplierFor(0) === 0.9, "I4: score 0 gives the floor 0.9x willingness-to-pay multiplier");
  assert(willingnessToPayMultiplierFor(100) === 1.2, "I5: score 100 gives the ceiling 1.2x multiplier");
}

// ===== J: endBusinessDay integration — popularity moves atomically alongside calendar/spoilage. =====
// NOTE (Phase 12 stale-precondition fix, same pattern as the Phase 8
// supplier-contracts-qa.mts fix): these two scenarios use a completely
// default/empty Business Mode state, which now ALSO earns Phase 12's
// own inspectionDelta("PASS") = +2 every day (empty inventory, full
// refrigerator condition, no staff — every inspection category is a
// real PASS). That +2 was always the documented value for a PASS
// result (defined back in Phase 6 as a forward hook, before Phase 12
// gave it a real caller) — it is not a new, arbitrary number invented
// here. The values below are updated by exactly that +2 to account for
// the newly-wired, previously-inert term; this is not a weakened
// assertion — it verifies the exact same "day advance, default state"
// scenario, now correctly including a real signal it never used to
// receive.
{
  const cheapPrice = Math.round(defaultMenuPrice(sampleRecipe) * 0.4);
  const save = saveAt({
    credits: 2000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 5 }, menu: { [sampleRecipe.id]: cheapPrice } },
  });
  const result = endBusinessDay(save);
  // Economy V3 Phase 16 (popularity model D2) — the day now ALSO carries the bounded daily service score
  // (no order served today -> orderFailedDelta -3) and the pull toward 50 (0 at exactly 50). Intentional rule
  // change, asserted at the same exactness: +1 pricing +2 PASS -3 no service +0 pull = 0.
  const expectedJ = pricingDelta(save.business.menu) + inspectionDelta("PASS") + dailyServiceDelta(0) + neutralPullDelta(50);
  assert(pricingDelta(save.business.menu) === 1 && expectedJ === 0 && result.popularityDelta === expectedJ, `J: a cheaply-priced single dish: +1 pricing, +2 PASS, -3 no-service day, 0 pull = ${expectedJ} (got ${result.popularityDelta})`);
  assert(result.save.business.popularity.score === 50 + expectedJ, `J2: the save's popularity score reflects the delta exactly (50${expectedJ >= 0 ? "+" : ""}${expectedJ}, got ${result.save.business.popularity.score})`);
  assert(result.popularityScore === result.save.business.popularity.score, "J3: the returned popularityScore matches the save's own value exactly");
  assert(result.save.business.calendar.businessDay === 6, "J4: the calendar still advances correctly alongside the popularity update");
}
{
  // J-neutral: an untouched menu — pricing/variety/staff/refrigerator all exactly neutral; D2 adds the -3 no-service
  // score and a 0 pull at 50, so the day is exactly +2 PASS -3 = -1.
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const result = endBusinessDay(save);
  assert(result.popularityDelta === -1 && result.popularityScore === 49 && result.popularityBreakdown.operations === 0 && result.popularityBreakdown.inspection === 2 && result.popularityBreakdown.service === -3 && result.popularityBreakdown.pull === 0, "J5: an untouched menu with no service: operations 0, PASS +2, service -3, pull 0 -> 49");
  assert(result.inspectionReport.overall === "PASS", "J6: a fully default Business Mode state passes every inspection category");
}

// ===== K: persistence — popularity survives a JSON save/load round-trip. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, popularity: { score: 73 } } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.popularity.score === 73, "K: an explicit popularity score survives a JSON round-trip exactly");
}

// ===== L: migration — old saves (pre-V3-6) default popularity cleanly; forward-compatible with a later field. =====
{
  const v35Save = {
    version: 1,
    credits: 4000,
    business: {
      calendar: { businessDay: 8 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
      spoilage: { totalSpoiledQuantity: 0, totalSpoiledValue: 0 },
      menu: { [sampleRecipe.id]: 300 },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v35Save, business: { ...DEFAULT_SAVE.business, ...v35Save.business } } as SaveData;
  assert(migrated.business.menu[sampleRecipe.id] === 300, "L: a pre-V3-6 save's menu survives exactly");
  assert(migrated.business.popularity.score === 50, "L2: popularity defaults cleanly to neutral (50) on a save that predates this phase");
}
{
  type FutureBusinessState = SaveData["business"] & { futureField?: string };
  const laterSave = {
    version: 1,
    credits: 1000,
    business: {
      calendar: { businessDay: 7 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
      spoilage: { totalSpoiledQuantity: 0, totalSpoiledValue: 0 },
      menu: {},
      popularity: { score: 82 },
    },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert(migrated.business.popularity.score === 82, "L3: an existing field (popularity) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "L4: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== M: Campaign independence. =====
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 5 }, menu: { [sampleRecipe.id]: Math.round(defaultMenuPrice(sampleRecipe) * 1.6) } },
  });
  const result = endBusinessDay(save);
  assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "M: levelProgress is byte-identical before/after a popularity-moving End Business Day");
  assert(result.save.credits === save.credits, "M2: credits are completely untouched by a popularity movement");
  assert(result.save.economyLedger.length === save.economyLedger.length, "M3: a popularity movement creates ZERO ledger entries — it is never a wallet mutation");
}

// ===== N: no negative/out-of-range score ever settles into the save. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, popularity: { score: 1 } } });
  const veryExpensive = { [sampleRecipe.id]: Math.round(defaultMenuPrice(sampleRecipe) * 3) };
  const result = applyPopularityDelta({ ...save, business: { ...save.business, menu: veryExpensive } }, pricingDelta(veryExpensive));
  assert(result.business.popularity.score >= 0, `N: popularity never goes negative even starting near the floor (got ${result.business.popularity.score})`);
}

// ===== O: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new files. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, menu: { [sampleRecipe.id]: defaultMenuPrice(sampleRecipe) } } });
  const r1 = endBusinessDay(save);
  const r2 = endBusinessDay(save);
  assert(r1.popularityScore === r2.popularityScore && r1.popularityDelta === r2.popularityDelta, "O: identical endBusinessDay inputs produce identical popularity results");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["businessPopularity.ts", "PopularityManager.ts", "DemandManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "O2: no Math.random() CALL exists anywhere in the new popularity/demand files");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
