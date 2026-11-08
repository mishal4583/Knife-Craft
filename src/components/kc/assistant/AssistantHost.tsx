import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { ASSISTANT_NAME, type AssistantBeat } from "@/game/restaurant/assistant";
import { KButton } from "../common/primitives";
import { PaigePiece, PaigePoseImg, paigeUrl } from "./PaigeArt";
import "./assistant.css";

/**
 * PAIGE'S POPUP (developer 2026-11-07; the popup look and the dimmed, blurred background 2026-11-08; rules and beats:
 * game/restaurant/assistant.ts). A card like every instruction popup (her round portrait, her words, the buttons) over a dimmed and blurred
 * screen, with an optional glowing ring and arrow on a real button, which is left bright. It never shows over another card (`calm`), shows at most ONE beat per screen visit (`visit`), and the beat on screen is
 * LATCHED: saving "seen" can never swap it for another mid-sentence. Presentation only: the hire, the seen mark and "Take me there" are the
 * app's (`onHire`, `onSeen`, `onGo`).
 */
export type AssistantReplay = { beat: AssistantBeat; nonce: number };

type Rect = { x: number; y: number; w: number; h: number };

export function AssistantHost({
  candidate,
  visit,
  calm,
  replay,
  onHire,
  onSeen,
  onGo,
}: {
  /** The tip the rules offer now (assistantBeatFor), or null. */
  candidate: AssistantBeat | null;
  /** Changes when the player moves to another screen (a new visit may show one beat). */
  visit: string;
  /** Nothing else is on the screen (the app's calm moment). */
  calm: boolean;
  /** "Show again" from the notebook: shows that tip whatever the visit or calm. */
  replay: AssistantReplay | null;
  onHire: () => void;
  onSeen: (id: string) => void;
  onGo: (go: string) => void;
}) {
  const [active, setActive] = useState<{ beat: AssistantBeat; replay: boolean } | null>(null);
  const [line, setLine] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const shownIn = useRef<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The app's callbacks change every render; the timer below must not restart each time.
  const seenRef = useRef(onSeen);
  seenRef.current = onSeen;

  // A new screen visit closes what was open and allows one new beat.
  useEffect(() => {
    setActive(null);
    setLine(0);
    shownIn.current = null;
  }, [visit]);

  // The first calm moment of a visit takes the offered beat (once per visit, even if the player answers it at once).
  useEffect(() => {
    if (active || !calm || !candidate || shownIn.current === visit) return;
    shownIn.current = visit;
    setActive({ beat: candidate, replay: false });
    setLine(0);
    AudioManager.playSfx("sortPick");
  }, [active, calm, candidate, visit]);

  // "Show again" from the notebook.
  useEffect(() => {
    if (!replay) return;
    setActive({ beat: replay.beat, replay: true });
    setLine(0);
  }, [replay]);

  // A given tip counts as seen once it has been on screen for a moment (the introduction is seen when she is hired).
  const beatId = active?.beat.id ?? null;
  const counts = !!active && !active.replay && !active.beat.hire;
  useEffect(() => {
    if (!beatId || !counts || !calm) return;
    const t = window.setTimeout(() => seenRef.current(beatId), 900);
    return () => window.clearTimeout(t);
  }, [beatId, counts, calm]);

  // The ring follows the real button (resize, scroll, the screen's own scale).
  const target = active?.beat.target;
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const measure = () => {
      const host = hostRef.current;
      const el = document.querySelector(target);
      if (!host || !el) {
        setRect(null);
        return;
      }
      const h = host.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const s = host.offsetWidth > 0 ? h.width / host.offsetWidth : 1;
      const next = {
        x: Math.round((r.left - h.left) / s),
        y: Math.round((r.top - h.top) / s),
        w: Math.round(r.width / s),
        h: Math.round(r.height / s),
      };
      setRect((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
          ? prev
          : next,
      );
    };
    measure();
    const id = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [target]);

  if (!active || (!calm && !active.replay)) return null;
  const { beat } = active;
  const current = beat.lines[Math.min(line, beat.lines.length - 1)]!;
  const last = line >= beat.lines.length - 1;
  const tone = beat.tone ?? "normal";
  const close = () => {
    if (counts) onSeen(beat.id);
    setActive(null);
  };

  const actions = (
    <>
      {!last ? (
        <button
          type="button"
          data-testid="assistant-next"
          aria-label="Next"
          onClick={() => {
            AudioManager.playSfx("tap");
            setLine(line + 1);
          }}
          className="press grid h-12 w-12 place-items-center"
        >
          <PaigePiece name="chevron-large" className="h-11 w-11 object-contain" />
        </button>
      ) : beat.hire ? (
        <KButton
          variant="sage"
          className="min-h-12 flex-1"
          data-testid="assistant-hire"
          onClick={() => {
            onHire();
            setActive(null);
          }}
        >
          Hire {ASSISTANT_NAME} · Free
        </KButton>
      ) : (
        <>
          {beat.go ? (
            <KButton
              variant="copper"
              className="min-h-12 px-3"
              data-testid="assistant-go"
              onClick={() => {
                const to = beat.go!;
                close();
                onGo(to);
              }}
            >
              Take me there →
            </KButton>
          ) : null}
          <KButton
            variant={beat.go ? "ghost" : "sage"}
            className="min-h-12 px-4"
            data-testid="assistant-ok"
            onClick={close}
          >
            Got it
          </KButton>
        </>
      )}
    </>
  );

  const wide = rect ? rect.w / Math.max(1, rect.h) > 1.7 : false;
  const ringW = rect ? rect.w + (wide ? 30 : 40) : 0;
  const ringH = rect ? rect.h + (wide ? 22 : 40) : 0;
  // The card sits away from what she points at: a button in the lower half puts her at the top, otherwise at the bottom.
  const hostH = hostRef.current?.offsetHeight ?? 0;
  const cardTop = !!rect && hostH > 0 && rect.y + rect.h / 2 > hostH * 0.5;
  const dismiss = beat.hire ? undefined : close;

  return (
    <div
      ref={hostRef}
      data-testid="assistant-host"
      data-beat={beat.id}
      data-line={line}
      data-pose={current.pose}
      className="absolute inset-0 z-[70] overflow-hidden"
    >
      {/* The popup is the one thing on the screen (developer 2026-11-08): the background is dimmed and blurred; what she points at is
          left bright by a spotlight, so the ring and the button stay in view. Tapping the dark closes the tip. */}
      <div
        data-testid="assistant-scrim"
        onClick={dismiss}
        className={cn("absolute inset-0", rect ? "" : "bg-walnut-dark/55 backdrop-blur-[3px]")}
      />
      {rect ? (
        <>
          <div
            onClick={dismiss}
            className="absolute rounded-2xl shadow-[0_0_0_200vmax_rgba(36,20,10,0.6)]"
            style={{
              left: rect.x - 6,
              top: rect.y - 6,
              width: rect.w + 12,
              height: rect.h + 12,
            }}
          />
          <PaigePiece
            name={wide ? "ui-ring-rect" : "ui-ring-round"}
            className="paige-ring absolute"
            style={{
              left: rect.x + rect.w / 2 - ringW / 2,
              top: rect.y + rect.h / 2 - ringH / 2,
              width: ringW,
              height: ringH,
            }}
          />
          {rect.y > 90 ? (
            <PaigePiece
              name="ui-arrow-down"
              className="paige-point absolute h-9 w-auto"
              style={{ left: rect.x + rect.w / 2 - 15, top: rect.y - ringH / 2 - 34 }}
            />
          ) : null}
        </>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 flex justify-center p-3",
          rect
            ? cardTop
              ? "top-[max(56px,env(safe-area-inset-top))]"
              : "bottom-[88px]"
            : "inset-y-0 items-center",
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className="paige-in pointer-events-auto relative w-full max-w-[360px] rounded-[22px] border-2 bg-ivory p-3 shadow-lift data-[tone=success]:border-olive/60 data-[tone=warning]:border-tomato/60 data-[tone=normal]:border-copper/50"
          data-tone={tone}
          data-testid="assistant-bubble"
        >
          <div className="flex items-center gap-3">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-copper/40 bg-walnut/10">
              <PaigePoseImg
                pose={current.pose}
                className="h-full w-full object-cover object-[50%_12%]"
              />
              {current.pose === "cheer" || current.pose === "clap" ? (
                <PaigePiece
                  name="ui-sparkle"
                  className={cn("paige-sparkle absolute -right-1 -top-1 h-7 w-7")}
                />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-copper">
                {ASSISTANT_NAME} ·{" "}
                {tone === "success" ? "Well done" : tone === "warning" ? "Heads up" : "Tip"}
              </p>
              <p
                data-testid="assistant-text"
                className="mt-0.5 font-display text-[16px] font-extrabold leading-snug text-walnut-dark"
              >
                {current.text}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}
