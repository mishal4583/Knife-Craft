/**
 * KITCHEN_UPGRADE_DEFINITIONS — the single authoritative kitchen upgrade
 * catalog (Phase 12B), mirroring src/game/boards/boardDefinitions.ts in
 * shape. Names/required levels/asset mapping are the phase brief's exact
 * spec — the six tiers ARE the six existing kitchen background images,
 * nothing more.
 *
 * NO PRICE — Phase 14 removed per-tier Café Coin cost. These six images
 * are mandatory progression milestones, not optional shop purchases: the
 * player should never have to grind coins to see the kitchen they were
 * always going to reach by playing. Reaching `unlockLevel` grants the
 * tier automatically (KitchenUpgradeManager.syncKitchenUpgradeOwnership).
 */
import type { KitchenUpgradeDefinition } from "./kitchenUpgradeTypes";

export const DEFAULT_KITCHEN_UPGRADE_ID = "humble-kitchen" as const;

export const KITCHEN_UPGRADE_CATALOG: KitchenUpgradeDefinition[] = [
  {
    id: "humble-kitchen",
    name: "Humble Kitchen",
    tagline: "Where you started",
    description: "A small, honest kitchen — everything you need, nothing you don't.",
    unlockLevel: 1,
    asset: "skin-01",
  },
  {
    id: "growing-kitchen",
    name: "Growing Kitchen",
    tagline: "A little more room",
    description: "More counter space, more light — the kitchen is starting to fill out.",
    unlockLevel: 21,
    asset: "skin-02",
  },
  {
    id: "established-kitchen",
    name: "Established Kitchen",
    tagline: "A kitchen that's found its rhythm",
    description: "Well-worn and well-loved, with the settled feel of real routine.",
    unlockLevel: 41,
    asset: "skin-03",
  },
  {
    id: "neighborhood-cafe",
    name: "Neighborhood Café",
    tagline: "Open to the street",
    description: "The kitchen opens up into a proper neighborhood café.",
    unlockLevel: 51,
    asset: "skin-04",
  },
  {
    id: "flourishing-cafe",
    name: "Flourishing Café",
    tagline: "Busy, warm, alive",
    description: "A café in full bloom — every corner doing something.",
    unlockLevel: 71,
    asset: "skin-05",
  },
  {
    id: "grand-kitchen",
    name: "Grand Kitchen",
    tagline: "The dream, realized",
    description: "The finished kitchen — everything you imagined when you started.",
    unlockLevel: 91,
    asset: "skin-06",
  },
];

export function findKitchenUpgrade(id: string): KitchenUpgradeDefinition | undefined {
  return KITCHEN_UPGRADE_CATALOG.find((u) => u.id === id);
}

export function kitchenUpgradeOrDefault(id: string): KitchenUpgradeDefinition {
  return findKitchenUpgrade(id) ?? KITCHEN_UPGRADE_CATALOG[0]!;
}
