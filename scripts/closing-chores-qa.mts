/**
 * CLOSING CHORES QA — the player closes up (developer 2026-10-23: "do not
 * automate the important tasks while closing, let the player do everything
 * unless he hires a cleaner"). Tested with the real functions.
 *
 *  C. The list: tonight's chores by level, none done at first; each tap does
 *     one (once); only while closing is due; unknown ids refused.
 *  W. Wash up: with dishes in the sink and soap, the sink game comes first
 *     (the tap is refused until the sink is empty); no soap → the tap is
 *     allowed (the dishes wait for START: never a soft-lock).
 *  K. A Cleaner on duty (hired, or for the day) does every chore but the
 *     count; at closing they wash the sink by hand (soap, nothing breaks, no
 *     money, no ledger); no Cleaner → `cleanerClosing` changes nothing.
 *  D. The day: closing clears tonight's chores (a new day starts with none);
 *     old saves without `closingDone` read none; nothing outside
 *     `business.restaurantDay` is added.
 *  U. Wiring: Closing Time's button stays locked until every chore is done;
 *     App does each chore through `doClosingChore` and runs `cleanerClosing`
 *     before `closeDay`; the sim mirrors it.
 *
 * Run: npx tsx scripts/closing-chores-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  cleanerClosing,
  closingChoreList,
  closingChoresLeft,
  doClosingChore,
} from "../src/game/restaurant/closingChores.ts";
import { closeDay, restaurantDayOf } from "../src/game/restaurant/restaurantDay.ts";
import { restaurantSuppliesOf, sinkPieces } from "../src/game/restaurant/serviceSupplies.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

/** A save at Level `n` whose day is due to close, with `dirty` in the sink and `soap` bottles. */
function closingAt(
  n: number,
  {
    dirty = {},
    soap = 2,
    cleaner = false,
  }: { dirty?: Partial<Record<SupplyId, number>>; soap?: number; cleaner?: boolean } = {},
): SaveData {
  const base = structuredClone(DEFAULT_SAVE);
  const stock = { ...base.business.supplies.stock };
  if (soap) stock["dish-soap"] = { units: soap, costBasis: soap * 1500 };
  const save: SaveData = {
    ...base,
    credits: 500_000,
    levelProgress: {
      ...base.levelProgress,
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    business: {
      ...base.business,
      supplies: { ...base.business.supplies, stock },
      staff: {
        ...base.business.staff,
        hiredRoles: cleaner
          ? [...base.business.staff.hiredRoles, "cleaner"]
          : base.business.staff.hiredRoles,
      },
      restaurantDay: {
        day: 4,
        opened: true,
        servicesDone: 3,
        servicesPlanned: 3,
        closingDue: true,
        openingCredits: 400_000,
        openingLevel: n - 2,
      },
    },
  };
  return {
    ...save,
    business: {
      ...save.business,
      restaurantSupplies: {
        ...restaurantSuppliesOf(save),
        soapPct: soap ? 60 : 0,
        dirty: dirty as Record<SupplyId, number>,
      },
    },
  };
}
const doAll = (s: SaveData, n: number) => {
  for (const c of closingChoreList(s, n)) {
    const r = doClosingChore(s, c.id, n);
    if (r.ok) s = r.save;
  }
  return s;
};

// ---------- C. The list ----------
{
  const early = closingChoreList(closingAt(12), 12).map((c) => c.id);
  const late = closingChoreList(closingAt(40), 40).map((c) => c.id);
  assert(
    early.includes("wash-up") &&
      early.includes("count") &&
      !early.includes("dining-room") &&
      late.includes("dining-room") &&
      late.includes("spoiled") &&
      late.includes("wrap"),
    `C1: tonight's chores follow the level (L12 ${early.join(",")} · L40 ${late.join(",")})`,
  );
  const s = closingAt(40);
  assert(
    closingChoreList(s, 40).every((c) => c.by === null) && closingChoresLeft(s, 40) === late.length,
    "C2: none is done at first: every chore is the player's",
  );
  const r1 = doClosingChore(s, "wipe-down", 40);
  const r2 = r1.ok ? doClosingChore(r1.save, "wipe-down", 40) : r1;
  assert(
    r1.ok &&
      closingChoresLeft(r1.save, 40) === late.length - 1 &&
      closingChoreList(r1.save, 40).find((c) => c.id === "wipe-down")?.by === "player" &&
      !r2.ok &&
      r2.reason === "done",
    "C3: a tap does one chore, once (a second tap is refused)",
  );
  const notDue = structuredClone(s);
  notDue.business.restaurantDay = { ...notDue.business.restaurantDay!, closingDue: false };
  const r3 = doClosingChore(notDue, "wipe-down", 40);
  const r4 = doClosingChore(s, "polish-the-moon", 40);
  assert(
    !r3.ok && r3.reason === "not-closing" && !r4.ok && r4.reason === "unknown",
    "C4: only while closing is due; unknown chores refused",
  );
  const all = doAll(s, 40);
  assert(
    closingChoresLeft(all, 40) === 0 && all.credits === s.credits,
    "C5: every chore done → nothing left; the taps move no money",
  );
  assert(
    all.economyLedger.length === s.economyLedger.length &&
      JSON.stringify(all.business.inventory) === JSON.stringify(s.business.inventory),
    "C6: the taps write no ledger entry and touch no stock (closeDay still does the work)",
  );
}

// ---------- W. Wash up ----------
{
  const s = closingAt(40, { dirty: { "dinner-plates": 4, "dinner-forks": 4 } });
  const wash = closingChoreList(s, 40).find((c) => c.id === "wash-up");
  const r = doClosingChore(s, "wash-up", 40);
  assert(
    wash?.sinkFirst === 8 && !r.ok && r.reason === "sink",
    "W1: dishes in the sink with soap → the sink game first (the tap is refused)",
  );
  const empty = closingAt(40);
  const r2 = doClosingChore(empty, "wash-up", 40);
  assert(r2.ok, "W2: the sink empty → one tap does the knives and pans");
  const noSoap = closingAt(40, { dirty: { "dinner-plates": 4 }, soap: 0 });
  const r3 = doClosingChore(noSoap, "wash-up", 40);
  assert(
    r3.ok && sinkPieces(r3.save) === 4,
    "W3: no dish soap → the tap is allowed and the dishes wait for START (no soft-lock)",
  );
}

// ---------- K. A Cleaner on duty ----------
{
  const s = closingAt(40, { dirty: { "dinner-plates": 4, "water-glasses": 3 }, cleaner: true });
  const list = closingChoreList(s, 40);
  assert(
    list.filter((c) => c.id !== "count").every((c) => c.by === "cleaner") &&
      list.find((c) => c.id === "count")?.by === null &&
      closingChoresLeft(s, 40) === 1,
    "K1: a hired Cleaner does every chore but the count (the money is the owner's)",
  );
  const day = closingAt(40, { dirty: { "dinner-plates": 4 } });
  day.business.cleanliness = { ...day.business.cleanliness, dayCleanerDay: 4 };
  assert(
    closingChoreList(day, 40).find((c) => c.id === "wash-up")?.by === "cleaner",
    "K2: a Cleaner for the day counts too",
  );
  const c = cleanerClosing(s);
  const st0 = restaurantSuppliesOf(s);
  const st1 = restaurantSuppliesOf(c.save);
  assert(
    c.washed === 7 &&
      sinkPieces(c.save) === 0 &&
      st1.brokenTotal === st0.brokenTotal &&
      st1.washedTotal === st0.washedTotal + 7 &&
      c.save.credits === s.credits &&
      c.save.economyLedger.length === s.economyLedger.length,
    "K3: at closing the Cleaner washes the sink by hand: nothing breaks, no money, no ledger",
  );
  const none = closingAt(40, { dirty: { "dinner-plates": 4 } });
  assert(
    cleanerClosing(none).save === none &&
      cleanerClosing(closingAt(40, { dirty: { "dinner-plates": 4 }, soap: 0, cleaner: true }))
        .washed === 0,
    "K4: no Cleaner → unchanged; a Cleaner with no soap leaves the dishes for START",
  );
}

// ---------- D. The day and saves ----------
{
  const s = doAll(closingAt(40), 40);
  const next = closeDay(s, 40);
  assert(
    (restaurantDayOf(next).closingDone ?? []).length === 0 && restaurantDayOf(next).day === 5,
    "D1: closing clears tonight's chores; Day 5 starts with none",
  );
  const old = closingAt(40);
  const raw = { ...old.business.restaurantDay! } as Record<string, unknown>;
  delete raw.closingDone;
  old.business.restaurantDay = raw as never;
  const junk = closingAt(40);
  junk.business.restaurantDay = {
    ...junk.business.restaurantDay!,
    closingDone: [3, null] as never,
  };
  assert(
    (restaurantDayOf(old).closingDone ?? []).length === 0 &&
      (restaurantDayOf(junk).closingDone ?? []).length === 0,
    "D2: old saves (no closingDone) and junk read none",
  );
  const before = Object.keys(closingAt(40)).sort().join();
  const after = Object.keys(s).sort().join();
  const bizBefore = Object.keys(closingAt(40).business).sort().join();
  const bizAfter = Object.keys(s.business).sort().join();
  assert(
    before === after && bizBefore === bizAfter,
    "D3: no new save field (it lives in business.restaurantDay)",
  );
}

// ---------- U. Wiring ----------
{
  const view = read("src/components/kc/restaurant/ClosingTime.tsx");
  const app = read("src/App.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  assert(
    /closingChoreList\(save, restaurantLevel\)/.test(view) &&
      /disabled=\{left > 0\}/.test(view) &&
      /variant="button"/.test(view),
    "U1: Closing Time lists the player's chores, wash up opens the sink, Close stays locked until done",
  );
  assert(
    /doClosingChore\(save, id, restaurantLevelOf\(save\.levelProgress\)\)/.test(app) &&
      /closeDay\(cleanerClosing\(save\)\.save, restaurantLevelOf\(save\.levelProgress\)\)/.test(
        app,
      ) &&
      /closeDay\(cleanerClosing\(s\)\.save, restaurantLevel\)/.test(app),
    "U2: App does each chore through doClosingChore and lets the Cleaner wash before closeDay",
  );
  assert(
    /closeDay\(cleanerClosing\(s\)\.save, lvl\)/.test(sim),
    "U3: the sim's Cleaner washes at closing too",
  );
  assert(
    !/Math\.random\(/.test(read("src/game/restaurant/closingChores.ts")),
    "U4: no Math.random",
  );
}

console.log(failures ? `CLOSING CHORES QA: ${failures} FAILURE(S)` : "CLOSING CHORES QA: ALL PASS");
process.exit(failures ? 1 : 0);
