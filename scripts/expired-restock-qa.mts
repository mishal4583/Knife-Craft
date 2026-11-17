/**
 * EXPIRED-RESTOCK QA (developer 2026-11-17: on Day 13 "Open for service" first showed "The game hit a snag", and after that two
 * ingredients were still needed even though "Buy all" had bought three days of them; buying them one by one finally worked).
 *
 * Cause: a stock entry has ONE weighted-average age (businessInventory.ts addStock). Buying on top of an expired lot of the same
 * food averaged the new stock into it, so the whole lot stayed expired (measured on a shortage day, where a big line is bought in
 * parts of 10: the rounding kept the day at the old one for all six parts). Every purchase now clears the expired stock of the
 * ingredients it adds first (the same sweep as "Throw Out Expired", recorded as waste, no money, no ledger).
 *
 *  A. The pure rule: a purchase on an expired lot leaves only the new stock, usable; the expired quantity is waste; other expired
 *     ingredients stay; a lot that is not expired is untouched (no waste).
 *  B. The whole flow: Market plan -> every line bought as the app buys it -> the next service's check is ready (Levels 3-91, 1-3 days,
 *     shortage days included, a fridge already holding stock of every age, expired lots among it).
 *  C. The quick restock and the rush restock do the same.
 *  D. The snag screen: a missing chunk starts a fresh load (new query string), the button always does, and never in a loop.
 *
 * Run: npx tsx scripts/expired-restock-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import { marketPlanFor } from "../src/game/restaurant/marketPlan.ts";
import { purchaseParts } from "../src/game/restaurant/purchaseParts.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { ingredientBulkDiscount } from "../src/game/restaurant/bulkBuying.ts";
import { supplierEffects, supplierPriceFactor } from "../src/game/restaurant/restaurantEconomy.ts";
import { lbPerMarketUnit, marketStep, measureOf } from "../src/game/business/measure.ts";
import { serviceStockCheck } from "../src/game/restaurant/campaignStock.ts";
import { quickRestock } from "../src/game/restaurant/quickRestock.ts";
import { ticketsFor } from "../src/game/restaurant/serviceTickets.ts";
import { paidOrdersFor } from "../src/game/levels/paidOrders.ts";
import { usableQuantity } from "../src/game/business/perishability.ts";
import { discardExpiredStock } from "../src/game/business/discardExpired.ts";
import { isChunkLoadError } from "../src/lib/freshReload.ts";

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

/** A save at level `n` on business day `day`, with a lot of food in the fridge of the given age. */
function at(n: number, day: number, lots: Record<string, [number, number]> = {}): SaveData {
  const s = fresh();
  s.credits = 2_900_000;
  s.levelProgress.highestUnlockedLevelId = `level-${n}`;
  s.levelProgress.completedLevelIds = Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`);
  s.business.calendar.businessDay = day;
  if (n >= 23)
    s.business.refrigerator.refrigeratorId =
      n >= 26 ? "professional-refrigerator" : "commercial-refrigerator";
  for (const [id, [quantity, age]] of Object.entries(lots))
    s.business.inventory[id as keyof typeof s.business.inventory] = {
      ingredientId: id as never,
      quantity,
      unitCost: 100,
      purchaseDay: day - age,
    };
  return s;
}
/** One Market purchase exactly as the app makes it (App.buyOn). */
function buy(s: SaveData, id: string, units: number) {
  const m = measureOf(s);
  return purchaseIngredient(
    s,
    id,
    units,
    ingredientBulkDiscount(id as never, units, m),
    supplierPriceFactor(s),
    supplierEffects(s).freshnessBonusDays,
    lbPerMarketUnit(id as never, m),
    marketStep(id as never),
  );
}

console.log("A. A purchase on an expired lot");
{
  const day = 10;
  // steak and chicken last 3 days: a lot bought 3 days ago is expired today
  const s = at(20, day, { steak: [53, 3], chicken: [8, 3], onion: [4, 1] });
  const r = buy(s, "steak", 10);
  assert(r.ok, "A1: the purchase goes through");
  if (r.ok) {
    const e = r.save.business.inventory.steak!;
    assert(
      e.quantity === 10 && usableQuantity(r.save.business.inventory, "steak", day) === 10,
      "A2: only the new stock is left, and all of it is usable",
      e,
    );
    const acc = r.save.business.finance.dailyAccumulator;
    assert(
      acc.discardedQuantity === 53 &&
        r.save.business.spoilage.totalSpoiledQuantity === 53 &&
        acc.discardedValue > 0,
      "A3: the 53 expired are recorded as waste (today's waste and the lifetime total)",
      { acc, sp: r.save.business.spoilage },
    );
    assert(
      r.save.business.inventory.chicken?.quantity === 8 &&
        r.save.business.inventory.onion?.quantity === 4,
      "A4: another expired ingredient and a fresh one are untouched",
    );
    assert(
      s.credits - r.save.credits === r.totalCost,
      "A5: the wallet only paid the purchase (waste moves no money)",
    );
  }
  // a lot that is not expired: merged as before, no waste
  const live = buy(at(20, day, { steak: [5, 1] }), "steak", 10);
  assert(
    live.ok &&
      live.save.business.inventory.steak!.quantity === 15 &&
      live.save.business.finance.dailyAccumulator.discardedQuantity === 0,
    "A6: stock that is not expired is merged as before, nothing is thrown out",
  );
  const only = discardExpiredStock(s, ["steak"]);
  assert(
    only.ok &&
      only.quantity === 53 &&
      only.save.business.inventory.chicken?.quantity === 8 &&
      !only.save.business.inventory.steak,
    "A7: the sweep can be limited to named ingredients; with no list it sweeps the whole fridge",
  );
  const all = discardExpiredStock(s);
  assert(all.ok && all.quantity === 61, "A8: no list = every expired ingredient (53 + 8)");
}

console.log("B. Market plan -> Buy all -> the next service is ready");
{
  let runs = 0;
  let notReady: unknown = null;
  let waste = 0;
  for (const days of [1, 2, 3])
    for (let day = 1; day <= 14; day++)
      for (let n = 3; n <= 91; n++) {
        let s = at(n, day);
        // a fridge that already holds stock of every age, expired lots among it (a seeded pattern)
        let h = n * 131 + day * 17 + days;
        const rnd = () => (h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        for (const row of marketPlanFor(s, 3).rows) {
          if (rnd() < 0.5) continue;
          const qty = Math.round(rnd() * row.stock * 10) / 10;
          if (qty > 0)
            s.business.inventory[row.ingredientId] = {
              ingredientId: row.ingredientId,
              quantity: qty,
              unitCost: 100,
              purchaseDay: day - Math.floor(rnd() * 4),
            };
        }
        const plan = marketPlanFor(s, days);
        for (const row of plan.rows) {
          const parts = purchaseParts(s, row.ingredientId, row.buyUnits);
          let after = s;
          let ok = parts.length > 0;
          for (const units of parts) {
            const r = buy(after, row.ingredientId, units);
            if (!r.ok) {
              ok = false;
              break;
            }
            after = r.save;
          }
          if (ok) s = after;
        }
        waste += s.business.finance.dailyAccumulator.discardedQuantity;
        runs++;
        const level = getLevel(`level-${n}`);
        if (!level) continue;
        const { tickets, progress } = ticketsFor(s.levelProgress, level);
        const check = serviceStockCheck(
          s,
          n,
          tickets.slice(paidOrdersFor(progress, level.id).length),
        );
        if (check.applies && !check.ready && plan.noRoomToday.length === 0 && !notReady)
          notReady = {
            days,
            day,
            n,
            missing: check.missingRows.map((r) => [r.ingredientId, r.missing]),
          };
      }
  assert(
    notReady === null && runs === 3 * 14 * 89,
    `B1: after Buy all the next service is ready in all ${runs} cases (Levels 3-91, 1-3 days, days 1-14 with their shortage days)`,
    notReady,
  );
  assert(waste > 0, "B2: the runs really did sweep expired lots (so B1 exercises the fix)", {
    waste,
  });
}

console.log("C. Quick restock");
{
  const day = 10;
  // a service that needs stock: Level 20 with nothing usable but an expired lot of the first missing food
  let s = at(20, day);
  const level = getLevel("level-20")!;
  const { tickets } = ticketsFor(s.levelProgress, level);
  const probe = serviceStockCheck(s, 20, tickets);
  const first = probe.applies ? probe.missingRows[0] : undefined;
  if (first) {
    s = at(20, day, { [first.ingredientId]: [first.needed * 2, 20] });
    const check = serviceStockCheck(s, 20, tickets);
    const r = quickRestock(s, check);
    assert(r.ok, "C1: the quick restock goes through on an expired lot", r.ok ? undefined : r);
    if (r.ok) {
      const after = serviceStockCheck(r.save, 20, tickets);
      assert(
        after.applies &&
          after.rows.find((x) => x.ingredientId === first.ingredientId)!.missing === 0,
        "C2: the food it bought is usable (not averaged into the expired lot)",
      );
    }
  } else assert(false, "C0: Level 20 has a missing food to test with");
}

console.log("D. The snag screen");
{
  assert(
    isChunkLoadError(
      new TypeError(
        "Failed to fetch dynamically imported module: https://x/assets/restaurantScreens-abc.js",
      ),
    ) &&
      isChunkLoadError(new TypeError("Importing a module script failed.")) &&
      isChunkLoadError(new Error("Loading chunk 12 failed.")) &&
      !isChunkLoadError(new Error("Cannot read properties of undefined (reading 'x')")) &&
      !isChunkLoadError(undefined),
    "D1: a missing or unreachable chunk is told apart from a real bug in a screen",
  );
  const main = read("src/main.tsx");
  const lib = read("src/lib/freshReload.ts");
  assert(
    main.includes("if (isChunkLoadError(error)) reloadFresh();") &&
      main.includes("onClick={() => reloadFresh(true)}") &&
      main.includes('"vite:preloadError"'),
    "D2: a missing chunk starts a fresh load by itself; the Reload button always does; Vite's preload error too",
  );
  assert(
    lib.includes('searchParams.set("fresh"') &&
      lib.includes("AUTO_EVERY_MS = 60_000") &&
      lib.includes("if (!force && Date.now() - last < AUTO_EVERY_MS) return false;"),
    "D3: the fresh load changes the query string (so a cached index.html cannot answer) and an automatic one runs at most once a minute",
  );
}

if (failures) {
  console.log(`\nEXPIRED-RESTOCK QA: ${failures} FAILED`);
  process.exit(1);
}
console.log("\nEXPIRED-RESTOCK QA: ALL PASS");
