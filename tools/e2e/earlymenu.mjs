// Early-game phase 2 (2026-10-25) — the menu and its guests from Level 5, restaurant build:
//   E1 at Level 4 the Business shortcut is locked and says it opens at Level 5.
//   E2 at Level 5 it is open; Grandma points at it (Inventory and Market already seen, as at
//      L3–4) and "Show me" opens it; its Menu lists Garlic Bread (320 × 568 and 390 × 844, no
//      sideways scroll); back on the Kitchen her tip says the menu is open.
//   E3 Level 5's own order (Garlic Bread, through the oven) is served, then the result offers
//      Finish Level AND "Menu guest 1/1: Garlic Bread · $price".
//   E4 the guest is cooked in the same service; Serve pays exactly the shown price with ONE
//      "business-revenue" entry (the wallet moves by exactly the new ledger entries), saves the
//      guest count, and offers no second guest.
//   E5 Finish Level pays its completion reward once and drops the guest count.
//   E6 no console errors.
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
    business: { ...MOVED_IN_BUSINESS, inventory, sectionsSeen: ["inventory", "shop"] },
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
    await sleep(1500);
  }
  return played.ok;
}

// ---------- E1: Level 4, Business locked ----------
await boot(page, saveAt(4));
await toKitchen();
const s4 = await shortcut();
check(
  "E1 at Level 4 the Business shortcut is locked and opens at Level 5",
  !!s4 && s4.disabled && /opens at Level 5/.test(s4.label ?? ""),
  s4,
);

// ---------- E2: Level 5, Business and its Menu ----------
const FOOD = stocked(["bread", "garlic"], 4);
await boot(page, saveAt(5, FOOD));
await toKitchen();
const s5 = await shortcut();
const pointer = /Your Business Dashboard/.test(await flat());
await shot(page, "earlymenu-pointer");
await clickButton(page, /^Show me/);
await sleep(900);
await clickButton(page, /Menu$/);
await sleep(900);
const views = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await sleep(600);
  views[w] = await page.evaluate(() => ({
    garlic: /Garlic Bread/.test(document.body.innerText),
    locked: /The menu opens at Level/.test(document.body.innerText),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  await shot(page, `earlymenu-menu-${w}`);
}
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(400);
await toKitchen();
// The tip sits in the order card's details (collapsed by default), so read the element itself.
const tip = await page.evaluate(() =>
  /We have a menu now!/.test(
    document.querySelector('[data-testid="kitchen-tip"]')?.textContent ?? "",
  ),
);
check(
  "E2 at Level 5 Business is open; Grandma points at it and Show me opens it; the Menu lists Garlic Bread (320 / 390, no sideways scroll); then her tip says the menu is open",
  !!s5 &&
    !s5.disabled &&
    pointer &&
    tip &&
    Object.values(views).every((v) => v.garlic && !v.locked && v.overflow <= 0),
  { s5, pointer, tip, views },
);

// ---------- E3: Level 5's own order, then the guest offer ----------
await toKitchen();
await clickButton(page, /^Prepare$/);
await sleep(900);
if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
  await shot(page, "earlymenu-psc");
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
  );
  await sleep(800);
}
const own = await cookAndServe();
const offer = await guestButton();
await shot(page, "earlymenu-guest-offer");
const price = Math.round(
  Number((/\$([\d,]+\.\d\d)/.exec(offer?.text ?? "")?.[1] ?? "0").replace(/,/g, "")) * 100,
);
check(
  "E3 after Level 5's own order: Finish Level and 'Menu guest 1/1: Garlic Bread · $price'",
  own &&
    /Finish Level/.test(await flat()) &&
    !!offer &&
    !offer.disabled &&
    /Menu guest 1\/1: Garlic Bread · \$/.test(offer.text) &&
    price > 0,
  { own, offer, price },
);

// ---------- E4: the guest ----------
await clickButton(page, /Menu guest 1\/1/);
await sleep(1200);
const before = await readSave(page);
const cooked = await cookAndServe();
const after = await readSave(page);
const added = after.economyLedger.slice(before.economyLedger.length);
const revenue = added.filter((e) => e.category === "business-revenue");
const moved = added.reduce((n, e) => n + e.amount, 0);
check(
  "E4 the guest pays exactly the shown price with ONE business-revenue entry; wallet = ledger; count saved; no second guest",
  cooked &&
    revenue.length === 1 &&
    revenue[0].amount === price &&
    after.credits - before.credits === moved &&
    after.levelProgress.menuGuests?.["level-5"] === 1 &&
    (await guestButton()) === null,
  { added, price, wallet: after.credits - before.credits, guests: after.levelProgress.menuGuests },
);

// ---------- E5: Finish Level ----------
await clickButton(page, /^Finish Level$/);
await sleep(1200);
await toKitchen();
const done = await readSave(page);
const rewards = done.economyLedger.filter(
  (e) => e.category === "completion-reward" && e.description === "level-5",
).length;
check(
  "E5 Finish Level completes Level 5 once (one completion reward) and drops the guest count",
  done.levelProgress.completedLevelIds.includes("level-5") &&
    rewards === 1 &&
    done.levelProgress.menuGuests?.["level-5"] === undefined,
  { rewards, menuGuests: done.levelProgress.menuGuests },
);

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("E6 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nEARLY MENU E2E: ${failed.length} FAILURE(S)` : "\nEARLY MENU E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
