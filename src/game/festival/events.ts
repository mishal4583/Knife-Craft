/**
 * THE FIFTEEN FESTIVALS (developer 2026-11-27). RULE CHANGE (developer 2026-11-28): every festival has THREE STAGES, each against a different one of
 * the city's 49 rival restaurants ("use existing ones": 45 of them, none twice). Winning the third unlocks the next festival, which can be played
 * after 10 more services (schedule.ts); the first opens at campaign level 10. `built` events can be played; the rest show "Coming soon".
 */
import type { FoodId, Pace, RoundConfig } from "./types";
import { burgerRound } from "./burger";
import { paceFor, stagePace } from "./tiers";

export type FestivalUnlock =
  /** The campaign level that opens it (the restaurant game shows it as "in N services"). */
  | { kind: "level"; level: number }
  /** Winning the third stage of the festival before, then playing FESTIVAL_WAIT_SERVICES more services. */
  | { kind: "previous" };

/** Every festival's stages, one rival each. */
export const FESTIVAL_STAGES = 3;
/** Services (campaign levels, then Endless Restaurant orders) between a festival's third win and the next one opening. */
export const FESTIVAL_WAIT_SERVICES = 10;

/** One value a stage, first to third. */
export type ByStage<T> = readonly [T, T, T];

export type RivalLines = {
  start: string;
  /** The rival is ahead. */
  ahead: string;
  /** The player has just passed it. */
  passed: string;
  slip: string;
  /** It lost the round; it won the round. */
  beaten: string;
  won: string;
};

export type FestivalEvent = {
  id: string;
  number: number;
  name: string;
  emoji: string;
  unlock: FestivalUnlock;
  /** The rival of each stage, the city's weaker restaurant first. */
  rivals: ByStage<string>;
  /** How far down its menu each stage's kitchen goes (the pace's `tier`); unset until the festival is built. */
  menu?: ByStage<number>;
  /** Set when the festival can be played. */
  round?: (pace: Pace, seed: number) => RoundConfig;
  /** What each stage's rival says. */
  lines?: ByStage<RivalLines>;
};

const level = (n: number): FestivalUnlock => ({ kind: "level", level: n });
const after: FestivalUnlock = { kind: "previous" };

/** Chef Dolly Ray's lines at the Burger Festival (Sunny Side Diner). */
const DOLLY: RivalLines = {
  start: "Burgers? I flip them in my sleep.",
  ahead: "My grill is winning. Hustle!",
  passed: "Hey! That was my lead.",
  slip: "Oops. That one was charcoal.",
  beaten: "You out-grilled me. Fair and square.",
  won: "Good fight. Come back hungry.",
};
/** Chef Nils Haugen's (Harbor Grill). */
const NILS: RivalLines = {
  start: "Sea air and a hot grill. Keep up!",
  ahead: "The tide is with me. Row harder!",
  passed: "You sailed right past me!",
  slip: "That one went overboard.",
  beaten: "You rode that rush well. Fine catch.",
  won: "Rough seas today. Sail again soon.",
};
/** Chef Walt Ferris's (The Rustic Table). */
const WALT: RivalLines = {
  start: "Country cooking, and I'm no slowpoke.",
  ahead: "My smokehouse is pulling away.",
  passed: "Well now, you've got some pace.",
  slip: "Dang. Burnt the edges on that one.",
  beaten: "You earned this one. Hats off, chef.",
  won: "Good try. The porch is always open.",
};

export const FESTIVAL_EVENTS: readonly FestivalEvent[] = [
  {
    id: "burger",
    number: 1,
    name: "Burger Festival",
    emoji: "🍔",
    unlock: level(10),
    rivals: ["sunny-side", "harbor-grill", "the-rustic-table"],
    round: burgerRound,
    menu: [1, 5, 10],
    lines: [DOLLY, NILS, WALT],
  },
  {
    id: "pizza",
    number: 2,
    name: "Pizza Festival",
    emoji: "🍕",
    unlock: after,
    rivals: ["mamas-kitchen", "olive-and-fig", "luigis"],
  },
  {
    id: "sandwich",
    number: 3,
    name: "Sandwich Festival",
    emoji: "🥪",
    unlock: after,
    rivals: ["corner-toast", "the-copper-pan", "maple-and-sage"],
  },
  {
    id: "breakfast",
    number: 4,
    name: "Breakfast Festival",
    emoji: "🥞",
    unlock: after,
    rivals: ["bean-there", "the-soup-pot", "petit-jardin"],
  },
  {
    id: "street",
    number: 5,
    name: "Street Food Festival",
    emoji: "🌮",
    unlock: after,
    rivals: ["pita-pocket", "taco-hut", "spice-route"],
  },
  {
    id: "asian",
    number: 6,
    name: "Asian Food Festival",
    emoji: "🍜",
    unlock: after,
    rivals: ["noodle-nook", "wok-n-roll", "jade-dragon"],
  },
  {
    id: "healthy",
    number: 7,
    name: "Healthy Food Festival",
    emoji: "🥗",
    unlock: after,
    rivals: ["salad-days", "green-fork", "aegean-blue"],
  },
  {
    id: "bbq",
    number: 8,
    name: "BBQ Festival",
    emoji: "🍖",
    unlock: after,
    rivals: ["seoul-food", "hearth-and-ember", "the-iron-chef"],
  },
  {
    id: "pasta",
    number: 9,
    name: "Pasta Festival",
    emoji: "🍝",
    unlock: after,
    rivals: ["little-bistro", "pasta-fresca", "trattoria-sole"],
  },
  {
    id: "seafood",
    number: 10,
    name: "Seafood Festival",
    emoji: "🦐",
    unlock: after,
    rivals: ["blue-anchor", "zen-garden", "cedar-and-salt"],
  },
  {
    id: "bakery",
    number: 11,
    name: "Bakery Festival",
    emoji: "🥐",
    unlock: after,
    rivals: ["the-orchard", "silver-birch", "chez-margaux"],
  },
  {
    id: "indian",
    number: 12,
    name: "Indian Street Food",
    emoji: "🥘",
    unlock: after,
    rivals: ["curry-corner", "saffron-house", "marigold"],
  },
  {
    id: "mexican",
    number: 13,
    name: "Mexican Festival",
    emoji: "🌯",
    unlock: after,
    rivals: ["bangkok-bowl", "casa-verde", "la-cantina"],
  },
  {
    id: "gourmet",
    number: 14,
    name: "Gourmet Festival",
    emoji: "🍽️",
    unlock: after,
    rivals: ["the-velvet-spoon", "the-grand-larder", "aurora"],
  },
  {
    id: "championship",
    number: 15,
    name: "World Championship",
    emoji: "🏆",
    unlock: after,
    rivals: ["kaiseki-mori", "the-crown-kitchen", "maison-lumiere"],
  },
];

export const festivalEvent = (id: string): FestivalEvent | undefined =>
  FESTIVAL_EVENTS.find((e) => e.id === id);

export const FESTIVAL_FIRST_LEVEL = 10;

/** The pace a stage of an event plays at (tiers.ts), with that stage's part of the event's menu. */
export const paceOfStage = (event: FestivalEvent, stage: number): Pace => {
  const pace = stagePace(event.number, stage);
  const menu = event.menu?.[Math.min(FESTIVAL_STAGES, Math.max(1, stage)) - 1];
  return menu === undefined ? pace : { ...pace, tier: menu };
};

/** Which of a stage's three things (its rival, its lines): a preview with no stage takes the first. */
export const stageIndex = (stage: number | null): 0 | 1 | 2 =>
  (Math.min(FESTIVAL_STAGES, Math.max(1, stage ?? 1)) - 1) as 0 | 1 | 2;

/** What a stage adds to the one before it. */
export type StageNews = {
  foods: readonly FoodId[];
  /** One more burner, one more plate, one more customer at once. */
  grill: boolean;
  plate: boolean;
  atOnce: boolean;
  /** How many customers its round has. */
  customers: number;
};

export function stageNews(event: FestivalEvent, stage: number): StageNews {
  const nothing = { foods: [], grill: false, plate: false, atOnce: false, customers: 0 };
  if (!event.round || stage <= 1) return nothing;
  const before = event.round(paceOfStage(event, stage - 1), 1);
  const now = event.round(paceOfStage(event, stage), 1);
  const foodsOf = (r: RoundConfig) =>
    new Set<FoodId>([
      ...r.kitchen.trays.map((t) => t.item),
      ...r.kitchen.cookers.flatMap((c) => Object.keys(c.cookMs) as FoodId[]),
    ]);
  const had = foodsOf(before);
  const slots = (r: RoundConfig) => r.kitchen.cookers.find((c) => c.id === "grill")?.slots ?? 0;
  return {
    foods: [...foodsOf(now)].filter((f) => !had.has(f)),
    grill: slots(now) > slots(before),
    plate: now.kitchen.plates > before.kitchen.plates,
    atOnce: now.pace.atOnce > before.pace.atOnce,
    customers: now.orders.length,
  };
}

/** The first stage whose grill has `slots` burners (0 when no stage of this event has that many). */
export function stageWithBurners(event: FestivalEvent, slots: number): number {
  for (let stage = 1; event.round && stage <= FESTIVAL_STAGES; stage++)
    if (paceOfStage(event, stage).grillSlots >= slots) return stage;
  return 0;
}

/** The first stage (1-3) whose kitchen has a food: its pan or its drink machine (0: none, or not built). */
export function stageWithFood(event: FestivalEvent, food: FoodId): number {
  for (let stage = 1; event.round && stage <= FESTIVAL_STAGES; stage++) {
    const { kitchen } = event.round(paceOfStage(event, stage), 1);
    if (
      kitchen.trays.some((t) => t.item === food) ||
      kitchen.cookers.some((c) => c.perSlot?.includes(food))
    )
      return stage;
  }
  return 0;
}

/** The first stage that has this many plates (0: none, or not built). */
export function stageWithPlates(event: FestivalEvent, plates: number): number {
  for (let stage = 1; event.round && stage <= FESTIVAL_STAGES; stage++)
    if (paceOfStage(event, stage).plates >= plates) return stage;
  return 0;
}

/** An event's round for a seed: its first stage's, or at another pace (a stage's, or a row of the table for the developer's preview link). */
export function festivalRound(
  event: FestivalEvent,
  seed: number,
  pace: Pace | number = paceOfStage(event, 1),
): RoundConfig | null {
  return event.round ? event.round(typeof pace === "number" ? paceFor(pace) : pace, seed) : null;
}
