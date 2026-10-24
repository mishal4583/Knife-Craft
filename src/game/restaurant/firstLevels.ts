/**
 * THE FIRST LEVELS (developer 2026-10-09, "Levels 1–15 retention" pass 1 —
 * presentation only). The restaurant opens up one piece at a time:
 *
 *  - the bottom-bar sections open at a level each (Kitchen and the Restaurant
 *    map from the start, Inventory and Market at 3, Business at 11); before
 *    that a section shows a lock with its level. Progress stays reachable from
 *    the Kitchen and Business screens rather than occupying a bottom tab;
 *  - Grandma says one line on each of Levels 1–15's Level Complete;
 *  - the day's ceremony (the opening card and Closing Time) starts with the
 *    fridge-and-freshness stage (Level 21); before it a day ends quietly
 *    with the same `closeDay` the Closing Time button runs.
 *
 * Nothing here moves money, stock, rewards or the level order. "Opens at
 * Level N" means the player has reached Level N (its highest unlocked
 * level), the same reading the knife / board unlocks use.
 */
import { BUSINESS_MENU_FIRST_LEVEL, isSystemLive } from "./restaurantProgression";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import { formatUsd } from "../money";
import type { SaveData } from "../SaveManager";

/** Destinations that open later (Kitchen and the Restaurant map are always open). */
export type LockableTab = "inventory" | "shop" | "rack" | "business";

export const TAB_OPENS_AT: Record<LockableTab, number> = {
  inventory: 3,
  shop: 3,
  rack: 10,
  business: BUSINESS_MENU_FIRST_LEVEL,
};

/** Player-facing names for unlockable destinations. */
export const TAB_NAMES: Record<LockableTab, string> = {
  inventory: "Inventory",
  shop: "Market",
  rack: "Progress",
  business: "Business",
};

const isLockable = (id: string): id is LockableTab => id in TAB_OPENS_AT;

/** True when the section is open at the player's `reachedLevel`. */
export function isTabOpen(id: string, reachedLevel: number): boolean {
  return !isLockable(id) || reachedLevel >= TAB_OPENS_AT[id];
}

/** The level a section opens at, or null for one that's always open. */
export function tabOpensAt(id: string): number | null {
  return isLockable(id) ? TAB_OPENS_AT[id] : null;
}

/** Destinations that open exactly at `level`, in progression order. */
export function tabsOpeningAt(level: number): LockableTab[] {
  return (Object.keys(TAB_OPENS_AT) as LockableTab[]).filter((id) => TAB_OPENS_AT[id] === level);
}

/** What a newly opened section is for (one short line on Level Complete). */
export const TAB_OPENING_NOTE: Record<LockableTab, string> = {
  inventory: "📦 Inventory is open: track the ingredients you buy",
  shop: "🛒 The Market is open: buy the ingredients today's service needs",
  rack: "🏆 Restaurant Progress is available from the Kitchen and Business screens",
  business: "📊 Business is open: manage your restaurant",
};

/** Grandma's line on each of Levels 1–15's Level Complete (developer 2026-10-09, verbatim). */
export const GRANDMA_LINES: Record<number, string> = {
  1: "There you go. Our first plate is back on the table.",
  2: "Nice and steady. That's how good habits begin.",
  3: "Every good cook starts with the basics.",
  4: "You're starting to find your rhythm.",
  5: "Now that looks like something we'd serve to a guest.",
  6: "Small details make a big difference.",
  7: "You're beginning to work like a real cook.",
  8: "Let's get this one ready for them.",
  9: "A good cook knows when to use the right technique.",
  10: "Look at this place. We're really bringing it back.",
  11: "People need to know what we're serving.",
  12: "Everyone who walks through that door deserves a good meal.",
  13: "Good food brings people back.",
  14: "Soon, we'll need to keep the pantry ready.",
  15: "A good kitchen starts with a well-stocked pantry.",
};

/** Grandma's line for a level, or null outside Levels 1–15. */
export function grandmaLineFor(level: number): string | null {
  return GRANDMA_LINES[level] ?? null;
}

/**
 * The day's ceremony (the opening card and the Closing Time screen) shows
 * from the fridge-and-freshness stage (Level 21), the first one where
 * closing does more than turn the page. `restaurantLevel` is the level the
 * Closing Time screen would be shown for (the highest unlocked level).
 */
export function dayCeremonyAt(restaurantLevel: number): boolean {
  return isSystemLive("fridge-freshness", restaurantLevel);
}

/** Ingredient purchases first become available in the Market. */
export const FIRST_INGREDIENT_PURCHASE_LEVEL = 3;

/** The level the first new culinary tools are offered at (Santoku, Maple Board). */
export const FIRST_PURCHASE_LEVEL = 10;

/**
 * The Level 10 milestone's card (story bit 1): the new knives and boards
 * offered in the already-open Market, plus what the next level brings.
 */
export function firstPurchaseRows(): { label: string; value: string }[] {
  const items = [
    ...KNIFE_CATALOG.filter((k) => k.unlockLevel === FIRST_PURCHASE_LEVEL).map((k) => ({
      label: `🔪 ${k.name}`,
      price: k.price,
    })),
    ...BOARD_CATALOG.filter((b) => b.unlockLevel === FIRST_PURCHASE_LEVEL).map((b) => ({
      label: `🪵 ${b.name}`,
      price: b.price,
    })),
  ];
  return [
    ...items.map((i) => ({ label: i.label, value: `in the Market · ${formatUsd(i.price)}` })),
    { label: "🧰 Kitchen tools", value: "on Grandma's list in the Market" },
    { label: "📋 Next", value: "your first menu at Level 11" },
  ];
}

/* Legacy markers kept for old saves and tooling; Grandma no longer provides ingredients. */
/** Former level marker for the removed leftovers tutorial. */
export const LEFTOVERS_AT = 3;
/** Ingredient stock is active from this level; purchases are required. */
export const STOCK_USED_FROM = 3;
/** Former levels for the removed Grandma fridge tutorial. */
export const RUNNING_LOW_AT = 12;
/** Former top-up level for the removed Grandma fridge tutorial. */
export const TOP_UP_AT = 13;
/** Former preview level for the removed Grandma fridge tutorial. */
export const PREVIEW_AT = 14;

/** Legacy compatibility hook. There is no free early-stock period anymore. */
export function earlyStockAt(_levelNumber: number): boolean {
  return false;
}

/**
 * The bottom-bar section a screen belongs to (null for the Kitchen, the
 * cutting screen, Settings and other always-open screens). App.go uses it
 * so no link — "Upgrade Refrigerator", a Restock button, "Change supplier"
 * — can open a section before its level (developer 2026-10-09).
 */
export function sectionOfScreen(screen: string): LockableTab | null {
  if (screen === "shop" || screen.startsWith("shop-")) return "shop";
  if (screen === "inventory" || screen.startsWith("inventory-")) return "inventory";
  // The Restaurant map is a primary always-open hub. Individual map rooms
  // retain their existing screen/level gates when tapped.
  if (screen === "restaurant-map") return null;
  if (screen === "business" || screen.startsWith("business-")) return "business";
  if (screen === "rack") return "rack";
  return null;
}

/** A destination's lock hint, or null when it is open at `reachedLevel`. */
export function lockedScreenHint(screen: string, reachedLevel: number): string | null {
  const section = sectionOfScreen(screen);
  if (!section || isTabOpen(section, reachedLevel)) return null;
  return `🔒 ${TAB_NAMES[section]} opens at Level ${TAB_OPENS_AT[section]}`;
}

/**
 * Grandma's tip on the Kitchen's Today's Order card (developer 2026-10-09:
 * "there is no instruction to visit or see these"): for the level about to be
 * played, what's new and where to find it. `to` is the section a button
 * opens (it is always open by that level).
 */
export type GrandmaTip = {
  text: string;
  to?: LockableTab;
  button?: string;
  focus?: "ingredients";
};

export const GRANDMA_TIPS: Record<number, GrandmaTip> = {
  1: { text: "Tap Prepare — I'll show you how to hold the knife." },
  2: { text: "Same again, nice and steady. Your best cut earns the stars." },
  3: {
    text: "The Market is open. Buy what today's order needs before you start.",
    to: "shop",
    button: "Buy Ingredients",
    focus: "ingredients",
  },
  4: {
    text: "Check your fridge before each service; buy only what's missing.",
    to: "inventory",
    button: "Check Inventory",
  },
  5: { text: "Bread and garlic — prepare each part for the warm plate." },
  6: { text: "Dicing! Watch the goal on the order card." },
  7: { text: "Choose the right knife technique for each ingredient." },
  8: { text: "A new vegetable today — prepare the zucchini and its partner." },
  // 9: the card's own "What's in this dish?" button is the pointer.
  // Supplies plan A (developer 2026-10-10: "ask the player to buy some important
  // tools"): the Market sells from here — Grandma's first shopping list.
  10: {
    text: "The Market sells tools now — buy what's on my list before Level 11!",
    to: "shop",
    button: "Open Market",
  },
  11: {
    text: "We have a menu now! Have a look at it in Business.",
    to: "business",
    button: "Open Business",
  },
  12: { text: "Bruschetta needs a few parts prepared for the same plate." },
  13: { text: "Bring the Italian garden plate together one ingredient at a time." },
  14: { text: "A hearty soup base builds on the cuts you've learned." },
  15: { text: "A batch order means preparing shared ingredients once for both guests." },
};

/** Grandma's tip for the level about to be played (Levels 1–15), or null. */
export function grandmaTipFor(level: number): GrandmaTip | null {
  return GRANDMA_TIPS[level] ?? null;
}

/** A section shows "NEW" in the bottom bar for its first two levels. */
export function isTabNew(id: string, reachedLevel: number): boolean {
  const at = tabOpensAt(id);
  return at !== null && reachedLevel >= at && reachedLevel < at + 2;
}

/**
 * Grandma points at a section that just opened (developer 2026-10-10: "a hand
 * points towards the Market and says this is the Market"). Shown on the
 * Kitchen once per section, through Level 15 (developer 2026-10-10: a
 * player already past a section's NEW levels still gets it), until the
 * player opens it or taps Later (`business.sectionsSeen`). Presentation only.
 */
export const SECTION_POINTER: Record<LockableTab, { title: string; line: string }> = {
  inventory: {
    title: "📦 This is your Inventory",
    line: "Track what you own here. Buy ingredients from the Market before each service.",
  },
  shop: {
    title: "🛒 This is the Market",
    line: "Buy the ingredients your next order needs. Culinary tools unlock at Level 10.",
  },
  rack: {
    title: "🏆 This is Progress",
    line: "See how far our kitchen has come — and what comes next.",
  },
  business: {
    title: "📊 Your Business Dashboard",
    line: "Run it like a business: the menu, the guests and the day's takings.",
  },
};

const POINTER_ORDER: readonly LockableTab[] = ["inventory", "shop", "business"];

/** Grandma points out sections through this level (the first levels); later saves never. */
export const POINTER_THROUGH_LEVEL = 15;

/** The section Grandma points at now: open, not seen yet (the earliest first), or null. */
export function sectionToPoint(reachedLevel: number, seen: readonly string[]): LockableTab | null {
  if (reachedLevel > POINTER_THROUGH_LEVEL) return null;
  return POINTER_ORDER.find((t) => isTabOpen(t, reachedLevel) && !seen.includes(t)) ?? null;
}

/** The save with `tab` marked as seen (the same save when it already was). */
export function markSectionSeen(save: SaveData, tab: LockableTab): SaveData {
  const seen = save.business.sectionsSeen ?? [];
  if (seen.includes(tab)) return save;
  return { ...save, business: { ...save.business, sectionsSeen: [...seen, tab] } };
}
