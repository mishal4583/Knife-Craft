/**
 * RESTAURANT CAMPAIGN SIMULATION QA — Unified Restaurant phase N: the whole
 * campaign, Level 1 → 250, played through the REAL restaurant functions the
 * way App plays a level (servicePlanFor → buy / pantry / credit / hire →
 * beginLevel's wash-up → each order: stock + supplies + settlement → menu
 * guests → completeLevel + recordService + wash-up → closing), every save
 * change going through a mirror of App.persist (kitchen sync, milestone
 * payouts, the wallet invariant).
 *
 * Three players:
 *  D. Diligent — buys exactly what each Pre-Service Check asks for (bulk
 *     prices), upgrades the fridge when a service won't fit, keeps the
 *     bottles and napkins stocked, hires whoever is required, serves every
 *     menu guest it has stock for.
 *  B. Broke — has spent every cent before EVERY level (a recorded
 *     knife-purchase drain), so it can only start services through Grandma's
 *     pantry before Level 10, supplier credit from Level 10, and free hiring.
 *  M. Moving in — a pre-restaurant save at Level 120 (an old build's save)
 *     moves into the restaurant (phase M crate), then plays to 250.
 *
 * After EVERY level, for every player:
 *  1. the service could start (no soft-lock);
 *  2. credits are whole cents and never < 0 (App.persist's invariant);
 *  3. opening cash + every ledger movement since = closing cash (lifetime
 *     totals, which are never trimmed);
 *  4. no negative stock or supplies; the fridge never holds more than its
 *     capacity except by covered goods (counted separately);
 *  5. every order the level owes is served and paid, the level completes.
 * It prints each player's summary (money flows, help used, staff, fridge).
 *
 * Run: npx tsx scripts/restaurant-campaign-sim-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import type { SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_SAVE } from "../src/game/SaveManager.ts";
import { migrateToUnifiedRestaurant } from "../src/game/restaurant/restaurantMigration.ts";
import { businessDayAllowed } from "../src/game/restaurant/endlessRestaurant.ts";
import { $, run, freshRestaurantSave } from "./restaurantCampaignSim.mts";
import { supplierCreditOf } from "../src/game/restaurant/supplierCredit.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const fresh = freshRestaurantSave;

console.log("Simulating the campaign (this plays 250 levels three times)…");
const D = run("D. Diligent player, fresh save", fresh(), 1, { profile: "diligent" });
const B = run("B. Broke player ($0 before every level)", fresh(), 1, { profile: "broke" });
const old: SaveData = {
  ...structuredClone(DEFAULT_SAVE),
  credits: 40_000_00,
  levelProgress: {
    currentLevelId: "level-120",
    highestUnlockedLevelId: "level-120",
    completedLevelIds: Array.from({ length: 119 }, (_, i) => `level-${i + 1}`),
  },
  story: { introDone: true, milestoneMask: 127, finaleSeen: true },
};
const M = run("M. Moving in at Level 120 (old save)", migrateToUnifiedRestaurant(old), 120, {
  profile: "diligent",
});

console.log("\nChecks");
for (const [tag, r, levels] of [
  ["D", D, 250],
  ["B", B, 250],
  ["M", M, 131],
] as const) {
  assert(
    r.stats.blocked.length === 0 && r.stats.levels === levels,
    `${tag}1: every level could start and was completed (${r.stats.levels}/${levels}) ${r.stats.blocked.slice(0, 2).join(" | ")}`,
  );
  assert(
    r.stats.invariant.length === 0,
    `${tag}2: money never below 0; opening cash + ledger = closing cash at every level ${r.stats.invariant.slice(0, 2).join(" | ")}`,
  );
}
// Rule changed (developer 2026-10-10): Grandma no longer lends from Level 10 — a
// short service is covered by a rewarded ad or supplier credit (the sim shows no
// ads). Was: "got through on Grandma's pantry, spares and free hiring alone".
assert(
  B.stats.credit > 0 &&
    B.stats.creditTaken > 0 &&
    B.stats.creditRepaid === B.stats.creditTaken &&
    supplierCreditOf(B.s).owed === 0 &&
    B.stats.hires > 0,
  `B3: the broke player got through on supplier credit (×${B.stats.credit}, ${$(B.stats.creditTaken)}), all of it repaid from its earnings ($0 owed at the end), and free hiring`,
);
assert(
  D.stats.credit === 0 && D.stats.pantry === 0,
  "B4: the diligent player never needs supplier credit or Grandma's pantry",
);
// 250 levels at 2 services a day (3 from L51): about 92 days, each closed once.
const serviceDays = 25 + Math.ceil(200 / 3);
assert(
  D.stats.closings >= serviceDays - 1 && D.stats.closings <= serviceDays + 1,
  `D3: the restaurant closed every day (${D.stats.closings} closings for ~${serviceDays} days)`,
);
assert(
  D.stats.guests > D.stats.levels,
  `D4: with the check's optional guest stock, the diligent player serves menu guests (${D.stats.guests} guests in ${D.stats.levels} levels)`,
);
assert(
  businessDayAllowed(true, D.s.levelProgress) &&
    !businessDayAllowed(true, {
      ...D.s.levelProgress,
      completedLevelIds: D.s.levelProgress.completedLevelIds.slice(0, 249),
    }),
  "E1: after Level 250 the Endless Restaurant opens; not one level before",
);

console.log(
  failures
    ? `RESTAURANT CAMPAIGN SIM QA: ${failures} FAILURE(S)`
    : "RESTAURANT CAMPAIGN SIM QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
