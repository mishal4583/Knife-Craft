/**
 * PAR AUDIT & DEEP CLEAN QA (a real restaurant's day, plan F4 — developer
 * 2026-10-11: "monthly … par levels, e.g. 2.5 sets of cutlery per dining
 * seat"; "weekly / monthly deep cleans … an additional task only on
 * designated deep-clean days, with no duplicate cleaning consumption").
 * restaurant/parAudit.ts, restaurant/cleanliness.ts (deep cleans),
 * restaurant/dayClock.ts, ParAuditCard.
 *
 *  A  The par audit: every AUDIT_EVERY (14) restaurant days from AUDIT_FROM;
 *     tableware par = ceil(2.5 × seats); counted from what is owned (broken
 *     pieces have left the stock); the tools rows are the menu's tool check;
 *     read-only (the save is unchanged, no randomness).
 *  D  Deep cleans: extra closing tasks only on their days (the weekly one on
 *     the week's last day, the dining one on the audit day), never replacing
 *     a daily chore; added once per day; their supplies used once; the
 *     Cleaner does them in their areas.
 *  S  The day strip marks the audit and the deep clean.
 *  W  Wiring: the opening card shows the audit with Buy → the Market.
 *
 * Run: npx tsx scripts/restaurant-par-audit-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";
import { supplyUnits } from "../src/game/business/BusinessSuppliesManager.ts";
import {
  AUDIT_EVERY,
  AUDIT_FROM,
  PAR_PER_SEAT,
  isAuditDay,
  parAudit,
  parAuditFor,
} from "../src/game/restaurant/parAudit.ts";
import {
  DEEP_CLEAN_EVERY,
  TASK_RULES,
  addPhaseChores,
  cleanTask,
  cleanerRound,
  cleanlinessOf,
  deepCleansFor,
  phaseChores,
  usesAvailable,
} from "../src/game/restaurant/cleanliness.ts";
import { dayClockFor, dayStripText } from "../src/game/restaurant/dayClock.ts";
import { levelRecipesAt, toolsCheck } from "../src/game/restaurant/kitchenTools.ts";

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
const CLEANING: Partial<Record<SupplyId, number>> = {
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
const saveAt = (
  n: number,
  day: number,
  stock: Partial<Record<SupplyId, number>> = CLEANING,
  hired: string[] = [],
): SaveData => ({
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
    restaurantDay: {
      day,
      opened: false,
      servicesDone: 0,
      servicesPlanned: 0,
      closingDue: false,
      openingCredits: null,
      openingLevel: null,
    },
  },
});

console.log("A. The par audit");
{
  assert(
    AUDIT_EVERY === 14 &&
      isAuditDay(14) &&
      isAuditDay(28) &&
      !isAuditDay(13) &&
      !isAuditDay(0) &&
      parAuditFor(saveAt(AUDIT_FROM - 1, 14), AUDIT_FROM - 1) === null &&
      parAuditFor(saveAt(41, 13), 41) === null &&
      parAuditFor(saveAt(41, 14), 41) !== null,
    "A1: an audit every 14 restaurant days (Day 14, 28 …), from Level 31; none on other days",
  );
  const s = saveAt(41, 14, { ...CLEANING, "dinner-forks": 3, "dinner-plates": 40 });
  const a = parAuditFor(s, 41)!;
  const forks = a.tableware.find((r) => r.id === "dinner-forks");
  const plates = a.tableware.find((r) => r.id === "dinner-plates");
  const par = Math.ceil(PAR_PER_SEAT * a.seats);
  assert(
    !!forks &&
      !!plates &&
      forks.par === par &&
      forks.have === 3 &&
      forks.short === par - 3 &&
      plates.have === 40 &&
      plates.short === Math.max(0, par - 40) &&
      a.short === [...a.tableware, ...a.tools].reduce((n, r) => n + r.short, 0),
    "A2: the place setting's par is ceil(2.5 × seats); short = par − owned, never below 0",
    { seats: a.seats, par, forks, plates },
  );
  // Broken pieces leave the stock (breakage takes them out of supplies), so the audit counts
  // only what's still there: fewer owned forks = more short.
  const broken = saveAt(41, 14, { ...CLEANING, "dinner-forks": 1, "dinner-plates": 40 });
  const b = parAuditFor(broken, 41)!;
  assert(
    b.tableware.find((r) => r.id === "dinner-forks")!.have ===
      supplyUnits(broken.business.supplies, "dinner-forks") &&
      b.tableware.find((r) => r.id === "dinner-forks")!.short === forks!.short + 2,
    "A3: counted from what's actually owned (broken pieces have left the stock)",
  );
  const kit = toolsCheck(s, 41, levelRecipesAt(41));
  assert(
    kit.applies &&
      a.tools.length === kit.rows.length &&
      a.tools.every((r, i) => r.id === kit.rows[i]!.id && r.par === kit.rows[i]!.need),
    "A4: the tools rows are the menu's own tool check (what today's dishes need)",
  );
  const before = JSON.stringify(s);
  parAudit(s, 41);
  parAuditFor(s, 41);
  assert(
    JSON.stringify(s) === before &&
      !/Math\.random/.test(read("src/game/restaurant/parAudit.ts")) &&
      !/persist|onChange|setSave/.test(read("src/components/kc/restaurant/ParAuditCard.tsx")),
    "A5: read-only — the save is unchanged, no randomness; the card only links to the Market",
  );
}

console.log("D. Deep cleans");
{
  const deepKinds = Object.keys(TASK_RULES).filter(
    (k) => !!TASK_RULES[k as keyof typeof TASK_RULES].deep,
  );
  assert(
    DEEP_CLEAN_EVERY === 7 &&
      // 150-level remap (2026-10-15): from dine-in, L21 (AUDIT_FROM; was L31).
      AUDIT_FROM === 21 &&
      deepCleansFor(13, 41).length === 0 &&
      deepCleansFor(7, 41).join() === "deep-kitchen,deep-restroom" &&
      deepCleansFor(14, 41).join() === "deep-kitchen,deep-restroom,deep-dining" &&
      deepCleansFor(14, AUDIT_FROM - 1).length === 0 &&
      deepCleansFor(14, AUDIT_FROM).join() === "deep-kitchen,deep-restroom,deep-dining" &&
      phaseChores("closing", 41).every((k) => !deepKinds.includes(k)),
    "D1: deep cleans only on their days — the weekly one on Day 7, 14 …, the dining one on the audit day; from L21 (with the audit)",
    { d7: deepCleansFor(7, 41), d14: deepCleansFor(14, 41) },
  );
  const daily = phaseChores("closing", 41, 13);
  const deepDay = phaseChores("closing", 41, 14);
  assert(
    daily.length > 0 &&
      daily.every((k) => deepDay.includes(k)) &&
      deepDay.length === daily.length + 3,
    "D2: an EXTRA task — every daily closing chore is still there on a deep-clean day",
  );
  const s = saveAt(41, 14);
  const once = addPhaseChores(s, "closing", 41, 14, 3);
  const twice = addPhaseChores(once, "closing", 41, 14, 3);
  const open = (x: SaveData) => cleanlinessOf(x).tasks.filter((t) => deepKinds.includes(t.kind));
  assert(
    open(once).length === 3 &&
      JSON.stringify(open(twice)) === JSON.stringify(open(once)) &&
      JSON.stringify(cleanlinessOf(twice).tasks) === JSON.stringify(cleanlinessOf(once).tasks),
    "D3: added once per day — closing again (a reload, a second tap) adds nothing",
  );
  const uses = usesAvailable(once, "disinfectant");
  const done = cleanTask(once, "deep-kitchen");
  const again = cleanTask(done.save, "deep-kitchen");
  assert(
    done.ok &&
      usesAvailable(done.save, "disinfectant") === uses - 3 &&
      !again.ok &&
      usesAvailable(again.save, "disinfectant") === uses - 3 &&
      !cleanlinessOf(done.save).tasks.some((t) => t.kind === "deep-kitchen"),
    "D4: a deep clean uses its supplies once (3 disinfectant uses); doing it again changes nothing",
  );
  const crew = cleanerRound(
    addPhaseChores(saveAt(41, 14, CLEANING, ["cleaner"]), "closing", 41, 14, 3),
  );
  assert(
    crew.cleaned.includes("deep-kitchen") &&
      crew.cleaned.includes("deep-restroom") &&
      crew.cleaned.includes("deep-dining"),
    "D5: the Cleaner does the deep cleans in their areas",
    crew.cleaned,
  );
}

console.log("S. The day strip");
{
  assert(
    /Par audit/.test(dayStripText(dayClockFor(saveAt(41, 14), 41))) &&
      /Deep clean tonight/.test(dayStripText(dayClockFor(saveAt(41, 7), 41))) &&
      !/Par audit|Deep clean/.test(dayStripText(dayClockFor(saveAt(41, 13), 41))) &&
      !/Par audit|Deep clean/.test(
        dayStripText(dayClockFor(saveAt(AUDIT_FROM - 1, 14), AUDIT_FROM - 1)),
      ) &&
      /Par audit/.test(dayStripText(dayClockFor(saveAt(AUDIT_FROM, 14), AUDIT_FROM))),
    "S1: the strip shows 📋 Par audit / 🧽 Deep clean tonight on their days (from L21), nothing otherwise",
    dayStripText(dayClockFor(saveAt(41, 14), 41)),
  );
}

console.log("W. Wiring");
{
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  assert(
    /<ParAuditCard/.test(layer) && /openMarketSupplies\(go, getSupplyItem\(id\)/.test(layer),
    "W1: the opening card shows the audit; Buy opens the Market on that line",
  );
}

console.log(failures ? `\nPAR AUDIT QA: ${failures} FAILURE(S)` : "\nPAR AUDIT QA: ALL PASS");
process.exit(failures ? 1 : 0);
