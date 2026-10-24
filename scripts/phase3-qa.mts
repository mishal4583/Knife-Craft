/**
 * PHASE3_QA — Phase 3 "Fever Mode, Endless Prep Rush, the Kitchen Chaos
 * Director and Special Ingredient Variants" (developer 2026-10-21):
 *   A. Fever Mode (src/game/fever.ts, PreparationScene, Preparation.tsx);
 *   B. Endless Prep Rush (src/game/prepRush.ts, PrepRushScene, PrepRushBridge,
 *      components/kc/prepRush) — rules, determinism, bounds, isolation;
 *   C. the Kitchen Chaos Director (src/game/kitchenChaos.ts, specialsReport.ts) —
 *      cadence, rotation, eligibility, the six events' hooks, report words;
 *   D. Special Ingredient Variants (src/game/specialVariants.ts);
 *   E. no save field, no money, no new ingredient, no production test hook.
 *
 * Run: npx tsx scripts/phase3-qa.mts
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
import { FEVER, FEVER_ON_A_MILESTONE, feverLights } from "../src/game/fever.ts";
import {
  EMPTY_STATS,
  PREP_RUSH,
  intervalAt,
  isCleanCut,
  recordRushScore,
  rushOver,
  rushSequence,
  rushSessionBest,
  scoreCut,
  scoreMiss,
  segmentNear,
  speedAt,
} from "../src/game/prepRush.ts";
import {
  CHAOS,
  CHAOS_COPY,
  chaosEventFits,
  chaosForOrder,
  forceNextChaos,
  isChaosSlot,
  resetChaosForTests,
  type ChaosContext,
  type ChaosEventId,
} from "../src/game/kitchenChaos.ts";
import {
  VARIANTS,
  VARIANT_CADENCE,
  forceNextVariant,
  resetVariantsForTests,
  variantForOrder,
  variantOf,
  withArticle,
  type VariantId,
} from "../src/game/specialVariants.ts";
import { specialsReportLines } from "../src/game/specialsReport.ts";
import {
  COMBO,
  INGREDIENTS,
  TECHNIQUES,
  requiredCutsFor,
  resolveTechniqueFor,
} from "../src/game/definitions.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { taughtTechniques } from "../src/game/coaching.ts";

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
/** The body of `signature` up to the next member at class indentation. */
function body(src: string, signature: string): string {
  const at = src.indexOf(signature);
  if (at === -1) return "";
  const rest = src.slice(at + signature.length);
  const end = rest.search(/\n {2}(private |override |create\(|public |get )/);
  return src.slice(at, at + signature.length + (end === -1 ? rest.length : end));
}

const scene = code("src/game/scenes/PreparationScene.ts");
const prep = code("src/components/kc/game/Preparation.tsx");
const app = code("src/App.tsx");
const bridge = code("src/game/GameBridge.ts");
const css = read("src/styles.css");

/** Every campaign order's steps with their real cut counts (the scene's own rules). */
const campaign = LEVELS.map((l, i) => {
  const steps = l.preparationSteps.map((s) => {
    const t = resolveTechniqueFor(TECHNIQUES[s.technique], INGREDIENTS[s.ingredient]);
    return {
      ingredient: s.ingredient,
      mode: t.interactionMode,
      cuts: t.interactionMode === "cut" ? requiredCutsFor(t) : 0,
    };
  });
  return {
    n: i + 1,
    id: l.id,
    steps,
    teaches: taughtTechniques(
      l.id,
      l.preparationSteps.map((s) => s.technique),
    ).length,
  };
});

// ───────────────────────────────────────────────────────────── A. Fever
assert(
  FEVER_ON_A_MILESTONE && (COMBO.MILESTONES as readonly number[]).includes(FEVER.AT_COMBO),
  "A1: Fever lights on an existing combo milestone (×10), not a new threshold",
);
assert(
  !feverLights(FEVER.AT_COMBO - 1, false, false) &&
    feverLights(FEVER.AT_COMBO, false, false) &&
    !feverLights(FEVER.AT_COMBO, true, false) &&
    !feverLights(FEVER.AT_COMBO + 3, false, true),
  "A2: lights at ×10, not before, never twice an order, never while already on",
);
const startFever = body(scene, "private startFever(");
const endFever = body(scene, "private endFever(");
assert(
  /this\.time\.delayedCall\(FEVER\.MS/.test(startFever),
  "A3: Fever runs on the scene clock (it pauses with the game)",
);
assert(
  /this\.endFever\("plating"\)/.test(body(scene, "private startPlating(")) &&
    /this\.endFever\("restart"\)/.test(body(scene, "private onStart(")) &&
    /this\.endFever\("restart"\)/.test(body(scene, "private onRestart(")) &&
    /this\.feverUsed = false/.test(body(scene, "private onRestart(")),
  "A4: Fever ends at plating, on a new order and on restart (and a restart may light it again)",
);
assert(
  /gfx\.destroy\(\)/.test(endFever) && /timer|remove/.test(endFever),
  "A5: ending Fever destroys its graphics and its timer (bounded, no leftovers)",
);
const evaluator = code("src/game/CutEvaluator.ts");
assert(
  !/fever/i.test(evaluator) && !/fever/i.test(body(scene, "private finishRecipe(")),
  "A6: Fever never touches grading (CutEvaluator and the result have no Fever input)",
);
assert(
  /kc-reduced-motion \.kc-fever-vignette[\s\S]*?animation: none/.test(css) &&
    /prefers-reduced-motion[\s\S]*?\.kc-fever-vignette[\s\S]*?animation: none/.test(css) &&
    /if \(this\.reducedMotion\(\)\) return;/.test(body(scene, "private spawnFeverFlecks(")),
  "A7: Reduced Motion stops the vignette's breathing and the flecks",
);
assert(
  /EVT\.FEVER/.test(bridge) && /event\.type === "FEVER"/.test(prep),
  "A8: the bridge forwards Fever and the UI reacts to it",
);
const feverReachable = campaign.filter((o) => o.steps.some((s) => s.cuts >= FEVER.AT_COMBO));
assert(
  feverReachable.length / campaign.length > 0.8,
  `A9: Fever is reachable in most real campaign orders (${feverReachable.length}/${campaign.length} have a step of ${FEVER.AT_COMBO}+ cuts)`,
);

// ───────────────────────────────────────────────────────────── B. Prep Rush
{
  const speeds = Array.from({ length: 30 }, (_, i) => speedAt(i * 5000));
  const gaps = Array.from({ length: 30 }, (_, i) => intervalAt(i * 5000));
  assert(
    speeds.every((v, i) => i === 0 || v >= speeds[i - 1]!) &&
      Math.max(...speeds) <= PREP_RUSH.SPEED_MAX &&
      gaps.every((v, i) => i === 0 || v <= gaps[i - 1]!) &&
      Math.min(...gaps) >= PREP_RUSH.INTERVAL_MIN_MS,
    "B1: difficulty only rises, in steps, and stays within its caps",
  );
  assert(
    speedAt(PREP_RUSH.STEP_MS - 1) === PREP_RUSH.SPEED_START &&
      intervalAt(PREP_RUSH.STEP_MS - 1) === PREP_RUSH.INTERVAL_START_MS,
    "B2: the first step is the gentle start",
  );
  const a = rushSequence();
  const b = rushSequence();
  const seqA = Array.from({ length: 1000 }, () => a());
  const seqB = Array.from({ length: 1000 }, () => b());
  let triple = false;
  for (let i = 2; i < seqA.length; i++)
    if (seqA[i] === seqA[i - 1] && seqA[i] === seqA[i - 2]) triple = true;
  assert(
    seqA.join() === seqB.join() && !triple && PREP_RUSH.KINDS.every((k) => seqA.includes(k)),
    "B3: the ingredient sequence is seeded (same every run), varied, never 3 of a kind in a row",
  );
  let s = EMPTY_STATS;
  for (let i = 0; i < 5; i++) s = scoreCut(s, i % 2 === 0);
  assert(
    s.prepared === 5 &&
      s.clean === 3 &&
      s.score ===
        5 * PREP_RUSH.POINTS.PREPARED + 3 * PREP_RUSH.POINTS.CLEAN + PREP_RUSH.POINTS.COMBO_BONUS &&
      s.combo === 5,
    "B4: scoring — per cut, + clean, + the combo bonus every 5 in a row",
    s,
  );
  const m = scoreMiss(s);
  assert(
    m.combo === 0 && m.missed === 1 && m.score === s.score && m.bestCombo === 5,
    "B5: a miss resets the run (best run kept), costs no points",
  );
  assert(
    rushOver(PREP_RUSH.DURATION_MS, EMPTY_STATS) &&
      rushOver(0, { ...EMPTY_STATS, missed: PREP_RUSH.MAX_MISSES }) &&
      !rushOver(PREP_RUSH.DURATION_MS - 1, { ...EMPTY_STATS, missed: PREP_RUSH.MAX_MISSES - 1 }),
    "B6: the run ends on time or on misses, whichever first",
  );
  assert(
    isCleanCut({ x: 100, y: 0 }, { x: 100, y: 10 }, 100, 50, 30) &&
      !isCleanCut({ x: 125, y: 0 }, { x: 125, y: 10 }, 100, 50, 30) &&
      segmentNear({ x: 0, y: 50 }, { x: 200, y: 50 }, 100, 60, 20) &&
      !segmentNear({ x: 0, y: 50 }, { x: 40, y: 50 }, 100, 50, 20),
    "B7: clean = through the middle; a stroke crosses only what it reaches",
  );
  const first = recordRushScore(40);
  const lower = recordRushScore(10);
  assert(
    first.isNew && !lower.isNew && rushSessionBest() === 40,
    "B8: the session best keeps the highest score (memory only)",
  );
  const rushFiles = [
    "src/game/prepRush.ts",
    "src/game/scenes/PrepRushScene.ts",
    "src/game/PrepRushBridge.ts",
    "src/components/kc/prepRush/PrepRush.tsx",
  ].map(code);
  assert(
    rushFiles.every(
      (f) =>
        !/SaveManager|credits|appendLedgerEntry|economy\/|localStorage|sessionStorage|achievement/i.test(
          f,
        ),
    ),
    "B9: Prep Rush reads and writes no save, money, ledger, storage or achievement",
  );
  const rushScene = rushFiles[1]!;
  assert(
    /onBelt < PREP_RUSH\.MAX_ON_BELT/.test(rushScene) &&
      /state === "free"/.test(rushScene) &&
      /if \(it\.state !== "belt"\) return;/.test(body(rushScene, "private cut(")) &&
      /if \(it\.state !== "belt"\) return;/.test(body(rushScene, "private miss(")),
    "B10: the belt is bounded (pooled items, a cap) and each item is scored exactly once",
  );
  assert(
    /PauseManager\.subscribe/.test(rushScene) &&
      /Math\.min\(delta, 100\)/.test(rushScene) &&
      /RUSH_CMD\.STOP/.test(rushScene),
    "B11: the run pauses with PauseManager, survives a long frame, and stops when the screen leaves",
  );
  const rushBridge = rushFiles[2]!;
  const rushScreen = rushFiles[3]!;
  assert(
    /queueMicrotask/.test(rushBridge) &&
      /runDestroy/.test(rushBridge) &&
      /removeAllListeners\(HIDDEN\)/.test(rushBridge) &&
      /bridge\.stop\(\);\s*PauseManager\.resume\(\);\s*bridge\.destroy\(\);/.test(rushScreen),
    "B12: leaving tears the game down (no WebGL build-up) and never leaves the game paused",
  );
  assert(
    /lazy\(\(\) => import\("\.\/PrepRush"\)/.test(
      code("src/components/kc/prepRush/lazyPrepRush.ts"),
    ) &&
      /screen === "prep-rush"/.test(code("src/ScreensRouter.tsx")) &&
      /\| "prep-rush"/.test(read("src/components/kc/data.ts")) &&
      /data-testid="prep-rush-tile"/.test(code("src/components/kc/Kitchen.tsx")),
    "B13: its own lazy chunk (Phaser stays out of the menu bundle), screen id, route and order-board tile",
  );
  assert(
    /reduced\(\)/.test(rushScene) && /AudioManager\./.test(rushScene),
    "B14: Reduced Motion simplifies its effects; sounds go through AudioManager (so mute applies)",
  );
}

// ───────────────────────────────────────────────────────────── C. Chaos Director
const fitsAll: ChaosContext = {
  eligible: true,
  cleanupDue: false,
  restaurant: true,
  longestStepCuts: 12,
  giantOk: true,
};
function run(ctxs: ChaosContext[]): (ChaosEventId | null)[] {
  resetChaosForTests();
  return ctxs.map((c) => chaosForOrder(c));
}
{
  const seq = run(Array.from({ length: 28 }, () => fitsAll));
  const at = seq.flatMap((e, i) => (e ? [i + 1] : []));
  assert(
    at.join() === "4,8,12,16,20,24,28" && [4, 8, 12].every(isChaosSlot) && !isChaosSlot(3),
    "C1: the first event comes after 3 orders, then one every 4th",
    at,
  );
  assert(
    seq.filter(Boolean).join() === [...CHAOS.ORDER, CHAOS.ORDER[0]].join(),
    "C2: a fixed rotation: giant, avalanche, rush hour, Grandma, perfect plating, inspection, then round again",
    seq.filter(Boolean),
  );
  assert(
    run(Array.from({ length: 28 }, () => fitsAll)).join() === seq.join(),
    "C3: deterministic — the same play gives the same events",
  );
  const withTeaching = run(
    Array.from({ length: 8 }, (_, i) => ({ ...fitsAll, eligible: i % 2 === 0 })),
  );
  assert(
    withTeaching.every((e, i) => (i === 6 ? e === "giant" : e === null)),
    "C4: ineligible orders (teaching, Levels 1–10) never get one and don't count (the 4th ELIGIBLE order does)",
    withTeaching,
  );
  const scrape = run([fitsAll, fitsAll, fitsAll, { ...fitsAll, cleanupDue: true }, fitsAll]);
  assert(
    scrape[3] === null && scrape[4] === "giant",
    "C5: a due event waits one order when the board is about to be scraped",
    scrape,
  );
  resetChaosForTests();
  for (let i = 0; i < 3; i++) chaosForOrder(fitsAll);
  const skipped = chaosForOrder({ ...fitsAll, giantOk: false });
  assert(
    skipped === "avalanche",
    "C6: an event that can't happen on this order is passed over for the next in the rotation",
    skipped,
  );
  assert(
    !chaosEventFits("grandma", { ...fitsAll, longestStepCuts: CHAOS.GRANDMA_COMBO - 1 }) &&
      !chaosEventFits("inspection", { ...fitsAll, restaurant: false }) &&
      chaosEventFits("rush-hour", {
        ...fitsAll,
        restaurant: false,
        giantOk: false,
        longestStepCuts: 1,
      }),
    "C7: Grandma needs a step of 8+ cuts, the inspection a restaurant, Giant a cutting first step",
  );
  resetChaosForTests();
  forceNextChaos("inspection");
  const forced = chaosForOrder(fitsAll);
  const afterForced = run(Array.from({ length: 4 }, () => fitsAll));
  resetChaosForTests();
  forceNextChaos("giant");
  const forcedTeaching = chaosForOrder({ ...fitsAll, eligible: false });
  assert(
    forced === "inspection" && afterForced[3] === "giant" && forcedTeaching === null,
    "C8: the test hook sets one order's event, skips no counter, and never overrides eligibility",
  );
  const kc = read("src/game/kitchenChaos.ts");
  assert(
    /typeof import\.meta\.env !== "undefined" && import\.meta\.env\.DEV/.test(kc) &&
      /__kcSpecials/.test(kc),
    "C9: the browser-test hook exists only in development builds (Vite inlines DEV)",
  );
  assert(
    CHAOS.ORDER.every((id) => CHAOS_COPY[id].title.length > 0 && CHAOS_COPY[id].line.length > 0),
    "C10: every event has its card (title and line)",
  );
}
{
  // The scene's hooks for each event
  const onStart = body(scene, "private onStart(");
  const onRestart = body(scene, "private onRestart(");
  assert(
    onStart.indexOf("this.decideSpecials(config)") !== -1 &&
      onStart.indexOf("this.decideSpecials(config)") < onStart.indexOf("this.beginStep(0)") &&
      !/decideSpecials/.test(onRestart),
    "C11: decided once per order, before its board is laid out; a restart keeps it",
  );
  const decide = body(scene, "private decideSpecials(");
  assert(
    /sp\.chaosEligible && !teaching/.test(decide) &&
      /sp\.variantEligible && !teaching/.test(decide) &&
      /cleanupDue: cleanupDue\(\)/.test(decide),
    "C12: never while a technique is taught; the scraper and an event never share a start",
  );
  const layout = body(scene, "private layout(");
  assert(
    /const iw = w \* this\.ingredientScale\(\) \* fit;/.test(layout) &&
      /CHAOS\.MAX_BOARD_FRAC/.test(layout) &&
      !/RX_FRAC \* w\b/.test(layout.slice(layout.indexOf("const iw"))),
    "C13: Giant scales the ingredient's own geometry only, clamped to the board",
  );
  assert(
    /this\.cleanup\)[\s\S]{0,80}onClothDown[\s\S]{0,200}this\.avalanche\)[\s\S]{0,40}onAvalancheDown/.test(
      body(scene, "private onPointerDown("),
    ) &&
      /onAvalancheMove/.test(body(scene, "private onPointerMove(")) &&
      /this\.avalanche\.swipe = null/.test(body(scene, "private onPointerUp(")) &&
      /if \(this\.avalanche\) return true;/.test(body(scene, "private coachBlocked(")),
    "C14: the avalanche owns the board's pointer (no cut can start) and blocks the coach",
  );
  const startAv = body(scene, "private startAvalanche(");
  const endAv = body(scene, "private endAvalanche(");
  assert(
    /CHAOS\.AVALANCHE_COUNT/.test(startAv) &&
      /it\.img\.destroy\(\)/.test(endAv) &&
      /h\.destroy\(\)/.test(endAv) &&
      /this\.endAvalanche\("restart"\)/.test(onRestart) &&
      /AVALANCHE_SKIP/.test(scene),
    "C15: the avalanche is bounded (a fixed count), Skip-able, and fully destroyed (also on restart)",
  );
  assert(
    /this\.chaos === "rush-hour"[\s\S]{0,200}CHAOS\.RUSH_PACE/.test(
      body(scene, "private startPlating("),
    ) &&
      /this\.tweens\.timeScale = 1;/.test(onStart) &&
      /this\.tweens\.timeScale = 1;/.test(onRestart) &&
      /rate: CHAOS\.RUSH_CLIP_RATE/.test(prep) &&
      /video\.playbackRate = rate/.test(code("src/components/kc/game/CookingClip.tsx")),
    "C16: Rush Hour speeds up plating, the hand-off and the film only (reset every order)",
  );
  assert(
    /orderChaos\.current === "grandma"/.test(prep) && /CHAOS\.GRANDMA_COMBO/.test(prep),
    "C17: Grandma's Challenge reads the scene's own combo",
  );
  assert(
    /inspect: \(\) => inspectBusiness\(save\)/.test(app) &&
      /RESTAURANT_MODE \? \{ inspect/.test(app) &&
      /orderChaos\.current === "inspection"/.test(prep),
    "C18: the inspection reads the live restaurant (restaurant build only), at the report",
  );
  const insp = code("src/game/business/businessInspection.ts");
  const inspectFn = insp.slice(insp.indexOf("export function inspectBusiness("));
  assert(
    !/\bsave\.[\w.]+\s*=(?!=)/.test(inspectFn.slice(0, inspectFn.indexOf("\n}\n"))),
    "C19: inspectBusiness only reads the save (no fine, no state)",
  );
  const chaosFiles = [
    "src/game/kitchenChaos.ts",
    "src/game/specialVariants.ts",
    "src/game/specialsReport.ts",
  ].map(code);
  assert(
    chaosFiles.every(
      (f) => !/credits|appendLedgerEntry|economy\/|SaveManager|localStorage|sessionStorage/.test(f),
    ),
    "C20: the Director, the variants and the report lines touch no money, ledger or storage",
  );
}
{
  const base = {
    chaos: null,
    variant: null,
    grandmaBest: 0,
    evenness: 80,
    avalanche: null,
    inspection: null,
  } as const;
  const L = (o: Partial<Parameters<typeof specialsReportLines>[0]>) =>
    specialsReportLines({ ...base, ...o });
  const all = [
    L({ chaos: "giant" }),
    L({ chaos: "avalanche", avalanche: { sliced: 8, total: 8 } }),
    L({ chaos: "avalanche", avalanche: { sliced: 3, total: 8 } }),
    L({ chaos: "rush-hour" }),
    L({ chaos: "grandma", grandmaBest: 8 }),
    L({ chaos: "grandma", grandmaBest: 6 }),
    L({ chaos: "perfect-plating", evenness: 93 }),
    L({ chaos: "perfect-plating", evenness: 71 }),
    L({
      chaos: "inspection",
      inspection: { overall: "PASS", overallReason: "", categories: [] },
    }),
    L({
      chaos: "inspection",
      inspection: {
        overall: "WARNING",
        overallReason: "x",
        categories: [
          { category: "food-storage" as never, result: "WARNING", reason: "2 items near expiry." },
        ],
      },
    }),
    L({ variant: "golden-tomato", chaos: "giant" }),
  ];
  const texts = all.map((ls) => ls.map((l) => l.text));
  assert(
    texts[1]![0]!.includes("all 8") &&
      texts[2]![0]!.includes("3 of 8") &&
      all[4]![0]!.good &&
      !all[5]![0]!.good &&
      texts[5]![0]!.includes("×6") &&
      all[6]![0]!.good &&
      texts[6]![0]!.includes("93") &&
      !all[7]![0]!.good &&
      texts[7]![0]!.includes("71") &&
      texts[8]![0]!.includes("all clear") &&
      texts[9]![0]!.includes("2 items near expiry.") &&
      texts[10]!.join("|") ===
        "✨ Made with a Golden Tomato|🍅 Giant Ingredient — cut down to size!",
    "C21: the Knife Report's words follow the result (Grandma ×8, Evenness 90, the inspection's own reason)",
    texts,
  );
  assert(
    texts.flat().every((t) => !/\$|coin|reward|bonus|paid|earn/i.test(t)) && L({}).length === 0,
    "C22: no line ever mentions money or rewards; an ordinary order has none",
  );
}
{
  // Over the real campaign: which orders can host which event
  const eligible = campaign.filter((o) => o.n > CHAOS.MIN_LEVEL && o.teaches === 0);
  const grandmaOk = eligible.filter(
    (o) => Math.max(0, ...o.steps.map((s) => s.cuts)) >= CHAOS.GRANDMA_COMBO,
  );
  const giantOk = eligible.filter((o) => o.steps[0]?.mode === "cut");
  console.log(
    `     real campaign: ${eligible.length}/${campaign.length} levels eligible (L11+, not teaching); ` +
      `Grandma fits ${grandmaOk.length}, Giant fits ${giantOk.length}`,
  );
  assert(
    eligible.length > 100 &&
      grandmaOk.length / eligible.length > 0.8 &&
      giantOk.length / eligible.length > 0.8,
    "C23: over the real campaign, most eligible orders can host Grandma (8+ cuts) and Giant",
  );
}

// ───────────────────────────────────────────────────────────── D. Variants
{
  const ids = Object.keys(VARIANTS) as VariantId[];
  assert(
    ids.length === 5 &&
      ids.every((id) => VARIANTS[id].base in INGREDIENTS) &&
      new Set(ids.map((id) => VARIANTS[id].base)).size === 5 &&
      VARIANTS["giant-cucumber"].sizeScale === 1.3 &&
      ids.filter((id) => VARIANTS[id].sizeScale !== 1).join() === "giant-cucumber",
    "D1: five variants, each of a real existing ingredient (no new ingredient id); only the cucumber is bigger",
  );
  resetVariantsForTests();
  const orders = [
    ["tomato"],
    ["basil"],
    ["tomato", "onion"],
    ["onion", "tomato"],
    ["garlic"],
    ["pepper"],
    ["carrot"],
  ] as const;
  const got = orders.map((o) => variantForOrder(true, o as never));
  assert(
    JSON.stringify(got) === JSON.stringify([null, null, null, "frosted-onion", null, null, null]),
    "D2: every 3rd order WITH a base ingredient gets the variant of its first base ingredient",
    got,
  );
  resetVariantsForTests();
  const seq = Array.from({ length: 9 }, () => variantForOrder(true, ["carrot"]));
  assert(
    seq.filter(Boolean).length === 3 &&
      seq.every((v, i) =>
        (i + 1) % VARIANT_CADENCE.EVERY === 0 ? v === "rainbow-carrot" : v === null,
      ),
    "D3: deterministic cadence (orders 3, 6, 9 …)",
  );
  resetVariantsForTests();
  const notEligible = [1, 2, 3, 4].map(() => variantForOrder(false, ["tomato"]));
  const then = [1, 2, 3].map(() => variantForOrder(true, ["tomato"]));
  assert(
    notEligible.every((v) => v === null) && then[2] === "golden-tomato",
    "D4: orders that teach a technique never get one and don't count",
  );
  resetVariantsForTests();
  forceNextVariant("heirloom-pepper");
  const fNo = variantForOrder(true, ["tomato"]);
  forceNextVariant("heirloom-pepper");
  const fYes = variantForOrder(true, ["corn", "pepper"]);
  assert(
    fNo === null && fYes === "heirloom-pepper",
    "D5: the test hook only applies where its ingredient is in the order",
  );
  assert(
    variantOf("tomato") === "golden-tomato" &&
      variantOf("garlic") === null &&
      withArticle("Golden Tomato") === "a Golden Tomato" &&
      withArticle("Orange") === "an Orange",
    "D6: lookups and the report's article",
  );
  const sv = code("src/game/specialVariants.ts");
  assert(
    ids.every((id) => sv.includes(`case "${id}":`)) &&
      /remapSkin\(/.test(sv) &&
      /source-atop/.test(sv),
    "D7: each variant has its look: a skin-hue remap (stems and leaves keep their colour) plus marks inside the silhouette",
  );
  const redraw = body(scene, "private redrawIngredientTexture(");
  assert(
    /if \(this\.variantHere\(\)\) paintVariantOverlay\(tex\.context, this\.variant!\);\s*tex\.refresh\(\);/.test(
      redraw,
    ) && /if \(this\.variantHere\(\)\) this\.spawnVariantFlecks/.test(scene),
    "D8: painted onto the ingredient's own texture (pieces and plate are cut from it), with flecks on each cut",
  );
  const withBase = campaign.filter(
    (o) => o.teaches === 0 && o.steps.some((s) => variantOf(s.ingredient)),
  );
  console.log(
    `     real campaign: ${withBase.length}/${campaign.length} non-teaching levels carry a variant ingredient`,
  );
  assert(withBase.length > 40, "D9: the variants' ingredients turn up across the real campaign");
}

// ───────────────────────────────────────────────────────────── E. Save, money, ingredients
{
  const saveDiff = execSync(`git diff --stat ${PHASE_BASE} -- src/game/SaveManager.ts src/types`, {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert(
    saveDiff.trim() === "",
    "E1: no save-schema change (SaveManager.ts and src/types untouched)",
    saveDiff,
  );
  const headDefs = execSync(`git show ${PHASE_BASE}:src/game/definitions.ts`, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  const union = (src: string) =>
    (src.match(/export type IngredientId =[\s\S]*?;/)?.[0] ?? "").replace(/\s+/g, " ");
  assert(
    union(headDefs) === union(read("src/game/definitions.ts")),
    "E2: no new ingredient id (variants are presentation)",
  );
  const headApp = execSync(`git show ${PHASE_BASE}:src/App.tsx`, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  const writes = (s: string) => (s.match(/appendLedgerEntry\(/g) ?? []).length;
  assert(
    writes(read("src/App.tsx")) === writes(headApp) + 2,
    "E3: no new money path in Phase 3 (App's ledger writes are HEAD's plus Phase 2's two tip entries)",
  );
  const p3 = [
    "src/game/fever.ts",
    "src/game/prepRush.ts",
    "src/game/kitchenChaos.ts",
    "src/game/specialVariants.ts",
    "src/game/specialsReport.ts",
    "src/game/scenes/PrepRushScene.ts",
    "src/game/PrepRushBridge.ts",
    "src/components/kc/prepRush/PrepRush.tsx",
  ].map(code);
  assert(
    p3.every((f) => !/localStorage|sessionStorage|indexedDB|bridge\.storage/.test(f)),
    "E4: no Phase 3 module persists anything (session memory only)",
  );
}

console.log(failures === 0 ? "\nPHASE 3 QA: ALL PASS" : `\nPHASE 3 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
