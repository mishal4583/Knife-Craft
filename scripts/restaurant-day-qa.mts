/**
 * RESTAURANT DAY QA — Unified Restaurant phase 5: the day clock (developer:
 * "only certain levels for 1 day and then closing time and cleaning … then
 * day 2 opening time").
 *
 *  S. Schedule: Lunch + Dinner per day, Breakfast added from L51.
 *  O. Opening: Day 1 starts closed; opening notes the cash and the
 *     services; before Level 21 a new day opens without its card
 *     (developer 2026-10-09, first levels), from Level 21 the card shows.
 *  V. Services: only first completions count; after the last one closing is
 *     due; extra counts change nothing; an unopened day opens implicitly.
 *  C. Closing: before L21 only the day number moves (food doesn't age yet);
 *     from L21 the freshness clock advances, expired stock is thrown out
 *     and recorded as waste, no money or ledger change; from L91 closing is
 *     End Business Day exactly; never closes a day that isn't finished.
 *  P. The closing screen's preview: chores by stage, spoiled food equal to
 *     what closing really throws out, cash at opening → now.
 *  L. Saves: a save without the field reads as Day 1; the state survives
 *     the real SaveManager save/load.
 *  W. Wiring: services counted only on a first completion and only under
 *     RESTAURANT_MODE; closing blocks the next first play; START opens the
 *     day; the Closing Time sheet closes it.
 *
 * Run: npx tsx scripts/restaurant-day-qa.mts
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
  closeDay,
  closingPreview,
  openDay,
  opensNewDay,
  recordService,
  restaurantDayOf,
  todaysServices,
} from "../src/game/restaurant/restaurantDay.ts";
import { giveGrandmasLeftovers } from "../src/game/restaurant/grandmasFridge.ts";
import { servicesForDayAt } from "../src/game/restaurant/restaurantProgression.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { dayCeremonyAt } from "../src/game/restaurant/firstLevels.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { getLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const progressAt = (n: number): LevelProgress => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 100_000,
  levelProgress: progressAt(n),
  business: { ...DEFAULT_SAVE.business, inventory: {} },
});
/** A finished day at level n (opened with credits, two services done). */
const finishedDay = (n: number) => {
  let s = openDay(saveAt(n), n);
  for (let i = 0; i < servicesForDayAt(n).length; i++) s = recordService(s, n + i);
  return s;
};

console.log("S. Schedule");
assert(
  servicesForDayAt(1).join() === "Lunch,Dinner" &&
    servicesForDayAt(50).join() === "Lunch,Dinner" &&
    servicesForDayAt(51).join() === "Breakfast,Lunch,Dinner",
  "S1: Lunch + Dinner per day; Breakfast added from Level 51",
);

console.log("O. Opening");
{
  const s = saveAt(12);
  const d0 = restaurantDayOf(s);
  const opened = openDay(s, 12);
  const d1 = restaurantDayOf(opened);
  assert(
    d0.day === 1 && !d0.opened && opensNewDay(s),
    "O1: Day 1 starts closed; the next level opens it",
  );
  assert(
    d1.opened &&
      d1.servicesPlanned === 2 &&
      d1.openingCredits === 100_000 &&
      d1.openingLevel === 12 &&
      !opensNewDay(opened) &&
      todaysServices(opened, 12)
        .map((x) => `${x.name}@${x.levelNumber}`)
        .join() === "Lunch@12,Dinner@13",
    "O2: opening notes the cash and the day's services (Lunch L12, Dinner L13)",
  );
  assert(openDay(opened, 13) === opened, "O3: an open day doesn't open again");
  // From Level 4 the level's own order needs stock (developer 2026-10-09): Grandma's
  // leftovers, as App gives them after Level 3, cover Level 5.
  const stocked5 = giveGrandmasLeftovers(saveAt(5));
  const plan5 = servicePlanFor(stocked5, getLevel("level-5")!);
  const mid = servicePlanFor(openDay(stocked5, 5), getLevel("level-5")!);
  // Developer 2026-10-09 (first levels, firstLevels.ts): the opening card is the
  // day's ceremony from Level 21. Before it the plan still opens the day on START,
  // but no sheet shows for it (was: "the opening card shows even before stock (L5)").
  assert(
    !!plan5 &&
      plan5.opening !== null &&
      !servicePlanNeedsSheet(plan5) &&
      (!plan5.check.applies || plan5.check.ready) &&
      !!mid &&
      mid.opening === null &&
      !servicePlanNeedsSheet(mid) &&
      !dayCeremonyAt(20) &&
      dayCeremonyAt(21),
    "O4: before Level 21 a new day opens without its card (L5); mid-day a stock-free level starts at once; the card starts at L21",
  );
}

console.log("V. Services");
{
  const one = recordService(openDay(saveAt(12), 12), 12);
  const two = recordService(one, 13);
  const three = recordService(two, 14);
  assert(
    restaurantDayOf(one).servicesDone === 1 &&
      !restaurantDayOf(one).closingDue &&
      restaurantDayOf(two).closingDue &&
      restaurantDayOf(three).servicesDone === 2,
    "V1: two services close the day; a count past closing changes nothing",
  );
  const implicit = recordService(saveAt(1), 1);
  assert(
    restaurantDayOf(implicit).opened &&
      restaurantDayOf(implicit).servicesDone === 1 &&
      restaurantDayOf(implicit).openingCredits === 100_000,
    "V2: a service on an unopened day (the first launch) opens it",
  );
  const big = recordService(recordService(recordService(openDay(saveAt(60), 60), 60), 61), 62);
  assert(
    restaurantDayOf(big).servicesPlanned === 3 && restaurantDayOf(big).closingDue,
    "V3: from L51 a day holds three services",
  );
}

console.log("C. Closing");
{
  const early = finishedDay(12);
  const closed = closeDay(early, 13);
  assert(
    restaurantDayOf(closed).day === 2 &&
      !restaurantDayOf(closed).opened &&
      !restaurantDayOf(closed).closingDue &&
      closed.business.calendar.businessDay === early.business.calendar.businessDay &&
      closed.business.inventory === early.business.inventory &&
      closed.credits === early.credits,
    "C1: before L21 closing only moves the day number (food doesn't age yet)",
  );
  let fresh = finishedDay(25);
  fresh = {
    ...fresh,
    business: {
      ...fresh.business,
      inventory: addStock(
        addStock({}, "basil", 2, 180, fresh.business.calendar.businessDay - 3),
        "potato",
        3,
        60,
        fresh.business.calendar.businessDay,
      ),
    },
  };
  const night = closeDay(fresh, 26);
  assert(
    night.business.calendar.businessDay === fresh.business.calendar.businessDay + 1 &&
      !night.business.inventory.basil &&
      !!night.business.inventory.potato &&
      night.business.spoilage.totalSpoiledValue > fresh.business.spoilage.totalSpoiledValue &&
      night.credits === fresh.credits &&
      night.economyLedger.length === fresh.economyLedger.length &&
      restaurantDayOf(night).day === 2,
    "C2: from L21 closing advances the freshness clock and throws out expired stock as waste, no money",
  );
  const late = finishedDay(95);
  const lateClosed = closeDay(late, 96);
  const reference = endBusinessDay(late).save;
  assert(
    JSON.stringify({ ...lateClosed.business, restaurantDay: null }) ===
      JSON.stringify({ ...reference.business, restaurantDay: null }) &&
      lateClosed.credits === reference.credits,
    "C3: from L91 closing is exactly End Business Day (payroll, inspection, P&L)",
  );
  const midDay = recordService(openDay(saveAt(30), 30), 30);
  assert(closeDay(midDay, 30) === midDay, "C4: a day that isn't finished never closes");
}

console.log("P. Preview");
{
  const p12 = closingPreview(finishedDay(12), 13);
  let fresh = finishedDay(35);
  fresh = {
    ...fresh,
    business: {
      ...fresh.business,
      inventory: addStock({}, "basil", 2, 180, fresh.business.calendar.businessDay - 3),
    },
  };
  const p35 = closingPreview(fresh, 36);
  const after = closeDay(fresh, 36);
  assert(
    p12.chores.map((c) => c.id).join() === "wash-up,wipe-down,count" &&
      p35.chores.map((c) => c.id).join() === "wash-up,wipe-down,spoiled,dining-room,count" &&
      p12.spoiled === null,
    "P1: the chores grow with the stages (spoiled food from L21, the dining room from L31)",
  );
  assert(
    p35.spoiled !== null &&
      p35.spoiled.ingredientIds.join() === "basil" &&
      p35.spoiled.value ===
        after.business.spoilage.totalSpoiledValue - fresh.business.spoilage.totalSpoiledValue,
    "P2: the preview's spoiled food is exactly what closing throws out",
  );
  assert(
    p35.cashAtOpening === 100_000 && p35.cashNow === fresh.credits && p35.day === 1,
    "P3: today's count: cash at opening → now",
  );
}

console.log("L. Saves");
{
  assert(
    restaurantDayOf(saveAt(5)).day === 1 && DEFAULT_SAVE.business.restaurantDay === undefined,
    "L1: a save without the field reads as Day 1; the classic default save is unchanged",
  );
  const s = closeDay(finishedDay(40), 41);
  await SaveManager.save(s);
  const back = await SaveManager.load();
  assert(
    restaurantDayOf(back).day === 2,
    "L2: the day state survives the real SaveManager save/load",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    // Phase G wraps the count in the wash-up (serviceSupplies.washUp); the guard is the same.
    /if \(RESTAURANT_MODE && isFirstCompletion\)\s*nextSave = (?:washUp\(\s*)?recordService\(nextSave, levelNumber\(level\.id\)\)/.test(
      app,
    ),
    "W1: a service is counted only on a first completion, only under RESTAURANT_MODE",
  );
  assert(
    // Since the first levels (2026-10-09) a day before Level 21 closes quietly with the
    // same closeDay, so the hold reads the save after that (`base`; pass 2 also gives
    // Grandma's leftovers there, once).
    /const base = giveGrandmasTools\(\s*giveGrandmasLeftovers\(quietDayEnd\(save\)\),\s*restaurantLevelOf\(save\.levelProgress\),?\s*\);/.test(
      app,
    ) &&
      /if \(firstPlay && restaurantDayOf\(base\)\.closingDue\) \{\s*closingHoldRef\.current = true;/.test(
        app,
      ) &&
      /restaurantDayOf\(s\)\.closingDue && !dayCeremonyAt\(restaurantLevel\)\s*\? closeDay\(s, restaurantLevel\)/.test(
        app,
      ) &&
      /beginLevel\(id, opensDay \? openDay\(save, levelNumber\(id\)\) : undefined\)/.test(app) &&
      /if \(pending\?\.opening\) \{\s*beginLevel\(levelId, openDay\(base, pending\.levelNumber\)\)/.test(
        app,
      ) &&
      /persist\(closeDay\(save, restaurantLevelOf\(save\.levelProgress\)\)\)/.test(app) &&
      /closingDue &&\s*dayCeremonyAt\(restaurantLevelOf\(save\.levelProgress\)\) &&/.test(app),
    "W2: closing blocks the next first play (quietly closed before L21); START, or a start without the card, opens the day; the Closing Time sheet closes it from L21",
  );
}

console.log(
  failures ? `\nRESTAURANT DAY QA: ${failures} FAILURE(S)` : "\nRESTAURANT DAY QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
