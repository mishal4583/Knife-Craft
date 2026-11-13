/**
 * HEALTH INSPECTOR QA (developer 2026-11-13: "the inspection is not built, plan for that, build it"). restaurant/healthInspector.ts; plan:
 * docs/planning/HEALTH-INSPECTOR-PLAN-2026-11-13.md.
 *
 *  A  When he comes: never before Level 13; due at 13 on a new game and at the next level of an old save; never on a replay; after a visit
 *     the level shows its result and he stays away 6 / 4 / 2 levels by grade.
 *  B  What he sees: the restaurant as it is (open cleaning tasks without the morning's setup, expired food, an overfull fridge, dish soap,
 *     cleaning liquid); fixing something changes its row; a failed check is a C, a warning a B, a clean sheet an A.
 *  C  What it does: Grade A pays Hype (20 / 30 / 40 in a row, no money); B nothing; C a fine of 5 % of the level's pay in whole dollars as
 *     ONE "inspection-fine" entry, all or nothing, never below $0; the cash identity holds.
 *  D  Saves: no state = he has not come; odd state is clamped; the state survives a JSON round trip.
 *  E  The campaign: simulated players meet him, are never blocked, and the completionist still ends above $150k.
 *  W  Wiring: the check blocks START while he is at the door, App runs the visit on the latest save, the rule file is pure.
 *
 * Run: npx tsx scripts/health-inspector-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { DEFAULT_CLEANLINESS, TASK_RULES, TASK_KINDS } from "../src/game/restaurant/cleanliness.ts";
import { secondFloorOf } from "../src/game/restaurant/secondFloor.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import {
  CLEANING_FAIL_TASKS,
  DEFAULT_HEALTH_INSPECTOR,
  GRADE_A_HYPE,
  GRADE_A_HYPE_MAX,
  GRADE_C_FINE_SHARE,
  HEALTH_INSPECTOR_FROM_LEVEL,
  VISIT_GAP,
  gradeAHype,
  gradeCFine,
  gradeFor,
  healthInspectorOf,
  inspectorAt,
  inspectorRows,
  runInspectorVisit,
} from "../src/game/restaurant/healthInspector.ts";
import { freshRestaurantSave, run } from "./restaurantCampaignSim.mts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const progressAt = (n: number) => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const L = (n: number) => getLevel(`level-${n}`)!;
const STOCKED = {
  "dish-soap": { units: 2, costBasis: 0 },
  "cleaning-liquid": { units: 2, costBasis: 0 },
};
/** A spotless restaurant at level `n`: nothing to clean, an empty fridge, soap and cleaning liquid in stock. */
const cleanAt = (n: number, credits = 500_000): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  levelProgress: progressAt(n),
  business: {
    ...DEFAULT_SAVE.business,
    inventory: {},
    cleanliness: { ...DEFAULT_CLEANLINESS },
    supplies: { ...DEFAULT_SAVE.business.supplies, stock: { ...STOCKED } },
  },
});
const lasting = TASK_KINDS.filter((k) => !TASK_RULES[k].phase);
const setup = TASK_KINDS.filter((k) => !!TASK_RULES[k].phase);
const withTasks = (s: SaveData, kinds: readonly string[]): SaveData => ({
  ...s,
  business: {
    ...s.business,
    cleanliness: {
      ...DEFAULT_CLEANLINESS,
      tasks: kinds.map((kind) => ({ kind: kind as never, count: 1, since: 0 })),
    },
  },
});
const withoutSupply = (s: SaveData, id: string): SaveData => {
  const stock = { ...s.business.supplies.stock } as Record<string, unknown>;
  delete stock[id];
  return {
    ...s,
    business: { ...s.business, supplies: { ...s.business.supplies, stock: stock as never } },
  };
};
/** Tomatoes bought long ago: expired today. */
const withExpired = (s: SaveData): SaveData => ({
  ...s,
  business: {
    ...s.business,
    calendar: { ...s.business.calendar, businessDay: 400 },
    inventory: addStock(s.business.inventory, "tomato" as never, 2, 100, 1),
  },
});
const verdictOf = (s: SaveData, id: string) => inspectorRows(s).find((r) => r.id === id)!.verdict;
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

console.log("A. When he comes");
{
  const F = HEALTH_INSPECTOR_FROM_LEVEL;
  assert(
    F === 13 && inspectorAt(cleanAt(F - 1), L(F - 1), F - 1) === null,
    "A1: never before Level 13",
  );
  const first = inspectorAt(cleanAt(F), L(F), F);
  assert(
    first?.status === "due" && first.grade === "A" && first.rows.length === 5,
    "A2: a new game meets him at Level 13: five checks, a spotless restaurant would get an A",
  );
  const old = inspectorAt(cleanAt(50), L(50), 50);
  assert(
    old?.status === "due" && healthInspectorOf(cleanAt(50)).nextLevel === F,
    "A3: an old save (no inspector state) meets him at its next level",
  );
  const replay: SaveData = {
    ...cleanAt(30),
    levelProgress: { ...progressAt(30), completedLevelIds: [...progressAt(30).completedLevelIds] },
  };
  assert(
    servicePlanFor(replay, L(20)) === null &&
      servicePlanFor(replay, L(30))?.inspector?.status === "due",
    "A4: a replay has no check (so no visit); the level being played for the first time has him at the door",
  );
  const visited = runInspectorVisit(cleanAt(F), L(F), F)!;
  const same = inspectorAt(visited.save, L(F), F);
  assert(
    same?.status === "done" &&
      same.visit.grade === "A" &&
      same.backIn === VISIT_GAP.A &&
      runInspectorVisit(visited.save, L(F), F) === null,
    "A5: after the visit the level shows its result; he cannot be let in twice",
  );
  const at = (n: number) =>
    inspectorAt({ ...visited.save, levelProgress: progressAt(n) }, L(n), n)?.status ?? null;
  assert(
    VISIT_GAP.A === 6 &&
      VISIT_GAP.B === 4 &&
      VISIT_GAP.C === 2 &&
      at(F + 1) === null &&
      at(F + 5) === null &&
      at(F + 6) === "due",
    "A6: after a Grade A he stays away 6 levels (B: 4, C: 2)",
  );
  const b = runInspectorVisit(withoutSupply(cleanAt(F), "dish-soap"), L(F), F)!;
  const c = runInspectorVisit(withExpired(cleanAt(F)), L(F), F)!;
  assert(
    healthInspectorOf(b.save).nextLevel === F + 4 && healthInspectorOf(c.save).nextLevel === F + 2,
    "A7: a Grade B brings him back in 4 levels, a Grade C in 2",
  );
}

console.log("B. What he sees");
{
  const s = cleanAt(20);
  assert(
    inspectorRows(s).every((r) => r.verdict === "PASS") && gradeFor(inspectorRows(s)) === "A",
    "B1: a spotless restaurant passes all five checks: Grade A",
  );
  assert(
    lasting.length >= CLEANING_FAIL_TASKS &&
      verdictOf(withTasks(s, lasting.slice(0, 1)), "cleaning") === "WARNING" &&
      verdictOf(withTasks(s, lasting.slice(0, CLEANING_FAIL_TASKS - 1)), "cleaning") ===
        "WARNING" &&
      verdictOf(withTasks(s, lasting.slice(0, CLEANING_FAIL_TASKS)), "cleaning") === "FAIL",
    "B2: one or two cleaning tasks left open are a warning, three or more fail the check",
  );
  assert(
    setup.length > 0 && verdictOf(withTasks(s, setup), "cleaning") === "PASS",
    "B3: the morning's own setup chores are not held against the restaurant (today's work, not yesterday's dirt)",
  );
  assert(
    verdictOf(withExpired(s), "expired") === "FAIL" &&
      gradeFor(inspectorRows(withExpired(s))) === "C",
    "B4: expired food in the fridge fails the check: Grade C",
  );
  const stuffed = (q: number): SaveData => ({
    ...s,
    business: {
      ...s.business,
      inventory: addStock({}, "watermelon" as never, q, 100, s.business.calendar.businessDay),
    },
  });
  assert(
    verdictOf(stuffed(37), "fridge-room") === "PASS" &&
      verdictOf(stuffed(38), "fridge-room") === "WARNING" &&
      gradeFor(inspectorRows(stuffed(40))) === "B",
    "B5: a fridge at 95 % or more (38 of 40) is a warning, never a fail (only a bigger fridge or cooking makes room)",
  );
  assert(
    verdictOf(withoutSupply(s, "dish-soap"), "dish-soap") === "WARNING" &&
      verdictOf(withoutSupply(s, "cleaning-liquid"), "cleaning-liquid") === "WARNING" &&
      gradeFor(inspectorRows(withoutSupply(withoutSupply(s, "dish-soap"), "cleaning-liquid"))) ===
        "B",
    "B6: no dish soap or no cleaning liquid is a warning each: Grade B",
  );
  const dirty = withTasks(withExpired(s), lasting.slice(0, CLEANING_FAIL_TASKS));
  const fixed = {
    ...dirty,
    business: { ...dirty.business, inventory: {}, cleanliness: DEFAULT_CLEANLINESS },
  };
  assert(
    inspectorAt(dirty, L(20), 20)?.status === "due" &&
      (inspectorAt(dirty, L(20), 20) as { grade: string }).grade === "C" &&
      (inspectorAt(fixed, L(20), 20) as { grade: string }).grade === "A",
    "B7: the card is live: cleaning and throwing out the expired food before letting him in turns a C into an A",
  );
}

console.log("C. What it does");
{
  const n = 20;
  const a1 = runInspectorVisit(cleanAt(n), L(n), n)!;
  assert(
    a1.visit.grade === "A" &&
      a1.visit.hype === GRADE_A_HYPE &&
      secondFloorOf(a1.save).hype === GRADE_A_HYPE &&
      a1.save.credits === cleanAt(n).credits &&
      a1.save.economyLedger.length === cleanAt(n).economyLedger.length &&
      healthInspectorOf(a1.save).streak === 1,
    "C1: Grade A adds 20 Hype for the Second Floor: no money, no ledger entry",
  );
  const again = (s: SaveData, level: number) =>
    runInspectorVisit({ ...s, levelProgress: progressAt(level) }, L(level), level)!;
  const a2 = again(a1.save, n + 6);
  const a3 = again(a2.save, n + 12);
  const a4 = again(
    { ...a3.save, business: { ...a3.save.business, secondFloor: undefined } },
    n + 18,
  );
  assert(
    gradeAHype(1) === 20 &&
      gradeAHype(2) === 30 &&
      gradeAHype(3) === GRADE_A_HYPE_MAX &&
      gradeAHype(9) === GRADE_A_HYPE_MAX &&
      a2.visit.hype === 30 &&
      a3.visit.hype === 40 &&
      a4.visit.hype === 40 &&
      healthInspectorOf(a4.save).streak === 4,
    "C2: A grades in a row pay 20, 30, then 40 Hype (the cap)",
    [a2.visit.hype, a3.visit.hype, a4.visit.hype],
  );
  const full = again(
    {
      ...a3.save,
      business: {
        ...a3.save.business,
        secondFloor: { ...a3.save.business.secondFloor!, hype: 100 } as never,
      },
    },
    n + 18,
  );
  assert(
    full.visit.grade === "A" && full.visit.hype === 0 && secondFloorOf(full.save).hype === 100,
    "C3: a full Hype meter stays full, and the card says what was really added",
  );
  const b = again(withoutSupply(a1.save, "dish-soap"), n + 6);
  assert(
    b.visit.grade === "B" &&
      b.visit.fine === 0 &&
      b.visit.hype === 0 &&
      b.save.credits === a1.save.credits &&
      healthInspectorOf(b.save).streak === 0,
    "C4: Grade B moves nothing (no fine, no Hype) and ends the A streak",
  );
  const fine = gradeCFine(L(n));
  const dirty = withExpired(cleanAt(n, 80_000));
  const c = runInspectorVisit(dirty, L(n), n)!;
  const entries = c.save.economyLedger.slice(dirty.economyLedger.length);
  assert(
    fine > 0 &&
      fine % 100 === 0 &&
      fine === Math.floor((paidLevelReward(L(n)) * GRADE_C_FINE_SHARE) / 100) * 100 &&
      c.visit.grade === "C" &&
      c.visit.fine === fine &&
      c.save.credits === dirty.credits - fine &&
      entries.length === 1 &&
      entries[0]!.category === "inspection-fine" &&
      entries[0]!.amount === -fine &&
      dirty.credits + (ledgerSum(c.save) - ledgerSum(dirty)) === c.save.credits,
    `C5: Grade C costs 5 % of the level's pay in whole dollars ($${fine / 100} at Level ${n}): ONE "inspection-fine" entry, cash = opening + ledger`,
    { fine, entries },
  );
  const poor = withExpired(cleanAt(n, fine - 1));
  const cp = runInspectorVisit(poor, L(n), n)!;
  assert(
    cp.visit.grade === "C" &&
      cp.visit.fine === 0 &&
      cp.save.credits === poor.credits &&
      cp.save.economyLedger.length === poor.economyLedger.length &&
      (inspectorAt(poor, L(n), n) as { fine: number }).fine === 0,
    "C6: a wallet that cannot pay the fine pays nothing (all or nothing, never below $0, no entry); the card says so before he is let in",
  );
  let worst = 0;
  for (let k = HEALTH_INSPECTOR_FROM_LEVEL; k <= 91; k++)
    worst = Math.max(worst, gradeCFine(L(k)) / paidLevelReward(L(k)));
  assert(
    worst <= GRADE_C_FINE_SHARE && worst > 0,
    "C7: at every level from 13 to 91 the fine is at most 5 % of that level's pay",
    { worst },
  );
}

console.log("D. Saves");
{
  const none = { ...cleanAt(20) };
  assert(
    none.business.healthInspector === undefined &&
      healthInspectorOf(none) === DEFAULT_HEALTH_INSPECTOR &&
      DEFAULT_HEALTH_INSPECTOR.nextLevel === HEALTH_INSPECTOR_FROM_LEVEL,
    "D1: a save with no inspector state reads as 'he has not come yet' (no migration needed)",
  );
  const odd = {
    ...none,
    business: {
      ...none.business,
      healthInspector: {
        nextLevel: -5,
        streak: "x",
        visits: 2.9,
        last: { level: 14, grade: "Z", rows: "no" },
      } as never,
    },
  };
  const o = healthInspectorOf(odd);
  assert(
    o.nextLevel === HEALTH_INSPECTOR_FROM_LEVEL &&
      o.streak === 0 &&
      o.visits === 2 &&
      o.last === null,
    "D2: an odd state is clamped (never a level before 13, whole counts, an unknown grade is dropped)",
    o,
  );
  const visited = runInspectorVisit(withExpired(cleanAt(20)), L(20), 20)!.save;
  const back = JSON.parse(JSON.stringify(visited)) as SaveData;
  assert(
    JSON.stringify(healthInspectorOf(back)) === JSON.stringify(healthInspectorOf(visited)) &&
      inspectorAt(back, L(20), 20)?.status === "done",
    "D3: the state survives a JSON round trip (the save file)",
  );
}

console.log("E. The campaign (simulated players)");
{
  for (const profile of ["diligent", "completionist"] as const) {
    const r = run(profile, freshRestaurantSave(), 1, { profile } as never, false);
    const first = r.stats.inspections[0] ?? "";
    assert(
      r.stats.levels === 91 &&
        r.stats.blocked.length === 0 &&
        r.stats.invariant.length === 0 &&
        first.startsWith(`L${HEALTH_INSPECTOR_FROM_LEVEL}:`) &&
        r.stats.inspections.length >= 13 &&
        r.s.credits >= 15_000_000 &&
        r.stats.inspectionFines < 500_000,
      `E (${profile}): meets him ${r.stats.inspections.length} times from Level 13, never blocked, wallet identity holds, fines $${r.stats.inspectionFines / 100} in all, ends with $${Math.round(r.s.credits / 100)}`,
      {
        inspections: r.stats.inspections,
        blocked: r.stats.blocked,
        invariant: r.stats.invariant.slice(0, 2),
      },
    );
  }
}

console.log("W. Wiring");
{
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const rule = code(read("src/game/restaurant/healthInspector.ts"));
  const app = read("src/App.tsx");
  const sheet = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const card = read("src/components/kc/restaurant/HealthInspectorCard.tsx");
  assert(
    !/Math\.random|RESTAURANT_MODE|window\.|localStorage|setTimeout|Date\.now|new Date/.test(rule),
    "W1: the rule file is pure and deterministic (no Math.random, clock, RESTAURANT_MODE, window, storage or timers)",
  );
  const due = servicePlanFor(cleanAt(13), L(13))!;
  const done = servicePlanFor(runInspectorVisit(cleanAt(13), L(13), 13)!.save, L(13))!;
  assert(
    due.inspector?.status === "due" &&
      servicePlanNeedsSheet(due) &&
      done.inspector?.status === "done" &&
      sheet.includes('inspector?.status !== "due"') &&
      sheet.includes("<HealthInspectorCard"),
    "W2: while he is at the door the check shows and START waits; after the visit it does not",
  );
  const fn = app.slice(
    app.indexOf("function letInspectorIn"),
    app.indexOf("function fridgeNeedNow"),
  );
  assert(
    fn.includes("saveRef.current") &&
      fn.includes("runInspectorVisit(latest, level") &&
      fn.includes('sendAnalyticsEvent("health_inspection"') &&
      !/requestRewardedAd|credits/.test(fn),
    "W3: App runs the visit on the latest save through the rule (no money moved in App, no ad), and sends one analytics event",
  );
  assert(
    card.includes('data-testid="psc-inspector-let-in"') &&
      card.includes("min-h-12") &&
      !/Level \$\{|level \$\{/.test(card),
    "W4: the card has a 48 px 'Let him in' button and names no level in its copy",
  );
}

console.log(
  failures ? `HEALTH INSPECTOR QA: ${failures} FAILURE(S)` : "HEALTH INSPECTOR QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
