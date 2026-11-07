/**
 * The first floor's walking guests (NPC realism, developer 2026-11-07). They used to be three CSS-keyframe parties of identical puppets
 * that never turned to face where they walked; now they are ordinary map actors (`FloorActor`, the same engine as the Second Floor and
 * the staff): painted people with a facing, a pace of their own, a place of their own at the counter and a chair of their own.
 *
 * The routes are the old parties' (map percent of the first-floor art, the same on every stage): in through the door, up the aisle to the
 * counter to order, to the table, a long sit, and out. A party never walks on top of itself: each member has their own counter spot
 * and chair, and the party's members start a few seconds apart. Pure; seeded by nothing (the cast is fixed); never touches the save.
 */
import type { FloorActor, Stop } from "./floorLife";

const door = (x: number, away: number): Stop => ({ x, y: 91, hold: away, pose: "away" });

type Member = {
  id: string;
  look: string;
  /** Where the guest stands at the counter to order, and what they pass through to get there. */
  counter: { x: number; y: number };
  /** The way from the aisle to the counter spot. */
  toCounter: [number, number][];
  /** From the counter to the chair, ending on it. */
  toChair: [number, number][];
  /** The way back out, ending at the door's x. */
  out: [number, number][];
  /** Seconds after the map opens until this guest steps through the door (the party's start + the member's stagger). */
  delay: number;
  /** The way in: the door x. */
  doorX: number;
  /** Seconds at the door between laps (keeps the room from being a crowd). */
  away: number;
};

const SOLO: Member = {
  id: "guest-solo",
  look: "office-f",
  doorX: 50,
  away: 14,
  counter: { x: 52, y: 56 },
  toCounter: [
    [50, 87],
    [50, 72],
    [51, 61],
  ],
  toChair: [
    [43, 56],
    [43, 59],
    [43, 65.2],
  ],
  out: [
    [43, 58],
    [50, 58],
    [50, 76],
  ],
  delay: 0,
};

const COUPLE: Member[] = [
  {
    id: "guest-couple-1",
    look: "tourist-m",
    doorX: 48,
    away: 22,
    counter: { x: 46, y: 56 },
    toCounter: [
      [48, 87],
      [48, 72],
      [47, 61],
    ],
    toChair: [
      [52, 56],
      [64, 56],
      [70, 60],
      [70, 65],
    ],
    out: [
      [66, 70],
      [59, 76],
      [54, 82],
    ],
    delay: 6,
  },
  {
    id: "guest-couple-2",
    look: "tourist-f",
    doorX: 52,
    away: 22,
    counter: { x: 56, y: 56 },
    toCounter: [
      [52, 87],
      [52, 72],
      [55, 61],
    ],
    toChair: [
      [62, 56],
      [70, 56],
      [76.5, 63],
      [76.5, 68.5],
    ],
    out: [
      [72, 73],
      [62, 79],
      [56, 85],
    ],
    delay: 8,
  },
];

const FRIENDS: Member[] = [
  {
    id: "guest-friends-1",
    look: "student-m",
    doorX: 47,
    away: 34,
    counter: { x: 42, y: 56 },
    toCounter: [
      [50, 87],
      [50, 82],
      [50, 78],
      [45, 65],
    ],
    toChair: [
      [40, 60],
      [37, 68.5],
    ],
    out: [
      [36, 61],
      [47, 76],
    ],
    delay: 14,
  },
  {
    id: "guest-friends-2",
    look: "student-f",
    doorX: 49,
    away: 34,
    counter: { x: 50, y: 56 },
    toCounter: [
      [50, 87],
      [50, 82],
      [50, 78],
      [48, 65],
    ],
    toChair: [
      [47, 60],
      [43, 65.2],
    ],
    out: [
      [43, 60],
      [49, 76],
    ],
    delay: 17.5,
  },
  {
    id: "guest-friends-3",
    look: "sporty-m",
    doorX: 51,
    away: 34,
    counter: { x: 59, y: 56 },
    toCounter: [
      [50, 87],
      [50, 82],
      [50, 78],
      [52, 65],
    ],
    toChair: [
      [54, 61],
      [49, 68.5],
    ],
    out: [
      [50, 61],
      [51, 76],
    ],
    delay: 21,
  },
  {
    id: "guest-friends-4",
    look: "elder-f2",
    doorX: 53,
    away: 34,
    counter: { x: 68, y: 56 },
    toCounter: [
      [50, 87],
      [50, 82],
      [50, 78],
      [56, 65],
    ],
    toChair: [
      [70, 61],
      [70, 66],
      [60, 72],
      [45, 73],
      [43, 72.5],
    ],
    out: [
      [57, 64],
      [53, 76],
    ],
    delay: 24.5,
  },
];

function actorOf(m: Member): FloorActor {
  const stops: Stop[] = [
    door(m.doorX, m.away),
    ...m.toCounter.map(([x, y]) => ({ x, y })),
    { ...m.counter, hold: 2.6, pose: "pick" },
    ...m.toChair.slice(0, -1).map(([x, y]) => ({ x, y })),
    {
      x: m.toChair[m.toChair.length - 1]![0],
      y: m.toChair[m.toChair.length - 1]![1],
      hold: 15,
      pose: "sit",
    },
    ...m.out.map(([x, y]) => ({ x, y })),
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

/** The first floor's guests: one on their own, a couple and four friends. Fixed (the same every time the map opens). */
export function firstFloorGuests(): FloorActor[] {
  return [actorOf(SOLO), ...COUPLE.map(actorOf), ...FRIENDS.map(actorOf)];
}
