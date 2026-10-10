// Kitchen tools (supplies plan A, developer 2026-10-10: "ask the player to buy some important tools
// when the game starts and the rest when necessary"), restaurant build, in a real browser:
//   1. Level 10 (the Market opens): Grandma's old peeler, bowl and measuring cups arrive free (no
//      ledger entry); the Pre-Service Check opens with Grandma's first shopping list (sheet pans,
//      oven mitts, frying pans, stock pot …) and START is not blocked.
//   2. Buy on the list → the Market's Culinary card for that tool, preselected → Buy → back: the
//      tool leaves the list; one supply-equipment-purchase entry for its price.
//   3. Level 11 (Garlic Bread) without a sheet pan and oven mitts: the "🍳 Kitchen tools" rows say
//      why, START waits ("Restock to start"); buying both opens START.
//   4. Level 11 with $0 (no ads on the mock platform): supplier credit brings the tools, START opens.
//   5. 320×568: the tools rows and the list fit, buttons ≥ 48 px, no sideways scroll.
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

// An empty kitchen (MOVED_IN_BUSINESS owns every tool for the other tests).
const EMPTY = { stock: {} };
const saveAt = (n, credits, business = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, grandmasTools: undefined, supplies: EMPTY, ...business },
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const GRANDMA = {
  grandmasTools: { atLevel: 10 },
  supplies: {
    stock: {
      peelers: { units: 1, costBasis: 0 },
      "mixing-bowls": { units: 1, costBasis: 0 },
      "measuring-cups": { units: 1, costBasis: 0 },
    },
    lifetime: {
      culinary: { spent: 0, retailValue: 0, purchases: 0, unitsUsed: 0, usedCost: 0 },
      service: { spent: 0, retailValue: 0, purchases: 0, unitsUsed: 0, usedCost: 0 },
      packaging: { spent: 0, retailValue: 0, purchases: 0, unitsUsed: 0, usedCost: 0 },
    },
  },
};
async function openToday() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(600);
  await clickButton(page, /^Prepare$/);
  await sleep(1200);
}
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    if (!el) return null;
    const start = [...el.querySelectorAll("button")].find((b) =>
      /^(OPEN THE RESTAURANT|START SERVICE|Restock to start|Hire)/.test(b.textContent.trim()),
    );
    return {
      list: [...el.querySelectorAll("[data-shopping-tool]")].map((x) =>
        x.getAttribute("data-shopping-tool"),
      ),
      tools: [...el.querySelectorAll("[data-psc-tool]")].map((x) => [
        x.getAttribute("data-psc-tool"),
        x.getAttribute("data-psc-status"),
      ]),
      text: el.innerText.replace(/\s+/g, " "),
      needed:
        el.querySelector('[data-testid="psc-tools-needed"]')?.innerText.replace(/\s+/g, " ") ??
        null,
      ready:
        el.querySelector('[data-testid="psc-tools-ready"]')?.innerText.replace(/\s+/g, " ") ?? "",
      startText: start?.textContent.trim() ?? null,
      startDisabled: start ? start.disabled : null,
    };
  });
/** On the Market's open Culinary section: Buy on `id`'s card, then back to the check. */
async function buyOnCard(id) {
  const r = await page.evaluate((id) => {
    const card = document.querySelector(`[data-supply="${id}"]`);
    const buy =
      card &&
      [...card.querySelectorAll("button")].find((b) => /^Buy · /.test(b.textContent.trim()));
    buy?.click();
    return { card: !!card, focused: !!card && /ring-2/.test(card.className) };
  }, id);
  await sleep(600);
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(900);
  return r;
}

// ---------- 1. Level 10: Grandma's tools and the first shopping list ----------
await boot(page, saveAt(10, 500000));
const before = await readSave(page);
await openToday();
const s1 = await sheet();
const after1 = await readSave(page);
await shot(page, "tools-l10-list");
check(
  "1 Level 10: Grandma's old tools arrive free (no ledger); the check opens with the first shopping list; START isn't blocked",
  ["peelers", "mixing-bowls", "measuring-cups"].every(
    (id) =>
      after1.business.supplies.stock[id]?.units === 1 &&
      after1.business.supplies.stock[id]?.costBasis === 0,
  ) &&
    after1.economyLedger.length === before.economyLedger.length &&
    !!s1 &&
    ["sheet-pans", "oven-mitts", "frying-pans", "stock-pot"].every((id) => s1.list.includes(id)) &&
    !s1.list.includes("peelers") &&
    s1.startDisabled === false,
  { list: s1?.list, start: s1?.startText },
);

// ---------- 2. Buy from the list ----------
await page.evaluate(() =>
  document.querySelector('[data-shopping-tool="sheet-pans"] button')?.click(),
);
await sleep(900);
const card = await buyOnCard("sheet-pans");
const s2 = await sheet();
const after2 = await readSave(page);
const entries = after2.economyLedger.slice(after1.economyLedger.length);
check(
  "2 Buy → the Market's sheet-pan card, preselected → Buy → back: off the list; one supply-equipment-purchase entry",
  card.card &&
    card.focused &&
    !!s2 &&
    !s2.list.includes("sheet-pans") &&
    after2.business.supplies.stock["sheet-pans"]?.units === 1 &&
    entries.length === 1 &&
    entries[0].category === "supply-equipment-purchase" &&
    after2.credits - after1.credits === entries[0].amount,
  { card, list: s2?.list, entries },
);

// ---------- 3. Level 11: Garlic Bread waits for its tools ----------
await boot(page, saveAt(11, 500000, GRANDMA));
await openToday();
const s3 = await sheet();
await shot(page, "tools-l11-missing");
await page.evaluate(() => document.querySelector('[data-psc-tool="sheet-pans"] button')?.click());
await sleep(900);
await buyOnCard("sheet-pans");
await page.evaluate(() => document.querySelector('[data-psc-tool="oven-mitts"] button')?.click());
await sleep(900);
await buyOnCard("oven-mitts");
const s3b = await sheet();
check(
  "3 Level 11: the top says what today's dishes need, the rows say why (sheet pan, oven mitts), START waits; both bought → ✓ Ready, START opens",
  !!s3 &&
    /Today's dishes need: .*Sheet pan.*Oven mitts|Today's dishes need: .*Oven mitts.*Sheet pan/.test(
      s3.needed ?? "",
    ) &&
    s3.tools
      .map(([id]) => id)
      .sort()
      .join() === "oven-mitts,sheet-pans" &&
    s3.tools.every(([, st]) => st === "missing") &&
    /Vegetable peeler/.test(s3.ready) &&
    /oven/i.test(s3.text) &&
    s3.startDisabled === true &&
    !!s3b &&
    s3b.tools.length === 0 &&
    s3b.needed === null &&
    /Sheet pan/.test(s3b.ready) &&
    s3b.startDisabled === false,
  { before: s3?.tools, after: s3b?.tools, start: [s3?.startText, s3b?.startText] },
);

// ---------- 4. $0: supplier credit for the tools ----------
await boot(page, saveAt(11, 0, GRANDMA));
await openToday();
const s4 = await sheet();
const creditButtons = await page.evaluate(
  () =>
    [...document.querySelectorAll('[data-testid="pre-service-check"] button')].filter((b) =>
      /Supplier credit/.test(b.textContent),
    ).length,
);
for (let i = 0; i < creditButtons; i++) {
  await clickButton(page, /Supplier credit/);
  await sleep(700);
}
const s4b = await sheet();
const after4 = await readSave(page);
check(
  "4 with $0 (no ads here) supplier credit brings the tools — no money moved, the price owed, START opens",
  !!s4 &&
    /Supplier credit/.test(s4.text) &&
    after4.credits === 0 &&
    after4.economyLedger.length === 0 &&
    (after4.business.supplierCredit?.owed ?? 0) > 0 &&
    after4.business.supplies.stock["sheet-pans"]?.units >= 1 &&
    s4b?.startDisabled === false,
  { credit: after4.business.supplierCredit, start: s4b?.startText },
);

// ---------- 5. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(10, 500000));
await openToday();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="pre-service-check"]');
  const buttons = el
    ? [...el.querySelectorAll('[data-testid="psc-shopping-list"] button, [data-psc-tool] button')]
    : [];
  return {
    buttons: buttons.length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons.filter((b) => b.getBoundingClientRect().height < 47.5).map((b) => b.textContent),
  };
});
await shot(page, "tools-l10-320");
check(
  "5 at 320×568 the list and tools rows fit: no sideways scroll, buttons ≥ 48 px",
  fit.buttons > 0 && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `KITCHEN TOOLS E2E: ${failed.length} FAILURE(S)` : "KITCHEN TOOLS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
