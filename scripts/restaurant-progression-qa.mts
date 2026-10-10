/**
 * RESTAURANT PROGRESSION QA — the developer's 2026-10-05 brief for the
 * Unified Restaurant (behind RESTAURANT_MODE), tested with the real
 * functions. (The menu curve and cuisine tie are in restaurant-menu-qa;
 * supplies in restaurant-supplies-qa.)
 *
 *  S. Staff requirements (restaurant/staffRequirements.ts): none before
 *     L41; each role from its level AND only when the service is big enough
 *     (orders, dine-in tables, cuisines, team); specialist chefs for the
 *     specialist cuisines on the menu or in the tickets; announced 5 levels
 *     ahead; unmet → the check blocks; hiring is free (no money, no ledger).
 *  P. Specialist pay: none before L91; from L91 at closing, one
 *     "business-staff-salary" entry per chef; a wallet that can't cover them
 *     lays them off, never debt.
 *  E. Closing from L91 records End Business Day's payroll and fine in the
 *     ledger (opening cash + signed ledger = closing cash).
 *  B. Bulk buying (restaurant/bulkBuying.ts): presets 5/25/50/100; tiers;
 *     the quote and the purchase agree; one ledger entry; 0 discount = the
 *     classic price exactly; consumable supplies only; up to 100 packs.
 *  I. Inventory's restaurant Needs Attention: the next service's missing
 *     ingredients and supplies (with the check's own numbers), napkins,
 *     dish soap ("~N washes remaining"), cleaning liquid ("~N closings
 *     remaining"), fridge space and staff; urgent first; read-only.
 *  F. Fridge usage: Basic 40 / Commercial 80 / Professional 140 unchanged;
 *     nearly full at 85%, full at capacity; shown in the check from L21.
 *  N. No separate Business Day before L250; the Endless Restaurant after.
 *  W. Wiring: everything above only under RESTAURANT_MODE.
 *
 * Run: npx tsx scripts/restaurant-progression-qa.mts
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
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import {
  STAFF_RULES,
  SPECIALIST_CHEFS,
  fireSpecialist,
  getSpecialist,
  hireSpecialist,
  paySpecialists,
  restaurantStaffOf,
  serviceShape,
  staffComingUp,
  staffRequirementsFor,
} from "../src/game/restaurant/staffRequirements.ts";
import {
  servicePlanFor,
  servicePlanNeedsSheet,
  staffReady,
} from "../src/game/restaurant/preServiceCheck.ts";
import { closeDay, openDay, recordService } from "../src/game/restaurant/restaurantDay.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import {
  BULK_DISCOUNTS,
  BULK_MAX_PACKS,
  BULK_PRESETS,
  bulkDiscountFor,
  discountedUnitCost,
} from "../src/game/restaurant/bulkBuying.ts";
import {
  purchaseIngredient,
  purchaseQuote,
} from "../src/game/business/BusinessInventoryManager.ts";
import {
  MAX_SUPPLY_PACKS,
  purchaseSupply,
  supplyQuote,
} from "../src/game/business/BusinessSuppliesManager.ts";
import { getSupplyItem, supplyPackPrice } from "../src/game/business/businessSupplies.ts";
import { restaurantAttention } from "../src/game/restaurant/restaurantAttention.ts";
import { FRIDGE_NEARLY_FULL, fridgeUsage } from "../src/game/restaurant/fridgeUsage.ts";
import { getRefrigeratorCapacity } from "../src/game/business/RefrigeratorManager.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { businessDayAllowed } from "../src/game/restaurant/endlessRestaurant.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import { rollServiceTickets } from "../src/game/restaurant/serviceTickets.ts";
import { orderServiceFor } from "../src/game/restaurant/serviceSupplies.ts";
import { BUSINESS_STAFF_CATALOG } from "../src/game/business/businessStaff.ts";
import { servicesForDayAt } from "../src/game/restaurant/restaurantProgression.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

function saveAt(n: number, credits = 500_000): SaveData {
  return {
    ...structuredClone(DEFAULT_SAVE),
    credits,
    levelProgress: {
      ...structuredClone(DEFAULT_SAVE.levelProgress),
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
}
const withRoles = (s: SaveData, roles: string[]): SaveData => ({
  ...s,
  business: { ...s.business, staff: { hiredRoles: roles as never } },
});
const shapeAt = (s: SaveData, n: number) => {
  const tickets = rollServiceTickets(getLevel(`level-${n}`)!);
  return serviceShape(
    s,
    n,
    tickets,
    tickets.map((_, i) => orderServiceFor(n, i)),
  );
};

console.log("S. Staff requirements");
{
  const reqs = (n: number, s = saveAt(n)) => staffRequirementsFor(s, n, shapeAt(s, n));
  assert(
    [1, 11, 20, 31, 40].every((n) => reqs(n).length === 0),
    "S1: early game the chef runs the restaurant alone (no requirement before L41)",
  );
  assert(
    STAFF_RULES.map((r) => `${r.role}@${r.fromLevel}`).join() ===
      "prep-cook@41,server@46,line-cook@61,cleaner@91,head-chef@121,manager@161",
    "S2: Prep Cook (L41) → Server (L46, dine-in) → Line Cook (L61) → Cleaner (L91) → Head Chef (L121) → Manager (L161)",
  );
  const small = { orders: 2, dineIn: 1, specialists: [], specialistCuisines: 0 };
  const big = { orders: 5, dineIn: 4, specialists: [], specialistCuisines: 0 };
  assert(
    staffRequirementsFor(saveAt(70), 70, small)
      .map((r) => r.id)
      .join() === "" &&
      staffRequirementsFor(saveAt(70), 70, big)
        .map((r) => r.id)
        .join() === "prep-cook,server,line-cook",
    "S3: requirements scale with the service (2 orders / 1 table: none at L70; 5 orders / 4 tables: three)",
  );
  const r51 = reqs(51);
  assert(
    r51.some((r) => r.id === "indian-chef" && r.kind === "specialist" && !r.met) &&
      !reqs(50).some((r) => r.kind === "specialist"),
    "S4: from the Indian chapter (L51) the Indian Chef is needed; not before",
  );
  const noIndian = {
    ...saveAt(52),
    business: {
      ...saveAt(52).business,
      menuActivation: {
        inactiveDishIds: ["biz-spinach-curry", "biz-potato-curry", "biz-cauliflower-curry"],
      },
    },
  };
  const chefsFor = (s: SaveData, n: number, ticketCuisine: string | null) =>
    serviceShape(s, n, [{ cuisineId: ticketCuisine } as never], ["dine-in"]).specialists;
  assert(
    chefsFor(saveAt(52), 52, null).includes("indian-chef") &&
      chefsFor(noIndian, 52, null).length === 0 &&
      chefsFor(noIndian, 52, "indian").includes("indian-chef"),
    "S5: a specialist is needed for the cuisines actually cooked (active menu or the level's own tickets)",
  );
  const hired = hireSpecialist(saveAt(51), "indian-chef", 51);
  assert(
    hired.ok &&
      hired.save.credits === saveAt(51).credits &&
      hired.save.economyLedger.length === 0 &&
      restaurantStaffOf(hired.save).specialists.join() === "indian-chef" &&
      !hireSpecialist(saveAt(50), "indian-chef", 50).ok &&
      !hireSpecialist(saveAt(60), "nope", 60).ok &&
      fireSpecialist(hired.save, "indian-chef").business.restaurantStaff?.specialists.length === 0,
    "S6: hiring a specialist is free (no money, no ledger), only once its cuisine opened; letting go works",
  );
  const lvl = getLevel("level-52")!;
  const plan = servicePlanFor(openDay(saveAt(52), 52), lvl)!;
  const planHired = servicePlanFor(
    openDay(
      withRoles(
        hireSpecialist(saveAt(52), "indian-chef", 52).ok
          ? (hireSpecialist(saveAt(52), "indian-chef", 52) as { save: SaveData }).save
          : saveAt(52),
        ["prep-cook", "server"],
      ),
      52,
    ),
    lvl,
  )!;
  assert(
    !staffReady(plan) &&
      servicePlanNeedsSheet(plan) &&
      plan.staff.every((r) => r.why.length > 20) &&
      staffReady(planHired),
    "S7: an unmet requirement opens the check, says why, and blocks START until hired",
  );
  assert(
    staffComingUp(46).some((s) => s.title === "Indian Chef" && s.level === 51) &&
      staffComingUp(36).some((s) => s.title === "Prep Cook" && s.level === 41) &&
      staffComingUp(35).every((s) => s.level - 35 <= 5) &&
      staffComingUp(46).every((s) => s.level > 46),
    "S8: staff and specialists are announced 5 levels before they are needed",
  );
  assert(
    SPECIALIST_CHEFS.map((c) => `${c.id}@${c.firstLevel}`).join() ===
      "indian-chef@51,mediterranean-chef@71,mexican-chef@81,asian-chef@101" &&
      SPECIALIST_CHEFS.every((c) => c.dailyWage === BUSINESS_STAFF_CATALOG["line-cook"].salary),
    "S9: four specialist chefs, each from its cuisine's chapter; wage = the Line Cook's existing figure (not balanced)",
  );
}

console.log("P. Specialist pay");
{
  const withChef = (n: number, credits: number) =>
    (hireSpecialist(saveAt(n, credits), "indian-chef", n) as { ok: true; save: SaveData }).save;
  const wage = getSpecialist("indian-chef")!.dailyWage;
  const early = paySpecialists(withChef(60, 10_000), 60);
  assert(
    early.paid === 0 && early.save.credits === 10_000,
    "P1: no wages before full operation (L91)",
  );
  const s = withChef(95, 10_000);
  const p = paySpecialists(s, 95);
  const entries = p.save.economyLedger.slice(s.economyLedger.length);
  assert(
    p.paid === wage &&
      p.save.credits === 10_000 - wage &&
      entries.length === 1 &&
      entries[0]!.category === "business-staff-salary" &&
      entries[0]!.amount === -wage &&
      entries[0]!.description === "indian-chef",
    "P2: from L91 each chef's wage is paid at closing with one business-staff-salary entry",
  );
  const poor = paySpecialists(withChef(95, wage - 1), 95);
  assert(
    poor.paid === 0 &&
      poor.save.credits === wage - 1 &&
      poor.laidOff.join() === "indian-chef" &&
      restaurantStaffOf(poor.save).specialists.length === 0,
    "P3: a wallet that can't cover the wages lets the chefs go — never debt",
  );
}

console.log("E. Closing from L91: End Business Day in the ledger");
{
  let s = withRoles(saveAt(95, 100_000), ["prep-cook", "cleaner"]);
  s = (hireSpecialist(s, "indian-chef", 95) as { ok: true; save: SaveData }).save;
  s = openDay(s, 95);
  // The day's services (4 at L95 since 2026-10-10).
  for (let i = 0; i < servicesForDayAt(95).length; i++) s = recordService(s, 95);
  const opening = s.credits;
  const before = s.economyLedger.length;
  const closed = closeDay(s, 95);
  const added = closed.economyLedger.slice(before);
  const signed = added.reduce((n, e) => n + e.amount, 0);
  const payroll = endBusinessDay(s).payrollPaid;
  assert(
    payroll > 0 &&
      added.some((e) => e.category === "business-staff-salary" && e.amount === -payroll) &&
      added.some((e) => e.description === "indian-chef") &&
      opening + signed === closed.credits,
    "E1: payroll and the chef's wage are in the ledger; opening cash + signed ledger = closing cash",
  );
}

console.log("B. Bulk buying");
{
  assert(
    BULK_PRESETS.join() === "5,25,50,100" &&
      bulkDiscountFor(5) === 0 &&
      bulkDiscountFor(25) === BULK_DISCOUNTS[0]!.discount &&
      bulkDiscountFor(99) === BULK_DISCOUNTS[1]!.discount &&
      bulkDiscountFor(100) === BULK_DISCOUNTS[2]!.discount &&
      BULK_DISCOUNTS.every((t, i) => i === 0 || t.discount > BULK_DISCOUNTS[i - 1]!.discount),
    "B1: presets 5/25/50/100; the discount grows with the tier (configurable)",
  );
  const s = {
    ...saveAt(30, 1_000_000),
    business: {
      ...saveAt(30, 1_000_000).business,
      refrigerator: { refrigeratorId: "professional-refrigerator" },
    },
  };
  const classic = purchaseQuote(s, "tomato", 50);
  const bulk = purchaseQuote(s, "tomato", 50, bulkDiscountFor(50));
  const bought = purchaseIngredient(s, "tomato", 50, bulkDiscountFor(50));
  assert(
    classic.bulkDiscount === 0 &&
      classic.listTotal === classic.totalCost &&
      bulk.totalCost === 50 * discountedUnitCost(classic.unitCost, bulkDiscountFor(50)) &&
      bulk.totalCost < classic.totalCost &&
      bought.ok &&
      bought.totalCost === bulk.totalCost &&
      bought.save.credits === s.credits - bulk.totalCost,
    "B2: ingredients — the quote and the purchase agree; the classic price (no discount) is unchanged",
  );
  const napkins = getSupplyItem("paper-napkins")!;
  const q = supplyQuote(s, napkins, 100, bulkDiscountFor(100));
  const sup = purchaseSupply(s, "paper-napkins", 100, {
    discount: bulkDiscountFor(100),
    maxPacks: BULK_MAX_PACKS,
  });
  assert(
    sup.ok &&
      sup.totalCost === q.totalCost &&
      q.packPrice === discountedUnitCost(supplyPackPrice(napkins), bulkDiscountFor(100)) &&
      !purchaseSupply(s, "paper-napkins", 100).ok &&
      MAX_SUPPLY_PACKS === 99 &&
      purchaseSupply(s, "paper-napkins", 1).ok &&
      (purchaseSupply(s, "paper-napkins", 1) as { totalCost: number }).totalCost ===
        supplyPackPrice(napkins),
    "B3: supplies — 100 packs only with the restaurant's wholesale limit; the classic purchase is unchanged",
  );
  assert(
    !purchaseIngredient(s, "tomato", 5, 1).ok &&
      !purchaseSupply(s, "paper-napkins", 1, { discount: -0.1, maxPacks: 100 }).ok,
    "B4: a discount outside 0–<1 is refused (no free or negative prices)",
  );
  const app = read("src/App.tsx");
  assert(
    // Ingredients: only the restaurant build's known ingredients get a tier, chosen by the stock bought (deep check 2026-10-09).
    /const id = RESTAURANT_MODE && isKnownIngredient\(ingredientId\) \? ingredientId : null;/.test(
      app,
    ) &&
      /id \? ingredientBulkDiscount\(id, quantity, measureOf\(save\)\) : 0/.test(app) &&
      /RESTAURANT_MODE && item && isConsumableSupply\(item\)/.test(app) &&
      (app.match(/"supply-packaging-purchase" : "supply-equipment-purchase"/g) ?? []).length === 1,
    "B5: App applies the discount only in the restaurant build, consumable supplies only; still one ledger entry per purchase",
  );
}

console.log("I. Inventory: restaurant Needs Attention");
{
  const n = 35;
  let s = openDay(saveAt(n), n);
  s = {
    ...s,
    business: {
      ...s.business,
      supplies: {
        ...s.business.supplies,
        stock: {
          "dinner-plates": { units: 12, costBasis: 0 },
          "dinner-forks": { units: 12, costBasis: 0 },
          "dinner-knives": { units: 12, costBasis: 0 },
          "paper-napkins": { units: 2, costBasis: 0 },
        },
      },
      restaurantSupplies: { soapPct: 20, cleanerPct: 10, washing: 0 },
    },
  };
  const a = restaurantAttention(s);
  const plan = servicePlanFor(s, getLevel(`level-${n}`)!)!;
  const ids = a.rows.map((r) => r.id);
  assert(
    a.nextLevel === n &&
      plan.check.applies &&
      plan.check.missingRows.every((r) => ids.includes(`ingredient:${r.ingredientId}`)) &&
      a.rows
        // The level's own orders; the menu guests' optional rows are "guest:" (restaurant-guests-qa K4).
        .filter((r) => r.id.startsWith("ingredient:"))
        .every((r) => /remaining \(Level 35 needs/.test(r.text)),
    "I1: the next service's missing ingredients, worded 'X — N remaining (Level L needs M)'",
  );
  const soap = a.rows.find((r) => r.id === "bottle:dish-soap");
  const cleaner = a.rows.find((r) => r.id === "bottle:cleaning-liquid");
  assert(
    /^Dish soap — ~4 washes remaining$/.test(soap?.text ?? "") &&
      /^Cleaning liquid — ~1 closing remaining$/.test(cleaner?.text ?? "") &&
      /^Napkins — \d+ remaining/.test(
        a.rows.find((r) => r.id === "supply:paper-napkins")?.text ?? "",
      ),
    "I2: napkins, dish soap (~N washes) and cleaning liquid (~N closings) appear with the developer's wording",
  );
  assert(
    a.rows.findIndex((r) => r.severity === "low") >
      a.rows.map((r) => r.severity).lastIndexOf("urgent") &&
      a.recommendedCost ===
        (plan.check.applies
          ? plan.check.missingRows.reduce((t, r) => t + (r.quote?.totalCost ?? 0), 0)
          : 0) +
          (plan.supplies.applies ? plan.supplies.rows.reduce((t, r) => t + r.cost, 0) : 0),
    "I3: urgent first; the recommended restock is exactly what the next check would ask to buy",
  );
  const before = JSON.stringify(s);
  restaurantAttention(s);
  assert(JSON.stringify(s) === before, "I4: read-only — the save is untouched");
  const panel = read("src/components/kc/inventory/RestaurantAttentionPanel.tsx");
  assert(
    !/purchase|persist|appendLedgerEntry|credits\s*[-+]/.test(panel) &&
      /openMarketIngredients\(go, t\.id, t\.quantity\)/.test(panel) &&
      /RESTAURANT_MODE \? <RestaurantAttentionPanel/.test(
        read("src/components/kc/inventory/InventoryScreen.tsx"),
      ),
    "I5: the panel only navigates (Market, Equipment, Staff) and shows only in the restaurant build",
  );
}

console.log("F. Fridge");
{
  assert(
    getRefrigeratorCapacity("basic-refrigerator") === 40 &&
      getRefrigeratorCapacity("commercial-refrigerator") === 80 &&
      getRefrigeratorCapacity("professional-refrigerator") === 140,
    "F1: the fridge tiers are unchanged — Basic 40, Commercial 80, Professional 140",
  );
  const fill = (q: number) => {
    const s = saveAt(30);
    return {
      ...s,
      business: { ...s.business, inventory: addStock(s.business.inventory, "tomato", q, 100, 1) },
    };
  };
  assert(
    fridgeUsage(fill(33)).status === "ok" &&
      fridgeUsage(fill(34)).status === "nearly-full" &&
      fridgeUsage(fill(40)).status === "full" &&
      FRIDGE_NEARLY_FULL === 0.85 &&
      restaurantAttention(fill(40)).rows.some((r) => r.id === "fridge" && r.severity === "urgent"),
    "F2: nearly full at 85% (34/40), full at 40/40 — an urgent Inventory row",
  );
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  assert(
    /fridge=\{isSystemLive\("fridge-freshness", n\) \? fridgeUsage\(save\) : null\}/.test(layer),
    "F3: the Pre-Service Check shows the fridge warning from the fridge stage (L21)",
  );
}

console.log("N. One restaurant before L250, Endless Restaurant after");
{
  const done = saveAt(250);
  const finished = {
    ...done.levelProgress,
    completedLevelIds: Array.from({ length: 250 }, (_, i) => `level-${i + 1}`),
  };
  assert(
    !businessDayAllowed(true, saveAt(249).levelProgress) &&
      !businessDayAllowed(true, done.levelProgress) &&
      businessDayAllowed(true, finished) &&
      businessDayAllowed(false, saveAt(5).levelProgress),
    "N1: no separate Business Day before Level 250 in the restaurant build; the Endless Restaurant after; the classic game unchanged",
  );
  const app = read("src/App.tsx");
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /s === "business-service" &&\s*saveRef\.current &&\s*!businessDayAllowed\(RESTAURANT_MODE, saveRef\.current\.levelProgress\)/.test(
      app,
    ) &&
      /if \(!businessDayAllowed\(RESTAURANT_MODE, save\.levelProgress\)\) return;/.test(app) &&
      /businessDayAllowed\(RESTAURANT_MODE, save\.levelProgress\) \? \(\s*<>\s*<BusinessDayCard/.test(
        dash,
      ) &&
      /<OneRestaurantNote \/>/.test(dash) &&
      /go\(RESTAURANT_MODE \? "business" : "endless"\)/.test(kitchen) &&
      /label: RESTAURANT_MODE \? "Restaurant" : "Business"/.test(kitchen),
    "N2: wiring — the service route and start refuse, the dashboard shows the one-restaurant note, the Kitchen tile and tab say Restaurant",
  );
}

console.log("L. Saves");
{
  let s = (hireSpecialist(saveAt(60), "indian-chef", 60) as { ok: true; save: SaveData }).save;
  await SaveManager.save(s);
  const back = await SaveManager.load();
  const old = saveAt(60);
  delete (old.business as { restaurantStaff?: unknown }).restaurantStaff;
  const junk = {
    ...old,
    business: {
      ...old.business,
      restaurantStaff: { specialists: ["x", "indian-chef", "indian-chef"] },
    },
  } as SaveData;
  assert(
    restaurantStaffOf(back).specialists.join() === "indian-chef" &&
      restaurantStaffOf(old).specialists.length === 0 &&
      restaurantStaffOf(junk).specialists.join() === "indian-chef",
    "L1: specialists survive the real save/load; old saves have none; unknown or doubled ids are dropped",
  );
  s = saveAt(60);
}

console.log("W. The switch");
{
  const mods = [
    "staffRequirements",
    "bulkBuying",
    "restaurantAttention",
    "fridgeUsage",
    "endlessRestaurant",
    "restaurantNews",
  ].map((m) => read(`src/game/restaurant/${m}.ts`).replace(/\/\*[\s\S]*?\*\//g, ""));
  assert(
    mods.every((m) => !/RESTAURANT_MODE/.test(m) && !/Math\.random/.test(m)),
    "W1: the new restaurant modules never read the switch and are deterministic",
  );
  assert(
    read("src/game/config/restaurantMode.ts").includes(
      'import.meta.env.VITE_RESTAURANT_MODE !== "0"',
    ),
    // Developer decision 2026-10-08: the restaurant is the game — on in every build.
    "W2: still one build switch, ON unless VITE_RESTAURANT_MODE=0 (the classic build)",
  );
}

console.log("H. Hiring from the Pre-Service Check (developer 2026-10-09)");
{
  const check = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  const staff = read("src/components/kc/business/BusinessStaff.tsx");
  assert(
    /data-testid="psc-staff-needed"/.test(check) &&
      /This service needs: \{staffMissing\.map\(\(r\) => r\.title\)/.test(check) &&
      /!canStart && !stockOrSuppliesShort && staffMissing\.length > 0/.test(check) &&
      /Hire \{staffMissing\.map\(\(r\) => r\.title\)\.join\(" & "\)\} →/.test(check) &&
      /openStaffFor\(\s*go,\s*plan\.staff\.filter\(\(r\) => !r\.met\)/.test(layer) &&
      /peekStaffFocus\(\)/.test(staff) &&
      /data-staff-needed/.test(staff) &&
      /Needed now/.test(staff) &&
      /isSystemLive\("full-operation"/.test(staff) &&
      /data-testid="staff-free-until"/.test(staff),
    "H1: the check names the missing staff at the top and its footer hires them; Staff opens on the Restaurant Team with them marked; wages read 'free until Level 91' before full operation",
  );
}

console.log(
  failures
    ? `RESTAURANT PROGRESSION QA: ${failures} FAILURE(S)`
    : "RESTAURANT PROGRESSION QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
