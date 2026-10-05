// Unified Restaurant phase D — menu guests, in a real browser, on a RESTAURANT_MODE test build
// (VITE_RESTAURANT_MODE=1; a normal build never has it on).
//   1. Level 12: after its own order is served, the result shows Finish Level AND
//      "Menu guest 1/1: <dish from the menu> · $price" (guests start when the menu opens, L11).
//   2. Taking the guest brings a new order of that dish into the same service (cut as usual).
//   3. Serving the guest pays exactly the shown price with ONE "business-revenue" entry and
//      saves the guest count; the guest's dish is on the Level 12 menu; no guest button after it.
//   4. Finish Level completes the level once (its own completion reward), the guest count is
//      dropped, and a replay offers no guest.
//   5. Level 30 with an empty fridge (stock from L11): the guest button says the dish isn't in
//      stock and is disabled.
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
  text,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();
// GameShell draws the game at a fixed 540×960 logical size and scales it to the screen, so
// the result panel wraps the same at every phone width; the solver needs the default viewport.
const MENU_AT_12 = ["Caprese Salad", "Mushroom Bruschetta", "Garden Salad", "Garlic Bread"];

async function prepare(title) {
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
          /^(Prepare|Replay)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
    await sleep(800);
  }
}
async function cookAndServe() {
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
  const played = await playToReport(page, { maxMs: 150000 });
  await clickButton(page, /^Continue$/);
  await sleep(900);
  if (/ORDER READY/i.test(await flat())) {
    await clickButton(page, /^Serve to /);
    await sleep(1000);
  }
  return played.ok;
}
const guestButton = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Menu guest/.test(x.textContent),
    );
    return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
  });
const saveAt = (n, credits) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

// ---------- 1. Level 12: the guest is offered after the level's own order ----------
await boot(page, saveAt(12, 5000));
await prepare("Tomato Basil Toast");
const own = await cookAndServe();
const offer = await guestButton();
const finishShown = /Finish Level/.test(await flat());
await shot(page, "restaurant-guest-offer");
const dishName = /: (.+) · \$/.exec(offer?.text ?? "")?.[1];
const price = Math.round(
  Number((/\$([\d,]+\.\d\d)/.exec(offer?.text ?? "")?.[1] ?? "0").replace(/,/g, "")) * 100,
);
check(
  "1 after Level 12's own order: Finish Level and 'Menu guest 1/1: <menu dish> · $price'",
  own &&
    finishShown &&
    !!offer &&
    !offer.disabled &&
    /Menu guest 1\/1/.test(offer.text) &&
    MENU_AT_12.includes(dishName),
  { offer, dishName, finishShown },
);

const fit = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Menu guest/.test(x.textContent));
  const r = b?.getBoundingClientRect();
  return {
    height: r?.height ?? 0,
    clipped: b ? b.scrollHeight > b.clientHeight + 1 : true,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
await shot(page, "restaurant-guest-offer-320");
check(
  "1b the guest button fits its text (≥ 48 px, nothing clipped, no sideways scroll)",
  fit.height >= 47.5 && !fit.clipped && fit.overflow <= 0,
  fit,
);

// ---------- 2. Taking the guest ----------
await clickButton(page, /Menu guest 1\/1/);
await sleep(1200);
const inOrder = await flat();
check(
  "2 the guest's order comes into the same service",
  /·\s*\d+\/\d+\s+[a-z-]+/i.test(inOrder) && !/Finish Level/.test(inOrder),
);

// ---------- 3. Serving the guest ----------
const before = await readSave(page);
const cooked = await cookAndServe();
const after = await readSave(page);
const entries = after.economyLedger.slice(before.economyLedger.length);
const afterOffer = await guestButton();
check(
  "3 the guest pays exactly the shown price with ONE business-revenue entry; the count is saved; no more guests",
  cooked &&
    entries.length === 1 &&
    entries[0].category === "business-revenue" &&
    entries[0].amount === price &&
    after.credits - before.credits === price &&
    after.levelProgress.menuGuests?.["level-12"] === 1 &&
    afterOffer === null &&
    /Finish Level/.test(await flat()),
  { entries, price, guests: after.levelProgress.menuGuests, afterOffer },
);

// ---------- 4. Finish, replay ----------
await clickButton(page, /^Finish Level$/);
await sleep(1800);
const done = await readSave(page);
const reward = done.economyLedger.filter(
  (e) => e.category === "completion-reward" && e.description === "level-12",
).length;
check(
  "4a Finish Level completes Level 12 once and drops the guest count",
  done.levelProgress.completedLevelIds.includes("level-12") &&
    reward === 1 &&
    done.levelProgress.menuGuests?.["level-12"] === undefined,
  { reward, menuGuests: done.levelProgress.menuGuests },
);
const closing = await page.evaluate(() => !!document.querySelector('[data-testid="closing-time"]'));
if (closing) {
  await clickButton(page, /^Close for the night/);
  await sleep(600);
}
await prepare("Tomato Basil Toast");
await cookAndServe();
check("4b a replay offers no menu guest", (await guestButton()) === null);

// ---------- 5. Level 30, empty fridge: guest not in stock ----------
await boot(page, saveAt(30, 5000));
await prepare("Italian Service Night");
// The check is open with an empty fridge: restock exactly what the level's own orders need.
const rows = await page.evaluate(() =>
  [...document.querySelectorAll("[data-psc-ingredient]")].map((r) =>
    r.getAttribute("data-psc-ingredient"),
  ),
);
for (const id of rows) {
  await page.evaluate(
    (x) => document.querySelector(`[data-psc-ingredient="${x}"] button`)?.click(),
    id,
  );
  await sleep(800);
  await page.evaluate((x) => {
    const card = document.querySelector(`[data-ingredient="${x}"]`);
    [...(card?.querySelectorAll("button") ?? [])]
      .find((b) => /^Buy /.test(b.textContent.trim()))
      ?.click();
  }, id);
  await sleep(400);
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(700);
}
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(900);
await cookAndServe();
await clickButton(page, /^Next Customer$/);
await sleep(900);
await cookAndServe();
const stockOffer = await guestButton();
await shot(page, "restaurant-guest-nostock");
check(
  "5 Level 30 with only its own stock: the guest's dish isn't in stock, the button says so and is disabled",
  !!stockOffer && stockOffer.disabled && /not in stock/.test(stockOffer.text),
  stockOffer,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT GUESTS E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT GUESTS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
