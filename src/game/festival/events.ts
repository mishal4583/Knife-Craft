/**
 * THE FIFTEEN FESTIVALS (developer 2026-11-27). Each is hosted by one of the city's 49 rival restaurants (the developer: "use existing ones"). The first
 * nine open at campaign levels 10 to 90; the last six open after the campaign, counted in Endless Restaurant orders, each gap starting only once the
 * festival before has been played (schedule.ts). `built` events can be played; the rest show "Coming soon".
 */
import type { Pace, RoundConfig } from "./types";
import { burgerRound } from "./burger";
import { paceFor } from "./tiers";

export type FestivalUnlock =
  /** The campaign level that opens it (the restaurant game shows it as "in N services"). */
  | { kind: "level"; level: number }
  /** Endless Restaurant orders after the festival before was first played (the first: after the campaign was completed). */
  | { kind: "orders"; gap: number };

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
  rivalId: string;
  /** Set when the festival can be played. */
  round?: (pace: Pace, seed: number) => RoundConfig;
  lines?: RivalLines;
};

const level = (n: number): FestivalUnlock => ({ kind: "level", level: n });
const orders = (gap: number): FestivalUnlock => ({ kind: "orders", gap });

/** Chef Dolly Ray's lines at the Burger Festival (Sunny Side Diner). */
const DOLLY: RivalLines = {
  start: "Burgers? I flip them in my sleep.",
  ahead: "My grill is winning. Hustle!",
  passed: "Hey! That was my lead.",
  slip: "Oops. That one was charcoal.",
  beaten: "You out-grilled me. Fair and square.",
  won: "Good fight. Come back hungry.",
};

export const FESTIVAL_EVENTS: readonly FestivalEvent[] = [
  {
    id: "burger",
    number: 1,
    name: "Burger Festival",
    emoji: "🍔",
    unlock: level(10),
    rivalId: "sunny-side",
    round: burgerRound,
    lines: DOLLY,
  },
  {
    id: "pizza",
    number: 2,
    name: "Pizza Festival",
    emoji: "🍕",
    unlock: level(20),
    rivalId: "luigis",
  },
  {
    id: "sandwich",
    number: 3,
    name: "Sandwich Festival",
    emoji: "🥪",
    unlock: level(30),
    rivalId: "corner-toast",
  },
  {
    id: "breakfast",
    number: 4,
    name: "Breakfast Festival",
    emoji: "🥞",
    unlock: level(40),
    rivalId: "bean-there",
  },
  {
    id: "street",
    number: 5,
    name: "Street Food Festival",
    emoji: "🌮",
    unlock: level(50),
    rivalId: "pita-pocket",
  },
  {
    id: "asian",
    number: 6,
    name: "Asian Food Festival",
    emoji: "🍜",
    unlock: level(60),
    rivalId: "wok-n-roll",
  },
  {
    id: "healthy",
    number: 7,
    name: "Healthy Food Festival",
    emoji: "🥗",
    unlock: level(70),
    rivalId: "green-fork",
  },
  {
    id: "bbq",
    number: 8,
    name: "BBQ Festival",
    emoji: "🍖",
    unlock: level(80),
    rivalId: "hearth-and-ember",
  },
  {
    id: "pasta",
    number: 9,
    name: "Pasta Festival",
    emoji: "🍝",
    unlock: level(90),
    rivalId: "pasta-fresca",
  },
  {
    id: "seafood",
    number: 10,
    name: "Seafood Festival",
    emoji: "🦐",
    unlock: orders(4),
    rivalId: "blue-anchor",
  },
  {
    id: "bakery",
    number: 11,
    name: "Bakery Festival",
    emoji: "🥐",
    unlock: orders(4),
    rivalId: "the-orchard",
  },
  {
    id: "indian",
    number: 12,
    name: "Indian Street Food",
    emoji: "🥘",
    unlock: orders(4),
    rivalId: "curry-corner",
  },
  {
    id: "mexican",
    number: 13,
    name: "Mexican Festival",
    emoji: "🌯",
    unlock: orders(4),
    rivalId: "la-cantina",
  },
  {
    id: "gourmet",
    number: 14,
    name: "Gourmet Festival",
    emoji: "🍽️",
    unlock: orders(4),
    rivalId: "aurora",
  },
  {
    id: "championship",
    number: 15,
    name: "World Championship",
    emoji: "🏆",
    unlock: orders(5),
    rivalId: "maison-lumiere",
  },
];

export const festivalEvent = (id: string): FestivalEvent | undefined =>
  FESTIVAL_EVENTS.find((e) => e.id === id);

export const FESTIVAL_FIRST_LEVEL = 10;

/** An event's round at its own pace (or at another, for the developer's preview link), for a seed. */
export function festivalRound(
  event: FestivalEvent,
  seed: number,
  tier: number = event.number,
): RoundConfig | null {
  return event.round ? event.round(paceFor(tier), seed) : null;
}
