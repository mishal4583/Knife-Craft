// Achievement money (economy plan, developer 2026-10-16), restaurant build:
//   1. a save at 25 levels whose rewards were never paid: nothing pays by itself; Progress
//      → Achievements shows "$X waiting" and Collect buttons;
//   2. Collect on the first row offering it pays that reward once — one ledger entry — and
//      the row reads "✓ Collected"; the waiting total drops by the same amount;
//   3. a reload never pays it again, and nothing else pays by itself;
//   4. it fits at 320 / 390 (screenshots), no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const at25 = () =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS },
    levelProgress: {
      currentLevelId: "level-26",
      highestUnlockedLevelId: "level-26",
      completedLevelIds: Array.from({ length: 25 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openAchievements = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(600);
  // Progress opens from the Kitchen's rank badge (it shows the money waiting).
  await page.evaluate(() => document.querySelector('[data-testid="kitchen-rank"]')?.click());
  await sleep(800);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /Achievements/.test(b.textContent))
      ?.click(),
  );
  await page.waitForSelector('[data-testid="achievements-waiting"]', { timeout: 15000 });
  await sleep(400);
};
const waitingText = (page) =>
  page.$eval('[data-testid="achievements-waiting"]', (e) => e.textContent ?? "");
const money = (t) => Number((t.match(/\$([\d,]+\.\d\d)/)?.[1] ?? "0").replace(/,/g, ""));

const { browser, page, logs } = await launch();
await boot(page, at25());
await sleep(1500);
const s0 = await readSave(page);
await openAchievements(page);
const w0 = await waitingText(page);
const kitchenNote = await page.evaluate(() => {
  document.querySelector('[data-nav="kitchen"]')?.click();
  return new Promise((r) =>
    setTimeout(
      () =>
        r(
          document.querySelector('[data-testid="kitchen-achievements-waiting"]')?.textContent ?? "",
        ),
      700,
    ),
  );
});
await openAchievements(page);
const buttons = await page.$$eval("button", (bs) =>
  bs.map((b) => b.textContent ?? "").filter((t) => /^Collect \$/.test(t)),
);
await shot(page, "achievements-390");
check(
  "1 nothing paid by itself; the Kitchen badge and the tab show the money waiting, with Collect buttons",
  s0.economyLedger.filter((e) => e.category === "milestone-reward").length === 0 &&
    money(w0) > 0 &&
    buttons.length > 0 &&
    /to collect/.test(kitchenNote),
  { waiting: w0, buttons: buttons.length, kitchenNote },
);

// The seeded save's V2.5 migration waives the milestones it already reached (claimed, never
// paid), so collect the first row that really offers a Collect button.
const picked = await page.evaluate(() => {
  for (const row of document.querySelectorAll("[data-achievement]")) {
    const b = [...row.querySelectorAll("button")].find((x) =>
      /^Collect \$/.test(x.textContent ?? ""),
    );
    if (b) {
      const id = row.getAttribute("data-achievement");
      const text = b.textContent ?? "";
      b.click();
      return { id, text };
    }
  }
  return null;
});
await sleep(700);
const reward = picked ? Math.round(money(picked.text) * 100) : 0;
const s1 = await readSave(page);
const w1 = await waitingText(page);
const rowText = picked
  ? await page.$eval(`[data-achievement="${picked.id}"]`, (e) => e.textContent ?? "")
  : "";
const entries = s1.economyLedger.filter((e) => e.description === picked?.id);
check(
  "2 Collect pays the row's reward once — one ledger entry; the row reads Collected; the waiting total drops by it",
  !!picked &&
    reward > 0 &&
    s1.credits === s0.credits + reward &&
    entries.length === 1 &&
    entries[0].amount === reward &&
    /✓ Collected/.test(rowText) &&
    Math.round((money(w0) - money(w1)) * 100) === reward,
  { picked, gained: s1.credits - s0.credits, entries: entries.length, w0, w1 },
);

await page.reload({ waitUntil: "domcontentloaded" });
await sleep(2500);
const s2 = await readSave(page);
check(
  "3 a reload pays nothing more and nothing else pays by itself",
  s2.credits === s1.credits &&
    s2.economyLedger.filter((e) => e.category === "milestone-reward").length === 1,
  { credits: [s1.credits, s2.credits] },
);

const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await openAchievements(page);
  await shot(page, `achievements-${w}`);
  fits[w] = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
check(
  "4 fits at 320 / 390",
  Object.values(fits).every((o) => o <= 0),
  fits,
);
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `ACHIEVEMENTS E2E: ${failed.length} FAILURE(S)` : "ACHIEVEMENTS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
