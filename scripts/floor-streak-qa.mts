/**
 * FLOOR STREAK + BRANCH LOOK QA (developer 2026-11-25: the Second Floor's leftovers: "a floor streak", "per-branch looks and the Franchise reward art").
 *
 *  S  the streak rules (restaurant/secondFloor.ts): the days-in-a-row count, a small stacking bonus on every collect, and the guards (a gap, a clock set back, a month change)
 *  C  a real collect: the bonus is paid in the SAME one ledger entry, the wallet and ledger stay balanced, and a branch keeps the streak
 *  B  the branch looks (restaurant/branchLook.ts): one per branch, valid, in order
 *
 * Run: npx tsx scripts/floor-streak-qa.mts
 */
import { readFileSync } from "node:fs";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FLOOR_STREAK,
  MAX_BRANCH,
  STATIONS,
  buyStation,
  buyTable,
  canOpenBranch,
  collectFloor,
  floorEarnings,
  floorStreakAfter,
  floorStreakBonus,
  floorStreakPct,
  floorStreakView,
  openBranch,
  secondFloorOf,
  upgradeStation,
} from "../src/game/restaurant/secondFloor.ts";
import { BRANCH_LOOKS, branchEmblemPath, branchLook } from "../src/game/restaurant/branchLook.ts";
import { dailyKeyFor } from "../src/game/daily/DailyOrderManager.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const fresh = (credits: number): SaveData => ({ ...structuredClone(DEFAULT_SAVE), credits });
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const income = (s: SaveData) => s.economyLedger.filter((e) => e.category === "automation-income");
/** Noon of a local calendar day (so "the next day" is the next key whatever the time zone). */
const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();
function owning(ids: string[], at: number, credits = 2_000_000_000): SaveData {
  let s = fresh(credits);
  for (const id of ids) {
    const r = buyStation(s, id as never, 99, at);
    if (!r.ok) throw new Error(`setup: could not buy ${id}`);
    s = r.save;
  }
  return s;
}

console.log("S. The streak rules");
{
  assert(FLOOR_STREAK.CYCLE === 7 && FLOOR_STREAK.STEP_PCT === 2, "S1: a week, +2 % a day");
  const pct = [0, 1, 2, 3, 4, 5, 6, 7, 8, 30, 999].map(floorStreakPct);
  assert(
    JSON.stringify(pct) === JSON.stringify([0, 0, 2, 4, 6, 8, 10, 12, 12, 12, 12]),
    "S2: 0 on day 1, +2 % a day after it, +12 % from day 7 on (and never more)",
    pct,
  );
  assert(
    floorStreakPct(Number.NaN) === 0 && floorStreakPct(-5) === 0 && floorStreakPct(2.9) === 2,
    "S3: garbage days give no bonus",
  );
  assert(
    floorStreakBonus(10_000, 2) === 200 &&
      floorStreakBonus(10_001, 2) === 200 &&
      floorStreakBonus(99, 2) === 1 &&
      floorStreakBonus(10_000, 1) === 0 &&
      floorStreakBonus(-100, 7) === 0 &&
      floorStreakBonus(Number.NaN, 7) === 0 &&
      Number.isInteger(floorStreakBonus(12_345, 5)),
    "S4: the bonus is whole cents, rounded down, never negative",
  );
  const a = floorStreakAfter(undefined, "2027-01-15");
  const same = floorStreakAfter(a, "2027-01-15");
  const next = floorStreakAfter(a, "2027-01-16");
  const gap = floorStreakAfter({ days: 5, last: "2027-01-10" }, "2027-01-15");
  const back = floorStreakAfter({ days: 5, last: "2027-01-20" }, "2027-01-15");
  const month = floorStreakAfter({ days: 3, last: "2026-11-30" }, "2026-12-01");
  const year = floorStreakAfter({ days: 3, last: "2026-12-31" }, "2027-01-01");
  assert(
    a.days === 1 && same === a && next.days === 2 && gap.days === 1 && gap.last === "2027-01-15",
    "S5: the first collect is day 1, the same day changes nothing, the next day adds one, a gap starts again at 1",
    { a, same, next, gap },
  );
  assert(
    back.days === 5 && back.last === "2027-01-20",
    "S6: a device clock set back changes nothing (it can never raise or break the streak)",
    back,
  );
  assert(
    month.days === 4 && year.days === 4,
    "S7: a streak runs across a month end and a year end",
    { month, year },
  );
}

console.log("C. A real collect");
{
  const t1 = noon(2027, 1, 15);
  const t2 = noon(2027, 1, 16);
  const t3 = noon(2027, 1, 17);
  const t5 = noon(2027, 1, 21);
  let s = owning(["coffee"], t1 - 6 * 3_600_000);
  const day = (t: number) => dailyKeyFor(new Date(t));

  // day 1: no bonus; the streak starts
  const waiting1 = floorEarnings(s, t1);
  const c1 = collectFloor(s, t1);
  assert(
    c1.ok && c1.amount === waiting1 && waiting1 > 0 && secondFloorOf(c1.save).streak?.days === 1,
    "C1: the first collect pays what was waiting and starts the streak at day 1",
    { waiting1, ok: c1.ok },
  );
  s = c1.ok ? c1.save : s;

  // day 2: +2 %, in the same one ledger entry
  const waiting2 = floorEarnings(s, t2);
  const before2 = s.credits;
  const entries2 = income(s).length;
  const c2 = collectFloor(s, t2);
  const bonus2 = floorStreakBonus(waiting2, 2);
  assert(
    c2.ok &&
      bonus2 > 0 &&
      c2.amount === waiting2 + bonus2 &&
      c2.save.credits - before2 === waiting2 + bonus2 &&
      income(c2.save).length === entries2 + 1 &&
      income(c2.save).at(-1)!.amount === waiting2 + bonus2 &&
      secondFloorOf(c2.save).streak?.days === 2,
    "C2: day 2 pays +2 % on top, as ONE ledger entry equal to the money that moved",
    { waiting2, bonus2, amount: c2.ok ? c2.amount : null },
  );
  assert(
    c2.ok && 2_000_000_000 + ledgerSum(c2.save) === c2.save.credits,
    "C3: the wallet and the ledger stay balanced (opening cash + the ledger = the wallet)",
  );
  s = c2.ok ? c2.save : s;

  // a second collect the same day keeps the day, and still earns today's bonus
  const view = floorStreakView(s, t2 + 3_600_000);
  assert(
    view.days === 2 && view.counted && view.pct === 2 && view.nextPct === 4,
    "C4: later the same day the view still says day 2, counted, +2 % today, +4 % tomorrow",
    view,
  );

  // day 3: +4 %
  const c3 = collectFloor(s, t3);
  assert(
    c3.ok && secondFloorOf(c3.save).streak?.days === 3 && floorStreakView(c3.save, t3).pct === 4,
    "C5: day 3 is +4 %",
  );
  s = c3.ok ? c3.save : s;

  // a gap restarts at 1, no bonus, nothing taken back
  const creditsBefore = s.credits;
  const c5 = collectFloor(s, t5);
  assert(
    c5.ok &&
      secondFloorOf(c5.save).streak?.days === 1 &&
      c5.amount === floorEarnings(s, t5) &&
      c5.save.credits >= creditsBefore,
    "C6: after missed days the streak starts again at 1 with no bonus, and nothing already earned is lost",
  );

  // the view before today counts: it says what collecting today would earn
  const preview = floorStreakView(c3.ok ? c3.save : s, noon(2027, 1, 18));
  assert(
    !preview.counted && preview.days === 4 && preview.pct === 6,
    "C7: before today's collect the view says day 4 would be +6 %",
    preview,
  );
  const none = floorStreakView(fresh(0), t1);
  assert(
    !none.counted && none.days === 1 && none.pct === 0,
    "C8: no streak yet reads as day 1, no bonus",
    none,
  );
  // a clock set back earns nothing, so it cannot touch the streak
  const back = collectFloor(s, t1 - 10 * 24 * 3_600_000);
  assert(!back.ok, "C9: a clock set far back collects nothing");
  // nothing waiting: no streak is counted for it
  const empty = collectFloor(fresh(10), t1);
  assert(!empty.ok, "C10: an empty floor collects nothing and counts nothing");

  // the branch keeps the streak
  let full = owning(
    ["coffee", "drinks", "pizza", "burger", "iceCream", "hotFood"],
    t1 - 6 * 3_600_000,
  );
  for (const d of STATIONS) {
    for (let k = 0; k < 2; k++) {
      const r = upgradeStation(full, d.id, t1 - 6 * 3_600_000, 99);
      if (r.ok) full = r.save;
    }
    for (let i = 0; i < 9; i++) {
      const r = buyTable(full, d.id, t1 - 6 * 3_600_000);
      if (r.ok) full = r.save;
    }
  }
  full = {
    ...full,
    business: {
      ...full.business,
      secondFloor: { ...secondFloorOf(full), streak: { days: 5, last: day(t1) } },
    },
  };
  const ob = openBranch(full, t1);
  assert(
    canOpenBranch(full) &&
      ob.ok &&
      secondFloorOf(ob.save).streak?.days === 5 &&
      secondFloorOf(ob.save).branch === 1,
    "C11: opening a branch keeps the floor streak (it is the player's habit, not the machines')",
  );
  // old saves and bad data
  const old = fresh(0);
  assert(secondFloorOf(old).streak === undefined, "C12: an old save has no streak");
  const bad = {
    ...old,
    business: {
      ...old.business,
      secondFloor: { stations: {}, streak: { days: -4, last: "yesterday" } },
    },
  } as unknown as SaveData;
  assert(secondFloorOf(bad).streak === undefined, "C13: a streak with a bad day is dropped");
  const huge = {
    ...old,
    business: {
      ...old.business,
      secondFloor: { stations: {}, streak: { days: 1e12, last: "2027-01-15" } },
    },
  } as unknown as SaveData;
  assert(
    (secondFloorOf(huge).streak?.days ?? 0) <= FLOOR_STREAK.MAX_DAYS,
    "C14: an absurd day count is clamped",
  );
}

console.log("B. The branch looks");
{
  assert(
    BRANCH_LOOKS.length === MAX_BRANCH + 1,
    "B1: one look for the first branch and one for each branch after it",
    BRANCH_LOOKS.length,
  );
  const names = new Set(BRANCH_LOOKS.map((l) => l.name));
  assert(names.size === BRANCH_LOOKS.length, "B2: every branch has its own name");
  assert(
    BRANCH_LOOKS[0]!.filter === "none" && BRANCH_LOOKS.slice(1).every((l) => l.filter !== "none"),
    "B3: the first branch keeps the original picture; every later branch is tinted",
  );
  assert(
    branchLook(0) === BRANCH_LOOKS[0] &&
      branchLook(MAX_BRANCH) === BRANCH_LOOKS[MAX_BRANCH] &&
      branchLook(99) === BRANCH_LOOKS[MAX_BRANCH] &&
      branchLook(-3) === BRANCH_LOOKS[0] &&
      branchLook(Number.NaN) === BRANCH_LOOKS[0],
    "B4: out-of-range and bad branch numbers read as the nearest valid look",
  );
  const filters = BRANCH_LOOKS.map((l) => l.filter);
  assert(
    filters.every(
      (f) =>
        f === "none" ||
        /^(hue-rotate\(-?\d+deg\)|saturate\([\d.]+\)|sepia\([\d.]+\)|brightness\([\d.]+\)|contrast\([\d.]+\)| )+$/.test(
          f,
        ),
    ),
    "B5: every look is a plain CSS colour filter (no url(), no script)",
    filters,
  );
  const accents = BRANCH_LOOKS.map((l) => l.accent);
  assert(
    accents.every((a) => /^#[0-9a-f]{6}$/i.test(a)),
    "B6: every look has a hex accent colour",
    accents,
  );
}

console.log("W. The screens");
{
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const view = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  assert(
    /floorStreakView\(save, now\)/.test(view) &&
      /data-testid="floor-streak"/.test(view) &&
      /floorStreakBonus\(waiting, streak\.days\)/.test(view),
    "W1: the Second Floor shows the streak under the Collect button, and the button says what will be paid",
  );
  assert(
    /branchLook\(floor\.branch/.test(view) &&
      /filter=\{look\.filter\}/.test(view) &&
      /function BranchBadge/.test(view) &&
      /branchEmblemPath/.test(view),
    "W2: the floor takes its branch's colour (picture and edge fill) and shows the branch badge (the painted emblem, else a coloured plaque)",
  );
  const edge = read("src/components/kc/restaurantMap/MapEdgeFill.tsx");
  assert(
    /filter\?: string/.test(edge) && /style: \{ filter \}/.test(edge),
    "W3: the map's edge fill can take the same colour filter",
  );
  const map = read("src/components/kc/restaurantMap/RestaurantMapView.tsx");
  assert(
    /wide-fridge-tier/.test(map) &&
      /zone\.id === 'refrigerator'/.test(map) &&
      /FRIDGE_TIER_LABEL/.test(map),
    "W4: the wide map shows the fridge tier on the Refrigerator room",
  );
  const host = read("src/components/kc/assistant/AssistantHost.tsx");
  const css = read("src/components/kc/assistant/assistant.css");
  assert(
    /data-thought=\{current\.pose === "think"/.test(host) &&
      /\.paige-speech\[data-thought\]::after/.test(css),
    "W5: Paige's think pose uses the thought-cloud bubble",
  );
  assert(
    branchEmblemPath(0) === null &&
      branchEmblemPath(1) === "progress/branches/branch-1.webp" &&
      branchEmblemPath(5) === "progress/branches/branch-5.webp" &&
      branchEmblemPath(6) === null,
    "W6: branches 1-5 have an emblem path, the original floor has none",
  );
}

console.log(failures ? `\nFLOOR STREAK QA: ${failures} FAILED` : "\nFLOOR STREAK QA: ALL PASS");
process.exit(failures ? 1 : 0);
