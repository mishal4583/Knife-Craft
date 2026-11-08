/**
 * PEOPLE LOOKS (NPC realism, developer 2026-11-07: "the NPC assets are ready, start implementing it").
 * Who is who on the restaurant maps: every person is a painted character from `public/people/<id>/` (cut by
 * `scripts/make-npc-assets.py` from the generated sheets), with a gender, an age, a size and a walking pace. Pure and seeded:
 * no Math.random, nothing here reads or writes the save (the cast is decoration).
 *
 *  - STAFF keep the identity of their portrait (the person on the Staff card is the person on the map).
 *  - The 12 REGULARS (customerDefinitions.ts) always look like themselves; the extra members of a party and the walk-ins are the
 *    8 generic guests (and the regulars not on the floor), chosen by a fixed hash so the same order always gives the same person.
 *  - The SECOND-FLOOR CREW has four floor servers and four floor cleaners (two women, two men each), so a bigger crew is not clones.
 */
import { makeSeededRand } from "../business/businessDeterministicRandom";

export type Gender = "f" | "m";
export type Age = "child" | "adult" | "elder";
export type LookGroup = "staff" | "regular" | "guest" | "crew";

export type PeopleLook = {
  id: string;
  group: LookGroup;
  gender: Gender;
  age: Age;
  /** On-screen size next to an adult (the generated sheets draw every figure about as tall). */
  scale: number;
  /** Walking pace next to an adult (elders slower, the child quicker). */
  speed: number;
  /** The first-floor work poses (sheet B: six actions) exist. */
  work: boolean;
  /** Six expression busts exist (the 12 regulars, for the service card). */
  bust: boolean;
};

const SCALE: Record<Age, number> = { child: 0.74, adult: 1, elder: 0.96 };
const SPEED: Record<Age, number> = { child: 1.15, adult: 1, elder: 0.8 };

function look(
  id: string,
  group: LookGroup,
  gender: Gender,
  age: Age = "adult",
  extra: { work?: boolean; bust?: boolean } = {},
): PeopleLook {
  return {
    id,
    group,
    gender,
    age,
    scale: SCALE[age],
    speed: SPEED[age],
    work: extra.work ?? false,
    bust: extra.bust ?? false,
  };
}

export const PEOPLE_LOOKS: Readonly<Record<string, PeopleLook>> = Object.fromEntries(
  [
    // First-floor staff (their portraits: public/business/staff-portraits/).
    look("server", "staff", "f", "adult", { work: true }),
    look("cashier", "staff", "m", "adult", { work: true }),
    look("cleaner", "staff", "m", "adult", { work: true }),
    look("line-cook", "staff", "m", "adult", { work: true }),
    look("prep-cook", "staff", "f", "adult", { work: true }),
    look("head-chef", "staff", "m", "elder", { work: true }),
    look("manager", "staff", "f"),
    // The named regulars.
    look("mara", "regular", "f", "adult", { bust: true }),
    look("tobias", "regular", "m", "adult", { bust: true }),
    look("priya", "regular", "f", "adult", { bust: true }),
    look("oscar", "regular", "m", "elder", { bust: true }),
    look("lena", "regular", "f", "adult", { bust: true }),
    look("diego", "regular", "m", "adult", { bust: true }),
    look("yuki", "regular", "f", "adult", { bust: true }),
    look("amir", "regular", "m", "adult", { bust: true }),
    look("rosa", "regular", "f", "elder", { bust: true }),
    look("felix", "regular", "m", "adult", { bust: true }),
    look("sana", "regular", "f", "adult", { bust: true }),
    look("noah", "regular", "m", "child", { bust: true }),
    // Generic guests.
    look("office-f", "guest", "f"),
    look("office-m", "guest", "m"),
    look("student-f", "guest", "f"),
    look("student-m", "guest", "m"),
    look("tourist-f", "guest", "f"),
    look("tourist-m", "guest", "m"),
    look("sporty-m", "guest", "m"),
    look("elder-f2", "guest", "f", "elder"),
    // More customer variety (developer 2026-11-08): tourists, food bloggers, a businessman, an affluent diner and a family.
    look("international-tourist-f", "guest", "f"),
    look("international-tourist-m", "guest", "m"),
    look("food-blogger-f", "guest", "f"),
    look("food-blogger-m", "guest", "m"),
    look("businessman", "guest", "m"),
    look("affluent-diner-f", "guest", "f"),
    look("family-mother", "guest", "f"),
    look("family-father", "guest", "m"),
    look("family-child", "guest", "f", "child"),
    // The Second Floor's crew.
    look("floor-server-1", "crew", "m"),
    look("floor-server-2", "crew", "f"),
    look("floor-server-3", "crew", "f"),
    look("floor-server-4", "crew", "m"),
    look("floor-cleaner-1", "crew", "f"),
    look("floor-cleaner-2", "crew", "m"),
    look("floor-cleaner-3", "crew", "f"),
    look("floor-cleaner-4", "crew", "m"),
  ].map((l) => [l.id, l]),
);

export const REGULAR_LOOKS: readonly string[] = Object.values(PEOPLE_LOOKS)
  .filter((l) => l.group === "regular")
  .map((l) => l.id);
export const GUEST_LOOKS: readonly string[] = Object.values(PEOPLE_LOOKS)
  .filter((l) => l.group === "guest")
  .map((l) => l.id);
export const FLOOR_SERVER_LOOKS: readonly string[] = [1, 2, 3, 4].map((n) => `floor-server-${n}`);
export const FLOOR_CLEANER_LOOKS: readonly string[] = [1, 2, 3, 4].map((n) => `floor-cleaner-${n}`);

/** The look of each first-floor staff role (BusinessStaffRole); the Old Chef is the head chef's. */
export const STAFF_LOOK: Readonly<Record<string, string>> = {
  server: "server",
  cashier: "cashier",
  cleaner: "cleaner",
  "line-cook": "line-cook",
  "prep-cook": "prep-cook",
  "head-chef": "head-chef",
  manager: "manager",
  "old-chef": "head-chef",
};

/** Every look's folder under `public/people/`. */
export const PEOPLE_SHEETS = {
  /** 6 columns x 4 rows of 160 px cells. */
  a: { cols: 6, rows: 4, cell: 160 },
  /** 6 work poses in one row. */
  b: { cols: 6, rows: 1, cell: 160 },
  /** 3 x 2 busts of 192 px. */
  bust: { cols: 3, rows: 2, cell: 192 },
} as const;

export const peopleUrl = (id: string, sheet: "a" | "b" | "bust", base = "/") =>
  `${base}people/${id}/${sheet}.webp`;

/** The row of sheet A (0 front, 1 back, 2 side facing right, 3 guest actions / carrying) and the cells in it. */
export const CELL = {
  walk: [0, 1, 2, 3],
  idle: 4,
  seated: 5,
  // Row 3 for guests (menu, raise hand, eating, drinking, delighted, annoyed).
  menu: 0,
  hand: 1,
  eating: 2,
  drinking: 3,
  delighted: 4,
  annoyed: 5,
  // Row 3 for staff and the crew (side walk carrying x4, idle carrying front, idle carrying side).
  carryIdle: 4,
} as const;

/** Sheet B (first-floor work poses): which cells a role works in (a loop of what the person really does there). */
export const WORK_CELLS: Readonly<Record<string, readonly number[]>> = {
  // line cook: stir, flip, chop, garnish, taste, wipe brow
  "line-cook": [0, 1, 2, 3, 4],
  // prep cook: chop, peel, wash, carry a crate, dice, wrap
  "prep-cook": [0, 1, 2, 4, 5],
  // head chef: taste, direct, inspect, stir, proud, wave
  "head-chef": [0, 2, 3, 1],
  // server: take an order, place a plate, clear a plate, greet, call, bow
  server: [1, 4],
  // cashier: type, hand a bag, count banknotes, scan, greet, thumbs up
  cashier: [0, 2, 3, 1],
  // cleaner: mop front, mop side, wipe a table, spray, carry a bucket, polish a rail
  cleaner: [0, 1, 2, 3, 5],
};

/** Hash of a string (FNV-1a), stable between runs. */
export function hashOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The look of a customer: a regular is always themselves; anyone else (a party's extra members, a walk-in) is one of the
 * generic guests or a regular who is not on the floor, fixed by the id.
 */
export function guestLookFor(customerId: string): string {
  if (PEOPLE_LOOKS[customerId]?.group === "regular") return customerId;
  const pool = [...GUEST_LOOKS, ...REGULAR_LOOKS];
  return pool[hashOf(customerId) % pool.length]!;
}

/**
 * `count` looks from `pool`, seeded: no two neighbours share a look, and nobody repeats until the pool is used up (so a crowd of
 * eight shows eight different people). Both genders appear whenever the pool has both.
 */
export function pickLooks(seed: number, count: number, pool: readonly string[]): string[] {
  if (count <= 0 || pool.length === 0) return [];
  const rand = makeSeededRand(seed >>> 0);
  const out: string[] = [];
  let bag: string[] = [];
  for (let i = 0; i < count; i++) {
    if (bag.length === 0) {
      bag = [...pool];
      // A seeded shuffle.
      for (let k = bag.length - 1; k > 0; k--) {
        const j = Math.floor(rand() * (k + 1));
        [bag[k], bag[j]] = [bag[j]!, bag[k]!];
      }
      // The first of a new bag never repeats the last person shown.
      if (out.length > 0 && bag[0] === out[out.length - 1] && bag.length > 1) {
        [bag[0], bag[1]] = [bag[1]!, bag[0]!];
      }
    }
    out.push(bag.shift()!);
  }
  return out;
}

/** A regular's face on an order card (public/people/<id>/bust.webp: six expressions of the same person, in this order). */
export type Expression = "neutral" | "pleased" | "delighted" | "impatient" | "annoyed" | "enjoying";

/** The expression for the customer's reaction to a dish (ServiceOrderComplete's `reaction`: "cheer", "nod" or none). */
export const expressionFor = (reaction: string | null | undefined): Expression =>
  reaction === "cheer" ? "delighted" : reaction === "nod" ? "pleased" : "neutral";
