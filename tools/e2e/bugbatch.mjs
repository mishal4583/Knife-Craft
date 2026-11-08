// "Bugs and Issues KnifeCraft.docx" (developer 2026-11-08), restaurant build, in a real browser.
//   B1  the restroom picture does not resize or move when wiping starts (and the hint appears): the stage box is identical before / during
//   B2  Paige is a popup: a dim, blurred scrim, a card with her round portrait, inside the screen, no sideways scroll
//   B4  the Second Floor: with $400 the first machine says "save", with $900 "buy" with a hand at Buy
//   B7  the 2nd floor button on the map: the medallion, 56 px tall, breathing when there is a reason to go up
//   B8  the people on the map are smaller than the 2026-11-07 size (a person is under 70 px tall at 430 px wide)
//   B0  no console errors
// Screenshots: out/bugbatch-*.png (next to this file). Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const SUPPLIES = [
  "bin-liners",
  "brooms",
  "disinfectant",
  "floor-cleaner",
  "hand-soap",
  "mop-bucket",
  "paper-towels",
  "sponges-cloths",
  "toilet-brushes",
  "toilet-paper",
];
const at = (n, credits, extra = {}, tasks = []) =>
  seedSave({
    credits,
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ["server", "cashier"] },
      assistant: { hired: true, seen: ["first-pay", "restock"], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(SUPPLIES.map((id) => [id, { units: 40, costBasis: 40 }])),
        },
      },
      ...(tasks.length
        ? {
            cleanliness: {
              tasks: tasks.map((kind) => ({ kind, count: 1, since: n - 1 })),
              open: {},
              counters: { sink: 0, paper: 0 },
              cleanerAreas: [],
              introSeen: true,
              cupboardAt: 4,
              lastStart: null,
              cleaned: 0,
              byCleaner: 0,
            },
          }
        : {}),
      ...extra,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
const later = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="guide-card"] button')]
      .find((b) => b.textContent.includes("Later"))
      ?.click(),
  );

try {
  // ---- B1: the restroom stage stays still ----
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, at(20, 5000, {}, ["restroom-disinfect"]));
  await sleep(1500);
  await later();
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(800);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Cleanliness"))
      ?.click(),
  );
  await sleep(900);
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="area-restroom"]');
    if (!card?.querySelector('[data-task="restroom-disinfect"]'))
      card?.querySelector("button")?.click();
  });
  await sleep(500);
  await page.evaluate(() => {
    [
      ...(document.querySelector('[data-task="restroom-disinfect"]')?.querySelectorAll("button") ??
        []),
    ]
      .find((x) => !x.disabled && /Clean/.test(x.textContent))
      ?.click();
  });
  await page.waitForSelector('[data-testid="cleaning-stage"]', { timeout: 8000 }).catch(() => null);
  await sleep(800);
  const rect = () =>
    page.evaluate(() => {
      const r = document.querySelector('[data-testid="cleaning-stage"]')?.getBoundingClientRect();
      return r
        ? {
            x: Math.round(r.left * 10) / 10,
            y: Math.round(r.top * 10) / 10,
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
          }
        : null;
    });
  const before = await rect();
  const dirt = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="cleaning-dirt"]').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  // The mirror is on the right-hand wall; rub there with the Sponge first (the wrong tool: the hint appears).
  await page.mouse.move(dirt.x + dirt.w * 0.86, dirt.y + dirt.h * 0.5);
  await page.mouse.down();
  const during = [];
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(
      dirt.x + dirt.w * (0.84 + (i % 2) * 0.05),
      dirt.y + dirt.h * (0.44 + i * 0.01),
    );
    await sleep(40);
    during.push(await rect());
  }
  const hint = await page.evaluate(
    () => document.querySelector('[data-testid="cleaning-hint-slot"]')?.textContent ?? "",
  );
  await page.mouse.up();
  await sleep(300);
  const after = await rect();
  await shot(page, "bugbatch-1-restroom");
  const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  check(
    "B1 the restroom picture is the same size and place before, while wiping (with the hint showing) and after",
    same(before, after) && during.every((d) => same(d, before)),
    { before, after, moved: during.filter((d) => !same(d, before)).length, hint },
  );
  await page.evaluate(() => document.querySelector('[aria-label^="Close"]')?.click());
  await sleep(500);

  // ---- B7 + B8: the map ----
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await boot(page, at(11, 900));
  await sleep(1500);
  await later();
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector('[data-testid="upstairs"]', { timeout: 15000 }).catch(() => null);
  await sleep(2500);
  await shot(page, "bugbatch-2-map");
  const up = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="upstairs"]');
    const r = b?.getBoundingClientRect();
    return b
      ? {
          h: Math.round(r.height),
          w: Math.round(r.width),
          attention: b.getAttribute("data-attention"),
          text: b.textContent,
          medal: !!b.querySelector(".upstairs-medal"),
          glow: !!b.querySelector(".upstairs-glow"),
          inside: r.right <= window.innerWidth && r.bottom <= window.innerHeight,
          sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        }
      : null;
  });
  check(
    "B7 the 2nd floor button is a 56 px medallion that breathes ('Buy a machine' with $900), inside the screen",
    !!up &&
      up.medal &&
      up.glow &&
      up.attention === "1" &&
      up.h >= 56 &&
      /Buy a machine/.test(up.text) &&
      up.inside &&
      !up.sideways,
    up,
  );
  const people = await page.evaluate(() =>
    [...document.querySelectorAll(".floor-person--sprite")].map((e) =>
      Math.round(e.getBoundingClientRect().height),
    ),
  );
  check(
    "B8 the painted people on the map are under 70 px tall at 430 px wide (they were about 69 x 1.0 before the fix and drawn 1.5x too big)",
    people.length > 0 && Math.max(...people) < 70,
    { count: people.length, max: Math.max(0, ...people) },
  );

  // ---- B4: the Second Floor's first machine ----
  for (const [credits, stage] of [
    [400, "save"],
    [900, "buy"],
  ]) {
    await boot(page, at(11, credits));
    await sleep(1500);
    await later();
    await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
    await page.waitForSelector('[data-testid="upstairs"]', { timeout: 15000 }).catch(() => null);
    await sleep(800);
    await page.evaluate(() => document.querySelector('[data-testid="upstairs"]')?.click());
    await page
      .waitForSelector('[data-testid="floor-first-machine"]', { timeout: 10000 })
      .catch(() => null);
    await sleep(600);
    const s = await page.evaluate(() => {
      const e = document.querySelector('[data-testid="floor-first-machine"]');
      return e
        ? {
            stage: e.getAttribute("data-stage"),
            text: e.textContent.replace(/\s+/g, " ").slice(0, 160),
            hand: !!e.querySelector('[data-testid="floor-first-machine-hand"]'),
            bar: !!e.querySelector('[role="progressbar"]'),
            buy: [...e.querySelectorAll("button")].map((b) => b.textContent.trim()),
          }
        : null;
    });
    await shot(page, `bugbatch-3-floor-${stage}`);
    check(
      `B4 with $${credits} the first machine says '${stage}'`,
      !!s &&
        s.stage === stage &&
        (stage === "save" ? s.bar && s.buy.length === 0 : s.hand && s.buy.includes("Buy")),
      s,
    );
  }
} catch (e) {
  check("B-crash the run did not crash", false, String(e).slice(0, 300));
}
const bad = logs.filter(
  (l) =>
    /error/i.test(l.type ?? l) &&
    !/favicon|Failed to load resource|bridge/i.test(l.text ?? String(l)),
);
check("B0 no console errors", bad.length === 0, bad.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
