// Phase 2 (developer 2026-10-30, restaurant/serviceFlow.ts), restaurant build, a Level 12 service:
//   Q1 nobody waits at the door when the service opens (the level's own order is seated);
//   Q2 ~35 s later a menu guest is waiting at the door ("🚪 1 waiting", patience shown);
//   Q3 the guest's patience runs out while the player does nothing: they walk out — counted as
//      handled (levelProgress.menuGuests), no business revenue, the wallet unchanged;
//   Q5 the game paused (developer 2026-10-30: customers only wait while the player is serving):
//      45 s later the waiting guest's patience has not moved;
//   Q4 no console errors.
// Slow on purpose (real time: ~4 minutes); the clock only runs with the service on screen.
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const stocked = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 3, unitCost: 0, purchaseDay: 1 }]),
  );
const door = () =>
  page.evaluate(() => {
    const d = document.querySelector('[data-testid="door-queue"]');
    return d ? Number(d.getAttribute("data-waiting")) : 0;
  });
try {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: stocked([
        "bread",
        "tomato",
        "garlic",
        "basil",
        "mozzarella",
        "mushroom",
        "cucumber",
        "carrot",
      ]),
      restaurantStaff: { specialists: ["mexican-chef"] },
    },
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
  await boot(page, s);
  await sleep(2500);
  await clickButton(page, /^Open for service$/);
  await sleep(1500);
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          /^(🔥 Start service|START SERVICE|🚪 Open restaurant|OPEN THE RESTAURANT)$/i.test(
            x.textContent.trim(),
          ) && !x.disabled,
      );
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!clicked) break;
  }
  const before = await readSave(page);
  const levelId = before.levelProgress.currentLevelId;
  check("Q1 nobody waits at the door when the service opens", (await door()) === 0, {
    levelId,
  });
  await sleep(40_000);
  const waiting = await door();
  await shot(page, "queue-waiting");
  check("Q2 ~35 s later a menu guest waits at the door", waiting >= 1, { waiting });
  const patience = () =>
    page.evaluate(() =>
      document.querySelector('[data-testid="door-queue"]')?.getAttribute("data-patience"),
    );
  await clickButton(page, /Start cooking/);
  await sleep(1500);
  await page.evaluate(() => document.querySelector('[aria-label="Pause"]')?.click());
  await sleep(500);
  const p1 = await patience();
  await sleep(45_000);
  const p2 = await patience();
  check("Q5 paused: 45 s later the waiting guest's patience has not moved", !!p1 && p1 === p2, {
    p1,
    p2,
  });
  await clickButton(page, /^Resume$/);
  let after = before;
  for (let t = 0; t < 30; t++) {
    await sleep(8_000);
    after = await readSave(page);
    if ((after.levelProgress.menuGuests?.[levelId] ?? 0) >= 1) break;
  }
  const revenue = (x) => x.economyLedger.filter((e) => e.category === "business-revenue").length;
  check(
    "Q3 the guest walks out after their patience: counted as handled, no revenue, wallet unchanged",
    (after.levelProgress.menuGuests?.[levelId] ?? 0) >= 1 &&
      revenue(after) === revenue(before) &&
      after.credits === before.credits,
    {
      handled: after.levelProgress.menuGuests,
      revenue: [revenue(before), revenue(after)],
      credits: [before.credits, after.credits],
    },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("Q4 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
