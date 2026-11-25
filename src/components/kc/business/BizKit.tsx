import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PIcon } from "../progress/ProgressKit";

/**
 * BUSINESS KIT (developer 2026-11-25, docs/planning/BUSINESS-UI-REDESIGN-PLAN-2026-11-25.md): the few pieces the Business pages need on top of the Restaurant
 * Progress kit (kc/progress/ProgressKit.tsx: cards, ribbons, pills, bars, `Art`, `PIcon`). Drawn by code; pictures come through `Art` / `PIcon` ("biz:<sheet>/<slug>").
 * Display and buttons only: nothing here buys or changes anything by itself.
 */

/** Painted pictures the Business pages name more than once (the picture files keep their sheet names). */
export const BIZ_ART = {
  /** The gold stack drawn beside a profit or earnings figure. */
  profit: "icons-a/coins",
} as const;

/** The big call-to-action button: gold ("View Restaurant Progress →") or wood ("Open Service →"). ≥ 48 px tall. */
export function GoldButton({
  icon,
  children,
  className,
  tone = "gold",
  ...rest
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "gold" | "wood";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border px-5 py-2 font-display text-[16px] font-black leading-tight",
        tone === "gold"
          ? "border-[#d9a22c] bg-[linear-gradient(180deg,#ffe9a0,#f8c752_60%,#e8a52c)] text-[#5a2d08] shadow-[inset_0_1px_0_#fff4c8,0_2px_5px_rgba(120,70,10,0.25)]"
          : "border-[#c99b4e] bg-[linear-gradient(180deg,#8a5330,#5e3519_60%,#46250f)] text-[#fff4dc] shadow-[inset_0_1px_0_rgba(255,226,160,0.4),0_2px_5px_rgba(60,30,10,0.3)]",
        rest.disabled && "opacity-45",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** A small round-cornered cream tile with an icon beside its words (the four "One restaurant" tiles). */
export function IconTile({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[72px] items-center gap-3 rounded-2xl border border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        className,
      )}
    >
      <span className="grid w-11 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 font-ui text-[13px] font-bold leading-snug text-walnut-dark">
        {children}
      </span>
    </div>
  );
}

/** "One restaurant | one wallet": the footer of the Business pages (pictures 01 and 11). */
export function OneWalletFooter() {
  return (
    <p
      className="flex items-center justify-center gap-2 px-6 pb-2 pt-5 text-center font-hand text-[16px] text-walnut/60"
      data-testid="one-wallet-footer"
    >
      <PIcon name="biz:icons-a/plate-cutlery" fallback="🍽️" size={26} />
      One restaurant
      <span aria-hidden className="mx-1 h-5 w-px bg-walnut/25" />
      <PIcon name="biz:icons-a/wallet-cash" fallback="💵" size={26} />
      one wallet
    </p>
  );
}
