/**
 * BLACKSMITH_QA — knife upgrades (src/game/knives/blacksmith.ts) and their
 * real effect on Preparation's tap cutting (src/game/knives/knifeTiming.ts,
 * the pure maths PreparationScene calls), against the real production code.
 *
 *   A. ownership / selection          B. initial stats (level 1 = unchanged)
 *   C. upgrade cost                   D. upgrade levels + atomicity + ledger
 *   E. insufficient coins             F. persistence + migration (real SaveManager.load)
 *   G. Speed effect                   H. Sharpness effect
 *   I. Handling effect                J. throughput a player can feel
 *   K. grading / completion untouched L. no fake rewarded-video path
 *   M. Campaign isolation (+ V2 freeze) N. Business isolation
 *
 * Run: npx tsx scripts/blacksmith-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { KNIFE_CATALOG, knifeOrDefault } from "../src/game/knives/knifeDefinitions.ts";
import { buyKnife, equipKnife } from "../src/game/knives/KnifeManager.ts";
import {
  BLACKSMITH_STATS,
  MAX_UPGRADE_LEVEL,
  effectiveKnife,
  getKnifeUpgrades,
  knifeLevel,
  knifeTuningFor,
  upgradeCost,
  upgradeKnife,
  forgePreview,
} from "../src/game/knives/blacksmith.ts";
import { knifeTapCadence, tapSequenceMs, tapBufferWindowMs, peelStrokeWidthFrac } from "../src/game/knives/knifeTiming.ts";
import { TAP_KNIFE, CHOP_KNIFE, PEEL } from "../src/game/definitions.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
// USD: wallet amounts are integer cents; dollars(80) is $80.00 (money.ts). Every amount below is the
// Blacksmith's original number read as dollars — the currency conversion, not a rebalance.
import { dollars } from "../src/game/money.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");

function saveWith(credits: number, extra: Partial<SaveData> = {}): SaveData {
  return { ...DEFAULT_SAVE, credits, economyLedger: [], ...extra };
}
/** The App.tsx wrapper shape: pure upgrade, then exactly one "blacksmith-upgrade" ledger entry. */
function upgradeViaApp(save: SaveData, knifeId: string, stat: (typeof BLACKSMITH_STATS)[number]) {
  const r = upgradeKnife(save, knifeId, stat);
  return r.ok ? { r, save: appendLedgerEntry(r.save, "blacksmith-upgrade", -r.cost, knifeId) } : { r, save };
}
function maxed(save: SaveData, knifeId: string): SaveData {
  let s = { ...save, credits: dollars(1_000_000) };
  for (const stat of BLACKSMITH_STATS) for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
    const r = upgradeKnife(s, knifeId, stat);
    if (r.ok) s = r.save;
  }
  return s;
}

// ===== A: ownership / selection =====
{
  const s = saveWith(10_000);
  assert(s.ownedKnifeIds.includes("chef") && s.equippedKnifeId === "chef", "A: a fresh save owns and equips the starter chef knife");
  const notOwned = upgradeKnife(s, "santoku", "speed");
  assert(!notOwned.ok && notOwned.reason === "notOwned", "A2: an unowned knife can't be upgraded");
  assert(!upgradeKnife(s, "nope", "speed").ok, "A3: an unknown knife is refused");
  // Upgrades belong to the knife: they follow whichever knife is equipped.
  const withSantoku = { ...s, ownedKnifeIds: [...s.ownedKnifeIds, "santoku"] };
  const up = upgradeKnife(withSantoku, "chef", "speed");
  const equippedSantoku = up.ok ? equipKnife(up.save, "santoku") : null;
  assert(!!equippedSantoku?.ok && getKnifeUpgrades(equippedSantoku.save, "santoku").speed === 1 && getKnifeUpgrades(equippedSantoku.save, "chef").speed === 2, "A4: upgrades are per knife — equipping another knife doesn't carry the chef's upgrade");
}

// ===== B: initial stats =====
{
  const s = saveWith(0);
  for (const k of KNIFE_CATALOG) {
    const lv = getKnifeUpgrades(s, k.id);
    assert(lv.sharpness === 1 && lv.speed === 1 && lv.handling === 1 && knifeLevel(lv) === 1, `B: ${k.name} starts at level 1 in every stat`);
  }
  const chef = knifeOrDefault("chef");
  assert(effectiveKnife(s, chef) === chef && effectiveKnife(s, chef).tuning === undefined, "B2: an un-upgraded knife IS the catalog knife (no tuning) — level-1 play is exactly today's play");
  const t = knifeTuningFor({ sharpness: 1, speed: 1, handling: 1 });
  assert(Object.values(t).every((v) => v === 1), "B3: level-1 tuning is 1.0 everywhere");
  assert(KNIFE_CATALOG.every((k) => k.tuning === undefined), "B4: no catalog knife carries tuning — the knife database is unchanged");
}

// ===== C: upgrade cost =====
{
  assert(upgradeCost(1) === dollars(80) && upgradeCost(2) === dollars(160) && upgradeCost(3) === dollars(280) && upgradeCost(4) === dollars(450) && upgradeCost(5) === null, "C: steps cost $80 / $160 / $280 / $450; level 5 is the max");
  assert([1, 2, 3, 4].reduce((a, l) => a + upgradeCost(l)!, 0) === dollars(970), "C2: a full stat costs $970 ($2,910 for all three)");
  // Chapter 1's real Honest-baseline net (economy-v2-campaign-simulation.mts) is $1,234 over 10 levels.
  assert(upgradeCost(1)! <= dollars(Math.floor(1234 / 10)), "C3: the first step ($80) costs less than one average chapter-1 level's income ($123)");
  const fullStat = [1, 2, 3, 4].reduce((a, l) => a + upgradeCost(l)!, 0);
  const cleaver = KNIFE_CATALOG.find((k) => k.id === "cleaver")!.price;
  assert(fullStat < cleaver, `C4: mastering a whole stat (${fullStat}) costs less than buying the cleaver (${cleaver})`);
  assert(upgradeCost(0) === dollars(80) && upgradeCost(-5) === dollars(80) && upgradeCost(99) === null && upgradeCost(NaN) === dollars(80), "C5: out-of-range levels read safely");
}

// ===== D: upgrade levels, atomicity, ledger =====
{
  let s = saveWith(dollars(1000));
  const first = upgradeViaApp(s, "chef", "sharpness");
  assert(first.r.ok && first.r.cost === dollars(80) && first.r.level === 2 && first.save.credits === dollars(920), "D: level 1 → 2 costs exactly $80");
  const e = first.save.economyLedger;
  assert(e.length === 1 && e[0]!.category === "blacksmith-upgrade" && e[0]!.amount === -dollars(80), "D2: exactly one blacksmith-upgrade ledger entry for the amount paid");
  s = first.save;
  for (let i = 0; i < 3; i++) s = upgradeViaApp(s, "chef", "sharpness").save;
  const lv = getKnifeUpgrades(s, "chef");
  assert(lv.sharpness === 5 && lv.speed === 1 && lv.handling === 1 && s.credits === dollars(1000 - 970), "D3: only the chosen stat rises; four steps cost $970 in total");
  const atMax = upgradeViaApp(s, "chef", "sharpness");
  assert(!atMax.r.ok && atMax.r.reason === "maxLevel" && atMax.save === s, "D4: a mastered stat can't be bought again — nothing changes");
  assert(knifeLevel(getKnifeUpgrades(maxed(saveWith(0), "chef"), "chef")) === 13, "D5: a fully forged knife reads ★ Level 13");
  const ledgerSum = s.economyLedger.reduce((a, x) => a + x.amount, 0);
  assert(dollars(1000) + ledgerSum === s.credits, "D6: opening balance + ledger = closing balance");
}

// ===== E: insufficient coins =====
{
  const s = saveWith(dollars(79));
  const r = upgradeViaApp(s, "chef", "speed");
  assert(!r.r.ok && r.r.reason === "insufficientFunds" && r.save === s && r.save.economyLedger.length === 0 && getKnifeUpgrades(s, "chef").speed === 1, "E: $79 can't buy an $80 step — no money taken, no level, no ledger entry");
  const exact = upgradeKnife(saveWith(dollars(80)), "chef", "speed");
  assert(exact.ok && exact.save.credits === 0, "E2: exactly $80 buys it, landing on $0 (never negative)");
}

// ===== F: persistence + migration =====
{
  const up = maxed(saveWith(0), "chef");
  const reloaded = JSON.parse(JSON.stringify(up)) as SaveData;
  assert(JSON.stringify(getKnifeUpgrades(reloaded, "chef")) === JSON.stringify(getKnifeUpgrades(up, "chef")), "F: upgrades survive a JSON save/reload");
  const { knifeUpgrades: _drop, ...old } = saveWith(500, { levelProgress: DEFAULT_SAVE.levelProgress });
  localStorage.setItem("knifecraft.save.v1", JSON.stringify(old));
  const loaded = await SaveManager.load();
  assert(JSON.stringify(loaded.knifeUpgrades) === "{}" && loaded.credits === 500 && getKnifeUpgrades(loaded, "chef").speed === 1, "F2: an old save with no knifeUpgrades loads through the real SaveManager with safe level-1 defaults and nothing else changed");
  const corrupt = { ...saveWith(0), knifeUpgrades: { chef: { sharpness: 99, speed: -3, handling: "x" as unknown as number } } };
  const lv = getKnifeUpgrades(corrupt, "chef");
  assert(lv.sharpness === 5 && lv.speed === 1 && lv.handling === 1, "F3: corrupt levels clamp to 1..5");
}

// ===== G: Speed effect (real cadence maths) =====
const chef = knifeOrDefault("chef");
const levelKnife = (stat: "sharpness" | "speed" | "handling", level: number) =>
  ({ ...chef, tuning: knifeTuningFor({ sharpness: 1, speed: 1, handling: 1, [stat]: level }) });
{
  const base = knifeTapCadence(TAP_KNIFE, chef);
  const fast = knifeTapCadence(TAP_KNIFE, levelKnife("speed", 5));
  assert(tapSequenceMs(base) === 455, `G: level-1 chef Slice cut keeps the knife busy 455 ms (unchanged) — got ${tapSequenceMs(base)}`);
  assert(fast.PREP_MS < base.PREP_MS && fast.PAUSE_MS < base.PAUSE_MS && fast.RETRACT_MS < base.RETRACT_MS && fast.CUT_MS === base.CUT_MS, "G2: Speed shortens wind-up, pause and recovery only");
  const saved = tapSequenceMs(base) - tapSequenceMs(fast);
  assert(Math.round(saved) === 43, `G3: Speed 5 saves ~43 ms per Slice cut (${Math.round(saved)} ms, −15% of the movement beats)`);
  let monotone = true;
  for (let l = 2; l <= 5; l++) if (tapSequenceMs(knifeTapCadence(TAP_KNIFE, levelKnife("speed", l))) >= tapSequenceMs(knifeTapCadence(TAP_KNIFE, levelKnife("speed", l - 1)))) monotone = false;
  assert(monotone, "G4: every Speed level is faster than the last");
  assert(tapSequenceMs(knifeTapCadence(CHOP_KNIFE, levelKnife("speed", 5))) < tapSequenceMs(knifeTapCadence(CHOP_KNIFE, chef)), "G5: Speed also quickens Chop");
}

// ===== H: Sharpness effect =====
{
  const base = knifeTapCadence(TAP_KNIFE, chef);
  const sharp = knifeTapCadence(TAP_KNIFE, levelKnife("sharpness", 5));
  assert(sharp.CUT_MS === base.CUT_MS * 0.8 && sharp.IMPACT_MS === base.IMPACT_MS * 0.8 && sharp.PREP_MS === base.PREP_MS, "H: Sharpness 5 makes the blade pass through 20% faster (CUT + IMPACT)");
  assert(peelStrokeWidthFrac(PEEL.STROKE_WIDTH_FRAC, levelKnife("sharpness", 5)) === PEEL.STROKE_WIDTH_FRAC * 1.25 && peelStrokeWidthFrac(PEEL.STROKE_WIDTH_FRAC, chef) === PEEL.STROKE_WIDTH_FRAC, "H2: Sharpness 5 peels a 25% wider strip per stroke; level 1 is unchanged");
  // Fewer strokes to cover the SAME 80%: stroke count to cover a band scales with 1/width.
  const strokes = (w: number) => Math.ceil(PEEL.COMPLETION_THRESHOLD / w);
  assert(strokes(PEEL.STROKE_WIDTH_FRAC * 1.25) < strokes(PEEL.STROKE_WIDTH_FRAC), `H3: an idealised peel needs ${strokes(PEEL.STROKE_WIDTH_FRAC * 1.25)} strokes instead of ${strokes(PEEL.STROKE_WIDTH_FRAC)} at the same completion coverage`);
}

// ===== I: Handling effect =====
{
  assert(tapBufferWindowMs(TAP_KNIFE.BUFFER_TAIL_MS, chef) === 80 && tapBufferWindowMs(TAP_KNIFE.BUFFER_TAIL_MS, levelKnife("handling", 5)) === 240, "I: Handling 5 queues a tap from 240 ms before the cut ends (was 80 ms)");
  const base = knifeTapCadence(TAP_KNIFE, chef);
  const handy = knifeTapCadence(TAP_KNIFE, levelKnife("handling", 5));
  assert(handy.HITSTOP_MS === base.HITSTOP_MS / 2 && tapSequenceMs(handy) === tapSequenceMs(base), "I2: Handling halves the post-cut hit-pause and leaves the cut timing itself alone");
}

// ===== J: throughput a player can feel (the scene's own tap rules, fed with the real timings) =====
// PreparationScene.handleTap: a tap while idle starts a cut; while busy it is queued (one deep) only if the
// current cut has <= bufferWindow ms left, otherwise dropped; a queued tap fires when the cut ends.
function cutsLanded(knife: typeof chef, intervalMs: number, durationMs: number): number {
  const seq = tapSequenceMs(knifeTapCadence(TAP_KNIFE, knife));
  const buffer = tapBufferWindowMs(TAP_KNIFE.BUFFER_TAIL_MS, knife);
  let busyUntil = -1, queued = false, cuts = 0;
  for (let t = 0; t < durationMs; t += 1) {
    if (t >= busyUntil && queued) { queued = false; cuts++; busyUntil = t + seq; }
    if (t % intervalMs === 0) {
      if (t >= busyUntil) { cuts++; busyUntil = t + seq; }
      else if (busyUntil - t <= buffer) queued = true;
    }
  }
  return cuts;
}
{
  const full = { ...chef, tuning: knifeTuningFor({ sharpness: 5, speed: 5, handling: 5 }) };
  const a = cutsLanded(chef, 300, 10_000), b = cutsLanded(full, 300, 10_000);
  assert(b > a, `J: tapping every 300 ms for 10 s — the level-1 chef lands ${a} cuts, a fully forged chef ${b} (+${Math.round((b / a - 1) * 100)}%)`);
  const c = cutsLanded(chef, 120, 10_000), d = cutsLanded(full, 120, 10_000);
  assert(d > c, `J2: tapping as fast as possible (every 120 ms) — ${c} vs ${d} cuts in 10 s`);
  const e = cutsLanded(chef, 400, 10_000), f = cutsLanded({ ...chef, tuning: knifeTuningFor({ sharpness: 1, speed: 1, handling: 5 }) }, 400, 10_000);
  assert(f > e, `J3: Handling alone — a 400 ms tapper loses fewer taps (${e} → ${f} cuts)`);
  assert(tapSequenceMs(knifeTapCadence(TAP_KNIFE, full)) >= tapSequenceMs(knifeTapCadence(TAP_KNIFE, knifeOrDefault("paring"))) * 0.85, "J4: even fully forged, the cadence stays within the catalog's own range of knife feels");
}

// ===== K: grading / completion untouched =====
{
  const scene = read("src/game/scenes/PreparationScene.ts");
  const uses = scene.split("\n").filter((l) => /knifeStats\.tuning|tapBufferWindowMs\(|peelStrokeWidthFrac\(|knifeTapCadence\(/.test(l) && !/^\s*(\/\/|\*|import)/.test(l));
  assert(uses.length === 3, `K: the scene applies Blacksmith tuning at exactly three points — tap cadence, tap buffer, peel stroke width (found ${uses.length})`);
  assert(/completionThreshold: cfg\?\.completionThreshold \?\? PEEL\.COMPLETION_THRESHOLD/.test(scene), "K2: peel completion coverage is never scaled");
  for (const f of ["src/game/CutEvaluator.ts", "src/game/recipes/recipePay.ts", "src/game/economy/EconomySettlement.ts", "src/game/business/BusinessServiceManager.ts"]) {
    assert(!/\.tuning|knifeTuning|blacksmith|knifeUpgrades/i.test(read(f)), `K3: ${f} never reads Blacksmith data (grading and payouts unchanged)`);
  }
  const resolve = scene.slice(scene.indexOf("private resolveTapCut("), scene.indexOf("\n  }\n", scene.indexOf("private resolveTapCut(")));
  assert(resolve.length > 0 && !/tuning|tapTiming|knifeTapCadence/.test(resolve), "K4: cut-position resolution never reads knife timing or tuning");
}

// ===== L: no fake rewarded video (release rule: only YouTube-provided ads are allowed, none are integrated) =====
{
  assert(!fs.existsSync(path.resolve(ROOT, "src/game/ads/rewardedVideo.ts")), "L: the unavailable rewarded-video adapter is gone");
  const shop = read("src/components/kc/Shop.tsx");
  assert(!/Watch video|Video offer|showRewardedVideo|VIDEO_DISCOUNT/.test(shop), "L2: the Blacksmith shows no video button or video price");
  assert(upgradeCost.length === 1 && upgradeKnife.length === 3, "L3: one price path — upgradeCost(level) and upgradeKnife(save, knife, stat), no discount flag");
  const r = upgradeKnife(saveWith(dollars(79)), "chef", "speed");
  assert(!r.ok && r.reason === "insufficientFunds", "L4: an upgrade always costs its full price — nothing is ever discounted or free");
}

// ===== M: Campaign isolation + V2 freeze =====
{
  const start = saveWith(dollars(5000), { levelProgress: DEFAULT_SAVE.levelProgress, recipeProgress: { "camp-garlic-bread": { best: 91 } } as never, knifeSharpness: { chef: 64 } });
  const s = maxed(start, "chef");
  const keep = (x: SaveData) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !["credits", "knifeUpgrades", "economyLedger"].includes(k))));
  assert(keep(s) === keep(start), "M: upgrading changes only the wallet and knifeUpgrades — never levels, recipes, owned/equipped items or knife condition");
  const bought = buyKnife({ ...s, credits: dollars(5000), levelProgress: { ...s.levelProgress, highestUnlockedLevelId: "level-12" } }, "santoku");
  assert(bought.ok && bought.save.equippedKnifeId === "chef", "M2: existing knife purchase still works and still never auto-equips");
  const v2 = spawnSync("npx", ["tsx", JSON.stringify(path.resolve(import.meta.dirname, "economy-v2-campaign-simulation.mts"))], { encoding: "utf8", shell: true });
  const honest = v2.stdout.slice(v2.stdout.indexOf("SIMULATION HONEST"), v2.stdout.indexOf("Total net campaign result") + 60);
  const has = (label: string, value: string) => new RegExp(`${label}:\\s*${value}(?![\\d,])`).test(honest);
  assert(v2.status === 0 && has("Gross recipe revenue", "\\$165,140\\.00") && has("Level-completion rewards", "\\$330,691\\.00") && has("Total COGS", "\\$37,620\\.00") && has("Total quality bonuses", "\\$3,315\\.00") && has("Total net campaign result", "\\$461,526\\.00"), "M3: Economy V2 freeze exact — $165,140.00 / $330,691.00 / $37,620.00 / $3,315.00 / $461,526.00");
}

// ===== N: Business isolation =====
{
  const start = saveWith(dollars(5000), { business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 4 } } });
  const s = maxed(start, "chef");
  assert(JSON.stringify(s.business) === JSON.stringify(start.business), "N: Blacksmith upgrades never touch Business state");
  const app = read("src/App.tsx");
  assert(/const equippedKnife = effectiveKnife\(save, knifeOrDefault\(save\.equippedKnifeId\)\);/.test(app), "N2: every Preparation (Campaign, Restaurant Service, Business) plays the same effective knife — the feel upgrade applies everywhere, payments nowhere");
}

// ===== P: the Blacksmith's before -> after preview is the engine's own timing (UI copy can't drift) =====
{
  const lv1 = { sharpness: 1, speed: 1, handling: 1 };
  for (const stat of BLACKSMITH_STATS) {
    const p = forgePreview(chef, lv1, stat);
    const played = effectiveKnife({ knifeUpgrades: { chef: { ...lv1, [stat]: 2 } } }, chef);
    const cad = knifeTapCadence(TAP_KNIFE, played);
    assert(p.now.cycleMs === Math.round(tapSequenceMs(knifeTapCadence(TAP_KNIFE, chef))) && p.next!.cycleMs === Math.round(tapSequenceMs(cad)) && p.next!.queueMs === Math.round(tapBufferWindowMs(TAP_KNIFE.BUFFER_TAIL_MS, played)) && p.next!.pauseMs === Math.round(cad.HITSTOP_MS), `P: the ${stat} 1→2 preview (${p.now.cycleMs}→${p.next!.cycleMs} ms, catch ${p.now.queueMs}→${p.next!.queueMs} ms, pause ${p.now.pauseMs}→${p.next!.pauseMs} ms) equals what Preparation plays`);
  }
  assert(forgePreview(chef, { sharpness: 5, speed: 5, handling: 5 }, "speed").next === null, "P2: a mastered stat has no next preview");
  const shop = read("src/components/kc/Shop.tsx");
  assert(/never your score, grade or earnings/.test(shop) && /belong to the knife you forge/.test(shop) && /each knife keeps its own upgrades/.test(shop), "P3: the Blacksmith says upgrades are permanent, per knife, and never change score, grade or earnings");
  assert(/upgrades never wear off/.test(shop) && /Sharpening\s+restores it/.test(shop), "P4: the Sharpen action is explained as separate from the permanent Sharpness upgrade");
}

console.log(failures === 0 ? "\nBLACKSMITH QA: ALL PASS" : `\nBLACKSMITH QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
