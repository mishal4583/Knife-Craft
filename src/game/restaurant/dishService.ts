/**
 * HOW A DISH IS COOKED AND SERVED (supplies plan, developer 2026-10-10:
 * "use everything when necessary") — derived from the recipe alone, never
 * stored. One reading shared by the kitchen tools a dish needs
 * (kitchenTools.ts), the tableware it is served on and the takeaway
 * packaging it leaves in.
 *
 *  - `kind`: the cooking clip's reading (recipes/dishKind.ts) — fruit,
 *    salad, curry (pots, soups, sauces), bread, cooked, plated.
 *  - `cooking`: what happens on the stove / in the oven:
 *      oven  — bread, toast, crostini, gratin;
 *      fry   — rings, fajita, hash (a frying pan with oil);
 *      pot   — soups, curries, masalas, chutneys, bases;
 *      saute — sautés, duxelles, persillade, wok / stir-fry plates;
 *      grill — chicken, steak, salmon (seared or grilled);
 *  - `protein`: chicken / steak / salmon (or null);
 *  - `cheese`: mozzarella / cheddar (grated or sliced to order);
 *  - `skewer`: skewers (toothpicks);
 *  - `shared`: boards and plates "for Two" / "for the House";
 *  - `messy`: eaten with fingers or sauce — curries, fried, skewers.
 *
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { dishKindFor, type DishKind } from "../recipes/dishKind";

export type Cooking = "oven" | "fry" | "pot" | "saute" | "grill";

export type DishService = {
  kind: DishKind;
  cooking: readonly Cooking[];
  protein: "chicken" | "steak" | "salmon" | null;
  cheese: boolean;
  skewer: boolean;
  shared: boolean;
  messy: boolean;
};

const OVEN_NAME = /bread|toast|bruschetta|crostini|baguette|gratin|rounds/i;
const FRY_NAME = /fajita|hash/i;
const SAUTE_NAME = /saut|duxelles|persillade|wok|stir/i;
const SKEWER_NAME = /skewer/i;
const SHARED_NAME = /for two|for the house|board|sampler|grand service plate/i;
const CHEESE = new Set(["mozzarella", "cheddar"]);
const PROTEIN = new Set(["chicken", "steak", "salmon"]);

const cache = new Map<string, DishService>();

/** How `recipe` is cooked and served (derived; cached per recipe id). */
export function dishServiceFor(recipe: RecipeDefinition): DishService {
  const hit = cache.get(recipe.id);
  if (hit) return hit;
  const kind = dishKindFor(recipe.id, recipe.name);
  const ids = recipe.components.map((c) => c.ingredientId as string);
  const techniques = recipe.components.map((c) => c.technique as string);
  const protein = (ids.find((id) => PROTEIN.has(id)) ?? null) as DishService["protein"];
  const cooking = new Set<Cooking>();
  if (kind === "bread" || OVEN_NAME.test(recipe.name)) cooking.add("oven");
  if (techniques.includes("rings") || FRY_NAME.test(recipe.name)) cooking.add("fry");
  if (kind === "curry") cooking.add("pot");
  if (SAUTE_NAME.test(recipe.name)) cooking.add("saute");
  if (protein) cooking.add("grill");
  const skewer = SKEWER_NAME.test(recipe.name);
  const service: DishService = {
    kind,
    cooking: [...cooking],
    protein,
    cheese: ids.some((id) => CHEESE.has(id)),
    skewer,
    shared: SHARED_NAME.test(recipe.name),
    messy: kind === "curry" || cooking.has("fry") || skewer,
  };
  cache.set(recipe.id, service);
  return service;
}
