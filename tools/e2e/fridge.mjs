// The physical refrigerator on the Inventory screen, in the built game, on a 375×642 phone:
//   1. it is drawn from the save: production model/capacity (Basic, 40 units), used space,
//      the set temperature, and every stocked ingredient in its zone (dairy top shelf,
//      vegetables middle, fruit/greens drawers, butter/aromatics in the door);
//   2. no door handle covers an item or takes a tap: every item's centre hits the item;
//   3. tapping an item (touch AND mouse) opens the Inventory screen's details: quantity,
//      freshness, days left, average cost, value and the menu dishes that use it;
//   4. the Basic fits its frame; on a tablet (768×1024, the wide view — phones page one
//      compartment at a time, tools/e2e/fridgepager.mjs) the wide steel Professional shows the
//      "›" cue and pans sideways with a touch swipe and a mouse drag (the drag opens nothing),
//      while a vertical swipe on it still scrolls the page;
//   5. the All Inventory filters show one group;
//   6. Needs Attention lists the expiring stock; Restock opens Market → Ingredients on it,
//      and buying there shows in the fridge straight away (one ledger entry, nothing bought
//      by the fridge itself); Upgrade opens Business → Equipment;
//   7. (tablet, the wide view) the three models after the design references: Basic one compartment + one open door,
//      Commercial two compartments + two doors, Professional three + two, each wider, with
//      production capacities 40/80/140;
//   8. at 320×568 · 360×640 · 390×844 · 430×900 · 768×1024: no horizontal page scroll and
//      the handle stays clear of the items; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  save,
  text,
} from "./harness.mjs";

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
  entry("tomato", 3),
  entry("carrot", 2),
  entry("onion", 2),
  entry("potato", 2),
  entry("cucumber", 1),
  entry("pepper", 1),
  entry("mushroom", 1),
  entry("zucchini", 1),
  entry("broccoli", 1),
  entry("chicken", 2, DAY - 2, 450), // spoils tonight
  entry("apple", 2),
  entry("basil", 1, DAY - 1), // expiring
  entry("butter", 1, DAY, 400),
  entry("garlic", 1),
]);
const fridgeSave = (refrigeratorId = "basic-refrigerator", credits = 100_000) =>
  seedSave({
    version: 2,
    credits,
    business: {
      calendar: { businessDay: DAY },
      inventory: STOCK,
      refrigerator: { refrigeratorId },
    },
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
/** A real touch swipe (touchstart → touchmoves → touchend through Chrome's input pipeline). */
async function swipe(x, y, dx, dy) {
  await page.touchscreen.touchStart(x, y);
  for (let i = 1; i <= 12; i++) {
    await page.touchscreen.touchMove(x + (dx * i) / 12, y + (dy * i) / 12);
    await sleep(16);
  }
  await page.touchscreen.touchEnd();
}

/** Inventory is its own bottom-bar section; the fridge sits on it. */
async function openInventory() {
  await clickButton(page, /Inventory$/);
  await sleep(700);
}
const fridgeTop = () =>
  page.evaluate(() =>
    document.querySelector('[data-testid="physical-fridge"]')?.scrollIntoView({ block: "start" }),
  );
/** Item ids per zone, as drawn. */
const zones = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-fridge-zone]")].map((z) => [
        z.getAttribute("data-fridge-zone"),
        [...z.querySelectorAll("[data-fridge-item]")].map((b) =>
          b.getAttribute("data-fridge-item"),
        ),
      ]),
    ),
  );
/** Handle vs items: overlaps, and whether each visible item's centre hits the item itself. */
const handleCheck = () =>
  page.evaluate(() => {
    const handles = [...document.querySelectorAll('[data-testid="fridge-handle"]')];
    const rects = handles.map((x) => x.getBoundingClientRect());
    const overlaps = [];
    const blocked = [];
    const fridge = document.querySelector('[data-testid="physical-fridge"]');
    for (const b of document.querySelectorAll("[data-fridge-item]")) {
      const r0 = b.getBoundingClientRect();
      // The part of the label that is actually on screen (a shelf clips what it pans past).
      const track = b.closest(".kcf-pan__track");
      const t = track ? track.getBoundingClientRect() : r0;
      const r = {
        left: Math.max(r0.left, t.left),
        right: Math.min(r0.right, t.right),
        top: r0.top,
        bottom: r0.bottom,
      };
      if (r.right - r.left < 4) continue;
      if (
        rects.some(
          (h) => r.right > h.left && r.left < h.right && r.bottom > h.top && r.top < h.bottom,
        )
      )
        overlaps.push(b.getAttribute("data-fridge-item"));
      const cx = (r0.left + r0.right) / 2;
      const cy = (r0.top + r0.bottom) / 2;
      // Only labels wholly on a shelf's visible part and on screen are tappable as drawn.
      if (cx < t.left + 18 || cx > t.right - 18 || cy < 0 || cy > innerHeight) continue;
      const hit = document.elementFromPoint(cx, cy);
      // Something of the fridge's own (the handle, the door, a shelf) on top of a label is a bug;
      // the app's bottom bar covering the page below the fold is not.
      if (hit && fridge.contains(hit) && !b.contains(hit))
        blocked.push(b.getAttribute("data-fridge-item"));
    }
    const handleTakesTap = handles.some((handle, i) => {
      const h = rects[i];
      const x = (h.left + h.right) / 2;
      const y = (h.top + h.bottom) / 2;
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return false;
      return document.elementFromPoint(x, y) === handle;
    });
    return { overlaps, blocked, handleTakesTap, handles: handles.length };
  });
const centreOf = (sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el?.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el?.getBoundingClientRect();
    return r ? { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 } : null;
  }, sel);
const detail = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="inventory-detail"]')?.innerText.replace(/\s+/g, " ") ??
      "",
  );
const noHScroll = () =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// ---------- 1. Drawn from the save ----------
await boot(page, fridgeSave());
await openInventory();
await fridgeTop();
await sleep(500);
const cap = await page.evaluate(
  () => document.querySelector('[data-testid="fridge-capacity"]')?.textContent ?? "",
);
const z = await zones();
check(
  "1a Basic Refrigerator · 23 / 40 units · Refrigerated (a status, never a temperature)",
  /Basic Refrigerator/.test(await text(page)) &&
    /23 \/ 40 units/.test(cap) &&
    /Refrigerated/.test(cap) &&
    !/°/.test(await text(page)),
  cap,
);
check(
  "1b every stocked ingredient is in its zone",
  z.dairy?.join() === "cheddar" &&
    ["tomato", "carrot", "onion", "potato", "pepper"].every((id) => z.vegetables?.includes(id)) &&
    z.protein?.join() === "chicken" &&
    z["fruit-drawer"]?.join() === "apple" &&
    z["greens-drawer"]?.join() === "basil" &&
    z["door-butter"]?.join() === "butter" &&
    z["door-aromatics"]?.join() === "garlic" &&
    Object.values(z).flat().length === Object.keys(STOCK).length,
  z,
);
await shot(page, "fridge-1-basic-375x642");

// ---------- 2. The door handle ----------
const hc = await handleCheck();
check(
  "2 no door handle covers an item or takes a tap; every item's centre hits the item",
  hc.overlaps.length === 0 && hc.blocked.length === 0 && !hc.handleTakesTap,
  hc,
);

// ---------- 3. Tap → details (touch and mouse) ----------
let p = await centreOf('[data-fridge-item="butter"]');
await page.touchscreen.tap(p.x, p.y);
await sleep(400);
const butter = await detail();
check(
  "3a a touch tap on the butter (in the door, beside the handle) opens its details",
  /Butter/.test(butter) &&
    /In stock 1 lb/.test(butter) &&
    /Stock value \$4\.00/.test(butter) &&
    /Used by/i.test(butter),
  butter,
);
// The sheet is modal: close it before tapping the next item.
await page.evaluate(() =>
  document
    .querySelector('[data-testid="inventory-detail"] button[aria-label="Close details"]')
    ?.click(),
);
await sleep(300);
p = await centreOf('[data-fridge-item="cheddar"]');
await page.mouse.click(p.x, p.y);
await sleep(400);
const cheddar = await detail();
check(
  "3b a mouse click on the cheddar shows quantity, freshness, value, average cost and dishes",
  /In stock 2 lb/.test(cheddar) &&
    /Freshness Fresh/.test(cheddar) &&
    /Days remaining 4 days left/.test(cheddar) &&
    /Average cost \$4\.50 \/ lb/.test(cheddar) &&
    /Stock value \$9\.00/.test(cheddar) &&
    /Used by Peach & Cheddar Board/i.test(cheddar),
  cheddar,
);
const detailInView = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="inventory-detail"]').getBoundingClientRect();
  const nav = document.querySelector("nav.absolute")?.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight && (!nav || r.bottom <= nav.top + 1);
});
check("3c the details open on screen, above the bottom bar", detailInView);
await shot(page, "fridge-2-detail");
await page.evaluate(() =>
  document
    .querySelector('[data-testid="inventory-detail"] button[aria-label="Close details"]')
    ?.click(),
);
await sleep(300);

// ---------- 4a. The Basic fits its frame ----------
const basicFit = await page.evaluate(() => {
  const track = document.querySelector(".kcf-stage .kcf-pan__track");
  return {
    overflow: document.querySelector(".kcf-stage").getAttribute("data-overflow"),
    fits: track.scrollWidth <= track.clientWidth + 2,
  };
});
check(
  "4a the Basic fits its frame: no sideways pan, no cue",
  basicFit.overflow === "false" && basicFit.fits,
  basicFit,
);

// ---------- 5. Filters (All Inventory) ----------
await clickButton(page, /^Fruit \d+$/);
await sleep(400);
const fruitOnly = await page.evaluate(() =>
  [...document.querySelectorAll("[data-inventory-item]")].map((a) =>
    a.getAttribute("data-inventory-item"),
  ),
);
check("5 the Fruit filter shows only fruit", fruitOnly.join() === "apple", fruitOnly);
await clickButton(page, /^All \d+$/);
await sleep(300);

// ---------- 6. Attention, Restock, Upgrade ----------
const att = await page.evaluate(() =>
  [...document.querySelectorAll("[data-attention-item]")].map((b) =>
    b.getAttribute("data-attention-item"),
  ),
);
check(
  "6a Needs Attention lists the chicken (spoils tonight) before the basil (use soon)",
  att.indexOf("chicken") === 0 && att.includes("basil"),
  att,
);
const before = await readSave(page);
await page.evaluate(() => {
  const row = document.querySelector('[data-attention-item="chicken"]');
  [...row.querySelectorAll("button")].find((b) => /Restock/.test(b.textContent))?.click();
});
await sleep(900);
const focused = await page.evaluate(
  () =>
    document.querySelector("article.product-card.ring-2")?.getAttribute("data-ingredient") ?? null,
);
const afterNav = await readSave(page);
check(
  "6b Restock opens Market → Ingredients on the chicken and buys nothing by itself",
  /Fresh Ingredients/.test(await text(page)) &&
    focused === "chicken" &&
    (afterNav?.economyLedger?.length ?? 0) === (before?.economyLedger?.length ?? 0) &&
    (afterNav?.credits ?? 100_000) === (before?.credits ?? 100_000),
  { focused },
);
// Buy in the Market, then the fridge shows it.
await page.evaluate(() => {
  const card = document.querySelector('article.product-card[data-ingredient="chicken"]');
  [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()))?.click();
});
await sleep(700);
const bought = await readSave(page);
const added = bought.economyLedger.slice(before.economyLedger.length);
await openInventory();
await fridgeTop();
await sleep(400);
const chickenLabel = await page.evaluate(
  () => document.querySelector('[data-fridge-item="chicken"]')?.getAttribute("aria-label") ?? "",
);
check(
  "6c a Market purchase shows in the fridge at once (one inventory-purchase ledger entry)",
  added.length === 1 &&
    added[0].category === "inventory-purchase" &&
    bought.business.inventory.chicken.quantity > 2 &&
    chickenLabel.includes(`${bought.business.inventory.chicken.quantity} lb`),
  { added: added.map((e) => e.category), chickenLabel },
);
await clickButton(page, /^Upgrade Refrigerator →/);
await sleep(800);
check(
  "6d Upgrade opens Business → Equipment (the refrigerator catalog)",
  /Commercial Refrigerator/.test(await text(page)) &&
    /Upgrade · \$2,000\.00/.test(await text(page)),
);

// ---------- 7. Tier visuals ----------
// The wide appliance is the tablet/desktop view (a phone pages one compartment at a time —
// fridgepager.mjs), so the models are compared, and the Professional panned, at 768×1024.
await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1, hasTouch: true });
const shelfH = () =>
  page.evaluate(() => {
    const f = document.querySelector('[data-testid="physical-fridge"]');
    return {
      tier: f?.getAttribute("data-tier"),
      compartments: f.querySelectorAll(".kcf-cabinet").length,
      doors: f.querySelectorAll('[data-testid="fridge-door"]').length,
      width: Math.round(document.querySelector('[data-testid="fridge-unit"]').scrollWidth),
      steel: !!f.querySelector(".kcf-topper"),
      cap: document.querySelector('[data-testid="fridge-capacity"]')?.textContent ?? "",
    };
  });
const basic = await (async () => {
  await boot(page, fridgeSave("basic-refrigerator"));
  await openInventory();
  await fridgeTop();
  await sleep(400);
  return shelfH();
})();
await boot(page, fridgeSave("commercial-refrigerator"));
await openInventory();
await fridgeTop();
await sleep(500);
const commercial = await shelfH();
await shot(page, "fridge-4-commercial");
await boot(page, fridgeSave("professional-refrigerator"));
await openInventory();
await fridgeTop();
await sleep(500);
const professional = await shelfH();
await shot(page, "fridge-5-professional");
check(
  "7 Basic 1 compartment + 1 door (enamel) → Commercial 2 + 2 → Professional 3 + 2 (steel), each wider; 40/80/140",
  basic.compartments === 1 &&
    basic.doors === 1 &&
    !basic.steel &&
    commercial.compartments === 2 &&
    commercial.doors === 2 &&
    commercial.steel &&
    professional.compartments === 3 &&
    professional.doors === 2 &&
    professional.steel &&
    basic.width < commercial.width &&
    commercial.width < professional.width &&
    /\/ 40 units/.test(basic.cap) &&
    /\/ 80 units/.test(commercial.cap) &&
    /\/ 140 units/.test(professional.cap),
  { basic, commercial, professional },
);

// ---------- 4b–d. The Professional pans ----------
const pan = () =>
  page.evaluate(() => {
    const stage = document.querySelector(".kcf-stage");
    const track = stage.querySelector(".kcf-pan__track");
    document.querySelector('[data-fridge-zone="vegetables"]').scrollIntoView({ block: "center" });
    const r = track.getBoundingClientRect();
    return {
      overflow: stage.getAttribute("data-overflow"),
      cue: !!stage.querySelector(":scope > .kcf-pan__cue"),
      hint: stage.querySelector(".kcf-pan__hint")?.textContent ?? "",
      left: track.scrollLeft,
      x: r.left + r.width * 0.6,
      y: Math.min(innerHeight * 0.5, (r.top + r.bottom) / 2),
    };
  });
const stageLeft = () =>
  page.evaluate(() => document.querySelector(".kcf-stage .kcf-pan__track").scrollLeft);
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
let s0 = await pan();
check(
  "4b the Professional is wider than the phone: the › cue and a swipe hint show",
  s0.overflow === "true" && s0.cue && /Swipe/.test(s0.hint),
  s0,
);
await swipe(s0.x, s0.y, -160, 0);
await sleep(500);
const s1 = await stageLeft();
check("4c a touch swipe pans the fridge sideways", s1 > s0.left + 40, {
  before: s0.left,
  after: s1,
});
s0 = await pan();
const top0 = await scroller();
await swipe(s0.x, s0.y, 0, -180);
await sleep(500);
const top1 = await scroller();
check("4d a vertical swipe on the fridge still scrolls the page", top1 > top0 + 40, { top0, top1 });
await page.evaluate(() => {
  document.querySelector(".kcf-stage .kcf-pan__track").scrollLeft = 0;
});
await sleep(200);
s0 = await pan();
const leftBefore = s0.left;
await page.mouse.move(s0.x, s0.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(s0.x - i * 15, s0.y);
await page.mouse.up();
await sleep(400);
const afterDrag = await stageLeft();
check(
  "4e a mouse drag pans it too, and the drag opens no item",
  afterDrag > leftBefore + 40 && (await detail()) === "",
  { leftBefore, afterDrag },
);
await shot(page, "fridge-3-panned");
const hcPro = await handleCheck();
check(
  "4f Professional: both door handles clear of every item, neither takes a tap",
  hcPro.handles === 2 &&
    hcPro.overlaps.length === 0 &&
    hcPro.blocked.length === 0 &&
    !hcPro.handleTakesTap,
  hcPro,
);

// ---------- 8. Other phones ----------
const sizes = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
];
const perSize = {};
for (const [w, h] of sizes) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await sleep(500);
  await fridgeTop();
  await sleep(300);
  const hcs = await handleCheck();
  perSize[`${w}x${h}`] = {
    hScroll: !(await noHScroll()),
    overlaps: hcs.overlaps.length,
    blocked: hcs.blocked.length,
  };
  await shot(page, `fridge-6-${w}x${h}`);
}
check(
  "8a no horizontal page scroll, handle clear of every item at every phone size",
  Object.values(perSize).every((s) => !s.hScroll && s.overlaps === 0 && s.blocked === 0),
  perSize,
);
// ---------- 9. Two crates per row ----------
// Developer: arrange the food two to a row instead of making the fridge taller.
const FULL = Object.fromEntries(
  [
    "apple",
    "avocado",
    "lemon",
    "orange",
    "pear",
    "strawberry",
    "cheddar",
    "mozzarella",
    "tofu",
    "tomato",
    "carrot",
    "cucumber",
    "onion",
    "potato",
    "chicken",
    "salmon",
    "steak",
    "bread",
    "basil",
    "lettuce",
    "spinach",
  ].map((id) => entry(id, 5)),
);
const perRow = {};
for (const [w, h] of [
  [320, 568],
  [375, 642],
]) {
  for (const tier of ["basic", "commercial", "professional"]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
    await boot(
      page,
      seedSave({
        version: 2,
        credits: 100_000,
        business: {
          calendar: { businessDay: DAY },
          inventory: FULL,
          refrigerator: { refrigeratorId: `${tier}-refrigerator` },
        },
      }),
    );
    await openInventory();
    // A phone shows one compartment at a time: step through every page (from the first).
    const out = {};
    while (
      await page.evaluate(
        () =>
          !document.querySelector('[aria-label="Previous compartment"]')?.disabled &&
          !!document.querySelector('[aria-label="Previous compartment"]'),
      )
    )
      await page.evaluate(() =>
        document.querySelector('[aria-label="Previous compartment"]').click(),
      );
    for (let guard = 0; guard < 8; guard++) {
      Object.assign(
        out,
        await page.evaluate(() => {
          const o = {};
          for (const z of document.querySelectorAll(".kcf-cabinet [data-fridge-zone]")) {
            const tops = [...z.querySelectorAll("[data-fridge-item]")].map((b) =>
              Math.round(b.getBoundingClientRect().top),
            );
            const rows = tops.reduce((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {});
            o[z.getAttribute("data-fridge-zone")] = Math.max(0, ...Object.values(rows));
          }
          return o;
        }),
      );
      const next = await page.evaluate(() => {
        const b = document.querySelector('[aria-label="Next compartment"]');
        if (!b || b.disabled) return false;
        b.click();
        return true;
      });
      if (!next) break;
      await sleep(150);
    }
    perRow[`${tier}@${w}`] = out;
  }
}
check(
  "9 every shelf and drawer holds two crates per row (Basic, Commercial, Professional at 320 and 375 px)",
  Object.values(perRow).every((zones) => Object.values(zones).every((n) => n >= 2)),
  perRow,
);
check(
  "8b console has no errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs,
);

save("fridge-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nFRIDGE E2E: ALL PASS" : `\nFRIDGE E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
