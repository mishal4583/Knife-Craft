/**
 * WHAT TO DO BETWEEN CUSTOMERS (developer 2026-11-08: "after a serve don't display the Next Customer button for at least 20 levels, so the
 * players do other things on the way back to the Kitchen instead of only cutting ingredients"). For the first
 * `NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL` levels the served card has no "Next Customer": the player goes back to the Kitchen (the next
 * customer waits there, "Open for service") and the card offers up to three real things to do on the way, chosen from the live state:
 *
 *   unpack the delivery · stock the shelves · restock the Market · clean · collect upstairs · open the menu
 *
 * Pure: it reads the save and moves nothing. Each chip is a screen id the app opens (the same ids Paige and the guide use).
 */
import type { SaveData } from "../SaveManager";
import { NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL } from "../config/earlyLevels";
import { roundFor as fridgeRound, piecesWaiting } from "../business/fridgeSort";
import { roundFor as stockroomRound } from "../business/stockroomSort";
import { marketPlanFor } from "./marketPlan";
import { cleanlinessOf, isCleanlinessLive, TASK_RULES } from "./cleanliness";
import { floorEarnings, isSecondFloorOpen } from "./secondFloor";
import { firstMachineGuide } from "./floorGuide";
import { restaurantLevelOf } from "./restaurantMenu";

export type AfterServeChip = {
  id: "unpack" | "stock" | "restock" | "clean" | "floor";
  icon: string;
  label: string;
  /** The screen id the app opens (`go`). */
  to: string;
};

/** True while the served card hides "Next Customer" (`levelNumber` is the campaign level just served). */
export const nextCustomerHidden = (levelNumber: number): boolean =>
  levelNumber <= NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL;

export const MAX_AFTER_SERVE_CHIPS = 3;

export function afterServeChips(save: SaveData, now: number = Date.now()): AfterServeChip[] {
  const level = restaurantLevelOf(save.levelProgress);
  const out: AfterServeChip[] = [];
  const waiting = piecesWaiting(save);
  if (waiting > 0 && fridgeRound(save, level))
    out.push({
      id: "unpack",
      icon: "🧊",
      label: `Fridge Sort · ${waiting}`,
      to: "fridge-sort",
    });
  if (stockroomRound(save, level))
    out.push({ id: "stock", icon: "🗄️", label: "Stock the shelves", to: "stockroom-sort" });
  if (isSecondFloorOpen(level)) {
    const waitingCents = floorEarnings(save, now);
    const guide = firstMachineGuide(save, level, save.credits + waitingCents);
    if (waitingCents > 0 || guide?.stage === "buy")
      out.push({ id: "floor", icon: "⬆️", label: "2nd floor", to: "second-floor" });
  }
  if (isCleanlinessLive(level)) {
    const open = cleanlinessOf(save).tasks.filter((t) => TASK_RULES[t.kind].phase !== "opening");
    if (open.length > 0)
      out.push({
        id: "clean",
        icon: "🧽",
        label: `Clean · ${open.length}`,
        to: "business-cleanliness",
      });
  }
  if (marketPlanFor(save, 1).rows.length > 0)
    out.push({ id: "restock", icon: "🛒", label: "Restock", to: "shop" });
  return out.slice(0, MAX_AFTER_SERVE_CHIPS);
}
