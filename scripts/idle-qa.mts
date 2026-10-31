/**
 * IDLE QA (phase 5, developer 2026-10-31): the idle economy's readable side.
 *
 *   P. The Pace (economy/pace.ts, paceFigures.ts, restaurantDay.closeDay): a closed day's takings and
 *      running costs come from the wallet's own ledger entries between opening and closing; per SHIFT hour;
 *      net = gross − costs to the cent; investments, ads, gifts and the Second Floor are not part of it;
 *      the latest 7 days are kept; a day with no opening mark (old save) records nothing.
 *   F. The Second Floor's fill (restaurant/floorFill.ts): real hours, 8/9/10 h caps, "full in", nothing for
 *      an unstaffed station.
 *   C. Clock rules (kept): backwards earns nothing; a pile collected at a far-future clock then read at the
 *      real time earns nothing (no re-earning); a forward jump is capped; two collects never pay twice.
 *   B. Badge-only achievement for the floor's lifetime takings: reward 0, so no achievement money moves.
 *   W. The wiring: the Pace card, the pile at the Pickup Counter, the while-you-were-away rows, Closing Time.
 *
 * Run: npx tsx scripts/idle-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const { appendLedgerEntry } = await import("../src/game/economy/EconomyLedger.ts");
const { PACE_AVERAGE_DAYS, averageLine, dayFigures, lineOfDay, paceOf } =
  await import("../src/game/economy/pace.ts");
const { SERVICE_SHIFT_HOURS } = await import("../src/game/business/businessStaff.ts");
const { closeDay, openDay, recordService, restaurantDayOf } =
  await import("../src/game/restaurant/restaurantDay.ts");
const {
  buyStation,
  collectFloor,
  floorEarnings,
  floorPerHour,
  hireFloorStaff,
  secondFloorOf,
  stationDef,
} = await import("../src/game/restaurant/secondFloor.ts");
const { durationText, fillText, floorFill, needsVisit, stationFill } =
  await import("../src/game/restaurant/floorFill.ts");
const { achievementsFor, collectableTotal } =
  await import("../src/game/progression/achievements.ts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const $ = (d: number) => d * 100;
const H = 3_600_000;

const fresh = (credits = $(100_000)): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  credits,
  economyLedger: [],
});

// ── P. the pace ──────────────────────────────────────────────────────────
{
  const day = (extra: (s: SaveData) => SaveData, level = 5, services = 2): SaveData => {
    let s = openDay(fresh(), level);
    s = extra(s);
    for (let i = 0; i < services; i++) s = recordService(s, level + i);
    return s;
  };
  const earned = (s: SaveData) => {
    s = appendLedgerEntry(s, "campaign-settlement", $(30), "r1");
    s = appendLedgerEntry(s, "completion-reward", $(50), "level");
    s = appendLedgerEntry(s, "customer-tip", $(4), "tip");
    s = appendLedgerEntry(s, "inventory-purchase", -$(12), "groceries");
    s = appendLedgerEntry(s, "business-staff-salary", -$(8), "wages");
    // Not part of the pace: an investment, an ad, a gift, the floor's own money.
    s = appendLedgerEntry(s, "knife-purchase", -$(200), "knife");
    s = appendLedgerEntry(s, "rewarded-ad", $(40), "ad");
    s = appendLedgerEntry(s, "daily-reward", $(20), "gift");
    s = appendLedgerEntry(s, "automation-income", $(77), "floor");
    return s;
  };
  const figures = dayFigures(earned(fresh()).economyLedger);
  check(
    "P1 a day's takings are order pay + level pay + tips; its costs groceries + wages; investments, ads, gifts and the floor are left out",
    figures.gross === $(84) && figures.costs === $(20),
    figures,
  );
  const l = lineOfDay({ gross: $(84), costs: $(20) });
  check(
    "P2 per SHIFT hour: gross and costs divide by the shift hours the staff are paid in, and net = gross − costs to the cent",
    SERVICE_SHIFT_HOURS === 2 &&
      l.gross === $(42) &&
      l.costs === $(10) &&
      l.net === l.gross - l.costs &&
      lineOfDay({ gross: 101, costs: 33 }).net ===
        lineOfDay({ gross: 101, costs: 33 }).gross - lineOfDay({ gross: 101, costs: 33 }).costs,
    l,
  );
  check(
    "P3 the average of nothing is null; of days it is the mean (and net = gross − costs again)",
    averageLine([]) === null &&
      averageLine([
        { gross: $(80), costs: $(20) },
        { gross: $(100), costs: $(40) },
      ])!.gross === $(45) &&
      averageLine([
        { gross: 101, costs: 7 },
        { gross: 50, costs: 9 },
      ])!.net ===
        averageLine([
          { gross: 101, costs: 7 },
          { gross: 50, costs: 9 },
        ])!.gross -
          averageLine([
            { gross: 101, costs: 7 },
            { gross: 50, costs: 9 },
          ])!.costs,
  );

  // The day is recorded by closeDay from the entries written after it opened.
  const before = fresh();
  let s = openDay(appendLedgerEntry(before, "campaign-settlement", $(999), "yesterday"), 5);
  s = earned(s);
  s = recordService(recordService(s, 5), 6);
  const closing = restaurantDayOf(s);
  const closed = closeDay(s, 6);
  const rec = restaurantDayOf(closed).paceDays ?? [];
  check(
    "P4 closing the day saves ITS figures only (what was in the ledger before it opened is not counted), and the new day starts without a mark",
    closing.closingDue &&
      rec.length === 1 &&
      rec[0]!.gross === $(84) &&
      rec[0]!.costs >= $(20) &&
      restaurantDayOf(closed).openingLedgerId === undefined &&
      restaurantDayOf(closed).day === closing.day + 1,
    { rec, day: restaurantDayOf(closed).day },
  );
  const p = paceOf(closed, Date.now());
  check(
    "P5 the Pace reads those days: last = average after one day; nothing before the first closing",
    p.days === 1 &&
      p.last !== null &&
      p.last.gross === p.average!.gross &&
      paceOf(fresh(), Date.now()).last === null &&
      paceOf(fresh(), Date.now()).average === null,
    p,
  );

  // Seven days kept, oldest dropped.
  let long = fresh();
  for (let d = 0; d < 9; d++) {
    long = openDay(long, 5);
    long = appendLedgerEntry(long, "campaign-settlement", $(10 + d), `d${d}`);
    long = recordService(recordService(long, 5), 6);
    long = closeDay(long, 6);
  }
  const kept = restaurantDayOf(long).paceDays ?? [];
  check(
    "P6 only the latest 7 closed days are kept, oldest first",
    PACE_AVERAGE_DAYS === 7 &&
      kept.length === 7 &&
      kept[0]!.gross === $(12) &&
      kept[6]!.gross === $(18),
    kept.map((k) => k.gross / 100),
  );

  // A day with no opening mark (opened by an older build) records nothing, never a wrong figure.
  const old = { ...openDay(fresh(), 5) };
  const oldNoMark = {
    ...old,
    business: {
      ...old.business,
      restaurantDay: (() => {
        const { openingLedgerId: _drop, ...rest } = restaurantDayOf(old);
        void _drop;
        return rest;
      })(),
    },
  } as SaveData;
  const oldClosed = closeDay(recordService(recordService(oldNoMark, 5), 6), 6);
  check(
    "P7 an old save's day (no opening mark) records nothing and still closes",
    (restaurantDayOf(oldClosed).paceDays ?? []).length === 0 &&
      restaurantDayOf(oldClosed).day === 2,
  );
  // The mark fell out of the kept ledger: unknown, not a guess.
  let gone = openDay(fresh(), 5);
  const mark = restaurantDayOf(gone).openingLedgerId;
  gone = { ...gone, economyLedger: [] };
  gone = appendLedgerEntry(gone, "campaign-settlement", $(5), "x");
  gone = recordService(recordService(gone, 5), 6);
  void mark;
  const goneClosed = closeDay(
    {
      ...gone,
      business: {
        ...gone.business,
        restaurantDay: { ...restaurantDayOf(gone), openingLedgerId: "not-in-the-ledger" },
      },
    },
    6,
  );
  check(
    "P8 a mark that is no longer in the kept ledger records nothing (never a wrong total)",
    (restaurantDayOf(goneClosed).paceDays ?? []).length === 0,
  );
}

// ── F. the floor's fill ──────────────────────────────────────────────────
function floorSave(now: number): SaveData {
  let s = fresh();
  const b = buyStation(s, "coffee", 60, now);
  if (!b.ok) throw new Error("buy " + b.reason);
  s = b.save;
  const h = hireFloorStaff(s, "server", now);
  if (!h.ok) throw new Error("hire " + h.reason);
  s = h.save;
  const c = hireFloorStaff(s, "cleaner", now);
  if (!c.ok) throw new Error("hire " + c.reason);
  return c.save;
}
{
  const T0 = 1_800_000_000_000;
  const s = floorSave(T0);
  const floor = secondFloorOf(s);
  const cap = stationDef("coffee").capHours[0]!;
  const half = stationFill(floor, "coffee", T0 + (cap / 2) * H)!;
  const full = stationFill(floor, "coffee", T0 + (cap + 5) * H)!;
  check(
    "F1 a working station fills over the real hours of its cap (Lv 1 = 8 h): half way is 50%, past the cap it is full and stays 100%",
    cap === 8 &&
      Math.abs(half.fraction - 0.5) < 1e-9 &&
      !half.full &&
      Math.abs(half.msToFull - (cap / 2) * H) < 2 &&
      full.full &&
      full.fraction === 1 &&
      full.msToFull === 0,
    { half, full },
  );
  check(
    "F2 a station that isn't owned, or has no Floor Server, stores nothing: no fill",
    stationFill(floor, "pizza", T0 + H) === null &&
      stationFill(
        secondFloorOf({
          ...s,
          business: { ...s.business, secondFloor: { ...floor, servers: 0 } },
        } as SaveData),
        "coffee",
        T0 + H,
      ) === null,
  );
  check(
    "F3 the whole floor: nothing working → null; nearly full from 80%; 'full in' text names the time",
    floorFill(fresh(), T0) === null &&
      needsVisit(floorFill(s, T0 + 7 * H)) &&
      !needsVisit(floorFill(s, T0 + 2 * H)) &&
      durationText(2 * H + 10 * 60_000) === "2 h 10 min" &&
      durationText(45 * 60_000) === "45 min" &&
      durationText(30_000) === "under a minute" &&
      fillText(floorFill(s, T0 + 2 * H)!) === "Full in 6 h" &&
      fillText(floorFill(s, T0 + 9 * H)!) === "Full · not earning",
    fillText(floorFill(s, T0 + 2 * H)!),
  );
  const pace = paceOf(s, T0 + 4 * H);
  check(
    "F4 the Pace's floor numbers are the floor's own: rate, what is waiting, and the fill",
    pace.floorPerHour === floorPerHour(s) &&
      pace.floorWaiting === floorEarnings(s, T0 + 4 * H) &&
      pace.floorWaiting > 0 &&
      pace.floorFill !== null,
    pace,
  );
}

// ── C. clock rules ───────────────────────────────────────────────────────
{
  const T0 = 1_800_000_000_000;
  const s = floorSave(T0);
  const back = floorEarnings(s, T0 - 5 * H);
  const capped = floorEarnings(s, T0 + 100 * H);
  const capOnce = floorEarnings(s, T0 + 8 * H);
  check(
    "C1 a clock set backwards earns nothing (never negative); a jump forward is still capped at the cap",
    back === 0 && capped === capOnce && capped > 0,
    { back, capped, capOnce },
  );
  // Collect while the clock is far in the future, then read the real time again: nothing, until it catches up.
  const future = T0 + 30 * 24 * H;
  const taken = collectFloor(s, future);
  const afterBack = taken.ok ? floorEarnings(taken.save, T0 + 2 * H) : -1;
  const again = taken.ok ? collectFloor(taken.save, future) : null;
  check(
    "C2 collecting at a far-future clock and then going back earns nothing (the timers restart in the future); a second tap pays nothing",
    taken.ok && afterBack === 0 && again?.ok === false,
    { afterBack },
  );
  // Setting the clock back and forward again cannot earn more than the cap from the last collect.
  const t1 = collectFloor(s, T0 + 4 * H);
  const wobble = t1.ok
    ? Math.max(
        floorEarnings(t1.save, T0 + 4 * H - 3 * H),
        floorEarnings(t1.save, T0 + 4 * H + 100 * H),
      )
    : -1;
  check(
    "C3 back-and-forward never earns more than one cap from the last collect",
    t1.ok && wobble <= capOnce,
    { wobble, capOnce },
  );
  check(
    "C4 one entry per collect: wallet = opening cash + signed ledger",
    taken.ok &&
      taken.save.credits - s.credits === taken.amount &&
      taken.save.economyLedger.length === s.economyLedger.length + 1 &&
      taken.save.economyLedger.at(-1)!.category === "automation-income",
  );
}

// ── B. badge-only achievement ────────────────────────────────────────────
{
  const base = fresh();
  const withLifetime = (cents: number): SaveData => ({
    ...base,
    economy: {
      ...base.economy,
      lifetime: { ...base.economy.lifetime, "automation-income": cents },
    },
  });
  const floorAch = (s: SaveData) => achievementsFor(s).filter((a) => a.id.startsWith("ach-floor-"));
  check(
    "B1 the Second Floor badges: $1,000 / $10,000 / $50,000 lifetime, all reward 0, reached only at their target",
    floorAch(base).length === 3 &&
      floorAch(base).every((a) => a.reward === 0 && !a.reached) &&
      floorAch(withLifetime($(1_000))).filter((a) => a.reached).length === 1 &&
      floorAch(withLifetime($(60_000))).filter((a) => a.reached).length === 3,
    floorAch(withLifetime($(1_000))).map((a) => [a.id, a.reached]),
  );
  check(
    "B2 badges pay nothing: the collectable achievement money does not change",
    collectableTotal(withLifetime($(60_000))) === collectableTotal(base),
  );
}

// ── W. wiring ────────────────────────────────────────────────────────────
{
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  const card = read("src/components/kc/business/PaceCard.tsx");
  const view = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  const router = read("src/ScreensRouter.tsx");
  const app = read("src/App.tsx");
  const sheet = read("src/components/kc/ads/AdBonusSheet.tsx");
  const closing = read("src/components/kc/restaurant/ClosingTime.tsx");
  check(
    "W1 the Pace card sits on the Business overview in both layouts, and says the restaurant is per shift hour and the floor per real hour",
    (dash.match(/<PaceCard save=\{save\} \/>/g) ?? []).length === 2 &&
      /data-testid="pace-card"/.test(card) &&
      /shift hour/.test(card) &&
      /real clock/.test(card),
  );
  check(
    "W2 the Second Floor shows a bar and 'full in' per station and for the floor, and the takings lie on the Pickup Counter as a tappable pile",
    /<FillBar fill=\{wholeFill\} testId="floor-fill"/.test(view) &&
      /testId="station-fill"/.test(view) &&
      /<TableCash[\s\S]{0,200}at=\{PICKUP_CASH_AT\}[\s\S]{0,200}onCollect=\{\(\) => act\(\{ kind: "collect" \}\)\}/.test(
        view,
      ),
  );
  check(
    "W3 the map's upstairs button names the money waiting and says when the floor is full",
    /formatUsd\(waitingCents\)/.test(router) && /needsVisit\(floorFill\(/.test(router),
  );
  check(
    "W4 on return, ONE sheet: the floor's pile and the table cash are free rows (only what was already earned), the ad line is the existing welcome_back bonus; shown after the daily gift",
    /function openWelcomeBack\(\)/.test(app) &&
      /floorWaiting/.test(app) &&
      /tableWaiting/.test(app) &&
      /data-testid="away-floor"/.test(sheet) &&
      /data-testid="away-tables"/.test(sheet) &&
      /collectFloor\(current, Date\.now\(\)\)/.test(app),
  );
  check(
    "W5 Closing Time names what waits on the Second Floor (collecting it stays optional; Close does not wait for it)",
    /data-testid="closing-floor"/.test(closing) &&
      /disabled=\{left > 0 \|\| tableCash > 0\}/.test(closing),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
