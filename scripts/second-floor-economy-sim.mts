/**
 * SECOND FLOOR ECONOMY SIM — the automated food hall's money over real time
 * (developer 2026-10-16: "plan the upgrading cost and everything, and also
 * income"). Drives the REAL functions (restaurant/secondFloor.ts: buyStation,
 * upgradeStation, hireFloorStaff, collectFloor) with a fake clock.
 *
 * Players (all start the day they reach Level 60, with enough campaign money
 * for the first machine and its Floor Server; after that the floor pays for
 * itself — every later buy comes from its own takings):
 *   casual   1 check-in a day
 *   regular  2 check-ins a day (morning and evening)
 *   heavy    4 check-ins a day
 * At each check-in: Collect, then buy what pays back fastest (a Floor Server
 * first when a station would stand idle, a Floor Cleaner when one is missing).
 *
 * Prints, per player: the day the floor is complete (all six at Lv 3, full
 * team), what it has earned by day 18 (a 5-levels-a-day player finishes the
 * campaign then) and day 60, and the payback of every purchase in hours.
 *
 * Run: npx tsx scripts/second-floor-economy-sim.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FLOOR_STAFF,
  MAX_STATION_LEVEL,
  STATIONS,
  buyStation,
  cleanersNeeded,
  collectFloor,
  floorPerHour,
  hireFloorStaff,
  secondFloorOf,
  serversNeeded,
  upgradeStation,
  type StationId,
} from "../src/game/restaurant/secondFloor.ts";

const H = 3_600_000;
const DAY = 24 * H;
const LEVEL = 60;

export type FloorSimResult = {
  profile: string;
  completeDay: number | null;
  earnedBy: Record<number, number>;
  spent: number;
  perHourAtEnd: number;
};

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
  // Fastest payback first.
  return out.sort((a, b) => a.price / a.gain - b.price / b.gain);
}

export function simulateFloor(profile: string, checkInsPerDay: number, days = 120): FloorSimResult {
  const start = 1_900_000_000_000;
  const first = STATIONS[0]!;
  let save: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    credits: first.price + FLOOR_STAFF.server.price,
  };
  let spent = 0;
  let earned = 0;
  const earnedBy: Record<number, number> = {};
  let completeDay: number | null = null;
  const step = DAY / checkInsPerDay;
  for (let t = start, i = 0; t <= start + days * DAY; t += step, i++) {
    const c = collectFloor(save, t);
    if (c.ok) {
      save = c.save;
      earned += c.amount;
    }
    // Spend: staff first when needed, then the fastest payback that is affordable.
    for (let guard = 0; guard < 20; guard++) {
      const floor = secondFloorOf(save);
      const owned = Object.keys(floor.stations).length;
      let r = null;
      if (owned > 0 && (floor.servers ?? 0) < serversNeeded(floor))
        r = hireFloorStaff(save, "server", t);
      else if (owned > 0 && (floor.cleaners ?? 0) < cleanersNeeded(floor))
        r = hireFloorStaff(save, "cleaner", t);
      else {
        const best = options(save).find((o) => o.price <= save.credits);
        if (!best) break;
        // A new station needs its server's money too before it can earn.
        const f = secondFloorOf(save);
        const needsServer =
          best.kind === "buy" &&
          Math.ceil((owned + 1) / FLOOR_STAFF.server.covers) > (f.servers ?? 0);
        if (needsServer && best.price + FLOOR_STAFF.server.price > save.credits) break;
        r =
          best.kind === "buy"
            ? buyStation(save, best.id, LEVEL, t)
            : upgradeStation(save, best.id, t);
      }
      if (!r || !r.ok) break;
      spent += save.credits - r.save.credits > 0 ? save.credits - r.save.credits : 0;
      save = r.save;
    }
    const day = Math.floor((t - start) / DAY);
    for (const d of [18, 30, 60, 120])
      if (day === d && earnedBy[d] === undefined) earnedBy[d] = earned;
    const floor = secondFloorOf(save);
    const done =
      STATIONS.every((d) => floor.stations[d.id]?.level === MAX_STATION_LEVEL) &&
      (floor.servers ?? 0) >= serversNeeded(floor) &&
      (floor.cleaners ?? 0) >= cleanersNeeded(floor);
    if (done && completeDay === null) completeDay = Math.round(((t - start) / DAY) * 10) / 10;
  }
  return { profile, completeDay, earnedBy, spent, perHourAtEnd: floorPerHour(save) };
}

/** Payback of each purchase in staffed earning hours (price ÷ the $/h it adds). */
export function paybackTable() {
  return STATIONS.map((d) => ({
    id: d.id,
    buy: d.price / d.perHour[0],
    up2: d.upgradePrices[0] / (d.perHour[1] - d.perHour[0]),
    up3: d.upgradePrices[1] / (d.perHour[2] - d.perHour[1]),
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const $ = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
  console.log("Payback in earning hours (price ÷ $/h added):");
  for (const p of paybackTable())
    console.log(
      `  ${p.id.padEnd(9)} buy ${p.buy.toFixed(0).padStart(4)} h · Lv2 ${p.up2.toFixed(0).padStart(4)} h · Lv3 ${p.up3.toFixed(0).padStart(4)} h`,
    );
  const total =
    STATIONS.reduce((t, d) => t + d.price + d.upgradePrices[0] + d.upgradePrices[1], 0) +
    FLOOR_STAFF.server.max * FLOOR_STAFF.server.price +
    FLOOR_STAFF.cleaner.max * FLOOR_STAFF.cleaner.price;
  const topRate = STATIONS.reduce((t, d) => t + d.perHour[2], 0);
  console.log(
    `Full floor: costs ${$(total)} · earns ${$(topRate)}/h at Lv 3 (all staffed and clean)`,
  );
  for (const [name, k] of [
    ["casual", 1],
    ["regular", 2],
    ["heavy", 4],
  ] as const) {
    const r = simulateFloor(name, k);
    console.log(
      `  ${name.padEnd(8)} complete on day ${r.completeDay ?? "—"} · earned by day 18 ${$(r.earnedBy[18] ?? 0)}, day 30 ${$(r.earnedBy[30] ?? 0)}, day 60 ${$(r.earnedBy[60] ?? 0)} · ${$(r.perHourAtEnd)}/h at day 120`,
    );
  }
}
