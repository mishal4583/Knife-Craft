import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { AudioManager } from "@/game/AudioManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { StageSides } from "@/components/kc/common/StageSides";
import { TurnUprightCard } from "@/components/kc/common/TurnUprightCard";
import { useTurnUpright } from "@/components/kc/common/useTurnUpright";
import { dessertRunFor, ladderLevelFor } from "@/game/business/dessertRunContent";
import { DESSERTS, DESSERT_LADDER } from "@/game/business/dessertGallery";
import { dessertsOpenAt, levelOpeningDessert } from "@/game/business/miniGameLevels";
import { LevelPicker } from "./LevelPicker";
import { useUnlockText } from "@/components/kc/navLevel";
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
import { RUN_WIDE, drawRunWide, laneAtWide } from "./dessertRunWide";
import { artUrl, loadRunArt, type RunArt } from "./dessertRunArt";
import { PortraitOnly } from "@/components/kc/game/PortraitOnly";
import { useLandscape } from "@/components/kc/game/layoutMode";
import { landscapeGameArt } from "@/game/landscapeArt";

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
  /** The dessert picker (developer 2026-11-26): every dessert up to the player's own, or the farthest "Next dessert" reached in this visit, can be chosen. The round waits behind it. */
  const [picking, setPicking] = useState(false);
  const [reached, setReached] = useState(0);
  useEffect(() => {
    setReached((r) => Math.max(r, pick.ladderLevel));
  }, [pick]);
  const openUpTo = Math.max(dessertsOpenAt(level), reached);
  /** What opens a locked tile, in the game's own words (services in the restaurant game, developer 2026-10-30). */
  const unlock = useUnlockText();
  const chooseDessert = (ladder: number) => {
    setRound(ladder - ladderLevelFor(level));
    setAttempt((a) => a + 1);
    setPaused(false);
    setPicking(false);
  };
  /** "Try again" replays the same plate: only the attempt number changes. */
  const [attempt, setAttempt] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [paused, setPaused] = useState(false);
  /**
   * A wide window (a desktop, a tablet, a phone on its side) gets the LANDSCAPE board (developer 2026-11-20: `dessertRunWide.ts`, the same rules and levels, drawn
   * 960 x 540 with the Codex wide room behind it). Only an upright window keeps the 9:16 stage.
   */
  const wide = useLandscape();
  const stage = wide ? RUN_WIDE : STAGE;
  /** On a phone on its side the 9:16 stage is a thin strip: a card asks for the phone upright and the round waits behind it. The wide board needs no card. */
  const turn = useTurnUpright();
  const held = turn.held && !wide;
  const playAnyway = turn.playAnyway;
  const [phase, setPhase] = useState<Phase>("play");
  const [delivered, setDelivered] = useState(0);
  /** The round lives in a ref (the game loop owns it); this repaints the header when a new one is made. */
  const [, newRoundMade] = useReducer((n: number) => n + 1, 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RunState | null>(null);
  const viewRef = useRef({
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
    pausedRef.current = paused || held || picking;
  }, [speed, paused, held, picking]);

  useEffect(() => {
    const state = makeRun(pick.dessertId, pick.seed, pick.tier);
    stateRef.current = state;
    const view = viewRef.current;
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
    artRef.current = artRef.current ?? loadRunArt();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = stage.w * dpr;
    canvas.height = stage.h * dpr;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let shownPhase: Phase = "play";
    let shownDelivered = 0;
    // What the sounds follow (developer 2026-11-22): the simulation is never touched, the screen only notices what changed since the last frame.
    let heard = { cubes: -1, delivered: 0, served: 0 };
    // While paused or when the round is over nothing moves: repaint at about ten frames a second instead of every frame (it keeps the guests' bob).
    let lastDraw = -Infinity;
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
        if (!pausedRef.current) {
          let cubes = 0;
          for (let i = 0; i < state.grid.length; i++) if (state.grid[i]! >= 0) cubes++;
          const served = state.served.reduce((n, g) => n + g.length, 0);
          if (heard.cubes >= 0) {
            if (cubes < heard.cubes) AudioManager.playSfx("runPick");
            if (state.delivered > heard.delivered) AudioManager.playSfx("runDrop");
            if (served > heard.served) AudioManager.playSfx("runServe");
          }
          heard = { cubes, delivered: state.delivered, served };
        }
        if (state.phase !== shownPhase) {
          shownPhase = state.phase;
          setPhase(state.phase);
          if (state.phase === "won") AudioManager.playSfx("gameWin");
          else if (state.phase === "jam") AudioManager.playSfx("gameLose");
        }
        if (state.delivered !== shownDelivered) {
          shownDelivered = state.delivered;
          setDelivered(state.delivered);
        }
        if ((pausedRef.current || state.phase !== "play") && now - lastDraw < 100) {
          raf = requestAnimationFrame(loop);
          return;
        }
        lastDraw = now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const drawView: DrawView = {
          now,
          hoverLane: view.hoverLane,
          hintOn: view.hintOn,
          shake: view.shake,
          notice: view.notice,
          art: artRef.current,
        };
        (wide ? drawRunWide : drawRun)(ctx, state, drawView);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [wide, stage.w, stage.h]);

  const stagePoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current!;
      const box = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - box.left) / box.width) * stage.w,
        y: ((e.clientY - box.top) / box.height) * stage.h,
      };
    },
    [stage.w, stage.h],
  );

  const laneUnder = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const state = stateRef.current;
      if (!state) return null;
      const p = stagePoint(e);
      const lane = (wide ? laneAtWide : laneAt)(p.x, p.y, state.lanes.length);
      return lane !== null && state.lanes[lane]![0] ? lane : null;
    },
    [stagePoint, wide],
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
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state) return;
    const view = viewRef.current;
    const lane = laneUnder(e);
    view.hoverLane = lane;
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    const view = viewRef.current;
    const lane = laneUnder(e);
    if (state && view.pressedLane !== null && lane === view.pressedLane) {
      const result = tapLane(state, lane);
      if (result === "sent") {
        view.hintOn = false;
        AudioManager.playSfx("runSend");
      } else if (result === "full") {
        AudioManager.playSfx("sortWrong");
        view.shake.push({ lane, t: 0 });
        say("All five spots are busy");
      }
    }
    view.pressedLane = null;
    view.hoverLane = laneUnder(e);
  };
  const onCancel = () => {
    const view = viewRef.current;
    view.pressedLane = null;
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
      data-wide={wide || undefined}
    >
      {wide ? (
        // the Codex wide room covers the window (never a bar); the 16:9 board sits on it
        <img
          src={landscapeGameArt("dessert-run")}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-testid="dr-room"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <>
          <PortraitOnly art={landscapeGameArt("dessert-run")} />
          <StageSides src={artUrl("backdrop")} stage={STAGE} />
        </>
      )}
      <div
        className="relative mx-auto"
        style={{
          width: `min(100cqw, calc(100cqh * ${stage.w} / ${stage.h}))`,
          aspectRatio: `${stage.w} / ${stage.h}`,
        }}
      >
        {wide ? (
          // the room's counter, in the board's coordinates (the bottom 36 of 540) but as wide as the window: wood, with a light top edge
          <div
            aria-hidden="true"
            data-testid="dr-counter"
            className="pointer-events-none absolute bottom-0 h-[6.67%] bg-[linear-gradient(#c27a38,#a35f26_12%,#6e3c16)] shadow-[inset_0_2px_0_rgba(255,225,160,.55)]"
            style={{ left: "-100cqw", right: "-100cqw" }}
          />
        ) : null}
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
        <header
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-center pt-[max(6px,env(safe-area-inset-top))] ${wide ? "gap-3 px-[3%]" : "gap-2 px-2 max-[379px]:gap-1 max-[379px]:px-1"}`}
        >
          <button
            type="button"
            onClick={onExit}
            aria-label="Back"
            data-testid="dr-back"
            className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] text-xl font-black shadow-md"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-label={`Dessert ${pick.ladderLevel} of 50. Choose a dessert`}
            data-testid="dr-choose"
            className={`pointer-events-auto flex min-h-12 min-w-0 items-center gap-1 border border-[#d7a95c] bg-[#fff8e8] text-left shadow-md ${wide ? "w-[40%] max-w-[420px] flex-none rounded-full px-5 py-1" : "flex-1 rounded-2xl px-3 py-1 max-[379px]:px-2"}`}
          >
            <span className="block min-w-0 flex-1">
              {/* a narrow phone has room for the dessert's name and the count only (a bug found 2026-11-26: the label wrapped to three lines over the plate and the name and count were cut off) */}
              <p className="truncate text-[11px] font-black uppercase tracking-[.16em] text-[#a56a31] max-[399px]:tracking-[.06em] max-[359px]:hidden">
                🍰 Dessert Run
              </p>
              {/* the count goes to its own line when it does not fit beside the name: neither is ever cut off */}
              <p
                className="flex flex-wrap items-baseline gap-x-2 text-sm font-extrabold leading-tight max-[379px]:text-[13px]"
                data-testid="dr-name"
              >
                <span
                  className="min-w-0 max-w-full truncate max-[359px]:whitespace-normal max-[359px]:text-[12px]"
                  data-testid="dr-dessert"
                >
                  {state?.dessert.short}
                </span>
                <span
                  className="shrink-0 text-[12px] font-bold text-[#a56a31]"
                  data-testid="dr-count"
                >
                  {delivered}/{total}
                </span>
              </p>
            </span>
            <span aria-hidden="true" className="shrink-0 text-base font-black text-[#a56a31]">
              ▾
            </span>
          </button>
          {/* the mock-up's header: back and the name on the left, speed, tip and pause on the right */}
          {wide ? <span aria-hidden="true" className="min-w-0 flex-1" /> : null}
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
              when you open the way. Tap the dessert's name to choose another. When all five spots
              wait, the kitchen is jammed. Hold a waiter to see the cubes it can reach. Fewer
              waiters waiting at once earns more stars.
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
                  className="mx-auto h-32 w-auto [@media(max-height:480px)]:h-20"
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    data-testid="dr-levels"
                    className="min-h-12 rounded-2xl border border-[#cfb58a] p-2 font-bold"
                  >
                    All desserts
                  </button>
                  <button
                    type="button"
                    onClick={onExit}
                    data-testid="dr-leave"
                    className="min-h-12 rounded-2xl border border-[#cfb58a] p-2 font-bold"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {picking ? (
        <LevelPicker
          testId="dr-picker"
          title="Choose a dessert"
          line={openUpTo >= 50 ? "All 50 open" : `${openUpTo} of 50 open · more open as you serve`}
          tiles={DESSERT_LADDER.map((id, i) => {
            const ladder = i + 1;
            const open = ladder <= openUpTo;
            return {
              id: ladder,
              open,
              current: ladder === pick.ladderLevel,
              title: `${ladder}. ${open ? DESSERTS[id].short : "Locked"}`,
              sub: open ? undefined : unlock.when(levelOpeningDessert(ladder)),
              picture: `${import.meta.env.BASE_URL}${DESSERTS[id].art}`,
            };
          })}
          onPick={chooseDessert}
          onClose={() => setPicking(false)}
        />
      ) : null}
      {held ? (
        <TurnUprightCard
          game="Dessert Run"
          testId="dr-upright"
          onPlayAnyway={playAnyway}
          onLeave={onExit}
        />
      ) : null}
    </main>
  );
}
