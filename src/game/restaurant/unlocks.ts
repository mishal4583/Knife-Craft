/**
 * RESTAURANT_UNLOCKS — which restaurant system is live at which campaign
 * level (the Unified Restaurant spec §5, "do not introduce every system at
 * Level 1"). Every gate in the restaurant reads this ONE table; nothing
 * hard-codes a level number of its own.
 *
 * A system is live for a level when that level's number is at or past the
 * system's first level. The level being PLAYED decides what its service
 * needs (Level 15 needs stock; Level 8 never does). `intro` is the one or
 * two lines the story uses when the system first appears (spec §42–43).
 *
 * Pure data + pure functions; nothing here reads RESTAURANT_MODE.
 */

export type RestaurantSystemId =
  | "ingredient-stock"
  | "fridge-freshness"
  | "kitchen-equipment"
  | "dine-in"
  | "cleaning"
  | "staff"
  | "suppliers"
  | "menu"
  | "takeaway"
  | "efficiency"
  | "advanced-operations"
  | "full-management"
  | "grand-preparation";

export type RestaurantSystem = {
  id: RestaurantSystemId;
  /** The first campaign level whose service uses it. */
  firstLevel: number;
  title: string;
  /** What the player now handles (shown on the unlock card). */
  covers: string;
  /** The chef's line that explains WHY it exists (spec §42). */
  intro: string;
};

/** In unlock order. Levels 1–10 have none: cutting, cooking and serving only. */
export const RESTAURANT_SYSTEMS: readonly RestaurantSystem[] = [
  {
    id: "ingredient-stock",
    firstLevel: 11,
    title: "Ingredient stock",
    covers: "Buying ingredients, stock quantities and restocking",
    intro: "We're getting more customers. We need to start keeping proper stock.",
  },
  {
    id: "fridge-freshness",
    firstLevel: 21,
    title: "Refrigerator",
    covers: "Fridge capacity, freshness, spoilage and the restaurant day",
    intro: "We're serving more people now. We need somewhere to keep all this food.",
  },
  {
    id: "kitchen-equipment",
    firstLevel: 41,
    title: "Kitchen equipment",
    covers: "Pans, bowls, pots and the other smallwares a dish needs",
    intro: "Bigger dishes need the right pans and bowls.",
  },
  {
    id: "dine-in",
    firstLevel: 61,
    title: "Dine-in service",
    covers: "Plates, cutlery, glasses and napkins",
    intro: "We're serving tables now. Every guest needs a place setting.",
  },
  {
    id: "cleaning",
    firstLevel: 81,
    title: "Cleaning",
    covers: "Dishwashing liquid and cleaning supplies",
    intro: "Someone needs to keep this place clean.",
  },
  {
    id: "staff",
    firstLevel: 81,
    title: "Staff",
    covers: "Hiring the team and their roles",
    intro: "We can't do this alone any more. Time to hire some help.",
  },
  {
    id: "suppliers",
    firstLevel: 101,
    title: "Suppliers",
    covers: "Suppliers, contracts and purchasing strategy",
    intro: "We're buying enough food to negotiate with suppliers.",
  },
  {
    id: "menu",
    firstLevel: 121,
    title: "Menu",
    covers: "Your menu, dish prices and orders from the menu",
    intro: "Guests are asking for our dishes by name. Let's write a proper menu.",
  },
  {
    id: "takeaway",
    firstLevel: 151,
    title: "Takeaway",
    covers: "Containers, bags, disposable cutlery and napkins to go",
    intro: "People want our food at home. Let's open a takeaway window.",
  },
  {
    id: "efficiency",
    firstLevel: 181,
    title: "Efficiency",
    covers: "Waste, stock planning, staff efficiency and equipment condition",
    intro: "Good restaurants waste nothing. Let's run a tighter kitchen.",
  },
  {
    id: "advanced-operations",
    firstLevel: 201,
    title: "Advanced operations",
    covers: "Advanced staff, supplier contracts and bigger services",
    intro: "We're a busy restaurant now. Bigger services, bigger team.",
  },
  {
    id: "full-management",
    firstLevel: 221,
    title: "Full management",
    covers: "Everything at once: food, fridge, equipment, staff, supplies, menu",
    intro: "This is your restaurant. Every part of it is in your hands.",
  },
  {
    id: "grand-preparation",
    firstLevel: 241,
    title: "Grand preparation",
    covers: "Getting the restaurant ready for the Grand Service",
    intro: "The Grand Service is close. Let's make sure we're ready.",
  },
];

export const LAST_CAMPAIGN_LEVEL = 250;

export function restaurantSystem(id: RestaurantSystemId): RestaurantSystem {
  const system = RESTAURANT_SYSTEMS.find((s) => s.id === id);
  if (!system) throw new Error(`restaurant/unlocks: unknown system ${id}`);
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
