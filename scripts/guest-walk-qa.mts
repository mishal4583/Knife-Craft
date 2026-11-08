/**
 * GUEST WALK QA (developer 2026-11-08: "there are more NPC assets, add them" and "they are walking on top of tables, optimize their walking,
 * reduce the NPC height only a little"). Pure rules; the pictures are checked in tools/e2e/guestwalk.mjs.
 *   A  the nine new customer looks (tourists, food bloggers, businessman, affluent diner, family) are cut, listed and used
 *   B  on every one of the six artworks the first floor's guests never step on a table top, stay on the dining floor and the doorway,
 *      sit on their own chair, queue at their own counter spot, and the cast is the same every time
 *   C  a person is a little smaller (9.6vw / 56 px on the map, 124% in the dining room)
 * Run: npx tsx scripts/guest-walk-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { firstFloorGuests } from "../src/game/restaurant/guestLife.ts";
import {
  STAGE_TABLES,
  TABLE_TOP,
  blockedAt,
  segmentFree,
  walkPath,
} from "../src/game/restaurant/guestWalk.ts";
import { GUEST_LOOKS, PEOPLE_LOOKS } from "../src/game/restaurant/peopleLooks.ts";
import { MAP_STAGES } from "../src/game/restaurant/staffLife.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail).slice(0, 400));
  }
}

console.log("A. The nine new customer looks");
{
  const NEW = [
    "international-tourist-f",
    "international-tourist-m",
    "food-blogger-f",
    "food-blogger-m",
    "businessman",
    "affluent-diner-f",
    "family-mother",
    "family-father",
    "family-child",
  ];
  assert(
    NEW.every((id) => PEOPLE_LOOKS[id]?.group === "guest" && GUEST_LOOKS.includes(id)),
    "A1: all nine are guest looks (the dining room, the Second Floor and the walk-ins pick from them)",
  );
  const missing = NEW.filter(
    (id) => !fs.existsSync(path.join(ROOT, "public/people", id, "a.webp")),
  );
  assert(missing.length === 0, "A2: every one has its cut sheet in public/people", missing);
  assert(
    PEOPLE_LOOKS["family-child"]!.age === "child" &&
      PEOPLE_LOOKS["family-child"]!.scale < 1 &&
      PEOPLE_LOOKS["family-mother"]!.gender === "f" &&
      PEOPLE_LOOKS["family-father"]!.gender === "m" &&
      PEOPLE_LOOKS["businessman"]!.gender === "m",
    "A3: the child is a child (smaller and quicker), the mother and the father are who they say",
  );
  const maker = read("scripts/make-npc-assets.py");
  assert(
    NEW.every((id) => maker.includes(id)),
    "A4: scripts/make-npc-assets.py cuts all nine",
  );
  const onFloor = new Set(firstFloorGuests("humble").map((g) => g.look));
  assert(
    ["family-father", "family-mother", "family-child", "businessman", "affluent-diner-f"].every(
      (l) => onFloor.has(l),
    ),
    "A5: a family of four, a businessman and an affluent diner walk the first floor",
  );
}

console.log("B. Nobody walks on a table");
{
  for (const stage of MAP_STAGES) {
    const guests = firstFloorGuests(stage);
    const tables = STAGE_TABLES[stage];
    const own = (g: (typeof guests)[number]) => {
      const sit = g.stops.find((s) => s.pose === "sit")!;
      return [...tables].sort(
        (a, b) => Math.hypot(a.x - sit.x, a.y - sit.y) - Math.hypot(b.x - sit.x, b.y - sit.y),
      )[0]!;
    };
    assert(
      guests.length === 7 && new Set(guests.map((g) => g.look)).size === 7,
      `B1 ${stage}: seven different guests`,
      guests.length,
    );
    let onTop: unknown = null;
    let offFloor: unknown = null;
    for (const g of guests) {
      const t = own(g);
      for (let i = 1; i < g.stops.length; i++) {
        const a = g.stops[i - 1]!;
        const b = g.stops[i]!;
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25));
        for (let k = 0; k <= n; k++) {
          const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
          for (const tb of tables) {
            if (
              Math.abs(p.x - tb.x) < TABLE_TOP.hw - 0.2 &&
              Math.abs(p.y - tb.y) < TABLE_TOP.hh - 0.3
            )
              onTop ??= { guest: g.id, p, table: tb };
          }
        }
        if (i > 1 && !segmentFree(stage, a, b, t)) offFloor ??= { guest: g.id, a, b };
      }
    }
    assert(onTop === null, `B2 ${stage}: no guest steps on a table top`, onTop);
    assert(
      offFloor === null,
      `B3 ${stage}: every step is on open floor (the dining floor and the doorway; only their own chairs are crossed)`,
      offFloor,
    );
    const chairs = guests.map((g) => {
      const s = g.stops.find((x) => x.pose === "sit")!;
      return `${s.x},${s.y}`;
    });
    assert(new Set(chairs).size === 7, `B4 ${stage}: each guest has a chair of their own`, chairs);
    const orders = guests.filter((g) => g.stops.some((x) => x.pose === "pick"));
    const spots = orders.map((g) => g.stops.find((x) => x.pose === "pick")!.x);
    console.log(
      `      ${stage}: ${orders.length} of 7 queue at the counter, ${new Set(spots).size} different spots`,
    );
    assert(
      orders.every(
        (g) =>
          !blockedAt(
            stage,
            g.stops.find((x) => x.pose === "pick")!,
          ),
      ),
      `B5 ${stage}: nobody queues inside a table or a chair`,
    );
    assert(
      orders.length === 7 || stage === "grand",
      `B6 ${stage}: every guest orders at the counter (only the packed nine-table room may leave it out of reach)`,
      orders.length,
    );
    assert(
      new Set(spots).size >= Math.min(orders.length, 3),
      `B6b ${stage}: the queue is not one spot`,
      spots,
    );
    assert(
      guests.every((g) => g.stops[0]!.pose === "away" && g.stops.some((s) => s.pose === "sit")),
      `B7 ${stage}: each guest comes from the street, sits and goes back`,
    );
  }
  assert(
    JSON.stringify(firstFloorGuests("grand")) === JSON.stringify(firstFloorGuests("grand")) &&
      JSON.stringify(firstFloorGuests()) === JSON.stringify(firstFloorGuests("humble")),
    "B8: the same cast every time; the first artwork is the default",
  );
  const around = walkPath("humble", { x: 50, y: 78 }, { x: 70, y: 76 }, undefined);
  assert(
    around !== null && around.length >= 1,
    "B9: the search finds its way around a table (a straight line through the table is refused)",
  );
  assert(
    !segmentFree("humble", { x: 36, y: 68.5 }, { x: 77, y: 68.5 }),
    "B10: a straight line across both humble tables is not open floor",
  );
  assert(
    walkPath("humble", { x: 50, y: 70 }, { x: 70, y: 68.5 }) === null ||
      walkPath("humble", { x: 50, y: 70 }, { x: 70, y: 68.5 })!.length >= 1,
    "B11: a goal inside a table's chairs is handled without a crash",
  );
}

console.log("C. A little smaller");
{
  const css = read("src/components/kc/restaurantMap/people.css");
  assert(
    /clamp\(29px, 9\.6vw, 56px\)/.test(css) && /calc\(124% \* var\(--cs-scale, 1\)\)/.test(css),
    "C1: the map person is clamp(29px, 9.6vw, 56px) and the dining-room guest 124% (was 10.5vw / 62 px and 135%)",
  );
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
