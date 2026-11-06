// The first-run hand on the Market's Ingredients tab (developer 2026-11-02: "when the game starts it goes to market but it stays in
// the knife section, there is no hand instruction to go to the ingredients page"), restaurant build, brand-new save:
//   M1 opening the Market from the bottom bar lands on Knives; the hand points at the Ingredients tab with the line
//      "Open Ingredients: buy the food";
//   M2 tapping Ingredients moves the hand on to the first Buy button (no Hire step: developer 2026-11-07) and the tab hint is gone;
//   M3 the hand never shows once the first service is done (not covered here) and no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, freshPlayer, sleep, text, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const hands = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="first-run-hand"]')].map((e) =>
      e.getAttribute("data-hand-for"),
    ),
  );

try {
  await freshPlayer(page);
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
    timeout: 30000,
  });
  await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
  await page.waitForFunction(() => !document.querySelector("[data-intro-scene]"), {
    timeout: 10000,
  });
  await sleep(2500);
  // Grandma's own pointer: not "Show me" (that opens Ingredients itself), the player goes to the Market tab on their own.
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click(),
  );
  await sleep(700);
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await page.waitForSelector('nav[aria-label="Shop categories"]', { timeout: 15000 });
  await sleep(900);
  const onKnives = await page.evaluate(
    () =>
      document
        .querySelector('nav[aria-label="Shop categories"] [aria-current="page"]')
        ?.getAttribute("data-category") ?? null,
  );
  const h1 = await hands();
  const hint = await page
    .$eval('[data-testid="first-run-ingredients-hint"]', (e) => e.textContent)
    .catch(() => null);
  const tab = await page.$eval('[data-category="ingredients"]', (e) => {
    const r = e.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  await shot(page, "firstmarket-1");
  check(
    "M1 the Market opens on Knives and the hand points at the Ingredients tab, with the line to open it",
    onKnives === "knives" &&
      h1.includes("market-ingredients") &&
      /Open Ingredients/.test(hint ?? "") &&
      tab.h >= 47.5,
    { onKnives, h1, hint, tab },
  );
  await page.evaluate(() => document.querySelector('[data-category="ingredients"]')?.click());
  await sleep(900);
  const h2 = await hands();
  const hint2 = await page
    .$eval('[data-testid="first-run-ingredients-hint"]', (e) => e.textContent)
    .catch(() => null);
  await shot(page, "firstmarket-2");
  check(
    "M2 in Ingredients the tab hint is gone and the hand is on the first Buy button (no Hire hand)",
    hint2 === null &&
      !h2.includes("market-ingredients") &&
      !h2.some((h) => /^hire-/.test(h ?? "")) &&
      (await page.evaluate(() => !!document.querySelector('[data-testid="first-shopping-hand"]'))),
    { h2, hint2, text: (await flat()).slice(0, 120) },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("M3 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
