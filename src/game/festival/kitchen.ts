/**
 * THE FESTIVAL KITCHEN: the rules of one round, the same for every festival. The screen calls `act` for a tap and `tick` with the time that passed; both
 * return a new state and what happened. Nothing here reads a clock or rolls dice.
 *
 *  - A tray starts something: the bun takes a free plate, raw food takes a free cooker spot, a topping goes onto a plate.
 *  - A drink machine makes its own drink (the cola tap, the lemonade tap, the shake blender).
 *  - A cooker spot: cooking -> ready (best) -> overcooked -> burnt (a drink never spoils). Tapping an empty spot starts its first food.
 *  - Where a patty or topping lands: the chosen plate when that still leads to something a waiting customer wants, else the most finished plate for
 *    which it does, else the chosen plate, else any plate that takes it.
 *  - Serving: tapping a finished plate or side gives it to the customer who has waited longest for exactly that. Nothing can go to the wrong person;
 *    what nobody ordered stays where it is. A mistake never blocks: burnt food is tapped away and a plate can go in the bin.
 *  - A pizza oven (`bake`): the mains go on raw; tapping a finished pizza that someone wants puts the whole of it in the oven, and tapping it
 *    once baked serves it. A pizza already in the oven counts as made, so the counter builds the next one.
 *  - Score: the parts' points (overcooked food counts 60 %), up to 30 % more for patience left, times the combo of orders served in a row (x1.0 to
 *    x1.5). A customer who leaves, and burnt food, break the combo.
 */
import type {
  Action,
  CookerDef,
  CookerId,
  Customer,
  FoodId,
  GameEvent,
  KitchenConfig,
  OrderItem,
  Plate,
  PowerId,
  Quality,
  RoundConfig,
  RoundState,
  Slot,
  SlotPhase,
  Step,
  Wanted,
} from "./types";
import { sortParts } from "./menu";

export const OVER_QUALITY = 0.6;
export const SPEED_BONUS = 0.3;
export const COMBO_STEP = 0.1;
export const COMBO_CAP = 5;
/** A delivered item gives a waiting customer this share of their patience back. */
export const PATIENCE_BACK = 0.12;
export const PATIENCE_POWER = 0.4;
export const FREEZE_MS = 8000;
export const FIRST_ARRIVAL_MS = 400;
export const POWER_CHARGES: Readonly<Record<PowerId, number>> = {
  patience: 1,
  instant: 1,
  freeze: 1,
};

export const cookerOf = (kitchen: KitchenConfig, id: CookerId): CookerDef | undefined =>
  kitchen.cookers.find((c) => c.id === id);

export function startState(round: RoundConfig): RoundState {
  return {
    now: 0,
    next: 0,
    nextAt: FIRST_ARRIVAL_MS,
    customers: [],
    cookers: Object.fromEntries(
      round.kitchen.cookers.map((c) => [c.id, Array.from({ length: c.slots }, () => null)]),
    ),
    plates: Array.from({ length: round.kitchen.plates }, () => []),
    selected: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    lost: 0,
    cooked: 0,
    perfect: 0,
    wasted: 0,
    powers: { ...POWER_CHARGES },
    frozenMs: 0,
    done: false,
  };
}

export function slotPhase(def: CookerDef, slot: NonNullable<Slot>): SlotPhase {
  const cook = def.cookMs[slot.item] ?? 0;
  if (slot.t < cook) return "cooking";
  if (slot.t < cook + def.readyMs) return "ready";
  if (slot.t < cook + def.readyMs + def.overMs) return "over";
  return "burnt";
}

/** How far a spot is: cooking progress 0-1, or how much of the ready / overcooked window is left. */
export function slotProgress(def: CookerDef, slot: NonNullable<Slot>): number {
  const cook = def.cookMs[slot.item] ?? 1;
  const phase = slotPhase(def, slot);
  if (phase === "cooking") return slot.t / cook;
  if (phase === "ready")
    return Number.isFinite(def.readyMs) ? 1 - (slot.t - cook) / def.readyMs : 1;
  if (phase === "over") return 1 - (slot.t - cook - def.readyMs) / def.overMs;
  return 0;
}

const key = (parts: readonly FoodId[]) => sortParts(parts).join("+");
export const plateKey = (plate: Plate) => key(plate.map((p) => p.item));

/** Is every part on the plate (and the extra one) part of this dish? */
function fitsDish(plate: Plate, extra: FoodId, parts: readonly FoodId[]): boolean {
  const left = [...parts];
  for (const item of [...plate.map((p) => p.item), extra]) {
    const at = left.indexOf(item);
    if (at < 0) return false;
    left.splice(at, 1);
  }
  return true;
}

/** What waiting customers still want, the longest waiting first. */
export function stillWanted(
  state: RoundState,
): { customer: Customer; at: number; item: OrderItem }[] {
  return [...state.customers]
    .sort((a, b) => a.id - b.id)
    .flatMap((customer) =>
      customer.wants.flatMap((w, at) => (w.done ? [] : [{ customer, at, item: w.item }])),
    );
}

/** What still has to be put together: the dishes waited for, less the ones already in the oven (the longest waiting has the oven's first). */
export function openDishes(round: KitchenConfig, state: RoundState) {
  const wanted = stillWanted(state).flatMap((w) =>
    w.item.kind === "dish" ? [{ ...w, parts: w.item.parts }] : [],
  );
  const oven = cookerOf(round, "grill");
  if (!oven?.bake) return wanted;
  const inside = (state.cookers.grill ?? []).flatMap((slot) =>
    slot?.dish && slotPhase(oven, slot) !== "burnt" ? [plateKey(slot.dish)] : [],
  );
  return wanted.filter((w) => {
    const at = inside.indexOf(key(w.parts));
    if (at < 0) return true;
    inside.splice(at, 1);
    return false;
  });
}

/** The customer who has waited longest for exactly this, if anyone has. */
export function takerFor(state: RoundState, offer: OrderItem) {
  const wanted = offer.kind === "dish" ? key(offer.parts) : offer.item;
  return stillWanted(state).find((w) =>
    offer.kind === "dish"
      ? w.item.kind === "dish" && key(w.item.parts) === wanted
      : w.item.kind === "side" && w.item.item === wanted,
  );
}

/**
 * Who this plate is for, if anyone: with a pizza oven (pass the kitchen) only a pizza that is not already in the oven, as this plate would be the
 * one to bake next.
 */
export const plateTaker = (state: RoundState, index: number, kitchen?: KitchenConfig) => {
  const plate = state.plates[index];
  if (!plate?.length) return undefined;
  const parts = plate.map((p) => p.item);
  if (kitchen && cookerOf(kitchen, "grill")?.bake) {
    const wanted = plateKey(plate);
    return openDishes(kitchen, state).find((w) => key(w.parts) === wanted);
  }
  return takerFor(state, { kind: "dish", parts });
};

/** Can the plate take this part at all (the bun starts an empty plate; the rest need the bun and have their limits)? */
export function plateTakes(kitchen: KitchenConfig, plate: Plate, item: FoodId): boolean {
  if (item === kitchen.base) return plate.length === 0;
  if (!plate.some((p) => p.item === kitchen.base)) return false;
  return plate.filter((p) => p.item === item).length < (kitchen.limits[item] ?? 0);
}

/** The plate a patty or topping lands on (-1: none takes it). */
export function targetPlate(kitchen: KitchenConfig, state: RoundState, item: FoodId): number {
  const dishes = openDishes(kitchen, state).map((w) => w.parts);
  const takes = state.plates.flatMap((plate, i) => (plateTakes(kitchen, plate, item) ? [i] : []));
  const leads = takes.filter((i) => dishes.some((d) => fitsDish(state.plates[i]!, item, d)));
  if (leads.includes(state.selected)) return state.selected;
  if (leads.length)
    return [...leads].sort(
      (a, b) => state.plates[b]!.length - state.plates[a]!.length || a - b,
    )[0]!;
  if (takes.includes(state.selected)) return state.selected;
  return takes[0] ?? -1;
}

const hint = (state: RoundState, text: string): Step => ({
  state,
  events: [{ type: "hint", text }],
});

const withSlot = (state: RoundState, cooker: CookerId, at: number, slot: Slot): RoundState => ({
  ...state,
  cookers: {
    ...state.cookers,
    [cooker]: state.cookers[cooker]!.map((s, i) => (i === at ? slot : s)),
  },
});
const withPlate = (state: RoundState, at: number, plate: Plate): RoundState => ({
  ...state,
  plates: state.plates.map((p, i) => (i === at ? plate : p)),
});

/** The score of a customer whose last item has just arrived. */
export function orderScore(kitchen: KitchenConfig, customer: Customer, combo: number): number {
  const base = customer.wants.reduce((sum, w) => {
    const parts = w.item.kind === "dish" ? w.item.parts : [w.item.item];
    const points = parts.reduce((p, item) => p + (kitchen.points[item] ?? 0), 0);
    return sum + points * (w.quality === "over" ? OVER_QUALITY : 1);
  }, 0);
  const speed = base * SPEED_BONUS * Math.max(0, Math.min(1, customer.patience / customer.max));
  return Math.round(
    (base + speed) * (1 + COMBO_STEP * Math.min(COMBO_CAP, Math.max(0, combo - 1))),
  );
}

const finished = (round: RoundConfig, state: RoundState) =>
  state.next >= round.orders.length && state.customers.length === 0;

/** Gives one wanted thing to a customer; serves them when it was the last. */
function deliver(
  round: RoundConfig,
  state: RoundState,
  taker: { customer: Customer; at: number },
  quality: Quality,
): Step {
  const { customer, at } = taker;
  const wants: Wanted[] = customer.wants.map((w, i) =>
    i === at ? { ...w, done: true, quality } : w,
  );
  const fed: Customer = {
    ...customer,
    wants,
    patience: Math.min(customer.max, customer.patience + customer.max * PATIENCE_BACK),
  };
  const events: GameEvent[] = [{ type: "delivered", seat: customer.seat }];
  if (!wants.every((w) => w.done))
    return {
      state: { ...state, customers: state.customers.map((c) => (c.id === fed.id ? fed : c)) },
      events,
    };
  const combo = state.combo + 1;
  const points = orderScore(round.kitchen, fed, combo);
  const next: RoundState = {
    ...state,
    customers: state.customers.filter((c) => c.id !== fed.id),
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    served: state.served + 1,
    score: state.score + points,
  };
  events.push({ type: "served", seat: fed.seat, id: fed.id, points, combo });
  return { state: { ...next, done: finished(round, next) }, events };
}

function placeOnPlate(state: RoundState, at: number, item: FoodId, quality: Quality): Step {
  return {
    state: { ...withPlate(state, at, [...state.plates[at]!, { item, quality }]), selected: at },
    events: [{ type: "placed", plate: at, item }],
  };
}

function startCooking(
  round: RoundConfig,
  state: RoundState,
  cooker: CookerId,
  item: FoodId,
  at: number,
): Step {
  return {
    state: withSlot(state, cooker, at, { item, t: 0 }),
    events: [{ type: "cooking", cooker, slot: at }],
  };
}

const stationName = (kitchen: KitchenConfig, id: CookerId): string =>
  id === "grill"
    ? `The ${kitchen.words.hot.toLowerCase()}`
    : id === "fryer"
      ? `The ${kitchen.words.fry.toLowerCase()}`
      : "The tap";

function actTray(round: RoundConfig, state: RoundState, item: FoodId): Step {
  const tray = round.kitchen.trays.find((t) => t.item === item);
  if (!tray) return { state, events: [] };
  if (tray.to !== "plate") {
    const free = state.cookers[tray.to]!.indexOf(null);
    return free < 0
      ? hint(state, `${stationName(round.kitchen, tray.to)} is full`)
      : startCooking(round, state, tray.to, item, free);
  }
  if (item === round.kitchen.base) {
    const free = state.plates.findIndex((p) => p.length === 0);
    return free < 0
      ? hint(state, "Serve or bin a plate first")
      : placeOnPlate(state, free, item, "good");
  }
  const at = targetPlate(round.kitchen, state, item);
  return at < 0
    ? hint(state, `Put ${round.kitchen.words.aBase} on a plate first`)
    : placeOnPlate(state, at, item, "good");
}

/** What tapping an empty spot starts: a drink machine's own drink, else the cooker's first food. */
const emptySpotItem = (def: CookerDef, at: number): FoodId | undefined =>
  def.perSlot ? def.perSlot[at] : (Object.keys(def.cookMs) as FoodId[])[0];

function actCooker(round: RoundConfig, state: RoundState, cooker: CookerId, at: number): Step {
  const def = cookerOf(round.kitchen, cooker);
  const slots = state.cookers[cooker];
  if (!def || !slots || at < 0 || at >= slots.length) return { state, events: [] };
  const slot = slots[at];
  if (!slot) {
    if (def.bake) return hint(state, `Tap a finished ${round.kitchen.words.dish} to bake it`);
    const item = emptySpotItem(def, at);
    return item ? startCooking(round, state, cooker, item, at) : { state, events: [] };
  }
  const phase = slotPhase(def, slot);
  if (phase === "cooking")
    return hint(state, def.id === "drink" ? "Still pouring" : "Not ready yet");
  if (phase === "burnt")
    // (it was counted as wasted when it burnt)
    return { state: withSlot(state, cooker, at, null), events: [{ type: "binned" }] };
  const quality: Quality = phase === "over" ? "over" : "good";
  const counted = (s: RoundState): RoundState =>
    def.id === "drink"
      ? s
      : { ...s, cooked: s.cooked + 1, perfect: s.perfect + (quality === "good" ? 1 : 0) };
  if (def.bake) {
    // what comes out of the oven is served as it is
    const taker = takerFor(state, { kind: "dish", parts: slot.dish!.map((p) => p.item) });
    if (!taker) return hint(state, "Nobody is waiting for it now");
    const out = counted(withSlot(state, cooker, at, null));
    return deliver(round, out, taker, quality);
  }
  if (def.serves) {
    const taker = takerFor(state, { kind: "side", item: slot.item });
    if (!taker) return hint(state, "Nobody is waiting for it yet");
    return deliver(round, counted(withSlot(state, cooker, at, null)), taker, quality);
  }
  const plate = targetPlate(round.kitchen, state, slot.item);
  if (plate < 0) return hint(state, `Put ${round.kitchen.words.aBase} on a plate first`);
  // (a cooked part is counted when it leaves the counter: served, or binned with its plate)
  return placeOnPlate(withSlot(state, cooker, at, null), plate, slot.item, quality);
}

/** The cooked parts on a plate (the things that count for accuracy). */
const cookedParts = (round: RoundConfig, plate: Plate) =>
  plate.filter((p) =>
    // (a pizza's base is cooked only once it has been in the oven, never while it is on a plate)
    round.kitchen.cookers.some((c) => !c.serves && !c.bake && c.cookMs[p.item] !== undefined),
  );

function actPlate(round: RoundConfig, state: RoundState, at: number): Step {
  const plate = state.plates[at];
  if (!plate) return { state, events: [] };
  const taker = plateTaker(state, at, round.kitchen);
  const oven = cookerOf(round.kitchen, "grill");
  if (taker && oven?.bake) {
    const free = state.cookers.grill!.indexOf(null);
    if (free < 0) return hint(state, `The ${round.kitchen.words.hot.toLowerCase()} is full`);
    const emptied: RoundState = { ...withPlate(state, at, []), selected: at };
    return {
      state: withSlot(emptied, "grill", free, { item: round.kitchen.base, t: 0, dish: plate }),
      events: [{ type: "cooking", cooker: "grill", slot: free }],
    };
  }
  if (taker) {
    const cooked = cookedParts(round, plate);
    const quality: Quality = plate.some((p) => p.quality === "over") ? "over" : "good";
    const emptied: RoundState = {
      ...withPlate(state, at, []),
      selected: at,
      cooked: state.cooked + cooked.length,
      perfect: state.perfect + cooked.filter((p) => p.quality === "good").length,
    };
    return deliver(round, emptied, taker, quality);
  }
  if (state.selected !== at) return { state: { ...state, selected: at }, events: [] };
  if (!plate.length)
    return hint(
      state,
      `Tap the ${round.kitchen.words.base.toLowerCase()} to start a ${round.kitchen.words.dish}`,
    );
  return hint(state, "No one ordered it like this yet");
}

function actBin(round: RoundConfig, state: RoundState): Step {
  const plate = state.plates[state.selected];
  if (!plate?.length) return hint(state, "Tap a plate, then the bin");
  const cooked = cookedParts(round, plate).length;
  return {
    state: {
      ...withPlate(state, state.selected, []),
      cooked: state.cooked + cooked,
      wasted: state.wasted + cooked,
    },
    events: [{ type: "binned" }],
  };
}

function actPower(round: RoundConfig, state: RoundState, power: PowerId): Step {
  if (state.powers[power] <= 0) return hint(state, "Used up for this round");
  let next: RoundState;
  if (power === "patience") {
    if (!state.customers.length) return hint(state, "No one is waiting");
    next = {
      ...state,
      customers: state.customers.map((c) => ({
        ...c,
        patience: Math.min(c.max, c.patience + c.max * PATIENCE_POWER),
      })),
    };
  } else if (power === "freeze") {
    if (!state.customers.length) return hint(state, "No one is waiting");
    next = { ...state, frozenMs: FREEZE_MS };
  } else {
    let any = false;
    const cookers = Object.fromEntries(
      round.kitchen.cookers.map((def) => [
        def.id,
        state.cookers[def.id]!.map((slot) => {
          if (!slot || slotPhase(def, slot) !== "cooking") return slot;
          any = true;
          return { ...slot, t: def.cookMs[slot.item]! };
        }),
      ]),
    );
    if (!any) return hint(state, "Nothing is cooking");
    next = { ...state, cookers };
  }
  return {
    state: { ...next, powers: { ...next.powers, [power]: next.powers[power] - 1 } },
    events: [{ type: "power", power }],
  };
}

export function act(round: RoundConfig, state: RoundState, action: Action): Step {
  if (state.done) return { state, events: [] };
  if (action.kind === "tray") return actTray(round, state, action.item);
  if (action.kind === "cooker") return actCooker(round, state, action.cooker, action.slot);
  if (action.kind === "plate") return actPlate(round, state, action.plate);
  if (action.kind === "bin") return actBin(round, state);
  return actPower(round, state, action.power);
}

export const PATIENCE_PER_ITEM = 5000;
export const PATIENCE_PER_TOPPING = 2000;
/** A bigger order is given longer: more for each extra item, and for each part of a burger beyond the bun, the meat and one more. */
export const patienceFor = (base: number, items: readonly OrderItem[]): number =>
  base +
  (items.length - 1) * PATIENCE_PER_ITEM +
  items.reduce((sum, i) => sum + (i.kind === "dish" ? Math.max(0, i.parts.length - 3) : 0), 0) *
    PATIENCE_PER_TOPPING;

/** Time passes: food cooks (and may spoil), patience runs down, customers walk up and may leave. */
export function tick(round: RoundConfig, state: RoundState, ms: number): Step {
  if (state.done || !(ms > 0)) return { state, events: [] };
  const events: GameEvent[] = [];
  const now = state.now + ms;
  let burntNow = 0;
  const cookers = Object.fromEntries(
    round.kitchen.cookers.map((def) => [
      def.id,
      state.cookers[def.id]!.map((slot, i) => {
        if (!slot) return slot;
        const before = slotPhase(def, slot);
        if (before === "burnt") return slot;
        const moved = { ...slot, t: slot.t + ms };
        const after = slotPhase(def, moved);
        if (after !== before) {
          if (before === "cooking") events.push({ type: "ready", cooker: def.id, slot: i });
          if (after === "burnt") {
            burntNow++;
            events.push({ type: "burnt", cooker: def.id, slot: i });
          }
        }
        return moved;
      }),
    ]),
  );
  const frozen = Math.min(state.frozenMs, ms);
  const drain = ms - frozen;
  let lost = 0;
  const customers = state.customers.flatMap((c) => {
    const patience = c.patience - drain;
    if (patience > 0) return [{ ...c, patience }];
    lost++;
    events.push({ type: "left", seat: c.seat, id: c.id });
    return [];
  });
  let next = state.next;
  let nextAt = state.nextAt;
  // an empty counter fills at once (after the opening moment): the player is never left waiting
  const due = now >= nextAt || (customers.length === 0 && next > 0);
  if (next < round.orders.length && customers.length < round.pace.atOnce && due) {
    const taken = new Set(customers.map((c) => c.seat));
    const seat = Array.from({ length: round.pace.atOnce }, (_, i) => i).find((i) => !taken.has(i))!;
    const spec = round.orders[next]!;
    const max = patienceFor(round.pace.patienceMs, spec.items);
    customers.push({
      id: next,
      seat,
      wants: spec.items.map((item) => ({ item, done: false })),
      patience: max,
      max,
    });
    events.push({ type: "arrive", seat, id: next });
    next++;
    nextAt = now + round.pace.arriveMs;
  }
  const moved: RoundState = {
    ...state,
    now,
    next,
    nextAt,
    cookers,
    customers,
    frozenMs: state.frozenMs - frozen,
    lost: state.lost + lost,
    cooked: state.cooked + burntNow,
    wasted: state.wasted + burntNow,
    combo: lost || burntNow ? 0 : state.combo,
  };
  return { state: { ...moved, done: finished(round, moved) }, events };
}

/** Delivered-at-their-best out of all cooked things that ended, 0-1 (1 when nothing was cooked). */
export const accuracyOf = (state: RoundState): number =>
  state.cooked > 0 ? state.perfect / state.cooked : 1;

export type RoundResult = {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  score: number;
  rival: number;
  served: number;
  orders: number;
  lost: number;
  accuracy: number;
  bestCombo: number;
  wasted: number;
};

/** The finished round against the rival's final score (a tie is the player's). Stars: win; and the accuracy goal; and no one left unserved. */
export function resultOf(round: RoundConfig, state: RoundState, rival: number): RoundResult {
  const accuracy = accuracyOf(state);
  const won = state.score >= rival && state.served > 0;
  const accurate = accuracy >= round.pace.accuracyGoal - 1e-9;
  const stars = !won ? 0 : !accurate ? 1 : state.lost > 0 ? 2 : 3;
  return {
    won,
    stars,
    score: state.score,
    rival,
    served: state.served,
    orders: round.orders.length,
    lost: state.lost,
    accuracy,
    bestCombo: state.bestCombo,
    wasted: state.wasted,
  };
}
