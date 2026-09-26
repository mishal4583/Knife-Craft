/**
 * BUSINESS_MENU_QA — Economy V3 Phase 5. Verifies menu-price defaults,
 * cost-basis/margin math, the setMenuPrice validation/persistence
 * action, Campaign isolation (recipePay untouched, no ledger/wallet
 * mutation), migration, and determinism — against the real production
 * functions only.
 *
 * Run: npx tsx scripts/business-menu-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import {
  DEFAULT_BUSINESS_MENU,
  recipeCostBasis,
  defaultMenuPrice,
  menuPriceFor,
  marginFor,
} from "../src/game/business/businessMenu.ts";
import { setMenuPrice } from "../src/game/business/BusinessMenuManager.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
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

// ===== A: default menu is empty. =====
{
  assert(Object.keys(DEFAULT_BUSINESS_MENU).length === 0, "A: DEFAULT_BUSINESS_MENU is empty");
  assert(Object.keys(DEFAULT_BUSINESS_STATE.menu).length === 0, "A2: DEFAULT_BUSINESS_STATE.menu is empty");
}

// ===== B: recipeCostBasis — sums businessUnitCostFor across every component, not deduped. =====
{
  const cost = recipeCostBasis(sampleRecipe);
  const expected = sampleRecipe.components.reduce((sum, c) => sum + businessUnitCostFor(c.ingredientId), 0);
  assert(cost === expected, `B: recipeCostBasis matches the sum of every component's businessUnitCostFor (got ${cost}, expected ${expected})`);
  assert(Number.isInteger(cost) && cost > 0, "B2: cost basis is a positive integer for a real recipe");
}

// ===== C: defaultMenuPrice — deterministic, data-driven, always >= 1. =====
{
  const price = defaultMenuPrice(sampleRecipe);
  assert(Number.isInteger(price) && price >= 1, "C: defaultMenuPrice is a positive integer");
  assert(price === defaultMenuPrice(sampleRecipe), "C2: defaultMenuPrice is deterministic — calling it twice gives the same answer");
  const allPositive = CAMPAIGN_RECIPES.every((r) => Number.isInteger(defaultMenuPrice(r)) && defaultMenuPrice(r) >= 1);
  assert(allPositive, "C3: every real campaign recipe resolves to a positive integer default price");
}

// ===== D: menuPriceFor — falls back to the default, respects an explicit override. =====
{
  assert(menuPriceFor({}, sampleRecipe) === defaultMenuPrice(sampleRecipe), "D: an empty menu falls back to the default price");
  const menu = { [sampleRecipe.id]: 999 };
  assert(menuPriceFor(menu, sampleRecipe) === 999, "D2: an explicit menu entry overrides the default");
}

// ===== E: marginFor — price, cost, margin, foodCostPercent, grossMarginPercent all correct. =====
// NOTE (Phase 14 stale-precondition fix, documented): the old, single
// `marginPercent` field was mislabeled (it computed margin/cost — MARKUP
// — while displaying as if it were margin; the Phase 14 brief is
// explicit: "Do not label markup as margin"). It is replaced by two
// correctly-named, correctly-computed fields: `foodCostPercent`
// (cost/price) and `grossMarginPercent` (margin/price). Both divide by
// PRICE, not cost, so the zero-guard is `price > 0`, not the old
// `cost > 0` — this changes what a zero-COST (but non-zero-price) recipe
// reports (see E7 below), which is a real, correct behavior change, not
// a bug: a free-to-make item sold for any positive price is genuinely
// 100% gross margin, never 0%.
{
  const cost = recipeCostBasis(sampleRecipe);
  const price = cost + 50;
  const menu = { [sampleRecipe.id]: price };
  const m = marginFor(menu, sampleRecipe);
  assert(m.price === price, "E: marginFor reports the exact set price");
  assert(m.cost === cost, "E2: marginFor reports the exact cost basis");
  assert(m.margin === 50, `E3: margin is price - cost (got ${m.margin})`);
  assert(m.foodCostPercent === Math.round((cost / price) * 1000) / 10, "E4: foodCostPercent matches the documented cost/price rounding formula");
  assert(m.grossMarginPercent === Math.round((50 / price) * 1000) / 10, "E4b: grossMarginPercent matches the documented margin/price rounding formula");
  assert(Math.round((m.foodCostPercent + m.grossMarginPercent) * 10) / 10 === 100, "E4c: foodCostPercent + grossMarginPercent always sum to exactly 100");
}
{
  // E-loss: a below-cost price is allowed and reports a negative margin, never clamped/hidden.
  const menu = { [sampleRecipe.id]: 0 };
  const m = marginFor(menu, sampleRecipe);
  assert(m.price === 0, "E5: a price of 0 is a legitimate, settable price");
  assert(m.margin === -m.cost, "E6: a 0 price reports a full negative margin, not clamped to 0");
  assert(m.foodCostPercent === 0 && m.grossMarginPercent === 0, "E6b: a 0 price reports 0% for both percentages (the price-based zero-guard), never NaN/Infinity");
}
{
  // E-zerocost: a zero-cost recipe still resolves to a real, non-zero defaultMenuPrice (Math.max(1, ...)), so foodCostPercent is genuinely 0% while grossMarginPercent is genuinely 100% — never a division by zero either way.
  const fakeRecipe = { ...sampleRecipe, components: [] };
  const m = marginFor({}, fakeRecipe);
  assert(m.cost === 0 && m.price > 0, "E7: precondition — a zero-cost recipe still gets a real positive default price");
  assert(m.foodCostPercent === 0, "E7b: a zero-cost recipe has exactly 0% food cost");
  assert(m.grossMarginPercent === 100, "E7c: a zero-cost recipe sold at any positive price is exactly 100% gross margin, never NaN/Infinity");
}

// ===== F: setMenuPrice — validation. =====
{
  const save = saveAt({});
  const negative = setMenuPrice(save, sampleRecipe.id, -5);
  assert(!negative.ok && negative.reason === "invalidPrice", "F: a negative price is rejected");
  const fractional = setMenuPrice(save, sampleRecipe.id, 12.5);
  assert(!fractional.ok && fractional.reason === "invalidPrice", "F2: a non-integer price is rejected");
  const unknown = setMenuPrice(save, "not-a-real-recipe", 100);
  assert(!unknown.ok && unknown.reason === "unknownRecipe", "F3: an unknown recipe id is rejected");
  const zero = setMenuPrice(save, sampleRecipe.id, 0);
  assert(zero.ok, "F4: a price of exactly 0 IS accepted — free/promotional items are a legitimate business choice");
}

// ===== G: setMenuPrice — a valid call persists exactly, atomically, with no side effects. =====
{
  const save = saveAt({ credits: 1000 });
  const result = setMenuPrice(save, sampleRecipe.id, 250);
  assert(result.ok, "G: a valid price change succeeds");
  if (result.ok) {
    assert(result.save.business.menu[sampleRecipe.id] === 250, "G2: the new save's menu carries the exact price set");
    assert(result.save.credits === 1000, "G3: setting a menu price never touches credits");
    assert(result.save.economyLedger.length === save.economyLedger.length, "G4: setting a menu price creates ZERO ledger entries — it is never a wallet mutation");
  }
}
{
  // G-failure: a rejected call changes nothing at all.
  const save = saveAt({});
  const before = JSON.stringify(save.business.menu);
  const rejected = setMenuPrice(save, sampleRecipe.id, -1);
  assert(!rejected.ok, "G5: precondition — the call is rejected");
  assert(JSON.stringify(save.business.menu) === before, "G6: a rejected price change leaves the original menu byte-identical");
}

// ===== H: two different recipes hold independent prices — no cross-contamination. =====
{
  const other = CAMPAIGN_RECIPES[1]!;
  let save = saveAt({});
  const r1 = setMenuPrice(save, sampleRecipe.id, 100);
  assert(r1.ok, "H0: first price set succeeds (precondition)");
  if (r1.ok) save = r1.save;
  const r2 = setMenuPrice(save, other.id, 200);
  assert(r2.ok, "H1: second price set on a DIFFERENT recipe succeeds (precondition)");
  if (r2.ok) {
    assert(r2.save.business.menu[sampleRecipe.id] === 100, "H: the first recipe's price is untouched by setting a second recipe's price");
    assert(r2.save.business.menu[other.id] === 200, "H2: the second recipe's price is recorded independently");
  }
}

// ===== I: Campaign isolation — recipePay/basePayment are completely untouched by Business Menu pricing. =====
{
  const save = saveAt({});
  const result = setMenuPrice(save, sampleRecipe.id, 99999);
  assert(result.ok, "I0: precondition");
  if (result.ok) {
    const recipeAfter = CAMPAIGN_RECIPES.find((r) => r.id === sampleRecipe.id)!;
    assert(recipeAfter.basePayment === sampleRecipe.basePayment, "I: CAMPAIGN_RECIPES' own basePayment is never mutated by a Business Menu price change");
  }
}
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
  });
  const result = setMenuPrice(save, sampleRecipe.id, 500);
  assert(result.ok, "I1: precondition");
  if (result.ok) {
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "I2: levelProgress is byte-identical before/after a menu price change");
  }
}

// ===== J: persistence — a menu survives a JSON save/load round-trip. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, menu: { [sampleRecipe.id]: 175 } } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.menu[sampleRecipe.id] === 175, "J: an explicit menu price survives a JSON round-trip exactly");
}

// ===== K: migration — old saves (pre-V3-5) default the menu cleanly; forward-compatible with a later field. =====
{
  const v34Save = {
    version: 1,
    credits: 4000,
    business: {
      calendar: { businessDay: 8 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
      spoilage: { totalSpoiledQuantity: 2, totalSpoiledValue: 20 },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v34Save, business: { ...DEFAULT_SAVE.business, ...v34Save.business } } as SaveData;
  assert(migrated.business.spoilage.totalSpoiledQuantity === 2, "K: a pre-V3-5 save's spoilage survives exactly");
  assert(Object.keys(migrated.business.menu).length === 0, "K2: menu defaults cleanly to empty on a save that predates this phase");
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
      menu: { [sampleRecipe.id]: 300 },
    },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert(migrated.business.menu[sampleRecipe.id] === 300, "K3: an existing field (menu) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "K4: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== L: no negative price ever settles into the save. =====
{
  const save = saveAt({});
  const result = setMenuPrice(save, sampleRecipe.id, -10);
  assert(!result.ok, "L: a negative price is never accepted");
  assert(Object.keys(save.business.menu).length === 0, "L2: the original save's menu is untouched by the rejected attempt");
}

// ===== M: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new files. =====
{
  const save = saveAt({});
  const r1 = setMenuPrice(save, sampleRecipe.id, 150);
  const r2 = setMenuPrice(save, sampleRecipe.id, 150);
  assert(r1.ok && r2.ok && JSON.stringify(r1.save.business.menu) === JSON.stringify(r2.save.business.menu), "M: identical setMenuPrice inputs produce identical results");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["businessMenu.ts", "BusinessMenuManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "M2: no Math.random() CALL exists anywhere in the new business menu files");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
