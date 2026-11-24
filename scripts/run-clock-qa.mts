/**
 * RUN CLOCK QA (Chef Pride audit remediation, Batch 3, F6, developer 2026-11-23): how long a plate took.
 *
 *  A  the clock starts at the first touch of the board, not when the screen opens: waiting before the first cut is never counted;
 *  B  a normal preparation: the time from the first touch to the last cut, in real ms (not 250 ms ticks);
 *  C  pause and resume: paused time is not working time; a pause before the first cut does nothing; several pauses add up;
 *  D  instant completion and a plate nobody cut by hand (the Prep Cook's): 0, never negative, never a "fastest plate";
 *  E  a retry starts a new clock; the first attempt's time never leaks into it;
 *  F  an interrupted preparation: reading the clock mid-run gives the time so far, and a stop is final;
 *  G  invalid timing data: NaN, infinite, backwards and absurdly long stretches never give a negative, NaN or invented duration;
 *  H  the two things that read it use the intended time: Speed Demon (under 30 s of working time, 6+ cuts, Clean or better) and the fastest-plate record;
 *  I  wiring: Preparation starts it at CUT_STARTED, pauses/resumes with the game, stops at the last cut, restarts on a retry; it is pure (no clock, wallet, ledger, random).
 *
 * Run: npx tsx scripts/run-clock-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  MAX_STRETCH_MS,
  clockMs,
  clockPause,
  clockResume,
  clockStart,
  clockStop,
  newClock,
  type RunClock,
} from "../src/game/restaurant/runClock.ts";
import {
  DEFAULT_CHEF_RECORD,
  MIN_FAST_MS,
  QUICK_MS,
  recordRun,
  runNews,
  type RunStats,
} from "../src/game/restaurant/chefRecord.ts";
import { advanceDareOnPlate, takeDare } from "../src/game/restaurant/skillChallenges.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail));
  }
}
const read = (f: string) => fs.readFileSync(path.resolve(f), "utf8");
const valid = (n: number) => Number.isInteger(n) && n >= 0;

console.log("A. Waiting before the first cut");
{
  // The screen opens at t=1000. The player reads the order for 20 s, then makes the first touch at t=21000 and the last cut at t=35000.
  let c = newClock();
  assert(
    clockMs(c, 1000) === 0 && clockMs(c, 21000) === 0,
    "A1: an unstarted clock reads 0, however long the screen has been open",
  );
  c = clockStart(c, 21000);
  c = clockStop(c, 35000);
  assert(
    clockMs(c, 99999) === 14000,
    "A2: 20 s of waiting are not counted: the plate took 14 s",
    clockMs(c, 99999),
  );
  const c2 = clockStart(clockStart(newClock(), 5000), 9000);
  assert(
    clockMs(clockStop(c2, 12000), 20000) === 7000,
    "A3: a second touch never restarts the clock (the first one counts)",
  );
  assert(
    clockMs(clockResume(newClock(), 3000), 8000) === 0,
    "A4: resuming a clock that never started does not start it",
  );
}

console.log("B. Normal preparation");
{
  const c = clockStop(clockStart(newClock(), 1000), 1000 + 23456);
  assert(
    clockMs(c, 90000) === 23456,
    "B1: the real elapsed ms, not rounded to a tick",
    clockMs(c, 90000),
  );
  assert(
    clockMs(c, 90000) === clockMs(c, 999999),
    "B2: after the last cut the time is final (it does not grow while the plate is plated or the report is read)",
  );
}

console.log("C. Pause and resume");
{
  let c = clockStart(newClock(), 0);
  c = clockPause(c, 6000); // 6 s worked
  assert(clockMs(c, 60000) === 6000, "C1: while paused the time does not grow");
  c = clockResume(c, 46000); // paused for 40 s
  c = clockStop(c, 55000); // 9 s more
  assert(
    clockMs(c, 99999) === 15000,
    "C2: 6 s + 9 s: the 40 s pause is not working time",
    clockMs(c, 99999),
  );
  let d = clockStart(newClock(), 0);
  d = clockPause(d, 2000);
  d = clockResume(d, 4000);
  d = clockPause(d, 7000);
  d = clockResume(d, 10000);
  d = clockStop(d, 12000);
  assert(
    clockMs(d, 50000) === 2000 + 3000 + 2000,
    "C3: several pauses add up correctly",
    clockMs(d, 50000),
  );
  const e = clockPause(newClock(), 5000);
  assert(
    clockMs(clockStop(clockStart(e, 8000), 11000), 20000) === 3000,
    "C4: a pause before the first cut changes nothing",
  );
  assert(
    clockPause(clockPause(clockStart(newClock(), 0), 1000), 5000).ms === 1000,
    "C5: pausing twice does not bank time twice",
  );
  assert(
    clockResume(clockResume(clockPause(clockStart(newClock(), 0), 1000), 2000), 9000).since ===
      2000,
    "C6: resuming twice does not move the stretch",
  );
}

console.log("D. Instant completion and plates nobody cut by hand");
{
  const instant = clockStop(clockStart(newClock(), 5000), 5000);
  assert(clockMs(instant, 5000) === 0, "D1: a plate finished the moment it started reads 0");
  const never = newClock();
  assert(
    clockMs(clockStop(never, 9000), 9000) === 0 && clockMs(never, 1e9) === 0,
    "D2: the Prep Cook's plate (no touch of the board) never starts the clock: 0",
  );
  const run = (ms: number): RunStats => ({ score: 95, perfects: 3, bestCombo: 6, cuts: 8, ms });
  const rec = recordRun(DEFAULT_CHEF_RECORD, run(0));
  assert(
    rec.fastestMs === 0,
    "D3: 0 ms is never a 'fastest plate' (it is below the fair minimum)",
    rec.fastestMs,
  );
  assert(MIN_FAST_MS > 0, "D4: a plate shorter than the fair minimum does not count");
}

console.log("E. Retry");
{
  const first = clockStop(clockStart(newClock(), 0), 40000);
  assert(clockMs(first, 50000) === 40000, "E1: the first attempt took 40 s");
  // "Prepare Again": a fresh clock, untouched until the first cut of the new attempt (the player waits 15 s, then cuts for 12 s)
  let second = newClock();
  assert(clockMs(second, 60000) === 0, "E2: a retry starts again from nothing");
  second = clockStop(clockStart(second, 75000), 87000);
  assert(
    clockMs(second, 90000) === 12000,
    "E3: the retry's time is its own (12 s), not 40 s + 12 s and not the 15 s of waiting",
    clockMs(second, 90000),
  );
}

console.log("F. Interrupted preparation");
{
  const c = clockStart(newClock(), 1000);
  assert(
    clockMs(c, 9000) === 8000 && clockMs(c, 9000) < clockMs(c, 20000),
    "F1: read mid-run: the time so far, still growing",
  );
  assert(
    clockMs(clockStop(c, 9000), 5e6) === 8000,
    "F2: a stop (the last cut or a leave) is final",
  );
  assert(clockMs(c, 500) === 0, "F3: reading at a moment before the start gives 0, not a negative");
}

console.log("G. Invalid timing data");
{
  const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5];
  for (const b of bad) {
    const a = clockStart(newClock(), b);
    assert(!a.started && clockMs(a, 1000) === 0, `G1: a start at ${b} starts nothing`);
  }
  const live = clockStart(newClock(), 1000);
  for (const b of bad)
    assert(
      valid(clockMs(live, b)),
      `G2: reading at ${b} gives a whole, non-negative number`,
      clockMs(live, b),
    );
  const back = clockStop(live, 400); // time went backwards
  assert(
    clockMs(back, 400) === 0,
    "G3: a stop that is earlier than the start adds nothing (never negative)",
    clockMs(back, 400),
  );
  const nanStop = clockStop(live, Number.NaN);
  assert(
    valid(clockMs(nanStop, 5000)) && clockMs(nanStop, 5000) === 0,
    "G4: a stop at NaN banks nothing",
    clockMs(nanStop, 5000),
  );
  const frozen = clockStop(clockStart(newClock(), 0), 3 * 60 * 60 * 1000);
  assert(
    clockMs(frozen, 1e12) === MAX_STRETCH_MS,
    "G5: a stretch of three hours (a device that slept) is not believed beyond the cap",
    clockMs(frozen, 1e12),
  );
  const odd: RunClock = { started: true, running: true, since: Number.NaN, ms: Number.NaN };
  assert(
    valid(clockMs(odd, 1000)),
    "G6: a damaged clock still reads a valid number",
    clockMs(odd, 1000),
  );
  assert(valid(clockMs(newClock(), Number.NaN)), "G7: reading a new clock at NaN is 0");
}

console.log("H. What reads the clock");
{
  const day = "2026-11-23";
  const level = 12;
  // Speed Demon: 6+ cuts at Clean or better in under QUICK_MS (30 s) of working time. The player waits 20 s, then cuts for 18 s.
  const cutting = clockMs(clockStop(clockStart(newClock(), 20000), 38000), 60000);
  const sinceOpening = 38000; // what the old clock (from the screen opening) would have said
  const plate = (ms: number): RunStats => ({ score: 92, perfects: 2, bestCombo: 6, cuts: 7, ms });
  const rec = takeDare(DEFAULT_CHEF_RECORD, day, level);
  const view = (r: typeof rec) => r.challenge;
  // the dare of the day must be Speed Demon for this check: set it explicitly like the QA of the dares does
  const sd = {
    ...DEFAULT_CHEF_RECORD,
    challenge: { day, id: "speed-demon" as const, state: "accepted" as const, progress: 0 },
  };
  const won = advanceDareOnPlate(sd, day, level, plate(cutting)).won;
  const wouldHaveFailed = advanceDareOnPlate(sd, day, level, plate(sinceOpening + 20000)).won; // 58 s from mount
  assert(cutting === 18000 && QUICK_MS === 30000, "H1: the plate's working time is 18 s", cutting);
  assert(
    !!won && won.id === "speed-demon",
    "H2: Speed Demon is won on 18 s of cutting after a 20 s wait (the idle time no longer counts against it)",
  );
  assert(
    !wouldHaveFailed,
    "H3: the same plate timed from the screen opening (58 s) would have missed it: that was the bug",
  );
  assert(view(rec) !== undefined, "H4: (sanity) takeDare still works");
  const slow = advanceDareOnPlate(sd, day, level, plate(31000)).won;
  assert(!slow, "H5: 31 s of real cutting still misses Speed Demon (the rule is unchanged)");
  // fastest-plate record: uses the same working time
  const r1 = recordRun(DEFAULT_CHEF_RECORD, {
    score: 90,
    perfects: 1,
    bestCombo: 5,
    cuts: 6,
    ms: cutting,
  });
  assert(
    r1.fastestMs === 18000,
    "H6: the fastest-plate record stores the working time (18 s), not the time since the screen opened",
    r1.fastestMs,
  );
  const news = runNews(r1, { score: 90, perfects: 1, bestCombo: 5, cuts: 6, ms: 15000 });
  assert(
    news.some((n) => n.kind === "speed" && /15 s/.test(n.text)),
    "H7: a later 15 s plate is 'Fastest plate yet: 15 s' against the 18 s record",
    news,
  );
}

console.log("I. Wiring and purity");
{
  const prep = read("src/components/kc/game/Preparation.tsx");
  assert(
    /event\.type === "CUT_STARTED"\) \{\s*setShowHint\(false\);[\s\S]{0,260}clockStart\(runClock\.current, performance\.now\(\)\)/.test(
      prep,
    ),
    "I1: the clock starts at the first touch of the board (CUT_STARTED)",
  );
  assert(
    /PauseManager\.subscribe\(\(p\) => \{[\s\S]*?clockPause\(runClock\.current[\s\S]*?clockResume\(runClock\.current/.test(
      prep,
    ),
    "I2: the game's pause and resume bank and restart the clock",
  );
  assert(
    /PLATING_STARTED[\s\S]{0,700}clockStop\(runClock\.current/.test(prep) &&
      /RECIPE_COMPLETED[\s\S]{0,300}clockStop\(runClock\.current/.test(prep),
    "I3: the clock stops at the last cut (the plating) and again, harmlessly, at the result",
  );
  assert(
    /function restart\(\) \{[\s\S]{0,200}runClock\.current = newClock\(\)/.test(prep),
    "I4: a retry starts a new clock",
  );
  assert(
    !/runMs\.current/.test(prep) && (prep.match(/ms: runMs\(\)/g) ?? []).length === 3,
    "I5: the Knife Report news, the dare line and the saved run stats all read the same clock (three readers, no counter left)",
  );
  const code = read("src/game/restaurant/runClock.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(
    !/credits|economyLedger|Date\.now|new Date|Math\.random|performance\.now|window\.|localStorage/.test(
      code,
    ),
    "I6: the clock is pure: no wallet, ledger, clock read, random or storage",
  );
}

console.log(failures === 0 ? "\nRUN CLOCK QA: ALL PASS" : `\nRUN CLOCK QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
