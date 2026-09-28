// Real-engine tap-cadence measurement on Level 1 "First Slice" (Sliced Tomato Plate, 12 tap slices).
import { launch, seedSave, boot, clickButton, sleep, readSave } from "./harness.mjs";

/** Opens a level's Prepare/Replay button from the order board by its exact level name. */
export async function openLevel(page, levelName) {
  await clickButton(page, /^See all orders/);
  const ok = await page.evaluate((name) => {
    const heads = [...document.querySelectorAll("p")].filter((p) => p.textContent.trim() === name);
    for (const h of heads) {
      let n = h;
      for (let i = 0; i < 8 && n; i++) {
        n = n.parentElement;
        const btns = n
          ? [...n.querySelectorAll("button")].filter((b) =>
              /^(Replay|Prepare)$/.test(b.textContent.trim()),
            )
          : [];
        if (btns.length === 1) {
          btns[0].click();
          return true;
        }
      }
    }
    return false;
  }, levelName);
  await sleep(2500);
  return ok;
}

/** Installs an in-page recorder of the "Ingredient · n/m technique" step counter. */
export async function installRecorder(page) {
  await page.evaluate(() => {
    window.__cuts = [];
    let last = null;
    const read = () => {
      const m = document.body.innerText.match(/·\s*(\d+)\/(\d+)\s+([a-z-]+)/i);
      return m ? m[0] : null;
    };
    const obs = new MutationObserver(() => {
      const v = read();
      if (v && v !== last) {
        last = v;
        window.__cuts.push([performance.now(), v]);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    window.__stepText = read;
  });
}

/**
 * Taps across the ingredient every `intervalMs` (a fast, steady player) until `target` cuts landed.
 * Each tap goes to the next unused slot so a landed cut is always a new, valid position.
 */
export async function tapRun(page, { cx, cy, halfW, target, intervalMs }) {
  const t0 = await page.evaluate(() => performance.now());
  let taps = 0;
  for (let guard = 0; guard < 200; guard++) {
    const done = await page.evaluate(() => {
      const m = (window.__stepText() || "").match(/(\d+)\/(\d+)/);
      return m ? +m[1] : 0;
    });
    if (done >= target) break;
    const x = cx - halfW + ((done + 0.5) / target) * 2 * halfW;
    await page.mouse.move(x, cy);
    await page.mouse.down();
    await sleep(16);
    await page.mouse.up();
    taps++;
    await sleep(Math.max(0, intervalMs - 16));
  }
  const cuts = await page.evaluate(() => window.__cuts);
  const times = cuts
    .filter(([, v]) => /(\d+)\/(\d+)/.test(v) && +v.match(/(\d+)\//)[1] > 0)
    .map(([t]) => t);
  const intervals = times.slice(1).map((t, i) => t - times[i]);
  const avg = intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);
  return {
    taps,
    cutsLanded: times.length,
    firstCutMs: Math.round(times[0] - t0),
    totalMs: Math.round(times[times.length - 1] - t0),
    avgIntervalMs: Math.round(avg),
    intervals: intervals.map(Math.round),
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const { browser, page, logs } = await launch();
  await boot(page, seedSave());
  console.log("opened", await openLevel(page, "First Slice"));
  await installRecorder(page);
  const r = await tapRun(page, { cx: 215, cy: 452, halfW: 62, target: 12, intervalMs: 120 });
  console.log(JSON.stringify(r));
  await sleep(2000);
  await page.screenshot({ path: "p4-after-cuts.png" });
  console.log(
    (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n+/g, " | "),
  );
  await browser.close();
  console.log("logs", logs);
}
