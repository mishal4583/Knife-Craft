/**
 * RESTAURANT_MIGRATION — Unified Restaurant phase M: an existing save moves
 * into the unified restaurant (audit decision 8, ONE_RESTAURANT_PLAN §10,
 * spec §46).
 *
 * Nothing is lost and no money moves: every level, item, dollar, Business
 * stock, staff, menu switch, price, contract and history is kept — it simply
 * becomes the restaurant's. A save that is already past a system's unlock
 * level gets a one-time "Welcome to your restaurant" STARTER CRATE of the
 * goods those systems need, so it isn't stopped by requirements it never had
 * the chance to prepare for:
 *
 *  - kitchen tools (from L10, supplies plan A, 2026-10-10): the tools its
 *    next KIT_SERVICES services cook with (kitchenTools.ts), one per cook
 *    where a tool is per cook;
 *  - ingredient stock (from L15): what its next KIT_SERVICES services' own
 *    orders need, minus what it already has, in whole Market units, only as
 *    much as fits in the fridge (never overfilled);
 *  - dine-in (from L31): the tableware one of those services' dishes needs
 *    (plates, bowls, cutlery, glasses by dish — supplies plan B) and its
 *    tables' pieces, at least a plain place setting per guest, napkins up to KIT_NAPKINS, and one bottle of
 *    dish soap and one of cleaning liquid when it has none;
 *  - takeaway (from L71): containers and bags for those services' takeaway
 *    orders (at least KIT_PACKAGING).
 *
 * The crate is goods at cost 0 — no credits, no ledger entry (the pantry
 * rule, Economy TODO #16) — and only ever tops up: nothing is taken away.
 * Staff need no migration (hiring is free and the check asks for it).
 *
 * A fresh save (below L15) is only stamped as migrated, with an empty crate.
 * The stamp, `business.restaurantMigration`, makes it run ONCE: a stamped
 * save is returned unchanged. Pure; nothing reads RESTAURANT_MODE —
 * SaveManager runs it only in the restaurant build.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { addStock, normalizeQuantity } from "../business/businessInventory";
import { getAvailableStorageCapacity } from "../business/RefrigeratorManager";
import type { SupplyId } from "../business/businessSupplies";
import {
  ORDER_BAG_PRIORITY,
  ORDER_CONTAINER_PRIORITY,
  packagingOrdersCovered,
} from "../business/BusinessSuppliesManager";
import { getLevel, isCompleted } from "../levels/LevelManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { requirementsForRecipes } from "./recipeRequirements";
import { ticketsFor } from "./serviceTickets";
import { restaurantLevelOf } from "./restaurantMenu";
import { LAST_CAMPAIGN_LEVEL, isSystemLive, menuGuestsPerService } from "./restaurantProgression";
import {
  SERVICE_SUPPLY_RULES,
  orderServiceFor,
  restaurantSuppliesOf,
  serviceSuppliesCheck,
} from "./serviceSupplies";
import { getSupplyItem } from "../business/businessSupplies";
import { serviceRecipes, toolsNeeded } from "./kitchenTools";
import { FIRST_PURCHASE_LEVEL } from "./firstLevels";

export const RESTAURANT_MIGRATION_VERSION = 1;

/** How many upcoming services the crate's ingredients and packaging cover. */
export const KIT_SERVICES = 3;
/** Napkins the crate tops up to. */
export const KIT_NAPKINS = 100;
/** The fewest takeaway containers and bags the crate tops up to. */
export const KIT_PACKAGING = 10;

export type KitLine =
  | { kind: "ingredient"; id: IngredientId; units: number }
  | { kind: "supply"; id: SupplyId; units: number };

export type RestaurantMigrationState = {
  version: number;
  /** The restaurant level the save had when it moved in. */
  atLevel: number;
  /** What the starter crate held (empty for a fresh save). */
  kit: KitLine[];
  /** The player has seen the welcome note (set when a service starts). */
  seen: boolean;
};

/** The upcoming services the crate is for: the restaurant level and the next ones, not yet played. */
function upcomingServices(save: SaveData, atLevel: number) {
  const out: { levelNumber: number; tickets: RecipeDefinition[] }[] = [];
  for (let n = atLevel; n <= LAST_CAMPAIGN_LEVEL && out.length < KIT_SERVICES; n++) {
    const level = getLevel(`level-${n}`);
    if (!level || isCompleted(level.id, save.levelProgress)) continue;
    out.push({ levelNumber: n, tickets: ticketsFor(save.levelProgress, level).tickets });
  }
  return out;
}

function topUpSupply(
  stock: SaveData["business"]["supplies"]["stock"],
  id: SupplyId,
  units: number,
  kit: KitLine[],
) {
  if (units <= 0) return stock;
  const prev = stock[id] ?? { units: 0, costBasis: 0 };
  kit.push({ kind: "supply", id, units });
  return { ...stock, [id]: { units: prev.units + units, costBasis: prev.costBasis } };
}

/**
 * Moves `save` into the unified restaurant once (see the module doc).
 * Returns the same object when it was already migrated.
 */
export function migrateToUnifiedRestaurant(save: SaveData): SaveData {
  const prior = save.business.restaurantMigration;
  if (prior && prior.version >= RESTAURANT_MIGRATION_VERSION) return save;
  const atLevel = Math.min(restaurantLevelOf(save.levelProgress), LAST_CAMPAIGN_LEVEL);
  const kit: KitLine[] = [];
  const services = upcomingServices(save, atLevel);
  let inventory = save.business.inventory;
  let stock = save.business.supplies.stock;

  if (isSystemLive("ingredient-stock", atLevel)) {
    const need = requirementsForRecipes(services.flatMap((s) => s.tickets));
    let free = getAvailableStorageCapacity(inventory, save.business.refrigerator.refrigeratorId);
    for (const r of need) {
      const have = inventory[r.ingredientId]?.quantity ?? 0;
      const units = Math.min(
        Math.ceil(normalizeQuantity(r.quantity - have) - 1e-9),
        Math.floor(free),
      );
      if (units <= 0) continue;
      inventory = addStock(inventory, r.ingredientId, units, 0, save.business.calendar.businessDay);
      free -= units;
      kit.push({ kind: "ingredient", id: r.ingredientId, units });
    }
  }

  // Supplies plan A (2026-10-10): the kitchen tools the save's next services cook with.
  if (atLevel >= FIRST_PURCHASE_LEVEL) {
    const want = new Map<SupplyId, number>();
    for (const sv of services)
      for (const t of toolsNeeded(save, sv.levelNumber, serviceRecipes(save, sv.tickets)))
        want.set(t.rule.id, Math.max(want.get(t.rule.id) ?? 0, t.need));
    for (const [id, need] of want)
      stock = topUpSupply(stock, id, need - (stock[id]?.units ?? 0), kit);
  }

  if (isSystemLive("dine-in", atLevel)) {
    const perService = Math.max(
      1,
      ...services.map(
        (s) =>
          s.tickets.filter((_, i) => orderServiceFor(s.levelNumber, i) === "dine-in").length +
          menuGuestsPerService(s.levelNumber),
      ),
    );
    // Supplies plan B: each service's tableware by dish (the most any one service
    // needs), and its tables' pieces.
    const want = new Map<SupplyId, number>();
    for (const sv of services) {
      const check = serviceSuppliesCheck(
        {
          ...save,
          business: { ...save.business, supplies: { ...save.business.supplies, stock: {} } },
        },
        sv.levelNumber,
        sv.tickets.map((_, i) => orderServiceFor(sv.levelNumber, i)),
        { recipes: sv.tickets, guests: menuGuestsPerService(sv.levelNumber) },
      );
      if (check.applies)
        for (const r of check.rows)
          if (r.blocking && getSupplyItem(r.id)?.section === "service")
            want.set(r.id, Math.max(want.get(r.id) ?? 0, r.need));
    }
    for (const id of SERVICE_SUPPLY_RULES.placeSetting)
      want.set(id, Math.max(want.get(id) ?? 0, perService));
    for (const [id, need] of want)
      stock = topUpSupply(stock, id, need - (stock[id]?.units ?? 0), kit);
    stock = topUpSupply(
      stock,
      SERVICE_SUPPLY_RULES.napkin,
      KIT_NAPKINS - (stock[SERVICE_SUPPLY_RULES.napkin]?.units ?? 0),
      kit,
    );
    const open = restaurantSuppliesOf(save);
    if (open.soapPct === 0)
      stock = topUpSupply(stock, "dish-soap", 1 - (stock["dish-soap"]?.units ?? 0), kit);
    if (open.cleanerPct === 0)
      stock = topUpSupply(
        stock,
        "cleaning-liquid",
        1 - (stock["cleaning-liquid"]?.units ?? 0),
        kit,
      );
  }

  if (isSystemLive("takeaway", atLevel)) {
    const takeaway = Math.max(
      KIT_PACKAGING,
      services.reduce(
        (n, s) =>
          n + s.tickets.filter((_, i) => orderServiceFor(s.levelNumber, i) === "takeaway").length,
        0,
      ),
    );
    const covered = packagingOrdersCovered({ ...save.business.supplies, stock });
    stock = topUpSupply(stock, ORDER_CONTAINER_PRIORITY[0]!, takeaway - covered.containers, kit);
    stock = topUpSupply(stock, ORDER_BAG_PRIORITY[0]!, takeaway - covered.bags, kit);
  }

  return {
    ...save,
    business: {
      ...save.business,
      inventory,
      supplies: { ...save.business.supplies, stock },
      restaurantMigration: {
        version: RESTAURANT_MIGRATION_VERSION,
        atLevel,
        kit,
        seen: kit.length === 0,
      },
    },
  };
}

/** The crate to welcome the player with, until they have seen it (null otherwise). */
export function unseenStarterCrate(save: SaveData): KitLine[] | null {
  const m = save.business.restaurantMigration;
  return m && !m.seen && m.kit.length > 0 ? m.kit : null;
}

/** Marks the welcome note as seen (a service started). */
export function markStarterCrateSeen(save: SaveData): SaveData {
  const m = save.business.restaurantMigration;
  if (!m || m.seen) return save;
  return { ...save, business: { ...save.business, restaurantMigration: { ...m, seen: true } } };
}
