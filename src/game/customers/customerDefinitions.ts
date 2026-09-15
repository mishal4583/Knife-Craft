/**
 * CUSTOMER_DEFINITIONS — a reusable roster of customer identities
 * (brief §55). Deliberately not one-per-recipe or one-per-level: these
 * are presentation flavor shared across every cuisine and chapter, the
 * same way KNIFE_CATALOG isn't one knife per level.
 */
import type { CustomerDefinition } from "./customerTypes";

export const CUSTOMERS: CustomerDefinition[] = [
  { id: "mara", name: "Mara", avatarEmoji: "👩", greeting: "Something simple today, please." },
  {
    id: "tobias",
    name: "Tobias",
    avatarEmoji: "🧑",
    greeting: "I've been looking forward to this all week.",
  },
  {
    id: "priya",
    name: "Priya",
    avatarEmoji: "👩‍🦱",
    greeting: "The usual, if the kitchen's up for it.",
  },
  {
    id: "oscar",
    name: "Oscar",
    avatarEmoji: "👴",
    greeting: "No rush — good food is worth the wait.",
  },
  { id: "lena", name: "Lena", avatarEmoji: "👱‍♀️", greeting: "Surprise me. I trust the kitchen." },
  {
    id: "diego",
    name: "Diego",
    avatarEmoji: "🧔",
    greeting: "My grandmother used to make something like this.",
  },
  {
    id: "yuki",
    name: "Yuki",
    avatarEmoji: "👩‍🦰",
    greeting: "Clean and simple, exactly as it should be.",
  },
  { id: "amir", name: "Amir", avatarEmoji: "🧑‍🦱", greeting: "Table for one, appetite for more." },
  {
    id: "rosa",
    name: "Rosa",
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
    name: "Sana",
    avatarEmoji: "🧕",
    greeting: "I heard good things about this place.",
  },
  { id: "noah", name: "Noah", avatarEmoji: "👦", greeting: "Can I get my favourite again?" },
];

export function randomCustomer(rand: () => number = Math.random): CustomerDefinition {
  return CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)] ?? CUSTOMERS[0]!;
}

export function getCustomer(id: string): CustomerDefinition | undefined {
  return CUSTOMERS.find((c) => c.id === id);
}
