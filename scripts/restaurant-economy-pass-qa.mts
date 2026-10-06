/**
 * RESTAURANT ECONOMY PASS QA — the Unified Restaurant economy pass
 * (docs/ECONOMY_TODO.md), restaurant build only.
 *
 *  P. P0 — no double food cost (restaurant/restaurantEconomy.ts): a campaign
 *     order pays recipe earnings + quality bonus; the food is the real stock
 *     bought in the Market. The quality bonus and its equipment / helper
 *     boosts stay; no INGREDIENT_COGS transaction; the release build's
 *     settlement is unchanged.
 *  T. The target (Economy V2.5, approved): a completionist who buys
 *     everything finishes Level 250 owning it all with $100k–$150k. Measured
 *     with the full restaurant simulation (restaurantCampaignSim.mts): with
 *     P0 it lands in the band; with the double charge it fell below.
 *  S. Safety: the completionist's run has no soft-lock, money never < 0,
 *     opening cash + ledger = cash at every level.
 *  W. Wiring: App applies P0 to both campaign serve paths only under
 *     RESTAURANT_MODE; the result screen says the food came from stock.
 *  I. Information (not asserted — open decisions): the Endless Restaurant's
 *     daily profit after L250.
 *
 * Run: npx tsx scripts/restaurant-economy-pass-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { run, freshRestaurantSave, $ } from "./restaurantCampaignSim.mts";
import { missingPurchases, playBusinessDay } from "./economy-v25-simulation.mts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import {
  foodFromStock,
  restaurantQuote,
  restaurantSettlement,
  SUPPLIER_EFFECTS,
  stockUseFor,
  supplierEffects,
  supplierPriceFactor,
} from "../src/game/restaurant/restaurantEconomy.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getEquipmentModifier } from "../src/game/economy/equipmentSpecialization.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import {
  consumeCampaignOrderStock,
  orderRequirements,
  serviceStockCheck,
} from "../src/game/restaurant/campaignStock.ts";
import {
  purchaseIngredient,
  purchaseQuote,
} from "../src/game/business/BusinessInventoryManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { shelfLifeForIngredient, usableQuantity } from "../src/game/business/perishability.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

console.log("P. P0 — no double food cost");
{
  const recipe = CAMPAIGN_RECIPES[0]!;
  const base = computeSettlement(recipe, 3, 92);
  const withKnife = computeSettlement(recipe, 3, 92, "santoku", "maple");
  const r = restaurantSettlement(base);
  const rk = restaurantSettlement(withKnife);
  assert(
    base.finalCOGS > 0 &&
      r.finalCOGS === 0 &&
      r.netResult === base.revenue + base.qualityBonus &&
      r.revenue === base.revenue &&
      r.qualityBonus === base.qualityBonus &&
      !r.transactions.some((t) => t.type === "INGREDIENT_COGS") &&
      foodFromStock(r) &&
      !foodFromStock(base),
    `P1: an order pays earnings + quality bonus (${$(base.revenue + base.qualityBonus)} instead of ${$(base.netResult)}); no built-in food cost`,
  );
  assert(
    rk.qualityBonus === withKnife.qualityBonus &&
      rk.netResult === withKnife.revenue + withKnife.qualityBonus,
    "P2: equipment / helper boosts to the quality bonus still count",
  );
  assert(
    JSON.stringify(computeSettlement(recipe, 3, 92)).length > 0 &&
      base.netResult === Math.max(0, base.revenue - base.finalCOGS + base.qualityBonus),
    "P3: the release settlement (EconomySettlement) is unchanged — economy-v2-final-qa guards its baseline",
  );
}

console.log('X. Item effects on real stock (developer: "move to real stock")');
{
  const base = { ...structuredClone(DEFAULT_SAVE), credits: 1_000_000 } as SaveData;
  const veg = CAMPAIGN_RECIPES.find(
    (r) => getEquipmentModifier("santoku", "walnut", r).cogsReductionPct > 0,
  )!;
  const plain = stockUseFor(base, veg);
  const knife = stockUseFor({ ...base, equippedKnifeId: "santoku" }, veg);
  const helper = stockUseFor({ ...base, ownedStaffIds: ["prep-assistant"] }, veg);
  const dull = stockUseFor(
    { ...base, knifeSharpness: { ...base.knifeSharpness, [base.equippedKnifeId]: 0 } },
    veg,
  );
  assert(
    plain.factor === 1 &&
      Math.abs(
        knife.factor - (1 - getEquipmentModifier("santoku", "walnut", veg).cogsReductionPct),
      ) < 1e-9 &&
      Math.abs(helper.factor - 0.97) < 1e-9 &&
      Math.abs(dull.factor - 1.05) < 1e-9 &&
      dull.floor === 1,
    `X1: the same percentages now scale the stock an order uses — knife ${knife.factor.toFixed(2)}, Prep Assistant ${helper.factor.toFixed(2)}, a dull knife ${dull.factor.toFixed(2)} (floor ${dull.floor})`,
  );
  const n = 40;
  const stocked = (save: SaveData) => {
    let inv = save.business.inventory;
    for (const c of veg.components) inv = addStock(inv, c.ingredientId, 5, 100, 1);
    return { ...save, business: { ...save.business, inventory: inv } };
  };
  const used = (save: SaveData) => {
    const r = consumeCampaignOrderStock(stocked(save), n, veg, true);
    if (!r.ok) return Infinity;
    return r.requirements.reduce((t, q) => t + q.quantity, 0);
  };
  const santokuSave = { ...base, equippedKnifeId: "santoku", ownedKnifeIds: ["chef", "santoku"] };
  const plannedNeed = (save: SaveData) => {
    const c = serviceStockCheck(save, n, [veg]);
    return c.applies ? c.rows.reduce((t, r) => t + r.needed, 0) : -1;
  };
  assert(
    used(santokuSave) < used(base) &&
      Math.abs(plannedNeed(santokuSave) - used(santokuSave)) < 1e-6 &&
      Math.abs(plannedNeed(base) - used(base)) < 1e-6,
    "X2: a better knife uses less real stock, and the Pre-Service Check plans exactly what the serve uses",
  );
  // The knife dulls during a service: a serve never blocks while the floor is in stock.
  const planned = orderRequirements(base, veg);
  let tight = base;
  for (const r of planned)
    tight = {
      ...tight,
      business: {
        ...tight.business,
        inventory: addStock(tight.business.inventory, r.ingredientId, r.quantity, 100, 1),
      },
    };
  const dulled = {
    ...tight,
    knifeSharpness: { ...tight.knifeSharpness, [tight.equippedKnifeId]: 0 },
  };
  const served = consumeCampaignOrderStock(dulled, n, veg, true);
  assert(
    served.ok,
    "X3: a knife that dulled after the check never blocks a serve — the extra waste comes only from stock that's there",
  );
  const local = restaurantQuote(base, "tomato", 10);
  const wholesale = restaurantQuote(
    { ...base, selectedSupplierId: "wholesale-supplier" },
    "tomato",
    10,
  );
  const premium = restaurantQuote(
    { ...base, selectedSupplierId: "premium-supplier" },
    "tomato",
    10,
  );
  const bought = purchaseIngredient(
    { ...base, selectedSupplierId: "wholesale-supplier" },
    "tomato",
    10,
    0,
    supplierPriceFactor({ ...base, selectedSupplierId: "wholesale-supplier" }),
  );
  assert(
    wholesale.unitCost === Math.round(local.unitCost * 0.9) &&
      premium.unitCost === Math.round(local.unitCost * 1.1) &&
      bought.ok &&
      bought.totalCost === wholesale.totalCost &&
      purchaseQuote(base, "tomato", 10).unitCost === local.unitCost,
    `X4: the Campaign Supplier now sets Market prices — tomato ${$(local.unitCost)} local, ${$(wholesale.unitCost)} wholesale, ${$(premium.unitCost)} premium; the purchase charges the quote; the classic quote is unchanged`,
  );
  const app = read("src/App.tsx");
  const market = read("src/components/kc/MarketIngredients.tsx");
  assert(
    /RESTAURANT_MODE \? supplierPriceFactor\(save\) : 1/.test(app) &&
      /RESTAURANT_MODE \? restaurantQuote\(save, id, quantity\) : purchaseQuote\(save, id, quantity\)/.test(
        market,
      ),
    "X5: the Market card and the purchase use the same restaurant price, only in the restaurant build",
  );
}

console.log(
  "Y. Supplier effects beyond price (developer 2026-10-06: keep Premium — provisional values)",
);
{
  const recipe = CAMPAIGN_RECIPES[0]!;
  const base = computeSettlement(recipe, 3, 92);
  const local = restaurantSettlement(base);
  const premium = restaurantSettlement(
    base,
    supplierEffects({ ...DEFAULT_SAVE, selectedSupplierId: "premium-supplier" } as SaveData)
      .qualityBonusPct,
  );
  const extra = Math.round(base.revenue * SUPPLIER_EFFECTS["premium-supplier"]!.qualityBonusPct);
  assert(
    JSON.stringify(restaurantSettlement(base, 0)) === JSON.stringify(local) &&
      premium.qualityBonus === local.qualityBonus + extra &&
      premium.netResult === local.netResult + extra &&
      premium.transactions.reduce((t, x) => t + x.amount, 0) ===
        local.transactions.reduce((t, x) => t + x.amount, 0) + extra &&
      extra > 0,
    `Y1: Premium adds a small quality bonus (+${extra}¢ on a ${base.revenue}¢ order); Local / Wholesale add nothing`,
  );
  const wholesale = supplierEffects({
    ...DEFAULT_SAVE,
    selectedSupplierId: "wholesale-supplier",
  } as SaveData);
  const localFx = supplierEffects(DEFAULT_SAVE as SaveData);
  assert(
    wholesale.freshnessBonusDays === 0 &&
      wholesale.qualityBonusPct === 0 &&
      localFx.freshnessBonusDays === 0 &&
      localFx.qualityBonusPct === 0 &&
      SUPPLIER_EFFECTS["premium-supplier"]!.freshnessBonusDays > 0,
    "Y2: only Premium has extras; Wholesale stays the cheapest, Local the balanced baseline",
  );
  const shop = { ...structuredClone(DEFAULT_SAVE), credits: 1_000_000 } as SaveData;
  const day = shop.business.calendar.businessDay;
  const plain = purchaseIngredient(shop, "basil", 2);
  const fresh = purchaseIngredient(
    shop,
    "basil",
    2,
    0,
    1,
    SUPPLIER_EFFECTS["premium-supplier"]!.freshnessBonusDays,
  );
  const shelf = shelfLifeForIngredient("basil");
  const lastUsable = (s: SaveData) => {
    let d = day;
    while (usableQuantity(s.business.inventory, "basil", d) > 0 && d < day + 60) d++;
    return d - 1;
  };
  assert(
    plain.ok &&
      fresh.ok &&
      plain.totalCost === fresh.totalCost &&
      lastUsable(fresh.save) ===
        lastUsable(plain.save) + SUPPLIER_EFFECTS["premium-supplier"]!.freshnessBonusDays &&
      lastUsable(plain.save) === day + shelf - 1,
    `Y3: Premium stock stays usable ${SUPPLIER_EFFECTS["premium-supplier"]!.freshnessBonusDays} day longer at the same price (through the existing perishability rules)`,
  );
  assert(
    !purchaseIngredient(shop, "basil", 2, 0, 1, -1).ok &&
      !purchaseIngredient(shop, "basil", 2, 0, 1, 0.5).ok,
    "Y4: a bad freshness bonus is refused (the purchase stays all-or-nothing)",
  );
  const app = read("src/App.tsx");
  assert(
    /RESTAURANT_MODE \? supplierEffects\(save\)\.freshnessBonusDays : 0/.test(app),
    "Y5: the purchase passes Premium's freshness only in the restaurant build (release purchases unchanged)",
  );
}

console.log("T. The approved target, measured with the full restaurant simulation");
const after = run(
  "completionist (economy pass)",
  freshRestaurantSave(),
  1,
  { profile: "completionist" },
  false,
);
const before = run(
  "completionist (double food cost)",
  freshRestaurantSave(),
  1,
  { profile: "completionist", legacyFoodCost: true },
  false,
);
console.log(
  `    completionist at L250: ${$(before.s.credits)} with the double charge → ${$(after.s.credits)} after the pass (final economy target: ≥ $150,000, preferred $160k–$175k — docs/ECONOMY_FINAL.md)`,
);
{
  assert(
    missingPurchases(after.s).length === 0 && after.stats.levels === 250,
    "T1: the completionist owns everything at Level 250",
  );
  assert(
    after.s.credits >= 150_000_00,
    // The final economy pass (2026-10-06) replaced the $100k–$150k band with a ≥ $150k floor.
    `T2: and finishes with ${$(after.s.credits)} — at or above the approved $150,000 floor`,
  );
  assert(
    before.s.credits < 150_000_00 && after.s.credits > before.s.credits,
    `T3: the double charge leaves it below the floor (${$(before.s.credits)}); P0 fixes that`,
  );
}

console.log("S. Safety");
assert(
  after.stats.blocked.length === 0 && after.stats.invariant.length === 0,
  `S1: no soft-lock; money never < 0; cash = ledger at every level ${[...after.stats.blocked, ...after.stats.invariant].slice(0, 2).join(" | ")}`,
);

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    (
      app.match(
        /computed && RESTAURANT_MODE\s*\?\s*restaurantSettlement\(computed, save \? restaurantQualityBonusPct\(save\) : 0, \{[\s\S]*?\}\)\s*:\s*computed/g,
      ) ?? []
    ).length === 2,
    "W1: both campaign serve paths apply P0, only under RESTAURANT_MODE",
  );
  const ui = read("src/components/kc/game/ServiceOrderComplete.tsx");
  assert(
    /foodFromStock\(settlement\)/.test(ui) && /Ingredients · from your stock/.test(ui),
    "W2: the result screen says the food came from your stock instead of a food-cost line",
  );
  const mod = read("src/game/restaurant/restaurantEconomy.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/RESTAURANT_MODE|Math\.random/.test(mod), "W3: the module never reads the switch");
}

console.log("I. Information — the Endless Restaurant after L250 (open decision)");
{
  for (const [label, save] of [
    ["with the team the campaign required", after.s],
    ["with no staff", { ...after.s, business: { ...after.s.business, staff: { hiredRoles: [] } } }],
  ] as const) {
    let s = save;
    for (let d = 0; d < 14; d++) s = playBusinessDay(s).save;
    console.log(`    14 days ${label}: ${$((s.credits - save.credits) / 14)}/day`);
  }
}

console.log(
  failures
    ? `RESTAURANT ECONOMY PASS QA: ${failures} FAILURE(S)`
    : "RESTAURANT ECONOMY PASS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
