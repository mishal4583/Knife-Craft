import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";

/**
 * METERS — the small, calm visual pieces shared by Restaurant Progress and
 * Business: section labels, progress bars, label/value rows and two tiny
 * inline-SVG charts (no chart library). Display only — every number passed
 * in comes from the caller's real game data.
 */

export function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "font-ui text-[10px] font-extrabold uppercase tracking-[0.2em]",
        dark ? "text-gold" : "text-copper",
      )}
    >
      {children}
    </p>
  );
}

export function Bar({
  fraction,
  tone = "copper",
  dark,
}: {
  fraction: number;
  tone?: "copper" | "sage";
  /** On a dark (wood) panel the empty track is light. */
  dark?: boolean;
}) {
  const fill =
    tone === "sage"
      ? "linear-gradient(90deg,var(--color-sage),var(--color-olive))"
      : "linear-gradient(90deg,var(--color-gold),var(--color-copper))";
  return (
    <span
      className={cn(
        "relative block h-[8px] w-full overflow-hidden rounded-full",
        dark ? "bg-ivory/20" : "bg-walnut/15",
      )}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`,
          background: fill,
        }}
      />
    </span>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="font-ui text-[12px] font-bold text-walnut/70">{label}</span>
      <span className="text-right font-ui text-[13px] font-extrabold text-walnut-dark">
        {value}
      </span>
    </div>
  );
}

/** Revenue / Costs / Profit colours, used by every Business chart and legend. */
export const MONEY_COLORS = {
  revenue: "var(--color-olive)",
  costs: "var(--color-copper)",
  profit: "var(--color-gold)",
} as const;

export type MoneyGroup = { label: string; revenue: number; costs: number; profit: number };

/**
 * Grouped bars: for each group (e.g. "Last day", "Today"), Revenue, Costs and
 * Profit side by side on one shared USD axis. A negative profit dips below
 * the zero line. Values are cents.
 */
export function MoneyBars({ groups }: { groups: MoneyGroup[] }) {
  const W = 300;
  const H = 150;
  const left = 8;
  const right = 8;
  const top = 18;
  const bottom = 26;
  const values = groups.flatMap((g) => [g.revenue, g.costs, g.profit]);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min;
  const y = (v: number) => top + ((max - v) / span) * (H - top - bottom);
  const zero = y(0);
  const groupW = (W - left - right) / groups.length;
  const barW = Math.min(34, (groupW - 24) / 3);
  const keys = ["revenue", "costs", "profit"] as const;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={groups
        .map(
          (g) =>
            `${g.label}: revenue ${formatUsd(g.revenue)}, costs ${formatUsd(g.costs)}, profit ${formatUsd(g.profit)}`,
        )
        .join("; ")}
    >
      <line
        x1={left}
        x2={W - right}
        y1={zero}
        y2={zero}
        stroke="var(--color-walnut)"
        strokeOpacity={0.25}
      />
      {groups.map((g, gi) => {
        const gx = left + gi * groupW + (groupW - barW * 3 - 12) / 2;
        return (
          <g key={g.label}>
            {keys.map((k, ki) => {
              const v = g[k];
              const x = gx + ki * (barW + 6);
              const yTop = v >= 0 ? y(v) : zero;
              const h = Math.max(1.5, Math.abs(y(v) - zero));
              return (
                <g key={k}>
                  <rect
                    x={x}
                    y={yTop}
                    width={barW}
                    height={h}
                    rx={4}
                    fill={MONEY_COLORS[k]}
                    fillOpacity={k === "profit" ? 0.95 : 0.8}
                  />
                  <text
                    x={x + barW / 2}
                    y={v >= 0 ? yTop - 4 : yTop + h + 10}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontFamily="var(--font-ui)"
                    fontWeight={800}
                    fill="var(--color-walnut-dark)"
                  >
                    {compactUsd(v)}
                  </text>
                </g>
              );
            })}
            <text
              x={left + gi * groupW + groupW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-ui)"
              fontWeight={800}
              fill="var(--color-walnut)"
            >
              {g.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Short USD for chart labels: $1,240 / $12.5k / −$80 (whole dollars; the cards show exact cents). */
function compactUsd(cents: number): string {
  const d = cents / 100;
  const sign = d < 0 ? "−" : "";
  const a = Math.abs(d);
  if (a >= 10000) return `${sign}$${(a / 1000).toFixed(a >= 100000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(a).toLocaleString("en-US")}`;
}

/** Legend chips for MoneyBars. */
export function MoneyLegend() {
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 font-ui text-[10px] font-extrabold text-walnut/70">
      {(
        [
          ["revenue", "Revenue"],
          ["costs", "Costs"],
          ["profit", "Profit"],
        ] as const
      ).map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: MONEY_COLORS[k] }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

export type Segment = { label: string; value: number; color: string };

/** One horizontal bar split into proportional segments (only non-zero ones), with a legend below. */
export function StackedBar({ segments }: { segments: Segment[] }) {
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((t, s) => t + s.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-[14px] w-full overflow-hidden rounded-full bg-walnut/10">
        {parts.map((s) => (
          <span
            key={s.label}
            title={`${s.label} ${formatUsd(s.value)}`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {parts.map((s) => (
          <div key={s.label} className="flex items-center gap-2 font-ui text-[12px]">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 font-bold text-walnut/75">{s.label}</span>
            <span className="font-extrabold text-walnut-dark">{formatUsd(s.value)}</span>
            <span className="w-9 text-right font-bold text-walnut/50">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
