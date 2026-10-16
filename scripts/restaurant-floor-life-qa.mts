/**
 * FLOOR LIFE QA — the Second Floor's idle animation (developer 2026-10-16;
 * src/game/restaurant/floorLife.ts, components/kc/restaurantMap/FloorLife.tsx).
 *
 *  Q  Quiet: no stations, or no Floor Server, means no people.
 *  C  Cast: one server per 2 working stations (never more than hired), two
 *     guests per working station (at most MAX_GUESTS, each in a seat of their
 *     own), cleaners only as hired; servers only visit the stations they run.
 *  R  Routes: every stop on the map (0–100); servers pick up at a station and
 *     drop at the counter; guests pick up at the counter, sit, and leave by
 *     the door; the keyframes run 0 → 100 in order.
 *  S  Seats: guests sit on the measured chairs; cleaners wipe from the table
 *     sides, never on a chair; guests at the counter don't stand on each other.
 *  F  First-floor staff: only the six roles the game has, only the hired ones
 *     (all six as the testing preview), each in its own room.
 *  G  Placement on each of the six kitchen-stage maps: Head Chef off the pass
 *     shelving, Cleaner on the restroom floor, Manager only sits, the service
 *     counter's cashier at its computer, plates held in the hand.
 *  H  Only when hired and needed: the testing preview is off; the Old Chef is
 *     always in the kitchen; the Server with the dining room open (and the
 *     counter's cashier with them); the Cleaner only while a real restroom job
 *     is open, and that job is really cleaned (cleanTask by the Cleaner).
 *  D  Deterministic: the same floor gives the same cast; no Math.random.
 *  V  View (the full preview cast under the test switch or the temporary
 *     FLOOR_LIFE_ALWAYS_PREVIEW flag, developer 2026-10-16): decorative (aria-hidden, no taps), transform/opacity only, off
 *     with the game's Reduced Motion setting, no animation library, never touches money or saves.
 *
 * Run: npx tsx scripts/restaurant-floor-life-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  FLOOR_SPOTS,
  FLOOR_LIFE_ALWAYS_PREVIEW,
  FLOOR_LIFE_PREVIEW,
  MAX_GUESTS,
  floorCast,
  timeline,
  workingStations,
} from "../src/game/restaurant/floorLife.ts";
import type { SecondFloorState, StationId } from "../src/game/restaurant/secondFloor.ts";
import {
  CLEANING_SECONDS,
  MAP_STAGES,
  STAFF_LIFE_ROLES,
  staffCast,
  staffOnMap,
} from "../src/game/restaurant/staffLife.ts";
import {
  cleanTask,
  cleanerRestroomJob,
  cleanlinessOf,
} from "../src/game/restaurant/cleanliness.ts";
import { DEFAULT_SAVE } from "../src/game/SaveManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const floorOf = (ids: StationId[], servers = 0, cleaners = 0): SecondFloorState => ({
  stations: Object.fromEntries(ids.map((id) => [id, { level: 1, lastCollectAt: 0 }])),
  servers,
  cleaners,
});
const ALL: StationId[] = ["coffee", "drinks", "pizza", "burger", "iceCream", "hotFood"];
const count = (c: ReturnType<typeof floorCast>, k: string) => c.filter((a) => a.kind === k).length;

console.log("Q. Quiet floor");
assert(floorCast(floorOf([])).length === 0, "Q1: an empty floor has nobody on it");
assert(
  floorCast(floorOf(["coffee", "drinks"], 0, 1)).length === 0,
  "Q2: stations without a Floor Server make no food, so nobody comes (cleaners included)",
);

console.log("C. Cast");
{
  const one = floorCast(floorOf(["coffee"], 1, 0));
  assert(
    count(one, "server") === 1 && count(one, "guest") === 2 && count(one, "cleaner") === 0,
    "C1: one staffed station → one server, two guests, no cleaner",
  );
  const full = floorCast(floorOf(ALL, 3, 2));
  assert(
    count(full, "server") === 3 &&
      count(full, "guest") === MAX_GUESTS &&
      count(full, "cleaner") === 2,
    `C2: a full floor (6 stations, 3 servers, 2 cleaners) → 3 servers, ${MAX_GUESTS} guests, 2 cleaners`,
  );
  const short = floorOf(ALL, 1, 0);
  const shortCast = floorCast(short);
  assert(
    workingStations(short).join() === "coffee,drinks" &&
      count(shortCast, "server") === 1 &&
      count(shortCast, "guest") === 4,
    "C3: one server runs 2 of 6 stations → only those two work (2 × 2 guests)",
  );
  const seats = full
    .filter((a) => a.kind === "guest")
    .map((a) => a.stops.find((s) => s.pose === "sit"));
  assert(
    seats.every(Boolean) &&
      new Set(seats.map((s) => `${s!.x},${s!.y}`)).size === seats.length &&
      FLOOR_SPOTS.seats.length >= MAX_GUESTS,
    "C4: every guest has a seat of their own",
  );
  // A server picks up only at the stations it runs.
  const s0 = full.find((a) => a.id === "server-0")!;
  const picks = s0.stops.filter((s) => s.pose === "pick").length;
  assert(
    picks === 2 && s0.food === "☕",
    "C5: the first server serves its own two stations (coffee first)",
  );
}

console.log("R. Routes");
{
  const full = floorCast(floorOf(ALL, 3, 2));
  const onMap = full.every((a) =>
    a.stops.every((s) => s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100),
  );
  assert(onMap, "R1: every stop is on the map");
  const server = full.find((a) => a.kind === "server")!;
  const guest = full.find((a) => a.kind === "guest")!;
  const poses = (a: (typeof full)[number]) =>
    a.stops
      .filter((s) => s.pose)
      .map((s) => s.pose)
      .join(">");
  assert(
    poses(server) === "pick>drop>pick>drop" &&
      server.stops
        .filter((s) => s.pose === "drop")
        .every((s) => s.x === FLOOR_SPOTS.counterBack.x && s.y === FLOOR_SPOTS.counterBack.y),
    "R2: a server picks food up at a machine and puts it down at the Pickup Counter",
  );
  assert(
    poses(guest) === "pick>sit>away" &&
      Math.abs(guest.stops.find((s) => s.pose === "pick")!.x - FLOOR_SPOTS.counterFront.x) <= 6.4 &&
      guest.stops.find((s) => s.pose === "pick")!.y === FLOOR_SPOTS.counterFront.y &&
      guest.stops[0]!.x === FLOOR_SPOTS.door.x &&
      guest.stops.at(-1)!.y === FLOOR_SPOTS.door.y,
    "R3: a guest comes in the door, picks the food up at the counter, sits, and leaves by the door",
  );
  const lines = full.map((a) => timeline(a.stops));
  assert(
    lines.every(
      (l) =>
        l.seconds > 5 &&
        l.frames[0]!.at === 0 &&
        l.frames.at(-1)!.at === 100 &&
        l.frames.every((f, i, fs) => i === 0 || f.at >= fs[i - 1]!.at),
    ),
    "R4: every lap runs 0 → 100 % in order and lasts more than 5 s",
  );
}

console.log("S. Seats (developer 2026-10-16: sit on the chairs, never two on one)");
{
  const full = floorCast(floorOf(ALL, 3, 2));
  const sits = full
    .filter((a) => a.kind === "guest")
    .map((a) => a.stops.find((s) => s.pose === "sit")!);
  const seatSet = new Set(FLOOR_SPOTS.seats.map((s) => `${s.x},${s.y}`));
  assert(
    sits.every((s) => seatSet.has(`${s.x},${s.y}`)),
    "S1: every guest sits on one of the measured chairs",
  );
  const cleans = full
    .filter((a) => a.kind === "cleaner")
    .flatMap((a) => a.stops.filter((s) => s.pose === "clean"));
  const far = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) >= 4;
  assert(
    cleans.length === FLOOR_SPOTS.tableSides.length &&
      cleans.every((c) => FLOOR_SPOTS.seats.every((seat) => far(c, seat))),
    "S2: cleaners wipe every table from its open side, never standing on a chair",
  );
  const counter = full
    .filter((a) => a.kind === "guest")
    .map((a) => a.stops.find((s) => s.pose === "pick")!.x);
  assert(
    new Set(counter.slice(0, 5)).size === 5,
    "S3: guests waiting together at the counter each have a place of their own",
  );
}

console.log("F. First-floor staff (developer 2026-10-16)");
const WORK = { stage: "grand", diningOpen: true, serviceOpen: true, cleanerJob: "toilet" } as const;
{
  const roleSrc = read("src/game/business/businessStaff.ts");
  const roles =
    (roleSrc.match(/export type BusinessStaffRole =([^;]+);/)?.[1] ?? "")
      .match(/"[a-z-]+"/g)
      ?.map((r) => r.slice(1, -1)) ?? [];
  assert(
    roles.length === 6 && [...STAFF_LIFE_ROLES].sort().join() === [...roles].sort().join(),
    "F1: exactly the six roles the game has (BusinessStaffRole) — no invented role (the Cleaner looks after the restroom)",
    roles,
  );
  const ids = (cast: ReturnType<typeof staffCast>) => cast.map((a) => a.id).join();
  assert(
    ids(staffCast([], WORK)) === "old-chef" &&
      ids(staffCast(["manager", "not-a-role"], WORK)) === "old-chef,staff-manager",
    "F2: with nobody hired only the Old Chef (from the intro) is in the kitchen; unknown roles are ignored",
  );
  const rooms: Record<string, { x: number; y: number; w: number; h: number }> = {
    kitchen: { x: 3.8, y: 18, w: 44, h: 32 },
    restroom: { x: 80, y: 33, w: 17.2, h: 18 },
    office: { x: 3.8, y: 53.4, w: 26.2, h: 24 },
    dining: { x: 30.5, y: 48.2, w: 67, h: 31 },
  };
  const roomOf = (id: string) =>
    /chef|cook/.test(id)
      ? "kitchen"
      : /cleaner/.test(id)
        ? "restroom"
        : /manager/.test(id)
          ? "office"
          : "dining";
  const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
    p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const stray = MAP_STAGES.flatMap((stage) =>
    staffCast(STAFF_LIFE_ROLES, { ...WORK, stage }).flatMap((a) =>
      a.stops
        .filter((p) => !inside(p, rooms[roomOf(a.id)]!))
        .map((p) => `${stage}:${a.id}@${p.x},${p.y}`),
    ),
  );
  assert(stray.length === 0, "F3: on every kitchen stage everyone keeps to their own room", stray);
  const map = read("src/components/kc/restaurantMap/RestaurantMapView.tsx");
  const router = read("src/ScreensRouter.tsx");
  assert(
    /<StaffLife hiredRoles=\{staffOnMap\.roles\}/.test(map) &&
      /staffOnMap=\{staffOnMap\(save\.business\.staff\.hiredRoles,/.test(router) &&
      /kitchenMapArtStage\(save\.equippedKitchenUpgradeId\)/.test(router) &&
      /cleanerJob: cleanerRestroomJob\(save\)/.test(router),
    "F4: the map draws the save's hired roles on the shown kitchen stage, with the Cleaner's real restroom job",
  );
}

console.log("G. First-floor placement, per kitchen stage (developer 2026-10-16)");
{
  const kitchen = { x: 3.8, y: 18, w: 44, h: 32 };
  const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
    p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const problems: string[] = [];
  for (const stage of MAP_STAGES) {
    const byId = Object.fromEntries(
      staffCast(STAFF_LIFE_ROLES, { ...WORK, stage }).map((a) => [a.id, a]),
    );
    if (!byId["staff-head-chef"]!.stops.every((p) => p.y <= 45.5 && inside(p, kitchen)))
      problems.push(`${stage}: chef off the kitchen aisle`);
    const old = byId["old-chef"]!.stops.map((p) => p.x);
    const line = byId["staff-line-cook"]!.stops.map((p) => p.x);
    if (Math.max(...old) + 1 > Math.min(...line))
      problems.push(`${stage}: Old Chef and Line Cook overlap at the range`);
    const m = byId["staff-manager"]!.stops;
    if (!(m.length === 1 && m[0]!.pose === "sit")) problems.push(`${stage}: manager not seated`);
    if (
      !byId["service-cashier"]!.stops.every(
        (p) => p.x >= 30.5 && p.x <= 45 && p.y >= 54 && p.y <= 58,
      )
    )
      problems.push(`${stage}: cashier not at the service counter`);
  }
  assert(
    MAP_STAGES.length === 6 && problems.length === 0,
    "G1: on all six stages: Head Chef on the kitchen aisle, the Old Chef and the Line Cook each on their half of the range, Manager seated, cashier at the counter",
    problems,
  );
  const css = read("src/components/kc/restaurantMap/RestaurantMap.css");
  assert(
    /\.floor-carry--server,\s*\.floor-carry--cashier \{\s*bottom: 30%;/.test(css),
    "G2: servers hold the plate in the hand at waist height, not over the head",
  );
}

console.log("H. Only when hired and needed; the Cleaner really cleans (developer 2026-10-16)");
{
  const kinds = (roles: readonly string[], c: Partial<typeof WORK> | Record<string, unknown>) =>
    staffCast(roles, { ...WORK, ...c } as never).map((a) => a.kind);
  assert(
    !FLOOR_LIFE_ALWAYS_PREVIEW && staffOnMap([], { ...WORK }).roles.length === 0,
    "H1: the testing preview is off — the floors show only what the save hires and owns",
  );
  assert(
    !kinds(["server"], { diningOpen: false }).includes("server") &&
      kinds(["server"], {}).includes("server"),
    "H2: the Server is there only once the dining room is open",
  );
  assert(
    !kinds([], {}).includes("cashier") &&
      !kinds(["server"], { serviceOpen: false }).includes("cashier") &&
      kinds(["server"], {}).includes("cashier"),
    "H3: the counter's cashier comes with a hired Server (the game has no cashier role), once the counter is open",
  );
  assert(
    !kinds(["cleaner"], { cleanerJob: null }).includes("cleaner") &&
      kinds(["cleaner"], { cleanerJob: "sink" }).includes("cleaner") &&
      !kinds([], { cleanerJob: "sink" }).includes("cleaner"),
    "H4: the Cleaner is in the restroom only when hired AND a restroom job is open",
  );
  const cl = staffCast(["cleaner"], { ...WORK, cleanerJob: "sink" }).find(
    (a) => a.kind === "cleaner",
  )!;
  assert(
    cl.food === "🧼" &&
      cl.stops.length === 1 &&
      cl.stops[0]!.pose === "clean" &&
      cl.stops[0]!.hold === CLEANING_SECONDS,
    "H5: the Cleaner stands at the job's fixture with its icon (🧼 soap) for CLEANING_SECONDS",
  );
  // The real job: cleanerRestroomJob + cleanTask (no mock).
  const base = structuredClone(DEFAULT_SAVE);
  const withJob = (hired: string[], areas = ["kitchen", "dining", "restroom"]) =>
    ({
      ...base,
      business: {
        ...base.business,
        staff: { hiredRoles: hired },
        supplies: {
          ...base.business.supplies,
          stock: { "hand-soap": { units: 3, costBasis: 300 } },
        },
        cleanliness: {
          ...cleanlinessOf(base),
          tasks: [{ kind: "sink", count: 1, since: 1 }],
          cleanerAreas: areas,
        },
      },
    }) as unknown as typeof base;
  const s1 = withJob(["cleaner"]);
  const job = cleanerRestroomJob(s1);
  const done = job ? cleanTask(s1, job, "cleaner") : null;
  assert(
    job === "sink" &&
      !!done?.ok &&
      cleanlinessOf(done.save).tasks.length === 0 &&
      cleanlinessOf(done.save).byCleaner === cleanlinessOf(s1).byCleaner + 1,
    "H6: a hired Cleaner's restroom job is real — cleaning it removes the task, uses the supplies and counts as the Cleaner's",
    { job, ok: done?.ok, needs: done?.needs },
  );
  assert(
    cleanerRestroomJob(withJob([])) === null &&
      cleanerRestroomJob(withJob(["cleaner"], ["kitchen", "dining"])) === null,
    "H7: no job without a hired Cleaner, nor when the restroom isn't assigned to them",
  );
  const app = read("src/App.tsx");
  assert(
    /function cleanerCleans\(job: TaskKind\)[\s\S]{0,200}cleanerRestroomJob\(current\) !== job[\s\S]{0,120}cleanTask\(current, job, "cleaner"\)/.test(
      app,
    ),
    "H8: when the map's Cleaner finishes, the game cleans that job for real (only if it is still the Cleaner's job)",
  );
}

console.log("D. Deterministic");
{
  const a = JSON.stringify(floorCast(floorOf(ALL, 3, 2)));
  const b = JSON.stringify(floorCast(floorOf(ALL, 3, 2)));
  // The code itself, without comments (the header mentions Math.random to forbid it).
  const src = read("src/game/restaurant/floorLife.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert(
    a === b && !/Math\.random/.test(src),
    "D1: the same floor gives the same cast; no Math.random",
  );
}

console.log("V. View");
{
  const view = read("src/components/kc/restaurantMap/FloorLife.tsx");
  const css = read("src/components/kc/restaurantMap/RestaurantMap.css");
  const block = css.slice(
    css.indexOf(".floor-life {"),
    css.indexOf(".restaurant-map--reduced-motion .floor-life"),
  );
  const animated = [...view.matchAll(/\{(transform|opacity):/g)].map((m) => m[1]);
  assert(
    /aria-hidden="true"/.test(view) && /\.floor-life \{[^}]*pointer-events: none/.test(css),
    "V1: decorative — hidden from screen readers and never takes a tap",
  );
  assert(
    animated.length > 0 &&
      animated.every((p) => p === "transform" || p === "opacity") &&
      !/@keyframes[^{]*\{[^}]*(left|top):/.test(block),
    "V2: the keyframes only animate transform and opacity",
  );
  assert(
    /\.restaurant-map--reduced-motion \.floor-life \{\s*display: none/.test(css),
    "V3: hidden by the game's Reduced Motion setting, like the first floor's guests",
  );
  const pkg = read("package.json");
  assert(
    !/framer-motion|gsap|animejs|lottie|react-spring/.test(pkg) &&
      !/SaveManager|credits|appendLedgerEntry|debitWallet/.test(
        view + read("src/game/restaurant/floorLife.ts"),
      ),
    "V4: no animation library; the animation never touches money, the ledger or the save",
  );
  const sfv = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  assert(
    /const previewLife = FLOOR_LIFE_ALWAYS_PREVIEW;/.test(sfv) &&
      /<FloorLife\s+floor=\{previewLife \? FLOOR_LIFE_PREVIEW : floor\}/.test(sfv),
    "V5: the Second Floor map shows the save's floor (the full preview only with the testing flag on — the ?floor2 switch no longer adds people)",
  );
  const preview = floorCast(FLOOR_LIFE_PREVIEW);
  assert(
    count(preview, "server") === 3 &&
      count(preview, "guest") === MAX_GUESTS &&
      count(preview, "cleaner") === 2,
    "V6: the testing preview (when switched on) still shows the full cast",
  );
}

console.log(failures ? `\nFLOOR LIFE QA: ${failures} FAILURE(S)` : "\nFLOOR LIFE QA: ALL PASS");
process.exit(failures ? 1 : 0);
