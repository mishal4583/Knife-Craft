/**
 * The Festival Competition's pictures (public/festival, cut by scripts/make-festival-assets.py from the developer's Codex art) and the names its
 * words use. Rival chefs use the game's own portraits (game/chefArt.ts). The stations are drawn in code until the Burger kit arrives.
 */
import type { FoodId } from "@/game/festival/types";

export const festivalUrl = (name: string) => `${import.meta.env.BASE_URL}festival/${name}.webp`;
export const gameUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** The four customers drawn in four moods. */
export const PEOPLE = ["elderly-woman", "office-man", "student-woman", "tourist-man"] as const;
export type Mood = "happy" | "neutral" | "impatient" | "excited";
export const personUrl = (look: number, mood: Mood) =>
  festivalUrl(`people/${PEOPLE[look % PEOPLE.length]}-${mood}`);

/** The mood a waiting customer shows for the patience left (0-1). */
export const moodFor = (left: number): Mood =>
  left > 0.6 ? "happy" : left > 0.3 ? "neutral" : "impatient";

export const FOOD_NAMES: Record<FoodId, string> = {
  bun: "Bun",
  patty: "Patty",
  chicken: "Chicken",
  cheese: "Cheese",
  lettuce: "Lettuce",
  tomato: "Tomato",
  onion: "Onion",
  pickles: "Pickles",
  fries: "Fries",
  cola: "Cola",
  milkshake: "Shake",
};

/** The foods with a painted picture (the others are drawn in code). */
export const FOOD_PICTURES: Partial<Record<FoodId, string>> = {
  bun: "burger/bun-top",
  patty: "burger/patty",
  chicken: "burger/chicken",
  cheese: "burger/cheese",
  lettuce: "burger/lettuce",
  tomato: "burger/tomato",
  onion: "burger/onion",
  pickles: "burger/pickles",
  fries: "burger/fries",
  milkshake: "burger/milkshake",
};

/** Every picture the round shows, loaded before it starts. */
export const ROUND_PICTURES: readonly string[] = [
  "burger/backdrop",
  ...Object.values(FOOD_PICTURES),
  "ui/star",
  "ui/smoke",
  "ui/hand",
  "ui/power-patience",
  "ui/power-instant",
  "ui/power-freeze",
];
