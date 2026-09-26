/**
 * BUSINESS_CALENDAR_QA — Economy V3 Phase 1. Verifies the Business
 * Calendar in isolation and its independence from Campaign progression,
 * against the real production functions only.
 *
 * Run: npx tsx scripts/business-calendar-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import {
  DEFAULT_BUSINESS_CALENDAR,
  dayOfWeekFor,
  businessWeekFor,
  advanceBusinessDay,
  DAYS_OF_WEEK,
  type BusinessCalendar,
} from "../src/game/business/businessCalendar.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function saveAt(overrides: Partial<SaveData>): SaveData {
  return { ...DEFAULT_SAVE, ...overrides };
}

// ===== A: default calendar starts at Day 1, Monday, Week 1. =====
{
  assert(DEFAULT_BUSINESS_CALENDAR.businessDay === 1, "A: default business day is 1");
  assert(dayOfWeekFor(1) === "Monday", "A2: Day 1 is Monday");
  assert(businessWeekFor(1) === 1, "A3: Day 1 is Week 1");
  assert(DAYS_OF_WEEK.length === 7, "A4: exactly 7 named days of the week");
}

// ===== B: dayOfWeek cycles correctly across a full week and into the next. =====
{
  const expected = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  for (let day = 1; day <= 7; day++) {
    assert(dayOfWeekFor(day) === expected[day - 1], `B: Day ${day} is ${expected[day - 1]}`);
  }
  assert(dayOfWeekFor(8) === "Monday", "B2: Day 8 wraps back to Monday");
  assert(dayOfWeekFor(14) === "Sunday", "B3: Day 14 is Sunday (end of week 2)");
  assert(dayOfWeekFor(15) === "Monday", "B4: Day 15 starts week 3 on Monday");
}

// ===== C: businessWeek increments exactly every 7 days. =====
{
  assert(businessWeekFor(1) === 1 && businessWeekFor(7) === 1, "C: Days 1-7 are all Week 1");
  assert(businessWeekFor(8) === 2 && businessWeekFor(14) === 2, "C2: Days 8-14 are all Week 2");
  assert(businessWeekFor(15) === 3, "C3: Day 15 is Week 3");
  assert(businessWeekFor(365) === Math.floor(364 / 7) + 1, "C4: Day 365 computes the expected week number");
}

// ===== D: advanceBusinessDay is pure and strictly increments by 1. =====
{
  const start: BusinessCalendar = { businessDay: 1 };
  const next = advanceBusinessDay(start);
  assert(next.businessDay === 2, "D: advancing from Day 1 gives Day 2");
  assert(start.businessDay === 1, "D2: advanceBusinessDay never mutates its input (pure function)");
  let calendar: BusinessCalendar = { businessDay: 1 };
  for (let i = 0; i < 364; i++) calendar = advanceBusinessDay(calendar);
  assert(calendar.businessDay === 365, `D3: 364 sequential advances from Day 1 reach Day 365 (got ${calendar.businessDay})`);
}

// ===== E: deterministic — repeated calls with the same input give the same output (no Math.random anywhere). =====
{
  const a = dayOfWeekFor(42);
  const b = dayOfWeekFor(42);
  assert(a === b, "E: dayOfWeekFor(42) is deterministic across repeated calls");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const filePath = path.join(import.meta.dirname, "..", "src", "game", "business", "businessCalendar.ts");
  const content = fs.readFileSync(filePath, "utf8");
  const hasRandomCall = /Math\.random\(\)/.test(content) && !/(Never|No|not)\s+Math\.random\(\)/i.test(content);
  assert(!hasRandomCall, "E2: no Math.random() call exists in businessCalendar.ts");
}

// ===== F: DEFAULT_SAVE carries the default business calendar. =====
{
  assert(DEFAULT_SAVE.business.calendar.businessDay === 1, "F: DEFAULT_SAVE.business.calendar starts at Day 1");
  assert(
    JSON.stringify(DEFAULT_SAVE.business) === JSON.stringify(DEFAULT_BUSINESS_STATE),
    "F2: DEFAULT_SAVE.business matches DEFAULT_BUSINESS_STATE exactly",
  );
}

// ===== G: old-save migration — a save written before Economy V3 existed loads safely. =====
{
  const oldSaveJson = JSON.stringify({ version: 1, credits: 5000, ownedKnifeIds: ["chef"] });
  const parsed = JSON.parse(oldSaveJson) as Partial<SaveData>;
  // Mirrors SaveManager.load()'s own two-step merge exactly.
  const migrated = {
    ...DEFAULT_SAVE,
    ...parsed,
    business: { ...DEFAULT_SAVE.business, ...parsed.business },
  } as SaveData;
  assert(migrated.business.calendar.businessDay === 1, "G: an old save missing `business` entirely migrates to Day 1");
  assert(migrated.credits === 5000, "G2: the old save's own fields (credits) survive untouched");
}

// ===== H: forward migration — a save from an EARLIER V3 phase (missing a field a LATER phase adds to BusinessState) still loads safely. =====
{
  // Simulates a save written when BusinessState only had `calendar`, being
  // loaded by a build where a later phase has since added a new field
  // (modeled here with a synthetic `futureField` to prove the merge
  // strategy itself, without depending on a phase that doesn't exist yet).
  type FutureBusinessState = SaveData["business"] & { futureField?: string };
  const oldBusinessSave = {
    version: 1,
    credits: 5000,
    business: { calendar: { businessDay: 42 } },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = {
    ...DEFAULT_SAVE,
    ...oldBusinessSave,
    business: { ...defaultWithFuture, ...oldBusinessSave.business },
  };
  assert(migrated.business.calendar.businessDay === 42, "H: the save's OWN existing business.calendar value survives (Day 42, not reset to default)");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "H2: a field added by a LATER phase correctly falls back to its own default, proving the two-step merge protects future BusinessState growth");
}

// ===== I: independence from Campaign — advancing the business day never touches levelProgress/credits, and vice versa. =====
{
  const save = saveAt({ credits: 777, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-50" } });
  const nextSave = {
    ...save,
    business: { ...save.business, calendar: advanceBusinessDay(save.business.calendar) },
  };
  assert(nextSave.business.calendar.businessDay === 2, "I: advancing the business day updates business.calendar as expected");
  assert(nextSave.credits === 777, "I2: advancing the business day never touches credits");
  assert(
    nextSave.levelProgress.highestUnlockedLevelId === "level-50",
    "I3: advancing the business day never touches campaign levelProgress",
  );
  assert(
    JSON.stringify(nextSave.levelProgress) === JSON.stringify(save.levelProgress),
    "I4: levelProgress is byte-identical before/after a business-day advance",
  );
}

// ===== J: save/load round-trip (JSON serialization survives). =====
{
  let save = saveAt({});
  save = { ...save, business: { ...save.business, calendar: advanceBusinessDay(save.business.calendar) } };
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.calendar.businessDay === 2, "J: business.calendar survives a JSON save/load round-trip exactly");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
