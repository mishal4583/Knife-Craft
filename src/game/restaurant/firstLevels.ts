/**
 * THE FIRST LEVELS (developer 2026-10-09, "Levels 1–15 retention" pass 1 —
 * presentation only). The restaurant opens up one piece at a time:
 *
 *  - the bottom-bar sections open at a level each (Kitchen from the start,
 *    Inventory at 3, Market at 7, Progress at 10, Restaurant at 11); before
 *    that a section shows a lock with its level;
 *  - Grandma says one line on each of Levels 1–15's Level Complete;
 *  - the day's ceremony (the opening card and Closing Time) starts with the
 *    fridge-and-freshness stage (Level 21); before it a day ends quietly
 *    with the same `closeDay` the Closing Time button runs.
 *
 * Nothing here moves money, stock, rewards or the level order. "Opens at
 * Level N" means the player has reached Level N (its highest unlocked
 * level), the same reading the knife / board unlocks use.
 */
import { isSystemLive } from "./restaurantProgression";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import { formatUsd } from "../money";
import type { SaveData } from "../SaveManager";

/** The bottom-bar sections that open later (Kitchen is always open). */
export type LockableTab = "inventory" | "shop" | "rack" | "business";

export const TAB_OPENS_AT: Record<LockableTab, number> = {
  inventory: 3,
  shop: 7,
  rack: 10,
  business: 11,
};

/** The name each section has in the bottom bar. */
export const TAB_NAMES: Record<LockableTab, string> = {
  inventory: "Inventory",
  shop: "Market",
  rack: "Progress",
  business: "Restaurant",
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

/** The sections that open exactly at `level`, in bottom-bar order. */
export function tabsOpeningAt(level: number): LockableTab[] {
  return (Object.keys(TAB_OPENS_AT) as LockableTab[]).filter((id) => TAB_OPENS_AT[id] === level);
}

/** What a newly opened section is for (one short line on Level Complete). */
export const TAB_OPENING_NOTE: Record<LockableTab, string> = {
  inventory: "📦 Inventory is open: Grandma's fridge",
  shop: "🛒 The Market is open: knives & boards",
  rack: "🏆 Progress is open: the city ranking",
  business: "🍽️ The Restaurant is open: your menu",
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

/** The level the Market's purchases are first offered at (Santoku, Maple Board — never required). */
export const FIRST_PURCHASE_LEVEL = 10;

/**
 * The Level 10 milestone's card (story bit 1): what the Market now offers
 * (the knives and boards that open at Level 10, from their own catalogs,
 * never required) and what the next level brings.
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
    { label: "📋 Next", value: "your first menu at Level 11" },
  ];
}

/*
 * Pass 2 — Grandma's fridge (developer 2026-10-09). The levels its steps
 * happen at; the stock itself is restaurant/grandmasFridge.ts.
 */
/** Grandma's leftovers arrive in the fridge (with the Inventory). */
export const LEFTOVERS_AT = 3;
/** From here a level's own order uses its real ingredients (until stock proper, L15). */
export const STOCK_USED_FROM = 4;
/** Grandma points out what's running low. */
export const RUNNING_LOW_AT = 12;
/** The first top-up, worked out from the next services and the fridge. */
export const TOP_UP_AT = 13;
/** A look at the fridge and what the next services need. */
export const PREVIEW_AT = 14;

/**
 * True for a level whose own order uses its ingredients from Grandma's
 * fridge: Levels 4–14, before the full stock rules (Pre-Service Check,
 * `ingredient-stock`) take over at Level 15. Never blocks a serve.
 */
export function earlyStockAt(levelNumber: number): boolean {
  return levelNumber >= STOCK_USED_FROM && !isSystemLive("ingredient-stock", levelNumber);
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
  if (screen === "business" || screen.startsWith("business-")) return "business";
  if (screen === "rack") return "rack";
  return null;
}

/** "🔒 Restaurant opens at Level 11" — null when the screen is open at `reachedLevel`. */
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
export type GrandmaTip = { text: string; to?: LockableTab; button?: string };

export const GRANDMA_TIPS: Record<number, GrandmaTip> = {
  1: { text: "Tap Prepare — I'll show you how to hold the knife." },
  2: { text: "Same again, nice and steady. Your best cut earns the stars." },
  3: {
    text: "I left food in the fridge for you. Take a look!",
    to: "inventory",
    button: "Open Inventory",
  },
  4: {
    text: "From today each dish uses its ingredients from the fridge.",
    to: "inventory",
    button: "See the fridge",
  },
  5: { text: "Three steps today — the order card ticks them off as you go." },
  6: { text: "Dicing! Watch the goal on the order card." },
  7: {
    text: "The Market is open — come and look at the knives.",
    to: "shop",
    button: "Open Market",
  },
  8: { text: "Peel first, then halve. Steady hands." },
  // 9: the card's own "What's in this dish?" button is the pointer.
  10: {
    text: "Finish this one — something special is waiting. And see how we rank!",
    to: "rack",
    button: "Open Progress",
  },
  11: {
    text: "We have a menu now! Have a look at it in the Restaurant.",
    to: "business",
    button: "Open Restaurant",
  },
  12: { text: "Before you start, we'll check the fridge together." },
  13: { text: "Today we top up — buy only what's missing." },
  14: { text: "Let's look at what the next dishes need." },
  15: { text: "From today, we check the fridge before every service." },
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
 * Kitchen once per section while it is NEW (`isTabNew`), until the player
 * opens it or taps Later (`business.sectionsSeen`). Presentation only.
 */
export const SECTION_POINTER: Record<LockableTab, { title: string; line: string }> = {
  inventory: {
    title: "📦 This is your Inventory",
    line: "My leftovers are in the fridge — come and see what's there.",
  },
  shop: {
    title: "🛒 This is the Market",
    line: "Come and look at the knives and boards. Ingredients come at Level 10.",
  },
  rack: {
    title: "🏆 This is Progress",
    line: "See how far our kitchen has come — and what comes next.",
  },
  business: {
    title: "🍽️ This is your Restaurant",
    line: "The menu, the room and the day's numbers all live here.",
  },
};

const POINTER_ORDER: readonly LockableTab[] = ["inventory", "shop", "rack", "business"];

/** The section Grandma points at now: open, NEW, not seen yet (the earliest first), or null. */
export function sectionToPoint(reachedLevel: number, seen: readonly string[]): LockableTab | null {
  return POINTER_ORDER.find((t) => isTabNew(t, reachedLevel) && !seen.includes(t)) ?? null;
}

/** The save with `tab` marked as seen (the same save when it already was). */
export function markSectionSeen(save: SaveData, tab: LockableTab): SaveData {
  const seen = save.business.sectionsSeen ?? [];
  if (seen.includes(tab)) return save;
  return { ...save, business: { ...save.business, sectionsSeen: [...seen, tab] } };
}
