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
  /** The kitchen the player has now — the highest tier reached. */
  | "current"
  /** An earlier tier the kitchen has already grown past. */
  | "past"
  /** Level requirement not yet met — shown as LOCKED. */
  | "locked";

export function getKitchenUpgradeState(id: string, save: SaveData): KitchenUpgradeState {
  if (save.equippedKitchenUpgradeId === id) return "current";
  if (isKitchenUpgradeOwned(id, save)) return "past";
  return "locked";
}

/**
 * The one place that grants kitchen-upgrade ownership. Pure and
 * idempotent — safe to call on every save mutation and on every load, so
 * ownership is always a deterministic function of level progress, never
 * a one-time purchase action tied to a particular session. Never removes
 * a tier the player already owns (e.g. after a hand-edited/downgraded
 * save).
 *
 * It also moves the kitchen onto the highest tier owned — an upgrade is
 * permanent, so reaching Established Kitchen replaces Growing Kitchen for
 * good. An older save that had picked an earlier tier is moved forward
 * the next time it loads; nothing ever moves it back.
 */
export function syncKitchenUpgradeOwnership(save: SaveData): SaveData {
  const highest = highestReachedLevelNumber(save);
  const owned = new Set(save.ownedKitchenUpgradeIds);
  for (const def of KITCHEN_UPGRADE_CATALOG) {
    if (highest >= def.unlockLevel) owned.add(def.id);
  }
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

export function getOwnedKitchenUpgrades(save: SaveData): KitchenUpgradeDefinition[] {
  return save.ownedKitchenUpgradeIds
    .map((id) => findKitchenUpgrade(id))
    .filter((u): u is KitchenUpgradeDefinition => !!u);
}

export function getEquippedKitchenUpgrade(save: SaveData): KitchenUpgradeDefinition | undefined {
  return findKitchenUpgrade(save.equippedKitchenUpgradeId);
}
