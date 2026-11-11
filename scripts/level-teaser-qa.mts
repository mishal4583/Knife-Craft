/**
 * LEVEL TEASER QA (developer 2026-11-10): the one-line "Next: ..." on the last plate of each of the first 20 levels
 * (restaurant/levelTeasers.ts). A every level 1-20 has a short line, none after; B each line agrees with the schedule it promises
 * (a moved unlock must move the line); C the served card and App carry it only at the end of a level.
 */
import fs from "node:fs";
import path from "node:path";
import { levelTeaser, TEASER_LAST_LEVEL } from "../src/game/restaurant/levelTeasers.ts";
import {
  DINE_IN_FROM_LEVEL,
  FRIDGE_FROM_LEVEL,
  SECOND_FLOOR_FROM_LEVEL,
} from "../src/game/config/earlyLevels.ts";
import { CLEANING_FROM_LEVEL } from "../src/game/config/cleaningStart.ts";
import { FEATURE_UNLOCKS, featuresOpeningAt } from "../src/game/config/featureUnlocks.ts";
import { SAUCE_FIRST_LEVEL } from "../src/game/business/sauceStation.ts";
import { INSPECTION_FIRST_LEVEL } from "../src/game/business/deliveryInspection.ts";
import { NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL } from "../src/game/config/earlyLevels.ts";

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

console.log("A. The lines");
{
  const lines = Array.from({ length: TEASER_LAST_LEVEL }, (_, i) => levelTeaser(i + 1));
  assert(
    lines.every((l) => !!l && l.startsWith("Next: ")),
    "A1: Levels 1-20 each have a 'Next: ...' line",
    lines,
  );
  assert(
    lines.every((l) => l!.length <= 48),
    "A2: each is short (48 characters at most)",
    lines.filter((l) => l!.length > 48),
  );
  assert(new Set(lines).size === lines.length, "A3: no two are alike");
  assert(
    levelTeaser(21) === null && levelTeaser(0) === null,
    "A4: none after Level 20 (or before 1)",
  );
  assert(
    TEASER_LAST_LEVEL === NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL,
    "A5: the teasers cover the same levels as the served card without Next Customer",
  );
}

console.log("B. The lines agree with the schedule");
{
  const has = (level: number, word: RegExp) => word.test(levelTeaser(level) ?? "");
  assert(
    has(SAUCE_FIRST_LEVEL - 1, /Sauce Station/),
    "B1: the level before the Sauce Station announces it",
    SAUCE_FIRST_LEVEL,
  );
  assert(
    has(INSPECTION_FIRST_LEVEL - 1, /delivery/i),
    "B2: the level before Delivery Inspection announces it",
    INSPECTION_FIRST_LEVEL,
  );
  assert(
    has(FRIDGE_FROM_LEVEL - 1, /fridge/i),
    "B3: the level before the fridge check announces it",
    FRIDGE_FROM_LEVEL,
  );
  assert(
    has(SECOND_FLOOR_FROM_LEVEL - 1, /Second Floor/),
    "B4: the level before the Second Floor announces it",
    SECOND_FLOOR_FROM_LEVEL,
  );
  assert(
    has(DINE_IN_FROM_LEVEL - 1, /dishwashing/i),
    "B5: the level before dishwashing announces it",
    DINE_IN_FROM_LEVEL,
  );
  assert(
    has(CLEANING_FROM_LEVEL - 1, /cleaning/i),
    "B6: the level before the first cleaning night announces it",
    CLEANING_FROM_LEVEL,
  );
}

console.log("C. Wiring");
{
  const app = read("src/App.tsx");
  const card = read("src/components/kc/game/ServiceOrderComplete.tsx");
  assert(
    /levelTeaser\(levelNumber\(activeLevel\.id\)\)/.test(app),
    "C1: App gives the teaser for the level being served",
  );
  assert(
    /campaignWillFinishNext \|\| \(isBatchGroup && batchGroupWillFinish\)\s*\? \{ teaser/.test(app),
    "C2: only the last plate of a level carries it",
  );
  assert(/data-testid="level-teaser"/.test(card), "C3: the served card shows it");
  assert(
    !/credits|ledger|addHype/.test(read("src/game/restaurant/levelTeasers.ts")),
    "C4: it is text only: no money, no Hype",
  );
}

console.log("D. The unlock funnel event");
{
  const ids = FEATURE_UNLOCKS.map((f) => f.id);
  assert(new Set(ids).size === ids.length, "D1: each feature is named once");
  assert(
    FEATURE_UNLOCKS.every((f) => f.level >= 3 && f.level <= 12),
    "D2: all ten openings are inside Levels 3-12",
    FEATURE_UNLOCKS,
  );
  assert(
    featuresOpeningAt(SAUCE_FIRST_LEVEL).some((f) => f.id === "sauce-station") &&
      featuresOpeningAt(INSPECTION_FIRST_LEVEL).some((f) => f.id === "delivery-inspection"),
    "D3: the Sauce Station and Delivery Inspection are on their own levels",
  );
  const perLevel = Array.from({ length: 21 }, (_, i) => featuresOpeningAt(i).map((f) => f.id));
  assert(
    perLevel.every((l, i) => l.length <= (i === 3 ? 2 : 1)),
    "D4: no level opens more than one thing, except Level 3 whose two openings are the delivery routine (check, then unpack)",
    perLevel,
  );
  const app = read("src/App.tsx");
  assert(
    /isFirstCompletion\)\s*for \(const f of featuresOpeningAt\(levelNumber\(level\.id\) \+ 1\)\)\s*sendAnalyticsEvent\(\s*"feature_unlocked"/.test(
      app,
    ),
    "D5: a first completion sends feature_unlocked for the next level's openings",
  );
}

console.log(
  failures === 0 ? "\nLEVEL TEASER QA: ALL PASS" : `\nLEVEL TEASER QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
