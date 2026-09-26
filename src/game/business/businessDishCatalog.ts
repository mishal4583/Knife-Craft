/**
 * BUSINESS_DISH_CATALOG — Economy V3 Phase 14, Checkpoint 2. The
 * customer-FACING Business Mode menu — deliberately separate from
 * `CAMPAIGN_RECIPES`, never a second recipe/preparation registry. A
 * `BusinessDish` is a thin wrapper: it names a REAL culinary dish for
 * the Business Mode customer, and points at the ONE existing
 * `RecipeDefinition` (via `sourceRecipeId`) that already, honestly
 * supports it — the exact same ingredients, exact same
 * components/preparation steps a Campaign player would cut. Nothing
 * here duplicates a component list, a technique, or a price formula;
 * every derived number (food cost, price, margin) is computed by
 * looking the source recipe up in `CAMPAIGN_RECIPES` and calling
 * `businessMenu.ts`'s own existing functions — never a second cost/
 * pricing engine. Campaign's own `CAMPAIGN_RECIPES` entries (their
 * ids, names, components) are never modified by anything in this file.
 *
 * CURATION METHODOLOGY (why 34 dishes out of 109 authenticity:"A"
 * candidates): "A" means "authentic enough for the ingredients
 * KnifeCraft actually has" (recipeTypes.ts's own doc) — a necessary but
 * NOT sufficient bar for a customer-facing menu item. Many "A" recipes
 * are named after their own PREPARATION (a "Base", "Prep", "Paste", a
 * bare knife technique like "Chop"/"Dice"/"Julienne", or a filler
 * pattern like "X, Two Ways") rather than a dish a real customer would
 * order. Every one of the 109 candidates was checked against:
 *   1. real culinary identity — does a real, recognizable dish exist
 *      with (approximately) this name?
 *   2/3. ingredient & preparation compatibility — does the SOURCE
 *      recipe's own real component list actually, honestly produce
 *      that dish (not just superficially resemble it)?
 *   4. portion/serving plausibility
 *   5/6/7/8. whether every needed ingredient already exists in the
 *      Business ingredient domain, and whether a genuinely missing one
 *      should be added (none were needed for this catalog — every
 *      included dish's ingredients already exist).
 * A recipe missing a DEFINING ingredient for its named dish (e.g. an
 * "Onion Rings" recipe with no batter to fry, a "Gratin" with no
 * cheese/cream, a "Remoulade" with no mayo/mustard dressing, a
 * "Namasu" with no vinegar) was excluded rather than renamed onto a
 * famous dish it doesn't honestly support — see the Phase 14
 * Checkpoint 2 report for the full per-recipe reasoning on all 109
 * candidates (34 included, 75 excluded, each with a documented reason).
 *
 * Every explicitly forbidden name (Sliced Tomato Plate, Fresh Cucumber
 * Plate, Carrot Chop Bowl, Garden Tomato & Cucumber Plate, Garlic Prep,
 * Smashed Garlic, Chopped Tomato, or any other raw prep-step/knife-
 * technique name) never appears as a `name` in this catalog — those
 * recipes were excluded outright, not renamed.
 */
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import { recipeCostBasis, defaultMenuPrice, marginFor, type BusinessMenu } from "./businessMenu";

export type BusinessDishCategory = "Salad" | "Appetizer" | "Curry" | "Stir-Fry" | "Entree" | "Side";

export type BusinessDish = {
  id: string;
  /** Real, customer-facing culinary name — never a raw preparation-step or knife-technique name. */
  name: string;
  description: string;
  category: BusinessDishCategory;
  /** The existing Campaign cuisine tag on the source recipe (or null for the untagged early fundamentals) — never a new cuisine taxonomy. */
  cuisineId: string | null;
  /** The ONE existing CAMPAIGN_RECIPES id this dish's real ingredients/preparation come from. Every derived number (cost/price/margin) is computed from this recipe, never hand-typed here. */
  sourceRecipeId: string;
  /** A plain-language real-world portion description — never derived from game state, purely descriptive. */
  portion: string;
};

export const BUSINESS_DISH_CATALOG: BusinessDish[] = [
  // ───────────────────────── Salads ─────────────────────────
  {
    id: "biz-garden-salad",
    name: "Garden Salad",
    description: "Tomato, cucumber, and carrot, simply dressed — a classic house salad.",
    category: "Salad",
    cuisineId: null,
    sourceRecipeId: "camp-simple-garden-salad",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-caprese-salad",
    name: "Caprese Salad",
    description: "Tomato, fresh mozzarella, and basil — the iconic Italian classic.",
    category: "Salad",
    cuisineId: "italian",
    sourceRecipeId: "camp-caprese-plate",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-caprese-skewers",
    name: "Caprese Skewers",
    description: "Bite-sized caprese, threaded onto skewers — a favorite party appetizer.",
    category: "Appetizer",
    cuisineId: "italian",
    sourceRecipeId: "camp-caprese-skewers-batch",
    portion: "4-5 skewers (serves 1-2)",
  },
  {
    id: "biz-insalata-di-pomodoro",
    name: "Insalata di Pomodoro",
    description: "Tomato and basil, the simplest real Italian tomato salad.",
    category: "Salad",
    cuisineId: "italian",
    sourceRecipeId: "camp-italian-basil-batch-a",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-tomato-lettuce-salad",
    name: "Tomato & Lettuce Salad",
    description: "A plain, honest house salad of lettuce and tomato.",
    category: "Salad",
    cuisineId: "italian",
    sourceRecipeId: "camp-italian-lettuce-tomato",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-fennel-artichoke-salad",
    name: "Fennel & Artichoke Salad",
    description: "Shaved fennel and artichoke with lemon — a bright Roman-style antipasto salad.",
    category: "Salad",
    cuisineId: "italian",
    sourceRecipeId: "camp-italian-artichoke-fennel",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-kachumber-salad",
    name: "Kachumber Salad",
    description:
      "Cucumber, tomato, and onion with lemon and parsley — the classic South Asian/Mediterranean chopped salad.",
    category: "Salad",
    cuisineId: "mediterranean",
    sourceRecipeId: "camp-cucumber-tomato-mezze",
    portion: "1 bowl (serves 1-2)",
  },
  {
    id: "biz-thai-cucumber-salad",
    name: "Thai Cucumber Salad",
    description:
      "Cucumber and pea pods with lime, chili, and cilantro — a bright, tangy Thai side salad.",
    category: "Salad",
    cuisineId: "thai",
    sourceRecipeId: "camp-thai-cucumber-peapod",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-korean-pear-radish-salad",
    name: "Korean Pear & Radish Salad",
    description: "Crisp pear and radish with scallion — a refreshing Korean-style banchan salad.",
    category: "Side",
    cuisineId: "korean",
    sourceRecipeId: "camp-pear-radish-side",
    portion: "1 small bowl (serves 1-2, banchan-style)",
  },
  {
    id: "biz-salmon-avocado-salad",
    name: "Salmon & Avocado Salad",
    description: "Fresh salmon and avocado with lemon.",
    category: "Salad",
    cuisineId: "japanese",
    sourceRecipeId: "camp-salmon-avocado-plate",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-avocado-corn-salad",
    name: "Avocado & Corn Salad",
    description: "Avocado and corn with lime — a fresh, simple Latin-inspired salad.",
    category: "Salad",
    cuisineId: "mexican",
    sourceRecipeId: "camp-latin-avocado-3way-a",
    portion: "1 bowl (serves 1)",
  },

  // ───────────────────────── Appetizers / Breads ─────────────────────────
  {
    id: "biz-garlic-bread",
    name: "Garlic Bread",
    description: "Toasted bread rubbed with garlic — the classic Italian-American starter.",
    category: "Appetizer",
    cuisineId: "italian",
    sourceRecipeId: "camp-garlic-bread",
    portion: "1 shared plate (serves 2)",
  },
  {
    id: "biz-tomato-bruschetta",
    name: "Tomato Bruschetta",
    description: "Grilled bread rubbed with garlic, topped with tomato and basil.",
    category: "Appetizer",
    cuisineId: "italian",
    sourceRecipeId: "camp-bruschetta-trio",
    portion: "1 shared plate, 4-5 pieces (serves 2)",
  },
  {
    id: "biz-tomato-basil-crostini",
    name: "Tomato Basil Crostini",
    description: "Small toasted bread rounds topped with tomato and basil.",
    category: "Appetizer",
    cuisineId: "italian",
    sourceRecipeId: "camp-tomato-basil-toast",
    portion: "1 shared plate, 4-5 pieces (serves 2)",
  },
  {
    id: "biz-mushroom-bruschetta",
    name: "Mushroom Bruschetta",
    description: "Grilled bread rubbed with garlic, topped with sautéed mushroom.",
    category: "Appetizer",
    cuisineId: "italian",
    sourceRecipeId: "camp-mushroom-bruschetta",
    portion: "1 shared plate, 4-5 pieces (serves 2)",
  },
  {
    id: "biz-sauteed-garlic-mushrooms",
    name: "Sautéed Garlic Mushrooms",
    description: "Mushrooms sautéed with garlic — a simple, classic side or starter.",
    category: "Side",
    cuisineId: "french",
    sourceRecipeId: "camp-mushroom-garlic-saute-prep",
    portion: "1 side dish (serves 1-2)",
  },
  {
    id: "biz-asparagus-persillade",
    name: "Asparagus Persillade",
    description: "Asparagus finished with persillade — a garlic-parsley French bistro classic.",
    category: "Side",
    cuisineId: "french",
    sourceRecipeId: "camp-asparagus-persillade-cup",
    portion: "1 side dish (serves 1)",
  },

  // ───────────────────────── Curries (Indian) ─────────────────────────
  {
    id: "biz-spinach-curry",
    name: "Spinach Curry",
    description: "Spinach simmered with onion and ginger — a simple saag-style curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-spinach-curry",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-cauliflower-curry",
    name: "Cauliflower Curry",
    description: "Cauliflower simmered with onion, tomato, and ginger — a Gobi Masala-style curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-cauliflower-curry",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-potato-curry",
    name: "Potato Curry",
    description: "Potato and tomato simmered with ginger — an Aloo-style curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-potato-tomato-curry",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-pea-tomato-curry",
    name: "Pea & Tomato Curry",
    description: "Peas and tomato simmered with ginger — a Matar-style curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-pea-tomato-curry",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-pumpkin-coconut-curry",
    name: "Pumpkin Coconut Curry",
    description: "Pumpkin simmered with coconut and ginger — a warming South Asian-style curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-pumpkin-coconut-curry",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-eggplant-masala",
    name: "Eggplant Masala",
    description: "Eggplant simmered with onion, ginger, and chili — a Baingan Masala-style curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-eggplant-masala-prep",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-tomato-chicken-curry",
    name: "Tomato Chicken Curry",
    description: "Chicken simmered with tomato and ginger — a simple everyday curry.",
    category: "Curry",
    cuisineId: "indian",
    sourceRecipeId: "camp-indian-tomato-3way-a",
    portion: "1 bowl (serves 1)",
  },

  // ───────────────────────── Stir-Fries (Chinese) ─────────────────────────
  {
    id: "biz-tofu-broccoli-stirfry",
    name: "Tofu & Broccoli Stir-Fry",
    description: "Tofu and broccoli, wok-tossed — a staple of Chinese-American menus.",
    category: "Stir-Fry",
    cuisineId: "chinese",
    sourceRecipeId: "camp-tofu-broccoli-bowl",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-chicken-broccoli",
    name: "Chicken & Broccoli",
    description:
      "Chicken and broccoli, wok-tossed with scallion — an iconic Chinese-American classic.",
    category: "Stir-Fry",
    cuisineId: "chinese",
    sourceRecipeId: "camp-chicken-broccoli-plate",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-green-bean-tofu-stirfry",
    name: "Green Bean & Tofu Stir-Fry",
    description:
      "Green beans and tofu, wok-tossed with scallion — a Sichuan-style dry-fried classic.",
    category: "Stir-Fry",
    cuisineId: "chinese",
    sourceRecipeId: "camp-green-bean-tofu-wok-bowl",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-black-pepper-chicken",
    name: "Black Pepper Chicken",
    description:
      "Chicken wok-tossed with black pepper and ginger — a common Chinese takeout favorite.",
    category: "Stir-Fry",
    cuisineId: "chinese",
    sourceRecipeId: "camp-fusion2-pepper-batch-a",
    portion: "1 bowl (serves 1)",
  },
  {
    id: "biz-garlic-chicken",
    name: "Garlic Chicken",
    description: "Chicken wok-tossed with garlic and scallion — a common Chinese takeout favorite.",
    category: "Stir-Fry",
    cuisineId: "chinese",
    sourceRecipeId: "camp-fusion2-garlic-3way-a",
    portion: "1 bowl (serves 1)",
  },

  // ───────────────────────── Entrées ─────────────────────────
  {
    id: "biz-salmon-sashimi",
    name: "Salmon Sashimi",
    description: "Fresh salmon, simply sliced — the essence of sashimi.",
    category: "Entree",
    cuisineId: "japanese",
    sourceRecipeId: "camp-salmon-slice-intro",
    portion: "5-6 slices (serves 1)",
  },
  {
    id: "biz-salmon-asparagus",
    name: "Salmon with Asparagus",
    description: "Salmon served with asparagus and lemon — a classic simple entrée.",
    category: "Entree",
    cuisineId: "french",
    sourceRecipeId: "camp-french-salmon-asparagus",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-salmon-persillade",
    name: "Salmon Persillade",
    description: "Salmon finished with persillade — a garlic-parsley French bistro classic.",
    category: "Entree",
    cuisineId: "french",
    sourceRecipeId: "camp-salmon-persillade",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-thai-basil-chicken",
    name: "Thai Basil Chicken",
    description:
      "Chicken stir-fried with Thai basil, garlic, onion, and chili — the iconic Pad Kra Pao.",
    category: "Entree",
    cuisineId: "thai",
    sourceRecipeId: "camp-thai-chicken-basil",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-thai-basil-salmon",
    name: "Thai Basil Salmon",
    description: "Salmon stir-fried with Thai basil and garlic — a fish variation on the classic.",
    category: "Entree",
    cuisineId: "thai",
    sourceRecipeId: "camp-thai-aromatic-batch-b",
    portion: "1 plate (serves 1)",
  },
  {
    id: "biz-greek-lemon-chicken",
    name: "Greek Lemon Chicken",
    description: "Chicken finished with lemon — a classic Greek preparation (Kotopoulo Lemonato).",
    category: "Entree",
    cuisineId: "mediterranean",
    sourceRecipeId: "camp-med-lemon-3way-b",
    portion: "1 plate (serves 1)",
  },
];

function requireSourceRecipe(dish: BusinessDish) {
  const recipe = getCampaignRecipe(dish.sourceRecipeId);
  if (!recipe) {
    throw new Error(
      `BusinessDish ${dish.id} references unknown source recipe ${dish.sourceRecipeId}`,
    );
  }
  return recipe;
}

export function getBusinessDish(id: string): BusinessDish | undefined {
  return BUSINESS_DISH_CATALOG.find((d) => d.id === id);
}

/** Every real ingredient this dish actually requires, deduplicated — read straight from the source recipe's own components, never a second ingredient list. */
export function businessDishIngredients(dish: BusinessDish): string[] {
  const recipe = requireSourceRecipe(dish);
  return [...new Set(recipe.components.map((c) => c.ingredientId))];
}

/** Whole US cents — delegates to businessMenu.ts's own recipeCostBasis against the source recipe. Never a second cost calculation. */
export function businessDishFoodCost(dish: BusinessDish): number {
  return recipeCostBasis(requireSourceRecipe(dish));
}

/** Whole US cents — delegates to businessMenu.ts's own defaultMenuPrice/menuPriceFor against the source recipe, honoring a player-set override exactly like the existing Menu screen does. */
export function businessDishPrice(menu: BusinessMenu, dish: BusinessDish): number {
  const recipe = requireSourceRecipe(dish);
  return menu[recipe.id] ?? defaultMenuPrice(recipe);
}

/** Delegates entirely to businessMenu.ts's own marginFor — never a second margin formula. */
export function businessDishMargin(menu: BusinessMenu, dish: BusinessDish) {
  return marginFor(menu, requireSourceRecipe(dish));
}
