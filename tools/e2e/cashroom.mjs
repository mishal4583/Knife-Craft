// Developer 2026-11-01, restaurant build, in a real browser:
//   K1 after Serve the Served card sits under the dining room with the cash lying on the table; the hint says
//      to tap it (the cash never appears out of nowhere behind a button).
//   K2 one tap on the pile collects it all: wallet = opening cash + signed ledger, the pile and the
//      Collect cash button are gone, the card says "Cash collected".
//   K3 the Pre-Service Check's opening chore keeps its name readable (not one word per line) with its Buy button
//      under it, at 320 and 390 px.
//   K4 Cleanliness: the "Hire a Cleaner for today" offer is the LAST card of the page, below the areas and the
//      Staff card, with "Not in the mood to clean?" over it.
//   K5 no console errors.
import fs from "node:fs";
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  text,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

const ingredientIds = [
  ...fs
    .readFileSync(new URL("../../src/game/definitions.ts", import.meta.url), "utf8")
    .matchAll(/^\s{2}"?([a-z][a-z-]*)"?: \{\s*$/gm),
].map((m) => m[1]);
const FOOD = Object.fromEntries(
  ingredientIds.map((id) => [id, { ingredientId: id, quantity: 12, unitCost: 0, purchaseDay: 1 }]),
);
const SUPPLY_IDS = [
  ...fs
    .readFileSync(new URL("../../src/game/business/businessSupplies.ts", import.meta.url), "utf8")
    .split("export type SupplyId =")[1]
    .split(";")[0]
    .matchAll(/\|\s*"([a-z-]+)"/g),
].map((m) => m[1]);
const saveAt = (seedLevel, { supplies = SUPPLY_IDS, cleanliness } = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      supplies: {
        stock: Object.fromEntries(supplies.map((id) => [id, { units: 60, costBasis: 100 }])),
      },
      restaurantStaff: {
        specialists: ["mexican-chef", "indian-chef", "mediterranean-chef", "asian-chef"],
      },
      staff: { hiredRoles: ["prep-cook"] },
      ...(cleanliness ? { cleanliness } : {}),
    },
    credits: 50_000,
    levelProgress: {
      currentLevelId: `level-${seedLevel}`,
      highestUnlockedLevelId: `level-${seedLevel}`,
      completedLevelIds: Array.from({ length: seedLevel - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });
async function openForService() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Open for service$/);
  await sleep(900);
}
async function startService() {
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
    await sleep(800);
  }
}
const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);

try {
  // ---------- K1, K2: the cash on the table ----------
  await boot(page, saveAt(32));
  await openForService();
  await startService();
  await sleep(3500);
  await clickButton(page, /Prep Cook cuts it/);
  await sleep(3200);
  await clickButton(page, /^Serve to /);
  let room = false;
  for (let i = 0; i < 50 && !room; i++) {
    await sleep(250);
    room = await q('[data-testid="dining-cash-view"] [data-testid="table-cash-pile"]');
    // The floor beat's own pile does not count: wait for the Served card's room.
    if (room && (await q('[data-testid="service-floor"]'))) room = false;
  }
  await sleep(400);
  await shot(page, "cashroom-1");
  const hint = await page.evaluate(
    () => document.querySelector('[data-testid="dining-cash-hint"]')?.textContent ?? null,
  );
  const owed = (s) =>
    s.business.pendingCash ? s.business.pendingCash.payCents + s.business.pendingCash.tipCents : 0;
  const before = await readSave(page);
  check(
    "K1 the Served card sits under the dining room with the cash on the table and a hint to tap it",
    room && /Tap the cash/.test(hint ?? "") && owed(before) > 0,
    { room, hint, owed: owed(before) },
  );
  await page.evaluate(() =>
    document
      .querySelector('[data-testid="dining-cash-view"] [data-testid="table-cash-pile"]')
      ?.click(),
  );
  await sleep(900);
  const after = await readSave(page);
  const body = (await text(page)).replace(/\s+/g, " ");
  await shot(page, "cashroom-2");
  check(
    "K2 one tap on the pile collects it all (wallet = opening cash + ledger), the pile and the button are gone",
    owed(after) === 0 &&
      after.credits - before.credits === owed(before) &&
      after.credits - before.credits === ledgerSum(after) - ledgerSum(before) &&
      !(await q('[data-testid="dining-cash-view"] [data-testid="table-cash-pile"]')) &&
      !/Collect cash/i.test(body.replace(/Collect cash at/g, "")) &&
      /Cash collected/i.test(body),
    { collected: after.credits - before.credits, owedBefore: owed(before) },
  );

  // ---------- K3: the opening chore row ----------
  const noSanitizer = SUPPLY_IDS.filter((id) => id !== "disinfectant");
  for (const width of [320, 390]) {
    await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
    await boot(
      page,
      saveAt(32, {
        supplies: noSanitizer,
        cleanliness: {
          tasks: [{ kind: "stations", count: 1, since: 30 }],
          open: {},
          counters: { sink: 0, paper: 0 },
          cleanerAreas: ["kitchen", "dining", "restroom"],
          introSeen: true,
          cupboardAt: null,
          lastStart: null,
          cleaned: 0,
          byCleaner: 0,
          choreKeys: [],
          dayCleanerDay: null,
        },
      }),
    );
    await openForService();
    await sleep(500);
    const row = await page.evaluate(() => {
      const li = document.querySelector('[data-testid="shift-chores-opening"] [data-chore-task]');
      if (!li) return null;
      const label = li.querySelector("span.font-bold");
      const btn = li.querySelector("button");
      const l = label?.getBoundingClientRect();
      const b = btn?.getBoundingClientRect();
      return {
        labelW: Math.round(l?.width ?? 0),
        labelH: Math.round(l?.height ?? 0),
        btnBelow: !!(l && b && b.top >= l.bottom - 2),
        btnInside: !!(b && b.right <= window.innerWidth + 1 && b.left >= 0),
      };
    });
    if (width === 390) await shot(page, "cashroom-chores");
    check(
      `K3 at ${width}px the chore's name is readable (wide, at most 3 lines) and the Buy button sits under it on screen`,
      !!row && row.labelW >= 120 && row.labelH <= 70 && row.btnInside,
      row,
    );
  }
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });

  // ---------- K4: Cleanliness ----------
  await boot(
    page,
    saveAt(32, {
      cleanliness: {
        tasks: [{ kind: "floor", count: 1, since: 30 }],
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: ["kitchen", "dining", "restroom"],
        introSeen: true,
        cupboardAt: null,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
        choreKeys: [],
        dayCleanerDay: null,
      },
    }),
  );
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(700);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Cleanliness"))
      ?.click(),
  );
  await sleep(900);
  const order = await page.evaluate(() => {
    const top = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? null;
    return {
      ready: top('[data-testid="cleanliness-ready"]'),
      area: top('[data-testid="area-kitchen"]'),
      day: top('[data-testid="day-cleaner"]'),
      insideReady: !!document.querySelector(
        '[data-testid="cleanliness-ready"] [data-testid="day-cleaner"]',
      ),
      words: document.querySelector('[data-testid="day-cleaner"]')?.innerText ?? "",
    };
  });
  await shot(page, "cashroom-cleanliness");
  check(
    "K4 the day Cleaner offer is below the areas, not in the status card, and says it is optional",
    order.day !== null &&
      order.area !== null &&
      order.day > order.area &&
      !order.insideReady &&
      /Not in the mood to clean/i.test(order.words),
    order,
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("K5 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
