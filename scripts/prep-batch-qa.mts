/**
 * PREP BATCH QA (developer 2026-11-12, player reviews: "increase the toughness of the mini-games, the count of ingredients; the restaurant should
 * purchase a lot more, so raise the basic purchases and the requirement amount"). restaurant/prepBatch.ts + the mini-games' new numbers.
 *
 *  A. The batch: 1 before the first stock service, 3x at Level 3 growing smoothly to 8x at Level 70, never down, whole numbers.
 *  B. One order's amount: the plate portion x the batch, never more than the row cap, never less than the portion; no level = the plain plate.
 *  C. The check and the serve are ONE rule: buying exactly what the check says missing lets the whole service be served and leaves nothing over.
 *  D. It really buys more: the pieces and the bill per service; the fridge still fits (Basic until Level 23); the food bill stays small
 *     against the frozen campaign income; the economy baselines are untouched (this module moves no pay).
 *  E. The four games ask for more at every tier than they did before 2026-11-12 (the old numbers are recorded here as the floor).
 *  F. Wiring and saves: the check, the serve, the Market plan and the goals pass the level; no new save field.
 *
 * Run: npx tsx scripts/prep-batch-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import {
  PREP_BATCH_TIERS,
  ROW_CAP_BASIC,
  ROW_CAP_BIG,
  batchedQuantity,
  prepBatchAt,
  rowCapAt,
} from "../src/game/restaurant/prepBatch.ts";
import { servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
import {
  consumeCampaignOrderStock,
  orderRequirements,
  serviceStockCheck,
} from "../src/game/restaurant/campaignStock.ts";
import { piecesCapAt, piecesFor, DIFFICULTY } from "../src/game/business/fridgeSort.ts";
import { stockForMarketUnits } from "../src/game/business/measure.ts";
import { INSPECTION_TIERS } from "../src/game/business/deliveryInspection.ts";
import {
  TIERS as STOCK_TIERS,
  MAX_SETS_PER_LINE,
  setsFor,
} from "../src/game/business/stockroomSort.ts";
import { checkTiers } from "../src/game/restaurant/fridgeCheck.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { asPlate, isPlate } from "../src/game/restaurant/prepBatch.ts";
import { menuGuestQueue, walkInQueue } from "../src/game/restaurant/menuGuests.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fresh = () => structuredClone(DEFAULT_SAVE) as SaveData;
const levels = Array.from({ length: 91 }, (_, i) => i + 1);

console.log("A. The batch");
{
  const xs = levels.map((l) => prepBatchAt(l));
  assert(
    prepBatchAt() === 1 && prepBatchAt(1) === 1 && prepBatchAt(2) === 1,
    "A1: no level, Level 1 and Level 2 read the plain plate (1x)",
  );
  assert(
    PREP_BATCH_TIERS.map((t) => `${t.from}:${t.times}`).join() === "3:3,8:4,14:5,23:6,40:7,70:8" &&
      PREP_BATCH_TIERS.every((t) => prepBatchAt(t.from) === t.times),
    "A2: 3x at Level 3, 4x at 8, 5x at 14, 6x at 23, 7x at 40, 8x at 70, exactly the row's own number on its first level",
  );
  assert(
    xs.every((x, i) => Number.isInteger(x) && (i === 0 || x >= xs[i - 1]!)) &&
      prepBatchAt(500) === 8,
    "A3: whole numbers, never down as the level rises, flat after Level 70",
    xs,
  );
}

console.log("B. One order's amount");
{
  assert(
    batchedQuantity(0.3, 3) === 0.9 &&
      batchedQuantity(0.25, 3) === 0.75 &&
      batchedQuantity(0.025, 3) === 0.075,
    "B1: a tomato 0.3 lb is 0.9 lb at Level 3 (3x); a quarter loaf is 0.75; a pinch of garlic keeps its fineness",
    [batchedQuantity(0.3, 3), batchedQuantity(0.25, 3), batchedQuantity(0.025, 3)],
  );
  assert(
    rowCapAt(22) === ROW_CAP_BASIC &&
      rowCapAt(23) === ROW_CAP_BIG &&
      ROW_CAP_BASIC === 4 &&
      ROW_CAP_BIG === 6,
    "B2: one ingredient of one order takes at most 4 units until the Commercial fridge era (Level 23), 6 after",
  );
  assert(
    batchedQuantity(2, 10) === 4 && batchedQuantity(1.5, 10) === 4 && batchedQuantity(1.5, 3) === 4,
    "B3: a heavy portion is capped (2 lb x 4 = 8 becomes 4), a steak 1.5 lb x 3 = 4.5 becomes 4",
    [batchedQuantity(2, 10), batchedQuantity(1.5, 10), batchedQuantity(1.5, 3)],
  );
  assert(
    batchedQuantity(6, 10) === 6 && batchedQuantity(5, 10) === 5 && batchedQuantity(5, 40) === 6,
    "B4: a portion already above the cap is never cut (never less than the plate): 6 lb stays 6, 5 lb stays 5 at Level 10; at Level 40 (cap 6) 5 lb x 7 is held at 6",
  );
  assert(
    batchedQuantity(0.3) === 0.3 &&
      batchedQuantity(0.3, 2) === 0.3 &&
      batchedQuantity(0.3, 1) === 0.3,
    "B5: no level, or a level without stock, is the plain plate",
  );
  const s = fresh();
  const recipe = getCampaignRecipe("camp-garlic-bread")!;
  const plain = orderRequirements(s, recipe);
  const batched = orderRequirements(s, recipe, "factor", 3);
  const plainBread = plain.find((r) => r.ingredientId === "bread")!.quantity;
  const batchBread = batched.find((r) => r.ingredientId === "bread")!.quantity;
  assert(
    plainBread === 0.25 &&
      batchBread === 0.75 &&
      orderRequirements(s, recipe, "floor", 3).length === batched.length,
    "B6: orderRequirements(level) is the batched amount, without a level the plain one (Garlic Bread: bread 0.25 -> 0.75)",
    { plainBread, batchBread },
  );
}

console.log("C. The check and the serve are one rule");
{
  let bad = 0;
  let checked = 0;
  for (const n of [3, 4, 5, 6, 7, 10, 13, 17, 20, 25, 40, 62, 80, 91]) {
    const level = getLevel(`level-${n}`)!;
    const s0 = fresh();
    const plan = servicePlanFor(s0, level);
    if (!plan || !plan.check.applies) continue;
    // Stock the fridge with exactly the check's missing amount (whole Market units), then serve every ticket.
    const s1 = structuredClone(s0) as SaveData;
    const day = s1.business.calendar.businessDay;
    for (const r of plan.check.rows) {
      const stock = stockForMarketUnits(r.ingredientId, r.buyUnits, "lb");
      s1.business.inventory[r.ingredientId] = {
        ...(s1.business.inventory[r.ingredientId] ?? {}),
        quantity: stock,
        purchaseDay: day,
      } as never;
    }
    const check = serviceStockCheck(s1, n, plan.tickets);
    let cur = s1;
    let served = 0;
    for (const t of plan.tickets) {
      const out = consumeCampaignOrderStock(cur, n, t, true);
      if (!out.ok) break;
      cur = out.save;
      served++;
    }
    checked++;
    if (!check.applies || !check.ready || served !== plan.tickets.length) bad++;
  }
  assert(
    checked >= 10 && bad === 0,
    "C1: stocked to the check's answer, every ticket is served (14 levels from 3 to 91)",
    { checked, bad },
  );
}

console.log("G. Only a level's own orders are batched (guests and walk-ins are one plate)");
{
  const s = fresh();
  const recipe = getCampaignRecipe("camp-garlic-bread")!;
  const marked = asPlate(recipe);
  const q = (r: typeof recipe) =>
    orderRequirements(s, r, "factor", 40).reduce((a, x) => a + x.quantity, 0);
  assert(
    isPlate(marked) &&
      !isPlate(recipe) &&
      asPlate(marked) === marked &&
      marked.id === recipe.id &&
      q(marked) < q(recipe),
    "G1: asPlate marks a COPY (the recipe itself is untouched, same id); a marked order uses the plain plate, the unmarked one the batch",
    { plate: q(marked), batch: q(recipe) },
  );
  let guestsSeen = 0;
  let allPlate = true;
  let ownBatched = true;
  for (const n of [5, 12, 25, 40, 60, 80]) {
    const level = getLevel(`level-${n}`)!;
    for (const r of [...menuGuestQueue(s, level), ...walkInQueue(s, level)]) {
      guestsSeen++;
      if (!isPlate(r)) allPlate = false;
    }
    const plan = servicePlanFor(s, level);
    if (plan && plan.tickets.some((t) => isPlate(t))) ownBatched = false;
  }
  assert(
    guestsSeen > 5 && allPlate && ownBatched,
    "G2: every menu guest and walk-in of Levels 5-80 is one plate; a level's own tickets are never marked",
    { guestsSeen, allPlate, ownBatched },
  );
  // A late service: its guests' optional stock is the plain plate, so a dozen guests do not need a dozen batches.
  const l80 = getLevel("level-80")!;
  const plan80 = servicePlanFor(s, l80)!;
  const guestUnits = plan80.guests.rows.reduce((a, r) => a + r.buyUnits, 0);
  assert(
    guestUnits <= 25,
    "G3: Level 80's guests ask for a modest extra amount of food (at most 25 units for all of them)",
    guestUnits,
  );
}

console.log("D. It really buys more, and it fits");
{
  const s = fresh();
  let piecesNew = 0;
  let piecesOld = 0;
  let early = 0;
  let maxEarly = 0;
  let maxLate = 0;
  let bill = 0;
  for (let n = 3; n <= 91; n++) {
    const level = getLevel(`level-${n}`)!;
    const plan = servicePlanFor(s, level);
    if (!plan || !plan.check.applies) continue;
    bill += plan.check.missingCost;
    if (n < 23) maxEarly = Math.max(maxEarly, plan.check.storageNeeded);
    else maxLate = Math.max(maxLate, plan.check.storageNeeded);
    if (n >= 4 && n <= 20) {
      early++;
      piecesNew += plan.check.rows.reduce(
        (a, r) =>
          a +
          piecesFor(
            r.ingredientId,
            stockForMarketUnits(r.ingredientId, r.buyUnits, "lb"),
            piecesCapAt(n),
          ),
        0,
      );
      piecesOld += plan.check.rows.reduce(
        (a, r) =>
          a + piecesFor(r.ingredientId, orderRequirementsUnits(s, plan.tickets, r.ingredientId)),
        0,
      );
    }
  }
  function orderRequirementsUnits(sv: SaveData, tickets: readonly never[], id: string): number {
    let q = 0;
    for (const t of tickets)
      for (const r of orderRequirements(sv, t)) if (r.ingredientId === id) q += r.quantity;
    return Math.max(0.25, Math.ceil(q * 4) / 4);
  }
  const billPlain = 610_00; // the whole campaign's plain-plate bill measured on 2026-11-12 (own orders, empty fridge): $610
  assert(
    piecesNew / early >= 1.6 * (piecesOld / early) && piecesNew / early >= 12,
    "D1: Levels 4-20 deliver clearly more pieces to sort (at least 1.6x the plain plate and 12 a service on average)",
    { avgNew: piecesNew / early, avgOld: piecesOld / early },
  );
  assert(
    maxEarly <= 25,
    "D2: until Level 22 one service needs at most 25 fridge units of the Basic fridge's 40 (guests and the next service still fit)",
    maxEarly,
  );
  assert(
    maxLate <= 60,
    "D3: from Level 23 one service needs at most 60 units (the Commercial fridge holds 100)",
    maxLate,
  );
  assert(
    bill >= 4 * billPlain && bill <= 600_000,
    "D4: the whole campaign's food bill for the levels' own orders rises well above the plain-plate $610 but stays under $6,000 (against about $299k earned)",
    bill / 100,
  );
  const sim = read("scripts/economy-v2-campaign-simulation.mts");
  assert(
    !/prepBatch/.test(sim),
    "D5: the frozen campaign simulation does not read the batch (pay and the 91-level baseline are untouched)",
  );
}

console.log("E. The four games ask for more");
{
  // The numbers before 2026-11-12 are the floor.
  assert(
    DIFFICULTY.map((d) => d.maxTokens).every((v, i) => v > [8, 10, 12, 14, 16][i]!) &&
      DIFFICULTY.map((d) => d.minTargets).every((v, i) => v > [3, 5, 6, 8, 10][i]! || i === 4) &&
      piecesCapAt(3) > 5 &&
      piecesCapAt(44) === 12 &&
      piecesCapAt(200) === 12,
    "E1: Unpack the delivery: baskets of 12 / 15 / 18 / 20 / 22 pieces (were 8-16), one ingredient up to 6-12 pieces (was 5), more shelves",
  );
  assert(
    INSPECTION_TIERS.map((t) => t.items[1]).every((v, i) => v > [9, 10, 12, 14, 17][i]!) &&
      INSPECTION_TIERS.map((t) => t.defects[1]).every((v, i) => v > [2, 3, 4, 5, 6][i]!),
    "E2: Delivery Inspection: 12 / 14 / 17 / 20 / 24 items and 3 / 4 / 5 / 6 / 8 bad ones to find (were 9-17 and 2-6)",
  );
  assert(
    STOCK_TIERS.map((t) => t.maxSets).every((v, i) => v > [2, 4, 6, 8, 8][i]!) &&
      MAX_SETS_PER_LINE === 4 &&
      setsFor(1) === 1 &&
      setsFor(7) === 4,
    "E3: Stock the shelves: boards of 3 / 5 / 7 / 9 / 9 sets (were 2-8) and a purchase makes more sets (up to 4)",
  );
  const ct = checkTiers();
  assert(
    ct.map((t) => t.minCards).every((v, i) => v > [5, 7, 9, 11, 12][i]!) &&
      ct.map((t) => t.minBin).every((v, i) => v > [1, 2, 2, 3, 3][i]!) &&
      ct.map((t) => t.minUse).every((v, i) => v >= [1, 1, 2, 2, 3][i]!),
    "E4: Fridge Check: 8 / 10 / 12 / 14 / 16 cards at least, with 2-5 Bin and 2-4 Use next (were 5-12 cards, 1-3 and 1-3)",
  );
}

console.log("F. Wiring and saves");
{
  const stock = read("src/game/restaurant/campaignStock.ts");
  assert(
    /orderRequirements\(save, recipe, "factor", levelNumber\)/.test(stock) &&
      /orderRequirements\(save, recipe, "floor", levelNumber\)/.test(stock),
    "F1: the Pre-Service Check and the serve both read the batch with the level (one rule)",
  );
  assert(
    /orderRequirements\(save, recipe, "factor", level\)/.test(
      read("src/game/restaurant/marketPlan.ts"),
    ) &&
      /orderRequirements\(save, recipe, "factor", levelNumber\(level\.id\)\)/.test(
        read("src/game/restaurant/levelGoals.ts"),
      ),
    "F2: the Market plan and the level goals show the same batched amounts",
  );
  assert(
    !/prepBatch|PREP_BATCH/.test(read("src/game/SaveManager.ts")),
    "F3: no new save field: the batch is a pure function of the level",
  );
  const mod = read("src/game/restaurant/prepBatch.ts");
  assert(
    !/Math\.random|RESTAURANT_MODE|localStorage/.test(mod),
    "F4: the module is pure (no randomness, no mode switch, no storage)",
  );
}

console.log(failures === 0 ? "PREP BATCH QA: ALL PASS" : `PREP BATCH QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
