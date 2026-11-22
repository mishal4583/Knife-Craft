// The loading screen (developer 2026-11-18), restaurant build, in a real browser on a slow phone connection: index.html paints it before any script
// arrives; src/lib/bootSplash.ts fills its bar with real progress and removes it when the first screen's pictures are ready.
//   L1 under a second in, on Slow 4G: the page is NOT blank (the loading screen is there, with its placeholder painting)
//   L2 the bar only ever moves forward, and ends full
//   L3 it goes away by itself (html[data-booted=1], the element removed) and the game is on screen
//   L4 when it leaves, the Kitchen's backdrop is already loaded (the room does not paint in afterwards)
//   L5 a brand-new player: it stays until the first story picture is in, then the story shows
//   L6 at 320 x 568, 390 x 844 and 1280 x 720 the logo and the bar are fully on screen, nothing scrolls sideways
//   L7 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  seedSave,
  sleep,
  SAVE_KEY,
  GAME_URL,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = seedSave({
  credits: 500000,
  business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET },
  levelProgress: {
    currentLevelId: "level-20",
    highestUnlockedLevelId: "level-20",
    completedLevelIds: Array.from({ length: 19 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.bridge, { timeout: 20000 });
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

const seed = (withSave) =>
  page.evaluate(
    async (s, key, w) => {
      localStorage.clear();
      if (w) await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    save,
    SAVE_KEY,
    withSave,
  );
const slow = () =>
  cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6 * 125000,
    uploadThroughput: 1.6 * 125000,
  });

// what the page records about itself while it loads
await page.evaluateOnNewDocument(() => {
  window.__bs = { p: [], leaving: null };
  const t0 = performance.now();
  const sample = () => {
    const el = document.getElementById("boot-splash");
    if (!el) return;
    const v = parseFloat(el.style.getPropertyValue("--p") || "0.18");
    window.__bs.p.push(Number.isFinite(v) ? v : 0.18);
    if (el.classList.contains("leaving") && window.__bs.leaving === null) {
      const img = document.querySelector('img[alt^="The player"]');
      window.__bs.leaving = {
        at: Math.round(performance.now() - t0),
        kitchenImg: img ? img.complete && img.naturalWidth > 0 : "none-yet",
      };
    }
  };
  setInterval(sample, 40);
});

// L1..L4: a returning player on Slow 4G
await seed(true);
await slow();
page.goto(GAME_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForSelector("#boot-splash", { timeout: 8000 }).catch(() => {});
await sleep(300);
const early = await page.evaluate(() => {
  const el = document.getElementById("boot-splash");
  const stage = el?.querySelector(".bs-stage");
  return {
    present: !!el,
    placeholder: stage ? /data:image\/webp/.test(getComputedStyle(stage).backgroundImage) : false,
  };
});
check(
  "L1 under a second in, on Slow 4G, the loading screen is on screen with its placeholder painting (not a white page)",
  early.present && early.placeholder,
  early,
);
await page
  .waitForFunction(() => document.documentElement.dataset.booted === "1", { timeout: 60000 })
  .catch(() => {});
await sleep(900);
const bs = await page.evaluate(() => window.__bs);
const forward = bs.p.every((v, i) => i === 0 || v >= bs.p[i - 1] - 1e-9);
check(
  "L2 the bar only moves forward and ends full",
  bs.p.length > 3 && forward && Math.max(...bs.p) >= 0.99,
  {
    samples: bs.p.length,
    first: bs.p[0],
    max: Math.max(...bs.p),
  },
);
const gone = await page.evaluate(() => ({
  booted: document.documentElement.dataset.booted,
  splash: !!document.getElementById("boot-splash"),
  buttons: document.querySelectorAll("button").length,
}));
check(
  "L3 it goes away by itself and the game is on screen",
  gone.booted === "1" && !gone.splash && gone.buttons > 3,
  gone,
);
check(
  "L4 when it leaves, the Kitchen's backdrop is already loaded (the room does not paint in afterwards)",
  bs.leaving?.kitchenImg === true,
  bs.leaving,
);
await shot(page, "loading-after");

// L5: a brand-new player
await seed(false);
await slow();
page.goto(GAME_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
await sleep(1500);
const stillThere = await page.evaluate(() => !!document.getElementById("boot-splash"));
await page
  .waitForFunction(() => document.documentElement.dataset.booted === "1", { timeout: 90000 })
  .catch(() => {});
await sleep(900);
const intro = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")].filter((i) =>
    /intro-1-key|intro-2-kitchen/.test(i.src),
  );
  return {
    splash: !!document.getElementById("boot-splash"),
    storyImgsLoaded: imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0),
    imgs: imgs.length,
  };
});
check(
  "L5 a brand-new player: the loading screen is there while the story's first pictures arrive, then goes and the story is on screen with its picture loaded",
  stillThere && !intro.splash && intro.imgs > 0 && intro.storyImgsLoaded,
  { stillThere, intro },
);
await shot(page, "loading-new-after");

// L6: sizes (the loading screen of a returning player, caught early)
const sizes = [
  [320, 568],
  [390, 844],
  [1280, 720],
  [1920, 1080],
  [1500, 700],
  [1000, 700],
];
let allFit = true;
const wideChecks = [];
const detail = [];
for (const [w, h] of sizes) {
  await seed(true);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await slow();
  page.goto(GAME_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
  // RULE CHANGE (developer 2026-11-22): in a wide window the screen is ONE picture (.bs-wpic) with the real fill over its track (.bs-wtrack); the upright pieces are hidden.
  await page
    .waitForSelector(w / h >= 1.3 ? ".bs-wpic.in" : ".bs-logo.in", { timeout: 30000 })
    .catch(() => {});
  await sleep(300);
  const r = await page.evaluate(() => {
    const box = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom };
    };
    return {
      logo: box(
        innerWidth / innerHeight >= 1.3 ? "#boot-splash .bs-wtrack" : "#boot-splash .bs-logo",
      ),
      bar: box(
        innerWidth / innerHeight >= 1.3 ? "#boot-splash .bs-wtrack" : "#boot-splash .bs-bar",
      ),
      iw: innerWidth,
      ih: innerHeight,
      sideways: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  const inside = (b) => !!b && b.l >= -1 && b.t >= -1 && b.r <= r.iw + 1 && b.b <= r.ih + 1;
  const ok = inside(r.logo) && inside(r.bar) && !r.sideways;
  allFit = allFit && ok;
  const rd = (b) => b && [Math.round(b.l), Math.round(b.t), Math.round(b.r), Math.round(b.b)];
  detail.push({ w, h, ok, logo: rd(r.logo), bar: rd(r.bar) });
  if (w / h >= 1.3) {
    // The fill sits over the picture's empty track: its box is the picture's track box (x 537-1382, y 951-989 of 1920 x 1080), and it grows with the real progress.
    const wide = await page.evaluate(() => {
      const pic = document.querySelector("#boot-splash .bs-wpic")?.getBoundingClientRect().toJSON();
      const tr = document
        .querySelector("#boot-splash .bs-wtrack")
        ?.getBoundingClientRect()
        .toJSON();
      const fill = document.querySelector("#boot-splash .bs-wfill");
      const el = document.getElementById("boot-splash");
      el?.style.setProperty("--p", "0.2");
      return { pic, tr, fillIsGreen: !!fill };
    });
    await sleep(700);
    wide.w1 = await page.evaluate(
      () => document.querySelector("#boot-splash .bs-wfill")?.getBoundingClientRect().width ?? 0,
    );
    await page.evaluate(() =>
      document.getElementById("boot-splash")?.style.setProperty("--p", "0.8"),
    );
    await sleep(700);
    const w2 = await page.evaluate(
      () => document.querySelector("#boot-splash .bs-wfill")?.getBoundingClientRect().width ?? 0,
    );
    const k = (wide.pic?.width ?? 1) / 1920;
    const near = (a, b) => Math.abs(a - b) < 2.5;
    const sized =
      !!wide.pic &&
      !!wide.tr &&
      near(wide.tr.left, wide.pic.left + 537 * k) &&
      near(wide.tr.top, wide.pic.top + 951 * k) &&
      near(wide.tr.width, 845 * k) &&
      wide.pic.width >= w - 1 &&
      wide.pic.height >= h - 1;
    wideChecks.push({
      w,
      h,
      sized,
      tr: wide.tr && [Math.round(wide.tr.left), Math.round(wide.tr.top), Math.round(wide.tr.width)],
      pic: wide.pic && [
        Math.round(wide.pic.left),
        Math.round(wide.pic.top),
        Math.round(wide.pic.width),
        Math.round(wide.pic.height),
      ],
      grows: w2 > wide.w1 * 2,
      w1: Math.round(wide.w1),
      w2: Math.round(w2),
    });
  }
  await shot(page, `loading-${w}x${h}`);
  await page
    .waitForFunction(() => document.documentElement.dataset.booted === "1", { timeout: 60000 })
    .catch(() => {});
}
check(
  "L6 at 320 x 568, 390 x 844 and 1280 x 720 the logo and the bar are fully on screen, nothing scrolls sideways",
  allFit,
  detail,
);

check(
  "L8 in a wide window (1280 x 720, 1920 x 1080, 1500 x 700, 1000 x 700) the picture covers the window, the real fill sits exactly over the picture's empty track and grows with the progress",
  wideChecks.length === 4 && wideChecks.every((c) => c.sized && c.grows),
  wideChecks,
);

const bad = logs.filter((l) => /error/i.test(l) && !/Failed to load resource|net::ERR/i.test(l));
check("L7 no console errors", bad.length === 0, bad.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nLOADING SCREEN: ${failed.length} FAILED` : "\nLOADING SCREEN: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
