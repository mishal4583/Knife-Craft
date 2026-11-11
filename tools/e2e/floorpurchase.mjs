// Second Floor purchases in plain words (developer 2026-11-11: "when purchasing and upgrading the player does not understand what is being done:
// what is polishing?"), restaurant build, real browser.
//   F1 the next-goal strip says WHAT it is (icon + "Hot Food: polish step 7 of 10"), what it adds ("+$X an hour") and its price; its ⓘ explains it
//   F2 the station panel's three buttons are two lines: what + price, then what it adds ("Earns 6% more · +$X an hour")
//   F3 buying a polish step says what was bought and the real numbers ("polished (7/10) · +$X an hour · the floor earns $Y an hour")
//   F4 the ⓘ in the panel explains machine / table / polish / upgrade
//   F5 320 x 568: no sideways scroll, every purchase button >= 48 px high
//   F6 no console errors
// Screenshots: out/floorbuy-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const now = Date.now();
const save = (credits) =>
  seedSave({
    credits,
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ["server", "cashier"] },
      secondFloor: {
        stations: {
          coffee: { level: 1, lastCollectAt: now, tables: 2, polish: 6 },
          drinks: { level: 1, lastCollectAt: now, tables: 1, polish: 0 },
        },
        servers: 1,
        cleaners: 0,
        branch: 0,
      },
    },
    levelProgress: {
      currentLevelId: "level-14",
      highestUnlockedLevelId: "level-14",
      completedLevelIds: Array.from({ length: 13 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const dismiss = async (page) => {
  for (let i = 0; i < 4; i++) {
    const hit = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^(Later|No thanks|Continue|Close|Keep playing)$/.test((x.textContent ?? "").trim()),
      );
      if (b && !b.disabled) {
        b.click();
        return true;
      }
      return false;
    });
    if (!hit) break;
    await sleep(500);
  }
};
const goUp = async (page) => {
  await page.waitForSelector('[data-nav="restaurant-map"]', { timeout: 20000 });
  await sleep(1200);
  await dismiss(page);
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector('[data-testid="upstairs"]', { timeout: 15000 });
  await sleep(600);
  await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
  await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
  await sleep(900);
};
const tapZone = (page, src) =>
  page.evaluate((s) => {
    const z = [...document.querySelectorAll('[data-testid="second-floor"] .map-hotspot-zone')].find(
      (e) => new RegExp(s).test(e.getAttribute("aria-label") ?? ""),
    );
    z?.click();
    return !!z;
  }, src);
const txt = (page, sel) =>
  page.evaluate(
    (s) => document.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    sel,
  );

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, save(1_000_000));
await goUp(page);
await sleep(500);

// F1: the goal strip
const title = await txt(page, '[data-testid="floor-goal-title"]');
const gain = await txt(page, '[data-testid="floor-goal-gain"]');
await shot(page, "floorbuy-1-goal");
check(
  "F1 the goal strip names the purchase in plain words, with its gain an hour",
  !!title &&
    /(polish step \d+ of 10|add table #\d+|upgrade to Tier \d|machine)/i.test(title) &&
    !!gain &&
    /an hour|Floor Server/.test(gain),
  { title, gain },
);
await page.evaluate(() =>
  document
    .querySelector(
      '[data-testid="floor-goal"] button[aria-haspopup], [data-testid="floor-goal"] [aria-label^="What is this"]',
    )
    ?.click(),
);
await sleep(400);
const help = await txt(page, '[data-testid="floor-goal-help"]');
await shot(page, "floorbuy-1b-goal-help");
check("F1b its ⓘ says what it does", !!help && help.length > 40, help);
await page.mouse.click(10, 300);
await sleep(300);

// F2: the station panel
await tapZone(page, "^Smart Coffee");
await sleep(700);
const labels = await page.evaluate(() => ({
  table:
    document.querySelector('[data-testid="buy-table"]')?.textContent?.replace(/\s+/g, " ").trim() ??
    null,
  polish:
    document
      .querySelector('[data-testid="buy-polish"]')
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? null,
  tier:
    document.querySelector('[data-testid="buy-tier"]')?.textContent?.replace(/\s+/g, " ").trim() ??
    null,
  stats:
    document
      .querySelector('[data-testid="station-stats"]')
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? null,
}));
await shot(page, "floorbuy-2-panel");
check(
  "F2 the three buttons say what they buy and what it adds",
  /Add table #3/.test(labels.table ?? "") &&
    /an hour/.test(labels.table ?? "") &&
    /Polish step 7 of 10/.test(labels.polish ?? "") &&
    /Earns 6% more/.test(labels.polish ?? "") &&
    /Upgrade to Tier 2/.test(labels.tier ?? "") &&
    /Faster, pays more/.test(labels.tier ?? "") &&
    /Polish 6\/10 \(\+36%\)/.test(labels.stats ?? ""),
  labels,
);

// F4: the panel ⓘ
await page.evaluate(() =>
  document.querySelector('[data-testid="station-stats"] [aria-label^="What do tables"]')?.click(),
);
await sleep(400);
const phelp = await txt(page, '[data-testid="purchase-help"]');
await shot(page, "floorbuy-4-help");
check(
  "F4 the ⓘ explains machine, table, polish and upgrade",
  !!phelp &&
    /Machine:/.test(phelp) &&
    /Table:/.test(phelp) &&
    /Polish:.*6%/.test(phelp) &&
    /Upgrade:/.test(phelp),
  phelp,
);
await page.mouse.click(10, 300);
await sleep(300);

// F3: buy a polish step
const before = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="buy-polish"]')?.click());
await sleep(900);
const after = await readSave(page);
const note = await page.evaluate(
  () =>
    document
      .querySelector('[role="dialog"] [role="status"]')
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? null,
);
await shot(page, "floorbuy-3-bought");
check(
  "F3 buying polish says what was bought and the real numbers",
  after.business.secondFloor.stations.coffee.polish === 7 &&
    before.business.secondFloor.stations.coffee.polish === 6 &&
    !!note &&
    /polished \(7\/10\)/.test(note) &&
    /an hour/.test(note),
  { note, polish: after.business.secondFloor.stations.coffee.polish },
);

// F5: small phone
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(600);
const small = await page.evaluate(() => {
  const h = (s) => document.querySelector(s)?.getBoundingClientRect().height ?? 0;
  return {
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    table: Math.round(h('[data-testid="buy-table"]')),
    polish: Math.round(h('[data-testid="buy-polish"]')),
    tier: Math.round(h('[data-testid="buy-tier"]')),
  };
});
await shot(page, "floorbuy-5-small");
check(
  "F5 at 320 x 568 nothing scrolls sideways and every purchase button is at least 48 px high",
  !small.sideways && small.table >= 48 && small.polish >= 48 && small.tier >= 48,
  small,
);

check(
  "F6 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
