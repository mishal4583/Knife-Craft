// Levels 1–15 pass 3 (developer 2026-10-09), restaurant build, in a real browser:
//   1. Level 5 (Onion Prep): the order card shows the customer's own line (the recipe's
//      customerDialogue), the goal ("Clean, even cuts · best —") and the real
//      checklist (Onion — peel / halve / slice) with peel as the current step.
//   2. Playing it: the checklist moves peel → halve → slice with the scene's own step events
//      (recorded by a page observer, not a timer); finished, every step is ticked.
//   3. Level Complete shows the best stars = the engine's grade of the saved best score;
//      the wallet moved only by the ledger's entries (stars pay nothing).
//   4. The Order Board shows the same stars on the finished row.
//   5. Level 7 (peel only, not graded by the engine): a completion goal and no stars.
//   6. Level 9's row: "What's in this dish?" lists only the garlic (with the fridge's amount),
//      and opening it changes nothing in the save.
//   7. The order card fits at 320 / 360 / 390 / 430 px (no sideways scroll, inside the screen);
//      7b. a six-step dish (Bruschetta Trio) shows a compact checklist at 320 px.
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

const at = (n, extra = {}) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits: 5000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    ...extra,
  });
const hud = () =>
  page.evaluate(() => ({
    line: document.querySelector('[data-testid="hud-customer-line"]')?.textContent ?? null,
    goal: document.querySelector('[data-testid="hud-goal"]')?.textContent ?? null,
    steps: [...document.querySelectorAll('[data-testid="hud-checklist"] li')].map((li) => [
      li.textContent.replace(/^[✓▸·]\s*/, "").trim(),
      li.getAttribute("data-step-state"),
    ]),
  }));
async function nav(label) {
  await page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((x) => x.textContent.includes(l))?.click(),
    label,
  );
  await sleep(800);
}
async function prepareToday() {
  await nav("Kitchen");
  await clickButton(page, /^Prepare$/);
  await sleep(1000);
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
}
const STARS = (score) => (score >= 95 ? 3 : score >= 85 ? 2 : score >= 70 ? 1 : 0);
const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);

// ---------- 1. Level 5's card ----------
await boot(page, at(5));
const before = await readSave(page);
await prepareToday();
const h1 = await hud();
await shot(page, "goals-l5-start");
check(
  "1 Level 5: the customer's own line, the goal, and the real steps (peel now)",
  h1.line === "“Just the prepped onion, for the pot.”" &&
    /Clean, even cuts · best —/.test(h1.goal ?? "") &&
    JSON.stringify(h1.steps) ===
      JSON.stringify([
        ["Onion — peel", "now"],
        ["Onion — halve", "todo"],
        ["Onion — slice", "todo"],
      ]),
  h1,
);

// ---------- 2. The checklist follows the scene ----------
// Records every checklist state the page shows while the level is played.
await page.evaluate(() => {
  window.__steps = [];
  const snap = () => {
    const s = [...document.querySelectorAll('[data-testid="hud-checklist"] li')]
      .map((li) => li.getAttribute("data-step-state"))
      .join();
    if (s && window.__steps[window.__steps.length - 1] !== s) window.__steps.push(s);
  };
  snap();
  new MutationObserver(snap).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-step-state"],
  });
});
const played = await playToReport(page, { maxMs: 150000 });
const seen = await page.evaluate(() => window.__steps);
check(
  "2 the checklist moves with the scene's own steps: peel → halve → slice → all ticked",
  played.ok &&
    JSON.stringify(seen) ===
      JSON.stringify(["now,todo,todo", "done,now,todo", "done,done,now", "done,done,done"]),
  seen,
);

// ---------- 3. Level Complete ----------
await clickButton(page, /^Continue$/);
await sleep(900);
if (/ORDER READY/i.test(await page.evaluate(() => document.body.innerText))) {
  await clickButton(page, /^Serve to /);
  await sleep(900);
}
await clickButton(page, /^Finish Level$/);
await sleep(1200);
const notes = await page.evaluate(
  () => document.querySelector('[data-testid="banner-notes"]')?.innerText ?? "",
);
const after = await readSave(page);
const best = after.recipeProgress["camp-onion-prep-chain"]?.best;
const stars = STARS(best);
const ledger = after.economyLedger
  .slice(before.economyLedger.length)
  .reduce((t, e) => t + e.amount, 0);
check(
  "3 Level Complete shows the best stars = the engine's grade of the saved best; wallet = ledger",
  typeof best === "number" &&
    notes.includes(`Best prep: ${starText(stars)}`) &&
    after.credits - before.credits === ledger &&
    !after.economyLedger.some((e) => /star/i.test(e.category)),
  { best, stars, notes, ledger },
);

// ---------- 4. Order Board ----------
await sleep(6500);
await nav("Kitchen");
await clickButton(page, /^See all orders/);
await sleep(900);
const row5 = await page.evaluate(
  () =>
    document
      .querySelector('[data-level-row="level-5"] [data-level-stars]')
      ?.getAttribute("data-level-stars") ?? null,
);
check("4 the Order Board shows the same stars on Level 5", row5 === String(stars), {
  row5,
  stars,
});

// ---------- 5. Level 7: not graded ----------
await boot(page, at(7));
await prepareToday();
const h7 = await hud();
check(
  "5 Level 7 (peel only): a completion goal and no stars",
  /Finish the step cleanly/.test(h7.goal ?? "") &&
    !/best/.test(h7.goal ?? "") &&
    h7.steps.length === 0,
  h7,
);

// ---------- 6. Level 9 ingredient list ----------
await boot(
  page,
  at(9, {
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: { garlic: { ingredientId: "garlic", quantity: 0.1, unitCost: 0, purchaseDay: 1 } },
    },
  }),
);
const s9 = await readSave(page);
await nav("Kitchen");
await clickButton(page, /^See all orders/);
await sleep(900);
await page.evaluate(() =>
  document
    .querySelector('[data-level-row="level-9"] [data-testid="dish-ingredients"] button')
    ?.click(),
);
await sleep(500);
const list = await page.evaluate(() => ({
  ids: [...document.querySelectorAll("[data-dish-ingredient]")].map((li) =>
    li.getAttribute("data-dish-ingredient"),
  ),
  text: document.querySelector('[data-testid="dish-ingredients-list"]')?.innerText ?? "",
}));
const s9after = await readSave(page);
await shot(page, "goals-l9-ingredients");
check(
  "6 Level 9: only the dish's garlic (with the fridge's amount); opening it changes nothing",
  list.ids.join() === "garlic" &&
    /Smashed Garlic Prep/.test(list.text) &&
    /fridge: 0\.1 lb/.test(list.text) &&
    JSON.stringify(s9after.business.inventory) === JSON.stringify(s9.business.inventory) &&
    s9after.credits === s9.credits &&
    s9after.economyLedger.length === s9.economyLedger.length,
  list,
);

// ---------- 7. Widths ----------
const fits = [];
for (const w of [320, 360, 390, 430]) {
  await page.setViewport({ width: w, height: w === 320 ? 568 : 844, deviceScaleFactor: 1 });
  await boot(page, at(5));
  await prepareToday();
  fits.push(
    await page.evaluate((width) => {
      const card = document.querySelector('[data-testid="hud-goal"]')?.closest(".paper");
      const r = card?.getBoundingClientRect();
      return {
        width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        inside: !!r && r.left >= 0 && r.right <= width,
        bottom: r ? Math.round(r.bottom) : null,
        height: window.innerHeight,
      };
    }, w),
  );
  if (w === 320) await shot(page, "goals-l5-320");
}
check(
  "7 the order card fits at 320–430 px: no sideways scroll, inside the screen, in the top half",
  fits.every((f) => f.overflow <= 0 && f.inside && f.bottom !== null && f.bottom < f.height / 2),
  fits,
);

// ---------- 7b. A six-step dish stays compact at 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(
  page,
  at(12, {
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
      tickets: { "level-12": ["camp-bruschetta-trio"] },
    },
  }),
);
await nav("Kitchen");
await clickButton(page, /^Prepare$/);
await sleep(1200);
await clickButton(page, /^(START SERVICE|OPEN THE RESTAURANT)$/);
await sleep(2500);
const trio = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="hud-goal"]')?.closest(".paper");
  return {
    items: [...document.querySelectorAll('[data-testid="hud-checklist"] li')].map((li) =>
      li.textContent.trim(),
    ),
    bottom: card ? Math.round(card.getBoundingClientRect().bottom) : null,
  };
});
await shot(page, "goals-l12-320");
check(
  "7b Bruschetta Trio (6 steps) at 320 px: the current and next step and how many are left, card in the top third",
  trio.items.join("|") === "▸ Bread — slice|· Tomato — dice|+4 more" &&
    trio.bottom !== null &&
    trio.bottom < 568 / 3 + 10,
  trio,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("8 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `LEVEL GOALS E2E: ${failed.length} FAILURE(S)` : "LEVEL GOALS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
