/**
 * SECOND FLOOR FROM LEVEL 5 — release-gate audit (2026-10-26). Drives the REAL floor functions
 * (restaurant/secondFloor.ts) with a fake clock, starting with exactly the first machine and
 * its Floor Server ($800, what a saver has at about Level 6), and prints the floor's money by
 * real day for three check-in habits and two buyers:
 *   coffeeOnly  Coffee + its server, never anything more (no cleaner: 75 % of the takings);
 *   reinvest    every collection is spent on the floor's fastest payback (the
 *               second-floor-economy-sim player), never on campaign money.
 * "net" = the floor's money minus the $800 it started from (what it added to the wallet).
 * The campaign simulator has no real-time clock, so this is reported beside it, not inside it.
 *
 * Run: npx tsx scripts/second-floor-early-sim.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FLOOR_STAFF,
  MAX_STATION_LEVEL,
  STATIONS,
  buyStation,
  cleanersNeeded,
  collectFloor,
  hireFloorStaff,
  secondFloorOf,
  serversNeeded,
  upgradeStation,
  type FloorResult,
  type StationId,
} from "../src/game/restaurant/secondFloor.ts";

const DAY = 24 * 3_600_000;
const LEVEL = 60; // any open level: every station is on sale from Level 5
const START = STATIONS[0]!.price + FLOOR_STAFF.server.price;
export const DAYS = [1, 7, 11, 18, 29, 49] as const;

type Option = { kind: "buy" | "upgrade"; id: StationId; price: number; gain: number };
function options(save: SaveData): Option[] {
  const floor = secondFloorOf(save);
  const out: Option[] = [];
  for (const d of STATIONS) {
    const o = floor.stations[d.id];
    if (!o) out.push({ kind: "buy", id: d.id, price: d.price, gain: d.perHour[0] });
    else if (o.level < MAX_STATION_LEVEL)
      out.push({
        kind: "upgrade",
        id: d.id,
        price: d.upgradePrices[o.level - 1]!,
        gain: d.perHour[o.level]! - d.perHour[o.level - 1]!,
      });
  }
  return out.sort((a, b) => a.price / a.gain - b.price / b.gain);
}

export function floorByDay(
  checkInsPerDay: number,
  mode: "coffeeOnly" | "reinvest",
): Record<number, { earned: number; net: number }> {
  const start = 1_900_000_000_000;
  let save: SaveData = { ...structuredClone(DEFAULT_SAVE), credits: START };
  let earned = 0;
  const out: Record<number, { earned: number; net: number }> = {};
  const step = DAY / checkInsPerDay;
  for (let t = start; t <= start + DAYS[DAYS.length - 1]! * DAY; t += step) {
    const c = collectFloor(save, t);
    if (c.ok) {
      save = c.save;
      earned += c.amount;
    }
    for (let guard = 0; guard < 20; guard++) {
      const floor = secondFloorOf(save);
      const owned = Object.keys(floor.stations).length;
      let r: FloorResult | null = null;
      if (owned > 0 && (floor.servers ?? 0) < serversNeeded(floor))
        r = hireFloorStaff(save, "server", t);
      else if (mode === "coffeeOnly") {
        if (owned === 0) r = buyStation(save, "coffee", LEVEL, t);
      } else if (owned > 0 && (floor.cleaners ?? 0) < cleanersNeeded(floor))
        r = hireFloorStaff(save, "cleaner", t);
      else {
        const best = options(save).find((o) => o.price <= save.credits);
        if (!best) break;
        const needsServer =
          best.kind === "buy" &&
          Math.ceil((owned + 1) / FLOOR_STAFF.server.covers) > (floor.servers ?? 0);
        if (needsServer && best.price + FLOOR_STAFF.server.price > save.credits) break;
        r =
          best.kind === "buy"
            ? buyStation(save, best.id, LEVEL, t)
            : upgradeStation(save, best.id, t);
      }
      if (!r || !r.ok) break;
      save = r.save;
    }
    const day = (t - start) / DAY;
    if ((DAYS as readonly number[]).includes(day)) out[day] = { earned, net: save.credits - START };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const $ = (c: number) =>
    `${c < 0 ? "−" : ""}$${Math.round(Math.abs(c) / 100).toLocaleString("en-US")}`;
  for (const k of [1, 2, 4])
    for (const mode of ["coffeeOnly", "reinvest"] as const) {
      const r = floorByDay(k, mode);
      console.log(
        `${k}/day ${mode.padEnd(10)} ` +
          DAYS.map((d) => `d${d} ${$(r[d]!.earned)} (net ${$(r[d]!.net)})`).join(" · "),
      );
    }
}
