import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { KButton, Panel } from "@/components/kc/common/primitives";
import { STORY_ART } from "@/game/story/storyArt";
import type { StoryBeat, StoryCardId } from "@/game/story/storyDefinitions";
import { IngredientCardCanvas } from "./IngredientCardCanvas";
import { usePausableTimeout, usePaused } from "./usePausableTimeout";

/**
 * STORY_OVERLAY — plays one sequence of story beats (the FINALE; the
 * opening intro is CinematicIntro.tsx), adapted from knifecraft.html's own
 * `render(b)`/`advance()`/`run(list,done)`/`finish()` (`:11076-11138`)
 * into React state/effects. Beat DATA lives in storyDefinitions.ts; this
 * component only supplies the sequencing/rendering.
 *
 * Progression:
 *  - A beat with no `btn` advances after `hold` ms (default 3000), or on a
 *    tap anywhere (artwork and dialogue included) once the beat has been
 *    up for MIN_TAP_MS, so one double tap can't skip two beats.
 *  - A beat WITH `btn` only advances through that button; screen taps
 *    never bypass it.
 *  - Every advance is tied to the beat it came from (`advanceFrom`), so a
 *    timer and a tap — or two taps — landing together move one beat.
 *  - A platform pause (PauseManager) stops the beat's timer — the rest of
 *    its hold runs after the resume — freezes every animation and ignores
 *    taps, so nothing moves on while the player is away.
 *  - Finishing shares one completion path (`finish`), which runs at most
 *    once; nothing advances after it.
 *
 * Presentation: each beat remounts (`key={index}`) so every beat gets the
 * same short entrance — art fades/scales in and then drifts slowly for the
 * rest of its hold, text rises in just after it. A tint change fades the
 * new background in over the previous one (never through to the game
 * underneath). CSS transform/opacity only; `prefers-reduced-motion` falls
 * back to plain fades (styles.css).
 */
const TINT_CLASS: Record<StoryBeat["tint"], string> = {
  sFaded: "bg-[linear-gradient(180deg,#e8dcc8,#cdbfa2)]",
  sDecline: "bg-[linear-gradient(180deg,#8a7d68,#5c5346)]",
  sClean: "bg-[linear-gradient(180deg,var(--color-ivory),var(--color-cream))]",
  sThrive: "bg-[linear-gradient(180deg,#f3d98a,#c98f3a)]",
};

const CARD_LABEL: Record<StoryCardId, { name: string; tag: string }> = {
  board: { name: "Basic Cutting Board", tag: "BOUGHT" },
  knife: { name: "Basic Kitchen Knife", tag: "BOUGHT" },
  ing: { name: "Fresh Ingredients", tag: "FIRST BATCH" },
};

/** A tap this soon after a beat appears is ignored (the tail of the tap that advanced to it). */
const MIN_TAP_MS = 250;
/** How long a button beat's artwork keeps drifting (it has no hold of its own). */
const BUTTON_BEAT_DRIFT_MS = 6000;

export type StoryEndReason = "finished" | "skipped";

/** Staggered entrance for the n-th text element of a beat (ms). */
const delay = (n: number) => ({ animationDelay: `${90 + n * 90}ms` });

export function StoryOverlay({
  sequence,
  onDone,
}: {
  sequence: StoryBeat[];
  onDone: (reason: StoryEndReason) => void;
}) {
  const [index, setIndex] = useState(0);
  const [ended, setEnded] = useState(false);
  const beat = sequence[index];
  // Latched on the first completion (natural end OR skip) and never reset:
  // a late timer, a second skip tap or React StrictMode's double-invoked
  // effects can't call onDone twice.
  const doneRef = useRef(false);
  const beatShownAt = useRef(0);

  function finish(reason: StoryEndReason) {
    if (doneRef.current) return;
    doneRef.current = true;
    setEnded(true);
    onDone(reason);
  }

  /** Moves past beat `from` only if it is still the current beat. */
  function advanceFrom(from: number) {
    if (doneRef.current) return;
    setIndex((i) => (i === from ? i + 1 : i));
  }

  const paused = usePaused();

  useEffect(() => {
    beatShownAt.current = performance.now();
  }, [index]);

  // A button beat waits for its button; any other beat advances after its
  // hold of unpaused time.
  usePausableTimeout(
    () => advanceFrom(index),
    beat && !beat.btn ? (beat.hold ?? 3000) : null,
    index,
  );

  useEffect(() => {
    if (index >= sequence.length) finish("finished");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per sequence completion
  }, [index]);

  if (!beat || ended) return null;

  const prevTint = sequence[index - 1]?.tint ?? beat.tint;
  const lineCount = beat.lines?.length ?? 0;
  const driftMs = beat.btn ? BUTTON_BEAT_DRIFT_MS : (beat.hold ?? 3000);

  return (
    <div
      className={cn("absolute inset-0 z-50 overflow-hidden", paused && "kc-story-paused")}
      data-story-paused={paused ? "true" : undefined}
      onClick={() => {
        if (beat.btn || paused) return;
        if (performance.now() - beatShownAt.current < MIN_TAP_MS) return;
        advanceFrom(index);
      }}
    >
      {/* Background: the previous tint underneath, the current one fading in over it. */}
      <div className={cn("absolute inset-0", TINT_CLASS[prevTint])} />
      <div
        key={beat.tint}
        className={cn("kc-story-tint absolute inset-0", TINT_CLASS[beat.tint])}
      />

      <div
        key={index}
        className="relative flex h-full w-full flex-col items-center justify-center gap-5 px-6 pb-4 pt-16 text-center"
      >
        {beat.kicker ? (
          <p
            className="kc-story-text font-ui text-[13px] font-extrabold uppercase tracking-[0.16em] text-walnut-dark/80"
            style={delay(0)}
          >
            {beat.kicker}
          </p>
        ) : null}
        {beat.title ? (
          <p
            className="kc-story-text font-display text-[26px] font-black text-walnut-dark"
            style={delay(1)}
          >
            {beat.title}
          </p>
        ) : null}
        {beat.step ? (
          <p
            className="kc-story-text font-ui text-[15px] font-extrabold tracking-wide text-walnut-dark/70"
            style={delay(0)}
          >
            {beat.step}
          </p>
        ) : null}

        {beat.art ? (
          <div
            className={cn(
              "kc-story-art overflow-hidden rounded-[18px]",
              beat.veil ? "shadow-soft" : "",
              beat.artClass === "sProp" ? "w-[46%] max-w-[220px]" : "w-[86%] max-w-[420px]",
            )}
          >
            <div
              className="kc-story-push"
              style={{ animationDuration: `${driftMs}ms` }}
              dangerouslySetInnerHTML={{ __html: STORY_ART[beat.art] }}
            />
          </div>
        ) : null}

        {beat.dlg ? (
          <div
            className={cn(
              "kc-story-text flex w-full max-w-[420px] items-end gap-3",
              beat.dlg.side === "you" ? "flex-row-reverse text-right" : "text-left",
            )}
          >
            <div
              className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border border-walnut/15 shadow-soft"
              dangerouslySetInnerHTML={{ __html: STORY_ART[beat.dlg.art] }}
            />
            <Panel tone="cream" className="px-4 py-3">
              <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">
                {beat.dlg.who}
              </p>
              <p className="mt-1 font-hand text-[18px] text-walnut-dark">{beat.dlg.say}</p>
            </Panel>
          </div>
        ) : null}

        {lineCount ? (
          <div className="max-w-[420px] space-y-2">
            {beat.lines!.map((line, i) => (
              <p
                key={i}
                className="kc-story-text font-hand text-[19px] leading-snug text-walnut-dark"
                style={delay(i + 1)}
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {beat.quote ? (
          <p
            className="kc-story-text max-w-[380px] font-hand text-[22px] italic leading-snug text-walnut-dark/90"
            style={delay(lineCount + 1)}
          >
            {beat.quote}
          </p>
        ) : null}

        {beat.cards?.length ? (
          <div
            className="kc-story-text flex w-full max-w-[420px] justify-center gap-3"
            style={delay(lineCount + 1)}
          >
            {beat.cards.map((c) => (
              <Panel key={c} tone="cream" className="w-[30%] p-2 text-center">
                <div className="h-[46px] w-full">
                  {c === "ing" ? (
                    <IngredientCardCanvas />
                  ) : (
                    <div
                      className="h-full w-full"
                      dangerouslySetInnerHTML={{ __html: STORY_ART[c] }}
                    />
                  )}
                </div>
                <p className="mt-1 font-ui text-[10px] font-bold leading-tight text-walnut-dark">
                  {CARD_LABEL[c].name}
                </p>
                <p className="font-ui text-[9px] font-extrabold uppercase tracking-wide text-sage">
                  {CARD_LABEL[c].tag}
                </p>
              </Panel>
            ))}
          </div>
        ) : null}

        {beat.btn ? (
          <div className="kc-story-text" style={delay(lineCount + 2)}>
            <KButton size="lg" onClick={() => advanceFrom(index)}>
              {beat.btn}
            </KButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
