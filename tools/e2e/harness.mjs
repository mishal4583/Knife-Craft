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

export async function launch() {
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
  const logs = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => logs.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  return { browser, page, logs };
}

/** A returning player at Level 10 (levels 1-9 done). `version: 1` saves are migrated on load (credits x100 into USD cents). */
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
  };
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

/** Click the first visible button whose text matches. */
export async function clickButton(page, re) {
  const ok = await page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll("button")].find(
      (x) => re.test(x.textContent.trim()) && x.offsetParent !== null && !x.disabled,
    );
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    b.click();
    return true;
  }, re.source);
  await sleep(250);
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
