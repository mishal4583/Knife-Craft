import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CurrencyPill({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-copper/30 bg-ivory/85 px-2.5 py-1 font-ui text-[12px] font-extrabold text-walnut-dark shadow-soft",
        className,
      )}
    >
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-[8px] text-ivory"
        style={{ background: "linear-gradient(160deg,var(--color-gold),var(--color-copper))" }}
        aria-hidden
      >
        ◈
      </span>
      {amount.toLocaleString()}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "copper",
  thickness = 7,
}: {
  value: number;
  tone?: "copper" | "sage" | "muted";
  thickness?: number;
}) {
  const fill = {
    copper: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
    sage: "linear-gradient(90deg,var(--color-sage),var(--color-olive))",
    muted: "color-mix(in oklab, var(--color-walnut) 38%, transparent)",
  }[tone];
  return (
    <span
      className="relative block w-full overflow-hidden rounded-full bg-walnut/15"
      style={{ height: thickness }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: fill }}
      />
    </span>
  );
}

export function LevelBadge({ level, rank }: { level: number; rank: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-2xl border border-copper/30 bg-ivory/80 px-3 py-1.5 shadow-soft">
      <span
        className="grid h-7 w-7 place-items-center rounded-full font-ui text-[12px] font-black text-ivory"
        style={{ background: "linear-gradient(160deg,var(--color-gold),var(--color-copper))" }}
      >
        {level}
      </span>
      <span className="font-ui text-[10px] font-extrabold uppercase tracking-[0.16em] text-walnut/75">
        {rank}
      </span>
    </span>
  );
}

export function UnlockBadge({ requirement }: { requirement: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-walnut/20 bg-walnut/10 px-2.5 py-[3px] font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-walnut/65">
      <span aria-hidden>🔒</span>
      {requirement}
    </span>
  );
}

export function StatRow({
  label,
  value,
  next,
  tone = "copper",
}: {
  label: string;
  value: number;
  next?: number;
  tone?: "copper" | "sage";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[68px] shrink-0 font-ui text-[11px] font-bold text-walnut/80">
        {label}
      </span>
      <span className="flex-1">
        <ProgressBar value={value} tone={tone} />
      </span>
      <span className="w-[62px] text-right font-ui text-[11px] font-extrabold text-walnut-dark">
        {value}
        {typeof next === "number" ? (
          <span className={next > value ? "text-olive" : "text-walnut/40"}> → {next}</span>
        ) : null}
      </span>
    </div>
  );
}

export function MasteryBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-walnut/70">
          {label}
        </span>
        <span className="font-ui text-[11px] font-extrabold text-walnut-dark">{value}%</span>
      </div>
      <ProgressBar value={value} tone="sage" thickness={6} />
    </div>
  );
}

export function MilestoneRow({
  label,
  done,
  requirement,
}: {
  label: string;
  done: boolean;
  requirement?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]",
          done
            ? "border-olive/40 bg-sage/25 text-olive"
            : "border-walnut/20 bg-walnut/8 text-walnut/45",
        )}
        aria-hidden
      >
        {done ? "✓" : "🔒"}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-ui text-[13px] font-bold",
          done ? "text-walnut-dark" : "text-walnut/55",
        )}
      >
        {label}
      </span>
      {requirement ? (
        <span className="shrink-0 font-hand text-[15px] text-copper">{requirement}</span>
      ) : null}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center font-hand text-[17px] text-walnut/55">{children}</p>;
}
