/**
 * CAFE_TYPES — data schema for the café progression foundation (Phase 10A).
 * This module defines the shape of café milestone data only — no logic
 * (that's CafeProgressionManager.ts) and no rendering (the future Kitchen
 * visual layer is a later phase, not this one, per the phase brief's
 * explicit scope limit).
 */

/** One café feature a milestone unlocks. Deliberately just an id/type/name — no visual/asset reference; that belongs to the future UI layer, not this data. */
export type CafeUnlockType =
  | "cutting_station"
  | "basic_kitchen"
  | "plants"
  | "coffee_station"
  | "cooking_station"
  | "bakery"
  | "customer_seating"
  | "garden"
  | "pasta_station"
  | "drinks_counter"
  | "fine_dining"
  | "grand_cafe"
  // Progression pass — Chapter 11/12 milestones (Levels 110/120). Same
  // shape as every earlier tier: an id/type/name descriptor only, no
  // asset — the six real kitchen background images (KITCHEN_UPGRADE_
  // CATALOG) stop at Level 91's "Grand Kitchen" on purpose (no 7th
  // background asset exists), so these two rely on the title/description
  // banner alone, exactly like every milestone already does everywhere
  // except the six that happen to also have a kitchen-upgrade tier.
  | "protein_station"
  | "grand_service";

export type CafeUnlock = {
  id: string;
  type: CafeUnlockType;
  name: string;
};

export type CafeMilestoneDefinition = {
  id: string;
  /** The campaign level number (parsed from LevelManager's "level-N" ids) a player must have reached to be AT this milestone. */
  levelRequired: number;
  title: string;
  description: string;
  unlocks: CafeUnlock[];
};
