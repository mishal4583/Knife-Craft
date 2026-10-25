// Phase 4 in the game (2026-10-21), on the restaurant dev server (`npm run dev`, KC_DEV_URL,
// default :8080) — it has `window.__kcSpecials` (development builds only) to put a chosen
// special customer or variant on the next order, and lets the test read level data:
//   A. the Signature Dish Collection — the Order Board's 📖 opens the Recipe Book; its summary
//      counts pages per tier from the saved bests (60 → Homemade, 88 → Chef's Special,
//      97 → Grandma's Signature); each row's stamp says its tier; no score digits anywhere; a
//      page shows its tier frame, ladder, best plate as a grade word and one memory per tier
//      reached; an unprepared page says so; opening the book writes nothing; 320×568 fits.
//   A'. a real dish: the first plate of a recipe puts a recipe-book page on its serve card,
//      at the tier the save then holds; a replay shows one only if its tier rose; a Golden Tomato order adds its memory and the page's "This visit (not saved)" line,
//      which a reload clears while the tier stays.
//   B. the five special customers (Level 13): each arrives on the order card, is named on the
//      order card and the serve card, reacts at Serve with its own line for the dish's real grade
//      (the Mystery Guest is a silhouette until then, and is revealed), and the order pays
//      exactly once (one campaign-settlement entry; wallet = entries). The Regular, left waiting
//      past his par, checks his watch once and says "Finally!". Level 2 gets none even forced.
//      The serve card with a special customer fits 320×568.
//   C. the sequence: cooking film → Knife Report → serve card (with any book page) → after Serve
//      the reaction, the pay and the cash a beat apart; a double tap on Continue gives one serve
//      card; the card with a book page fits 320×568; Next Customer double-tapped skips no order
//      (Level 19, order ids); skipping the film still reaches the report.
//   Z. no console errors.
import {
  launch,
  seedSave,
  sleep,
  clickButton,
  shot,
  save,
  readSave,
  MOVED_IN_BUSINESS,
  SAVE_KEY,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const DEV = process.env.KC_DEV_URL || "http://localhost:8080/";
const ONLY = process.env.ONLY || "ABCZ";
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const notes = [];

const { browser, page, logs } = await launch();
await page.evaluateOnNewDocument(() => {
  // Stage timeline: the first time each part of the completion sequence shows.
  window.__kcStages = [];
  const marks = {
    clip: '[aria-label="The chef cooks your dish"]',
    report: '[data-testid="knife-report-stats"]',
    book: '[data-testid="book-note"]',
    serve: '[data-testid="service-customer"]',
    line: '[data-testid="customer-line"]',
  };
  new MutationObserver(() => {
    for (const [k, sel] of Object.entries(marks))
      if (!window.__kcStages.some((s) => s.k === k) && document.querySelector(sel))
        window.__kcStages.push({ k, t: performance.now() });
  }).observe(document, { childList: true, subtree: true });
});

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
const withFood = (foods) => ({
  business: {
    ...MOVED_IN_BUSINESS,
    restaurantStaff: { specialists: ["mexican-chef"] },
    inventory: Object.fromEntries(
      foods.map((id) => [id, { ingredientId: id, quantity: 12, unitCost: 0, purchaseDay: 1 }]),
    ),
  },
});
async function bootAt(s) {
  await page.goto(DEV, { waitUntil: "domcontentloaded" });
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
  await sleep(900);
}
const mod = (path, expr) =>
  page.evaluate(
    async (p, e) => {
      const m = await import(p);
      return new Function("m", `return (${e})`)(m);
    },
    path,
    expr,
  );
const levelInfo = (n) =>
  mod(
    "/src/game/levels/levelDefinitions.ts",
    `(() => { const l = m.LEVELS[${n - 1}]; return { id: l.id, title: l.title, recipeId: l.recipeId, ids: l.recipePoolIds?.length ? l.recipePoolIds : l.batchGroupRecipeIds?.length ? l.batchGroupRecipeIds : [l.recipeId], requiredOrders: l.requiredOrders ?? null }; })()`,
  );
const tierOf = (best) =>
  best == null
    ? null
    : best >= 95
      ? "grandmas-signature"
      : best >= 85
        ? "chefs-special"
        : "homemade";
const flat = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

async function openBook() {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(600);
  await page.evaluate(() => document.querySelector('[aria-label="Recipe Book"]')?.click());
  await page.waitForSelector('[data-testid="signature-summary"]', { timeout: 10000 });
  await sleep(400);
}
/** Prepare → START on the current campaign level; waits for the order card. */
async function startOrder() {
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
  // Transformation Phase B (2026-10-25): the order opens on its customer walking in —
  // a player taps "Start cooking" before the board (and the Regular's clock) starts.
  await page.waitForSelector('[data-testid="service-floor"]', { timeout: 5000 }).catch(() => null);
  await clickButton(page, /Start cooking$/);
  await sleep(400);
}
const grade = () =>
  page.evaluate(
    () =>
      (document.body.innerText.match(
        /KNIFE REPORT[\s\S]*?\n(Masterful|Clean|Honest|Rustic|Learning)\n/i,
      ) || [])[1] ?? null,
  );
/** From the Knife Report (one Continue) to the serve card. Returns the grade and any book page on the card. */
async function toServeCard() {
  await sleep(700);
  const g = await grade();
  await clickButton(page, /^Continue$/);
  await page.waitForSelector('[data-testid="service-customer"]', { timeout: 15000 });
  await sleep(400);
  const book = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="book-note"]');
    return b
      ? { tier: b.dataset.tier, variant: b.dataset.variant, text: b.innerText.replace(/\s+/g, " ") }
      : null;
  });
  return { grade: g, book };
}
const newEntries = (before, after) => {
  const ids = new Set((before.economyLedger ?? []).map((e) => e.id));
  return (after.economyLedger ?? []).filter((e) => !ids.has(e.id));
};

/** The current order's id, read from Preparation's props (read-only, through React's fiber tree). */
const orderId = () =>
  page.evaluate(() => {
    const root = document.getElementById("root");
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    const stack = [root[key]];
    while (stack.length) {
      const f = stack.pop();
      if (!f) continue;
      const id = f.memoizedProps?.service?.order?.order?.id;
      if (typeof id === "string") return id;
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    return null;
  });
const seqOf = (id) => Number(String(id).split("-").pop());
/** From a serve card: finish the order/level and get back to the Kitchen (past any level-complete cards). */
async function backToKitchen() {
  await clickButton(page, /^(Next Customer|Finish Level)$/);
  await sleep(2500);
  for (let k = 0; k < 4; k++) {
    if (await page.$('[data-nav="kitchen"]')) break;
    await clickButton(page, /^(Continue|Back to Kitchen|Kitchen|Done|OK|Not now|No thanks)$/);
    await sleep(1200);
  }
}
/** In the Recipe Book: brings `title`'s chapter tab forward; returns its row's tier stamp (or null). */
async function showRow(title) {
  const tabs = await page.$$eval("button.rounded-t-xl", (bs) => bs.length);
  for (let i = 0; i <= tabs; i++) {
    const found = await page.evaluate((t) => {
      const p = [...document.querySelectorAll("button span")].find(
        (x) => x.textContent.trim() === t,
      );
      return p ? (p.closest("button")?.querySelector("[data-tier]")?.dataset.tier ?? "") : null;
    }, title);
    if (found !== null) return found || null;
    if (i === tabs) break;
    await page.evaluate((k) => document.querySelectorAll("button.rounded-t-xl")[k]?.click(), i);
    await sleep(300);
  }
  return undefined;
}
async function openRow(title) {
  await showRow(title);
  await page.evaluate((t) => {
    const p = [...document.querySelectorAll("button span")].find((x) => x.textContent.trim() === t);
    p?.closest("button")?.click();
  }, title);
  await page.waitForSelector('[data-testid="signature-panel"]', { timeout: 8000 });
  await sleep(400);
}

// ================================================================== A. collection
if (ONLY.includes("A")) {
  const L = await (async () => {
    await bootAt(levelSave(6));
    return Promise.all([1, 2, 3, 4, 5].map(levelInfo));
  })();
  const progress = {
    [L[0].ids[0]]: { best: 60, done: true },
    [L[1].ids[0]]: { best: 88, done: true },
    [L[2].ids[0]]: { best: 97, done: true },
  };
  await bootAt(levelSave(6, { recipeProgress: progress }));
  const saveBefore = JSON.stringify(await readSave(page));
  await openBook();
  const book = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="signature-summary"]');
    const counts = Object.fromEntries(
      [...s.querySelectorAll("[data-tier-count]")].map((e) => [
        e.dataset.tierCount,
        Number(e.textContent.replace(/[^\d]/g, "")),
      ]),
    );
    return { counts, text: document.body.innerText };
  });
  book.rows = [];
  for (const l of L) book.rows.push(await showRow(l.title));
  book.text += await page.evaluate(() => document.body.innerText);
  check(
    "A1 the Recipe Book counts its pages per tier from the saved bests (1 Homemade, 1 Chef's Special, 1 Grandma's Signature)",
    book.counts.homemade === 1 &&
      book.counts["chefs-special"] === 1 &&
      book.counts["grandmas-signature"] === 1,
    book.counts,
  );
  check(
    "A2 each page's stamp says its tier; pages never prepared have none",
    book.rows[0] === "homemade" &&
      book.rows[1] === "chefs-special" &&
      book.rows[2] === "grandmas-signature" &&
      book.rows[3] === null &&
      book.rows[4] === null,
    book.rows,
  );
  check(
    "A3 no score digits anywhere in the book (60 / 88 / 97)",
    !/\b(60|88|97)\b/.test(book.text),
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(600);
  await shot(page, "phase4-book-320");
  const fitBook = await page.evaluate(() => ({
    sw: document.scrollingElement.scrollWidth,
    vw: innerWidth,
  }));
  // the Signature page
  await openRow(L[2].title);
  await shot(page, "phase4-signature-page-320");
  const detail = await page.evaluate(() => ({
    frame: document.querySelector('[data-testid="signature-illustration"]').dataset.tier,
    reached: [...document.querySelectorAll("[data-tier-step]")].filter(
      (e) => e.dataset.reached === "true",
    ).length,
    best: document.querySelector('[data-testid="signature-best"]')?.innerText ?? "",
    memories: document.querySelectorAll('[data-testid="signature-memories"] p').length,
    text: document.body.innerText,
    sw: document.scrollingElement.scrollWidth,
    vw: innerWidth,
  }));
  check(
    "A4 a Grandma's Signature page: gold frame, all three tiers reached, best plate 'Masterful' (a word), three memories, no digits",
    detail.frame === "grandmas-signature" &&
      detail.reached === 3 &&
      /Masterful/.test(detail.best) &&
      detail.memories === 3 &&
      !/\b97\b/.test(detail.text),
    { ...detail, text: undefined },
  );
  check(
    "A5 the book and the page fit 320 px (no sideways scroll)",
    fitBook.sw <= fitBook.vw && detail.sw <= detail.vw,
    { fitBook, page: [detail.sw, detail.vw] },
  );
  await page.evaluate(() => document.querySelector('[aria-label="Back"]')?.click());
  await sleep(600);
  await openRow(L[4].title);
  const empty = await page.evaluate(() => ({
    frame: document.querySelector('[data-testid="signature-illustration"]').dataset.tier,
    text: document.querySelector('[data-testid="signature-panel"]').innerText,
  }));
  check(
    "A6 a page never prepared says so (no tier, 'A page waiting to be written')",
    empty.frame === "" && /A page waiting to be written/.test(empty.text),
    empty,
  );
  await page.setViewport({ width: 430, height: 900 });
  check(
    "A7 opening the book writes nothing to the save",
    JSON.stringify(await readSave(page)) === saveBefore,
  );
}

// ================================================================== A'. a real dish
if (ONLY.includes("A")) {
  const L13 = await (async () => {
    await bootAt(levelSave(13, withFood(["tomato", "zucchini", "basil", "onion"])));
    return levelInfo(13);
  })();
  const s0 = await readSave(page);
  await page.evaluate(() => window.__kcSpecials.variant("golden-tomato"));
  await startOrder();
  const r1 = await playToReport(page, { maxMs: 180000 });
  const seen1 = await toServeCard();
  const s1 = await readSave(page);
  const recipe1 = Object.keys(s1.recipeProgress).find(
    (k) => JSON.stringify(s1.recipeProgress[k]) !== JSON.stringify(s0.recipeProgress[k]),
  );
  const after1 = s1.recipeProgress[recipe1];
  check(
    "A8 the first plate of a recipe opens its recipe-book page, at the tier the save now holds",
    r1.ok &&
      !!seen1.book &&
      seen1.book.tier === tierOf(after1?.best) &&
      !s0.recipeProgress[recipe1],
    { book: seen1.book, after1, recipe1 },
  );
  check(
    "A9 a Golden Tomato order adds its memory to the page",
    !!seen1.book && seen1.book.variant === "golden-tomato" && /Golden Tomato/.test(seen1.book.text),
    seen1.book,
  );
  await clickButton(page, /^Serve to /);
  await sleep(1500);
  // Replay the level (the same recipe): a page only if its tier rose this time.
  await backToKitchen();
  const s1b = await readSave(page);
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(600);
  await clickButton(page, /^See all orders/);
  await sleep(800);
  const replayed = await page.evaluate((name) => {
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
  }, L13.title);
  if (replayed) {
    await sleep(1200);
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i,
    );
    await page
      .waitForFunction(
        () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
        { timeout: 30000 },
      )
      .catch(() => null);
    const r2 = await playToReport(page, { maxMs: 180000 });
    const seen2 = await toServeCard();
    await clickButton(page, /^Serve to /);
    await sleep(1200);
    const s2 = await readSave(page);
    const k = recipe1;
    const prevT = tierOf(s1b.recipeProgress[k]?.best);
    const nextT = tierOf(s2.recipeProgress[k]?.best);
    const order = ["homemade", "chefs-special", "grandmas-signature"];
    const expectPage = order.indexOf(nextT) > order.indexOf(prevT);
    check(
      "A10 replaying the recipe shows a page only when its tier rose (else none — no repeat on replay)",
      r2.ok && !!seen2.book === expectPage && (!seen2.book || seen2.book.tier === nextT),
      {
        book: seen2.book?.tier ?? null,
        prevT,
        nextT,
        bests: [s1b.recipeProgress[k]?.best, s2.recipeProgress[k]?.best],
      },
    );
  } else notes.push("A10 not reached: could not reopen Level 13 from the board");
  await backToKitchen();
  // the book: the tier, and this visit's (unsaved) Golden Tomato
  const lvl = await levelInfo(13);
  await openBook();
  const findPage = async () => {
    await openRow(lvl.title);
    return page.evaluate(() => ({
      tier: document.querySelector('[data-testid="signature-illustration"]').dataset.tier,
      visit: document.querySelector('[data-testid="signature-visit"]')?.innerText ?? null,
    }));
  };
  const pg = await findPage();
  check(
    "A11 the page shows the tier, and 'This visit (not saved) · made with a Golden Tomato'",
    !!pg.tier && /not saved/.test(pg.visit ?? "") && /Golden Tomato/.test(pg.visit ?? ""),
    pg,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(900);
  await openBook();
  const pg2 = await findPage();
  check(
    "A12 after a reload the tier stays (it is the saved best) and the visit line is gone (never saved)",
    pg2.tier === pg.tier && pg2.visit === null,
    pg2,
  );
}

// ================================================================== B. customers
async function customerOrder(id, { waitPastPar = false } = {}) {
  await bootAt(levelSave(13, withFood(["tomato", "zucchini", "basil", "onion"])));
  await page.evaluate((c) => window.__kcSpecials.customer(c), id);
  await startOrder();
  await sleep(500);
  const arrival = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="specials-card"]');
    return c ? { customer: c.dataset.customer, text: c.innerText.replace(/\s+/g, " ") } : null;
  });
  const hud = await flat();
  let waited = null;
  if (waitPastPar) {
    await page
      .waitForSelector('[data-testid="regular-waiting"]', { timeout: 120000 })
      .catch(() => null);
    waited = !!(await page.$('[data-testid="regular-waiting"]'));
  }
  const played = await playToReport(page, { maxMs: 180000 });
  const seen = await toServeCard();
  const pre = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="special-customer"]');
    return a
      ? {
          id: a.dataset.customer,
          silhouette: a.className.includes("kc-silhouette"),
          name: document.querySelector('[data-testid="service-customer"]').innerText,
        }
      : null;
  });
  const before = await readSave(page);
  await page.setViewport({ width: 320, height: 568 });
  await sleep(500);
  await clickButton(page, /^Serve to /);
  await sleep(1400);
  const after = await readSave(page);
  const post = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="service-customer"]').closest(".anim-pop");
    const a = document.querySelector('[data-testid="special-customer"]');
    return {
      line: document.querySelector('[data-testid="customer-line"]')?.innerText ?? null,
      reveal: document.querySelector('[data-testid="mystery-reveal"]')?.innerText ?? null,
      silhouette: a?.className.includes("kc-silhouette") ?? null,
      scrolls: card ? card.scrollHeight > card.clientHeight + 1 : null,
      heights: card ? [card.scrollHeight, card.clientHeight] : null,
      plate: document.querySelector('[data-testid="plate-tier"]')?.dataset.tier ?? null,
    };
  });
  await shot(page, `phase4-${id}-320`);
  await page.setViewport({ width: 430, height: 900 });
  const entries = newEntries(before, after);
  return {
    arrival,
    hud,
    played,
    seen,
    pre,
    post,
    entries,
    wallet: after.credits - before.credits,
    waited,
  };
}
const expectedLine = (id, g, nth, prep) =>
  mod(
    "/src/game/customers/personalities.ts",
    `m.personalityReaction({ id: ${JSON.stringify(id)}, nth: ${nth} }, ${JSON.stringify(g)}, ${prep ? JSON.stringify(prep) : "undefined"})`,
  );

if (ONLY.includes("B")) {
  const names = {
    "food-critic": "The Food Critic",
    "impatient-regular": "The Regular",
    "mystery-customer": "Mystery Guest",
    "grandmas-old-friend": "Grandma's Old Friend",
    "giant-eater": "Big Bruno",
  };
  let i = 0;
  for (const id of Object.keys(names)) {
    i++;
    if (process.env.CUST && !process.env.CUST.split(",").includes(id)) continue;
    const r = await customerOrder(id);
    const settlements = r.entries.filter((e) => e.category === "campaign-settlement");
    const exp = await expectedLine(
      id,
      r.seen.grade,
      0,
      id === "impatient-regular" ? { ms: 0, parMs: 1 } : null,
    );
    const exp2 =
      id === "impatient-regular"
        ? await expectedLine(id, r.seen.grade, 0, { ms: 0, parMs: 1e9 })
        : null;
    const lineOk = r.post.line?.includes(exp.line) || (exp2 && r.post.line?.includes(exp2.line));
    check(
      `B${i} ${names[id]}: arrives on the order card, named on the order and serve cards, reacts to the real grade (${r.seen.grade}), pays exactly once`,
      r.arrival?.customer === id &&
        r.hud.toLowerCase().includes(names[id].toLowerCase()) &&
        r.pre?.id === id &&
        r.pre.name.toLowerCase().includes(names[id].toLowerCase()) &&
        lineOk &&
        settlements.length === 1 &&
        r.wallet === r.entries.reduce((a, e) => a + e.amount, 0),
      {
        arrival: r.arrival?.customer,
        hud: r.hud.toLowerCase().includes(names[id].toLowerCase()),
        pre: r.pre,
        grade: r.seen.grade,
        line: r.post.line,
        expected: exp.line,
        entries: r.entries.map((e) => `${e.category} ${e.amount}`),
        wallet: r.wallet,
      },
    );
    if (id === "mystery-customer")
      check(
        "B6 the Mystery Guest is a silhouette until served, then revealed (a fixed identity, no reward)",
        r.pre.silhouette === true &&
          r.post.silhouette === false &&
          r.post.reveal?.includes(exp.reveal),
        { pre: r.pre.silhouette, post: r.post.silhouette, reveal: r.post.reveal },
      );
    if (id === "giant-eater")
      check(
        "B7 the serve card with a special customer fits 320×568 without scrolling",
        r.post.scrolls === false,
        r.post,
      );
  }
  // The Regular, left waiting past his par.
  if (!process.env.CUST) {
    const slow = await customerOrder("impatient-regular", { waitPastPar: true });
    check(
      "B8 the Regular left waiting checks his watch once (no penalty) and says 'Finally!' at Serve",
      slow.waited === true &&
        /^Finally!/.test(slow.post.line ?? "") &&
        slow.entries.filter((e) => e.category === "campaign-settlement").length === 1,
      { waited: slow.waited, line: slow.post.line },
    );
    // Level 2 (below Level 4): none, even forced.
    await bootAt(levelSave(2, withFood(["tomato", "onion", "potato", "cucumber", "carrot"])));
    await page.evaluate(() => window.__kcSpecials.customer("food-critic"));
    await startOrder().catch(() => null);
    await sleep(800);
    const l2 = await page.evaluate(() => ({
      card: document.querySelector('[data-testid="specials-card"]')?.dataset.customer ?? null,
      text: document.body.innerText,
    }));
    check(
      "B9 below Level 4 no special customer comes, even forced",
      !l2.card && !/The Food Critic/.test(l2.text),
      l2.card,
    );
  }
}

// ================================================================== C. the sequence
if (ONLY.includes("C")) {
  await bootAt(levelSave(13, withFood(["tomato", "zucchini", "basil", "onion"])));
  await page.evaluate(() => window.__kcSpecials.customer("grandmas-old-friend"));
  await startOrder();
  await page.evaluate(() => (window.__kcStages = []));
  const played = await playToReport(page, { maxMs: 180000 });
  await sleep(600);
  // a double tap on Continue: one serve card, with this first plate's book page on it
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent.trim() === "Continue",
    );
    b?.click();
    b?.click();
  });
  await page.waitForSelector('[data-testid="service-customer"]', { timeout: 15000 });
  await sleep(500);
  const afterDouble = await page.evaluate(() => ({
    book: document.querySelectorAll('[data-testid="book-note"]').length,
    serve: document.querySelectorAll('[data-testid="service-customer"]').length,
    report: !!document.querySelector('[data-testid="knife-report-stats"]'),
  }));
  check(
    "C1 a double tap on the Knife Report's Continue lands on one serve card, carrying the new book page (nothing skipped or doubled)",
    afterDouble.book === 1 && afterDouble.serve === 1 && !afterDouble.report,
    afterDouble,
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(700);
  await shot(page, "phase4-book-note-320");
  const noteFit = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="service-customer"]').closest(".anim-pop");
    return { scroll: card.scrollHeight, client: card.clientHeight, vh: innerHeight };
  });
  check(
    "C1b the serve card carrying a book page fits 320×568 without scrolling",
    noteFit.scroll <= noteFit.client + 1,
    noteFit,
  );
  await page.setViewport({ width: 430, height: 900 });
  await sleep(500);
  await clickButton(page, /^Serve to /);
  await sleep(1500);
  const stages = await page.evaluate(() => window.__kcStages.map((s) => s.k));
  const delays = await page.evaluate(() => {
    const line = document.querySelector('[data-testid="customer-line"]');
    const cash = document.querySelector('[data-testid="cash-tray"]')?.closest(".kc-stage");
    return {
      line: line && getComputedStyle(line).animationDelay,
      cash: cash && getComputedStyle(cash).animationDelay,
    };
  });
  check(
    "C2 the sequence runs in order: cooking film → Knife Report → serve card (with its book page) → the customer's line",
    played.ok &&
      ["clip,report,book,serve,line", "clip,report,serve,book,line"].includes(stages.join()),
    stages,
  );
  check(
    "C3 after Serve the reaction comes first and the cash a beat later (0 s → 0.52 s)",
    delays.line === "0s" && delays.cash === "0.52s",
    delays,
  );
  // Next Customer, double-tapped, through a two-order level (Level 19): it still takes every order.
  const info19 = await levelInfo(19);
  await bootAt(
    levelSave(
      19,
      withFood([
        "bread",
        "tomato",
        "basil",
        "mozzarella",
        "eggplant",
        "garlic",
        "onion",
        "zucchini",
        "cucumber",
      ]),
    ),
  );
  await startOrder();
  let firstId = null;
  for (let k = 0; k < 10 && !firstId; k++) {
    await sleep(300);
    firstId = await orderId();
  }
  await playToReport(page, { maxMs: 180000 });
  await toServeCard();
  await clickButton(page, /^Serve to /);
  await sleep(1300);
  let serves = 1;
  const ids = [firstId];
  let finished = false;
  for (let k = 0; k < 8 && !finished; k++) {
    const label = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .map((b) => b.textContent.trim())
        .find((t) => /^(Next Customer|Finish Level)$/.test(t)),
    );
    if (label === "Finish Level") {
      finished = true;
      break;
    }
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.textContent.trim() === "Next Customer",
      );
      b?.click();
      b?.click();
    });
    await sleep(1500);
    ids.push(await orderId());
    // skip the cooking film this time
    const p = await playToReport(page, {
      maxMs: 180000,
      until: () => !!document.querySelector('[aria-label="Skip cooking"]'),
    });
    if (p.stopped) {
      await page.click('[aria-label="Skip cooking"]').catch(() => null);
      await page
        .waitForSelector('[data-testid="knife-report-stats"]', { timeout: 10000 })
        .catch(() => null);
    }
    await toServeCard();
    await clickButton(page, /^Serve to /);
    await sleep(1300);
    serves++;
  }
  check(
    `C4 Next Customer double-tapped still serves each of Level 19's ${info19.requiredOrders} orders (the next order is the very next one — none skipped); skipping the film still reaches the report`,
    finished &&
      serves === info19.requiredOrders &&
      ids.every((id, k) => k === 0 || seqOf(id) === seqOf(ids[k - 1]) + 1),
    { serves, required: info19.requiredOrders, ids },
  );
}

// ================================================================== Z
if (ONLY.includes("Z")) {
  const errors = logs.filter((l) => /^(error|pageerror)/.test(l));
  check("Z1 no console errors", errors.length === 0, errors.slice(0, 5));
}

save("phase4", { results, notes, logs });
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
for (const n of notes) console.log("NOTE", n);
process.exit(failed.length ? 1 : 0);
