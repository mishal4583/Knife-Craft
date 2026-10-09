/**
 * RESTAURANT CAMPAIGN SIMULATION (module) — shared by
 * restaurant-campaign-sim-qa.mts and restaurant-economy-pass.mts.
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

import { dailyPayroll, BUSINESS_STAFF_CATALOG } from "../src/game/business/businessStaff.ts";
import { SPECIALIST_WAGE_FROM_ROLE } from "../src/game/restaurant/staffRequirements.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { lbPerMarketUnit, marketStep } from "../src/game/business/measure.ts";
import type { IngredientId } from "../src/game/definitions.ts";
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
import {
  getSupplyItem,
  isConsumableSupply,
  supplyPackPrice,
} from "../src/game/business/businessSupplies.ts";
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
import { dayStockFor, servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
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
import {
  bulkDiscountFor,
  BULK_MAX_PACKS,
  ingredientBulkDiscount,
} from "../src/game/restaurant/bulkBuying.ts";
import {
  menuGuestCapacity,
  nextMenuGuest,
  withMenuGuestServed,
} from "../src/game/restaurant/menuGuests.ts";
import { menuGuestsPerService } from "../src/game/restaurant/restaurantProgression.ts";
import { kitchenGuestSeats } from "../src/game/restaurant/restaurantInvestments.ts";
import { restaurantLevelOf } from "../src/game/restaurant/restaurantMenu.ts";
import { isSystemLive } from "../src/game/restaurant/restaurantProgression.ts";
import { levelNumber } from "../src/game/levels/levelMastery.ts";
import {
  markStarterCrateSeen,
  migrateToUnifiedRestaurant,
} from "../src/game/restaurant/restaurantMigration.ts";
import { buyAttempts } from "./economy-v25-simulation.mts";
import {
  restaurantQualityBonusPct,
  restaurantSettlement,
  supplierEffects,
  supplierPriceFactor,
} from "../src/game/restaurant/restaurantEconomy.ts";
import { restaurantQuality } from "../src/game/restaurant/restaurantInvestments.ts";
import {
  isEmergencyService,
  markEmergencyService,
} from "../src/game/restaurant/emergencyService.ts";

export const $ = (c: number) =>
  `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export type Profile = "diligent" | "broke" | "completionist";

/**
 * Simulation options. `legacyFoodCost`: measure the rule BEFORE the economy
 * pass (the built-in food cost charged on top of the real stock — the double
 * charge). By default the simulation runs what the restaurant build does
 * (restaurantEconomy.restaurantSettlement, P0).
 */
export type SimOptions = {
  profile: Profile;
  legacyFoodCost?: boolean;
  /** Read-only observer (the fridge-pressure study): sees every recorded step; never changes play. */
  observe?: (where: string, s: SaveData) => void;
  /** Called after each level (and its shopping) — checkpoints for the economy studies. */
  onLevel?: (n: number, s: SaveData, stats: Stats) => void;
  /** What a completionist-style player buys after each level: everything (default) or only the kitchen tiers. */
  shop?: "all" | "kitchen";
  /** "sensible": also hires the optional team that lets the restaurant take more menu guests. */
  staffing?: "required" | "sensible";
  /** Stock the whole day in one go when it fits the fridge and the wallet (preServiceCheck.dayStockFor). */
  dayStock?: boolean;
  /** A prudent completionist keeps this much cash after every purchase (cents); 0 = buys greedily. */
  reserve?: number;
};
export type Stats = {
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
  /** The campaign orders' recipe earnings and quality bonus (restaurant settlement). */
  orderEarnings: number;
  qualityBonus: number;
  /** The quality bonus each investment added (recipe earnings × its share), and the emergency orders. */
  qualityBy: Record<string, number>;
  emergencyOrders: number;
  observe?: (where: string, s: SaveData) => void;
};

const lifetimeSum = (s: SaveData) =>
  Object.values(s.economy.lifetime ?? {}).reduce((n, v) => n + (v ?? 0), 0);

/** App.persist: kitchen sync, milestone payouts, the wallet invariant. */
function persist(next: SaveData, stats: Stats, where: string): SaveData {
  const synced = syncKitchenUpgradeOwnership(next);
  const { save } = grantEarnedMilestoneRewards(synced);
  const v = walletInvariantViolation(save);
  if (v) stats.invariant.push(`${where}: ${v}`);
  stats.observe?.(where, save);
  return save;
}

/** Buys `units` of an ingredient the way App.purchaseIngredient records it. */
function buyIngredient(s: SaveData, id: string, units: number) {
  // As App.buyOn: the restaurant Market sells weighed goods by the ¼ (business/measure.ts).
  const r = purchaseIngredient(
    s,
    id,
    units,
    ingredientBulkDiscount(id as IngredientId, units, "lb"),
    supplierPriceFactor(s),
    0,
    lbPerMarketUnit(id as IngredientId, "lb"),
    marketStep(id as IngredientId),
  );
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
function playLevel(save: SaveData, n: number, opts: SimOptions, stats: Stats): SaveData {
  const profile: Profile = opts.profile === "completionist" ? "diligent" : opts.profile;
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

  // Staff: hiring is free. Hiring can create a requirement (a Manager for a
  // team of five), so keep hiring until nothing is missing, like a player.
  for (let pass = 0; pass < 4; pass++) {
    const missing = replan().staff.filter((x) => !x.met);
    if (missing.length === 0) break;
    for (const r of missing) {
      const hired = getSpecialist(r.id)
        ? hireSpecialist(s, r.id, restaurantLevelOf(s.levelProgress))
        : hireStaff(s, r.id);
      if (hired.ok) {
        s = hired.save;
        stats.hires++;
        if (getSpecialist(r.id)) stats.specialists++;
      }
    }
  }

  // Sensible staffing: hire an optional cook or server when the menu's guests
  // (schedule + the kitchen's seats) would exceed what the team can serve.
  if (opts.staffing === "sensible") {
    for (const role of ["prep-cook", "server", "line-cook", "head-chef"]) {
      const want = menuGuestsPerService(n) + kitchenGuestSeats(s);
      if (want <= menuGuestCapacity(s)) break;
      if (s.business.staff.hiredRoles.includes(role as never)) continue;
      const hired = hireStaff(s, role);
      if (hired.ok) {
        s = hired.save;
        stats.hires++;
      }
    }
  }
  // Stock: the whole day at once when the fridge and wallet allow (bulk prices).
  if (opts.dayStock && profile === "diligent") {
    const day = dayStockFor(s, level);
    // Optional: a prudent player (reserve) stocks the whole day only while it keeps its reserve.
    const reserve = opts.reserve ?? 0;
    if (day && day.fits && day.affordable && s.credits - day.totalCost >= reserve)
      for (const row of day.rows) {
        const bought = buyIngredient(s, row.ingredientId, row.buyUnits);
        if (bought.ok) s = persist(bought.s, stats, `${where} buy`);
      }
  }
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
      // Optional stock: a prudent player (reserve) buys it only while it keeps its reserve.
      if (s.credits - g.cost < (opts.reserve ?? 0)) continue;
      const bought = buyIngredient(s, g.ingredientId, g.buyUnits);
      if (bought.ok) s = persist(bought.s, stats, `${where} guest stock`);
    }
    replan();
  }
  if (plan.check.applies && !plan.check.ready) {
    const pantry = pantryForMissing(s, plan.check);
    if (pantry) {
      s = markEmergencyService(pantry, level.id);
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
      s = markEmergencyService(spares, level.id);
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
    // P0 (economy pass): the restaurant build pays earnings + quality bonus;
    // the food was bought as real stock (restaurantEconomy.restaurantSettlement).
    // Mirrors App: the supplier's quality extra rides on the restaurant settlement.
    const settled = opts.legacyFoodCost
      ? settlement
      : restaurantSettlement(settlement, restaurantQualityBonusPct(base), {
          emergency: isEmergencyService(base.levelProgress, level.id),
        });
    const amount = settled.netResult;
    stats.orderEarnings += settled.revenue;
    stats.qualityBonus += settled.qualityBonus;
    if (isEmergencyService(base.levelProgress, level.id)) stats.emergencyOrders++;
    else if (!opts.legacyFoodCost) {
      const q = restaurantQuality(base);
      const parts: Record<string, number> = {
        kitchen: q.kitchen,
        blacksmith: q.equipment.blacksmith,
        knives: q.equipment.knives,
        boards: q.equipment.boards,
        helpers: q.equipment.helpers,
        supplier: supplierEffects(base).qualityBonusPct,
      };
      for (const [k, pct] of Object.entries(parts))
        stats.qualityBy[k] = (stats.qualityBy[k] ?? 0) + Math.round(settled.revenue * pct);
    }
    const paid = appendLedgerEntry(
      {
        ...base,
        credits: base.credits + amount,
        levelProgress: withPaidOrder(base.levelProgress, level.id, recipe.id),
      },
      "campaign-settlement",
      amount,
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
  if (opts.profile === "completionist")
    s = buyEverything(s, stats, where, opts.shop ?? "all", opts.reserve ?? 0);
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

export function run(
  name: string,
  start: SaveData,
  from: number,
  opts: SimOptions,
  log = true,
): { s: SaveData; stats: Stats } {
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
    orderEarnings: 0,
    qualityBonus: 0,
    qualityBy: {},
    emergencyOrders: 0,
    observe: opts.observe,
  };
  let s = start;
  const startCash = s.credits;
  const startLifetime = lifetimeSum(s);
  for (let n = from; n <= 250; n++) {
    s = playLevel(s, n, opts, stats);
    checkInvariants(s, startCash, startLifetime, stats, `L${n}`);
    opts.onLevel?.(n, s, stats);
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
  if (log) console.log(`\n  ${name}`);
  if (log)
    console.log(
      `    levels ${stats.levels}/${251 - from} · orders ${stats.ordersServed} · menu guests ${stats.guests} · closings ${stats.closings}`,
    );
  if (log)
    console.log(
      `    cash ${$(startCash)} → ${$(s.credits)} · settlements ${line("campaign-settlement")} · rewards ${line("completion-reward")} · menu revenue ${line("business-revenue")} · milestones ${line("milestone-reward")} + legacy ${line("family-legacy")}`,
    );
  if (log)
    console.log(
      `    spent: ingredients ${line("inventory-purchase")} · supplies ${line("supply-packaging-purchase")} / ${line("supply-equipment-purchase")} · fridges ${line("refrigerator-purchase")} · wages ${line("business-staff-salary")} · fines ${line("inspection-fine")}`,
    );
  if (log)
    console.log(
      `    help: pantry ×${stats.pantry} · spares ×${stats.spares} · hires ${stats.hires} (${stats.specialists} specialists) · fridge upgrades ${stats.fridgeUpgrades} · fridge over capacity (Grandma's goods) at ${stats.fridgeOverByGrandma} level ends`,
    );
  if (log && stats.blocked.length)
    console.log(`    BLOCKED: ${stats.blocked.slice(0, 5).join(" | ")}`);
  if (stats.invariant.length)
    if (log) console.log(`    INVARIANT: ${stats.invariant.slice(0, 5).join(" | ")}`);
  return { s, stats };
}

/** The completionist's shopping (economy-v25-simulation's own list, in its order), recorded like App. */
function buyEverything(
  save: SaveData,
  stats: Stats,
  where: string,
  shop: "all" | "kitchen" = "all",
  reserve = 0,
): SaveData {
  let s = save;
  const attempts = buyAttempts().filter((a) => shop === "all" || a.label.startsWith("kitchen"));
  for (let guard = 0; guard < 500; guard++) {
    let bought = false;
    for (const a of attempts) {
      const r = a.run(s);
      // A prudent player's $500 is left AFTER the next service's own needs
      // (its stock, its supplies, an empty bottle), not spent on them.
      if (!r || r.save.credits < reserve + (reserve > 0 ? nextServiceNeeds(r.save) : 0)) continue;
      s = persist(
        appendLedgerEntry(r.save, r.category, -r.cost, r.id),
        stats,
        `${where} buy ${a.label}`,
      );
      bought = true;
      break;
    }
    if (!bought) break;
  }
  return s;
}

/** What the next service will have to buy before it can start (stock + blocking supplies + empty bottles), at the Market's price. */
function nextServiceNeeds(save: SaveData): number {
  // The level played next: the furthest one unlocked (the one just finished is complete).
  const level = getLevel(save.levelProgress.highestUnlockedLevelId);
  const plan = level ? servicePlanFor(save, level) : null;
  if (!plan) return 0;
  let cost = plan.check.applies ? plan.check.missingCost : 0;
  if (plan.supplies.applies) {
    cost += plan.supplies.missingCost;
    for (const b of [plan.supplies.soap, plan.supplies.cleaner])
      if (b.spare === 0 && b.status !== "ok") cost += supplyPackPrice(getSupplyItem(b.id)!);
  }
  // A closing due before the next service pays the day's wages (from L91): keep them too.
  if (restaurantDayOf(save).closingDue && isSystemLive("full-operation", plan.levelNumber)) {
    cost += dailyPayroll(save.business.staff.hiredRoles);
    cost +=
      (save.business.restaurantStaff?.specialists?.length ?? 0) *
      BUSINESS_STAFF_CATALOG[SPECIALIST_WAGE_FROM_ROLE].salary;
  }
  return cost;
}

/** A fresh restaurant save (moved in, intro done). */
export const freshRestaurantSave = () =>
  migrateToUnifiedRestaurant({
    ...structuredClone(DEFAULT_SAVE),
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
