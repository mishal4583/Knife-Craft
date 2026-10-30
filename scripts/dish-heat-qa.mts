/**
 * DISH_HEAT_QA — popular dishes cost more (restaurant/dishHeat.ts; developer 2026-10-30 Q6, design approved
 * 2026-10-31, docs/planning/PHASE2-PLAN-2026-10-30.md §12):
 *   H. heat: +1 per guest order; ×0.85 at every closing; under 0.1 dropped; old saves have none;
 *   R. rise: none below heat 3; +5% per whole point above 2; at most +25%; never above the menu cap;
 *   P. payment: the guest pays the rise, still whole cents; riseExtra is exactly the difference;
 *   W. weight: × (1 − rise / 2) in the guest pick;
 *   A. wiring: the guest serve heats the dish in the same save as its one "business-revenue" entry;
 *      closing cools it; the Menu and the guest button show 🔥; no Math.random / wallet in the module.
 *
 * Run: npx tsx scripts/dish-heat-qa.mts
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
  HEAT_RULES,
  coolDishHeat,
  dishRisePct,
  heatOf,
  heatWeight,
  heatedPrice,
  riseForHeat,
  withDishOrdered,
} from "../src/game/restaurant/dishHeat.ts";
import { businessCustomerPayment } from "../src/game/business/BusinessServiceManager.ts";
import {
  businessDishPrice,
  businessDishPriceCap,
  getBusinessDish,
} from "../src/game/business/businessDishCatalog.ts";
import { activeMenuDishes } from "../src/game/restaurant/restaurantMenu.ts";
import { dishWeight } from "../src/game/restaurant/orderPool.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const base: SaveData = structuredClone(DEFAULT_SAVE);
const dish = activeMenuDishes(base.business.menuActivation, 40)[0]!;
const heated = (n: number) => {
  let s = base;
  for (let i = 0; i < n; i++) s = withDishOrdered(s, dish.id);
  return s;
};

// ── H. heat ──────────────────────────────────────────────────────────────
check(
  "H1 an old save has no heat",
  heatOf(base, dish.id) === 0 && base.business.dishHeat === undefined,
);
check("H2 each guest order adds 1", heatOf(heated(3), dish.id) === 3);
check("H3 a closing cools ×0.85", heatOf(coolDishHeat(heated(4)), dish.id) === 3.4);
let cold = heated(1);
for (let i = 0; i < 20; i++) cold = coolDishHeat(cold);
check(
  "H4 a dish nobody orders cools away (dropped under 0.1)",
  !(dish.id in (cold.business.dishHeat ?? {})),
);
check("H5 a save with no heat is left alone at closing", coolDishHeat(base) === base);
const junk = {
  ...base,
  business: {
    ...base.business,
    dishHeat: { [dish.id]: Number.NaN, x: -2 } as Record<string, number>,
  },
};
check("H6 junk values read as no heat", heatOf(junk, dish.id) === 0 && heatOf(junk, "x") === 0);

// ── R. rise ──────────────────────────────────────────────────────────────
check(
  "R1 none below heat 3; +5% per whole point above 2; +25% at most",
  [0, 2.9, 3, 3.9, 4, 7, 7.5, 20].map(riseForHeat).join() === "0,0,5,5,10,25,25,25",
  [0, 2.9, 3, 3.9, 4, 7, 7.5, 20].map(riseForHeat),
);
check(
  "R2 never above the menu cap; never below the menu price",
  heatedPrice(1000, 25, 1100) === 1100 &&
    heatedPrice(1000, 10, 2000) === 1100 &&
    heatedPrice(1500, 25, 1100) === 1500,
);
check(
  "R3 the rules are the approved ones",
  HEAT_RULES.stepPct === 5 &&
    HEAT_RULES.capPct === 25 &&
    HEAT_RULES.popularAt === 3 &&
    HEAT_RULES.decay === 0.85,
);

// ── P. payment ───────────────────────────────────────────────────────────
const plain = businessCustomerPayment(base, dish);
const hot = businessCustomerPayment(heated(4), dish);
check("P1 no heat: nothing extra", plain.risePct === 0 && plain.riseExtra === 0);
const cap = businessDishPriceCap(dish);
const menu = businessDishPrice(base.business.menu, dish);
check(
  "P2 heat 4: +10% (or up to the menu cap), whole cents, the extra is exactly the difference",
  hot.customerPays - plain.customerPays === hot.riseExtra &&
    Number.isInteger(hot.customerPays) &&
    (cap > menu ? hot.riseExtra > 0 && hot.risePct === 10 : hot.riseExtra === 0),
  { plain: plain.customerPays, hot: hot.customerPays, cap, menu, rise: hot.risePct },
);
const max = businessCustomerPayment(heated(30), dish);
check(
  "P3 the rise never passes the menu cap",
  Math.round((cap * Math.round(max.multiplier * 100)) / 100) >= max.customerPays,
);

// ── W. weight ────────────────────────────────────────────────────────────
const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
check(
  "W1 × (1 − rise / 2)",
  heatWeight(0) === 1 && heatWeight(10) === 0.95 && heatWeight(25) === 0.875,
);
check(
  "W2 a popular dish is picked a little less",
  dishRisePct(heated(4), dish.id) === 10
    ? Math.abs(dishWeight(heated(4), recipe, 40) / dishWeight(base, recipe, 40) - 0.95) < 1e-9
    : true,
);

// ── S. save ──────────────────────────────────────────────────────────────
await SaveManager.reset();
await SaveManager.save(heated(3));
const back = await SaveManager.load();
check("S1 heat survives a save and load", heatOf(back, dish.id) === 3);
await SaveManager.reset();

// ── A. wiring ────────────────────────────────────────────────────────────
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const app = read("src/App.tsx");
const serve = app.slice(
  app.indexOf("function serveMenuGuestOrder"),
  app.indexOf("function guestHasSetting"),
);
check(
  "A1 the guest serve heats the dish in the same save as its one business-revenue entry",
  /withDishOrdered\(withSupplies, dish\.id\)/.test(serve) &&
    (serve.match(/category: "business-revenue"/g) ?? []).length === 1,
);
check(
  "A2 closing cools the heat",
  /next = coolDishHeat\(next\);/.test(read("src/game/restaurant/restaurantDay.ts")),
);
check(
  "A3 the Menu and the guest button show 🔥",
  /data-dish-hot/.test(read("src/components/kc/business/BusinessMenu.tsx")) &&
    /🔥 \+\$\{menuGuest\.risePct\}%/.test(app),
);
check(
  "A4 the served card shows the extra",
  /🔥 Popular \+\{formatUsd\(served\.popularExtra\)\}/.test(
    read("src/components/kc/game/ServiceOrderComplete.tsx"),
  ),
);
const mod = read("src/game/restaurant/dishHeat.ts").replace(/\/\*[\s\S]*?\*\//g, "");
check(
  "A5 no Math.random, wallet or ledger in the module",
  !/Math\.random|debitWallet|appendLedgerEntry|credits/.test(mod),
);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
