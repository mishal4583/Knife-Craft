// Dessert Run (developer 2026-11-16: waiters fetch cubes of a hand-made dessert for four guests; replaces the
// Plating Belt), restaurant build, real browser: business/dessertRun.ts + components/kc/inventory/DessertRunGame.tsx.
// Opened with ?dessertRun=<level> (developer preview; not in the daily routine yet). The rules and every shipped
// plate are proved by scripts/dessert-run-qa.mts; this checks the screen that runs them.
//   D1 Level 18: a 9:16 stage inside the phone, the dessert name, nothing served yet, no sideways scroll
//   D2 a tap on a lane sends a waiter: cubes begin to reach the guests
//   D3 pause: Resume, Restart, Leave; play stands still; Resume closes the card
//   D4 a jam offers Try again and Leave; Try again is the same plate from the start (only when a round jams)
//   D5 a winning round shows stars, how many waited, Next dessert and Leave (some plate is won by careless play)
//   D6 five phone sizes x Levels 18, 54 and 91 (3, 4 and 5 lanes): no sideways scroll, every header button 48 px, the stage inside the screen
//   D7 Back leaves the game
//   D8 no console errors
//   D10 every dessert's picture, decoded in the browser, cube by cube: a dessert cube is full (no board shows through it) and a board cube empty (developer 2026-11-26: what you see is what a
//      waiter takes). D6 also checks that the header shows the dessert's name and the count in full at every phone size (it was cut off at 320 px).
//   D9 a WIDE window (developer 2026-11-20: 1280 x 720, 1917 x 912, a phone on its side 844 x 390) gets the LANDSCAPE board: a 16:9 canvas that fills the window on the Codex
//      room (no 9:16 stage, no side copies, no "turn your phone" card), 48 px buttons, no sideways scroll; a tap on a waiter's COLUMN sends it and cubes reach the guests;
//      careless play there still ends in a result card
// Screenshots: out/dessertrun-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { readFileSync } from "node:fs";
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
const GAME = '[data-testid="dessert-run-game"]';

async function open(level, w = 390, h = 844) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(`${base}?dessertRun=${level}`, { waitUntil: "domcontentloaded" });
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
    {
      timeout: 20000,
    },
  );
  await sleep(300);
}
const attr = (name) => page.$eval(GAME, (e, n) => e.dataset[n], name);
const text = (id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent);
const served = async () => Number((await text("dr-count")).split("/")[0]);
async function laneClick(lane, lanes = 3) {
  const box = await (await page.$('[data-testid="dr-canvas"]')).boundingBox();
  const w = (540 - 32 - 8 * (lanes - 1)) / lanes;
  const sx = 16 + lane * (w + 8) + w / 2;
  await page.mouse.click(box.x + (sx / 540) * box.width, box.y + (805 / 960) * box.height);
}
/** Careless play: tap every lane over and over until a result card shows or the time is up. */
async function carelessUntilResult(lanes, ms = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await attr("phase")) !== "play") return attr("phase");
    for (let l = 0; l < lanes; l++) await laneClick(l, lanes);
    await sleep(120);
  }
  return "timeout";
}
async function setSpeed(times) {
  for (let i = 0; i < 3 && (await text("dr-speed")).trim() !== `×${times}`; i++)
    await page.click('[data-testid="dr-speed"]');
}

// D1
await open(18);
const d1 = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="dr-canvas"]').getBoundingClientRect();
  return {
    ratio: Math.round((c.width / c.height) * 1000) / 1000,
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    top: Math.round(c.top),
    bottom: Math.round(c.bottom),
    ih: innerHeight,
  };
});
const name1 = (await text("dr-name")).replace(/\s+/g, " ").trim();
check(
  "D1 Level 18: a 9:16 stage inside the phone, the dessert name, nothing served yet, no sideways scroll",
  Math.abs(d1.ratio - 0.5625) < 0.01 &&
    d1.sw <= d1.iw &&
    d1.top >= 0 &&
    d1.bottom <= d1.ih &&
    // RULE CHANGE (developer 2026-11-26, the 50-level list from the reference sheets): below the first Dessert Run level the list's first dessert is played, named "Biscuit" on the sheet
    // (it was "Cookie" or "Donut" when a tier rotated three desserts).
    /^Biscuit\s*0\/\d+$/.test(name1) &&
    (await attr("tier")) === "1",
  { d1, name1 },
);
await shot(page, "dessertrun-start");

// D2
await laneClick(0);
await laneClick(1);
await laneClick(2);
await sleep(4500);
const n2 = await served();
check("D2 a tap on a lane sends a waiter: cubes reach the guests", n2 > 0, { served: n2 });
await shot(page, "dessertrun-mid");

// D3
await page.click('[data-testid="dr-pause"]');
await sleep(300);
const d3 = {
  overlay: await page.$('[data-testid="dr-overlay"]').then(Boolean),
  resume: await page.$('[data-testid="dr-resume"]').then(Boolean),
  restart: await page.$('[data-testid="dr-restart"]').then(Boolean),
  leave: await page.$('[data-testid="dr-leave"]').then(Boolean),
};
const before = await served();
await sleep(1500);
const frozen = (await served()) === before;
await page.click('[data-testid="dr-resume"]');
await sleep(300);
d3.closed = !(await page.$('[data-testid="dr-overlay"]'));
check(
  "D3 pause: Resume, Restart and Leave; play stands still, Resume closes the card",
  d3.overlay && d3.resume && d3.restart && d3.leave && d3.closed && frozen,
  { ...d3, frozen },
);

// D4 / D5
await setSpeed(4);
let won = false;
let sawJam = false;
let tries = 0;
const dessertSeen = await attr("dessert");
while (tries < 8 && !won) {
  tries += 1;
  const phase = await carelessUntilResult(3);
  if (phase === "won") {
    won = true;
    const d5 = {
      stars: await page.$('[data-testid="dr-result"]').then(Boolean),
      next: await page.$('[data-testid="dr-next"]').then(Boolean),
      leave: await page.$('[data-testid="dr-leave"]').then(Boolean),
      result: (await text("dr-result")).replace(/\s+/g, " ").trim(),
    };
    await shot(page, "dessertrun-win");
    check(
      "D5 a winning round shows stars, how many waited, Next dessert and Leave",
      d5.stars && d5.next && d5.leave && /waiting at once/.test(d5.result),
      d5,
    );
  } else if (phase === "jam") {
    sawJam = true;
    await shot(page, "dessertrun-jam");
    const d4 = {
      restart: await page.$('[data-testid="dr-restart"]').then(Boolean),
      leave: await page.$('[data-testid="dr-leave"]').then(Boolean),
    };
    await page.click('[data-testid="dr-restart"]');
    await sleep(500);
    const again = {
      phase: await attr("phase"),
      served: await served(),
      dessert: await attr("dessert"),
    };
    check(
      "D4 a jam offers Try again and Leave; Try again is the same plate from the start",
      d4.restart &&
        d4.leave &&
        again.phase === "play" &&
        again.served === 0 &&
        again.dessert === dessertSeen,
      { d4, again },
    );
  } else {
    check("D4 careless play reaches a result", false, { phase });
    break;
  }
}
if (!won) check("D5 some careless round is won", false, { tries });
if (!sawJam) {
  // A jam is rare on tier 1; Level 91 (five lanes, the hardest plates) jams often under careless play.
  await open(91);
  await setSpeed(4);
  for (let t = 0; t < 6 && !sawJam; t += 1) {
    const phase = await carelessUntilResult(5);
    if (phase === "jam") {
      sawJam = true;
      await shot(page, "dessertrun-jam");
      const d4 = {
        restart: await page.$('[data-testid="dr-restart"]').then(Boolean),
        leave: await page.$('[data-testid="dr-leave"]').then(Boolean),
      };
      // the plate that jammed (a won round before it moves on to the next plate, so the one read at the start may be an older one)
      const jammedDessert = await attr("dessert");
      await page.click('[data-testid="dr-restart"]');
      await sleep(500);
      const again = {
        phase: await attr("phase"),
        served: await served(),
        dessert: await attr("dessert"),
      };
      check(
        "D4 a jam offers Try again and Leave; Try again is the same plate from the start",
        d4.restart &&
          d4.leave &&
          again.phase === "play" &&
          again.served === 0 &&
          again.dessert === jammedDessert,
        { d4, again },
      );
    } else if (phase === "won") {
      await page.click('[data-testid="dr-next"]');
      await sleep(400);
    } else break;
  }
  if (!sawJam) check("D4 a careless round at Level 91 jams within six plates", false, {});
}

// D6
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
]) {
  // 81 is Mango Mousse Cake, one of the longest names
  for (const level of [18, 54, 81, 91]) {
    await open(level, w, h);
    const m = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="dr-canvas"]').getBoundingClientRect();
      const small = [...document.querySelectorAll('[data-testid="dessert-run-game"] header button')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width < 47.5 || r.height < 47.5).length;
      const name = document.querySelector('[data-testid="dr-dessert"]');
      const count = document.querySelector('[data-testid="dr-count"]');
      const box = name.closest("div").getBoundingClientRect();
      const cr = count.getBoundingClientRect();
      return {
        // the header: the whole name and the count show, in a box no taller than three short lines
        nameCut: name.scrollWidth > name.clientWidth + 1,
        countIn: cr.width > 0 && cr.right <= box.right + 0.5 && cr.bottom <= box.bottom + 0.5,
        boxH: Math.round(box.height),
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
      `D6 Level ${level} at ${w} x ${h}: no sideways scroll, 48 px header buttons, the stage inside the screen, the name and count in full`,
      !m.nameCut &&
        m.countIn &&
        m.boxH <= 64 &&
        m.sw <= m.iw &&
        m.small === 0 &&
        m.top >= -1 &&
        m.bottom <= m.ih + 1 &&
        m.left >= -1 &&
        m.right <= m.iw + 1,
      m,
    );
    if (level === 91 && w === 320) await shot(page, "dessertrun-91-320");
  }
}

// D9: the wide windows
// RULE CHANGE 2026-11-20 (developer's mock-up): on the landscape board a lane is a COLUMN of the cabinet's queue (it was a row): columns start at x 512, 400 wide, 6 apart
const rowTap = async (lane, lanes = 3) => {
  const box = await (await page.$('[data-testid="dr-canvas"]')).boundingBox();
  const w = (400 - 6 * (lanes - 1)) / lanes;
  const x = 512 + lane * (w + 6) + w / 2;
  await page.mouse.click(box.x + (x / 960) * box.width, box.y + (305 / 540) * box.height);
};
for (const [w, h] of [
  [1280, 720],
  [1917, 912],
  [844, 390],
]) {
  await open(20, w, h);
  const m = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="dr-canvas"]').getBoundingClientRect();
    const small = [...document.querySelectorAll('[data-testid="dessert-run-game"] button')]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.width < 47.5 || r.height < 47.5)).length;
    const room = document.querySelector('[data-testid="dr-room"]')?.getBoundingClientRect();
    return {
      ratio: Math.round((c.width / c.height) * 1000) / 1000,
      sw: document.documentElement.scrollWidth,
      iw: innerWidth,
      small,
      room: room ? [Math.round(room.width), Math.round(room.height)] : null,
      sides: !!document.querySelector('[data-testid="stage-sides"]'),
      card: !!document.querySelector('[data-testid="dr-upright"]'),
      fills: Math.abs(c.width - innerWidth) < 2 || Math.abs(c.height - innerHeight) < 2,
    };
  });
  check(
    `D9 Level 20 at ${w} x ${h}: the landscape board (16:9) fills the window on the Codex room, no side copies, no card, 48 px buttons, no sideways scroll`,
    Math.abs(m.ratio - 1.778) < 0.01 &&
      m.room?.[0] === w &&
      m.room?.[1] === h &&
      !m.sides &&
      !m.card &&
      m.fills &&
      m.small === 0 &&
      m.sw <= m.iw,
    m,
  );
  if (w === 1917) await shot(page, "dessertrun-wide-1917");
  await setSpeed(4);
  for (let l = 0; l < 3; l++) {
    await rowTap(l);
    await sleep(150);
  }
  await sleep(2500);
  check(
    `D9 a tap on a waiter's column at ${w} x ${h} sends it: cubes reach the guests`,
    (await served()) > 0,
    { served: await served() },
  );
}
await open(20, 1280, 720);
await setSpeed(4);
const wideStart = Date.now();
let widePhase = "play";
while (Date.now() - wideStart < 120_000 && widePhase === "play") {
  for (let l = 0; l < 3; l++) await rowTap(l);
  await sleep(120);
  widePhase = await attr("phase");
}
check("D9 careless play on the landscape board reaches a result card", widePhase !== "play", {
  widePhase,
});

// D7
await open(18);
await page.click('[data-testid="dr-back"]');
await sleep(800);
check("D7 Back leaves the game", !(await page.$(GAME)), {});

// D10: the pictures themselves, as the browser decodes them
const ladderText = readFileSync(
  new URL("../../src/game/business/dessertLadderArt.ts", import.meta.url),
  "utf8",
);
const ladder = JSON.parse(ladderText.match(/\/\/ data: (\{.*\})\r?\n/)[1]);
const rows = Object.fromEntries(Object.entries(ladder).map(([id, v]) => [id, v.rows]));
const pictures = await page.evaluate(async (all) => {
  const bad = [];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 448;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  for (const [id, grid] of Object.entries(all)) {
    const img = new Image();
    img.src = new URL(`business/dessertrun/desserts/${id}.webp`, location.href).href;
    await img.decode();
    ctx.clearRect(0, 0, 448, 448);
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, 448, 448).data;
    for (let y = 0; y < 28; y++)
      for (let x = 0; x < 28; x++) {
        let low = 255;
        let high = 0;
        for (let v = y * 16; v < y * 16 + 16; v++)
          for (let u = x * 16; u < x * 16 + 16; u++) {
            const a = px[(v * 448 + u) * 4 + 3];
            low = Math.min(low, a);
            high = Math.max(high, a);
          }
        if (grid[y][x] === "." ? high > 40 : low < 215)
          bad.push(
            `${id} ${x},${y} ${grid[y][x] === "." ? "board shows picture" : "dessert cube see-through"}`,
          );
      }
  }
  return { count: Object.keys(all).length, bad: bad.length, first: bad.slice(0, 5) };
}, rows);
check(
  "D10 all 50 pictures, cube by cube: dessert cubes full, board cubes empty",
  pictures.count === 50 && pictures.bad === 0,
  pictures,
);

check(
  "D8 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nDESSERT RUN: ALL PASS");
process.exit(failed.length ? 1 : 0);
