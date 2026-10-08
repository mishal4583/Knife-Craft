/**
 * FIRST RESTOCK (audit 2026-10-08) — the Pre-Service Check walks a player
 * through their first shopping trip (Market → Buy all → back → start) until
 * they have ever bought an ingredient. Derived from the save, never stored:
 * any ingredient purchase on record (the lifetime ledger total, or one still
 * in the ledger) or any stock in the fridge (a starter crate or Grandma's
 * pantry counts — the player has food to cook with) ends it.
 */
import type { SaveData } from "../SaveManager";

export function hasBoughtIngredients(save: SaveData): boolean {
  if ((save.economy?.lifetime?.["inventory-purchase"] ?? 0) !== 0) return true;
  if (save.economyLedger.some((e) => e.category === "inventory-purchase")) return true;
  return Object.values(save.business.inventory).some((e) => !!e && e.quantity > 0);
}
