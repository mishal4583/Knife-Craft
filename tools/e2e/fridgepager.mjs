// The physical fridge on a phone (task #14): below the 768 px tablet breakpoint a steel model
// that is wider than the screen shows ONE door or compartment at a time.
//   1. Commercial and Professional page ("‹ name  n / N ›") at 320/360/375/390/430 px; the Basic
//      never pages; the page opens on the first compartment (Dairy & Tofu …);
//   2. every page together shows exactly the items, quantities, day counts and warning markers
//      (low / expiring / expired) the wide view shows — nothing invented, nothing dropped;
//   3. ‹ › buttons (≥ 48 px) step through every page and stop at the ends;
//   4. a touch swipe and a mouse drag change the page and open no item; a vertical swipe still
//      scrolls the page; no horizontal page scroll;
//   5. a tap on a crate opens its details; the header's Upgrade button opens Business → Equipment;
//   6. "Show the whole fridge" switches to the wide, panning appliance and back;
//   7. at 768×1024 (tablet) the wide appliance is kept (no paging).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, shot, text } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const DAY = 7;
const entry = (id, quantity, purchaseDay = DAY, unitCost = 100) => [
  id,
  { ingredientId: id, quantity, unitCost, purchaseDay },
];
const STOCK = Object.fromEntries([
  entry("cheddar", 2, DAY, 450),
  entry("tofu", 1),
  entry("tomato", 3),
  entry("carrot", 2),
  entry("onion", 6),
  entry("chicken", 2, DAY - 2, 450), // spoils tonight
  entry("salmon", 1, DAY - 9, 650), // expired
  entry("apple", 2),
  entry("basil", 1, DAY - 1), // expiring
  entry("spinach", 1),
  entry("butter", 1, DAY, 400),
  entry("garlic", 1),
]);
const fridgeSave = (refrigeratorId) =>
  seedSave({
    version: 2,
    credits: 100_000,
    business: {
      calendar: { businessDay: DAY },
      inventory: STOCK,
      refrigerator: { refrigeratorId },
    },
  });

const { browser, page, logs } = await launch();
async function open(tier, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await boot(page, fridgeSave(tier));
  await clickButton(page, /Inventory$/);
  await sleep(800);
  await page.evaluate(() =>
    document.querySelector('[data-testid="physical-fridge"]')?.scrollIntoView({ block: "start" }),
  );
  await sleep(300);
}
const state = () =>
  page.evaluate(() => {
    const f = document.querySelector('[data-testid="physical-fridge"]');
    return {
      paged: f?.dataset.paged,
      name: document.querySelector('[data-testid="fridge-page-name"]')?.textContent ?? null,
      count: document.querySelector('[data-testid="fridge-page-count"]')?.textContent ?? null,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
/** Every item drawn right now: id → label, warning markers. */
const itemsNow = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-fridge-item]")].map((b) => [
        b.getAttribute("data-fridge-item"),
        {
          label: b.getAttribute("aria-label"),
          warn: b.classList.contains("kcf-item--warn"),
          expired: b.classList.contains("kcf-item--expired"),
        },
      ]),
    ),
  );
const btn = (label) =>
  page.evaluate((l) => {
    const b = document.querySelector(`[aria-label="${l}"]`);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { disabled: b.disabled, w: r.width, h: r.height };
  }, label);
const press = (label) =>
  page.evaluate((l) => document.querySelector(`[aria-label="${l}"]`)?.click(), label);
async function allPages() {
  while ((await btn("Previous compartment"))?.disabled === false)
    await press("Previous compartment");
  await sleep(100);
  const seen = {};
  const names = [];
  for (let g = 0; g < 8; g++) {
    Object.assign(seen, await itemsNow());
    names.push((await state()).name);
    if ((await btn("Next compartment"))?.disabled !== false) break;
    await press("Next compartment");
    await sleep(120);
  }
  return { seen, names };
}

// ---------- 1–3. Paging at every phone width ----------
const per = {};
let reference = null;
for (const tier of ["commercial-refrigerator", "professional-refrigerator"]) {
  // The wide view (tablet) is the reference for what the fridge holds.
  await open(tier, 768, 1024);
  const wide = await itemsNow();
  const wideState = await state();
  reference ??= wide;
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [375, 642],
    [390, 844],
    [430, 932],
  ]) {
    await open(tier, w, h);
    const first = await state();
    const prev = await btn("Previous compartment");
    const next = await btn("Next compartment");
    const { seen, names } = await allPages();
    const atEnd = await btn("Next compartment");
    per[`${tier}@${w}`] = {
      paged: first.paged,
      opensOn: first.name,
      count: first.count,
      pages: names.length,
      same:
        JSON.stringify(Object.keys(seen).sort()) === JSON.stringify(Object.keys(wide).sort()) &&
        Object.keys(wide).every(
          (id) =>
            seen[id].label === wide[id].label &&
            seen[id].warn === wide[id].warn &&
            seen[id].expired === wide[id].expired,
        ),
      buttons48: prev.h >= 47.5 && prev.w >= 47.5 && next.h >= 47.5,
      endsStop: prev.disabled === false && atEnd.disabled === true,
      hScroll: first.hScroll,
      widePaged: wideState.paged,
    };
    if (w === 375) await shot(page, `fridgepager-${tier}`);
  }
}
const expectPages = { "commercial-refrigerator": 4, "professional-refrigerator": 5 };
check(
  "1 Commercial/Professional page at 320–430 px (opening on Dairy & Tofu, 'n / N'); 768 px keeps the wide view",
  Object.entries(per).every(
    ([k, v]) =>
      v.paged === "true" &&
      /^Dairy & Tofu/.test(v.opensOn ?? "") &&
      v.count === `2 / ${expectPages[k.split("@")[0]]}` &&
      v.pages === expectPages[k.split("@")[0]] &&
      v.widePaged === "false" &&
      v.hScroll <= 0,
  ),
  per,
);
check(
  "2 all pages together show exactly the wide view's items, quantities, days and warning markers",
  Object.values(per).every((v) => v.same) &&
    Object.values(reference).some((i) => i.warn) &&
    Object.values(reference).some((i) => i.expired),
  Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.same])),
);
check(
  "3 ‹ › are ≥ 48 px, step through every page and stop at the ends",
  Object.values(per).every((v) => v.buttons48 && v.endsStop),
  Object.fromEntries(Object.entries(per).map(([k, v]) => [k, [v.buttons48, v.endsStop]])),
);

// Basic never pages.
await open("basic-refrigerator", 320, 568);
const basic = await state();
check("1b the Basic never pages (it fits)", basic.paged === "false" && !basic.name, basic);

// ---------- 4. Swipe / drag / vertical scroll ----------
await open("professional-refrigerator", 375, 642);
const area = () =>
  page.evaluate(() => {
    const r = document.querySelector(".kcf-pager__swipe").getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: Math.min(innerHeight * 0.6, r.top + r.height * 0.45) };
  });
const detail = () =>
  page.evaluate(
    () =>
      document.querySelector('[role="dialog"], [data-testid="inventory-detail"]')?.textContent ??
      "",
  );
async function touchSwipe(x, y, dx, dy) {
  await page.touchscreen.touchStart(x, y);
  for (let i = 1; i <= 12; i++) {
    await page.touchscreen.touchMove(x + (dx * i) / 12, y + (dy * i) / 12);
    await sleep(16);
  }
  await page.touchscreen.touchEnd();
}
let a = await area();
const c0 = (await state()).count;
await touchSwipe(a.x, a.y, -150, 0);
await sleep(400);
const c1 = (await state()).count;
await touchSwipe(a.x, a.y, 150, 0);
await sleep(400);
const c2 = (await state()).count;
const noDetailAfterSwipe = (await detail()) === "";
a = await area();
await page.mouse.move(a.x, a.y);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(a.x - i * 15, a.y);
await page.mouse.up();
await sleep(400);
const c3 = (await state()).count;
const noDetailAfterDrag = (await detail()) === "";
check(
  "4a a touch swipe and a mouse drag change the page, and open no item",
  c0 === "2 / 5" &&
    c1 === "3 / 5" &&
    c2 === "2 / 5" &&
    c3 === "3 / 5" &&
    noDetailAfterSwipe &&
    noDetailAfterDrag,
  { c0, c1, c2, c3, noDetailAfterSwipe, noDetailAfterDrag },
);
const scroller = () =>
  page.evaluate(() => {
    let el = document.querySelector('[data-testid="physical-fridge"]');
    while (
      el &&
      !(el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY))
    )
      el = el.parentElement;
    return el ? el.scrollTop : (document.scrollingElement?.scrollTop ?? 0);
  });
const top0 = await scroller();
a = await area();
await touchSwipe(a.x, a.y, 0, -180);
await sleep(500);
const top1 = await scroller();
check(
  "4b a vertical swipe on the fridge still scrolls the page",
  top1 > top0 + 40 && (await state()).count === "3 / 5",
  { top0, top1 },
);

// ---------- 5. Details and Upgrade ----------
await open("professional-refrigerator", 375, 642);
await page.evaluate(() => document.querySelector('[data-fridge-item="cheddar"]')?.click());
await sleep(500);
const d = (await detail()).replace(/\s+/g, " ");
check(
  "5a a tap on a crate opens its details (quantity, freshness, value)",
  /Cheddar/.test(d) && /In stock\s*2 lb/.test(d) && /Stock value\s*\$9\.00/.test(d),
  d.slice(0, 200),
);
await boot(page, fridgeSave("professional-refrigerator"));
await clickButton(page, /Inventory$/);
await sleep(700);
await page.evaluate(() => document.querySelector('[data-testid="fridge-upgrade"]')?.click());
await sleep(800);
check(
  "5b the header button still opens Business → Equipment",
  /Your refrigerator/i.test(await text(page)),
);

// ---------- 6. Whole-fridge toggle ----------
await open("professional-refrigerator", 375, 642);
await page.evaluate(() => document.querySelector('[data-testid="fridge-view-toggle"]')?.click());
await sleep(400);
const wideNow = await page.evaluate(() => ({
  paged: document.querySelector('[data-testid="physical-fridge"]')?.dataset.paged,
  overflow: document.querySelector(".kcf-stage")?.getAttribute("data-overflow"),
  label: document.querySelector('[data-testid="fridge-view-toggle"]')?.textContent,
  hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
await page.evaluate(() => document.querySelector('[data-testid="fridge-view-toggle"]')?.click());
await sleep(400);
const backPaged = (await state()).paged;
check(
  "6 'Show the whole fridge' switches to the wide, panning appliance (no page scroll) and back",
  wideNow.paged === "false" &&
    wideNow.overflow === "true" &&
    /One door at a time/.test(wideNow.label ?? "") &&
    wideNow.hScroll <= 0 &&
    backPaged === "true",
  { wideNow, backPaged },
);

const errors = logs.filter((l) => /^error|pageerror/i.test(l));
check("7 no console errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `FRIDGE PAGER E2E: ${failed.length} FAILURE(S)` : "FRIDGE PAGER E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
