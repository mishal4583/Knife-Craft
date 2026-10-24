/**
 * CLOSING CHORES QA — the night chores are Cleanliness tasks (developer
 * 2026-10-23: "let the player do everything unless he hires a cleaner";
 * 2026-10-24: "why is it not connected with the cleanliness section just like
 * opening or normal cleaning … add the same night chores also in the same
 * cleanliness section"). Tested with the real functions.
 *
 *  C. Tonight's rows: the closing phase's own Cleanliness tasks (wipe the
 *     boards, throw out spoiled food, wrap the fridge, reset the dining room
 *     from dine-in, degrease, mop, disinfect …), the dishes and the count.
 *     Cleaning a task (the cleanliness action) ticks its row; a task short of
 *     supplies shows what's missing and never holds the close.
 *  A. The same tasks in Restaurant → Cleanliness (each area's view), the
 *     scrubbing ones in the cleaning game (with dirt on the painting).
 *  W. The dishes: the sink game first while there is soap; no soap → they
 *     wait for START (never a soft-lock).
 *  O. The count: the owner's one tap, once; everything else goes through
 *     Cleanliness.
 *  K. The team: a Cleaner on duty does the routine closing tasks (the round
 *     when they arrive) and washes the sink at closing — the owner only counts.
 *  D. The day and saves: closing clears the count; old saves read none; no
 *     new save field; the new tasks use no supplies (the economy is unchanged).
 *  U. Wiring: Closing Time lists closingRows and opens the cleaning game,
 *     Close stays locked until done; the Pre-Service Check's checklist and the
 *     Cleanliness page use the same game; App counts with doClosingChore and
 *     lets the Cleaner wash before closeDay; the sim mirrors it.
 *
 * Run: npx tsx scripts/closing-chores-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  cleanerClosing,
  closingChoresLeft,
  closingRows,
  doClosingChore,
} from "../src/game/restaurant/closingChores.ts";
import {
  TASK_RULES,
  addPhaseChores,
  applyCleanlinessAction,
  areaView,
  cleanerRound,
  phaseChores,
  type TaskKind,
} from "../src/game/restaurant/cleanliness.ts";
import { dirtZones } from "../src/game/restaurant/cleaningDirt.ts";
import { closeDay, restaurantDayOf } from "../src/game/restaurant/restaurantDay.ts";
import { restaurantSuppliesOf, sinkPieces } from "../src/game/restaurant/serviceSupplies.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`, detail === undefined ? "" : JSON.stringify(detail));
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

const FULL_CUPBOARD: Partial<Record<SupplyId, number>> = {
  disinfectant: 6,
  "sponges-cloths": 6,
  "floor-cleaner": 6,
  "mop-bucket": 1,
  brooms: 1,
  "toilet-brushes": 1,
  "bin-liners": 6,
  "paper-towels": 6,
  "toilet-paper": 6,
  "hand-soap": 6,
};

/** A save at Level `n` due to close on Day 4, tonight's chores added (as after the last service). */
function closingAt(
  n: number,
  {
    dirty = {},
    soap = 2,
    cleaner = false,
    cupboard = FULL_CUPBOARD,
  }: {
    dirty?: Partial<Record<SupplyId, number>>;
    soap?: number;
    cleaner?: boolean;
    cupboard?: Partial<Record<SupplyId, number>>;
  } = {},
): SaveData {
  const base = structuredClone(DEFAULT_SAVE);
  const stock = { ...base.business.supplies.stock };
  for (const [id, units] of Object.entries(cupboard))
    stock[id as SupplyId] = { units: units!, costBasis: units! * 500 };
  if (soap) stock["dish-soap"] = { units: soap, costBasis: soap * 1500 };
  let save: SaveData = {
    ...base,
    credits: 500_000,
    levelProgress: {
      ...base.levelProgress,
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    business: {
      ...base.business,
      supplies: { ...base.business.supplies, stock },
      staff: {
        ...base.business.staff,
        hiredRoles: cleaner
          ? [...base.business.staff.hiredRoles, "cleaner"]
          : base.business.staff.hiredRoles,
      },
      restaurantDay: {
        day: 4,
        opened: true,
        servicesDone: 3,
        servicesPlanned: 3,
        closingDue: true,
        openingCredits: 400_000,
        openingLevel: n - 2,
      },
    },
  };
  save = {
    ...save,
    business: {
      ...save.business,
      restaurantSupplies: {
        ...restaurantSuppliesOf(save),
        soapPct: soap ? 60 : 0,
        dirty: dirty as Record<SupplyId, number>,
      },
    },
  };
  return addPhaseChores(save, "closing", n, 4, 3);
}
const clean = (s: SaveData, task: TaskKind) =>
  applyCleanlinessAction(s, { kind: "clean", task }).save;
const tasksOf = (s: SaveData, n: number) =>
  closingRows(s, n).flatMap((r) => (r.type === "task" ? [r.task] : []));

// ---------- C. Tonight's rows ----------
{
  const late = closingAt(40);
  const early = closingAt(18); // before dine-in (L21 after the 150-level remap)
  const night = tasksOf(late, 40);
  assert(
    (
      [
        "wipe-boards",
        "spoiled-out",
        "wrap-fridge",
        "clear-tables",
        "degrease",
        "mop-all",
        "restroom-disinfect",
      ] as TaskKind[]
    ).every((k) => night.includes(k)) &&
      !tasksOf(early, 18).includes("clear-tables") &&
      night.every((k) => TASK_RULES[k].phase === "closing") &&
      closingRows(late, 40)[0]!.id === "wash-up" &&
      closingRows(late, 40).at(-1)!.id === "count",
    "C1: tonight's rows are the closing phase's Cleanliness tasks (the dining reset from dine-in), the dishes first, the count last",
    { night },
  );
  const left0 = closingChoresLeft(late, 40);
  const s1 = clean(late, "spoiled-out");
  assert(
    closingRows(s1, 40).find((r) => r.id === "task:spoiled-out")?.state === "done" &&
      closingChoresLeft(s1, 40) === left0 - 1,
    "C2: cleaning a task (the cleanliness action) ticks its row",
  );
  let all = late;
  for (const k of night) all = clean(all, k);
  all = (doClosingChore(all, "count") as { save: SaveData }).save;
  assert(
    closingChoresLeft(all, 40) === 0 && all.credits === late.credits,
    "C3: every task cleaned and the till counted → nothing left; no money moved",
  );
  const bare = closingAt(40, { cupboard: {} });
  const blocked = closingRows(bare, 40).filter((r) => r.state === "blocked");
  assert(
    blocked.some((r) => r.type === "task" && r.task === "mop-all" && r.needs.length > 0) &&
      closingChoresLeft(bare, 40) ===
        closingRows(bare, 40).filter((r) => r.state === "todo").length,
    "C4: a task short of supplies says what it needs and never holds the close",
    { blocked: blocked.map((r) => r.id) },
  );
}

// ---------- A. The same tasks in Cleanliness, the same game ----------
{
  const s = closingAt(40);
  const kitchen = areaView(s, "kitchen", 40).tasks.map((t) => t.kind);
  const dining = areaView(s, "dining", 40).tasks.map((t) => t.kind);
  assert(
    kitchen.includes("wipe-boards") &&
      kitchen.includes("spoiled-out") &&
      kitchen.includes("wrap-fridge") &&
      dining.includes("clear-tables") &&
      dining.includes("mop-all"),
    "A1: tonight's chores are in Restaurant → Cleanliness, under their areas",
    { kitchen, dining },
  );
  const game = read("src/components/kc/restaurant/CleaningGame.tsx");
  assert(
    /"wipe-boards"/.test(game) &&
      /"clear-tables"/.test(game) &&
      (["humble", "growing", "established"] as const).every(
        (st) =>
          dirtZones("kitchen", "wipe-boards", st).length > 0 &&
          dirtZones("dining", "clear-tables", st).length > 0,
      ),
    "A2: the boards and the dining reset are scrubbed in the cleaning game, on their surfaces",
  );
  assert(
    (["wipe-boards", "spoiled-out", "wrap-fridge", "clear-tables"] as TaskKind[]).every(
      (k) =>
        TASK_RULES[k].uses.length === 0 &&
        TASK_RULES[k].tools.length === 0 &&
        TASK_RULES[k].routine,
    ),
    "A3: the new night tasks use no supplies (closeDay still draws the wipe-down's liquid and the wrap) and the team can do them",
  );
}

// ---------- W. The dishes ----------
{
  const s = closingAt(40, { dirty: { "dinner-plates": 4, "dinner-forks": 4 } });
  const row = closingRows(s, 40).find((r) => r.id === "wash-up");
  const washed = applyCleanlinessAction(s, {
    kind: "wash",
    ids: ["dinner-plates", "dinner-forks"],
  }).save;
  const noSoap = closingAt(40, { dirty: { "dinner-plates": 4 }, soap: 0 });
  assert(
    row?.state === "todo" &&
      closingRows(washed, 40).find((r) => r.id === "wash-up")?.state === "done" &&
      closingRows(noSoap, 40).find((r) => r.id === "wash-up")?.state === "blocked",
    "W1: the dishes are the sink game's (done when the sink is empty); no soap → they wait for START",
  );
}

// ---------- O. The count ----------
{
  const s = closingAt(40);
  const r1 = doClosingChore(s, "count");
  const r2 = r1.ok ? doClosingChore(r1.save, "count") : r1;
  const r3 = doClosingChore(s, "task:mop-all");
  const notDue = structuredClone(s);
  notDue.business.restaurantDay = { ...notDue.business.restaurantDay!, closingDue: false };
  assert(
    r1.ok &&
      !r2.ok &&
      r2.reason === "done" &&
      !r3.ok &&
      r3.reason === "use-cleanliness" &&
      !doClosingChore(notDue, "count").ok &&
      r1.save.economyLedger.length === s.economyLedger.length,
    "O1: counting the till is the owner's one tap, once; the rest goes through Cleanliness",
  );
}

// ---------- K. The team ----------
{
  const s = closingAt(40, { dirty: { "dinner-plates": 4, "water-glasses": 3 }, cleaner: true });
  const round = cleanerRound(s).save;
  const left = closingRows(round, 40)
    .filter((r) => r.state === "todo")
    .map((r) => r.id);
  const washed = cleanerClosing(round).save;
  assert(
    !left.some(
      (id) => id.startsWith("task:") && TASK_RULES[id.slice(5) as TaskKind].staff === undefined,
    ) &&
      sinkPieces(washed) === 0 &&
      restaurantSuppliesOf(washed).brokenTotal === restaurantSuppliesOf(s).brokenTotal,
    "K1: a Cleaner on duty does the routine closing tasks and washes the sink by hand (nothing breaks)",
    { left },
  );
  const none = closingAt(40, { dirty: { "dinner-plates": 4 } });
  assert(cleanerClosing(none).save === none, "K2: no Cleaner → the sink is the player's");
}

// ---------- D. The day and saves ----------
{
  let s = closingAt(40);
  s = (doClosingChore(s, "count") as { save: SaveData }).save;
  const next = closeDay(s, 40);
  assert(
    (restaurantDayOf(next).closingDone ?? []).length === 0 && restaurantDayOf(next).day === 5,
    "D1: closing clears the count; Day 5 starts with none",
  );
  const old = closingAt(40);
  const raw = { ...old.business.restaurantDay! } as Record<string, unknown>;
  delete raw.closingDone;
  old.business.restaurantDay = raw as never;
  assert(
    closingRows(old, 40).find((r) => r.id === "count")?.state === "todo",
    "D2: old saves (no closingDone) read nothing counted",
  );
  const before = Object.keys(structuredClone(DEFAULT_SAVE)).sort().join();
  const bizBefore = Object.keys(structuredClone(DEFAULT_SAVE).business).sort().join();
  assert(
    Object.keys(s).sort().join() === before &&
      Object.keys(s.business).sort().join() ===
        [
          ...new Set([
            ...bizBefore.split(","),
            "restaurantDay",
            "restaurantSupplies",
            "cleanliness",
          ]),
        ]
          .filter(Boolean)
          .sort()
          .filter((k) => k in s.business)
          .join(),
    "D3: no new save field (the count lives in business.restaurantDay, the tasks in business.cleanliness)",
  );
  assert(
    phaseChores("closing", 40, 4).length >= 7,
    "D4: the closing phase brings tonight's chores",
  );
}

// ---------- U. Wiring ----------
{
  const view = read("src/components/kc/restaurant/ClosingTime.tsx");
  const shift = read("src/components/kc/restaurant/ShiftChecklist.tsx");
  const page = read("src/components/kc/business/BusinessCleanliness.tsx");
  const app = read("src/App.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  assert(
    /closingRows\(save, restaurantLevel\)/.test(view) &&
      /useCleaningGame\(save,/.test(view) &&
      /cleaning\.clean\(r\.task\)/.test(view) &&
      /disabled=\{left > 0\}/.test(view) &&
      /variant="button"/.test(view) &&
      !/<ShiftChecklist/.test(view),
    "U1: Closing Time lists tonight's Cleanliness tasks and cleans them in the cleaning game; Close stays locked until done",
  );
  assert(
    /useCleaningGame\(save,/.test(shift) && /useCleaningGame\(save,/.test(page),
    "U2: the Pre-Service Check's chores and Restaurant → Cleanliness use the same cleaning game",
  );
  assert(
    /doClosingChore\(save, id\)/.test(app) &&
      /closeDay\(cleanerClosing\(save\)\.save, restaurantLevelOf\(save\.levelProgress\)\)/.test(
        app,
      ) &&
      /closeDay\(cleanerClosing\(s\)\.save, lvl\)/.test(sim),
    "U3: App counts the till with doClosingChore and lets the Cleaner wash before closeDay; the sim mirrors it",
  );
}

console.log(failures ? `CLOSING CHORES QA: ${failures} FAILURE(S)` : "CLOSING CHORES QA: ALL PASS");
process.exit(failures ? 1 : 0);
