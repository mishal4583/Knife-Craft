// Idle phase 5 (developer 2026-10-31), restaurant build, in a real browser:
//   I1 Business overview: the Pace card says "close your first day" before any closing, and after a closed
//      day shows Earned / Costs / Net per hour with net = earned − costs; the Second Floor line shows its
//      rate, what waits and "Full in …".
//   I2 the map's upstairs button names the money waiting on the Second Floor.
//   I3 Second Floor: the Pickup Counter pile shows the takings; the floor bar says "Full in …"; one tap on
//      the pile collects: ONE automation-income entry, wallet = ledger; a second tap pays nothing.
//   I4 console errors: none.
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  sleep,
  readSave,
  openShortcut,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const HOUR = 3_600_000;
const flat = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");

const base = (extraBusiness = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      secondFloor: {
        stations: { coffee: { level: 1, lastCollectAt: Date.now() - 3 * HOUR } },
        servers: 1,
        cleaners: 1,
      },
      ...extraBusiness,
    },
    credits: 50_000,
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
    },
  });
const calm = async () => {
  for (let i = 0; i < 4; i++) {
    const hit = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^(Later|No thanks|Continue)$/.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    });
    if (!hit) break;
    await sleep(500);
  }
};
const openOverview = async () => {
  await openShortcut(page, "business");
  await sleep(900);
};
const goMap = async () => {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await sleep(1200);
};
try {
  // ---------- I1 ----------
  await boot(page, base());
  await calm();
  await openOverview();
  const empty = await page.evaluate(() => !!document.querySelector('[data-testid="pace-empty"]'));
  await boot(
    page,
    base({
      restaurantDay: {
        day: 8,
        opened: false,
        servicesDone: 0,
        servicesPlanned: 0,
        closingDue: false,
        openingCredits: null,
        openingLevel: null,
        paceDays: [
          { gross: 400_000, costs: 100_000 },
          { gross: 600_000, costs: 200_000 },
        ],
      },
    }),
  );
  await calm();
  await openOverview();
  await shot(page, "idle-pace");
  const cell = (k) =>
    page.evaluate(
      (key) =>
        document.querySelector(`[data-pace="${key}"]`)?.textContent.replace(/[^0-9.\-−+]/g, ""),
      k,
    );
  const text = await flat();
  // Last day: 6000/2 = 3000 earned, 2000/2 = 1000 costs, net 2000. Average of two days: 5000/2 = 2500, 1500/2 = 750, 1750.
  check(
    "I1 before any closing the card says to close the first day; after two closed days it shows Earned/Costs/Net per shift hour and the floor line",
    empty &&
      /Pace · per hour/i.test(text) &&
      (await cell("Earned-last")) === "+3000.00" &&
      (await cell("Net-last")) === "+2000.00" &&
      (await cell("Earned-avg")) === "+2500.00" &&
      (await cell("Net-avg")) === "+1750.00" &&
      /Second Floor \+\$\d/.test(text) &&
      /Full in/.test(text),
    {
      last: [await cell("Earned-last"), await cell("Costs-last"), await cell("Net-last")],
      avg: [await cell("Earned-avg"), await cell("Net-avg")],
    },
  );

  // ---------- I2 ----------
  await boot(page, base());
  await calm();
  await goMap();
  const up = await page.evaluate(
    () => document.querySelector('[data-testid="upstairs"]')?.textContent.trim() ?? "",
  );
  check("I2 the upstairs button names the money waiting", /2nd floor 💰 \$\d/.test(up), { up });

  // ---------- I3 ----------
  await page.evaluate(() => document.querySelector('[data-testid="upstairs"]')?.click());
  await page.waitForSelector('[data-testid="second-floor"]', { timeout: 8000 });
  await sleep(800);
  await shot(page, "idle-floor");
  const before = await readSave(page);
  const pile = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="floor-cash-pile"]');
    return el
      ? {
          label: el.getAttribute("aria-label"),
          amount: document.querySelector('[data-testid="floor-cash-amount"]')?.textContent ?? "",
        }
      : null;
  });
  // Open the Pickup Counter panel for the bar.
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((z) => /Pickup Counter/.test(z.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(500);
  const bar = await page.evaluate(
    () =>
      document.querySelector('[data-testid="floor-fill"]')?.innerText.replace(/\s+/g, " ") ?? "",
  );
  await page.evaluate(() => document.querySelector('[data-testid="floor-cash-pile"]')?.click());
  await sleep(700);
  const after = await readSave(page);
  const entries = after.economyLedger.filter((e) => e.category === "automation-income");
  await page.evaluate(() => document.querySelector('[data-testid="floor-cash-pile"]')?.click());
  await sleep(400);
  const again = await readSave(page);
  check(
    "I3 the Pickup Counter pile shows the takings and 'Full in …'; one tap collects ONE automation-income entry (wallet = ledger); the pile is gone and a second tap pays nothing",
    !!pile &&
      /Collect \$\d/.test(pile.label ?? "") &&
      /Full in 5 h/.test(bar) &&
      entries.length === 1 &&
      after.credits - before.credits === entries[0].amount &&
      entries[0].amount > 0 &&
      again.credits === after.credits &&
      again.economyLedger.length === after.economyLedger.length,
    { pile, bar, paid: entries.map((e) => e.amount) },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("I4 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
