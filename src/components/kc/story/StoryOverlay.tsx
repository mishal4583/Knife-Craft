import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { KButton, Panel } from "@/components/kc/common/primitives";
import { STORY_ART } from "@/game/story/storyArt";
import type { StoryBeat, StoryCardId } from "@/game/story/storyDefinitions";
import { IngredientCardCanvas } from "./IngredientCardCanvas";

/**
 * STORY_OVERLAY — plays one sequence of story beats (OPENING+FRESH+CHEF
 * for the intro, or FINALE), adapted from knifecraft.html's own
 * `render(b)`/`advance()`/`run(list,done)`/`finish()` (`:11076-11138`)
 * into React state/effects instead of imperative DOM string-building —
 * "adapt the behavior to the existing production architecture," per
 * this repo's own story-integration convention, not a port of the
 * standalone HTML sequencer itself. Beat DATA (copy, hold times, tint,
 * art, cards, dialogue) is ported verbatim in storyDefinitions.ts;
 * this component only supplies the sequencing/rendering.
 *
 * A beat with no `btn` auto-advances after `hold` ms (default 3000, a
 * reasonable floor for a beat that forgot to set one); a beat WITH
 * `btn` waits for a tap on that button. Tapping anywhere else on a
 * `bare` (chrome-hidden) beat also advances early — the source's own
 * `el('story').addEventListener('click', ...)` convenience — except
 * when the tap lands on the button itself (its own handler advances).
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

export function StoryOverlay({ sequence, onDone }: { sequence: StoryBeat[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const beat = sequence[index];
  // Guards against React StrictMode's development-only double-invocation
  // of effects: without it, the completion effect below would call
  // `onDone` twice for the same sequence (mount → synthetic cleanup →
  // mount again, and this effect has no timer/subscription to make that
  // second call a no-op the way the auto-advance effect's own
  // `clearTimeout` cleanup does). A ref survives that double-invoke
  // (it's the same component instance, not a real remount), so it stays
  // a reliable "already fired" latch across it.
  const doneRef = useRef(false);

  useEffect(() => {
    if (!beat) return;
    if (beat.btn) return; // waits for the button's own click instead
    const t = setTimeout(() => setIndex((i) => i + 1), beat.hold ?? 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when the beat itself changes
  }, [index]);

  useEffect(() => {
    if (index >= sequence.length && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per sequence completion
  }, [index]);

  if (!beat) return null;

  const advance = () => setIndex((i) => i + 1);

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center",
        TINT_CLASS[beat.tint],
      )}
      onClick={() => {
        if (!beat.btn) advance();
      }}
    >
      {beat.kicker ? (
        <p className="anim-pop font-ui text-[13px] font-extrabold uppercase tracking-[0.16em] text-walnut-dark/80">
          {beat.kicker}
        </p>
      ) : null}
      {beat.title ? (
        <p className="anim-pop font-display text-[26px] font-black text-walnut-dark">
          {beat.title}
        </p>
      ) : null}
      {beat.step ? (
        <p className="anim-pop font-ui text-[15px] font-extrabold tracking-wide text-walnut-dark/70">
          {beat.step}
        </p>
      ) : null}

      {beat.art ? (
        <div
          className={cn(
            "anim-pop overflow-hidden rounded-[18px]",
            beat.veil ? "shadow-soft" : "",
            beat.artClass === "sProp" ? "w-[46%] max-w-[220px]" : "w-[86%] max-w-[420px]",
          )}
          dangerouslySetInnerHTML={{ __html: STORY_ART[beat.art] }}
        />
      ) : null}

      {beat.dlg ? (
        <div
          className={cn(
            "anim-pop flex w-full max-w-[420px] items-end gap-3",
            beat.dlg.side === "you" ? "flex-row-reverse text-right" : "text-left",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border border-walnut/15 shadow-soft"
            dangerouslySetInnerHTML={{ __html: STORY_ART[beat.dlg.art] }}
          />
          <Panel tone="cream" className="anim-pop px-4 py-3">
            <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">
              {beat.dlg.who}
            </p>
            <p className="mt-1 font-hand text-[18px] text-walnut-dark">{beat.dlg.say}</p>
          </Panel>
        </div>
      ) : null}

      {beat.lines?.length ? (
        <div className="max-w-[420px] space-y-2">
          {beat.lines.map((line, i) => (
            <p key={i} className="anim-pop font-hand text-[19px] leading-snug text-walnut-dark">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {beat.quote ? (
        <p className="anim-pop max-w-[380px] font-hand text-[22px] italic leading-snug text-walnut-dark/90">
          {beat.quote}
        </p>
      ) : null}

      {beat.cards?.length ? (
        <div className="anim-pop flex w-full max-w-[420px] justify-center gap-3">
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
        <div onClick={(e) => e.stopPropagation()}>
          <KButton size="lg" onClick={advance}>
            {beat.btn}
          </KButton>
        </div>
      ) : null}
    </div>
  );
}
