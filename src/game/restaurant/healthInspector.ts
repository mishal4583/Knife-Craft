/**
 * THE HEALTH INSPECTOR'S VISIT (developer 2026-11-13: "the inspection is not built, plan for that, build it"; plan:
 * docs/planning/HEALTH-INSPECTOR-PLAN-2026-11-13.md).
 *
 * The day-end inspection (business/businessInspection.ts) only runs from full operation, the campaign's last level, so a player never met
 * the inspector the game talks about. This is his visit during the campaign:
 *
 *  - from Level 13, on a level's first play, he is at the door on the Pre-Service Check. The card lists what he will look at, live, each
 *    row with a way to fix it first (clean, throw out expired food, buy soap). "Let him in" runs the visit; START waits for it (one tap,
 *    always possible: never a soft-lock);
 *  - he looks at the restaurant as it IS (no dice): cleaning tasks left open, expired food in the fridge, an overfull fridge, dish soap
 *    and cleaning liquid in stock;
 *  - Grade A (all clean): Hype for the Second Floor, more for A grades in a row, and he stays away for 6 levels. Grade B (warnings):
 *    nothing, back in 4. Grade C (a failed check): a fine of 5 % of the level's pay (whole dollars, ONE "inspection-fine" ledger entry,
 *    all or nothing: a wallet that cannot pay it pays nothing), back in 2.
 *
 * State: `business.healthInspector` (optional, read through `healthInspectorOf`; an old save has none and meets him at its next level).
 * Pure and deterministic; nothing here reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { SupplyId } from "../business/businessSupplies";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import { paidLevelReward } from "../levels/levelRewards";
import { getInventoryUsedCapacity, getRefrigeratorCapacity } from "../business/RefrigeratorManager";
import { perishabilityStateFor } from "../business/perishability";
import { TASK_RULES, cleanlinessOf, usesAvailable } from "./cleanliness";
import { addHype, secondFloorOf } from "./secondFloor";

/** His first visit (Levels 3 to 12 each open something else; cleaning, the fridge and dine-in are all running by now). */
export const HEALTH_INSPECTOR_FROM_LEVEL = 13;

export type InspectorGrade = "A" | "B" | "C";
export type InspectorCheckId =
  "cleaning" | "expired" | "fridge-room" | "dish-soap" | "cleaning-liquid";
export type InspectorVerdict = "PASS" | "WARNING" | "FAIL";

/** Levels until he is back, by the grade he gave. */
export const VISIT_GAP: Record<InspectorGrade, number> = { A: 6, B: 4, C: 2 };
/** Grade A: Hype for the Second Floor; each A in a row adds more, up to the cap. */
export const GRADE_A_HYPE = 20;
export const GRADE_A_STREAK_HYPE = 10;
export const GRADE_A_HYPE_MAX = 40;
/** Grade C: the fine, a share of the level's own pay (whole dollars). */
export const GRADE_C_FINE_SHARE = 0.05;
/** Open cleaning tasks: this many or more fail the check; fewer (but some) are a warning. */
export const CLEANING_FAIL_TASKS = 3;
/** The fridge is overfull from this share of its capacity (a warning: only a bigger fridge or cooking makes room). */
export const FRIDGE_OVERFULL_SHARE = 0.95;

export type InspectorRow = {
  id: InspectorCheckId;
  verdict: InspectorVerdict;
  /** A few words and numbers for the card. */
  glance: string;
};

export type InspectorVisit = {
  level: number;
  grade: InspectorGrade;
  rows: InspectorRow[];
  /** Cents really paid (0 = no fine, or the wallet could not pay it). */
  fine: number;
  /** Hype really added. */
  hype: number;
};

export type HealthInspectorState = {
  /** The level of his next visit. */
  nextLevel: number;
  /** Grade A visits in a row. */
  streak: number;
  visits: number;
  last: InspectorVisit | null;
};

export const DEFAULT_HEALTH_INSPECTOR: HealthInspectorState = {
  nextLevel: HEALTH_INSPECTOR_FROM_LEVEL,
  streak: 0,
  visits: 0,
  last: null,
};

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const GRADES: readonly InspectorGrade[] = ["A", "B", "C"];
const VERDICTS: readonly InspectorVerdict[] = ["PASS", "WARNING", "FAIL"];
const CHECK_IDS: readonly InspectorCheckId[] = [
  "cleaning",
  "expired",
  "fridge-room",
  "dish-soap",
  "cleaning-liquid",
];

/** The save's inspector state (clamped; the defaults when absent or odd, so an old save simply meets him next). */
export function healthInspectorOf(save: SaveData): HealthInspectorState {
  const raw = save.business.healthInspector as Partial<HealthInspectorState> | undefined;
  if (!raw || typeof raw !== "object") return DEFAULT_HEALTH_INSPECTOR;
  const l = raw.last as Partial<InspectorVisit> | null | undefined;
  const last: InspectorVisit | null =
    l && typeof l === "object" && GRADES.includes(l.grade as InspectorGrade)
      ? {
          level: whole(l.level),
          grade: l.grade as InspectorGrade,
          rows: Array.isArray(l.rows)
            ? l.rows
                .filter(
                  (r): r is InspectorRow =>
                    !!r && CHECK_IDS.includes(r.id) && VERDICTS.includes(r.verdict),
                )
                .map((r) => ({ id: r.id, verdict: r.verdict, glance: String(r.glance ?? "") }))
            : [],
          fine: whole(l.fine),
          hype: whole(l.hype),
        }
      : null;
  return {
    nextLevel: Math.max(HEALTH_INSPECTOR_FROM_LEVEL, whole(raw.nextLevel)),
    streak: whole(raw.streak),
    visits: whole(raw.visits),
    last,
  };
}

/** What he sees right now, row by row (live: fixing something changes its row at once). */
export function inspectorRows(save: SaveData): InspectorRow[] {
  // Cleaning tasks left open, without the morning's own setup chores (they are today's work, not yesterday's dirt).
  const open = cleanlinessOf(save).tasks.filter((t) => !TASK_RULES[t.kind].phase).length;
  const day = save.business.calendar.businessDay;
  let expired = 0;
  for (const entry of Object.values(save.business.inventory))
    if (
      entry &&
      entry.quantity > 0 &&
      perishabilityStateFor(entry.ingredientId, entry.purchaseDay, day) === "EXPIRED"
    )
      expired++;
  const used = getInventoryUsedCapacity(save.business.inventory);
  const capacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  const overfull = capacity > 0 && used / capacity >= FRIDGE_OVERFULL_SHARE;
  const bottle = (id: SupplyId, name: string): InspectorRow => {
    const has = usesAvailable(save, id) > 0;
    return {
      id: id as InspectorCheckId,
      verdict: has ? "PASS" : "WARNING",
      glance: has ? `${name} in stock` : `No ${name.toLowerCase()}`,
    };
  };
  return [
    {
      id: "cleaning",
      verdict: open === 0 ? "PASS" : open >= CLEANING_FAIL_TASKS ? "FAIL" : "WARNING",
      glance: open === 0 ? "All clean" : `${open} cleaning ${open === 1 ? "task" : "tasks"} open`,
    },
    {
      id: "expired",
      verdict: expired === 0 ? "PASS" : "FAIL",
      glance: expired === 0 ? "No expired food" : `${expired} expired in the fridge`,
    },
    {
      id: "fridge-room",
      verdict: overfull ? "WARNING" : "PASS",
      glance: `Fridge ${Math.round(used)} / ${capacity}${overfull ? " · overfull" : ""}`,
    },
    bottle("dish-soap", "Dish soap"),
    bottle("cleaning-liquid", "Cleaning liquid"),
  ];
}

/** A failed check is a C, a warning a B, a clean sheet an A. */
export function gradeFor(rows: readonly InspectorRow[]): InspectorGrade {
  if (rows.some((r) => r.verdict === "FAIL")) return "C";
  return rows.some((r) => r.verdict === "WARNING") ? "B" : "A";
}

/** The Hype a Grade A pays when it is the `streak`-th A in a row (1 = the first). */
export const gradeAHype = (streak: number): number =>
  Math.min(GRADE_A_HYPE_MAX, GRADE_A_HYPE + GRADE_A_STREAK_HYPE * Math.max(0, streak - 1));

/** The fine a Grade C costs at this level: 5 % of its pay, whole dollars. */
export function gradeCFine(
  level: Pick<LevelDefinition, "id" | "reward" | "campaignRewardBasisLevel">,
): number {
  return Math.floor((paidLevelReward(level) * GRADE_C_FINE_SHARE) / 100) * 100;
}

export type InspectorView =
  | {
      status: "due";
      rows: InspectorRow[];
      /** The grade he would give right now. */
      grade: InspectorGrade;
      /** What that grade would do, for the card. */
      fine: number;
      hype: number;
    }
  | { status: "done"; visit: InspectorVisit; backIn: number };

/**
 * The inspector on this level's Pre-Service Check, or null: "due" = he is at the door (START waits for "Let him in"), "done" = this level's
 * visit and its result. Only for a level's first play (the caller's plan is null for a replay).
 */
export function inspectorAt(
  save: SaveData,
  level: LevelDefinition,
  n: number,
): InspectorView | null {
  if (n < HEALTH_INSPECTOR_FROM_LEVEL) return null;
  const state = healthInspectorOf(save);
  if (state.last && state.last.level === n)
    return { status: "done", visit: state.last, backIn: VISIT_GAP[state.last.grade] };
  if (n < state.nextLevel) return null;
  const rows = inspectorRows(save);
  const grade = gradeFor(rows);
  const fine = grade === "C" ? gradeCFine(level) : 0;
  return {
    status: "due",
    rows,
    grade,
    fine: fine > 0 && save.credits >= fine ? fine : 0,
    hype: grade === "A" ? gradeAHype(state.streak + 1) : 0,
  };
}

/**
 * Runs the visit: grades the restaurant as it is, pays the Hype or charges the fine (one "inspection-fine" entry, only when the wallet covers
 * it), and sets his next visit. Null when he is not due at this level.
 */
export function runInspectorVisit(
  save: SaveData,
  level: LevelDefinition,
  n: number,
): { save: SaveData; visit: InspectorVisit } | null {
  const view = inspectorAt(save, level, n);
  if (!view || view.status !== "due") return null;
  const state = healthInspectorOf(save);
  let next = save;
  let hype = 0;
  if (view.hype > 0) {
    next = addHype(next, view.hype);
    // The meter may be full: record what was really added.
    hype = Math.max(0, (secondFloorOf(next).hype ?? 0) - (secondFloorOf(save).hype ?? 0));
  }
  if (view.fine > 0)
    next = appendLedgerEntry(
      { ...next, credits: next.credits - view.fine },
      "inspection-fine",
      -view.fine,
      `health-inspector:level-${n}`,
    );
  const visit: InspectorVisit = {
    level: n,
    grade: view.grade,
    rows: view.rows,
    fine: view.fine,
    hype,
  };
  const healthInspector: HealthInspectorState = {
    nextLevel: n + VISIT_GAP[view.grade],
    streak: view.grade === "A" ? state.streak + 1 : 0,
    visits: state.visits + 1,
    last: visit,
  };
  return { save: { ...next, business: { ...next.business, healthInspector } }, visit };
}
