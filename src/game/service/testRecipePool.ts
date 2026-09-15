/**
 * TEST_RECIPE_POOL — Phase 2's controlled proof-of-concept pool (brief
 * §22): "approximately 6-10 real recipe definitions... NOT the final
 * 150-180 recipe library... do not create fake 'Dish 001' content."
 *
 * Seven real, honestly-authored KnifeCraft-style dishes, each one
 * deliberately chosen to exercise one of §22's checklist items — every
 * ingredient/technique/resultingState combination and `unlockLevel`
 * here matches where that ingredient is genuinely first taught in the
 * existing 120-level campaign (see the comment on each recipe), so this
 * pool never offers a locked ingredient (§22 of the earlier brief —
 * "no impossible orders").
 *
 *   1. single-ingredient          — Sliced Cucumber Plate
 *   2. two-ingredient             — Tomato & Onion Salad
 *   3. multiple techniques        — Garlic Mushroom Bowl (chop + slice)
 *   4. involves herbs             — Basil Bruschetta (chiffonade)
 *   5. batchable                  — Garden Tomato Bowl (shares "tomato,
 *                                    dice" with #2 — see ServiceManager's
 *                                    sharesComponentWithNext)
 *   6. shared output              — Family Bruschetta for Two (one
 *                                    toasted-bread batch, two plates —
 *                                    §24)
 *   7. branching                  — Chicken Two Ways (one ingredient,
 *                                    two independent cuts, two
 *                                    destinations — §26)
 *
 * `cuisineId` is set honestly here (unlike deriveRecipeFromLevel's
 * `null`) because these are freshly authored for this pool, not
 * retroactively relabeled campaign content.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";

export const TEST_RECIPE_POOL: RecipeDefinition[] = [
  {
    id: "service-cucumber-plate",
    name: "Sliced Cucumber Plate",
    emoji: "🥒",
    cuisineId: null,
    authenticity: "B",
    components: [
      {
        ingredientId: "cucumber",
        technique: "slice",
        resultingState: "sliced",
        destinationIds: ["plate"],
      },
    ],
    destinations: [{ id: "plate", name: "Plate" }],
    batchable: false,
    chefInstruction: "Slice the cucumber into clean, even rounds.",
    customerDialogue: "Something light and simple today, please.",
    basePayment: 60,
    unlockLevel: 2, // cucumber — Level 2
  },
  {
    id: "service-tomato-onion-salad",
    name: "Tomato & Onion Salad",
    emoji: "🥗",
    cuisineId: "mediterranean",
    authenticity: "B",
    components: [
      {
        ingredientId: "tomato",
        technique: "dice",
        resultingState: "diced",
        destinationIds: ["plate"],
      },
      {
        ingredientId: "onion",
        technique: "dice",
        resultingState: "diced",
        destinationIds: ["plate"],
      },
    ],
    destinations: [{ id: "plate", name: "Plate" }],
    batchable: true,
    chefInstruction: "Dice the tomato, then dice the onion the same size.",
    customerDialogue: "The garden salad, if it's fresh.",
    basePayment: 90,
    unlockLevel: 5, // onion — Level 5 (tomato is Level 1)
  },
  {
    id: "service-garlic-mushroom-bowl",
    name: "Garlic Mushroom Bowl",
    emoji: "🍄",
    cuisineId: "french",
    authenticity: "B",
    components: [
      {
        ingredientId: "garlic",
        technique: "chop",
        resultingState: "chopped",
        destinationIds: ["bowl"],
      },
      {
        ingredientId: "mushroom",
        technique: "slice",
        resultingState: "sliced",
        destinationIds: ["bowl"],
      },
    ],
    destinations: [{ id: "bowl", name: "Bowl" }],
    batchable: false,
    chefInstruction: "Chop the garlic fine, then slice the mushrooms.",
    customerDialogue: "Whatever's earthy and warm — I trust the kitchen.",
    basePayment: 100,
    unlockLevel: 14, // mushroom — Level 14 (garlic is Level 9)
  },
  {
    id: "service-basil-bruschetta",
    name: "Basil Bruschetta",
    emoji: "🍅",
    cuisineId: "italian",
    authenticity: "B",
    components: [
      {
        ingredientId: "bread",
        technique: "slice",
        resultingState: "sliced",
        destinationIds: ["plate"],
      },
      {
        ingredientId: "tomato",
        technique: "dice",
        resultingState: "diced",
        destinationIds: ["plate"],
      },
      {
        ingredientId: "basil",
        technique: "chiffonade",
        resultingState: "ribboned",
        destinationIds: ["plate"],
      },
    ],
    destinations: [{ id: "plate", name: "Plate" }],
    batchable: false,
    chefInstruction: "Slice the bread, dice the tomato, then ribbon the basil over the top.",
    customerDialogue: "Bruschetta, the way it's meant to be.",
    basePayment: 130,
    unlockLevel: 31, // bread — Level 31 (basil is Level 11, tomato Level 1)
  },
  {
    id: "service-garden-tomato-bowl",
    name: "Garden Tomato Bowl",
    emoji: "🥣",
    cuisineId: "mediterranean",
    authenticity: "B",
    // Deliberately shares "tomato, dice" with service-tomato-onion-salad
    // above (§19/§25 — a real batching opportunity the order generator
    // and ServiceManager.sharesComponentWithNext can detect when the two
    // land back-to-back as current/next).
    components: [
      {
        ingredientId: "tomato",
        technique: "dice",
        resultingState: "diced",
        destinationIds: ["bowl"],
      },
      {
        ingredientId: "cucumber",
        technique: "slice",
        resultingState: "sliced",
        destinationIds: ["bowl"],
      },
    ],
    destinations: [{ id: "bowl", name: "Bowl" }],
    batchable: true,
    chefInstruction: "Dice the tomato — the same cut as the salad — then slice the cucumber.",
    customerDialogue: "A garden bowl, please, extra tomato.",
    basePayment: 90,
    unlockLevel: 5,
  },
  {
    id: "service-family-bruschetta",
    name: "Family Bruschetta for Two",
    emoji: "🍞",
    cuisineId: "italian",
    authenticity: "B",
    // §24's own example, reshaped to this project's real ingredients:
    // ONE toasted-bread batch and ONE tomato batch, each assigned to
    // BOTH diners' plates at once — a genuine shared PreparedOutput,
    // not two duplicated ones.
    components: [
      {
        ingredientId: "bread",
        technique: "slice",
        resultingState: "sliced",
        destinationIds: ["plate-a", "plate-b"],
      },
      {
        ingredientId: "tomato",
        technique: "dice",
        resultingState: "diced",
        destinationIds: ["plate-a", "plate-b"],
      },
    ],
    destinations: [
      { id: "plate-a", name: "Maya's Plate" },
      { id: "plate-b", name: "Daniel's Plate" },
    ],
    batchable: false,
    chefInstruction:
      "One batch, split evenly — slice the bread and dice the tomato once for both plates.",
    customerDialogue: "We're sharing tonight — one plate each, please.",
    basePayment: 150,
    unlockLevel: 31,
  },
  {
    id: "service-chicken-two-ways",
    name: "Chicken Two Ways",
    emoji: "🍗",
    cuisineId: "chinese",
    authenticity: "B",
    // §26's own branching example: one ingredient, two independent
    // cuts, two destinations — chainBreak on the second component
    // because it's a fresh chicken breast, not a continuation of the
    // first cut (mirrors the existing Levels-81-100 precedent).
    components: [
      {
        ingredientId: "chicken",
        technique: "slice",
        resultingState: "sliced",
        destinationIds: ["salad"],
      },
      {
        ingredientId: "chicken",
        technique: "dice",
        resultingState: "diced",
        destinationIds: ["bowl"],
        chainBreak: true,
      },
    ],
    destinations: [
      { id: "salad", name: "Salad" },
      { id: "bowl", name: "Bowl" },
    ],
    batchable: false,
    chefInstruction:
      "Slice one portion of chicken for the salad, then dice a fresh portion for the bowl.",
    customerDialogue: "Prepare the chicken, then split it between the two dishes.",
    basePayment: 160,
    unlockLevel: 101, // chicken — Level 101
  },
];
