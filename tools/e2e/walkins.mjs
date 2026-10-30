// Early-game phase 3 (2026-10-25) — walk-in customers, restaurant build, Level 5:
//   W1 after Level 5's own order and its menu guest, the result offers
//      "🚶 Walk-in 1/1: Garlic Bread · $price" beside Finish Level (the fridge holds enough for
//      the next level's order too).
//   W2 the walk-in is cooked in the same service (the oven, the Knife Report); Serve pays
//      exactly the shown price with ONE "business-revenue" entry (the wallet moves by exactly
//      the new ledger entries); the count (2) is saved; no further customer is offered.
//   W3 Finish Level pays its completion reward once and drops the count.
//   W4 a fridge with only enough bread for the order, the guest and the walk-in (none left for
//      Level 6's order): the walk-in button is disabled and says "short of bread (kept for
//      your next order)"; nothing is paid or taken.
//   W5 at 320 × 568 and 390 × 844 both walk-in buttons fit (≥ 48 px, text not clipped, no
//      sideways scroll).
//   W6 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  sweepCash,
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
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();
const stocked = (ids, quantity = 3) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity, unitCost: 0, purchaseDay: 1 }]),
  );
const saveAt = (n, inventory = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, inventory, sectionsSeen: ["inventory", "shop", "business"] },
    credits: 50000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
const toKitchen = async () => {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(700);
};
const shortcut = () =>
  page.evaluate(() => {
    const b = document.querySelector('[data-testid="business-shortcut"]');
    return b ? { disabled: b.getAttribute("aria-disabled") === "true", label: b.ariaLabel } : null;
  });
const guestButton = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Menu guest/.test(x.textContent),
    );
    return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
  });
const untilOvenOrReport = () =>
  !!document.querySelector('[data-testid="oven-step"]') ||
  /KNIFE REPORT/i.test(document.body.innerText);
async function cookAndServe() {
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  const played = await playToReport(page, { maxMs: 180000, until: untilOvenOrReport });
  // Garlic Bread bakes (Transformation Phase D): take it out, then the Knife Report.
  if (await page.evaluate(() => !!document.querySelector('[data-testid="oven-step"]'))) {
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[data-testid="oven-step"] button')].some((x) =>
            /Take it out/.test(x.textContent),
          ),
        { timeout: 15000 },
      )
      .catch(() => null);
    await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="oven-step"] button')]
        .find((x) => /Take it out/.test(x.textContent))
        ?.click(),
    );
    await page
      .waitForFunction(() => /KNIFE REPORT/i.test(document.body.innerText), { timeout: 10000 })
      .catch(() => null);
  }
  await clickButton(page, /^Continue$/);
  await sleep(900);
  if (/ORDER READY/i.test(await flat())) {
    await clickButton(page, /^Serve to /);
    await sleep(3500);
    // The cash lies on the table: the player sweeps it into the wallet (it enters only then).
    await sweepCash(page);
  }
  return played.ok;
}

const walkInButton = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Walk-in/.test(x.textContent));
    return b ? { text: b.textContent.trim(), disabled: b.disabled } : null;
  });
const fits = async (name) => {
  const out = {};
  for (const [w, h] of [
    [320, 568],
    [390, 844],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await sleep(600);
    out[w] = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /Walk-in/.test(x.textContent));
      const r = b?.getBoundingClientRect();
      return {
        height: r?.height ?? 0,
        clipped: b
          ? b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1
          : true,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await shot(page, `${name}-${w}`);
  }
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await sleep(400);
  return out;
};
const openLevel5 = async () => {
  await toKitchen();
  await clickButton(page, /^Prepare$/);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
    await sleep(800);
  }
};
const priceOf = (t) =>
  Math.round(Number((/\$([\d,]+\.\d\d)/.exec(t ?? "")?.[1] ?? "0").replace(/,/g, "")) * 100);

// ---------- W1–W3: enough stock ----------
await boot(page, saveAt(5, stocked(["bread", "garlic", "tomato", "basil"], 4)));
await openLevel5();
const own = await cookAndServe();
await clickButton(page, /Menu guest 1\/1/);
await sleep(1200);
const guest = await cookAndServe();
const offer = await walkInButton();
const price = priceOf(offer?.text);
check(
  "W1 after the order and the menu guest: Finish Level and '🚶 Walk-in 1/1: Garlic Bread · $price'",
  own &&
    guest &&
    /Finish Level/.test(await flat()) &&
    !!offer &&
    !offer.disabled &&
    /🚶 Walk-in 1\/1: Garlic Bread · \$/.test(offer.text) &&
    price > 0,
  { own, guest, offer, price },
);
const fitOk = await fits("walkin-offer");
await clickButton(page, /Walk-in 1\/1/);
await sleep(1200);
const before = await readSave(page);
const cooked = await cookAndServe();
const after = await readSave(page);
const added = after.economyLedger.slice(before.economyLedger.length);
const revenue = added.filter((e) => e.category === "business-revenue");
const moved = added.reduce((n, e) => n + e.amount, 0);
check(
  "W2 the walk-in pays exactly the shown price with ONE business-revenue entry; wallet = ledger; count 2 saved; no further customer",
  cooked &&
    revenue.length === 1 &&
    revenue[0].amount === price &&
    after.credits - before.credits === moved &&
    after.levelProgress.menuGuests?.["level-5"] === 2 &&
    (await walkInButton()) === null &&
    (await guestButton()) === null,
  { added, price, wallet: after.credits - before.credits, guests: after.levelProgress.menuGuests },
);
await clickButton(page, /^Finish Level$/);
await sleep(1200);
await toKitchen();
const done = await readSave(page);
const rewards = done.economyLedger.filter(
  (e) => e.category === "completion-reward" && e.description === "level-5",
).length;
check(
  "W3 Finish Level completes Level 5 once (one completion reward) and drops the count",
  done.levelProgress.completedLevelIds.includes("level-5") &&
    rewards === 1 &&
    done.levelProgress.menuGuests?.["level-5"] === undefined,
  { rewards, menuGuests: done.levelProgress.menuGuests },
);

// ---------- W4: the walk-in would take Level 6's bread ----------
// Garlic Bread uses ¼ lb of bread: ¾ lb covers the order, the guest and the walk-in, not L6.
await boot(page, saveAt(5, { ...stocked(["garlic"], 4), ...stocked(["bread"], 0.75) }));
await openLevel5();
await cookAndServe();
await clickButton(page, /Menu guest 1\/1/);
await sleep(1200);
await cookAndServe();
const s0 = await readSave(page);
const refused = await walkInButton();
await clickButton(page, /Walk-in/).catch(() => null);
await sleep(800);
const s1 = await readSave(page);
check(
  "W4 the walk-in is refused: 'short of bread (kept for your next order)'; a tap takes and pays nothing",
  !!refused &&
    refused.disabled &&
    /Walk-in wants Garlic Bread — short of bread \(kept for your next order\)/.test(refused.text) &&
    s1.economyLedger.length === s0.economyLedger.length &&
    s1.credits === s0.credits &&
    JSON.stringify(s1.business.inventory) === JSON.stringify(s0.business.inventory),
  { refused },
);
const fitShort = await fits("walkin-short");
check(
  "W5 both walk-in buttons fit at 320 and 390 px (≥ 48 px, not clipped, no sideways scroll)",
  [fitOk, fitShort].every((v) =>
    Object.values(v).every((x) => x.height >= 47.5 && !x.clipped && x.overflow <= 0),
  ),
  { fitOk, fitShort },
);

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("W6 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nWALK-INS E2E: ${failed.length} FAILURE(S)` : "\nWALK-INS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
