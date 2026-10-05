/**
 * RESTAURANT CAMPAIGN SIMULATION QA — Unified Restaurant phase N: the whole
 * campaign, Level 1 → 250, played through the REAL restaurant functions the
 * way App plays a level (servicePlanFor → buy / pantry / spares / hire →
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
 *     pantry, Grandma's spares and free hiring.
 *  M. Moving in — a pre-restaurant save at Level 120 (an old build's save)
 *     moves into the restaurant (phase M crate), then plays to 250.
 *
 * After EVERY level, for every player:
 *  1. the service could start (no soft-lock);
 *  2. credits are whole cents and never < 0 (App.persist's invariant);
 *  3. opening cash + every ledger movement since = closing cash (lifetime
 *     totals, which are never trimmed);
 *  4. no negative stock or supplies; the fridge never holds more than its
 *     capacity except by Grandma's free goods (counted separately);
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

import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  getLevel,
  completeLevel,
  selectLevel,
  isCompleted,
} from "../src/game/levels/LevelManager.ts";
import { withPaidOrder, paidOrdersFor } from "../src/game/levels/paidOrders.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { walletInvariantViolation } from "../src/game/economy/wallet.ts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import { getKnifeSharpness } from "../src/game/economy/sharpness.ts";
import { syncKitchenUpgradeOwnership } from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { grantEarnedMilestoneRewards } from "../src/game/progression/milestoneRewards.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { purchaseSupply } from "../src/game/business/BusinessSuppliesManager.ts";
import { getSupplyItem, isConsumableSupply } from "../src/game/business/businessSupplies.ts";
import {
  recordCapitalExpenditure,
  recordInventoryPurchase,
  recordPackagingPurchase,
  recordRevenueAndCogs,
} from "../src/game/business/BusinessFinanceManager.ts";
import {
  purchaseRefrigerator,
  getRefrigeratorCapacity,
  getInventoryUsedCapacity,
} from "../src/game/business/RefrigeratorManager.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { discardExpiredStock } from "../src/game/business/discardExpired.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { businessCustomerPayment } from "../src/game/business/BusinessServiceManager.ts";
import { businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
import {
  consumeCampaignOrderStock,
  pantryForMissing,
} from "../src/game/restaurant/campaignStock.ts";
import {
  closeDay,
  openDay,
  recordService,
  restaurantDayOf,
} from "../src/game/restaurant/restaurantDay.ts";
import {
  grandmasSpares,
  orderServiceFor,
  takeOrderSupplies,
  washUp,
  cleanSettings,
} from "../src/game/restaurant/serviceSupplies.ts";
import { hireSpecialist, getSpecialist } from "../src/game/restaurant/staffRequirements.ts";
import { bulkDiscountFor, BULK_MAX_PACKS } from "../src/game/restaurant/bulkBuying.ts";
import { nextMenuGuest, withMenuGuestServed } from "../src/game/restaurant/menuGuests.ts";
import { restaurantLevelOf } from "../src/game/restaurant/restaurantMenu.ts";
import { isSystemLive } from "../src/game/restaurant/restaurantProgression.ts";
import { levelNumber } from "../src/game/levels/levelMastery.ts";
import {
  markStarterCrateSeen,
  migrateToUnifiedRestaurant,
} from "../src/game/restaurant/restaurantMigration.ts";
import { businessDayAllowed } from "../src/game/restaurant/endlessRestaurant.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const $ = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

type Profile = "diligent" | "broke";
type Stats = {
  levels: number;
  blocked: string[];
  invariant: string[];
  pantry: number;
  spares: number;
  hires: number;
  specialists: number;
  fridgeUpgrades: number;
  fridgeOverByGrandma: number;
  guests: number;
  closings: number;
  ordersServed: number;
};

const lifetimeSum = (s: SaveData) =>
  Object.values(s.economy.lifetime ?? {}).reduce((n, v) => n + (v ?? 0), 0);

/** App.persist: kitchen sync, milestone payouts, the wallet invariant. */
function persist(next: SaveData, stats: Stats, where: string): SaveData {
  const synced = syncKitchenUpgradeOwnership(next);
  const { save } = grantEarnedMilestoneRewards(synced);
  const v = walletInvariantViolation(save);
  if (v) stats.invariant.push(`${where}: ${v}`);
  return save;
}

/** Buys `units` of an ingredient the way App.purchaseIngredient records it. */
function buyIngredient(s: SaveData, id: string, units: number) {
  const r = purchaseIngredient(s, id, units, bulkDiscountFor(units));
  if (!r.ok) return { s, ok: false as const, reason: r.reason };
  const recorded = appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id);
  return { s: recordInventoryPurchase(recorded, r.totalCost, 1), ok: true as const };
}
/** Buys packs of a supply the way App.purchaseSupply records it. */
function buySupply(s: SaveData, id: string, packs: number) {
  const item = getSupplyItem(id)!;
  const r = purchaseSupply(
    s,
    id,
    packs,
    isConsumableSupply(item)
      ? { discount: bulkDiscountFor(packs), maxPacks: BULK_MAX_PACKS }
      : undefined,
  );
  if (!r.ok) return { s, ok: false as const };
  const packaging = isConsumableSupply(r.item);
  const rec = appendLedgerEntry(
    r.save,
    packaging ? "supply-packaging-purchase" : "supply-equipment-purchase",
    -r.totalCost,
    id,
  );
  return {
    s: packaging
      ? recordPackagingPurchase(rec, r.totalCost)
      : recordCapitalExpenditure(rec, r.totalCost),
    ok: true as const,
  };
}
/** Spends every cent, recorded (the broke player's drain). */
function drain(s: SaveData): SaveData {
  if (s.credits === 0) return s;
  return appendLedgerEntry({ ...s, credits: 0 }, "knife-purchase", -s.credits, "sim-drain");
}

/** Plays one level the way App does; returns the save after its completion. */
function playLevel(save: SaveData, n: number, profile: Profile, stats: Stats): SaveData {
  const level = getLevel(`level-${n}`)!;
  let s = save;
  const where = `L${n}`;
  // Closing time comes before the next day's first service.
  if (restaurantDayOf(s).closingDue) {
    s = persist(closeDay(s, restaurantLevelOf(s.levelProgress)), stats, `${where} closing`);
    stats.closings++;
  }
  if (profile === "broke") s = drain(s);
  let plan = servicePlanFor(s, level);
  if (!plan) {
    stats.blocked.push(`${where}: no plan`);
    return s;
  }
  if (plan.progress !== s.levelProgress) s = { ...s, levelProgress: plan.progress };
  if (plan.opening) s = openDay(s, n);
  const replan = () => (plan = servicePlanFor(s, level)!);

  // Staff: hiring is free.
  for (const r of replan().staff.filter((x) => !x.met)) {
    const hired = getSpecialist(r.id)
      ? hireSpecialist(s, r.id, restaurantLevelOf(s.levelProgress))
      : hireStaff(s, r.id);
    if (hired.ok) {
      s = hired.save;
      stats.hires++;
      if (getSpecialist(r.id)) stats.specialists++;
    }
  }

  // Stock.
  replan();
  if (plan.check.applies && plan.check.hasExpired) {
    const d = discardExpiredStock(s);
    if (d.ok) s = d.save;
    replan();
  }
  if (plan.check.applies && !plan.check.ready && profile === "diligent") {
    for (const row of plan.check.missingRows) {
      let bought = buyIngredient(s, row.ingredientId, row.buyUnits);
      if (!bought.ok && bought.reason === "insufficientStorage") {
        // Upgrade the fridge to the next tier the wallet covers (Business → Equipment).
        const cap = getRefrigeratorCapacity(s.business.refrigerator.refrigeratorId);
        const next = REFRIGERATOR_CATALOG.filter((f) => getRefrigeratorCapacity(f.id) > cap).sort(
          (a, b) => getRefrigeratorCapacity(a.id) - getRefrigeratorCapacity(b.id),
        )[0];
        if (next) {
          const up = purchaseRefrigerator(s, next.id);
          if (up.ok) {
            s = appendLedgerEntry(up.save, "refrigerator-purchase", -up.price, next.id);
            stats.fridgeUpgrades++;
            bought = buyIngredient(s, row.ingredientId, row.buyUnits);
          }
        }
      }
      if (bought.ok) s = persist(bought.s, stats, `${where} buy`);
    }
    replan();
  }
  // The menu guests' optional stock (phase N): a diligent player buys it too.
  if (profile === "diligent") {
    for (const g of plan.guests.rows) {
      const bought = buyIngredient(s, g.ingredientId, g.buyUnits);
      if (bought.ok) s = persist(bought.s, stats, `${where} guest stock`);
    }
    replan();
  }
  if (plan.check.applies && !plan.check.ready) {
    const pantry = pantryForMissing(s, plan.check);
    if (pantry) {
      s = pantry;
      stats.pantry++;
      replan();
    }
  }
  if (plan.check.applies && !plan.check.ready) {
    // A Grandma's-pantry save may exceed the fridge (goods, never money): note it.
    stats.blocked.push(
      `${where}: stock not ready (${plan.check.missingRows.map((r) => r.ingredientId).join(",")}; affordable=${plan.check.affordable}, fridge free ${plan.check.storageFree}/${plan.check.storageNeeded})`,
    );
    return s;
  }

  // Supplies.
  if (plan.supplies.applies && profile === "diligent") {
    for (const row of plan.supplies.rows.filter((r) => r.missing > 0)) {
      const b = buySupply(s, row.id, row.packs);
      if (b.ok) s = persist(b.s, stats, `${where} supply`);
    }
    for (const b of [plan.supplies.soap, plan.supplies.cleaner])
      if (b.spare === 0 && b.status !== "ok") {
        const r = buySupply(s, b.id, 1);
        if (r.ok) s = persist(r.s, stats, `${where} bottle`);
      }
    replan();
  }
  if (plan.supplies.applies && !plan.supplies.ready) {
    const spares = grandmasSpares(s, plan.supplies);
    if (spares) {
      s = spares;
      stats.spares++;
      replan();
    }
  }
  if (plan.supplies.applies && !plan.supplies.ready) {
    stats.blocked.push(`${where}: supplies not ready`);
    return s;
  }
  if (!plan.staff.every((r) => r.met)) {
    stats.blocked.push(
      `${where}: staff not met (${plan.staff.filter((r) => !r.met).map((r) => r.id)})`,
    );
    return s;
  }

  // START (App.beginLevel): the wash-up, the crate note, the level selected.
  s = markStarterCrateSeen(washUp(s, n).save);
  s = persist(
    { ...s, levelProgress: selectLevel(level.id, s.levelProgress) },
    stats,
    `${where} start`,
  );

  // Serve the level's own orders.
  for (const recipe of plan.tickets) {
    const idx = paidOrdersFor(s.levelProgress, level.id).length;
    const stock = consumeCampaignOrderStock(s, n, recipe, true);
    if (!stock.ok) {
      stats.blocked.push(`${where}: order ${recipe.id} out of stock at serve`);
      return s;
    }
    const base = takeOrderSupplies(stock.save, orderServiceFor(n, idx));
    const settlement = computeSettlement(
      recipe,
      level.chapter ?? 1,
      90,
      base.equippedKnifeId,
      base.equippedBoardId,
      getKnifeSharpness(base, base.equippedKnifeId),
      base.ownedStaffIds,
      base.selectedSupplierId,
    );
    const paid = appendLedgerEntry(
      {
        ...base,
        credits: base.credits + settlement.netResult,
        levelProgress: withPaidOrder(base.levelProgress, level.id, recipe.id),
      },
      "campaign-settlement",
      settlement.netResult,
      recipe.id,
    );
    s = persist(paid, stats, `${where} serve`);
    stats.ordersServed++;
  }

  // Menu guests (optional): every one the stock and a clean setting allow.
  for (;;) {
    const guest = nextMenuGuest(s, level);
    if (!guest || !guest.inStock) break;
    if (isSystemLive("dine-in", n) && cleanSettings(s) < 1) break;
    const dish = businessDishForRecipeId(guest.recipe.id);
    const stock = consumeCampaignOrderStock(s, n, guest.recipe, true);
    if (!dish || !stock.ok) break;
    const withSupplies = takeOrderSupplies(
      stock.save,
      isSystemLive("dine-in", n) ? "dine-in" : null,
    );
    const pays = businessCustomerPayment(stock.save, dish).customerPays;
    const rec = recordRevenueAndCogs(
      {
        ...withSupplies,
        credits: withSupplies.credits + pays,
        levelProgress: withMenuGuestServed(withSupplies.levelProgress, level.id),
      },
      pays,
      stock.cost,
    );
    s = persist(appendLedgerEntry(rec, "business-revenue", pays, dish.id), stats, `${where} guest`);
    stats.guests++;
  }

  // Finish Level (App.completeCampaignLevel).
  const { progress, isFirstCompletion, rewardCoins } = completeLevel(level.id, s.levelProgress);
  let next: SaveData = { ...s, credits: s.credits + rewardCoins, levelProgress: progress };
  if (isFirstCompletion) next = washUp(recordService(next, n), n).save;
  if (rewardCoins > 0) next = appendLedgerEntry(next, "completion-reward", rewardCoins, level.id);
  s = persist(next, stats, `${where} complete`);
  if (!isCompleted(level.id, s.levelProgress)) stats.blocked.push(`${where}: not completed`);
  else stats.levels++;
  return s;
}

function checkInvariants(
  s: SaveData,
  startCash: number,
  startLifetime: number,
  stats: Stats,
  where: string,
) {
  if (!Number.isInteger(s.credits) || s.credits < 0)
    stats.invariant.push(`${where}: credits ${s.credits}`);
  if (startCash + (lifetimeSum(s) - startLifetime) !== s.credits)
    stats.invariant.push(
      `${where}: cash identity off by ${s.credits - (startCash + lifetimeSum(s) - startLifetime)}`,
    );
  for (const [id, e] of Object.entries(s.business.inventory))
    if ((e?.quantity ?? 0) < 0) stats.invariant.push(`${where}: negative stock ${id}`);
  for (const [id, e] of Object.entries(s.business.supplies.stock))
    if ((e?.units ?? 0) < 0) stats.invariant.push(`${where}: negative supply ${id}`);
  const used = getInventoryUsedCapacity(s.business.inventory);
  const cap = getRefrigeratorCapacity(s.business.refrigerator.refrigeratorId);
  if (used > cap + 1e-9) stats.fridgeOverByGrandma++;
}

function run(name: string, start: SaveData, from: number, profile: Profile) {
  const stats: Stats = {
    levels: 0,
    blocked: [],
    invariant: [],
    pantry: 0,
    spares: 0,
    hires: 0,
    specialists: 0,
    fridgeUpgrades: 0,
    fridgeOverByGrandma: 0,
    guests: 0,
    closings: 0,
    ordersServed: 0,
  };
  let s = start;
  const startCash = s.credits;
  const startLifetime = lifetimeSum(s);
  for (let n = from; n <= 250; n++) {
    s = playLevel(s, n, profile, stats);
    checkInvariants(s, startCash, startLifetime, stats, `L${n}`);
    if (stats.blocked.length > 0) break;
  }
  // The day after Level 250 closes like any other.
  if (restaurantDayOf(s).closingDue) {
    s = persist(closeDay(s, restaurantLevelOf(s.levelProgress)), stats, "final closing");
    stats.closings++;
    checkInvariants(s, startCash, startLifetime, stats, "final closing");
  }
  const lt = s.economy.lifetime ?? {};
  const line = (k: string) => $(lt[k as keyof typeof lt] ?? 0);
  console.log(`\n  ${name}`);
  console.log(
    `    levels ${stats.levels}/${251 - from} · orders ${stats.ordersServed} · menu guests ${stats.guests} · closings ${stats.closings}`,
  );
  console.log(
    `    cash ${$(startCash)} → ${$(s.credits)} · settlements ${line("campaign-settlement")} · rewards ${line("completion-reward")} · menu revenue ${line("business-revenue")} · milestones ${line("milestone-reward")} + legacy ${line("family-legacy")}`,
  );
  console.log(
    `    spent: ingredients ${line("inventory-purchase")} · supplies ${line("supply-packaging-purchase")} / ${line("supply-equipment-purchase")} · fridges ${line("refrigerator-purchase")} · wages ${line("business-staff-salary")} · fines ${line("inspection-fine")}`,
  );
  console.log(
    `    help: pantry ×${stats.pantry} · spares ×${stats.spares} · hires ${stats.hires} (${stats.specialists} specialists) · fridge upgrades ${stats.fridgeUpgrades} · fridge over capacity (Grandma's goods) at ${stats.fridgeOverByGrandma} level ends`,
  );
  if (stats.blocked.length) console.log(`    BLOCKED: ${stats.blocked.slice(0, 5).join(" | ")}`);
  if (stats.invariant.length)
    console.log(`    INVARIANT: ${stats.invariant.slice(0, 5).join(" | ")}`);
  return { s, stats };
}

const fresh = () =>
  migrateToUnifiedRestaurant({
    ...structuredClone(DEFAULT_SAVE),
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });

console.log("Simulating the campaign (this plays 250 levels three times)…");
const D = run("D. Diligent player, fresh save", fresh(), 1, "diligent");
const B = run("B. Broke player ($0 before every level)", fresh(), 1, "broke");
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
const M = run(
  "M. Moving in at Level 120 (old save)",
  migrateToUnifiedRestaurant(old),
  120,
  "diligent",
);

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
assert(
  B.stats.pantry > 0 && B.stats.spares > 0 && B.stats.hires > 0,
  "B3: the broke player got through on Grandma's pantry, spares and free hiring alone",
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
