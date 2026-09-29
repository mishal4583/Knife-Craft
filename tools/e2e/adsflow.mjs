// Playgama ads + level messages in the built game (Bridge stubbed for ads, since the local mock
// platform reports ads as unsupported):
//   1. playing a campaign level sends level_started with { world, level }; the in-game Pause
//      menu sends level_paused, Resume sends level_resumed; finishing sends level_completed once;
//   2. with 3 levels already completed, finishing Level 4 shows the first interstitial at a
//      natural break (after the level, never during it), with placement "level_completed";
//   3. the next break straight after it shows no second ad (150 s cooldown).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, text, save } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const levels = (n) => Array.from({ length: n }, (_, i) => `level-${i + 1}`);

const { browser, page, logs } = await launch();
// Spy on platform messages the way pgbridge.mjs does: once initialized the
// Bridge ignores changes to its objects, so wrap sendMessage from inside
// initialize(), on every document.
await page.evaluateOnNewDocument(() => {
  window.__msgs = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get() {
      return real;
    },
    set(b) {
      real = b;
      const init = b.initialize.bind(b);
      b.initialize = (...args) =>
        init(...args).then((r) => {
          const proto = Object.getPrototypeOf(b.platform);
          const send = proto.sendMessage;
          proto.sendMessage = function (m, o, ...rest) {
            window.__msgs.push([m, o ?? null]);
            return send.call(this, m, o, ...rest);
          };
          return r;
        });
    },
  });
});

/** Records every platform message and stubs interstitials (supported, opened → closed). */
async function stubBridge() {
  await page.evaluate(() => {
    window.__msgs.length = 0;
    window.__ads = [];
    const b = window.bridge;
    const adv = b.advertisement;
    let handler = null;
    Object.defineProperty(adv, "isInterstitialSupported", { get: () => true, configurable: true });
    adv.on = (_e, cb) => (handler = cb);
    adv.off = () => (handler = null);
    adv.showInterstitial = (placement) => {
      window.__ads.push({ placement });
      ["opened", "closed"].forEach((s, i) => setTimeout(() => handler && handler(s), 60 * (i + 1)));
    };
  });
}
const msgs = () => page.evaluate(() => window.__msgs.map(([m, o]) => `${m} ${JSON.stringify(o)}`));
const ads = () => page.evaluate(() => window.__ads);

/** Plays the current campaign level to its end: every order, then Finish Level. */
async function playLevel() {
  for (let order = 0; order < 8; order++) {
    await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
      timeout: 30000,
    });
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(900);
    if (/ORDER READY/i.test(await flat(page))) {
      await clickButton(page, /^Serve to /);
      await sleep(900);
    }
    if (await clickButton(page, /^Finish Level$/)) return true;
    if (!(await clickButton(page, /^Next (Customer|Order)/))) return false;
    await sleep(900);
  }
  return false;
}

// ---------- 1 + 2: Level 4 with 3 completed ----------
await boot(
  page,
  seedSave({
    levelProgress: {
      currentLevelId: "level-4",
      highestUnlockedLevelId: "level-4",
      completedLevelIds: levels(3),
    },
  }),
);
await stubBridge();
await clickButton(page, /Prepare$/);
await sleep(1500);
let m = await msgs();
check(
  "1a entering Level 4 sends level_started {world: chapter-1, level: 4}",
  m[0] === 'level_started {"world":"chapter-1","level":"4"}',
  m,
);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-label") === "Pause")
    ?.click(),
);
await sleep(400);
await clickButton(page, /^Resume$/);
await sleep(400);
m = await msgs();
check(
  "1b Pause → level_paused, Resume → level_resumed (once each)",
  m.filter((x) => x.startsWith("level_paused")).length === 1 &&
    m.filter((x) => x.startsWith("level_resumed")).length === 1 &&
    m.indexOf(m.find((x) => x.startsWith("level_paused"))) <
      m.indexOf(m.find((x) => x.startsWith("level_resumed"))),
  m,
);
check("1c no interstitial during the level", (await ads()).length === 0);
const finished = await playLevel();
await sleep(1500);
m = await msgs();
const s = await readSave(page);
check("1d Level 4 finished", finished && s.levelProgress.completedLevelIds.includes("level-4"));
check(
  "1e level_completed sent once for Level 4",
  m.filter((x) => x === 'level_completed {"world":"chapter-1","level":"4"}').length === 1,
  m,
);
const a = await ads();
check(
  "2a the first interstitial comes after the level (4th completed), placement level_completed",
  a.length === 1 && a[0].placement === "level_completed",
  a,
);

// ---------- 3: the next break right after it: cooldown ----------
await clickButton(page, /Back to (Kitchen|Orders)|Kitchen/);
await sleep(800);
check("3a no second interstitial within 150 s", (await ads()).length === 1, await ads());

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("adsflow-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nADS FLOW E2E: ALL PASS" : `\nADS FLOW E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
