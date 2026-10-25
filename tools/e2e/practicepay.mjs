// Early-game phase 1 (2026-10-25) — the practice level's pay preview, restaurant build:
//   P1 Level 2 (practice, pays nothing) reads "ready to prepare · $0.00" — no "about", no "+$".
//   P2 Level 3 still reads "about +$…" (the real orders + completion reward).
//   P3 at 320×568 and 390×844 the Level 2 line is on screen, no sideways scroll.
//   P4 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, MOVED_IN_BUSINESS, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const saveAt = (n) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS },
    credits: 124000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
const toKitchen = async () => {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(700);
};
const payLine = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll("p, span, div")].find(
      (x) => x.children.length === 0 && /ready to prepare ·/.test(x.textContent),
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      text: el.textContent.trim(),
      onScreen: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

await boot(page, saveAt(2));
await toKitchen();
const l2 = await payLine();
check(
  "P1 Level 2 (practice) reads $0.00 — no 'about', no '+'",
  !!l2 && /ready to prepare · \$0\.00$/.test(l2.text),
  l2,
);
const views = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await sleep(500);
  views[w] = await payLine();
  await shot(page, `practicepay-${w}`);
}
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
check(
  "P3 at 320 and 390 px the Level 2 line is on screen, no sideways scroll",
  Object.values(views).every((v) => v && v.onScreen && v.overflow <= 0),
  views,
);

await boot(page, saveAt(3));
await toKitchen();
const l3 = await payLine();
check(
  "P2 Level 3 still reads 'about +$…' (its orders + completion reward)",
  !!l3 && /ready to prepare · about \+\$[\d,]+\.\d\d$/.test(l3.text),
  l3,
);

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("P4 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nPRACTICE PAY E2E: ${failed.length} FAILURE(S)`
    : "\nPRACTICE PAY E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
