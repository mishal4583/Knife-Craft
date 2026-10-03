// All staff lives in Business, on a 375×642 phone:
//   1. the Market has no Staff tab (Knives · Cutting Boards · Campaign Supplier · Ingredients ·
//      Blacksmith · Smallwares · Tableware · Takeaway);
//   2. Business → Staff shows the waged team (6 roles) and the Kitchen helpers (3 one-time
//      hires: Prep Assistant, Quality Chef, Kitchen Assistant) with their real prices and
//      unlock levels;
//   3. hiring the Prep Assistant there writes ONE "staff-purchase" ledger entry of −$3,000.00,
//      adds it to the save's owned staff, and the wallet moves by exactly the new ledger
//      entries (the First-staff milestone may pay too);
//   4. not enough money: the card says so and nothing changes;
//   5. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot, save } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
/** A player at Level 25 (levels 1–24 done). */
const atLevel25 = (credits) =>
  seedSave({
    version: 2,
    credits,
    levelProgress: {
      currentLevelId: "level-25",
      highestUnlockedLevelId: "level-25",
      completedLevelIds: Array.from({ length: 24 }, (_, i) => `level-${i + 1}`),
    },
    business: { calendar: { businessDay: 7 } },
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });

async function openStaff() {
  await clickButton(page, /Business$/);
  await sleep(600);
  await clickButton(page, /Staff$/);
  await sleep(600);
}
const helper = (id) =>
  page.evaluate(
    (id) => document.querySelector(`[data-helper="${id}"]`)?.innerText.replace(/\s+/g, " ") ?? "",
    id,
  );

// ---------- 1. Market ----------
await boot(page, atLevel25(1_000_000));
await clickButton(page, /Market$/);
await sleep(600);
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Shop categories"] button')].map((b) =>
    b.innerText.replace(/\s+/g, " ").trim(),
  ),
);
check(
  "1 the Market has no Staff tab",
  tabs.length === 8 && !tabs.some((t) => /Staff/.test(t)),
  tabs,
);

// ---------- 2. Business → Staff ----------
await openStaff();
const counts = await page.evaluate(() => ({
  helpers: document.querySelectorAll("[data-helper]").length,
  team: /Your team/i.test(document.body.innerText),
}));
const prep = await helper("prep-assistant");
const quality = await helper("quality-chef");
const kitchen = await helper("kitchen-assistant");
check(
  "2 Business → Staff: the waged team and the 3 kitchen helpers with real prices and unlock levels",
  counts.team &&
    counts.helpers === 3 &&
    /Prep Assistant/.test(prep) &&
    /Hire · \$3,000\.00/.test(prep) &&
    /\$6,000\.00/.test(quality) &&
    /Level 45/i.test(quality) &&
    /\$4,000\.00/.test(kitchen) &&
    /Level 65/i.test(kitchen),
  { prep, quality, kitchen },
);
await page.evaluate(() =>
  document.querySelector('[data-testid="kitchen-helpers"]').scrollIntoView({ block: "center" }),
);
await shot(page, "staff-1-business");

// ---------- 3. Hire ----------
const before = await readSave(page);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-helper="prep-assistant"] button')]
    .find((b) => /^Hire/.test(b.textContent.trim()))
    ?.click(),
);
await sleep(700);
const after = await readSave(page);
const added = after.economyLedger.slice(before.economyLedger.length);
const staffEntries = added.filter((e) => e.category === "staff-purchase");
check(
  "3 hiring the Prep Assistant: one staff-purchase entry of −$3,000.00, owned in the save, wallet = ledger",
  staffEntries.length === 1 &&
    staffEntries[0].amount === -300_000 &&
    after.ownedStaffIds.includes("prep-assistant") &&
    after.credits - before.credits === added.reduce((n, e) => n + e.amount, 0) &&
    /Hired/i.test(await helper("prep-assistant")),
  { added: added.map((e) => [e.category, e.amount]), credits: [before.credits, after.credits] },
);

// ---------- 4. Not enough money ----------
await boot(page, atLevel25(100));
await openStaff();
const poorBefore = await readSave(page);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-helper="prep-assistant"] button')]
    .find((b) => /^Hire/.test(b.textContent.trim()))
    ?.click(),
);
await sleep(500);
const poorAfter = await readSave(page);
const poorText = await page.evaluate(
  () =>
    document.querySelector('[data-testid="kitchen-helpers"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
check(
  "4 not enough money: it says so and nothing changes",
  /Not enough money/.test(poorText) &&
    (poorAfter?.credits ?? 100) === (poorBefore?.credits ?? 100) &&
    (poorAfter?.economyLedger?.length ?? 0) === (poorBefore?.economyLedger?.length ?? 0) &&
    !(poorAfter?.ownedStaffIds ?? []).includes("prep-assistant"),
  poorText.slice(0, 200),
);

check(
  "5 console has no errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs,
);
save("staff-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nSTAFF E2E: ALL PASS" : `\nSTAFF E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
