// Covering a short service (developer 2026-10-10: "don't use Grandma lending — use watch ad; don't
// miss any monetization opportunity"; with no ad, a small loan), restaurant build, in a real browser:
//   1. Level 30 with $0 and rewarded ads supported (stubbed platform): the check offers
//      🎬 Watch an ad, no supplier credit yet and no Grandma's pantry. A declined ad changes
//      nothing and then also offers 💳 Supplier credit.
//   2. A finished ad brings exactly what's missing free: every row ✓, no money, no ledger entry,
//      nothing owed, START open.
//   3. No ads (the mock platform): supplier credit at once; taking it moves no money and owes the
//      goods' price. Playing the level through, Level Complete shows "💳 Supplier credit repaid";
//      the save has one supplier-credit-repayment entry, owes less, and the wallet stayed ≥ $0.
//   4. 320×568: the cover buttons fit, no sideways scroll, buttons ≥ 48 px.
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

const saveAt = (n, credits) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const flat = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    if (!el) return null;
    const start = [...el.querySelectorAll("button")].find((b) =>
      /^(OPEN THE RESTAURANT|START SERVICE|Restock to start|Hire)/.test(b.textContent.trim()),
    );
    return {
      rows: [...el.querySelectorAll("[data-psc-ingredient]")].map((r) =>
        r.getAttribute("data-psc-status"),
      ),
      text: el.innerText.replace(/\s+/g, " "),
      startDisabled: start ? start.disabled : null,
    };
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
// The Bridge's advertisement object keeps the first function assigned to it, so the fake ad
// is installed once and its outcome switched via a variable (pattern from rushrestock.mjs).
async function stubRewarded(outcome) {
  await page.evaluate((outcome) => {
    window.__coverAdOutcome = outcome;
    const adv = window.bridge.advertisement;
    if (adv.__coverStubbed) return;
    adv.__coverStubbed = true;
    let handler = null;
    Object.defineProperty(adv, "isRewardedSupported", { get: () => true, configurable: true });
    adv.on = (_event, cb) => (handler = cb);
    adv.off = () => (handler = null);
    adv.showRewarded = (placement) => {
      window.__coverPlacements = [...(window.__coverPlacements ?? []), placement];
      const seq =
        window.__coverAdOutcome === "rewarded"
          ? ["opened", "rewarded", "closed"]
          : ["opened", "closed"];
      seq.forEach((s, i) => setTimeout(() => handler && handler(s), 80 * (i + 1)));
    };
  }, outcome);
}
async function playLevel() {
  for (let order = 0; order < 8; order++) {
    await page.waitForFunction(
      () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
      { timeout: 30000 },
    );
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(900);
    if (/ORDER READY/i.test(await flat())) {
      await clickButton(page, /^Serve to /);
      await sleep(900);
    }
    if (await clickButton(page, /^Finish Level$/)) return true;
    if (!(await clickButton(page, /^Next (Customer|Order)/))) return false;
    await sleep(900);
  }
  return false;
}

// ---------- 1. Ads supported: the ad first; a declined ad → supplier credit too ----------
await boot(page, saveAt(30, 0));
await stubRewarded("closed");
await openToday();
const s1 = await sheet();
const before1 = await readSave(page);
await clickButton(page, /Watch an ad/);
await sleep(1500);
const s1b = await sheet();
const after1 = await readSave(page);
check(
  "1 ads supported: 🎬 Watch an ad (no credit yet, no Grandma); a declined ad changes nothing, then supplier credit is offered too",
  !!s1 &&
    /Watch an ad/.test(s1.text) &&
    !/Supplier credit/.test(s1.text) &&
    !/Grandma's pantry|Emergency Service/.test(s1.text) &&
    s1.startDisabled === true &&
    JSON.stringify(after1) === JSON.stringify(before1) &&
    !!s1b &&
    /Supplier credit/.test(s1b.text) &&
    /didn't finish/.test(s1b.text),
  { s1: s1?.text.slice(0, 160), s1b: s1b?.text.slice(-260) },
);

// ---------- 2. A finished ad: exactly what's missing, free ----------
await stubRewarded("rewarded");
await clickButton(page, /Watch an ad/);
await sleep(1500);
const s2 = await sheet();
const after2 = await readSave(page);
const placements = await page.evaluate(() => window.__coverPlacements ?? []);
check(
  "2 a finished ad brings the missing ingredients free: every row ✓, no money, no ledger, nothing owed, START open",
  !!s2 &&
    s2.rows.length > 0 &&
    s2.rows.every((r) => r === "ok") &&
    s2.startDisabled === false &&
    after2.credits === 0 &&
    after2.economyLedger.length === before1.economyLedger.length &&
    !(after2.business.supplierCredit?.owed > 0) &&
    placements.every((p) => p === "service_stock"),
  { rows: s2?.rows, start: s2?.startDisabled, placements, credit: after2.business.supplierCredit },
);

// ---------- 3. No ads: supplier credit, repaid from the level's earnings ----------
await boot(page, saveAt(30, 0));
await openToday();
const s3 = await sheet();
await clickButton(page, /Supplier credit/);
await sleep(800);
const took = await readSave(page);
const owed = took.business.supplierCredit?.owed ?? 0;
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(1500);
const played = await playLevel();
await sleep(1500);
const banner = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
await shot(page, "cover-repaid");
const done = await readSave(page);
const repayments = done.economyLedger.filter((e) => e.category === "supplier-credit-repayment");
check(
  "3 no ads: supplier credit at once (owes the price, no money moved); finishing the level repays it — Level Complete says so, one ledger entry, wallet ≥ $0",
  !!s3 &&
    /Supplier credit/.test(s3.text) &&
    !/Watch an ad/.test(s3.text) &&
    took.credits === 0 &&
    took.economyLedger.length === 0 &&
    owed > 0 &&
    played &&
    /Supplier credit repaid/.test(banner) &&
    repayments.length === 1 &&
    -repayments[0].amount === owed - (done.business.supplierCredit?.owed ?? 0) &&
    done.credits >= 0,
  { owed, played, repayments, after: done.business.supplierCredit, credits: done.credits },
);

// ---------- 4. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(31, 0));
await openToday();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="pre-service-check"]');
  const buttons = el ? [...el.querySelectorAll('[data-testid^="psc-cover-"] button')] : [];
  return {
    covers: buttons.length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons.filter((b) => b.getBoundingClientRect().height < 47.5).map((b) => b.textContent),
  };
});
await shot(page, "cover-320");
check(
  "4 at 320×568 the cover buttons fit: no sideways scroll, every button ≥ 48 px",
  fit.covers >= 1 && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `SERVICE COVER E2E: ${failed.length} FAILURE(S)` : "SERVICE COVER E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
