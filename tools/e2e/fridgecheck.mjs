// Fridge Check (developer 2026-11-06), restaurant build, in a real browser: the closing-night inspection (restaurant/fridgeCheck.ts).
// The chores "Throw out spoiled food" and "Wrap and label" open a game when there is something to judge tonight.
//   T1 the chore opens the game; the how-to card shows the first night; the clock does NOT run until the first answer
//   T2 answering every card with its real verdict (the buttons) ends with 3 stars, a score and Hype; the note gives a reason per card
//   T3 money and stock never move: credits, inventory and the ledger are identical; ONLY the sort chore is done (wrap and the others stay)
//   T4 "Next: Wrap and label": a wrong tap is refused with a note (free), the right order wraps everything, the wrap chore is done
//   T5 the SWIPE path (pointer down, move, up) answers a card
//   T6 Skip from Pause does the chore with one tap: no stars, no Hype, no state
//   T7 a quiet night is topped up with training cards: the game opens (2026-11-11)
//   T8 every tier has three piles (Use next from the start)
//   T9 at 320 x 568 nothing scrolls sideways and every button is at least 48 px
//   T10 Reduced Motion: the card changes at once and the game still works
//   T11 the painted pieces all load
//   T12 a spoiled card shows its painted spoiled twin (the salmon), and a card without a twin still works
//   T13 Inventory -> the practice chip opens the same game as free play: it changes nothing and leaves the chores alone
//   T14 earned freshness pins show on the Inventory fridge door
//   T16 the how-to tour (developer 2026-11-07): 4 pages with the game's own pictures (fresh / going off / spoiled cards, the spoiled twin, the days
//       rule, the swipes); "Got it" saves it as seen, and the ? button brings it back
//   T17 a player who has seen the sort tour gets none for Sort, and the Wrap stage has its own 3-page tour
//   T18 from tier 4 (Level 50) the days are hidden on the cards, so the tour says to trust the picture and shows the shelf-life list
//   T19 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  shot,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const DAY = 40;
// Tomorrow is 41. Salmon (3 days) is expired, cheddar and tomato are near expiry, the rest are fine.
const NIGHT = [
  ["salmon", 38],
  ["basil", 39],
  ["cheddar", 38],
  ["bread", 40],
  ["apple", 41],
  ["tomato", 35],
  ["garlic", 30],
];
const QUIET = [
  ["bread", 40],
  ["apple", 41],
  ["garlic", 41],
  ["tomato", 41],
];
const inventoryOf = (lines) =>
  Object.fromEntries(
    lines.map(([id, bought]) => [
      id,
      { ingredientId: id, quantity: 2, unitCost: 300, purchaseDay: bought },
    ]),
  );
const tasks = [
  { kind: "spoiled-out", count: 1, since: 1 },
  { kind: "wrap-fridge", count: 1, since: 1 },
  { kind: "wipe-boards", count: 1, since: 1 },
];
// With campaignVersion 3 the seed's level number IS the game level (restaurantLevelOf).
const saveAt = (n, { lines = NIGHT, reducedMotion = false, staff } = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      calendar: { businessDay: DAY },
      inventory: inventoryOf(lines),
      ...(staff ? { staff: { hiredRoles: staff } } : {}),
      cleanliness: {
        tasks,
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: ["kitchen", "dining", "restroom"],
        introSeen: true,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion, restaurantName: "Test Kitchen" },
  });

const { browser, page, logs } = await launch();

const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const click = async (sel, wait = 260) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(wait);
};
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
const attr = (sel, a) =>
  page.evaluate((s, n) => document.querySelector(s)?.getAttribute(n) ?? null, sel, a);

// The Restaurant tab opens the map; its Manager / Office hotspot holds the section tabs (as restaurantcleanliness.mjs).
async function openCleanliness() {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await page
    .waitForSelector('nav[aria-label="Business sections"]', { timeout: 4000 })
    .catch(() => null);
  await sleep(400);
  await page.evaluate(() => {
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Cleanliness"))
      ?.click();
  });
  await sleep(800);
}
/** Opens the Kitchen card's tasks and taps the chore's Clean button. */
async function tapChore(kind) {
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="area-kitchen"]') ?? document;
    const open = [...document.querySelectorAll("button")].find((b) =>
      /View \d+ cleaning tasks?/.test(b.textContent),
    );
    if (!document.querySelector('[data-testid="area-details-kitchen"]')) open?.click();
    void card;
  });
  await sleep(400);
  await page.evaluate((k) => {
    document.querySelector(`[data-task="${k}"] button`)?.click();
  }, kind);
  await sleep(500);
}

/** Answers every card with its real verdict through the buttons; returns how many answers and the notes. */
async function answerAll() {
  const notes = [];
  // up to 18 cards a night since 2026-11-12 (12 before)
  for (let i = 0; i < 40; i++) {
    const v = await attr('[data-testid="fc-card"]', "data-verdict");
    if (!v) break;
    await click(`[data-testid="fc-${v === "use-first" ? "first" : v}"]`, 300);
    notes.push(await text('[data-testid="fc-note"]'));
    if (await q('[data-testid="fc-result"]')) break;
    await sleep(120);
  }
  return notes;
}

const strip = (s) => ({
  credits: s.credits,
  inventory: s.business.inventory,
  supplies: s.business.supplies,
  ledger: s.economyLedger,
});

try {
  // ---- T1 – T3: the sort stage ----
  await boot(page, saveAt(40));
  await openCleanliness();
  const before = await readSave(page);
  await tapChore("spoiled-out");
  const opened = await q('[data-testid="fridge-check"]');
  const stage = await attr('[data-testid="fridge-check"]', "data-stage");
  const total = Number(await attr('[data-testid="fridge-check"]', "data-total"));
  const guide = await q('[data-testid="fc-guide"]');
  await shot(page, "fridgecheck-guide");
  await click('[data-testid="fc-guide-skip"]');
  const clock0 = await text('[data-testid="fc-timer"]');
  await sleep(1300);
  const clock1 = await text('[data-testid="fc-timer"]');
  await shot(page, "fridgecheck-sort");
  check(
    "T1 the chore opens the sort game; the how-to card shows the first night; the clock waits for the first answer",
    opened && stage === "sort" && total >= 3 && guide && clock0 === clock1,
    { opened, stage, total, guide, clock0, clock1 },
  );
  const notes = await answerAll();
  await sleep(500);
  const done = await q('[data-testid="fc-result"]');
  const stars = Number(await attr('[data-testid="fc-result"]', "data-stars"));
  const reward = await text('[data-testid="fc-reward"]');
  await shot(page, "fridgecheck-result");
  check(
    "T2 answering every card right ends with 3 stars, a score and Hype; each card gave a reason",
    done &&
      stars === 3 &&
      /Hype/.test(reward ?? "") &&
      notes.length === total &&
      notes.every((n) => /^✓ .*shelf life/.test(n ?? "")),
    { done, stars, reward, total, notes },
  );
  const after = await readSave(page);
  const left = (after.business.cleanliness?.tasks ?? []).map((t) => t.kind).sort();
  check(
    "T3 money and stock never move, ONLY the sort chore is done, and the stars are kept",
    JSON.stringify(strip(after)) === JSON.stringify(strip(before)) &&
      left.join() === "wipe-boards,wrap-fridge" &&
      after.business.fridgeCheck?.perfect === 1 &&
      after.business.fridgeCheck?.rounds === 1,
    { left, fridgeCheck: after.business.fridgeCheck },
  );

  // ---- T4: the wrap stage ----
  await click('[data-testid="fc-next"]', 500);
  const wrapOpen = (await attr('[data-testid="fridge-check"]', "data-stage")) === "wrap";
  const items = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="fc-item-"]')].map((b) => ({
      id: b.getAttribute("data-testid").slice(8),
      exp: Number(b.getAttribute("data-expires")),
    })),
  );
  await click('[data-testid="fc-guide-skip"]');
  const ordered = [...items].sort((a, b) => a.exp - b.exp);
  const wrongOne = ordered.at(-1);
  await click(`[data-testid="fc-item-${wrongOne.id}"]`);
  const refused = await attr(`[data-testid="fc-item-${wrongOne.id}"]`, "data-wrapped");
  const refusal = await text('[data-testid="fc-note"]');
  for (const it of ordered) await click(`[data-testid="fc-item-${it.id}"]`, 200);
  await sleep(500);
  const wrapDone = await q('[data-testid="fc-result"]');
  const wrapStars = Number(await attr('[data-testid="fc-result"]', "data-stars"));
  await shot(page, "fridgecheck-wrap");
  await click('[data-testid="fc-done"]');
  const after2 = await readSave(page);
  const left2 = (after2.business.cleanliness?.tasks ?? []).map((t) => t.kind).sort();
  check(
    "T4 Wrap and label: a wrong tap is refused with a note, the right order wraps everything, and the wrap chore is done",
    wrapOpen &&
      items.length >= 3 &&
      refused === "0" &&
      /goes off sooner/.test(refusal ?? "") &&
      wrapDone &&
      wrapStars >= 1 &&
      left2.join() === "wipe-boards" &&
      JSON.stringify(strip(after2)) === JSON.stringify(strip(before)),
    { wrapOpen, items, refused, refusal, wrapDone, wrapStars, left2 },
  );

  // ---- T5: the swipe ----
  await boot(page, saveAt(40));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-skip"]');
  const verdict = await attr('[data-testid="fc-card"]', "data-verdict");
  const c = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="fc-swipe"]')?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y, { steps: 4 });
  const keepStamp = await page.evaluate(() =>
    Number(getComputedStyle(document.querySelector('[data-testid="fc-stamp-keep"]')).opacity),
  );
  await page.mouse.move(c.x + 160, c.y, { steps: 6 });
  await page.mouse.up();
  await sleep(500);
  const answered = Number(await attr('[data-testid="fridge-check"]', "data-answered"));
  const noteTone = await attr('[data-testid="fc-note"]', "data-tone");
  check(
    "T5 swiping a card right answers Keep (the stamp fades in on the way, the note says right or wrong)",
    answered === 1 && keepStamp > 0.3 && noteTone === (verdict === "keep" ? "good" : "bad"),
    { answered, keepStamp, verdict, noteTone },
  );

  // ---- T6: skip ----
  await click('[data-testid="fc-pause"]');
  const paused = await q('[data-testid="fc-paused"]');
  await click('[data-testid="fc-skip"]', 500);
  const skipped = await readSave(page);
  check(
    "T6 Skip from Pause does the chore with one tap: no stars, no Hype state, the game closes",
    paused &&
      !(await q('[data-testid="fridge-check"]')) &&
      !(skipped.business.cleanliness?.tasks ?? []).some((t) => t.kind === "spoiled-out") &&
      (skipped.business.fridgeCheck?.rounds ?? 0) === 0,
    { fridgeCheck: skipped.business.fridgeCheck },
  );

  // ---- T7: a quiet night ----
  await boot(page, saveAt(40, { lines: QUIET }));
  await openCleanliness();
  await tapChore("spoiled-out");
  const quietOpen = await q('[data-testid="fridge-check"]');
  const quietSave = await readSave(page);
  check(
    "T7 a quiet night is topped up with training cards (2026-11-11): the game opens and the chore waits until it is played (no one-tap fallback)",
    quietOpen &&
      (quietSave.business.cleanliness?.tasks ?? []).some((t) => t.kind === "spoiled-out"),
    { quietOpen },
  );

  // ---- T8: piles by tier ----
  await boot(page, saveAt(20));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-skip"]');
  const piles1 = await page.evaluate(() => ({
    first: !!document.querySelector('[data-testid="fc-first"]'),
    bin: !!document.querySelector('[data-testid="fc-bin"]'),
    keep: !!document.querySelector('[data-testid="fc-keep"]'),
    tier: document.querySelector('[data-testid="fridge-check"]')?.getAttribute("data-tier"),
  }));
  await boot(page, saveAt(40));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-skip"]');
  const piles3 = await page.evaluate(() => ({
    first: !!document.querySelector('[data-testid="fc-first"]'),
    tier: document.querySelector('[data-testid="fridge-check"]')?.getAttribute("data-tier"),
  }));
  check(
    "T8 every tier has three piles, Use next from the start (2026-11-11; the 91-level campaign puts Level 20 in tier 2 and Level 40 in tier 4)",
    piles1.bin &&
      piles1.keep &&
      piles1.first &&
      piles1.tier === "2" &&
      piles3.first &&
      piles3.tier === "4",
    { piles1, piles3 },
  );

  // ---- T9: 320 x 568 ----
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(500);
  const small = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="fridge-check"]');
    const btns = [...document.querySelectorAll('[data-testid^="fc-"]')]
      .filter(
        (b) =>
          b.tagName === "BUTTON" &&
          ["fc-bin", "fc-first", "fc-keep", "fc-pause"].includes(b.getAttribute("data-testid")),
      )
      .map((b) => {
        const r = b.getBoundingClientRect();
        return {
          id: b.getAttribute("data-testid"),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bottom: Math.round(r.bottom),
        };
      });
    const card = document.querySelector('[data-testid="fc-card"]')?.getBoundingClientRect();
    return {
      sideways:
        document.documentElement.scrollWidth > window.innerWidth + 1 ||
        (root?.scrollWidth ?? 0) > (root?.clientWidth ?? 0) + 1,
      btns,
      card: card
        ? {
            w: Math.round(card.width),
            h: Math.round(card.height),
            top: Math.round(card.top),
            bottom: Math.round(card.bottom),
          }
        : null,
    };
  });
  await shot(page, "fridgecheck-320");
  check(
    "T9 at 320 x 568 nothing scrolls sideways, every button is at least 48 px and the card fits above the piles",
    !small.sideways &&
      small.btns.length >= 3 &&
      small.btns.every((b) => b.w >= 48 && b.h >= 48 && b.bottom <= 568) &&
      small.card &&
      small.card.h >= 200,
    small,
  );
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });

  // ---- T10: Reduced Motion ----
  await boot(page, saveAt(40, { reducedMotion: true }));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-skip"]');
  const idBefore = await attr('[data-testid="fc-card"]', "data-id");
  const v0 = await attr('[data-testid="fc-card"]', "data-verdict");
  await click(`[data-testid="fc-${v0 === "use-first" ? "first" : v0}"]`, 120);
  const idAfter = await attr('[data-testid="fc-card"]', "data-id");
  check(
    "T10 Reduced Motion: the next card appears at once and the game still works",
    !!idBefore && !!idAfter && idBefore !== idAfter,
    { idBefore, idAfter },
  );

  // ---- T11: the painted pieces load ----
  await boot(page, saveAt(40));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-skip"]');
  await sleep(600);
  const art = await page.evaluate(() =>
    [...document.querySelectorAll("img[data-fc-art]")].map((i) => ({
      n: i.getAttribute("data-fc-art"),
      ok: i.complete && i.naturalWidth > 0,
    })),
  );
  const names = art.map((a) => a.n);
  check(
    "T11 the painted pieces (backdrop, card, stamps, bin, flag, icons) all load",
    art.length >= 6 &&
      art.every((a) => a.ok) &&
      ["card", "stamp-keep", "bin-closed", "flag"].every((n) => names.includes(n)),
    art.filter((a) => !a.ok),
  );

  // ---- T12: the spoiled twin on the expired card ----
  await boot(page, saveAt(40));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-skip"]');
  let twin = null;
  for (let i = 0; i < 14; i++) {
    const id = await attr('[data-testid="fc-card"]', "data-id");
    if (id === "salmon") {
      await sleep(400);
      twin = await page.evaluate(() => {
        const t = document.querySelector('img[data-fc-twin="salmon"]');
        return t ? { ok: t.complete && t.naturalWidth > 0 } : null;
      });
      await shot(page, "fridgecheck-twin");
      break;
    }
    const v = await attr('[data-testid="fc-card"]', "data-verdict");
    if (!v) break;
    await click(`[data-testid="fc-${v === "use-first" ? "first" : v}"]`, 300);
  }
  check("T12 the expired salmon card shows its painted spoiled twin", !!twin && twin.ok, twin);

  // ---- T13: the practice entry in Inventory ----
  await boot(page, saveAt(40));
  await openShortcut(page, "inventory");
  const chip = await q('[data-testid="fridge-check-chip"]');
  const beforePractice = await readSave(page);
  await click('[data-testid="fridge-check-chip"]', 600);
  const prOpen = await q('[data-testid="fridge-check"]');
  const prFlag = await attr('[data-testid="fridge-check"]', "data-practice");
  await click('[data-testid="fc-guide-skip"]').catch(() => null);
  await answerAll();
  await sleep(400);
  const prDone = await q('[data-testid="fc-result"]');
  const prReward = await text('[data-testid="fc-reward"]');
  const prNext = await q('[data-testid="fc-next"]');
  await click('[data-testid="fc-done"]', 600);
  const afterPractice = await readSave(page);
  check(
    "T13 the Inventory practice chip opens the game as free play: no reward, no Next, nothing changes, chores stay",
    chip &&
      prOpen &&
      prFlag === "1" &&
      prDone &&
      prReward === null &&
      !prNext &&
      JSON.stringify(strip(afterPractice)) === JSON.stringify(strip(beforePractice)) &&
      JSON.stringify(afterPractice.business.cleanliness) ===
        JSON.stringify(beforePractice.business.cleanliness) &&
      // Rule changed (developer 2026-11-07): closing the how-to tour for the first time is saved as seen, in practice too (the state is then
      // written out with zeros); practice earns nothing: every other number stays 0.
      Object.entries(afterPractice.business.fridgeCheck ?? {}).every(
        ([k, v]) => k === "howto" || !v,
      ) &&
      afterPractice.business.fridgeCheck?.howto === 1,
    { chip, prOpen, prFlag, prDone, prReward, prNext },
  );

  // ---- T14: freshness pins on the fridge door ----
  const pinSave = saveAt(40);
  pinSave.business.fridgeCheck = { perfect: 7 };
  await boot(page, pinSave);
  await openShortcut(page, "inventory");
  const pins = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="fridge-magnets"]');
    return m
      ? {
          n: Number(m.getAttribute("data-pins")),
          imgs: m.querySelectorAll("img[data-fridge-pin]").length,
        }
      : null;
  });
  check(
    "T14 7 three-star stages = 2 freshness pins on the Inventory fridge door",
    pins?.n === 2 && pins.imgs === 2,
    pins,
  );

  // ---- T16: the how-to tour ----
  await boot(page, saveAt(40));
  await openCleanliness();
  await tapChore("spoiled-out");
  const tour = async () =>
    page.evaluate(() => {
      const g = document.querySelector('[data-testid="fc-guide"]');
      if (!g) return null;
      const cards = [...g.querySelectorAll('[data-testid="fc-card"]')].map((c) =>
        c.getAttribute("data-state"),
      );
      const twin = g.querySelector("img[data-fc-twin]");
      return {
        page: Number(g.getAttribute("data-page")),
        pages: Number(g.getAttribute("data-pages")),
        cards,
        twin: !!twin && twin.complete && twin.naturalWidth > 0,
        text: g.textContent.replace(/\s+/g, " "),
      };
    });
  const p1 = await tour();
  await shot(page, "fridgecheck-tour-1");
  await click('[data-testid="fc-guide-next"]', 400);
  // the spoiled example must show its painted picture (wait for it, as a player would)
  await page
    .waitForFunction(
      () => {
        const t = document.querySelector('[data-testid="fc-guide"] img[data-fc-twin]');
        return !!t && t.complete && t.naturalWidth > 0;
      },
      { timeout: 4000 },
    )
    .catch(() => null);
  const p2 = await tour();
  await shot(page, "fridgecheck-tour-2");
  await click('[data-testid="fc-guide-next"]', 400);
  const p3 = await tour();
  await shot(page, "fridgecheck-tour-3");
  await click('[data-testid="fc-guide-next"]', 400);
  const p4 = await tour();
  await shot(page, "fridgecheck-tour-4");
  const hasOk = await q('[data-testid="fc-guide-ok"]');
  await click('[data-testid="fc-guide-ok"]', 500);
  const gone = !(await q('[data-testid="fc-guide"]'));
  const seen = (await readSave(page)).business.fridgeCheck?.howto;
  await click('[data-testid="fc-help"]', 400);
  const again = (await tour())?.page;
  check(
    "T16 the tour: 4 pages; page 2 shows a fresh, a going-off and a spoiled card with the spoiled twin; page 3 counts the days; Got it saves it; ? brings it back",
    p1?.pages === 4 &&
      p1.page === 1 &&
      /Fresh or spoiled/.test(p1.text) &&
      p2?.cards.join() === "FRESH,NEAR_EXPIRY,EXPIRED" &&
      p2.twin &&
      /Spoiled/.test(p2.text) &&
      /6 \+ 1 = 7/.test(p3?.text ?? "") &&
      /Shelf life/.test(p3?.text ?? "") &&
      /Swipe/.test(p4?.text ?? "") &&
      hasOk &&
      gone &&
      seen === 1 &&
      again === 1,
    { p1, p2, p3: p3?.text.slice(0, 160), p4: p4?.text.slice(0, 100), gone, seen, again },
  );

  // ---- T17: seen once = not shown again; Wrap has its own tour ----
  const seenSave = saveAt(40);
  seenSave.business.fridgeCheck = { howto: 1 };
  await boot(page, seenSave);
  await openCleanliness();
  await tapChore("spoiled-out");
  const noTour = !(await q('[data-testid="fc-guide"]'));
  await answerAll();
  await sleep(500);
  await click('[data-testid="fc-next"]', 600);
  const w1 = await tour();
  await shot(page, "fridgecheck-tour-wrap");
  await click('[data-testid="fc-guide-next"]', 400);
  const w2 = await tour();
  await click('[data-testid="fc-guide-next"]', 400);
  const w3 = await tour();
  await click('[data-testid="fc-guide-ok"]', 500);
  const seenWrap = (await readSave(page)).business.fridgeCheck?.howto;
  check(
    "T17 after the sort tour was seen none shows for Sort; Wrap has its own 3-page tour that is saved as seen too",
    noTour &&
      w1?.pages === 3 &&
      /Wrap and label/.test(w1.text) &&
      /fewest days/.test(w2?.text ?? "") &&
      /Stars and Hype/.test(w3?.text ?? "") &&
      seenWrap === 3,
    { noTour, w1: w1?.text.slice(0, 80), w2: w2?.text.slice(0, 120), seenWrap },
  );

  // ---- T18: the days are hidden from tier 4 ----
  await boot(page, saveAt(50));
  await openCleanliness();
  await tapChore("spoiled-out");
  await click('[data-testid="fc-guide-next"]', 400);
  await click('[data-testid="fc-guide-next"]', 400);
  const hid = await tour();
  check(
    "T18 at Level 50 the days are hidden on the cards, so the tour says to trust the picture and lists the shelf lives",
    /Later nights hide the days/.test(hid?.text ?? "") && /vegetables 7/.test(hid?.text ?? ""),
    hid?.text.slice(0, 220),
  );

  // ---- T19: no console errors ----
  const bad = logs.filter(
    (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
  );
  check("T19 no console errors", bad.length === 0, bad.slice(0, 5));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? "\nFRIDGE CHECK E2E: ALL PASS"
    : `\nFRIDGE CHECK E2E: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
