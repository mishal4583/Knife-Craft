/**
 * PHASE2_QA — Phase 2 "bench scraper, money vacuum, payment celebration and
 * surprise tips" (developer 2026-10-21):
 *   A. the cutting debris and the bench-scraper cleanup (src/game/boardDebris.ts,
 *      PreparationScene, Preparation.tsx);
 *   B. the cash burst and swipe-to-vacuum (src/game/cashBurst.ts, CashVacuum.tsx,
 *      ServiceOrderComplete.tsx) — presentation only, never a second credit;
 *   C. customer tips (src/game/economy/customerTips.ts, App.tsx) — deterministic,
 *      first payment only, its own ledger entry, and bounded over the REAL campaign;
 *   D. no save field, no wallet path beyond the approved tip entry.
 *
 * Run: npx tsx scripts/phase2-qa.mts
 */
import { saveManagerChangesBeyondStartCash } from "./startCashGuard.mts";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
/**
 * What the phase work is measured against: the tree before Phases 1–6 (the parent of
 * 412f3bc). These checks were written against HEAD while the work was uncommitted; once
 * committed, HEAD is the work itself, so they compare to this commit (re-baselined 2026-10-22).
 */
const PHASE_BASE = "0ab8a4e";
import {
  DEBRIS,
  JUICE,
  addDebris,
  boardClean,
  boardDebris,
  boardFilm,
  cleanProgress,
  cleanupDue,
  clearDebris,
  debrisLookIds,
  isWet,
  newIngredientBatch,
  resetDebrisForTests,
  startWipe,
  wipeDebris,
} from "../src/game/boardDebris.ts";
import { INGREDIENTS } from "../src/game/definitions.ts";
import { CASH, cashPieceCount, cashPieces, cashRemaining } from "../src/game/cashBurst.ts";
import { TIPS, isTippingOrder, tipAmount, tipFor } from "../src/game/economy/customerTips.ts";
import { INCOME_CATEGORIES, LEDGER_CATEGORY_LABEL } from "../src/game/economy/EconomyLedger.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { rollServiceTickets } from "../src/game/restaurant/serviceTickets.ts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import { restaurantSettlement } from "../src/game/restaurant/restaurantEconomy.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import { payChapterOf } from "../src/game/levels/levelMastery.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

const scene = read("src/game/scenes/PreparationScene.ts");
const prep = read("src/components/kc/game/Preparation.tsx");
const soc = read("src/components/kc/game/ServiceOrderComplete.tsx");
const app = read("src/App.tsx");

/** The body of `signature` up to the next method at class indentation. */
function body(src: string, signature: string): string {
  const at = src.indexOf(signature);
  if (at === -1) return "";
  const rest = src.slice(at + signature.length);
  const end = rest.search(/\n {2}(private |override |create\(|public )/);
  return src.slice(at, at + signature.length + (end === -1 ? rest.length : end));
}

// ─────────────────────────────────────────────────────────────────────────
console.log("A. Cutting debris and the bench scraper");
resetDebrisForTests();
for (let i = 0; i < 200; i++) addDebris("tomato", "Vegetable", 0.5, 1);
assert(
  boardDebris().length === DEBRIS.MAX,
  `A1: debris is bounded at ${DEBRIS.MAX} pieces`,
  boardDebris().length,
);
resetDebrisForTests();
for (let i = 0; i < DEBRIS.CLEAN_AT - 1; i++) addDebris("cucumber", "Vegetable", 0.4, 1);
const beforeDue = cleanupDue();
addDebris("cucumber", "Vegetable", 0.4, 1);
assert(!beforeDue && cleanupDue(), `A2: the scrape is due at exactly ${DEBRIS.CLEAN_AT} pieces`);
clearDebris();
assert(boardDebris().length === 0 && !cleanupDue(), "A3: a scrape leaves a clean board");
resetDebrisForTests();
addDebris("tomato", "Vegetable", 0.3, 12);
const runA = JSON.stringify(boardDebris());
resetDebrisForTests();
addDebris("tomato", "Vegetable", 0.3, 12);
assert(
  runA === JSON.stringify(boardDebris()),
  "A4: deterministic — the same cuts leave the same debris",
);
const kindsOf = (id: Parameters<typeof addDebris>[0], cat: string) => {
  resetDebrisForTests();
  addDebris(id, cat, 0.5, 20);
  return new Set(boardDebris().map((p) => `${p.kind}:${p.color.toString(16)}`));
};
const tomato = kindsOf("tomato", "Vegetable");
const onion = kindsOf("onion", "Vegetable");
const cucumber = kindsOf("cucumber", "Vegetable");
assert(
  [...tomato].some((k) => k.startsWith("seed")) &&
    [...onion].some((k) => k.startsWith("skin")) &&
    // Developer 2026-10-24 ("more realistic leftovers"): cucumber now leaves diced cubes.
    [...cucumber].some((k) => k.startsWith("cube")) &&
    ![...tomato].some((k) => onion.has(k)),
  "A5: each ingredient leaves its own debris (tomato seeds, onion skins, cucumber cubes)",
  { tomato: [...tomato], onion: [...onion] },
);
resetDebrisForTests();
for (const u of [0, 0.2, 0.5, 0.8, 1]) addDebris("carrot", "Vegetable", u, 6);
assert(
  // Developer 2026-10-24 ("make the stains random"): scattered a little wider than before (0.15/0.85, 0.06–0.94).
  boardDebris().every((p) => (p.v <= 0.16 || p.v >= 0.84) && p.u >= 0.04 && p.u <= 0.96),
  "A6: debris sits in the board's far and near margins, clear of the food",
);
assert(
  // Developer 2026-10-24 (realistic debris): one CanvasTexture image instead of one Graphics.
  /this\.add\.image\(0, 0, DEBRIS_TEXTURE\)\.setOrigin\(0\)\.setDepth\(1\)/.test(scene) &&
    (scene.match(/this\.textures\.createCanvas\(DEBRIS_TEXTURE/g) ?? []).length === 1 &&
    /this\.guideGfx\.setDepth\(15\)/.test(scene),
  "A7: one debris image (one canvas) at depth 1 — above the board, below the guides (15), food and knife",
);
const addCalls = scene.match(/this\.addBoardDebris\(/g)?.length ?? 0;
assert(
  addCalls === 4 &&
    /this\.addBoardDebris\(cutPoint\.x, DEBRIS\.PER_CUT, cutPoint\.y\)/.test(scene) &&
    /this\.addBoardDebris\(this\.ingCx, DEBRIS\.PER_PEEL\)/.test(scene) &&
    /this\.addBoardDebris\(x, DEBRIS\.PER_SMASH, y\)/.test(scene) &&
    /this\.addBoardDebris\(this\.ingCx, DEBRIS\.PER_RING\)/.test(scene) &&
    !/addBoardDebris/.test(body(scene, "override update(")),
  "A8: debris only from real actions (cut, peel, smash, ring) — never per frame",
  { addCalls },
);
const down = body(scene, "private onPointerDown(pointer: Phaser.Input.Pointer): void {");
assert(
  down.indexOf("if (this.cleanup)") > 0 &&
    down.indexOf("if (this.cleanup)") < down.indexOf("this.coachTouched") &&
    down.indexOf("if (this.cleanup)") < down.indexOf("hasZoomedIn") &&
    /if \(this\.cleanup\) \{\s*this\.onClothDown\(pointer\);\s*return;/.test(down),
  "A9: while the cloth is out, a touch on the board goes to it and returns before any cut",
);
assert(
  /if \(this\.cleanup\) \{\s*this\.onClothMove\(pointer\);\s*return;/.test(scene) &&
    /if \(this\.cleanup\) \{\s*this\.onClothUp\(\);\s*return;/.test(scene),
  "A10: moves and releases go to the cloth too (no swipe cut can start or finish)",
);
const offers = scene.match(/this\.maybeOfferCleanup\(\);/g)?.length ?? 0;
assert(
  offers === 2 &&
    body(scene, "private onStart(").includes("this.maybeOfferCleanup();") &&
    body(scene, "private onRestart(").includes("this.maybeOfferCleanup();"),
  "A11: the scrape is offered only at the start of an order (and on Prepare Again), never mid-dish",
  { offers },
);
// Developer 2026-10-24: "remove the skip button" (was "Skip is always there"). The cloth needs
// no supplies and every patch can be reached, so the board can always be wiped: no soft-lock.
assert(
  !/CLEANUP_SKIP/.test(scene) &&
    !/board-cleanup-skip|skipCleanup/.test(prep) &&
    !/CLEANUP_SKIP/.test(code("src/game/events.ts")),
  "A12: no Skip — the board is wiped every time (it needs nothing the player could lack)",
);
assert(
  /this\.cleanup\?\.dragging && !this\.input\.activePointer\.isDown\) this\.onClothUp\(\)/.test(
    scene,
  ),
  "A13: a wipe the browser never ended (lost focus, cancelled touch) is let go",
);
assert(
  /if \(this\.cleanup\) return true;/.test(body(scene, "private coachBlocked(): boolean {")),
  "A14: no knife demonstration over the cloth",
);
// Developer 2026-10-24 ("make the cleaning a little slow and satisfying"; then "make the
// user wipe the board each and every corner, don't make it too easy"): the cloth rubs the
// mess AND a film over the whole board away over many strokes (was: one broad scraper sweep).
{
  // One stroke: the cloth drawn once across the board along one row (rows top to bottom, then again).
  const rows = [0.08, 0.3, 0.5, 0.7, 0.92];
  let strokes = 0;
  const stroke = (from = 0, to = 1, rowList = rows) => {
    const v = rowList[strokes % rowList.length]!;
    const back = Math.floor(strokes / rowList.length) % 2 === 1;
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a0 = from + ((to - from) * k) / n;
      const a1 = from + ((to - from) * (k + 1)) / n;
      back ? wipeDebris(1 - a0, v, 1 - a1, v) : wipeDebris(a0, v, a1, v);
    }
    strokes++;
  };
  const messy = () => {
    resetDebrisForTests();
    for (let i = 0; i < 34; i++) addDebris("tomato", "Vegetable", (i % 10) / 10, 1, 0.5);
    startWipe();
    strokes = 0;
  };
  messy();
  stroke();
  const after1 = cleanProgress();
  while (!boardClean() && strokes < 80) stroke();
  assert(
    after1 > 0.02 && after1 < 0.3 && strokes >= 10 && strokes <= 40 && cleanProgress() === 1,
    "A15: the cloth cleans the whole board over many strokes (slow, satisfying) — one sweep is nowhere near, nor does it take forever",
    { after1, strokes },
  );
  // Rub only the middle of the board, as long as you like: the corners stay dirty.
  messy();
  for (let i = 0; i < 120; i++) stroke(0.25, 0.75, [0.35, 0.5, 0.65]);
  const middleOnly = { clean: boardClean(), progress: cleanProgress() };
  for (let i = 0; i < 40 && !boardClean(); i++) stroke();
  assert(
    !middleOnly.clean && middleOnly.progress < 1 && boardClean(),
    "A15c: every corner and edge needs the cloth — rubbing only the middle never finishes; the corners do",
    middleOnly,
  );
  assert(
    boardFilm().length === DEBRIS.FILM_COLS * DEBRIS.FILM_ROWS &&
      DEBRIS.FILM_COLS >= 6 &&
      DEBRIS.FILM_ROWS >= 4,
    "A15d: the film covers the whole board in patches",
  );
  resetDebrisForTests();
  addDebris("tomato", "Vegetable", 0.5, 4, 0.5);
  wipeDebris(0.2, 0.5, 0.25, 0.5);
  assert(
    cleanProgress() === 0 || boardDebris().every((p) => p.wear < 1),
    "A15b: a short rub far from the mess cleans nothing",
  );
}
const endBody = body(scene, "private endCleanup(");
assert(
  /c\.img\.destroy\(\)/.test(endBody) &&
    /c\.shadow\.destroy\(\)/.test(endBody) &&
    /this\.tweens\.killTweensOf\(\[c\.img, c\.shadow\]\)/.test(endBody) &&
    /this\.knifeGfx\.setVisible\(true\)/.test(endBody) &&
    /this\.guideGfx\.setVisible\(true\)/.test(endBody) &&
    /for \(const im of this\.pieceImages\.values\(\)\)/.test(endBody),
  "A16: ending the cleanup puts the cloth away, stops its tweens, gives the knife back and sets the ingredient down",
);
// Developer 2026-10-24: "do not show the next ingredient before cleaning the cutting board".
const offerBody = body(scene, "private maybeOfferCleanup(");
assert(
  /for \(const im of this\.pieceImages\.values\(\)\) im\.setAlpha\(0\);/.test(offerBody) &&
    /this\.guideGfx\.setVisible\(false\)/.test(offerBody),
  "A19: while the cloth is out the next ingredient (and its guides) wait off the board",
);
const near = (a: number, b: number, d: number) =>
  [16, 8, 0].every((sh) => Math.abs(((a >> sh) & 255) - ((b >> sh) & 255)) <= d);
// Developer 2026-10-24: "make the stains random, like cutting different tomatoes different stains".
{
  const cut = (seed: number, batches = false) => {
    resetDebrisForTests(seed);
    for (let t = 0; t < 3; t++) {
      if (batches) newIngredientBatch();
      for (let i = 0; i < 8; i++) addDebris("tomato", "Vegetable", 0.5, 1, 0.5);
    }
    return JSON.stringify(boardDebris());
  };
  const sameSeed = cut(7) === cut(7);
  const otherSeed = cut(7) !== cut(8);
  resetDebrisForTests(11);
  newIngredientBatch();
  for (let i = 0; i < 8; i++) addDebris("tomato", "Vegetable", 0.5, 1, 0.5);
  const first = boardDebris().filter((p) => p.kind === "juice");
  clearDebris();
  newIngredientBatch();
  for (let i = 0; i < 8; i++) addDebris("tomato", "Vegetable", 0.5, 1, 0.5);
  const second = boardDebris().filter((p) => p.kind === "juice");
  const colours = new Set(first.map((p) => p.color));
  assert(
    sameSeed &&
      otherSeed &&
      JSON.stringify(first) !== JSON.stringify(second) &&
      colours.size > 1 &&
      !/Math\.random\(/.test(code("src/game/boardDebris.ts")) &&
      /getRandomValues/.test(code("src/game/boardDebris.ts")),
    "A22: random stains — a new session, and each new tomato, stains differently (shades, sizes, places); tests fix the seed; no Math.random",
    { pools: [first.length, second.length], shades: colours.size },
  );
  assert(
    /newIngredientBatch\(\);/.test(body(scene, "private beginFreshIngredient(")),
    "A23: every fresh ingredient gets its own juiciness and tone",
  );
}
// Developer 2026-10-24: "optimise the stains for all ingredients".
{
  const ids = Object.keys(INGREDIENTS) as (keyof typeof INGREDIENTS)[];
  const own = new Set(debrisLookIds());
  const missing = ids.filter((id) => !own.has(id));
  const juicyFruit = ids.filter(
    (id) => INGREDIENTS[id].category === "Fruit" && id !== "coconut" && !JUICE[id],
  );
  assert(
    missing.length === 0 && juicyFruit.length === 0 && !!JUICE.steak && !JUICE.bread,
    "A24: every ingredient has its own leftovers; every fruit, the watery veg and the meats spill their own juice (bread doesn't)",
    { missing, juicyFruit },
  );
}
// Developer 2026-10-24: "for juicy ingredients make it juicy … let it spill while cutting".
{
  resetDebrisForTests();
  for (let i = 0; i < 12; i++) addDebris("tomato", "Vegetable", 0.5, 1, 0.5);
  const wet = boardDebris().filter((p) => isWet(p.kind));
  resetDebrisForTests();
  for (let i = 0; i < 12; i++) addDebris("carrot", "Vegetable", 0.5, 1, 0.5);
  const dry = boardDebris().filter((p) => isWet(p.kind));
  resetDebrisForTests();
  for (let i = 0; i < 200; i++) addDebris("watermelon", "Fruit", 0.5, 1, 0.5);
  const wetMax = boardDebris().filter((p) => isWet(p.kind)).length;
  const due = cleanupDue();
  resetDebrisForTests();
  for (let i = 0; i < DEBRIS.CLEAN_AT - 1; i++) addDebris("tomato", "Vegetable", 0.5, 1, 0.5);
  assert(
    wet.some((p) => p.kind === "juice") &&
      // Each drop and pool is its own shade of the ingredient's juice (developer 2026-10-24: random stains).
      wet.every((p) => Math.abs(p.v - 0.5) < 0.3 && near(p.color, JUICE.tomato!.color, 60)) &&
      dry.length === 0 &&
      wetMax <= DEBRIS.MAX_WET &&
      due &&
      !cleanupDue(),
    "A20: juicy cuts spill juice at the cut (pools and drops in the ingredient's colour); dry ones don't; bounded; juice never brings the cloth sooner",
    { wet: wet.length, dry: dry.length, wetMax },
  );
  assert(
    /addDebris\(\s*this\.ingredientId,\s*this\.ingredient\.category,\s*u,\s*count,\s*v,\s*this\.variantTint\(\),?\s*\)/.test(
      scene,
    ) &&
      /paintDebrisPiece\(/.test(scene) &&
      /paintCloth\(/.test(scene),
    "A21: the scene paints the debris and the cloth with textures/boardMess.ts",
  );
}
assert(
  /this\.clothGestureLeft = this\.input\.activePointer\.isDown;/.test(
    body(scene, "private endCleanup("),
  ) &&
    /if \(this\.clothGestureLeft\) return;/.test(body(scene, "private onPointerMove(")) &&
    /if \(this\.clothGestureLeft\) \{\s*this\.clothGestureLeft = false;\s*return;/.test(
      body(scene, "private onPointerUp("),
    ),
  "A25: a rub still going when the board comes clean never turns into a cut (the next tap cuts)",
);
// Developer 2026-10-24: "for yellow tomato add yellow splashing not red".
{
  resetDebrisForTests(3);
  for (let i = 0; i < 10; i++) addDebris("tomato", "Vegetable", 0.5, 1, 0.5, 0xf6c84a);
  const wet = boardDebris().filter((p) => p.kind === "juice" || p.kind === "drop");
  const yellow = (c: number) => ((c >> 8) & 255) > 140 && ((c >> 16) & 255) > 180;
  assert(
    wet.length > 0 &&
      wet.every((p) => yellow(p.color)) &&
      !wet.some((p) => near(p.color, 0xc4301e, 60)),
    "A26: a Golden Tomato bleeds gold, not red (its scraps lean gold too)",
    { shades: wet.slice(0, 3).map((p) => p.color.toString(16)) },
  );
}
const debrisCode = code("src/game/boardDebris.ts");
assert(
  !/SaveData|localStorage|persist|credits|ledger/i.test(debrisCode),
  "A17: debris is presentation only — no save, no wallet",
);
assert(
  !/addDebris|cleanupDue|clearDebris|boardDebris/.test(
    body(scene, "private commitCut(").replace(/this\.addBoardDebris\([^)]*\);/, ""),
  ) && !/grade|score|requiredCuts/.test(body(scene, "private addBoardDebris(")),
  "A18: cleanup never touches cuts, grading or recipe progress",
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nB. Cash burst and swipe-to-vacuum");
const payments: [number, number][] = [];
for (const pay of [1, 3, 99, 100, 427, 1234, 5000, 12345, 99999, 250000, 1234567])
  for (const tip of [0, 500, 1200, 25000]) payments.push([pay, tip]);
const sumsExact = payments.every(([pay, tip]) => {
  const ps = cashPieces(pay, tip);
  const total = ps.reduce((s, p) => s + p.cents, 0);
  const tipSum = ps.filter((p) => p.tip).reduce((s, p) => s + p.cents, 0);
  return (
    total === pay + tip &&
    tipSum === tip &&
    ps.every((p) => p.cents >= 1 && Number.isInteger(p.cents))
  );
});
assert(
  sumsExact,
  "B1: the pieces add up EXACTLY to the payment (and the gold ones to the tip), whole cents",
);
assert(
  payments.every(([pay, tip]) => {
    const n = cashPieces(pay, tip).length;
    return n <= CASH.MAX_PIECES && (n >= CASH.MIN_PIECES || n === pay + tip);
  }) && cashPieceCount(10_000_000_000) === CASH.MAX_PIECES,
  `B2: the number of pieces is bounded (${CASH.MIN_PIECES}–${CASH.MAX_PIECES}) — no flood for big payments`,
);
assert(
  JSON.stringify(cashPieces(4321, 500)) === JSON.stringify(cashPieces(4321, 500)) &&
    cashPieces(0, 0).length === 0,
  "B3: deterministic, and no pieces for a payment of nothing",
);
const ps = cashPieces(12345, 1200);
const half = ps.map((_, i) => i % 2 === 0);
assert(
  cashRemaining(ps, half) === ps.filter((_, i) => i % 2 !== 0).reduce((s, p) => s + p.cents, 0) &&
    cashRemaining(
      ps,
      ps.map(() => true),
    ) === 0,
  "B4: what is left on the counter is exactly the uncollected pieces",
);
const vacuumCode = code("src/components/kc/game/CashVacuum.tsx") + code("src/game/cashBurst.ts");
assert(
  !/persist\(|appendLedgerEntry|credits\s*[+-]=|SaveData|localStorage/.test(vacuumCode),
  "B5: the cash never credits, records or saves anything (the payment is already in the wallet)",
);
assert(
  /if \(collected\.current\[i\]\) return;\s*collected\.current\[i\] = true;/.test(
    read("src/components/kc/game/CashVacuum.tsx"),
  ),
  "B6: each piece can be collected once — every path (swipe, auto) goes through one guarded collect",
);
assert(
  /useRolledNumber\(credits - remaining, reduced\)/.test(soc) &&
    /<CurrencyPill amount=\{shownCredits\} \/>/.test(soc),
  "B7: the wallet shows the real balance minus the cash still on the counter (lands on it exactly)",
);
assert(
  /if \(serveLatch\.current\) return;\s*serveLatch\.current = true;/.test(soc),
  "B8: Serve is latched — a double tap cannot serve, pay or tip twice",
);
const vac = read("src/components/kc/game/CashVacuum.tsx");
assert(
  /touch-none/.test(vac) &&
    /setPointerCapture\(e\.pointerId\)/.test(vac) &&
    /onPointerCancel=/.test(vac) &&
    /onLostPointerCapture=/.test(vac),
  "B9: the tray owns its pointer (capture, no touch scroll) and survives cancelled swipes",
);
// The toggle (and its state) moved from the tray to the serve card's wallet row
// so the card fits 320×568; the tray is told by an `auto` prop.
assert(
  /let autoCollect = false;/.test(read("src/game/cashBurst.ts")) &&
    /useState\(\(\) => reduced \|\| autoCollectOn\(\)\)/.test(soc) &&
    /auto=\{auto\}/.test(soc) &&
    /auto: boolean;/.test(vac),
  "B10: auto-collect is a session option (no save field), always on with Reduced Motion",
);
assert(
  CASH.HIT_RADIUS_PX >= 24,
  "B11: a generous pick-up radius — a sweep, not a hunt for tiny targets",
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nC. Customer tips");
const base = { levelId: "level-7", recipeId: "camp-x", orderIndex: 0, payCents: 12345 };
// Find one selected and one unselected order identity for the rule checks.
let pickIdx = -1;
let skipIdx = -1;
for (let i = 0; i < 50 && (pickIdx < 0 || skipIdx < 0); i++) {
  if (isTippingOrder(base.levelId, base.recipeId, i)) pickIdx = pickIdx < 0 ? i : pickIdx;
  else skipIdx = skipIdx < 0 ? i : skipIdx;
}
// Rule changed (developer 2026-10-26, "let them leave some tips along with payment"): every
// first-paid order tips by its dish's grade — Masterful 15 %, Clean 10 %, Honest 5 %, a weaker
// dish none — in whole dollars, at least $1. Was: Masterful only, one order in three, 10 %, $5+.
assert(
  tipFor({ ...base, orderIndex: pickIdx, firstPayment: false, score: 100 }) === 0,
  "C1: a replay (not a first payment) never tips",
);
assert(
  tipFor({ ...base, firstPayment: true, score: 69 }) === 0 &&
    tipFor({ ...base, firstPayment: true, score: 49 }) === 0,
  "C2: a Rustic (69) or Learning (49) dish never tips",
);
assert(
  tipFor({ ...base, orderIndex: skipIdx, firstPayment: true, score: 100 }) === 1900 &&
    tipFor({ ...base, orderIndex: pickIdx, firstPayment: true, score: 100 }) === 1900,
  "C3: every customer tips — the same Masterful tip whatever the order's place in the level",
);
assert(
  tipFor({ ...base, firstPayment: true, score: 100 }) === 1900 &&
    tipFor({ ...base, firstPayment: true, score: 90 }) === 1200 &&
    tipFor({ ...base, firstPayment: true, score: 75 }) === 600,
  "C4: the tip follows the grade: $123.45 → Masterful $19, Clean $12, Honest $6 (whole dollars)",
);
assert(
  tipAmount(1000, 0.05) === TIPS.MIN_CENTS &&
    tipAmount(12345) === 1200 &&
    tipAmount(99950) === 10000,
  "C5: fixed configured amounts — at least $1, otherwise the share rounded to whole dollars",
);
assert(
  tipFor({ ...base, orderIndex: pickIdx, firstPayment: true, score: 100, payCents: 0 }) === 0,
  "C6: an order that paid nothing never tips",
);
assert(
  !/Math\.random|Date\.now|performance\.now/.test(code("src/game/economy/customerTips.ts")) &&
    [0, 1, 2, 3].every(
      (i) =>
        tipFor({ ...base, orderIndex: i, firstPayment: true, score: 88 }) ===
        tipFor({ ...base, orderIndex: i, firstPayment: true, score: 88 }),
    ),
  "C7: deterministic — no random numbers or clocks; the same order and grade always tip the same",
);

// The REAL campaign, every order played Masterful (the worst case for tips).
let orders = 0;
let picked = 0;
let settlements = 0;
let tips = 0;
let rewards = 0;
for (const level of LEVELS) {
  if (level.campaignNoEconomy) continue;
  rewards += paidLevelReward(level);
  rollServiceTickets(level).forEach((recipe, idx) => {
    const pay = restaurantSettlement(
      computeSettlement(recipe, payChapterOf(level), 100),
      0,
    ).netResult;
    orders++;
    settlements += pay;
    const tip = tipFor({
      firstPayment: true,
      levelId: level.id,
      recipeId: recipe.id,
      orderIndex: idx,
      score: 100,
      payCents: pay,
    });
    if (tip > 0) picked++;
    tips += tip;
  });
}
// Since 2026-10-26 every paid order tips (by grade), so at 100 every order tips.
assert(
  orders > 100 && picked === orders,
  "C8: over the real campaign every paid Masterful order tips",
  { orders, picked },
);
const share = tips / (settlements + rewards);
assert(
  share <= TIPS.MAX_SHARE_OF_INCOME,
  `C9: worst case (every order Masterful, 15 %) tips add <= ${TIPS.MAX_SHARE_OF_INCOME * 100}% to campaign income`,
  {
    tips: `$${(tips / 100).toFixed(0)}`,
    income: `$${((settlements + rewards) / 100).toFixed(0)}`,
    share: `${(share * 100).toFixed(2)}%`,
  },
);
for (const fn of ["function serveCampaignOrder(", "function serveBatchGroupViewedOrder("]) {
  // The whole function: from its signature to the next top-level `function` in App.
  const start = app.indexOf(fn);
  const next = app.indexOf("\n  function ", start + fn.length);
  const b = app.slice(start, next === -1 ? undefined : next);
  const guarded = b.indexOf("if (base && !isReplay) {");
  assert(
    guarded > 0 &&
      b.indexOf("tip = tipFor(") > guarded &&
      /credits: base\.credits \+ result\.coinsAwarded \+ tip,/.test(b) &&
      /"campaign-settlement",\s*result\.coinsAwarded,/.test(b) &&
      /"customer-tip",\s*tip,/.test(b) &&
      /persist\(applySharpnessDecay\(withTip,/.test(b),
    `C10: ${fn.replace("function ", "").replace("(", "")}: the tip is computed only on a first payment and credited in the SAME save as the order pay, as its own entry — the settlement entry is unchanged`,
  );
}
assert(
  /"customer-tip"/.test(read("src/game/economy/ledgerTypes.ts")) &&
    INCOME_CATEGORIES.includes("customer-tip") &&
    LEDGER_CATEGORY_LABEL["customer-tip"] === "Customer Tip",
  "C11: the tip has its own (approved) ledger category, counted as income, labelled",
);
assert(
  /const tip = served && !served\.isReplay \? \(served\.tip \?\? 0\) : 0;/.test(soc) &&
    /\{tip > 0 \? \(/.test(soc) &&
    /payCents=\{paidCents\}\s*tipCents=\{tip\}/.test(soc),
  "C12: the serve card shows the tip line only for a real tip, and the cash includes it",
);
assert(
  // (Phase 4 put the special customers' own mood in front of this rule; it is unchanged.)
  /served\?\.quality === "Masterful"\s*\?\s*"cheer"\s*:\s*served\?\.quality === "Clean"\s*\?\s*"nod"\s*:\s*null/.test(
    soc,
  ) && /quality: qualityFor\(order\.preparationScore \?\? 0\)/.test(app),
  "C13: the customer reacts to the dish's own grade — the score its pay came from",
);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nD. Saves and the economy");
const saveDiff = // Rule changed (developer 2026-10-26, "the game starts at 0 cash"): SaveManager may change
  // only the new save's opening credits (scripts/startCashGuard.mts).
  saveManagerChangesBeyondStartCash(PHASE_BASE, ROOT).join("\n") +
  execSync(`git diff --stat ${PHASE_BASE} -- src/types`, {
    cwd: ROOT,
    encoding: "utf8",
  });
assert(
  saveDiff.trim() === "",
  "D1: no save-schema change (SaveManager.ts and src/types untouched)",
  saveDiff.trim(),
);
const ledgerWrites = (app.match(/appendLedgerEntry\(/g) ?? []).length;
const headApp = execSync(`git show ${PHASE_BASE}:src/App.tsx`, {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 1 << 26,
});
const headWrites = (headApp.match(/appendLedgerEntry\(/g) ?? []).length;
assert(
  ledgerWrites === headWrites + 2 &&
    (code("src/App.tsx").match(/"customer-tip"/g) ?? []).length === 2,
  "D2: the only new money paths are the two approved tip entries (one per first-payment path)",
  { before: headWrites, now: ledgerWrites },
);

console.log(failures === 0 ? "\nPHASE 2 QA: ALL PASS" : `\nPHASE 2 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
