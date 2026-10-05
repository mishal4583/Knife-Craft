/**
 * RESTAURANT MIGRATION QA — Unified Restaurant phase M: existing saves move
 * into the unified restaurant (restaurant/restaurantMigration.ts), tested on
 * saves of every era loaded through the REAL SaveManager.load, then the
 * migration the restaurant build runs on top of it.
 *
 *  K. Nothing is lost: levels, credits, ledger, economy, items, Business
 *     stock/staff/menu/contracts/history all kept; no money, no ledger entry.
 *  F. A fresh save is only stamped (empty crate, already "seen").
 *  C. The starter crate tops up what systems behind the save need: the next
 *     3 services' ingredients (never past the fridge), place settings for a
 *     service, napkins to 100, one bottle each of soap and cleaning liquid,
 *     takeaway packaging from L71 — goods at cost 0, only ever adding.
 *  R. After it, the next service's check is ready (stock and settings).
 *  O. Once: a migrated save is returned unchanged; a reload adds nothing.
 *  W. The welcome note shows until a service starts; then it's gone.
 *  E. Eras: no business field, pre-supplies, mid-level tickets / paid
 *     orders, a Business-day player, a completed campaign.
 *  S. The switch: SaveManager runs it only in the restaurant build and
 *     writes it back; the release build's saves are untouched.
 *
 * Run: npx tsx scripts/restaurant-migration-qa.mts
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

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import {
  KIT_NAPKINS,
  KIT_PACKAGING,
  RESTAURANT_MIGRATION_VERSION,
  markStarterCrateSeen,
  migrateToUnifiedRestaurant,
  unseenStarterCrate,
} from "../src/game/restaurant/restaurantMigration.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { openDay } from "../src/game/restaurant/restaurantDay.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import {
  getInventoryUsedCapacity,
  getRefrigeratorCapacity,
} from "../src/game/business/RefrigeratorManager.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { RESTAURANT_MODE } from "../src/game/config/restaurantMode.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const STORAGE_KEY = "knifecraft.save.v1"; // SaveManager's localStorage key (no Bridge in Node)

/** Stores `raw` the way an older build would have, then loads it through the real SaveManager. */
async function loadRaw(raw: object): Promise<SaveData> {
  memoryStore.clear();
  memoryStore.set(STORAGE_KEY, JSON.stringify(raw));
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  return SaveManager.load();
}
const progressAt = (n: number, done = n - 1) => ({
  currentLevelId: `level-${Math.min(n, 250)}`,
  highestUnlockedLevelId: `level-${Math.min(n, 250)}`,
  completedLevelIds: Array.from({ length: done }, (_, i) => `level-${i + 1}`),
});
/** A current-version save at level n (credits in cents). */
const modern = (n: number, extra: Partial<SaveData> = {}) => ({
  ...structuredClone(DEFAULT_SAVE),
  credits: 123_456,
  levelProgress: progressAt(n),
  ...extra,
});
const units = (s: SaveData, id: string) =>
  (s.business.supplies.stock as Record<string, { units: number }>)[id]?.units ?? 0;
const withoutRestaurant = (s: SaveData) => {
  const b = { ...s.business } as Record<string, unknown>;
  delete b.inventory;
  delete b.supplies;
  delete b.restaurantMigration;
  return { ...s, business: b };
};

console.log("K. Nothing is lost");
{
  const loaded = await loadRaw(modern(60));
  const moved = migrateToUnifiedRestaurant(loaded);
  assert(
    JSON.stringify(withoutRestaurant(moved)) === JSON.stringify(withoutRestaurant(loaded)) &&
      moved.credits === loaded.credits &&
      moved.economyLedger.length === loaded.economyLedger.length &&
      JSON.stringify(moved.economy) === JSON.stringify(loaded.economy) &&
      JSON.stringify(moved.levelProgress) === JSON.stringify(loaded.levelProgress),
    "K1: only stock, supplies and the stamp change — levels, credits, ledger, economy, everything else kept",
  );
  const before = loaded.business.inventory;
  assert(
    Object.entries(before).every(
      ([id, e]) =>
        (moved.business.inventory as Record<string, { quantity: number }>)[id]!.quantity >=
        e!.quantity,
    ) &&
      Object.entries(loaded.business.supplies.stock).every(
        ([id, e]) => units(moved, id) >= e!.units,
      ),
    "K2: only ever adds — nothing already owned goes down",
  );
}

console.log("F. Fresh saves");
{
  const fresh = migrateToUnifiedRestaurant(structuredClone(DEFAULT_SAVE));
  const m = fresh.business.restaurantMigration!;
  assert(
    m.version === RESTAURANT_MIGRATION_VERSION &&
      m.atLevel === 1 &&
      m.kit.length === 0 &&
      m.seen === true &&
      JSON.stringify(withoutRestaurant(fresh)) ===
        JSON.stringify(withoutRestaurant(DEFAULT_SAVE)) &&
      unseenStarterCrate(fresh) === null,
    "F1: a fresh save is only stamped — no crate, no note",
  );
  const l12 = migrateToUnifiedRestaurant(await loadRaw(modern(12)));
  assert(
    l12.business.restaurantMigration!.kit.length === 0,
    "F2: a save before ingredient stock (L12) needs no crate",
  );
}

console.log("C. The starter crate");
{
  const loaded = await loadRaw(modern(60));
  const moved = migrateToUnifiedRestaurant(loaded);
  const kit = moved.business.restaurantMigration!.kit;
  const cap = getRefrigeratorCapacity(moved.business.refrigerator.refrigeratorId);
  assert(
    kit.some((k) => k.kind === "ingredient") &&
      getInventoryUsedCapacity(moved.business.inventory) <= cap &&
      Object.values(moved.business.inventory).every((e) => e!.unitCost === 0),
    "C1: ingredients for the next services, at cost 0, never past the fridge's capacity",
  );
  assert(
    units(moved, "dinner-plates") >= 1 &&
      units(moved, "dinner-plates") === units(moved, "dinner-forks") &&
      units(moved, "dinner-forks") === units(moved, "dinner-knives") &&
      units(moved, "paper-napkins") === KIT_NAPKINS &&
      units(moved, "dish-soap") === 1 &&
      units(moved, "cleaning-liquid") === 1 &&
      units(moved, "microwave-containers") === 0 &&
      Object.values(moved.business.supplies.stock).every((e) => e!.costBasis === 0),
    "C2: L60 (dine-in, no takeaway yet): place settings, 100 napkins, a bottle of soap and of cleaning liquid — cost 0",
  );
  const l120 = migrateToUnifiedRestaurant(await loadRaw(modern(120)));
  assert(
    units(l120, "microwave-containers") >= KIT_PACKAGING &&
      units(l120, "paper-bags") >= KIT_PACKAGING,
    "C3: from L71 the crate adds takeaway containers and bags",
  );
  const stocked = await loadRaw(
    modern(60, {
      business: {
        ...structuredClone(DEFAULT_SAVE.business),
        supplies: {
          ...structuredClone(DEFAULT_SAVE.business.supplies),
          stock: {
            "paper-napkins": { units: 40, costBasis: 900 },
            "dinner-plates": { units: 20, costBasis: 5000 },
            "dinner-forks": { units: 20, costBasis: 500 },
            "dinner-knives": { units: 20, costBasis: 700 },
          },
        },
        restaurantSupplies: { soapPct: 60, cleanerPct: 0, washing: 0 },
      },
    }),
  );
  const topped = migrateToUnifiedRestaurant(stocked);
  assert(
    units(topped, "paper-napkins") === KIT_NAPKINS &&
      topped.business.supplies.stock["paper-napkins"]!.costBasis === 900 &&
      units(topped, "dinner-plates") === 20 &&
      units(topped, "dish-soap") === 0 &&
      units(topped, "cleaning-liquid") === 1,
    "C4: only tops up — napkins 40 → 100 (cost basis kept), enough plates → none, an open soap bottle → no new one",
  );
  const full = modern(60);
  full.business.inventory = addStock(full.business.inventory, "potato", 40, 100, 1);
  const fullMoved = migrateToUnifiedRestaurant(await loadRaw(full));
  assert(
    !fullMoved.business.restaurantMigration!.kit.some((k) => k.kind === "ingredient") &&
      getInventoryUsedCapacity(fullMoved.business.inventory) === 40,
    "C5: a full fridge gets no ingredients (never overfilled)",
  );
}

console.log("R. Ready for the next service");
{
  const moved = migrateToUnifiedRestaurant(await loadRaw(modern(60)));
  const plan = servicePlanFor(openDay(moved, 60), getLevel("level-60")!)!;
  assert(
    plan.check.applies && plan.check.ready && plan.supplies.applies && plan.supplies.ready,
    "R1: after the move the next service's stock and place settings are ready",
  );
}

console.log("O. Once");
{
  const moved = migrateToUnifiedRestaurant(await loadRaw(modern(60)));
  assert(migrateToUnifiedRestaurant(moved) === moved, "O1: a migrated save comes back unchanged");
  await SaveManager.save(moved);
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const back = await SaveManager.load();
  const again = migrateToUnifiedRestaurant(back);
  assert(
    again === back &&
      units(again, "paper-napkins") === KIT_NAPKINS &&
      JSON.stringify(again.business.inventory) === JSON.stringify(moved.business.inventory),
    "O2: after a save and reload no second crate is given",
  );
}

console.log("W. The welcome note");
{
  const moved = migrateToUnifiedRestaurant(await loadRaw(modern(60)));
  const plan = servicePlanFor(openDay(moved, 60), getLevel("level-60")!)!;
  const seen = markStarterCrateSeen(moved);
  assert(
    unseenStarterCrate(moved)?.length === moved.business.restaurantMigration!.kit.length &&
      servicePlanNeedsSheet(plan) &&
      plan.welcome !== null &&
      unseenStarterCrate(seen) === null &&
      markStarterCrateSeen(seen) === seen &&
      JSON.stringify(withoutRestaurant(seen)) === JSON.stringify(withoutRestaurant(moved)),
    "W1: the crate is announced until a service starts; marking it seen changes nothing else",
  );
}

console.log("E. Saves of every era");
{
  const ancient = await loadRaw({
    version: 1,
    credits: 400,
    ownedKnifeIds: ["chef"],
    equippedKnifeId: "chef",
    levelProgress: progressAt(45),
    economyLedger: [],
  });
  const a = migrateToUnifiedRestaurant(ancient);
  assert(
    a.credits === ancient.credits &&
      a.business.restaurantMigration!.atLevel === 45 &&
      units(a, "dinner-plates") >= 1,
    "E1: a version-1 save without `business` loads, keeps its money and gets its crate",
  );
  const mid = modern(60, {
    levelProgress: {
      ...progressAt(60),
      tickets: { "level-60": ["missing-recipe-id"] },
      paidOrders: { "level-60": [] },
    } as SaveData["levelProgress"],
  });
  const m = migrateToUnifiedRestaurant(await loadRaw(mid));
  assert(
    JSON.stringify(m.levelProgress.tickets) ===
      JSON.stringify({ "level-60": ["missing-recipe-id"] }) &&
      m.business.restaurantMigration!.version === 1,
    "E2: a save mid-level keeps its saved tickets and paid orders",
  );
  const biz = modern(70);
  biz.business.staff = { hiredRoles: ["prep-cook", "server"] };
  biz.business.menuActivation = { inactiveDishIds: ["biz-garden-salad"] };
  biz.business.calendar = { ...biz.business.calendar, businessDay: 42 };
  biz.business.inventory = addStock(biz.business.inventory, "tomato", 5, 120, 40);
  const b = migrateToUnifiedRestaurant(await loadRaw(biz));
  assert(
    b.business.staff.hiredRoles.join() === "prep-cook,server" &&
      b.business.menuActivation.inactiveDishIds.join() === "biz-garden-salad" &&
      b.business.calendar.businessDay === 42 &&
      (b.business.inventory.tomato?.quantity ?? 0) >= 5,
    "E3: a Business-day player keeps staff, menu switches, calendar and stock — they become the restaurant's",
  );
  const done = modern(250, { levelProgress: progressAt(250, 250) });
  const d = migrateToUnifiedRestaurant(await loadRaw(done));
  assert(
    d.business.restaurantMigration!.atLevel === 250 &&
      !d.business.restaurantMigration!.kit.some((k) => k.kind === "ingredient") &&
      units(d, "dinner-plates") >= 1 &&
      units(d, "paper-bags") >= KIT_PACKAGING,
    "E4: a completed campaign gets the dine-in and takeaway goods for the Endless Restaurant (no campaign service to stock)",
  );
}

console.log("S. The switch");
{
  const sm = read("src/game/SaveManager.ts");
  assert(
    /return RESTAURANT_MODE \? migrateToUnifiedRestaurant\(save\) : save;/.test(sm) &&
      /this\.cache = intoRestaurant\(\{ \.\.\.DEFAULT_SAVE \}\);/.test(sm) &&
      /const migrated = intoRestaurant\(this\.cache\);/.test(sm) &&
      /\|\| movedIn\)\s*void this\.save\(this\.cache\)/.test(sm) &&
      /const fresh = intoRestaurant\(\{ \.\.\.DEFAULT_SAVE \}\);/.test(sm),
    "S1: SaveManager moves every save in once (load, fresh, reset) in the restaurant build and writes it back",
  );
  const loaded = await loadRaw(modern(60));
  assert(
    RESTAURANT_MODE === false && loaded.business.restaurantMigration === undefined,
    "S2: the release build (switch off) never migrates — saves are untouched",
  );
  const mod = read("src/game/restaurant/restaurantMigration.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(
    !/RESTAURANT_MODE|Math\.random|appendLedgerEntry|credits/.test(mod),
    "S3: the migration never reads the switch, is deterministic and never touches money or the ledger",
  );
}

console.log(
  failures
    ? `RESTAURANT MIGRATION QA: ${failures} FAILURE(S)`
    : "RESTAURANT MIGRATION QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
