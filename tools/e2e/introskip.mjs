// Live QA for the opening intro cinematic (CinematicIntro.tsx) + SKIP, against the built game.
// Run: npx vite preview (port 4173) in the repo root, then: node tools/e2e/introskip.mjs
import { launch, sleep, shot, save, readSave, writeSave, GAME_URL as URL0 } from "./harness.mjs";

const OV = '[aria-label="Intro"]';
const SCENES = ["scene1", "scene2", "scene3A", "scene3B", "scene3C", "scene4", "scene5"];
const LINES = [
  "They placed the keys in your hand.",
  "“Keep it alive.”",
  "The kitchen had grown quiet.",
  "You spent your savings on this?",
  "Every last bit.",
  "Then we’d better make it count.",
  "I’ll handle the cooking.",
  "You handle the prep.",
  "Your first order.",
  "Let’s get to work.",
];
const R = [];
let fails = 0;
const check = (ok, name, detail = "") => {
  if (!ok) fails++;
  R.push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  console.log(R.at(-1));
};
const { browser, page, logs } = await launch();
const net = [];
page.on("request", (q) => net.push(q.url()));

// In-page recorder: every introDone false -> true write (Bridge keeps its
// storage in localStorage locally), and a timestamped log of the film —
// overlay in/out, scene changes, subtitle changes, SKIP, outro, and whether
// Level 1's HUD was already in the page when the outro began.
await page.evaluateOnNewDocument(() => {
  window.__introDoneWrites = 0;
  const done = (v) => /introDone\\*"\s*:\s*true/.test(v || "");
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (done(v) && !done(this.getItem(k))) window.__introDoneWrites++;
    return orig.call(this, k, v);
  };
  const log = (window.__cine = { start: null, end: null, events: [], maxLines: 0, stalls: [] });
  // The film's clock doesn't advance during main-thread stalls (MAX_FRAME_MS),
  // so wall time = film time + stalled time.
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => log.stalls.push([e.startTime, e.duration])),
  ).observe({ type: "longtask", buffered: true });
  let last = "";
  new MutationObserver(() => {
    const o = document.querySelector('[aria-label="Intro"]');
    const t = performance.now();
    if (o && log.start === null) log.start = t;
    if (!o) {
      if (log.start !== null && log.end === null) log.end = t;
      return;
    }
    const lines = [...o.querySelectorAll("[aria-live] .kc-cine-line p:last-child")].map(
      (p) => p.textContent,
    );
    log.maxLines = Math.max(log.maxLines, lines.length);
    const key = [
      o.getAttribute("data-intro-scene"),
      lines.join("|"),
      !!o.querySelector('[aria-label="Skip intro"]'),
      o.className.includes("kc-cine-outro"),
      o.querySelectorAll("img").length,
    ].join("§");
    if (key !== last) {
      last = key;
      const [scene, line, skip, outro, imgs] = key.split("§");
      log.events.push({
        t: t - log.start,
        scene,
        line,
        skip: skip === "true",
        outro: outro === "true",
        imgs: +imgs,
        hud: /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText),
      });
    }
  }).observe(document, { childList: true, subtree: true, attributes: true });
});

async function fresh(w = 390, h = 844) {
  await page.setViewport({ width: w, height: h });
  // Let the first load settle before clearing storage and reloading: a reload
  // on DOMContentLoaded cancels the Bridge config fetch and lazy chunks still
  // in flight, and those cancellations would show up in check 9c.
  await page.goto(URL0, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(OV, { timeout: 20000 });
}
const cine = () => page.evaluate(() => window.__cine);
const overlayGone = (timeout = 40000) =>
  page.waitForFunction((ov) => !document.querySelector(ov), { timeout, polling: 20 }, OV);
const state = async () => {
  const saved = await readSave(page).catch(() => null);
  const ui = await page.evaluate((ov) => {
    const o = document.querySelector(ov);
    return {
      overlay: !!o,
      scene: o?.getAttribute("data-intro-scene") ?? null,
      line: o?.querySelector("[aria-live] .kc-cine-line p:last-child")?.textContent ?? null,
      skip: !!o?.querySelector('[aria-label="Skip intro"]'),
      hud: /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText),
      canvas: !!document.querySelector("canvas"),
      writes: window.__introDoneWrites,
    };
  }, OV);
  return {
    ...ui,
    introDone: saved?.story?.introDone ?? null,
    completed: saved?.levelProgress?.completedLevelIds?.length ?? null,
    ledger: saved?.economyLedger?.length ?? null,
  };
};
const tap = () =>
  page.evaluate(
    (ov) => document.querySelector(ov)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    OV,
  );
const clickSkip = () =>
  page.evaluate(() => {
    const b = document.querySelector('[aria-label="Skip intro"]');
    b?.click();
    return !!b;
  });
const waitSkip = () =>
  page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
    timeout: 10000,
    polling: 20,
  });

// 1. Natural play, no input.
await fresh();
let s = await state();
check(
  s.overlay && !s.skip && s.introDone !== true,
  "1a new player: intro plays, SKIP hidden at first, introDone not set",
  `introDone=${s.introDone}`,
);
await overlayGone();
await sleep(400);
const c1 = await cine();
const total = c1.end - c1.start;
const firstImg = c1.events.find((e) => e.imgs > 0)?.t ?? 0;
check(
  total - firstImg > 20900 && total - firstImg < 22400,
  "1b film runs ≈21.4 s once Scene 1 is on screen",
  `${((total - firstImg) / 1000).toFixed(2)} s (+${firstImg.toFixed(0)} ms image load)`,
);
const sceneOrder = [...new Set(c1.events.map((e) => e.scene))];
check(
  JSON.stringify(sceneOrder) === JSON.stringify(SCENES),
  "1c scenes in order 1 → 2 → 3A → 3B → 3C → 4 → 5",
  sceneOrder.join(" "),
);
const lineOrder = c1.events.map((e) => e.line).filter((l, i, a) => l && l !== a[i - 1]);
check(
  JSON.stringify(lineOrder) === JSON.stringify(LINES),
  "1d every subtitle, in order, each once",
  lineOrder.length + " lines",
);
check(c1.maxLines <= 1, "1e never two subtitles on screen at once", `max ${c1.maxLines}`);
const skipAt = c1.events.find((e) => e.skip)?.t;
check(
  skipAt !== undefined && skipAt - firstImg >= 900 && skipAt - firstImg < 1400,
  "1f SKIP appears ≈1 s into the film",
  `${(skipAt - firstImg).toFixed(0)} ms`,
);
const outro = c1.events.find((e) => e.outro);
check(
  !!outro && outro.hud && outro.scene === "scene5" && !outro.skip,
  "1g outro starts on Scene 5 with Level 1 already running underneath (no loading screen)",
  outro ? `at ${((outro.t - firstImg) / 1000).toFixed(2)} s, HUD ${outro.hud}` : "no outro",
);
check(
  c1.events.every((e) => e.imgs > 0 || e.t < firstImg),
  "1h no empty frame after Scene 1 appears (an image layer is always up)",
);
s = await state();
check(
  !s.overlay && s.hud && s.canvas && s.introDone === true && s.writes === 1,
  "1i ends in playable Level 1 (0/12 HUD, canvas), introDone saved once",
  `writes=${s.writes}`,
);
check(
  s.completed === 0 && s.ledger === 0,
  "1j no level completed, no money moved",
  `completed=${s.completed} ledger=${s.ledger}`,
);
await shot(page, "introskip-1-after");
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
s = await state();
check(!s.overlay && s.hud, "1k reload after the intro: no intro, straight into Level 1");

// 2. SKIP.
await fresh();
await waitSkip();
await sleep(300);
const tSkip = Date.now();
await clickSkip();
await overlayGone(3000);
const skipMs = Date.now() - tSkip;
await sleep(500);
s = await state();
check(
  !s.overlay && s.hud && s.introDone === true && s.writes === 1,
  "2a SKIP closes the film straight into Level 1, introDone saved once",
  `${skipMs} ms, writes=${s.writes}`,
);
check(s.completed === 0 && s.ledger === 0, "2b skipping changes no progress or money");
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
s = await state();
check(!s.overlay, "2c reload after SKIP: no intro");

// 3. Double SKIP.
await fresh();
await waitSkip();
await page.evaluate(() => {
  const b = document.querySelector('[aria-label="Skip intro"]');
  b?.click();
  b?.click();
});
await sleep(800);
s = await state();
check(
  !s.overlay && s.writes === 1,
  "3 double-clicked SKIP: one completion, one write",
  `writes=${s.writes}`,
);

// 4. SKIP in the middle of a crossfade (Scene 3A -> 3B).
await fresh();
await page.waitForFunction(
  (ov) => document.querySelector(ov)?.getAttribute("data-intro-scene") === "scene3B",
  { timeout: 20000, polling: 10 },
  OV,
);
await clickSkip();
await sleep(600);
s = await state();
check(!s.overlay && s.writes === 1 && s.hud, "4 SKIP mid-crossfade: one completion, Level 1 up");

// 5. Taps: one step per tap; taps never end the film on their own.
await fresh();
await page.waitForFunction(
  (ov) =>
    document
      .querySelector(ov)
      ?.querySelector("[aria-live] .kc-cine-line")
      ?.textContent.includes("keys"),
  { timeout: 20000, polling: 20 },
  OV,
);
await sleep(300);
await tap();
await sleep(120);
s = await state();
check(
  s.scene === "scene1" && s.line === "“Keep it alive.”",
  "5a a tap on a subtitle moves to the next subtitle, not the next scene",
  `${s.scene} / ${s.line}`,
);
await tap(); // within MIN_TAP_MS of the new step: ignored
await sleep(60);
s = await state();
check(s.line === "“Keep it alive.”", "5b a second tap within 250 ms is ignored", `${s.line}`);
for (let i = 0; i < 20; i++) {
  await tap();
  await sleep(25);
}
s = await state();
check(s.overlay, "5c 20 rapid taps do not end the film", `${s.scene} / ${s.line}`);
let prevScene = s.scene;
let jumped = false;
for (let i = 0; i < 40; i++) {
  await sleep(300);
  const before = await state();
  if (!before.overlay) break;
  await tap();
  await sleep(40);
  const after = await state();
  if (!after.overlay) break;
  const d = SCENES.indexOf(after.scene) - SCENES.indexOf(before.scene);
  if (d > 1) jumped = true;
  prevScene = after.scene;
}
await overlayGone(5000).catch(() => {});
s = await state();
check(!jumped, "5d tapping through never skips a whole scene");
check(
  !s.overlay && s.hud && s.writes === 1,
  "5e tapping through reaches Level 1 via the normal ending, one write",
  `last scene ${prevScene}`,
);

// 6. Existing player: no intro.
await writeSave(page, {
  ...(await readSave(page)),
  story: { introDone: true, milestoneMask: 0, finaleSeen: false },
});
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
s = await state();
check(!s.overlay, "6 a save with introDone never sees the intro");

// 7. Viewports: art covers the frame, SKIP ≥48 px and inside, subtitle not clipped, no h-scroll.
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
]) {
  await fresh(w, h);
  await page.waitForFunction(
    (ov) => document.querySelector(ov)?.querySelector("[aria-live] .kc-cine-line"),
    { timeout: 20000, polling: 20 },
    OV,
  );
  await waitSkip();
  await sleep(200);
  const m = await page.evaluate((ov) => {
    const o = document.querySelector(ov).getBoundingClientRect();
    const img = document.querySelector(`${ov} img`).getBoundingClientRect();
    const sk = document.querySelector('[aria-label="Skip intro"]').getBoundingClientRect();
    const line = document.querySelector(`${ov} [aria-live] .kc-cine-line p:last-child`);
    const lr = line.getBoundingClientRect();
    const ir = document.querySelector(`${ov} img`);
    return {
      covers:
        img.left <= o.left + 1 &&
        img.top <= o.top + 1 &&
        img.right >= o.right - 1 &&
        img.bottom >= o.bottom - 1,
      ratio: ir.naturalWidth / ir.naturalHeight,
      skip48: sk.width >= 48 && sk.height >= 48,
      skipInside: sk.right <= o.right && sk.top >= o.top,
      lineInside: lr.left >= o.left && lr.right <= o.right && lr.bottom <= o.bottom,
      lineClipped: line.scrollWidth > line.clientWidth + 1,
      hScroll: document.scrollingElement.scrollWidth > innerWidth,
    };
  }, OV);
  await shot(page, `introskip-${w}x${h}`);
  check(
    m.covers && m.skip48 && m.skipInside && m.lineInside && !m.lineClipped && !m.hScroll,
    `7 ${w}x${h}: art fills the frame, SKIP ≥48 px inside, subtitle inside, no h-scroll`,
    JSON.stringify(m),
  );
}

// 8. Reduced motion: no camera moves, the film still plays and ends in Level 1.
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await fresh();
await page.waitForSelector(`${OV} img`, { timeout: 20000 });
const anim = await page.evaluate(
  (ov) => getComputedStyle(document.querySelector(`${ov} img`)).animationName,
  OV,
);
await overlayGone();
await sleep(400);
s = await state();
check(
  anim === "none" && s.hud && s.writes === 1,
  "8 reduced motion: static art, still ends in Level 1",
  `animation=${anim}`,
);
await page.emulateMediaFeatures([]);

// 9. Network and console.
const hosts = [...new Set(net.filter((u) => /^https?:/.test(u)).map((u) => new URL(u).host))];
check(
  hosts.every((h) => h === new URL(URL0).host || h === "bridge.playgama.com"),
  "9a only the game server and the Playgama Bridge CDN are contacted",
  hosts.join(", "),
);
const intro = net.filter((u) => /\/intro-[^/]+\.webp/.test(u));
check(
  new Set(intro.map((u) => u.match(/intro-[a-z0-9-]+?-/)?.[0])).size === 7,
  "9b all 7 scene images load",
  `${intro.length} requests`,
);
check(logs.length === 0, "9c no console errors", logs.join(" | "));

save("introskip-result.json", R);
await browser.close();
console.log(
  fails ? `\nINTRO CINEMATIC E2E: ${fails} FAILURE(S)` : "\nINTRO CINEMATIC E2E: ALL PASS",
);
process.exit(fails ? 1 : 0);
