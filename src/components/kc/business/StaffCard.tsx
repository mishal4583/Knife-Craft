import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A staff portrait image (presentation only), or the role's emoji when there is none. */
export function StaffPortrait({
  file,
  name,
  emoji = "🧑‍🍳",
  className,
  ...rest
}: {
  file: string | undefined;
  name: string;
  emoji?: string | undefined;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  if (!file)
    return (
      <span
        className={cn("grid place-items-center bg-walnut/10 text-[34px]", className)}
        aria-hidden
      >
        {emoji}
      </span>
    );
  return (
    <img
      {...rest}
      src={`${import.meta.env.BASE_URL}business/staff-portraits/${file}.webp`}
      alt={`${name} portrait`}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("select-none object-cover object-top", className)}
    />
  );
}

/** "✓ HIRED" / "Needed now" / "Lv 32" — the status pill at the top of a card. */
export function StaffStatus({
  tone,
  children,
}: {
  tone: "hired" | "needed" | "locked";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-ui text-[11px] font-black uppercase tracking-[0.04em] shadow-soft",
        tone === "hired" && "border-olive/50 bg-olive text-ivory",
        tone === "needed" && "border-copper/50 bg-copper text-ivory",
        tone === "locked" && "border-walnut/20 bg-ivory text-walnut/70",
      )}
    >
      {children}
    </span>
  );
}

/** The coin + "$35.00/day now" line, and the muted "$70.00/day from Lv 56" under it. */
export function StaffPay({ now, later }: { now: ReactNode; later?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 font-ui text-[13px] font-black leading-tight text-copper">
        <span aria-hidden className="text-[14px]">
          🪙
        </span>
        <span className="min-w-0">{now}</span>
      </p>
      {later ? (
        <p className="font-ui text-[11.5px] font-bold leading-tight text-walnut/55">{later}</p>
      ) : null}
    </div>
  );
}

/**
 * A staff portrait card (developer 2026-10-23, the reference "Staff" mock-up):
 * the portrait on the left, then the status pill, name + ⓘ, a short effect
 * line and the pay; the Hire / Let go button across the bottom. It is laid out
 * by its OWN width (a container query), never the window's — the game is drawn
 * in a fixed frame, so a window rule squeezed the card on desktop. Narrower
 * than 200 px (two columns on a small phone) the portrait sits on top.
 */
export function StaffCard({
  portrait,
  status,
  title,
  info,
  glance,
  pay,
  action,
  tone = "plain",
  className,
  ...rest
}: {
  portrait: ReactNode;
  status?: ReactNode;
  title: string;
  info?: ReactNode;
  glance?: ReactNode;
  pay?: ReactNode;
  action: ReactNode;
  tone?: "plain" | "hired" | "needed" | "locked";
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <article
      {...rest}
      className={cn(
        "product-card @container flex min-w-0 flex-col rounded-[20px] border p-2 card-warm",
        tone === "hired" && "border-olive/35",
        tone === "needed" && "border-copper/50 ring-2 ring-copper ring-offset-2 ring-offset-cream",
        tone === "locked" && "border-walnut/15 opacity-75",
        tone === "plain" && "border-walnut/15",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-2 @min-[200px]:grid @min-[200px]:grid-cols-[44%_minmax(0,1fr)]">
        <div className="relative h-[104px] overflow-hidden rounded-[14px] border border-walnut/15 bg-walnut/10 @min-[200px]:h-full @min-[200px]:min-h-[128px]">
          {portrait}
          {status ? (
            // Narrow card: the pill sits on the picture; wide: at the top of the text column.
            <span className="absolute right-1.5 top-1.5 @min-[200px]:hidden">{status}</span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          {status ? <span className="hidden @min-[200px]:block">{status}</span> : null}
          <div className="flex min-w-0 items-start justify-between gap-1">
            <p className="min-w-0 break-words font-display text-[15px] font-black leading-tight text-walnut-dark">
              {title}
            </p>
            {info ? <span className="shrink-0">{info}</span> : null}
          </div>
          {glance ? (
            <p className="line-clamp-2 font-ui text-[12px] font-semibold leading-snug text-walnut/65">
              {glance}
            </p>
          ) : null}
          {pay ? <div className="mt-auto pt-0.5">{pay}</div> : null}
        </div>
      </div>
      <div className="pt-2">{action}</div>
    </article>
  );
}

/**
 * A specialist chef's row (the reference's lower list): portrait, name ·
 * cuisine, status + ⓘ and pay, the button on the right; below 380 px the
 * button drops under the text.
 */
export function StaffRow({
  portrait,
  title,
  subtitle,
  status,
  info,
  glance,
  pay,
  action,
  tone = "plain",
  ...rest
}: {
  portrait: ReactNode;
  title: string;
  subtitle?: string;
  status?: ReactNode;
  info?: ReactNode;
  glance?: ReactNode;
  pay?: ReactNode;
  action: ReactNode;
  tone?: "plain" | "hired" | "needed" | "locked";
} & Record<`data-${string}`, string | undefined>) {
  return (
    <article
      {...rest}
      className={cn(
        "@container min-w-0 rounded-[18px] border bg-ivory/75 p-2",
        tone === "hired" && "border-olive/30",
        tone === "needed" && "border-copper/50 ring-2 ring-copper ring-offset-2 ring-offset-cream",
        tone === "locked" && "border-walnut/12 opacity-75",
        tone === "plain" && "border-walnut/12",
      )}
    >
      <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2.5 @min-[380px]:grid-cols-[96px_minmax(0,1fr)_auto]">
        <div className="relative h-[84px] overflow-hidden rounded-[14px] border border-walnut/15 bg-walnut/10 @min-[380px]:h-[88px]">
          {portrait}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-display text-[15px] font-black leading-tight text-walnut-dark">
            {title}
            {subtitle ? (
              <span className="font-ui text-[12.5px] font-extrabold text-walnut/70">
                {" "}
                · {subtitle}
              </span>
            ) : null}
          </p>
          {status || info ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {status}
              {info}
            </div>
          ) : null}
          {glance ? (
            <p className="line-clamp-1 font-ui text-[12px] font-semibold text-walnut/60">
              {glance}
            </p>
          ) : null}
          {pay}
        </div>
        <div className="col-span-2 @min-[380px]:col-span-1 @min-[380px]:w-[104px]">{action}</div>
      </div>
    </article>
  );
}
