import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { INGREDIENTS } from "@/game/definitions";
import { PointerHand } from "@/components/kc/common/PointerHand";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { InfoTip } from "@/components/kc/common/InfoTip";
import type { SaveData } from "@/game/SaveManager";
import { piecesWaiting } from "@/game/business/fridgeSort";
import {
  CRATE_H,
  CRATE_ART_H,
  CRATE_ART_TOP,
  CRATE_W,
  PILE_BOTTOM,
  WALL_TOP,
  DECOY_LABEL,
  DEFECT_LABEL,
  INSPECTION_TIERS,
  MARK_SCALE,
  STAR_MARKS,
  WRONG_PENALTY_MS,
  deliveriesTag,
  findPoints,
  howtoDue,
  isDefective,
  pinsOf,
  progressOf,
  roundCrate,
  pendingInspections,
  roundsLeft,
  scoreRound,
  starsFor,
  tierAt,
  NO_EFFECTS,
  type CrateItem,
  type DecoyKind,
  type DefectKind,
  type DeliveryInspectionAction,
  type DeliveryInspectionResult,
  type RoundEffects,
} from "@/game/business/deliveryInspection";
import { Art, Plaque, SortButton, StarBar } from "./sort/SortParts";
import { clock } from "./sort/sortUtils";
import { BlendedMark, MarkArt, MarkerArt, PinArt } from "./inspection/InspectionParts";
import { inspUrl, useArt, useMarkers } from "./inspection/inspectionArt";
import { useLandscape } from "@/components/kc/game/layoutMode";
import { landscapeGameArt } from "@/game/landscapeArt";

/**
 * DELIVERY INSPECTION — the screen (rules: business/deliveryInspection.ts, plan: docs/planning/DELIVERY-INSPECTION-MINIGAME-PLAN-2026-11-08.md).
 * A crate of mixed ingredients is tipped on the bench; some are NOT FRESH. TAP an ingredient to flag it, DRAG one aside to look behind it, hold the
 * MAGNIFIER over a spot to see tiny defects. A wrong flag costs 4 seconds and the combo. The game never moves money or stock: the effects are the
 * stars, Hype and the Sharp Eye pins. Reduced Motion: no shake, no stamp pop, no pulse.
 */

type Phase = "ready" | "playing" | "paused" | "reveal" | "done";
const DRAG_PX = 10;
const HINT_AFTER_MS = 12_000;

type Note = { text: string; tone: "good" | "bad" | "info" };

/** How long a found piece keeps its NOT FRESH stamp before it is taken out of the crate. */
const FOUND_LEAVES_MS = 650;

/** How much duller and browner a spoiled ingredient looks all over: a big defect a lot, a tiny one not at all. */
const DULL: Record<string, number> = { big: 0.5, medium: 0.36, small: 0.2, tiny: 0 };
function dullness(it: CrateItem): string | undefined {
  if (it.mark?.type !== "defect") return undefined;
  const k = DULL[it.mark.size] ?? 0;
  return k > 0
    ? `saturate(${(1 - 0.45 * k).toFixed(2)}) sepia(${(0.5 * k).toFixed(2)}) brightness(${(1 - 0.12 * k).toFixed(2)})`
    : undefined;
}

export function DeliveryInspectionGame(props: {
  save: SaveData;
  playerLevel: number;
  reducedMotion: boolean;
  onAction: (a: DeliveryInspectionAction) => DeliveryInspectionResult;
  /** Go and unpack the delivery (Fridge Sort). */
  onUnpack: () => void;
  onExit: () => void;
  /** A Prep Cook is hired: he can do this inspection for the player (no stars, no reward). */
  hasPrepCook?: boolean;
}) {
  // "Play again" and "Next inspection" start a new round with its own state.
  const [attempt, setAttempt] = useState(0);
  /** Restart from the pause card: the same crate from the top (no new attempt, so the same items). */
  const [restarts, setRestarts] = useState(0);
  const [practice, setPractice] = useState(false);
  return (
    <Round
      key={`${attempt}-${restarts}`}
      {...props}
      attempt={attempt}
      forcePractice={practice}
      onRestart={() => setRestarts((n) => n + 1)}
      onAgain={() => {
        setPractice(true);
        setAttempt((n) => n + 1);
      }}
      onNext={() => {
        setPractice(false);
        setAttempt((n) => n + 1);
      }}
    />
  );
}

function Round({
  save,
  playerLevel: level,
  reducedMotion,
  onAction,
  onUnpack,
  onExit,
  hasPrepCook = false,
  attempt,
  forcePractice,
  onAgain,
  onRestart,
  onNext,
}: {
  save: SaveData;
  playerLevel: number;
  reducedMotion: boolean;
  onAction: (a: DeliveryInspectionAction) => DeliveryInspectionResult;
  onUnpack: () => void;
  onExit: () => void;
  hasPrepCook?: boolean;
  attempt: number;
  forcePractice: boolean;
  onAgain: () => void;
  onRestart: () => void;
  onNext: () => void;
}) {
  const tier = tierAt(level);
  // A round with no delivery waiting (or past today's five) is free play: it scores, but gives nothing.
  // Latched when the round starts: finishing it changes the save (that basket is counted), never this round.
  const [practice] = useState(() => forcePractice || roundsLeft(save, level) === 0);
  // Checking the delivery is mandatory (developer 2026-11-11): past today's rewarded rounds a round still counts as the check of a basket
  // (it just gives nothing), so the delivery can always be finished and unpacked.
  const [counts] = useState(
    () => roundsLeft(save, level) === 0 && pendingInspections(save, level) > 0,
  );
  const crate = useMemo(
    () => roundCrate(save, level, practice ? attempt + 1 : 0)!,
    // The crate is dealt ONCE as the game opens (finishing changes the save, never the crate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [items, setItems] = useState<CrateItem[]>(() => crate.items.map((i) => ({ ...i })));
  const [lift, setLift] = useState<Record<number, number>>({});
  const [found, setFound] = useState<ReadonlySet<number>>(new Set());
  const [cleared, setCleared] = useState<ReadonlySet<number>>(new Set());
  /** Found bad food that has left the crate (developer 2026-11-13): the stamp shows for a moment, then the piece is taken out, so what lay behind it is in view. */
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set());
  const [shake, setShake] = useState<number | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [guide, setGuide] = useState(howtoDue(save, crate.tier));
  const [msLeft, setMsLeft] = useState(crate.timeMs);
  const [wrongs, setWrongs] = useState(0);
  const [live, setLive] = useState(0);
  const [lensOn, setLensOn] = useState(false);
  const [lensMs, setLensMs] = useState(crate.lensMs);
  const [lensAt, setLensAt] = useState<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [result, setResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    found: number;
    timedOut: boolean;
    effects: RoundEffects;
  } | null>(null);

  const total = crate.defects;
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const streak = useRef(0);
  const finds = useRef<number[]>([]);
  const msRef = useRef(crate.timeMs);
  const lastFind = useRef(0);
  const doneRef = useRef(false);
  const liftN = useRef(0);
  // What the round has counted so far, for end(): the timer's closure is made once and must never read an old render's state.
  const foundRef = useRef<ReadonlySet<number>>(new Set());
  const wrongsRef = useRef(0);

  // ── the clock ──
  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();
    const t = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      msRef.current = Math.max(0, msRef.current - dt);
      setMsLeft(msRef.current);
      if (lensOn) setLensMs((m) => Math.max(0, m - dt));
      lastFind.current += dt;
      if (tier.hint && lastFind.current > HINT_AFTER_MS && hint === null) {
        const target = items.find((it) => isDefective(it) && !it.hidden && !found.has(it.id));
        if (target) setHint(target.id);
      }
      if (msRef.current <= 0) end(true);
    }, 100);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lensOn, hint, found]);
  useEffect(() => {
    if (lensMs <= 0 && lensOn) setLensOn(false);
  }, [lensMs, lensOn]);

  const end = useCallback(
    (timedOut: boolean, foundNow?: number, wrongsNow?: number) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const f = foundNow ?? foundRef.current.size;
      const w = wrongsNow ?? wrongsRef.current;
      const r = { found: f, total, wrongs: w, msLeft: msRef.current, timeMs: crate.timeMs };
      const stars = starsFor(r);
      const score = scoreRound(finds.current, r);
      let effects: RoundEffects = NO_EFFECTS;
      if (!practice) {
        const out = onAction({
          kind: "finish",
          outcome: { stars, score, found: f, total },
        });
        if (out.ok) effects = out.effects;
      } else if (counts) {
        onAction({
          kind: "finish",
          outcome: { stars, score, found: f, total, practice: true, counts: true },
        });
      }
      const missed = f < total;
      setResult({ stars, score, found: f, timedOut, effects });
      setLive(score);
      if (missed) {
        setPhase("reveal");
        window.setTimeout(() => setPhase("done"), reducedMotion ? 600 : 1600);
      } else {
        window.setTimeout(() => setPhase("done"), reducedMotion ? 200 : 700);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [practice, counts, crate, total],
  );

  const start = () => {
    if (phase !== "ready") return;
    lastFind.current = 0;
    setPhase("playing");
    onAction({ kind: "start", items: items.length, defects: total, practice });
  };
  const pause = () => {
    // Before Start the clock is not running: the button is a Back arrow.
    if (phase === "ready") {
      onAction({ kind: "skip" });
      onExit();
      return;
    }
    if (phase === "playing") setPhase("paused");
  };
  const resume = () => phase === "paused" && setPhase("playing");

  // ── flagging ──
  const flag = (id: number) => {
    // (the round is over the moment the last defect is found, even while the card still waits to show: a late tap counts for nothing)
    if (phase !== "playing" || doneRef.current || found.has(id) || cleared.has(id)) return;
    const it = items.find((x) => x.id === id)!;
    if (isDefective(it)) {
      const m = it.mark as Extract<typeof it.mark, { type: "defect" }>;
      const pts = findPoints(streak.current);
      finds.current.push(streak.current);
      streak.current += 1;
      const nextFound = new Set(foundRef.current).add(id);
      foundRef.current = nextFound;
      setFound(nextFound);
      window.setTimeout(() => setGone((g) => new Set(g).add(id)), FOUND_LEAVES_MS);
      setLive((s) => s + pts);
      lastFind.current = 0;
      setHint(null);
      setNote({
        tone: "good",
        text: `✓ ${DEFECT_LABEL[m!.kind]} ${INGREDIENTS[it.ingredient].name.toLowerCase()}!`,
      });
      AudioManager.playSfx(streak.current >= 3 ? "sortCombo" : "sortPlace");
      if (nextFound.size >= total) end(false, nextFound.size);
    } else {
      streak.current = 0;
      setCleared((c) => new Set(c).add(id));
      const w = wrongsRef.current + 1;
      wrongsRef.current = w;
      setWrongs(w);
      setShake(id);
      window.setTimeout(() => setShake((s) => (s === id ? null : s)), 450);
      msRef.current = Math.max(0, msRef.current - WRONG_PENALTY_MS);
      setMsLeft(msRef.current);
      setNote({
        tone: "bad",
        text:
          it.mark?.type === "decoy"
            ? `Just ${DECOY_LABEL[it.mark.kind].toLowerCase()}: it's fine! −4 s`
            : "This one is fine! −4 s",
      });
      AudioManager.playSfx("sortWrong");
      if (msRef.current <= 0) end(true, foundRef.current.size, w);
    }
  };

  // ── dragging an ingredient aside ──
  const unit = () => (areaRef.current?.getBoundingClientRect().width ?? 500) / CRATE_W;
  const onDown = (e: React.PointerEvent, it: CrateItem) => {
    if (phase !== "playing" || doneRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (rect && lensOn) setLensAt({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!d.moved) {
      d.moved = true;
      liftN.current += 1;
      setLift((l) => ({ ...l, [d.id]: 1000 + liftN.current }));
    }
    const u = unit();
    setItems((list) =>
      list.map((x) =>
        x.id !== d.id
          ? x
          : {
              ...x,
              x: Math.min(CRATE_W - x.size / 2 - 3, Math.max(x.size / 2 + 3, d.ox + dx / u)),
              y: Math.min(PILE_BOTTOM - x.size / 2 + 6, Math.max(x.size / 2 + 2, d.oy + dy / u)),
            },
      ),
    );
  };
  const onUp = (it: CrateItem) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) flag(it.id);
  };

  // ── what to draw ──
  const left = total - found.size;
  const progress = progressOf({ found: found.size, total, wrongs, msLeft, timeMs: crate.timeMs });
  const low = msLeft <= 10_000 && phase === "playing";
  const tag = deliveriesTag(save, level);
  // "Deliveries 2/5": the round being played (a finished one is already counted in the save).
  const roundNo =
    practice || phase === "done" || phase === "reveal"
      ? tag.done
      : Math.min(tag.total, tag.done + 1);
  const lensBtn = tier.lensSec > 0;
  const reveal = phase === "reveal" || phase === "done";
  const crateBack = useArt("crate-back");
  const crateFront = useArt("crate-front");
  const hasBackdrop = useArt("backdrop");
  // LANDSCAPE (developer 2026-11-20: every game in full landscape): the wide room behind, the HUD in a column on the left, the crate in the middle at the window's height, the
  // note and the magnifier in a column on the right. Portrait is as it was.
  const wide = useLandscape();
  const markersArt = useMarkers();
  const glassArt = useArt("magnifier");
  const zOf = (it: CrateItem) => it.layer * 100 + it.id + (lift[it.id] ?? 0);

  const itemView = (it: CrateItem, lens: boolean) => {
    const isFound = found.has(it.id);
    const isGone = gone.has(it.id);
    const missed = reveal && isDefective(it) && !isFound;
    const tiny = it.mark?.type === "defect" && it.mark.size === "tiny";
    return (
      <div
        key={`${lens ? "l" : "i"}${it.id}`}
        data-testid={lens ? undefined : "insp-item"}
        data-id={it.id}
        data-ingredient={it.ingredient}
        data-defect={isDefective(it) ? "1" : "0"}
        data-found={isFound ? "1" : "0"}
        data-gone={isGone ? "1" : "0"}
        data-hidden={it.hidden ? "1" : "0"}
        {...(lens
          ? {}
          : {
              role: "button",
              tabIndex: 0,
              "aria-label": `${INGREDIENTS[it.ingredient].name}: flag as not fresh`,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  flag(it.id);
                }
              },
            })}
        className={cn(
          "absolute rounded-full",
          !lens && "touch-none cursor-grab active:cursor-grabbing",
          !lens && shake === it.id && !reducedMotion && "insp-shake",
        )}
        style={{
          left: `${it.x - it.size / 2}%`,
          top: `${((it.y - it.size / 2) / CRATE_H) * 100}%`,
          width: `${it.size}%`,
          aspectRatio: "1",
          zIndex: zOf(it),
          transform: `rotate(${it.tilt}deg)${isGone ? " scale(0.6)" : ""}`,
          opacity: isGone ? 0 : 1,
          transition: reducedMotion ? undefined : "opacity 260ms ease-in, transform 260ms ease-in",
          pointerEvents: lens || isGone ? "none" : "auto",
        }}
        {...(lens
          ? {}
          : {
              onPointerDown: (e: React.PointerEvent) => onDown(e, it),
              onPointerUp: () => onUp(it),
              onPointerCancel: () => {
                drag.current = null;
              },
            })}
      >
        {/* a spoiled ingredient is also a little duller and browner all over (more for a big defect), so the mark is part of the food */}
        <span className="pointer-events-none block h-full w-full" style={{ filter: dullness(it) }}>
          <IngredientIcon
            id={it.ingredient}
            fallback={<span className="text-[28px]">🥬</span>}
            className="pointer-events-none !h-full !w-full object-contain drop-shadow-[0_3px_3px_rgba(40,20,5,0.45)]"
          />
        </span>
        {it.mark ? (
          <BlendedMark
            ingredient={it.ingredient}
            mark={it.mark}
            scale={MARK_SCALE[it.mark.size]}
            style={{ opacity: tiny && !lens && !isFound && !missed ? 0.3 : 1 }}
          />
        ) : null}
        {!lens && (isFound || missed) ? (
          <span
            aria-hidden
            data-testid={isFound ? "insp-stamp" : "insp-missed"}
            className={cn(
              "pointer-events-none absolute -inset-[8%]",
              !markersArt && "rounded-full border-[3px]",
              !markersArt && (isFound ? "border-[#d23b2a]" : "border-dashed border-[#ff8a3d]"),
              !reducedMotion && (isFound ? "insp-pop" : "animate-pulse"),
            )}
          >
            {markersArt ? <MarkerArt cell={isFound ? 0 : 2} /> : null}
            {isFound ? (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 -rotate-6 whitespace-nowrap rounded bg-[#d23b2a] px-1 font-ui text-[11px] font-black leading-[14px] text-white">
                {it.mark?.type === "defect"
                  ? DEFECT_LABEL[it.mark.kind].toUpperCase()
                  : "NOT FRESH"}
              </span>
            ) : null}
          </span>
        ) : null}
        {!lens && cleared.has(it.id) ? (
          <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 h-6 w-6">
            {markersArt ? (
              <MarkerArt cell={3} />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#3f7d2c] text-[12px] font-black text-white">
                ✓
              </span>
            )}
          </span>
        ) : null}
        {/* The wrong tap names what the mark was (developer 2026-11-16: "can't identify which is dirt and which is fungus"). */}
        {!lens && cleared.has(it.id) && it.mark?.type === "decoy" ? (
          <span
            aria-hidden
            data-testid="insp-fine-label"
            className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#3f7d2c] px-1.5 font-ui text-[11px] font-black leading-[14px] text-white"
          >
            {DECOY_LABEL[it.mark.kind]}: fine
          </span>
        ) : null}
        {!lens && hint === it.id ? (
          // (Reduced Motion: the same ring, still; the hint must never disappear)
          <span
            aria-hidden
            data-testid="insp-hint"
            className={cn(
              "pointer-events-none absolute -inset-[10%] rounded-full border-[3px] border-[#ffd35a]",
              !reducedMotion && "animate-pulse",
            )}
          />
        ) : null}
      </div>
    );
  };

  const lensSize = 112;
  const areaW = areaRef.current?.getBoundingClientRect().width ?? 500;

  return (
    <div
      className="absolute inset-0 z-[100] flex touch-none select-none flex-col overflow-hidden bg-[linear-gradient(180deg,#5b3a22,#3a2417)] [container-type:size] land:grid land:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] land:grid-rows-[auto_auto_1fr]"
      style={
        wide
          ? {
              backgroundImage: `url(${landscapeGameArt("delivery-inspection")})`,
              backgroundSize: "cover",
              backgroundPosition: "center bottom",
            }
          : hasBackdrop
            ? {
                backgroundImage: `url(${inspUrl("backdrop")})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
      }
      data-testid="delivery-inspection"
      data-phase={phase}
      data-practice={practice ? "1" : "0"}
      data-total={total}
      data-found={found.size}
      data-tier={crate.tier}
    >
      <style>{`
        @keyframes insp-shake{0%,100%{translate:0}20%{translate:-5px}40%{translate:5px}60%{translate:-4px}80%{translate:3px}}
        .insp-shake{animation:insp-shake .42s ease-in-out}
        @keyframes insp-pop{0%{transform:scale(1.6);opacity:0}100%{transform:scale(1);opacity:1}}
        .insp-pop{animation:insp-pop .22s ease-out}
      `}</style>
      {/* HUD */}
      <div className="flex items-center gap-2 px-3 pt-3 land:col-start-1 land:row-start-1 land:px-5 land:pt-5">
        <button
          type="button"
          onClick={pause}
          aria-label={phase === "ready" ? "Back" : "Pause"}
          data-testid="insp-pause"
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-[18px] text-gold"
        >
          <Art name="hud-round" className="absolute inset-0 h-full w-full object-fill" />
          <span className="relative">{phase === "ready" ? "←" : "⏸"}</span>
        </button>
        <Plaque
          testId="insp-timer"
          className={cn(
            "h-12 min-w-0 flex-1 font-ui text-[22px] font-black tabular-nums",
            low ? "text-tomato" : "text-ivory",
          )}
        >
          <span aria-hidden>⏱</span> {clock(msLeft)}
        </Plaque>
        <Plaque
          testId="insp-score"
          className="h-12 min-w-[104px] px-2 font-ui text-[16px] font-black tabular-nums text-ivory"
        >
          <span aria-hidden className="text-gold">
            ★
          </span>
          {live.toLocaleString("en-US")}
        </Plaque>
      </div>
      <div className="px-4 pt-2 land:col-start-1 land:row-start-2 land:px-5 land:pt-3">
        <StarBar progress={progress} marks={STAR_MARKS} />
        <div className="mt-1.5 flex items-center gap-2 font-ui">
          <p
            className="min-w-0 flex-1 rounded-xl bg-[#2a170c]/85 px-2.5 py-1.5 text-center text-[14px] font-extrabold leading-tight text-ivory"
            data-testid="insp-goal"
          >
            {left > 0 ? (
              <>
                Find <b className="text-[#ffb347]">{left}</b> that {left > 1 ? "are" : "is"}{" "}
                <b className="text-[#ff6a4d]">NOT FRESH</b>
              </>
            ) : (
              "All found!"
            )}
          </p>
          <InfoTip tone="light" label="How to inspect">
            Tap what looks bad. Drag things aside to look behind them. A little dirt is fine.
          </InfoTip>
          <button
            type="button"
            data-testid="insp-help"
            aria-label="How to play"
            onClick={() => setGuide(true)}
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#e6b866] bg-[#3a2417] text-[16px] font-black text-[#ffe2a8]"
          >
            ?
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p
            className="flex items-center gap-1.5"
            data-testid="insp-slots"
            aria-label={`${found.size} of ${total} found`}
          >
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border-[3px] font-black text-[13px]",
                  i < found.size
                    ? "border-[#d23b2a] bg-[#d23b2a]/90 text-white"
                    : "border-[#e6b866] bg-[#2a170c]/60 text-transparent",
                )}
              >
                ✗
              </span>
            ))}
          </p>
          <p
            className="rounded-full bg-[#2a170c]/80 px-2.5 py-1 font-ui text-[12px] font-extrabold text-ivory"
            data-testid="insp-tag"
          >
            📦 Deliveries {roundNo}/{Math.max(1, tag.total)}
          </p>
        </div>
      </div>

      {/* the crate */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-1 land:col-start-2 land:row-span-3 land:row-start-1 land:h-full land:w-[min(calc(100cqh*1.25),max(48cqw,calc(100cqw-520px)))] land:flex-none land:px-0 land:py-3">
        <div
          className="relative isolate w-full max-w-[500px] land:max-w-none"
          style={{ aspectRatio: `${CRATE_W} / ${CRATE_H}` }}
        >
          {/* back of the crate (the painted crate sits at the bottom of the area: the pile rises above its rim) */}
          {crateBack ? (
            <img
              src={inspUrl("crate-back")}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-x-0 w-full object-fill"
              style={{
                top: `${(CRATE_ART_TOP / CRATE_H) * 100}%`,
                height: `${(CRATE_ART_H / CRATE_H) * 100}%`,
              }}
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-x-[2%] rounded-t-xl border-4 border-[#6b4423] bg-[linear-gradient(180deg,#d9c9a3,#b79c6a)] shadow-inner"
              style={{
                top: `${(CRATE_ART_TOP / CRATE_H) * 100}%`,
                height: `${(CRATE_ART_H / CRATE_H) * 100}%`,
              }}
            />
          )}
          <div
            ref={areaRef}
            className="absolute inset-0 overflow-hidden"
            onPointerMove={onMove}
            onPointerLeave={() => setLensAt(null)}
            data-testid="insp-crate"
          >
            {items.map((it) => itemView(it, false))}
          </div>
          {/* front wall */}
          {crateFront ? (
            <img
              src={inspUrl("crate-front")}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-x-0 z-[5000] w-full object-fill"
              style={{
                top: `${(WALL_TOP / CRATE_H) * 100}%`,
                height: `${((CRATE_ART_H * 300) / 520 / CRATE_H) * 100}%`,
              }}
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-x-0 z-[5000] rounded-b-lg border-4 border-[#4a2e17] bg-[repeating-linear-gradient(180deg,#a8742f 0 18%,#8d5d22 18% 22%)] shadow-lg"
              style={{
                top: `${(WALL_TOP / CRATE_H) * 100}%`,
                height: `${((CRATE_ART_H * 300) / 520 / CRATE_H) * 100}%`,
              }}
            />
          )}
          {/* the magnifier: a round window of the pile at 2x, held above the finger, in the painted brass glass when it exists */}
          {lensOn && lensAt ? (
            <div
              aria-hidden
              data-testid="insp-lens"
              className="pointer-events-none absolute z-[6000]"
              style={{
                width: lensSize,
                height: lensSize,
                left: lensAt.x - lensSize / 2,
                top: lensAt.y - lensSize / 2 - 50,
              }}
            >
              <div
                className={cn(
                  "absolute inset-0 overflow-hidden rounded-full",
                  !glassArt && "border-[5px] border-[#c9962f] shadow-[0_4px_14px_rgba(0,0,0,0.5)]",
                )}
                style={{ background: "#f1e3bf" }}
              >
                <div
                  className="absolute"
                  style={{
                    width: areaW * 2,
                    height: (areaW * 2 * CRATE_H) / CRATE_W,
                    left: lensSize / 2 - lensAt.x * 2,
                    top: lensSize / 2 - lensAt.y * 2,
                  }}
                >
                  {crateBack ? (
                    <img
                      src={inspUrl("crate-back")}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute inset-x-0 w-full object-fill"
                      style={{
                        top: `${(CRATE_ART_TOP / CRATE_H) * 100}%`,
                        height: `${(CRATE_ART_H / CRATE_H) * 100}%`,
                      }}
                    />
                  ) : null}
                  {items.map((it) => itemView(it, true))}
                </div>
              </div>
              {glassArt ? (
                <img
                  src={inspUrl("magnifier")}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none"
                  style={{
                    width: lensSize / 0.6,
                    height: lensSize / 0.6,
                    left: lensSize / 2 - (0.342 * lensSize) / 0.6,
                    top: lensSize / 2 - (0.342 * lensSize) / 0.6,
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* the Prep Cook watches; the magnifier */}
      <div className="flex items-center gap-2 px-3 pb-3 land:col-start-3 land:row-span-3 land:row-start-1 land:flex-col land:items-stretch land:justify-center land:gap-4 land:px-5 land:pb-0">
        <img
          src={`${import.meta.env.BASE_URL}business/staff-portraits/prep-cook.webp`}
          alt=""
          draggable={false}
          className="h-12 w-12 shrink-0 rounded-full border-2 border-[#e6b866] bg-[#3a2417] object-cover land:self-start"
        />
        <p
          className={cn(
            "min-w-0 flex-1 rounded-xl px-2.5 py-1.5 font-ui text-[12.5px] font-extrabold leading-tight land:flex-none land:px-4 land:py-3 land:text-[15px]",
            note?.tone === "bad"
              ? "bg-[#7a2a1d]/90 text-[#ffe1d6]"
              : note?.tone === "good"
                ? "bg-[#3f6b2c]/90 text-[#eaffd9]"
                : "bg-[#2a170c]/85 text-ivory",
          )}
          data-testid="insp-note"
          data-tone={note?.tone ?? "info"}
          aria-live="polite"
        >
          {note
            ? note.text
            : practice
              ? "Extra round · no reward"
              : "Tap bad food · drag fresh ones aside · 🔎 magnifies"}
          {streak.current >= 2 ? ` 🔥 ${streak.current}` : ""}
        </p>
        {lensBtn ? (
          <button
            type="button"
            data-testid="insp-lens-btn"
            aria-pressed={lensOn}
            disabled={lensMs <= 0 || phase !== "playing"}
            onClick={() => setLensOn((v) => !v)}
            className={cn(
              "press grid h-12 w-14 shrink-0 place-items-center rounded-2xl border-2 text-[20px] disabled:opacity-40 land:h-16 land:w-full",
              lensOn ? "border-[#ffd35a] bg-[#6b4a1a]" : "border-[#e6b866] bg-[#3a2417]",
            )}
          >
            <span aria-hidden>🔎</span>
            <span className="-mt-1 font-ui text-[11px] font-black tabular-nums text-ivory">
              {Math.ceil(lensMs / 1000)}s
            </span>
          </button>
        ) : null}
      </div>

      {/* ready */}
      {phase === "ready" && !guide ? (
        <div
          className="absolute inset-x-0 bottom-[84px] z-30 grid place-items-center px-6 land:inset-y-0 land:bottom-0"
          data-testid="insp-ready"
        >
          <div className="w-full max-w-[320px] rounded-3xl border-2 border-[#e6b866] bg-[#f7edd7] p-4 text-center shadow-lift">
            <p className="font-display text-[19px] font-extrabold text-walnut-dark">
              Delivery Inspection
            </p>
            <p className="mt-1 font-ui text-[13.5px] font-bold text-walnut/80">
              Find <b>{total}</b> NOT FRESH · {Math.round(crate.timeMs / 1000)} s
              {practice ? " · extra round" : ""}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-left font-ui text-[12.5px] font-bold text-walnut-dark">
              <li>👆 Tap the bad ones</li>
              <li>✋ Drag fresh food aside to look behind it</li>
              <li>🔎 Magnifier: slide over the pile to zoom in</li>
            </ul>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={start} testId="insp-start">
                Start
              </SortButton>
              {hasPrepCook && !practice ? (
                <SortButton
                  quiet
                  testId="insp-auto"
                  onClick={() => {
                    onAction({ kind: "auto" });
                    onExit();
                  }}
                >
                  🧑‍🍳 Prep Cook does it · no stars
                </SortButton>
              ) : null}
              <SortButton quiet onClick={onExit} testId="insp-leave">
                Not now
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* how to play */}
      {guide ? (
        <HowTo
          tierNumber={crate.tier}
          onDone={() => {
            setGuide(false);
            if (howtoDue(save, crate.tier)) onAction({ kind: "howto", tier: crate.tier });
          }}
        />
      ) : null}

      {/* pause */}
      {phase === "paused" ? (
        <div
          className="absolute inset-0 z-40 flex overflow-y-auto overscroll-contain bg-black/70 p-6"
          data-testid="insp-paused"
        >
          <div className="m-auto w-full max-w-[300px] rounded-3xl bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">Paused</p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={resume} testId="insp-resume">
                Resume
              </SortButton>
              <SortButton quiet testId="insp-restart" onClick={onRestart}>
                ↻ Restart
              </SortButton>
              <SortButton
                quiet
                testId="insp-skip"
                onClick={() => {
                  onAction({ kind: "skip" });
                  onExit();
                }}
              >
                Leave the inspection
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* the result */}
      {phase === "done" && result ? (
        <div
          className="absolute inset-0 z-40 flex overflow-y-auto overscroll-contain bg-black/70 p-5"
          data-testid="insp-result"
          data-stars={result.stars}
        >
          <div className="relative m-auto w-full max-w-[340px] px-[22px] pb-[50px] pt-[96px] text-center land:pb-[40px] land:pt-[80px]">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                borderStyle: "solid",
                borderWidth: "82px 17px 19px 17px",
                borderImage: `url(${import.meta.env.BASE_URL}business/fridge-sort/result-panel.webp) 124 26 29 26 fill / 82px 17px 19px 17px stretch`,
              }}
            />
            <p className="absolute inset-x-0 top-[34px] font-display text-[20px] font-extrabold text-[#fff3d6] [text-shadow:0_2px_3px_rgba(90,20,10,0.8)]">
              {result.timedOut
                ? "Time's up"
                : result.stars === 3
                  ? "Sharp eyes!"
                  : result.stars > 0
                    ? "Delivery checked!"
                    : "Look closer next time"}
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
              data-testid="insp-final-score"
            >
              {result.score.toLocaleString("en-US")}
              {result.effects.newBest ? (
                <span className="ml-1.5 text-copper">new best!</span>
              ) : null}
            </p>
            <p className="relative mt-0.5 font-ui text-[12.5px] font-bold text-walnut/70">
              Found {result.found} of {total}
              {wrongs > 0 ? ` · ${wrongs} wrong` : ""}
            </p>
            {practice ? (
              <p className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
                Extra round: no reward
              </p>
            ) : (
              <p
                className="relative mt-1 font-ui text-[13px] font-extrabold text-olive"
                data-testid="insp-reward"
              >
                {result.effects.hype > 0 ? `⚡ +${result.effects.hype} Hype` : "No Hype this time"}
                {result.effects.pin ? ` · 🎖️ new Sharp Eye pin!` : ""}
              </p>
            )}
            {!practice && result.effects.pin ? (
              <PinArt
                n={Math.max(1, pinsOf(save))}
                className="relative mx-auto mt-1 h-[48px] w-[48px]"
              />
            ) : null}
            {!practice && result.effects.streak >= 2 ? (
              <p className="relative mt-1 font-ui text-[12.5px] font-extrabold text-copper">
                🔥 {result.effects.streak} perfect inspections in a row
              </p>
            ) : null}
            <div className="relative mt-3 grid gap-2">
              {pendingInspections(save, level) > 0 ? (
                <SortButton onClick={onNext} testId="insp-next">
                  Next inspection · {pendingInspections(save, level)}
                </SortButton>
              ) : null}
              {piecesWaiting(save) > 0 && pendingInspections(save, level) === 0 ? (
                <SortButton onClick={onUnpack} testId="insp-unpack">
                  Fridge Sort
                </SortButton>
              ) : null}
              <SortButton quiet onClick={onExit} testId="insp-done">
                Done
              </SortButton>
              <SortButton quiet onClick={onAgain} testId="insp-again">
                Play again
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The picture each kind is shown on in the guide. */
const GUIDE_ON: Record<DefectKind | DecoyKind, string> = {
  mold: "tomato",
  rot: "tomato",
  bruise: "potato",
  wilt: "lettuce",
  slime: "cucumber",
  pests: "lettuce",
  shrivel: "carrot",
  soil: "carrot",
  drop: "apple",
  scuff: "pepper",
  freckles: "pear",
  sun: "lemon",
  speck: "potato",
};
const GUIDE_DECOYS: readonly DecoyKind[] = ["soil", "drop", "scuff", "freckles", "sun", "speck"];

/** One example: the ingredient with the mark on it, and its name under it. */
function GuideChip({
  ing,
  mark,
  label,
  good,
}: {
  ing: string;
  mark: NonNullable<CrateItem["mark"]>;
  label: string;
  good?: boolean;
}) {
  return (
    <li
      className="flex min-w-0 flex-col items-center gap-0.5"
      data-testid={`insp-guide-${mark.type}-${mark.kind}`}
    >
      <span className="relative h-11 w-11 shrink-0">
        <IngredientIcon
          id={ing}
          fallback={<span>🥬</span>}
          className="!h-full !w-full object-contain"
        />
        <MarkArt
          mark={{ ...mark, size: "big", dx: 0.04, dy: 0.04 }}
          scale={mark.type === "decoy" ? 0.95 : 0.78}
        />
      </span>
      <span
        className={cn(
          "text-center font-ui text-[11px] font-extrabold leading-[1.1]",
          good ? "text-[#2f6b1f]" : "text-[#a3281b]",
        )}
      >
        {label}
      </span>
    </li>
  );
}

/**
 * The how-to card (developer 2026-11-16: "can't identify which is dirt and which is fungus"): a chart of every kind of NOT FRESH this tier can show,
 * and, from the third tier, every harmless mark next to it. They are the real marks, drawn the way the crate draws them.
 */
function HowTo({ tierNumber, onDone }: { tierNumber: number; onDone: () => void }) {
  const tier = INSPECTION_TIERS[Math.max(0, Math.min(INSPECTION_TIERS.length, tierNumber) - 1)]!;
  const bad = tier.kinds;
  const decoys = tier.decoys > 0 ? GUIDE_DECOYS : [];
  const cols = bad.length >= 4 ? "grid-cols-4" : "grid-cols-3";
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      data-testid="insp-guide"
    >
      <div className="max-h-full w-full max-w-[340px] overflow-y-auto rounded-3xl border-2 border-[#e6b866] bg-[#f7edd7] p-3">
        <p className="text-center font-display text-[20px] font-extrabold text-walnut-dark">
          Inspection Guide
        </p>
        <p className="mt-0.5 text-center font-ui text-[13px] font-bold text-walnut/80">
          Find what is <b className="text-tomato">NOT FRESH</b> before time runs out.
        </p>
        <div className="mt-2 rounded-2xl bg-white/60 p-2">
          <p className="font-ui text-[12px] font-black uppercase tracking-wide text-[#a3281b]">
            ✕ Not fresh · tap it
          </p>
          <ul className={cn("mt-1 grid gap-1", cols)}>
            {bad.map((k) => (
              <GuideChip
                key={k}
                ing={GUIDE_ON[k]}
                mark={{ type: "defect", kind: k, variant: 0, size: "big", dx: 0, dy: 0 }}
                label={DEFECT_LABEL[k]}
              />
            ))}
          </ul>
        </div>
        {decoys.length > 0 ? (
          <div className="mt-1.5 rounded-2xl bg-[#e4f1d6]/80 p-2">
            <p className="font-ui text-[12px] font-black uppercase tracking-wide text-[#2f6b1f]">
              ✓ Fine · leave it
            </p>
            <ul className="mt-1 grid grid-cols-3 gap-1">
              {decoys.map((k) => (
                <GuideChip
                  key={k}
                  good
                  ing={GUIDE_ON[k]}
                  mark={{ type: "decoy", kind: k, variant: 0, size: "big", dx: 0, dy: 0 }}
                  label={DECOY_LABEL[k]}
                />
              ))}
            </ul>
            <p className="mt-1 font-ui text-[12px] font-bold text-walnut-dark">
              Fuzzy, wet or dark means bad. Dry crumbs are just dirt.
            </p>
          </div>
        ) : null}
        <div className="relative mt-1.5 flex items-center gap-3 rounded-2xl bg-white/60 p-2 font-ui text-[12.5px] font-bold text-walnut-dark">
          <span aria-hidden className="text-[22px]">
            👆
          </span>
          <span>
            <b>Tap</b> bad food. <b>Drag</b> fresh food aside to look behind. 🔎 magnifies.
          </span>
          <span className="pointer-events-none absolute -right-1 -top-4">
            <PointerHand size={34} />
          </span>
        </div>
        {/* Pinned to the bottom of the card, so a small phone (320 x 568) never has to scroll to reach it. */}
        <div className="sticky bottom-0 -mx-3 -mb-3 mt-1 rounded-b-3xl bg-[#f7edd7] px-3 pb-3 pt-1">
          <p className="mb-1 text-center font-ui text-[12px] font-bold text-walnut/65">
            A wrong tap costs 4 seconds.
          </p>
          <SortButton onClick={onDone} testId="insp-guide-ok">
            Got it
          </SortButton>
        </div>
      </div>
    </div>
  );
}

export default DeliveryInspectionGame;
