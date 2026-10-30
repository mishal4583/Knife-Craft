/**
 * SHIFT CHORES QA (a real restaurant's day, developer 2026-10-11 — plan F2).
 * restaurant/cleanliness.ts (phase chores), preServiceCheck.ts, App wiring.
 *
 *  T  Timing: after a service that isn't the day's last → the lull's chores;
 *     after the last → closing's; closing for the night → the next morning's
 *     opening chores. Nothing before L21 (the day's ceremony).
 *  O  Once: each (day, phase, service) batch is added once — re-applying it
 *     (a reload, a repeated opening, a second tap) adds nothing.
 *  D  Do it: each chore uses its supplies exactly once; a chore done is
 *     gone; the phase action (setup only) does just that phase's chores. The
 *     checklist has no "Do all" button (developer 2026-10-17).
 *  S  Staff: the Cleaner (assigned areas), the Server (dining-room chores,
 *     not cleaning ones) and the Prep Cook (the line's) do their own.
 *  P  Spotless: a chore still open when the next service starts breaks it;
 *     done first → spotless (rule unchanged otherwise). Nothing blocks.
 *  C  The Pre-Service Check opens for the opening / lull chores.
 *  W  Wiring: App + the sim; no Math.random.
 *
 * Run: npx tsx scripts/restaurant-shift-chores-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";
import { supplyUnits } from "../src/game/business/BusinessSuppliesManager.ts";
import {
  PHASE_CHORES_FROM,
  TASK_RULES,
  addPhaseChores,
  applyCleanlinessAction,
  choresAfterClose,
  choresAfterService,
  cleanerRound,
  cleanlinessOf,
  phaseChecklist,
  phaseChores,
  snapshotServiceStart,
  usesAvailable,
} from "../src/game/restaurant/cleanliness.ts";
import {
  closeDay,
  openDay,
  recordService,
  restaurantDayOf,
} from "../src/game/restaurant/restaurantDay.ts";
import { closeServiceReport } from "../src/game/restaurant/serviceReport.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";

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
const FULL: Partial<Record<SupplyId, number>> = {
  "mop-bucket": 1,
  brooms: 1,
  "toilet-brushes": 1,
  "floor-cleaner": 2,
  disinfectant: 4,
  "paper-towels": 1000,
  "sponges-cloths": 4,
  "bin-liners": 30,
  "cleaning-liquid": 2,
};
const saveAt = (n: number, hired: string[] = [], stock = FULL): SaveData => ({
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
    staff: { hiredRoles: hired as never },
    supplies: {
      ...DEFAULT_SAVE.business.supplies,
      stock: Object.fromEntries(
        Object.entries(stock).map(([id, units]) => [id, { units, costBasis: units * 100 }]),
      ),
    },
  },
});
import { remapCampaignThreshold } from "../src/game/levels/campaignSelection.ts";
const kinds = (s: SaveData, phase: "opening" | "lull" | "closing") =>
  phaseChecklist(s, phase)
    .map((t) => t.kind)
    .sort()
    .join();

console.log("T. Timing");
{
  // 150-level campaign: a 3-service day at L30 (from L40 a day has 4 services).
  let s = openDay(saveAt(30), 30);
  s = choresAfterService(recordService(s, 30), 30);
  const lull = kinds(s, "lull");
  s = choresAfterService(recordService(s, 31), 31);
  s = choresAfterService(recordService(s, 32), 32);
  const closing = kinds(s, "closing");
  const closed = choresAfterClose(closeDay(s, 33), 33).save;
  const opening = kinds(closed, "opening");
  assert(
    lull === "restroom-refresh,sanitizer-bucket,sweep-line" &&
      // Developer 2026-10-24: the night chores are Cleanliness tasks too (the boards, the spoiled
      // food, the fridge wrap, the dining reset — were Closing Time's own taps).
      closing ===
        "clear-tables,condiments,degrease,mop-all,polish-cutlery,restroom-disinfect,spoiled-out,wipe-boards,wrap-fridge" &&
      opening === "lay-tables,restroom-check,stations",
    "T1: after a service the lull's chores, after the last the closing chores, closing for the night brings the morning's",
    { lull, closing, opening },
  );
  assert(
    phaseChores("lull", PHASE_CHORES_FROM - 1).length === 0 &&
      PHASE_CHORES_FROM === 5 &&
      // Table chores start with dine-in (old L31, now L19 after the two opening levels went).
      !phaseChores("opening", remapCampaignThreshold(31) - 1).includes("lay-tables") &&
      phaseChores("opening", remapCampaignThreshold(31)).includes("lay-tables"),
    "T2: nothing before L5 (developer 2026-10-29; was L16, old L21); table chores from dine-in (old L31)",
  );
}

console.log("O. Once per day and phase");
{
  const d = recordService(openDay(saveAt(40), 40), 40);
  const once = choresAfterService(d, 40);
  const twice = choresAfterService(once, 40);
  const closed = closeDay(choresAfterService(recordService(recordService(once, 41), 42), 42), 43);
  const morning = choresAfterClose(closed, 43).save;
  const again = choresAfterClose(morning, 43).save;
  const cleanedMorning = applyCleanlinessAction(morning, {
    kind: "phase-all",
    phase: "opening",
  }).save;
  const reopened = choresAfterClose(cleanedMorning, 43).save;
  assert(
    twice === once &&
      cleanlinessOf(again).tasks.length === cleanlinessOf(morning).tasks.length &&
      phaseChecklist(reopened, "opening").length === 0 &&
      addPhaseChores(cleanedMorning, "opening", 43, restaurantDayOf(cleanedMorning).day, 0) ===
        cleanedMorning,
    "O1: a batch is added once — repeating it (reload, second opening) adds nothing, and chores already done never come back that day",
  );
}

console.log("D. Do it");
{
  const s = choresAfterService(recordService(openDay(saveAt(40), 40), 40), 40);
  const before = usesAvailable(s, "disinfectant");
  const one = applyCleanlinessAction(s, { kind: "clean", task: "sanitizer-bucket" });
  const two = applyCleanlinessAction(one.save, { kind: "clean", task: "sanitizer-bucket" });
  const all = applyCleanlinessAction(one.save, { kind: "phase-all", phase: "lull" });
  assert(
    one.cleaned.join() === "sanitizer-bucket" &&
      usesAvailable(one.save, "disinfectant") === before - 1 &&
      two.cleaned.length === 0 &&
      usesAvailable(two.save, "disinfectant") === before - 1 &&
      phaseChecklist(all.save, "lull").length === 0 &&
      all.cleaned.sort().join() === "restroom-refresh,sweep-line" &&
      all.save.credits === s.credits &&
      all.save.economyLedger.length === s.economyLedger.length,
    "D1: a chore uses its supplies once (a second tap does nothing); the phase action does the phase's chores; no money",
  );
  const view = fs.readFileSync(
    path.join(import.meta.dirname, "../src/components/kc/restaurant/ShiftChecklist.tsx"),
    "utf8",
  );
  assert(
    !/Do all/.test(view.replace(/\/\*[\s\S]*?\*\//g, "")) &&
      !/"phase-all"/.test(view) &&
      /Do it/.test(view),
    'D2: the checklist offers "Do it" per chore and no "Do all" button (developer 2026-10-17)',
  );
}

console.log("S. Staff");
{
  const base = (hired: string[]) =>
    choresAfterService(
      choresAfterService(
        recordService(recordService(recordService(openDay(saveAt(30, hired), 30), 30), 31), 32),
        32,
      ),
      32,
    );
  const closingWith = (hired: string[]) => kinds(cleanerRound(base(hired)).save, "closing");
  assert(
    // Developer 2026-10-24: with the night chores added (the Server resets the dining room,
    // the Prep Cook throws out and wraps, the Cleaner wipes the boards).
    closingWith([]) ===
      "clear-tables,condiments,degrease,mop-all,polish-cutlery,restroom-disinfect,spoiled-out,wipe-boards,wrap-fridge" &&
      closingWith(["server"]) ===
        "degrease,mop-all,restroom-disinfect,spoiled-out,wipe-boards,wrap-fridge" &&
      closingWith(["cleaner"]) ===
        "clear-tables,condiments,polish-cutlery,spoiled-out,wrap-fridge" &&
      closingWith(["cleaner", "server"]) === "spoiled-out,wrap-fridge" &&
      closingWith(["cleaner", "server", "prep-cook"]) === "" &&
      TASK_RULES.stations.staff === "prep-cook",
    "S1: the Server does the dining room's chores, the Cleaner the cleaning, the Prep Cook the line's; nobody hired = all the player's",
  );
}

console.log("P. Spotless");
{
  const s = choresAfterService(recordService(openDay(saveAt(40), 40), 40), 40);
  const dirty = closeServiceReport(snapshotServiceStart(s, 41), 41, false).report;
  const done = applyCleanlinessAction(s, { kind: "phase-all", phase: "lull" }).save;
  const clean = closeServiceReport(snapshotServiceStart(done, 41), 41, false).report;
  assert(
    dirty.spotless === false && (dirty.hygiene?.openTasks ?? 0) === 3 && clean.spotless === true,
    "P1: the lull's chores left undone break the spotless streak; done first, the service is spotless",
  );
}

console.log("C. The Pre-Service Check");
{
  const s = choresAfterService(recordService(openDay(saveAt(40), 40), 40), 40);
  const plan = servicePlanFor(s, getLevel("level-41")!);
  const done = applyCleanlinessAction(s, { kind: "phase-all", phase: "lull" }).save;
  const planDone = servicePlanFor(done, getLevel("level-41")!);
  assert(
    plan?.chores === 3 && servicePlanNeedsSheet(plan) && planDone?.chores === 0,
    "C1: the lull's chores open the check (never blocking); done, the count is 0",
    { chores: plan?.chores, done: planDone?.chores },
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  const closing = read("src/components/kc/restaurant/ClosingTime.tsx");
  assert(
    /choresAfterService\(nextSave, levelNumber\(level\.id\)\)/.test(app) &&
      (app.match(/choresAfterClose\(/g) ?? []).length >= 2 &&
      /choresAfterService\(next, n\)/.test(sim) &&
      /choresAfterClose\(/.test(sim) &&
      /<ShiftChecklist[\s\S]{0,80}phase=\{plan\.opening \? "opening" : "lull"\}/.test(layer) &&
      // Closing Time lists tonight's Cleanliness tasks itself (developer 2026-10-24).
      /closingRows\(save, restaurantLevel\)/.test(closing) &&
      !/Math\.random/.test(read("src/game/restaurant/cleanliness.ts")),
    "W1: App and the sim add the chores after services and closing; the check shows opening/lull, Closing Time closing; no randomness",
  );
}
void supplyUnits;

console.log(failures ? `\nSHIFT CHORES QA: ${failures} FAILURE(S)` : "\nSHIFT CHORES QA: ALL PASS");
process.exit(failures ? 1 : 0);
