/**
 * CLOSING CHORES — the player closes up (developer 2026-10-23: "do not
 * automate the important tasks while closing, let the player do everything
 * unless he hires a cleaner").
 *
 * Closing Time's list (CLOSING_CHORES: wash up, wipe down, throw out spoiled
 * food, wrap the fridge, set the dining room, count the takings) is a list of
 * chores the player does, one tap each, before "Close for the night" opens:
 *
 *  - Wash up: the sink's dishes are washed in the sink game first (each kind
 *    is the cleanliness action "wash"); with the sink empty, one tap does the
 *    knives and pans. No dish soap → the dishes may wait for the next START
 *    (never a block, no soft-lock).
 *  - Every other chore is one tap. What it does to the save stays in
 *    `closeDay` (the wipe-down's cleaning liquid, the spoiled food thrown
 *    out, the wrap and tissues, the books), so the economy is unchanged.
 *  - A Cleaner on duty (hired, or for the day) does every chore but the
 *    count — the money is the owner's — and washes the sink's dishes by hand
 *    at closing (`cleanerClosing`: dish soap, nothing breaks; with no soap
 *    they wait for START as before).
 *
 * What's done lives in `business.restaurantDay.closingDone` (the day's own
 * state; a new day starts with none). Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { cleanerOnDuty } from "./cleanliness";
import { CLOSING_CHORES } from "./restaurantProgression";
import { restaurantDayOf } from "./restaurantDay";
import { bottleView, handWash, sinkLines, sinkPieces } from "./serviceSupplies";

/** Each chore's picture and the word on its button. */
export const CLOSING_CHORE_LOOK: Record<string, { icon: string; verb: string; done: string }> = {
  "wash-up": { icon: "🧽", verb: "Wash", done: "Washed" },
  "wipe-down": { icon: "🧻", verb: "Wipe", done: "Wiped" },
  spoiled: { icon: "🗑️", verb: "Throw out", done: "Done" },
  wrap: { icon: "🥡", verb: "Wrap", done: "Wrapped" },
  "dining-room": { icon: "🍽️", verb: "Set", done: "Set" },
  count: { icon: "💵", verb: "Count", done: "Counted" },
};

/** The one chore a Cleaner never does: the day's money is the owner's. */
const OWNER_ONLY = new Set(["count"]);

export type ClosingChore = {
  id: string;
  label: string;
  icon: string;
  verb: string;
  doneWord: string;
  /** Who did it: the player's tap, the Cleaner on duty, or nobody yet. */
  by: "player" | "cleaner" | null;
  /** Wash up only: dishes still in the sink that the sink game must wash first. */
  sinkFirst: number;
};

/** Tonight's chores for the restaurant at `levelNumber`, with who did each. */
export function closingChoreList(save: SaveData, levelNumber: number): ClosingChore[] {
  const d = restaurantDayOf(save);
  const done = new Set(d.closingDone ?? []);
  const cleaner = cleanerOnDuty(save);
  const soap = bottleView(save, "dish-soap").status !== "empty";
  const sink = sinkPieces(save);
  return CLOSING_CHORES.filter((c) => levelNumber >= c.fromLevel).map((c) => {
    const look = CLOSING_CHORE_LOOK[c.id] ?? { icon: "✓", verb: "Do it", done: "Done" };
    const byCleaner = cleaner && !OWNER_ONLY.has(c.id);
    return {
      id: c.id,
      label: c.label,
      icon: look.icon,
      verb: look.verb,
      doneWord: look.done,
      by: done.has(c.id) ? "player" : byCleaner ? "cleaner" : null,
      sinkFirst: c.id === "wash-up" && !byCleaner && soap ? sink : 0,
    };
  });
}

/** How many chores are still the player's before closing. */
export function closingChoresLeft(save: SaveData, levelNumber: number): number {
  return closingChoreList(save, levelNumber).filter((c) => c.by === null).length;
}

export type ClosingChoreResult =
  { ok: true; save: SaveData } | { ok: false; reason: "not-closing" | "unknown" | "done" | "sink" };

/**
 * The player does one closing chore. Wash up waits until the sink game has
 * washed the sink's dishes (while there is soap). Done twice → refused.
 */
export function doClosingChore(
  save: SaveData,
  id: string,
  levelNumber: number,
): ClosingChoreResult {
  const d = restaurantDayOf(save);
  if (!d.closingDue) return { ok: false, reason: "not-closing" };
  const chore = closingChoreList(save, levelNumber).find((c) => c.id === id);
  if (!chore) return { ok: false, reason: "unknown" };
  if (chore.by !== null) return { ok: false, reason: "done" };
  if (chore.sinkFirst > 0) return { ok: false, reason: "sink" };
  return {
    ok: true,
    save: {
      ...save,
      business: {
        ...save.business,
        restaurantDay: { ...d, closingDone: [...(d.closingDone ?? []), id] },
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
