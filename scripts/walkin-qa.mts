/**
 * WALKIN_QA — early game phase 3 (developer 2026-10-25): walk-in customers from Level 5
 * (`restaurant/menuGuests.ts`). After a level's own orders and its menu guests, a service
 * takes `WALK_IN_RULES.perService` walk-in within the team's capacity, through the same
 * pipeline (extra ticket → menu price → one "business-revenue" entry → real stock), counted
 * on in `levelProgress.menuGuests` (no new save field).
 *   S. schedule and capacity;  L. lifecycle (guest → walk-in → none; completed → none);
 *   R. the reserve: a walk-in never takes the stock the next level's own orders need;
 *   I. insufficient stock: what to buy, and buying it (the check's optional rows) fixes it;
 *   P. paid once: the count is saved with the payment, a reload keeps it, finishing drops it;
 *   O. old saves and players past L5;  D. determinism, staff and the guests' picks unchanged;
 *   W. the App wiring (label, the same serve path).
 *
 * Run: npx tsx scripts/walkin-qa.mts
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
import { completeLevel, getLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import {
  WALK_IN_RULES,
  customerQueue,
  menuGuestQueue,
  menuGuestsFor,
  nextMenuGuest,
  remainingWalkIns,
  reservedTicketsFor,
  walkInQueue,
  walkInStock,
  walkInsFor,
  withMenuGuestServed,
} from "../src/game/restaurant/menuGuests.ts";
import {
  consumeCampaignOrderStock,
  serviceStockCheck,
} from "../src/game/restaurant/campaignStock.ts";
import { orderRequirements } from "../src/game/restaurant/campaignStock.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
import { serviceShape } from "../src/game/restaurant/staffRequirements.ts";
import { menuGuestsPerService } from "../src/game/restaurant/restaurantProgression.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { lbPerMarketUnit, marketStep } from "../src/game/business/measure.ts";
import type { RecipeDefinition } from "../src/game/recipes/recipeTypes.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

const progressAt = (n: number, menuGuests?: Record<string, number>): LevelProgress => ({
  ...DEFAULT_SAVE.levelProgress,
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  ...(menuGuests ? { menuGuests } : {}),
});
const saveAt = (
  n: number,
  extra: Partial<SaveData["business"]> = {},
  menuGuests?: Record<string, number>,
): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: progressAt(n, menuGuests),
  business: { ...DEFAULT_SAVE.business, inventory: {}, ...extra },
});
const lv = (n: number) => getLevel(`level-${n}`)!;
/** Stock exactly what `recipes` use (plus `pad` of each), fresh today. */
function stocked(save: SaveData, recipes: readonly RecipeDefinition[], pad = 0): SaveData {
  let inv = save.business.inventory;
  const need = new Map<string, number>();
  for (const r of recipes)
    for (const q of orderRequirements(save, r))
      need.set(q.ingredientId, (need.get(q.ingredientId) ?? 0) + q.quantity);
  for (const [id, q] of need)
    inv = addStock(inv, id as never, q + pad, 100, save.business.calendar.businessDay);
  return { ...save, business: { ...save.business, inventory: inv } };
}
const ids = (rs: readonly RecipeDefinition[]) => rs.map((r) => r.id).join();

console.log("S. Schedule and capacity");
{
  const staffed = saveAt(14, { staff: { hiredRoles: ["prep-cook"] as never } });
  assert(
    WALK_IN_RULES.fromLevel === 5 &&
      WALK_IN_RULES.perService === 1 &&
      walkInsFor(saveAt(4), 4) === 0 &&
      [5, 10, 13].every((n) => walkInsFor(saveAt(n), n) === 1),
    "S1: none before L5; 1 walk-in per service from L5 (the chef's 2 seats: 1 guest + 1 walk-in)",
  );
  assert(
    walkInsFor(saveAt(14), 14) === 0 && walkInsFor(staffed, 14) === 1,
    "S2: within the team's capacity: at L14 (2 guests) the chef alone has no room; one hire makes room",
  );
  let over = 0;
  for (let n = 1; n <= 148; n++) {
    const s = saveAt(n, {
      staff: { hiredRoles: ["prep-cook", "server", "line-cook", "head-chef"] as never },
    });
    if (walkInsFor(s, n) > WALK_IN_RULES.perService) over++;
    if (menuGuestsFor(s, n) + walkInsFor(s, n) > 6) over++;
  }
  assert(over === 0, "S3: bounded — never more than 1 walk-in a service, at every level", over);
  const batch = [...Array(148)].map((_, i) => lv(i + 1)).find((l) => l.batchGroupRecipeIds?.length);
  assert(
    !!batch && walkInQueue(saveAt(Number(batch.id.split("-")[1])), batch).length === 0,
    "S4: no walk-ins on a batch-group level (as menu guests)",
  );
}

console.log("L. Lifecycle");
{
  const q = customerQueue(saveAt(8), lv(8));
  const g0 = nextMenuGuest(saveAt(8), lv(8));
  const w = nextMenuGuest(saveAt(8, {}, { "level-8": 1 }), lv(8));
  assert(
    q.map((c) => c.kind).join() === "guest,walk-in" &&
      g0?.kind === "guest" &&
      g0.number === 1 &&
      g0.total === 1 &&
      w?.kind === "walk-in" &&
      w.number === 1 &&
      w.total === 1 &&
      nextMenuGuest(saveAt(8, {}, { "level-8": 2 }), lv(8)) === null,
    "L1: L8 — the menu guest (1/1), then the walk-in (1/1), then nobody",
    { q: q.map((c) => c.kind), g0: g0?.kind, w: w?.kind },
  );
  const done = completeLevel("level-8", progressAt(8, { "level-8": 1 }));
  const after = { ...saveAt(8), levelProgress: done.progress };
  assert(
    done.progress.menuGuests?.["level-8"] === undefined &&
      nextMenuGuest(after, lv(8)) === null &&
      remainingWalkIns(after, lv(8)).length === 0,
    "L2: finishing the level drops the count and the walk-in: a finished level never offers one (no retroactive pay)",
  );
  assert(
    nextMenuGuest(saveAt(4), lv(4)) === null && walkInQueue(saveAt(4), lv(4)).length === 0,
    "L3: none at L4 (before the menu)",
  );
}

console.log("R. The reserve for the next level's own orders");
{
  // L8 → L9 (148-level campaign): the walk-in orders a Simple Garden Salad (tomato, …); L9's order,
  // Onion Rings, also uses tomato. Stock exactly L8's own order + its guest + one walk-in, nothing for L9.
  const base = saveAt(8);
  const own = servicePlanFor(base, lv(8))!.tickets;
  const guest = menuGuestQueue(base, lv(8));
  const walkIn = walkInQueue(base, lv(8));
  const next = reservedTicketsFor(base, lv(8));
  let s = stocked(base, [...own, ...guest, ...walkIn]);
  // The level's own order and its guest are served first (their stock taken, as in the game).
  for (const r of [...own, ...guest]) {
    const c = consumeCampaignOrderStock(s, 8, r, true);
    if (c.ok) s = c.save;
  }
  s = { ...s, levelProgress: { ...s.levelProgress, menuGuests: { "level-8": guest.length } } };
  const tight = nextMenuGuest(s, lv(8));
  const shared = next.flatMap((r) => orderRequirements(s, r).map((q) => q.ingredientId));
  assert(
    walkIn.length === 1 &&
      ids(walkIn) === "camp-simple-garden-salad" &&
      next.length > 0 &&
      shared.includes("tomato") &&
      tight?.kind === "walk-in" &&
      tight.inStock === false &&
      tight.short.some((x) => x.ingredientId === "tomato") &&
      tight.short.every((x) => x.ingredientId === "tomato"),
    "R1: with only the walk-in's own stock, it is refused — the tomato is kept for L9's order (nothing else is short)",
    { walkIn: ids(walkIn), next: ids(next), short: tight?.short },
  );
  const roomy = stocked(s, next);
  const ok = nextMenuGuest(roomy, lv(8));
  const served = consumeCampaignOrderStock(roomy, 8, walkIn[0]!, true);
  const left = served.ok ? serviceStockCheck(served.save, 9, next) : null;
  assert(
    ok?.inStock === true && served.ok && !!left && left.applies && left.ready,
    "R2: with L6's order stocked too, the walk-in is served — and L6's order is still fully in stock after it",
  );
  const last = saveAt(148);
  assert(
    reservedTicketsFor(last, lv(148)).length === 0 &&
      walkInStock(last, lv(148), walkIn[0]!).reservedFor === null,
    "R3: at L148 there is no next level to reserve for",
  );
}

console.log("I. Insufficient stock");
{
  const empty = { ...saveAt(5), levelProgress: progressAt(5, { "level-5": 1 }) };
  const w = nextMenuGuest(empty, lv(5));
  assert(
    w?.kind === "walk-in" &&
      w.inStock === false &&
      w.short
        .map((x) => x.ingredientId)
        .sort()
        .join() === "bread,garlic" &&
      w.short.every((x) => x.buyUnits > 0 && x.name.length > 0),
    "I1: an empty fridge: the walk-in is refused and says what to buy (bread, garlic), nothing is taken",
    w?.short,
  );
  // The Pre-Service Check lists the walk-in and its optional rows; buying them makes it servable.
  let s = saveAt(5);
  const plan = servicePlanFor(s, lv(5))!;
  // Market units are whole (1 lb of bread covers L5's order, its guest, the walk-in and L6's
  // reserve), so an empty fridge may need no extra row: I3 checks that buying is enough.
  assert(
    plan.guests.dishes.includes("🚶 Garlic Bread"),
    "I2: the check lists the walk-in (🚶 Garlic Bread) among the optional customers",
    plan.guests,
  );
  for (const r of [...(plan.check.applies ? plan.check.missingRows : []), ...plan.guests.rows]) {
    const b = purchaseIngredient(
      s,
      r.ingredientId,
      r.buyUnits,
      0,
      1,
      0,
      lbPerMarketUnit(r.ingredientId, "lb"),
      marketStep(r.ingredientId),
    );
    if (b.ok) s = b.save;
  }
  for (const r of [...plan.tickets, ...menuGuestQueue(s, lv(5))]) {
    const c = consumeCampaignOrderStock(s, 5, r, true);
    if (c.ok) s = c.save;
  }
  s = { ...s, levelProgress: { ...s.levelProgress, menuGuests: { "level-5": 1 } } };
  assert(
    nextMenuGuest(s, lv(5))?.inStock === true,
    "I3: after buying the check's rows (through the Market), the walk-in can be served, the reserve intact",
  );
  // Optional: the own orders' check (which decides START) never includes the walk-in.
  const bare = stocked(saveAt(5), servicePlanFor(saveAt(5), lv(5))!.tickets);
  const barePlan = servicePlanFor(bare, lv(5))!;
  assert(
    barePlan.check.applies &&
      barePlan.check.ready &&
      barePlan.guests.dishes.includes("🚶 Garlic Bread") &&
      barePlan.guests.rows.length > 0,
    "I4: with only the own order stocked the check is ready (START allowed); the walk-in's rows stay optional",
  );
}

console.log("P. Paid once");
{
  let s = stocked(
    saveAt(8),
    [
      ...customerQueue(saveAt(8), lv(8)).map((c) => c.recipe),
      ...reservedTicketsFor(saveAt(8), lv(8)),
    ],
    1,
  );
  s = { ...s, levelProgress: progressAt(8, { "level-8": 1 }) };
  const w = nextMenuGuest(s, lv(8))!;
  const before = s.economyLedger.length;
  // The serve's one save (as App.serveMenuGuestOrder): stock, the pay, the count, one entry.
  const c = consumeCampaignOrderStock(s, 8, w.recipe, true, "guest");
  const paid = c.ok
    ? appendLedgerEntry(
        {
          ...c.save,
          credits: c.save.credits + w.pays,
          levelProgress: withMenuGuestServed(c.save.levelProgress, "level-8"),
        },
        "business-revenue",
        w.pays,
        w.dish.id,
      )
    : s;
  await SaveManager.save(paid);
  const back = await SaveManager.load();
  assert(
    w.kind === "walk-in" &&
      paid.economyLedger.length === before + 1 &&
      paid.credits - s.credits === w.pays &&
      back.levelProgress.menuGuests?.["level-8"] === 2 &&
      nextMenuGuest(back, lv(8)) === null,
    "P1: serving the walk-in pays its price with ONE entry; the count (2) is saved with it, so after a reload nothing is offered again",
    {
      kind: w.kind,
      ledger: paid.economyLedger.length - before,
      count: back.levelProgress.menuGuests,
    },
  );
  const done = completeLevel("level-8", back.levelProgress);
  const again = completeLevel("level-8", done.progress);
  assert(
    done.isFirstCompletion && !again.isFirstCompletion && again.rewardCoins === 0,
    "P2: finishing pays the level once (the walk-in adds no completion reward)",
  );
}

console.log("O. Old saves and players past Level 5");
{
  // An old save at L40 that served its menu guests before walk-ins existed.
  const s = saveAt(40, { staff: { hiredRoles: ["prep-cook", "server"] as never } });
  const guests = menuGuestQueue(s, lv(40)).length;
  const old = { ...s, levelProgress: progressAt(40, { "level-40": guests }) };
  const next = nextMenuGuest(old, lv(40));
  assert(
    guests > 0 &&
      (walkInsFor(old, 40) === 0 ? next === null : next?.kind === "walk-in" && next.number === 1),
    "O1: an old save that served all its guests gets only the walk-in next (its guests are not offered again)",
    { guests, walkIns: walkInsFor(old, 40), next: next?.kind },
  );
  assert(
    [5, 6, 7].every((n) => nextMenuGuest({ ...saveAt(8) }, lv(n)) === null),
    "O2: levels already finished (L5–7 for a player at L8) get no walk-ins",
  );
}

console.log("D. Determinism, staff and the guests unchanged");
{
  const a = walkInQueue(saveAt(30), lv(30));
  const b = walkInQueue(saveAt(30), lv(30));
  assert(ids(a) === ids(b), "D1: the same level always brings the same walk-in");
  let staffMoved = 0;
  for (const n of [5, 16, 29, 41, 46, 61, 91, 121]) {
    const s = saveAt(n);
    const plan = servicePlanFor(s, lv(n));
    if (!plan) continue;
    // The service's shape (what staff rules read) counts the schedule's guests, never walk-ins.
    const shape = serviceShape(s, n, plan.tickets, plan.services);
    if (shape.orders !== plan.tickets.length + menuGuestsPerService(n)) staffMoved++;
  }
  assert(
    staffMoved === 0,
    "D2: walk-ins never add staff requirements (the service's shape counts the schedule's guests only)",
  );
  const src = fs.readFileSync(path.join(ROOT, "src/game/restaurant/menuGuests.ts"), "utf8");
  assert(
    /makeSeededRand\(n \* 104729 \+ 17\)/.test(src) &&
      /makeSeededRand\(n \* 7919 \+ 31\)/.test(src) &&
      !/Math\.random/.test(src),
    "D3: guests keep their own seed; walk-ins have their own; no Math.random",
  );
}

console.log("W. The App wiring");
{
  const app = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");
  assert(
    /menuGuest\.kind === "walk-in"\s*\?\s*`🚶 Walk-in \$\{menuGuest\.number\}\/\$\{menuGuest\.total\}/.test(
      app,
    ) &&
      /— short of \$\{menuGuest\.short/.test(app) &&
      // Phase 2 step 5: the guest serve also takes the reconciled session (a dish just cut is READY).
      /return serveMenuGuestOrder\(level, recipe, readySession\);/.test(app) &&
      /levelProgress: withMenuGuestServed\(withSupplies\.levelProgress, level\.id\)/.test(app) &&
      // The payment is left on the table in that same save and swept in as ONE business-revenue entry
      // (economy/pendingCash.ts, developer 2026-10-29).
      /withPendingCash\(paid, \{\s*amount: result\.coinsAwarded,\s*category: "business-revenue",\s*description: dish\.id,?\s*\}\)/.test(
        app,
      ),
    "W1: the walk-in offer and its short-of-stock message; served through serveMenuGuestOrder — the count and one business-revenue entry in one persist",
  );
}

console.log(failures === 0 ? "\nWALKIN QA: ALL PASS" : `\nWALKIN QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
