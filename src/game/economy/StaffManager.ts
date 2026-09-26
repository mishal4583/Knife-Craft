/**
 * STAFF_MANAGER — pure logic over Staff ownership/purchase, mirroring
 * KitchenInvestmentManager.ts exactly (Economy V2 Phase 7). No I/O of
 * its own: SaveManager remains the only thing that touches storage.
 *
 * No "equip" concept at all (unlike knives/boards, and unlike Kitchen
 * Investments' own single-purchase-per-tier shape too) — a staff member
 * is either owned or not, and every owned staff member's effect applies
 * simultaneously (see staff.ts's getStaffModifier). Staff are NOT
 * mutually exclusive by design (Phase 7 brief §6).
 */
import type { SaveData } from "../SaveManager";
import { getStaffMember, STAFF_CATALOG } from "./staffDefinitions";
import type { StaffDefinition } from "./staffDefinitions";

/** Level ids are formatted "level-N" (LevelManager) — mirrors every other manager's own identical helper (Knife/Board/KitchenInvestment). */
function highestReachedLevelNumber(save: SaveData): number {
  const match = /-(\d+)$/.exec(save.levelProgress.highestUnlockedLevelId);
  return match ? Number(match[1]) : 1;
}

export function isStaffOwned(save: SaveData, id: string): boolean {
  return save.ownedStaffIds.includes(id);
}

export function isStaffUnlocked(save: SaveData, id: string): boolean {
  const def = getStaffMember(id);
  if (!def) return false;
  return highestReachedLevelNumber(save) >= def.unlockLevel;
}

export type StaffPurchaseState = "owned" | "locked" | "affordable" | "tooExpensive";

export function getStaffPurchaseState(save: SaveData, id: string): StaffPurchaseState {
  if (isStaffOwned(save, id)) return "owned";
  if (!isStaffUnlocked(save, id)) return "locked";
  const def = getStaffMember(id);
  if (!def) return "locked";
  return save.credits >= def.price ? "affordable" : "tooExpensive";
}

export function canBuyStaff(id: string, save: SaveData): boolean {
  return getStaffPurchaseState(save, id) === "affordable";
}

export type BuyStaffResult =
  | { ok: true; save: SaveData }
  | { ok: false; reason: "alreadyOwned" | "notUnlocked" | "insufficientFunds" | "unknownStaff" };

/** Never mutates `save` — atomic: credits and ownedStaffIds change together in one object literal, or not at all. */
export function buyStaff(save: SaveData, id: string): BuyStaffResult {
  const def = getStaffMember(id);
  if (!def) return { ok: false, reason: "unknownStaff" };
  if (isStaffOwned(save, id)) return { ok: false, reason: "alreadyOwned" };
  if (!isStaffUnlocked(save, id)) return { ok: false, reason: "notUnlocked" };
  if (save.credits < def.price) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - def.price,
      ownedStaffIds: [...save.ownedStaffIds, id],
    },
  };
}

export function getOwnedStaff(save: SaveData): StaffDefinition[] {
  return STAFF_CATALOG.filter((s) => save.ownedStaffIds.includes(s.id));
}
