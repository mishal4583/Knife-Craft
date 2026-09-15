/**
 * BOARD_MANAGER — pure logic over board ownership/purchase/equip, mirroring
 * src/game/knives/KnifeManager.ts. No I/O of its own: SaveManager remains
 * the only thing that touches storage. Every function takes a SaveData
 * snapshot and returns a decision or a new SaveData — the caller (App.tsx)
 * persists it.
 */
import type { SaveData } from "../SaveManager";
import { findBoard } from "./boardDefinitions";
import type { BoardDefinition } from "./boardTypes";

/** Level ids are formatted "level-N" (LevelManager) — no numeric field exists on LevelProgress, so the reached level is parsed from the id suffix. */
function highestReachedLevelNumber(save: SaveData): number {
  const match = /-(\d+)$/.exec(save.levelProgress.highestUnlockedLevelId);
  return match ? Number(match[1]) : 1;
}

export function getBoard(id: string): BoardDefinition | undefined {
  return findBoard(id);
}

export function isOwned(id: string, save: SaveData): boolean {
  return save.ownedBoardIds.includes(id);
}

export function isLevelUnlocked(id: string, save: SaveData): boolean {
  const def = findBoard(id);
  if (!def) return false;
  return highestReachedLevelNumber(save) >= def.unlockLevel;
}

export type BoardPurchaseState =
  | "equipped"
  | "owned"
  /** Level requirement not yet met — shown as LOCKED, price hidden. */
  | "locked"
  /** Unlocked and affordable — shown as BUY. */
  | "affordable"
  /** Unlocked but not enough Café Coins yet — still shown as BUY (never as unavailable). */
  | "tooExpensive";

export function getBoardPurchaseState(id: string, save: SaveData): BoardPurchaseState {
  if (save.equippedBoardId === id) return "equipped";
  if (isOwned(id, save)) return "owned";
  if (!isLevelUnlocked(id, save)) return "locked";
  const def = findBoard(id);
  if (!def) return "locked";
  return save.credits >= def.price ? "affordable" : "tooExpensive";
}

export function canBuy(id: string, save: SaveData): boolean {
  const def = findBoard(id);
  if (!def) return false;
  return !isOwned(id, save) && isLevelUnlocked(id, save) && save.credits >= def.price;
}

export type BuyBoardResult =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "alreadyOwned" | "notUnlocked" | "insufficientFunds" | "unknownBoard" };

/** Never mutates `save` — returns a fresh object on success. Never auto-equips (buy and equip stay separate actions). */
export function buyBoard(id: string, save: SaveData): BuyBoardResult {
  const def = findBoard(id);
  if (!def) return { ok: false, reason: "unknownBoard" };
  if (isOwned(id, save)) return { ok: false, reason: "alreadyOwned" };
  if (!isLevelUnlocked(id, save)) return { ok: false, reason: "notUnlocked" };
  if (save.credits < def.price) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - def.price,
      ownedBoardIds: [...save.ownedBoardIds, id],
    },
  };
}

export function canEquip(id: string, save: SaveData): boolean {
  return isOwned(id, save);
}

export type EquipBoardResult =
  { ok: true; save: SaveData } | { ok: false; reason: "notOwned" | "unknownBoard" };

export function equipBoard(id: string, save: SaveData): EquipBoardResult {
  const def = findBoard(id);
  if (!def) return { ok: false, reason: "unknownBoard" };
  if (!isOwned(id, save)) return { ok: false, reason: "notOwned" };
  return { ok: true, save: { ...save, equippedBoardId: id } };
}

export function getOwnedBoards(save: SaveData): BoardDefinition[] {
  return save.ownedBoardIds.map((id) => findBoard(id)).filter((b): b is BoardDefinition => !!b);
}

export function getEquippedBoard(save: SaveData): BoardDefinition | undefined {
  return findBoard(save.equippedBoardId);
}
