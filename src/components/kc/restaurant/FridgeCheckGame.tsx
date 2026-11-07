import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { sendAnalyticsEvent } from "@/game/PlayablesSDK";
import { PointerHand } from "@/components/kc/common/PointerHand";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { InfoTip } from "@/components/kc/common/InfoTip";
import type { SaveData } from "@/game/SaveManager";
import { cleanlinessOf, type CleanlinessActionResult } from "@/game/restaurant/cleanliness";
import { formatStockAmount, measureOf } from "@/game/business/measure";
import {
  allCards,
  checkCards,
  checkTierAt,
  fridgeCheckOf,
  howtoSeen,
  isNextToWrap,
  isWrapOpen,
  pinsOf,
  reasonOf,
  scoreCheck,
  sortStars,
  sortTimeMs,
  tierNumberAt,
  stickerText,
  wrapItems,
  wrapStars,
  wrapTimeMs,
  type CheckCard,
  type CheckEffects,
  type CheckOutcome,
  type CheckStage,
  type Verdict,
} from "@/game/restaurant/fridgeCheck";
import { Art, Plaque, SortButton, StarBar } from "../inventory/sort/SortParts";
import { FcArt, FoodPicture, InspectionCard, SHELF_LIFE_GUIDE, fcUrl } from "./FridgeCheckParts";
import { FridgeCheckHowTo } from "./FridgeCheckHowTo";
import { clock, fsUrl } from "../inventory/sort/sortUtils";

/**
 * FRIDGE CHECK — the screen of the closing-night inspection (rules: restaurant/fridgeCheck.ts, plan: docs/planning/FRIDGE-CHECK-MINIGAME-PLAN-2026-11-06.md).
 *
 * STAGE 1 "sort" (the chore "Throw out spoiled food"): a card for each ingredient really in the fridge. Swipe it right to KEEP, left to BIN or (from
 * the second tier) up for USE FIRST; the three buttons and the arrow keys do the same. After every card one line says why.
 * STAGE 2 "wrap" (the chore "Wrap and label"): the food that stays stands on a steel shelf; tap the one that goes off FIRST, it is wrapped and labelled.
 * The game never moves money or stock: a wrong answer costs points only, and Closing Time's sweep is the only thing that throws food out.
 * Reduced Motion: no card fly-out, no stamp fade, no shake: the card just changes.
 */

type Phase = "ready" | "playing" | "paused" | "done";

/** The star marks on the painted bar for this game: 60% right = 1 star, 85% = 2, everything right = 3. */
const MARKS = [0.6, 0.85, 1] as const;
const SWIPE_X = 80;
const SWIPE_Y = 70;
const FLY_MS = 190;
const NO_EFFECTS: CheckEffects = { hype: 0, pin: false, newBest: false, streak: 0 };

type Note = { text: string; tone: "good" | "bad" | "info" };

const LABELS: Record<Verdict, string> = { keep: "Keep", bin: "Bin", "use-first": "Use first" };

export function FridgeCheckGame(props: {
  save: SaveData;
  level: number;
  stage: CheckStage;
  reducedMotion: boolean;
  /** Completes the stage's chore and keeps the stars / Hype; null = it did not apply (the chore was already done). */
  onFinish: (o: CheckOutcome) => CleanlinessActionResult | null;
  /** The old way: one tap does the chore, and the game closes. */
  onSkip: () => void;
  onClose: () => void;
  /** Continue to the other stage (Wrap and label after the sort). */
  onNext: (stage: CheckStage) => void;
  /** Free play (the Inventory entry): no reward, no chore. */
  initialPractice?: boolean;
  /** The how-to tour of this stage was closed for the first time: the app saves that it was seen. */
  onGuideSeen: (stage: CheckStage) => void;
}) {
  // "Again · practice" replays the same night with no reward: a new round with its own state.
  const [attempt, setAttempt] = useState(0);
  const [practice, setPractice] = useState(props.initialPractice ?? false);
  return (
    <Round
      key={`${props.stage}-${attempt}`}
      {...props}
      practice={practice}
      onGuideSeen={() => props.onGuideSeen(props.stage)}
      onAgain={() => {
        setPractice(true);
        setAttempt((n) => n + 1);
      }}
    />
  );
}

function Round({
  save,
  level,
  stage,
  reducedMotion,
  practice,
  onFinish,
  onSkip,
  onClose,
  onNext,
  onAgain,
  onGuideSeen,
}: {
  save: SaveData;
  level: number;
  stage: CheckStage;
  reducedMotion: boolean;
  practice: boolean;
  onFinish: (o: CheckOutcome) => CleanlinessActionResult | null;
  onSkip: () => void;
  onClose: () => void;
  onNext: (stage: CheckStage) => void;
  onAgain: () => void;
  onGuideSeen: () => void;
}) {
  const tier = checkTierAt(level);
  const measure = measureOf(save);
  const isSort = stage === "sort";
  // The night's deck is dealt ONCE from the stock as the game opened (finishing changes the save, never the cards).
  const cards = useMemo<CheckCard[]>(
    () => (isSort ? checkCards(save, level) : wrapItems(save, level)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const total = cards.length;
  const hasClock = isSort || tier.wrapClock;
  const timeMs = isSort ? sortTimeMs(total, level) : wrapTimeMs(total, level);
  const state0 = fridgeCheckOf(save);
  const firstNight = isSort ? state0.rounds === 0 : state0.bestWrap === 0;

  const [phase, setPhase] = useState<Phase>("ready");
  // The tour shows by itself the first time for EVERY player (practice included), whatever they played before; the ? button brings it back.
  const [guide, setGuide] = useState(!howtoSeen(save, stage));
  const [msLeft, setMsLeft] = useState(timeMs);
  const [note, setNote] = useState<Note | null>(null);
  // sort
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState(0);
  const [binned, setBinned] = useState(0);
  const [first, setFirst] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [leave, setLeave] = useState<{ dx: number; dy: number } | null>(null);
  // shared
  const [rightStreaks, setRightStreaks] = useState<number[]>([]);
  const [rights, setRights] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [spoiledKept, setSpoiledKept] = useState(0);
  // wrap
  const [wrapped, setWrapped] = useState<string[]>([]);
  const [shake, setShake] = useState<string | null>(null);
  const [firstTry, setFirstTry] = useState(0);
  const [result, setResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    right: number;
    effects: CheckEffects;
    timedOut: boolean;
  } | null>(null);

  const streakRef = useRef(0);
  const missedRef = useRef(false);
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);
  const remainingRef = useRef(timeMs);
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const timersRef = useRef<number[]>([]);
  const after = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => {
    const timers = timersRef.current;
    sendAnalyticsEvent("fridge_check_started", {
      level,
      tier: tierNumberAt(level),
      stage,
      cards: total,
      practice,
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [level, stage, total, practice]);

  const card = isSort ? (cards[idx] ?? null) : null;
  const live = scoreCheck(rightStreaks, false, 0);

  // ── the clock ──
  const startClock = useCallback(() => {
    if (!hasClock || deadlineRef.current !== null) return;
    deadlineRef.current = performance.now() + remainingRef.current;
  }, [hasClock]);

  const finish = useCallback(
    (
      timedOut: boolean,
      over: {
        rights: number;
        streaks: number[];
        wrongs: number;
        spoiled: number;
        firstTry: number;
      },
    ) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const left =
        deadlineRef.current === null
          ? timeMs
          : Math.max(0, deadlineRef.current - performance.now());
      const done = !timedOut;
      let stars: 0 | 1 | 2 | 3;
      if (isSort) {
        const unanswered = total - over.rights - over.wrongs;
        const unansweredSpoiled = cards
          .slice(total - unanswered)
          .filter((c) => c.verdict === "bin").length;
        stars = sortStars(
          total,
          over.wrongs + unanswered,
          over.spoiled + unansweredSpoiled,
          timedOut,
        );
      } else {
        const s = wrapStars(total, over.firstTry);
        stars = timedOut ? (Math.min(2, s) as 0 | 1 | 2 | 3) : s;
      }
      const score = scoreCheck(over.streaks, done && hasClock, left);
      const outcome: CheckOutcome = { stage, stars, score, right: over.rights, total, practice };
      const r = practice ? null : onFinish(outcome);
      const effects = r?.checkEffects ?? NO_EFFECTS;
      sendAnalyticsEvent("fridge_check_finished", {
        level,
        stage,
        stars,
        score,
        right: over.rights,
        total,
        hype: effects.hype,
        practice,
      });
      setResult({ stars, score, right: over.rights, effects, timedOut });
      setPhase("done");
      AudioManager.playSfx(stars > 0 ? "sortCombo" : "tap");
    },
    [cards, hasClock, isSort, level, onFinish, practice, stage, timeMs, total],
  );

  // The latest numbers for a timeout that fires from the interval.
  const liveRef = useRef({
    rights: 0,
    streaks: [] as number[],
    wrongs: 0,
    spoiled: 0,
    firstTry: 0,
  });
  liveRef.current = { rights, streaks: rightStreaks, wrongs, spoiled: spoiledKept, firstTry };

  useEffect(() => {
    if (phase !== "playing" || !hasClock) return;
    const id = window.setInterval(() => {
      if (deadlineRef.current === null) return;
      const left = Math.max(0, deadlineRef.current - performance.now());
      setMsLeft(left);
      if (left <= 0) finish(true, liveRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, hasClock, finish]);

  const begin = () => {
    if (phase === "ready") {
      setPhase("playing");
      startClock();
    }
  };

  const pause = () => {
    if (phase !== "playing" && phase !== "ready") return;
    if (deadlineRef.current !== null) {
      remainingRef.current = Math.max(0, deadlineRef.current - performance.now());
      deadlineRef.current = null;
    }
    setPhase("paused");
  };
  const resume = () => {
    setPhase("playing");
    if (hasClock) deadlineRef.current = performance.now() + remainingRef.current;
  };

  // ── stage 1: answering a card ──
  const answer = useCallback(
    (choice: Verdict) => {
      if (!card || busyRef.current || phase === "done" || phase === "paused" || guide) return;
      if (choice === "use-first" && tier.piles === 2) return;
      busyRef.current = true;
      begin();
      const right = choice === card.verdict;
      const streak = right ? streakRef.current : 0;
      const nextStreaks = right ? [...rightStreaks, streak] : rightStreaks;
      streakRef.current = right ? streakRef.current + 1 : 0;
      const nextRights = rights + (right ? 1 : 0);
      const nextWrongs = wrongs + (right ? 0 : 1);
      const nextSpoiled = spoiledKept + (!right && card.verdict === "bin" ? 1 : 0);
      const reason = reasonOf(card, tier);
      setNote(
        right
          ? { tone: "good", text: `✓ ${reason}` }
          : {
              tone: "bad",
              text:
                card.verdict === "bin"
                  ? `✗ It spoils tonight: Bin. ${reason}`
                  : choice === "bin"
                    ? `✗ It was still good: ${LABELS[card.verdict]}. ${reason}`
                    : `✗ ${LABELS[card.verdict]}. ${reason}`,
            },
      );
      AudioManager.playSfx(right ? "sortPlace" : "sortWrong");
      setRightStreaks(nextStreaks);
      setRights(nextRights);
      setWrongs(nextWrongs);
      setSpoiledKept(nextSpoiled);
      if (choice === "keep") setKept((n) => n + 1);
      else if (choice === "bin") setBinned((n) => n + 1);
      else setFirst((n) => n + 1);
      const advance = () => {
        setLeave(null);
        setDrag(null);
        busyRef.current = false;
        if (idx + 1 >= total) {
          finish(false, {
            rights: nextRights,
            streaks: nextStreaks,
            wrongs: nextWrongs,
            spoiled: nextSpoiled,
            firstTry,
          });
        } else setIdx(idx + 1);
      };
      if (reducedMotion) advance();
      else {
        setLeave(
          choice === "keep"
            ? { dx: 520, dy: 0 }
            : choice === "bin"
              ? { dx: -520, dy: 0 }
              : { dx: 0, dy: -620 },
        );
        after(advance, FLY_MS);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      card,
      phase,
      guide,
      idx,
      total,
      rightStreaks,
      rights,
      wrongs,
      spoiledKept,
      tier,
      reducedMotion,
      finish,
      firstTry,
    ],
  );

  // keyboard: arrows answer the card (a mouse player's shortcut)
  useEffect(() => {
    if (!isSort) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") answer("keep");
      else if (e.key === "ArrowLeft") answer("bin");
      else if (e.key === "ArrowUp") answer("use-first");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSort, answer]);

  // ── the swipe ──
  const onDown = (e: React.PointerEvent) => {
    if (!card || busyRef.current || phase === "done" || phase === "paused" || guide) return;
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ dx: 0, dy: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s || s.id !== e.pointerId) return;
    setDrag({ dx: e.clientX - s.x, dy: Math.min(0, e.clientY - s.y) });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s || s.id !== e.pointerId) return;
    startRef.current = null;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (tier.piles === 3 && dy < -SWIPE_Y && Math.abs(dy) > Math.abs(dx)) answer("use-first");
    else if (dx > SWIPE_X) answer("keep");
    else if (dx < -SWIPE_X) answer("bin");
    else setDrag(null); // it springs back
  };

  // ── stage 2: wrapping ──
  const remaining = cards.filter((c) => !wrapped.includes(c.id));
  const tapItem = (c: CheckCard) => {
    if (isSort || phase === "done" || phase === "paused" || guide || wrapped.includes(c.id)) return;
    begin();
    if (!isNextToWrap(remaining, c)) {
      missedRef.current = true;
      streakRef.current = 0;
      setWrongs((n) => n + 1);
      setNote({ tone: "bad", text: "This one goes off sooner: do it first." });
      AudioManager.playSfx("sortWrong");
      if (!reducedMotion) {
        setShake(c.id);
        after(() => setShake(null), 380);
      }
      return;
    }
    const clean = !missedRef.current;
    const streak = clean ? streakRef.current : 0;
    const nextStreaks = [...rightStreaks, streak];
    streakRef.current = clean ? streakRef.current + 1 : 0;
    missedRef.current = false;
    const nextFirst = firstTry + (clean ? 1 : 0);
    const nextWrapped = [...wrapped, c.id];
    setRightStreaks(nextStreaks);
    setRights((n) => n + 1);
    setFirstTry(nextFirst);
    setWrapped(nextWrapped);
    setNote({ tone: "good", text: `✓ ${c.name}: ${stickerText(c)}` });
    AudioManager.playSfx("sortPlace");
    if (nextWrapped.length >= total)
      finish(false, {
        rights: nextWrapped.length,
        streaks: nextStreaks,
        wrongs,
        spoiled: 0,
        firstTry: nextFirst,
      });
  };

  // ── what to draw ──
  const dxNow = leave?.dx ?? drag?.dx ?? 0;
  const dyNow = leave?.dy ?? drag?.dy ?? 0;
  const keepOp = Math.min(1, Math.max(0, dxNow / SWIPE_X));
  const binOp = Math.min(1, Math.max(0, -dxNow / SWIPE_X));
  const firstOp = tier.piles === 3 ? Math.min(1, Math.max(0, -dyNow / SWIPE_Y)) : 0;
  const answered = isSort ? rights + wrongs : wrapped.length;
  const progress = total > 0 ? (isSort ? rights : wrapped.length) / total : 0;
  const low = hasClock && msLeft <= 8000 && phase === "playing";
  const canNext =
    isSort &&
    !practice &&
    result !== null &&
    isWrapOpen(save, level) &&
    cleanlinessOf(save).tasks.some((t) => t.kind === "wrap-fridge");
  const throwOut = allCards(save, level).filter((c) => c.verdict === "bin");
  const tutorVerdict: Verdict | null =
    isSort && firstNight && idx === 0 && !guide && phase === "ready"
      ? (card?.verdict ?? null)
      : null;

  return (
    <div
      className="absolute inset-0 z-[100] flex touch-none select-none flex-col overflow-hidden bg-[#0f1c24]"
      style={{
        backgroundImage: `url(${fcUrl("backdrop")})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="fridge-check"
      data-stage={stage}
      data-phase={phase}
      data-practice={practice ? "1" : "0"}
      data-total={total}
      data-answered={answered}
      data-tier={tierNumberAt(level)}
    >
      {/* HUD */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={pause}
          aria-label="Pause"
          data-testid="fc-pause"
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-[18px] text-gold"
        >
          <Art name="hud-round" className="absolute inset-0 h-full w-full object-fill" />
          <span className="relative">⏸</span>
        </button>
        <Plaque
          testId="fc-timer"
          className={cn(
            "h-12 min-w-0 flex-1 font-ui text-[22px] font-black tabular-nums",
            low ? "text-tomato" : "text-ivory",
          )}
        >
          {hasClock ? (
            <>
              <span aria-hidden>⏱</span> {clock(msLeft)}
            </>
          ) : (
            <>
              <span aria-hidden>📦</span> {wrapped.length}/{total}
            </>
          )}
        </Plaque>
        <Plaque
          testId="fc-score"
          className="h-12 min-w-[104px] px-2 font-ui text-[16px] font-black tabular-nums text-ivory"
        >
          <span aria-hidden className="text-gold">
            ★
          </span>
          {live.toLocaleString("en-US")}
        </Plaque>
      </div>
      <div className="px-4 pt-2">
        <StarBar progress={progress} marks={MARKS} />
        <div className="mt-1 flex min-h-[34px] items-center gap-2 font-ui">
          <p
            className={cn(
              "min-w-0 flex-1 rounded-xl px-2.5 py-1 text-[12.5px] font-extrabold leading-tight",
              note?.tone === "bad"
                ? "bg-[#7a2a1d]/90 text-[#ffe1d6]"
                : note?.tone === "good"
                  ? "bg-[#3f6b2c]/90 text-[#eaffd9]"
                  : "bg-[#12303b]/85 text-ivory",
            )}
            data-testid="fc-note"
            data-tone={note?.tone ?? "info"}
            aria-live="polite"
          >
            {note
              ? note.text
              : practice
                ? "Practice · no reward"
                : isSort
                  ? `Card ${Math.min(idx + 1, total)} of ${total}: keep it or bin it?`
                  : "Tap the food that goes off first."}
          </p>
          {isSort && rights >= 2 ? (
            <span data-testid="fc-combo" className="text-[12px] font-bold text-ivory/85">
              🔥 {streakRef.current}
            </span>
          ) : null}
          <InfoTip tone="light" label="Shelf life">
            {SHELF_LIFE_GUIDE}
          </InfoTip>
          <button
            type="button"
            data-testid="fc-help"
            aria-label="How to play"
            onClick={() => setGuide(true)}
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#9fd0e0] bg-[#12303b] text-[16px] font-black text-[#cfeff8]"
          >
            ?
          </button>
        </div>
      </div>

      {/* the table */}
      {isSort ? (
        <div className="relative mx-auto flex min-h-0 w-full max-w-[460px] flex-1 items-center justify-center px-6 py-2">
          {card && phase !== "done" ? (
            <div
              className="relative h-full max-h-[430px] max-w-[290px]"
              style={{ aspectRatio: "340 / 492" }}
            >
              {/* the next card peeks from behind */}
              {cards[idx + 1] ? (
                <div className="absolute inset-0 origin-bottom scale-[0.94] opacity-60 [filter:brightness(0.8)]">
                  <FcArt name="card" className="h-full w-full object-fill" />
                </div>
              ) : null}
              <div
                className={cn(
                  "absolute inset-0 cursor-grab touch-none active:cursor-grabbing",
                  !reducedMotion && !drag && "transition-transform duration-200 ease-out",
                  leave && "transition-transform duration-[190ms] ease-in",
                )}
                style={{
                  transform: `translate(${dxNow}px, ${dyNow}px) rotate(${Math.max(-14, Math.min(14, dxNow / 14))}deg)`,
                }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={() => {
                  startRef.current = null;
                  setDrag(null);
                }}
                data-testid="fc-swipe"
                key={card.id}
              >
                <InspectionCard card={card} level={level} measure={measure} className="h-full" />
                {/* the stamps fade in as the card nears a side */}
                {(
                  [
                    [
                      "stamp-keep",
                      "KEEP",
                      keepOp,
                      "text-[#1f6b2a]",
                      "-rotate-12 left-[6%] top-[22%]",
                    ],
                    ["stamp-bin", "BIN", binOp, "text-[#a3271a]", "rotate-12 right-[6%] top-[22%]"],
                    [
                      "stamp-first",
                      "USE FIRST",
                      firstOp,
                      "text-[#b8620f]",
                      "-rotate-6 left-[18%] top-[40%]",
                    ],
                  ] as const
                ).map(([art, text, op, color, place]) => (
                  <span
                    key={art}
                    aria-hidden
                    data-testid={`fc-stamp-${art.slice(6)}`}
                    className={cn("pointer-events-none absolute w-[46%]", place)}
                    style={{ opacity: reducedMotion ? (op > 0.9 ? 1 : 0) : op }}
                  >
                    <FcArt name={art} className="w-full" />
                    <span
                      className={cn(
                        "absolute inset-0 grid place-items-center font-display text-[17px] font-black leading-none",
                        color,
                      )}
                    >
                      {text}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[460px] flex-1 flex-col justify-center gap-3 overflow-y-auto px-4 py-2 no-scrollbar">
          {[0, 1].map((row) => {
            const rowItems = cards.slice(row * 4, row * 4 + 4);
            if (rowItems.length === 0) return null;
            return (
              <div key={row} className="relative pt-1" data-testid="fc-shelf">
                <div className="relative z-10 grid grid-cols-4 items-end gap-1.5">
                  {rowItems.map((c) => {
                    const done = wrapped.includes(c.id);
                    const sticker =
                      c.daysLeft >= 3
                        ? "label-green"
                        : c.daysLeft === 2
                          ? "label-yellow"
                          : "label-red";
                    return (
                      <button
                        key={c.id}
                        type="button"
                        data-testid={`fc-item-${c.id}`}
                        data-wrapped={done ? "1" : "0"}
                        data-expires={Math.ceil(c.expires)}
                        disabled={done}
                        onClick={() => tapItem(c)}
                        aria-label={`${c.name}${done ? ", wrapped" : ""}`}
                        className={cn(
                          "press relative grid min-h-[84px] place-items-center rounded-xl pb-4",
                          shake === c.id && "animate-[kc-nod_0.3s_ease-in-out_1]",
                        )}
                      >
                        <IngredientIcon
                          id={c.id}
                          fallback={<span className="text-[40px]">🥬</span>}
                          className="!h-[58px] !w-[58px] object-contain drop-shadow-[0_5px_5px_rgba(0,0,0,0.45)]"
                        />
                        {done ? (
                          <FcArt
                            name="wrap-round"
                            className="absolute left-1/2 top-[8px] w-[76px] -translate-x-1/2 opacity-80"
                          />
                        ) : null}
                        {done ? (
                          <span className="absolute -bottom-0 left-1/2 w-[70px] -translate-x-1/2">
                            <FcArt name={sticker} className="w-full" />
                            <span className="absolute inset-0 grid place-items-center font-ui text-[9.5px] font-black leading-none text-walnut-dark">
                              {stickerText(c)}
                            </span>
                          </span>
                        ) : tier.cues.days ? (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#12303b]/90 px-1.5 py-[1px] font-ui text-[10.5px] font-extrabold text-ivory">
                            {c.daysLeft <= 0 ? "today" : `${c.daysLeft} d`}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <FcArt
                  name="shelf"
                  className="absolute inset-x-0 bottom-0 z-0 h-[26px] w-full object-fill"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* the three piles are the three buttons (a mouse or one-thumb player's way; arrows work too) */}
      {isSort ? (
        <div
          className={cn(
            "grid items-end gap-2 px-3 pb-3 pt-1",
            tier.piles === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
          data-testid="fc-piles"
        >
          {(
            [
              ["bin", "Bin", binned],
              ["use-first", "Use first", first],
              ["keep", "Keep", kept],
            ] as const
          )
            .filter(([v]) => v !== "use-first" || tier.piles === 3)
            .map(([v, label, n]) => (
              <button
                key={v}
                type="button"
                data-testid={`fc-${v === "use-first" ? "first" : v}`}
                onClick={() => answer(v)}
                disabled={phase === "done"}
                className={cn(
                  "press relative flex min-h-[76px] flex-col items-center justify-end rounded-2xl border border-white/15 bg-[#12303b]/80 px-1 pb-1 pt-1.5 font-ui text-ivory",
                )}
              >
                {v === "bin" ? (
                  <FcArt
                    name={binOp > 0.3 ? "bin-open" : "bin-closed"}
                    className="h-[44px] w-auto object-contain"
                  />
                ) : v === "keep" ? (
                  <img
                    src={fsUrl("crate-front")}
                    alt=""
                    draggable={false}
                    className="pointer-events-none h-[34px] w-auto object-contain"
                  />
                ) : (
                  <FcArt name="flag" className="h-[40px] w-auto object-contain" />
                )}
                <span className="mt-0.5 text-[13px] font-black leading-none">{label}</span>
                <span className="absolute right-1.5 top-1 rounded-full bg-black/40 px-1.5 text-[11px] font-black tabular-nums">
                  {n}
                </span>
                {tutorVerdict === v ? (
                  <span className="pointer-events-none absolute left-[38%] top-[34%] z-30">
                    <PointerHand size={38} />
                  </span>
                ) : null}
              </button>
            ))}
        </div>
      ) : (
        <div className="px-4 pb-4 pt-1 text-center font-ui text-[12px] font-bold text-ivory/80">
          Tap the food that goes off <b>first</b>
        </div>
      )}

      {/* how to play: the illustrated tour, shown by itself once per stage (saved as seen) and from the ? button */}
      {guide ? (
        <FridgeCheckHowTo
          stage={stage}
          tier={tier}
          measure={measure}
          onDone={() => {
            setGuide(false);
            if (!howtoSeen(save, stage)) onGuideSeen();
          }}
        />
      ) : null}

      {/* pause */}
      {phase === "paused" ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-6"
          data-testid="fc-paused"
        >
          <div className="w-full max-w-[300px] rounded-3xl bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">Paused</p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={resume} testId="fc-resume">
                Resume
              </SortButton>
              <SortButton
                quiet
                testId="fc-skip"
                onClick={() => {
                  sendAnalyticsEvent("fridge_check_skipped", { level, stage });
                  onSkip();
                }}
              >
                {practice ? "Leave the check" : "Skip: do it with one tap"}
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {/* the result */}
      {phase === "done" && result ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-5"
          data-testid="fc-result"
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
              {result.timedOut
                ? "Time's up"
                : result.stars === 3
                  ? isSort
                    ? "Spotless fridge!"
                    : "Perfectly wrapped!"
                  : result.stars > 0
                    ? isSort
                      ? "Fridge checked!"
                      : "Wrapped!"
                    : "Check again tomorrow"}
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
              data-testid="fc-final-score"
            >
              {result.score.toLocaleString("en-US")}
              {result.effects.newBest ? (
                <span className="ml-1.5 text-copper">new best!</span>
              ) : null}
            </p>
            <p className="relative mt-0.5 font-ui text-[12.5px] font-bold text-walnut/70">
              {result.right} of {total} right
            </p>
            {practice ? (
              <p className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
                Practice: no reward
              </p>
            ) : (
              <p
                className="relative mt-1 font-ui text-[13px] font-extrabold text-olive"
                data-testid="fc-reward"
              >
                {result.effects.hype > 0 ? `⚡ +${result.effects.hype} Hype` : "No Hype this time"}
                {result.effects.pin ? " · 📍 new freshness pin!" : ""}
              </p>
            )}
            {!practice && result.effects.streak >= 2 ? (
              <p
                className="relative mt-1 font-ui text-[12.5px] font-extrabold text-copper"
                data-testid="fc-streak"
              >
                🔥 {result.effects.streak} perfect nights in a row
              </p>
            ) : null}
            {isSort && throwOut.length > 0 ? (
              <div className="relative mt-1.5" data-testid="fc-tonight">
                <p className="font-ui text-[11.5px] font-bold text-walnut/70">
                  Closing throws out tonight:
                </p>
                <p className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
                  {throwOut.slice(0, 6).map((c) => (
                    <IngredientIcon
                      key={c.id}
                      id={c.id}
                      fallback={<span>🥬</span>}
                      className="!h-[30px] !w-[30px] object-contain"
                    />
                  ))}
                </p>
              </div>
            ) : null}
            {!practice && result.effects.pin ? (
              <FcArt
                name={`pin-${String(Math.max(1, pinsOf(save))).padStart(2, "0")}`}
                className="relative mx-auto mt-1 h-[48px] w-auto object-contain"
              />
            ) : null}
            <div className="relative mt-3 grid gap-2">
              {canNext ? (
                <SortButton onClick={() => onNext("wrap")} testId="fc-next">
                  Next: Wrap and label
                </SortButton>
              ) : null}
              <SortButton quiet={canNext} onClick={onClose} testId="fc-done">
                Done
              </SortButton>
              {!practice ? (
                <SortButton quiet onClick={onAgain} testId="fc-again">
                  Again · practice
                </SortButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FridgeCheckGame;
