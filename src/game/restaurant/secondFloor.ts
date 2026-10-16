/**
 * The Second Floor — an automated food hall (developer 2026-10-16).
 *
 * Opens at Level 60. Each station is bought once, then upgraded to Lv 3; an
 * owned station earns a fixed amount per REAL hour, even while the game is
 * closed, up to a storage cap (hours of income it can hold). The player
 * collects at the Pickup Counter: one wallet credit, ONE ledger entry
 * ("automation-income"), and every station's timer restarts. Money here is
 * extra on top of the campaign economy (developer decision).
 *
 * Clock rules (the wallet never goes wrong): earnings = min(cap, rate × hours
 * since the last collect); a clock set backwards earns nothing and never
 * goes negative; a jump forward is still capped. Nothing earns before the
 * station is bought. Buying and upgrading are all-or-nothing through
 * `debitWallet`, with one "automation-purchase" ledger entry each.
 *
 * Floor staff (developer 2026-10-16) are permanent, one-time hires — no
 * wages: a Floor Server runs up to 2 stations (an unstaffed station earns
 * nothing); a Floor Cleaner keeps up to 3 stations' tables clear (each
 * missing cleaner costs the floor 25 % of its takings). Hiring first banks
 * what the floor already earned, so a new hire never changes past hours.
 *
 * State lives in `SaveData.business.secondFloor` (absent on older saves =
 * nothing owned, no staff). Times are epoch milliseconds passed in by the caller
 * (`Date.now()` in the app), so this module stays pure and testable.
 */
import type { SaveData } from "../SaveManager";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import { debitWallet } from "../economy/wallet";
import { dollars } from "../money";

export const SECOND_FLOOR_OPENS_AT = 60;

/**
 * Testing switch (developer 2026-10-16): the floor itself is open at any level
 * under `npm run dev`, or on any build opened with `?floor2` in the address
 * (e.g. the Pages test site). Each station still locks until the player
 * reaches its level, as on the first floor (developer 2026-10-16). Prices and
 * the money rules are unchanged. Off in Node (QA) and in a normal release play.
 */
export const SECOND_FLOOR_TEST_UNLOCK: boolean = (() => {
  try {
    const env = (import.meta as { env?: { DEV?: boolean } }).env;
    if (env?.DEV) return true;
    return (
      typeof window !== "undefined" && new URLSearchParams(window.location.search).has("floor2")
    );
  } catch {
    return false;
  }
})();

/** The level used for the floor's own lock (open while testing). */
export function floorLevel(reachedLevel: number): number {
  return SECOND_FLOOR_TEST_UNLOCK ? Number.MAX_SAFE_INTEGER : reachedLevel;
}

/** A station opens at its own level, testing switch or not. */
export function isStationUnlocked(def: { unlockLevel: number }, reachedLevel: number): boolean {
  return reachedLevel >= def.unlockLevel;
}
export const MAX_STATION_LEVEL = 3;
const HOUR_MS = 3_600_000;

export type StationId = "coffee" | "drinks" | "pizza" | "burger" | "iceCream" | "hotFood";

export type StationDefinition = {
  id: StationId;
  name: string;
  icon: string;
  /** What the machines are (one line for the station panel). */
  blurb: string;
  /** Campaign level it can be bought from. */
  unlockLevel: number;
  /** Purchase price (cents). */
  price: number;
  /** Upgrade to Lv 2 and Lv 3 (cents). */
  upgradePrices: readonly [number, number];
  /** Cents earned per real hour at Lv 1, 2, 3. */
  perHour: readonly [number, number, number];
  /** Hours of income the station stores at Lv 1, 2, 3. */
  capHours: readonly [number, number, number];
};

const CAP_HOURS = [8, 10, 12] as const;

/** Provisional numbers (developer 2026-10-16) — tune after play testing. */
export const STATIONS: readonly StationDefinition[] = [
  {
    id: "coffee",
    name: "Smart Coffee & Espresso",
    icon: "☕",
    blurb: "Bean-to-cup machines grind, tamp, brew and steam milk by themselves.",
    unlockLevel: 60,
    price: dollars(3_000),
    upgradePrices: [dollars(4_000), dollars(8_000)],
    perHour: [dollars(15), dollars(30), dollars(50)],
    capHours: CAP_HOURS,
  },
  {
    id: "drinks",
    name: "Drinks Dispenser",
    icon: "🥤",
    blurb: "Touchscreen fountain, juices and mocktails mixed to order.",
    unlockLevel: 70,
    price: dollars(4_000),
    upgradePrices: [dollars(5_000), dollars(10_000)],
    perHour: [dollars(20), dollars(40), dollars(65)],
    capHours: CAP_HOURS,
  },
  {
    id: "pizza",
    name: "Auto Pizza Station",
    icon: "🍕",
    blurb: "A robot arm presses the dough, tops it and bakes a pizza in minutes.",
    unlockLevel: 85,
    price: dollars(6_000),
    upgradePrices: [dollars(8_000), dollars(15_000)],
    perHour: [dollars(30), dollars(60), dollars(100)],
    capHours: CAP_HOURS,
  },
  {
    id: "burger",
    name: "Burger Station",
    icon: "🍔",
    blurb: "Grills the patty, toasts the bun and stacks every burger the same.",
    unlockLevel: 100,
    price: dollars(7_500),
    upgradePrices: [dollars(10_000), dollars(18_000)],
    perHour: [dollars(35), dollars(70), dollars(115)],
    capHours: CAP_HOURS,
  },
  {
    id: "iceCream",
    name: "Ice Cream Station",
    icon: "🍦",
    blurb: "Three soft-serve machines and a topping bar, cones always ready.",
    unlockLevel: 115,
    price: dollars(9_000),
    upgradePrices: [dollars(12_000), dollars(22_000)],
    perHour: [dollars(40), dollars(80), dollars(130)],
    capHours: CAP_HOURS,
  },
  {
    id: "hotFood",
    name: "Hot Food & Fried Items",
    icon: "🍟",
    blurb: "Auto fryers lift, shake and drain fries and wings into warm holding bays.",
    unlockLevel: 130,
    price: dollars(11_000),
    upgradePrices: [dollars(14_000), dollars(26_000)],
    perHour: [dollars(45), dollars(90), dollars(150)],
    capHours: CAP_HOURS,
  },
];

export type OwnedStation = { level: number; lastCollectAt: number };
export type SecondFloorState = {
  stations: Partial<Record<StationId, OwnedStation>>;
  /** Floor Servers hired (permanent). Absent = 0. */
  servers?: number;
  /** Floor Cleaners hired (permanent). Absent = 0. */
  cleaners?: number;
};

export type FloorStaffRole = "server" | "cleaner";

export const FLOOR_STAFF: Record<
  FloorStaffRole,
  { name: string; icon: string; price: number; max: number; covers: number; blurb: string }
> = {
  server: {
    name: "Floor Server",
    icon: "🧑‍🍳",
    price: dollars(1_500),
    max: 3,
    covers: 2,
    blurb: "Runs the pickup counter and carries trays for 2 stations. Hired for good — no wages.",
  },
  cleaner: {
    name: "Floor Cleaner",
    icon: "🧽",
    price: dollars(1_200),
    max: 2,
    covers: 3,
    blurb: "Clears and wipes the tables for 3 stations' guests. Hired for good — no wages.",
  },
};

/** Share of the takings lost per missing cleaner. */
const MISSING_CLEANER_LOSS = 0.25;

const count = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

export function stationDef(id: StationId): StationDefinition {
  return STATIONS.find((s) => s.id === id)!;
}

/** The saved floor (absent on older saves = nothing owned); bad values are dropped. */
export function secondFloorOf(save: SaveData): SecondFloorState {
  const raw = save.business.secondFloor?.stations ?? {};
  const stations: SecondFloorState["stations"] = {};
  for (const def of STATIONS) {
    const s = raw[def.id];
    if (!s) continue;
    const level = Math.min(MAX_STATION_LEVEL, Math.max(1, Math.floor(Number(s.level) || 0)));
    const lastCollectAt = Number.isFinite(s.lastCollectAt) ? s.lastCollectAt : 0;
    stations[def.id] = { level, lastCollectAt };
  }
  const saved = save.business.secondFloor;
  return {
    stations,
    servers: count(saved?.servers, FLOOR_STAFF.server.max),
    cleaners: count(saved?.cleaners, FLOOR_STAFF.cleaner.max),
  };
}

/** Owned stations in catalog order — servers cover them in this order. */
function ownedIds(floor: SecondFloorState): StationId[] {
  return STATIONS.filter((d) => floor.stations[d.id]).map((d) => d.id);
}

/** True when a Floor Server runs this owned station. */
export function isStaffed(floor: SecondFloorState, id: StationId): boolean {
  const i = ownedIds(floor).indexOf(id);
  return i >= 0 && i < (floor.servers ?? 0) * FLOOR_STAFF.server.covers;
}

/** Cleaners the floor needs for its stations, and how many it has. */
export function cleanersNeeded(floor: SecondFloorState): number {
  return Math.ceil(ownedIds(floor).length / FLOOR_STAFF.cleaner.covers);
}
export function serversNeeded(floor: SecondFloorState): number {
  return Math.ceil(ownedIds(floor).length / FLOOR_STAFF.server.covers);
}

/** The share of takings the floor keeps (1 = all tables clear). */
export function cleanFactor(floor: SecondFloorState): number {
  const missing = Math.max(0, cleanersNeeded(floor) - (floor.cleaners ?? 0));
  return Math.max(0, 1 - missing * MISSING_CLEANER_LOSS);
}

function withFloor(save: SaveData, floor: SecondFloorState): SaveData {
  return { ...save, business: { ...save.business, secondFloor: floor } };
}

export function isSecondFloorOpen(reachedLevel: number): boolean {
  return floorLevel(reachedLevel) >= SECOND_FLOOR_OPENS_AT;
}

/** Cents waiting at one owned station at `now` (0 when not owned). */
export function stationEarnings(
  def: StationDefinition,
  owned: OwnedStation | undefined,
  now: number,
): number {
  if (!owned) return 0;
  const i = owned.level - 1;
  const hours = Math.max(0, now - owned.lastCollectAt) / HOUR_MS;
  const capped = Math.min(hours, def.capHours[i]!);
  return Math.floor(capped * def.perHour[i]!);
}

export function stationCap(def: StationDefinition, owned: OwnedStation): number {
  const i = owned.level - 1;
  return def.capHours[i]! * def.perHour[i]!;
}

/** What one station has made for the player at `now`: 0 unstaffed, less with tables uncleared. */
export function stationTakings(floor: SecondFloorState, id: StationId, now: number): number {
  if (!isStaffed(floor, id)) return 0;
  return Math.floor(stationEarnings(stationDef(id), floor.stations[id], now) * cleanFactor(floor));
}

/** Everything waiting on the floor at `now` (cents). */
export function floorEarnings(save: SaveData, now: number): number {
  const floor = secondFloorOf(save);
  return STATIONS.reduce((t, d) => t + stationTakings(floor, d.id, now), 0);
}

/** The floor's real rate (cents per hour): staffed stations, after uncleared tables. */
export function floorPerHour(save: SaveData): number {
  const floor = secondFloorOf(save);
  const gross = STATIONS.reduce((t, d) => {
    const s = floor.stations[d.id];
    return t + (s && isStaffed(floor, d.id) ? d.perHour[s.level - 1]! : 0);
  }, 0);
  return Math.floor(gross * cleanFactor(floor));
}

export type FloorResult =
  | { ok: true; save: SaveData; amount: number }
  | {
      ok: false;
      reason:
        "locked" | "owned" | "notOwned" | "maxLevel" | "insufficientFunds" | "nothing" | "fullTeam";
    };

/**
 * Buys a station (all-or-nothing). What the floor earned so far is banked
 * first (it counts toward the price); the new station's clock starts at `now`.
 */
export function buyStation(
  save: SaveData,
  id: StationId,
  reachedLevel: number,
  now: number,
): FloorResult {
  const def = stationDef(id);
  const floor = secondFloorOf(save);
  if (!isSecondFloorOpen(reachedLevel) || !isStationUnlocked(def, reachedLevel)) {
    return { ok: false, reason: "locked" };
  }
  if (floor.stations[id]) return { ok: false, reason: "owned" };
  // A new station changes who covers what, so the hours so far are banked first.
  const paid = debitWallet(bankFloor(save, now), def.price);
  if (!paid.ok) return { ok: false, reason: "insufficientFunds" };
  const banked = secondFloorOf(paid.save);
  const next = withFloor(paid.save, {
    ...banked,
    stations: { ...banked.stations, [id]: { level: 1, lastCollectAt: now } },
  });
  return {
    ok: true,
    amount: def.price,
    save: appendLedgerEntry(next, "automation-purchase", -def.price, `${id}-buy`),
  };
}

/**
 * Upgrades a station one level (all-or-nothing). Income already earned at
 * the old rate is kept: it is paid into the wallet in the same step (its own
 * "automation-income" entry), so the new rate starts from zero at `now`.
 */
export function upgradeStation(save: SaveData, id: StationId, now: number): FloorResult {
  const def = stationDef(id);
  const floor = secondFloorOf(save);
  const owned = floor.stations[id];
  if (!owned) return { ok: false, reason: "notOwned" };
  if (owned.level >= MAX_STATION_LEVEL) return { ok: false, reason: "maxLevel" };
  const price = def.upgradePrices[owned.level - 1]!;
  const waiting = stationTakings(floor, id, now);
  // The waiting income counts toward the price (it is the player's money).
  const credited = appendLedgerEntry(
    { ...save, credits: save.credits + waiting },
    "automation-income",
    waiting,
    `${id}-collect`,
  );
  const paid = debitWallet(credited, price);
  if (!paid.ok) return { ok: false, reason: "insufficientFunds" };
  const next = withFloor(paid.save, {
    ...floor,
    stations: { ...floor.stations, [id]: { level: owned.level + 1, lastCollectAt: now } },
  });
  return {
    ok: true,
    amount: price,
    save: appendLedgerEntry(next, "automation-purchase", -price, `${id}-lv${owned.level + 1}`),
  };
}

/**
 * Collects everything waiting on the floor: one credit, ONE ledger entry,
 * and every owned station's clock restarts at `now`. Nothing waiting → no
 * change and no entry (a second tap pays nothing).
 */
export function collectFloor(save: SaveData, now: number): FloorResult {
  const amount = floorEarnings(save, now);
  if (amount <= 0) return { ok: false, reason: "nothing" };
  return { ok: true, amount, save: bankFloor(save, now) };
}

/** Pays everything waiting (its own entry, if any) and restarts every clock at `now`. */
function bankFloor(save: SaveData, now: number): SaveData {
  const floor = secondFloorOf(save);
  const amount = floorEarnings(save, now);
  const stations: SecondFloorState["stations"] = {};
  for (const def of STATIONS) {
    const s = floor.stations[def.id];
    if (s) stations[def.id] = { level: s.level, lastCollectAt: now };
  }
  const next = withFloor({ ...save, credits: save.credits + amount }, { ...floor, stations });
  return appendLedgerEntry(next, "automation-income", amount, "floor");
}

/**
 * Hires a permanent Floor Server or Floor Cleaner (one-time price, no
 * wages; all-or-nothing). What the floor earned so far is banked first at
 * the old staffing (and counts toward the price), so the hire only changes
 * the hours from `now` on.
 */
export function hireFloorStaff(save: SaveData, role: FloorStaffRole, now: number): FloorResult {
  const def = FLOOR_STAFF[role];
  const have = role === "server" ? secondFloorOf(save).servers : secondFloorOf(save).cleaners;
  if ((have ?? 0) >= def.max) return { ok: false, reason: "fullTeam" };
  const banked = bankFloor(save, now);
  const paid = debitWallet(banked, def.price);
  if (!paid.ok) return { ok: false, reason: "insufficientFunds" };
  const floor = secondFloorOf(paid.save);
  const next = withFloor(paid.save, {
    ...floor,
    ...(role === "server"
      ? { servers: (floor.servers ?? 0) + 1 }
      : { cleaners: (floor.cleaners ?? 0) + 1 }),
  });
  return {
    ok: true,
    amount: def.price,
    save: appendLedgerEntry(next, "automation-purchase", -def.price, `hire-${role}`),
  };
}
