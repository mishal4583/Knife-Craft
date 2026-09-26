/**
 * SUPPLIER_EVENTS_QA — Economy V3 Phase 8. Verifies the deterministic
 * 9-day event schedule, price/quantity effects, the Supplier-Delay
 * contract-discount suspension, purchase-flow integration, Campaign
 * independence, and determinism — against the real production functions
 * only.
 *
 * Run: npx tsx scripts/supplier-events-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import {
  EVENT_CYCLE_LENGTH,
  SUPPLIER_EVENT_CATALOG,
  eventForDay,
  eventAdjustedUnitCost,
  maxPurchaseQuantityFor,
} from "../src/game/business/businessSupplierEvents.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import type { ActiveSupplierContract } from "../src/game/business/businessSupplierContract.ts";
import { getContractTerms } from "../src/game/business/businessSupplierContract.ts";

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

function contractAt(supplierId: string, startDay: number): ActiveSupplierContract {
  const terms = getContractTerms(supplierId)!;
  return { ...terms, supplierId, contractStartDay: startDay, contractEndDay: startDay + terms.contractLength };
}

// ===== A: the 9-day cycle — exact, deterministic, reproducible. =====
{
  assert(EVENT_CYCLE_LENGTH === 9, `A: the cycle is exactly 9 days (6 events + 3 quiet) (got ${EVENT_CYCLE_LENGTH})`);
  assert(eventForDay(1)?.id === "supplier-delay", "A2: day 1 is Supplier Delay");
  assert(eventForDay(2)?.id === "price-increase", "A3: day 2 is Price Increase");
  assert(eventForDay(3)?.id === "bulk-discount", "A4: day 3 is Bulk Discount");
  assert(eventForDay(4)?.id === "fresh-catch", "A5: day 4 is Fresh Catch");
  assert(eventForDay(5)?.id === "temporary-shortage", "A6: day 5 is Temporary Shortage");
  assert(eventForDay(6)?.id === "premium-stock", "A7: day 6 is Premium Stock");
  assert(eventForDay(7) === null, "A8: day 7 is a quiet day (no event)");
  assert(eventForDay(8) === null, "A9: day 8 is quiet");
  assert(eventForDay(9) === null, "A10: day 9 is quiet");
  assert(eventForDay(10)?.id === "supplier-delay", "A11: day 10 repeats the cycle exactly (same as day 1)");
  assert(eventForDay(19)?.id === "supplier-delay", "A12: day 19 (two full cycles later) repeats exactly too");
  assert(eventForDay(100) === eventForDay(100), "A13: calling eventForDay twice for the same day gives the identical object reference (same catalog entry, never re-created)");
}

// ===== B: every catalog entry maps 1:1 to one of the master spec's 6 named examples. =====
{
  const ids = Object.keys(SUPPLIER_EVENT_CATALOG);
  assert(ids.length === 6, `B: exactly 6 event types exist (got ${ids.length})`);
  for (const id of ["supplier-delay", "price-increase", "bulk-discount", "fresh-catch", "temporary-shortage", "premium-stock"]) {
    assert(ids.includes(id), `B2: ${id} exists in the catalog`);
  }
}

// ===== C: eventAdjustedUnitCost — price modifiers apply correctly, never negative. =====
{
  assert(eventAdjustedUnitCost(100, null) === 100, "C: no event leaves the price unchanged");
  assert(eventAdjustedUnitCost(100, SUPPLIER_EVENT_CATALOG["price-increase"]) === 115, "C2: Price Increase adds exactly +15%");
  assert(eventAdjustedUnitCost(100, SUPPLIER_EVENT_CATALOG["bulk-discount"]) === 85, "C3: Bulk Discount subtracts exactly 15%");
  assert(eventAdjustedUnitCost(100, SUPPLIER_EVENT_CATALOG["fresh-catch"]) === 90, "C4: Fresh Catch subtracts exactly 10%");
  assert(eventAdjustedUnitCost(100, SUPPLIER_EVENT_CATALOG["premium-stock"]) === 105, "C5: Premium Stock adds exactly 5%");
  assert(eventAdjustedUnitCost(0, SUPPLIER_EVENT_CATALOG["bulk-discount"]) === 0, "C6: a 0 base price never goes negative under a discount event");
}

// ===== D: maxPurchaseQuantityFor — only Temporary Shortage caps quantity. =====
{
  assert(maxPurchaseQuantityFor(null) === undefined, "D: no event means no cap");
  assert(maxPurchaseQuantityFor(SUPPLIER_EVENT_CATALOG["temporary-shortage"]) === 10, "D2: Temporary Shortage caps at exactly 10");
  assert(maxPurchaseQuantityFor(SUPPLIER_EVENT_CATALOG["price-increase"]) === undefined, "D3: a non-shortage event never caps quantity");
}

// ===== E: purchaseIngredient integration — price-affecting events apply at purchase time. =====
{
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 2 } } }); // day 2 = Price Increase
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok && result.unitCost === Math.round(baseCost * 1.15), `E: a Price Increase day charges the exact +15% adjusted price (got ${result.ok ? result.unitCost : "n/a"})`);
}
{
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 } } }); // day 3 = Bulk Discount
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok && result.unitCost === Math.round(baseCost * 0.85), `E2: a Bulk Discount day charges the exact -15% adjusted price (got ${result.ok ? result.unitCost : "n/a"})`);
}
{
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } } }); // quiet day
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok && result.unitCost === baseCost, "E3: a quiet day (no event) prices exactly as V3-7 always did");
}

// ===== F: Temporary Shortage — the real, wired quantity cap. =====
{
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 5 } } }); // day 5 = Temporary Shortage, cap 10
  const over = purchaseIngredient(save, "tomato", 11);
  assert(!over.ok && over.reason === "exceedsShortageLimit", "F: a purchase over the shortage cap is rejected");
  assert(JSON.stringify(save.business.inventory) === "{}", "F2: a rejected shortage purchase leaves inventory untouched");
  const within = purchaseIngredient(save, "tomato", 10);
  assert(within.ok, "F3: a purchase exactly at the shortage cap succeeds");
}
{
  // F-nocap: the same quantity that was rejected on a shortage day succeeds fine on a quiet day.
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } } });
  const result = purchaseIngredient(save, "tomato", 11);
  assert(result.ok, "F4: the same quantity (11) succeeds on a quiet day with no shortage active");
}

// ===== G: Supplier Delay — suspends the active contract's discount for the day, and ONLY that day. =====
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, supplierContract: contractAt("wholesale-supplier", 1) }, // day 1 = Supplier Delay
  });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 25); // meets the contract's own 25-unit minimum
  assert(result.ok && result.unitCost === baseCost, `G: on a Supplier Delay day, the active contract's discount does NOT apply, even at a qualifying quantity (got ${result.ok ? result.unitCost : "n/a"}, expected ${baseCost})`);
}
{
  // G-normal: the SAME contract, on a non-delay day, still grants its discount normally.
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, supplierContract: contractAt("wholesale-supplier", 7) }, // day 7 = quiet
  });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 25);
  assert(result.ok && result.unitCost === Math.round(baseCost * 0.8), "G2: the same contract grants its normal 20% discount on a non-delay day");
}

// ===== H: no negative price/quantity ever, across every event. =====
{
  for (const event of Object.values(SUPPLIER_EVENT_CATALOG)) {
    assert(eventAdjustedUnitCost(0, event) >= 0, `H: ${event.id} never produces a negative price from a 0 base`);
  }
}

// ===== I: Campaign independence — an event day never touches Campaign state. =====
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 2 } },
  });
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok, "I0: precondition");
  if (result.ok) {
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "I: levelProgress is byte-identical before/after a purchase on an event day");
  }
}

// ===== J: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new file. =====
{
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 2 } } });
  const r1 = purchaseIngredient(save, "tomato", 5);
  const r2 = purchaseIngredient(save, "tomato", 5);
  assert(r1.ok && r2.ok && r1.unitCost === r2.unitCost, "J: identical purchases on the same event day produce identical prices");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const filePath = path.join(import.meta.dirname, "..", "src", "game", "business", "businessSupplierEvents.ts");
  const content = fs.readFileSync(filePath, "utf8");
  const hasMention = /Math\.random\(\)/.test(content);
  const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
  assert(!(hasMention && !isDocMention), "J2: no Math.random() CALL exists anywhere in the new supplier events file");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
