/**
 * CHEF_DEFINITIONS — the 9 cuisine chefs, one per CuisineId, at the
 * level beats §26 suggests. Purely a recipe-pool/presentation gate —
 * see chefTypes.ts's own doc for what a chef is forbidden to be.
 */
import type { ChefDefinition } from "./chefTypes";
import type { CuisineId } from "../cuisines/cuisineTypes";

export const CHEFS: Record<CuisineId, ChefDefinition> = {
  italian: {
    id: "italian",
    name: "Chef Elena",
    title: "Italian Kitchen",
    cuisineId: "italian",
    unlockLevel: 20,
    portraitEmoji: "👩‍🍳",
    introLine: "Tomatoes, basil, good bread — that's the whole secret. Let's cook.",
  },
  french: {
    id: "french",
    name: "Chef Pascal",
    title: "French Bistro",
    cuisineId: "french",
    unlockLevel: 40,
    portraitEmoji: "🧑‍🍳",
    introLine: "Precision first. A clean dice says more than a fast one ever will.",
  },
  indian: {
    id: "indian",
    name: "Chef Amara",
    title: "Indian Kitchen",
    cuisineId: "indian",
    unlockLevel: 60,
    portraitEmoji: "👩‍🍳",
    introLine: "Onion, garlic, tomato — build the base right and the rest takes care of itself.",
  },
  mediterranean: {
    id: "mediterranean",
    name: "Chef Yusuf",
    title: "Mediterranean Table",
    cuisineId: "mediterranean",
    unlockLevel: 80,
    portraitEmoji: "🧑‍🍳",
    introLine: "Shared plates, fresh cuts. Everyone at the table gets a little of everything.",
  },
  mexican: {
    id: "mexican",
    name: "Chef Marisol",
    title: "Mexican & Latin Kitchen",
    cuisineId: "mexican",
    unlockLevel: 100,
    portraitEmoji: "👩‍🍳",
    introLine: "Bright colour, bold texture. Let the board look as good as it tastes.",
  },
  japanese: {
    id: "japanese",
    name: "Chef Haruto",
    title: "Japanese Kitchen",
    cuisineId: "japanese",
    unlockLevel: 120,
    portraitEmoji: "🧑‍🍳",
    introLine: "One clean cut, every time. Nothing here hides behind a sauce.",
  },
  chinese: {
    id: "chinese",
    name: "Chef Mei",
    title: "Chinese Kitchen",
    cuisineId: "chinese",
    unlockLevel: 140,
    portraitEmoji: "👩‍🍳",
    introLine: "The wok won't wait — everything prepped, uniform, ready together.",
  },
  thai: {
    id: "thai",
    name: "Chef Anong",
    title: "Thai Kitchen",
    cuisineId: "thai",
    unlockLevel: 160,
    portraitEmoji: "👩‍🍳",
    introLine: "Sweet against fresh against sharp — balance it with the knife, not the pan.",
  },
  korean: {
    id: "korean",
    name: "Chef Jin",
    title: "Korean Kitchen",
    cuisineId: "korean",
    unlockLevel: 180,
    portraitEmoji: "🧑‍🍳",
    introLine: "Thin, even, unhurried. The cut is half the dish here.",
  },
};

export const CHEF_LIST: ChefDefinition[] = Object.values(CHEFS);

/** Every chef already introduced by the given campaign level (§26/§28 — used to gate recipe-pool access, never re-fires past intros). */
export function chefsUnlockedByLevel(level: number): ChefDefinition[] {
  return CHEF_LIST.filter((c) => c.unlockLevel <= level);
}
