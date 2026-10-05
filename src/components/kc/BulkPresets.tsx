import { cn } from "@/lib/utils";
import { BULK_PRESETS, bulkDiscountFor } from "@/game/restaurant/bulkBuying";

/**
 * Unified Restaurant wholesale buying (RESTAURANT_MODE only): the quantity
 * presets of a Market card (5 / 25 / 50 / 100) with each one's bulk
 * discount. Sets the card's quantity; the card's quote and Buy button stay
 * the one source of the price. 2 × 2 so every target is 48 px.
 */
export function BulkPresets({
  value,
  onPick,
  label,
}: {
  value: number;
  onPick: (quantity: number) => void;
  /** What one step is ("units" / "packs"), for the accessible name. */
  label: string;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5" data-testid="bulk-presets">
      {BULK_PRESETS.map((q) => {
        const d = bulkDiscountFor(q);
        return (
          <button
            key={q}
            type="button"
            data-bulk-preset={q}
            aria-label={`Buy ${q} ${label}${d > 0 ? `, ${Math.round(d * 100)}% off` : ""}`}
            onClick={() => onPick(q)}
            className={cn(
              "press min-h-12 rounded-[14px] border px-1 font-ui text-[13px] font-extrabold leading-tight",
              value === q
                ? "border-copper bg-copper/15 text-walnut-dark"
                : "border-walnut/20 bg-ivory text-walnut-dark",
            )}
          >
            {q}
            {d > 0 ? (
              <span className="block text-[10px] font-bold text-olive">
                −{Math.round(d * 100)}%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
