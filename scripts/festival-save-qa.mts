/**
 * FESTIVAL SAVE, UNLOCK, ART AND WIRING QA (developer 2026-11-27; the one new save field `business.festivals` approved: "do whatever necessary").
 *
 *  A  the save: absent or damaged reads as nothing; a finished round counts once, keeps the best; a won stage opens the next; old saves need nothing;
 *     no money, no ledger
 *  B  the unlocks (RULE CHANGE, developer 2026-11-28): the first at Level 10; every other one after the third stage of the one before, 10 services later
 *  C  the screen's boxes: every tap target 48 px at the smallest window, inside the stage, none on another, for every pace, upright and wide; the
 *     stall's sign, chalkboard and props never cover a station or an order; landscape (the developer's picture, 2026-11-28): every food, drink and
 *     plate keeps its own place at every stage, and what a stage has not got waits there, locked, with the stage that brings it; every plate lies
 *     inside the board's flat surface, mostly within its own tap box, on no other plate
 *  D  the art: every picture the festival names exists, small; the 270 MB source folder is kept out of git
 *  E  wiring: the screen, the preview link, the level lock, the result, the after-campaign count, the Mini-games card, pause; Dessert Run untouched
 *
 * Run: npx tsx scripts/festival-save-qa.mts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FESTIVAL_EVENTS,
  festivalEvent,
  paceOfStage,
  stageWithFood,
  stageWithPlates,
} from "../src/game/festival/events.ts";
import {
  festivalsOf,
  lifetimeOrdersOf,
  recordFestivalRound,
  servicesOf,
  stageToPlay,
  withFestivalBaseline,
} from "../src/game/festival/state.ts";
import { festivalStatus, waitingFestival } from "../src/game/festival/schedule.ts";
import { burgerKitchen } from "../src/game/festival/burger.ts";
import { cookerOf } from "../src/game/festival/kitchen.ts";
import { ALL_ART, LAYERS } from "../src/components/kc/festival/festivalArt.ts";
import { PACES, stagePace } from "../src/game/festival/tiers.ts";
import {
  BOARD_SURFACE,
  DISH_IN_FACE,
  PORTRAIT,
  SMALLEST_SCALE,
  WIDE,
  WIDE_PLACES,
  portraitHeight,
  portraitLayout,
  tapTargets,
  wideLayout,
  wideWidth,
  type FestivalLayout,
  type Rect,
} from "../src/components/kc/festival/festivalLayout.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(p, "utf8");

const levels = getLevels();
/** A save that has reached level `n` (n beyond the last = the whole campaign done). */
const at = (n: number): SaveData => {
  const done = levels.slice(0, Math.min(n - 1, levels.length)).map((l) => l.id);
  const current = levels[Math.min(n - 1, levels.length - 1)]!.id;
  return {
    ...structuredClone(DEFAULT_SAVE),
    credits: 12_345,
    levelProgress: {
      ...DEFAULT_SAVE.levelProgress,
      currentLevelId: current,
      highestUnlockedLevelId: current,
      completedLevelIds: done,
    },
  };
};
const finished = at(levels.length + 1);
const orders = (save: SaveData, n: number): SaveData => ({
  ...save,
  business: {
    ...save.business,
    finance: {
      ...save.business.finance,
      lifetime: { ...save.business.finance.lifetime, orderCount: n },
    },
  },
});
const status = (save: SaveData, id: string) => festivalStatus(save, festivalEvent(id)!);

console.log("A. The save");
{
  const fresh = at(12);
  assert(
    !("festivals" in DEFAULT_SAVE.business),
    "A1: a new and an old save have no festivals field (nothing to migrate)",
  );
  assert(
    JSON.stringify(festivalsOf(fresh)) === JSON.stringify({ v: 1, record: {} }),
    "A2: absent reads as none played",
  );
  const junk = {
    ...fresh,
    business: {
      ...fresh.business,
      festivals: {
        record: { burger: { plays: -3, wins: "x", best: NaN, stars: 9 }, bad: 4 },
        campaignDoneAtOrder: -1,
      } as never,
    },
  };
  // RULE CHANGE (developer 2026-11-27, the concept stall): the record also keeps `cleared`, the highest stage won, so the locked burners can open
  assert(
    JSON.stringify(festivalsOf(junk)) ===
      JSON.stringify({
        v: 1,
        record: { burger: { plays: 0, wins: 0, best: 0, stars: 3, cleared: 0 } },
      }),
    "A3: damaged values are clamped, never thrown on",
    festivalsOf(junk),
  );
  const before = JSON.stringify(fresh);
  const once = recordFestivalRound(orders(fresh, 7), "burger", { score: 900, stars: 2, won: true });
  const twice = recordFestivalRound(orders(once, 30), "burger", {
    score: 500,
    stars: 0,
    won: false,
  });
  assert(JSON.stringify(fresh) === before, "A4: recording never changes the save it was given");
  assert(
    // RULE CHANGE (developer 2026-11-27): a round without a stage number counts as stage 1; the lost round clears nothing
    // RULE CHANGE (developer 2026-11-28): the first play's order count is no longer written (the old schedule is gone)
    JSON.stringify(festivalsOf(twice).record.burger) ===
      JSON.stringify({ plays: 2, wins: 1, best: 900, stars: 2, cleared: 1 }),
    "A5: rounds are counted; the best score and stars stay",
    festivalsOf(twice).record.burger,
  );
  assert(
    twice.credits === fresh.credits &&
      JSON.stringify(twice.economyLedger) === JSON.stringify(fresh.economyLedger) &&
      JSON.stringify(twice.business.inventory) === JSON.stringify(fresh.business.inventory),
    "A6: no money, no ledger entry, no stock: replaying can never pay or cost anything",
  );
  const top = Object.keys(twice).sort().join();
  assert(top === Object.keys(fresh).sort().join(), "A7: no new top-level save field");
  const back = JSON.parse(JSON.stringify(twice)) as SaveData;
  assert(
    JSON.stringify(festivalsOf(back)) === JSON.stringify(festivalsOf(twice)),
    "A8: it survives being written and read",
  );
  assert(
    /\.\.\.partial\.business,/.test(read("src/game/SaveManager.ts")),
    "A9: SaveManager keeps every business field it reads (so festivals stay)",
  );
  const based = withFestivalBaseline(orders(fresh, 40), 40);
  assert(
    festivalsOf(based).campaignDoneAtOrder === 40 &&
      festivalsOf(withFestivalBaseline(based, 55)).campaignDoneAtOrder === 40,
    "A10: the after-campaign count starts once and never moves",
  );
  assert(
    lifetimeOrdersOf(orders(fresh, 12)) === 12,
    "A11: the count is the restaurant's own lifetime orders",
  );
  const play = (s: SaveData, stage: number, won: boolean) =>
    recordFestivalRound(s, "burger", { score: 100, stars: won ? 1 : 0, won, stage });
  const cleared = (s: SaveData) => festivalsOf(s).record.burger?.cleared ?? 0;
  let run = fresh;
  // RULE CHANGE (developer 2026-11-28): three stages, not ten
  assert(stageToPlay(run, "burger", 3) === 1, "A12: a new player starts at stage 1");
  run = play(run, 1, false);
  assert(
    cleared(run) === 0 && stageToPlay(run, "burger", 3) === 1,
    "A13: a lost stage opens nothing, and it is simply played again",
  );
  run = play(run, 1, true);
  run = play(run, 2, true);
  assert(
    cleared(run) === 2 && stageToPlay(run, "burger", 3) === 3,
    "A14: a won stage opens the next",
  );
  run = play(run, 1, true);
  run = play(run, 0, true);
  assert(cleared(run) === 2, "A15: replaying an earlier stage (or a preview) never takes one back");
  assert(
    festivalsOf(run).record.burger!.wonAt === undefined,
    "A15b: nothing is stamped before the third",
  );
  run = play(run, 3, true);
  assert(
    cleared(run) === 3 && stageToPlay(run, "burger", 3) === 3,
    "A16: after the third stage, it stays to be replayed",
  );
  const later = play({ ...run, levelProgress: at(30).levelProgress }, 3, true);
  assert(
    festivalsOf(run).record.burger!.wonAt === 11 && festivalsOf(later).record.burger!.wonAt === 11,
    "A16b: the third stage's first win keeps the services played by then; a replay never moves it",
    [festivalsOf(run).record.burger!.wonAt, festivalsOf(later).record.burger!.wonAt],
  );
  const wild = {
    ...fresh,
    business: {
      ...fresh.business,
      festivals: { v: 1, record: { burger: { cleared: 99 } } } as never,
    },
  };
  assert(cleared(wild) === 15, "A17: a damaged stage number is clamped");
}

console.log("B. The unlocks");
{
  assert(
    status(at(9), "burger").state === "level" && status(at(10), "burger").state === "open",
    "B1: the Burger Festival opens at Level 10",
  );
  // RULE CHANGE (developer 2026-11-28): "the final 3rd round unlocks the next festival ... playable only after 10 serves or levels". The old B2-B13
  // (Levels 20-90, then the 25-order schedule after the campaign) are replaced by these.
  const win = (save: SaveData, id: string, stage: number) =>
    recordFestivalRound(save, id, { score: 100, stars: 1, won: true, stage });
  const moved = (save: SaveData, n: number): SaveData => ({
    ...save,
    levelProgress: at(n).levelProgress,
  });
  const left = (s: SaveData, id: string) => {
    const st = status(s, id);
    return st.state === "services" ? st.left : st.state;
  };
  assert(
    FESTIVAL_EVENTS.slice(1).every((e) => festivalStatus(at(91), e).state === "previous"),
    "B2: no other festival opens by level alone, however far the campaign is",
  );
  const two = win(win(at(12), "burger", 1), "burger", 2);
  assert(
    status(two, "pizza").state === "previous" &&
      status(moved(two, 60), "pizza").state === "previous",
    "B3: the first two stages unlock nothing, however many services follow",
  );
  const three = win(two, "burger", 3);
  assert(
    left(three, "pizza") === 10 && left(moved(three, 21), "pizza") === 1,
    "B4: the third stage won: Pizza is 10 services away, then 1 after nine more levels",
    [left(three, "pizza"), left(moved(three, 21), "pizza")],
  );
  assert(left(moved(three, 22), "pizza") === "open", "B5: after the tenth, it is open");
  assert(
    left(win(moved(three, 17), "burger", 3), "pizza") === 5,
    "B6: replaying the third stage never starts the wait again",
  );
  // won near the campaign's end: the Endless Restaurant's orders finish the wait
  const nearEnd = win(win(win(at(91), "burger", 1), "burger", 2), "burger", 3);
  const doneSave: SaveData = orders({ ...nearEnd, levelProgress: finished.levelProgress }, 100);
  assert(
    servicesOf(doneSave) === levels.length && left(doneSave, "pizza") === 9,
    "B7: menu guests served during the campaign are not services; the last level is one",
    [servicesOf(doneSave), left(doneSave, "pizza")],
  );
  const endless = withFestivalBaseline(orders(doneSave, 101), 100);
  assert(
    left(endless, "pizza") === 8 && left(orders(endless, 109), "pizza") === "open",
    "B8: then each Endless Restaurant order is a service, from the first one",
    [left(endless, "pizza"), left(orders(endless, 109), "pizza")],
  );
  assert(
    status(moved(three, 91), "sandwich").state === "previous",
    "B9: the third festival waits for the second's third stage, so two never open together",
  );
  const old = {
    ...at(40),
    business: {
      ...at(40).business,
      festivals: { v: 1, record: { burger: { plays: 9, wins: 9, cleared: 10, playedAtOrder: 3 } } },
    },
  } as unknown as SaveData;
  assert(
    stageToPlay(old, "burger", 3) === 3 &&
      status(old, "pizza").state === "open" &&
      festivalsOf(old).record.burger!.playedAtOrder === 3,
    "B10: a save from the ten-stage build counts as won, keeps its fields and waits no more",
  );
  assert(
    status(recordFestivalRound(at(12), "pizza", { score: 1, stars: 0, won: false }), "pizza")
      .state === "open",
    "B11: a festival once played stays open",
  );
  assert(
    waitingFestival(at(12))?.id === "burger" &&
      waitingFestival(recordFestivalRound(at(12), "burger", { score: 1, stars: 0, won: false })) ===
        undefined &&
      waitingFestival(at(9)) === undefined,
    "B14: the Kitchen points at an open festival never played (only one that can be played)",
  );
}

console.log("C. The boxes on the screen");
// every row of the pace table, and every stage's own pace (developer 2026-11-28)
const CHECKED = [
  ...PACES,
  ...[1, 2, 3].map((s) => paceOfStage(festivalEvent("burger")!, s)),
  ...FESTIVAL_EVENTS.flatMap((e) => [1, 2, 3].map((s) => stagePace(e.number, s))),
];
{
  const bad: string[] = [];
  const heights = [960, portraitHeight(390, 844), portraitHeight(320, 568), 1200];
  // (festivalLayout's smallest windows: 320 x 568 upright, 740 x 360 on its side)
  for (const pace of CHECKED) {
    const kitchen = burgerKitchen(pace);
    const counts = {
      atOnce: pace.atOnce,
      grill: pace.grillSlots,
      plates: pace.plates,
      trays: kitchen.trays.length,
      trayItems: kitchen.trays.map((t) => t.item),
      drinks: cookerOf(kitchen, "drink")!.slots,
    };
    const layouts: { name: string; layout: FestivalLayout; scale: number }[] = [
      ...heights.map((h) => ({
        name: `upright ${h}`,
        layout: portraitLayout(counts, h),
        scale: SMALLEST_SCALE.portrait,
      })),
      // (the landscape stage is as wide as the window: its narrowest and its widest)
      ...[WIDE.w, WIDE.maxW].map((w) => ({
        name: `wide ${w}`,
        layout: wideLayout(counts, w),
        scale: SMALLEST_SCALE.wide,
      })),
    ];
    for (const { name, layout, scale } of layouts) {
      const targets = tapTargets(layout);
      const [gx, gy, gw, gh] = layout.grillArt;
      const onGrill = layout.grill.every(
        ({ tap, food }) =>
          [tap, food].every(
            ([x, y, w, h]) =>
              x >= gx - 1 && y >= gy - 1 && x + w <= gx + gw + 1 && y + h <= gy + gh + 1,
          ) &&
          food[0] >= tap[0] - 1 &&
          food[0] + food[2] <= tap[0] + tap[2] + 1 &&
          food[1] + food[3] / 2 >= tap[1] &&
          food[1] + food[3] / 2 <= tap[1] + tap[3],
      );
      if (
        !onGrill ||
        layout.locked.length !== 4 - counts.grill ||
        layout.drink.length !== counts.drinks
      )
        bad.push(`t${pace.tier} ${name}: grill rings or drink machines`);
      if (
        layout.trays.length !== counts.trays ||
        layout.grill.length !== counts.grill ||
        layout.plates.length !== counts.plates ||
        layout.seats.length !== counts.atOnce
      )
        bad.push(`t${pace.tier} ${name}: counts`);
      for (const [x, y, w, h] of targets) {
        if (w * scale < 48 || h * scale < 48)
          bad.push(
            `t${pace.tier} ${name}: small ${Math.round(w * scale)}x${Math.round(h * scale)}`,
          );
        if (x < 0 || y < 0 || x + w > layout.w || y + h > layout.h)
          bad.push(`t${pace.tier} ${name}: outside ${x},${y}`);
      }
      for (let i = 0; i < targets.length; i++)
        for (let j = i + 1; j < targets.length; j++) {
          const [ax, ay, aw, ah] = targets[i]!;
          const [bx, by, bw, bh] = targets[j]!;
          if (
            Math.min(ax + aw, bx + bw) - Math.max(ax, bx) > 0.5 &&
            Math.min(ay + ah, by + bh) - Math.max(ay, by) > 0.5
          )
            bad.push(`t${pace.tier} ${name}: overlap ${i}/${j}`);
        }
      for (const { bubble } of layout.seats)
        if (bubble[0] < 0 || bubble[0] + bubble[2] > layout.w || bubble[1] < 0)
          bad.push(`t${pace.tier} ${name}: bubble outside`);
    }
  }
  assert(
    bad.length === 0,
    "C1: every pace, upright and wide: tap targets 48 px at the smallest window, inside the stage, none overlapping",
    bad.slice(0, 8),
  );
  // the stall (the concept image): its boards, props and coach line never cover a station, an order or the top bar
  const overlap = (a: readonly number[], b: readonly number[]) =>
    Math.min(a[0]! + a[2]!, b[0]! + b[2]!) - Math.max(a[0]!, b[0]!) > 0.5 &&
    Math.min(a[1]! + a[3]!, b[1]! + b[3]!) - Math.max(a[1]!, b[1]!) > 0.5;
  const covered: string[] = [];
  for (const pace of CHECKED) {
    const kitchen = burgerKitchen(pace);
    const counts = {
      atOnce: pace.atOnce,
      grill: pace.grillSlots,
      plates: pace.plates,
      trays: kitchen.trays.length,
      trayItems: kitchen.trays.map((t) => t.item),
      drinks: cookerOf(kitchen, "drink")!.slots,
    };
    for (const [name, layout] of [
      ...heights.map((h) => [`upright ${h}`, portraitLayout(counts, h)] as const),
      ...[WIDE.w, WIDE.maxW].map((w) => [`wide ${w}`, wideLayout(counts, w)] as const),
    ]) {
      const bar = [layout.back, layout.pause, layout.scores, layout.status];
      const boards = [layout.sign, layout.special].filter((b) => b !== null);
      const bubbles = layout.seats.map((s) => s.bubble);
      for (const board of boards)
        if ([...bar, ...bubbles].some((b) => overlap(board, b)))
          covered.push(`t${pace.tier} ${name}: a board covers the bar or an order`);
      if (bubbles.some((b) => bar.some((x) => overlap(b, x))))
        covered.push(`t${pace.tier} ${name}: an order under the top bar`);
      // (developer 2026-11-28: the landscape plate stand is decoration too, so it is held to the same rule)
      for (const piece of [
        layout.hint,
        ...layout.props.map((p) => p.box),
        ...(layout.plateStand ? [layout.plateStand] : []),
        // (developer 2026-11-28: a locked place is not tapped, so it may not lie on anything that is)
        ...layout.lockedSlots.map((slot) => slot.rect),
      ])
        if ([...tapTargets(layout), ...bubbles].some((x) => overlap(piece, x)))
          covered.push(
            `t${pace.tier} ${name}: a prop or the coach line covers ${piece[0]},${piece[1]}`,
          );
      const [rx, ry, rw, rh] = layout.rack;
      if (
        layout.powers.some(([x, y, w, h]) => x < rx || y < ry || x + w > rx + rw || y + h > ry + rh)
      )
        covered.push(`t${pace.tier} ${name}: a power-up outside its rack`);
    }
  }
  assert(
    covered.length === 0,
    "C3: the stall's sign, chalkboard, props and coach line cover no station, order or button, and the power-ups sit in their rack",
    covered.slice(0, 8),
  );
  // RULE CHANGE (developer 2026-11-28, a picture of the whole landscape screen: "make the festival stall exactly like this sorted and organised"):
  // C4 held the sizes of the arrangement before (fryers 95 x 118, a plate stand right of the board). The power-ups still sit beside Pause; now the
  // stall is sorted into fixed places.
  const moved: string[] = [];
  const middle = ([x, y, w, h]: Rect) => [x + w / 2, y + h / 2] as const;
  for (const width of [WIDE.w, WIDE.maxW]) {
    const places = new Map<string, string>();
    for (const pace of CHECKED) {
      const kitchen = burgerKitchen(pace);
      const items = kitchen.trays.map((t) => t.item);
      const l = wideLayout(
        {
          atOnce: pace.atOnce,
          grill: pace.grillSlots,
          plates: pace.plates,
          trays: items.length,
          trayItems: items,
          drinks: cookerOf(kitchen, "drink")!.slots,
        },
        width,
      );
      const last = l.powers[l.powers.length - 1]!;
      const gap = l.pause[0] - (last[0] + last[2]);
      if (l.powers.some(([, y, , h]) => y + h > 90) || gap < 0 || gap > 12)
        moved.push(`t${pace.tier}: the power-ups are not in the top bar beside Pause (gap ${gap})`);
      if (l.powers.some((p) => overlap(p, l.scores)))
        moved.push(`t${pace.tier}: a power-up covers the scores`);
      // every place is filled, by the thing itself or by its locked picture: 10 pans, 2 sauces, 3 drinks, 4 plates
      const drinks = ["cola", "lemonade", "milkshake"];
      const here: [string, Rect][] = [
        ...items.map((item, i): [string, Rect] => [item, l.trays[i]!]),
        ...l.drink.map((r, i): [string, Rect] => [drinks[i]!, r]),
        ...l.plates.map((r, i): [string, Rect] => [`plate-${i + 1}`, r]),
        ...l.lockedSlots.map((s): [string, Rect] => [
          s.kind === "plate" ? `plate-${s.number}` : s.item,
          s.rect,
        ]),
      ];
      if (here.length !== 19 || new Set(here.map(([name]) => name)).size !== 19)
        moved.push(`t${pace.tier}: ${here.length} places, not the 19 each once`);
      for (const [name, rect] of here) {
        const box = rect.map((n) => n.toFixed(1)).join();
        if (places.has(name) && places.get(name) !== box)
          moved.push(`t${pace.tier}: ${name} moved`);
        places.set(name, box);
      }
      const spot = (name: string) => middle(places.get(name)!.split(",").map(Number) as never);
      if (items.length === WIDE_PLACES.length) {
        // three by three, read left to right and top to bottom, the fries under them
        const grid = [
          "bun",
          "patty",
          "chicken",
          "veggie",
          "cheese",
          "lettuce",
          "tomato",
          "onion",
          "pickles",
        ];
        const sorted = grid.every((name, i) => {
          const [x, y] = spot(name);
          return (
            (i % 3 === 0 ||
              (x > spot(grid[i - 1]!)[0] && Math.abs(y - spot(grid[i - 1]!)[1]) < 1)) &&
            (i < 3 || (y > spot(grid[i - 3]!)[1] && Math.abs(x - spot(grid[i - 3]!)[0]) < 3)) &&
            x > l.grillArt[0] + l.grillArt[2]
          );
        });
        if (!sorted || !(spot("fries")[1] > spot("onion")[1]))
          moved.push("the pans are not three by three with the fries under them");
        // the left side's three rows: drinks, fryers and bin, the sauces
        const rows = [spot("cola")[1], middle(l.fryer[0]!)[1], spot("ketchup")[1]];
        if (
          !(rows[0]! < rows[1]! && rows[1]! < rows[2]!) ||
          !(spot("cola")[0] < spot("lemonade")[0] && spot("lemonade")[0] < spot("milkshake")[0]) ||
          !(spot("ketchup")[0] < spot("mustard")[0]) ||
          [...l.fryer, l.bin].some((r) => r[0] + r[2] > l.grillArt[0])
        )
          moved.push("the left side is not drinks, then fryers and bin, then sauces");
        if (!(l.grillArt[1] + l.grillArt[3] <= l.board[1] + 0.5))
          moved.push("the grill is not over the board of plates");
        if (
          !l.pantry ||
          !l.plateStand ||
          !overlap(l.plateStand, l.pantry) ||
          !(l.plateStand[1] > spot("onion")[1])
        )
          moved.push("the plate stand is not in the tray, under the pans");
      }
    }
  }
  assert(
    moved.length === 0,
    "C4: landscape, sorted: drinks / fryers and bin / sauces at the left, the grill over the plates, the pans three by three; every food, drink and plate keeps its place at every stage; the power-ups beside Pause",
    moved.slice(0, 8),
  );
  assert(
    wideWidth(1819, 865) === WIDE.maxW &&
      wideWidth(1280, 720) === WIDE.w &&
      wideWidth(740, 360) === 1110 &&
      wideWidth(2400, 700) === WIDE.maxW &&
      wideWidth(0, 0) === WIDE.w,
    "C5: the landscape stage is as wide as the window, from 960 units to the picture's own shape",
  );
  // what a locked place says is true: that stage is the first one that has it
  const wrong: string[] = [];
  const burger = festivalEvent("burger")!;
  for (const stage of [1, 2, 3]) {
    const kitchen = burgerKitchen(paceOfStage(burger, stage));
    const items = kitchen.trays.map((t) => t.item);
    const l = wideLayout({
      atOnce: 2,
      grill: kitchen.cookers.find((c) => c.id === "grill")!.slots,
      plates: kitchen.plates,
      trays: items.length,
      trayItems: items,
      drinks: cookerOf(kitchen, "drink")!.slots,
    });
    for (const slot of l.lockedSlots) {
      const opens =
        slot.kind === "plate"
          ? stageWithPlates(burger, slot.number)
          : stageWithFood(burger, slot.item);
      const name = slot.kind === "plate" ? `plate ${slot.number}` : slot.item;
      if (!(opens > stage && opens <= 3)) wrong.push(`stage ${stage}: ${name} says ${opens}`);
    }
    if (stage === 3 && l.lockedSlots.length !== 0) wrong.push("stage 3 still has a locked place");
  }
  assert(
    wrong.length === 0,
    "C6: a locked place names the first stage that has it, and the third stage has nothing locked",
    wrong,
  );
  // developer 2026-11-28 (a screenshot of plates over the board's front edge): "place the plates properly in the square"
  const off: string[] = [];
  const heights2 = [960, portraitHeight(390, 844), 1200];
  for (const pace of CHECKED) {
    const kitchen = burgerKitchen(pace);
    const counts = {
      atOnce: pace.atOnce,
      grill: pace.grillSlots,
      plates: pace.plates,
      trays: kitchen.trays.length,
      trayItems: kitchen.trays.map((t) => t.item),
      drinks: cookerOf(kitchen, "drink")!.slots,
    };
    for (const [name, l] of [
      ...heights2.map((h) => [`upright ${h}`, portraitLayout(counts, h)] as const),
      ...[WIDE.w, WIDE.maxW].map((w) => [`wide ${w}`, wideLayout(counts, w)] as const),
    ]) {
      const [bx, by, bw, bh] = l.board;
      const faces = [
        ...l.plateFaces,
        ...l.lockedSlots.flatMap((s) => (s.kind === "plate" ? [s.face] : [])),
      ];
      const dishes = faces.map(([x, y, w, h]): Rect => [
        x + w * DISH_IN_FACE.left,
        y + h * DISH_IN_FACE.top,
        w * DISH_IN_FACE.width,
        h * DISH_IN_FACE.height,
      ]);
      if (l.plateFaces.length !== l.plates.length) off.push(`t${pace.tier} ${name}: faces`);
      if (by + bh > l.h) off.push(`t${pace.tier} ${name}: the board runs off the stage`);
      dishes.forEach(([x, y, w, h], i) => {
        if (
          x < bx + bw * BOARD_SURFACE.left - 0.5 ||
          x + w > bx + bw * BOARD_SURFACE.right + 0.5 ||
          y < by + bh * BOARD_SURFACE.top - 0.5 ||
          y + h > by + bh * BOARD_SURFACE.bottom + 0.5
        )
          off.push(`t${pace.tier} ${name}: plate ${i + 1} reaches onto the rim`);
        if (dishes.some((d, j) => j > i && overlap(d, [x, y, w, h])))
          off.push(`t${pace.tier} ${name}: plate ${i + 1} lies on another`);
        // the plate's own middle is inside its own tap box, so a tap on it reaches it
        const tap = l.plates[i];
        const mid = [x + w / 2, y + h / 2] as const;
        if (
          tap &&
          (mid[0] < tap[0] ||
            mid[0] > tap[0] + tap[2] ||
            mid[1] < tap[1] ||
            mid[1] > tap[1] + tap[3])
        )
          off.push(`t${pace.tier} ${name}: plate ${i + 1} is drawn away from its tap box`);
      });
    }
  }
  assert(
    off.length === 0,
    "C7: the whole board is in view and every plate lies inside its flat surface, on no other plate, its middle in its own tap box",
    off.slice(0, 8),
  );
  assert(
    portraitHeight(390, 844) === 1169 &&
      portraitHeight(320, 568) === 960 &&
      portraitHeight(768, 1024) === PORTRAIT.h &&
      portraitHeight(360, 900) === PORTRAIT.maxH,
    "C2: a tall phone's stage grows to fill it; a squarer window keeps 540 x 960",
  );
}

console.log("D. The art");
{
  const files: string[] = [];
  let total = 0;
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = `${dir}/${f}`;
      if (statSync(p).isDirectory()) walk(p);
      else {
        files.push(p.replace(/^public\/festival\//, "").replace(/\.webp$/, ""));
        total += statSync(p).size;
      }
    }
  };
  walk("public/festival");
  const missing = ALL_ART.filter((n) => !existsSync(`public/festival/${n}.webp`));
  const unused = files.filter((f) => !ALL_ART.includes(f));
  assert(
    ALL_ART.length >= 100 && missing.length === 0,
    `D1: every one of the ${ALL_ART.length} pictures the festival names exists`,
    missing,
  );
  assert(unused.length === 0, "D2: and nothing is shipped that the festival does not name", unused);
  // RULE CHANGE (developer 2026-11-27, "add the assets and everything integrate it properly"): the whole Burger kit is in (the plan's estimate was
  // 1.5-2 MB; the limit was 1200 KB while only the first 37 pictures existed). Still fetched only when the festival opens.
  assert(
    total > 0 && total < 2048 * 1024,
    `D3: together they weigh ${Math.round(total / 1024)} KB (limit 2048 KB)`,
  );
  assert(
    /^Festival competition assets\/$/m.test(read(".gitignore")),
    "D4: the art folder is kept out of git",
  );
  const cutter = read("scripts/make-festival-assets.py");
  const cut = [...cutter.matchAll(/^LAYERS = \[(.*)\]$/gm)][0]?.[1]?.split(",").length ?? 0;
  assert(
    /SINGLES: dict/.test(cutter) && cut === Object.keys(LAYERS).length,
    "D5: the pictures are cut by scripts/make-festival-assets.py, one burger layer for each the game draws",
  );
  const strays = readdirSync("src/components/kc/festival").filter((f) =>
    /festivalUrl\("/.test(read(`src/components/kc/festival/${f}`)),
  );
  assert(
    strays.length === 0,
    "D6: no screen names a picture outside the one list (festivalArt.ts)",
    strays,
  );
  const screen = read("src/components/kc/festival/FestivalGame.tsx");
  // RULE CHANGE (developer 2026-11-28): a plate is stacked in its festival's own order; a pizza lies flat (it is not held apart)
  assert(
    /parts=\{sortParts\(parts, menu\)\}/.test(screen) &&
      /spread=\{wanted \|\| menu\.bake \? 1 : OPEN_SPREAD\}/.test(screen),
    "D7: a plate draws its parts in a burger's order (a topping tapped before the meat is not hidden under it), held apart until someone wants it",
  );
}

console.log("E. Wiring");
{
  const router = read("src/ScreensRouter.tsx");
  const app = read("src/App.tsx");
  assert(
    read("src/components/kc/data.ts").includes('| "festival"') &&
      /screen === "festival" \? \(/.test(router) &&
      /<FestivalScreen/.test(router) &&
      /import\("@\/components\/kc\/restaurantScreens"\)/.test(router),
    "E1: its own screen, in the lazy restaurant chunk",
  );
  assert(
    /query\.get\("festival"\)/.test(router) &&
      /festivalPreviewAsked/.test(app) &&
      /!previewing && shouldRunIntro/.test(app),
    "E2: the preview link ?festival=1 (&pace=1-15) opens a round, without the intro",
  );
  assert(
    /s === "festival" &&\s*RESTAURANT_MODE[\s\S]{0,200}< FESTIVAL_FIRST_LEVEL/.test(app) &&
      /Festival Competition opens \$\{unlockText/.test(app),
    "E3: it cannot be opened below Level 10, and the lock says services",
  );
  const result = app.slice(
    app.indexOf("function festivalResult("),
    app.indexOf("function carParkAction("),
  );
  assert(
    /persist\(recordFestivalRound\(current, result\.eventId, result\)\)/.test(result) &&
      !/appendLedgerEntry|credits/.test(result),
    "E4: a finished round is recorded, and nothing is paid",
  );
  assert(
    /withFestivalBaseline\(served, lifetimeOrdersOf\(save\)\)/.test(app),
    "E5: the first Endless Restaurant order starts the after-campaign count",
  );
  const sheet = read("src/components/kc/MiniGamesSheet.tsx");
  assert(
    /data-testid="mg-festival"/.test(sheet) &&
      /go\("festival"\)/.test(sheet) &&
      /RESTAURANT_MODE \? \(/.test(sheet),
    "E6: the Mini-games sheet has the Festival card (restaurant game only)",
  );
  const game = read("src/components/kc/festival/FestivalGame.tsx");
  assert(
    /PauseManager\.subscribe\(setHeld\)/.test(game) &&
      /paused \|\| held \|\| phase !== "play"/.test(game) &&
      /Math\.min\(100, now - last\)/.test(game),
    "E7: the round waits for the platform's and ads' pause, and a hidden tab never makes food jump",
  );
  assert(
    !/visibilitychange|document\.hidden|sessionStorage|localStorage/.test(
      game + read("src/components/kc/festival/FestivalScreen.tsx"),
    ),
    "E8: no Page Visibility API or browser storage",
  );
  const host = read("src/components/kc/festival/FestivalScreen.tsx");
  assert(
    /playing\.stage !== null && playing\.stage <= openStage\(playing\.event\) \? playing\.stage : 0/.test(
      host,
    ),
    "E11: only an open stage counts as cleared (the preview link never skips ahead)",
  );
  const select = read("src/components/kc/festival/FestivalSelect.tsx");
  assert(
    /useUnlockText\(\)/.test(select) &&
      /unlock\.when\(status\.level\)/.test(select) &&
      !/Level \$\{/.test(select),
    "E9: a locked festival says what opens it in the game's own words, never a level number",
  );
  let changed = "";
  try {
    changed = execSync(
      'git diff --name-only HEAD -- "src/game/business/dessert*" "src/components/kc/inventory/dessert*" "src/components/kc/inventory/DessertRunGame.tsx"',
      { encoding: "utf8" },
    ).trim();
  } catch {
    changed = "git unavailable";
  }
  assert(changed === "", "E10: Dessert Run is untouched", changed);
}

console.log(failures ? `\nFESTIVAL SAVE QA: ${failures} FAILED` : "\nFESTIVAL SAVE QA: ALL PASS");
process.exit(failures ? 1 : 0);
