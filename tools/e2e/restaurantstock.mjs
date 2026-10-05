// Unified Restaurant phases 3–4 in a real browser, on a RESTAURANT_MODE test build
// (VITE_RESTAURANT_MODE=1; a normal build never has it on). KC_URL must point at that build.
//   1. Level 5 (before stock): no check, the level starts at once.
//   2. Level 30 with an empty fridge: the Pre-Service Check lists today's 2 orders and every
//      missing ingredient; Restock opens the Market on that ingredient, Buy, the "Back to the
//      check" pill returns; START SERVICE once everything is ✓.
//   3. Serving the 1st order takes exactly its recipe's stock; the only new money entry is the
//      order's settlement (stock use writes none).
//   4. With $0, the check offers Grandma's pantry; it fills exactly the gap with no money moved,
//      and the service can start.
//   5. 320×568: the sheet fits, no sideways scroll, every button ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const doneUpTo = (n) => Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`);
const saveAt = (n, credits) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: doneUpTo(n),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

async function openLevel(title) {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Play|Start Service)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(900);
}
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    if (!el) return null;
    return {
      orders: [...el.querySelectorAll('[data-testid="psc-orders"] li')].map((li) =>
        li.textContent.trim(),
      ),
      rows: [...el.querySelectorAll("[data-psc-ingredient]")].map((r) => ({
        id: r.getAttribute("data-psc-ingredient"),
        status: r.getAttribute("data-psc-status"),
        restock: r.querySelector("button")?.textContent.trim() ?? "",
      })),
      text: el.innerText.replace(/\s+/g, " "),
    };
  });
const inHud = () =>
  page.evaluate(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText));

// ---------- 1. Level 5: no stock check (only the day's opening card) ----------
await boot(page, saveAt(5, 5000));
await openLevel("Onion Basics");
let l5 = await sheet();
await clickButton(page, /^OPEN THE RESTAURANT$/);
const l5Hud = await page
  .waitForFunction(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText), {
    timeout: 15000,
  })
  .then(() => true)
  .catch(() => false);
check(
  "1 Level 5 (before stock): only the opening card, no ingredients, then the level starts",
  !!l5 && l5.rows.length === 0 && /Opening time/i.test(l5.text) && l5Hud,
  { l5Hud, text: l5?.text.slice(0, 120) },
);

// ---------- 2. Level 30, empty fridge ----------
await boot(page, saveAt(30, 5000));
const start = await readSave(page);
await openLevel("Italian Service Night");
const first = await sheet();
await shot(page, "restaurant-psc-empty");
check(
  "2a an empty fridge opens the check: 2 orders, every ingredient missing, Start locked",
  !!first &&
    first.orders.length === 2 &&
    first.rows.length > 0 &&
    first.rows.every((r) => r.status === "missing") &&
    /Restock to start/.test(first.text),
  first,
);
let restockOk = true;
const visited = [];
for (const row of first?.rows ?? []) {
  await page.evaluate((id) => {
    document.querySelector(`[data-psc-ingredient="${id}"] button`)?.click();
  }, row.id);
  await sleep(900);
  const market = await page.evaluate((id) => {
    const card = document.querySelector(`[data-ingredient="${id}"]`);
    const pill = document.querySelector('[data-testid="psc-back"]');
    const buy =
      card && [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()));
    const buyText = buy?.textContent.trim() ?? "";
    if (buy) buy.click();
    return { card: !!card, pill: !!pill, buy: !!buy, buyText };
  }, row.id);
  await sleep(500);
  visited.push({ id: row.id, ...market });
  const units = /^Restock (\d+)/.exec(row.restock)?.[1];
  if (
    !market.card ||
    !market.pill ||
    !market.buy ||
    !units ||
    !market.buyText.startsWith(`Buy ${units} `)
  )
    restockOk = false;
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(800);
}
const after = await sheet();
check(
  "2b Restock opens the Market on that ingredient preset to the missing units, Buy works, the pill returns",
  restockOk && !!after,
  visited,
);
check(
  "2c once everything is bought every row is ✓ and START SERVICE is open",
  !!after &&
    after.rows.every((r) => r.status === "ok") &&
    /OPEN THE RESTAURANT|START SERVICE/.test(after.text),
  after,
);
const bought = await readSave(page);
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(1200);
check("2d START SERVICE starts the level", await inHud());

// ---------- 3. Serving uses exactly the order's stock ----------
const played = await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
const beforeServe = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(1200);
const served = await readSave(page);
const newEntries = served.economyLedger
  .slice(beforeServe.economyLedger.length)
  .map((e) => e.category);
const drop = Object.fromEntries(
  Object.keys(beforeServe.business.inventory)
    .map((id) => [
      id,
      +(
        (beforeServe.business.inventory[id]?.quantity ?? 0) -
        (served.business.inventory[id]?.quantity ?? 0)
      ).toFixed(3),
    ])
    .filter(([, d]) => d !== 0),
);
check(
  "3 serving the 1st order takes its stock; the only new money entry is its settlement",
  played.ok &&
    Object.keys(drop).length > 0 &&
    Object.values(drop).every((d) => d > 0) &&
    newEntries.length === 1 &&
    newEntries[0] === "campaign-settlement" &&
    served.credits - beforeServe.credits === served.economyLedger.at(-1).amount,
  { drop, newEntries, purchases: bought.economyLedger.length - start.economyLedger.length },
);

// ---------- 4. $0: Grandma's pantry ----------
await boot(page, saveAt(30, 0));
await openLevel("Italian Service Night");
const broke = await sheet();
const pantryShown =
  !!broke && /Not enough money/.test(broke.text) && /Grandma's pantry/.test(broke.text);
await clickButton(page, /Use Grandma's pantry/);
await sleep(700);
const filled = await sheet();
const pantrySave = await readSave(page);
check(
  "4 with $0 the pantry fills exactly the gap: no money moved, every row ✓, START open",
  pantryShown &&
    !!filled &&
    filled.rows.every((r) => r.status === "ok") &&
    pantrySave.credits === 0 &&
    pantrySave.economyLedger.length === 0,
  { pantryShown, filled: filled?.rows, credits: pantrySave.credits },
);

// ---------- 5. 320×568 ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(500);
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="pre-service-check"]');
  const buttons = el
    ? [...el.querySelectorAll("button")].filter(
        (b) => b.offsetParent && b.getAttribute("aria-label") !== "Close",
      )
    : [];
  return {
    open: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons
      .filter((b) => b.getBoundingClientRect().height < 47.5)
      .map((b) => b.textContent.trim()),
  };
});
await shot(page, "restaurant-psc-320");
check(
  "5 at 320×568 the sheet fits, no sideways scroll, buttons ≥ 48 px",
  fit.open && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT STOCK E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT STOCK E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
