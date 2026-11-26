/**
 * NPC DOOR AND DISH QA (developer 2026-11-26: "the customers are not walking out through the proper door, some are walking out sideways", "let the waiter staffs deliver real dish with dish
 * image that we have and properly place it in their hands", "find and fix all other issues regarding NPCs", "check the second floor also").
 *
 *  A  the street door: on all twelve plans (six tall, six wide) every guest uses a lane inside the measured gap between the door leaves, goes through it in a straight vertical line,
 *     both ways, and is drawn facing the camera or away from it (never sideways) there
 *  B  the Server walks AROUND the tables (every stop open floor, every stretch clear) on all twelve plans, and picks up at the counter
 *  C  the Second Floor's Servers follow the corridors (no stretch cuts across a room from one machine to the next)
 *  D  the real dish: tokens are given to the pick stops, every one has a painted picture that exists, the second floor's foods are painted icons
 *
 * Run: npx tsx scripts/npc-door-dish-qa.mts
 */
import { existsSync, readFileSync } from "node:fs";
import {
  DOOR_GAP_TALL,
  DOOR_GAP_WIDE,
  DOOR_PAD,
  blockedAt,
  doorLanes,
  geoOf,
  segmentFree,
  wideOf,
  type WalkStage,
} from "../src/game/restaurant/guestWalk.ts";
import { firstFloorGuests } from "../src/game/restaurant/guestLife.ts";
import { MAP_STAGES, roleStops, STAGE_SPOTS } from "../src/game/restaurant/staffLife.ts";
import {
  FLOOR_LIFE_PREVIEW,
  FLOOR_SPOTS,
  FLOOR_SPOTS_WIDE,
  facingOf,
  floorCast,
  type FloorActor,
} from "../src/game/restaurant/floorLife.ts";
import { DISH_TOKEN, plateUrl, withDishes } from "../src/game/restaurant/mapDishes.ts";
import { DISH_ART_IDS } from "../src/game/dishArtFiles.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));

const PLANS: {
  name: string;
  stage: WalkStage;
  base: (typeof MAP_STAGES)[number];
  wide: boolean;
}[] = MAP_STAGES.flatMap((st) => [
  { name: st, stage: st as WalkStage, base: st, wide: false },
  { name: `${st}@wide`, stage: wideOf(st), base: st, wide: true },
]);

console.log("A. The street door");
{
  let bad: unknown[] = [];
  let sideways: unknown[] = [];
  let gap: unknown[] = [];
  for (const plan of PLANS) {
    const g = geoOf(plan.stage);
    const gp = plan.wide ? DOOR_GAP_WIDE[plan.base] : DOOR_GAP_TALL;
    // the walkable doorway is the measured gap less the padding on each side
    if (
      Math.abs(g.doorway.x0 - (gp.x0 + DOOR_PAD)) > 1e-9 ||
      Math.abs(g.doorway.x1 - (gp.x1 - DOOR_PAD)) > 1e-9
    )
      gap.push(plan.name);
    const lanes = doorLanes(plan.stage, 4);
    if (!lanes.every((x) => x >= g.doorway.x0 - 0.06 && x <= g.doorway.x1 + 0.06))
      bad.push([plan.name, "lanes", lanes]);
    for (const a of firstFloorGuests(plan.stage)) {
      const doorStops = a.stops.filter((s) => s.y >= g.room.y1 - 0.01);
      for (const s of doorStops)
        if (s.x < g.doorway.x0 - 0.06 || s.x > g.doorway.x1 + 0.06) bad.push([plan.name, a.id, s]);
      // consecutive stops in the door region are one vertical line (in and out)
      for (let i = 1; i < a.stops.length; i++) {
        const p = a.stops[i - 1]!;
        const q = a.stops[i]!;
        if (p.y >= g.room.y1 - 0.01 && q.y >= g.room.y1 - 0.01 && Math.abs(p.x - q.x) > 0.01)
          bad.push([plan.name, a.id, "not vertical", p, q]);
        // facing on any stretch inside the doorway or between the gate and the street
        if (Math.max(p.y, q.y) >= g.room.y1 && Math.abs(q.x - p.x) <= Math.abs(q.y - p.y) * 1.25) {
          const f = facingOf(q.x - p.x, q.y - p.y);
          if (f === "r" || f === "l") sideways.push([plan.name, a.id, p, q]);
        }
        if (Math.max(p.y, q.y) >= g.room.y1 && p.x === q.x) {
          const f = facingOf(q.x - p.x, q.y - p.y);
          if (f !== "down" && f !== "up") sideways.push([plan.name, a.id, p, q, f]);
        }
      }
      // they come in and go out by the same lane
      const lane = doorStops[0]?.x;
      if (doorStops.some((s) => s.x !== lane)) bad.push([plan.name, a.id, "two lanes"]);
    }
  }
  assert(
    gap.length === 0,
    "A1: the walkable doorway is the measured gap less the padding, on all 12 plans",
    gap,
  );
  assert(
    bad.length === 0,
    "A2: every guest goes through the door in one lane inside the gap, in a straight vertical line, in and out",
    bad.slice(0, 3),
  );
  assert(
    sideways.length === 0,
    "A3: a stretch in the doorway is drawn facing the camera or away from it, never sideways",
    sideways.slice(0, 3),
  );
  assert(
    facingOf(5, 4) === "down" &&
      facingOf(5, -4) === "up" &&
      facingOf(6, 2) === "r" &&
      facingOf(-6, 2) === "l" &&
      facingOf(0, 3) === "down",
    "A4: a diagonal faces the camera or away, only a clearly sideways walk faces sideways",
  );
  // the gap is measured on the pictures: narrow enough that the old lanes (47 and 53) fall outside it for every wide plan but two
  assert(
    DOOR_GAP_TALL.x1 - DOOR_GAP_TALL.x0 < 6 &&
      MAP_STAGES.every((s) => DOOR_GAP_WIDE[s].x1 - DOOR_GAP_WIDE[s].x0 < 6.5),
    "A5: the door gaps are the measured 4 to 6 % (the old doorway was 11 % wide)",
  );
}

console.log("B. The Server walks around the tables");
{
  const bad: unknown[] = [];
  for (const plan of PLANS) {
    const stops = roleStops("server", plan.base, plan.wide);
    for (const s of stops) if (blockedAt(plan.stage, s)) bad.push([plan.name, "blocked", s]);
    for (let i = 0; i < stops.length; i++) {
      const p = stops[i]!;
      const q = stops[(i + 1) % stops.length]!;
      if (!segmentFree(plan.stage, p, q)) bad.push([plan.name, "crosses", p, q]);
    }
    const pick = stops.find((s) => s.pose === "pick");
    const drop = stops.find((s) => s.pose === "drop");
    if (!pick || !drop) bad.push([plan.name, "no pick/drop"]);
  }
  assert(
    bad.length === 0,
    "B1: every Server stop is open floor and every stretch is clear of cloths and chairs, on all 12 plans",
    bad.slice(0, 4),
  );
  assert(
    PLANS.every(
      (p) =>
        roleStops("server", p.base, p.wide).filter((s) => s.pose === "pick").length === 2 &&
        roleStops("server", p.base, p.wide).filter((s) => s.pose === "drop").length === 2,
    ),
    "B2: two pick-ups at the counter and two drops, as before",
  );
  void STAGE_SPOTS;
}

console.log("C. The Second Floor's Servers");
{
  const bad: unknown[] = [];
  for (const wide of [false, true]) {
    const S = wide ? FLOOR_SPOTS_WIDE : FLOOR_SPOTS;
    const cast = floorCast(FLOOR_LIFE_PREVIEW, wide).filter((a: FloorActor) => a.kind === "server");
    if (cast.length === 0) bad.push([wide, "no servers"]);
    for (const a of cast)
      for (let i = 0; i < a.stops.length; i++) {
        const p = a.stops[i]!;
        const q = a.stops[(i + 1) % a.stops.length]!;
        const dx = Math.abs(q.x - p.x);
        const dy = Math.abs(q.y - p.y);
        // along a corridor (one axis), or a short step beside the counter; never a long diagonal across a room
        if (dx > 4.5 && dy > 4.5 && Math.hypot(dx, dy) > 9)
          bad.push([wide ? "wide" : "tall", a.id, i, p, q]);
      }
    void S;
  }
  assert(
    bad.length === 0,
    "C1: no Second Floor Server stretch cuts diagonally across a room (they follow the corridors)",
    bad.slice(0, 4),
  );
  const foods = floorCast(FLOOR_LIFE_PREVIEW, false).flatMap((a) =>
    a.stops.filter((s) => s.pose === "pick").map((s) => s.dish),
  );
  assert(
    foods.length > 0 && foods.every((d) => !!d),
    "C2: every Second Floor pick-up names the food it carries",
    foods,
  );
}

console.log("D. The real dish");
{
  // every tokenised picture exists
  const icons = ["☕", "🥤", "🍕", "🍔", "🍦", "🍟"];
  assert(
    icons.every((e) => {
      const u = plateUrl(e);
      return !!u && exists(`public${u.replace(/^\/?/, "/")}`);
    }),
    "D1: the six Second Floor foods are painted icons that exist",
    icons.map((e) => plateUrl(e)),
  );
  const ids = [...DISH_ART_IDS].slice(0, 3);
  const cast = withDishes(
    [
      {
        id: "s",
        kind: "server",
        outfit: "",
        hair: "",
        delay: 0,
        stops: [
          { x: 1, y: 1, pose: "pick", hold: 1 },
          { x: 2, y: 2, pose: "drop", hold: 1 },
          { x: 3, y: 3, pose: "pick", hold: 1 },
        ],
      },
      {
        id: "g",
        kind: "guest",
        outfit: "",
        hair: "",
        delay: 0,
        stops: [{ x: 1, y: 1, pose: "pick", hold: 1 }],
      },
    ],
    ids,
  );
  const toks = cast.flatMap((a) => a.stops.map((s) => s.dish).filter(Boolean)) as string[];
  assert(
    toks.length === 3 && toks.every((t) => t.startsWith(DISH_TOKEN)) && new Set(toks).size === 3,
    "D2: each pick-up gets a different dish in turn (the Server's two trips and the guest)",
    toks,
  );
  assert(
    toks.every((t) => {
      const u = plateUrl(t);
      return !!u && exists(`public/dishes/${t.slice(DISH_TOKEN.length)}.webp`);
    }),
    "D3: every dish is drawn as its own painted plate, a file that exists",
  );
  assert(
    withDishes(
      [
        {
          id: "x",
          kind: "server",
          outfit: "",
          hair: "",
          delay: 0,
          stops: [{ x: 1, y: 1, pose: "pick", hold: 1 }],
        },
      ],
      [],
    ).every((a) => a.stops.every((s) => !s.dish)),
    "D4: with no dish to give nothing is invented",
  );
  const css = read("src/components/kc/restaurantMap/people.css");
  const tsx = read("src/components/kc/restaurantMap/FloorLife.tsx");
  assert(
    /\.cs-layer \.floor-dish/.test(css) &&
      /carry-l"\] \.floor-dish/.test(css) &&
      /carry-down"\] \.floor-dish/.test(css),
    "D5: the plate sits on the tray in each carrying pose (right, left, front)",
  );
  assert(
    /layer\.startsWith\("carry-"\)/.test(tsx) &&
      /data-testid="floor-dish"/.test(tsx) &&
      /\$\{k\}-dish\$\{tn\}/.test(tsx),
    "D6: the plate is drawn inside the carrying poses and shown only while it is carried (own keyframes)",
  );
  const code = read("src/game/restaurant/mapDishes.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(
    !/Math\.random|Date\.now|credits|economyLedger|localStorage/.test(code),
    "D7: mapDishes is pure: no random, clock, money or storage",
  );
}

console.log(
  failures ? `\nNPC DOOR AND DISH QA: ${failures} FAILED` : "\nNPC DOOR AND DISH QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
