/**
 * DAY CLOCK QA (developer 2026-10-11: "improve the day and night setting").
 * restaurant/dayClock.ts — read-only, from the restaurant day.
 *
 *  P  Phases: a day not yet open is "opening" (its first service next); an
 *     open day between services is the "lull" (the next one named, k/n);
 *     a day whose last service is done is "closing".
 *  L  Light: the next service's time of day (Breakfast dawn … Dinner
 *     evening, Late Supper late), night at closing.
 *  W  Weekday: Day 1 is Monday, a 7-day week; the week number.
 *  S  The strip's text for each phase.
 *  R  Read-only: nothing in the save changes.
 *  K  Wiring: the Kitchen shows the strip and the light (restaurant build
 *     only); Closing Time is night.
 *
 * Run: npx tsx scripts/restaurant-day-clock-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { dayClockFor, dayStripText } from "../src/game/restaurant/dayClock.ts";
import { openDay, recordService, restaurantDayOf } from "../src/game/restaurant/restaurantDay.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) =>
  fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), p), "utf8");
const saveAt = (n: number): SaveData => ({
  ...DEFAULT_SAVE,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
});

console.log("P / L. Phases and light");
{
  const s = saveAt(25);
  const opening = dayClockFor(s, 25);
  const day = openDay(s, 25);
  const one = recordService(day, 25);
  const lull = dayClockFor(one, 26);
  const two = recordService(one, 26);
  const dinner = dayClockFor(two, 27);
  const three = recordService(two, 27);
  const closing = dayClockFor(three, 28);
  assert(
    opening.phase === "opening" &&
      opening.next?.name === "Breakfast" &&
      opening.light === "dawn" &&
      lull.phase === "lull" &&
      lull.next?.name === "Lunch" &&
      lull.next.index === 2 &&
      lull.light === "midday" &&
      dinner.next?.name === "Dinner" &&
      dinner.light === "evening" &&
      restaurantDayOf(three).closingDue &&
      closing.phase === "closing" &&
      closing.next === null &&
      closing.light === "night",
    "P1/L1: opening (Breakfast, dawn) → lull (Lunch 2/3, midday) → Dinner (evening) → closing (night)",
    { opening, lull, dinner, closing },
  );
  const late = dayClockFor(saveAt(170), 170);
  const tea = dayClockFor(saveAt(60), 60);
  assert(
    late.services.length === 6 &&
      late.services.at(-1) === "Late Supper" &&
      tea.services.includes("Afternoon Tea"),
    "L2: the day's services follow the schedule (Afternoon Tea from L51, 6 with Late Supper from L161)",
  );
}

console.log("W / S. Weekday and strip");
{
  const d1 = dayClockFor(saveAt(1), 1);
  const s8 = {
    ...saveAt(30),
    business: { ...saveAt(30).business, restaurantDay: { ...restaurantDayOf(saveAt(30)), day: 8 } },
  };
  const d8 = dayClockFor(s8, 30);
  assert(
    d1.weekday === "Monday" && d1.week === 1 && d8.weekday === "Monday" && d8.week === 2,
    "W1: Day 1 is Monday; Day 8 is Monday of week 2",
  );
  const s = saveAt(25);
  const one = recordService(openDay(s, 25), 25);
  assert(
    dayStripText(dayClockFor(s, 25)) === "Day 1 · Mon · 🌅 Opening: Breakfast first (3 services)" &&
      dayStripText(dayClockFor(one, 26)) === "Day 1 · Mon · ☀️ Lunch next (2/3)",
    "S1: the strip says the day, the weekday and what's next",
    [dayStripText(dayClockFor(s, 25)), dayStripText(dayClockFor(one, 26))],
  );
}

console.log("R. Read-only");
{
  const s = saveAt(40);
  const before = JSON.stringify(s);
  dayClockFor(s, 40);
  assert(JSON.stringify(s) === before, "R1: reading the clock changes nothing");
}

console.log("K. Wiring");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const closing = read("src/components/kc/restaurant/ClosingTime.tsx");
  assert(
    /RESTAURANT_MODE \? dayClockFor\(save, reached\) : null/.test(kitchen) &&
      /data-testid="day-strip"/.test(kitchen) &&
      /data-day-light=\{clock\.light\}/.test(kitchen) &&
      /data-day-light="night"/.test(closing) &&
      !/Math\.random/.test(read("src/game/restaurant/dayClock.ts")),
    "K1: the Kitchen shows the strip and the light in the restaurant build; Closing Time is night; no randomness",
  );
}

console.log(failures ? `\nDAY CLOCK QA: ${failures} FAILURE(S)` : "\nDAY CLOCK QA: ALL PASS");
process.exit(failures ? 1 : 0);
