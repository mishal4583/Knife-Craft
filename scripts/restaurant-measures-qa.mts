/**
 * RESTAURANT MEASURES QA — the developer's 2026-10-08 brief (restaurant build):
 *
 *  M. Realistic portions (business/ingredientMeasures.ts): every one of the 57
 *     ingredients has a piece weight and a plate serving; a tomato is 0.3 lb
 *     (more than 3 to the lb); one serving per PHYSICAL item prepared (peel →
 *     halve → slice of one onion is one onion); menu prices unchanged.
 *  U. Units (business/measure.ts): lb ↔ kg conversions, labels ("loaf",
 *     "bunch"), amounts ("0.6 lb", "0.27 kg"), item counts ("≈ 3 tomatoes"),
 *     whole Market units that cover a shortfall.
 *  K. Kilograms in the Market: 1 kg of tomato costs the per-lb price × 2.20462
 *     (whole cents), adds 2.205 lb, keeps the whole-unit gate (1.5 kg refused,
 *     piece goods can't be bought by the kg); the Pre-Service Check's Restock
 *     counts kg; the setting is optional (old saves = lb) and survives a load.
 *  Q. Quick Restock (restaurant/quickRestock.ts): exactly the missing stock,
 *     today's Market price + 25 %, the extra shown; all-or-nothing on money
 *     and fridge; afterwards the check is ready.
 *  P. Market plan (restaurant/marketPlan.ts): today's services first, then the
 *     next days; never more than the fridge holds; nothing bought to spoil;
 *     buying the plan makes the next service ready; Endless uses menu demand.
 *  W. Wiring: App records Quick Restock and "Buy all" with one ledger entry
 *     per ingredient; Settings shows Weights only in the restaurant build;
 *     the Kitchen shows the restaurant rank; Prepare and Replay differ.
 *
 * Run: npx tsx scripts/restaurant-measures-qa.mts
 */
// Minimal localStorage shim so section K can exercise the REAL SaveManager.load().
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { levelPayPreview } from "../src/game/restaurant/levelPayPreview.ts";
import { hasBoughtIngredients } from "../src/game/restaurant/firstRestock.ts";
import { getSupplyItem, packsText } from "../src/game/business/businessSupplies.ts";
import { recipePay } from "../src/game/recipes/recipePay.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import { dollars } from "../src/game/money.ts";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import { INGREDIENTS, type IngredientId } from "../src/game/definitions.ts";
import { CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { INGREDIENT_MEASURES } from "../src/game/business/ingredientMeasures.ts";
import {
  LB_PER_KG,
  formatStockAmount,
  itemCountText,
  marketUnitCountText,
  marketUnitLabel,
  marketUnitsCovering,
  measureOf,
  lbPerMarketUnit,
  marketStep,
  soldWhole,
  stepMarketQuantity,
  WEIGHED_MARKET_STEP,
} from "../src/game/business/measure.ts";
import { recipeRequirements } from "../src/game/restaurant/recipeRequirements.ts";
import { defaultMenuPrice } from "../src/game/business/businessMenu.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { recipePortionFractionFor } from "../src/game/business/businessPortionModel.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import {
  purchaseIngredient,
  purchaseQuote,
} from "../src/game/business/BusinessInventoryManager.ts";
import { restaurantQuote } from "../src/game/restaurant/restaurantEconomy.ts";
import { serviceStockCheck } from "../src/game/restaurant/campaignStock.ts";
import { servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
import { ticketsFor } from "../src/game/restaurant/serviceTickets.ts";
import {
  QUICK_RESTOCK_FEE,
  quickRestock,
  quickRestockPlan,
} from "../src/game/restaurant/quickRestock.ts";
import { marketPlanFor } from "../src/game/restaurant/marketPlan.ts";
import { shelfLifeForIngredient } from "../src/game/business/perishability.ts";
import { getAvailableStorageCapacity } from "../src/game/business/RefrigeratorManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const progressAt = (n: number): LevelProgress => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number, extra: Partial<SaveData> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: progressAt(n),
  business: { ...DEFAULT_SAVE.business, inventory: {} },
  ...extra,
});
const kg = (s: SaveData): SaveData => ({ ...s, settings: { ...s.settings, measure: "kg" } });
/** The level's own service check (its tickets, rolled and saved like App does). */
const checkAt = (s: SaveData, n: number) => {
  const level = getLevel(`level-${n}`)!;
  const { tickets, progress } = ticketsFor(s.levelProgress, level);
  const saved = { ...s, levelProgress: progress };
  return { save: saved, check: serviceStockCheck(saved, n, tickets) };
};

console.log("M. Realistic portions");
{
  const ids = Object.keys(INGREDIENTS) as IngredientId[];
  assert(
    ids.length === 57 &&
      ids.every((id) => {
        const m = INGREDIENT_MEASURES[id];
        return !!m && m.pieceLb > 0 && m.serving > 0 && m.noun.length > 0 && m.plural.length > 0;
      }),
    "M1: all 57 ingredients have a piece weight, a plate serving and a name for one item",
  );
  assert(
    INGREDIENT_MEASURES.tomato.pieceLb === 0.3 && 1 / INGREDIENT_MEASURES.tomato.pieceLb > 3,
    "M2: a tomato weighs 0.3 lb — more than 3 tomatoes to the pound",
  );
  const chain = getCampaignRecipe("camp-onion-prep-chain")!;
  const bread = getCampaignRecipe("camp-garlic-bread")!;
  assert(
    recipeRequirements(chain).length === 1 &&
      recipeRequirements(chain)[0]!.quantity === INGREDIENT_MEASURES.onion.serving &&
      recipeRequirements(bread)
        .map((r) => `${r.ingredientId}:${r.quantity}`)
        .join() === "bread:0.25,garlic:0.025",
    "M3: one onion peeled, halved and sliced uses one onion (0.35 lb, not 3 lb); Garlic Bread uses a quarter loaf and 0.025 lb of garlic",
  );
  // Weighed servings never exceed the old pound a step, so a plate never costs more food than before.
  assert(
    CAMPAIGN_RECIPES.every((r) =>
      recipeRequirements(r).every((q) => q.quantity <= 1 && q.quantity > 0),
    ),
    "M4: no prepared item uses more than one purchase unit (a plate never uses more food than before)",
  );
  assert(
    CAMPAIGN_RECIPES.every(
      (r) =>
        defaultMenuPrice(r) ===
        Math.max(
          1,
          Math.round(
            r.components.reduce(
              (t, c) =>
                t +
                Math.round(
                  businessUnitCostFor(c.ingredientId) * recipePortionFractionFor(c.ingredientId),
                ),
              0,
            ) / 0.3,
          ),
        ),
    ),
    "M5: every menu price is unchanged (the Economy V3 calibration)",
  );
}

console.log("U. Units");
{
  assert(
    formatStockAmount("tomato", 0.6, "lb") === "0.6 lb" &&
      formatStockAmount("tomato", 0.6, "kg") === "0.27 kg" &&
      formatStockAmount("bread", 0.25, "kg") === "0.25 loaves" &&
      formatStockAmount("bread", 1, "lb") === "1 loaf" &&
      formatStockAmount("basil", 0.25, "lb") === "0.25 bunches",
    "U1: amounts read in the chosen measure; loaves and bunches stay pieces",
  );
  assert(
    itemCountText("tomato", 1) === "≈ 3 tomatoes" &&
      itemCountText("tomato", 0.3) === "≈ 1 tomato" &&
      itemCountText("pumpkin", 2) === "≈ ½ pumpkin" &&
      itemCountText("bread", 1) === null &&
      marketUnitCountText("tomato", "lb") === "1 lb ≈ 3 tomatoes" &&
      marketUnitCountText("tomato", "kg") === "1 kg ≈ 7 tomatoes",
    "U2: item counts — 1 lb ≈ 3 tomatoes, 1 kg ≈ 7, 2 lb ≈ ½ pumpkin; piece goods need none",
  );
  assert(
    marketUnitLabel("tomato", "kg") === "kg" &&
      marketUnitLabel("bread", "kg", 2) === "loaves" &&
      marketUnitsCovering("tomato", 0.6, "lb") === 0.75 &&
      marketUnitsCovering("garlic", 0.05, "lb") === 0.25 &&
      marketUnitsCovering("tomato", 2.3, "kg") === 1.25 &&
      marketUnitsCovering("tomato", 2.2, "kg") === 1 &&
      marketUnitsCovering("bread", 0.25, "kg") === 1 &&
      marketUnitsCovering("tomato", 0, "kg") === 0 &&
      stepMarketQuantity("tomato", 0.25, -1) === 0.25 &&
      stepMarketQuantity("tomato", 0.75, 1) === 1 &&
      stepMarketQuantity("tomato", 1, 1) === 2 &&
      stepMarketQuantity("tomato", 1, -1) === 0.75 &&
      stepMarketQuantity("tomato", 5, 1) === 10 &&
      stepMarketQuantity("bread", 1, -1) === 1,
    "U3: labels; the Market's smallest step is ¼ lb / ¼ kg for weighed goods, a whole piece otherwise (garlic for 5 cloves = 0.25 lb, not 1 lb); the stepper goes ¼ → 1 → 5",
  );
}

{
  // U4 — bulky produce is sold whole (developer 2026-10-08): one item, in either measure.
  const s = saveAt(20);
  const melon = purchaseIngredient(
    s,
    "watermelon",
    1,
    0,
    1,
    0,
    lbPerMarketUnit("watermelon", "kg"),
    marketStep("watermelon"),
  );
  const quarter = purchaseIngredient(s, "watermelon", 0.25, 0, 1, 0, 1, WEIGHED_MARKET_STEP);
  assert(
    soldWhole("watermelon") &&
      soldWhole("pumpkin") &&
      soldWhole("cabbage") &&
      !soldWhole("tomato") &&
      !soldWhole("broccoli") &&
      marketUnitLabel("watermelon", "kg") === "watermelon" &&
      marketStep("watermelon") === 1 &&
      lbPerMarketUnit("watermelon", "kg") === INGREDIENT_MEASURES.watermelon.pieceLb &&
      marketUnitsCovering("watermelon", 0.75, "lb") === 1 &&
      marketUnitCountText("watermelon", "lb") === "sold whole · 1 watermelon ≈ 10 lb" &&
      melon.ok &&
      melon.stockQuantity === 10 &&
      melon.totalCost === 10 * businessUnitCostFor("watermelon") &&
      !quarter.ok,
    "U4: bulky produce (an item of 1 lb or more) is sold whole — 1 watermelon = 10 lb at the per-lb price, never ¼ lb, in lb or kg",
  );
}

console.log("K. Kilograms");
{
  const s = saveAt(20);
  const lb = purchaseQuote(s, "tomato", 1);
  const k = purchaseQuote(s, "tomato", 1, 0, 1, LB_PER_KG);
  assert(
    k.unitCost === Math.round(lb.unitCost * LB_PER_KG) &&
      k.totalCost === k.unitCost &&
      k.stockQuantity === 2.205,
    `K1: 1 kg of tomato costs the per-lb price × 2.20462 (${k.unitCost}c for ${lb.unitCost}c/lb) and is 2.205 lb of stock`,
  );
  const bought = purchaseIngredient(s, "tomato", 2, 0, 1, 0, LB_PER_KG);
  assert(
    bought.ok &&
      bought.quantity === 2 &&
      bought.stockQuantity === 4.409 &&
      getQuantity(bought.save.business.inventory, "tomato") === 4.409 &&
      bought.save.credits === s.credits - bought.totalCost &&
      bought.totalCost === 2 * k.unitCost,
    "K2: buying 2 kg adds 4.409 lb and takes exactly 2 × the kg price — nothing else",
  );
  const half = purchaseIngredient(s, "tomato", 1.5, 0, 1, 0, LB_PER_KG);
  const loaf = purchaseIngredient(s, "bread", 1, 0, 1, 0, LB_PER_KG);
  const odd = purchaseIngredient(s, "tomato", 1, 0, 1, 0, 3);
  assert(
    !half.ok &&
      !loaf.ok &&
      !odd.ok &&
      half.reason === "invalidQuantity" &&
      loaf.reason === "invalidQuantity",
    "K3: whole units only (1.5 kg refused); a loaf can't be bought by the kg; no other factor is accepted",
  );
  assert(
    measureOf(s) === "lb" &&
      measureOf(kg(s)) === "kg" &&
      restaurantQuote(kg(s), "tomato", 1).stockQuantity === 2.205 &&
      restaurantQuote(s, "tomato", 1).stockQuantity === 1 &&
      restaurantQuote(kg(s), "bread", 1).stockQuantity === 1,
    "K4: the restaurant's quote follows the setting (old saves without it = lb); loaves stay pieces",
  );
  // The Pre-Service Check counts whole kilograms in kg mode.
  const lbCheck = checkAt(s, 20).check;
  const kgCheck = checkAt(kg(s), 20).check;
  assert(
    lbCheck.applies &&
      kgCheck.applies &&
      lbCheck.missingRows.length > 0 &&
      kgCheck.missingRows.every(
        (r) =>
          r.buyUnits === marketUnitsCovering(r.ingredientId, r.missing, "kg") &&
          r.quote!.totalCost === restaurantQuote(kg(s), r.ingredientId, r.buyUnits).totalCost,
      ) &&
      lbCheck.missingRows.every(
        (r) =>
          r.buyUnits === marketUnitsCovering(r.ingredientId, r.missing, "lb") &&
          r.buyUnits < r.missing + marketStep(r.ingredientId) + 1e-9,
      ),
    "K5: the Pre-Service Check's Restock counts ¼ kg in kg mode and ¼ lb otherwise (never a whole step more than needed), priced by the same quote",
  );
  // SaveManager caches its first load, so one real load per run: a kg save.
  localStorage.setItem("knifecraft.save.v1", JSON.stringify(kg(s)));
  const loaded = await SaveManager.load();
  const { measure: _none, ...oldSettings } = kg(s).settings;
  assert(
    loaded.settings.measure === "kg" && measureOf({ settings: oldSettings }) === "lb",
    "K6: the setting survives a real SaveManager.load; a save without it reads lb",
  );
}

{
  const s = saveAt(20);
  const q = purchaseIngredient(s, "garlic", 0.25, 0, 1, 0, 1, WEIGHED_MARKET_STEP);
  const odd = purchaseIngredient(s, "garlic", 0.3, 0, 1, 0, 1, WEIGHED_MARKET_STEP);
  const loaf = purchaseIngredient(s, "bread", 1, 0, 1, 0, 1, WEIGHED_MARKET_STEP);
  const classic = purchaseIngredient(s, "garlic", 0.25);
  assert(
    q.ok &&
      q.stockQuantity === 0.25 &&
      q.totalCost === Math.round(0.25 * businessUnitCostFor("garlic")) &&
      getQuantity(q.save.business.inventory, "garlic") === 0.25 &&
      !odd.ok &&
      !loaf.ok &&
      !classic.ok,
    "K7: the restaurant sells ¼ lb of garlic for a quarter of the price; 0.3 lb, a loaf in quarters and a classic ¼ purchase are refused",
  );
}

console.log("Q. Quick Restock");
{
  const { save, check } = checkAt(saveAt(20), 20);
  const plan = quickRestockPlan(save, check)!;
  assert(
    !!plan &&
      check.applies &&
      plan.lines.length === check.missingRows.length &&
      plan.lines.every((l) => {
        const row = check.missingRows.find((r) => r.ingredientId === l.ingredientId)!;
        return (
          l.marketUnits === row.buyUnits &&
          l.quantity === row.quote!.stockQuantity &&
          l.marketCost === row.quote!.totalCost &&
          l.cost === Math.round(l.marketCost * (1 + QUICK_RESTOCK_FEE)) &&
          l.cost > l.marketCost
        );
      }) &&
      plan.marketCost === check.missingCost &&
      plan.extraCost === plan.totalCost - plan.marketCost &&
      plan.totalCost > check.missingCost,
    `Q1: the same amount the Market would sell, at the Market's price + ${QUICK_RESTOCK_FEE * 100} % — always dearer than going to the Market (${plan?.totalCost}c vs ${check.applies ? check.missingCost : 0}c)`,
  );
  const r = quickRestock(save, check);
  const after = r.ok ? checkAt(r.save, 20).check : null;
  assert(
    r.ok &&
      r.save.credits === save.credits - plan.totalCost &&
      after?.applies &&
      after.ready &&
      plan.lines.every(
        (l) => getQuantity(r.save.business.inventory, l.ingredientId) === l.quantity,
      ),
    "Q2: it takes exactly its cost, adds exactly the Market amount, and the check is ready",
  );
  const broke = quickRestock({ ...save, credits: plan.totalCost - 1 }, check);
  assert(
    !broke.ok && broke.reason === "insufficientFunds",
    "Q3: a wallet a cent short buys nothing (all-or-nothing)",
  );
  // A fridge with no room: fill the Basic with something else first.
  const full = {
    ...save,
    business: {
      ...save.business,
      inventory: addStock(
        {},
        "potato",
        getAvailableStorageCapacity({}, save.business.refrigerator.refrigeratorId),
        60,
        save.business.calendar.businessDay,
      ),
    },
  };
  const fullCheck = checkAt(full, 20).check;
  const noRoom = quickRestock(full, fullCheck);
  assert(
    !noRoom.ok &&
      noRoom.reason === "insufficientStorage" &&
      quickRestockPlan(full, fullCheck)?.fits === false,
    "Q4: a full fridge buys nothing and the plan says it doesn't fit",
  );
  const ready = quickRestockPlan(r.ok ? r.save : save, after && after.applies ? after : check);
  assert(ready === null, "Q5: nothing missing — no quick restock is offered");
}

console.log("P. Market plan");
{
  const s = saveAt(31);
  const p1 = marketPlanFor(s, 1);
  const p3 = marketPlanFor(s, 3);
  assert(
    p1.rows.length > 0 &&
      p1.rows.every((r) => r.firstDay === 0 && r.forToday) &&
      p3.rows.length >= p1.rows.length &&
      p3.dayLevels.length === 3 &&
      p3.dayLevels[0]!.join() === "31,32" &&
      p3.dayLevels[1]!.join() === "33,34",
    `P1: today's services first (Levels ${p3.dayLevels.map((d) => d.join("+")).join(" | ")}); a longer plan only adds`,
  );
  assert(
    p3.rows.every((r) => r.firstDay < shelfLifeForIngredient(r.ingredientId)) &&
      p3.storageNeeded <= p3.storageFree &&
      p3.rows.every((r, i, all) => i === 0 || Number(all[i - 1]!.forToday) >= Number(r.forToday)),
    "P2: nothing is planned to spoil before its day; the plan fits the fridge; today's lines are listed first",
  );
  // Buy the whole plan the way "Buy all" does: today's service is then ready.
  let bought = s;
  for (const row of p1.rows) {
    const b = purchaseIngredient(
      bought,
      row.ingredientId,
      row.buyUnits,
      0,
      1,
      0,
      lbPerMarketUnit(row.ingredientId, "lb"),
      marketStep(row.ingredientId),
    );
    if (b.ok) bought = b.save;
  }
  const level31 = getLevel("level-31")!;
  const plan31 = servicePlanFor(bought, level31)!;
  assert(
    plan31.check.applies && plan31.check.ready,
    "P3: buying today's plan makes today's service ready",
  );
  // A tiny fridge: the plan never exceeds it and lists what didn't fit.
  const cramped = {
    ...s,
    business: {
      ...s.business,
      inventory: addStock(
        {},
        "potato",
        getAvailableStorageCapacity({}, s.business.refrigerator.refrigeratorId) - 1,
        60,
        s.business.calendar.businessDay,
      ),
    },
  };
  const pc = marketPlanFor(cramped, 3);
  assert(
    pc.storageNeeded <= pc.storageFree && pc.storageFree <= 1 && pc.noRoom.length > 0,
    `P4: with 1 unit of fridge space the plan stays within it (${pc.storageNeeded}) and names what didn't fit (${pc.noRoom.length})`,
  );
  const endless = marketPlanFor(
    saveAt(251, {
      levelProgress: {
        ...progressAt(250),
        completedLevelIds: Array.from({ length: 250 }, (_, i) => `level-${i + 1}`),
      },
    }),
    2,
  );
  assert(
    endless.dayLevels.every((d) => d.length === 0) && endless.rows.length > 0,
    "P5: after Level 250 the plan follows the Endless Restaurant's menu demand",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const journal = read("src/components/kc/Journal.tsx");
  const router = read("src/ScreensRouter.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const modules = ["measure.ts", "ingredientMeasures.ts"]
    .map((f) => read(`src/game/business/${f}`))
    .concat(["quickRestock.ts", "marketPlan.ts"].map((f) => read(`src/game/restaurant/${f}`)));
  assert(
    /onQuickRestock=\{\(next, lines\) =>\s*persistIngredientPurchases\(/.test(app) &&
      /function purchaseIngredients\([\s\S]*?persistIngredientPurchases\(next, recorded\)/.test(
        app,
      ),
    "W1: Quick Restock and the plan's Buy all record through persistIngredientPurchases (one inventory-purchase entry per ingredient)",
  );
  assert(
    /onSetMeasure=\{RESTAURANT_MODE \? setMeasure : undefined\}/.test(router) &&
      /data-testid="measure-setting"/.test(journal) &&
      /setDisplayMeasure\(RESTAURANT_MODE && save \? measureOf\(save\) : "lb"\)/.test(app),
    "W2: Settings → Weights only in the restaurant build; every screen shows the chosen measure",
  );
  assert(
    /Restaurant <\/span>rank · \{rankNumber\}\/\s*\{CAFE_MILESTONES\.length\}/.test(kitchen) &&
      (kitchen.match(/variant=\{(todayCompleted|completed) \? "ghost" : "sage"\}/g) ?? [])
        .length === 2,
    "W3: the Kitchen shows the restaurant rank; Prepare (green) and Replay (outlined) look different",
  );
  assert(
    modules.every(
      (m) => !/RESTAURANT_MODE/.test(m.replace(/\/\*[\s\S]*?\*\//g, "")) && !/Math\.random/.test(m),
    ),
    "W4: the new modules never read RESTAURANT_MODE or Math.random",
  );
}

console.log("A. Audit fixes (2026-10-08)");
{
  // A1 — a level's pay preview = its owed orders at recipe price + the completion reward.
  const s = saveAt(12);
  const level = getLevel("level-12")!;
  const pay = levelPayPreview(s, level)!;
  const { tickets } = ticketsFor(s.levelProgress, level);
  const orders = tickets.reduce((t, r) => t + dollars(recipePay(r, level.chapter)), 0);
  const replay = levelPayPreview(
    {
      ...s,
      levelProgress: {
        ...s.levelProgress,
        completedLevelIds: [...s.levelProgress.completedLevelIds, "level-12"],
      },
    },
    level,
  );
  assert(
    pay.orders === orders &&
      pay.completion === paidLevelReward(level) &&
      pay.total === orders + pay.completion &&
      pay.total > pay.completion &&
      replay === null,
    `A1: Level 12 shows what it pays — orders ${pay.orders}c + completion ${pay.completion}c (it used to show only the completion); a replay shows nothing`,
  );
  // A2 — the first restock guide ends once the player has bought, or has stock.
  const fresh = saveAt(15);
  const bought = purchaseIngredient(fresh, "tomato", 1);
  assert(
    !hasBoughtIngredients(fresh) && bought.ok && hasBoughtIngredients(bought.save),
    "A2: Grandma's first-restock guide shows until the first ingredient is bought (or stocked)",
  );
  // A3 — supply packs say what they hold.
  assert(
    packsText(getSupplyItem("dinner-plates")!, 1) === "1 pack of 12" &&
      packsText(getSupplyItem("dinner-plates")!, 2) === "2 packs of 12" &&
      packsText(getSupplyItem("dish-soap")!, 1) === "1 pack of 4",
    'A3: supply restock says the pack size ("1 pack of 12", not "1")',
  );
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const dashboard = read("src/components/kc/business/BusinessDashboard.tsx");
  const progress = read("src/components/kc/RestaurantProgress.tsx");
  const app = read("src/App.tsx");
  const journal = read("src/components/kc/Journal.tsx");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  const check = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const shop = read("src/components/kc/Shop.tsx");
  assert(
    /ready to prepare · \$\{payText\(save, todayLevel\)\}/.test(kitchen) &&
      /ready to prepare · \$\{payText\(save, level\)\}/.test(kitchen) &&
      /\{canOpen && !completed \? \(/.test(kitchen) &&
      /max-w-\[60%\]/.test(kitchen),
    "A4: the Kitchen card and Order Board show the level's pay; hints only on the level to play; the rank card is width-capped",
  );
  assert(
    /if \(!businessDayAllowed\(RESTAURANT_MODE, save\.levelProgress\)\) \{[\s\S]*?<CampaignDayCard/.test(
      dashboard,
    ) &&
      /label="Kitchen upgrade"/.test(progress) &&
      /RESTAURANT_MODE && !p\.campaignComplete \? null : <PopularityCard/.test(progress),
    "A5: before Level 250 the Restaurant Overview shows the campaign day (no Business Day tools) and Progress drops the Business popularity; Kitchen upgrade vs rank names",
  );
  assert(
    /classList\.toggle\("kc-reduced-motion"/.test(app) &&
      /label="Reduced motion"/.test(journal) &&
      /onBuyAllInMarket=\{\(\) => openMarketPlan\(go\)\}/.test(layer) &&
      /firstRestock=\{!hasBoughtIngredients\(save\)\}/.test(layer) &&
      /setShowGuests/.test(check) &&
      /setShowDay/.test(check) &&
      /h-\[96px\]/.test(shop),
    "A6: Settings → Reduced motion; Buy everything in the Market (plan on Today); first-restock guide; optional sections folded; a short Market banner on Ingredients",
  );
}

console.log(
  failures ? `RESTAURANT MEASURES QA: ${failures} FAILURE(S)` : "RESTAURANT MEASURES QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
