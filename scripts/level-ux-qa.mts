/**
 * LEVEL UX QA — the Level 1–10 UX pass (docs/HANDOFF.md §4), presentation
 * only: no payout, reward, peel or knife behaviour changes.
 *
 *  E. levelOrderEarnings (Level Complete's "Order payout"): read from the
 *     ledger the serves wrote — one order, two orders, an order paid on an
 *     earlier try, the same recipe twice, a trimmed ledger (null, never a
 *     wrong figure), no paid orders (0); never writes money.
 *  N. A1/A2 wiring: the Level Complete notice waits for a story banner
 *     (Level 10's milestone) instead of being dropped, and lists Order payout,
 *     Completion reward and Earned this level; the reward ledger entry is
 *     unchanged.
 *  P. A3: peel progress is a read-only event (PEEL_PROGRESS) emitted from the
 *     existing coverage count; the HUD shows "% peeled" and a bar on peel
 *     steps; the completion threshold and peel state are untouched.
 *  B. A4: the Order Board's bottom bar lights no section.
 *  S. A5: knife/board previews say "in the Market"; the Knife Report's line
 *     follows the grade, says "Prepare Again", "steady pace" only with a
 *     rhythm bonus; no "Step 1 of 1" on a single-step level and the step line
 *     sits on the HUD card.
 *
 * Run: npx tsx scripts/level-ux-qa.mts
 */
import fs from "node:fs";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { levelOrderEarnings } from "../src/game/levels/levelEarnings.ts";
import { withPaidOrder } from "../src/game/levels/paidOrders.ts";
import { getNextRewardPreview, opensInMarket } from "../src/game/levels/levelMastery.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(p, "utf8");

const base = (): SaveData => structuredClone(DEFAULT_SAVE) as SaveData;
function paid(save: SaveData, levelId: string, recipeId: string, cents: number): SaveData {
  const s = appendLedgerEntry(save, "campaign-settlement", cents, recipeId);
  return { ...s, levelProgress: withPaidOrder(s.levelProgress, levelId, recipeId) };
}

console.log("E. levelOrderEarnings");
{
  const s0 = base();
  assert(levelOrderEarnings(s0, "level-3") === 0, "E1: no paid orders → 0");
  const one = paid(s0, "level-3", "camp-carrot-chop-bowl", 5500);
  assert(levelOrderEarnings(one, "level-3") === 5500, "E2: one order → its settlement");
  let two = paid(one, "level-3", "camp-carrot-chop-bowl", 5300);
  two = appendLedgerEntry(two, "completion-reward", 5500, "level-2");
  assert(
    levelOrderEarnings(two, "level-3") === 10800,
    "E3: the same recipe twice → both settlements, each entry used once",
  );
  // An order paid on an earlier try, then other entries in between (another level, a purchase).
  let retry = paid(base(), "level-30", "r-a", 4000);
  retry = appendLedgerEntry(retry, "campaign-settlement", 999, "r-other");
  retry = appendLedgerEntry(retry, "inventory-purchase", -300, "tomato");
  retry = paid(retry, "level-30", "r-b", 4500);
  assert(
    levelOrderEarnings(retry, "level-30") === 8500,
    "E4: an order paid on an earlier try still counts; other levels' entries don't",
  );
  const trimmed = {
    ...one,
    economyLedger: one.economyLedger.filter((e) => e.category !== "campaign-settlement"),
  };
  assert(
    levelOrderEarnings(trimmed, "level-3") === null,
    "E5: a trimmed ledger → null (no wrong total)",
  );
  assert(
    levelOrderEarnings(two, "level-3") !== undefined && two.credits === base().credits,
    "E6: reading never moves money",
  );
}

const app = read("src/App.tsx");
console.log("N. Level Complete notice (A1/A2)");
{
  assert(
    /const orderCoins = levelOrderEarnings\(save, level\.id\);/.test(app) &&
      /"completion-reward", rewardCoins, level\.id/.test(app) &&
      // Since the city ranking (2026-10-09) the notice also carries an optional cityRank line,
      // and since the first levels (2026-10-09) Grandma's line, the sections that opened
      // and (pass 2) what's left in Grandma's fridge.
      /if \(rewardCoins > 0\) \{[\s\S]{0,1600}?setLevelRewardNotice\(\{\s*rewardCoins,\s*orderCoins,/.test(
        app,
      ) &&
      !/else if \(rewardCoins > 0\) setLevelRewardNotice/.test(app),
    "N1: the reward notice is no longer dropped when a story banner fires; the reward ledger entry is unchanged",
  );
  assert(
    /\{levelRewardNotice && !storyEvent \?/.test(app) &&
      /label: "Order payout"/.test(app) &&
      /label: "Completion reward"/.test(app) &&
      /label: "Earned this level"/.test(app),
    "N2: it shows after the story banner, with Order payout, Completion reward and Earned this level",
  );
}

console.log("P. Peel progress (A3)");
{
  const scene = read("src/game/scenes/PreparationScene.ts");
  const emits = scene.match(/EVT\.PEEL_PROGRESS/g) ?? [];
  const block = scene.slice(
    scene.indexOf("this.bus.emit(EVT.PEEL_PROGRESS"),
    scene.indexOf("this.bus.emit(EVT.PEEL_PROGRESS") + 260,
  );
  assert(
    emits.length === 1 &&
      /this\.peelCoveredCells\s*\/\s*\(this\.peelTotalCells \* this\.peelConfig\(\)\.completionThreshold\)/.test(
        block,
      ) &&
      !/this\.peel(Covered|Total)Cells\s*(=|\+\+|\+=)/.test(block),
    "P1: one read-only PEEL_PROGRESS emit from the existing coverage count (no peel state written there)",
  );
  const hud = read("src/components/kc/game/GameHUD.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  assert(
    /% peeled/.test(hud) &&
      /role="progressbar"/.test(hud) &&
      /event\.type === "PEEL_PROGRESS"/.test(prep) &&
      /interactionMode === "peel"/.test(prep),
    "P2: the HUD shows '% peeled' and a bar on peel steps",
  );
}

console.log("B. Order Board navigation (A4)");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const board = kitchen.slice(
    kitchen.indexOf("export function OrderBoard"),
    kitchen.indexOf("function ScreenHeaderBoard"),
  );
  assert(
    /<BottomNav active=\{null\} go=\{go\} \/>/.test(board) &&
      /active: ScreenId \| null;/.test(kitchen),
    "B1: the Order Board lights no section of the bottom bar",
  );
}

console.log("S. Stale copy (A5)");
{
  const l1 = getNextRewardPreview(1)!;
  assert(
    l1.name === "Santoku" && opensInMarket(l1),
    "S1: Level 1's preview is the Santoku, which opens in the Market",
  );
  const report = read("src/components/kc/game/KnifeReport.tsx");
  assert(
    /ENCOURAGEMENT\[result\.qualityLabel\]/.test(report) &&
      !/looked lovely\.\s*<\/p>/.test(report) &&
      /Prepare Again/.test(report) &&
      !/>\s*Prep Again\s*</.test(report) &&
      /result\.rhythmBonus > 0 \? "steady pace"/.test(report),
    "S2: the Knife Report's line follows the grade; 'Prepare Again'; 'steady pace' only with a bonus",
  );
  const prep = read("src/components/kc/game/Preparation.tsx");
  const hud = read("src/components/kc/game/GameHUD.tsx");
  assert(
    /steps\.length > 1\s*\?\s*`Step \$\{activeStep\.index \+ 1\} of \$\{steps\.length\}/.test(
      prep,
    ) &&
      /`For \$\{activeDestination\}`/.test(prep) &&
      /data-testid="hud-step"/.test(hud) &&
      !/text-copper\/70">\s*\{stepLabel\}/.test(hud),
    "S3: no 'Step 1 of 1' on a single-step level; the step line sits on the HUD card (no faint 9 px label)",
  );
}

console.log(failures ? `LEVEL UX QA: ${failures} FAILURE(S)` : "LEVEL UX QA: ALL PASS");
process.exit(failures ? 1 : 0);
