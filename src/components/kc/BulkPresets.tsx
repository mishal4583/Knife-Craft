import { cn } from "@/lib/utils";
import { BULK_PRESETS, bulkDiscountFor } from "@/game/restaurant/bulkBuying";
import { CrateIcon } from "./market/ShopCard";

/**
 * Unified Restaurant wholesale buying (RESTAURANT_MODE only): the bulk sizes
 * of a Market card as crate tiles, "5 kg · −3%" (developer 2026-10-22, the
 * shop card design). The small sizes are on the card's − / + stepper; the
 * tiles are the presets that earn a discount (5 and 10 of BULK_PRESETS). Sets
 * the card's quantity; the card's quote and Buy button stay the one source of
 * the price. Each tile is ≥ 48 px.
 */
export function BulkPresets({
  value,
  onPick,
  label,
  discountFor = bulkDiscountFor,
}: {
  value: number;
  onPick: (quantity: number) => void;
  /** What one step is ("kg" / "packs"), shown on the tile and in the accessible name. */
  label: string;
  /** The discount a preset gets (ingredients: by the stock it buys — `ingredientBulkDiscount`). */
  discountFor?: (quantity: number) => number;
}) {
  const tiles = BULK_PRESETS.filter((q) => q >= 5);
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5" data-testid="bulk-presets">
      {tiles.map((q, i) => {
        const d = discountFor(q);
        return (
          <button
            key={q}
            type="button"
            data-bulk-preset={q}
            aria-label={`Buy ${q} ${label}${d > 0 ? `, ${Math.round(d * 100)}% off` : ""}`}
            aria-pressed={value === q}
            onClick={() => onPick(q)}
            className={cn("press shop-card__tile", value === q && "shop-card__tile--on")}
          >
            <CrateIcon size={22} full={i === 0} />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="truncate font-ui text-[13px] font-black text-walnut-dark">
                {q} {label}
              </span>
              {d > 0 ? (
                <span className="font-ui text-[12px] font-black text-olive">
                  −{Math.round(d * 100)}%
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
