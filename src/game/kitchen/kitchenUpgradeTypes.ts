/**
 * KITCHEN_UPGRADE_TYPES — data schema for the kitchen upgrade collection
 * (Phase 12B, purchase economy removed in Phase 14). Shaped like
 * src/game/knives/knifeTypes.ts / src/game/boards/boardTypes.ts, minus a
 * price — a kitchen upgrade is a progression milestone, not a shop item:
 * reaching its unlock level grants it automatically (see
 * KitchenUpgradeManager.syncKitchenUpgradeOwnership). Ownership and
 * equipped-state stay a real owned/equipped collection so the player can
 * still switch back to any previously-reached kitchen — only the "pay to
 * access a mandatory tier" step is gone.
 */

/** The six finished portrait kitchen background assets — internal filenames only (see KitchenBackground.tsx), never shown to the player. Kept as their own type here (moved from CafeProgressionManager.ts, which no longer picks a background directly from level progress). */
export type KitchenSkinId = "skin-01" | "skin-02" | "skin-03" | "skin-04" | "skin-05" | "skin-06";

export type KitchenUpgradeDefinition = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Numeric level requirement — 1 means available from the start. */
  unlockLevel: number;
  /** Which of the six background images this upgrade displays once equipped. */
  asset: KitchenSkinId;
};
