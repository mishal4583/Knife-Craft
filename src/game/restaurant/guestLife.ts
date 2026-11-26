/**
 * The first floor's walking guests (NPC realism, developer 2026-11-07). They are ordinary map actors (`FloorActor`, the same engine as the
 * Second Floor and the staff): painted people with a facing, a pace of their own, a place of their own at the counter and a chair of their own.
 *
 * ROUTES (developer 2026-11-08: "they are walking on top of tables, optimize their walking"): the map has six artworks with the tables in
 * different places, so a route is found on the stage's own plan (guestWalk.ts: table centres per artwork, a grid search around every table
 * and its chairs, then pulled straight): in through the door, to the counter to order, around the tables to their own chair, a long sit, and
 * out the same careful way. Nobody steps on a table top; a party never walks on top of itself (each member has their own counter spot and
 * chair; the party's members start a few seconds apart). The cast (2026-11-08): a food blogger on her own, a businessman and an
 * affluent diner, and a family of four (father, mother, child and grandmother). Pure; seeded by nothing (the cast is fixed per stage); never
 * touches the save.
 */
import type { FloorActor, Stop } from "./floorLife";
import {
  geoOf,
  blockedAt,
  canWalk,
  chairOf,
  counterSpot,
  doorLanes,
  walkPath,
  type Pt,
  type Slot,
  type StageTable,
  type WalkStage,
} from "./guestWalk";

/** How many lanes the street door gives (guestWalk.ts `doorLanes`): a member's `lane` is an index into them. */
const LANES = 4;

/** Outside the street door, where a guest waits between laps (the geometry of the plan the guest walks on: tall or wide, see guestWalk.ts `geoOf`). */
const door = (stage: WalkStage, x: number, away: number): Stop => ({
  x,
  y: geoOf(stage).outsideY,
  hold: away,
  pose: "away",
});

type Member = {
  id: string;
  look: string;
  /** Where this guest would like to stand at the counter (the nearest open spot is used). */
  wantX: number;
  /** The way in and out: which lane of the street door this guest uses (0 to 3, `doorLanes`: the same lane both ways, so nobody crosses a door leaf or the wall). */
  lane: number;
  /** Seconds at the door between laps (keeps the room from being a crowd). */
  away: number;
  /** Seconds after the map opens until this guest steps through the door (the party's start + the member's stagger). */
  delay: number;
};

type Party = { slots: readonly Slot[]; first: number; members: Member[] };

const PARTIES: readonly Party[] = [
  {
    slots: ["bottom", "left", "right", "top"],
    first: 0,
    members: [
      { id: "guest-family-1", look: "family-father", wantX: 42, lane: 0, away: 34, delay: 14 },
      { id: "guest-family-2", look: "family-mother", wantX: 50, lane: 1, away: 34, delay: 17.5 },
      { id: "guest-family-3", look: "family-child", wantX: 59, lane: 2, away: 34, delay: 21 },
      { id: "guest-family-4", look: "elder-f2", wantX: 68, lane: 3, away: 34, delay: 24.5 },
    ],
  },
  {
    slots: ["left", "right", "bottom", "top"],
    first: 1,
    members: [
      { id: "guest-couple-1", look: "businessman", wantX: 46, lane: 0, away: 22, delay: 6 },
      { id: "guest-couple-2", look: "affluent-diner-f", wantX: 56, lane: 2, away: 22, delay: 8 },
    ],
  },
  {
    slots: ["bottom", "top", "left", "right"],
    first: 2,
    members: [{ id: "guest-solo", look: "food-blogger-f", wantX: 52, lane: 1, away: 14, delay: 0 }],
  },
];

type Seat = { table: StageTable; chair: Pt };

/** Every chair of the stage's tables that a guest can walk to from the door (a packed room leaves some tables out). */
function reachableChairs(stage: WalkStage): Map<string, Seat | null> {
  const out = new Map<string, Seat | null>();
  const tables = geoOf(stage).tables;
  tables.forEach((t, ti) => {
    for (const slot of ["bottom", "left", "right", "top"] as const) {
      const chair = chairOf(t, slot, stage);
      out.set(
        `${ti}:${slot}`,
        t.booth ||
          blockedAt(stage, chair, t) ||
          !canWalk(stage, { x: doorLanes(stage, 1)[0]!, y: geoOf(stage).insideY }, chair, t)
          ? null
          : { table: t, chair },
      );
    }
  });
  return out;
}

/** The stage's seats given out: every member of every party gets their own chair (tables are tried from the party's own first one). */
function seatsFor(stage: WalkStage): Map<string, Seat> {
  const chairs = reachableChairs(stage);
  const seated = geoOf(stage)
    .tables.map((t, i) => ({ t, i }))
    .filter((x) => !x.t.booth);
  const taken = new Set<string>();
  const out = new Map<string, Seat>();
  for (const party of PARTIES) {
    for (const m of party.members) {
      let pick: { key: string; seat: Seat } | null = null;
      for (const reuse of [false, true]) {
        for (let k = 0; k < seated.length && !pick; k++) {
          const { i } = seated[(party.first + k) % seated.length]!;
          for (const slot of party.slots) {
            const key = `${i}:${slot}`;
            const seat = chairs.get(key);
            if (seat && (reuse || !taken.has(key))) {
              pick = { key, seat };
              break;
            }
          }
        }
        if (pick) break;
      }
      if (pick) {
        taken.add(pick.key);
        out.set(m.id, pick.seat);
      }
    }
  }
  return out;
}

/**
 * The first open spot straight above the door lane, just inside the room: where the walk through the door turns into the walk across the floor. The way in and the way out are
 * a plain vertical line from the street to here (so the painted person faces the camera or away from it, never sideways, and never meets a door leaf). Null when a table's chair is in the way.
 */
function gateOf(stage: WalkStage, x: number): Pt | null {
  const g = geoOf(stage);
  for (let up = 2; up <= 9; up += 0.5) {
    const p = { x, y: g.room.y1 - up };
    if (!blockedAt(stage, p)) return p;
  }
  return null;
}

function actorOf(stage: WalkStage, m: Member, seat: Seat, taken: number[]): FloorActor {
  const g = geoOf(stage);
  const laneX = doorLanes(stage, LANES)[m.lane]!;
  const entry: Pt = { x: laneX, y: g.entryY };
  const gate = gateOf(stage, laneX);
  // The walk across the floor starts at the gate (just inside the door), not at the street.
  const start: Pt = gate ?? entry;
  // A room packed to the counter may leave no way to it: that guest sits down without queueing.
  const counter = counterSpot(stage, m.wantX + g.counterShift, g.counterY, taken, start);
  if (counter) taken.push(counter.x);
  const inside: Pt = { x: laneX, y: g.insideY };
  const toCounter = counter ? (walkPath(stage, start, counter) ?? [counter]) : [];
  const toChair = walkPath(stage, counter ?? start, seat.chair, seat.table) ?? [seat.chair];
  const out = walkPath(stage, seat.chair, gate ?? inside, seat.table) ?? [gate ?? inside];
  const stops: Stop[] = [
    door(stage, laneX, m.away),
    entry,
    ...(gate ? [gate] : []),
    ...(counter
      ? [...toCounter.slice(0, -1), { ...counter, hold: 2.6, pose: "pick" as const }]
      : []),
    ...toChair.slice(0, -1),
    { ...seat.chair, hold: 15, pose: "sit" },
    ...out,
    // out through the door in a straight vertical line, in the lane they came in by
    ...(gate && gate.y < inside.y ? [inside] : []),
    { x: laneX, y: g.entryY + 1 },
  ];
  return {
    id: m.id,
    kind: "guest",
    food: "🍲",
    outfit: "#a16b3f",
    hair: "#35271f",
    look: m.look,
    stops,
    // A lap starts at the door with a long pause there; start it after the pause so the first guest walks in `delay` seconds after opening.
    delay: m.delay - m.away,
  };
}

const CACHE = new Map<WalkStage, FloorActor[]>();

/** The first floor's guests on this stage's artwork: a food blogger on her own, a businessman and an affluent diner, a family of four. */
export function firstFloorGuests(stage: WalkStage = "humble"): FloorActor[] {
  const hit = CACHE.get(stage);
  if (hit) return hit;
  const seats = seatsFor(stage);
  const taken: number[] = [];
  const cast: FloorActor[] = [];
  // The solo guest and the couple first on the counter row (they arrive first), then the family.
  for (const party of [PARTIES[2]!, PARTIES[1]!, PARTIES[0]!]) {
    for (const m of party.members) {
      const seat = seats.get(m.id);
      if (seat) cast.push(actorOf(stage, m, seat, taken));
    }
  }
  CACHE.set(stage, cast);
  return cast;
}
