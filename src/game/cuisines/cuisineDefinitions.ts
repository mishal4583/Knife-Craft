/**
 * CUISINE_DEFINITIONS — the 9 core cuisine families, populated verbatim
 * from the restaurant-service brief's §16 signature tables. See
 * cuisineTypes.ts for what a cuisine is (and isn't) allowed to do.
 *
 * `chapterStart` follows §17's chapter map:
 *   2  Italian Kitchen        11 Japanese Kitchen
 *   4  French Bistro          13 Chinese Kitchen
 *   6  Indian Kitchen         15 Thai Kitchen
 *   8  Mediterranean & Levant 17 Korean Kitchen
 *   9  Mexican & Latin Kitchen
 * Chapter 1 has no cuisine identity yet (§3 of Chapter 1's brief —
 * fundamentals only). Chapters 18-25 reuse these 9 families rather than
 * introducing new ones (§17's own chapter notes).
 */
import type { CuisineDefinition, CuisineId } from "./cuisineTypes";

export const CUISINES: Record<CuisineId, CuisineDefinition> = {
  italian: {
    id: "italian",
    name: "Italian",
    signatureTechniques: ["slice", "dice", "chop", "rings", "chiffonade"],
    coreIngredients: [
      "tomato",
      "basil",
      "garlic",
      "bread",
      "baguette",
      "mozzarella",
      "mushroom",
      "zucchini",
      "eggplant",
      "artichoke",
      "fennel",
      "asparagus",
    ],
    identity: "Bright, herb-forward preparation — the board a trattoria kitchen actually runs on.",
    chapterStart: 2,
  },
  french: {
    id: "french",
    name: "French",
    signatureTechniques: ["dice", "julienne", "chiffonade", "slice"],
    coreIngredients: [
      "butter",
      "mushroom",
      "potato",
      "carrot",
      "celery",
      "turnip",
      "asparagus",
      "spinach",
      "fennel",
      "baguette",
    ],
    identity: "Precision and consistency — uniform dice, clean julienne, elegant bistro plating.",
    chapterStart: 4,
  },
  indian: {
    id: "indian",
    name: "Indian",
    signatureTechniques: ["peel", "smash", "rockMince", "dice", "chop"],
    coreIngredients: [
      "potato",
      "onion",
      "garlic",
      "tomato",
      "carrot",
      "cauliflower",
      "spinach",
      "peapod",
      "pumpkin",
      "chicken",
      "mango",
      "coconut",
    ],
    identity: "Aromatic bases — garlic, onion, tomato, and herbs prepped with everyday confidence.",
    chapterStart: 6,
  },
  mediterranean: {
    id: "mediterranean",
    name: "Mediterranean / Levant",
    signatureTechniques: ["chop", "dice", "slice", "rings"],
    coreIngredients: [
      "cucumber",
      "tomato",
      "eggplant",
      "lemon",
      "parsley",
      "garlic",
      "bread",
      "baguette",
      "avocado",
      "pomegranate",
      "chicken",
      "salmon",
    ],
    identity: "Shared plates — fresh vegetables, lemon, herbs, and bread built for branching prep.",
    chapterStart: 8,
  },
  mexican: {
    id: "mexican",
    name: "Mexican / Latin",
    signatureTechniques: ["dice", "chop", "slice", "julienne"],
    coreIngredients: [
      "corn",
      "avocado",
      "tomato",
      "pepper",
      "onion",
      "lemon",
      "pineapple",
      "mango",
      "chicken",
      "beetroot",
      "sweetpotato",
    ],
    identity: "Texture contrast and colour — fresh combinations allocated across multiple dishes.",
    chapterStart: 9,
  },
  japanese: {
    id: "japanese",
    name: "Japanese",
    signatureTechniques: ["slice", "julienne"],
    coreIngredients: [
      "salmon",
      "tofu",
      "mushroom",
      "cucumber",
      "radish",
      "spinach",
      "cabbage",
      "carrot",
      "peapod",
      "avocado",
    ],
    identity: "Clean cuts, uniform preparation, minimal presentation.",
    chapterStart: 11,
  },
  chinese: {
    id: "chinese",
    name: "Chinese",
    signatureTechniques: ["julienne", "slice", "dice"],
    coreIngredients: [
      "chicken",
      "steak",
      "tofu",
      "broccoli",
      "cabbage",
      "cauliflower",
      "carrot",
      "pepper",
      "peapod",
      "mushroom",
      "spinach",
    ],
    identity: "Wok-ready batches — uniform cuts across several ingredients, grouped for the pan.",
    chapterStart: 13,
  },
  thai: {
    id: "thai",
    name: "Thai / Southeast Asian",
    signatureTechniques: ["chop", "slice", "julienne", "rockMince"],
    coreIngredients: [
      "chicken",
      "salmon",
      "coconut",
      "mango",
      "pineapple",
      "basil",
      "garlic",
      "greenbean",
      "pepper",
      "peapod",
      "cucumber",
    ],
    identity:
      "Aromatic, sweet-and-fresh contrast — herbs and coconut alongside branching components.",
    chapterStart: 15,
  },
  korean: {
    id: "korean",
    name: "Korean",
    signatureTechniques: ["slice", "julienne", "dice"],
    coreIngredients: [
      "steak",
      "chicken",
      "mushroom",
      "cabbage",
      "spinach",
      "carrot",
      "garlic",
      "onion",
      "greenbean",
      "pear",
    ],
    identity:
      "Thin, even protein cuts alongside vegetable prep, shared across a multi-destination service.",
    chapterStart: 17,
  },
};

export const CUISINE_LIST: CuisineDefinition[] = Object.values(CUISINES);

export function cuisineForChapter(chapter: number): CuisineDefinition | null {
  // Highest chapterStart <= chapter — chapters between two starts (e.g.
  // 3, the second Italian chapter) still belong to the last cuisine that
  // began. Chapter 1 and any chapter before the first start (none today)
  // return null (§3 — no cuisine identity yet).
  const candidates = CUISINE_LIST.filter((c) => c.chapterStart <= chapter);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.chapterStart > best.chapterStart ? c : best));
}
