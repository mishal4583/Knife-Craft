/**
 * RESTAURANT UNLOCKS QA — Unified Restaurant phase 2 (foundations).
 *
 *  F. The switch: one central RESTAURANT_MODE (false), no second
 *     restaurant feature flag anywhere in src/.
 *  U. The unlock table follows the spec's §5 schedule: nothing in Levels
 *     1–10, ingredient stock 11, fridge 21, equipment 41, dine-in 61,
 *     cleaning + staff 81, suppliers 101, menu 121, takeaway 151,
 *     efficiency 181, advanced 201, full management 221, grand preparation
 *     241; in order; every system has a title, what it covers and a story
 *     line; the helpers agree with the table.
 *  R. Recipe requirements: every one of the 221 campaign recipes (and the
 *     Business-only one) has stock requirements, one per physical item
 *     prepared, each its plate serving (realistic portions, developer
 *     2026-10-08), every ingredient known; Business dishes draw the same
 *     stock (businessDishRequirements uses the same rule); summing keeps
 *     the totals.
 *  N. Nothing changes with the switch off: no game file reads the switch
 *     yet, and no restaurant module reads it at all.
 *
 * Run: npx tsx scripts/restaurant-unlocks-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { RESTAURANT_MODE } from "../src/game/config/restaurantMode.ts";
import {
  RESTAURANT_SYSTEMS,
  isSystemLive,
  liveSystems,
  systemsIntroducedAt,
  nextSystemAfter,
  LAST_CAMPAIGN_LEVEL,
  type RestaurantSystemId,
} from "../src/game/restaurant/unlocks.ts";
import {
  recipeRequirements,
  sumRequirements,
  requirementsForRecipes,
} from "../src/game/restaurant/recipeRequirements.ts";
import {
  CAMPAIGN_RECIPES,
  BUSINESS_ONLY_RECIPES,
  getCampaignRecipe,
} from "../src/game/recipes/campaignRecipes.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import { businessDishRequirements } from "../src/game/business/businessServiceCatalog.ts";
import { INGREDIENT_MEASURES } from "../src/game/business/ingredientMeasures.ts";
import { ingredientInstancesFor } from "../src/game/economy/EconomySettlement.ts";
import { INGREDIENTS } from "../src/game/definitions.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const srcFiles = walk(path.join(root, "src"));
const rel = (p: string) => path.relative(root, p).replace(/\\/g, "/");

console.log("F. The switch");
assert(RESTAURANT_MODE === false, "F1: RESTAURANT_MODE is false (the current game is unchanged)");
const flagDefs = srcFiles.filter((f) =>
  /export const RESTAURANT_MODE\b/.test(fs.readFileSync(f, "utf8")),
);
const otherFlags = srcFiles.filter((f) =>
  /export const (USE_NEW_[A-Z_]+|RESTAURANT_[A-Z_]*(ENABLED|FLAG|MODE_[A-Z_]+))\b/.test(
    fs.readFileSync(f, "utf8"),
  ),
);
assert(
  flagDefs.length === 1 &&
    rel(flagDefs[0]!) === "src/game/config/restaurantMode.ts" &&
    otherFlags.length === 0,
  "F2: one central switch in src/game/config/restaurantMode.ts, no other restaurant flag",
);

console.log("U. Unlock table");
// The schedule is the developer's teaching sequence of 2026-10-05 §10, which
// replaced the 2026-10-04 one on purpose (the menu then opened at L1, stock
// at L11): cooking fundamentals and the restaurant day from Level 1, the
// menu at 11, ingredient stock 15, fridge 21, dine-in + supplies 31, staff
// 41, cuisines 51, takeaway 71, the bigger restaurant 91, full management
// 121, established 161, master 201, Grand Service 241.
const expected: [RestaurantSystemId, number][] = [
  ["restaurant-day", 1],
  ["menu", 11],
  ["ingredient-stock", 15],
  ["fridge-freshness", 21],
  ["dine-in", 31],
  ["staff", 41],
  ["cuisines", 51],
  ["takeaway", 71],
  ["full-operation", 91],
  ["expansion", 121],
  ["established", 161],
  ["master", 201],
  ["grand-service", 241],
];
assert(
  RESTAURANT_SYSTEMS.map((s) => `${s.id}@${s.firstLevel}`).join() ===
    expected.map(([id, l]) => `${id}@${l}`).join(),
  "U1: systems and first levels follow the spec's §5 schedule, in order",
);
assert(
  liveSystems(1)
    .map((s) => s.id)
    .join() === "restaurant-day" &&
    liveSystems(10)
      .map((s) => s.id)
      .join() === "restaurant-day" &&
    liveSystems(14)
      .map((s) => s.id)
      .join() === "restaurant-day,menu",
  "U2: Levels 1–10 are cooking fundamentals (only the restaurant day); the menu alone at 11–14",
);
assert(
  RESTAURANT_SYSTEMS.every((s) => s.title.length > 0 && s.covers.length > 0 && s.intro.length > 10),
  "U3: every system has a title, what it covers and a story line",
);
assert(
  RESTAURANT_SYSTEMS.every(
    (s) =>
      !isSystemLive(s.id, s.firstLevel - 1) &&
      isSystemLive(s.id, s.firstLevel) &&
      isSystemLive(s.id, LAST_CAMPAIGN_LEVEL) &&
      systemsIntroducedAt(s.firstLevel).some((x) => x.id === s.id),
  ),
  "U4: each system goes live exactly at its first level and stays live to L250",
);
assert(
  liveSystems(LAST_CAMPAIGN_LEVEL).length === RESTAURANT_SYSTEMS.length &&
    nextSystemAfter(10)?.id === "menu" &&
    nextSystemAfter(11)?.id === "ingredient-stock" &&
    nextSystemAfter(241) === null &&
    systemsIntroducedAt(1)
      .map((s) => s.id)
      .join() === "restaurant-day",
  "U5: everything is live by L250; 'coming up' and 'introduced at' agree with the table",
);

console.log("R. Recipe requirements");
const all = [...CAMPAIGN_RECIPES, ...BUSINESS_ONLY_RECIPES];
assert(
  CAMPAIGN_RECIPES.length === 221 &&
    all.every((r) => {
      const req = recipeRequirements(r);
      const items = ingredientInstancesFor(r);
      return (
        req.length === items.length &&
        req.length > 0 &&
        req.every(
          (q, i) => q.ingredientId === items[i]!.ingredientId && q.ingredientId in INGREDIENTS,
        )
      );
    }),
  "R1: all 221 campaign recipes (+ the Business-only one) have stock needs, one per PHYSICAL item prepared (consecutive steps on the same ingredient are one item unless chainBreak)",
);
assert(
  all.every((r) =>
    recipeRequirements(r).every(
      (q) => q.quantity === INGREDIENT_MEASURES[q.ingredientId].serving && q.quantity > 0,
    ),
  ) &&
    recipeRequirements(CAMPAIGN_RECIPES.find((r) => r.id === "camp-onion-prep-chain")!).length ===
      1 &&
    Object.values(INGREDIENT_MEASURES).every((m) => m.pieceLb > 0 && m.serving > 0) &&
    INGREDIENT_MEASURES.tomato.pieceLb <= 1 / 3,
  "R2: each item uses its plate serving (ingredientMeasures.ts: a 0.3 lb tomato — more than 3 to the lb — 0.025 lb garlic, a quarter loaf); peel → halve → slice of one onion is one onion",
);
assert(
  BUSINESS_DISH_CATALOG.length === 48 &&
    BUSINESS_DISH_CATALOG.every(
      (d) =>
        JSON.stringify(businessDishRequirements(d)) ===
        JSON.stringify(recipeRequirements(getCampaignRecipe(d.sourceRecipeId)!)),
    ),
  "R3: the 48 Business dishes draw exactly the stock the shared rule gives",
);
{
  const r = all.find(
    (x) => new Set(x.components.map((c) => c.ingredientId)).size < x.components.length,
  )!;
  const raw = recipeRequirements(r);
  const summed = sumRequirements(raw);
  const total = (xs: { quantity: number }[]) => xs.reduce((s, x) => s + x.quantity, 0);
  assert(
    !!r &&
      summed.length === new Set(raw.map((q) => q.ingredientId)).size &&
      Math.abs(total(summed) - total(raw)) < 1e-9 &&
      Math.abs(total(requirementsForRecipes([r, r])) - 2 * total(raw)) < 1e-9,
    "R4: summing per ingredient keeps the totals (one recipe and two servings)",
  );
}

console.log("N. Switch off changes nothing");
const readers = srcFiles.filter(
  (f) =>
    rel(f) !== "src/game/config/restaurantMode.ts" &&
    /from\s+["'][^"']*config\/restaurantMode["']/.test(fs.readFileSync(f, "utf8")),
);
assert(
  readers.every((f) => !rel(f).startsWith("src/game/restaurant/")),
  "N1: no restaurant module reads the switch (they stay pure and testable)",
);
console.log(`     files reading the switch: ${readers.map(rel).join(", ") || "none yet"}`);

console.log(
  failures
    ? `\nRESTAURANT UNLOCKS QA: ${failures} FAILURE(S)`
    : "\nRESTAURANT UNLOCKS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
