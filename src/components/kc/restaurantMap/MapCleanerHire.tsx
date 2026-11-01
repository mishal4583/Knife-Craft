import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";
import { cleanerSlots } from "@/game/restaurant/diningHire";
import type { CleanArea } from "@/game/restaurant/cleanliness";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { SaveData } from "@/game/SaveManager";

/**
 * CLEANERS BY THE HOUR (Phase 10, developer 2026-11-01): a small round button on the restaurant map, like an idle
 * game's helper button — nothing on the dining floor, nothing on the Cleanliness page. It opens a tray with the
 * three areas (kitchen, dining, restroom); each Cleaner is hired for the REST OF TODAY and paid up front for the
 * hours left at a wage that grows with the restaurant, and is gone tomorrow (hire again). For a player who is tired
 * or does not like cleaning; the cleaning itself is always theirs to do. App does the hiring and the ledger entry.
 */
export function MapCleanerHire({
  save,
  onHire,
  className = "",
}: {
  save: SaveData;
  onHire: (area: CleanArea) => "hired" | "funds" | "no";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [say, setSay] = useState<string | null>(null);
  // One message timer: a second hire restarts it (the first timer must not cut the new message short).
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const slots = cleanerSlots(save, restaurantLevelOf(save.levelProgress));
  if (slots.length === 0) return null;
  const onShift = slots.filter((s) => s.onShift).length;
  const hours = slots[0]!.hours;
  const wage = slots[0]!.wage;
  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)} data-testid="map-cleaners">
      {open ? (
        <div
          className="rounded-2xl border border-walnut-dark/30 bg-ivory/95 p-2 shadow-lift"
          data-testid="map-cleaners-tray"
        >
          <p className="px-1 font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/70">
            Cleaners · {formatUsd(wage)}/h · {hours}h left today
          </p>
          <div className="mt-1 flex gap-1.5">
            {slots.map((s) => (
              <button
                key={s.area}
                type="button"
                data-cleaner={s.area}
                data-on-shift={s.onShift ? "true" : undefined}
                disabled={s.onShift || !s.affordable}
                aria-label={
                  s.onShift
                    ? `${s.label} is on shift today`
                    : `Hire the ${s.label} for the rest of today, ${formatUsd(s.price)}`
                }
                className={cn(
                  "press flex min-h-12 min-w-[3.6rem] flex-col items-center justify-center rounded-xl border px-2 py-1 font-ui",
                  s.onShift
                    ? "border-olive/30 bg-sage/20 text-olive"
                    : "border-walnut/20 bg-cream text-walnut-dark disabled:opacity-50",
                )}
                onClick={() => {
                  const r = onHire(s.area);
                  setSay(
                    r === "hired"
                      ? `✓ ${s.label} on shift`
                      : r === "funds"
                        ? "💸 Not enough money"
                        : null,
                  );
                  if (timer.current !== null) window.clearTimeout(timer.current);
                  timer.current = window.setTimeout(() => {
                    timer.current = null;
                    setSay(null);
                  }, 1800);
                }}
              >
                <span className="text-[20px] leading-none" aria-hidden>
                  {s.icon}
                </span>
                <span className="text-[11px] font-extrabold leading-tight">
                  {s.onShift ? "✓ on shift" : formatUsd(s.price)}
                </span>
              </button>
            ))}
          </div>
          {say ? (
            <p className="mt-1 px-1 font-ui text-[12px] font-bold text-copper" role="status">
              {say}
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        data-testid="map-cleaners-button"
        aria-expanded={open}
        aria-label="Hire a cleaner for today"
        className="press relative grid h-12 w-12 place-items-center rounded-full border border-walnut-dark/40 bg-walnut text-[22px] text-ivory shadow-lift"
        onClick={() => setOpen((o) => !o)}
      >
        🧹
        {onShift > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sage px-1 text-[11px] font-extrabold text-ivory">
            {onShift}
          </span>
        ) : null}
      </button>
    </div>
  );
}
