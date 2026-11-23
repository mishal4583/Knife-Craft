/**
 * CHEF RECORD QA (the "Chef Pride" plan, developer 2026-11-23: recognition, "the game knows I'm getting better").
 *
 *  A  the record: defaults for an old save, clamping of a damaged one, `business.chefRecord` is the only place (no new top-level save field);
 *  B  a plate: perfect cuts, longest combo, the runs of Clean / Masterful plates, the fastest plate (only a fair, unpaused one);
 *  C  a service: its average accuracy against the last one and the best, perfect cuts;
 *  D  news is TRUE: only a strict improvement over a real earlier mark (a first plate is not "a record", an equal is not either), with the real numbers;
 *  E  near-miss: words only (Law 4), only a few points under the next grade, never from the lowest grades;
 *  F  the rule file is pure (no wallet, ledger, clock, random or bridge), its lines carry no population claim ("only 8% of chefs") and no insult;
 *  G  wiring: Preparation gathers the plate and says the lines, App carries the plate in the SAME save as its result and the service into the Level
 *     Complete card, the banner shows the tiles.
 *
 * Run: npx tsx scripts/chef-record-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  DEFAULT_CHEF_RECORD,
  MIN_FAST_MS,
  NEAR_MISS_POINTS,
  SEEN_KEPT,
  applyRun,
  applyService,
  chefRecordOf,
  clampChefRecord,
  hasSeen,
  markSeen,
  nearMiss,
  recordRun,
  recordService,
  runNews,
  serviceNews,
  type RunStats,
} from "../src/game/restaurant/chefRecord.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const run = (o: Partial<RunStats> = {}): RunStats => ({
  score: 90,
  perfects: 2,
  bestCombo: 6,
  cuts: 12,
  ms: 20000,
  ...o,
});

console.log("A. The record");
{
  const old = chefRecordOf(DEFAULT_SAVE);
  assert(
    JSON.stringify(old) === JSON.stringify(DEFAULT_CHEF_RECORD),
    "A1: a save with no chefRecord reads as the defaults",
  );
  const bad = clampChefRecord({
    plates: -5,
    perfectCuts: "x",
    bestPerfects: 99,
    runClean: 4,
    bestRunClean: 1,
    bestServiceAccuracy: 400,
    seen: ["a", 7, "b"],
  });
  assert(
    bad.plates === 0 &&
      bad.perfectCuts === 0 &&
      bad.bestPerfects === 0 &&
      bad.bestServiceAccuracy === 100 &&
      bad.bestRunClean >= bad.runClean &&
      bad.seen.length === 2,
    "A2: a damaged record is clamped (never negative, a best is never under its run, text kept only as text)",
  );
  const out = applyRun({ ...DEFAULT_SAVE }, run());
  assert(
    out.business.chefRecord?.plates === 1 && !Object.keys(out).some((k) => !(k in DEFAULT_SAVE)),
    "A3: a plate is written under business.chefRecord and adds no top-level save field",
  );
  const src = read("src/game/SaveManager.ts");
  assert(
    !/chefRecord/.test(src),
    "A4: SaveManager keeps no chef field of its own (business is merged as before)",
  );
  assert(
    !Object.prototype.hasOwnProperty.call(DEFAULT_SAVE.business, "chefRecord"),
    "A5: DEFAULT_SAVE.business does not list the optional field",
  );
}

console.log("B. A plate");
{
  let r = DEFAULT_CHEF_RECORD;
  r = recordRun(r, run({ score: 96, perfects: 3, bestCombo: 9 }));
  assert(
    r.plates === 1 &&
      r.perfectCuts === 3 &&
      r.bestPerfects === 3 &&
      r.bestCombo === 9 &&
      r.masterful === 1 &&
      r.runClean === 1 &&
      r.runMasterful === 1,
    "B1: perfects, combo, Masterful and the runs are counted",
  );
  r = recordRun(r, run({ score: 88 }));
  assert(
    r.runClean === 2 && r.runMasterful === 0 && r.bestRunMasterful === 1,
    "B2: a Clean plate extends the clean run and ends the Masterful one (the best is kept)",
  );
  r = recordRun(r, run({ score: 60 }));
  assert(
    r.runClean === 0 && r.bestRunClean === 2,
    "B3: a weaker plate ends the run; the best run stays",
  );
  assert(r.perfectCuts === 7 && r.plates === 3, "B4: totals add up");
  const fast = recordRun(DEFAULT_CHEF_RECORD, run({ ms: 15000 }));
  assert(fast.fastestMs === 15000, "B5: a fair plate sets the fastest time");
  assert(
    recordRun(fast, run({ ms: 18000 })).fastestMs === 15000 &&
      recordRun(fast, run({ ms: 12000 })).fastestMs === 12000,
    "B6: only a faster plate replaces it",
  );
  assert(
    recordRun(DEFAULT_CHEF_RECORD, run({ ms: MIN_FAST_MS - 1 })).fastestMs === 0 &&
      recordRun(DEFAULT_CHEF_RECORD, run({ ms: 0 })).fastestMs === 0 &&
      recordRun(DEFAULT_CHEF_RECORD, run({ cuts: 1, ms: 9000 })).fastestMs === 0,
    "B7: a too-short plate, an unknown time (0) or a plate of one cut is never 'fastest'",
  );
}

console.log("C. A service");
{
  let r = recordService(DEFAULT_CHEF_RECORD, { orders: 3, accuracy: 82, perfects: 4 });
  assert(
    r.services === 1 &&
      r.bestServiceAccuracy === 82 &&
      r.lastServiceAccuracy === 82 &&
      r.bestServicePerfects === 4,
    "C1: the first service sets the marks",
  );
  r = recordService(r, { orders: 2, accuracy: 74, perfects: 1 });
  assert(
    r.bestServiceAccuracy === 82 && r.lastServiceAccuracy === 74 && r.bestServicePerfects === 4,
    "C2: a weaker service keeps the best, remembers the last",
  );
  assert(
    recordService(r, { orders: 0, accuracy: 100, perfects: 9 }) === r,
    "C3: a service with no plates records nothing",
  );
  const s = applyService({ ...DEFAULT_SAVE }, { orders: 1, accuracy: 90, perfects: 0 });
  assert(
    s.business.chefRecord?.services === 1,
    "C4: applyService writes under business.chefRecord",
  );
}

console.log("D. News is true");
{
  const fresh = DEFAULT_CHEF_RECORD;
  assert(
    runNews(fresh, run({ perfects: 5, bestCombo: 20, ms: 9000 })).length === 0,
    "D1: a first plate sets marks, it is not 'a record'",
  );
  const base = recordRun(fresh, run({ perfects: 2, bestCombo: 6, ms: 20000 }));
  assert(
    runNews(base, run({ perfects: 2, bestCombo: 6, ms: 20000 })).length === 0,
    "D2: an equal plate is not news",
  );
  assert(
    runNews(base, run({ perfects: 1, bestCombo: 4, ms: 25000 })).length === 0,
    "D3: a worse plate is not news",
  );
  const news = runNews(base, run({ perfects: 4, bestCombo: 9, ms: 12000 }));
  assert(
    news.length === 3 &&
      news.some((n) => n.kind === "perfects" && n.text.includes("4")) &&
      news.some((n) => n.kind === "combo" && n.text.includes("9")) &&
      news.some((n) => n.kind === "speed" && n.text.includes("12 s")),
    "D4: a plate that beats real marks says so, with the real numbers",
  );
  assert(
    runNews(base, run({ ms: 19600 })).every((n) => n.kind !== "speed"),
    "D5: a speed 'record' that rounds to the same second is not announced",
  );
  const rec = recordService(fresh, { orders: 2, accuracy: 70, perfects: 1 });
  assert(
    serviceNews(fresh, { orders: 2, accuracy: 99, perfects: 3 }).length === 0,
    "D6: the first service has nothing to beat",
  );
  assert(
    serviceNews(rec, { orders: 2, accuracy: 70, perfects: 1 }).length === 0,
    "D7: an equal service is not news",
  );
  const up = serviceNews(rec, { orders: 2, accuracy: 78, perfects: 1 });
  assert(
    up.length === 1 && /70% to 78%|most accurate/.test(up[0]!.text),
    "D8: a better service names the real figures",
  );
  const best = serviceNews(recordService(rec, { orders: 1, accuracy: 60, perfects: 0 }), {
    orders: 2,
    accuracy: 85,
    perfects: 1,
  });
  assert(
    best.length === 1 && /most accurate service yet: 85%/.test(best[0]!.text),
    "D9: beating the best too says 'most accurate yet'",
  );
  let m = markSeen(DEFAULT_CHEF_RECORD, "title:precision-1");
  assert(
    hasSeen(m, "title:precision-1") && markSeen(m, "title:precision-1") === m,
    "D10: a marker is kept once",
  );
  for (let i = 0; i < SEEN_KEPT + 10; i++) m = markSeen(m, `x:${i}`);
  assert(m.seen.length === SEEN_KEPT, "D11: the markers are capped");
}

console.log("E. Near-miss (words only)");
{
  assert(NEAR_MISS_POINTS <= 5, "E0: a near miss is a few points, not a wide gap");
  assert(/Masterful/.test(nearMiss(93) ?? ""), "E1: 93 is a hair from Masterful");
  assert(/Clean/.test(nearMiss(83) ?? ""), "E2: 83 is a hair from Clean");
  assert(nearMiss(88) === null, "E3: 88 is not a near miss (7 points under Masterful)");
  assert(nearMiss(96) === null && nearMiss(100) === null, "E4: nothing above the top grade");
  assert(
    nearMiss(48) === null && nearMiss(66) === null,
    "E5: the lowest grades never get a near-miss line",
  );
  assert(
    [60, 70, 83, 93, 99].every((s) => !/\d/.test(nearMiss(s) ?? "")),
    "E6: the near-miss line carries no digits (Law 4: the plate is the score)",
  );
}

console.log("F. The rule file is pure and honest");
{
  const src = code("src/game/restaurant/chefRecord.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|Math\.random|Date\.now|new Date|performance\.now|window\.bridge|localStorage|fetch\(/.test(
      src,
    ),
    "F1: no wallet, ledger, clock, random, bridge or storage in the rule file",
  );
  const all = read("src/game/restaurant/chefRecord.ts");
  const lines = [...all.matchAll(/text: `([^`]*)`|"([^"]*(?:Masterful|Clean|try)[^"]*)"/g)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
  const sample = [
    ...runNews(
      recordRun(DEFAULT_CHEF_RECORD, run()),
      run({ perfects: 9, bestCombo: 30, ms: 8000 }),
    ).map((n) => n.text),
    ...serviceNews(recordService(DEFAULT_CHEF_RECORD, { orders: 1, accuracy: 50, perfects: 0 }), {
      orders: 1,
      accuracy: 70,
      perfects: 0,
    }).map((n) => n.text),
    nearMiss(93) ?? "",
    ...lines,
  ];
  assert(
    sample.every(
      (t) => !/\bonly\s+\d+\s*%|% of (chefs|players)|top\s+\d+\s*%|better than \d+/i.test(t),
    ),
    "F2: no population claim (the game has no population data)",
  );
  assert(
    sample.every(
      (t) =>
        !/\b(stupid|idiot|loser|pathetic|useless|terrible|worthless|trash|garbage|noob)\b/i.test(t),
    ),
    "F3: no insult",
  );
}

console.log("G. Wiring");
{
  const prep = code("src/components/kc/game/Preparation.tsx");
  assert(
    /runNews\(/.test(prep) &&
      /nearMiss\(/.test(prep) &&
      /onRunStats\?\.\(\{/.test(prep) &&
      /\.\.\.prideLines/.test(prep),
    "G1: Preparation gathers the plate, adds the news and the near-miss line to the Knife Report, and hands the plate over",
  );
  assert(
    /runMs\.current \+= 250/.test(prep) && /if \(paused \|\| floorMode\) return;/.test(prep),
    "G2: the plate's clock counts unpaused cutting time only",
  );
  const app = code("src/App.tsx");
  assert(
    /pendingRunRef\.current/.test(app) && /applyRun\(next, run\)/.test(app),
    "G3: the finished plate rides along in the very next save (persist), never a second stale save",
  );
  assert(
    /applyService\(nextSave, service\)/.test(app) &&
      /\.\.\.\(shift \? \{ shift \} : \{\}\)/.test(app),
    "G4: a service goes into the record in completeCampaignLevel and onto the Level Complete card",
  );
  assert(
    (app.match(/onRunStats=\{noteRunStats\}/g) ?? []).length === 2 &&
      (app.match(/chefRecord=\{chefRecordOf\(save\)\}/g) ?? []).length === 2,
    "G5: both Preparation mounts get the record and the plate callback",
  );
  const banner = code("src/components/kc/story/MilestoneBanner.tsx");
  assert(/data-testid="banner-stats"/.test(banner), "G6: the banner shows the service tiles");
  assert(
    /chefRecord\?: ChefRecord;/.test(code("src/game/business/businessTypes.ts")),
    "G7: the field is optional under business",
  );
}

console.log(failures === 0 ? "\nCHEF RECORD QA: ALL PASS" : `\nCHEF RECORD QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
