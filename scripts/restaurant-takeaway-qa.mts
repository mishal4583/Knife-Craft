/**
 * TAKEAWAY QA (supplies plan Phase C, developer 2026-10-10: "ensure that
 * packaging, cleaning and napkins and all those things are depended to 250
 * level campaigns and it should affect the gameplay").
 * restaurant/serviceSupplies.ts, restaurantDay.ts, restaurantMigration.ts.
 *
 *  U  Every one of the 17 packaging and hygiene items has a use in the
 *     campaign (takeaway containers, bags and extras, dine-in liners and
 *     toothpicks, napkins, closing tissues and wrap, soap, cleaner).
 *  P  A takeaway order leaves in its dish's own container and bag: fried a
 *     clamshell, grilled / sautéed a foil tray, salsas and bases a tub,
 *     combo / mezze plates a compartment tray, the rest a kraft box; heavy
 *     orders a carry bag; a cutlery kit (not bread / skewers), a wet wipe
 *     for messy dishes, a tamper label from L91.
 *  T  Serving a takeaway order takes exactly those pieces (packaging
 *     lifetime "used"); with nothing in stock it still serves, never < 0.
 *  C  The Pre-Service Check lists each takeaway dish's container and bag
 *     (blocking) and its extras (warnings); dine-in liners / toothpicks
 *     warn.
 *  X  Closing uses a tissue cube (from L31) and a sheet of deli wrap per
 *     ingredient left in the fridge (from L21); short = a warning; never
 *     money, never < 0.
 *  M  The moving-in crate packs each takeaway dish's own container and bag.
 *  W  Wiring: closeDay / Closing Time / the sim; no Math.random.
 *
 * Run: npx tsx scripts/restaurant-takeaway-qa.mts
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
  closingSupplies,
  closingSuppliesFor,
  dineInExtrasFor,
  orderServiceFor,
  serviceSuppliesCheck,
  takeOrderSupplies,
  takeawayPiecesFor,
} from "../src/game/restaurant/serviceSupplies.ts";
import { levelRecipesAt } from "../src/game/restaurant/kitchenTools.ts";
import { closeDay, closingPreview, recordService } from "../src/game/restaurant/restaurantDay.ts";
import { migrateToUnifiedRestaurant } from "../src/game/restaurant/restaurantMigration.ts";

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
const saveAt = (
  n: number,
  stock: Partial<Record<SupplyId, number>> = {},
  inventory: SaveData["business"]["inventory"] = {},
): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  business: {
    ...DEFAULT_SAVE.business,
    inventory,
    supplies: {
      ...DEFAULT_SAVE.business.supplies,
      stock: Object.fromEntries(
        Object.entries(stock).map(([id, units]) => [id, { units, costBasis: units * 100 }]),
      ),
    },
  },
});
const units = (s: SaveData, id: SupplyId) => supplyUnits(s.business.supplies, id);
const piecesOf = (r: RecipeDefinition, n: number) => {
  const t = takeawayPiecesFor(r, n);
  return [t.container, t.bag, ...t.extras].join();
};

console.log("U. Every packaging and hygiene item has a use");
{
  const used = new Set<string>();
  for (let n = 31; n <= 250; n++)
    levelRecipesAt(n).forEach((r, i) => {
      const service = orderServiceFor(n, i);
      if (service === "takeaway") {
        const t = takeawayPiecesFor(r, n);
        [t.container, t.bag, ...t.extras].forEach((id) => used.add(id));
      }
      if (service === "dine-in") dineInExtrasFor(r, n).forEach((id) => used.add(id));
    });
  // Closing (tissues, deli wrap), napkins, and the two bottles.
  const fridge = {
    tomato: { ingredientId: "tomato", quantity: 1, unitCost: 100, purchaseDay: 1 },
  } as unknown as SaveData["business"]["inventory"];
  closingSuppliesFor(saveAt(40, {}, fridge), 40).forEach((l) => used.add(l.id));
  used.add(SERVICE_SUPPLY_RULES.napkin);
  used.add("dish-soap");
  used.add("cleaning-liquid");
  const packaging = SUPPLY_CATALOG.filter((i) => i.section === "packaging").map((i) => i.id);
  assert(
    packaging.length === 17 && packaging.every((id) => used.has(id)),
    "U1: all 17 packaging and hygiene items are used by the campaign (takeaway, dine-in extras, closing, napkins, soap, cleaner)",
    packaging.filter((id) => !used.has(id)),
  );
  const containers = new Set<string>();
  for (let n = 71; n <= 250; n++)
    levelRecipesAt(n).forEach((r, i) => {
      if (orderServiceFor(n, i) === "takeaway") containers.add(takeawayPiecesFor(r, n).container);
    });
  assert(
    [
      "thali-containers",
      "microwave-containers",
      "burger-boxes",
      "foil-containers",
      "kraft-boxes",
    ].every((id) => containers.has(id)),
    "U2: the campaign's own takeaway orders use five different containers",
    [...containers],
  );
}

console.log("P. Pieces by dish");
{
  const fried = recipe(/Pickled Onion Rings/);
  const chicken = recipe(/Halved & Sliced Chicken/);
  const salsa = recipe(/Corn & Tomato Salsa/);
  const mezze = recipe(/Shared Mezze for Two/);
  const salad = recipe(/^Simple Garden Salad$/);
  const bread = recipe(/^Garlic Bread$/);
  const curry = recipe(/Steak Curry Bowl/);
  assert(
    takeawayPiecesFor(fried, 80).container === "burger-boxes" &&
      takeawayPiecesFor(chicken, 102).container === "foil-containers" &&
      takeawayPiecesFor(salsa, 81).container === "microwave-containers" &&
      takeawayPiecesFor(mezze, 77).container === "thali-containers" &&
      takeawayPiecesFor(salad, 149).container === "kraft-boxes" &&
      takeawayPiecesFor(bread, 80).container === "food-wrap" &&
      takeawayPiecesFor(curry, 192).container === "thali-containers",
    "P1: fried → clamshell, grilled → foil tray, salsa → tub, mezze → compartment tray, salad → kraft box, bread → deli wrap, curry → compartment tray",
  );
  assert(
    takeawayPiecesFor(chicken, 102).bag === "carry-bags" &&
      takeawayPiecesFor(mezze, 77).bag === "carry-bags" &&
      takeawayPiecesFor(salad, 149).bag === "paper-bags",
    "P2: heavy orders (grilled, pot, shared) a carry bag; the rest a paper bag",
  );
  assert(
    takeawayPiecesFor(fried, 80).extras.join() === "cutlery-packs,wet-wipes" &&
      !takeawayPiecesFor(bread, 80).extras.includes("cutlery-packs") &&
      !takeawayPiecesFor(salad, 90).extras.includes("tamper-labels") &&
      takeawayPiecesFor(salad, 91).extras.includes("tamper-labels"),
    "P3: a cutlery kit (not bread), a wet wipe for messy dishes, a tamper label from L91",
  );
  assert(
    dineInExtrasFor(fried, 80).join() === "deli-sheets" &&
      dineInExtrasFor(bread, 40).join() === "deli-sheets" &&
      !dineInExtrasFor(chicken, 100).includes("toothpicks") &&
      dineInExtrasFor(chicken, 101).includes("toothpicks") &&
      dineInExtrasFor(salad, 150).length === 0 &&
      dineInExtrasFor(null, 150).length === 0,
    "P4: dine-in: fried food and bread on a deli-sheet liner; grilled meat and fish with a toothpick from L101",
  );
}

console.log("T. Serving a takeaway order");
{
  const fried = recipe(/Pickled Onion Rings/);
  const s = saveAt(95, {
    "burger-boxes": 5,
    "paper-bags": 5,
    "cutlery-packs": 5,
    "wet-wipes": 5,
    "tamper-labels": 5,
    "kraft-boxes": 5,
  });
  const before = s.business.supplies.lifetime.packaging.unitsUsed;
  const after = takeOrderSupplies(s, "takeaway", { recipe: fried, levelNumber: 95, index: 0 });
  const want = piecesOf(fried, 95).split(",") as SupplyId[];
  assert(
    want.every((id) => units(after, id) === 4) &&
      units(after, "kraft-boxes") === 5 &&
      after.business.supplies.lifetime.packaging.unitsUsed - before === want.length &&
      after.credits === s.credits &&
      after.economyLedger.length === s.economyLedger.length,
    "T1: a fried takeaway takes one clamshell, paper bag, cutlery kit, wet wipe and tamper label (lifetime used); nothing else, no money",
    want.map((id) => [id, units(after, id)]),
  );
  const empty = takeOrderSupplies(saveAt(95), "takeaway", {
    recipe: fried,
    levelNumber: 95,
    index: 0,
  });
  assert(
    Object.values(empty.business.supplies.stock).every((e) => (e?.units ?? 0) >= 0) &&
      empty.business.supplies.lifetime.packaging.unitsUsed === 0,
    "T2: with nothing in stock the order still goes out; nothing goes below 0",
  );
}

console.log("C. The Pre-Service Check");
{
  const fried = recipe(/Pickled Onion Rings/);
  const salad = recipe(/^Simple Garden Salad$/);
  const check = serviceSuppliesCheck(saveAt(95), 95, ["takeaway", "takeaway", "dine-in"], {
    recipes: [fried, salad, fried],
  });
  const row = (id: string) => check.rows.find((r) => r.id === id && !r.guest);
  assert(
    row("burger-boxes")?.blocking === true &&
      row("burger-boxes")?.need === 1 &&
      row("kraft-boxes")?.blocking === true &&
      row("paper-bags")?.need === 2 &&
      row("cutlery-packs")?.blocking === false &&
      row("cutlery-packs")?.need === 2 &&
      row("wet-wipes")?.need === 1 &&
      row("tamper-labels")?.need === 2 &&
      row("deli-sheets")?.blocking === false &&
      /takeaway/.test(row("burger-boxes")?.label ?? ""),
    "C1: each takeaway dish's container and bag block; its cutlery kit, wipe and label warn; the dine-in fried dish's liner warns",
    check.rows.map((r) => [r.id, r.need, r.blocking]),
  );
  const stocked = saveAt(95, {
    "burger-boxes": 1,
    "kraft-boxes": 1,
    "paper-bags": 2,
  });
  const ok = serviceSuppliesCheck(stocked, 95, ["takeaway", "takeaway"], {
    recipes: [fried, salad],
  });
  assert(
    ok.rows.filter((r) => r.blocking && r.missing > 0).length === 0 &&
      ok.rows.some((r) => !r.blocking && r.missing > 0),
    "C2: with the containers and bags in, nothing blocks; the missing extras only warn",
  );
}

console.log("X. Closing tissues and deli wrap");
{
  const fridge = {
    tomato: { ingredientId: "tomato", quantity: 1, unitCost: 100, purchaseDay: 1 },
    onion: { ingredientId: "onion", quantity: 0.5, unitCost: 100, purchaseDay: 1 },
    basil: { ingredientId: "basil", quantity: 0, unitCost: 100, purchaseDay: 1 },
  } as unknown as SaveData["business"]["inventory"];
  assert(
    closingSuppliesFor(saveAt(20, {}, fridge), 20).length === 0 &&
      closingSuppliesFor(saveAt(21, {}, fridge), 21)
        .map((l) => `${l.id}:${l.need}`)
        .join() === "food-wrap:2" &&
      closingSuppliesFor(saveAt(31, {}, fridge), 31)
        .map((l) => `${l.id}:${l.need}`)
        .join() === "tissues:1,food-wrap:2",
    "X1: from L21 a sheet of wrap per ingredient left in the fridge (empty lines skipped); from L31 a tissue cube for the dining room",
  );
  const s = saveAt(40, { tissues: 3, "food-wrap": 10 }, fridge);
  const used = closingSupplies(s, 40);
  const short = closingSupplies(saveAt(40, { "food-wrap": 1 }, fridge), 40);
  assert(
    units(used, "tissues") === 2 &&
      units(used, "food-wrap") === 8 &&
      used.credits === s.credits &&
      used.economyLedger.length === s.economyLedger.length &&
      units(short, "food-wrap") === 0 &&
      units(short, "tissues") === 0,
    "X2: closing uses them (no money, no ledger); short = as much as there is, never below 0",
  );
  // The day: two services, then closing uses them and shows them first.
  let day = recordService(recordService(s, 40), 40);
  const preview = closingPreview(day, 40);
  day = closeDay(day, 40);
  assert(
    preview.supplies.map((l) => l.id).join() === "tissues,food-wrap" &&
      preview.chores.some((c) => c.id === "wrap") &&
      units(day, "tissues") === 2 &&
      units(day, "food-wrap") === 8,
    "X3: Closing Time lists tonight's tissues and wrap (and the wrap chore); closing the day uses them",
    { preview: preview.supplies, chores: preview.chores.map((c) => c.id) },
  );
}

console.log("M. The moving-in crate");
{
  const old: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    levelProgress: {
      currentLevelId: "level-120",
      highestUnlockedLevelId: "level-120",
      completedLevelIds: Array.from({ length: 119 }, (_, i) => `level-${i + 1}`),
    },
  };
  const moved = migrateToUnifiedRestaurant(old);
  const stock = moved.business.supplies.stock;
  const want = new Set<string>();
  for (let n = 120; n < 124; n++)
    levelRecipesAt(n).forEach((r, i) => {
      if (orderServiceFor(n, i) === "takeaway") {
        const t = takeawayPiecesFor(r, n);
        want.add(t.container);
        want.add(t.bag);
      }
    });
  assert(
    want.size > 0 && [...want].every((id) => (stock[id as SupplyId]?.units ?? 0) >= 1),
    "M1: an old save moving in at L120 gets its takeaway dishes' own containers and bags",
    [...want].map((id) => [id, stock[id as SupplyId]?.units ?? 0]),
  );
}

console.log("W. Wiring");
{
  const day = read("src/game/restaurant/restaurantDay.ts");
  const ui = read("src/components/kc/restaurant/ClosingTime.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  const mod = read("src/game/restaurant/serviceSupplies.ts");
  const mig = read("src/game/restaurant/restaurantMigration.ts");
  assert(
    /closingSupplies\(next, levelNumber\)/.test(day) &&
      /supplies: closingSuppliesFor\(save, levelNumber\)/.test(day) &&
      /data-testid="closing-supplies"/.test(ui) &&
      /closingSuppliesFor\(s, restaurantLevelOf/.test(sim),
    "W1: closeDay uses the closing supplies, Closing Time shows them, the sim's diligent player keeps them",
  );
  assert(
    !/Math\.random/.test(mod) &&
      /takeawayPiecesFor/.test(mod) &&
      /serviceSuppliesCheck\(/.test(mig),
    "W2: no Math.random; the check and the crate read the dish's own packaging",
  );
}

console.log(failures ? `\nTAKEAWAY QA: ${failures} FAILURE(S)` : "\nTAKEAWAY QA: ALL PASS");
process.exit(failures ? 1 : 0);
