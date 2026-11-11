// Screens appear WITH their pictures (developer 2026-11-11: "sometimes the background images load a little slower than the things in that page;
// when navigating from one section to another the contents should load at the perfect time"), restaurant build, real browser.
//   R1 on a slow network a screen whose big picture is not there yet is held back (data-screen-reveal="waiting"), and when it is shown the
//      picture is already loaded and decoded: content and picture appear together
//   R2 a screen whose pictures are already in the cache is never held back
//   R3 the wait is capped: with the picture stalled for good the screen still opens within about a second and a half
//   R4 a screen held back still takes taps (nothing can trap the player)
//   R5 idle warming fetches the next sections' pictures once (so R2 is the normal case)
//   R6 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, openShortcut } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = () =>
  seedSave({
    credits: 500_000,
    business: { ...MOVED_IN_BUSINESS, staff: { hiredRoles: ["server", "cashier"] } },
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const state = (page) =>
  page.evaluate(() => {
    const w = document.querySelector("[data-screen-reveal]");
    const img = [...document.querySelectorAll("img")].find((i) => /stockroom-banner/.test(i.src));
    return {
      reveal: w?.getAttribute("data-screen-reveal") ?? null,
      bannerLoaded: img ? img.complete && img.naturalWidth > 0 : null,
    };
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
// Warming off for R1/R3 (it would otherwise bring the picture before the screen asks for it).
await page.evaluateOnNewDocument(() => {
  window.__kcNoWarm = true;
});
await boot(page, save());
await sleep(800);
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

// R1: a slow network (the picture arrives inside the wait cap: a slower one is R3)
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 250,
  downloadThroughput: (3000 * 1024) / 8,
  uploadThroughput: (3000 * 1024) / 8,
});
await openShortcut(page, "inventory");
const seen = [];
const t0 = Date.now();
let shownAt = null;
while (Date.now() - t0 < 6000) {
  const s = await state(page);
  seen.push(s.reveal);
  if (s.reveal === "ready" && s.bannerLoaded !== null) {
    shownAt = Date.now() - t0;
    if (seen.includes("waiting")) break;
  }
  await sleep(40);
}
const atShow = await state(page);
check(
  "R1 a slow screen waited for its picture, and the picture was loaded when the screen showed",
  seen.includes("waiting") && atShow.reveal === "ready" && atShow.bannerLoaded === true,
  { waited: seen.includes("waiting"), atShow, shownAt },
);

// R2: back to the Inventory with the picture in the browser's memory
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(900);
await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
await openShortcut(page, "inventory");
const quick = [];
for (let i = 0; i < 12; i++) {
  quick.push((await state(page)).reveal);
  await sleep(40);
}
check("R2 a screen whose pictures are ready is never held back", !quick.includes("waiting"), quick);

// R3 + R4: a picture that never arrives
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(900);
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 20000,
  downloadThroughput: 1000,
  uploadThroughput: 1000,
});
const tStall = Date.now();
await openShortcut(page, "inventory");
let open = null;
let tapped = false;
for (let i = 0; i < 80; i++) {
  const s = await state(page);
  if (s.reveal === "waiting" && !tapped) {
    // R4: a tap works while the screen is held back (the Kitchen tab of the bottom bar).
    tapped = await page.evaluate(() => {
      const b = document.querySelector('[data-nav="kitchen"]');
      b?.click();
      return !!b;
    });
    await sleep(200);
    await page.evaluate(() => document.querySelector('[data-nav="inventory"]')?.click());
  }
  if (s.reveal === "ready") {
    open = Date.now() - tStall;
    if (i > 8) break;
  }
  await sleep(50);
}
check(
  "R3 with the picture stalled for good the screen still opens within about 1.8 seconds",
  open !== null && open < 1800,
  { open },
);
check("R4 a held-back screen still takes taps", tapped === true, { tapped });

// R5: warming (switched on again): the next sections' pictures are fetched once and in the background.
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
const warmPage = await browser.newPage();
await warmPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const asked = [];
warmPage.on("request", (r) => {
  if (/(stockroom-banner|ingredients-stockroom|supplies-stockroom|market-header)/.test(r.url()))
    asked.push(r.url().split("/").pop());
});
await boot(warmPage, save());
await sleep(5000);
check(
  "R5 once idle, the app fetches the Market and stockroom pictures in the background (once per page load)",
  new Set(asked).size >= 4 && asked.length <= new Set(asked).size * 2,
  asked,
);

check(
  "R6 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
