/**
 * MARKET NEEDS (developer 2026-10-16: "highlight the essentials … needed this
 * much stock … for every section in the shop, and sort by the essential
 * need"). What the next service and tonight need from the Market, item by
 * item, so every Market section can highlight it, say how much to buy and
 * why, list it first, and buy it in one tap.
 *
 * Read-only, and built only from the checks the game already makes (no second
 * source of truth): the Pre-Service Check's plan for the player's current
 * level (`servicePlanFor`: the orders' stock, the menu guests' stock, the
 * service supplies, the kitchen tools and the tools coming up), tonight's
 * closing supplies (`closingSuppliesFor`) and the open cleaning tasks
 * (`taskNeeds`). Amounts are what the Market sells: Market units for
 * ingredients (lb / kg / pieces), packs for supplies.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { getLevel, isCompleted } from "../levels/LevelManager";
import { getSupplyItem, type SupplyId } from "../business/businessSupplies";
import { supplyUnits } from "../business/BusinessSuppliesManager";
import { servicePlanFor } from "./preServiceCheck";
import { closingSuppliesFor } from "./serviceSupplies";
import { TASK_RULES, cleanlinessOf, taskNeeds } from "./cleanliness";
import { levelNumber } from "../levels/levelMastery";

/** How urgent a need is, most urgent first. */
export type NeedWhen = "today" | "tonight" | "guests" | "soon";
export const NEED_ORDER: readonly NeedWhen[] = ["today", "tonight", "guests", "soon"];

export type MarketNeed = {
  when: NeedWhen;
  /** What it is for, in a few words ("today's orders", "tonight's closing"…). */
  why: string;
  /** Needed and on hand, in the item's own unit (lb / kg / pieces, or supply units). */
  need: number;
  have: number;
  /** What to buy: Market units for an ingredient, packs for a supply. */
  buy: number;
  /** For "soon": the level that asks for it. */
  level?: number;
};

export type MarketNeeds = {
  /** The level whose service these needs are for (null: nothing to plan). */
  levelNumber: number | null;
  ingredients: Partial<Record<IngredientId, MarketNeed>>;
  supplies: Partial<Record<SupplyId, MarketNeed>>;
};

const EMPTY: MarketNeeds = { levelNumber: null, ingredients: {}, supplies: {} };

const packsFor = (id: SupplyId, missingUnits: number) =>
  Math.max(1, Math.ceil(missingUnits / Math.max(1, getSupplyItem(id)?.packSize ?? 1)));

/** Keeps the more urgent need when two sources ask for the same item (the bigger amount wins a tie). */
function put<K extends string>(map: Partial<Record<K, MarketNeed>>, id: K, need: MarketNeed) {
  const old = map[id];
  if (!old) {
    map[id] = need;
    return;
  }
  const a = NEED_ORDER.indexOf(need.when);
  const b = NEED_ORDER.indexOf(old.when);
  if (a < b || (a === b && need.buy > old.buy)) map[id] = need;
}

/** Everything the Market should highlight now. */
export function marketNeeds(save: SaveData): MarketNeeds {
  const levelId = save.levelProgress.currentLevelId;
  const level = levelId ? getLevel(levelId) : undefined;
  if (!level || isCompleted(level.id, save.levelProgress)) return EMPTY;
  const plan = servicePlanFor(save, level);
  if (!plan) return EMPTY;
  const out: MarketNeeds = { levelNumber: plan.levelNumber, ingredients: {}, supplies: {} };

  // Ingredients: the service's orders, then the menu guests.
  if (plan.check.applies) {
    for (const row of plan.check.missingRows) {
      if (!(row.buyUnits > 0)) continue;
      put(out.ingredients, row.ingredientId, {
        when: "today",
        why: "today's orders",
        need: row.needed,
        have: row.usable,
        buy: row.buyUnits,
      });
    }
  }
  for (const row of plan.guests.rows) {
    if (!(row.buyUnits > 0)) continue;
    put(out.ingredients, row.ingredientId, {
      when: "guests",
      why: "today's menu guests",
      need: row.buyUnits,
      have: 0,
      buy: row.buyUnits,
    });
  }

  // Supplies: the service's tableware, napkins and packaging; today's tools.
  if (plan.supplies.applies) {
    for (const row of plan.supplies.rows) {
      if (!(row.missing > 0)) continue;
      put(out.supplies, row.id, {
        when: row.guest ? "guests" : "today",
        why: row.guest ? "today's menu guests" : row.label.toLowerCase(),
        need: row.need,
        have: row.have,
        buy: row.packs || packsFor(row.id, row.missing),
      });
    }
  }
  if (plan.tools.applies) {
    for (const row of plan.tools.rows) {
      if (!(row.missing > 0)) continue;
      put(out.supplies, row.id, {
        when: "today",
        why: row.dishes.length ? `today's ${row.dishes.slice(0, 2).join(", ")}` : row.why,
        need: row.need,
        have: row.have,
        buy: row.packs || packsFor(row.id, row.missing),
      });
    }
  }

  // Tonight's closing (tissues, deli wrap) and the open cleaning jobs.
  for (const line of closingSuppliesFor(save, plan.levelNumber)) {
    if (line.have >= line.need) continue;
    put(out.supplies, line.id, {
      when: "tonight",
      why: line.label.toLowerCase(),
      need: line.need,
      have: line.have,
      buy: packsFor(line.id, line.need - line.have),
    });
  }
  for (const task of cleanlinessOf(save).tasks) {
    for (const id of taskNeeds(save, task.kind)) {
      put(out.supplies, id, {
        when: "today",
        why: `cleaning: ${TASK_RULES[task.kind].label.toLowerCase()}`,
        need: 1,
        have: supplyUnits(save.business.supplies, id),
        buy: 1,
      });
    }
  }

  // Tools the next levels will ask for.
  for (const soon of plan.toolsSoon) {
    put(out.supplies, soon.id, {
      when: "soon",
      why: soon.why,
      need: 1,
      have: 0,
      buy: 1,
      level: soon.level,
    });
  }
  return out;
}

/** "Needed today", "For tonight", … — the label a Market card shows. */
export function needLabel(need: MarketNeed): string {
  switch (need.when) {
    case "today":
      return "Needed today";
    case "tonight":
      return "Needed tonight";
    case "guests":
      return "For today's menu guests";
    case "soon":
      return need.level ? `Needed at Level ${need.level}` : "Needed soon";
  }
}

/** Sorts needed items first, most urgent first; everything else keeps its order. */
export function needsFirst<T>(
  items: readonly T[],
  needOf: (item: T) => MarketNeed | undefined,
): T[] {
  const rank = (item: T) => {
    const n = needOf(item);
    return n ? NEED_ORDER.indexOf(n.when) : NEED_ORDER.length;
  };
  return items
    .map((item, i) => ({ item, i, r: rank(item) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}

/** The level number of the save's current level (for the "Needed at Level N" copy). */
export const currentLevelNumber = (save: SaveData) =>
  save.levelProgress.currentLevelId ? levelNumber(save.levelProgress.currentLevelId) : null;
