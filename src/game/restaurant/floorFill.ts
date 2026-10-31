/**
 * HOW FULL THE SECOND FLOOR IS (idle phase 5B, developer 2026-10-31): the floor stores up to
 * 8 / 9 / 10 hours of takings per station (secondFloor.ts, `capHours`) and then stops. These are
 * the read-only numbers the screens show so the player can feel it fill: a fraction, the time to
 * full and a short "full in" text.
 *
 * Real hours, as the floor earns (developer 2026-10-31: "let the second floor stay real hours").
 * Pure: the caller passes `now` (epoch ms); no save field, no wallet, no ledger.
 */
import type { SaveData } from "../SaveManager";
import {
  STATIONS,
  isStaffed,
  secondFloorOf,
  stationDef,
  type SecondFloorState,
  type StationId,
} from "./secondFloor";

const HOUR_MS = 3_600_000;

/** At or above this share of the cap the floor is "nearly full" (the map nudges the player). */
export const FLOOR_NEARLY_FULL = 0.8;

export type Fill = {
  /** 0..1 of the station's cap (hours stored ÷ cap hours). */
  fraction: number;
  /** Ms until it stops earning (0 when full). */
  msToFull: number;
  full: boolean;
};

/** One working station's fill, or null when it is not owned or has no Floor Server (it stores nothing). */
export function stationFill(floor: SecondFloorState, id: StationId, now: number): Fill | null {
  const owned = floor.stations[id];
  if (!owned || !isStaffed(floor, id)) return null;
  const capHours = stationDef(id).capHours[owned.level - 1]!;
  const hours = Math.max(0, now - owned.lastCollectAt) / HOUR_MS;
  const fraction = Math.min(1, hours / capHours);
  return {
    fraction,
    msToFull: Math.max(0, Math.round((capHours - hours) * HOUR_MS)),
    full: hours >= capHours,
  };
}

/**
 * The whole floor: the average fill of its working stations, and the time until the FIRST one
 * stops earning (that is when waiting starts to cost money). Null when nothing is working.
 */
export function floorFill(save: SaveData, now: number): Fill | null {
  const floor = secondFloorOf(save);
  const fills = STATIONS.map((d) => stationFill(floor, d.id, now)).filter(
    (f): f is Fill => f !== null,
  );
  if (fills.length === 0) return null;
  const open = fills.filter((f) => !f.full);
  return {
    fraction: fills.reduce((t, f) => t + f.fraction, 0) / fills.length,
    msToFull: open.length === 0 ? 0 : Math.min(...open.map((f) => f.msToFull)),
    full: open.length === 0,
  };
}

/** "2 h 10 min", "45 min", "under a minute": how long until a station is full. */
export function durationText(ms: number): string {
  if (ms < 60_000) return "under a minute";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The short line under a bar: "Full · not earning" or "Full in 2 h 10 min". */
export function fillText(fill: Fill): string {
  return fill.full ? "Full · not earning" : `Full in ${durationText(fill.msToFull)}`;
}

/** The floor needs a visit: nearly full or full. */
export const needsVisit = (fill: Fill | null): boolean =>
  !!fill && (fill.full || fill.fraction >= FLOOR_NEARLY_FULL);
