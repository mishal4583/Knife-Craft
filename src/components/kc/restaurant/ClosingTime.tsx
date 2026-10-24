import type { ReactNode } from "react";
import { TonightsOrder } from "./Deliveries";
import type { ScreenId } from "@/components/kc/data";
import { openMarketSupplies } from "@/components/kc/marketFocus";
import { getSupplyItem, type SupplyId } from "@/game/business/businessSupplies";
import type { CleanlinessAction, CleanlinessActionResult } from "@/game/restaurant/cleanliness";
import { useCleaningGame, isInteractiveTask } from "./CleaningGame";
import { SinkWash } from "./SinkWash";
import { KButton } from "@/components/kc/common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { INGREDIENTS } from "@/game/definitions";
import { formatUsd } from "@/game/money";
import { closingPreview } from "@/game/restaurant/restaurantDay";
import { SupplyBottle } from "./SupplyBottle";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { closingRows, type ClosingRow } from "@/game/restaurant/closingChores";

/**
 * CLOSING TIME (Unified Restaurant phase 5, behind RESTAURANT_MODE) — after
 * the day's last service, before the next level. Read-only from the save
 * (`closingPreview`): the services done, the closing chores for this stage
 * (wash up, wipe down, throw out spoiled food from L21, set the dining room
 * from L31), the day's count (cash at opening → now) and what closing
 * throws out. One button closes for the night (`closeDay`) and the next
 * level opens Day N+1. It has no dismiss: the day must close first (replays
 * stay playable).
 *
 * The chores are the player's (developer 2026-10-23: "do not automate the
 * important tasks while closing, let the player do everything unless he
 * hires a cleaner"): each has its own button (wash up opens the sink game
 * while dishes wait), and "Close for the night" opens once they're done. A
 * Cleaner on duty does them all but the count (closingChores.ts).
 */
export function ClosingTime({
  save,
  restaurantLevel,
  onClose,
  cleanlinessAction,
  onChore,
  go,
}: {
  save: SaveData;
  restaurantLevel: number;
  onClose: () => void;
  /** A real restaurant's day: closing's chores, done here (App.cleanlinessAction). */
  cleanlinessAction?: (action: CleanlinessAction) => CleanlinessActionResult | null;
  go?: (s: ScreenId) => void;
  /** The player does one closing chore (App: closingChores.doClosingChore → save). */
  onChore?: (id: string) => void;
}) {
  const p = closingPreview(save, restaurantLevel);
  const rows = closingRows(save, restaurantLevel);
  const left = onChore ? rows.filter((r) => r.state === "todo").length : 0;
  // Tonight's tasks are Cleanliness tasks: cleaned in the same game as by day (CleaningGame.tsx).
  const cleaning = useCleaningGame(save, (a) => cleanlinessAction?.(a) ?? null);
  const buy = (id: SupplyId) =>
    go ? openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id) : undefined;
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

          <div className="mt-3 flex items-center gap-2">
            <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
              Close up
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-ui text-[11px] font-black",
                left > 0 ? "bg-copper/15 text-copper" : "bg-sage/20 text-olive",
              )}
              data-testid="closing-left"
            >
              {left > 0 ? `${left} left` : "✓ All done"}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1.5" data-testid="closing-chores">
            {rows.map((r, i) => (
              <ChoreRow
                key={r.id}
                row={r}
                index={i}
                interactive={!!onChore && !!cleanlinessAction}
                onDo={() =>
                  r.type === "count"
                    ? onChore?.("count")
                    : r.type === "task"
                      ? cleaning.clean(r.task)
                      : undefined
                }
                onBuy={buy}
                sink={
                  r.type === "sink" && r.state === "todo" && cleanlinessAction ? (
                    <SinkWash
                      save={save}
                      go={go}
                      cleanlinessAction={cleanlinessAction}
                      variant="button"
                    />
                  ) : null
                }
              />
            ))}
          </ul>
          <p className="mt-1 flex items-center gap-1 font-ui text-[12px] font-bold text-walnut/60">
            🧹 Also in Restaurant → Cleanliness
            <InfoTip label="About closing">
              Tonight's chores are the Cleanliness section's closing tasks. Clean them here or
              there; a hired Cleaner does the routine ones. Missing supplies never stop you closing
              — the task waits for the morning.
            </InfoTip>
          </p>

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
          <KButton full className="min-h-12" onClick={onClose} disabled={left > 0}>
            {left > 0
              ? `🌙 ${left} ${left === 1 ? "chore" : "chores"} left`
              : `Close for the night → Day ${p.day + 1}`}
          </KButton>
        </div>
      </div>
      {cleaning.game}
    </div>
  );
}

/** One closing row: its picture, the chore, and its button (or that it's done). */
function ChoreRow({
  row: r,
  index,
  interactive,
  onDo,
  onBuy,
  sink,
}: {
  row: ClosingRow;
  index: number;
  interactive: boolean;
  onDo: () => void;
  onBuy: (id: SupplyId) => void;
  sink: ReactNode;
}) {
  const done = r.state === "done" || !interactive;
  const verb =
    r.type === "count"
      ? "Count"
      : r.type === "task" && isInteractiveTask(r.task)
        ? "🧽 Clean"
        : "Do it";
  return (
    <li
      data-chore={r.type === "task" ? r.task : r.id}
      data-chore-by={r.state === "done" ? "done" : r.state === "blocked" ? "blocked" : "todo"}
      className={cn(
        "kc-story-text flex min-h-[52px] items-center gap-2 rounded-xl border px-2 py-1",
        done ? "border-olive/20 bg-sage/10" : "border-walnut/15 bg-ivory/80",
      )}
      style={{ animationDelay: `${150 + index * 90}ms` }}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[19px]",
          done ? "bg-sage/20" : "bg-walnut/8",
        )}
        aria-hidden
      >
        {r.icon}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 font-ui text-[13.5px] font-bold leading-tight",
          done ? "text-walnut/60" : "text-walnut-dark",
        )}
      >
        {r.label}
        {r.type === "sink" && r.pieces > 0 ? (
          <span className="block text-[12px] font-extrabold text-copper">
            🫧 {r.pieces} in the sink{r.state === "blocked" ? " · no soap" : ""}
          </span>
        ) : null}
        {r.type === "task" && r.state === "blocked" ? (
          <span className="block text-[12px] font-extrabold text-tomato">
            ⏳ Waits for supplies
          </span>
        ) : null}
      </span>
      {done ? (
        <span className="anim-pop shrink-0 font-ui text-[12px] font-extrabold text-olive">✓</span>
      ) : r.state === "blocked" ? (
        r.type === "task" && r.needs[0] ? (
          <button
            type="button"
            onClick={() => onBuy(r.needs[0]!)}
            className="press min-h-12 shrink-0 rounded-full border border-tomato/40 bg-tomato/90 px-3 font-ui text-[12px] font-extrabold text-ivory"
          >
            🛒 {getSupplyItem(r.needs[0])?.name.split(" ·")[0] ?? "Buy"}
          </button>
        ) : (
          <span className="shrink-0 font-ui text-[12px] font-extrabold text-walnut/60">
            ⏳ START
          </span>
        )
      ) : sink ? (
        sink
      ) : (
        <button
          type="button"
          onClick={onDo}
          className="press min-h-12 shrink-0 rounded-full border border-walnut-dark/30 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] px-3.5 font-ui text-[12.5px] font-extrabold text-ivory"
        >
          {verb}
        </button>
      )}
    </li>
  );
}
