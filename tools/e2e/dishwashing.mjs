// The sink (developer 2026-10-23: dishwashing back, integrated), restaurant build, in a real browser:
//   1. Level 40 with last service's dishes in the sink (4 plates, 4 forks, 4 knives) and dish soap:
//      the Pre-Service Check shows "🫧 12 in the sink" with Wash ›; it opens the sink game on
//      the real lines.
//   2. Scrubbing the plate (pointer drags) washes that line for real: the save's sink drops by 4,
//      soap is used, nothing breaks, no money moves and no ledger entry is written.
//   3. Closing half-way keeps it; reopening shows what's left (8); scrubbing the rest empties the
//      sink ("Sink empty") and the row disappears.
//   4. Restaurant → Cleanliness's Wash-up card offers the same sink; with no soap the game says so
//      and offers 🛒 Dish soap (the Market's exact line).
//   5. 320 px: the sink fits, no sideways scroll, its buttons ≥ 48 px; no console errors.
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

const SINK = { "dinner-plates": 4, "dinner-forks": 4, "dinner-knives": 4 };
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
          "dinner-knives": { units: 24, costBasis: 1200 },
          ...(soap ? { "dish-soap": { units: soap, costBasis: soap * 1500 } } : {}),
        },
      },
      restaurantSupplies: {
        soapPct: soap ? 60 : 0,
        cleanerPct: 60,
        washing: 0,
        dirty: SINK,
        washedTotal: 100,
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

/** Scrub the sink's current piece: zig-zag drags across the basin until the line is done. */
async function scrubCurrent() {
  const before = await page.evaluate(
    () => document.querySelectorAll('[data-wash-state="done"]').length,
  );
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="wash-up-surface"]')?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (!box) return false;
  // Scene coordinates are 360 × 280; every piece sits in about x 80–280, y 90–245.
  const at = (sx, sy) => [box.x + (sx / 360) * box.w, box.y + (sy / 280) * box.h];
  for (let pass = 0; pass < 3; pass++) {
    const [x0, y0] = at(180, 160);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let sy = 88; sy <= 248; sy += 6) {
      const [ax, ay] = at(pass % 2 ? 290 : 70, sy);
      const [bx, by] = at(pass % 2 ? 70 : 290, sy + 3);
      await page.mouse.move(ax, ay, { steps: 4 });
      await page.mouse.move(bx, by, { steps: 14 });
    }
    await page.mouse.up();
    const done = await page.evaluate(
      () =>
        document.querySelectorAll('[data-wash-state="done"]').length ||
        /Sink empty/.test(
          document.querySelector('[data-testid="wash-up-status"]')?.textContent ?? "",
        ),
    );
    if (done > before || done === true) return true;
  }
  return false;
}

// ---------- 1. The Pre-Service Check shows the sink ----------
await boot(page, saveAt(40));
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(700);
await clickButton(page, /Prepare$/);
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
const lines = await page.evaluate(() =>
  [...document.querySelectorAll("[data-wash-line]")].map((l) => ({
    id: l.getAttribute("data-wash-line"),
    state: l.getAttribute("data-wash-state"),
    text: l.textContent.replace(/\s+/g, " ").trim(),
  })),
);
check(
  "1 the Pre-Service Check shows 🫧 12 in the sink · Wash ›, which opens the sink on the real lines",
  /12 in the sink/.test(row) &&
    lines.length === 3 &&
    lines.every((l) => /×4/.test(l.text)) &&
    lines[0].state === "current",
  { row, lines },
);
await shot(page, "dishwashing-1-sink");

// ---------- 2. Scrub one kind: washed for real ----------
const s0 = await readSave(page);
const first = lines[0]?.id;
const scrubbed = await scrubCurrent();
await sleep(500);
const s1 = await readSave(page);
check(
  "2 scrubbing the first kind clean washes that line in the save: sink 12 → 8, soap used, nothing broke, no money, no ledger",
  scrubbed &&
    sinkOf(s0) === 12 &&
    sinkOf(s1) === 8 &&
    (s1.business.restaurantSupplies.dirty[first] ?? 0) === 0 &&
    s1.business.restaurantSupplies.soapPct < s0.business.restaurantSupplies.soapPct &&
    s1.business.restaurantSupplies.brokenTotal === 0 &&
    s1.business.supplies.stock[first].units === 24 &&
    s1.credits === s0.credits &&
    s1.economyLedger.length === s0.economyLedger.length,
  {
    scrubbed,
    sink: [sinkOf(s0), sinkOf(s1)],
    soap: [s0.business.restaurantSupplies.soapPct, s1.business.restaurantSupplies.soapPct],
  },
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
const lines2 = await page.evaluate(() => document.querySelectorAll("[data-wash-line]").length);
let all = true;
for (let i = 0; i < lines2; i++) all = (await scrubCurrent()) && all;
await sleep(600);
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
  "3 closing half-way keeps it (8 left, 2 lines); the rest scrubbed → Sink empty, the save's sink is 0, the row goes",
  /8 in the sink/.test(row2) &&
    lines2 === 2 &&
    all &&
    /Sink empty/.test(status) &&
    sinkOf(s2) === 0 &&
    s2.business.restaurantSupplies.brokenTotal === 0 &&
    rowGone,
  { row2, lines2, all, status, sink: sinkOf(s2), rowGone },
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
await scrubCurrent();
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
  /12 in the sink/.test(card) &&
    /No dish soap/.test(card) &&
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
await clickButton(page, /Prepare$/);
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
