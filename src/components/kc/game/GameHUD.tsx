import { IconButton } from "../common/Buttons";
import { cn } from "@/lib/utils";
import type { DailyOrder, GameplayState } from "@/types/game";

/** Minimal in-play HUD. Never overlaps the cutting area. */
export function GameHUD({
  order,
  gameplay,
  totalPieces,
  counts,
  progressByAxis,
  stepLabel,
  onPause,
}: {
  order: DailyOrder;
  gameplay: GameplayState;
  totalPieces: number;
  /** Non-null only for a grid technique (Dice) — knifecraft.html's updateHud() shows one pip row per axis instead of one combined row. */
  counts?: { h: number; v: number } | null;
  progressByAxis?: { h: number; v: number };
  /** Phase 5 — only set (and only rendered) for a multi-step session ("Step 2 of 3"); a single-step level (still the common case) shows nothing extra, matching "Level 1 should be almost immediate". */
  stepLabel?: string;
  onPause: () => void;
}) {
  const pipRows = counts
    ? [
        { n: counts.h, done: progressByAxis?.h ?? 0 },
        { n: counts.v, done: progressByAxis?.v ?? 0 },
      ]
    : [{ n: totalPieces, done: gameplay.cutProgress }];
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
            {gameplay.ingredient.name} · {gameplay.cutProgress}/{totalPieces}{" "}
            {gameplay.technique.toLowerCase()}
          </p>
          {/* Phase 2 — the chef's own short instruction (§12/§41),
              data-driven from the active recipe/level rather than
              hardcoded here or in PreparationScene. Harmless flavor text
              for campaign/daily/endless sessions too (level.subtitle),
              which is why this isn't gated behind a "service mode"
              flag. */}
          {order.note ? (
            <p className="mt-0.5 font-hand text-[12px] leading-snug text-copper/90">{order.note}</p>
          ) : null}
          {stepLabel ? (
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.14em] text-copper/70">
              {stepLabel}
            </p>
          ) : null}
        </div>

        {/* No size override here — IconButton's own default is the
            48x48dp Playables touch-target minimum (§2.17/§2.8); this
            override used to shrink it to 36x36, undershooting that. */}
        <IconButton label="Pause" tone="dark" onClick={onPause}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
            <rect x="14" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
          </svg>
        </IconButton>
      </div>

      <div className="absolute inset-x-0 top-[74px] z-20 flex flex-col items-center gap-1.5">
        {pipRows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1.5">
            {Array.from({ length: row.n }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[3px] w-6 rounded-full transition-colors duration-500",
                  i < row.done ? "bg-gold" : "bg-ivory/35",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
