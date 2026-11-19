// Kitchen Dispatch (developer 2026-11-17, rebuilt the same day on the sliding-block "door" mechanism), restaurant build, real
// browser: business/crateDispatch.ts + components/kc/inventory/KitchenDispatchGame.tsx. Opened with ?kitchenDispatch=<level>
// (a developer preview; also on the Kitchen's Mini-games sheet). The rules and every board are proved by
// scripts/crate-dispatch-qa.mts; this checks the screen that runs them, with real mouse drags.
//   K1 Level 18: a 9:16 stage inside the phone, a level badge, a clock, the crates counted, four boosters (2 / 2 / 2 / 3)
//   K2 dragging a crate moves it, one cell at a time, and counts a move; it cannot go through a dark block or another crate
//   K3 Freeze holds the clock for 10 seconds and costs one
//   K4 Undo puts the last drag back and costs one
//   K5 Rocket sends a tapped crate out; Hammer smashes a tapped dark block
//   K6 pause: Resume, Restart and Leave; the clock stands still; Resume closes the card
//   K7 dragging every crate to its gate wins: stars, moves, Next dispatch and Leave
//   K8 doing nothing until the clock runs out: Time is up, Try again is the same counter with the full clock
//   K9 five phone sizes x Levels 18, 46 and 91 (5x5, 7x7, 8x8): no sideways scroll, every button 48 px, the stage inside the screen
//   K10 Back leaves the game
//   K11 no console errors
// Screenshots: out/kitchendispatch-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  seedSave,
  sleep,
  shot,
  SAVE_KEY,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const saveAt = (n) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
const GAME = '[data-testid="kitchen-dispatch-game"]';

async function open(level, w = 390, h = 844) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(`${base}?kitchenDispatch=${level}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.bridge, { timeout: 20000 });
  await page.evaluate(
    async (s, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    saveAt(level),
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(GAME, { timeout: 20000 });
  // The Playgama loading overlay covers the screen for the first moments; taps before it goes miss.
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(500);
}
const data = (name) => page.$eval(GAME, (e, n) => e.dataset[n], name);
const text = (id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent);
const crates = async () => Number(await data("crates"));
const seconds = async () => {
  const [m, s] = (await text("kd-time")).trim().split(":").map(Number);
  return m * 60 + s;
};
const num = async (id) => Number((await text(id)).trim());

/** The board as the screen shows it: crates, dark blocks and gates, in cells. */
const board = async () => {
  const b = JSON.parse(await data("board"));
  return {
    cols: b.cols,
    bricks: b.bricks.map(([id, x, y, w, h, color]) => ({ id, x, y, w, h, color })),
    walls: b.walls.map(([id, x, y, w, h]) => ({ id, x, y, w, h })),
    gates: b.gates.map(([id, side, at, span, color]) => ({ id, side, at, span, color })),
  };
};
const touches = (b, g, x, y, w, h) => {
  const horizontal = g.side === "left" || g.side === "right";
  const from = horizontal ? y : x;
  const to = from + (horizontal ? h : w);
  if (from < g.at || to > g.at + g.span) return false;
  return g.side === "left"
    ? x === 0
    : g.side === "right"
      ? x + w === b.cols
      : g.side === "top"
        ? y === 0
        : y + h === b.cols;
};
/** The cells a crate goes through to reach its gate (breadth first, the others standing still), or null. */
function pathOut(b, brick) {
  const free = (x, y) => {
    if (x < 0 || y < 0 || x + brick.w > b.cols || y + brick.h > b.cols) return false;
    const hit = (o) => x < o.x + o.w && o.x < x + brick.w && y < o.y + o.h && o.y < y + brick.h;
    return !b.walls.some(hit) && !b.bricks.some((o) => o.id !== brick.id && hit(o));
  };
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(brick.x, brick.y), null]]);
  const queue = [[brick.x, brick.y]];
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    if (b.gates.some((g) => g.color === brick.color && touches(b, g, x, y, brick.w, brick.h))) {
      const path = [];
      for (let k = key(x, y); k; k = prev.get(k)) path.unshift(k.split(",").map(Number));
      return path;
    }
    for (const [sx, sy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + sx;
      const ny = y + sy;
      if (prev.has(key(nx, ny)) || !free(nx, ny)) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}
const GRID = { x: 40 + (460 * 70) / 1080, y: 292 + (460 * 70) / 1080, size: (460 * 940) / 1080 };
/** Page pixels of the middle of a grid cell. */
async function cellPoint(cols, cx, cy) {
  const box = await (await page.$('[data-testid="kd-canvas"]')).boundingBox();
  const cell = GRID.size / cols;
  return {
    x: box.x + ((GRID.x + (cx + 0.5) * cell) / 540) * box.width,
    y: box.y + ((GRID.y + (cy + 0.5) * cell) / 960) * box.height,
  };
}
/** Presses the crate's top-left cell and drags the finger along `cells` (top-left cells, one after another), then lets go. */
async function dragAlong(b, brick, cells, { release = true } = {}) {
  const start = await cellPoint(b.cols, brick.x, brick.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of cells) {
    const p = await cellPoint(b.cols, x, y);
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await sleep(40);
  }
  if (release) await page.mouse.up();
}
/** Takes the first crate that has a way to its gate out, by dragging. Returns what happened, or null when nothing can leave. */
async function dragOneOut() {
  const b = await board();
  for (const brick of b.bricks) {
    const path = pathOut(b, brick);
    if (!path) continue;
    await dragAlong(b, brick, path.slice(1));
    await sleep(250);
    return { id: brick.id, steps: path.length - 1 };
  }
  return null;
}
/** A crate and one cell next to it that it can move into without leaving, for a plain drag. */
function easyMove(b) {
  const fits = (brick, x, y) => {
    if (x < 0 || y < 0 || x + brick.w > b.cols || y + brick.h > b.cols) return false;
    const hit = (o) => x < o.x + o.w && o.x < x + brick.w && y < o.y + o.h && o.y < y + brick.h;
    return !b.walls.some(hit) && !b.bricks.some((o) => o.id !== brick.id && hit(o));
  };
  for (const brick of b.bricks)
    for (const [sx, sy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const x = brick.x + sx;
      const y = brick.y + sy;
      if (!fits(brick, x, y)) continue;
      if (b.gates.some((g) => g.color === brick.color && touches(b, g, x, y, brick.w, brick.h)))
        continue;
      return { brick, to: [x, y] };
    }
  return null;
}

// K1
await open(18);
const k1 = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="kd-canvas"]').getBoundingClientRect();
  return {
    ratio: Math.round((c.width / c.height) * 1000) / 1000,
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    top: Math.round(c.top),
    bottom: Math.round(c.bottom),
    ih: innerHeight,
  };
});
const n0 = await crates();
const t0 = await seconds();
const b0 = await board();
check(
  "K1 Level 18: a 9:16 stage inside the phone, the level on its badge, the clock, the crates counted, four boosters",
  Math.abs(k1.ratio - 0.5625) < 0.01 &&
    k1.sw <= k1.iw &&
    k1.top >= 0 &&
    k1.bottom <= k1.ih &&
    (await text("kd-level")).trim() === "18" &&
    n0 >= 5 &&
    n0 <= 6 &&
    b0.bricks.length === n0 &&
    b0.gates.length === 3 &&
    t0 <= 40 + n0 * 9 &&
    t0 >= 40 + n0 * 9 - 4 &&
    (await num("kd-booster-freeze-n")) === 2 &&
    (await num("kd-booster-rocket-n")) === 2 &&
    (await num("kd-booster-hammer-n")) === 2 &&
    (await num("kd-booster-undo-n")) === 3,
  { k1, n0, t0, gates: b0.gates.length },
);
await shot(page, "kitchendispatch-start");

// K2: a plain drag
const move = easyMove(b0);
let k2 = { found: !!move };
if (move) {
  await dragAlong(b0, move.brick, [move.to]);
  await sleep(300);
  const after = await board();
  const now = after.bricks.find((x) => x.id === move.brick.id);
  k2 = {
    ...k2,
    from: [move.brick.x, move.brick.y],
    to: [now.x, now.y],
    wanted: move.to,
    moves: Number(await data("moves")),
  };
  // a crate cannot be dragged through a dark block: push the same crate hard at a wall cell
  const wall = after.walls[0];
  const wallCell = [wall.x, wall.y];
  const from2 = { ...now };
  await dragAlong(after, now, [wallCell]);
  await sleep(250);
  const after2 = await board();
  const again = after2.bricks.find((x) => x.id === move.brick.id);
  const overlaps =
    again &&
    again.x < wall.x + wall.w &&
    wall.x < again.x + again.w &&
    again.y < wall.y + wall.h &&
    wall.y < again.y + again.h;
  k2.stoppedByWall = !overlaps;
  k2.after2 = again ? [again.x, again.y] : null;
  k2.from2 = [from2.x, from2.y];
}
check(
  "K2 dragging a crate moves it to the cell under the finger and counts a move; it never goes through a dark block",
  k2.found &&
    k2.to?.[0] === k2.wanted[0] &&
    k2.to?.[1] === k2.wanted[1] &&
    k2.moves === 1 &&
    k2.stoppedByWall,
  k2,
);

// K3: Freeze
await open(18);
const tBefore = await seconds();
await page.click('[data-testid="kd-booster-freeze"]');
await sleep(300);
const frozenFlag = (await data("frozen")) === "true";
const tMid = await seconds();
await sleep(2600);
const tEnd = await seconds();
check(
  "K3 Freeze holds the clock for 10 seconds and costs one",
  frozenFlag && (await num("kd-booster-freeze-n")) === 1 && tEnd === tMid && tMid >= tBefore - 1,
  { tBefore, tMid, tEnd, frozenFlag },
);

// K4: Undo
await open(18);
const bU = await board();
const mU = easyMove(bU);
let k4 = { found: !!mU };
if (mU) {
  await dragAlong(bU, mU.brick, [mU.to]);
  await sleep(300);
  const moved = (await board()).bricks.find((x) => x.id === mU.brick.id);
  await page.click('[data-testid="kd-booster-undo"]');
  await sleep(400);
  const back = (await board()).bricks.find((x) => x.id === mU.brick.id);
  k4 = {
    ...k4,
    moved: [moved.x, moved.y],
    back: [back.x, back.y],
    start: [mU.brick.x, mU.brick.y],
    undos: await num("kd-booster-undo-n"),
  };
}
check(
  "K4 Undo puts the last drag back and costs one",
  k4.found &&
    k4.back[0] === k4.start[0] &&
    k4.back[1] === k4.start[1] &&
    (k4.moved[0] !== k4.start[0] || k4.moved[1] !== k4.start[1]) &&
    k4.undos === 2,
  k4,
);

// K5: Rocket and Hammer
await open(18);
const bR = await board();
await page.click('[data-testid="kd-booster-rocket"]');
await sleep(250);
const armedRocket = await data("armed");
const target = bR.bricks[0];
const tp = await cellPoint(bR.cols, target.x, target.y);
await page.mouse.click(tp.x, tp.y);
await sleep(600);
const afterRocket = await board();
await page.click('[data-testid="kd-booster-hammer"]');
await sleep(250);
const armedHammer = await data("armed");
const wallR = afterRocket.walls[0];
const wp = await cellPoint(afterRocket.cols, wallR.x, wallR.y);
await page.mouse.click(wp.x, wp.y);
await sleep(500);
const afterHammer = await board();
const k5 = {
  armedRocket,
  armedHammer,
  crates: [bR.bricks.length, afterRocket.bricks.length],
  walls: [afterRocket.walls.length, afterHammer.walls.length],
  rocketN: await num("kd-booster-rocket-n"),
  hammerN: await num("kd-booster-hammer-n"),
};
check(
  "K5 Rocket sends a tapped crate out; Hammer smashes a tapped dark block; each costs one",
  armedRocket === "rocket" &&
    armedHammer === "hammer" &&
    k5.crates[1] === k5.crates[0] - 1 &&
    k5.walls[1] === k5.walls[0] - 1 &&
    k5.rocketN === 1 &&
    k5.hammerN === 1,
  k5,
);

// K6: pause
await open(18);
await page.click('[data-testid="kd-pause"]');
await sleep(300);
const k6 = {
  overlay: await page.$('[data-testid="kd-overlay"]').then(Boolean),
  resume: await page.$('[data-testid="kd-resume"]').then(Boolean),
  restart: await page.$('[data-testid="kd-restart"]').then(Boolean),
  leave: await page.$('[data-testid="kd-leave"]').then(Boolean),
};
const s6 = await seconds();
await sleep(2200);
const still = (await seconds()) === s6;
await page.click('[data-testid="kd-resume"]');
await sleep(300);
k6.closed = !(await page.$('[data-testid="kd-overlay"]'));
check(
  "K6 pause: Resume, Restart and Leave; the clock stands still; Resume closes the card",
  k6.overlay && k6.resume && k6.restart && k6.leave && k6.closed && still,
  { ...k6, still },
);

// K7: drag every crate to its gate
await open(18);
const total = await crates();
let drags = 0;
for (let guard = 0; guard < 40 && (await crates()) > 0; guard++) {
  const r = await dragOneOut();
  if (!r) break;
  drags += 1;
}
await sleep(1200);
const phase7 = await data("phase");
if (phase7 === "won") {
  const k7 = {
    total,
    drags,
    stars: await page.$('[data-testid="kd-result"]').then(Boolean),
    next: await page.$('[data-testid="kd-next"]').then(Boolean),
    leave: await page.$('[data-testid="kd-leave"]').then(Boolean),
    picture: await page.$('[data-testid="kd-picture"]').then(Boolean),
    result: (await text("kd-result")).replace(/\s+/g, " ").trim(),
  };
  await shot(page, "kitchendispatch-win");
  check(
    "K7 dragging every crate to its gate wins: stars, time left and moves, the picture, Next dispatch and Leave",
    k7.stars && k7.next && k7.leave && k7.picture && /moves?/.test(k7.result) && drags >= total,
    k7,
  );
} else check("K7 the counter was cleared", false, { phase: phase7, drags, left: await crates() });

// K8: out of time
await open(18);
const crates8 = await crates();
const full8 = await seconds();
const t8 = Date.now();
while (Date.now() - t8 < 130_000 && (await data("phase")) !== "lost") await sleep(1000);
const lost = (await data("phase")) === "lost";
if (lost) {
  await shot(page, "kitchendispatch-lost");
  await page.click('[data-testid="kd-restart"]');
  await sleep(500);
  check(
    "K8 out of time: Time is up; Try again is the same counter with the full clock",
    (await data("phase")) === "play" &&
      (await crates()) === crates8 &&
      (await seconds()) >= full8 - 1,
    { crates8, full8, now: await seconds() },
  );
} else check("K8 the clock ran out", false, { phase: await data("phase") });

// K9
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
]) {
  for (const level of [18, 46, 91]) {
    await open(level, w, h);
    const m = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="kd-canvas"]').getBoundingClientRect();
      const small = [...document.querySelectorAll('[data-testid="kitchen-dispatch-game"] button')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 47.5 || r.height < 47.5)).length;
      return {
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
        small,
        top: c.top,
        bottom: c.bottom,
        left: c.left,
        right: c.right,
        ih: innerHeight,
      };
    });
    check(
      `K9 Level ${level} at ${w} x ${h}: no sideways scroll, 48 px buttons, the stage inside the screen`,
      m.sw <= m.iw &&
        m.small === 0 &&
        m.top >= -1 &&
        m.bottom <= m.ih + 1 &&
        m.left >= -1 &&
        m.right <= m.iw + 1,
      m,
    );
    if (level === 91 && w === 320) await shot(page, "kitchendispatch-91-320");
    if (level === 91 && w === 390) await shot(page, "kitchendispatch-91-390");
    if (level === 46 && w === 390) await shot(page, "kitchendispatch-46-390");
  }
}

// K10
await open(18);
await page.click('[data-testid="kd-back"]');
await sleep(800);
check("K10 Back leaves the game", !(await page.$(GAME)), {});

check(
  "K11 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nKITCHEN DISPATCH: ALL PASS");
process.exit(failed.length ? 1 : 0);
