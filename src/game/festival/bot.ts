/**
 * A SIMULATED PLAYER. It plays the real rules (kitchen.ts `act` and `tick`), one tap at a time with a reaction pause between taps. Three uses:
 *  - the rival's score is a share of what it scores quickly, so every round's target comes from the round itself;
 *  - the tests prove every event can be won by a slower player (scripts/festival-rival-qa.mts);
 *  - the first-play coach points at the tap it would make.
 * It uses no power-ups. Pure.
 */
import {
  FIRST_ARRIVAL_MS,
  act,
  cookerOf,
  plateTaker,
  slotPhase,
  startState,
  stillWanted,
  takerFor,
  tick,
} from "./kitchen";
import type { Action, CookerId, FoodId, RoundConfig, RoundState } from "./types";

/** Which waiting dish each plate is being built for (longest waiting first, the fullest plate that still fits). */
function assignPlates(state: RoundState) {
  const dishes = stillWanted(state).flatMap((w) => (w.item.kind === "dish" ? [w.item.parts] : []));
  const forPlate: (readonly FoodId[] | undefined)[] = state.plates.map(() => undefined);
  const open: (readonly FoodId[])[] = [];
  /** The assigned plates, the longest waiting customer's first. */
  const byWaiting: number[] = [];
  for (const parts of dishes) {
    let best = -1;
    state.plates.forEach((plate, i) => {
      if (forPlate[i] || !plate.length) return;
      const left = [...parts];
      const fits = plate.every((p) => {
        const at = left.indexOf(p.item);
        if (at < 0) return false;
        left.splice(at, 1);
        return true;
      });
      if (fits && (best < 0 || plate.length > state.plates[best]!.length)) best = i;
    });
    if (best >= 0) {
      forPlate[best] = parts;
      byWaiting.push(best);
    } else open.push(parts);
  }
  return { forPlate, open, byWaiting };
}

/** The parts a plate still needs for its dish. */
function missingOn(state: RoundState, plate: number, parts: readonly FoodId[]): FoodId[] {
  const left = [...parts];
  for (const p of state.plates[plate]!) {
    const at = left.indexOf(p.item);
    if (at >= 0) left.splice(at, 1);
  }
  return left;
}

const countOf = <T>(list: readonly T[], value: T) => list.filter((v) => v === value).length;

/** The tap the simulated player would make now, or null when there is nothing useful to do. */
export function nextAction(round: RoundConfig, state: RoundState): Action | null {
  if (state.done) return null;
  const { kitchen } = round;
  const spots = kitchen.cookers.flatMap((def) =>
    state.cookers[def.id]!.map((slot, i) => ({
      def,
      slot,
      i,
      phase: slot ? slotPhase(def, slot) : null,
    })),
  );
  const tapSpot = (cooker: CookerId, slot: number): Action => ({ kind: "cooker", cooker, slot });
  // 1. burnt food is in the way
  const burnt = spots.find((s) => s.phase === "burnt");
  if (burnt) return tapSpot(burnt.def.id, burnt.i);
  // 2. serve what is finished
  const ready = state.plates.findIndex((_, i) => plateTaker(state, i));
  if (ready >= 0) return { kind: "plate", plate: ready };
  const side = spots.find(
    (s) =>
      s.def.serves &&
      (s.phase === "ready" || s.phase === "over") &&
      takerFor(state, { kind: "side", item: s.slot!.item }),
  );
  if (side) return tapSpot(side.def.id, side.i);
  const { forPlate, open, byWaiting } = assignPlates(state);
  const missing = forPlate.map((parts, i) => (parts ? missingOn(state, i, parts) : []));
  // 3. a plate nobody wants goes in the bin once every plate is taken
  const stale = state.plates.findIndex((p, i) => p.length > 0 && !forPlate[i]);
  if (stale >= 0 && state.plates.every((p) => p.length > 0) && open.length > 0)
    return state.selected === stale ? { kind: "bin" } : { kind: "plate", plate: stale };
  // 4. take cooked patties to a plate that needs one
  const cookedOnGrill = spots.find(
    (s) =>
      !s.def.serves &&
      (s.phase === "ready" || s.phase === "over") &&
      missing.some((m) => m.includes(s.slot!.item)),
  );
  if (cookedOnGrill) return tapSpot(cookedOnGrill.def.id, cookedOnGrill.i);
  // 5. finish the burgers already started, the longest waiting first, before starting anything new
  for (const i of byWaiting) {
    const topping = missing[i]!.find((item) =>
      kitchen.trays.some((t) => t.item === item && t.to === "plate"),
    );
    if (topping)
      return state.selected === i ? { kind: "tray", item: topping } : { kind: "plate", plate: i };
  }
  // 6. a bun down before its patty is ready, so cooked food always has somewhere to go
  if (open.length > 0 && state.plates.some((p) => p.length === 0))
    return { kind: "tray", item: kitchen.base };
  // 7. put on the grill, the fryer and the tap what the waiting orders still need
  // (patties only for burgers that have a bun down: a patty with nowhere to go just burns)
  const needed: FoodId[] = [
    ...missing.flat(),
    ...stillWanted(state).flatMap((w) => (w.item.kind === "side" ? [w.item.item] : [])),
  ];
  const making = spots.flatMap((s) => (s.slot && s.phase !== "burnt" ? [s.slot.item] : []));
  for (const def of kitchen.cookers) {
    for (const item of Object.keys(def.cookMs) as FoodId[]) {
      if (countOf(needed, item) <= countOf(making, item)) continue;
      // (a drink machine makes only its own drink)
      const free = def.perSlot
        ? state.cookers[def.id]!.findIndex((slot, i) => slot === null && def.perSlot![i] === item)
        : state.cookers[def.id]!.indexOf(null);
      if (free < 0) continue;
      return kitchen.trays.some((t) => t.item === item && t.to === def.id)
        ? { kind: "tray", item }
        : tapSpot(def.id, free);
    }
  }
  return null;
}

export const BOT_STEP_MS = 100;
/** A round never runs longer than this in simulation (a guard, never reached by a playable round). */
export const BOT_LIMIT_MS = 15 * 60_000;

export type BotRun = { state: RoundState; ms: number; taps: number; finishedAt: number[] };

/** Plays a whole round, tapping at most once every `reactionMs`. `finishedAt`: when each served order was served. */
export function playRound(round: RoundConfig, reactionMs: number): BotRun {
  let state = startState(round);
  let wait = FIRST_ARRIVAL_MS;
  let taps = 0;
  const finishedAt: number[] = [];
  while (!state.done && state.now < BOT_LIMIT_MS) {
    state = tick(round, state, BOT_STEP_MS).state;
    wait -= BOT_STEP_MS;
    if (wait > 0 || state.done) continue;
    const action = nextAction(round, state);
    if (!action) continue;
    const step = act(round, state, action);
    state = step.state;
    taps++;
    wait = reactionMs;
    for (const e of step.events) if (e.type === "served") finishedAt.push(state.now);
  }
  return { state, ms: state.now, taps, finishedAt };
}

export { cookerOf };
