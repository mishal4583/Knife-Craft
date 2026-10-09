// Lazy-loaded Restaurant screens (task #24), on the release build (KC_URL) or the restaurant
// test build:
//   1. startup + the campaign (Kitchen, Order Board, a level played and served) never request
//      the Restaurant chunk (restaurantScreens-*.js);
//   2. opening Restaurant/Business requests it once and the back office renders; while it is on
//      its way a small "Opening the restaurant…" state shows (the chunk is delayed on purpose);
//   3. Inventory (with the fridge), Staff and Suppliers work; the Market still works;
//   4. back to the campaign: the next level opens and plays;
//   5. no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, MOVED_IN_BUSINESS } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const requested = [];
let delayRestaurant = false;
await page.setRequestInterception(true);
page.on("request", (req) => {
  const url = req.url();
  if (/restaurantScreens-[^/]*\.js/.test(url)) {
    requested.push(url);
    if (delayRestaurant) return void setTimeout(() => req.continue(), 1500);
  }
  req.continue();
});
const chunkRequests = () => requested.length;
const nav = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((b) => b.textContent.includes(l))?.click(),
    label,
  );
/** Clicks a button whose text matches, when there is one (the restaurant build's extra steps). */
const clickIf = (re) =>
  page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => new RegExp(src).test(x.textContent.trim()) && !x.disabled,
    );
    b?.click();
    return !!b;
  }, re.source);
const body = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
async function playLevel(title) {
  await nav("Kitchen");
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n && [...n.querySelectorAll("button")].find((x) => /^Prepare$/.test(x.textContent.trim()));
      if (b) return b.click();
    }
  }, title);
  // Restaurant test build: the day's opening card / Pre-Service Check comes first.
  await sleep(900);
  await clickIf(/^(OPEN THE RESTAURANT|START SERVICE)$/);
  await sleep(900);
  await clickIf(/^(OPEN THE RESTAURANT|START SERVICE)$/);
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  const played = await playToReport(page);
  await clickButton(page, /^Continue$/);
  await sleep(800);
  if (/ORDER READY/i.test(await body())) {
    await clickButton(page, /^Serve to /);
    await sleep(800);
  }
  await clickButton(page, /^(Finish Level|Back to Orders)$/);
  await sleep(1500);
  // Restaurant test build: Closing Time after the day's last service.
  await clickIf(/^Close for the night/);
  await sleep(800);
  return played.ok;
}

// ---------- 1. Startup + campaign ----------
await boot(
  page,
  seedSave({
    // From Level 4 a level's own order needs its stock (developer 2026-10-09): the
    // fridge holds what Levels 13 and 14 use, as after the Level 13 top-up.
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: Object.fromEntries(
        Object.entries({ bread: 1, mushroom: 0.5, garlic: 0.25, zucchini: 1, carrot: 0.5 }).map(
          ([id, quantity]) => [id, { ingredientId: id, quantity, unitCost: 0, purchaseDay: 1 }],
        ),
      ),
    },
    credits: 500,
    // First levels (2026-10-09): every section is open from Level 11 in the restaurant
    // build, so the test plays Levels 13 and 14 (was 3 and 4; stock is used from 15).
    levelProgress: {
      currentLevelId: "level-13",
      highestUnlockedLevelId: "level-13",
      completedLevelIds: Array.from({ length: 12 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
  }),
);
await sleep(800);
const atStart = chunkRequests();
const playedL13 = await playLevel("Mushroom Bruschetta");
check(
  "1 startup and the campaign (Kitchen, Order Board, Level 13 played and served) never load the Restaurant chunk",
  atStart === 0 && playedL13 && chunkRequests() === 0,
  { atStart, afterCampaign: chunkRequests(), playedL13 },
);

// ---------- 2. Open Restaurant ----------
delayRestaurant = true;
await nav("Inventory");
await sleep(400);
const loading = await page.evaluate(
  () => !!document.querySelector('[data-testid="restaurant-loading"]'),
);
await page.waitForFunction(() => !!document.querySelector('[data-testid="physical-fridge"]'), {
  timeout: 15000,
});
delayRestaurant = false;
const fridge = await page.evaluate(
  () => !!document.querySelector('[data-testid="physical-fridge"]'),
);
check(
  "2 opening Inventory requests the Restaurant chunk once; 'Opening the restaurant…' shows meanwhile; the fridge renders",
  loading && fridge && chunkRequests() === 1,
  { loading, fridge, requests: chunkRequests() },
);
const tab = (re) =>
  page.evaluate(
    (src) =>
      [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
        .find((b) => new RegExp(src).test(b.textContent))
        ?.click(),
    re.source,
  );
await nav("Business");
await nav("Restaurant");
await sleep(800);
const overview = /End Business Day|One restaurant|restaurant/i.test(await body());
await tab(/Staff/);
await sleep(600);
const staff = /Kitchen helpers|Prep Cook/i.test(await body());
await tab(/Suppliers/);
await sleep(600);
const suppliers = /supplier/i.test(await body()) && /Sign contract|Active/.test(await body());
check(
  "3 the back office, Staff and Suppliers render from the same chunk (no second request)",
  overview && staff && suppliers && chunkRequests() === 1,
  { overview, staff, suppliers, requests: chunkRequests() },
);
await nav("Market");
await sleep(800);
const market = /Knives/.test(await body()) && /Cutting Boards/.test(await body());
check("3b the Market still works", market);

// ---------- 4. Back to the campaign ----------
const playedL14 = await playLevel("Zucchini Garden Plate");
check("4 back in the campaign, Level 14 opens, plays and is served", playedL14);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `LAZY LOAD E2E: ${failed.length} FAILURE(S)` : "LAZY LOAD E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
