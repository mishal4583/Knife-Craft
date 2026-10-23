// The Mexican Chef is introduced early (developer 2026-10-17), restaurant build:
//   1. Level 11: the check's news says Mexican cuisine is coming at L16 with its chef.
//   2. Level 16 (the first Mexican dish, Beetroot & Orange Plate): the check needs the Mexican
//      Chef (ⓘ reason) and asks to hire the chef; Hire → Staff → hire (free: no money, no ledger)
//      → back: the requirement is met.
//   2c. the Staff card names her: Chef Marisol (intro line behind ⓘ).
//   3. 320×568: the check fits (no sideways scroll); no page errors.
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
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });

const saveAt = (n, dollars) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits: dollars,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
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
    let n = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
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
const pscStaff = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-psc-staff]")].map((r) => ({
      id: r.getAttribute("data-psc-staff"),
      status: r.getAttribute("data-psc-status"),
      reason: !!r.querySelector("[data-infotip]"),
    })),
  );

// ---------- 1. Level 11: coming up ----------
await boot(page, saveAt(11, 500));
await openLevel("Onion Rings");
const news11 = await page.evaluate(
  () =>
    document.querySelector('[data-testid="pre-service-check"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
check(
  "1 L11: the check announces Mexican cuisine (and its chef) coming at L16",
  /Mexican/.test(news11) && /Mexican Chef/.test(news11),
  { news: news11.slice(0, 300) },
);

// ---------- 2. Level 16: hire the chef ----------
await boot(page, saveAt(16, 500));
await openLevel("Beetroot & Orange Plate");
const staff = await pscStaff();
const hireBtn = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pre-service-check"] button')]
    .map((b) => b.textContent.trim())
    .find((t) => /^Hire .*Mexican Chef/.test(t)),
);
await shot(page, "mexican-chef-l16");
const fit = {};
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(400);
fit[320] = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
await shot(page, "mexican-chef-l16-320");
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(400);
const before = await readSave(page);
await clickButton(page, /^Hire .* → Staff/);
await sleep(900);
const chefRow = await page.evaluate(() => {
  const r = document.querySelector('[data-specialist="mexican-chef"]');
  return { text: r?.textContent ?? "", tip: !!r?.querySelector("[data-infotip]") };
});
await page.evaluate(() =>
  [...document.querySelectorAll('[data-specialist="mexican-chef"] button')]
    // "👋 Hire" since the portrait cards (developer 2026-10-23).
    .find((b) => /^(👋\s*)?Hire$/.test(b.textContent.trim()))
    ?.click(),
);
await sleep(400);
const hired = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
await sleep(900);
const after = await pscStaff();
check(
  "2a L16: the check needs the Mexican Chef, with its reason (ⓘ), and asks to hire the chef",
  staff.some((r) => r.id === "mexican-chef" && r.status === "missing" && r.reason) && !!hireBtn,
  { staff, hireBtn },
);
check(
  "2b Hire → Staff → hire (free: no money, no ledger) → back: the requirement is met",
  hired.business.restaurantStaff?.specialists?.includes("mexican-chef") &&
    hired.credits === before.credits &&
    hired.economyLedger.length === before.economyLedger.length &&
    after.some((r) => r.id === "mexican-chef" && r.status === "ok"),
  { specialists: hired.business.restaurantStaff, after },
);

check(
  "2c Staff: the specialist card shows the chef's character — Chef Marisol, her line behind ⓘ",
  /Chef Marisol/.test(chefRow.text) && chefRow.tip,
  chefRow,
);
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("3 the check fits at 320 px; no page errors", fit[320] <= 0 && errors.length === 0, {
  fit,
  errors: errors.slice(0, 3),
});
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `MEXICAN CHEF E2E: ${failed.length} FAILURE(S)` : "MEXICAN CHEF E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
