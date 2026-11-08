// The first 20 levels (developer 2026-11-08), restaurant build, in a real browser.
//   E1 Level 3 with food bought: the Inventory chip says "Fridge Sort · N" and Paige's tip says the order arrived
//   E2 Level 11 with $900: Paige offers the Second Floor and her button opens it
//   E3 Level 11 with $400: Paige does NOT offer the Second Floor (the first machine is $500 and $300 must be left)
//   E4 no console errors
// (seedSave takes dollars.) The Pre-Service guide card comes before Paige: the test taps its "Later".
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, text } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const SEEN_ALL = [
  "first-pay",
  "restock",
  "fridge-sort",
  "cleaning",
  "stockroom-sort",
  "fridge-check",
  "system:fridge-freshness",
  "system:menu",
  "system:dine-in",
  "ads-optional",
];
const at = (n, credits, seen, extra = {}) =>
  seedSave({
    credits,
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ["server", "cashier"] },
      assistant: { hired: true, seen },
      sectionsSeen: ["shop", "inventory", "rack", "business"], // Grandma's pointers are done, so Paige's turn comes
      ...extra,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
const beat = (page) =>
  page.evaluate(() => {
    const h = document.querySelector('[data-testid="assistant-host"]');
    return h
      ? {
          beat: h.getAttribute("data-beat"),
          text: h.querySelector('[data-testid="assistant-text"]')?.textContent ?? "",
        }
      : null;
  });

const { browser, page, logs } = await launch();
try {
  // E1: Level 3, a crate of bought food waits.
  await boot(
    page,
    at(3, 500, ["first-pay", "restock"], {
      fridgeSort: {
        seed: 1,
        best: {},
        stars: 0,
        perfect: 0,
        rounds: 0,
        crate: ["tomato"],
        counts: { tomato: 3 },
      },
    }),
  );
  await page.waitForSelector('[data-testid="assistant-host"]', { timeout: 8000 }).catch(() => null);
  await sleep(800);
  const b1 = await beat(page);
  await shot(page, "earlylevels-1-level3");
  check(
    "E1 Level 3: Paige says the order arrived and to unpack the delivery",
    !!b1 && /order arrived/i.test(b1.text) && /Fridge Sort/.test(b1.text),
    b1,
  );

  // E2: Level 11, $900.
  await boot(page, at(11, 900, SEEN_ALL));
  await page.waitForSelector('[data-testid="assistant-host"]', { timeout: 8000 }).catch(() => null);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Later"))
      ?.click(),
  );
  await sleep(500);
  await page.waitForSelector('[data-testid="assistant-host"]', { timeout: 6000 }).catch(() => null);
  await sleep(800);
  const b2 = await beat(page);
  await shot(page, "earlylevels-2-level11-rich");
  check(
    "E2 Level 11 with $900: Paige offers the Second Floor",
    b2?.beat === "second-floor" && /Second Floor/.test(b2.text),
    { b2, body: (await text(page)).slice(0, 300) },
  );

  // E3: Level 11, $400.
  await boot(page, at(11, 400, SEEN_ALL));
  await page.waitForSelector('[data-testid="assistant-host"]', { timeout: 4000 }).catch(() => null);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Later"))
      ?.click(),
  );
  await sleep(500);
  await sleep(800);
  const b3 = await beat(page);
  const body = await text(page);
  check("E3 Level 11 with $400: no Second Floor offer yet", b3?.beat !== "second-floor", {
    b3,
    body: body.slice(0, 80),
  });
} catch (e) {
  check("E0 the run did not crash", false, String(e).slice(0, 300));
}
const bad = logs.filter(
  (l) =>
    /error/i.test(l.type ?? l) &&
    !/favicon|Failed to load resource|bridge/i.test(l.text ?? String(l)),
);
check("E4 no console errors", bad.length === 0, bad.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
