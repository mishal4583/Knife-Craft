/**
 * RESTAURANT MENU QA — Unified Restaurant progression phases A–C (developer
 * spec "Unified Restaurant Progression & Early Menu", 2026-10-04).
 *
 *  M. The menu schedule (restaurant/restaurantProgression.ts MENU_UNLOCKS),
 *     the developer's curve of 2026-10-05: no menu in the L1–10
 *     fundamentals, 4 dishes at L11 … 48 at L161; at every curve point the
 *     size is min(target, what the rules allow) and never ahead of it; the
 *     only misses are where the catalog runs out (no dish is invented).
 *  T. Tied to cuisines: each specialist cuisine opens with its campaign
 *     chapter and its first dishes arrive as soon as they legally can; the
 *     news explains the menu chain and announces cuisines 5 levels ahead.
 *  R. Its rules: a dish never before its knife techniques are taught (the
 *     L1–5 tutorial counts for the starter dishes), never before its
 *     cuisine opens, chicken/steak from L101, salmon from L109, the ribeye
 *     from the Butcher Block at L106.
 *  C. Cuisines: house cuisines without a specialist; every later cuisine
 *     with one; every catalog cuisine covered; announced 5 levels ahead.
 *  A. Active menu: before MENU_CHOICE_LEVEL every unlocked dish is on
 *     (saved switches ignored); from it the player's switches apply; never
 *     empty; a locked dish is never orderable, whatever the save says.
 *  D. Data untouched: 250 levels, 221 campaign recipes, 48 dishes.
 *  W. Wiring: the Menu screen gets the restaurant view only under
 *     RESTAURANT_MODE.
 *
 * Run: npx tsx scripts/restaurant-menu-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  MENU_UNLOCKS,
  MENU_CURVE,
  menuTargetAt,
  MENU_CHOICE_LEVEL,
  CUISINES,
  CUISINE_NOTICE_LEVELS,
  cuisineFor,
  cuisineComingUp,
  dishUnlockLevel,
  menuDishIdsAt,
  dishesUnlockedAt,
} from "../src/game/restaurant/restaurantProgression.ts";
import {
  activeMenuDishes,
  activeMenuRecipes,
  canOrderDish,
  lockedMenuDishes,
  unlockedMenuDishes,
  restaurantLevelOf,
} from "../src/game/restaurant/restaurantMenu.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import { CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { techniqueFirstLevel, TEACH_ALL_THROUGH_LEVEL } from "../src/game/coaching.ts";
import { mustPeelBefore } from "../src/game/prepStepGuards.ts";
import { restaurantNewsAt } from "../src/game/restaurant/restaurantNews.ts";

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
const dishIds = BUSINESS_DISH_CATALOG.map((d) => d.id);

/** The earliest level a dish may join under the three rules (R below checks the schedule keeps them). */
function earliestLegal(dish: (typeof BUSINESS_DISH_CATALOG)[number]): number {
  const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
  let at = 1;
  for (const c of recipe.components)
    for (const t of [
      c.technique,
      ...(mustPeelBefore(c.ingredientId, c.technique) ? ["peel"] : []),
    ]) {
      const taught =
        techniqueFirstLevel(t as Parameters<typeof techniqueFirstLevel>[0]) ?? Infinity;
      if (taught > TEACH_ALL_THROUGH_LEVEL) at = Math.max(at, taught);
    }
  at = Math.max(at, cuisineFor(dish.cuisineId).firstLevel);
  const ing = new Set(recipe.components.map((c) => c.ingredientId));
  if (ing.has("chicken") || ing.has("steak")) at = Math.max(at, 101);
  if (ing.has("salmon")) at = Math.max(at, 109);
  if (dish.id === "biz-ribeye-herb-butter") at = Math.max(at, 106);
  return at;
}
const legalBy = (lv: number) => BUSINESS_DISH_CATALOG.filter((d) => earliestLegal(d) <= lv).length;

console.log("M. Schedule (developer curve 2026-10-05)");
assert(
  menuDishIdsAt(10).length === 0 &&
    menuDishIdsAt(11).join() ===
      "biz-caprese-salad,biz-mushroom-bruschetta,biz-garden-salad,biz-garlic-bread" &&
    menuTargetAt(10) === 0 &&
    menuTargetAt(11) === 4,
  "M1: no menu in the L1–10 fundamentals; it opens at L11 with 4 dishes the player can already cut",
);
const curveMisses: string[] = [];
for (const p of MENU_CURVE) {
  const want = Math.min(p.dishes, legalBy(p.level));
  const n = menuDishIdsAt(p.level).length;
  if (n !== want) curveMisses.push(`L${p.level}: ${n} (want ${want} of ${p.dishes})`);
}
assert(
  curveMisses.length === 0 &&
    MENU_CURVE.map((p) => `${p.level}:${p.dishes}`).join() ===
      "11:4,15:6,20:8,25:10,31:12,41:15,51:18,61:21,71:25,81:29,91:33,101:36,111:39,121:42,141:45,161:48",
  `M2: at every point of the developer's curve the menu has min(target, dishes the rules allow) ${curveMisses.join("; ")}`,
);
const over: string[] = [];
for (let lv = 1; lv <= 250; lv++)
  if (menuDishIdsAt(lv).length > menuTargetAt(lv))
    over.push(`L${lv}: ${menuDishIdsAt(lv).length} > ${menuTargetAt(lv)}`);
assert(
  over.length === 0,
  `M2b: the menu never runs ahead of the curve ${over.slice(0, 3).join("; ")}`,
);
const shortfalls = MENU_CURVE.filter((p) => legalBy(p.level) < p.dishes).map((p) => p.level);
assert(
  shortfalls.join() === "20,25,31,91,101,111",
  `M2c: the only points the catalog can't reach are L20/25/31 (techniques) and L91/101/111 (meat and fish) — ${shortfalls.join()}`,
);
const scheduled = MENU_UNLOCKS.flatMap((u) => [...u.dishIds]);
assert(
  scheduled.length === 48 &&
    new Set(scheduled).size === 48 &&
    scheduled.every((id) => dishIds.includes(id)) &&
    menuDishIdsAt(161).length === 48 &&
    menuDishIdsAt(160).length === 45,
  "M3: all 48 catalog dishes are scheduled once, the full menu at L161",
);
assert(
  MENU_UNLOCKS.every((u, i) => i === 0 || u.level > MENU_UNLOCKS[i - 1]!.level) &&
    MENU_UNLOCKS.every((u) => u.why.length > 10),
  "M4: unlock levels strictly increase; every unlock says why its dishes were added",
);

console.log("T. Tied to cuisine progression");
{
  const firstDish = (cuisineGroup: string) =>
    Math.min(
      ...BUSINESS_DISH_CATALOG.filter((d) => cuisineFor(d.cuisineId).id === cuisineGroup).map((d) =>
        dishUnlockLevel(d.id)!,
      ),
    );
  const firstLegal = (cuisineGroup: string) =>
    Math.min(
      ...BUSINESS_DISH_CATALOG.filter((d) => cuisineFor(d.cuisineId).id === cuisineGroup).map(
        earliestLegal,
      ),
    );
  const misses = CUISINES.filter((c) => c.firstLevel > 1)
    .filter((c) => firstDish(c.id) !== firstLegal(c.id))
    .map((c) => `${c.id}: ${firstDish(c.id)} vs ${firstLegal(c.id)}`);
  assert(
    misses.length === 0,
    `T1: each cuisine's first dishes join the menu the first level they legally can (its chapter, or fish/meat) ${misses.join("; ")}`,
  );
  const campaignFirst = new Map<string, number>();
  for (const l of LEVELS)
    for (const id of [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])]) {
      const k = getCampaignRecipe(id)?.cuisineId ?? "home";
      const n = Number(l.id.split("-")[1]);
      if (!campaignFirst.has(k) || campaignFirst.get(k)! > n) campaignFirst.set(k, n);
    }
  const chapterMisses = CUISINES.filter((c) => c.specialist)
    .flatMap((c) => c.cuisineIds.map((k) => [c, k] as const))
    .filter(([c, k]) => campaignFirst.get(k) !== c.firstLevel)
    .map(([c, k]) => `${k}: opens L${c.firstLevel}, chapter L${campaignFirst.get(k)}`);
  assert(
    chapterMisses.length === 0,
    `T2: every specialist cuisine opens with its campaign chapter ${chapterMisses.join("; ")}`,
  );
  const news11 = restaurantNewsAt(11);
  const news51 = restaurantNewsAt(51);
  assert(
    news11.chain?.join(" → ") ===
      "Menu → Customer Order → Inventory → Preparation → Service → Revenue" &&
      news11.dishes.length === 4 &&
      !!news11.dishWhy &&
      news51.cuisines.some((c) => c.name === "Indian" && c.specialist === "Indian Chef") &&
      restaurantNewsAt(46).comingUp.some((c) => c.level === 51 && /Indian/.test(c.text)) &&
      restaurantNewsAt(12).chain === null,
    "T3: the news explains the menu chain at L11, new dishes with their reason, and a cuisine (with its chef) 5 levels ahead",
  );
}

console.log("R. Rules");
const ruleBreaks: string[] = [];
for (const dish of BUSINESS_DISH_CATALOG) {
  const at = dishUnlockLevel(dish.id)!;
  const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
  const techniques = new Set<string>();
  for (const c of recipe.components) {
    techniques.add(c.technique);
    if (mustPeelBefore(c.ingredientId, c.technique)) techniques.add("peel");
  }
  for (const t of techniques) {
    const taught = techniqueFirstLevel(t as Parameters<typeof techniqueFirstLevel>[0]) ?? Infinity;
    const tutorial = taught <= TEACH_ALL_THROUGH_LEVEL;
    if (!(taught <= at || tutorial)) ruleBreaks.push(`${dish.id}: ${t} taught L${taught} > L${at}`);
  }
  if (at < cuisineFor(dish.cuisineId).firstLevel) ruleBreaks.push(`${dish.id}: cuisine`);
  const ing = new Set(recipe.components.map((c) => c.ingredientId));
  if ((ing.has("chicken") || ing.has("steak")) && at < 101) ruleBreaks.push(`${dish.id}: meat`);
  if (ing.has("salmon") && at < 109) ruleBreaks.push(`${dish.id}: fish`);
  if (dish.id === "biz-ribeye-herb-butter" && at < 106)
    ruleBreaks.push(`${dish.id}: butcher block`);
}
assert(
  ruleBreaks.length === 0,
  `R1: every dish respects techniques, cuisine, meat L101, fish L109, ribeye L106 ${ruleBreaks.join("; ")}`,
);

console.log("C. Cuisines");
const catalogCuisines = new Set(BUSINESS_DISH_CATALOG.map((d) => d.cuisineId ?? "home"));
assert(
  [...catalogCuisines].every((c) => CUISINES.some((g) => g.cuisineIds.includes(c))),
  "C1: every catalog cuisine belongs to a cuisine group",
);
assert(
  CUISINES.filter((c) => c.firstLevel < 51).every((c) => c.specialist === null) &&
    CUISINES.filter((c) => c.firstLevel >= 51).every((c) => c.specialist !== null),
  "C2: house cuisines need no specialist; every cuisine from L51 has its specialist chef",
);
assert(
  cuisineComingUp(46)?.id === "indian" &&
    cuisineComingUp(45) === null &&
    CUISINE_NOTICE_LEVELS === 5 &&
    cuisineComingUp(116)?.specialist?.title === "Asian Chef",
  "C3: a cuisine and its specialist are announced 5 levels ahead",
);

console.log("A. Active menu");
{
  const none = { inactiveDishIds: [] as string[] };
  const offEarly = { inactiveDishIds: ["biz-caprese-salad"] };
  assert(
    activeMenuDishes(offEarly, 12).length === 4 && activeMenuDishes(none, 12).length === 4,
    "A1: before the menu choice level every unlocked dish is on (saved switches ignored)",
  );
  const lv = MENU_CHOICE_LEVEL;
  const unlocked = unlockedMenuDishes(lv);
  const someOff = { inactiveDishIds: [unlocked[0]!.id, unlocked[1]!.id] };
  assert(
    activeMenuDishes(someOff, lv).length === unlocked.length - 2 &&
      !canOrderDish(someOff, lv, unlocked[0]!.id) &&
      canOrderDish(someOff, lv, unlocked[2]!.id),
    "A2: from the choice level the player's switches decide what customers can order",
  );
  const allOff = { inactiveDishIds: unlocked.map((d) => d.id) };
  assert(
    activeMenuDishes(allOff, lv).length === unlocked.length,
    "A3: never empty: all off counts as all on",
  );
  const lockedId = lockedMenuDishes(12)[0]!.dish.id;
  assert(
    !canOrderDish(none, 12, lockedId) &&
      !canOrderDish(none, 10, "biz-caprese-salad") &&
      !canOrderDish(none, 160, "biz-thai-basil-salmon") &&
      canOrderDish(none, 161, "biz-thai-basil-salmon"),
    "A4: a locked dish is never orderable, whatever the saved switches say",
  );
  assert(
    activeMenuRecipes(none, 30).length === menuDishIdsAt(30).length &&
      lockedMenuDishes(30).length === 48 - menuDishIdsAt(30).length &&
      lockedMenuDishes(30)[0]!.unlockLevel >= 31,
    "A5: the order pool is the active dishes' recipes; locked dishes come soonest first",
  );
  assert(
    restaurantLevelOf({
      currentLevelId: "level-3",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: [],
    }) === 12 && dishesUnlockedAt(51).length === 3,
    "A6: the restaurant's level is the furthest level reached",
  );
}

console.log("D. Data untouched");
assert(
  LEVELS.length === 250 && CAMPAIGN_RECIPES.length === 221 && BUSINESS_DISH_CATALOG.length === 48,
  "D1: 250 levels, 221 campaign recipes, 48 menu dishes (a schedule over existing data)",
);

console.log("W. Wiring");
{
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  const menu = read("src/components/kc/business/BusinessMenu.tsx");
  assert(
    /\.\.\.\(RESTAURANT_MODE\s*\?\s*\{ restaurantLevel: restaurantLevelOf\(save\.levelProgress\) \}\s*:\s*\{\}\)/.test(
      dash,
    ) &&
      /data-testid="menu-locked"/.test(menu) &&
      /const restaurant = restaurantLevel !== undefined;/.test(menu),
    "W1: the Menu screen's restaurant view (active / unlocked / locked) only under RESTAURANT_MODE",
  );
}

console.log(
  failures ? `\nRESTAURANT MENU QA: ${failures} FAILURE(S)` : "\nRESTAURANT MENU QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
