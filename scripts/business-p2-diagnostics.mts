/**
 * BUSINESS_P2_DIAGNOSTICS — V3-16 P2 remediation, Phase A/D/E/F evidence.
 * NOT a pass/fail QA suite: a deterministic 365-day analysis driven by the
 * REAL Business managers (same loop and App.tsx ledger compositions as
 * business-final-audit-qa.mts), reporting:
 *   - inspection-fine analytics per profile (frequency, severity split,
 *     repeated-WARNING vs FAIL, the categories behind every fined day,
 *     fines as % of revenue / operating profit);
 *   - refrigerator-wear models, compared as SIM-ONLY overrides (the game's
 *     rule is untouched): current (per purchase, 1..3 points) vs
 *     per-unit carry (1 point per 10 units stocked) vs per-serve carry
 *     (1 point per 10 orders served);
 *   - purchase lot sizes (1 vs 5) under the current rules;
 *   - menu breadth (all 35 dishes vs a curated 6-dish menu).
 *
 * Run: npx tsx scripts/business-p2-diagnostics.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { normalizeQuantity } from "../src/game/business/businessInventory.ts";
import { BUSINESS_DISH_CATALOG, getBusinessDish } from "../src/game/business/businessDishCatalog.ts";
import { businessDishRequirements, businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { recordInventoryPurchase, recordMaintenanceCost } from "../src/game/business/BusinessFinanceManager.ts";
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
import type { IngredientId } from "../src/game/definitions.ts";

const FOCUS_MENU = ["biz-garden-salad", "biz-tomato-lettuce-salad", "biz-kachumber-salad", "biz-chicken-broccoli", "biz-garlic-chicken", "biz-greek-lemon-chicken"];
type Wear = "current" | "perUnit" | "perServe";
type P = { name: string; ordersPerDay: number; lot: number; hires: string[]; menu?: string[]; wear: Wear };

function needTotals(dishId: string) {
  const totals = new Map<IngredientId, number>();
  for (const r of businessDishRequirements(getBusinessDish(dishId)!)) totals.set(r.ingredientId, normalizeQuantity((totals.get(r.ingredientId) ?? 0) + r.quantity));
  return totals;
}

function run(p: P, days = 365) {
  let save: SaveData = { ...DEFAULT_SAVE, credits: 300_000, economyLedger: [], business: { ...DEFAULT_BUSINESS_STATE } };
  if (p.menu) for (const d of BUSINESS_DISH_CATALOG) if (!p.menu.includes(d.id)) { const r = setDishActive(save, d.id, false); if (r.ok) save = r.save; }
  for (const role of p.hires) { const r = hireStaff(save, role); if (r.ok) save = r.save; }
  const agg = { revenue: 0, cogs: 0, staff: 0, maint: 0, fines: 0, opProfit: 0, orders: 0, repairs: 0, purchases: 0, purchaseTx: 0, spoil: 0, fineDays: 0, small: 0, large: 0, warnDays: 0, failDays: 0, firstBroke: null as number | null, finedCats: {} as Record<string, number>, revenueDays: 0 };
  let carry = 0;
  const wear = (points: number) => { save = { ...save, business: { ...save.business, equipmentCondition: { refrigeratorCondition: Math.max(0, save.business.equipmentCondition.refrigeratorCondition - points) } } }; };
  for (let d = 1; d <= days; d++) {
    const day = save.business.calendar.businessDay;
    if (maintenanceStatusFor(save.business.equipmentCondition.refrigeratorCondition) !== "OPERATIONAL") {
      const r = performRefrigeratorMaintenance(save);
      if (r.ok) { save = recordMaintenanceCost(appendLedgerEntry(r.save, "refrigerator-maintenance", -r.cost), r.cost); agg.repairs++; }
    }
    const rand = makeSeededRand(businessServiceSeedFor(day));
    let session = createBusinessServiceSession(rand, save.business.menuActivation);
    let served = 0;
    while (served < p.ordersPerDay && session.current) {
      const dish = businessDishForRecipeId(session.current.recipe.id)!;
      if (!businessOrderAvailability(save, dish).available) {
        const cap = maxPurchaseQuantityFor(eventForDay(day));
        for (const [id, need] of needTotals(dish.id)) {
          const have = usableQuantity(save.business.inventory, id, day);
          if (have >= need) continue;
          let qty = Math.max(p.lot, Math.ceil(need - have));
          if (cap !== undefined) qty = Math.min(qty, cap);
          qty = Math.min(qty, Math.floor(getAvailableStorageCapacity(save.business.inventory, save.business.refrigerator.refrigeratorId)));
          if (qty <= 0) continue;
          const before = save.business.equipmentCondition.refrigeratorCondition;
          const r = purchaseIngredient(save, id, qty);
          if (!r.ok) continue;
          save = recordInventoryPurchase(appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id), r.totalCost);
          agg.purchaseTx++;
          if (p.wear !== "current") {
            save = { ...save, business: { ...save.business, equipmentCondition: { refrigeratorCondition: before } } };
            if (p.wear === "perUnit") { carry += qty; wear(Math.floor(carry / 10)); carry %= 10; }
          }
        }
        if (!businessOrderAvailability(save, dish).available) break;
      }
      const result = serveBusinessOrder(recordBusinessServiceComponents(session, 80), save, rand);
      if (!result) break;
      save = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
      served++;
      if (p.wear === "perServe") { carry += 1; wear(Math.floor(carry / 10)); carry %= 10; }
      session = advanceBusinessServiceSession(result.session, rand, save.business.menuActivation);
    }
    const end = endBusinessDay(save);
    save = appendLedgerEntry(appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid), "inspection-fine", -end.inspectionFine.finePaid);
    const pnl = end.dailyPnL;
    agg.revenue += pnl.revenue; agg.cogs += pnl.cogs; agg.staff += pnl.staffCost; agg.maint += pnl.maintenanceCost; agg.fines += pnl.inspectionFines;
    agg.opProfit += pnl.operatingProfit; agg.orders += served; agg.purchases += pnl.inventoryPurchaseCost; agg.spoil += pnl.spoilageValue;
    if (pnl.revenue > 0) agg.revenueDays++;
    if (end.inspectionReport.overall === "WARNING") agg.warnDays++;
    if (end.inspectionReport.overall === "FAIL") agg.failDays++;
    if (end.inspectionFine.finePaid > 0) {
      agg.fineDays++;
      if (end.inspectionFine.severity === "SMALL") agg.small++; else agg.large++;
      for (const c of end.inspectionReport.categories) if (c.result !== "PASS") agg.finedCats[c.category] = (agg.finedCats[c.category] ?? 0) + 1;
    }
    if (agg.firstBroke === null && save.credits < 5_000) agg.firstBroke = d;
  }
  return { ...agg, endCash: save.credits };
}

const usd = (c: number) => `${c < 0 ? "-" : ""}$${Math.round(Math.abs(c) / 100).toLocaleString("en-US")}`;
const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${((a / b) * 100).toFixed(0)}%`);
function table(title: string, profiles: P[]) {
  console.log(`\n=== ${title} ===`);
  console.log("profile".padEnd(34) + "revenue   orders  COGS     labor   maint(repairs)  fines   opProfit  endCash  purchTx  spoil  broke<$50");
  const out = profiles.map((p) => ({ p, r: run(p) }));
  for (const { p, r } of out) console.log(`${p.name.padEnd(34)}${usd(r.revenue).padStart(8)} ${String(r.orders).padStart(7)} ${usd(r.cogs).padStart(8)} ${usd(r.staff).padStart(7)} ${usd(r.maint).padStart(7)}(${String(r.repairs).padStart(3)})  ${usd(r.fines).padStart(8)} ${usd(r.opProfit).padStart(9)} ${usd(r.endCash).padStart(8)} ${String(r.purchaseTx).padStart(7)} ${usd(r.spoil).padStart(6)}  ${r.firstBroke ?? "never"}`);
  return out;
}

const base = (name: string, over: Partial<P> = {}): P => ({ name, ordersPerDay: 8, lot: 5, hires: [], wear: "current", ...over });

// Phase E + F: fines and menu breadth, current rules.
const current = table("CURRENT RULES — menu breadth, lot size, cleaner", [
  base("Normal, all 35 on"),
  base("Normal, 6-dish menu", { menu: FOCUS_MENU }),
  base("Normal, 6-dish, lot 1", { menu: FOCUS_MENU, lot: 1 }),
  base("Normal, all 35, lot 1", { lot: 1 }),
  base("Normal, 6-dish, Cleaner", { menu: FOCUS_MENU, hires: ["cleaner"] }),
  base("High volume 16/day, 6-dish", { menu: FOCUS_MENU, ordersPerDay: 16 }),
  base("High volume 16/day, 6-dish, lot 1", { menu: FOCUS_MENU, ordersPerDay: 16, lot: 1 }),
]);
console.log("\n=== INSPECTION FINE ANALYTICS (current rules) ===");
for (const { p, r } of current) {
  const avgDailyRev = r.revenue / 365;
  console.log(`${p.name.padEnd(34)} avg daily revenue ${usd(avgDailyRev)} | fined days ${r.fineDays}/365 (repeated-WARNING $275 x${r.small}, FAIL $525 x${r.large}) | WARNING days ${r.warnDays}, FAIL days ${r.failDays} | avg fine ${r.fineDays ? usd(r.fines / r.fineDays) : "$0"} | fines = ${pct(r.fines, r.revenue)} of revenue, ${pct(r.fines, r.revenue - r.cogs)} of gross profit | fined-day causes ${JSON.stringify(r.finedCats)}`);
}

// Phase D: wear models (SIM-ONLY overrides — the game's rule is untouched).
table("REFRIGERATOR WEAR MODELS (sim-only comparison)", [
  base("current (per purchase), lot 5", { menu: FOCUS_MENU }),
  base("per-unit carry, lot 5", { menu: FOCUS_MENU, wear: "perUnit" }),
  base("per-serve carry, lot 5", { menu: FOCUS_MENU, wear: "perServe" }),
  base("current (per purchase), lot 1", { menu: FOCUS_MENU, lot: 1 }),
  base("per-unit carry, lot 1", { menu: FOCUS_MENU, lot: 1, wear: "perUnit" }),
  base("per-serve carry, lot 1", { menu: FOCUS_MENU, lot: 1, wear: "perServe" }),
]);

// Phase F: menu breadth under each purchasing/wear combination (sim-only for the wear override).
table("MENU BREADTH x PURCHASING x WEAR", [
  base("all 35 on, lot 5, current wear"),
  base("all 35 on, lot 1, current wear", { lot: 1 }),
  base("all 35 on, lot 1, per-unit wear", { lot: 1, wear: "perUnit" }),
  base("all 35 on, lot 5, per-unit wear", { wear: "perUnit" }),
  base("6-dish, lot 1, per-unit wear", { menu: FOCUS_MENU, lot: 1, wear: "perUnit" }),
  base("6-dish, lot 5, per-unit wear", { menu: FOCUS_MENU, wear: "perUnit" }),
]);
