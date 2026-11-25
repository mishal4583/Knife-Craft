import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { markProgressArtFailed, progressArtUrl } from "@/game/progressArt";
import { BUSINESS_ART_PREFIX, businessArtUrl, markBusinessArtFailed } from "@/game/businessArt";
import { rivalPortraitPath } from "@/game/chefArt";
import { PaintedPortrait } from "../common/PaintedPortrait";

/** The URL of a picture of either set: "<sheet>/<slug>" is a Restaurant Progress picture, "biz:<sheet>/<slug>" a Business page picture. */
function artUrlOf(name: string): string | null {
  return name.startsWith(BUSINESS_ART_PREFIX)
    ? businessArtUrl(name.slice(BUSINESS_ART_PREFIX.length))
    : progressArtUrl(name);
}

function markArtFailed(name: string): void {
  if (name.startsWith(BUSINESS_ART_PREFIX))
    markBusinessArtFailed(name.slice(BUSINESS_ART_PREFIX.length));
  else markProgressArtFailed(name);
}

/**
 * PROGRESS KIT (developer 2026-11-25, docs/planning/RESTAURANT-PROGRESS-REDESIGN-PLAN-2026-11-25.md): the painted-card pieces of the Restaurant Progress page.
 * Drawn by code (so they stretch with their words): the paper card, the gold ribbon heading, the value pill, the glossy bars, the rank medals and the status marks.
 * Painted by Codex (public/progress/, src/game/progressArt.ts): the pictures, each shown through `Art`, which draws today's icon until the picture exists.
 * Display only: nothing here buys or changes anything.
 */

/**
 * A blurred photo behind a wood card (developer 2026-11-25, like "Your restaurant today"): `public/business/bg/<name>-wide.webp` and `-tall.webp`
 * under a dark walnut veil. The parent must be `relative isolate overflow-hidden` and a `@container` (the wide picture shows from 560 px of card).
 * If a picture fails to load the card keeps its wood. Display only; the words sit on top and keep their place.
 */
export function CardBackdrop({ name }: { name: "ranking" | "briefing" }) {
  const [bad, setBad] = useState(false);
  if (bad) return null;
  const base = `${import.meta.env.BASE_URL}business/bg/${name}`;
  const cls = "absolute inset-0 h-full w-full select-none object-cover object-center";
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
      data-testid="card-backdrop"
    >
      <img
        src={`${base}-tall.webp`}
        alt=""
        loading="lazy"
        draggable={false}
        className={`${cls} @min-[560px]:hidden`}
        onError={() => setBad(true)}
      />
      <img
        src={`${base}-wide.webp`}
        alt=""
        loading="lazy"
        draggable={false}
        className={`${cls} hidden @min-[560px]:block`}
        onError={() => setBad(true)}
      />
      <div className="absolute inset-0 bg-walnut-dark/40" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-walnut-dark/45 via-walnut-dark/15 to-transparent @min-[560px]:block" />
    </div>
  );
}

/** A painted picture, or `fallback` (today's emoji / icon) when the picture is not there or fails to load. */
export function Art({
  name,
  fallback,
  className,
  style,
}: {
  /** "<sheet>/<slug>" (scripts/progress-sheets.json) or "biz:<sheet>/<slug>" (scripts/business-sheets.json) */
  name: string;
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [, redraw] = useState(0);
  const url = artUrlOf(name);
  if (!url) return <>{fallback ?? null}</>;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      loading="lazy"
      data-art={name}
      className={cn("select-none object-contain", className)}
      style={style}
      onError={() => {
        markArtFailed(name);
        redraw((n) => n + 1);
      }}
    />
  );
}

/** A square icon slot: the painted picture at `size` px, else the emoji (drawn as the game's painted icon). */
export function PIcon({
  name,
  fallback,
  size = 28,
  className,
}: {
  name: string;
  fallback: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center leading-none", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.78) }}
    >
      <Art
        name={name}
        fallback={<span>{fallback}</span>}
        className="h-full w-full"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

/**
 * The ribbon heading that sits across the top-left corner of a card: the gold tab (Restaurant Progress, Business Overview / Equipment / Suppliers) or, with
 * `dark`, the walnut ribbon with a leaf sprig at its end (Business Menu / Operations / Finance, developer 2026-11-25).
 */
export function RibbonHeading({
  icon,
  children,
  dark = false,
}: {
  icon?: ReactNode;
  children: ReactNode;
  dark?: boolean;
}) {
  if (dark) {
    return (
      <h2 className="bz-ribbon-dark absolute -left-1.5 -top-3 z-10 flex min-h-10 max-w-[calc(100%-1.5rem)] items-center gap-1.5 py-1 pl-2.5 pr-9 font-display text-[16px] font-black leading-tight">
        {icon ? <span className="-ml-1 shrink-0">{icon}</span> : null}
        <span className="min-w-0">{children}</span>
        <Art
          name="icons-c/leaf-right"
          className="pointer-events-none absolute -right-3 top-1/2 h-9 w-9 -translate-y-1/2"
        />
      </h2>
    );
  }
  return (
    <h2 className="pg-ribbon absolute -left-1.5 -top-3 z-10 flex min-h-9 items-center gap-1.5 py-1 pl-2.5 pr-7 font-display text-[14.5px] font-black uppercase leading-tight tracking-wide">
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0">{children}</span>
    </h2>
  );
}

/**
 * A painted paper card with a ribbon heading. It lays itself out by its own width (container queries: `@min-[720px]:` is the wide, mock-up layout), so the same
 * card is right in a wide window, on a phone and in between. Extra props (data-testid ...) go to the card.
 */
export function ProgressCard({
  title,
  icon,
  right,
  dark,
  className,
  children,
  ...rest
}: {
  /** The ribbon heading; leave it out for a plain paper card (the chef title, prestige and league cards use a small caps label instead). */
  title?: ReactNode;
  icon?: ReactNode;
  /** Top-right slot: a pill, an ⓘ. */
  right?: ReactNode;
  /** The walnut ribbon instead of the gold tab (Business Menu / Operations). */
  dark?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title" | "className" | "children">) {
  return (
    <section
      className={cn(
        "pg-card relative rounded-[22px] px-4 pb-4",
        title ? "pt-8" : "pt-4",
        className,
      )}
      {...rest}
    >
      {title ? (
        <RibbonHeading icon={icon} dark={dark === true}>
          {title}
        </RibbonHeading>
      ) : null}
      {right ? <div className="absolute right-3 top-1.5 z-10">{right}</div> : null}
      {children}
    </section>
  );
}

/** A small gold ribbon inside a card (a sub-heading such as "Knife mastery"). */
export function SubRibbon({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="pg-ribbon inline-flex min-h-8 items-center gap-1.5 py-1 pl-2.5 pr-7 font-display text-[13px] font-black uppercase leading-tight tracking-wide">
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </p>
  );
}

/** A cream pill for a value ("Grand Service", "$110,360.00"). */
export function ValuePill({
  children,
  tone = "cream",
  className,
}: {
  children: ReactNode;
  tone?: "cream" | "gold" | "green" | "red";
  className?: string;
}) {
  const t =
    tone === "red"
      ? "bg-[linear-gradient(180deg,#ffe3df,#f9bcb5)] border-[#e08a80] text-[#8c1d14]"
      : tone === "gold"
        ? "bg-[linear-gradient(180deg,#ffe9a6,#f9cd62)] border-[#e2b24a] text-[#5a2d08]"
        : tone === "green"
          ? "bg-[linear-gradient(180deg,#e9f3d4,#cfe3a3)] border-[#a4c26a] text-[#34531a]"
          : "pg-pill text-walnut-dark";
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full border px-3 py-0.5 text-center font-ui text-[13.5px] font-extrabold leading-tight",
        t,
        className,
      )}
    >
      {children}
    </span>
  );
}

const BAR_FILL = {
  gold: "linear-gradient(180deg,#ffe48d,#f7b934 70%,#e59f22)",
  copper: "linear-gradient(180deg,#eaa957,#c1741f 70%,#a45d13)",
  green:
    "repeating-linear-gradient(135deg,rgba(255,255,255,0.24) 0 7px,transparent 7px 14px),linear-gradient(180deg,#a9d47c,#76a83f 70%,#5f9030)",
} as const;

/** A glossy progress bar (gold, copper or striped green). `fraction` is 0 to 1. */
export function GlossBar({
  fraction,
  tone = "gold",
  height = 14,
  label,
  className,
}: {
  fraction: number;
  tone?: keyof typeof BAR_FILL;
  height?: number;
  /** What the bar measures, for screen readers. */
  label?: string;
  className?: string;
}) {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
      className={cn(
        "relative block w-full overflow-hidden rounded-full border border-[#d8bb86]/80 bg-[#eedabf] shadow-[inset_0_1px_2px_rgba(90,45,8,0.18)]",
        className,
      )}
      style={{ height }}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${f * 100}%`, background: BAR_FILL[tone], minWidth: f > 0 ? height : 0 }}
      >
        <span className="absolute inset-x-1 top-[2px] h-[35%] rounded-full bg-white/40" />
      </span>
    </span>
  );
}

/** A row with a painted icon at the left, a label and a value (a pill or text) at the right. */
export function IconRow({
  icon,
  label,
  children,
  testId,
}: {
  icon?: ReactNode;
  label: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex min-h-11 items-center gap-2.5 border-b border-walnut/10 py-1 last:border-b-0"
      data-testid={testId}
    >
      {icon ? <span className="grid w-8 shrink-0 place-items-center">{icon}</span> : null}
      <span className="min-w-0 flex-1 font-ui text-[13.5px] font-bold leading-tight text-walnut-dark">
        {label}
      </span>
      <span className="shrink-0 text-right font-ui text-[13.5px] font-extrabold text-walnut-dark">
        {children}
      </span>
    </div>
  );
}

/** A big painted icon with a number and its label (the "restaurant in numbers" tiles). */
export function StatTile({
  icon,
  value,
  label,
  dataNumber,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  dataNumber?: string;
}) {
  return (
    <div
      data-number={dataNumber}
      className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
    >
      <span className="grid w-11 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-[22px] font-black leading-none text-walnut-dark">
          {value}
        </span>
        <span className="mt-0.5 block font-ui text-[12.5px] font-bold leading-tight text-walnut/70">
          {label}
        </span>
      </span>
    </div>
  );
}

const MEDAL_DISC = {
  1: "bg-[radial-gradient(circle_at_35%_30%,#fff2a8,#f4bd2e_60%,#c98a12)] border-[#b9800f] text-[#5a3405]",
  2: "bg-[radial-gradient(circle_at_35%_30%,#ffffff,#cfd4da_60%,#9aa2ad)] border-[#8b939e] text-[#3d4550]",
  3: "bg-[radial-gradient(circle_at_35%_30%,#ffd9a8,#d98d4c_60%,#a85f26)] border-[#9a5a24] text-[#4d2608]",
} as const;

/** A rank: a laurel medal (gold, silver, bronze) for 1 to 3, a number pill for the rest. The painted medal is blank: the number is written over it. */
export function RankMedal({ rank, player }: { rank: number; player?: boolean }) {
  if (rank >= 1 && rank <= 3) {
    const r = rank as 1 | 2 | 3;
    return (
      <span className="relative grid h-9 w-9 shrink-0 place-items-center" data-medal={r}>
        <Art
          name={`medals/rank-${r}`}
          className="absolute inset-0 h-full w-full"
          fallback={
            <span
              className={cn("absolute inset-0 rounded-full border-2 shadow-sm", MEDAL_DISC[r])}
            />
          }
        />
        <span className="relative font-display text-[16px] font-black leading-none">{rank}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid h-8 min-w-9 shrink-0 place-items-center rounded-full border px-2 font-display text-[14.5px] font-black leading-none",
        player
          ? "border-[#b9800f] bg-[linear-gradient(180deg,#e3a93a,#bd7f14)] text-white"
          : "pg-pill text-walnut-dark",
      )}
    >
      {rank}
    </span>
  );
}

/** The round mark at the start of a milestone row: a gold check coin when done, an empty ring when not. */
export function StatusMark({ done }: { done: boolean }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center" data-mark={done ? "done" : "open"}>
      <Art
        name={done ? "icons-c/mark-done" : "icons-c/mark-open"}
        className="h-6 w-6"
        fallback={
          done ? (
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-[#c58a14] bg-[radial-gradient(circle_at_35%_30%,#fff0a0,#f4bd2e)] text-[13px] font-black leading-none text-[#5a3405]">
              ✓
            </span>
          ) : (
            <span className="h-5 w-5 rounded-full border-2 border-walnut/25" />
          )
        }
      />
    </span>
  );
}

/**
 * A small chef face picked by a seed. A rival's id shows THAT rival's chef (the Codex busts of 2026-11-25, `game/chefArt.ts`); anything else ("you") is one of the five generic painted
 * busts, else the chef emoji. A rival's picture that cannot load falls back to the generic bust.
 */
export function ChefFace({ seed, size = 24 }: { seed: string; size?: number }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 5;
  const generic = <PIcon name={`icons-b/chef-${h}`} fallback="👨‍🍳" size={size} />;
  const portrait = rivalPortraitPath(seed);
  if (!portrait) return generic;
  return (
    <PaintedPortrait
      path={portrait}
      width={size}
      round
      data-portrait={seed}
      className="border border-walnut-dark/30 bg-ivory/60 shadow-sm"
      fallback={generic}
    />
  );
}
