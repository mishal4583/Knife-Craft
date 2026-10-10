/**
 * TABLEWARE QA (supplies plan Phase B, developer 2026-10-10: "use everything
 * when necessary … the gamers should feel like they are actually running a
 * real restaurant"). restaurant/serviceSupplies.ts.
 *
 *  U  Every one of the 17 front-of-house items (cutlery, crockery, glasses,
 *     table pieces) is used by the campaign's dine-in service.
 *  P  A guest eats from what their dish needs: soups a bowl + soup spoon;
 *     fruit a dessert plate + fork (a teaspoon for cups); bread a side plate
 *     + knife; salads a plate + fork; the rest plate, fork, knife — a steak
 *     knife for steak from L106; shared boards an extra side plate; every
 *     guest a water glass; drinks at the bar (L121+) and coffee/tea (L161+)
 *     for a seeded share; two napkins for messy dishes.
 *  B  Breakage: seeded and repeatable, about 1 in 60 plates/glasses and 1 in
 *     120 cutlery; a broken piece leaves the stock.
 *  S  Soap scales with the pieces washed (at least one wash-up's 5 %).
 *  T  Tables: two guests to a table (max 6); menu stands, salt & pepper,
 *     napkin holders from L31, water jugs from L46 — durable, blocking.
 *  G  Menu guests' tableware: optional rows that never block or open the
 *     sheet.
 *  L  An older save's `washing` (place settings) becomes dirty plates, forks
 *     and knives.
 *  W  Wiring: App's serve paths pass the dish; the guest gate checks the
 *     guest's own tableware; the plan passes the dishes and guests; the
 *     module never reads RESTAURANT_MODE or Math.random.
 *
 * Run: npx tsx scripts/restaurant-tableware-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import type { RecipeDefinition } from "../src/game/recipes/recipeTypes.ts";
import { SUPPLY_CATALOG, type SupplyId } from "../src/game/business/businessSupplies.ts";
import { supplyUnits } from "../src/game/business/BusinessSuppliesManager.ts";
import {
  SERVICE_SUPPLY_RULES,
  coverPiecesFor,
  napkinsFor,
  restaurantSuppliesOf,
  serviceSuppliesCheck,
  soapForPieces,
  suppliesNeedAttention,
  tablesFor,
  takeOrderSupplies,
  washUp,
} from "../src/game/restaurant/serviceSupplies.ts";
import { levelRecipesAt } from "../src/game/restaurant/kitchenTools.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const recipe = (name: RegExp) =>
  getLevels()
    .flatMap((l) => [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])])
    .map((id) => getCampaignRecipe(id)!)
    .find((r) => name.test(r.name))!;
const saveAt = (n: number, stock: Partial<Record<SupplyId, number>> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  business: {
    ...DEFAULT_SAVE.business,
    inventory: {},
    supplies: {
      ...DEFAULT_SAVE.business.supplies,
      stock: Object.fromEntries(
        Object.entries(stock).map(([id, units]) => [id, { units, costBasis: units * 100 }]),
      ),
    },
  },
});
const pieces = (r: RecipeDefinition, n: number, cover = 0) => coverPiecesFor(r, n, cover).join();

console.log("U. Every front-of-house item has a use");
{
  const used = new Set<string>();
  for (let n = 31; n <= 250; n++)
    levelRecipesAt(n).forEach((r, i) => {
      for (let c = 0; c < 12; c++) coverPiecesFor(r, n, i * 12 + c).forEach((id) => used.add(id));
    });
  SERVICE_SUPPLY_RULES.tablePieces.forEach((t) => used.add(t.id));
  const service = SUPPLY_CATALOG.filter((i) => i.section === "service").map((i) => i.id);
  assert(
    service.length === 17 && service.every((id) => used.has(id)),
    "U1: all 17 cutlery, crockery, glass and table items are used by the campaign's dine-in service",
    service.filter((id) => !used.has(id)),
  );
}

console.log("P. Pieces by dish");
{
  const soup = recipe(/Minestrone/);
  const fruitPlate = recipe(/Kiwi & Watermelon/);
  const fruitCup = recipe(/Grapes & Strawberry Cup/);
  const bread = recipe(/^Garlic Bread$/);
  const salad = recipe(/^Simple Garden Salad$/);
  const steak = recipe(/Sliced Ribeye Plate/);
  const shared = recipe(/for Two/);
  const plain = recipe(/^Sliced Tomato Plate$/);
  assert(
    pieces(soup, 40) === "soup-bowls,soup-spoons,water-glasses" &&
      pieces(fruitPlate, 40) === "dessert-plates,dessert-forks,water-glasses" &&
      pieces(fruitCup, 40) === "dessert-plates,teaspoons,water-glasses" &&
      pieces(bread, 40) === "side-plates,dinner-knives,water-glasses" &&
      pieces(salad, 40) === "dinner-plates,dinner-forks,water-glasses" &&
      pieces(plain, 40) === "dinner-plates,dinner-forks,dinner-knives,water-glasses" &&
      coverPiecesFor(shared, 40, 0).filter((x) => x === "side-plates").length === 1 &&
      coverPiecesFor(null, 40, 0).join() === SERVICE_SUPPLY_RULES.placeSetting.join(),
    "P1: soups a bowl + spoon, fruit a dessert plate + fork (cups a teaspoon), bread a side plate + knife, salads plate + fork, the rest a full setting; a glass of water for all; no dish = a plain setting",
  );
  assert(
    coverPiecesFor(steak, 106, 0).includes("steak-knives") &&
      !coverPiecesFor(steak, 105, 0).includes("steak-knives") &&
      !coverPiecesFor(plain, 120, 0).includes("steak-knives"),
    "P2: a steak knife with steak from L106",
  );
  let bar = 0;
  let coffee = 0;
  const N = 2000;
  for (let c = 0; c < N; c++) {
    if (coverPiecesFor(plain, 200, c).includes("highball-glasses")) bar++;
    if (coverPiecesFor(plain, 200, c).includes("coffee-tea-set")) coffee++;
  }
  assert(
    Math.abs(bar / N - SERVICE_SUPPLY_RULES.barShare) < 0.04 &&
      Math.abs(coffee / N - SERVICE_SUPPLY_RULES.coffeeShare) < 0.04 &&
      ![...Array(200).keys()].some((c) =>
        coverPiecesFor(plain, 120, c).includes("highball-glasses"),
      ) &&
      ![...Array(200).keys()].some((c) =>
        coverPiecesFor(plain, 160, c).includes("coffee-tea-set"),
      ) &&
      coverPiecesFor(fruitPlate, 161, 7).includes("coffee-tea-set") &&
      pieces(plain, 200, 5) === pieces(plain, 200, 5),
    `P3: drinks at the bar from L121 (${((bar / N) * 100).toFixed(0)} %), coffee/tea from L161 (${((coffee / N) * 100).toFixed(0)} %; every dessert) — seeded, the same every try`,
  );
  assert(
    napkinsFor(recipe(/Onion Rings Basket/)) === 2 &&
      napkinsFor(soup) === 2 &&
      napkinsFor(plain) === 1 &&
      napkinsFor(null) === 1,
    "P4: messy dishes (fried, curries, skewers) take two napkins",
  );
}

console.log("B. Breakage");
{
  let s = saveAt(60, {
    "dinner-plates": 400,
    "dinner-forks": 400,
    "dinner-knives": 400,
    "dish-soap": 50,
  });
  let broken: SupplyId[] = [];
  let washed = 0;
  for (let round = 0; round < 40; round++) {
    for (let g = 0; g < 10; g++) s = takeOrderSupplies(s, "dine-in");
    const w = washUp(s, 60);
    s = w.save;
    broken = broken.concat(w.broken);
    washed += w.washed;
  }
  const plates = broken.filter((x) => x === "dinner-plates").length;
  const cutlery = broken.length - plates;
  const again = (() => {
    let t = saveAt(60, {
      "dinner-plates": 400,
      "dinner-forks": 400,
      "dinner-knives": 400,
      "dish-soap": 50,
    });
    let b: SupplyId[] = [];
    for (let round = 0; round < 40; round++) {
      for (let g = 0; g < 10; g++) t = takeOrderSupplies(t, "dine-in");
      const w = washUp(t, 60);
      t = w.save;
      b = b.concat(w.broken);
    }
    return b.join();
  })();
  assert(
    washed === 1200 &&
      plates >= 1 &&
      plates <= 15 &&
      cutlery >= 1 &&
      cutlery <= 15 &&
      supplyUnits(s.business.supplies, "dinner-plates") === 400 - plates &&
      restaurantSuppliesOf(s).brokenTotal === broken.length &&
      again === broken.join(),
    `B1: of 1,200 pieces washed, ${plates} plates and ${cutlery} pieces of cutlery broke or went missing (≈ 1/60 and 1/120) — they leave the stock; the same every run`,
  );
}

console.log("S. Soap");
{
  assert(
    soapForPieces(3) === SERVICE_SUPPLY_RULES.soapPerWashUp &&
      soapForPieces(40) === 10 &&
      soapForPieces(80) === 20,
    "S1: soap = 0.25 % a piece, at least one wash-up's 5 %",
  );
}

console.log("T. Tables");
{
  const r = levelRecipesAt(50)[0]!;
  const s = saveAt(50);
  const check = serviceSuppliesCheck(s, 50, ["dine-in", "dine-in"], { recipes: [r, r], guests: 3 });
  const t31 = serviceSuppliesCheck(saveAt(31), 31, ["dine-in"], {
    recipes: [levelRecipesAt(31)[0]!],
  });
  const ids = (c: typeof check) => (c.applies ? c.rows.map((x) => x.id) : []);
  const salt = check.applies ? check.rows.find((x) => x.id === "salt-pepper") : undefined;
  assert(
    tablesFor(1) === 1 &&
      tablesFor(5) === 3 &&
      tablesFor(40) === SERVICE_SUPPLY_RULES.maxTables &&
      ["menu-stands", "salt-pepper", "napkin-holders", "water-jugs"].every((id) =>
        ids(check).includes(id as SupplyId),
      ) &&
      salt?.need === 6 &&
      salt.blocking &&
      !ids(t31).includes("water-jugs") &&
      ids(t31).includes("menu-stands"),
    "T1: 2 orders + 3 guests = 3 tables → 3 menu stands, 6 shakers, 3 napkin holders, 3 water jugs (jugs from L46) — blocking",
  );
}

console.log("G. Menu guests' tableware");
{
  const r = levelRecipesAt(60)[0]!;
  const soup = recipe(/Minestrone/);
  const opts = { recipes: [r], guests: 2, guestRecipes: [soup, soup] };
  // Stock exactly what the order and its tables need (and the bottles, napkins): only the guests are short.
  const needs = serviceSuppliesCheck(saveAt(60), 60, ["dine-in"], { recipes: [r], guests: 2 });
  const own = needs.applies ? Object.fromEntries(needs.rows.map((x) => [x.id, x.need])) : {};
  const s = saveAt(60, { ...own, "paper-napkins": 50, "dish-soap": 2, "cleaning-liquid": 2 });
  const c = serviceSuppliesCheck(s, 60, ["dine-in"], opts);
  const guestRows = c.applies ? c.rows.filter((x) => x.guest) : [];
  assert(
    c.applies &&
      c.ready &&
      guestRows.length > 0 &&
      guestRows.every((x) => !x.blocking && x.missing > 0 && /for menu guests/.test(x.label)) &&
      guestRows.some((x) => x.id === "soup-bowls") &&
      !suppliesNeedAttention(c),
    "G1: the menu guests' soup bowls etc. show as optional rows — the service is ready and they don't open the sheet by themselves",
    guestRows.map((x) => [x.id, x.need, x.have]),
  );
}

console.log("L. Older saves");
{
  const old = saveAt(40, { "dinner-plates": 4, "dinner-forks": 4, "dinner-knives": 4 });
  const legacy = {
    ...old,
    business: { ...old.business, restaurantSupplies: { soapPct: 50, cleanerPct: 50, washing: 2 } },
  } as unknown as SaveData;
  const st = restaurantSuppliesOf(legacy);
  assert(
    st.washing === 2 &&
      SERVICE_SUPPLY_RULES.placeSetting.every((id) => st.dirty[id] === 2) &&
      st.washedTotal === 0 &&
      st.brokenTotal === 0,
    "L1: an older save's 2 settings waiting become 2 dirty plates, forks and knives",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const plan = read("src/game/restaurant/preServiceCheck.ts");
  const mod = read("src/game/restaurant/serviceSupplies.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(
    (
      app.match(
        /\{\s*recipe(?:: viewed\.recipe)?,\s*levelNumber: levelNumber\(level\.id\),\s*index: paidOrdersFor\(save\.levelProgress, level\.id\)\.length,?\s*\}/g,
      ) ?? []
    ).length === 2 &&
      /\{ recipe, levelNumber: levelNumber\(level\.id\), index: guestCover\(save, level\) \}/.test(
        app,
      ) &&
      /cleanSettingFor\(s, guest\.recipe, n, guestCover\(s, level\)\)/.test(app),
    "W1: both serve paths and the menu guest pass the dish; the guest gate checks the guest's own tableware",
  );
  assert(
    /recipes: remaining,/.test(plan) &&
      /guestRecipes: remainingMenuGuests\(save, level\),/.test(plan) &&
      !/RESTAURANT_MODE|Math\.random/.test(mod),
    "W2: the plan passes the dishes and guests; the module never reads RESTAURANT_MODE or Math.random",
  );
}

console.log(failures ? `TABLEWARE QA: ${failures} FAILURE(S)` : "TABLEWARE QA: ALL PASS");
process.exit(failures ? 1 : 0);
