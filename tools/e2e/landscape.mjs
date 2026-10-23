// Phone landscape (developer 2026-10-22: "optimize the game for mobile landscape layout … the
// landscape images … integrate"), restaurant build, in a real browser:
//   1. At 568×320, 640×360, 740×360, 844×390 and 932×430 (a phone on its side) the game fills
//      the screen (no shrunken 9:16 frame): <html data-orient="landscape">, the frame is the
//      whole viewport; at 390×844 and 1024×768 (portrait, a tablet) it is not landscape.
//   2. The bottom bar is a rail on the left; the Kitchen, Market, Restaurant map, Business and
//      Inventory are reachable from it and their content starts after it (no button under the
//      rail), no sideways scroll, no button outside the screen, rail buttons ≥ 48 px.
//   3. The Restaurant map sits on the landscape restaurant painting
//      (landscape-art/sections/restaurant.webp), loaded only in landscape.
//   4. The cutting: the Phaser canvas stays portrait (taller than wide) and as high as the
//      screen, right of the order card; Level 3 plays to its Knife Report with taps on the
//      canvas's own box (solver geometryFromCanvas).
//   5. A cleaning job opens on its landscape painting (landscape-art/cleaning/…) with the
//      tools beside the room, and reaches Spotless.
//   6. Turning the phone mid-level keeps the order (no remount): portrait → landscape →
//      portrait, the same order card.
//   7. No console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, clickButton } from "./harness.mjs";
import { playToReport, geometryFromCanvas } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const view = (w, h) =>
  page.setViewport({
    width: w,
    height: h,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    isLandscape: w > h,
  });

const N = 25;
const SUPPLIES = [
  "bin-liners",
  "brooms",
  "disinfectant",
  "floor-cleaner",
  "hand-soap",
  "mop-bucket",
  "paper-towels",
  "sponges-cloths",
  "toilet-brushes",
  "toilet-paper",
];
const levelSave = (extra = {}) =>
  seedSave({
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: true },
    ...extra,
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(SUPPLIES.map((id) => [id, { units: 40, costBasis: 40 }])),
        },
      },
      ...(extra.business ?? {}),
    },
  });

const layout = () =>
  page.evaluate(() => {
    const frame = document.querySelector("[data-game-content]")?.getBoundingClientRect();
    const rail = document.querySelector("nav[data-bottom-nav]")?.getBoundingClientRect();
    const railButtons = [...document.querySelectorAll("nav[data-bottom-nav] button")].map((b) => {
      const q = b.getBoundingClientRect();
      return Math.round(Math.min(q.width, q.height));
    });
    const vw = innerWidth,
      vh = innerHeight;
    const buttons = [...document.querySelectorAll("button")].filter((b) => {
      const q = b.getBoundingClientRect();
      return q.width > 0 && q.height > 0 && !b.closest("nav[data-bottom-nav]");
    });
    const underRail = rail
      ? buttons
          .filter((b) => {
            const q = b.getBoundingClientRect();
            const cx = q.left + q.width / 2,
              cy = q.top + q.height / 2;
            return (
              cx < rail.right &&
              cy > 0 &&
              cy < vh &&
              document.elementFromPoint(Math.max(1, cx), cy)?.closest("nav[data-bottom-nav]")
            );
          })
          .map((b) => b.textContent.trim().slice(0, 16))
      : [];
    const outside = buttons
      .filter((b) => {
        const q = b.getBoundingClientRect();
        if (q.bottom <= vh + 1 && q.right <= vw + 1 && q.top >= -1 && q.left >= -1) return false;
        for (let e = b.parentElement; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (
            /(auto|scroll)/.test(cs.overflowY + cs.overflowX) &&
            e.scrollHeight > e.clientHeight + 2
          )
            return false;
        }
        return true;
      })
      .map((b) => b.textContent.trim().slice(0, 16));
    return {
      orient: document.documentElement.dataset.orient ?? "portrait",
      frame: frame && { w: Math.round(frame.width), h: Math.round(frame.height) },
      vw,
      vh,
      rail: rail && {
        left: Math.round(rail.left),
        w: Math.round(rail.width),
        h: Math.round(rail.height),
      },
      railButtons,
      underRail: underRail.slice(0, 3),
      outside: outside.slice(0, 3),
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

/* ── 1–2. Sizes, rail, screens ── */
const SIZES = [
  [568, 320],
  [640, 360],
  [740, 360],
  [844, 390],
  [932, 430],
];
const sizeRows = [];
const screenRows = [];
await view(844, 390);
await boot(page, levelSave());
for (const [w, h] of SIZES) {
  await view(w, h);
  await sleep(700);
  const l = await layout();
  sizeRows.push({ w, h, orient: l.orient, frame: l.frame });
  for (const id of ["kitchen", "shop", "restaurant-map"]) {
    await page.evaluate((i) => document.querySelector(`[data-nav="${i}"]`)?.click(), id);
    await sleep(1100);
    screenRows.push({ w, id, ...(await layout()) });
  }
  for (const id of ["business", "inventory"]) {
    await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
    await sleep(600);
    for (let k = 0; k < 2; k++) {
      await page.evaluate(
        (i) => document.querySelector(`[data-testid="${i}-shortcut"]`)?.click(),
        id,
      );
      await sleep(350);
    }
    await sleep(900);
    screenRows.push({ w, id, ...(await layout()) });
  }
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(500);
}
for (const [w, h] of [
  [390, 844],
  [1024, 768],
]) {
  await view(w, h);
  await sleep(700);
  const l = await layout();
  sizeRows.push({ w, h, orient: l.orient, frame: l.frame });
}
check(
  "1 a phone on its side fills the screen (landscape); portrait phones and tablets keep the 9:16 frame",
  sizeRows.every((r) =>
    r.w > r.h && r.h < 640
      ? r.orient === "landscape" && Math.abs(r.frame.w - r.w) <= 2 && Math.abs(r.frame.h - r.h) <= 2
      : r.orient === "portrait" && Math.abs(r.frame.w / r.frame.h - 540 / 960) < 0.01,
  ),
  sizeRows,
);
const bad = screenRows.filter(
  (r) =>
    !r.rail ||
    r.rail.left > 2 ||
    r.rail.h < r.vh - 4 ||
    r.railButtons.some((s) => s < 47.5) ||
    r.underRail.length ||
    r.outside.length ||
    r.sideways,
);
check(
  "2 the bar is a left rail; Kitchen, Market, Map, Business, Inventory clear of it, on screen, no sideways scroll, rail buttons ≥ 48 px",
  screenRows.length === SIZES.length * 5 && bad.length === 0,
  bad.slice(0, 3).map((r) => ({
    w: r.w,
    id: r.id,
    rail: r.rail,
    under: r.underRail,
    out: r.outside,
    rb: r.railButtons,
  })),
);

/* ── 3. Map backdrop ── */
await view(844, 390);
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await sleep(1500);
const mapArt = await page.evaluate(() =>
  [...document.querySelectorAll("img")].some(
    (i) =>
      /landscape-art\/sections\/restaurant\.webp/.test(i.src) &&
      i.complete &&
      i.naturalWidth > 1000,
  ),
);
await view(390, 844);
await sleep(800);
const mapArtPortrait = await page.evaluate(() =>
  [...document.querySelectorAll("img")].some((i) => /landscape-art\//.test(i.src)),
);
check(
  "3 the map sits on the landscape restaurant painting (landscape only)",
  mapArt && !mapArtPortrait,
  { mapArt, mapArtPortrait },
);

/* ── 4. Cutting ── */
await view(844, 390);
const food = Object.fromEntries(
  ["tomato", "cucumber", "carrot"].map((id) => [
    id,
    { ingredientId: id, quantity: 6, unitCost: 0, purchaseDay: 1 },
  ]),
);
await boot(
  page,
  seedSave({
    business: { ...MOVED_IN_BUSINESS, inventory: food },
    levelProgress: {
      currentLevelId: "level-3",
      highestUnlockedLevelId: "level-3",
      completedLevelIds: ["level-1", "level-2"],
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  }),
);
await clickButton(page, /Prepare$/);
await sleep(900);
await clickButton(
  page,
  /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
);
await page
  .waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  })
  .catch(() => null);
await sleep(1200);
const canvas = await page.evaluate(() => {
  const c = document.querySelector("[data-game-viewport] canvas")?.getBoundingClientRect();
  const card = document.querySelector(".kc-prep-card")?.getBoundingClientRect();
  return (
    c && card && { w: c.width, h: c.height, left: c.left, cardRight: card.right, vh: innerHeight }
  );
});
check(
  "4a the cutting canvas stays portrait, at least the screen's height, right of the order card",
  !!canvas && canvas.h > canvas.w && canvas.h >= canvas.vh && canvas.left >= canvas.cardRight - 8,
  canvas,
);
// 6. Turn the phone mid-level: the same order stays.
const orderName = () =>
  page.evaluate(() => document.querySelector(".kc-prep-card")?.textContent?.slice(0, 60) ?? null);
const before = await orderName();
await view(390, 844);
await sleep(900);
const mid = await page.evaluate(
  () => document.body.innerText.match(/[A-Z][a-z]+'s Order/i)?.[0] ?? null,
);
await view(844, 390);
await sleep(900);
const after = await orderName();
check("6 turning the phone mid-level keeps the order", !!before && before === after && !!mid, {
  before,
  mid,
  after,
});
const geom = await geometryFromCanvas(page);
const played = await playToReport(page, {
  geom,
  until: () =>
    document.querySelector('[data-testid="cooking-clip"]')?.getAttribute("aria-hidden") === "false",
});
let report = played.ok;
if (played.stopped) {
  await page
    .waitForFunction(
      () =>
        document.querySelector('[data-testid="cooking-clip"]')?.getAttribute("aria-hidden") !==
        "false",
      { timeout: 20000 },
    )
    .catch(() => null);
  report = (await playToReport(page, { geom })).ok;
}
const reportShown = await page.evaluate(() => /KNIFE REPORT/i.test(document.body.innerText));
check(
  "4b Level 3 plays to its Knife Report in landscape",
  report && reportShown,
  played.log.slice(-3),
);

/* ── 5. Cleaning ── */
await boot(
  page,
  levelSave({
    business: {
      cleanliness: {
        tasks: [{ kind: "tables", count: 1, since: N - 1 }],
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: [],
        introSeen: true,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
  }),
);
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await sleep(1400);
await page.evaluate(() =>
  [...document.querySelectorAll(".map-hotspot-zone")]
    .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
    ?.click(),
);
await sleep(900);
await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
    .find((x) => x.textContent.includes("Cleanliness"))
    ?.click(),
);
await sleep(900);
await page.evaluate(() => {
  const card = document.querySelector('[data-testid="area-dining"]');
  if (!card?.querySelector('[data-task="tables"]')) card?.querySelector("button")?.click();
});
await sleep(500);
await page.evaluate(() =>
  [...(document.querySelector('[data-task="tables"]')?.querySelectorAll("button") ?? [])]
    .find((x) => !x.disabled && /Clean/.test(x.textContent))
    ?.click(),
);
await page.waitForSelector('[data-testid="cleaning-stage"]', { timeout: 8000 }).catch(() => null);
await sleep(900);
const clean0 = await page.evaluate(() => {
  const stage = document.querySelector('[data-testid="cleaning-stage"]')?.getBoundingClientRect();
  const img = document.querySelector('[data-testid="cleaning-stage"] img');
  const bar = document.querySelector('[role="progressbar"]')?.getBoundingClientRect();
  return {
    scene: document.querySelector("[data-orient-scene]")?.getAttribute("data-orient-scene"),
    art: img?.getAttribute("src") ?? "",
    stage: stage && {
      w: Math.round(stage.width),
      h: Math.round(stage.height),
      right: Math.round(stage.right),
    },
    barLeft: bar ? Math.round(bar.left) : null,
  };
});
const box = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="cleaning-dirt"]').getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
let spotless = false;
for (let pass = 0; pass < 6 && !spotless; pass++) {
  for (let y = box.y + 8; y < box.y + box.h - 8 && !spotless; y += 14) {
    await page.mouse.move(box.x + 6, y);
    await page.mouse.down();
    for (let x = box.x + 6; x < box.x + box.w - 6; x += 20)
      await page.mouse.move(x, y, { steps: 1 });
    await page.mouse.up();
    spotless = !!(await page.$('[data-testid="cleaning-spotless"]'));
  }
}
check(
  "5 a cleaning opens on its landscape painting, the tools beside the room, and reaches Spotless",
  clean0.scene === "landscape" &&
    /landscape-art\/cleaning\/dining-/.test(clean0.art) &&
    !!clean0.stage &&
    clean0.stage.w > clean0.stage.h &&
    clean0.barLeft !== null &&
    clean0.barLeft >= clean0.stage.right - 2 &&
    spotless,
  { ...clean0, spotless },
);

/* ── 7. console ── */
const errors = logs.filter((l) => /pageerror|error:/i.test(l));
check("7 no console errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
