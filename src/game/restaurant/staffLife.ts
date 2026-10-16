/**
 * Staff life (developer 2026-10-16): the first floor's hired staff at work on
 * the restaurant map, like the Second Floor's floor life. Only the six roles
 * the game really has (business/businessStaff.ts BusinessStaffRole), and only
 * the ones the save has hired (`business.staff.hiredRoles`). There is no
 * separate toilet cleaner: the Cleaner looks after the restroom.
 *
 * The first-floor map is crowded, so every person keeps to a short loop inside
 * their own room, on floor measured on the art at 390 px on a 2 % grid:
 * cooks at the range and the counters, the Head Chef on the kitchen's right
 * aisle, the Server between the pass and the tables, the Cleaner in the
 * restroom, the Manager at the office desk. Pure, no money, no save.
 */
import type { BusinessStaffRole } from "../business/businessStaff";
import { FLOOR_LIFE_ALWAYS_PREVIEW, type FloorActor, type Stop } from "./floorLife";
import { SECOND_FLOOR_TEST_UNLOCK } from "./secondFloor";

export const STAFF_LIFE_ROLES: readonly BusinessStaffRole[] = [
  "line-cook",
  "prep-cook",
  "head-chef",
  "server",
  "cleaner",
  "manager",
];

type RolePlan = Omit<FloorActor, "id" | "delay"> & { delay: number };

const WHITES = "#f4efe6";

/** One loop per role, in first-floor map percent. */
export const STAFF_LIFE_PLANS: Readonly<Record<BusinessStaffRole, RolePlan>> = {
  // Kitchen: along the front of the range (stoves end at y 29.5 %).
  "line-cook": {
    kind: "cook",
    food: "🍳",
    outfit: WHITES,
    hair: "#35271f",
    stops: [
      { x: 20, y: 31.6, hold: 3, pose: "work" },
      { x: 30, y: 31.6, hold: 3, pose: "work" },
      { x: 39, y: 31.6, hold: 3, pose: "work" },
    ],
    delay: 0,
  },
  // Kitchen: the left aisle, beside the prep island and the counter below it.
  "prep-cook": {
    kind: "cook",
    food: "🥕",
    outfit: WHITES,
    hair: "#6b4a2e",
    stops: [
      { x: 16, y: 35.5, hold: 3.5, pose: "work" },
      { x: 16, y: 44, hold: 3.5, pose: "work" },
    ],
    delay: -2,
  },
  // Kitchen: the right aisle, checking plates at the pass end.
  "head-chef": {
    kind: "chef",
    food: "📋",
    outfit: WHITES,
    hair: "#2b211b",
    // Kept above y 42 %: lower down the aisle meets the pass shelving (developer 2026-10-16).
    stops: [
      { x: 43.6, y: 34, hold: 2.5, pose: "work" },
      { x: 43.6, y: 41.6, hold: 2.5, pose: "work" },
    ],
    delay: -4,
  },
  // Dining: picks plates up at the pass, carries them down the aisles to two tables.
  server: {
    kind: "server",
    food: "🍽️",
    outfit: "#7a2e2e",
    hair: "#473222",
    stops: [
      { x: 52, y: 54, hold: 2, pose: "pick" },
      { x: 49.6, y: 54 },
      { x: 49.6, y: 62.5 },
      { x: 53.5, y: 62.5, hold: 2.5, pose: "drop" },
      { x: 49.6, y: 62.5 },
      { x: 49.6, y: 54 },
      { x: 60, y: 54, hold: 2, pose: "pick" },
      { x: 64.1, y: 54 },
      { x: 64.1, y: 70 },
      { x: 67.5, y: 70, hold: 2.5, pose: "drop" },
      { x: 64.1, y: 70 },
      { x: 64.1, y: 54 },
    ],
    delay: -6,
  },
  // Restroom: wipes the basins and the stalls.
  cleaner: {
    kind: "cleaner",
    food: "🧽",
    outfit: "#5d8a8a",
    hair: "#493324",
    // Restroom floor only: the left strip and the floor below the stalls (the top of the
    // room is the wall and its sign; measured on a 1 % grid, developer 2026-10-16).
    stops: [
      { x: 82.8, y: 46.5, hold: 3, pose: "clean" },
      { x: 89.5, y: 49.8, hold: 3, pose: "clean" },
      { x: 86, y: 50.8, hold: 3, pose: "clean" },
    ],
    delay: -3,
  },
  // Office: sits in the chair behind the desk and works there (developer 2026-10-16:
  // "let the manager sit on the chair only").
  manager: {
    kind: "manager",
    food: "📋",
    outfit: "#2f3e4f",
    hair: "#35271f",
    stops: [{ x: 14, y: 63.8, hold: 12, pose: "sit" }],
    delay: -5,
  },
};

/**
 * The Take Away / Parcel counter's packer (developer 2026-10-16: "add a guy at
 * the pickup counter"). The game has no takeaway staff role, so this person
 * belongs to the counter itself and is shown only once Take Away is open. They
 * stand behind the counter and carry parcels from the shelves to the till.
 */
export const TAKEAWAY_PACKER: RolePlan = {
  kind: "packer",
  food: "📦",
  outfit: "#8a5a2b",
  hair: "#35271f",
  stops: [
    { x: 55.5, y: 42.4, hold: 2.5, pose: "pick" },
    { x: 67.5, y: 42.4, hold: 2.5, pose: "drop" },
  ],
  delay: -1,
};

/** The hired staff at work, in the order of STAFF_LIFE_ROLES; nobody unhired. */
export function staffCast(hiredRoles: readonly string[], takeawayOpen = false): FloorActor[] {
  const cast = STAFF_LIFE_ROLES.filter((role) => hiredRoles.includes(role)).map((role) => {
    const plan = STAFF_LIFE_PLANS[role];
    return { ...plan, id: `staff-${role}`, stops: plan.stops.map((s): Stop => ({ ...s })) };
  });
  if (takeawayOpen) {
    cast.push({
      ...TAKEAWAY_PACKER,
      id: "takeaway-packer",
      stops: TAKEAWAY_PACKER.stops.map((s) => ({ ...s })),
    });
  }
  return cast;
}

/**
 * Who the first-floor map shows: the hired roles, or — while the temporary
 * FLOOR_LIFE_ALWAYS_PREVIEW flag or the Second Floor test switch is on — all
 * six, so the developer can watch them (only the drawing; never the save).
 */
export function staffOnMap(
  hiredRoles: readonly string[],
  takeawayOpen = false,
): {
  roles: readonly string[];
  takeaway: boolean;
  preview: boolean;
} {
  const preview = FLOOR_LIFE_ALWAYS_PREVIEW || SECOND_FLOOR_TEST_UNLOCK;
  return {
    roles: preview ? STAFF_LIFE_ROLES : hiredRoles,
    takeaway: preview || takeawayOpen,
    preview,
  };
}
