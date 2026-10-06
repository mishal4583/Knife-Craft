/**
 * RESTAURANT ENDLESS QA — the Endless Restaurant's economy after Level 250
 * (developer 2026-10-05: "Scale demand"), tested with the real Business
 * engine on the save a completionist reaches at L250 (the full restaurant
 * simulation, restaurantCampaignSim.mts).
 *
 * Each day mirrors the game: buy the stock today's orders need at the
 * restaurant's prices (restaurantQuote: bulk + Campaign Supplier), serve
 * the day's customers (BusinessServiceManager — the demand rule of
 * restaurant/endlessDemand.ts), then End Business Day (payroll, inspection,
 * popularity, the P&L) with its ledger entries and the specialist chefs'
 * wages. 30 days per restaurant; money is whole cents, never < 0, and the
 * ledger matches the cash every day.
 *
 * Five restaurants (the developer's list):
 *  1. Minimum viable — the chef alone, a 6-dish menu.
 *  2. Medium developed — Prep Cook, Server, Line Cook, a 20-dish menu.
 *  3. Fully upgraded, thinly staffed — the full menu, Prep Cook + Server.
 *  4. Fully staffed — the team the campaign required + the 4 specialists,
 *     the full menu.
 *  5. Poorly managed / overstaffed — the full team and specialists, a
 *     6-dish menu.
 * Targets: the fully developed, properly staffed restaurant earns about
 * $300–$600 a day; a poorly run one makes little or loses money; building
 * the restaurant up is what pays (each step earns more than the last).
 *
 * Run: npx tsx scripts/restaurant-endless-qa.mts
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { run, freshRestaurantSave, $ } from "./restaurantCampaignSim.mts";
import type { SaveData } from "../src/game/SaveManager.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { walletInvariantViolation } from "../src/game/economy/wallet.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { recordInventoryPurchase } from "../src/game/business/BusinessFinanceManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import {
  advanceBusinessServiceSession,
  businessCustomersToday,
  businessOrderAvailability,
  createBusinessServiceSession,
  endlessFeaturedFor,
  recordBusinessServiceComponents,
  serveBusinessOrder,
} from "../src/game/business/BusinessServiceManager.ts";
import {
  businessDishForRecipeId,
  businessDishRequirements,
} from "../src/game/business/businessServiceCatalog.ts";
import {
  makeSeededRand,
  businessServiceSeedFor,
} from "../src/game/business/businessDeterministicRandom.ts";
import { usableQuantity } from "../src/game/business/perishability.ts";
import { getAvailableStorageCapacity } from "../src/game/business/RefrigeratorManager.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import { sumRequirements } from "../src/game/restaurant/recipeRequirements.ts";
import { paySpecialists } from "../src/game/restaurant/staffRequirements.ts";
import { bulkDiscountFor } from "../src/game/restaurant/bulkBuying.ts";
import { supplierPriceFactor } from "../src/game/restaurant/restaurantEconomy.ts";
import { endlessDemandFor, ENDLESS_DEMAND_RULES } from "../src/game/restaurant/endlessDemand.ts";
import {
  endlessEventsActive,
  eventsForDay,
  todaysSpecialBonus,
  withTodaysSpecialServed,
} from "../src/game/restaurant/restaurantEvents.ts";
import {
  endlessStarsOf,
  recordEndlessDayStars,
  starsForDay,
} from "../src/game/restaurant/restaurantStanding.ts";
import {
  DAILY_ORDER_BONUS_COINS,
  claimDaily,
  hasClaimedToday,
} from "../src/game/daily/DailyOrderManager.ts";
import { businessDayAllowed } from "../src/game/restaurant/endlessRestaurant.ts";
import {
  maintenanceStatusFor,
  performRefrigeratorMaintenance,
} from "../src/game/business/businessMaintenance.ts";
import { recordMaintenanceCost } from "../src/game/business/BusinessFinanceManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const lifetimeSum = (s: SaveData) =>
  Object.values(s.economy.lifetime ?? {}).reduce((n, v) => n + (v ?? 0), 0);

/** Day 1 of the simulated calendar: one Business Day per calendar day (the most Today's Special bonuses a player can get). */
const SIM_DATE0 = Date.UTC(2026, 0, 1, 12);

/**
 * One Endless Restaurant day, as the game plays it (App.tsx): the day's
 * events (demand via businessCustomersToday, Today's Special in the order
 * pool), Today's Special's existing once-a-day bonus, End Business Day and
 * the day's stars. `events: false` replays the pre-integration day (no
 * featured dish, no bonus, plain demand) for comparison.
 */
export function playDay(
  save: SaveData,
  opts: { events?: boolean; observe?: (where: string, s: SaveData) => void } = {},
): {
  save: SaveData;
  served: number;
  problems: string[];
  specialBonus: number;
  stars: number;
  starParts: { profitable: boolean; busy: boolean; clean: boolean } | null;
} {
  const useEvents = opts.events !== false;
  const problems: string[] = [];
  let specialBonus = 0;
  let s = save;
  if (maintenanceStatusFor(s.business.equipmentCondition.refrigeratorCondition) !== "OPERATIONAL") {
    const r = performRefrigeratorMaintenance(s);
    if (r.ok)
      s = recordMaintenanceCost(
        appendLedgerEntry(r.save, "refrigerator-maintenance", -r.cost),
        r.cost,
      );
  }
  const day = s.business.calendar.businessDay;
  const rand = makeSeededRand(businessServiceSeedFor(day));
  const featured = useEvents ? endlessFeaturedFor(s) : undefined;
  const wanted = businessCustomersToday(s).demand;
  const now = new Date(SIM_DATE0 + day * 86_400_000);
  let session = createBusinessServiceSession(rand, s.business.menuActivation, featured);
  let served = 0;
  const target = useEvents
    ? businessCustomersToday(s).target
    : endlessDemandFor(
        s,
        businessCustomersToday({
          ...s,
          business: { ...s.business, restaurantMigration: undefined },
        }).target,
      ).customers;
  while (served < target && session.current) {
    const dish = businessDishForRecipeId(session.current.recipe.id)!;
    if (!businessOrderAvailability(s, dish).available) {
      // Summed per ingredient: a dish can list one ingredient in two components.
      for (const req of sumRequirements(businessDishRequirements(dish))) {
        const have = usableQuantity(s.business.inventory, req.ingredientId, day);
        if (have >= req.quantity) continue;
        const free = Math.floor(
          getAvailableStorageCapacity(s.business.inventory, s.business.refrigerator.refrigeratorId),
        );
        // The whole units this order is short of (a player restocking as orders come in).
        const qty = Math.min(Math.max(1, Math.ceil(req.quantity - have - 1e-9)), free);
        if (qty <= 0) continue;
        const r = purchaseIngredient(
          s,
          req.ingredientId,
          qty,
          bulkDiscountFor(qty),
          supplierPriceFactor(s),
        );
        if (r.ok) {
          s = recordInventoryPurchase(
            appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, req.ingredientId),
            r.totalCost,
            1,
          );
          opts.observe?.("buy", s);
        }
      }
      if (!businessOrderAvailability(s, dish).available) break;
    }
    const result = serveBusinessOrder(recordBusinessServiceComponents(session, 85), s, rand);
    if (!result) break;
    s = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
    // App.serveActiveBusinessOrder: note that today's featured dish was served (paid at closing).
    if (useEvents) s = withTodaysSpecialServed(s, result.dish.id);
    served++;
    opts.observe?.("serve", s);
    session = advanceBusinessServiceSession(
      result.session,
      rand,
      s.business.menuActivation,
      featured,
    );
  }
  const end = endBusinessDay(s);
  opts.observe?.("closing", end.save);
  s = appendLedgerEntry(
    appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid),
    "inspection-fine",
    -end.inspectionFine.finePaid,
  );
  s = paySpecialists(s, 250).save;
  // App.advanceBusinessDay: the day's stars (status only).
  let stars = 0;
  let starParts: { profitable: boolean; busy: boolean; clean: boolean } | null = null;
  const closed = s.business.finance.history?.at(-1);
  if (useEvents && endlessEventsActive(s) && closed) {
    const d = starsForDay({
      profit: closed.profit,
      ordersServed: closed.ordersServed,
      customersWanted: wanted,
      inspectionPassed: end.inspectionReport.overall !== "FAIL",
    });
    stars = d.stars;
    starParts = { profitable: d.profitable, busy: d.busy, clean: d.clean };
    s = recordEndlessDayStars(s, d);
  }
  // App.advanceBusinessDay: Today's Special's bonus — 15 % of the day's revenue, ≤ $50, once a calendar day.
  if (
    useEvents &&
    endlessEventsActive(s) &&
    closed &&
    s.business.todaysSpecialServedDay === day &&
    !hasClaimedToday(s.dailyOrder, now)
  ) {
    specialBonus = todaysSpecialBonus(closed.revenue);
    if (specialBonus > 0)
      s = appendLedgerEntry(
        { ...s, credits: s.credits + specialBonus, dailyOrder: claimDaily(s.dailyOrder, now) },
        "daily-reward",
        specialBonus,
        "todays-special",
      );
  }
  const v = walletInvariantViolation(s);
  if (v) problems.push(v);
  return { save: s, served, problems, specialBonus, stars, starParts };
}

/** A restaurant config on top of the L250 save. */
export function configure(
  base: SaveData,
  roles: string[],
  specialists: string[],
  dishes: number,
): SaveData {
  const keep = new Set(BUSINESS_DISH_CATALOG.slice(0, dishes).map((d) => d.id));
  return {
    ...base,
    business: {
      ...base.business,
      staff: { hiredRoles: roles as never },
      restaurantStaff: { specialists },
      menuActivation: {
        inactiveDishIds: BUSINESS_DISH_CATALOG.filter((d) => !keep.has(d.id)).map((d) => d.id),
      },
    },
  };
}

export const ALL_ROLES = ["prep-cook", "server", "line-cook", "cleaner", "head-chef", "manager"];
export const ALL_CHEFS = ["indian-chef", "mediterranean-chef", "mexican-chef", "asian-chef"];

/** The five restaurants, 30 days each, from the L250 save; returns net/day and customers/day per config. */
export function runEndlessConfigs(L250: SaveData, log = true, events = true) {
  const configs: Array<[string, SaveData]> = [
    ["1 Minimum viable (chef alone, 6 dishes)", configure(L250, [], [], 6)],
    [
      "2 Medium (prep, server, line; 20 dishes)",
      configure(L250, ["prep-cook", "server", "line-cook"], [], 20),
    ],
    [
      "3 Fully upgraded, thin staff (prep, server; 48 dishes)",
      configure(L250, ["prep-cook", "server"], [], 48),
    ],
    [
      "4 Fully staffed (6 roles + 4 specialists; 48 dishes)",
      configure(L250, ALL_ROLES, ALL_CHEFS, 48),
    ],
    ["5 Overstaffed (6 roles + 4 specialists; 6 dishes)", configure(L250, ALL_ROLES, ALL_CHEFS, 6)],
  ];
  const results: Array<{
    name: string;
    perDay: number;
    customers: number;
    problems: string[];
    bonus: number;
    stars: number;
    eventDays: { rush: number; group: number };
  }> = [];
  for (const [name, start] of configs) {
    let s = start;
    const startCash = s.credits;
    const startLifetime = lifetimeSum(s);
    let customers = 0;
    let bonus = 0;
    let stars = 0;
    const eventDays = { rush: 0, group: 0 };
    const problems: string[] = [];
    for (let d = 0; d < 30; d++) {
      if (events) {
        const ev = eventsForDay(s, s.business.calendar.businessDay);
        if (ev.some((e) => e.id === "dinner-rush")) eventDays.rush++;
        if (ev.some((e) => e.id === "large-group")) eventDays.group++;
      }
      const capacity = endlessDemandFor(s, 0).capacity;
      const r = playDay(s, { events });
      s = r.save;
      customers += r.served;
      bonus += r.specialBonus;
      stars += r.stars;
      if (r.served > capacity) problems.push(`day ${d}: served beyond the team's capacity`);
      problems.push(...r.problems);
      if (startCash + (lifetimeSum(s) - startLifetime) !== s.credits)
        problems.push(`day ${d}: cash ≠ ledger`);
    }
    const perDay = Math.round((s.credits - startCash) / 30);
    const dm = endlessDemandFor(start, 8);
    const life = endlessStarsOf(s);
    if (events && (life.total !== stars || life.days !== 30))
      problems.push("lifetime stars ≠ the days' stars");
    results.push({ name, perDay, customers: customers / 30, problems, bonus, stars, eventDays });
    if (log)
      console.log(
        `  ${name}: ${$(perDay)}/day net · ${(customers / 30).toFixed(1)} customers/day (cookable ${dm.cookableDishes} dishes, demand ${dm.demand}, capacity ${dm.capacity} at the start) · popularity ${start.business.popularity.score} → ${s.business.popularity.score}${events ? ` · rush ${eventDays.rush} / group ${eventDays.group} days · Today's Special bonus ${$(bonus)} · ★ ${stars} (best ${life.bestDay})` : ""}`,
      );
  }
  return results;
}

export function endlessStartSave(): SaveData {
  return run("completionist", freshRestaurantSave(), 1, { profile: "completionist" }, false).s;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const L250 = endlessStartSave();
  console.log(
    `Endless Restaurant, 30 days each, from the L250 completionist save (${$(L250.credits)}). Rules: ${JSON.stringify(ENDLESS_DEMAND_RULES)}`,
  );
  console.log("Before the integration (no events, no featured dish, no bonus):");
  const plainList = runEndlessConfigs(L250, true, false);
  console.log("Connected Endless day (events, Today's Special, stars):");
  const list = runEndlessConfigs(L250);
  const results = Object.fromEntries(list.map((r) => [r.name, r]));
  console.log("Checks");
  const v = (i: number) => Object.values(results)[i]!;
  assert(
    Object.values(results).every((r) => r.problems.length === 0),
    "E1: money never < 0 and the ledger matches the cash every day, in every restaurant",
  );
  assert(
    v(3).perDay >= 300_00 && v(3).perDay <= 600_00,
    `E2: the fully developed, properly staffed restaurant earns $300–$600 a day (${$(v(3).perDay)})`,
  );
  assert(
    v(0).perDay < 150_00 && v(4).perDay < 150_00,
    `E3: a minimal or overstaffed restaurant earns little or loses money (${$(v(0).perDay)}, ${$(v(4).perDay)})`,
  );
  assert(
    v(0).perDay < v(1).perDay && v(1).perDay < v(3).perDay && v(2).perDay < v(3).perDay,
    "E4: building the restaurant up pays: minimum < medium < fully staffed, and a thin staff caps a big menu",
  );
  assert(
    businessDayAllowed(true, L250.levelProgress),
    "E5: the Endless Restaurant is open after Level 250",
  );
  assert(
    list.every((r) => r.bonus <= 30 * DAILY_ORDER_BONUS_COINS) &&
      list.every((r, i) => r.customers >= plainList[i]!.customers) &&
      list.every((r) => r.stars <= 90),
    `E7: events never lower a day's customers; Today's Special pays at most the existing ${$(DAILY_ORDER_BONUS_COINS)} a day (${list.map((r) => $(r.bonus)).join(" / ")} over 30 days); ≤ 3 stars a day (${list.map((r) => r.stars).join(" / ")})`,
  );

  {
    const svc = fs.readFileSync("src/game/business/BusinessServiceManager.ts", "utf8");
    const app = fs.readFileSync("src/App.tsx", "utf8");
    const mod = fs
      .readFileSync("src/game/restaurant/endlessDemand.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    assert(
      /const restaurant = usesRestaurantDemand\(save\)\s*\?\s*endlessEventsActive\(save\)\s*\?\s*demandWithEvents\(\s*endlessDemandFor\(save, classic\),\s*eventsForDay\(save, save\.business\.calendar\.businessDay\),?\s*\)\s*:\s*endlessDemandFor\(save, classic\)\s*:\s*null;\s*const target = restaurant \? restaurant\.customers : classic;/.test(
        svc,
      ) &&
        /RESTAURANT_MODE\s*\?\s*paySpecialists\(fined/.test(app) &&
        !/RESTAURANT_MODE|Math\.random/.test(mod),
      "E6: wiring — the day's customers use this rule only for a restaurant save, with the day's events only in the Endless Restaurant (classic demand otherwise); App pays the specialists at End Business Day only in the restaurant build; the rule never reads the switch",
    );
  }

  console.log(
    failures ? `RESTAURANT ENDLESS QA: ${failures} FAILURE(S)` : "RESTAURANT ENDLESS QA: ALL PASS",
  );
  process.exit(failures ? 1 : 0);
}
