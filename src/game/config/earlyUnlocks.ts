/**
 * EARLY UNLOCKS (early game phase 4, developer 2026-10-26: "I need everything to be unlocked
 * at or before level 5"). Everything the player can BUY, HIRE or OPEN is available by this
 * level: kitchen tiers, knives, boards, kitchen helpers, every staff hire, the Second Floor and
 * its stations, every room of the Restaurant map and the Progress section. Each catalog keeps
 * its own order (an item that opened before stays where it was) and its price.
 *
 * Not moved: the campaign's teaching stages (`restaurantProgression.ts` RESTAURANT_SYSTEMS:
 * fridge, dine-in, staff requirements, cuisines, takeaway …) — they add rules and costs to a
 * service rather than open something — and the menu's dishes, which follow the cuts taught.
 */
export const EARLY_UNLOCK_CAP = 5;

/** An unlock level, never later than EARLY_UNLOCK_CAP. */
export const earlyUnlock = (level: number): number => Math.min(level, EARLY_UNLOCK_CAP);
