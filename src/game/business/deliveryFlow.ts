/**
 * THE DELIVERY ROUTINE (developer 2026-11-11): "receive the delivery, check for damaged product, unpack, sort to the fridge, then the Fridge Check:
 * like in the real world. Every mini-game should be mandatory to go on, and unlock in its right order. The inventory sorting too."
 *
 *   1  CHECK    Delivery Inspection   (business/deliveryInspection.ts): look over every basket for NOT FRESH food
 *   2  UNPACK   Unpack the delivery   (business/fridgeSort.ts, "Fridge Sort"): sort the checked food into the fridge. Locked until step 1 is done
 *   3  SHELVES  Stock the shelves     (business/stockroomSort.ts): the supplies bought go on the shelves
 *   4  FRIDGE   Fridge Check          (restaurant/fridgeCheck.ts): the closing chores "throw out spoiled food" / "wrap and label" are the game
 *
 * A step is only ever waiting when there is something for it (a delivery, a crate of supplies, a fridge chore) AND its game is open at the
 * player's level. While any step waits, the next service cannot be opened (`serviceGate`): the Kitchen shows the steps in order instead. A hired
 * Prep Cook can do the first three for the player (a button inside each game, no reward), so nobody is ever stuck.
 *
 * Pure: it reads the save and moves nothing. No money, stock or ledger.
 */
import type { SaveData } from "../SaveManager";
import { piecesWaiting, roundFor as fridgeRound } from "./fridgeSort";
import { pendingInspections } from "./deliveryInspection";
import { roundFor as stockroomRound } from "./stockroomSort";
import { cleanlinessOf } from "../restaurant/cleanliness";
import { CHECK_TASK, isFridgeCheckOpen } from "../restaurant/fridgeCheck";

export type FlowStepId = "inspect" | "unpack" | "shelves" | "fridge-check";

export type FlowStep = {
  id: FlowStepId;
  /** 1-4: the number shown beside it. */
  n: number;
  icon: string;
  /** The action, short ("Check the delivery"). */
  label: string;
  /** What it is about, short ("2 baskets"). */
  detail: string;
  /** The screen the app opens (`go`). */
  to: string;
  /** Waiting for an earlier step: the reason ("Check the delivery first"), else null. */
  lockedBy: string | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The steps that are waiting now, in the order they must be done. */
export function flowSteps(save: SaveData, level: number): FlowStep[] {
  const out: FlowStep[] = [];
  const toCheck = pendingInspections(save, level);
  if (toCheck > 0)
    out.push({
      id: "inspect",
      n: 1,
      icon: "🔎",
      label: "Check the delivery",
      detail: plural(toCheck, "basket", "baskets"),
      to: "delivery-inspection",
      lockedBy: null,
    });
  if (fridgeRound(save, level)) {
    out.push({
      id: "unpack",
      n: 2,
      icon: "🧊",
      label: "Fridge Sort",
      detail: plural(piecesWaiting(save), "piece", "pieces"),
      to: "fridge-sort",
      lockedBy: toCheck > 0 ? "Check the delivery first" : null,
    });
  }
  if (stockroomRound(save, level))
    out.push({
      id: "shelves",
      n: 3,
      icon: "🗄️",
      label: "Stock the shelves",
      detail: "supplies",
      to: "stockroom-sort",
      lockedBy: null,
    });
  const chores = cleanlinessOf(save).tasks.filter(
    (t) =>
      (t.kind === CHECK_TASK.sort || t.kind === CHECK_TASK.wrap) &&
      isFridgeCheckOpen(save, level, t.kind),
  );
  if (chores.length > 0)
    out.push({
      id: "fridge-check",
      n: 4,
      icon: "🔍",
      label: "Fridge Check",
      detail: "spoiled food",
      to: "business-cleanliness",
      lockedBy: null,
    });
  return out;
}

/** Whether Unpack the delivery may be played now: not while baskets still wait to be checked. */
export const unpackLocked = (save: SaveData, level: number): boolean =>
  pendingInspections(save, level) > 0;

export type ServiceGate = {
  open: boolean;
  steps: FlowStep[];
  /** The first step the player can do now (never a locked one), or null when nothing waits. */
  next: FlowStep | null;
};

/** Can the next service open? Only when no step of the routine waits. */
export function serviceGate(save: SaveData, level: number): ServiceGate {
  const steps = flowSteps(save, level);
  return { open: steps.length === 0, steps, next: steps.find((s) => !s.lockedBy) ?? null };
}
