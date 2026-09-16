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
import {
  createServiceSession,
  recordAllComponents,
  serveCurrentOrder,
  advanceServiceSession,
  poolUnlockedByLevel,
  batchHintFor,
  createBatchGroupSession,
  recordBatchGroupComponents,
  serveBatchGroupOrder,
  isBatchGroupComplete,
  currentBatchOrder,
  nextBatchOrder,
  batchHintForGroup,
  type ServiceSession,
  type BatchGroupSession,
} from "@/game/service/ServiceManager";
import { TEST_RECIPE_POOL } from "@/game/service/testRecipePool";
import { getCampaignRecipe } from "@/game/recipes/campaignRecipes";
import type { RecipeDefinition } from "@/game/recipes/recipeTypes";
import type { LevelDefinition } from "@/game/levels/levelTypes";

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
  const [sessionMode, setSessionMode] = useState<
    "campaign" | "daily" | "endless" | "service" | "campaign-service" | "batch-group"
  >("campaign");
  const [endlessIndex, setEndlessIndex] = useState(0);

  // Phase 2 (restaurant-service loop) — a ServiceSession is deliberately
  // plain React state, never SaveData (§33/§40: "service order state
  // should generally be session/transient... do not persist transient
  // session state unless absolutely necessary"). It survives leaving
  // Preparation ("Back to Kitchen" mid-order resumes the same queue on
  // the next "Start Service") but is lost on reload, same as
  // `endlessIndex` already is.
  const [serviceSession, setServiceSession] = useState<ServiceSession | null>(null);

  // Phase 3 — a SEPARATE ServiceSession for campaign Levels 1-40's own
  // "Level -> ServiceProfile -> RecipePool" pipeline (brief §3/§35/§36),
  // kept apart from the Phase 2 standalone Restaurant Service harness's
  // `serviceSession` above: a campaign session additionally tracks how
  // many orders the ACTIVE LEVEL requires (`completedCount` vs the
  // level's own `requiredOrders`) and, once satisfied, finishes the
  // level through the exact same LevelManager.completeLevel/story-flush
  // path every other campaign completion already uses — never a second
  // completion system. Same session-only lifetime rule as `serviceSession`.
  const [campaignServiceSession, setCampaignServiceSession] = useState<ServiceSession | null>(null);

  // Phase 4 — REAL batching (brief §3-§10): a level with
  // `batchGroupRecipeIds` runs a BatchGroupSession instead of an
  // ordinary campaign session. `batchViewOrderId` is deliberately
  // separate from "which group order is next up" — it tracks which
  // order's Preparation/ServiceOrderComplete screen the player is
  // currently LOOKING AT, so serving one order shows ITS OWN reaction/
  // payment screen first; the view only advances once the player taps
  // "Next Customer" (never automatically, even though the underlying
  // group state may have already made the next order READY via
  // sharing). Same session-only lifetime rule as the other sessions.
  const [batchGroupSession, setBatchGroupSession] = useState<BatchGroupSession | null>(null);
  const [batchViewOrderId, setBatchViewOrderId] = useState<string | null>(null);

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

  // Safety net (Phase 2, extended in Phase 3 to cover campaign-service
  // too) — advancing a queue only ever produces a null `current` when
  // its unlocked pool is empty (never expected once any recipe is
  // reachable, but not impossible), and a null current has nothing for
  // Preparation's service branch to render. Rather than silently
  // falling through to the legacy CAMPAIGN branch below (which would
  // show an unrelated level), bounce back to the Order Board.
  useEffect(() => {
    const active =
      sessionMode === "service"
        ? serviceSession
        : sessionMode === "campaign-service"
          ? campaignServiceSession
          : null;
    if (active && screen === "gameplay" && !active.current) {
      setSessionMode("campaign");
      setScreen("board");
    }
    // Phase 4 — the batch-group equivalent: no viewable order means
    // either the group finished (finishBatchGroupLevel already clears
    // sessionMode/screen itself, so this is a genuine no-op then) or
    // something went wrong building it; either way, never fall through
    // to legacy Preparation with nothing to show.
    if (
      sessionMode === "batch-group" &&
      screen === "gameplay" &&
      batchGroupSession &&
      !batchGroupSession.orders.some((o) => o.order.id === batchViewOrderId)
    ) {
      setSessionMode("campaign");
      setScreen("board");
    }
  }, [
    sessionMode,
    screen,
    serviceSession,
    campaignServiceSession,
    batchGroupSession,
    batchViewOrderId,
  ]);

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

  /**
   * Kitchen's "Today's Board" picks a level, not a raw recipe (§9.2 —
   * same Preparation flow, different data). Phase 3 — a level carrying
   * `recipePoolIds` (Levels 1-40) is "Level ≠ Recipe" architecture and
   * routes through startCampaignLevel's ServiceManager pipeline instead
   * of the legacy fixed-preparationSteps path; every other level (41-120)
   * behaves exactly as before.
   */
  function onSelectLevel(levelId: string) {
    if (!save) return;
    persist({ ...save, levelProgress: selectLevel(levelId, save.levelProgress) });
    const level = getLevel(levelId);
    if (level?.batchGroupRecipeIds?.length) {
      startBatchGroupLevel(level);
      return;
    }
    if (level?.recipePoolIds?.length) {
      startCampaignLevel(level);
      return;
    }
    setSessionMode("campaign");
    setActiveLevelId(levelId);
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

  /** The player's current campaign reach, as a plain level number — the same `/-(\d+)$/` convention KnifeManager/BoardManager/KitchenUpgradeManager/CafeProgressionManager each already parse off `highestUnlockedLevelId` independently. */
  function highestReachedLevelNumber(currentSave: SaveData): number {
    return Number(currentSave.levelProgress.highestUnlockedLevelId.match(/-(\d+)$/)?.[1] ?? 0);
  }

  /**
   * Restaurant Service's own "Start Service" (Phase 2) — resumes the
   * existing queue if one is already running (a ServiceSession isn't
   * thrown away just because the player stepped out to Kitchen),
   * otherwise builds a fresh one from whatever of the Phase 2 test pool
   * (testRecipePool.ts) the player has actually reached (never offers a
   * locked recipe). No-ops if nothing in the pool is unlocked yet — the
   * entry point itself explains that rather than opening onto an empty
   * board.
   */
  function startService() {
    if (!save) return;
    if (!serviceSession) {
      const pool = poolUnlockedByLevel(TEST_RECIPE_POOL, highestReachedLevelNumber(save));
      if (pool.length === 0) return;
      setServiceSession(createServiceSession("service", pool, Math.random));
    }
    setSessionMode("service");
    setScreen("gameplay");
  }

  /**
   * Service session's own completion handler — updates recipeProgress
   * (best/done) exactly like every other mode so the Cookbook's existing
   * Prepared badge works unchanged (no second recipe-progress system),
   * then records every one of the recipe's components into the active
   * order's Mise en Place session (organizationManager, via
   * ServiceManager.recordAllComponents), which is what actually advances
   * the order toward READY. Coin payment is deliberately NOT awarded
   * here — it's held back for the explicit Serve action, so this always
   * returns 0.
   */
  function recordServiceResult(score: number): number {
    if (!save || !serviceSession?.current) return 0;
    const recipeId = serviceSession.current.recipe.id;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };
    persist({ ...save, recipeProgress });
    setServiceSession((s) => (s ? recordAllComponents(s) : s));
    return 0;
  }

  /** The Serve action ServiceOrderComplete calls — refuses (returns null) unless the order is genuinely READY, and can never pay twice (ServiceManager.serveCurrentOrder's own guard). */
  function serveActiveServiceOrder(): { coinsAwarded: number; reaction: string } | null {
    if (!serviceSession) return null;
    const result = serveCurrentOrder(serviceSession, Math.random);
    if (!result) return null;
    setServiceSession(result.session);
    if (result.coinsAwarded > 0 && save)
      persist({ ...save, credits: save.credits + result.coinsAwarded });
    return { coinsAwarded: result.coinsAwarded, reaction: result.reaction };
  }

  /** "Next Customer" — current(COMPLETED)->recent, next->current, a new next generated. Preparation remounts itself for the new current order via its own `key` (the order id changes), no navigation needed. */
  function advanceServiceQueue() {
    if (!save || !serviceSession) return;
    const pool = poolUnlockedByLevel(TEST_RECIPE_POOL, highestReachedLevelNumber(save));
    setServiceSession((s) => (s ? advanceServiceSession(s, pool, Math.random) : s));
  }

  /** A campaign level's own recipe pool (levelTypes.ts's `recipePoolIds`), resolved against the real campaignRecipes.ts library — never against TEST_RECIPE_POOL, which is the separate Phase 2 harness's own pool. */
  function campaignPoolFor(level: LevelDefinition | undefined): RecipeDefinition[] {
    return (level?.recipePoolIds ?? [])
      .map((id) => getCampaignRecipe(id))
      .filter((r): r is RecipeDefinition => !!r);
  }

  /**
   * Phase 3 — the campaign's own "Start Service" for a single Level
   * 1-40 (brief §3): builds a fresh ServiceSession from that level's
   * OWN recipe pool. No-ops if the level has no recipePoolIds (a legacy
   * level should never reach this function — onSelectLevel only calls
   * it after checking) or the pool resolves empty.
   */
  function startCampaignLevel(level: LevelDefinition) {
    if (!save || !level.recipePoolIds?.length) return;
    const pool = campaignPoolFor(level);
    if (pool.length === 0) return;
    setCampaignServiceSession(createServiceSession(level.id, pool, Math.random));
    setActiveLevelId(level.id);
    setSessionMode("campaign-service");
    setScreen("gameplay");
  }

  /** Mirrors recordServiceResult exactly, for the campaign session instead of the Phase 2 harness session — same recipeProgress bookkeeping (§36 "no second recipe-progress system"), same deferred-payment rule. */
  function recordCampaignServiceResult(score: number): number {
    if (!save || !campaignServiceSession?.current) return 0;
    const recipeId = campaignServiceSession.current.recipe.id;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };
    persist({ ...save, recipeProgress });
    setCampaignServiceSession((s) => (s ? recordAllComponents(s) : s));
    return 0;
  }

  /** Mirrors serveActiveServiceOrder exactly, for the campaign session. */
  function serveCampaignOrder(): { coinsAwarded: number; reaction: string } | null {
    if (!campaignServiceSession) return null;
    const result = serveCurrentOrder(campaignServiceSession, Math.random);
    if (!result) return null;
    setCampaignServiceSession(result.session);
    if (result.coinsAwarded > 0 && save)
      persist({ ...save, credits: save.credits + result.coinsAwarded });
    return { coinsAwarded: result.coinsAwarded, reaction: result.reaction };
  }

  /** "Next Customer" within a campaign level that isn't finished yet (its own requiredOrders hasn't been reached) — same queue-advance ServiceManager function the Phase 2 harness uses. */
  function advanceCampaignQueue() {
    if (!save || !campaignServiceSession) return;
    const level = getLevel(campaignServiceSession.levelId);
    const pool = campaignPoolFor(level);
    setCampaignServiceSession((s) => (s ? advanceServiceSession(s, pool, Math.random) : s));
  }

  /**
   * §35/§36 — a campaign level is complete once its required number of
   * orders have been SERVED and PAID, a separate, persistent concept
   * from the transient ServiceSession itself. Routes through the exact
   * same LevelManager.completeLevel + story-flush path
   * recordPreparationResult already uses for every other level, folded
   * into one merged save object + one persist() call for the same
   * cloud-save race-safety reason that path documents.
   */
  function finishCampaignLevel() {
    if (!save || !campaignServiceSession) return;
    const level = getLevel(campaignServiceSession.levelId);
    if (!level) return;
    const { progress: levelProgress, rewardCoins } = completeLevel(level.id, save.levelProgress);
    const nextSave = { ...save, credits: save.credits + rewardCoins, levelProgress };
    const flush = checkStoryFlush(nextSave);
    const finalSave = flush
      ? flush.kind === "finale"
        ? applyFinaleSeen(nextSave)
        : applyMilestoneFired(nextSave, flush.milestone)
      : nextSave;
    persist(finalSave);
    if (flush) setStoryEvent(flush);
    setCampaignServiceSession(null);
    setSessionMode("campaign");
    go("board");
  }

  /**
   * Phase 4 — starts a REAL batch group (brief §3-§10): resolves the
   * level's `batchGroupRecipeIds` against the real campaign recipe
   * library and builds one BatchGroupSession where all of them are
   * simultaneously active, sharing one OrganizationSession.
   */
  function startBatchGroupLevel(level: LevelDefinition) {
    if (!save || !level.batchGroupRecipeIds?.length) return;
    const recipes = level.batchGroupRecipeIds
      .map((id) => getCampaignRecipe(id))
      .filter((r): r is RecipeDefinition => !!r);
    if (recipes.length < 2) return;
    const group = createBatchGroupSession(level.id, recipes, Math.random);
    setBatchGroupSession(group);
    setBatchViewOrderId(currentBatchOrder(group)?.order.id ?? null);
    setActiveLevelId(level.id);
    setSessionMode("batch-group");
    setScreen("gameplay");
  }

  /** Mirrors recordCampaignServiceResult, but records into the SHARED group session for whichever order the player is currently viewing — this is what actually performs the cross-order sharing (ServiceManager.recordBatchGroupComponents). */
  function recordBatchGroupResult(score: number): number {
    if (!save || !batchGroupSession || !batchViewOrderId) return 0;
    const viewed = batchGroupSession.orders.find((o) => o.order.id === batchViewOrderId);
    if (!viewed) return 0;
    const prior = save.recipeProgress[viewed.recipe.id];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [viewed.recipe.id]: { best, done: true } };
    persist({ ...save, recipeProgress });
    setBatchGroupSession((g) => (g ? recordBatchGroupComponents(g, batchViewOrderId) : g));
    return 0;
  }

  /** Serves whichever order is currently VIEWED — refuses unless it's genuinely READY (ServiceManager's own guard), same exactly-once payment rule as every other mode. */
  function serveBatchGroupViewedOrder(): { coinsAwarded: number; reaction: string } | null {
    if (!batchGroupSession || !batchViewOrderId) return null;
    const result = serveBatchGroupOrder(batchGroupSession, batchViewOrderId, Math.random);
    if (!result) return null;
    setBatchGroupSession(result.group);
    if (result.coinsAwarded > 0 && save)
      persist({ ...save, credits: save.credits + result.coinsAwarded });
    return { coinsAwarded: result.coinsAwarded, reaction: result.reaction };
  }

  /** "Next Customer" within a batch group — advances the VIEW to the next order (which may already be READY, having been satisfied by the order just served — §4's whole point), or finishes the level once every group order has been served and paid. */
  function advanceBatchGroupView() {
    if (!save || !batchGroupSession || !batchViewOrderId) return;
    if (isBatchGroupComplete(batchGroupSession)) {
      finishBatchGroupLevel();
      return;
    }
    const viewedIndex = batchGroupSession.orders.findIndex((o) => o.order.id === batchViewOrderId);
    const next = batchGroupSession.orders[viewedIndex + 1] ?? nextBatchOrder(batchGroupSession);
    setBatchViewOrderId(next?.order.id ?? null);
  }

  /** Same LevelManager.completeLevel + story-flush path finishCampaignLevel uses — a batch group finishing IS a normal campaign level completion, just reached via shared preparation instead of separate cuts. */
  function finishBatchGroupLevel() {
    if (!save || !batchGroupSession) return;
    const level = getLevel(batchGroupSession.levelId);
    if (!level) return;
    const { progress: levelProgress, rewardCoins } = completeLevel(level.id, save.levelProgress);
    const nextSave = { ...save, credits: save.credits + rewardCoins, levelProgress };
    const flush = checkStoryFlush(nextSave);
    const finalSave = flush
      ? flush.kind === "finale"
        ? applyFinaleSeen(nextSave)
        : applyMilestoneFired(nextSave, flush.milestone)
      : nextSave;
    persist(finalSave);
    if (flush) setStoryEvent(flush);
    setBatchGroupSession(null);
    setBatchViewOrderId(null);
    setSessionMode("campaign");
    go("board");
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

  // A service session (Phase 2's standalone harness OR Phase 3's
  // campaign pipeline) renders through the SAME Preparation branch
  // (its `level` prop stays undefined; `service` takes over) — never
  // two competing branches. Guarded on the active session's `current`
  // existing, not just `sessionMode`, so the safety-net effect above
  // always gets a render tick to redirect away before this would
  // otherwise try to render with nothing to show.
  const isCampaignService = sessionMode === "campaign-service";
  const isBatchGroup = sessionMode === "batch-group";
  const activeServiceSession = isCampaignService ? campaignServiceSession : serviceSession;
  // Phase 4 — a batch-group's "current order" is whichever one the
  // player is VIEWING (batchViewOrderId), adapted into the same
  // {order, customer, recipe, session} shape Preparation/
  // ServiceOrderComplete already expect — `session` is the GROUP's one
  // shared OrganizationSession (neither component ever reads it
  // directly; only ServiceManager's own functions do).
  const viewedBatchOrder =
    isBatchGroup && batchGroupSession
      ? (batchGroupSession.orders.find((o) => o.order.id === batchViewOrderId) ?? null)
      : null;
  const currentServiceOrder =
    sessionMode === "service" || isCampaignService
      ? (activeServiceSession?.current ?? null)
      : viewedBatchOrder && batchGroupSession
        ? { ...viewedBatchOrder, session: batchGroupSession.session }
        : null;
  const showServicePrep = screen === "gameplay" && !!currentServiceOrder;
  const showCampaignPrep =
    screen === "gameplay" &&
    sessionMode !== "service" &&
    sessionMode !== "campaign-service" &&
    sessionMode !== "batch-group";
  const batchGroupWillFinish =
    isBatchGroup && batchGroupSession ? isBatchGroupComplete(batchGroupSession) : false;

  // Phase 3 — once this serve would satisfy the ACTIVE CAMPAIGN LEVEL's
  // own `requiredOrders` (levelTypes.ts), the "Next Customer" action
  // must finish the level (LevelManager.completeLevel + story flush)
  // instead of just generating another order (§35/§36 — level
  // completion is a separate concept from "an order got served").
  // Computed off `completedCount + 1` because completedCount only
  // increments on advance, not on serve — this is the state right
  // after the just-served order but before that advance has happened.
  const campaignLevelForSession = isCampaignService
    ? getLevel(campaignServiceSession?.levelId ?? "")
    : null;
  const campaignWillFinishNext =
    isCampaignService && campaignServiceSession
      ? campaignServiceSession.completedCount + 1 >= (campaignLevelForSession?.requiredOrders ?? 1)
      : false;

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
      {showServicePrep && currentServiceOrder ? (
        <Preparation
          // Remounts for a new order the same way the campaign branch
          // remounts for a new level: the key changes ("Next Customer"
          // -> advance -> a genuinely different order id), so
          // Preparation's internal phase/step state always starts fresh
          // for the new customer.
          key={currentServiceOrder.order.id}
          service={{
            order: currentServiceOrder,
            onServe: isCampaignService
              ? serveCampaignOrder
              : isBatchGroup
                ? serveBatchGroupViewedOrder
                : serveActiveServiceOrder,
            onNextOrder: isCampaignService
              ? campaignWillFinishNext
                ? finishCampaignLevel
                : advanceCampaignQueue
              : isBatchGroup
                ? advanceBatchGroupView
                : advanceServiceQueue,
            ...((isCampaignService && campaignWillFinishNext) ||
            (isBatchGroup && batchGroupWillFinish)
              ? { nextLabel: "Finish Level" }
              : {}),
            ...(activeServiceSession ? { batchHint: batchHintFor(activeServiceSession) } : {}),
            ...(isBatchGroup && batchGroupSession && batchViewOrderId
              ? { batchHint: batchHintForGroup(batchGroupSession, batchViewOrderId) }
              : {}),
          }}
          onExit={() => {
            setSessionMode("campaign");
            go("board");
          }}
          onComplete={
            isCampaignService
              ? recordCampaignServiceResult
              : isBatchGroup
                ? recordBatchGroupResult
                : recordServiceResult
          }
          credits={save.credits}
          previousBest={save.recipeProgress[currentServiceOrder.recipe.id]?.best ?? 0}
          knife={equippedKnife}
          board={equippedBoard}
        />
      ) : showCampaignPrep ? (
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
            serviceSession={serviceSession}
            onStartService={startService}
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
