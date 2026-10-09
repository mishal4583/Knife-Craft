import { IconButton } from "../common/Buttons";
import { cn } from "@/lib/utils";
import type { DailyOrder, GameplayState } from "@/types/game";
import { starText, type ChecklistItem } from "@/game/restaurant/levelChecklist";

/** Pass 3: which checklist steps the card shows — all of a short list, else the current and next. */
function visibleSteps(list: ChecklistItem[]): { c: ChecklistItem; i: number }[] {
  const all = list.map((c, i) => ({ c, i }));
  if (list.length <= 3) return all;
  const now = list.findIndex((c) => c.state === "now");
  if (now === -1) return []; // all done: the summary says so
  return all.slice(now, now + 2);
}

/** How many later steps the compact checklist leaves out. */
function hiddenAfter(list: ChecklistItem[]): number {
  if (list.length <= 3) return 0;
  const now = list.findIndex((c) => c.state === "now");
  return now === -1 ? 0 : Math.max(0, list.length - (now + 2));
}

/**
 * Minimal in-play HUD. Never overlaps the cutting area.
 *
 * PHASE 7.1 (Bug A) — this used to stack the order card, the batch tip,
 * and the progress pips as three INDEPENDENT `absolute` layers, the
 * latter two pinned at hardcoded pixel offsets (`top-[68px]`/
 * `top-[102px]`) measured from a single-line card. The order card's real
 * height varies with its content (day/name/ingredient line/optional
 * `order.note`/optional `stepLabel`), so any card taller than that
 * hardcoded guess pushed its own bottom line — usually `stepLabel`
 * ("Step 1 of 2") — underneath the batch-tip banner. Fixed by making the
 * whole HUD one normal-flow flex column: every element reserves its own
 * real vertical space, so a taller card, a longer batch tip, or both
 * together push everything below them down instead of being overlapped.
 * The card + Pause button stay a single top row (Pause is never affected
 * by anything below it), matching brief §4's "no second HUD system" —
 * only the layout primitive changed, not the visual language.
 */
export function GameHUD({
  order,
  gameplay,
  totalPieces,
  counts,
  progressByAxis,
  peelFraction,
  stepLabel,
  batchHint,
  guide,
  onPause,
}: {
  order: DailyOrder;
  gameplay: GameplayState;
  totalPieces: number;
  /** Non-null only for a grid technique (Dice) — knifecraft.html's updateHud() shows one pip row per axis instead of one combined row. */
  counts?: { h: number; v: number } | null;
  progressByAxis?: { h: number; v: number };
  /** Peel steps only: how much of the skin is off, 0–1 (the scene's PEEL_PROGRESS). Shown as "% peeled" and a filling bar instead of a "0/1" count that only moves when the peel is done. */
  peelFraction?: number;
  /** Phase 5 — only set (and only rendered) for a multi-step session ("Step 2 of 3"); a single-step level (still the common case) shows nothing extra, matching "Level 1 should be almost immediate". */
  stepLabel?: string;
  /** Phase 3 §16 — a one-sentence batching hint, shown as a small standalone banner (not crammed into the order card, not an overlay) so it stays readable without covering the board. */
  batchHint?: string;
  /** Pass 3 (restaurant build, Levels 1–15, levelGoals.ts): the customer's line, the goal with the best stars, and a multi-step dish's checklist. Static text in the card — never a dialogue over the board. */
  guide?: {
    goal: string;
    graded: boolean;
    bestStars: 0 | 1 | 2 | 3 | null;
    customerLine: string;
    checklist: ChecklistItem[];
  };
  onPause: () => void;
}) {
  const pipRows = counts
    ? [
        { n: counts.h, done: progressByAxis?.h ?? 0 },
        { n: counts.v, done: progressByAxis?.v ?? 0 },
      ]
    : [{ n: totalPieces, done: gameplay.cutProgress }];
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-stretch gap-1.5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div
          className="paper max-w-[64%] -rotate-[1.4deg] rounded-[10px] border border-walnut/20 px-3 py-2 shadow-soft"
          style={{ clipPath: "polygon(0 2%, 100% 0, 99% 100%, 1% 98%)" }}
        >
          <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.18em] text-copper">
            {order.day}'s Order
          </p>
          <p className="truncate font-display text-[15.5px] font-black leading-tight text-walnut-dark">
            {order.name}
          </p>
          {guide ? (
            <p
              className="line-clamp-2 font-hand text-[13px] leading-snug text-walnut/75"
              data-testid="hud-customer-line"
            >
              “{guide.customerLine}”
            </p>
          ) : null}
          <p className="font-hand text-[15px] leading-tight text-walnut/80">
            {peelFraction !== undefined ? (
              <span data-testid="peel-progress">
                {gameplay.ingredient.name} · {Math.round(peelFraction * 100)}% peeled
              </span>
            ) : (
              <>
                {gameplay.ingredient.name} · {gameplay.cutProgress}/{totalPieces}{" "}
                {gameplay.technique.toLowerCase()}
              </>
            )}
          </p>
          {/* Phase 2 — the chef's own short instruction (§12/§41),
              data-driven from the active recipe/level rather than
              hardcoded here or in PreparationScene. Harmless flavor text
              for campaign/daily/endless sessions too (level.subtitle),
              which is why this isn't gated behind a "service mode"
              flag. */}
          {/* Pass 3: a multi-step dish's checklist lists the steps the chef's note
              repeats, so the note gives the card's room back to the board. */}
          {order.note && !(guide && guide.checklist.length > 0) ? (
            <p className="mt-0.5 font-hand text-[13px] leading-snug text-copper/90">{order.note}</p>
          ) : null}
          {/* Level 1–10 UX pass: the step / destination line sits on the card
              (it used to float under it at 9 px, 70% opacity — barely legible
              over the kitchen art). Still normal flow, no overlay. */}
          {stepLabel ? (
            <p
              className="mt-1 font-ui text-[11px] font-extrabold uppercase tracking-[0.12em] text-walnut/70"
              data-testid="hud-step"
            >
              {stepLabel}
            </p>
          ) : null}
          {guide && guide.checklist.length > 0 ? (
            <ul className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0" data-testid="hud-checklist">
              {/* Up to 3 steps: all of them. A longer dish (Bruschetta Trio, 6) shows
                  how many are done, the current one, the next one and how many are
                  left, so the card never grows over the board on a 320 px phone. */}
              {guide.checklist.length > 3 && guide.checklist.some((c) => c.state === "done") ? (
                <li
                  data-step-summary="done"
                  className="font-ui text-[11px] font-bold leading-[15px] text-olive"
                >
                  {guide.checklist.every((c) => c.state === "done")
                    ? `✓ all ${guide.checklist.length} done`
                    : `✓ ${guide.checklist.filter((c) => c.state === "done").length} done`}
                </li>
              ) : null}
              {visibleSteps(guide.checklist).map(({ c, i }) => (
                <li
                  key={i}
                  data-step-index={i}
                  data-step-state={c.state}
                  className={cn(
                    "font-ui text-[11px] font-bold leading-[15px]",
                    c.state === "done"
                      ? "text-olive"
                      : c.state === "now"
                        ? "text-walnut-dark"
                        : "text-walnut/45",
                  )}
                >
                  {c.state === "done" ? "✓" : c.state === "now" ? "▸" : "·"} {c.label}
                </li>
              ))}
              {hiddenAfter(guide.checklist) > 0 ? (
                <li
                  data-step-summary="more"
                  className="font-ui text-[11px] font-bold leading-[15px] text-walnut/45"
                >
                  +{hiddenAfter(guide.checklist)} more
                </li>
              ) : null}
            </ul>
          ) : null}
          {guide ? (
            <p
              className="mt-0.5 font-ui text-[11px] font-extrabold leading-[15px] text-copper"
              data-testid="hud-goal"
            >
              🎯 {guide.goal}
              {guide.graded ? (
                <span className="text-walnut/60">
                  {" "}
                  · best {guide.bestStars === null ? "—" : starText(guide.bestStars)}
                </span>
              ) : null}
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

      {/* Reserved as its own flow row (brief §2's "reserve explicit
          vertical space for the batch tip") instead of an absolutely
          positioned overlay — a 2-3 customer batch tip's longer text
          wraps here and simply grows this row, never the card above or
          the step/pips below it. */}
      {batchHint ? (
        <div className="flex justify-center px-2">
          <p className="paper max-w-full rounded-2xl border border-gold/40 bg-gold/20 px-3 py-1.5 text-center font-hand text-[13px] leading-snug text-walnut-dark shadow-soft">
            {batchHint}
          </p>
        </div>
      ) : null}

      {peelFraction !== undefined ? (
        <div className="flex justify-center">
          <div
            className="h-[4px] w-40 overflow-hidden rounded-full bg-ivory/35"
            role="progressbar"
            aria-label="Peel progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(peelFraction * 100)}
          >
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-200"
              style={{ width: `${Math.round(peelFraction * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div
        className={cn("flex flex-col items-center gap-1.5", peelFraction !== undefined && "hidden")}
      >
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
    </div>
  );
}
