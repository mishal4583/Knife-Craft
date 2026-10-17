// Restaurant name (developer 2026-10-17), restaurant build:
//   1. A new player: after the intro (SKIP) the naming card shows and Level 1 waits under it
//      (no cutting board yet); type a name → "Open the doors →" saves it; Level 1 starts.
//   2. Reload: no card again.
//   3. An existing save without a name is asked once; "Keep …" saves the default.
//   4. Settings → Restaurant name: change it → saved; the Restaurant map's sign shows it.
//   5. 320×568: the card fits (no sideways scroll); no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  freshPlayer,
  seedSave,
  sleep,
  readSave,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch({ nameCard: true });
const card = () => page.$('[data-testid="restaurant-name-card"]');

// ---------- 1. A new player ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await freshPlayer(page);
await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
  timeout: 30000,
});
await sleep(400);
await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]')?.click());
await page.waitForSelector('[data-testid="restaurant-name-card"]', { timeout: 15000 });
await sleep(500);
const before = await page.evaluate(() => ({
  canvas: !!document.querySelector("canvas"),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
await page.click('[data-testid="restaurant-name-form-input"]', { clickCount: 3 });
await page.type('[data-testid="restaurant-name-form-input"]', "  Nonna's   Table ");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="restaurant-name-form"] button')]
    .find((b) => /Open the doors/.test(b.textContent))
    ?.click(),
);
await sleep(1500);
const named = await readSave(page);
const after = await page.evaluate(() => ({
  card: !!document.querySelector('[data-testid="restaurant-name-card"]'),
  canvas: !!document.querySelector("canvas"),
}));
check(
  "1 new player: the naming card after the intro, Level 1 waiting; the name saved cleaned; Level 1 starts",
  !before.canvas &&
    named?.settings?.restaurantName === "Nonna's Table" &&
    named?.story?.introDone === true &&
    !after.card,
  { before, after, name: named?.settings?.restaurantName },
);

// ---------- 2. Reload ----------
await page.reload({ waitUntil: "networkidle0" });
await sleep(2500);
check("2 after a reload the card doesn't show again", !(await card()));

// ---------- 3. An existing save ----------
const old = seedSave({
  business: MOVED_IN_BUSINESS,
  levelProgress: {
    currentLevelId: "level-20",
    highestUnlockedLevelId: "level-20",
    completedLevelIds: Array.from({ length: 19 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 2,
  },
});
delete old.settings.restaurantName;
await boot(page, old);
await page.waitForSelector('[data-testid="restaurant-name-card"]', { timeout: 15000 });
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="restaurant-name-card"] button')]
    .find((b) => /^Keep /.test(b.textContent.trim()))
    ?.click(),
);
await sleep(800);
const kept = await readSave(page);
check(
  "3 an existing save without a name is asked once; Keep saves the default",
  kept?.settings?.restaurantName === "Your Restaurant" && !(await card()),
  { name: kept?.settings?.restaurantName },
);

// ---------- 4. Settings → the map ----------
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.evaluate(() => document.querySelector('[aria-label="Settings"]')?.click());
await page.waitForSelector('[data-testid="settings-restaurant-name-input"]', { timeout: 10000 });
const shown = await page.$eval('[data-testid="settings-restaurant-name-input"]', (i) => i.value);
await page.click('[data-testid="settings-restaurant-name-input"]', { clickCount: 3 });
await page.type('[data-testid="settings-restaurant-name-input"]', "Golden Ladle");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="settings-restaurant-name"] button')]
    .find((b) => b.textContent.trim() === "Save name")
    ?.click(),
);
await sleep(600);
const changed = await readSave(page);
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await page.waitForSelector(".restaurant-nameboard", { timeout: 15000 }).catch(() => null);
await sleep(800);
const sign = await page
  .$eval(".restaurant-nameboard", (b) => b.textContent.trim())
  .catch(() => null);
check(
  "4 Settings shows the name and changes it; the Restaurant map's sign shows the new name",
  shown === "Your Restaurant" &&
    changed?.settings?.restaurantName === "Golden Ladle" &&
    sign === "Golden Ladle",
  { shown, saved: changed?.settings?.restaurantName, sign },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 the card fits at 320 px; no page errors", before.overflow <= 0 && errors.length === 0, {
  overflow: before.overflow,
  errors: errors.slice(0, 3),
});
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT NAME E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT NAME E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
