/**
 * RESTAURANT_UNLOCKS — kept as the import path earlier phases use. The
 * schedule itself now lives in the one progression table,
 * `restaurantProgression.ts` (developer spec 2026-10-04 "Unified Restaurant
 * Progression & Early Menu", which moved the menu to Level 1 and re-ordered
 * the systems).
 */
export {
  RESTAURANT_SYSTEMS,
  LAST_CAMPAIGN_LEVEL,
  restaurantSystem,
  isSystemLive,
  liveSystems,
  systemsIntroducedAt,
  nextSystemAfter,
  type RestaurantSystem,
  type RestaurantSystemId,
} from "./restaurantProgression";
