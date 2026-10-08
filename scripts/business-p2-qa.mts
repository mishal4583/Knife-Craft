/**
 * BUSINESS_P2_QA — V3-16 P2 remediation. Focused regressions for every
 * behavior this pass changed, against the real production functions:
 *   A. "Next Customer" uses the SAME accept-time ingredient gate as
 *      "Start Preparing" (nextCustomerDestination), and an unavailable
 *      order can never be paid, consume stock, or write a ledger entry.
 *   B. Purchases in single units (1 lb / 1 piece): price, contract
 *      discount gating, shortage caps and storage checks are unchanged;
 *      the Inventory stepper's rules.
 *   C. Refrigerator wear is per unit stocked — split-invariant through the
 *      REAL purchase path, old saves (no carry field) load and wear
 *      correctly, repair/new refrigerator reset the carry.
 *   D. Campaign isolation and ledger/wallet reconciliation for all of it.
 *
 * Run: npx tsx scripts/business-p2-qa.mts
 */
import { normalizeQuantity } from "../src/game/business/businessInventory.ts";
import { INGREDIENT_MEASURES } from "../src/game/business/ingredientMeasures.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import {
  createBusinessServiceSession,
  advanceBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessOrderAvailability,
  nextCustomerDestination,
  businessCustomersToday,
} from "../src/game/business/BusinessServiceManager.ts";
import { businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { signContract } from "../src/game/business/BusinessSupplierManager.ts";
import { eventForDay } from "../src/game/business/businessSupplierEvents.ts";
import { performRefrigeratorMaintenance } from "../src/game/business/businessMaintenance.ts";
import { purchaseRefrigerator } from "../src/game/business/RefrigeratorManager.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { setDishActive } from "../src/game/business/businessMenuActivation.ts";
import {
  MIN_PURCHASE_QUANTITY,
  DEFAULT_PURCHASE_QUANTITY,
  stepPurchaseQuantity,
} from "../src/game/business/businessPurchaseQuantity.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import type { ServiceSession } from "../src/game/service/ServiceManager.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const QUIET_DAY = 7;
const base = (over: Partial<SaveData["business"]> = {}, credits = 100_000): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  economyLedger: [],
  business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: QUIET_DAY }, ...over },
});
const campaignView = (s: SaveData) => JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !["business", "credits", "economyLedger"].includes(k))));

// Two-dish menu: Garden Salad (tomato/cucumber/carrot) + Chicken & Broccoli (chicken/broccoli/scallion).
function twoDishMenu(save: SaveData): SaveData {
  let s = save;
  for (const dish of BUSINESS_DISH_CATALOG) {
    if (dish.id === "biz-garden-salad" || dish.id === "biz-chicken-broccoli") continue;
    const r = setDishActive(s, dish.id, false);
    if (r.ok) s = r.save;
  }
  return s;
}

// ===== A: Next Customer — the same accept-time gate everywhere. =====
{
  // Stock ONLY the salad; the chicken dish is on the menu but unavailable.
  let save = twoDishMenu(base());
  save = { ...save, business: { ...save.business, inventory: addStock(addStock(addStock({}, "tomato", 5, 100, QUIET_DAY), "cucumber", 5, 100, QUIET_DAY), "carrot", 5, 100, QUIET_DAY) } };
  // Walk a real queue: the ServiceManager only advances a COMPLETED order, so each customer is genuinely
  // served (on a fully-stocked copy) to reach the next one. For every order that becomes current, Next
  // Customer's destination (on the salad-only save) must equal the Start-Preparing gate for that order.
  let stocked: SaveData = save;
  for (const id of ["tomato", "cucumber", "carrot", "chicken", "broccoli", "springonion"] as const) stocked = { ...stocked, business: { ...stocked.business, inventory: addStock(stocked.business.inventory, id, 100, 100, QUIET_DAY) } };
  const rand = makeSeededRand(3);
  let session: ServiceSession = createBusinessServiceSession(rand, save.business.menuActivation);
  let sawService = false;
  let sawPrep = false;
  let consistent = true;
  let checked = 0;
  for (let i = 0; i < 30 && session.current; i++) {
    const dish = businessDishForRecipeId(session.current.recipe.id)!;
    const gate = businessOrderAvailability(save, dish).available ? "preparation" : "service";
    const dest = nextCustomerDestination(save, session);
    if (dest !== gate) consistent = false;
    if (dest === "service") sawService = true;
    else sawPrep = true;
    checked++;
    // Order frequency (Economy V3 Phase 16): the helper copy closes its day once today's customers are served.
    if (businessCustomersToday(stocked).complete) {
      stocked = endBusinessDay(stocked).save;
      const today = stocked.business.calendar.businessDay; // fresh fixture stock for the new day (same as the setup above)
      for (const id of ["tomato", "cucumber", "carrot", "chicken", "broccoli", "springonion"] as const) stocked = { ...stocked, business: { ...stocked.business, inventory: addStock(stocked.business.inventory, id, 100, 100, today) } };
    }
    const served = serveBusinessOrder(recordBusinessServiceComponents(session, 80), stocked, rand);
    if (!served) break;
    stocked = served.save;
    session = advanceBusinessServiceSession(served.session, rand, save.business.menuActivation);
  }
  assert(checked === 30 && consistent, `A: for ${checked} consecutive real customers, Next Customer's destination === the Start-Preparing ingredient gate`);
  assert(sawService && sawPrep, "A2: the queue exercised both outcomes (available -> Preparation, unavailable -> Service screen)");

  // An unavailable order that somehow reached READY is still never paid.
  let chickenSession: ServiceSession | null = null;
  for (let seed = 1; seed < 400 && !chickenSession; seed++) {
    const s = createBusinessServiceSession(makeSeededRand(seed), save.business.menuActivation);
    if (s.current && businessDishForRecipeId(s.current.recipe.id)!.id === "biz-chicken-broccoli") chickenSession = recordBusinessServiceComponents(s, 80);
  }
  assert(!!chickenSession && chickenSession.current!.order.status === "READY", "A3: precondition — an unavailable dish's order forced to READY");
  const refused = serveBusinessOrder(chickenSession!, save, makeSeededRand(1));
  assert(refused === null, "A4: serving an order whose ingredients are unavailable is refused");
  assert(save.credits === 100_000 && save.economyLedger.length === 0 && getQuantity(save.business.inventory, "tomato") === 5, "A5: no revenue, no ledger entry, no stock touched by the refused serve");
  assert(nextCustomerDestination(save, { ...chickenSession!, current: null }) === "service", "A6: an empty queue never sends the player into Preparation");

  // Available path: serve once, pays exactly once.
  let saladSession: ServiceSession | null = null;
  for (let seed = 1; seed < 400 && !saladSession; seed++) {
    const s = createBusinessServiceSession(makeSeededRand(seed), save.business.menuActivation);
    if (s.current && businessDishForRecipeId(s.current.recipe.id)!.id === "biz-garden-salad") saladSession = recordBusinessServiceComponents(s, 80);
  }
  const served = serveBusinessOrder(saladSession!, save, makeSeededRand(1))!;
  const after = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
  assert(serveBusinessOrder(served.session, after, makeSeededRand(1)) === null, "A7: the same order can't be paid twice");
  assert(after.economyLedger.length === 1 && after.credits === 100_000 + served.amountCharged && getQuantity(after.business.inventory, "tomato") === normalizeQuantity(5 - INGREDIENT_MEASURES.tomato.serving), "A8: exactly one payment, one ledger entry, one plate's serving of each ingredient consumed (a 0.3 lb tomato)");
  assert(Object.values(after.business.inventory).every((e) => !e || e.quantity > 0), "A9: no inventory quantity is ever zero/negative");
}

// ===== B: single-unit purchasing. =====
{
  assert(MIN_PURCHASE_QUANTITY === 1 && DEFAULT_PURCHASE_QUANTITY === 5, "B0: the smallest purchase is 1 unit; the default stays 5");
  assert(stepPurchaseQuantity(1, -1) === 1 && stepPurchaseQuantity(1, 1) === 2 && stepPurchaseQuantity(4, 1) === 5 && stepPurchaseQuantity(5, 1) === 10 && stepPurchaseQuantity(10, -1) === 5 && stepPurchaseQuantity(5, -1) === 4 && stepPurchaseQuantity(25, 1) === 30, "B: stepper — 1-unit steps up to 5, then 5 at a time, never below 1");
  const save = base();
  const one = purchaseIngredient(save, "garlic", 1);
  assert(one.ok && one.totalCost === businessUnitCostFor("garlic") && one.save.credits === save.credits - one.totalCost, `B2: 1 lb of garlic costs exactly one unit price (${businessUnitCostFor("garlic")}c)`);
  assert(one.ok && getQuantity(one.save.business.inventory, "garlic") === 1, "B3: exactly 1 unit is stocked");
  // Contract discount still requires the contract's own minimum order.
  const signed = signContract(base(), "local-market");
  if (signed.ok) {
    const small = purchaseIngredient(signed.save, "tomato", 1);
    const big = purchaseIngredient(signed.save, "tomato", 5);
    assert(small.ok && big.ok && small.unitCost === businessUnitCostFor("tomato") && big.unitCost === Math.round(businessUnitCostFor("tomato") * 0.95), "B4: a 1-unit purchase gets no contract discount; the 5-unit contract minimum still does");
  }
  const shortageDay = [1, 2, 3, 4, 5, 6].find((d) => eventForDay(d)?.maxPurchaseQuantity !== undefined)!;
  const capped = purchaseIngredient(base({ calendar: { businessDay: shortageDay } }), "tomato", 11);
  assert(!capped.ok && capped.reason === "exceedsShortageLimit" && purchaseIngredient(base({ calendar: { businessDay: shortageDay } }), "tomato", 1).ok, "B5: shortage caps still apply; 1 unit is fine on a shortage day");
  assert(!purchaseIngredient(save, "tomato", 0).ok && !purchaseIngredient(save, "tomato", 0.5).ok, "B6: 0 and fractional purchases are still refused (whole units only)");
}

// ===== C: per-unit wear through the real purchase path. =====
{
  let singles = base();
  for (let i = 0; i < 10; i++) {
    const r = purchaseIngredient(singles, "tomato", 1);
    if (r.ok) singles = r.save;
  }
  const lot = purchaseIngredient(base(), "tomato", 10);
  assert(lot.ok && singles.business.equipmentCondition.refrigeratorCondition === 99 && lot.save.business.equipmentCondition.refrigeratorCondition === 99, "C: ten 1-unit purchases wear the refrigerator exactly like one 10-unit purchase (1 point each way)");
  assert(singles.credits === lot.save.credits && getQuantity(singles.business.inventory, "tomato") === 10, "C2: and cost exactly the same");
  const oldSave = JSON.parse(JSON.stringify(base({ equipmentCondition: { refrigeratorCondition: 70 } }))) as SaveData;
  delete (oldSave.business.equipmentCondition as { wearCarryUnits?: number }).wearCarryUnits;
  const migrated = { ...DEFAULT_SAVE, ...oldSave, business: { ...DEFAULT_SAVE.business, ...oldSave.business } } as SaveData;
  const w = purchaseIngredient(migrated, "tomato", 15);
  assert(w.ok && w.save.business.equipmentCondition.refrigeratorCondition === 69 && w.save.business.equipmentCondition.wearCarryUnits === 5, "C3: a pre-V3-16 save with no carry field loads and wears correctly (15 units -> 1 point, 5 carried)");
  const worn = base({ equipmentCondition: { refrigeratorCondition: 45, wearCarryUnits: 7 } });
  const repaired = performRefrigeratorMaintenance(worn);
  assert(repaired.ok && repaired.save.business.equipmentCondition.refrigeratorCondition === 100 && (repaired.save.business.equipmentCondition.wearCarryUnits ?? 0) === 0, "C4: a repair restores 100 and clears the partial-wear carry");
  const upgraded = purchaseRefrigerator(base({ equipmentCondition: { refrigeratorCondition: 60, wearCarryUnits: 9 } }, 1_000_000), REFRIGERATOR_CATALOG[1]!.id);
  assert(upgraded.ok && upgraded.save.business.equipmentCondition.refrigeratorCondition === 100 && (upgraded.save.business.equipmentCondition.wearCarryUnits ?? 0) === 0, "C5: a new refrigerator starts at 100 with no carried wear");
}

// ===== D: Campaign isolation. =====
{
  const save = base();
  const before = campaignView(save);
  let s = save;
  const p = purchaseIngredient(s, "tomato", 1);
  if (p.ok) s = p.save;
  const m = setDishActive(s, "biz-garden-salad", false);
  if (m.ok) s = m.save;
  assert(campaignView(s) === before, "D: purchases, wear and menu changes never touch any Campaign field");
}

console.log(failures === 0 ? "\nBUSINESS P2 QA: ALL PASS" : `\nBUSINESS P2 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
