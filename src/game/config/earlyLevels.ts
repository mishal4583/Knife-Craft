/**
 * THE FIRST 20 LEVELS' SCHEDULE (developer 2026-11-08, docs/planning/FIRST-20-LEVELS-PLAN-2026-11-08.md): where the early systems and
 * mini-games open, in one leaf module (cleanliness.ts, serviceSupplies.ts, restaurantProgression.ts, secondFloor.ts and the Paige beats all read it).
 *
 *  L3  the delivery routine: check the delivery (Delivery Inspection), then Fridge Sort (business/deliveryFlow.ts), the daily gift and the ad bonuses
 *  L4  cleaning (CLEANING_FROM_LEVEL): one closing chore, more as their cause arrives
 *  L6  the first shopping list and Stock the shelves
 *  L8  the frying pan list; degreasing; the sweep
 *  L10 fridge and freshness, Fridge Check, spoiled food and wrapping
 *  L11 the Second Floor (and its first machine, when the player can afford it)
 *  L12 dishwashing and dine-in tableware
 *  L14 mopping; L16 the restroom
 */
export const FIRST_SHOPPING_LEVEL = 6;
export const STOCKROOM_FROM_LEVEL = 6;
export const PAN_LIST_FROM_LEVEL = 8;
export const FRIDGE_FROM_LEVEL = 10;
export const SECOND_FLOOR_FROM_LEVEL = 11;
export const DINE_IN_FROM_LEVEL = 12;
export const MOP_FROM_LEVEL = 14;
export const RESTROOM_FROM_LEVEL = 16;
/** The Second Floor's first machine (the Coffee machine) costs $500: the card appears when the player has that and this much to carry on. */
export const SECOND_FLOOR_RESERVE_CENTS = 30_000;
/**
 * Before this level a player with the money should own TWO machines upstairs (developer 2026-11-11): the cheap ones (Coffee $500, Drinks $1,000).
 * Paige and the guide nudge toward the second one (restaurant/floorAdvice.ts); nothing is forced and no money is given.
 */
export const EARLY_TWO_MACHINES_BY_LEVEL = 20;
/** The served card has no "Next Customer" through this level (developer 2026-11-08): the player walks back to the Kitchen and does something else on the way. */
export const NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL = 20;
/**
 * The city ranking is NEWS (the "#50 → #48" row on Level Complete and the Congratulations card from Paige) only once this many services are done
 * (developer 2026-11-11: "at the first serve itself Paige is showing 50 → 48 ranking progress"). The ranking is still counted from Level 1 and the
 * Kitchen badge still shows it; the guide's ranking beat (restaurantGuide.ts) opens at the same level.
 */
export const RANKING_NEWS_FROM_LEVEL = 8;
