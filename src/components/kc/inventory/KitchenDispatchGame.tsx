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
  FREEZE_SECONDS,
  brickAtCell,
  crateStars,
  cratesLeft,
  dragBrick,
  finishDrag,
  freezeRound,
  CRATE_ITEM_NAMES,
  CRATE_ZONES,
  crateItemOf,
  hammerWall,
  roundCleared,
  rocketBrick,
  startRound,
  undoRound,
  wallAtCell,
  type Brick,
  type CrateRound,
} from "@/game/business/crateDispatch";
import {
  KD_STAGE,
  cellAt,
  drawKitchenDispatch,
  type KdView,
  type Leaving,
} from "./kitchenDispatchDraw";
import { kdUrl, loadKdArt, type KdArt } from "./kitchenDispatchArt";

type Phase = "play" | "won" | "lost";
const NOTICE_MS = 1700;
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
/** The centre of each booster button on the counter, in stage units. */
const BOOSTER_X = [109, 218, 327, 435];

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Kitchen Dispatch (developer 2026-11-17, rebuilt the same day on the sliding-block "door" mechanism: drag a crate across the
 * counter and push it against the gate of its own colour). A preview at /?kitchenDispatch=<level> and on the Kitchen's
 * Mini-games sheet; no rewards, ads or analytics until the developer has played it on a real phone. All the rules live in
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
  const visRef = useRef<KdView["vis"]>(new Map());
  const dragIdRef = useRef<string | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    from: Brick;
    offX: number;
    offY: number;
    moved: boolean;
  } | null>(null);
  const armedRef = useRef<KdView["armed"]>(null);
  const freezeRef = useRef(0);
  const timers = useRef<number[]>([]);
  const [armed, setArmedState] = useState<KdView["armed"]>(null);
  const [frozen, setFrozen] = useState(false);

  const setRoundBoth = useCallback((next: CrateRound) => {
    roundRef.current = next;
    setRound(next);
  }, []);
  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const setArmed = useCallback((next: KdView["armed"]) => {
    armedRef.current = next;
    setArmedState(next);
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
    visRef.current = new Map();
    dragRef.current = null;
    dragIdRef.current = null;
    freezeRef.current = 0;
    setFrozen(false);
    armedRef.current = null;
    setArmedState(null);
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
        roundRef.current.board.bricks.length > 0
      ) {
        if (freezeRef.current > 0) {
          freezeRef.current = Math.max(0, freezeRef.current - dt);
          if (freezeRef.current === 0) setFrozen(false);
        } else timeRef.current -= dt;
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
      // every crate glides toward its cell
      const ease = 1 - Math.exp(-dt * 26);
      const vis = visRef.current;
      const here = new Set<string>();
      for (const b of roundRef.current.board.bricks) {
        here.add(b.id);
        const v = vis.get(b.id);
        if (!v) vis.set(b.id, { x: b.x, y: b.y });
        else {
          v.x += (b.x - v.x) * ease;
          v.y += (b.y - v.y) * ease;
          if (Math.abs(b.x - v.x) < 0.002) v.x = b.x;
          if (Math.abs(b.y - v.y) < 0.002) v.y = b.y;
        }
      }
      for (const id of [...vis.keys()]) if (!here.has(id)) vis.delete(id);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawKitchenDispatch(ctx, roundRef.current.board, {
        now,
        art: artRef.current,
        leaving: leavingRef.current,
        vis,
        dragId: dragIdRef.current,
        armed: armedRef.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** The stage point under a pointer event. */
  const stagePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * KD_STAGE.w,
      y: ((e.clientY - r.top) / r.height) * KD_STAGE.h,
    };
  };
  const winSoon = (next: CrateRound) => {
    if (!roundCleared(next)) return;
    timers.current.push(
      window.setTimeout(() => {
        if (phaseRef.current === "play") setPhaseBoth("won");
      }, WIN_DELAY_MS),
    );
  };
  /** A crate has gone out of its gate: it slides away, and the board may be clear. */
  const sendOut = (brick: Brick, gate: Leaving["gate"], next: CrateRound) => {
    say(`✓ ${CRATE_ITEM_NAMES[crateItemOf(brick)]} → ${CRATE_ZONES[brick.color].name}`);
    leavingRef.current = [...leavingRef.current, { brick, gate, start: performance.now() }];
    visRef.current.delete(brick.id);
    setRoundBoth(next);
    winSoon(next);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "play" || pausedRef.current || dragRef.current) return;
    const p = stagePoint(e);
    const round = roundRef.current;
    const { cx, cy, fx, fy } = cellAt(round.board, p.x, p.y);
    const armedNow = armedRef.current;
    if (armedNow === "rocket") {
      const b = brickAtCell(round.board, cx, cy);
      if (!b) return;
      const gate = round.board.gates.find((g) => g.color === b.color);
      if (!gate) return;
      sendOut(b, gate, rocketBrick(round, b.id));
      setArmed(null);
      return;
    }
    if (armedNow === "hammer") {
      const w = wallAtCell(round.board, cx, cy);
      if (!w) return;
      setRoundBoth(hammerWall(round, w.id));
      setArmed(null);
      say("Smashed!");
      return;
    }
    const brick = brickAtCell(round.board, cx, cy);
    if (!brick) return;
    // the sorting hint (developer 2026-11-17): what the crate holds and which door it belongs to
    say(
      `${CRATE_ITEM_NAMES[crateItemOf(brick)]} go to the ${CRATE_ZONES[brick.color].name}: the ${CRATE_ZONES[brick.color].colour} door`,
    );
    dragRef.current = {
      id: brick.id,
      pointerId: e.pointerId,
      from: brick,
      offX: fx - brick.x,
      offY: fy - brick.y,
      moved: false,
    };
    dragIdRef.current = brick.id;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a browser without capture: the drag still works while the finger stays on the canvas */
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId || phaseRef.current !== "play" || pausedRef.current)
      return;
    const p = stagePoint(e);
    const { fx, fy } = cellAt(roundRef.current.board, p.x, p.y);
    const res = dragBrick(roundRef.current, d.id, Math.round(fx - d.offX), Math.round(fy - d.offY));
    if (!res.moved) return;
    d.moved = true;
    if (res.out && res.brick) {
      const next = finishDrag(res.round, d.from, { moved: true, out: true });
      dragRef.current = null;
      dragIdRef.current = null;
      sendOut(res.brick, res.out, next);
      return;
    }
    setRoundBoth(res.round);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    dragIdRef.current = null;
    if (d.moved) setRoundBoth(finishDrag(roundRef.current, d.from, { moved: true, out: false }));
  };

  const playing = phase === "play" && !paused;
  const arm = (kind: "rocket" | "hammer") => {
    if (!playing) return;
    if (armedRef.current === kind) return setArmed(null);
    setArmed(kind);
    say(kind === "rocket" ? "Tap a crate to launch it" : "Tap a dark block to smash it");
  };
  const onFreeze = () => {
    if (!playing || roundRef.current.freezes <= 0 || freezeRef.current > 0) return;
    freezeRef.current = FREEZE_SECONDS;
    setFrozen(true);
    setRoundBoth(freezeRound(roundRef.current));
    say(`Clock frozen for ${FREEZE_SECONDS} seconds`);
  };
  const onUndo = () => {
    if (!playing || roundRef.current.undos <= 0 || roundRef.current.history.length === 0) return;
    const next = undoRound(roundRef.current);
    if (next === roundRef.current) return;
    const ids = new Set(next.board.bricks.map((b) => b.id));
    leavingRef.current = leavingRef.current.filter((l) => !ids.has(l.brick.id));
    setRoundBoth(next);
  };

  const budget = Math.max(1, round.seconds);
  const stars = crateStars(secondsLeft, budget);
  const frac = Math.max(0, Math.min(1, secondsLeft / budget));
  const low = secondsLeft <= 15;
  const roundBtn: CSSProperties = {
    backgroundImage: img("round-button"),
    backgroundSize: "100% 100%",
  };
  const boosters: Array<{
    key: "freeze" | "rocket" | "hammer" | "undo";
    label: string;
    n: number;
    on: () => void;
    off: boolean;
    lit: boolean;
  }> = [
    {
      key: "freeze",
      label: "Freeze",
      n: round.freezes,
      on: onFreeze,
      off: round.freezes <= 0 || frozen,
      lit: frozen,
    },
    {
      key: "rocket",
      label: "Rocket",
      n: round.rockets,
      on: () => arm("rocket"),
      off: round.rockets <= 0,
      lit: armed === "rocket",
    },
    {
      key: "hammer",
      label: "Hammer",
      n: round.hammers,
      on: () => arm("hammer"),
      off: round.hammers <= 0 || round.board.walls.length === 0,
      lit: armed === "hammer",
    },
    {
      key: "undo",
      label: "Undo",
      n: round.undos,
      on: onUndo,
      off: round.undos <= 0 || round.history.length === 0,
      lit: false,
    },
  ];

  return (
    <main
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#2b1a10] text-[#492b19] [container-type:size]"
      data-testid="kitchen-dispatch-game"
      data-phase={phase}
      data-crates={cratesLeft(round)}
      data-moves={round.moves}
      data-frozen={frozen || undefined}
      data-armed={armed ?? undefined}
      data-board={JSON.stringify({
        cols: round.board.cols,
        bricks: round.board.bricks.map((b) => [b.id, b.x, b.y, b.w, b.h, b.color]),
        walls: round.board.walls.map((w) => [w.id, w.x, w.y, w.w, w.h]),
        gates: round.board.gates.map((g) => [g.id, g.side, g.at, g.span, g.color]),
      })}
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
          aria-label="Unload the Van: drag each crate across the loading bay to the door of its own colour"
          className="block h-full w-full touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
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
          }}
        >
          <span
            aria-hidden="true"
            className="absolute left-0 right-0 text-center font-extrabold text-[#dff0ff] drop-shadow-[0_1px_0_rgba(0,0,0,.4)]"
            style={{ top: "21%", ...fs(9.5) }}
          >
            Level
          </span>
          <span
            data-testid="kd-level"
            className="mt-[20%] drop-shadow-[0_2px_0_rgba(0,0,0,.4)]"
            style={fs(24)}
          >
            {level}
          </span>
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
          <span className="mt-[6%] drop-shadow-[0_2px_0_rgba(0,0,0,.45)]">Unload the Van</span>
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

        {/* Paige beside the instruction, and the pinned crate card with its tip */}
        <div
          aria-hidden="true"
          data-testid="kd-mascot"
          style={{
            ...box(0, 90, 146, 124),
            backgroundImage: img("mascot"),
            backgroundSize: "100% auto",
            backgroundPosition: "top center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          className="grid place-items-center px-[7%] text-center font-extrabold leading-tight text-[#5a3419]"
          style={{
            ...box(112, 104, 330, 90),
            backgroundImage: img("info-banner"),
            backgroundSize: "100% 100%",
            ...fs(16.5),
          }}
        >
          <span role="status" data-testid="kd-notice">
            {notice || "The van is here! Slide each crate out of the door of its own colour."}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="rounded-md border-2 border-[#d8b373] bg-[#fff3d6] shadow-[0_4px_8px_rgba(0,0,0,.35)]"
          style={{
            ...box(444, 104, 78, 88),
            transform: "rotate(4deg)",
          }}
        >
          <span
            className="absolute inset-0 grid place-items-center pt-[14%] leading-none"
            style={fs(40)}
          >
            🚚
          </span>
          <span className="absolute left-1/2 top-[-6%] h-[13%] w-[17%] -translate-x-1/2 rounded-full bg-[#d6402a] shadow-[0_2px_3px_rgba(0,0,0,.4)]" />
        </div>
        <span className="grid place-items-center" style={box(470, 146, 50, 50)}>
          <InfoTip label="How to play">
            The delivery van has dropped its crates on the loading bay. Drag a crate across it; it
            cannot pass through other crates or the dark blocks. Push it against the door of its own
            colour, with its width inside the door, and it goes out to that store: blue is the Cold
            room, green the Leafy rack, teal the Veg rack, orange the Root bin, red the Fruit bin,
            purple the Aromatics shelf, yellow the Pantry shelf, brown the Spice rack. Unload every
            crate before the timer ends. Freeze stops the clock for 10 seconds, Rocket sends one
            crate out, Hammer smashes one dark block and Undo takes back your last move. More time
            left earns more stars.
          </InfoTip>
        </span>

        {/* the timer, the crates and the stars */}
        <div
          style={{
            ...box(14, 196, 234, 78),
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
                background: frozen
                  ? "linear-gradient(#9ee7ff,#3fa6d6)"
                  : low
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
          className="flex items-center justify-center gap-[4%] font-black text-[#5a3419]"
          style={{
            ...box(252, 206, 140, 54),
            backgroundImage: img("label-plate"),
            backgroundSize: "100% 100%",
            ...fs(17),
          }}
          data-testid="kd-left"
        >
          <svg viewBox="0 0 24 22" aria-hidden="true" style={{ width: "19%", height: "auto" }}>
            <path
              d="M2 7 12 2l10 5v11l-10 3-10-3Z"
              fill="#d99a52"
              stroke="#6b4021"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="m2 7 10 4 10-4M12 11v10"
              fill="none"
              stroke="#6b4021"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Crates <span className="text-[#c0412a]">{cratesLeft(round)}</span>
          </span>
        </div>
        <div
          style={box(398, 213, 128, 40)}
          aria-label={`${stars} stars`}
          role="img"
          data-testid="kd-stars"
        >
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${(((i - 1) * 42) / 128) * 100}%`,
                width: `${(38 / 128) * 100}%`,
                height: "100%",
                backgroundImage: img("stars"),
                backgroundSize: "200% 100%",
                backgroundPosition: i <= stars ? "0 50%" : "100% 50%",
                backgroundRepeat: "no-repeat",
              }}
            />
          ))}
        </div>

        {/* the boosters on the counter */}
        {boosters.map((b, i) => {
          const cx = BOOSTER_X[i] ?? 0;
          return (
            <div key={b.key}>
              <button
                type="button"
                onClick={b.on}
                disabled={b.off}
                aria-label={`${b.label}, ${b.n} left`}
                data-testid={`kd-booster-${b.key}`}
                data-lit={b.lit || undefined}
                className="transition-transform active:scale-90 disabled:opacity-50 disabled:grayscale-[.45] data-[lit]:scale-110 data-[lit]:drop-shadow-[0_0_10px_#ffd24a]"
                style={{
                  ...box(cx - 43, 766, 86, 72),
                  ...TOUCH,
                  backgroundImage: img(`booster-${b.key}`),
                  backgroundSize: "100% 100%",
                }}
              />
              <span
                className="pointer-events-none grid place-items-center font-black text-[#5a3419]"
                style={{
                  ...box(cx + 17, 757, 34, 34),
                  backgroundImage: img("count-badge"),
                  backgroundSize: "100% 100%",
                  ...fs(16),
                }}
                data-testid={`kd-booster-${b.key}-n`}
              >
                {b.n}
              </span>
              <span
                className="pointer-events-none grid place-items-center font-black text-[#5a3419]"
                style={{
                  ...box(cx - 46, 838, 92, 31),
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
                  {clock(secondsLeft)} left · {round.moves} {round.moves === 1 ? "move" : "moves"}
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
