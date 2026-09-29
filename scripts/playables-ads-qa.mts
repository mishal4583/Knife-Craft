/**
 * PLAYGAMA ADS QA — Bridge interstitial + rewarded (Replay Bonus) ads.
 *
 * Same guarantees as the YouTube build, against a fake Playgama Bridge that
 * emits Bridge's real ad states (loading / opened / rewarded / closed / failed):
 *  A. SDK wrapper: a reward only when the state `rewarded` was reported;
 *     closed-without-reward / failed / throw / unsupported are not; the
 *     platform always gets the stable placement; one ad at a time; ad-active flag.
 *  B. Replay Bonus commit: wallet delta = reward, exactly one ledger entry,
 *     idempotent by transaction id, daily cap, claimed state derived from ledger.
 *  C. Persistence through Bridge storage: commit → save → re-read → reload.
 *  D. Ledger: reconciles; recent rewarded-ad entries survive trimming.
 *  E. Interstitial gate (Playgama monetization guide): none before 3 completed
 *     levels, then any natural break once 150 s (inside the recommended
 *     120–240 s) have passed since the last ad; duplicates, ad-active,
 *     unavailable; the Bridge config (120 s floor, one placement per ad spot).
 *  H. Level messages: level_started / level_paused / level_resumed /
 *     level_completed with { world, level }, each once, never outside a level.
 *  F. Production safety (source scan).
 *  G. Real ad lengths (simulated clock): a 150 s rewarded ad still pays; an ad
 *     that never starts ends "not shown" (30 s); one that started but never
 *     answers releases the screen at 120 s without granting; the game wakes
 *     after an ad even if the platform pauses but never resumes.
 *
 * Run: npx tsx scripts/playables-ads-qa.mts
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

/* ── a fake Playgama Bridge ─────────────────────────────────────────── */
type Emit = (state: string) => void;
type AdScript = (emit: Emit) => void;
const listeners: Record<string, Array<(v: never) => void>> = {};
const on = (e: string, h: (v: never) => void) => void (listeners[e] ??= []).push(h);
const off = (e: string, h: (v: never) => void) =>
  void (listeners[e] = (listeners[e] ?? []).filter((x) => x !== h));
const fire = (e: string, v: unknown) =>
  (listeners[e] ?? []).slice().forEach((h) => (h as (x: unknown) => void)(v));
const storage = new Map<string, unknown>();
const fake = {
  rewardedSupported: true,
  interstitialSupported: true,
  rewarded: ((emit) => { emit("opened"); emit("rewarded"); emit("closed"); }) as AdScript,
  interstitial: ((emit) => { emit("opened"); emit("closed"); }) as AdScript,
  placements: [] as string[],
  interstitialPlacements: [] as string[],
  messages: [] as Array<[string, unknown]>,
  calls: 0,
};
const EVENT_NAME = {
  PAUSE_STATE_CHANGED: "pause_state_changed",
  AUDIO_STATE_CHANGED: "audio_state_changed",
  INTERSTITIAL_STATE_CHANGED: "interstitial_state_changed",
  REWARDED_STATE_CHANGED: "rewarded_state_changed",
};
const bridge = {
  initialize: async () => {},
  EVENT_NAME,
  platform: { id: "mock", language: "en", isAudioEnabled: true, sendMessage: (m: string, o?: unknown) => void fake.messages.push([m, o]), on },
  storage: {
    get: async (keys: string[]) => keys.map((k) => storage.get(k) ?? null),
    set: async (keys: string[], values: unknown[]) => keys.forEach((k, i) => storage.set(k, values[i])),
  },
  advertisement: {
    get isInterstitialSupported() { return fake.interstitialSupported; },
    get isRewardedSupported() { return fake.rewardedSupported; },
    showInterstitial: (placement: string) => {
      fake.calls++;
      fake.interstitialPlacements.push(placement);
      fake.interstitial((st) => fire(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, st));
    },
    showRewarded: (placement: string) => {
      fake.calls++;
      fake.placements.push(placement);
      fake.rewarded((st) => fire(EVENT_NAME.REWARDED_STATE_CHANGED, st));
    },
    on,
    off,
  },
};
(globalThis as unknown as { window: { bridge: typeof bridge } }).window = { bridge };

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import {
  AD_PLACEMENT,
  INTERSTITIAL_PLACEMENT,
  interstitialAdsAvailable,
  isAdActive,
  levelAbandoned,
  levelCompleted,
  levelPaused,
  levelResumed,
  levelStarted,
  onAdActiveChange,
  platformReady,
  requestInterstitialAd,
  requestRewardedAd,
  rewardedAdsAvailable,
  REWARDED_PLACEMENT,
  SAVE_KEY,
} from "../src/game/PlayablesSDK.ts";
import {
  REPLAY_BONUS_DAILY_CAP,
  REWARD_ID_PREFIX,
  commitReplayBonus,
  isReplayBonusClaimed,
  newReplayBonusRewardId,
  replayBonusAmount,
  replayBonusOfferFor,
  replayBonusesClaimedToday,
  verifyReplayBonusCommit,
} from "../src/game/ads/replayBonus.ts";
import {
  INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_MIN_COMPLETED_LEVELS,
  decideInterstitial,
  type InterstitialPolicyState,
} from "../src/game/ads/interstitialPolicy.ts";
import { appendLedgerEntry, MAX_LEDGER_ENTRIES } from "../src/game/economy/EconomyLedger.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else console.log(`ok   ${label}`);
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");
const level10 = LEVELS[9]!;
const replaySave = (): SaveData => {
  const s = structuredClone(DEFAULT_SAVE);
  const done = LEVELS.slice(0, 12).map((l) => l.id);
  return { ...s, credits: 62300, levelProgress: { ...s.levelProgress, completedLevelIds: done, currentLevelId: "level-13", highestUnlockedLevelId: "level-13" } };
};
const sum = (s: SaveData) => s.economyLedger.reduce((a, e) => a + e.amount, 0);
const NOW = new Date(2026, 8, 26, 14, 0, 0);

await platformReady();

// ===== A: SDK wrapper =====
{
  fake.rewardedSupported = false;
  fake.interstitialSupported = false;
  assert(!rewardedAdsAvailable() && !interstitialAdsAvailable() && (await requestRewardedAd("x")).status === "unavailable" && (await requestInterstitialAd()) === "unavailable", "A: platform without ads → 'unavailable', nothing shown (button hidden, interstitials skipped)");
  fake.rewardedSupported = true;
  fake.interstitialSupported = true;
  assert(rewardedAdsAvailable() && interstitialAdsAvailable(), "A2: ads available once Bridge reports support");

  const cases: Array<[string, AdScript, string]> = [
    ["opened → rewarded → closed", (e) => { e("loading"); e("opened"); e("rewarded"); e("closed"); }, "rewarded"],
    ["opened → closed (skipped)", (e) => { e("opened"); e("closed"); }, "not-rewarded"],
    ["failed", (e) => e("failed"), "failed"],
    ["throws", () => { throw new Error("no fill"); }, "failed"],
    ["rewarded → failed", (e) => { e("opened"); e("rewarded"); e("failed"); }, "rewarded"],
  ];
  for (const [label, script, want] of cases) {
    fake.rewarded = script;
    const r = await requestRewardedAd(newReplayBonusRewardId("level-10"));
    assert(r.status === want, `A3: Bridge ${label} → ${want}`);
  }
  assert(fake.placements.length > 0 && fake.placements.every((p) => p === REWARDED_PLACEMENT), `A4: the platform always receives the stable placement '${REWARDED_PLACEMENT}' (never a per-offer id)`);
  fake.placements = [];
  fake.rewarded = (e) => { e("opened"); e("rewarded"); e("closed"); };
  const rush = await requestRewardedAd("rush-1", AD_PLACEMENT.rushRestock);
  fake.interstitialPlacements = [];
  await requestInterstitialAd();
  await requestInterstitialAd(AD_PLACEMENT.businessDayEnd);
  assert(rush.status === "rewarded" && JSON.stringify(fake.placements) === JSON.stringify(["rush_restock"]) && JSON.stringify(fake.interstitialPlacements) === JSON.stringify(["level_completed", "business_day_end"]) && INTERSTITIAL_PLACEMENT === "level_completed", "A4b: each ad spot reports its own placement — rush_restock, level_completed (default), business_day_end");

  let emit!: Emit;
  fake.rewarded = (e) => { emit = e; e("opened"); };
  fake.calls = 0;
  const seen: boolean[] = [];
  const offActive = onAdActiveChange((a) => seen.push(a));
  const first = requestRewardedAd("a");
  const second = await requestRewardedAd("b");
  const inter = await requestInterstitialAd();
  assert(fake.calls === 1 && second.status === "busy" && inter === "busy" && isAdActive(), "A5: double tap / second request while an ad is open → 'busy', Bridge is asked exactly once");
  emit("rewarded");
  emit("closed");
  assert((await first).status === "rewarded" && !isAdActive() && JSON.stringify(seen) === "[true,false]", "A6: ad-active turns on for the request and off when it settles");
  offActive();

  fake.interstitial = () => { throw new Error("no ad"); };
  assert((await requestInterstitialAd()) === "failed" && !isAdActive(), "A7: an interstitial failure never throws and releases the ad lock");
  fake.interstitial = (e) => { e("opened"); e("closed"); };
}

// ===== B: Replay Bonus commit =====
{
  const amount = replayBonusAmount(level10);
  assert(amount === Math.max(1000, Math.round((level10.reward.coins * 100 * 0.2) / 100) * 100) && amount % 100 === 0, `B: bonus = 20% of the level's reward, whole dollars, min $10 (Level 10 → $${amount / 100})`);
  // Economy V2.5: the bonus is capped at $200 (3/day → at most $600/day).
  assert(replayBonusAmount(LEVELS[0]!) === 1000 && replayBonusAmount(LEVELS[249]!) === 20000, "B2: Level 1 → $10 (minimum), Level 250 → $200 (the V2.5 cap; 20% of its $5,000 would be $1,000)");
  assert(LEVELS.every((l) => { const a = replayBonusAmount(l); return a >= 1000 && a <= 20000 && a % 100 === 0; }), "B2b: every level's Replay Bonus is whole dollars within $10–$200");
  const id = newReplayBonusRewardId("level-10");
  assert(id.startsWith(`${REWARD_ID_PREFIX}level-10-`) && id !== newReplayBonusRewardId("level-10") && !/@|user|name/i.test(id), "B3: reward ids are unique, prefixed, and carry no user data");

  const s0 = replaySave();
  assert(replayBonusOfferFor(s0, level10, false, true, NOW) === null, "B4: a FIRST completion never gets a Replay Bonus offer");
  assert(replayBonusOfferFor(s0, level10, true, false, NOW) === null, "B5: rewarded ads unavailable → no offer (button never shown)");
  const offer = replayBonusOfferFor(s0, level10, true, true, NOW)!;
  assert(!!offer && offer.amount === amount && offer.levelId === "level-10", "B6: a replay with ads available gets an offer");

  const c = commitReplayBonus(s0, offer, NOW);
  assert(c.ok, "B7: SDK true → commit succeeds");
  const s1 = (c as { ok: true; save: SaveData }).save;
  const entries = s1.economyLedger.filter((e) => e.description === offer.rewardId);
  assert(s1.credits === s0.credits + amount && entries.length === 1 && entries[0]!.category === "rewarded-ad" && entries[0]!.amount === amount, "B8: wallet delta === reward, exactly one 'rewarded-ad' ledger entry");
  assert(verifyReplayBonusCommit(s0, s1, offer) && isReplayBonusClaimed(s1, offer.rewardId) && !isReplayBonusClaimed(s0, offer.rewardId), "B9: verify passes; 'claimed' is read from the ledger (true after, false before)");
  const again = commitReplayBonus(s1, offer, NOW);
  assert(!again.ok && again.reason === "alreadyClaimed", "B10: the same reward id can't be committed twice (repeated callback / re-render / reopen)");
  assert(!verifyReplayBonusCommit(s0, { ...s1, credits: s1.credits + 1 }, offer) && !verifyReplayBonusCommit(s0, s0, offer), "B11: verify rejects a wrong wallet delta or a missing entry (never 'granted' without the state)");

  let s = s0;
  for (let i = 0; i < REPLAY_BONUS_DAILY_CAP; i++) {
    const o = replayBonusOfferFor(s, level10, true, true, NOW)!;
    s = (commitReplayBonus(s, o, NOW) as { ok: true; save: SaveData }).save;
  }
  assert(replayBonusesClaimedToday(s, NOW) === REPLAY_BONUS_DAILY_CAP && replayBonusOfferFor(s, level10, true, true, NOW) === null, `B12: daily cap — after ${REPLAY_BONUS_DAILY_CAP} bonuses today, no further offer`);
  const late = { levelId: "level-10", rewardId: newReplayBonusRewardId("level-10"), amount };
  const capped = commitReplayBonus(s, late, NOW);
  assert(!capped.ok && capped.reason === "dailyCapReached", "B13: a commit past the cap is refused even if an offer was open");
  const tomorrow = new Date(NOW.getTime() + 24 * 3600 * 1000);
  // today's entries are stamped with the real clock (appendLedgerEntry uses Date.now()); count them against the real day
  const realNow = new Date();
  assert(replayBonusesClaimedToday(s, realNow) === REPLAY_BONUS_DAILY_CAP && replayBonusesClaimedToday(s, new Date(realNow.getTime() + 24 * 3600 * 1000)) === 0 && !!tomorrow, "B14: the cap resets the next calendar day (derived from ledger timestamps — no new save field)");
}

// ===== C: persistence through Bridge storage, failures change nothing =====
{
  fake.rewarded = (e) => { e("opened"); e("rewarded"); e("closed"); };
  const s0 = replaySave();
  await SaveManager.save(s0);
  assert(typeof storage.get(SAVE_KEY) === "string" && memoryStore.size === 0, `C0: the save goes to Bridge storage under '${SAVE_KEY}' — localStorage is never touched`);
  const walletBefore = s0.credits;
  const entriesBefore = s0.economyLedger.length;
  const offer = replayBonusOfferFor(s0, level10, true, true, NOW)!;
  const r = await requestRewardedAd(offer.rewardId);
  assert(r.status === "rewarded", "C: fake Bridge reports 'rewarded'");
  const commit = commitReplayBonus(s0, offer, NOW) as { ok: true; save: SaveData };
  await SaveManager.save(commit.save);
  const persisted = await SaveManager.readPersisted();
  assert(!!persisted && persisted.credits === walletBefore + offer.amount && persisted.economyLedger.filter((e) => e.description === offer.rewardId).length === 1, "C2: after save, the PERSISTED Bridge save (read back, bypassing cache) has the new wallet and the entry");
  const reloaded = JSON.parse(storage.get(SAVE_KEY) as string) as SaveData;
  assert(reloaded.credits === walletBefore + offer.amount && reloaded.economyLedger.length === entriesBefore + 1 && isReplayBonusClaimed(reloaded, offer.rewardId), `C3: reload → wallet ${walletBefore} + ${offer.amount} = ${reloaded.credits}, ledger ${entriesBefore} → ${reloaded.economyLedger.length}, bonus still claimed`);

  const failSave = replaySave();
  const snapshot = JSON.stringify(failSave);
  const scripts: AdScript[] = [(e) => { e("opened"); e("closed"); }, (e) => e("failed")];
  for (const script of scripts) {
    fake.rewarded = script;
    const o = replayBonusOfferFor(failSave, level10, true, true, NOW)!;
    const res = await requestRewardedAd(o.rewardId);
    const after = res.status === "rewarded" ? (commitReplayBonus(failSave, o, NOW) as { ok: true; save: SaveData }).save : failSave;
    assert(res.status !== "rewarded" && JSON.stringify(after) === snapshot && !isReplayBonusClaimed(after, o.rewardId), `C4: Bridge ${res.status} → zero wallet change, zero ledger entries, save untouched`);
  }
}

// ===== D: ledger reconciliation + trimming keeps recent reward entries =====
{
  const s0 = { ...replaySave(), credits: 0, economyLedger: [] };
  let s: SaveData = { ...s0, credits: 40000 };
  s = appendLedgerEntry(s, "completion-reward", 40000, "level-1");
  const offer = replayBonusOfferFor(s, level10, true, true, NOW)!;
  s = (commitReplayBonus(s, offer, NOW) as { ok: true; save: SaveData }).save;
  s = appendLedgerEntry({ ...s, credits: s.credits - 35000 }, "knife-purchase", -35000, "santoku");
  assert(0 + sum(s) === s.credits, `D: opening $0 + earnings + rewarded-ad − purchases = closing (${s.credits})`);
  let big = s;
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 60; i++) big = appendLedgerEntry({ ...big, credits: big.credits + 100 }, "daily-reward", 100, `d${i}`);
  assert(big.economyLedger.length === MAX_LEDGER_ENTRIES && isReplayBonusClaimed(big, offer.rewardId), `D2: after ${MAX_LEDGER_ENTRIES + 60} more entries the ledger is still capped at ${MAX_LEDGER_ENTRIES} and today's rewarded-ad entry survived (the daily cap can't be reopened)`);
  const old = { ...s, economyLedger: s.economyLedger.map((e) => (e.category === "rewarded-ad" ? { ...e, timestamp: e.timestamp - 3 * 24 * 3600 * 1000 } : e)) };
  let big2 = old;
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 5; i++) big2 = appendLedgerEntry({ ...big2, credits: big2.credits + 100 }, "daily-reward", 100, `d${i}`);
  assert(!big2.economyLedger.some((e) => e.category === "rewarded-ad"), "D3: old rewarded-ad entries still age out normally (the window stays bounded)");
}

// ===== E: interstitial gate =====
{
  const fresh = (): InterstitialPolicyState => ({ handled: new Set() });
  const base = { completedLevels: 20, now: 10_000_000, lastAdSettledAt: 0, adActive: false, available: true };
  // A session of natural breaks: ad, then 10 s / 100 s / 150 s / 200 s after it.
  let st = fresh();
  const shows: boolean[] = [];
  let lastAd = 0;
  for (const [i, gap] of [[1, 0], [2, 10_000], [3, 100_000], [4, 150_000], [5, 10_000], [6, 200_000]] as const) {
    const now = base.now + i * 1_000_000;
    const r = decideInterstitial(st, { ...base, transitionId: `t${i}`, now, lastAdSettledAt: gap === 0 ? 0 : lastAd === 0 ? 0 : now - gap });
    st = r.state;
    shows.push(r.decision.show);
    if (r.decision.show) lastAd = now;
  }
  assert(JSON.stringify(shows) === JSON.stringify([true, false, false, true, false, true]) && INTERSTITIAL_COOLDOWN_MS === 150_000 && INTERSTITIAL_COOLDOWN_MS >= 120_000 && INTERSTITIAL_COOLDOWN_MS <= 240_000, "E: past the first levels, any natural break shows an interstitial once 150 s (Playgama's 120–240 s range) have passed since the last ad");
  st = fresh();
  const byLevels: boolean[] = [];
  for (let i = 0; i <= 3; i++) {
    const r = decideInterstitial(st, { ...base, completedLevels: i, transitionId: `e${i}` });
    st = r.state;
    byLevels.push(r.decision.show);
  }
  assert(JSON.stringify(byLevels) === JSON.stringify([false, false, false, true]) && INTERSTITIAL_MIN_COMPLETED_LEVELS === 3, "E2: no interstitial before 3 Campaign levels are completed (the intro and first levels stay ad-free); the first natural break after that may show one");
  st = fresh();
  const dup1 = decideInterstitial(st, { ...base, transitionId: "same" });
  const dup2 = decideInterstitial(dup1.state, { ...base, transitionId: "same" });
  assert(dup1.decision.show && !dup2.decision.show && (dup2.decision as { reason: string }).reason === "duplicate", "E3: the same transition (re-render, repeat click, back/forward) is handled once");
  const cd = decideInterstitial(fresh(), { ...base, transitionId: "c", lastAdSettledAt: base.now - INTERSTITIAL_COOLDOWN_MS + 1000 });
  assert(!cd.decision.show && (cd.decision as { reason: string }).reason === "cooldown", "E4: cooldown since the last ad of any kind (never straight after a rewarded ad)");
  const act = decideInterstitial(fresh(), { ...base, transitionId: "a", adActive: true });
  const un = decideInterstitial(fresh(), { ...base, transitionId: "u", available: false });
  assert(!act.decision.show && !un.decision.show, "E5: never while another ad is active; never without the SDK ads API");
  const cfg = JSON.parse(read("public/playgama-bridge-config.json")) as {
    advertisement: {
      minimumDelayBetweenInterstitial: number;
      interstitial: { placementFallback: string; placements: Array<{ id: string }> };
      rewarded: { placementFallback: string; placements: Array<{ id: string }> };
    };
  };
  const ad = cfg.advertisement;
  const ids = (l: Array<{ id: string }>) => l.map((p) => p.id).sort().join();
  assert(ad.minimumDelayBetweenInterstitial === 120 && ad.interstitial.placementFallback === INTERSTITIAL_PLACEMENT && ad.rewarded.placementFallback === REWARDED_PLACEMENT && ids(ad.interstitial.placements) === [AD_PLACEMENT.levelCompleted, AD_PLACEMENT.businessDayEnd].sort().join() && ids(ad.rewarded.placements) === [AD_PLACEMENT.replayBonus, AD_PLACEMENT.rushRestock].sort().join(), "E6: Bridge config — 120 s minimum between interstitials, every ad spot listed as its own placement, fallbacks = the defaults");
}

// ===== F: production safety (source) =====
{
  const sdk = read("src/game/PlayablesSDK.ts");
  const bonus = read("src/game/ads/replayBonus.ts");
  const policy = read("src/game/ads/interstitialPolicy.ts");
  const app = read("src/App.tsx");
  const sheet = read("src/components/kc/ReplayBonusSheet.tsx");
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(![bonus, policy, sheet].some((s) => /setTimeout|setInterval|Math\.random/.test(code(s))) && !/Math\.random|setInterval|Promise\.race|withTimeout/.test(code(sdk)), "F: no timers, races or Math.random in the reward/policy/UI code (no timeout-as-success, no simulated completion)");
  const c = code(sdk);
  const guard = c.slice(c.indexOf("const guard = setTimeout("), c.indexOf("}, AD_UI_RELEASE_MS);"));
  const noStarts = [...c.matchAll(/const noStart = setTimeout\(\(\) => \{([\s\S]*?)\}, AD_START_TIMEOUT_MS\);/g)].map((m) => m[1]!);
  assert((c.match(/setTimeout\(/g) ?? []).length === 3 && !/rewarded|earned/.test(guard) && /setAdBlocking\(false\)/.test(guard) && noStarts.length === 2 && noStarts.every((b) => /if \(!started\)/.test(b) && !/status: "rewarded"|earned/.test(b)), "F1: timers only (a) lift the screen block after 120 s and (b) end an ad that NEVER started — neither can grant a reward");
  assert(/else if \(state === "rewarded"\) \{[\s\S]*?earned = true;/.test(c) && /finish\(earned \? \{ status: "rewarded" \} : \{ status: "not-rewarded" \}\)/.test(c), "F2: 'rewarded' only when Bridge reported the state `rewarded` (closing alone is never a reward)");
  const watch = app.slice(app.indexOf("async function watchReplayBonusAd"), app.indexOf("function finishCampaignLevel"));
  const iReq = watch.indexOf("await requestRewardedAd"), iGate = watch.indexOf('result.status !== "rewarded"'), iCommit = watch.indexOf("commitReplayBonus("), iVerify = watch.indexOf("verifyReplayBonusCommit("), iSave = watch.indexOf("await SaveManager.save(next)"), iRead = watch.indexOf("SaveManager.readPersisted()"), iSet = watch.indexOf("setSave(next)"), iDone = watch.indexOf('setReplayPhase("REWARD_COMMITTED")');
  assert(iReq > 0 && iReq < iGate && iGate < iCommit && iCommit < iVerify && iVerify < iSave && iSave < iRead && iRead < iSet && iSet < iDone, "F3: order is SDK result → gate on 'rewarded' → commit → verify → save → re-read persisted → update state → COMMITTED");
  assert(/replayBusyRef\.current\) return/.test(watch) && /const before = saveRef\.current/.test(watch), "F4: re-entry blocked by a ref (double tap), and the commit reads the post-ad authoritative save (no stale closure)");
  assert(/claimed=\{isReplayBonusClaimed\(save, replayOffer\.rewardId\)\}/.test(app) && /\{claimed \?/.test(sheet) && (code(sheet).match(/Reward Granted/g) ?? []).length === 1, "F5: 'Reward Granted' renders only when the ledger says the bonus is claimed (no adCompleted flag)");
  assert(!/credits\s*[+-]?=(?!=)/.test(code(watch)) && /appendLedgerEntry\(credited, "rewarded-ad"/.test(bonus), "F6: no direct wallet mutation — the credit and its 'rewarded-ad' ledger entry are built together");
  assert(JSON.stringify(Object.keys(DEFAULT_SAVE)) === JSON.stringify(["version", "credits", "equippedKnifeId", "equippedBoardId", "ownedKnifeIds", "ownedBoardIds", "ownedKitchenUpgradeIds", "equippedKitchenUpgradeId", "economy", "ownedKitchenInvestmentIds", "knifeSharpness", "knifeUpgrades", "ownedStaffIds", "selectedSupplierId", "economyLedger", "recipeProgress", "settings", "levelProgress", "story", "dailyOrder", "endless", "business"]), "F7: no new save field (claims and the daily cap live in the ledger)");
  const src = fs.readdirSync(path.resolve(ROOT, "src"), { recursive: true }) as string[];
  const fake = src.filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => /window\.bridge\s*=[^=]|window\.ytgame\s*=|rewardedVideo|simulateAd|fakeAd/i.test(read(path.join("src", f))));
  assert(fake.length === 0, `F8: no fake SDK / simulated ad anywhere in src${fake.length ? " — " + fake.join(", ") : ""}`);
  assert(!/maybeShowInterstitial/.test(read("src/components/kc/game/Preparation.tsx")) && (app.match(/maybeShowInterstitial\(/g) ?? []).length === 4, "F9: interstitials are requested only from the 4 transition handlers (never from gameplay/Preparation)");
  assert(/if \(isFinale\) return;/.test(app), "F10: nothing ad-related around the Campaign Finale");
  assert(/`business-day:\$\{[^`]*\}`,\s*[^,]+,\s*AD_PLACEMENT\.businessDayEnd,/.test(app) && /requestRewardedAd\(newRushRestockRewardId\(\), AD_PLACEMENT\.rushRestock\)/.test(app), "F11: the Business-day interstitial uses 'business_day_end' and Rush Restock uses 'rush_restock'");
}

// ===== G: real ad lengths + wake-after-ad (simulated clock) =====
{
  const { mock } = await import("node:test");
  const { AD_UI_RELEASE_MS, AD_START_TIMEOUT_MS, isAdRequestPending } = await import("../src/game/PlayablesSDK.ts");
  const { PauseManager } = await import("../src/game/PauseManager.ts");
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });

  let emit!: Emit;
  fake.rewarded = (e) => { emit = e; e("opened"); };
  const pending = requestRewardedAd("long-ad");
  mock.timers.tick(10_000); await flush();
  assert(isAdActive() && isAdRequestPending(), "G1: 10 s into a real-length rewarded ad nothing has timed out");
  mock.timers.tick(AD_UI_RELEASE_MS); await flush();
  const busyMeanwhile = await requestRewardedAd("second");
  assert(!isAdActive() && isAdRequestPending() && busyMeanwhile.status === "busy", "G2: after 120 s with no answer the SCREEN block lifts (no soft-lock), the rewarded request is still held and listened to");
  mock.timers.tick(20_000); await flush();
  emit("rewarded"); emit("closed"); await flush();
  assert((await pending).status === "rewarded" && !isAdRequestPending(), "G3: Bridge's `rewarded` at 150 s is still received → 'rewarded' (no timeout ever decides a reward)");

  fake.rewarded = () => {};
  const silent = requestRewardedAd("silent"); await flush();
  mock.timers.tick(AD_START_TIMEOUT_MS); await flush();
  assert((await silent).status === "failed" && !isAdActive() && !isAdRequestPending(), "G4: a rewarded ad that never starts ends as not shown after 30 s — no reward, nothing stuck");

  fake.interstitial = (e) => e("opened");
  void requestInterstitialAd(); await flush();
  mock.timers.tick(AD_UI_RELEASE_MS); await flush();
  fake.interstitial = (e) => { e("opened"); e("closed"); };
  const next = await requestInterstitialAd();
  assert(!isAdActive() && next === "requested", "G5: an interstitial that opened but never answers releases the screen AND the lock after 120 s");

  PauseManager.wireToPlatform();
  fake.rewarded = (e) => { emit = e; e("opened"); };
  const ad = requestRewardedAd("wake"); await flush();
  fire(EVENT_NAME.PAUSE_STATE_CHANGED, true);
  assert(PauseManager.isPaused(), "G6: the platform's pause at ad start pauses the game");
  emit("rewarded"); emit("closed"); await ad; await flush();
  assert(!PauseManager.isPaused(), "G7: ad ends with NO resume from the platform → the game wakes itself");
  PauseManager.pause();
  const ad2 = requestRewardedAd("own-pause"); await flush();
  fire(EVENT_NAME.PAUSE_STATE_CHANGED, true);
  emit("closed"); await ad2; await flush();
  assert(PauseManager.isPaused(), "G8: a pause the player made before the ad stays paused afterwards");
  PauseManager.resume();
  const ad3 = requestRewardedAd("normal"); await flush();
  fire(EVENT_NAME.PAUSE_STATE_CHANGED, true);
  fire(EVENT_NAME.PAUSE_STATE_CHANGED, false);
  emit("rewarded"); emit("closed"); await ad3; await flush();
  assert(!PauseManager.isPaused(), "G9: when the platform does resume, the game is simply running afterwards");
  mock.timers.reset();
}

// ===== H: level messages =====
{
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  fake.messages = [];
  levelPaused(); levelResumed(); levelCompleted(); await flush();
  assert(fake.messages.length === 0, "H1: nothing is sent outside a level");
  const where = { world: "chapter-2", level: "14" };
  levelStarted(where); levelPaused(); levelPaused(); levelResumed(); levelResumed(); levelCompleted(); levelCompleted(); await flush();
  const got = fake.messages.map(([m, o]) => `${m} ${JSON.stringify(o)}`);
  const w = JSON.stringify(where);
  assert(JSON.stringify(got) === JSON.stringify([`level_started ${w}`, `level_paused ${w}`, `level_resumed ${w}`, `level_completed ${w}`]), `H2: started → paused → resumed → completed, each once, with { world, level } (${got.join(" | ")})`);
  fake.messages = [];
  levelStarted({ world: "business", level: "7" }); levelAbandoned(); levelCompleted(); await flush();
  assert(fake.messages.length === 1 && fake.messages[0]![0] === "level_started", "H3: leaving a level unfinished sends no completion (KnifeCraft has no fail state)");
  const sdkApp = read("src/App.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  assert(/levelStarted\(where\)/.test(sdkApp) && /levelCompleted\(\);/.test(sdkApp) && /levelAbandoned\(\);/.test(sdkApp) && /bridge\.pauseGame\(\);\s*levelPaused\(\);/.test(prep) && /bridge\.resumeGame\(\);\s*levelResumed\(\);/.test(prep), "H4: wired — level start/complete in App's play sessions + Business orders, pause/resume from the in-game pause menu");
  const orig = bridge.platform.sendMessage;
  bridge.platform.sendMessage = () => { throw new Error("unsupported"); };
  let threw = false;
  try { levelStarted(where); levelCompleted(); await flush(); } catch { threw = true; }
  bridge.platform.sendMessage = orig;
  assert(!threw, "H5: a platform that rejects the message never breaks the game");
}

console.log(failures === 0 ? "\nPLAYGAMA ADS QA: ALL PASS" : `\nPLAYGAMA ADS QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
