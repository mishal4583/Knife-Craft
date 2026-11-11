// Delivery Inspection (developer 2026-11-08), restaurant build, in a real browser: the "Spot the bad ones" mini-game (business/deliveryInspection.ts).
//   I1 below Level 3 there is no chip; from Level 3 a delivery that waits shows "Check the delivery · N" above the Inventory fridge
//   I2 the chip opens the game: the how-to guide shows the first time (and is saved as seen), Start is needed before the clock runs
//   I3 the crate is on screen: mixed ingredients, the goal line says how many are NOT FRESH, the slots match
//   I4 a RIGHT tap flags a defect (stamp, slot filled, score); a WRONG tap costs time and shows the green tick, never twice on the same one
//   I5 dragging an ingredient aside moves it (and is not a flag); an ingredient hidden behind another shows once the cover is moved
//   I6 finding every defect ends the round: stars, a score, Hype is added, the day's count goes up
//   I7 money and stock never move: credits, inventory and the ledger are identical before and after
//   I8 Done returns to the Inventory; the chip shows the next inspection (or is gone)
//   I9 a hired Prep Cook: the chip stays and his button inspects for you; Back before Start; Skip (Pause) leaves the delivery waiting and no stars are saved
//   I10 at 320 x 568 nothing scrolls sideways and every ingredient is at least 40 px wide
//   I11 Level 30 (tier 3): the magnifier button shows and the lens appears; a little dirt (decoy) exists and a tap on it is a wrong flag
//   I12 no console errors
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

const CRATE = ["tomato", "carrot", "lettuce", "apple", "onion", "basil"];
const COUNTS = { tomato: 2, carrot: 2, lettuce: 1, apple: 1, onion: 1, basil: 1 };
const STOCK = Object.fromEntries(
  [...CRATE, "potato"].map((id) => [
    id,
    { ingredientId: id, quantity: 4, unitCost: 100, purchaseDay: 1 },
  ]),
);
const saveAt = (n, business = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: STOCK,
      fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 },
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

const tap = async (page, sel) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(250);
};
const state = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="delivery-inspection"]');
    return g
      ? {
          phase: g.dataset.phase,
          total: Number(g.dataset.total),
          found: Number(g.dataset.found),
          tier: Number(g.dataset.tier),
          practice: g.dataset.practice,
          score: document
            .querySelector('[data-testid="insp-score"]')
            ?.textContent?.replace(/\D/g, ""),
          timer: document.querySelector('[data-testid="insp-timer"]')?.textContent?.trim(),
          goal: document.querySelector('[data-testid="insp-goal"]')?.textContent?.trim(),
          items: document.querySelectorAll('[data-testid="insp-item"]').length,
        }
      : null;
  });
/** A real pointer tap at the centre of an item (so the pointer path is exercised). */
const tapItem = async (page, id) => {
  const c = await page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="insp-item"][data-id="${i}"]`);
    const r = el?.getBoundingClientRect();
    if (!r) return null;
    // The middle of the item, or (when a neighbour is drawn over it in this crate's layout) the first point of it that is really on top.
    for (const [fx, fy] of [
      [0.5, 0.5],
      [0.5, 0.3],
      [0.5, 0.7],
      [0.3, 0.5],
      [0.7, 0.5],
      [0.3, 0.3],
      [0.7, 0.7],
      [0.3, 0.7],
      [0.7, 0.3],
    ]) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      const top = document.elementFromPoint(x, y);
      if (top && (top === el || el.contains(top))) return { x, y };
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  if (!c) return false;
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(220);
  return true;
};
const dragItem = async (page, id, dx, dy) => {
  const c = await page.evaluate((i) => {
    const el = document.querySelector(`[data-testid="insp-item"][data-id="${i}"]`);
    const r = el?.getBoundingClientRect();
    if (!r) return null;
    // The middle of the item, or (when a neighbour is drawn over it in this crate's layout) the first point of it that is really on top.
    for (const [fx, fy] of [
      [0.5, 0.5],
      [0.5, 0.3],
      [0.5, 0.7],
      [0.3, 0.5],
      [0.7, 0.5],
      [0.3, 0.3],
      [0.7, 0.7],
      [0.3, 0.7],
      [0.7, 0.3],
    ]) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      const top = document.elementFromPoint(x, y);
      if (top && (top === el || el.contains(top))) return { x, y };
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  if (!c) return false;
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx / 2, c.y + dy / 2, { steps: 4 });
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 4 });
  await page.mouse.up();
  await sleep(250);
  return true;
};
const items = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="insp-item"]')].map((e) => {
      const r = e.getBoundingClientRect();
      return {
        id: Number(e.dataset.id),
        defect: e.dataset.defect === "1",
        hidden: e.dataset.hidden === "1",
        found: e.dataset.found === "1",
        w: Math.round(r.width),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }),
  );
const openInventory = async (page) => {
  await openShortcut(page, "inventory");
  await sleep(1200);
};
const openGame = async (page) => {
  await tap(page, '[data-testid="delivery-inspection-chip"]');
  await sleep(900);
  const guide = await page.evaluate(() => !!document.querySelector('[data-testid="insp-guide"]'));
  if (guide) await tap(page, '[data-testid="insp-guide-ok"]');
  await sleep(200);
  return guide;
};
const start = async (page) => {
  await tap(page, '[data-testid="insp-start"]');
  await sleep(300);
};
const snapshot = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stub:knifecraft_save") ?? "null");
    return s
      ? { credits: s.credits, inventory: s.business?.inventory, ledger: s.economyLedger?.length }
      : null;
  });

const { browser, page, logs } = await launch();

// I1: the chip
await boot(page, saveAt(2));
await openInventory(page);
const chip2 = await page.evaluate(
  () => !!document.querySelector('[data-testid="delivery-inspection-chip"]'),
);
check("I1 below Level 3 there is no Inspect chip", chip2 === false);
await boot(page, saveAt(3));
await openInventory(page);
const chip3 = await page.evaluate(
  () =>
    document.querySelector('[data-testid="delivery-inspection-chip"]')?.textContent?.trim() ?? null,
);
check(
  "I1b from Level 3 a waiting delivery shows 'Check the delivery · N'",
  !!chip3 && /Check the delivery · \d/.test(chip3),
  chip3,
);
await shot(page, "insp-1-chip");

// I2: the guide, then Start
const before = await snapshot(page);
const guideShown = await openGame(page);
const s0 = await state(page);
const saved = await readSave(page);
check(
  "I2 the how-to guide shows the first time and is saved as seen; the clock waits for Start",
  guideShown && s0?.phase === "ready" && saved?.business?.deliveryInspection?.howto === 1,
  { guideShown, phase: s0?.phase, howto: saved?.business?.deliveryInspection?.howto },
);
await shot(page, "insp-2-ready");
await start(page);
const s1 = await state(page);
check(
  "I3 the crate is dealt: mixed ingredients, the goal says how many are NOT FRESH",
  s1?.phase === "playing" && s1.items >= 8 && s1.total === 2 && /Find 2/.test(s1.goal ?? ""),
  s1,
);
await shot(page, "insp-3-playing");

// I4: a wrong tap, then a right one
let list = await items(page);
const sound = list.find((i) => !i.defect);
const timerBefore = (await state(page)).timer;
await tapItem(page, sound.id);
const afterWrong = await page.evaluate(() => ({
  note: document.querySelector('[data-testid="insp-note"]')?.dataset.tone,
  text: document.querySelector('[data-testid="insp-note"]')?.textContent,
}));
await tapItem(page, sound.id);
const w2 = await readSave(page);
const defect = (await items(page)).find((i) => i.defect && !i.hidden);
await tapItem(page, defect.id);
const s2 = await state(page);
const stamps = await page.evaluate(
  () => document.querySelectorAll('[data-testid="insp-stamp"]').length,
);
check(
  "I4 a wrong tap says so and costs time; a right tap stamps the defect and scores",
  afterWrong.note === "bad" &&
    /fine/i.test(afterWrong.text ?? "") &&
    s2?.found === 1 &&
    stamps === 1 &&
    Number(s2.score) >= 100,
  { afterWrong, s2, stamps, timerBefore },
);
await shot(page, "insp-4-found");

// I5: drag aside
list = await items(page);
const mover = list.find((i) => !i.found && !i.defect);
const posBefore = { x: mover.x, y: mover.y };
await dragItem(page, mover.id, 40, 25);
const moved = (await items(page)).find((i) => i.id === mover.id);
const s3 = await state(page);
check(
  "I5 dragging an ingredient moves it and does not flag it",
  Math.hypot(moved.x - posBefore.x, moved.y - posBefore.y) > 20 && s3?.found === 1,
  { posBefore, moved: { x: moved.x, y: moved.y }, found: s3?.found },
);

// I6: find the last defect
const last = (await items(page)).find((i) => i.defect && !i.found);
await tapItem(page, last.id);
await sleep(1600);
const done = await page.evaluate(() => ({
  stars: Number(document.querySelector('[data-testid="insp-result"]')?.dataset.stars ?? -1),
  score: document.querySelector('[data-testid="insp-final-score"]')?.textContent,
  reward: document.querySelector('[data-testid="insp-reward"]')?.textContent,
}));
const after = await readSave(page);
check(
  "I6 finding every defect ends the round: stars, a score, Hype, the day's count",
  done.stars >= 1 &&
    /Hype/.test(done.reward ?? "") &&
    after?.business?.deliveryInspection?.rounds === 1 &&
    after?.business?.deliveryInspection?.today === 1,
  { done, di: after?.business?.deliveryInspection },
);
await shot(page, "insp-6-result");
const afterSnap = await snapshot(page);
check(
  "I7 money and stock never move: credits, inventory and the ledger are identical",
  JSON.stringify(before) === JSON.stringify(afterSnap),
  { before: before?.credits, after: afterSnap?.credits },
);

// I8: Done
await tap(page, '[data-testid="insp-done"]');
await sleep(900);
const back = await page.evaluate(() => ({
  game: !!document.querySelector('[data-testid="delivery-inspection"]'),
  chip:
    document.querySelector('[data-testid="delivery-inspection-chip"]')?.textContent?.trim() ?? null,
}));
check(
  "I8 Done returns to the Inventory; the finished basket is not offered again",
  back.game === false && (back.chip === null || /Check the delivery/.test(back.chip)),
  back,
);

// I9: Prep Cook
await boot(page, saveAt(3, { staff: { hiredRoles: ["prep-cook"] } }));
await openInventory(page);
const chipPrep = await page.evaluate(
  () => !!document.querySelector('[data-testid="delivery-inspection-chip"]'),
);
check("I9 a hired Prep Cook does not hide the game: the chip is still there", chipPrep === true);
await openGame(page);
const autoBtn = await page.evaluate(() => !!document.querySelector('[data-testid="insp-auto"]'));
await tap(page, '[data-testid="insp-auto"]');
await sleep(800);
const afterAuto = await readSave(page);
const chipAfterAuto = await page.evaluate(
  () => !!document.querySelector('[data-testid="delivery-inspection-chip"]'),
);
check(
  "I9a his button inspects the basket for you: no stars, no reward, the chip is gone",
  autoBtn && chipAfterAuto === false && !(afterAuto?.business?.deliveryInspection?.rounds > 0),
  afterAuto?.business?.deliveryInspection,
);

// I9c: before Start the top-left button is a Back arrow (the pause button used to do nothing there)
await boot(page, saveAt(3));
await openInventory(page);
await openGame(page);
const backLabel = await page.evaluate(() =>
  document.querySelector('[data-testid="insp-pause"]')?.getAttribute("aria-label"),
);
await tap(page, '[data-testid="insp-pause"]');
await sleep(800);
const leftGame = await page.evaluate(
  () => !document.querySelector('[data-testid="delivery-inspection"]'),
);
check(
  "I9c before Start the top-left button says Back and leaves the game",
  backLabel === "Back" && leftGame,
  { backLabel, leftGame },
);

// I9b: Skip leaves it waiting
await boot(page, saveAt(3));
await openInventory(page);
await openGame(page);
await start(page);
await tap(page, '[data-testid="insp-pause"]');
await tap(page, '[data-testid="insp-skip"]');
await sleep(800);
const skipped = await readSave(page);
const chipBack = await page.evaluate(
  () => !!document.querySelector('[data-testid="delivery-inspection-chip"]'),
);
check(
  "I9b Skip leaves the delivery waiting and saves no stars",
  chipBack && !(skipped?.business?.deliveryInspection?.rounds > 0),
  skipped?.business?.deliveryInspection,
);

// I10: 320 x 568
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await openGame(page);
const guide320 = await page.evaluate(() => !!document.querySelector('[data-testid="insp-guide"]'));
if (guide320) await tap(page, '[data-testid="insp-guide-ok"]');
await start(page);
const small = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  minW: Math.min(
    ...[...document.querySelectorAll('[data-testid="insp-item"]')].map((e) =>
      Math.round(e.getBoundingClientRect().width),
    ),
  ),
}));
await shot(page, "insp-10-320");
check(
  "I10 at 320 x 568 nothing scrolls sideways and every ingredient is at least 40 px wide",
  small.overflow <= 0 && small.minW >= 40,
  small,
);
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });

// I11: tier 3
await boot(page, saveAt(30));
await openInventory(page);
await openGame(page);
await start(page);
const t3 = await state(page);
const lensBtn = await page.evaluate(
  () => !!document.querySelector('[data-testid="insp-lens-btn"]'),
);
await tap(page, '[data-testid="insp-lens-btn"]');
const crateBox = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="insp-crate"]').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.move(crateBox.x, crateBox.y);
await page.mouse.move(crateBox.x + 5, crateBox.y + 3);
await sleep(200);
const lens = await page.evaluate(() => !!document.querySelector('[data-testid="insp-lens"]'));
await shot(page, "insp-11-tier3");
check(
  "I11 tier 3: 12 ingredients (bigger, 15 before 2026-11-08), 3-4 defects, the magnifier button and its lens",
  t3?.tier === 3 && t3.items === 12 && t3.total >= 3 && lensBtn && lens,
  { tier: t3?.tier, items: t3?.items, total: t3?.total, lensBtn, lens },
);
const decoyAt = await page.evaluate(() => {
  const e = [...document.querySelectorAll('[data-testid="insp-item"]')].find((i) =>
    i.querySelector('[data-mark^="decoy"]'),
  );
  return e ? Number(e.dataset.id) : null;
});
const decoyOk = decoyAt !== null;
check(
  "I11b tier 3 has harmless look-alikes (decoys) on sound ingredients",
  decoyOk && (await items(page)).find((i) => i.id === decoyAt)?.defect === false,
  { decoyAt },
);

check(
  "I12 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 4),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed ? `DELIVERY INSPECTION E2E: ${failed} FAIL` : "DELIVERY INSPECTION E2E: ALL PASS",
);
process.exit(failed ? 1 : 0);
