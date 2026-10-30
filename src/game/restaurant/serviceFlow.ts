/**
 * SERVICE FLOW (Phase 2, developer 2026-10-30, docs/planning/PHASE2-PLAN-2026-10-30.md): customers
 * arrive on a clock, wait in a queue at the door and walk out when their patience runs out.
 *
 *  - The ORDER keeps its own chain (orderStateTypes.ts) and stays the only thing money hangs on.
 *    A guest's `GuestState` only drives the floor and the queue; it is never saved.
 *  - `arrivalSchedule`: when each customer of a service reaches the door. The level's own
 *    orders come first, in order, then its menu guests, then its walk-ins (the counts the
 *    service already has: menuGuestsFor / walkInsFor), one every `gapMs`. Levels 1–4 take one
 *    customer at a time (no clock, no patience), as before.
 *  - `stepQueue`: the reducer the floor runs every frame. The service clock only moves while a
 *    service is on screen (the caller passes dt = 0 when paused); one step is at most
 *    `MAX_STEP_MS`, so a long frame (or coming back from the background) is never a burst.
 *  - Patience drains only while WAITING. A level's own order never walks out, so a level can
 *    always be finished. A walk-out is a lost sale only: no pay, no ledger entry, no penalty.
 *
 * Pure: no React, no wallet, no ledger, no Math.random, no save.
 */

export type GuestKind = "order" | "guest" | "walk-in";

export type GuestState =
  /** In the queue at the door; patience drains. */
  | "WAITING"
  /** At a table; the order runs PENDING..READY; patience paused. */
  | "SEATED"
  /** Served and gone (paid through the order's own chain). */
  | "LEFT"
  /** Patience ran out while waiting: no order, no pay. */
  | "WALKED_OUT";

export type Arrival = {
  /** Stable and deterministic: "<levelId>:<index>". */
  id: string;
  /** Service-clock time the customer reaches the door. */
  atMs: number;
  kind: GuestKind;
  /** Index among the customers of its kind (the n-th menu guest, the n-th required order). */
  index: number;
  /** How long they wait at the door before walking out (Infinity: never). */
  patienceMs: number;
};

export type Pace = { fromLevel: number; gapMs: number; patienceMs: number };

/** The developer's pace (decision Q2): from Level 5 a customer every 35 s, down to 22 s by Level 40. */
export const PACE: readonly Pace[] = [
  { fromLevel: 1, gapMs: Infinity, patienceMs: Infinity },
  { fromLevel: 5, gapMs: 35_000, patienceMs: 150_000 },
  { fromLevel: 20, gapMs: 28_000, patienceMs: 120_000 },
  { fromLevel: 40, gapMs: 22_000, patienceMs: 100_000 },
];

/** The shortest gap a bigger team brings the pace down to. */
export const MIN_GAP_MS = 15_000;
/** People waiting at the door at once; later arrivals wait outside, in order. */
export const QUEUE_MAX = 4;
/** The longest single clock step. */
export const MAX_STEP_MS = 250;

export function paceAt(levelNumber: number): Pace {
  return [...PACE].reverse().find((p) => levelNumber >= p.fromLevel) ?? PACE[0]!;
}

/** True where customers come one at a time (Levels 1–4): no clock, no patience. */
export const oneAtATime = (levelNumber: number) => paceAt(levelNumber).gapMs === Infinity;

/** The gap between arrivals: the level's pace, shorter with a bigger team (capacity above the chef's 2). */
export function gapFor(levelNumber: number, capacity: number): number {
  const { gapMs } = paceAt(levelNumber);
  if (gapMs === Infinity) return Infinity;
  return Math.max(MIN_GAP_MS, Math.round((gapMs * 2) / Math.max(2, capacity)));
}

export type ScheduleInput = {
  levelId: string;
  levelNumber: number;
  /** The level's own orders still to come. */
  orders: number;
  /** Menu guests still to come. */
  guests: number;
  /** Walk-ins still to come. */
  walkIns: number;
  /** The team's capacity (menuGuestCapacity). */
  capacity: number;
};

/** When each customer of the service reaches the door (pure; the same input, the same schedule). */
export function arrivalSchedule(input: ScheduleInput): Arrival[] {
  const pace = paceAt(input.levelNumber);
  const gap = gapFor(input.levelNumber, input.capacity);
  const kinds: [GuestKind, number][] = [
    ["order", input.orders],
    ["guest", input.guests],
    ["walk-in", input.walkIns],
  ];
  const out: Arrival[] = [];
  for (const [kind, count] of kinds)
    for (let index = 0; index < count; index++) {
      const i = out.length;
      out.push({
        id: `${input.levelId}:${i}`,
        atMs: gap === Infinity ? 0 : i * gap,
        kind,
        index,
        // A level's own order never walks out (it must be cookable to finish the level).
        patienceMs: kind === "order" ? Infinity : pace.patienceMs,
      });
    }
  return out;
}

export type QueuedGuest = { arrival: Arrival; state: GuestState; waitedMs: number };

export type QueueState = {
  clockMs: number;
  /** Arrivals not at the door yet, in order. */
  outside: Arrival[];
  /** Everyone who reached the door, in arrival order. */
  guests: QueuedGuest[];
  oneAtATime: boolean;
};

export function startQueue(schedule: readonly Arrival[], levelNumber: number): QueueState {
  return admit({
    clockMs: 0,
    outside: [...schedule],
    guests: [],
    oneAtATime: oneAtATime(levelNumber),
  });
}

const isActive = (g: QueuedGuest) => g.state === "WAITING" || g.state === "SEATED";
export const waitingOf = (q: QueueState) => q.guests.filter((g) => g.state === "WAITING");

/** Brings in the arrivals that are due, within QUEUE_MAX (one at a time: only when nobody is in). */
function admit(q: QueueState): QueueState {
  const outside = [...q.outside];
  const guests = [...q.guests];
  while (outside.length > 0 && outside[0]!.atMs <= q.clockMs) {
    if (q.oneAtATime ? guests.some(isActive) : waitingOf({ ...q, guests }).length >= QUEUE_MAX)
      break;
    guests.push({ arrival: outside.shift()!, state: "WAITING", waitedMs: 0 });
  }
  return { ...q, outside, guests };
}

/**
 * One frame: the clock moves by `dtMs` (at most MAX_STEP_MS; 0 while paused), waiting guests
 * lose patience (unless `patiencePaused`, e.g. under Auto service), and due arrivals come in.
 */
export function stepQueue(
  q: QueueState,
  dtMs: number,
  opts: { patiencePaused?: boolean } = {},
): QueueState {
  const dt = Math.max(0, Math.min(dtMs, MAX_STEP_MS));
  if (dt === 0) return q;
  const guests = q.guests.map((g): QueuedGuest => {
    if (g.state !== "WAITING" || opts.patiencePaused || q.oneAtATime) return g;
    const waitedMs = g.waitedMs + dt;
    return waitedMs >= g.arrival.patienceMs
      ? { ...g, state: "WALKED_OUT", waitedMs }
      : { ...g, waitedMs };
  });
  return admit({ ...q, clockMs: q.clockMs + dt, guests });
}

/** The next customer to seat: the first one waiting (first come, first served). */
export function nextToSeat(q: QueueState): Arrival | null {
  return waitingOf(q)[0]?.arrival ?? null;
}

const setState = (q: QueueState, id: string, from: GuestState, to: GuestState): QueueState =>
  admit({
    ...q,
    guests: q.guests.map((g) =>
      g.arrival.id === id && g.state === from ? { ...g, state: to } : g,
    ),
  });

/** WAITING → SEATED (the order is taken; patience stops). */
export const seatGuest = (q: QueueState, id: string) => setState(q, id, "WAITING", "SEATED");
/** SEATED → LEFT (served; the order's own chain has paid). */
export const guestLeft = (q: QueueState, id: string) => setState(q, id, "SEATED", "LEFT");

/** Calls the next arrival in now (Next Customer with nobody at the door): its time becomes the clock's. */
export function callNext(q: QueueState): QueueState {
  if (q.outside.length === 0 || waitingOf(q).length > 0) return q;
  const [first, ...rest] = q.outside;
  const shift = Math.max(0, first!.atMs - q.clockMs);
  return admit({
    ...q,
    outside: [{ ...first!, atMs: q.clockMs }, ...rest.map((a) => ({ ...a, atMs: a.atMs - shift }))],
  });
}

/** Nobody waiting, seated or still to come. */
export const queueDone = (q: QueueState) => q.outside.length === 0 && !q.guests.some(isActive);
