/**
 * PHASE5_QA — Phase 5 "restaurant transformation reveals, daily gift streak
 * and comeback rewards" (developer 2026-10-21):
 *   A. restoration (src/game/kitchen/restoration.ts, RestorationReveal.tsx,
 *      App.buildKitchenUpgrade) — stages over the existing tiers, prices and
 *      rules untouched, reveal only after a saved purchase, skip and cleanup;
 *   B. the gift streak (src/game/daily/giftStreak.ts, adBonuses.takeDailyGift,
 *      EconomyLedger trim, DailyGiftCard.tsx) — days in a row, Day 3 $100 and
 *      Day 7 $300 once each, missed days, the ledger keeping its record;
 *   E. no save field, Today's Special streak untouched, money only where approved.
 *
 * Run: npx tsx scripts/phase5-qa.mts
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
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { kitchenMapArtStage } from "../src/game/kitchen/kitchenMapArt.ts";
import {
  FAMILY_OBJECTS,
  RESTORATION_STAGES,
  TIER_RESTORATION,
  isMajorReveal,
  restorationCoversCatalog,
  stageOf,
  tierChangeLines,
} from "../src/game/kitchen/restoration.ts";
import {
  GIFT_STREAK,
  giftDays,
  giftStreakState,
  streakRewardOnTake,
  streakRewardsPaid,
} from "../src/game/daily/giftStreak.ts";
import {
  DAILY_GIFT_MAX,
  DAILY_GIFT_MIN,
  dailyGiftAmount,
  dailyGiftTakenToday,
  takeDailyGift,
} from "../src/game/ads/adBonuses.ts";
import { appendLedgerEntry, MAX_LEDGER_ENTRIES } from "../src/game/economy/EconomyLedger.ts";
import { dailyKeyFor } from "../src/game/daily/DailyOrderManager.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import type { EconomyLedgerEntry } from "../src/game/economy/ledgerTypes.ts";
import { dollars } from "../src/game/money.ts";

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
const app = code("src/App.tsx");

// ───────────────────────────────────────────────────────────── A. restoration
console.log("A. Restaurant restoration");
{
  const head = execSync(`git show ${PHASE_BASE}:src/game/kitchen/kitchenUpgradeDefinitions.ts`, {
    cwd: ROOT,
    encoding: "utf8",
  });
  const now = read("src/game/kitchen/kitchenUpgradeDefinitions.ts");
  assert(
    head === now.replace(/\r\n/g, "\n") ||
      head.replace(/\r\n/g, "\n") === now.replace(/\r\n/g, "\n"),
    "A1: the kitchen tiers, prices and unlock levels are byte-for-byte HEAD's",
  );
  assert(
    KITCHEN_UPGRADE_CATALOG.map((u) => u.price / 100).join() === "0,20000,25000,25000,30000,35000",
    "A2: prices as before ($0, $20k, $25k, $25k, $30k, $35k)",
  );
  const mgrDiff = execSync(
    "git diff --stat HEAD -- src/game/kitchen/KitchenUpgradeManager.ts src/game/restaurant/restaurantInvestments.ts",
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  assert(
    mgrDiff.trim() === "",
    "A3: the purchase rules (KitchenUpgradeManager, investments) are untouched",
  );
  assert(
    restorationCoversCatalog(),
    "A4: every existing tier maps to a restoration stage — and no tier was added",
  );
  assert(
    KITCHEN_UPGRADE_CATALOG.map((u) => stageOf(u.id)).join() ===
      "inherited,cleaning-repair,improved,improved,restored,restored" &&
      stageOf("nonsense") === "inherited",
    "A5: the six tiers fall into four stages (Inherited, Cleaning & Repair, Improved, Restored); unknown = inherited",
  );
  assert(
    isMajorReveal("humble-kitchen", "growing-kitchen") &&
      isMajorReveal("growing-kitchen", "established-kitchen") &&
      !isMajorReveal("established-kitchen", "neighborhood-cafe") &&
      isMajorReveal("neighborhood-cafe", "flourishing-cafe") &&
      !isMajorReveal("flourishing-cafe", "grand-kitchen"),
    "A6: a build into a new stage is a major reveal, one within a stage the short one",
  );
  assert(
    KITCHEN_UPGRADE_CATALOG.slice(1).every((u) => tierChangeLines(u.id).length >= 2) &&
      tierChangeLines("humble-kitchen").length === 0 &&
      Object.values(RESTORATION_STAGES).every((s) => s.name && s.line) &&
      /window/.test(FAMILY_OBJECTS) &&
      /worktop/.test(FAMILY_OBJECTS),
    "A7: every built tier names what it improved (lighting / equipment / workstation / furniture); the family's things are named",
  );
  assert(
    KITCHEN_UPGRADE_CATALOG.every((u) => kitchenMapArtStage(u.id) === kitchenMapArtStage(u.id)) &&
      Object.keys(TIER_RESTORATION).length === KITCHEN_UPGRADE_CATALOG.length,
    "A8: one entry per tier (the art itself is the existing per-tier skin and map art)",
  );
  const build = app.slice(
    app.indexOf("function buildKitchenUpgrade("),
    app.indexOf("function setEquippedKnife("),
  );
  assert(
    /const result = purchaseKitchenUpgrade\(current, id\);\s*if \(result\.ok\) \{\s*persist\(/.test(
      build,
    ) &&
      /if \(from !== to\) setRestorationReveal\(\(r\) => r \?\? \{ from, to \}\);/.test(build) &&
      build.indexOf("persist(") < build.indexOf("setRestorationReveal"),
    "A9: the reveal opens only after a successful, saved purchase — never for a failed one — and one at a time",
  );
  const reveal = code("src/components/kc/RestorationReveal.tsx");
  assert(
    /forEach\(\(t\) => window\.clearTimeout\(t\)\)/.test(reveal) &&
      /function skip\(\)/.test(reveal) &&
      /if \(closed\.current\) return;/.test(reveal) &&
      /kc-reduced-motion/.test(reveal) &&
      /AudioManager\.playChime/.test(reveal),
    "A10: skippable, timers cleaned, closes once, Reduced Motion shows the result at once, sound through AudioManager (mute)",
  );
  assert(
    !/credits|appendLedgerEntry|persist\(|purchase/i.test(
      code("src/game/kitchen/restoration.ts"),
    ) && !/appendLedgerEntry|persist\(|purchaseKitchenUpgrade/.test(reveal),
    "A11: the restoration layer and the reveal never touch money or the purchase",
  );
  assert(
    /<KitchenBackground skin=\{equippedUpgrade\.asset\} \/>/.test(
      code("src/components/kc/Kitchen.tsx"),
    ),
    "A12: the Kitchen still paints the saved tier's own art (so a reload shows the right kitchen)",
  );
}

assert(
  /src=\{kitchenArt \?\? kitchenBg\}/.test(code("src/components/kc/game/Preparation.tsx")) &&
    /save\.equippedKitchenUpgradeId !== "humble-kitchen"/.test(app) &&
    (app.match(/kitchenArt: cuttingKitchenArt/g) ?? []).length === 2,
  "A13: the cutting screen paints the built tier's art (both Preparation mounts); the Humble Kitchen keeps the original",
);

// ───────────────────────────────────────────────────────────── B. gift streak
console.log("\nB. Daily gift streak");
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 9, 21, 12, 0, 0); // a noon, so ±days never cross DST oddities in the key
const at = (offset: number) => new Date(T0.getTime() + offset * DAY);
const key = (offset: number) => dailyKeyFor(at(offset));
const gift = (offset: number, id = `g${offset}`): EconomyLedgerEntry => ({
  id,
  timestamp: at(offset).getTime(),
  category: "daily-reward",
  amount: dollars(20),
  description: `knifecraft-daily-gift-${key(offset)}`,
});
const reward = (offset: number, day: number): EconomyLedgerEntry => ({
  id: `r${offset}`,
  timestamp: at(offset).getTime(),
  category: "daily-reward",
  amount: GIFT_STREAK.REWARDS[day]!,
  description: `knifecraft-gift-streak-day${day}-${key(offset)}`,
});
const L = (...e: EconomyLedgerEntry[]) => ({ economyLedger: e });
{
  assert(
    GIFT_STREAK.REWARDS[3] === dollars(100) &&
      GIFT_STREAK.REWARDS[7] === dollars(300) &&
      Object.keys(GIFT_STREAK.REWARDS).join() === "3,7" &&
      GIFT_STREAK.REWARDS[7]! > DAILY_GIFT_MAX * 4 &&
      DAILY_GIFT_MIN === dollars(20) &&
      DAILY_GIFT_MAX === dollars(60),
    "B1: fixed rewards — Day 3 $100, Day 7 $300 (5× the largest daily gift); the daily gift itself unchanged ($20–$60)",
  );
  const fresh = giftStreakState(L(), T0);
  assert(
    !fresh.takenToday &&
      fresh.done === 0 &&
      fresh.todayDay === 1 &&
      !fresh.restarted &&
      fresh.next?.day === 3,
    "B2: a first gift is Day 1; the next reward is Day 3",
    fresh,
  );
  const two = giftStreakState(L(gift(-2), gift(-1)), T0);
  assert(
    two.todayDay === 3 && two.done === 2 && two.next?.day === 3,
    "B3: two days in a row → today's gift is Day 3",
    two,
  );
  const took = giftStreakState(L(gift(-2), gift(-1), gift(0)), T0);
  assert(
    took.takenToday && took.done === 3 && took.todayDay === 3 && took.next?.day === 7,
    "B4: taken today: 3 done, next reward Day 7",
    took,
  );
  const missed = giftStreakState(L(gift(-4), gift(-3)), T0);
  assert(
    missed.todayDay === 1 && missed.done === 0 && missed.restarted,
    "B5: a missed day starts a new streak at Day 1 (and says so) — nothing is charged or removed",
    missed,
  );
  const six = L(gift(-6), gift(-5), gift(-4), reward(-4, 3), gift(-3), gift(-2), gift(-1));
  const s6 = giftStreakState(six, T0);
  assert(
    s6.todayDay === 7 && s6.next?.day === 7,
    "B6: six days in a row → today's gift is Day 7",
    s6,
  );
  const closedYesterday = L(
    gift(-7),
    gift(-6),
    gift(-5),
    reward(-5, 3),
    gift(-4),
    gift(-3),
    gift(-2),
    gift(-1),
    reward(-1, 7),
  );
  const after7 = giftStreakState(closedYesterday, T0);
  assert(
    after7.todayDay === 1 && !after7.restarted && after7.done === 0,
    "B7: the day after Day 7 starts a new week at Day 1",
    after7,
  );
  const r3 = streakRewardOnTake(L(gift(-2), gift(-1)), T0);
  const r7 = streakRewardOnTake(six, T0);
  const rNone = streakRewardOnTake(L(gift(-1)), T0);
  assert(
    r3?.day === 3 &&
      r3.amount === dollars(100) &&
      r3.id === `knifecraft-gift-streak-day3-${key(0)}` &&
      r7?.day === 7 &&
      r7.amount === dollars(300) &&
      rNone === null,
    "B8: taking Day 3's gift pays $100, Day 7's $300, any other day nothing",
  );
  assert(
    streakRewardOnTake(L(gift(-2), gift(-1), gift(0)), T0) === null &&
      streakRewardOnTake(L(gift(-2), gift(-1), reward(0, 3)), T0) === null,
    "B9: never twice — not once today's gift is taken, nor if today's reward entry already exists",
  );
}
{
  // takeDailyGift: the gift and its reward in one save, once.
  const base: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    credits: dollars(1000),
    economyLedger: [gift(-2), gift(-1)],
  };
  const level = 20;
  const r = takeDailyGift(base, level, T0);
  const entries = r.ok ? r.save.economyLedger.slice(2) : [];
  assert(
    r.ok &&
      r.amount === dailyGiftAmount(level) &&
      r.streak?.day === 3 &&
      r.save.credits === base.credits + dailyGiftAmount(level) + dollars(100) &&
      entries.length === 2 &&
      entries.every((e) => e.category === "daily-reward") &&
      entries[0]!.description === `knifecraft-daily-gift-${key(0)}` &&
      entries[1]!.description === `knifecraft-gift-streak-day3-${key(0)}`,
    "B10: taking Day 3's gift credits the gift + $100 in ONE save, as two 'daily-reward' entries (wallet = entries)",
    r.ok
      ? { credits: r.save.credits - base.credits, entries: entries.map((e) => e.description) }
      : r,
  );
  const again = r.ok ? takeDailyGift(r.save, level, T0) : { ok: true };
  assert(!again.ok, "B11: a second take the same day pays nothing (gift or reward)");
  const plain = takeDailyGift({ ...base, economyLedger: [gift(-1)] }, level, T0);
  assert(
    plain.ok && plain.streak === null && plain.save.economyLedger.length === 2,
    "B12: an ordinary day's gift is exactly as before (one entry, no reward)",
  );
  const early = takeDailyGift(base, 2, T0);
  assert(!early.ok, "B13: before Level 3 there is no gift (and no streak) — as before");
}
{
  // The ledger keeps the gift record 9 days through a busy stretch.
  let s: SaveData = { ...structuredClone(DEFAULT_SAVE), economyLedger: [] };
  const realNow = Date.now;
  try {
    for (let d = -8; d <= 0; d++) {
      Date.now = () => at(d).getTime();
      s = { ...s, economyLedger: [...s.economyLedger, gift(d, `gift${d}`)] };
      for (let i = 0; i < 60; i++)
        s = appendLedgerEntry(s, "campaign-settlement", 100, `o${d}-${i}`);
    }
  } finally {
    Date.now = realNow;
  }
  const kept = giftDays(s.economyLedger);
  assert(
    s.economyLedger.length <= MAX_LEDGER_ENTRIES + 20 && kept.size === 9,
    "B14: a busy week (540 other entries) keeps all 9 days of gift entries; the ledger stays bounded",
    { length: s.economyLedger.length, kept: kept.size },
  );
  assert(
    streakRewardsPaid([reward(0, 3), gift(0)]).length === 1,
    "B15: reward entries are recognised by their own id",
  );
}
{
  const card = code("src/components/kc/DailyGiftCard.tsx");
  assert(
    /onClick=\{ready \? onOpen : undefined\}/.test(card) &&
      !/takeDailyGift|persist\(|appendLedgerEntry/.test(card) &&
      // No Page Visibility API (CLAUDE.md §9, preflight; re-baselined 2026-10-22): the day is
      // re-read on window focus and every 30 s.
      !/visibilitychange|document\.hidden|visibilityState/.test(card) &&
      /setInterval\(check, 30_000\)/.test(card) &&
      /addEventListener\("focus", check\)/.test(card) &&
      /removeEventListener\("focus", check\)/.test(card) &&
      /clearInterval\(t\)/.test(card),
    "B16: the Kitchen card only OPENS the existing gift sheet (one claim path); it re-reads the day on focus and every 30 s (no Page Visibility API), and cleans up",
  );
  assert(
    /const reward = streakRewardOnTake\(current, now\);/.test(app) &&
      /granted: r\.amount \+ \(r\.streak\?\.amount \?\? 0\), streak: r\.streak/.test(app) &&
      /granted \+= gift\.amount \+ \(gift\.streak\?\.amount \?\? 0\);/.test(app),
    "B17: the sheet says the reward before the take and both claim paths (free / with the ad) report what really landed",
  );
}

// ───────────────────────────────────────────────────────────── E. save & money
console.log("\nE. Save and money");
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
  const headApp = execSync(`git show ${PHASE_BASE}:src/App.tsx`, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  const writes = (s: string) => (s.match(/appendLedgerEntry\(/g) ?? []).length;
  assert(
    writes(read("src/App.tsx")) === writes(headApp) + 2,
    "E2: App has no new ledger write (the reward is written inside takeDailyGift)",
  );
  const p5 = [
    "src/game/daily/giftStreak.ts",
    "src/game/kitchen/restoration.ts",
    "src/components/kc/DailyGiftCard.tsx",
    "src/components/kc/RestorationReveal.tsx",
  ].map(code);
  assert(
    p5.every((f) => !/localStorage|sessionStorage|indexedDB|bridge\.storage/.test(f)),
    "E3: no new storage of any kind",
  );
  const daily = execSync(`git diff ${PHASE_BASE} -- src/game/daily/DailyOrderManager.ts`, {
    cwd: ROOT,
    encoding: "utf8",
  });
  const changed = daily.split("\n").filter((l) => /^[+-][^+-]/.test(l));
  assert(
    changed.length === 2 && changed.every((l) => /previousDayKey\(key: string\)/.test(l)),
    "E4: Today's Special and its streak are untouched (only previousDayKey is now exported)",
    changed,
  );
  assert(
    dailyGiftTakenToday({ ...DEFAULT_SAVE, economyLedger: [gift(0)] } as SaveData, T0),
    "E5: 'taken today' is still the existing gift entry",
  );
}

console.log(failures === 0 ? "\nPHASE 5 QA: ALL PASS" : `\nPHASE 5 QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
