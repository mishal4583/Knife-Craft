// The LANDSCAPE cooking films (developer 2026-11-21: Gemini-made 16:9 films; 2026-11-22: all six kinds), restaurant build, in a real service at Level 4:
//   1. in a wide window the fruit dish plays its wide film FULL FRAME (data-testid="cooking-clip-wide", chef-fruit-wide, ~4.3 s) and it really plays, with SKIP › in the bottom-right corner;
//   2. in a wide window the salad dish plays chef-salad-wide (3.0 s);
//   3. on an upright phone the same fruit dish still plays the PORTRAIT film on the plain screen (no wide, no backdrop);
//   4. RULE CHANGE (developer 2026-11-22: the curry, bread, cooking and plating films arrived): the curry dish plays chef-curry-wide full frame too (it kept the portrait film on its
//      backdrop before), and so do bread (chef-bread-wide), another cooked dish (chef-cooking-wide) and a plated one (chef-plating-wide), each with SKIP › and no backdrop;
//   5. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, clickButton } from "./harness.mjs";
import { playToReport, geometryFromCanvas } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const N = 4;
const stock = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 6, unitCost: 100, purchaseDay: 7 }]),
  );
const seed = (recipeId, ids) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ["server", "cashier"] },
      calendar: { businessDay: 7 },
      inventory: stock(ids),
      restaurantStaff: { specialists: ["mexican-chef"] },
      sectionsSeen: ["inventory", "shop", "rack", "business"],
    },
    credits: 5_000_000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
      tickets: { [`level-${N}`]: [recipeId, recipeId] },
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  s.version = 3;
  return s;
};
const click = async (page, re) => {
  const r = await page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        new RegExp(src, "i").test(x.textContent.trim()) &&
        !x.disabled &&
        x.getBoundingClientRect().width > 0,
    );
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, re.source);
  if (r) await page.mouse.click(r.x, r.y);
  return !!r;
};
const clipShown = () =>
  document.querySelector('[data-testid="cooking-clip"]')?.getAttribute("aria-hidden") === "false";

const { browser, page, logs } = await launch();
// The film can show and end between two polls of the solver: a sampler in the page keeps the last look at the film (window.__film), whenever it was up.
await page.evaluateOnNewDocument(() => {
  setInterval(() => {
    const host = document.querySelector('[data-testid="cooking-clip"]');
    const v = host?.querySelector("video");
    if (!host || host.getAttribute("aria-hidden") !== "false" || !v) return;
    window.__film = {
      wide: !!document.querySelector('[data-testid="cooking-clip-wide"]'),
      backdrop: !!document.querySelector('[data-testid="film-backdrop"]'),
      src: v.currentSrc.replace(/^.*\//, ""),
      t: v.currentTime,
      paused: v.paused,
      duration: v.duration,
      skip: !!document.querySelector('[aria-label="Skip cooking"]'),
    };
  }, 150);
});

/** Plays a one-dish service until the cooking film shows; returns what the film is. */
async function filmOnce(label, recipeId, ids, size, shotName) {
  await page.setViewport({ ...size, deviceScaleFactor: 1, hasTouch: size.width < 500 });
  await boot(page, seed(recipeId, ids));
  await page.evaluate(() => {
    window.__film = undefined;
  });
  await sleep(2500);
  await clickButton(page, /^Open for service$/);
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    const had = await click(page, /(Hire Server &|Open restaurant|Start cooking)/);
    await sleep(1800);
    if (!had) break;
  }
  await click(page, /Start cooking/);
  await sleep(2500);
  await shot(page, shotName + "-pre");
  // The board is laid out differently per window: aim from the real canvas.
  const geom = size.width >= 900 ? await geometryFromCanvas(page) : undefined;
  await playToReport(page, { maxMs: 120000, until: clipShown, ...(geom ? { geom } : {}) });
  await sleep(1300);
  const info = await page.evaluate(() => {
    if (window.__film) return window.__film;
    const v = document.querySelector('[data-testid="cooking-clip"] video');
    return {
      wide: !!document.querySelector('[data-testid="cooking-clip-wide"]'),
      backdrop: !!document.querySelector('[data-testid="film-backdrop"]'),
      src: v ? v.currentSrc.replace(/^.*\//, "") : null,
      t: v ? v.currentTime : -1,
      paused: v ? v.paused : null,
      duration: v ? v.duration : 0,
      skip: !!document.querySelector('[aria-label="Skip cooking"]'),
    };
  });
  await shot(page, shotName);
  console.log(label, JSON.stringify(info));
  return info;
}

/** The cutting solver can stall on a last cut; one retry keeps the film check about the film. */
async function filmFor(...args) {
  const first = await filmOnce(...args);
  return first.src ? first : filmOnce(...args);
}

try {
  const FRUIT = ["grapes", "strawberry"];
  const f = await filmFor(
    "fruit wide",
    "camp-latin-grapes-strawberry",
    FRUIT,
    { width: 1280, height: 720 },
    "widefilm-fruit",
  );
  check(
    "1 fruit dish, wide window: the wide film plays full frame, with SKIP ›",
    f.wide &&
      !f.backdrop &&
      /chef-fruit-wide/.test(f.src ?? "") &&
      f.t > 0 &&
      f.skip &&
      Math.abs(f.duration - 4.29) < 0.3,
    f,
  );

  const s = await filmFor(
    "salad wide",
    "camp-simple-garden-salad",
    ["tomato", "cucumber", "carrot"],
    { width: 1280, height: 720 },
    "widefilm-salad",
  );
  check(
    "2 salad dish, wide window: chef-salad-wide (3 s) plays",
    s.wide && /chef-salad-wide/.test(s.src ?? "") && s.t > 0 && Math.abs(s.duration - 3) < 0.3,
    s,
  );

  const p = await filmFor(
    "fruit phone",
    "camp-latin-grapes-strawberry",
    FRUIT,
    { width: 390, height: 844 },
    "widefilm-fruit-phone",
  );
  check(
    "3 fruit dish on an upright phone: the portrait film, not the wide one",
    !p.wide && !p.backdrop && /chef-fruit-/.test(p.src ?? "") && !/wide/.test(p.src ?? ""),
    p,
  );

  const wideKinds = [
    [
      "curry wide",
      "camp-pumpkin-curry-dice",
      ["pumpkin", "onion", "garlic"],
      "chef-curry-wide",
      5.38,
      "widefilm-curry",
    ],
    [
      "bread wide",
      // The only campaign bread dish with no oven step (an oven dish plays the oven film instead of the cooking film).
      "camp-peach-cheddar-board",
      ["peach", "cheddar", "baguette"],
      "chef-bread-wide",
      5.88,
      "widefilm-bread",
    ],
    [
      "cooked wide",
      "camp-pepper-fajita-julienne",
      ["pepper", "onion"],
      "chef-cooking-wide",
      3.86,
      "widefilm-cooked",
    ],
    [
      "plated wide",
      "camp-garden-tomato-cucumber",
      ["tomato", "cucumber"],
      "chef-plating-wide",
      5.29,
      "widefilm-plated",
    ],
  ];
  for (const [label, recipe, ids, file, secs, shotName] of wideKinds) {
    const c = await filmFor(label, recipe, ids, { width: 1280, height: 720 }, shotName);
    check(
      `4 ${label}: ${file} plays full frame, with SKIP ›, no backdrop`,
      c.wide &&
        !c.backdrop &&
        (c.src ?? "").includes(file) &&
        c.t > 0 &&
        c.skip &&
        Math.abs(c.duration - secs) < 0.3,
      c,
    );
  }
} catch (e) {
  check("run", false, String(e).slice(0, 200));
}

const errors = logs.filter(
  (l) => /error/i.test(String(l)) && !/favicon|Failed to load resource/.test(String(l)),
);
check("5 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nWIDEFILM: ALL PASS");
process.exit(failed.length ? 1 : 0);
