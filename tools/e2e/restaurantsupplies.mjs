// Unified Restaurant phase G — consumable supplies, in a real browser, on a RESTAURANT_MODE
// test build (the default build — the restaurant is on unless VITE_RESTAURANT_MODE=0).
//   1. Level 22 (the 150-level campaign: dine-in starts at 21; was Level 31's Baguette Rounds),
//      nothing bought: the Pre-Service Check lists Supplies by the dish (supplies plan B,
//      2026-10-10): Potato Veloute Base is a soup, so a soup bowl, a soup spoon and a water
//      glass, plus the table's menu stand, salt & pepper and napkin holder, block (START
//      disabled); napkins and the menu guests' tableware only warn; the dish-soap and
//      cleaning-liquid bottles show "Empty".
//   2. Restock → opens the Market on that exact supply line; one pack of each blocking piece,
//      napkins and dish soap (bought in the Market, ONE ledger entry each) and the check turns
//      ready; the soap bottle then shows a % and "~N services left".
//   3. Serving the order takes the dish's pieces (→ washing) and a napkin automatically;
//      finishing the level leaves them in the sink (the sink game, developer 2026-10-23: washed
//      by hand, or by the wash-up at the next START) — no soap used yet; Level Complete says so.
//   4. Inventory → Supplies shows the place settings and both bottles (read-only).
//   5. Level 23 (Dinner) ends the day: Closing Time shows the empty cleaning-liquid bottle
//      and still closes for the night.
//   6. Level 22 with $0: supplier credit brings the missing tableware (the Market's packs, no money
//      moved, the price owed) and the service can start (was Grandma's spares — rule changed
//      2026-10-10).
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
  openSection,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();

// The day opened at Level 21 (Breakfast, done): 3 services a day from L21 (developer
// 2026-10-10), so Level 22 is Lunch and Level 23 Dinner — then closing time.
const DAY_FROM_21 = {
  day: 11,
  opened: true,
  servicesDone: 1,
  servicesPlanned: 3,
  closingDue: false,
  openingCredits: 0,
  openingLevel: 21,
};
const saveAt = (n, credits) =>
  seedSave({
    // The free Mexican Chef is needed from Level 16 (menu guests): hired, so the check is
    // about supplies only.
    business: {
      ...MOVED_IN_BUSINESS,
      restaurantDay: DAY_FROM_21,
      restaurantStaff: { specialists: ["mexican-chef"] },
    },
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

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
}
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    if (!el) return null;
    const start = [...el.querySelectorAll("button")].find((b) =>
      /(?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service)|(?:🛒 )?Restock to start|(?:👥 )?Hire staff to start/.test(
        b.textContent,
      ),
    );
    return {
      supplies: [...el.querySelectorAll("[data-psc-supply]")].map((r) => ({
        id: r.getAttribute("data-psc-supply"),
        status: r.getAttribute("data-psc-status"),
        guest: r.hasAttribute("data-psc-guest"),
      })),
      bottles: [...el.querySelectorAll("[data-bottle]")].map((r) => ({
        id: r.getAttribute("data-bottle"),
        status: r.getAttribute("data-bottle-status"),
        text: r.innerText.replace(/\s+/g, " "),
      })),
      startDisabled: start ? start.disabled : null,
      text: el.innerText.replace(/\s+/g, " "),
    };
  });

/** From the open check: Restock → Market on that line → Buy one pack → back to the check. */
async function buyFromCheck(selector, supplyId) {
  await page.evaluate((sel) => document.querySelector(`${sel} button`)?.click(), selector);
  await sleep(900);
  const focused = await page.evaluate(
    (id) => !!document.querySelector(`[data-supply="${id}"]`),
    supplyId,
  );
  await page.evaluate((id) => {
    const card = document.querySelector(`[data-supply="${id}"]`);
    [...(card?.querySelectorAll("button") ?? [])]
      .find((b) => /^Buy ·/.test(b.textContent.trim()))
      ?.click();
  }, supplyId);
  await sleep(500);
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(800);
  return focused;
}
/** Buys exactly what the check says the food is missing (as restaurantguests.mjs does). */
async function restockFood() {
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('[data-psc-ingredient][data-psc-status="missing"]')].map((r) =>
      r.getAttribute("data-psc-ingredient"),
    ),
  );
  for (const id of rows) {
    // The row's Restock (its ⓘ, since the 2026-10-16 copy sweep, may come first).
    await page.evaluate(
      (x) =>
        [...document.querySelectorAll(`[data-psc-ingredient="${x}"] button`)]
          .find((b) => /Restock/.test(b.textContent))
          ?.click(),
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
}

/** Buys every blocking supply the open check is missing (the dish's tableware, the tables). */
async function restockSupplies() {
  for (let i = 0; i < 12; i++) {
    const id = await page.evaluate(
      () =>
        document
          .querySelector('[data-psc-supply][data-psc-status="missing"]:not([data-psc-guest])')
          ?.getAttribute("data-psc-supply") ?? null,
    );
    if (!id) break;
    await buyFromCheck(`[data-psc-supply="${id}"]:not([data-psc-guest])`, id);
  }
}

// ---------- 1. Level 22, nothing bought ----------
await boot(page, saveAt(22, 50_000)); // $50,000 (version-1 test saves are in dollars)
await prepare("Potato Veloute Base");
const s1 = await sheet();
await shot(page, "restaurant-supplies-check");
const own = (s) => s?.supplies.filter((r) => !r.guest) ?? [];
const status = (id) => own(s1).find((r) => r.id === id)?.status;
const BLOCKING = [
  "soup-bowls",
  "soup-spoons",
  "water-glasses",
  "menu-stands",
  "salt-pepper",
  "napkin-holders",
];
check(
  "1 L22 check: the soup's bowl, spoon and water glass + the table's stand, salt & pepper and napkin holder block; napkins and the guests' tableware warn; both bottles empty; START disabled",
  !!s1 &&
    BLOCKING.every((id) => status(id) === "missing") &&
    !own(s1).some((r) => ["dinner-plates", "dinner-forks"].includes(r.id)) &&
    status("paper-napkins") === "warning" &&
    s1.supplies.filter((r) => r.guest).every((r) => r.status !== "missing") &&
    s1.bottles.length === 2 &&
    s1.bottles.every((b) => b.status === "empty" && /Empty/.test(b.text)) &&
    s1.startDisabled === true,
  s1 && { supplies: s1.supplies, bottles: s1.bottles, startDisabled: s1.startDisabled },
);

// ---------- 2. Restock in the Market ----------
await restockFood();
const before = await readSave(page);
const focus = [];
for (const id of [...BLOCKING, "paper-napkins"])
  focus.push(await buyFromCheck(`[data-psc-supply="${id}"]:not([data-psc-guest])`, id));
focus.push(await buyFromCheck('[data-bottle="dish-soap"]', "dish-soap"));
const bought = await readSave(page);
const s2 = await sheet();
const newEntries = bought.economyLedger.slice(before.economyLedger.length);
const soap = s2?.bottles.find((b) => b.id === "dish-soap");
check(
  "2 Restock opens the exact Market line; 8 purchases = 8 ledger entries; the check is ready; soap shows ~N washes remaining",
  focus.every(Boolean) &&
    newEntries.length === 8 &&
    newEntries.every((e) => /^supply-/.test(e.category)) &&
    own(s2).every((r) => r.status === "ok") &&
    s2?.startDisabled === false &&
    soap?.status === "ok" &&
    /~\d+ washes remaining/.test(soap.text),
  { focus, entries: newEntries.map((e) => e.category), s2: s2?.supplies, soap },
);

// ---------- 3. Serve: a setting and a napkin; finish: the wash-up ----------
await clickButton(
  page,
  /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
);
await sleep(900);
await page.waitForFunction(
  () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  {
    timeout: 30000,
  },
);
const played = await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(1000);
const served = await readSave(page);
check(
  "3a serving takes the soup's bowl, spoon and glass (→ washing) and two napkins (a messy dish), automatically",
  played.ok &&
    served.business.restaurantSupplies?.washing === 1 &&
    ["soup-bowls", "soup-spoons", "water-glasses"].every(
      (id) => served.business.restaurantSupplies?.dirty?.[id] === 1,
    ) &&
    // napkinsFor (serviceSupplies.ts): two napkins for a messy dish (curries, soups, fried).
    served.business.supplies.stock["paper-napkins"]?.units ===
      bought.business.supplies.stock["paper-napkins"].units - 2 &&
    served.business.supplies.stock["soup-bowls"]?.units ===
      bought.business.supplies.stock["soup-bowls"].units,
  { washing: served.business.restaurantSupplies, played: played.ok },
);
await clickButton(page, /^Finish Level$/);
await sleep(1000);
const done = await readSave(page);
// The sink game (developer 2026-10-23; was "the wash-up runs: nothing washing, soap 95 %"):
// the service's pieces wait in the sink, the soap is untouched until they're washed.
check(
  "3b finishing the service leaves its bowl, spoon and glass in the sink; no dish soap used yet",
  done.levelProgress.completedLevelIds.includes("level-22") &&
    ["soup-bowls", "soup-spoons", "water-glasses"].every(
      (id) => done.business.restaurantSupplies?.dirty?.[id] === 1,
    ) &&
    (done.business.restaurantSupplies?.soapPct ?? 0) === 0 &&
    done.business.supplies.stock["dish-soap"]?.units === 4 &&
    done.credits >= served.credits,
  { rs: done.business.restaurantSupplies, soap: done.business.supplies.stock["dish-soap"] },
);

const lc = (await text(page)).replace(/\s+/g, " ");
check(
  "3c Level Complete reports the service (supplies plan D): 1 guest served, 3 in the sink; not spotless — no cleaning liquid (the streak starts again)",
  // "🫧 3 in the sink" since the sink game (2026-10-23; was "🧼 N washed").
  /🍽️ 1 guest served/.test(lc) &&
    /🫧 3 in the sink/.test(lc) &&
    /Not spotless: no cleaning liquid/.test(lc) &&
    done.business.restaurantRecord?.services >= 1 &&
    done.business.restaurantRecord?.streak === 0 &&
    done.business.restaurantRecord?.lastHygiene?.cleaner === false,
  { record: done.business.restaurantRecord, lc: lc.slice(0, 400) },
);

// Developer 2026-10-10: the Level Complete card goes away when the player taps elsewhere.
// (An achievement to collect may follow with its own card — 2026-10-16 — so the check is on
// the Level Complete card itself.)
const levelCompleteUp = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="banner-close"]')].some((b) =>
      /LEVEL COMPLETE/i.test(b.parentElement?.innerText ?? ""),
    ),
  );
const bannerUp = await levelCompleteUp();
await page.mouse.click(12, 700);
await sleep(400);
const bannerAfter = await levelCompleteUp();
check("3d a tap outside the Level Complete card closes it at once", bannerUp && !bannerAfter, {
  bannerUp,
  bannerAfter,
});

// ---------- 4. Inventory → Supplies ----------
// Inventory opens from the Restaurant map (openSection).
await openSection(page, "Inventory");
await sleep(700);
await clickButton(page, /Supplies/);
await sleep(700);
const inv = await page.evaluate(
  () =>
    document.querySelector('[data-testid="supplies-restaurant"]')?.innerText.replace(/\s+/g, " ") ??
    null,
);
await shot(page, "restaurant-supplies-inventory");
check(
  "4 Inventory → Supplies shows the place settings and the 3 to wash, what each guest eats from, the soap still sealed and the empty cleaning liquid",
  !!inv &&
    /Place settings: \d+ clean/.test(inv) &&
    // "👤 🍽️ 🍴 🥛 per guest" since the picture pass (2026-10-23; was "Per guest: plate or bowl …").
    /per guest/.test(inv) &&
    // The sink game (2026-10-23; was "95%, ~79 washes"): nothing washed yet, the soap is sealed.
    /🫧 3 to wash/.test(inv) &&
    /Dish soap — 0% \+ 4 spare/.test(inv) &&
    /~80 washes remaining/.test(inv) &&
    /Cleaning liquid — 0%/.test(inv),
  inv,
);

// ---------- 5. Closing time ----------
// Level 22 was Lunch; Level 23 is Dinner, then it's closing time.
await prepare("Garlic & Tomato Sauce");
if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
  await restockFood();
  // Supplies plan B: the plated dish needs its own pieces.
  await restockSupplies();
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
  );
  await sleep(900);
}
await page.waitForFunction(
  () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  {
    timeout: 30000,
  },
);
await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(1000);
await clickButton(page, /^Finish Level$/);
await sleep(1800);
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(900);
const day = (await readSave(page)).business.restaurantDay;
const ct = await page.evaluate(
  () =>
    document.querySelector('[data-testid="closing-cleaner"]')?.innerText.replace(/\s+/g, " ") ??
    null,
);
await shot(page, "restaurant-supplies-closing");
await clickButton(page, /^Close for the night/);
await sleep(800);
const afterClose = await readSave(page);
check(
  "5 after Dinner (L23) closing shows the empty cleaning-liquid bottle and still closes for the night; Lunch's dishes were washed at Dinner's START, Dinner's wait in the sink",
  day?.closingDue === true &&
    !!ct &&
    /Empty/.test(ct) &&
    afterClose.business.restaurantDay?.day === day.day + 1 &&
    // The sink game (2026-10-23; was "nothing washing"): the START wash-up washed Lunch's
    // three pieces (soap opened), Dinner's own dishes wait overnight.
    (afterClose.business.restaurantSupplies?.washedTotal ?? 0) >= 3 &&
    (afterClose.business.restaurantSupplies?.soapPct ?? 0) > 0 &&
    Object.values(afterClose.business.restaurantSupplies?.dirty ?? {}).some((n) => n > 0),
  { ct, day, dayAfter: afterClose.business.restaurantDay },
);

// ---------- 6. Supplier credit (rule changed 2026-10-10: Grandma's spares are gone) ----------
// Test saves are version 1, whose money is whole dollars (×100 on load): this is $0 (the
// soup's ingredients cost under $1, so with $1 they'd be bought, not lent).
// The mock platform shows no rewarded ads, so the check offers supplier credit.
await boot(page, saveAt(22, 0));
await prepare("Potato Veloute Base");
const poor = await sheet();
const b0 = await readSave(page);
const creditButtons = await page.evaluate(
  () =>
    [...document.querySelectorAll('[data-testid="pre-service-check"] button')].filter((b) =>
      /Supplier credit/.test(b.textContent),
    ).length,
);
// One button per short part (ingredients, supplies); take each on credit, as long as one is
// offered (the next part's button shows once the first is covered).
for (let i = 0; i < 4; i++) {
  if (!(await clickButton(page, /Supplier credit/))) break;
  await sleep(600);
}
const lent = await readSave(page);
const s6 = await sheet();
check(
  "6 with $0 supplier credit brings the Market's packs (no money, no ledger now, the price owed) and START is enabled",
  !!poor &&
    /Not enough money/.test(poor.text) &&
    !/Grandma's spares|Emergency Service/.test(poor.text) &&
    creditButtons >= 1 &&
    lent.credits === b0.credits &&
    lent.economyLedger.length === b0.economyLedger.length &&
    BLOCKING.every(
      (id) =>
        (lent.business.supplies.stock[id]?.units ?? 0) >= 1 &&
        (lent.business.supplies.stock[id]?.costBasis ?? 0) > 0,
    ) &&
    (lent.business.supplierCredit?.owed ?? 0) > 0 &&
    s6?.startDisabled === false,
  {
    stock: lent.business.supplies.stock,
    start: s6?.startDisabled,
    credit: lent.business.supplierCredit,
  },
);

const fit = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(500);
await shot(page, "restaurant-supplies-check-320");
const fit320 = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  sheet: !!document.querySelector('[data-testid="pre-service-check"]'),
}));
check(
  "7 the check fits at 430 and 320 px (no sideways scroll) and survives the resize",
  fit <= 0 && fit320.overflow <= 0 && fit320.sheet,
  { fit, fit320 },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("8 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT SUPPLIES E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT SUPPLIES E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
