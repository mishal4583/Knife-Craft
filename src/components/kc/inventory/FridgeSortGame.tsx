import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { AudioManager } from "@/game/AudioManager";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { PointerHand } from "@/components/kc/common/PointerHand";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import type { SaveData } from "@/game/SaveManager";
import {
  STAR_AT,
  TARGETS,
  bestPossible,
  comboMultiplier,
  expiringTokens,
  expiryDoubleActive,
  magnetsOf,
  fridgeSortOf,
  fridgeTierOf,
  pointsFor,
  roundFor,
  scoreRound,
  starsFor,
  targetOf,
  zoneExamples,
  basketsLeft,
  bigDeliveryHype,
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

const fsUrl = (name: string) => `${import.meta.env.BASE_URL}business/fridge-sort/${name}.webp`;

/** One painted piece (public/business/fridge-sort/, cut from the generated art by scripts/make-market-assets.py); hidden if it fails to load. */
function Art({
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
      src={fsUrl(name)}
      alt=""
      draggable={false}
      data-fridge-art={name}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      className={cn("pointer-events-none select-none", className)}
      style={style}
    />
  );
}

/** A wooden plaque: the painted frame is a 9-slice border so the carving never stretches, the text sits on a plain layer above it. */
function Plaque({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn("relative flex items-center justify-center bg-[#3a2417]/80", className)}
      style={{ borderRadius: 14 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderStyle: "solid",
          borderWidth: "14px 26px",
          borderImage: `url(${fsUrl("hud-wide")}) 40 80 40 80 fill / 14px 26px 14px 26px stretch`,
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children}</span>
    </div>
  );
}

/** Where on the painted star bar (fraction of its width) the score marks sit, and the bar's usable track. */
const BAR_MARKS = [0.406, 0.682, 0.917] as const;
const BAR_LEFT = 0.06;
const BAR_RIGHT = 0.95;
/** Score share -> where the fill ends on the bar: piecewise linear through the star marks, so each star lands on a painted ring. */
function barX(share: number): number {
  const at = [0, ...STAR_AT, 1];
  const xs = [BAR_LEFT, ...BAR_MARKS, BAR_RIGHT];
  const v = Math.min(1, Math.max(0, share));
  for (let i = 1; i < at.length; i++)
    if (v <= at[i]!)
      return xs[i - 1]! + ((v - at[i - 1]!) / (at[i]! - at[i - 1]!)) * (xs[i]! - xs[i - 1]!);
  return BAR_RIGHT;
}

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

/** A small deterministic number in [0, 1) from two integers (the pile's jitter: the same basket always looks the same). */
function noise(a: number, b: number): number {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/**
 * The loose pieces lie in a heap on the basket's cloth: a jittered grid, so they overlap a little and none hides another's middle.
 * Positions are percentages of the basket's box (the piece's own centre); `size` is the piece's side in px.
 */
function pileLayout(n: number): { x: number; y: number; rot: number; size: number }[] {
  const size = n <= 8 ? 60 : n <= 12 ? 54 : 48;
  const cols = n <= 4 ? n : n <= 9 ? Math.ceil(n / 2) : Math.ceil(n / 3);
  const rows = Math.ceil(n / Math.max(1, cols));
  const out: { x: number; y: number; rot: number; size: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    // a short last row is centred
    const colX = (c + 0.5 + (cols - inRow) / 2) / cols;
    const rowY = (r + 0.5) / rows;
    out.push({
      x: 14 + colX * 72 + (noise(i, 1) - 0.5) * 5,
      y: 12 + rowY * 42 + (noise(i, 2) - 0.5) * 6,
      rot: Math.round((noise(i, 3) - 0.5) * 40),
      size,
    });
  }
  return out;
}

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
  /** Pieces are told apart by their place in `round.tokens` (an ingredient has one piece per count). */
  const [placed, setPlaced] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<TargetId | null>(null);
  const [wrongId, setWrongId] = useState<number | null>(null);
  /** The how-to card: shown by itself the first time (no finished crate yet), and from the "?" button any time. */
  const [guide, setGuide] = useState<boolean>(() => (fridgeSortOf(save).rounds ?? 0) === 0);
  /** The line under the star bar: what to do now, what the held piece is, and how the last drop went. */
  const [note, setNote] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const noteTimer = useRef<number | null>(null);
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
  /** The ⏳ tokens of this crate (Level 74+): worth double while more than a third of the clock is left. */
  const [expiring, setExpiring] = useState<ReadonlySet<IngredientId>>(() =>
    round ? expiringTokens(save, round.tokens, playerLevel) : new Set(),
  );
  /** Which right drops (by their order among the right ones) were doubled. */
  const doubledRef = useRef<Set<number>>(new Set());

  // The fast-changing facts live in refs so a pointer event never sees an old render.
  const dropsRef = useRef<boolean[]>([]);
  const placedRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<Phase>("ready");
  const leftRef = useRef(round?.timeMs ?? 0);
  const lastTickRef = useRef(0);
  const gestureRef = useRef<{ i: number; x0: number; y0: number; moved: boolean } | null>(null);
  const popKey = useRef(0);
  const doneRef = useRef(false);
  /** A drag just ended: the click the browser sends after it must not also select the token. */
  const draggedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const tier = fridgeTierOf(save);
  const best = fridgeSortOf(save).best?.[tier] ?? 0;
  const tokens = useMemo(() => round?.tokens ?? [], [round]);
  const doublePieces = useMemo(
    () => tokens.filter((id) => expiring.has(id)).length,
    [tokens, expiring],
  );
  const pile = useMemo(() => pileLayout(tokens.length), [tokens.length]);
  const say = (text: string, tone: "good" | "bad", ms = 2400) => {
    setNote({ text, tone });
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), ms);
  };
  useEffect(
    () => () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    },
    [],
  );
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
      const score = scoreRound(
        { drops, tokens: round.tokens.length, msLeft: left },
        doubledRef.current,
      );
      const stars = starsFor(score, round.tokens.length, playerLevel, doublePieces);
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
    [onAction, playerLevel, practice, round, doublePieces],
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

  const resolveDrop = (i: number, target: TargetId) => {
    if (!round || (phaseRef.current !== "playing" && phaseRef.current !== "ready")) return;
    if (placedRef.current.has(i)) return;
    const id = round.tokens[i]!;
    start();
    const ok = targetOf(id) === target;
    const doubled = ok && expiring.has(id) && expiryDoubleActive(leftRef.current, round.timeMs);
    const streakBefore = (() => {
      let n = 0;
      for (let k = dropsRef.current.length - 1; k >= 0 && dropsRef.current[k]; k--) n++;
      return n;
    })();
    dropsRef.current = [...dropsRef.current, ok];
    setSelected(null);
    setHover(null);
    if (ok) {
      if (doubled) doubledRef.current.add(placedRef.current.size);
      placedRef.current = new Set(placedRef.current).add(i);
      setPlaced(placedRef.current);
      setHint(null);
      const pts = pointsFor(streakBefore, doubled);
      const streakNow = streakBefore + 1;
      AudioManager.playSfx(
        streakNow === 3 || streakNow === 5 || streakNow === 8 ? "sortCombo" : "sortPlace",
      );
      if (streakNow === 3) say("Nice! 🔥 Keep going", "good", 1600);
      else if (streakNow === 5) say("Great sorting! 🔥🔥", "good", 1600);
      else if (streakNow === 8) say("Unstoppable! 🔥🔥🔥", "good", 1600);
      else if (placedRef.current.size === round.tokens.length - 1) say("Last one!", "good", 1500);
      if (!reducedMotion) {
        const key = ++popKey.current;
        setPops((p) => [...p.slice(-4), { key, text: `+${pts}${doubled ? " ×2" : ""}`, target }]);
        window.setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 900);
      }
      if (placedRef.current.size >= round.tokens.length) finish(leftRef.current);
    } else {
      AudioManager.playSfx("sortWrong");
      setWrongId(i);
      window.setTimeout(() => setWrongId(null), 450);
      // Teach on a miss: say where it really goes (always, at every level: the points are lost, the lesson is free).
      const home = TARGETS.find((t) => t.id === targetOf(id));
      say(`${INGREDIENTS[id].name} goes in: ${home?.label ?? "another shelf"}`, "bad", 3000);
      if (hintMode === "after-miss") {
        setHint(targetOf(id));
        window.setTimeout(() => setHint(null), 2500);
      }
    }
    setTick((n) => n + 1);
  };

  // ── pointer handling on a piece ──
  const onTokenDown = (e: React.PointerEvent, i: number) => {
    if (phaseRef.current !== "ready" && phaseRef.current !== "playing") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    gestureRef.current = { i, x0: e.clientX, y0: e.clientY, moved: false };
  };
  const onTokenMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < DRAG_PX) return;
    if (!g.moved) {
      g.moved = true;
      start();
      AudioManager.playSfx("sortPick");
      setSelected(g.i);
    }
    setDrag({ i: g.i, x: e.clientX, y: e.clientY });
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
    if (target) resolveDrop(g.i, target);
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
    doubledRef.current = new Set();
    placedRef.current = new Set();
    doneRef.current = false;
    leftRef.current = r.timeMs;
    lastTickRef.current = 0;
    setPlaced(new Set());
    setMsLeft(r.timeMs);
    setResult(null);
    setNote(null);
    setPractice(true);
    setPhaseBoth("ready");
  };
  const nextCrate = () => {
    const next = roundFor(save, playerLevel);
    dropsRef.current = [];
    doubledRef.current = new Set();
    placedRef.current = new Set();
    doneRef.current = false;
    leftRef.current = next?.timeMs ?? 0;
    lastTickRef.current = 0;
    setRound(next);
    setExpiring(next ? expiringTokens(save, next.tokens, playerLevel) : new Set());
    setPlaced(new Set());
    setMsLeft(next?.timeMs ?? 0);
    setResult(null);
    setNote(null);
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

  const live = scoreRound(
    { drops: dropsRef.current, tokens: round.tokens.length, msLeft: 0 },
    doubledRef.current,
  );
  const maxScore = bestPossible(round.tokens.length, playerLevel, doublePieces);
  const progress = Math.min(1, live / Math.max(1, maxScore));
  const streak = (() => {
    let n = 0;
    for (let i = dropsRef.current.length - 1; i >= 0 && dropsRef.current[i]; i--) n++;
    return n;
  })();
  const shown = TARGETS.filter((t) => round.targets.includes(t.id));
  /** A full crate (8+ shelves, Level 44 and up): lower pieces and smaller tokens, so every shelf stays on screen. */
  const dense = shown.length >= 8;
  const crateLeft = round.tokens.filter((_, i) => !placed.has(i));
  const low = phase === "playing" && msLeft <= 8000;
  void tick;

  const targetBand = (t: (typeof TARGETS)[number]) => {
    const need = expected.get(t.id) ?? 0;
    const inside = tokens
      .map((id, i) => ({ id, i }))
      .filter((x) => placed.has(x.i) && targetOf(x.id) === t.id);
    // An empty shelf shows faded pictures of what lives here (hidden from Level 44, where the player is expected to know).
    const examples =
      inside.length === 0 && hintMode !== "never"
        ? zoneExamples(t.id, hintMode === "always" ? round.ingredients : [], 3)
        : [];
    const glow =
      (selected !== null && hintMode === "always" && targetOf(tokens[selected]!) === t.id) ||
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
          if (selected !== null) resolveDrop(selected, t.id);
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
            {t.label}
            {need > 0 ? ` ${inside.length}/${need}` : ""}
          </span>
          <span
            className={cn(
              "absolute flex flex-wrap items-end justify-center gap-0 text-[22px] leading-none",
              ART_ITEMS[artOf(t.id).kind],
            )}
          >
            {inside.slice(0, artOf(t.id).kind === "shelf" ? 12 : 8).map((x) => (
              <IngredientIcon
                key={x.i}
                id={x.id}
                fallback={INGREDIENT_EMOJI[x.id]}
                className="h-[1.25em] w-[1.25em] -mx-[3px]"
              />
            ))}
            {examples.map((id) => (
              <IngredientIcon
                key={id}
                id={id}
                fallback={INGREDIENT_EMOJI[id]}
                className="h-[1.15em] w-[1.15em] opacity-60 saturate-75"
              />
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
      style={{
        backgroundImage: `url(${fsUrl("kitchen-wall")})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
      }}
      data-testid="fridge-sort"
      data-phase={phase}
      data-practice={practice ? "1" : "0"}
      data-tokens={round.tokens.length}
      data-left={crateLeft.length}
    >
      {/* HUD: pause, clock and score on the painted wooden plaques */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={pause}
          aria-label="Pause"
          data-testid="sort-pause"
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-[18px] text-gold"
        >
          <Art name="hud-round" className="absolute inset-0 h-full w-full object-fill" />
          <span className="relative">⏸</span>
        </button>
        <Plaque
          testId="sort-timer"
          className={cn(
            "h-12 min-w-0 flex-1 font-ui text-[22px] font-black tabular-nums",
            low ? "text-tomato" : "text-ivory",
          )}
        >
          <span aria-hidden>⏱</span> {clock(msLeft)}
        </Plaque>
        <Plaque
          testId="sort-score"
          className="h-12 min-w-[104px] px-2 font-ui text-[16px] font-black tabular-nums text-ivory"
        >
          <span aria-hidden className="text-gold">
            ★
          </span>
          {live.toLocaleString("en-US")}
        </Plaque>
      </div>
      {/* the star bar: the painted frame, a fill that grows with the score, and a star on each painted ring */}
      <div className="px-4 pt-2">
        <div className="relative mx-auto aspect-[480/72] w-full max-w-[420px]" aria-hidden>
          <Art name="starbar-frame" className="absolute inset-0 h-full w-full object-fill" />
          <div
            className="absolute overflow-hidden rounded-full"
            style={{
              left: `${BAR_LEFT * 100}%`,
              right: `${(1 - BAR_RIGHT) * 100}%`,
              top: "27%",
              bottom: "27%",
            }}
          >
            <Art
              name="starbar-fill"
              className="h-full w-full object-fill transition-[clip-path] duration-200"
              style={{
                clipPath: `inset(0 ${(100 - ((barX(progress) - BAR_LEFT) / (BAR_RIGHT - BAR_LEFT)) * 100).toFixed(1)}% 0 0)`,
              }}
            />
          </div>
          {STAR_AT.map((s, i) => (
            <Art
              key={i}
              name={progress >= s ? "star-full" : "star-empty"}
              className={cn(
                "absolute top-1/2 h-[62%] w-auto -translate-x-1/2 -translate-y-1/2",
                progress >= s && "drop-shadow-[0_0_4px_rgba(255,214,90,0.9)]",
              )}
              style={{ left: `${BAR_MARKS[i]! * 100}%` }}
            />
          ))}
        </div>
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
            data-testid="sort-note"
            aria-live="polite"
          >
            {note
              ? note.text
              : selected !== null
                ? `${INGREDIENTS[tokens[selected]!].name}: tap or drag it to its shelf`
                : phase === "ready"
                  ? "Pick a piece from the basket 👇"
                  : practice
                    ? "Practice · no reward"
                    : `${crateLeft.length} left in the basket`}
          </p>
          <span data-testid="sort-combo" className="text-[12px] font-bold text-ivory/80">
            {streak >= 2
              ? `🔥 ×${comboMultiplier(streak)
                  .toFixed(2)
                  .replace(/\.?0+$/, "")}`
              : ""}
          </span>
          <button
            type="button"
            data-testid="sort-help"
            aria-label="How to play"
            onClick={() => setGuide(true)}
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#d6b46a] bg-walnut-dark text-[16px] font-black text-gold"
          >
            ?
          </button>
        </div>
      </div>

      {/* the fridge */}
      <div className="mx-3 mt-2 min-h-0 flex-1 overflow-y-auto rounded-[26px] border-4 border-[#b9773a] bg-[radial-gradient(ellipse_at_50%_0%,#fde7b0,#f0c377_55%,#e2a65a)] p-2 shadow-inner">
        <div className="grid grid-cols-2 gap-2" data-testid="sort-targets">
          {shown.map(targetBand)}
        </div>
      </div>

      {/* the delivery slip: what was bought, and how many loose pieces that is (1 lb of tomato is about 3 tomatoes) */}
      <div
        className="mx-3 mt-2 flex items-center gap-1.5 overflow-x-auto rounded-xl bg-[#3b2a1d]/75 px-2 py-1"
        data-testid="sort-slip"
      >
        <span className="shrink-0 font-ui text-[11px] font-extrabold text-ivory/80">
          🧾 Delivery
        </span>
        {round.ingredients.map((id) => (
          <span
            key={id}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#fff7e6]/90 px-1.5 py-0.5 font-ui text-[11px] font-black text-walnut-dark"
          >
            <IngredientIcon
              id={id}
              fallback={INGREDIENT_EMOJI[id]}
              className="h-[1.5em] w-[1.5em]"
            />
            ×{tokens.filter((t) => t === id).length}
          </span>
        ))}
        {basketsLeft(save, playerLevel) > 1 ? (
          <span
            className="shrink-0 font-ui text-[11px] font-bold text-ivory/80"
            data-testid="sort-more-baskets"
          >
            🧺 +{basketsLeft(save, playerLevel) - 1} more basket
            {basketsLeft(save, playerLevel) - 1 === 1 ? "" : "s"} · ⚡ bonus for all
          </span>
        ) : null}
      </div>

      {/* the basket: every piece of the delivery lies mixed on the cloth */}
      <div
        className="relative mx-auto mb-3 mt-1 aspect-[1.5] w-[calc(100%-24px)] max-w-[340px]"
        data-testid="sort-crate"
      >
        <Art name="basket" className="absolute inset-0 h-full w-full object-fill" />
        {tokens.map((id, i) => {
          if (placed.has(i)) return null;
          const isSel = selected === i;
          const dragging = drag?.i === i;
          const spot = pile[i]!;
          const first =
            guide === false &&
            phase === "ready" &&
            !practice &&
            i === 0 &&
            (fridgeSortOf(save).rounds ?? 0) === 0;
          return (
            <button
              key={i}
              type="button"
              data-token={id}
              data-piece={i}
              data-expiring={expiring.has(id) ? "1" : undefined}
              data-testid={`sort-token-${id}`}
              aria-pressed={isSel}
              aria-label={`${INGREDIENTS[id].name}${expiring.has(id) ? " (expires soon, worth double)" : ""}${isSel ? " (selected)" : ""}`}
              onPointerDown={(e) => onTokenDown(e, i)}
              onPointerMove={onTokenMove}
              onPointerUp={onTokenUp}
              onPointerCancel={() => {
                gestureRef.current = null;
                setDrag(null);
                setHover(null);
              }}
              onClick={() => {
                if (draggedRef.current) return;
                // tap: pick it up (tap again to put it back); the clock starts with the first drop or drag, not a pick
                const next = isSel ? null : i;
                setSelected(next);
                if (next !== null) AudioManager.playSfx("sortPick");
              }}
              className={cn(
                "absolute grid touch-none place-items-center rounded-full leading-none transition-transform",
                isSel && "z-20 -translate-y-1.5 scale-110 drop-shadow-[0_6px_6px_rgba(0,0,0,0.35)]",
                dragging && "opacity-35",
                first && !reducedMotion && "animate-pulse",
                wrongId === i && !reducedMotion && "animate-[sortShake_0.4s_ease-in-out]",
              )}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: spot.size,
                height: spot.size,
                marginLeft: -spot.size / 2,
                marginTop: -spot.size / 2,
                zIndex: isSel ? 20 : 1 + (i % 7),
                transform: isSel ? undefined : `rotate(${spot.rot}deg)`,
                fontSize: spot.size,
              }}
            >
              <IngredientIcon
                id={id}
                fallback={INGREDIENT_EMOJI[id]}
                className="h-[0.95em] w-[0.95em] drop-shadow-[0_2px_2px_rgba(60,30,10,0.45)]"
              />
              {isSel ? (
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-walnut-dark px-2 py-0.5 font-ui text-[11px] font-extrabold leading-none text-ivory">
                  {INGREDIENTS[id].name}
                </span>
              ) : null}
              {expiring.has(id) ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute -right-1 -top-1 rounded-full border border-[#c0392b] bg-[#fff1d6] px-1 font-ui text-[10px] font-black leading-[16px] text-[#c0392b]",
                    expiryDoubleActive(msLeft, round.timeMs) ? "" : "opacity-40",
                  )}
                >
                  ⏳×2
                </span>
              ) : null}
            </button>
          );
        })}
        {/* the basket's front: it covers the lower part of the pieces, so they sit INSIDE it */}
        <Art
          name="basket"
          className="absolute inset-0 h-full w-full object-fill"
          style={{ clipPath: "inset(56% 0 0 0)", zIndex: 30 }}
        />
        {crateLeft.length === 0 && phase !== "done" ? (
          <span className="absolute inset-x-0 top-[28%] z-30 text-center font-ui text-[14px] font-extrabold text-walnut-dark">
            Empty ✓
          </span>
        ) : (
          <span
            className="absolute bottom-[10%] left-1/2 z-40 -translate-x-1/2 rounded-full bg-walnut-dark/85 px-3 py-0.5 font-ui text-[12px] font-extrabold text-ivory"
            data-testid="sort-ready"
          >
            {crateLeft.length} piece{crateLeft.length === 1 ? "" : "s"}
          </span>
        )}
        {guide === false &&
        selected === null &&
        phase === "ready" &&
        (fridgeSortOf(save).rounds ?? 0) === 0 &&
        !practice ? (
          <PointerHand size={44} className="absolute left-[18%] top-[20%] z-40" />
        ) : null}
      </div>

      {/* the piece under the finger */}
      {drag ? (
        <div
          className="pointer-events-none absolute z-50 grid h-[64px] w-[64px] -translate-x-1/2 -translate-y-[75%] place-items-center text-[60px] leading-none"
          style={ghostPosition(rootRef.current, drag.x, drag.y)}
          aria-hidden
        >
          <IngredientIcon
            id={tokens[drag.i]!}
            fallback={INGREDIENT_EMOJI[tokens[drag.i]!]}
            className="h-[1em] w-[1em] drop-shadow-[0_8px_8px_rgba(0,0,0,0.45)]"
          />
          <span className="absolute -top-6 whitespace-nowrap rounded-full bg-walnut-dark px-2 py-0.5 font-ui text-[11px] font-extrabold leading-none text-ivory">
            {INGREDIENTS[tokens[drag.i]!].name}
          </span>
        </div>
      ) : null}

      {/* how to play: shown by itself the first time, and from the ? button */}
      {guide ? (
        <div
          className="absolute inset-0 z-[60] grid place-items-center bg-black/75 p-5"
          data-testid="sort-guide"
        >
          <div className="w-full max-w-[330px] rounded-3xl border-4 border-[#b8873f] bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">
              Put the food away
            </p>
            <ol className="mt-3 grid gap-2 text-left font-ui text-[14px] font-bold text-walnut-dark">
              <li className="flex items-center gap-2.5 rounded-xl bg-white/50 p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper/15 text-[20px]">
                  🧺
                </span>
                <span>
                  What you bought is mixed in the basket. 1 lb of tomatoes is about 3 tomatoes.
                </span>
              </li>
              <li className="flex items-center gap-2.5 rounded-xl bg-white/50 p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper/15 text-[20px]">
                  👆
                </span>
                <span>Pick a piece (its name shows), then drag it or tap its shelf.</span>
              </li>
              <li className="flex items-center gap-2.5 rounded-xl bg-white/50 p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper/15 text-[20px]">
                  ❄️
                </span>
                <span>
                  Each shelf shows pictures of what lives there. Right = points and combos.
                </span>
              </li>
              <li className="flex items-center gap-2.5 rounded-xl bg-white/50 p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-copper/15 text-[20px]">
                  ⭐
                </span>
                <span>Two or three stars keep your food fresh longer, and add Hype.</span>
              </li>
            </ol>
            <p className="mt-2 font-ui text-[12px] font-bold text-walnut/70">
              The clock starts at your first move. Mistakes are free.
            </p>
            <div className="mt-3">
              <SortButton onClick={() => setGuide(false)} testId="sort-guide-ok">
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
                ? "Perfectly sorted!"
                : result.stars > 0
                  ? "Put away!"
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
              data-testid="sort-final-score"
            >
              {result.score.toLocaleString("en-US")}
              {result.effects.newBest ? (
                <span className="ml-1.5 text-copper">new best!</span>
              ) : null}
            </p>
            {practice ? (
              <p className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
                Practice: no reward
              </p>
            ) : (
              <p
                className="relative mt-1 font-ui text-[13px] font-extrabold text-olive"
                data-testid="sort-reward"
              >
                {result.effects.hype > 0 ? `⚡ +${result.effects.hype} Hype` : "No Hype this time"}
                {result.effects.magnet ? " · 🧲 new fridge magnet!" : ""}
              </p>
            )}
            {!practice && (result.effects.bigHype ?? 0) > 0 ? (
              <p
                className="relative mt-1 font-ui text-[13px] font-extrabold text-copper"
                data-testid="sort-big-delivery"
              >
                🎉 Whole delivery put away ({result.effects.baskets} baskets): ⚡ +
                {result.effects.bigHype} Hype
              </p>
            ) : null}
            {!practice && roundFor(save, playerLevel) && (result.effects.baskets ?? 0) > 0 ? (
              <p
                className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut-dark"
                data-testid="sort-chain"
              >
                🧺 {basketsLeft(save, playerLevel)} more basket
                {basketsLeft(save, playerLevel) === 1 ? "" : "s"}: finish them all for ⚡ +
                {bigDeliveryHype((result.effects.baskets ?? 0) + basketsLeft(save, playerLevel))}{" "}
                Hype
              </p>
            ) : null}
            {!practice && (result.effects.freshened?.length ?? 0) > 0 ? (
              <p
                className="relative mt-1 flex flex-wrap items-center justify-center gap-1 font-ui text-[12.5px] font-extrabold text-walnut-dark"
                data-testid="sort-fresh"
              >
                <span>
                  🧊 Stays fresh +{result.effects.freshDays} day
                  {result.effects.freshDays === 1 ? "" : "s"}:
                </span>
                {result.effects.freshened!.slice(0, 6).map((id) => (
                  <IngredientIcon
                    key={id}
                    id={id}
                    fallback={INGREDIENT_EMOJI[id]}
                    className="h-[1.6em] w-[1.6em]"
                  />
                ))}
              </p>
            ) : null}
            {!practice && result.effects.magnet ? (
              <Art
                name={`magnet-${String(Math.max(1, magnetsOf(save))).padStart(2, "0")}`}
                className="relative mx-auto mt-1 h-[52px] w-[52px]"
              />
            ) : null}
            <div className="relative mt-3 grid gap-2">
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
