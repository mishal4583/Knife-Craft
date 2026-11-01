/**
 * THE STARTING TEAM (Phase 10, developer 2026-11-01): "the billing staff and the server need to be hired
 * permanently when the game starts, during the purchase of ingredients; add money for their purchase along
 * with the ten dollars". A new game starts with $10.00 for the first order's ingredients PLUS exactly the two
 * hiring fees (the Server and the Cashier), so the first shop can hire both and still buy the food.
 *
 * Pure and dependency-free (SaveManager reads it for the opening cash). `staffHireFee` in
 * restaurant/staffRequirements.ts is the rule this mirrors; dining-floor-qa fails if they ever differ.
 */
import { BUSINESS_STAFF_CATALOG } from "../business/businessStaff";
import { dollars } from "../money";

/** The two people hired in the first shop, in the order the card shows them. */
export const STARTING_TEAM_ROLES = ["server", "cashier"] as const;

/** Hiring fee = this many days of the role's pay, to whole dollars (staffRequirements.HIRE_FEE_DAYS). */
const FEE_DAYS = 3;
const feeOf = (role: (typeof STARTING_TEAM_ROLES)[number]) =>
  Math.round((BUSINESS_STAFF_CATALOG[role].salary * FEE_DAYS) / 100) * 100;

/** The two hiring fees together, in cents. */
export const STARTING_TEAM_FEES = STARTING_TEAM_ROLES.reduce((n, r) => n + feeOf(r), 0);

/** The food money a new game starts with ($10.00: Level 1's ingredients, bought with the player's own money). */
export const STARTING_FOOD_CASH = dollars(10);

/** A new game's opening cash: the food money plus the Server's and the Cashier's hiring fees. */
export const STARTING_CASH = STARTING_FOOD_CASH + STARTING_TEAM_FEES;
