// The sink (developer 2026-10-23: dishwashing back, integrated; 2026-11-07: every piece, slowly), restaurant build, real browser:
//   1. Level 40 with last service's dishes in the sink (2 plates, 1 frying pan) and dish soap:
//      the Pre-Service Check shows "3 in the sink" with Wash; it opens the sink game on the real lines.
//   2. ONE piece: a short swipe does not clean a pan; scrubbing takes real strokes, then the suds
//      (the rinse) must be washed off; only then is that ONE piece washed for real: the save's sink drops by 1
//      (not by the whole line), soap is used by the piece, nothing breaks, no money moves, no ledger entry.
//   3. Closing half-way keeps it; reopening shows what is left (2); washing the rest, piece by piece
//      (the two plates), empties the sink ("Sink empty") and the row disappears.
//   4. Restaurant > Cleanliness's Dishwashing card ("Wash 3 dishes") offers the same sink; with no soap the game says so
//      and offers Dish soap (the Market's exact line).
//   5. 320 px: the sink fits, no sideways scroll, its buttons >= 48 px; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  shot,
  clickButton,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const SINK = { "frying-pans": 1, "dinner-plates": 2 };
const saveAt = (n, { soap = 2 } = {}) =>
  seedSave({
    credits: 500_000,
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          "dinner-plates": { units: 24, costBasis: 2400 },
          "dinner-forks": { units: 24, costBasis: 1200 },
          "frying-pans": { units: 2, costBasis: 1868 },
          ...(soap ? { "dish-soap": { units: soap, costBasis: soap * 1500 } } : {}),
        },
      },
      restaurantSupplies: {
        soapPct: soap ? 60 : 0,
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
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: true },
  });
const sinkOf = (s) =>
  Object.values(s.business.restaurantSupplies?.dirty ?? {}).reduce((t, v) => t + v, 0);

/** The "next step" guide card (rewards are waiting) sits over the Kitchen of a level-40 save: wait for it and send it away (Later). */
const dismissPaige = async () => {
  await page.waitForSelector('[data-testid="guide-card"]', { timeout: 5000 }).catch(() => null);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Later"))
      ?.click(),
  );
  await sleep(400);
};

const pieceKey = () =>
  page.evaluate(() => {
    const p = document.querySelector("[data-piece-id]");
    if (p) return `${p.getAttribute("data-piece-id")}#${p.getAttribute("data-piece-nth")}`;
    return /Sink empty/.test(
      document.querySelector('[data-testid="wash-up-status"]')?.textContent ?? "",
    )
      ? "done"
      : "none";
  });
const phaseNow = () =>
  page.evaluate(() =>
    document.querySelector("[data-piece-phase]")?.getAttribute("data-piece-phase"),
  );

/** One zig-zag pass over the basin (scene 360 x 280; every piece sits in about x 60-330, y 88-248). */
async function zigzag(pass) {
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="wash-up-surface"]')?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (!box) return false;
  const at = (sx, sy) => [box.x + (sx / 360) * box.w, box.y + (sy / 280) * box.h];
  const [x0, y0] = at(180, 160);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let sy = 90; sy <= 246; sy += 12) {
    const [ax, ay] = at(pass % 2 ? 330 : 60, sy);
    const [bx, by] = at(pass % 2 ? 60 : 330, sy + 3);
    await page.mouse.move(ax, ay, { steps: 2 });
    await page.mouse.move(bx, by, { steps: 9 });
  }
  await page.mouse.up();
  return true;
}

/**
 * Wash the sink's current PIECE: scrub, then rinse, until the sink moves on to the next piece (or is empty).
 * Returns what was seen on the way: the passes it took and whether the rinse (suds) phase showed.
 */
async function washPiece() {
  // Record every phase the piece goes through (the rinse can start and end inside one pass).
  await page.evaluate(() => {
    window.__phases = [];
    window.__phaseObs?.disconnect();
    const watch = () => {
      const el = document.querySelector("[data-piece-phase]");
      if (!el) return;
      const ph = el.getAttribute("data-piece-phase");
      if (window.__phases[window.__phases.length - 1] !== ph) window.__phases.push(ph);
    };
    window.__phaseObs = new MutationObserver(watch);
    window.__phaseObs.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-piece-phase"],
      childList: true,
    });
    watch();
  });
  const key0 = await pieceKey();
  const seen = { passes: 0, rinse: false, key0 };
  for (let pass = 0; pass < 30; pass++) {
    if (!(await zigzag(pass))) break;
    seen.passes++;
    if ((await phaseNow()) === "rinse") seen.rinse = true;
    await sleep(120);
    const key = await pieceKey();
    if (key !== key0) {
      seen.ok = true;
      seen.phases = await page.evaluate(() => window.__phases);
      seen.rinse = seen.phases.includes("rinse");
      return seen;
    }
  }
  seen.ok = false;
  return seen;
}

// ---------- 1. The Pre-Service Check shows the sink ----------
await boot(page, saveAt(40));
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(700);
await dismissPaige();
await sleep(300);
await clickButton(page, /Open for service$|Prepare$/);
await sleep(1400);
const row = await page.evaluate(
  () => document.querySelector('[data-testid="sink-wash"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="sink-wash"] button')]
    .find((b) => /Wash/.test(b.textContent))
    ?.click(),
);
await sleep(700);
// Full screen (developer 2026-11-09): the list is ONE "Up next" strip; the whole list is a sheet one tap away. Layout facts first.
const layout = await page.evaluate(() => {
  const content = document.querySelector("[data-game-content]")?.getBoundingClientRect();
  const stage = document.querySelector('[data-testid="wash-up-stage"]')?.getBoundingClientRect();
  const strip = document.querySelector('[data-testid="wash-up-queue"]')?.getBoundingClientRect();
  const scene = document.querySelector('[data-testid="wash-up-scene"]');
  return {
    stageShare: stage && content ? stage.width / content.width : 0,
    sceneShare: (() => {
      const r = document.querySelector('[data-testid="wash-up-scene"]')?.getBoundingClientRect();
      return r && content ? r.width / content.width : 0;
    })(),
    stripShare: strip && content ? strip.height / content.height : 1,
    listInDom: document.querySelectorAll("[data-wash-line]").length,
    scale: Number(scene?.getAttribute("data-scale") ?? 0),
    scroll: (() => {
      const sec = document.querySelector('[data-testid="wash-up-sink"] section');
      return sec ? sec.scrollHeight - sec.clientHeight : -1;
    })(),
  };
});
await shot(page, "dishwashing-0-fullscreen");
await page.evaluate(() => document.querySelector('[data-testid="wash-up-queue"]')?.click());
await sleep(400);
const lines = await page.evaluate(() =>
  [...document.querySelectorAll("[data-wash-line]")].map((l) => ({
    id: l.getAttribute("data-wash-line"),
    state: l.getAttribute("data-wash-state"),
    text: l.textContent.replace(/\s+/g, " ").trim(),
  })),
);
await shot(page, "dishwashing-0-list");
await page.evaluate(() => document.querySelector('[data-testid="wash-up-sheet-close"]')?.click());
await sleep(300);
check(
  "0 the sink is the screen: the stage is at least 90% of the width, the one-row strip is under 10% of the height, no list on screen until it is opened, the scene itself fills nearly the whole width (it was a card at about 80% with the list above it), nothing scrolls",
  layout.stageShare >= 0.9 &&
    layout.stripShare <= 0.1 &&
    layout.listInDom === 0 &&
    layout.sceneShare >= 0.88 &&
    layout.scroll <= 1,
  layout,
);
check(
  "1 the Pre-Service Check shows 3 in the sink · Wash, which opens the sink on the real lines (the pan first)",
  /3 in the sink/.test(row) &&
    lines.length === 2 &&
    lines[0].id === "frying-pans" &&
    lines.map((l) => l.text.match(/×(\d)/)?.[1]).join("") === "12" &&
    lines[0].state === "current",
  { row, lines },
);
await shot(page, "dishwashing-1-sink");

// ---------- 2. ONE piece: scrub, then rinse ----------
const s0 = await readSave(page);
const first = lines[0]?.id; // the frying pan
const piece0 = await pieceKey();
// A short swipe does not clean a pan.
{
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="wash-up-surface"]')?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  await page.mouse.move(box.x + box.w * 0.4, box.y + box.h * 0.57);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.46, box.y + box.h * 0.57, { steps: 4 });
  await page.mouse.up();
}
await sleep(200);
const afterSwipe = { key: await pieceKey(), phase: await phaseNow() };
const t0 = Date.now();
const washed = await washPiece();
const secs = Math.round((Date.now() - t0) / 100) / 10;
// Let the shine and the slide finish.
await sleep(1100);
const s1 = await readSave(page);
const rack = await page.evaluate(() =>
  [...document.querySelectorAll("[data-rack]")].map((e) => ({
    id: e.getAttribute("data-rack"),
    n: e.getAttribute("data-rack-n"),
  })),
);
check(
  "2 a short swipe cleans nothing; one piece takes scrubbing AND rinsing; then exactly that ONE pan is washed in the save (sink 3 to 2, soap by the piece, nothing broke, no money, no ledger)",
  afterSwipe.key === piece0 &&
    afterSwipe.phase === "scrub" &&
    washed.ok &&
    washed.rinse &&
    washed.passes >= 2 &&
    sinkOf(s0) === 3 &&
    sinkOf(s1) === 2 &&
    (s1.business.restaurantSupplies.dirty[first] ?? 0) === 0 &&
    s1.business.restaurantSupplies.soapPct < s0.business.restaurantSupplies.soapPct &&
    s1.business.restaurantSupplies.brokenTotal === 0 &&
    s1.business.restaurantSupplies.washedKitchen === 1 &&
    s1.business.supplies.stock[first].units === 2 &&
    s1.credits === s0.credits &&
    s1.economyLedger.length === s0.economyLedger.length &&
    rack.some((r) => r.id === first && r.n === "1"),
  { piece0, afterSwipe, washed, secs, rack, sink: [sinkOf(s0), sinkOf(s1)] },
);

// ---------- 3. Close half-way, reopen, finish ----------
await page.evaluate(() => document.querySelector('[aria-label="Close the sink"]')?.click());
await sleep(500);
const row2 = await page.evaluate(
  () => document.querySelector('[data-testid="sink-wash"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="sink-wash"] button')]
    .find((b) => /Wash/.test(b.textContent))
    ?.click(),
);
await sleep(700);
await page.evaluate(() => document.querySelector('[data-testid="wash-up-queue"]')?.click());
await sleep(300);
const lines2 = await page.evaluate(() => document.querySelectorAll("[data-wash-line]").length);
await page.evaluate(() => document.querySelector('[data-testid="wash-up-sheet-close"]')?.click());
await sleep(300);
let all = true;
const order = [];
for (let i = 0; i < 2; i++) {
  order.push(await pieceKey());
  const w = await washPiece();
  all = w.ok && all;
  await sleep(1000);
}
await sleep(400);
const status = await page.evaluate(
  () => document.querySelector('[data-testid="wash-up-status"]')?.textContent ?? "",
);
const s2 = await readSave(page);
await shot(page, "dishwashing-3-done");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="wash-up-sink"] button')]
    .find((b) => /Done/.test(b.textContent))
    ?.click(),
);
await sleep(500);
const rowGone = await page.evaluate(() => !document.querySelector('[data-testid="sink-wash"]'));
check(
  "3 closing half-way keeps it (2 left, 1 line); the rest washed piece by piece (plate 1, plate 2) then Sink empty, the save's sink is 0, the row goes",
  /2 in the sink/.test(row2) &&
    lines2 === 1 &&
    all &&
    order.join(",") === "dinner-plates#1,dinner-plates#2" &&
    /Sink empty/.test(status) &&
    sinkOf(s2) === 0 &&
    s2.business.restaurantSupplies.brokenTotal === 0 &&
    s2.business.restaurantSupplies.washedTotal === 102 &&
    rowGone,
  { row2, lines2, all, order, status, sink: sinkOf(s2), rowGone },
);

// ---------- 4. Cleanliness, and no soap ----------
await boot(page, saveAt(40, { soap: 0 }));
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await sleep(900);
await openShortcut(page, "business");
await sleep(700);
await clickButton(page, /Cleanliness\d*$/);
await sleep(900);
const card = await page.evaluate(
  () =>
    document.querySelector('[data-testid="cleanliness-wash-up"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
await page.evaluate(() =>
  [
    ...document.querySelectorAll(
      '[data-testid="cleanliness-wash-up"] [data-testid="sink-wash"] button',
    ),
  ]
    .find((b) => /Wash/.test(b.textContent))
    ?.click(),
);
await sleep(700);
const n0 = await readSave(page);
await zigzag(0);
await sleep(500);
const n1 = await readSave(page);
const noSoap = await page.evaluate(() => ({
  status: document.querySelector('[data-testid="wash-up-status"]')?.textContent ?? "",
  buy: [...document.querySelectorAll('[data-testid="wash-up-sink"] button')].some((b) =>
    /Dish soap/.test(b.textContent),
  ),
}));
check(
  "4 Restaurant → Cleanliness offers the same sink; with no soap nothing is washed and it offers 🛒 Dish soap",
  /Wash 3 dishes/.test(card) &&
    /No soap/.test(card) &&
    sinkOf(n1) === sinkOf(n0) &&
    /Out of dish soap/.test(noSoap.status) &&
    noSoap.buy,
  { card, noSoap, sink: [sinkOf(n0), sinkOf(n1)] },
);
await shot(page, "dishwashing-4-no-soap");

// ---------- 5. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(40));
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(700);
await dismissPaige();
await sleep(300);
await clickButton(page, /Open for service$|Prepare$/);
await sleep(1200);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="sink-wash"] button')]
    .find((b) => /Wash/.test(b.textContent))
    ?.click(),
);
await sleep(700);
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="wash-up-sink"] section');
  const r = el?.getBoundingClientRect();
  return {
    open: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    inside: r ? r.left >= 0 && r.right <= innerWidth + 0.5 : false,
    small: [...(el?.querySelectorAll("button") ?? [])]
      .filter((b) => b.getBoundingClientRect().height < 47.5)
      .map((b) => b.textContent.trim()),
  };
});
await shot(page, "dishwashing-5-320");
check(
  "5 at 320 px the sink fits (no sideways scroll), every button ≥ 48 px",
  fit.open && fit.overflow <= 0 && fit.inside && fit.small.length === 0,
  fit,
);
check(
  "6 no console errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs.filter((l) => /^error|pageerror/i.test(l)).slice(0, 3),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
