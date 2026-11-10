import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import type { SaveData } from "@/game/SaveManager";
import {
  FILL_LINE,
  NO_EFFECTS,
  PANTRY_BY_ID,
  WHISK_ZONE,
  bottleScore,
  bottleStars,
  blendStep,
  gradeMix,
  howtoSeen,
  mixOf,
  overallStars,
  pantryFor,
  canOfferRoundsAd,
  SAUCE_AD_ROUNDS,
  pinsOf,
  pourRate,
  roundScore,
  roundSeed,
  roundsLeft,
  sauceIndex,
  sauceOfTheDay,
  speedOf,
  splits,
  targetOf,
  thickOf,
  tierAt,
  tierNumberAt,
  unlockedSauces,
  volumeOf,
  rng,
  type MixResult,
  type PantryItem,
  type RoundEffects,
  type SauceDef,
  type SauceStationAction,
  type SauceStationResult,
  type Scoops,
} from "@/game/business/sauceStation";
import { colorHint, deltaE, matchPercent } from "@/game/business/sauceColor";
import { Art, Plaque, SortButton } from "@/components/kc/inventory/sort/SortParts";
import { clock } from "@/components/kc/inventory/sort/sortUtils";
import { sauceUrl, useSauceArt } from "./sauceArt";
import {
  BottleView,
  bottleSurface,
  DialGauge,
  EmulsionMeter,
  SauceIcon,
  SauceStyles,
  Sprite,
  Swatch,
  ThicknessGauge,
  Vessel,
} from "./SauceParts";

/**
 * SAUCE STATION — the screen (rules: business/sauceStation.ts, plan: docs/planning/SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md).
 * STAGE 1: tap the pantry to pour into the bowl until the live colour matches the swatch and the thickness is in the green band, then circle the
 * whisk (or the spoon) in the green speed zone to blend it; a dressing poured too fast before it is blended SPLITS. STAGE 2: hold to pour the batch
 * into bottles and let go at the fill line. The game never moves money or stock: the effects are the stars, Hype, the Saucier pins and the Sauce Shelf.
 * "Auto whisk" is the no-drag way to blend. Reduced Motion: no swirl, no pop, no chunk drift.
 */

type Phase = "ready" | "mix" | "bottle" | "paused" | "done";
const TICK_MS = 50;
const HOLD_REPEAT_MS = 280;
const TASTE_SHOW_MS = 5000;
const MAX_FILL = 1.12;
const BOTTLE_PAUSE_MS = 700;

type Note = { text: string; tone: "good" | "bad" | "info" };

export function SauceStationGame(props: {
  save: SaveData;
  playerLevel: number;
  reducedMotion: boolean;
  onAction: (a: SauceStationAction) => SauceStationResult;
  hasPrepCook?: boolean;
  /** The rewarded ad for 3 more rounds today (App.watchSauceRoundsAd); absent = no offer. */
  onWatchAd?: (() => Promise<"ok" | "no">) | undefined;
  onShelf: () => void;
  onExit: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [practice, setPractice] = useState(false);
  return (
    <Round
      key={attempt}
      {...props}
      attempt={attempt}
      forcePractice={practice}
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
  hasPrepCook = false,
  onWatchAd,
  onShelf,
  onExit,
  attempt,
  forcePractice,
  onAgain,
  onNext,
}: {
  save: SaveData;
  playerLevel: number;
  reducedMotion: boolean;
  onAction: (a: SauceStationAction) => SauceStationResult;
  hasPrepCook?: boolean;
  onWatchAd?: (() => Promise<"ok" | "no">) | undefined;
  onShelf: () => void;
  onExit: () => void;
  attempt: number;
  forcePractice: boolean;
  onAgain: () => void;
  onNext: () => void;
}) {
  const tier = tierAt(level);
  const tierN = tierNumberAt(level);
  // A round past today's three (or "Again") is free play: it scores, but gives nothing. Latched as the round opens.
  const [practice] = useState(() => forcePractice || roundsLeft(save, level) === 0);
  const sauce: SauceDef = useMemo(() => {
    if (!practice) return sauceOfTheDay(save, level);
    const open = unlockedSauces(level);
    return open[Math.floor(rng(roundSeed(save, level, attempt + 7))() * open.length)] ?? open[0]!;
    // Dealt ONCE as the round opens (finishing changes the save, never the sauce).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const target = useMemo(() => targetOf(sauce), [sauce]);
  const shelf = useMemo(
    () => pantryFor(sauce, tierN, roundSeed(save, level, practice ? attempt + 1 : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sauce],
  );
  const items: PantryItem[] = useMemo(() => [...shelf.pantry, ...shelf.produce], [shelf]);
  const cap = tier.cap;
  const toolName = sauce.tool === "whisk" ? "whisk" : "spoon";

  const [phase, setPhase] = useState<Phase>("ready");
  const [pausedFrom, setPausedFrom] = useState<"mix" | "bottle">("mix");
  const [guide, setGuide] = useState(!howtoSeen(save));
  const [scoops, setScoops] = useState<Scoops>({});
  const [log, setLog] = useState<string[]>([]);
  const [blend, setBlend] = useState(0);
  const [omega, setOmega] = useState(0);
  const [msLeft, setMsLeft] = useState(tier.timeMs);
  const [splitFlag, setSplitFlag] = useState(false);
  const [auto, setAuto] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [tastesLeft, setTastesLeft] = useState(tier.tastes);
  const [taste, setTaste] = useState<{ match: number; hint: ReturnType<typeof colorHint> } | null>(
    null,
  );
  const [toolAt, setToolAt] = useState<{ x: number; y: number } | null>(null);
  // bottling
  const [bIndex, setBIndex] = useState(0);
  const [fill, setFill] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [capped, setCapped] = useState(false);
  const [madeBottles, setMadeBottles] = useState<number[]>([]);
  const [result, setResult] = useState<{
    stars: 0 | 1 | 2 | 3;
    score: number;
    mix: MixResult;
    bottleStars: 0 | 1 | 2 | 3 | null;
    timedOut: boolean;
    effects: RoundEffects;
  } | null>(null);

  // Everything the interval and the pointer handlers read lives in refs: their closures are made once and must never see an old render.
  const phaseRef = useRef<Phase>("ready");
  const scoopsRef = useRef<Scoops>({});
  const blendRef = useRef(0);
  const omegaRef = useRef(0);
  const msRef = useRef(tier.timeMs);
  const splitCount = useRef(0);
  const oilLog = useRef<{ t: number; v: number }[]>([]);
  const autoRef = useRef(false);
  const lastMove = useRef(0);
  const lastAng = useRef<number | null>(null);
  const dragging = useRef(false);
  const doneRef = useRef(false);
  const mixRef = useRef<{ mix: MixResult; secs: number } | null>(null);
  const bottleScores = useRef<number[]>([]);
  const spillSum = useRef(0);
  const filledCount = useRef(0);
  const pourRef = useRef({ on: false, held: 0 });
  const fillRef = useRef(0);
  const cappedRef = useRef(false);
  const bIndexRef = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const vesselRef = useRef<HTMLDivElement>(null);
  const tasteTimer = useRef<number | null>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const mix = mixOf(scoops);
  const volume = volumeOf(scoops);
  const thick = thickOf(scoops, sauce, blend);
  const de = deltaE(mix.color, target.color);
  const match = volume > 0 ? matchPercent(de) : 0;
  const bottles = tier.bottles;
  const art = useSauceArt("mix-backdrop");
  const artBottle = useSauceArt("bottle-backdrop");
  const seal = useSauceArt("wax-seals");

  // ── the clock, the blending, the bottle filling ──
  useEffect(() => {
    const t = window.setInterval(() => {
      const ph = phaseRef.current;
      if (ph === "mix") {
        msRef.current = Math.max(0, msRef.current - TICK_MS);
        const [lo, hi] = WHISK_ZONE[sauce.tool];
        let w = omegaRef.current;
        if (autoRef.current) w = (lo + hi) / 2;
        else if (!dragging.current || performance.now() - lastMove.current > 160) w *= 0.55;
        if (w < 0.02) w = 0;
        omegaRef.current = w;
        const hasAny = volumeOf(scoopsRef.current) > 0;
        const nb = hasAny ? blendStep(blendRef.current, sauce.tool, w, TICK_MS / 1000) : 0;
        blendRef.current = nb;
        setBlend(nb);
        setOmega(w);
        setMsLeft(msRef.current);
        if (nb >= 0.5) setSplitFlag(false);
        if (msRef.current <= 0) endMix(true);
      } else if (ph === "bottle" && pourRef.current.on) {
        pourRef.current.held += TICK_MS;
        const th = thickOf(scoopsRef.current, sauce, blendRef.current);
        fillRef.current += (pourRate(pourRef.current.held, th) * TICK_MS) / 1000;
        setFill(fillRef.current);
        if (fillRef.current >= MAX_FILL) releasePour();
      }
    }, TICK_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      if (holdTimer.current) window.clearInterval(holdTimer.current);
      if (tasteTimer.current) window.clearTimeout(tasteTimer.current);
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    },
    [],
  );

  // ── starting, pausing ──
  const start = () => {
    if (phase !== "ready") return;
    setPhaseBoth("mix");
    onAction({ kind: "start", sauceId: sauce.id, practice });
  };
  const pause = () => {
    if (phase === "ready") {
      onAction({ kind: "skip" });
      onExit();
      return;
    }
    if (phase === "mix" || phase === "bottle") {
      setPausedFrom(phase);
      dragging.current = false;
      pourRef.current.on = false;
      setPouring(false);
      setPhaseBoth("paused");
    }
  };
  const resume = () => phase === "paused" && setPhaseBoth(pausedFrom);

  // ── pouring into the bowl ──
  const noteTimer = useRef<number | null>(null);
  const say = (text: string, tone: Note["tone"] = "info") => {
    setNote({ text, tone });
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2600);
  };
  const addScoop = useCallback(
    (item: PantryItem) => {
      if (phaseRef.current !== "mix") return;
      const cur = scoopsRef.current;
      if (volumeOf(cur) + item.scoop > cap + 1e-9) {
        say("The bowl is full! Undo something.", "bad");
        AudioManager.playSfx("sortWrong");
        return;
      }
      const next = { ...cur, [item.id]: (cur[item.id] ?? 0) + item.scoop };
      scoopsRef.current = next;
      setScoops(next);
      setLog((l) => [...l, item.id]);
      AudioManager.playSfx("sortPick");
      // new things need mixing in
      blendRef.current = Math.max(0, blendRef.current - 0.1 * item.scoop);
      setBlend(blendRef.current);
      if (item.kind === "oil") {
        const now = performance.now();
        oilLog.current = [
          ...oilLog.current.filter((o) => now - o.t < 2000),
          { t: now, v: item.scoop },
        ];
        const recent = oilLog.current.reduce((s, o) => s + o.v, 0);
        if (splits(recent, blendRef.current, tier, sauce)) {
          splitCount.current += 1;
          blendRef.current = 0;
          setBlend(0);
          setSplitFlag(true);
          oilLog.current = [];
          say("It split! Whisk it smooth.", "bad");
          AudioManager.playSfx("sortWrong");
        }
      }
    },
    [cap, sauce, tier],
  );
  const undo = () => {
    if (phaseRef.current !== "mix" || log.length === 0) return;
    const id = log[log.length - 1]!;
    const item = PANTRY_BY_ID[id]!;
    const cur = scoopsRef.current;
    const left = Math.max(0, (cur[id] ?? 0) - item.scoop);
    const next = { ...cur };
    if (left <= 1e-9) delete next[id];
    else next[id] = left;
    scoopsRef.current = next;
    setScoops(next);
    setLog((l) => l.slice(0, -1));
    AudioManager.playSfx("tap");
  };
  const holdStart = (item: PantryItem) => {
    addScoop(item);
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    const t0 = performance.now();
    holdTimer.current = window.setInterval(() => {
      if (performance.now() - t0 > 380) addScoop(item);
    }, HOLD_REPEAT_MS);
  };
  const holdStop = () => {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
  };

  // ── the whisk: circle round the middle of the bowl ──
  const onToolMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== "mix" || !dragging.current) return;
    const el = vesselRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.34;
    const dx = e.clientX - cx;
    const dy = (e.clientY - cy) * 1.5;
    setToolAt({ x: e.clientX - r.left, y: e.clientY - r.top });
    if (Math.hypot(dx, dy) < 10) return;
    const ang = Math.atan2(dy, dx);
    const now = performance.now();
    if (lastAng.current !== null && now > lastMove.current) {
      let d = ang - lastAng.current;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      const dt = Math.max(8, now - lastMove.current) / 1000;
      const turns = Math.min(7, Math.abs(d) / (2 * Math.PI) / dt);
      omegaRef.current = omegaRef.current * 0.65 + turns * 0.35;
    }
    lastAng.current = ang;
    lastMove.current = now;
  };
  const onToolDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "mix") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    lastAng.current = null;
    lastMove.current = performance.now();
    onToolMove(e);
  };
  const onToolUp = () => {
    dragging.current = false;
    lastAng.current = null;
    setToolAt(null);
  };
  const toggleAuto = () => {
    const on = !autoRef.current;
    autoRef.current = on;
    setAuto(on);
    AudioManager.playSfx("tap");
  };

  // ── tasting ──
  const doTaste = () => {
    if (phase !== "mix" || volume <= 0 || tastesLeft <= 0) return;
    if (Number.isFinite(tastesLeft)) setTastesLeft((n) => n - 1);
    setTaste({ match: matchPercent(de), hint: colorHint(mix.color, target.color) });
    if (tasteTimer.current) window.clearTimeout(tasteTimer.current);
    tasteTimer.current = window.setTimeout(() => setTaste(null), TASTE_SHOW_MS);
    AudioManager.playSfx("sortPlace");
  };

  // ── end of the mixing stage ──
  const endMix = useCallback(
    (timedOut: boolean) => {
      if (phaseRef.current !== "mix") return;
      autoRef.current = false;
      setAuto(false);
      dragging.current = false;
      const m = gradeMix(scoopsRef.current, sauce, blendRef.current, splitCount.current, tier);
      mixRef.current = { mix: m, secs: (tier.timeMs - msRef.current) / 1000 };
      if (timedOut) say("Time's up! Into the bottles.", "info");
      setPhaseBoth("bottle");
      fillRef.current = 0;
      setFill(0);
    },
    [sauce, tier],
  );

  // ── the end of the round ──
  const finish = useCallback(
    (skippedBottling: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const m = mixRef.current!;
      const scores = bottleScores.current;
      const bs = skippedBottling
        ? null
        : bottleStars({
            scores,
            spill: spillSum.current,
            bottles,
            filled: filledCount.current,
          });
      const stars = overallStars(m.mix.stars, bs);
      const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / bottles : 0;
      const score = roundScore(m.mix.de, m.secs, avg);
      let effects: RoundEffects = NO_EFFECTS;
      if (!practice) {
        const out = onAction({
          kind: "finish",
          outcome: {
            sauceId: sauce.id,
            stars,
            mixStars: m.mix.stars,
            bottleStars: bs,
            score,
          },
        });
        if (out.ok) effects = out.effects;
      }
      setResult({
        stars,
        score,
        mix: m.mix,
        bottleStars: bs,
        timedOut: msRef.current <= 0,
        effects,
      });
      window.setTimeout(() => setPhaseBoth("done"), reducedMotion ? 150 : 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [practice, sauce, bottles, reducedMotion],
  );

  // ── bottling ──
  const beginPour = () => {
    if (phaseRef.current !== "bottle" || pourRef.current.on || cappedRef.current) return;
    pourRef.current = { on: true, held: 0 };
    setPouring(true);
    AudioManager.playSfx("tap");
  };
  const releasePour = () => {
    if (!pourRef.current.on) return;
    pourRef.current.on = false;
    setPouring(false);
    const f = fillRef.current;
    if (f < 0.04) return; // a tap that poured nothing: try again
    const { score, spill } = bottleScore(f, tier.window);
    bottleScores.current = [...bottleScores.current, score];
    spillSum.current += spill;
    if (score > 0) filledCount.current += 1;
    const i = bIndexRef.current;
    if (spill > 0.02) say("Spilled! Stop at the line.", "bad");
    else if (score >= 0.85) say("Perfect pour!", "good");
    else if (score >= 0.5) say("Close!", "info");
    else say(f < FILL_LINE ? "A bit low." : "A bit high.", "bad");
    AudioManager.playSfx(spill > 0.02 || score < 0.3 ? "sortWrong" : "sortPlace");
    cappedRef.current = true;
    setCapped(true);
    setMadeBottles((b) => [...b, Math.min(1, f)]);
    window.setTimeout(
      () => {
        const nextI = i + 1;
        bIndexRef.current = nextI;
        setBIndex(nextI);
        fillRef.current = 0;
        setFill(0);
        cappedRef.current = false;
        setCapped(false);
        if (nextI >= bottles) finish(false);
      },
      reducedMotion ? 250 : BOTTLE_PAUSE_MS,
    );
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && phaseRef.current === "bottle" && !e.repeat) {
        e.preventDefault();
        beginPour();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && phaseRef.current === "bottle") releasePour();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const low = msLeft <= 10_000 && phase === "mix";
  const hint = taste?.hint;
  const liveMatch = Number.isFinite(tier.tastes) ? null : volume > 0 ? match : 0;
  const sealIndex = (taste?.match ?? match) >= 90 ? 2 : (taste?.match ?? match) >= 70 ? 1 : 0;
  const icon = sauceIndex(sauce.id);
  const zoneNow = speedOf(sauce.tool, omega);
  const showBackdrop = phase === "bottle" ? artBottle : art;
  const backdrop = phase === "bottle" ? "bottle-backdrop" : "mix-backdrop";

  return (
    <div
      className="absolute inset-0 z-[100] flex touch-none select-none flex-col overflow-hidden bg-[linear-gradient(180deg,#5b3a22,#3a2417)]"
      style={
        showBackdrop
          ? {
              backgroundImage: `url(${sauceUrl(backdrop)})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
      data-testid="sauce-station"
      data-phase={phase}
      data-practice={practice ? "1" : "0"}
      data-sauce={sauce.id}
      data-tier={tierN}
      data-volume={volume.toFixed(2)}
      data-blend={blend.toFixed(2)}
      data-match={match}
      data-bottle={bIndex}
      data-recipe={sauce.recipe.map(([id, n]) => `${id}:${n}`).join(",")}
    >
      <SauceStyles />
      {/* HUD */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={pause}
          aria-label={phase === "ready" ? "Back" : "Pause"}
          data-testid="sauce-pause"
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-[18px] text-gold"
        >
          <Art name="hud-round" className="absolute inset-0 h-full w-full object-fill" />
          <span className="relative">{phase === "ready" ? "←" : "⏸"}</span>
        </button>
        <Plaque
          testId="sauce-timer"
          className={cn(
            "h-12 min-w-0 flex-1 font-ui text-[20px] font-black tabular-nums",
            low ? "text-tomato" : "text-ivory",
          )}
        >
          {phase === "bottle" || phase === "done" ? (
            <>
              <span aria-hidden>🍾</span> {Math.min(bIndex + 1, bottles)} / {bottles}
            </>
          ) : (
            <>
              <span aria-hidden>⏱</span> {clock(msLeft)}
            </>
          )}
        </Plaque>
        <Plaque
          testId="sauce-name"
          className="h-12 min-w-[112px] max-w-[46%] px-2 font-ui text-[13px] font-black leading-tight text-ivory"
        >
          <span aria-hidden>{sauce.icon}</span>
          <span className="truncate">{sauce.name}</span>
        </Plaque>
      </div>

      {/* the order: the target swatch, the live swatch, the thickness */}
      <div className="mx-3 mt-2 flex items-stretch gap-2 rounded-2xl bg-[#f7edd7]/92 p-1.5 shadow-soft">
        <div className="flex flex-col items-center">
          <Swatch color={target.hex} testId="sauce-target" className="h-[58px] w-[58px]" />
          <span className="font-ui text-[10px] font-extrabold uppercase tracking-wide text-walnut/70">
            Match
          </span>
        </div>
        <div className="flex flex-col items-center">
          <Swatch color={mix.hex} testId="sauce-live" className="h-[58px] w-[58px]" />
          <span
            className="font-ui text-[12px] font-black tabular-nums text-walnut-dark"
            data-testid="sauce-match"
          >
            {liveMatch !== null ? `${liveMatch}%` : taste ? `${taste.match}%` : "—"}
          </span>
        </div>
        <div className="min-w-0 flex-1 font-ui">
          <div className="flex flex-wrap items-center gap-1" data-testid="sauce-help">
            {tier.help === "pips" || tier.help === "list" ? (
              sauce.recipe.map(([id, n]) => {
                const it = PANTRY_BY_ID[id]!;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-0.5 rounded-full bg-white/70 px-1 py-0.5 text-[11px] font-extrabold text-walnut-dark"
                  >
                    <span aria-hidden>{it.icon}</span>
                    {tier.help === "pips" ? (
                      <span>{n < 1 ? "·" : "●".repeat(Math.min(5, Math.round(n)))}</span>
                    ) : null}
                  </span>
                );
              })
            ) : (
              <span className="text-[12.5px] font-bold text-walnut/75">
                {tier.help === "color"
                  ? "Match the colour and the thickness."
                  : "Taste it and trust your eyes."}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {hint ? (
              <span className="flex flex-wrap gap-1" data-testid="sauce-hint">
                {hint.warmer ? <Chip>warmer</Chip> : null}
                {hint.cooler ? <Chip>cooler</Chip> : null}
                {hint.lighter ? <Chip>lighter</Chip> : null}
                {hint.darker ? <Chip>darker</Chip> : null}
                {!hint.warmer && !hint.cooler && !hint.lighter && !hint.darker ? (
                  <Chip>spot on</Chip>
                ) : null}
              </span>
            ) : (
              <span className="text-[11.5px] font-bold text-walnut/60">
                {sauce.emulsify
                  ? "Whisk the oil in slowly."
                  : sauce.chunks
                    ? "Chunky: leave the pieces."
                    : "Stir it smooth."}
              </span>
            )}
            <InfoTip tone="copper" label="How to mix">
              Tap the pantry to add. Match the colour swatch and keep the thickness in the green
              band. Circle the {toolName} in the green zone to blend.
            </InfoTip>
          </div>
        </div>
        <ThicknessGauge thick={thick} band={target.band} className="h-[74px] shrink-0" />
      </div>

      {note ? (
        <p
          key={note.text}
          className={cn(
            "sauce-pop mx-auto mt-1 rounded-full px-3 py-0.5 font-ui text-[13px] font-extrabold",
            note.tone === "good" && "bg-[#e4f1d6] text-[#2f6b1f]",
            note.tone === "bad" && "bg-[#fbd9cf] text-[#a02a14]",
            note.tone === "info" && "bg-[#f7edd7] text-walnut-dark",
          )}
          data-testid="sauce-note"
        >
          {note.text}
        </p>
      ) : (
        <div className="h-[22px]" />
      )}

      {phase === "bottle" || phase === "done" ? (
        <BottleStage
          sauce={sauce}
          color={mix.hex}
          fill={fill}
          pouring={pouring}
          capped={capped}
          index={bIndex}
          total={bottles}
          made={madeBottles}
          icon={sauce.icon}
          window_={tier.window}
          reducedMotion={reducedMotion}
          onDown={beginPour}
          onUp={releasePour}
          onSkip={() => finish(true)}
        />
      ) : (
        <>
          {/* the bowl and the tool */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <div
              ref={vesselRef}
              className="relative flex h-full max-w-full items-center justify-center"
              style={{ aspectRatio: "540 / 360" }}
              data-testid="sauce-stage"
              onPointerDown={onToolDown}
              onPointerMove={onToolMove}
              onPointerUp={onToolUp}
              onPointerCancel={onToolUp}
            >
              <Vessel
                kind={sauce.vessel}
                level={volume / cap}
                color={mix.hex}
                swirl={!reducedMotion && omega > 0.3}
                split={splitFlag}
                chunks={sauce.chunks ? chunkIndexes(sauce) : undefined}
                className="max-h-full w-full"
              />
              {/* the tool: in the hand while dragging, resting at the side otherwise */}
              <img
                src={sauceUrl(toolName)}
                alt=""
                draggable={false}
                data-testid="sauce-tool"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="pointer-events-none absolute z-10 h-[78%] w-auto"
                style={
                  !toolAt
                    ? { right: "-2%", bottom: "6%", transform: "rotate(14deg)", opacity: 0.95 }
                    : {
                        left: toolAt.x,
                        top: toolAt.y,
                        transform: "translate(-50%, -73%) rotate(6deg)",
                      }
                }
              />
              {phase === "mix" && volume > 0 && omega < 0.1 && !auto ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center font-ui text-[12px] font-extrabold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.8)]">
                  Circle the {toolName} in the bowl
                </span>
              ) : null}
            </div>
          </div>

          {/* the gauges and the small buttons */}
          <div className="mx-3 flex items-center gap-2">
            <DialGauge omega={omega} tool={sauce.tool} className="h-[58px] w-[58px] shrink-0" />
            <div className="min-w-0 flex-1">
              <EmulsionMeter blend={blend} className="w-full" />
              <p
                className="text-center font-ui text-[11px] font-extrabold text-ivory [text-shadow:0_1px_2px_rgba(0,0,0,.7)]"
                data-testid="sauce-speed"
              >
                {splitFlag
                  ? "Split! Whisk it back"
                  : zoneNow === "zone"
                    ? "Smooth: keep going"
                    : zoneNow === "fast"
                      ? "Too fast!"
                      : blend >= 0.9
                        ? "Blended"
                        : "Circle to blend"}
              </p>
            </div>
            <button
              type="button"
              data-testid="sauce-auto"
              aria-pressed={auto}
              onClick={toggleAuto}
              className={cn(
                "press h-12 min-w-[58px] rounded-2xl border px-2 font-ui text-[12px] font-extrabold leading-tight",
                auto
                  ? "border-[#2f6b1f] bg-[#cde9b8] text-[#1f4a14]"
                  : "border-walnut/30 bg-ivory/85 text-walnut",
              )}
            >
              {auto ? "Auto ✓" : `Auto ${toolName}`}
            </button>
            <button
              type="button"
              data-testid="sauce-undo"
              onClick={undo}
              disabled={log.length === 0}
              className="press h-12 w-12 rounded-2xl border border-walnut/30 bg-ivory/85 font-ui text-[18px] font-extrabold text-walnut disabled:opacity-40"
              aria-label="Undo the last scoop"
            >
              ↶
            </button>
          </div>

          {/* the pantry */}
          <div className="mx-3 mt-1.5 grid grid-cols-5 gap-1" data-testid="sauce-pantry">
            {items.map((it) => (
              <PantryTile
                key={it.id}
                item={it}
                count={scoops[it.id] ?? 0}
                disabled={phase !== "mix"}
                onDown={() => holdStart(it)}
                onUp={holdStop}
              />
            ))}
          </div>

          {/* the two big buttons */}
          <div className="mx-3 mb-3 mt-2 grid grid-cols-[1fr_1.4fr] gap-2">
            <button
              type="button"
              data-testid="sauce-taste"
              disabled={volume <= 0 || tastesLeft <= 0}
              onClick={doTaste}
              className="press flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-walnut/30 bg-ivory/90 font-ui text-[14px] font-extrabold text-walnut disabled:opacity-45"
            >
              {seal ? (
                <Sprite sheet="wax-seals" index={sealIndex} emoji="🥄" className="h-6" />
              ) : (
                <span aria-hidden>🥄</span>
              )}
              {Number.isFinite(tastesLeft) ? `Taste · ${tastesLeft}` : "Taste"}
            </button>
            <SortButton onClick={() => endMix(false)} testId="sauce-bottle-it">
              Bottle it →
            </SortButton>
          </div>
        </>
      )}

      {/* ready */}
      {phase === "ready" && !guide ? (
        <div
          className="absolute inset-x-0 bottom-[84px] z-30 grid place-items-center px-6"
          data-testid="sauce-ready"
        >
          <div className="w-full max-w-[320px] rounded-3xl border-2 border-[#e6b866] bg-[#f7edd7] p-4 text-center shadow-lift">
            <div className="mx-auto flex w-fit items-center gap-2">
              <SauceIcon index={icon} emoji={sauce.icon} className="h-14" />
              <Swatch color={target.hex} className="h-14 w-14" />
            </div>
            <p className="mt-1 font-display text-[19px] font-extrabold text-walnut-dark">
              {sauce.name}
            </p>
            <p className="mt-1 font-ui text-[13.5px] font-bold text-walnut/80">
              Match the colour · {Math.round(tier.timeMs / 1000)} s · {bottles} bottles
              {practice ? " · practice" : ""}
            </p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={start} testId="sauce-start">
                Start
              </SortButton>
              {hasPrepCook && !practice ? (
                <SortButton
                  quiet
                  testId="sauce-auto-cook"
                  onClick={() => {
                    onAction({ kind: "auto" });
                    onExit();
                  }}
                >
                  🧑‍🍳 Prep Cook does it
                </SortButton>
              ) : null}
              {practice && onWatchAd && canOfferRoundsAd(save, level) ? (
                <RoundsAdButton onWatch={onWatchAd} onGranted={onNext} />
              ) : null}
              <SortButton quiet onClick={onExit} testId="sauce-leave">
                Not now
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {guide ? (
        <HowTo
          tool={toolName}
          onDone={() => {
            setGuide(false);
            if (!howtoSeen(save)) onAction({ kind: "howto" });
          }}
        />
      ) : null}

      {phase === "paused" ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-6"
          data-testid="sauce-paused"
        >
          <div className="w-full max-w-[300px] rounded-3xl bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">Paused</p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={resume} testId="sauce-resume">
                Resume
              </SortButton>
              <SortButton
                quiet
                testId="sauce-skip"
                onClick={() => {
                  onAction({ kind: "skip" });
                  onExit();
                }}
              >
                Leave the station
              </SortButton>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "done" && result ? (
        <ResultPanel
          result={result}
          sauce={sauce}
          practice={practice}
          left={roundsLeft(save, level)}
          onWatchAd={canOfferRoundsAd(save, level) ? onWatchAd : undefined}
          pins={pinsOf(save)}
          matchPct={matchPercent(result.mix.de)}
          onNext={onNext}
          onShelf={onShelf}
          onExit={onExit}
          onAgain={onAgain}
        />
      ) : null}
    </div>
  );
}

const chunkIndexes = (s: SauceDef): number[] => {
  const map: Record<string, number> = {
    tomato: 0,
    onion: 1,
    pineapple: 2,
    corn: 3,
    mango: 5,
    avocado: 6,
    chilli: 7,
    garlic: 8,
  };
  const base = (s.chunks ?? []).map((c) => map[c] ?? 0);
  return [...base, ...base, ...base, 4].slice(0, 8);
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#ffe2a8] px-1.5 py-0.5 text-[11px] font-extrabold text-walnut-dark">
      {children}
    </span>
  );
}

function PantryTile({
  item,
  count,
  disabled,
  onDown,
  onUp,
}: {
  item: PantryItem;
  count: number;
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  const art = item.art;
  const idx = art.cell;
  return (
    <button
      type="button"
      data-testid={`sauce-pantry-${item.id}`}
      disabled={disabled}
      aria-label={`Add ${item.name}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "press relative flex h-[54px] flex-col items-center justify-end overflow-hidden rounded-xl border px-0.5 pb-0.5 pt-1 shadow-soft",
        item.kind === "produce"
          ? "border-[#7aa05a] bg-[#e6f0d2]/92"
          : "border-[#c9a45a] bg-[#f7edd7]/92",
        disabled && "opacity-60",
      )}
    >
      <span className="flex min-h-0 flex-1 items-end justify-center">
        <Sprite
          sheet={art.sheet}
          index={idx}
          emoji={item.icon}
          className="max-h-[30px] min-h-0 w-auto"
          style={{ height: 30 }}
        />
      </span>
      <span className="mt-px w-full truncate text-center font-ui text-[10px] font-extrabold leading-none text-walnut-dark">
        {item.name}
      </span>
      {count > 0 ? (
        <span
          className="absolute right-0.5 top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#d23b2a] px-1 font-ui text-[10px] font-black leading-none text-white"
          data-testid={`sauce-count-${item.id}`}
        >
          {Number.isInteger(count) ? count : count.toFixed(2).replace(/0$/, "")}
        </span>
      ) : null}
    </button>
  );
}

// ── Stage 2: bottling ────────────────────────────────────────────────────────

function BottleStage({
  sauce,
  color,
  fill,
  pouring,
  capped,
  index,
  total,
  made,
  icon,
  window_,
  reducedMotion,
  onDown,
  onUp,
  onSkip,
}: {
  sauce: SauceDef;
  color: string;
  fill: number;
  pouring: boolean;
  capped: boolean;
  index: number;
  total: number;
  made: number[];
  icon: string;
  window_: number;
  reducedMotion: boolean;
  onDown: () => void;
  onUp: () => void;
  onSkip: () => void;
}) {
  const belt = useSauceArt("belt");
  const jugOk = useSauceArt("pour-tools");
  const done = index >= total;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-testid="sauce-bottling">
      <div className="relative min-h-0 flex-1">
        {/* the belt */}
        <div
          className="absolute inset-x-0 top-[62%] h-[13%]"
          style={
            belt
              ? {
                  backgroundImage: `url(${sauceUrl("belt")})`,
                  backgroundSize: "auto 100%",
                  backgroundRepeat: "repeat-x",
                  animation: capped && !reducedMotion ? "sauce-belt .7s linear" : undefined,
                }
              : { background: "linear-gradient(#444,#2a2a2a)", borderTop: "4px solid #9aa" }
          }
          aria-hidden
        />
        {!done ? (
          <div className="absolute left-1/2 top-[4%] h-[66%] w-[30%] -translate-x-1/2">
            <BottleView
              shape={sauce.bottle}
              fill={fill}
              color={color}
              capped={capped}
              label={capped ? sauce.label : undefined}
              emoji={icon}
              mark={capped ? undefined : FILL_LINE}
              className="mx-auto h-full max-w-full"
            />
            {/* the jug above it, tilted while pouring, and the stream */}
            <div
              className="absolute left-[54%] -top-[4%] h-[44%] w-[70%] origin-[0%_30%]"
              style={{
                transform: `rotate(${pouring ? -32 : -6}deg)`,
                transition: reducedMotion ? undefined : "transform .2s",
              }}
              aria-hidden
            >
              {jugOk ? (
                <Sprite sheet="pour-tools" index={0} emoji="🫗" className="h-full w-auto" />
              ) : (
                <span className="block h-full w-[70%] rounded-b-3xl rounded-t-lg bg-[#c9833e]" />
              )}
            </div>
            {pouring ? (
              <span
                aria-hidden
                data-testid="sauce-stream"
                className="absolute left-1/2 w-[6px] -translate-x-1/2 rounded-full"
                style={{
                  top: "14%",
                  bottom: `${(1 - bottleSurface(sauce.bottle, fill)) * 100}%`,
                  backgroundColor: color,
                }}
              />
            ) : null}
          </div>
        ) : null}
        {/* the crate of finished bottles */}
        <div className="absolute inset-x-0 bottom-0 flex h-[19%] items-end justify-center gap-1 px-4">
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className="h-full w-[12%]">
              {i < made.length ? (
                <BottleView
                  shape={sauce.bottle}
                  fill={made[i]!}
                  color={color}
                  capped
                  className="mx-auto h-full max-w-full"
                />
              ) : (
                <span
                  aria-hidden
                  className="block h-full w-full rounded-lg border-2 border-dashed border-white/40"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mx-3 mb-3 mt-2 grid gap-2">
        <button
          type="button"
          data-testid="sauce-pour"
          disabled={done || capped}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            onDown();
          }}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "press wood flex h-16 w-full items-center justify-center rounded-2xl border border-walnut-dark/50 font-ui text-[17px] font-black text-ivory shadow-soft",
            pouring && "brightness-110",
          )}
        >
          {pouring ? "Let go at the line!" : "Hold to pour"}
        </button>
        <p className="text-center font-ui text-[11.5px] font-bold text-ivory [text-shadow:0_1px_2px_rgba(0,0,0,.7)]">
          Stop on the dashed line (±{Math.round(window_ * 100)}%)
        </p>
        <SortButton quiet testId="sauce-skip-bottling" onClick={onSkip}>
          Skip bottling (2 stars at most)
        </SortButton>
      </div>
    </div>
  );
}

// ── The result and the how-to ────────────────────────────────────────────────

function ResultPanel({
  result,
  sauce,
  practice,
  left,
  onWatchAd,
  pins,
  matchPct,
  onNext,
  onShelf,
  onExit,
  onAgain,
}: {
  result: {
    stars: 0 | 1 | 2 | 3;
    score: number;
    mix: MixResult;
    bottleStars: 0 | 1 | 2 | 3 | null;
    timedOut: boolean;
    effects: RoundEffects;
  };
  sauce: SauceDef;
  practice: boolean;
  left: number;
  onWatchAd?: (() => Promise<"ok" | "no">) | undefined;
  pins: number;
  matchPct: number;
  onNext: () => void;
  onShelf: () => void;
  onExit: () => void;
  onAgain: () => void;
}) {
  const e = result.effects;
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-5"
      data-testid="sauce-result"
      data-stars={result.stars}
    >
      <div className="relative w-full max-w-[340px] px-[22px] pb-[50px] pt-[96px] text-center">
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
          {result.stars === 3
            ? "Master saucier!"
            : result.stars > 0
              ? "Sauce bottled!"
              : "Back to the pantry"}
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
          data-testid="sauce-final-score"
        >
          {result.score.toLocaleString("en-US")}
          {e.newBest ? <span className="ml-1.5 text-copper">new best!</span> : null}
        </p>
        <p className="relative mt-0.5 font-ui text-[12.5px] font-bold text-walnut/70">
          {sauce.name} · {matchPct}% match
          {result.bottleStars === null ? " · not bottled" : ""}
        </p>
        {practice ? (
          <p className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
            Practice: no reward
          </p>
        ) : (
          <p
            className="relative mt-1 font-ui text-[13px] font-extrabold text-olive"
            data-testid="sauce-reward"
          >
            {e.hype > 0 ? `⚡ +${e.hype} Hype` : "No Hype this time"}
            {e.pin ? " · 🎖️ new Saucier pin!" : ""}
          </p>
        )}
        {!practice && e.pin ? (
          <Sprite
            sheet="pins"
            index={Math.min(11, Math.max(0, pins - 1))}
            emoji="🎖️"
            className="relative mx-auto mt-1 h-[48px]"
          />
        ) : null}
        {!practice && e.mastered ? (
          <p
            className="relative mt-1 flex items-center justify-center gap-1.5 font-ui text-[13px] font-extrabold text-copper"
            data-testid="sauce-mastered"
          >
            <SauceIcon index={sauceIndex(sauce.id)} emoji={sauce.icon} className="h-8" /> On your
            Sauce Shelf!
          </p>
        ) : null}
        {!practice && e.streak >= 2 ? (
          <p className="relative mt-1 font-ui text-[12.5px] font-extrabold text-copper">
            🔥 {e.streak} perfect sauces in a row
          </p>
        ) : null}
        <div className="relative mt-3 grid gap-2">
          {!practice && left > 0 ? (
            <SortButton onClick={onNext} testId="sauce-next">
              Next sauce · {left}
            </SortButton>
          ) : null}
          {!practice && left === 0 && onWatchAd ? <RoundsAdButton onWatch={onWatchAd} /> : null}
          <SortButton quiet={!practice && left > 0} onClick={onShelf} testId="sauce-shelf-btn">
            Sauce Shelf
          </SortButton>
          <SortButton quiet onClick={onExit} testId="sauce-done">
            Done
          </SortButton>
          <SortButton quiet onClick={onAgain} testId="sauce-again">
            Again · practice
          </SortButton>
        </div>
      </div>
    </div>
  );
}

/**
 * "Watch an ad · 3 more rounds today" (developer 2026-11-10): shown after the free rounds are used, once a day. It says what it gives BEFORE the ad,
 * is never needed to progress, and the rounds are granted by the app only when the ad reports `rewarded`. It gives rounds (stars, Hype, pins), no money.
 */
function RoundsAdButton({
  onWatch,
  onGranted,
}: {
  onWatch: () => Promise<"ok" | "no">;
  onGranted?: (() => void) | undefined;
}) {
  const [state, setState] = useState<"idle" | "busy" | "no">("idle");
  return (
    <>
      <SortButton
        quiet
        testId="sauce-ad"
        onClick={() => {
          if (state === "busy") return;
          setState("busy");
          void onWatch().then((r) => {
            setState(r === "ok" ? "idle" : "no");
            if (r === "ok") onGranted?.();
          });
        }}
      >
        {state === "busy" ? "Ad playing…" : `▶ Watch an ad · ${SAUCE_AD_ROUNDS} more rounds today`}
      </SortButton>
      {state === "no" ? (
        <p
          role="status"
          data-testid="sauce-ad-no"
          className="font-ui text-[12.5px] font-bold text-copper"
        >
          No ad right now. Try again later!
        </p>
      ) : null}
    </>
  );
}

function HowTo({ tool, onDone }: { tool: string; onDone: () => void }) {
  const rows = [
    { icon: "🫙", title: "Pour", line: "Tap the pantry to add. Match the colour swatch." },
    {
      icon: "🥣",
      title: "Blend",
      line: `Circle the ${tool} in the green zone. Oil too fast makes a dressing split.`,
    },
    { icon: "🍾", title: "Bottle", line: "Hold to pour, let go at the dashed line." },
  ];
  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-4"
      data-testid="sauce-guide"
    >
      <div className="w-full max-w-[340px] rounded-3xl border-2 border-[#e6b866] bg-[#f7edd7] p-4">
        <p className="text-center font-display text-[20px] font-extrabold text-walnut-dark">
          Sauce Station
        </p>
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.title} className="flex items-center gap-2 rounded-2xl bg-white/60 p-2">
              <span aria-hidden className="text-[26px]">
                {r.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-ui text-[14px] font-extrabold text-walnut-dark">
                  {r.title}
                </span>
                <span className="block font-ui text-[12.5px] text-walnut/75">{r.line}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-center font-ui text-[12px] font-bold text-walnut/65">
          Can&apos;t drag? Tap Auto to blend for you.
        </p>
        <div className="mt-3">
          <SortButton onClick={onDone} testId="sauce-guide-ok">
            Got it
          </SortButton>
        </div>
      </div>
    </div>
  );
}

export default SauceStationGame;
