import { useEffect, useState } from "react";
import { Panel } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { formatUsd, formatUsdChange } from "@/game/money";
import { paceOf, type PaceLine } from "@/game/economy/pace";
import { fillText } from "@/game/restaurant/floorFill";
import type { SaveData } from "@/game/SaveManager";

/**
 * THE PACE (idle phase 5A, economy/pace.ts): the business's money per hour, gross and net.
 * The restaurant per shift hour (the unit staff are paid in), from the closed days' own ledger
 * figures; the Second Floor per real hour. Never added together. Numbers and icons, the longer
 * explanation behind the ⓘ.
 */
export function PaceCard({ save }: { save: SaveData }) {
  // The floor earns by the real clock: re-read it now and then while the card is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const pace = paceOf(save, now);
  const rows: { label: string; pick: (l: PaceLine) => number; strong?: boolean }[] = [
    { label: "Earned", pick: (l) => l.gross },
    { label: "Costs", pick: (l) => -l.costs },
    { label: "Net", pick: (l) => l.net, strong: true },
  ];
  return (
    <Panel className="p-4" data-testid="pace-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-copper">
          ⏱️ Pace · per hour
        </p>
        <InfoTip label="How the pace is counted">
          The restaurant is counted per shift hour, the hour your staff are paid in: what the day
          earned (orders, level pay, tips) minus its running costs (groceries, supplies, wages,
          upkeep, fines). Buying a knife or a kitchen is an investment and isn&apos;t a cost here.
          The Second Floor earns by the real clock, so it is shown on its own.
        </InfoTip>
      </div>
      {pace.last && pace.average ? (
        <div className="mt-2" data-testid="pace-restaurant">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 font-ui text-[13px]">
            <span />
            <span className="text-right text-[11px] font-extrabold uppercase text-walnut/55">
              Last day
            </span>
            <span className="text-right text-[11px] font-extrabold uppercase text-walnut/55">
              Avg {pace.days > 1 ? pace.days : ""}
            </span>
            {rows.map((r) => (
              <PaceRow
                key={r.label}
                label={r.label}
                last={r.pick(pace.last!)}
                avg={r.pick(pace.average!)}
                strong={r.strong}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 font-ui text-[13px] text-walnut/70" data-testid="pace-empty">
          🌙 Close your first day to see your pace
        </p>
      )}
      {pace.floorOpen && pace.floorPerHour > 0 ? (
        <p
          className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-walnut/10 pt-2 font-ui text-[13px] font-bold text-walnut-dark"
          data-testid="pace-floor"
        >
          <span>🏬 Second Floor {formatUsdChange(pace.floorPerHour)}/h</span>
          <span className="text-[12px] font-semibold text-walnut/65">
            {pace.floorWaiting > 0 ? `${formatUsd(pace.floorWaiting)} waiting` : "nothing yet"}
            {pace.floorFill ? ` · ${fillText(pace.floorFill)}` : ""}
          </span>
        </p>
      ) : null}
    </Panel>
  );
}

function PaceRow({
  label,
  last,
  avg,
  strong,
}: {
  label: string;
  last: number;
  avg: number;
  strong?: boolean | undefined;
}) {
  const cls = strong ? "font-extrabold text-walnut-dark" : "text-walnut/80";
  return (
    <>
      <span className={cls}>{label}</span>
      <span className={`text-right tabular-nums ${cls}`} data-pace={`${label}-last`}>
        {formatUsdChange(last)}
      </span>
      <span className={`text-right tabular-nums ${cls}`} data-pace={`${label}-avg`}>
        {formatUsdChange(avg)}
      </span>
    </>
  );
}
