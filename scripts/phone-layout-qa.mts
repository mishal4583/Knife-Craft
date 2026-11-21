/**
 * PHONE LAYOUT QA (developer 2026-11-18: "optimize the game for mobile and mobile landscape orientation"). Source guards for what the measured sweep
 * (tools/e2e/phoneaudit.mjs, real browser, nine phone sizes) found and fixed; the browser sweep itself is the proof, these keep the fixes from being undone.
 *
 *  A. A full-screen overlay (how-to, pause, result) never centres its card with `grid place-items-center` and no height limit: on a phone on its side
 *     (320-430 px tall) the card ran off the screen and its "Got it" / "Next" button could not be reached. The plain cards scroll with the overlay and
 *     centre with `m-auto`; the cards that scroll inside themselves sit in a flex centre so their `max-h` resolves.
 *  B. The Sauce Station, Fridge Sort and Car Park have a phone-landscape layout (the pantry, the shelves and the lot were off screen or tiny).
 *     Upright, the column groups are `display: contents`, so nothing moves.
 *  C. Touch targets and rows found too small (CLAUDE.md section 10): the Kitchen's View Details, the map's zoom buttons, the Car Park's "Let's go!".
 *  D. Unload the Van and Dessert Run are one fixed upright stage (a strip ~220 px wide, text 4-7 px, on a phone on its side): on its side they show a
 *     "Turn your phone upright" card with "Play anyway" (developer 2026-11-18) and the clock / round waits behind it.
 *
 * Run: npx tsx scripts/phone-layout-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

console.log("A. Overlays that fit a short screen");
{
  const games = [
    "src/components/kc/inventory/DeliveryInspectionGame.tsx",
    "src/components/kc/inventory/FridgeSortGame.tsx",
    "src/components/kc/inventory/StockroomSortGame.tsx",
    "src/components/kc/inventory/CarParkGame.tsx",
    "src/components/kc/restaurant/FridgeCheckGame.tsx",
    "src/components/kc/restaurant/FridgeCheckHowTo.tsx",
    "src/components/kc/sauce/SauceStationGame.tsx",
  ];
  const bad: string[] = [];
  for (const f of games)
    for (const line of read(f).split("\n"))
      if (
        /absolute inset-0 z-(?:30|40|50|\[60\]) grid place-items-center bg-(?:black\/(?:70|75)|\[#21160f\]\/60)[^"]* p-\d/.test(
          line,
        )
      )
        bad.push(`${f}: ${line.trim().slice(0, 90)}`);
  assert(
    bad.length === 0,
    "A1: no overlay of a game centres its card with a grid that cannot cap the card's height",
    bad,
  );

  const plain = [
    [
      "src/components/kc/inventory/FridgeSortGame.tsx",
      ["sort-guide", "sort-paused", "sort-result"],
    ],
    [
      "src/components/kc/inventory/StockroomSortGame.tsx",
      ["stock-guide", "stock-paused", "stock-result"],
    ],
    [
      "src/components/kc/sauce/SauceStationGame.tsx",
      ["sauce-guide", "sauce-paused", "sauce-result"],
    ],
    ["src/components/kc/inventory/DeliveryInspectionGame.tsx", ["insp-paused", "insp-result"]],
    ["src/components/kc/restaurant/FridgeCheckGame.tsx", ["fc-paused", "fc-result"]],
  ] as const;
  const notScrolling: string[] = [];
  for (const [f, ids] of plain) {
    const s = read(f);
    for (const id of ids) {
      const at = s.indexOf(`data-testid="${id}"`);
      const win = at < 0 ? "" : s.slice(Math.max(0, at - 260), at + 360);
      if (!/flex overflow-y-auto overscroll-contain/.test(win) || !/\bm-auto\b/.test(win))
        notScrolling.push(`${f}:${id}`);
    }
  }
  assert(
    notScrolling.length === 0,
    "A2: each plain guide, pause and result card scrolls with its overlay and centres with m-auto",
    notScrolling,
  );

  const selfScrolling = [
    ["src/components/kc/inventory/DeliveryInspectionGame.tsx", "insp-guide"],
    ["src/components/kc/restaurant/FridgeCheckHowTo.tsx", "fc-guide"],
  ] as const;
  const flexless = selfScrolling.filter(([f, id]) => {
    const s = read(f);
    const at = s.indexOf(`data-testid="${id}"`);
    return !/flex items-center justify-center/.test(s.slice(Math.max(0, at - 200), at + 40));
  });
  assert(
    flexless.length === 0,
    "A3: the cards that cap their own height (Inspection, Fridge Check how-to) sit in a flex centre",
    flexless,
  );

  const lists = ["FridgeSortGame", "StockroomSortGame"].map((n) =>
    read(`src/components/kc/inventory/${n}.tsx`),
  );
  assert(
    lists.every((s) => /land:grid-cols-2/.test(s)) &&
      /land:grid-cols-3/.test(read("src/components/kc/sauce/SauceStationGame.tsx")),
    "A4: on a phone on its side the how-to steps lay out in columns (the card was taller than the screen)",
  );
}

console.log("B. Phone-landscape layouts");
{
  const sauce = read("src/components/kc/sauce/SauceStationGame.tsx");
  assert(
    /const twoCol = phase !== "bottle" && phase !== "done"/.test(sauce) &&
      /twoCol && "land:flex land:min-h-0 land:flex-1 land:gap-2"/.test(sauce) &&
      ["order-1", "order-2", "order-3", "order-4", "order-5", "order-6", "order-7"].every((o) =>
        new RegExp(`\\b${o}\\b`).test(sauce),
      ),
    "B1: the Sauce Station mixes in two columns on its side (bowl and gauges left; steps, pantry and buttons right); upright, `order-*` keeps the one column",
  );
  const sort = read("src/components/kc/inventory/FridgeSortGame.tsx");
  assert(
    // RULE CHANGE 2026-11-21 (found by the deep check; the developer's Fridge Sort mock-up, 2026-11-20): on its side the game is a two-column grid: the HUD, the note and the basket in
    // the LEFT column (col 1), the cabinet of shelves in the RIGHT one (col 2, spanning the rows)
    /land:grid land:grid-cols-\[46fr_54fr\]/.test(sort) &&
      /land:col-start-1 land:row-start-3/.test(sort) &&
      /land:col-start-2 land:row-span-3/.test(sort),
    "B2: Fridge Sort puts the basket and the slip on the left and the shelves on the right on its side",
  );
  const car = read("src/components/kc/inventory/CarParkGame.tsx");
  assert(
    /land:grid-cols-\[1fr_1\.5fr_1fr\]/.test(car) &&
      /land:col-start-2 land:row-span-3/.test(car) &&
      /land:col-start-3/.test(car),
    "B3: the Car Park's lot takes the full height in the middle on its side (title and patience left, tow right)",
  );
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /land:overflow-x-auto[^"]*land:\[&>\*\]:shrink-0/.test(kitchen),
    "B4: the Kitchen's row of cards swipes sideways on a short landscape screen instead of squeezing City Ranking to a sliver",
  );
}

console.log("C. Touch targets");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /inline-flex min-h-12 shrink-0 items-center gap-1 rounded-full border border-\[#8f4d1e\]/.test(
      kitchen,
    ),
    "C1: View Details is 48 px",
  );
  const css = read("src/components/kc/restaurantMap/RestaurantMap.css");
  assert(
    !/\.zoom-btn \{[^}]*width: (28|32)px/.test(css.replace(/\n/g, " ")),
    "C2: the map's zoom buttons are 48 px at every width",
  );
  assert(
    /mt-4 min-h-12 w-full rounded-xl bg-\[#7b4a23\]/.test(
      read("src/components/kc/inventory/CarParkGame.tsx"),
    ),
    "C3: the Car Park's \"Let's go!\" is 48 px",
  );
}

console.log("D. Upright-only mini-games on a phone on its side");
{
  const card =
    read("src/components/kc/common/useTurnUpright.ts") +
    read("src/components/kc/common/TurnUprightCard.tsx");
  assert(
    /isPhoneLandscape\(window\.innerWidth, window\.innerHeight\)/.test(card) &&
      /held: phoneOnItsSide && !anyway/.test(card) &&
      /Turn your phone upright/.test(card) &&
      /Play anyway/.test(card) &&
      /min-h-12 flex-1/.test(card),
    'D1: the card shows only on a PHONE on its side (the real window, not the layout: a desktop window never sees it), until "Play anyway"; both buttons are 48 px',
  );
  const games = [
    ["src/components/kc/inventory/DessertRunGame.tsx", "dr-upright"],
    ["src/components/kc/inventory/KitchenDispatchGame.tsx", "kd-upright"],
  ] as const;
  const loose = games.filter(([f, id]) => {
    const s = read(f);
    return !(
      /useTurnUpright\(\)/.test(s) &&
      new RegExp(`testId="${id}"`).test(s) &&
      /pausedRef\.current = paused \|\| held/.test(s)
    );
  });
  assert(
    loose.length === 0,
    "D2: Dessert Run and Unload the Van show the card on their side and hold the round / clock behind it",
    loose,
  );
}

console.log(failures ? `\nPHONE LAYOUT QA: ${failures} FAILED` : "\nPHONE LAYOUT QA: ALL PASS");
process.exit(failures ? 1 : 0);
