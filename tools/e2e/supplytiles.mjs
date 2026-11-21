// Daily Maintenance → "Next service · cutlery & supplies" as picture tiles (developer 2026-11-21: "add proper assets to this and make it digitalized"):
//   1. every supply row is a tile (data-testid="supply-tile") with its painted Market picture (public/business/supplies/);
//   2. a short row is a big tile with a have / need meter and a Restock › button; a covered row is a ready chip with ✓ and no button;
//   3. Restock › opens the Market on that supply;
//   4. no sideways scroll at 375×642 and 1280×720; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  openShortcut,
  text,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const mk = () =>
  seedSave({
    credits: 5_000_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      supplies: {
        stock: {
          ...(MOVED_IN_BUSINESS.supplies?.stock ?? {}),
          "dinner-plates": { units: 4, costBasis: 400 },
          "dinner-forks": { units: 16, costBasis: 400 },
          "water-glasses": { units: 13, costBasis: 400 },
          "paper-napkins": { units: 300, costBasis: 400 },
        },
      },
    },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
const open = async () => {
  await boot(page, mk());
  await openShortcut(page, "daily-check");
  await sleep(900);
};
const tiles = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="supply-tile"]')].map((t) => ({
      id: t.getAttribute("data-supply"),
      short: t.getAttribute("data-short") === "true",
      text: t.innerText.replace(/\s+/g, " ").trim(),
      img: !!t.querySelector("img[data-supply-icon]"),
      meter: !!t.querySelector('[role="meter"]'),
      button: [...t.querySelectorAll("button")].map((b) => b.innerText.trim()).join("|"),
    })),
  );
const noSideScroll = () =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const scrollTo = async () => {
  await page.evaluate(() =>
    document.querySelector('[data-testid="supply-grid"]')?.scrollIntoView({ block: "start" }),
  );
  await sleep(400);
};

await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
await open();
const t = await tiles();
check(
  "1a the supplies are picture tiles",
  t.length >= 4,
  t.map((x) => x.id),
);
check(
  "1b every tile has its painted picture",
  t.every((x) => x.img),
  t.map((x) => [x.id, x.img]),
);
const short = t.filter((x) => x.short);
const ready = t.filter((x) => !x.short);
check(
  "2a a short row is a tile with a meter and Restock ›",
  short.length > 0 && short.every((x) => x.meter && x.button === "Restock ›"),
  short.map((x) => x.text),
);
check(
  "2b a covered row is a ready chip with ✓ and no button",
  ready.length > 0 && ready.every((x) => /✓/.test(x.text) && x.button === ""),
  ready.map((x) => x.text),
);
check("4a no sideways scroll on the phone", await noSideScroll());
await scrollTo();
await shot(page, "supplytiles-phone");
const before = short[0]?.id;
const went = await page.evaluate(() => {
  const tile = document.querySelector('[data-testid="supply-tile"][data-short="true"]');
  const b = tile && [...tile.querySelectorAll("button")].find((x) => /Restock/.test(x.innerText));
  b?.click();
  return !!b;
});
await sleep(900);
check(
  "3 Restock › opens the Market",
  went && /Market|Tableware|Culinary|Cleaning|Takeaway/i.test(await text(page)),
  before,
);

await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await open();
await scrollTo();
check("4b no sideways scroll in a wide window", await noSideScroll());
await shot(page, "supplytiles-wide");

const errors = logs.filter(
  (l) => /error/i.test(String(l)) && !/favicon|Failed to load resource/.test(String(l)),
);
check("5 no console errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nSUPPLYTILES: ALL PASS");
process.exit(failed.length ? 1 : 0);
