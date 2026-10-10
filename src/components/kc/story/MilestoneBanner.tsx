import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/kc/common/primitives";
import { usePausableTimeout, usePaused } from "./usePausableTimeout";

/**
 * MILESTONE_BANNER — ported from knifecraft.html's `banner(kicker,line,ms)`
 * (`:11139`): a kicker + line card, shown for `ms` (default 4200, the
 * source's own default) then auto-dismissed via `onDismiss`. Used for
 * both the story milestones (completed-level counts 10/20/45/70/110/120)
 * and, generically, nothing else — it is not the pre-existing cafe-tier progression
 * display (Kitchen.tsx's header label / Journal.tsx's Progression
 * screen), which is a separate, passive, always-on system this banner
 * does not touch or race with (see StoryManager.ts's own doc on why
 * the two don't collide: the cafe tier has no active popup of its own
 * to sequence against).
 *
 * Its timer counts unpaused time only (PauseManager): a platform pause
 * holds the banner, and its entrance animation, until the resume.
 *
 * Developer 2026-10-10: it also goes away as soon as the player does
 * something else — a tap / click anywhere outside the card (which still
 * reaches whatever was tapped) or a key — after OUTSIDE_TAP_GRACE_MS, so the
 * tap that finished the level doesn't close it at once. Shorter times too
 * (default 2000 ms, was 4200), and moving to another page closes it.
 */
export const OUTSIDE_TAP_GRACE_MS = 350;
export function MilestoneBanner({
  kicker,
  line,
  rows,
  notes,
  quote,
  grand = false,
  onDismiss,
  ms = 2000,
  page,
}: {
  kicker: string;
  line: string;
  /** Optional label / value lines under `line` (the Level Complete earnings breakdown). */
  rows?: ReadonlyArray<{ label: string; value: string; strong?: boolean }>;
  /** Optional one-line notes under the rows (a section that opened, a new day). */
  notes?: ReadonlyArray<string>;
  /** Grandma's line (Levels 1–15, restaurant/firstLevels.ts). */
  quote?: string;
  /** The bigger celebration card (the Level 10 milestone); a tap dismisses it. */
  grand?: boolean;
  onDismiss: () => void;
  ms?: number;
  /** The screen it was shown on: moving to another page closes it (developer 2026-10-10). */
  page?: string;
}) {
  const paused = usePaused();
  // Armed once per mount, matching a fresh banner per milestone.
  usePausableTimeout(onDismiss, ms, "mount");
  const card = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  // Another page → it goes (developer 2026-10-10: "when I take a new page it should
  // automatically disappear").
  const shownOn = useRef(page);
  useEffect(() => {
    if (page !== shownOn.current) dismiss.current();
  }, [page]);
  // A tap / click outside the card or a key press dismisses it (the event still goes through).
  useEffect(() => {
    const armedAt = performance.now() + OUTSIDE_TAP_GRACE_MS;
    const away = (e: Event) => {
      if (performance.now() < armedAt) return;
      if (e.type === "pointerdown" && card.current?.contains(e.target as Node)) return;
      dismiss.current();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", away, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", away, true);
    };
  }, []);

  return (
    <div
      className={cn(
        "anim-pop absolute inset-x-0 z-50 flex justify-center px-6",
        grand ? "top-[14%]" : "pointer-events-none top-[8%]",
        paused && "kc-story-paused",
      )}
      data-story-paused={paused ? "true" : undefined}
      data-testid={grand ? "milestone-grand" : undefined}
      onClick={grand ? onDismiss : undefined}
    >
      <div ref={card} className="contents">
        <Panel
          tone="cream"
          className={cn(
            "relative px-5 py-3 text-center shadow-soft",
            grand ? "max-w-[380px] py-5 ring-2 ring-gold/60 shadow-lift" : "max-w-[360px]",
          )}
        >
          {/* Close (developer 2026-10-09): dismiss any banner at once — the wrapper
            lets taps through to the game, this button takes them. */}
          <button
            type="button"
            aria-label="Close"
            data-testid="banner-close"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="press pointer-events-auto absolute -right-2 -top-2 grid h-12 w-12 place-items-center rounded-full"
          >
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[13.5px] font-extrabold text-walnut/70 shadow-soft"
            >
              ✕
            </span>
          </button>
          {grand ? (
            <p className="text-[30px] leading-none" aria-hidden>
              ✨🍽️✨
            </p>
          ) : null}
          <p
            className={cn(
              "font-ui font-extrabold uppercase tracking-[0.14em] text-gold",
              grand ? "mt-2 text-[14.5px]" : "text-[12px]",
            )}
          >
            {kicker}
          </p>
          <p
            className={cn(
              "mt-1 font-hand leading-snug text-walnut-dark",
              grand ? "text-[21px]" : "text-[18px]",
            )}
          >
            {line}
          </p>
          {rows?.length ? (
            <div
              className="mt-2 space-y-0.5 border-t border-walnut/15 pt-2 font-ui text-[13.5px] font-bold text-walnut/75"
              data-testid="banner-rows"
            >
              {rows.map((r) => (
                <div
                  key={r.label}
                  className={cn("flex justify-between gap-4", r.strong && "text-walnut-dark")}
                >
                  <span>{r.label}</span>
                  <span className={r.strong ? "font-extrabold text-olive" : "text-olive"}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {notes?.length ? (
            <ul
              className="mt-2 space-y-0.5 border-t border-walnut/15 pt-2 font-ui text-[13.5px] font-extrabold text-walnut-dark"
              data-testid="banner-notes"
            >
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {quote ? (
            <p
              className="mt-2 border-t border-walnut/15 pt-2 font-hand text-[16px] leading-snug text-walnut/80"
              data-testid="banner-grandma"
            >
              👵 “{quote}”
            </p>
          ) : null}
          {grand ? (
            <p className="mt-2 font-ui text-[11px] font-bold text-walnut/50">Tap to continue</p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
