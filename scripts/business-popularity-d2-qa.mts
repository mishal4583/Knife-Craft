/**
 * BUSINESS_POPULARITY_D2_QA — Economy V3 Phase 16, popularity model D2.
 * At End Business Day:
 *   P_end = clamp(P_start + operations + inspection + service
 *                 - round(0.32 x (P_start - 50)), 0, 100)
 * where service = +3 if >= 1 order was served that day, -3 if none, and a
 * serve no longer moves popularity immediately. Proves, against the real
 * production functions only:
 *   A. the daily service score is bounded (1, 10, 100 orders -> +3; 0 -> -3)
 *   B. the pull toward 50 from above and below, none at 50
 *   C. boundaries: recovery from 0, decline from 100, clamping, no permanent 0
 *   D. Line Cook, Head Chef, Server, pricing, fridge, inspection, variety each move the result
 *   E. the Dashboard preview equals the persisted close
 *   F. save/reload (and old-save migration of ordersServed) is identical
 *   G. a $0 dish counts as served
 *   H. determinism
 *   I. Campaign isolation + the exact Economy V2 freeze
 *   S. simulation scenarios (normal, start 0/100, overpriced, poor maintenance,
 *      never serves, Head Chef, all three) — no saturation at 100, no permanent 0.
 *
 * Run: npx tsx scripts/business-popularity-d2-qa.mts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { normalizeQuantity } from "../src/game/business/businessInventory.ts";
import { BUSINESS_DISH_CATALOG, getBusinessDish, businessDishPrice } from "../src/game/business/businessDishCatalog.ts";
import { businessDishRequirements, businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { recordInventoryPurchase, recordMaintenanceCost, migrateBusinessFinanceState } from "../src/game/business/BusinessFinanceManager.ts";
import {
  createBusinessServiceSession,
  advanceBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessOrderAvailability,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand, businessServiceSeedFor } from "../src/game/business/businessDeterministicRandom.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { performRefrigeratorMaintenance, maintenanceStatusFor } from "../src/game/business/businessMaintenance.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { usableQuantity } from "../src/game/business/perishability.ts";
import { getAvailableStorageCapacity } from "../src/game/business/RefrigeratorManager.ts";
import { eventForDay, maxPurchaseQuantityFor } from "../src/game/business/businessSupplierEvents.ts";
import { setDishActive } from "../src/game/business/businessMenuActivation.ts";
import { setMenuPrice } from "../src/game/business/BusinessMenuManager.ts";
import { previewBusinessDayClose } from "../src/game/business/businessAlerts.ts";
import { staffPopularityDelta } from "../src/game/business/businessStaff.ts";
import { refrigeratorPopularityDelta } from "../src/game/business/businessEquipmentCondition.ts";
import {
  dailyServiceDelta,
  neutralPullDelta,
  inspectionDelta,
  pricingDelta,
  menuVarietyDelta,
  orderCompletedDelta,
  orderFailedDelta,
  POPULARITY_NEUTRAL,
  POPULARITY_PULL_RATE,
} from "../src/game/business/PopularityManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { defaultMenuPrice } from "../src/game/business/businessMenu.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const FOCUS_MENU = ["biz-garden-salad", "biz-tomato-lettuce-salad", "biz-kachumber-salad", "biz-chicken-broccoli", "biz-garlic-chicken", "biz-greek-lemon-chicken"];

function baseSave(score = 50, overrides: Partial<SaveData["business"]> = {}, credits = 300_000): SaveData {
  let save: SaveData = { ...DEFAULT_SAVE, credits, economyLedger: [], business: { ...DEFAULT_BUSINESS_STATE, popularity: { score }, ...overrides } };
  for (const d of BUSINESS_DISH_CATALOG) {
    if (FOCUS_MENU.includes(d.id)) continue;
    const r = setDishActive(save, d.id, false);
    if (r.ok) save = r.save;
  }
  return save;
}

function needTotals(dishId: string) {
  const t = new Map<string, number>();
  for (const r of businessDishRequirements(getBusinessDish(dishId)!)) t.set(r.ingredientId, normalizeQuantity((t.get(r.ingredientId) ?? 0) + r.quantity));
  return t;
}

/** Serves up to `n` REAL orders today through the real Business pipeline (buy stock -> real session -> recordAllComponents -> serveBusinessOrder -> ledger). */
function serveToday(start: SaveData, n: number, lot = 5): { save: SaveData; served: number; popularityDuringDay: number[] } {
  let save = start;
  const day = save.business.calendar.businessDay;
  const rand = makeSeededRand(businessServiceSeedFor(day));
  let session = createBusinessServiceSession(rand, save.business.menuActivation);
  let served = 0;
  const popularityDuringDay: number[] = [];
  while (served < n && session.current) {
    const dish = businessDishForRecipeId(session.current.recipe.id)!;
    if (!businessOrderAvailability(save, dish).available) {
      const cap = maxPurchaseQuantityFor(eventForDay(day));
      for (const [id, need] of needTotals(dish.id)) {
        const have = usableQuantity(save.business.inventory, id as never, day);
        if (have >= need) continue;
        let qty = Math.max(lot, Math.ceil(need - have));
        if (cap !== undefined) qty = Math.min(qty, cap);
        qty = Math.min(qty, Math.floor(getAvailableStorageCapacity(save.business.inventory, save.business.refrigerator.refrigeratorId)));
        if (qty <= 0) continue;
        const r = purchaseIngredient(save, id as never, qty);
        if (r.ok) save = recordInventoryPurchase(appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id), r.totalCost);
      }
      if (!businessOrderAvailability(save, dish).available) break;
    }
    const result = serveBusinessOrder(recordBusinessServiceComponents(session, 80), save, rand);
    if (!result) break;
    save = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
    popularityDuringDay.push(save.business.popularity.score);
    served++;
    session = advanceBusinessServiceSession(result.session, rand, save.business.menuActivation);
  }
  return { save, served, popularityDuringDay };
}

function closeDay(save: SaveData): SaveData {
  const end = endBusinessDay(save);
  return appendLedgerEntry(appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid), "inspection-fine", -end.inspectionFine.finePaid);
}

// ===== A: daily service bound. =====
{
  const start = baseSave(50);
  // Order frequency (Economy V3 Phase 16): popularity 50 brings 8 customers a day, so the largest real
  // day is 8 served; 100 orders is still checked synthetically in A5.
  const results = [0, 1, 8].map((n) => {
    const day = serveToday(start, n);
    return { n, served: day.served, day, end: endBusinessDay(day.save) };
  });
  for (const r of results) assert(r.served === r.n && r.day.save.business.finance.dailyAccumulator.ordersServed === r.n, `A: precondition — ${r.n} real orders served, ordersServed === ${r.n}`);
  assert(results[1]!.day.popularityDuringDay.every((p) => p === 50) && results[2]!.day.popularityDuringDay.every((p) => p === 50), "A2: popularity never moves during the day, serve by serve (no immediate per-serve +3)");
  assert(results[0]!.end.popularityBreakdown.service === -3, `A3: a day with 0 served orders scores -3 (got ${results[0]!.end.popularityBreakdown.service})`);
  assert(results[1]!.end.popularityBreakdown.service === 3 && results[2]!.end.popularityBreakdown.service === 3, "A4: 1 and 8 served orders both score exactly +3");
  const hundred = endBusinessDay({ ...results[1]!.day.save, business: { ...results[1]!.day.save.business, finance: { ...results[1]!.day.save.business.finance, dailyAccumulator: { ...results[1]!.day.save.business.finance.dailyAccumulator, ordersServed: 100 } } } });
  assert(hundred.popularityBreakdown.service === 3 && dailyServiceDelta(100) === 3 && dailyServiceDelta(1) === 3 && dailyServiceDelta(0) === -3, "A5: 100 served orders still score exactly +3 (bounded)");
  assert(dailyServiceDelta(1) === orderCompletedDelta({ onTime: true }) && dailyServiceDelta(0) === orderFailedDelta(), "A6: the service score reuses the existing orderCompletedDelta / orderFailedDelta constants (no new constants)");
  // The order count never changes the day's popularity: every term but inspection is identical for 1 vs 8
  // served. (Inspection can differ — 8 serves mean more restocking, and end-of-day stock level is an
  // existing Food Storage inspection input — so it is excluded here and checked in D7 instead.)
  const noInspection = (b: { total: number; inspection: number }) => b.total - b.inspection;
  assert(noInspection(results[1]!.end.popularityBreakdown) === noInspection(results[2]!.end.popularityBreakdown) && results[1]!.end.popularityBreakdown.service === results[2]!.end.popularityBreakdown.service, "A7: 1 vs 8 orders move popularity identically apart from inspection (volume-independent service score)");
  const closed = endBusinessDay(results[2]!.day.save);
  assert(closed.save.business.finance.dailyAccumulator.ordersServed === 0, "A8: End Business Day resets today's ordersServed to 0");
}

// ===== B: pull toward 50. =====
{
  assert(POPULARITY_NEUTRAL === 50 && POPULARITY_PULL_RATE === 0.32, "B: N = 50 (the existing default score), k = 0.32");
  const pulls = [80, 20, 50, 51, 49, 100, 0].map((s) => ({ s, b: endBusinessDay(baseSave(s)).popularityBreakdown }));
  const at = (s: number) => pulls.find((p) => p.s === s)!.b;
  assert(at(80).pull === -10 && at(20).pull === 10, `B2: from 80 the pull is -round(0.32x30) = -10; from 20 it is +10 (got ${at(80).pull}, ${at(20).pull})`);
  assert(at(50).pull === 0 && Object.is(at(50).pull, 0), "B3: no pull at exactly 50");
  assert(at(51).pull === 0 && at(49).pull === 0, "B4: within rounding of 50 the pull is 0");
  assert(at(100).pull === -16 && at(0).pull === 16, "B5: the pull uses P_start: -16 at 100, +16 at 0");
  const pStart = 80;
  const r = endBusinessDay(baseSave(pStart));
  const b = r.popularityBreakdown;
  assert(b.total === b.operations + b.inspection + b.service + b.pull && r.popularityScore === Math.max(0, Math.min(100, pStart + b.total)), "B6: P_end = clamp(P_start + operations + inspection + service + pull)");
}

// ===== C: boundaries. =====
{
  // Recovery from 0 even on the worst day: BROKEN fridge (-3 ops, FAIL -6), no service (-3), pull +16 -> +4.
  const worst = endBusinessDay(baseSave(0, { calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } }));
  assert(worst.inspectionReport.overall === "FAIL" && worst.popularityScore > 0, `C: from 0, even a BROKEN-fridge / FAIL / no-service day moves popularity off 0 (got ${worst.popularityScore})`);
  let s = baseSave(0);
  const trace: number[] = [];
  for (let d = 0; d < 10; d++) { s = closeDay(serveToday(s, 8).save); trace.push(s.business.popularity.score); }
  const firstAtNeutral = trace.findIndex((p) => p >= 50);
  assert(trace[0]! > 0 && firstAtNeutral > 0 && trace.slice(0, firstAtNeutral + 1).every((p, i) => i === 0 || p > trace[i - 1]!), `C2: from 0 with normal service, popularity leaves 0 on day 1 and rises every day until it reaches 50 (${trace.join(",")})`);
  let h = baseSave(100);
  const htrace: number[] = [];
  for (let d = 0; d < 10; d++) { h = closeDay(serveToday(h, 8).save); htrace.push(h.business.popularity.score); }
  assert(htrace[0]! < 100 && htrace[9]! < 100, `C3: from 100 with normal service, popularity declines and does not return to 100 (${htrace.join(",")})`);
  // Clamping: start 100 with every positive term; start 0 with forced extreme negatives.
  const best = endBusinessDay({ ...baseSave(100), business: { ...baseSave(100).business, staff: { hiredRoles: ["line-cook", "head-chef", "server"] }, finance: { ...baseSave(100).business.finance, dailyAccumulator: { ...baseSave(100).business.finance.dailyAccumulator, ordersServed: 5 } } } });
  assert(best.popularityScore <= 100 && best.popularityScore >= 0, `C4: result is clamped to [0,100] (got ${best.popularityScore})`);
  const low = endBusinessDay(baseSave(2, { calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } }));
  assert(low.popularityScore >= 0, `C5: never below 0 (got ${low.popularityScore})`);
  // Worst-case sustained play (BROKEN fridge never repaired, no service): never stuck at 0.
  let w = baseSave(0, { equipmentCondition: { refrigeratorCondition: 5 } });
  const wtrace: number[] = [];
  for (let d = 0; d < 30; d++) { w = closeDay(w); wtrace.push(w.business.popularity.score); }
  assert(wtrace.every((p) => p > 0), `C6: 30 worst-case days never sit at 0 (min ${Math.min(...wtrace)})`);
}

// ===== D: every existing term still moves the result. =====
{
  const ref = endBusinessDay(baseSave(50, {}, 300_000));
  const withRoles = (roles: string[]) => endBusinessDay(baseSave(50, { staff: { hiredRoles: roles as never } }, 300_000));
  for (const role of ["line-cook", "head-chef", "server"]) {
    const r = withRoles([role]);
    const expected = staffPopularityDelta([role as never]);
    assert(expected > 0 && r.popularityDelta - ref.popularityDelta === expected && r.popularityBreakdown.operations - ref.popularityBreakdown.operations === expected, `D: ${role} changes the day by +${expected}`);
  }
  // Pricing: price one dish at 0.4x its default -> pricingDelta +1 (existing rule).
  const dish = getBusinessDish("biz-garden-salad")!;
  const cheap = setMenuPrice(baseSave(50), dish.sourceRecipeId, Math.round(businessDishPrice({}, dish) * 0.4));
  const pricey = setMenuPrice(baseSave(50), dish.sourceRecipeId, Math.round(businessDishPrice({}, dish) * 1.6));
  if (cheap.ok && pricey.ok) {
    const c = endBusinessDay(cheap.save);
    const p = endBusinessDay(pricey.save);
    assert(c.popularityDelta - ref.popularityDelta === pricingDelta(cheap.save.business.menu) && pricingDelta(cheap.save.business.menu) === 1, "D4: underpricing changes the day by the existing pricing term (+1)");
    assert(p.popularityDelta - ref.popularityDelta === pricingDelta(pricey.save.business.menu) && pricingDelta(pricey.save.business.menu) === -3, "D5: overpricing changes the day by the existing pricing term (-3)");
  } else assert(false, "D4/D5: precondition — menu prices set");
  // Fridge + inspection: a BROKEN fridge moves both the operations term and the inspection term.
  const broken = endBusinessDay(baseSave(50, { calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } }));
  assert(broken.popularityBreakdown.operations - ref.popularityBreakdown.operations === refrigeratorPopularityDelta(5) && refrigeratorPopularityDelta(5) < 0, "D6: fridge condition changes the operations term");
  assert(broken.popularityBreakdown.inspection === inspectionDelta("FAIL") && ref.popularityBreakdown.inspection === inspectionDelta("PASS") && broken.popularityBreakdown.inspection !== ref.popularityBreakdown.inspection, "D7: the inspection result changes the inspection term (PASS +2 vs FAIL -6)");
  // Variety: 25 recipes priced at their own default (pricing stays neutral) -> menuVarietyDelta +1.
  let vs = baseSave(50);
  for (const r of CAMPAIGN_RECIPES.slice(0, 25)) {
    const res = setMenuPrice(vs, r.id, defaultMenuPrice(r));
    if (res.ok) vs = res.save;
  }
  const v = endBusinessDay(vs);
  assert(menuVarietyDelta(vs.business.menu) === 1 && pricingDelta(vs.business.menu) === 0 && v.popularityDelta - ref.popularityDelta === 1, "D8: menu variety (25 priced recipes) changes the day by +1");
  // Service itself: served vs not served differ by exactly 6.
  const served = endBusinessDay(serveToday(baseSave(50), 1).save);
  assert(served.popularityBreakdown.service - ref.popularityBreakdown.service === 6, "D9: a day with service vs a day without differs by exactly 6 in the service term");
}

// ===== E: preview equals the persisted close. =====
{
  let s = baseSave(64, { staff: { hiredRoles: ["server"] } });
  s = serveToday(s, 4).save;
  const preview = previewBusinessDayClose(s);
  const snapshot = JSON.stringify(s);
  const actual = closeDay(JSON.parse(snapshot) as SaveData);
  assert(JSON.stringify(s) === snapshot, "E: previewing mutates nothing");
  assert(preview.popularityScore === actual.business.popularity.score && preview.save.business.popularity.score === actual.business.popularity.score, `E2: preview popularity (${preview.popularityScore}) === persisted close (${actual.business.popularity.score})`);
  const again = endBusinessDay(JSON.parse(snapshot) as SaveData);
  assert(JSON.stringify(preview.popularityBreakdown) === JSON.stringify(again.popularityBreakdown) && preview.popularityDelta === again.popularityDelta, "E3: preview breakdown === actual breakdown");
}

// ===== F: save/reload + migration. =====
{
  const s = serveToday(baseSave(70), 3).save;
  const reloaded = JSON.parse(JSON.stringify(s)) as SaveData;
  assert(reloaded.business.finance.dailyAccumulator.ordersServed === 3, "F: ordersServed survives a JSON save/reload mid-day");
  const a = endBusinessDay(s);
  const b = endBusinessDay(reloaded);
  assert(JSON.stringify(a.popularityBreakdown) === JSON.stringify(b.popularityBreakdown) && a.popularityScore === b.popularityScore, "F2: closing the reloaded save gives the identical popularity result");
  const closed = JSON.parse(JSON.stringify(closeDay(s))) as SaveData;
  assert(closed.business.popularity.score === a.popularityScore, "F3: the closed day's popularity persists across reload");
  // Old save: accumulator without ordersServed -> migrates to 0, other fields untouched.
  const oldFinance = JSON.parse(JSON.stringify(s.business.finance)) as { dailyAccumulator: Record<string, number> };
  delete oldFinance.dailyAccumulator["ordersServed"];
  const migrated = migrateBusinessFinanceState(oldFinance, s.economyLedger);
  assert(migrated.dailyAccumulator.ordersServed === 0 && migrated.dailyAccumulator.revenue === s.business.finance.dailyAccumulator.revenue && migrated.dailyAccumulator.cogs === s.business.finance.dailyAccumulator.cogs, "F4: an old accumulator without ordersServed migrates to 0, keeping revenue/COGS");
  const noFinance = migrateBusinessFinanceState(undefined, []);
  assert(noFinance.dailyAccumulator.ordersServed === 0, "F5: a save with no finance state at all gets ordersServed 0");
  const legacyAcc = { ...s, business: { ...s.business, finance: { ...s.business.finance, dailyAccumulator: { ...s.business.finance.dailyAccumulator, ordersServed: undefined as unknown as number } } } };
  assert(endBusinessDay(legacyAcc).popularityBreakdown.service === -3, "F6: a missing ordersServed is read as 0 (no service) by the close");
}

// ===== G: a $0 dish counts as served. =====
{
  let s = baseSave(50);
  for (const id of FOCUS_MENU) {
    const d = getBusinessDish(id)!;
    const r = setMenuPrice(s, d.sourceRecipeId, 0);
    if (r.ok) s = r.save;
  }
  const creditsBefore = s.credits;
  const day = serveToday(s, 1);
  const rev = day.save.economyLedger.filter((e) => e.category === "business-revenue");
  assert(day.served === 1 && rev.length === 0 && day.save.business.finance.dailyAccumulator.revenue === 0, "G: a $0 dish is served with $0 revenue (no ledger movement for a 0 amount)");
  assert(day.save.business.finance.dailyAccumulator.ordersServed === 1 && day.save.credits <= creditsBefore, "G2: the $0 serve still counts as a served order");
  assert(endBusinessDay(day.save).popularityBreakdown.service === 3, "G3: a day whose only serve was $0 earns the +3 service score");
}

// ===== H: determinism. =====
{
  const runTrace = () => {
    let s = baseSave(50, { staff: { hiredRoles: ["line-cook"] } });
    const t: number[] = [];
    for (let d = 0; d < 20; d++) { s = closeDay(serveToday(s, d % 5 === 0 ? 0 : 6).save); t.push(s.business.popularity.score); }
    return t.join(",");
  };
  const a = runTrace();
  assert(a === runTrace(), `H: identical inputs give identical popularity sequences (${a})`);
}

// ===== I: Campaign isolation + Economy V2 freeze. =====
{
  const s = { ...baseSave(50), levelProgress: DEFAULT_SAVE.levelProgress, recipeProgress: { "camp-garlic-bread": { bestScore: 91 } } as never };
  const nonBusiness = (x: SaveData) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !["business", "credits", "economyLedger"].includes(k))));
  const after = closeDay(serveToday(s, 5).save);
  assert(nonBusiness(after) === nonBusiness(s), "I: serving + closing a D2 day changes no Campaign field (levelProgress, recipeProgress, ...)");
  const v2 = spawnSync("npx", ["tsx", JSON.stringify(path.resolve(import.meta.dirname, "economy-v2-campaign-simulation.mts"))], { encoding: "utf8", shell: true });
  const honest = v2.stdout.slice(v2.stdout.indexOf("SIMULATION HONEST"), v2.stdout.indexOf("Total net campaign result") + 60);
  const has = (label: string, value: string) => new RegExp(`${label}:\\s*${value}(?![\\d,])`).test(honest);
  assert(v2.status === 0 && has("Gross recipe revenue", "\\$165,140\\.00") && has("Level-completion rewards", "\\$77,581\\.00") && has("Total COGS", "\\$37,620\\.00") && has("Total quality bonuses", "\\$3,315\\.00") && has("Total net campaign result", "\\$208,416\\.00"), "I2: Economy V2 freeze exact — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards)");
}

// ===== S: simulation scenarios (120 days each, real pipeline, no tuning). =====
// Staff scenarios get enough cash to keep paying payroll for all 120 days, so they measure the staff's popularity
// effect rather than an early layoff (with $3,000 the three roles are laid off on day 5). Setup only — no rule is tuned.
type Scenario = { name: string; start: number; orders: number; hires?: string[]; priceX?: number; repairs?: boolean; credits?: number };
const SCENARIOS: Scenario[] = [
  { name: "normal (8/day, start 50)", start: 50, orders: 8 },
  { name: "start 0", start: 0, orders: 8 },
  { name: "start 100", start: 100, orders: 8 },
  { name: "overpriced x1.5", start: 50, orders: 8, priceX: 1.5 },
  { name: "poor maintenance", start: 50, orders: 8, repairs: false },
  { name: "never serves", start: 50, orders: 0 },
  { name: "Head Chef", start: 50, orders: 8, hires: ["head-chef"], credits: 100_000_000 },
  { name: "all three popularity staff", start: 50, orders: 8, hires: ["line-cook", "head-chef", "server"], credits: 100_000_000 },
];
console.log("\n  scenario                      final  avg(d31-120)  min>d10  max   days@100  days@0(>d10)");
for (const sc of SCENARIOS) {
  let s = baseSave(sc.start, {}, sc.credits);
  if (sc.priceX) for (const id of FOCUS_MENU) {
    const d = getBusinessDish(id)!;
    const r = setMenuPrice(s, d.sourceRecipeId, Math.round(businessDishPrice({}, d) * sc.priceX));
    if (r.ok) s = r.save;
  }
  for (const role of sc.hires ?? []) { const r = hireStaff(s, role); if (r.ok) s = r.save; }
  const t: number[] = [];
  for (let d = 1; d <= 120; d++) {
    if (sc.repairs !== false && maintenanceStatusFor(s.business.equipmentCondition.refrigeratorCondition) !== "OPERATIONAL") {
      const r = performRefrigeratorMaintenance(s);
      if (r.ok) s = recordMaintenanceCost(appendLedgerEntry(r.save, "refrigerator-maintenance", -r.cost), r.cost);
    }
    s = closeDay(serveToday(s, sc.orders).save);
    t.push(s.business.popularity.score);
  }
  const tail = t.slice(30);
  const after10 = t.slice(10);
  const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
  const at100 = t.filter((p) => p === 100).length;
  const at0 = after10.filter((p) => p === 0).length;
  console.log(`  ${sc.name.padEnd(29)} ${String(t[119]).padStart(5)} ${avg.toFixed(1).padStart(12)} ${String(Math.min(...after10)).padStart(8)} ${String(Math.max(...t)).padStart(5)} ${String(at100).padStart(9)} ${String(at0).padStart(12)}`);
  assert(at100 === 0, `S: ${sc.name} — never saturates at 100`);
  assert(at0 === 0 && s.credits >= 0, `S2: ${sc.name} — never sits at 0 after day 10; credits never negative`);
  if (sc.hires) assert(sc.hires.every((r) => s.business.staff.hiredRoles.includes(r as never)), `S3: ${sc.name} — the staff are still employed on day 120`);
}

console.log(failures === 0 ? "\nBUSINESS POPULARITY D2 QA: ALL PASS" : `\nBUSINESS POPULARITY D2 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
