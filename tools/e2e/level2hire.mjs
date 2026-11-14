// A player's review, 2026-11-13, restaurant build. A NEW player who leaves the first service early.
//   D1. Level 1: hire the Server, then tap "Back to Kitchen" at once (before the guest has eaten: the Cashier was never offered).
//       Level 2's check needs the Cashier and START is blocked.
//   D2. "Hire Cashier" on the check no longer answers "Business opens in 3 services": it opens the Market's "Hire your team" card.
//   D3. Hiring there is the normal paid hire (one staff-purchase entry); "Back to the Pre-Service Check" returns; START is free.
//   D4. The service really starts (the cutting board).
//  START is never a dead button (same review):
//   R1. Level 3, an empty fridge: "Restock to start" is marked blocked but a tap opens the Market's plan.
//   R2. no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  freshPlayer,
  hirePaige,
  clickButton,
  sleep,
  readSave,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
/** A real tap on the first visible, enabled button whose text or label matches. */
const tap = async (page, re) => {
  const at = await page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll("button")]
      .filter((x) => x.getBoundingClientRect().width > 0 && !x.disabled)
      .find(
        (x) =>
          re.test((x.textContent ?? "").replace(/\s+/g, " ").trim()) ||
          re.test(x.getAttribute("aria-label") ?? ""),
      );
    const r = b?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  }, re.source);
  if (at) await page.mouse.click(at.x, at.y);
  await sleep(1200);
  return !!at;
};
const startState = (page) =>
  page.evaluate(() => {
    const b = document.querySelector('[data-testid="psc-start"]');
    return b
      ? {
          blocked: b.getAttribute("aria-disabled") === "true" ? "1" : "0",
          text: (b.textContent ?? "").trim(),
        }
      : null;
  });

const { browser, page, logs } = await launch();
await freshPlayer(page);
await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
  timeout: 30000,
});
await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
await sleep(2500);
await hirePaige(page);
await clickButton(page, /^Show me/);
await sleep(1500);
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => {
    const r = document.querySelector("[data-plan-ingredient]");
    [...(r?.querySelectorAll("button") ?? [])]
      .find((x) => /^Buy /.test(x.textContent.trim()))
      ?.click();
  });
  await sleep(800);
}
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(1200);
await clickButton(page, /^Open for service$/);
await sleep(1200);
await clickButton(page, /Start service/);
await sleep(1200);
await clickButton(page, /Start cooking/);
await sleep(1000);
await playToReport(page);
await clickButton(page, /^Continue$/);
await sleep(1000);
await clickButton(page, /^Serve to /);
await sleep(1000);
await clickButton(page, /^Hire Server/);
await sleep(900);
// The impatient tap: the guest is still eating.
await clickButton(page, /^Back to Kitchen$/);
await sleep(1500);
// Whatever cards lie on top (Level Complete, a milestone, Paige's tip) are closed as a player would.
for (let i = 0; i < 4; i++) if (!(await tap(page, /^(Close|Later)$/))) break;
if (!(await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))))
  await tap(page, /^Open for service$/);
const s1 = await readSave(page);
const hireButton = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="pre-service-check"] button')]
    .map((b) => (b.textContent ?? "").trim())
    .filter((t) => /^Hire Cashier/.test(t)),
);
check(
  "D1 left the first service early: Level 1 is done, only the Server is hired, Level 2's check asks for the Cashier",
  s1.levelProgress.completedLevelIds.includes("level-1") &&
    s1.business.staff.hiredRoles.join() === "server" &&
    hireButton.length > 0,
  { roles: s1.business.staff.hiredRoles, hireButton },
);
await shot(page, "level2hire-1-check");
await tap(page, /^Hire Cashier →$/);
const d2 = await page.evaluate(() => ({
  lock: document.querySelector('[data-testid="lock-notice"]')?.textContent ?? null,
  card: !!document.querySelector('[data-testid="team-hire"]'),
  offer: !!document.querySelector('[data-team-offer="cashier"]'),
  back: !!document.querySelector('[data-testid="psc-back"]'),
}));
check(
  "D2 'Hire Cashier' opens the Market's 'Hire your team' card (no 'Business opens in 3 services')",
  d2.lock === null && d2.card && d2.offer && d2.back,
  d2,
);
await shot(page, "level2hire-2-market");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-team-offer="cashier"] button')]
    .find((b) => /Hire/.test(b.textContent ?? ""))
    ?.click(),
);
await sleep(900);
const s3 = await readSave(page);
const hires = s3.economyLedger.filter((e) => e.category === "staff-purchase");
await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
await sleep(1200);
const st3 = await startState(page);
check(
  "D3 hired there (one more staff-purchase entry), back on the check START is free",
  s3.business.staff.hiredRoles.includes("cashier") &&
    hires.length === 2 &&
    s3.credits < s1.credits &&
    st3?.blocked === "0",
  { roles: s3.business.staff.hiredRoles, hires: hires.length, st3 },
);
await page.evaluate(() => document.querySelector('[data-testid="psc-start"]')?.click());
await sleep(1500);
await clickButton(page, /Start cooking/).catch(() => {});
const cutting = await page
  .waitForFunction(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText), {
    timeout: 20000,
  })
  .then(() => true)
  .catch(() => false);
check("D4 Level 2 starts: the cutting board is on screen", cutting);

/* ── START is never a dead button ── */
await boot(
  page,
  seedSave({
    credits: 500,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      staff: { hiredRoles: ["server", "cashier"] },
    },
    levelProgress: {
      currentLevelId: "level-3",
      highestUnlockedLevelId: "level-3",
      completedLevelIds: ["level-1", "level-2"],
      campaignVersion: 4,
    },
  }),
);
await sleep(600);
for (let i = 0; i < 3; i++) if (!(await tap(page, /^Later$/))) break;
await tap(page, /^Open for service$/);
await page
  .waitForSelector('[data-testid="pre-service-check"]', { timeout: 8000 })
  .catch(() => null);
const r0 = await startState(page);
await page.evaluate(() => document.querySelector('[data-testid="psc-start"]')?.click());
await sleep(1500);
const plan = await page.evaluate(() => ({
  plan: !!document.querySelector('[data-testid="market-plan"]'),
  rows: document.querySelectorAll("[data-plan-ingredient]").length,
}));
check(
  "R1 an empty fridge: 'Restock to start' is marked blocked, and a tap opens the Market's plan with the rows to buy",
  r0?.blocked === "1" && /Restock to start/.test(r0.text) && plan.plan && plan.rows > 0,
  { r0, plan },
);
await shot(page, "level2hire-3-restock");
const errors = logs.filter((l) => /pageerror|Uncaught|TypeError|ReferenceError/.test(l));
check("R2 no page errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0 ? "LEVEL 2 HIRE: ALL PASS" : `LEVEL 2 HIRE: ${failed.length} FAILURE(S)`,
);
process.exit(failed.length === 0 ? 0 : 1);
