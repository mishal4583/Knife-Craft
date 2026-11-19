// The Kitchen's Mini-games sheet (developer 2026-11-17: every mini-game inside the home kitchen screen, each open from its own level),
// restaurant build, real browser: business/miniGames.ts + components/kc/MiniGamesSheet.tsx + Kitchen.tsx + ScreensRouter.tsx.
// The shelf's rules are proved by scripts/mini-games-qa.mts; this checks the screen that shows them.
//   M1 Level 20: the 🎮 button opens a sheet of eight game logos, all open
//   M2 Level 5: only the games of its level are open; a locked tile says how many services are left (never a level number) and a tap on it does nothing
//   M3 Dessert Run opens from the sheet at the player's level and Back returns to the Kitchen
//   M4 Kitchen Dispatch the same
//   M5 Fridge Check (free play) the same
//   M6 Car Park the same
//   M7 the sheet closes with its button and with a tap outside, and ignores Escape
//   M8 five phone sizes: the sheet inside the screen, no sideways scroll, every tile and button 48 px
//   M9 the button never covers the Next customer card, and the Kitchen's other buttons still open
//   M10 no console errors
//   M11 the painted art (2026-11-18): the sheet has its art on the FIRST tap (no paint-in), eight painted icons, the right card plate per state, a star and glow on a game with
//       something waiting, the lock badge on a locked game, the Kitchen's button shows the painted controller, and no broken picture anywhere
// Screenshots: out/minigames-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
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
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: PAIGE_QUIET,
      // Grandma's pointers are answered, so no guide card covers the Kitchen.
      sectionsSeen: [
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
      ],
    },
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
const SHEET = '[data-testid="minigames-sheet"]';

async function open(level, w = 390, h = 844) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(base, { waitUntil: "domcontentloaded" });
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
  await page.waitForSelector(BTN, { timeout: 20000 });
  // The Playgama loading overlay covers the screen for the first moments; taps before it goes miss.
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(500);
  // The restaurant guide's cards (one step at a time) cover the Kitchen at higher levels: answer each with "Later".
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
const openSheet = async () => {
  await page.click(BTN);
  await page.waitForSelector(SHEET, { timeout: 5000 });
  await sleep(350);
};
const tiles = () =>
  page.$$eval('[data-testid^="minigame-"]', (els) =>
    els.map((e) => ({
      id: e.dataset.testid.replace("minigame-", ""),
      state: e.dataset.state,
      text: e.textContent.replace(/\s+/g, " ").trim(),
    })),
  );
const onKitchen = () => page.$('[data-testid="kitchen-rank"]').then(Boolean);
const clickText = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll("button")].find((x) => rx.test(x.textContent.trim()));
    if (b) b.click();
    return Boolean(b);
  }, re.source);

// M1
await open(20);
await openSheet();
const t20 = await tiles();
const count = await page.$eval('[data-testid="minigames-count"]', (e) => e.textContent.trim());
check(
  "M1 Level 20: the 🎮 button opens a sheet of eight game logos, all open",
  t20.length === 8 && t20.every((t) => t.state !== "locked") && count === "8 of 8 open",
  { n: t20.length, count, states: t20.map((t) => `${t.id}:${t.state}`) },
);
await shot(page, "minigames-20");

// M2
await open(5);
await openSheet();
const t5 = await tiles();
const lockedIds = t5.filter((t) => t.state === "locked").map((t) => t.id);
const openIds = t5.filter((t) => t.state !== "locked").map((t) => t.id);
const dessert5 = t5.find((t) => t.id === "dessert-run");
await page.click('[data-testid="minigame-dessert-run"]');
await sleep(400);
const stillSheet = Boolean(await page.$(SHEET));
check(
  "M2 Level 5: only the games of its level are open; a locked tile says how many services are left (never a level number) and a tap on it does nothing",
  JSON.stringify(openIds.sort()) === JSON.stringify(["fridge-sort", "inspection"]) &&
    lockedIds.length === 6 &&
    /opens in \d+ services?/.test(dessert5.text) &&
    !/Level/.test(dessert5.text) &&
    stillSheet &&
    !(await page.$('[data-testid="dessert-run-game"]')),
  { openIds, lockedIds, dessert: dessert5.text, stillSheet },
);
await shot(page, "minigames-5");

// M3 Dessert Run
await open(20);
await openSheet();
await page.click('[data-testid="minigame-dessert-run"]');
await page.waitForSelector('[data-testid="dessert-run-game"]', { timeout: 15000 });
await sleep(600);
const dessertOpen = !(await page.$(SHEET));
await page.click('[data-testid="dr-back"]');
await sleep(800);
check(
  "M3 Dessert Run opens from the sheet and Back returns to the Kitchen",
  dessertOpen && (await onKitchen()) && !(await page.$('[data-testid="dessert-run-game"]')),
  { dessertOpen },
);

// M4 Kitchen Dispatch
await open(20);
await openSheet();
await page.click('[data-testid="minigame-kitchen-dispatch"]');
await page.waitForSelector('[data-testid="kitchen-dispatch-game"]', { timeout: 15000 });
await sleep(600);
const level4 = (await page.$eval('[data-testid="kd-level"]', (e) => e.textContent)).trim();
await page.click('[data-testid="kd-back"]');
await sleep(800);
check(
  "M4 Kitchen Dispatch opens from the sheet at the player's level and Back returns to the Kitchen",
  level4 === "20" && (await onKitchen()),
  { level4 },
);

// M5 Fridge Check
await open(20);
await openSheet();
await page.click('[data-testid="minigame-fridge-check"]');
await page.waitForSelector('[data-testid="fridge-check"]', { timeout: 15000 });
await sleep(900);
await clickText(/^Let.s go|^Skip|^Got it/i); // a first-time guide, when it shows
await sleep(500);
await page.click('[data-testid="fc-pause"]');
await sleep(400);
const left5 = await clickText(/Leave the check|Leave/);
await sleep(900);
check(
  "M5 Fridge Check (free play) opens from the sheet and leaving returns to the Kitchen",
  left5 && (await onKitchen()),
  {
    left5,
  },
);

// M6 Car Park
await open(20);
await openSheet();
await page.click('[data-testid="minigame-car-park"]');
await page.waitForSelector('[data-testid="car-park-game"]', { timeout: 15000 });
await sleep(900);
await clickText(/^Let.s go/);
await sleep(400);
await page.click('button[aria-label="Pause"]');
await sleep(400);
const left6 = await clickText(/^Leave$/);
await sleep(900);
check(
  "M6 Car Park opens from the sheet and leaving returns to the Kitchen",
  left6 && (await onKitchen()),
  {
    left6,
  },
);

// M7 close
await open(20);
await openSheet();
await page.click('[data-testid="minigames-close"]');
await sleep(300);
const c1 = !(await page.$(SHEET));
// RULE CHANGE 2026-11-19 (Playgama 1.5.2: the game does not use the Esc key): Escape no longer closes the sheet, so it must leave it open.
await openSheet();
await page.keyboard.press("Escape");
await sleep(300);
const c2 = !!(await page.$(SHEET));
await page.click('[data-testid="minigames-close"]');
await sleep(300);
await openSheet();
await page.mouse.click(195, 30); // above the sheet: the dim backdrop
await sleep(300);
const c3 = !(await page.$(SHEET));
check(
  "M7 the sheet closes with its button and with a tap outside, and ignores Escape",
  c1 && c2 && c3,
  {
    c1,
    c2,
    c3,
  },
);

// M8
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
]) {
  await open(20, w, h);
  await openSheet();
  const m = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="minigames-sheet"]').getBoundingClientRect();
    const small = [...document.querySelectorAll('[data-testid="minigames-sheet"] button')]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.width < 47.5 || r.height < 47.5)).length;
    const list = document.querySelector('[data-testid="minigames-sheet"] ul');
    return {
      sw: document.documentElement.scrollWidth,
      iw: innerWidth,
      ih: innerHeight,
      top: s.top,
      bottom: s.bottom,
      left: s.left,
      right: s.right,
      small,
      scrolls: list.scrollHeight > list.clientHeight + 1,
    };
  });
  // The last tile is reachable (the list scrolls when the phone is short).
  await page.$eval('[data-testid="minigame-kitchen-dispatch"]', (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  const reach = await page.$eval('[data-testid="minigame-kitchen-dispatch"]', (e) => {
    const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });
  check(
    `M8 ${w} x ${h}: the sheet inside the screen, no sideways scroll, 48 px tiles, the last game reachable`,
    m.sw <= m.iw &&
      m.small === 0 &&
      m.top >= -1 &&
      m.bottom <= m.ih + 1 &&
      m.left >= -1 &&
      m.right <= m.iw + 1 &&
      reach,
    { ...m, reach },
  );
  if (w === 320) await shot(page, "minigames-320");
  if (w === 390) await shot(page, "minigames-390");
}

// M9
await open(20, 320, 568);
const geo = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="minigames-shortcut"]').getBoundingClientRect();
  const strip = document.querySelector('[data-testid="day-strip"]')?.getBoundingClientRect();
  const card = [...document.querySelectorAll("p")].find((p) => /Next customer/.test(p.textContent));
  const c = card?.closest(".anim-up")?.getBoundingClientRect();
  const others = ["daily-check-shortcut", "inventory-shortcut", "business-shortcut"].map((id) => {
    const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    return r ? { id, top: r.top, bottom: r.bottom } : null;
  });
  return {
    btn: { top: b.top, bottom: b.bottom, left: b.left, right: b.right },
    card: c ? { top: c.top } : null,
    strip: strip ? { top: strip.top } : null,
    others,
    ih: innerHeight,
  };
});
const clear =
  geo.btn.bottom <= (geo.strip?.top ?? geo.card?.top ?? geo.ih) &&
  geo.others.every((o) => !o || o.bottom <= geo.btn.top + 1 || o.top >= geo.btn.bottom - 1);
check(
  "M9 at 320 x 568 the button sits clear of the order card and the other shortcuts",
  clear,
  geo,
);
await shot(page, "minigames-kitchen-320");

// M11: the painted art
await open(20, 390, 844);
await sleep(3000); // the Kitchen fetches the sheet's pictures a moment after it opens
await page.click(BTN);
await page.waitForSelector(SHEET, { timeout: 5000 });
const first = await page.evaluate(() => {
  const sheet = document.querySelector('[data-testid="minigames-sheet"]');
  const btn = document.querySelector('[data-testid="minigames-shortcut-icon"]');
  return {
    artOnFirstFrame: sheet.dataset.art === "1",
    tilesArt: [...document.querySelectorAll('[data-testid^="minigame-"][data-state]')].map(
      (t) => t.dataset.art,
    ),
    shortcutIcon: !!btn && btn.complete && btn.naturalWidth > 0,
  };
});
await sleep(400);
const art = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('[data-testid="minigames-sheet"] img')];
  const plate = (id) => {
    const t = document.querySelector(`[data-testid="minigame-${id}"]`);
    const span = t?.querySelector("span[style*='border-image']");
    return span ? getComputedStyle(span).borderImageSource : "";
  };
  return {
    broken: imgs
      .filter((i) => !(i.complete && i.naturalWidth > 0))
      .map((i) => i.src.split("/").pop()),
    icons: document.querySelectorAll('[data-testid^="mg-icon-"]').length,
    readyPlate: /card-ready/.test(plate("dessert-run")),
    restingPlate: /card-resting/.test(plate("inspection")),
    star: !!document.querySelector('[data-testid="mg-star-sauce"]'),
    glow: !!document.querySelector('[data-testid="mg-glow-sauce"]'),
    noStarOnFreePlay: !document.querySelector('[data-testid="mg-star-dessert-run"]'),
    ribbon: !!document.querySelector('[data-testid="minigames-panel"]'),
  };
});
await shot(page, "minigames-art-390");
await page.click('[data-testid="minigames-close"]');
await open(5, 390, 844);
await sleep(3000);
await openSheet();
const locked = await page.evaluate(() => {
  const t = document.querySelector('[data-testid="minigame-car-park"]');
  const span = t?.querySelector("span[style*='border-image']");
  return {
    state: t?.dataset.state,
    plate: span ? /card-locked/.test(getComputedStyle(span).borderImageSource) : false,
    lockBadge: !!t?.querySelector('img[src*="lock-badge"]'),
  };
});
check(
  "M11 the sheet has its painted art on the first tap, eight icons, the right plate per state, a star and glow for a waiting game (none for free play), the lock badge, the Kitchen button's controller, and no broken picture",
  first.artOnFirstFrame &&
    first.tilesArt.length === 8 &&
    first.tilesArt.every((a) => a === "1") &&
    first.shortcutIcon &&
    art.broken.length === 0 &&
    art.icons === 8 &&
    art.readyPlate &&
    art.restingPlate &&
    art.star &&
    art.glow &&
    art.noStarOnFreePlay &&
    art.ribbon &&
    locked.state === "locked" &&
    locked.plate &&
    locked.lockBadge,
  { first, art, locked },
);

check(
  "M10 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nMINI-GAMES SHEET: ALL PASS");
process.exit(failed.length ? 1 : 0);
