/**
 * PHASE 1 SMOKE TEST — one-off, run-and-delete-style verification for the
 * new restaurant-service architecture (recipes/cuisines/chefs/customers/
 * service). Not a permanent test suite (none exists in this repo yet);
 * mirrors the ad-hoc pure-logic assertion technique already used
 * elsewhere in this project's development. Run with:
 *   node --experimental-strip-types scripts/phase1-smoke-test.mts
 */
import { RECIPE_LIST, getRecipe, recipesUnlockedByLevel } from "../src/game/recipes/recipeDefinitions.ts";
import { destinationsForRecipe, sessionForRecipe, isRecipeReady } from "../src/game/service/RecipeValidator.ts";
import { createPreparedOutput, assignOutput } from "../src/game/organization/organizationManager.ts";
import { generateOrder } from "../src/game/service/OrderGenerator.ts";
import { createCustomerOrder, advanceOrder, payOrder } from "../src/game/service/CustomerOrderManager.ts";
import { CUISINE_LIST, cuisineForChapter } from "../src/game/cuisines/cuisineDefinitions.ts";
import { CHEF_LIST, chefsUnlockedByLevel } from "../src/game/chefs/chefDefinitions.ts";
import { CUSTOMERS, randomCustomer } from "../src/game/customers/customerDefinitions.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// 1. Every existing level has a real, derived recipe.
assert(RECIPE_LIST.length === LEVELS.length, `RECIPE_LIST has one entry per level (${RECIPE_LIST.length}/${LEVELS.length})`);
assert(getRecipe(LEVELS[0]!.recipeId) !== undefined, "getRecipe finds Level 1's recipe by recipeId");
assert(getRecipe("does-not-exist") === undefined, "getRecipe returns undefined for an unknown id");

// 2. Cuisines/chefs: exactly 9 each, chapter mapping sane.
assert(CUISINE_LIST.length === 9, `exactly 9 cuisines (${CUISINE_LIST.length})`);
assert(CHEF_LIST.length === 9, `exactly 9 chefs (${CHEF_LIST.length})`);
assert(cuisineForChapter(1) === null, "Chapter 1 has no cuisine identity");
assert(cuisineForChapter(2)?.id === "italian", "Chapter 2 maps to Italian");
assert(cuisineForChapter(3)?.id === "italian", "Chapter 3 (still Italian) maps to Italian");
assert(cuisineForChapter(17)?.id === "korean", "Chapter 17 maps to Korean");
assert(chefsUnlockedByLevel(19).length === 0, "no chef unlocked before level 20");
assert(chefsUnlockedByLevel(20).length === 1, "exactly 1 chef unlocked at level 20");
assert(chefsUnlockedByLevel(180).length === 9, "all 9 chefs unlocked by level 180");

// 3. RecipeValidator, built on the existing organizationManager, actually
//    gates readiness correctly for a real multi-step recipe.
const multiStepRecipe = RECIPE_LIST.find((r) => r.components.length > 1);
assert(!!multiStepRecipe, "at least one derived recipe has multiple components (batching precedent exists)");
if (multiStepRecipe) {
  let session = sessionForRecipe(multiStepRecipe);
  assert(!isRecipeReady(session), "a fresh session for a multi-step recipe is not ready");
  for (const component of multiStepRecipe.components) {
    const created = createPreparedOutput(session, {
      ingredientId: component.ingredientId,
      preparationState: component.resultingState,
    });
    session = assignOutput(created.session, created.output.id, component.destinationId);
  }
  assert(isRecipeReady(session), "session becomes ready once every component is prepared and assigned");
}

// 4. Single-step recipe: ready after exactly one prepared+assigned output.
const singleStepRecipe = RECIPE_LIST.find((r) => r.components.length === 1);
if (singleStepRecipe) {
  const dest = destinationsForRecipe(singleStepRecipe)[0]!;
  let session = sessionForRecipe(singleStepRecipe);
  const c = singleStepRecipe.components[0]!;
  const created = createPreparedOutput(session, { ingredientId: c.ingredientId, preparationState: c.resultingState });
  session = assignOutput(created.session, created.output.id, dest.id);
  assert(isRecipeReady(session), "single-step recipe is ready after one prepared+assigned output");
}

// 5. Shared-ingredient / branching: ONE prepared output can satisfy TWO destinations at once (§20/§21).
const branchRecipe: (typeof RECIPE_LIST)[number] = {
  ...RECIPE_LIST[0]!,
  id: "test-branch",
  destinations: [
    { id: "salad", name: "Salad" },
    { id: "bowl", name: "Bowl" },
  ],
  components: [
    { ingredientId: "chicken", technique: "slice", resultingState: "sliced", destinationId: "salad" },
    { ingredientId: "chicken", technique: "slice", resultingState: "sliced", destinationId: "bowl" },
  ],
};
{
  let session = sessionForRecipe(branchRecipe);
  const created = createPreparedOutput(session, { ingredientId: "chicken", preparationState: "sliced" });
  session = assignOutput(created.session, created.output.id, "salad");
  session = assignOutput(session, created.output.id, "bowl");
  assert(isRecipeReady(session), "one prepared output assigned to two destinations satisfies both (shared-ingredient branching)");
}

// 6. OrderGenerator: never returns null for a non-empty pool; never returns a locked recipe.
const unlocked = recipesUnlockedByLevel(10);
assert(unlocked.length > 0 && unlocked.every((r) => r.unlockLevel <= 10), "recipesUnlockedByLevel(10) excludes anything above level 10");
let sawImpossible = false;
for (let i = 0; i < 200; i++) {
  const picked = generateOrder({ unlockedRecipes: unlocked, recentRecipeIds: [], recentCuisineIds: [] });
  if (!picked || picked.unlockLevel > 10) sawImpossible = true;
}
assert(!sawImpossible, "generateOrder never returns null or a locked recipe from a valid pool (200 draws)");

// 7. Order state machine: linear, payment exactly once.
const recipe = RECIPE_LIST[0]!;
const customer = randomCustomer(() => 0);
assert(CUSTOMERS.includes(customer), "randomCustomer returns a real roster entry");
let order = createCustomerOrder(customer.id, recipe);
assert(order.status === "PENDING", "new order starts PENDING");
order = advanceOrder(order); // ACTIVE
order = advanceOrder(order); // PREPARING
order = advanceOrder(order); // READY
order = advanceOrder(order); // SERVED
assert(order.status === "SERVED", "order reaches SERVED after 4 advances");
const paid1 = payOrder(order);
assert(paid1.coinsAwarded === recipe.basePayment, "payOrder pays exactly the recipe's basePayment on SERVED->PAID");
const paid2 = payOrder(paid1.order);
assert(paid2.coinsAwarded === 0, "paying an already-PAID order awards 0 (never pays twice)");
const paid3 = payOrder(createCustomerOrder(customer.id, recipe));
assert(paid3.coinsAwarded === 0, "paying a PENDING order (not yet SERVED) awards 0");

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
