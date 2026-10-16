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
 *  D  Deterministic: the same floor gives the same cast; no Math.random.
 *  V  View: decorative (aria-hidden, no taps), transform/opacity only, off
 *     with reduced motion, no animation library, never touches money or saves.
 *
 * Run: npx tsx scripts/restaurant-floor-life-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  FLOOR_SPOTS,
  MAX_GUESTS,
  floorCast,
  timeline,
  workingStations,
} from "../src/game/restaurant/floorLife.ts";
import type { SecondFloorState, StationId } from "../src/game/restaurant/secondFloor.ts";

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
      guest.stops.find((s) => s.pose === "pick")!.x === FLOOR_SPOTS.counterFront.x &&
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
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
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
    /\.restaurant-map--reduced-motion \.floor-life \{\s*display: none/.test(css) &&
      /prefers-reduced-motion: reduce\)\s*\{\s*\.floor-life \{\s*display: none/.test(css),
    "V3: hidden with reduced motion (the map's switch and the system setting)",
  );
  const pkg = read("package.json");
  assert(
    !/framer-motion|gsap|animejs|lottie|react-spring/.test(pkg) &&
      !/SaveManager|credits|appendLedgerEntry|debitWallet/.test(
        view + read("src/game/restaurant/floorLife.ts"),
      ),
    "V4: no animation library; the animation never touches money, the ledger or the save",
  );
  assert(
    /<FloorLife floor=\{floor\}/.test(read("src/components/kc/restaurantMap/SecondFloorView.tsx")),
    "V5: the Second Floor map shows it",
  );
}

console.log(failures ? `\nFLOOR LIFE QA: ${failures} FAILURE(S)` : "\nFLOOR LIFE QA: ALL PASS");
process.exit(failures ? 1 : 0);
