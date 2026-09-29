/**
 * BUSINESS RUSH RESTOCK QA — the one-tap emergency restock for a blocked
 * Business order (src/game/business/businessRushRestock.ts).
 *
 *  A. Plan: only the missing ingredients, the whole-unit shortfall, today's
 *     Market price + 25%, and the Market price shown beside it.
 *  B. Cash: credits drop by exactly the plan's cash cost, the order unblocks,
 *     nothing else in stock changes, fridge wear applies, and App's ledger
 *     composition reconciles (one inventory-purchase per ingredient + the
 *     day's inventory cost).
 *  C. Ad: free — credits and ledger untouched, stock at cost 0, order unblocked.
 *  D. All-or-nothing failures: not blocked, not enough cash, fridge full,
 *     today's shortage limit, and expired old stock (never charged for a
 *     restock that wouldn't unblock the order).
 *  E. The Market's own purchase price is unchanged by the refactor that
 *     shares its pricing (todaysUnitCost).
 *  F. Wiring: the blocked-order alert carries the rush action; App pays out
 *     the ad restock only after Bridge reports `rewarded`, re-reading the
 *     save and the current order after the ad.
 *
 * Run: npx tsx scripts/business-rush-restock-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, type BusinessInventory } from "../src/game/business/businessInventory.ts";
import {
  createBusinessServiceSession,
  businessOrderAvailability,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import { getBusinessDish } from "../src/game/business/businessDishCatalog.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { recordInventoryPurchase } from "../src/game/business/BusinessFinanceManager.ts";
import {
  purchaseIngredient,
  rushRestock,
  rushRestockPlan,
  todaysUnitCost,
} from "../src/game/business/BusinessInventoryManager.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import {
  eventForDay,
  maxPurchaseQuantityFor,
} from "../src/game/business/businessSupplierEvents.ts";
import { shelfLifeForIngredient } from "../src/game/business/perishability.ts";
import {
  getInventoryUsedCapacity,
  getRefrigeratorCapacity,
} from "../src/game/business/RefrigeratorManager.ts";
import { businessAlertsFor } from "../src/game/business/businessAlerts.ts";
import { RUSH_RESTOCK_FEE, rushUnitCost } from "../src/game/business/businessRushRestock.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SALAD = getBusinessDish("biz-garden-salad")!;
const QUIET_DAY = 7;
assert(eventForDay(QUIET_DAY) === null, "precondition: Business Day 7 has no supplier event");

/** Tomato + cucumber in stock, carrot missing — the Garden Salad is blocked on carrot only. */
function blockedSave(credits = 500_000, day = QUIET_DAY, extra?: BusinessInventory): SaveData {
  let inv: BusinessInventory = extra ?? {};
  inv = addStock(inv, "tomato", 3, 100, day);
  inv = addStock(inv, "cucumber", 3, 100, day);
  return {
    ...DEFAULT_SAVE,
    credits,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: day }, inventory: inv },
  };
}
// Mirrors App.tsx's rushRestockCurrentOrder cash composition exactly.
function cashComposed(save: SaveData) {
  const result = rushRestock(save, SALAD, "cash");
  if (!result.ok) return result;
  let next = result.save;
  for (const line of result.lines) {
    next = appendLedgerEntry(next, "inventory-purchase", -line.rushTotal, line.ingredientId);
  }
  return { ...result, save: recordInventoryPurchase(next, result.totalCost) };
}
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

// ===== A: the plan =====
{
  const save = blockedSave();
  const avail = businessOrderAvailability(save, SALAD);
  assert(
    !avail.available && JSON.stringify(avail.missing) === '["carrot"]',
    "A: precondition — Garden Salad blocked on carrot only",
  );
  const planned = rushRestockPlan(save, SALAD);
  assert(planned.ok, "A1: a blocked order has a Rush Restock plan");
  if (planned.ok) {
    const { plan } = planned;
    const line = plan.lines[0]!;
    const market = todaysUnitCost(save, "carrot", line.quantity)!;
    assert(
      plan.lines.length === 1 && line.ingredientId === "carrot",
      "A2: the plan buys only the missing ingredient",
    );
    assert(
      Number.isInteger(line.quantity) && line.quantity >= 1,
      `A3: whole units, at least one (${line.quantity})`,
    );
    assert(
      line.marketUnitCost === market && market === businessUnitCostFor("carrot"),
      `A4: priced at today's Market price (${market}c on a quiet day, no contract/staff)`,
    );
    assert(
      RUSH_RESTOCK_FEE === 0.25 && line.rushUnitCost === Math.round(market * 1.25),
      `A5: rush unit price = Market + 25%, whole cents (${market}c -> ${line.rushUnitCost}c)`,
    );
    assert(
      plan.cashCost === line.quantity * line.rushUnitCost &&
        plan.marketCost === line.quantity * market,
      `A6: cash cost ${plan.cashCost}c vs Market ${plan.marketCost}c for the same units`,
    );
  }
  assert(
    rushUnitCost(101) === 126 && rushUnitCost(450) === 563 && rushUnitCost(0) === 0,
    "A7: rounding — 101c -> 126c, 450c -> 563c, 0 -> 0",
  );
  // Several missing ingredients: nothing in stock at all.
  const empty: SaveData = {
    ...DEFAULT_SAVE,
    credits: 500_000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: QUIET_DAY }, inventory: {} },
  };
  const all = rushRestockPlan(empty, SALAD);
  const missing = businessOrderAvailability(empty, SALAD);
  assert(
    all.ok &&
      !missing.available &&
      JSON.stringify(all.plan.lines.map((l) => l.ingredientId)) === JSON.stringify(missing.missing),
    "A8: with nothing in stock, the plan covers exactly the ingredients the order reports missing",
  );
}

// ===== B: cash =====
{
  const save = blockedSave();
  const planned = rushRestockPlan(save, SALAD);
  const out = cashComposed(save);
  assert(out.ok, "B: cash Rush Restock succeeds with enough money");
  if (out.ok && planned.ok) {
    const after = out.save;
    assert(
      after.credits === save.credits - planned.plan.cashCost &&
        out.totalCost === planned.plan.cashCost,
      `B1: credits drop by exactly the cash cost (${planned.plan.cashCost}c)`,
    );
    assert(businessOrderAvailability(after, SALAD).available, "B2: the order is no longer blocked");
    assert(
      after.business.inventory.tomato!.quantity === 3 &&
        after.business.inventory.cucumber!.quantity === 3,
      "B3: in-stock ingredients are untouched",
    );
    assert(
      after.business.inventory.carrot!.unitCost === planned.plan.lines[0]!.rushUnitCost,
      "B4: the restocked units carry the rush price as their food cost",
    );
    assert(
      after.business.equipmentCondition.refrigeratorCondition <=
        save.business.equipmentCondition.refrigeratorCondition,
      "B5: stocking wears the fridge like any purchase (never improves it)",
    );
    const entries = after.economyLedger.filter((e) => e.category === "inventory-purchase");
    assert(
      entries.length === planned.plan.lines.length &&
        entries.every((e, i) => e.description === planned.plan.lines[i]!.ingredientId),
      "B6: one inventory-purchase ledger entry per ingredient, described by its id",
    );
    assert(
      save.credits + (ledgerSum(after) - ledgerSum(save)) === after.credits,
      "B7: reconciles — credits before + signed new ledger = credits after",
    );
    assert(
      after.business.finance.dailyAccumulator.inventoryPurchaseCost ===
        save.business.finance.dailyAccumulator.inventoryPurchaseCost + planned.plan.cashCost,
      "B8: today's inventory purchase cost (P&L) grows by the cash cost",
    );
    assert(
      after.levelProgress === save.levelProgress && after.story === save.story,
      "B9: no Campaign field changes",
    );
  }
}

// ===== C: ad (free) =====
{
  const save = blockedSave();
  const out = rushRestock(save, SALAD, "ad");
  assert(out.ok, "C: ad Rush Restock succeeds");
  if (out.ok) {
    assert(
      out.save.credits === save.credits && out.totalCost === 0,
      "C1: credits unchanged — the restock is free",
    );
    assert(
      out.save.economyLedger.length === save.economyLedger.length,
      "C2: no ledger entry (no money moved)",
    );
    assert(
      out.save.business.inventory.carrot!.unitCost === 0,
      "C3: free stock carries a food cost of 0",
    );
    assert(
      businessOrderAvailability(out.save, SALAD).available,
      "C4: the order is no longer blocked",
    );
  }
  const broke = blockedSave(0);
  const freeWhenBroke = rushRestock(broke, SALAD, "ad");
  assert(
    freeWhenBroke.ok && freeWhenBroke.save.credits === 0,
    "C5: an ad restock works with $0 — no debt, credits stay 0",
  );
}

// ===== D: all-or-nothing failures =====
{
  // Not blocked.
  let inv = addStock({}, "carrot", 3, 100, QUIET_DAY);
  const stocked = blockedSave(500_000, QUIET_DAY, inv);
  const notBlocked = rushRestock(stocked, SALAD, "cash");
  assert(
    !notBlocked.ok && notBlocked.reason === "notBlocked",
    "D1: an order that isn't blocked has nothing to rush",
  );

  // Not enough cash.
  const poor = blockedSave(1);
  const r2 = rushRestock(poor, SALAD, "cash");
  assert(!r2.ok && r2.reason === "insufficientFunds", "D2: not enough cash is refused");

  // Fridge full.
  const base = blockedSave();
  const room =
    getRefrigeratorCapacity(base.business.refrigerator.refrigeratorId) -
    getInventoryUsedCapacity(base.business.inventory);
  inv = addStock({}, "potato", room, 100, QUIET_DAY);
  const full = blockedSave(500_000, QUIET_DAY, inv);
  for (const payment of ["cash", "ad"] as const) {
    const r = rushRestock(full, SALAD, payment);
    assert(
      !r.ok && r.reason === "insufficientStorage",
      `D3: a full refrigerator is refused (${payment})`,
    );
  }

  // Expired old stock: the merged entry would stay expired.
  const shelf = shelfLifeForIngredient("carrot");
  let lateDay = 1 + shelf * 40;
  while (eventForDay(lateDay) !== null) lateDay++;
  let oldInv = addStock({}, "carrot", 30, 100, 1);
  const expired = blockedSave(500_000, lateDay, oldInv);
  const r4 = rushRestock(expired, SALAD, "cash");
  assert(
    !r4.ok && r4.reason === "wouldNotUnblock",
    `D4: expired old stock that would keep the order blocked is never charged (Day ${lateDay})`,
  );

  // A supplier-event day: the rush price follows that day's Market price.
  let eventDay = -1;
  for (let d = 1; d < 400; d++) {
    const ev = eventForDay(d);
    if (ev && ev.priceModifier !== 0) {
      eventDay = d;
      break;
    }
  }
  assert(eventDay > 0, "D5: precondition — a supplier-event day with a price change exists");
  oldInv = {};
  const ev = blockedSave(500_000, eventDay, oldInv);
  const evPlan = rushRestockPlan(ev, SALAD);
  assert(
    evPlan.ok &&
      evPlan.plan.lines.every(
        (l) =>
          l.marketUnitCost === todaysUnitCost(ev, l.ingredientId, l.quantity) &&
          l.marketUnitCost !== businessUnitCostFor(l.ingredientId) &&
          l.rushUnitCost === rushUnitCost(l.marketUnitCost),
      ),
    `D5: on a supplier-event day (Day ${eventDay}) the rush price is that day's Market price + 25%`,
  );

  // Every failure leaves the save untouched.
  const failures2 = [
    [stocked, "cash"],
    [poor, "cash"],
    [full, "cash"],
    [full, "ad"],
  ] as const;
  assert(
    failures2.every(([s, p]) => {
      const before = JSON.stringify(s);
      rushRestock(s, SALAD, p);
      return JSON.stringify(s) === before;
    }),
    "D6: a refused Rush Restock never mutates the save",
  );
}

// ===== E: the Market's own price is unchanged =====
{
  const save = blockedSave();
  for (const [id, qty] of [
    ["carrot", 1],
    ["salmon", 4],
    ["basil", 2],
  ] as const) {
    const r = purchaseIngredient(save, id, qty);
    assert(
      r.ok &&
        r.unitCost === businessUnitCostFor(id) &&
        r.totalCost === qty * businessUnitCostFor(id),
      `E: Market purchase of ${qty} ${id} still costs ${qty} × ${businessUnitCostFor(id)}c on a quiet day`,
    );
  }
  let shortageDay = -1;
  for (let d = 1; d < 400; d++) {
    if (maxPurchaseQuantityFor(eventForDay(d)) !== undefined) {
      shortageDay = d;
      break;
    }
  }
  if (shortageDay > 0) {
    const max = maxPurchaseQuantityFor(eventForDay(shortageDay))!;
    const r = purchaseIngredient(blockedSave(500_000, shortageDay), "carrot", max + 1);
    assert(
      !r.ok && r.reason === "exceedsShortageLimit",
      "E2: the Market still refuses a purchase over today's shortage limit",
    );
  }
}

// ===== F: wiring =====
{
  let session = createBusinessServiceSession(makeSeededRand(1));
  for (let seed = 1; seed < 300 && session.current?.recipe.id !== SALAD.sourceRecipeId; seed++) {
    session = createBusinessServiceSession(makeSeededRand(seed));
  }
  const ref = { orderId: session.current!.order.id, recipeId: session.current!.recipe.id };
  const blocked = businessAlertsFor(blockedSave(), ref).find((a) =>
    a.key.startsWith("order-blocked:"),
  );
  assert(
    blocked?.action?.kind === "rush-restock",
    "F1: the blocked-order alert carries the Rush Restock action",
  );

  const app = read("src/App.tsx");
  const fn = app.slice(app.indexOf("async function rushRestockCurrentOrder"));
  const body = fn.slice(0, fn.indexOf("\n  }\n") + 4);
  const adAt = body.indexOf("await requestRewardedAd(");
  const rewardedAt = body.indexOf('ad.status !== "rewarded"');
  const applyAt = body.indexOf('rushRestock(latest, dish, "ad")');
  assert(
    adAt > 0 && rewardedAt > adAt && applyAt > rewardedAt,
    "F2: the free restock is applied only after the ad resolves `rewarded`",
  );
  assert(
    /const latest = saveRef\.current;/.test(body) && /const dish = dishFor\(\);/.test(body),
    "F3: after the ad it re-reads the latest save and the CURRENT order (never the pre-ad closure)",
  );
  const flat = (src: string) => src.replace(/\s+/g, " ");
  assert(
    flat(body).includes(
      "persistIngredientPurchases( result.save, result.lines.map((line) => ({ ingredientId: line.ingredientId, totalCost: line.rushTotal, })), );",
    ),
    "F4: cash is recorded through the same step as a Market purchase, at the rush price",
  );
  const helperSrc = app.slice(app.indexOf("function persistIngredientPurchases"));
  const helper = flat(helperSrc.slice(0, helperSrc.indexOf("\n  }\n")));
  assert(
    helper.includes(
      'recorded = appendLedgerEntry( recorded, "inventory-purchase", -line.totalCost, line.ingredientId, );',
    ) && helper.includes("recordInventoryPurchase("),
    "F4b: that step writes one inventory-purchase per ingredient and today's inventory cost",
  );
  const adPath = body.slice(adAt);
  assert(
    !/appendLedgerEntry|persistIngredientPurchases/.test(adPath),
    "F5: the ad path writes no ledger entry",
  );
  const ui = read("src/components/kc/business/RushRestockActions.tsx");
  assert(
    /\{rushAdAvailable \?/.test(ui),
    "F6: the ad button only appears when the platform can show a rewarded ad",
  );
}

console.log(
  failures === 0
    ? "\nBUSINESS RUSH RESTOCK QA: ALL PASS"
    : `\nBUSINESS RUSH RESTOCK QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
