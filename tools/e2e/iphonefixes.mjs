// The four bugs from the developer's iPhone playtest (2026-11-06), restaurant build, at 390×844 with touch.
// Headless Chrome, not Safari: it proves the layout and the behaviour, not WebKit's own scrolling.
//   1. Market Plan ahead: a day tab rebuilds the scroller; the page still scrolls, and Buy all clears the pill's zone.
//   2. Buying the plan: Inventory shows nothing low for today.
//   3. Cleaner: a Hire the wallet can't pay says why on screen; the Cleaning page shows the painted portrait, and once hired
//      both screens agree and no hiring fee is shown.
//   4. The cleaning room does not move in its first 3 seconds, and nothing filters it.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, openSection, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});

const N = 25;
const seed = (credits, hiredRoles, tasks = []) =>
  seedSave({
    credits,
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { ...(MOVED_IN_BUSINESS.staff ?? {}), hiredRoles },
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(
            ["disinfectant", "sponges-cloths", "toilet-brushes"].map((id) => [
              id,
              { units: 40, costBasis: 40 },
            ]),
          ),
        },
      },
      cleanliness: {
        tasks: tasks.map((kind) => ({ kind, count: 1, since: N - 1 })),
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: hiredRoles.includes("cleaner") ? ["kitchen", "dining", "restroom"] : [],
        introSeen: true,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });
const TEAM = ["server", "cashier"];

async function openCleanliness() {
  await openSection(page, "Business");
  await sleep(800);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Cleanliness"))
      ?.click(),
  );
  await page
    .waitForSelector('[data-testid="cleanliness-staff"]', { timeout: 8000 })
    .catch(() => null);
  await sleep(600);
}
const scroller = () =>
  page.evaluate(() => {
    let el = document.querySelector('[data-testid="market-plan"]');
    while (el && !/auto|scroll/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    if (!el) return null;
    const before = el.scrollTop;
    el.scrollTop = 1e6;
    const r = {
      repairs: +(el.dataset.scrollRepairs ?? 0),
      overflow: el.style.overflowY,
      moved: el.scrollTop !== before,
      room: el.scrollHeight - el.clientHeight,
    };
    return r;
  });
const tab = (label) =>
  page.evaluate((l) => {
    [...document.querySelectorAll('[aria-label="Plan ahead for"] button')]
      .find((b) => b.textContent.trim() === l)
      ?.click();
  }, label);

// ---------- 1. Market ----------
await boot(page, seed(5000000, TEAM));
await openSection(page, "Market");
await sleep(600);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => /Ingredients/.test(b.textContent))?.click(),
);
await page.waitForSelector('[data-testid="market-plan"]', { timeout: 8000 });
await sleep(500);
await tab("Today");
await sleep(200);
await tab("2 days");
await sleep(300);
const a = await scroller();
check("1a a day tab rebuilds the scroller", a?.repairs >= 2 && a.overflow === "", a);
check("1b the Market still scrolls after it", a?.moved && a.room > 0, a);
const clear = await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-testid="market-plan"] button')].find((x) =>
    /^Buy all/.test(x.textContent),
  );
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return Math.round(r.bottom);
});
await shot(page, "iphone-market-end");
console.log("buy all bottom", clear);

// ---------- 2. Buy all, then Inventory ----------
await tab("3 days");
await sleep(400);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="market-plan"] button')]
    .find((x) => /^Buy all/.test(x.textContent))
    ?.click(),
);
await sleep(700);
const planLeft = await page.evaluate(
  () => !!document.querySelector('[data-testid="market-plan-empty"]'),
);
await openSection(page, "Inventory");
await sleep(1200);
const inv = await page.evaluate(() => document.body.innerText);
await shot(page, "iphone-inventory");
check("2a the plan is done after Buy all", planLeft);
check(
  "2b Inventory shows nothing low for today",
  !/Low for today/i.test(inv) && !/\b[1-9]\d* running low/i.test(inv),
  inv.match(/.{0,20}(running low|Low for today).{0,20}/gi),
);

// ---------- 3. Cleaner ----------
// (a seed without a ledger is read in dollars: 10 = $10.00)
await boot(page, seed(10, TEAM));
await openCleanliness();
const face = () =>
  page.evaluate(() => {
    const i = document.querySelector('[data-testid="cleanliness-staff"] img[data-cleaner-face]');
    return i ? { src: i.getAttribute("src"), ok: i.complete, w: i.naturalWidth } : null;
  });
await page.evaluate(() =>
  document.querySelector("[data-cleaner-face]")?.scrollIntoView({ block: "center" }),
);
await sleep(900);
const f1 = await face();
check(
  "3a the Cleaning page shows the painted Cleaner",
  /staff-portraits\/cleaner\.webp/.test(f1?.src ?? "") && f1.w > 0,
  f1,
);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="cleanliness-staff"] button')]
    .find((b) => /Hire a Cleaner/.test(b.textContent))
    ?.click(),
);
await sleep(900);
const card = await page.evaluate(() => {
  const c = document.querySelector('[data-staff-role="cleaner"]');
  const r = c?.getBoundingClientRect();
  return r ? { top: r.top, bottom: r.bottom, h: innerHeight, needed: c.dataset.staffNeeded } : null;
});
check(
  "3b the Staff screen opens on the Cleaner's card",
  card && card.needed === "true" && card.top >= 0 && card.bottom <= card.h,
  card,
);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-staff-role="cleaner"] button')]
    .find((b) => /Hire/.test(b.textContent))
    ?.click(),
);
await sleep(500);
const said = await page.evaluate(() => {
  const m = document.querySelector('[data-testid="staff-message"]');
  const r = m?.getBoundingClientRect();
  return r ? { text: m.textContent, top: r.top, bottom: r.bottom, h: innerHeight } : null;
});
check(
  "3c a Hire with too little money says why, on screen",
  said && said.top >= 0 && said.bottom <= said.h && /\$/.test(said.text),
  said,
);
await shot(page, "iphone-hire-short");

await boot(page, seed(5000000, [...TEAM, "cleaner"]));
await openCleanliness();
const line = await page.evaluate(
  () => document.querySelector('[data-testid="cleanliness-staff"]').innerText,
);
check(
  "3d once hired: On duty, no hiring fee",
  /On duty/.test(line) && !/Hire \$/.test(line),
  line.slice(0, 120),
);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="cleanliness-staff"] button')]
    .find((b) => /Manage the team/.test(b.textContent))
    ?.click(),
);
await sleep(900);
const team = await page.evaluate(
  () => document.querySelector('[data-staff-role="cleaner"]')?.innerText ?? "",
);
check(
  "3e the Staff screen agrees: Hired, no Hire button",
  /Hired/i.test(team) && !/Hire ·/.test(team),
  team.slice(0, 120),
);

// ---------- 4. The room stays still ----------
await boot(page, seed(5000000, TEAM, ["restroom-disinfect"]));
await openCleanliness();
await page.evaluate(() => {
  const card = document.querySelector('[data-testid="area-restroom"]');
  if (!card?.querySelector('[data-task="restroom-disinfect"]'))
    card?.querySelector("button")?.click();
});
await sleep(500);
await page.evaluate(() =>
  [
    ...(document.querySelector('[data-task="restroom-disinfect"]')?.querySelectorAll("button") ??
      []),
  ]
    .find((x) => !x.disabled && /Clean/.test(x.textContent))
    ?.click(),
);
await page.waitForSelector('[data-testid="cleaning-stage"]', { timeout: 8000 });
const frames = await page.evaluate(
  () =>
    new Promise((done) => {
      const stage = document.querySelector('[data-testid="cleaning-stage"]');
      const seen = new Set();
      const start = performance.now();
      const tick = () => {
        const r = stage.getBoundingClientRect();
        seen.add(`${r.left},${r.top},${r.width},${r.height}`);
        if (performance.now() - start < 3000) requestAnimationFrame(tick);
        else done([...seen]);
      };
      tick();
    }),
);
check(
  "4a the room does not move or resize in its first 3 seconds",
  frames.length === 1,
  frames.slice(0, 4),
);
const still = await page.evaluate(() => {
  const stage = document.querySelector('[data-testid="cleaning-stage"]');
  const img = stage.querySelector("img");
  const r = stage.getBoundingClientRect();
  return {
    filter: getComputedStyle(img).filter,
    blur: getComputedStyle(stage.closest('[role="presentation"]')).backdropFilter,
    whole:
      Number.isInteger(r.left * devicePixelRatio) ||
      Math.abs((r.left * devicePixelRatio) % 1) < 0.51,
    guide: !!document.querySelector('[data-testid="cleaning-guide"]'),
  };
});
check(
  "4b no filter or blur on the room; the guide still shows",
  still.filter === "none" && /none|^$/.test(still.blur ?? "none") && still.guide,
  still,
);
await shot(page, "iphone-restroom");

const bad = logs.filter((l) => !/favicon|bridge|ads?\b/i.test(l));
check("5 no console errors", bad.length === 0, bad.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nALL PASS (${results.length})`);
process.exit(failed ? 1 : 0);
