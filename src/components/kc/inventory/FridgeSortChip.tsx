import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { piecesWaiting, roundFor } from "@/game/business/fridgeSort";
import { unpackLocked } from "@/game/business/deliveryFlow";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { ScreenId } from "../data";

/**
 * "🧊 Fridge Sort · 6" (developer 2026-11-08: was "Unpack delivery", before that "Put it away"): the entry to Fridge Sort (business/fridgeSort.ts), shown in the Market's Ingredients tab and above the Inventory fridge
 * while a basket of food waits and the game is open (Level 3). The number is the loose pieces to sort. It is a small chip, never a popup, and nothing waits on it (plan §2.2).
 */
export function FridgeSortChip({
  save,
  go,
  className,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
  className?: string;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  if (!roundFor(save, level)) return null;
  const waiting = piecesWaiting(save);
  // The delivery is checked BEFORE it is unpacked (developer 2026-11-11): while baskets wait for the check the chip is locked, and a tap
  // sends the player to the check (App.go).
  const locked = unpackLocked(save, level);
  return (
    <button
      type="button"
      data-testid="fridge-sort-chip"
      data-state={locked ? "locked" : "open"}
      onClick={() => go("fridge-sort")}
      className={cn(
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 font-ui text-[14px] font-extrabold shadow-soft",
        locked
          ? "border-walnut/20 bg-ivory/60 text-walnut/60"
          : "border-[#b8873f] bg-[linear-gradient(170deg,#f7e3b0,#e8c27a)] text-walnut-dark",
        className,
      )}
    >
      <span aria-hidden>{locked ? "🔒" : "🧊"}</span> Fridge Sort · {waiting}
      {locked ? <span className="text-[12px] font-bold">· check it first</span> : null}
    </button>
  );
}
