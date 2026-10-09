/**
 * RESTAURANT GUESTS QA — Unified Restaurant phase D: customer orders from
 * the ACTIVE MENU inside campaign services (restaurant/menuGuests.ts).
 *
 *  G. Schedule: no guests before L6 (the tutorial), 1 / 2 / 3 / 4 / 5 from
 *     L6 / 21 / 51 / 121 / 201 (restaurantProgression, configurable).
 *  M. Menu control, checked at EVERY level 6–250: every guest's dish is
 *     unlocked at that level and on the active menu; a dish switched off
 *     (from the menu-choice level) never appears; guests are deterministic.
 *  N. The next guest: one at a time, the count saved per level so a guest
 *     is never offered (or paid) twice; none on a replay, none for a batch
 *     group, none past the service's total; completing the level drops the
 *     count; in-stock verdict from L11 (always in stock before).
 *  P. A guest pays the dish's menu price through the existing Business
 *     payment rule (no new numbers).
 *  S. Session: the guest becomes one more ticket of the same service.
 *  W. Wiring: serving a guest is behind RESTAURANT_MODE: real stock, one
 *     "business-revenue" ledger entry, the day's P&L and the guest count in
 *     the same persist; the level's own orders are unchanged.
 *
 * Run: npx tsx scripts/restaurant-guests-qa.mts
 */
import { lbPerMarketUnit, marketStep } from "../src/game/business/measure.ts";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, completeLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import {
  menuGuestQueue,
  menuGuestsServed,
  nextMenuGuest,
  withMenuGuestServed,
} from "../src/game/restaurant/menuGuests.ts";
import {
  MENU_CHOICE_LEVEL,
  menuGuestsPerService,
  dishUnlockLevel,
} from "../src/game/restaurant/restaurantProgression.ts";
import { activeMenuDishes } from "../src/game/restaurant/restaurantMenu.ts";
import { businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { businessCustomerPayment } from "../src/game/business/BusinessServiceManager.ts";
import {
  createTicketedServiceSession,
  advanceServiceSession,
  serveCurrentOrder,
  recordAllComponents,
  withExtraTicket,
  createServiceSession,
} from "../src/game/service/ServiceManager.ts";
import { rollServiceTickets } from "../src/game/restaurant/serviceTickets.ts";
import {
  guestStockFor,
  servicePlanFor,
  servicePlanNeedsSheet,
} from "../src/game/restaurant/preServiceCheck.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { openDay } from "../src/game/restaurant/restaurantDay.ts";
import { restaurantAttention } from "../src/game/restaurant/restaurantAttention.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const progressAt = (n: number): LevelProgress => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number, inactive: string[] = []): SaveData => ({
  ...DEFAULT_SAVE,
  levelProgress: progressAt(n),
  business: {
    ...DEFAULT_SAVE.business,
    inventory: {},
    menuActivation: { inactiveDishIds: inactive },
  },
});
const lv = (n: number) => getLevel(`level-${n}`)!;

console.log("G. Schedule");
assert(
  // 2026-10-05: customers order from a menu, so guests start when the menu opens (L11).
  menuGuestsPerService(10) === 0 &&
    menuGuestsPerService(11) === 1 &&
    menuGuestsPerService(21) === 2 &&
    menuGuestsPerService(51) === 3 &&
    menuGuestsPerService(121) === 4 &&
    menuGuestsPerService(250) === 5 &&
    menuGuestQueue(saveAt(10), lv(10)).length === 0,
  "G1: no guests before the menu opens; 1 / 2 / 3 / 4 / 5 from L11 / 21 / 51 / 121 / 201",
);

console.log("M. Menu control");
{
  const breaks: string[] = [];
  for (const level of LEVELS) {
    const n = Number(level.id.split("-")[1]);
    if (n < 6 || level.batchGroupRecipeIds?.length) continue;
    const s = saveAt(n);
    const active = new Set(activeMenuDishes(s.business.menuActivation, n).map((d) => d.id));
    for (const r of menuGuestQueue(s, level)) {
      const dish = businessDishForRecipeId(r.id);
      if (!dish) breaks.push(`L${n} ${r.id}: not a menu dish`);
      else if ((dishUnlockLevel(dish.id) ?? Infinity) > n) breaks.push(`L${n} ${dish.id}: locked`);
      else if (!active.has(dish.id)) breaks.push(`L${n} ${dish.id}: not active`);
    }
  }
  assert(
    breaks.length === 0,
    `M1: at every level 6–250 every guest orders an unlocked, active menu dish ${breaks.slice(0, 3).join("; ")}`,
  );
  const offBreaks: string[] = [];
  for (let n = MENU_CHOICE_LEVEL; n <= 250; n++) {
    const level = lv(n);
    if (level.batchGroupRecipeIds?.length) continue;
    const firstGuest = menuGuestQueue(saveAt(n), level)[0];
    if (!firstGuest) continue;
    const off = businessDishForRecipeId(firstGuest.id)!.id;
    const again = menuGuestQueue(saveAt(n, [off]), level);
    if (again.some((r) => businessDishForRecipeId(r.id)?.id === off))
      offBreaks.push(`L${n} ${off}`);
  }
  assert(
    offBreaks.length === 0,
    `M2: a dish switched off never appears (every level from ${MENU_CHOICE_LEVEL}) ${offBreaks.slice(0, 3).join("; ")}`,
  );
  assert(
    menuGuestQueue(saveAt(40), lv(40))
      .map((r) => r.id)
      .join() ===
      menuGuestQueue(saveAt(40), lv(40))
        .map((r) => r.id)
        .join() && menuGuestQueue(saveAt(40), lv(40)).length === 2,
    "M3: the same level brings the same guests (deterministic)",
  );
  const early = menuGuestQueue(saveAt(12, ["biz-garden-salad"]), lv(12));
  assert(
    early.length === 1,
    "M4: before the menu-choice level the menu runs itself (a saved switch is ignored)",
  );
}

console.log("N. The next guest");
{
  const s = saveAt(40);
  const g1 = nextMenuGuest(s, lv(40))!;
  const s2 = { ...s, levelProgress: withMenuGuestServed(s.levelProgress, "level-40") };
  const g2 = nextMenuGuest(s2, lv(40))!;
  const s3 = { ...s2, levelProgress: withMenuGuestServed(s2.levelProgress, "level-40") };
  const queue = menuGuestQueue(s, lv(40));
  assert(
    g1.number === 1 &&
      g1.total === 2 &&
      g1.recipe.id === queue[0]!.id &&
      g2.number === 2 &&
      g2.recipe.id === queue[1]!.id &&
      nextMenuGuest(s3, lv(40)) === null,
    "N1: guests come one at a time from the saved count; none past the service's total",
  );
  const replay = {
    ...s,
    levelProgress: {
      ...s.levelProgress,
      completedLevelIds: [...s.levelProgress.completedLevelIds, "level-40"],
    },
  };
  const batch = LEVELS.find(
    (l) => l.batchGroupRecipeIds?.length && Number(l.id.split("-")[1]) >= 6,
  )!;
  assert(
    nextMenuGuest(replay, lv(40)) === null &&
      nextMenuGuest(saveAt(Number(batch.id.split("-")[1])), batch) === null,
    "N2: no guests on a replay or for a batch group",
  );
  const done = completeLevel("level-40", s3.levelProgress);
  assert(
    menuGuestsServed(done.progress, "level-40") === 0 &&
      done.progress.menuGuests?.["level-40"] === undefined,
    "N3: completing the level drops the guest count",
  );
  assert(
    nextMenuGuest(saveAt(12), lv(12))!.inStock === true &&
      nextMenuGuest(saveAt(40), lv(40))!.inStock === false,
    "N4: in stock always before L15 (menu without stock at L11–14); from L15 the guest needs the dish's stock",
  );
}

console.log("K. The guests' stock in the Pre-Service Check (phase N)");
{
  // Found by restaurant-campaign-sim-qa: the check stocked only the level's own orders, so a
  // guest's dish was almost never in stock (4 guests in 250 levels). The check now lists them.
  const n = 40;
  const lv40 = lv(n);
  const base = openDay(saveAt(n), n);
  const tickets = rollServiceTickets(lv40);
  const g = guestStockFor(base, lv40, n, tickets);
  const plan = servicePlanFor(base, lv40)!;
  assert(
    g.dishes.length === menuGuestQueue(base, lv40).length &&
      g.rows.length > 0 &&
      g.rows.every((r) => r.buyUnits > 0 && r.cost > 0),
    "K1: the check lists today's guests and the extra stock their dishes need, at the Market's price",
  );
  // Buy the level's own stock only: the sheet may still list guests, but it isn't forced open by them.
  let own = base;
  if (plan.check.applies)
    for (const r of plan.check.missingRows) {
      const b = purchaseIngredient(
        own,
        r.ingredientId,
        r.buyUnits,
        0,
        1,
        0,
        lbPerMarketUnit(r.ingredientId, "lb"),
        marketStep(r.ingredientId),
      );
      if (b.ok) own = b.save;
    }
  const ownPlan = servicePlanFor(own, lv40)!;
  assert(
    ownPlan.check.applies &&
      ownPlan.check.ready &&
      ownPlan.guests.rows.length > 0 &&
      // The guest rows never change whether the sheet opens or START is allowed.
      servicePlanNeedsSheet(ownPlan) ===
        servicePlanNeedsSheet({ ...ownPlan, guests: { dishes: [], rows: [] } }) &&
      servicePlanNeedsSheet(plan) ===
        servicePlanNeedsSheet({ ...plan, guests: { dishes: [], rows: [] } }),
    "K2: guest stock is optional — with the own orders stocked, missing guest stock never blocks or opens the check",
  );
  let all = own;
  for (const r of ownPlan.guests.rows) {
    const b = purchaseIngredient(
      all,
      r.ingredientId,
      r.buyUnits,
      0,
      1,
      0,
      lbPerMarketUnit(r.ingredientId, "lb"),
      marketStep(r.ingredientId),
    );
    if (b.ok) all = b.save;
  }
  const after = servicePlanFor(all, lv40)!;
  const first = nextMenuGuest(all, lv40);
  assert(
    after.guests.rows.length === 0 && after.check.applies && after.check.ready && !!first?.inStock,
    "K3: buying exactly those rows stocks every guest (no double counting with the own orders)",
  );
  const att = restaurantAttention(own);
  assert(
    att.rows.some((r) => r.id.startsWith("guest:") && r.severity === "low"),
    "K4: Inventory recommends the guests' stock as a low (optional) row",
  );
}

console.log("P. Price");
{
  const s = saveAt(40);
  const g = nextMenuGuest(s, lv(40))!;
  assert(
    g.pays === businessCustomerPayment(s, g.dish).customerPays && g.pays > 0,
    "P1: a guest pays the dish's menu price (existing Business payment rule)",
  );
}

console.log("S. Session");
{
  const tickets = rollServiceTickets(lv(40));
  const s = createTicketedServiceSession("level-40", tickets, 0, Math.random, 4, false)!;
  // Serve every one of the level's own orders first (a guest comes only after the last).
  let served = serveCurrentOrder(recordAllComponents(s, 90), Math.random, 0)!.session;
  while (served.completedCount + 1 < tickets.length) {
    served = advanceServiceSession(served, [], Math.random);
    served = serveCurrentOrder(recordAllComponents(served, 90), Math.random, 0)!.session;
  }
  const guest = nextMenuGuest(saveAt(40), lv(40))!.recipe;
  const withGuest = advanceServiceSession(withExtraTicket(served, guest), [], Math.random);
  assert(
    withGuest.current?.recipe.id === guest.id &&
      withGuest.completedCount === tickets.length &&
      withGuest.tickets?.length === tickets.length + 1,
    "S1: the guest becomes one more ticket of the same service",
  );
  const classic = createServiceSession("level-40", tickets, Math.random, 4, false);
  assert(
    withExtraTicket(classic, guest) === classic,
    "S2: a session without tickets (switch off) takes no guests",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    /if \(\s*RESTAURANT_MODE &&\s*level &&\s*campaignServiceSession\.tickets &&\s*campaignServiceSession\.completedCount >= ordersRequired\(level\)\s*\)\s*return serveMenuGuestOrder\(level, recipe\);/.test(
      app,
    ),
    "W1: only an order past the level's own, under RESTAURANT_MODE, is served as a menu guest",
  );
  assert(
    // First levels pass 2 (2026-10-09): a guest says it is one ("guest" — before L15
    // guests use no stock; the level's own order uses Grandma's fridge).
    /consumeCampaignOrderStock\(\s*save,\s*levelNumber\(level\.id\),\s*recipe,\s*true,\s*"guest",?\s*\)/.test(
      app,
    ) &&
      // Phase G: the guest's place setting + napkin are taken from that same save first.
      /const withSupplies = takeOrderSupplies\(\s*stock\.save,/.test(app) &&
      /levelProgress: withMenuGuestServed\(withSupplies\.levelProgress, level\.id\)/.test(app) &&
      /persist\(appendLedgerEntry\(paid, "business-revenue", result\.coinsAwarded, dish\.id\)\)/.test(
        app,
      ),
    "W2: a guest uses real stock and is paid with ONE business-revenue entry, its count saved in the same persist",
  );
  assert(
    /const menuGuest =\s*RESTAURANT_MODE &&/.test(app),
    "W3: the menu-guest button exists only under RESTAURANT_MODE",
  );
}

console.log(
  failures ? `\nRESTAURANT GUESTS QA: ${failures} FAILURE(S)` : "\nRESTAURANT GUESTS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
