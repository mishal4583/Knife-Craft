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
 */
export function MilestoneBanner({
  kicker,
  line,
  rows,
  onDismiss,
  ms = 4200,
}: {
  kicker: string;
  line: string;
  /** Optional label / value lines under `line` (the Level Complete earnings breakdown). */
  rows?: ReadonlyArray<{ label: string; value: string; strong?: boolean }>;
  onDismiss: () => void;
  ms?: number;
}) {
  const paused = usePaused();
  // Armed once per mount, matching a fresh banner per milestone.
  usePausableTimeout(onDismiss, ms, "mount");

  return (
    <div
      className={cn(
        "anim-pop pointer-events-none absolute inset-x-0 top-[8%] z-50 flex justify-center px-6",
        paused && "kc-story-paused",
      )}
      data-story-paused={paused ? "true" : undefined}
    >
      <Panel tone="cream" className="max-w-[360px] px-5 py-3 text-center shadow-soft">
        <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-gold">
          {kicker}
        </p>
        <p className="mt-1 font-hand text-[19px] leading-snug text-walnut-dark">{line}</p>
        {rows?.length ? (
          <div
            className="mt-2 space-y-0.5 border-t border-walnut/15 pt-2 font-ui text-[14.5px] font-bold text-walnut/75"
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
      </Panel>
    </div>
  );
}
