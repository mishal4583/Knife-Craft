import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { SaveData } from "@/game/SaveManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import {
  addTime,
  crateStars,
  cratesLeft,
  hintCrate,
  roundCleared,
  startRound,
  tapCrate,
  undoRound,
  spendHint,
  type CrateRound,
} from "@/game/business/crateDispatch";
import {
  KD_STAGE,
  crateAt,
  drawKitchenDispatch,
  type KdView,
  type Leaving,
} from "./kitchenDispatchDraw";
import { kdUrl, loadKdArt, type KdArt } from "./kitchenDispatchArt";

type Phase = "play" | "won" | "lost";
const HINT_MS = 3200;
const NOTICE_MS = 1500;
const WIN_DELAY_MS = 650;

/** A box in stage units (540 x 960), placed as percentages so it scales with the stage. */
const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
  position: "absolute",
  left: `${(x / KD_STAGE.w) * 100}%`,
  top: `${(y / KD_STAGE.h) * 100}%`,
  width: `${(w / KD_STAGE.w) * 100}%`,
  height: `${(h / KD_STAGE.h) * 100}%`,
});
/** A font size in stage units, scaled with the stage's width. */
const fs = (px: number): CSSProperties => ({ fontSize: `${(px / KD_STAGE.w) * 100}cqw` });
/** A touch target never smaller than 48 px, whatever the stage's scale. */
const TOUCH: CSSProperties = { minWidth: 48, minHeight: 48 };
const img = (name: string) => `url(${kdUrl(name)})`;

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Kitchen Dispatch (developer 2026-11-17, replaces nothing: a preview at /?kitchenDispatch=<level>, not in the daily
 * routine, no rewards, ads or analytics until the developer has played it on a real phone). All the rules live in
 * `game/business/crateDispatch.ts`; this screen draws the board, reads the finger and counts the seconds.
 */
export function KitchenDispatchGame({
  save,
  level,
  onExit,
}: {
  save: SaveData;
  level: number;
  onExit: () => void;
}) {
  const day = save.business.calendar.businessDay;
  /** "Next dispatch" moves to the next board; "Try again" replays the same one. */
  const [boardNo, setBoardNo] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const seed = level * 1000003 + day * 9176 + boardNo;
  const initial = useMemo(() => startRound(level, seed), [level, seed]);
  const [round, setRound] = useState<CrateRound>(initial);
  const [phase, setPhase] = useState<Phase>("play");
  const [paused, setPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initial.seconds);
  const [notice, setNotice] = useState("");
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<KdArt | null>(null);
  const roundRef = useRef(round);
  const phaseRef = useRef<Phase>("play");
  const pausedRef = useRef(false);
  const timeRef = useRef(initial.seconds);
  const leavingRef = useRef<Leaving[]>([]);
  const shakeRef = useRef<KdView["shake"]>(null);
  const hintRef = useRef<KdView["hint"]>(null);
  const timers = useRef<number[]>([]);

  const setRoundBoth = useCallback((next: CrateRound) => {
    roundRef.current = next;
    setRound(next);
  }, []);
  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const say = useCallback((text: string) => {
    setNotice(text);
    timers.current.push(window.setTimeout(() => setNotice(""), NOTICE_MS));
  }, []);

  // a new board, or the same one again
  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    leavingRef.current = [];
    shakeRef.current = null;
    hintRef.current = null;
    pausedRef.current = false;
    timeRef.current = initial.seconds;
    setRoundBoth(initial);
    setSecondsLeft(initial.seconds);
    setPaused(false);
    setNotice("");
    setPhaseBoth("play");
    repaint();
  }, [initial, attempt, setRoundBoth, setPhaseBoth]);
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // the draw loop and the clock
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    artRef.current = loadKdArt();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = KD_STAGE.w * dpr;
    canvas.height = KD_STAGE.h * dpr;
    let raf = 0;
    let last = performance.now();
    let shownSecond = -1;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (
        phaseRef.current === "play" &&
        !pausedRef.current &&
        roundRef.current.board.vehicles.length > 0
      ) {
        timeRef.current -= dt;
        if (timeRef.current <= 0) {
          timeRef.current = 0;
          phaseRef.current = "lost";
          setPhase("lost");
        }
      }
      const whole = Math.ceil(timeRef.current);
      if (whole !== shownSecond) {
        shownSecond = whole;
        setSecondsLeft(timeRef.current);
      }
      leavingRef.current = leavingRef.current.filter((l) => now - l.start < 1100);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawKitchenDispatch(ctx, roundRef.current.board, {
        now,
        art: artRef.current,
        leaving: leavingRef.current,
        shake: shakeRef.current,
        hint: hintRef.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "play" || pausedRef.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * KD_STAGE.w;
    const y = ((e.clientY - box.top) / box.height) * KD_STAGE.h;
    const crate = crateAt(roundRef.current.board, x, y);
    if (!crate) return;
    const res = tapCrate(roundRef.current, crate.id);
    const now = performance.now();
    if (res.kind === "blocked") {
      shakeRef.current = { id: crate.id, start: now };
      setRoundBoth(res.round);
      say("Something is in the way");
    } else if (res.kind === "out") {
      leavingRef.current = [...leavingRef.current, { crate: res.crate, start: now }];
      if (hintRef.current?.id === crate.id) hintRef.current = null;
      setRoundBoth(res.round);
      if (roundCleared(res.round))
        timers.current.push(
          window.setTimeout(() => {
            if (phaseRef.current === "play") setPhaseBoth("won");
          }, WIN_DELAY_MS),
        );
    }
  };

  const playing = phase === "play" && !paused;
  const onHint = () => {
    if (!playing || roundRef.current.hints <= 0) return;
    const id = hintCrate(roundRef.current);
    if (!id) return;
    hintRef.current = { id, until: performance.now() + HINT_MS };
    setRoundBoth(spendHint(roundRef.current));
  };
  const onTime = () => {
    if (!playing || roundRef.current.extras <= 0) return;
    const next = addTime(roundRef.current);
    timeRef.current += next.seconds - roundRef.current.seconds;
    setRoundBoth(next);
    setSecondsLeft(timeRef.current);
    say("20 seconds added");
  };
  const onUndo = () => {
    if (!playing || roundRef.current.undos <= 0 || roundRef.current.gone.length === 0) return;
    const back = roundRef.current.gone[roundRef.current.gone.length - 1]!;
    leavingRef.current = leavingRef.current.filter((l) => l.crate.id !== back.id);
    setRoundBoth(undoRound(roundRef.current));
  };

  const stars = crateStars(round.blocked);
  const budget = Math.max(1, round.seconds);
  const frac = Math.max(0, Math.min(1, secondsLeft / budget));
  const low = secondsLeft <= 15;
  const roundBtn: CSSProperties = {
    backgroundImage: img("round-button"),
    backgroundSize: "100% 100%",
  };
  const boosters: Array<{
    key: "hint" | "time" | "undo";
    label: string;
    n: number;
    cell: number;
    on: () => void;
    off: boolean;
  }> = [
    { key: "hint", label: "Hint", n: round.hints, cell: 0, on: onHint, off: round.hints <= 0 },
    { key: "time", label: "Time", n: round.extras, cell: 1, on: onTime, off: round.extras <= 0 },
    {
      key: "undo",
      label: "Undo",
      n: round.undos,
      cell: 2,
      on: onUndo,
      off: round.undos <= 0 || round.gone.length === 0,
    },
  ];

  return (
    <main
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#2b1a10] text-[#492b19] [container-type:size]"
      data-testid="kitchen-dispatch-game"
      data-phase={phase}
      data-crates={cratesLeft(round)}
      data-blocked={round.blocked}
    >
      <div
        className="relative select-none [container-type:inline-size]"
        style={{
          width: `min(100cqw, calc(100cqh * ${KD_STAGE.w} / ${KD_STAGE.h}))`,
          aspectRatio: `${KD_STAGE.w} / ${KD_STAGE.h}`,
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="kd-canvas"
          aria-label="Kitchen Dispatch: crates on a counter, each with an arrow"
          className="block h-full w-full touch-none"
          onPointerUp={onTap}
        />

        {/* the top bar */}
        <button
          type="button"
          onClick={onExit}
          aria-label="Back"
          data-testid="kd-back"
          className="pointer-events-auto grid place-items-center font-black text-white"
          style={{ ...box(8, 8, 64, 64), ...TOUCH, ...roundBtn, ...fs(26) }}
        >
          ←
        </button>
        <div
          className="grid place-items-center font-black text-white"
          style={{
            ...box(72, 6, 86, 72),
            backgroundImage: img("level-badge"),
            backgroundSize: "100% 100%",
            ...fs(28),
          }}
          data-testid="kd-level"
        >
          <span className="drop-shadow-[0_2px_0_rgba(0,0,0,.4)]">{level}</span>
        </div>
        <div
          className="grid place-items-center text-center font-black text-[#fff4d9]"
          style={{
            ...box(166, 4, 262, 98),
            backgroundImage: img("title-sign"),
            backgroundSize: "100% 100%",
            ...fs(21),
          }}
        >
          <span className="mt-[6%] drop-shadow-[0_2px_0_rgba(0,0,0,.45)]">Kitchen Dispatch</span>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Resume" : "Pause"}
          data-testid="kd-pause"
          className="grid place-items-center font-black text-white"
          style={{ ...box(468, 8, 64, 64), ...TOUCH, ...roundBtn, ...fs(24) }}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>

        {/* the instruction and its tip */}
        <div
          className="grid place-items-center px-[7%] text-center font-extrabold leading-tight text-[#5a3419]"
          style={{
            ...box(92, 106, 356, 86),
            backgroundImage: img("info-banner"),
            backgroundSize: "100% 100%",
            ...fs(16.5),
          }}
        >
          <span>Clear every crate before the timer runs out.</span>
        </div>
        <span className="grid place-items-center" style={box(452, 124, 50, 50)}>
          <InfoTip label="How to play">
            Tap a crate and it slides the way its arrow points, out through its gate, when nothing
            is in the way. A crate that is blocked shakes. Clear every crate before the timer ends.
            Hint lights a crate that can go. Time adds 20 seconds. Undo puts the last crate back.
            Fewer blocked taps earn more stars.
          </InfoTip>
        </span>

        {/* the timer, the crates and the stars */}
        <div
          style={{
            ...box(22, 202, 252, 84),
            backgroundImage: img("timer-pill"),
            backgroundSize: "100% 100%",
          }}
          data-testid="kd-timer"
          role="timer"
          aria-label={`${clock(secondsLeft)} left`}
        >
          <div
            className="absolute overflow-hidden rounded-full"
            style={{ left: "30%", top: "33%", width: "62%", height: "34%" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${frac * 100}%`,
                background: low
                  ? "linear-gradient(#ff7a5a,#d6402a)"
                  : "linear-gradient(#8de06a,#3fa43a)",
                transition: "width .25s linear",
              }}
            />
          </div>
          <span
            className="absolute inset-0 grid place-items-center font-black text-white"
            style={{ left: "28%", ...fs(19) }}
            data-testid="kd-time"
          >
            <span className="drop-shadow-[0_2px_0_rgba(0,0,0,.55)]">{clock(secondsLeft)}</span>
          </span>
        </div>
        <div
          className="grid place-items-center font-black text-[#5a3419]"
          style={{
            ...box(284, 210, 156, 52),
            backgroundImage: img("label-plate"),
            backgroundSize: "100% 100%",
            ...fs(18),
          }}
          data-testid="kd-left"
        >
          <span>
            Crates <span className="text-[#c0412a]">{cratesLeft(round)}</span>
          </span>
        </div>
        <div
          style={box(436, 206, 88, 30)}
          aria-label={`${stars} stars`}
          role="img"
          data-testid="kd-stars"
        >
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${(((i - 1) * 30) / 88) * 100}%`,
                width: `${(28 / 88) * 100}%`,
                height: "100%",
                backgroundImage: img("stars"),
                backgroundSize: "200% 100%",
                backgroundPosition: i <= stars ? "0 50%" : "100% 50%",
                backgroundRepeat: "no-repeat",
              }}
            />
          ))}
        </div>

        {/* a short notice over the board */}
        <p
          role="status"
          data-testid="kd-notice"
          className="pointer-events-none grid place-items-center rounded-full bg-[#2b1a10]/85 font-extrabold text-[#fff4d9]"
          style={{
            ...box(130, 736, 280, 30),
            ...fs(14.5),
            opacity: notice ? 1 : 0,
            transition: "opacity .2s",
          }}
        >
          {notice}
        </p>

        {/* the boosters on the counter */}
        {boosters.map((b, i) => {
          const cx = 135 + i * 135;
          return (
            <div key={b.key}>
              <button
                type="button"
                onClick={b.on}
                disabled={b.off}
                aria-label={`${b.label}, ${b.n} left`}
                data-testid={`kd-booster-${b.key}`}
                className="grid place-items-center transition-transform active:scale-90 disabled:opacity-45"
                style={{ ...box(cx - 42, 764, 84, 84), ...TOUCH, ...roundBtn }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    width: "74%",
                    height: "74%",
                    backgroundImage: img("booster-icons"),
                    backgroundSize: "300% 100%",
                    backgroundPosition: `${b.cell * 50}% 50%`,
                    backgroundRepeat: "no-repeat",
                  }}
                />
              </button>
              <span
                className="grid place-items-center font-black text-[#5a3419]"
                style={{
                  ...box(cx + 18, 758, 32, 32),
                  backgroundImage: img("count-badge"),
                  backgroundSize: "100% 100%",
                  ...fs(15),
                }}
                data-testid={`kd-booster-${b.key}-n`}
              >
                {b.n}
              </span>
              <span
                className="grid place-items-center font-black text-[#5a3419]"
                style={{
                  ...box(cx - 46, 850, 92, 31),
                  backgroundImage: img("label-plate"),
                  backgroundSize: "100% 100%",
                  ...fs(14),
                }}
              >
                {b.label}
              </span>
            </div>
          );
        })}

        {phase !== "play" || paused ? (
          <div
            className="absolute inset-0 z-20 grid place-items-center bg-[#2b1a10]/65 p-5"
            data-testid="kd-overlay"
            data-phase={paused && phase === "play" ? "paused" : phase}
          >
            <div className="w-full max-w-[88%] rounded-[28px] border-2 border-[#e6c579] bg-[#fff4dc] p-4 text-center shadow-2xl">
              {phase === "play" ? (
                <p className="text-3xl" aria-hidden="true">
                  ⏸️
                </p>
              ) : (
                <img
                  src={kdUrl(phase === "won" ? "win" : "fail")}
                  alt=""
                  aria-hidden="true"
                  data-testid="kd-picture"
                  className="mx-auto h-auto max-h-44 w-auto max-w-full"
                />
              )}
              <h2 className="mt-1 text-2xl font-black">
                {phase === "won" ? "All dispatched!" : phase === "lost" ? "Time is up" : "Paused"}
              </h2>
              {phase === "won" ? (
                <p className="mt-1 text-sm font-bold" data-testid="kd-result">
                  <span aria-label={`${stars} stars`}>{"⭐".repeat(stars)}</span>
                  <br />
                  {round.blocked} blocked {round.blocked === 1 ? "tap" : "taps"}
                </p>
              ) : phase === "lost" ? (
                <p className="mt-1 text-sm">
                  {cratesLeft(round)} crates were left. Same counter, one tap away.
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                {phase === "play" ? (
                  <button
                    type="button"
                    onClick={() => setPaused(false)}
                    data-testid="kd-resume"
                    className="min-h-12 rounded-2xl bg-[#557b47] p-3 font-bold text-white"
                  >
                    Resume
                  </button>
                ) : null}
                {phase === "won" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBoardNo((n) => n + 1);
                      setAttempt(0);
                    }}
                    data-testid="kd-next"
                    className="min-h-12 rounded-2xl bg-[#557b47] p-3 font-bold text-white"
                  >
                    Next dispatch
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAttempt((a) => a + 1)}
                  data-testid="kd-restart"
                  className={`min-h-12 rounded-2xl p-3 font-bold ${phase === "lost" ? "bg-[#557b47] text-white" : "border border-[#cfb58a]"}`}
                >
                  {phase === "lost" ? "Try again" : phase === "won" ? "Play it again" : "Restart"}
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  data-testid="kd-leave"
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
