/**
 * INVENTORY_SCREEN_QA — the Inventory section (bottom bar → Inventory):
 * the restaurant's stock control, split out of Business. Checks, against
 * the real production state and functions:
 *
 *   N  navigation: a 5-item bottom bar Kitchen · Market · Inventory · Business ·
 *      Progress; Inventory is its own screen; Business has no Inventory tab and
 *      no "business-inventory" route is left
 *   A  all 57 ingredients are represented, each with the save's own quantity,
 *      cost and freshness; fridge model and capacity come from the save
 *   S  one central status rule (inventoryStatus.ts): expired, spoils tonight,
 *      critical, expiring, low, healthy — and its thresholds are the existing ones
 *   T  Needs Attention: expired / spoils-tonight / low items appear, healthy ones
 *      never do; summary counts are the existing selectors' own
 *   O  sorting: "status" puts what needs attention first
 *   R  read-only: the view never changes the save; Restock only navigates to
 *      Market → Ingredients and Upgrade only to Business → Equipment
 *   C  save compatibility: an existing save loads through the real
 *      SaveManager.load with money, inventory, fridge, freshness and Business
 *      progress unchanged, and viewing it changes nothing
 *
 * Run: npx tsx scripts/inventory-screen-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

// Minimal localStorage shim so section C can exercise the REAL SaveManager.load().
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
type IngredientId = keyof typeof INGREDIENTS;
const { shelfLifeForIngredient, perishabilityStateFor } =
  await import("../src/game/business/perishability.ts");
const A = await import("../src/game/business/inventoryAnalytics.ts");
const V = await import("../src/game/business/inventoryView.ts");
const ST = await import("../src/game/business/inventoryStatus.ts");
const { businessTabForScreen, BUSINESS_TAB_SCREEN } =
  await import("../src/components/kc/business/businessTabs.ts");

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const walk = (dir: string): string[] =>
  fs
    .readdirSync(path.resolve(ROOT, dir), { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else console.log(`ok   ${label}`);
}

const DAY = 7;
type Stock = Partial<
  Record<IngredientId, { quantity: number; unitCost: number; purchaseDay: number }>
>;
function saveWith(stock: Stock = {}, business: Partial<SaveData["business"]> = {}): SaveData {
  const inventory = Object.fromEntries(
    Object.entries(stock).map(([id, e]) => [id, { ingredientId: id, ...e }]),
  );
  return {
    ...DEFAULT_SAVE,
    credits: 123_456,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { ...DEFAULT_BUSINESS_STATE.calendar, businessDay: DAY },
      inventory,
      ...business,
    },
  } as SaveData;
}
const ALL_IDS = Object.keys(INGREDIENTS) as IngredientId[];

// ===== N: navigation =====
{
  const nav = read("src/components/kc/Kitchen.tsx");
  const labels = [
    // The Business tab's label is "Restaurant" only in the Unified Restaurant test build
    // (RESTAURANT_MODE); the release build reads the classic label checked here.
    ...nav.matchAll(
      /\{ id: "([a-z-]+)", label: (?:RESTAURANT_MODE \? "Restaurant" : )?"([^"]+)", glyph: "([^"]+)" \}/g,
    ),
  ].map((m) => `${m[1]}:${m[2]}`);
  assert(
    labels.join() ===
      "kitchen:Kitchen,shop:Market,inventory:Inventory,business:Business,rack:Progress",
    "N1: the bottom bar has 5 sections — Kitchen · Market · Inventory · Business · Progress",
  );
  assert(
    /label: RESTAURANT_MODE \? "Restaurant" : "Business"/.test(nav),
    "N1b: in the restaurant build the Business tab is called Restaurant (one restaurant)",
  );
  assert(
    /min-h-12/.test(nav.match(/export function BottomNav[\s\S]*?<\/nav>/)?.[0] ?? ""),
    "N2: bottom-bar buttons are 48 px tall",
  );
  const router = read("src/ScreensRouter.tsx");
  const data = code(read("src/components/kc/data.ts"));
  // Lazy-load (task #24): the route may wrap it in its Suspense loading state; it is still its own screen.
  assert(
    /\| "inventory"/.test(data) &&
      /screen === "inventory" \|\| screen === "inventory-supplies" \? \(\s*(?:<Suspense fallback=\{<RestaurantLoading go=\{go\} active="inventory" \/>\}>\s*)?<InventoryScreen/.test(
        router,
      ) &&
      businessTabForScreen("inventory") === null,
    "N3: Inventory is its own screen, opened straight from the bottom bar",
  );
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  assert(
    !dash.includes(`label: "Inventory"`) &&
      !("inventory" in BUSINESS_TAB_SCREEN) &&
      !/BusinessInventory/.test(dash),
    "N4: Business no longer contains an Inventory tab",
  );
  const src = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
  const stale = src.filter((f) =>
    /business-inventory|BusinessInventory\.tsx|from "\.\/BusinessInventory"/.test(read(f)),
  );
  assert(
    stale.length === 0 &&
      !fs.existsSync(path.resolve(ROOT, "src/components/kc/business/BusinessInventory.tsx")),
    'N5: no "business-inventory" route or old BusinessInventory screen is left',
  );
  const screen = read("src/components/kc/inventory/InventoryScreen.tsx");
  assert(
    /\| "inventory-supplies"/.test(data) &&
      !/business-supplies/.test(data) &&
      /initialKind=\{screen === "inventory-supplies" \? "supplies" : "ingredients"\}/.test(
        router,
      ) &&
      /kind === "supplies" \? \(\s*<InventorySupplies/.test(screen) &&
      !dash.includes(`label: "Supplies"`) &&
      !("supplies" in BUSINESS_TAB_SCREEN) &&
      !fs.existsSync(path.resolve(ROOT, "src/components/kc/business/BusinessSupplies.tsx")),
    "N6: Inventory holds every kind of stock — Ingredients | Supplies; Business has no Supplies tab",
  );
}

// ===== U: supplies (smallwares, tableware & cutlery, takeaway parcels) =====
{
  const { SUPPLY_CATALOG } = await import("../src/game/business/businessSupplies.ts");
  const M = await import("../src/game/business/BusinessSuppliesManager.ts");
  const { businessCustomersToday } = await import("../src/game/business/BusinessServiceManager.ts");
  const s = saveWith();
  const supplies = {
    ...s.business.supplies,
    stock: {
      "dinner-forks": { units: 24, costBasis: 1_200 },
      "microwave-containers": { units: 30, costBasis: 363 },
      "kraft-boxes": { units: 5, costBasis: 100 },
      "paper-bags": { units: 12, costBasis: 144 },
    },
  };
  const cover = M.packagingOrdersCovered(supplies);
  assert(
    cover.containers === 35 && cover.bags === 12 && cover.orders === 12,
    "U1: takeaway orders covered = the smaller of containers and bags on hand (35 vs 12 → 12)",
  );
  const customers = businessCustomersToday({ ...s, business: { ...s.business, supplies } }).target;
  const low = SUPPLY_CATALOG.filter((item) => M.isLowSupply(supplies, item, customers));
  assert(
    low.every((i) => i.section === "packaging") &&
      !low.some((i) => i.id === "dinner-forks") &&
      low.some((i) => i.id === "foil-containers"),
    "U2: only packaging can be low (cutlery and other equipment is owned, never used up)",
  );
  const ui = read("src/components/kc/inventory/InventorySupplies.tsx");
  assert(
    /SUPPLY_CATALOG\.filter\(\(item\) => item\.section === section\)/.test(ui) &&
      // 52 since phase G (dish soap + cleaning liquid, audit decision 6).
      SUPPLY_CATALOG.length === 52 &&
      ["culinary", "service", "packaging"].every((sec) =>
        SUPPLY_CATALOG.some((i) => i.section === sec),
      ),
    "U3: all 52 supply lines (smallwares, tableware & cutlery, takeaway) can be shown",
  );
  const code2 = code(ui).replace(/^import type .*$/gm, "");
  assert(
    !/purchaseSupply|supplyQuote|debitWallet|appendLedgerEntry|persist\(|localStorage|setItem/.test(
      code2,
    ) &&
      /openMarketSupplies\(go, section\)/.test(code2) &&
      /openMarketSupplies\(go, item\.section, item\.id\)/.test(code2),
    "U4: Inventory → Supplies buys nothing; Restock opens the Market on that exact supply line",
  );
  assert(
    /supplyUnits\(supplies, item\.id\) > 0 && isLowSupply\(supplies, item, customers\)/.test(
      code2,
    ) &&
      /ordersCovered < customers/.test(code2) &&
      /lowAll\.slice\(0, 3\)/.test(code2),
    "U5: supplies Needs Attention stays short — one coverage alert, then only stocked lines running low (3 + View all)",
  );
}

// ===== A: all 57 ingredients, values from the save =====
{
  const stock: Stock = Object.fromEntries(
    ALL_IDS.map((id, i) => [
      id,
      { quantity: 1 + (i % 4), unitCost: 50 + i, purchaseDay: DAY - (i % 3) },
    ]),
  );
  const s = saveWith(stock, {
    refrigerator: {
      ...DEFAULT_BUSINESS_STATE.refrigerator,
      refrigeratorId: "professional-refrigerator",
    },
  });
  const v = V.inventoryView(s);
  assert(
    v.items.length === 57 &&
      new Set(v.items.map((i) => i.ingredientId)).size === 57 &&
      v.unknown.length === 0,
    "A1: all 57 ingredients can be represented, once each",
  );
  assert(
    v.items.every((i) => {
      const e = s.business.inventory[i.ingredientId]!;
      return (
        i.quantity === e.quantity &&
        i.unitPrice === e.unitCost &&
        i.stockValue === Math.round(e.quantity * e.unitCost) &&
        i.name === INGREDIENTS[i.ingredientId].name
      );
    }),
    "A2: quantity, average cost, value and name are the save's own",
  );
  assert(
    v.items.every((i) => {
      const e = s.business.inventory[i.ingredientId]!;
      return (
        i.daysRemaining ===
          Math.max(0, shelfLifeForIngredient(i.ingredientId) - (DAY - e.purchaseDay)) &&
        i.freshnessState === perishabilityStateFor(i.ingredientId, e.purchaseDay, DAY)
      );
    }),
    "A3: freshness and days remaining come from perishability.ts and the save's purchase day",
  );
  const fridge = A.fridgeStatus(s);
  assert(
    v.summary.fridgeName === "Professional Refrigerator" &&
      v.summary.fridgeShortName === "Professional" &&
      v.summary.capacity === 140 &&
      v.summary.capacity === fridge.capacity &&
      v.summary.used === fridge.used &&
      v.summary.available === fridge.available,
    "A4: fridge model and capacity come from the save (Professional, 140 units)",
  );
  const groups = new Set(A.INGREDIENT_GROUPS.map((g) => g.label));
  assert(
    v.items.every((i) => groups.has(i.category)),
    "A5: every item sits in one of the filter groups (Vegetables … Protein)",
  );
}

// ===== S: the central status rule =====
{
  const low = (dishesLeft: number) => ({
    id: "tomato" as IngredientId,
    usable: 1,
    threshold: 5,
    dishesLeft,
  });
  assert(
    ST.inventoryStatusFor(0, undefined) === "expired" &&
      ST.inventoryStatusFor(1, low(3)) === "spoils_today" &&
      ST.inventoryStatusFor(5, low(0)) === "critical" &&
      ST.inventoryStatusFor(A.EXPIRING_SOON_DAYS, undefined) === "expiring" &&
      ST.inventoryStatusFor(5, low(2)) === "low" &&
      ST.inventoryStatusFor(5, undefined) === "healthy",
    "S1: expired › spoils tonight › critical › expiring › low › healthy",
  );
  assert(
    ST.INVENTORY_STATUSES.every(
      (st) =>
        ST.INVENTORY_STATUS_META[st].label.length > 0 &&
        ST.INVENTORY_STATUS_META[st].marker.length > 0,
    ),
    "S2: every status has a word and a marker, never colour alone",
  );
  const fv = code(read("src/game/business/fridgeView.ts"));
  const iv = code(read("src/game/business/inventoryView.ts"));
  const statusSrc = code(read("src/game/business/inventoryStatus.ts"));
  assert(
    /inventoryStatusFor\(/.test(fv) &&
      !/daysLeft\s*<=\s*\d|daysLeft\s*===\s*\d/.test(fv) &&
      !/inventoryStatusFor|daysRemaining\s*<=\s*\d/.test(iv.replace(/import[^;]*;/g, "")) &&
      /EXPIRING_SOON_DAYS/.test(statusSrc) &&
      /dishesLeft < 1/.test(statusSrc),
    "S3: one central rule — the fridge and the screen read the status, neither recomputes it; thresholds are the existing ones",
  );
}

// ===== T: needs attention =====
{
  const s = saveWith({
    cheddar: { quantity: 2, unitCost: 450, purchaseDay: DAY - 4 }, // Dairy 4 days → expired
    basil: { quantity: 1, unitCost: 300, purchaseDay: DAY - 2 }, // Herb 3 days → spoils tonight
    chicken: { quantity: 1, unitCost: 450, purchaseDay: DAY - 1 }, // Protein 3 days → expiring (2 left)
    tomato: { quantity: 0.25, unitCost: 100, purchaseDay: DAY }, // below today's menu need
    potato: { quantity: 30, unitCost: 60, purchaseDay: DAY }, // plenty, fresh
  });
  const v = V.inventoryView(s);
  const of = (id: string) => v.items.find((i) => i.ingredientId === id)!;
  const groupOf = (id: string) =>
    v.attention.find((g) => g.items.some((i) => i.ingredientId === id))?.id;
  assert(
    of("cheddar").status === "expired" && groupOf("cheddar") === "expired",
    "T1: expired items appear (Expired)",
  );
  assert(
    of("basil").status === "spoils_today" && groupOf("basil") === "spoils_today",
    "T2: spoiling-tonight items appear (Spoils tonight)",
  );
  const tomato = of("tomato");
  assert(
    (tomato.status === "critical" || tomato.status === "low") &&
      groupOf("tomato") !== undefined &&
      tomato.todayRequirement !== undefined &&
      tomato.todayRequirement > tomato.quantity,
    "T3: low-stock items appear, with today's menu requirement",
  );
  assert(
    of("potato").status === "healthy" && groupOf("potato") === undefined,
    "T4: healthy items never appear as urgent",
  );
  assert(
    v.attention.map((g) => g.id).join() ===
      ["expired", "spoils_today", "critical", "low", "expiring"]
        .filter((id) => v.attention.some((g) => g.id === id))
        .join() && v.attentionCount === v.attention.reduce((n, g) => n + g.items.length, 0),
    "T5: groups are ordered most urgent first",
  );
  assert(
    v.summary.runningLow === A.lowStockItems(s).length &&
      v.summary.expiringSoon === A.expiringSoon(s).length &&
      v.summary.readyDishes === A.menuReadiness(s).ready &&
      v.summary.menuDishes === A.menuReadiness(s).total &&
      v.summary.stockValue === A.fridgeStatus(s).stockValue,
    "T6: summary cards use the existing selectors (low stock, expiring soon, menu readiness, stock value)",
  );
  const demand = A.menuDemand(s).get("tomato")!;
  assert(
    tomato.todayRequirement === Math.round(demand.perDay * 1000) / 1000 && tomato.afterToday === 0,
    "T7: today's requirement is menuDemand's perDay; what's left after service never goes below 0",
  );
}

// ===== O: sorting =====
{
  const s = saveWith({
    potato: { quantity: 30, unitCost: 60, purchaseDay: DAY },
    cheddar: { quantity: 2, unitCost: 450, purchaseDay: DAY - 4 },
    basil: { quantity: 1, unitCost: 300, purchaseDay: DAY - 2 },
  });
  const items = V.inventoryView(s).items;
  const byStatus = V.sortInventory(items, "status").map((i) => i.ingredientId);
  assert(
    byStatus.join() === "cheddar,basil,potato",
    "O1: default sort puts what needs attention first, healthy stock last",
  );
  assert(
    V.sortInventory(items, "name")
      .map((i) => i.name)
      .join() === "Basil,Cheddar,Potato" &&
      V.sortInventory(items, "quantity")[0]!.ingredientId === "potato" &&
      V.sortInventory(items, "value")[0]!.ingredientId === "potato" &&
      V.sortInventory(items, "freshness")[0]!.ingredientId === "cheddar" &&
      V.INVENTORY_SORTS.map((o) => o.id).join() === "status,quantity,freshness,value,name",
    "O2: sort by Status, Quantity, Freshness, Value, Name",
  );
}

// ===== R: read-only =====
{
  const s = saveWith({ tomato: { quantity: 3, unitCost: 100, purchaseDay: DAY - 1 } });
  const before = JSON.stringify(s);
  const a = JSON.stringify(V.inventoryView(s));
  const b = JSON.stringify(V.inventoryView(s));
  assert(
    JSON.stringify(s) === before && a === b,
    "R1: the view never changes the save and is deterministic",
  );
  const screen = code(read("src/components/kc/inventory/InventoryScreen.tsx")).replace(
    /^import type .*$/gm,
    "",
  );
  const view = code(read("src/game/business/inventoryView.ts")).replace(/^import type .*$/gm, "");
  const banned =
    /purchaseIngredient|purchaseQuote|todaysUnitCost|purchaseRefrigerator|performRefrigeratorMaintenance|debitWallet|appendLedgerEntry|persist\(|localStorage|setItem|Math\.random|SaveManager/;
  assert(
    !banned.test(screen) && !banned.test(view),
    "R2: Inventory buys, repairs and stores nothing",
  );
  assert(
    /openMarketIngredients\(go, id\)/.test(screen) &&
      /const toEquipment = \(\) => go\(BUSINESS_TAB_SCREEN\.equipment\)/.test(screen) &&
      /go\(BUSINESS_TAB_SCREEN\.overview\)/.test(screen) &&
      /Restock in Market →/.test(screen) &&
      /Upgrade Refrigerator →/.test(screen) &&
      /View Business Performance →/.test(screen),
    "R3: Restock → Market → Ingredients, Upgrade Refrigerator → Business → Equipment, View Business Performance → Overview",
  );
  assert(
    !/useState<[^>]*(Inventory|Stock|Entry)\b[^>]*>/.test(screen.replace(/InventorySort/g, "")) &&
      !/newInventoryState|setInventory|setStock/.test(screen + view),
    "R4: no second inventory state — only view selections (filter, sort, the open item)",
  );
}

// ===== D: Throw Out Expired =====
{
  const D = await import("../src/game/business/discardExpired.ts");
  const { endBusinessDay } = await import("../src/game/business/BusinessDayManager.ts");
  const { migrateBusinessFinanceState } =
    await import("../src/game/business/BusinessFinanceManager.ts");
  const stock: Stock = {
    cheddar: { quantity: 2, unitCost: 450, purchaseDay: DAY - 4 }, // expired today
    salmon: { quantity: 1, unitCost: 650, purchaseDay: DAY - 3 }, // expired today
    basil: { quantity: 1, unitCost: 300, purchaseDay: DAY - 2 }, // spoils tonight (still usable)
    potato: { quantity: 10, unitCost: 60, purchaseDay: DAY }, // fresh
  };
  const s0 = saveWith(stock, {
    equipmentCondition: { ...DEFAULT_BUSINESS_STATE.equipmentCondition, refrigeratorCondition: 40 },
  });
  const r = D.discardExpiredStock(s0);
  assert(
    r.ok &&
      r.ingredientIds.sort().join() === "cheddar,salmon" &&
      !r.save.business.inventory.cheddar &&
      !r.save.business.inventory.salmon &&
      JSON.stringify(r.save.business.inventory.basil) ===
        JSON.stringify(s0.business.inventory.basil) &&
      JSON.stringify(r.save.business.inventory.potato) ===
        JSON.stringify(s0.business.inventory.potato),
    "D1: Throw Out Expired removes only expired stock — spoiling-tonight and fresh stock stay",
  );
  assert(
    r.ok &&
      r.save.credits === s0.credits &&
      r.save.economyLedger.length === s0.economyLedger.length &&
      r.value === D.wasteValueFor(s0, 2 * 450 + 650) &&
      r.save.business.spoilage.totalSpoiledValue ===
        s0.business.spoilage.totalSpoiledValue + r.value &&
      r.save.business.finance.dailyAccumulator.discardedValue === r.value &&
      r.save.business.finance.dailyAccumulator.discardedQuantity === 3,
    "D2: it's waste, not money — no credits or ledger change; recorded with End Business Day's multipliers",
  );
  const waited = endBusinessDay(s0);
  const early = endBusinessDay((r as { ok: true; save: SaveData }).save);
  assert(
    JSON.stringify(early.inspectionReport) === JSON.stringify(waited.inspectionReport) &&
      early.dailyPnL.spoilageValue === waited.dailyPnL.spoilageValue &&
      early.spoiledQuantity === waited.spoiledQuantity &&
      early.spoiledValue === waited.spoiledValue &&
      early.save.credits === waited.save.credits &&
      JSON.stringify(early.save.business.inventory) ===
        JSON.stringify(waited.save.business.inventory) &&
      JSON.stringify(early.save.business.spoilage) ===
        JSON.stringify(waited.save.business.spoilage) &&
      early.save.business.popularity.score === waited.save.business.popularity.score &&
      early.save.business.finance.dailyAccumulator.discardedValue === 0,
    "D3: throwing out early then ending the day = just ending the day (inspection, waste, P&L, cash, inventory, popularity)",
  );
  const none = D.discardExpiredStock(
    saveWith({ potato: { quantity: 10, unitCost: 60, purchaseDay: DAY } }),
  );
  assert(!none.ok && none.reason === "nothingExpired", "D4: nothing expired → nothing happens");
  const migrated = migrateBusinessFinanceState(
    {
      dailyAccumulator: {
        revenue: 5,
        cogs: 0,
        inventoryPurchaseCost: 0,
        maintenanceCost: 0,
        supplierCost: 0,
        capitalExpenditure: 0,
      },
    },
    [],
  );
  assert(
    migrated.dailyAccumulator.discardedQuantity === 0 &&
      migrated.dailyAccumulator.discardedValue === 0 &&
      migrated.dailyAccumulator.revenue === 5,
    "D5: a save from before Throw Out Expired migrates its counters as 0",
  );
}

// ===== C: save compatibility =====
{
  const stored = saveWith(
    {
      tomato: { quantity: 7, unitCost: 95, purchaseDay: 5 },
      basil: { quantity: 1.5, unitCost: 310, purchaseDay: 6 },
      chicken: { quantity: 2, unitCost: 450, purchaseDay: 7 },
    },
    {
      refrigerator: {
        ...DEFAULT_BUSINESS_STATE.refrigerator,
        refrigeratorId: "commercial-refrigerator",
      },
      equipmentCondition: {
        ...DEFAULT_BUSINESS_STATE.equipmentCondition,
        refrigeratorCondition: 64,
      },
      popularity: { ...DEFAULT_BUSINESS_STATE.popularity, score: 71 },
    },
  );
  store.set("knifecraft.save.v1", JSON.stringify(stored));
  const loaded = await SaveManager.load();
  const snapshot = JSON.stringify({
    credits: loaded.credits,
    inventory: loaded.business.inventory,
    refrigerator: loaded.business.refrigerator,
    condition: loaded.business.equipmentCondition,
    calendar: loaded.business.calendar,
    popularity: loaded.business.popularity,
    menu: loaded.business.menuActivation,
    contract: loaded.business.supplierContract,
    finance: loaded.business.finance,
  });
  assert(
    loaded.credits === 123_456 &&
      JSON.stringify(loaded.business.inventory) === JSON.stringify(stored.business.inventory) &&
      loaded.business.refrigerator.refrigeratorId === "commercial-refrigerator" &&
      loaded.business.equipmentCondition.refrigeratorCondition === 64 &&
      loaded.business.popularity.score === 71,
    "C1: an existing save loads with money, inventory, fridge, condition and popularity unchanged",
  );
  const v = V.inventoryView(loaded);
  const after = JSON.stringify({
    credits: loaded.credits,
    inventory: loaded.business.inventory,
    refrigerator: loaded.business.refrigerator,
    condition: loaded.business.equipmentCondition,
    calendar: loaded.business.calendar,
    popularity: loaded.business.popularity,
    menu: loaded.business.menuActivation,
    contract: loaded.business.supplierContract,
    finance: loaded.business.finance,
  });
  assert(
    after === snapshot &&
      v.summary.fridgeShortName === "Commercial" &&
      v.summary.capacity === 80 &&
      v.items.find((i) => i.ingredientId === "tomato")!.daysRemaining ===
        shelfLifeForIngredient("tomato") - (DAY - 5),
    "C2: the Inventory screen shows the loaded save as it is (Commercial, 80 units, freshness from the save) and changes nothing",
  );
  assert(
    !/inventory|fridge/i.test(
      (code(read("src/game/SaveManager.ts")).match(/migrate[A-Za-z]*\(/g) ?? [])
        .filter((m) => /Inventory|Fridge/.test(m))
        .join(),
    ),
    "C3: no save migration was added for this screen",
  );
}

console.log(
  failures === 0
    ? "\nINVENTORY SCREEN QA: ALL PASS"
    : `\nINVENTORY SCREEN QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
