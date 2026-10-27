/**
 * RESTAURANT_PROGRESSION — the ONE table of what the restaurant has at each
 * campaign level (developer spec "Unified Restaurant Progression & Early
 * Menu", 2026-10-04, §5, §2, §7, §17). Nothing else hard-codes a level for
 * these; components and managers ask this module.
 *
 *  - SYSTEMS: which restaurant system is live from which level.
 *  - MENU_UNLOCKS: when each of the 48 menu dishes (BUSINESS_DISH_CATALOG,
 *    the one menu) joins the menu. Curated to the developer's MENU_CURVE
 *    (2026-10-05: the menu opens at L11 with 4 dishes … 48 by L161) under
 *    three rules, checked by `restaurant-menu-qa`:
 *      1. a dish never comes before every knife technique it needs is
 *         taught (coaching's first-use level); Levels 1–5 are the tutorial
 *         that teaches all the basics, so the two starter dishes count as
 *         taught by it;
 *      2. never before its cuisine opens (CUISINES);
 *      3. chicken/steak dishes from L101 and salmon from L109, when meat and
 *         fish arrive in the campaign (the ribeye waits for the Butcher Block
 *         at L106).
 *    No recipe, dish or level data is changed: this is a schedule over the
 *    existing catalog.
 *  - CUISINES: the house cuisines (home, Italian, French) need no
 *    specialist; each later cuisine opens with its specialist chef, named
 *    here and announced ahead (staff requirements themselves are phase I).
 *  - DAY: how many services (levels) make one restaurant day, and their
 *    names, by level. A day opens, serves them, then closes (closing time:
 *    clean up, count the day, throw out spoiled food) before the next opens.
 *  - MENU_CHOICE_LEVEL: before it the menu runs itself (every unlocked dish
 *    is on); from it the player chooses the active dishes.
 *
 * Pure data + functions; nothing reads RESTAURANT_MODE. Economy values do
 * not live here (docs/ECONOMY_TODO.md).
 */

import {
  CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL,
  CAMPAIGN_150_SOURCE_LEVEL_NUMBERS,
  remapCampaignThreshold,
} from "../levels/campaignSelection";
import { LEVELS } from "../levels/levelDefinitions";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import { getBusinessDish } from "../business/businessDishCatalog";

/**
 * Business and customer-menu systems arrive together. Early game (developer 2026-10-25):
 * Level 5, the source design's old L11 (`remapCampaignThreshold(11)`); it was floored at 11.
 */
export const BUSINESS_MENU_FIRST_LEVEL = 5;

/** Ingredients become a player-managed stock system when the Market opens. */
export const INGREDIENT_STOCK_FIRST_LEVEL = 3;

// ── Systems ─────────────────────────────────────────────────────────────

export type RestaurantSystemId =
  | "menu"
  | "restaurant-day"
  | "ingredient-stock"
  | "fridge-freshness"
  | "dine-in"
  | "staff"
  | "cuisines"
  | "takeaway"
  | "full-operation"
  | "expansion"
  | "established"
  | "master"
  | "grand-service";

export type RestaurantSystem = {
  id: RestaurantSystemId;
  /** The first campaign level whose service uses it. */
  firstLevel: number;
  /** The stage name the Progress screen and unlock cards use. */
  stage: string;
  title: string;
  /** What the player now handles (shown on the unlock card). */
  covers: string;
  /** The chef's line that explains WHY it exists. */
  intro: string;
};

/** In unlock order (spec §5). */
const SOURCE_RESTAURANT_SYSTEMS: readonly RestaurantSystem[] = [
  {
    id: "restaurant-day",
    firstLevel: 1,
    stage: "Apprentice Restaurant",
    title: "Opening and closing time",
    covers: "A day of services, then closing time: clean up and count the day",
    intro: "We open, we cook, and at the end of the day we clean up and close.",
  },
  {
    id: "menu",
    firstLevel: 11,
    stage: "Opening Menu",
    title: "Your menu",
    covers:
      "Menu → customer order → inventory → preparation → service → revenue: customers order from the menu",
    intro:
      "You know the basics now. A restaurant needs a menu — customers order what's on it, and we earn from what we serve.",
  },
  {
    id: "ingredient-stock",
    firstLevel: 3,
    stage: "Pantry",
    title: "Ingredient stock",
    covers: "Buying ingredients in the Market, stock quantities and restocking",
    intro: "Every service needs ingredients. Check your stock and buy what the order needs in the Market.",
  },
  {
    id: "fridge-freshness",
    firstLevel: 21,
    stage: "Fridge & Freshness",
    title: "Refrigerator and freshness",
    covers: "Fridge capacity, freshness, spoilage and stock rotation",
    intro: "Food doesn't keep forever. Don't buy more than you can use.",
  },
  {
    id: "dine-in",
    firstLevel: 31,
    stage: "Dine-in Service",
    title: "Dine-in service and supplies",
    covers: "Tableware, napkins, dish soap and cleaning supplies",
    intro: "We're serving tables now. Every guest needs a place setting.",
  },
  {
    id: "staff",
    firstLevel: 41,
    stage: "Staff",
    title: "Staff",
    covers: "Hiring the team as the restaurant gets busier",
    intro: "We can't do this alone any more. Time to hire some help.",
  },
  {
    id: "cuisines",
    firstLevel: 51,
    stage: "Cuisines & Specialists",
    title: "New cuisines",
    covers: "New cuisines, each with its specialist chef",
    intro: "Guests want more than Grandma's classics. New cuisines need their own chefs.",
  },
  {
    id: "takeaway",
    firstLevel: 71,
    stage: "Takeaway",
    title: "Takeaway",
    covers: "Containers, bags and bigger services",
    intro: "People want our food at home. Let's open a takeaway window.",
  },
  {
    id: "full-operation",
    firstLevel: 91,
    stage: "Bigger Restaurant",
    title: "A bigger restaurant",
    covers:
      "A bigger menu, fridge and team; the day now ends with the full day-end (wages, inspection, the day's P&L)",
    intro: "This is a real restaurant now. Every part of it matters.",
  },
  {
    id: "expansion",
    firstLevel: 121,
    stage: "Full Management",
    title: "Full restaurant management",
    covers:
      "Menu, stock, fridge, supplies, takeaway, staff, suppliers and costs — all yours to run",
    intro: "We're growing. More dishes, more guests, and every decision is yours.",
  },
  {
    id: "established",
    firstLevel: 161,
    stage: "Established Restaurant",
    title: "An established restaurant",
    covers: "High-volume service, more staff and careful stock planning",
    intro: "People know our name. Let's keep up with them.",
  },
  {
    id: "master",
    firstLevel: 201,
    stage: "Master Restaurant",
    title: "Master restaurant",
    covers: "Almost everything a restaurant can run",
    intro: "This is the restaurant Grandma dreamed of.",
  },
  {
    id: "grand-service",
    firstLevel: 241,
    stage: "Grand Service",
    title: "Grand Service",
    covers: "The last dishes, and the Grand Service finale",
    intro: "The Grand Service is close. Let's make sure we're ready.",
  },
];

export const RESTAURANT_SYSTEMS: readonly RestaurantSystem[] = SOURCE_RESTAURANT_SYSTEMS
  .map((system) => ({
    ...system,
    // These two unlocks are defined in the current campaign numbering. The
    // old-source remapper would move ingredient stock to Level 1 after the
    // opening tutorials were removed, before the Market is available.
    firstLevel:
      system.id === "menu"
        ? BUSINESS_MENU_FIRST_LEVEL
        : system.id === "ingredient-stock"
          ? INGREDIENT_STOCK_FIRST_LEVEL
          : remapCampaignThreshold(system.firstLevel),
  }))
  .sort((a, b) => a.firstLevel - b.firstLevel);

/** The endgame gates follow the actual curated catalog length. */
export const LAST_CAMPAIGN_LEVEL = CAMPAIGN_150_SOURCE_LEVEL_NUMBERS.length;

export function restaurantSystem(id: RestaurantSystemId): RestaurantSystem {
  const system = RESTAURANT_SYSTEMS.find((s) => s.id === id);
  if (!system) throw new Error(`restaurantProgression: unknown system ${id}`);
  return system;
}

/** True when the service of campaign level `levelNumber` uses `id`. */
export function isSystemLive(id: RestaurantSystemId, levelNumber: number): boolean {
  return levelNumber >= restaurantSystem(id).firstLevel;
}

/** Every system live at `levelNumber`, in unlock order. */
export function liveSystems(levelNumber: number): RestaurantSystem[] {
  return RESTAURANT_SYSTEMS.filter((s) => levelNumber >= s.firstLevel);
}

/** The systems that first appear at exactly `levelNumber` (their unlock card plays there). */
export function systemsIntroducedAt(levelNumber: number): RestaurantSystem[] {
  return RESTAURANT_SYSTEMS.filter((s) => s.firstLevel === levelNumber);
}

/** The next system to unlock after `levelNumber`, for "coming up" notices; null after the last. */
export function nextSystemAfter(levelNumber: number): RestaurantSystem | null {
  return RESTAURANT_SYSTEMS.find((s) => s.firstLevel > levelNumber) ?? null;
}

/** The stage the restaurant is at (the latest live system's stage). */
export function stageAt(levelNumber: number): string {
  return liveSystems(levelNumber).at(-1)?.stage ?? RESTAURANT_SYSTEMS[0]!.stage;
}

// ── Cuisines and specialists ────────────────────────────────────────────

/** Dish cuisines as BUSINESS_DISH_CATALOG tags them (`null` = home cooking). */
export type CuisineKey = "home" | string;

export type CuisineUnlock = {
  /** The cuisine group's id. */
  id: string;
  name: string;
  /** The dish `cuisineId`s it covers (null → "home"). */
  cuisineIds: readonly CuisineKey[];
  firstLevel: number;
  /** The specialist chef its dishes need, or null for the house cuisines. */
  specialist: { id: string; title: string } | null;
};

const SOURCE_CUISINES: readonly CuisineUnlock[] = [
  { id: "home", name: "Home Kitchen", cuisineIds: ["home"], firstLevel: 1, specialist: null },
  { id: "italian", name: "Italian", cuisineIds: ["italian"], firstLevel: 1, specialist: null },
  { id: "french", name: "French Bistro", cuisineIds: ["french"], firstLevel: 31, specialist: null },
  // From L51 each cuisine opens with its campaign chapter and needs its specialist chef.
  {
    id: "indian",
    name: "Indian",
    cuisineIds: ["indian"],
    firstLevel: 51,
    specialist: { id: "indian-chef", title: "Indian Chef" },
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    cuisineIds: ["mediterranean"],
    firstLevel: 71,
    specialist: { id: "mediterranean-chef", title: "Mediterranean Chef" },
  },
  {
    id: "mexican",
    name: "Mexican",
    cuisineIds: ["mexican"],
    firstLevel: 81,
    specialist: { id: "mexican-chef", title: "Mexican Chef" },
  },
  // One Asian Chef for the four Asian chapters (open decision: one chef or four).
  {
    id: "japanese",
    name: "Japanese",
    cuisineIds: ["japanese"],
    firstLevel: 101,
    specialist: { id: "asian-chef", title: "Asian Chef" },
  },
  {
    id: "chinese",
    name: "Chinese",
    cuisineIds: ["chinese"],
    firstLevel: 121,
    specialist: { id: "asian-chef", title: "Asian Chef" },
  },
  {
    id: "thai",
    name: "Thai",
    cuisineIds: ["thai"],
    firstLevel: 141,
    specialist: { id: "asian-chef", title: "Asian Chef" },
  },
  {
    id: "korean",
    name: "Korean",
    cuisineIds: ["korean"],
    firstLevel: 161,
    specialist: { id: "asian-chef", title: "Asian Chef" },
  },
];

/** The first campaign level that cooks each dish cuisine (null → "home"). */
const FIRST_CUISINE_LEVEL: ReadonlyMap<CuisineKey, number> = (() => {
  const first = new Map<CuisineKey, number>();
  LEVELS.forEach((level, i) => {
    for (const id of [level.recipeId, ...(level.recipePoolIds ?? [])]) {
      const key = getCampaignRecipe(id ?? "")?.cuisineId ?? null;
      if (key && !first.has(key)) first.set(key, i + 1);
    }
  });
  return first;
})();

/**
 * A cuisine opens at its remapped level, or earlier when the campaign cooks
 * it first (developer 2026-10-17: the Mexican Chef is introduced with the
 * first Mexican dish, L16, and the Pre-Service Check asks the player to hire
 * the chef — hiring is free; wages start with full operation).
 */
export const CUISINES: readonly CuisineUnlock[] = SOURCE_CUISINES.map((cuisine) => ({
  ...cuisine,
  firstLevel: Math.min(
    remapCampaignThreshold(cuisine.firstLevel),
    ...cuisine.cuisineIds.map((k) => FIRST_CUISINE_LEVEL.get(k) ?? Infinity),
  ),
}));
/** How many levels ahead a cuisine (and its specialist) is announced. */
export const CUISINE_NOTICE_LEVELS = 5;

export function cuisineFor(cuisineId: string | null): CuisineUnlock {
  const key = cuisineId ?? "home";
  const c = CUISINES.find((x) => x.cuisineIds.includes(key));
  if (!c) throw new Error(`restaurantProgression: no cuisine group for ${key}`);
  return c;
}

/** Cuisines open at `levelNumber`. */
export function cuisinesOpenAt(levelNumber: number): CuisineUnlock[] {
  return CUISINES.filter((c) => levelNumber >= c.firstLevel);
}

/** A cuisine opening within the notice window after `levelNumber` (for "coming up"), or null. */
export function cuisineComingUp(levelNumber: number): CuisineUnlock | null {
  return (
    CUISINES.find(
      (c) => c.firstLevel > levelNumber && c.firstLevel - levelNumber <= CUISINE_NOTICE_LEVELS,
    ) ?? null
  );
}

// ── Menu ────────────────────────────────────────────────────────────────

/**
 * The developer's menu curve (2026-10-05): the menu opens at L11 with about
 * 4 dishes and grows to all 48 by L161. A point is the menu size wanted FROM
 * that level. Where the existing catalog can't reach a point under the
 * three rules (no dish is invented), the schedule holds the most it legally
 * can and catches up later — `restaurant-menu-qa` checks the schedule hits
 * min(target, dishes legally available) at every point.
 */
const SOURCE_MENU_CURVE: readonly { level: number; dishes: number }[] = [
  { level: 11, dishes: 4 },
  { level: 15, dishes: 6 },
  { level: 20, dishes: 8 },
  { level: 25, dishes: 10 },
  { level: 31, dishes: 12 },
  { level: 41, dishes: 15 },
  { level: 51, dishes: 18 },
  { level: 61, dishes: 21 },
  { level: 71, dishes: 25 },
  { level: 81, dishes: 29 },
  { level: 91, dishes: 33 },
  { level: 101, dishes: 36 },
  { level: 111, dishes: 39 },
  { level: 121, dishes: 42 },
  { level: 141, dishes: 45 },
  { level: 161, dishes: 48 },
];

export const MENU_CURVE: readonly { level: number; dishes: number }[] = (() => {
  const points = new Map<number, number>();
  for (const point of SOURCE_MENU_CURVE) {
    const level = Math.max(BUSINESS_MENU_FIRST_LEVEL, remapCampaignThreshold(point.level));
    points.set(level, Math.max(points.get(level) ?? 0, point.dishes));
  }
  return [...points].map(([level, dishes]) => ({ level, dishes })).sort((a, b) => a.level - b.level);
})();
/** The developer's target menu size at `levelNumber` (0 before the menu opens). */
export function menuTargetAt(levelNumber: number): number {
  let n = 0;
  for (const p of MENU_CURVE) if (levelNumber >= p.level) n = p.dishes;
  return n;
}

/**
 * Level → the dishes (BusinessDish ids) that join the menu there, and why
 * (the line the restaurant news shows). Each cuisine's first dishes arrive
 * the level the cuisine opens; meat (L101), the ribeye (L106) and fish
 * (L109) when they reach the campaign.
 */
const SOURCE_MENU_UNLOCKS: readonly { level: number; dishIds: readonly string[]; why: string }[] = [
  {
    level: 11,
    dishIds: [
      "biz-caprese-salad",
      "biz-mushroom-bruschetta",
      "biz-garden-salad",
      "biz-garlic-bread",
    ],
    why: "Dishes you already know how to cut: slices, dice and a smashed garlic clove.",
  },
  {
    level: 15,
    dishIds: ["biz-caprese-skewers", "biz-tomato-bruschetta"],
    why: "Two more Italian starters from the same ingredients.",
  },
  {
    level: 20,
    dishIds: ["biz-tomato-basil-crostini"],
    why: "Your diced tomatoes are good enough for crostini now.",
  },
  {
    level: 25,
    dishIds: ["biz-fennel-artichoke-salad", "biz-zucchini-fennel-salad"],
    why: "You learned julienne and radial cuts — salads that need them join the menu.",
  },
  {
    level: 31,
    dishIds: ["biz-peach-cheddar-board", "biz-celery-apple-salad"],
    why: "The French bistro chapter opens: our first French dishes.",
  },
  {
    level: 35,
    dishIds: ["biz-sauteed-garlic-mushrooms"],
    why: "Rock-mincing makes sautéed garlic mushrooms possible.",
  },
  {
    level: 41,
    dishIds: ["biz-insalata-di-pomodoro", "biz-tomato-lettuce-salad", "biz-asparagus-persillade"],
    why: "Chiffonade dishes join the menu, as the restaurant gets busier.",
  },
  {
    level: 51,
    dishIds: ["biz-spinach-curry", "biz-potato-curry", "biz-turnips-persillade"],
    why: "The Indian chapter opens with our first curries — the Indian Chef cooks them.",
  },
  {
    level: 61,
    dishIds: ["biz-cauliflower-curry", "biz-pea-tomato-curry", "biz-pumpkin-coconut-curry"],
    why: "The Indian kitchen has settled in: three more curries.",
  },
  {
    level: 71,
    dishIds: [
      "biz-kachumber-salad",
      "biz-kiwi-watermelon-plate",
      "biz-cucumber-pomegranate-salad",
      "biz-eggplant-masala",
    ],
    why: "The Mediterranean chapter opens (with the Mediterranean Chef), and one more curry.",
  },
  {
    level: 81,
    dishIds: [
      "biz-avocado-corn-salad",
      "biz-beet-orange-salad",
      "biz-sweet-potato-hash",
      "biz-strawberry-grape-cup",
    ],
    why: "The Mexican chapter opens: four dishes for the Mexican Chef.",
  },
  {
    level: 101,
    dishIds: ["biz-tomato-chicken-curry", "biz-greek-lemon-chicken", "biz-carne-asada-corn"],
    why: "Meat arrives in the kitchen: chicken and steak dishes.",
  },
  {
    level: 106,
    dishIds: ["biz-ribeye-herb-butter"],
    why: "The Butcher Block is ready for a ribeye.",
  },
  {
    level: 109,
    dishIds: ["biz-salmon-asparagus", "biz-salmon-persillade", "biz-salmon-avocado-salad"],
    why: "Fresh salmon arrives: fish dishes, and the first Japanese one for the Asian Chef.",
  },
  {
    level: 111,
    dishIds: ["biz-salmon-sashimi"],
    why: "The Asian Chef's salmon sashimi joins the menu.",
  },
  {
    level: 121,
    dishIds: [
      "biz-tofu-broccoli-stirfry",
      "biz-cabbage-cauliflower-stirfry",
      "biz-chicken-broccoli",
      "biz-green-bean-tofu-stirfry",
      "biz-black-pepper-chicken",
    ],
    why: "The Chinese chapter opens: five stir-fries for the Asian Chef.",
  },
  {
    level: 141,
    dishIds: ["biz-thai-cucumber-salad", "biz-mango-pineapple-cup", "biz-thai-basil-chicken"],
    why: "The Thai chapter opens: three Thai dishes.",
  },
  {
    level: 161,
    dishIds: ["biz-korean-pear-radish-salad", "biz-garlic-chicken", "biz-thai-basil-salmon"],
    why: "The Korean chapter opens — and the full menu of 48 is ready.",
  },
];

/** The level each cut is first cooked in the campaign — where it is taught. */
const FIRST_CUT_LEVEL: ReadonlyMap<string, number> = (() => {
  const first = new Map<string, number>();
  LEVELS.forEach((level, i) => {
    for (const id of [...(level.recipePoolIds ?? []), ...(level.batchGroupRecipeIds ?? [])])
      for (const c of getCampaignRecipe(id)?.components ?? [])
        if (!first.has(c.technique)) first.set(c.technique, i + 1);
  });
  return first;
})();

/**
 * The first level a menu dish can be cooked: every cut it needs has been
 * taught (developer 2026-10-17 audit: the 250 → 150 remap put the Zucchini &
 * Fennel Salad at L17, before julienne at L20).
 */
function cutsReadyLevel(dishId: string): number {
  const recipe = getCampaignRecipe(getBusinessDish(dishId)?.sourceRecipeId ?? "");
  return Math.max(0, ...(recipe?.components ?? []).map((c) => FIRST_CUT_LEVEL.get(c.technique) ?? 0));
}

/** Meat and fish wait for the campaign level that first cooks them (its "introduction"). */
const PROTEIN_FIRST: Readonly<Record<string, number>> = {
  chicken: CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL["chicken"] ?? 1,
  steak: CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL["steak"] ?? 1,
  salmon: CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL["salmon"] ?? 1,
};

/**
 * The first level a menu dish may join under the menu's rules: every cut it
 * needs taught, its cuisine open, its meat or fish introduced, the ribeye with
 * its butcher block (old L106).
 */
function dishLegalLevel(dishId: string): number {
  const dish = getBusinessDish(dishId);
  const recipe = getCampaignRecipe(dish?.sourceRecipeId ?? "");
  let at = Math.max(cutsReadyLevel(dishId), cuisineFor(dish?.cuisineId ?? null).firstLevel);
  for (const c of recipe?.components ?? []) at = Math.max(at, PROTEIN_FIRST[c.ingredientId] ?? 0);
  if (dishId === "biz-ribeye-herb-butter") at = Math.max(at, remapCampaignThreshold(106));
  return at;
}

/**
 * The schedule (2026-10-17, the 150-level re-plan): the developer's dishes in
 * their scheduled order, placed so that at every point of MENU_CURVE the menu
 * holds exactly min(target, the dishes the rules allow) and never runs ahead
 * of the curve between points. A dish keeps its scheduled level when there is
 * room for it; otherwise it moves to the curve point that needs it (the
 * 250 → 150 remap had left points short, and Mexican dishes at L49 after the
 * cuisine and its chef opened at L16). Its news line is its group's reason.
 */
export const MENU_UNLOCKS: readonly { level: number; dishIds: readonly string[]; why: string }[] = (() => {
  const source = SOURCE_MENU_UNLOCKS.flatMap((unlock, g) =>
    unlock.dishIds.map((dishId, k) => ({
      dishId,
      why: unlock.why,
      order: g * 100 + k,
      scheduled: Math.max(BUSINESS_MENU_FIRST_LEVEL, remapCampaignThreshold(unlock.level)),
      legal: dishLegalLevel(dishId),
    })),
  );
  const seen = new Set<string>();
  const dishes = source
    .filter((d) => (seen.has(d.dishId) ? false : (seen.add(d.dishId), true)))
    .sort((x, y) => Math.max(x.scheduled, x.legal) - Math.max(y.scheduled, y.legal) || x.order - y.order);
  const placed = new Map<string, number>();
  const count = () => placed.size;
  const points = [...MENU_CURVE].sort((a, b) => a.level - b.level);
  points.forEach((point, k) => {
    const next = points[k + 1]?.level ?? Infinity;
    // At the point: exactly min(target, the dishes legal by now).
    const legalNow = dishes.filter((d) => d.legal <= point.level).length;
    const need = Math.min(point.dishes, legalNow);
    for (const d of dishes) {
      if (count() >= need) break;
      if (!placed.has(d.dishId) && d.legal <= point.level) placed.set(d.dishId, point.level);
    }
    // Between points: a dish may still join on its own level while there is room.
    for (const d of dishes) {
      if (count() >= point.dishes) break;
      const at = Math.max(d.scheduled, d.legal, point.level + 1);
      if (!placed.has(d.dishId) && at < next) placed.set(d.dishId, at);
    }
  });
  for (const d of dishes) if (!placed.has(d.dishId)) placed.set(d.dishId, Math.max(d.scheduled, d.legal));
  const groups = new Map<number, { dishIds: string[]; reasons: string[] }>();
  for (const d of [...dishes].sort((x, y) => x.order - y.order)) {
    const level = placed.get(d.dishId)!;
    const group = groups.get(level) ?? { dishIds: [], reasons: [] };
    group.dishIds.push(d.dishId);
    if (!group.reasons.includes(d.why)) group.reasons.push(d.why);
    groups.set(level, group);
  }
  return [...groups]
    .map(([level, group]) => ({ level, dishIds: group.dishIds, why: group.reasons.join(" ") }))
    .sort((a, b) => a.level - b.level);
})();
const UNLOCK_LEVEL = new Map<string, number>(
  MENU_UNLOCKS.flatMap((u) => u.dishIds.map((id) => [id, u.level] as const)),
);

/** The level a dish joins the menu, or undefined for a dish not on the schedule. */
export function dishUnlockLevel(dishId: string): number | undefined {
  return UNLOCK_LEVEL.get(dishId);
}

/** Dish ids on the menu (unlocked) at `levelNumber`, in unlock order. */
export function menuDishIdsAt(levelNumber: number): string[] {
  return MENU_UNLOCKS.filter((u) => u.level <= levelNumber).flatMap((u) => [...u.dishIds]);
}

/** Dishes that join the menu at exactly `levelNumber`. */
export function dishesUnlockedAt(levelNumber: number): string[] {
  return MENU_UNLOCKS.filter((u) => u.level === levelNumber).flatMap((u) => [...u.dishIds]);
}

/** Why the dishes of `levelNumber` were added (the news line), or null. */
export function menuUnlockReasonAt(levelNumber: number): string | null {
  return MENU_UNLOCKS.find((u) => u.level === levelNumber)?.why ?? null;
}

/** Before this level the menu runs itself (every unlocked dish on); from it the player chooses. */
export const MENU_CHOICE_LEVEL = Math.max(BUSINESS_MENU_FIRST_LEVEL, remapCampaignThreshold(51));

// ── The restaurant day ──────────────────────────────────────────────────

/** Services (levels) per day, by level: lunch + dinner early, breakfast added with the cuisines. */
// Developer 2026-10-10: the day grows with the restaurant — 2 services to Level 20,
// then one more meal at L21, L51, L101 and L161 (6 a day at the end).
const SOURCE_DAY_SCHEDULE: readonly { fromLevel: number; services: readonly string[] }[] = [
  { fromLevel: 1, services: ["Lunch", "Dinner"] },
  { fromLevel: 21, services: ["Breakfast", "Lunch", "Dinner"] },
  { fromLevel: 51, services: ["Breakfast", "Lunch", "Afternoon Tea", "Dinner"] },
  { fromLevel: 101, services: ["Breakfast", "Brunch", "Lunch", "Afternoon Tea", "Dinner"] },
  {
    fromLevel: 161,
    services: ["Breakfast", "Brunch", "Lunch", "Afternoon Tea", "Dinner", "Late Supper"],
  },
];

export const DAY_SCHEDULE: readonly { fromLevel: number; services: readonly string[] }[] = SOURCE_DAY_SCHEDULE.map((schedule) => ({
  ...schedule,
  fromLevel: remapCampaignThreshold(schedule.fromLevel),
}));
/** The service names of a day that starts with level `levelNumber`. */
export function servicesForDayAt(levelNumber: number): readonly string[] {
  let services = DAY_SCHEDULE[0]!.services;
  for (const s of DAY_SCHEDULE) if (levelNumber >= s.fromLevel) services = s.services;
  return services;
}

/** The closing-time chores, in order (shown as a checklist; supplies they use come with dine-in). */
const SOURCE_CLOSING_CHORES: readonly { id: string; label: string; fromLevel: number }[] = [
  { id: "wash-up", label: "Wash the dishes and the knives", fromLevel: 1 },
  { id: "wipe-down", label: "Wipe down the boards and counters", fromLevel: 1 },
  { id: "spoiled", label: "Throw out spoiled food", fromLevel: 21 },
  { id: "wrap", label: "Wrap and label what's left in the fridge", fromLevel: 21 },
  { id: "dining-room", label: "Clear and set the dining room", fromLevel: 31 },
  { id: "count", label: "Count the day's takings", fromLevel: 1 },
];

export const CLOSING_CHORES: readonly { id: string; label: string; fromLevel: number }[] = SOURCE_CLOSING_CHORES.map((chore) => ({
  ...chore,
  fromLevel: remapCampaignThreshold(chore.fromLevel),
}));
// ── Menu guests (phase D) ───────────────────────────────────────────────

/**
 * Menu guests per service, by level: after a level's own orders are served,
 * this many extra customers can order from the active menu (optional). None
 * before the menu opens (L11): customers order from a menu.
 */
const SOURCE_MENU_GUESTS_SCHEDULE: readonly { fromLevel: number; guests: number }[] = [
  { fromLevel: 11, guests: 1 },
  { fromLevel: 21, guests: 2 },
  // +1 menu guest from L51 (economy F3, developer 2026-10-12): 3/4/5 → 4/5/6.
  { fromLevel: 51, guests: 4 },
  { fromLevel: 121, guests: 5 },
  { fromLevel: 201, guests: 6 },
];

export const MENU_GUESTS_SCHEDULE: readonly { fromLevel: number; guests: number }[] = (() => {
  const points = new Map<number, number>();
  for (const schedule of SOURCE_MENU_GUESTS_SCHEDULE) {
    const fromLevel = Math.max(BUSINESS_MENU_FIRST_LEVEL, remapCampaignThreshold(schedule.fromLevel));
    points.set(fromLevel, Math.max(points.get(fromLevel) ?? 0, schedule.guests));
  }
  return [...points].map(([fromLevel, guests]) => ({ fromLevel, guests })).sort((a, b) => a.fromLevel - b.fromLevel);
})();
/** How many menu guests a service of `levelNumber` can take (0 before L6). */
export function menuGuestsPerService(levelNumber: number): number {
  let guests = 0;
  for (const s of MENU_GUESTS_SCHEDULE) if (levelNumber >= s.fromLevel) guests = s.guests;
  return guests;
}
