/**
 * CUSTOMER_DEFINITIONS — a reusable roster of customer identities
 * (brief §55). Display names are the popular international ones (developer 2026-11-08: fewer Indian names, more international);
 * the ids stay the old ones because they name the painted portraits (public/people/<id>/). Deliberately not one-per-recipe or one-per-level: these
 * are presentation flavor shared across every cuisine and chapter, the
 * same way KNIFE_CATALOG isn't one knife per level.
 */
import type { CustomerDefinition } from "./customerTypes";

export const CUSTOMERS: CustomerDefinition[] = [
  { id: "mara", name: "Emma", avatarEmoji: "👩", greeting: "Something simple today, please." },
  {
    id: "tobias",
    name: "Lucas",
    avatarEmoji: "🧑",
    greeting: "I've been looking forward to this all week.",
  },
  {
    id: "priya",
    name: "Sofia",
    avatarEmoji: "👩‍🦱",
    greeting: "The usual, if the kitchen's up for it.",
  },
  {
    id: "oscar",
    name: "Oscar",
    avatarEmoji: "👴",
    greeting: "No rush — good food is worth the wait.",
  },
  { id: "lena", name: "Mia", avatarEmoji: "👱‍♀️", greeting: "Surprise me. I trust the kitchen." },
  {
    id: "diego",
    name: "Mateo",
    avatarEmoji: "🧔",
    greeting: "My grandmother used to make something like this.",
  },
  {
    id: "yuki",
    name: "Yuki",
    avatarEmoji: "👩‍🦰",
    greeting: "Clean and simple, exactly as it should be.",
  },
  { id: "amir", name: "Liam", avatarEmoji: "🧑‍🦱", greeting: "Table for one, appetite for more." },
  {
    id: "rosa",
    name: "Isabella",
    avatarEmoji: "👵",
    greeting: "It's been too long since I've had this.",
  },
  {
    id: "felix",
    name: "Felix",
    avatarEmoji: "👨",
    greeting: "Whatever the chef recommends today.",
  },
  {
    id: "sana",
    name: "Chloé",
    avatarEmoji: "🧕",
    greeting: "I heard good things about this place.",
  },
  { id: "noah", name: "Noah", avatarEmoji: "👦", greeting: "Can I get my favourite again?" },
];

export function randomCustomer(rand: () => number = Math.random): CustomerDefinition {
  return CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)] ?? CUSTOMERS[0]!;
}

