import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { badgesOf, roundFor, setsWaiting } from "@/game/business/stockroomSort";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { ScreenId } from "../data";

const stockroomUrl = (name: string) => `${import.meta.env.BASE_URL}business/stockroom/${name}.webp`;

/**
 * "🗄️ Stock the shelves · 6": the entry to Stockroom Sort (business/stockroomSort.ts), shown in the Market's supply tabs and at the top of
 * Inventory → Supplies while sets of supplies wait and the game is open (Level 10). The number is the sets of 3 to stock. A small chip, never
 * a popup, and nothing waits on it (plan 2026-11-06 §2).
 */
export function StockroomSortChip({
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
  const waiting = setsWaiting(save);
  return (
    <button
      type="button"
      data-testid="stockroom-sort-chip"
      onClick={() => go("stockroom-sort")}
      className={cn(
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#b8873f] bg-[linear-gradient(170deg,#f7e3b0,#e8c27a)] px-4 font-ui text-[14px] font-extrabold text-walnut-dark shadow-soft",
        className,
      )}
    >
      <img
        src={stockroomUrl("truck")}
        alt=""
        aria-hidden
        draggable={false}
        className="h-8 w-8 object-contain"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      Stock the shelves · {waiting}
    </button>
  );
}

/** The shelf badges Stockroom Sort has earned (every 3 three-star boards earn one): a row of small pins, purely a trophy. */
export function StockroomBadges({ save, className }: { save: SaveData; className?: string }) {
  const n = badgesOf(save);
  if (n <= 0) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      data-testid="stockroom-badges"
      aria-label={`${n} of 12 shelf badges`}
    >
      {Array.from({ length: n }, (_, i) => (
        <img
          key={i}
          src={stockroomUrl(`badge-${String(i + 1).padStart(2, "0")}`)}
          alt=""
          draggable={false}
          className="h-8 w-8 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ))}
      <span className="font-ui text-[11px] font-extrabold text-walnut/60">{n}/12</span>
    </div>
  );
}
