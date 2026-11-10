import { BUSINESS_MENU_FIRST_LEVEL } from "../restaurant/restaurantProgression";
import { FRIDGE_SORT_FIRST_LEVEL } from "../business/fridgeSort";
import { INSPECTION_FIRST_LEVEL } from "../business/deliveryInspection";
import { SAUCE_FIRST_LEVEL } from "../business/sauceStation";
import { CLEANING_FROM_LEVEL } from "./cleaningStart";
import {
  DINE_IN_FROM_LEVEL,
  FRIDGE_FROM_LEVEL,
  PAN_LIST_FROM_LEVEL,
  SECOND_FLOOR_FROM_LEVEL,
  STOCKROOM_FROM_LEVEL,
} from "./earlyLevels";

/**
 * What opens in the first 20 levels, read from the real constants (developer 2026-11-10, plan FIRST-20-LEVELS-ENGAGEMENT-PLAN-2026-11-10.md §7).
 * Finishing a level for the first time sends one `feature_unlocked { feature, level }` analytics event for each feature that opens at the NEXT
 * level, so the first live build shows which opening a player stops at. Names only; no personal data, no money.
 */
export type FeatureUnlock = { id: string; level: number };

export const FEATURE_UNLOCKS: readonly FeatureUnlock[] = [
  { id: "unpack-delivery", level: FRIDGE_SORT_FIRST_LEVEL },
  { id: "cleaning", level: CLEANING_FROM_LEVEL },
  { id: "menu", level: BUSINESS_MENU_FIRST_LEVEL },
  { id: "stock-the-shelves", level: STOCKROOM_FROM_LEVEL },
  { id: "sauce-station", level: SAUCE_FIRST_LEVEL },
  { id: "pan-list", level: PAN_LIST_FROM_LEVEL },
  { id: "delivery-inspection", level: INSPECTION_FIRST_LEVEL },
  { id: "fridge-check", level: FRIDGE_FROM_LEVEL },
  { id: "second-floor", level: SECOND_FLOOR_FROM_LEVEL },
  { id: "dishwashing", level: DINE_IN_FROM_LEVEL },
];

/** The features that open at `level` (the level about to be played). */
export const featuresOpeningAt = (level: number): FeatureUnlock[] =>
  FEATURE_UNLOCKS.filter((f) => f.level === level);
