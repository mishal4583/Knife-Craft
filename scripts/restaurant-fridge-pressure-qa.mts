/**
 * RESTAURANT FRIDGE PRESSURE QA — does the fridge ever matter? (developer
 * 2026-10-06: "simulate first with the current values, then make the
 * smallest evidence-based change".) Read-only measurement of the REAL
 * simulations — nothing here changes play:
 *
 *  - the campaign: the completionist (diligent) player of the full
 *    restaurant simulation (restaurantCampaignSim.mts), every step observed;
 *    reported at L11, 31, 51, 71, 91, 121, 161, 181 and 250;
 *  - the Endless Restaurant: 30 days of the fully staffed restaurant and
 *    the thinly staffed full menu (restaurant-endless-qa.mts playDay).
 *
 * Per point: menu size, orders served (services), stock bought / used /
 * spoiled (units), peak fridge occupancy against the fridge's capacity, the
 * day's whole stock need (what a player stocking a whole day up front would
 * hold), fridge upgrades, events. Checks are invariants only (never over
 * capacity except Grandma's free goods, no soft-lock); the numbers are the
 * evidence for docs/RESTAURANT_FRIDGE_PRESSURE.md.
 *
 * Run: npx tsx scripts/restaurant-fridge-pressure-qa.mts
 */
import { run, freshRestaurantSave } from "./restaurantCampaignSim.mts";
import { playDay, configure, ALL_ROLES, ALL_CHEFS } from "./restaurant-endless-qa.mts";
import type { SaveData } from "../src/game/SaveManager.ts";
import {
  getInventoryUsedCapacity,
  getRefrigeratorCapacity,
} from "../src/game/business/RefrigeratorManager.ts";
import { activeMenuDishes, restaurantLevelOf } from "../src/game/restaurant/restaurantMenu.ts";
import { eventsForDay } from "../src/game/restaurant/restaurantEvents.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const used = (s: SaveData) => getInventoryUsedCapacity(s.business.inventory);
const cap = (s: SaveData) => getRefrigeratorCapacity(s.business.refrigerator.refrigeratorId);
const r1 = (n: number) => Math.round(n * 10) / 10;

type Point = {
  level: number;
  menu: number;
  orders: number;
  bought: number;
  usedUnits: number;
  spoiled: number;
  peak: number;
  capacity: number;
  fridge: string;
  dayNeed: number;
};

/* ── Campaign ─────────────────────────────────────────────── */
const POINTS = [11, 31, 51, 71, 91, 121, 161, 181, 250];
const perLevel = new Map<number, Point>();
let prev: SaveData | null = null;
let prevLevel = 0;
let dayUse = 0; // units used since the last closing
const dayNeedAt = new Map<number, number>();
let maxOccupancy = 0;
let maxAt = "";
let overCap = 0;
let upgrades: string[] = [];

const point = (n: number, s: SaveData): Point => {
  let p = perLevel.get(n);
  if (!p) {
    p = {
      level: n,
      menu: activeMenuDishes(s.business.menuActivation, n).length,
      orders: 0,
      bought: 0,
      usedUnits: 0,
      spoiled: 0,
      peak: 0,
      capacity: cap(s),
      fridge: s.business.refrigerator.refrigeratorId,
      dayNeed: 0,
    };
    perLevel.set(n, p);
  }
  return p;
};

const sim = run(
  "completionist (fridge study)",
  freshRestaurantSave(),
  1,
  {
    profile: "completionist",
    observe(where, s) {
      const m = /^L(\d+) (.+)$/.exec(where);
      const n = m ? Number(m[1]) : prevLevel || 250;
      const step = m ? m[2]! : where;
      const p = point(n, s);
      const before = prev ? used(prev) : 0;
      const now = used(s);
      const delta = now - before;
      if (
        prev &&
        prev.business.refrigerator.refrigeratorId !== s.business.refrigerator.refrigeratorId
      )
        upgrades.push(
          `L${n}: ${prev.business.refrigerator.refrigeratorId} → ${s.business.refrigerator.refrigeratorId}`,
        );
      if (step === "buy" || step === "guest stock") p.bought += Math.max(0, delta);
      else if (step === "serve" || step === "guest") {
        p.usedUnits += Math.max(0, -delta);
        dayUse += Math.max(0, -delta);
        if (step === "serve") p.orders++;
        if (step === "guest") p.orders++;
      } else if (step.includes("closing")) {
        p.spoiled += Math.max(0, -delta);
        dayNeedAt.set(n, dayUse);
        dayUse = 0;
      }
      p.capacity = cap(s);
      p.fridge = s.business.refrigerator.refrigeratorId;
      p.peak = Math.max(p.peak, now);
      if (now > cap(s) + 1e-9) overCap++;
      if (now / cap(s) > maxOccupancy) {
        maxOccupancy = now / cap(s);
        maxAt = `L${n} ${step}`;
      }
      prev = s;
      prevLevel = n;
    },
  },
  false,
);
// The day's whole need for a level = the units used over the restaurant day it belongs to.
{
  const closings = [...dayNeedAt.keys()].sort((a, b) => a - b);
  for (const p of perLevel.values()) {
    const close = closings.find((c) => c > p.level) ?? closings.at(-1);
    p.dayNeed = close !== undefined ? (dayNeedAt.get(close) ?? 0) : 0;
  }
}

console.log("Campaign (completionist, the full restaurant simulation)");
console.log(
  "  level | menu | orders | bought | used | spoiled | peak / capacity (fridge) | that day's whole stock need",
);
for (const n of POINTS) {
  const p = perLevel.get(n)!;
  console.log(
    `  L${String(n).padEnd(4)}| ${String(p.menu).padEnd(5)}| ${String(p.orders).padEnd(7)}| ${String(r1(p.bought)).padEnd(7)}| ${String(r1(p.usedUnits)).padEnd(5)}| ${String(r1(p.spoiled)).padEnd(8)}| ${r1(p.peak)} / ${p.capacity} (${p.fridge}) = ${Math.round((p.peak / p.capacity) * 100)}% | ${r1(p.dayNeed)} units = ${Math.round((p.dayNeed / p.capacity) * 100)}% of the fridge`,
  );
}
const allPeaks = [...perLevel.values()];
console.log(
  `  Whole campaign: highest occupancy ${Math.round(maxOccupancy * 100)}% (${maxAt}); fridge upgrades: ${upgrades.length ? upgrades.join(", ") : "none"}; levels at ≥ 85% (nearly full): ${allPeaks.filter((p) => p.peak / p.capacity >= 0.85).length}; biggest day's need ${r1(Math.max(...dayNeedAt.values()))} units`,
);
console.log(
  `  Fridge upgrades forced by a full fridge: ${sim.stats.fridgeUpgrades} (the rest are the completionist buying every item). Events: none in the campaign (Endless only).`,
);

/* ── A diligent player who never buys a fridge unless one is full ── */
let dPeak = 0;
let dPeakAt = "";
let dNear = 0;
const diligent = run(
  "diligent (fridge study)",
  freshRestaurantSave(),
  1,
  {
    profile: "diligent",
    observe(where, s) {
      const occ = used(s) / cap(s);
      if (occ >= 0.85) dNear++;
      if (occ > dPeak) {
        dPeak = occ;
        dPeakAt = `${where} (${s.business.refrigerator.refrigeratorId})`;
      }
    },
  },
  false,
);
console.log(
  `Diligent player (buys a fridge only when one is full): highest occupancy ${Math.round(dPeak * 100)}% at ${dPeakAt}; steps at ≥ 85%: ${dNear}; forced upgrades: ${diligent.stats.fridgeUpgrades}; levels ${diligent.stats.levels}/250`,
);

/* ── Endless ──────────────────────────────────────────────── */
const L250 = sim.s;
const endless: Array<[string, SaveData]> = [
  ["Fully staffed, 48 dishes", configure(L250, ALL_ROLES, ALL_CHEFS, 48)],
  ["Thin staff (prep, server), 48 dishes", configure(L250, ["prep-cook", "server"], [], 48)],
];
const endlessRows: Array<{
  name: string;
  peak: number;
  capacity: number;
  dayNeed: number;
  customers: number;
  spoiled: number;
  bought: number;
  rush: number;
  group: number;
}> = [];
for (const [name, start] of endless) {
  let s = start;
  let peak = 0;
  let maxDayNeed = 0;
  let customers = 0;
  let spoiled = 0;
  let bought = 0;
  let rush = 0;
  let group = 0;
  let overDay = 0;
  for (let d = 0; d < 30; d++) {
    const ev = eventsForDay(s, s.business.calendar.businessDay);
    if (ev.some((e) => e.id === "dinner-rush")) rush++;
    if (ev.some((e) => e.id === "large-group")) group++;
    let last = used(s);
    let dayNeed = 0;
    const r = playDay(s, {
      observe(step, x) {
        const now = used(x);
        if (step === "buy") bought += Math.max(0, now - last);
        if (step === "serve") dayNeed += Math.max(0, last - now);
        if (step === "closing") spoiled += Math.max(0, last - now);
        peak = Math.max(peak, now);
        if (now > cap(x) + 1e-9) overDay++;
        last = now;
      },
    });
    s = r.save;
    customers += r.served;
    maxDayNeed = Math.max(maxDayNeed, dayNeed);
  }
  if (overDay) overCap += overDay;
  endlessRows.push({
    name,
    peak,
    capacity: cap(s),
    dayNeed: maxDayNeed,
    customers: customers / 30,
    spoiled,
    bought,
    rush,
    group,
  });
}
console.log("Endless Restaurant (30 days, events on)");
for (const e of endlessRows)
  console.log(
    `  ${e.name}: ${r1(e.customers)} customers/day · bought ${r1(e.bought)} · spoiled ${r1(e.spoiled)} units · peak ${r1(e.peak)} / ${e.capacity} (${Math.round((e.peak / e.capacity) * 100)}%) · biggest day's whole need ${r1(e.dayNeed)} units = ${Math.round((e.dayNeed / e.capacity) * 100)}% of the fridge · rush ${e.rush} / group ${e.group} days`,
  );

console.log("Checks");
assert(
  [sim, diligent].every(
    (r) => r.stats.blocked.length === 0 && r.stats.invariant.length === 0 && r.stats.levels === 250,
  ),
  `F1: the campaign completes with no soft-lock and no invariant break (completionist ${sim.stats.levels}/250, diligent ${diligent.stats.levels}/250)`,
);
assert(
  overCap === sim.stats.fridgeOverByGrandma,
  `F2: the fridge is never over capacity except by Grandma's free goods (${overCap} observed steps)`,
);
assert(
  POINTS.every((n) => perLevel.get(n)!.orders > 0) && restaurantLevelOf(L250.levelProgress) >= 250,
  "F3: every measured level ran its service",
);
console.log(
  failures
    ? `RESTAURANT FRIDGE PRESSURE QA: ${failures} FAILURE(S)`
    : "RESTAURANT FRIDGE PRESSURE QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
