import { useEffect } from "react";
import { Panel } from "@/components/kc/common/primitives";

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
 */
export function MilestoneBanner({
  kicker,
  line,
  onDismiss,
  ms = 4200,
}: {
  kicker: string;
  line: string;
  onDismiss: () => void;
  ms?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount, matching a fresh banner per milestone
  }, []);

  return (
    <div className="anim-pop pointer-events-none absolute inset-x-0 top-[8%] z-50 flex justify-center px-6">
      <Panel tone="cream" className="max-w-[360px] px-5 py-3 text-center shadow-soft">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold">
          {kicker}
        </p>
        <p className="mt-1 font-hand text-[17px] leading-snug text-walnut-dark">{line}</p>
      </Panel>
    </div>
  );
}
