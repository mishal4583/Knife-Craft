import { useEffect, useState, type ReactNode } from "react";
import { InfoTip } from "../common/InfoTip";
import { formatUsd, formatUsdChange } from "@/game/money";
import { paceOf, type PaceLine } from "@/game/economy/pace";
import { fillText } from "@/game/restaurant/floorFill";
import { lastServiceResult, nextServiceGuests, pullChips } from "@/game/restaurant/guestReport";
import { starsText } from "@/game/restaurant/serviceQuality";
import type { SaveData } from "@/game/SaveManager";
import { Art, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";
import { cn } from "@/lib/utils";

/**
 * THE PACE (idle phase 5A, economy/pace.ts): the business's money per hour, gross and net.
 * The restaurant per shift hour (the unit staff are paid in), from the closed days' own ledger
 * figures; the Second Floor per real hour. Never added together. Numbers and icons, the longer
 * explanation behind the ⓘ.
 *
 * Painted (developer 2026-11-25, Business UI design picture 01): a gold ribbon card, three tiles (Earned, Costs, Net) with a pill each for the last day and the
 * average, the guests row, the Second Floor row. Display only.
 */
export function PaceCard({ save }: { save: SaveData }) {
  // The floor earns by the real clock: re-read it now and then while the card is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const pace = paceOf(save, now);
  const rows: {
    label: string;
    art: string;
    fallback: string;
    pick: (l: PaceLine) => number;
    strong?: boolean;
  }[] = [
    { label: "Earned", art: "icons-a/coins", fallback: "💰", pick: (l) => l.gross },
    { label: "Costs", art: "biz:icons-a/clipboard-calc", fallback: "🧾", pick: (l) => -l.costs },
    {
      label: "Net",
      art: "icons-a/chart-trend",
      fallback: "📈",
      pick: (l) => l.net,
      strong: true,
    },
  ];
  return (
    <ProgressCard
      title="Pace · per hour"
      icon={<PIcon name="biz:icons-a/stopwatch" fallback="⏱️" size={26} />}
      right={
        <InfoTip label="How the pace is counted">
          The restaurant is counted per shift hour, the hour your staff are paid in: what the day
          earned (orders, level pay, tips) minus its running costs (groceries, supplies, wages,
          upkeep, fines). Buying a knife or a kitchen is an investment and isn&apos;t a cost here.
          The Second Floor earns by the real clock, so it is shown on its own.
        </InfoTip>
      }
      className="pt-9 @min-[720px]:pt-10"
      data-testid="pace-card"
    >
      <Art
        name="biz:decor-a/pace-cluster"
        className="pointer-events-none absolute right-12 top-0 hidden h-14 w-auto @min-[720px]:block"
      />
      {pace.last && pace.average ? (
        <div className="grid gap-2 @min-[620px]:grid-cols-3" data-testid="pace-restaurant">
          {rows.map((r) => (
            <PaceTile
              key={r.label}
              label={r.label}
              icon={<PIcon name={r.art} fallback={r.fallback} size={40} />}
              last={r.pick(pace.last!)}
              avg={r.pick(pace.average!)}
              days={pace.days}
              strong={r.strong}
            />
          ))}
        </div>
      ) : (
        <p className="font-ui text-[13px] text-walnut/70" data-testid="pace-empty">
          🌙 Close your first day to see your pace
        </p>
      )}
      <GuestsRow save={save} />
      {pace.floorOpen && pace.floorPerHour > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-dashed border-walnut/20 pt-3 font-ui text-[13.5px] font-bold text-walnut-dark"
          data-testid="pace-floor"
        >
          <span className="flex items-center gap-2 font-display text-[16px] font-black">
            <PIcon name="biz:icons-a/second-floor" fallback="🏬" size={34} />
            Second Floor {formatUsdChange(pace.floorPerHour)}/h
          </span>
          <ValuePill tone="gold" className="text-[13px]">
            <PIcon name="biz:icons-a/clock-gold" fallback="⏱️" size={20} />
            {pace.floorWaiting > 0 ? `${formatUsd(pace.floorWaiting)} waiting` : "nothing yet"}
            {pace.floorFill ? ` · ${fillText(pace.floorFill)}` : ""}
          </ValuePill>
        </div>
      ) : null}
    </ProgressCard>
  );
}

/**
 * Phase 8D: the guests of the next service (the timetable, the seats, what pulls) and the last service's stars.
 * Short: numbers and icons; how it adds up is behind the ⓘ.
 */
function GuestsRow({ save }: { save: SaveData }) {
  const next = nextServiceGuests(save);
  const last = lastServiceResult(save);
  if (!next && !last) return null;
  const chips = next ? pullChips(next.pull) : [];
  return (
    <div
      className="mt-3 border-t border-dashed border-walnut/20 pt-3 font-ui text-[13px] font-bold text-walnut-dark"
      data-testid="pace-guests"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <PIcon name="icons-b/guests" fallback="🍽️" size={38} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-display text-[15.5px] font-black leading-tight">
                <span>
                  Guests next{next?.service ? ` · ${next.service}` : ""}
                  {next ? ` ${next.served}` : ""}
                  {next && next.turnedAway > 0 ? ` · 🙁 ${next.turnedAway} turned away` : ""}
                </span>
                <InfoTip label="How the guests add up">
                  A service takes its timetable of guests plus a seat for each kitchen upgrade, and
                  a pull from your reputation, a big menu, the lunch and dinner rush, and a spotless
                  last service. Your team&apos;s capacity is the limit, so a new hire or a bigger
                  kitchen seats the guests who are turned away. Extra guests pay their dish&apos;s
                  menu price like any other.
                </InfoTip>
              </p>
              {next ? (
                <p
                  className="mt-1.5 flex flex-wrap gap-1.5 text-[12px] font-extrabold text-walnut/75"
                  data-testid="pace-guests-parts"
                >
                  <GuestChip>
                    <PIcon name="biz:icons-a/chair" fallback="🪑" size={18} />
                    {next.base} booked{next.seats > 0 ? ` + ${next.seats} seats` : ""}
                  </GuestChip>
                  {chips.map((c) => (
                    <GuestChip key={c}>{c}</GuestChip>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {last ? (
          <p
            className="flex items-center gap-2 font-display text-[15px] font-black text-walnut/80"
            data-testid="pace-last-stars"
          >
            <PIcon name="icons-a/star" fallback="⭐" size={28} />
            <span>Last service</span>
            <span className="text-[17px] tracking-wide text-[#e3a21a]">
              {starsText(last.stars)}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function GuestChip({ children }: { children: ReactNode }) {
  return (
    <span className="pg-pill inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-0.5 leading-tight">
      {children}
    </span>
  );
}

/** One tile of the pace: the icon and the label, then the last day and the average as two pills. */
function PaceTile({
  label,
  icon,
  last,
  avg,
  days,
  strong,
}: {
  label: string;
  icon: ReactNode;
  last: number;
  avg: number;
  days: number;
  strong: boolean | undefined;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[76px] flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-2xl border px-3 py-2",
        strong
          ? "bz-hot"
          : "border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span className="font-display text-[18px] font-black text-walnut-dark">{label}</span>
      </span>
      <span className="ml-auto flex items-stretch overflow-hidden rounded-xl border border-[#e8d3a6] bg-white/60 font-ui">
        <PaceFigure
          caption="Last day"
          value={last}
          data={`${label}-last`}
          strong={strong === true}
        />
        <PaceFigure
          caption={`Avg ${days > 1 ? days : ""}`.trim()}
          value={avg}
          data={`${label}-avg`}
          strong={strong === true}
          divider
        />
      </span>
    </div>
  );
}

function PaceFigure({
  caption,
  value,
  data,
  strong,
  divider,
}: {
  caption: string;
  value: number;
  data: string;
  strong: boolean;
  divider?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-[78px] flex-col items-center justify-center px-2 py-1",
        divider && "border-l border-[#e8d3a6]",
      )}
    >
      <span className="text-[10.5px] font-extrabold uppercase leading-none text-walnut/55">
        {caption}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[14px] font-black leading-tight tabular-nums",
          value < 0 ? "text-[#a3261c]" : strong ? "text-[#1f5d1f]" : "text-walnut-dark",
        )}
        data-pace={data}
      >
        {formatUsdChange(value)}
      </span>
    </span>
  );
}
