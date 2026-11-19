// PHONE AUDIT (developer 2026-11-18: "optimize the game for mobile and mobile landscape orientation"), restaurant build, real browser.
// Visits every screen a player reaches (the Kitchen, the Mini-games sheet and all eight games, the Market, the restaurant map, Business, Inventory,
// Progress, Settings) at nine phone sizes (four upright, five on their side) and MEASURES, never assuming:
//   - sideways scroll (the page is wider than the window)
//   - a button / control that is cut off or outside the window and cannot be scrolled to (no scrollable parent holds it)
//   - a control smaller than 48 px (CLAUDE.md section 10)
//   - text below 8.5 px (CLAUDE.md section 10)
//   - a screen whose own content is taller than the window with no way to scroll (a button below the fold that no swipe reaches)
// It prints one line per (screen, problem) with the sizes it happens at; with `--json` it prints the raw findings. Exit 1 when anything is found.
// Screenshots of every screen at 844x390 and 390x844: out/phone-<screen>-<w>x<h>.png (with `--shots`).
// Run: npm run build; npx vite preview --port 4173 (another terminal); KC_OFFLINE_BRIDGE=1 node tools/e2e/phoneaudit.mjs [--shots] [--only=car-park,market]
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  openSection,
} from "./harness.mjs";

const VIEWPORTS = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [568, 320],
  [640, 360],
  [740, 360],
  [844, 390],
  [932, 430],
];
// --sizes=1280x720,800x800 audits other window shapes (desktop, tablet, square) instead of the nine phone sizes (2026-11-19: the game now fills every window).
const SIZES = (process.argv.find((a) => a.startsWith("--sizes=")) ?? "").slice(8);
if (SIZES)
  VIEWPORTS.splice(0, VIEWPORTS.length, ...SIZES.split(",").map((s) => s.split("x").map(Number)));
const SHOTS = process.argv.includes("--shots");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "")
  .slice(7)
  .split(",")
  .filter(Boolean);

const CRATE = ["tomato", "carrot", "lettuce", "apple", "onion", "basil"];
const COUNTS = { tomato: 2, carrot: 2, lettuce: 1, apple: 1, onion: 1, basil: 1 };
const STOCK = Object.fromEntries(
  [...CRATE, "potato"].map((id) => [
    id,
    { ingredientId: id, quantity: 4, unitCost: 100, purchaseDay: 1 },
  ]),
);
const SEEN = [
  "shop",
  "inventory",
  "rack",
  "business",
  "staff",
  "equipment",
  "second-floor",
  "restaurant",
  "menu",
  "progress",
];
const saveAt = (n, business = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: PAIGE_QUIET,
      sectionsSeen: SEEN,
      inventory: STOCK,
      fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 },
      stockroomSort: {
        crate: [
          { id: "tongs", sets: 1 },
          { id: "ladles", sets: 1 },
          { id: "whisks", sets: 1 },
        ],
        seed: 1,
      },
      ...business,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const click = (page, sel) =>
  page.evaluate((s) => !!document.querySelector(s)?.click() || !!document.querySelector(s), sel);
const fromSheet = (id) => async (page) => {
  await click(page, '[data-testid="minigames-shortcut"]');
  await sleep(700);
  await click(page, `[data-testid="minigame-${id}"]`);
  await sleep(1400);
};

// name, the save to start from, what to do after the Kitchen is up
const SCREENS = [
  ["kitchen", () => saveAt(40), async () => {}],
  [
    "sheet",
    () => saveAt(40),
    async (p) => {
      await click(p, '[data-testid="minigames-shortcut"]');
      await sleep(900);
    },
  ],
  ["inspection", () => saveAt(40), fromSheet("inspection")],
  [
    "fridge-sort",
    () => saveAt(40, { deliveryInspection: { seed: 1, inspected: 99, howto: 1 } }),
    fromSheet("fridge-sort"),
  ],
  ["sauce", () => saveAt(40), fromSheet("sauce")],
  ["stockroom", () => saveAt(40), fromSheet("stockroom")],
  ["fridge-check", () => saveAt(40), fromSheet("fridge-check")],
  ["car-park", () => saveAt(40), fromSheet("car-park")],
  ["dessert-run", () => saveAt(40), fromSheet("dessert-run")],
  ["kitchen-dispatch", () => saveAt(40), fromSheet("kitchen-dispatch")],
  [
    "market",
    () => saveAt(40),
    async (p) => {
      await openSection(p, "Market");
      await sleep(1200);
    },
  ],
  [
    "restaurant-map",
    () => saveAt(40),
    async (p) => {
      await click(p, '[data-nav="restaurant-map"]');
      await sleep(1500);
    },
  ],
  [
    "business",
    () => saveAt(40),
    async (p) => {
      await openSection(p, "Business");
      await sleep(1200);
    },
  ],
  [
    "inventory",
    () => saveAt(40),
    async (p) => {
      await openSection(p, "Inventory");
      await sleep(1200);
    },
  ],
  [
    "progress",
    () => saveAt(40),
    async (p) => {
      await openSection(p, "Progress");
      await sleep(1200);
    },
  ],
  [
    "settings",
    () => saveAt(40),
    async (p) => {
      await click(p, '[aria-label="Settings"]');
      await sleep(900);
    },
  ],
].filter(([name]) => !ONLY.length || ONLY.includes(name));

/** Runs inside the page. Returns what is wrong on the screen as it is now. */
function measure() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const out = { sideways: [], cutoff: [], small: [], tiny: [], stuck: [] };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05)
      return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (
        s.display === "none" ||
        s.visibility === "hidden" ||
        Number(s.opacity) < 0.05 ||
        e.getAttribute("aria-hidden") === "true"
      )
        return false;
    }
    return true;
  };
  const name = (el) => {
    const t =
      el.getAttribute("data-testid") ||
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}[${t}]`;
  };
  const scrollParent = (el) => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2) return e;
      if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2) return e;
    }
    return null;
  };
  const clippedBy = (el, r) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(hidden|clip)/.test(s.overflowX + s.overflowY)) {
        const p = e.getBoundingClientRect();
        if (
          r.right < p.left - 1 ||
          r.left > p.right + 1 ||
          r.bottom < p.top - 1 ||
          r.top > p.bottom + 1
        )
          return true; // wholly outside its clip
        if (
          (r.left < p.left - 3 ||
            r.right > p.right + 3 ||
            r.top < p.top - 3 ||
            r.bottom > p.bottom + 3) &&
          !scrollParent(el)
        )
          return e;
      }
    }
    return false;
  };
  if (document.documentElement.scrollWidth > W + 1)
    out.sideways.push(`page ${document.documentElement.scrollWidth}px > ${W}px`);
  if (document.body.scrollWidth > W + 1)
    out.sideways.push(`body ${document.body.scrollWidth}px > ${W}px`);

  // a "turn your phone upright" card (Unload the Van, Dessert Run on a phone on its side) covers the game: it is the screen the player sees
  const scope = document.querySelector('[data-testid$="-upright"]') ?? document.body;
  const controls = [
    ...scope.querySelectorAll(
      'button, a[href], [role="button"], input, select, textarea, [role="switch"], [role="tab"]',
    ),
  ].filter(visible);
  for (const el of controls) {
    if (getComputedStyle(el).pointerEvents === "none" || el.disabled) continue;
    const r = el.getBoundingClientRect();
    const outside = r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2;
    if (outside && !scrollParent(el))
      out.cutoff.push({
        el: name(el),
        r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      });
    else if (!outside && clippedBy(el, r))
      out.cutoff.push({
        el: name(el),
        r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        clipped: true,
      });
    // a round or pill control that is drawn small but sits inside a 48 px hit box counts by its own box here, as the QA suites do
    if (!outside && Math.min(r.width, r.height) < 47)
      out.small.push({ el: name(el), size: `${Math.round(r.width)}x${Math.round(r.height)}` });
  }
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.nodeValue || "").trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style,svg,canvas") || !visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 8.5) out.tiny.push({ el: name(el), size: fs, text: t.slice(0, 24) });
  }
  // the screen itself: taller than the window, and nothing on it scrolls
  const root = document.scrollingElement;
  const anyScroller = [...document.querySelectorAll("*")].some((e) => {
    const s = getComputedStyle(e);
    return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4 && visible(e);
  });
  if (
    root.scrollHeight > H + 4 &&
    !anyScroller &&
    getComputedStyle(document.body).overflowY === "hidden"
  )
    out.stuck.push(`content ${root.scrollHeight}px in a ${H}px window, nothing scrolls`);
  return out;
}

/** Runs inside the page: closes how-to cards the way a player does (by DOM click, even when the button is out of reach). Returns whether any was closed. */
function dismissGuides() {
  let any = false;
  for (let i = 0; i < 8; i++) {
    const b =
      document.querySelector('[data-testid="fc-guide-skip"]') ||
      document.querySelector('[data-testid$="guide-ok"]') ||
      [...document.querySelectorAll("button")].find((x) =>
        /^(Got it|Let.s go!?|Skip|OK)$/i.test((x.textContent || "").trim()),
      );
    if (!b) break;
    b.click();
    any = true;
  }
  return any;
}

const { browser, page, logs } = await launch();
const findings = new Map(); // "screen|kind|el" -> Set(sizes)
const note = (screen, kind, el, vp, extra = "") => {
  const key = `${screen}|${kind}|${el}${extra ? " " + extra : ""}`;
  if (!findings.has(key)) findings.set(key, new Set());
  findings.get(key).add(vp);
};

for (const [name, seed, act] of SCREENS) {
  for (const [w, h] of VIEWPORTS) {
    const vp = `${w}x${h}`;
    try {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await boot(page, seed());
      await sleep(900);
      await act(page);
      await sleep(400);
      const m = await page.evaluate(measure);
      for (const s of m.sideways) note(name, "SIDEWAYS", s, vp);
      for (const c of m.cutoff) note(name, c.clipped ? "CLIPPED" : "CUT-OFF", c.el, vp);
      for (const c of m.small) note(name, "SMALL", c.el, vp, c.size);
      for (const c of m.tiny) note(name, "TINY-TEXT", c.el, vp, `${c.size}px "${c.text}"`);
      for (const s of m.stuck) note(name, "STUCK", s, vp);
      if (SHOTS && (SIZES || (w === 844 && h === 390) || (w === 390 && h === 844)))
        await shot(page, `phone-${name}-${vp}`);
      // "Play anyway" must lift the upright card and leave the game on screen
      if (await page.evaluate(() => !!document.querySelector('[data-testid$="-upright"]'))) {
        await page.evaluate(() =>
          document.querySelector('[data-testid$="-upright-anyway"]')?.click(),
        );
        await sleep(300);
        if (await page.evaluate(() => !!document.querySelector('[data-testid$="-upright"]')))
          note(name, "UPRIGHT-CARD-STUCK", "Play anyway did not lift the card", vp);
      }
      // the same screen with its how-to card closed (the board the player actually plays on)
      const closed = await page.evaluate(dismissGuides);
      if (closed) {
        await sleep(700);
        const m2 = await page.evaluate(measure);
        const play = `${name}/play`;
        for (const s of m2.sideways) note(play, "SIDEWAYS", s, vp);
        for (const c of m2.cutoff) note(play, c.clipped ? "CLIPPED" : "CUT-OFF", c.el, vp);
        for (const c of m2.small) note(play, "SMALL", c.el, vp, c.size);
        for (const c of m2.tiny) note(play, "TINY-TEXT", c.el, vp, `${c.size}px "${c.text}"`);
        for (const s of m2.stuck) note(play, "STUCK", s, vp);
        if (SHOTS && (SIZES || (w === 844 && h === 390) || (w === 390 && h === 844)))
          await shot(page, `phone-${name}-play-${vp}`);
      }
    } catch (error) {
      note(name, "ERROR", String(error.message).slice(0, 90), vp);
    }
  }
  process.stdout.write(`  ${name} done\n`);
}
await browser.close();

const rows = [...findings.entries()].sort();
if (process.argv.includes("--json"))
  console.log(
    JSON.stringify(
      rows.map(([k, v]) => [k, [...v]]),
      null,
      1,
    ),
  );
else
  for (const [k, v] of rows) {
    const [screen, kind, el] = k.split("|");
    console.log(`${kind.padEnd(9)} ${screen.padEnd(16)} ${el}  @ ${[...v].join(" ")}`);
  }
const errors = logs.filter((l) => !/Download the React DevTools|favicon/.test(l));
if (errors.length)
  console.log(`console: ${errors.length} message(s), first: ${errors[0].slice(0, 140)}`);
console.log(rows.length ? `\nPHONE AUDIT: ${rows.length} finding(s)` : "\nPHONE AUDIT: clean");
process.exit(rows.length ? 1 : 0);
