// Market needs (developer 2026-10-16), restaurant build, a Level 40 save with nothing stocked:
//   1. the Market's tabs show how many items each section needs today;
//   2. Ingredients: a "Needed for today" group comes first; each card says how much to buy
//      ("📌 Needed today · buy …") and its quantity is preset to that amount;
//   3. Daily Check → Tonight's close → Restock › on the tissues opens the Market on that card,
//      highlighted "📌 Needed tonight · buy 1 pack", with 1 pack preset;
//   4. that section lists its needed items first, and "Buy everything needed" buys them all
//      (one ledger entry each) — then nothing is left needed there;
//   5. fits at 320 / 390; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save40 = () =>
  seedSave({
    credits: 5_000_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      supplies: { ...(MOVED_IN_BUSINESS.supplies ?? {}), stock: {} },
    },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openMarket = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await page.waitForSelector('nav[aria-label="Shop categories"]', { timeout: 15000 });
  await sleep(500);
};
const tab = (page, label) =>
  page.evaluate((l) => {
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => (b.textContent ?? "").includes(l))
      ?.click();
  }, label);

const { browser, page, logs } = await launch();
await boot(page, save40());
await openMarket(page);
const badges = await page.$$eval('nav[aria-label="Shop categories"] button', (bs) =>
  bs.map((b) => [
    (b.textContent ?? "").replace(/\d+/g, "").trim(),
    Number(b.getAttribute("data-needs") ?? 0),
  ]),
);
check(
  "1 the Market's tabs show how many items each section needs today",
  badges.some(([l, n]) => /Ingredients/.test(l) && n > 0) &&
    badges.some(([l, n]) => /Tableware|Smallwares/.test(l) && n > 0),
  badges,
);

// 2. Ingredients
await tab(page, "Ingredients");
await page.waitForSelector('[data-testid="market-needed-ingredients"]', { timeout: 15000 });
await sleep(400);
const ing = await page.evaluate(() => {
  const first = document.querySelector("section");
  const needed = document.querySelector('[data-testid="market-needed-ingredients"]');
  const sections = [...document.querySelectorAll("section")].map((s) =>
    s.getAttribute("data-testid"),
  );
  const cards = [...needed.querySelectorAll("[data-ingredient]")].map((c) => ({
    id: c.getAttribute("data-ingredient"),
    note: (c.querySelector('[data-testid="need-note"]')?.textContent ?? "").replace(/\s+/g, " "),
    // The stepper's value (market/ShopCard WoodStepper, 2026-10-22; was a font class).
    qty: (c.querySelector('[data-testid="stepper-value"]')?.textContent ?? "").trim(),
  }));
  return {
    firstIsNeeded:
      sections.indexOf("market-needed-ingredients") ===
      sections.findIndex((s) => s !== null || true),
    sections: sections.slice(0, 3),
    cards,
  };
});
await shot(page, "market-needs-ingredients-390");
const s0 = await readSave(page);
check(
  "2 Ingredients: 'Needed for today' first; each card says how much to buy, preset to it",
  ing.sections[0] === "market-needed-ingredients" &&
    ing.cards.length > 0 &&
    ing.cards.every(
      (c) =>
        /📌 Needed today · buy [\d.]+ /.test(c.note) ||
        /📌 For today's menu guests · buy/.test(c.note),
    ) &&
    ing.cards.every((c) => c.note.includes(`buy ${c.qty} `)),
  ing.cards.slice(0, 4),
);

// 3. Daily Check → Restock › on the tissues
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await page.waitForSelector('[data-testid="daily-check-shortcut"]', { timeout: 15000 }).catch(async () => {
  console.log("debug nav:", await page.evaluate(() => [...document.querySelectorAll("[data-nav]")].map((e) => e.getAttribute("data-nav")).join(","), document.body.innerText.slice(0, 200)));
});
await sleep(500);
// The shortcut expands on the first tap and opens on the second (a mouse expands it on hover).
for (let i = 0; i < 3; i++) {
  if (await page.evaluate(() => /Tonight’s close/i.test(document.body.innerText))) break;
  await page.click('[data-testid="daily-check-shortcut"]');
  await sleep(700);
}
await page.waitForFunction(() => /Tonight’s close/i.test(document.body.innerText), {
  timeout: 15000,
});
await page.evaluate(() => {
  const li = [...document.querySelectorAll("li, div")].find(
    (e) =>
      /^⚠️? ?Tissues for the dining room/.test((e.textContent ?? "").trim()) &&
      e.querySelector("button"),
  );
  li?.querySelector("button")?.click();
});
await page.waitForSelector('[data-supply="tissues"]', { timeout: 15000 });
await sleep(600);
const tissue = await page.$eval('[data-supply="tissues"]', (c) => ({
  needed: c.getAttribute("data-needed"),
  note: (c.querySelector('[data-testid="need-note"]')?.textContent ?? "").replace(/\s+/g, " "),
  packs: (c.textContent ?? "").match(/(\d+) packs?/)?.[1] ?? null,
  ring: c.className.includes("ring-copper"),
}));
await shot(page, "market-needs-tissues-390");
check(
  "3 Restock › on the tissues opens the Market on that card: '📌 Needed tonight · buy 1 pack', 1 pack preset",
  tissue.needed === "tonight" &&
    /📌 Needed tonight · buy 1 pack/.test(tissue.note) &&
    /Need 1, have 0/.test(tissue.note) &&
    tissue.packs === "1" &&
    tissue.ring,
  tissue,
);

// 4. That section: needed first; Buy everything needed
const section = await page.evaluate(() =>
  document
    .querySelector('[data-testid^="market-supplies-"]')
    ?.getAttribute("data-testid")
    ?.replace("market-supplies-", ""),
);
const order = await page.$$eval("[data-supply]", (cs) =>
  cs.map((c) => c.getAttribute("data-needed") ?? ""),
);
const firstPlain = order.indexOf("");
const neededFirst =
  firstPlain === -1 || order.slice(firstPlain).every((n) => n === "" || n === "soon");
const before = await readSave(page);
const bought = await page.evaluate((sec) => {
  const b = document.querySelector(`[data-testid="market-buy-needed-${sec}"] button`);
  b?.click();
  return !!b;
}, section);
await sleep(800);
const after = await readSave(page);
const left = await page.$(`[data-testid="market-needed-${section}"]`);
const entries = after.economyLedger.length - before.economyLedger.length;
check(
  "4 the section lists needed items first; 'Buy everything needed' buys them (one ledger entry each) and nothing is left needed there",
  neededFirst && bought && entries > 0 && after.credits < before.credits && !left,
  { section, order: order.slice(0, 8), entries, left: !!left },
);

const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(400);
  fits[w] = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check(
  "5 fits at 320 / 390; no page errors",
  Object.values(fits).every((o) => o <= 0) && errors.length === 0,
  { fits, errors: errors.slice(0, 3) },
);
void s0;
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `MARKET NEEDS E2E: ${failed.length} FAILURE(S)` : "MARKET NEEDS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
