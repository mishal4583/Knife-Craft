/**
 * BUSINESS_LIFETIME_QA — Economy V3 Phase 16 final remediation (P1):
 * Business lifetime Finance totals are true running totals, independent
 * of the shared 200-entry EconomyLedger window. Every scenario drives the
 * REAL managers with the SAME wrapper compositions App.tsx uses (pure
 * manager -> ledger append -> finance record), never a shortcut.
 *
 * Run: npx tsx scripts/business-lifetime-qa.mts
 */
// Minimal localStorage shim so section M can exercise the REAL SaveManager.load().
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import {
  createBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessCustomersToday,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import { getBusinessDish, businessDishPrice } from "../src/game/business/businessDishCatalog.ts";
import { appendLedgerEntry, MAX_LEDGER_ENTRIES } from "../src/game/economy/EconomyLedger.ts";
import {
  lifetimeSummary,
  businessLedgerEntries,
  migrateBusinessFinanceState,
  computeDailyPnL,
  recordInventoryPurchase,
  recordCapitalExpenditure,
  recordMaintenanceCost,
  recordSupplierCost,
  DEFAULT_LIFETIME_TOTALS,
} from "../src/game/business/BusinessFinanceManager.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { purchaseRefrigerator } from "../src/game/business/RefrigeratorManager.ts";
import { performRefrigeratorMaintenance } from "../src/game/business/businessMaintenance.ts";
import { signContract, cancelContract } from "../src/game/business/BusinessSupplierManager.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import type { ServiceSession } from "../src/game/service/ServiceManager.ts";

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

// ---- App.tsx wrapper compositions (verbatim shape) ----
const serveComposed = (session: ServiceSession, save: SaveData) => {
  const r = serveBusinessOrder(session, save, makeSeededRand(7));
  if (!r) return null;
  return { ...r, save: appendLedgerEntry(r.save, "business-revenue", r.amountCharged, r.dish.id) };
};
const endDayComposed = (save: SaveData) => {
  const r = endBusinessDay(save);
  return { ...r, save: appendLedgerEntry(appendLedgerEntry(r.save, "business-staff-salary", -r.payrollPaid), "inspection-fine", -r.inspectionFine.finePaid) };
};
/** Cash reconciliation that survives the 200-entry FIFO window: diff ledger entries by id. */
function reconcile(before: SaveData, after: SaveData): boolean {
  const ids = new Set(before.economyLedger.map((e) => e.id));
  const delta = after.economyLedger.filter((e) => !ids.has(e.id)).reduce((s, e) => s + e.amount, 0);
  return before.credits + delta === after.credits;
}

const SALAD = getBusinessDish("biz-garden-salad")!;
function readySaladSession(): ServiceSession {
  for (let seed = 1; seed < 400; seed++) {
    const s = createBusinessServiceSession(makeSeededRand(seed));
    if (s.current?.recipe.id === SALAD.sourceRecipeId) return recordBusinessServiceComponents(s, 80);
  }
  throw new Error("no salad seed");
}
function stockedSave(credits = 5_000_000): SaveData {
  let inv = addStock({}, "tomato", 1000, 100, 1);
  inv = addStock(inv, "cucumber", 1000, 100, 1);
  inv = addStock(inv, "carrot", 1000, 100, 1);
  return { ...DEFAULT_SAVE, credits, economyLedger: [], business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: inv } };
}

// ===== A/B/C/D/H/L: 250 serves interleaved with 250 Campaign ledger entries — far past the 200-entry window. =====
// Order frequency (Economy V3 Phase 16): a Business Day brings a limited number of customers, so the 250
// serves span real Business Days, each closed with the real End Business Day (+ its payroll/fine ledger
// entries, as App.tsx does). Each new day gets fresh fixture stock for just that day's customers (the
// same fixture addStock as before — never a purchase), so stock neither spoils nor overfills the fridge.
// Revenue is what customers actually paid (WTP follows the day's popularity), summed per serve.
{
  const dayStock = (save: SaveData, n: number): SaveData => {
    const day = save.business.calendar.businessDay;
    let inv = save.business.inventory;
    for (const id of ["tomato", "cucumber", "carrot"] as const) inv = addStock(inv, id, n, 100, day);
    return { ...save, business: { ...save.business, inventory: inv } };
  };
  let save: SaveData = { ...stockedSave(), business: { ...stockedSave().business, inventory: {} } };
  save = dayStock(save, businessCustomersToday(save).target);
  const start = save;
  let revenue = 0;
  let closeCosts = 0;
  let days = 1;
  let reconciled = true;
  for (let i = 0; i < 250; i++) {
    if (businessCustomersToday(save).complete) {
      const before = save;
      const closed = endDayComposed(save);
      closeCosts += closed.payrollPaid + closed.inspectionFine.finePaid;
      save = dayStock(closed.save, businessCustomersToday(closed.save).target);
      days++;
      if (!reconcile(before, save)) reconciled = false;
    }
    const before = save;
    const r = serveComposed(readySaladSession(), save)!;
    revenue += r.amountCharged;
    save = r.save;
    // Campaign activity sharing the same ledger + wallet (as App.tsx's campaign settlement does).
    save = appendLedgerEntry({ ...save, credits: save.credits + 64 }, "campaign-settlement", 64, "level-1");
    if (!reconcile(before, save)) reconciled = false;
  }
  assert(days > 1 && save.economyLedger.length === MAX_LEDGER_ENTRIES, `A0: precondition — the 250 serves span ${days} real Business Days and the shared ledger is capped at ${MAX_LEDGER_ENTRIES} entries`);
  const windowRevenue = businessLedgerEntries(save.economyLedger).filter((e) => e.category === "business-revenue").reduce((s, e) => s + e.amount, 0);
  const life = lifetimeSummary(save);
  assert(life.cumulativeRevenue === revenue, `A: lifetime revenue survives the window — ${life.cumulativeRevenue}c === the ${revenue}c customers paid (the ledger window alone holds only ${windowRevenue}c)`);
  assert(windowRevenue < life.cumulativeRevenue, "A2: proof of the old bug — the ledger window under-reports lifetime revenue");
  assert(life.orderCount === 250, `B: lifetime order count survives the window (${life.orderCount}; the window holds only ${businessLedgerEntries(save.economyLedger).length} revenue entries)`);
  assert(life.cumulativeCogs === 250 * 300 && save.business.finance.lifetimeCogs === 250 * 300, "C: lifetime COGS = 250 x 300c (3 x $1.00 vegetables), unchanged model");
  assert(life.cumulativeGrossProfit === life.cumulativeRevenue - life.cumulativeCogs && life.cumulativeOperatingProfit === life.cumulativeGrossProfit - life.cumulativeLabor - life.cumulativeOperatingCosts, "D: gross profit = revenue - COGS and operating profit = GP - labor - opex, over the same time span");
  assert(life.cumulativeRevenue === revenue && save.business.finance.lifetime.revenue === revenue, "H: 250 Campaign settlements (+64c each, same ledger, same wallet) added nothing to Business lifetime totals");
  assert(reconciled && start.credits + revenue + 250 * 64 - closeCosts === save.credits, "L: every step reconciles (credits before + signed new ledger entries = credits after), and the wallet ends at start + Business revenue + Campaign income - day-close payroll/fines");
  assert(life.coverage === "complete", "D2: a save that tracked from the start reports complete coverage");
}

// ===== E/F/G/J/K: labor, operating costs, capital, End Business Day. =====
{
  let save: SaveData = { ...stockedSave(2_000_000), business: { ...stockedSave().business, inventory: {} } };
  const h = hireStaff(save, "cleaner");
  if (h.ok) save = h.save;
  // Inventory purchase (asset) + capital + maintenance + supplier cancellation fee.
  const p = purchaseIngredient(save, "tomato", 5);
  if (p.ok) save = recordInventoryPurchase(appendLedgerEntry(p.save, "inventory-purchase", -p.totalCost, "tomato"), p.totalCost);
  const nextFridge = REFRIGERATOR_CATALOG[1]!;
  const f = purchaseRefrigerator(save, nextFridge.id);
  if (f.ok) save = recordCapitalExpenditure(appendLedgerEntry(f.save, "refrigerator-purchase", -f.price, nextFridge.id), f.price);
  save = { ...save, business: { ...save.business, equipmentCondition: { refrigeratorCondition: 45 } } };
  const m = performRefrigeratorMaintenance(save);
  if (m.ok) save = recordMaintenanceCost(appendLedgerEntry(m.save, "refrigerator-maintenance", -m.cost), m.cost);
  const sc = signContract(save, "wholesale-supplier");
  if (sc.ok) save = sc.save;
  const cc = cancelContract(save);
  if (cc.ok) save = recordSupplierCost(appendLedgerEntry(cc.save, "supplier-contract-cancellation", -cc.fee), cc.fee);
  assert(p.ok && f.ok && m.ok && cc.ok && cc.fee > 0, "E0: precondition — purchase, refrigerator, repair and a fee-bearing cancellation all succeeded");

  // Force a FAIL so a real fine is charged at End Business Day.
  save = { ...save, business: { ...save.business, equipmentCondition: { refrigeratorCondition: 10 } } };
  const before = save;
  const day1 = endDayComposed(save);
  save = day1.save;
  assert(reconcile(before, save), "L2: End Business Day reconciles exactly (payroll + fine entries)");
  const day2 = endDayComposed(save);
  save = day2.save;
  const l = save.business.finance.lifetime;
  const life = lifetimeSummary(save);
  assert(day1.payrollPaid > 0 && l.staffCost === day1.payrollPaid + day2.payrollPaid, `E: lifetime labor === sum of real payroll over 2 days (${l.staffCost}c)`);
  assert(day1.inspectionFine.finePaid > 0 && l.inspectionFines === day1.inspectionFine.finePaid + day2.inspectionFine.finePaid, `F: lifetime inspection fines === fines actually paid (${l.inspectionFines}c)`);
  assert(l.maintenanceCost === m.cost && l.supplierCost === cc.fee && life.cumulativeOperatingCosts === m.cost + cc.fee + l.inspectionFines, "F2: lifetime operating costs = maintenance + supplier fee + fines, each counted once");
  assert(l.capitalExpenditure === f.price && life.cumulativeCapitalExpenditure === f.price, "G: capital expenditure is tracked on its own line");
  assert(life.cumulativeOperatingProfit === 0 - 0 - l.staffCost - life.cumulativeOperatingCosts, "G2: capital expenditure (and the inventory purchase) are NOT in operating profit");
  assert(l.inventoryPurchaseCost === p.totalCost && life.cumulativeCashExpenses === p.totalCost + f.price + l.staffCost + life.cumulativeOperatingCosts, "G3: all-cash-spent includes ingredients and capital; operating profit does not");
  // J: a preview (pure run) never counts; each close counts exactly its own day.
  const snapshot = JSON.stringify(save);
  endBusinessDay(save);
  endBusinessDay(save);
  assert(JSON.stringify(save) === snapshot, "J: running End Business Day as a PREVIEW twice changes nothing (lifetime totals untouched)");
  const day3 = endDayComposed(save);
  assert(day3.save.business.finance.lifetime.staffCost === l.staffCost + day3.payrollPaid, "J2: a real close adds exactly that day's payroll — never double-counted");
  // K: the daily P&L model itself is unchanged — it equals computeDailyPnL of the day's own inputs, and is what's persisted.
  const expected = computeDailyPnL({ cashBeforeSettlement: before.credits, closingCash: day1.dailyPnL.closingCash, accumulator: before.business.finance.dailyAccumulator, staffCost: day1.payrollPaid, inspectionFines: day1.inspectionFine.finePaid, spoilageValue: day1.spoiledValue });
  assert(JSON.stringify(expected) === JSON.stringify(day1.dailyPnL) && JSON.stringify(day1.save.business.finance.lastDailyPnL) === JSON.stringify(day1.dailyPnL), "K: daily P&L is exactly computeDailyPnL(the day's inputs), persisted unchanged as lastDailyPnL");
  assert(day1.dailyPnL.openingCash + day1.dailyPnL.netCashChange === day1.dailyPnL.closingCash, "K2: opening + net change = closing");
}

// ===== I: repeated / reloaded serves cannot double-count. =====
{
  let save = stockedSave();
  const r1 = serveComposed(readySaladSession(), save)!;
  save = r1.save;
  const again = serveComposed(r1.session, save);
  assert(again === null, "I: serving the same (already-paid) order again is refused");
  const reloaded = JSON.parse(JSON.stringify(save)) as SaveData;
  const migrated = { ...reloaded, business: { ...reloaded.business, finance: migrateBusinessFinanceState(reloaded.business.finance, reloaded.economyLedger) } };
  assert(JSON.stringify(migrated.business.finance) === JSON.stringify(save.business.finance), "I2: reloading a save that already has lifetime totals leaves them exactly as stored (no re-seeding, no double count)");
  assert(serveComposed(r1.session, migrated) === null && migrated.business.finance.lifetime.orderCount === 1, "I3: after reload the paid order still can't be served again; order count stays 1");
}

// ===== M: migration of existing saves. =====
{
  const price = customerPaysAt50(businessDishPrice({}, SALAD)); // what each customer paid
  // A pre-remediation save (V3-15 finance, no `lifetime`), ledger well under the cap.
  let s = stockedSave();
  for (let i = 0; i < 3; i++) s = serveComposed(readySaladSession(), s)!.save;
  s = appendLedgerEntry({ ...s, credits: s.credits - 500 }, "inventory-purchase", -500, "tomato");
  const { lifetime: _dropped, ...oldFinance } = s.business.finance;
  const oldJson = JSON.stringify({ ...s, business: { ...s.business, finance: oldFinance } });
  const m1 = migrateBusinessFinanceState(JSON.parse(oldJson).business.finance, JSON.parse(oldJson).economyLedger);
  assert(m1.lifetime.revenue === 3 * price && m1.lifetime.orderCount === 3 && m1.lifetime.inventoryPurchaseCost === 500 && m1.lifetime.coverage === "complete", "M: a pre-remediation save with an un-rolled ledger is seeded EXACTLY from it and marked complete");
  assert(m1.lifetimeCogs === 900 && JSON.stringify(m1.lastDailyPnL) === JSON.stringify(s.business.finance.lastDailyPnL), "M2: existing lifetime COGS and last-day P&L are kept intact");
  // At the cap: history may already be gone -> partial, never invented.
  const full = Array.from({ length: MAX_LEDGER_ENTRIES }, (_, i) => ({ id: `x${i}`, timestamp: i, category: (i % 2 ? "business-revenue" : "campaign-settlement") as "business-revenue", amount: 100 }));
  const m2 = migrateBusinessFinanceState(oldFinance, full);
  assert(m2.lifetime.coverage === "partial" && m2.lifetime.revenue === 100 * 100 && m2.lifetime.orderCount === 100, "M3: a save whose ledger is at the 200 cap seeds only what it still holds and is marked PARTIAL (no invented history)");
  // Pre-V3-15 save (no finance at all): revenue exists in the ledger but COGS was never recorded -> partial.
  const m3 = migrateBusinessFinanceState(undefined, JSON.parse(oldJson).economyLedger);
  assert(m3.lifetime.coverage === "partial" && m3.lifetimeCogs === 0 && m3.lifetime.revenue === 3 * price, "M4: a pre-V3-15 save (no finance state) is seeded from its ledger and marked PARTIAL, since those serves' COGS were never recorded");
  const m4 = migrateBusinessFinanceState(undefined, []);
  assert(JSON.stringify(m4.lifetime) === JSON.stringify(DEFAULT_LIFETIME_TOTALS), "M5: a save with no Business history loads with zero totals, marked complete (nothing is missing)");
  // The REAL SaveManager.load() path.
  localStorage.setItem("knifecraft.save.v1", oldJson);
  const loaded = await SaveManager.load();
  assert(loaded.business.finance.lifetime.revenue === 3 * price && loaded.business.finance.lifetime.coverage === "complete" && loaded.business.finance.lifetimeCogs === 900, "M6: SaveManager.load() migrates a real pre-remediation save through the same path");
  assert(Array.isArray(loaded.business.menuActivation.inactiveDishIds) && loaded.credits === s.credits, "M7: every other field (menu activation default, credits) loads unchanged");
}

console.log(failures === 0 ? "\nBUSINESS LIFETIME QA: ALL PASS" : `\nBUSINESS LIFETIME QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
