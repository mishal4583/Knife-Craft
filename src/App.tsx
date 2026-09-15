import { Suspense, lazy, useEffect, useState } from "react";
import { Preparation } from "@/components/kc/game/Preparation";
import { GameShell } from "@/components/kc/game/GameShell";
import { type ScreenId } from "@/components/kc/data";
import { SaveManager, type SaveData } from "@/game/SaveManager";
import { PauseManager } from "@/game/PauseManager";
import { AudioManager } from "@/game/AudioManager";
import { getLevel, completeLevel, selectLevel, isUnlocked } from "@/game/levels/LevelManager";
import { LEVELS } from "@/game/levels/levelDefinitions";
import { knifeOrDefault } from "@/game/knives/knifeDefinitions";
import { buyKnife as buyKnifeFromCatalog, equipKnife } from "@/game/knives/KnifeManager";
import { boardOrDefault } from "@/game/boards/boardDefinitions";
import { buyBoard as buyBoardFromCatalog, equipBoard } from "@/game/boards/BoardManager";
import {
  syncKitchenUpgradeOwnership,
  equipKitchenUpgrade,
} from "@/game/kitchen/KitchenUpgradeManager";
import {
  shouldRunIntro,
  markIntroDone,
  checkStoryFlush,
  applyFinaleSeen,
  applyMilestoneFired,
  type StoryFlushResult,
} from "@/game/story/StoryManager";
import { OPENING, FRESH, CHEF, FINALE } from "@/game/story/storyDefinitions";
import { StoryOverlay } from "@/components/kc/story/StoryOverlay";
import { MilestoneBanner } from "@/components/kc/story/MilestoneBanner";
import {
  pickDailyLevel,
  hasClaimedToday,
  claimDaily,
  DAILY_ORDER_BONUS_COINS,
} from "@/game/daily/DailyOrderManager";
import { pickEndlessLevel, applyEndlessEarn } from "@/game/daily/EndlessServiceManager";

const STORY_INTRO_SEQUENCE = [...OPENING, ...FRESH, ...CHEF];

// Split away from the initial bundle — Preparation (and the Phaser it
// pulls in) is needed immediately since Prep is the first screen, but
// Kitchen/Workshop/Recipes/... aren't needed until the player navigates
// there (§31).
const ScreensRouter = lazy(() =>
  import("./ScreensRouter").then((m) => ({ default: m.ScreensRouter })),
);

function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,var(--color-ivory),var(--color-cream))]">
      <p className="font-hand text-[26px] text-walnut/70">warming the kitchen…</p>
    </div>
  );
}

export function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  // "kitchen" is a safe placeholder only — the `!save` loading gate below
  // always renders LoadingScreen until the save has actually resolved, so
  // this initial value is never shown. The real choice (fresh save →
  // straight into Level 1; existing save → Kitchen) is made once
  // SaveManager.load() resolves, see the effect below (Phase 12C — was
  // hardcoded to "gameplay", which force-launched Preparation with
  // Level 1 on every load/refresh regardless of saved progress).
  const [screen, setScreen] = useState<ScreenId>("kitchen");
  const [recipeDetailLevelId, setRecipeDetailLevelId] = useState<string>(LEVELS[0]!.id);
  const [activeLevelId, setActiveLevelId] = useState(LEVELS[0]!.id);
  const activeLevel = getLevel(activeLevelId) ?? LEVELS[0]!;
  // Corrective pass — Daily Order / Endless Service both replay an
  // EXISTING campaign level through this exact same Preparation flow;
  // `sessionMode` only decides which onComplete/onExit/next-level
  // behavior applies once that session finishes (see recordDailyResult/
  // recordEndlessResult below), never a different gameplay path.
  // `endlessIndex` is deliberately NOT persisted — losing your place in
  // an endless rotation on reload is harmless (Law: "no FOMO"), and not
  // persisting it keeps this a pure, ephemeral UI cursor.
  const [sessionMode, setSessionMode] = useState<"campaign" | "daily" | "endless">("campaign");
  const [endlessIndex, setEndlessIndex] = useState(0);

  // THE LAST WISH (Claude Design final freeze) — presentation layer only,
  // additive to everything above. `showIntro` plays once, only for a
  // genuinely new player (see the load effect below); `storyEvent` is
  // whichever of {finale, milestone} last fired, shown as an overlay/
  // banner on top of whatever screen is already active — it never
  // changes `screen` itself, matching the source's own "the story reads
  // the existing plate counter and reinterprets it; it never advances
  // progression itself."
  const [showIntro, setShowIntro] = useState(false);
  const [storyEvent, setStoryEvent] = useState<StoryFlushResult>(null);

  // Load the save once and wire the platform pause source (§23 —
  // YouTube's onPause/onResume is the sole authority). gameReady() is
  // NOT called here — loading the save file isn't "the game is
  // interactive". Preparation calls it once Phaser's scene actually
  // finishes booting (see its SCENE_READY handler).
  useEffect(() => {
    PauseManager.wireToPlatform();
    void SaveManager.load().then((loaded) => {
      AudioManager.setUserSoundEnabled(loaded.settings.sound);
      // Phase 12C — only a genuinely untouched, never-played save (the
      // exact DEFAULT_LEVEL_PROGRESS shape) auto-opens Preparation on
      // Level 1, matching a first-ever launch. Any save that has
      // completed a level, or even just moved its "current" cursor past
      // Level 1 (e.g. by opening the level board), is treated as a
      // returning player and lands on Kitchen instead — restarting the
      // app must never re-launch a prep session the player didn't ask
      // for. Replaying Level 1 explicitly (Today's Order / level board)
      // still works exactly as before via onSelectLevel.
      const isFreshSave =
        loaded.levelProgress.completedLevelIds.length === 0 &&
        loaded.levelProgress.currentLevelId === LEVELS[0]!.id;
      setScreen(isFreshSave ? "gameplay" : "kitchen");
      setActiveLevelId(loaded.levelProgress.currentLevelId);
      // Kitchen-upgrade ownership is a deterministic function of level
      // progress (Phase 14), never a one-time purchase — re-derive it on
      // every load so a save that reached a new tier's level in a prior
      // session (or was seeded/edited directly) is always correct, not
      // just saves that happened to visit the Kitchen Upgrades screen.
      let synced = syncKitchenUpgradeOwnership(loaded);
      // THE LAST WISH's intro (ported from boot()) is a "how you got
      // here" origin scene — only a genuinely brand-new player should
      // ever see it. Every save that predates this feature also has
      // `story.introDone === false` by default, but a returning player
      // with existing progress must never have it retroactively sprung
      // on them; mark it silently done instead, once, and let the
      // milestone/finale catch-up (checkStoryFlush, on their next level
      // completion) surface their real accumulated progress instead —
      // that catch-up IS the source's own documented forward-only
      // behavior, not a special case invented here.
      if (shouldRunIntro(synced)) {
        if (isFreshSave) setShowIntro(true);
        else synced = markIntroDone(synced);
      }
      if (synced !== loaded) void SaveManager.save(synced);
      setSave(synced);
    });
  }, []);

  const go = (s: ScreenId) => setScreen(s);

  /** The single place every save mutation flows through — also where
   * kitchen-upgrade ownership gets re-derived from level progress, so
   * crossing a new tier's unlock level (e.g. via recordPreparationResult)
   * grants that tier immediately, live, with no separate purchase step. */
  function persist(next: SaveData) {
    const synced = syncKitchenUpgradeOwnership(next);
    setSave(synced);
    void SaveManager.save(synced);
  }

  /** Rack action (Phase 15) — routes through KnifeManager.equipKnife itself rather than an inline persist, so "owned" is checked in one place, not duplicated. */
  function setEquippedKnife(id: string) {
    if (!save) return;
    const result = equipKnife(save, id);
    if (result.ok) persist(result.save);
  }

  /** Shop action — deliberately never auto-equips (§"prefer BUY then EQUIP separately, player control"). Returns the KnifeManager result so Shop can show a warm, specific message on failure. */
  function buyKnife(id: string) {
    if (!save) return { ok: false as const, reason: "unknownKnife" as const };
    const result = buyKnifeFromCatalog(save, id);
    if (result.ok) persist(result.save);
    return result;
  }

  /** Rack action — routes through BoardManager.equipBoard, mirroring setEquippedKnife. */
  function setEquippedBoard(id: string) {
    if (!save) return;
    const result = equipBoard(id, save);
    if (result.ok) persist(result.save);
  }

  /** Shop action — deliberately never auto-equips, mirroring buyKnife. */
  function buyBoard(id: string) {
    if (!save) return { ok: false as const, reason: "unknownBoard" as const };
    const result = buyBoardFromCatalog(id, save);
    if (result.ok) persist(result.save);
    return result;
  }

  /** Kitchen Upgrade action — routes through KitchenUpgradeManager.equipKitchenUpgrade, mirroring setEquippedKnife/setEquippedBoard. */
  function setEquippedKitchenUpgrade(id: string) {
    if (!save) return;
    const result = equipKitchenUpgrade(id, save);
    if (result.ok) persist(result.save);
  }

  function toggleSetting(key: "sound" | "music" | "reducedMotion") {
    if (!save) return;
    const settings = { ...save.settings, [key]: !save.settings[key] };
    if (key === "sound") AudioManager.setUserSoundEnabled(settings.sound);
    persist({ ...save, settings });
  }

  async function resetProgress() {
    const fresh = await SaveManager.reset();
    setActiveLevelId(LEVELS[0]!.id);
    setSave(fresh);
  }

  /** Kitchen's "Today's Board" picks a level, not a raw recipe (§9.2 — same Preparation flow, different data). */
  function onSelectLevel(levelId: string) {
    setSessionMode("campaign");
    setActiveLevelId(levelId);
    if (save) persist({ ...save, levelProgress: selectLevel(levelId, save.levelProgress) });
  }

  /** Daily Order's "Accept Order" — selects today's featured level (already unlocked, see DailyOrderManager) and starts it in `daily` mode, WITHOUT touching `levelProgress.currentLevelId` (this isn't a campaign navigation, the level's own campaign position is unaffected). */
  function startDaily() {
    if (!save) return;
    const level = pickDailyLevel(save.levelProgress, new Date());
    setSessionMode("daily");
    setActiveLevelId(level.id);
    setScreen("gameplay");
  }

  /** Endless Service's own "Prepare" — same idea as startDaily, drawing from the rotating SERVICE-type pool instead of one daily pick. No-ops (screen stays put) if the pool is empty — the screen itself explains why rather than silently doing nothing. */
  function startEndless() {
    if (!save) return;
    const level = pickEndlessLevel(save.levelProgress, endlessIndex);
    if (!level) return;
    setSessionMode("endless");
    setActiveLevelId(level.id);
    setScreen("gameplay");
  }

  /** Returns this run's coin reward (0 on replay) — Preparation shows it directly on OrderComplete rather than waiting a round trip through props. */
  function recordPreparationResult(score: number): number {
    if (!save) return 0;
    // Mastery tracking (best score, "done" flag) updates on every
    // completion, replay included — Law 2 only withholds the COIN
    // reward and level progression on replay, never the ability to
    // improve your own best (design doc §2 "replay exists for... personal
    // mastery"). Phase 5 keys this by the level's own id/recipeId
    // directly (the level IS the gameplay source of truth now — no
    // PrepOrder lookup in between, see Preparation.tsx).
    const recipeId = activeLevel.recipeId;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };

    // Level completion/reward/unlock IS gated by first-completion (Law 2 —
    // "replay does not pay").
    const { progress: levelProgress, rewardCoins } = completeLevel(
      activeLevel.id,
      save.levelProgress,
    );
    const nextSave = {
      ...save,
      credits: save.credits + rewardCoins,
      recipeProgress,
      levelProgress,
    };
    // THE LAST WISH's milestone/finale gate — ported from flush(),
    // called "after a plate is put away", reading the counter this
    // completion just advanced and nothing else. Only one event can be
    // pending at a time (matching the source's own "one banner per
    // flush"); it's shown as an overlay/banner over whatever screen
    // comes next, not injected into Preparation's own OrderComplete UI.
    // Folded into ONE merged save object + ONE persist() call (rather
    // than persisting `nextSave` and then persisting the story-flagged
    // version right after) — two back-to-back persists raced on the
    // YouTube Cloud Save path (two overlapping, unordered `await
    // saveCloudSave()` calls), risking the story flag being silently
    // clobbered by whichever write happened to land last.
    const flush = checkStoryFlush(nextSave);
    const finalSave = flush
      ? flush.kind === "finale"
        ? applyFinaleSeen(nextSave)
        : applyMilestoneFired(nextSave, flush.milestone)
      : nextSave;
    persist(finalSave);
    if (flush) setStoryEvent(flush);
    return rewardCoins;
  }

  /**
   * Daily Order's own completion handler — updates mastery tracking
   * exactly like a normal replay (best/done, never gated), then pays the
   * flat once-per-day bonus IF today's hasn't already been claimed.
   * Deliberately does NOT call completeLevel/campaign unlock logic: a
   * Daily Order session never advances or grants campaign progression,
   * it only replays something already unlocked (Section 8's "should not
   * invalidate normal campaign progression").
   */
  function recordDailyResult(score: number): number {
    if (!save) return 0;
    const recipeId = activeLevel.recipeId;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };
    const now = new Date();
    const alreadyClaimed = hasClaimedToday(save.dailyOrder, now);
    const bonus = alreadyClaimed ? 0 : DAILY_ORDER_BONUS_COINS;
    const dailyOrder = alreadyClaimed ? save.dailyOrder : claimDaily(save.dailyOrder, now);
    persist({ ...save, recipeProgress, dailyOrder, credits: save.credits + bonus });
    return bonus;
  }

  /**
   * Endless Service's own completion handler — same mastery-tracking
   * shape as the others, but pays coins via applyEndlessEarn (clamped to
   * whatever headroom remains under today's cap, see
   * EndlessServiceManager's own doc for the economy rule this enforces),
   * then advances the rotation cursor so the NEXT "Prepare" pulls the
   * next level in the pool rather than repeating this one immediately.
   */
  function recordEndlessResult(score: number): number {
    if (!save) return 0;
    const recipeId = activeLevel.recipeId;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };
    const { earned, endless } = applyEndlessEarn(
      save.endless,
      activeLevel.reward.coins,
      new Date(),
    );
    persist({ ...save, recipeProgress, endless, credits: save.credits + earned });
    setEndlessIndex((i) => i + 1);
    return earned;
  }

  if (!save) {
    return (
      <GameShell>
        <LoadingScreen />
      </GameShell>
    );
  }

  const equippedKnife = knifeOrDefault(save.equippedKnifeId);
  const equippedBoard = boardOrDefault(save.equippedBoardId);
  const previousBest = save.recipeProgress[activeLevel.recipeId]?.best ?? 0;
  // Progression pass — "Next Level" on the result screen. LEVELS is
  // already campaign-ordered (LevelManager/OrderBoard both iterate it
  // directly), so the next entry after the active one IS the next
  // campaign level; only offered once it's actually unlocked (never
  // skips ahead of what completing THIS level just unlocked, and never
  // dangles a locked level in front of the player).
  // "Next Level" only ever makes sense for an ordinary campaign session —
  // a Daily Order/Endless Service run isn't campaign navigation, so it
  // offers no next-level button at all (see their own onExit below).
  const activeLevelIndex = LEVELS.findIndex((l) => l.id === activeLevel.id);
  const nextCampaignLevel = LEVELS[activeLevelIndex + 1] ?? null;
  const nextLevel =
    sessionMode === "campaign" &&
    nextCampaignLevel &&
    isUnlocked(nextCampaignLevel, save.levelProgress)
      ? nextCampaignLevel
      : null;
  const sessionOnComplete =
    sessionMode === "daily"
      ? recordDailyResult
      : sessionMode === "endless"
        ? recordEndlessResult
        : recordPreparationResult;
  const sessionExitScreen: ScreenId =
    sessionMode === "daily" ? "daily" : sessionMode === "endless" ? "endless" : "kitchen";

  return (
    <GameShell
      aside={
        <div className="hidden max-w-[260px] text-right md:block">
          <p className="font-hand text-[26px] leading-tight text-[color:var(--color-gold)]">
            KnifeCraft
          </p>
          <p className="mt-2 font-ui text-[12px] leading-relaxed text-[color:var(--color-cream)]/60">
            A cozy prep-chef arcade for YouTube Playables. Portrait-first, one thumb, no timers.
            Swipe across the tomato to begin.
          </p>
        </div>
      }
    >
      {screen === "gameplay" ? (
        <Preparation
          // Remounts Preparation whenever the active level actually
          // changes — including "Next Level" jumping straight from one
          // level's result screen into the next without a Kitchen visit
          // in between, which needs Preparation's internal phase/step
          // state to start completely fresh (its own effect only ever
          // runs once per mount, by design — see its own "level/knife/
          // board are fixed for this preparation run" comment).
          key={activeLevel.id}
          level={activeLevel}
          onExit={() => {
            setSessionMode("campaign");
            go(sessionExitScreen);
          }}
          onComplete={sessionOnComplete}
          credits={save.credits}
          previousBest={previousBest}
          knife={equippedKnife}
          board={equippedBoard}
          {...(nextLevel ? { nextLevel, onNextLevel: () => onSelectLevel(nextLevel.id) } : {})}
        />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <ScreensRouter
            screen={screen}
            go={go}
            save={save}
            recipeDetailLevelId={recipeDetailLevelId}
            onOpenRecipe={(levelId) => {
              setRecipeDetailLevelId(levelId);
              setScreen("recipe-detail");
            }}
            onSelectLevel={onSelectLevel}
            onStartDaily={startDaily}
            onStartEndless={startEndless}
            buyKnife={buyKnife}
            buyBoard={buyBoard}
            setEquippedKnife={setEquippedKnife}
            setEquippedBoard={setEquippedBoard}
            setEquippedKitchenUpgrade={setEquippedKitchenUpgrade}
            toggleSetting={toggleSetting}
            resetProgress={resetProgress}
          />
        </Suspense>
      )}
      {showIntro ? (
        <StoryOverlay
          sequence={STORY_INTRO_SEQUENCE}
          onDone={() => {
            setShowIntro(false);
            persist(markIntroDone(save));
          }}
        />
      ) : null}
      {storyEvent?.kind === "finale" ? (
        <StoryOverlay sequence={FINALE} onDone={() => setStoryEvent(null)} />
      ) : null}
      {storyEvent?.kind === "milestone" ? (
        <MilestoneBanner
          kicker={storyEvent.milestone.kicker}
          line={storyEvent.milestone.line}
          onDismiss={() => setStoryEvent(null)}
        />
      ) : null}
    </GameShell>
  );
}
