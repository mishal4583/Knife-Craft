/**
 * NEXT KITCHEN UPGRADE — the Kitchen's progress strip (Transformation Phase C,
 * developer 2026-10-25: "show the next existing kitchen upgrade, its existing
 * price, and wallet progress"). Read-only over the existing tiers: the
 * catalog, its unlock levels and its price rule (`kitchenTierPrice`, the
 * restaurant's own prices) and the state rule the Kitchen Upgrades screen
 * already uses (`getKitchenUpgradeState`). No new price, reward or save field;
 * building still happens only on that screen.
 */
import type { SaveData } from "../SaveManager";
import { KITCHEN_UPGRADE_CATALOG } from "./kitchenUpgradeDefinitions";
import { getKitchenUpgradeState, type KitchenUpgradeState } from "./KitchenUpgradeManager";
import { kitchenTierPrice } from "../restaurant/restaurantInvestments";

export type NextKitchenUpgrade = {
  id: string;
  name: string;
  /** Its existing price for this save (cents). */
  price: number;
  unlockLevel: number;
  /** locked (level not reached) or available (can be built once affordable). */
  state: Extract<KitchenUpgradeState, "locked" | "available">;
  /** Wallet progress towards the price, 0–1. */
  progress: number;
  /** True when it can be built right now (level reached and affordable). */
  ready: boolean;
};

/** The first tier the kitchen hasn't built yet, or null once every tier is built. */
export function nextKitchenUpgrade(save: SaveData): NextKitchenUpgrade | null {
  const def = KITCHEN_UPGRADE_CATALOG.find((u) => {
    const s = getKitchenUpgradeState(u.id, save);
    return s !== "current" && s !== "past";
  });
  if (!def) return null;
  const s = getKitchenUpgradeState(def.id, save);
  const state = s === "locked" ? "locked" : "available";
  const price = kitchenTierPrice(def, save);
  const progress = price <= 0 ? 1 : Math.max(0, Math.min(1, save.credits / price));
  return {
    id: def.id,
    name: def.name,
    price,
    unlockLevel: def.unlockLevel,
    state,
    progress,
    ready: state === "available" && save.credits >= price,
  };
}
