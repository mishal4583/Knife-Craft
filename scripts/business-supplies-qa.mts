/**
 * BUSINESS_SUPPLIES_QA — the Business Supplies extension (master spec §25):
 * culinary smallwares, tableware and takeaway packaging, bought in the
 * Market and monitored in Inventory → Supplies. Run against the real
 * production functions:
 *
 *   A. Catalog: 52 lines (18 / 17 / 17 — dish soap and cleaning liquid since phase G), the requested groups, no prep
 *      knives or cutting boards, never ingredients; every price sourced and
 *      dated, game price = round(retail × 0.65).
 *   B. A purchase: wallet − exact cost, stock + packSize × packs, cost
 *      basis, lifetime totals; the App wrapper writes exactly ONE ledger
 *      entry (equipment vs packaging category) and the matching P&L record.
 *   C. Atomic failures: unknown id, invalid packs, insufficient funds —
 *      nothing changes (same save object, no ledger, no finance).
 *   D. Packaging use: one container + one bag per served order, by
 *      priority, cost basis → COGS; none in stock → nothing changes;
 *      equipment is never used up; serveBusinessOrder calls it.
 *   E. Finance: equipment is capital, packaging a stock asset; the Daily
 *      P&L cash identity still holds; ingredient purchasing stays food-only.
 *   F. "Saved vs retail" is derived (retail − paid) and never grants money.
 *   G. Saves: default empty; an old save (no supplies) loads through the
 *      REAL SaveManager.load with empty stock; malformed/unknown data is
 *      sanitized; the migration is idempotent.
 *   H. Campaign independence and wiring (Market sections, Business tab with
 *      no purchase controls, routes, ledger labels).
 *
 * Run: npx tsx scripts/business-supplies-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

// Minimal localStorage shim so G can exercise the REAL SaveManager.load().
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
const { INGREDIENTS } = await import("../src/game/definitions.ts");
const {
  SUPPLY_CATALOG,
  SUPPLY_SECTIONS,
  SUPPLY_WHOLESALE_FACTOR,
  SUPPLY_PRICES_RETRIEVED,
  supplyPackPrice,
  isConsumableSupply,
  getSupplyItem,
  defaultSuppliesState,
  migrateBusinessSuppliesState,
} = await import("../src/game/business/businessSupplies.ts");
const {
  purchaseSupply,
  supplyQuote,
  takePackagingForOrder,
  supplySectionSummary,
  isLowSupply,
  MAX_SUPPLY_PACKS,
  ORDER_CONTAINER_PRIORITY,
  ORDER_BAG_PRIORITY,
} = await import("../src/game/business/BusinessSuppliesManager.ts");
const { appendLedgerEntry, LEDGER_CATEGORY_LABEL, EXPENSE_CATEGORIES } =
  await import("../src/game/economy/EconomyLedger.ts");
const {
  recordCapitalExpenditure,
  recordPackagingPurchase,
  computeDailyPnL,
  DEFAULT_DAILY_ACCUMULATOR,
  businessLedgerEntries,
} = await import("../src/game/business/BusinessFinanceManager.ts");
const { purchasingStats } = await import("../src/game/business/inventoryAnalytics.ts");

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

function saveWith(credits: number): SaveData {
  return {
    ...DEFAULT_SAVE,
    credits,
    economyLedger: [],
    business: { ...DEFAULT_SAVE.business, supplies: defaultSuppliesState() },
  };
}

/** Exactly what App.tsx's purchaseSupply wrapper does on success. */
function appPurchase(save: SaveData, id: string, packs: number) {
  const result = purchaseSupply(save, id, packs);
  if (!result.ok) return { result, save };
  const packaging = isConsumableSupply(result.item);
  const recorded = appendLedgerEntry(
    result.save,
    packaging ? "supply-packaging-purchase" : "supply-equipment-purchase",
    -result.totalCost,
    result.item.id,
  );
  return {
    result,
    save: packaging
      ? recordPackagingPurchase(recorded, result.totalCost)
      : recordCapitalExpenditure(recorded, result.totalCost),
  };
}

// ===== A. Catalog =====
{
  const count = (s: string) => SUPPLY_CATALOG.filter((i) => i.section === s).length;
  assert(
    // Unified Restaurant phase G added dish soap and cleaning liquid to the packaging
    // section's "Securing & hygiene" group (audit decision 6): 50 → 52, 15 → 17.
    SUPPLY_CATALOG.length === 52 &&
      count("culinary") === 18 &&
      count("service") === 17 &&
      count("packaging") === 17,
    "A1. 52 supply lines: 18 culinary smallwares, 17 tableware, 17 takeaway packaging & hygiene",
  );
  assert(new Set(SUPPLY_CATALOG.map((i) => i.id)).size === 52, "A2. every supply id is unique");
  assert(
    SUPPLY_CATALOG.every((i) => SUPPLY_SECTIONS[i.section].groups.includes(i.group)) &&
      Object.values(SUPPLY_SECTIONS).every((s) =>
        s.groups.every((g) => SUPPLY_CATALOG.some((i) => i.group === g)),
      ),
    "A3. every line sits in one of its section's groups, and every group has lines",
  );
  const knifeLike = SUPPLY_CATALOG.filter((i) => /knife|knives|board/i.test(`${i.id} ${i.name}`));
  assert(
    knifeLike.every((i) => i.section === "service" && i.group === "Cutlery") &&
      knifeLike
        .map((i) => i.id)
        .sort()
        .join(",") === "dinner-knives,steak-knives" &&
      !SUPPLY_CATALOG.some((i) => /chef|paring|santoku|cleaver|cutting/i.test(i.name)),
    "A4. no prep knives or cutting boards (those stay in Knives / Cutting Boards); dinner + steak knives are tableware",
  );
  assert(
    SUPPLY_CATALOG.every((i) => !(i.id in INGREDIENTS)),
    "A5. no supply is an ingredient (never in INGREDIENTS, the fridge or perishability)",
  );
  assert(
    SUPPLY_CATALOG.every(
      (i) =>
        Number.isInteger(i.retailPackCents) &&
        i.retailPackCents > 0 &&
        Number.isInteger(i.packSize) &&
        i.packSize > 0 &&
        /^https:\/\/www\.webstaurantstore\.com\/.+\.html$/.test(i.source.url) &&
        i.source.product.length > 10,
    ) && SUPPLY_PRICES_RETRIEVED === "2026-10-02",
    "A6. every price is a real pack price with its source product page and retrieval date",
  );
  assert(
    SUPPLY_WHOLESALE_FACTOR === 0.65 &&
      SUPPLY_CATALOG.every(
        (i) =>
          supplyPackPrice(i) === Math.round(i.retailPackCents * 0.65) && supplyPackPrice(i) > 0,
      ),
    "A7. game price = round(retail × 0.65), whole cents — the same rule as Business ingredients",
  );
  const pricing = read("src/game/business/businessPricing.ts");
  assert(/~65% of retail/.test(pricing), "A8. that 65% rule is the documented ingredient rule");
}

// ===== B. A successful purchase =====
{
  const before = saveWith(100_000);
  const item = getSupplyItem("dinner-plates")!;
  const quote = supplyQuote(before, item, 2);
  const { result, save } = appPurchase(before, "dinner-plates", 2);
  const stock = save.business.supplies.stock["dinner-plates"];
  assert(
    result.ok &&
      save.credits === 100_000 - quote.totalCost &&
      quote.totalCost === supplyPackPrice(item) * 2 &&
      stock?.units === 24 &&
      stock?.costBasis === quote.totalCost,
    "B1. buying 2 packs of dinner plates: wallet − exact cost, +24 plates, cost basis = what was paid",
    { credits: save.credits, stock },
  );
  const entries = save.economyLedger;
  assert(
    entries.length === 1 &&
      entries[0]!.category === "supply-equipment-purchase" &&
      entries[0]!.amount === -quote.totalCost &&
      entries[0]!.description === "dinner-plates",
    "B2. exactly ONE ledger entry, its exact cost, described by the supply id",
    entries,
  );
  const acc = save.business.finance.dailyAccumulator;
  assert(
    acc.capitalExpenditure === quote.totalCost &&
      acc.packagingPurchaseCost === 0 &&
      acc.inventoryPurchaseCost === 0 &&
      save.business.finance.lifetime.capitalExpenditure === quote.totalCost,
    "B3. tableware is equipment: recorded as capital, not stock or cost",
  );
  const lt = save.business.supplies.lifetime.service;
  assert(
    lt.spent === quote.totalCost &&
      lt.retailValue === item.retailPackCents * 2 &&
      lt.purchases === 1,
    "B4. section lifetime: spent, retail value and one Market order",
  );
  const p = appPurchase(save, "microwave-containers", 1);
  const pItem = getSupplyItem("microwave-containers")!;
  const pAcc = p.save.business.finance.dailyAccumulator;
  assert(
    p.result.ok &&
      p.save.economyLedger.length === 2 &&
      p.save.economyLedger[1]!.category === "supply-packaging-purchase" &&
      pAcc.packagingPurchaseCost === supplyPackPrice(pItem) &&
      pAcc.capitalExpenditure === quote.totalCost &&
      p.save.business.supplies.stock["microwave-containers"]?.units === 150,
    "B5. packaging is a stock asset: its own ledger category and P&L line; +150 containers",
  );
  const again = appPurchase(p.save, "dinner-plates", 1);
  const s2 = again.save.business.supplies.stock["dinner-plates"]!;
  assert(
    s2.units === 36 && s2.costBasis === quote.totalCost + supplyPackPrice(item),
    "B6. buying more adds to the same line (units and cost basis)",
  );
  assert(
    again.save.economyLedger.reduce((sum, e) => sum + e.amount, 0) === again.save.credits - 100_000,
    "B7. opening cash + signed ledger = closing cash",
  );
}

// ===== C. Atomic failures =====
{
  const base = saveWith(500);
  const cases: Array<[string, number, string]> = [
    ["chef-knife", 1, "unknownSupply"],
    ["tomato", 1, "unknownSupply"],
    ["dinner-forks", 0, "invalidQuantity"],
    ["dinner-forks", -1, "invalidQuantity"],
    ["dinner-forks", 1.5, "invalidQuantity"],
    ["dinner-forks", MAX_SUPPLY_PACKS + 1, "invalidQuantity"],
    ["dinner-plates", 1, "insufficientFunds"],
  ];
  const bad = cases.filter(([id, n, reason]) => {
    const { result, save } = appPurchase(base, id, n);
    return result.ok || result.reason !== reason || save !== base;
  });
  assert(
    bad.length === 0 &&
      base.credits === 500 &&
      base.economyLedger.length === 0 &&
      Object.keys(base.business.supplies.stock).length === 0,
    "C. unknown item, 0 / negative / fractional / too many packs, not enough money: refused, nothing changes",
    bad,
  );
  const exact = saveWith(supplyPackPrice(getSupplyItem("dinner-plates")!));
  const r = purchaseSupply(exact, "dinner-plates", 1);
  assert(
    r.ok && r.save.credits === 0,
    "C2. spending to exactly $0 is allowed; never below (no debt)",
  );
}

// ===== D. Packaging use =====
{
  let s = saveWith(100_000);
  for (const [id, n] of [
    ["kraft-boxes", 1],
    ["microwave-containers", 1],
    ["carry-bags", 1],
    ["paper-bags", 1],
    ["dinner-plates", 1],
  ] as const)
    s = appPurchase(s, id, n).save;
  const supplies = s.business.supplies;
  const use = takePackagingForOrder(supplies);
  const micro = supplies.stock["microwave-containers"]!;
  const bags = supplies.stock["paper-bags"]!;
  assert(
    use.used.map((u) => u.id).join(",") === "microwave-containers,paper-bags" &&
      use.supplies.stock["microwave-containers"]!.units === micro.units - 1 &&
      use.supplies.stock["paper-bags"]!.units === bags.units - 1 &&
      use.supplies.stock["kraft-boxes"]!.units === supplies.stock["kraft-boxes"]!.units &&
      use.supplies.stock["carry-bags"]!.units === supplies.stock["carry-bags"]!.units,
    "D1. a served order uses one container and one bag, by priority (microwavable container, kraft paper bag)",
  );
  assert(
    use.cost ===
      Math.round(micro.costBasis / micro.units) + Math.round(bags.costBasis / bags.units) &&
      use.supplies.stock["microwave-containers"]!.costBasis ===
        micro.costBasis - Math.round(micro.costBasis / micro.units) &&
      use.supplies.lifetime.packaging.unitsUsed === 2 &&
      use.supplies.lifetime.packaging.usedCost === use.cost,
    "D2. their cost is their share of what was paid (cost basis) → this order's packaging COGS",
  );
  assert(
    use.supplies.stock["dinner-plates"]!.units === 12,
    "D3. equipment (plates) is never used up by an order",
  );
  const empty = defaultSuppliesState();
  const none = takePackagingForOrder(empty);
  assert(
    none.used.length === 0 && none.cost === 0 && none.supplies === empty,
    "D4. no packaging in stock: the order uses none and nothing changes (never blocks a serve)",
  );
  let one = appPurchase(saveWith(100_000), "carry-bags", 1).save.business.supplies;
  one = {
    ...one,
    stock: { "carry-bags": { units: 1, costBasis: 7 } },
  };
  const last = takePackagingForOrder(one);
  assert(
    last.cost === 7 && last.supplies.stock["carry-bags"] === undefined,
    "D5. the last unit takes whatever cost basis is left; the line empties cleanly",
  );
  assert(
    ORDER_CONTAINER_PRIORITY.every(
      (id) =>
        getSupplyItem(id)?.group === "Containers" || getSupplyItem(id)?.group === "Boxes & wraps",
    ) && ORDER_BAG_PRIORITY.every((id) => getSupplyItem(id)?.group === "Bags & carriers"),
    "D6. only takeaway containers/boxes and carry bags are used per order",
  );
  const serve = read("src/game/business/BusinessServiceManager.ts");
  assert(
    /const packaging = takePackagingForOrder\(save\.business\.supplies\);/.test(serve) &&
      /const cogs = ingredientCogs \+ packaging\.cost;/.test(serve) &&
      /supplies: packaging\.supplies,/.test(serve),
    "D7. serveBusinessOrder uses packaging after the ingredients and adds its cost to the order's COGS",
  );
}

// ===== E. Finance =====
{
  const acc = {
    ...DEFAULT_DAILY_ACCUMULATOR,
    revenue: 5_000,
    cogs: 1_200,
    inventoryPurchaseCost: 2_000,
    packagingPurchaseCost: 1_820,
    capitalExpenditure: 3_704,
  };
  const closingCash = 50_000;
  const pnl = computeDailyPnL({
    cashBeforeSettlement: closingCash,
    closingCash,
    accumulator: acc,
    staffCost: 0,
    inspectionFines: 0,
    spoilageValue: 0,
  });
  assert(
    pnl.netCashChange ===
      acc.revenue -
        acc.inventoryPurchaseCost -
        acc.packagingPurchaseCost -
        acc.capitalExpenditure &&
      pnl.packagingPurchaseCost === 1_820 &&
      pnl.operatingCashFlow ===
        acc.revenue - acc.inventoryPurchaseCost - acc.packagingPurchaseCost &&
      pnl.operatingProfit === acc.revenue - acc.cogs,
    "E1. Daily P&L: supplies move cash (packaging in operating cash flow, equipment as capital) but are not P&L expenses; the cash identity holds",
    pnl,
  );
  const food = saveWith(100_000);
  const before = purchasingStats(food);
  const after = purchasingStats(
    appPurchase(appPurchase(food, "kraft-boxes", 2).save, "stock-pot", 1).save,
  );
  assert(
    JSON.stringify(before) === JSON.stringify(after),
    "E2. ingredient purchasing analytics stay food-only (supply purchases never count as ingredient purchases)",
  );
  assert(
    businessLedgerEntries([
      { id: "1", timestamp: 0, category: "supply-equipment-purchase", amount: -1 },
      { id: "2", timestamp: 0, category: "supply-packaging-purchase", amount: -1 },
    ]).length === 2,
    "E3. both supply categories are Business ledger categories (never Campaign's)",
  );
  assert(
    LEDGER_CATEGORY_LABEL["supply-equipment-purchase"].length > 0 &&
      LEDGER_CATEGORY_LABEL["supply-packaging-purchase"].length > 0 &&
      EXPENSE_CATEGORIES.includes("supply-equipment-purchase") &&
      EXPENSE_CATEGORIES.includes("supply-packaging-purchase"),
    "E4. both categories have player-facing labels and are listed as expenses",
  );
}

// ===== F. Savings never grant money =====
{
  let s = saveWith(100_000);
  for (const id of ["stock-pot", "dinner-forks", "paper-bags"]) s = appPurchase(s, id, 3).save;
  const all = (["culinary", "service", "packaging"] as const).map((sec) =>
    supplySectionSummary(s.business.supplies, sec),
  );
  const spent = all.reduce((sum, x) => sum + x.spent, 0);
  const saved = all.reduce((sum, x) => sum + x.savedVsRetail, 0);
  const retail = ["stock-pot", "dinner-forks", "paper-bags"].reduce(
    (sum, id) => sum + getSupplyItem(id)!.retailPackCents * 3,
    0,
  );
  assert(
    saved === retail - spent && s.credits === 100_000 - spent,
    "F1. saved vs retail = retail value − paid (display only); the wallet only ever goes down by what was paid",
    { saved, retail, spent, credits: s.credits },
  );
  const summary = supplySectionSummary(s.business.supplies, "culinary");
  assert(
    summary.unitsOnHand === 3 && summary.stockValue === summary.spent && summary.purchases === 1,
    "F2. section summary: units on hand, stock value (cost basis) and orders come from the saved stock",
  );
  const low = isLowSupply(s.business.supplies, getSupplyItem("paper-bags")!, 10);
  const lowEquip = isLowSupply(s.business.supplies, getSupplyItem("frying-pans")!, 10);
  const lowEmpty = isLowSupply(s.business.supplies, getSupplyItem("carry-bags")!, 10);
  assert(
    !low && !lowEquip && lowEmpty,
    "F3. low stock: packaging below today's customers is low; equipment never is",
  );
}

// ===== G. Saves =====
{
  assert(
    JSON.stringify(DEFAULT_SAVE.business.supplies) === JSON.stringify(defaultSuppliesState()) &&
      Object.keys(DEFAULT_SAVE.business.supplies.stock).length === 0,
    "G1. a new save starts with no supplies (no prototype opening stock)",
  );
  const messy = migrateBusinessSuppliesState({
    stock: {
      "dinner-forks": { units: 24, costBasis: 900 },
      "not-a-thing": { units: 5, costBasis: 10 },
      "stock-pot": { units: -3, costBasis: 100 },
      "paper-bags": { units: 12.7, costBasis: "x" },
    },
    lifetime: { service: { spent: 900, retailValue: 1398, purchases: 2, unitsUsed: -1 } },
  });
  assert(
    messy.stock["dinner-forks"]?.units === 24 &&
      messy.stock["not-a-thing" as "dinner-forks"] === undefined &&
      messy.stock["stock-pot"] === undefined &&
      messy.stock["paper-bags"]?.units === 12 &&
      messy.stock["paper-bags"]?.costBasis === 0 &&
      messy.lifetime.service.spent === 900 &&
      messy.lifetime.service.unitsUsed === 0 &&
      messy.lifetime.culinary.spent === 0,
    "G2. migration keeps known stock and totals; drops unknown/negative lines; never a negative or fractional number",
  );
  assert(
    JSON.stringify(migrateBusinessSuppliesState(messy)) === JSON.stringify(messy) &&
      JSON.stringify(migrateBusinessSuppliesState(undefined)) ===
        JSON.stringify(defaultSuppliesState()),
    "G3. the migration is idempotent, and no stored supplies → empty",
  );
  const old = JSON.parse(JSON.stringify(saveWith(12_345)));
  delete old.business.supplies;
  delete old.business.finance.dailyAccumulator.packagingPurchaseCost;
  delete old.business.finance.lifetime.packagingPurchaseCost;
  store.set("knifecraft.save.v1", JSON.stringify(old));
  const loaded = await SaveManager.load();
  assert(
    loaded.credits === 12_345 &&
      Object.keys(loaded.business.supplies.stock).length === 0 &&
      loaded.business.supplies.lifetime.packaging.spent === 0 &&
      loaded.business.finance.dailyAccumulator.packagingPurchaseCost === 0 &&
      loaded.business.finance.lifetime.packagingPurchaseCost === 0,
    "G4. an old save (before supplies) loads through the REAL SaveManager.load with empty supplies and zero packaging totals",
  );
  const sm = read("src/game/SaveManager.ts");
  assert(
    /supplies: migrateBusinessSuppliesState\(partial\.business\?\.supplies\)/.test(sm),
    "G5. SaveManager.load migrates `business.supplies` with the one supplies migration",
  );
}

// ===== H. Campaign independence + wiring =====
{
  const campaignFiles = [
    "src/game/economy/EconomySettlement.ts",
    "src/game/levels/levelRewards.ts",
    "src/game/scenes/PreparationScene.ts",
  ];
  assert(
    campaignFiles.every((f) => !/businessSupplies|BusinessSuppliesManager/.test(read(f))),
    "H1. Campaign never reads supplies (settlement, level rewards, preparation)",
  );
  const shop = read("src/components/kc/Shop.tsx");
  assert(
    /\| SupplySection;/.test(shop) &&
      /id: "culinary"/.test(shop) &&
      /id: "service"/.test(shop) &&
      /id: "packaging"/.test(shop) &&
      /id: "knives"/.test(shop) &&
      /id: "boards"/.test(shop) &&
      /<MarketSupplies/.test(shop),
    "H2. the Market has the three supply sections next to its own Knives and Cutting Boards",
  );
  // Supplies stock moved from Business → Supplies to Inventory → Supplies; its spending
  // history (spent, saved vs retail, used by orders) to Business → Operations.
  const biz = read("src/components/kc/inventory/InventorySupplies.tsx").replace(/\/\/.*$/gm, "");
  const ops = read("src/components/kc/business/BusinessAnalytics.tsx").replace(/\/\/.*$/gm, "");
  assert(
    !/purchaseSupply|supplyQuote|More packs|Fewer packs/.test(biz) &&
      /openMarketSupplies/.test(biz) &&
      /supplySectionSummary/.test(biz) &&
      !/purchaseSupply|supplyQuote/.test(ops) &&
      /supplySectionSummary/.test(ops),
    "H3. Inventory → Supplies shows saved stock, Business → Operations the spending — neither has purchase controls (restock links to the Market)",
  );
  const tabs = read("src/components/kc/business/businessTabs.ts");
  const data = read("src/components/kc/data.ts");
  assert(
    !/supplies/.test(tabs) &&
      !/business-supplies/.test(data) &&
      /\| "inventory-supplies"/.test(data) &&
      /\| "shop-supplies"/.test(data),
    "H4. routes: Inventory → Supplies (no Business Supplies tab) and the Market's supply deep link",
  );
  const app = read("src/App.tsx");
  const wrapper = app.slice(
    app.indexOf("function purchaseSupply("),
    app.indexOf("function purchaseRefrigerator("),
  );
  assert(
    (wrapper.match(/appendLedgerEntry\(/g) ?? []).length === 1 &&
      /persist\(/.test(wrapper) &&
      /if \(result\.ok\)/.test(wrapper) &&
      !/localStorage/.test(wrapper),
    "H5. App.purchaseSupply: one ledger entry, one persist, only on success, no localStorage",
  );
  assert(
    !/localStorage/.test(
      read("src/game/business/businessSupplies.ts") +
        read("src/game/business/BusinessSuppliesManager.ts"),
    ),
    "H6. supplies never touch localStorage (saved through SaveManager only)",
  );
}

console.log(
  failures === 0
    ? "\nBUSINESS SUPPLIES QA: ALL PASS"
    : `\nBUSINESS SUPPLIES QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
