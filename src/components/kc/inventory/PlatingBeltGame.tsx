import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import {
  platingBeltDishOfTheDay,
  platingBeltIngredientsOf,
} from "@/game/business/platingBeltContent";
import { BELT_PROVEN_SEEDS_BY_TIER } from "@/game/business/plateSeeds";
import {
  beltColorName,
  beltTierForLevel,
  beltTrapped,
  beltWon,
  hintBeltMove,
  makeBeltRound,
  moveBeltWaiter,
  starsForPeakTables,
  type BeltMove,
  type BeltMoveResult,
  type BeltState,
} from "@/game/business/platingBelt";

/** One lap of the belt, in ms. A second tap while it runs finishes it at once. */
const LAP_MS = 1200;
const SHAKE_MS = 400;
const NOTICE_MS = 1600;
const HINT_AFTER_MS = 4000;
/** Cubes of one colour sit in a plain round chef badge until the waiter art is made. */
const CHEF = "🧑‍🍳";

function seedFor(level: number, day: number, tier: number) {
  const seeds = BELT_PROVEN_SEEDS_BY_TIER[tier as 1 | 2 | 3 | 4];
  return seeds[(((Math.imul(level, 31) + day - 1) % seeds.length) + seeds.length) % seeds.length]!;
}

function PlateCanvas({ board }: { board: BeltState["board"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const cell = rect.width / board.size;
      const inset = Math.max(0.3, cell * 0.06);
      for (let y = 0; y < board.size; y += 1) {
        for (let x = 0; x < board.size; x += 1) {
          const color = board.cells[y * board.size + x]!;
          if (color < 0) continue;
          ctx.fillStyle = board.colorHexes[color] ?? "#888";
          ctx.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
          ctx.fillStyle = "rgba(255,255,255,.22)";
          ctx.fillRect(
            x * cell + inset,
            y * cell + inset,
            cell - inset * 2,
            Math.max(0.6, cell * 0.14),
          );
          ctx.fillStyle = "rgba(60,30,15,.24)";
          ctx.fillRect(x * cell + inset, y * cell + cell * 0.82, cell - inset * 2, cell * 0.12);
        }
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [board]);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-[8%] h-[84%] w-[84%]"
      aria-label="Mosaic platter"
      data-testid="pb-canvas"
    />
  );
}

/** A waiter: a round badge in the colour of its cubes, with the cubes it still carries. */
function Waiter({
  hex,
  count,
  label,
  onClick,
  disabled,
  glow,
  shake,
  testId,
}: {
  hex: string;
  count: number;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  glow?: boolean;
  shake?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
      data-hex={hex}
      className={`relative grid h-12 w-12 place-items-center rounded-full border-2 text-[24px] shadow-md transition active:scale-90 disabled:opacity-100 ${glow ? "border-[#ffe17d] ring-4 ring-[#ffd24a]" : "border-[#5b3a1f]"} ${shake ? "animate-[sortShake_0.4s_ease-in-out]" : ""}`}
      style={{ background: hex }}
    >
      <span aria-hidden="true" className="drop-shadow-[0_1px_0_rgba(0,0,0,.35)]">
        {CHEF}
      </span>
      <span className="absolute -bottom-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full border border-[#5b3a1f] bg-[#fff4d9] px-1 text-[11px] font-black leading-none text-[#3d2412]">
        {count}
      </span>
    </button>
  );
}

export function PlatingBeltGame({
  save,
  level,
  onExit,
}: {
  save: SaveData;
  level: number;
  onExit: () => void;
}) {
  const day = save.business.calendar.businessDay;
  const reducedMotion = save.settings.reducedMotion;
  const tier = useMemo(() => beltTierForLevel(level), [level]);
  // Keyed by the dish's id, not by `save`: the round must not rebuild when the save is rewritten.
  const dish = platingBeltDishOfTheDay(save, day);
  const dishId = dish.id;
  const ingredients = useMemo(() => platingBeltIngredientsOf(dish), [dishId]); // eslint-disable-line react-hooks/exhaustive-deps
  const seed = seedFor(level, day, tier.id);
  const initial = useMemo(() => makeBeltRound(tier, ingredients, seed), [tier, ingredients, seed]);

  const [state, setState] = useState<BeltState>(initial);
  const [phase, setPhase] = useState<"playing" | "paused" | "won" | "trapped">("playing");
  const [notice, setNotice] = useState("");
  const [moving, setMoving] = useState<{ hex: string } | null>(null);
  const [hint, setHint] = useState<BeltMove | null>(null);
  const [shake, setShake] = useState("");
  const [undoSnapshot, setUndoSnapshot] = useState<BeltState | null>(null);
  const [undoUsed, setUndoUsed] = useState(false);
  const lapTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const shakeTimer = useRef<number | null>(null);
  const busyRef = useRef(false);
  const pendingState = useRef<BeltState | null>(null);

  const clearTimer = (ref: { current: number | null }) => {
    if (ref.current !== null) window.clearTimeout(ref.current);
    ref.current = null;
  };

  const resetRound = useCallback((board: BeltState) => {
    clearTimer(lapTimer);
    clearTimer(noticeTimer);
    clearTimer(shakeTimer);
    busyRef.current = false;
    pendingState.current = null;
    setMoving(null);
    setState(board);
    setPhase("playing");
    setNotice("");
    setHint(null);
    setShake("");
    setUndoSnapshot(null);
    setUndoUsed(false);
  }, []);

  useEffect(() => resetRound(initial), [initial, resetRound]);
  useEffect(
    () => () => {
      clearTimer(lapTimer);
      clearTimer(noticeTimer);
      clearTimer(shakeTimer);
    },
    [],
  );
  useEffect(() => {
    if (phase !== "playing" || moving) return;
    const id = window.setTimeout(() => setHint(hintBeltMove(state)), HINT_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [phase, moving, state]);

  const say = (text: string) => {
    clearTimer(noticeTimer);
    setNotice(text);
    noticeTimer.current = window.setTimeout(() => setNotice(""), NOTICE_MS);
  };

  const settle = useCallback((next: BeltState) => {
    clearTimer(lapTimer);
    busyRef.current = false;
    pendingState.current = null;
    setMoving(null);
    setState(next);
    setHint(null);
    if (beltWon(next)) setPhase("won");
    else if (beltTrapped(next)) setPhase("trapped");
  }, []);

  const refuse = (move: BeltMove, reason: Extract<BeltMoveResult, { ok: false }>["reason"]) => {
    say(reason === "table-full" ? "All five tables are full" : "Nothing to collect yet");
    clearTimer(shakeTimer);
    setShake(move.kind === "lane" ? `lane-${move.lane}` : `table-${move.table}`);
    shakeTimer.current = window.setTimeout(() => setShake(""), SHAKE_MS);
  };

  const play = (move: BeltMove) => {
    if (busyRef.current) {
      // A tap while a lap runs only finishes the lap.
      if (pendingState.current) settle(pendingState.current);
      return;
    }
    if (phase !== "playing") return;
    setHint(null);
    const outcome = moveBeltWaiter(state, move);
    if (!outcome.ok) {
      refuse(move, outcome.reason);
      return;
    }
    say(outcome.collected ? `${outcome.collected} collected` : "Nothing to collect: it waits");
    setUndoSnapshot(state);
    const hex = state.board.colorHexes[outcome.waiter.color] ?? "#fff";
    if (reducedMotion) {
      settle(outcome.state);
      return;
    }
    busyRef.current = true;
    pendingState.current = outcome.state;
    setMoving({ hex });
    lapTimer.current = window.setTimeout(() => settle(outcome.state), LAP_MS);
  };

  const undo = () => {
    if (!undoSnapshot || undoUsed || busyRef.current) return;
    setState(undoSnapshot);
    setUndoSnapshot(null);
    setUndoUsed(true);
    setPhase("playing");
    setHint(null);
    say("Last tap undone");
  };

  const cubesLeft = useMemo(
    () => state.board.cells.filter((cell) => cell >= 0).length,
    [state.board],
  );
  const stars = starsForPeakTables(state.peakTables, undoUsed);
  const hexOf = (color: number) => state.board.colorHexes[color] ?? "#888";
  const canUndo = !!undoSnapshot && !undoUsed && !moving && phase !== "won";
  const status =
    notice ||
    (moving
      ? "Tap to skip the lap"
      : hint
        ? "Try the glowing waiter"
        : "Tap a waiter at the front");

  return (
    <main
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fff0cf] text-[#492b19]"
      data-testid="plating-belt-game"
      data-tier={tier.id}
      data-dish={dishId}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(8px,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1 rounded-2xl border border-[#d7a95c] bg-[#fff8e8] px-3 py-1.5 shadow-md">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#a56a31]">
            🍽️ Plating Belt
          </p>
          <p className="truncate text-sm font-extrabold" data-testid="pb-dish">
            {dish.name}
          </p>
        </div>
        <InfoTip label="How to play">
          Tap a waiter at the front of a lane. It walks one lap round the plate and takes the cubes
          of its colour that face the belt. Cubes it could not reach send it to a waiting table, and
          you can tap it there again later. Only five tables, and a full row can jam the plate.
          Fewer tables used earns more stars.
        </InfoTip>
        <button
          type="button"
          onClick={() => setPhase(phase === "paused" ? "playing" : "paused")}
          aria-label={phase === "paused" ? "Resume" : "Pause"}
          data-testid="pb-pause"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#d7a95c] bg-[#fff8e8] text-xl font-black shadow-md"
        >
          {phase === "paused" ? "▶" : "Ⅱ"}
        </button>
      </header>

      <div className="mt-1 flex shrink-0 items-center justify-between gap-2 px-4 text-[13px] font-bold leading-tight">
        <span>🧑‍🍳 Send waiters in the right order!</span>
        <span
          className="shrink-0 whitespace-nowrap rounded-full bg-[#ead4a8] px-2 py-1"
          data-testid="pb-cubes"
        >
          {cubesLeft} 🧊
        </span>
      </div>

      <div className="min-h-0 flex-1 [container-type:size]">
        <div className="grid h-full w-full place-items-center">
          <section
            className="relative"
            style={{ width: "min(94cqw, 100cqh)", height: "min(94cqw, 100cqh)" }}
            aria-label="Platter and conveyor belt"
          >
            <div className="absolute inset-0 rounded-full border-[8px] border-[#9a5a26] bg-[radial-gradient(circle_at_35%_25%,#7a6e62,#4a4038_70%,#33291f)] shadow-[0_6px_0_#663b22,0_12px_22px_#5b351f66]" />
            <div className="absolute inset-[2.5%] rounded-full border-[3px] border-[#f5d27b]" />
            <PlateCanvas board={state.board} />
            {moving ? (
              <div
                aria-hidden="true"
                data-testid="pb-lap"
                className="absolute inset-0 animate-[beltLap_1.2s_linear_forwards]"
              >
                <span
                  className="absolute left-1/2 top-[-1%] grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full border-2 border-[#5b3a1f] text-[15px] shadow-md"
                  style={{ background: moving.hex }}
                >
                  {CHEF}
                </span>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <section className="shrink-0 rounded-t-[26px] border-t-4 border-[#a76b39] bg-[#7b4b2b] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 text-[#fff3d9] shadow-[0_-5px_14px_#4b2d1f55]">
        <p className="text-center text-[11px] font-black uppercase tracking-[.16em] text-[#f2d08e]">
          Waiter lanes
        </p>
        <div
          className="mt-1 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${tier.lanes}, minmax(0, 1fr))` }}
        >
          {state.lanes.map((lane, index) => {
            const front = lane[0];
            const queued = lane.slice(1, 4).reverse();
            const more = lane.length - 4;
            return (
              <div
                key={index}
                className="flex min-h-[48px] flex-col items-center justify-end gap-[2px]"
                data-testid={`pb-lane-${index}`}
                data-length={lane.length}
              >
                {more > 0 ? (
                  <span className="text-[10px] font-black leading-none text-[#f2d08e]">
                    +{more}
                  </span>
                ) : null}
                {queued.map((next) => (
                  <span
                    key={next.id}
                    aria-hidden="true"
                    className="grid h-[17px] w-[40px] place-items-center rounded-full border border-[#5b3a1f] text-[10px] font-black leading-none text-[#3d2412]"
                    style={{ background: hexOf(next.color) }}
                  >
                    <span className="rounded bg-[#fff4d9]/85 px-1">{next.count}</span>
                  </span>
                ))}
                {front ? (
                  <Waiter
                    hex={hexOf(front.color)}
                    count={front.count}
                    label={`Lane ${index + 1}: ${beltColorName(hexOf(front.color))} waiter, ${front.count} cubes`}
                    glow={hint?.kind === "lane" && hint.lane === index}
                    shake={shake === `lane-${index}`}
                    disabled={phase !== "playing"}
                    onClick={() => play({ kind: "lane", lane: index })}
                    testId={`pb-front-${index}`}
                  />
                ) : (
                  <span
                    className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-[#d5b47c] text-xl text-[#d5b47c]"
                    data-testid={`pb-front-${index}`}
                    data-empty="1"
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mb-1 mt-1.5 text-center text-[11px] font-black uppercase tracking-[.16em] text-[#f2d08e]">
          Waiting tables
        </p>
        <div className="grid grid-cols-5 gap-1.5 px-1">
          {state.tables.map((waiter, index) =>
            waiter ? (
              <div key={index} className="grid place-items-center">
                <Waiter
                  hex={hexOf(waiter.color)}
                  count={waiter.count}
                  label={`Table ${index + 1}: ${beltColorName(hexOf(waiter.color))} waiter, ${waiter.count} cubes`}
                  glow={hint?.kind === "table" && hint.table === index}
                  shake={shake === `table-${index}`}
                  disabled={phase !== "playing"}
                  onClick={() => play({ kind: "table", table: index })}
                  testId={`pb-table-${index}`}
                />
              </div>
            ) : (
              <div
                key={index}
                role="img"
                aria-label={`Empty table ${index + 1}`}
                data-testid={`pb-table-${index}`}
                data-empty="1"
                className="grid h-12 min-w-0 place-items-center rounded-full border border-dashed border-[#d5b47c] bg-[#51321f] text-[#c39961]"
              >
                <span aria-hidden="true">○</span>
              </div>
            ),
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
          <p
            role="status"
            data-testid="pb-status"
            className="min-h-[20px] min-w-0 flex-1 text-xs font-bold text-[#ffedb9]"
          >
            {status}
          </p>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            data-testid="pb-undo"
            aria-label="Undo the last tap, once, costs a star"
            className="h-12 shrink-0 rounded-full border-2 border-[#d7a95c] bg-[#fff3d9] px-3 text-xs font-black text-[#56351e] disabled:opacity-40"
          >
            ↶ Undo
          </button>
        </div>
      </section>

      {phase !== "playing" ? (
        <div
          className="absolute inset-0 z-20 grid place-items-center bg-[#321d13]/60 p-5"
          data-testid="pb-overlay"
          data-phase={phase}
        >
          <div className="w-full max-w-sm rounded-[28px] border-2 border-[#e6c579] bg-[#fff4dc] p-5 text-center shadow-2xl">
            <p className="text-3xl" aria-hidden="true">
              {phase === "paused" ? "⏸️" : phase === "won" ? "🎉" : "🍽️"}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {phase === "paused"
                ? "Paused"
                : phase === "won"
                  ? "Banquet served!"
                  : "The belt is jammed"}
            </h2>
            {phase === "won" ? (
              <p className="mt-2 text-sm font-bold" data-testid="pb-result">
                <span aria-label={`${stars} stars`}>{"⭐".repeat(stars)}</span>
                <br />
                {state.peakTables} {state.peakTables === 1 ? "table" : "tables"} at once
                {undoUsed ? ", Undo used" : ""}
              </p>
            ) : phase === "trapped" ? (
              <p className="mt-2 text-sm">Every table is stuck. Undo once, or try again.</p>
            ) : (
              <p className="mt-2 text-sm">Take a breath, chef.</p>
            )}
            <div className="mt-4 grid gap-2">
              {phase === "paused" ? (
                <button
                  type="button"
                  onClick={() => setPhase("playing")}
                  className="min-h-12 rounded-2xl bg-[#557b47] p-3 font-bold text-white"
                >
                  Resume
                </button>
              ) : null}
              {phase === "trapped" && canUndo ? (
                <button
                  type="button"
                  onClick={undo}
                  data-testid="pb-undo-overlay"
                  className="min-h-12 rounded-2xl bg-[#c98a2b] p-3 font-bold text-white"
                >
                  ↶ Undo the last tap
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => resetRound(initial)}
                data-testid="pb-restart"
                className={`min-h-12 rounded-2xl p-3 font-bold text-white ${phase === "paused" ? "bg-[#9b632f]" : "bg-[#557b47]"}`}
              >
                {phase === "paused"
                  ? "Restart this plate"
                  : phase === "won"
                    ? "Play again"
                    : "Try again"}
              </button>
              <button
                type="button"
                onClick={onExit}
                data-testid="pb-leave"
                className="min-h-12 rounded-2xl border border-[#cfb58a] p-3 font-bold"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
