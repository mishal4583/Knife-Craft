import { IconButton } from "../common/Buttons";
import { cn } from "@/lib/utils";
import type { DailyOrder, GameplayState } from "@/types/game";

/** Minimal in-play HUD. Never overlaps the cutting area. */
export function GameHUD({
  order,
  gameplay,
  totalPieces,
  onPause,
}: {
  order: DailyOrder;
  gameplay: GameplayState;
  totalPieces: number;
  onPause: () => void;
}) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        <div
          className="paper max-w-[64%] -rotate-[1.4deg] rounded-[10px] border border-walnut/20 px-3 py-2 shadow-soft"
          style={{ clipPath: "polygon(0 2%, 100% 0, 99% 100%, 1% 98%)" }}
        >
          <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-copper">
            {order.day}'s Order
          </p>
          <p className="truncate font-display text-[15px] font-black leading-tight text-walnut-dark">
            {order.name}
          </p>
          <p className="font-hand text-[14px] leading-tight text-walnut/80">
            {gameplay.ingredient.name} · {gameplay.cutProgress}/{totalPieces} {gameplay.technique.toLowerCase()}
          </p>
        </div>

        <IconButton label="Pause" tone="dark" onClick={onPause} className="h-9 w-9">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
            <rect x="14" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
          </svg>
        </IconButton>
      </div>

      <div className="absolute inset-x-0 top-[74px] z-20 flex justify-center gap-1.5">
        {Array.from({ length: totalPieces }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] w-6 rounded-full transition-colors duration-500",
              i < gameplay.cutProgress ? "bg-gold" : "bg-ivory/35",
            )}
          />
        ))}
      </div>
    </>
  );
}