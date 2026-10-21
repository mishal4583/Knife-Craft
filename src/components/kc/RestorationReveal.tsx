import { useEffect, useRef, useState } from "react";
import { AudioManager } from "@/game/AudioManager";
import { kitchenUpgradeOrDefault } from "@/game/kitchen/kitchenUpgradeDefinitions";
import {
  FAMILY_OBJECTS,
  RESTORATION_STAGES,
  REVEAL,
  isMajorReveal,
  stageOf,
  tierChangeLines,
} from "@/game/kitchen/restoration";
import { KITCHEN_SKIN_SRC } from "./KitchenBackground";
import { KButton } from "./common/primitives";
import { cn } from "@/lib/utils";

/**
 * RESTORATION_REVEAL — Phase 5 (A, developer 2026-10-21): the before-and-
 * after of a kitchen tier that was JUST built. App opens it only from a
 * successful purchase (KitchenUpgradeManager.purchaseKitchenUpgrade returned
 * ok and the save holds the new tier), so it can never show a kitchen the
 * player doesn't own; the Kitchen screen behind it already shows the new
 * kitchen (it reads the saved tier), so skipping, closing or losing the
 * reveal changes nothing.
 *
 * The old kitchen's painting shows first, then the new one wipes across it
 * (a light sweep at the edge). A build that reaches a new restoration stage
 * (restoration.ts) gets the full reveal — the stage, what changed, what the
 * family's kitchen kept; one within a stage gets the short one. Skip jumps
 * to the finished picture; Continue closes. Reduced Motion: no wipe, the
 * new kitchen at once. All timers die with the component.
 */
export function RestorationReveal({
  from,
  to,
  onClose,
}: {
  from: string;
  to: string;
  onClose: () => void;
}) {
  const major = isMajorReveal(from, to);
  const timing = major ? REVEAL.MAJOR : REVEAL.MINOR;
  const [reduced] = useState(
    () =>
      typeof document !== "undefined" &&
      (document.documentElement.classList.contains("kc-reduced-motion") ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches)),
  );
  const [phase, setPhase] = useState<"before" | "wipe" | "after">(reduced ? "after" : "before");
  const timers = useRef<number[]>([]);
  const closed = useRef(false);

  useEffect(() => {
    if (reduced) {
      AudioManager.playChime();
      return;
    }
    timers.current.push(
      window.setTimeout(() => setPhase("wipe"), timing.HOLD),
      window.setTimeout(() => {
        setPhase("after");
        AudioManager.playChime();
      }, timing.HOLD + timing.WIPE),
    );
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per reveal
  }, []);

  function skip() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (phase !== "after") AudioManager.playChime();
    setPhase("after");
  }
  function close() {
    if (closed.current) return;
    closed.current = true;
    onClose();
  }

  const before = kitchenUpgradeOrDefault(from);
  const after = kitchenUpgradeOrDefault(to);
  const stage = RESTORATION_STAGES[stageOf(to)];
  const lines = tierChangeLines(to);
  const wiping = phase !== "before";

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-walnut-dark/70 px-3 backdrop-blur-[3px]"
      data-testid="restoration-reveal"
      data-major={major}
      data-phase={phase}
      data-from={from}
      data-to={to}
    >
      <div className="anim-pop flex max-h-[calc(100%-16px)] w-full max-w-[400px] flex-col overflow-y-auto rounded-[26px] border border-gold/40 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] p-4 text-center shadow-lift">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.22em] text-copper">
          {major ? "The restaurant comes back to life" : "A little more of the restaurant"}
        </p>
        <div
          className={cn(
            "relative mx-auto mt-2 w-full overflow-hidden rounded-[18px] border border-walnut/20 bg-walnut-dark",
            major ? "aspect-[4/5] max-h-[46vh]" : "aspect-[16/10] max-h-[28vh]",
          )}
        >
          <img
            src={KITCHEN_SKIN_SRC[before.asset]}
            alt={`Before: ${before.name}`}
            className="absolute inset-0 h-full w-full object-cover"
            data-testid="reveal-before"
          />
          <img
            src={KITCHEN_SKIN_SRC[after.asset]}
            alt={`After: ${after.name}`}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              clipPath: wiping ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
              transition: reduced ? "none" : `clip-path ${timing.WIPE}ms ease-in-out`,
            }}
            data-testid="reveal-after"
          />
          {phase === "wipe" && !reduced ? (
            <span
              className="kc-reveal-sweep pointer-events-none absolute inset-y-0 w-10 bg-[linear-gradient(90deg,transparent,rgba(255,236,190,0.75),transparent)]"
              style={{ animationDuration: `${timing.WIPE}ms` }}
              aria-hidden="true"
            />
          ) : null}
          <span className="absolute left-2 top-2 rounded-full bg-walnut-dark/70 px-2 py-0.5 font-ui text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ivory">
            {phase === "after" ? "After" : "Before"}
          </span>
        </div>
        {major ? (
          <>
            <p className="mt-2 font-display text-[21px] font-black leading-tight text-walnut-dark">
              {stage.name}
            </p>
            <p className="font-hand text-[16px] leading-snug text-walnut/75">{stage.line}</p>
          </>
        ) : (
          <p className="mt-2 font-display text-[19px] font-black leading-tight text-walnut-dark">
            {after.name}
          </p>
        )}
        {phase === "after" ? (
          <div className="mt-1.5 space-y-0.5 text-left" data-testid="reveal-changes">
            {(major ? lines : lines.slice(0, 2)).map((l) => (
              <p
                key={l.kind}
                className="font-ui text-[12.5px] font-bold leading-snug text-walnut/80"
              >
                {l.icon} {l.text}
              </p>
            ))}
            {major ? (
              <p
                className="pt-0.5 font-hand text-[14.5px] leading-snug text-olive"
                data-testid="reveal-kept"
              >
                Still here: {FAMILY_OBJECTS}.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3">
          {phase === "after" ? (
            <KButton full onClick={close}>
              Continue
            </KButton>
          ) : (
            <KButton full variant="ghost" onClick={skip}>
              Skip ›
            </KButton>
          )}
        </div>
      </div>
    </div>
  );
}
