/**
 * The Second Floor — an automated food hall (developer 2026-10-16), rebuilt 2026-11-02 as a customer-cycle idle economy
 * (spec: docs/planning/SECOND-FLOOR-FINAL-SPEC-2026-11-02.md; engagement and ads: ...-ENGAGEMENT-AND-ADS-DESIGN-...).
 *
 * Opens at Level 3. Each station is a machine the player buys once (its own campaign level, `unlockLevel`), then grows:
 *  - TABLES: guests per cycle = √tables (a fixed lookup, never Math.sqrt at run time), x1.25 from 5 tables, x1.5 from 10;
 *    room for 6 / 8 / 10 tables at Tier 1 / 2 / 3.
 *  - POLISH: ten cheap upgrades (+6 % of the station's income each) so there is always something affordable to buy.
 *  - TIERS: Tier 2 and Tier 3 (guest pays x1.25 / x1.5, cycle x0.94 / x0.90). Tier 3 needs Level 30.
 *  - BRANCHES (Franchise): when every station is Tier 3 with 8+ tables the player may open a new branch: the stations reset,
 *    prices and guest payouts are x10, and every finished branch gives a permanent +50 % income. The wallet and ledger
 *    are untouched by a reset.
 *
 * Money rules (the wallet never goes wrong): a station makes one customer cycle at a time; cycles done =
 * min(floor(elapsed / cycle), cap). Each cycle pays an INTEGER number of mills (1/1000 of a cent); the pile is
 * floor(total mills / 1000) cents and is paid with ONE "automation-income" ledger entry. The station's clock is
 * carried forward by whole cycles (`now - elapsed % cycle`), so a collection never throws away a part-finished cycle and
 * the anchor never moves backwards. A clock set back earns nothing. Online equals offline.
 *
 * Staff: the first two machines are self-serve (nothing to hire). A Floor Server runs the next two machines; without one a
 * machine works at half speed and holds only a 10-minute tray. A Floor Cleaner adds +10 % income to the floor (one per
 * three machines) and NEVER lowers it (or the popularity) when missing (developer rev 3). Staff are permanent hires.
 *
 * State lives in `SaveData.business.secondFloor` (nested, no new top-level field); every new field is optional, so older
 * saves read as one table, no polish, branch 0. Times are epoch milliseconds passed in by the caller.
 */
import type { SaveData } from "../SaveManager";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import { debitWallet } from "../economy/wallet";
import { dollars } from "../money";

/** Players can visit the floor from this level (developer 2026-11-02: Level 3; was 5). */
export const SECOND_FLOOR_OPENS_AT = 3;
/** The first machine can be bought from this level; each later one has its own `unlockLevel`. */
export const STATIONS_OPEN_AT = SECOND_FLOOR_OPENS_AT;
/** Tier 3 needs this campaign level. */
export const TIER3_MIN_LEVEL = 30;

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

/* ── the tuning tables (integers only; no floating point at run time) ── */

/** Tables a station seats at Tier 1 / 2 / 3. */
export const MAX_TABLES_BY_TIER = [6, 8, 10] as const;
export const MAX_POLISH = 10;
/** Share of a station's income each Polish step adds, in permille (+6 %). */
export const POLISH_PERMILLE = 60;
/** Polish step 1 costs 8 % of the machine price, each next step x1.30. */
const POLISH_FIRST_PERCENT = 8;
const POLISH_GROWTH_PERMILLE = 1300;
/** Guests per cycle at 0..10 tables, permille: round(1000 x sqrt(n)). */
const GUESTS_PERMILLE = [0, 1000, 1414, 1732, 2000, 2236, 2449, 2646, 2828, 3000, 3162] as const;
/** Tier pay / cycle multipliers, permille. */
const TIER_PAY_PERMILLE = [1000, 1250, 1500] as const;
const TIER_CYCLE_PERMILLE = [1000, 940, 900] as const;
/** Counter caps (hours of guests a staffed station holds) at Tier 1 / 2 / 3. */
const CAP_HOURS = [4, 5, 6] as const;
/** An unstaffed station works at half speed and keeps only this many minutes of guests. */
export const UNSTAFFED_SPEED_PERMILLE = 500;
export const UNSTAFFED_TRAY_MS = 10 * 60_000;
/** Machines that are self-serve (never need a Server). */
export const SELF_SERVE_MACHINES = 2;
/** Cleaner income bonus, permille per cleaner (up to the cleaners the floor needs). */
export const CLEANER_PERMILLE = 100;
/**
 * Branches: prices and payouts x10 each; +50 % income per finished branch. The last branch is number 5 (six in all): a full counter
 * of the best floor at branch 5 is 1.5e15 mills, and every money value in this file must stay an EXACT integer (below 2^53, about
 * 9.0e15). At branch 6 that pile is already 1.7e16 mills and at branch 9 one single cycle is 2e16, so money would silently lose
 * precision: found in the 2026-11-03 review (the earlier limit of 9 was wrong, and its test only repeated the constant).
 * Developer 2026-11-03 ("do whats best"): keep this cap rather than swap the wallet for big numbers; the view says "final branch".
 */
export const MAX_BRANCH = 5;
export const BRANCH_BONUS_PERMILLE = 500;
/** Rush Hour: stations work this many times as fast; full Hype (100) starts a free Rush of this length. */
export const RUSH_SPEED = 3;
export const HYPE_MAX = 100;
export const HYPE_RUSH_MS = 3 * 60_000;
/** To open a branch every station needs Tier 3 and at least this many tables. */
export const FRANCHISE_MIN_TABLES = 8;

export type StationDefinition = {
  id: StationId;
  name: string;
  icon: string;
  /** What the machines are (one line for the station panel). */
  blurb: string;
  /** Campaign level it can be bought from. */
  unlockLevel: number;
  /** Purchase price (cents), branch 0. */
  price: number;
  /** Upgrade to Tier 2 and Tier 3 (cents), branch 0. */
  upgradePrices: readonly [number, number];
  /** Cents per real hour at Tier 1 / 2 / 3 with ONE table, no polish, staffed, branch 0 (derived; for the list rows). */
  perHour: readonly [number, number, number];
  /** Hours of income the counter holds at Tier 1 / 2 / 3. */
  capHours: readonly [number, number, number];
  /** Tier 1 seconds per customer cycle and what one guest pays (cents). */
  cycleSeconds: number;
  guestCents: number;
  /** Table #2 price (cents) and the cost growth per extra table, permille. */
  tableBase: number;
  tableGrowthPermille: number;
};

type Raw = Omit<StationDefinition, "perHour" | "capHours">;
const RAW: readonly Raw[] = [
  {
    id: "coffee",
    name: "Smart Coffee & Espresso",
    icon: "☕",
    blurb: "Bean-to-cup machines grind, tamp, brew and steam milk by themselves.",
    unlockLevel: 3,
    price: dollars(500),
    upgradePrices: [dollars(1500), dollars(4500)],
    cycleSeconds: 12,
    guestCents: 20,
    tableBase: dollars(60),
    tableGrowthPermille: 1500,
  },
  {
    id: "drinks",
    name: "Drinks Dispenser",
    icon: "🥤",
    blurb: "Touchscreen fountain, juices and mocktails mixed to order.",
    unlockLevel: 5,
    price: dollars(1000),
    upgradePrices: [dollars(3000), dollars(9000)],
    cycleSeconds: 18,
    guestCents: 40,
    tableBase: dollars(120),
    tableGrowthPermille: 1470,
  },
  {
    id: "pizza",
    name: "Auto Pizza Station",
    icon: "🍕",
    blurb: "A robot arm presses the dough, tops it and bakes a pizza in minutes.",
    unlockLevel: 8,
    price: dollars(1500),
    upgradePrices: [dollars(4500), dollars(13500)],
    cycleSeconds: 30,
    guestCents: 80,
    tableBase: dollars(180),
    tableGrowthPermille: 1450,
  },
  {
    id: "burger",
    name: "Burger Station",
    icon: "🍔",
    blurb: "Grills the patty, toasts the bun and stacks every burger the same.",
    unlockLevel: 12,
    price: dollars(2000),
    upgradePrices: [dollars(6000), dollars(18000)],
    cycleSeconds: 45,
    guestCents: 130,
    tableBase: dollars(240),
    tableGrowthPermille: 1420,
  },
  {
    id: "iceCream",
    name: "Ice Cream Station",
    icon: "🍦",
    blurb: "Three soft-serve machines and a topping bar, cones always ready.",
    unlockLevel: 17,
    price: dollars(2500),
    upgradePrices: [dollars(7500), dollars(22500)],
    cycleSeconds: 65,
    guestCents: 200,
    tableBase: dollars(300),
    tableGrowthPermille: 1400,
  },
  {
    id: "hotFood",
    name: "Hot Food & Fried Items",
    icon: "🍟",
    blurb: "Auto fryers lift, shake and drain fries and wings into warm holding bays.",
    unlockLevel: 23,
    price: dollars(4000),
    upgradePrices: [dollars(12000), dollars(36000)],
    cycleSeconds: 100,
    guestCents: 320,
    tableBase: dollars(480),
    tableGrowthPermille: 1380,
  },
];

/** Mills (1/1000 cent) one guest-cycle pays at a tier, ONE table, no polish, branch 0: sequential integer floors. */
function baseMills(raw: Raw, tier: number): number {
  return Math.floor((raw.guestCents * 1000 * TIER_PAY_PERMILLE[tier - 1]!) / 1000);
}
const cycleMsOfRaw = (raw: Raw, tier: number) =>
  Math.round((raw.cycleSeconds * 1000 * TIER_CYCLE_PERMILLE[tier - 1]!) / 1000);
const hourlyCents = (raw: Raw, tier: number) =>
  Math.round((baseMills(raw, tier) * (HOUR_MS / cycleMsOfRaw(raw, tier))) / 1000);

export const STATIONS: readonly StationDefinition[] = RAW.map((r) => ({
  ...r,
  perHour: [hourlyCents(r, 1), hourlyCents(r, 2), hourlyCents(r, 3)] as const,
  capHours: CAP_HOURS,
}));

export type OwnedStation = {
  /** Tier 1-3 (the saved name stays `level`: older saves). */
  level: number;
  lastCollectAt: number;
  /** Tables, 1..10 (absent = 1). */
  tables?: number;
  /** Polish steps, 0..10 (absent = 0). */
  polish?: number;
};
export type SecondFloorState = {
  stations: Partial<Record<StationId, OwnedStation>>;
  /** Floor Servers hired (permanent). Absent = 0. */
  servers?: number;
  /** Floor Cleaners hired (permanent). Absent = 0. */
  cleaners?: number;
  /** Branches finished (Franchise). Absent = 0. */
  branch?: number;
  /** Extra cents lying on the Pickup Counter on top of the machines' cycles (Flood). Paid with the next collect. */
  bonus?: number;
  /** The level id whose Flood was already added, so one level never floods twice. */
  floodTag?: string;
  /** The last Golden Guest slot already paid (restaurant/goldenGuest.ts), so one VIP is never paid twice. */
  goldenSlot?: number;
  /** Hype 0..100 (filled by a well-cooked service); full Hype starts a free Rush. */
  hype?: number;
  /** Rush Hour: between these two moments (epoch ms) every station works RUSH_SPEED times as fast. */
  rushFrom?: number;
  rushUntil?: number;
};

export type FloorStaffRole = "server" | "cleaner";

export const FLOOR_STAFF: Record<
  FloorStaffRole,
  {
    name: string;
    icon: string;
    /** First hire's price (cents, branch 0); `prices` lists every hire. */
    price: number;
    prices: readonly number[];
    max: number;
    covers: number;
    blurb: string;
  }
> = {
  server: {
    name: "Floor Server",
    icon: "🤵", // the fallback; the portrait is public/business/staff-portraits/floor-server.webp
    price: dollars(1200),
    prices: [dollars(1200), dollars(6000)],
    max: 2,
    covers: 2,
    blurb:
      "Runs the pickup counter for 2 more machines (the first 2 are self-serve). Hired for good — no wages.",
  },
  cleaner: {
    name: "Floor Cleaner",
    icon: "🧹", // the fallback; the portrait is public/business/staff-portraits/floor-cleaner.webp
    price: dollars(600),
    prices: [dollars(600), dollars(3000)],
    max: 2,
    covers: 3,
    blurb: "Keeps 3 machines' tables sparkling: +10 % income each. Hired for good — no wages.",
  },
};

const count = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
const pow10 = (n: number) => 10 ** n;

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
    const maxTables = MAX_TABLES_BY_TIER[MAX_STATION_LEVEL - 1]!;
    const tables = Math.min(maxTables, Math.max(1, Math.floor(Number(s.tables) || 1)));
    const polish = Math.min(MAX_POLISH, Math.max(0, Math.floor(Number(s.polish) || 0)));
    stations[def.id] = { level, lastCollectAt, tables, polish };
  }
  const saved = save.business.secondFloor;
  return {
    stations,
    // Older saves could hold three Servers: they are kept (no refunds, nothing taken away).
    servers: count(saved?.servers, 3),
    cleaners: count(saved?.cleaners, FLOOR_STAFF.cleaner.max),
    branch: count(saved?.branch, MAX_BRANCH),
    bonus: Math.max(0, Math.floor(Number(saved?.bonus) || 0)),
    ...(typeof saved?.floodTag === "string" ? { floodTag: saved.floodTag } : {}),
    ...(Number.isFinite(saved?.goldenSlot) ? { goldenSlot: Math.floor(saved!.goldenSlot!) } : {}),
    hype: Math.min(HYPE_MAX, Math.max(0, Math.floor(Number(saved?.hype) || 0))),
    ...(Number.isFinite(saved?.rushFrom) &&
    Number.isFinite(saved?.rushUntil) &&
    saved!.rushUntil! > saved!.rushFrom!
      ? { rushFrom: Math.floor(saved!.rushFrom!), rushUntil: Math.floor(saved!.rushUntil!) }
      : {}),
  };
}

/** Owned stations in catalog order — servers cover them in this order. */
function ownedIds(floor: SecondFloorState): StationId[] {
  return STATIONS.filter((d) => floor.stations[d.id]).map((d) => d.id);
}

/** True when a Floor Server (or self-service) runs this owned station. */
export function isStaffed(floor: SecondFloorState, id: StationId): boolean {
  const i = ownedIds(floor).indexOf(id);
  if (i < 0) return false;
  return i < SELF_SERVE_MACHINES + (floor.servers ?? 0) * FLOOR_STAFF.server.covers;
}

/** Cleaners the floor could use for its machines, and Servers it needs. */
export function cleanersNeeded(floor: SecondFloorState): number {
  return Math.ceil(ownedIds(floor).length / FLOOR_STAFF.cleaner.covers);
}
export function serversNeeded(floor: SecondFloorState): number {
  return Math.ceil(
    Math.max(0, ownedIds(floor).length - SELF_SERVE_MACHINES) / FLOOR_STAFF.server.covers,
  );
}

/**
 * The floor's income multiplier from its Cleaners (1 = none, 1.1 = one cleaner, ...). A missing Cleaner costs NOTHING:
 * it is only a bonus (developer rev 3: cleaners never reduce popularity or income).
 */
export function cleanFactor(floor: SecondFloorState): number {
  return 1 + (CLEANER_PERMILLE * Math.min(floor.cleaners ?? 0, cleanersNeeded(floor))) / 1000;
}
const cleanerPermille = (floor: SecondFloorState) =>
  1000 + CLEANER_PERMILLE * Math.min(floor.cleaners ?? 0, cleanersNeeded(floor));

/** Branch scaling: prices and guest payouts x10 per branch; +50 % income per finished branch. */
export const branchPriceScale = (branch: number) => pow10(count(branch, MAX_BRANCH));
export const branchIncomePermille = (branch: number) =>
  1000 + BRANCH_BONUS_PERMILLE * count(branch, MAX_BRANCH);

/* ── what things cost ── */

/** Machine price now (cents). */
export const machinePrice = (def: StationDefinition, branch = 0) =>
  def.price * branchPriceScale(branch);
/** Tier 2 / Tier 3 price (the tier being bought, 2 or 3). */
export const tierPrice = (def: StationDefinition, toTier: 2 | 3, branch = 0) =>
  def.upgradePrices[toTier - 2]! * branchPriceScale(branch);
/** Price of the NEXT table when `owned` tables are seated (owned 1 -> table #2). */
export function tablePrice(def: StationDefinition, owned: number, branch = 0): number {
  let p = def.tableBase;
  for (let k = 1; k < owned; k++) p = Math.round((p * def.tableGrowthPermille) / 1000);
  return p * branchPriceScale(branch);
}
/** Price of the NEXT Polish step when `done` steps are bought (done 0 -> step 1). */
export function polishPrice(def: StationDefinition, done: number, branch = 0): number {
  let p = Math.round((def.price * POLISH_FIRST_PERCENT) / 100);
  for (let k = 0; k < done; k++) p = Math.round((p * POLISH_GROWTH_PERMILLE) / 1000);
  return p * branchPriceScale(branch);
}
/** A Floor Server / Cleaner's price now. */
export function staffPrice(role: FloorStaffRole, hired: number, branch = 0): number {
  const list = FLOOR_STAFF[role].prices;
  return list[Math.min(hired, list.length - 1)]! * branchPriceScale(branch);
}

/* ── what a station makes ── */

/** Tables a station seats at its tier. */
export const maxTablesAt = (tier: number) =>
  MAX_TABLES_BY_TIER[Math.min(3, Math.max(1, tier)) - 1]!;
const milestonePermille = (tables: number) => (tables >= 10 ? 1500 : tables >= 5 ? 1250 : 1000);

/** Milliseconds of one customer cycle. */
export function cycleMs(def: StationDefinition, tier: number, staffed: boolean): number {
  const base = cycleMsOfRaw(def, tier);
  return staffed ? base : Math.round((base * 1000) / UNSTAFFED_SPEED_PERMILLE);
}

/**
 * Mills (1/1000 cent) one cycle pays: the tier's guest price x guests (√tables) x milestone x polish x cleaners, every
 * step an integer floor, then x10 per branch and +50 % per finished branch.
 */
export function millsPerCycle(
  def: StationDefinition,
  owned: Pick<OwnedStation, "level" | "tables" | "polish">,
  floor: SecondFloorState,
): number {
  const tables = Math.min(10, Math.max(1, owned.tables ?? 1));
  let m = baseMills(
    RAW.find((r) => r.id === def.id)!,
    owned.level,
  );
  m = Math.floor((m * GUESTS_PERMILLE[tables]!) / 1000);
  m = Math.floor((m * milestonePermille(tables)) / 1000);
  m = Math.floor((m * (1000 + POLISH_PERMILLE * (owned.polish ?? 0))) / 1000);
  m = Math.floor((m * cleanerPermille(floor)) / 1000);
  const b = floor.branch ?? 0;
  m = m * branchPriceScale(b);
  m = Math.floor((m * branchIncomePermille(b)) / 1000);
  return m;
}

/** Milliseconds of Rush Hour inside [from, to]. */
function rushOverlap(floor: SecondFloorState, from: number, to: number): number {
  if (floor.rushFrom === undefined || floor.rushUntil === undefined) return 0;
  return Math.max(0, Math.min(to, floor.rushUntil) - Math.max(from, floor.rushFrom));
}

/** Station-time that passed between `anchor` and `now`: real time, with the Rush part counted RUSH_SPEED times. */
function effectiveElapsed(floor: SecondFloorState, anchor: number, now: number): number {
  const real = Math.max(0, now - anchor);
  return real + (RUSH_SPEED - 1) * rushOverlap(floor, anchor, now);
}

/**
 * The anchor that leaves exactly `rest` milliseconds of part-finished cycle at `now` (the inverse of `effectiveElapsed`):
 * walks back through the time after the Rush, the Rush itself and the time before it. Rounded to whole milliseconds.
 */
function anchorForRest(floor: SecondFloorState, rest: number, now: number): number {
  const segments: [number, number, number][] = [];
  if (floor.rushFrom !== undefined && floor.rushUntil !== undefined && now > floor.rushFrom) {
    const rushEnd = Math.min(now, floor.rushUntil);
    if (now > rushEnd) segments.push([now, rushEnd, 1]);
    segments.push([rushEnd, floor.rushFrom, RUSH_SPEED]);
    segments.push([floor.rushFrom, -Infinity, 1]);
  } else {
    segments.push([now, -Infinity, 1]);
  }
  let remaining = rest;
  for (const [end, start, speed] of segments) {
    const eff = (end - start) * speed;
    if (remaining <= eff) return Math.round(end - remaining / speed);
    remaining -= eff;
  }
  return now;
}

/** Whole cycles a station has finished at `now`, capped by what its counter holds. */
export function stationCycles(floor: SecondFloorState, id: StationId, now: number): number {
  const owned = floor.stations[id];
  if (!owned) return 0;
  const def = stationDef(id);
  const staffed = isStaffed(floor, id);
  const c = cycleMs(def, owned.level, staffed);
  const capMs = staffed ? def.capHours[owned.level - 1]! * HOUR_MS : UNSTAFFED_TRAY_MS;
  const capCycles = Math.floor(capMs / c);
  const elapsed = effectiveElapsed(floor, owned.lastCollectAt, now);
  return Math.min(Math.floor(elapsed / c), capCycles);
}

/**
 * How full a staffed or tray-only station's counter is, in station time: `effMs` has passed since its clock (Rush counted x3), the
 * counter holds `capMs` (a whole number of cycles). The screens' fill bar and "Full in ..." read this (floorFill.ts).
 */
export function stationFillMs(
  floor: SecondFloorState,
  id: StationId,
  now: number,
): { effMs: number; capMs: number; speed: number; rushLeftMs: number } | null {
  const owned = floor.stations[id];
  if (!owned) return null;
  const def = stationDef(id);
  const staffed = isStaffed(floor, id);
  const c = cycleMs(def, owned.level, staffed);
  const holdMs = staffed ? def.capHours[owned.level - 1]! * HOUR_MS : UNSTAFFED_TRAY_MS;
  return {
    effMs: effectiveElapsed(floor, owned.lastCollectAt, now),
    capMs: Math.floor(holdMs / c) * c,
    speed: rushActive(floor, now) ? RUSH_SPEED : 1,
    rushLeftMs: rushLeftMs(floor, now),
  };
}

/** Mills waiting at one station. */
export function stationMills(floor: SecondFloorState, id: StationId, now: number): number {
  const owned = floor.stations[id];
  if (!owned) return 0;
  return stationCycles(floor, id, now) * millsPerCycle(stationDef(id), owned, floor);
}

/** Cents waiting at one owned station at `now` (whole cents; the floor's pile adds the mills first). */
export function stationTakings(floor: SecondFloorState, id: StationId, now: number): number {
  return Math.floor(stationMills(floor, id, now) / 1000);
}

/** The most one station's counter holds (cents). */
export function stationCap(floor: SecondFloorState, id: StationId): number {
  const owned = floor.stations[id];
  if (!owned) return 0;
  const def = stationDef(id);
  const staffed = isStaffed(floor, id);
  const c = cycleMs(def, owned.level, staffed);
  const capMs = staffed ? def.capHours[owned.level - 1]! * HOUR_MS : UNSTAFFED_TRAY_MS;
  return Math.floor((Math.floor(capMs / c) * millsPerCycle(def, owned, floor)) / 1000);
}

/** Everything waiting on the floor at `now` (cents): the stations' mills added, then floored once, plus any Flood bonus. */
export function floorEarnings(save: SaveData, now: number): number {
  const floor = secondFloorOf(save);
  const mills = STATIONS.reduce((t, d) => t + stationMills(floor, d.id, now), 0);
  return Math.floor(mills / 1000) + (floor.bonus ?? 0);
}

/** One station's real rate (cents per hour): its staffed rate (unstaffed stations are tray-only: 0). */
export function stationPerHour(floor: SecondFloorState, id: StationId): number {
  const owned = floor.stations[id];
  if (!owned || !isStaffed(floor, id)) return 0;
  const def = stationDef(id);
  return Math.floor(
    (millsPerCycle(def, owned, floor) * (HOUR_MS / cycleMs(def, owned.level, true))) / 1000,
  );
}

/** What a station WOULD make per hour (cents, staffed) if `patch` were applied: used to rank the next purchase. */
export function hourlyWith(
  floor: SecondFloorState,
  id: StationId,
  patch: Partial<OwnedStation> = {},
): number {
  const owned = floor.stations[id];
  if (!owned) return 0;
  const next = { ...owned, ...patch };
  const def = stationDef(id);
  return Math.floor(
    (millsPerCycle(def, next, floor) * (HOUR_MS / cycleMs(def, next.level, true))) / 1000,
  );
}

/** The floor's real rate (cents per hour): staffed stations. */
export function floorPerHour(save: SaveData): number {
  const floor = secondFloorOf(save);
  return STATIONS.reduce((t, d) => t + stationPerHour(floor, d.id), 0);
}

export function isSecondFloorOpen(reachedLevel: number): boolean {
  return floorLevel(reachedLevel) >= SECOND_FLOOR_OPENS_AT;
}

/**
 * What the machines do for the restaurant's reputation (developer 2026-10-31, D-6: "income and popularity").
 * A working station (one a Floor Server or self-service runs) gives its tier in points (Tier 1 = 1 … Tier 3 = 3); every 6 points
 * add +1 to the day's popularity, at most +3 (a full floor). Cleaners never change it (rev 3). It composes into
 * `PopularityManager.dailyPopularityDelta` like the staff's boost. Zero without a working machine.
 */
export const FLOOR_POPULARITY_POINTS_PER_STEP = 6;
export const FLOOR_POPULARITY_MAX = 3;
export function floorPopularityDelta(save: SaveData): number {
  const floor = secondFloorOf(save);
  const points = STATIONS.reduce((t, d) => {
    const s = floor.stations[d.id];
    return t + (s && isStaffed(floor, d.id) ? s.level : 0);
  }, 0);
  return Math.min(FLOOR_POPULARITY_MAX, Math.floor(points / FLOOR_POPULARITY_POINTS_PER_STEP));
}

export type FloorResult =
  | { ok: true; save: SaveData; amount: number }
  | {
      ok: false;
      reason:
        | "locked"
        | "owned"
        | "notOwned"
        | "maxLevel"
        | "maxTables"
        | "maxPolish"
        | "insufficientFunds"
        | "nothing"
        | "fullTeam"
        | "noStations"
        | "notReady";
    };

function withFloor(save: SaveData, floor: SecondFloorState): SaveData {
  return { ...save, business: { ...save.business, secondFloor: floor } };
}

/**
 * Pays everything waiting (its own entry, if any) and restarts every clock. The clock moves forward by whole cycles
 * (`now - elapsed % cycle`): a part-finished cycle is kept, and an anchor never moves backwards.
 */
function bankFloor(save: SaveData, now: number): SaveData {
  const floor = secondFloorOf(save);
  const amount = floorEarnings(save, now);
  const stations: SecondFloorState["stations"] = {};
  for (const def of STATIONS) {
    const s = floor.stations[def.id];
    if (!s) continue;
    const c = cycleMs(def, s.level, isStaffed(floor, def.id));
    const elapsed = effectiveElapsed(floor, s.lastCollectAt, now);
    // The part-finished cycle is kept; the anchor never moves backwards.
    stations[def.id] = {
      ...s,
      lastCollectAt:
        now > s.lastCollectAt
          ? Math.max(s.lastCollectAt, anchorForRest(floor, elapsed % c, now))
          : s.lastCollectAt,
    };
  }
  const next = withFloor(
    { ...save, credits: save.credits + amount },
    { ...floor, stations, bonus: 0 },
  );
  return appendLedgerEntry(next, "automation-income", amount, "floor");
}

/**
 * After a purchase changes a station's rate its new clock starts at `now`, but NEVER earlier than it already was: a device clock set
 * back must not move a station's clock back (the next collection would pay the same hours twice). Found by the fuzz test Z1.
 */
function restartClock(
  floor: SecondFloorState,
  id: StationId,
  now: number,
  patch: Partial<OwnedStation>,
) {
  const s = floor.stations[id]!;
  return {
    ...floor,
    stations: {
      ...floor.stations,
      [id]: { ...s, ...patch, lastCollectAt: Math.max(s.lastCollectAt, now) },
    },
  };
}

/**
 * Buys a station (all-or-nothing). What the floor earned so far is banked first (it counts toward the price); the new
 * station's clock starts at `now`.
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
  const price = machinePrice(def, floor.branch);
  // A new station changes who covers what, so the hours so far are banked first.
  const paid = debitWallet(bankFloor(save, now), price);
  if (!paid.ok) return { ok: false, reason: "insufficientFunds" };
  const banked = secondFloorOf(paid.save);
  const next = withFloor(paid.save, {
    ...banked,
    stations: { ...banked.stations, [id]: { level: 1, lastCollectAt: now, tables: 1, polish: 0 } },
  });
  return {
    ok: true,
    amount: price,
    save: appendLedgerEntry(next, "automation-purchase", -price, `${id}-buy`),
  };
}

/** Shared by tables, polish and tiers: bank the floor, pay, change the station, restart its clock. */
function spendOnStation(
  save: SaveData,
  id: StationId,
  now: number,
  price: number,
  label: string,
  patch: (s: OwnedStation) => Partial<OwnedStation>,
): FloorResult {
  const banked = bankFloor(save, now);
  const paid = debitWallet(banked, price);
  if (!paid.ok) return { ok: false, reason: "insufficientFunds" };
  const floor = secondFloorOf(paid.save);
  const s = floor.stations[id]!;
  const next = withFloor(paid.save, restartClock(floor, id, now, patch(s)));
  return {
    ok: true,
    amount: price,
    save: appendLedgerEntry(next, "automation-purchase", -price, label),
  };
}

/**
 * Upgrades a station one tier (all-or-nothing). Income already earned at the old rate is paid into the wallet in the same
 * step (its own "automation-income" entry), so the new rate starts from zero at `now`. Tier 3 needs Level 30 when the
 * caller passes the player's level.
 */
export function upgradeStation(
  save: SaveData,
  id: StationId,
  now: number,
  reachedLevel: number = Number.MAX_SAFE_INTEGER,
): FloorResult {
  const def = stationDef(id);
  const floor = secondFloorOf(save);
  const owned = floor.stations[id];
  if (!owned) return { ok: false, reason: "notOwned" };
  if (owned.level >= MAX_STATION_LEVEL) return { ok: false, reason: "maxLevel" };
  const to = (owned.level + 1) as 2 | 3;
  if (to === 3 && floorLevel(reachedLevel) < TIER3_MIN_LEVEL)
    return { ok: false, reason: "locked" };
  return spendOnStation(save, id, now, tierPrice(def, to, floor.branch), `${id}-lv${to}`, (s) => ({
    level: s.level + 1,
  }));
}

/** Seats one more table (all-or-nothing); the room is 6 / 8 / 10 tables at Tier 1 / 2 / 3. */
export function buyTable(save: SaveData, id: StationId, now: number): FloorResult {
  const def = stationDef(id);
  const floor = secondFloorOf(save);
  const owned = floor.stations[id];
  if (!owned) return { ok: false, reason: "notOwned" };
  const tables = owned.tables ?? 1;
  if (tables >= maxTablesAt(owned.level)) return { ok: false, reason: "maxTables" };
  return spendOnStation(
    save,
    id,
    now,
    tablePrice(def, tables, floor.branch),
    `${id}-table-${tables + 1}`,
    () => ({ tables: tables + 1 }),
  );
}

/** Buys the next Polish step (all-or-nothing). */
export function buyPolish(save: SaveData, id: StationId, now: number): FloorResult {
  const def = stationDef(id);
  const floor = secondFloorOf(save);
  const owned = floor.stations[id];
  if (!owned) return { ok: false, reason: "notOwned" };
  const done = owned.polish ?? 0;
  if (done >= MAX_POLISH) return { ok: false, reason: "maxPolish" };
  return spendOnStation(
    save,
    id,
    now,
    polishPrice(def, done, floor.branch),
    `${id}-polish-${done + 1}`,
    () => ({ polish: done + 1 }),
  );
}

/**
 * Collects everything waiting on the floor: one credit, ONE ledger entry, and every owned station's clock moves forward by
 * its whole cycles. Nothing waiting → no change and no entry (a second tap pays nothing).
 */
export function collectFloor(save: SaveData, now: number): FloorResult {
  const amount = floorEarnings(save, now);
  if (amount <= 0) return { ok: false, reason: "nothing" };
  return { ok: true, amount, save: bankFloor(save, now) };
}

/**
 * Hires a permanent Floor Server or Floor Cleaner (one-time price, no wages; all-or-nothing). What the floor earned so far
 * is banked first at the old staffing (and counts toward the price), so the hire only changes the hours from `now` on.
 */
export function hireFloorStaff(save: SaveData, role: FloorStaffRole, now: number): FloorResult {
  const def = FLOOR_STAFF[role];
  const floor0 = secondFloorOf(save);
  const have = role === "server" ? floor0.servers : floor0.cleaners;
  // Nothing to run before the first station is bought.
  if (Object.keys(floor0.stations).length === 0) return { ok: false, reason: "noStations" };
  if ((have ?? 0) >= def.max) return { ok: false, reason: "fullTeam" };
  const price = staffPrice(role, have ?? 0, floor0.branch);
  const banked = bankFloor(save, now);
  const paid = debitWallet(banked, price);
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
    amount: price,
    save: appendLedgerEntry(next, "automation-purchase", -price, `hire-${role}`),
  };
}

/**
 * FLOOD (spec 2026-11-02): finishing a level sends a surge of guests; `cents` lie on the Pickup Counter with the rest of the
 * pile and are paid by the next collect (one `automation-income` entry). `tag` (the level id) makes it once per level. No wallet
 * movement happens here, so no ledger entry is needed yet.
 */
export function addFloodBonus(save: SaveData, cents: number, tag: string): SaveData {
  const floor = secondFloorOf(save);
  if (!Number.isInteger(cents) || cents <= 0 || floor.floodTag === tag) return save;
  return withFloor(save, { ...floor, bonus: (floor.bonus ?? 0) + cents, floodTag: tag });
}

/**
 * A Golden Guest (VIP) tapped in time: `cents` lie on the Pickup Counter with the rest of the pile, once per `slot`
 * (a 4-minute window, restaurant/goldenGuest.ts). No wallet movement here, so no ledger entry yet.
 */
export function addGoldenBonus(save: SaveData, cents: number, slot: number): SaveData {
  const floor = secondFloorOf(save);
  if (!Number.isInteger(cents) || cents <= 0 || !Number.isInteger(slot)) return save;
  if (floor.goldenSlot !== undefined && slot <= floor.goldenSlot) return save;
  return withFloor(save, { ...floor, bonus: (floor.bonus ?? 0) + cents, goldenSlot: slot });
}

/* ── Hype and Rush Hour ── */

/** Is Rush Hour on at `now`? */
export function rushActive(floor: SecondFloorState, now: number): boolean {
  return (
    floor.rushFrom !== undefined &&
    floor.rushUntil !== undefined &&
    now >= floor.rushFrom &&
    now < floor.rushUntil
  );
}

/** Milliseconds of Rush left (0 when none). */
export function rushLeftMs(floor: SecondFloorState, now: number): number {
  return rushActive(floor, now) ? floor.rushUntil! - now : 0;
}

/** Adds Hype (capped at 100). No money moves. */
export function addHype(save: SaveData, amount: number): SaveData {
  const floor = secondFloorOf(save);
  if (!Number.isInteger(amount) || amount <= 0) return save;
  const hype = Math.min(HYPE_MAX, (floor.hype ?? 0) + amount);
  return hype === (floor.hype ?? 0) ? save : withFloor(save, { ...floor, hype });
}

/**
 * Starts Rush Hour for `durationMs` (a running Rush is extended). What the floor already made is banked first (its normal
 * "automation-income" entry), so the faster time counts only from `now` on. Needs a machine.
 */
function startRush(save: SaveData, now: number, durationMs: number, hypeCost: number): FloorResult {
  const floor0 = secondFloorOf(save);
  if (Object.keys(floor0.stations).length === 0) return { ok: false, reason: "noStations" };
  if ((floor0.hype ?? 0) < hypeCost) return { ok: false, reason: "notReady" };
  const banked = bankFloor(save, now);
  const floor = secondFloorOf(banked);
  const running = rushActive(floor, now);
  const next = withFloor(banked, {
    ...floor,
    hype: (floor.hype ?? 0) - hypeCost,
    rushFrom: running ? floor.rushFrom! : now,
    rushUntil: (running ? floor.rushUntil! : now) + durationMs,
  });
  return { ok: true, amount: 0, save: next };
}

/** Full Hype starts a free 3-minute Rush Hour. */
export function startHypeRush(save: SaveData, now: number): FloorResult {
  return startRush(save, now, HYPE_RUSH_MS, HYPE_MAX);
}

/* ── Franchise: open a new branch ── */

/** True when all six stations are owned at Tier 3 with enough tables, and the last branch is not reached. */
export function canOpenBranch(save: SaveData): boolean {
  const floor = secondFloorOf(save);
  if ((floor.branch ?? 0) >= MAX_BRANCH) return false;
  return STATIONS.every((d) => {
    const s = floor.stations[d.id];
    return !!s && s.level >= MAX_STATION_LEVEL && (s.tables ?? 1) >= FRANCHISE_MIN_TABLES;
  });
}

/**
 * Opens the next branch. The waiting income is banked into the wallet first (its normal entry), then the stations,
 * polish, tables and staff reset and the branch counter rises. No money is taken or given, so the wallet and the ledger
 * stay balanced. Prices and payouts of the new branch are x10; every finished branch adds +50 % income.
 */
export function openBranch(save: SaveData, now: number): FloorResult {
  if (!canOpenBranch(save)) return { ok: false, reason: "notReady" };
  const banked = bankFloor(save, now);
  const floor = secondFloorOf(banked);
  const next = withFloor(banked, {
    stations: {},
    servers: 0,
    cleaners: 0,
    branch: (floor.branch ?? 0) + 1,
    bonus: 0,
    ...(floor.floodTag ? { floodTag: floor.floodTag } : {}),
    ...(floor.goldenSlot !== undefined ? { goldenSlot: floor.goldenSlot } : {}),
    hype: floor.hype ?? 0,
  });
  return { ok: true, amount: 0, save: next };
}
