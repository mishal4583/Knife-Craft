/**
 * GRANDMA'S FRIDGE (developer 2026-10-09, "Levels 1–15 retention", pass 2).
 * The first levels learn stock one step at a time, on the restaurant's ONE
 * inventory (`save.business.inventory`), the recipes' own portions
 * (`orderRequirements`) and the Market's own prices (`restaurantQuote`) —
 * no second stock system:
 *
 *  - Level 3: Grandma's leftovers. Once, the fridge gets what the first-play
 *    orders of Levels 4–12 use (each ingredient at the most a dull knife can
 *    waste), at cost 0 — goods, no money, no ledger entry (the pantry and
 *    starter-crate rule). Recorded in `business.grandmasFridge` so it is
 *    never given twice. A save that is already past Level 3 (but before
 *    Level 15) gets the leftovers for the levels it still has to play.
 *  - Levels 4–14: a level's own order uses its ingredients (campaignStock's
 *    early branch). It uses what's there and never blocks: before Level 15
 *    nothing is bought for a service, so a short fridge is simply used up.
 *  - Level 12: what's running low, from the real fridge against the next
 *    services' needs.
 *  - Level 13: the top-up — the next services' needs minus the usable stock,
 *    never below zero, in whole Market steps at the Market's price. Optional:
 *    nothing is bought for the player, and START never waits for it.
 *  - Level 14: a look at what's stocked, what's low and what Levels 14–15
 *    need.
 *
 * Pure; nothing reads RESTAURANT_MODE (App only calls it in the restaurant
 * build).
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import type { LevelDefinition } from "../levels/levelTypes";
import { getLevel, isCompleted } from "../levels/LevelManager";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import {
  addStock,
  normalizeQuantity,
  type IngredientRequirement,
} from "../business/businessInventory";
import { usableQuantity } from "../business/perishability";
import { getAvailableStorageCapacity } from "../business/RefrigeratorManager";
import { marketUnitsCovering, measureOf } from "../business/measure";
import { getSharpnessModifier } from "../economy/sharpness";
import { orderRequirements } from "./campaignStock";
import { recipeRequirements, sumRequirements } from "./recipeRequirements";
import { restaurantQuote } from "./restaurantEconomy";
import { restaurantLevelOf } from "./restaurantMenu";
import { savedTicketsFor } from "./serviceTickets";
import {
  LEFTOVERS_AT,
  PREVIEW_AT,
  RUNNING_LOW_AT,
  STOCK_USED_FROM,
  TOP_UP_AT,
  earlyStockAt,
} from "./firstLevels";

/** The last level Grandma's leftovers are sized for (the running-low level). */
export const LEFTOVERS_COVER_TO = RUNNING_LOW_AT;

export type LeftoverLine = { ingredientId: IngredientId; quantity: number };

/** `business.grandmasFridge`: the one-time leftovers. Absent = not given yet. */
export type GrandmasFridgeState = {
  /** The restaurant level the leftovers were given at. */
  atLevel: number;
  lines: LeftoverLine[];
};

const levelNo = (n: number) => getLevel(`level-${n}`);

/**
 * The recipes a level's own order may be: its saved tickets once the level
 * has been opened, otherwise every recipe its pool can roll.
 */
function recipesFor(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  const saved = savedTicketsFor(save.levelProgress, level);
  if (saved) return saved;
  return (level.recipePoolIds ?? [])
    .map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
}

/**
 * What one level's own order uses, per ingredient: the largest of the
 * recipes it may be (a pool of two counts its bigger need). `scale` maps a
 * recipe to its requirements (the planned use, or the base portion).
 */
function levelNeed(
  save: SaveData,
  n: number,
  scale: (r: RecipeDefinition) => IngredientRequirement[],
): IngredientRequirement[] {
  const level = levelNo(n);
  if (!level || isCompleted(level.id, save.levelProgress)) return [];
  const most = new Map<IngredientId, number>();
  for (const recipe of recipesFor(save, level)) {
    for (const r of sumRequirements(scale(recipe))) {
      most.set(r.ingredientId, Math.max(most.get(r.ingredientId) ?? 0, r.quantity));
    }
  }
  const orders = level.requiredOrders ?? 1;
  return [...most].map(([ingredientId, q]) => ({
    ingredientId,
    quantity: normalizeQuantity(q * orders),
  }));
}

/** What levels `from`..`to` (first plays only) use, summed per ingredient. */
function needFor(
  save: SaveData,
  from: number,
  to: number,
  scale: (r: RecipeDefinition) => IngredientRequirement[],
): IngredientRequirement[] {
  const all: IngredientRequirement[] = [];
  for (let n = from; n <= to; n++) all.push(...levelNeed(save, n, scale));
  return sumRequirements(all);
}

/** The most a recipe can use: its base portion with a fully dull knife's waste. */
const mostUse = (r: RecipeDefinition) => {
  const k = 1 + getSharpnessModifier(0);
  return recipeRequirements(r).map((x) => ({
    ingredientId: x.ingredientId,
    quantity: normalizeQuantity(x.quantity * k),
  }));
};

/** Rounds up to the next 0.05 (a tidy amount for the fridge). */
const tidy = (q: number) => normalizeQuantity(Math.ceil(normalizeQuantity(q) * 20 - 1e-9) / 20);

/** The state, or null when the leftovers haven't been given. */
export function grandmasFridgeOf(save: SaveData): GrandmasFridgeState | null {
  return save.business.grandmasFridge ?? null;
}

/**
 * What Grandma's leftovers hold for this save: the first-play orders of the
 * levels still to play from Level 4 (or the current level) to Level 12, at
 * the most each could use. Empty outside Levels 3–14.
 */
export function leftoversFor(save: SaveData): LeftoverLine[] {
  const reached = restaurantLevelOf(save.levelProgress);
  if (reached < LEFTOVERS_AT || !earlyStockAt(Math.max(reached, STOCK_USED_FROM))) return [];
  return needFor(save, Math.max(reached, STOCK_USED_FROM), LEFTOVERS_COVER_TO, mostUse)
    .map((r) => ({ ingredientId: r.ingredientId, quantity: tidy(r.quantity) }))
    .filter((l) => l.quantity > 0);
}

/**
 * Gives Grandma's leftovers once (Level 3 on, before Level 15): adds them to
 * the fridge at cost 0, as much as fits, and records them. Returns the same
 * save when they were given already or don't apply. No money moves.
 */
export function giveGrandmasLeftovers(save: SaveData): SaveData {
  if (grandmasFridgeOf(save)) return save;
  const reached = restaurantLevelOf(save.levelProgress);
  const lines = leftoversFor(save);
  if (lines.length === 0) return save;
  const day = save.business.calendar.businessDay;
  let inventory = save.business.inventory;
  let free = getAvailableStorageCapacity(inventory, save.business.refrigerator.refrigeratorId);
  const given: LeftoverLine[] = [];
  for (const l of lines) {
    const quantity = normalizeQuantity(Math.min(l.quantity, Math.max(0, free)));
    if (quantity <= 0) continue;
    inventory = addStock(inventory, l.ingredientId, quantity, 0, day);
    free -= quantity;
    given.push({ ingredientId: l.ingredientId, quantity });
  }
  return {
    ...save,
    business: { ...save.business, inventory, grandmasFridge: { atLevel: reached, lines: given } },
  };
}

export type FridgeRow = {
  ingredientId: IngredientId;
  /** What the next services (`levels`) use, planned with today's knife and helpers. */
  need: number;
  /** In the fridge and fresh enough to use. */
  usable: number;
  /** need − usable, never below zero. */
  missing: number;
  /** Whole Market steps that cover `missing` (0 when nothing is missing). */
  buyUnits: number;
  /** The Market's price for `buyUnits` (0 when nothing is missing). */
  cost: number;
};

export type GrandmasFridgeNote = {
  stage: "low" | "top-up" | "preview";
  /** The services the rows cover (first plays), this level first. */
  levels: number[];
  /** Every ingredient the services use, the short ones first. */
  rows: FridgeRow[];
  /** The rows with something missing. */
  shortRows: FridgeRow[];
  /** What buying every short row costs at the Market now. */
  topUpCost: number;
  /** The wallet covers `topUpCost`. */
  affordable: boolean;
  /** Fresh stock in the fridge that none of these services needs. */
  spare: { ingredientId: IngredientId; usable: number }[];
};

/** The services a stage looks at: Levels 12–14 for "low" and "top-up", 14–15 for "preview". */
function horizon(stage: GrandmasFridgeNote["stage"], n: number): [number, number] {
  return stage === "preview" ? [n, n + 1] : [n, PREVIEW_AT];
}

/**
 * Grandma's note for a level's first play: Level 12 "low", 13 "top-up",
 * 14 "preview"; null for every other level, a replay, or a save without the
 * leftovers (a classic or Level 15+ save). Read-only.
 */
export function grandmasFridgeNoteFor(
  save: SaveData,
  level: LevelDefinition,
  n: number,
): GrandmasFridgeNote | null {
  const stage =
    n === RUNNING_LOW_AT ? "low" : n === TOP_UP_AT ? "top-up" : n === PREVIEW_AT ? "preview" : null;
  if (!stage || isCompleted(level.id, save.levelProgress) || !grandmasFridgeOf(save)) return null;
  const [from, to] = horizon(stage, n);
  const day = save.business.calendar.businessDay;
  const inventory = save.business.inventory;
  const measure = measureOf(save);
  const rows: FridgeRow[] = needFor(save, from, to, (r) => orderRequirements(save, r)).map(
    ({ ingredientId, quantity }) => {
      const usable = usableQuantity(inventory, ingredientId, day);
      const missing = normalizeQuantity(Math.max(0, quantity - usable));
      const buyUnits = marketUnitsCovering(ingredientId, missing, measure);
      return {
        ingredientId,
        need: quantity,
        usable,
        missing,
        buyUnits,
        cost: buyUnits > 0 ? restaurantQuote(save, ingredientId, buyUnits).totalCost : 0,
      };
    },
  );
  rows.sort((a, b) => Number(b.missing > 0) - Number(a.missing > 0));
  const shortRows = rows.filter((r) => r.missing > 0);
  const topUpCost = shortRows.reduce((s, r) => s + r.cost, 0);
  const used = new Set(rows.map((r) => r.ingredientId));
  const spare = (Object.keys(inventory) as IngredientId[])
    .filter((id) => !used.has(id))
    .map((id) => ({ ingredientId: id, usable: usableQuantity(inventory, id, day) }))
    .filter((s) => s.usable > 0);
  const levels: number[] = [];
  for (let k = from; k <= to; k++) {
    const l = levelNo(k);
    if (l && !isCompleted(l.id, save.levelProgress)) levels.push(k);
  }
  return {
    stage,
    levels,
    rows,
    shortRows,
    topUpCost,
    affordable: save.credits >= topUpCost,
    spare,
  };
}
