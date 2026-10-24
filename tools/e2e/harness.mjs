// Headless Chrome driver for the REAL KnifeCraft build (Playgama Bridge edition).
// Separate throwaway profile — never touches your own Chrome or save.
//
// Saves live in Bridge storage (key "knifecraft_save"), not in the game's own
// localStorage key. Outside Playgama the Bridge runs its local "mock" platform,
// which keeps that storage in localStorage — so clearing localStorage still
// gives a brand-new player, and seeding/reading goes through window.bridge.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

export const OUT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
export const GAME_URL = process.env.KC_URL || "http://localhost:4173/";
export const SAVE_KEY = "knifecraft_save";

/**
 * `nameCard: true` leaves the one-time restaurant naming card (2026-10-17) on screen for the
 * test to answer (restaurantname.mjs); otherwise a new player's card is answered with
 * "Keep" as soon as it shows, so tests about other things carry on past it.
 */
export async function launch({ nameCard = false } = {}) {
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    userDataDir: OUT + "profile-" + Date.now(),
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--no-first-run",
    ],
    defaultViewport: { width: 430, height: 900, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  if (!nameCard)
    await page.evaluateOnNewDocument(() => {
      const keep = () =>
        [...document.querySelectorAll('[data-testid="restaurant-name-card"] button')]
          .find((b) => /^Keep /.test(b.textContent.trim()))
          ?.click();
      new MutationObserver(keep).observe(document, { childList: true, subtree: true });
    });
  const logs = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => logs.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  return { browser, page, logs };
}

/** A returning player at Level 10 (levels 1-9 done). `version: 1` saves are migrated on load (credits x100 into USD cents). */
/**
 * Unified Restaurant phase M: a seeded save marked as already moved into the
 * unified restaurant, so the restaurant test build gives it no starter crate
 * (tests that check an empty fridge or missing plates need it).
 * `restaurantmigration.mjs` seeds without it on purpose.
 */
/**
 * Supplies plan A (2026-10-10): a restaurant past Level 10 owns its kitchen tools; the tests
 * that aren't about tools start with a full set (4 of each: enough for a full line of cooks).
 * restauranttools.mjs starts from an empty kitchen instead.
 */
export const KITCHEN_TOOLS = [
  "stock-pot",
  "saucepans",
  "frying-pans",
  "saute-pans",
  "tongs",
  "spatulas",
  "ladles",
  "whisks",
  "peelers",
  "graters",
  "skimmers",
  "sheet-pans",
  "mixing-bowls",
  "storage-containers",
  "measuring-cups",
  "kitchen-scales",
  "thermometers",
  "oven-mitts",
];
export const MOVED_IN_BUSINESS = {
  // RESTAURANT_MIGRATION_VERSION (2): an older stamp re-runs the move-in and its starter crate.
  restaurantMigration: { version: 2, atLevel: 1, kit: [], seen: true },
  grandmasTools: { atLevel: 10 },
  supplies: {
    stock: Object.fromEntries(KITCHEN_TOOLS.map((id) => [id, { units: 4, costBasis: 400 }])),
  },
};

/** The ledger entry that says today's free daily gift was taken (adBonuses.ts dailyGiftId). */
export function GIFT_TAKEN_TODAY() {
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    id: "seed-daily-gift",
    timestamp: Date.now(),
    category: "daily-reward",
    amount: 20,
    description: `knifecraft-daily-gift-${key}`,
  };
}

export function seedSave(overrides = {}) {
  const completed = Array.from({ length: 9 }, (_, i) => `level-${i + 1}`);
  return {
    version: 1,
    credits: 400,
    ownedKnifeIds: ["chef"],
    equippedKnifeId: "chef",
    levelProgress: {
      currentLevelId: "level-10",
      highestUnlockedLevelId: "level-10",
      completedLevelIds: completed,
    },
    story: { introDone: true, milestoneMask: 1, finaleSeen: false },
    // Today's welcome gift (ads/adBonuses.ts, 2026-10-18) is already taken, so its sheet doesn't
    // cover the Kitchen; adbonuses.mjs seeds a save without it on purpose.
    economyLedger: [GIFT_TAKEN_TODAY()],
    ...overrides,
    // Seeds use the 150-level campaign's numbers (2026-10-15). Without the stamp the game
    // renumbers a save as a 250-level one; a test of that migration passes
    // `campaignVersion: undefined` (dropped when the save is written).
    levelProgress: {
      campaignVersion: 2,
      ...(overrides.levelProgress ?? {
        currentLevelId: "level-10",
        highestUnlockedLevelId: "level-10",
        completedLevelIds: completed,
      }),
    },
    // The restaurant is already named (2026-10-17) so the one-time naming card doesn't
    // cover the screen; restaurantname.mjs seeds a save without one on purpose.
    settings: {
      sound: true,
      music: true,
      reducedMotion: false,
      restaurantName: "Test Kitchen",
      ...(overrides.settings ?? {}),
    },
  };
}

/** A brand-new player meets the naming card after the intro: keep the default name. */
export async function passNameCard(page) {
  await page
    .waitForSelector('[data-testid="restaurant-name-card"]', { timeout: 8000 })
    .catch(() => null);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="restaurant-name-card"] button')]
      .find((b) => /^Keep /.test(b.textContent.trim()))
      ?.click(),
  );
  await new Promise((r) => setTimeout(r, 600));
}

const waitForBridge = (page) =>
  page.waitForFunction(() => !!window.bridge && document.body.innerText.length > 20, {
    timeout: 30000,
  });

/** Brand-new player: empty storage, reload (the intro will play). */
export async function freshPlayer(page) {
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
}

/** Loads the game with `save` in Bridge storage. */
export async function boot(page, save) {
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });
  await waitForBridge(page);
  await page.evaluate(
    async (s, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    save,
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll("button").length > 3, {
    timeout: 20000,
  });
}

/** The save as persisted in Bridge storage (null for a player who has never saved). */
export const readSave = (page) =>
  page.evaluate(async (key) => {
    const [v] = await window.bridge.storage.get([key]);
    if (v === null || v === undefined) return null;
    return typeof v === "string" ? JSON.parse(v) : v;
  }, SAVE_KEY);

/** Replaces the persisted save (then reload to apply). */
export const writeSave = (page, s) =>
  page.evaluate(
    async (value, key) => window.bridge.storage.set([key], [JSON.stringify(value)]),
    s,
    SAVE_KEY,
  );

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Click the first visible button whose text matches. A match inside a folded section (e.g. the
 * Kitchen's order card, folded by default since 2026-10-16) is reached the way the player does:
 * its disclosure toggle (`aria-controls`) is opened first.
 */
export async function clickButton(page, re) {
  const tap = () =>
    page.evaluate((src) => {
      const re = new RegExp(src);
      const all = [...document.querySelectorAll("button")].filter(
        (x) => re.test(x.textContent.trim()) && !x.disabled,
      );
      const b = all.find((x) => x.offsetParent !== null);
      if (b) {
        b.scrollIntoView({ block: "center" });
        b.click();
        return "clicked";
      }
      for (const x of all) {
        const region = x.closest("[hidden][id]");
        const toggle =
          region && document.querySelector(`[aria-controls="${region.id}"][aria-expanded="false"]`);
        if (toggle) {
          toggle.click();
          return "unfolded";
        }
      }
      return "none";
    }, re.source);
  let r = await tap();
  if (r === "unfolded") {
    await sleep(300);
    r = await tap();
  }
  await sleep(250);
  return r === "clicked";
}

/**
 * Opens a section the way the player does now. The bottom bar holds Kitchen · Market ·
 * Restaurant; the Restaurant tab opens the map, whose hotspots lead to Inventory and to the
 * back office (older tests call it "Business" or "Restaurant"); Progress opens from the
 * Kitchen's rank badge. Returns false when the section can't be reached.
 */
export async function openSection(page, label) {
  const tab = (id) =>
    page.evaluate((i) => {
      const b = document.querySelector(`[data-nav="${i}"]`);
      b?.click();
      return !!b;
    }, id);
  if (label === "Kitchen") return tab("kitchen");
  if (label === "Market") return tab("shop");
  if (label === "Progress") {
    await tab("kitchen");
    await sleep(600);
    const ok = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="kitchen-rank"]');
      b?.click();
      return !!b;
    });
    // With achievement money waiting the card opens Achievements (2026-10-18); Back → Progress.
    await sleep(600);
    if (await page.$('[data-testid="achievements-waiting"]')) {
      await page.evaluate(() => document.querySelector('[aria-label="Back"]')?.click());
      await sleep(600);
    }
    return ok;
  }
  const zone = {
    Inventory: /^Inventory /,
    Business: /^Manager \/ Office/,
    Restaurant: /^Manager \/ Office/,
    Service: /^Service Counter/,
  }[label];
  if (!zone) return false;
  await tab("restaurant-map");
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(500);
  const ok = await page.evaluate((src) => {
    const z = [...document.querySelectorAll(".map-hotspot-zone")].find((e) =>
      new RegExp(src).test(e.getAttribute("aria-label") ?? ""),
    );
    z?.click();
    return !!z;
  }, zone.source);
  await sleep(500);
  return ok;
}

/**
 * Opens a Kitchen shortcut (Daily Check, Inventory, Business) the way a tap does: the first tap
 * shows its label, the second opens it (Kitchen.tsx, 5db9451); from another screen it goes to the
 * Kitchen first. Returns false when there is none.
 */
export async function openShortcut(page, id) {
  const tap = () =>
    page.evaluate((i) => {
      const b = document.querySelector(`[data-testid="${i}-shortcut"]`);
      b?.click();
      return !!b;
    }, id);
  if (!(await tap())) {
    // The shortcuts live on the Kitchen home.
    await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
    await sleep(700);
    if (!(await tap())) return false;
  }
  await sleep(250);
  await tap();
  await sleep(600);
  return true;
}

export async function shot(page, name) {
  fs.mkdirSync(OUT + "out", { recursive: true });
  await page.screenshot({ path: OUT + "out/" + name + ".png" });
}

export const text = (page) => page.evaluate(() => document.body.innerText);

export function save(name, data) {
  fs.mkdirSync(OUT + "out", { recursive: true });
  fs.writeFileSync(
    OUT + "out/" + name,
    typeof data === "string" ? data : JSON.stringify(data, null, 2),
  );
}

/**
 * Supplies plan A (2026-10-10): buys every kitchen tool the open Pre-Service Check is missing
 * (its Buy → the Market's card, preselected with the packs → Buy → back), as a player would —
 * e.g. the extra pans a newly hired cook needs. Returns the tools bought.
 */
export async function buyMissingTools(page) {
  const bought = [];
  for (let i = 0; i < 20; i++) {
    const id = await page.evaluate(() => {
      const row = document.querySelector('[data-psc-tool][data-psc-status="missing"]');
      // The row's Buy (its ⓘ, since the 2026-10-16 copy sweep, comes first).
      [...(row?.querySelectorAll("button") ?? [])]
        .find((b) => /^(Buy|Restock)/.test(b.textContent.trim()))
        ?.click();
      return row?.getAttribute("data-psc-tool") ?? null;
    });
    if (!id) break;
    await sleep(900);
    await page.evaluate((id) => {
      const card = document.querySelector(`[data-supply="${id}"]`);
      [...(card?.querySelectorAll("button") ?? [])]
        .find((b) => /^Buy · /.test(b.textContent.trim()))
        ?.click();
    }, id);
    await sleep(500);
    await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
    await sleep(900);
    bought.push(id);
  }
  return bought;
}

/**
 * Scrubs the sink game's current kind clean (zig-zag drags across the basin);
 * true once that kind is washed (or the sink says it's empty).
 */
export async function scrubSinkPiece(page) {
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

/** With the sink game open: scrubs every kind clean, then closes it. */
export async function washWholeSink(page) {
  const kinds = await page.evaluate(() => document.querySelectorAll("[data-wash-line]").length);
  let all = true;
  for (let i = 0; i < kinds; i++) all = (await scrubSinkPiece(page)) && all;
  await sleep(900);
  await page.evaluate(() =>
    (
      [...document.querySelectorAll('[data-testid="wash-up-sink"] button')].find((b) =>
        /Done/.test(b.textContent),
      ) ?? document.querySelector('[aria-label="Close the sink"]')
    )?.click(),
  );
  await sleep(500);
  return all;
}

/**
 * The cleaning game (Restaurant → Cleanliness, Closing Time, the Pre-Service
 * Check): scrubs the room row by row until Spotless, then taps Done. True
 * when the task was cleaned.
 */
export async function playCleaningGame(page, passes = 8) {
  const up = await page
    .waitForSelector('[data-testid="cleaning-stage"]', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!up) return false;
  await sleep(600);
  const spotless = () =>
    page.evaluate(() => !!document.querySelector('[data-testid="cleaning-spotless"]'));
  for (let i = 0; i < passes && !(await spotless()); i++) {
    const b = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="cleaning-dirt"]')?.getBoundingClientRect();
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    });
    if (!b) break;
    for (let y = b.y + 10; y < b.y + b.h - 10; y += 18) {
      await page.evaluate(() =>
        document.querySelector('button[data-tool][data-suggested="true"]')?.click(),
      );
      await page.mouse.move(b.x + 8, y);
      await page.mouse.down();
      for (let x = b.x + 8; x < b.x + b.w - 8; x += 22) await page.mouse.move(x, y, { steps: 1 });
      await page.mouse.up();
      if (await spotless()) break;
    }
  }
  await sleep(500);
  const ok = await spotless();
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="cleaning-spotless"] button')].at(0)?.click(),
  );
  await sleep(900);
  return ok;
}

/**
 * Closing Time (developer 2026-10-24: tonight's chores are Cleanliness tasks):
 * does every row still to do — the cleaning game for scrubbing tasks, one tap
 * for the rest, the sink game for the dishes, the till. True when nothing is left.
 */
export async function doClosingChores(page) {
  for (let i = 0; i < 24; i++) {
    const next = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="closing-chores"] [data-chore-by="todo"]');
      if (!row) return null;
      const sink = !!row.querySelector('[data-testid="sink-wash"]');
      const button = row.querySelector("button");
      const game = /Clean/.test(button?.textContent ?? "");
      button?.click();
      return sink ? "sink" : game ? "game" : "tap";
    });
    if (!next) return true;
    await sleep(700);
    if (next === "sink") await washWholeSink(page);
    if (next === "game") await playCleaningGame(page);
  }
  return false;
}
