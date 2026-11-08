/**
 * NPC SPRITES QA — the painted people (NPC realism, developer 2026-11-07: "the NPC assets are ready, start implementing it";
 * plan docs/planning/NPC-REALISM-PLAN-2026-11-07.md). Tested with the real modules and the real files:
 *
 *  A. The art: every look's sheets are in public/people/ with the sizes the engine reads (a 960 x 640, b 960 x 160, bust 576 x 384), each
 *     within its size budget, the whole set within the total budget; nothing is shipped that no look uses.
 *  B. The cast of looks: every first-floor staff role, the Old Chef, the 12 regulars, the generic guests and the Second Floor's crew have a
 *     look; both genders exist for servers, cleaners and guests; ages (the child is smaller, elders slower).
 *  C. Picks are seeded and fair: deterministic, no two neighbours alike, nobody repeats until the pool is used up, regulars are themselves.
 *  D. The casts: the Second Floor's guests, servers and cleaners are painted and different; the first floor's staff and guests are painted
 *     (guestLife.ts: 7 different guests, both genders); the walking pace follows the person; the route keeps the old behaviour.
 *  E. Facing: a walk turns the figure down / up / right / left by the leg it is on (service floor and map).
 *  F. Wiring: the maps draw people through the sprite engine with the SVG puppet as the fallback when a sheet fails; the dining-room
 *     views and the regulars' busts use it too; the cast is decoration (nothing reads or writes the save); no Math.random; transform /
 *     opacity / background-position only.
 *
 * Run: npx tsx scripts/npc-sprites-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import {
  CELL,
  FLOOR_CLEANER_LOOKS,
  FLOOR_SERVER_LOOKS,
  GUEST_LOOKS,
  PEOPLE_LOOKS,
  PEOPLE_SHEETS,
  REGULAR_LOOKS,
  STAFF_LOOK,
  WORK_CELLS,
  guestLookFor,
  hashOf,
  peopleUrl,
  pickLooks,
} from "../src/game/restaurant/peopleLooks.ts";
import {
  FLOOR_LIFE_PREVIEW,
  floorCast,
  speedOf,
  timeline,
} from "../src/game/restaurant/floorLife.ts";
import { firstFloorGuests } from "../src/game/restaurant/guestLife.ts";
import { staffCast, STAFF_LIFE_ROLES } from "../src/game/restaurant/staffLife.ts";
import { CUSTOMERS } from "../src/game/customers/customerDefinitions.ts";
import { WAITER_LOOKS, lookFor, walkFacing } from "../src/game/restaurant/serviceFloor.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const PEOPLE = path.resolve("public/people");

/** Width and height of a WebP file (lossy with alpha = VP8X, plain lossy = VP8, lossless = VP8L). */
function webpSize(file: string): { w: number; h: number } | null {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X")
    return {
      w: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)),
      h: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)),
    };
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const v = b.readUInt32LE(21);
    return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
  }
  return null;
}

console.log("A. The art");
{
  const looks = Object.values(PEOPLE_LOOKS);
  const want = (id: string, sheet: "a" | "b" | "bust") => path.join(PEOPLE, id, `${sheet}.webp`);
  let missing = "";
  let wrongSize = "";
  let tooBig = "";
  let total = 0;
  const G = PEOPLE_SHEETS;
  for (const l of looks) {
    const sheets: ("a" | "b" | "bust")[] = [
      "a",
      ...(l.work ? (["b"] as const) : []),
      ...(l.bust ? (["bust"] as const) : []),
    ];
    for (const sheet of sheets) {
      const f = want(l.id, sheet);
      if (!fs.existsSync(f)) {
        missing ||= `${l.id}/${sheet}`;
        continue;
      }
      const sz = webpSize(f);
      const g = G[sheet];
      if (!sz || sz.w !== g.cols * g.cell || sz.h !== g.rows * g.cell)
        wrongSize ||= `${l.id}/${sheet} ${sz?.w}x${sz?.h}`;
      const kb = fs.statSync(f).size / 1024;
      total += kb;
      const budget = sheet === "a" ? 90 : sheet === "b" ? 25 : 95;
      if (kb > budget) tooBig ||= `${l.id}/${sheet} ${kb.toFixed(0)} KB`;
    }
  }
  assert(
    !missing,
    `A1: every look has its sheets (a, plus b for the first-floor workers, plus the bust for the regulars) ${missing}`,
  );
  assert(
    !wrongSize,
    `A2: every sheet is the size the engine reads: a 960 x 640 (6 x 4), b 960 x 160 (6 x 1), bust 576 x 384 (3 x 2) ${wrongSize}`,
  );
  assert(
    !tooBig,
    `A3: each sheet is within its size budget (a 90 KB, b 25 KB, bust 95 KB) ${tooBig}`,
  );
  assert(
    total / 1024 < 3.6,
    `A4: the whole cast is ${(total / 1024).toFixed(2)} MB, under 3.6 MB (3.2 before the nine extra customer looks of 2026-11-08; lazy loaded: only the people on screen are fetched)`,
  );
  const known = new Set(looks.map((l) => l.id));
  const stray = fs.readdirSync(PEOPLE).filter((d) => !known.has(d));
  assert(stray.length === 0, `A5: nothing is shipped that no look uses ${stray.join(",")}`);
  assert(
    looks
      .filter((l) => l.work)
      .every((l) =>
        ["server", "cashier", "cleaner", "line-cook", "prep-cook", "head-chef"].includes(l.id),
      ) && looks.filter((l) => l.bust).length === 12,
    "A6: the work sheets are the six first-floor workers' (the manager's and the specialists' do not match their walk sheets); 12 busts",
  );
}

console.log("B. The cast of looks");
{
  const roles = [...STAFF_LIFE_ROLES, "cashier"] as string[];
  assert(
    roles.every((r) => PEOPLE_LOOKS[STAFF_LOOK[r] ?? ""]) &&
      PEOPLE_LOOKS[STAFF_LOOK["old-chef"]!]?.id === "head-chef",
    "B1: every first-floor staff role has a look; the Old Chef is the head chef's",
  );
  const regulars = CUSTOMERS.map((c) => c.id);
  assert(
    regulars.length === 12 &&
      regulars.every((id) => PEOPLE_LOOKS[id]?.group === "regular" && PEOPLE_LOOKS[id]?.bust),
    "B2: the 12 regulars of customerDefinitions are all painted, each with a bust",
  );
  const gendersOf = (ids: readonly string[]) => new Set(ids.map((i) => PEOPLE_LOOKS[i]!.gender));
  assert(
    gendersOf(FLOOR_SERVER_LOOKS).size === 2 &&
      gendersOf(FLOOR_CLEANER_LOOKS).size === 2 &&
      gendersOf(GUEST_LOOKS).size === 2 &&
      gendersOf(REGULAR_LOOKS).size === 2 &&
      FLOOR_SERVER_LOOKS.length === 4 &&
      FLOOR_CLEANER_LOOKS.length === 4,
    "B3: four floor servers and four floor cleaners, both genders each; the guests and regulars are men and women",
  );
  const noah = PEOPLE_LOOKS["noah"]!;
  const oscar = PEOPLE_LOOKS["oscar"]!;
  const mara = PEOPLE_LOOKS["mara"]!;
  assert(
    noah.age === "child" &&
      noah.scale < 0.8 &&
      noah.speed > 1 &&
      oscar.age === "elder" &&
      oscar.speed < 1 &&
      mara.scale === 1 &&
      mara.speed === 1,
    "B4: the child is smaller and quicker, an elder slower, an adult 1 (the generated figures are all about as tall; the size is applied on screen)",
  );
  assert(
    Object.keys(WORK_CELLS).every((k) => PEOPLE_LOOKS[k]?.work) &&
      Object.values(WORK_CELLS).every((cells) =>
        cells.every((c) => c >= 0 && c < PEOPLE_SHEETS.b.cols),
      ),
    "B5: the work poses point at real cells of the six workers' sheets",
  );
}

console.log("C. Picks are seeded and fair");
{
  const pool = [...GUEST_LOOKS, ...REGULAR_LOOKS];
  const a = pickLooks(123, pool.length + 6, pool);
  const b = pickLooks(123, pool.length + 6, pool);
  const c = pickLooks(124, pool.length + 6, pool);
  assert(
    JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c),
    "C1: the same seed gives the same people, another seed others",
  );
  assert(
    a.every((x, i) => i === 0 || x !== a[i - 1]),
    "C2: no two neighbours look alike",
  );
  assert(
    new Set(a.slice(0, pool.length)).size === pool.length,
    "C3: nobody repeats until the whole pool has been shown",
  );
  assert(
    pickLooks(1, 0, pool).length === 0 && pickLooks(1, 3, []).length === 0,
    "C4: nothing to pick, nothing returned",
  );
  assert(
    REGULAR_LOOKS.every((id) => guestLookFor(id) === id) &&
      guestLookFor("order-77~1") === guestLookFor("order-77~1") &&
      [...Array(40).keys()].every((i) => PEOPLE_LOOKS[guestLookFor(`o${i}~1`)]),
    "C5: a regular is always themselves; a party's other members and walk-ins are a fixed pick by the id",
  );
  const l = lookFor("mara");
  assert(
    l.look === "mara" &&
      lookFor("order~2").look === guestLookFor("order~2") &&
      WAITER_LOOKS.server.look === "server" &&
      WAITER_LOOKS.cook.look === "line-cook",
    "C6: the dining-room views get the same look for the same customer; the waiter is the Server or the cook",
  );
  assert(hashOf("a") === hashOf("a") && hashOf("a") !== hashOf("b"), "C7: the hash is stable");
}

console.log("D. The casts");
{
  const full = floorCast(FLOOR_LIFE_PREVIEW);
  const guests = full.filter((a) => a.kind === "guest");
  const servers = full.filter((a) => a.kind === "server");
  const cleaners = full.filter((a) => a.kind === "cleaner");
  assert(
    full.length > 0 &&
      full.every((a) => a.look && PEOPLE_LOOKS[a.look]) &&
      new Set(guests.map((a) => a.look)).size === guests.length &&
      new Set(servers.map((a) => a.look)).size === servers.length &&
      new Set(cleaners.map((a) => a.look)).size === cleaners.length &&
      servers.every((a) => FLOOR_SERVER_LOOKS.includes(a.look!)) &&
      cleaners.every((a) => FLOOR_CLEANER_LOOKS.includes(a.look!)),
    `D1: the Second Floor: ${guests.length} guests, ${servers.length} servers, ${cleaners.length} cleaners — every one painted, no two alike in a group`,
  );
  assert(
    JSON.stringify(floorCast(FLOOR_LIFE_PREVIEW)) === JSON.stringify(full) &&
      guests.length > 0 &&
      new Set(guests.map((a) => PEOPLE_LOOKS[a.look!]!.gender)).size === 2,
    "D2: the same floor gives the same cast (and the guests are men and women)",
  );
  const staff = staffCast(
    ["server", "cashier", "cleaner", "line-cook", "prep-cook", "head-chef", "manager"],
    {
      stage: "humble",
      diningOpen: true,
      serviceOpen: true,
      cleanerJob: "toilet",
    },
  );
  const byRole = (id: string) => staff.find((a) => a.id === id)?.look;
  assert(
    staff.every((a) => a.look && PEOPLE_LOOKS[a.look]) &&
      byRole("old-chef") === "head-chef" &&
      byRole("staff-server") === "server" &&
      byRole("staff-line-cook") === "line-cook" &&
      byRole("staff-manager") === "manager" &&
      byRole("service-cashier") === "cashier" &&
      staff.some((a) => a.id.startsWith("staff-cleaner") && a.look === "cleaner"),
    "D3: the first-floor staff are painted: each role is its own person (the Old Chef the head chef's)",
  );
  const g = firstFloorGuests();
  assert(
    g.length === 7 &&
      new Set(g.map((a) => a.look)).size === 7 &&
      g.every((a) => a.kind === "guest" && PEOPLE_LOOKS[a.look!]) &&
      new Set(g.map((a) => PEOPLE_LOOKS[a.look!]!.gender)).size === 2 &&
      g.every(
        (a) =>
          a.stops.some((s) => s.pose === "sit") &&
          a.stops.some((s) => s.pose === "pick") &&
          a.stops[0]!.pose === "away",
      ) &&
      JSON.stringify(firstFloorGuests()) === JSON.stringify(g),
    "D4: the first floor has 7 painted guests (a solo, a couple, a family of four), all different, men and women; each comes in, orders, sits and leaves",
  );
  const stops = g[0]!.stops;
  const adult = timeline(stops, 1).seconds;
  assert(
    timeline(stops).seconds === adult &&
      timeline(stops, 0.8).seconds > adult &&
      timeline(stops, 1.15).seconds < adult &&
      speedOf({ look: "oscar" }) < 1 &&
      speedOf({ look: "noah" }) > 1 &&
      speedOf({ look: "mara" }) === 1 &&
      speedOf({}) === 1,
    "D5: the pace follows the person: an elder's lap is longer, a child's shorter, an adult's (and any actor without a look) as before",
  );
  const lapEnds = g.every((a) => {
    const t = timeline(a.stops, speedOf(a));
    return t.frames.length > 0 && t.frames[t.frames.length - 1]!.at === 100;
  });
  assert(lapEnds, "D6: every guest's route is a closed lap (door to door)");
}

console.log("E. Facing");
{
  const path = [
    { x: 50, y: 90 },
    { x: 50, y: 60 }, // up
    { x: 80, y: 60 }, // right
    { x: 20, y: 62 }, // left
    { x: 20, y: 90 }, // down
  ];
  const f = walkFacing(path);
  assert(
    JSON.stringify(f) === JSON.stringify(["up", "r", "l", "down", "down"]) &&
      walkFacing([{ x: 1, y: 1 }]).length === 1,
    `E1: a walk turns the figure by the leg it is on (${f.join(",")}); the last point keeps the leg before it; a lone point faces the viewer`,
  );
}

console.log("F. Wiring");
{
  const map = read("src/components/kc/restaurantMap/FloorLife.tsx");
  const sprite = read("src/components/kc/restaurantMap/CharacterSprite.tsx");
  const sheets = read("src/components/kc/restaurantMap/peopleSheets.ts");
  const poses = read("src/components/kc/restaurantMap/GuestPoses.tsx");
  const view = read("src/components/kc/restaurantMap/RestaurantMapView.tsx");
  const css = read("src/components/kc/restaurantMap/people.css");
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  assert(
    /PoseCell/.test(map) &&
      /usePeopleSheets/.test(map) &&
      /WalkOnly/.test(map) &&
      /still loading: nothing drawn yet/.test(map) &&
      /z-index:\$\{Math\.round\(f\.y \* 10\)\}/.test(map),
    "F1: the maps draw painted people (nothing while a sheet loads), fall back to the SVG puppet, and draw the nearer in front (z-index follows y)",
  );
  assert(
    /img\.onerror/.test(sheets) &&
      /"fail"/.test(sheets) &&
      /=== "fail"\) return <SvgPoses/.test(poses.replace(/\s+/g, " ")) &&
      /info\.work && sheetB\(info\.id\) === "fail"/.test(map.replace(/\s+/g, " ")),
    "F2: a sheet that fails to load is noticed (Image probe) and leaves the SVG puppet (a worker needs both of its sheets)",
  );
  assert(
    /firstFloorGuests/.test(view) && /<MapCast cast=\{cast\} testId="guest-life"/.test(view),
    "F3: the first floor's guests are map actors (the old CSS parties are no longer drawn)",
  );
  assert(
    /faceKeyframes/.test(floor) &&
      /walkFacing/.test(floor) &&
      /look=\{look\.look\}/.test(floor) &&
      /look="cashier"/.test(floor),
    "F4: the dining room (ServiceFloor) draws painted guests, the waiter and the Cashier, turned the way they walk",
  );
  assert(
    /CustomerBust/.test(read("src/components/kc/game/ServiceOrderComplete.tsx")) &&
      /CustomerBust/.test(read("src/components/kc/game/ServiceFloor.tsx")) &&
      /CustomerBust/.test(read("src/components/kc/business/BusinessService.tsx")) &&
      /fallback/.test(read("src/components/kc/common/CustomerBust.tsx")),
    "F5: the regulars' busts replace the emoji on the order cards (the emoji stays when a bust cannot load)",
  );
  const modules = ["peopleLooks", "guestLife", "floorLife", "staffLife"].map((m) =>
    read(`src/game/restaurant/${m}.ts`),
  );
  assert(
    modules.every((s) => !/SaveManager|writeSave|saveGame|localStorage/.test(s)) &&
      !/Math\.random\(/.test(
        modules.join("") +
          map +
          sprite +
          sheets +
          poses +
          read("src/components/kc/common/CustomerBust.tsx"),
      ),
    "F6: the cast is decoration: nothing here reads or writes the save; no Math.random",
  );
  const animated = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)]
    .map((m) => m[1]!)
    .join("\n");
  assert(
    !/\b(left|top|right|bottom|width|height)\s*:/.test(animated) &&
      /background-position/.test(animated),
    "F7: the sprite animations move background-position only (no layout properties)",
  );
  assert(
    fs.existsSync(path.resolve("scripts/make-npc-assets.py")) &&
      /Pillow, numpy and scipy/.test(read("scripts/make-npc-assets.py")) &&
      peopleUrl("mara", "bust", "/") === "/people/mara/bust.webp" &&
      CELL.walk.length === 4 &&
      CELL.seated === 5,
    "F8: scripts/make-npc-assets.py rebuilds the sheets from NPC Assets/; the engine reads the same grid (walk x4, idle, seated)",
  );
}

console.log(failures ? `NPC SPRITES QA: ${failures} FAILURE(S)` : "NPC SPRITES QA: ALL PASS");
process.exit(failures ? 1 : 0);
