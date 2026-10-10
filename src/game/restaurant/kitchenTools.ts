/**
 * KITCHEN TOOLS (supplies plan Phase A, developer 2026-10-10: "use everything
 * when necessary; ask the player to buy some important tools when the game
 * starts and the rest when necessary"). All 18 culinary smallwares in the
 * Market (businessSupplies.ts, section "culinary") are needed by the dishes
 * that really use them — a dish can't be cooked without its tools.
 *
 *  - Tools are equipment: bought once, never used up.
 *  - A tool is needed from its rule's level, when today's orders or the
 *    restaurant's active menu (the guests' dishes) contain a dish that uses
 *    it (dishService.ts). The Pre-Service Check lists what's missing and
 *    START waits (Buy → the Market on that tool; when the wallet can't pay:
 *    a rewarded ad or supplier credit, serviceCover.ts).
 *  - Grandma's old tools (peeler, mixing bowl, measuring cups) are hers to
 *    give, once, when the Market opens (Level 10) — the levels before need
 *    nothing bought. Level 10's sheet then shows the first shopping list:
 *    what the next ten levels will ask for.
 *  - Pans are per cook: from the staff stage (L41) every cook on the line
 *    (the chef, prep / line cooks, the Head Chef, specialists) needs their
 *    own frying pan, saucepan and sauté pan — a bigger kitchen buys more.
 *
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import { getLevel } from "../levels/LevelManager";
import { getSupplyItem, supplyPackPrice, type SupplyId } from "../business/businessSupplies";
import { supplyUnits } from "../business/BusinessSuppliesManager";
import { dishServiceFor, type DishService } from "./dishService";
import { inventoryMenuOf } from "./restaurantMenu";
import { restaurantStaffOf } from "./staffRequirements";
import { isSystemLive } from "./restaurantProgression";
import { FIRST_PURCHASE_LEVEL } from "./firstLevels";

export type ToolRule = {
  id: SupplyId;
  /** Needed from this level on. */
  fromLevel: number;
  /** The dishes that need it (always: every service from `fromLevel`). */
  when: "always" | ((d: DishService, recipe: RecipeDefinition) => boolean);
  /** One, or one per cook on the line (from the staff stage). */
  perCook?: boolean;
  /** Why the kitchen needs it — shown on the row. */
  why: string;
};

const has = (d: DishService, c: DishService["cooking"][number]) => d.cooking.includes(c);
const uses = (recipe: RecipeDefinition, t: string) =>
  recipe.components.some((c) => (c.technique as string) === t);

/** Every culinary smallware and the dishes that need it (supplies plan §A). */
export const TOOL_RULES: readonly ToolRule[] = [
  {
    id: "peelers",
    fromLevel: FIRST_PURCHASE_LEVEL,
    when: (_d, r) => uses(r, "peel"),
    perCook: true,
    why: "Onions, potatoes, ginger and fruit are peeled before any cut",
  },
  {
    id: "mixing-bowls",
    fromLevel: FIRST_PURCHASE_LEVEL,
    when: (d) => d.kind === "salad" || d.kind === "fruit" || d.kind === "curry",
    why: "Salads and fruit cups are tossed, bases are mixed",
  },
  {
    id: "measuring-cups",
    fromLevel: FIRST_PURCHASE_LEVEL,
    when: (d) => d.kind === "salad" || d.kind === "curry",
    why: "Dressings and pot bases are measured, every time the same",
  },
  {
    id: "sheet-pans",
    fromLevel: 11,
    when: (d) => has(d, "oven"),
    why: "Bread, toast, crostini and gratins go into the oven on a sheet pan",
  },
  {
    id: "oven-mitts",
    fromLevel: 11,
    when: (d) => has(d, "oven"),
    why: "Nothing comes out of a hot oven without oven mitts",
  },
  {
    id: "frying-pans",
    fromLevel: 16,
    when: (d) => has(d, "fry") || has(d, "grill"),
    perCook: true,
    why: "Rings, fajitas and hash fry in a pan; chicken, steak and salmon sear in one",
  },
  {
    id: "tongs",
    fromLevel: 16,
    when: (d) => has(d, "fry") || has(d, "grill"),
    why: "Hot rings and seared meat are turned with tongs, never fingers",
  },
  {
    id: "skimmers",
    fromLevel: 16,
    when: (d) => has(d, "fry"),
    why: "Fried rings are lifted out of the oil with a skimmer",
  },
  {
    id: "stock-pot",
    fromLevel: 17,
    when: (d) => has(d, "pot"),
    why: "Soups, curries and bases simmer in a stock pot",
  },
  {
    id: "ladles",
    fromLevel: 17,
    when: (d) => has(d, "pot"),
    why: "Soups and curries are served with a ladle",
  },
  {
    id: "storage-containers",
    fromLevel: 21,
    when: "always",
    why: "Prepped food is kept covered and labelled in the fridge",
  },
  {
    id: "thermometers",
    fromLevel: 21,
    when: "always",
    why: "The fridge temperature is checked every day — and meat is probed",
  },
  {
    id: "saucepans",
    fromLevel: 32,
    when: (d) => has(d, "pot"),
    perCook: true,
    why: "Sauces, chutneys and the French onion base cook in a saucepan",
  },
  {
    id: "whisks",
    fromLevel: 33,
    when: (d) => has(d, "pot") || d.kind === "salad",
    why: "The velouté and every dressing are whisked smooth",
  },
  {
    id: "saute-pans",
    fromLevel: 36,
    when: (d) => has(d, "saute"),
    perCook: true,
    why: "Sautés, duxelles, persillade and wok plates need a wide sauté pan",
  },
  {
    id: "spatulas",
    fromLevel: 36,
    when: (d) => has(d, "saute") || has(d, "fry"),
    why: "What's in the pan is kept moving with a spatula",
  },
  {
    id: "graters",
    fromLevel: 44,
    when: (d, r) => d.cheese || /gratin/i.test(r.name),
    why: "Cheese is grated fresh — the gratin and every cheese plate",
  },
  {
    id: "kitchen-scales",
    fromLevel: 101,
    when: (d) => d.protein !== null,
    why: "Chicken, steak and salmon are portioned by weight",
  },
];

/** Grandma's old tools, hers to give once when the Market opens (Level 10). */
export const GRANDMAS_TOOL_SET: readonly SupplyId[] = ["peelers", "mixing-bowls", "measuring-cups"];

/** The cooks on the line: the chef + prep / line cooks + the Head Chef + specialists (max 4). */
export function cooksOnLine(save: SaveData, levelNumber: number): number {
  if (!isSystemLive("staff", levelNumber)) return 1;
  const roles = (save.business.staff?.hiredRoles ?? []) as readonly string[];
  const cooks = roles.filter((r) => r === "prep-cook" || r === "line-cook" || r === "head-chef");
  return Math.min(4, 1 + cooks.length + restaurantStaffOf(save).specialists.length);
}

export type ToolRow = {
  id: SupplyId;
  label: string;
  icon: string;
  need: number;
  have: number;
  missing: number;
  /** Market packs that cover `missing`, and their cost. */
  packs: number;
  cost: number;
  why: string;
  /** The dishes (names) that need it today; empty for an "always" tool. */
  dishes: string[];
};

export type ToolsCheck =
  | { applies: false }
  | {
      applies: true;
      rows: ToolRow[];
      ready: boolean;
      missingCost: number;
      affordable: boolean;
    };

/** The recipes a service at `levelNumber` cooks: its own tickets + the active menu's dishes. */
export function serviceRecipes(
  save: SaveData,
  tickets: readonly RecipeDefinition[],
): RecipeDefinition[] {
  const menu = inventoryMenuOf(save)
    .map((d) => getCampaignRecipe(d.sourceRecipeId))
    .filter((r): r is RecipeDefinition => !!r);
  const seen = new Set<string>();
  return [...tickets, ...menu].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** What `recipes` need of every tool at `levelNumber` (0 = not needed). */
export function toolsNeeded(
  save: SaveData,
  levelNumber: number,
  recipes: readonly RecipeDefinition[],
): { rule: ToolRule; need: number; dishes: string[] }[] {
  const cooks = cooksOnLine(save, levelNumber);
  return TOOL_RULES.filter((rule) => levelNumber >= rule.fromLevel).flatMap((rule) => {
    const dishes =
      rule.when === "always"
        ? []
        : recipes.filter((r) =>
            (rule.when as Exclude<ToolRule["when"], "always">)(dishServiceFor(r), r),
          );
    if (rule.when !== "always" && dishes.length === 0) return [];
    return [{ rule, need: rule.perCook ? cooks : 1, dishes: dishes.map((r) => r.name) }];
  });
}

/** The Pre-Service Check's kitchen tools (from Level 10). Every missing tool blocks START. */
export function toolsCheck(
  save: SaveData,
  levelNumber: number,
  recipes: readonly RecipeDefinition[],
): ToolsCheck {
  if (levelNumber < FIRST_PURCHASE_LEVEL) return { applies: false };
  const supplies = save.business.supplies;
  const rows: ToolRow[] = toolsNeeded(save, levelNumber, recipes).map(({ rule, need, dishes }) => {
    const item = getSupplyItem(rule.id)!;
    const have = supplyUnits(supplies, rule.id);
    const missing = Math.max(0, need - have);
    const packs = missing > 0 ? Math.ceil(missing / item.packSize) : 0;
    return {
      id: rule.id,
      label: item.name,
      icon: item.icon,
      need,
      have,
      missing,
      packs,
      cost: packs * supplyPackPrice(item),
      why: rule.why,
      dishes,
    };
  });
  const missingCost = rows.reduce((t, r) => t + r.cost, 0);
  return {
    applies: true,
    rows,
    ready: rows.every((r) => r.missing === 0),
    missingCost,
    affordable: save.credits >= missingCost,
  };
}

/**
 * Tools first needed in the next `ahead` levels after `levelNumber` that the
 * kitchen doesn't own yet (the "Coming up" news, Level 10's shopping list).
 */
export function toolsComingUp(
  save: SaveData,
  levelNumber: number,
  ahead: number,
  recipesAt: (n: number) => readonly RecipeDefinition[],
): { id: SupplyId; level: number; why: string }[] {
  const out: { id: SupplyId; level: number; why: string }[] = [];
  for (let n = levelNumber + 1; n <= levelNumber + ahead && n <= 250; n++) {
    for (const { rule, need } of toolsNeeded(save, n, recipesAt(n))) {
      if (out.some((o) => o.id === rule.id)) continue;
      if (supplyUnits(save.business.supplies, rule.id) >= need) continue;
      out.push({ id: rule.id, level: n, why: rule.why });
    }
  }
  return out;
}

/** Every recipe a level may serve (its order pool or batch group). */
export function levelRecipesAt(levelNumber: number): RecipeDefinition[] {
  const level = getLevel(`level-${levelNumber}`);
  return [...(level?.recipePoolIds ?? []), ...(level?.batchGroupRecipeIds ?? [])]
    .map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
}

/** How far ahead the Pre-Service Check announces a tool, and Level 10's first shopping list. */
export const TOOLS_NOTICE_LEVELS = 5;
export const FIRST_SHOPPING_LIST_LEVELS = 10;

/** Grandma's tools, given once (recorded in `business.grandmasTools`). */
export type GrandmasToolsState = { atLevel: number };

/** Gives Grandma's old tools once the Market opens (Level 10); the same save otherwise. */
export function giveGrandmasTools(save: SaveData, reachedLevel: number): SaveData {
  if (save.business.grandmasTools || reachedLevel < FIRST_PURCHASE_LEVEL) return save;
  const supplies = save.business.supplies;
  const stock = { ...supplies.stock };
  for (const id of GRANDMAS_TOOL_SET) {
    const prev = stock[id] ?? { units: 0, costBasis: 0 };
    if (prev.units > 0) continue;
    stock[id] = { units: 1, costBasis: prev.costBasis };
  }
  return {
    ...save,
    business: {
      ...save.business,
      supplies: { ...supplies, stock },
      grandmasTools: { atLevel: reachedLevel },
    },
  };
}
