/**
 * RESTAURANT ENDGAME QA — the Endless Restaurant's events, standing and
 * stars (developer 2026-10-06), connected to the game (integration phase,
 * 2026-10-06):
 *
 *  E. Events (restaurant/restaurantEvents.ts): Dinner Rush, Large Group,
 *     Today's Special — data-driven (RESTAURANT_EVENT_RULES, provisional),
 *     deterministic per Business Day, Today's Special only from the active
 *     menu's cookable dishes, its bonus the EXISTING once-a-day $50 (no second
 *     bonus), demand with events never below the plain demand and always
 *     capped by the team's capacity.
 *  D. The Endless day: businessCustomersToday applies the day's events only
 *     to an Endless Restaurant save (unified restaurant + campaign complete);
 *     campaign / classic Business days are unchanged; Today's Special's dish
 *     is drawn ~featuredShare of the day's orders; the App pays the $50 via
 *     the existing daily claim, at most once a calendar day.
 *  S. Standing (restaurant/restaurantStanding.ts): rank = the café rank,
 *     stage = the restaurant stage, Restaurant Complete at Level 250 (the
 *     campaign done) unlocking the Endless Restaurant, nothing reset; shown
 *     on Restaurant Progress (restaurant build) with the lock line.
 *  R. Endless stars: status only — up to 3 a day: PROFITABLE (profit > 0),
 *     BUSY (the day's customer target served), CLEAN (inspection passed);
 *     never money; the modules never touch the wallet or the ledger.
 *  P. Persistence: lifetime stars {total, days, bestDay} in
 *     `business.endlessStars`, apart from the 30-day history (which notes
 *     each day's stars); a history roll-over never resets them; old saves
 *     load with 0; damaged values are cleaned; the real SaveManager.load
 *     keeps them.
 *  W. Wiring: App awards stars at End Business Day only for an Endless day
 *     in the restaurant build; no module reads RESTAURANT_MODE or
 *     Math.random.
 *
 * Run: npx tsx scripts/restaurant-endgame-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import {
  RESTAURANT_EVENT_RULES,
  demandWithEvents,
  endlessEventsActive,
  eventsForDay,
  featuredPool,
  todaysSpecialDish,
} from "../src/game/restaurant/restaurantEvents.ts";
import {
  businessCustomersToday,
  createBusinessServiceSession,
  advanceBusinessServiceSession,
  endlessFeaturedFor,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import {
  HISTORY_DAYS,
  sanitizeDayHistory,
  withDayRecord,
} from "../src/game/business/businessDayHistory.ts";
import { cookableMenuDishes, endlessDemandFor } from "../src/game/restaurant/endlessDemand.ts";
import { DAILY_ORDER_BONUS_COINS } from "../src/game/daily/DailyOrderManager.ts";
import {
  ENDLESS_STARS_PER_DAY,
  endlessStarsOf,
  isRestaurantComplete,
  recordEndlessDayStars,
  restaurantStanding,
  starsForDay,
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
const MOVED_IN = { version: 1, atLevel: 250, kit: [], welcomed: true } as unknown as NonNullable<
  SaveData["business"]["restaurantMigration"]
>;
const endless = saveAt(251, {
  restaurantStaff: { specialists: allChefs },
  restaurantMigration: MOVED_IN,
});

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

console.log("D. The Endless day");
{
  const classic = saveAt(251, { restaurantStaff: { specialists: allChefs } }); // never moved in (release build)
  const campaign = saveAt(120, { restaurantMigration: MOVED_IN });
  const days = Array.from({ length: 200 }, (_, i) => i + 1);
  const at = (save: SaveData, d: number): SaveData => ({
    ...save,
    business: { ...save.business, calendar: { ...save.business.calendar, businessDay: d } },
  });
  // A quiet restaurant (popularity 0) whose team can seat more than its plain demand,
  // so an event's extra guests are visible; the busy `endless` save is capacity-capped.
  const quiet: SaveData = {
    ...endless,
    business: { ...endless.business, popularity: { ...endless.business.popularity, score: 0 } },
  };
  const check = (save: SaveData) =>
    days.map((d) => {
      const s = at(save, d);
      const classicTarget = businessCustomersToday(
        at({ ...save, business: { ...save.business, restaurantMigration: undefined } }, d),
      ).target;
      const plain = endlessDemandFor(s, classicTarget);
      return {
        target: businessCustomersToday(s).target,
        expected: demandWithEvents(plain, eventsForDay(s, d)).customers,
        plain: plain.customers,
        capacity: plain.capacity,
      };
    });
  const busy = check(endless);
  const calm = check(quiet);
  const raised = calm.filter((r) => r.target > r.plain).length;
  assert(
    endlessEventsActive(endless) &&
      !endlessEventsActive(classic) &&
      !endlessEventsActive(campaign) &&
      [...busy, ...calm].every(
        (r) => r.target === r.expected && r.target <= r.capacity && r.target >= r.plain,
      ) &&
      raised > 0,
    `D1: events apply only to an Endless Restaurant save (unified + campaign complete): every day's target = its demand with that day's events, capped by capacity (quiet restaurant: ${raised}/${days.length} days raised; busy one capped at ${busy[0]!.capacity})`,
  );
  const cls = days.map((d) => businessCustomersToday(at(classic, d)).target);
  assert(
    cls.every((t) => t === cls[0]) &&
      endlessFeaturedFor(classic) === undefined &&
      endlessFeaturedFor(campaign) === undefined,
    "D2: a classic (release-build) Business day and a campaign save see no events and no featured dish",
  );
  const feat = endlessFeaturedFor(at(endless, 9))!;
  const rand = makeSeededRand(9);
  let session = createBusinessServiceSession(rand, endless.business.menuActivation, feat);
  let hits = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    if (session.current?.recipe.id === feat.recipeId) hits++;
    const served = {
      ...session,
      current: { ...session.current!, order: { ...session.current!.order, status: "COMPLETED" } },
    } as typeof session;
    session = advanceBusinessServiceSession(served, rand, endless.business.menuActivation, feat);
  }
  const pool = featuredPool(
    [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] as never,
    "a",
    0.25,
  );
  assert(
    feat &&
      hits / N > 0.12 &&
      hits / N <= RESTAURANT_EVENT_RULES["todays-special"].featuredShare + 0.03 &&
      pool.length === 4 &&
      featuredPool(pool, "zzz", 0.25).length === 4,
    `D3: Today's Special's dish weighs ${RESTAURANT_EVENT_RULES["todays-special"].featuredShare * 100}% of the pool; after the existing variety rule it is ${((hits / N) * 100).toFixed(0)}% of ${N} orders (any other dish ~2%); a dish off the pool leaves it unchanged`,
  );
  const app = code("src/App.tsx");
  const serve = app.slice(
    app.indexOf("function payTodaysSpecial"),
    app.indexOf("function serveActiveBusinessOrder") + 4000,
  );
  const adv = app.slice(
    app.indexOf("function advanceBusinessDay"),
    app.indexOf("function advanceBusinessDay") + 5000,
  );
  assert(
    /!endlessEventsActive\(s\)/.test(serve) &&
      /s\.business\.todaysSpecialServedDay !== closedDay/.test(serve) &&
      /hasClaimedToday\(s\.dailyOrder, now\)/.test(serve) &&
      /claimDaily\(s\.dailyOrder, now\)/.test(serve) &&
      /const bonus = todaysSpecialBonus\(revenue\)/.test(serve) &&
      /"daily-reward",\s*bonus/.test(serve) &&
      /withTodaysSpecialServed\(\s*appendLedgerEntry\(result\.save, "business-revenue"/.test(
        serve,
      ) &&
      /payTodaysSpecial\(/.test(adv) &&
      !/DAILY_ORDER_BONUS_COINS/.test(serve),
    "D4: serving Today's Special is noted; End Business Day pays 15 % of the day's revenue capped at the EXISTING $50, through the existing claim (hasClaimedToday → claimDaily, one \"daily-reward\" entry) — never twice a calendar day, never a second bonus",
  );
}

console.log("R. Endless stars (status only)");
{
  const day = (o: Partial<Parameters<typeof starsForDay>[0]> = {}) => ({
    profit: 20_000,
    ordersServed: 30,
    customersWanted: 30,
    inspectionPassed: true,
    ...o,
  });
  const three = starsForDay(day());
  const loss = starsForDay(day({ profit: -500, ordersServed: 10, inspectionPassed: false }));
  const empty = starsForDay(day({ profit: 0, ordersServed: 0, customersWanted: 0 }));
  const short = starsForDay(day({ ordersServed: 29 }));
  const dirty = starsForDay(day({ inspectionPassed: false }));
  assert(
    three.stars === 3 &&
      three.profitable &&
      three.busy &&
      three.clean &&
      loss.stars === 0 &&
      empty.stars === 0 &&
      short.stars === 2 &&
      !short.busy &&
      dirty.stars === 2 &&
      !dirty.clean &&
      starsForDay(day({ profit: 0 })).stars === 2,
    "R1: up to 3 stars a day — PROFITABLE (profit > 0), BUSY (every guest who wanted to eat served — the demand before the team's cap; final economy pass), CLEAN (inspection passed); a losing, failed, quiet day earns none",
  );
  const mod = code("src/game/restaurant/restaurantStanding.ts");
  assert(
    !/credits|appendLedgerEntry|debitWallet|economyLedger/.test(mod) &&
      Object.keys(three).every((k) => ["stars", "profitable", "busy", "clean"].includes(k)) &&
      ENDLESS_STARS_PER_DAY === 3,
    "R2: stars are not a currency — the module never reads or writes the wallet or the ledger",
  );
}

console.log("P. Lifetime stars: persistence and migration");
{
  const rec = (d: number): BusinessDayRecord => ({
    day: d,
    revenue: 1,
    goodsUsed: 0,
    staffWages: 0,
    maintenance: 0,
    supplierFees: 0,
    inspectionFines: 0,
    otherOperating: 0,
    totalCosts: 0,
    profit: 1,
    waste: 0,
    ingredientPurchases: 0,
    packagingPurchases: 0,
    equipmentPurchases: 0,
    netCash: 1,
    ordersServed: 1,
    customersServed: 1,
    averageOrderValue: 1,
  });
  const withHistory = (s: SaveData, h: BusinessDayRecord[]): SaveData => ({
    ...s,
    business: { ...s.business, finance: { ...s.business.finance, history: h } },
  });
  const fresh = endlessStarsOf(endless);
  let s = endless;
  const before = JSON.stringify({ c: s.credits, l: s.economyLedger, i: s.business.inventory });
  let history: BusinessDayRecord[] = [];
  const perDay = [3, 1, 2, 0, 3];
  for (let i = 0; i < 40; i++) {
    history = withDayRecord(history, rec(i + 1));
    s = withHistory(s, history);
    const n = perDay[i % perDay.length]!;
    s = recordEndlessDayStars(s, { stars: n, profitable: n > 0, busy: n > 1, clean: n > 2 });
    history = s.business.finance.history!;
  }
  const life = endlessStarsOf(s);
  const expected = Array.from({ length: 40 }, (_, i) => perDay[i % perDay.length]!).reduce(
    (a, b) => a + b,
    0,
  );
  assert(
    fresh.total === 0 &&
      fresh.days === 0 &&
      fresh.bestDay === 0 &&
      life.total === expected &&
      life.days === 40 &&
      life.bestDay === 3 &&
      history.length === HISTORY_DAYS &&
      history.at(-1)!.stars === perDay[39 % perDay.length] &&
      JSON.stringify({ c: s.credits, l: s.economyLedger, i: s.business.inventory }) === before,
    `P1: 40 Endless days → lifetime ${life.total} stars over ${life.days} days (best ${life.bestDay}), kept after the 30-day history rolled over (${history.length} records, each noting its stars); no money, ledger or stock moved`,
  );
  const old = { ...endless, business: { ...endless.business } };
  delete (old.business as { endlessStars?: unknown }).endlessStars;
  const damaged = {
    ...endless,
    business: { ...endless.business, endlessStars: { total: -4, days: "x", bestDay: 99 } },
  } as unknown as SaveData;
  const d = endlessStarsOf(damaged);
  const h = sanitizeDayHistory([{ ...rec(1), stars: 2 }, rec(2), { ...rec(3), stars: "bad" }]);
  assert(
    JSON.stringify(endlessStarsOf(old)) === JSON.stringify({ total: 0, days: 0, bestDay: 0 }) &&
      d.total === 0 &&
      d.days === 0 &&
      d.bestDay === 3 &&
      h?.length === 2 &&
      h[0]!.stars === 2 &&
      h[1]!.stars === undefined,
    "P2: an old save (no endlessStars) reads 0 / 0 / 0; damaged values are cleaned; history records keep a day's stars and drop a malformed one",
  );
}

console.log("W. Wiring");
{
  const app = code("src/App.tsx");
  const adv = app.slice(
    app.indexOf("function advanceBusinessDay"),
    app.indexOf("function advanceBusinessDay") + 5000,
  );
  assert(
    /RESTAURANT_MODE && endlessEventsActive\(paidDay\)/.test(adv) &&
      /customersWanted = businessCustomersToday\(save\)\.demand/.test(adv) &&
      adv.indexOf("businessCustomersToday(save)") < adv.indexOf("endBusinessDayImpl(save)") &&
      /inspectionReport\.overall !== "FAIL"/.test(adv) &&
      /recordEndlessDayStars\(paidDay, dayStars\)/.test(adv) &&
      !/appendLedgerEntry\([^)]*[Ss]tar/.test(adv),
    "W1: App awards an Endless day's stars at End Business Day (restaurant build, Endless only): the day's demand read before the day closes, inspection from the day's report, no ledger entry",
  );
  const modules = ["restaurantEvents", "restaurantStanding"];
  assert(
    modules.every((m) => !/RESTAURANT_MODE|Math\.random/.test(code(`src/game/restaurant/${m}.ts`))),
    "W2: pure — no RESTAURANT_MODE, no Math.random (the seeded generator only)",
  );
  const prog = code("src/components/kc/RestaurantProgress.tsx");
  assert(
    /RESTAURANT_MODE \? <StandingCard/.test(prog) &&
      prog.includes("Complete all 250 campaign levels to unlock Endless Restaurant.") &&
      code("src/components/kc/business/EndlessDayEvents.tsx").includes(
        "if (!endlessEventsActive(save)) return null",
      ),
    "W3: Restaurant Progress shows the standing + stars only in the restaurant build (with the lock line); the event card renders only on an Endless day",
  );
}

console.log(
  failures ? `RESTAURANT ENDGAME QA: ${failures} FAILURE(S)` : "RESTAURANT ENDGAME QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
