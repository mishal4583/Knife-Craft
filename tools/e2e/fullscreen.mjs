// Full screen on every phone (developer 2026-11-16: "optimize these screens for all type of screen size and make it full screen without leaving any space"),
// restaurant build, in a real browser:
//   F1 an upright phone (320 x 568 up to 430 x 932, including the tall 9:20 ones) gets a game frame that IS the viewport: no bars above, below or beside
//   F2 the Kitchen's cards (rank, daily gift, kitchen strip) are not squeezed by the wallet row: each is wide enough to read (>= 150 px) and clear of the shortcut column
//   F3 the bottom bar sits on the bottom edge of the screen and nothing scrolls sideways
//   F4 a tablet (768 x 1024) keeps the framed 9:16 game
//   F5 the Plating Belt (?platingBelt=18) fills a tall phone: its brown panel ends at the bottom edge
//   F6 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const save = seedSave({
  credits: 1_000_000,
  business: {
    ...MOVED_IN_BUSINESS,
    sectionsSeen: [
      "shop",
      "inventory",
      "rack",
      "business",
      "staff",
      "equipment",
      "second-floor",
      "restaurant",
      "menu",
      "progress",
    ],
  },
});
const SIZES = [
  [320, 568],
  [320, 642],
  [360, 740],
  [360, 800],
  [390, 844],
  [412, 915],
  [430, 932],
];
const settle = async () => {
  await sleep(1200);
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => /^(Later|Got it|Skip)$/.test(b.textContent.trim()))
        ?.click(),
    );
    await sleep(350);
  }
};
const frame = () =>
  page.evaluate(() => {
    const r = document.querySelector("[data-game-content]")?.parentElement?.getBoundingClientRect();
    const rank = document.querySelector('[data-testid="kitchen-rank"]')?.getBoundingClientRect();
    const gift = document.querySelector('[data-testid="kitchen-gift"]')?.getBoundingClientRect();
    const strip = document
      .querySelector('[data-testid="next-kitchen-strip"]')
      ?.getBoundingClientRect();
    const short = document
      .querySelector('[data-testid="daily-check-shortcut"]')
      ?.getBoundingClientRect();
    const nav = document
      .querySelector('[data-nav="kitchen"]')
      ?.parentElement?.getBoundingClientRect();
    const hit = (a, b) =>
      !!a &&
      !!b &&
      !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return {
      iw: innerWidth,
      ih: innerHeight,
      frame: r && [
        Math.round(r.left),
        Math.round(r.top),
        Math.round(r.width),
        Math.round(r.height),
      ],
      sideways: document.documentElement.scrollWidth > innerWidth,
      rankW: rank && Math.round(rank.width),
      giftW: gift && Math.round(gift.width),
      stripW: strip && Math.round(strip.width),
      cardsHitShortcut: hit(rank, short) || hit(gift, short) || hit(strip, short),
      navBottom: nav && Math.round(nav.bottom),
    };
  });

const rows = [];
for (const [w, h] of SIZES) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, save);
  await settle();
  rows.push({ w, h, ...(await frame()) });
}
check(
  "F1 an upright phone's game frame is the whole viewport (no bars)",
  rows.every(
    (r) =>
      r.frame && r.frame[0] === 0 && r.frame[1] === 0 && r.frame[2] === r.w && r.frame[3] === r.h,
  ),
  rows.map((r) => `${r.w}x${r.h}:${r.frame}`),
);
check(
  "F2 the Kitchen's cards are readable (>= 150 px) and clear of the shortcut column",
  rows.every(
    (r) =>
      r.rankW >= 150 &&
      r.giftW >= 150 &&
      (r.stripW === null || r.stripW >= 150) &&
      !r.cardsHitShortcut,
  ),
  rows.map(
    (r) => `${r.w}x${r.h}:${r.rankW}/${r.giftW}/${r.stripW}${r.cardsHitShortcut ? " HIT" : ""}`,
  ),
);
check(
  "F3 the bottom bar sits on the bottom edge and nothing scrolls sideways",
  rows.every((r) => r.navBottom !== null && Math.abs(r.navBottom - r.h) <= 2 && !r.sideways),
  rows.map((r) => `${r.w}x${r.h}:${r.navBottom}${r.sideways ? " SIDEWAYS" : ""}`),
);

await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
await boot(page, save);
await settle();
const tablet = await frame();
check(
  "F4 a tablet keeps the framed 9:16 game",
  !!tablet.frame &&
    Math.abs(tablet.frame[2] / tablet.frame[3] - 540 / 960) < 0.02 &&
    tablet.frame[0] > 0,
  tablet,
);

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto("about:blank");
await boot(page, save);
await page.goto((process.env.KC_URL || "http://localhost:4173/") + "?platingBelt=18", {
  waitUntil: "networkidle0",
});
await sleep(1500);
const belt = await page.evaluate(() => {
  const panels = [...document.querySelectorAll("*")].filter((e) => {
    const r = e.getBoundingClientRect();
    return (
      r.width >= innerWidth - 2 &&
      r.bottom >= innerHeight - 2 &&
      r.height > 150 &&
      r.height < innerHeight
    );
  });
  return { reachesBottom: panels.length > 0, ih: innerHeight };
});
check("F5 the Plating Belt fills a tall phone to the bottom edge", belt.reachesBottom, belt);

const bad = logs.filter(
  (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
);
check("F6 no console errors", bad.length === 0, bad.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0 ? "\nFULL SCREEN E2E: ALL PASS" : `\nFULL SCREEN E2E: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
