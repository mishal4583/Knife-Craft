// Phase 3 in the game (2026-10-21). Three servers:
//   KC_URL            the restaurant build (`npx vite preview`, default :4173) — A and B;
//   KC_DEV_URL        the restaurant dev server (`npm run dev`, default :8080) — C6 (inspection);
//   KC_CLASSIC_DEV_URL a classic dev server (`VITE_RESTAURANT_MODE=0 npx vite --port 8081`) — C, D.
// The dev servers expose `window.__kcSpecials` (kitchenChaos.ts — development builds only;
// production has none, which Z2 checks) so one order can be given a chosen chaos event or
// variant instead of playing four orders to reach the next one; the cadence itself is covered
// by scripts/phase3-qa.mts.
//   A. Fever Mode — Level 1 (a brand-new player): the tenth cut on one ingredient lights it
//      (vignette, countdown bar, 🔥 on the combo chip, "Fever!" toast); while paused it does not
//      run out (bar paused too); after resuming it ends on time (~6 s of play) with "What a
//      run!"; it lights once per order (more cuts on the step don't relight it); with Reduced
//      Motion the vignette does not breathe; the dish still reaches the Knife Report.
//   B. Endless Prep Rush — the order-board tile opens its own screen (intro, nothing moving);
//      Start runs the belt; swipes cut what passes; Pause stops the clock; the run ends at 5
//      misses with results and the session best; Replay restarts from 0; Back to Orders leaves
//      no canvas (also after five round trips, and leaving while paused doesn't leave the game
//      paused); the save is untouched; 320×568 screenshots fit.
//   C. Kitchen Chaos (classic dev, Level 12 unless noted): Giant (bigger than the same level's
//      normal ingredient, still on the board, kept on restart), Avalanche (holds the board: a
//      tap doesn't cut; a sweep slices; Skip clears it; restart doesn't bring it back; the report
//      counts it), Rush Hour (the cooking film plays at 1.5×; report line), Grandma (live chip;
//      report says whether ×8 was reached), Perfect Plating (report line quotes the report's own
//      Evenness), Inspection (restaurant dev, Level 13: a report line from the live inspection,
//      the wallet and ledger untouched by it); a Level 11 order that teaches Rings, and Level 9,
//      get no event even when one is forced.
//   D. Variants (classic dev): Golden Tomato (L12), Giant Cucumber (L46, bigger), Rainbow Carrot
//      (L14), Frosted Onion (L21; L18's dice stalls the solver on HEAD too), Heirloom Pepper (L52) — each one's skin pixels move to its
//      colour (sampled from the scene's ingredient canvas) while the order plays to the report
//      with "Made with …"; screenshots at 320×568.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  freshPlayer,
  seedSave,
  sleep,
  clickButton,
  shot,
  save,
  readSave,
  MOVED_IN_BUSINESS,
  SAVE_KEY,
} from "./harness.mjs";
import { playToReport, stepInfo, CX, CY } from "./solver.mjs";

const DEV = process.env.KC_DEV_URL || "http://localhost:8080/";
const CLASSIC = process.env.KC_CLASSIC_DEV_URL || "http://localhost:8081/";
const ONLY = process.env.ONLY || "ABCDZ"; // run a subset of sections, e.g. ONLY=CD

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const notes = [];

const levelSave = (n, extra = {}) =>
  seedSave({
    credits: 500,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    ...extra,
  });

const { browser, page, logs } = await launch();
// `window.__kcScene()` — the Preparation scene, read-only, found through React's fiber tree (as
// phase2's aim helper does). Installed on every document so `until` strings can use it.
await page.evaluateOnNewDocument(() => {
  // Every specials card as it appears (it shows for ~3 s, so a later sample could miss it).
  window.__kcCards = [];
  new MutationObserver(() => {
    const c = document.querySelector('[data-testid="specials-card"]');
    if (c && c !== window.__kcLastCard) {
      window.__kcLastCard = c;
      window.__kcCards.push({
        chaos: c.dataset.chaos,
        variant: c.dataset.variant,
        text: c.innerText.replace(/\s+/g, " "),
      });
    }
  }).observe(document, { childList: true, subtree: true });
  window.__kcScene = () => {
    const root = document.getElementById("root");
    if (!root) return null;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    const stack = [root[key]];
    const seen = new Set();
    while (stack.length) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f);
      for (let st = f.memoizedState; st && typeof st === "object"; st = st.next) {
        const cur = st.memoizedState && st.memoizedState.current;
        if (cur && cur.game && cur.game.scene && cur.game.scene.getScene)
          return cur.game.scene.getScene("Preparation") ?? null;
      }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    return null;
  };
});

/** Loads `url` with `s` in Bridge storage (harness.boot, for another server). */
async function bootAt(url, s) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // The Bridge must be initialised (the app has rendered) before its storage is touched.
  await page.waitForFunction(() => !!window.bridge && document.body.innerText.length > 20, {
    timeout: 30000,
  });
  await page.evaluate(
    async (v, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(v)]);
    },
    s,
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll("button").length > 3, {
    timeout: 30000,
  });
  await sleep(800);
}

async function stroke(x0, y0, x1, y1, steps = 18) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(12);
  }
  await page.mouse.up();
}

/**
 * Read-only look into the Preparation scene (through React's fiber tree, as phase2's aim
 * helper does): the ingredient's size, the board, this order's specials, the avalanche, the
 * clocks — and the hue of the ingredient canvas's skin pixels.
 */
const probe = () =>
  page.evaluate(() => {
    const sc = window.__kcScene();
    if (!sc) return null;
    // The skin's colours: the share of the visible, coloured pixels of the ingredient canvas in
    // each hue band (pieces are cut from this canvas, so they carry the same colours).
    const bands = {
      purple: [255, 320],
      red: [325, 15],
      orange: [15, 38],
      gold: [30, 62],
      green: [65, 170],
      blue: [190, 250],
    };
    const counts = Object.fromEntries(Object.keys(bands).map((k) => [k, 0]));
    let n = 0;
    const cv = sc.ingredientCanvas;
    if (cv) {
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] < 200) continue;
        const r = d[i] / 255,
          g = d[i + 1] / 255,
          b = d[i + 2] / 255;
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b);
        if (max - min < 0.15) continue;
        let h;
        if (max === r) h = ((g - b) / (max - min) + 6) % 6;
        else if (max === g) h = (b - r) / (max - min) + 2;
        else h = (r - g) / (max - min) + 4;
        h *= 60;
        n++;
        for (const [k, [a, z]] of Object.entries(bands))
          if (a <= z ? h >= a && h <= z : h >= a || h <= z) counts[k]++;
      }
    }
    const hues = Object.fromEntries(
      Object.entries(counts).map(([k, c]) => [k, n ? Math.round((c / n) * 100) / 100 : 0]),
    );
    const q = sc.boardQuad;
    return {
      ingredientId: sc.ingredientId,
      stepIndex: sc.stepIndex,
      ingRx: Math.round(sc.ingRx),
      ingRy: Math.round(sc.ingRy),
      boardHalfW: Math.round(Math.min(q.xt1 - q.xt0, q.xb1 - q.xb0) / 2),
      boardHalfH: Math.round((q.yb - q.yt) / 2),
      chaos: sc.chaos,
      variant: sc.variant,
      avalanche: sc.avalanche ? sc.avalanche.items.filter((i) => !i.cut).length : null,
      avalancheObjects: sc.children.list.filter((o) => /^avalanche-/.test(o.texture?.key ?? ""))
        .length,
      hues,
    };
  });

/** The first specials card this page showed (null if none). */
const card = async () => {
  // The scene announces as it starts, which can be a moment after the HUD shows.
  await page
    .waitForFunction(() => window.__kcCards.length > 0, { timeout: 6000 })
    .catch(() => null);
  return page.evaluate(() => window.__kcCards[0] ?? null);
};
const reportSpecials = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-special]")].map((p) => ({
      id: p.dataset.special,
      text: p.textContent,
    })),
  );
const reportEvenness = () =>
  page.evaluate(() => {
    const t = document.querySelector('[data-testid="knife-report-stats"]')?.innerText ?? "";
    const m = t.match(/Evenness\s*(\d+)/);
    return m ? Number(m[1]) : null;
  });

/** Opens campaign level `title`'s Prepare from the order board (levelux.mjs's way). */
async function openLevel(title) {
  await clickButton(page, /^See all orders/);
  await sleep(800);
  const ok = await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Replay)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return true;
      }
    }
    return false;
  }, title);
  await sleep(900);
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
  );
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  await sleep(500);
  return ok;
}
/** The current level's title from the Kitchen (the board's first unlocked row). */
const levelTitle = async (n) =>
  page.evaluate(async (num) => {
    const m = await import("/src/game/levels/levelDefinitions.ts");
    return m.LEVELS[num - 1].title;
  }, n);
const force = (chaos, variant) =>
  page.evaluate(
    (c, v) => {
      window.__kcSpecials.chaos(c);
      window.__kcSpecials.variant(v);
    },
    chaos,
    variant,
  );
/** Boots a classic save at Level n, forces the next order's specials, opens the level. */
async function orderAt(n, chaos, variant, url = CLASSIC) {
  await bootAt(url, levelSave(n));
  const title = await levelTitle(n);
  await force(chaos, variant);
  await openLevel(title);
  await sleep(600);
}

// ================================================================== A. Fever
if (ONLY.includes("A")) {
  await freshPlayer(page);
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
    timeout: 30000,
  });
  await sleep(1200);
  await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
  const lit = await playToReport(page, {
    maxMs: 90000,
    until: () => !!document.querySelector('[data-testid="fever-vignette"]'),
  });
  const at = await page.evaluate(() => ({
    vignette: !!document.querySelector('[data-testid="fever-vignette"]'),
    bar: !!document.querySelector('[data-testid="fever-bar"]'),
    chip: document.querySelector('[data-testid="hud-combo"]')?.innerText ?? "",
    toast: /Fever!/i.test(document.body.innerText), // the toast is uppercased by CSS
  }));
  const s0 = await stepInfo(page);
  check(
    "A1 the 10th cut on one ingredient lights Fever (vignette, bar, 🔥 chip, toast)",
    lit.stopped && at.vignette && at.bar && /🔥/.test(at.chip) && at.toast && s0.n >= 10,
    { ...at, n: s0.n, log: lit.log.slice(-2) },
  );
  await page.click('[aria-label="Pause"]');
  await sleep(7000);
  const paused = await page.evaluate(() => ({
    vignette: !!document.querySelector('[data-testid="fever-vignette"]'),
    play: document.querySelector('[data-testid="fever-bar"]')?.style.animationPlayState,
  }));
  check(
    "A2 paused for 7 s, Fever does not run out (its bar paused too)",
    paused.vignette && paused.play === "paused",
    paused,
  );
  await clickButton(page, /^Resume$/);
  await sleep(2500);
  const mid = await page.evaluate(() => !!document.querySelector('[data-testid="fever-vignette"]'));
  await page.waitForSelector('[data-testid="fever-done"]', { timeout: 9000 }).catch(() => null);
  const ended = await page.evaluate(() => ({
    vignette: !!document.querySelector('[data-testid="fever-vignette"]'),
    done: !!document.querySelector('[data-testid="fever-done"]'),
  }));
  check(
    "A3 after resuming it carries on, then ends on time with 'What a run!'",
    mid && !ended.vignette && ended.done,
    { mid, ...ended },
  );
  // More cuts on the same step: no second Fever this order.
  const more = await playToReport(page, {
    maxMs: 60000,
    until: () => !!document.querySelector('[data-testid="fever-vignette"]'),
  });
  check(
    "A4 Fever lights once per order (the rest of the dish never relights it)",
    !more.stopped,
    more.log.slice(-2),
  );
  check("A5 the dish still reaches the Knife Report", more.ok && !more.stopped);
  // Reduced Motion: the vignette doesn't breathe (fresh order: Prepare Again).
  await clickButton(page, /^Prepare Again$/);
  await sleep(1200);
  await page.evaluate(() => document.documentElement.classList.add("kc-reduced-motion"));
  const lit2 = await playToReport(page, {
    maxMs: 90000,
    until: () => !!document.querySelector('[data-testid="fever-vignette"]'),
  });
  const anim = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-testid="fever-vignette"]')).animationName,
  );
  check(
    "A6 Prepare Again can light it again; with Reduced Motion the vignette does not breathe",
    lit2.stopped && anim === "none",
    { anim },
  );
  await shot(page, "phase3-fever");
  await page.evaluate(() => document.documentElement.classList.remove("kc-reduced-motion"));
}

// ================================================================== B. Prep Rush
if (ONLY.includes("B")) {
  const hud = () =>
    page.evaluate(() => {
      const t = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
      return {
        phase:
          document.querySelector('[data-testid="prep-rush"]')?.getAttribute("data-phase") ?? null,
        score: Number((t("rush-score") ?? "").replace(/\D/g, "")),
        time: Number((t("rush-time") ?? "").replace(/\D/g, "")),
        misses: document.querySelector('[data-testid="rush-misses"]')?.getAttribute("aria-label"),
        canvases: document.querySelectorAll("canvas").length,
      };
    });
  const viewportBox = () =>
    page.evaluate(() => {
      const r = document
        .querySelector('[data-testid="prep-rush-viewport"]')
        .getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
  const openRush = async () => {
    await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
    await sleep(500);
    await clickButton(page, /^See all orders/);
    await sleep(500);
    await page.evaluate(() => document.querySelector('[data-testid="prep-rush-tile"]')?.click());
    await page.waitForSelector('[data-testid="rush-intro"]', { timeout: 15000 });
    await sleep(600);
  };
  const swipeAcross = async (fx) => {
    const b = await viewportBox();
    const x = b.x + b.w * fx;
    const y = b.y + b.h * 0.42;
    await stroke(x, y - b.h * 0.14, x, y + b.h * 0.14, 8);
  };
  const pauseRun = async () => {
    await page.evaluate(() => document.querySelector('[aria-label="Pause"]')?.click());
    await sleep(300);
  };

  await page.setViewport({ width: 430, height: 900 });
  await boot(page, levelSave(12));
  const saveBefore = JSON.stringify(await readSave(page));

  await openRush();
  check(
    "B1 the Prep Rush tile opens its screen on the intro card",
    (await hud()).phase === "intro",
    await hud(),
  );
  await sleep(1500);
  const idle = await hud();
  check(
    "B2 nothing runs before Start (score 0, full clock)",
    idle.score === 0 && idle.time === 60,
    idle,
  );

  await clickButton(page, /^Start Rush$/);
  await sleep(300);
  check("B3 Start runs the belt", (await hud()).phase === "playing", await hud());
  for (let i = 0; i < 30; i++) {
    await swipeAcross(0.45);
    await sleep(160);
  }
  const scored = (await hud()).score;
  check("B4 swiping across the belt cuts what passes (score goes up)", scored > 0, { scored });

  await pauseRun();
  const p1 = await hud();
  await sleep(2500);
  const p2 = await hud();
  const pausedShown = !!(await page.$('[data-testid="rush-paused"]'));
  check("B5 Pause shows the panel and stops the clock", pausedShown && p1.time === p2.time, {
    p1,
    p2,
  });
  await clickButton(page, /^Resume$/);
  await sleep(2200);
  check("B6 Resume carries on (the clock moves again)", (await hud()).time < p2.time, await hud());

  await page.waitForSelector('[data-testid="rush-results"]', { timeout: 60000 });
  const res = await page.evaluate(() => ({
    text: document.querySelector('[data-testid="rush-results"]').innerText.replace(/\s+/g, " "),
    score: Number(document.querySelector('[data-testid="rush-final-score"]').textContent),
  }));
  check(
    "B7 the run ends on misses with a results card (score, counts)",
    /Belt overflow!/.test(res.text) && /5 missed/.test(res.text) && res.score >= scored,
    res,
  );
  check(
    "B8 the first run with points is the session's best",
    /New best this session/.test(res.text),
    res.text,
  );

  await page.setViewport({ width: 320, height: 568 });
  await sleep(700);
  await shot(page, "phase3-rush-results-320");
  const fits = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="rush-results"]').getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      vh: innerHeight,
      left: r.left,
      right: r.right,
      vw: innerWidth,
    };
  });
  check(
    "B9 the results card fits at 320×568",
    fits.top >= 0 && fits.bottom <= fits.vh && fits.left >= 0 && fits.right <= fits.vw,
    fits,
  );

  await clickButton(page, /^Replay$/);
  await sleep(400);
  const replay = await hud();
  check(
    "B10 Replay starts again from 0 on a full clock",
    replay.phase === "playing" && replay.score === 0 && replay.time >= 59,
    replay,
  );
  await sleep(2000);
  await shot(page, "phase3-rush-playing-320");
  const hudFits = await page.evaluate(() => {
    const r = document
      .querySelector('[data-testid="rush-score"]')
      .parentElement.getBoundingClientRect();
    return { right: r.right, vw: innerWidth };
  });
  check("B11 the run's HUD fits at 320 px", hudFits.right <= hudFits.vw, hudFits);
  await page.setViewport({ width: 430, height: 900 });
  await sleep(400);

  await pauseRun();
  await clickButton(page, /^Back to Orders$/);
  await sleep(800);
  const left = await hud();
  check(
    "B12 Back to Orders leaves the screen with no canvas behind",
    left.phase === null && left.canvases === 0,
    left,
  );
  await openRush();
  await clickButton(page, /^Start Rush$/);
  await sleep(2300);
  check(
    "B13 after leaving while paused, the next run's clock moves",
    (await hud()).time <= 58,
    await hud(),
  );
  await pauseRun();
  await clickButton(page, /^Back to Orders$/);
  await sleep(600);
  for (let i = 0; i < 4; i++) {
    await openRush();
    await clickButton(page, /^Back to Orders$/);
    await sleep(500);
  }
  const after = await hud();
  check(
    "B14 five open/leave round trips leave no canvas (no WebGL build-up)",
    after.canvases === 0,
    after,
  );
  const saveAfter = JSON.stringify(await readSave(page));
  check(
    "B15 Prep Rush leaves the save exactly as it was (no money, no progress)",
    saveAfter === saveBefore,
    {
      before: saveBefore.length,
      after: saveAfter.length,
    },
  );
}

// ================================================================== C. Kitchen Chaos
if (ONLY.includes("C")) {
  // C1 Giant: the same level's normal ingredient first, for the size to compare with.
  await orderAt(12, null, null);
  const normal = await probe();
  await orderAt(12, "giant", null);
  const giantCard = await card();
  const giant = await probe();
  const ratio = giant && normal ? giant.ingRx / normal.ingRx : 0;
  check(
    "C1 Giant Ingredient: announced, drawn bigger than the same level's normal one, still on the board",
    giantCard?.chaos === "giant" &&
      ratio > 1.15 &&
      giant.ingRx <= giant.boardHalfW &&
      giant.ingRy <= giant.boardHalfH,
    {
      card: giantCard,
      normal: normal?.ingRx,
      giant: giant?.ingRx,
      ratio: Math.round(ratio * 100) / 100,
      giant_: giant,
    },
  );
  await shot(page, "phase3-giant");
  await page.click('[aria-label="Pause"]');
  await sleep(400);
  await clickButton(page, /^Restart Prep$/);
  await sleep(1200);
  const kept = await probe();
  check(
    "C2 a restart keeps the order's event (and its size)",
    kept?.chaos === "giant" && kept.ingRx === giant.ingRx,
    kept,
  );
  const g = await playToReport(page, { maxMs: 150000 });
  await sleep(600);
  const gLines = await reportSpecials();
  check(
    "C3 Giant: the order plays to the report, which acknowledges it",
    g.ok && gLines.some((l) => l.id === "giant"),
    gLines,
  );

  // C4 Avalanche
  await orderAt(12, "avalanche", null);
  await page.waitForSelector('[data-testid="avalanche"]', { timeout: 8000 }).catch(() => null);
  await sleep(1400); // let them land
  const av0 = await probe();
  await page.mouse.click(CX, CY);
  await sleep(700);
  const s0 = await stepInfo(page);
  check(
    "C4 Avalanche: 8 vegetables land and hold the board (a tap on the food doesn't cut)",
    av0?.avalanche === 8 && s0.n === 0 && !!(await page.$('[data-testid="avalanche"]')),
    { av0, n: s0.n },
  );
  await stroke(CX - 190, CY, CX + 190, CY, 24);
  await sleep(700);
  const av1 = await probe();
  const leftShown = await page
    .$eval('[data-testid="avalanche-left"]', (e) => Number(e.textContent))
    .catch(() => null);
  check(
    "C5 a sweep slices the ones it crosses (the card counts down)",
    av1.avalanche < 8 && leftShown === av1.avalanche,
    { left: av1.avalanche, leftShown },
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(600);
  await shot(page, "phase3-avalanche-320");
  await page.setViewport({ width: 430, height: 900 });
  await sleep(600);
  await page.click('[data-testid="avalanche-skip"]');
  await sleep(1200);
  const av2 = await probe();
  await page.mouse.click(CX, CY);
  await sleep(900);
  check(
    "C6 Skip rolls the rest away (no avalanche objects left) and cutting works at once",
    av2.avalanche === null &&
      av2.avalancheObjects === 0 &&
      !(await page.$('[data-testid="avalanche"]')) &&
      (await stepInfo(page)).n === 1,
    av2,
  );
  await page.click('[aria-label="Pause"]');
  await sleep(400);
  await clickButton(page, /^Restart Prep$/);
  await sleep(1500);
  const av3 = await probe();
  check(
    "C7 a restart doesn't bring the avalanche back (once per order)",
    av3.avalanche === null && av3.chaos === "avalanche",
    av3,
  );
  const a = await playToReport(page, { maxMs: 150000 });
  await sleep(600);
  const aLines = await reportSpecials();
  check(
    "C8 the report counts the avalanche (sliced of 8)",
    a.ok &&
      aLines.some(
        (l) => l.id === "avalanche" && new RegExp(`${8 - av1.avalanche} of 8`).test(l.text),
      ),
    aLines,
  );

  // C9 Rush Hour: the cooking film's speed, recorded as it plays.
  await orderAt(12, "rush-hour", null);
  await page.evaluate(() => {
    window.__rates = [];
    document.addEventListener("play", (e) => window.__rates.push(e.target.playbackRate), true);
  });
  const r = await playToReport(page, { maxMs: 150000 });
  await sleep(600);
  const rates = await page.evaluate(() => window.__rates);
  const rLines = await reportSpecials();
  check(
    "C9 Rush Hour: the cooking film plays at 1.5× and the report says the plate went out fast",
    r.ok &&
      rates.length > 0 &&
      rates.every((x) => x === 1.5) &&
      rLines.some((l) => l.id === "rush-hour"),
    { rates, rLines },
  );

  // C10 Grandma's Challenge
  await orderAt(12, "grandma", null);
  await sleep(3600); // the announcement card goes, the chip shows
  const chip0 = await page
    .$eval('[data-testid="grandma-progress"]', (e) => e.innerText)
    .catch(() => null);
  const gr = await playToReport(page, { maxMs: 150000 });
  await sleep(600);
  const grLines = await reportSpecials();
  const grLine = grLines.find((l) => l.id === "grandma");
  check(
    "C10 Grandma's Challenge: a live ×N/8 chip, and the report says whether ×8 was reached",
    /×0 \/ 8/.test(chip0 ?? "") && gr.ok && !!grLine && /(she's proud|next time)/.test(grLine.text),
    { chip0, grLine },
  );

  // C11 Perfect Plating
  await orderAt(12, "perfect-plating", null);
  const pp = await playToReport(page, { maxMs: 150000 });
  await sleep(600);
  const ev = await reportEvenness();
  const ppLine = (await reportSpecials()).find((l) => l.id === "perfect-plating");
  check(
    "C11 Perfect Plating: the report's line quotes this dish's own Evenness, stamped at 90+",
    pp.ok &&
      ev !== null &&
      !!ppLine &&
      ppLine.text.includes(String(ev)) &&
      (ev >= 90 ? /Perfect Plating!/.test(ppLine.text) : /for the stamp/.test(ppLine.text)),
    { ev, ppLine },
  );

  // C12 an order that teaches a technique (Level 11, Rings) and an early level (9): never.
  await orderAt(11, "giant", null);
  const teach = await probe();
  await orderAt(9, "giant", null);
  const early = await probe();
  check(
    "C12 no event while a technique is taught (L11 Rings) or on Levels 1–10, even forced",
    teach?.chaos === null && early?.chaos === null,
    { teach: teach?.chaos, early: early?.chaos },
  );
}
if (ONLY.includes("C") || ONLY.includes("I")) {
  // C13 Kitchen Inspection — restaurant dev, Level 13 with its food in the fridge.
  const foods = ["tomato", "zucchini", "basil", "onion"];
  await bootAt(
    DEV,
    levelSave(13, {
      business: {
        ...MOVED_IN_BUSINESS,
        restaurantStaff: { specialists: ["mexican-chef"] },
        inventory: Object.fromEntries(
          foods.map((id) => [id, { ingredientId: id, quantity: 8, unitCost: 0, purchaseDay: 1 }]),
        ),
      },
    }),
  );
  // Level 13 is a first play here, but it teaches nothing (Rings is Level 11's), so it can have an event.
  await force("inspection", null);
  if (
    await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Later"),
    )
  )
    await clickButton(page, /^Later$/);
  await clickButton(page, /Prepare$/);
  await sleep(1200);
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i,
  );
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    {
      timeout: 30000,
    },
  );
  const iCard = await card();
  const before = await readSave(page);
  const ins = await playToReport(page, { maxMs: 180000 });
  await sleep(600);
  const insLine = (await reportSpecials()).find((l) => l.id === "inspection");
  const afterIns = await readSave(page);
  check(
    "C13 Kitchen Inspection: announced, the report carries the live inspection's verdict",
    iCard?.chaos === "inspection" &&
      ins.ok &&
      !!insLine &&
      /^📋 (Inspection: all clear|Inspector's note: .+)/.test(insLine.text),
    { iCard, insLine },
  );
  check(
    "C14 …and it costs nothing: the wallet and ledger are as they were before the order",
    afterIns.credits === before.credits &&
      afterIns.economyLedger.length === before.economyLedger.length,
    {
      credits: [before.credits, afterIns.credits],
      ledger: [before.economyLedger.length, afterIns.economyLedger.length],
    },
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(700);
  await shot(page, "phase3-inspection-report-320");
  const repFit = await page.evaluate(() => {
    const r = document
      .querySelector('[data-testid="knife-report-specials"]')
      ?.closest(".paper")
      ?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, vh: innerHeight } : null;
  });
  check(
    "C15 the Knife Report with a specials line fits at 320×568",
    !!repFit && repFit.top >= 0 && repFit.bottom <= repFit.vh,
    repFit,
  );
  await page.setViewport({ width: 430, height: 900 });
}

// ================================================================== D. Variants
if (ONLY.includes("D")) {
  const variants = [
    {
      id: "golden-tomato",
      level: 12,
      base: "tomato",
      name: "Golden Tomato",
      look: (h) => h.gold >= 0.5 && h.red < 0.2,
    },
    {
      id: "giant-cucumber",
      level: 46,
      base: "cucumber",
      name: "Giant Cucumber",
      look: (h) => h.green >= 0.5,
      bigger: true,
    },
    {
      id: "rainbow-carrot",
      level: 14,
      base: "carrot",
      name: "Rainbow Carrot",
      look: (h) => h.purple >= 0.08 && h.gold >= 0.08,
    },
    {
      id: "frosted-onion",
      level: 21,
      base: "onion",
      name: "Frosted Onion",
      look: (h) => h.blue >= 0.5,
    },
    {
      id: "heirloom-pepper",
      level: 52,
      base: "pepper",
      name: "Grandma's Heirloom Pepper",
      look: (h) => h.red >= 0.5 && h.orange < 0.25,
    },
  ];
  for (const [i, v] of variants.entries()) {
    const n = `D${i + 1}`;
    let normal = null;
    if (v.bigger) {
      await orderAt(v.level, null, null);
      normal = await probe();
    }
    await orderAt(v.level, null, v.id);
    const c = await card();
    // Play up to the variant's own ingredient (it may come later in the order).
    const reached = await playToReport(page, {
      maxMs: 240000,
      until: `window.__kcScene()?.ingredientId === "${v.base}"`,
    });
    await sleep(700);
    const pr = await probe();
    const bigger = v.bigger
      ? pr && normal && pr.ingRx / normal.ingRx > 1.15 && pr.ingRx <= pr.boardHalfW
      : true;
    check(
      `${n} ${v.name}: announced, and its skin takes the variant's colours` +
        (v.bigger ? " (drawn bigger, still on the board)" : ""),
      c?.variant === v.id && reached.stopped && pr?.variant === v.id && v.look(pr.hues) && bigger,
      { card: c?.variant, hues: pr?.hues, rx: [normal?.ingRx, pr?.ingRx] },
    );
    if (i === 0) {
      // a few cuts in, at phone size: the pieces carry the colour
      for (let k = 0; k < 3; k++) {
        await page.mouse.click(CX + (k - 1) * 30, CY);
        await sleep(350);
      }
      await page.setViewport({ width: 320, height: 568 });
      await sleep(700);
      await shot(page, "phase3-golden-tomato-320");
      await page.setViewport({ width: 430, height: 900 });
      await sleep(700);
    } else await shot(page, `phase3-${v.id}`);
    const done = await playToReport(page, { maxMs: 240000 });
    await sleep(600);
    const line = (await reportSpecials()).find((l) => l.id === "variant");
    check(
      `${n}b …and the Knife Report says it was made with it`,
      done.ok && !!line && line.text.endsWith(v.name),
      line ?? done.log.slice(-3),
    );
  }
  // A normal tomato is red: the colour check above is not satisfied by the plain ingredient.
  await orderAt(12, null, null);
  await playToReport(page, {
    maxMs: 90000,
    until: `window.__kcScene()?.ingredientId === "tomato"`,
  });
  await sleep(500);
  const plain = await probe();
  check(
    "D6 control: a plain tomato does not pass the golden check (it is red)",
    plain && !(plain.hues.gold >= 0.5 && plain.hues.red < 0.2),
    plain?.hues,
  );
}

// ================================================================== Z
if (ONLY.includes("Z")) {
  const errors = logs.filter((l) => /^(error|pageerror)/.test(l));
  check("Z1 no console errors", errors.length === 0, errors.slice(0, 5));
  await page.goto(process.env.KC_URL || "http://localhost:4173/", { waitUntil: "networkidle0" });
  check(
    "Z2 the production build has no development hook (window.__kcSpecials)",
    await page.evaluate(() => typeof window.__kcSpecials === "undefined"),
  );
}

save("phase3", { results, notes, logs });
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
