import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { PointerHand } from "@/components/kc/common/PointerHand";
import type { SaveData } from "@/game/SaveManager";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { bigDeliveryHype } from "@/game/business/fridgeSort";
import {
  STAR_AT,
  applyMove,
  badgesOf,
  boardsLeft,
  comboMultiplier,
  freeSlotOf,
  isCleared,
  isLocked,
  progressOf,
  roundFor,
  scoreBoard,
  solve,
  starsFor,
  stockroomSortOf,
  type Board,
  type Move,
  type Round,
  type RoundEffects,
  type StockroomSortAction,
  type StockroomSortResult,
} from "@/game/business/stockroomSort";
import { Art, Plaque, SortButton, StarBar } from "./sort/SortParts";
import { clock, fsUrl } from "./sort/sortUtils";

/**
 * STOCKROOM SORT — the screen of the "Stock the shelves" mini-game (rules: business/stockroomSort.ts, plan: docs/planning/STOCKROOM-SORT-MINIGAME-PLAN-2026-11-06.md).
 *
 * A shelf of wooden cubbies (three slots each) holds the supplies that were just bought, mixed. The player TAPS a product and then a cubby with
 * a free slot (or DRAGS it there); three alike in one cubby are stocked and pop away. The clock starts at the first move. A move never costs
 * anything; Undo takes it back. At the end the stars give Hype; the game never moves money or stock.
 * Reduced Motion: no floating numbers, shake or pop animation: pieces just appear and disappear.
 */

type Phase = "ready" | "playing" | "paused" | "done";

const srUrl = (name: string) => `${import.meta.env.BASE_URL}business/stockroom/${name}.webp`;
const NO_EFFECTS: RoundEffects = { hype: 0, badge: false, newBest: false };
/** A drag counts as a drag after this many pixels; below it the touch is a tap (select the piece). */
const DRAG_PX = 8;
/** Where the three slots of a cubby stand (percent of the cubby's width) and how big a piece is. */
const SLOT_X = [19, 50, 81] as const;
const PIECE_W = 27;
/** Undo uses a board gets from Level 44 (before that it is unlimited). */
const LIMITED_UNDOS = 3;

const shortName = (id: string): string => (getSupplyItem(id)?.name ?? id).split("·")[0]!.trim();

/** One painted good (public/business/stockroom/goods/, cut from the Codex art by scripts/make-market-assets.py); the supply's emoji if it fails. */
function Goods({ id, className }: { id: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={cn("grid place-items-center text-[28px]", className)}>
        {getSupplyItem(id)?.icon ?? "📦"}
      </span>
    );
  return (
    <img
      src={`${import.meta.env.BASE_URL}business/stockroom/goods/${id}.webp`}
      alt=""
      draggable={false}
      data-goods-art={id}
      onError={() => setFailed(true)}
      className={cn("pointer-events-none select-none object-contain", className)}
    />
  );
}

/** One painted piece of the Stockroom Sort set; hidden if it fails to load. */
function SrArt({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={srUrl(name)}
      alt=""
      draggable={false}
      data-stockroom-art={name}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      className={cn("pointer-events-none select-none", className)}
      style={style}
    />
  );
}

function ghostPosition(
  root: HTMLElement | null,
  x: number,
  y: number,
): { left: number; top: number } {
  if (!root) return { left: x, top: y };
  const r = root.getBoundingClientRect();
  const sx = root.offsetWidth > 0 ? r.width / root.offsetWidth : 1;
  const sy = root.offsetHeight > 0 ? r.height / root.offsetHeight : 1;
  return { left: (x - r.left) / (sx || 1), top: (y - r.top) / (sy || 1) };
}

type Snapshot = { board: Board; stocked: number; gaps: number[]; last: number };
type Sel = { c: number; slot: number };

export function StockroomSortGame({
  save,
  playerLevel,
  reducedMotion,
  hasPrepCook,
  onAction,
  onExit,
}: {
  save: SaveData;
  playerLevel: number;
  reducedMotion: boolean;
  hasPrepCook: boolean;
  onAction: (a: StockroomSortAction) => StockroomSortResult;
  onExit: () => void;
}) {
  const [round, setRound] = useState<Round | null>(() => roundFor(save, playerLevel));
  const [practice, setPractice] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [board, setBoard] = useState<Board | null>(round?.board ?? null);
  const [selected, setSelected] = useState<Sel | null>(null);
  const [drag, setDrag] = useState<{ c: number; slot: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  /** Wrapped pieces (by uid) that were picked up once: they show their product from then on. */
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  /** The how-to card: shown by itself the first time (no finished board yet), and from the "?" button any time. */
  const [guide, setGuide] = useState<boolean>(() => (stockroomSortOf(save).rounds ?? 0) === 0);
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const noteTimer = useRef<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [praise, setPraise] = useState<{ key: number; text: string; ribbon: string } | null>(null);
  const [pops, setPops] = useState<ReadonlyArray<{ key: number; text: string; cubby: number }>>([]);
  const [msLeft, setMsLeft] = useState(round?.timeMs ?? 0);
  const [result, setResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    stocked: number;
    effects: RoundEffects;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const [undosUsed, setUndosUsed] = useState(0);
  const [idle, setIdle] = useState(false);

  // The fast-changing facts live in refs so a pointer event never sees an old render.
  const boardRef = useRef<Board | null>(round?.board ?? null);
  const phaseRef = useRef<Phase>("ready");
  const leftRef = useRef(round?.timeMs ?? 0);
  const lastTickRef = useRef(0);
  const stockedRef = useRef<string[]>([]);
  const gapsRef = useRef<number[]>([]);
  const lastStockRef = useRef(0);
  const historyRef = useRef<Snapshot[]>([]);
  const movesRef = useRef(0);
  const gestureRef = useRef<{
    c: number;
    slot: number;
    x0: number;
    y0: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);
  const doneRef = useRef(false);
  const popKey = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);

  const state = stockroomSortOf(save);
  const sets = round?.sets.length ?? 0;
  const tier = round?.tier;
  const limitedUndo = (tier?.from ?? 0) >= 44;
  const undosLeft = limitedUndo ? Math.max(0, LIMITED_UNDOS - undosUsed) : Infinity;
  const firstTime = (state.rounds ?? 0) === 0 && !practice;

  const say = (text: string, tone: "good" | "bad", ms = 2400) => {
    setNote({ text, tone });
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), ms);
  };
  useEffect(
    () => () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    },
    [],
  );

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const finish = useCallback(
    (left: number) => {
      if (!round || doneRef.current) return;
      doneRef.current = true;
      const stockedN = stockedRef.current.length;
      const score = scoreBoard(gapsRef.current, round.sets.length, left);
      const stars = starsFor(stockedN, round.sets.length, left, round.timeMs);
      let effects = NO_EFFECTS;
      if (!practice) {
        const r = onAction({
          kind: "finish",
          outcome: { stars, score, stocked: [...stockedRef.current] },
        });
        if (r.ok) effects = r.effects;
      }
      setResult({ stars, score, stocked: stockedN, effects });
      setPhaseBoth("done");
      setSelected(null);
      setDrag(null);
      setHover(null);
      setHint(null);
      AudioManager.playSfx(stars > 0 ? "levelComplete" : "plate");
    },
    [onAction, practice, round],
  );

  // The clock: runs only while playing (it starts with the first move, and pausing freezes it).
  useEffect(() => {
    if (phase !== "playing" || !round) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      leftRef.current = Math.max(0, leftRef.current - (now - last));
      last = now;
      setMsLeft(leftRef.current);
      const sec = Math.ceil(leftRef.current / 1000);
      if (sec <= 8 && sec > 0 && sec !== lastTickRef.current) {
        lastTickRef.current = sec;
        AudioManager.playSfx("sortTick");
      }
      if (leftRef.current <= 0) {
        window.clearInterval(id);
        finish(0);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, round, finish]);

  /** "After a miss" hints (Level 31-43): the Hint button wakes up after a quiet spell. */
  const poke = useCallback(() => {
    setIdle(false);
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 7000);
  }, []);

  const start = () => {
    if (phaseRef.current !== "ready") return;
    setPhaseBoth("playing");
    poke();
    if (!practice)
      onAction({
        kind: "start",
        sets,
        cubbies: boardRef.current?.cubbies.length ?? 0,
        practice: false,
      });
  };

  const bump = (c: number) => {
    AudioManager.playSfx("sortWrong");
    setShake(c);
    window.setTimeout(() => setShake(null), 450);
  };

  const doMove = (from: Sel, to: number) => {
    const b = boardRef.current;
    if (!round || !b || (phaseRef.current !== "playing" && phaseRef.current !== "ready")) return;
    if (from.c === to) {
      setSelected(null);
      return;
    }
    start();
    if (isLocked(b, to)) {
      bump(to);
      say("That cubby is locked: stock more sets to open it", "bad", 2600);
      return;
    }
    const r = applyMove(b, { from: from.c, slot: from.slot, to });
    setSelected(null);
    setHover(null);
    setHint(null);
    if (!r) {
      bump(to);
      say("That cubby is full: pick one with a free slot", "bad", 2400);
      return;
    }
    historyRef.current.push({
      board: b,
      stocked: stockedRef.current.length,
      gaps: [...gapsRef.current],
      last: lastStockRef.current,
    });
    movesRef.current += 1;
    boardRef.current = r.board;
    setBoard(r.board);
    poke();
    AudioManager.playSfx("sortPick");
    const elapsed = round.timeMs - leftRef.current;
    for (const ev of r.events.stocked) {
      stockedRef.current = [...stockedRef.current, ev.id];
      gapsRef.current = [...gapsRef.current, Math.max(0, elapsed - lastStockRef.current)];
      lastStockRef.current = elapsed;
      const n = gapsRef.current.length;
      // the streak of fast sets in a row (the same rule as the score)
      let streak = 0;
      for (let k = 1; k < n; k++) streak = gapsRef.current[k]! <= 8000 ? streak + 1 : 0;
      const pts = Math.round(100 * comboMultiplier(streak));
      AudioManager.playSfx(streak >= 2 ? "sortCombo" : "sortPlace");
      if (streak === 2) setPraise({ key: ++popKey.current, text: "Nice!", ribbon: "ribbon-sage" });
      else if (streak === 3)
        setPraise({ key: ++popKey.current, text: "Great!", ribbon: "ribbon-gold" });
      else if (streak >= 4)
        setPraise({ key: ++popKey.current, text: "Awesome!", ribbon: "ribbon-copper" });
      else say(`${shortName(ev.id)} stocked! ✨`, "good", 1600);
      if (!reducedMotion) {
        const key = ++popKey.current;
        setPops((p) => [...p.slice(-4), { key, text: `+${pts}`, cubby: ev.cubby }]);
        window.setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 900);
      }
    }
    if (isCleared(r.board)) finish(leftRef.current);
    else if (stockedRef.current.length === sets - 1 && r.events.stocked.length > 0)
      say("Last set!", "good", 1500);
  };

  const undo = () => {
    const snap = historyRef.current.pop();
    if (!snap || (phaseRef.current !== "playing" && phaseRef.current !== "ready")) return;
    if (limitedUndo) {
      if (undosLeft <= 0) {
        historyRef.current.push(snap);
        return;
      }
      setUndosUsed((n) => n + 1);
    }
    boardRef.current = snap.board;
    setBoard(snap.board);
    stockedRef.current = stockedRef.current.slice(0, snap.stocked);
    gapsRef.current = snap.gaps;
    lastStockRef.current = snap.last;
    setSelected(null);
    setHint(null);
    AudioManager.playSfx("tap");
  };

  const showHint = () => {
    const b = boardRef.current;
    if (!b || (phaseRef.current !== "playing" && phaseRef.current !== "ready")) return;
    const path = solve(b, 4000);
    if (!path || path.length === 0) {
      say("Stuck? Tap Undo and try another way", "bad", 3000);
      return;
    }
    start();
    setHint(path[0]!);
    window.setTimeout(() => setHint(null), 3000);
  };

  // ── pointer handling on a piece ──
  const onPieceDown = (e: React.PointerEvent, c: number, slot: number) => {
    if (phaseRef.current !== "ready" && phaseRef.current !== "playing") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    gestureRef.current = { c, slot, x0: e.clientX, y0: e.clientY, moved: false };
  };
  const onPieceMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < DRAG_PX) return;
    if (!g.moved) {
      g.moved = true;
      start();
      AudioManager.playSfx("sortPick");
      setSelected({ c: g.c, slot: g.slot });
      const p = boardRef.current?.cubbies[g.c]?.front[g.slot];
      if (p?.mystery) setRevealed((s) => new Set(s).add(p.uid));
    }
    setDrag({ c: g.c, slot: g.slot, x: e.clientX, y: e.clientY });
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cubby]");
    setHover(t ? Number(t.getAttribute("data-cubby")) : null);
  };
  const onPieceUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || !g.moved) return; // a plain tap is the button's own click, so mouse, finger, keyboard and assistive tech all work
    draggedRef.current = true;
    window.setTimeout(() => (draggedRef.current = false), 80);
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cubby]");
    setDrag(null);
    setHover(null);
    if (t) doMove({ c: g.c, slot: g.slot }, Number(t.getAttribute("data-cubby")));
    else setSelected(null);
  };

  const pause = () => {
    // Before the first touch the clock is not running: the button is a Back arrow (developer 2026-11-08).
    if (phaseRef.current === "ready") {
      onAction({ kind: "skip" });
      onExit();
      return;
    }
    if (phaseRef.current === "playing") setPhaseBoth("paused");
  };
  const resume = () => {
    if (phaseRef.current === "paused") setPhaseBoth("playing");
  };

  const resetFor = (r: Round | null) => {
    boardRef.current = r?.board ?? null;
    historyRef.current = [];
    stockedRef.current = [];
    gapsRef.current = [];
    lastStockRef.current = 0;
    movesRef.current = 0;
    doneRef.current = false;
    leftRef.current = r?.timeMs ?? 0;
    lastTickRef.current = 0;
    setBoard(r?.board ?? null);
    setMsLeft(r?.timeMs ?? 0);
    setResult(null);
    setNote(null);
    setSelected(null);
    setHint(null);
    setUndosUsed(0);
    setPraise(null);
    setPhaseBoth("ready");
  };
  const again = () => {
    // A practice board on the same crate: scores and shows stars, gives and keeps nothing.
    if (!round) return;
    setPractice(true);
    resetFor(round);
  };
  const nextBoard = () => {
    const next = roundFor(save, playerLevel);
    setRound(next);
    setPractice(false);
    resetFor(next);
  };

  // ── nothing to stock ──
  if (!round || !board) {
    return (
      <div
        className="grid h-full place-items-center bg-[#f7edd7] p-6 text-center"
        data-testid="stockroom-sort-empty"
      >
        <div>
          <p className="font-display text-[22px] font-extrabold text-walnut-dark">
            The shelves are tidy ✨
          </p>
          <p className="mt-1 font-ui text-[14px] text-walnut/70">
            Buy supplies in the Market and they wait here.
          </p>
          <div className="mx-auto mt-4 max-w-[240px]">
            <SortButton onClick={onExit} testId="stockroom-empty-back">
              Back to supplies
            </SortButton>
          </div>
        </div>
      </div>
    );
  }

  const stockedN = stockedRef.current.length;
  const live = scoreBoard(gapsRef.current, sets, 0);
  const progress = progressOf(stockedN, sets, leftRef.current, round.timeMs);
  const streak = (() => {
    let s = 0;
    for (let k = 1; k < gapsRef.current.length; k++) s = gapsRef.current[k]! <= 8000 ? s + 1 : 0;
    return s;
  })();
  const low = phase === "playing" && msLeft <= 8000;
  const hintMode = round.tier.hint;
  const hintOn = hintMode === "always" || (hintMode === "after-miss" && idle);
  const selPiece = selected ? (board.cubbies[selected.c]?.front[selected.slot] ?? null) : null;
  const dense = board.cubbies.length >= 8;
  const boards = boardsLeft(save, playerLevel);
  void tick;
  void setTick;

  /** A cubby that would help the held piece: it already holds that product and has a free slot (shown at the lower tiers). */
  const helps = (c: number): boolean => {
    if (!selPiece || !selected || c === selected.c || hintMode === "never") return false;
    const cb = board.cubbies[c]!;
    return freeSlotOf(board, c) >= 0 && cb.front.some((p) => p && p.id === selPiece.id);
  };

  // the tutorial hand: on the first piece of the proven solution, then on its cubby
  const tutor =
    firstTime && !guide && phase === "ready" && movesRef.current === 0
      ? (round.solution[0] ?? null)
      : null;

  const pieceBtn = (c: number, slot: number) => {
    const p = board.cubbies[c]!.front[slot];
    if (!p) return null;
    const isSel = selected?.c === c && selected.slot === slot;
    const dragging = drag?.c === c && drag.slot === slot;
    const wrapped = !!p.mystery && !revealed.has(p.uid);
    const hinted = hint?.from === c && hint.slot === slot;
    return (
      <button
        key={p.uid}
        type="button"
        data-piece={wrapped ? "wrapped" : p.id}
        data-uid={p.uid}
        data-hinted={hinted ? "1" : undefined}
        data-testid={`stock-piece-${c}-${slot}`}
        aria-pressed={isSel}
        aria-label={`${wrapped ? "Wrapped parcel" : shortName(p.id)}${isSel ? " (selected)" : ""}`}
        onPointerDown={(e) => onPieceDown(e, c, slot)}
        onPointerMove={onPieceMove}
        onPointerUp={onPieceUp}
        onPointerCancel={() => {
          gestureRef.current = null;
          setDrag(null);
          setHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (draggedRef.current) return;
          if (phaseRef.current !== "ready" && phaseRef.current !== "playing") return;
          if (selected && selected.c !== c && freeSlotOf(board, c) >= 0) {
            // tapping a piece in another cubby with room = "put it there"
            doMove(selected, c);
            return;
          }
          if (isSel) {
            setSelected(null);
            return;
          }
          setSelected({ c, slot });
          if (p.mystery) setRevealed((s) => new Set(s).add(p.uid));
          AudioManager.playSfx("sortPick");
        }}
        className={cn(
          "absolute grid touch-none place-items-center transition-transform",
          isSel && "z-20 -translate-y-[10%] scale-110 drop-shadow-[0_6px_6px_rgba(0,0,0,0.4)]",
          hinted && "z-20 animate-pulse drop-shadow-[0_0_8px_rgba(255,214,90,0.95)]",
          dragging && "opacity-35",
          shake === c && !reducedMotion && "animate-[sortShake_0.4s_ease-in-out]",
        )}
        style={{
          left: `${SLOT_X[slot]}%`,
          width: `${PIECE_W}%`,
          minWidth: 50, // a touch target is never smaller than 48 px (the shell scales a little), even in a narrow cubby
          aspectRatio: "1 / 1",
          bottom: "17%",
          transform: isSel ? undefined : "translateX(-50%)",
          marginLeft: isSel ? `-${PIECE_W / 2}%` : undefined,
          zIndex: isSel || hinted ? 20 : 2,
        }}
      >
        {wrapped ? (
          <SrArt name="parcel-closed" className="h-full w-full object-contain" />
        ) : (
          <Goods id={p.id} className="h-full w-full" />
        )}
        {isSel ? (
          <span className="pointer-events-none absolute -top-5 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-walnut-dark px-2 py-0.5 font-ui text-[11px] font-extrabold leading-none text-ivory">
            {shortName(p.id)}
          </span>
        ) : null}
      </button>
    );
  };

  const cubbyBox = (c: number) => {
    const cb = board.cubbies[c]!;
    const locked = isLocked(board, c);
    const free = freeSlotOf(board, c) >= 0;
    const glow = hover === c || (helps(c) && hintOn) || hint?.to === c;
    const tutorTarget = tutor && selected && round.solution[0]?.to === c;
    return (
      <div
        key={c}
        data-cubby={c}
        data-testid={`stock-cubby-${c}`}
        data-free={free ? "1" : "0"}
        data-locked={locked ? "1" : "0"}
        data-hint-target={hint?.to === c ? "1" : undefined}
        data-pieces={cb.front.filter(Boolean).length}
        role="button"
        tabIndex={0}
        aria-label={`Cubby ${c + 1}${locked ? " (locked)" : ""}: ${cb.front.filter(Boolean).length} of 3`}
        onClick={() => {
          if (phaseRef.current !== "ready" && phaseRef.current !== "playing") return;
          if (selected) doMove(selected, c);
        }}
        className={cn(
          "relative aspect-[520/236] w-full",
          glow && "drop-shadow-[0_0_10px_rgba(255,214,90,0.95)]",
        )}
      >
        <SrArt name="cubby" className="absolute inset-0 h-full w-full object-fill" />
        {/* the hidden second row: dark shapes behind the front pieces, until the front row is stocked */}
        {cb.back.map((p, k) => (
          <span
            key={p.uid}
            data-hidden-piece="1"
            className="pointer-events-none absolute"
            style={{
              left: `${SLOT_X[k]}%`,
              width: `${PIECE_W * 0.84}%`,
              aspectRatio: "1 / 1",
              bottom: "27%",
              transform: "translateX(-50%)",
              filter: "brightness(0.22) saturate(0.4)",
              opacity: 0.7,
              zIndex: 1,
            }}
          >
            <Goods id={p.id} className="h-full w-full" />
          </span>
        ))}
        {[0, 1, 2].map((s) => pieceBtn(c, s))}
        {/* the cubby's front lip covers the feet of the pieces, so they stand INSIDE it */}
        <SrArt
          name="cubby"
          className="absolute inset-0 h-full w-full object-fill"
          style={{ clipPath: "inset(78% 0 0 0)", zIndex: 10 }}
        />
        {locked ? (
          <span className="absolute inset-0 z-30 grid place-items-center rounded-[10%] bg-black/45">
            <SrArt name="lock-closed" className="h-[46%] w-auto" />
            <span className="absolute bottom-[10%] rounded-full bg-walnut-dark px-2 py-0.5 font-ui text-[11px] font-extrabold leading-none text-ivory">
              after {cb.lockAt} stocked
            </span>
          </span>
        ) : null}
        {tutorTarget ? (
          <PointerHand size={40} className="absolute left-[40%] top-[28%] z-40" />
        ) : null}
        {tutor && !selected && tutor.from === c ? (
          <PointerHand size={40} className="absolute z-40" />
        ) : null}
        {pops
          .filter((p) => p.cubby === c)
          .map((p) => (
            <span
              key={p.key}
              aria-hidden
              className="pointer-events-none absolute right-2 top-0 z-40 font-ui text-[16px] font-black text-gold [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] animate-[floatUp_0.9s_ease-out_forwards]"
            >
              {p.text}
            </span>
          ))}
      </div>
    );
  };

  const distinct = [...new Set(round.sets)];
  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#1f2e22] touch-none"
      style={{
        backgroundImage: `url(${srUrl("backdrop")})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
      }}
      data-testid="stockroom-sort"
      data-phase={phase}
      data-practice={practice ? "1" : "0"}
      data-sets={sets}
      data-stocked={stockedN}
      data-cubbies={board.cubbies.length}
    >
      {/* HUD: pause, clock and score on the painted wooden plaques (the same pieces as Fridge Sort) */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={pause}
          aria-label={phase === "ready" ? "Back" : "Pause"}
          data-testid="stock-pause"
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-[18px] text-gold"
        >
          <Art name="hud-round" className="absolute inset-0 h-full w-full object-fill" />
          <span className="relative">{phase === "ready" ? "←" : "⏸"}</span>
        </button>
        <Plaque
          testId="stock-timer"
          className={cn(
            "h-12 min-w-0 flex-1 font-ui text-[22px] font-black tabular-nums",
            low ? "text-tomato" : "text-ivory",
          )}
        >
          <span aria-hidden>⏱</span> {clock(msLeft)}
        </Plaque>
        <Plaque
          testId="stock-score"
          className="h-12 min-w-[104px] px-2 font-ui text-[16px] font-black tabular-nums text-ivory"
        >
          <span aria-hidden className="text-gold">
            ★
          </span>
          {live.toLocaleString("en-US")}
        </Plaque>
      </div>
      <div className="px-4 pt-2">
        <StarBar progress={progress} marks={STAR_AT} />
        <div className="mt-1 flex min-h-[34px] items-center gap-2 font-ui">
          <p
            className={cn(
              "min-w-0 flex-1 rounded-xl px-2.5 py-1 text-[13px] font-extrabold leading-tight",
              note?.tone === "bad"
                ? "bg-[#7a2a1d]/85 text-[#ffe1d6]"
                : note?.tone === "good"
                  ? "bg-[#3f6b2c]/85 text-[#eaffd9]"
                  : "bg-[#3b2a1d]/80 text-ivory",
            )}
            data-testid="stock-note"
            aria-live="polite"
          >
            {note
              ? note.text
              : selPiece
                ? `${shortName(selPiece.id)}: tap a cubby with a free slot`
                : phase === "ready"
                  ? "Tap a product, then a free slot 👇"
                  : practice
                    ? "Practice · no reward"
                    : `${sets - stockedN} set${sets - stockedN === 1 ? "" : "s"} left to stock`}
          </p>
          <span data-testid="stock-combo" className="text-[12px] font-bold text-ivory/80">
            {streak >= 2
              ? `🔥 ×${comboMultiplier(streak)
                  .toFixed(2)
                  .replace(/\.?0+$/, "")}`
              : ""}
          </span>
          <button
            type="button"
            data-testid="stock-help"
            aria-label="How to play"
            onClick={() => setGuide(true)}
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#d6b46a] bg-walnut-dark text-[16px] font-black text-gold"
          >
            ?
          </button>
        </div>
      </div>

      {/* the delivery slip: what was bought; each product is a set of 3 pieces */}
      <div
        className="mx-3 mt-1 flex items-center gap-1.5 overflow-x-auto rounded-xl bg-[#3b2a1d]/75 px-2 py-1"
        data-testid="stock-slip"
      >
        <span className="shrink-0 font-ui text-[11px] font-extrabold text-ivory/80">
          🧾 Delivery
        </span>
        {distinct.map((id) => (
          <span
            key={id}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#fff7e6]/90 px-1.5 py-0.5 font-ui text-[11px] font-black text-walnut-dark"
          >
            <Goods id={id} className="h-[1.7em] w-[1.7em]" />×
            {round.sets.filter((x) => x === id).length * 3}
          </span>
        ))}
        {boards > 1 ? (
          <span
            className="shrink-0 font-ui text-[11px] font-bold text-ivory/80"
            data-testid="stock-more-boards"
          >
            🗄️ +{boards - 1} more shelf{boards - 1 === 1 ? "" : "ves"} · ⚡ bonus for all
          </span>
        ) : null}
      </div>

      {/* the shelf unit */}
      <div className="mx-auto mt-2 min-h-0 w-full max-w-[460px] flex-1 overflow-y-auto px-3 no-scrollbar">
        <SrArt name="unit-top" className="mx-auto block w-full" />
        <div
          className={cn("grid grid-cols-2 gap-x-1.5", dense ? "gap-y-0" : "gap-y-1")}
          data-testid="stock-shelf"
        >
          {board.cubbies.map((_, c) => cubbyBox(c))}
        </div>
        <SrArt name="unit-plinth" className="mx-auto mb-2 block w-full" />
      </div>

      {/* helpers: Undo is always free; Hint fades out with the level */}
      <div className="flex items-center justify-center gap-3 px-3 pb-3 pt-1">
        <button
          type="button"
          data-testid="stock-undo"
          onClick={undo}
          disabled={historyRef.current.length === 0 || undosLeft <= 0 || phase === "done"}
          aria-label={limitedUndo ? `Undo (${undosLeft} left)` : "Undo"}
          className="press relative grid h-14 w-14 place-items-center disabled:opacity-40"
        >
          <SrArt name="boost-undo" className="h-full w-full object-contain" />
          {limitedUndo ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-walnut-dark px-1 font-ui text-[11px] font-black text-ivory">
              {undosLeft}
            </span>
          ) : null}
        </button>
        {hintMode !== "never" ? (
          <button
            type="button"
            data-testid="stock-hint"
            onClick={showHint}
            disabled={!hintOn || phase === "done"}
            aria-label="Hint"
            className={cn(
              "press grid h-14 w-14 place-items-center disabled:opacity-40",
              hintOn && idle && !reducedMotion && "animate-pulse",
            )}
          >
            <SrArt name="boost-hint" className="h-full w-full object-contain" />
          </button>
        ) : null}
      </div>

      {/* a ribbon of praise for a run of fast sets */}
      {praise ? (
        <div
          key={praise.key}
          className="pointer-events-none absolute inset-x-0 top-[34%] z-30 grid place-items-center"
          data-testid="stock-praise"
          onAnimationEnd={() => setPraise(null)}
          style={reducedMotion ? undefined : { animation: "floatUp 1.4s ease-out forwards" }}
        >
          <span className="relative grid w-[220px] place-items-center">
            <SrArt name={praise.ribbon} className="w-full" />
            <span className="absolute font-display text-[20px] font-extrabold text-[#fff7e0] [text-shadow:0_2px_3px_rgba(60,30,10,0.8)]">
              {praise.text}
            </span>
          </span>
        </div>
      ) : null}

      {/* the piece under the finger */}
      {drag && board.cubbies[drag.c]?.front[drag.slot] ? (
        <div
          className="pointer-events-none absolute z-50 grid h-[64px] w-[64px] -translate-x-1/2 -translate-y-[75%] place-items-center"
          style={ghostPosition(rootRef.current, drag.x, drag.y)}
          aria-hidden
        >
          <Goods
            id={board.cubbies[drag.c]!.front[drag.slot]!.id}
            className="h-full w-full drop-shadow-[0_8px_8px_rgba(0,0,0,0.45)]"
          />
        </div>
      ) : null}

      {/* how to play: shown by itself the first time, and from the ? button */}
      {guide ? (
        <div
          className="absolute inset-0 z-[60] grid place-items-center bg-black/75 p-5"
          data-testid="stock-guide"
        >
          <div className="w-full max-w-[330px] rounded-3xl border-4 border-[#b8873f] bg-[#f7edd7] p-4 text-center">
            <SrArt name="truck" className="mx-auto h-[72px] w-auto" />
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">
              Stock the shelves
            </p>
            <ol className="mt-2 grid gap-2 text-left font-ui text-[14px] font-bold text-walnut-dark">
              {[
                ["🛒", "What you bought comes in sets of 3, mixed up on the shelves."],
                ["👆", "Tap a product, then tap a cubby with a free slot (or drag it)."],
                ["✨", "3 alike in one cubby are stocked. Stock them all!"],
                ["⭐", "Beat the clock for stars: they add Hype and shelf badges."],
              ].map(([icon, text]) => (
                <li key={icon} className="flex items-center gap-2.5 rounded-xl bg-white/50 p-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper/15 text-[20px]">
                    {icon}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 font-ui text-[12px] font-bold text-walnut/70">
              The clock starts at your first move. Undo is free.
            </p>
            <div className="mt-3">
              <SortButton onClick={() => setGuide(false)} testId="stock-guide-ok">
                Got it
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* pause */}
      {phase === "paused" ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-6"
          data-testid="stock-paused"
        >
          <div className="w-full max-w-[300px] rounded-3xl bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">Paused</p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={resume} testId="stock-resume">
                Resume
              </SortButton>
              <SortButton
                quiet
                testId="stock-skip"
                onClick={() => {
                  onAction({ kind: "skip" });
                  onExit();
                }}
              >
                Skip this delivery
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* the result */}
      {phase === "done" && result ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-5"
          data-testid="stock-result"
          data-stars={result.stars}
        >
          <div className="relative w-full max-w-[340px] px-[22px] pb-[50px] pt-[96px] text-center">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                borderStyle: "solid",
                borderWidth: "82px 17px 19px 17px",
                borderImage: `url(${fsUrl("result-panel")}) 124 26 29 26 fill / 82px 17px 19px 17px stretch`,
              }}
            />
            <p className="absolute inset-x-0 top-[34px] font-display text-[20px] font-extrabold text-[#fff3d6] [text-shadow:0_2px_3px_rgba(90,20,10,0.8)]">
              {result.stars === 3
                ? "Perfectly stocked!"
                : result.stars > 0
                  ? "Stocked!"
                  : "Time's up"}
            </p>
            <p
              className="relative flex items-center justify-center gap-1.5"
              aria-label={`${result.stars} of 3 stars`}
            >
              {[1, 2, 3].map((n) => (
                <Art
                  key={n}
                  name={n <= result.stars ? "star-full" : "star-empty"}
                  className={cn("h-[46px] w-auto", n === 2 && "-translate-y-1")}
                />
              ))}
            </p>
            <p
              className="relative mt-2 font-ui text-[15px] font-black text-walnut-dark"
              data-testid="stock-final-score"
            >
              {result.score.toLocaleString("en-US")}
              {result.effects.newBest ? (
                <span className="ml-1.5 text-copper">new best!</span>
              ) : null}
            </p>
            <p className="relative mt-0.5 font-ui text-[12.5px] font-bold text-walnut/70">
              {result.stocked} of {sets} sets stocked
            </p>
            {practice ? (
              <p className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
                Practice: no reward
              </p>
            ) : (
              <p
                className="relative mt-1 font-ui text-[13px] font-extrabold text-olive"
                data-testid="stock-reward"
              >
                {result.effects.hype > 0 ? `⚡ +${result.effects.hype} Hype` : "No Hype this time"}
                {result.effects.badge ? " · 🏅 new shelf badge!" : ""}
              </p>
            )}
            {!practice && (result.effects.bigHype ?? 0) > 0 ? (
              <p
                className="relative mt-1 font-ui text-[13px] font-extrabold text-copper"
                data-testid="stock-big-delivery"
              >
                🎉 Whole delivery stocked ({result.effects.boards} shelves): ⚡ +
                {result.effects.bigHype} Hype
              </p>
            ) : null}
            {!practice && roundFor(save, playerLevel) && (result.effects.boards ?? 0) > 0 ? (
              <p
                className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut-dark"
                data-testid="stock-chain"
              >
                🗄️ {boardsLeft(save, playerLevel)} more shelf
                {boardsLeft(save, playerLevel) === 1 ? "" : "ves"}: finish them all for ⚡ +
                {bigDeliveryHype((result.effects.boards ?? 0) + boardsLeft(save, playerLevel))} Hype
              </p>
            ) : null}
            {!practice && result.effects.badge ? (
              <SrArt
                name={`badge-${String(Math.max(1, badgesOf(save))).padStart(2, "0")}`}
                className="relative mx-auto mt-1 h-[52px] w-[52px] object-contain"
              />
            ) : null}
            {result.stars > 0 ? (
              <span
                className="absolute right-3 top-[88px] w-[76px] -rotate-12 opacity-90"
                aria-hidden
              >
                <SrArt name="stamp" className="w-full" />
                <span className="absolute inset-0 grid place-items-center font-display text-[11px] font-black uppercase tracking-wide text-[#b4361f]">
                  Stocked
                </span>
              </span>
            ) : null}
            <div className="relative mt-3 grid gap-2">
              {!practice && roundFor(save, playerLevel) ? (
                <SortButton onClick={nextBoard} testId="stock-next">
                  Next shelf
                </SortButton>
              ) : null}
              <SortButton
                quiet={!practice && !!roundFor(save, playerLevel)}
                onClick={onExit}
                testId="stock-done"
              >
                Done
              </SortButton>
              {!practice ? (
                <SortButton quiet onClick={again} testId="stock-again">
                  Again · practice
                </SortButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {hasPrepCook && phase === "ready" ? (
        <button
          type="button"
          data-testid="stock-auto"
          onClick={() => {
            onAction({ kind: "auto" });
            onExit();
          }}
          className="absolute right-3 top-[76px] z-30 min-h-12 rounded-full border-2 border-[#d6b46a] bg-walnut-dark px-3 font-ui text-[12px] font-extrabold text-ivory"
        >
          🧑‍🍳 Prep Cook does it
        </button>
      ) : null}
    </div>
  );
}

export default StockroomSortGame;
