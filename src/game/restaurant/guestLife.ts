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
import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";
import type { FloorActor, Stop } from "./floorLife";
import {
  STAGE_TABLES,
  blockedAt,
  canWalk,
  chairOf,
  counterSpot,
  walkPath,
  type Pt,
  type Slot,
  type StageTable,
} from "./guestWalk";

const door = (x: number, away: number): Stop => ({ x, y: 91, hold: away, pose: "away" });

/** The row the guests stand on to order (in front of the service counter). */
const COUNTER_Y = 56;
/** Just inside the street door. */
const INSIDE_Y = 80;

type Member = {
  id: string;
  look: string;
  /** Where this guest would like to stand at the counter (the nearest open spot is used). */
  wantX: number;
  /** The way in: the door x. */
  doorX: number;
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
      { id: "guest-family-1", look: "family-father", wantX: 42, doorX: 47, away: 34, delay: 14 },
      { id: "guest-family-2", look: "family-mother", wantX: 50, doorX: 49, away: 34, delay: 17.5 },
      { id: "guest-family-3", look: "family-child", wantX: 59, doorX: 51, away: 34, delay: 21 },
      { id: "guest-family-4", look: "elder-f2", wantX: 68, doorX: 53, away: 34, delay: 24.5 },
    ],
  },
  {
    slots: ["left", "right", "bottom", "top"],
    first: 1,
    members: [
      { id: "guest-couple-1", look: "businessman", wantX: 46, doorX: 48, away: 22, delay: 6 },
      { id: "guest-couple-2", look: "affluent-diner-f", wantX: 56, doorX: 52, away: 22, delay: 8 },
    ],
  },
  {
    slots: ["bottom", "top", "left", "right"],
    first: 2,
    members: [
      { id: "guest-solo", look: "food-blogger-f", wantX: 52, doorX: 50, away: 14, delay: 0 },
    ],
  },
];

type Seat = { table: StageTable; chair: Pt };

/** Every chair of the stage's tables that a guest can walk to from the door (a packed room leaves some tables out). */
function reachableChairs(stage: KitchenMapArtStage): Map<string, Seat | null> {
  const out = new Map<string, Seat | null>();
  const tables = STAGE_TABLES[stage];
  tables.forEach((t, ti) => {
    for (const slot of ["bottom", "left", "right", "top"] as const) {
      const chair = chairOf(t, slot);
      out.set(
        `${ti}:${slot}`,
        t.booth || blockedAt(stage, chair, t) || !canWalk(stage, { x: 50, y: INSIDE_Y }, chair, t)
          ? null
          : { table: t, chair },
      );
    }
  });
  return out;
}

/** The stage's seats given out: every member of every party gets their own chair (tables are tried from the party's own first one). */
function seatsFor(stage: KitchenMapArtStage): Map<string, Seat> {
  const chairs = reachableChairs(stage);
  const seated = STAGE_TABLES[stage].map((t, i) => ({ t, i })).filter((x) => !x.t.booth);
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

function actorOf(stage: KitchenMapArtStage, m: Member, seat: Seat, taken: number[]): FloorActor {
  const entry: Pt = { x: m.doorX, y: 87 };
  // A room packed to the counter may leave no way to it: that guest sits down without queueing.
  const counter = counterSpot(stage, m.wantX, COUNTER_Y, taken, entry);
  if (counter) taken.push(counter.x);
  const inside: Pt = { x: m.doorX, y: INSIDE_Y };
  const toCounter = counter ? (walkPath(stage, entry, counter) ?? [counter]) : [];
  const toChair = walkPath(stage, counter ?? entry, seat.chair, seat.table) ?? [seat.chair];
  const out = walkPath(stage, seat.chair, inside, seat.table) ?? [inside];
  const stops: Stop[] = [
    door(m.doorX, m.away),
    entry,
    ...(counter
      ? [...toCounter.slice(0, -1), { ...counter, hold: 2.6, pose: "pick" as const }]
      : []),
    ...toChair.slice(0, -1),
    { ...seat.chair, hold: 15, pose: "sit" },
    ...out,
    { x: m.doorX, y: 88 },
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

const CACHE = new Map<KitchenMapArtStage, FloorActor[]>();

/** The first floor's guests on this stage's artwork: a food blogger on her own, a businessman and an affluent diner, a family of four. */
export function firstFloorGuests(stage: KitchenMapArtStage = "humble"): FloorActor[] {
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
