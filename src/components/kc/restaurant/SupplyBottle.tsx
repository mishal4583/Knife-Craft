import { cn } from "@/lib/utils";
import type { BottleView } from "@/game/restaurant/serviceSupplies";

const NAME: Record<BottleView["id"], string> = {
  "dish-soap": "Dish soap",
  "cleaning-liquid": "Cleaning liquid",
};
const LIQUID: Record<BottleView["id"], string> = {
  "dish-soap": "#7cc4a4",
  "cleaning-liquid": "#8fb4e3",
};

/**
 * A dish-soap / cleaning-liquid bottle (Unified Restaurant phase G): the open
 * bottle's level drawn as liquid, its %, the sealed spares, and "~N services
 * left", with a low / empty warning (marker AND word). Read-only, from
 * `bottleView`; CSS only.
 */
export function SupplyBottle({
  bottle,
  per,
  onRestock,
  compact = false,
}: {
  bottle: BottleView;
  /** The Pre-Service Check's card-row look (smaller type, a tinted card). */
  compact?: boolean;
  /** What one use is: "wash" (dish soap: one wash-up) or "closing" (cleaning liquid). */
  per: string;
  onRestock?: () => void;
}) {
  const level = Math.round(bottle.openPct);
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 py-1.5",
        compact && "gap-2 rounded-xl border px-2",
        compact &&
          (bottle.status === "ok"
            ? "border-olive/10 bg-ivory/65"
            : bottle.status === "empty"
              ? "border-tomato/20 bg-tomato/5"
              : "border-gold/25 bg-gold/5"),
      )}
      data-bottle={bottle.id}
      data-bottle-status={bottle.status}
    >
      <div aria-hidden className="relative mt-1.5 h-11 w-7 shrink-0">
        <span className="absolute left-1/2 top-[-6px] h-2 w-3 -translate-x-1/2 rounded-sm bg-walnut/50" />
        <div className="absolute inset-0 overflow-hidden rounded-[8px_8px_6px_6px] border-2 border-walnut/40 bg-ivory">
          <span
            className="absolute inset-x-0 bottom-0 transition-[height]"
            style={{ height: `${level}%`, background: LIQUID[bottle.id] }}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-ui text-walnut-dark",
            compact ? "text-[12.5px] font-extrabold leading-tight" : "text-[14.5px] font-bold",
          )}
        >
          {NAME[bottle.id]} — {level}%{bottle.spare > 0 ? ` + ${bottle.spare} spare` : ""}
        </p>
        <p
          className={cn(
            "font-ui",
            compact ? "text-[10.5px] leading-tight" : "text-[12.5px]",
            bottle.status === "ok" ? "text-walnut/60" : "text-tomato",
          )}
        >
          {bottle.status === "empty"
            ? `⛔ Empty — buy another bottle`
            : `${bottle.status === "low" ? "⚠️ Low · " : ""}~${bottle.servicesLeft} ${
                bottle.servicesLeft === 1 ? per : `${per}${per.endsWith("sh") ? "es" : "s"}`
              } remaining`}
        </p>
      </div>
      {onRestock && bottle.status !== "ok" ? (
        <button
          type="button"
          onClick={onRestock}
          className={cn(
            "press min-h-12 shrink-0 rounded-full border border-walnut-dark/30 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] font-ui font-extrabold text-ivory",
            compact ? "px-2.5 text-[11px]" : "px-3 text-[13.5px]",
          )}
        >
          {compact ? "🛒 Restock" : "Restock →"}
        </button>
      ) : null}
    </div>
  );
}
