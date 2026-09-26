/**
 * BUSINESS_OPERATIONS_QA — the pre-V3-16 Operations/Feedback checkpoint.
 * Verifies the derived alert layer (businessAlerts.ts) against the REAL
 * production managers only: no false alerts on a healthy restaurant,
 * refrigerator NEEDS_SERVICE/BROKEN, inspection WARNING/FAIL and the
 * repeated-WARNING fine rule, supplier event visibility, near-expiry and
 * spoil-tonight stock, shortages that block orders, the order → prep →
 * serve → revenue loop, the end-of-day summary being the SAME numbers
 * End Business Day produces, no duplicate notifications, reload
 * persistence, Campaign isolation, no second wallet, no duplicate
 * ledger entries, and determinism.
 *
 * Run: npx tsx scripts/business-operations-qa.mts
 */
import { willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, type BusinessInventory } from "../src/game/business/businessInventory.ts";
import {
  createBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessOrderAvailability,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import { getBusinessDish, businessDishPrice } from "../src/game/business/businessDishCatalog.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { recordMaintenanceCost } from "../src/game/business/BusinessFinanceManager.ts";
import type { ServiceSession } from "../src/game/service/ServiceManager.ts";
import {
  performRefrigeratorMaintenance as performMaintenanceFromCatalog,
  maintenanceStatusFor,
  maintenanceCostFor,
} from "../src/game/business/businessMaintenance.ts";
import { signContract } from "../src/game/business/BusinessSupplierManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { eventForDay } from "../src/game/business/businessSupplierEvents.ts";
import { perishabilityStateFor, shelfLifeForIngredient } from "../src/game/business/perishability.ts";
import { getInventoryUsedCapacity, getRefrigeratorCapacity } from "../src/game/business/RefrigeratorManager.ts";
import { dailyPayroll } from "../src/game/business/businessStaff.ts";
import { formatUsd } from "../src/game/business/businessCurrency.ts";
import { INGREDIENTS, type IngredientId } from "../src/game/definitions.ts";
import {
  businessAlertsFor,
  previewBusinessDayClose,
  newlyRaisedAlerts,
  alertKeys,
  stockSpoilingTonight,
  stockNearExpiry,
  makeableDishCount,
  supplierMarketToday,
  repeatedWarningFineAmount,
  failFineAmount,
  type BusinessAlert,
} from "../src/game/business/businessAlerts.ts";

let failures = 0;
// Economy V3 Phase 16 (WTP, intentional rule change): a Business customer pays menu price ×
// willingnessToPayMultiplierFor(popularity), rounded once to cents. These scenarios run at the
// default popularity 50, so the exact expected payment is:
const WTP_HUNDREDTHS_AT_50 = Math.round(willingnessToPayMultiplierFor(50) * 100);
const customerPaysAt50 = (menuPrice: number) => Math.round((menuPrice * WTP_HUNDREDTHS_AT_50) / 100);

function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// Mirrors App.tsx's own wrapper compositions exactly.
function performMaintenanceComposed(save: SaveData) {
  const result = performMaintenanceFromCatalog(save);
  if (!result.ok) return result;
  const withLedger = appendLedgerEntry(result.save, "refrigerator-maintenance", -result.cost);
  return { ...result, save: recordMaintenanceCost(withLedger, result.cost) };
}
function endBusinessDayComposed(save: SaveData) {
  const result = endBusinessDay(save);
  const withPayroll = appendLedgerEntry(result.save, "business-staff-salary", -result.payrollPaid);
  const withFine = appendLedgerEntry(withPayroll, "inspection-fine", -result.inspectionFine.finePaid);
  return { ...result, save: withFine };
}

const SALAD_DISH = getBusinessDish("biz-garden-salad")!;
const SALAD_RECIPE_ID = SALAD_DISH.sourceRecipeId;

/** Day 7 is a quiet day in the 9-day supplier-event cycle — asserted, never assumed. */
const QUIET_DAY = 7;

function saladInventory(day: number, qty = 3): BusinessInventory {
  let inv = addStock({}, "tomato", qty, 100, day);
  inv = addStock(inv, "cucumber", qty, 100, day);
  inv = addStock(inv, "carrot", qty, 100, day);
  return inv;
}

function healthySave(overrides: Partial<SaveData["business"]> = {}, credits = 500_000): SaveData {
  return {
    ...DEFAULT_SAVE,
    credits,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: QUIET_DAY },
      inventory: saladInventory(QUIET_DAY),
      ...overrides,
    },
  };
}

function conditionWithStatus(status: "OPERATIONAL" | "NEEDS_SERVICE" | "BROKEN"): number {
  for (let c = 100; c >= 0; c--) if (maintenanceStatusFor(c) === status) return c;
  throw new Error(`no condition maps to ${status}`);
}

function sessionReadyFor(recipeId: string): ServiceSession {
  for (let seed = 1; seed < 300; seed++) {
    let session = createBusinessServiceSession(makeSeededRand(seed));
    if (session.current?.recipe.id !== recipeId) continue;
    session = recordBusinessServiceComponents(session, 80);
    if (session.current?.order.status === "READY") return session;
  }
  throw new Error(`QA precondition failed: no READY ${recipeId} order under seed 300`);
}
function sessionWith(recipeId: string): ServiceSession {
  for (let seed = 1; seed < 300; seed++) {
    const session = createBusinessServiceSession(makeSeededRand(seed));
    if (session.current?.recipe.id === recipeId) return session;
  }
  throw new Error(`QA precondition failed: no ${recipeId} order under seed 300`);
}
function orderRef(session: ServiceSession) {
  return { orderId: session.current!.order.id, recipeId: session.current!.recipe.id };
}
const nonOk = (alerts: BusinessAlert[]) => alerts.filter((a) => a.severity !== "ok");
const find = (alerts: BusinessAlert[], prefix: string) => alerts.find((a) => a.key.startsWith(prefix));

// ===== A: no false alerts — a healthy, stocked, quiet-day restaurant raises nothing actionable. =====
{
  assert(eventForDay(QUIET_DAY) === null, "A0: precondition — Day 7 has no supplier event");
  const save = healthySave();
  const used = getInventoryUsedCapacity(save.business.inventory);
  const cap = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  assert(used / cap < 0.75, `A0b: precondition — storage has headroom (${used}/${cap})`);
  const alerts = businessAlertsFor(save);
  assert(nonOk(alerts).length === 0, `A: healthy restaurant has zero actionable alerts (got ${nonOk(alerts).map((a) => a.key).join(", ") || "none"})`);
  assert(!!find(alerts, "dishes-available"), "A2: the ✓ 'Menu Ready' line is present");
  assert(previewBusinessDayClose(save).inspectionReport.overall === "PASS", "A3: the end-of-day inspection preview is PASS");
  assert(newlyRaisedAlerts(new Set(), alerts).length === 0, "A4: a healthy restaurant produces zero banner notifications even from an empty seen-set");
}

// ===== B: refrigerator NEEDS_SERVICE / BROKEN, with the real repair cost and a working repair action. =====
{
  const needs = conditionWithStatus("NEEDS_SERVICE");
  const broken = conditionWithStatus("BROKEN");
  const saveN = healthySave({ equipmentCondition: { refrigeratorCondition: needs } });
  const aN = find(businessAlertsFor(saveN), "fridge:");
  assert(aN?.key === "fridge:NEEDS_SERVICE" && aN.severity === "warning", "B: NEEDS_SERVICE raises a warning-level refrigerator alert");
  assert(!!aN && aN.detail.includes(formatUsd(maintenanceCostFor(needs)!)), `B2: the alert shows the real repair cost (${formatUsd(maintenanceCostFor(needs)!)})`);
  assert(aN?.action?.kind === "repair-refrigerator", "B3: the alert carries a direct Repair action");
  const saveB = healthySave({ equipmentCondition: { refrigeratorCondition: broken } });
  const aB = find(businessAlertsFor(saveB), "fridge:");
  assert(aB?.key === "fridge:BROKEN" && aB.severity === "critical", "B4: BROKEN raises a critical refrigerator alert");
  assert(!!aB && aB.detail.includes(formatUsd(maintenanceCostFor(broken)!)), "B5: the BROKEN alert shows the BROKEN repair cost");
  const repaired = performMaintenanceComposed(saveB);
  assert(repaired.ok, "B6: the repair action succeeds with enough cash");
  if (repaired.ok) {
    assert(!find(businessAlertsFor(repaired.save), "fridge:"), "B7: after repair the refrigerator alert is gone");
    const entries = repaired.save.economyLedger.filter((e) => e.category === "refrigerator-maintenance");
    assert(entries.length === 1 && entries[0]!.amount === -maintenanceCostFor(broken)!, "B8: the repair wrote exactly one maintenance ledger entry for the exact cost");
  }
  const poor = healthySave({ equipmentCondition: { refrigeratorCondition: broken } }, 100);
  assert(find(businessAlertsFor(poor), "fridge:")!.detail.includes("Not enough cash"), "B9: the alert is honest when the repair is unaffordable");
}

// ===== C: inspection WARNING / FAIL and the repeated-WARNING rule — alert fine === what End Business Day actually charges. =====
{
  const needs = conditionWithStatus("NEEDS_SERVICE");
  const first = healthySave({ equipmentCondition: { refrigeratorCondition: needs }, inspectionFines: { lastInspectionResult: "PASS" } });
  const aFirst = find(businessAlertsFor(first), "inspection:");
  assert(aFirst?.key === "inspection:WARNING" && aFirst.severity === "warning", "C: a would-be WARNING raises an inspection warning alert");
  assert(!!aFirst && aFirst.detail.includes("first WARNING isn't fined") && aFirst.detail.includes(formatUsd(repeatedWarningFineAmount())), "C2: a first WARNING explains it isn't fined and names the repeat fine");
  assert(aFirst?.detail.includes("Refrigerator Condition (WARNING)") ?? false, "C3: the affected category is named");
  const actualFirst = endBusinessDayComposed(first);
  assert(actualFirst.inspectionFine.finePaid === 0, "C4: End Business Day indeed charges no fine for a first WARNING");

  const repeat = healthySave({ equipmentCondition: { refrigeratorCondition: needs }, inspectionFines: { lastInspectionResult: "WARNING" } });
  const aRepeat = find(businessAlertsFor(repeat), "inspection:");
  assert(!!aRepeat && aRepeat.detail.includes("repeated WARNING") && aRepeat.detail.includes(formatUsd(repeatedWarningFineAmount())), "C5: a repeated WARNING explains the rule and the fine");
  const actualRepeat = endBusinessDayComposed(repeat);
  assert(actualRepeat.inspectionFine.finePaid === repeatedWarningFineAmount(), `C6: End Business Day charges exactly the ${formatUsd(repeatedWarningFineAmount())} the alert predicted`);

  const broken = healthySave({ equipmentCondition: { refrigeratorCondition: conditionWithStatus("BROKEN") } });
  const aFail = find(businessAlertsFor(broken), "inspection:");
  assert(aFail?.key === "inspection:FAIL" && aFail.severity === "critical" && aFail.detail.includes(formatUsd(failFineAmount())), "C7: a would-be FAIL is critical and names the FAIL fine");
  assert(endBusinessDayComposed(broken).inspectionFine.finePaid === failFineAmount(), "C8: End Business Day charges exactly the FAIL fine the alert predicted");
  const fineEntries = actualRepeat.save.economyLedger.filter((e) => e.category === "inspection-fine");
  assert(fineEntries.length === 1, "C9: one fine = exactly one inspection-fine ledger entry");
}

// ===== D: supplier events are visible, with suspension and effective prices that match the real purchase formula. =====
{
  assert(eventForDay(1)?.id === "supplier-delay", "D0: precondition — Day 1 is Supplier Delay");
  const base = healthySave({ calendar: { businessDay: 1 }, inventory: saladInventory(1) });
  const signed = signContract(base, "local-market");
  assert(signed.ok, "D0b: precondition — contract signs");
  if (signed.ok) {
    const alerts = businessAlertsFor(signed.save);
    const ev = find(alerts, "supplier-event:");
    assert(ev?.key === "supplier-event:1:supplier-delay" && ev.severity === "warning", "D: an active contract on a Supplier Delay day raises a 'discount suspended' warning");
    const market = supplierMarketToday(signed.save);
    assert(market.contractDiscountSuspended, "D2: the market view reports the contract discount suspended");
    assert(market.offers.every((o) => o.effectivePrice === market.referencePriceToday), "D3: every effective price equals the undiscounted event price while suspended");
  }
  const noContract = businessAlertsFor(base);
  assert(find(noContract, "supplier-event:")?.severity === "info", "D4: without a contract, the same event is informational, not a warning");
  // Day 3 = Bulk Discount (-15%); Local Market 5% at its 5-unit minimum.
  const day3 = signContract(healthySave({ calendar: { businessDay: 3 }, inventory: saladInventory(3) }), "local-market");
  if (day3.ok) {
    const m = supplierMarketToday(day3.save);
    const current = m.offers.find((o) => o.isCurrent)!;
    assert(m.referencePriceToday === 85 && current.effectivePrice === Math.round(85 * 0.95), `D5: Bulk Discount $1.00 → $0.85, with the 5% contract → ${formatUsd(Math.round(85 * 0.95))}`);
  }
}

// ===== E: near-expiry and stock that spoils tonight — matches what End Business Day actually sweeps. =====
{
  const day = 20;
  const shelf = shelfLifeForIngredient("tomato");
  let inv = addStock({}, "tomato", 2, 100, day - (shelf - 1)); // expires at day+1
  // Pick, from the real registry, an ingredient whose shelf life has a
  // NEAR_EXPIRY day that is NOT also its last day (short-lived items like
  // carrot go NEAR_EXPIRY → EXPIRED in one step).
  let nearDay = -1;
  let nearId: IngredientId = "carrot";
  for (const id of Object.keys(INGREDIENTS) as IngredientId[]) {
    if (id === "tomato") continue;
    for (let p = day; p > day - shelfLifeForIngredient(id) && p > 0; p--) {
      if (perishabilityStateFor(id, p, day) === "NEAR_EXPIRY" && perishabilityStateFor(id, p, day + 1) !== "EXPIRED") {
        nearDay = p;
        nearId = id;
        break;
      }
    }
    if (nearDay > 0) break;
  }
  if (nearDay > 0) inv = addStock(inv, nearId, 2, 100, nearDay);
  const save = healthySave({ calendar: { businessDay: day }, inventory: inv });
  const tonight = stockSpoilingTonight(save);
  assert(tonight.length === 1 && tonight[0] === "tomato", "E: tomato at the end of its shelf life is flagged as spoiling tonight");
  const actual = endBusinessDay(save);
  assert(JSON.stringify([...actual.spoiledIngredientIds].sort()) === JSON.stringify([...tonight].sort()), "E2: the flagged items are exactly what End Business Day discards");
  const a = find(businessAlertsFor(save), "spoil-tonight:");
  assert(!!a && a.severity === "warning" && a.detail.includes("Tomato"), "E3: a 'Stock Spoils Tonight' warning names the ingredient");
  if (nearDay > 0) {
    assert(stockNearExpiry(save).includes(nearId) && !stockSpoilingTonight(save).includes(nearId), `E4: ${nearId} at NEAR_EXPIRY (not spoiling tonight) is listed as nearing expiry`);
    assert(find(businessAlertsFor(save), "near-expiry:")?.severity === "info", "E5: near-expiry is informational and non-spamming (notify=false)");
  } else {
    assert(false, "E4: precondition — no registry ingredient has a NEAR_EXPIRY day before its last day");
  }
}

// ===== F: shortages that block orders — only the genuinely short ingredient is named. =====
{
  let inv = addStock({}, "tomato", 3, 100, QUIET_DAY);
  inv = addStock(inv, "cucumber", 3, 100, QUIET_DAY);
  const save = healthySave({ inventory: inv });
  const session = sessionWith(SALAD_RECIPE_ID);
  const avail = businessOrderAvailability(save, SALAD_DISH);
  assert(!avail.available && JSON.stringify(avail.missing) === JSON.stringify(["carrot"]), `F: availability names ONLY the short ingredient (got ${!avail.available ? JSON.stringify(avail.missing) : "available"})`);
  const alerts = businessAlertsFor(save, orderRef(session));
  const blocked = find(alerts, "order-blocked:");
  assert(!!blocked && blocked.detail.includes("Carrot") && !blocked.detail.includes("Tomato"), "F2: the blocked-order alert names Carrot only");
  const empty = healthySave({ inventory: {} });
  assert(makeableDishCount(empty) === 0 && find(businessAlertsFor(empty), "no-dishes")?.severity === "warning", "F3: empty stock raises 'No Dish Can Be Made'");
}

// ===== G: order → preparation → serve → payment → revenue → popularity, and the alert layer follows it. =====
{
  const save = healthySave({ inventory: saladInventory(QUIET_DAY, 1) });
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const price = businessDishPrice(save.business.menu, SALAD_DISH);
  const served = serveBusinessOrder(session, save, makeSeededRand(1))!;
  assert(served !== null, "G: a READY order with stock is served");
  const after = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
  assert(after.credits === save.credits + customerPaysAt50(price) && after.business.finance.dailyAccumulator.revenue === customerPaysAt50(price), "G2: payment = menu price × popularity modifier, reflected in cash and today's revenue");
  // Economy V3 Phase 16 popularity model D2 (intentional rule change): the serve counts toward today's ordersServed; popularity moves only at End Business Day.
  assert(after.business.popularity.score === save.business.popularity.score && after.business.finance.dailyAccumulator.ordersServed === save.business.finance.dailyAccumulator.ordersServed + 1, "G3: a successful serve leaves popularity unchanged and counts +1 served order for today (D2)");
  assert(after.economyLedger.filter((e) => e.category === "business-revenue").length === 1, "G4: exactly one revenue ledger entry");
  const alerts = businessAlertsFor(after);
  assert(find(alerts, "no-dishes")?.severity === "warning", "G5: consuming the last salad stock correctly raises 'No Dish Can Be Made'");
  assert(newlyRaisedAlerts(alertKeys(businessAlertsFor(save)), alerts).map((a) => a.key).join(",") === "no-dishes", "G6: that transition raises exactly one banner");
}

// ===== H: the end-of-day preview IS End Business Day — same numbers, and previewing mutates nothing. =====
{
  const save = healthySave({ staff: { hiredRoles: ["cleaner"] }, equipmentCondition: { refrigeratorCondition: conditionWithStatus("NEEDS_SERVICE") } });
  const snapshot = JSON.stringify(save);
  const preview = previewBusinessDayClose(save);
  assert(JSON.stringify(save) === snapshot, "H: previewing End Business Day mutates nothing");
  assert(save.economyLedger.length === DEFAULT_SAVE.economyLedger.length, "H2: previewing creates no ledger entry");
  const actual = endBusinessDayComposed(save);
  assert(JSON.stringify(preview.dailyPnL) === JSON.stringify(actual.dailyPnL), "H3: the preview's daily P&L equals the real one exactly");
  assert(preview.payrollPaid === actual.payrollPaid && preview.popularityDelta === actual.popularityDelta, "H4: payroll and popularity change match");
  assert(JSON.stringify(actual.save.business.finance.lastDailyPnL) === JSON.stringify(actual.dailyPnL), "H5: the summary shown after reload (lastDailyPnL) is the same P&L");
  assert(actual.dailyPnL.openingCash + actual.dailyPnL.netCashChange === actual.dailyPnL.closingCash && actual.dailyPnL.closingCash === actual.save.credits, "H6: opening + net change = closing = real credits");
}

// ===== I: no duplicate / repeated notifications. =====
{
  const save = healthySave({ equipmentCondition: { refrigeratorCondition: conditionWithStatus("NEEDS_SERVICE") } });
  const alerts = businessAlertsFor(save);
  const seen = alertKeys(alerts);
  assert(newlyRaisedAlerts(seen, businessAlertsFor(save)).length === 0, "I: re-evaluating the same state (a re-render) raises nothing");
  const keysA = [...alertKeys(alerts)].join("|");
  const keysB = [...alertKeys(businessAlertsFor(JSON.parse(JSON.stringify(save)) as SaveData))].join("|");
  assert(keysA === keysB, "I2: keys are stable across identical states");
  const worse = { ...save, business: { ...save.business, equipmentCondition: { refrigeratorCondition: conditionWithStatus("BROKEN") } } };
  const fresh = newlyRaisedAlerts(seen, businessAlertsFor(worse)).map((a) => a.key);
  assert(fresh.includes("fridge:BROKEN") && fresh.length === new Set(fresh).size, "I3: a real transition (NEEDS_SERVICE → BROKEN) raises it once, with no duplicate keys");
  assert(businessAlertsFor(save).every((a) => a.severity !== "ok" || !a.notify), "I4: ✓ status lines never notify");
  assert(new Set(alerts.map((a) => a.key)).size === alerts.length, "I5: no duplicate alerts in a single evaluation");
}

// ===== J: reload persistence — alerts derive from persisted state only (nothing extra to save). =====
{
  const save = healthySave({ equipmentCondition: { refrigeratorCondition: conditionWithStatus("NEEDS_SERVICE") }, inspectionFines: { lastInspectionResult: "WARNING" } });
  const parsed = JSON.parse(JSON.stringify(save)) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...parsed, business: { ...DEFAULT_SAVE.business, ...parsed.business } } as SaveData;
  assert(JSON.stringify(businessAlertsFor(migrated)) === JSON.stringify(businessAlertsFor(save)), "J: identical alerts after a save/reload round-trip");
  assert(Object.keys(migrated.business).sort().join(",") === Object.keys(DEFAULT_SAVE.business).sort().join(","), "J2: BusinessState gained no new persisted field in this checkpoint");
  const oldSave = { ...DEFAULT_SAVE, business: { ...DEFAULT_SAVE.business } } as SaveData;
  assert(Array.isArray(businessAlertsFor(oldSave)), "J3: a default/migrated save evaluates without error");
}

// ===== K: Campaign isolation — Campaign state never changes Business alerts, and alerts never touch Campaign. =====
{
  const save = healthySave();
  const campaignAdvanced = { ...save, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-50" } } as SaveData;
  assert(JSON.stringify(businessAlertsFor(save)) === JSON.stringify(businessAlertsFor(campaignAdvanced)), "K: Campaign progress has no effect on Business alerts");
  const snapshot = JSON.stringify(campaignAdvanced.levelProgress);
  businessAlertsFor(campaignAdvanced);
  previewBusinessDayClose(campaignAdvanced);
  assert(JSON.stringify(campaignAdvanced.levelProgress) === snapshot, "K2: evaluating alerts/preview never touches levelProgress");
}

// ===== L: no second wallet — SaveData's top-level shape is unchanged. =====
{
  assert(Object.keys(DEFAULT_SAVE).filter((k) => /wallet|cash|usd|alert|notification/i.test(k)).length === 0, "L: no wallet/cash/alert field was added to SaveData");
  const save = healthySave({ staff: { hiredRoles: ["cleaner"] } }, 10);
  const pay = find(businessAlertsFor(save), "payroll-unaffordable");
  assert(pay?.severity === "critical" && previewBusinessDayClose(save).staffLaidOff.length === 1, "L2: unaffordable payroll is critical, and matches the real lay-off outcome");
  assert(previewBusinessDayClose(save).dailyPnL.closingCash >= 0, "L3: never negative cash");
  const ok = healthySave({ staff: { hiredRoles: ["cleaner"] } });
  assert(find(businessAlertsFor(ok), "payroll-ok")!.detail.includes(formatUsd(dailyPayroll(["cleaner"]))), "L4: staff ✓ line shows the real payroll");
}

// ===== M: contract ending tonight. =====
{
  const signed = signContract(healthySave(), "local-market");
  if (signed.ok) {
    const contract = signed.save.business.supplierContract!;
    const lastDay = { ...signed.save, business: { ...signed.save.business, calendar: { businessDay: contract.contractEndDay - 1 } } };
    assert(!!find(businessAlertsFor(lastDay), "contract-ends:"), "M: the contract's final day raises 'Contract Ends Tonight'");
    assert(endBusinessDay(lastDay).expiredSupplierId === contract.supplierId, "M2: and End Business Day really expires it");
  }
}

// ===== N: determinism. =====
{
  const save = healthySave({ calendar: { businessDay: 1 }, equipmentCondition: { refrigeratorCondition: conditionWithStatus("BROKEN") } });
  const a = JSON.stringify([businessAlertsFor(save), previewBusinessDayClose(save), supplierMarketToday(save)]);
  const b = JSON.stringify([businessAlertsFor(save), previewBusinessDayClose(save), supplierMarketToday(save)]);
  assert(a === b, "N: alerts, preview and market are fully deterministic");
  const sorted = businessAlertsFor(save).map((x) => x.severity);
  const rank = { critical: 0, warning: 1, info: 2, ok: 3 } as const;
  assert(sorted.every((s, i) => i === 0 || rank[sorted[i - 1]!] <= rank[s]), "N2: alerts are ordered most-urgent first");
}

console.log(failures === 0 ? "\nBUSINESS OPERATIONS QA: ALL PASS" : `\nBUSINESS OPERATIONS QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
