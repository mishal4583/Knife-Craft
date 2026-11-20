// Screens with only a portrait painting keep their ORIGINAL size (developer 2026-11-19: "find all the areas that can't be converted to landscape because there are
// no landscape assets and make them back to the original size; only keep the areas that need no asset in landscape"), restaurant build, real browser:
//   P1 at 1280 x 720 and 1920 x 1080 the Kitchen, Market and Business fill the window (data-game-frame="full"): they need no portrait painting
//   P2 at 1280 x 720 Dessert Run and Unload the Van fill the window with their LANDSCAPE board (RULE CHANGE 2026-11-20, developer: "design wide versions"; they were the
//      centred 9:16 box, data-game-frame="framed"): data-game-frame="full", a 16:9 canvas on the Codex room, and Back goes to the Kitchen, which fills the window again (no remount)
//   P3 the dishwashing sink fills the window (RULE CHANGE 2026-11-20; it was the 9:16 box)
//   P4 an upright phone (390 x 844) is NOT framed in a mini-game: it keeps the whole screen, and a phone on its side (844 x 390) is not framed either
//   P5 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  seedSave,
  sleep,
  shot,
  SAVE_KEY,
  openSection,
  openShortcut,
  clickButton,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const SEEN = [
  "shop",
  "inventory",
  "rack",
  "business",
  "staff",
  "equipment",
  "second-floor",
  "restaurant",
  "menu",
  "progress",
];
const saveAt = (n, extra = {}) =>
  seedSave({
    credits: 500_000,
    business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET, sectionsSeen: SEEN, ...extra },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
const BTN = '[data-testid="minigames-shortcut"]';

async function open(save, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.bridge, { timeout: 20000 });
  await page.evaluate(
    async (s, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    save,
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(BTN, { timeout: 20000 });
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(500);
  for (let i = 0; i < 6; i++) {
    const gone = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="guide-card"]');
      if (!card) return true;
      [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Later"))?.click();
      return false;
    });
    if (gone) break;
    await sleep(600);
  }
  await sleep(300);
}

/** The shell's frame against the window. */
const frame = () =>
  page.evaluate(() => {
    const f = document.querySelector("[data-game-frame]");
    const r = f?.getBoundingClientRect();
    return {
      mode: f?.getAttribute("data-game-frame") ?? null,
      x: r?.left ?? 0,
      y: r?.top ?? 0,
      w: r?.width ?? 0,
      h: r?.height ?? 0,
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
const isFull = (f) => f.mode === "full" && f.w >= f.vw - 1 && f.h >= f.vh - 1;
const isNineSixteen = (f) =>
  f.mode === "framed" &&
  Math.abs(f.w / f.h - 540 / 960) < 0.01 &&
  Math.abs(f.x + f.w / 2 - f.vw / 2) < 1.5 &&
  Math.abs(f.y + f.h / 2 - f.vh / 2) < 1.5 &&
  f.x >= -1 &&
  f.y >= -1 &&
  f.x + f.w <= f.vw + 1 &&
  f.y + f.h <= f.vh + 1 &&
  // as large as fits: it touches the window's top and bottom, or its left and right
  (Math.abs(f.h - f.vh) < 1.5 || Math.abs(f.w - f.vw) < 1.5);

/** The landscape room behind a framed stage (developer 2026-11-20): loaded, 1440 x 810, and the right picture. */
const shellArt = () =>
  page.evaluate(async () => {
    const i = document.querySelector('[data-testid="shell-art"]');
    if (!i) return null;
    if (!i.complete)
      await new Promise((r) => {
        i.onload = r;
        i.onerror = r;
        setTimeout(r, 4000);
      });
    return { w: i.naturalWidth, h: i.naturalHeight, src: i.getAttribute("src") };
  });

async function openGame(id, testId) {
  await page.click(BTN);
  await sleep(500);
  await page.evaluate((i) => document.querySelector(`[data-testid="minigame-${i}"]`)?.click(), id);
  await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 8000 }).catch(() => null);
  await sleep(900);
  return Boolean(await page.$(`[data-testid="${testId}"]`));
}
// ---------- P1: screens that need no portrait painting fill the window ----------
const wideBad = [];
for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  await open(saveAt(91), w, h);
  // RULE CHANGE 2026-11-20 (twice): for a while the Kitchen home was the 9:16 box (the first Codex pictures kept the portrait picture in their middle); with the TRUE
  // landscape pictures it fills the window again
  const k = await frame();
  if (!isFull(k)) wideBad.push({ w, h, screen: "kitchen", k });
  for (const label of ["Market", "Business"]) {
    await openSection(page, label).catch(() => {});
    await sleep(900);
    const f = await frame();
    if (!isFull(f)) wideBad.push({ w, h, screen: label, f });
  }
}
check(
  "P1 the Kitchen, Market and Business fill the window at 1280x720 and 1920x1080 (landscape, no bars)",
  wideBad.length === 0,
  wideBad,
);

// ---------- P2: Dessert Run and Unload the Van fill the window with their landscape board ----------
// RULE CHANGE 2026-11-20 (developer: "design wide versions of Dessert Run and Unload the Van"): the last two games that were the centred 9:16 box have a landscape board now
// (`dessertRunWide.ts`, `KD_WIDE`): same rules, same levels, drawn 16:9 on their wide room. The 9:16 stage is only for an upright window.
const GAMES = [
  ["dessert-run", "dessert-run-game", "dr-back", "dr-room", "dr-canvas"],
  ["kitchen-dispatch", "kitchen-dispatch-game", "kd-back", "kd-room", "kd-canvas"],
];
const p2 = [];
const artSeen = [];
const roomOf = (roomId, canvasId) =>
  page.evaluate(
    async (r, c) => {
      const i = document.querySelector(`[data-testid="${r}"]`);
      const cv = document.querySelector(`[data-testid="${c}"]`)?.getBoundingClientRect();
      if (!i) return null;
      if (!i.complete)
        await new Promise((res) => {
          i.onload = res;
          i.onerror = res;
          setTimeout(res, 4000);
        });
      const b = i.getBoundingClientRect();
      return {
        w: i.naturalWidth,
        h: i.naturalHeight,
        src: i.getAttribute("src"),
        fillsWindow: b.width >= innerWidth - 1 && b.height >= innerHeight - 1,
        ratio: cv ? Math.round((cv.width / cv.height) * 1000) / 1000 : null,
      };
    },
    roomId,
    canvasId,
  );
for (const [id, testId, backId, roomId, canvasId] of GAMES) {
  await open(saveAt(91), 1280, 720);
  if (id === "dessert-run") await shot(page, "portraitonly-kitchen-1280");
  const opened = await openGame(id, testId);
  const f = await frame();
  const room = await roomOf(roomId, canvasId);
  artSeen.push({ id, art: room });
  await shot(page, `portraitonly-${id}-1280`);
  let backOk = true;
  let back = null;
  if (backId) {
    // the game's own Back goes to the Kitchen, which fills the window again (the same shell, nothing remounted)
    await page.click(`[data-testid="${backId}"]`);
    await sleep(900);
    back = await frame();
    backOk = isFull(back) && Boolean(await page.$('[data-testid="kitchen-rank"]'));
  }
  p2.push({ id, opened, ok: opened && isFull(f) && backOk, f, back });
}
check(
  "P2 Dessert Run and Unload the Van fill a 1280x720 window (the landscape board, no 9:16 box); after Back the Kitchen fills the window again",
  p2.every((r) => r.ok),
  p2.filter((r) => !r.ok),
);
check(
  "P6 each of the two paints its own true landscape room over the whole window with a 16:9 board on it (1600 x 900, the right file; RULE CHANGE 2026-11-20: no longer a framed stage)",
  artSeen.length === 2 &&
    artSeen.every(
      (r) =>
        r.art &&
        r.art.w === 1600 &&
        r.art.h === 900 &&
        r.art.fillsWindow &&
        Math.abs(r.art.ratio - 16 / 9) < 0.01 &&
        r.art.src.includes(
          {
            "dessert-run": "dessert-run",
            "kitchen-dispatch": "unload-the-van",
          }[r.id],
        ),
    ),
  artSeen,
);
// RULE CHANGE 2026-11-20: the converted games and the sink fill the window (landscape layout, no 9:16 box) on their own wide room
const fills = [];
for (const [id, testId] of [
  ["fridge-check", "fridge-check"],
  ["car-park", "car-park-game"],
  ["sauce", "sauce-station"],
]) {
  await open(saveAt(91), 1280, 720);
  const opened = await openGame(id, testId);
  const f = await frame();
  fills.push({ id, opened, ok: opened && isFull(f), f });
}
check(
  "P2b Fridge Check, Car Park and the Sauce Station fill a 1280x720 window (landscape layout, no 9:16 box)",
  fills.every((r) => r.ok),
  fills.filter((r) => !r.ok),
);
// one game at 1920x1080 too
await open(saveAt(91), 1920, 1080);
const big = await openGame("dessert-run", "dessert-run-game");
const bigF = await frame();
await shot(page, "portraitonly-dessert-run-1920");
check(
  "P2b the same at 1920x1080 (the landscape board fills the window)",
  big && isFull(bigF),
  bigF,
);

// ---------- P3: the dishwashing sink ----------
const SINK = { "frying-pans": 1, "dinner-plates": 2 };
// the same save as dishwashing.mjs (the old numbering, so Level 40 has no daily opening steps in front of the Pre-Service Check)
const sinkSave = seedSave({
  credits: 500_000,
  business: {
    ...MOVED_IN_BUSINESS,
    supplies: {
      stock: {
        ...MOVED_IN_BUSINESS.supplies.stock,
        "dinner-plates": { units: 24, costBasis: 2400 },
        "dinner-forks": { units: 24, costBasis: 1200 },
        "frying-pans": { units: 2, costBasis: 1868 },
        "dish-soap": { units: 2, costBasis: 3000 },
      },
    },
    restaurantSupplies: {
      soapPct: 60,
      cleanerPct: 60,
      washing: 0,
      dirty: SINK,
      washedTotal: 100,
      washedKitchen: 0,
      used: {},
      brokenTotal: 0,
    },
  },
  levelProgress: {
    currentLevelId: "level-40",
    highestUnlockedLevelId: "level-40",
    completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
  },
  story: { introDone: true, milestoneMask: 4095, finaleSeen: true },
});
await open(sinkSave, 1280, 720);
// Business > Cleanliness > the Dishwashing card's Wash (the way dishwashing.mjs step 4 reaches the sink)
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await sleep(900);
await openShortcut(page, "business");
await sleep(700);
await clickButton(page, /Cleanliness\d*$/).catch(() => {});
await sleep(900);
await page.evaluate(() =>
  [
    ...document.querySelectorAll(
      '[data-testid="cleanliness-wash-up"] [data-testid="sink-wash"] button',
    ),
  ]
    .find((b) => /Wash/.test(b.textContent))
    ?.click(),
);
await sleep(1200);
const sinkOpen = Boolean(await page.$('[data-testid="wash-up-sink"]'));
const sinkF = await frame();
await shot(page, "portraitonly-sink-1280");
check(
  "P3 the dishwashing sink fills a 1280x720 window (RULE CHANGE 2026-11-20: landscape layout on the wide sink picture, no 9:16 box)",
  sinkOpen && isFull(sinkF),
  {
    sinkOpen,
    sinkF,
  },
);

// ---------- P4: phones keep the whole screen ----------
await open(saveAt(91), 390, 844);
await openGame("dessert-run", "dessert-run-game");
const up = await frame();
await open(saveAt(91), 844, 390);
await openGame("dessert-run", "dessert-run-game");
const side = await frame();
check(
  "P4 an upright phone (390x844) and a phone on its side (844x390) keep the whole screen in a mini-game (no 9:16 box), no sideways scroll",
  isFull(up) && isFull(side) && !up.sideways && !side.sideways,
  { up, side },
);

check(
  "P5 no console errors",
  logs.filter((l) => /^(error|pageerror):/.test(l)).length === 0,
  logs.slice(0, 3),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nPORTRAIT ONLY E2E: ${failed.length} FAILED` : "\nPORTRAIT ONLY E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
