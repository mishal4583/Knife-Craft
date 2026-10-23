import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import type { CleanlinessAction, CleanlinessActionResult } from "@/game/restaurant/cleanliness";
import {
  bottleView,
  restaurantSuppliesOf,
  sinkLines,
  sinkPieces,
} from "@/game/restaurant/serviceSupplies";
import { openMarketSupplies } from "../marketFocus";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { KButton } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
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
  variant = "row",
}: {
  save: SaveData;
  go?: ((s: ScreenId) => void) | undefined;
  cleanlinessAction: (action: CleanlinessAction) => CleanlinessActionResult | null;
  className?: string;
  /** "card": the Cleanliness page's Dishwashing card (always there, even with the sink empty). */
  variant?: "row" | "card";
}) {
  const [open, setOpen] = useState<{ lines: SinkLine[]; seed: number } | null>(null);
  const pieces = sinkPieces(save);
  const soap = bottleView(save, "dish-soap");
  const openSink = () =>
    setOpen({ lines: sinkLines(save), seed: restaurantSuppliesOf(save).washedTotal });
  if (variant === "row" && pieces === 0 && !open) return null;
  return (
    <>
      {variant === "card" ? (
        <DishwashingCard
          save={save}
          className={className}
          onWash={openSink}
          onBuySoap={go ? () => openMarketSupplies(go, "packaging", "dish-soap") : undefined}
        />
      ) : pieces > 0 ? (
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
            onClick={openSink}
            className="press min-h-12 shrink-0 rounded-full border border-walnut-dark/30 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] px-3 font-ui text-[12px] font-extrabold text-ivory"
          >
            🧽 Wash ›
          </button>
        </div>
      ) : null}
      {open ? (
        <WashUpSink
          lines={open.lines}
          seed={open.seed}
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

/** How full the sink looks on the card's meter: 100 = empty and clean, 0 = a full service's worth. */
const SINK_FULL = 30;

/**
 * RESTAURANT → CLEANLINESS · DISHWASHING (developer 2026-10-23: "add the
 * dishwashing in the cleanliness page, consider the cleaning an important
 * feature"): the sink as its own card, beside the rooms — the sink's picture,
 * what's waiting (by kind), the soap, and one big Wash button into the sink
 * game. Empty, it says so and stays (the next service's dishes land here).
 */
function DishwashingCard({
  save,
  className,
  onWash,
  onBuySoap,
}: {
  save: SaveData;
  className?: string | undefined;
  onWash: () => void;
  onBuySoap?: (() => void) | undefined;
}) {
  const lines = sinkLines(save);
  const pieces = lines.reduce((t, l) => t + l.n, 0);
  const st = restaurantSuppliesOf(save);
  const soap = bottleView(save, "dish-soap");
  const meter = Math.max(0, Math.round(100 - (pieces / SINK_FULL) * 100));
  const tone = pieces === 0 ? "bg-sage" : pieces < 10 ? "bg-gold" : "bg-tomato";
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[24px] border border-[#dfc89e] bg-[#fff8e9] shadow-[0_8px_22px_rgba(75,44,21,.16)]",
        className,
      )}
      data-testid="cleanliness-wash-up"
      data-sink={pieces}
    >
      <div className="relative h-[150px] overflow-hidden bg-[#3b2a1c] text-ivory">
        <img
          alt="The restaurant's sink"
          className="absolute inset-0 h-full w-full object-cover object-[center_55%]"
          draggable={false}
          src={`${import.meta.env.BASE_URL}dishwashing/premium-sink.webp`}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,12,8,.66)_0%,rgba(17,12,8,.24)_50%,rgba(17,12,8,.05)_100%)]"
        />
        <div className="relative z-10 px-3 pb-2 pt-2.5">
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/25 bg-black/25 text-[21px] shadow-soft"
              aria-hidden
            >
              🍽️
            </span>
            <p className="font-display text-[19px] font-black drop-shadow">Dishwashing</p>
            <span
              className="ml-auto font-display text-[20px] font-black tabular-nums drop-shadow"
              data-testid="sink-count"
            >
              {pieces > 0 ? pieces : "✨"}
            </span>
            <span className="text-[20px] drop-shadow" aria-hidden>
              {pieces > 0 ? "🫧" : "😊"}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-white/20 bg-black/40 shadow-inner">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", tone)}
              style={{ width: `${Math.max(4, meter)}%` }}
            />
          </div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        {pieces > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="sink-lines">
            {lines.map((l) => {
              const item = getSupplyItem(l.id);
              return (
                <span
                  key={l.id}
                  title={item?.name ?? l.id}
                  className="rounded-full border border-walnut/15 bg-ivory px-2 py-0.5 font-ui text-[12.5px] font-extrabold text-walnut-dark"
                >
                  {item?.icon ?? "🍽️"} ×{l.n}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="font-ui text-[13px] font-extrabold text-olive" data-testid="sink-empty">
            ✨ Sink empty · next service's dishes land here
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 font-ui text-[12px] font-bold text-walnut/70">
          <span className={cn(soap.status === "empty" ? "text-tomato" : "")}>
            🧴 {soap.status === "empty" ? "No soap" : `${Math.round(soap.openPct)}%`}
            {soap.spare > 0 ? ` +${soap.spare}` : ""}
          </span>
          {st.washedTotal > 0 ? (
            <span>· 🫧 {st.washedTotal.toLocaleString("en-US")} washed</span>
          ) : null}
          {st.brokenTotal > 0 ? <span>· 💥 {st.brokenTotal} broken</span> : null}
          <InfoTip label="About dishwashing">
            After a service its plates, cutlery and glasses wait here. Wash them by hand and nothing
            breaks. Left in the sink, they are washed when the next service starts — and now and
            then a plate, glass or fork breaks.
          </InfoTip>
        </div>
        {pieces > 0 ? (
          <div className="flex gap-2" data-testid="sink-wash">
            <KButton full variant="copper" className="min-h-12" onClick={onWash}>
              🧽 Wash {pieces} {pieces === 1 ? "dish" : "dishes"}
            </KButton>
            {soap.status === "empty" && onBuySoap ? (
              <KButton variant="cream" className="min-h-12 shrink-0" onClick={onBuySoap}>
                🛒 Soap
              </KButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
