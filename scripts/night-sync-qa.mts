/**
 * NIGHT / MORNING SYNC QA (developer 2026-10-29): cleaning and the night
 * chores are mandatory from Level 5; the night's pass replaces the day's
 * leftover tasks of the same kind (nothing is cleaned twice); the morning
 * is setup, not cleaning; a restaurant that opens a service with cleaning
 * undone tips half.
 *
 * Run: npx tsx scripts/night-sync-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";
import {
  CLEANING_FROM_LEVEL,
  CLOSING_COVERS,
  CLEAN_TIP_SHARE,
  DIRTY_TIP_SHARE,
  applyCleanlinessAction,
  choresAfterClose,
  choresAfterService,
  cleanlinessOf,
  phaseChores,
  snapshotServiceStart,
  tasksAfterService,
  tipHygieneShare,
} from "../src/game/restaurant/cleanliness.ts";
import { closingChoresLeft, closingRows } from "../src/game/restaurant/closingChores.ts";
import { closeDay, openDay, recordService } from "../src/game/restaurant/restaurantDay.ts";
import { dayCeremonyAt } from "../src/game/restaurant/firstLevels.ts";
import { guideStepsApplying } from "../src/game/restaurant/restaurantGuide.ts";
import { tipAfterHygiene } from "../src/game/economy/customerTips.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}

const FULL: Partial<Record<SupplyId, number>> = {
  "mop-bucket": 1,
  brooms: 1,
  "toilet-brushes": 1,
  "floor-cleaner": 20,
  disinfectant: 20,
  "paper-towels": 1000,
  "sponges-cloths": 20,
  "bin-liners": 30,
  "cleaning-liquid": 5,
  "dish-soap": 5,
};
const saveAt = (n: number, stock: Partial<Record<SupplyId, number>> = FULL): SaveData => ({
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
const open = (s: SaveData) =>
  cleanlinessOf(s)
    .tasks.map((t) => t.kind)
    .sort();
const service = { recipes: [], dineIn: 2, customers: 2 };

// A day of two services at L6/L7 (two meals a day before L15).
function dayAt(n: number) {
  let s = openDay(saveAt(n), n);
  s = tasksAfterService(recordService(s, n), n, service);
  s = choresAfterService(s, n);
  s = tasksAfterService(recordService(s, n + 1), n + 1, service);
  return choresAfterService(s, n + 1);
}

console.log("S. Starts at Level 5");
{
  assert(
    CLEANING_FROM_LEVEL === 5 &&
      dayCeremonyAt(5) &&
      !dayCeremonyAt(4) &&
      phaseChores("closing", 5).length > 0 &&
      phaseChores("closing", 4).length === 0,
    "S1: cleaning, the night chores and the day's ceremony (opening card, Closing Time) start at Level 5",
  );
  const night = dayAt(6);
  const rows = closingRows(night, 7);
  assert(
    rows.some((r) => r.type === "task") && closingChoresLeft(night, 7) > 0,
    "S2: at L7 the night has closing chores and Closing Time waits for them",
    rows.map((r) => `${r.id}:${r.state}`),
  );
}

console.log("N. The night covers the day — nothing is deleted");
{
  const night = dayAt(6);
  const left = open(night);
  assert(
    [
      "floor",
      "restroom-floor",
      "toilet",

      "equipment",
      "bins",
      "mop-all",
      "restroom-disinfect",
    ].every((k) => left.includes(k)),
    "N1: after the last service EVERY leftover task and every night chore is on the list — nothing is dropped",
    left,
  );
  const mopped = applyCleanlinessAction(night, { kind: "clean", task: "mop-all" });
  const l1 = open(mopped.save);
  assert(
    !l1.includes("mop-all") &&
      !l1.includes("floor") &&
      !l1.includes("restroom-floor") &&
      l1.includes("toilet") &&
      l1.includes("restroom-disinfect"),
    "N2: Mop all the floors is done together with the floor and restroom-floor leftovers; the toilet stays until the restroom pass",
    l1,
  );
  const disinfected = applyCleanlinessAction(mopped.save, {
    kind: "clean",
    task: "restroom-disinfect",
  });
  const gained = cleanlinessOf(disinfected.save).cleaned - cleanlinessOf(night).cleaned;
  assert(
    !open(disinfected.save).includes("toilet") && gained === 6,
    "N3: all of it counts as cleaned (mop-all + floor + restroom-floor, then disinfect + toilet + the lull's restroom refresh = 6)",
    gained,
  );
  assert(
    open(night).includes("bins") && open(disinfected.save).includes("bins"),
    "N4: what the night does not cover (the bins) stays",
  );
}

console.log("M. The morning is setup, not cleaning");
{
  let night = dayAt(6);
  for (const t of open(night))
    night = applyCleanlinessAction(night, { kind: "clean", task: t as never }).save;
  const closed = closeDay(night, 7);
  const morning = choresAfterClose(closed, 7).save;
  const left = open(morning);
  assert(
    !left.includes("restroom-check") &&
      !left.includes("toilet") &&
      !left.includes("restroom-floor") &&
      !left.includes("floor") &&
      left.every((k) => ["stations", "lay-tables"].includes(k)),
    "M1: after a cleaned night the morning holds only the setup (stations, tables) — no restroom check, no floors, no toilet",
    left,
  );
  // The night's restroom pass was skipped: the morning check comes back (never lost).
  const skipped = choresAfterClose(closeDay(dayAt(6), 7), 7).save;
  assert(
    open(skipped).includes("restroom-check"),
    "M2: if the night's restroom pass was not done, the morning restroom check is still there",
    open(skipped),
  );
}

console.log("H. Hygiene penalty");
{
  const dirty = snapshotServiceStart(dayAt(6), 8);
  const clean = snapshotServiceStart(saveAt(8), 8);
  assert(
    tipHygieneShare(dirty, 8) === DIRTY_TIP_SHARE &&
      tipHygieneShare(clean, 8) === CLEAN_TIP_SHARE &&
      tipHygieneShare(dirty, 9) === 1 &&
      tipHygieneShare(saveAt(4), 4) === 1,
    "H1: a service started with cleaning undone tips half; a fully clean one a quarter more; another level, or before L5: untouched",
  );
  const spotless = snapshotServiceStart(saveAt(8), 8);
  assert(
    tipHygieneShare(spotless, 8) === CLEAN_TIP_SHARE &&
      tipAfterHygiene(1000, CLEAN_TIP_SHARE) === 1300,
    "H1b: a fully clean start (nothing open, no dirty dishes) tips a quarter more — cleaning is rewarded too (whole dollars)",
    tipAfterHygiene(1000, CLEAN_TIP_SHARE),
  );
  assert(
    tipAfterHygiene(1000, 0.5) === 500 &&
      tipAfterHygiene(1000, 1) === 1000 &&
      tipAfterHygiene(0, 0.5) === 0 &&
      tipAfterHygiene(100, 0.5) >= 100,
    "H2: the cut tip stays whole dollars, never below the minimum, never negative",
  );
}

console.log("B. Supplies (developer 2026-10-30: nothing is given free)");
{
  const noStock = (n: number) => saveAt(n, {});
  // A service with no supplies at all: every task is one the player cannot do yet.
  const bare = snapshotServiceStart(
    choresAfterService(tasksAfterService(recordService(openDay(noStock(6), 6), 6), 6, service), 6),
    7,
  );
  assert(
    cleanlinessOf(bare).tasks.length > 0 && tipHygieneShare(bare, 7) === 1,
    "B1: tasks left undone only for want of supplies or tools never halve the tips",
    cleanlinessOf(bare).lastStart,
  );
  const stocked = snapshotServiceStart(
    choresAfterService(tasksAfterService(recordService(openDay(saveAt(6), 6), 6), 6, service), 6),
    7,
  );
  assert(
    tipHygieneShare(stocked, 7) === DIRTY_TIP_SHARE,
    "B2: with the supplies in hand, leaving the cleaning undone still halves the tips",
  );
  const step = guideStepsApplying(bare).find((x) => x.id === "cleaning-supplies");
  assert(
    !!step && step.to === "shop-supplies" && /Market/.test(step.why),
    "B3: the guide says what to restock and opens the Market (not just 'hire a Cleaner')",
    step,
  );
  assert(
    !guideStepsApplying(saveAt(6)).some((x) => x.id === "cleaning-supplies"),
    "B4: with the supplies in stock the guide does not nag",
  );
}

console.log("Z. Never a soft-lock");
{
  const bare = dayAt(6);
  const noSupplies = {
    ...bare,
    business: { ...bare.business, supplies: { ...bare.business.supplies, stock: {} } },
  };
  const rows = closingRows(noSupplies, 7);
  const stateOf = (id: string) => rows.find((r) => r.id === id)?.state;
  assert(
    stateOf("task:mop-all") === "blocked" &&
      stateOf("task:restroom-disinfect") === "blocked" &&
      closingChoresLeft(noSupplies, 7) === rows.filter((r) => r.state === "todo").length,
    "Z1: a chore short of a supply is 'blocked' (says what to buy) and never counts toward holding the close",
    rows.map((r) => `${r.id}:${r.state}`),
  );
}

console.log(failures ? `\nNIGHT SYNC QA: ${failures} FAILURE(S)` : "\nNIGHT SYNC QA: ALL PASS");
process.exit(failures ? 1 : 0);
