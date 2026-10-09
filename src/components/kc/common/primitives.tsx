import { formatUsd } from "@/game/money";
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
    sm: "h-9 px-4 text-[13.5px]",
    md: "h-12 px-6 text-[15.5px]",
    lg: "h-14 px-7 text-[16.5px]",
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
      {sub ? <p className="font-ui text-[12.5px] text-walnut/70">{sub}</p> : null}
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
            stroke={
              i < n
                ? "var(--color-copper)"
                : "color-mix(in oklab, var(--color-walnut) 35%, transparent)"
            }
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
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
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] font-ui text-[11.5px] font-bold uppercase tracking-[0.08em]",
        tones,
      )}
    >
      {children}
    </span>
  );
}

/** The wallet chip — the game's one money display: a "$" badge + formatUsd (n is integer US cents, see money.ts). Used by every screen header, Campaign and Business alike. */
export function Coin({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-copper/30 bg-ivory/80 px-2.5 py-1 font-ui text-[13.5px] font-extrabold text-walnut-dark shadow-soft">
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-[9px] text-ivory"
        style={{ background: "linear-gradient(160deg,var(--color-gold),var(--color-copper))" }}
      >
        $
      </span>
      {formatUsd(n)}
    </span>
  );
}

/* ── Screen chrome ───────────────────────────────────────── */

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  wrapTitle,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Let a long title wrap to a second line instead of truncating (narrow phones). */
  wrapTitle?: boolean;
}) {
  return (
    // flex-wrap + a title column that never shrinks below its own text: on a
    // narrow phone, when the title can't fit beside `right` (the wallet
    // chip), the chip drops to its own right-aligned row instead of the
    // title truncating or running underneath it. Wide screens are unchanged.
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2 pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          // Playables touch-target minimum is 48x48dp (§2.17/§2.8) — this
          // was 40x40, undershooting it like every other icon button this
          // pass audited (see IconButton/Kitchen's own Settings button).
          // Grown here, not via a separate invisible hit-rect, since this
          // is real DOM: the button's own box IS the hit box, so making it
          // 48px also draws it 48px — the icon glyph inside stays the same
          // 16x16 visual size via place-items-center, unaffected.
          className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-walnut/20 bg-ivory/85 text-walnut shadow-soft"
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
      <div className="min-w-min flex-1">
        <h1
          className={cn(
            "font-display text-[22px] font-black tracking-tight text-walnut-dark",
            wrapTitle ? "leading-[1.05]" : "truncate leading-none",
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 font-hand text-[17px] leading-none text-walnut/70">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="ml-auto shrink-0">{right}</div> : null}
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
  return (
    <div className="my-3 h-px w-full bg-[repeating-linear-gradient(90deg,color-mix(in_oklab,var(--color-walnut)_28%,transparent)_0_6px,transparent_6px_12px)]" />
  );
}

/* ── Ambience ────────────────────────────────────────────── */

export function DustMotes({ count = 14 }: { count?: number }) {
  return (
    <div className="kc-ambient pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
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
    <div className={cn("kc-ambient pointer-events-none absolute", className)} aria-hidden>
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
