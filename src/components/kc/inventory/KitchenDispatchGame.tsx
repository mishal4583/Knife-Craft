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
import { AudioManager } from "@/game/AudioManager";
import { PauseManager } from "@/game/PauseManager";
import { usePaused } from "@/components/kc/story/usePausableTimeout";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { StageSides } from "@/components/kc/common/StageSides";
import { TurnUprightCard } from "@/components/kc/common/TurnUprightCard";
import { useTurnUpright } from "@/components/kc/common/useTurnUpright";
import {
  CRATE_FIRST_LEVEL,
  FREEZE_SECONDS,
  brickAtCell,
  crateStars,
  cratesLeft,
  dragBrick,
  finishDrag,
  freezeRound,
  foodOf,
  hammerWall,
  roundCleared,
  rocketBrick,
  dressBoard,
  startRound,
  undoRound,
  wallAtCell,
  type Brick,
  type CrateRound,
} from "@/game/business/crateDispatch";
import { VAN_LEVELS, vanLevelLine } from "@/game/business/miniGameLevels";
import { LevelPicker } from "./LevelPicker";
import { DeliverySlip } from "./DeliverySlip";
import { cargoName } from "@/game/business/crateCargo";
import { cargoWishes } from "@/game/restaurant/vanWishes";
import { useUnlockText } from "@/components/kc/navLevel";
import {
  KD_PORTRAIT,
  KD_STAGE,
  KD_WIDE,
  cellAt,
  drawKitchenDispatch,
  type KdView,
  type Leaving,
} from "./kitchenDispatchDraw";
import { kdUrl, loadKdArt, type KdArt } from "./kitchenDispatchArt";
import { PortraitOnly } from "@/components/kc/game/PortraitOnly";
import { useLandscape } from "@/components/kc/game/layoutMode";
import { landscapeGameArt } from "@/game/landscapeArt";

type Phase = "play" | "won" | "lost";
const NOTICE_MS = 1700;
const WIN_DELAY_MS = 650;

/** A box in stage units (540 x 960, or 960 x 540 on the landscape board), placed as percentages so it scales with the stage. */
const boxOn =
  (stage: { readonly w: number; readonly h: number }) =>
  (x: number, y: number, w: number, h: number): CSSProperties => ({
    position: "absolute",
    left: `${(x / stage.w) * 100}%`,
    top: `${(y / stage.h) * 100}%`,
    width: `${(w / stage.w) * 100}%`,
    height: `${(h / stage.h) * 100}%`,
  });
/** A font size in stage units, scaled with the stage's width. */
const fsOn =
  (stage: { readonly w: number }) =>
  (px: number): CSSProperties => ({ fontSize: `${(px / stage.w) * 100}cqw` });
/** A touch target never smaller than 48 px, whatever the stage's scale. */
const TOUCH: CSSProperties = { minWidth: 48, minHeight: 48 };
const img = (name: string) => `url(${kdUrl(name)})`;
/** The centre of each booster button on the counter, in stage units. */
const BOOSTER_X = [109, 218, 327, 435];
/**
 * The landscape board's HUD, in its 960 x 540 stage units, laid out like the developer's mock-up (2026-11-20): a full-width top bar (back and the level, the title, the line
 * that says what to do, Pause), Paige, the clock, the crates left with the stars and the pinned tip card on the left wall, the frame in the middle, and the four boosters in a
 * column on the right wall.
 */
type Box4 = readonly [number, number, number, number];
type Hud = Record<
  | "back"
  | "level"
  | "title"
  | "timer"
  | "left"
  | "stars"
  | "mascot"
  | "tip"
  | "pause"
  | "notice"
  | "panel"
  | "card",
  Box4
>;
const WIDE_UI: Hud = {
  back: [20, 8, 64, 64],
  level: [92, 4, 86, 72],
  title: [216, 0, 238, 88],
  notice: [452, 2, 342, 86],
  pause: [880, 8, 64, 64],
  mascot: [26, 96, 150, 126],
  timer: [24, 238, 196, 66],
  panel: [30, 306, 186, 100],
  left: [46, 311, 144, 46],
  stars: [56, 362, 124, 34],
  card: [82, 414, 74, 86],
  tip: [168, 436, 44, 44],
};
/** The landscape board's boosters, one column: the centre x and the four tops (a name plate overlaps the foot of the button, as in the mock-up). */
const WIDE_BOOSTER = { x: 852, y: [96, 189, 282, 375] } as const;

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Kitchen Dispatch (developer 2026-11-17, rebuilt the same day on the sliding-block "door" mechanism: drag a crate across the
 * counter and push it against the gate that shows its own food). A preview at /?kitchenDispatch=<level> and on the Kitchen's
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
  /** A wide window (a desktop, a tablet, a phone on its side) gets the LANDSCAPE board; only an upright window keeps the 9:16 stage. */
  const wide = useLandscape();
  const layout = wide ? KD_WIDE : KD_PORTRAIT;
  const stage = layout.stage;
  const box = boxOn(stage);
  const fs = fsOn(stage);
  /** "Next dispatch" moves to the next board; "Try again" replays the same one. */
  const [boardNo, setBoardNo] = useState(0);
  const [attempt, setAttempt] = useState(0);
  /** The level being unloaded: the player's own to start with, or one chosen in the level picker (developer 2026-11-26: replay and look back at earlier levels). */
  const [playLevel, setPlayLevel] = useState(level);
  const [picking, setPicking] = useState(false);
  const openUpTo = Math.max(level, CRATE_FIRST_LEVEL);
  /** What opens a locked tile, in the game's own words (services in the restaurant game, developer 2026-10-30). */
  const unlock = useUnlockText();
  const seed = playLevel * 1000003 + day * 9176 + boardNo;
  /**
   * What the restaurant is waiting for, read once when the game opens (restaurant/vanWishes.ts): it only chooses what the crates carry, never the board's shape, and it moves nothing. "Next dispatch"
   * (the van's next trip) brings the next of several wanted things.
   */
  const [wishes] = useState(() => cargoWishes(save));
  const initial = useMemo(() => {
    const round = startRound(playLevel, seed);
    return {
      ...round,
      board: dressBoard(round.board, wishes, { level: playLevel, seed, trip: boardNo }),
    };
  }, [playLevel, seed, boardNo, wishes]);
  /** The delivery slip: what is on this van. The clock waits while it is open. */
  const [slipOpen, setSlipOpen] = useState(false);
  const [round, setRound] = useState<CrateRound>(initial);
  const [phase, setPhase] = useState<Phase>("play");
  const [paused, setPaused] = useState(false);
  /** On a phone on its side the 9:16 stage is a thin strip: a card asks for the phone upright and the clock waits behind it. The landscape board needs no card. */
  const turn = useTurnUpright();
  const held = turn.held && !wide;
  const playAnyway = turn.playAnyway;
  const heldRef = useRef(held);
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
  /** The notice's own timer: a new message starts its full time again. */
  const noticeTimer = useRef(0);
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
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), NOTICE_MS);
  }, []);

  // a new board, or the same one again
  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    window.clearTimeout(noticeTimer.current);
    leavingRef.current = [];
    visRef.current = new Map();
    dragRef.current = null;
    dragIdRef.current = null;
    freezeRef.current = 0;
    setFrozen(false);
    armedRef.current = null;
    setArmedState(null);
    pausedRef.current = heldRef.current || PauseManager.isPaused();
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
      window.clearTimeout(noticeTimer.current);
    },
    [],
  );
  // the platform's pause too (an ad, the player switching away): Playgama asks gameplay and timers to stop (deep check 2026-11-27)
  const away = usePaused();
  useEffect(() => {
    heldRef.current = held;
    pausedRef.current = paused || held || picking || slipOpen || away;
  }, [paused, held, picking, slipOpen, away]);

  // the draw loop and the clock
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    artRef.current = artRef.current ?? loadKdArt();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = stage.w * dpr;
    canvas.height = stage.h * dpr;
    let raf = 0;
    let last = performance.now();
    let shownSecond = -1;
    // The canvas is redrawn only while something moves (a crate gliding, leaving, dragged, a power armed) or a board change is new; a still board
    // is repainted four times a second (late art still appears). It used to repaint every frame, still or not.
    let lastDraw = -Infinity;
    let lastBoard: unknown = null;
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
          AudioManager.playSfx("gameLose");
        }
      }
      const whole = Math.ceil(timeRef.current);
      if (whole !== shownSecond) {
        shownSecond = whole;
        setSecondsLeft(timeRef.current);
        // the last ten seconds tick (not while the clock is frozen or the game is paused)
        if (
          whole > 0 &&
          whole <= 10 &&
          phaseRef.current === "play" &&
          !pausedRef.current &&
          freezeRef.current <= 0
        )
          AudioManager.playSfx("sortTick");
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
      let settling = false;
      for (const b of roundRef.current.board.bricks) {
        const v = vis.get(b.id);
        if (v && (v.x !== b.x || v.y !== b.y)) settling = true;
      }
      const still =
        !settling &&
        leavingRef.current.length === 0 &&
        dragIdRef.current === null &&
        armedRef.current === null &&
        lastBoard === roundRef.current.board &&
        now - lastDraw < 250;
      if (still) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastDraw = now;
      lastBoard = roundRef.current.board;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawKitchenDispatch(ctx, roundRef.current.board, {
        now,
        art: artRef.current,
        leaving: leavingRef.current,
        vis,
        dragId: dragIdRef.current,
        armed: armedRef.current,
        layout,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layout, stage.w, stage.h]);

  /** The stage point under a pointer event. */
  const stagePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * stage.w,
      y: ((e.clientY - r.top) / r.height) * stage.h,
    };
  };
  const winSoon = (next: CrateRound) => {
    if (!roundCleared(next)) return;
    timers.current.push(
      window.setTimeout(() => {
        // an Undo inside this delay can bring a crate back: win only if the board is still clear
        if (phaseRef.current === "play" && roundCleared(roundRef.current)) {
          setPhaseBoth("won");
          AudioManager.playSfx("gameWin");
        }
      }, WIN_DELAY_MS),
    );
  };
  /** A crate has gone out of its gate: it slides away, and the board may be clear. */
  const sendOut = (brick: Brick, gate: Leaving["gate"], next: CrateRound, sound = true) => {
    if (sound) AudioManager.playSfx("crateOut");
    say(`✓ ${cargoName(foodOf(next.board, brick.color))} sent out`);
    leavingRef.current = [...leavingRef.current, { brick, gate, start: performance.now() }];
    visRef.current.delete(brick.id);
    setRoundBoth(next);
    winSoon(next);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "play" || pausedRef.current || dragRef.current) return;
    const p = stagePoint(e);
    const round = roundRef.current;
    const { cx, cy, fx, fy } = cellAt(round.board, p.x, p.y, layout);
    const armedNow = armedRef.current;
    if (armedNow === "rocket") {
      const b = brickAtCell(round.board, cx, cy);
      if (!b) return;
      const gate = round.board.gates.find((g) => g.color === b.color);
      if (!gate) return;
      AudioManager.playSfx("crateRocket");
      sendOut(b, gate, rocketBrick(round, b.id), false);
      setArmed(null);
      return;
    }
    if (armedNow === "hammer") {
      const w = wallAtCell(round.board, cx, cy);
      if (!w) return;
      AudioManager.playSfx("crateSmash");
      setRoundBoth(hammerWall(round, w.id));
      setArmed(null);
      say("Smashed!");
      return;
    }
    const brick = brickAtCell(round.board, cx, cy);
    if (!brick) return;
    // the sorting hint (developer 2026-11-17): what the crate holds and which door it belongs to
    const thing = cargoName(foodOf(round.board, brick.color));
    say(`${thing} → the ${thing} door`);
    dragRef.current = {
      id: brick.id,
      pointerId: e.pointerId,
      from: brick,
      offX: fx - brick.x,
      offY: fy - brick.y,
      moved: false,
    };
    dragIdRef.current = brick.id;
    AudioManager.playSfx("crateGrab");
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
    const { fx, fy } = cellAt(roundRef.current.board, p.x, p.y, layout);
    const res = dragBrick(roundRef.current, d.id, Math.round(fx - d.offX), Math.round(fy - d.offY));
    if (!res.moved) return;
    d.moved = true;
    // a soft scrape as the crate glides to a new cell (the one-name gap keeps a fast drag from stuttering)
    if (!res.out) AudioManager.playSfx("crateSlide");
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

  const playing = phase === "play" && !paused && !held;
  const arm = (kind: "rocket" | "hammer") => {
    if (!playing) return;
    AudioManager.playSfx("tap");
    if (armedRef.current === kind) return setArmed(null);
    setArmed(kind);
    say(kind === "rocket" ? "Tap a crate to launch it" : "Tap a dark block to smash it");
  };
  const onFreeze = () => {
    if (!playing || roundRef.current.freezes <= 0 || freezeRef.current > 0) return;
    freezeRef.current = FREEZE_SECONDS;
    AudioManager.playSfx("crateFreeze");
    setFrozen(true);
    setRoundBoth(freezeRound(roundRef.current));
    say(`Clock frozen for ${FREEZE_SECONDS} seconds`);
  };
  const onUndo = () => {
    if (!playing || roundRef.current.undos <= 0 || roundRef.current.history.length === 0) return;
    const next = undoRound(roundRef.current);
    if (next === roundRef.current) return;
    AudioManager.playSfx("crateUndo");
    const ids = new Set(next.board.bricks.map((b) => b.id));
    leavingRef.current = leavingRef.current.filter((l) => !ids.has(l.brick.id));
    setRoundBoth(next);
  };

  const budget = Math.max(1, round.seconds);
  const stars = crateStars(secondsLeft, budget);
  const frac = Math.max(0, Math.min(1, secondsLeft / budget));
  const low = secondsLeft <= 15;
  /** Where each piece of the HUD sits, in the stage's units: the 9:16 stage's top bar and counter, or the landscape board's two walls. */
  const ui: Hud = wide
    ? WIDE_UI
    : {
        back: [8, 8, 64, 64],
        level: [72, 6, 86, 72],
        title: [166, 4, 262, 98],
        timer: [14, 196, 234, 78],
        left: [252, 206, 140, 54],
        stars: [398, 213, 128, 40],
        mascot: [0, 90, 146, 124],
        // (the tip sits beside the Slip card, not on it: on it, a tap on the card opened the help)
        tip: [390, 122, 48, 48],
        pause: [468, 8, 64, 64],
        notice: [110, 104, 280, 90],
        panel: [0, 0, 0, 0],
        card: [444, 104, 78, 88],
      };
  /** The booster at `i`: where its button, its count and its name go. */
  const boosterAt = (i: number) => {
    if (wide) {
      return { cx: WIDE_BOOSTER.x, top: WIDE_BOOSTER.y[i] ?? 0 };
    }
    return { cx: BOOSTER_X[i] ?? 0, top: 766 };
  };
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
      {wide ? (
        // the Codex wide room covers the window (never a bar); the 16:9 board sits on it
        <img
          src={landscapeGameArt("unload-the-van")}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-testid="kd-room"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <>
          <PortraitOnly art={landscapeGameArt("unload-the-van")} />
          <StageSides src={kdUrl("backdrop")} stage={KD_STAGE} />
        </>
      )}
      <div
        className="relative select-none [container-type:inline-size]"
        style={{
          width: `min(100cqw, calc(100cqh * ${stage.w} / ${stage.h}))`,
          aspectRatio: `${stage.w} / ${stage.h}`,
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="kd-canvas"
          aria-label="Unload the Van: drag each crate across the loading bay to the door that shows the same picture"
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
          style={{ ...box(...ui.back), ...TOUCH, ...roundBtn, ...fs(26) }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label="Choose a level"
          data-testid="kd-choose"
          className="pointer-events-auto grid place-items-center font-black text-white active:scale-95"
          style={{
            ...box(...ui.level),
            ...TOUCH,
            backgroundImage: img("level-badge"),
            backgroundSize: "100% 100%",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute left-0 right-0 text-center font-extrabold text-[#dff0ff] drop-shadow-[0_1px_0_rgba(0,0,0,.4)]"
            style={{ top: "21%", ...fs(9.5) }}
          >
            Level ▾
          </span>
          <span
            data-testid="kd-level"
            className="mt-[20%] drop-shadow-[0_2px_0_rgba(0,0,0,.4)]"
            style={fs(24)}
          >
            {playLevel}
          </span>
        </button>
        <div
          className="grid place-items-center text-center font-black text-[#fff4d9]"
          style={{
            ...box(...ui.title),
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
          style={{ ...box(...ui.pause), ...TOUCH, ...roundBtn, ...fs(24) }}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>

        {/* Paige beside the instruction, and the pinned crate card with its tip */}
        <div
          aria-hidden="true"
          data-testid="kd-mascot"
          style={{
            ...box(...ui.mascot),
            backgroundImage: img("mascot"),
            backgroundSize: "100% auto",
            backgroundPosition: "top center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          className="grid place-items-center px-[7%] text-center font-extrabold leading-tight text-[#5a3419]"
          style={{
            ...box(...ui.notice),
            backgroundImage: img("info-banner"),
            backgroundSize: "100% 100%",
            ...fs(wide ? 14 : 16.5),
          }}
        >
          <span role="status" data-testid="kd-notice">
            {notice ||
              ((round.board.trapped ?? 0) > 0
                ? "Blocked crate? Slide the one in its way aside first."
                : "The van is here! Slide each crate to the door with the same picture.")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSlipOpen(true)}
          aria-label="Delivery slip: what is on this van"
          data-testid="kd-slip-open"
          className="pointer-events-auto rounded-md border-2 border-[#d8b373] bg-[#fff3d6] shadow-[0_4px_8px_rgba(0,0,0,.35)] active:scale-95"
          style={{
            ...box(...ui.card),
            ...TOUCH,
            transform: wide ? "rotate(-3deg)" : "rotate(4deg)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center leading-none"
            style={fs(36)}
          >
            🚚
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-[5%] text-center font-black text-[#5a3419]"
            style={fs(15)}
          >
            Slip
          </span>
          <span className="absolute left-1/2 top-[-6%] h-[13%] w-[17%] -translate-x-1/2 rounded-full bg-[#d6402a] shadow-[0_2px_3px_rgba(0,0,0,.4)]" />
        </button>
        <span className="grid place-items-center" style={box(...ui.tip)}>
          <InfoTip label="How to play">
            The delivery van has dropped its crates on the loading bay. Drag a crate across it; it
            cannot pass through other crates or the dark blocks. Push it against the door that shows
            the same picture, with its width inside the door, and it goes out: a mushroom crate only
            leaves by the mushroom door, a crate of forks only by the fork door, and so on. From
            Level 23 some crates are blocked in: slide the crate in their way aside first (you can
            move it again later). Unload every crate before the timer ends. Freeze stops the clock
            for 10 seconds, Rocket sends one crate out, Hammer smashes one dark block and Undo takes
            back your last move. More time left earns more stars. The Slip card lists what is on
            this van; tap the level badge to replay an earlier level.
          </InfoTip>
        </span>

        {/* the timer, the crates and the stars */}
        <div
          style={{
            ...box(...ui.timer),
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
        {wide ? (
          // the wooden panel the "Crates" plate and the stars sit on (the mock-up): dark wood with a copper rim
          <div
            aria-hidden="true"
            data-testid="kd-panel"
            className="rounded-[18px] border-[3px] border-[#d98a3a] bg-[linear-gradient(#6a3d1c,#43250f)] shadow-[0_4px_10px_rgba(0,0,0,.4),inset_0_0_0_2px_rgba(255,220,160,.25)]"
            style={box(...ui.panel)}
          />
        ) : null}
        <div
          className="flex items-center justify-center gap-[4%] font-black text-[#5a3419]"
          style={{
            ...box(...ui.left),
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
          style={box(...ui.stars)}
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
          const { cx, top } = boosterAt(i);
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
                  ...box(cx - 43, top, 86, 72),
                  ...TOUCH,
                  backgroundImage: img(`booster-${b.key}`),
                  backgroundSize: "100% 100%",
                }}
              />
              <span
                className="pointer-events-none grid place-items-center font-black text-[#5a3419]"
                style={{
                  ...box(cx + 17, top - 9, 34, 34),
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
                  ...box(cx - 46, top + (wide ? 58 : 72), 92, wide ? 28 : 31),
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
            <div
              className={`w-full rounded-[28px] border-2 border-[#e6c579] bg-[#fff4dc] p-4 text-center shadow-2xl ${wide ? "max-w-[min(88%,420px)]" : "max-w-[88%]"}`}
            >
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
                  className="mx-auto h-auto max-h-44 w-auto max-w-full [@media(max-height:480px)]:max-h-20"
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    data-testid="kd-levels"
                    className="min-h-12 rounded-2xl border border-[#cfb58a] p-2 font-bold"
                  >
                    All levels
                  </button>
                  <button
                    type="button"
                    onClick={onExit}
                    data-testid="kd-leave"
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
      {slipOpen ? (
        <DeliverySlip
          doors={round.board.gates.flatMap((g) => {
            const door = initial.board.cargo?.[g.color];
            return door ? [door] : [];
          })}
          onClose={() => setSlipOpen(false)}
        />
      ) : null}
      {picking ? (
        <LevelPicker
          testId="kd-picker"
          title="Choose a level"
          line={
            openUpTo >= VAN_LEVELS[VAN_LEVELS.length - 1]!
              ? "Every level open"
              : `${openUpTo - CRATE_FIRST_LEVEL + 1} of ${VAN_LEVELS.length} open · more open as you serve`
          }
          tiles={VAN_LEVELS.map((k) => ({
            id: k,
            open: k <= openUpTo,
            current: k === playLevel,
            // the tile's number is the van's level, as on its badge; a locked one says what opens it
            title: `${k}`,
            sub: k <= openUpTo ? vanLevelLine(k) : unlock.when(k),
          }))}
          onPick={(k) => {
            setPlayLevel(k);
            setBoardNo(0);
            setAttempt((a) => a + 1);
            setPaused(false);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
      {held ? (
        <TurnUprightCard
          game="Unload the Van"
          testId="kd-upright"
          onPlayAnyway={playAnyway}
          onLeave={onExit}
        />
      ) : null}
    </main>
  );
}
