import { TonightsOrder } from "./Deliveries";
import type { ScreenId } from "@/components/kc/data";
import { openMarketSupplies } from "@/components/kc/marketFocus";
import { getSupplyItem } from "@/game/business/businessSupplies";
import type { CleanlinessAction, CleanlinessActionResult } from "@/game/restaurant/cleanliness";
import { ShiftChecklist } from "./ShiftChecklist";
import { SinkWash } from "./SinkWash";
import { KButton } from "@/components/kc/common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { INGREDIENTS } from "@/game/definitions";
import { formatUsd } from "@/game/money";
import { closingPreview } from "@/game/restaurant/restaurantDay";
import { SupplyBottle } from "./SupplyBottle";
import { InfoTip } from "@/components/kc/common/InfoTip";

/**
 * CLOSING TIME (Unified Restaurant phase 5, behind RESTAURANT_MODE) — after
 * the day's last service, before the next level. Read-only from the save
 * (`closingPreview`): the services done, the closing chores for this stage
 * (wash up, wipe down, throw out spoiled food from L21, set the dining room
 * from L31), the day's count (cash at opening → now) and what closing
 * throws out. One button closes for the night (`closeDay`) and the next
 * level opens Day N+1. It has no dismiss: the day must close first (replays
 * stay playable).
 */
export function ClosingTime({
  save,
  restaurantLevel,
  onClose,
  cleanlinessAction,
  go,
}: {
  save: SaveData;
  restaurantLevel: number;
  onClose: () => void;
  /** A real restaurant's day: closing's chores, done here (App.cleanlinessAction). */
  cleanlinessAction?: (action: CleanlinessAction) => CleanlinessActionResult | null;
  go?: (s: ScreenId) => void;
}) {
  const p = closingPreview(save, restaurantLevel);
  const change = p.cashAtOpening === null ? null : p.cashNow - p.cashAtOpening;
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center" data-testid="closing-time">
      {/* Night falls (the day clock, 2026-10-11): a night sky behind the closing card. */}
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        data-day-light="night"
        style={{
          background:
            "radial-gradient(circle at 82% 12%,rgba(255,244,214,0.55) 0 22px,transparent 23px),linear-gradient(180deg,rgba(14,22,62,0.86) 0%,rgba(30,24,52,0.72) 55%,rgba(48,30,24,0.62) 100%)",
        }}
      />
      <div className="anim-up relative m-3 flex max-h-[calc(100%-24px)] w-[calc(100%-24px)] flex-col rounded-[26px] land:max-w-[680px] border border-walnut/20 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] shadow-lift">
        <div className="px-5 pb-2 pt-4">
          <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-walnut/60">
            Day {p.day} · Closing time
          </p>
          <p className="font-display text-[22px] font-black text-walnut-dark">
            🌙 Time to close up
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <ul className="space-y-0.5" data-testid="closing-services">
            {p.services.map((s) => (
              <li key={s.name} className="font-ui text-[14.5px] font-bold text-walnut-dark">
                ✓ {s.name} · Level {s.levelNumber}
              </li>
            ))}
          </ul>

          <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
            Done when you close
          </p>
          <ul className="mt-1 space-y-1" data-testid="closing-chores">
            {p.chores.map((c, i) => (
              <li
                key={c.id}
                data-chore={c.id}
                className="kc-story-text flex items-center gap-2 font-ui text-[14.5px] text-walnut-dark"
                style={{ animationDelay: `${150 + i * 180}ms` }}
              >
                <span className="text-sage" aria-hidden>
                  ✓
                </span>
                {c.label}
              </li>
            ))}
          </ul>

          {cleanlinessAction ? (
            // The day's last dishes (the sink game, 2026-10-23); left, they wash at tomorrow's START.
            <SinkWash save={save} go={go} cleanlinessAction={cleanlinessAction} className="mt-3" />
          ) : null}
          {cleanlinessAction ? (
            <ShiftChecklist
              save={save}
              phase="closing"
              onAction={cleanlinessAction}
              onBuy={(id) =>
                go
                  ? openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)
                  : undefined
              }
            />
          ) : null}

          <TonightsOrder save={save} level={restaurantLevel} />

          {p.spoiled ? (
            <p
              className={cn(
                "mt-3 font-ui text-[13.5px] font-bold",
                p.spoiled.quantity > 0 ? "text-tomato" : "text-walnut/70",
              )}
              data-testid="closing-spoiled"
            >
              {p.spoiled.quantity > 0
                ? `🗑️ Spoiled: ${p.spoiled.ingredientIds.map((id) => INGREDIENTS[id]?.name ?? id).join(", ")} · ${formatUsd(p.spoiled.value)}`
                : "✓ Nothing spoiled today"}
            </p>
          ) : null}

          {p.cleaner ? (
            <div className="mt-2" data-testid="closing-cleaner">
              <SupplyBottle bottle={p.cleaner} per="closing" />
              {p.cleaner.status === "empty" ? (
                <p className="flex items-center gap-1.5 font-ui text-[12.5px] text-tomato">
                  💧 No cleaning liquid · water tonight
                  <InfoTip label="Where to buy cleaning liquid">
                    Buy some in the Market → Takeaway → Securing &amp; hygiene.
                  </InfoTip>
                </p>
              ) : null}
            </div>
          ) : null}

          {p.supplies.length > 0 ? (
            <ul className="mt-2 space-y-1" data-testid="closing-supplies">
              {p.supplies.map((l) => (
                <li
                  key={l.id}
                  data-closing-supply={l.id}
                  className={cn(
                    "font-ui text-[13.5px] font-bold",
                    l.have >= l.need ? "text-walnut-dark" : "text-tomato",
                  )}
                >
                  {l.have >= l.need ? "✓" : "⚠"} {l.label}: {l.have}/{l.need}
                  {l.have < l.need ? (
                    <span className="block font-normal text-[12.5px]">🛒 Market → Takeaway</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div
            className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
            data-testid="closing-count"
          >
            <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
              Today's count
            </p>
            {p.cashAtOpening !== null ? (
              <p className="font-ui text-[14.5px] font-bold text-walnut-dark">
                {formatUsd(p.cashAtOpening)} at opening → {formatUsd(p.cashNow)} now
                {change !== null ? (
                  <span className={cn("ml-1", change >= 0 ? "text-olive" : "text-tomato")}>
                    ({change >= 0 ? "+" : "−"}
                    {formatUsd(Math.abs(change))})
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="font-ui text-[14.5px] font-bold text-walnut-dark">
                {formatUsd(p.cashNow)} in the till
              </p>
            )}
            {p.fullDayEnd ? (
              <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
                💰 Pays the team · closes the books
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-walnut/10 px-5 py-3">
          <KButton full className="min-h-12" onClick={onClose}>
            Close for the night → Day {p.day + 1}
          </KButton>
        </div>
      </div>
    </div>
  );
}
