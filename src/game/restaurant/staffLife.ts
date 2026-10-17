/**
 * Staff life (developer 2026-10-16): the first floor's hired staff at work on
 * the restaurant map, like the Second Floor's floor life. Only the six roles
 * the game really has (business/businessStaff.ts BusinessStaffRole), and only
 * the ones the save has hired (`business.staff.hiredRoles`) and that have work
 * (developer 2026-10-16: "visible only when hired and when necessary"). There
 * is no separate toilet cleaner: the Cleaner looks after the restroom, and is
 * there only while a real restroom job is open (see `cleanerRestroomJob`).
 * The Old Chef — who greets the player in the intro — is always in the kitchen.
 *
 * The first-floor map has SIX artworks, one per kitchen stage
 * (kitchen/kitchenMapArt.ts: humble → grand), and the kitchen, the service
 * counter and the dining tables are drawn differently on each. So every spot
 * here is measured per stage, on a 1–2 % grid over that stage's art, keeping
 * half a person's width (≈ 2.5 %) clear of walls, shelves and counters. Each
 * person keeps to a short loop in their own room. Pure, no money, no save.
 */
import type { BusinessStaffRole } from "../business/businessStaff";
import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";
import { TASK_RULES, type TaskKind } from "./cleanliness";
import { FLOOR_LIFE_ALWAYS_PREVIEW, type FloorActor, type Stop } from "./floorLife";

export const STAFF_LIFE_ROLES: readonly BusinessStaffRole[] = [
  "line-cook",
  "prep-cook",
  "head-chef",
  "server",
  "cleaner",
  "manager",
];

export const MAP_STAGES: readonly KitchenMapArtStage[] = [
  "humble",
  "growing",
  "established",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand",
];

/** What each stage's art needs measured (map percent, feet position). */
type StageSpots = {
  /** In front of the range: y and three x positions along it. */
  range: { y: number; xs: [number, number, number] };
  /** The prep aisle beside the island: x and two y positions. */
  prepAisle: { x: number; ys: [number, number] };
  /** The Head Chef's aisle on the island's other side: x and two y positions. */
  chefAisle: { x: number; ys: [number, number] };
  /** The service counter: its computer's x, and the dining floor just in front of it. */
  counter: { computerX: number; frontY: number };
  /** Two spots beside dining tables where the Server puts plates down. */
  tables: [{ x: number; y: number }, { x: number; y: number }];
  /** The chair behind the office desk (where the Manager sits). */
  managerSeat: { x: number; y: number };
};

/** Measured on each stage's art (developer feedback 2026-10-16: nobody on shelves or walls). */
export const STAGE_SPOTS: Readonly<Record<KitchenMapArtStage, StageSpots>> = {
  humble: {
    range: { y: 30.4, xs: [18, 27, 36.5] },
    prepAisle: { x: 18.8, ys: [34, 42] },
    chefAisle: { x: 36.8, ys: [33.5, 42] },
    counter: { computerX: 37.2, frontY: 55.6 },
    tables: [
      { x: 46.6, y: 66.5 },
      { x: 65.4, y: 66.5 },
    ],
    managerSeat: { x: 14, y: 63.6 },
  },
  growing: {
    range: { y: 31, xs: [18, 29.5, 39.5] },
    prepAisle: { x: 18.8, ys: [36, 43] },
    chefAisle: { x: 39.6, ys: [35, 43] },
    counter: { computerX: 37.6, frontY: 55.3 },
    tables: [
      { x: 50, y: 60.5 },
      { x: 61.8, y: 70.6 },
    ],
    managerSeat: { x: 13.9, y: 63.6 },
  },
  established: {
    range: { y: 31.2, xs: [17.5, 27, 37.5] },
    prepAisle: { x: 17.2, ys: [36, 44] },
    chefAisle: { x: 37.6, ys: [35, 44] },
    counter: { computerX: 37, frontY: 55.3 },
    tables: [
      { x: 49.2, y: 60 },
      { x: 63.4, y: 70.1 },
    ],
    managerSeat: { x: 14, y: 63.7 },
  },
  "neighborhood-cafe": {
    range: { y: 33, xs: [21, 31, 40] },
    prepAisle: { x: 17.4, ys: [37, 45] },
    chefAisle: { x: 43.8, ys: [36, 45] },
    counter: { computerX: 36.8, frontY: 55.6 },
    tables: [
      { x: 48.6, y: 61 },
      { x: 62.8, y: 61 },
    ],
    managerSeat: { x: 14, y: 63.6 },
  },
  "flourishing-cafe": {
    range: { y: 31.6, xs: [21, 30, 38] },
    prepAisle: { x: 16, ys: [35, 46] },
    chefAisle: { x: 38.3, ys: [35, 41] },
    counter: { computerX: 38.9, frontY: 56.8 },
    tables: [
      { x: 49.5, y: 59.4 },
      { x: 62, y: 69.3 },
    ],
    managerSeat: { x: 13.5, y: 62.7 },
  },
  grand: {
    range: { y: 31.6, xs: [20, 30, 39] },
    prepAisle: { x: 16, ys: [35.5, 44] },
    chefAisle: { x: 43.4, ys: [34, 41.6] },
    counter: { computerX: 37.6, frontY: 55.3 },
    tables: [
      { x: 53.5, y: 62.5 },
      { x: 67.5, y: 70 },
    ],
    managerSeat: { x: 14, y: 63.8 },
  },
};

/**
 * The restroom is the same on every stage: the open tiled floor in front of the
 * stalls (x 84–91 %, y 45–51 %). The strip by its left wall is narrower than a
 * person, so the body overlapped the wall there (developer 2026-10-16).
 */
export const RESTROOM_STOPS: readonly Stop[] = [
  { x: 87.6, y: 50.2, hold: 3, pose: "clean" },
  { x: 89.6, y: 48.6, hold: 3, pose: "clean" },
  { x: 86.4, y: 48.2, hold: 3, pose: "clean" },
];

/** Where the Cleaner works on each restroom job: by the stalls, the basins, or the floor. */
export function restroomSpot(job: TaskKind): Stop {
  const [floor, stalls, basins] = RESTROOM_STOPS;
  const at = /toilet|disinfect|deep/.test(job)
    ? stalls!
    : /sink|paper|refresh|check/.test(job)
      ? basins!
      : floor!;
  return { ...at, hold: CLEANING_SECONDS, pose: "clean" };
}

/** How long the Cleaner is seen at one job before it is really done (cleanTask). */
export const CLEANING_SECONDS = 5;

const WHITES = "#f4efe6";
type Look = Pick<FloorActor, "kind" | "food" | "outfit" | "hair"> & { delay: number };

/** The Old Chef: the kitchen's own chef from the start (not a hire), always at the range. */
const OLD_CHEF: Look = { kind: "chef", food: "🍲", outfit: WHITES, hair: "#9a9a9a", delay: -1.5 };

const LOOKS: Readonly<Record<BusinessStaffRole, Look>> = {
  "line-cook": { kind: "cook", food: "🍳", outfit: WHITES, hair: "#35271f", delay: 0 },
  "prep-cook": { kind: "cook", food: "🥕", outfit: WHITES, hair: "#6b4a2e", delay: -2 },
  "head-chef": { kind: "chef", food: "📋", outfit: WHITES, hair: "#2b211b", delay: -4 },
  server: { kind: "server", food: "🍽️", outfit: "#7a2e2e", hair: "#473222", delay: -6 },
  cleaner: { kind: "cleaner", food: "🧽", outfit: "#5d8a8a", hair: "#493324", delay: -3 },
  manager: { kind: "manager", food: "📋", outfit: "#2f3e4f", hair: "#35271f", delay: -5 },
};

/** Each role's loop on one stage's art. */
export function roleStops(role: BusinessStaffRole, stage: KitchenMapArtStage): Stop[] {
  const s = STAGE_SPOTS[stage];
  switch (role) {
    case "line-cook":
      // The range's right half (the Old Chef works the left half).
      return [s.range.xs[1] + 1.5, s.range.xs[2]].map((x) => ({
        x,
        y: s.range.y,
        hold: 3,
        pose: "work",
      }));
    case "prep-cook":
      return s.prepAisle.ys.map((y) => ({ x: s.prepAisle.x, y, hold: 3.5, pose: "work" }));
    case "head-chef":
      return s.chefAisle.ys.map((y) => ({ x: s.chefAisle.x, y, hold: 2.5, pose: "work" }));
    case "server": {
      // Picks up at the counter front (right of the computer), walks to a table, and back.
      const pickA = { x: s.counter.computerX + 14, y: s.counter.frontY };
      const pickB = { x: s.counter.computerX + 22, y: s.counter.frontY };
      return [
        { ...pickA, hold: 2, pose: "pick" },
        { ...s.tables[0], hold: 2.5, pose: "drop" },
        { ...pickB, hold: 2, pose: "pick" },
        { ...s.tables[1], hold: 2.5, pose: "drop" },
      ];
    }
    case "cleaner":
      // Only drawn with a real job (staffCast); this is the floor spot as a fallback.
      return [{ ...RESTROOM_STOPS[0]!, hold: CLEANING_SECONDS, pose: "clean" }];
    case "manager":
      // Sits in the chair behind the desk only (developer 2026-10-16).
      return [{ ...s.managerSeat, hold: 12, pose: "sit" }];
  }
}

/**
 * The service counter's cashier (developer 2026-10-16: "a person on the service
 * counter working on the computer, not inside Take Away / Parcel"). The game
 * has no cashier role, so this person belongs to the counter and is shown once
 * the service counter is open. They stand at the counter, at its computer.
 */
export function cashierStops(stage: KitchenMapArtStage): Stop[] {
  const c = STAGE_SPOTS[stage].counter;
  return [
    { x: c.computerX, y: c.frontY, hold: 7, pose: "work" },
    { x: c.computerX + 3, y: c.frontY, hold: 2 },
  ];
}

export type StaffLifeContext = {
  stage: KitchenMapArtStage;
  /** The dining room is open (the Server has tables to serve). */
  diningOpen: boolean;
  /** The service counter is open (its cashier works there with a Server on the team). */
  serviceOpen: boolean;
  /** The restroom job a hired Cleaner can do now (`cleanerRestroomJob`), or null. */
  cleanerJob: TaskKind | null;
  /** A Cleaner hired for today only (cleanliness.dayCleanerToday) walks the map too. */
  cleanerToday?: boolean;
};

const NO_WORK: StaffLifeContext = {
  stage: "humble",
  diningOpen: true,
  serviceOpen: true,
  cleanerJob: null,
};

/**
 * Who is at work: the Old Chef always; each hired role only when it has work —
 * the Server (and the counter's cashier with them) when the dining room / the
 * counter is open, the Cleaner only while a real restroom job is open.
 */
export function staffCast(
  hiredRoles: readonly string[],
  context: Partial<StaffLifeContext> = {},
): FloorActor[] {
  const c = { ...NO_WORK, ...context };
  const cast: FloorActor[] = [
    {
      ...OLD_CHEF,
      id: "old-chef",
      stops: [STAGE_SPOTS[c.stage].range.xs[0], STAGE_SPOTS[c.stage].range.xs[1]].map((x) => ({
        x,
        y: STAGE_SPOTS[c.stage].range.y,
        hold: 3.5,
        pose: "work",
      })),
    },
  ];
  for (const role of STAFF_LIFE_ROLES) {
    // The Cleaner: hired, or hired for today (`cleanerToday`, cleanliness.dayCleanerToday).
    if (!hiredRoles.includes(role) && !(role === "cleaner" && c.cleanerToday)) continue;
    if (role === "server" && !c.diningOpen) continue;
    if (role === "cleaner") {
      if (!c.cleanerJob) continue;
      cast.push({
        ...LOOKS.cleaner,
        food: TASK_RULES[c.cleanerJob].icon,
        id: `staff-cleaner-${c.cleanerJob}`,
        stops: [restroomSpot(c.cleanerJob)],
        delay: 0,
      });
      continue;
    }
    cast.push({ ...LOOKS[role], id: `staff-${role}`, stops: roleStops(role, c.stage) });
  }
  if (c.serviceOpen && hiredRoles.includes("server")) {
    cast.push({
      id: "service-cashier",
      kind: "cashier",
      food: "🧾",
      outfit: "#3f5f8a",
      hair: "#35271f",
      stops: cashierStops(c.stage),
      delay: -1,
    });
  }
  return cast;
}

/**
 * Who the first-floor map shows: the save's hired roles with their work, or —
 * while the temporary FLOOR_LIFE_ALWAYS_PREVIEW flag is on — all six with
 * work, so the developer can watch them (only the drawing; never the save).
 */
export function staffOnMap(
  hiredRoles: readonly string[],
  context: StaffLifeContext,
): { roles: readonly string[]; context: StaffLifeContext; preview: boolean } {
  const preview = FLOOR_LIFE_ALWAYS_PREVIEW;
  return {
    roles: preview ? STAFF_LIFE_ROLES : hiredRoles,
    context: preview
      ? {
          ...context,
          diningOpen: true,
          serviceOpen: true,
          cleanerJob: context.cleanerJob ?? "toilet",
        }
      : context,
    preview,
  };
}
