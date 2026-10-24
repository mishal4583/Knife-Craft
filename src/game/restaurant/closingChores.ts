/**
 * CLOSING CHORES — the player closes up (developer 2026-10-23: "do not
 * automate the important tasks while closing, let the player do everything
 * unless he hires a cleaner"; 2026-10-24: "why is it not connected with the
 * cleanliness section just like opening or normal cleaning … add the same
 * night chores also in the same cleanliness section").
 *
 * The night's chores ARE Cleanliness tasks: the closing phase's own
 * (cleanliness.ts — wipe the boards and counters, throw out spoiled food,
 * wrap the fridge, reset the dining room, degrease, mop, disinfect, the
 * condiments and cutlery, and the deep cleans on their days), added when
 * the day's last service ends (`choresAfterService`). They show in Restaurant
 * → Cleanliness under their areas and on Closing Time, and are cleaned the
 * same way everywhere: the scrubbing ones in the cleaning game, the rest
 * with one tap (CleaningGame.tsx). Closing Time adds two rows of its own:
 *
 *  - the dishes: done when the sink is empty (the sink game), or when there
 *    is no dish soap (they wait for the next START — never a soft-lock);
 *  - counting the day's takings: the owner's own tap.
 *
 * "Close for the night" opens once every row is done. A task short of a
 * supply or a tool never blocks it (it says what to buy and waits for the
 * morning, like any open task). The team does its routine tasks as ever
 * (`cleanerRound`, when the chores arrive), and a Cleaner on duty washes the
 * sink by hand at closing (`cleanerClosing`) — so with a Cleaner the owner
 * only counts the till.
 *
 * The count lives in `business.restaurantDay.closingDone` (a new day starts
 * with none). Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { SupplyId } from "../business/businessSupplies";
import {
  TASK_RULES,
  cleanerOnDuty,
  cleanlinessOf,
  phaseChores,
  taskNeeds,
  type CleanArea,
  type TaskKind,
} from "./cleanliness";
import { restaurantDayOf } from "./restaurantDay";
import { bottleView, handWash, sinkLines, sinkPieces } from "./serviceSupplies";

export type ClosingRowState = "todo" | "done" | "blocked";

export type ClosingRow =
  | {
      id: string;
      type: "task";
      task: TaskKind;
      area: CleanArea;
      label: string;
      icon: string;
      /** Supplies or tools it still needs (blocked: shown, never holds the close). */
      needs: SupplyId[];
      state: ClosingRowState;
    }
  | {
      id: "wash-up";
      type: "sink";
      label: string;
      icon: string;
      pieces: number;
      state: ClosingRowState;
    }
  | { id: "count"; type: "count"; label: string; icon: string; state: ClosingRowState };

/** Tonight's closing rows at `levelNumber`: the closing tasks, the dishes and the count. */
export function closingRows(save: SaveData, levelNumber: number): ClosingRow[] {
  const d = restaurantDayOf(save);
  const st = cleanlinessOf(save);
  const open = new Map(st.tasks.map((t) => [t.kind, t]));
  // Tonight's chores (only once they were given out — a ✓ must mean done, never
  // "never added"), plus any closing chore still open from before.
  const givenOut = st.choreKeys.includes(`${d.day}:closing:${d.servicesDone}`);
  const kinds = [
    ...(givenOut ? phaseChores("closing", levelNumber, d.day) : []),
    ...st.tasks.filter((t) => TASK_RULES[t.kind].phase === "closing").map((t) => t.kind),
  ].filter((k, i, all) => all.indexOf(k) === i);
  const rows: ClosingRow[] = kinds.map((task) => {
    const rule = TASK_RULES[task];
    const needs = open.has(task) ? taskNeeds(save, task) : [];
    return {
      id: `task:${task}`,
      type: "task",
      task,
      area: rule.area,
      label: rule.label,
      icon: rule.icon,
      needs,
      state: !open.has(task) ? "done" : needs.length ? "blocked" : "todo",
    };
  });
  const pieces = sinkPieces(save);
  const soap = bottleView(save, "dish-soap").status !== "empty";
  rows.unshift({
    id: "wash-up",
    type: "sink",
    label: "Wash the dishes",
    icon: "🫧",
    pieces,
    // No soap: the dishes wait for START (the row says so; it never holds the close).
    state: pieces === 0 ? "done" : soap ? "todo" : "blocked",
  });
  rows.push({
    id: "count",
    type: "count",
    label: "Count the day's takings",
    icon: "💵",
    state: (d.closingDone ?? []).includes("count") ? "done" : "todo",
  });
  return rows;
}

/** How many rows still hold the close (blocked ones never do). */
export function closingChoresLeft(save: SaveData, levelNumber: number): number {
  return closingRows(save, levelNumber).filter((r) => r.state === "todo").length;
}

export type ClosingChoreResult =
  { ok: true; save: SaveData } | { ok: false; reason: "not-closing" | "done" | "use-cleanliness" };

/**
 * The owner's own closing tap — counting the day's takings. Every other row
 * is a Cleanliness task (the cleanliness action "clean", in the cleaning game
 * or one tap) or the sink (the cleanliness action "wash").
 */
export function doClosingChore(save: SaveData, id: string): ClosingChoreResult {
  const d = restaurantDayOf(save);
  if (!d.closingDue) return { ok: false, reason: "not-closing" };
  if (id !== "count") return { ok: false, reason: "use-cleanliness" };
  if ((d.closingDone ?? []).includes("count")) return { ok: false, reason: "done" };
  return {
    ok: true,
    save: {
      ...save,
      business: {
        ...save.business,
        restaurantDay: { ...d, closingDone: [...(d.closingDone ?? []), "count"] },
      },
    },
  };
}

/**
 * The Cleaner's part of closing, just before `closeDay`: with a Cleaner on
 * duty, the sink's dishes are washed by hand (dish soap, nothing breaks; no
 * soap → they wait for START). No Cleaner, or nothing in the sink → unchanged.
 */
export function cleanerClosing(save: SaveData): { save: SaveData; washed: number } {
  if (!restaurantDayOf(save).closingDue || !cleanerOnDuty(save)) return { save, washed: 0 };
  const lines = sinkLines(save);
  if (lines.length === 0) return { save, washed: 0 };
  const w = handWash(
    save,
    lines.map((l) => l.id),
  );
  return { save: w.save, washed: w.washed };
}
