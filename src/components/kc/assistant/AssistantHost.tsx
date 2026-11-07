import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { ASSISTANT_NAME, type AssistantBeat } from "@/game/restaurant/assistant";
import { KButton } from "../common/primitives";
import { PaigePiece, PaigePoseImg, paigeUrl } from "./PaigeArt";
import "./assistant.css";

/**
 * PAIGE'S BUBBLE (developer 2026-11-07; rules and beats: game/restaurant/assistant.ts). A half-body Paige bottom-left, a painted speech
 * bubble above her, an optional glowing ring and arrow on a real button. It never covers the screen (no scrim: the player can ignore her
 * and tap anything), never shows over another card (`calm`), shows at most ONE beat per screen visit (`visit`), and the beat on screen is
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

  const wide = rect ? rect.w / Math.max(1, rect.h) > 1.7 : false;
  const ringW = rect ? rect.w + (wide ? 30 : 40) : 0;
  const ringH = rect ? rect.h + (wide ? 22 : 40) : 0;

  return (
    <div
      ref={hostRef}
      data-testid="assistant-host"
      data-beat={beat.id}
      data-line={line}
      data-pose={current.pose}
      className="pointer-events-none absolute inset-0 z-[45] overflow-hidden"
    >
      {rect ? (
        <>
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
        className="paige-in absolute bottom-[72px] left-2 flex max-w-[calc(100%-16px)] flex-col items-start land:bottom-3 land:left-[calc(var(--kc-rail)+8px)]"
        role="status"
        aria-live="polite"
      >
        <div
          className="paige-bubble pointer-events-auto relative w-[300px] max-w-full"
          data-tone={tone}
          data-testid="assistant-bubble"
          style={{ borderImageSource: `url(${paigeUrl(`bubble-${tone}`)})` }}
        >
          <PaigePiece
            name="ribbon"
            className="absolute -left-1 -top-5 h-[34px] w-auto"
            style={{ zIndex: 1 }}
          />
          <span className="absolute -top-[15px] left-[14px] z-[2] font-display text-[13px] font-black leading-none text-ivory drop-shadow">
            {ASSISTANT_NAME}
          </span>
          <p
            data-testid="assistant-text"
            className="px-0.5 pb-1 pt-0.5 font-hand text-[17px] leading-snug text-walnut-dark"
          >
            {current.text}
          </p>
          <div className="mt-1 flex items-center justify-end gap-2">
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
                  variant="ghost"
                  className="min-h-12 px-3"
                  data-testid="assistant-ok"
                  onClick={close}
                >
                  Got it
                </KButton>
              </>
            )}
          </div>
        </div>
        <div className="relative -mt-2 ml-1">
          <PaigePoseImg pose={current.pose} className="h-[clamp(120px,23vh,200px)] w-auto" />
          {current.pose === "cheer" || current.pose === "clap" ? (
            <PaigePiece
              name="ui-sparkle"
              className={cn("paige-sparkle absolute -right-3 top-2 h-8 w-8")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
