/**
 * THE FIRST-RUN HAND (developer 2026-11-01: "ensure there are proper hand instructions to buy the ingredients, hire
 * them, and then go back to cutting"). One hand at a time, in order, until the first service is done:
 *
 *   1. buy      the food for Level 1 (the Market's first Buy button)
 *   2. hire     the Server and the Cashier (the Market's Hire buttons), paid from the opening cash
 *   3. kitchen  back to the Kitchen (the bottom bar's Kitchen tab)
 *   4. open     "Open for service" (the Kitchen's button)
 *   5. start    the Pre-Service Check's start button; then the cutting itself, which has its own coach
 *
 * A step is DONE when its rule stops applying (the food is in the fridge, both are hired), so the hand only ever
 * moves forward and a finished step never returns. A hire the player cannot pay for is skipped (the hand never points
 * at a button that cannot be tapped). Presentation only: nothing is bought or hired here; pure and deterministic.
 */
import type { SaveData } from "../SaveManager";
import { marketPlanFor } from "./marketPlan";
import { teamOffers } from "./diningHire";
import { restaurantLevelOf } from "./restaurantMenu";

export type FirstRunStep = "buy" | "hire" | "to-market" | "to-kitchen" | "open" | "start";

/** Where the player is: the Market, the Kitchen, the open Pre-Service Check, or anywhere else. */
export type FirstRunWhere = "market" | "kitchen" | "sheet" | "other";

export type FirstRunHand = { step: FirstRunStep; caption: string };

const CAPTIONS: Record<FirstRunStep, string> = {
  buy: "1️⃣ Buy the food for your first order",
  hire: "2️⃣ Hire your Server and Cashier",
  "to-market": "🛒 Market first: buy the food and hire your team",
  "to-kitchen": "3️⃣ Done shopping — back to the Kitchen",
  open: "4️⃣ Open for service",
  start: "5️⃣ Start the service, then cut!",
};

/** True until the very first service is finished (a new game only). */
export const isFirstRun = (save: SaveData): boolean =>
  save.levelProgress.completedLevelIds.length === 0 && save.story.introDone;

/** The food Level 1 still needs (today's plan has lines to buy). */
const needsFood = (save: SaveData): boolean => marketPlanFor(save, 1).rows.length > 0;

/** A hire that is still to do and that the opening cash can pay for. */
const needsTeam = (save: SaveData): boolean =>
  teamOffers(save, restaurantLevelOf(save.levelProgress)).some((o) => o.affordable);

/** The hand to show now, or null (not the first run, or nothing to point at). */
export function firstRunHand(save: SaveData, where: FirstRunWhere): FirstRunHand | null {
  if (!isFirstRun(save)) return null;
  const food = needsFood(save);
  const team = !food && needsTeam(save);
  let step: FirstRunStep;
  if (food) step = where === "market" ? "buy" : "to-market";
  else if (team) step = where === "market" ? "hire" : "to-market";
  else if (where === "sheet") step = "start";
  else if (where === "kitchen") step = "open";
  else step = "to-kitchen";
  return { step, caption: CAPTIONS[step] };
}
