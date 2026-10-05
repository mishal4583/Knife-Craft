/**
 * RESTAURANT_NEWS — the small story/tutorial notice for a level (developer
 * 2026-10-05 §2, §4, §10): what the restaurant gains at this level and why,
 * and what is coming soon, so the player always knows the next system and
 * the reason for it before it arrives:
 *
 *  - systems that open here (their title and the chef's line); the menu's
 *    own notice (L11) explains the whole chain:
 *    Menu → Customer Order → Inventory → Preparation → Service → Revenue;
 *  - dishes that join the menu here, with the reason (MENU_UNLOCKS.why);
 *  - cuisines whose chapter opens here (and their specialist chef);
 *  - coming up within 5 levels: systems, cuisines and staff the restaurant
 *    will need (staffComingUp), each with its level.
 *
 * Shown on the Pre-Service Check of a first play (the sheet opens for it
 * when something NEW happens at this level). Pure; derived from the level
 * only, so it needs no save state.
 */
import { getBusinessDish } from "../business/businessDishCatalog";
import {
  CUISINES,
  RESTAURANT_SYSTEMS,
  dishesUnlockedAt,
  menuUnlockReasonAt,
  systemsIntroducedAt,
  type RestaurantSystem,
} from "./restaurantProgression";
import { staffComingUp } from "./staffRequirements";

/** The chain the menu teaches (shown when the menu opens). */
export const RESTAURANT_CHAIN = [
  "Menu",
  "Customer Order",
  "Inventory",
  "Preparation",
  "Service",
  "Revenue",
] as const;

export const NEWS_NOTICE_LEVELS = 5;

export type RestaurantNews = {
  levelNumber: number;
  systems: RestaurantSystem[];
  /** The chain line, when the menu opens at this level. */
  chain: readonly string[] | null;
  dishes: { id: string; name: string }[];
  dishWhy: string | null;
  cuisines: { name: string; specialist: string | null }[];
  comingUp: { level: number; text: string }[];
};

export function restaurantNewsAt(levelNumber: number): RestaurantNews {
  const systems = systemsIntroducedAt(levelNumber);
  const soon = (from: number) => from > levelNumber && from - levelNumber <= NEWS_NOTICE_LEVELS;
  const comingUp = [
    ...RESTAURANT_SYSTEMS.filter((s) => soon(s.firstLevel)).map((s) => ({
      level: s.firstLevel,
      text: `${s.title}: ${s.covers}`,
    })),
    ...CUISINES.filter((c) => soon(c.firstLevel)).map((c) => ({
      level: c.firstLevel,
      text: `${c.name} cuisine opens${c.specialist ? ` — hire the ${c.specialist.title} to cook it` : ""}`,
    })),
    ...staffComingUp(levelNumber)
      .filter((s) => !CUISINES.some((c) => c.specialist?.title === s.title && soon(c.firstLevel)))
      .map((s) => ({ level: s.level, text: `${s.title} needed: ${s.why}` })),
  ].sort((a, b) => a.level - b.level);
  return {
    levelNumber,
    systems,
    chain: systems.some((s) => s.id === "menu") ? RESTAURANT_CHAIN : null,
    dishes: dishesUnlockedAt(levelNumber).map((id) => ({
      id,
      name: getBusinessDish(id)?.name ?? id,
    })),
    dishWhy: menuUnlockReasonAt(levelNumber),
    cuisines: CUISINES.filter((c) => c.firstLevel === levelNumber).map((c) => ({
      name: c.name,
      specialist: c.specialist?.title ?? null,
    })),
    comingUp,
  };
}

/** True when something NEW happens at this level (the check opens to show it). */
export function hasNewsToShow(news: RestaurantNews): boolean {
  return news.systems.length > 0 || news.dishes.length > 0 || news.cuisines.length > 0;
}
