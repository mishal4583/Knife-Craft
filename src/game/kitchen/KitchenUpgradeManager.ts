/**
 * KITCHEN_UPGRADE_MANAGER — pure logic over kitchen-upgrade progression.
 * Ownership is granted automatically by reaching a tier's unlock level,
 * never bought with credits (Phase 14 — see kitchenUpgradeDefinitions.ts's
 * header comment). A kitchen upgrade is PERMANENT, not a skin: the kitchen
 * shown is always the highest tier reached (`equippedKitchenUpgradeId` is
 * kept in step by syncKitchenUpgradeOwnership), and there is no way to go
 * back to an earlier one. No I/O of its own: SaveManager remains the
 * only thing that touches storage. Every function takes a SaveData
 * snapshot and returns a decision or a new SaveData — the caller
 * (App.tsx) persists it.
 */
import type { SaveData } from "../SaveManager";
import { KITCHEN_UPGRADE_CATALOG, findKitchenUpgrade } from "./kitchenUpgradeDefinitions";
import type { KitchenUpgradeDefinition } from "./kitchenUpgradeTypes";
import { debitWallet } from "../economy/wallet";

/** Level ids are formatted "level-N" — the same parsing Knife/Board/CafeProgressionManager already use for their own level-gated unlocks. */
function highestReachedLevelNumber(save: SaveData): number {
  const match = /-(\d+)$/.exec(save.levelProgress.highestUnlockedLevelId);
  return match ? Number(match[1]) : 1;
}

export function getKitchenUpgrade(id: string): KitchenUpgradeDefinition | undefined {
  return findKitchenUpgrade(id);
}

export function isKitchenUpgradeOwned(id: string, save: SaveData): boolean {
  return save.ownedKitchenUpgradeIds.includes(id);
}

export function isKitchenUpgradeLevelUnlocked(id: string, save: SaveData): boolean {
  const def = findKitchenUpgrade(id);
  if (!def) return false;
  return highestReachedLevelNumber(save) >= def.unlockLevel;
}

export type KitchenUpgradeState =
  /** The kitchen the player has now — the highest tier built. */
  | "current"
  /** An earlier tier the kitchen has already grown past. */
  | "past"
  /** Level reached and the previous tier built — can be built now (if affordable). */
  | "available"
  /** Level reached, but the previous tier isn't built yet. */
  | "needsPrevious"
  /** Level requirement not yet met — shown as LOCKED. */
  | "locked";

export function getKitchenUpgradeState(id: string, save: SaveData): KitchenUpgradeState {
  if (save.equippedKitchenUpgradeId === id) return "current";
  if (isKitchenUpgradeOwned(id, save)) return "past";
  if (!isKitchenUpgradeLevelUnlocked(id, save)) return "locked";
  const index = KITCHEN_UPGRADE_CATALOG.findIndex((u) => u.id === id);
  const previous = index > 0 ? KITCHEN_UPGRADE_CATALOG[index - 1]! : null;
  return previous && !isKitchenUpgradeOwned(previous.id, save) ? "needsPrevious" : "available";
}

/**
 * Economy V2.5 — keeps the kitchen on the highest tier the player OWNS
 * (catalog order), so building a tier moves the kitchen onto it for good.
 * It no longer grants tiers by level: tiers are bought
 * (purchaseKitchenUpgrade). Returns `save` itself when nothing changes.
 */
export function syncKitchenUpgradeOwnership(save: SaveData): SaveData {
  const owned = new Set(save.ownedKitchenUpgradeIds);
  owned.add(KITCHEN_UPGRADE_CATALOG[0]!.id);
  // Preserve catalog order rather than insertion order — keeps
  // ownedKitchenUpgradeIds readable in the saved JSON, and makes the last
  // owned entry the highest tier.
  const ownedKitchenUpgradeIds = KITCHEN_UPGRADE_CATALOG.filter((def) => owned.has(def.id)).map(
    (def) => def.id,
  );
  const current =
    ownedKitchenUpgradeIds[ownedKitchenUpgradeIds.length - 1] ?? save.equippedKitchenUpgradeId;
  if (
    ownedKitchenUpgradeIds.length === save.ownedKitchenUpgradeIds.length &&
    ownedKitchenUpgradeIds.every((id, i) => save.ownedKitchenUpgradeIds[i] === id) &&
    current === save.equippedKitchenUpgradeId
  )
    return save;
  return { ...save, ownedKitchenUpgradeIds, equippedKitchenUpgradeId: current };
}

/** Save version from which kitchen tiers are bought instead of granted by level. */
export const KITCHEN_DEVELOPMENT_SAVE_VERSION = 3;

/**
 * One-time migration for saves written before Economy V2.5, when every
 * tier was granted free on reaching its level: such a save keeps every
 * tier its level entitled it to (even if it was never re-saved after
 * reaching it), then moves to the current version. Idempotent — a save at
 * the current version is returned unchanged.
 */
export function migrateKitchenDevelopment(save: SaveData): SaveData {
  if (save.version >= KITCHEN_DEVELOPMENT_SAVE_VERSION) return save;
  const highest = highestReachedLevelNumber(save);
  const owned = new Set(save.ownedKitchenUpgradeIds);
  for (const def of KITCHEN_UPGRADE_CATALOG) {
    if (highest >= def.unlockLevel) owned.add(def.id);
  }
  return syncKitchenUpgradeOwnership({
    ...save,
    version: KITCHEN_DEVELOPMENT_SAVE_VERSION,
    ownedKitchenUpgradeIds: [...owned],
  });
}

export type PurchaseKitchenUpgradeResult =
  | { ok: true; save: SaveData; price: number }
  | {
      ok: false;
      reason:
        "unknownUpgrade" | "alreadyOwned" | "notUnlocked" | "needsPrevious" | "insufficientFunds";
    };

/**
 * Builds one kitchen tier — atomic, mirroring KnifeManager.buyKnife: either
 * credits drop by exactly its price AND it becomes the current kitchen, or
 * nothing changes. Tiers are built in order (each grows the previous one),
 * only once their level is reached, and never on credit — the caller
 * (App.tsx) records the "kitchen-investment-purchase" ledger entry.
 */
export function purchaseKitchenUpgrade(save: SaveData, id: string): PurchaseKitchenUpgradeResult {
  const def = findKitchenUpgrade(id);
  if (!def) return { ok: false, reason: "unknownUpgrade" };
  const state = getKitchenUpgradeState(id, save);
  if (state === "current" || state === "past") return { ok: false, reason: "alreadyOwned" };
  if (state === "locked") return { ok: false, reason: "notUnlocked" };
  if (state === "needsPrevious") return { ok: false, reason: "needsPrevious" };
  const paid = debitWallet(save, def.price);
  if (!paid.ok) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: syncKitchenUpgradeOwnership({
      ...paid.save,
      ownedKitchenUpgradeIds: [...save.ownedKitchenUpgradeIds, def.id],
    }),
    price: def.price,
  };
}

export function getOwnedKitchenUpgrades(save: SaveData): KitchenUpgradeDefinition[] {
  return save.ownedKitchenUpgradeIds
    .map((id) => findKitchenUpgrade(id))
    .filter((u): u is KitchenUpgradeDefinition => !!u);
}

export function getEquippedKitchenUpgrade(save: SaveData): KitchenUpgradeDefinition | undefined {
  return findKitchenUpgrade(save.equippedKitchenUpgradeId);
}
