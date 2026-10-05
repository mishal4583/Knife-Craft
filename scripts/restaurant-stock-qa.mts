/**
 * RESTAURANT STOCK QA — Unified Restaurant phases 3–4: campaign orders use
 * real stock, the rolled tickets and the Pre-Service Check (spec tests A,
 * B, C (wiring), D, E, U, V, W).
 *
 *  T. Tickets: an order-pool level rolls `requiredOrders` from its own pool
 *     (seeded: the same every time), a batch group its fixed recipes; saved
 *     once and reused; dropped when the level completes; a ticketed session
 *     serves them in order and a retry starts after the paid ones.
 *  A. Levels 1–10 use no stock; from Level 11 a served order takes exactly
 *     its recipe's stock from `business.inventory` (the one inventory).
 *  B. Exactly once: one serve, one draw-down; a replay or an order the level
 *     no longer owes draws nothing.
 *  D/V. Stock use never touches the wallet or the ledger (the order's pay is
 *     unchanged; Market purchases keep their own one ledger entry).
 *  E. Expired stock is never used; the check shows it and refuses to count it.
 *  K. The check: need / usable / missing / whole units to buy at the
 *     Market's own price, wallet and fridge verdicts; ready when covered.
 *  U. Never stuck: Grandma's pantry appears only when the wallet can't cover
 *     the missing stock, adds exactly that (at cost 0, expired thrown out
 *     first), moves no money, and makes the check ready.
 *  W. Wiring: App gates everything on RESTAURANT_MODE; Restock opens the
 *     Market on the exact ingredient; no second inventory.
 *
 * Run: npx tsx scripts/restaurant-stock-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, completeLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import { withPaidOrder } from "../src/game/levels/paidOrders.ts";
import {
  rollServiceTickets,
  ticketsFor,
  savedTicketsFor,
} from "../src/game/restaurant/serviceTickets.ts";
import {
  serviceStockCheck,
  consumeCampaignOrderStock,
  pantryForMissing,
  serviceUsesStock,
} from "../src/game/restaurant/campaignStock.ts";
import { serviceCheckFor, serviceNeedsAttention } from "../src/game/restaurant/preServiceCheck.ts";
import {
  recipeRequirements,
  requirementsForRecipes,
} from "../src/game/restaurant/recipeRequirements.ts";
import {
  createTicketedServiceSession,
  advanceServiceSession,
  serveCurrentOrder,
  recordAllComponents,
} from "../src/game/service/ServiceManager.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import { shelfLifeForIngredient } from "../src/game/business/perishability.ts";
import {
  purchaseIngredient,
  purchaseQuote,
} from "../src/game/business/BusinessInventoryManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";

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
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

const progressAt = (n: number): LevelProgress => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number, extra: Partial<SaveData> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: progressAt(n),
  business: { ...DEFAULT_SAVE.business, inventory: {} },
  ...extra,
});
/** Stocks exactly what `recipes` need (rounded up to whole units), bought today at $1/unit. */
function stocked(save: SaveData, recipes: Parameters<typeof requirementsForRecipes>[0], extra = 0) {
  let inventory = save.business.inventory;
  for (const r of requirementsForRecipes(recipes))
    inventory = addStock(
      inventory,
      r.ingredientId,
      Math.ceil(r.quantity) + extra,
      100,
      save.business.calendar.businessDay,
    );
  return { ...save, business: { ...save.business, inventory } };
}

const pool30 = getLevel("level-30")!; // order pool, 2 orders
const batch26 = getLevel("level-26")!; // batch group of 2

console.log("T. Tickets");
{
  const a = rollServiceTickets(pool30);
  const b = rollServiceTickets(pool30);
  assert(
    a.length === 2 &&
      a.map((r) => r.id).join() === b.map((r) => r.id).join() &&
      a.every((r) => pool30.recipePoolIds!.includes(r.id)),
    "T1: an order-pool level rolls its required orders from its own pool, the same every time",
  );
  assert(
    rollServiceTickets(batch26)
      .map((r) => r.id)
      .join() === batch26.batchGroupRecipeIds!.join(),
    "T2: a batch group's tickets are its fixed recipes, in order",
  );
  const first = ticketsFor(progressAt(30), pool30);
  const again = ticketsFor(first.progress, pool30);
  assert(
    savedTicketsFor(progressAt(30), pool30) === null &&
      first.progress.tickets?.["level-30"]?.length === 2 &&
      again.progress === first.progress,
    "T3: rolled once and saved; later calls reuse the saved tickets",
  );
  const done = completeLevel("level-30", first.progress);
  assert(
    done.progress.tickets?.["level-30"] === undefined,
    "T4: completing the level drops its tickets",
  );
  const s = createTicketedServiceSession("level-30", a, 0, Math.random, 3, false)!;
  const retry = createTicketedServiceSession("level-30", a, 1, Math.random, 3, false)!;
  const served = serveCurrentOrder(recordAllComponents(s, 90), Math.random, 0);
  const advanced = served ? advanceServiceSession(served.session, [], Math.random) : null;
  assert(
    s.current?.recipe.id === a[0]!.id &&
      s.next?.recipe.id === a[1]!.id &&
      retry.current?.recipe.id === a[1]!.id &&
      retry.completedCount === 1 &&
      retry.next === null &&
      !!advanced &&
      advanced.current?.recipe.id === a[1]!.id &&
      advanced.completedCount === 1,
    "T5: a ticketed session serves the tickets in order; a retry starts after the paid ones",
  );
}

console.log("A/B/D/V. Stock use");
{
  const lv5 = getLevel("level-5")!;
  const r5 = rollServiceTickets(lv5)[0]!;
  const s5 = saveAt(5);
  const none = consumeCampaignOrderStock(s5, 5, r5, true);
  assert(
    // 2026-10-05 teaching sequence: stock from L15 (the menu opens at L11 first).
    !serviceUsesStock(14) &&
      serviceUsesStock(15) &&
      none.ok &&
      none.used === false &&
      none.save === s5 &&
      serviceCheckFor(s5, lv5) === null,
    "A1: Levels 1–14 use no stock and have no check (stock from L15)",
  );
  const [t1] = rollServiceTickets(pool30);
  const before = stocked(saveAt(30), [t1!], 1);
  const used = consumeCampaignOrderStock(before, 30, t1!, true);
  const req = requirementsForRecipes([t1!]);
  assert(
    used.ok &&
      used.used &&
      req.every((r) =>
        near(
          getQuantity(before.business.inventory, r.ingredientId) -
            getQuantity((used as { save: SaveData }).save.business.inventory, r.ingredientId),
          r.quantity,
        ),
      ),
    "A2/B1: from Level 11 a served order takes exactly its recipe's stock from business.inventory",
  );
  assert(
    used.ok &&
      used.save.credits === before.credits &&
      used.save.economyLedger.length === before.economyLedger.length &&
      used.cost > 0,
    "D/V1: using stock moves no money and writes no ledger entry (its cost is reported only)",
  );
  const replay = consumeCampaignOrderStock(before, 30, t1!, false);
  assert(
    replay.ok && replay.used === false && replay.save === before,
    "B2: a replay / an order the level no longer owes uses no stock",
  );
  const empty = consumeCampaignOrderStock(saveAt(30), 30, t1!, true);
  assert(!empty.ok, "B3: without the stock the order is refused and the save is untouched");
  const bought = purchaseIngredient(saveAt(30), "tomato", 2);
  assert(
    bought.ok &&
      bought.save.credits === saveAt(30).credits - bought.totalCost &&
      near(getQuantity(bought.save.business.inventory, "tomato"), 2) &&
      /appendLedgerEntry\([\s\S]{0,120}"inventory-purchase"/.test(read("src/App.tsx")),
    "V2: Market purchases still debit exactly their price through the existing purchase + one inventory-purchase entry",
  );
}

console.log("E. Expired stock");
{
  const [t1] = rollServiceTickets(pool30);
  const id = recipeRequirements(t1!)[0]!.ingredientId;
  const old = stocked(saveAt(30), [t1!], 2);
  const later: SaveData = {
    ...old,
    business: {
      ...old.business,
      calendar: {
        ...old.business.calendar,
        businessDay: old.business.calendar.businessDay + shelfLifeForIngredient(id) + 1,
      },
    },
  };
  const used = consumeCampaignOrderStock(later, 30, t1!, true);
  const check = serviceStockCheck(later, 30, [t1!]);
  assert(!used.ok, "E1: an order can't use expired stock");
  assert(
    check.applies &&
      check.hasExpired &&
      !check.ready &&
      check.rows.find((r) => r.ingredientId === id)!.usable === 0 &&
      check.rows.find((r) => r.ingredientId === id)!.expired > 0,
    "E2: the check counts expired stock as unusable and flags it to throw out",
  );
}

console.log("K. Pre-Service Check");
{
  const tickets = rollServiceTickets(pool30);
  const empty = saveAt(30);
  const check = serviceStockCheck(empty, 30, tickets);
  const quoteOk =
    check.applies &&
    check.missingRows.every((r) => {
      const q = purchaseQuote(empty, r.ingredientId, r.buyUnits);
      return r.buyUnits === Math.ceil(r.missing - 1e-9) && r.quote?.totalCost === q.totalCost;
    });
  assert(
    check.applies &&
      !check.ready &&
      check.missingRows.length === check.rows.length &&
      quoteOk &&
      check.missingCost === check.missingRows.reduce((s, r) => s + r.quote!.totalCost, 0) &&
      check.affordable,
    "K1: empty fridge: every ingredient missing, whole units at the Market's own price, affordable",
  );
  const full = stocked(empty, tickets);
  const ready = serviceStockCheck(full, 30, tickets);
  assert(
    ready.applies && ready.ready && ready.missingCost === 0,
    "K2: covered stock → ready, nothing to buy",
  );
  const pending = serviceCheckFor(full, pool30)!;
  assert(
    !serviceNeedsAttention(pending) && serviceNeedsAttention(serviceCheckFor(empty, pool30)),
    "K3: the check opens only when something needs attention",
  );
  const retry = {
    ...empty,
    levelProgress: withPaidOrder(
      ticketsFor(empty.levelProgress, pool30).progress,
      "level-30",
      tickets[0]!.id,
    ),
  };
  const p = serviceCheckFor(retry, pool30)!;
  assert(
    p.tickets.length === 1 && p.tickets[0]!.id === tickets[1]!.id,
    "K4: a retry's check lists only the orders still to serve",
  );
  const replay = {
    ...empty,
    levelProgress: {
      ...empty.levelProgress,
      completedLevelIds: [...empty.levelProgress.completedLevelIds, "level-30"],
    },
  };
  assert(serviceCheckFor(replay, pool30) === null, "K5: a replay has no check (free practice)");
  const tinyFridge = stocked(empty, [getCampaignRecipe("camp-garden-salad") ?? tickets[0]!], 39);
  const crowded = serviceStockCheck(tinyFridge, 30, tickets);
  assert(
    crowded.applies && crowded.storageFree < 40,
    "K6: the check reports free fridge space against what the purchases need",
  );
}

console.log("U. Never stuck");
{
  const tickets = rollServiceTickets(pool30);
  const rich = saveAt(30);
  const broke = saveAt(30, { credits: 0 });
  const richCheck = serviceStockCheck(rich, 30, tickets);
  const brokeCheck = serviceStockCheck(broke, 30, tickets);
  assert(
    pantryForMissing(rich, richCheck) === null,
    "U1: no pantry when the wallet covers the missing stock",
  );
  const next = brokeCheck.applies ? pantryForMissing(broke, brokeCheck) : null;
  const after = next ? serviceStockCheck(next, 30, tickets) : null;
  assert(
    !!next &&
      next.credits === 0 &&
      next.economyLedger.length === broke.economyLedger.length &&
      !!after &&
      after.applies &&
      after.ready,
    "U2: with no money the pantry covers exactly the missing stock: no money, no ledger, ready to start",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  assert(
    /RESTAURANT_MODE && save && level\s*\?\s*consumeCampaignOrderStock\(save, levelNumber\(level\.id\), recipe, !isReplay\)/.test(
      app,
    ) &&
      /consumeCampaignOrderStock\(save, levelNumber\(level\.id\), viewed\.recipe, !isReplay\)/.test(
        app,
      ) &&
      /if \(RESTAURANT_MODE && !isReplay\) \{\s*const \{ tickets \} = ticketsFor/.test(app) &&
      /if \(RESTAURANT_MODE\) \{[\s\S]{0,900}servicePlanFor\(save, level\)/.test(app),
    "W1: every restaurant path in App is behind RESTAURANT_MODE (serve, batch serve, tickets, check)",
  );
  assert(
    /onRestock=\{\(id\) =>\s*openMarketIngredients\(\s*go,\s*id,\s*check\.applies\s*\?\s*check\.missingRows\.find\(\(r\) => r\.ingredientId === id\)\?\.buyUnits\s*:\s*undefined,?\s*\)/.test(
      layer,
    ),
    "C/W2: Restock opens the Market on that exact ingredient, preset to the missing whole units",
  );
  const files = [
    "src/game/restaurant/campaignStock.ts",
    "src/game/restaurant/preServiceCheck.ts",
    "src/game/restaurant/serviceTickets.ts",
  ]
    .map(read)
    .join("\n");
  assert(
    /save\.business\.inventory/.test(files) &&
      !/inventory\s*:\s*\{\}\s*as/.test(files) &&
      !/new Map<IngredientId, InventoryEntry>/.test(files),
    "W3: the campaign reads and writes business.inventory, no second inventory",
  );
}

console.log(
  failures ? `\nRESTAURANT STOCK QA: ${failures} FAILURE(S)` : "\nRESTAURANT STOCK QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
