import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AudioManager } from "@/game/AudioManager";
import { PauseManager } from "@/game/PauseManager";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { useBoxSize } from "@/components/kc/restaurantMap/restaurantMapWide";
import { useLandscape } from "@/components/kc/game/layoutMode";
import { rivalPortraitPath } from "@/game/chefArt";
import { rivalChefOf } from "@/game/restaurant/rivalChefs";
import { RIVALS } from "@/game/restaurant/cityRanking";
import { festivalRound, type FestivalEvent } from "@/game/festival/events";
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
  PowerId,
  RoundState,
} from "@/game/festival/types";
import { BurgerStack, Cup, FoodPicture, FryerFries, Meat } from "./FestivalFood";
import {
  FOOD_NAMES,
  PEOPLE,
  ROUND_PICTURES,
  festivalUrl,
  gameUrl,
  moodFor,
  personUrl,
  type Mood,
} from "./festivalArt";
import { portraitHeight, portraitLayout, wideLayout, type Rect } from "./festivalLayout";
import "./festival.css";

type Phase = "intro" | "play" | "result";
/** A customer who has just left, drawn for a moment: happily served, or walking off. */
type Ghost = { key: number; seat: number; look: number; mood: Mood; text: string; sad: boolean };

const PAINT_MS = 80;
const GHOST_MS = 1100;
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
  { id: "patience", name: "Patience", picture: "ui/power-patience" },
  { id: "instant", name: "Cook now", picture: "ui/power-instant" },
  { id: "freeze", name: "Freeze", picture: "ui/power-freeze" },
];

/** What the coach says about the tap the simulated player would make (the first play only). */
function coachText(action: Action, state: RoundState): string {
  if (action.kind === "tray")
    return action.item === "bun"
      ? "Tap the bun"
      : action.item === "patty" || action.item === "chicken"
        ? `Tap ${FOOD_NAMES[action.item].toLowerCase()} to grill it`
        : action.item === "fries"
          ? "Tap fries to fry them"
          : `Add ${FOOD_NAMES[action.item].toLowerCase()}`;
  if (action.kind === "cooker") {
    const slot = state.cookers[action.cooker]?.[action.slot];
    if (!slot) return action.cooker === "drink" ? "Tap the tap to pour" : "Tap to start cooking";
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
  tier,
  seed,
  coach,
  onResult,
  onAgain,
  onList,
  onExit,
}: {
  event: FestivalEvent;
  /** The pace it is played at (the event's own, or the developer's preview). */
  tier: number;
  seed: number;
  /** The first play of the first festival: point at what to tap for the first customers. */
  coach: boolean;
  onResult: (result: RoundResult) => void;
  onAgain: () => void;
  onList: () => void;
  onExit: () => void;
}) {
  const round = useMemo(() => festivalRound(event, seed, tier)!, [event, seed, tier]);
  const rival = useMemo(() => rivalPlan(round, seed), [round, seed]);
  const chef = rivalChefOf(event.rivalId);
  const chefName = chef ? `Chef ${chef.chef.split(" ")[0]}` : "The rival";
  const stallName = RIVALS.find((r) => r.id === event.rivalId)?.name ?? "Rival stall";
  const portrait = rivalPortraitPath(event.rivalId);
  const lines = event.lines!;

  const wide = useLandscape();
  const boxRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(boxRef, true);
  const counts = {
    atOnce: round.pace.atOnce,
    grill: cookerOf(round.kitchen, "grill")!.slots,
    plates: round.kitchen.plates,
    trays: round.kitchen.trays.length,
  };
  const layout = wide ? wideLayout(counts) : portraitLayout(counts, portraitHeight(box.w, box.h));
  const scale = box.w > 0 ? Math.min(box.w / layout.w, box.h / layout.h) : 0;

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
    for (const name of ROUND_PICTURES) new Image().src = festivalUrl(name);
    for (const who of PEOPLE)
      for (const mood of ["happy", "neutral", "impatient", "excited"])
        new Image().src = festivalUrl(`people/${who}-${mood}`);
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
  const ring = (a: Action) =>
    coached(a) ? <span aria-hidden="true" className="fest-coach" data-testid="fest-coach" /> : null;

  const stopped = paused || held;
  const accuracy = Math.round(accuracyOf(view) * 100);
  const best = Math.max(1, view.score, rival.final);

  const spot = (cooker: CookerId, i: number, rect: Rect) => {
    const def = cookerOf(round.kitchen, cooker)!;
    const slot = view.cookers[cooker]?.[i] ?? null;
    const phaseNow = slot ? slotPhase(def, slot) : null;
    const progress = slot ? slotProgress(def, slot) : 0;
    const name = cooker === "drink" ? "Drink tap" : cooker === "fryer" ? "Fryer" : "Grill";
    const stateText = !slot
      ? "empty"
      : `${FOOD_NAMES[slot.item]} ${phaseNow === "over" ? "overcooked" : phaseNow}`;
    return (
      <button
        key={`${cooker}-${i}`}
        type="button"
        data-testid={`fest-${cooker}-${i}`}
        data-phase={phaseNow ?? "empty"}
        data-item={slot?.item}
        aria-label={`${name} ${i + 1}: ${stateText}`}
        onPointerDown={(e) => {
          e.preventDefault();
          tap({ kind: "cooker", cooker, slot: i });
        }}
        onClick={(e) => e.detail === 0 && tap({ kind: "cooker", cooker, slot: i })}
        className={`fest-station fest-${cooker}`}
        style={at(rect)}
      >
        {cooker === "drink" ? (
          <>
            <span aria-hidden="true" className="fest-nozzle" />
            {slot ? (
              <Cup
                drink={slot.item}
                level={phaseNow === "cooking" ? progress : 1}
                className="fest-in"
              />
            ) : (
              <span className="fest-empty-label">Pour</span>
            )}
          </>
        ) : cooker === "fryer" ? (
          slot ? (
            <FryerFries phase={phaseNow!} progress={progress} className="fest-in" />
          ) : (
            <span className="fest-empty-label">Fryer</span>
          )
        ) : slot ? (
          <Meat item={slot.item} phase={phaseNow!} progress={progress} className="fest-in" />
        ) : null}
        {slot && phaseNow === "cooking" ? (
          <span aria-hidden="true" className="fest-meter">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        ) : null}
        {slot && phaseNow === "ready" ? (
          <>
            <span aria-hidden="true" className="fest-badge fest-badge-ready">
              ✓
            </span>
            {Number.isFinite(def.readyMs) ? (
              <span aria-hidden="true" className="fest-meter fest-meter-ready">
                <span style={{ transform: `scaleX(${progress})` }} />
              </span>
            ) : null}
          </>
        ) : null}
        {slot && phaseNow === "over" ? (
          <>
            <span aria-hidden="true" className="fest-badge fest-badge-over">
              !
            </span>
            <span aria-hidden="true" className="fest-meter fest-meter-over">
              <span style={{ transform: `scaleX(${progress})` }} />
            </span>
          </>
        ) : null}
        {slot && phaseNow === "burnt" ? (
          <>
            <img src={festivalUrl("ui/smoke")} alt="" className="fest-smoke" />
            <span aria-hidden="true" className="fest-badge fest-badge-burnt">
              ✕
            </span>
          </>
        ) : null}
        {ring({ kind: "cooker", cooker, slot: i })}
      </button>
    );
  };

  return (
    <div
      ref={boxRef}
      className="fest-root"
      data-testid="festival-game"
      data-event={event.id}
      data-tier={tier}
      data-phase={phase}
      data-paused={stopped || undefined}
      data-served={view.served}
      data-lost={view.lost}
      data-score={view.score}
      data-rival={rivalNow.score}
    >
      <img src={festivalUrl("burger/backdrop")} alt="" className="fest-backdrop" />
      {scale > 0 ? (
        <div
          className={`fest-stage ${layout.wide ? "fest-wide" : "fest-tall"}`}
          data-testid="fest-stage"
          style={{
            width: layout.w,
            height: layout.h,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {/* the wooden counter, from its edge to the foot of the stage (and a little past it, so no seam shows) */}
          <div
            aria-hidden="true"
            className="fest-counter"
            style={{
              left: layout.wide ? -600 : -80,
              right: layout.wide ? -600 : -80,
              top: layout.counter,
              bottom: -300,
            }}
          />

          {/* the customers */}
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
                      style={at(seat.person)}
                    />
                    <div
                      key={`bubble-${customer.id}`}
                      className={`fest-bubble fest-pop ${customer.wants.length > 1 ? "fest-multi" : ""}`}
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
                      <span aria-hidden="true" className="fest-patience">
                        <span
                          className={left > 0.6 ? "good" : left > 0.3 ? "mid" : "low"}
                          style={{ transform: `scaleX(${Math.max(0, left)})` }}
                        />
                      </span>
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
                    {customer ? null : (
                      <img
                        src={personUrl(ghost.look, ghost.mood)}
                        alt=""
                        className="fest-person fest-leaving"
                      />
                    )}
                    <span className={`fest-float ${ghost.sad ? "sad" : ""}`}>{ghost.text}</span>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* the kitchen */}
          <div aria-hidden="true" className="fest-grillplate" style={at(layout.grillPlate)} />
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
            <span aria-hidden="true" className="fest-bin-icon">
              🗑️
            </span>
            <span className="fest-tray-name">Bin</span>
            {ring({ kind: "bin" })}
          </button>
          {layout.grill.map((rect, i) => spot("grill", i, rect))}
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
                <span aria-hidden="true" className="fest-dish" />
                {parts.length ? (
                  <BurgerStack
                    parts={parts}
                    lid={wanted}
                    over={plate.some((p) => p.quality === "over")}
                    className="fest-in fest-onplate"
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
                <TrayFood item={tray.item} toCooker={tray.to !== "plate"} />
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
              <span className="fest-who">Our stall</span>
              <span className="fest-bar">
                <span style={{ transform: `scaleX(${view.score / best})` }} />
              </span>
              <span className="fest-num" data-testid="fest-score">
                {view.score}
              </span>
            </div>
            <div className="fest-score-row them">
              <span className="fest-who">{chefName}</span>
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
            Ⅱ
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
          <section className="fest-card">
            <p className="fest-kicker">Event {event.number}</p>
            <h1 className="fest-title">
              {event.emoji} {event.name}
            </h1>
            <div className="fest-vs">
              {portrait ? <img src={gameUrl(portrait)} alt="" /> : null}
              <div>
                <p className="fest-vs-name">
                  {chefName} · {stallName}
                </p>
                <p className="fest-quote">“{lines.start}”</p>
              </div>
            </div>
            <ul className="fest-goals">
              <li>⭐ Beat {rival.final} points</li>
              <li>⭐⭐ And cook {Math.round(round.pace.accuracyGoal * 100)}% perfectly</li>
              <li>⭐⭐⭐ And let no one leave</li>
            </ul>
            <p className="fest-line">
              👥 {round.orders.length} customers
              <InfoTip label="How to play">
                Tap the bun, then the raw patty. When the patty shows a green tick, tap it onto the
                bun, add what the customer's bubble shows, and tap the burger to serve it. Fries go
                in the fryer and drinks pour at the tap; tap them when they are ready. Food left too
                long burns: tap it away. The bin empties the chosen plate. Each power-up works once
                a round.
              </InfoTip>
            </p>
            <button type="button" className="fest-primary" onClick={start} data-testid="fest-start">
              Start
            </button>
            <button type="button" className="fest-secondary" onClick={onList}>
              All festivals
            </button>
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
            <img src={festivalUrl("ui/confetti")} alt="" className="fest-confetti" />
          ) : null}
          <section className="fest-card">
            {result.won ? (
              <img src={festivalUrl("ui/first-trophy")} alt="" className="fest-trophy" />
            ) : null}
            <h2 className="fest-title">{result.won ? "You win the festival!" : "So close!"}</h2>
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
                  src={festivalUrl("ui/star")}
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
            {result.won ? null : (
              <p className="fest-tip" data-testid="fest-tip">
                💡{" "}
                {result.lost > 0
                  ? "Serve whoever has waited longest first."
                  : result.wasted > 0
                    ? "Take food off as soon as the green tick shows."
                    : "Serve one after another to build a combo."}
              </p>
            )}
            <button
              type="button"
              className="fest-primary"
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

/** What a tray holds: the painted picture, or the drawn raw food. */
function TrayFood({ item, toCooker }: { item: FoodId; toCooker: boolean }) {
  if (item === "patty" || item === "chicken")
    return <Meat item={item} phase="raw" className="fest-tray-food" />;
  if (item === "fries" && toCooker) return <FryerFries phase="raw" className="fest-tray-food" />;
  return <FoodPicture item={item} className="fest-tray-food" />;
}
