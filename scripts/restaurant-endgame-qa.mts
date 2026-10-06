/**
 * RESTAURANT ENDGAME QA — the architecture prepared for the next gameplay
 * phase (developer 2026-10-06), as pure modules that are NOT yet wired into
 * a day, a screen or the release build:
 *
 *  E. Events (restaurant/restaurantEvents.ts): Dinner Rush, Large Group,
 *     Today's Special — data-driven (RESTAURANT_EVENT_RULES, provisional),
 *     deterministic per Business Day, Today's Special only from the active
 *     menu's cookable dishes, its bonus the EXISTING once-a-day $50 (no second
 *     bonus), demand with events never below the plain demand and always
 *     capped by the team's capacity.
 *  S. Standing (restaurant/restaurantStanding.ts): rank = the café rank,
 *     stage = the restaurant stage, Restaurant Complete at Level 250 (the
 *     campaign done) unlocking the Endless Restaurant, nothing reset.
 *  R. Endless stars: status only — up to 3 a day (profitable, busy, clean),
 *     never money; the modules never touch the wallet or the ledger.
 *  W. Wiring: nothing in the game reads the new modules yet, so the Endless
 *     Restaurant's approved provisional economy (restaurant-endless-qa) is
 *     unchanged; no module reads RESTAURANT_MODE.
 *
 * Run: npx tsx scripts/restaurant-endgame-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  RESTAURANT_EVENT_RULES,
  demandWithEvents,
  eventsForDay,
  todaysSpecialDish,
} from "../src/game/restaurant/restaurantEvents.ts";
import { cookableMenuDishes, endlessDemandFor } from "../src/game/restaurant/endlessDemand.ts";
import { DAILY_ORDER_BONUS_COINS } from "../src/game/daily/DailyOrderManager.ts";
import {
  ENDLESS_STAR_RULES,
  isRestaurantComplete,
  restaurantStanding,
  starsForDay,
  starsForDays,
} from "../src/game/restaurant/restaurantStanding.ts";
import { RESTAURANT_SYSTEMS } from "../src/game/restaurant/restaurantProgression.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import type { BusinessDayRecord } from "../src/game/business/businessDayHistory.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "");

function saveAt(n: number, extra: Partial<SaveData["business"]> = {}): SaveData {
  const base = structuredClone(DEFAULT_SAVE) as SaveData;
  const done = Math.min(n - 1, 250);
  return {
    ...base,
    levelProgress: {
      ...base.levelProgress,
      currentLevelId: `level-${Math.min(n, 250)}`,
      highestUnlockedLevelId: `level-${Math.min(n, 250)}`,
      completedLevelIds: Array.from({ length: done }, (_, i) => `level-${i + 1}`),
    },
    business: { ...base.business, ...extra },
  };
}
const allChefs = ["indian-chef", "mediterranean-chef", "mexican-chef", "asian-chef"];
const endless = saveAt(251, { restaurantStaff: { specialists: allChefs } });

console.log("E. Events");
{
  const a = eventsForDay(endless, 17);
  const b = eventsForDay(endless, 17);
  const days = Array.from({ length: 400 }, (_, i) => eventsForDay(endless, i + 1));
  const rate = (id: string) => days.filter((d) => d.some((e) => e.id === id)).length / days.length;
  assert(
    JSON.stringify(a) === JSON.stringify(b) &&
      Math.abs(rate("dinner-rush") - RESTAURANT_EVENT_RULES["dinner-rush"].chance) < 0.07 &&
      Math.abs(rate("large-group") - RESTAURANT_EVENT_RULES["large-group"].chance) < 0.07 &&
      rate("todays-special") === 1,
    `E1: deterministic per day; over 400 days Dinner Rush ${(rate("dinner-rush") * 100).toFixed(0)}%, Large Group ${(rate("large-group") * 100).toFixed(0)}%, Today's Special every day (rules: ${RESTAURANT_EVENT_RULES["dinner-rush"].chance * 100}% / ${RESTAURANT_EVENT_RULES["large-group"].chance * 100}%)`,
  );
  const cookable = new Set(cookableMenuDishes(endless).map((d) => d.id));
  const specials = days.map((d) => d.find((e) => e.id === "todays-special"));
  const noChefs = saveAt(251);
  const noChefCookable = new Set(cookableMenuDishes(noChefs).map((d) => d.id));
  const emptyMenu = saveAt(251, {
    menuActivation: { inactiveDishIds: BUSINESS_DISH_CATALOG.map((d) => d.id) },
  });
  assert(
    specials.every((e) => e && e.id === "todays-special" && cookable.has(e.dishId)) &&
      Array.from({ length: 60 }, (_, i) => todaysSpecialDish(noChefs, i + 1)).every(
        (d) => d && noChefCookable.has(d.id),
      ) &&
      // The active menu is never empty (restaurantMenu: it falls back), so a special always exists.
      cookableMenuDishes(emptyMenu).some((d) => d.id === todaysSpecialDish(emptyMenu, 3)?.id) &&
      new Set(specials.map((e) => (e && e.id === "todays-special" ? e.dishId : ""))).size > 5,
    "E2: Today's Special is always an active, cookable menu dish (a specialist dish only with its chef, and from the never-empty fallback menu when every dish is switched off); it varies by day",
  );
  assert(
    RESTAURANT_EVENT_RULES["todays-special"].dailyBonus === DAILY_ORDER_BONUS_COINS &&
      specials.every(
        (e) => e && e.id === "todays-special" && e.dailyBonus === DAILY_ORDER_BONUS_COINS,
      ),
    `E3: its bonus is the existing once-a-day Today's Special (${DAILY_ORDER_BONUS_COINS}¢) — not a second one`,
  );
  const base = endlessDemandFor(endless, 12);
  const rush = demandWithEvents(base, [{ id: "dinner-rush", demandMultiplier: 1.3 }]);
  const group = demandWithEvents(base, [{ id: "large-group", groupSize: 6 }]);
  const huge = demandWithEvents(base, [{ id: "large-group", groupSize: 10_000 }]);
  const odd = demandWithEvents(base, [{ id: "dinner-rush", demandMultiplier: 0.2 }]);
  assert(
    JSON.stringify(demandWithEvents(base, [])) === JSON.stringify(base) &&
      rush.demand >= base.demand &&
      group.demand === base.demand + 6 &&
      huge.customers === base.capacity &&
      odd.demand === base.demand &&
      [rush, group, huge, odd].every((d) => d.customers <= d.capacity && d.customers >= 0),
    `E4: events raise demand (${base.demand} → rush ${rush.demand}, group ${group.demand}); capacity (${base.capacity}) still caps the customers; never below the plain demand`,
  );
}

console.log("S. Standing: rank, stage, Restaurant Complete");
{
  const s1 = restaurantStanding(saveAt(1).levelProgress);
  const s51 = restaurantStanding(saveAt(51).levelProgress);
  const s245 = restaurantStanding(saveAt(245).levelProgress);
  const s250 = restaurantStanding(saveAt(250).levelProgress);
  const done = restaurantStanding(saveAt(251).levelProgress);
  assert(
    s1.rank === "Humble Kitchen" &&
      s1.stage === RESTAURANT_SYSTEMS[0]!.stage &&
      s1.stageNumber === 1 &&
      s1.nextStage?.level === 11 &&
      s51.stage === "Cuisines & Specialists" &&
      s245.stage === "Grand Service" &&
      s245.nextStage?.stage === "Restaurant Complete" &&
      s245.nextStage.level === 250,
    `S1: rank and stage from the existing tables (L1 ${s1.rank} · ${s1.stage}; L51 ${s51.stage}; L245 ${s245.stage} → next Restaurant Complete at 250)`,
  );
  assert(
    !s250.complete &&
      !s250.endlessUnlocked &&
      done.complete &&
      done.endlessUnlocked &&
      done.stage === "Restaurant Complete" &&
      done.nextStage === null &&
      done.stageNumber === done.stageCount,
    "S2: Level 250 still to play → not complete; every level done → Restaurant Complete and the Endless Restaurant unlocked",
  );
  const before = JSON.stringify(endless);
  isRestaurantComplete(endless);
  restaurantStanding(endless.levelProgress);
  assert(
    JSON.stringify(endless) === before,
    "S3: reading the standing changes nothing (Endless is a continuation, nothing is reset)",
  );
}

console.log("R. Endless stars (status only)");
{
  const day = (over: Partial<BusinessDayRecord>): BusinessDayRecord => ({
    day: 1,
    revenue: 50_000,
    goodsUsed: 10_000,
    staffWages: 20_000,
    maintenance: 0,
    supplierFees: 0,
    inspectionFines: 0,
    otherOperating: 0,
    totalCosts: 30_000,
    profit: 20_000,
    waste: 0,
    ingredientPurchases: 12_000,
    packagingPurchases: 0,
    equipmentPurchases: 0,
    netCash: 18_000,
    ordersServed: ENDLESS_STAR_RULES.busyOrders,
    customersServed: ENDLESS_STAR_RULES.busyOrders,
    averageOrderValue: 1250,
    ...over,
  });
  const three = starsForDay(day({}));
  const loss = starsForDay(day({ profit: -500, waste: 900, ordersServed: 10 }));
  const empty = starsForDay(day({ profit: 0, ordersServed: 0, revenue: 0 }));
  const run = starsForDays([
    day({}),
    day({ waste: 1 }),
    day({ profit: -1, waste: 5, ordersServed: 3 }),
  ]);
  assert(
    three.stars === 3 && loss.stars === 0 && empty.stars === 0 && run.total === 5 && run.best === 3,
    "R1: up to 3 stars a day — profitable, busy, clean; a losing, wasteful, quiet day earns none; totals and best day",
  );
  const mod = code("src/game/restaurant/restaurantStanding.ts");
  assert(
    !/credits|appendLedgerEntry|debitWallet|economyLedger/.test(mod) &&
      Object.keys(three).every((k) => ["stars", "profitable", "busy", "clean"].includes(k)),
    "R2: stars are not a currency — the module never reads or writes the wallet or the ledger",
  );
}

console.log("W. Wiring");
{
  const modules = ["restaurantEvents", "restaurantStanding"];
  const users = [
    "src/App.tsx",
    "src/game/business/BusinessServiceManager.ts",
    "src/game/business/BusinessDayManager.ts",
    "src/ScreensRouter.tsx",
  ].filter((f) => modules.some((m) => read(f).includes(`restaurant/${m}`)));
  assert(
    users.length === 0,
    `W1: not wired into the game yet (${users.join(", ") || "no importers"}) — the Endless economy is unchanged`,
  );
  assert(
    modules.every((m) => !/RESTAURANT_MODE|Math\.random/.test(code(`src/game/restaurant/${m}.ts`))),
    "W2: pure — no RESTAURANT_MODE, no Math.random (the seeded generator only)",
  );
}

console.log(
  failures ? `RESTAURANT ENDGAME QA: ${failures} FAILURE(S)` : "RESTAURANT ENDGAME QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
