// CLOSING A ROOM'S CLEANING, in a real browser, restaurant build (deep check 2026-11-28).
//   C1  the × pressed on a SPOTLESS room (during the 2.4 s ending, before it closes itself) keeps the clean: the job leaves the save, counted once
//   C2  the × pressed half way keeps nothing: the job is still waiting
//   C3  Done on a spotless room counts the clean once
//   E1  no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const SUPPLIES = [
  "bin-liners",
  "brooms",
  "disinfectant",
  "floor-cleaner",
  "hand-soap",
  "mop-bucket",
  "paper-towels",
  "sponges-cloths",
  "toilet-brushes",
  "toilet-paper",
];
const N = 25;
const saveWith = (tasks) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(SUPPLIES.map((id) => [id, { units: 40, costBasis: 40 }])),
        },
      },
      cleanliness: {
        tasks: tasks.map((kind) => ({ kind, count: 1, since: N - 1 })),
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: [],
        introSeen: true,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });

const click = async (sel, wait) => {
  const ok = await page.evaluate((s) => {
    const e = document.querySelector(s);
    e?.click();
    return !!e;
  }, sel);
  await sleep(wait);
  return ok;
};
/** Kitchen → Mini-games → Cleaning → the Cleanliness screen → the kitchen's "Degrease" job. */
async function openGrease() {
  await boot(page, saveWith(["grease"]));
  await sleep(900);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Later")?.click();
  });
  await sleep(400);
  await click('[data-testid="minigames-shortcut"]', 600);
  await click('[data-testid="minigames-tab-cleaning"]', 400);
  await click('[data-testid="minigame-cleaning"]', 1000);
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="area-kitchen"]');
    if (!card?.querySelector('[data-task="grease"]')) card?.querySelector("button")?.click();
  });
  await sleep(500);
  await page.evaluate(() => {
    [...(document.querySelector('[data-task="grease"]')?.querySelectorAll("button") ?? [])]
      .find((x) => !x.disabled && /Clean/.test(x.textContent))
      ?.click();
  });
  await page.waitForSelector('[data-testid="cleaning-stage"]', { timeout: 8000 }).catch(() => null);
  await sleep(700);
  return !!(await page.$('[data-testid="cleaning-dirt"]'));
}
const spotless = () =>
  page.evaluate(() => !!document.querySelector('[data-testid="cleaning-spotless"]'));
/** Rubs the room row by row until it says Spotless, or until `rows` rows are done. */
async function scrub(rows = Infinity) {
  let done = 0;
  for (let pass = 0; pass < 8; pass++) {
    const b = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="cleaning-dirt"]').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    for (let y = b.y + 12; y < b.y + b.h - 12; y += 18) {
      if (done++ >= rows) return false;
      await page.mouse.move(b.x + 8, y);
      await page.mouse.down();
      for (let x = b.x + 8; x < b.x + b.w - 8; x += 22) await page.mouse.move(x, y);
      await page.mouse.up();
      if (await spotless()) return true;
    }
  }
  return false;
}
const after = async () => {
  await sleep(3200);
  const c = (await readSave(page))?.business?.cleanliness;
  return {
    waiting: (c?.tasks ?? []).map((t) => t.kind),
    cleaned: c?.cleaned,
    open: !!(await page.$('[data-testid="cleaning-stage"]')),
  };
};
const CLOSE = '[aria-label="Close kitchen cleaning"]';

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

const opened = await openGrease();
const clean = opened && (await scrub());
const pressed = clean && (await click(CLOSE, 100));
const c1 = await after();
check(
  "C1 the × on a spotless room keeps the clean (counted once)",
  pressed && !c1.waiting.includes("grease") && c1.cleaned === 1 && !c1.open,
  { opened, clean, ...c1 },
);

const opened2 = await openGrease();
const early = opened2 ? await scrub(4) : true;
await click(CLOSE, 100);
const c2 = await after();
check(
  "C2 the × half way keeps nothing: the job is still waiting",
  opened2 && !early && c2.waiting.includes("grease") && c2.cleaned === 0 && !c2.open,
  { opened: opened2, ...c2 },
);

const opened3 = await openGrease();
const clean3 = opened3 && (await scrub());
await sleep(1200);
await page.evaluate(() =>
  document.querySelector('[data-testid="cleaning-spotless"] button')?.click(),
);
const c3 = await after();
check(
  "C3 Done on a spotless room counts the clean once",
  clean3 && !c3.waiting.includes("grease") && c3.cleaned === 1 && !c3.open,
  { opened: opened3, clean: clean3, ...c3 },
);

const errors = logs.filter(
  (l) => /pageerror|^error:/.test(l) && !/favicon|ERR_FAILED|net::/.test(l),
);
check("E1 no console errors", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nCLEANING CLOSE E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
