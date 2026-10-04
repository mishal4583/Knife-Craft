/**
 * RESTAURANT_PROGRESSION — the ONE table of what the restaurant has at each
 * campaign level (developer spec "Unified Restaurant Progression & Early
 * Menu", 2026-10-04, §5, §2, §7, §17). Nothing else hard-codes a level for
 * these; components and managers ask this module.
 *
 *  - SYSTEMS: which restaurant system is live from which level.
 *  - MENU_UNLOCKS: when each of the 48 menu dishes (BUSINESS_DISH_CATALOG,
 *    the one menu) joins the menu. Curated to the developer's target curve
 *    (2 dishes at L1 … 48 by L241) under three rules, checked by
 *    `restaurant-menu-qa`:
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
export const RESTAURANT_SYSTEMS: readonly RestaurantSystem[] = [
  {
    id: "menu",
    firstLevel: 1,
    stage: "Apprentice Restaurant",
    title: "Your menu",
    covers: "The dishes your restaurant sells; customers order from it",
    intro: "Every restaurant starts with a menu. Ours has two dishes — let's cook them well.",
  },
  {
    id: "restaurant-day",
    firstLevel: 1,
    stage: "Apprentice Restaurant",
    title: "Opening and closing time",
    covers: "A day of services, then closing time: clean up and count the day",
    intro: "We open, we cook, and at the end of the day we clean up and close.",
  },
  {
    id: "ingredient-stock",
    firstLevel: 11,
    stage: "Pantry",
    title: "Ingredient stock",
    covers: "Buying ingredients in the Market, stock quantities and restocking",
    intro: "Grandma's pantry is empty. From today we buy our own ingredients.",
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
    stage: "Full Restaurant",
    title: "Full restaurant operation",
    covers: "Menu, stock, fridge, supplies, takeaway, staff, suppliers and costs together",
    intro: "This is a real restaurant now. Every part of it matters.",
  },
  {
    id: "expansion",
    firstLevel: 121,
    stage: "Expansion",
    title: "Restaurant expansion",
    covers: "A bigger menu, more cuisines and busier services",
    intro: "We're growing. More dishes, more guests.",
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
    covers: "The last dishes, and the Grand Service at Level 250",
    intro: "The Grand Service is close. Let's make sure we're ready.",
  },
];

export const LAST_CAMPAIGN_LEVEL = 250;

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

export const CUISINES: readonly CuisineUnlock[] = [
  { id: "home", name: "Home Kitchen", cuisineIds: ["home"], firstLevel: 1, specialist: null },
  { id: "italian", name: "Italian", cuisineIds: ["italian"], firstLevel: 1, specialist: null },
  { id: "french", name: "French Bistro", cuisineIds: ["french"], firstLevel: 31, specialist: null },
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
    firstLevel: 61,
    specialist: { id: "mediterranean-chef", title: "Mediterranean Chef" },
  },
  {
    id: "mexican",
    name: "Mexican",
    cuisineIds: ["mexican"],
    firstLevel: 71,
    specialist: { id: "mexican-chef", title: "Mexican Chef" },
  },
  {
    id: "asian",
    name: "Asian",
    cuisineIds: ["chinese", "japanese", "thai", "korean"],
    firstLevel: 121,
    specialist: { id: "asian-chef", title: "Asian Chef" },
  },
];

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

/** Level → the dishes (BusinessDish ids) that join the menu there. */
export const MENU_UNLOCKS: readonly { level: number; dishIds: readonly string[] }[] = [
  { level: 1, dishIds: ["biz-caprese-salad", "biz-mushroom-bruschetta"] },
  { level: 6, dishIds: ["biz-garden-salad"] },
  { level: 11, dishIds: ["biz-garlic-bread"] },
  { level: 16, dishIds: ["biz-tomato-bruschetta"] },
  { level: 21, dishIds: ["biz-tomato-basil-crostini"] },
  { level: 26, dishIds: ["biz-caprese-skewers"] },
  { level: 31, dishIds: ["biz-peach-cheddar-board"] },
  { level: 34, dishIds: ["biz-zucchini-fennel-salad"] },
  { level: 37, dishIds: ["biz-celery-apple-salad"] },
  { level: 41, dishIds: ["biz-fennel-artichoke-salad"] },
  { level: 44, dishIds: ["biz-sauteed-garlic-mushrooms"] },
  { level: 47, dishIds: ["biz-insalata-di-pomodoro"] },
  { level: 51, dishIds: ["biz-spinach-curry", "biz-potato-curry"] },
  { level: 55, dishIds: ["biz-tomato-lettuce-salad"] },
  { level: 61, dishIds: ["biz-cauliflower-curry", "biz-kachumber-salad"] },
  { level: 66, dishIds: ["biz-kiwi-watermelon-plate"] },
  { level: 71, dishIds: ["biz-strawberry-grape-cup", "biz-sweet-potato-hash"] },
  { level: 76, dishIds: ["biz-pea-tomato-curry"] },
  { level: 81, dishIds: ["biz-cucumber-pomegranate-salad"] },
  { level: 86, dishIds: ["biz-avocado-corn-salad"] },
  { level: 91, dishIds: ["biz-pumpkin-coconut-curry"] },
  { level: 96, dishIds: ["biz-beet-orange-salad", "biz-asparagus-persillade"] },
  { level: 101, dishIds: ["biz-tomato-chicken-curry"] },
  { level: 106, dishIds: ["biz-ribeye-herb-butter"] },
  { level: 109, dishIds: ["biz-salmon-asparagus"] },
  { level: 113, dishIds: ["biz-greek-lemon-chicken"] },
  { level: 117, dishIds: ["biz-carne-asada-corn"] },
  { level: 121, dishIds: ["biz-tofu-broccoli-stirfry", "biz-cabbage-cauliflower-stirfry"] },
  { level: 131, dishIds: ["biz-turnips-persillade"] },
  { level: 141, dishIds: ["biz-eggplant-masala"] },
  { level: 146, dishIds: ["biz-thai-cucumber-salad"] },
  { level: 151, dishIds: ["biz-mango-pineapple-cup"] },
  { level: 161, dishIds: ["biz-salmon-persillade"] },
  { level: 171, dishIds: ["biz-chicken-broccoli"] },
  { level: 176, dishIds: ["biz-korean-pear-radish-salad"] },
  { level: 181, dishIds: ["biz-salmon-sashimi"] },
  { level: 201, dishIds: ["biz-green-bean-tofu-stirfry"] },
  { level: 206, dishIds: ["biz-salmon-avocado-salad"] },
  { level: 211, dishIds: ["biz-thai-basil-chicken"] },
  { level: 221, dishIds: ["biz-black-pepper-chicken"] },
  { level: 231, dishIds: ["biz-garlic-chicken"] },
  { level: 241, dishIds: ["biz-thai-basil-salmon"] },
];

/** The developer's target menu size per level band (spec §2), for QA and the Progress screen. */
export const MENU_TARGETS: readonly { from: number; to: number; min: number; max: number }[] = [
  { from: 1, to: 5, min: 2, max: 2 },
  { from: 6, to: 10, min: 3, max: 3 },
  { from: 11, to: 20, min: 4, max: 5 },
  { from: 21, to: 30, min: 6, max: 7 },
  { from: 31, to: 40, min: 8, max: 10 },
  { from: 41, to: 50, min: 11, max: 13 },
  { from: 51, to: 60, min: 14, max: 16 },
  { from: 61, to: 80, min: 17, max: 22 },
  { from: 81, to: 100, min: 23, max: 27 },
  { from: 101, to: 120, min: 28, max: 32 },
  { from: 121, to: 150, min: 33, max: 37 },
  { from: 151, to: 180, min: 38, max: 41 },
  { from: 181, to: 210, min: 42, max: 44 },
  { from: 211, to: 240, min: 45, max: 47 },
  { from: 241, to: 250, min: 48, max: Infinity },
];

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

/** Before this level the menu runs itself (every unlocked dish on); from it the player chooses. */
export const MENU_CHOICE_LEVEL = 51;

// ── The restaurant day ──────────────────────────────────────────────────

/** Services (levels) per day, by level: lunch + dinner early, breakfast added with the cuisines. */
export const DAY_SCHEDULE: readonly { fromLevel: number; services: readonly string[] }[] = [
  { fromLevel: 1, services: ["Lunch", "Dinner"] },
  { fromLevel: 51, services: ["Breakfast", "Lunch", "Dinner"] },
];

/** The service names of a day that starts with level `levelNumber`. */
export function servicesForDayAt(levelNumber: number): readonly string[] {
  let services = DAY_SCHEDULE[0]!.services;
  for (const s of DAY_SCHEDULE) if (levelNumber >= s.fromLevel) services = s.services;
  return services;
}

/** The closing-time chores, in order (shown as a checklist; supplies they use come with dine-in). */
export const CLOSING_CHORES: readonly { id: string; label: string; fromLevel: number }[] = [
  { id: "wash-up", label: "Wash the dishes and the knives", fromLevel: 1 },
  { id: "wipe-down", label: "Wipe down the boards and counters", fromLevel: 1 },
  { id: "spoiled", label: "Throw out spoiled food", fromLevel: 21 },
  { id: "dining-room", label: "Clear and set the dining room", fromLevel: 31 },
  { id: "count", label: "Count the day's takings", fromLevel: 1 },
];
