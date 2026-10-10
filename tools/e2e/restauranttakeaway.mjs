// Takeaway by dish + closing supplies (supplies plan C, developer 2026-10-10: "ensure that
// packaging, cleaning and napkins … are depended to 250 level campaigns and affect the
// gameplay"), restaurant build, in a real browser:
//   1. Level 80 (takeaway is live), no packaging: the Pre-Service Check lists each takeaway
//      dish's own container and bag ("· takeaway", blocking — START waits) and its extras
//      (cutlery kit …, warnings).
//   2. Restock each blocking takeaway row → the Market line → Buy → back: the rows turn ✓,
//      one ledger entry per purchase.
//   3. Level 40 closing (fridge stocked, no tissues or deli wrap): Closing Time lists the wrap
//      chore and tonight's tissues and wrap as short (⚠); Close for the night still closes.
//   4. 320×568: the closing sheet fits, no sideways scroll.
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

const CONTAINERS = [
  "thali-containers",
  "microwave-containers",
  "burger-boxes",
  "foil-containers",
  "kraft-boxes",
  "food-wrap",
];
const BAGS = ["paper-bags", "carry-bags"];
const saveAt = (n, business = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, ...business },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
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
const rows = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="pre-service-check"] [data-psc-supply]')]
      .filter((r) => !r.hasAttribute("data-psc-guest"))
      .map((r) => ({
        id: r.getAttribute("data-psc-supply"),
        status: r.getAttribute("data-psc-status"),
        text: r.innerText.replace(/\s+/g, " "),
      })),
  );
async function buyFromCheck(id) {
  await page.evaluate(
    (x) => document.querySelector(`[data-psc-supply="${x}"]:not([data-psc-guest]) button`)?.click(),
    id,
  );
  await sleep(900);
  await page.evaluate((x) => {
    const card = document.querySelector(`[data-supply="${x}"]`);
    [...(card?.querySelectorAll("button") ?? [])]
      .find((b) => /^Buy ·/.test(b.textContent.trim()))
      ?.click();
  }, id);
  await sleep(600);
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(900);
}

// ---------- 1. Level 80: takeaway rows by dish ----------
await boot(page, saveAt(80));
await openToday();
const r1 = await rows();
await shot(page, "takeaway-l80-check");
const takeaway = r1.filter((r) => /takeaway/.test(r.text));
const boxes = takeaway.filter((r) => CONTAINERS.includes(r.id) || BAGS.includes(r.id));
check(
  "1 Level 80: each takeaway dish's container and bag block (· takeaway); the extras only warn",
  boxes.some((r) => CONTAINERS.includes(r.id)) &&
    boxes.some((r) => BAGS.includes(r.id)) &&
    boxes.every((r) => r.status === "missing") &&
    takeaway.some((r) => r.id === "cutlery-packs" && r.status === "warning"),
  takeaway.map((r) => [r.id, r.status]),
);

// ---------- 2. Restock them ----------
const before = await readSave(page);
for (const r of boxes) await buyFromCheck(r.id);
const r2 = await rows();
const after = await readSave(page);
const entries = after.economyLedger.slice(before.economyLedger.length);
check(
  "2 Restock → Market line → Buy: every takeaway container and bag row turns ✓; one ledger entry each",
  boxes.every((b) => r2.find((r) => r.id === b.id)?.status === "ok") &&
    entries.length === boxes.length &&
    entries.every((e) => e.category === "supply-packaging-purchase"),
  { rows: r2.filter((r) => boxes.some((b) => b.id === r.id)), entries: entries.length },
);

// ---------- 3. Closing Time: tissues and wrap ----------
const closingSave = (n) => ({
  ...saveAt(n, {
    inventory: {
      tomato: { ingredientId: "tomato", quantity: 1, unitCost: 100, purchaseDay: 1 },
      onion: { ingredientId: "onion", quantity: 0.5, unitCost: 100, purchaseDay: 1 },
    },
    restaurantDay: {
      day: 20,
      opened: true,
      servicesDone: 2,
      servicesPlanned: 2,
      closingDue: true,
      openingCredits: 495000,
      openingLevel: n - 2,
    },
  }),
});
await boot(page, closingSave(40));
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(900);
const c3 = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="closing-time"]');
  if (!el) return null;
  return {
    chores: [...el.querySelectorAll("[data-chore]")].map((c) => c.getAttribute("data-chore")),
    supplies: [...el.querySelectorAll("[data-closing-supply]")].map((c) => [
      c.getAttribute("data-closing-supply"),
      c.innerText.replace(/\s+/g, " "),
    ]),
  };
});
await shot(page, "takeaway-closing");
await clickButton(page, /^Close for the night/);
await sleep(900);
const after3 = await readSave(page);
check(
  "3 Closing Time: the wrap chore; tissues and deli wrap short (⚠); closing still closes the day",
  !!c3 &&
    c3.chores.includes("wrap") &&
    c3.supplies.map(([id]) => id).join() === "tissues,food-wrap" &&
    c3.supplies.every(([, t]) => /⚠/.test(t)) &&
    after3.business.restaurantDay?.day === 21 &&
    after3.business.restaurantDay?.closingDue === false,
  { c3, day: after3.business.restaurantDay },
);

// ---------- 4. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, closingSave(40));
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(900);
const fit = await page.evaluate(() => ({
  open: !!document.querySelector('[data-testid="closing-supplies"]'),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
await shot(page, "takeaway-closing-320");
check(
  "4 at 320×568 the closing supplies fit, no sideways scroll",
  fit.open && fit.overflow <= 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `TAKEAWAY E2E: ${failed.length} FAILURE(S)` : "TAKEAWAY E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
