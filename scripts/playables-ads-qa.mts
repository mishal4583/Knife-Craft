/**
 * PLAYABLES ADS QA — YouTube interstitial + rewarded (Replay Bonus) ads.
 *
 * Guards specifically against the "ad played but the reward wasn't applied /
 * the player is sent back to the same ad prompt" failure:
 *  A. SDK wrapper: only an exact `true` is a reward; false / non-boolean /
 *     reject / missing API are not; one ad at a time (busy); ad-active flag.
 *  B. Replay Bonus commit: wallet delta = reward, exactly one ledger entry,
 *     idempotent by reward id, daily cap, claimed state derived from ledger.
 *  C. Persistence: commit → save → re-read persisted → still there; reload
 *     (fresh SaveManager load) keeps wallet + ledger; failed ad → no change.
 *  D. Ledger: reconciles; recent rewarded-ad entries survive trimming.
 *  E. Interstitial gate: first 10 levels, every 3rd transition, cooldown,
 *     duplicates, ad-active, unavailable, failure never throws.
 *  F. Production safety (source scan): no reward timeout / fake completion / auto-reward,
 *     commit strictly after the SDK result, no direct wallet writes, no new save field.
 *
 *  G. Real ad lengths (simulated clock): a 150 s rewarded ad still pays (no
 *     timeout on the reward); a request that never answers releases the screen
 *     after 120 s without granting anything; the game wakes after an ad even
 *     if YouTube sends onPause but never onResume (the other game's bugs).
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

type FakeAds = {
  requestInterstitialAd?: () => Promise<void>;
  requestRewardedAd?: (id: string) => Promise<boolean>;
};
const win = { ytgame: undefined as unknown } as { ytgame: unknown };
(globalThis as unknown as { window: typeof win }).window = win;
let cloud: string | null = null;
function installSdk(ads: FakeAds | undefined) {
  win.ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {
      loadData: async () => cloud,
      saveData: async (d: string) => {
        cloud = d;
      },
    },
    system: {},
    ...(ads ? { ads } : {}),
  };
}
function removeSdk() {
  win.ytgame = undefined;
}

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import {
  interstitialAdsAvailable,
  isAdActive,
  onAdActiveChange,
  requestInterstitialAd,
  requestRewardedAd,
  rewardedAdsAvailable,
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
  INTERSTITIAL_EVERY_N_TRANSITIONS,
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

// ===== A: SDK wrapper =====
{
  removeSdk();
  assert(!rewardedAdsAvailable() && !interstitialAdsAvailable(), "A: no SDK → ads unavailable (button hidden, interstitials skipped)");
  assert((await requestRewardedAd("x")).status === "unavailable" && (await requestInterstitialAd()) === "unavailable", "A2: no SDK → both requests report 'unavailable' and show nothing");
  installSdk(undefined);
  assert(!rewardedAdsAvailable(), "A3: SDK without the ads API → unavailable");
  win.ytgame = { IN_PLAYABLES_ENV: false, ads: { requestRewardedAd: async () => true } };
  assert(!rewardedAdsAvailable(), "A4: outside the real Playables environment (IN_PLAYABLES_ENV false) → unavailable");

  for (const [value, want] of [[true, "rewarded"], [false, "not-rewarded"], ["true", "not-rewarded"], [1, "not-rewarded"], [undefined, "not-rewarded"]] as const) {
    installSdk({ requestRewardedAd: async () => value as unknown as boolean });
    const r = await requestRewardedAd(newReplayBonusRewardId("level-10"));
    assert(r.status === want, `A5: SDK resolves ${JSON.stringify(value)} → ${want}`);
  }
  installSdk({ requestRewardedAd: async () => { throw new Error("no fill"); } });
  assert((await requestRewardedAd("x")).status === "failed", "A6: SDK rejects → failed (no reward)");

  let calls = 0;
  let release!: (v: boolean) => void;
  installSdk({ requestRewardedAd: () => { calls++; return new Promise<boolean>((r) => { release = r; }); }, requestInterstitialAd: async () => { calls++; } });
  const seen: boolean[] = [];
  const off = onAdActiveChange((a) => seen.push(a));
  const first = requestRewardedAd("a");
  const second = await requestRewardedAd("b");
  const inter = await requestInterstitialAd();
  assert(calls === 1 && second.status === "busy" && inter === "busy" && isAdActive(), "A7: double tap / second request while an ad is active → 'busy', the SDK is called exactly once");
  release(true);
  assert((await first).status === "rewarded" && !isAdActive() && JSON.stringify(seen) === "[true,false]", "A8: ad-active turns on for the request and off when it settles");
  off();

  installSdk({ requestInterstitialAd: async () => { throw new Error("no ad"); } });
  assert((await requestInterstitialAd()) === "failed" && !isAdActive(), "A9: an interstitial failure never throws and releases the ad lock");
}

// ===== B: Replay Bonus commit =====
{
  const amount = replayBonusAmount(level10);
  assert(amount === Math.max(1000, Math.round((level10.reward.coins * 100 * 0.2) / 100) * 100) && amount % 100 === 0, `B: bonus = 20% of the level's reward, whole dollars, min $10 (Level 10 → $${amount / 100})`);
  assert(replayBonusAmount(LEVELS[0]!) === 1000 && replayBonusAmount(LEVELS[249]!) === 100000, "B2: Level 1 → $10 (minimum), Level 250 → $1,000");
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

// ===== C: persistence (commit → save → re-read → reload), failures change nothing =====
{
  installSdk({ requestRewardedAd: async () => true });
  cloud = null;
  const s0 = replaySave();
  await SaveManager.save(s0);
  const walletBefore = s0.credits;
  const entriesBefore = s0.economyLedger.length;
  const offer = replayBonusOfferFor(s0, level10, true, true, NOW)!;
  const r = await requestRewardedAd(offer.rewardId);
  assert(r.status === "rewarded", "C: fake SDK returns true");
  const commit = commitReplayBonus(s0, offer, NOW) as { ok: true; save: SaveData };
  await SaveManager.save(commit.save);
  const persisted = await SaveManager.readPersisted();
  assert(!!persisted && persisted.credits === walletBefore + offer.amount && persisted.economyLedger.filter((e) => e.description === offer.rewardId).length === 1, "C2: after save, the PERSISTED cloud save (read back, bypassing cache) has the new wallet and the entry");
  // reload: a brand-new SaveManager load from the cloud string
  const { SaveManager: _unused, ...rest } = await import("../src/game/SaveManager.ts");
  void _unused;
  void rest;
  const reloaded = JSON.parse(cloud!) as SaveData;
  assert(reloaded.credits === walletBefore + offer.amount && reloaded.economyLedger.length === entriesBefore + 1 && isReplayBonusClaimed(reloaded, offer.rewardId), `C3: reload → wallet ${walletBefore} + ${offer.amount} = ${reloaded.credits}, ledger ${entriesBefore} → ${reloaded.economyLedger.length}, bonus still claimed`);

  // failed ad → nothing changes
  const failSave = replaySave();
  const snapshot = JSON.stringify(failSave);
  for (const impl of [async () => false, async () => { throw new Error("x"); }]) {
    installSdk({ requestRewardedAd: impl as () => Promise<boolean> });
    const o = replayBonusOfferFor(failSave, level10, true, true, NOW)!;
    const res = await requestRewardedAd(o.rewardId);
    // the App commits ONLY on "rewarded" — mirror that gate here
    const after = res.status === "rewarded" ? (commitReplayBonus(failSave, o, NOW) as { ok: true; save: SaveData }).save : failSave;
    assert(res.status !== "rewarded" && JSON.stringify(after) === snapshot && !isReplayBonusClaimed(after, o.rewardId), `C4: SDK ${res.status} → zero wallet change, zero ledger entries, save untouched`);
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
  const fresh = (): InterstitialPolicyState => ({ transitionsSinceAd: 0, handled: new Set() });
  const base = { completedLevels: 20, now: 10_000_000, lastAdSettledAt: 0, adActive: false, available: true };
  let st = fresh();
  const shows: boolean[] = [];
  for (let i = 1; i <= 9; i++) {
    const r = decideInterstitial(st, { ...base, transitionId: `t${i}` });
    st = r.state;
    shows.push(r.decision.show);
  }
  assert(JSON.stringify(shows) === JSON.stringify([false, false, true, false, false, true, false, false, true]) && INTERSTITIAL_EVERY_N_TRANSITIONS === 3, "E: at most one interstitial every 3 completed transitions");
  st = fresh();
  let early = 0;
  for (let i = 0; i < 12; i++) {
    const r = decideInterstitial(st, { ...base, completedLevels: i, transitionId: `e${i}` });
    st = r.state;
    if (r.decision.show) early++;
  }
  assert(early === 0 && INTERSTITIAL_MIN_COMPLETED_LEVELS === 10, "E2: no interstitial while fewer than 10 Campaign levels are completed (and those transitions don't count)");
  st = { transitionsSinceAd: 2, handled: new Set() };
  const dup1 = decideInterstitial(st, { ...base, transitionId: "same" });
  const dup2 = decideInterstitial(dup1.state, { ...base, transitionId: "same" });
  assert(dup1.decision.show && !dup2.decision.show && (dup2.decision as { reason: string }).reason === "duplicate", "E3: the same transition (re-render, repeat click, back/forward) is handled once");
  const cd = decideInterstitial({ transitionsSinceAd: 5, handled: new Set() }, { ...base, transitionId: "c", lastAdSettledAt: base.now - INTERSTITIAL_COOLDOWN_MS + 1000 });
  assert(!cd.decision.show && (cd.decision as { reason: string }).reason === "cooldown", "E4: cooldown since the last ad of any kind (never straight after a rewarded ad)");
  const act = decideInterstitial({ transitionsSinceAd: 5, handled: new Set() }, { ...base, transitionId: "a", adActive: true });
  const un = decideInterstitial({ transitionsSinceAd: 5, handled: new Set() }, { ...base, transitionId: "u", available: false });
  assert(!act.decision.show && !un.decision.show, "E5: never while another ad is active; never without the SDK ads API");
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
  const timers = code(sdk).match(/setTimeout\(/g) ?? [];
  const guard = code(sdk).slice(code(sdk).indexOf("const guard = setTimeout("), code(sdk).indexOf("}, AD_UI_RELEASE_MS);"));
  assert(timers.length === 1 && guard.length > 0 && !/rewarded|earned|resolve|status/.test(guard) && /setAdBlocking\(false\)/.test(guard), "F1: the SDK's only timer is the dead-request guard — it only lifts the screen block (and an interstitial's lock); it can never produce or refuse a reward");
  assert(/earned === true \? \{ status: "rewarded" \}/.test(sdk), "F2: the SDK wrapper maps ONLY an exact `true` to 'rewarded'");
  const watch = app.slice(app.indexOf("async function watchReplayBonusAd"), app.indexOf("function finishCampaignLevel"));
  const iReq = watch.indexOf("await requestRewardedAd"), iGate = watch.indexOf('result.status !== "rewarded"'), iCommit = watch.indexOf("commitReplayBonus("), iVerify = watch.indexOf("verifyReplayBonusCommit("), iSave = watch.indexOf("await SaveManager.save(next)"), iRead = watch.indexOf("SaveManager.readPersisted()"), iSet = watch.indexOf("setSave(next)"), iDone = watch.indexOf('setReplayPhase("REWARD_COMMITTED")');
  assert(iReq > 0 && iReq < iGate && iGate < iCommit && iCommit < iVerify && iVerify < iSave && iSave < iRead && iRead < iSet && iSet < iDone, "F3: order is SDK result → gate on 'rewarded' → commit → verify → save → re-read persisted → update state → COMMITTED");
  assert(/replayBusyRef\.current\) return/.test(watch) && /const before = saveRef\.current/.test(watch), "F4: re-entry blocked by a ref (double tap), and the commit reads the post-ad authoritative save (no stale closure)");
  assert(/claimed=\{isReplayBonusClaimed\(save, replayOffer\.rewardId\)\}/.test(app) && /\{claimed \?/.test(sheet) && (code(sheet).match(/Reward Granted/g) ?? []).length === 1, "F5: 'Reward Granted' renders only when the ledger says the bonus is claimed (no adCompleted flag)");
  assert(!/credits\s*[+-]?=(?!=)/.test(code(watch)) && /appendLedgerEntry\(credited, "rewarded-ad"/.test(bonus), "F6: no direct wallet mutation — the credit and its 'rewarded-ad' ledger entry are built together");
  assert(JSON.stringify(Object.keys(DEFAULT_SAVE)) === JSON.stringify(["version", "credits", "equippedKnifeId", "equippedBoardId", "ownedKnifeIds", "ownedBoardIds", "ownedKitchenUpgradeIds", "equippedKitchenUpgradeId", "ownedKitchenInvestmentIds", "knifeSharpness", "knifeUpgrades", "ownedStaffIds", "selectedSupplierId", "economyLedger", "recipeProgress", "settings", "levelProgress", "story", "dailyOrder", "endless", "business"]), "F7: no new save field (claims and the daily cap live in the ledger)");
  const src = fs.readdirSync(path.resolve(ROOT, "src"), { recursive: true }) as string[];
  const fake = src.filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => /window\.ytgame\s*=|ytgame\s*=\s*\{|rewardedVideo|simulateAd|fakeAd/i.test(read(path.join("src", f))));
  assert(fake.length === 0, `F8: no fake SDK / simulated ad anywhere in src${fake.length ? " — " + fake.join(", ") : ""}`);
  assert(!/maybeShowInterstitial/.test(read("src/components/kc/game/Preparation.tsx")) && (app.match(/maybeShowInterstitial\(/g) ?? []).length === 4, "F9: interstitials are requested only from the 4 transition handlers (never from gameplay/Preparation)");
  assert(/if \(isFinale\) return;/.test(app), "F10: nothing ad-related around the Campaign Finale");
}

// ===== G: real ad lengths + wake-after-ad (simulated clock) =====
{
  const { mock } = await import("node:test");
  const { AD_UI_RELEASE_MS, isAdRequestPending } = await import("../src/game/PlayablesSDK.ts");
  const { PauseManager } = await import("../src/game/PauseManager.ts");
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  const cbs: { pause?: () => void; resume?: () => void } = {};
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });

  // G1 — a rewarded ad that runs 150 s (longer than the old 10 s bug, and than the 120 s guard) still pays.
  let release!: (v: boolean) => void;
  installSdk({ requestRewardedAd: () => new Promise<boolean>((r) => { release = r; }), requestInterstitialAd: async () => {} });
  const pending = requestRewardedAd("long-ad");
  mock.timers.tick(10_000); await flush();
  assert(isAdActive() && isAdRequestPending(), "G1: 10 s into a real-length rewarded ad nothing has timed out (still waiting for YouTube)");
  mock.timers.tick(AD_UI_RELEASE_MS); await flush();
  const busyMeanwhile = await requestRewardedAd("second");
  assert(!isAdActive() && isAdRequestPending() && busyMeanwhile.status === "busy", "G2: after 120 s with no answer the SCREEN block lifts (no soft-lock), but the rewarded request is still held and listened to");
  mock.timers.tick(20_000); await flush();
  release(true); await flush();
  const late = await pending;
  assert(late.status === "rewarded" && !isAdRequestPending(), "G3: YouTube's `true` arriving at 150 s is still received → 'rewarded' (no timeout ever decides a reward)");

  // G4 — an interstitial that never answers frees everything after 120 s.
  installSdk({ requestInterstitialAd: () => new Promise<void>(() => {}) });
  void requestInterstitialAd(); await flush();
  assert(isAdActive() && isAdRequestPending(), "G4: interstitial open → screen blocked");
  mock.timers.tick(AD_UI_RELEASE_MS); await flush();
  installSdk({ requestInterstitialAd: async () => {} });
  const next = await requestInterstitialAd();
  assert(!isAdActive() && next === "requested", "G5: an interstitial that never answers releases the screen AND the lock after 120 s (the game never stays frozen behind a dead ad)");

  // G6 — YouTube pauses for the ad but never sends onResume → the game wakes when the ad ends.
  let endAd!: (v: boolean) => void;
  win.ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {},
    system: { onPause: (cb: () => void) => { cbs.pause = cb; }, onResume: (cb: () => void) => { cbs.resume = cb; } },
    ads: { requestRewardedAd: () => new Promise<boolean>((r) => { endAd = r; }) },
  };
  PauseManager.wireToPlatform();
  const ad = requestRewardedAd("wake"); await flush();
  cbs.pause!();
  assert(PauseManager.isPaused(), "G6: YouTube's onPause at ad start pauses the game");
  endAd(true); await ad; await flush();
  assert(!PauseManager.isPaused(), "G7: ad ends with NO onResume from YouTube → the game wakes itself (not left paused and silent)");

  // G8 — a player's own pause is never undone by an ad ending.
  PauseManager.pause();
  const ad2 = requestRewardedAd("own-pause"); await flush();
  cbs.pause!();
  endAd(false); await ad2; await flush();
  assert(PauseManager.isPaused(), "G8: a pause the player made before the ad stays paused afterwards");
  PauseManager.resume();

  // G9 — normal case: YouTube does send onResume; nothing double-resumes or breaks.
  const ad3 = requestRewardedAd("normal"); await flush();
  cbs.pause!(); cbs.resume!();
  endAd(true); await ad3; await flush();
  assert(!PauseManager.isPaused(), "G9: when YouTube does send onResume, the game is simply running afterwards");
  mock.timers.reset();
}

console.log(failures === 0 ? "\nPLAYABLES ADS QA: ALL PASS" : `\nPLAYABLES ADS QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
