/**
 * PHASE4_QA — Phase 4 "Signature Dish Collection, memorable customers and a
 * stronger order completion" (developer 2026-10-21):
 *   A. the collection (src/game/signatureDishes.ts, kc/Recipes.tsx,
 *      BookPageNote.tsx) — tiers on the existing grade thresholds, best =
 *      the saved max, milestones once per recipe, words not digits;
 *   B. the five customers (src/game/customers/personalities.ts,
 *      Preparation.tsx, ServiceOrderComplete.tsx) — cadence, cache,
 *      eligibility, reactions that follow the real grade, presentation only;
 *   C. the completion sequence — one advance per stage, staged serve card,
 *      the Knife Report intact;
 *   E. no save field, no money path, nothing persisted.
 *
 * Run: npx tsx scripts/phase4-qa.mts
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
  TIERS,
  TIER_INFO,
  TIER_ORDER,
  VARIANT_MEMORIES,
  bestOfRecipes,
  collectionSummary,
  memoryFor,
  nextTier,
  recordSessionDish,
  resetSessionDishesForTests,
  sessionDish,
  tierFor,
  tierMilestone,
} from "../src/game/signatureDishes.ts";
import {
  MYSTERY_REVEALS,
  PERSONALITIES,
  PERSONALITY_CADENCE,
  forceNextPersonality,
  isPersonalitySlot,
  personalityForOrder,
  personalityReaction,
  presentedCustomer,
  regularParMs,
  resetPersonalitiesForTests,
  type PersonalityId,
} from "../src/game/customers/personalities.ts";
import { CUSTOMERS } from "../src/game/customers/customerDefinitions.ts";
import { qualityFor } from "../src/game/CutEvaluator.ts";
import { VARIANTS, type VariantId } from "../src/game/specialVariants.ts";
import type { QualityLabel } from "../src/types/game.ts";

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

const prep = code("src/components/kc/game/Preparation.tsx");
const soc = code("src/components/kc/game/ServiceOrderComplete.tsx");
const recipes = code("src/components/kc/Recipes.tsx");
const report = code("src/components/kc/game/KnifeReport.tsx");
const note = code("src/components/kc/game/BookPageNote.tsx");
const css = read("src/styles.css");

// ───────────────────────────────────────────────────────────── A. collection
console.log("A. Signature Dish Collection");
assert(
  qualityFor(TIERS.CHEFS_SPECIAL_AT) === "Clean" &&
    qualityFor(TIERS.CHEFS_SPECIAL_AT - 1) !== "Clean" &&
    qualityFor(TIERS.SIGNATURE_AT) === "Masterful" &&
    qualityFor(TIERS.SIGNATURE_AT - 1) !== "Masterful",
  "A1: the tiers sit exactly on the Knife Report's own grade thresholds (Clean 85, Masterful 95)",
);
assert(
  tierFor(null, false) === null &&
    tierFor(0, true) === "homemade" &&
    tierFor(84, true) === "homemade" &&
    tierFor(85, true) === "chefs-special" &&
    tierFor(94, true) === "chefs-special" &&
    tierFor(95, true) === "grandmas-signature" &&
    tierFor(100, true) === "grandmas-signature" &&
    tierFor(99, false) === null,
  "A2: Homemade once prepared; Chef's Special at Clean; Grandma's Signature at Masterful; nothing before a first plate",
);
assert(
  nextTier(null) === "homemade" &&
    nextTier("homemade") === "chefs-special" &&
    nextTier("chefs-special") === "grandmas-signature" &&
    nextTier("grandmas-signature") === null &&
    TIER_ORDER.every((t) => TIER_INFO[t].name && TIER_INFO[t].how && TIER_INFO[t].icon),
  "A3: the ladder and each tier's name, mark and how-to",
);
{
  const p = {
    a: { best: 72, done: true },
    b: { best: 90, done: true },
    c: { best: null, done: false },
  };
  const ab = bestOfRecipes(p, ["a", "b", "c"]);
  const ba = bestOfRecipes(p, ["c", "b", "a"]);
  const none = bestOfRecipes(p, ["c", "zzz"]);
  assert(
    ab.best === 90 &&
      ab.done &&
      JSON.stringify(ab) === JSON.stringify(ba) &&
      none.best === null &&
      !none.done,
    "A4: a page's best is the max of its recipes (order-independent; ties are the same value)",
  );
}
assert(
  tierMilestone(undefined, 40) === "homemade" &&
    tierMilestone(undefined, 88) === "chefs-special" &&
    tierMilestone(undefined, 97) === "grandmas-signature" &&
    tierMilestone({ best: 60, done: true }, 70) === null &&
    tierMilestone({ best: 60, done: true }, 86) === "chefs-special" &&
    tierMilestone({ best: 88, done: true }, 60) === null &&
    tierMilestone({ best: 88, done: true }, 88) === null &&
    tierMilestone({ best: 96, done: true }, 99) === null &&
    tierMilestone({ best: 80, done: true }, 99) === "grandmas-signature",
  "A5: a milestone only when the saved best crosses into a higher tier — never on a worse, equal or same-tier run",
);
{
  // Replay safety over a sequence of runs: each tier is revealed at most once.
  let rec: { best: number | null; done: boolean } | undefined;
  const shown: string[] = [];
  for (const s of [55, 40, 86, 70, 86, 99, 100, 20, 96]) {
    const m = tierMilestone(rec, s);
    if (m) shown.push(m);
    rec = { best: Math.max(rec?.best ?? 0, s), done: true };
  }
  assert(
    shown.join() === "homemade,chefs-special,grandmas-signature" && rec?.best === 100,
    "A6: across replays each page is written once, and a worse attempt never lowers the best",
    shown,
  );
}
assert(
  JSON.stringify(
    collectionSummary(["homemade", null, "chefs-special", "grandmas-signature", "homemade"]),
  ) === JSON.stringify({ homemade: 2, "chefs-special": 1, "grandmas-signature": 1, prepared: 4 }),
  "A7: the book's summary counts pages per tier",
);
assert(
  memoryFor("r1", "homemade") === memoryFor("r1", "homemade") &&
    TIER_ORDER.every((t) => memoryFor("tomato-salad", t).length > 10) &&
    (Object.keys(VARIANTS) as VariantId[]).every((v) => VARIANT_MEMORIES[v].length > 10),
  "A8: every page has a fixed family memory per tier, and every variant its own",
);
{
  resetSessionDishesForTests();
  recordSessionDish("r", 7, null);
  recordSessionDish("r", 4, "golden-tomato");
  recordSessionDish("r", 9, "golden-tomato");
  const d = sessionDish(["r", "x"]);
  assert(
    d?.bestCombo === 9 && d.variants.join() === "golden-tomato" && sessionDish(["x"]) === null,
    "A9: this visit's longest run and variants (memory only) keep the best and list each variant once",
  );
}
assert(
  !/record\.best\}/.test(recipes) &&
    !/\{record\.best\b/.test(recipes) &&
    /qualityFor\(record\.best\)/.test(recipes) &&
    /<TierBadge tier=\{tier\}/.test(recipes) &&
    /Badge tone="sage">Prepared</.test(recipes),
  "A10: the Recipe Book shows tiers and the best plate as a grade word — never the score digits (its own rule); 'Prepared' kept",
);
assert(
  /data-testid="signature-summary"/.test(recipes) &&
    /data-testid="signature-illustration"/.test(recipes) &&
    /data-testid="signature-panel"/.test(recipes) &&
    /A page waiting to be written/.test(recipes) &&
    /This visit \(not saved\)/.test(recipes),
  "A11: summary, tier-framed illustration, the tier panel, an empty state, and this visit's extras labelled as not saved",
);
assert(
  /tierMilestone\(before, result\.score\)/.test(prep) &&
    /if \(!service\?\.isBusinessOrder\)/.test(prep) &&
    /recordSessionDish\(view\.recipeId, bestCombo\.current, v\)/.test(prep) &&
    /<BookPageNote/.test(prep) &&
    /if \(tier \|\| newVariant\) setBookNote\(\{ tier, variant: newVariant \}\);\s*\}\s*setPhase\("complete"\);/.test(
      prep,
    ),
  "A12: a book page rides on the completion card only for a new tier or a first variant (never for Business orders, which keep no recipe record) — the report still goes straight on",
);
assert(
  !/onClick|KButton|button/.test(note) &&
    /\{bookNote\}/.test(soc) &&
    /\{bookNote\}/.test(code("src/components/kc/game/OrderComplete.tsx")),
  "A13: the page is part of the serve / Order Complete card — no extra stage, no button, nothing that can hold the order up",
);

// ───────────────────────────────────────────────────────────── B. customers
console.log("\nB. Customer personalities");
const IDS = Object.keys(PERSONALITIES) as PersonalityId[];
assert(
  IDS.length === 5 &&
    PERSONALITY_CADENCE.ROTATION.length === 5 &&
    new Set(IDS.map((i) => PERSONALITIES[i].name)).size === 5 &&
    new Set(IDS.map((i) => PERSONALITIES[i].avatarEmoji)).size === 5 &&
    IDS.every(
      (i) => PERSONALITIES[i].entrance && PERSONALITIES[i].greeting && PERSONALITIES[i].badge,
    ),
  "B1: five customers — Food Critic, Regular, Mystery Guest, Grandma's Old Friend, Big Bruno — each its own name, face, mark, arrival and greeting",
);
assert(
  IDS.every((i) => !CUSTOMERS.some((c) => c.name === PERSONALITIES[i].name)) &&
    CUSTOMERS.length === 12,
  "B2: the twelve ordinary customers are untouched and none shares a special's name",
);
const ok = { service: true, teaching: false, levelOk: true };
{
  resetPersonalitiesForTests();
  const got = Array.from({ length: 27 }, (_, i) => personalityForOrder(`o${i}`, ok)?.id ?? null);
  const at = got.flatMap((g, i) => (g ? [i + 1] : []));
  assert(
    at.join() === "2,7,12,17,22,27" && [2, 7, 12].every(isPersonalitySlot) && !isPersonalitySlot(3),
    "B3: the first special customer on the 2nd eligible order, then every 5th (four ordinary customers between)",
    at,
  );
  assert(
    got.filter(Boolean).join() ===
      [...PERSONALITY_CADENCE.ROTATION, PERSONALITY_CADENCE.ROTATION[0]].join(),
    "B4: a fixed rotation through all five",
  );
  const again = personalityForOrder("o1", ok);
  const againLast = personalityForOrder("o26", ok);
  // eligible orders 28..31 are not slots, 32 is: repeats above must not have shifted that
  const fresh = Array.from({ length: 5 }, (_, i) => personalityForOrder(`n${i}`, ok)?.id ?? null);
  assert(
    again?.id === got[1] &&
      againLast?.id === got[26] &&
      fresh.join() === ",,,," + PERSONALITY_CADENCE.ROTATION[1],
    "B5: decided once per order id — asking again (a re-render, a remount) gives the same customer and moves no counter",
  );
  resetPersonalitiesForTests();
  const rerun = Array.from({ length: 27 }, (_, i) => personalityForOrder(`o${i}`, ok)?.id ?? null);
  assert(rerun.join() === got.join(), "B6: deterministic — the same play gives the same customers");
}
{
  resetPersonalitiesForTests();
  const mixed = [
    { ...ok, teaching: true },
    { ...ok, levelOk: false },
    { ...ok, service: false },
    ok,
    ok,
  ].map((e, i) => personalityForOrder(`m${i}`, e)?.id ?? null);
  assert(
    mixed.join() === ",,,,food-critic",
    "B7: never while a technique is taught, below Level 4, or without a customer — and those orders don't count",
    mixed,
  );
  resetPersonalitiesForTests();
  forceNextPersonality("giant-eater");
  const notHere = personalityForOrder("f0", { ...ok, levelOk: false });
  const forced = personalityForOrder("f1", ok);
  const after = [personalityForOrder("f2", ok), personalityForOrder("f3", ok)];
  assert(
    notHere === null && forced?.id === "giant-eater" && after[1]?.id === "food-critic",
    "B8: the test hook names one eligible order's customer, never overrides eligibility, moves no counter",
  );
}
{
  const grades: QualityLabel[] = ["Masterful", "Clean", "Honest", "Rustic", "Learning"];
  const all = IDS.flatMap((id) =>
    grades.map((g) => ({
      id,
      g,
      r: personalityReaction({ id, nth: 1 }, g, { ms: 1000, parMs: 9000 }),
    })),
  );
  assert(
    all.every((x) => x.r.line.length > 5),
    "B9: every customer has a line for every grade",
  );
  assert(
    all
      .filter((x) => x.id !== "impatient-regular")
      .every((x) =>
        x.g === "Masterful"
          ? x.r.mood === "cheer"
          : x.g === "Clean"
            ? x.r.mood === "nod"
            : x.r.mood === null,
      ),
    "B10: the cheer is only for a Masterful dish and the nod for Clean (the serve card's existing rule)",
  );
  const critic = (g: QualityLabel) => personalityReaction({ id: "food-critic", nth: 0 }, g).line;
  assert(
    /Exquisite/.test(critic("Masterful")) &&
      grades.slice(1).every((g) => !/Exquisite|fine plate/i.test(critic(g)) || g === "Clean") &&
      /could be more even|isn't, yet/.test(critic("Honest") + critic("Rustic")),
    "B11: the Food Critic's verdict follows the measured grade — no praise for a lower result",
  );
  const reg = (g: QualityLabel, ms: number) =>
    personalityReaction({ id: "impatient-regular", nth: 0 }, g, { ms, parMs: regularParMs(10) });
  assert(
    regularParMs(10) === 23000 &&
      /Right on time/.test(reg("Clean", 20000).line) &&
      /^Finally!/.test(reg("Clean", 30000).line) &&
      reg("Masterful", 30000).mood !== "cheer",
    "B12: the Regular's par is 8 s + 1.5 s a cut of unpaused prep; on time he's pleased, late he says so (never a penalty)",
  );
  const reveals = [0, 1, 2, 3, 4].map(
    (n) => personalityReaction({ id: "mystery-customer", nth: n }, "Clean").reveal,
  );
  assert(
    reveals.every(Boolean) && reveals[4] === reveals[0] && reveals[0] === MYSTERY_REVEALS[0],
    "B13: the Mystery Guest's reveal is fixed and in turn (no randomness, no reward)",
  );
  const base = CUSTOMERS[0]!;
  const shown = presentedCustomer(base, "mystery-customer");
  assert(
    shown.id === base.id &&
      shown.name === "Mystery Guest" &&
      presentedCustomer(base, null) === base,
    "B14: presentation only — the order's own customer id stays; no special = the ordinary customer",
  );
  const pers = code("src/game/customers/personalities.ts");
  assert(
    !/credits|appendLedgerEntry|economy\/|SaveManager|localStorage|sessionStorage|Math\.random/.test(
      pers,
    ),
    "B15: no money, no save, no storage, no randomness in the customers module",
  );
  assert(
    /const paid = result\.isReplay \? 0 : result\.coinsAwarded \+ \(result\.tip \?\? 0\);/.test(
      soc,
    ) &&
      /personalityReaction\(personality, served\.quality, prep\)/.test(soc) &&
      !/onServe\(\)[\s\S]{0,40}personality/.test(soc),
    "B16: the serve card's money is the normal settlement; the special customer only changes the words",
  );
  assert(
    /kc-silhouette/.test(soc) &&
      /personality\?\.id === "mystery-customer" && !served/.test(soc) &&
      /data-testid="mystery-reveal"/.test(soc),
    "B17: the Mystery Guest is a silhouette until served, then revealed",
  );
  assert(
    /regularChecked\.current = true;/.test(prep) &&
      /if \(paused\) return;/.test(prep) &&
      /window\.clearInterval\(tick\)/.test(prep) &&
      /regularTimer\.current !== null\) window\.clearTimeout\(regularTimer\.current\)/.test(prep),
    "B18: the Regular's clock counts unpaused time, checks his watch once, and cleans up its timers",
  );
  assert(
    /data-testid="customer-arrival"/.test(prep) &&
      /kc-arrive/.test(css) &&
      /\.kc-silhouette/.test(css),
    "B19: each special customer arrives on the order card (a short, never-blocking card)",
  );
}

// ───────────────────────────────────────────────────────────── C. sequence
console.log("\nC. Order completion");
assert(
  /if \(reportContinued\.current \|\| !result\) return;\s*reportContinued\.current = true;/.test(
    prep,
  ) && /reportContinued\.current = false;/.test(prep),
  "C1: Knife Report → next stage advances once per run (a double tap can't skip a stage); a restart re-arms it",
);
assert(
  /if \(serveLatch\.current\) return;/.test(soc) &&
    /if \(nextLatch\.current\) return;\s*nextLatch\.current = true;\s*onNextOrder\(\);/.test(soc) &&
    /onClick=\{nextOnce\}/.test(soc),
  "C2: Serve pays once; Next Customer / Finish Level advances once (it used to advance the queue twice on a double tap)",
);
assert(
  /stage\(0\)/.test(soc) &&
    /stage\(180\)/.test(soc) &&
    /stage\(360\)/.test(soc) &&
    /stage\(520\)/.test(soc) &&
    /reduced \? undefined/.test(soc) &&
    /html\.kc-reduced-motion \.kc-arrive,\s*html\.kc-reduced-motion \.kc-stage/.test(css),
  "C3: after Serve: the reaction, then the pay, the tip and the cash, a beat apart — opacity only, none with Reduced Motion",
);
assert(
  [
    "Evenness",
    "Consistency",
    "Rhythm",
    "CutPathViz",
    "knife-report-best",
    "knife-report-scores",
    "knife-report-gain",
    "knife-report-first",
    "knife-report-specials",
    "Prepare Again",
    "Continue",
  ].every((k) => report.includes(k)),
  "C4: the Knife Report keeps every field (grade, line, New Best, before/after, gain, first plate, stats, path, specials, both buttons)",
);
assert(
  /\{phase === "result" && result \? \(\s*<KnifeReport/.test(prep) && !/bookReveal/.test(prep),
  "C5: the Knife Report is still one panel and Continue leads straight to the completion card (no stage added)",
);
assert(
  /\[@media\(max-height:640px\)\]:py-4/.test(soc),
  "C6: the serve card tightens on short screens (it must fit 320×568 whatever the customer says)",
);

// ───────────────────────────────────────────────────────────── E. save & money
console.log("\nE. Save and money");
{
  const saveDiff = // Rule changed (developer 2026-10-26, "the game starts at 0 cash"): SaveManager may change
    // only the new save's opening credits (scripts/startCashGuard.mts).
    saveManagerChangesBeyondStartCash(PHASE_BASE, ROOT).join("\n") +
    execSync(`git diff --stat ${PHASE_BASE} -- src/types`, {
      cwd: ROOT,
      encoding: "utf8",
    });
  assert(
    saveDiff.trim() === "",
    "E1: no save-schema change (SaveManager.ts and src/types untouched)",
    saveDiff,
  );
  const headApp = execSync(`git show ${PHASE_BASE}:src/App.tsx`, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  const writes = (s: string) => (s.match(/appendLedgerEntry\(/g) ?? []).length;
  assert(
    writes(read("src/App.tsx")) === writes(headApp) + 2,
    "E2: no new money path (App's ledger writes = HEAD's + Phase 2's two tip entries)",
  );
  const p4 = [
    "src/game/signatureDishes.ts",
    "src/game/customers/personalities.ts",
    "src/components/kc/game/BookPageNote.tsx",
    "src/components/kc/signature/TierBadge.tsx",
  ].map(code);
  assert(
    p4.every((f) => !/localStorage|sessionStorage|indexedDB|bridge\.storage|persist\(/.test(f)),
    "E3: nothing in Phase 4 persists anything of its own (tiers come from the saved best)",
  );
  assert(
    !/recipeProgress\[[^\]]+\]\s*=/.test(code("src/game/signatureDishes.ts")) &&
      !/recipeProgress/.test(note),
    "E4: the collection never writes the recipe record (App's recorders alone do, as before)",
  );
}

console.log(failures === 0 ? "\nPHASE 4 QA: ALL PASS" : `\nPHASE 4 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
