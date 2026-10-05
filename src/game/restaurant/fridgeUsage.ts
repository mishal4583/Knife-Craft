/**
 * FRIDGE_USAGE — how full the refrigerator is, for the Pre-Service Check and
 * Inventory's Needs Attention (developer 2026-10-05 §9). The fridge tiers
 * are unchanged (Basic 40 · Commercial 80 · Professional 140,
 * RefrigeratorManager); this only reads them. Pure.
 */
import type { SaveData } from "../SaveManager";
import { getInventoryUsedCapacity, getRefrigeratorCapacity } from "../business/RefrigeratorManager";

/** At or above this share the fridge is "nearly full" (configurable). */
export const FRIDGE_NEARLY_FULL = 0.85;

export type FridgeUsage = {
  used: number;
  capacity: number;
  free: number;
  /** 0–1. */
  share: number;
  status: "ok" | "nearly-full" | "full";
};

export function fridgeUsage(save: SaveData): FridgeUsage {
  const used = getInventoryUsedCapacity(save.business.inventory);
  const capacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  const share = capacity > 0 ? used / capacity : 1;
  return {
    used,
    capacity,
    free: Math.max(0, capacity - used),
    share,
    status: used >= capacity ? "full" : share >= FRIDGE_NEARLY_FULL ? "nearly-full" : "ok",
  };
}
