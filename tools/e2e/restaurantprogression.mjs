// Unified Restaurant — the developer's 2026-10-05 brief, in a real browser, on a
// RESTAURANT_MODE test build (VITE_RESTAURANT_MODE=1; a normal build never has it on).
//   1. Level 11: the Pre-Service Check's news opens the menu (4 dishes) and explains the chain
//      Menu → Customer Order → Inventory → Preparation → Service → Revenue.
//   2. Level 35, empty fridge: Inventory's ⚠️ NEEDS ATTENTION lists the next service's missing
//      ingredients with a recommended restock; Restock → the exact Market card.
//   3. Bulk buying: the card's 25 preset shows the bulk saving; buying it writes ONE ledger entry
//      for exactly the quoted (discounted) total.
//   4. Supplies: napkins' 100 preset buys 100 packs at the bulk price, one ledger entry.
//   5. Level 52: the check lists the staff the service needs (Indian Chef, Prep Cook, Server)
//      with the reason and blocks START; Hire → Staff (free) → back: every requirement met.
//   6. Before Level 250 the Restaurant tab has no Business Day (one-restaurant note) and the
//      Kitchen tile says "Endless Restaurant 🔒"; after Level 250 it opens the Endless Restaurant.
//   7. 320×568: the check with news and staff fits (no sideways scroll).
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

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

// Test saves are version 1: credits are whole dollars there (×100 on load).
const saveAt = (n, dollars, extra = {}) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits: dollars,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${Math.min(n, 250)}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
    ...extra,
  });
const nav = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((x) => x.textContent.includes(l))?.click(),
    label,
  );
async function openLevel(title) {
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
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(900);
}
const sheetText = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="pre-service-check"]')?.innerText.replace(/\s+/g, " ") ??
      null,
  );

// ---------- 1. Level 11: the menu opens ----------
await boot(page, saveAt(11, 500));
await openLevel("Garlic Bread");
const news = await page.evaluate(() => ({
  card: document.querySelector('[data-testid="psc-news"]')?.innerText.replace(/\s+/g, " "),
  chain: document.querySelector('[data-testid="psc-chain"]')?.textContent,
  dishes: document.querySelector('[data-testid="psc-news-dishes"]')?.innerText.replace(/\s+/g, " "),
}));
await shot(page, "restaurant-news-l11");
check(
  "1 L11 news: 'Your menu', the chain Menu → Customer Order → … → Revenue, 4 dishes with the reason",
  /Your menu/.test(news.card ?? "") &&
    news.chain === "Menu → Customer Order → Inventory → Preparation → Service → Revenue" &&
    /Caprese Salad/.test(news.dishes ?? "") &&
    /Garlic Bread/.test(news.dishes ?? "") &&
    /New on the menu: Caprese Salad, Mushroom Bruschetta, Garden Salad, Garlic Bread\b/.test(
      news.dishes ?? "",
    ),
  news,
);

// ---------- 2. Inventory: NEEDS ATTENTION ----------
await boot(page, saveAt(35, 2000));
await nav("Inventory");
await sleep(800);
const att = await page.evaluate(() => ({
  text: document
    .querySelector('[data-testid="restaurant-attention"]')
    ?.innerText.replace(/\s+/g, " "),
  rows: [...document.querySelectorAll("[data-attention]")].map((r) => ({
    id: r.getAttribute("data-attention"),
    sev: r.getAttribute("data-attention-severity"),
  })),
  rec: document.querySelector('[data-testid="restaurant-recommended"]')?.textContent,
}));
await shot(page, "restaurant-attention");
const firstIngredient = att.rows.find((r) => r.id.startsWith("ingredient:"))?.id.split(":")[1];
check(
  "2a Inventory shows ⚠️ NEEDS ATTENTION: the next service's missing ingredients (urgent) and a recommended restock",
  /NEEDS ATTENTION/.test(att.text ?? "") &&
    !!firstIngredient &&
    att.rows[0].sev === "urgent" &&
    /remaining \(Level 35 needs/.test(att.text ?? "") &&
    /Recommended restock for Level 35/.test(att.rec ?? ""),
  att,
);
await page.evaluate(
  (id) => document.querySelector(`[data-attention="ingredient:${id}"] button`)?.click(),
  firstIngredient,
);
await sleep(900);
const focused = await page.evaluate(
  (id) => !!document.querySelector(`[data-ingredient="${id}"].ring-2`),
  firstIngredient,
);
check("2b Restock → the Market opens on that exact ingredient", focused, { firstIngredient });

// ---------- 3. Bulk buying: ingredients ----------
const before = await readSave(page);
await page.evaluate(
  (id) => document.querySelector(`[data-ingredient="${id}"] [data-bulk-preset="25"]`)?.click(),
  firstIngredient,
);
await sleep(300);
const card = await page.evaluate((id) => {
  const c = document.querySelector(`[data-ingredient="${id}"]`);
  return {
    saving: c?.querySelector('[data-testid="bulk-saving"]')?.textContent.replace(/\s+/g, " "),
    buy: [...(c?.querySelectorAll("button") ?? [])]
      .find((b) => /^Buy /.test(b.textContent.trim()))
      ?.textContent.trim(),
  };
}, firstIngredient);
await page.evaluate((id) => {
  const c = document.querySelector(`[data-ingredient="${id}"]`);
  [...(c?.querySelectorAll("button") ?? [])]
    .find((b) => /^Buy /.test(b.textContent.trim()))
    ?.click();
}, firstIngredient);
await sleep(700);
const after = await readSave(page);
const entries = after.economyLedger.slice(before.economyLedger.length);
const quoted = Math.round(
  Number((/\$([\d,]+\.\d\d)/.exec(card.buy ?? "")?.[1] ?? "0").replace(/,/g, "")) * 100,
);
check(
  "3 the 25 preset shows 'Bulk −3%'; buying writes ONE inventory-purchase entry for exactly the quoted total",
  /^Buy 25 /.test(card.buy ?? "") &&
    /Bulk −3%/.test(card.saving ?? "") &&
    entries.length === 1 &&
    entries[0].category === "inventory-purchase" &&
    entries[0].amount === -quoted &&
    before.credits - after.credits === quoted &&
    after.business.inventory[firstIngredient]?.quantity === 25,
  { card, entries, quoted },
);

// ---------- 4. Bulk buying: supplies ----------
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll("button")].filter((b) =>
    /Takeaway/.test(b.textContent),
  );
  tabs[0]?.click();
});
await sleep(300);
await nav("Market");
await sleep(600);
await clickButton(page, /Takeaway/);
await sleep(700);
const b4 = await readSave(page);
await page.evaluate(() =>
  document.querySelector('[data-supply="paper-napkins"] [data-bulk-preset="100"]')?.click(),
);
await sleep(300);
const napkinCard = await page.evaluate(() => {
  const c = document.querySelector('[data-supply="paper-napkins"]');
  const buy = [...(c?.querySelectorAll("button") ?? [])].find((b) =>
    /^Buy ·/.test(b.textContent.trim()),
  );
  const text = buy?.textContent.trim();
  buy?.click();
  return { text, saving: c?.querySelector('[data-testid="bulk-saving"]')?.textContent };
});
await sleep(700);
const a4 = await readSave(page);
const e4 = a4.economyLedger.slice(b4.economyLedger.length);
check(
  "4 napkins: the 100 preset buys 100 packs at the bulk price (−8%), one supply-packaging-purchase entry",
  /Bulk −8%/.test(napkinCard.saving ?? "") &&
    e4.length === 1 &&
    e4[0].category === "supply-packaging-purchase" &&
    a4.business.supplies.stock["paper-napkins"]?.units === 100 * 4000,
  { napkinCard, e4, units: a4.business.supplies.stock["paper-napkins"]?.units },
);

// ---------- 5. Level 52: staff requirements ----------
await boot(page, saveAt(52, 5000));
await openLevel("Onion Tomato Masala Base");
let staff = await page.evaluate(() =>
  [...document.querySelectorAll("[data-psc-staff]")].map((r) => ({
    id: r.getAttribute("data-psc-staff"),
    status: r.getAttribute("data-psc-status"),
    text: r.innerText.replace(/\s+/g, " "),
  })),
);
const startDisabled = await page.evaluate(
  () =>
    [...document.querySelectorAll('[data-testid="pre-service-check"] button')].find((b) =>
      /Restock to start|Hire staff to start|START SERVICE|OPEN THE RESTAURANT/.test(b.textContent),
    )?.disabled,
);
await shot(page, "restaurant-staff-check");
const fit = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(400);
await shot(page, "restaurant-staff-check-320");
const fit320 = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  sheet: !!document.querySelector('[data-testid="pre-service-check"]'),
}));
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(400);
check(
  "5a L52: the check needs the Indian Chef, a Prep Cook and a Server — each with its reason — and START is blocked",
  ["indian-chef", "prep-cook", "server"].every((id) =>
    staff.some((r) => r.id === id && r.status === "missing" && r.text.length > 30),
  ) && startDisabled === true,
  { staff, startDisabled },
);
await clickButton(page, /^Hire .* → Staff/);
await sleep(900);
const onStaff = await page.evaluate(
  () => !!document.querySelector('[data-testid="specialist-chefs"]'),
);
await page.evaluate(() =>
  document.querySelector('[data-specialist="indian-chef"] button')?.click(),
);
await sleep(300);
for (const name of ["Prep Cook", "Server"]) {
  await page.evaluate((n) => {
    const art = [...document.querySelectorAll("article")].find((a) =>
      [...a.querySelectorAll("p")].some((p) => p.textContent.trim() === n),
    );
    [...(art?.querySelectorAll("button") ?? [])]
      .find((b) => b.textContent.trim() === "Hire")
      ?.click();
  }, name);
  await sleep(300);
}
const hiredSave = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
await sleep(900);
staff = await page.evaluate(() =>
  [...document.querySelectorAll("[data-psc-staff]")].map((r) => ({
    id: r.getAttribute("data-psc-staff"),
    status: r.getAttribute("data-psc-status"),
  })),
);
check(
  "5b Hire → Restaurant → Staff (free: no money, no ledger) → back to the check: every requirement met",
  onStaff &&
    staff.length >= 3 &&
    staff.every((r) => r.status === "ok") &&
    hiredSave.business.restaurantStaff?.specialists?.includes("indian-chef") &&
    hiredSave.business.staff.hiredRoles.includes("prep-cook") &&
    hiredSave.economyLedger.length === 0,
  { staff, ledger: hiredSave.economyLedger.length },
);
check(
  "7 the check (news + staff) fits at 430 and 320 px",
  fit <= 0 && fit320.overflow <= 0 && fit320.sheet,
  {
    fit,
    fit320,
  },
);

// ---------- 6. One restaurant before L250, Endless Restaurant after ----------
await boot(page, saveAt(60, 500));
await nav("Restaurant");
await sleep(800);
const before250 = await page.evaluate(() => ({
  note: !!document.querySelector('[data-testid="one-restaurant-note"]'),
  open: [...document.querySelectorAll("button")].some((b) =>
    /Open (the Endless )?Restaurant/.test(b.textContent),
  ),
}));
await nav("Kitchen");
await sleep(600);
await clickButton(page, /^See all orders/);
await sleep(700);
const tile = await page.evaluate(() =>
  document.querySelector('[data-testid="endless-tile"]')?.innerText.replace(/\s+/g, " "),
);
await boot(page, saveAt(251, 500));
await nav("Restaurant");
await sleep(800);
const after250 = await page.evaluate(() => ({
  note: !!document.querySelector('[data-testid="one-restaurant-note"]'),
  open: [...document.querySelectorAll("button")].some((b) =>
    /Open the Endless Restaurant/.test(b.textContent),
  ),
}));
await shot(page, "restaurant-endless");
check(
  "6 before L250: no Business Day (one-restaurant note), Kitchen tile 'Endless Restaurant 🔒'; after L250: Open the Endless Restaurant",
  before250.note &&
    !before250.open &&
    /Endless Restaurant/.test(tile ?? "") &&
    /🔒/.test(tile ?? "") &&
    !after250.note &&
    after250.open,
  { before250, tile, after250 },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("8 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT PROGRESSION E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT PROGRESSION E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
