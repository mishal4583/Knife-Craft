import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AudioManager } from "@/game/AudioManager";
import { PauseManager } from "@/game/PauseManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { useBoxSize } from "@/components/kc/restaurantMap/restaurantMapWide";
import { useLandscape } from "@/components/kc/game/layoutMode";
import { rivalPortraitPath } from "@/game/chefArt";
import { rivalChefOf } from "@/game/restaurant/rivalChefs";
import { RIVALS } from "@/game/restaurant/cityRanking";
import {
  FESTIVAL_STAGES,
  festivalRound,
  stageIndex,
  stageNews,
  stageWithBurners,
  type FestivalEvent,
} from "@/game/festival/events";
import {
  accuracyOf,
  act,
  cookerOf,
  plateTaker,
  resultOf,
  slotPhase,
  slotProgress,
  startState,
  tick,
  type RoundResult,
} from "@/game/festival/kitchen";
import { nextAction } from "@/game/festival/bot";
import { rivalAt, rivalPlan } from "@/game/festival/rival";
import type {
  Action,
  CookerId,
  Customer,
  FoodId,
  GameEvent,
  Pace,
  PowerId,
  RoundState,
} from "@/game/festival/types";
import { sortParts } from "@/game/festival/burger";
import { Basket, BurgerStack, DrinkMachine, FoodPicture, Meat, OPEN_SPREAD } from "./FestivalFood";
import {
  BACKDROP_ART,
  FOOD_NAMES,
  PEOPLE,
  ROUND_ART,
  STATION_ART,
  TALL_COUNTER_EDGE,
  TRAY_ART,
  UI_ART,
  festivalUrl,
  gameUrl,
  moodFor,
  personUrl,
  type Mood,
} from "./festivalArt";
import { portraitHeight, portraitLayout, wideLayout, type Rect } from "./festivalLayout";
import { StallBack, StallCounter, StallSides } from "./FestivalStall";
import "./festival.css";

type Phase = "intro" | "play" | "result";
/** A customer who has just left, drawn for a moment: happily served, or walking off. */
type Ghost = {
  key: number;
  seat: number;
  id: number;
  look: number;
  mood: Mood;
  text: string;
  sad: boolean;
};

const PAINT_MS = 80;
const GHOST_MS = 1500;
const HINT_MS = 1600;
const SAY_MS = 3200;
const COACH_ORDERS = 2;

const at = ([x, y, w, h]: Rect): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  width: w,
  height: h,
});

const POWERS: { id: PowerId; name: string; picture: string }[] = [
  { id: "patience", name: "Patience", picture: UI_ART.patience },
  { id: "instant", name: "Cook now", picture: UI_ART.instant },
  { id: "freeze", name: "Freeze", picture: UI_ART.freeze },
];

/** The upright painting is wider than it must be, so its counter's edge can always meet the stage's, with no gap above or below. */
const TALL_MIN_SCALE = 1.11;
function tallBackdrop(counter: number, stage: number): CSSProperties {
  // (big enough that the picture reaches the top of the stage above its counter edge and the foot of it below)
  const k = Math.max(
    TALL_MIN_SCALE,
    counter / (960 * TALL_COUNTER_EDGE),
    (stage - counter) / (960 * (1 - TALL_COUNTER_EDGE)),
  );
  const width = 540 * k;
  const height = 960 * k;
  return { left: (540 - width) / 2, top: counter - TALL_COUNTER_EDGE * height, width, height };
}

/** What a stage adds to the one before, in a few words. */
function newsLine(event: FestivalEvent, stage: number, count = true): string {
  const news = stageNews(event, stage);
  const room = [
    ...(news.grill ? ["another burner"] : []),
    ...(news.plate ? ["another plate"] : []),
    ...(news.atOnce ? ["a longer queue"] : []),
  ];
  return [
    ...(count ? [`${news.customers} customers`] : []),
    ...(news.foods.length ? [news.foods.map((f) => FOOD_NAMES[f]).join(", ")] : []),
    ...(room.length ? [room.join(", ")] : []),
  ].join(" · ");
}

/** A stage's rival: the chef's first name, the restaurant, the portrait. */
const rivalOf = (id: string) => {
  const chef = rivalChefOf(id);
  return {
    chefName: chef ? `Chef ${chef.chef.split(" ")[0]}` : "The rival",
    stallName: RIVALS.find((r) => r.id === id)?.name ?? "Rival stall",
    portrait: rivalPortraitPath(id),
  };
};

/** A drawn arrow for the stage picker (a text arrow turns into an emoji on some phones). */
function Chevron({ right = false }: { right?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="fest-chevron" aria-hidden="true">
      <path d={right ? "M9 5 L16 12 L9 19" : "M15 5 L8 12 L15 19"} />
    </svg>
  );
}

/** A chef's white hat, beside each stall's score. */
function ChefHat() {
  return (
    <svg viewBox="0 0 24 22" className="fest-hat" aria-hidden="true">
      <path d="M6 12 C1 12 1 4 7 5 C8 0 16 0 17 5 C23 4 23 12 18 12 L18 16 L6 16 Z" fill="#fff" />
      <rect x="6" y="16.5" width="12" height="4" rx="1" fill="#fff" />
    </svg>
  );
}

/** What the coach says about the tap the simulated player would make (the first play only). */
function coachText(action: Action, state: RoundState): string {
  if (action.kind === "tray")
    return action.item === "bun"
      ? "Tap the bun"
      : action.item === "patty" || action.item === "chicken" || action.item === "veggie"
        ? `Tap ${FOOD_NAMES[action.item].toLowerCase()} to grill it`
        : action.item === "fries"
          ? "Tap fries to fry them"
          : `Add ${FOOD_NAMES[action.item].toLowerCase()}`;
  if (action.kind === "cooker") {
    const slot = state.cookers[action.cooker]?.[action.slot];
    if (!slot) return action.cooker === "drink" ? "Tap to pour the drink" : "Tap to start cooking";
    if (action.cooker === "grill") return "Ready! Tap it onto the bun";
    return `Ready! Tap to serve the ${FOOD_NAMES[slot.item].toLowerCase()}`;
  }
  if (action.kind === "plate")
    return plateTaker(state, action.plate) ? "Tap the burger to serve it" : "Tap this plate";
  return "Bin it";
}

/**
 * ONE FESTIVAL ROUND (developer 2026-11-27): the customers and what they want, our stall's kitchen, the rival's score beside ours. All the rules are
 * `game/festival`; this draws them, reads the taps and counts the time. The round waits while paused, while the platform or an ad pauses the game
 * (PauseManager) and until Start. It moves no money.
 */
export function FestivalGame({
  event,
  pace,
  stage,
  openStage,
  nextNote,
  seed,
  coach,
  onResult,
  onAgain,
  onStage,
  onList,
  onExit,
}: {
  event: FestivalEvent;
  /** The pace it is played at (the stage's, or the developer's preview). */
  pace: Pace;
  /** The stage being played (null: a preview at a row of the pace table), and the highest one the player may choose. */
  stage: number | null;
  openStage: number;
  /** Shown when the third stage is won: when the next festival opens. */
  nextNote: string;
  /** Plays another stage (an earlier one again, or the next one just opened). */
  onStage: (stage: number) => void;
  seed: number;
  /** The first play of the first festival: point at what to tap for the first customers. */
  coach: boolean;
  onResult: (result: RoundResult) => void;
  onAgain: () => void;
  onList: () => void;
  onExit: () => void;
}) {
  const round = useMemo(() => festivalRound(event, seed, pace)!, [event, seed, pace]);
  const rival = useMemo(() => rivalPlan(round, seed), [round, seed]);
  const rivalId = event.rivals[stageIndex(stage)];
  const { chefName, stallName, portrait } = rivalOf(rivalId);
  const lines = event.lines![stageIndex(stage)];
  /** The stage after this one, when there is one. */
  const after = stage !== null && stage < FESTIVAL_STAGES ? stage + 1 : null;

  const wide = useLandscape();
  const boxRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(boxRef, true);
  const counts = {
    atOnce: round.pace.atOnce,
    grill: cookerOf(round.kitchen, "grill")!.slots,
    plates: round.kitchen.plates,
    trays: round.kitchen.trays.length,
    drinks: cookerOf(round.kitchen, "drink")!.slots,
  };
  const layout = wide ? wideLayout(counts) : portraitLayout(counts, portraitHeight(box.w, box.h));
  const scale = box.w > 0 ? Math.min(box.w / layout.w, box.h / layout.h) : 0;
  /** How far the window reaches past each side of the stage, in stage units: the stall's edges and corner things go out there. */
  const margin = scale > 0 ? Math.max(0, (box.w / scale - layout.w) / 2) : 0;

  const [phase, setPhase] = useState<Phase>("intro");
  const [view, setView] = useState<RoundState>(() => startState(round));
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(() => PauseManager.isPaused());
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [hint, setHint] = useState("");
  const [says, setSays] = useState("");
  const [shake, setShake] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);

  const stateRef = useRef(view);
  const phaseRef = useRef<Phase>("intro");
  const stoppedRef = useRef(true);
  const looksRef = useRef(new Map<number, number>());
  const timers = useRef<number[]>([]);
  const hintTimer = useRef(0);
  const sayTimer = useRef(0);
  const ghostKey = useRef(0);
  const rivalSaidRef = useRef({ ahead: false, passed: false, slipAt: -1, wasBehind: false });
  const reportedRef = useRef(false);

  const later = useCallback((run: () => void, ms: number) => {
    const id = window.setTimeout(run, ms);
    timers.current.push(id);
    return id;
  }, []);
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  useEffect(() => PauseManager.subscribe(setHeld), []);
  useEffect(() => {
    stoppedRef.current = paused || held || phase !== "play";
  }, [paused, held, phase]);
  useEffect(() => {
    // the pictures come before the first customer
    for (const name of ROUND_ART) new Image().src = festivalUrl(name);
  }, []);

  const say = useCallback(
    (text: string) => {
      setSays(text);
      window.clearTimeout(sayTimer.current);
      sayTimer.current = later(() => setSays(""), SAY_MS);
    },
    [later],
  );

  /** A face no waiting customer is wearing. */
  const lookFor = useCallback((id: number, present: readonly Customer[]) => {
    const worn = new Set(present.map((c) => looksRef.current.get(c.id)));
    let look = id % PEOPLE.length;
    for (let k = 0; k < PEOPLE.length && worn.has(look); k++) look = (look + 1) % PEOPLE.length;
    looksRef.current.set(id, look);
    return look;
  }, []);

  const take = useCallback(
    (events: readonly GameEvent[], state: RoundState) => {
      for (const e of events) {
        if (e.type === "arrive") {
          lookFor(
            e.id,
            state.customers.filter((c) => c.id !== e.id),
          );
          AudioManager.playSfx("bell");
        } else if (e.type === "served" || e.type === "left") {
          const key = ++ghostKey.current;
          const sad = e.type === "left";
          setGhosts((g) => [
            ...g.filter((x) => x.seat !== e.seat),
            {
              key,
              seat: e.seat,
              id: e.id,
              look: looksRef.current.get(e.id) ?? 0,
              mood: sad ? "impatient" : "excited",
              text: e.type === "served" ? `+${e.points}` : "Too slow!",
              sad,
            },
          ]);
          later(() => setGhosts((g) => g.filter((x) => x.key !== key)), GHOST_MS);
          AudioManager.playSfx(sad ? "sortWrong" : e.combo > 1 ? "sortCombo" : "coin");
        } else if (e.type === "delivered") AudioManager.playSfx("sortPlace");
        else if (e.type === "ready") AudioManager.playSfx("sortTick");
        else if (e.type === "burnt") AudioManager.playSfx("sortWrong");
        else if (e.type === "placed") AudioManager.playSfx("sortPick");
        else if (e.type === "cooking") AudioManager.playSfx("sauceProduce");
        else if (e.type === "binned") AudioManager.playSfx("crateUndo");
        else if (e.type === "power") AudioManager.playSfx("crateFreeze");
        else if (e.type === "hint") {
          setHint(e.text);
          setShake((n) => n + 1);
          window.clearTimeout(hintTimer.current);
          hintTimer.current = later(() => setHint(""), HINT_MS);
          AudioManager.playSfx("tap");
        }
      }
    },
    [later, lookFor],
  );

  const finish = useCallback(
    (state: RoundState) => {
      if (reportedRef.current) return;
      reportedRef.current = true;
      const done = resultOf(round, state, rival.final);
      onResult(done);
      // the last customer's thanks first, then the result
      later(() => {
        phaseRef.current = "result";
        setPhase("result");
        setResult(done);
        AudioManager.playSfx(done.won ? "gameWin" : "gameLose");
      }, 900);
    },
    [later, onResult, rival.final, round],
  );

  // the clock
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let painted = 0;
    const loop = (now: number) => {
      // a slow or hidden tab never makes the food jump
      const dt = Math.min(100, now - last);
      last = now;
      if (!stoppedRef.current && !stateRef.current.done) {
        const step = tick(round, stateRef.current, dt);
        stateRef.current = step.state;
        if (step.events.length) take(step.events, step.state);
        if (step.events.length || now - painted > PAINT_MS) {
          painted = now;
          setView(step.state);
        }
        if (step.state.done) finish(step.state);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [round, take, finish]);

  // what the rival says as the race goes
  const rivalNow = view.done
    ? { score: rival.final, orders: round.orders.length, at: 0, slip: false }
    : rivalAt(rival, view.now);
  useEffect(() => {
    if (phase !== "play") return;
    const said = rivalSaidRef.current;
    if (rivalNow.slip && said.slipAt !== rivalNow.at) {
      said.slipAt = rivalNow.at;
      say(lines.slip);
    } else if (rivalNow.score > view.score) {
      said.wasBehind = true;
      if (!said.ahead && view.now > 8000) {
        said.ahead = true;
        say(lines.ahead);
      }
    } else if (said.wasBehind && !said.passed && view.score > rivalNow.score) {
      said.passed = true;
      say(lines.passed);
    }
  }, [phase, rivalNow.at, rivalNow.score, rivalNow.slip, view.score, view.now, say, lines]);

  const tap = useCallback(
    (action: Action) => {
      if (stoppedRef.current) return;
      const step = act(round, stateRef.current, action);
      stateRef.current = step.state;
      take(step.events, step.state);
      setView(step.state);
      if (step.state.done) finish(step.state);
    },
    [round, take, finish],
  );

  const start = () => {
    phaseRef.current = "play";
    stoppedRef.current = held || paused;
    setPhase("play");
    AudioManager.playSfx("tap");
  };

  const coachAction =
    coach && phase === "play" && view.served < COACH_ORDERS ? nextAction(round, view) : null;
  const coached = (a: Action) =>
    !!coachAction &&
    coachAction.kind === a.kind &&
    (a.kind === "bin" ||
      (a.kind === "tray" && coachAction.kind === "tray" && coachAction.item === a.item) ||
      (a.kind === "plate" && coachAction.kind === "plate" && coachAction.plate === a.plate) ||
      (a.kind === "cooker" &&
        coachAction.kind === "cooker" &&
        coachAction.cooker === a.cooker &&
        coachAction.slot === a.slot));
  /** The coach's ring and pointing hand, over the box the next tap should go to. */
  const ring = (a: Action) =>
    coached(a) ? (
      <>
        <span aria-hidden="true" className="fest-coach" data-testid="fest-coach" />
        <img src={festivalUrl(UI_ART.hand)} alt="" className="fest-hand" />
      </>
    ) : null;

  const stopped = paused || held;
  const accuracy = Math.round(accuracyOf(view) * 100);
  const best = Math.max(1, view.score, rival.final);

  /** How far to the side a customer starts: past the window's nearer edge (a middle seat takes turns). Stage units. */
  const walkFrom = ([x, , w]: Rect, id: number) => {
    const off = x + w / 2 - layout.w / 2;
    const left = Math.abs(off) < 1 ? id % 2 === 0 : off < 0;
    return left ? -(x + w + margin + 8) : layout.w + margin - x + 8;
  };
  const walking = (style: CSSProperties, from: number) =>
    ({ ...style, "--walk": `${Math.round(from)}px` }) as CSSProperties;

  /** One place on a cooker: what is in it, how far it is, and the badge that says what to do. */
  const spot = (cooker: CookerId, i: number, rect: Rect, food?: Rect) => {
    const def = cookerOf(round.kitchen, cooker)!;
    const slot = view.cookers[cooker]?.[i] ?? null;
    const phaseNow = slot ? slotPhase(def, slot) : null;
    const progress = slot ? slotProgress(def, slot) : 0;
    const machine = cooker === "drink" ? def.perSlot![i]! : null;
    const name = machine
      ? `${FOOD_NAMES[machine]} machine`
      : cooker === "fryer"
        ? `Fryer ${i + 1}`
        : `Grill ${i + 1}`;
    const stateText = !slot
      ? "empty"
      : `${FOOD_NAMES[slot.item]} ${phaseNow === "over" ? "overcooked" : phaseNow}`;
    const press = () => tap({ kind: "cooker", cooker, slot: i });
    const marks = (
      <>
        {slot && phaseNow === "cooking" ? (
          <span aria-hidden="true" className="fest-meter">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        ) : null}
        {slot && phaseNow === "ready" && Number.isFinite(def.readyMs) ? (
          <span aria-hidden="true" className="fest-meter fest-meter-ready">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        ) : null}
        {slot && phaseNow === "over" ? (
          <span aria-hidden="true" className="fest-meter fest-meter-over">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        ) : null}
        {slot && phaseNow === "ready" ? (
          <img src={festivalUrl(UI_ART.ready)} alt="" className="fest-badge fest-badge-ready" />
        ) : null}
        {slot && phaseNow === "over" ? (
          <img src={festivalUrl(UI_ART.warning)} alt="" className="fest-badge fest-badge-over" />
        ) : null}
        {slot && phaseNow === "burnt" ? (
          <>
            <img src={festivalUrl(UI_ART.smoke)} alt="" className="fest-smoke" />
            <img src={festivalUrl(UI_ART.trash)} alt="" className="fest-badge fest-badge-burnt" />
          </>
        ) : null}
        {ring({ kind: "cooker", cooker, slot: i })}
      </>
    );
    return (
      <button
        key={`${cooker}-${i}`}
        type="button"
        data-testid={`fest-${cooker}-${i}`}
        data-phase={phaseNow ?? "empty"}
        data-item={slot?.item}
        aria-label={`${name}: ${stateText}`}
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        onClick={(e) => e.detail === 0 && press()}
        className={`fest-station fest-${cooker}`}
        style={at(rect)}
      >
        {food ? (
          // the grill: the box is a quarter of the grill's picture, the meat lies on its painted ring
          <span
            className="fest-onring"
            style={at([food[0] - rect[0], food[1] - rect[1], food[2], food[3]])}
          >
            {slot ? <Meat item={slot.item} phase={phaseNow!} progress={progress} /> : null}
            {marks}
          </span>
        ) : machine ? (
          <>
            <DrinkMachine drink={machine} pouring={!!slot} phase={phaseNow} progress={progress} />
            <span className="fest-tray-name">{FOOD_NAMES[machine]}</span>
            {marks}
          </>
        ) : (
          <>
            <img src={festivalUrl(STATION_ART.fryer)} alt="" className="fest-fryer-pic" />
            {slot ? (
              <Basket phase={phaseNow!} progress={progress} className="fest-basket" />
            ) : (
              <span className="fest-tray-name">Fryer</span>
            )}
            {marks}
          </>
        )}
      </button>
    );
  };

  return (
    <div
      ref={boxRef}
      className="fest-root"
      data-testid="festival-game"
      data-event={event.id}
      data-tier={pace.tier}
      data-stage={stage ?? undefined}
      data-rival-id={rivalId}
      data-phase={phase}
      data-paused={stopped || undefined}
      data-served={view.served}
      data-lost={view.lost}
      data-score={view.score}
      data-rival={rivalNow.score}
    >
      <img
        src={festivalUrl(layout.wide ? BACKDROP_ART.wide : BACKDROP_ART.tall)}
        alt=""
        className="fest-backdrop"
      />
      {scale > 0 ? (
        <div
          className={`fest-stage ${layout.wide ? "fest-wide" : "fest-tall"}${counts.trays > 9 ? " fest-crowded" : ""}`}
          data-testid="fest-stage"
          style={{
            width: layout.w,
            height: layout.h,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {layout.wide ? null : (
            <img
              src={festivalUrl(BACKDROP_ART.tall)}
              alt=""
              className="fest-scene"
              style={tallBackdrop(layout.counter, layout.h)}
              data-testid="fest-scene"
            />
          )}
          <StallBack layout={layout} margin={margin} />

          {/* the customers, behind the counter: they walk in from the stall's nearer side and walk off the same way */}
          {layout.seats.map((seat, i) => {
            const customer = view.customers.find((c) => c.seat === i);
            const ghost = ghosts.find((g) => g.seat === i);
            const left = customer ? customer.patience / customer.max : 0;
            return (
              <div key={`seat-${i}`}>
                {customer ? (
                  <>
                    <img
                      key={`face-${customer.id}`}
                      src={personUrl(
                        looksRef.current.get(customer.id) ?? customer.id,
                        moodFor(left),
                      )}
                      alt=""
                      draggable={false}
                      className="fest-person fest-arrive"
                      style={walking(at(seat.person), walkFrom(seat.person, customer.id))}
                    />
                    <div
                      key={`bubble-${customer.id}`}
                      className={`fest-bubble fest-pop fest-order ${customer.wants.length > 1 ? "fest-multi" : ""}`}
                      data-testid="fest-bubble"
                      data-seat={i}
                      data-id={customer.id}
                      data-order={customer.wants
                        .map(
                          (w) =>
                            `${w.done ? "done:" : ""}${w.item.kind === "dish" ? w.item.parts.join("+") : w.item.item}`,
                        )
                        .join(",")}
                      aria-label={`Customer ${i + 1} wants ${customer.wants
                        .filter((w) => !w.done)
                        .map((w) =>
                          w.item.kind === "dish"
                            ? `a burger with ${w.item.parts
                                .slice(1)
                                .map((p) => FOOD_NAMES[p].toLowerCase())
                                .join(", ")}`
                            : FOOD_NAMES[w.item.item].toLowerCase(),
                        )
                        .join(" and ")}`}
                      role="img"
                      style={at(seat.bubble)}
                    >
                      <div className="fest-wants">
                        {customer.wants.map((w, k) =>
                          w.item.kind === "dish" ? (
                            <div
                              key={k}
                              className={`fest-want fest-want-dish ${w.done ? "fest-done" : ""}`}
                            >
                              <BurgerStack parts={w.item.parts} lid className="fest-want-burger" />
                              {/* the toppings again as little pictures, so a small screen still says exactly what to add (a double is one picture with a 2) */}
                              <span className="fest-chips" data-testid="fest-chips">
                                {countParts(w.item.parts.slice(1)).map(([p, n]) => (
                                  <span key={p} className="fest-chip">
                                    <FoodPicture item={p} />
                                    {n > 1 ? <b className="fest-chip-count">{n}</b> : null}
                                  </span>
                                ))}
                              </span>
                            </div>
                          ) : (
                            <div
                              key={k}
                              className={`fest-want fest-want-side ${w.done ? "fest-done" : ""}`}
                            >
                              <FoodPicture item={w.item.item} className="fest-want-pic" />
                            </div>
                          ),
                        )}
                      </div>
                      <Hearts left={left} />
                      {view.frozenMs > 0 ? (
                        <span aria-hidden="true" className="fest-frozen">
                          ❄
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {ghost ? (
                  <div
                    key={ghost.key}
                    className="fest-ghost"
                    style={at(seat.person)}
                    aria-hidden="true"
                  >
                    <img
                      src={personUrl(ghost.look, ghost.mood)}
                      alt=""
                      className="fest-person fest-leaving"
                      style={walking({}, walkFrom(seat.person, ghost.id))}
                    />
                    <span className={`fest-float ${ghost.sad ? "sad" : ""}`}>{ghost.text}</span>
                  </div>
                ) : null}
              </div>
            );
          })}

          <StallSides layout={layout} margin={margin} name={event.name} />
          <StallCounter layout={layout} margin={margin} />

          {/* the kitchen */}
          {layout.drink.map((rect, i) => spot("drink", i, rect))}
          {layout.fryer.map((rect, i) => spot("fryer", i, rect))}
          <button
            type="button"
            data-testid="fest-bin"
            aria-label="Bin the chosen plate"
            onPointerDown={(e) => {
              e.preventDefault();
              tap({ kind: "bin" });
            }}
            onClick={(e) => e.detail === 0 && tap({ kind: "bin" })}
            className="fest-station fest-binbtn"
            style={at(layout.bin)}
          >
            <img src={festivalUrl(STATION_ART.bin)} alt="" className="fest-bin-pic" />
            <span className="fest-tray-name">Bin</span>
            {ring({ kind: "bin" })}
          </button>
          <img
            src={festivalUrl(STATION_ART.grill)}
            alt=""
            className="fest-base"
            style={at(layout.grillArt)}
          />
          {layout.locked.map(([x, y, w, h], i) => {
            // a ring this stage does not use yet: it says which stage turns it on
            const opens = stageWithBurners(event, counts.grill + i + 1);
            return (
              <span
                key={`locked-${i}`}
                aria-hidden="true"
                className="fest-locked"
                style={at([x, y - 4, w, h + 8])}
                data-testid="fest-ring-locked"
              >
                <img src={festivalUrl(UI_ART.lock)} alt="" />
                {opens ? <b>Stage {opens}</b> : null}
              </span>
            );
          })}
          {layout.grill.map((place, i) => spot("grill", i, place.tap, place.food))}
          <img
            src={festivalUrl(STATION_ART.board)}
            alt=""
            className="fest-base"
            style={at(layout.board)}
          />
          {layout.plates.map((rect, i) => {
            const plate = view.plates[i] ?? [];
            const wanted = !!plateTaker(view, i);
            const parts = plate.map((p) => p.item);
            return (
              <button
                key={`plate-${i}`}
                type="button"
                data-testid={`fest-plate-${i}`}
                data-parts={parts.join("+")}
                data-serve={wanted || undefined}
                data-selected={view.selected === i || undefined}
                aria-label={`Plate ${i + 1}: ${
                  parts.length ? parts.map((p) => FOOD_NAMES[p]).join(", ") : "empty"
                }${wanted ? ", ready to serve" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap({ kind: "plate", plate: i });
                }}
                onClick={(e) => e.detail === 0 && tap({ kind: "plate", plate: i })}
                className="fest-station fest-plate"
                style={at(rect)}
              >
                <span aria-hidden="true" className="fest-halo" />
                <img src={festivalUrl(STATION_ART.plate)} alt="" className="fest-dish" />
                {parts.length ? (
                  // drawn in a burger's order however they were tapped, so nothing is hidden under the meat; held apart until it is right
                  <BurgerStack
                    parts={sortParts(parts)}
                    spread={wanted ? 1 : OPEN_SPREAD}
                    lid={wanted}
                    over={plate.some((p) => p.quality === "over")}
                    className="fest-onplate"
                  />
                ) : null}
                {wanted ? <span className="fest-serve">Serve</span> : null}
                {ring({ kind: "plate", plate: i })}
              </button>
            );
          })}
          {round.kitchen.trays.map((tray, i) => {
            const rect = layout.trays[i]!;
            return (
              <button
                key={tray.item}
                type="button"
                data-testid={`fest-tray-${tray.item}`}
                aria-label={FOOD_NAMES[tray.item]}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap({ kind: "tray", item: tray.item });
                }}
                onClick={(e) => e.detail === 0 && tap({ kind: "tray", item: tray.item })}
                className="fest-station fest-tray"
                style={at(rect)}
              >
                <img src={festivalUrl(TRAY_ART[tray.item]!)} alt="" className="fest-tray-food" />
                <span className="fest-tray-name">{FOOD_NAMES[tray.item]}</span>
                {ring({ kind: "tray", item: tray.item })}
              </button>
            );
          })}
          {POWERS.map((power, i) => (
            <button
              key={power.id}
              type="button"
              data-testid={`fest-power-${power.id}`}
              aria-label={`${power.name}, ${view.powers[power.id]} left`}
              disabled={view.powers[power.id] <= 0}
              onClick={() => tap({ kind: "power", power: power.id })}
              className="fest-power"
              style={at(layout.powers[i]!)}
            >
              <img src={festivalUrl(power.picture)} alt="" draggable={false} />
              <span className="fest-power-name">{power.name}</span>
              <span className="fest-power-count">{view.powers[power.id]}</span>
            </button>
          ))}

          {/* the top bar */}
          <button
            type="button"
            data-testid="fest-back"
            aria-label="Leave the round"
            onClick={() => (phase === "play" ? setPaused(true) : onList())}
            className="fest-round-btn"
            style={at(layout.back)}
          >
            ←
          </button>
          <div className="fest-scores" style={at(layout.scores)} data-testid="fest-scores">
            <div className="fest-score-row us">
              <span className="fest-who">
                <ChefHat />
                Our stall
              </span>
              <span className="fest-bar">
                <span style={{ transform: `scaleX(${view.score / best})` }} />
              </span>
              <span className="fest-num" data-testid="fest-score">
                {view.score}
              </span>
            </div>
            <div className="fest-score-row them">
              <span className="fest-who">
                <ChefHat />
                {chefName}
              </span>
              <span className="fest-bar">
                <span style={{ transform: `scaleX(${rivalNow.score / best})` }} />
              </span>
              <span className="fest-num" data-testid="fest-rival-score">
                {rivalNow.score}
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="fest-pause"
            aria-label={paused ? "Resume" : "Pause"}
            onClick={() => setPaused((p) => !p)}
            disabled={phase !== "play"}
            className="fest-round-btn"
            style={at(layout.pause)}
          >
            <span aria-hidden="true" className="fest-pause-bars" />
          </button>
          <div className="fest-status" style={at(layout.status)} data-testid="fest-status">
            <span>
              👥 {view.served + view.lost}/{round.orders.length}
            </span>
            <span className={view.combo > 1 ? "fest-combo" : ""}>
              {view.combo > 1 ? `Combo x${view.combo}` : `✨ ${accuracy}%`}
            </span>
          </div>
          {says && phase === "play" ? (
            <div
              className="fest-says fest-pop"
              style={at(layout.rivalSays)}
              data-testid="fest-says"
            >
              {portrait ? <img src={gameUrl(portrait)} alt="" /> : null}
              <span>{says}</span>
            </div>
          ) : null}

          {coachAction ? (
            <div
              className="fest-hint fest-hint-coach"
              style={at(layout.hint)}
              role="status"
              data-testid="fest-coach-text"
            >
              👉 {coachText(coachAction, view)}
            </div>
          ) : hint ? (
            <div
              key={shake}
              className="fest-hint fest-shake"
              style={at(layout.hint)}
              role="status"
              data-testid="fest-hint"
            >
              {hint}
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "intro" ? (
        <div className="fest-veil" data-testid="fest-intro">
          <section className="fest-card fest-split">
            <div className="fest-col">
              <p className="fest-kicker">Event {event.number}</p>
              <h1 className="fest-title">
                {event.emoji} {event.name}
              </h1>
              {stage !== null ? (
                <div className="fest-stagepick" data-testid="fest-stage-pick">
                  <button
                    type="button"
                    aria-label="The stage before"
                    data-testid="fest-stage-down"
                    disabled={stage <= 1}
                    onClick={() => onStage(stage - 1)}
                  >
                    <Chevron />
                  </button>
                  <span data-testid="fest-stage-number">
                    Stage {stage} of {FESTIVAL_STAGES}
                  </span>
                  <button
                    type="button"
                    aria-label="The next stage"
                    data-testid="fest-stage-up"
                    disabled={stage >= openStage}
                    onClick={() => onStage(stage + 1)}
                  >
                    <Chevron right />
                  </button>
                </div>
              ) : null}
              {stage !== null && stage > 1 ? (
                <p className="fest-new" data-testid="fest-new">
                  New: {newsLine(event, stage, false)}
                </p>
              ) : null}
              <div className="fest-vs">
                {portrait ? <img src={gameUrl(portrait)} alt="" /> : null}
                <div>
                  <p className="fest-vs-name">
                    {chefName} · {stallName}
                  </p>
                  <p className="fest-quote">“{lines.start}”</p>
                </div>
              </div>
            </div>
            <div className="fest-col">
              <ul className="fest-goals">
                <li>⭐ Beat {rival.final} points</li>
                <li>⭐⭐ And cook {Math.round(round.pace.accuracyGoal * 100)}% perfectly</li>
                <li>⭐⭐⭐ And let no one leave</li>
              </ul>
              <p className="fest-line">
                👥 {round.orders.length} customers
                <InfoTip label="How to play">
                  Tap the bun, then the raw patty. When the bell shows, tap the patty onto the bun,
                  add what the customer's bubble shows, and tap the burger to serve it. Fries go in
                  the fryer and each drink has its own machine; tap them when they are ready. Food
                  left too long burns: tap it to throw it away. The bin empties the chosen plate.
                  Each power-up works once a round.
                </InfoTip>
              </p>
              <button
                type="button"
                className="fest-primary"
                onClick={start}
                data-testid="fest-start"
              >
                Start
              </button>
              <button type="button" className="fest-secondary" onClick={onList}>
                All festivals
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {stopped && phase === "play" ? (
        <div className="fest-veil" data-testid="fest-paused">
          <section className="fest-card">
            <h2 className="fest-title">⏸️ Paused</h2>
            <button
              type="button"
              className="fest-primary"
              onClick={() => {
                setPaused(false);
                PauseManager.resume();
              }}
              data-testid="fest-resume"
            >
              Resume
            </button>
            <button
              type="button"
              className="fest-secondary"
              onClick={onAgain}
              data-testid="fest-restart"
            >
              Restart
            </button>
            <button
              type="button"
              className="fest-secondary"
              onClick={onExit}
              data-testid="fest-leave"
            >
              Leave
            </button>
          </section>
        </div>
      ) : null}

      {phase === "result" && result ? (
        <div className="fest-veil" data-testid="fest-result" data-won={result.won}>
          {result.won ? (
            // (clipped, so the falling picture never makes the cards' layer scroll)
            <span className="fest-confetti-box">
              <img src={festivalUrl(UI_ART.confetti)} alt="" className="fest-confetti" />
            </span>
          ) : null}
          <section className="fest-card fest-split">
            <div className="fest-col">
              {result.won ? (
                <img src={festivalUrl(UI_ART.firstTrophy)} alt="" className="fest-trophy" />
              ) : null}
              <h2 className="fest-title">
                {!result.won
                  ? "So close!"
                  : after !== null
                    ? `Stage ${stage} won!`
                    : "You win the festival!"}
              </h2>
              <p className="fest-quote">
                {chefName}: “{result.won ? lines.beaten : lines.won}”
              </p>
              <p className="fest-versus" data-testid="fest-result-scores">
                <strong>{result.score}</strong> <span>vs</span> <strong>{result.rival}</strong>
              </p>
              <p
                className="fest-stars"
                role="img"
                aria-label={`${result.stars} of 3 stars`}
                data-testid="fest-result-stars"
                data-stars={result.stars}
              >
                {[1, 2, 3].map((n) => (
                  <img
                    key={n}
                    src={festivalUrl(UI_ART.star)}
                    alt=""
                    className={n <= result.stars ? "" : "off"}
                  />
                ))}
              </p>
              <dl className="fest-stats">
                <div>
                  <dt>Served</dt>
                  <dd>
                    {result.served}/{result.orders}
                  </dd>
                </div>
                <div>
                  <dt>Perfect</dt>
                  <dd>{Math.round(result.accuracy * 100)}%</dd>
                </div>
                <div>
                  <dt>Best combo</dt>
                  <dd>x{result.bestCombo}</dd>
                </div>
                <div>
                  <dt>Wasted</dt>
                  <dd>{result.wasted}</dd>
                </div>
              </dl>
            </div>
            <div className="fest-col">
              {result.won ? null : (
                <p className="fest-tip" data-testid="fest-tip">
                  💡{" "}
                  {result.lost > 0
                    ? "Serve whoever has waited longest first."
                    : result.wasted > 0
                      ? "Take food off as soon as the bell shows."
                      : "Serve one after another to build a combo."}
                </p>
              )}
              {result.won && after !== null ? (
                <>
                  <p className="fest-new" data-testid="fest-unlocked">
                    Stage {after}: {rivalOf(event.rivals[stageIndex(after)]).chefName} ·{" "}
                    {newsLine(event, after)}
                  </p>
                  <button
                    type="button"
                    className="fest-primary"
                    onClick={() => onStage(after)}
                    data-testid="fest-next"
                  >
                    Next rival
                  </button>
                </>
              ) : null}
              {result.won && stage === FESTIVAL_STAGES && nextNote ? (
                <p className="fest-new" data-testid="fest-next-festival">
                  🔓 {nextNote}
                </p>
              ) : null}
              <button
                type="button"
                className={result.won && after !== null ? "fest-secondary" : "fest-primary"}
                onClick={onAgain}
                data-testid="fest-again"
              >
                {result.won ? "Play again" : "Try again"}
              </button>
              <div className="fest-row">
                <button
                  type="button"
                  className="fest-secondary"
                  onClick={onList}
                  data-testid="fest-to-list"
                >
                  All festivals
                </button>
                <button
                  type="button"
                  className="fest-secondary"
                  onClick={onExit}
                  data-testid="fest-to-kitchen"
                >
                  Kitchen
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

/** Each part with how many times it is wanted, in the order first listed. */
const countParts = (parts: readonly FoodId[]): [FoodId, number][] => [
  ...parts.reduce((seen, p) => seen.set(p, (seen.get(p) ?? 0) + 1), new Map<FoodId, number>()),
];

/** A customer's patience as five hearts, emptying from the right. */
function Hearts({ left }: { left: number }) {
  return (
    <span
      aria-hidden="true"
      className={`fest-hearts ${left <= 0.3 ? "low" : ""}`}
      data-testid="fest-hearts"
      data-left={Math.max(0, left).toFixed(4)}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="fest-heart">
          <img src={festivalUrl(UI_ART.heartEmpty)} alt="" />
          <img
            src={festivalUrl(UI_ART.heartFull)}
            alt=""
            style={{
              clipPath: `inset(0 ${(1 - Math.max(0, Math.min(1, left * 5 - i))) * 100}% 0 0)`,
            }}
          />
        </span>
      ))}
    </span>
  );
}
