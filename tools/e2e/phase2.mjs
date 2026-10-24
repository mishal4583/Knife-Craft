// Phase 2 in the built game (2026-10-21), restaurant build (the normal `npm run build`):
//   A. the cleaning cloth — a brand-new player cuts Level 1 three times (Knife Report → Prepare
//      Again); the cloth is offered only once the board is messy (not after the 1st or 2nd
//      dish); while it is out a tap on the food does not cut and a short swipe does nothing;
//      Skip puts it away and cutting works at once; the skipped mess is offered again on the
//      next start (pause → Restart Prep); one broad sweep cleans and the next tap cuts;
//   B. the money vacuum — Serve pressed twice in one go pays exactly once (one
//      campaign-settlement entry, the wallet up by exactly that); the cash on the counter adds
//      up to the payment exactly; the wallet shows the OLD balance until the cash is swept in;
//      one broad swipe picks up several pieces; sweeping to the end lands the wallet exactly on
//      the saved balance; sweeping never pays again (wallet and ledger unchanged by it);
//      Level 1's order is not a tipping one, so no tip whatever the grade;
//   C. tips — Level 13's order is the campaign's first PAYING tipping order (customerTips.ts;
//      Level 2's is too, but Level 2 is the practice level and pays nothing, so it can never
//      tip). With its food in the fridge: a Masterful dish earns exactly the configured tip (10%
//      of the pay, whole dollars, at least $5) as its own customer-tip entry in the same save,
//      shown on the card with the customer's cheer, and the cash includes it (its gold pieces
//      add up to the tip); a non-Masterful dish earns none. Auto-collect sweeps the counter by
//      itself and lands the wallet on the balance;
//   C'. the positive tip path, made reachable: the solver's generic taps rarely reach Masterful
//      (they don't land on each ingredient's own guides), so Level 17's batch preparation (its
//      orders are tipping ones, served through App's batch-group payment path) is cut ON the
//      scene's real guides at an even rhythm (solver `aim` + `steady`); if it grades Masterful,
//      the tip must be exact, its own entry, shown with "Generous tip!" and the cheer, in the
//      cash (gold = tip), and sweeping it in pays nothing more. Otherwise the run reports that
//      the positive path wasn't reached, and checks that no tip was paid;
//   D. 320×568: screenshots of the cloth, the cash and the tip; the cloth card and the
//      served card fit (the served card WITHOUT scrolling for a plain order; with a tip line on
//      a two-line dish name it may scroll, never clip — reported); no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  freshPlayer,
  boot,
  seedSave,
  sleep,
  clickButton,
  shot,
  save,
  readSave,
  MOVED_IN_BUSINESS,
} from "./harness.mjs";
import { playToReport, stepInfo, wipeBoard, CX, CY } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const notes = [];

const at = (n) =>
  seedSave({
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  });
/** A restaurant at Level n with `foods` in the fridge (orders use real stock from Level 11). */
const atWithFood = (n, foods) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      // From Level 16 a service may need the free Mexican Chef (as restaurantguests.mjs seeds).
      restaurantStaff: { specialists: ["mexican-chef"] },
      inventory: Object.fromEntries(
        foods.map((id) => [id, { ingredientId: id, quantity: 8, unitCost: 0, purchaseDay: 1 }]),
      ),
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

async function stroke(page, x0, y0, x1, y1, steps = 18) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(12);
  }
  await page.mouse.up();
}
const cleanupUp = (page) =>
  page.evaluate(() => !!document.querySelector('[data-testid="board-cleanup"]'));
const grade = (page) =>
  page.evaluate(
    () =>
      (document.body.innerText.match(
        /KNIFE REPORT[\s\S]*?\n(Masterful|Clean|Honest|Rustic|Learning)\n/i,
      ) || [])[1] ?? null,
  );
const pillCents = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('[data-testid="wallet-pill"]');
    if (!p) return null;
    const shown = Math.round(parseFloat(p.innerText.replace(/[^0-9.]/g, "")) * 100);
    return { shown, credits: Number(p.dataset.credits) };
  });
const pieceCents = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-cash-piece]")].map((e) => ({
      cents: Number(e.dataset.cents),
      tip: e.dataset.tip === "1",
      visible: getComputedStyle(e).visibility !== "hidden",
    })),
  );
const collected = (page) =>
  page.evaluate(() => !!document.querySelector('[data-testid="cash-collected"]'));
const newEntries = (before, after) => {
  const ids = new Set((before.economyLedger ?? []).map((e) => e.id));
  return (after.economyLedger ?? []).filter((e) => !ids.has(e.id));
};
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const expectedTip = (pay) => Math.max(500, Math.round((pay * 0.1) / 100) * 100);

/**
 * Where a skilled player taps next: ON the scene's next open guide line (read-only, through
 * React's fiber tree to the Phaser scene), vertical guides right to left, then the cross cuts.
 * null for anything that isn't a guided cut (peel, smash, rings) — the solver's default.
 */
const aimAtNextGuide = (page) =>
  page.evaluate(() => {
    const root = document.getElementById("root");
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    const stack = [root[key]];
    const seen = new Set();
    let game = null;
    while (stack.length && !game) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f);
      for (let st = f.memoizedState; st && typeof st === "object"; st = st.next) {
        const cur = st.memoizedState && st.memoizedState.current;
        if (cur && cur.game && cur.game.scene && cur.game.scene.getScene) {
          game = cur.game;
          break;
        }
      }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    const sc = game?.scene.getScene("Preparation");
    if (!sc || sc.technique?.interactionMode !== "cut") return null;
    const done = sc.cuts.slice(sc.stepCutsAtStart);
    const open = (axis) => {
      const gs = sc.guides?.[axis] ?? [];
      const half = gs.length > 1 ? Math.abs(gs[1] - gs[0]) / 2 : 1e9;
      return gs.filter((g) => !done.some((c) => c.axis === axis && Math.abs(c.c - g) < half));
    };
    const r = game.canvas.getBoundingClientRect();
    const k = r.width / game.scale.width;
    const v = open("v");
    if (v.length) return { x: r.left + Math.max(...v) * k, y: r.top + sc.ingCy * k };
    const h = open("h");
    if (h.length) return { x: r.left + sc.ingCx * k, y: r.top + Math.max(...h) * k };
    return null;
  });

async function sweepTray(page, frac) {
  const t = await page.$eval('[data-testid="cash-tray"]', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await stroke(page, t.x + 6, t.y + t.h * frac, t.x + t.w - 6, t.y + t.h * frac, 22);
  await sleep(700);
}

async function at320(page, name) {
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(700);
  await shot(page, name);
  const fit = await page.evaluate(() => {
    const el =
      document.querySelector('[data-testid="cash-tray"]')?.closest(".anim-pop") ??
      document.querySelector('[data-testid="board-cleanup"] > div');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: innerHeight,
      scrolls: el.scrollHeight > el.clientHeight + 1,
    };
  });
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await sleep(700);
  return fit;
}

const { browser, page, logs } = await launch();

// ---------- A. the cleaning cloth (a brand-new player, Level 1) ----------
await freshPlayer(page);
await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
  timeout: 30000,
});
await sleep(1200);
await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
  timeout: 30000,
});
const offered = [];
for (let run = 1; run <= 3; run++) {
  const played = await playToReport(page, { maxMs: 120000 });
  if (!played.ok) check(`A0 dish ${run} plays to the Knife Report`, false, played.log.slice(-3));
  await sleep(900);
  await clickButton(page, /^Prepare Again$/);
  await sleep(1500);
  offered.push(await cleanupUp(page));
}
check(
  "A1 the cloth is offered once the board is messy — after the 3rd dish, not the 1st or 2nd",
  offered[0] === false && offered[1] === false && offered[2] === true,
  offered,
);
await page.mouse.click(CX, CY);
await sleep(900);
check(
  "A2 while the cloth is out, a tap on the food does not cut",
  (await stepInfo(page)).n === 0 && (await cleanupUp(page)),
);
await stroke(page, CX - 40, CY + 30, CX + 40, CY + 30, 8);
await sleep(600);
check("A3 a short swipe does not clean (the cloth is still offered)", await cleanupUp(page));
await page.click('[data-testid="board-cleanup-skip"]');
await sleep(600);
check("A4 Skip puts the cloth away at once", !(await cleanupUp(page)));
await page.mouse.click(CX, CY);
await sleep(1000);
check("A5 after Skip, cutting works straight away", (await stepInfo(page)).n === 1);
await page.click('[aria-label="Pause"]');
await sleep(500);
await clickButton(page, /^Restart Prep$/);
await sleep(1500);
check("A6 skipped mess stays: the next start offers the cloth again", await cleanupUp(page));
const cleanupFit = await at320(page, "phase2-cleanup-320");
check(
  "A7 at 320×568 the cloth card is on screen",
  !!cleanupFit && cleanupFit.top >= 0 && cleanupFit.bottom <= cleanupFit.h,
  cleanupFit,
);
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(700);
// Developer 2026-10-24: the cloth wipes over several strokes (was "one broad sweep cleans").
await stroke(page, CX - 185, CY + 30, CX + 185, CY + 30, 18);
await sleep(400);
const oneSweep = await cleanupUp(page);
const hidden = await page.evaluate(() => {
  const p = document.querySelector('[data-testid="board-cleanup-progress"]');
  return p ? Number(p.getAttribute("data-progress")) : -1;
});
const wiped = await wipeBoard(page);
await sleep(1500);
check(
  "A8 one sweep is not enough (progress shows); wiping the board with the cloth cleans it (the cloth goes away)",
  oneSweep && hidden > 0 && hidden < 100 && wiped && !(await cleanupUp(page)),
  { oneSweep, hidden, wiped },
);
await page.mouse.click(CX, CY);
await sleep(1000);
check("A9 after the wipe, the next tap cuts", (await stepInfo(page)).n === 1);

// ---------- B. the money vacuum (Level 1: not a tipping order) ----------
const played1 = await playToReport(page, { maxMs: 120000 });
check("B0 Level 1 plays to the Knife Report", played1.ok, played1.log.slice(-3));
await sleep(900);
const grade1 = await grade(page);
await clickButton(page, /^Continue$/);
await page.waitForFunction(
  () =>
    [...document.querySelectorAll("button")].some((b) => /^Serve to /.test(b.textContent.trim())),
  { timeout: 15000 },
);
const s0 = await readSave(page);
// Pressed twice in the same task: the second press lands before React re-renders.
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) =>
    /^Serve to /.test(x.textContent.trim()),
  );
  b.click();
  b.click();
});
await sleep(900);
const s1 = await readSave(page);
const added1 = newEntries(s0, s1);
const settle1 = added1.filter((e) => e.category === "campaign-settlement");
const tips1 = added1.filter((e) => e.category === "customer-tip");
check(
  "B1 Serve pressed twice pays exactly once: one campaign-settlement entry, wallet up by exactly it",
  settle1.length === 1 &&
    s1.credits - s0.credits === settle1[0].amount + sum(tips1.map((e) => e.amount)),
  { entries: added1.map((e) => `${e.category} ${e.amount}`), delta: s1.credits - s0.credits },
);
check(
  `B2 Level 1's order is not a tipping one: no tip entry and no tip line (grade ${grade1})`,
  tips1.length === 0 && !(await page.$('[data-testid="tip-line"]')),
);
const pieces1 = await pieceCents(page);
check(
  "B3 the cash on the counter adds up exactly to the payment (4–14 pieces)",
  pieces1.length >= 4 &&
    pieces1.length <= 14 &&
    sum(pieces1.map((p) => p.cents)) === s1.credits - s0.credits,
  { pieces: pieces1.length, cash: sum(pieces1.map((p) => p.cents)), paid: s1.credits - s0.credits },
);
const pill1 = await pillCents(page);
check(
  "B4 the wallet shows the old balance while the cash is still on the counter",
  !!pill1 && pill1.credits === s1.credits && pill1.shown === s0.credits,
  { pill1, before: s0.credits, after: s1.credits },
);
const cashFit = await at320(page, "phase2-cash-320");
check(
  "B5 at 320×568 the served card with its cash fits on screen without scrolling",
  !!cashFit && cashFit.top >= 0 && cashFit.bottom <= cashFit.h && !cashFit.scrolls,
  cashFit,
);
await sweepTray(page, 0.5);
const left1 = (await pieceCents(page)).filter((p) => p.visible).length;
check("B6 one broad swipe sweeps up several pieces at once", left1 <= pieces1.length - 2, {
  before: pieces1.length,
  left: left1,
});
const midPill = await pillCents(page);
check(
  "B7 the wallet rolls up as cash comes in, never past the real balance",
  !!midPill && midPill.shown > s0.credits && midPill.shown <= s1.credits,
  midPill,
);
for (let k = 0; k < 6 && !(await collected(page)); k++) await sweepTray(page, k % 2 ? 0.25 : 0.75);
await sleep(600);
const s2 = await readSave(page);
const pill2 = await pillCents(page);
check(
  "B8 with the counter clear, the wallet shows exactly the saved balance",
  (await collected(page)) && !!pill2 && pill2.shown === s2.credits,
  { pill2, saved: s2.credits },
);
check(
  "B9 sweeping never pays again: wallet and ledger unchanged by the cash",
  s2.credits === s1.credits && (s2.economyLedger ?? []).length === (s1.economyLedger ?? []).length,
);

// ---------- C. tips (Level 13: the first paying tipping order) ----------
await boot(page, atWithFood(13, ["tomato", "zucchini", "basil", "onion"]));
await sleep(1200);
// Level 13 shows the Inventory hint ("Later") and opens a Pre-Service Check after Prepare.
if (
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Later"),
  )
)
  await clickButton(page, /^Later$/);
await clickButton(page, /Prepare$/);
await sleep(1200);
// The start button of the Pre-Service Check (Level 15+) or of the day’s opening card (Level 17+).
if (
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) =>
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i.test(
        b.textContent.trim(),
      ),
    ),
  )
)
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i,
  );
await page.waitForFunction(
  () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  { timeout: 30000 },
);
const played2 = await playToReport(page, { maxMs: 180000 });
check("C0 Level 13 plays to the Knife Report", played2.ok, played2.log.slice(-3));
await sleep(900);
const grade2 = await grade(page);
await clickButton(page, /^Continue$/);
await page.waitForFunction(
  () =>
    [...document.querySelectorAll("button")].some((b) => /^Serve to /.test(b.textContent.trim())),
  { timeout: 15000 },
);
const t0 = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(1000);
const t1 = await readSave(page);
const added2 = newEntries(t0, t1);
const settle2 = added2.filter((e) => e.category === "campaign-settlement");
const tip2 = added2.filter((e) => e.category === "customer-tip");
const tipLine = await page.$eval('[data-testid="tip-line"]', (e) => e.innerText).catch(() => null);
const cheer = !!(await page.$('[data-testid="customer-reaction"]'));
if (grade2 === "Masterful") {
  const want = expectedTip(settle2[0]?.amount ?? 0);
  check(
    "C1 a Masterful dish on a tipping order earns exactly the configured tip, as its own entry in the same save",
    settle2.length === 1 &&
      tip2.length === 1 &&
      tip2[0].amount === want &&
      t1.credits - t0.credits === settle2[0].amount + want,
    {
      pay: settle2[0]?.amount,
      tip: tip2.map((e) => e.amount),
      want,
      delta: t1.credits - t0.credits,
    },
  );
  check(
    "C2 the card shows the tip and the customer cheers",
    !!tipLine && tipLine.includes((want / 100).toFixed(2)) && cheer,
    { tipLine, cheer },
  );
  const pieces2 = await pieceCents(page);
  check(
    "C3 the cash includes the tip: all pieces add up to pay + tip, the gold ones to the tip",
    sum(pieces2.map((p) => p.cents)) === settle2[0].amount + want &&
      sum(pieces2.filter((p) => p.tip).map((p) => p.cents)) === want,
    { pieces: pieces2.length },
  );
  const tipFit = await at320(page, "phase2-tip-320");
  check(
    "C3b at 320×568 the card with a tip stays on screen (it may scroll, never clip)",
    !!tipFit && tipFit.top >= 0 && tipFit.bottom <= tipFit.h,
    tipFit,
  );
  if (tipFit?.scrolls) notes.push("tip card at 320×568 needed a scroll (two-line dish name + tip)");
} else {
  notes.push(`Level 13 graded ${grade2}: the positive tip path was not reached in this run`);
  check(
    `C1 a dish that isn't Masterful (${grade2}) earns no tip, even on a tipping order`,
    settle2.length === 1 && tip2.length === 0 && !tipLine,
    { entries: added2.map((e) => e.category) },
  );
}
await page.click('[data-testid="cash-auto"]');
await sleep(2600);
const t2 = await readSave(page);
const pill3 = await pillCents(page);
check(
  "C4 auto-collect sweeps the counter by itself and lands the wallet on the saved balance",
  (await collected(page)) && !!pill3 && pill3.shown === t2.credits && t2.credits === t1.credits,
  { pill3, saved: t2.credits },
);

// ---------- C'. the positive tip path: Level 17's batch preparation, cut on the real guides ----------
await boot(page, atWithFood(17, ["bread", "tomato", "basil", "garlic", "cucumber", "potato"]));
await sleep(1200);
if (
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Later"),
  )
)
  await clickButton(page, /^Later$/);
await clickButton(page, /Prepare$/);
await sleep(1200);
// The start button of the Pre-Service Check (Level 15+) or of the day’s opening card (Level 17+).
if (
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) =>
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i.test(
        b.textContent.trim(),
      ),
    ),
  )
)
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i,
  );
const onBoard = () =>
  page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
await onBoard();
// Level 17 is a batch level: ONE preparation (six steps) serves both orders — both tipping
// orders — and its serve goes through App's batch-group payment path. Cut it on the real
// guides, at an even rhythm.
const prep17 = await playToReport(page, { maxMs: 240000, aim: aimAtNextGuide, steady: 450 });
check(
  "C5 Level 17's batch preparation plays to the Knife Report (cut on the real guides)",
  prep17.ok,
  prep17.log.slice(-3),
);
await sleep(900);
const grade17 = await grade(page);
await clickButton(page, /^Continue$/);
await page.waitForFunction(
  () =>
    [...document.querySelectorAll("button")].some((b) => /^Serve to /.test(b.textContent.trim())),
  { timeout: 15000 },
);
const u0 = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(1000);
const u1 = await readSave(page);
const added17 = newEntries(u0, u1);
const settle17 = added17.filter((e) => e.category === "campaign-settlement");
const tip17 = added17.filter((e) => e.category === "customer-tip");
const tipLine17 = await page
  .$eval('[data-testid="tip-line"]', (e) => e.innerText)
  .catch(() => null);
if (grade17 === "Masterful") {
  const want = expectedTip(settle17[0]?.amount ?? 0);
  check(
    "C6 Masterful on a tipping order: exactly the configured tip, its own customer-tip entry, same save",
    settle17.length === 1 &&
      tip17.length === 1 &&
      tip17[0].amount === want &&
      u1.credits - u0.credits === settle17[0].amount + want,
    {
      pay: settle17[0]?.amount,
      tip: tip17.map((e) => e.amount),
      want,
      delta: u1.credits - u0.credits,
    },
  );
  check(
    "C7 the card shows 'Generous tip!' with the amount, and the customer cheers",
    !!tipLine17 &&
      /Generous tip!/i.test(tipLine17) &&
      tipLine17.includes((want / 100).toFixed(2)) &&
      !!(await page.$('[data-testid="customer-reaction"]')),
    { tipLine17 },
  );
  const pieces17 = await pieceCents(page);
  check(
    "C8 the cash is pay + tip exactly, its gold pieces exactly the tip",
    sum(pieces17.map((p) => p.cents)) === settle17[0].amount + want &&
      sum(pieces17.filter((p) => p.tip).map((p) => p.cents)) === want &&
      pieces17.some((p) => p.tip),
    { pieces: pieces17.length, gold: pieces17.filter((p) => p.tip).length },
  );
  const tipFit = await at320(page, "phase2-tip-320");
  check(
    "C9 at 320×568 the card with a tip stays on screen (it may scroll, never clip)",
    !!tipFit && tipFit.top >= 0 && tipFit.bottom <= tipFit.h,
    tipFit,
  );
  if (tipFit?.scrolls) notes.push("tip card at 320×568 needed a scroll (two-line name + tip)");
  for (let i = 0; i < 6 && !(await collected(page)); i++)
    await sweepTray(page, i % 2 ? 0.25 : 0.75);
  const u2 = await readSave(page);
  const pill17 = await pillCents(page);
  check(
    "C10 sweeping the tip in lands the wallet exactly on the saved balance — and pays nothing more",
    (await collected(page)) &&
      !!pill17 &&
      pill17.shown === u2.credits &&
      u2.credits === u1.credits &&
      (u2.economyLedger ?? []).length === (u1.economyLedger ?? []).length,
    { pill17, saved: u2.credits },
  );
} else {
  notes.push(`Level 17 batch graded ${grade17}: the positive tip path was not reached`);
  check(
    `C6 a dish that isn't Masterful (${grade17}) earns no tip, even on a tipping order`,
    settle17.length === 1 && tip17.length === 0 && !tipLine17,
    { entries: added17.map((e) => e.category) },
  );
}

check(
  "D console has no errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs,
);
if (notes.length) console.log("NOTE", notes.join(" · "));
save("phase2-result.json", {
  results,
  notes,
  grades: { level1: grade1, level13: grade2, level17batch: grade17 },
});
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nPHASE 2 E2E: ALL PASS" : `\nPHASE 2 E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
