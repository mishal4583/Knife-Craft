/**
 * ACHIEVEMENT REWARDS QA — the economy plan of 2026-10-16
 * (src/game/progression/achievements.ts, levels/levelRewards.ts).
 *
 *  L  Level rewards: one smooth curve by the new level number (50 + 3.1 × (n − 1)),
 *     rising every level; Level 2 practice $0; Level 150 keeps $5,000; the
 *     total stays near the old one.
 *  A  Catalog: every old milestone is an achievement under its own id; new
 *     ones use "ach-" ids (never colliding); every reward whole cents ≥ 0.
 *  C  Collect: reached + unclaimed → credit + ONE ledger entry + claimed;
 *     a second collect pays nothing; not reached → nothing; opening +
 *     ledger = closing; the Family Legacy is never collected by hand.
 *  P  App: only the Family Legacy pays by itself (legacyOnly); an old save's
 *     paid milestone stays paid (never offered again).
 *  N  No new save field (claims live in economy.claimedMilestoneIds).
 *
 * Run: npx tsx scripts/achievement-rewards-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import {
  FAMILY_LEGACY_ID,
  MILESTONES,
  grantEarnedMilestoneRewards,
} from "../src/game/progression/milestoneRewards.ts";
import {
  achievementsFor,
  collectAchievement,
  collectAllAchievements,
  collectable,
  collectableTotal,
} from "../src/game/progression/achievements.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const done = (n: number) => Array.from({ length: n }, (_, i) => `level-${i + 1}`);
const saveAt = (n: number, credits = 0): SaveData => {
  const s = structuredClone(DEFAULT_SAVE);
  return {
    ...s,
    credits,
    levelProgress: {
      ...s.levelProgress,
      currentLevelId: `level-${Math.min(n + 1, LEVELS.length)}`,
      highestUnlockedLevelId: `level-${Math.min(n + 1, LEVELS.length)}`,
      completedLevelIds: done(n),
    },
  };
};
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

console.log("L. Level rewards");
{
  const r = LEVELS.map(paidLevelReward);
  const rising = r.slice(2, LEVELS.length - 1).every((v, i, a) => i === 0 || v > a[i - 1]!);
  const total = r.reduce((a, b) => a + b, 0);
  assert(
    // The 2026-10-30 pay curve: $50, +$40 a level to Level 40, then +$6; no $0 practice level.
    r[0] === 5_000 &&
      r[1] === 9_000 &&
      r[39] === 161_000 &&
      r[74] === 182_000 &&
      r[LEVELS.length - 2] === 225_200 &&
      r[LEVELS.length - 1] === 500_000,
    "L1: L1 $50, L2 $90, L40 $1,610, L75 $1,820, the level before the last $2,252, the last keeps its $5,000",
    {
      L1: r[0],
      L2: r[1],
      L40: r[39],
      L75: r[74],
      beforeLast: r[LEVELS.length - 2],
      last: r[LEVELS.length - 1],
    },
  );
  assert(
    rising,
    "L2: every first clear before the finale pays more than the one before (no zig-zag)",
  );
  assert(
    total === 24_513_800,
    `L3: the campaign's first clears total $245,138 (was $45,623 before the 2026-10-30 pay re-plan; the frozen baseline's completion rewards) (${total / 100})`,
  );
}

console.log("A. Catalog");
const fresh = saveAt(0);
const all = achievementsFor(fresh);
{
  const ids = all.map((a) => a.id);
  assert(
    MILESTONES.every((m) => ids.includes(m.id)) && new Set(ids).size === ids.length,
    "A1: every old milestone is an achievement under its own id; no id appears twice",
  );
  const newOnes = all.filter((a) => !MILESTONES.some((m) => m.id === a.id));
  assert(
    newOnes.length >= 30 && newOnes.every((a) => a.id.startsWith("ach-")),
    `A2: the new achievements use "ach-" ids (${newOnes.length} of them)`,
  );
  assert(
    all.every((a) => Number.isInteger(a.reward) && a.reward >= 0) &&
      all
        .filter((a) => a.automatic)
        .map((a) => a.id)
        .join() === FAMILY_LEGACY_ID,
    "A3: whole-cent rewards; only the Family Legacy is automatic",
  );
  const campaignNew = newOnes
    .filter((a) => !a.id.startsWith("ach-endless"))
    .reduce((t, a) => t + a.reward, 0);
  assert(
    campaignNew >= 8_000_000 && campaignNew <= 9_000_000,
    `A4: the new achievement money in the campaign is ~$85k (${campaignNew / 100}) — the gap to the $100k–$150k target`,
  );
}

console.log("C. Collect");
{
  const s = saveAt(25, 10_000);
  const ready = collectable(s);
  const first = ready.find((a) => a.id === "levels-25")!;
  const r = first ? collectAchievement(s, first.id) : null;
  assert(
    !!first &&
      r?.ok &&
      r.save.credits === s.credits + first.reward &&
      r.save.economyLedger.length === s.economyLedger.length + 1 &&
      r.save.economyLedger.at(-1)!.category === "milestone-reward" &&
      r.save.economyLedger.at(-1)!.description === "levels-25" &&
      r.save.economy.claimedMilestoneIds.includes("levels-25"),
    "C1: collecting a reached achievement credits its reward once, with ONE ledger entry, and marks it claimed",
  );
  const again = r?.ok ? collectAchievement(r.save, "levels-25") : null;
  assert(again && !again.ok && again.reason === "claimed", "C2: a second collect pays nothing");
  const early = collectAchievement(saveAt(5), "levels-25");
  assert(
    !early.ok && early.reason === "notReached",
    "C3: an achievement not reached yet can't be collected",
  );
  const legacy = collectAchievement(saveAt(150), FAMILY_LEGACY_ID);
  assert(
    !legacy.ok && legacy.reason === "automatic",
    "C4: the Family Legacy is never collected by hand",
  );
  const bulk = collectAllAchievements(s);
  assert(
    bulk.amount === collectableTotal(s) &&
      bulk.save.credits === s.credits + bulk.amount &&
      s.credits + ledgerSum(bulk.save) - ledgerSum(s) === bulk.save.credits &&
      collectable(bulk.save).length === 0,
    "C5: collecting everything pays exactly what was waiting; opening + ledger = closing; nothing left waiting",
  );
}

console.log("P. App rules");
{
  const app = read("src/App.tsx");
  assert(
    /const legacyOnly = \(m: MilestoneDefinition\) => m\.id === FAMILY_LEGACY_ID/.test(app) &&
      (app.match(/grantEarnedMilestoneRewards\([a-zA-Z]+, legacyOnly\)/g) ?? []).length === 2,
    "P1: the app pays only the Family Legacy by itself (both grant calls pass legacyOnly)",
  );
  const s = saveAt(150);
  const g = grantEarnedMilestoneRewards(s, (m) => m.id === FAMILY_LEGACY_ID);
  assert(
    g.granted.map((m) => m.id).join() === FAMILY_LEGACY_ID &&
      collectable(g.save).some((a) => a.id === "levels-100"),
    "P2: at L150 the Legacy pays itself; the other rewards wait in the tab",
  );
  // An old save that was auto-paid a milestone keeps it paid (the ledger entry is the record).
  const paidOld = grantEarnedMilestoneRewards(saveAt(25)).save;
  assert(
    !collectable(paidOld).some((a) => a.id === "levels-25"),
    "P3: a milestone an older build already paid is never offered again",
  );
}

console.log("N. Saves");
{
  assert(
    Object.keys(DEFAULT_SAVE).sort().join() ===
      Object.keys(structuredClone(DEFAULT_SAVE)).sort().join() &&
      !/claimedAchievement/.test(read("src/game/SaveManager.ts")),
    "N1: no new save field — claims use economy.claimedMilestoneIds",
  );
}

console.log(
  failures
    ? `\nACHIEVEMENT REWARDS QA: ${failures} FAILURE(S)`
    : "\nACHIEVEMENT REWARDS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
