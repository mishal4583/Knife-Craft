import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { dessertRunFor } from "@/game/business/dessertRunContent";
import {
  STAGE,
  STEP,
  makeRun,
  starsForPeakWaiting,
  stepRun,
  tapLane,
  type RunState,
} from "@/game/business/dessertRun";
import { drawRun, laneAt, type DrawView } from "./dessertRunDraw";
import { artUrl, loadRunArt, type RunArt } from "./dessertRunArt";

const SPEEDS = [1, 2, 4] as const;
const NOTICE_MS = 1400;
const SHAKE_S = 0.4;

type Phase = "play" | "won" | "jam";

/**
 * Dessert Run (developer 2026-11-16, replaces the Plating Belt). Preview only, at /?dessertRun=<level>, until
 * the developer has played it on a real phone. All the rules live in `game/business/dessertRun.ts`; this
 * screen draws the stage, reads the finger and runs the game on its fixed step.
 */
export function DessertRunGame({
  save,
  level,
  onExit,
}: {
  save: SaveData;
  level: number;
  onExit: () => void;
}) {
  const day = save.business.calendar.businessDay;
  const [round, setRound] = useState(0);
  const pick = useMemo(() => dessertRunFor(level, day, round), [level, day, round]);
  /** "Try again" replays the same plate: only the attempt number changes. */
  const [attempt, setAttempt] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("play");
  const [delivered, setDelivered] = useState(0);
  /** The round lives in a ref (the game loop owns it); this repaints the header when a new one is made. */
  const [, newRoundMade] = useReducer((n: number) => n + 1, 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RunState | null>(null);
  const viewRef = useRef({
    peek: null as number | null,
    hoverLane: null as number | null,
    pressedLane: null as number | null,
    hintOn: true,
    shake: [] as Array<{ lane: number; t: number }>,
    notice: "",
    noticeUntil: 0,
  });
  const artRef = useRef<RunArt | null>(null);
  const speedRef = useRef<number>(speed);
  const pausedRef = useRef(false);
  useEffect(() => {
    speedRef.current = speed;
    pausedRef.current = paused;
  }, [speed, paused]);

  useEffect(() => {
    const state = makeRun(pick.dessertId, pick.seed, pick.tier);
    stateRef.current = state;
    const view = viewRef.current;
    view.peek = null;
    view.hoverLane = null;
    view.pressedLane = null;
    view.hintOn = true;
    view.shake = [];
    view.notice = "";
    setPhase("play");
    setDelivered(0);
    setPaused(false);
    newRoundMade();
  }, [pick, attempt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    artRef.current = loadRunArt();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = STAGE.w * dpr;
    canvas.height = STAGE.h * dpr;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let shownPhase: Phase = "play";
    let shownDelivered = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const state = stateRef.current;
      if (state) {
        const view = viewRef.current;
        if (!pausedRef.current) {
          acc += dt * speedRef.current;
          while (acc >= STEP) {
            acc -= STEP;
            // The fixed step the QA replays: x2 and x4 only run it more often.
            stepRun(state, STEP, 1);
          }
          for (const s of view.shake) s.t += dt;
          view.shake = view.shake.filter((s) => s.t < SHAKE_S);
        }
        if (view.notice && now > view.noticeUntil) view.notice = "";
        if (state.phase !== shownPhase) {
          shownPhase = state.phase;
          setPhase(state.phase);
        }
        if (state.delivered !== shownDelivered) {
          shownDelivered = state.delivered;
          setDelivered(state.delivered);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const drawView: DrawView = {
          now,
          peek: view.peek,
          hoverLane: view.hoverLane,
          hintOn: view.hintOn,
          shake: view.shake,
          notice: view.notice,
          art: artRef.current,
        };
        drawRun(ctx, state, drawView);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stagePoint = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * STAGE.w,
      y: ((e.clientY - box.top) / box.height) * STAGE.h,
    };
  }, []);

  const laneUnder = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const state = stateRef.current;
      if (!state) return null;
      const p = stagePoint(e);
      const lane = laneAt(p.x, p.y, state.lanes.length);
      return lane !== null && state.lanes[lane]![0] ? lane : null;
    },
    [stagePoint],
  );

  const say = (text: string) => {
    const view = viewRef.current;
    view.notice = text;
    view.noticeUntil = performance.now() + NOTICE_MS;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state || state.phase !== "play" || pausedRef.current) return;
    const lane = laneUnder(e);
    const view = viewRef.current;
    view.pressedLane = lane;
    view.hoverLane = lane;
    view.peek = lane === null ? null : state.lanes[lane]![0]!.k;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state) return;
    const view = viewRef.current;
    const lane = laneUnder(e);
    view.hoverLane = lane;
    if (view.pressedLane === null) view.peek = lane === null ? null : state.lanes[lane]![0]!.k;
    else view.peek = lane === view.pressedLane ? state.lanes[lane]![0]!.k : null;
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    const view = viewRef.current;
    const lane = laneUnder(e);
    if (state && view.pressedLane !== null && lane === view.pressedLane) {
      const result = tapLane(state, lane);
      if (result === "sent") view.hintOn = false;
      else if (result === "full") {
        view.shake.push({ lane, t: 0 });
        say("All five spots are busy");
      }
    }
    view.pressedLane = null;
    view.peek = null;
    view.hoverLane = laneUnder(e);
  };
  const onCancel = () => {
    const view = viewRef.current;
    view.pressedLane = null;
    view.peek = null;
    view.hoverLane = null;
  };

  const state = stateRef.current;
  const stars = state ? starsForPeakWaiting(state.peakWaiting) : 3;
  const total = state?.total ?? 0;

  return (
    <main
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#3a2415] text-[#492b19] [container-type:size]"
      data-testid="dessert-run-game"
      data-tier={pick.tier.id}
      data-dessert={pick.dessertId}
      data-phase={phase}
    >
      <div
        className="relative mx-auto"
        style={{
          width: `min(100cqw, calc(100cqh * ${STAGE.w} / ${STAGE.h}))`,
          aspectRatio: `${STAGE.w} / ${STAGE.h}`,
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="dr-canvas"
          aria-label="Dessert Run: waiters fetch cubes of a dessert for four guests"
          className="block h-full w-full touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          onPointerLeave={() => {
            if (viewRef.current.pressedLane === null) onCancel();
          }}
        />
        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-2 pt-[max(6px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onExit}
            aria-label="Back"
            data-testid="dr-back"
            className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] text-xl font-black shadow-md"
          >
            ←
          </button>
          <div className="min-w-0 flex-1 rounded-2xl border border-[#d7a95c] bg-[#fff8e8] px-3 py-1 shadow-md">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#a56a31]">
              🍰 Dessert Run
            </p>
            <p className="truncate text-sm font-extrabold" data-testid="dr-name">
              {state?.dessert.short}
              <span className="ml-2 text-[12px] font-bold text-[#a56a31]" data-testid="dr-count">
                {delivered}/{total}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}
            aria-label={`Speed ${speed} times. Tap to change`}
            data-testid="dr-speed"
            className="pointer-events-auto grid h-12 min-w-12 shrink-0 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] px-2 text-sm font-black shadow-md"
          >
            ×{speed}
          </button>
          <span className="pointer-events-auto shrink-0">
            <InfoTip label="How to play">
              Tap a waiter at the front of a lane. It goes to a free standby spot and fetches the
              cubes of its colour from the outside of the dessert, one at a time. A runner takes
              each one to a guest. A waiter with nothing it can reach waits, and goes on by itself
              when you open the way. When all five spots wait, the kitchen is jammed. Hold a waiter
              to see the cubes it can reach. Fewer waiters waiting at once earns more stars.
            </InfoTip>
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume" : "Pause"}
            data-testid="dr-pause"
            className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] text-xl font-black shadow-md"
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
        </header>

        {phase !== "play" || paused ? (
          <div
            className="absolute inset-0 z-20 grid place-items-center bg-[#321d13]/60 p-5"
            data-testid="dr-overlay"
            data-phase={paused && phase === "play" ? "paused" : phase}
          >
            <div className="w-full max-w-sm rounded-[28px] border-2 border-[#e6c579] bg-[#fff4dc] p-5 text-center shadow-2xl">
              {phase === "play" ? (
                <p className="text-3xl" aria-hidden="true">
                  ⏸️
                </p>
              ) : (
                <img
                  src={artUrl(phase === "won" ? "win" : "jam")}
                  alt=""
                  aria-hidden="true"
                  data-testid="dr-picture"
                  className="mx-auto h-32 w-auto"
                />
              )}
              <h2 className="mt-2 text-2xl font-black">
                {phase === "won"
                  ? "Dessert served!"
                  : phase === "jam"
                    ? "The kitchen is jammed"
                    : "Paused"}
              </h2>
              {phase === "won" ? (
                <p className="mt-2 text-sm font-bold" data-testid="dr-result">
                  <span aria-label={`${stars} stars`}>{"⭐".repeat(stars)}</span>
                  <br />
                  {state?.peakWaiting ?? 0} waiting at once
                </p>
              ) : phase === "jam" ? (
                <p className="mt-2 text-sm">Every spot is waiting. Same plate, one tap away.</p>
              ) : null}
              <div className="mt-4 grid gap-2">
                {phase === "play" ? (
                  <button
                    type="button"
                    onClick={() => setPaused(false)}
                    data-testid="dr-resume"
                    className="min-h-12 rounded-2xl bg-[#557b47] p-3 font-bold text-white"
                  >
                    Resume
                  </button>
                ) : null}
                {phase === "won" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRound((r) => r + 1);
                      setAttempt(0);
                    }}
                    data-testid="dr-next"
                    className="min-h-12 rounded-2xl bg-[#557b47] p-3 font-bold text-white"
                  >
                    Next dessert
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAttempt((a) => a + 1)}
                  data-testid="dr-restart"
                  className={`min-h-12 rounded-2xl p-3 font-bold ${phase === "jam" ? "bg-[#557b47] text-white" : "border border-[#cfb58a]"}`}
                >
                  {phase === "jam" ? "Try again" : phase === "won" ? "Play it again" : "Restart"}
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  data-testid="dr-leave"
                  className="min-h-12 rounded-2xl border border-[#cfb58a] p-3 font-bold"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
