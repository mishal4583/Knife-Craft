// Restaurant Guide (2026-10-29), restaurant build:
//   G1 a Level-6 player with nothing done sees the "Next step" card on the Kitchen (2nd floor first).
//   G2 the card fits at 320×568, 390×844 and 768×1024, buttons ≥ 48 px, no sideways scroll.
//   G3 "Later" closes it, saves it as seen (business.guideSeen) and no second card shows this level.
//   G4 "Go upstairs" opens the 2nd floor and also marks it seen; the wallet and ledger never change.
//   G5 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, MOVED_IN_BUSINESS, sleep, readSave } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const saveAt = (n) => {
  const s = seedSave({
    business: { ...MOVED_IN_BUSINESS, sectionsSeen: ["inventory", "shop", "business"] },
    credits: 2_000, // $20: too little for a knife or board, so the 2nd-floor step is first
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      // The current campaign numbering (the harness still stamps the older one).
      campaignVersion: 3,
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  s.version = 3;
  return s;
};
const card = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="guide-card"]');
    if (!el) return null;
    const dlg = el.querySelector('[role="dialog"]').getBoundingClientRect();
    const buttons = [...el.querySelectorAll("button")].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        t: b.textContent.trim(),
        h: Math.round(r.height),
        inView: r.bottom <= innerHeight && r.top >= 0,
      };
    });
    return {
      step: el.getAttribute("data-guide-step"),
      text: el.innerText.replace(/\s+/g, " ").slice(0, 200),
      buttons,
      fits: dlg.top >= 0 && dlg.bottom <= innerHeight && dlg.left >= 0 && dlg.right <= innerWidth,
      sideways: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });

try {
  const start = saveAt(6);
  await boot(page, start);
  await sleep(2500);
  let c = await card();
  check(
    "G1 the Next-step card shows on the Kitchen, 2nd floor first",
    !!c && c.step === "floor-machine",
    c,
  );
  await page.screenshot({ path: "tools/e2e/guide-card.png" });
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
  ]) {
    await page.setViewport({ width: w, height: h });
    await sleep(500);
    const k = await card();
    check(
      `G2 ${w}x${h}: fits, buttons >= 48 px, no sideways scroll`,
      !!k && k.fits && !k.sideways && k.buttons.every((b) => b.h >= 48 && b.inView),
      k,
    );
  }
  await page.setViewport({ width: 390, height: 844 });
  await sleep(300);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Later"))
      ?.click(),
  );
  await sleep(700);
  c = await card();
  const after = await readSave(page);
  check(
    "G3 Later closes it, saves it as seen, and no other card shows this level",
    c === null && (after.business.guideSeen ?? []).some((e) => e.startsWith("floor-machine@")),
    { c, seen: after.business.guideSeen },
  );
  check(
    "G4a nothing is bought or booked by the card",
    after.credits === start.credits &&
      (after.economyLedger?.length ?? 0) === (start.economyLedger?.length ?? 0),
    { credits: after.credits },
  );

  // Fresh run to press the main button.
  await boot(page, saveAt(6));
  await sleep(2500);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Go upstairs"))
      ?.click(),
  );
  await sleep(1200);
  const where = await page.evaluate(() => document.body.innerText.slice(0, 400));
  const after2 = await readSave(page);
  check(
    "G4b Go upstairs opens the 2nd floor and marks it seen",
    /floor|Coffee|station|upstairs/i.test(where) &&
      (after2.business.guideSeen ?? []).some((e) => e.startsWith("floor-machine@")),
    { where: where.slice(0, 160) },
  );
  await page.screenshot({ path: "tools/e2e/guide-secondfloor.png" });
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("G5 no console errors", errors.length === 0, errors.slice(0, 3));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
