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
  OMEGA_WINDOW_MS,
  ZONE_GRACE_MS,
  bottleScore,
  BOTTLE_GOOD,
  lostStarReasons,
  bottleStars,
  blendStep,
  gradeMix,
  howtoSeen,
  isMade,
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
  SAUCE_BY_ID,
  volumeOf,
  rng,
  bowlChunks,
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
  PourScene,
  ThicknessGauge,
  TOOL_BOWL,
  ToolInBowl,
  Vessel,
} from "./SauceParts";
import { useLandscape } from "@/components/kc/game/layoutMode";
import { landscapeGameArt } from "@/game/landscapeArt";

/**
 * SAUCE STATION — the screen (rules: business/sauceStation.ts, plan: docs/planning/SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md).
 * STAGE 1: tap the pantry to pour into the bowl until the live colour matches the swatch and the thickness is in the green band, then circle the
 * whisk (or the spoon) in the green speed zone to blend it; a dressing poured too fast before it is blended SPLITS. STAGE 2: hold to pour the batch
 * into bottles and let go at the fill line. The game never moves money or stock: the effects are the stars, Hype, the Saucier pins and the Sauce Shelf.
 * "Auto whisk" is the no-drag way to blend. Reduced Motion: no swirl, no pop, no chunk drift.
 */

type Phase = "ready" | "mix" | "bottle" | "paused" | "done";
const TICK_MS = 50;
/** A tier that does not list the recipe counts Pour as done once the colour is this close (or the blend has started). */
const POURED_MATCH = 70;
const HOLD_REPEAT_MS = 280;
const TASTE_SHOW_MS = 5000;
/** Nothing done for this long while mixing: the next thing to do lights up. */
const IDLE_HINT_MS = 4000;
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
  /** Restart from the pause card: the same sauce, the same pantry, from the top (no new attempt, so nothing is dealt again). */
  const [restarts, setRestarts] = useState(0);
  const [practice, setPractice] = useState(false);
  // "Play again" makes the SAME sauce again (developer 2026-11-11: it dealt a different one); "Next round" deals the day's next sauce.
  const [again, setAgain] = useState<string | null>(null);
  return (
    <Round
      key={`${attempt}-${restarts}`}
      {...props}
      attempt={attempt}
      forcePractice={practice}
      sameSauceId={again}
      onRestart={() => setRestarts((n) => n + 1)}
      onAgain={(sauceId) => {
        setPractice(true);
        setAgain(sauceId);
        setAttempt((n) => n + 1);
      }}
      onNext={() => {
        setPractice(false);
        setAgain(null);
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
  sameSauceId,
  onAgain,
  onRestart,
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
  /** "Play again": the sauce just made (null for a new round). */
  sameSauceId: string | null;
  onAgain: (sauceId: string) => void;
  onRestart: () => void;
  onNext: () => void;
}) {
  const tier = tierAt(level);
  const tierN = tierNumberAt(level);
  // A round past today's three (or "Again") is free play: it scores, but gives nothing. Latched as the round opens.
  const [practice] = useState(() => forcePractice || roundsLeft(save, level) === 0);
  const sauce: SauceDef = useMemo(() => {
    if (!practice) return sauceOfTheDay(save, level);
    const same = sameSauceId ? SAUCE_BY_ID[sameSauceId] : undefined;
    if (same) return same;
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
  const shownSecRef = useRef(-1);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const [splitFlag, setSplitFlag] = useState(false);
  const [auto, setAuto] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [tastesLeft, setTastesLeft] = useState(tier.tastes);
  const [taste, setTaste] = useState<{ match: number; hint: ReturnType<typeof colorHint> } | null>(
    null,
  );
  // The finger over the bowl, read by the whisk on every frame (no render per pointer move: the whisk follows the finger at once).
  const toolPos = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  // THE IDLE HINT (developer 2026-11-13: "if the player is confused for a few seconds, glow which ingredient to pour"): nothing done for
  // IDLE_HINT_MS while mixing lights up the ONE thing to do next (an ingredient, the whisk, or Bottle it). Any action clears it.
  const lastAct = useRef(performance.now());
  const [idle, setIdle] = useState(false);
  const acted = () => {
    lastAct.current = performance.now();
    setIdle((v) => (v ? false : v));
  };
  useEffect(() => {
    const t = window.setInterval(() => {
      if (phaseRef.current !== "mix") {
        lastAct.current = performance.now();
        setIdle((v) => (v ? false : v));
        return;
      }
      const quiet =
        !autoRef.current && !dragging.current && performance.now() - lastAct.current > IDLE_HINT_MS;
      setIdle((v) => (v === quiet ? v : quiet));
    }, 400);
    return () => window.clearInterval(t);
  }, []);
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
    /** Why it is not three stars (sauceStation lostStarReasons); empty for three. */
    reasons: string[];
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
  /** When the whisk last made its sound (a soft swish about every 240 ms while it turns). */
  const lastWhiskAt = useRef(0);
  const lastAng = useRef<number | null>(null);
  /** The whisk's unwrapped angle and its recent samples: the speed is the net turn over `OMEGA_WINDOW_MS`. */
  const cumAng = useRef(0);
  const angLog = useRef<{ t: number; a: number }[]>([]);
  /** Until when a brief wobble out of the green zone still counts as in it. */
  const zoneHoldUntil = useRef(0);
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
        // A short grace: a wobble just outside the green zone, soon after being in it, still blends (the player's hand is not a metronome).
        const now = performance.now();
        if (w >= lo && w <= hi) zoneHoldUntil.current = now + ZONE_GRACE_MS;
        else if (now < zoneHoldUntil.current && w >= lo * 0.75 && w <= hi * 1.2) w = (lo + hi) / 2;
        const hasAny = volumeOf(scoopsRef.current) > 0;
        const nb = hasAny ? blendStep(blendRef.current, sauce.tool, w, TICK_MS / 1000) : 0;
        blendRef.current = nb;
        setBlend(nb);
        setOmega(w);
        // the clock shows whole seconds: draw once a second (it used to re-render the whole round 20 times a second)
        const secNow = Math.ceil(msRef.current / 1000);
        if (secNow !== shownSecRef.current) {
          shownSecRef.current = secNow;
          setMsLeft(msRef.current);
        }
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
      lastAct.current = performance.now();
      setIdle(false);
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
      // each kind of ingredient sounds like itself going into the bowl (developer 2026-11-22)
      AudioManager.playSfx(
        item.kind === "oil" ||
          item.kind === "acid" ||
          item.kind === "liquid" ||
          item.kind === "cream"
          ? "sauceLiquid"
          : item.kind === "spice"
            ? "sauceSpice"
            : item.kind === "produce"
              ? "sauceProduce"
              : "sauceJar",
      );
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
    // an undone oil scoop no longer counts toward "too fast" (it was taken back)
    if (item.kind === "oil") oilLog.current = oilLog.current.slice(0, -1);
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
    // The angle is measured round the bowl's own middle, on the bowl's own ellipse (the same numbers the whisk is drawn with), so circling what
    // you SEE is what counts (it used to be a different centre and a stretched axis).
    const dx = ((e.clientX - r.left) / r.width - TOOL_BOWL.cx) / TOOL_BOWL.rx;
    const dy = ((e.clientY - r.top) / r.height - TOOL_BOWL.cy) / TOOL_BOWL.ry;
    toolPos.current = { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    lastAct.current = performance.now();
    if (Math.hypot(dx, dy) < 0.12) return;
    const ang = Math.atan2(dy, dx);
    const now = performance.now();
    if (lastAng.current !== null && now > lastMove.current) {
      let d = ang - lastAng.current;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      // The speed is the net turn over the last 280 ms, not one event's angle over its few milliseconds (that flickered in and out of the band).
      cumAng.current += d;
      const log = angLog.current;
      log.push({ t: now, a: cumAng.current });
      while (log.length > 2 && now - log[0]!.t > OMEGA_WINDOW_MS) log.shift();
      const span = (now - log[0]!.t) / 1000;
      if (span >= 0.06) {
        const turns = Math.min(7, Math.abs(cumAng.current - log[0]!.a) / (2 * Math.PI) / span);
        omegaRef.current = omegaRef.current * 0.5 + turns * 0.5;
      }
    }
    lastAng.current = ang;
    lastMove.current = now;
    if (omegaRef.current > 0.3 && now - lastWhiskAt.current > 240) {
      lastWhiskAt.current = now;
      AudioManager.playSfx("sauceWhisk");
    }
  };
  const onToolDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "mix") return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    lastAng.current = null;
    angLog.current = [];
    cumAng.current = 0;
    lastMove.current = performance.now();
    acted();
    onToolMove(e);
  };
  const onToolUp = () => {
    dragging.current = false;
    lastAng.current = null;
    toolPos.current = null;
    lastAct.current = performance.now();
  };
  const toggleAuto = () => {
    const on = !autoRef.current;
    autoRef.current = on;
    setAuto(on);
    acted();
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
      const bottled = skippedBottling
        ? null
        : { scores, spill: spillSum.current, bottles, filled: filledCount.current };
      const bs = bottled ? bottleStars(bottled) : null;
      // an empty bowl is never a sauce, however well the (empty) bottles are filled
      const stars = volumeOf(scoopsRef.current) <= 0 ? 0 : overallStars(m.mix.stars, bs);
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
        reasons: lostStarReasons(m.mix, bottled, stars),
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
    AudioManager.playSfx("sauceBottle");
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
        // The player left (Leave the station, Back) during the pause after this bottle: nothing is finished or paid after they have gone (audit 2026-11-18).
        if (!aliveRef.current) return;
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
  // (on the tiers with limited tastes the seal must not show the live match: only a taste does)
  const sealMatch = taste?.match ?? liveMatch ?? 0;
  const sealIndex = sealMatch >= 90 ? 2 : sealMatch >= 70 ? 1 : 0;
  const icon = sauceIndex(sauce.id);
  const zoneNow = speedOf(sauce.tool, omega);
  // What to pour and do next (developer 2026-11-11: "not even understanding what to pour and do"): the recipe items still to add (while the tier
  // shows the recipe), then the whisk, then the bottles, in plain steps.
  // The recipe is shown on EVERY tier (developer 2026-11-17: "why is the sauce station still not showing proper steps"); a harder tier never hides it.
  const needs = sauce.recipe.map(([id, n]) => ({
    id,
    name: PANTRY_BY_ID[id]!.name,
    icon: PANTRY_BY_ID[id]!.icon,
    want: n,
    have: scoops[id] ?? 0,
    left: Math.max(0, +(n - (scoops[id] ?? 0)).toFixed(2)),
  }));
  // TOO MUCH (developer 2026-11-17: a tick and "Looks good!" showed while the bowl held more than the recipe asks): an ingredient poured past its
  // count, or one that is not in the recipe at all, is called out, never ticked.
  const overOf = (x: { have: number; want: number }) => x.have > x.want + 1e-6;
  const extras = Object.keys(scoops)
    .filter((id) => !sauce.recipe.some(([rid]) => rid === id) && PANTRY_BY_ID[id])
    .map((id) => ({ id, name: PANTRY_BY_ID[id]!.name, icon: PANTRY_BY_ID[id]!.icon }));
  const tooMuch: string[] = [
    ...needs.filter(overOf).map((x) => x.name),
    ...extras.map((x) => x.name),
  ];
  const needLeft: Record<string, number | null> = Object.fromEntries(
    needs.map((x) => [x.id, overOf(x) ? null : x.left]),
  );
  const toAdd = needs.filter((x) => x.left > 0);
  const step: { n: 1 | 2 | 3; text: string } = splitFlag
    ? { n: 2, text: `Split! Circle the ${toolName} slowly to smooth it` }
    : tooMuch.length > 0
      ? { n: 1, text: `Too much ${tooMuch[0]}: tap ↶ to take one back` }
      : blend >= 0.9 && volume > 0 && toAdd.length === 0
        ? { n: 3, text: "Looks good! Tap Bottle it" }
        : volume > 0 && toAdd.length === 0
          ? {
              n: 2,
              text: sauce.chunks
                ? `Stir the ${toolName} gently, keep the pieces`
                : `Now circle the ${toolName} in the green zone`,
            }
          : toAdd.length > 0
            ? {
                n: 1,
                text: `Pour: ${toAdd
                  .slice(0, 3)
                  .map((x) => `${x.name} ${x.left < 1 ? "a pinch" : `×${x.left}`}`)
                  .join(" · ")}${toAdd.length > 3 ? " …" : ""}`,
              }
            : volume > 0 && blend >= 0.9
              ? { n: 3, text: "Match the colour, then tap Bottle it" }
              : volume > 0
                ? { n: 1, text: `Match the colour, then circle the ${toolName}` }
                : { n: 1, text: "Tap the ingredients to pour them in" };
  // What the idle hint lights up: the next ingredient (only while the tier shows the recipe), else the whisk, else Bottle it.
  const hintAt: string | null =
    !idle || phase !== "mix"
      ? null
      : step.n === 1 && toAdd.length > 0
        ? `item:${toAdd[0]!.id}`
        : step.n === 2
          ? "whisk"
          : step.n === 3
            ? "bottle"
            : null;
  // Standing products (see PantryTile) are drawn without cards: up to 10 items use 5 columns; a longer shelf packs as many 48 px columns as fit (7 on a
  // 390 px phone, 5 on a 320 px one), so the bowl keeps its height and every tile stays a full touch target.
  const productsOn = useSauceArt(`products/${items[0]?.id ?? "mayo"}`);
  const pantryCols =
    !productsOn || items.length <= 10
      ? "repeat(5, minmax(0, 1fr))"
      : "repeat(auto-fill, minmax(58px, 1fr))";
  // LANDSCAPE (developer 2026-11-20): the wide kitchen behind the game's own landscape layout (the land: classes; mixing is two columns, bottling its own stage).
  const wide = useLandscape();
  const showBackdrop = phase === "bottle" ? artBottle : art;
  // the two-column phone-landscape layout is for mixing; bottling keeps its own full-width stage
  const twoCol = phase !== "bottle" && phase !== "done";
  const backdrop = phase === "bottle" ? "bottle-backdrop" : "mix-backdrop";

  return (
    <div
      className="absolute inset-0 z-[100] flex touch-none select-none flex-col overflow-hidden bg-[linear-gradient(180deg,#5b3a22,#3a2417)]"
      style={
        wide
          ? {
              backgroundImage: `url(${landscapeGameArt(phase === "bottle" ? "sauce-bottle" : "sauce-mix")})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : showBackdrop
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
      <div className="flex items-center gap-2 px-3 pt-3 land:pt-1.5">
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

      {/* A phone on its side (developer 2026-11-18): the bowl and its gauges on the left, the steps, the pantry and the buttons on the right, so the pantry is on
          screen. Upright: the two groups are `display: contents` and `order-*` restores the single column, so nothing moves. */}
      <div className={cn("contents", twoCol && "land:flex land:min-h-0 land:flex-1 land:gap-2")}>
        <div
          className={cn(
            "contents",
            twoCol && "land:flex land:min-h-0 land:min-w-0 land:flex-1 land:basis-0 land:flex-col",
          )}
        >
          {/* the order: the target swatch, the live swatch, the thickness */}
          <div className="order-1 mx-3 mt-2 flex items-stretch gap-2 rounded-2xl bg-[#f7edd7]/92 p-1.5 shadow-soft land:mx-2 land:mt-1">
            <div className="flex flex-col items-center">
              <Swatch
                color={target.hex}
                testId="sauce-target"
                className="h-[58px] w-[58px] [@media(max-height:620px)]:h-10 [@media(max-height:620px)]:w-10"
              />
              <span className="font-ui text-[10px] font-extrabold uppercase tracking-wide text-walnut/70">
                Match
              </span>
            </div>
            <div className="flex flex-col items-center">
              <Swatch
                color={mix.hex}
                testId="sauce-live"
                className="h-[58px] w-[58px] [@media(max-height:620px)]:h-10 [@media(max-height:620px)]:w-10"
              />
              <span
                className="font-ui text-[12px] font-black tabular-nums text-walnut-dark"
                data-testid="sauce-match"
              >
                {liveMatch !== null ? `${liveMatch}%` : taste ? `${taste.match}%` : "Taste ↓"}
              </span>
            </div>
            <div className="min-w-0 flex-1 font-ui">
              <div
                className="flex flex-wrap items-center gap-1 [@media(max-height:620px)]:grid [@media(max-height:620px)]:grid-cols-2"
                data-testid="sauce-help"
              >
                {needs.map((x) => (
                  <span
                    key={x.id}
                    data-testid={`sauce-need-${x.id}`}
                    data-left={x.left}
                    className={cn(
                      "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] [@media(max-height:620px)]:px-1 [@media(max-height:620px)]:text-[10.5px] font-extrabold",
                      overOf(x)
                        ? "bg-[#f6cfc4] text-[#a8321f]"
                        : x.left === 0
                          ? "bg-[#d9eec4] text-[#2f6b1f]"
                          : "bg-white/75 text-walnut-dark",
                    )}
                  >
                    <span aria-hidden>{x.icon}</span>
                    <span className="max-w-[52px] truncate [@media(max-height:620px)]:min-w-0 [@media(max-height:620px)]:max-w-none">
                      {x.name}
                    </span>
                    <span className="tabular-nums">
                      {overOf(x)
                        ? "over"
                        : x.left === 0
                          ? "✓"
                          : x.want < 1
                            ? "pinch"
                            : `${Math.min(x.have, x.want)}/${x.want}`}
                    </span>
                  </span>
                ))}
                {extras.map((x) => (
                  <span
                    key={x.id}
                    data-testid={`sauce-extra-${x.id}`}
                    className="flex items-center gap-0.5 rounded-full bg-[#f6cfc4] px-1.5 py-0.5 text-[11px] [@media(max-height:620px)]:px-1 [@media(max-height:620px)]:text-[10.5px] font-extrabold text-[#a8321f]"
                  >
                    <span aria-hidden>{x.icon}</span>
                    <span className="max-w-[52px] truncate [@media(max-height:620px)]:min-w-0 [@media(max-height:620px)]:max-w-none">
                      {x.name}
                    </span>
                    <span>extra</span>
                  </span>
                ))}
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
                  <span className="text-[11.5px] font-bold text-walnut/75">
                    {sauce.emulsify ? "Oil in slowly" : "Stir it smooth"}
                  </span>
                )}
                <InfoTip tone="copper" label="How to mix">
                  Tap the pantry to add. Match the colour swatch and keep the thickness in the green
                  band. Circle the {toolName} in the green zone to blend.
                </InfoTip>
              </div>
            </div>
            <ThicknessGauge
              thick={thick}
              band={target.band}
              className="h-[74px] shrink-0 [@media(max-height:620px)]:h-[56px]"
            />
          </div>

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
              className="order-4"
            />
          ) : (
            <>
              {/* the bowl and the tool */}
              {/* the pot sits LOW in its space (developer 2026-11-11: "let the pot be a little down"): on the counter, not floating */}
              <div className="relative order-4 flex min-h-0 flex-1 items-end justify-center px-2 pb-4 land:pb-1">
                <div
                  ref={vesselRef}
                  // Developer 2026-11-21 ("put the bowl a little more down to the table and place it properly"): in a wide window the bowl stood at the very
                  // top edge of the counter; it is let down onto the table.
                  className="relative flex h-full max-w-full items-center justify-center landx:translate-y-[9%]"
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
                    chunks={sauce.chunks ? bowlChunks(sauce, scoops) : undefined}
                    className="max-h-full w-full"
                  />
                  {/* the tool: in the hand while dragging (handle up, head in the bowl), standing in the bowl otherwise */}
                  <ToolInBowl
                    name={toolName}
                    posRef={toolPos}
                    auto={auto && phase === "mix" && volume > 0}
                    stirring={omega > 0.3 || auto}
                    reducedMotion={reducedMotion}
                    hasLiquid={volume > 0}
                  />
                  {hintAt === "whisk" && !reducedMotion ? (
                    <span
                      aria-hidden
                      data-testid="sauce-hint-whisk"
                      className="sauce-hint-ring pointer-events-none absolute z-[8] rounded-[50%] border-4 border-[#ffd25a]"
                      style={{
                        left: `${(TOOL_BOWL.cx - TOOL_BOWL.rx) * 100}%`,
                        top: `${(TOOL_BOWL.cy - TOOL_BOWL.ry) * 100}%`,
                        width: `${TOOL_BOWL.rx * 200}%`,
                        height: `${TOOL_BOWL.ry * 200}%`,
                      }}
                    />
                  ) : null}
                  {phase === "mix" && volume > 0 && omega < 0.1 && !auto ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center font-ui text-[12px] font-extrabold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.8)]">
                      Circle the {toolName} in the bowl
                    </span>
                  ) : null}
                </div>
              </div>

              {/* the gauges and the small buttons */}
              <div className="order-5 mx-3 flex items-center gap-2 land:mx-2 land:mb-1">
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
                    hintAt === "whisk" && !reducedMotion && "sauce-hint",
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
            </>
          )}
        </div>
        <div
          className={cn(
            "contents",
            twoCol && "land:flex land:min-h-0 land:min-w-0 land:flex-1 land:basis-0 land:flex-col",
          )}
        >
          {/* the steps of the sauce, always in view (developer 2026-11-16: "the sauce station is not showing any steps to do the preparation"):
          what is done is ticked, the current one is lit, and the line below says what to do now; the recipe list above is on every tier too (2026-11-17)) */}
          {phase === "mix" ? (
            <ol
              className="order-2 mx-3 mt-1.5 flex items-center justify-center gap-1.5 font-ui text-[12px] font-extrabold land:mx-2"
              aria-label="Steps"
              data-testid="sauce-steps"
              data-now={step.n}
            >
              {(
                [
                  [1, "Pour"],
                  [2, "Blend"],
                  [3, "Bottle"],
                ] as const
              ).map(([n, label], i) => {
                const state = n < step.n ? "done" : n === step.n ? "now" : "next";
                return (
                  <li
                    key={n}
                    className="flex items-center gap-1.5"
                    data-step-n={n}
                    data-state={state}
                  >
                    {i > 0 ? <span aria-hidden className="h-px w-3 bg-ivory/50" /> : null}
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5",
                        state === "now" && "bg-gold text-walnut-dark shadow-soft",
                        state === "done" && "bg-[#cde9b8] text-[#2f6b1f]",
                        state === "next" && "bg-[#2f2118]/70 text-ivory/80",
                      )}
                    >
                      <span aria-hidden className="tabular-nums">
                        {state === "done" ? "✓" : n}
                      </span>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {note ? (
            <p
              key={note.text}
              className={cn(
                "sauce-pop order-3 mx-auto mt-1 rounded-full px-3 py-0.5 font-ui text-[13px] font-extrabold",
                note.tone === "good" && "bg-[#e4f1d6] text-[#2f6b1f]",
                note.tone === "bad" && "bg-[#fbd9cf] text-[#a02a14]",
                note.tone === "info" && "bg-[#f7edd7] text-walnut-dark",
              )}
              data-testid="sauce-note"
            >
              {note.text}
            </p>
          ) : phase === "mix" ? (
            <p
              data-testid="sauce-step"
              data-step={step.n}
              className="order-3 mx-3 mt-1 flex items-center gap-2 rounded-full bg-[#2f2118]/80 px-2 py-0.5 land:mx-2 font-ui text-[12.5px] font-extrabold text-ivory"
            >
              <span
                aria-hidden
                className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full bg-gold font-display text-[12px] font-black text-walnut-dark"
              >
                {step.n}
              </span>
              <span className="min-w-0 flex-1 truncate">{step.text}</span>
            </p>
          ) : (
            <div className="order-3 h-[22px] land:h-1" />
          )}

          {phase === "bottle" || phase === "done" ? null : (
            <>
              {/* the pantry */}
              <div
                // (short screens: narrower margins so six 48 px tiles fit a 320 px row: two shelves instead of three, and the bowl gets its height back)
                className="order-6 mx-3 mt-1.5 grid gap-1 [@media(max-height:620px)]:mx-2 [@media(max-height:620px)]:gap-0.5 land:mx-2 land:mt-auto"
                style={{ gridTemplateColumns: pantryCols }}
                data-testid="sauce-pantry"
              >
                {items.map((it) => (
                  <PantryTile
                    key={it.id}
                    item={it}
                    count={scoops[it.id] ?? 0}
                    need={needLeft[it.id] ?? null}
                    hint={hintAt === `item:${it.id}` && !reducedMotion}
                    disabled={phase !== "mix"}
                    onDown={() => holdStart(it)}
                    onUp={holdStop}
                  />
                ))}
              </div>

              {/* the two big buttons */}
              <div className="order-7 mx-3 mb-3 mt-2 grid grid-cols-[1fr_1.4fr] gap-2 land:mx-2 land:mb-1">
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
                <div
                  className={cn(
                    "rounded-2xl",
                    hintAt === "bottle" && !reducedMotion && "sauce-hint",
                  )}
                  data-hint={hintAt === "bottle" ? "1" : undefined}
                >
                  <SortButton
                    onClick={() =>
                      volume > 0 ? endMix(false) : say("Pour something in first", "info")
                    }
                    testId="sauce-bottle-it"
                  >
                    Bottle it →
                  </SortButton>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
              {practice ? " · extra round" : ""}
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
                  🧑‍🍳 Prep Cook does it · no stars
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
          className="absolute inset-0 z-40 flex overflow-y-auto overscroll-contain bg-black/70 p-6"
          data-testid="sauce-paused"
        >
          <div className="m-auto w-full max-w-[300px] rounded-3xl bg-[#f7edd7] p-4 text-center">
            <p className="font-display text-[22px] font-extrabold text-walnut-dark">Paused</p>
            <div className="mt-3 grid gap-2">
              <SortButton onClick={resume} testId="sauce-resume">
                Resume
              </SortButton>
              <SortButton quiet testId="sauce-restart" onClick={onRestart}>
                ↻ Restart
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
          alreadyMade={isMade(save, sauce.id)}
          matchPct={matchPercent(result.mix.de)}
          onNext={onNext}
          onShelf={onShelf}
          onExit={onExit}
          onAgain={() => onAgain(sauce.id)}
        />
      ) : null}
    </div>
  );
}

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
  need,
  hint = false,
  disabled,
  onDown,
  onUp,
}: {
  item: PantryItem;
  /** The idle hint points at this tile: pour this one next. */
  hint?: boolean;
  count: number;
  /** Scoops of this item the recipe still wants (null = not in the recipe, or the tier does not show the recipe). */
  need: number | null;
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  const art = item.art;
  const idx = art.cell;
  // PRODUCT ART (developer 2026-11-13: "a jar with a mayonnaise label standing on the desk, not just buttons"): when the product's own picture exists
  // (public/business/sauce/products/<id>.webp, scripts/make-sauce-products.py) it STANDS on the counter with a small wooden name tag, no card; the
  // recipe glow, the "+N" / tick badge and the count stay. Without the file the card with the sheet's small picture is drawn as before.
  const product = useSauceArt(`products/${item.id}`);
  if (product)
    return (
      <button
        type="button"
        data-testid={`sauce-pantry-${item.id}`}
        data-need={need === null ? undefined : need}
        data-hint={hint ? "1" : undefined}
        data-product="1"
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
          // Developer 2026-11-21 ("make the ingredients a little bigger and show the name fully"): taller tiles, a bigger picture, the name on up to two lines.
          "press relative flex h-[clamp(70px,10.5vh,108px)] flex-col items-center justify-end rounded-xl px-0 pb-0 pt-1 [@media(max-height:620px)]:h-[64px]",
          disabled && "opacity-60",
          hint && "sauce-hint",
        )}
      >
        {need !== null && need > 0 ? (
          <span
            aria-hidden
            className="absolute inset-x-1 bottom-3 top-1 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(255,214,102,0.55),rgba(255,214,102,0)_70%)] ring-2 ring-[#ffd25a]/90"
          />
        ) : null}
        {hint ? (
          <span
            aria-hidden
            data-testid="sauce-hint-hand"
            className="sauce-hint-hand pointer-events-none absolute -top-4 left-1/2 z-10 -ml-2.5 text-[20px] leading-none"
          >
            👇
          </span>
        ) : null}
        <img
          src={sauceUrl(`products/${item.id}`)}
          alt=""
          draggable={false}
          className="pointer-events-none relative z-[1] min-h-0 flex-1 select-none object-contain drop-shadow-[0_4px_3px_rgba(40,20,5,0.5)]"
          style={{ maxHeight: "calc(100% - 28px)" }}
        />
        <span
          className={cn(
            "relative z-[2] -mt-0.5 flex min-h-[26px] w-full items-center justify-center whitespace-normal break-words rounded-md border px-0.5 text-center font-ui text-[10.5px] font-extrabold leading-[12px] text-walnut-dark shadow-[0_2px_0_rgba(60,30,10,0.45)] land:text-[11px]",
            need === 0
              ? "border-[#5a9a3f] bg-[#cfe6b8]"
              : "border-[#a9743a] bg-[linear-gradient(180deg,#f3dcaa,#e2bd7a)]",
          )}
        >
          {item.name}
        </span>
        {need !== null && need > 0 ? (
          <span
            aria-hidden
            data-testid={`sauce-want-${item.id}`}
            className="absolute left-0.5 top-0.5 z-[3] rounded-full bg-[#e0a21c] px-1 font-ui text-[9.5px] font-black leading-[14px] text-walnut-dark"
          >
            {need < 1 ? "pinch" : `+${need}`}
          </span>
        ) : need === 0 ? (
          <span
            aria-hidden
            className="absolute left-0.5 top-0.5 z-[3] grid h-[15px] w-[15px] place-items-center rounded-full bg-[#5a9a3f] font-ui text-[10px] font-black leading-none text-white"
          >
            ✓
          </span>
        ) : null}
        {count > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 z-[3] grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#d23b2a] px-1 font-ui text-[10px] font-black leading-none text-white"
            data-testid={`sauce-count-${item.id}`}
          >
            {Number.isInteger(count) ? count : count.toFixed(2).replace(/0$/, "")}
          </span>
        ) : null}
      </button>
    );
  return (
    <button
      type="button"
      data-testid={`sauce-pantry-${item.id}`}
      data-need={need === null ? undefined : need}
      data-hint={hint ? "1" : undefined}
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
        // The recipe's own items glow while they are still wanted; a finished one turns green.
        need !== null && need > 0 && "border-[#e0a21c] ring-2 ring-[#ffd25a] ring-offset-0",
        need === 0 && "border-[#5a9a3f] bg-[#e1f1cf]/95",
        disabled && "opacity-60",
        hint && "sauce-hint !overflow-visible",
      )}
    >
      {hint ? (
        <span
          aria-hidden
          data-testid="sauce-hint-hand"
          className="sauce-hint-hand pointer-events-none absolute -top-5 left-1/2 z-10 -ml-2.5 text-[20px] leading-none"
        >
          👇
        </span>
      ) : null}
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
      {need !== null && need > 0 ? (
        <span
          aria-hidden
          data-testid={`sauce-want-${item.id}`}
          className="absolute left-0.5 top-0.5 rounded-full bg-[#e0a21c] px-1 font-ui text-[9.5px] font-black leading-[14px] text-walnut-dark"
        >
          {need < 1 ? "pinch" : `+${need}`}
        </span>
      ) : need === 0 ? (
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 grid h-[15px] w-[15px] place-items-center rounded-full bg-[#5a9a3f] font-ui text-[10px] font-black leading-none text-white"
        >
          ✓
        </span>
      ) : null}
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
  className,
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
  className?: string;
}) {
  const belt = useSauceArt("belt");
  const jugOk = useSauceArt("pour-tools");
  const done = index >= total;
  return (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
      data-testid="sauce-bottling"
    >
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
          <div className="absolute inset-x-0 top-[9%] flex h-[61%] justify-center">
            <BottleView
              shape={sauce.bottle}
              fill={fill}
              color={color}
              capped={capped}
              label={capped ? sauce.label : undefined}
              emoji={icon}
              mark={capped ? undefined : FILL_LINE}
              className="h-full"
            >
              {/* The pitcher and the stream, placed from the bottle's own mouth: the spout tip IS the pivot, so the pitcher tilts over the mouth, and the
                  stream falls from the tip straight to the sauce's surface. */}
              {!capped ? (
                <PourScene
                  shape={sauce.bottle}
                  fill={fill}
                  color={color}
                  pouring={pouring}
                  reducedMotion={reducedMotion}
                />
              ) : null}
            </BottleView>
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
        <PourButton
          fill={fill}
          color={color}
          pouring={pouring}
          disabled={done || capped}
          window_={window_}
          reducedMotion={reducedMotion}
          onDown={onDown}
          onUp={onUp}
        />
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

/**
 * THE POUR BUTTON (developer 2026-11-11: "make the pour button more beautiful and engaging"). A big brass-rimmed button with a glossy top: while you hold it
 * the sauce's own colour rises inside it as the bottle fills; it glows and says "LET GO NOW!" (with a small buzz where the phone has one) when the level is
 * on the line, and turns red with "Too much!" past it. Idle, it breathes softly. Transform / opacity / box-shadow animation only; Reduced Motion turns it off.
 */
export function PourButton({
  fill,
  color,
  pouring,
  disabled,
  window_,
  reducedMotion,
  onDown,
  onUp,
}: {
  fill: number;
  color: string;
  pouring: boolean;
  disabled: boolean;
  window_: number;
  reducedMotion: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  // The cues read the REAL score (a release at the edge of the window scores 0, and more than full spills): LET GO only where the pour would be good.
  const good = pouring && fill <= 1 && bottleScore(fill, window_).score >= BOTTLE_GOOD;
  const onLine = good;
  const over = pouring && !good && fill > FILL_LINE;
  const progress = Math.min(1, Math.max(0, fill / FILL_LINE));
  const state = disabled ? "off" : over ? "over" : onLine ? "line" : pouring ? "pour" : "idle";
  // A short buzz the moment the level reaches the line (where the phone can).
  const wasOnLine = useRef(false);
  useEffect(() => {
    if (onLine && !wasOnLine.current && !reducedMotion) {
      try {
        navigator.vibrate?.(14);
      } catch {
        /* optional */
      }
    }
    wasOnLine.current = onLine;
  }, [onLine, reducedMotion]);
  const rim =
    state === "line"
      ? "#e8b43a"
      : state === "over"
        ? "#a8321f"
        : state === "off"
          ? "#6b5a48"
          : "#7a4a17";
  return (
    <button
      type="button"
      data-testid="sauce-pour"
      data-state={state}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "sauce-pour-btn press relative isolate flex h-[72px] w-full touch-none select-none items-center justify-center overflow-hidden rounded-[26px] font-display text-[21px] font-black tracking-wide text-[#fff8e4] disabled:opacity-60",
        !reducedMotion && state === "idle" && "sauce-pour-idle",
        !reducedMotion && state === "line" && "sauce-pour-go",
      )}
      style={{
        border: `4px solid ${rim}`,
        background:
          state === "over"
            ? "linear-gradient(180deg,#e0674b,#b4392a 55%,#8a2518)"
            : state === "line"
              ? "linear-gradient(180deg,#ffd978,#e0a02a 55%,#b9791b)"
              : "linear-gradient(180deg,#f2b865,#cc7d28 55%,#9c5a17)",
        boxShadow:
          state === "line"
            ? "0 0 0 3px rgba(255,226,140,.55), 0 0 26px rgba(255,200,80,.75), inset 0 2px 0 rgba(255,255,255,.55)"
            : "0 6px 0 #5a3410, 0 10px 18px rgba(20,10,4,.45), inset 0 2px 0 rgba(255,255,255,.45)",
        transform: pouring ? "translateY(5px)" : undefined,
        transition: reducedMotion ? undefined : "transform .08s ease-out, box-shadow .15s",
      }}
    >
      {/* the sauce rising inside the button as the bottle fills */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 opacity-60"
        style={{
          width: `${(pouring ? progress : 0) * 100}%`,
          background: `linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 40%), ${color}`,
          transition: reducedMotion ? undefined : "width .08s linear",
        }}
      />
      {/* the glossy top */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-1 h-[34%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0))]"
      />
      <span className="relative flex items-center gap-2 [text-shadow:0_2px_0_rgba(70,34,6,.65)]">
        <span aria-hidden className="text-[26px] leading-none">
          {state === "over" ? "😬" : state === "line" ? "✋" : "💧"}
        </span>
        {state === "over"
          ? "Too much!"
          : state === "line"
            ? "LET GO NOW!"
            : state === "pour"
              ? "Keep holding…"
              : "Hold to pour"}
      </span>
    </button>
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
  alreadyMade,
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
    reasons: string[];
  };
  sauce: SauceDef;
  practice: boolean;
  left: number;
  onWatchAd?: (() => Promise<"ok" | "no">) | undefined;
  pins: number;
  /** The sauce was on the shelf before this round (a zero-star round does not take it off). */
  alreadyMade: boolean;
  matchPct: number;
  onNext: () => void;
  onShelf: () => void;
  onExit: () => void;
  onAgain: () => void;
}) {
  const e = result.effects;
  return (
    <div
      className="absolute inset-0 z-40 flex overflow-y-auto overscroll-contain bg-black/70 p-5"
      data-testid="sauce-result"
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
        {result.reasons.length > 0 ? (
          <div
            className="relative mx-auto mt-1.5 w-fit max-w-full rounded-xl bg-[#7a2a1d]/10 px-2.5 py-1.5 text-left"
            data-testid="sauce-why"
          >
            <p className="font-ui text-[11px] font-black uppercase tracking-wide text-[#8a3a22]">
              Why not 3 stars
            </p>
            {result.reasons.map((r) => (
              <p key={r} className="font-ui text-[12.5px] font-bold leading-snug text-walnut-dark">
                {r}
              </p>
            ))}
          </div>
        ) : null}
        {practice ? (
          <p className="relative mt-1 font-ui text-[12.5px] font-bold text-walnut/65">
            Extra round: no reward, not added to the shelf
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
        {/* Says plainly whether this round put the sauce on the shelf (developer 2026-11-17: "I made 2 sauces and still it is not showing in the shelf") */}
        {!practice ? (
          <p
            className={cn(
              "relative mt-1 flex items-center justify-center gap-1.5 font-ui text-[13px] font-extrabold",
              result.stars === 0 ? "text-tomato" : "text-copper",
            )}
            data-testid="sauce-shelf-note"
            data-shelved={e.shelved ? "1" : "0"}
          >
            {e.shelved || e.mastered ? (
              <SauceIcon index={sauceIndex(sauce.id)} emoji={sauce.icon} className="h-8" />
            ) : null}
            {e.mastered
              ? "🥇 Mastered: gold seal on your Sauce Shelf!"
              : e.shelved
                ? "✓ Added to your Sauce Shelf!"
                : result.stars === 0 && !alreadyMade
                  ? "Not on the shelf: it needs 1 star"
                  : "Already on your Sauce Shelf"}
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
              Next sauce · {left} left
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
            Play again · just for fun
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
      <p className="font-ui text-[12.5px] font-bold text-walnut/75" data-testid="sauce-ad-why">
        Today&apos;s free sauces are done. An ad gives {SAUCE_AD_ROUNDS} more to cook (stars, Hype),
        not a skip.
      </p>
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
      className="absolute inset-0 z-50 flex overflow-y-auto overscroll-contain bg-black/75 p-4"
      data-testid="sauce-guide"
    >
      <div className="m-auto w-full max-w-[340px] rounded-3xl border-2 border-[#e6b866] bg-[#f7edd7] p-4 land:max-w-[560px] land:p-3">
        <p className="text-center font-display text-[20px] font-extrabold text-walnut-dark">
          Sauce Station
        </p>
        <ul className="mt-2 space-y-1.5 land:grid land:grid-cols-3 land:gap-1.5 land:space-y-0">
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
