import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { fridgeSortOf, roundFor } from "@/game/business/fridgeSort";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { ScreenId } from "../data";

/**
 * "📦 Put it away · 6": the entry to Fridge Sort (business/fridgeSort.ts), shown in the Market's Ingredients tab and above the Inventory fridge
 * while a crate of food waits and the game is open (Level 14). It is a small chip, never a popup, and nothing waits on it (plan §2.2).
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
  const waiting = fridgeSortOf(save).crate?.length ?? 0;
  return (
    <button
      type="button"
      data-testid="fridge-sort-chip"
      onClick={() => go("fridge-sort")}
      className={cn(
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#b8873f] bg-[linear-gradient(170deg,#f7e3b0,#e8c27a)] px-4 font-ui text-[14px] font-extrabold text-walnut-dark shadow-soft",
        className,
      )}
    >
      <span aria-hidden>📦</span> Put it away · {waiting}
    </button>
  );
}
