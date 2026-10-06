/**
 * RESTAURANT_INVESTMENTS — what buying things is WORTH in the unified
 * restaurant (final economy pass, developer 2026-10-06: "saving beats
 * buying — the investments themselves must become economically
 * meaningful"). Every number lives in RESTAURANT_INVESTMENT_RULES and was
 * chosen with scripts/economy-final-sim.mts (docs/ECONOMY_FINAL.md).
 *
 *  - KITCHEN TIERS cost less in the restaurant (`kitchenTierPrice`) and each
 *    built tier raises the restaurant's quality: a share of every campaign
 *    order's recipe earnings is added to its quality bonus (cumulative —
 *    the best tier built counts) and the bigger rooms seat more menu guests
 *    (`kitchenGuestSeats`, the staff's capacity still caps them).
 *  - EQUIPMENT adds a small quality share on top of its existing effects
 *    (knife/board stock savings and boosts stay as they were): Blacksmith
 *    mastery (steps forged across every knife), the knife roll and the
 *    board set owned (by catalog value) and the two prep helpers. Ownership,
 *    not what is equipped: a kitchen with a full, forged knife roll is a
 *    better kitchen whatever is in the hand today.
 *  - EMERGENCY SERVICE: a service run on Grandma's pantry or spares earns
 *    no quality bonus at all (restaurantEconomy.restaurantSettlement).
 *
 * Only the campaign's own orders (the settlement's quality bonus) use these
 * shares — never completion rewards, milestones, the Family Legacy, the
 * Replay Bonus, ads, menu guests' menu prices or the Endless Restaurant.
 *
 * A restaurant save is one stamped by the restaurant migration (only the
 * restaurant build stamps), so a release save keeps the release prices.
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { KitchenUpgradeDefinition } from "../kitchen/kitchenUpgradeTypes";
import { KITCHEN_UPGRADE_CATALOG } from "../kitchen/kitchenUpgradeDefinitions";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import {
  BLACKSMITH_STATS,
  MAX_UPGRADE_LEVEL,
  MIN_UPGRADE_LEVEL,
  getKnifeUpgrades,
} from "../knives/blacksmith";
import { dollars } from "../money";

export const RESTAURANT_INVESTMENT_RULES = {
  /** Restaurant-build kitchen tier prices (release: kitchenUpgradeDefinitions). */
  kitchenPrices: {
    "growing-kitchen": dollars(16_000),
    "established-kitchen": dollars(20_000),
    "neighborhood-cafe": dollars(21_000),
    "flourishing-cafe": dollars(24_000),
    "grand-kitchen": dollars(29_000),
  } as Record<string, number>,
  /** Quality share of the BEST tier built (cumulative restaurant quality). */
  kitchenQuality: {
    "growing-kitchen": 0.015,
    "established-kitchen": 0.03,
    "neighborhood-cafe": 0.04,
    "flourishing-cafe": 0.05,
    "grand-kitchen": 0.07,
  } as Record<string, number>,
  /** Extra menu-guest seats per service from the BEST tier built. */
  kitchenGuestSeats: {
    "neighborhood-cafe": 1,
    "flourishing-cafe": 1,
    "grand-kitchen": 2,
  } as Record<string, number>,
  /** Quality share at full Blacksmith mastery (every step on every knife). */
  blacksmithQuality: 0.02,
  /** Quality share of the whole knife roll / board set owned (by catalog value). */
  knifeRollQuality: 0.01,
  boardSetQuality: 0.01,
  /** Quality share per prep helper owned (the Quality Chef already gives +1 %). */
  helperQuality: { "prep-assistant": 0.005, "kitchen-assistant": 0.005 } as Record<string, number>,
};

/** True for a save that lives in the unified restaurant (stamped by its migration). */
export function isRestaurantSave(save: SaveData): boolean {
  return !!save.business?.restaurantMigration;
}

/** A kitchen tier's price for this save: the restaurant price in the restaurant, the catalog price otherwise. */
export function kitchenTierPrice(def: KitchenUpgradeDefinition, save: SaveData): number {
  if (!isRestaurantSave(save)) return def.price;
  return RESTAURANT_INVESTMENT_RULES.kitchenPrices[def.id] ?? def.price;
}

/** The best kitchen tier the save has built (the last owned in catalog order). */
function bestKitchenTier(save: SaveData): string | null {
  const owned = new Set(save.ownedKitchenUpgradeIds ?? []);
  let best: string | null = null;
  for (const def of KITCHEN_UPGRADE_CATALOG) if (owned.has(def.id)) best = def.id;
  return best;
}

export function kitchenQualityPct(save: SaveData): number {
  const best = bestKitchenTier(save);
  return best ? (RESTAURANT_INVESTMENT_RULES.kitchenQuality[best] ?? 0) : 0;
}

/** What building a tier gives, in words ("+7 % restaurant quality · +2 menu guest seats"); null for the first kitchen. */
export function kitchenTierBenefit(id: string): string | null {
  const R = RESTAURANT_INVESTMENT_RULES;
  const q = R.kitchenQuality[id] ?? 0;
  const seats = R.kitchenGuestSeats[id] ?? 0;
  if (q <= 0 && seats <= 0) return null;
  const parts = [
    q > 0 ? `+${Math.round(q * 1000) / 10}% restaurant quality on order earnings` : null,
    seats > 0 ? `+${seats} menu guest seat${seats === 1 ? "" : "s"} a service` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function kitchenGuestSeats(save: SaveData): number {
  const best = bestKitchenTier(save);
  return best ? (RESTAURANT_INVESTMENT_RULES.kitchenGuestSeats[best] ?? 0) : 0;
}

const STEPS_PER_KNIFE = BLACKSMITH_STATS.length * (MAX_UPGRADE_LEVEL - MIN_UPGRADE_LEVEL);

/** Blacksmith steps forged on owned knives ÷ every step on every catalog knife (0–1). */
export function blacksmithMastery(save: SaveData): number {
  const owned = new Set(save.ownedKnifeIds ?? []);
  let steps = 0;
  for (const k of KNIFE_CATALOG) {
    if (!owned.has(k.id)) continue;
    const lv = getKnifeUpgrades(save, k.id);
    for (const stat of BLACKSMITH_STATS) steps += lv[stat] - MIN_UPGRADE_LEVEL;
  }
  return steps / (STEPS_PER_KNIFE * KNIFE_CATALOG.length);
}

function ownedValueShare(
  catalog: readonly { id: string; price: number }[],
  owned: readonly string[] | undefined,
): number {
  const total = catalog.reduce((n, x) => n + x.price, 0);
  if (total <= 0) return 0;
  const have = new Set(owned ?? []);
  return catalog.reduce((n, x) => n + (have.has(x.id) ? x.price : 0), 0) / total;
}

export type EquipmentQuality = {
  blacksmith: number;
  knives: number;
  boards: number;
  helpers: number;
  total: number;
};

export function equipmentQuality(save: SaveData): EquipmentQuality {
  const R = RESTAURANT_INVESTMENT_RULES;
  const blacksmith = R.blacksmithQuality * blacksmithMastery(save);
  const knives = R.knifeRollQuality * ownedValueShare(KNIFE_CATALOG, save.ownedKnifeIds);
  const boards = R.boardSetQuality * ownedValueShare(BOARD_CATALOG, save.ownedBoardIds);
  const helpers = (save.ownedStaffIds ?? []).reduce((n, id) => n + (R.helperQuality[id] ?? 0), 0);
  return { blacksmith, knives, boards, helpers, total: blacksmith + knives + boards + helpers };
}

export type RestaurantQuality = {
  kitchen: number;
  equipment: EquipmentQuality;
  /** The kitchen and equipment shares together (the supplier's is added by the caller). */
  total: number;
};

/** The restaurant's quality shares from what the player has built and bought. */
export function restaurantQuality(save: SaveData): RestaurantQuality {
  const kitchen = kitchenQualityPct(save);
  const equipment = equipmentQuality(save);
  return { kitchen, equipment, total: kitchen + equipment.total };
}
