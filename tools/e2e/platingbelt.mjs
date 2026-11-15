// Plating Belt (developer 2026-11-15: the mosaic conveyor mini-game), restaurant build, real browser:
// business/platingBelt.ts + components/kc/inventory/PlatingBeltGame.tsx. Opened with ?platingBelt=<level> (developer preview;
// the game is not in the daily routine yet). The rules and every shipped plate are proved by scripts/plating-belt-qa.mts.
//   B1 Level 18: the dish name, a plate with cubes, 3 lanes of waiters, 5 empty tables, nothing scrolls
//   B2 a waiter that cannot finish waits at a table IN ITS OWN COLOUR (the colour is on the table, not just a chef)
//   B3 Undo: once per round; the plate and the tables come back; then it is used up
//   B4 pause: Resume, Restart this plate (the same plate), Leave
//   B5 careless play ends in a result with Try again AND Leave; "Try again" is the same plate with empty tables
//   B5b a jammed plate offers Undo once, Try again and Leave; Undo puts the game back in play
//   B6 a winning round shows stars, the tables used, Play again and Leave (some Level 18 to 27 plate is won by careless play)
//   B7 a refused tap (all tables full) shakes and says why, when play gets there
//   B8 five phone sizes x tiers 1 and 4: no sideways scroll, every button 48 px, the status line on screen, lane waiters do not overlap
//   B9 the hint only ever points at a waiter that collects cubes
//   B10 no console errors
// Screenshots: out/platingbelt-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
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

async function open(level, w = 390, h = 844) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(`${base}?platingBelt=${level}`, { waitUntil: "domcontentloaded" });
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
  await page.waitForSelector('[data-testid="plating-belt-game"]', { timeout: 15000 });
  await sleep(500);
}

const read = () =>
  page.evaluate(() => {
    const root = document.querySelector('[data-testid="plating-belt-game"]');
    if (!root) return null;
    const q = (sel) => [...root.querySelectorAll(sel)];
    const fronts = q('[data-testid^="pb-front-"]').map((b) => ({
      empty: b.dataset.empty === "1",
      hex: b.dataset.hex ?? null,
      label: b.getAttribute("aria-label"),
    }));
    const tables = q('[data-testid^="pb-table-"]').map((b) => ({
      empty: b.dataset.empty === "1",
      hex: b.dataset.hex ?? null,
      label: b.getAttribute("aria-label"),
      count: b.querySelector("span:last-child")?.textContent ?? null,
    }));
    return {
      cubes: Number(root.querySelector('[data-testid="pb-cubes"]')?.textContent?.match(/\d+/)?.[0]),
      dish: root.querySelector('[data-testid="pb-dish"]')?.textContent,
      tier: Number(root.dataset.tier),
      fronts,
      tables,
      occupied: tables.filter((t) => !t.empty).length,
      status: root.querySelector('[data-testid="pb-status"]')?.textContent,
      overlay: root.querySelector('[data-testid="pb-overlay"]')?.dataset.phase ?? null,
      result: root.querySelector('[data-testid="pb-result"]')?.innerText ?? null,
      undoDisabled: root.querySelector('[data-testid="pb-undo"]')?.disabled,
      glow: q('[data-testid^="pb-front-"],[data-testid^="pb-table-"]')
        .filter((b) => /ring-4/.test(b.className))
        .map((b) => b.dataset.testid),
      lanes: q('[data-testid^="pb-lane-"]').length,
    };
  });

// A tap is a lap that takes 1.2 s; a second tap finishes it at once, so a move is two clicks.
const tap = async (testid) => {
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.click(), testid);
  await sleep(25);
  await page.evaluate(
    () =>
      document.querySelector('[data-testid="pb-lap"]') &&
      document.querySelector('[data-testid="pb-front-0"]')?.click(),
  );
  await sleep(25);
};

// Play like a careless player (the first move that is not refused): the lane fronts in order, then the tables.
// A refused tap costs nothing, so the bot just tries the next waiter, as the careless-play measure in the QA does.
async function playCareless(maxSteps = 400) {
  let shook = false;
  let sawRefusal = null;
  for (let step = 0; step < maxSteps; step += 1) {
    const s = await read();
    if (s.overlay) return { phase: s.overlay, steps: step, shook, sawRefusal };
    const candidates = [
      ...s.fronts.flatMap((f, i) => (f.empty ? [] : [`pb-front-${i}`])),
      ...s.tables.flatMap((t, i) => (t.empty ? [] : [`pb-table-${i}`])),
    ];
    for (const target of candidates) {
      await tap(target);
      const after = await read();
      const refused = /full|yet$/i.test(after.status ?? "");
      if (/full/i.test(after.status ?? "")) sawRefusal = after.status;
      if (await page.evaluate(() => !!document.querySelector('[class*="sortShake"]'))) shook = true;
      if (!refused) break;
    }
  }
  return { phase: null, steps: maxSteps, shook, sawRefusal };
}

// ---- B1 -----------------------------------------------------------------------------------
await open(18);
const first = await read();
await shot(page, "platingbelt-18");
check(
  "B1 Level 18: dish name, a plate of cubes, 3 lanes, 5 empty tables",
  !!first.dish &&
    first.cubes > 200 &&
    first.tier === 1 &&
    first.lanes === 3 &&
    first.tables.length === 5 &&
    first.occupied === 0 &&
    first.fronts.every((f) => !f.empty),
  { dish: first.dish, cubes: first.cubes, lanes: first.lanes, tables: first.tables.length },
);

// ---- B9 (before anything is tapped) -------------------------------------------------------
await sleep(4500);
const hinted = await read();
let hintOk = true;
if (hinted.glow.length) {
  const before = hinted.cubes;
  await tap(hinted.glow[0]);
  hintOk = (await read()).cubes < before;
}
check("B9 the hint (if shown) points at a waiter that collects cubes", hintOk, {
  glow: hinted.glow,
});

// ---- B2 + B3 ------------------------------------------------------------------------------
await open(18);
let colourOnTable = null;
const startCubes = (await read()).cubes;
for (let i = 0; i < 3 && !colourOnTable; i += 1) {
  const s = await read();
  const idx = s.fronts.findIndex((f) => !f.empty);
  if (idx < 0) break;
  const hex = s.fronts[idx].hex;
  const beforeTables = s.occupied;
  await tap(`pb-front-${idx}`);
  const a = await read();
  if (a.occupied > beforeTables) {
    const t = a.tables.find((x) => !x.empty);
    colourOnTable = { hex, tableHex: t.hex, label: t.label };
  }
}
check(
  "B2 a waiting waiter keeps its colour on the table",
  !colourOnTable ||
    (colourOnTable.hex === colourOnTable.tableHex &&
      /cream|red|orange|yellow|green|brown|purple/.test(colourOnTable.label)),
  colourOnTable ?? "every waiter tapped finished (no table needed)",
);
const afterTaps = await read();
await page.evaluate(() => document.querySelector('[data-testid="pb-undo"]')?.click());
await sleep(120);
const undone = await read();
await page.evaluate(() => document.querySelector('[data-testid="pb-undo"]')?.click());
await sleep(80);
const undoneTwice = await read();
check(
  "B3 Undo brings the last tap back once, then it is used up",
  afterTaps.cubes <= startCubes &&
    (undone.cubes > afterTaps.cubes || undone.occupied < afterTaps.occupied) &&
    undone.undoDisabled === true &&
    undoneTwice.cubes === undone.cubes &&
    undoneTwice.occupied === undone.occupied,
  {
    startCubes,
    afterTaps: [afterTaps.cubes, afterTaps.occupied],
    undone: [undone.cubes, undone.occupied, undone.undoDisabled],
    undoneTwice: [undoneTwice.cubes, undoneTwice.occupied],
  },
);

// ---- B4 -----------------------------------------------------------------------------------
await open(18);
await page.evaluate(() => document.querySelector('[data-testid="pb-front-0"]')?.click());
await sleep(60);
await page.evaluate(() => document.querySelector('[data-testid="pb-front-0"]')?.click());
await sleep(60);
const moved = await read();
await page.evaluate(() => document.querySelector('[data-testid="pb-pause"]')?.click());
await sleep(120);
const paused = await read();
await shot(page, "platingbelt-paused");
const pauseButtons = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pb-overlay"] button')].map((b) =>
    b.textContent.trim(),
  ),
);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pb-overlay"] button')]
    .find((b) => /^Resume/.test(b.textContent))
    ?.click(),
);
await sleep(100);
const resumed = await read();
await page.evaluate(() => document.querySelector('[data-testid="pb-pause"]')?.click());
await sleep(100);
await page.evaluate(() => document.querySelector('[data-testid="pb-restart"]')?.click());
await sleep(150);
const restarted = await read();
check(
  "B4 pause: Resume, Restart this plate gives the same plate again, Leave is offered",
  paused.overlay === "paused" &&
    pauseButtons.join("|") === "Resume|Restart this plate|Leave" &&
    resumed.overlay === null &&
    restarted.cubes === first.cubes &&
    restarted.occupied === 0 &&
    moved.cubes <= first.cubes,
  { pauseButtons, first: first.cubes, moved: moved.cubes, restarted: restarted.cubes },
);
await page.evaluate(() => document.querySelector('[data-testid="pb-pause"]')?.click());
await sleep(100);
await page.evaluate(() => document.querySelector('[data-testid="pb-leave"]')?.click());
await sleep(700);
check("B4b Leave closes the game", (await read()) === null);

// ---- B5 + B7: a careless player on the hardest tier ------------------------------------------
await open(65);
const hard = await playCareless();
const end = await read();
await shot(page, "platingbelt-end-hard");
let retry = null;
if (end?.overlay) {
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="pb-overlay"] button')].map((b) =>
      b.textContent.trim(),
    ),
  );
  await page.evaluate(() => document.querySelector('[data-testid="pb-restart"]')?.click());
  await sleep(200);
  const again = await read();
  retry = { buttons, cubesAfter: again.cubes, occupied: again.occupied, overlay: again.overlay };
}
check(
  "B5 a round ends in a result with Try again/Play again and Leave; restarting is the same plate with empty tables",
  !!end?.overlay &&
    retry &&
    /Try again|Play again/.test(retry.buttons.join("|")) &&
    retry.buttons.includes("Leave") &&
    retry.overlay === null &&
    retry.occupied === 0 &&
    retry.cubesAfter > 600,
  { end: end?.overlay, steps: hard.steps, retry },
);
check(
  "B7 when all tables fill, a refused tap says why (and shakes) - observed or never reached",
  hard.sawRefusal === null || (/full/i.test(hard.sawRefusal) && hard.shook),
  { sawRefusal: hard.sawRefusal, shook: hard.shook },
);

// ---- B5b: a jammed plate offers Undo once, Try again and Leave ------------------------------------
let jam = null;
for (let level = 65; level <= 90 && !jam; level += 1) {
  await open(level);
  const r = await playCareless();
  if (r.phase === "trapped") {
    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="pb-overlay"] button')].map((b) =>
        b.textContent.trim(),
      ),
    );
    await shot(page, "platingbelt-jam");
    await page.evaluate(() => document.querySelector('[data-testid="pb-undo-overlay"]')?.click());
    await sleep(200);
    const afterUndo = await read();
    jam = {
      level,
      buttons,
      overlayAfterUndo: afterUndo.overlay,
      undoDisabled: afterUndo.undoDisabled,
    };
  }
}
check(
  "B5b a jammed plate offers Undo (once), Try again and Leave; Undo puts the game back in play",
  !!jam &&
    jam.buttons.includes("Try again") &&
    jam.buttons.includes("Leave") &&
    jam.buttons.some((b) => /Undo/.test(b)) &&
    jam.overlayAfterUndo === null &&
    jam.undoDisabled === true,
  jam,
);

// ---- B6: some Level 18 to 27 plate is won by careless play -------------------------------------
let won = null;
for (let level = 18; level <= 27 && !won; level += 1) {
  await open(level);
  const r = await playCareless();
  if (r.phase === "won") {
    const s = await read();
    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="pb-overlay"] button')].map((b) =>
        b.textContent.trim(),
      ),
    );
    await shot(page, "platingbelt-won");
    won = { level, result: s.result, buttons };
  }
}
check(
  "B6 a winning round shows stars and the tables used, with Play again and Leave",
  !!won &&
    /⭐/.test(won.result) &&
    /table/.test(won.result) &&
    won.buttons.includes("Play again") &&
    won.buttons.includes("Leave"),
  won,
);

// ---- B8: sizes --------------------------------------------------------------------------------
const sizes = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
];
for (const level of [18, 65]) {
  for (const [w, h] of sizes) {
    await open(level, w, h);
    const m = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="plating-belt-game"]');
      const buttons = [...root.querySelectorAll("button")].filter(
        (b) => b.getBoundingClientRect().width > 0,
      );
      const tooSmall = buttons
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width < 47.5 || r.height < 47.5;
        })
        .map(
          (b) =>
            `${b.getAttribute("aria-label") ?? b.textContent}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`,
        );
      const fronts = [...root.querySelectorAll('[data-testid^="pb-front-"]')].map((b) =>
        b.getBoundingClientRect(),
      );
      let overlap = false;
      for (let i = 0; i < fronts.length; i += 1)
        for (let j = i + 1; j < fronts.length; j += 1) {
          const a = fronts[i],
            b = fronts[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
            overlap = true;
        }
      const status = root.querySelector('[data-testid="pb-status"]').getBoundingClientRect();
      const canvas = root.querySelector('[data-testid="pb-canvas"]').getBoundingClientRect();
      const lastTable = [...root.querySelectorAll('[data-testid^="pb-table-"]')]
        .pop()
        .getBoundingClientRect();
      return {
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
        tooSmall,
        overlap,
        statusBottom: Math.round(status.bottom),
        ih: innerHeight,
        plate: Math.round(canvas.width),
        lastTableRight: Math.round(lastTable.right),
      };
    });
    if (level === 65 && w === 320) await shot(page, "platingbelt-65-320");
    check(
      `B8 Level ${level} at ${w} x ${h}: no sideways scroll, 48 px buttons, status on screen, no overlap, plate at least 150 px`,
      m.sw <= m.iw &&
        m.tooSmall.length === 0 &&
        !m.overlap &&
        m.statusBottom <= m.ih &&
        m.plate >= 150 &&
        m.lastTableRight <= m.iw,
      m,
    );
  }
}

check(
  "B10 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nPLATING BELT: ALL PASS");
process.exit(failed.length ? 1 : 0);
