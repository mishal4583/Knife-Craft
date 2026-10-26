// Early-game phase 4 (2026-10-26) — paid staff hires and everything open by Level 5,
// restaurant build, a Level 5 player:
//   S1 Business → Staff: the Prep Cook's button reads "👋 Hire · $120.00", the Mexican Chef's
//      "👋 Hire · $136.00" (no "Opens Lv"), and no card says "Free".
//   S2 hiring the Prep Cook takes exactly $120: ONE "staff-purchase" entry, the wallet moves by
//      exactly the new ledger entries, the role is hired.
//   S3 with $50 left, hiring the Server ($113) says "Not enough money — need $63.00 more." and
//      nothing changes (no role, no money, no entry).
//   S4 at 320 × 568 and 390 × 844 the Staff screen fits (no sideways scroll, Hire buttons
//      ≥ 48 px).
//   S5 the Market's Second Floor section is open at Level 5 (was Level 10), its stations for sale.
//   S6 no console errors.
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
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const saveAt5 = (credits) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, sectionsSeen: ["inventory", "shop", "business"] },
    credits,
    levelProgress: {
      currentLevelId: "level-5",
      highestUnlockedLevelId: "level-5",
      completedLevelIds: ["level-1", "level-2", "level-3", "level-4"],
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
async function openStaff() {
  await openShortcut(page, "business");
  await sleep(700);
  await clickButton(page, /Staff$/);
  await sleep(800);
}
const buttonOf = (sel) =>
  page.evaluate((s) => {
    const b = [...(document.querySelector(s)?.querySelectorAll("button") ?? [])].find((x) =>
      /Hire/.test(x.textContent),
    );
    return b ? b.textContent.replace(/\s+/g, " ").trim() : null;
  }, sel);

// ---------- S1 ----------
await boot(page, saveAt5(50_000));
await openStaff();
const prepBtn = await buttonOf('[data-staff-role="prep-cook"]');
const chefBtn = await buttonOf('[data-specialist="mexican-chef"]');
const staffText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
check(
  "S1 the Prep Cook reads 'Hire · $120.00', the Mexican Chef 'Hire · $136.00' at L5; nothing says Free",
  prepBtn === "👋 Hire · $120.00" &&
    chefBtn === "👋 Hire · $136.00" &&
    !/Opens Lv/.test(staffText) &&
    !/Free now|Free to hire|free to hire/.test(staffText),
  { prepBtn, chefBtn },
);

// ---------- S4 (before hiring) ----------
const views = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await sleep(600);
  await page.evaluate(() =>
    document.querySelector('[data-staff-role="prep-cook"]')?.scrollIntoView({ block: "center" }),
  );
  await sleep(300);
  views[w] = await page.evaluate(() => {
    const hires = [...document.querySelectorAll("button")].filter((b) =>
      /Hire ·/.test(b.textContent),
    );
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      minHire: Math.min(...hires.map((b) => b.getBoundingClientRect().height)),
      clipped: hires.some((b) => b.scrollWidth > b.clientWidth + 1),
      count: hires.length,
    };
  });
  await shot(page, `paidstaff-${w}`);
}
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(400);
check(
  "S4 at 320 and 390 px the Staff screen fits (no sideways scroll, Hire buttons ≥ 48 px, not clipped)",
  Object.values(views).every(
    (v) => v.overflow <= 0 && v.minHire >= 47.5 && !v.clipped && v.count >= 6,
  ),
  views,
);

// ---------- S2 ----------
const before = await readSave(page);
await page.evaluate(() =>
  [...document.querySelector('[data-staff-role="prep-cook"]').querySelectorAll("button")]
    .find((x) => /Hire/.test(x.textContent))
    ?.click(),
);
await sleep(900);
const after = await readSave(page);
const added = after.economyLedger.slice(before.economyLedger.length);
const fees = added.filter((e) => e.category === "staff-purchase");
check(
  "S2 the hire takes exactly $120 — one staff-purchase entry; wallet = ledger; Prep Cook hired",
  fees.length === 1 &&
    fees[0].amount === -12_000 &&
    fees[0].description === "prep-cook" &&
    after.credits - before.credits === added.reduce((n, e) => n + e.amount, 0) &&
    after.credits === before.credits - 12_000 &&
    after.business.staff.hiredRoles.includes("prep-cook"),
  { added, credits: [before.credits, after.credits] },
);

// ---------- S3 ----------
await boot(page, saveAt5(50));
await openStaff();
const poorBefore = await readSave(page);
await page.evaluate(() =>
  [...document.querySelector('[data-staff-role="server"]').querySelectorAll("button")]
    .find((x) => /Hire/.test(x.textContent))
    ?.click(),
);
await sleep(800);
const poorAfter = await readSave(page);
const msg = await page.evaluate(() =>
  /Not enough money — need \$63\.00 more\./.test(document.body.innerText),
);
check(
  "S3 with $50 the Server ($113) is refused — 'Not enough money — need $63.00 more.'; nothing changes",
  msg &&
    poorAfter.credits === poorBefore.credits &&
    poorAfter.economyLedger.length === poorBefore.economyLedger.length &&
    !poorAfter.business.staff.hiredRoles.includes("server"),
  { msg },
);

// ---------- S5 ----------
await page.evaluate(() => document.querySelector('nav button[data-nav="shop"]')?.click());
await sleep(900);
await clickButton(page, /Second Floor$/).catch(() => null);
await sleep(900);
const floor = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="market-second-floor"]');
  const t = el?.innerText.replace(/\s+/g, " ") ?? "";
  return { found: !!el, locked: /Opens at Level/.test(t), buy: (t.match(/Buy \$/g) ?? []).length };
});
check(
  "S5 the Market's Second Floor is open at L5 (no 'Opens at Level'), with stations to buy",
  floor.found && !floor.locked && floor.buy > 0,
  floor,
);

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("S6 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nPAID STAFF E2E: ${failed.length} FAILURE(S)` : "\nPAID STAFF E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
