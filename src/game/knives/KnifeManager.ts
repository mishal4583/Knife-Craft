/**
 * KNIFE_MANAGER — pure logic over knife ownership/purchase/equip. No I/O
 * of its own: SaveManager remains the only thing that touches storage.
 * Every function here takes a SaveData snapshot and returns a decision or
 * a new SaveData — the caller (App.tsx) persists it, exactly like
 * LevelManager.completeLevel already works.
 */
import type { SaveData } from "../SaveManager";
import { findKnife } from "./knifeDefinitions";

/** Level ids are formatted "level-N" (LevelManager) — no numeric field exists on LevelProgress, so the reached level is parsed from the id suffix. */
function highestReachedLevelNumber(save: SaveData): number {
  const match = /-(\d+)$/.exec(save.levelProgress.highestUnlockedLevelId);
  return match ? Number(match[1]) : 1;
}

export function isKnifeOwned(save: SaveData, knifeId: string): boolean {
  return save.ownedKnifeIds.includes(knifeId);
}

export function isKnifeLevelUnlocked(save: SaveData, knifeId: string): boolean {
  const def = findKnife(knifeId);
  if (!def) return false;
  return highestReachedLevelNumber(save) >= def.unlockLevel;
}

export type KnifePurchaseState =
  | "equipped"
  | "owned"
  /** Level requirement not yet met — shown as LOCKED, price hidden. */
  | "locked"
  /** Unlocked and affordable — shown as BUY. */
  | "affordable"
  /** Unlocked but not enough Café Coins yet — still shown as BUY (never as unavailable). */
  | "tooExpensive";

export function getKnifePurchaseState(save: SaveData, knifeId: string): KnifePurchaseState {
  if (save.equippedKnifeId === knifeId) return "equipped";
  if (isKnifeOwned(save, knifeId)) return "owned";
  if (!isKnifeLevelUnlocked(save, knifeId)) return "locked";
  const def = findKnife(knifeId);
  if (!def) return "locked";
  return save.credits >= def.price ? "affordable" : "tooExpensive";
}

export type BuyKnifeResult =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "alreadyOwned" | "notUnlocked" | "insufficientFunds" | "unknownKnife" };

/** Never mutates `save` — returns a fresh object on success, so App.tsx's persist() pattern (setSave + SaveManager.save) works unchanged. */
export function buyKnife(save: SaveData, knifeId: string): BuyKnifeResult {
  const def = findKnife(knifeId);
  if (!def) return { ok: false, reason: "unknownKnife" };
  if (isKnifeOwned(save, knifeId)) return { ok: false, reason: "alreadyOwned" };
  if (!isKnifeLevelUnlocked(save, knifeId)) return { ok: false, reason: "notUnlocked" };
  if (save.credits < def.price) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - def.price,
      ownedKnifeIds: [...save.ownedKnifeIds, knifeId],
    },
  };
}

export type EquipKnifeResult =
  { ok: true; save: SaveData } | { ok: false; reason: "notOwned" | "unknownKnife" };

/** Purchase and equip are deliberately separate actions (§"prefer BUY then EQUIP separately") — this never runs automatically after buyKnife. */
export function equipKnife(save: SaveData, knifeId: string): EquipKnifeResult {
  const def = findKnife(knifeId);
  if (!def) return { ok: false, reason: "unknownKnife" };
  if (!isKnifeOwned(save, knifeId)) return { ok: false, reason: "notOwned" };
  return { ok: true, save: { ...save, equippedKnifeId: knifeId } };
}
