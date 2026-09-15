/**
 * KITCHEN_UPGRADE_MANAGER — pure logic over kitchen-upgrade ownership/
 * equip. Same shape as src/game/boards/BoardManager.ts, minus a purchase
 * step (Phase 14 — see kitchenUpgradeDefinitions.ts's header comment):
 * ownership is granted automatically by reaching a tier's unlock level,
 * never bought with credits. No I/O of its own: SaveManager remains the
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
  | "equipped"
  | "owned"
  /** Level requirement not yet met — shown as LOCKED. */
  | "locked";

export function getKitchenUpgradeState(id: string, save: SaveData): KitchenUpgradeState {
  if (save.equippedKitchenUpgradeId === id) return "equipped";
  if (isKitchenUpgradeOwned(id, save)) return "owned";
  return "locked";
}

/**
 * The one place that grants kitchen-upgrade ownership. Pure and
 * idempotent — safe to call on every save mutation and on every load, so
 * ownership is always a deterministic function of level progress, never
 * a one-time purchase action tied to a particular session. Never removes
 * a tier the player already owns (e.g. after a hand-edited/downgraded
 * save), and never touches `equippedKitchenUpgradeId` — newly-granted
 * tiers become available to equip, they don't auto-equip themselves.
 */
export function syncKitchenUpgradeOwnership(save: SaveData): SaveData {
  const highest = highestReachedLevelNumber(save);
  const owned = new Set(save.ownedKitchenUpgradeIds);
  let changed = false;
  for (const def of KITCHEN_UPGRADE_CATALOG) {
    if (highest >= def.unlockLevel && !owned.has(def.id)) {
      owned.add(def.id);
      changed = true;
    }
  }
  if (!changed) return save;
  // Preserve catalog order rather than insertion order — cosmetic only,
  // keeps ownedKitchenUpgradeIds readable in the saved JSON.
  const ownedKitchenUpgradeIds = KITCHEN_UPGRADE_CATALOG.filter((def) => owned.has(def.id)).map(
    (def) => def.id,
  );
  return { ...save, ownedKitchenUpgradeIds };
}

export function canEquipKitchenUpgrade(id: string, save: SaveData): boolean {
  return isKitchenUpgradeOwned(id, save);
}

export type EquipKitchenUpgradeResult =
  { ok: true; save: SaveData } | { ok: false; reason: "notOwned" | "unknownUpgrade" };

export function equipKitchenUpgrade(id: string, save: SaveData): EquipKitchenUpgradeResult {
  const def = findKitchenUpgrade(id);
  if (!def) return { ok: false, reason: "unknownUpgrade" };
  if (!isKitchenUpgradeOwned(id, save)) return { ok: false, reason: "notOwned" };
  return { ok: true, save: { ...save, equippedKitchenUpgradeId: id } };
}

export function getOwnedKitchenUpgrades(save: SaveData): KitchenUpgradeDefinition[] {
  return save.ownedKitchenUpgradeIds
    .map((id) => findKitchenUpgrade(id))
    .filter((u): u is KitchenUpgradeDefinition => !!u);
}

export function getEquippedKitchenUpgrade(save: SaveData): KitchenUpgradeDefinition | undefined {
  return findKitchenUpgrade(save.equippedKitchenUpgradeId);
}
