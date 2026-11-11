import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { isPracticeOpen, pinsOf } from "@/game/restaurant/fridgeCheck";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { ScreenId } from "../data";

/**
 * "🔍 Fridge Check": the free entry to Fridge Check (restaurant/fridgeCheck.ts) above the Inventory fridge, once freshness is live
 * and there is stock to judge. The real closing-night game opens from the two night chores (only about one night in three is a judging night),
 * so this is how a player plays it any time: the same deck from the real stock, no reward, nothing changes. A small chip, never a popup.
 */
export function FridgeCheckChip({
  save,
  go,
  className,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
  className?: string;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  if (!isPracticeOpen(save, level)) return null;
  const pins = pinsOf(save);
  return (
    <button
      type="button"
      data-testid="fridge-check-chip"
      onClick={() => go("fridge-check")}
      className={cn(
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#6aa5b8] bg-[linear-gradient(170deg,#e3f2f6,#b9d9e3)] px-4 font-ui text-[14px] font-extrabold text-walnut-dark shadow-soft",
        className,
      )}
    >
      <span aria-hidden>🔍</span> Fridge Check
      {pins > 0 ? <span className="text-[12px] font-bold text-walnut/70">· 📍 {pins}</span> : null}
    </button>
  );
}
