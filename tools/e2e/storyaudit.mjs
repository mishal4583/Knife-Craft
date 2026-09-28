// AUDIT ONLY — steps through the 14 intro beats at several viewports and measures what actually happens.
import { launch, sleep, shot, save } from "./harness.mjs";
const URL0 = process.env.KC_URL || "http://localhost:4173/";
const VIEWPORTS = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
];
const R = { viewports: {}, rapid: {}, perf: {} };
const { browser, page, logs } = await launch();
const cdp = await page.createCDPSession();
await cdp.send("Performance.enable");

const OVERLAY = "div.absolute.inset-0.z-50.overflow-hidden";
async function fresh(w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(URL0, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(OVERLAY, { timeout: 20000 });
}
const probe = () =>
  page.evaluate((sel) => {
    const o = document.querySelector(sel);
    if (!o) return null;
    const r = o.getBoundingClientRect();
    const kids = [...o.querySelectorAll("*")];
    const running = document
      .getAnimations()
      .filter((a) => o.contains(a.effect?.target) && a.playState === "running")
      .map((a) => a.animationName);
    const btn = o.querySelector("button");
    const b = btn?.getBoundingClientRect();
    const items = [...o.children].map((c) => {
      const q = c.getBoundingClientRect();
      return {
        tag: c.tagName,
        top: Math.round(q.top - r.top),
        bottom: Math.round(q.bottom - r.top),
        h: Math.round(q.height),
        w: Math.round(q.width),
        cls: c.className.slice(0, 40),
      };
    });
    const minFont = Math.min(
      ...kids
        .filter(
          (k) =>
            k.childNodes.length &&
            [...k.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
        )
        .map((k) => parseFloat(getComputedStyle(k).fontSize)),
    );
    const canvasUnder = !!document.querySelector("canvas");
    return {
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      tint: o.className.match(/bg-\[linear-gradient\([^\]]*\]/)?.[0]?.slice(0, 60),
      text: o.innerText.replace(/\s+/g, " ").slice(0, 160),
      overflow: o.scrollHeight > o.clientHeight + 1 ? o.scrollHeight - o.clientHeight : 0,
      firstTop: items[0]?.top,
      lastBottom: items[items.length - 1]?.bottom,
      items,
      running,
      minFont,
      button: b
        ? {
            w: Math.round(b.width),
            h: Math.round(b.height),
            text: btn.innerText,
            bottomGap: Math.round(r.bottom - b.bottom),
          }
        : null,
      nodes: kids.length,
      svgNodes: o.querySelectorAll("svg *").length,
      canvasUnder,
    };
  }, OVERLAY);

async function advance(p) {
  if (p?.button) {
    await page.evaluate(
      (sel) => document.querySelector(sel)?.querySelector("button")?.click(),
      OVERLAY,
    );
    return;
  }
  // tap an empty corner of the overlay (like a player tapping the screen)
  await page.evaluate((sel) => {
    const o = document.querySelector(sel);
    o?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, OVERLAY);
}

for (const [w, h] of VIEWPORTS) {
  await fresh(w, h);
  const beats = [];
  for (let i = 0; i < 16; i++) {
    const exists = await page.$(OVERLAY);
    if (!exists) break;
    await sleep(80);
    const early = await probe(); // right after the beat appears
    await sleep(700);
    const p = await probe(); // settled
    if (!p) break;
    if ([390, 320, 768].includes(w)) await shot(page, `st-${w}-b${i + 1}`);
    beats.push({ beat: i + 1, animatingAt80ms: early?.running, ...p });
    await advance(p);
    await sleep(60);
  }
  R.viewports[`${w}x${h}`] = beats;
  console.log(
    `${w}x${h}: ${beats.length} beats; overflow=${beats.filter((b) => b.overflow).map((b) => b.beat)}; minFont=${Math.min(...beats.map((b) => b.minFont))}`,
  );
}

// Rapid taps: 25 taps in ~1 s from the first beat, then a double-tap on each button.
await fresh(390, 844);
for (let i = 0; i < 25; i++) {
  await page.evaluate(
    (sel) => document.querySelector(sel)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    OVERLAY,
  );
  await sleep(40);
}
R.rapid.after25taps = (await probe())?.text;
await page.evaluate((sel) => {
  const b = document.querySelector(sel)?.querySelector("button");
  b?.click();
  b?.click();
}, OVERLAY);
await sleep(100);
R.rapid.afterDoubleTapOpen = (await probe())?.text;
// Dialogue bubble tap (does it advance?)
await fresh(390, 844);
for (let i = 0; i < 25; i++) {
  await page.evaluate(
    (sel) => document.querySelector(sel)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    OVERLAY,
  );
  await sleep(40);
}
await page.evaluate(
  (sel) => document.querySelector(sel)?.querySelector("button")?.click(),
  OVERLAY,
);
await sleep(50);
for (let i = 0; i < 25; i++) {
  const p = await probe();
  if (p?.button) break;
  await page.evaluate(
    (sel) => document.querySelector(sel)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    OVERLAY,
  );
  await sleep(40);
}
await page.evaluate(
  (sel) => document.querySelector(sel)?.querySelector("button")?.click(),
  OVERLAY,
);
await sleep(120);
const before = (await probe())?.text;
await page.evaluate((sel) => {
  const d = document.querySelector(sel)?.querySelector(".card-warm");
  d?.click();
}, OVERLAY);
await sleep(120);
R.rapid.dialogueBubbleTap = { before, after: (await probe())?.text };

// Cost while the intro is up: main-thread work over 5 s on an auto beat, with the Level 1 scene mounted underneath.
await fresh(390, 844);
const m = async () =>
  Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]),
  );
const a = await m();
await sleep(5000);
const b = await m();
R.perf.intro5s = {
  taskMs: Math.round((b.TaskDuration - a.TaskDuration) * 1000),
  scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000),
  layouts: b.LayoutCount - a.LayoutCount,
  styleRecalcs: b.RecalcStyleCount - a.RecalcStyleCount,
  canvasUnder: (await probe())?.canvasUnder,
};
const rafs = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < 1000) requestAnimationFrame(f);
        else res(n);
      };
      requestAnimationFrame(f);
    }),
);
R.perf.rafPerSec = rafs;
R.logs = logs;
save("storyaudit-result.json", R);
await browser.close();
