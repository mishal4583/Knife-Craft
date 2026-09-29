/**
 * BUSINESS_FINAL_AUDIT_QA — Economy V3 Phase 16 (final audit / ship
 * readiness). Four parts, all against the REAL production managers:
 *
 *   A-E  the V3-16 P1 fix — every Business Dish's real COGS equals its
 *        menu food-cost basis (inventory draws down the documented
 *        businessPortionModel.ts portion), fractional stock never drifts
 *        or goes negative, purchases stay whole units, old saves load.
 *   F    master spec §22 source scans — single wallet, single ledger,
 *        every Business wallet mutation has exactly one ledger pairing,
 *        no Math.random() call in Business code.
 *   G    master spec §21 simulation — 8 player profiles x 365 Business
 *        Days (reported at 30/60/90/180/365), driven through the same
 *        purchase -> prepare -> serve -> End Business Day calls the UI
 *        makes, with the same ledger compositions as App.tsx. Checks
 *        safety invariants every day (no negative cash/inventory, exact
 *        ledger reconciliation, Campaign state untouched) and reports
 *        the economic outcomes; balance is REPORTED, never forced.
 *
 * The simulated player follows the real Service rules: the current order
 * can't be skipped — if it can't be made (and the player can't or won't
 * buy what's missing) service stops for that day.
 *
 * Run: npx tsx scripts/business-final-audit-qa.mts
 */
import { willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import {
  addStock,
  removeStock,
  getQuantity,
  normalizeQuantity,
  type BusinessInventory,
} from "../src/game/business/businessInventory.ts";
import { BUSINESS_DISH_CATALOG, businessDishPrice, getBusinessDish } from "../src/game/business/businessDishCatalog.ts";
import { businessDishRequirements, businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { recipeCostBasis } from "../src/game/business/businessMenu.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { realCogsFor, recordInventoryPurchase, recordMaintenanceCost, lifetimeSummary } from "../src/game/business/BusinessFinanceManager.ts";
import {
  createBusinessServiceSession,
  advanceBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessOrderAvailability,
  businessCustomersToday,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand, businessServiceSeedFor } from "../src/game/business/businessDeterministicRandom.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { performRefrigeratorMaintenance, maintenanceStatusFor } from "../src/game/business/businessMaintenance.ts";
import { signContract } from "../src/game/business/BusinessSupplierManager.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { setMenuPrice } from "../src/game/business/BusinessMenuManager.ts";
import { isContractActive } from "../src/game/business/businessSupplierContract.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { clearExpiredStock } from "../src/game/business/SpoilageManager.ts";
import { perishabilityStateFor, usableQuantity } from "../src/game/business/perishability.ts";
import { getAvailableStorageCapacity } from "../src/game/business/RefrigeratorManager.ts";
import { eventForDay, maxPurchaseQuantityFor } from "../src/game/business/businessSupplierEvents.ts";
import type { IngredientId } from "../src/game/definitions.ts";
import type { ServiceSession } from "../src/game/service/ServiceManager.ts";
import { setDishActive, activeBusinessDishes, isDishActive } from "../src/game/business/businessMenuActivation.ts";
import { inspectBusiness } from "../src/game/business/businessInspection.ts";

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

function needTotals(dishId: string): Map<IngredientId, number> {
  const totals = new Map<IngredientId, number>();
  for (const r of businessDishRequirements(getBusinessDish(dishId)!)) {
    totals.set(r.ingredientId, normalizeQuantity((totals.get(r.ingredientId) ?? 0) + r.quantity));
  }
  return totals;
}

// ===== A: every Business Dish — real COGS === menu food-cost basis; no loss-making default price. =====
{
  let worstGap = 0;
  let minMargin = 1;
  for (const dish of BUSINESS_DISH_CATALOG) {
    const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
    let inv: BusinessInventory = {};
    for (const [id, q] of needTotals(dish.id)) inv = addStock(inv, id, Math.ceil(q), businessUnitCostFor(id), 1);
    const cogs = realCogsFor(inv, businessDishRequirements(dish));
    const basis = recipeCostBasis(recipe);
    const price = businessDishPrice({}, dish);
    worstGap = Math.max(worstGap, Math.abs(cogs - basis));
    minMargin = Math.min(minMargin, (price - cogs) / price);
  }
  assert(worstGap <= 1, `A: all ${BUSINESS_DISH_CATALOG.length} dishes — real COGS equals menu food-cost basis within 1c rounding (worst gap ${worstGap}c)`);
  assert(minMargin > 0.65, `A2: every dish has a positive gross margin at its default price (lowest ${(minMargin * 100).toFixed(1)}%)`);
  const bread = needTotals("biz-garlic-bread");
  assert(bread.get("garlic") === 0.05 && bread.get("bread") === 1, "A3: Garlic Bread draws 0.05 lb garlic (2 x 0.025 Aromatic portion) + 1 bread — the same portions its price is built on");
}

// ===== B: fractional stock — 20 Garlic Breads use exactly 1 lb of garlic, with no float drift, and the 21st is refused. =====
{
  let inv = addStock({}, "garlic", 1, 350, 1);
  inv = addStock(inv, "bread", 21, 225, 1);
  const dish = getBusinessDish("biz-garlic-bread")!;
  let served = 0;
  let save: SaveData = { ...DEFAULT_SAVE, credits: 0, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: inv } };
  for (let i = 0; i < 25; i++) {
    // Order frequency (Economy V3 Phase 16): a day brings a limited number of customers, so the 20 serves
    // span real Business Days — each closed with the real End Business Day.
    if (businessCustomersToday(save).complete) save = endBusinessDay(save).save;
    if (!businessOrderAvailability(save, dish).available) break;
    let session: ServiceSession | null = null;
    for (let seed = 1; seed < 400 && !session; seed++) {
      const s = createBusinessServiceSession(makeSeededRand(seed));
      if (s.current?.recipe.id === dish.sourceRecipeId) session = recordBusinessServiceComponents(s, 80);
    }
    const result = serveBusinessOrder(session!, save, makeSeededRand(i + 1));
    if (!result) break;
    save = result.save;
    served++;
  }
  assert(served === 20, `B: exactly 20 Garlic Breads served from 1 lb of garlic (got ${served})`);
  assert(getQuantity(save.business.inventory, "garlic") === 0 && !save.business.inventory.garlic, "B2: the garlic entry is removed exactly at zero — no 0.000000001 float residue");
  assert(getQuantity(save.business.inventory, "bread") === 1, "B3: bread drew exactly 1 per serve");
  const avail = businessOrderAvailability(save, dish);
  assert(!avail.available && JSON.stringify(avail.missing) === '["garlic"]', "B4: the 21st order is refused and names only garlic as missing");
}

// ===== C: removeStock/purchase validation — never negative, never invalid; purchases stay whole units. =====
{
  const inv = addStock({}, "garlic", 1, 350, 1);
  for (const bad of [0, -0.025, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = removeStock(inv, "garlic", bad);
    assert(!r.ok && r.reason === "invalidQuantity", `C: removeStock rejects ${bad}`);
  }
  const over = removeStock(inv, "garlic", 1.001);
  assert(!over.ok && over.reason === "insufficientStock", "C2: removing more than on hand is refused (never negative)");
  const save: SaveData = { ...DEFAULT_SAVE, credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } } };
  const frac = purchaseIngredient(save, "garlic", 1.5);
  assert(!frac.ok && frac.reason === "invalidQuantity", "C3: purchases stay whole purchase units (1.5 lb refused)");
}

// ===== D: fractional spoilage — whole-cent value, 3-decimal quantity. =====
{
  const inv = addStock({}, "garlic", 0.95, 350, 1);
  const result = clearExpiredStock(inv, 100);
  assert(result.spoiledQuantity === 0.95 && result.spoiledValue === Math.round(0.95 * 350), `D: a partly-used 0.95 lb entry spoils as 0.95 lb worth ${Math.round(0.95 * 350)}c (whole cents)`);
}

// ===== E: an old save (whole-unit inventory written before V3-16) loads and serves unchanged. =====
{
  const old = JSON.parse(JSON.stringify({ ...DEFAULT_SAVE, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, inventory: addStock(addStock({}, "garlic", 8, 350, 2), "bread", 9, 225, 2) } })) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...old, business: { ...DEFAULT_SAVE.business, ...old.business } } as SaveData;
  assert(businessOrderAvailability(migrated, getBusinessDish("biz-garlic-bread")!).available, "E: a pre-V3-16 whole-unit save still makes Garlic Bread");
  assert(getQuantity(migrated.business.inventory, "garlic") === 8, "E2: its stored quantities are untouched by loading");
}

// ===== F: master spec §22 source scans. =====
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
{
  const root = path.resolve(import.meta.dirname, "..");
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  const srcFiles = walk(path.join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
  const businessDir = path.join(root, "src", "game", "business");
  const mutators = srcFiles
    .filter((f) => f.startsWith(businessDir))
    .filter((f) => /credits:\s*save\.credits\s*[-+]|credits:\s*closingCash|credits\s*[-+]=/.test(stripComments(fs.readFileSync(f, "utf8"))))
    .map((f) => path.basename(f))
    .sort();
  const expected = ["BusinessDayManager.ts", "BusinessInventoryManager.ts", "BusinessServiceManager.ts", "BusinessSupplierManager.ts", "RefrigeratorManager.ts", "businessMaintenance.ts"].sort();
  assert(JSON.stringify(mutators) === JSON.stringify(expected), `F: Business wallet mutations live in exactly the 6 known managers (${mutators.join(", ")})`);
  const app = stripComments(fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8"));
  for (const cat of ["business-revenue", "inventory-purchase", "refrigerator-purchase", "refrigerator-maintenance", "supplier-contract-cancellation", "business-staff-salary", "inspection-fine"]) {
    const n = (app.match(new RegExp(`"${cat}"`, "g")) ?? []).length;
    assert(n === 1, `F2: App.tsx writes the "${cat}" ledger category at exactly one site (found ${n})`);
  }
  const forbidden = /\b(businessLedger|restaurantLedger|dailyLedger|businessCredits|restaurantCash|businessWallet|cashBalance)\b/;
  const offenders = srcFiles.filter((f) => forbidden.test(fs.readFileSync(f, "utf8")));
  assert(offenders.length === 0, `F3: no second wallet/ledger identifier anywhere in src (${offenders.map((f) => path.basename(f)).join(", ") || "none"})`);
  const randomCalls = srcFiles
    .filter((f) => f.startsWith(businessDir))
    .filter((f) => /Math\.random\(\)/.test(stripComments(fs.readFileSync(f, "utf8"))));
  assert(randomCalls.length === 0, `F4: no Math.random() call in Business code (${randomCalls.map((f) => path.basename(f)).join(", ") || "none"})`);
}

const FOCUS_MENU = ["biz-garden-salad", "biz-tomato-lettuce-salad", "biz-kachumber-salad", "biz-chicken-broccoli", "biz-garlic-chicken", "biz-greek-lemon-chicken"];

// ===== H: Active Menu (V3-16 P0 fix #1). =====
{
  const base: SaveData = { ...DEFAULT_SAVE, credits: 50_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } } };
  assert(base.business.menuActivation.inactiveDishIds.length === 0 && activeBusinessDishes(base.business.menuActivation).length === BUSINESS_DISH_CATALOG.length, "H: a fresh save has every dish on the menu");
  const oldJson = JSON.parse(JSON.stringify({ ...base, business: (({ menuActivation: _m, ...rest }) => rest)(base.business) })) as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...oldJson, business: { ...DEFAULT_SAVE.business, ...oldJson.business } } as SaveData;
  assert(Array.isArray(migrated.business.menuActivation.inactiveDishIds) && activeBusinessDishes(migrated.business.menuActivation).length === 35, "H2: a pre-V3-16 save (no menuActivation field) migrates to all 35 dishes ON");
  let save = base;
  for (const dish of BUSINESS_DISH_CATALOG) {
    if (FOCUS_MENU.includes(dish.id)) continue;
    const r = setDishActive(save, dish.id, false);
    if (r.ok) save = r.save;
  }
  assert(activeBusinessDishes(save.business.menuActivation).map((d) => d.id).join() === BUSINESS_DISH_CATALOG.filter((d) => FOCUS_MENU.includes(d.id)).map((d) => d.id).join(), "H3: taking 29 dishes off leaves exactly the 6-dish menu, in catalog order");
  const seen = new Set<string>();
  for (let day = 1; day <= 40; day++) {
    const rand = makeSeededRand(businessServiceSeedFor(day));
    let session = createBusinessServiceSession(rand, save.business.menuActivation);
    for (let i = 0; i < 25 && session.current; i++) {
      seen.add(businessDishForRecipeId(session.current.recipe.id)!.id);
      if (session.next) seen.add(businessDishForRecipeId(session.next.recipe.id)!.id);
      session = advanceBusinessServiceSession(session, rand, save.business.menuActivation);
    }
  }
  assert([...seen].every((id) => FOCUS_MENU.includes(id)), `H4: 1,000 generated orders over 40 days never include an off-menu dish (saw ${[...seen].length} distinct dishes)`);
  assert(seen.size === FOCUS_MENU.length, "H5: every on-menu dish does get ordered");
  const genSeq = (s: SaveData) => {
    const rand = makeSeededRand(businessServiceSeedFor(9));
    let session = createBusinessServiceSession(rand, s.business.menuActivation);
    const ids: string[] = [];
    for (let i = 0; i < 12 && session.current; i++) {
      ids.push(session.current.recipe.id);
      session = advanceBusinessServiceSession(session, rand, s.business.menuActivation);
    }
    return ids.join();
  };
  assert(genSeq(save) === genSeq(JSON.parse(JSON.stringify(save)) as SaveData), "H6: order generation from the active pool is deterministic (same day + same menu -> same orders, also after a save/reload round-trip)");
  let one = save;
  for (const id of FOCUS_MENU.slice(1)) {
    const r = setDishActive(one, id, false);
    if (r.ok) one = r.save;
  }
  const last = setDishActive(one, FOCUS_MENU[0]!, false);
  assert(!last.ok && last.reason === "lastActiveDish" && activeBusinessDishes(one.business.menuActivation).length === 1, "H7: the final on-menu dish can't be taken off (minimum-one invariant)");
  assert(!setDishActive(save, "biz-not-a-dish", false).ok, "H8: an unknown dish id is refused");
  const back = setDishActive(save, "biz-caprese-salad", true);
  assert(back.ok && isDishActive(back.save.business.menuActivation, "biz-caprese-salad"), "H9: a dish can be put back on the menu");
  const on1 = setDishActive(save, "biz-garden-salad", true);
  const on2 = on1.ok ? setDishActive(on1.save, "biz-garden-salad", true) : on1;
  assert(on1.ok && on2.ok && JSON.stringify(on2.save.business.menuActivation) === JSON.stringify(save.business.menuActivation), "H10: putting an already-on dish on again is a no-op (idempotent)");
  const toggled = setDishActive(save, "biz-kachumber-salad", false);
  if (toggled.ok) {
    const s = toggled.save;
    assert(s.credits === save.credits && s.economyLedger.length === save.economyLedger.length, "H11: a menu change moves no money and writes no ledger entry");
    const nonBusiness = (x: SaveData) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => k !== "business")));
    assert(nonBusiness(s) === nonBusiness(save), "H12: a menu change touches nothing outside SaveData.business (Campaign recipes/progress/coins untouched)");
    assert(JSON.stringify(s.business.menu) === JSON.stringify(save.business.menu), "H13: prices (business.menu) are untouched by activation — popularity's menu inputs are unchanged");
  }
  // Price changes still apply at serve time for an on-menu dish.
  const priced = setMenuPrice(save, getBusinessDish("biz-garden-salad")!.sourceRecipeId, 1234);
  if (priced.ok) {
    let s = { ...priced.save, business: { ...priced.save.business, inventory: addStock(addStock(addStock({}, "tomato", 5, 100, 7), "cucumber", 5, 100, 7), "carrot", 5, 100, 7) } };
    let session: ServiceSession | null = null;
    for (let seed = 1; seed < 400 && !session; seed++) {
      const c = createBusinessServiceSession(makeSeededRand(seed), s.business.menuActivation);
      if (c.current?.recipe.id === getBusinessDish("biz-garden-salad")!.sourceRecipeId) session = recordBusinessServiceComponents(c, 80);
    }
    const served = session ? serveBusinessOrder(session, s, makeSeededRand(1)) : null;
    assert(!!served && served.payment.menuPrice === 1234 && served.amountCharged === customerPaysAt50(1234), "H14: an on-menu dish's CURRENT menu price is what the customer payment is built from (1234c × popularity modifier)");
    if (served) {
      s = appendLedgerEntry(served.save, "business-revenue", served.amountCharged, served.dish.id);
      assert(s.economyLedger.filter((e) => e.category === "business-revenue").length === 1 && s.business.finance.dailyAccumulator.revenue === customerPaysAt50(1234) && s.business.finance.dailyAccumulator.cogs === 300, "H15: exactly one revenue entry; P&L revenue = the customer payment and COGS 300c (3 x $1.00 veg) are consistent");
    }
  }
}

// ===== I: daily Kitchen Cleanliness (V3-16 P0 fix #2). =====
{
  const cleanliness = (save: SaveData, today?: number) => inspectBusiness(save, today).categories.find((c) => c.category === "KITCHEN_CLEANLINESS")!.result;
  const s = (lifetime: number): SaveData => ({ ...DEFAULT_SAVE, credits: 50_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 30 }, spoilage: { totalSpoiledQuantity: lifetime, totalSpoiledValue: lifetime * 100 } } });
  assert(cleanliness(s(500), 0) === "PASS", "I: 500 units of HISTORICAL spoilage no longer fail today's inspection when nothing spoiled today");
  assert(cleanliness(s(0), 14.999) === "PASS" && cleanliness(s(0), 15) === "WARNING" && cleanliness(s(0), 49.999) === "WARNING" && cleanliness(s(0), 50) === "FAIL", "I2: the exact 15 / 50 unit thresholds are preserved, applied to today's spoilage");
  assert(cleanliness(s(0)) === "PASS", "I3: the live 'right now' view (no sweep yet today) reads 0 spoiled today");
  const withCleaner = { ...s(0), business: { ...s(0).business, staff: { hiredRoles: ["cleaner"] } } } as SaveData;
  assert(cleanliness(withCleaner, 80) === "PASS", "I4: a Cleaner still keeps the category at PASS");
  // Day N spoils 20 units (WARNING); day N+1 spoils nothing -> PASS, despite the lifetime total now being >= 15.
  let inv: BusinessInventory = {};
  for (const id of ["tomato", "cucumber", "carrot", "lettuce"] as IngredientId[]) inv = addStock(inv, id, 5, 100, 1);
  const dayA: SaveData = { ...DEFAULT_SAVE, credits: 50_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, inventory: inv } };
  const preview = endBusinessDay(dayA);
  const actual = endBusinessDay(JSON.parse(JSON.stringify(dayA)) as SaveData);
  assert(actual.spoiledQuantity === 20 && cleanlinessOf(actual) === "WARNING", `I5: a day that spoils 20 units is a Cleanliness WARNING (spoiled ${actual.spoiledQuantity})`);
  assert(JSON.stringify(preview.inspectionReport) === JSON.stringify(actual.inspectionReport) && preview.inspectionFine.finePaid === actual.inspectionFine.finePaid, "I6: preview (pure run) === actual End Business Day result");
  const dayB = endBusinessDay(actual.save);
  assert(actual.save.business.spoilage.totalSpoiledQuantity >= 15 && cleanlinessOf(dayB) === "PASS", "I7: the next day, with nothing spoiling, is back to PASS — lifetime spoilage (>=15) no longer ratchets it");
  assert(dayB.save.business.spoilage.totalSpoiledQuantity === actual.save.business.spoilage.totalSpoiledQuantity, "I8: the lifetime spoilage total is still kept (unchanged when nothing spoils)");
}
function cleanlinessOf(r: { inspectionReport: { categories: { category: string; result: string }[] } }) {
  return r.inspectionReport.categories.find((c) => c.category === "KITCHEN_CLEANLINESS")!.result;
}

// ===== G: §21 simulation. =====
type Profile = {
  name: string;
  ordersPerDay: number;
  /** Minimum whole units bought per ingredient purchase (the Inventory screen's own minimum/step is 5). */
  lot: number;
  priceMultiplier: number;
  repairs: boolean;
  /** Only restocks on days where day % restockEvery === 0. */
  restockEvery: number;
  contract: string | null;
  hires: string[];
  /** The on-menu dishes (set through the real setDishActive); undefined = every dish left on (a player who never curates the menu). */
  menu?: string[];
  /** Starting cash (defaults to START_CASH). */
  startCash?: number;
};
const BASE_PROFILES: Profile[] = [
  { name: "Efficient", ordersPerDay: 10, lot: 1, priceMultiplier: 1, repairs: true, restockEvery: 1, contract: null, hires: ["cleaner"] },
  { name: "Normal", ordersPerDay: 8, lot: 5, priceMultiplier: 1, repairs: true, restockEvery: 1, contract: null, hires: [] },
  { name: "Wasteful", ordersPerDay: 8, lot: 15, priceMultiplier: 1, repairs: true, restockEvery: 1, contract: null, hires: [] },
  { name: "Premium pricing", ordersPerDay: 8, lot: 5, priceMultiplier: 1.4, repairs: true, restockEvery: 1, contract: null, hires: [] },
  { name: "Low-price/high-volume", ordersPerDay: 16, lot: 5, priceMultiplier: 0.8, repairs: true, restockEvery: 1, contract: null, hires: [] },
  { name: "Poor inventory mgmt", ordersPerDay: 8, lot: 5, priceMultiplier: 1, repairs: true, restockEvery: 3, contract: null, hires: [] },
  { name: "Poor maintenance", ordersPerDay: 8, lot: 5, priceMultiplier: 1, repairs: false, restockEvery: 1, contract: null, hires: [] },
  { name: "Supplier-focused", ordersPerDay: 10, lot: 25, priceMultiplier: 1, repairs: true, restockEvery: 1, contract: "wholesale-supplier", hires: [] },
];
/** V3-16 P2 remediation: the Inventory screen now allows 1-unit purchases, so every profile (including Efficient's lot-1 buying) is reachable through the real UI. */
const NOT_UI_REACHABLE = new Set<string>();
const PROFILES: Profile[] = [
  ...BASE_PROFILES.map((p) => ({ ...p, name: `${p.name} [all 35 on]` })),
  ...BASE_PROFILES.map((p) => ({ ...p, name: `${p.name} [6-dish menu]`, menu: FOCUS_MENU })),
  // Recovery: a business that went broke, restarted with a small amount earned back in Campaign (the shared wallet).
  { ...BASE_PROFILES[1]!, name: "Recovery $300 [6-dish menu]", menu: FOCUS_MENU, startCash: 30_000 },
  { ...BASE_PROFILES[1]!, name: "Recovery $100 [6-dish menu]", menu: FOCUS_MENU, startCash: 10_000 },
];
const START_CASH = 300_000; // $3,000 — a representative mid-campaign shared wallet (the live save audited in V3-15 held $2,985.20)
const CHECKPOINTS = [30, 60, 90, 180, 365];
/** "Insolvent" for this report: the business ends a day with less than $50 — below what a single 5-unit restock of most ingredients costs, so Service effectively stops. */
const INSOLVENT_BELOW = 5_000;

type Totals = { revenue: number; cogs: number; purchases: number; spoilage: number; staff: number; maintenance: number; supplier: number; otherOpex: number; fines: number; capex: number; customers: number; operatingProfit: number; lossDays: number; profitDays: number; zeroServeDays: number; longestZeroStreak: number };

function simulate(p: Profile, days: number) {
  const startCash = p.startCash ?? START_CASH;
  let save: SaveData = { ...DEFAULT_SAVE, credits: startCash, economyLedger: [], business: { ...DEFAULT_BUSINESS_STATE } };
  const campaignBefore = JSON.stringify(Object.fromEntries(Object.entries({ ...save, economy: { ...save.economy, lifetime: {} } }).filter(([k]) => !["business", "credits", "economyLedger"].includes(k))));
  if (p.menu) {
    for (const dish of BUSINESS_DISH_CATALOG) {
      if (p.menu.includes(dish.id)) continue;
      const r = setDishActive(save, dish.id, false);
      if (r.ok) save = r.save;
    }
  }
  if (p.priceMultiplier !== 1) {
    for (const dish of BUSINESS_DISH_CATALOG) {
      const r = setMenuPrice(save, dish.sourceRecipeId, Math.round(businessDishPrice({}, dish) * p.priceMultiplier));
      if (r.ok) save = r.save;
    }
  }
  for (const role of p.hires) {
    const r = hireStaff(save, role);
    if (r.ok) save = r.save;
  }
  const t: Totals = { revenue: 0, cogs: 0, purchases: 0, spoilage: 0, staff: 0, maintenance: 0, supplier: 0, otherOpex: 0, fines: 0, capex: 0, customers: 0, operatingProfit: 0, lossDays: 0, profitDays: 0, zeroServeDays: 0, longestZeroStreak: 0 };
  const snapshots: Record<number, Totals & { cash: number; popularity: number }> = {};
  const invariantViolations: string[] = [];
  const failCats: Record<string, number> = {};
  let zeroStreak = 0;
  let minCash = save.credits;
  let firstInsolventDay: number | null = null;
  for (let d = 1; d <= days; d++) {
    const day = save.business.calendar.businessDay;
    const cashAtStart = save.credits;
    const idsAtStart = new Set(save.economyLedger.map((e) => e.id));
    if (p.contract && !isContractActive(save.business.supplierContract, day)) {
      const r = signContract(save, p.contract);
      if (r.ok) save = r.save;
    }
    if (p.repairs && maintenanceStatusFor(save.business.equipmentCondition.refrigeratorCondition) !== "OPERATIONAL") {
      const r = performRefrigeratorMaintenance(save);
      if (r.ok) save = recordMaintenanceCost(appendLedgerEntry(r.save, "refrigerator-maintenance", -r.cost), r.cost);
    }
    const rand = makeSeededRand(businessServiceSeedFor(day));
    let session = createBusinessServiceSession(rand, save.business.menuActivation);
    let servedToday = 0;
    while (servedToday < p.ordersPerDay && session.current) {
      const dish = businessDishForRecipeId(session.current.recipe.id)!;
      if (!businessOrderAvailability(save, dish).available) {
        if (day % p.restockEvery !== 0) break;
        const cap = maxPurchaseQuantityFor(eventForDay(day));
        for (const [id, need] of needTotals(dish.id)) {
          const have = usableQuantity(save.business.inventory, id, day);
          if (have >= need) continue;
          let qty = Math.max(p.lot, Math.ceil(need - have));
          if (cap !== undefined) qty = Math.min(qty, cap);
          qty = Math.min(qty, Math.floor(getAvailableStorageCapacity(save.business.inventory, save.business.refrigerator.refrigeratorId)));
          if (qty <= 0) continue;
          const r = purchaseIngredient(save, id, qty);
          if (r.ok) save = recordInventoryPurchase(appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id), r.totalCost);
        }
        if (!businessOrderAvailability(save, dish).available) break; // can't make it — the real Service has no skip
      }
      const ready = recordBusinessServiceComponents(session, 80);
      const result = serveBusinessOrder(ready, save, rand);
      if (!result) break;
      save = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
      servedToday++;
      session = advanceBusinessServiceSession(result.session, rand, save.business.menuActivation);
    }
    const end = endBusinessDay(save);
    save = appendLedgerEntry(appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid), "inspection-fine", -end.inspectionFine.finePaid);
    const pnl = end.dailyPnL;
    for (const c of end.inspectionReport.categories) if (c.result !== "PASS") failCats[c.category] = (failCats[c.category] ?? 0) + 1;
    // The shared ledger is a 200-entry FIFO window (EconomyLedger.MAX_LEDGER_ENTRIES, Economy V2) — diff by entry id, not index.
    const ledgerDelta = save.economyLedger.filter((e) => !idsAtStart.has(e.id)).reduce((s, e) => s + e.amount, 0);
    if (cashAtStart + ledgerDelta !== save.credits) invariantViolations.push(`day ${day}: reconciliation ${cashAtStart}+${ledgerDelta}!==${save.credits}`);
    if (pnl.closingCash !== save.credits || pnl.openingCash !== cashAtStart) invariantViolations.push(`day ${day}: P&L opening/closing mismatch`);
    if (pnl.openingCash + pnl.netCashChange !== pnl.closingCash) invariantViolations.push(`day ${day}: opening + net change != closing`);
    // V3-16 experience audit: the Dashboard day card bridges profit to cash with this exact identity.
    if (pnl.operatingProfit + (pnl.cogs - pnl.inventoryPurchaseCost - pnl.capitalExpenditure) !== pnl.netCashChange) invariantViolations.push(`day ${day}: profit-to-cash bridge broken`);
    if (save.credits < 0) invariantViolations.push(`day ${day}: negative cash`);
    for (const e of Object.values(save.business.inventory)) {
      if (e && !(e.quantity > 0 && Number.isFinite(e.quantity) && normalizeQuantity(e.quantity) === e.quantity)) invariantViolations.push(`day ${day}: bad quantity ${e.ingredientId}=${e.quantity}`);
    }
    if (save.business.popularity.score < 0) invariantViolations.push(`day ${day}: negative popularity`);
    minCash = Math.min(minCash, save.credits);
    if (firstInsolventDay === null && save.credits < INSOLVENT_BELOW) firstInsolventDay = d;
    t.revenue += pnl.revenue; t.cogs += pnl.cogs; t.purchases += pnl.inventoryPurchaseCost; t.spoilage += pnl.spoilageValue;
    t.staff += pnl.staffCost; t.maintenance += pnl.maintenanceCost; t.supplier += pnl.supplierCost; t.otherOpex += pnl.otherOperatingCost; t.fines += pnl.inspectionFines;
    t.capex += pnl.capitalExpenditure; t.customers += servedToday; t.operatingProfit += pnl.operatingProfit;
    if (pnl.operatingProfit < 0) t.lossDays++; else if (pnl.operatingProfit > 0) t.profitDays++;
    if (servedToday === 0) { t.zeroServeDays++; zeroStreak++; t.longestZeroStreak = Math.max(t.longestZeroStreak, zeroStreak); } else zeroStreak = 0;
    if (CHECKPOINTS.includes(d)) snapshots[d] = { ...t, cash: save.credits, popularity: save.business.popularity.score };
  }
  const campaignAfter = JSON.stringify(Object.fromEntries(Object.entries({ ...save, economy: { ...save.economy, lifetime: {} } }).filter(([k]) => !["business", "credits", "economyLedger"].includes(k))));
  if (campaignBefore !== campaignAfter) invariantViolations.push("Campaign state changed");
  const businessCats = ["business-revenue", "inventory-purchase", "refrigerator-purchase", "refrigerator-maintenance", "supplier-contract-cancellation", "business-staff-salary", "inspection-fine"];
  if (save.economyLedger.some((e) => !businessCats.includes(e.category))) invariantViolations.push("non-Business ledger entry created");
  if (save.economyLedger.some((e) => e.amount === 0)) invariantViolations.push("zero-amount ledger entry");
  return { snapshots, invariantViolations, finalCash: save.credits, minCash, save, failCats, firstInsolventDay };
}

const usd = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const results = PROFILES.map((p) => ({ p, r: simulate(p, 365) }));
console.log(`\n§21 SIMULATION — start cash ${usd(START_CASH)}, 365 Business Days per profile; cumulative at each checkpoint. Capital expenditure is $0 in every run (no profile buys a refrigerator).`);
console.log("profile                         day   cash     revenue    COGS    labor   opCost(maint+suppl)  fines   spoil   custs  opProfit  netCash  pop  loss/profit days  zero-serve days (longest)");
for (const { p, r } of results) {
  for (const d of CHECKPOINTS) {
    const s = r.snapshots[d]!;
    console.log(`${p.name.padEnd(31)} ${String(d).padStart(4)} ${usd(s.cash).padStart(8)} ${usd(s.revenue).padStart(9)} ${usd(s.cogs).padStart(8)} ${usd(s.staff).padStart(7)} ${usd(s.maintenance + s.supplier + s.otherOpex).padStart(9)} (${usd(s.maintenance)}+${usd(s.supplier)}) ${usd(s.fines).padStart(8)} ${usd(s.spoilage).padStart(7)} ${String(s.customers).padStart(6)} ${usd(s.operatingProfit).padStart(9)} ${usd(s.cash - (p.startCash ?? START_CASH)).padStart(8)} ${String(s.popularity).padStart(4)}   ${String(s.lossDays).padStart(3)}/${String(s.profitDays).padEnd(3)}          ${s.zeroServeDays} (${s.longestZeroStreak})`);
  }
}
console.log("\nsolvency summary (365 days):");
for (const { p, r } of results) {
  const base = p.name.replace(/ \[.*$/, "");
  console.log(`  ${p.name.padEnd(31)} ending ${usd(r.finalCash).padStart(8)}  min ${usd(r.minCash).padStart(7)}  first day < ${usd(INSOLVENT_BELOW)}: ${r.firstInsolventDay ?? "never"}${NOT_UI_REACHABLE.has(base) ? "   (not UI-reachable: 1-unit purchases)" : ""}`);
}
console.log("\ninspection non-PASS days by category (365 days):");
for (const { p, r } of results) console.log(`  ${p.name.padEnd(31)} ${JSON.stringify(r.failCats)}`);
console.log("");
for (const { p, r } of results) {
  assert(r.invariantViolations.length === 0, `G[${p.name}]: 365 days — exact daily ledger reconciliation, opening + net change = closing, no negative cash/inventory/popularity, no zero/non-Business ledger entry, Campaign state untouched${r.invariantViolations.length ? " — " + r.invariantViolations.slice(0, 3).join("; ") : ""}`);
}
assert(results.every((x) => x.r.minCash >= 0), "G2: no profile ever goes below $0 (no debt)");
// V3-16 lifetime remediation: after 365 days (thousands of ledger entries, far past the 200-entry window), the
// stored running lifetime totals must equal the sum of all 365 daily P&Ls, field by field.
for (const { p, r } of results) {
  const t = r.snapshots[365]!;
  const l = r.save.business.finance.lifetime;
  const ok =
    l.revenue === t.revenue && l.orderCount === t.customers && r.save.business.finance.lifetimeCogs === t.cogs &&
    l.inventoryPurchaseCost === t.purchases && l.staffCost === t.staff && l.maintenanceCost === t.maintenance &&
    l.supplierCost === t.supplier && l.inspectionFines === t.fines && l.capitalExpenditure === t.capex &&
    lifetimeSummary(r.save).cumulativeOperatingProfit === t.operatingProfit && l.coverage === "complete";
  assert(ok, `G5[${p.name}]: lifetime totals === sum of 365 daily P&Ls (revenue ${l.revenue}/${t.revenue}, orders ${l.orderCount}/${t.customers}, op. profit ${lifetimeSummary(r.save).cumulativeOperatingProfit}/${t.operatingProfit})`);
}
assert(results.some((x) => x.r.snapshots[365]!.profitDays > 0) && results.some((x) => x.r.snapshots[365]!.lossDays > 0), "G3: both a profitable day and a loss-making day are possible");
const stripMeta = (s: SaveData) => JSON.stringify({ ...s, economyLedger: s.economyLedger.map(({ id: _id, timestamp: _t, ...rest }) => rest) });
assert(stripMeta(simulate(PROFILES[9]!, 90).save) === stripMeta(simulate(PROFILES[9]!, 90).save), "G4: the simulation is fully deterministic (same profile, same 90 days -> identical save; ledger id/timestamp are Date.now() metadata, excluded)");

// Opt-in: KC_EXPORT_SAVE=<path> writes the real 365-day "Normal [6-dish menu]" save (ledger capped at 200,
// thousands of transactions of history) for browser verification of the lifetime Finance totals.
if (process.env["KC_EXPORT_SAVE"]) {
  const normal = results.find((x) => x.p.name === "Normal [6-dish menu]")!.r.save;
  fs.writeFileSync(process.env["KC_EXPORT_SAVE"], JSON.stringify(normal));
  console.log(`exported ${process.env["KC_EXPORT_SAVE"]}`);
}
console.log(failures === 0 ? "\nBUSINESS FINAL AUDIT QA: ALL PASS" : `\nBUSINESS FINAL AUDIT QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
