/**
 * SECOND FLOOR QA — the automated food hall (developer 2026-10-16;
 * src/game/restaurant/secondFloor.ts).
 *
 *  C  Catalog: six stations (Ice Cream replaces Pasta & Noodle), the floor
 *     opens at L60, unlocks rise, prices and rates rise with level.
 *  E  Earnings: rate × real hours, capped; a clock set back earns 0; a big
 *     jump forward is still capped; nothing earns before it is bought.
 *  B  Buy / upgrade: all-or-nothing through the wallet, one ledger entry
 *     each; locked before its level; can't buy twice; Lv 3 is the top;
 *     an upgrade banks the income already earned first.
 *  K  Collect: one credit, ONE ledger entry, opening + ledger = closing;
 *     a second tap pays nothing; every clock restarts.
 *  S  Saves: an old save has no floor (nothing owned); no new top-level field.
 *
 * Run: npx tsx scripts/restaurant-second-floor-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  MAX_STATION_LEVEL,
  SECOND_FLOOR_OPENS_AT,
  STATIONS,
  buyStation,
  collectFloor,
  floorEarnings,
  floorPerHour,
  isSecondFloorOpen,
  secondFloorOf,
  stationDef,
  upgradeStation,
} from "../src/game/restaurant/secondFloor.ts";

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

console.log("C. Catalog");
{
  const ids = STATIONS.map((s) => s.id).join();
  assert(
    ids === "coffee,drinks,pizza,burger,iceCream,hotFood" &&
      SECOND_FLOOR_OPENS_AT === 60 &&
      STATIONS[0]!.unlockLevel === SECOND_FLOOR_OPENS_AT &&
      STATIONS.every((s, i) => i === 0 || s.unlockLevel > STATIONS[i - 1]!.unlockLevel) &&
      STATIONS.every((s) => s.unlockLevel <= 150),
    "C1: six stations (Ice Cream, no Pasta & Noodle), the floor and Coffee at L60, each later one later, all within the campaign",
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
  assert(!isSecondFloorOpen(59) && isSecondFloorOpen(60), "C3: closed at L59, open at L60");
}

console.log("E. Earnings");
{
  const bought = buyStation(fresh(1_000_000), "coffee", 60, T0);
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
  const locked = buyStation(fresh(10_000_000), "pizza", 84, T0);
  const closed = buyStation(fresh(10_000_000), "coffee", 59, T0);
  assert(
    !locked.ok && locked.reason === "locked" && !closed.ok && closed.reason === "locked",
    "B1: a station is locked before its level (and the floor before L60)",
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
  const rich = buyStation(fresh(10_000_000), "coffee", 60, T0);
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
  let s = fresh(10_000_000);
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
