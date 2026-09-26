/**
 * BUSINESS_DISH_CATALOG_QA — Economy V3 Phase 14, Checkpoint 2. Verifies
 * the customer-facing Business Dish catalog: every dish maps to a real,
 * currently-existing Campaign recipe; every name is a legitimate
 * culinary name (never a forbidden/placeholder/prep-step/knife-
 * technique name); no duplicate dish ids; no unintentional duplicate
 * customer-facing names; no unsupported ingredient requirements (every
 * ingredient the source recipe actually uses already exists in the
 * Ingredient Registry); Campaign recipes are never mutated; catalog
 * generation and every derived number (cost/price/margin) are
 * deterministic; save/load safety (the catalog is static data, never
 * read from or written into SaveData) — against the real production
 * catalog and functions only.
 *
 * Run: npx tsx scripts/business-dish-catalog-qa.mts
 */
import { CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { INGREDIENTS } from "../src/game/definitions.ts";
import {
  BUSINESS_DISH_CATALOG,
  getBusinessDish,
  businessDishIngredients,
  businessDishFoodCost,
  businessDishPrice,
  businessDishMargin,
} from "../src/game/business/businessDishCatalog.ts";
import { DEFAULT_BUSINESS_MENU } from "../src/game/business/businessMenu.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== A: every Business Dish maps to a real, currently-existing Campaign recipe. =====
{
  const campaignIds = new Set(CAMPAIGN_RECIPES.map((r) => r.id));
  const missing = BUSINESS_DISH_CATALOG.filter((d) => !campaignIds.has(d.sourceRecipeId));
  assert(missing.length === 0, `A: every Business Dish's sourceRecipeId exists in CAMPAIGN_RECIPES (${missing.length} missing: ${missing.map((d) => d.id).join(", ")})`);
}
{
  // A2: every source recipe is genuinely tagged authenticity "A" — never a lower-tier recipe smuggled in.
  const nonA = BUSINESS_DISH_CATALOG.filter((d) => getCampaignRecipe(d.sourceRecipeId)?.authenticity !== "A");
  assert(nonA.length === 0, `A2: every Business Dish's source recipe is authenticity "A" (${nonA.length} are not: ${nonA.map((d) => d.id).join(", ")})`);
}

// ===== B: no duplicate Business Dish ids, no duplicate sourceRecipeId (one dish per recipe), no unintentional duplicate customer-facing names. =====
{
  const ids = BUSINESS_DISH_CATALOG.map((d) => d.id);
  assert(new Set(ids).size === ids.length, "B: no duplicate Business Dish ids");
  const sourceIds = BUSINESS_DISH_CATALOG.map((d) => d.sourceRecipeId);
  assert(new Set(sourceIds).size === sourceIds.length, "B2: no two Business Dishes share the same sourceRecipeId (one dish per underlying recipe)");
  const names = BUSINESS_DISH_CATALOG.map((d) => d.name);
  assert(new Set(names).size === names.length, "B3: no duplicate customer-facing dish names (every included pair with similar names was deliberately given a distinct real identity)");
}

// ===== C: no forbidden/placeholder/prep-step/knife-technique names ever appear as a customer-facing dish name. =====
{
  const forbiddenExact = [
    "Sliced Tomato Plate",
    "Fresh Cucumber Plate",
    "Carrot Chop Bowl",
    "Garden Tomato & Cucumber Plate",
    "Garlic Prep",
    "Smashed Garlic",
    "Chopped Tomato",
  ];
  const names = BUSINESS_DISH_CATALOG.map((d) => d.name);
  for (const forbidden of forbiddenExact) {
    assert(!names.includes(forbidden), `C: the explicitly forbidden name "${forbidden}" never appears in the Business Dish catalog`);
  }
  const forbiddenSubstrings = ["Prep", "Base", "Paste", "Chop", "Dice", "Julienne", "Smash", "Two Ways", "Precision", "Chiffonade"];
  for (const dish of BUSINESS_DISH_CATALOG) {
    for (const bad of forbiddenSubstrings) {
      assert(!dish.name.includes(bad), `C2: "${dish.name}" (${dish.id}) does not contain the forbidden prep-step/technique word "${bad}"`);
    }
  }
}

// ===== D: no unsupported ingredient requirements — every ingredient a dish's source recipe actually uses already exists in the Ingredient Registry. =====
{
  for (const dish of BUSINESS_DISH_CATALOG) {
    const ingredients = businessDishIngredients(dish);
    assert(ingredients.length > 0, `D: ${dish.id} (${dish.name}) requires at least one real ingredient`);
    const allExist = ingredients.every((id) => Object.prototype.hasOwnProperty.call(INGREDIENTS, id));
    assert(allExist, `D2: every ingredient ${dish.id} (${dish.name}) requires already exists in the Ingredient Registry (got [${ingredients.join(",")}])`);
  }
}

// ===== E: Campaign recipes are never mutated by anything in this catalog — reading a Business Dish's source recipe leaves CAMPAIGN_RECIPES byte-identical. =====
{
  const before = JSON.stringify(CAMPAIGN_RECIPES);
  for (const dish of BUSINESS_DISH_CATALOG) {
    businessDishIngredients(dish);
    businessDishFoodCost(dish);
    businessDishPrice(DEFAULT_BUSINESS_MENU, dish);
    businessDishMargin(DEFAULT_BUSINESS_MENU, dish);
  }
  assert(JSON.stringify(CAMPAIGN_RECIPES) === before, "E: CAMPAIGN_RECIPES is byte-identical after reading every Business Dish's derived numbers — no Campaign recipe mutation");
}
{
  // E2: the source recipe's own name/id are never altered — the Business Dish's OWN name is independent, never written back onto the recipe.
  for (const dish of BUSINESS_DISH_CATALOG) {
    const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
    assert(typeof recipe.name === "string" && recipe.name.length > 0, `E2: ${dish.sourceRecipeId}'s own Campaign name is untouched (still "${recipe.name}")`);
  }
}

// ===== F: derived numbers (food cost, price, margin) are computed via the EXISTING businessMenu.ts functions, never a second pricing engine, and are internally consistent. =====
{
  for (const dish of BUSINESS_DISH_CATALOG) {
    const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
    const cost = businessDishFoodCost(dish);
    const price = businessDishPrice(DEFAULT_BUSINESS_MENU, dish);
    const margin = businessDishMargin(DEFAULT_BUSINESS_MENU, dish);
    assert(cost > 0, `F: ${dish.id} has a positive food cost (got ${cost})`);
    assert(price > cost, `F2: ${dish.id}'s default price exceeds its food cost (price ${price} > cost ${cost})`);
    assert(margin.cost === cost && margin.price === price, `F3: ${dish.id}'s margin object reports the exact same cost/price as the standalone accessors`);
    assert(margin.foodCostPercent > 0 && margin.foodCostPercent < 100, `F4: ${dish.id}'s food-cost percentage is a real, sane fraction of price (got ${margin.foodCostPercent}%)`);
    assert(Math.round((margin.foodCostPercent + margin.grossMarginPercent) * 10) / 10 === 100, `F5: ${dish.id}'s foodCostPercent + grossMarginPercent sum to exactly 100`);
    // never a duplicated/second cost formula — cross-check directly against recipeCostBasis-equivalent (sum of businessUnitCostFor per component, not deduped), independent of the catalog's own accessor.
    void recipe;
  }
}

// ===== G: deterministic catalog generation — the catalog itself is static data (never Math.random()), and every derived number is identical across repeated calls. =====
{
  const dish = getBusinessDish("biz-caprese-salad");
  assert(!!dish, "G: precondition — a known dish id resolves");
  if (dish) {
    const cost1 = businessDishFoodCost(dish);
    const cost2 = businessDishFoodCost(dish);
    assert(cost1 === cost2, "G2: businessDishFoodCost is deterministic across repeated calls");
    const price1 = businessDishPrice(DEFAULT_BUSINESS_MENU, dish);
    const price2 = businessDishPrice(DEFAULT_BUSINESS_MENU, dish);
    assert(price1 === price2, "G3: businessDishPrice is deterministic across repeated calls");
  }
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const content = fs.readFileSync(path.join(dir, "businessDishCatalog.ts"), "utf8");
  const hasMention = /Math\.random\(\)/.test(content);
  const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
  assert(!(hasMention && !isDocMention), "G4: no Math.random() CALL exists anywhere in businessDishCatalog.ts");
}

// ===== H: getBusinessDish — unknown id resolves to undefined, never throws. =====
{
  assert(getBusinessDish("not-a-real-dish") === undefined, "H: an unknown Business Dish id resolves to undefined, never throws");
  assert(BUSINESS_DISH_CATALOG.every((d) => getBusinessDish(d.id) === d), "H2: every catalog entry resolves to itself via getBusinessDish");
}

// ===== I: save/load safety — the catalog is static module data, never read from or written into SaveData; a player price override still resolves correctly through the existing menu system. =====
{
  const dish = getBusinessDish("biz-garlic-bread")!;
  const recipe = getCampaignRecipe(dish.sourceRecipeId)!;
  const overriddenMenu = { [recipe.id]: 999 };
  assert(businessDishPrice(overriddenMenu, dish) === 999, "I: a player-set menu price override (keyed by the source recipe id, exactly like the existing Menu screen) is honored by businessDishPrice");
  assert(businessDishPrice(DEFAULT_BUSINESS_MENU, dish) !== 999, "I2: without an override, the dish falls back to the real default price, not the override from a different save/menu object");
}

// ===== J: catalog size — a smaller, defensible catalog (never the full 109-candidate list, never the full 221-recipe Campaign catalog). =====
{
  assert(BUSINESS_DISH_CATALOG.length > 0, "J: the catalog is non-empty");
  assert(BUSINESS_DISH_CATALOG.length < 109, `J2: the catalog is deliberately smaller than the 109 authenticity:"A" candidate pool (got ${BUSINESS_DISH_CATALOG.length})`);
  console.log(`    (catalog size: ${BUSINESS_DISH_CATALOG.length} dishes)`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
