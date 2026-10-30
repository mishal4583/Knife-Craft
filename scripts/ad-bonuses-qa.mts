/**
 * AD BONUSES QA — the five optional rewarded-ad cash bonuses
 * (src/game/ads/adBonuses.ts, developer 2026-10-18).
 *  A. Amounts: floating cash 10% of the level's pay ($5–$50); Level Complete
 *     +50% of a first clear (≤ $250, $0 for the practice level); short by
 *     the missing dollars rounded up, only for a gap ≤ 25% of the price and
 *     ≤ $150; Second Floor ×2 for a collection ≥ $50 (extra ≤ $250); daily
 *     gift 10% of the level's pay ($20–$60). Whole dollars.
 *  B. Commit: one credit and ONE "rewarded-ad" entry; idempotent by reward
 *     id; refused past today's cap; a bad amount or id is refused; wallet =
 *     opening + ledger.
 *  C. Caps per kind, per day, read from the ledger; a new day resets them;
 *     the Replay Bonus's cap counts only its own entries (and the bonuses
 *     don't touch it).
 *  D. Daily gift: free once a day (one "daily-reward" entry), not before
 *     Level 3; it survives a ledger trim of 200+ other entries, as do the
 *     ad entries.
 *  E. Every bonus has its own placement in AD_PLACEMENT and the Bridge
 *     config; the source pays only after `rewarded`; at a level's end the
 *     interstitial comes first, the Level bonus only when it can't show.
 *  F. Economy bound: a player who takes every offer every day (10 levels a
 *     day) ends the campaign at most 20% above the $132k completionist
 *     target; a player who never watches gets only the free gift.
 *
 * Run: npx tsx scripts/ad-bonuses-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import {
  AD_BONUS_DAILY_CAP,
  adBonusOffer,
  adBonusesLeftToday,
  commitAdBonus,
  dailyGiftAmount,
  dailyGiftDue,
  floatingCashAmount,
  floorDoubleAmount,
  levelDoubleAmount,
  newAdBonusRewardId,
  shortfallAmount,
  takeDailyGift,
  type AdBonusKind,
} from "../src/game/ads/adBonuses.ts";
import {
  REPLAY_BONUS_DAILY_CAP,
  commitReplayBonus,
  replayBonusesLeftToday,
  replayBonusOfferFor,
} from "../src/game/ads/replayBonus.ts";
import { AD_PLACEMENT } from "../src/game/PlayablesSDK.ts";

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}${ok || detail === undefined ? "" : " " + JSON.stringify(detail)}`,
  );
};
const $ = (d: number) => d * 100;
// Ledger entries are stamped with the real clock (appendLedgerEntry), so "today" is the real
// today; a fixed date stopped matching the entries once the calendar moved on (2026-10-22).
const NOW = new Date();
const TOMORROW = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1, 9, 0, 0);
const base = (): SaveData => {
  const s = structuredClone(DEFAULT_SAVE);
  return { ...s, credits: $(500), economyLedger: [] };
};
const sum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

/* ── A. amounts ── */
check(
  "A1 floating cash (10% of the level's pay, $5–$50): Level 1 $5 (floor), Level 3 $13, Level 50 and the last level $50 (cap) — on the 2026-10-30 pay curve",
  floatingCashAmount(1) === $(5) &&
    floatingCashAmount(3) === $(13) &&
    floatingCashAmount(50) === $(50) &&
    floatingCashAmount(148) === $(50),
  [floatingCashAmount(3), floatingCashAmount(50), floatingCashAmount(149)],
);
const l2 = LEVELS[1]!;
const l40 = LEVELS[39]!;
const l149 = LEVELS[LEVELS.length - 1]!;
check(
  "A2 Level Complete: +50% of the first clear, whole dollars, ≤ $250; $0 for a level that pays nothing",
  levelDoubleAmount({ id: "level-2", reward: { coins: 0 }, campaignRewardBasisLevel: 2 }) === 0 &&
    levelDoubleAmount(l2) > 0 &&
    levelDoubleAmount(l40) === Math.min($(250), Math.round(paidLevelReward(l40) / 200) * 100) &&
    levelDoubleAmount(l149) === Math.min($(250), Math.round(paidLevelReward(l149) / 200) * 100),
  [levelDoubleAmount(l2), levelDoubleAmount(l40), paidLevelReward(l40), levelDoubleAmount(l149)],
);
check(
  "A3 short by: $350 price with $300 → $50; $340.01 short by $40.01 → $41; gap > 25% or > $150 → none; not short → none",
  shortfallAmount($(350), $(300)) === $(50) &&
    shortfallAmount(34001, $(300)) === $(41) &&
    shortfallAmount($(400), $(200)) === 0 &&
    shortfallAmount($(2000), $(1800)) === 0 &&
    shortfallAmount($(300), $(300)) === 0 &&
    shortfallAmount(0, 0) === 0,
);
check(
  "A4 Second Floor ×2: under $50 none; $120 → +$120; $900 → +$250 (cap)",
  floorDoubleAmount($(49)) === 0 &&
    floorDoubleAmount($(120)) === $(120) &&
    floorDoubleAmount($(900)) === $(250),
);
check(
  "A5 daily gift (10% of the level's pay, $20–$60): Level 3 $20 (floor), Level 100 and the last level $60 (cap) — on the 2026-10-30 pay curve",
  dailyGiftAmount(3) === $(20) && dailyGiftAmount(100) === $(60) && dailyGiftAmount(148) === $(60),
  [dailyGiftAmount(3), dailyGiftAmount(100), dailyGiftAmount(149)],
);

/* ── B. commit ── */
{
  const s0 = base();
  const offer = adBonusOffer(s0, "floating_cash", $(20), NOW)!;
  const r = commitAdBonus(s0, offer, NOW);
  const again = r.ok ? commitAdBonus(r.save, offer, NOW) : null;
  check(
    "B1 a commit credits once with ONE rewarded-ad entry described by the reward id; a second commit of the same offer is refused",
    r.ok &&
      r.save.credits === s0.credits + $(20) &&
      r.save.economyLedger.length === 1 &&
      r.save.economyLedger[0]!.category === "rewarded-ad" &&
      r.save.economyLedger[0]!.description === offer.rewardId &&
      again?.ok === false &&
      again.reason === "alreadyClaimed",
  );
  check("B2 wallet = opening + ledger", r.ok && r.save.credits === s0.credits + sum(r.save));
  const bad = commitAdBonus(s0, { ...offer, amount: 1050.5 }, NOW);
  const wrongKind = commitAdBonus(s0, { ...offer, kind: "level_double" }, NOW);
  check(
    "B3 a fractional amount, or an id of another kind, is refused",
    !bad.ok &&
      bad.reason === "invalidAmount" &&
      !wrongKind.ok &&
      wrongKind.reason === "invalidAmount",
  );
  check(
    "B4 no offer for $0 or a non-integer amount",
    adBonusOffer(s0, "shortfall", 0, NOW) === null &&
      adBonusOffer(s0, "shortfall", 10.5, NOW) === null,
  );
}

/* ── C. caps ── */
{
  const kinds = Object.keys(AD_BONUS_DAILY_CAP) as AdBonusKind[];
  let allOk = true;
  for (const kind of kinds) {
    let s = base();
    for (let i = 0; i < AD_BONUS_DAILY_CAP[kind]; i++) {
      const o = adBonusOffer(s, kind, $(10), NOW);
      const r = o ? commitAdBonus(s, o, NOW) : null;
      if (!r?.ok) allOk = false;
      else s = r.save;
    }
    const over = commitAdBonus(s, { kind, rewardId: newAdBonusRewardId(kind), amount: $(10) }, NOW);
    if (
      adBonusOffer(s, kind, $(10), NOW) !== null ||
      over.ok ||
      adBonusesLeftToday(s, kind, TOMORROW) !== AD_BONUS_DAILY_CAP[kind]
    )
      allOk = false;
    // other kinds are untouched by this one's claims
    for (const other of kinds)
      if (other !== kind && adBonusesLeftToday(s, other, NOW) !== AD_BONUS_DAILY_CAP[other])
        allOk = false;
  }
  check(
    `C1 each kind stops at its own daily cap (${kinds.map((k) => `${k} ${AD_BONUS_DAILY_CAP[k]}`).join(", ")}), resets the next day, and never uses another kind's`,
    allOk,
  );
  let s = base();
  for (const kind of kinds) {
    const o = adBonusOffer(s, kind, $(10), NOW)!;
    const r = commitAdBonus(s, o, NOW);
    if (r.ok) s = r.save;
  }
  check(
    "C2 the ad bonuses never use the Replay Bonus's daily cap",
    replayBonusesLeftToday(s, NOW) === REPLAY_BONUS_DAILY_CAP,
  );
  let rs = base();
  for (let i = 0; i < REPLAY_BONUS_DAILY_CAP; i++) {
    const offer = replayBonusOfferFor(rs, LEVELS[9]!, true, true, NOW)!;
    const r = commitReplayBonus(rs, offer, NOW);
    if (r.ok) rs = r.save;
  }
  check(
    "C3 …and Replay Bonuses never use an ad bonus's cap",
    replayBonusesLeftToday(rs, NOW) === 0 &&
      kinds.every((k) => adBonusesLeftToday(rs, k, NOW) === AD_BONUS_DAILY_CAP[k]),
  );
}

/* ── D. daily gift ── */
{
  const s0 = base();
  const early = dailyGiftDue(s0, 2, NOW);
  const t = takeDailyGift(s0, 40, NOW);
  const twice = t.ok ? takeDailyGift(t.save, 40, NOW) : null;
  const tomorrow = t.ok ? dailyGiftDue(t.save, 40, TOMORROW) : 0;
  check(
    "D1 the free gift: none before Level 3; once a day with ONE daily-reward entry; due again tomorrow",
    early === 0 &&
      t.ok &&
      t.save.credits === s0.credits + dailyGiftAmount(40) &&
      t.save.economyLedger.length === 1 &&
      t.save.economyLedger[0]!.category === "daily-reward" &&
      twice?.ok === false &&
      tomorrow === dailyGiftAmount(40),
  );
  // 250 other entries after the gift and an ad bonus: both records are kept.
  let s = t.ok ? t.save : s0;
  const o = adBonusOffer(s, "daily_gift", $(20), NOW)!;
  const r = commitAdBonus(s, o, NOW);
  if (r.ok) s = r.save;
  for (let i = 0; i < 250; i++) s = appendLedgerEntry(s, "completion-reward", 100, `x${i}`);
  check(
    "D2 a trim of 250 other entries keeps today's gift and ad-bonus records (the caps can't reopen)",
    s.economyLedger.length <= 202 &&
      dailyGiftDue(s, 40, new Date()) === 0 &&
      adBonusesLeftToday(s, "daily_gift", new Date()) === 0,
    { length: s.economyLedger.length },
  );
}

/* ── E. placements and source ── */
{
  const cfg = JSON.parse(
    fs.readFileSync(path.resolve("public/playgama-bridge-config.json"), "utf8"),
  );
  const ids: string[] = cfg.advertisement.rewarded.placements.map((p: { id: string }) => p.id);
  const mine = [
    AD_PLACEMENT.floatingCash,
    AD_PLACEMENT.levelBonus,
    AD_PLACEMENT.shortfallTopUp,
    AD_PLACEMENT.floorDouble,
    AD_PLACEMENT.dailyGift,
  ];
  check(
    "E1 each bonus has its own placement, listed in the Bridge config",
    new Set(mine).size === 5 && mine.every((id) => ids.includes(id)),
    { mine, ids },
  );
  const app = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
  const flow = app.slice(
    app.indexOf("async function watchAdBonus"),
    app.indexOf("async function watchAdBonus") + 3000,
  );
  check(
    "E2 App's ad-bonus flow commits only after the Bridge's `rewarded`, from the latest save",
    flow.length > 100 &&
      /requestRewardedAd\(/.test(flow) &&
      /status !== "rewarded"/.test(flow) &&
      /saveRef\.current/.test(flow) &&
      flow.indexOf('status !== "rewarded"') < flow.indexOf("commitAdBonus("),
  );
}

{
  const app = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
  const fn = app.slice(
    app.indexOf("function afterLevelFinished"),
    app.indexOf("async function watchReplayBonusAd"),
  );
  const inter = fn.indexOf("maybeShowInterstitial(");
  const bonus = fn.indexOf('openAdBonus("level_double"');
  check(
    "E3 at a level's end the interstitial is decided first; the Level bonus is offered only when it didn't show (a declined bonus never costs the break its interstitial)",
    inter > 0 && bonus > inter && /if \(!interstitial\.show && !wasReplay\)/.test(fn),
    { inter, bonus },
  );
}

/* ── F. economy bound ── */
{
  // The completionist ends the campaign near $292k (pay re-plan, developer 2026-10-30; was the $132k plan).
  const TARGET = $(292_000);
  const LEVELS_PER_DAY = 10;
  let adMax = 0;
  let freeOnly = 0;
  for (let day = 0; day * LEVELS_PER_DAY < LEVELS.length; day++) {
    const from = Math.max(3, day * LEVELS_PER_DAY + 1);
    const to = Math.min(LEVELS.length - 1, (day + 1) * LEVELS_PER_DAY);
    if (from > to) continue;
    const mid = Math.round((from + to) / 2);
    freeOnly += dailyGiftAmount(mid);
    adMax += dailyGiftAmount(mid) * 2;
    adMax += AD_BONUS_DAILY_CAP.floating_cash * floatingCashAmount(mid);
    // the three best first clears of the day
    const doubles = LEVELS.slice(from - 1, to)
      .map((l) => levelDoubleAmount(l))
      .sort((a, b) => b - a)
      .slice(0, AD_BONUS_DAILY_CAP.level_double);
    adMax += doubles.reduce((t, n) => t + n, 0);
    adMax += AD_BONUS_DAILY_CAP.shortfall * $(150);
    if (to >= 60) adMax += AD_BONUS_DAILY_CAP.floor_double * $(250);
  }
  console.log(
    `     ad-max player (every offer, ${LEVELS_PER_DAY} levels/day): +$${Math.round(adMax / 100).toLocaleString()} (${((adMax / TARGET) * 100).toFixed(1)}% of $292k); never watches: +$${Math.round(freeOnly / 100).toLocaleString()} (free gifts)`,
  );
  check(
    "F1 a player who takes every offer ends at most 20% above the $292k target",
    adMax <= TARGET * 0.2,
  );
  check(
    "F2 a player who never watches gets only the free gift (≤ 1% of the target)",
    freeOnly <= TARGET * 0.01,
  );
}

console.log(failures ? `AD BONUSES QA: ${failures} FAILURE(S)` : "AD BONUSES QA: ALL PASS");
process.exit(failures ? 1 : 0);
