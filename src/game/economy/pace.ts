/**
 * THE PACE (idle phase 5A, developer 2026-10-31): the business's money per hour, gross and net.
 *
 *  - Restaurant: per SHIFT hour (developer 2026-10-31, D12). Staff are paid by the shift hour
 *    (`SERVICE_SHIFT_HOURS` in businessStaff.ts), so a day's takings and costs divide by the same
 *    clock the wages use and `net = gross − costs` reads true. A closed day's figures come from the
 *    WALLET'S OWN LEDGER between the day opening and closing (`dayFigures`, saved by `closeDay`
 *    in `restaurantDay.paceDays`): nothing is estimated and no money is invented.
 *  - Second Floor: per REAL hour (developer 2026-10-31: "let the second floor stay real hours"),
 *    its real rate after the Floor Server / Cleaner rules. It has no wages, so gross = net.
 *
 * The two are never added together: a shift hour and a real hour are different clocks.
 * Pure and derived: no wallet, no ledger entry, no `Math.random`.
 */
import type { SaveData } from "../SaveManager";
import { SERVICE_SHIFT_HOURS } from "../business/businessStaff";
import { floorEarnings, floorPerHour, isSecondFloorOpen } from "../restaurant/secondFloor";
import { floorFill, type Fill } from "../restaurant/floorFill";
import { restaurantDayOf } from "../restaurant/restaurantDay";
import { restaurantLevelOf } from "../restaurant/restaurantMenu";
import type { PaceDay } from "./paceFigures";
export { PACE_COSTS, PACE_INCOME, dayFigures, type PaceDay } from "./paceFigures";

/** The average covers this many of the latest closed days. */
export const PACE_AVERAGE_DAYS = 7; // restaurantDay keeps the same number of closed days

/** One pace line, in whole cents per hour. */
export type PaceLine = { gross: number; costs: number; net: number };

export type Pace = {
  /** Closed days on record (the latest PACE_AVERAGE_DAYS are kept). */
  days: number;
  /** The latest closed day, per shift hour; null before the first closing. */
  last: PaceLine | null;
  /** The mean of the closed days on record, per shift hour; null before the first closing. */
  average: PaceLine | null;
  /** The Second Floor's real rate (gross = net), 0 when nothing works. */
  floorPerHour: number;
  /** What is waiting on the floor right now (cents). */
  floorWaiting: number;
  /** How full the floor is; null when no station works. */
  floorFill: Fill | null;
  /** The Second Floor is open to the player. */
  floorOpen: boolean;
};

/** One day's line per shift hour: net = gross − costs, always (the rounding is done once, on each side). */
export function lineOfDay(d: PaceDay): PaceLine {
  const gross = Math.round(d.gross / SERVICE_SHIFT_HOURS);
  const costs = Math.round(d.costs / SERVICE_SHIFT_HOURS);
  return { gross, costs, net: gross - costs };
}

/** The mean of several days (null for none). */
export function averageLine(days: readonly PaceDay[]): PaceLine | null {
  if (days.length === 0) return null;
  const sum = days.reduce((t, d) => ({ gross: t.gross + d.gross, costs: t.costs + d.costs }), {
    gross: 0,
    costs: 0,
  });
  return lineOfDay({ gross: sum.gross / days.length, costs: sum.costs / days.length });
}

/** The business's pace at `now` (epoch ms, for the Second Floor's real clock). */
export function paceOf(save: SaveData, now: number): Pace {
  const closed = (restaurantDayOf(save).paceDays ?? []).slice(-PACE_AVERAGE_DAYS);
  return {
    days: closed.length,
    last: closed.length > 0 ? lineOfDay(closed[closed.length - 1]!) : null,
    average: averageLine(closed),
    floorPerHour: floorPerHour(save),
    floorWaiting: floorEarnings(save, now),
    floorFill: floorFill(save, now),
    floorOpen: isSecondFloorOpen(restaurantLevelOf(save.levelProgress)),
  };
}
