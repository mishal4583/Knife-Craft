/**
 * GRANDMA'S FRIDGE QA (developer 2026-10-09, "Levels 1–15 retention" pass 2;
 * restaurant/grandmasFridge.ts, campaignStock's early branch).
 *
 *  L  Level 3 leftovers: given once, at cost 0 (no money, no ledger), sized
 *     from the real recipes of Levels 4–12 at the most a dull knife can use;
 *     not before Level 3 or from Level 15; an older save gets only the levels
 *     it still has to play; never more than the fridge holds.
 *  C  Levels 4–14: a level's own order uses exactly its planned ingredients,
 *     once per serve, from the same inventory; replays, menu guests and
 *     Levels 1–3 use nothing; Level 15 unchanged. Rule changed (developer
 *     2026-10-09, "without these ingredients in stock I still can cut and
 *     serve it"): a short or empty fridge no longer serves — the serve is
 *     refused with nothing taken, the Pre-Service Check applies, and before
 *     the Market sells ingredients (L10) Grandma's pantry fills exactly the
 *     gap at no cost.
 *  R  Level 12 running low: the rows are the real fridge against Levels
 *     12–14's needs; a well-stocked fridge shows nothing short.
 *  T  Level 13 top-up: missing = need − usable, never below zero; the Market
 *     steps cover exactly that (one step less would not); priced with the
 *     Market's own quote; nothing offered for an ingredient there's enough of;
 *     surplus → nothing to buy; too little money → said, and Grandma's
 *     pantry covers the level's own gap (never a soft-lock).
 *  P  Level 14 preview: Levels 14–15's needs, what's low, the spare stock.
 *  S  The sheet: shows on Levels 12–14's first play only.
 *  I  (Pass 2 review) Inventory follows progression: no menu figures before
 *     the menu opens (L11); then the real unlocked/active menu, never the
 *     48-dish catalog; the selectors' default (classic / Endless) unchanged.
 *  F  (Pass 2 review) the Level 15 hand-over shows on the first stock
 *     service even with food in the fridge (or nothing missing), never again
 *     after a stock level is done; nothing bought or granted; no second
 *     leftovers for a returning save.
 *  E  Regression: Levels 1–15 rewards unchanged; a whole Levels 3–14 run moves
 *     no money and writes no ledger entry; Pass 1's unlock levels unchanged.
 *  W  Wiring.
 *
 * Run: npx tsx scripts/restaurant-grandmas-fridge-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import type { IngredientId } from "../src/game/definitions.ts";
import {
  giveGrandmasLeftovers,
  grandmasFridgeNoteFor,
  leftoversFor,
} from "../src/game/restaurant/grandmasFridge.ts";
import {
  consumeCampaignOrderStock,
  orderRequirements,
  pantryForMissing,
} from "../src/game/restaurant/campaignStock.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { coverFor } from "../src/game/restaurant/serviceCover.ts";
import { inventoryView } from "../src/game/business/inventoryView.ts";
import { lowStockItems, menuDemand } from "../src/game/business/inventoryAnalytics.ts";
import { activeBusinessDishes } from "../src/game/business/businessMenuActivation.ts";
import {
  activeMenuDishes,
  inventoryMenuOf,
  menuOpensAt,
  unlockedMenuDishes,
} from "../src/game/restaurant/restaurantMenu.ts";
import { ticketsFor } from "../src/game/restaurant/serviceTickets.ts";
import { restaurantQuote } from "../src/game/restaurant/restaurantEconomy.ts";
import { recipeRequirements, sumRequirements } from "../src/game/restaurant/recipeRequirements.ts";
import { TAB_OPENS_AT, earlyStockAt } from "../src/game/restaurant/firstLevels.ts";
import {
  addStock,
  getQuantity,
  normalizeQuantity,
} from "../src/game/business/businessInventory.ts";
import { stockForMarketUnits, marketStep } from "../src/game/business/measure.ts";
import { getAvailableStorageCapacity } from "../src/game/business/RefrigeratorManager.ts";
import { getLevel, getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";

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
const level = (n: number) => getLevel(`level-${n}`)!;
const at = (s: SaveData, n: number): SaveData => ({
  ...s,
  levelProgress: {
    ...s.levelProgress,
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
});
const fresh = (n: number, credits = 300_000): SaveData =>
  at({ ...DEFAULT_SAVE, credits, business: { ...DEFAULT_SAVE.business, inventory: {} } }, n);
const qty = (s: SaveData, id: IngredientId) => getQuantity(s.business.inventory, id);
/** Opens level n (its tickets saved, as the game does) and returns the save + its recipe. */
function open(s: SaveData, n: number) {
  const t = ticketsFor(s.levelProgress, level(n));
  return { save: { ...s, levelProgress: t.progress }, recipe: t.tickets[0]! };
}
/** The most each level 4..12 can use (base portion × a fully dull knife's waste). */
function expectedLeftovers(from: number) {
  const all = [];
  for (let n = from; n <= 12; n++) {
    const most = new Map<IngredientId, number>();
    for (const id of level(n).recipePoolIds ?? []) {
      for (const r of sumRequirements(recipeRequirements(getCampaignRecipe(id)!)))
        most.set(r.ingredientId, Math.max(most.get(r.ingredientId) ?? 0, r.quantity * 1.05));
    }
    for (const [ingredientId, quantity] of most) all.push({ ingredientId, quantity });
  }
  return sumRequirements(all).map((r) => ({
    ingredientId: r.ingredientId,
    quantity: normalizeQuantity(Math.ceil(normalizeQuantity(r.quantity) * 20 - 1e-9) / 20),
  }));
}

console.log("L. Level 3 leftovers");
{
  const s3 = fresh(3);
  const given = giveGrandmasLeftovers(s3);
  const lines = given.business.grandmasFridge?.lines ?? [];
  const exp = expectedLeftovers(4);
  assert(
    JSON.stringify(lines) === JSON.stringify(exp) &&
      lines.every((l) => qty(given, l.ingredientId) === l.quantity) &&
      lines.every((l) => given.business.inventory[l.ingredientId]?.unitCost === 0),
    "L1: at Level 3 the fridge gets Levels 4–12's real needs (dull-knife most), at cost 0",
    { lines, exp },
  );
  assert(
    given.credits === s3.credits &&
      given.economyLedger.length === s3.economyLedger.length &&
      giveGrandmasLeftovers(given) === given,
    "L2: no money, no ledger entry, given once (a second call changes nothing)",
  );
  assert(
    !giveGrandmasLeftovers(fresh(2)).business.grandmasFridge && leftoversFor(fresh(2)).length === 0,
    "L3a: nothing before Level 3",
  );
  const s15 = fresh(15);
  assert(
    leftoversFor(s15).length === 0 && !giveGrandmasLeftovers(s15).business.grandmasFridge,
    "L3b: nothing from Level 15 (stock proper, and the migration crate, take over)",
  );
  const s8 = giveGrandmasLeftovers(fresh(8));
  assert(
    JSON.stringify(s8.business.grandmasFridge?.lines) === JSON.stringify(expectedLeftovers(8)) &&
      qty(s8, "onion") === 0 &&
      s8.business.grandmasFridge?.atLevel === 8,
    "L4: an older save at Level 8 gets only Levels 8–12's needs (no onion: Level 5 is done)",
    s8.business.grandmasFridge,
  );
  // A fridge with almost no room: never over capacity.
  let full = fresh(3);
  const cap = getAvailableStorageCapacity(
    full.business.inventory,
    full.business.refrigerator.refrigeratorId,
  );
  full = {
    ...full,
    business: {
      ...full.business,
      inventory: addStock(full.business.inventory, "flour", cap - 1, 100, 1),
    },
  };
  const squeezed = giveGrandmasLeftovers(full);
  assert(
    getAvailableStorageCapacity(
      squeezed.business.inventory,
      squeezed.business.refrigerator.refrigeratorId,
    ) >= 0 &&
      (squeezed.business.grandmasFridge?.lines ?? []).reduce((t, l) => t + l.quantity, 0) <=
        1 + 1e-9,
    "L5: a nearly full fridge gets only what fits",
  );
}

console.log("C. Levels 4–14 use their real ingredients");
{
  const s = giveGrandmasLeftovers(fresh(3));
  const { save: s4, recipe } = open(at(s, 4), 4);
  const need = orderRequirements(s4, recipe);
  const r = consumeCampaignOrderStock(s4, 4, recipe, true);
  assert(
    r.ok &&
      r.used &&
      need.every(
        (n) =>
          normalizeQuantity(qty(s4, n.ingredientId) - qty(r.save, n.ingredientId)) === n.quantity,
      ) &&
      r.save.credits === s4.credits &&
      r.save.economyLedger.length === s4.economyLedger.length,
    "C1: Level 4's order takes exactly its planned tomato and cucumber, no money moves",
    need,
  );
  const replay = consumeCampaignOrderStock(s4, 4, recipe, false);
  const guest = consumeCampaignOrderStock(s4, 12, recipe, true, "guest");
  const l3 = consumeCampaignOrderStock(at(s, 3), 3, recipe, true);
  assert(
    replay.ok && !replay.used && replay.save === s4 && guest.ok && !guest.used && l3.ok && !l3.used,
    "C2: a replay, a menu guest (before L15) and Level 3 use nothing",
  );
  // Short and empty fridges (rule changed 2026-10-09): the serve is refused, nothing taken.
  const short = {
    ...s4,
    business: {
      ...s4.business,
      inventory: addStock({}, "tomato", 0.1, 0, s4.business.calendar.businessDay),
    },
  };
  const sr = consumeCampaignOrderStock(short, 4, recipe, true);
  const empty = { ...s4, business: { ...s4.business, inventory: {} } };
  const er = consumeCampaignOrderStock(empty, 4, recipe, true);
  const shortPlan = servicePlanFor(short, level(4))!;
  const filled = pantryForMissing(short, shortPlan.check, false);
  const filledServe = filled ? consumeCampaignOrderStock(filled, 4, recipe, true) : null;
  assert(
    !sr.ok &&
      sr.reason === "missingStock" &&
      qty(short, "tomato") === 0.1 &&
      !er.ok &&
      shortPlan.check.applies &&
      !shortPlan.check.ready &&
      servicePlanNeedsSheet(shortPlan) &&
      pantryForMissing(short, shortPlan.check, true) === null &&
      !!filled &&
      filled.credits === short.credits &&
      filled.economyLedger.length === short.economyLedger.length &&
      !!filledServe?.ok,
    "C3: a short or empty fridge refuses the serve (nothing taken); the check opens; before L10 Grandma's pantry fills the gap free and the serve then works",
  );
  // Level 15: unchanged — missing stock still refuses the serve.
  const { save: s15, recipe: r15 } = open(
    at({ ...s4, business: { ...s4.business, inventory: {} } }, 15),
    15,
  );
  const strict = consumeCampaignOrderStock(s15, 15, r15, true);
  assert(!strict.ok, "C4: Level 15 still needs its stock (unchanged rule)");
  // One serve takes once: a whole run's use = the sum of each order's (clamped) planned use.
  let run = giveGrandmasLeftovers(fresh(3));
  const before = { ...run.business.inventory };
  let planned = 0;
  for (let n = 4; n <= 11; n++) {
    const o = open(at(run, n), n);
    planned += orderRequirements(o.save, o.recipe).reduce((t, x) => t + x.quantity, 0);
    const c = consumeCampaignOrderStock(o.save, n, o.recipe, true);
    run = c.ok ? c.save : o.save;
  }
  const used =
    Object.values(before).reduce((t, e) => t + (e?.quantity ?? 0), 0) -
    Object.values(run.business.inventory).reduce((t, e) => t + (e?.quantity ?? 0), 0);
  assert(
    Math.abs(normalizeQuantity(used) - normalizeQuantity(planned)) < 1e-6,
    `C5: Levels 4–11 use exactly their orders' planned stock once each (${normalizeQuantity(used)} = ${normalizeQuantity(planned)})`,
  );
  assert(
    [1, 2, 3, 15, 16].every((n) => !earlyStockAt(n)) &&
      Array.from({ length: 11 }, (_, i) => i + 4).every(earlyStockAt),
    "C6: the fridge is used on Levels 4–14 only",
  );
}

/** A Levels 3–n run as the game plays it (leftovers, then each level's own order). */
function playTo(n: number, credits = 300_000): SaveData {
  let s = giveGrandmasLeftovers(fresh(3, credits));
  for (let k = 4; k < n; k++) {
    const o = open(at(s, k), k);
    const c = consumeCampaignOrderStock(o.save, k, o.recipe, true);
    s = c.ok ? c.save : o.save;
  }
  return at(s, n);
}

console.log("R. Level 12: running low");
{
  const s = playTo(12);
  const note = grandmasFridgeNoteFor(s, level(12), 12)!;
  const real = note.rows.every(
    (r) =>
      r.usable === qty(s, r.ingredientId) &&
      r.missing === normalizeQuantity(Math.max(0, r.need - r.usable)),
  );
  assert(
    note.stage === "low" &&
      note.levels.join() === "12,13,14" &&
      real &&
      note.shortRows.length > 0 &&
      note.shortRows.every((r) => r.usable < r.need),
    "R1: the warning is the real fridge against Levels 12–14's needs",
    note.shortRows.map((r) => [r.ingredientId, r.need, r.usable]),
  );
  let stocked = s;
  for (const r of note.rows)
    stocked = {
      ...stocked,
      business: {
        ...stocked.business,
        inventory: addStock(stocked.business.inventory, r.ingredientId, r.need, 100, 1),
      },
    };
  assert(
    grandmasFridgeNoteFor(stocked, level(12), 12)!.shortRows.length === 0,
    "R2: with enough in the fridge nothing is flagged",
  );
}

console.log("T. Level 13: the top-up");
{
  const s = playTo(13);
  const note = grandmasFridgeNoteFor(s, level(13), 13)!;
  const covers = note.shortRows.every((r) => {
    const step = marketStep(r.ingredientId);
    return (
      stockForMarketUnits(r.ingredientId, r.buyUnits, "lb") >= r.missing - 1e-9 &&
      stockForMarketUnits(r.ingredientId, r.buyUnits - step, "lb") < r.missing - 1e-9
    );
  });
  assert(
    note.stage === "top-up" &&
      note.levels.join() === "13,14" &&
      note.rows.every((r) => r.missing === normalizeQuantity(Math.max(0, r.need - r.usable))) &&
      note.rows.filter((r) => r.missing === 0).every((r) => r.buyUnits === 0 && r.cost === 0) &&
      covers &&
      note.shortRows.every(
        (r) => r.cost === restaurantQuote(s, r.ingredientId, r.buyUnits).totalCost,
      ) &&
      note.topUpCost === note.shortRows.reduce((t, r) => t + r.cost, 0) &&
      note.affordable,
    `T1: need − usable (never below 0), the fewest Market steps that cover it, at the Market's price (top-up $${(note.topUpCost / 100).toFixed(2)})`,
    note.rows,
  );
  // Partial: half of the missing mushroom already there → only the rest.
  const half = note.shortRows.find((r) => r.ingredientId === "mushroom")!;
  const partial = {
    ...s,
    business: {
      ...s.business,
      inventory: addStock(s.business.inventory, "mushroom", half.missing / 2, 100, 1),
    },
  };
  const p = grandmasFridgeNoteFor(partial, level(13), 13)!;
  assert(
    p.rows.find((r) => r.ingredientId === "mushroom")!.missing ===
      normalizeQuantity(half.missing / 2),
    "T2: partial stock → only the rest is missing",
  );
  // Surplus: everything there → nothing to buy.
  let surplus = s;
  for (const r of note.rows)
    surplus = {
      ...surplus,
      business: {
        ...surplus.business,
        inventory: addStock(surplus.business.inventory, r.ingredientId, r.need * 2, 100, 1),
      },
    };
  const sn = grandmasFridgeNoteFor(surplus, level(13), 13)!;
  assert(
    sn.shortRows.length === 0 && sn.topUpCost === 0,
    "T3: a fridge with enough asks to buy nothing",
  );
  // Too little money: said, never blocking.
  const broke = { ...s, credits: 0 };
  const bn = grandmasFridgeNoteFor(broke, level(13), 13)!;
  const plan = servicePlanFor(broke, level(13))!;
  assert(
    !bn.affordable &&
      bn.shortRows.length > 0 &&
      plan.staff.length === 0 &&
      (!plan.check.applies ||
        plan.check.ready ||
        (!plan.check.affordable &&
          pantryForMissing(broke, plan.check) === null &&
          coverFor(plan, "stock") !== null)),
    // Rule changed (developer 2026-10-10): from Level 10 a rewarded ad or supplier
    // credit covers it, not Grandma's pantry.
    "T4: with $0 the top-up says it can't all be bought; if the level's own stock is short, an ad or supplier credit covers it (no soft-lock)",
  );
}

console.log("P. Level 14: preview");
{
  const s = playTo(14);
  const note = grandmasFridgeNoteFor(s, level(14), 14)!;
  const ids = note.rows.map((r) => r.ingredientId);
  assert(
    note.stage === "preview" &&
      note.levels.join() === "14,15" &&
      ids.includes("zucchini") &&
      ids.includes("mozzarella") &&
      note.spare.every((x) => !ids.includes(x.ingredientId) && x.usable > 0),
    "P1: Levels 14–15's needs (zucchini … mozzarella), what's short, and the spare stock",
    { ids, spare: note.spare },
  );
}

console.log("S. The sheet");
{
  const sheetAt = (n: number) => {
    const s = playTo(n);
    const plan = servicePlanFor(s, level(n));
    return !!plan && !!plan.grandmasFridge && servicePlanNeedsSheet(plan);
  };
  const done = { ...playTo(13) };
  done.levelProgress = {
    ...done.levelProgress,
    completedLevelIds: [...done.levelProgress.completedLevelIds, "level-13"],
  };
  assert(
    sheetAt(12) &&
      sheetAt(13) &&
      sheetAt(14) &&
      !servicePlanFor(playTo(11), level(11))?.grandmasFridge &&
      grandmasFridgeNoteFor(done, level(13), 13) === null &&
      grandmasFridgeNoteFor(fresh(13), level(13), 13) === null,
    "S1: Levels 12–14's first plays show Grandma's note; not Level 11, a replay, or a save without the leftovers",
  );
}

console.log("I. Inventory follows the restaurant's progression (Pass 2 review)");
{
  const s3 = giveGrandmasLeftovers(fresh(3));
  const before = inventoryView(s3); // the Business catalog (the old reading — the bug)
  const v3 = inventoryView(s3, inventoryMenuOf(s3));
  assert(
    before.summary.menuDishes === 48 &&
      inventoryMenuOf(s3).length === 0 &&
      menuOpensAt(3) === 11 &&
      v3.summary.menuDishes === 0 &&
      v3.summary.runningLow === 0 &&
      !v3.attention.some((g) => g.id === "low" || g.id === "critical") &&
      v3.items.length > 0 &&
      v3.items.every((i) => i.todayRequirement === undefined && i.menuUses.length === 0) &&
      v3.mostNeeded.length === 0,
    "I1: Level 3 — no menu yet: no menu need, no 'low for today's menu', no dish count (the catalog read 48); the fridge is still listed",
    { before: before.summary.menuDishes, after: v3.summary },
  );
  const s11 = { ...s3, levelProgress: at(s3, 11).levelProgress };
  const menu11 = inventoryMenuOf(s11);
  const v11 = inventoryView(s11, menu11);
  const names = new Set(menu11.map((d) => d.name));
  assert(
    menuOpensAt(11) === null &&
      menu11.length === unlockedMenuDishes(11).length &&
      menu11.length === 4 &&
      v11.summary.menuDishes === 4 &&
      v11.items.every((i) => i.menuUses.every((d) => names.has(d))),
    "I2: from Level 11 the Inventory uses the real 4-dish menu (count and 'used by')",
    v11.summary,
  );
  const s250 = { ...s3, levelProgress: at(s3, 250).levelProgress };
  assert(
    inventoryView(s3).summary.menuDishes ===
      activeBusinessDishes(s3.business.menuActivation).length &&
      inventoryMenuOf(s250).length === activeMenuDishes(s250.business.menuActivation, 250).length,
    "I3: without a menu passed the selectors read the Business menu as before (classic / Endless unchanged)",
  );
  const demandBefore = menuDemand(s11, menu11);
  assert(
    [...demandBefore.values()].every((d) => d.perDay >= 0 && d.dishCount <= 4) &&
      lowStockItems(s11, menu11).every((l) => demandBefore.has(l.id)),
    "I4: the menu need is the existing formula over the dishes actually on the menu",
  );
}

console.log("F. The Level 15 hand-over (Pass 2 review)");
{
  const stocked = playTo(15);
  const plan15 = servicePlanFor(stocked, level(15))!;
  // A fridge that already holds everything Level 15 needs still gets the hand-over.
  let full = stocked;
  for (const r of plan15.check.applies ? plan15.check.rows : [])
    full = {
      ...full,
      business: {
        ...full.business,
        inventory: addStock(full.business.inventory, r.ingredientId, r.needed, 100, 1),
      },
    };
  const planFull = servicePlanFor(full, level(15))!;
  assert(
    Object.keys(stocked.business.inventory).length > 0 &&
      plan15.firstStockService &&
      servicePlanNeedsSheet(plan15) &&
      planFull.check.applies &&
      planFull.check.ready &&
      planFull.firstStockService &&
      servicePlanNeedsSheet(planFull),
    "F1: Level 15's first play introduces the routine with food in the fridge, even when nothing is missing",
  );
  const done15 = {
    ...stocked,
    levelProgress: at(stocked, 16).levelProgress,
  };
  const migrated60 = at(fresh(60), 60);
  assert(
    !servicePlanFor(done15, level(16))!.firstStockService &&
      !servicePlanFor(migrated60, level(60))!.firstStockService &&
      !servicePlanFor(playTo(14), level(14))!.firstStockService,
    "F2: never again once Level 15 is done (returning or older saves), never before Level 15",
  );
  assert(
    planFull.check.applies &&
      planFull.check.missingRows.length === 0 &&
      full.credits === stocked.credits,
    "F3: nothing is bought or granted for the hand-over (no money, no stock)",
  );
  // Returning players: the leftovers are never given twice, even with an empty fridge.
  const emptied = {
    ...giveGrandmasLeftovers(fresh(3)),
    business: { ...giveGrandmasLeftovers(fresh(3)).business, inventory: {} },
  };
  const again = giveGrandmasLeftovers(at(emptied, 8));
  assert(
    Object.keys(again.business.inventory).length === 0 &&
      again.business.grandmasFridge?.atLevel === 3,
    "F4: a returning save that used up the leftovers gets none again",
  );
}

console.log("E. Regression");
{
  const expected = [
    5000, 5200, 5500, 5800, 6100, 6400, 6800, 7200, 7600, 8000, 8000, 8300, 8600, 8900, 9200,
  ];
  assert(
    getLevels()
      .slice(0, 15)
      .every((l, i) => l.id === `level-${i + 1}` && paidLevelReward(l) === expected[i]),
    "E1: Levels 1–15 keep their order and completion rewards",
  );
  const start = fresh(3);
  const end = playTo(15);
  assert(
    end.credits === start.credits && end.economyLedger.length === start.economyLedger.length,
    "E2: a whole Levels 3–14 run (leftovers + every order) moves no money and writes no ledger entry",
  );
  assert(
    TAB_OPENS_AT.inventory === 3 &&
      TAB_OPENS_AT.shop === 7 &&
      TAB_OPENS_AT.rack === 10 &&
      TAB_OPENS_AT.business === 11,
    "E3: Pass 1's unlock levels unchanged",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  const sheet = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const inv = read("src/components/kc/inventory/InventoryScreen.tsx");
  assert(
    /if \(RESTAURANT_MODE && isFirstCompletion\) nextSave = giveGrandmasLeftovers\(nextSave\);/.test(
      app,
    ) &&
      /const base = giveGrandmasTools\(\s*giveGrandmasLeftovers\(quietDayEnd\(save\)\),\s*restaurantLevelOf\(save\.levelProgress\),?\s*\);/.test(
        app,
      ) &&
      /recipe,\s*true,\s*"guest",?\s*\)/.test(app) &&
      /fridgeLeftLine\(finalSave, usedIngredients\)/.test(app),
    "W1: App gives the leftovers on reaching Level 3 (or an older save's next start), guests say so, Level Complete shows what's left",
  );
  assert(
    /grandmasFridge=\{plan\.grandmasFridge\}/.test(layer) &&
      /openMarketIngredients\(go, id, units\)/.test(layer) &&
      /data-testid="psc-grandmas-fridge"/.test(sheet) &&
      /data-testid="inventory-grandmas-leftovers"/.test(inv),
    "W2: the sheet shows Grandma's fridge with Market links for the exact steps; Inventory explains the leftovers",
  );
}

console.log(
  failures ? `GRANDMA'S FRIDGE QA: ${failures} FAILURE(S)` : "GRANDMA'S FRIDGE QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
