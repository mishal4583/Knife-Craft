/**
 * THE SECOND FLOOR REMINDER (developer 2026-11-11: "before Level 20 let the player own at least two cheap machines on the Second Floor if he has the money,
 * and let Paige remind players to visit the Second Floor and buy machines if they have more than enough money for machines and polishes").
 *
 * Pure: given the save and the level, what (if anything) Paige and the guide should nudge the player to do upstairs now. It never buys anything and moves
 * no money; the buy itself is `buyStation` / `buyPolish`. A nudge is only ever made when the player can really pay it AND keep going (the same reserve the
 * first machine needs: `SECOND_FLOOR_RESERVE_CENTS`).
 *
 *  - "first-machine":  no machine yet, the cheapest unlocked one is affordable with the reserve (the existing first-machine rule).
 *  - "second-machine": ONE machine, before Level `EARLY_TWO_MACHINES_BY_LEVEL`: the cheapest other unlocked machine is affordable with the reserve.
 *  - "new-machine":    the wallet covers the next machine AND a polish step AND the reserve ("more than enough").
 *  - "polish":         no machine to add, but the wallet covers three polish steps of the cheapest one AND the reserve.
 */
import type { SaveData } from "../SaveManager";
import { EARLY_TWO_MACHINES_BY_LEVEL, SECOND_FLOOR_RESERVE_CENTS } from "../config/earlyLevels";
import {
  MAX_POLISH,
  STATIONS,
  isSecondFloorOpen,
  isStationUnlocked,
  machinePrice,
  polishPrice,
  secondFloorOf,
  type StationId,
} from "./secondFloor";

export type FloorAdviceKind = "first-machine" | "second-machine" | "new-machine" | "polish";
export type FloorAdvice = {
  kind: FloorAdviceKind;
  /** The machine to buy (the cheapest unowned unlocked one) or, for "polish", the machine to polish. */
  id: StationId;
  /** What it costs now (cents). */
  price: number;
};

export const FLOOR_ADVICE_KINDS: readonly FloorAdviceKind[] = [
  "first-machine",
  "second-machine",
  "new-machine",
  "polish",
];

export function floorAdvice(save: SaveData, level: number): FloorAdvice | null {
  if (!isSecondFloorOpen(level)) return null;
  const floor = secondFloorOf(save);
  const branch = floor.branch ?? 0;
  const owned = Object.keys(floor.stations);
  const cash = save.credits;
  const free = STATIONS.filter((s) => isStationUnlocked(s, level) && !owned.includes(s.id));
  const next = free.length ? free.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  if (owned.length === 0) {
    if (!next) return null;
    const price = machinePrice(next, branch);
    return cash >= price + SECOND_FLOOR_RESERVE_CENTS
      ? { kind: "first-machine", id: next.id, price }
      : null;
  }
  if (owned.length === 1 && level < EARLY_TWO_MACHINES_BY_LEVEL && next) {
    const price = machinePrice(next, branch);
    if (cash >= price + SECOND_FLOOR_RESERVE_CENTS)
      return { kind: "second-machine", id: next.id, price };
  }
  // The cheapest polish step among the machines that can still be polished.
  let cheapestPolish: { id: StationId; price: number } | null = null;
  for (const s of STATIONS) {
    const o = floor.stations[s.id];
    if (!o || (o.polish ?? 0) >= MAX_POLISH) continue;
    const price = polishPrice(s, o.polish ?? 0, branch);
    if (!cheapestPolish || price < cheapestPolish.price) cheapestPolish = { id: s.id, price };
  }
  if (next) {
    const price = machinePrice(next, branch);
    if (cash >= price + (cheapestPolish?.price ?? 0) + SECOND_FLOOR_RESERVE_CENTS)
      return { kind: "new-machine", id: next.id, price };
  }
  if (cheapestPolish && cash >= cheapestPolish.price * 3 + SECOND_FLOOR_RESERVE_CENTS)
    return { kind: "polish", id: cheapestPolish.id, price: cheapestPolish.price };
  return null;
}
