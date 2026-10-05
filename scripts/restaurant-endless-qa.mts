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

/** One Endless Restaurant day, as the game plays it. */
export function playDay(save: SaveData): { save: SaveData; served: number; problems: string[] } {
  const problems: string[] = [];
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
  let session = createBusinessServiceSession(rand, s.business.menuActivation);
  let served = 0;
  const target = businessCustomersToday(s).target;
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
        if (r.ok)
          s = recordInventoryPurchase(
            appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, req.ingredientId),
            r.totalCost,
            1,
          );
      }
      if (!businessOrderAvailability(s, dish).available) break;
    }
    const result = serveBusinessOrder(recordBusinessServiceComponents(session, 85), s, rand);
    if (!result) break;
    s = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
    served++;
    session = advanceBusinessServiceSession(result.session, rand, s.business.menuActivation);
  }
  const end = endBusinessDay(s);
  s = appendLedgerEntry(
    appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid),
    "inspection-fine",
    -end.inspectionFine.finePaid,
  );
  s = paySpecialists(s, 250).save;
  const v = walletInvariantViolation(s);
  if (v) problems.push(v);
  return { save: s, served, problems };
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
export function runEndlessConfigs(L250: SaveData, log = true) {
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
  const results: Array<{ name: string; perDay: number; customers: number; problems: string[] }> =
    [];
  for (const [name, start] of configs) {
    let s = start;
    const startCash = s.credits;
    const startLifetime = lifetimeSum(s);
    let customers = 0;
    const problems: string[] = [];
    for (let d = 0; d < 30; d++) {
      const r = playDay(s);
      s = r.save;
      customers += r.served;
      problems.push(...r.problems);
      if (startCash + (lifetimeSum(s) - startLifetime) !== s.credits)
        problems.push(`day ${d}: cash ≠ ledger`);
    }
    const perDay = Math.round((s.credits - startCash) / 30);
    const dm = endlessDemandFor(start, 8);
    results.push({ name, perDay, customers: customers / 30, problems });
    if (log)
      console.log(
        `  ${name}: ${$(perDay)}/day net · ${(customers / 30).toFixed(1)} customers/day (cookable ${dm.cookableDishes} dishes, demand ${dm.demand}, capacity ${dm.capacity} at the start) · popularity ${start.business.popularity.score} → ${s.business.popularity.score}`,
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

  {
    const svc = fs.readFileSync("src/game/business/BusinessServiceManager.ts", "utf8");
    const app = fs.readFileSync("src/App.tsx", "utf8");
    const mod = fs
      .readFileSync("src/game/restaurant/endlessDemand.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    assert(
      /usesRestaurantDemand\(save\) \? endlessDemandFor\(save, classic\)\.customers : classic/.test(
        svc,
      ) &&
        /RESTAURANT_MODE\s*\?\s*paySpecialists\(fined/.test(app) &&
        !/RESTAURANT_MODE|Math\.random/.test(mod),
      "E6: wiring — the day's customers use this rule only for a restaurant save (classic demand otherwise); App pays the specialists at End Business Day only in the restaurant build; the rule never reads the switch",
    );
  }

  console.log(
    failures ? `RESTAURANT ENDLESS QA: ${failures} FAILURE(S)` : "RESTAURANT ENDLESS QA: ALL PASS",
  );
  process.exit(failures ? 1 : 0);
}
