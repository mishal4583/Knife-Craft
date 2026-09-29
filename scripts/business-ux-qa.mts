/**
 * BUSINESS UX QA — the Market-style Business screen (7 tabs + new Overview).
 *
 * Presentation-only redesign, so this checks two things:
 *  1. Every number the Overview shows is the real calculation (A–H): today's
 *     revenue/costs/profit are exactly what End Business Day records, costs
 *     add up from the existing P&L lines, popularity is the save's score, the
 *     rank is Restaurant Progress's own, and nothing is invented.
 *  2. Nothing economic moved (I–N, T–V): every price, salary, supplier term,
 *     menu default and fine is the same as before, and no save field was added.
 *  Plus structure: one Business screen, every old route opens a tab, 48 px
 *  touch targets, no chart library.
 *
 * Run: npx tsx scripts/business-ux-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { INGREDIENTS, type IngredientId } from "../src/game/definitions.ts";
import { businessUnitCostFor, purchaseUnitFor } from "../src/game/business/businessPricing.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { maintenanceCostFor } from "../src/game/business/businessMaintenance.ts";
import { BUSINESS_STAFF_CATALOG, dailyPayroll } from "../src/game/business/businessStaff.ts";
import { SUPPLIER_CONTRACT_CATALOG } from "../src/game/business/businessSupplierContract.ts";
import { SUPPLIER_EVENT_CATALOG } from "../src/game/business/businessSupplierEvents.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { defaultMenuPrice } from "../src/game/business/businessMenu.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import {
  previewBusinessDayClose,
  repeatedWarningFineAmount,
  failFineAmount,
} from "../src/game/business/businessAlerts.ts";
import { restaurantProgress } from "../src/game/progression/restaurantProgress.ts";
import { businessTabForScreen, BUSINESS_TAB_SCREEN } from "../src/components/kc/business/businessTabs.ts";
import type { ScreenId } from "../src/components/kc/data.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else console.log(`ok   ${label}`);
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const dash = read("src/components/kc/business/BusinessDashboard.tsx");

/** A realistic Business day: stock bought, a server hired, part of a day played. */
function playedSave(): SaveData {
  let s: SaveData = { ...structuredClone(DEFAULT_SAVE), credits: 900000 };
  for (const id of ["tomato", "cucumber", "carrot"]) {
    const r = purchaseIngredient(s, id, 5);
    if (r.ok) s = r.save;
  }
  const h = hireStaff(s, "server");
  if (h.ok) s = h.save;
  return s;
}

// ===== A–G: the Overview's numbers are the real calculations =====
{
  const s = playedSave();
  const preview = previewBusinessDayClose(s);
  const closed = endBusinessDay(s);
  const p = preview.dailyPnL;
  assert(JSON.stringify(p) === JSON.stringify(closed.dailyPnL), "A/B: the Overview's 'today' is previewBusinessDayClose — identical to what End Business Day actually records");
  assert(p.revenue === s.business.finance.dailyAccumulator.revenue, "E: today's Revenue = the finance accumulator's real revenue");
  const costs = p.revenue - p.operatingProfit;
  const parts = p.cogs + p.staffCost + p.maintenanceCost + p.supplierCost + p.otherOperatingCost + p.inspectionFines;
  assert(costs === parts, `F: Costs (${costs}) = ingredients used + staff + repairs + supplier fees + other + fines (${parts}) — the existing P&L lines`);
  assert(p.revenue - costs === p.operatingProfit, "G: Revenue − Costs = Profit (the existing operating profit)");
  assert(p.staffCost === dailyPayroll(s.business.staff.hiredRoles), "F2: today's costs include tonight's real staff pay (dailyPayroll)");
  assert(/const costs = costsOf\(today\)/.test(dash) && /pnl\.revenue - pnl\.operatingProfit/.test(dash) && /previewBusinessDayClose\(save\)/.test(dash), "B2: the screen derives Costs as revenue − operating profit from the preview (no new formula)");
  assert(/const popularity = save\.business\.popularity\.score/.test(dash) && /popularityStars\(popularity\)/.test(dash) && /popularityMood\(popularity\)/.test(dash) && /preview\.popularityBreakdown/.test(dash), "C: popularity = the save's score; stars/mood from Restaurant Progress; factors = the day-close preview's own breakdown");
  const rp = restaurantProgress(s);
  assert(/restaurantProgress\(save\)/.test(dash) && /p\.rank\.title/.test(dash) && /p\.rank\.fraction/.test(dash) && !/CAFE_MILESTONES/.test(code(dash)) && typeof rp.rank.title === "string", "D: Restaurant rank comes from restaurantProgress (no second rank system)");
  assert(/go\("rack"\)/.test(dash) && /View Restaurant Progress/.test(dash), "D2: 'View Restaurant Progress →' opens the existing screen");
}

// ===== H: no fake data =====
{
  const meters = read("src/components/kc/common/Meters.tsx");
  assert(!/Math\.random|history\s*[:=]|histories|demoData|sampleData|fakeData|mock/i.test(code(dash) + code(meters)), "H: no random values, history arrays or demo/mock data in the Business screen or charts");
  assert(/save\.business\.finance\.lastDailyPnL/.test(dash) && /label: "Last day"/.test(dash) && /label: "Today so far"/.test(dash), "H2: the performance chart shows only the persisted last day + today (the save keeps no longer history)");
  assert(!/from ["'](recharts|chart\.js|d3|echarts|victory|nivo|apexcharts)/.test(dash + meters) && /<svg/.test(meters), "H3: charts are small inline SVG — no chart library");
  assert(!/1,240|\$720|\$520/.test(dash), "H4: none of the spec's example numbers are hardcoded");
}

// ===== I–N: economy locked (Business ingredient prices per ingredient since the approved change) =====
{
  // Business ingredient prices are per ingredient (approved change: they used to be one flat price per
  // category). Locked by spot values across the range, the 10-cent rounding and the total of all 57.
  const ids = Object.keys(INGREDIENTS) as IngredientId[];
  const spot = { tomato: 100, potato: 60, asparagus: 260, garlic: 320, basil: 180, bread: 220, mozzarella: 340, chicken: 320, salmon: 650, steak: 950 } as const;
  const wrong = (Object.entries(spot) as Array<[IngredientId, number]>).filter(([id, c]) => businessUnitCostFor(id) !== c).map(([id]) => id);
  const total = ids.reduce((a, id) => a + businessUnitCostFor(id), 0);
  assert(ids.length === 57 && wrong.length === 0 && total === 9840 && ids.every((id) => businessUnitCostFor(id) > 0 && businessUnitCostFor(id) % 10 === 0), `I: all 57 ingredient prices locked (per ingredient; total ${total}c)${wrong.length ? " — " + wrong.join(",") : ""}`);
  assert(ids.filter((id) => purchaseUnitFor(id) === "piece").sort().join() === "baguette,basil,bread,cilantro,parsley", "I2: purchase units unchanged (5 sold by the piece)");
  assert(JSON.stringify(REFRIGERATOR_CATALOG.map((r) => [r.id, r.price, r.capacity])) === JSON.stringify([["basic-refrigerator", 0, 40], ["commercial-refrigerator", 200000, 80], ["professional-refrigerator", 480000, 140]]), "J: refrigerators unchanged (free/40, $2,000/80, $4,800/140)");
  assert(maintenanceCostFor(59) === 15000 && maintenanceCostFor(0) === 40000 && maintenanceCostFor(100) === null, "J2: maintenance unchanged ($150 service, $400 repair)");
  const staff = Object.fromEntries(Object.entries(BUSINESS_STAFF_CATALOG).map(([k, v]) => [k, v.salary]));
  // Economy V2.5 (approved): staff are paid for one 2-hour service shift (Cleaner 1.5 h) at unchanged hourly wages.
  assert(JSON.stringify(staff) === JSON.stringify({ "prep-cook": 4000, "line-cook": 4535, "head-chef": 7000, server: 3750, cleaner: 2813, manager: 6000 }), "K: staff salaries = hourly wage × service shift × 1.25 ($40 / $45.35 / $70 / $37.50 / $28.13 / $60)");
  const sup = Object.fromEntries(Object.entries(SUPPLIER_CONTRACT_CATALOG).map(([k, t]) => [k, [t.discount, t.minimumOrder, t.contractLength, t.cancellationFee, t.deliveryTime, t.qualityModifier]]));
  assert(JSON.stringify(sup) === JSON.stringify({ "local-market": [0.05, 5, 10, 0, 0, 0], "wholesale-supplier": [0.2, 25, 21, 12000, 1, -0.05], "premium-supplier": [0.05, 5, 14, 6000, 0, 0.15] }), "L: supplier contract terms unchanged");
  assert(Object.keys(SUPPLIER_EVENT_CATALOG).length === 6, "L2: the same 6 supplier events (none added)");
  const prices = BUSINESS_DISH_CATALOG.map((d) => defaultMenuPrice(getCampaignRecipe(d.sourceRecipeId)!));
  assert(BUSINESS_DISH_CATALOG.length === 35 && prices.reduce((a, b) => a + b, 0) === 59854 && prices[0] === 900 && Math.max(...prices) === 3633, `M: 35 dishes, default menu prices locked (follow the per-ingredient prices at 30% food cost) (sum ${prices.reduce((a, b) => a + b, 0)})`);
  assert(repeatedWarningFineAmount() === 5500 && failFineAmount() === 10500, "N: inspection fines at the V2.5 scale ($55 small, $105 large — Chicago's schedule ÷ 5)");
}

// ===== O–P: actions still wired to the existing mechanics =====
{
  assert(/go\("business-service"\)/.test(dash) && /Open Restaurant/.test(dash), "O: Open Restaurant opens the existing service counter");
  assert(/setDayResult\(onAdvanceDay\(\)\)/.test(dash) && (dash.match(/End Business Day →/g) ?? []).length >= 2, "P: End Business Day calls the existing onAdvanceDay (Overview + Operations)");
  assert(/Customers Today/.test(dash) && /Today's target/.test(dash) && /BASE_CUSTOMERS_PER_DAY/.test(dash) && /Today's customers are complete\./.test(dash), "P2: the day card still explains today's customer target");
}

// ===== structure: one Business screen, every route opens a tab =====
{
  const router = read("src/ScreensRouter.tsx");
  const routes: ScreenId[] = ["business", "business-inventory", "business-refrigerator", "business-menu", "business-suppliers", "business-staff", "business-inspections", "business-finance", "business-shop"];
  assert(routes.every((r) => businessTabForScreen(r) !== null) && Object.values(BUSINESS_TAB_SCREEN).every((sc) => businessTabForScreen(sc) !== null), "S1: every existing Business route opens a tab (alerts, the Market's pantry link and the service back button keep working)");
  assert((router.match(/<BusinessDashboard/g) ?? []).length === 1 && !/<BusinessInventory|<BusinessMenu|<BusinessStaff|<BusinessSuppliers|<BusinessRefrigerator|<BusinessInspections|<BusinessFinance|BusinessShop/.test(router), "S2: one Business screen in the router — no duplicate old screens");
  assert(!fs.existsSync(path.resolve(ROOT, "src/components/kc/business/BusinessShop.tsx")), "S3: the old in-Business 'Market' overview is gone (no second shop)");
  const tabs = ["Overview", "Ingredients", "Equipment", "Staff", "Suppliers", "Menu", "Operations"];
  assert(tabs.every((t) => dash.includes(`label: "${t}"`)), "S4: the seven tabs: Overview · Ingredients · Equipment · Staff · Suppliers · Menu · Operations");
  const ui = ["BusinessInventory", "BusinessMenu"].map((f) => read(`src/components/kc/business/${f}.tsx`)).join("\n");
  assert((ui.match(/h-12 w-12/g) ?? []).length >= 4 && /h-12 w-\[64px\]/.test(ui) && /press h-12 min-w-12 shrink-0 rounded-full/.test(ui), "S5: steppers, ON/OFF toggles and filter chips are 48 px touch targets");
  const inv = read("src/components/kc/business/BusinessInventory.tsx");
  assert(["Vegetables", "Fruit", "Herbs", "Aromatics", "Bakery", "Dairy & Tofu", "Protein"].every((g) => inv.includes(`label: "${g}"`)), "S6: ingredients grouped: Vegetables · Fruit · Herbs · Aromatics · Bakery · Dairy & Tofu · Protein");
  const menu = read("src/components/kc/business/BusinessMenu.tsx");
  assert(/new Set\(BUSINESS_DISH_CATALOG\.map\(\(d\) => d\.category\)\)/.test(menu), "S7: menu category filters come from the real dish catalog");
}

// ===== T–V: one wallet, no new save fields =====
{
  assert(JSON.stringify(Object.keys(DEFAULT_SAVE)) === JSON.stringify(["version", "credits", "equippedKnifeId", "equippedBoardId", "ownedKnifeIds", "ownedBoardIds", "ownedKitchenUpgradeIds", "equippedKitchenUpgradeId", "economy", "ownedKitchenInvestmentIds", "knifeSharpness", "knifeUpgrades", "ownedStaffIds", "selectedSupplierId", "economyLedger", "recipeProgress", "settings", "levelProgress", "story", "dailyOrder", "endless", "business"]), "U/V: no new top-level save fields");
  assert(JSON.stringify(Object.keys(DEFAULT_SAVE.business)) === JSON.stringify(["calendar", "inventory", "refrigerator", "spoilage", "menu", "popularity", "supplierContract", "staff", "equipmentCondition", "inspectionFines", "finance", "menuActivation"]), "V2: no new Business save fields");
  assert(/<BusinessCash cents=\{save\.credits\}/.test(dash) && !/coins?\b/i.test(code(dash).replace(/reward\.coins/g, "")), "T: Business shows the one shared wallet (save.credits), no coin/second currency");
}

console.log(failures === 0 ? "\nBUSINESS UX QA: ALL PASS" : `\nBUSINESS UX QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
