import { getSupplyItem } from "@/game/business/businessSupplies";
import type { AttentionRow } from "@/game/restaurant/restaurantAttention";
import type { ScreenId } from "./data";
import { openMarketIngredients, openMarketSupplies } from "./marketFocus";
import { openStaffFor } from "./staffFocus";

/**
 * What tapping a "needs attention" row does, in ONE place (Inventory's panel and the Daily Maintenance list both use it): an ingredient opens
 * the Market on that ingredient, a supply on that supply, the fridge opens Equipment, and a missing person opens the Staff screen scrolled to
 * THAT person's card (marked "Needed now"), never just the top of the page.
 */
export function openAttentionRow(row: AttentionRow, go: (s: ScreenId) => void): void {
  const t = row.action;
  if (t.to === "ingredient") openMarketIngredients(go, t.id, t.quantity);
  else if (t.to === "supply")
    openMarketSupplies(go, getSupplyItem(t.id)?.section ?? "packaging", t.id);
  else if (t.to === "fridge") go("business-refrigerator");
  else openStaffFor(go, [t.id]);
}
