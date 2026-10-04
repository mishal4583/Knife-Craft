/**
 * RESTAURANT MENU QA — Unified Restaurant progression phases A–C (developer
 * spec "Unified Restaurant Progression & Early Menu", 2026-10-04).
 *
 *  M. The menu schedule (restaurant/restaurantProgression.ts MENU_UNLOCKS):
 *     Level 1 already has a real menu (2 dishes); the size stays inside the
 *     developer's target band at EVERY level 1–250; all 48 dishes by L241,
 *     each once; never all at once.
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
  MENU_TARGETS,
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

console.log("M. Schedule");
assert(
  menuDishIdsAt(1).join() === "biz-caprese-salad,biz-mushroom-bruschetta",
  "M1: Level 1 already has a real menu: Caprese Salad and Mushroom Bruschetta",
);
const bad: string[] = [];
for (let lv = 1; lv <= 250; lv++) {
  const band = MENU_TARGETS.find((b) => lv >= b.from && lv <= b.to)!;
  const n = menuDishIdsAt(lv).length;
  if (n < band.min || n > band.max) bad.push(`L${lv}: ${n} (target ${band.min}–${band.max})`);
}
assert(
  bad.length === 0,
  `M2: the menu size is inside the target band at every level 1–250 ${bad.slice(0, 3).join("; ")}`,
);
const scheduled = MENU_UNLOCKS.flatMap((u) => [...u.dishIds]);
assert(
  scheduled.length === 48 &&
    new Set(scheduled).size === 48 &&
    scheduled.every((id) => dishIds.includes(id)) &&
    menuDishIdsAt(241).length === 48 &&
    menuDishIdsAt(240).length === 47,
  "M3: all 48 catalog dishes are scheduled once, the last at L241",
);
assert(
  MENU_UNLOCKS.every((u) => u.dishIds.length <= 2) &&
    MENU_UNLOCKS.every((u, i) => i === 0 || u.level > MENU_UNLOCKS[i - 1]!.level),
  "M4: never more than 2 dishes at once; unlock levels strictly increase",
);

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
    activeMenuDishes(offEarly, 10).length === 3 && activeMenuDishes(none, 10).length === 3,
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
  const lockedId = lockedMenuDishes(10)[0]!.dish.id;
  assert(
    !canOrderDish(none, 10, lockedId) &&
      !canOrderDish(none, 200, "biz-thai-basil-salmon") &&
      canOrderDish(none, 241, "biz-thai-basil-salmon"),
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
    }) === 12 && dishesUnlockedAt(51).length === 2,
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
