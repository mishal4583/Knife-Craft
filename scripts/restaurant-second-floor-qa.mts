/**
 * SECOND FLOOR QA — the automated food hall (src/game/restaurant/secondFloor.ts).
 *
 * RULES CHANGED (developer 2026-11-02, docs/planning/SECOND-FLOOR-FINAL-SPEC-2026-11-02.md): this suite was rewritten from the
 * hourly-rate model (opens at Level 5, 8/9/10-hour caps, a Server for every machine, a missing Cleaner costs 25 %) to the
 * customer-cycle model. Expected values were changed ONLY where the developer changed the rule; the money invariants (all-or-
 * nothing purchases, one ledger entry per movement, a clock set back earns nothing, no new top-level save field) are kept.
 *
 *  C  Catalog: six stations, opens at Level 3, each machine has its own level, whole-cent prices.
 *  M  Money math: guests per cycle (√tables), milestones, polish, tiers, cleaners, branches — fixed golden values.
 *  E  Earnings: whole customer cycles, caps 4/5/6 h, clock back = 0, a part-finished cycle is carried (anchor never moves back),
 *     online equals offline, the floor never creates money.
 *  B  Buy / tables / polish / tier: all-or-nothing, one ledger entry, room 6/8/10, Tier 3 needs Level 30.
 *  K  Collect: one credit, ONE ledger entry, opening + ledger = closing.
 *  T  Staff: the first two machines are self-serve, later ones half speed with a 10-minute tray until a Server; Cleaners are
 *     only a +10 % bonus (never a penalty, never lower popularity).
 *  F  Franchise: opening a branch resets the floor, keeps the wallet and ledger balanced, prices and payouts x10, +50 % per branch.
 *  G  The next-goal helper.
 *  L  Locks.
 *  S  Saves: an old save owns nothing; an old-shape station reads as one table, no polish; no new top-level field.
 *
 * Run: npx tsx scripts/restaurant-second-floor-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FLOOR_STAFF,
  MAX_BRANCH,
  MAX_POLISH,
  MAX_STATION_LEVEL,
  SECOND_FLOOR_OPENS_AT,
  STATIONS,
  STATIONS_OPEN_AT,
  TIER3_MIN_LEVEL,
  HYPE_MAX,
  HYPE_RUSH_MS,
  RUSH_SPEED,
  addFloodBonus,
  addHype,
  buyPolish,
  buyStation,
  branchPriceScale,
  buyTable,
  canOpenBranch,
  cleanFactor,
  collectFloor,
  cycleMs,
  floorEarnings,
  floorPerHour,
  floorPopularityDelta,
  hireFloorStaff,
  isSecondFloorOpen,
  isStaffed,
  isStationUnlocked,
  machinePrice,
  maxTablesAt,
  millsPerCycle,
  openBranch,
  polishPrice,
  rushActive,
  rushLeftMs,
  startHypeRush,
  secondFloorOf,
  staffPrice,
  stationCap,
  stationCycles,
  stationDef,
  tablePrice,
  tierPrice,
  upgradeStation,
  type SecondFloorState,
} from "../src/game/restaurant/secondFloor.ts";
import {
  AD_BONUS_DAILY_CAP,
  adBonusOffer,
  commitAdBonus,
  type AdBonusKind,
} from "../src/game/ads/adBonuses.ts";
import { formatUsd, formatUsdBig } from "../src/game/money.ts";
import { floorGoals, nextFloorGoal } from "../src/game/restaurant/floorGoal.ts";
import { msToFull, stationFill } from "../src/game/restaurant/floorFill.ts";
import {
  GOLDEN_SLOT_MS,
  GOLDEN_VISIBLE_MS,
  claimGolden,
  goldenAmounts,
  goldenAt,
  goldenOfSlot,
} from "../src/game/restaurant/goldenGuest.ts";
import {
  FLOOD_AD_MINUTES,
  FLOOD_FREE_MINUTES,
  floodAmounts,
  rushAdAmount,
  skipAheadAmount,
} from "../src/game/restaurant/floorFlood.ts";

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
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const entries = (s: SaveData, c: string) => s.economyLedger.filter((e) => e.category === c);
const withFloor = (s: SaveData, floor: SecondFloorState): SaveData => ({
  ...s,
  business: { ...s.business, secondFloor: floor },
});
/** A save that owns the given stations (buying through the real function, level 99, huge wallet). */
function owning(ids: string[], credits = 1_000_000_000): SaveData {
  let s = fresh(credits);
  for (const id of ids) {
    const r = buyStation(s, id as never, 99, T0);
    if (!r.ok) throw new Error(`setup: could not buy ${id}`);
    s = r.save;
  }
  return s;
}
const D = (dollars: number) => Math.round(dollars * 100);

console.log("C. Catalog");
{
  assert(
    STATIONS.map((s) => s.id).join() === "coffee,drinks,pizza,burger,iceCream,hotFood" &&
      SECOND_FLOOR_OPENS_AT === 3 &&
      STATIONS_OPEN_AT === 3 &&
      STATIONS.map((s) => s.unlockLevel).join() === "3,5,8,12,17,23",
    "C1: six stations; the floor opens at Level 3 (rule 2026-11-02, was 5); machines open at 3, 5, 8, 12, 17, 23",
  );
  assert(
    STATIONS.map((s) => s.price).join() === [500, 1000, 1500, 2000, 2500, 4000].map(D).join() &&
      STATIONS.every(
        (s) =>
          s.upgradePrices[1] > s.upgradePrices[0] &&
          s.perHour[1] > s.perHour[0] &&
          s.perHour[2] > s.perHour[1] &&
          s.capHours.join() === "4,5,6" &&
          [s.price, ...s.upgradePrices, ...s.perHour, s.tableBase].every(Number.isInteger),
      ),
    "C2: the developer's prices $500..$4,000, whole cents, tiers cost and earn more, counters hold 4/5/6 h",
  );
  assert(
    !isSecondFloorOpen(2) && isSecondFloorOpen(3),
    "C3: the floor is closed at Level 2 and open at Level 3",
  );
  assert(
    STATIONS.map((s) => s.perHour[0]).join() === [6000, 8000, 9600, 10400, 11077, 11520].join(),
    "C4: derived one-table rate per hour (cents): Coffee $60 ... Hot Food $115.20",
    STATIONS.map((s) => s.perHour[0]),
  );
}

console.log("M. Money math (golden values)");
{
  const coffee = stationDef("coffee");
  const floor0: SecondFloorState = { stations: {} };
  const one = { level: 1, tables: 1, polish: 0 };
  assert(
    millsPerCycle(coffee, one, floor0) === 20_000 && cycleMs(coffee, 1, true) === 12_000,
    "M1: Coffee Tier 1, 1 table: 20,000 mills (20 cents) per 12-second cycle = $60 an hour",
  );
  assert(
    millsPerCycle(coffee, { ...one, tables: 2 }, floor0) === 28_280 &&
      millsPerCycle(coffee, { ...one, tables: 4 }, floor0) === 40_000 &&
      millsPerCycle(coffee, { ...one, tables: 5 }, floor0) === 55_900 &&
      millsPerCycle(coffee, { ...one, tables: 10, level: 3 }, floor0) === 142_290,
    "M2: guests per cycle √tables (1, 1.414, ... 2.0 at 4), x1.25 at 5 tables, x1.5 at 10",
  );
  assert(
    millsPerCycle(coffee, { ...one, polish: 5 }, floor0) === 26_000 &&
      millsPerCycle(coffee, { level: 3, tables: 10, polish: 10 }, floor0) === 227_664,
    "M3: each Polish step +6 % (5 steps = 26,000); the best Coffee station (Tier 3, 10 tables, 10 polish) pays 227,664 mills",
  );
  assert(
    millsPerCycle(coffee, { ...one, level: 2 }, floor0) === 25_000 &&
      cycleMs(coffee, 2, true) === 11_280 &&
      cycleMs(coffee, 3, true) === 10_800 &&
      millsPerCycle(coffee, { ...one, level: 3 }, floor0) === 30_000,
    "M4: Tier 2 = guest x1.25 and cycle x0.94; Tier 3 = x1.5 and x0.90",
  );
  assert(
    millsPerCycle(coffee, one, { stations: {}, cleaners: 1 } as SecondFloorState) === 20_000,
    "M5: a Cleaner counts only for the machines the floor has (none owned = no bonus)",
  );
  const b1: SecondFloorState = { stations: {}, branch: 1 };
  assert(
    millsPerCycle(coffee, one, b1) === 300_000 &&
      machinePrice(coffee, 1) === D(5000) &&
      tablePrice(coffee, 1, 1) === D(600),
    "M6: branch 1: guests pay x10 and +50 % (20,000 -> 300,000 mills); prices x10",
  );
  assert(
    tablePrice(coffee, 1) === D(60) &&
      tablePrice(coffee, 2) === D(90) &&
      tablePrice(coffee, 3) === 13_500 &&
      polishPrice(coffee, 0) === D(40) &&
      polishPrice(coffee, 1) === D(52) &&
      polishPrice(coffee, 2) === 6760 &&
      tierPrice(coffee, 2) === D(1500) &&
      tierPrice(coffee, 3) === D(4500),
    "M7: table #2 $60, #3 $90, #4 $135; polish $40, $52, $67.60; Tier 2 $1,500, Tier 3 $4,500",
  );
  assert(
    maxTablesAt(1) === 6 && maxTablesAt(2) === 8 && maxTablesAt(3) === 10 && MAX_POLISH === 10,
    "M8: room for 6 / 8 / 10 tables at Tier 1 / 2 / 3; ten Polish steps",
  );
  const hot = stationDef("hotFood");
  assert(
    millsPerCycle(hot, { level: 3, tables: 10, polish: 10 }, { stations: {} }) === 3_642_624,
    "M9: the best Hot Food station (Tier 3, 10 tables, 10 polish) pays 3,642,624 mills = $36.43 a cycle",
  );
}

console.log("E. Earnings");
{
  const s = owning(["coffee"]);
  const base = secondFloorOf(s);
  assert(
    floorEarnings(s, T0) === 0 &&
      floorEarnings(s, T0 + 11_999) === 0 &&
      floorEarnings(s, T0 + 12_000) === 20 &&
      floorEarnings(s, T0 + 60_000) === 100 &&
      floorEarnings(s, T0 + H) === 6000 &&
      floorPerHour(s) === 6000,
    "E1: nothing before the first cycle ends, then 20 cents a 12-second cycle ($60 an hour)",
  );
  assert(
    stationCycles(base, "coffee", T0 + 100 * H) === 1200 &&
      floorEarnings(s, T0 + 4 * H) === 24_000 &&
      floorEarnings(s, T0 + 100 * H) === 24_000 &&
      stationCap(base, "coffee") === 24_000,
    "E2: the counter holds 4 hours at Tier 1 (1,200 cycles = $240); a huge clock jump still pays only the cap",
  );
  assert(
    floorEarnings(s, T0 - 5 * H) === 0,
    "E3: a clock set backwards earns nothing (never negative)",
  );
  assert(
    floorEarnings(fresh(0), T0 + 5 * H) === 0 && floorPerHour(fresh(0)) === 0,
    "E4: nothing earns before a machine is bought",
  );
  // A part-finished cycle is carried: collect at 30 s (2 full cycles, 6 s into the third).
  const c = collectFloor(s, T0 + 30_000);
  const kept = c.ok ? secondFloorOf(c.save).stations.coffee!.lastCollectAt : 0;
  assert(
    c.ok &&
      c.amount === 40 &&
      kept === T0 + 24_000 &&
      floorEarnings(c.save, T0 + 36_000) === 20 &&
      floorEarnings(c.save, T0 + 35_999) === 0,
    "E5: collecting at 30 s pays 2 cycles and keeps the 6 s already cooked (the 3rd pays at 36 s, not 42 s); the anchor moves forward only",
  );
  // Online equals offline: collecting every minute for 3 hours = collecting once (whole cents at 1 table).
  let on = s;
  let paidOnline = 0;
  for (let m = 1; m <= 180; m++) {
    const r = collectFloor(on, T0 + m * 60_000);
    if (r.ok) {
      on = r.save;
      paidOnline += r.amount;
    }
  }
  assert(
    paidOnline === floorEarnings(s, T0 + 180 * 60_000),
    "E6: 180 one-minute collections pay exactly what one collection after 3 hours pays (1 table)",
    { paidOnline, once: floorEarnings(s, T0 + 180 * 60_000) },
  );
  // With 2 tables a cycle pays 28.28 cents: collecting often loses under one cent each time, never creates money.
  let two = s;
  for (let i = 0; i < 1; i++) {
    const r = buyTable(two, "coffee", T0);
    if (r.ok) two = r.save;
  }
  const onceTwo = floorEarnings(two, T0 + 3 * H);
  let often = two;
  let paidTwo = 0;
  for (let m = 1; m <= 180; m++) {
    const r = collectFloor(often, T0 + m * 60_000);
    if (r.ok) {
      often = r.save;
      paidTwo += r.amount;
    }
  }
  assert(
    paidTwo <= onceTwo && onceTwo - paidTwo <= 180,
    "E7: 2 tables (28.28 cents a cycle): 180 collections never pay MORE than one collection and lose under 1 cent each",
    { paidTwo, onceTwo },
  );
}

console.log("B. Buy, tables, polish, tiers");
{
  const coffee = stationDef("coffee");
  const closed = buyStation(fresh(10_000_000), "coffee", 2, T0);
  const early = buyStation(fresh(10_000_000), "drinks", 4, T0);
  assert(
    !closed.ok && closed.reason === "locked" && !early.ok && early.reason === "locked",
    "B1: Coffee cannot be bought before Level 3, Drinks not before Level 5",
  );
  const short = fresh(coffee.price - 1);
  const poor = buyStation(short, "coffee", 60, T0);
  assert(
    !poor.ok && poor.reason === "insufficientFunds" && short.credits === coffee.price - 1,
    "B2: can't afford -> nothing changes (all-or-nothing)",
  );
  const b = buyStation(fresh(coffee.price + 100), "coffee", 3, T0);
  assert(
    b.ok &&
      b.save.credits === 100 &&
      entries(b.save, "automation-purchase").length === 1 &&
      entries(b.save, "automation-purchase")[0]!.amount === -coffee.price &&
      secondFloorOf(b.save).stations.coffee?.level === 1 &&
      secondFloorOf(b.save).stations.coffee?.tables === 1,
    "B3: buying debits the price once with one ledger entry; the station starts at Tier 1, one table",
  );
  const again = b.ok ? buyStation(b.save, "coffee", 60, T0) : null;
  assert(again && !again.ok && again.reason === "owned", "B4: can't buy the same machine twice");

  // Tables
  let s = owning(["coffee"]);
  const before = s.credits;
  const t1 = buyTable(s, "coffee", T0);
  assert(
    t1.ok &&
      t1.save.credits === before - D(60) &&
      entries(t1.save, "automation-purchase").filter((e) => e.description === "coffee-table-2")
        .length === 1 &&
      secondFloorOf(t1.save).stations.coffee?.tables === 2,
    "B5: table #2 costs $60 with one ledger entry",
  );
  for (let i = 0; i < 4; i++) {
    const r = buyTable(s, "coffee", T0);
    if (r.ok) s = r.save;
  }
  const six = secondFloorOf(s).stations.coffee!.tables;
  const seventh = buyTable(s, "coffee", T0);
  assert(
    six === 5 &&
      (() => {
        let t = s;
        const r = buyTable(t, "coffee", T0);
        if (r.ok) t = r.save;
        const full = buyTable(t, "coffee", T0);
        return (
          !full.ok && full.reason === "maxTables" && secondFloorOf(t).stations.coffee?.tables === 6
        );
      })() &&
      seventh.ok,
    "B6: Tier 1 seats at most 6 tables, then 'maxTables'",
  );
  // Tier gate
  const up2 = upgradeStation(owning(["coffee"]), "coffee", T0, 10);
  assert(
    up2.ok && secondFloorOf(up2.save).stations.coffee?.level === 2,
    "B7: Tier 2 can be bought at any level",
  );
  const up3low = up2.ok ? upgradeStation(up2.save, "coffee", T0, TIER3_MIN_LEVEL - 1) : null;
  const up3 = up2.ok ? upgradeStation(up2.save, "coffee", T0, TIER3_MIN_LEVEL) : null;
  assert(
    up3low && !up3low.ok && up3low.reason === "locked" && up3?.ok && MAX_STATION_LEVEL === 3,
    "B8: Tier 3 needs Level 30",
  );
  const top = up3?.ok ? upgradeStation(up3.save, "coffee", T0, 99) : null;
  assert(top && !top.ok && top.reason === "maxLevel", "B9: Tier 3 is the top");
  // Polish
  let p = owning(["coffee"]);
  for (let i = 0; i < MAX_POLISH; i++) {
    const r = buyPolish(p, "coffee", T0);
    if (!r.ok) throw new Error("polish setup");
    p = r.save;
  }
  const over = buyPolish(p, "coffee", T0);
  assert(
    secondFloorOf(p).stations.coffee?.polish === 10 &&
      !over.ok &&
      over.reason === "maxPolish" &&
      floorPerHour(p) ===
        Math.floor(
          (millsPerCycle(coffee, { level: 1, tables: 1, polish: 10 }, { stations: {} }) * 300) /
            1000,
        ),
    "B10: ten Polish steps (+60 %), then 'maxPolish'",
  );
  // Waiting income counts toward the price and is paid first with its own entry.
  const rich = owning(["coffee"], D(500));
  const afford = buyTable(rich, "coffee", T0 + 2 * H);
  assert(
    afford.ok &&
      entries(afford.save, "automation-income").length === 1 &&
      entries(afford.save, "automation-income")[0]!.amount === 12_000,
    "B11: a purchase pays the waiting income into the wallet first (2 h = $120), then charges",
  );
  const noOwn = buyTable(fresh(1_000_000), "burger", T0);
  assert(!noOwn.ok && noOwn.reason === "notOwned", "B12: can't spend on a machine you don't own");
  const cheap = buyStation(fresh(coffee.price), "coffee", 60, T0);
  const cant = cheap.ok ? buyTable(cheap.save, "coffee", T0 + 1000) : null;
  assert(
    cheap.ok && cant && !cant.ok && cheap.save.credits === 0,
    "B13: a table the wallet can't cover changes nothing",
  );
}

console.log("K. Collect");
{
  let s = owning(["coffee", "drinks"]);
  const opening = 1_000_000_000;
  const due = floorEarnings(s, T0 + 3 * H);
  const c = collectFloor(s, T0 + 3 * H);
  assert(
    c.ok &&
      c.amount === due &&
      c.save.credits === s.credits + due &&
      entries(c.save, "automation-income").length === 1 &&
      opening + ledgerSum(c.save) === c.save.credits,
    "K1: collect credits everything waiting with ONE ledger entry; opening + ledger = closing",
    { due },
  );
  const again = c.ok ? collectFloor(c.save, T0 + 3 * H) : null;
  assert(
    again && !again.ok && again.reason === "nothing",
    "K2: a second tap pays nothing (no entry)",
  );
  assert(
    c.ok && floorEarnings(c.save, T0 + 4 * H) === floorPerHour(c.save),
    "K3: after a collect the next hour pays exactly one hour",
  );
  // A long mixed run keeps the books balanced.
  let m = fresh(5_000_000);
  const open2 = m.credits;
  let t = T0;
  const steps: Array<() => void> = [];
  const doit = (r: { ok: boolean; save?: SaveData }) => {
    if (r.ok && r.save) m = r.save;
  };
  steps.push(() => doit(buyStation(m, "coffee", 99, t)));
  steps.push(() => doit(buyStation(m, "drinks", 99, t)));
  steps.push(() => doit(buyTable(m, "coffee", t)));
  steps.push(() => doit(buyPolish(m, "drinks", t)));
  steps.push(() => doit(upgradeStation(m, "coffee", t, 99)));
  steps.push(() => doit(hireFloorStaff(m, "cleaner", t)));
  steps.push(() => doit(collectFloor(m, t)));
  for (let i = 0; i < 200; i++) {
    t += ((i % 7) + 1) * 17 * 60_000;
    steps[i % steps.length]!();
  }
  assert(
    open2 + ledgerSum(m) === m.credits && m.credits >= 0,
    "K4: after 200 mixed purchases and collections opening + ledger = closing and the wallet is never negative",
    { credits: m.credits, sum: open2 + ledgerSum(m) },
  );
}

console.log("T. Staff");
{
  let s = owning(["coffee", "drinks"]);
  const f = secondFloorOf(s);
  assert(
    isStaffed(f, "coffee") && isStaffed(f, "drinks") && floorEarnings(s, T0 + H) > 0,
    "T1: the first two machines are self-serve (no Server needed)",
  );
  s = owning(["coffee", "drinks", "pizza"]);
  const f3 = secondFloorOf(s);
  const pizza = stationDef("pizza");
  assert(
    !isStaffed(f3, "pizza") &&
      cycleMs(pizza, 1, false) === 60_000 &&
      stationCycles(f3, "pizza", T0 + 5 * H) === 10 &&
      stationCap(f3, "pizza") === 800,
    "T2: the third machine works at half speed (60 s a cycle) and holds only a 10-minute tray (10 cycles = $8)",
  );
  const before = s.credits;
  const h1 = hireFloorStaff(s, "server", T0 + H);
  const s1 = h1.ok ? h1.save : s;
  assert(
    h1.ok &&
      s1.credits < before &&
      before - s1.credits - floorEarnings(s, T0 + H) <= staffPrice("server", 0) &&
      entries(s1, "automation-purchase").filter((e) => e.description === "hire-server").length ===
        1 &&
      isStaffed(secondFloorOf(s1), "pizza") &&
      staffPrice("server", 0) === D(1200) &&
      staffPrice("server", 1) === D(6000),
    "T3: the first Server costs $1,200 (second $6,000), is a one-time hire with one ledger entry, and staffs Pizza",
  );
  const h2 = hireFloorStaff(s1, "server", T0 + H);
  const s2 = h2.ok ? h2.save : s1;
  const h3 = hireFloorStaff(s2, "server", T0 + H);
  assert(
    h2.ok && !h3.ok && h3.reason === "fullTeam" && FLOOR_STAFF.server.max === 2,
    "T4: the team has a limit (2 Servers)",
  );
  // Cleaners: only a bonus.
  const none = cleanFactor(secondFloorOf(s));
  const c1 = hireFloorStaff(s, "cleaner", T0 + H);
  const withC = c1.ok ? cleanFactor(secondFloorOf(c1.save)) : 0;
  assert(
    none === 1 &&
      withC === 1.1 &&
      staffPrice("cleaner", 0) === D(600) &&
      staffPrice("cleaner", 1) === D(3000),
    "T5: no Cleaner = no change (never a penalty); one Cleaner = +10 % income ($600, then $3,000)",
  );
  assert(
    floorPopularityDelta(owning(["coffee"])) === 0 &&
      floorPopularityDelta(secondFloorOf(s).stations ? s : s) ===
        floorPopularityDelta(c1.ok ? c1.save : s),
    "T6: Cleaners never change popularity",
  );
  const noStations = hireFloorStaff(fresh(100_000_000), "server", T0);
  assert(
    !noStations.ok && noStations.reason === "noStations",
    "T7: no staff before a machine is owned",
  );
  const broke = { ...s, credits: D(1200) - 1 };
  const poor = hireFloorStaff(broke, "server", T0);
  assert(
    !poor.ok && poor.reason === "insufficientFunds",
    "T8: a hire the wallet can't cover changes nothing",
  );
}

console.log("F. Franchise (branches)");
{
  // A full floor: every machine Tier 3, 8+ tables, built through the real purchases.
  let s = owning(["coffee", "drinks", "pizza", "burger", "iceCream", "hotFood"], 2_000_000_000);
  for (const d of STATIONS) {
    for (const to of [2, 3]) {
      const r = upgradeStation(s, d.id, T0, 99);
      if (r.ok) s = r.save;
      void to;
    }
    for (let i = 0; i < 9; i++) {
      const r = buyTable(s, d.id, T0);
      if (r.ok) s = r.save;
    }
  }
  const full = canOpenBranch(s);
  assert(full, "F1: all six machines at Tier 3 with 8+ tables can open a branch");
  assert(
    !canOpenBranch(owning(["coffee"])) && !canOpenBranch(fresh(0)),
    "F2: a smaller floor cannot",
  );
  const open = fresh(0).credits;
  const before = s.credits;
  const sumBefore = ledgerSum(s);
  const nb = openBranch(s, T0 + 3 * H);
  assert(
    nb.ok &&
      secondFloorOf(nb.save).branch === 1 &&
      Object.keys(secondFloorOf(nb.save).stations).length === 0 &&
      (secondFloorOf(nb.save).servers ?? 0) === 0 &&
      nb.save.credits >= before &&
      ledgerSum(nb.save) - sumBefore === nb.save.credits - before &&
      entries(nb.save, "automation-income").length >= 1,
    "F3: a new branch resets the stations and staff, banks the waiting income, takes no money, keeps wallet = ledger",
  );
  const next = nb.ok ? nb.save : s;
  const b = buyStation({ ...next, credits: 10_000_000 }, "coffee", 99, T0);
  assert(
    b.ok && b.save.credits === 10_000_000 - D(5000) && !canOpenBranch(next),
    "F4: branch 1: Coffee costs $5,000 (x10) and the floor must be rebuilt before the next branch",
  );
  const g = b.ok ? floorEarnings(b.save, T0 + H) : 0;
  assert(g === 90_000, "F5: branch 1 Coffee pays $900 an hour (x10, +50 %)", { g });
  void open;
  // The worst floor at the last branch: every station Tier 3, 10 tables, 10 polish, both Cleaners, a FULL counter of each (6 h), plus a Flood bonus.
  // Every number in the money path must stay an exact integer: below 2^53 with a wide margin (the pile is summed in mills).
  const worst = (b: number) => {
    const floor = { stations: {}, branch: b, cleaners: 2 } as SecondFloorState;
    return STATIONS.reduce((t, d) => {
      const o = { level: 3, tables: 10, polish: 10 };
      const cycles = Math.floor((6 * H) / cycleMs(d, 3, true));
      return t + cycles * millsPerCycle(d, o, floor);
    }, 0);
  };
  assert(
    MAX_BRANCH === 5 &&
      worst(MAX_BRANCH) < Number.MAX_SAFE_INTEGER / 4 &&
      // (a further branch multiplies the pile by 10 and more: the branch is clamped, so it is computed here)
      worst(MAX_BRANCH) * 10 > Number.MAX_SAFE_INTEGER / 4,
    "F6: branches stop at 5: the largest pile (mills) stays below a quarter of 2^53, and one more branch would not (money must stay exact integers)",
    { atMax: worst(MAX_BRANCH), nextAtLeast: worst(MAX_BRANCH) * 10 },
  );
  const rich: SaveData = { ...fresh(0), credits: 1_000_000_000_000_000 };
  const deep = {
    ...rich,
    business: {
      ...rich.business,
      secondFloor: { stations: {}, branch: MAX_BRANCH + 4 } as SecondFloorState,
    },
  };
  assert(
    secondFloorOf(deep).branch === MAX_BRANCH &&
      branchPriceScale(MAX_BRANCH + 4) === 10 ** MAX_BRANCH,
    "F7: a saved branch beyond the limit is clamped to it (a hand-edited or newer save cannot break the numbers)",
  );
}

console.log("G. Next goal");
{
  const s = fresh(D(600));
  const g = nextFloorGoal(s, 3, s.credits);
  assert(
    g?.kind === "machine" && g.id === "coffee" && g.price === D(500),
    "G1: a new Level-3 player is pointed at the $500 Coffee machine",
    g,
  );
  assert(
    nextFloorGoal(fresh(1_000_000), 2, 1_000_000) === null,
    "G2: no goal while the floor is closed",
  );
  const owned = { ...owning(["coffee"]), credits: D(1) };
  const goals = floorGoals(owned, 3);
  assert(
    goals.some((x) => x.kind === "table") &&
      goals.some((x) => x.kind === "polish") &&
      goals.some((x) => x.kind === "tier") &&
      !goals.some((x) => x.kind === "machine"),
    "G3: Drinks is not offered at Level 3 (it needs Level 5); tables, polish and the tier are",
  );
  const at5 = floorGoals(owned, 5);
  assert(
    at5.some((x) => x.kind === "machine" && x.id === "drinks"),
    "G4: Drinks appears at Level 5",
  );
  const t3 = floorGoals(owning(["coffee"]), 20).some((x) => x.kind === "tier");
  const r = (() => {
    const u = upgradeStation(owning(["coffee"]), "coffee", T0, 20);
    return u.ok ? floorGoals(u.save, 20).some((x) => x.kind === "tier") : true;
  })();
  assert(t3 && !r, "G5: Tier 3 is not offered below Level 30");
  const broke = nextFloorGoal(owned, 3, 10);
  assert(
    broke !== null && broke.price > 10,
    "G6: when nothing is affordable the goal is still a real, cheap-ish target",
  );
  const best = floorGoals(owned, 3)[0]!;
  assert(
    floorGoals(owned, 3).every(
      (x) => x.price / Math.max(1, x.gain) >= best.price / Math.max(1, best.gain) - 1e-9,
    ),
    "G7: goals are sorted by payback",
  );
}

console.log("H. Flood (the surge of guests after a level)");
{
  const nothing = floodAmounts(fresh(D(600)), 3, T0);
  const closed = floodAmounts(owning(["coffee"]), 2, T0);
  assert(
    nothing.free === 0 && nothing.adExtra === 0 && closed.free === 0,
    "H1: no machine = no Flood; a closed floor = no Flood",
  );
  const own = { ...owning(["coffee"]), credits: D(20) };
  const a = floodAmounts(own, 3, T0);
  const goal = floorGoals(own, 3).find((g) => g.price > own.credits)!;
  const rate15 = Math.floor((floorPerHour(own) * FLOOD_FREE_MINUTES) / 60);
  const rate60 = Math.floor((floorPerHour(own) * FLOOD_AD_MINUTES) / 60);
  assert(
    a.free === Math.max(rate15, Math.floor(goal.price / 20)) &&
      a.free + a.adExtra === Math.max(rate60, Math.floor(goal.price / 5)) &&
      a.adExtra >= 0,
    "H2: free = the larger of 15 minutes of income and 5 % of the goal; with the ad = the larger of 60 minutes and 20 %",
    { a, goal: goal.price, rate15, rate60 },
  );
  const withBonus = addFloodBonus(own, a.free, "level-3");
  const twice = addFloodBonus(withBonus, a.free, "level-3");
  const other = addFloodBonus(withBonus, 500, "level-4");
  assert(
    floorEarnings(withBonus, T0) === a.free &&
      twice === withBonus &&
      floorEarnings(other, T0) === a.free + 500 &&
      addFloodBonus(own, 0, "x") === own &&
      addFloodBonus(own, 1.5, "x") === own,
    "H3: the surge lies on the Pickup Counter with the rest, once per level (the same level never floods twice; bad amounts add nothing)",
  );
  const col = collectFloor(withBonus, T0);
  assert(
    col.ok &&
      col.amount === a.free &&
      col.save.credits === own.credits + a.free &&
      entries(col.save, "automation-income").length >= 1 &&
      secondFloorOf(col.save).bonus === 0 &&
      floorEarnings(col.save, T0) === 0,
    "H4: collecting pays the surge with the machines' pile in ONE credit and clears it",
  );
  const buy = buyTable({ ...withBonus, credits: 0 }, "coffee", T0);
  assert(
    buy.ok === a.free >= D(60),
    "H5: the surge counts toward a purchase like any waiting income",
  );
  const rich = floodAmounts(
    (() => {
      let x = owning(["coffee", "drinks", "pizza", "burger", "iceCream", "hotFood"]);
      for (const role of ["server", "server"] as const) {
        const h = hireFloorStaff(x, role, T0);
        if (h.ok) x = h.save;
      }
      for (const d of STATIONS) {
        for (let i = 0; i < 5; i++) {
          const r = buyTable(x, d.id, T0);
          if (r.ok) x = r.save;
        }
      }
      return { ...x, credits: 0 };
    })(),
    99,
    T0,
  );
  assert(rich.free > a.free * 10, "H6: the surge grows with the floor (rich the idle-game way)", {
    rich,
    a,
  });
}

console.log("V. Golden Guest (the VIP)");
{
  const slots = Array.from({ length: 360 }, (_, i) => 7_000_000 + i);
  const all = slots.map(goldenOfSlot);
  assert(
    all.every(
      (g, i) =>
        g.arriveAt >= slots[i]! * GOLDEN_SLOT_MS + 15_000 &&
        g.leaveAt === g.arriveAt + GOLDEN_VISIBLE_MS &&
        g.leaveAt < (slots[i]! + 1) * GOLDEN_SLOT_MS &&
        g.x >= 14 &&
        g.x < 78 &&
        g.y >= 36 &&
        g.y < 58,
    ),
    "V1: every 4-minute slot has exactly one VIP, 12 s on the floor, inside its slot, on a seat area of the map",
  );
  const g = goldenOfSlot(7_000_123);
  const again = goldenOfSlot(7_000_123);
  assert(
    JSON.stringify(g) === JSON.stringify(again) &&
      goldenAt(g.arriveAt - 1) === null &&
      goldenAt(g.arriveAt)?.slot === 7_000_123 &&
      goldenAt(g.leaveAt - 1)?.slot === 7_000_123 &&
      goldenAt(g.leaveAt) === null,
    "V2: deterministic (the same slot always shows the same VIP at the same second and place); visible [arrive, leave)",
  );
  const distinct = new Set(all.map((x) => (x.arriveAt % GOLDEN_SLOT_MS) + ":" + x.x + ":" + x.y));
  assert(
    distinct.size > 300,
    "V3: the VIP is not the same every time (varied arrival and place)",
    distinct.size,
  );
  const own = { ...owning(["coffee"]), credits: D(20) };
  const when = g.arriveAt + 1000;
  const a = goldenAmounts(own, 3, when);
  assert(
    a.burst > 0 && a.adExtra === a.burst * 2 && goldenAmounts(fresh(D(20)), 3, when).burst === 0,
    "V4: the tip is at least a minute of income (or 2 % of the goal); the ad adds twice that; no machine = no tip",
    a,
  );
  const c1 = claimGolden(own, g.slot, 3, when);
  const c2 = c1.ok ? claimGolden(c1.save, g.slot, 3, when + 500) : null;
  const early = claimGolden(own, g.slot, 3, g.arriveAt - 1000);
  const wrong = claimGolden(own, g.slot + 1, 3, when);
  assert(
    c1.ok && floorEarnings(c1.save, when) >= a.burst && c2 && !c2.ok && !early.ok && !wrong.ok,
    "V5: tapping in time puts the tip on the Pickup Counter once; again, too early, or the wrong slot pays nothing",
  );
  const next = goldenOfSlot(g.slot + 1);
  const c3 = c1.ok ? claimGolden(c1.save, next.slot, 3, next.arriveAt + 1000) : null;
  assert(c3?.ok === true, "V6: the next slot's VIP can be tipped");
  const col = c1.ok ? collectFloor(c1.save, when) : null;
  assert(
    col?.ok === true &&
      col.save.credits === own.credits + col.amount &&
      entries(col.save, "automation-income").length >= 1,
    "V7: collecting pays the tip with ONE automation-income entry (wallet = ledger)",
  );
}

console.log("R. Hype and Rush Hour");
{
  const base = owning(["coffee"]);
  const h1 = addHype(base, 60);
  const h2 = addHype(h1, 60);
  assert(
    secondFloorOf(h1).hype === 60 &&
      secondFloorOf(h2).hype === HYPE_MAX &&
      addHype(h2, 5) === h2 &&
      addHype(base, 0) === base &&
      addHype(base, 2.5) === base,
    "R1: Hype fills to 100 and stops there (bad amounts add nothing)",
  );
  const notFull = startHypeRush(h1, T0);
  const noMachine = startHypeRush(addHype(fresh(0), 100), T0);
  assert(
    !notFull.ok &&
      notFull.reason === "notReady" &&
      !noMachine.ok &&
      noMachine.reason === "noStations",
    "R2: a Rush needs full Hype and a machine",
  );
  const r = startHypeRush(h2, T0);
  const f = r.ok ? secondFloorOf(r.save) : null;
  assert(
    r.ok &&
      f!.hype === 0 &&
      rushActive(f!, T0 + 1) &&
      rushLeftMs(f!, T0 + 1000) === HYPE_RUSH_MS - 1000 &&
      !rushActive(f!, T0 + HYPE_RUSH_MS) &&
      RUSH_SPEED === 3,
    "R3: full Hype is spent to start a 3-minute Rush at x3",
  );
  if (r.ok) {
    const during = floorEarnings(r.save, T0 + 180_000);
    const normal = floorEarnings(h2, T0 + 180_000);
    const after = floorEarnings(r.save, T0 + 180_000 + 60_000);
    assert(
      normal === 300 && during === 900 && after === 1000,
      "R4: Coffee (20 cents a 12 s cycle): 3 minutes cost $3.00 normally, $9.00 in the Rush; the Rush ends at x1 ($10.00 a minute later)",
      { normal, during, after },
    );
    // A part-finished cycle before the Rush is kept: 6 s into a cycle, then 3 minutes of Rush.
    const half = startHypeRush(h2, T0 + 6000);
    assert(
      half.ok && floorEarnings(half.save, T0 + 6000 + 180_000) === 900,
      "R5: starting a Rush banks the pile first (6 s in, nothing to bank yet) and keeps the part-finished cycle",
      half.ok ? floorEarnings(half.save, T0 + 186_000) : null,
    );
    const ext = startHypeRush(addHype(r.save, 100), T0 + 60_000);
    const ef = ext.ok ? secondFloorOf(ext.save) : null;
    assert(
      ext.ok && ef!.rushFrom === T0 && ef!.rushUntil === T0 + 360_000,
      "R6: a second Rush while one runs extends it (never x9)",
      ef,
    );
    // Review fix 2026-11-03: the "full in" bar followed the wall clock, so during a Rush it showed a counter filling at x1 while the money came in at x3.
    const fillNow = stationFill(secondFloorOf(r.save), "coffee", T0 + 60_000);
    const fillPlain = stationFill(secondFloorOf(h2), "coffee", T0 + 60_000);
    assert(
      !!fillNow &&
        !!fillPlain &&
        fillNow.fraction === 180_000 / 14_400_000 &&
        fillPlain.fraction === 60_000 / 14_400_000 &&
        fillNow.msToFull === 13_980_000 &&
        fillPlain.msToFull === 14_400_000 - 60_000,
      "R6b: the fill bar counts a Rush at x3 (a minute in: 3 minutes of takings stored)",
      { fillNow, fillPlain },
    );
    // Code review 2026-11-03: "Full in" must not divide the WHOLE remaining time by 3: the Rush lasts 2 more minutes, then the clock is x1 again.
    assert(
      !!fillNow &&
        fillNow.msToFull === 120_000 + (14_400_000 - 180_000 - 3 * 120_000) &&
        msToFull(100, 3, 1000) === 33 &&
        msToFull(5000, 3, 1000) === 1000 + 2000 &&
        msToFull(0, 3, 1000) === 0,
      "R6c: Full in = what is left of the Rush at x3, then the rest at x1 (not the whole remainder at x3)",
      fillNow,
    );
  }
  // Property: collecting at random moments (inside, before, across and after a Rush) pays exactly what one collection at the end
  // pays (1 table = whole cents), the anchor never moves backwards, and nothing is lost.
  let seed = 12345;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let okAll = true;
  let worst = "";
  for (let trial = 0; trial < 200; trial++) {
    const startAt = T0 + Math.floor(rnd() * 90_000);
    const rushAt = T0 + Math.floor(rnd() * 600_000);
    let a = withFloor(owning(["coffee"]), {
      ...secondFloorOf(owning(["coffee"])),
      stations: { coffee: { level: 1, lastCollectAt: startAt, tables: 1, polish: 0 } },
      hype: 100,
    });
    const rs = startHypeRush(a, rushAt);
    if (rs.ok) a = rs.save;
    const end = rushAt + 400_000 + Math.floor(rnd() * 300_000);
    const b = structuredClone(a);
    let paid = 0;
    let t = rushAt + 1;
    let anchorPrev = secondFloorOf(a).stations.coffee!.lastCollectAt;
    while (t < end) {
      t += 1 + Math.floor(rnd() * 90_000);
      if (t > end) t = end;
      const c = collectFloor(a, t);
      if (c.ok) {
        paid += c.amount;
        a = c.save;
      }
      const anchor = secondFloorOf(a).stations.coffee!.lastCollectAt;
      if (anchor < anchorPrev) okAll = false;
      anchorPrev = anchor;
    }
    const once = floorEarnings(b, end);
    if (paid !== once) {
      okAll = false;
      worst = `trial ${trial}: paid ${paid} once ${once}`;
    }
  }
  assert(
    okAll,
    "R7: 200 random collection schedules around a Rush pay exactly what one collection pays; the anchor never moves back",
    worst,
  );
}

console.log("W. Skip ahead (rewarded timer skip)");
{
  const own = { ...owning(["coffee"]), credits: D(20) };
  const a = skipAheadAmount(own, 3, T0);
  const goal = floorGoals(own, 3).find((g) => g.price > own.credits)!;
  assert(
    a === Math.max(floorPerHour(own) * 2, Math.floor((goal.price * 30) / 100)) &&
      skipAheadAmount(fresh(D(600)), 3, T0) === 0 &&
      skipAheadAmount(own, 2, T0) === 0,
    "W1: skip ahead pays the larger of two hours of income and 30 % of the goal; nothing without a machine or on a closed floor",
    { a },
  );
  const rich = { ...owning(["coffee"]), credits: 1_000_000_000 };
  assert(
    skipAheadAmount(rich, 3, T0) === 0 || floorGoals(rich, 3).some((g) => g.price > rich.credits),
    "W2: with every goal affordable there is nothing to skip (no offer)",
  );
}

console.log("A. The new ad rewards use the existing reward and ledger path");
{
  // The ledger stamps entries with the real clock, so the daily cap is counted against the real day (not a fixed date).
  const now = new Date();
  for (const [kind, cap] of [
    ["flood", 8],
    ["golden", 8],
    ["skip", 3],
    ["rush", 4],
  ] as [AdBonusKind, number][]) {
    let save = { ...fresh(D(100)), economyLedger: [] };
    const first = adBonusOffer(save, kind, D(25), now);
    const c = first ? commitAdBonus(save, first, now) : null;
    const again = first && c?.ok ? commitAdBonus(c.save, first, now) : null;
    assert(
      AD_BONUS_DAILY_CAP[kind] === cap &&
        !!first &&
        c?.ok === true &&
        c.save.credits === save.credits + D(25) &&
        entries(c.save, "rewarded-ad").length === 1 &&
        entries(c.save, "rewarded-ad")[0]!.amount === D(25) &&
        again?.ok === false,
      `A1 ${kind}: one rewarded-ad ledger entry for exactly the offered amount, wallet up by the same; the same reward id never pays twice`,
    );
    let n = 0;
    for (let i = 0; i < cap + 2; i++) {
      const o = adBonusOffer(save, kind, D(1), now);
      if (!o) break;
      const r = commitAdBonus(save, o, now);
      if (!r.ok) break;
      save = r.save;
      n++;
    }
    assert(n === cap, `A2 ${kind}: at most ${cap} offers a day, then none (daily cap)`, n);
    assert(
      adBonusOffer(fresh(0), kind, 0, now) === null,
      `A3 ${kind}: an amount of 0 is never offered`,
    );
  }
}

{
  const own = { ...owning(["coffee"]), credits: D(20) };
  const a = rushAdAmount(own, 3, T0);
  const goal = floorGoals(own, 3).find((g) => g.price > own.credits)!;
  assert(
    a === Math.max(Math.floor((floorPerHour(own) * 20) / 60), Math.floor(goal.price / 10)) &&
      rushAdAmount(fresh(D(600)), 3, T0) === 0 &&
      rushAdAmount(own, 2, T0) === 0,
    "W3: the Rush Hour ad pays what ten minutes at x3 would add (2 x ten minutes of income), at least 10 % of the goal; nothing without a machine",
    { a },
  );
}

console.log("Z2. A rewound clock never pays the same time twice");
{
  // Code review 2026-11-03 asked whether the clock guard (restartClock) was the only one. Tried first: replaying the same actions with a
  // rewinding clock against a never-rewinding clock. That is NOT a valid invariant: "set the clock back, buy, set it forward" earns the
  // time that passed on the device, exactly like skipping the clock forward, which a game without a server cannot tell apart. What must
  // hold is narrower: no period is ever paid twice, and a Rush never stacks.
  const onePerHour = (sv: SaveData, at: number) => floorEarnings(sv, at);
  let sv = owning(["coffee"]);
  const base = onePerHour(sv, T0 + H);
  const c1 = collectFloor(sv, T0 + 2 * H);
  const c2 = c1.ok ? collectFloor(c1.save, T0 + H) : null; // the clock goes BACK an hour
  const afterBack = c2 && c2.ok ? c2.save : c1.ok ? c1.save : sv;
  const station = secondFloorOf(afterBack).stations.coffee!;
  const later = onePerHour(afterBack, T0 + 3 * H);
  assert(
    base > 0 &&
      c1.ok &&
      (!c2 || !c2.ok || c2.save.credits === c1.save.credits) &&
      station.lastCollectAt >= T0 + 2 * H - 12_000 &&
      later === base,
    "Z2a: a collect at a rewound clock pays nothing and keeps the station clock; the next collect pays only the hour after the first one",
    { base, later, anchor: station.lastCollectAt - T0 },
  );
  // A Rush started at a rewound clock REPLACES the old Rush window (it never adds a second one).
  let r = addHype(owning(["coffee"]), 100);
  const first = startHypeRush(r, T0 + 5 * H);
  const second = first.ok ? startHypeRush(addHype(first.save, 100), T0 + 4 * H) : null;
  const f2 = second && second.ok ? secondFloorOf(second.save) : null;
  assert(
    first.ok &&
      !!f2 &&
      f2.rushUntil! - f2.rushFrom! === HYPE_RUSH_MS &&
      (f2.rushFrom === T0 + 4 * H || f2.rushFrom === T0 + 5 * H),
    "Z2b: a second Rush started with the clock rewound leaves ONE Rush window of 3 minutes (never two, never longer)",
    f2 && { from: f2.rushFrom! - T0, until: f2.rushUntil! - T0 },
  );
}

console.log("N. Big numbers");
{
  assert(
    formatUsdBig(0) === "$0.00" &&
      formatUsdBig(6000) === formatUsd(6000) &&
      formatUsdBig(9_999_999) === formatUsd(9_999_999) &&
      formatUsdBig(10_000_000) === "$100K" &&
      formatUsdBig(123_456_789) === "$1.23M" &&
      formatUsdBig(4_560_000_000) === "$45.6M" &&
      formatUsdBig(99_960_000_00) === "$100M" &&
      formatUsdBig(7_890_000_000_000) === "$78.9B" &&
      formatUsdBig(-123_456_789) === "−$1.23M",
    "N1: below $100,000 the plain format; above it $123K, $1.23M, $45.6M, $100M, $78.9B (three digits, never '1000K')",
    [
      formatUsdBig(10_000_000),
      formatUsdBig(123_456_789),
      formatUsdBig(4_560_000_000),
      formatUsdBig(99_960_000_00),
      formatUsdBig(7_890_000_000_000),
    ],
  );
  assert(
    formatUsdBig(Number.MAX_SAFE_INTEGER).endsWith("Sp") === false ||
      /\$/.test(formatUsdBig(Number.MAX_SAFE_INTEGER)),
    "N2: the largest safe wallet still prints",
    formatUsdBig(Number.MAX_SAFE_INTEGER),
  );
}

console.log("Z. Fuzz: random sequences of every action, the clock going forward AND back");
{
  // Seeded (deterministic). After EVERY action: the wallet is a whole number of cents, never negative, below 2^53, and equals the
  // opening cash plus the signed ledger; every field is inside its limits; a failed action changes nothing; a station's clock never
  // moves backwards (a rewound device clock must not pay twice); the pile is a whole number of cents and never negative.
  let seed = 987654321;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const ids = STATIONS.map((d) => d.id);
  let violations: string[] = [];
  let actions = 0;
  let moneyMoves = 0;
  for (let run = 0; run < 250 && violations.length === 0; run++) {
    const opening = Math.floor(rnd() * 5_000_000_00);
    let sv: SaveData = { ...fresh(opening), economyLedger: [] };
    const branch = Math.floor(rnd() * (MAX_BRANCH + 1));
    if (branch > 0) sv = withFloor(sv, { stations: {}, branch });
    let t = T0 + Math.floor(rnd() * 10_000_000);
    for (let step = 0; step < 70; step++) {
      // time: mostly forward, sometimes a long jump, sometimes BACK (a rewound clock)
      const r = rnd();
      t +=
        r < 0.15
          ? -Math.floor(rnd() * 20 * H)
          : r < 0.25
            ? Math.floor(rnd() * 400 * H)
            : Math.floor(rnd() * 3 * H);
      const level = 1 + Math.floor(rnd() * 70);
      const before = sv;
      const f0 = secondFloorOf(before);
      const kind = pick([
        "buy",
        "table",
        "polish",
        "tier",
        "server",
        "cleaner",
        "collect",
        "flood",
        "golden",
        "hype",
        "rush",
        "branch",
      ] as const);
      const id = pick(ids);
      let res: ReturnType<typeof collectFloor> | null = null;
      switch (kind) {
        case "buy":
          res = buyStation(sv, id, level, t);
          break;
        case "table":
          res = buyTable(sv, id, t);
          break;
        case "polish":
          res = buyPolish(sv, id, t);
          break;
        case "tier":
          res = upgradeStation(sv, id, t, level);
          break;
        case "server":
          res = hireFloorStaff(sv, "server", t);
          break;
        case "cleaner":
          res = hireFloorStaff(sv, "cleaner", t);
          break;
        case "collect":
          res = collectFloor(sv, t);
          break;
        case "branch":
          res = openBranch(sv, t);
          break;
        case "rush":
          res = startHypeRush(sv, t);
          break;
        case "hype":
          sv = addHype(sv, 1 + Math.floor(rnd() * 100));
          break;
        case "flood": {
          const a = floodAmounts(sv, level, t);
          sv = addFloodBonus(sv, a.free, `lvl-${Math.floor(rnd() * 5)}`);
          break;
        }
        case "golden": {
          const g = goldenAt(t) ?? goldenOfSlot(Math.floor(t / GOLDEN_SLOT_MS));
          res = claimGolden(sv, g.slot, level, Math.max(g.arriveAt, t));
          break;
        }
      }
      actions++;
      if (res) {
        if (res.ok) {
          sv = res.save;
          moneyMoves += before.economyLedger.length === sv.economyLedger.length ? 0 : 1;
        } else if (res.ok === false && JSON.stringify(sv) !== JSON.stringify(before))
          violations.push(`${kind}: a refused action changed the save`);
      }
      const f = secondFloorOf(sv);
      const bad = (m: string) => violations.push(`run ${run} step ${step} ${kind}: ${m}`);
      if (!Number.isInteger(sv.credits) || sv.credits < 0 || sv.credits > Number.MAX_SAFE_INTEGER)
        bad(`wallet ${sv.credits}`);
      if (opening + ledgerSum(sv) !== sv.credits)
        bad(`wallet ${sv.credits} != opening ${opening} + ledger ${ledgerSum(sv)}`);
      for (const d of STATIONS) {
        const o = f.stations[d.id];
        if (!o) continue;
        if (
          o.level < 1 ||
          o.level > 3 ||
          (o.tables ?? 1) < 1 ||
          (o.tables ?? 1) > maxTablesAt(o.level) ||
          (o.polish ?? 0) < 0 ||
          (o.polish ?? 0) > MAX_POLISH
        )
          bad(`${d.id} out of limits ${JSON.stringify(o)}`);
        const o0 = f0.stations[d.id];
        if (o0 && (f.branch ?? 0) === (f0.branch ?? 0) && o.lastCollectAt < o0.lastCollectAt)
          bad(`${d.id} clock moved back ${o0.lastCollectAt} -> ${o.lastCollectAt} (${kind})`);
      }
      const pile = floorEarnings(sv, t);
      if (!Number.isInteger(pile) || pile < 0 || pile > Number.MAX_SAFE_INTEGER / 2)
        bad(`pile ${pile}`);
      if ((f.hype ?? 0) < 0 || (f.hype ?? 0) > HYPE_MAX || (f.bonus ?? 0) < 0)
        bad("hype or bonus out of range");
      if (violations.length) break;
    }
  }
  assert(
    violations.length === 0 && actions > 15_000,
    `Z1 ${actions} random actions over 250 runs (all twelve kinds, every branch, the clock going back): wallet = opening + ledger, whole non-negative cents below 2^53, every field in its limits, a refused action changes nothing, no station clock moves back`,
    violations.slice(0, 4),
  );
  void moneyMoves;
  violations = [];
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
      /u\.badge\(station!\.unlockLevel\)/.test(view) &&
      /const locked = !!station && !owned/.test(view),
    'L3: every unbought station shows the first floor\'s lock pill ("🔒 N services", then its price)',
  );
  const r = buyStation(fresh(1_000_000_00), "hotFood", 22, T0);
  const ok = buyStation(fresh(1_000_000_00), "hotFood", 23, T0);
  assert(
    !r.ok && r.reason === "locked" && ok.ok,
    "L4: Hot Food is refused at Level 22 and can be bought at Level 23",
  );
  const noStation = hireFloorStaff(fresh(1_000_000_00), "server", T0);
  assert(
    !noStation.ok && noStation.reason === "noStations",
    "L5: no staff can be hired before a machine is owned",
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
      secondFloor: {
        stations: { coffee: { level: 9, lastCollectAt: Number.NaN, tables: 99, polish: -4 } },
      },
    },
  } as unknown as SaveData;
  const bf = secondFloorOf(bad).stations.coffee!;
  assert(
    Object.keys(secondFloorOf(old).stations).length === 0 &&
      bf.level === 3 &&
      bf.lastCollectAt === 0 &&
      bf.tables === 10 &&
      bf.polish === 0,
    "S1: an old save owns nothing; bad saved values are clamped (tier 3, 10 tables, polish 0)",
  );
  // An old-shape station (the hourly model: {level, lastCollectAt} only) keeps its tier and reads as one table.
  const legacy = {
    ...structuredClone(DEFAULT_SAVE),
    credits: 777,
    business: {
      ...structuredClone(DEFAULT_SAVE.business),
      secondFloor: {
        stations: {
          coffee: { level: 2, lastCollectAt: T0 },
          drinks: { level: 1, lastCollectAt: T0 },
        },
        servers: 3,
        cleaners: 1,
      },
    },
  } as unknown as SaveData;
  const lf = secondFloorOf(legacy);
  assert(
    lf.stations.coffee?.level === 2 &&
      lf.stations.coffee?.tables === 1 &&
      lf.stations.coffee?.polish === 0 &&
      lf.servers === 3 &&
      lf.branch === 0 &&
      legacy.credits === 777 &&
      floorEarnings(legacy, T0 + 2 * H) > 0,
    "S2: an old-shape floor keeps its tiers and staff (no refunds, nothing taken away) and earns by the new rules",
  );
  const types = fs.readFileSync(
    path.join(path.resolve(import.meta.dirname, ".."), "src/game/business/businessTypes.ts"),
    "utf8",
  );
  assert(
    !("secondFloor" in DEFAULT_SAVE) && /secondFloor\?: SecondFloorState/.test(types),
    "S3: no new top-level save field — it lives in SaveData.business (optional)",
  );
}

console.log(failures ? `\nSECOND FLOOR QA: ${failures} FAILURE(S)` : "\nSECOND FLOOR QA: ALL PASS");
process.exit(failures ? 1 : 0);
