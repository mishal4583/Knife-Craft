import { MOMENT_KIND_LABEL, type KitchenMoment } from "@/game/kitchenMoments";

/**
 * MOMENT_CHIP — Phase 6: the quiet way a Kitchen Moment is offered. A small
 * chip in the corner of the order's completion screen (never over the
 * board, never during cutting), naming what the dish earned; tap opens the
 * card preview, ✕ puts it away for this dish. It never opens anything by
 * itself and declining changes nothing.
 */
export function MomentChip({
  moments,
  onOpen,
  onDismiss,
}: {
  moments: KitchenMoment[];
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const first = moments[0]!;
  const label =
    moments.length === 1
      ? `${MOMENT_KIND_LABEL[first.kind].icon} ${MOMENT_KIND_LABEL[first.kind].title}`
      : `${moments.length} Kitchen Moments`;
  return (
    <div
      className="anim-pop absolute right-2 top-2 z-[56] flex items-center overflow-hidden rounded-full border border-gold/60 bg-walnut-dark/85 shadow-lift backdrop-blur-[2px]"
      data-testid="moment-chip"
      data-count={moments.length}
      data-kinds={moments.map((m) => m.kind).join(",")}
    >
      <button
        type="button"
        onClick={onOpen}
        className="press min-h-11 max-w-[220px] truncate py-1.5 pl-3 pr-2 font-ui text-[12px] font-extrabold text-gold"
      >
        📸 {label}
      </button>
      <button
        type="button"
        aria-label="Not now"
        onClick={onDismiss}
        className="grid min-h-11 w-9 place-items-center border-l border-ivory/15 font-ui text-[13px] text-ivory/60"
      >
        ✕
      </button>
    </div>
  );
}
