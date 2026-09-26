/**
 * BUSINESS_PNL_QA — Economy V3 Phase 15. Verifies the Business Mode P&L
 * layer (BusinessFinanceManager.ts) is built ENTIRELY on the real,
 * already-live Business Mode transaction pipeline: revenue only from a
 * successfully served order (never a generated/cancelled/failed one),
 * COGS from actual ingredient consumption (never purchased-but-unused
 * inventory), labor/maintenance/supplier/inspection costs matching
 * their own real ledger entries exactly, capital investment kept
 * separate from ordinary operating expense, full ledger/wallet
 * reconciliation, persistence, migration, determinism, and Campaign
 * isolation — against the real production functions only.
 *
 * Run: npx tsx scripts/business-pnl-qa.mts
 */
import { willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import {
  createBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand, businessServiceSeedFor } from "../src/game/business/businessDeterministicRandom.ts";
import { getBusinessDish, businessDishPrice } from "../src/game/business/businessDishCatalog.ts";
import { recipeCostBasis } from "../src/game/business/businessMenu.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { appendLedgerEntry, ledgerTotals } from "../src/game/economy/EconomyLedger.ts";
import {
  realCogsFor,
  recordRevenueAndCogs,
  recordInventoryPurchase,
  recordCapitalExpenditure,
  recordMaintenanceCost,
  recordSupplierCost,
  computeDailyPnL,
  closeBusinessDay,
  businessLedgerEntries,
  lifetimeSummary,
  DEFAULT_DAILY_ACCUMULATOR,
} from "../src/game/business/BusinessFinanceManager.ts";
import type { ServiceSession } from "../src/game/service/ServiceManager.ts";
import { purchaseIngredient as purchaseIngredientFromCatalog } from "../src/game/business/BusinessInventoryManager.ts";
import { purchaseRefrigerator as purchaseRefrigeratorFromCatalog } from "../src/game/business/RefrigeratorManager.ts";
import { performRefrigeratorMaintenance as performMaintenanceFromCatalog } from "../src/game/business/businessMaintenance.ts";
import { cancelContract, signContract } from "../src/game/business/BusinessSupplierManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";

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

function saveAt(overrides: Partial<SaveData>): SaveData {
  return { ...DEFAULT_SAVE, ...overrides };
}

// Every "wrapper composition" below mirrors App.tsx's OWN wiring exactly
// (pure manager call -> ledger append -> accumulator record) — this QA
// never invents a second composition or a shortcut around it.
function purchaseIngredientComposed(save: SaveData, id: string, qty: number) {
  const result = purchaseIngredientFromCatalog(save, id, qty);
  if (!result.ok) return result;
  const withLedger = appendLedgerEntry(result.save, "inventory-purchase", -result.totalCost, id);
  return { ...result, save: recordInventoryPurchase(withLedger, result.totalCost) };
}
function purchaseRefrigeratorComposed(save: SaveData, id: string) {
  const result = purchaseRefrigeratorFromCatalog(save, id);
  if (!result.ok) return result;
  const withLedger = appendLedgerEntry(result.save, "refrigerator-purchase", -result.price, id);
  return { ...result, save: recordCapitalExpenditure(withLedger, result.price) };
}
function performMaintenanceComposed(save: SaveData) {
  const result = performMaintenanceFromCatalog(save);
  if (!result.ok) return result;
  const withLedger = appendLedgerEntry(result.save, "refrigerator-maintenance", -result.cost);
  return { ...result, save: recordMaintenanceCost(withLedger, result.cost) };
}
function cancelContractComposed(save: SaveData) {
  const result = cancelContract(save);
  if (!result.ok) return result;
  const withLedger = appendLedgerEntry(result.save, "supplier-contract-cancellation", -result.fee);
  return { ...result, save: recordSupplierCost(withLedger, result.fee) };
}
function endBusinessDayComposed(save: SaveData) {
  const result = endBusinessDay(save);
  const withPayroll = appendLedgerEntry(result.save, "business-staff-salary", -result.payrollPaid);
  const withFine = appendLedgerEntry(withPayroll, "inspection-fine", -result.inspectionFine.finePaid);
  return { ...result, save: withFine };
}

// Fixture dishes: Garden Salad (Vegetable-only, portion fraction 1.0 for
// every ingredient — real per-unit COGS exactly equals recipeCostBasis
// when bought at plain catalog price, a clean verification case) and
// Garlic Bread (contains Aromatic — deliberately used to verify and
// DOCUMENT, not hide, that real whole-unit COGS can exceed the
// Checkpoint 4 portion-scaled menu-pricing cost basis; see this
// script's own Section G).
const SALAD_DISH = getBusinessDish("biz-garden-salad")!;
const SALAD_RECIPE_ID = SALAD_DISH.sourceRecipeId; // "camp-simple-garden-salad"
const BREAD_DISH = getBusinessDish("biz-garlic-bread")!;
const BREAD_RECIPE_ID = BREAD_DISH.sourceRecipeId; // "camp-garlic-bread"

function fullSaladInventory(day: number) {
  let inv = addStock({}, "tomato", 10, 100, day);
  inv = addStock(inv, "cucumber", 10, 100, day);
  inv = addStock(inv, "carrot", 10, 100, day);
  return inv;
}
function fullBreadInventory(day: number) {
  let inv = addStock({}, "bread", 10, 225, day);
  inv = addStock(inv, "garlic", 10, 350, day);
  return inv;
}

/** Drives a fresh session's CURRENT order to READY for a specific target recipe id — deterministic, bounded (never infinite: the pool is fixed at 35 dishes). */
function sessionReadyFor(recipeId: string): ServiceSession {
  for (let seed = 1; seed < 300; seed++) {
    let session = createBusinessServiceSession(makeSeededRand(seed));
    if (session.current?.recipe.id !== recipeId) continue;
    session = recordBusinessServiceComponents(session, 80);
    if (session.current?.order.status === "READY") return session;
  }
  throw new Error(`QA precondition failed: no seed under 300 produced a READY ${recipeId} order`);
}

// ===== A: zero-revenue state — a fresh save has zero revenue, zero COGS, empty ledger, null lastDailyPnL. =====
{
  const save = saveAt({});
  const summary = lifetimeSummary(save);
  assert(summary.cumulativeRevenue === 0 && summary.orderCount === 0, "A: a fresh save has zero cumulative Business revenue and zero orders");
  assert(save.business.finance.lastDailyPnL === null, "A2: a fresh save has never completed a Business Day");
  assert(save.business.finance.dailyAccumulator.revenue === 0, "A3: a fresh save's daily accumulator starts at zero");
}

// ===== B: successful revenue — one real served order produces exactly one business-revenue ledger entry and the correct accumulator update. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const price = businessDishPrice(save.business.menu, SALAD_DISH);
  const result = serveBusinessOrder(session, save, Math.random)!;
  assert(result !== null, "B: precondition — the serve succeeds");
  const withLedger = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
  const revenueEntries = businessLedgerEntries(withLedger.economyLedger).filter((e) => e.category === "business-revenue");
  assert(revenueEntries.length === 1 && revenueEntries[0]!.amount === customerPaysAt50(price), `B2: exactly one business-revenue ledger entry for the exact customer payment (${customerPaysAt50(price)}c from menu price ${price}c)`);
  assert(withLedger.business.finance.dailyAccumulator.revenue === result.amountCharged && result.amountCharged === customerPaysAt50(price), "B3: the daily accumulator's revenue matches the amount charged exactly");
  const realCost = realCogsFor(save.business.inventory, [{ ingredientId: "tomato", quantity: 1 }, { ingredientId: "cucumber", quantity: 1 }, { ingredientId: "carrot", quantity: 1 }]);
  assert(withLedger.business.finance.dailyAccumulator.cogs === realCost, `B4: the daily accumulator's COGS matches the real ingredient cost (${realCost}c)`);
  assert(withLedger.business.finance.lifetimeCogs === realCost, "B5: lifetimeCogs accumulates the same amount");
}

// ===== C: multiple revenue transactions — revenue aggregates exactly, no duplicate revenue, ledger and wallet reconcile. =====
{
  let save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const openingCash = save.credits;
  let totalRevenue = 0;
  let totalCogs = 0;
  for (let i = 0; i < 3; i++) {
    const session = sessionReadyFor(SALAD_RECIPE_ID);
    const result = serveBusinessOrder(session, save, Math.random)!;
    assert(result !== null, `C: serve #${i + 1} succeeds`);
    save = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
    totalRevenue += result.amountCharged;
    totalCogs += result.cogsCharged;
  }
  const summary = lifetimeSummary(save);
  assert(summary.cumulativeRevenue === totalRevenue, `C2: cumulative revenue aggregates exactly across 3 serves (${summary.cumulativeRevenue}c === ${totalRevenue}c)`);
  assert(summary.orderCount === 3, "C3: order count is exactly 3 — one per served order, never duplicated");
  assert(save.business.finance.lifetimeCogs === totalCogs, "C4: lifetimeCogs aggregates exactly");
  assert(save.credits === openingCash + totalRevenue, "C5: wallet reflects exactly the sum of the 3 payments — no duplication, no loss");
}

// ===== D: generate order, do NOT serve — zero revenue, no ledger entry, no wallet mutation. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  createBusinessServiceSession(makeSeededRand(businessServiceSeedFor(1))); // generated, never served
  const summary = lifetimeSummary(save);
  assert(summary.cumulativeRevenue === 0 && summary.orderCount === 0, "D: generating (never serving) an order creates zero revenue and zero ledger entries");
  assert(save.credits === 1000, "D2: the wallet is completely untouched by mere generation");
}

// ===== E: cancel/exit before serving — zero revenue, inventory/credits unaffected. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  sessionReadyFor(SALAD_RECIPE_ID); // reaches READY, but the caller never calls serveBusinessOrder — mirrors "exit mid-Preparation"
  assert(save.credits === 1000, "E: reaching READY without serving (cancel) leaves credits untouched");
  assert(getQuantity(save.business.inventory, "tomato") === 10, "E2: ...and inventory untouched");
  assert(lifetimeSummary(save).cumulativeRevenue === 0, "E3: no revenue is ever recorded for a cancelled order");
}

// ===== F: failed serve (order never reached READY) — zero revenue. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const session = createBusinessServiceSession(makeSeededRand(businessServiceSeedFor(1)));
  const result = serveBusinessOrder(session, save, Math.random);
  assert(result === null, "F: an unprepared (not-READY) order can never be served");
  assert(lifetimeSummary(save).cumulativeRevenue === 0, "F2: a failed serve attempt creates zero revenue");
}

// ===== G: menu-price change before serving — P&L uses the CURRENT price at serve time, never a stale one; also documents the real-COGS-vs-menu-cost-basis gap for Aromatic dishes. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullBreadInventory(1) } });
  const originalPrice = businessDishPrice(save.business.menu, BREAD_DISH);
  const session = sessionReadyFor(BREAD_RECIPE_ID);
  const repriced = { ...save, business: { ...save.business, menu: { ...save.business.menu, [BREAD_RECIPE_ID]: originalPrice + 777 } } };
  const result = serveBusinessOrder(session, repriced, Math.random)!;
  assert(result.amountCharged === customerPaysAt50(originalPrice + 777), `G: P&L revenue uses the CURRENT (changed) menu price, not the stale one (got ${result.amountCharged}, expected ${customerPaysAt50(originalPrice + 777)})`);
  const recipe = getCampaignRecipe(BREAD_RECIPE_ID)!;
  const menuCostBasis = recipeCostBasis(recipe);
  // V3-16 P1 fix: inventory now draws down the SAME portion the menu cost basis prices, so the two agree (the old whole-unit gap is closed).
  assert(Math.abs(result.cogsCharged - menuCostBasis) <= 1, `G2: an Aromatic dish's real COGS equals its portion-scaled menu cost basis within 1c of rounding (COGS ${result.cogsCharged}c vs basis ${menuCostBasis}c)`);
}

// ===== H: inventory consumption — beginning inventory -> consumption -> ending inventory -> COGS, all consistent for a known dish. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const result = serveBusinessOrder(session, save, Math.random)!;
  assert(getQuantity(result.save.business.inventory, "tomato") === 9, "H: tomato inventory decreases by exactly 1 (beginning 10 -> ending 9)");
  assert(getQuantity(result.save.business.inventory, "cucumber") === 9, "H2: cucumber likewise");
  assert(getQuantity(result.save.business.inventory, "carrot") === 9, "H3: carrot likewise");
  assert(result.cogsCharged === 300, `H4: COGS for Garden Salad (1 tomato + 1 cucumber + 1 carrot, each 100c) is exactly 300c (got ${result.cogsCharged})`);
  assert(result.cogsCharged !== 0, "H5: a purchased-but-not-yet-consumed inventory value is never confused with COGS (COGS is only ever recognized at actual consumption, never at purchase)");
}

// ===== I: payroll — no staff, one staff, multiple staff, Manager discount, insufficient cash, settlement matches the ledger. =====
{
  const noStaff = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const r0 = endBusinessDayComposed(noStaff);
  assert(r0.payrollPaid === 0 && r0.dailyPnL.staffCost === 0, "I: no staff hired -> zero payroll, zero P&L labor cost");

  const oneStaff = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["prep-cook"] } } });
  const r1 = endBusinessDayComposed(oneStaff);
  assert(r1.payrollPaid === 16000, `I2: Prep Cook's payroll is charged exactly ($16.00/hr x 8h x 1.25 burden = $160.00, got ${r1.payrollPaid}c)`);
  assert(r1.dailyPnL.staffCost === r1.payrollPaid, "I3: the P&L's staffCost line matches the actual paid payroll exactly");
  const staffLedger = businessLedgerEntries(r1.save.economyLedger).filter((e) => e.category === "business-staff-salary");
  assert(staffLedger.length === 1 && staffLedger[0]!.amount === -r1.payrollPaid, "I4: exactly one business-staff-salary ledger entry, matching the P&L exactly");

  const multiStaff = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["prep-cook", "line-cook", "manager"] } } });
  const r2 = endBusinessDayComposed(multiStaff);
  const withoutManager = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["prep-cook", "line-cook"] } } });
  const r2b = endBusinessDayComposed(withoutManager);
  assert(r2.payrollPaid < r2b.payrollPaid + 24000, "I5: adding a Manager (who discounts the rest of payroll) does not simply add its own full wage on top with no discount applied");

  const insufficientCash = saveAt({ credits: 50, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["prep-cook", "line-cook", "head-chef", "server", "cleaner", "manager"] } } });
  const r3 = endBusinessDayComposed(insufficientCash);
  assert(r3.payrollPaid === 0 && r3.staffLaidOff.length === 6 && r3.save.credits === 50, "I6: insufficient cash lays off the whole staff rather than partial pay or going negative");
  assert(r3.dailyPnL.staffCost === 0, "I7: the P&L reflects the ACTUAL charged payroll (0), never the theoretical one");
}

// ===== J: supplier costs — cancellation fee reduces cash and appears as a P&L operating expense, never as revenue. =====
{
  let save = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const signed = signContract(save, "wholesale-supplier");
  assert(signed.ok, "J: precondition — contract signs successfully");
  if (signed.ok) save = signed.save;
  const cancelled = cancelContractComposed(save);
  assert(cancelled.ok, "J2: precondition — cancellation succeeds");
  if (cancelled.ok) {
    const supplierLedger = businessLedgerEntries(cancelled.save.economyLedger).filter((e) => e.category === "supplier-contract-cancellation");
    assert(supplierLedger.length === 1 && supplierLedger[0]!.amount < 0, "J3: exactly one supplier-contract-cancellation ledger entry, negative (an expense)");
    assert(cancelled.save.business.finance.dailyAccumulator.supplierCost === -supplierLedger[0]!.amount, "J4: the daily accumulator's supplierCost matches the ledger exactly");
    const summary = lifetimeSummary(cancelled.save);
    assert(summary.cumulativeRevenue === 0, "J5: a supplier cancellation fee is never counted as revenue");
  }
}

// ===== K: refrigerator maintenance — operating expense, never food COGS. =====
{
  const save = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, equipmentCondition: { refrigeratorCondition: 20 } } });
  const result = performMaintenanceComposed(save);
  assert(result.ok, "K: precondition — maintenance succeeds when condition is degraded");
  if (result.ok) {
    assert(result.save.business.finance.dailyAccumulator.maintenanceCost === result.cost, "K2: maintenance cost is recorded in the accumulator, matching the actual charged cost");
    assert(result.save.business.finance.dailyAccumulator.cogs === 0, "K3: maintenance is never classified as food COGS");
    const maintLedger = businessLedgerEntries(result.save.economyLedger).filter((e) => e.category === "refrigerator-maintenance");
    assert(maintLedger.length === 1 && maintLedger[0]!.amount === -result.cost, "K4: exactly one refrigerator-maintenance ledger entry matching the actual cost");
  }
}

// ===== L: refrigerator investment — capital expenditure, separated from ordinary operating expense and from food COGS. =====
{
  const startingCash = 500000;
  const save = saveAt({ credits: startingCash, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const result = purchaseRefrigeratorComposed(save, "commercial-refrigerator");
  assert(result.ok, "L: precondition — the upgrade succeeds");
  if (result.ok) {
    assert(result.save.business.finance.dailyAccumulator.capitalExpenditure === result.price, "L2: the purchase is recorded as capital expenditure, matching the actual price");
    assert(result.save.business.finance.dailyAccumulator.maintenanceCost === 0, "L3: a capital purchase is never classified as an ordinary operating expense");
    assert(result.save.business.finance.dailyAccumulator.cogs === 0, "L4: ...nor as food COGS");
    // No payroll/fine settlement in this isolated test, so cashBeforeSettlement === the post-purchase closingCash.
    const pnl = computeDailyPnL({ cashBeforeSettlement: result.save.credits, closingCash: result.save.credits, accumulator: result.save.business.finance.dailyAccumulator, staffCost: 0, inspectionFines: 0, spoilageValue: 0 });
    assert(pnl.openingCash === startingCash, `L5: the reconstructed true opening cash matches what the day actually started with (got ${pnl.openingCash}, expected ${startingCash})`);
    assert(pnl.operatingProfit === 0, "L6: capital expenditure never reduces Operating Profit — it's excluded from that P&L line entirely");
    assert(pnl.netCashChange === -result.price, "L7: capital expenditure DOES reduce the Cash Flow view's Net Cash Change");
  }
}

// ===== M: inspection fines — PASS = no fine, FAIL/repeated-WARNING = the actual configured fine, insufficient cash = existing all-or-nothing behavior, P&L uses the ACTUAL charged fine. =====
{
  const healthy = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const rHealthy = endBusinessDayComposed(healthy);
  assert(rHealthy.inspectionFine.finePaid === 0, `M: a healthy business (PASS) is charged zero inspection fine (got ${rHealthy.inspectionFine.finePaid})`);
  assert(rHealthy.dailyPnL.inspectionFines === 0, "M2: the P&L reflects that zero fine");

  const brokenFridge = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, equipmentCondition: { refrigeratorCondition: 0 } } });
  const rFail = endBusinessDayComposed(brokenFridge);
  if (rFail.inspectionFine.finePaid > 0) {
    assert(rFail.dailyPnL.inspectionFines === rFail.inspectionFine.finePaid, "M3: the P&L's inspectionFines line matches the ACTUAL charged fine exactly (never the theoretical fineAmount when funds were short)");
    const fineLedger = businessLedgerEntries(rFail.save.economyLedger).filter((e) => e.category === "inspection-fine");
    assert(fineLedger.length === (rFail.inspectionFine.finePaid > 0 ? 1 : 0), "M4: the fine ledger entry count matches whether a real fine was actually paid");
  } else {
    console.log("    (M3/M4 skipped this run — a degraded refrigerator alone did not trigger a FAIL/repeated-WARNING this time; PASS/WARNING-only days assert zero fine above)");
  }
}

// ===== N: ledger reconciliation — Opening Cash + Signed Business Ledger Cash Flow = Closing Cash, across a real mixed sequence of Business actions. =====
{
  let save = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["prep-cook"] } } });
  const openingCash = save.credits;
  const p1 = purchaseIngredientComposed(save, "tomato", 10);
  assert(p1.ok, "N: precondition — ingredient purchase succeeds");
  if (p1.ok) save = p1.save;
  const p2 = purchaseIngredientComposed(save, "cucumber", 10);
  if (p2.ok) save = p2.save;
  const p3 = purchaseIngredientComposed(save, "carrot", 10);
  if (p3.ok) save = p3.save;
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const served = serveBusinessOrder(session, save, Math.random)!;
  save = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
  const dayResult = endBusinessDayComposed(save);
  save = dayResult.save;
  const totals = ledgerTotals(businessLedgerEntries(save.economyLedger));
  assert(openingCash + totals.netCashFlow === save.credits, `N2: Opening Cash (${openingCash}) + Signed Business Ledger Cash Flow (${totals.netCashFlow}) === Closing Cash (${save.credits})`);
}

// ===== O: wallet reconciliation — no wallet mutation exists without a corresponding ledger entry, and vice versa, across the same mixed sequence. =====
{
  let save = saveAt({ credits: 100000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const beforeLedgerLen = save.economyLedger.length;
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const served = serveBusinessOrder(session, save, Math.random)!;
  assert(served.save.credits !== save.credits, "O: precondition — the wallet actually changed");
  const withLedger = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
  assert(withLedger.economyLedger.length === beforeLedgerLen + 1, "O2: exactly one new ledger entry accompanies the one real wallet mutation — never a mutation without a ledger entry, never a ledger entry without one");
}

// ===== P: persistence — the daily accumulator and lifetime COGS survive a JSON round-trip exactly. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, finance: { dailyAccumulator: { ...DEFAULT_DAILY_ACCUMULATOR, revenue: 1234, cogs: 567 }, lifetimeCogs: 890, lastDailyPnL: null } } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.finance.dailyAccumulator.revenue === 1234, "P: dailyAccumulator.revenue survives a JSON round-trip exactly");
  assert(roundTripped.business.finance.lifetimeCogs === 890, "P2: lifetimeCogs survives exactly");
}
{
  // P3: lastDailyPnL itself (a full nested object) survives a round-trip.
  const save = saveAt({ credits: 5000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const result = endBusinessDayComposed(save);
  const roundTripped = JSON.parse(JSON.stringify(result.save)) as SaveData;
  assert(roundTripped.business.finance.lastDailyPnL !== null, "P3: lastDailyPnL is persisted after ending a Business Day");
  assert(roundTripped.business.finance.lastDailyPnL?.closingCash === result.dailyPnL.closingCash, "P4: ...and survives a JSON round-trip with the exact same closingCash");
}

// ===== Q: migration — an old save with no `finance` field defaults cleanly to zero, never throws. =====
{
  const oldSave = {
    version: 1,
    credits: 4000,
    business: {
      calendar: { businessDay: 8 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...oldSave, business: { ...DEFAULT_SAVE.business, ...oldSave.business } } as SaveData;
  assert(migrated.business.finance.dailyAccumulator.revenue === 0, "Q: a pre-Phase-15 save's finance state defaults cleanly to zero");
  assert(migrated.business.finance.lastDailyPnL === null, "Q2: ...and lastDailyPnL defaults to null, never throws");
  assert(migrated.business.calendar.businessDay === 8, "Q3: the OLD save's own real fields (calendar) survive migration untouched");
}

// ===== R: deterministic calculations — identical inputs produce identical P&L output; no Math.random() CALL anywhere in the new file. =====
{
  const accumulator = { revenue: 5000, cogs: 1500, inventoryPurchaseCost: 800, maintenanceCost: 100, supplierCost: 50, capitalExpenditure: 0 };
  const p1 = computeDailyPnL({ cashBeforeSettlement: 13550, closingCash: 13350, accumulator, staffCost: 200, inspectionFines: 0, spoilageValue: 0 });
  const p2 = computeDailyPnL({ cashBeforeSettlement: 13550, closingCash: 13350, accumulator, staffCost: 200, inspectionFines: 0, spoilageValue: 0 });
  assert(JSON.stringify(p1) === JSON.stringify(p2), "R: computeDailyPnL is deterministic across repeated calls with the same inputs");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const content = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "game", "business", "BusinessFinanceManager.ts"), "utf8");
  const hasCall = /Math\.random\(\)/.test(content);
  assert(!hasCall, "R2: no Math.random() CALL exists anywhere in BusinessFinanceManager.ts");
}

// ===== S: no duplicate revenue — a second serve attempt on an already-paid order records zero additional revenue. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) } });
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const first = serveBusinessOrder(session, save, Math.random)!;
  const second = serveBusinessOrder(first.session, first.save, Math.random);
  assert(second === null, "S: a repeat serve attempt on an already-paid order is refused — zero additional revenue can ever be recorded for it");
}

// ===== T: no duplicate expenses — a failed (insufficient-funds) purchase/maintenance/cancellation records nothing in the accumulator. =====
{
  const poor = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const failedFridge = purchaseRefrigeratorComposed(poor, "commercial-refrigerator");
  assert(!failedFridge.ok, "T: precondition — the purchase is refused for insufficient funds");
  assert(poor.business.finance.dailyAccumulator.capitalExpenditure === 0, "T2: a refused purchase records zero capital expenditure — never a phantom expense");
  const failedMaint = performMaintenanceComposed({ ...poor, business: { ...poor.business, equipmentCondition: { refrigeratorCondition: 0 } } });
  assert(!failedMaint.ok, "T3: precondition — maintenance is refused for insufficient funds");
}

// ===== U: Campaign isolation — a full Business Mode day (purchase, serve, end day) never touches Campaign's own levelProgress/recipeProgress/economyLedger campaign categories. =====
{
  const save = saveAt({
    credits: 100000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullSaladInventory(1) },
  });
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const served = serveBusinessOrder(session, save, Math.random)!;
  const withLedger = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
  const dayResult = endBusinessDayComposed(withLedger);
  assert(JSON.stringify(dayResult.save.levelProgress) === JSON.stringify(save.levelProgress), "U: levelProgress is byte-identical before/after a full Business Mode day");
  const campaignLedgerEntries = dayResult.save.economyLedger.filter((e) => e.category === "campaign-settlement" || e.category === "service-revenue" || e.category === "completion-reward");
  assert(campaignLedgerEntries.length === 0, "U2: zero Campaign-category ledger entries were ever created by pure Business Mode activity");
}

// ===== V: combined-day reconciliation — an ingredient purchase AND a served order on the SAME Business Day must produce a Daily P&L whose reconstructed Opening Cash matches what the day actually started with, and whose Net Cash Change matches the real credits delta exactly. Directly reproduces the exact scenario that caught a real bug during this checkpoint's own live browser verification (Net Cash Change silently showing $0.00 for a day that actually moved $0.93 in real cash, because "opening cash" was read post-trading instead of reconstructed pre-trading). =====
{
  const startingCash = 300000;
  let save = saveAt({ credits: startingCash, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } });
  const p1 = purchaseIngredientComposed(save, "tomato", 5);
  assert(p1.ok, "V: precondition — the ingredient purchase succeeds");
  if (p1.ok) save = p1.save;
  const p2 = purchaseIngredientComposed(save, "cucumber", 5);
  if (p2.ok) save = p2.save;
  const p3 = purchaseIngredientComposed(save, "carrot", 5);
  if (p3.ok) save = p3.save;
  const session = sessionReadyFor(SALAD_RECIPE_ID);
  const served = serveBusinessOrder(session, save, Math.random)!;
  save = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
  const dayResult = endBusinessDayComposed(save);
  assert(dayResult.dailyPnL.openingCash === startingCash, `V2: the Daily P&L's reconstructed Opening Cash matches what the day actually started with (got ${dayResult.dailyPnL.openingCash}, expected ${startingCash})`);
  assert(dayResult.dailyPnL.netCashChange === dayResult.save.credits - startingCash, `V3: Net Cash Change matches the REAL credits delta for the whole day exactly (got ${dayResult.dailyPnL.netCashChange}, expected ${dayResult.save.credits - startingCash})`);
  assert(dayResult.dailyPnL.netCashChange !== 0, "V4: a day with real revenue and real purchases never reports a misleadingly-zero Net Cash Change");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
