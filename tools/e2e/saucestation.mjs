// Sauce Station (developer 2026-11-08/09), restaurant build, in a real browser: "Mix it, whisk it, bottle it" (business/sauceStation.ts).
//   S1 below Level 7 there is no chip; from Level 7 the Inventory shows "Sauce Station · 3/3"
//   S2 the chip opens the game: the how-to shows the first time (saved as seen); the clock waits for Start; Back before Start leaves and saves nothing
//   S3 the mixing stage: the target and live swatches, the pantry tiles (every recipe item among them), the gauges
//   S4 a pantry tap adds a scoop (count badge, volume up), Undo takes it back, the bowl stops at its cap
//   S5 circling the whisk with the pointer in the green zone raises the blend (the dial and the tube follow)
//   S6 the reference recipe + Auto blend = a near-perfect match (the live match is high and the sauce is blended)
//   S7 "Bottle it" opens the bottling stage; holding Pour fills the bottle; letting go at the line scores; all bottles then end the round
//   S8 the result: stars, a score, Hype, today's round count 1, the Saucier counters; money, stock and the ledger never move
//   S9 the Sauce Shelf lists the 24 sauces (locked ones are marked, no level number) and its count matches the save
//   S10 Done returns to the Inventory and the chip shows 2/3
//   S11 a hired Prep Cook: his button makes a batch for you, counts nothing and leaves
//   S12 at 320 x 568 nothing scrolls sideways and every pantry tile is at least 48 px tall
//   S15 the free rounds used: the chip offers "3 more rounds"; the ad button in the game grants them ONLY after the ad reports rewarded (placement sauce_rounds, no money)
//   S16 a skipped ad grants nothing and says so
//   S13 without any painted art the game still plays (CSS stand-ins)
//   S14 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  openShortcut,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const saveAt = (n, business = {}) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, ...business },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const tap = async (page, sel) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(250);
};
const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }, sel);
/** A real pointer tap in the middle of an element. */
const press = async (page, sel, hold = 60) => {
  const r = await rect(page, sel);
  if (!r) return false;
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.up();
  await sleep(80);
  return true;
};
const root = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="sauce-station"]');
    return g
      ? {
          phase: g.dataset.phase,
          sauce: g.dataset.sauce,
          tier: Number(g.dataset.tier),
          volume: Number(g.dataset.volume),
          blend: Number(g.dataset.blend),
          match: Number(g.dataset.match),
          bottle: Number(g.dataset.bottle),
          practice: g.dataset.practice,
          recipe: g.dataset.recipe,
          timer: document.querySelector('[data-testid="sauce-timer"]')?.textContent?.trim(),
          tiles: document.querySelectorAll('[data-testid^="sauce-pantry-"]').length,
        }
      : null;
  });
const openInventory = async (page) => {
  await openShortcut(page, "inventory");
  await sleep(1200);
};
const openGame = async (page) => {
  await tap(page, '[data-testid="sauce-station-chip"]');
  await sleep(1000);
  const guide = await page.evaluate(() => !!document.querySelector('[data-testid="sauce-guide"]'));
  if (guide) await tap(page, '[data-testid="sauce-guide-ok"]');
  await sleep(200);
  return guide;
};
const start = async (page) => {
  await tap(page, '[data-testid="sauce-start"]');
  await sleep(300);
};
const snapshot = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stub:knifecraft_save") ?? "null");
    return s
      ? { credits: s.credits, inventory: s.business?.inventory, ledger: s.economyLedger?.length }
      : null;
  });
/** Puts the reference recipe in the bowl with real taps: slow for oil (so it never splits), after switching on Auto blend. */
const pourRecipe = async (page, recipe) => {
  const parts = recipe.split(",").map((p) => p.split(":"));
  const SCOOP = (id) =>
    [
      "salt",
      "pepper",
      "paprika",
      "turmeric",
      "cumin",
      "curry-powder",
      "chilli-flakes",
      "sugar",
    ].includes(id)
      ? 0.25
      : id === "stock-cube"
        ? 1
        : 1;
  const oils = parts.filter(([id]) => /oil$/.test(id));
  const rest = parts.filter(([id]) => !/oil$/.test(id));
  for (const [id, n] of rest) {
    const taps = Math.round(Number(n) / SCOOP(id));
    for (let i = 0; i < taps; i++) await press(page, `[data-testid="sauce-pantry-${id}"]`, 30);
  }
  await tap(page, '[data-testid="sauce-auto"]');
  await sleep(2200);
  for (const [id, n] of oils) {
    const taps = Math.round(Number(n) / SCOOP(id));
    for (let i = 0; i < taps; i++) {
      await press(page, `[data-testid="sauce-pantry-${id}"]`, 30);
      await sleep(650);
    }
  }
  await sleep(4200);
};

const { browser, page, logs } = await launch();

// Rewarded ads stubbed from inside initialize() (as tools/e2e/adbonuses.mjs does): showRewarded -> opened -> rewarded -> closed, or opened -> closed when __adSkip.
await page.evaluateOnNewDocument(() => {
  window.__rewarded = [];
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
          const adv = b.advertisement;
          const handlers = {};
          Object.defineProperty(adv, "isRewardedSupported", {
            get: () => true,
            configurable: true,
          });
          adv.on = (e, cb) => (handlers[e] ??= []).push(cb);
          adv.off = (e, cb) => (handlers[e] = (handlers[e] ?? []).filter((x) => x !== cb));
          const emit = (e, st) => (handlers[e] ?? []).slice().forEach((h) => h(st));
          adv.showRewarded = (placement) => {
            window.__rewarded.push(placement);
            const states = window.__adSkip
              ? ["opened", "closed"]
              : ["opened", "rewarded", "closed"];
            states.forEach((st, i) =>
              setTimeout(() => emit(b.EVENT_NAME.REWARDED_STATE_CHANGED, st), 80 * (i + 1)),
            );
          };
          return r;
        });
    },
  });
});

// S1: the chip
await boot(page, saveAt(6));
await openInventory(page);
const chip22 = await page.evaluate(
  () => !!document.querySelector('[data-testid="sauce-station-chip"]'),
);
check("S1 below Level 7 there is no Sauce Station chip", chip22 === false);
await boot(page, saveAt(7));
await openInventory(page);
const chip23 = await page.evaluate(
  () => document.querySelector('[data-testid="sauce-station-chip"]')?.textContent?.trim() ?? null,
);
check(
  "S1b from Level 7 the chip shows 'Sauce Station · 3/3'",
  !!chip23 && /Sauce Station · 3\/3/.test(chip23),
  chip23,
);
await shot(page, "sauce-1-chip");

// S2: the guide, Start, Back
const before = await snapshot(page);
const guideShown = await openGame(page);
const s0 = await root(page);
const saved = await readSave(page);
check(
  "S2 the how-to shows the first time and is saved as seen; the clock waits for Start",
  guideShown && s0?.phase === "ready" && saved?.business?.sauceStation?.howto === 1,
  { guideShown, phase: s0?.phase, howto: saved?.business?.sauceStation?.howto },
);
await shot(page, "sauce-2-ready");
await tap(page, '[data-testid="sauce-pause"]'); // Back before Start
await sleep(900);
const afterBack = await page.evaluate(
  () => !!document.querySelector('[data-testid="sauce-station"]'),
);
const savedBack = await readSave(page);
check(
  "S2b Back before Start leaves the game and counts no round",
  afterBack === false && (savedBack?.business?.sauceStation?.rounds ?? 0) === 0,
  { afterBack, rounds: savedBack?.business?.sauceStation?.rounds },
);
await openGame(page);
await start(page);

// S3: the mixing stage
const s1 = await root(page);
const tiles = s1?.recipe?.split(",").map((p) => p.split(":")[0]) ?? [];
const haveAll = await page.evaluate(
  (ids) => ids.every((id) => !!document.querySelector(`[data-testid="sauce-pantry-${id}"]`)),
  tiles,
);
check(
  "S3 the mixing stage is up: swatches, a pantry with every recipe item, gauges",
  s1?.phase === "mix" &&
    s1.tiles >= 9 &&
    haveAll &&
    (await page.evaluate(() =>
      [
        "sauce-target",
        "sauce-live",
        "sauce-dial",
        "sauce-emulsion",
        "sauce-thickness",
        "sauce-vessel",
      ].every((t) => !!document.querySelector(`[data-testid="${t}"]`)),
    )),
  { phase: s1?.phase, tiles: s1?.tiles, haveAll },
);
await shot(page, "sauce-3-mix");

// S4: scoops, undo, cap
const first = tiles[0];
await press(page, `[data-testid="sauce-pantry-${first}"]`);
const a1 = await root(page);
const badge = await page.evaluate(
  (id) => document.querySelector(`[data-testid="sauce-count-${id}"]`)?.textContent,
  first,
);
await tap(page, '[data-testid="sauce-undo"]');
const a2 = await root(page);
for (let i = 0; i < 16; i++) await press(page, `[data-testid="sauce-pantry-${first}"]`, 20);
const a3 = await root(page);
check(
  "S4 a tap adds a scoop (badge, volume), Undo takes it back, the bowl stops at its cap",
  a1.volume > a2.volume && a2.volume === 0 && badge === "1" && a3.volume <= 12 && a3.volume >= 8,
  { v1: a1.volume, v2: a2.volume, v3: a3.volume, badge },
);
while ((await root(page)).volume > 0) await tap(page, '[data-testid="sauce-undo"]');

// S5: circle the whisk
await press(page, `[data-testid="sauce-pantry-${first}"]`, 20);
await press(page, `[data-testid="sauce-pantry-${first}"]`, 20);
const blend0 = (await root(page)).blend;
const circled = await page.evaluate(async () => {
  const stage = document.querySelector('[data-testid="sauce-stage"]');
  const r = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.34;
  const fire = (type, x, y) =>
    stage.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  fire("pointerdown", cx + 60, cy);
  let ang = 0;
  let max = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 3000) {
    ang += (2 * Math.PI * 1.9 * 16) / 1000; // 1.9 turns a second
    fire("pointermove", cx + 60 * Math.cos(ang), cy + (60 * Math.sin(ang)) / 1.5);
    max = Math.max(
      max,
      Number(document.querySelector('[data-testid="sauce-dial"]')?.dataset.omega ?? 0),
    );
    await new Promise((res) => setTimeout(res, 16));
  }
  fire("pointerup", cx, cy);
  return { max };
});
const blend1 = (await root(page)).blend;
check(
  "S5 circling the whisk in the green zone blends (the dial shows the speed, the blend rises)",
  blend1 > blend0 + 0.3 && circled.max > 1 && circled.max < 3.2,
  { blend0, blend1, omega: circled.max },
);
await shot(page, "sauce-5-whisk");
while ((await root(page)).volume > 0) await tap(page, '[data-testid="sauce-undo"]');

// S6: the reference recipe, auto-blended
const s2 = await root(page);
await pourRecipe(page, s2.recipe);
const s3 = await root(page);
check(
  "S6 the reference recipe and Auto blend = a near-perfect match, fully blended",
  s3.match >= 94 && s3.blend >= 0.9,
  { match: s3.match, blend: s3.blend, sauce: s3.sauce },
);
await shot(page, "sauce-6-mixed");

// S7: bottling
await tap(page, '[data-testid="sauce-bottle-it"]');
await sleep(500);
const b0 = await root(page);
const bottlesTotal = await page.evaluate(
  () =>
    document.querySelector('[data-testid="sauce-timer"]')?.textContent?.match(/\/\s*(\d+)/)?.[1],
);
check("S7 'Bottle it' opens the bottling stage", b0.phase === "bottle" && !!bottlesTotal, {
  phase: b0.phase,
  bottlesTotal,
});
await shot(page, "sauce-7-bottling");
let poured = 0;
for (let i = 0; i < Number(bottlesTotal); i++) {
  const r = await rect(page, '[data-testid="sauce-pour"]');
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
  await page.mouse.down();
  const t0 = Date.now();
  let f = 0;
  while (Date.now() - t0 < 6000) {
    f = await page.evaluate(() =>
      Number(document.querySelector('[data-testid="sauce-bottle"]')?.dataset.fill ?? 0),
    );
    if (f >= 0.88) break;
    await sleep(20);
  }
  await page.mouse.up();
  if (f >= 0.5) poured++;
  if (i === 0) await shot(page, "sauce-7-poured");
  await sleep(1000);
}
check(
  "S7b every bottle was filled by holding Pour and letting go at the line",
  poured === Number(bottlesTotal),
  { poured },
);
await sleep(900);

// S8: the result
const res = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="sauce-result"]');
  return r
    ? {
        stars: Number(r.dataset.stars),
        score: document.querySelector('[data-testid="sauce-final-score"]')?.textContent,
        reward: document.querySelector('[data-testid="sauce-reward"]')?.textContent,
      }
    : null;
});
const after = await snapshot(page);
const sv = await readSave(page);
check(
  "S8 the result shows stars, a score and Hype; the round is counted",
  !!res &&
    res.stars >= 2 &&
    /\d/.test(res.score ?? "") &&
    /Hype/.test(res.reward ?? "") &&
    sv?.business?.sauceStation?.rounds === 1 &&
    sv?.business?.sauceStation?.today === 1,
  { res, st: sv?.business?.sauceStation },
);
check(
  "S8b money, stock and the ledger never move",
  JSON.stringify(after) === JSON.stringify(before),
  { before, after },
);
await shot(page, "sauce-8-result");

// S9: the shelf
await tap(page, '[data-testid="sauce-shelf-btn"]');
await sleep(900);
const shelf = await page.evaluate(() => ({
  slots: document.querySelectorAll('[data-testid^="sauce-slot-"]').length,
  locked: document.querySelectorAll('[data-testid^="sauce-slot-"][data-state="locked"]').length,
  mastered: document.querySelectorAll('[data-testid^="sauce-slot-"][data-state="mastered"]').length,
  count: document.querySelector('[data-testid="sauce-shelf-count"]')?.textContent?.trim(),
}));
const bits = sv?.business?.sauceStation?.mastered ?? 0;
const bitCount = bits.toString(2).split("1").length - 1;
check(
  "S9 the Sauce Shelf lists 24 sauces, the locked ones are marked, the count matches the save",
  shelf.slots === 24 &&
    shelf.locked >= 10 &&
    shelf.mastered === bitCount &&
    new RegExp(`${bitCount}/24`).test(shelf.count ?? ""),
  { shelf, bitCount },
);
await shot(page, "sauce-9-shelf");

// S10: Done -> Inventory, chip 2/3
await tap(page, '[data-testid="sauce-shelf-back"]');
await sleep(1000);
const chip2 = await page.evaluate(
  () => document.querySelector('[data-testid="sauce-station-chip"]')?.textContent?.trim() ?? null,
);
check(
  "S10 back in the Inventory the chip shows 2/3",
  !!chip2 && /Sauce Station · 2\/3/.test(chip2),
  chip2,
);

// S11: the Prep Cook
await boot(page, saveAt(23, { staff: { hiredRoles: ["prep-cook"], members: {} } }));
await openInventory(page);
await openGame(page);
const cookBtn = await page.evaluate(
  () => !!document.querySelector('[data-testid="sauce-auto-cook"]'),
);
if (cookBtn) await tap(page, '[data-testid="sauce-auto-cook"]');
await sleep(900);
const cookSave = await readSave(page);
check(
  "S11 a hired Prep Cook: his button makes a batch for you, counts nothing and leaves",
  cookBtn &&
    (cookSave?.business?.sauceStation?.rounds ?? 0) === 0 &&
    !(await page.evaluate(() => !!document.querySelector('[data-testid="sauce-station"]'))),
  { cookBtn, rounds: cookSave?.business?.sauceStation?.rounds },
);

// S12: small phone
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(23));
await openInventory(page);
await openGame(page);
await start(page);
await sleep(300);
const small = await page.evaluate(() => {
  const g = document.querySelector('[data-testid="sauce-station"]');
  const tiles = [...document.querySelectorAll('[data-testid^="sauce-pantry-"]')].map((t) =>
    t.getBoundingClientRect(),
  );
  return {
    sideways:
      document.documentElement.scrollWidth > window.innerWidth + 1 ||
      (g?.scrollWidth ?? 0) > (g?.clientWidth ?? 0) + 1,
    minH: Math.round(Math.min(...tiles.map((r) => r.height))),
    minW: Math.round(Math.min(...tiles.map((r) => r.width))),
    pour: !!document.querySelector('[data-testid="sauce-bottle-it"]'),
  };
});
check(
  "S12 at 320 x 568 nothing scrolls sideways and every pantry tile is at least 48 px tall",
  !small.sideways && small.minH >= 48 && small.minW >= 48 && small.pour,
  small,
);
await shot(page, "sauce-12-small");
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });

// S15: the rewarded ad, "3 more rounds today"
const usedUp = { sauceStation: { day: 1, today: 3, howto: 1 } };
await boot(page, saveAt(12, usedUp));
await openInventory(page);
const adChip = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="sauce-station-chip"]');
  return c ? { offer: c.dataset.offer, text: c.textContent.trim() } : null;
});
check(
  "S15 the free rounds used: the chip offers '3 more rounds' (and never before they are used)",
  adChip?.offer === "ad" && /3 more rounds/.test(adChip.text),
  adChip,
);
const beforeAd = await readSave(page);
await openGame(page);
const readyInfo = await page.evaluate(() => ({
  practice: document.querySelector('[data-testid="sauce-station"]')?.dataset.practice,
  btn: document.querySelector('[data-testid="sauce-ad"]')?.textContent?.trim() ?? null,
}));
check(
  "S15a past today's rounds the game is practice and the button says what the ad gives",
  readyInfo.practice === "1" && /3 more rounds today/.test(readyInfo.btn ?? ""),
  readyInfo,
);
await tap(page, '[data-testid="sauce-ad"]');
await sleep(1500);
const afterAd = await readSave(page);
const placements = await page.evaluate(() => window.__rewarded);
const afterGame = await page.evaluate(() => ({
  practice: document.querySelector('[data-testid="sauce-station"]')?.dataset.practice,
}));
check(
  "S15b the ad (placement sauce_rounds) grants 3 rounds; the game restarts as a real round; no money, stock or ledger entry",
  placements.join() === "sauce_rounds" &&
    afterAd.business.sauceStation.extra === 3 &&
    afterGame.practice === "0" &&
    afterAd.credits === beforeAd.credits &&
    afterAd.economyLedger.length === beforeAd.economyLedger.length &&
    JSON.stringify(afterAd.business.inventory) === JSON.stringify(beforeAd.business.inventory),
  { placements, st: afterAd.business.sauceStation, afterGame },
);
await shot(page, "sauce-15-ad");

// S16: a skipped ad
await page.evaluate(() => {
  window.__adSkip = true;
  window.__rewarded = [];
});
await boot(page, saveAt(12, usedUp));
await page.evaluate(() => {
  window.__adSkip = true;
});
await openInventory(page);
await openGame(page);
await tap(page, '[data-testid="sauce-ad"]');
await sleep(1500);
const skipped = await readSave(page);
const noMsg = await page.evaluate(
  () => document.querySelector('[data-testid="sauce-ad-no"]')?.textContent?.trim() ?? null,
);
check(
  "S16 a skipped ad grants nothing and says so",
  (skipped.business.sauceStation.extra ?? 0) === 0 && /No ad right now/.test(noMsg ?? ""),
  { st: skipped.business.sauceStation, noMsg },
);

// S13: no art at all
await page.evaluateOnNewDocument(() => {
  const d = Object.getOwnPropertyDescriptor(Image.prototype, "src");
  Object.defineProperty(Image.prototype, "src", {
    set(v) {
      if (/business\/sauce\//.test(String(v))) {
        setTimeout(() => this.onerror && this.onerror(new Event("error")), 0);
        return;
      }
      d.set.call(this, v);
    },
    get: d.get,
  });
});
await boot(page, saveAt(23));
await openInventory(page);
await openGame(page);
await start(page);
await press(page, '[data-testid^="sauce-pantry-"]');
const bare = await root(page);
check(
  "S13 with no painted art the game still opens and pours (CSS stand-ins)",
  bare?.phase === "mix" && bare.volume > 0,
  bare,
);

check(
  "S14 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 4),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
