/**
 * PHASE6_QA — Phase 6 "Kitchen Moment cards" (developer 2026-10-21):
 *   A. the four moments' rules (src/game/kitchenMoments.ts) — from existing
 *      signals only, honest facts, nothing for an ordinary dish;
 *   B. once per run (memory only), the run key, Preparation's single place
 *      of detection, the Serve-time customer moment;
 *   C. the card and the share flow (components/kc/moments) — its own canvas,
 *      feature-detected share, a download fallback, cancel is not an error,
 *      URLs revoked, nothing opens or posts by itself;
 *   E. no save field, no money, no storage, no network.
 *
 * Run: npx tsx scripts/phase6-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { saveManagerChangesBeyondStartCash } from "./startCashGuard.mts";
import { execSync } from "node:child_process";
import {
  customerMoment,
  momentsForRun,
  momentsOf,
  nextRunKey,
  recordMoment,
  resetMomentsForTests,
  type RunFacts,
} from "../src/game/kitchenMoments.ts";
import { COMBO } from "../src/game/definitions.ts";

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
const base: RunFacts = {
  runKey: "r#1",
  dishName: "Tomato Salad",
  dishEmoji: "🥗",
  score: 80,
  grade: "Honest",
  previousBest: 90,
  perfects: [],
  bestCombo: 6,
  variant: null,
  tierReached: null,
};
const kinds = (f: Partial<RunFacts>) =>
  momentsForRun({ ...base, ...f })
    .map((m) => m.kind)
    .join();

console.log("A. The four moments");
assert(
  kinds({}) === "",
  "A1: an ordinary dish (no perfect slice, no variant, not a best) earns no moment",
);
assert(
  kinds({ perfects: [{ combo: COMBO.MILESTONES[0]! }] }) === "perfect" &&
    kinds({ perfects: [{ combo: COMBO.MILESTONES[0]! - 1 }] }) === "",
  "A2: Perfect Cut = the scene's own Perfect Slice on an ingredient that reached Clean ×5 (the first combo milestone) — not below",
);
const perfect = momentsForRun({ ...base, perfects: [{ combo: 9 }], grade: "Clean" })[0]!;
assert(
  /Clean ×9/.test(perfect.lines.join()) &&
    perfect.badge === "Clean" &&
    perfect.dishName === "Tomato Salad",
  "A3: the Perfect Cut card states the real combo, grade and dish",
);
const golden = momentsForRun({ ...base, variant: "golden-tomato" })[0]!;
const sig = momentsForRun({
  ...base,
  tierReached: "grandmas-signature",
  score: 97,
  grade: "Masterful",
  previousBest: 0,
})[0]!;
assert(
  golden.kind === "special" &&
    golden.heading === "Golden Tomato" &&
    /made with a Golden Tomato/.test(golden.lines[0]!) &&
    sig.kind === "special" &&
    /Signature/.test(sig.heading) &&
    kinds({ tierReached: "chefs-special" }) === "",
  "A4: Special Dish = a dish really made with a special variant, or one just raised to Grandma's Signature (Chef's Special is not 'rare')",
);
assert(
  kinds({ score: 91, previousBest: 90 }) === "best" &&
    kinds({ score: 90, previousBest: 90 }) === "" &&
    kinds({ score: 85, previousBest: 90 }) === "" &&
    kinds({ score: 70, previousBest: 0 }) === "",
  "A5: New Personal Best only for a genuine improvement on the saved best (equal, worse or a first plate: none)",
);
const best = momentsForRun({ ...base, score: 92, previousBest: 75 })[0]!;
assert(
  /Best 75 → 92/.test(best.lines.join()),
  "A6: the best card shows the real before and after (no invented percentage)",
  best.lines,
);
const cust = customerMoment({
  runKey: "r#1",
  dishName: "Soup",
  personality: "mystery-customer",
  line: "“Very good indeed.”",
  reveal: "a travelling chef",
});
assert(
  cust.kind === "customer" &&
    cust.heading === "Mystery Guest" &&
    cust.badge === "It was a travelling chef!" &&
    cust.lines[0] === "“Very good indeed.”",
  "A7: Customer Moment = a special customer's real reaction at Serve (their own line, the Mystery Guest's reveal)",
);
const all = momentsForRun({
  ...base,
  perfects: [{ combo: 7 }],
  variant: "rainbow-carrot",
  score: 95,
  previousBest: 80,
  grade: "Masterful",
});
assert(
  all.map((m) => m.kind).join() === "perfect,special,best" &&
    all.every((m) => m.shareText.length > 10 && !/\$|http|@/.test(m.shareText)),
  "A8: one dish can earn several (kept in a fixed order); share text is short, matches the kind, has no money, links or personal data",
);

console.log("\nB. Once per run");
resetMomentsForTests();
const k1 = nextRunKey("soup");
const k2 = nextRunKey("soup");
const m1 = { ...golden, runKey: k1 };
assert(k1 !== k2, "B1: every finished attempt gets its own run key");
assert(
  recordMoment(m1) && !recordMoment({ ...m1 }) && momentsOf(k1).length === 1,
  "B2: a moment is recorded once per (run, kind) — re-renders and re-opened screens add nothing",
);
assert(
  recordMoment({ ...m1, runKey: k2 }) && momentsOf(k2).length === 1,
  "B3: a new attempt (Prepare Again) is a new run with its own moments",
);
recordMoment({ ...cust, runKey: k1 });
assert(
  momentsOf(k1)
    .map((m) => m.kind)
    .join() === "special,customer",
  "B4: a run's moments come back in kind order",
);
const prep = code("src/components/kc/game/Preparation.tsx");
const soc = code("src/components/kc/game/ServiceOrderComplete.tsx");
assert(
  (prep.match(/momentsForRun\(/g) ?? []).length === 1 &&
    /const key = nextRunKey\(view\.recipeId\);/.test(prep) &&
    prep.indexOf("momentsForRun(") > prep.indexOf('event.type === "RECIPE_COMPLETED"'),
  "B5: detection runs in ONE place — when the scene reports the finished recipe — never in a render",
);
assert(
  /if \(event\.payload\.isPerfect\) perfectSteps\.current\.add/.test(prep) &&
    /previousBest: business \? 0 : baselineBest\.current/.test(prep) &&
    /variant: orderVariant\.current/.test(prep) &&
    /tierReached: business \? null : tierMilestone\(before, overall\)/.test(prep),
  "B6: it reads the scene's Perfect Slice flag, the saved best from before the run, the order's own variant and the tier milestone (none for Business orders, which keep no recipe record)",
);
assert(
  /if \(personality\) \{\s*const said = personalityReaction\(personality, result\.quality, prep\);\s*onCustomerMoment\?\.\(/.test(
    soc,
  ) && soc.indexOf("onCustomerMoment?.(") > soc.indexOf("if (serveLatch.current) return;"),
  "B7: the customer moment comes from the real Serve (behind the Serve latch, so once)",
);
assert(
  /runKey\.current = null;\s*stepCombo\.current = \[\];\s*perfectSteps\.current = new Set\(\);/.test(
    prep,
  ),
  "B8: a restart clears the run's perfect-slice tracking (no stale moments on the next attempt)",
);

console.log("\nC. Card and sharing");
const card = code("src/components/kc/moments/momentCard.ts");
const preview = code("src/components/kc/moments/MomentPreview.tsx");
const chip = code("src/components/kc/moments/MomentChip.tsx");
assert(
  /CARD = \{ W: 1080, H: 1350 \}/.test(card) &&
    /document\.createElement\("canvas"\)/.test(card) &&
    /img\.onerror = \(\) => resolve\(null\)/.test(card) &&
    /canvas\.toBlob/.test(card),
  "C1: the card is drawn on its own 1080×1350 (4:5) canvas — not the game's — and a missing picture just leaves it out",
);
assert(
  /typeof navigator\.share === "function" && !!navigator\.canShare\?\.\(\{ files: \[f\] \}\)/.test(
    preview,
  ) &&
    /const canShareText = !canShareFile && typeof navigator\.share === "function"/.test(preview) &&
    /\{canShareFile \|\| canShareText \? \(/.test(preview),
  "C2: file sharing and text sharing are detected separately; Share appears only where one exists",
);
assert(
  /name === "AbortError"\)\s*setStatus\(null\)/.test(preview) &&
    /Save the image instead/.test(preview),
  "C3: cancelling a share is not an error; an unavailable share points to Save",
);
assert(
  /a\.download = cardFileName\(m\)/.test(preview) && /URL\.revokeObjectURL\(made\)/.test(preview),
  "C4: Save image downloads the PNG; each card's object URL is revoked when it changes or closes",
);
assert(
  /Couldn't draw this card — your game is fine\./.test(preview) &&
    /setFailed\(true\)/.test(preview),
  "C5: a failed drawing keeps the preview with a calm message; the game goes on",
);
assert(
  !/useEffect/.test(chip) &&
    /aria-label="Not now"/.test(chip) &&
    /momentPreview \?/.test(prep) &&
    /onOpen=\{\(\) => setMomentPreview\(true\)\}/.test(prep),
  "C6: the chip opens the preview only when tapped, and can be put away — nothing opens by itself",
);
assert(
  /phase === "complete" && runKey\.current/.test(prep),
  "C7: offered only on the order's completion screen — never during cutting",
);

console.log("\nE. Save, money, network");
const files = [
  "src/game/kitchenMoments.ts",
  "src/components/kc/moments/momentCard.ts",
  "src/components/kc/moments/MomentPreview.tsx",
  "src/components/kc/moments/MomentChip.tsx",
].map(code);
assert(
  files.every(
    (f) =>
      !/localStorage|sessionStorage|indexedDB|bridge\.storage|fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(
        f,
      ),
  ),
  "E1: nothing is stored and nothing is sent over the network",
);
assert(
  files.every((f) => !/credits|appendLedgerEntry|persist\(|SaveManager/.test(f)),
  "E2: no money, no ledger, no save in any of it",
);
// SaveManager may carry only the approved opening-credits and write-queue changes (scripts/startCashGuard.mts).
const saveDiff =
  saveManagerChangesBeyondStartCash("HEAD", ROOT).join("\n") +
  execSync("git diff --stat HEAD -- src/types", { cwd: ROOT, encoding: "utf8" });
assert(saveDiff.trim() === "", "E3: no save-schema change", saveDiff);

console.log(failures === 0 ? "\nPHASE 6 QA: ALL PASS" : `\nPHASE 6 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
