/**
 * INVENTORY_MARKET_QA — the Business Ingredients + Market rework.
 * Market → Ingredients is the only place Business stock is bought
 * (MarketIngredients + purchaseQuote/purchaseIngredient); Business →
 * Inventory only monitors it (BusinessInventory + inventoryAnalytics).
 * Checks 1–16 of the rework brief against the real production functions.
 *
 * Run: npx tsx scripts/inventory-market-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

// Minimal localStorage shim so section 16 can exercise the REAL SaveManager.load().
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE, SaveManager } = await import("../src/game/SaveManager.ts");
type SaveData = typeof DEFAULT_SAVE;
const { DEFAULT_BUSINESS_STATE } = await import("../src/game/business/businessTypes.ts");
const { INGREDIENTS } = await import("../src/game/definitions.ts");
const { addStock } = await import("../src/game/business/businessInventory.ts");
const { businessUnitCostFor } = await import("../src/game/business/businessPricing.ts");
const { purchaseIngredient, purchaseQuote, todaysUnitCost } =
  await import("../src/game/business/BusinessInventoryManager.ts");
const { appendLedgerEntry } = await import("../src/game/economy/EconomyLedger.ts");
const { recordInventoryPurchase, migrateBusinessFinanceState, DEFAULT_DAILY_ACCUMULATOR } =
  await import("../src/game/business/BusinessFinanceManager.ts");
const { BUSINESS_DISH_CATALOG, getBusinessDish } =
  await import("../src/game/business/businessDishCatalog.ts");
const { businessDishRequirements } = await import("../src/game/business/businessServiceCatalog.ts");
const { CAMPAIGN_RECIPES, BUSINESS_ONLY_RECIPES, getCampaignRecipe } =
  await import("../src/game/recipes/campaignRecipes.ts");
const { getContractTerms } = await import("../src/game/business/businessSupplierContract.ts");
const { eventForDay } = await import("../src/game/business/businessSupplierEvents.ts");
const { endBusinessDay } = await import("../src/game/business/BusinessDayManager.ts");
const A = await import("../src/game/business/inventoryAnalytics.ts");

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else console.log(`ok   ${label}`);
}

const QUIET_DAY = 7; // eventForDay(7) === null
function saveWith(
  overrides: { credits?: number; business?: Partial<SaveData["business"]> } = {},
): SaveData {
  return {
    ...DEFAULT_SAVE,
    credits: overrides.credits ?? 133_200,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { ...DEFAULT_BUSINESS_STATE.calendar, businessDay: QUIET_DAY },
      ...overrides.business,
    },
  };
}
/** App.tsx's own composition: manager → one ledger entry → accumulator. */
function buy(save: SaveData, id: string, qty: number) {
  const r = purchaseIngredient(save, id, qty);
  if (!r.ok) return r;
  const withLedger = appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id);
  return { ...r, save: recordInventoryPurchase(withLedger, r.totalCost, 1) };
}

// ===== 1: no buy controls in Inventory =====
{
  // The stock-control screen moved from Business → Inventory to its own bottom-bar section.
  const inv = code(read("src/components/kc/inventory/InventoryScreen.tsx"));
  const dash = code(read("src/components/kc/business/BusinessDashboard.tsx"));
  assert(
    !/purchaseIngredient|purchaseQuote|todaysUnitCost|stepPurchaseQuantity|Increase quantity|Buy \{/.test(
      inv,
    ) && !/purchaseIngredient/.test(dash),
    "1: Inventory has no purchase controls or purchase action",
  );
  assert(
    /Go to Market →/.test(inv) &&
      /Restock in Market →/.test(inv) &&
      /Restock →/.test(inv) &&
      /openMarketIngredients\(go, id\)/.test(inv) &&
      /openMarketIngredients\(go, n\.id\)/.test(inv),
    "1b: its only purchase-related controls navigate to the Market",
  );
  const shop = read("src/components/kc/Shop.tsx");
  assert(
    /<MarketIngredients/.test(shop) &&
      /purchaseIngredient=\{purchaseIngredient\}/.test(read("src/ScreensRouter.tsx")),
    "1c: the Market's Ingredients tab carries the purchase action",
  );
}

// ===== 2 + 3: buy 5 tomatoes =====
{
  const s0 = saveWith();
  const quote = purchaseQuote(s0, "tomato", 5);
  const r = buy(s0, "tomato", 5);
  assert(
    r.ok &&
      quote.verdict === "ok" &&
      r.totalCost === 5 * businessUnitCostFor("tomato") &&
      r.totalCost === quote.totalCost,
    `2: 5 tomatoes cost exactly 5 × $1.00 = ${r.ok ? r.totalCost : "?"} (the quote shown on the card)`,
  );
  if (r.ok) {
    const added = r.save.economyLedger.slice(s0.economyLedger.length);
    assert(
      s0.credits - r.save.credits === 500 &&
        r.save.business.inventory.tomato?.quantity === 5 &&
        added.length === 1 &&
        added[0]!.amount === -500 &&
        added[0]!.category === "inventory-purchase",
      "2b: wallet −$5.00, stock +5, exactly one inventory-purchase ledger entry",
    );
    assert(
      quote.remainingCredits === r.save.credits,
      "2c: the card's '$1,332 → $1,327' is the real balance after the purchase",
    );
    const onHand = A.onHandItems(r.save);
    assert(
      onHand.length === 1 &&
        onHand[0]!.id === "tomato" &&
        onHand[0]!.quantity === 5 &&
        onHand[0]!.value === 500 &&
        onHand[0]!.state === "FRESH",
      "3: Inventory's on-hand stock reads the new stock immediately (same save)",
    );
    assert(
      A.inventorySummary(r.save).stocked === 1 && A.inventorySummary(r.save).stockValue === 500,
      "3b: analytics stock value and stocked count update with it",
    );
  }
}

// ===== 4: fridge figures =====
{
  const s = buy(saveWith(), "tomato", 10);
  const s2 = s.ok ? buy(s.save, "onion", 5) : s;
  if (s2.ok) {
    const f = A.fridgeStatus(s2.save);
    assert(
      f.capacity === 40 &&
        f.used === 15 &&
        f.available === 25 &&
        Math.abs(f.usage - 15 / 40) < 1e-9 &&
        f.stockValue === 10 * businessUnitCostFor("tomato") + 5 * businessUnitCostFor("onion"),
      `4: Basic fridge 15 / 40 used, 25 left, stock value ${f.stockValue}`,
    );
  } else assert(false, "4: setup purchases");
}

// ===== 5: low stock follows menu demand =====
{
  const day = QUIET_DAY;
  const demand = A.menuDemand(saveWith());
  const garlic = demand.get("garlic")!;
  assert(
    !!garlic && garlic.perDay > 0 && garlic.dishCount > 1,
    `5: today's menu demand is computed per ingredient (garlic: ${garlic?.perDay.toFixed(3)} / day over ${garlic?.dishCount} dishes)`,
  );
  const tomatoDay = demand.get("tomato")!.perDay;
  const lowStock = {
    tomato: { ingredientId: "tomato" as const, quantity: 0.3, unitCost: 100, purchaseDay: day },
  };
  const low = A.lowStockItems(saveWith({ business: { inventory: lowStock } }));
  const t = low.find((i) => i.id === "tomato");
  assert(
    tomatoDay > 0.3 &&
      !!t &&
      t.threshold === tomatoDay &&
      t.dishesLeft === Math.floor(0.3 / demand.get("tomato")!.perOrder),
    `5b: one tomato (0.3 lb) against ${tomatoDay.toFixed(2)} lb expected today is low — "Estimated ${t?.dishesLeft} dishes remaining"`,
  );
  const plenty = {
    tomato: {
      ingredientId: "tomato" as const,
      quantity: Math.ceil(tomatoDay) + 1,
      unitCost: 100,
      purchaseDay: day,
    },
  };
  assert(
    !A.lowStockItems(saveWith({ business: { inventory: plenty } })).some((i) => i.id === "tomato"),
    "5c: stock above today's demand is not low",
  );
  const offMenu = saveWith({
    business: {
      inventory: lowStock,
      menuActivation: {
        inactiveDishIds: BUSINESS_DISH_CATALOG.filter((d) =>
          businessDishRequirements(d).some((r) => r.ingredientId === "tomato"),
        ).map((d) => d.id),
      },
    },
  });
  assert(
    !A.lowStockItems(offMenu).some((i) => i.id === "tomato"),
    "5d: the threshold follows the active menu — with every tomato dish off the menu, tomato is never low",
  );
  const busier = { ...saveWith({ business: { inventory: plenty } }) };
  busier.business = {
    ...busier.business,
    popularity: { ...busier.business.popularity, score: 100 },
  };
  assert(
    A.menuDemand(busier).get("tomato")!.perDay > tomatoDay,
    "5e: more customers (popularity 100) raise the threshold",
  );
}

// ===== 6: expiry =====
{
  // Tomato (Vegetable) keeps 7 days; bought on day 1, today day 7 → 1 day left = spoils tonight.
  const inv = {
    tomato: { ingredientId: "tomato" as const, quantity: 3, unitCost: 100, purchaseDay: 1 },
    basil: { ingredientId: "basil" as const, quantity: 2, unitCost: 100, purchaseDay: 6 }, // Herb 3 days, age 1 → 2 left
    garlic: { ingredientId: "garlic" as const, quantity: 2, unitCost: 100, purchaseDay: 7 }, // 12 days left
  };
  const s = saveWith({ business: { inventory: inv } });
  const items = A.onHandItems(s);
  const by = (id: string) => items.find((i) => i.id === id)!;
  assert(
    by("tomato").daysLeft === 1 &&
      by("tomato").spoilsTonight &&
      by("tomato").state === "NEAR_EXPIRY",
    "6: tomato bought day 1 spoils tonight on day 7 (NEAR EXPIRY, 1 day left)",
  );
  assert(
    by("basil").daysLeft === 2 &&
      !by("basil").spoilsTonight &&
      by("garlic").daysLeft === 12 &&
      by("garlic").state === "FRESH",
    "6b: basil 2 days left, garlic FRESH with 12",
  );
  const soon = A.expiringSoon(s).map((i) => i.id);
  assert(
    JSON.stringify(soon) === JSON.stringify(["tomato", "basil"]),
    `6c: Expiring soon lists tonight first, then ≤ 2 days: ${soon.join(", ")}`,
  );
  const after = endBusinessDay(s).save;
  assert(
    !after.business.inventory.tomato && !!after.business.inventory.basil,
    "6d: it matches the real sweep — End Business Day throws out exactly the tomato",
  );
  assert(
    A.inventorySummary(after).wasteValue === after.business.spoilage.totalSpoiledValue &&
      after.business.spoilage.totalSpoiledValue > 0 &&
      A.inventorySummary(after).lastDayWasteValue ===
        after.business.finance.lastDailyPnL?.spoilageValue,
    "6e: waste comes from the real spoilage record only",
  );
}

// ===== 7: purchase analytics maths =====
{
  let s = saveWith();
  for (const [id, q] of [
    ["tomato", 5],
    ["onion", 10],
    ["potato", 3],
  ] as const) {
    const r = buy(s, id, q);
    if (r.ok) s = r.save;
  }
  const spent =
    5 * businessUnitCostFor("tomato") +
    10 * businessUnitCostFor("onion") +
    3 * businessUnitCostFor("potato");
  const p = A.purchasingStats(s);
  assert(
    p.businessDaySpent === spent &&
      p.businessDayPurchases === 3 &&
      p.averagePurchase === Math.round(spent / 3),
    `7: this Business Day: ${spent}¢ over 3 purchases, average ${p.averagePurchase}¢`,
  );
  assert(
    p.todaySpent === spent &&
      p.todayPurchases === 3 &&
      p.lifetimeSpent === spent &&
      p.lastBusinessDaySpent === null,
    "7b: today (ledger) and lifetime totals agree; no last day yet",
  );
  const next = endBusinessDay(s).save;
  const p2 = A.purchasingStats(next);
  assert(
    p2.businessDaySpent === 0 &&
      p2.businessDayPurchases === 0 &&
      p2.averagePurchase === null &&
      p2.lastBusinessDaySpent === spent &&
      p2.lifetimeSpent === spent,
    "7c: End Business Day resets the day; last day keeps its spend",
  );
  const rush = recordInventoryPurchase(saveWith(), 900, 3);
  assert(
    rush.business.finance.dailyAccumulator.inventoryPurchases === 3 &&
      rush.business.finance.dailyAccumulator.inventoryPurchaseCost === 900,
    "7d: a 3-ingredient cash Rush Restock counts as 3 purchases (one per ledger entry)",
  );
  const legacy = saveWith();
  legacy.business = {
    ...legacy.business,
    finance: {
      ...legacy.business.finance,
      dailyAccumulator: {
        ...DEFAULT_DAILY_ACCUMULATOR,
        inventoryPurchaseCost: 700,
        inventoryPurchases: 0,
      },
    },
  };
  const pl = A.purchasingStats(legacy);
  assert(
    pl.businessDayPurchases === null && pl.averagePurchase === null && pl.businessDaySpent === 700,
    "7e: a pre-rework save with spend but no count shows no invented average",
  );
}

// ===== 8: consumption analytics from the ledger =====
{
  let s = saveWith();
  const caprese = getBusinessDish("biz-caprese-salad")!;
  const ribeye = getBusinessDish("biz-ribeye-herb-butter")!;
  for (const id of [caprese.id, caprese.id, ribeye.id])
    s = appendLedgerEntry(s, "business-revenue", 1_000, id);
  const c = A.ingredientConsumption(s);
  const need = (dish: typeof caprese, id: string) =>
    businessDishRequirements(dish)
      .filter((r) => r.ingredientId === id)
      .reduce((a, r) => a + r.quantity, 0);
  const tomato = c.items.find((i) => i.id === "tomato");
  const butter = c.items.find((i) => i.id === "butter");
  assert(
    c.orders === 3 &&
      !!tomato &&
      Math.abs(tomato.quantity - 2 * need(caprese, "tomato")) < 1e-9 &&
      tomato.orders === 2 &&
      !!butter &&
      butter.orders === 1 &&
      Math.abs(butter.quantity - need(ribeye, "butter")) < 1e-9,
    "8: Most used = what the served dishes' real requirements drew (2 caprese + 1 ribeye)",
  );
  assert(
    A.ingredientConsumption(saveWith()).items.length === 0,
    "8b: nothing served → nothing used (no invented data)",
  );
  const analytics = read("src/game/business/inventoryAnalytics.ts");
  assert(
    /economyLedger/.test(analytics) && !/localStorage|indexedDB/.test(analytics),
    "8c: consumption is derived from the existing ledger, no second store",
  );
}

// ===== 9: supplier modifiers =====
{
  const base = businessUnitCostFor("tomato"); // 100
  const at = (day: number, extra: Partial<SaveData["business"]> = {}) =>
    saveWith({
      business: { calendar: { ...DEFAULT_BUSINESS_STATE.calendar, businessDay: day }, ...extra },
    });
  const name = (d: number) => eventForDay(d)?.name;
  assert(
    name(2) === "Price Increase" &&
      purchaseQuote(at(2), "tomato", 5).unitCost === Math.round(base * 1.15),
    "9: Price Increase +15% (tomato $1.15)",
  );
  assert(
    name(3) === "Bulk Discount" &&
      purchaseQuote(at(3), "tomato", 5).unitCost === Math.round(base * 0.85),
    "9b: Bulk Discount −15%",
  );
  assert(
    name(4) === "Fresh Catch" &&
      purchaseQuote(at(4), "tomato", 5).unitCost === Math.round(base * 0.9),
    "9c: Fresh Catch −10%",
  );
  const local = {
    ...getContractTerms("local-market")!,
    supplierId: "local-market",
    contractStartDay: 1,
    contractEndDay: 50,
  };
  assert(
    name(1) === "Supplier Delay" &&
      purchaseQuote(at(1, { supplierContract: local }), "tomato", 5).unitCost === base &&
      purchaseQuote(at(QUIET_DAY, { supplierContract: local }), "tomato", 5).unitCost ===
        Math.round(base * 0.95),
    "9d: Supplier Delay suspends the contract discount (−5% on a quiet day, none on the delay day)",
  );
  const shortage = purchaseQuote(at(5), "tomato", 15);
  assert(
    name(5) === "Temporary Shortage" &&
      shortage.verdict === "exceedsShortageLimit" &&
      !purchaseIngredient(at(5), "tomato", 15).ok &&
      purchaseQuote(at(5), "tomato", 10).verdict === "ok",
    "9e: Temporary Shortage caps one purchase at 10 — quote and purchase agree",
  );
  for (let d = 1; d <= 9; d++) {
    const s = at(d);
    if (purchaseQuote(s, "salmon", 5).unitCost !== todaysUnitCost(s, "salmon", 5))
      assert(false, `9f: day ${d} quote ≠ todaysUnitCost`);
  }
  const prep = at(QUIET_DAY, { staff: { hiredRoles: ["prep-cook"] } });
  const r = purchaseIngredient(prep, "salmon", 5);
  assert(
    r.ok &&
      r.unitCost === purchaseQuote(prep, "salmon", 5).unitCost &&
      r.unitCost === Math.round(businessUnitCostFor("salmon") * 0.97),
    "9g: the Prep Cook −3% applies, and the card's price is what's charged",
  );
}

// ===== 10: contract thresholds =====
{
  const contract = (id: string) => ({
    ...getContractTerms(id)!,
    supplierId: id,
    contractStartDay: 1,
    contractEndDay: 50,
  });
  const s = (id: string) => saveWith({ business: { supplierContract: contract(id) } });
  const base = businessUnitCostFor("onion");
  assert(
    purchaseQuote(s("local-market"), "onion", 4).unitCost === base &&
      purchaseQuote(s("local-market"), "onion", 5).unitCost === Math.round(base * 0.95),
    "10: Local −5% from 5 units",
  );
  assert(
    purchaseQuote(s("wholesale-supplier"), "onion", 24).unitCost === base &&
      purchaseQuote(s("wholesale-supplier"), "onion", 25).unitCost === Math.round(base * 0.8),
    "10b: Wholesale −20% from 25 units",
  );
  assert(
    purchaseQuote(s("premium-supplier"), "onion", 4).unitCost === base &&
      purchaseQuote(s("premium-supplier"), "onion", 5).unitCost === Math.round(base * 0.95),
    "10c: Premium −5% from 5 units",
  );
}

// ===== 11: insufficient funds =====
{
  const s = saveWith({ credits: 300 });
  const q = purchaseQuote(s, "tomato", 5);
  const r = purchaseIngredient(s, "tomato", 5);
  assert(
    q.verdict === "insufficientFunds" &&
      q.remainingCredits === -200 &&
      !r.ok &&
      r.reason === "insufficientFunds",
    "11: $3.00 can't buy $5.00 of tomatoes — the card says so before the tap",
  );
  const market = read("src/components/kc/MarketIngredients.tsx");
  assert(
    /notEnoughMoneyText\(quote\.totalCost, save\.credits\)/.test(market),
    "11b: 'Not enough money — need $X more.' from the shared wallet helper",
  );
}

// ===== 12: fridge full =====
{
  const full = {
    tomato: {
      ingredientId: "tomato" as const,
      quantity: 38,
      unitCost: 100,
      purchaseDay: QUIET_DAY,
    },
  };
  const s = saveWith({ business: { inventory: full } });
  const q = purchaseQuote(s, "onion", 5);
  const r = purchaseIngredient(s, "onion", 5);
  assert(
    q.verdict === "insufficientStorage" &&
      q.availableStorage === 2 &&
      !r.ok &&
      r.reason === "insufficientStorage",
    "12: 5 onions don't fit in 2 units of space — refused, nothing partial",
  );
  const ok2 = purchaseIngredient(s, "onion", 2);
  assert(
    ok2.ok && A.fridgeStatus(ok2.save).available === 0,
    "12b: exactly filling the fridge works and leaves 0, never negative",
  );
  const market = read("src/components/kc/MarketIngredients.tsx");
  assert(
    /Not enough fridge space\./.test(market) &&
      /You have \$\{formatQuantity\(available\)\} unit/.test(market),
    "12c: the card says 'Not enough fridge space. You have N units of fridge space left.'",
  );
}

// ===== 13: all 57 ingredients in the Market =====
{
  const market = read("src/components/kc/MarketIngredients.tsx");
  const ids = A.ALL_INGREDIENT_IDS;
  const grouped = A.INGREDIENT_GROUPS.flatMap((g) =>
    ids.filter((id) => INGREDIENTS[id].category === g.category),
  );
  assert(
    ids.length === 57 && grouped.length === 57 && new Set(grouped).size === 57,
    "13: all 57 ingredients are in exactly one Market group",
  );
  assert(
    ids.every((id) => purchaseQuote(saveWith({ credits: 10_000_000 }), id, 1).verdict === "ok"),
    "13b: every one of them can be bought",
  );
  assert(
    !/No dish|Show \d+ more|slice\(0,/.test(code(market)),
    "13c: no 'No dish' badge and no 'Show more' cut-off",
  );
}

// ===== 14 + 15: 48 dishes, Business-only recipe =====
{
  assert(BUSINESS_DISH_CATALOG.length === 48, "14: 48 Business dishes");
  const used = new Set(
    BUSINESS_DISH_CATALOG.flatMap((d) => businessDishRequirements(d).map((r) => r.ingredientId)),
  );
  assert(used.size === 57, "14b: every ingredient is used by at least one dish");
  const ribeye = getBusinessDish("biz-ribeye-herb-butter")!;
  assert(
    !!getCampaignRecipe(ribeye.sourceRecipeId) &&
      BUSINESS_ONLY_RECIPES.some((r) => r.id === ribeye.sourceRecipeId) &&
      !CAMPAIGN_RECIPES.some((r) => r.id === ribeye.sourceRecipeId) &&
      CAMPAIGN_RECIPES.length === 221 &&
      !CAMPAIGN_RECIPES.some((r) => r.components.some((c) => c.ingredientId === "butter")),
    "15: Ribeye with Herb Butter stays Business-only; the campaign keeps 221 recipes with no butter",
  );
  const inv = Object.fromEntries(
    ["steak", "butter", "parsley", "garlic"].map((id) => [
      id,
      { ingredientId: id, quantity: 5, unitCost: 100, purchaseDay: QUIET_DAY },
    ]),
  );
  const s = saveWith({
    business: {
      inventory: inv as SaveData["business"]["inventory"],
      menuActivation: {
        inactiveDishIds: BUSINESS_DISH_CATALOG.filter((d) => d.id !== ribeye.id).map((d) => d.id),
      },
    },
  });
  const r = A.menuReadiness(s);
  assert(
    r.ready === 1 && r.total === 1,
    "15b: with its stock the butter dish shows as ready in Menu readiness",
  );
}

// ===== 16: existing saves =====
{
  const old = migrateBusinessFinanceState(
    {
      dailyAccumulator: {
        revenue: 1,
        cogs: 0,
        inventoryPurchaseCost: 500,
        maintenanceCost: 0,
        supplierCost: 0,
        capitalExpenditure: 0,
        ordersServed: 2,
      },
      lifetimeCogs: 0,
      lastDailyPnL: null,
      lifetime: { ...migrateBusinessFinanceState(undefined, []).lifetime },
    },
    [],
  );
  assert(
    old.dailyAccumulator.inventoryPurchases === 0 &&
      old.dailyAccumulator.inventoryPurchaseCost === 500 &&
      old.dailyAccumulator.ordersServed === 2,
    "16: an accumulator saved before the purchase count migrates it as 0, everything else unchanged",
  );
  const stored = saveWith({
    credits: 98_765,
    business: {
      inventory: { tomato: { ingredientId: "tomato", quantity: 7, unitCost: 95, purchaseDay: 5 } },
      refrigerator: {
        ...DEFAULT_BUSINESS_STATE.refrigerator,
        refrigeratorId: "commercial-refrigerator",
      },
    },
  });
  const json = JSON.parse(JSON.stringify(stored));
  delete json.business.finance.dailyAccumulator.inventoryPurchases;
  store.set("knifecraft.save.v1", JSON.stringify(json));
  const loaded = await SaveManager.load();
  assert(
    loaded.credits === 98_765 &&
      loaded.business.inventory.tomato?.quantity === 7 &&
      loaded.business.inventory.tomato?.unitCost === 95 &&
      loaded.business.refrigerator.refrigeratorId === "commercial-refrigerator" &&
      loaded.business.finance.dailyAccumulator.inventoryPurchases === 0,
    "16b: SaveManager.load keeps wallet, stock and fridge of an existing save",
  );
  assert(
    JSON.stringify(Object.keys(DEFAULT_SAVE.business)) ===
      JSON.stringify([
        "calendar",
        "inventory",
        "refrigerator",
        "spoilage",
        "menu",
        "popularity",
        "supplierContract",
        "staff",
        "equipmentCondition",
        "inspectionFines",
        "finance",
        "menuActivation",
        // The authorized Business Supplies extension (master spec §25,
        // business-supplies-qa) — the only field added since this check.
        "supplies",
      ]),
    "16c: no new Business save fields (beyond the authorized `supplies`, §25)",
  );
}

console.log(
  failures === 0
    ? "\nINVENTORY + MARKET QA: ALL PASS"
    : `\nINVENTORY + MARKET QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
