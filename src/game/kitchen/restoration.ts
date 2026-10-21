import { KITCHEN_UPGRADE_CATALOG } from "./kitchenUpgradeDefinitions";

/**
 * RESTORATION — Phase 5 (A, developer 2026-10-21): the family restaurant's
 * restoration, read straight from the existing kitchen tiers.
 *
 * SOURCE OF TRUTH: `save.equippedKitchenUpgradeId` — the highest tier BUILT
 * (KitchenUpgradeManager.purchaseKitchenUpgrade, atomic with its ledger
 * entry; syncKitchenUpgradeOwnership keeps it on the highest owned). The
 * Kitchen screen already paints that tier's own art (KitchenBackground, one
 * painted skin per tier) and the restaurant map its map art
 * (kitchenMapArt.ts). This module adds no state and no tier: it names the
 * four restoration stages the six tiers fall into, and says what each tier's
 * painting changed — so a build can be shown as a before-and-after reveal.
 *
 *   Humble Kitchen                       → Inherited Kitchen
 *   Growing Kitchen                      → Cleaning & Repair
 *   Established Kitchen, Neighborhood Café → Improved Kitchen
 *   Flourishing Café, Grand Kitchen      → Restored Family Restaurant
 *
 * A build that moves the kitchen into a new STAGE is a major reveal (the
 * full before-and-after); a build within a stage gets the short one. Every
 * line below describes what the tier's painted art actually shows; the
 * things every painting keeps are FAMILY_OBJECTS.
 */
export type RestorationStageId = "inherited" | "cleaning-repair" | "improved" | "restored";

export const RESTORATION_STAGES: Record<RestorationStageId, { name: string; line: string }> = {
  inherited: {
    name: "Inherited Kitchen",
    line: "Just as it was left to you — quiet, a little bare, still full of their things.",
  },
  "cleaning-repair": {
    name: "Cleaning & Repair",
    line: "Scrubbed, restocked and polished — the kitchen remembers how to work.",
  },
  improved: {
    name: "Improved Kitchen",
    line: "Better light, more to cook with, and the room opening up to guests.",
  },
  restored: {
    name: "Restored Family Restaurant",
    line: "Warm, busy and whole again — the restaurant they dreamed of.",
  },
};

/** What every painted stage keeps — the family's own kitchen, never replaced. */
export const FAMILY_OBJECTS =
  "the arched window, the long wooden worktop, the green cupboards and the copper pans";

export type TierChanges = {
  stage: RestorationStageId;
  /** What the tier's painting changed, by kind (only the kinds it really changes). */
  lighting?: string;
  equipment?: string;
  workstation?: string;
  furniture?: string;
};

/** Per tier id, in catalog order. */
export const TIER_RESTORATION: Record<string, TierChanges> = {
  "humble-kitchen": { stage: "inherited" },
  "growing-kitchen": {
    stage: "cleaning-repair",
    equipment: "A full knife rack and the copper pans polished and hung",
    workstation: "Shelves cleared, cleaned and restocked with jars",
    lighting: "Warmer light through the window",
  },
  "established-kitchen": {
    stage: "improved",
    furniture: "A family picture back on the wall and herbs along the sill",
    workstation: "Grandma's recipe book open on the counter",
    equipment: "More pots and tools within reach",
  },
  "neighborhood-cafe": {
    stage: "improved",
    lighting: "Pendant lights over the counter",
    furniture: "A plate rack and open shelves of dishes",
    workstation: "The kitchen opens through to the café",
  },
  "flourishing-cafe": {
    stage: "restored",
    lighting: "Lamps along the walls and over the counter",
    workstation: "Crates of fresh produce and bread on the counter",
    furniture: "Shelves full from floor to ceiling",
  },
  "grand-kitchen": {
    stage: "restored",
    lighting: "The whole room aglow under hanging lamps",
    furniture: "Every shelf full, the family portrait in its place",
    equipment: "A finished kitchen — everything you imagined when you started",
  },
};

export function stageOf(tierId: string | null | undefined): RestorationStageId {
  return (tierId && TIER_RESTORATION[tierId]?.stage) || "inherited";
}

/** A build from `from` to `to` is major when it reaches a new restoration stage. */
export function isMajorReveal(from: string, to: string): boolean {
  return stageOf(from) !== stageOf(to);
}

/** The improvement lines for a tier, in a fixed order (lighting, equipment, workstation, furniture). */
export function tierChangeLines(tierId: string): { kind: string; icon: string; text: string }[] {
  const t = TIER_RESTORATION[tierId];
  if (!t) return [];
  const rows: [keyof TierChanges, string, string][] = [
    ["lighting", "💡", "Lighting"],
    ["equipment", "🍳", "Equipment"],
    ["workstation", "🔪", "Workstation"],
    ["furniture", "🪑", "Furniture"],
  ];
  return rows.flatMap(([k, icon, kind]) => {
    const text = t[k];
    return typeof text === "string" && k !== "stage" ? [{ kind, icon, text }] : [];
  });
}

/** Every catalog tier has a restoration entry (checked by QA). */
export function restorationCoversCatalog(): boolean {
  return KITCHEN_UPGRADE_CATALOG.every((u) => u.id in TIER_RESTORATION);
}

/** Reveal timing (ms): how long the before shows, the wipe, and when it settles. */
export const REVEAL = {
  MAJOR: { HOLD: 700, WIPE: 1400 },
  MINOR: { HOLD: 350, WIPE: 800 },
} as const;
