/**
 * MENU_GUESTS — customers who order from the restaurant's ACTIVE MENU inside
 * a campaign service (Unified Restaurant phase D, spec §4: "customer orders
 * must come from dishes actually available on the player's menu").
 *
 * A level's own orders stay exactly as designed (deterministic, they teach).
 * Once they are served, the service can take up to `menuGuestsFor` extra
 * guests (the schedule + the kitchen's seats, capped by the team's
 * capacity), one at a time and optional (Finish Level stays available):
 *
 *  - each guest orders a dish from the active menu at the level being
 *    played (`activeMenuRecipes`: unlocked AND switched on; a locked or
 *    switched-off dish never appears), picked by the existing OrderGenerator
 *    (no dish twice in a row) from a seeded generator, so the same level
 *    always brings the same guests (deterministic, testable);
 *  - the guest is cooked with the existing cutting engine as an extra ticket
 *    of the same service, pays the dish's menu price through the existing
 *    Business payment rule (`businessCustomerPayment`), uses real stock from
 *    Level 15 like any order, and is recorded as restaurant revenue
 *    ("business-revenue", the day's P&L) — prices are not changed here
 *    (Economy TODO #13, #20);
 *  - guests served are saved per level (`levelProgress.menuGuests`), so
 *    leaving and coming back never re-offers a guest already paid;
 *    completing the level drops the entry. Replays have no guests.
 *
 * Batch-group levels (customers already seated together) take no menu
 * guests in this phase. Pure; nothing reads RESTAURANT_MODE.
 *
 * WALK-INS (early game phase 3, developer 2026-10-25): from Level 5 a service
 * also gets `WALK_IN_RULES.perService` walk-in customer after its menu guests,
 * within the same team capacity — between this level's orders and the next
 * level's. They are the same customers in the same pipeline (an extra ticket,
 * the dish's menu price, one "business-revenue" entry, real stock) and count
 * on in the same `levelProgress.menuGuests` entry after the guests, so a
 * walk-in is never paid twice and no save field is added. A walk-in leaves the
 * stock the NEXT level's own orders need (`walkInStock`): it is offered only
 * when its dish fits beside that reserve.
 */
import type { SaveData } from "../SaveManager";
import { INGREDIENTS, type IngredientId } from "../definitions";
import type { LevelDefinition } from "../levels/levelTypes";
import type { LevelProgress } from "../levels/LevelManager";
import { getLevel, isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { generateOrder } from "../service/OrderGenerator";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { businessDishForRecipeId } from "../business/businessServiceCatalog";
import type { BusinessDish } from "../business/businessDishCatalog";
import { businessCustomerPayment } from "../business/BusinessServiceManager";
import { activeMenuRecipes } from "./restaurantMenu";
import { BUSINESS_MENU_FIRST_LEVEL, menuGuestsPerService } from "./restaurantProgression";
import { serviceStockCheck } from "./campaignStock";
import { kitchenGuestSeats } from "./restaurantInvestments";
import { ticketsFor } from "./serviceTickets";
import { dishWeight, pickGuestDish } from "./orderPool";

/** The guests a service of `level` brings, in order (pure; same every time for the same menu). */
export function menuGuestQueue(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  if (level.batchGroupRecipeIds?.length) return [];
  const n = levelNumber(level.id);
  const count = menuGuestsFor(save, n);
  const pool = activeMenuRecipes(save.business.menuActivation, n);
  if (count === 0 || pool.length === 0) return [];
  const rand = makeSeededRand(n * 104729 + 17);
  const guests: RecipeDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const pick = generateOrder(
      {
        unlockedRecipes: pool,
        recentRecipeIds: guests.map((r) => r.id),
        recentCuisineIds: guests.map((r) => r.cuisineId),
        // Phase 2 (decision Q6): a dish new on the menu is ordered more often, a popular (pricier)
        // one a little less (orderPool.ts dishWeight).
        weightOf: (r) => dishWeight(save, r, n),
      },
      rand,
    );
    if (!pick) break;
    guests.push(pick);
  }
  return guests;
}

/**
 * SERVICE CAPACITY (final economy pass): how many menu guests the team can
 * serve in one service — the chef handles 2, each cook, server or Head Chef
 * one more, each specialist chef one more (cleaners and managers run the
 * restaurant, they don't serve guests). Every number is here.
 */
export const GUEST_CAPACITY_RULES = {
  chef: 2,
  perRole: { "prep-cook": 1, "line-cook": 1, server: 1, "head-chef": 1 } as Record<string, number>,
  perSpecialist: 1,
};

export function menuGuestCapacity(save: SaveData): number {
  const R = GUEST_CAPACITY_RULES;
  const roles = save.business.staff?.hiredRoles ?? [];
  const specialists = save.business.restaurantStaff?.specialists?.length ?? 0;
  return (
    R.chef +
    roles.reduce((n, role) => n + (R.perRole[role] ?? 0), 0) +
    specialists * R.perSpecialist
  );
}

/**
 * The menu guests a service of level `n` takes: the level's guest demand
 * (`menuGuestsPerService`, the developer's schedule) plus the seats the
 * kitchen tiers built add (`kitchenGuestSeats`), never more than the team
 * can serve (`menuGuestCapacity`). 0 before the menu opens. The staff
 * requirements still read the schedule alone, so they never depend on this.
 */
export function menuGuestsFor(save: SaveData, n: number): number {
  const demand = menuGuestsPerService(n);
  if (demand <= 0) return 0;
  return Math.min(demand + kitchenGuestSeats(save), menuGuestCapacity(save));
}

/** Walk-ins: how many per service, from the level the menu opens (developer 2026-10-25). */
export const WALK_IN_RULES = { fromLevel: BUSINESS_MENU_FIRST_LEVEL, perService: 1 };

/**
 * The walk-ins a service of level `n` takes: `WALK_IN_RULES.perService` from
 * the menu's level, in whatever room the team has left after the menu guests
 * (`menuGuestCapacity`, the same rule). Walk-ins never add staff requirements.
 */
export function walkInsFor(save: SaveData, n: number): number {
  if (n < WALK_IN_RULES.fromLevel) return 0;
  const room = menuGuestCapacity(save) - menuGuestsFor(save, n);
  return Math.max(0, Math.min(WALK_IN_RULES.perService, room));
}

/** The walk-ins of `level`, in order (seeded on their own: the menu guests' picks never move). */
export function walkInQueue(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  if (level.batchGroupRecipeIds?.length) return [];
  const n = levelNumber(level.id);
  const count = walkInsFor(save, n);
  const pool = activeMenuRecipes(save.business.menuActivation, n);
  if (count === 0 || pool.length === 0) return [];
  const guests = menuGuestQueue(save, level);
  const rand = makeSeededRand(n * 7919 + 31);
  const out: RecipeDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const recent = [...guests, ...out];
    const pick = generateOrder(
      {
        unlockedRecipes: pool,
        recentRecipeIds: recent.map((r) => r.id),
        recentCuisineIds: recent.map((r) => r.cuisineId),
        weightOf: (r) => dishWeight(save, r, n),
      },
      rand,
    );
    if (!pick) break;
    out.push(pick);
  }
  return out;
}

/** The level after `level`, while it still has its own orders to serve (null at the end). */
function nextLevelOf(save: SaveData, level: LevelDefinition): LevelDefinition | null {
  const next = getLevel(`level-${levelNumber(level.id) + 1}`);
  return next && !isCompleted(next.id, save.levelProgress) ? next : null;
}

/** The next level's own tickets: the stock a walk-in must leave alone. */
export function reservedTicketsFor(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  const next = nextLevelOf(save, level);
  return next ? ticketsFor(save.levelProgress, next).tickets : [];
}

export type WalkInStock = {
  /** The walk-in's dish fits beside the reserve. */
  ok: boolean;
  /** Ingredients short for it (the reserve counted), whole Market units to buy. */
  short: { ingredientId: IngredientId; name: string; buyUnits: number }[];
  /** The level whose orders the reserve keeps stock for (null at the end of the campaign). */
  reservedFor: string | null;
};

/**
 * A walk-in's stock: its dish's ingredients must be usable on top of what the
 * next level's own orders need (the reserve), so serving it can never leave
 * that order short. Nothing is taken here; the serve takes the stock as for
 * any order.
 */
export function walkInStock(
  save: SaveData,
  level: LevelDefinition,
  recipe: RecipeDefinition,
): WalkInStock {
  const n = levelNumber(level.id);
  const reserved = reservedTicketsFor(save, level);
  const next = nextLevelOf(save, level);
  const check = serviceStockCheck(save, n, [recipe, ...reserved]);
  if (!check.applies) return { ok: true, short: [], reservedFor: next?.title ?? null };
  const own = serviceStockCheck(save, n, [recipe]);
  const mine = new Set(own.applies ? own.rows.map((r) => r.ingredientId) : []);
  const short = check.missingRows
    .filter((r) => mine.has(r.ingredientId))
    .map((r) => ({
      ingredientId: r.ingredientId,
      name: INGREDIENTS[r.ingredientId].name,
      buyUnits: r.buyUnits,
    }));
  return { ok: short.length === 0, short, reservedFor: next?.title ?? null };
}

/** Every customer of the service after its own orders: the menu guests, then the walk-ins. */
export function customerQueue(
  save: SaveData,
  level: LevelDefinition,
): { recipe: RecipeDefinition; kind: "guest" | "walk-in" }[] {
  return [
    ...menuGuestQueue(save, level).map((recipe) => ({ recipe, kind: "guest" as const })),
    ...walkInQueue(save, level).map((recipe) => ({ recipe, kind: "walk-in" as const })),
  ];
}

/** The walk-ins still to come in this service (after the guests and walk-ins already served). */
export function remainingWalkIns(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  if (isCompleted(level.id, save.levelProgress)) return [];
  const guests = menuGuestQueue(save, level).length;
  const served = Math.max(0, menuGuestsServed(save.levelProgress, level.id) - guests);
  return walkInQueue(save, level).slice(served);
}

export function menuGuestsServed(progress: LevelProgress, levelId: string): number {
  const n = progress.menuGuests?.[levelId];
  return typeof n === "number" && n > 0 ? Math.floor(n) : 0;
}

export function withMenuGuestServed(progress: LevelProgress, levelId: string): LevelProgress {
  return {
    ...progress,
    menuGuests: {
      ...(progress.menuGuests ?? {}),
      [levelId]: menuGuestsServed(progress, levelId) + 1,
    },
  };
}

export function withoutMenuGuests(progress: LevelProgress, levelId: string): LevelProgress {
  if (!progress.menuGuests || !(levelId in progress.menuGuests)) return progress;
  const rest = { ...progress.menuGuests };
  delete rest[levelId];
  return { ...progress, menuGuests: rest };
}

export type MenuGuest = {
  recipe: RecipeDefinition;
  dish: BusinessDish;
  /** 1-based number of this guest in the service, and the service's total. */
  number: number;
  total: number;
  /** What the guest pays (the dish's menu price through the Business payment rule). */
  pays: number;
  /** Phase 2 (dishHeat.ts): the popular-dish rise in whole percent included in `pays` (0: none). */
  risePct: number;
  /** The stock for this dish is on hand (always true before Level 15). */
  inStock: boolean;
  /** A menu guest, or a walk-in (phase 3); `number` / `total` count within the kind. */
  kind: "guest" | "walk-in";
  /** A walk-in short of stock: what to buy (the next level's reserve counted). Empty otherwise. */
  short: { ingredientId: IngredientId; name: string; buyUnits: number }[];
};

/** The guests still to come in this service (the queue after those already served). */
export function remainingMenuGuests(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  if (isCompleted(level.id, save.levelProgress)) return [];
  return menuGuestQueue(save, level).slice(menuGuestsServed(save.levelProgress, level.id));
}

/** The next menu guest for a first play of `level`, or null (none left, replay, none at this level). */
export function nextMenuGuest(save: SaveData, level: LevelDefinition): MenuGuest | null {
  if (isCompleted(level.id, save.levelProgress)) return null;
  const queue = customerQueue(save, level);
  const served = menuGuestsServed(save.levelProgress, level.id);
  const next = queue[served];
  if (!next) return null;
  const { kind } = next;
  // Phase 2 (developer 2026-10-30, orderPool.ts): the forecast dish when it can be made, else another
  // dish in stock (weighted), else the forecast, out of stock. A walk-in keeps the next level's
  // reserve (as before); a menu guest is planned by this service's check, so it needs none.
  const reserve = kind === "walk-in" ? reservedTicketsFor(save, level) : [];
  const recent = queue.slice(Math.max(0, served - 3), served).map((c) => c.recipe);
  // A substitute leaves alone what the customers still to come were planned to order.
  const later = queue.slice(served + 1).map((c) => c.recipe);
  const recipe =
    pickGuestDish(save, level, next.recipe, reserve, served, recent, [...reserve, ...later]) ??
    next.recipe;
  const dish = businessDishForRecipeId(recipe.id);
  if (!dish) return null;
  const guests = queue.filter((c) => c.kind === "guest").length;
  const payment = businessCustomerPayment(save, dish, { popular: true });
  const pays = payment.customerPays;
  const risePct = payment.risePct;
  if (kind === "walk-in") {
    const stock = walkInStock(save, level, recipe);
    return {
      recipe,
      dish,
      number: served - guests + 1,
      total: queue.length - guests,
      pays,
      risePct,
      inStock: stock.ok,
      kind,
      short: stock.short,
    };
  }
  const check = serviceStockCheck(save, levelNumber(level.id), [recipe]);
  return {
    recipe,
    dish,
    number: served + 1,
    total: guests,
    pays,
    risePct,
    inStock: !check.applies || check.ready,
    kind,
    short: [],
  };
}
