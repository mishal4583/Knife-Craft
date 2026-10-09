/**
 * FRIDGE_VIEW_QA — the physical refrigerator on the Inventory screen
 * (fridgeView.ts + kc/inventory/fridge/PhysicalFridge). Checks it against the
 * real production state and functions:
 *
 *   A  the design handoff's 57 ingredient ids map explicitly to production;
 *      every ingredient has a fridge zone (dairy top, vegetables middle,
 *      fruit/greens in drawers, butter/aromatics in the door, no egg tray)
 *   B  tiers, capacities and prices come from refrigeratorDefinitions
 *   C  quantity, value, paid price and used space come from business.inventory
 *   D  freshness is the aggregate entry's (one item per ingredient, no batches)
 *   E  Needs Attention = expired / spoils tonight / expiring / low for today
 *   F  unknown inventory keys are listed, never dropped
 *   G  the adapter is pure and deterministic (the save is never changed)
 *   H  the UI only navigates: no purchase, wallet, ledger, storage or randomness;
 *      the door handle never takes a tap; touch targets ≥ 48 px
 *
 * Run: npx tsx scripts/fridge-view-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = typeof DEFAULT_SAVE;
const { DEFAULT_BUSINESS_STATE } = await import("../src/game/business/businessTypes.ts");
const { INGREDIENTS } = await import("../src/game/definitions.ts");
type IngredientId = keyof typeof INGREDIENTS;
const { REFRIGERATOR_CATALOG } = await import("../src/game/business/refrigeratorDefinitions.ts");
const { shelfLifeForIngredient } = await import("../src/game/business/perishability.ts");
const A = await import("../src/game/business/inventoryAnalytics.ts");
const F = await import("../src/game/business/fridgeView.ts");

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
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { ...DEFAULT_BUSINESS_STATE.calendar, businessDay: DAY },
      inventory,
      ...business,
    },
  } as SaveData;
}
const ALL_IDS = Object.keys(INGREDIENTS) as IngredientId[];

// ===== A: ids and zones =====
{
  const map = F.HANDOFF_INGREDIENT_ID_MAP;
  const values = Object.values(map);
  assert(
    Object.keys(map).length === 57 &&
      new Set(values).size === 57 &&
      ALL_IDS.length === 57 &&
      ALL_IDS.every((id) => values.includes(id)) &&
      values.every((v) => v in INGREDIENTS),
    "A1: the handoff's 57 ingredient ids map one-to-one onto the 57 production ids",
  );
  assert(
    map["bell-pepper"] === "pepper" &&
      map["sweet-potato"] === "sweetpotato" &&
      map["green-chili"] === "chilli" &&
      map["green-onion"] === "springonion" &&
      map.ribeye === "steak",
    "A2: renamed ids are mapped explicitly (bell-pepper→pepper, ribeye→steak, …)",
  );
  const zoneIds = new Set(F.FRIDGE_ZONES.map((z) => z.id));
  assert(
    ALL_IDS.every((id) => zoneIds.has(F.fridgeZoneFor(id))),
    "A3: every production ingredient has a zone in the fridge",
  );
  const place = (id: IngredientId) =>
    F.FRIDGE_ZONES.find((z) => z.id === F.fridgeZoneFor(id))!.place;
  assert(
    F.FRIDGE_ZONES[0]!.id === "dairy" &&
      F.fridgeZoneFor("cheddar") === "dairy" &&
      F.fridgeZoneFor("mozzarella") === "dairy" &&
      F.fridgeZoneFor("tomato") === "vegetables" &&
      place("apple") === "drawer" &&
      place("basil") === "drawer" &&
      place("lettuce") === "drawer" &&
      place("butter") === "door" &&
      place("garlic") === "door" &&
      F.fridgeZoneFor("steak") === "protein",
    "A4: dairy top shelf, vegetables middle, fruit/greens in drawers, butter/aromatics in the door",
  );
  assert(
    !ALL_IDS.some((id) => /egg$|^eggs?$/i.test(id)) &&
      !F.FRIDGE_ZONES.some((z) => /egg/i.test(z.id + z.label)),
    "A5: no egg tray (production has no eggs)",
  );
  assert(
    ALL_IDS.every((id) => A.INGREDIENT_GROUPS.some((g) => g.label === F.fridgeGroupLabel(id))),
    "A6: category tabs are the Market's own ingredient groups",
  );
}

// ===== B: tiers =====
{
  const v0 = F.fridgeView(saveWith());
  assert(
    v0.tiers.map((t) => `${t.id}:${t.capacity}:${t.price}`).join() ===
      REFRIGERATOR_CATALOG.map((r) => `${r.id}:${r.capacity}:${r.price}`).join() &&
      v0.tiers.map((t) => t.capacity).join() === "40,80,140",
    "B1: tiers are the production catalog — Basic 40, Commercial 80, Professional 140",
  );
  assert(
    v0.tier.id === "basic-refrigerator" &&
      v0.capacity === 40 &&
      v0.nextTier?.id === "commercial-refrigerator" &&
      v0.nextTier.price === 200_000,
    "B2: a new Business has the Basic fridge; the next model is Commercial at $2,000.00",
  );
  const pro = F.fridgeView(
    saveWith({}, { refrigerator: { refrigeratorId: "professional-refrigerator" } }),
  );
  assert(
    pro.tier.rank === 2 && pro.capacity === 140 && pro.nextTier === null,
    "B3: Professional is the top model (no next tier)",
  );
}

// ===== B4: cooling is a status, never a temperature =====
{
  const at = (refrigeratorCondition: number) =>
    F.fridgeView(
      saveWith(
        {},
        {
          equipmentCondition: {
            ...DEFAULT_BUSINESS_STATE.equipmentCondition,
            refrigeratorCondition,
          },
        },
      ),
    ).cooling;
  const ui = read("src/components/kc/inventory/fridge/PhysicalFridge.tsx");
  const adapter = read("src/game/business/fridgeView.ts");
  assert(
    at(100) === "Refrigerated" &&
      at(50) === "Needs service" &&
      at(0) === "Broken" &&
      !/°|setPoint|temperature/i.test(code(ui) + code(adapter)),
    "B4: cooling shows Refrigerated / Needs service / Broken from the real condition — no simulated-looking temperature",
  );
}

// ===== C + D: stock and freshness =====
{
  const s = saveWith({
    tomato: { quantity: 25, unitCost: 100, purchaseDay: DAY },
    basil: { quantity: 2.5, unitCost: 333, purchaseDay: DAY - 1 },
    chicken: { quantity: 4, unitCost: 450, purchaseDay: DAY - 2 },
    cheddar: { quantity: 3, unitCost: 500, purchaseDay: DAY - 4 },
  });
  const v = F.fridgeView(s);
  const tomato = v.items.find((i) => i.id === "tomato")!;
  assert(
    tomato.quantity === 25 &&
      tomato.unitCost === 100 &&
      tomato.value === 2_500 &&
      tomato.daysLeft === shelfLifeForIngredient("tomato") &&
      tomato.freshness === 1 &&
      tomato.state === "FRESH",
    "C1: quantity, paid price and value come from the inventory entry (25 lb × $1.00 = $25.00)",
  );
  const status = A.fridgeStatus(s);
  assert(
    v.used === status.used &&
      v.capacity === status.capacity &&
      v.available === status.available &&
      v.stockValue === status.stockValue &&
      v.used === 34.5,
    "C2: used space, capacity and value are RefrigeratorManager/inventoryAnalytics' own",
  );
  const onHand = A.onHandItems(s);
  assert(
    v.items.length === 4 &&
      new Set(v.items.map((i) => i.id)).size === 4 &&
      onHand.every((o) => {
        const i = v.items.find((x) => x.id === o.id)!;
        return i.daysLeft === o.daysLeft && i.state === o.state && i.value === o.value;
      }),
    "D1: one item per ingredient, with the same freshness as inventoryAnalytics.onHandItems",
  );
  const chicken = v.items.find((i) => i.id === "chicken")!;
  const cheddar = v.items.find((i) => i.id === "cheddar")!;
  assert(
    chicken.daysLeft === 1 &&
      chicken.attention === "spoils-tonight" &&
      cheddar.daysLeft === 0 &&
      cheddar.attention === "expired",
    "D2: freshness follows the weighted purchaseDay (chicken spoils tonight, cheddar expired)",
  );
  assert(
    v.zones
      .find((z) => z.zone.id === "vegetables")!
      .items.map((i) => i.id)
      .join() === "tomato" &&
      v.zones
        .find((z) => z.zone.id === "greens-drawer")!
        .items.map((i) => i.id)
        .join() === "basil" &&
      v.zones
        .find((z) => z.zone.id === "protein")!
        .items.map((i) => i.id)
        .join() === "chicken",
    "D3: each item is drawn in its zone",
  );
  // ===== E: attention =====
  assert(
    v.attention.map((a) => `${a.id}:${a.reason}`).join() ===
      "cheddar:expired,chicken:spoils-tonight,basil:expiring",
    "E1: Needs Attention lists expired, then spoils tonight, then expiring soon",
  );
  // Low stock: an active-menu ingredient below today's demand, still fresh.
  const low = A.lowStockItems(
    saveWith({ tomato: { quantity: 0.25, unitCost: 100, purchaseDay: DAY } }),
  );
  const lv = F.fridgeView(
    saveWith({ tomato: { quantity: 0.25, unitCost: 100, purchaseDay: DAY } }),
  );
  assert(
    low.some((l) => l.id === "tomato") &&
      lv.attention.some((a) => a.id === "tomato" && a.reason === "low"),
    "E2: an ingredient below today's menu demand is flagged 'low for today'",
  );
}

// ===== F: unknown ids =====
{
  const s = saveWith({ tomato: { quantity: 1, unitCost: 100, purchaseDay: DAY } });
  (s.business.inventory as Record<string, unknown>)["dragonfruit"] = {
    ingredientId: "dragonfruit",
    quantity: 2,
    unitCost: 100,
    purchaseDay: DAY,
  };
  const v = F.fridgeView(s);
  assert(
    v.unknown.join() === "dragonfruit" && v.items.length === 1,
    "F1: an unknown inventory id is listed (not silently dropped, not drawn as a fake item)",
  );
}

// ===== G: pure and deterministic =====
{
  const s = saveWith({
    tomato: { quantity: 25, unitCost: 100, purchaseDay: DAY },
    salmon: { quantity: 2, unitCost: 650, purchaseDay: DAY - 1 },
  });
  const before = JSON.stringify(s);
  const a = JSON.stringify(F.fridgeView(s));
  const b = JSON.stringify(F.fridgeView(s));
  assert(
    JSON.stringify(s) === before && a === b,
    "G1: fridgeView never changes the save and is deterministic",
  );
}

// ===== H: UI only navigates =====
{
  const ui = code(read("src/components/kc/inventory/fridge/PhysicalFridge.tsx"));
  const adapter = code(read("src/game/business/fridgeView.ts")).replace(/^import type .*$/gm, "");
  const css = read("src/components/kc/inventory/fridge/PhysicalFridge.css");
  const inv = code(read("src/components/kc/inventory/InventoryScreen.tsx"));
  const banned =
    /purchaseIngredient|purchaseQuote|todaysUnitCost|purchaseRefrigerator|performRefrigeratorMaintenance|debitWallet|appendLedgerEntry|credits|localStorage|sessionStorage|setItem|persist\(|Math\.random|SaveManager/;
  assert(
    !banned.test(ui) && !banned.test(adapter),
    "H1: the fridge buys nothing — no purchase, wallet, ledger, storage, persistence or randomness",
  );
  assert(
    /<PhysicalFridge/.test(inv) &&
      // Developer 2026-10-09 (first levels): the button is passed once the Restaurant
      // section is open (the classic build: always), never a link to a closed section.
      /onEquipment=\{restaurantOpen \? toEquipment : undefined\}/.test(inv) &&
      /const toEquipment = \(\) => go\(BUSINESS_TAB_SCREEN\.equipment\)/.test(inv) &&
      /openMarketIngredients\(go, id\)/.test(inv) &&
      /onEquipment/.test(ui) &&
      !/openMarketIngredients|go\(/.test(ui),
    "H2: the fridge's Upgrade/Repair opens Business → Equipment; the Inventory screen's Restock opens Market → Ingredients",
  );
  const handle = css.match(/\.kcf-door__handle\s*\{[^}]*\}/)?.[0] ?? "";
  const door = css.match(/\.kcf-door\s*\{[^}]*\}/)?.[0] ?? "";
  assert(
    /pointer-events:\s*none/.test(handle) &&
      /right:\s*5px/.test(handle) &&
      /width:\s*7px/.test(handle) &&
      /padding:\s*8px 18px 8px 8px/.test(door),
    "H3: the door handle is decorative (no taps) and sits in the door's own 18 px edge, clear of the bins",
  );
  assert(
    !/@media\s*\((max|min)-width/.test(css) && /touch-action:\s*pan-x pan-y/.test(css),
    "H4: no viewport breakpoints (GameShell's 540 frame); shelves pan sideways without blocking vertical scroll",
  );
  const px = (sel: string, prop: string) =>
    Number(
      css.match(new RegExp(`${sel.replace(/\./g, "\\.")}\\s*\\{[^}]*?${prop}:\\s*(\\d+)px`))?.[1] ??
        0,
    );
  assert(
    px(".kcf-item", "min-height") >= 48 &&
      px(".kcf-item--compact", "width") >= 48 &&
      px(".kcf-head__upgrade", "min-height") >= 48,
    "H5: every fridge control is a ≥ 48 px touch target",
  );
}

// ===== I: read-only representation (CLAUDE.md hard rule) =====
{
  const adapter = code(read("src/game/business/fridgeView.ts"));
  const ui = code(read("src/components/kc/inventory/fridge/PhysicalFridge.tsx"));
  assert(
    !/useState<[^>]*(Stack|Inventory|Entry)|setInventory|setStock|mirror/i.test(ui) &&
      !/business\.inventory\s*=[^=]|\.quantity\s*[-+]?=[^=]|\.unitCost\s*=[^=]|\.purchaseDay\s*=[^=]/.test(
        adapter + ui,
      ) &&
      !/unitPrice|basePrice|priceFor|perishDays|slots/.test(adapter + ui),
    "I1: the fridge keeps no stock, price, money or freshness of its own — everything comes from the save",
  );
}

console.log(
  failures === 0 ? "\nFRIDGE VIEW QA: ALL PASS" : `\nFRIDGE VIEW QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
