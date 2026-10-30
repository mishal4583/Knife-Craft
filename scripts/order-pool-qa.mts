/**
 * ORDER_POOL_QA — Phase 2, guests order what is unlocked AND in stock (restaurant/orderPool.ts,
 * docs/planning/PHASE2-PLAN-2026-10-30.md §4, decision Q6):
 *   W. weights: a dish new on the menu in the last 5 services ×1.5; more stock weighs more; the price never weighs;
 *   P. the pool: only active menu dishes that can be made beside the reserve; before stock is used, all of them;
 *   G. a guest: the forecast dish when it can be made, else a stocked one, else none; deterministic;
 *      the reserve (the next level's own orders) is never eaten;
 *   F. the forecast list (what the Pre-Service Check plans for) keeps its counts;
 *   M. no wallet, ledger or Math.random.
 *
 * Run: npx tsx scripts/order-pool-qa.mts
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
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { orderRequirements, serviceUsesStock } from "../src/game/restaurant/campaignStock.ts";
import { activeMenuRecipes } from "../src/game/restaurant/restaurantMenu.ts";
import { dishesUnlockedAt } from "../src/game/restaurant/restaurantProgression.ts";
import { menuGuestQueue, menuGuestsFor, nextMenuGuest } from "../src/game/restaurant/menuGuests.ts";
import {
  NEW_DISH_WEIGHT,
  newDishIds,
  newDishWeight,
  orderPool,
  pickGuestDish,
  portionsInStock,
} from "../src/game/restaurant/orderPool.ts";
import { businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import type { RecipeDefinition } from "../src/game/recipes/recipeTypes.ts";

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const progressAt = (n: number): LevelProgress => ({
  ...DEFAULT_SAVE.levelProgress,
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 100_000,
  levelProgress: progressAt(n),
  business: { ...DEFAULT_SAVE.business, inventory: {}, menuActivation: { inactiveDishIds: [] } },
});
/** `portions` portions of each recipe's ingredients in the fridge (fresh). */
const stocked = (s: SaveData, recipes: readonly RecipeDefinition[], portions: number): SaveData => {
  let inventory = s.business.inventory;
  for (const r of recipes)
    for (const need of orderRequirements(s, r))
      inventory = addStock(
        inventory,
        need.ingredientId,
        need.quantity * portions,
        10,
        s.business.calendar.businessDay,
      );
  return { ...s, business: { ...s.business, inventory } };
};
const lv = (n: number) => getLevel(`level-${n}`)!;

// ── W. weights ───────────────────────────────────────────────────────────
const N = 40;
const menu = activeMenuRecipes(DEFAULT_SAVE.business.menuActivation, N);
const fresh = newDishIds(N);
const newOne = menu.find((r) => fresh.has(businessDishForRecipeId(r.id)?.id ?? ""));
const oldOne = menu.find((r) => !fresh.has(businessDishForRecipeId(r.id)?.id ?? ""));
check(
  "W1 a dish new in the last 5 services weighs ×1.5, an older one ×1",
  (!newOne || newDishWeight(newOne, N) === NEW_DISH_WEIGHT) &&
    !!oldOne &&
    newDishWeight(oldOne, N) === 1,
  { newOne: newOne?.id, oldOne: oldOne?.id },
);
check(
  "W2 'new' covers exactly the last 5 services' unlocks",
  [...newDishIds(N)].sort().join() ===
    [N - 4, N - 3, N - 2, N - 1, N]
      .flatMap((l) => dishesUnlockedAt(l))
      .sort()
      .join(),
);
const a = menu[0]!;
const b = menu.find(
  (r) =>
    r.id !== a.id && businessDishForRecipeId(r.id) && newDishWeight(r, N) === newDishWeight(a, N),
)!;
const s3 = stocked(stocked(saveAt(N), [a], 3), [b], 1);
const pool3 = orderPool(s3, lv(N), []);
const wa = pool3.find((e) => e.recipe.id === a.id)?.weight ?? 0;
const wb = pool3.find((e) => e.recipe.id === b.id)?.weight ?? 0;
check(
  "W3 more stock weighs more (3 portions vs the last one: ×3)",
  wa > 0 && wb > 0 && Math.abs(wa / wb - 3) < 1e-9,
  { wa, wb },
);
const src = fs.readFileSync(path.join(process.cwd(), "src/game/restaurant/orderPool.ts"), "utf8");
check("W4 the price never weighs", !/menuPrice|customerPays|businessCustomerPayment/.test(src));

// ── P. pool ──────────────────────────────────────────────────────────────
check("P1 stock is used at Level 40", serviceUsesStock(N));
check("P2 an empty fridge: nothing can be made", orderPool(saveAt(N), lv(N), []).length === 0);
check(
  "P3 only the stocked dishes are in the pool",
  pool3
    .map((e) => e.recipe.id)
    .sort()
    .join() === [a.id, b.id].sort().join() ||
    pool3.every((e) => portionsInStock(s3, N, e.recipe, []) > 0),
  pool3.map((e) => e.recipe.id),
);
// Stock is used from Level 1 since the own-money start (developer 2026-10-30), so an early service
// with an empty fridge has nothing to make either.
check(
  "P4 stock counts from Level 1: an early empty fridge has nothing to make",
  serviceUsesStock(1) && orderPool(saveAt(8), lv(8), []).length === 0,
);
const off = saveAt(N);
const offId = businessDishForRecipeId(a.id)!.id;
const offSave = stocked(
  { ...off, business: { ...off.business, menuActivation: { inactiveDishIds: [offId] } } },
  [a],
  3,
);
check(
  "P5 a switched-off dish is never in the pool, even in stock",
  !orderPool(offSave, lv(N), []).some((e) => e.recipe.id === a.id),
);

// ── G. guest ─────────────────────────────────────────────────────────────
check(
  "G1 the forecast dish when it can be made",
  pickGuestDish(stocked(saveAt(N), [a], 1), lv(N), a, [], 0)?.id === a.id,
);
const sub = pickGuestDish(stocked(saveAt(N), [b], 2), lv(N), a, [], 0);
// Dishes share ingredients, so stocking b may make others possible too: any dish that fits will do.
check(
  "G2 else a dish that is in stock",
  !!sub && sub.id !== a.id && portionsInStock(stocked(saveAt(N), [b], 2), N, sub, []) > 0,
  sub?.id,
);
check("G3 else none", pickGuestDish(saveAt(N), lv(N), a, [], 0) === null);
check(
  "G4 deterministic",
  pickGuestDish(s3, lv(N), menu.at(-1)!, [], 2)?.id ===
    pickGuestDish(s3, lv(N), menu.at(-1)!, [], 2)?.id,
);
const reserveOnly = stocked(saveAt(N), [a], 1);
check(
  "G5 the reserve is kept: a portion set aside for the next level's order is never ordered",
  pickGuestDish(reserveOnly, lv(N), a, [a], 0) === null,
);
const g = nextMenuGuest(stocked(saveAt(N), [b], 2), lv(N));
check(
  "G6 nextMenuGuest orders a stocked dish (or the forecast, out of stock, when nothing fits)",
  !!g && (g.inStock ? portionsInStock(stocked(saveAt(N), [b], 2), N, g.recipe, []) > 0 : true),
  g && { recipe: g.recipe.id, inStock: g.inStock },
);

// ── F. forecast ──────────────────────────────────────────────────────────
check(
  "F1 the forecast keeps the service's guest count",
  [12, 40, 80].every(
    (n) => menuGuestQueue(saveAt(n), lv(n)).length === menuGuestsFor(saveAt(n), n),
  ),
);

// ── M. module ────────────────────────────────────────────────────────────
const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
check(
  "M1 no wallet, ledger or Math.random",
  !/Math\.random|debitWallet|appendLedgerEntry|credits/.test(code),
);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
