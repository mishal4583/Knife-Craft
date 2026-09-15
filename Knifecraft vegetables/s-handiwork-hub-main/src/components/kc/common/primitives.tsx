import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Buttons ─────────────────────────────────────────────── */

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "wood" | "cream" | "sage" | "ghost" | "copper";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  className?: string;
};

export function KButton({
  children,
  onClick,
  variant = "wood",
  size = "md",
  full,
  disabled,
  className,
}: BtnProps) {
  const base =
    "press relative inline-flex items-center justify-center gap-2 rounded-2xl font-ui font-extrabold tracking-wide select-none";
  const sizes = {
    sm: "h-9 px-4 text-[12px]",
    md: "h-12 px-6 text-[14px]",
    lg: "h-14 px-7 text-[15px]",
  }[size];
  const variants = {
    wood: "wood text-ivory shadow-soft border border-walnut-dark/50",
    copper:
      "text-ivory border border-walnut-dark/40 shadow-soft bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))]",
    cream: "card-warm text-walnut-dark",
    sage: "text-ivory border border-olive/60 shadow-soft bg-[linear-gradient(170deg,var(--color-sage),var(--color-olive))]",
    ghost: "text-walnut border border-walnut/25 bg-ivory/60",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(base, sizes, variants, full && "w-full", disabled && "opacity-45", className)}
    >
      <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.12)]">{children}</span>
    </button>
  );
}

/* ── Panels & cards ──────────────────────────────────────── */

export function Panel({
  children,
  className,
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "cream" | "dark";
}) {
  const tones = {
    paper: "paper border-walnut/15",
    cream: "card-warm border-walnut/15",
    dark: "wood text-ivory border-walnut-dark/60",
  }[tone];
  return (
    <div className={cn("rounded-[22px] border shadow-soft", tones, className)}>{children}</div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-[19px] font-black leading-tight tracking-tight text-walnut-dark">
        {children}
      </h2>
      {sub ? <p className="font-ui text-[11px] text-walnut/70">{sub}</p> : null}
    </div>
  );
}

export function Stars({ n, max = 5, size = 12 }: { n: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" aria-label={`${n} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z"
            fill={i < n ? "var(--color-gold)" : "transparent"}
            stroke={i < n ? "var(--color-copper)" : "color-mix(in oklab, var(--color-walnut) 35%, transparent)"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export function StatBar({
  label,
  value,
  tone = "copper",
}: {
  label: string;
  value: number;
  tone?: "copper" | "sage" | "gold";
}) {
  const fill = {
    copper: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
    sage: "linear-gradient(90deg,var(--color-sage),var(--color-olive))",
    gold: "linear-gradient(90deg,var(--color-gold),var(--color-tomato))",
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <span className="w-[74px] shrink-0 font-ui text-[11px] font-bold text-walnut/80">{label}</span>
      <span className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-walnut/15">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${value}%`, background: fill }}
        />
      </span>
      <span className="w-7 text-right font-ui text-[11px] font-bold text-walnut/60">{value}</span>
    </div>
  );
}

export function Badge({
  children,
  tone = "cream",
}: {
  children: ReactNode;
  tone?: "cream" | "sage" | "copper" | "locked";
}) {
  const tones = {
    cream: "bg-cream/70 text-walnut border-walnut/20",
    sage: "bg-sage/25 text-olive border-olive/30",
    copper: "bg-copper/18 text-copper border-copper/35",
    locked: "bg-walnut/10 text-walnut/60 border-walnut/15",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] font-ui text-[10px] font-bold uppercase tracking-[0.08em]",
        tones,
      )}
    >
      {children}
    </span>
  );
}

export function Coin({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-copper/30 bg-ivory/80 px-2.5 py-1 font-ui text-[12px] font-extrabold text-walnut-dark shadow-soft">
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-[8px] text-ivory"
        style={{ background: "linear-gradient(160deg,var(--color-gold),var(--color-copper))" }}
      >
        ◈
      </span>
      {n.toLocaleString()}
    </span>
  );
}

/* ── Screen chrome ───────────────────────────────────────── */

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-walnut/20 bg-ivory/85 text-walnut shadow-soft"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[22px] font-black leading-none tracking-tight text-walnut-dark">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 font-hand text-[15px] leading-none text-walnut/70">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </header>
  );
}

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-walnut-dark/45 backdrop-blur-[2px]"
      />
      <div className="anim-up relative m-3 w-[calc(100%-24px)] rounded-[26px] border border-walnut/20 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] p-5 shadow-lift">
        <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-walnut/20" />
        {children}
      </div>
    </div>
  );
}

export function Divider() {
  return <div className="my-3 h-px w-full bg-[repeating-linear-gradient(90deg,color-mix(in_oklab,var(--color-walnut)_28%,transparent)_0_6px,transparent_6px_12px)]" />;
}

/* ── Ambience ────────────────────────────────────────────── */

export function DustMotes({ count = 14 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute block rounded-full bg-[var(--color-gold)]"
          style={{
            left: `${(i * 37) % 96}%`,
            top: `${20 + ((i * 53) % 70)}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            opacity: 0,
            animation: `kc-drift ${9 + (i % 6)}s linear ${i * 0.9}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function Steam({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute bottom-0 block h-10 w-[10px] rounded-full bg-ivory blur-[6px]"
          style={{
            left: i * 14,
            opacity: 0,
            animation: `kc-steam ${3.4 + i * 0.6}s ease-out ${i * 0.8}s infinite`,
          }}
        />
      ))}
    </div>
  );
}