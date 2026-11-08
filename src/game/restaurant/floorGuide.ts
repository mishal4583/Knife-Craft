/**
 * THE FIRST MACHINE, STEP BY STEP (developer 2026-11-08: "proper instruction to buy machines on the second floor after the first visit,
 * and only when he has enough money to buy and set up the machines and the other required things"). Pure: given the save, what the
 * Second Floor should tell the player about their first machine. Nothing here moves money; the buy itself is `buyStation`.
 *
 *  - "save": no machine yet and the cash is short of the machine's price PLUS the reserve for the next service (food, wages, supplies,
 *            `SECOND_FLOOR_RESERVE_CENTS`): say how much is still missing, never offer Buy.
 *  - "buy":  there is enough: point at Buy, say what stays in the till.
 *  - null:   a machine is owned (the ordinary "Next:" goal strip takes over) or the floor is closed.
 */
import type { SaveData } from "../SaveManager";
import { SECOND_FLOOR_RESERVE_CENTS } from "../config/earlyLevels";
import {
  STATIONS,
  isSecondFloorOpen,
  isStationUnlocked,
  secondFloorOf,
  type StationId,
} from "./secondFloor";
import { SHORT } from "./floorGoal";

export type FirstMachineGuide = {
  stage: "save" | "buy";
  id: StationId;
  /** The machine to buy first (the cheapest unlocked one). */
  name: string;
  price: number;
  /** What the player needs in hand to buy it AND keep going: the price + the reserve. */
  needed: number;
  have: number;
  /** What is still missing (0 at the "buy" stage). */
  missing: number;
  /** 0-1 of the way there. */
  fraction: number;
};

export const firstMachineNeeded = (price: number) => price + SECOND_FLOOR_RESERVE_CENTS;

/** `cash`: the credits (plus what waits on the floor, if any). */
export function firstMachineGuide(
  save: SaveData,
  reachedLevel: number,
  cash: number,
): FirstMachineGuide | null {
  if (!isSecondFloorOpen(reachedLevel)) return null;
  if (Object.keys(secondFloorOf(save).stations).length > 0) return null;
  const list = STATIONS.filter((s) => isStationUnlocked(s, reachedLevel));
  if (list.length === 0) return null;
  const first = list.reduce((a, b) => (b.price < a.price ? b : a));
  const needed = firstMachineNeeded(first.price);
  const missing = Math.max(0, needed - cash);
  return {
    stage: missing > 0 ? "save" : "buy",
    id: first.id,
    name: SHORT[first.id],
    price: first.price,
    needed,
    have: cash,
    missing,
    fraction: Math.min(1, Math.max(0, cash / needed)),
  };
}
