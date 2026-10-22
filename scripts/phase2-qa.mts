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
  addDebris,
  boardDebris,
  cleanupDue,
  clearDebris,
  resetDebrisForTests,
} from "../src/game/boardDebris.ts";
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
    [...cucumber].some((k) => k.startsWith("scrap")) &&
    ![...tomato].some((k) => onion.has(k)),
  "A5: each ingredient leaves its own debris (tomato seeds, onion skins, cucumber scraps)",
  { tomato: [...tomato], onion: [...onion] },
);
resetDebrisForTests();
for (const u of [0, 0.2, 0.5, 0.8, 1]) addDebris("carrot", "Vegetable", u, 6);
assert(
  boardDebris().every((p) => (p.v <= 0.15 || p.v >= 0.85) && p.u >= 0.06 && p.u <= 0.94),
  "A6: debris sits in the board's far and near margins, clear of the food",
);
assert(
  /this\.debrisGfx = this\.add\.graphics\(\)\.setDepth\(1\);/.test(scene) &&
    /this\.guideGfx\.setDepth\(15\)/.test(scene),
  "A7: one Graphics at depth 1 — above the board, below the guides (15), food and knife",
);
const addCalls = scene.match(/this\.addBoardDebris\(/g)?.length ?? 0;
assert(
  addCalls === 4 &&
    /this\.addBoardDebris\(cutPoint\.x, DEBRIS\.PER_CUT\)/.test(scene) &&
    /this\.addBoardDebris\(this\.ingCx, DEBRIS\.PER_PEEL\)/.test(scene) &&
    /this\.addBoardDebris\(x, DEBRIS\.PER_SMASH\)/.test(scene) &&
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
    /if \(this\.cleanup\) \{\s*this\.onScraperDown\(pointer\);\s*return;/.test(down),
  "A9: while the scraper is out, a touch on the board goes to it and returns before any cut",
);
assert(
  /if \(this\.cleanup\) \{\s*this\.onScraperMove\(pointer\);\s*return;/.test(scene) &&
    /if \(this\.cleanup\) \{\s*this\.onScraperUp\(\);\s*return;/.test(scene),
  "A10: moves and releases go to the scraper too (no swipe cut can start or finish)",
);
const offers = scene.match(/this\.maybeOfferCleanup\(\);/g)?.length ?? 0;
assert(
  offers === 2 &&
    body(scene, "private onStart(").includes("this.maybeOfferCleanup();") &&
    body(scene, "private onRestart(").includes("this.maybeOfferCleanup();"),
  "A11: the scrape is offered only at the start of an order (and on Prepare Again), never mid-dish",
  { offers },
);
assert(
  /this\.bus\.on\(CMD\.CLEANUP_SKIP/.test(scene) &&
    /data-testid="board-cleanup-skip"/.test(prep) &&
    /bridge\.skipCleanup\(\)/.test(prep),
  "A12: Skip is always there — the scrape can never hold a player up",
);
assert(
  /this\.cleanup\?\.dragging && !this\.input\.activePointer\.isDown\) this\.onScraperUp\(\)/.test(
    scene,
  ),
  "A13: a scrape the browser never ended (lost focus, cancelled touch) is let go",
);
assert(
  /if \(this\.cleanup\) return true;/.test(body(scene, "private coachBlocked(): boolean {")),
  "A14: no knife demonstration over the scraper",
);
assert(
  /c\.travel >= DEBRIS\.SWEEP_FRAC \* \(m\.right - m\.left\)/.test(scene) &&
    DEBRIS.SWEEP_FRAC > 0.25 &&
    DEBRIS.SWEEP_FRAC <= 0.6,
  "A15: one broad sweep cleans (a share of the board's width, not pixel-perfect)",
);
const endBody = body(scene, "private endCleanup(");
assert(
  /c\.gfx\.destroy\(\)/.test(endBody) &&
    /this\.tweens\.killTweensOf\(c\)/.test(endBody) &&
    /this\.knifeGfx\.setVisible\(true\)/.test(endBody),
  "A16: ending the cleanup destroys the scraper, stops its tweens and gives the knife back",
);
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
assert(
  tipFor({ ...base, orderIndex: pickIdx, firstPayment: false, score: 100 }) === 0,
  "C1: a replay (not a first payment) never tips",
);
assert(
  tipFor({ ...base, orderIndex: pickIdx, firstPayment: true, score: 94 }) === 0,
  "C2: a dish that isn't Masterful (94) never tips, even for a tipping customer",
);
assert(
  tipFor({ ...base, orderIndex: skipIdx, firstPayment: true, score: 100 }) === 0,
  "C3: a Masterful dish for a non-tipping order gets no tip (it is occasional)",
);
assert(
  tipFor({ ...base, orderIndex: pickIdx, firstPayment: true, score: 100 }) === 1200,
  "C4: Masterful + tipping order: 10% of the pay in whole dollars ($123.45 → $12.00)",
);
assert(
  tipAmount(1000) === TIPS.MIN_CENTS && tipAmount(12345) === 1200 && tipAmount(99950) === 10000,
  "C5: fixed configured amounts — at least $5, otherwise 10% rounded to whole dollars",
);
assert(
  tipFor({ ...base, orderIndex: pickIdx, firstPayment: true, score: 100, payCents: 0 }) === 0,
  "C6: an order that paid nothing never tips",
);
assert(
  !/Math\.random|Date\.now|performance\.now/.test(code("src/game/economy/customerTips.ts")) &&
    [0, 1, 2, 3].every(
      (i) => isTippingOrder("level-3", "camp-y", i) === isTippingOrder("level-3", "camp-y", i),
    ),
  "C7: deterministic — no random numbers or clocks; the same order always tips or never does",
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
const rate = picked / Math.max(1, orders);
// A fair 1-in-N pick lands within 2 standard deviations of orders / N; the
// unmixed FNV-1a picked 98 of 242 (40.5%), outside it (see customerTips.ts).
const p = 1 / TIPS.EVERY_NTH;
const twoSigma = 2 * Math.sqrt(orders * p * (1 - p));
assert(
  orders > 100 && Math.abs(picked - orders * p) <= twoSigma,
  `C8: over the real campaign 1 in ${TIPS.EVERY_NTH} paid orders is a tipping one (within 2σ of chance)`,
  {
    orders,
    picked,
    expected: +(orders * p).toFixed(1),
    twoSigma: +twoSigma.toFixed(1),
    rate: +rate.toFixed(3),
  },
);
const share = tips / (settlements + rewards);
assert(
  share <= TIPS.MAX_SHARE_OF_INCOME,
  `C9: worst case (every order Masterful) tips add <= ${TIPS.MAX_SHARE_OF_INCOME * 100}% to campaign income`,
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
const saveDiff = execSync(`git diff --stat ${PHASE_BASE} -- src/game/SaveManager.ts src/types`, {
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
