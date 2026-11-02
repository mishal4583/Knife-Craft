/**
 * The Second Floor's NEXT GOAL (spec 2026-11-02, "the goal is always one to three minutes away"): the purchase with the best
 * payback the player can see now, ranked by price / extra income per hour. Pure and deterministic; the screens show it as a
 * strip with a one-tap buy. Machines that need a higher campaign level are not offered, and a machine is offered only after
 * the one before it is owned (so the strip always points at something real).
 */
import type { SaveData } from "../SaveManager";
import {
  FLOOR_STAFF,
  MAX_POLISH,
  MAX_STATION_LEVEL,
  STATIONS,
  TIER3_MIN_LEVEL,
  floorLevel,
  hourlyWith,
  isSecondFloorOpen,
  isStationUnlocked,
  machinePrice,
  maxTablesAt,
  polishPrice,
  secondFloorOf,
  stationDef,
  stationPerHour,
  tablePrice,
  tierPrice,
  type StationId,
} from "./secondFloor";

/** The short names used in goals and celebrations ("Coffee", not "Smart Coffee & Espresso"). */
export const SHORT: Record<StationId, string> = {
  coffee: "Coffee",
  drinks: "Drinks",
  pizza: "Pizza",
  burger: "Burger",
  iceCream: "Ice Cream",
  hotFood: "Hot Food",
};

export type FloorGoalKind = "machine" | "table" | "polish" | "tier";
export type FloorGoal = {
  kind: FloorGoalKind;
  id: StationId;
  /** "Coffee table #2" */
  label: string;
  /** Price now (cents). */
  price: number;
  /** Extra cents per hour it adds (0 for a machine the Server must run first). */
  gain: number;
  /** The action the screen sends. */
  action:
    | { kind: "buy"; id: StationId }
    | { kind: "table"; id: StationId }
    | { kind: "polish"; id: StationId }
    | { kind: "upgrade"; id: StationId };
};

/** Every purchase the player could make right now (level and room permitting), best payback first. */
export function floorGoals(save: SaveData, reachedLevel: number): FloorGoal[] {
  if (!isSecondFloorOpen(reachedLevel)) return [];
  const floor = secondFloorOf(save);
  const branch = floor.branch ?? 0;
  const out: FloorGoal[] = [];
  STATIONS.forEach((d, i) => {
    const owned = floor.stations[d.id];
    if (!owned) {
      const previousOwned = i === 0 || !!floor.stations[STATIONS[i - 1]!.id];
      if (!previousOwned || !isStationUnlocked(d, floorLevel(reachedLevel))) return;
      const price = machinePrice(d, branch);
      // A machine's own income, as if bought now at one table (the next two are always staffed).
      const probe = {
        ...floor,
        stations: {
          ...floor.stations,
          [d.id]: { level: 1, lastCollectAt: 0, tables: 1, polish: 0 },
        },
      };
      out.push({
        kind: "machine",
        id: d.id,
        label: `${SHORT[d.id]} machine`,
        price,
        gain: stationPerHour(probe, d.id) || hourlyWith(probe, d.id),
        action: { kind: "buy", id: d.id },
      });
      return;
    }
    const tables = owned.tables ?? 1;
    if (tables < maxTablesAt(owned.level))
      out.push({
        kind: "table",
        id: d.id,
        label: `${SHORT[d.id]} table #${tables + 1}`,
        price: tablePrice(d, tables, branch),
        gain: hourlyWith(floor, d.id, { tables: tables + 1 }) - hourlyWith(floor, d.id),
        action: { kind: "table", id: d.id },
      });
    const polish = owned.polish ?? 0;
    if (polish < MAX_POLISH)
      out.push({
        kind: "polish",
        id: d.id,
        label: `${SHORT[d.id]} polish ${polish + 1}`,
        price: polishPrice(d, polish, branch),
        gain: hourlyWith(floor, d.id, { polish: polish + 1 }) - hourlyWith(floor, d.id),
        action: { kind: "polish", id: d.id },
      });
    if (owned.level < MAX_STATION_LEVEL) {
      const to = (owned.level + 1) as 2 | 3;
      if (to === 2 || floorLevel(reachedLevel) >= TIER3_MIN_LEVEL)
        out.push({
          kind: "tier",
          id: d.id,
          label: `${SHORT[d.id]} Tier ${to}`,
          price: tierPrice(d, to, branch),
          gain: hourlyWith(floor, d.id, { level: to }) - hourlyWith(floor, d.id),
          action: { kind: "upgrade", id: d.id },
        });
    }
  });
  void FLOOR_STAFF;
  void stationDef;
  return out
    .filter((g) => g.gain > 0 || g.kind === "machine")
    .sort(
      (a, b) => a.price / Math.max(1, a.gain) - b.price / Math.max(1, b.gain) || a.price - b.price,
    );
}

/**
 * The goal to show: the best-payback purchase the player can afford now (so a tap always works), otherwise the cheapest of the
 * best-paying ones that is still ahead. `credits` should include what is waiting on the floor (it counts toward a price).
 */
export function nextFloorGoal(
  save: SaveData,
  reachedLevel: number,
  credits: number,
): FloorGoal | null {
  const goals = floorGoals(save, reachedLevel);
  if (goals.length === 0) return null;
  const affordable = goals.find((g) => g.price <= credits);
  if (affordable) return affordable;
  // Nothing affordable: the closest goal by price among the three best paybacks.
  return [...goals.slice(0, 3)].sort((a, b) => a.price - b.price)[0]!;
}
