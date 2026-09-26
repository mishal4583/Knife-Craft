import { formatUsd } from "@/game/money";
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
        $
      </span>
      {formatUsd(amount)}
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
