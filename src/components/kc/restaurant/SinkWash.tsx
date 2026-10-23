import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import type { CleanlinessAction, CleanlinessActionResult } from "@/game/restaurant/cleanliness";
import { bottleView, sinkLines, sinkPieces } from "@/game/restaurant/serviceSupplies";
import { openMarketSupplies } from "../marketFocus";
import { WashUpSink, type SinkLine } from "./WashUpSink";

/**
 * "🫧 18 in the sink · Wash ›" (developer 2026-10-23: dishwashing back,
 * integrated): the one way into the sink game, used by Restaurant →
 * Cleanliness, the Pre-Service Check and Closing Time. Each kind scrubbed
 * clean is one cleanliness action "wash" (App: `cleanlinessAction` → save).
 * Nothing in the sink → nothing shows.
 */
export function SinkWash({
  save,
  go,
  cleanlinessAction,
  className,
}: {
  save: SaveData;
  go?: ((s: ScreenId) => void) | undefined;
  cleanlinessAction: (action: CleanlinessAction) => CleanlinessActionResult | null;
  className?: string;
}) {
  const [open, setOpen] = useState<SinkLine[] | null>(null);
  const pieces = sinkPieces(save);
  const soap = bottleView(save, "dish-soap");
  if (pieces === 0 && !open) return null;
  return (
    <>
      {pieces > 0 ? (
        <div
          className={cn(
            "flex min-h-12 items-center gap-2 rounded-xl border border-sky-700/15 bg-[linear-gradient(170deg,rgba(220,238,240,0.7),rgba(255,250,240,0.7))] px-2 py-1.5",
            className,
          )}
          data-testid="sink-wash"
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-600/10 text-[18px]"
            aria-hidden
          >
            🫧
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[12.5px] font-extrabold leading-tight text-walnut-dark">
              {pieces} in the sink
            </p>
            <p
              className={cn(
                "font-ui text-[10.5px] font-bold leading-tight",
                soap.status === "empty" ? "text-tomato" : "text-walnut/60",
              )}
              title="Washed by hand nothing breaks. Left in the sink, it is washed when the next service starts — and now and then a piece breaks."
            >
              {soap.status === "empty" ? "⛔ No dish soap" : "🧽 By hand: nothing breaks"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(sinkLines(save))}
            className="press min-h-12 shrink-0 rounded-full border border-walnut-dark/30 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] px-3 font-ui text-[12px] font-extrabold text-ivory"
          >
            🧽 Wash ›
          </button>
        </div>
      ) : null}
      {open ? (
        <WashUpSink
          lines={open}
          onWash={(id) => {
            const r = cleanlinessAction({ kind: "wash", ids: [id] });
            if (!r) return { ok: false };
            return r.needs.includes("dish-soap") ? { ok: false, noSoap: true } : { ok: true };
          }}
          onBuySoap={
            go
              ? () => {
                  setOpen(null);
                  openMarketSupplies(go, "packaging", "dish-soap");
                }
              : undefined
          }
          onClose={() => setOpen(null)}
          noSoapAtStart={soap.status === "empty"}
        />
      ) : null}
    </>
  );
}
