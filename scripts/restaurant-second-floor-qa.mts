/**
 * SECOND FLOOR QA — the automated food hall (developer 2026-10-16;
 * src/game/restaurant/secondFloor.ts).
 *
 *  C  Catalog: six stations (Ice Cream replaces Pasta & Noodle); the floor
 *     can be visited from L10 and every station goes on sale at L60
 *     (developer 2026-10-16); prices and rates rise with level.
 *  E  Earnings: rate × real hours, capped; a clock set back earns 0; a big
 *     jump forward is still capped; nothing earns before it is bought.
 *  B  Buy / upgrade: all-or-nothing through the wallet, one ledger entry
 *     each; locked before its level; can't buy twice; Lv 3 is the top;
 *     an upgrade banks the income already earned first.
 *  K  Collect: one credit, ONE ledger entry, opening + ledger = closing;
 *     a second tap pays nothing; every clock restarts.
 *  T  Floor staff (developer 2026-10-16): permanent one-time hires, no
 *     wages; a server runs 2 stations (unstaffed earns 0); each missing
 *     cleaner (1 per 3 stations) costs 25 % of the takings; hiring banks
 *     the floor first; the team has a size limit.
 *  L  Locks (developer 2026-10-16): every station stays locked until it is
 *     bought — "🔒 Lv.60" before L60, "🔒 $price" after; the test switch
 *     never opens a station; no staff can be hired before a station is owned.
 *  P  Economy plan: payback hours per purchase, first buy ≤ $1,000, whole
 *     floor $25k–35k / $200 an hour, completion days per player, day-18 takings.
 *  S  Saves: an old save has no floor (nothing owned); no new top-level field.
 *
 * Run: npx tsx scripts/restaurant-second-floor-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FLOOR_STAFF,
  cleanFactor,
  hireFloorStaff,
  isStaffed,
  MAX_STATION_LEVEL,
  SECOND_FLOOR_OPENS_AT,
  STATIONS_OPEN_AT,
  STATIONS,
  buyStation,
  collectFloor,
  floorEarnings,
  floorPerHour,
  isSecondFloorOpen,
  isStationUnlocked,
  secondFloorOf,
  stationDef,
  upgradeStation,
} from "../src/game/restaurant/secondFloor.ts";
import { paybackTable, simulateFloor } from "./second-floor-economy-sim.mts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const H = 3_600_000;
const T0 = 1_800_000_000_000;
const fresh = (credits: number): SaveData => ({ ...structuredClone(DEFAULT_SAVE), credits });
/** Test setup: a fully staffed floor (staff are hired through hireFloorStaff in section T). */
const staffed = (s: SaveData, servers = 3, cleaners = 2): SaveData => ({
  ...s,
  business: {
    ...s.business,
    secondFloor: { stations: s.business.secondFloor?.stations ?? {}, servers, cleaners },
  },
});
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const entries = (s: SaveData, c: string) => s.economyLedger.filter((e) => e.category === c);

console.log("C. Catalog");
{
  const ids = STATIONS.map((s) => s.id).join();
  assert(
    ids === "coffee,drinks,pizza,burger,iceCream,hotFood" &&
      // Rule changed (developer 2026-10-26: everything by Level 5): the floor and every station
      // open at L5 (were L10 and L60). Prices and income unchanged.
      SECOND_FLOOR_OPENS_AT === 5 &&
      STATIONS_OPEN_AT === 5 &&
      STATIONS.every((s) => s.unlockLevel === STATIONS_OPEN_AT),
    "C1: six stations (Ice Cream, no Pasta & Noodle); the floor opens at L5, every station goes on sale at L5",
  );
  assert(
    STATIONS.every(
      (s) =>
        s.price > 0 &&
        s.upgradePrices[0] > 0 &&
        s.upgradePrices[1] > s.upgradePrices[0] &&
        s.perHour[0] > 0 &&
        s.perHour[1] > s.perHour[0] &&
        s.perHour[2] > s.perHour[1] &&
        s.capHours[1] >= s.capHours[0] &&
        s.capHours[2] >= s.capHours[1] &&
        [s.price, ...s.upgradePrices, ...s.perHour].every(Number.isInteger),
    ),
    "C2: whole-cent prices and rates; upgrades cost more and earn more; the cap never shrinks",
  );
  assert(
    !isSecondFloorOpen(4) && isSecondFloorOpen(5),
    "C3: the floor is closed at L4, open to visit at L5 (was L9 / L10)",
  );
}

console.log("E. Earnings");
{
  const bought = buyStation(staffed(fresh(1_000_000)), "coffee", 60, T0);
  const s = bought.ok ? bought.save : fresh(0);
  const rate = stationDef("coffee").perHour[0];
  assert(
    floorEarnings(s, T0) === 0 &&
      floorEarnings(s, T0 + 2 * H) === 2 * rate &&
      floorEarnings(s, T0 + 30 * 60_000) === rate / 2,
    "E1: rate × real hours (0 at purchase, 2 h = 2 × rate, half an hour = half)",
    { at2h: floorEarnings(s, T0 + 2 * H), rate },
  );
  assert(
    floorEarnings(s, T0 + 8 * H) === 8 * rate &&
      floorEarnings(s, T0 + 9 * H) === 8 * rate &&
      floorEarnings(s, T0 + 10_000 * H) === 8 * rate,
    "E2: capped at 8 hours at Lv 1 — a huge clock jump still pays only the cap",
  );
  assert(
    floorEarnings(s, T0 - 5 * H) === 0,
    "E3: a clock set backwards earns nothing (never negative)",
  );
  assert(
    floorEarnings(fresh(0), T0 + 5 * H) === 0 && floorPerHour(fresh(0)) === 0,
    "E4: nothing earns before a station is bought",
  );
}

console.log("B. Buy and upgrade");
{
  const coffee = stationDef("coffee");
  const locked = buyStation(fresh(10_000_000), "pizza", 4, T0);
  const closed = buyStation(fresh(10_000_000), "coffee", 4, T0);
  assert(
    !locked.ok && locked.reason === "locked" && !closed.ok && closed.reason === "locked",
    "B1: no station can be bought before L5 (was L60), nor on a closed floor",
  );
  const short = fresh(coffee.price - 1);
  const poor = buyStation(short, "coffee", 60, T0);
  assert(
    !poor.ok && poor.reason === "insufficientFunds" && short.credits === coffee.price - 1,
    "B2: can't afford → nothing changes (all-or-nothing)",
  );
  const start = fresh(coffee.price + 100);
  const b = buyStation(start, "coffee", 60, T0);
  assert(
    b.ok &&
      b.save.credits === 100 &&
      entries(b.save, "automation-purchase").length === 1 &&
      entries(b.save, "automation-purchase")[0]!.amount === -coffee.price &&
      secondFloorOf(b.save).stations.coffee?.level === 1,
    "B3: buying debits the price once, with one ledger entry; the station is Lv 1",
  );
  const again = b.ok ? buyStation(b.save, "coffee", 60, T0) : null;
  assert(again && !again.ok && again.reason === "owned", "B4: can't buy the same station twice");

  // Upgrade after 3 h: the 3 h at the old rate are paid first, then the price.
  const rich = buyStation(staffed(fresh(10_000_000)), "coffee", 60, T0);
  const u = rich.ok ? upgradeStation(rich.save, "coffee", T0 + 3 * H) : null;
  const waiting = 3 * coffee.perHour[0];
  assert(
    rich.ok &&
      u?.ok &&
      u.save.credits === rich.save.credits + waiting - coffee.upgradePrices[0] &&
      entries(u.save, "automation-income").length === 1 &&
      entries(u.save, "automation-income")[0]!.amount === waiting &&
      secondFloorOf(u.save).stations.coffee?.level === 2 &&
      floorEarnings(u.save, T0 + 3 * H) === 0 &&
      floorEarnings(u.save, T0 + 4 * H) === coffee.perHour[1],
    "B5: upgrading banks the income already earned, then charges the price; the new rate starts from zero",
  );
  let top = u?.ok ? u.save : fresh(0);
  const u3 = upgradeStation(top, "coffee", T0 + 3 * H);
  top = u3.ok ? u3.save : top;
  const u4 = upgradeStation(top, "coffee", T0 + 3 * H);
  assert(
    u3.ok && !u4.ok && u4.reason === "maxLevel" && MAX_STATION_LEVEL === 3,
    "B6: Lv 3 is the top",
  );
  const noOwn = upgradeStation(fresh(1_000_000), "burger", T0);
  assert(!noOwn.ok && noOwn.reason === "notOwned", "B7: can't upgrade a station you don't own");
  const cheap = buyStation(fresh(coffee.price), "coffee", 60, T0);
  const cantUp = cheap.ok ? upgradeStation(cheap.save, "coffee", T0 + H) : null;
  assert(
    cheap.ok && cantUp && !cantUp.ok && cheap.save.credits === 0,
    "B8: an upgrade the wallet can't cover (even with the waiting income) changes nothing",
  );
}

console.log("K. Collect");
{
  let s = staffed(fresh(10_000_000));
  for (const [id, lvl] of [
    ["coffee", 60],
    ["drinks", 70],
  ] as const) {
    const r = buyStation(s, id, lvl, T0);
    if (r.ok) s = r.save;
  }
  const opening = 0;
  const before = s.credits;
  const due = floorEarnings(s, T0 + 5 * H);
  const c = collectFloor(s, T0 + 5 * H);
  assert(
    c.ok &&
      c.amount === due &&
      c.save.credits === before + due &&
      entries(c.save, "automation-income").length === 1 &&
      fresh(10_000_000).credits + ledgerSum(c.save) - opening === c.save.credits,
    "K1: collect credits everything waiting, with ONE ledger entry; opening + ledger = closing",
    { due, credits: c.ok ? c.save.credits : null },
  );
  const again = c.ok ? collectFloor(c.save, T0 + 5 * H) : null;
  assert(
    again && !again.ok && again.reason === "nothing",
    "K2: a second tap pays nothing (and writes no entry)",
  );
  assert(
    c.ok && floorEarnings(c.save, T0 + 6 * H) === floorPerHour(c.save),
    "K3: every clock restarts at the collect",
  );
}

console.log("T. Floor staff");
{
  const H2 = 2 * H;
  let s = fresh(100_000_000);
  for (const [id, lvl] of [
    ["coffee", 60],
    ["drinks", 70],
    ["pizza", 85],
  ] as const) {
    const r = buyStation(s, id, lvl, T0);
    if (r.ok) s = r.save;
  }
  assert(
    floorEarnings(s, T0 + H2) === 0 &&
      !isStaffed({ stations: s.business.secondFloor!.stations }, "coffee"),
    "T1: without a Floor Server the stations earn nothing",
  );
  const before = s.credits;
  const h1 = hireFloorStaff(s, "server", T0 + H2);
  const s1 = h1.ok ? h1.save : s;
  const f1 = s1.business.secondFloor!;
  assert(
    h1.ok &&
      s1.credits === before - FLOOR_STAFF.server.price &&
      entries(s1, "automation-purchase").filter((e) => e.description === "hire-server").length ===
        1 &&
      entries(s1, "automation-income").length === 0 &&
      isStaffed({ stations: f1.stations, servers: 1 }, "coffee") &&
      isStaffed({ stations: f1.stations, servers: 1 }, "drinks") &&
      !isStaffed({ stations: f1.stations, servers: 1 }, "pizza"),
    "T2: a server is a one-time hire (one ledger entry, no wage); it runs 2 stations — the 3rd stays idle; the idle hours before it paid nothing",
  );
  const coffee = stationDef("coffee").perHour[0];
  const drinks = stationDef("drinks").perHour[0];
  // 3 stations need 1 cleaner; none hired → 25 % of the takings lost.
  assert(
    cleanFactor({ stations: f1.stations, servers: 1, cleaners: 0 }) === 0.75 &&
      floorEarnings(s1, T0 + H2 + H) === Math.floor(coffee * 0.75) + Math.floor(drinks * 0.75),
    "T3: each missing cleaner (1 per 3 stations) costs 25 % of the takings",
  );
  const c1 = hireFloorStaff(s1, "cleaner", T0 + H2 + H);
  const s2 = c1.ok ? c1.save : s1;
  assert(
    c1.ok &&
      entries(s2, "automation-income").length === 1 &&
      entries(s2, "automation-income")[0]!.amount ===
        Math.floor(coffee * 0.75) + Math.floor(drinks * 0.75) &&
      floorEarnings(s2, T0 + H2 + 2 * H) === coffee + drinks,
    "T4: hiring banks what the floor already earned at the old staffing; from then on the clean floor keeps it all",
  );
  let t = s2;
  for (let i = 0; i < 5; i++) {
    const r = hireFloorStaff(t, "server", T0 + H2 + 2 * H);
    if (r.ok) t = r.save;
  }
  const over = hireFloorStaff(t, "server", T0 + H2 + 2 * H);
  assert(
    t.business.secondFloor!.servers === FLOOR_STAFF.server.max &&
      !over.ok &&
      over.reason === "fullTeam",
    "T5: the team has a limit (3 servers, 2 cleaners)",
  );
  const broke = { ...s, credits: FLOOR_STAFF.server.price - 1 };
  const poor = hireFloorStaff(broke, "server", T0);
  assert(
    !poor.ok && poor.reason === "insufficientFunds",
    "T6: a hire the wallet can't cover changes nothing",
  );
}

console.log("L. Station locks");
{
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, "../src/game/restaurant/secondFloor.ts"),
    "utf8",
  );
  const view = fs.readFileSync(
    path.resolve(import.meta.dirname, "../src/components/kc/restaurantMap/SecondFloorView.tsx"),
    "utf8",
  );
  assert(
    STATIONS.every(
      (d) => !isStationUnlocked(d, d.unlockLevel - 1) && isStationUnlocked(d, d.unlockLevel),
    ),
    "L1: every station is locked one level before its unlock and open at it",
  );
  const body = src.match(/export function isStationUnlocked[\s\S]*?\n}/)?.[0] ?? "";
  assert(
    body !== "" && !/floorLevel|TEST_UNLOCK/.test(body) && !/floorLevel\(playerLevel\)/.test(view),
    "L2: the test switch never opens a station (only the floor)",
  );
  assert(
    /locked-pill-badge/.test(view) &&
      // Phase 1 (developer 2026-10-30, P5): the pill counts services ("🔒 3 services").
      /u\.badge\(station!\.unlockLevel\)/.test(view) &&
      /const locked = !!station && !owned/.test(view),
    'L3: every unbought station shows the first floor\'s lock pill ("🔒 N services", then its price)',
  );
  const r = buyStation(fresh(1_000_000_00), "hotFood", 4, T0);
  const ok = buyStation(fresh(1_000_000_00), "hotFood", 5, T0);
  assert(
    !r.ok && r.reason === "locked" && ok.ok,
    "L4: even the last station (Hot Food) is refused at L4 and can be bought at L5 (was L59 / L60)",
  );
  const noStation = hireFloorStaff(fresh(1_000_000_00), "server", T0);
  assert(
    !noStation.ok && noStation.reason === "noStations",
    "L5: no staff can be hired before a station is owned",
  );
}

console.log("P. Economy plan (developer 2026-10-16) — scripts/second-floor-economy-sim.mts");
{
  const pb = paybackTable();
  const rising = (xs: number[]) => xs.every((v, i) => i === 0 || v >= xs[i - 1]!);
  assert(
    pb.every(
      (p) =>
        p.buy >= 35 && p.buy <= 75 && p.up2 >= 90 && p.up2 <= 180 && p.up3 >= 180 && p.up3 <= 360,
    ) &&
      rising(pb.map((p) => p.buy)) &&
      rising(pb.map((p) => p.up2)) &&
      rising(pb.map((p) => p.up3)),
    "P1: every purchase pays itself back in staffed earning hours — buy 35–75 h, Lv 2 90–180 h, Lv 3 180–360 h — and later stations take longer",
    pb.map((p) => [p.id, Math.round(p.buy), Math.round(p.up2), Math.round(p.up3)]),
  );
  const first = STATIONS[0]!;
  assert(
    first.price + FLOOR_STAFF.server.price <= 100_000,
    "P2: the first machine with its Floor Server costs at most $1,000 (it never starves the campaign's kitchen upgrades)",
  );
  const full =
    STATIONS.reduce((t, d) => t + d.price + d.upgradePrices[0] + d.upgradePrices[1], 0) +
    FLOOR_STAFF.server.max * FLOOR_STAFF.server.price +
    FLOOR_STAFF.cleaner.max * FLOOR_STAFF.cleaner.price;
  const top = STATIONS.reduce((t, d) => t + d.perHour[2], 0);
  assert(
    full >= 2_500_000 && full <= 3_500_000 && top === 20_000,
    `P3: the whole floor costs $25k–$35k ($${full / 100}) and earns $200/h fully upgraded`,
  );
  const casual = simulateFloor("casual", 1);
  const regular = simulateFloor("regular", 2);
  const heavy = simulateFloor("heavy", 4);
  assert(
    regular.completeDay !== null &&
      regular.completeDay >= 18 &&
      regular.completeDay <= 30 &&
      casual.completeDay !== null &&
      casual.completeDay >= 35 &&
      casual.completeDay <= 60 &&
      heavy.completeDay !== null &&
      heavy.completeDay >= 12 &&
      heavy.completeDay <= 22,
    "P4: reinvesting its own takings, the floor is complete on day 18–30 (2 check-ins a day), 35–60 (1 a day), 12–22 (4 a day)",
    { casual: casual.completeDay, regular: regular.completeDay, heavy: heavy.completeDay },
  );
  const by18 = regular.earnedBy[18] ?? 0;
  assert(
    by18 >= 800_000 && by18 <= 2_000_000,
    `P5: by the day a 5-levels-a-day player finishes the campaign (day 18 after L60) the floor has paid $8k–$20k ($${by18 / 100}) — extra on top, not the main income`,
  );
}

console.log("S. Saves");
{
  const old = { ...structuredClone(DEFAULT_SAVE) } as SaveData;
  delete (old.business as { secondFloor?: unknown }).secondFloor;
  const bad = {
    ...structuredClone(DEFAULT_SAVE),
    business: {
      ...structuredClone(DEFAULT_SAVE.business),
      secondFloor: { stations: { coffee: { level: 9, lastCollectAt: Number.NaN } } },
    },
  } as unknown as SaveData;
  assert(
    Object.keys(secondFloorOf(old).stations).length === 0 &&
      secondFloorOf(bad).stations.coffee?.level === 3 &&
      secondFloorOf(bad).stations.coffee?.lastCollectAt === 0,
    "S1: an old save owns nothing; bad saved values are clamped",
  );
  const types = fs.readFileSync(
    path.join(path.resolve(import.meta.dirname, ".."), "src/game/business/businessTypes.ts"),
    "utf8",
  );
  assert(
    !("secondFloor" in DEFAULT_SAVE) && /secondFloor\?: SecondFloorState/.test(types),
    "S2: no new top-level save field — it lives in SaveData.business (optional)",
  );
}

console.log(failures ? `\nSECOND FLOOR QA: ${failures} FAILURE(S)` : "\nSECOND FLOOR QA: ALL PASS");
process.exit(failures ? 1 : 0);
