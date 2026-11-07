// Stockroom Sort (developer 2026-11-06), restaurant build, in a real browser: the "Stock the shelves" mini-game (business/stockroomSort.ts).
// A supply purchase becomes SETS of 3 identical goods on wooden cubbies; the player moves them until 3 alike stand together.
//   T1 below Level 6 there is no chip; from Level 6 a crate of bought supplies shows "Stock the shelves · 3" in Inventory -> Supplies
//   T2 the chip opens the game: the how-to card shows the first time, the clock does NOT run until the first move; 3 sets = 9 goods, cubbies, a slip
//   T3 the hint button shows a move and playing the hinted moves (tap piece, tap cubby) stocks everything: stars, a score, Hype added, crate gone
//   T4 the DRAG path (pointer down, move, up on the cubby) moves a piece too
//   T5 money and stock never move: credits, supplies, inventory and the ledger are identical before and after
//   T6 Done returns to Supplies and the chip is gone
//   T7 a purchase in the Market puts what was bought on the crate and the chip shows it
//   T8 Skip (from Pause) leaves the crate waiting; the Prep Cook button clears it with no Hype and no stars
//   T9 Reduced Motion: no floating-score animation; the board still works
//   T10 at 320 x 568 nothing scrolls sideways and every cubby and piece is at least 48 px
//   T11 no console errors
//   T12 the painted pieces (goods, cubby, shelf, ribbons, badges) all load
//   T13 Level 50: a board has a hidden row (dark shapes) and no hint button; Level 80 has a locked cubby and wrapped parcels
//   T14 a delivery of 7 sets at Level 20 is 2 boards: the run is shown, and the whole delivery adds bonus Hype
//   T15 Undo takes a move back
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

const CRATE = [
  { id: "tongs", sets: 1 },
  { id: "ladles", sets: 1 },
  { id: "whisks", sets: 1 },
];
// With campaignVersion 3 the seed's level number IS the game level (restaurantLevelOf).
const saveAt = (n, extra = {}, business = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      stockroomSort: { crate: CRATE, seed: 1 },
      ...business,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    ...extra,
  });

const center = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, sel);
const tap = async (page, sel) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(250);
};
const dragTo = async (page, from, to) => {
  const a = await center(page, from);
  const b = await center(page, to);
  if (!a || !b) return false;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await sleep(300);
  return true;
};
const state = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="stockroom-sort"]');
    return g
      ? {
          phase: g.dataset.phase,
          sets: Number(g.dataset.sets),
          stocked: Number(g.dataset.stocked),
          cubbies: Number(g.dataset.cubbies),
          practice: g.dataset.practice,
          pieces: document.querySelectorAll("[data-piece]").length,
          timer: document.querySelector('[data-testid="stock-timer"]')?.textContent?.trim(),
        }
      : null;
  });
const openSupplies = async (page) => {
  await openShortcut(page, "inventory");
  await sleep(1200);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /^\S*\s*Supplies/.test(b.textContent?.trim() ?? ""))
      ?.click(),
  );
  await sleep(900);
};
/** Opens the game from the chip and dismisses the first-time how-to card (returns whether it was shown). */
const openGame = async (page) => {
  await tap(page, '[data-testid="stockroom-sort-chip"]');
  await sleep(900);
  const guide = await page.evaluate(() => !!document.querySelector('[data-testid="stock-guide"]'));
  if (guide) await tap(page, '[data-testid="stock-guide-ok"]');
  await sleep(200);
  return guide;
};
/** Plays the board by asking the Hint button for each move (tap the hinted piece, then the hinted cubby) until the result shows. */
const playByHints = async (page, max = 80) => {
  for (let k = 0; k < max; k++) {
    if (await page.evaluate(() => !!document.querySelector('[data-testid="stock-result"]')))
      return true;
    await tap(page, '[data-testid="stock-hint"]');
    const ok = await page.evaluate(() => {
      const p = document.querySelector('[data-hinted="1"]');
      const c = document.querySelector('[data-hint-target="1"]');
      if (!p || !c) return false;
      p.click();
      return true;
    });
    if (!ok) continue;
    await sleep(200);
    await page.evaluate(() => document.querySelector('[data-hint-target="1"]')?.click());
    await sleep(300);
  }
  return !!(await page.evaluate(() => document.querySelector('[data-testid="stock-result"]')));
};
const strip = (s) => {
  const c = structuredClone(s);
  delete c.business.stockroomSort;
  delete c.business.secondFloor;
  return JSON.stringify(c);
};

const { browser, page, logs } = await launch();
try {
  // ---- T1: closed below Level 6 (rule 2026-11-08, was 10), open from it ----
  await boot(page, saveAt(5));
  await openSupplies(page);
  const closed = await page.evaluate(
    () => !!document.querySelector('[data-testid="stockroom-sort-chip"]'),
  );
  await boot(page, saveAt(20));
  await openSupplies(page);
  const chip = await page.evaluate(
    () =>
      document.querySelector('[data-testid="stockroom-sort-chip"]')?.textContent?.trim() ?? null,
  );
  check(
    "T1 no chip at Level 5; at Level 20 the chip says Stock the shelves · 3 (the sets to stock)",
    !closed && /Stock the shelves · 3/.test(chip ?? ""),
    { closed, chip },
  );
  const before = await readSave(page);

  // ---- T2: open the game ----
  const guideShown = await openGame(page);
  const s2 = await state(page);
  await shot(page, "stockroomsort-ready");
  await sleep(1500);
  const s2b = await state(page);
  const slip = await page.evaluate(
    () => document.querySelectorAll('[data-testid="stock-slip"] [data-goods-art]').length,
  );
  check(
    "T2 the game opens with the how-to card, then ready: 3 sets = 9 goods, 5+ cubbies, a slip of 3 products, and the clock waits for the first move",
    guideShown &&
      s2?.phase === "ready" &&
      s2.sets === 3 &&
      s2.pieces === 9 &&
      s2.cubbies >= 5 &&
      slip === 3 &&
      s2.timer === s2b?.timer,
    { s2, s2b, slip },
  );

  // ---- T15: undo takes a move back (before the real play) ----
  await tap(page, '[data-testid="stock-hint"]');
  const h0 = await page.evaluate(() => {
    const p = document.querySelector('[data-hinted="1"]');
    return p ? { uid: p.dataset.uid } : null;
  });
  await page.evaluate(() => document.querySelector('[data-hinted="1"]')?.click());
  await sleep(200);
  await page.evaluate(() => document.querySelector('[data-hint-target="1"]')?.click());
  await sleep(300);
  const movedFrom = await page.evaluate((uid) => {
    const p = document.querySelector(`[data-uid="${uid}"]`);
    return p?.closest("[data-cubby]")?.getAttribute("data-cubby") ?? null;
  }, h0?.uid);
  await tap(page, '[data-testid="stock-undo"]');
  const backAt = await page.evaluate((uid) => {
    const p = document.querySelector(`[data-uid="${uid}"]`);
    return p?.closest("[data-cubby]")?.getAttribute("data-cubby") ?? null;
  }, h0?.uid);
  check(
    "T15 Undo puts the moved piece back in its cubby",
    !!h0 && backAt !== null && movedFrom !== backAt && (await state(page))?.pieces === 9,
    { h0, movedFrom, backAt },
  );

  // ---- T3: play it out by the hints ----
  const won = await playByHints(page);
  await sleep(500);
  const res = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="stock-result"]');
    return r
      ? {
          stars: Number(r.dataset.stars),
          score: document
            .querySelector('[data-testid="stock-final-score"]')
            ?.textContent?.replace(/\D/g, ""),
        }
      : null;
  });
  await shot(page, "stockroomsort-result");
  const after = await readSave(page);
  check(
    "T3 playing the hinted moves stocks every set: stars, a score, Hype added to the Second Floor, the crate is gone",
    won &&
      !!res &&
      res.stars >= 1 &&
      Number(res.score) > 0 &&
      after.business.stockroomSort?.crate === undefined &&
      after.business.secondFloor?.hype > 0,
    { res, ss: after.business.stockroomSort, hype: after.business.secondFloor?.hype },
  );
  check(
    "T5 credits, supplies, inventory and the ledger are identical before and after (only the sort state and Hype change)",
    after.credits === before.credits &&
      JSON.stringify(after.business.supplies) === JSON.stringify(before.business.supplies) &&
      JSON.stringify(after.business.inventory) === JSON.stringify(before.business.inventory) &&
      JSON.stringify(after.economyLedger) === JSON.stringify(before.economyLedger) &&
      strip(after) === strip(before),
  );

  // ---- T6: Done returns to Supplies ----
  await tap(page, '[data-testid="stock-done"]');
  await sleep(900);
  const back = await page.evaluate(() => ({
    supplies: !!document.querySelector('[data-testid="inventory-supplies"]'),
    chip: !!document.querySelector('[data-testid="stockroom-sort-chip"]'),
  }));
  check(
    "T6 Done returns to Inventory -> Supplies and the chip is gone",
    back.supplies && !back.chip,
    back,
  );

  // ---- T4: the drag path ----
  await boot(page, saveAt(20, {}, { stockroomSort: { crate: CRATE, seed: 2, rounds: 1 } }));
  await openSupplies(page);
  await openGame(page);
  await tap(page, '[data-testid="stock-hint"]');
  const hv = await page.evaluate(() => {
    const p = document.querySelector('[data-hinted="1"]');
    const c = document.querySelector('[data-hint-target="1"]');
    return p && c
      ? {
          piece: `[data-uid="${p.dataset.uid}"]`,
          cubby: `[data-cubby="${c.dataset.cubby}"]`,
          uid: p.dataset.uid,
        }
      : null;
  });
  const startedFrom = hv
    ? await page.evaluate(
        (u) => document.querySelector(u)?.closest("[data-cubby]")?.getAttribute("data-cubby"),
        hv.piece,
      )
    : null;
  const dragged = hv ? await dragTo(page, hv.piece, hv.cubby) : false;
  const endedAt = hv
    ? await page.evaluate(
        (u) =>
          document.querySelector(u)?.closest("[data-cubby]")?.getAttribute("data-cubby") ?? null,
        hv.piece,
      )
    : null;
  const s4 = await state(page);
  check(
    "T4 dragging the hinted piece onto the hinted cubby moves it (and starts the clock)",
    dragged && startedFrom !== null && endedAt !== startedFrom && s4?.phase === "playing",
    { startedFrom, endedAt, phase: s4?.phase },
  );

  // ---- T8: skip keeps the crate; the Prep Cook clears it ----
  await tap(page, '[data-testid="stock-pause"]');
  await sleep(300);
  const paused = (await state(page))?.phase;
  const t1 = await page.evaluate(
    () => document.querySelector('[data-testid="stock-timer"]')?.textContent,
  );
  await sleep(1500);
  const t2 = await page.evaluate(
    () => document.querySelector('[data-testid="stock-timer"]')?.textContent,
  );
  await tap(page, '[data-testid="stock-skip"]');
  await sleep(900);
  const skipped = await readSave(page);
  check(
    "T8a Pause freezes the clock; Skip leaves the whole crate waiting (nothing is lost, no reward)",
    paused === "paused" &&
      t1 === t2 &&
      skipped.business.stockroomSort?.crate?.length === 3 &&
      !(skipped.business.secondFloor?.hype > 0),
    { paused, t1, t2, crate: skipped.business.stockroomSort?.crate?.length },
  );
  await boot(page, saveAt(20, {}, { staff: { hiredRoles: ["prep-cook"] } }));
  await openSupplies(page);
  await openGame(page);
  const hasAuto = await page.evaluate(() => !!document.querySelector('[data-testid="stock-auto"]'));
  await tap(page, '[data-testid="stock-auto"]');
  await sleep(900);
  const auto = await readSave(page);
  check(
    "T8b the Prep Cook button clears the crate with no Hype",
    hasAuto &&
      auto.business.stockroomSort?.crate === undefined &&
      !(auto.business.secondFloor?.hype > 0),
    { hasAuto, ss: auto.business.stockroomSort },
  );

  // ---- T7: a Market purchase fills the crate ----
  await boot(page, saveAt(20, {}, { stockroomSort: undefined }));
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => /Smallwares/.test(b.textContent ?? ""))
      ?.click(),
  );
  await sleep(1200);
  const bought = await page.evaluate(() => {
    const card = document.querySelector("[data-supply]");
    const b = [...(card?.querySelectorAll("button") ?? [])].find((x) =>
      /^Buy/.test(x.textContent?.trim() ?? ""),
    );
    b?.click();
    return { id: card?.getAttribute("data-supply"), clicked: !!b };
  });
  await sleep(1200);
  const afterBuy = await readSave(page);
  const chipInMarket = await page.evaluate(
    () =>
      document.querySelector('[data-testid="stockroom-sort-chip"]')?.textContent?.trim() ?? null,
  );
  check(
    "T7 buying a supply in the Market puts a set of it on the crate (Level 10+): the chip counts the sets",
    bought.clicked &&
      afterBuy.business.stockroomSort?.crate?.some((l) => l.id === bought.id) &&
      /Stock the shelves · 1/.test(chipInMarket ?? ""),
    { bought, ss: afterBuy.business.stockroomSort, chipInMarket },
  );

  // ---- T9: Reduced Motion ----
  await boot(page, saveAt(20, { settings: { reducedMotion: true } }));
  await openSupplies(page);
  await openGame(page);
  const rm = await playByHints(page);
  const anim = await page.evaluate(
    () => document.querySelectorAll('[class*="animate-[floatUp"]').length,
  );
  check("T9 with Reduced Motion the board still works and nothing floats", rm && anim === 0, {
    rm,
    anim,
  });

  // ---- T10: 320 x 568 ----
  await boot(page, saveAt(20));
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(500);
  await openSupplies(page);
  await openGame(page);
  const small = await page.evaluate(() => {
    const els = [
      ...document.querySelectorAll("[data-piece]"),
      ...document.querySelectorAll("[data-cubby]"),
    ];
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      minH: Math.min(...els.map((e) => e.getBoundingClientRect().height)),
      minW: Math.min(
        ...[...document.querySelectorAll("[data-piece]")].map(
          (e) => e.getBoundingClientRect().width,
        ),
      ),
      count: els.length,
    };
  });
  await shot(page, "stockroomsort-320");
  check(
    "T10 at 320 x 568: no sideways scroll; pieces are at least 48 px wide and cubbies are at least 48 px tall",
    small.overflowX <= 0 && small.minH >= 48 && small.minW >= 48 && small.count >= 14,
    small,
  );
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });

  // ---- T12: the painted pieces load ----
  await boot(page, saveAt(20));
  await openSupplies(page);
  await openGame(page);
  const art = await page.evaluate(async () => {
    const imgs = [
      ...document.querySelectorAll(
        "img[data-stockroom-art], img[data-goods-art], img[data-fridge-art]",
      ),
    ];
    await Promise.all(
      imgs.map((i) =>
        i.complete
          ? null
          : new Promise((r) => {
              i.onload = i.onerror = r;
            }),
      ),
    );
    return {
      total: imgs.length,
      broken: imgs
        .filter((i) => !i.naturalWidth)
        .map((i) => i.dataset.stockroomArt ?? i.dataset.goodsArt ?? i.dataset.fridgeArt),
    };
  });
  check(
    "T12 every painted piece on screen loads (goods, cubby, shelf, HUD)",
    art.total >= 20 && art.broken.length === 0,
    art,
  );

  // ---- T13: higher tiers ----
  await boot(
    page,
    saveAt(
      50,
      {},
      {
        stockroomSort: {
          crate: ["tongs", "ladles", "whisks", "peelers", "graters", "skimmers"].map((id) => ({
            id,
            sets: 1,
          })),
          seed: 3,
          rounds: 1,
        },
      },
    ),
  );
  await openSupplies(page);
  await openGame(page);
  const t50 = await page.evaluate(() => ({
    hidden: document.querySelectorAll("[data-hidden-piece]").length,
    hint: !!document.querySelector('[data-testid="stock-hint"]'),
    undo: document.querySelector('[data-testid="stock-undo"]')?.getAttribute("aria-label"),
  }));
  await shot(page, "stockroomsort-l50");
  await boot(
    page,
    saveAt(
      80,
      {},
      {
        stockroomSort: {
          crate: [
            "tongs",
            "ladles",
            "whisks",
            "peelers",
            "graters",
            "skimmers",
            "sheet-pans",
            "mixing-bowls",
          ].map((id) => ({ id, sets: 1 })),
          seed: 4,
          rounds: 1,
        },
      },
    ),
  );
  await openSupplies(page);
  await openGame(page);
  const t80 = await page.evaluate(() => ({
    locked: document.querySelectorAll('[data-locked="1"]').length,
    wrapped: document.querySelectorAll('[data-piece="wrapped"]').length,
    cubbies: document.querySelectorAll("[data-cubby]").length,
  }));
  await shot(page, "stockroomsort-l80");
  check(
    "T13 Level 50: a hidden row, no hint, limited undo; Level 80: a locked cubby and wrapped parcels",
    t50.hidden >= 3 &&
      !t50.hint &&
      /3 left/.test(t50.undo ?? "") &&
      t80.locked >= 1 &&
      t80.wrapped >= 1 &&
      t80.cubbies <= 10,
    { t50, t80 },
  );

  // ---- T14: a long delivery is 2 boards, with a bonus for finishing both ----
  const SEVEN = ["tongs", "ladles", "whisks", "peelers", "graters", "skimmers", "sheet-pans"].map(
    (id) => ({ id, sets: 1 }),
  );
  await boot(page, saveAt(20, {}, { stockroomSort: { crate: SEVEN, seed: 5, rounds: 1 } }));
  await openSupplies(page);
  await openGame(page);
  const more = await page.evaluate(
    () => document.querySelector('[data-testid="stock-more-boards"]')?.textContent?.trim() ?? null,
  );
  await playByHints(page);
  await sleep(400);
  const mid = await page.evaluate(() => ({
    chain: document.querySelector('[data-testid="stock-chain"]')?.textContent?.trim() ?? null,
    next: !!document.querySelector('[data-testid="stock-next"]'),
  }));
  await tap(page, '[data-testid="stock-next"]');
  await sleep(500);
  const hype1 = (await readSave(page)).business.secondFloor?.hype ?? 0;
  await playByHints(page);
  await sleep(400);
  const fin = await page.evaluate(
    () => document.querySelector('[data-testid="stock-big-delivery"]')?.textContent?.trim() ?? null,
  );
  const done = await readSave(page);
  check(
    "T14 7 sets at Level 20 are 2 boards: the run is shown, and finishing both adds the big-delivery Hype (+5)",
    /\+1 more shelf/.test(more ?? "") &&
      !!mid.chain &&
      mid.next &&
      /Whole delivery stocked/.test(fin ?? "") &&
      done.business.secondFloor?.hype > hype1 &&
      done.business.stockroomSort?.crate === undefined,
    { more, mid, fin, hype1, hype: done.business.secondFloor?.hype },
  );

  // ---- T11: no console errors ----
  const bad = logs.filter(
    (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
  );
  check("T11 no console errors", bad.length === 0, bad.slice(0, 5));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? "\nSTOCKROOM SORT E2E: ALL PASS"
    : `\nSTOCKROOM SORT E2E: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
