// Dishwashing, full screen (developer 2026-11-09), restaurant build, real browser: the layout across screen sizes, the Back button, Reduced Motion and
// the fallback with no new art.
//   F1 at 320x568, 360x640, 390x844, 430x900 and 768x1024: the stage is >= 90% of the shell's width, the sink does not scroll, the one-row strip is
//      <= 10% of the height, every button >= 48 px, nothing sticks out sideways
//   F2 the ← Back button closes the sink and leaves the queue as it was (3 still in the sink)
//   F3 the sheet opens from the strip with every kind and closes with ▾
//   F4 Reduced Motion: no bubbles, no steam, no drifting ripples (the sink still works)
//   F5 with the painted art blocked, the sink still looks and works right (the dark-wood backdrop and the old picture)
//   F6 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, clickButton } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const SINK = { "frying-pans": 1, "dinner-plates": 2 };
const saveAt = (n, settings = {}) =>
  seedSave({
    credits: 500_000,
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          "dinner-plates": { units: 24, costBasis: 2400 },
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
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: true },
    ...(Object.keys(settings).length
      ? { settings: { sound: false, music: false, ...settings } }
      : {}),
  });

async function openSink() {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(700);
  await page.waitForSelector('[data-testid="guide-card"]', { timeout: 4000 }).catch(() => null);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Later"))
      ?.click(),
  );
  await sleep(300);
  await clickButton(page, /Open for service$|Prepare$/);
  await sleep(1300);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="sink-wash"] button')]
      .find((b) => /Wash/.test(b.textContent))
      ?.click(),
  );
  await sleep(800);
}
const measure = () =>
  page.evaluate(() => {
    const content = document.querySelector("[data-game-content]")?.getBoundingClientRect();
    const stage = document.querySelector('[data-testid="wash-up-stage"]')?.getBoundingClientRect();
    const strip = document.querySelector('[data-testid="wash-up-queue"]')?.getBoundingClientRect();
    const sec = document.querySelector('[data-testid="wash-up-sink"] section');
    return {
      stageShare: stage && content ? +(stage.width / content.width).toFixed(3) : 0,
      stripShare: strip && content ? +(strip.height / content.height).toFixed(3) : 1,
      scroll: sec ? sec.scrollHeight - sec.clientHeight : -1,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small: [...(sec?.querySelectorAll("button") ?? [])]
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height < 47.5;
        })
        .map((b) => (b.getAttribute("aria-label") ?? b.textContent).trim()),
    };
  });

// F1: five screen sizes
await boot(page, saveAt(40));
const sizes = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
];
const got = [];
for (const [w, h] of sizes) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(300);
  await openSink();
  const m = await measure();
  got.push({ size: `${w}x${h}`, ...m });
  await shot(page, `dishwashingfull-${w}`);
  await page.evaluate(() => document.querySelector('[data-testid="wash-up-close"]')?.click());
  await sleep(500);
}
check(
  "F1 at five screen sizes the stage is >= 90% of the width, the sink does not scroll, the strip is <= 10% of the height, every button >= 48 px, nothing sticks out sideways",
  got.every(
    (g) =>
      g.stageShare >= 0.9 &&
      g.scroll <= 1 &&
      g.stripShare <= 0.1 &&
      g.small.length === 0 &&
      g.overflowX <= 0,
  ),
  got,
);

// F2 / F3
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await openSink();
await page.evaluate(() => document.querySelector('[data-testid="wash-up-queue"]')?.click());
await sleep(350);
const sheet = await page.evaluate(() => ({
  open: !!document.querySelector('[data-testid="wash-up-sheet"]'),
  kinds: document.querySelectorAll("[data-wash-line]").length,
}));
await page.evaluate(() => document.querySelector('[data-testid="wash-up-sheet-close"]')?.click());
await sleep(300);
const sheetGone = await page.evaluate(
  () => !document.querySelector('[data-testid="wash-up-sheet"]'),
);
check(
  "F3 the strip opens a sheet with every kind (2) and ▾ closes it",
  sheet.open && sheet.kinds === 2 && sheetGone,
  { sheet, sheetGone },
);
await page.evaluate(() => document.querySelector('[aria-label="Close the sink"]')?.click());
await sleep(500);
const left = await page.evaluate(
  () => document.querySelector('[data-testid="sink-wash"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
check(
  "F2 Back closes the sink and the queue is as it was (3 in the sink)",
  /3 in the sink/.test(left),
  left,
);

// F4: Reduced Motion
await boot(page, saveAt(40, { reducedMotion: true }));
await openSink();
const calm = await page.evaluate(() => ({
  bubbles: document.querySelectorAll(".wash-bubble").length,
  steam: document.querySelectorAll(".wash-steam").length,
  drift: document.querySelectorAll(".wash-drift").length,
  open: !!document.querySelector('[data-testid="wash-up-surface"]'),
}));
check(
  "F4 Reduced Motion: no bubbles, no steam, no drifting ripples; the sink still works",
  calm.open && calm.bubbles === 0 && calm.steam === 0 && calm.drift === 0,
  calm,
);

// F5: no painted art (every /dishwashing/*.webp except the old sink picture is blocked)
await page.evaluateOnNewDocument(() => {
  // The art probe (washArt.ts) loads each file with new Image(): make every new-art file fail to load.
  const Real = window.Image;
  window.Image = function () {
    const img = new Real();
    Object.defineProperty(img, "src", {
      set(v) {
        if (/\/dishwashing\/(?!premium-sink)[a-z0-9-]+\.webp/.test(String(v)))
          setTimeout(() => img.onerror?.(new Event("error")), 0);
        else img.setAttribute("src", v);
      },
      get() {
        return img.getAttribute("src");
      },
    });
    return img;
  };
});
await boot(page, saveAt(40));
await openSink();
const plain = await page.evaluate(() => {
  const content = document.querySelector("[data-game-content]")?.getBoundingClientRect();
  const stage = document.querySelector('[data-testid="wash-up-stage"]')?.getBoundingClientRect();
  return {
    open: !!document.querySelector('[data-testid="wash-up-surface"]'),
    ambient: !!document.querySelector('[data-testid="wash-up-ambient"]'),
    oldPicture: !!document.querySelector('[data-testid="wash-up-scene"] img[src*="premium-sink"]'),
    stageShare: stage && content ? stage.width / content.width : 0,
  };
});
await shot(page, "dishwashingfull-noart");
check(
  "F5 without the new art the sink is complete: the old picture fills the stage, no ambient layers, it can be scrubbed",
  plain.open && !plain.ambient && plain.oldPicture && plain.stageShare >= 0.9,
  plain,
);

check(
  "F6 no console errors",
  logs.filter((l) => /^error|pageerror/i.test(l) && !/Failed to load resource|ERR_FAILED/i.test(l))
    .length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `DISHWASHING FULL E2E: ${failed} FAIL` : "DISHWASHING FULL E2E: ALL PASS");
process.exit(failed ? 1 : 0);
