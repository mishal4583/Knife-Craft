/**
 * SKILL CHALLENGES QA (the "Chef Pride" plan, Phase 3b, developer 2026-11-23: "you probably can't do this", optional daily dares).
 *
 *  A  the dares: five, unique, playful short copy, exact unlock levels (Level 6; Zero Waste with spoilage; Clean Freak with dine-in), none before Level 6;
 *  B  the pick: the same dare for the same calendar day, spread over the days, only from what is unlocked;
 *  C  opt-in: a dare is only OFFERED; taking it is a tap, "Not today" hides it; nothing moves until it is taken; a new day starts fresh;
 *  D  No Mercy Prep and Perfect Chef: plates in a row counted from taking it, a weaker plate breaks the run, the win is counted once;
 *  E  Speed Demon: one fair, quick, Clean plate;
 *  F  Clean Freak (a spotless service) and Zero Waste (a day with no spoiled stock) read only their own event and only when taken;
 *  G  the Knife Report line: the win, the run so far, a broken run; nothing when no dare is taken;
 *  H  nothing is paid: badge only (the dares ladder, reward 0), no ledger, the rule file is pure, no new top-level save field, a damaged state is clamped;
 *  I  wiring: the plate, the service and the day close move the dare, the Kitchen row and its buttons, the marker on View Details, the Knife Report line.
 *
 * Run: npx tsx scripts/skill-challenges-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  DARES,
  DARES_FROM_LEVEL,
  advanceDareOnDay,
  advanceDareOnPlate,
  advanceDareOnService,
  dareById,
  dareReportLine,
  dareToday,
  declineDare,
  eligibleDares,
  pickDare,
  takeDare,
} from "../src/game/restaurant/skillChallenges.ts";
import {
  DEFAULT_CHEF_RECORD,
  chefRecordOf,
  clampChefRecord,
  type ChefRecord,
} from "../src/game/restaurant/chefRecord.ts";
import { achievementsFor, collectableTotal } from "../src/game/progression/achievements.ts";
import { restaurantSystem } from "../src/game/restaurant/restaurantProgression.ts";

const zwFrom = restaurantSystem("fridge-freshness").firstLevel;
const cfFrom = restaurantSystem("dine-in").firstLevel;

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(
    `  ${cond ? "ok " : "FAIL"} ${msg}${!cond && detail !== undefined ? ` ${JSON.stringify(detail).slice(0, 300)}` : ""}`,
  );
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const D1 = "2026-11-23";
const D2 = "2026-11-24";
const plate = (score: number, ms = 20000, cuts = 12) => ({ score, cuts, ms });
/** A record that has taken a given dare today (set up by forcing the day's pick). */
function taken(id: string, level = 40, day = D1, progress = 0): ChefRecord {
  return { ...DEFAULT_CHEF_RECORD, challenge: { day, id, state: "accepted", progress } };
}

console.log("A. The dares");
{
  assert(
    DARES.length === 5 && new Set(DARES.map((d) => d.id)).size === 5,
    "A1: five dares, each with its own id",
  );
  assert(
    DARES.every(
      (d) =>
        d.ask.split(/\s+/).length <= 14 && d.say.split(/\s+/).length <= 14 && d.say.length <= 70,
    ),
    "A2: short copy (14 words or fewer)",
  );
  const copy = DARES.flatMap((d) => [d.title, d.ask, d.say]);
  assert(
    copy.every((t) => !/\bonly\s+\d+\s*%|% of (chefs|players)|top\s+\d+\s*%/i.test(t)),
    "A3: no population claim",
  );
  assert(
    copy.every(
      (t) =>
        !/\b(stupid|idiot|loser|pathetic|useless|terrible|worthless|trash|garbage|noob|dumb|you can't|can't cook|fail)\b/i.test(
          t,
        ),
    ),
    "A4: playful, never an insult",
  );
  assert(
    DARES.filter((d) => ["no-mercy", "perfect-chef", "speed-demon"].includes(d.id)).every(
      (d) => d.fromLevel === DARES_FROM_LEVEL,
    ),
    "A5: the three plate dares open at Level 6",
  );
  assert(
    dareById("zero-waste")!.fromLevel === zwFrom && dareById("clean-freak")!.fromLevel === cfFrom,
    "A6: Zero Waste opens with spoilage (the fridge-and-freshness level), Clean Freak with dine-in",
  );
  assert(
    eligibleDares(5).length === 0 && eligibleDares(6).length === 3,
    "A7: nothing before Level 6; three at Level 6",
  );
  assert(
    eligibleDares(zwFrom).length === 4 &&
      eligibleDares(Math.max(zwFrom, cfFrom)).length === 5 &&
      eligibleDares(zwFrom - 1).length === 3,
    "A8: the others join at their systems' levels",
  );
  assert(
    DARES.every((d) => d.goal >= 1),
    "A9: every dare can be won",
  );
}

console.log("B. The pick");
{
  assert(pickDare(D1, 10)?.id === pickDare(D1, 10)?.id, "B1: the same day gives the same dare");
  assert(pickDare(D1, 5) === null, "B2: no dare before Level 6");
  const days = Array.from(
    { length: 90 },
    (_, i) => `2026-12-${String((i % 28) + 1).padStart(2, "0")}-${i}`,
  );
  const seen = new Set(days.map((d) => pickDare(d, 40)!.id));
  assert(seen.size === 5, "B3: over many days every unlocked dare comes up", [...seen]);
  const lvl10 = new Set(days.map((d) => pickDare(d, zwFrom - 1)!.id));
  assert(
    !lvl10.has("zero-waste") && !lvl10.has("clean-freak") && lvl10.size === 3,
    "B4: only what is unlocked is picked (before the spoilage level: the three plate dares)",
    [...lvl10],
  );
  const counts = new Map<string, number>();
  for (const d of days) counts.set(pickDare(d, 40)!.id, (counts.get(pickDare(d, 40)!.id) ?? 0) + 1);
  assert(
    [...counts.values()].every((n) => n >= 6),
    "B5: no dare is starved (a spread, not a streak)",
    [...counts],
  );
}

console.log("C. Opt-in");
{
  const v0 = dareToday(DEFAULT_CHEF_RECORD, D1, 10)!;
  assert(v0.status === "offered" && v0.progress === 0, "C1: a dare is only offered");
  const plain = advanceDareOnPlate(DEFAULT_CHEF_RECORD, D1, 10, plate(99));
  assert(
    plain.rec === DEFAULT_CHEF_RECORD && plain.won === null,
    "C2: an offered dare does not move",
  );
  const t = takeDare(DEFAULT_CHEF_RECORD, D1, 10);
  assert(
    dareToday(t, D1, 10)?.status === "accepted" && dareToday(t, D1, 10)?.dare.id === v0.dare.id,
    "C3: taking it accepts that day's dare",
  );
  assert(takeDare(t, D1, 10) === t, "C4: taking it twice changes nothing");
  const d = declineDare(DEFAULT_CHEF_RECORD, D1, 10);
  assert(dareToday(d, D1, 10)?.status === "declined", "C5: 'Not today' hides it for the day");
  assert(
    takeDare(d, D1, 10) === d && advanceDareOnPlate(d, D1, 10, plate(99)).rec === d,
    "C6: a declined dare stays declined and moves nothing",
  );
  assert(
    dareToday(d, D2, 10)?.status === "offered" && dareToday(t, D2, 10)?.status === "offered",
    "C7: a new day starts fresh (offered again, nothing carried)",
  );
  assert(dareToday(DEFAULT_CHEF_RECORD, D1, 5) === null, "C8: no dare before Level 6");
  assert(
    declineDare(DEFAULT_CHEF_RECORD, D1, 5) === DEFAULT_CHEF_RECORD &&
      takeDare(DEFAULT_CHEF_RECORD, D1, 5) === DEFAULT_CHEF_RECORD,
    "C9: nothing to take or decline before Level 6",
  );
}

console.log("D. Plates in a row");
{
  let r = taken("no-mercy");
  for (let i = 1; i <= 4; i++) {
    const s = advanceDareOnPlate(r, D1, 40, plate(88));
    r = s.rec;
    assert(
      s.won === null && dareToday(r, D1, 40)!.progress === i,
      `D${i}: Clean plate ${i} counts (${i} of 5)`,
    );
  }
  const broken = advanceDareOnPlate(r, D1, 40, plate(80));
  assert(
    dareToday(broken.rec, D1, 40)!.progress === 0 && broken.won === null,
    "D5: a weaker plate breaks the run (back to 0)",
  );
  let w = taken("no-mercy", 40, D1, 4);
  const win = advanceDareOnPlate(w, D1, 40, plate(90));
  assert(
    win.won?.id === "no-mercy" &&
      win.rec.daresWon === 1 &&
      dareToday(win.rec, D1, 40)!.status === "won",
    "D6: the fifth Clean plate wins, once",
  );
  const again = advanceDareOnPlate(win.rec, D1, 40, plate(99));
  assert(again.rec === win.rec && again.won === null, "D7: a won dare does not win twice");
  let p = taken("perfect-chef");
  p = advanceDareOnPlate(p, D1, 40, plate(96)).rec;
  p = advanceDareOnPlate(p, D1, 40, plate(90)).rec; // Clean, not Masterful: breaks it
  assert(dareToday(p, D1, 40)!.progress === 0, "D8: a Clean plate breaks the Masterful run");
  for (let i = 0; i < 2; i++) p = advanceDareOnPlate(p, D1, 40, plate(97)).rec;
  const pw = advanceDareOnPlate(p, D1, 40, plate(95));
  assert(
    pw.won?.id === "perfect-chef" && pw.rec.daresWon === 1,
    "D9: the third Masterful plate wins",
  );
}

console.log("E. Speed Demon");
{
  const r = taken("speed-demon");
  const ok = advanceDareOnPlate(r, D1, 40, plate(90, 25000, 8));
  assert(ok.won?.id === "speed-demon", "E1: a Clean plate of 8 cuts in 25 s wins");
  assert(advanceDareOnPlate(r, D1, 40, plate(90, 31000, 8)).won === null, "E2: 31 s is too slow");
  assert(
    advanceDareOnPlate(r, D1, 40, plate(80, 20000, 8)).won === null,
    "E3: under Clean does not win",
  );
  assert(
    advanceDareOnPlate(r, D1, 40, plate(95, 20000, 5)).won === null,
    "E4: under 6 cuts does not win",
  );
  assert(
    advanceDareOnPlate(r, D1, 40, plate(95, 1500, 8)).won === null &&
      advanceDareOnPlate(r, D1, 40, plate(95, 0, 8)).won === null,
    "E5: an unknown or tiny time never wins",
  );
  const miss = advanceDareOnPlate(r, D1, 40, plate(70, 50000, 8));
  assert(
    miss.rec === r || dareToday(miss.rec, D1, 40)!.status === "accepted",
    "E6: a slow plate leaves it open (still accepted)",
  );
}

console.log("F. Service and day dares");
{
  const cf = taken("clean-freak");
  assert(
    advanceDareOnService(cf, D1, 40, { spotless: true }).won?.id === "clean-freak",
    "F1: a spotless service wins Clean Freak",
  );
  assert(
    advanceDareOnService(cf, D1, 40, { spotless: false }).won === null,
    "F2: a service that was not spotless does not",
  );
  assert(
    advanceDareOnService(taken("no-mercy"), D1, 40, { spotless: true }).won === null,
    "F3: a spotless service does nothing for another dare",
  );
  assert(
    advanceDareOnService(DEFAULT_CHEF_RECORD, D1, 40, { spotless: true }).won === null,
    "F4: nothing when no dare is taken",
  );
  const zw = taken("zero-waste");
  assert(
    advanceDareOnDay(zw, D1, 40, { noWaste: true }).won?.id === "zero-waste",
    "F5: a day with no spoiled stock wins Zero Waste",
  );
  assert(
    advanceDareOnDay(zw, D1, 40, { noWaste: false }).won === null,
    "F6: a day that spoiled stock does not win it (still open today)",
  );
  assert(
    advanceDareOnDay(taken("clean-freak"), D1, 40, { noWaste: true }).won === null,
    "F7: a clean day does nothing for another dare",
  );
  assert(advanceDareOnPlate(zw, D1, 40, plate(99)).rec === zw, "F8: plates do not move a day dare");
  assert(
    advanceDareOnDay(zw, D2, 40, { noWaste: true }).won === null,
    "F9: yesterday's dare is not today's",
  );
}

console.log("G. The Knife Report line");
{
  assert(
    dareReportLine(DEFAULT_CHEF_RECORD, D1, 40, plate(99)) === null,
    "G1: nothing when no dare is taken",
  );
  const r2 = taken("no-mercy", 40, D1, 2);
  assert(
    dareReportLine(r2, D1, 40, plate(90)) === "Dare: 3 of 5 plates in a row",
    "G2: the run so far",
    dareReportLine(r2, D1, 40, plate(90)),
  );
  assert(
    /^Dare: the run ended at 2\. Try again\?$/.test(dareReportLine(r2, D1, 40, plate(60)) ?? ""),
    "G3: a broken run says where it ended",
  );
  assert(
    dareReportLine(taken("no-mercy", 40, D1, 4), D1, 40, plate(90)) === "Dare won: No Mercy Prep!",
    "G4: the win",
  );
  assert(
    dareReportLine(taken("no-mercy", 40, D1, 0), D1, 40, plate(60)) === null,
    "G5: a weak plate at 0 says nothing",
  );
  assert(
    dareReportLine(taken("speed-demon"), D1, 40, plate(90, 20000, 9)) === "Dare won: Speed Demon!",
    "G6: the Speed Demon win",
  );
  assert(
    dareReportLine(taken("speed-demon"), D1, 40, plate(90, 45000, 9)) === null,
    "G7: a slow plate says nothing",
  );
  assert(
    dareReportLine(taken("clean-freak"), D1, 40, plate(99)) === null,
    "G8: a service dare says nothing at a plate",
  );
}

console.log("H. Nothing is paid");
{
  const src = code("src/game/restaurant/skillChallenges.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|Math\.random|Date\.now|new Date|performance\.now|window\.|localStorage|fetch\(/.test(
      src,
    ),
    "H1: no wallet, ledger, clock, random or storage in the rule file",
  );
  const won = achievementsFor({
    ...DEFAULT_SAVE,
    business: { ...DEFAULT_SAVE.business, chefRecord: { ...DEFAULT_CHEF_RECORD, daresWon: 35 } },
  });
  const ladder = won.filter((a) => a.id.startsWith("ach-dares-"));
  assert(
    ladder.length === 4 && ladder.every((a) => a.reward === 0),
    "H2: the dares ladder is four badge tiers, reward 0",
    ladder.map((a) => `${a.id}:${a.reward}`),
  );
  assert(
    ladder.filter((a) => a.reached).length === 3 &&
      ladder.find((a) => a.id === "ach-dares-10")?.title === "Daredevil",
    "H3: 35 dares won earns three tiers (3, 10, 30)",
  );
  assert(
    collectableTotal({
      ...DEFAULT_SAVE,
      business: { ...DEFAULT_SAVE.business, chefRecord: { ...DEFAULT_CHEF_RECORD, daresWon: 100 } },
    }) === collectableTotal(DEFAULT_SAVE),
    "H4: winning dares adds nothing to collect",
  );
  const bad = clampChefRecord({
    challenge: { day: "yesterday", id: "x", state: "accepted", progress: 3 },
  });
  assert(bad.challenge === null, "H5: a damaged challenge state is dropped");
  const huge = clampChefRecord({
    challenge: { day: D1, id: "no-mercy", state: "accepted", progress: 99999 },
  });
  assert(huge.challenge?.progress === 99, "H6: progress is clamped");
  assert(
    chefRecordOf(DEFAULT_SAVE).challenge === null && chefRecordOf(DEFAULT_SAVE).daresWon === 0,
    "H7: an old save has no dare and no wins",
  );
  assert(!/skillChallenges/.test(code("src/game/SaveManager.ts")), "H8: no save field of its own");
  const s: SaveData = {
    ...DEFAULT_SAVE,
    business: { ...DEFAULT_SAVE.business, chefRecord: takeDare(DEFAULT_CHEF_RECORD, D1, 10) },
  };
  assert(
    JSON.stringify(Object.keys(s)) === JSON.stringify(Object.keys(DEFAULT_SAVE)),
    "H9: taking a dare adds no top-level save field",
  );
}

console.log("I. Wiring");
{
  const app = code("src/App.tsx");
  assert(
    /advanceDareOnPlate\(/.test(app) && /pendingRunRef\.current/.test(app),
    "I1: the finished plate moves the dare in the same save as its result",
  );
  assert(
    /advanceDareOnService\(/.test(app) && /Dare won: \$\{t\}/.test(app),
    "I2: a spotless service moves Clean Freak and the card names the dares won",
  );
  assert(
    (app.match(/closeDayDared\(/g) ?? []).length >= 3,
    "I3: both day-close sites go through closeDayDared (Zero Waste)",
    (app.match(/closeDayDared\(/g) ?? []).length,
  );
  assert(
    /onDare=\{handleDare\}/.test(app) &&
      /sendAnalyticsEvent\("dare_taken"/.test(app) &&
      /sendAnalyticsEvent\("dare_completed"/.test(app),
    "I4: the buttons are wired and measured",
  );
  assert(
    (app.match(/dareLine=\{dareLineFor\}/g) ?? []).length === 2,
    "I5: both Preparation mounts get the Knife Report line",
  );
  const kit = code("src/components/kc/Kitchen.tsx");
  assert(
    /data-testid="kitchen-dare"/.test(kit) &&
      /data-testid="kitchen-dare-take"/.test(kit) &&
      /data-testid="kitchen-dare-decline"/.test(kit),
    "I6: the dare row has its two buttons",
  );
  assert(
    /dareOffered && !orderCardExpanded \? "⚔ " : ""/.test(kit),
    "I7: View Details carries a marker while the dare is offered",
  );
  assert(
    /onDare\?: \(action: "take" \| "decline"\) => void/.test(kit) &&
      /\{\.\.\.\(onDare \? \{ onDare \} : \{\}\)\}/.test(code("src/ScreensRouter.tsx")),
    "I8: the router passes it to the Kitchen",
  );
  const prep = code("src/components/kc/game/Preparation.tsx");
  assert(
    /dareLine\?\.\(/.test(prep) && /id: "pride-dare"/.test(prep),
    "I9: the Knife Report shows the dare line",
  );
}

console.log(
  failures === 0 ? "\nSKILL CHALLENGES QA: ALL PASS" : `\nSKILL CHALLENGES QA: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
