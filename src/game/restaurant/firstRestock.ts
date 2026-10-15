/**
 * FIRST STOCK CHECK — the Pre-Service Check introduces the normal stock
 * routine on the first service using purchased ingredients (Level 3).
 *
 * Derived from the save's level progress, never stored: it shows while no
 * level that uses stock has been completed yet, then disappears.
 */
import type { SaveData } from "../SaveManager";
import { levelNumber } from "../levels/levelMastery";
import { serviceUsesStock } from "./campaignStock";

/** True on the first service using ingredients (no stock-using level completed yet). */
export function isFirstStockService(save: Pick<SaveData, "levelProgress">, level: number): boolean {
  return (
    serviceUsesStock(level) &&
    !save.levelProgress.completedLevelIds.some((id) => serviceUsesStock(levelNumber(id)))
  );
}
