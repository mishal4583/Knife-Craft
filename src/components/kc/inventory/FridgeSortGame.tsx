import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { AudioManager } from "@/game/AudioManager";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import type { SaveData } from "@/game/SaveManager";
import {
  STAR_AT,
  TARGETS,
  bestPossible,
  comboMultiplier,
  fridgeSortOf,
  fridgeTierOf,
  pointsFor,
  roundFor,
  scoreRound,
  starsFor,
  targetOf,
  type FridgeSortAction,
  type FridgeSortResult,
  type Round,
  type RoundEffects,
  type TargetId,
} from "@/game/business/fridgeSort";

/**
 * FRIDGE SORT — the screen of the "Put it away" mini-game (rules: business/fridgeSort.ts, plan: docs/planning/FRIDGE-SORT-MINIGAME-PLAN-2026-11-03.md).
 *
 * A crate of what was just bought sits at the bottom; the fridge's zones are the targets. The player DRAGS a token to a zone, or TAPS a token
 * and then the zone (both always work). The clock starts on the first touch. A right drop scores with a combo; a wrong one springs back and
 * only resets the combo (no time penalty, no lost stock). At the end the stars give Hype; the game never moves money or stock.
 * Reduced Motion: no flying ghost animation, floating numbers or shake: tokens just appear in place.
 */

/** A button in the game's own look (KButton has no test ids): wood = the main action, ghost = the quiet one. */
function SortButton({
  children,
  onClick,
  quiet,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  quiet?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => {
        AudioManager.playSfx("tap");
        onClick();
      }}
      className={cn(
        "press inline-flex h-12 w-full items-center justify-center rounded-2xl font-ui text-[14.5px] font-extrabold tracking-wide",
        quiet
          ? "border border-walnut/25 bg-ivory/70 text-walnut"
          : "wood border border-walnut-dark/50 text-ivory shadow-soft",
      )}
    >
      {children}
    </button>
  );
}

type Phase = "ready" | "playing" | "paused" | "done";

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${pad(Math.floor((Math.max(0, ms) % 60000) / 1000))}`;
const NO_EFFECTS: RoundEffects = { hype: 0, magnet: false, newBest: false };
/** A drag counts as a drag after this many pixels; below it the touch is a tap (select the token). */
const DRAG_PX = 8;

/**
 * The painted piece behind each target (public/business/fridge-sort/, cut from the generated art by scripts/make-market-assets.py): the four
 * vegetable bins, the two crisper drawers, the door's two racks, and a glass shelf under Dairy and Meat. `kind` sets the height and where
 * the sorted items sit; nothing here changes a rule.
 */
type ArtKind = "bin" | "drawer" | "rack-butter" | "rack-aromatics" | "shelf";
const ART: Record<string, { file: string; kind: ArtKind }> = {
  dairy: { file: "shelf-glass", kind: "shelf" },
  protein: { file: "shelf-glass", kind: "shelf" },
  "veg-roots": { file: "bin-roots", kind: "bin" },
  "veg-salad": { file: "bin-salad", kind: "bin" },
  "veg-stems": { file: "bin-stems", kind: "bin" },
  "veg-pods": { file: "bin-pods", kind: "bin" },
  "fruit-drawer": { file: "drawer-fruit", kind: "drawer" },
  "greens-drawer": { file: "drawer-greens", kind: "drawer" },
  "door-butter": { file: "rack-butter", kind: "rack-butter" },
  "door-aromatics": { file: "rack-aromatics", kind: "rack-aromatics" },
};
const artOf = (id: string): { file: string; kind: ArtKind } =>
  ART[id] ?? { file: "shelf-glass", kind: "shelf" };
/** The art's height: a full crate (8+ shelves on screen, Level 44 and up) gets lower pieces so every shelf fits without scrolling. */
const ART_HEIGHT = (kind: ArtKind, dense: boolean): number =>
  ({
    bin: dense ? 64 : 100,
    drawer: dense ? 64 : 100,
    "rack-butter": dense ? 52 : 74,
    "rack-aromatics": dense ? 62 : 96,
    shelf: dense ? 36 : 52,
  })[kind];
/** Where the name chip sits on the art: over the piece's blank label plaque (bins, drawers, racks) or the shelf's top-left corner. */
const ART_CHIP: Record<ArtKind, string> = {
  bin: "left-1/2 top-[72%] -translate-x-1/2 -translate-y-1/2",
  drawer: "left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2",
  "rack-butter": "left-1/2 top-[78%] -translate-x-1/2 -translate-y-1/2",
  "rack-aromatics": "left-1/2 top-[84%] -translate-x-1/2 -translate-y-1/2",
  shelf: "left-1 top-0",
};
const ART_ITEMS: Record<ArtKind, string> = {
  bin: "inset-x-[17%] top-[8%] h-[46%] content-end",
  drawer: "inset-x-[16%] top-[14%] h-[44%] content-end",
  "rack-butter": "inset-x-[24%] top-[26%] h-[40%] content-end",
  "rack-aromatics": "inset-x-[14%] bottom-[22%] h-[44%] content-end",
  shelf: "inset-x-2 bottom-[10px] top-0 content-end",
};

/** Where the dragged token is drawn: the finger's position inside the screen, in the screen's own units (the shell may scale it). */
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

export function FridgeSortGame({
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
  onAction: (a: FridgeSortAction) => FridgeSortResult;
  onExit: () => void;
}) {
  const [round, setRound] = useState<Round | null>(() => roundFor(save, playerLevel));
  const [practice, setPractice] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [placed, setPlaced] = useState<ReadonlySet<IngredientId>>(new Set());
  const [selected, setSelected] = useState<IngredientId | null>(null);
  const [drag, setDrag] = useState<{ id: IngredientId; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<TargetId | null>(null);
  const [wrongId, setWrongId] = useState<IngredientId | null>(null);
  const [hint, setHint] = useState<TargetId | null>(null);
  const [pops, setPops] = useState<ReadonlyArray<{ key: number; text: string; target: TargetId }>>(
    [],
  );
  const [msLeft, setMsLeft] = useState(round?.timeMs ?? 0);
  const [result, setResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    effects: RoundEffects;
  } | null>(null);
  const [tick, setTick] = useState(0);

  // The fast-changing facts live in refs so a pointer event never sees an old render.
  const dropsRef = useRef<boolean[]>([]);
  const placedRef = useRef<Set<IngredientId>>(new Set());
  const phaseRef = useRef<Phase>("ready");
  const leftRef = useRef(round?.timeMs ?? 0);
  const lastTickRef = useRef(0);
  const gestureRef = useRef<{ id: IngredientId; x0: number; y0: number; moved: boolean } | null>(
    null,
  );
  const popKey = useRef(0);
  const doneRef = useRef(false);
  /** A drag just ended: the click the browser sends after it must not also select the token. */
  const draggedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const tier = fridgeTierOf(save);
  const best = fridgeSortOf(save).best?.[tier] ?? 0;
  const tokens = useMemo(() => round?.tokens ?? [], [round]);
  const expected = useMemo(() => {
    const m = new Map<TargetId, number>();
    for (const id of tokens) m.set(targetOf(id), (m.get(targetOf(id)) ?? 0) + 1);
    return m;
  }, [tokens]);
  const hintMode = round?.difficulty.hint ?? "never";

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const finish = useCallback(
    (left: number) => {
      if (!round || doneRef.current) return;
      doneRef.current = true;
      const drops = dropsRef.current;
      const score = scoreRound({ drops, tokens: round.tokens.length, msLeft: left });
      const stars = starsFor(score, round.tokens.length, playerLevel);
      let effects = NO_EFFECTS;
      if (!practice) {
        const r = onAction({ kind: "finish", outcome: { stars, score, tokens: round.tokens } });
        if (r.ok) effects = r.effects;
      }
      setResult({ stars, score, effects });
      setPhaseBoth("done");
      setSelected(null);
      setDrag(null);
      setHover(null);
      AudioManager.playSfx(stars > 0 ? "levelComplete" : "plate");
    },
    [onAction, playerLevel, practice, round],
  );

  // The clock: runs only while playing (it starts with the first touch, and pausing freezes it).
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

  const start = () => {
    if (phaseRef.current !== "ready") return;
    setPhaseBoth("playing");
    if (!practice)
      onAction({
        kind: "start",
        tokens: round?.tokens.length ?? 0,
        targets: round?.targets.length ?? 0,
        practice: false,
      });
  };

  const resolveDrop = (id: IngredientId, target: TargetId) => {
    if (!round || (phaseRef.current !== "playing" && phaseRef.current !== "ready")) return;
    if (placedRef.current.has(id)) return;
    start();
    const ok = targetOf(id) === target;
    const streakBefore = (() => {
      let n = 0;
      for (let i = dropsRef.current.length - 1; i >= 0 && dropsRef.current[i]; i--) n++;
      return n;
    })();
    dropsRef.current = [...dropsRef.current, ok];
    setSelected(null);
    setHover(null);
    if (ok) {
      placedRef.current = new Set(placedRef.current).add(id);
      setPlaced(placedRef.current);
      setHint(null);
      const pts = pointsFor(streakBefore);
      AudioManager.playSfx(
        streakBefore + 1 === 3 || streakBefore + 1 === 5 || streakBefore + 1 === 8
          ? "sortCombo"
          : "sortPlace",
      );
      if (!reducedMotion) {
        const key = ++popKey.current;
        setPops((p) => [...p.slice(-4), { key, text: `+${pts}`, target }]);
        window.setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 900);
      }
      if (placedRef.current.size >= round.tokens.length) finish(leftRef.current);
    } else {
      AudioManager.playSfx("sortWrong");
      setWrongId(id);
      window.setTimeout(() => setWrongId(null), 450);
      if (hintMode === "after-miss") {
        setHint(targetOf(id));
        window.setTimeout(() => setHint(null), 2500);
      }
    }
    setTick((n) => n + 1);
  };

  // ── pointer handling on a token ──
  const onTokenDown = (e: React.PointerEvent, id: IngredientId) => {
    if (phaseRef.current !== "ready" && phaseRef.current !== "playing") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    gestureRef.current = { id, x0: e.clientX, y0: e.clientY, moved: false };
  };
  const onTokenMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < DRAG_PX) return;
    if (!g.moved) {
      g.moved = true;
      start();
      AudioManager.playSfx("sortPick");
      setSelected(g.id);
    }
    setDrag({ id: g.id, x: e.clientX, y: e.clientY });
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-target-id]");
    setHover((t?.getAttribute("data-target-id") as TargetId | null) ?? null);
  };
  const onTokenUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;
    // A plain tap is handled by the button's own click (below), so a mouse, a finger, the keyboard and assistive technology all work.
    if (!g.moved) return;
    draggedRef.current = true;
    window.setTimeout(() => (draggedRef.current = false), 80);
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-target-id]");
    const target = t?.getAttribute("data-target-id") as TargetId | null;
    setDrag(null);
    if (target) resolveDrop(g.id, target);
    else setSelected(null);
  };

  const pause = () => {
    if (phaseRef.current === "playing") setPhaseBoth("paused");
  };
  const resume = () => {
    if (phaseRef.current === "paused") setPhaseBoth("playing");
  };

  const again = () => {
    // A practice round on the same crate: scores and shows stars, gives and keeps nothing.
    const r = round;
    if (!r) return;
    dropsRef.current = [];
    placedRef.current = new Set();
    doneRef.current = false;
    leftRef.current = r.timeMs;
    lastTickRef.current = 0;
    setPlaced(new Set());
    setMsLeft(r.timeMs);
    setResult(null);
    setPractice(true);
    setPhaseBoth("ready");
  };
  const nextCrate = () => {
    const next = roundFor(save, playerLevel);
    dropsRef.current = [];
    placedRef.current = new Set();
    doneRef.current = false;
    leftRef.current = next?.timeMs ?? 0;
    lastTickRef.current = 0;
    setRound(next);
    setPlaced(new Set());
    setMsLeft(next?.timeMs ?? 0);
    setResult(null);
    setPractice(false);
    setPhaseBoth("ready");
  };

  // ── nothing to put away ──
  if (!round) {
    return (
      <div
        className="grid h-full place-items-center bg-[#f7edd7] p-6 text-center"
        data-testid="fridge-sort-empty"
      >
        <div>
          <p className="font-display text-[22px] font-extrabold text-walnut-dark">
            The fridge is tidy ✨
          </p>
          <p className="mt-1 font-ui text-[14px] text-walnut/70">
            Buy food in the Market and it waits here.
          </p>
          <div className="mx-auto mt-4 max-w-[240px]">
            <SortButton onClick={onExit} testId="sort-empty-back">
              Back to the fridge
            </SortButton>
          </div>
        </div>
      </div>
    );
  }

  const live = scoreRound({ drops: dropsRef.current, tokens: round.tokens.length, msLeft: 0 });
  const maxScore = bestPossible(round.tokens.length, playerLevel);
  const progress = Math.min(1, live / Math.max(1, maxScore));
  const streak = (() => {
    let n = 0;
    for (let i = dropsRef.current.length - 1; i >= 0 && dropsRef.current[i]; i--) n++;
    return n;
  })();
  const shown = TARGETS.filter((t) => round.targets.includes(t.id));
  /** A full crate (8+ shelves, Level 44 and up): lower pieces and smaller tokens, so every shelf stays on screen. */
  const dense = shown.length >= 8;
  const crateLeft = round.tokens.filter((id) => !placed.has(id));
  const low = phase === "playing" && msLeft <= 8000;
  void tick;

  const targetBand = (t: (typeof TARGETS)[number]) => {
    const need = expected.get(t.id) ?? 0;
    const inside = round.tokens.filter((id) => placed.has(id) && targetOf(id) === t.id);
    const glow =
      (selected && hintMode === "always" && targetOf(selected) === t.id) ||
      hint === t.id ||
      hover === t.id;
    return (
      <button
        key={t.id}
        type="button"
        data-target-id={t.id}
        data-testid={`sort-target-${t.id}`}
        data-count={inside.length}
        data-need={need}
        aria-label={`${t.label}${need ? `: ${inside.length} of ${need}` : ""}`}
        onClick={() => {
          if (selected) resolveDrop(selected, t.id);
        }}
        className={cn(
          "relative flex min-h-[56px] flex-col items-center gap-0.5 rounded-2xl border-2 px-1.5 pb-1 pt-1 text-left transition-colors",
          t.id === "dairy" || t.id === "protein" ? "col-span-2" : "",
          glow
            ? "border-gold bg-gold/30 shadow-[0_0_0_3px_rgba(230,180,60,0.4)]"
            : "border-[#d9b779]/70 bg-white/25",
          need === 0 && "opacity-70",
        )}
      >
        <span
          className="relative block w-full"
          style={{ height: ART_HEIGHT(artOf(t.id).kind, dense) }}
          aria-hidden
        >
          <img
            src={`${import.meta.env.BASE_URL}business/fridge-sort/${artOf(t.id).file}.webp`}
            alt=""
            draggable={false}
            data-fridge-art={artOf(t.id).file}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className={cn(
              "pointer-events-none absolute",
              artOf(t.id).kind === "shelf"
                ? "inset-x-0 bottom-0 h-[16px] w-full object-fill"
                : "inset-0 h-full w-full object-contain",
            )}
          />
          <span
            className={cn(
              "pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-[#f3e1b8]/95 px-2 py-0.5 font-ui text-[11px] font-extrabold text-walnut-dark shadow-sm",
              ART_CHIP[artOf(t.id).kind],
            )}
          >
            {t.icon} {t.label}
            {need > 0 ? ` ${inside.length}/${need}` : ""}
          </span>
          <span
            className={cn(
              "absolute flex flex-wrap justify-center gap-0 text-[17px] leading-none",
              ART_ITEMS[artOf(t.id).kind],
            )}
          >
            {inside.slice(0, artOf(t.id).kind === "shelf" ? 12 : 8).map((id) => (
              <IngredientIcon key={id} id={id} fallback={INGREDIENT_EMOJI[id]} />
            ))}
          </span>
        </span>
        {pops
          .filter((p) => p.target === t.id)
          .map((p) => (
            <span
              key={p.key}
              className="pointer-events-none absolute right-2 top-0 font-ui text-[16px] font-black text-olive animate-[floatUp_0.9s_ease-out_forwards]"
            >
              {p.text}
            </span>
          ))}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full select-none flex-col overflow-hidden bg-[#3b2a1d] touch-none"
      data-testid="fridge-sort"
      data-phase={phase}
      data-practice={practice ? "1" : "0"}
      data-tokens={round.tokens.length}
      data-left={crateLeft.length}
    >
      {/* HUD */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={pause}
          aria-label="Pause"
          data-testid="sort-pause"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#d6b46a] bg-walnut text-[18px] text-gold"
        >
          ⏸
        </button>
        <div
          className={cn(
            "flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-[#d6b46a] bg-walnut-dark font-ui text-[22px] font-black tabular-nums",
            low ? "text-tomato" : "text-ivory",
          )}
          data-testid="sort-timer"
        >
          <span aria-hidden>⏱</span> {clock(msLeft)}
        </div>
        <div
          className="flex h-12 min-w-[104px] items-center justify-center gap-1 rounded-2xl border-2 border-[#d6b46a] bg-walnut-dark px-2 font-ui text-[16px] font-black tabular-nums text-ivory"
          data-testid="sort-score"
        >
          <span aria-hidden className="text-gold">
            ★
          </span>
          {live.toLocaleString("en-US")}
        </div>
      </div>
      {/* the star bar: it fills with the score, three marks */}
      <div className="px-4 pt-2">
        <div className="relative h-4 overflow-hidden rounded-full bg-black/35" aria-hidden>
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#8bc34a,#f2c230)] transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
          {STAR_AT.map((s, i) => (
            <span
              key={i}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none",
                progress >= s ? "text-gold" : "text-ivory/45",
              )}
              style={{ left: `${s * 100}%` }}
            >
              ★
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between font-ui text-[11px] font-bold text-ivory/75">
          <span>
            {practice
              ? "Practice · no reward"
              : `Fridge · best ${best ? best.toLocaleString("en-US") : "—"}`}
          </span>
          <span data-testid="sort-combo">
            {streak >= 2
              ? `🔥 ×${comboMultiplier(streak)
                  .toFixed(2)
                  .replace(/\.?0+$/, "")}`
              : ""}
          </span>
          <InfoTip label="How Fridge Sort works">
            Drag each item to the shelf where it belongs, or tap the item and then the shelf. Right
            = points, and a run of rights makes a combo. A wrong shelf only resets the combo. The
            clock starts with your first touch. Stars give Hype for the Second Floor. Nothing here
            costs money.
          </InfoTip>
        </div>
      </div>

      {/* the fridge */}
      <div className="mx-3 mt-2 min-h-0 flex-1 overflow-y-auto rounded-[26px] border-4 border-[#b9773a] bg-[radial-gradient(ellipse_at_50%_0%,#fde7b0,#f0c377_55%,#e2a65a)] p-2 shadow-inner">
        <div className="grid grid-cols-2 gap-2" data-testid="sort-targets">
          {shown.map(targetBand)}
        </div>
      </div>

      {/* the crate */}
      <div
        className="relative mx-3 mb-3 mt-2 rounded-[22px] border-4 border-[#6b4a2b] bg-[#9a6b3d] p-2 pb-3 shadow-lift"
        data-testid="sort-crate"
      >
        <div
          className="flex min-h-[72px] flex-wrap items-center justify-center gap-2"
          style={dense ? { minHeight: 56, gap: 6 } : undefined}
        >
          {crateLeft.map((id) => {
            const isSel = selected === id;
            const dragging = drag?.id === id;
            return (
              <button
                key={id}
                type="button"
                data-token={id}
                data-testid={`sort-token-${id}`}
                aria-pressed={isSel}
                aria-label={`${INGREDIENTS[id].name}${isSel ? " (selected)" : ""}`}
                onPointerDown={(e) => onTokenDown(e, id)}
                onPointerMove={onTokenMove}
                onPointerUp={onTokenUp}
                onPointerCancel={() => {
                  gestureRef.current = null;
                  setDrag(null);
                  setHover(null);
                }}
                onClick={() => {
                  if (draggedRef.current) return;
                  // tap: select it (tap again to put it back); the clock starts with the first drop or drag, not a select
                  const next = isSel ? null : id;
                  setSelected(next);
                  if (next) AudioManager.playSfx("sortPick");
                }}
                className={cn(
                  "flex touch-none flex-col items-center justify-center rounded-2xl border-2 bg-[#fff7e6] leading-none",
                  dense ? "h-[54px] w-[50px] text-[22px]" : "h-[64px] w-[58px] text-[26px]",
                  isSel
                    ? "border-gold -translate-y-1 shadow-[0_4px_0_rgba(0,0,0,0.25)]"
                    : "border-[#e0c89a]",
                  dragging && "opacity-35",
                  wrongId === id && !reducedMotion && "animate-[sortShake_0.4s_ease-in-out]",
                )}
              >
                <IngredientIcon
                  id={id}
                  fallback={INGREDIENT_EMOJI[id]}
                  className="h-[1.25em] w-[1.25em]"
                />
                <span className="mt-0.5 max-w-[54px] truncate font-ui text-[10px] font-extrabold text-walnut-dark">
                  {INGREDIENTS[id].name.split(" ")[0]}
                </span>
              </button>
            );
          })}
          {crateLeft.length === 0 && phase !== "done" ? (
            <span className="font-ui text-[13px] font-bold text-ivory">Empty ✓</span>
          ) : null}
        </div>
        {phase === "ready" ? (
          <p
            className="mt-1 text-center font-ui text-[12px] font-bold text-ivory"
            data-testid="sort-ready"
          >
            Drag an item to its shelf to start
          </p>
        ) : null}
        {round.queued > 0 ? (
          <p className="mt-1 text-center font-ui text-[11px] font-bold text-ivory/80">
            + {round.queued} more waiting
          </p>
        ) : null}
      </div>

      {/* the token under the finger */}
      {drag ? (
        <div
          className="pointer-events-none absolute z-50 grid h-[58px] w-[58px] -translate-x-1/2 -translate-y-[70%] place-items-center rounded-2xl border-2 border-gold bg-[#fff7e6] text-[28px] shadow-lg"
          style={ghostPosition(rootRef.current, drag.x, drag.y)}
          aria-hidden
        >
          <IngredientIcon
            id={drag.id}
            fallback={INGREDIENT_EMOJI[drag.id]}
            className="h-[1.3em] w-[1.3em]"
          />
        </div>
      ) : null}

      {/* pause */}
      {phase === "paused" ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-6"
          data-testid="sort-paused"
        >
          <div className="w-full max-w-[300px] rounded-3xl bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">Paused</p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={resume} testId="sort-resume">
                Resume
              </SortButton>
              <SortButton
                quiet
                testId="sort-skip"
                onClick={() => {
                  onAction({ kind: "skip" });
                  onExit();
                }}
              >
                Skip this crate
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* the result */}
      {phase === "done" && result ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-5"
          data-testid="sort-result"
          data-stars={result.stars}
        >
          <div className="w-full max-w-[340px] rounded-3xl border-4 border-[#b8873f] bg-[#f7edd7] p-4 text-center shadow-lift">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">
              {result.stars === 3
                ? "Perfectly sorted!"
                : result.stars > 0
                  ? "Put away!"
                  : "Time's up"}
            </p>
            <p
              className="mt-1 text-[34px] leading-none tracking-[0.15em]"
              aria-label={`${result.stars} of 3 stars`}
            >
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= result.stars ? "text-gold" : "text-walnut/25"}>
                  ★
                </span>
              ))}
            </p>
            <p
              className="mt-2 font-ui text-[15px] font-black text-walnut-dark"
              data-testid="sort-final-score"
            >
              {result.score.toLocaleString("en-US")}
              {result.effects.newBest ? (
                <span className="ml-1.5 text-copper">new best!</span>
              ) : null}
            </p>
            {practice ? (
              <p className="mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
                Practice: no reward
              </p>
            ) : (
              <p
                className="mt-1 font-ui text-[13px] font-extrabold text-olive"
                data-testid="sort-reward"
              >
                {result.effects.hype > 0 ? `⚡ +${result.effects.hype} Hype` : "No Hype this time"}
                {result.effects.magnet ? " · 🧲 new fridge magnet!" : ""}
              </p>
            )}
            <div className="mt-3 grid gap-2">
              {!practice && roundFor(save, playerLevel) ? (
                <SortButton onClick={nextCrate} testId="sort-next">
                  Next crate
                </SortButton>
              ) : null}
              <SortButton
                quiet={!practice && !!roundFor(save, playerLevel)}
                onClick={onExit}
                testId="sort-done"
              >
                Done
              </SortButton>
              {!practice ? (
                <SortButton quiet onClick={again} testId="sort-again">
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
          data-testid="sort-auto"
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

export default FridgeSortGame;
