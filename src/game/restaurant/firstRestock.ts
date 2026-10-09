/**
 * FIRST RESTOCK (audit 2026-10-08; progression-based since the Pass 2
 * review, developer 2026-10-09) — the Pre-Service Check introduces the
 * normal stock routine on the FIRST service that runs on real stock
 * (`ingredient-stock`, Level 15): Grandma's leftovers and the Level 13
 * top-up got the player this far; from here every service is checked
 * against the fridge and what's missing is bought in the Market.
 *
 * Derived from the save's level progress, never stored: it shows while no
 * level that uses stock has been completed yet. It no longer depends on the
 * fridge being empty (Grandma's leftovers and the top-up fill it before
 * Level 15), so a returning player or an older save that already finished
 * a stock level never sees it again.
 */
import type { SaveData } from "../SaveManager";
import { levelNumber } from "../levels/levelMastery";
import { serviceUsesStock } from "./campaignStock";

/** True on the first service that runs on real stock (no stock-using level completed yet). */
export function isFirstStockService(save: Pick<SaveData, "levelProgress">, level: number): boolean {
  return (
    serviceUsesStock(level) &&
    !save.levelProgress.completedLevelIds.some((id) => serviceUsesStock(levelNumber(id)))
  );
}
