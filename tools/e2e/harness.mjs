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
    economyLedger: [],
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
    return page.evaluate(() => {
      const b = document.querySelector('[data-testid="kitchen-rank"]');
      b?.click();
      return !!b;
    });
  }
  const zone = {
    Inventory: /^Inventory /,
    Business: /^Manager \/ Office/,
    Restaurant: /^Manager \/ Office/,
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
