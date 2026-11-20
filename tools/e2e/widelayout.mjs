// The list screens are ONE reading column in a wide window (developer 2026-11-19: "every page feels so wide and not optimized"), restaurant build, real browser:
//   W1 at 1917x912 and 1280x720 every block of Market, Business (all eight tabs), Inventory, Restaurant Progress, Achievements and Settings is at most 1040 px wide
//      (--kc-col) and sits in the middle of the room beside the rail (equal space left and right, within 2 px); no sideways scroll
//   W2 the Kitchen home fills the window with its true wide picture; the restaurant map is the wide plan covering the window, 12 rooms and 12 signs (RULE CHANGE 2026-11-20)
//   W3 every section banner shows its WHOLE picture (its own shape, not a fixed-height strip) in a window at least 520 px tall; the small landscape ones
//      (72 / 56 / 64 px) on a short phone (844x390)
//   W4 a phone on its side (844x390) is not changed: its blocks are as wide as the room beside the rail (the column is wider than the phone), no sideways scroll
//   W5 the Mini-games sheet is a bottom sheet at every size: its bottom edge is the bottom of the window (the painted panel has no bottom edge)
//   W6 no console errors
//   W7 on a slow connection a Business tab click never blanks the page (the Staff blink)
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
const n = 55;
const save = seedSave({
  credits: 500_000,
  business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET, sectionsSeen: SEEN },
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});
const { browser, page, logs } = await launch();

async function fresh(w, h) {
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
  await page.waitForSelector('[data-testid="minigames-shortcut"]', { timeout: 20000 });
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(600);
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

/** The screen's blocks: the children of the scrolling box that sits beside the rail. */
const blocks = () =>
  page.evaluate(() => {
    const gc = document.querySelector("[data-game-content]");
    const k = gc ? gc.getBoundingClientRect().width / gc.offsetWidth : 1;
    const vw = document.documentElement.clientWidth / k;
    const nav = document.querySelector("nav[data-bottom-nav]");
    const parent = nav?.parentElement;
    if (!parent) return null;
    const rail = nav.getBoundingClientRect().right / k;
    const scroller =
      parent.querySelector(".overflow-y-auto") ??
      [...parent.children].find((c) => c !== nav && c.scrollHeight > 0);
    const kids = scroller ? [...scroller.querySelectorAll(":scope > *, :scope > * > *")] : [];
    const rects = kids
      .map((k) => {
        const cs = getComputedStyle(k);
        return { r: k.getBoundingClientRect(), pos: cs.position };
      })
      .filter(
        (o) =>
          o.r.width > 200 &&
          o.r.height > 8 &&
          o.pos !== "absolute" &&
          o.pos !== "fixed" &&
          o.pos !== "sticky",
      )
      .map((o) => ({ left: o.r.left / k, right: o.r.right / k, width: o.r.width / k }));
    return {
      vw,
      rail,
      wide: parent.hasAttribute("data-kc-wide"),
      maxW: Math.max(0, ...rects.map((r) => r.width)),
      // the widest block's left and right gaps against the room beside the rail
      gaps: rects
        .sort((a, b) => b.width - a.width)
        .slice(0, 1)
        .map((r) => ({ left: r.left - rail, right: vw - r.right })),
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

const goBusinessTab = async (label) => {
  await clickButton(page, new RegExp(label + "[0-9]*$"));
  await sleep(500);
};

for (const [w, h] of [
  [1917, 912],
  [1280, 720],
]) {
  await fresh(w, h);
  const bad = [];
  const look = async (name) => {
    const b = await blocks();
    if (!b) return bad.push({ name, why: "no screen" });
    const colOk = b.maxW <= 1041;
    const centred =
      b.gaps.length === 0 ||
      Math.abs(b.gaps[0].left - b.gaps[0].right) <= 2 ||
      b.maxW >= b.vw - b.rail - 2 * 12;
    if (!colOk || !centred || b.sideways) bad.push({ name, b });
  };
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(800);
  await look("market");
  await shot(page, `widelayout-market-${w}`);
  await openSection(page, "Inventory").catch(() => {});
  await sleep(700);
  await look("inventory");
  await openSection(page, "Business").catch(() => {});
  await sleep(700);
  for (const tab of [
    "Overview",
    "Equipment",
    "Upgrades",
    "Staff",
    "Suppliers",
    "Menu",
    "Operations",
  ]) {
    await goBusinessTab(tab);
    await look("business-" + tab);
  }
  await shot(page, `widelayout-business-${w}`);
  await openSection(page, "Progress").catch(() => {});
  await sleep(700);
  await look("progress");
  check(
    `W1 at ${w}x${h} the list screens are one centred column of at most 1040 px, no sideways scroll`,
    bad.length === 0,
    bad.slice(0, 3),
  );

  // W2 + W3
  await fresh(w, h);
  const k = await page.evaluate(() => {
    const nav = document.querySelector("nav[data-bottom-nav]");
    const root = nav?.parentElement;
    const card = document.querySelector('[data-testid="day-strip"]')?.parentElement;
    return {
      wide: root?.hasAttribute("data-kc-wide"),
      framed: document.querySelector("[data-game-frame]")?.getAttribute("data-game-frame"),
      rootW: root?.getBoundingClientRect().width,
      rootX: root?.getBoundingClientRect().x,
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      landArt: document.querySelectorAll('img[src*="landscape-art"]').length,
      cardW: card
        ? card.getBoundingClientRect().width /
          (document.querySelector("[data-game-content]").getBoundingClientRect().width /
            document.querySelector("[data-game-content]").offsetWidth)
        : null,
    };
  });
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await sleep(1500);
  const m = await page.evaluate(async () => {
    const nav = document.querySelector("nav[data-bottom-nav]");
    const root = nav?.parentElement;
    const stage = document.querySelector('[data-testid="wide-map-stage"]');
    const vpEl = document.querySelector(".restaurant-map-viewport");
    const img = stage?.querySelector("img.restaurant-vector-map");
    if (img && !img.complete)
      await new Promise((r) => {
        img.onload = r;
        img.onerror = r;
        setTimeout(r, 4000);
      });
    const sr = stage?.getBoundingClientRect();
    const vr = vpEl?.getBoundingClientRect();
    return {
      wide: root?.hasAttribute("data-kc-wide"),
      framed: document.querySelector("[data-game-frame]")?.getAttribute("data-game-frame"),
      rootW: root?.getBoundingClientRect().width,
      vw: document.documentElement.clientWidth,
      src: img?.getAttribute("src") ?? null,
      natural: img ? [img.naturalWidth, img.naturalHeight] : null,
      stage: sr
        ? { l: sr.left, t: sr.top, r: sr.right, b: sr.bottom, w: sr.width, h: sr.height }
        : null,
      vp: vr ? { l: vr.left, t: vr.top, r: vr.right, b: vr.bottom } : null,
      zones: document.querySelectorAll(".map-hotspot-zone").length,
      signs: document.querySelectorAll(".wide-sign").length,
      portraitArt: document.querySelectorAll('img[src*="kitchen-upgrade-map"]').length,
    };
  });
  // RULE CHANGE 2026-11-20 (twice). First, the first Codex pictures kept the portrait picture in their middle, so the Kitchen, the map and the Second Floor were the
  // 9:16 box for a while. Then the TRUE landscape pictures arrived (TL-*.png, docs/planning/LANDSCAPE-TRUE-PICTURES-CODEX-PROMPTS-2026-11-20.md): the Kitchen fills the
  // window with its own wide picture, and the map is the wide 16:9 floor plan, sized to COVER the window (no bar), with its 12 rooms, their 12 printed signs, and no
  // portrait map picture. (W2 used to demand the whole window for a picture with the portrait map in its middle, then the 9:16 box.)
  const covers =
    m.stage &&
    m.vp &&
    m.stage.l <= m.vp.l + 2 &&
    m.stage.t <= m.vp.t + 2 &&
    m.stage.r >= m.vp.r - 2 &&
    m.stage.b >= m.vp.b - 2 &&
    Math.abs(m.stage.w / m.stage.h - 16 / 9) < 0.02;
  check(
    `W2 at ${w}x${h} the Kitchen home fills the window with its wide picture; the restaurant map is the wide plan covering the window (12 rooms, 12 signs, no portrait map); the order card is at most 760 px`,
    k.wide &&
      k.framed === "full" &&
      k.rootW >= k.vw - 100 &&
      k.landArt >= 1 &&
      Math.round(k.cardW) <= 760 &&
      m.wide &&
      m.framed === "full" &&
      covers &&
      /landscape-art\/true\/map-[a-z-]+\.webp/.test(m.src ?? "") &&
      m.natural?.[0] === 1920 &&
      m.natural?.[1] === 1080 &&
      m.zones === 12 &&
      m.signs === 12 &&
      m.portraitArt === 0,
    { k, m },
  );
  const banner = async (fn) => {
    await fresh(w, h);
    return fn();
  };
  const heights = {};
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(700);
  // RULE CHANGE 2026-11-20 (developer: "only a random portion is visible"): a banner is its picture's OWN shape, so the whole picture shows (before: 120 / 168 px strips).
  // Every banner of the Market, the Business tabs and the Inventory: its box has the picture's width / height (within 2 %), the picture fills the box, and it is
  // centred and no taller than 280 px.
  const whole = () =>
    page.evaluate(() => {
      const g = document.querySelector("[data-game-content]");
      const k = g.getBoundingClientRect().width / g.offsetWidth;
      return [...document.querySelectorAll(".kc-banner")]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => {
          const i = b.querySelector("img");
          const r = b.getBoundingClientRect();
          const ir = i.getBoundingClientRect();
          return {
            ratio: r.width / r.height,
            natural: i.naturalWidth / i.naturalHeight,
            fills: Math.abs(ir.width - r.width) <= 4 && Math.abs(ir.height - r.height) <= 4,
            h: r.height / k,
          };
        });
    });
  const banners = {};
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(800);
  banners.market = await whole();
  await openSection(page, "Business").catch(() => {});
  await sleep(600);
  for (const tab of ["Equipment", "Staff", "Suppliers", "Menu", "Operations"]) {
    await goBusinessTab(tab);
    await sleep(300);
    banners["business-" + tab] = await whole();
  }
  await openSection(page, "Inventory").catch(() => {});
  await sleep(700);
  banners.inventory = await whole();
  const badBanners = Object.entries(banners).filter(
    ([, list]) =>
      list.length === 0 ||
      list.some((b) => Math.abs(b.ratio / b.natural - 1) > 0.02 || !b.fills || b.h > 281),
  );
  check(
    `W3 at ${w}x${h} every banner shows its WHOLE picture (own shape, filled, at most 280 px tall)`,
    badBanners.length === 0,
    badBanners.slice(0, 3),
  );
  // W5
  await fresh(w, h);
  await page.click('[data-testid="minigames-shortcut"]');
  await sleep(700);
  const sheet = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="minigames-sheet"]')?.getBoundingClientRect();
    return r ? { bottom: r.bottom, vh: document.documentElement.clientHeight } : null;
  });
  await shot(page, `widelayout-sheet-${w}`);
  check(
    `W5 at ${w}x${h} the Mini-games sheet is a bottom sheet (its bottom edge is the window's)`,
    sheet && Math.abs(sheet.bottom - sheet.vh) <= 2,
    sheet,
  );
}

// W4: a phone on its side
await fresh(844, 390);
const ph = [];
await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
await sleep(800);
const pb = await blocks();
const mh = await page.evaluate(
  () => document.querySelector("img[alt^='A friendly merchant']")?.getBoundingClientRect().height,
);
await openSection(page, "Business").catch(() => {});
await sleep(600);
await goBusinessTab("Equipment");
const bh = await page.evaluate(
  () =>
    [...document.querySelectorAll("section")]
      .find((s) => /Kitchen equipment/.test(s.textContent))
      ?.getBoundingClientRect().height,
);
await shot(page, "widelayout-phone-844");
check(
  "W4 a phone on its side (844x390): the blocks use the room beside the rail (no column cap), no sideways scroll, and the banners keep their small heights (Market 72, Business 56)",
  pb && !pb.sideways && pb.maxW >= 844 - 76 - 40 && Math.abs(mh - 72) <= 3 && Math.round(bh) === 56,
  { pb, mh, bh },
);
// W7: the Business tabs never blank the page (developer 2026-11-20: "the Staff page blinks when clicked"). On a slow connection with no cache, a click on each tab keeps
// the ScreenReveal wrapper "ready" the whole time (sampled every 30 ms for 1.5 s): a jump WITHIN a section no longer holds the screen for its pictures.
await fresh(1600, 785);
await openSection(page, "Business").catch(() => {});
await sleep(1200);
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.5 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
const blank = {};
for (const tab of ["Staff", "Suppliers", "Equipment", "Menu", "Operations", "Overview"]) {
  await page.evaluate(() => {
    window.__w = 0;
    const t0 = performance.now();
    const tick = () => {
      if (document.querySelector("[data-screen-reveal='waiting']")) window.__w++;
      if (performance.now() - t0 < 1500) setTimeout(tick, 30);
    };
    tick();
  });
  await goBusinessTab(tab);
  await sleep(1700);
  blank[tab] = await page.evaluate(() => window.__w);
}
check(
  "W7 on a slow connection no Business tab blanks the page (Staff, Suppliers, Equipment, Menu, Operations, Overview)",
  Object.values(blank).every((n) => n === 0),
  blank,
);
check(
  "W6 no console errors",
  logs.filter((l) => /^(error|pageerror):/.test(l)).length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nWIDE LAYOUT E2E: ${failed.length} FAILED` : "\nWIDE LAYOUT E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
