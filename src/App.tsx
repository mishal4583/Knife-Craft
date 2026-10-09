import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Preparation, preloadPreparation } from "@/components/kc/game/lazyPreparation";
import { ReplayBonusSheet, AdPlayingShield } from "@/components/kc/ReplayBonusSheet";
import { maybeShowInterstitial } from "@/game/ads/interstitialPolicy";
import {
  commitReplayBonus,
  isReplayBonusClaimed,
  newReplayBonusRewardId,
  replayBonusOfferFor,
  replayBonusesLeftToday,
  verifyReplayBonusCommit,
  type ReplayBonusFailure,
  type ReplayBonusOffer,
  type ReplayBonusPhase,
} from "@/game/ads/replayBonus";
import {
  AD_PLACEMENT,
  levelAbandoned,
  levelCompleted,
  levelStarted,
  onAdActiveChange,
  requestRewardedAd,
  rewardedAdsAvailable,
  sendScore,
  type LevelContext,
} from "@/game/PlayablesSDK";
import { levelNumber } from "@/game/levels/levelMastery";
import { GameShell } from "@/components/kc/game/GameShell";
import { type ScreenId } from "@/components/kc/data";
import { SaveManager, type SaveData } from "@/game/SaveManager";
import { PauseManager } from "@/game/PauseManager";
import { AudioManager } from "@/game/AudioManager";
import {
  getLevel,
  completeLevel,
  selectLevel,
  isUnlocked,
  isCompleted,
} from "@/game/levels/LevelManager";
import { LEVELS } from "@/game/levels/levelDefinitions";
import { knifeOrDefault } from "@/game/knives/knifeDefinitions";
import {
  effectiveKnife,
  upgradeKnife as upgradeKnifeFromBlacksmith,
  type BlacksmithStat,
} from "@/game/knives/blacksmith";
import { buyKnife as buyKnifeFromCatalog, equipKnife } from "@/game/knives/KnifeManager";
import { boardOrDefault } from "@/game/boards/boardDefinitions";
import { buyBoard as buyBoardFromCatalog, equipBoard } from "@/game/boards/BoardManager";
import {
  purchaseKitchenUpgrade,
  syncKitchenUpgradeOwnership,
} from "@/game/kitchen/KitchenUpgradeManager";
import {
  FAMILY_LEGACY_ID,
  grantEarnedMilestoneRewards,
  type MilestoneDefinition,
} from "@/game/progression/milestoneRewards";
import { walletInvariantViolation } from "@/game/economy/wallet";
import {
  shouldRunIntro,
  markIntroDone,
  checkStoryFlush,
  applyFinaleSeen,
  applyMilestoneFired,
  type StoryFlushResult,
} from "@/game/story/StoryManager";
import { FINALE } from "@/game/story/storyDefinitions";
import { StoryOverlay } from "@/components/kc/story/StoryOverlay";
import { CinematicIntro } from "@/components/kc/story/CinematicIntro";
import { MilestoneBanner } from "@/components/kc/story/MilestoneBanner";
import {
  businessAlertsFor,
  newlyRaisedAlerts,
  alertKeys,
  type BusinessAlert,
} from "@/game/business/businessAlerts";
import {
  pickDailyLevel,
  hasClaimedToday,
  claimDaily,
  DAILY_ORDER_BONUS_COINS,
} from "@/game/daily/DailyOrderManager";
import { pickEndlessLevel, applyEndlessEarn } from "@/game/daily/EndlessServiceManager";
import { paidLevelReward } from "@/game/levels/levelRewards";
import { levelOrderEarnings } from "@/game/levels/levelEarnings";
import {
  endlessEventsActive,
  todaysSpecialBonus,
  withTodaysSpecialServed,
} from "@/game/restaurant/restaurantEvents";
import { rankChange } from "@/game/restaurant/cityRanking";
import { isEmergencyService } from "@/game/restaurant/emergencyService";
import { recordEndlessDayStars, starsForDay } from "@/game/restaurant/restaurantStanding";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { ticketsFor } from "@/game/restaurant/serviceTickets";
import { consumeCampaignOrderStock } from "@/game/restaurant/campaignStock";
import { servicePlanFor, servicePlanNeedsSheet } from "@/game/restaurant/preServiceCheck";
import { closeDay, openDay, recordService, restaurantDayOf } from "@/game/restaurant/restaurantDay";
import { nextMenuGuest, withMenuGuestServed } from "@/game/restaurant/menuGuests";
import {
  cleanSettings,
  orderServiceFor,
  takeOrderSupplies,
  washUp,
} from "@/game/restaurant/serviceSupplies";
import { isSystemLive } from "@/game/restaurant/restaurantProgression";
import {
  fireSpecialist,
  getSpecialist,
  hireSpecialist,
  paySpecialists,
} from "@/game/restaurant/staffRequirements";
import {
  BULK_MAX_PACKS,
  bulkDiscountFor,
  ingredientBulkDiscount,
} from "@/game/restaurant/bulkBuying";
import { businessDayAllowed } from "@/game/restaurant/endlessRestaurant";
import { markStarterCrateSeen } from "@/game/restaurant/restaurantMigration";
import {
  supplierEffects,
  restaurantSettlement,
  restaurantQualityBonusPct,
  supplierPriceFactor,
} from "@/game/restaurant/restaurantEconomy";
import { businessCustomerPayment } from "@/game/business/BusinessServiceManager";
import { recordRevenueAndCogs } from "@/game/business/BusinessFinanceManager";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { giveGrandmasLeftovers } from "@/game/restaurant/grandmasFridge";
import {
  STAR_GRADES,
  customerLineFor,
  goalFor,
  hasLevelGoals,
  isGraded,
  levelStars,
  starText,
  starsForScore,
} from "@/game/restaurant/levelGoals";
import { requirementsForRecipes } from "@/game/restaurant/recipeRequirements";
import { usableQuantity } from "@/game/business/perishability";
import { formatStockAmount } from "@/game/business/measure";
import {
  TAB_OPENING_NOTE,
  dayCeremonyAt,
  firstPurchaseRows,
  earlyStockAt,
  grandmaLineFor,
  tabsOpeningAt,
} from "@/game/restaurant/firstLevels";
import {
  mayPayOrder,
  ordersRequired,
  paidOrdersFor,
  withPaidOrder,
} from "@/game/levels/paidOrders";
import {
  createServiceSession,
  recordAllComponents,
  serveCurrentOrder,
  advanceServiceSession,
  batchHintFor,
  createBatchGroupSession,
  recordBatchGroupComponents,
  serveBatchGroupOrder,
  isBatchGroupComplete,
  currentBatchOrder,
  nextBatchOrder,
  batchHintForGroup,
  withOrdersAlreadyServed,
  createTicketedServiceSession,
  withExtraTicket,
  withBatchOrdersAlreadyServed,
  type ServiceSession,
  type BatchGroupSession,
} from "@/game/service/ServiceManager";
import { getCampaignRecipe } from "@/game/recipes/campaignRecipes";
import type { RecipeDefinition } from "@/game/recipes/recipeTypes";
import type { LevelDefinition } from "@/game/levels/levelTypes";
import { computeSettlement } from "@/game/economy/EconomySettlement";
import { dollars, formatUsd, formatUsdChange } from "@/game/money";
import {
  getKnifeSharpness,
  applySharpnessDecay,
  sharpenKnife as sharpenKnifeFromCatalog,
} from "@/game/economy/sharpness";
import { buyStaff as buyStaffFromCatalog } from "@/game/economy/StaffManager";
import { selectSupplier as selectSupplierFromCatalog } from "@/game/economy/SupplierManager";
import { appendLedgerEntry } from "@/game/economy/EconomyLedger";
import type { SettlementResult } from "@/game/economy/economyTypes";
import {
  isKnownIngredient,
  purchaseIngredient as purchaseIngredientFromCatalog,
  rushRestock,
} from "@/game/business/BusinessInventoryManager";
import { purchaseRefrigerator as purchaseRefrigeratorFromCatalog } from "@/game/business/RefrigeratorManager";
import { discardExpiredStock } from "@/game/business/discardExpired";
import { purchaseSupply as purchaseSupplyFromCatalog } from "@/game/business/BusinessSuppliesManager";
import { getSupplyItem, isConsumableSupply } from "@/game/business/businessSupplies";
import { performRefrigeratorMaintenance as performRefrigeratorMaintenanceFromCatalog } from "@/game/business/businessMaintenance";
import type { InspectionReport } from "@/game/business/businessInspection";
import type { InspectionFineResult } from "@/game/business/businessInspectionFines";
import { endBusinessDay as endBusinessDayImpl } from "@/game/business/BusinessDayManager";
import { setMenuPrice as setMenuPriceImpl } from "@/game/business/BusinessMenuManager";
import { setDishActive as setDishActiveImpl } from "@/game/business/businessMenuActivation";
import {
  signContract as signContractImpl,
  cancelContract as cancelContractImpl,
} from "@/game/business/BusinessSupplierManager";
import {
  hireStaff as hireStaffImpl,
  fireStaff as fireStaffImpl,
} from "@/game/business/BusinessStaffManager";
import {
  advanceBusinessServiceSession as advanceBusinessServiceSessionImpl,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  nextCustomerDestination,
  businessOrderAvailability,
  businessCustomersToday,
  businessServiceSessionForToday,
  endlessFeaturedFor,
} from "@/game/business/BusinessServiceManager";
import type {
  BusinessCustomerPayment,
  BusinessCustomersToday,
} from "@/game/business/BusinessServiceManager";
import { businessDishForRecipeId } from "@/game/business/businessServiceCatalog";
import {
  lbPerMarketUnit,
  marketStep,
  measureOf,
  setDisplayMeasure,
  type Measure,
} from "@/game/business/measure";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import {
  newRushRestockRewardId,
  type RushRestockOutcome,
  type RushRestockPayment,
} from "@/game/business/businessRushRestock";
import {
  makeSeededRand,
  businessServiceSeedFor,
} from "@/game/business/businessDeterministicRandom";
import {
  recordInventoryPurchase,
  recordPackagingPurchase,
  recordCapitalExpenditure,
  recordMaintenanceCost,
  recordSupplierCost,
  computeDailyPnL,
  DEFAULT_DAILY_ACCUMULATOR,
} from "@/game/business/BusinessFinanceManager";

// Split away from the initial bundle — Preparation (and the Phaser it
// pulls in) is needed immediately since Prep is the first screen, but
// Kitchen/Workshop/Recipes/... aren't needed until the player navigates
// there (§31).
// Unified Restaurant (RESTAURANT_MODE only): its own chunk, never in the main bundle.
const ServiceCheckLayer = lazy(() =>
  import("@/components/kc/restaurant/ServiceCheckLayer").then((m) => ({
    default: m.ServiceCheckLayer,
  })),
);
const ClosingTime = lazy(() =>
  import("@/components/kc/restaurant/ClosingTime").then((m) => ({ default: m.ClosingTime })),
);
const ScreensRouter = lazy(() =>
  import("./ScreensRouter").then((m) => ({ default: m.ScreensRouter })),
);

/** A campaign level's own recipe pool (levelTypes.ts's `recipePoolIds`), resolved against the real campaignRecipes.ts library — never against TEST_RECIPE_POOL, which is the separate Phase 2 harness's own pool. */
function campaignPoolFor(level: LevelDefinition | undefined): RecipeDefinition[] {
  return (level?.recipePoolIds ?? [])
    .map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
}

/**
 * The one way a campaign level's ServiceSession is built — used by
 * startCampaignLevel AND by the first-ever launch (the load effect), so
 * Level 1 on a fresh save runs the same customer/Serve/Finish Level
 * pipeline as every replay of it. Null when the level has no pool.
 *
 * Economy V2 replay safety (Law 2 extended to the order-pool
 * architecture) — `isReplay` reads the SAME existing source of truth
 * completeLevel's own isFirstCompletion gate already reads, never a
 * second completion system. Determined once, at session start, and
 * carried on the session itself so every order served during this run
 * settles for 0 (serveCampaignOrder), while the player still plays the
 * level normally.
 */
function buildCampaignServiceSession(
  level: LevelDefinition,
  levelProgress: SaveData["levelProgress"],
): ServiceSession | null {
  if (!level.recipePoolIds?.length) return null;
  const pool = campaignPoolFor(level);
  if (pool.length === 0) return null;
  const isReplay = isCompleted(level.id, levelProgress);
  // Unified Restaurant: a first play serves the level's rolled tickets (the
  // ones the Pre-Service Check listed), after any orders already paid.
  if (RESTAURANT_MODE && !isReplay) {
    const { tickets } = ticketsFor(levelProgress, level);
    return createTicketedServiceSession(
      level.id,
      tickets,
      paidOrdersFor(levelProgress, level.id).length,
      Math.random,
      level.chapter,
      false,
    );
  }
  const session = createServiceSession(level.id, pool, Math.random, level.chapter, isReplay);
  // A retry carries on: orders already served and paid stay counted.
  return isReplay
    ? session
    : withOrdersAlreadyServed(session, paidOrdersFor(levelProgress, level.id).length);
}

function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,var(--color-ivory),var(--color-cream))]">
      <p className="font-hand text-[26px] text-walnut/70">warming the kitchen…</p>
    </div>
  );
}

/** One banner per payout: several milestones paid together (e.g. an older save's first load) are summed into one line. */
type MilestoneNotice = { id: string; label: string; reward: number; legacy: boolean };
function milestoneNoticeFor(granted: readonly MilestoneDefinition[]): MilestoneNotice {
  const reward = granted.reduce((sum, m) => sum + m.reward, 0);
  const finale = granted.find((m) => m.id === FAMILY_LEGACY_ID);
  const id = granted.map((m) => m.id).join("+");
  if (finale) {
    // Level 250: CAMPAIGN COMPLETE · 250 / 250 · FINAL REWARD · Endless Service unlocked.
    const others = reward - finale.reward;
    return {
      id,
      label: `250 / 250 · Final Reward ${formatUsdChange(finale.reward)}${
        others > 0 ? ` (+ milestones ${formatUsdChange(others)})` : ""
      } · Endless Service unlocked`,
      reward,
      legacy: true,
    };
  }
  if (granted.length === 1) {
    const only = granted[0]!;
    return { id, label: `${only.label} · ${formatUsdChange(only.reward)}`, reward, legacy: false };
  }
  return {
    id,
    label: `${granted.length} milestones reached · ${formatUsdChange(reward)}`,
    reward,
    legacy: false,
  };
}

/**
 * First levels pass 2 (display only): "🧊 Left in the fridge: Tomato 0.9 lb ·
 * Cucumber 0.3 lb" — what the save's fridge now holds of the ingredients a
 * level used. Null when it used none.
 */
function fridgeLeftLine(save: SaveData, ids: readonly IngredientId[]): string | null {
  if (ids.length === 0) return null;
  const day = save.business.calendar.businessDay;
  const measure = measureOf(save);
  return `🧊 Left in the fridge: ${ids
    .map(
      (id) =>
        `${INGREDIENTS[id].name} ${formatStockAmount(id, usableQuantity(save.business.inventory, id, day), measure)}`,
    )
    .join(" · ")}`;
}

export function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  // Settings → Weights: what every screen shows this render (business/measure.ts; display only).
  setDisplayMeasure(RESTAURANT_MODE && save ? measureOf(save) : "lb");
  // Settings → Reduced motion: calm animations everywhere (styles.css .kc-reduced-motion).
  useEffect(() => {
    document.documentElement.classList.toggle("kc-reduced-motion", !!save?.settings.reducedMotion);
  }, [save?.settings.reducedMotion]);
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
  /** Unified Restaurant: the level whose Pre-Service Check is open (null = none). */
  const [serviceCheckLevelId, setServiceCheckLevelIdState] = useState<string | null>(null);
  const serviceCheckRef = useRef<string | null>(null);
  /** Closing time is due: the level just selected waits (its go("gameplay") is ignored). */
  const closingHoldRef = useRef(false);
  const setServiceCheckLevelId = (id: string | null) => {
    serviceCheckRef.current = id;
    setServiceCheckLevelIdState(id);
  };
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
    "campaign" | "daily" | "endless" | "campaign-service" | "batch-group" | "business-service"
  >("campaign");
  const [endlessIndex, setEndlessIndex] = useState(0);

  // Phase 3 — the ServiceSession for a campaign level's own
  // "Level -> ServiceProfile -> RecipePool" pipeline (brief §3/§35/§36).
  // (The Phase 2 standalone Restaurant Service test harness is not
  // reachable from the game; testRecipePool.ts is test-only.) A campaign
  // session additionally tracks how
  // many orders the ACTIVE LEVEL requires (`completedCount` vs the
  // level's own `requiredOrders`) and, once satisfied, finishes the
  // level through the exact same LevelManager.completeLevel/story-flush
  // path every other campaign completion already uses — never a second
  // completion system. Session-only: never persisted.
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

  // Economy V3 Phase 14, Checkpoint 3 — Business Mode's own ServiceSession,
  // built from the curated Business Dish catalog (businessServiceCatalog.ts)
  // instead of campaign recipes — same session-only lifetime rule as
  // `campaignServiceSession` above
  // (never persisted; a reload simply loses in-progress queue state, never
  // partial inventory/payment — see BusinessServiceManager.ts's own doc).
  const [businessServiceSession, setBusinessServiceSession] = useState<ServiceSession | null>(null);
  // CLAUDE.md §13 — deterministic, never Math.random: one seeded generator
  // per session lifetime (reseeded from the current business day whenever
  // a fresh session is created), reused for every generation/serve call
  // within that same session so "same day, same sequence of actions"
  // always reproduces the same orders.
  const businessRandRef = useRef<(() => number) | null>(null);

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
  // The intro ends exactly once, whether it finished or was skipped.
  const introCompletedRef = useRef(false);

  // Economy V2 Phase 9 — the level's own completion reward
  // (finishCampaignLevel/finishBatchGroupLevel's `rewardCoins`), shown via
  // the SAME MilestoneBanner component the story system already uses — a
  // separate state slot so this never collides with or depends on
  // StoryManager's own story-only union type. (This slot used to also
  // report Kitchen Investment chapter upkeep; that system was retired —
  // the six kitchen backgrounds are the kitchen progression now.)
  const [levelRewardNotice, setLevelRewardNotice] = useState<{
    rewardCoins: number;
    /** What this level's orders paid (levelOrderEarnings), or null when it can't be read. */
    orderCoins: number | null;
    /** Restaurant build: the city ranking it moved (restaurant/cityRanking.ts), when it moved. */
    cityRank?: { from: number; to: number; passed: string };
    /** First levels (restaurant/firstLevels.ts): Grandma's line on Levels 1–15. */
    grandma?: string;
    /** The bottom-bar sections the next level opens. */
    opened?: string[];
    /** Before Level 21: the day that quietly began. */
    newDay?: number;
  } | null>(null);

  // Platform ads (Playgama Bridge). `saveRef` always holds the latest committed save, so code
  // resuming after an `await` (a rewarded ad) reads the authoritative state,
  // never a stale closure. The Replay Bonus's claimed/granted state is NOT
  // stored here — it is derived from the save's ledger (replayBonus.ts).
  const saveRef = useRef<SaveData | null>(null);
  const [replayOffer, setReplayOffer] = useState<ReplayBonusOffer | null>(null);
  const [replayPhase, setReplayPhase] = useState<ReplayBonusPhase>("OFFER_SHOWN");
  const [replayFailure, setReplayFailure] = useState<ReplayBonusFailure | null>(null);
  const replayBusyRef = useRef(false);
  // Mirrors `replayOffer` for code resuming after an await (was the sheet closed meanwhile?).
  const replayOfferRef = useRef<ReplayBonusOffer | null>(null);
  replayOfferRef.current = replayOffer;
  // A bonus the platform confirmed only after the player had closed the sheet
  // (possible after the dead-request guard released the screen) — confirmed here.
  const [lateReplayBonus, setLateReplayBonus] = useState<number | null>(null);
  const [adActive, setAdActive] = useState(false);
  // Economy V2.5 — milestone rewards just paid, shown one at a time.
  const [milestoneNoticeQueue, setMilestoneNoticeQueue] = useState<MilestoneNotice[]>([]);
  // Rush Restock's ad path resumes after an await: it reads the CURRENT order
  // from this ref (was it served or replaced while the ad played?).
  const rushAdBusyRef = useRef(false);
  const businessSessionRef = useRef<ServiceSession | null>(null);
  // One id per play session (level/daily/endless start) + whether it reached a
  // completion — so an interstitial only follows a finished session, never a
  // mid-level quit, and each session's transition is requested at most once.
  // It also drives the Bridge level messages (level_started / level_completed).
  const playSessionRef = useRef({ id: 0, completed: false });
  function startPlaySession(where: LevelContext) {
    playSessionRef.current = { id: playSessionRef.current.id + 1, completed: false };
    levelStarted(where);
  }
  function markPlaySessionCompleted() {
    playSessionRef.current = { ...playSessionRef.current, completed: true };
    levelCompleted();
  }

  // Operations/Feedback checkpoint (pre-V3-16) — Business Mode's
  // transition notifications, shown through the SAME MilestoneBanner.
  // Alerts are derived (businessAlertsFor), never stored; a banner fires
  // only when an alert's stable key newly appears. Evaluated only while
  // a Business screen/session is active, so Campaign play never computes
  // or shows Business alerts. The first evaluation after load seeds the
  // "already seen" set silently — a reload never replays old banners.
  const [businessNoticeQueue, setBusinessNoticeQueue] = useState<BusinessAlert[]>([]);
  const seenBusinessAlertKeysRef = useRef<Set<string> | null>(null);

  // Load the save once and wire the platform pause source (§23 —
  // the Bridge's pause state is the sole authority). gameReady() is
  // NOT called here — loading the save file isn't "the game is
  // interactive". Preparation calls it once Phaser's scene actually
  // finishes booting (see its SCENE_READY handler).
  // While a platform ad is in flight the game is muted (AudioManager) and a
  // shield swallows every tap, so nothing underneath can take input.
  useEffect(() => onAdActiveChange(setAdActive), []);

  // Platform score = campaign levels completed. Sent once the save loads and
  // again each time it grows (never a lower value, never twice for the same).
  const completedCount = save?.levelProgress.completedLevelIds.length ?? 0;
  const lastSentScoreRef = useRef(-1);
  useEffect(() => {
    if (!save || completedCount <= lastSentScoreRef.current) return;
    lastSentScoreRef.current = completedCount;
    sendScore(completedCount);
  }, [save, completedCount]);

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
      // A fresh save's Level 1 runs the SAME service pipeline
      // (customer -> Serve -> Finish Level) as picking Level 1 from the
      // Order Board (onSelectLevel -> startCampaignLevel), so the first
      // play pays the order settlement AND the completion reward and
      // shows Level Complete. Only a level without a recipe pool falls
      // back to the legacy fixed-steps Preparation.
      if (isFreshSave) {
        const firstSession = buildCampaignServiceSession(LEVELS[0]!, loaded.levelProgress);
        if (firstSession) {
          setCampaignServiceSession(firstSession);
          setSessionMode("campaign-service");
        }
      }
      // Economy V2.5 — kitchen tiers are bought (Restaurant Development);
      // this only keeps the kitchen on the highest tier owned. Saves from
      // before V2.5 already got their level-earned tiers in
      // SaveManager.load (migrateKitchenDevelopment).
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
      // Economy V2.5 — a milestone reached but not yet claimed (e.g. the
      // game closed between completing Level 250 and saving its reward) is
      // paid once, now. Saves from before V2.5 had their reached milestones
      // claimed without payment by the one-time migration in
      // SaveManager.load (economyMigration.ts), so they get no windfall.
      const loadGrant = grantEarnedMilestoneRewards(synced);
      synced = loadGrant.save;
      if (loadGrant.granted.length > 0)
        setMilestoneNoticeQueue([milestoneNoticeFor(loadGrant.granted)]);
      if (synced !== loaded) void SaveManager.save(synced);
      saveRef.current = synced;
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
      sessionMode === "campaign-service"
        ? campaignServiceSession
        : sessionMode === "business-service"
          ? businessServiceSession
          : null;
    if (active && screen === "gameplay" && !active.current) {
      setSessionMode("campaign");
      setScreen(sessionMode === "business-service" ? "business-service" : "board");
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
    campaignServiceSession,
    businessServiceSession,
    batchGroupSession,
    batchViewOrderId,
  ]);

  // Business transition notifications — see the state declaration above.
  const inBusiness =
    screen.startsWith("business") || (screen === "gameplay" && sessionMode === "business-service");
  const businessOrder = businessServiceSession?.current ?? null;
  businessSessionRef.current = businessServiceSession;
  useEffect(() => {
    if (!inBusiness) {
      // Leaving Business drops any not-yet-shown banners (they'd be stale
      // by the time the player returns; the Dashboard still lists them).
      setBusinessNoticeQueue((q) => (q.length === 0 ? q : []));
      return;
    }
    if (!save) return;
    const alerts = businessAlertsFor(
      save,
      businessOrder ? { orderId: businessOrder.order.id, recipeId: businessOrder.recipe.id } : null,
    );
    const seen = seenBusinessAlertKeysRef.current;
    if (seen) {
      const fresh = newlyRaisedAlerts(seen, alerts);
      if (fresh.length > 0) setBusinessNoticeQueue((q) => [...q, ...fresh]);
    }
    seenBusinessAlertKeysRef.current = alertKeys(alerts);
  }, [save, inBusiness, businessOrder]);

  // A Pre-Service Check that just opened (onSelectLevel) holds the level back:
  // the Order Board / Kitchen buttons call go("gameplay") right after
  // selecting a level, and that must not skip the check.
  const go = (s: ScreenId) => {
    if (s === "gameplay" && (serviceCheckRef.current || closingHoldRef.current)) return;
    // Unified Restaurant: no separate Business Day before Level 250 (the Endless Restaurant opens after it).
    if (
      s === "business-service" &&
      saveRef.current &&
      !businessDayAllowed(RESTAURANT_MODE, saveRef.current.levelProgress)
    )
      return;
    setScreen(s);
  };

  /**
   * The one way the opening intro ends — the cinematic played out (it fades
   * into Level 1) or skipped via SKIP. Both land in the same state: it closes and
   * `story.introDone` is saved (once), leaving the player on the Level 1 that
   * is already mounted underneath. Nothing else in the save changes.
   */
  function completeIntro() {
    if (introCompletedRef.current) return;
    introCompletedRef.current = true;
    setShowIntro(false);
    const current = saveRef.current;
    if (current && !current.story.introDone) persist(markIntroDone(current));
  }

  /** The single place every save mutation flows through: keeps the kitchen
   * on the highest tier owned, pays any milestone this change reached
   * (Economy V2.5), and refuses a save whose wallet breaks the invariant
   * (never negative, whole cents — economy/wallet.ts). */
  function persist(next: SaveData) {
    const synced = syncKitchenUpgradeOwnership(next);
    // Economy V2.5 — a milestone reached by this change is paid right here,
    // once (milestoneRewards.ts: the ledger entry is the record).
    const { save: rewarded, granted } = grantEarnedMilestoneRewards(synced);
    // The one save funnel refuses money the game can't have (economy/wallet.ts).
    const violation = walletInvariantViolation(rewarded);
    if (violation) {
      console.error(`[economy] save refused: ${violation}`);
      return;
    }
    saveRef.current = rewarded;
    setSave(rewarded);
    void SaveManager.save(rewarded);
    if (granted.length > 0) setMilestoneNoticeQueue((q) => [...q, milestoneNoticeFor(granted)]);
  }

  /** Economy V2.5 — Restaurant Development: build the next kitchen tier (KitchenUpgradeManager.purchaseKitchenUpgrade), recorded as "kitchen-investment-purchase". */
  function buildKitchenUpgrade(id: string) {
    // The latest persisted save (not the render closure): a double tap
    // before re-render sees the tier already built and buys nothing.
    const current = saveRef.current;
    if (!current) return { ok: false as const, reason: "unknownUpgrade" as const };
    const result = purchaseKitchenUpgrade(current, id);
    if (result.ok) {
      persist(appendLedgerEntry(result.save, "kitchen-investment-purchase", -result.price, id));
    }
    return result;
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
    if (result.ok) {
      const spent = save.credits - result.save.credits;
      persist(appendLedgerEntry(result.save, "knife-purchase", -spent, id));
    }
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
    if (result.ok) {
      const spent = save.credits - result.save.credits;
      persist(appendLedgerEntry(result.save, "board-purchase", -spent, id));
    }
    return result;
  }

  /** Rack action (Economy V2 Phase 6) — routes through sharpness.sharpenKnife, mirroring buyKnife/buyBoard exactly: atomic, deterministic cost, never touches anything on failure. */
  function sharpenKnife(id: string) {
    if (!save) return { ok: false as const, reason: "insufficientFunds" as const };
    const result = sharpenKnifeFromCatalog(save, id);
    if (result.ok) {
      const spent = save.credits - result.save.credits;
      persist(appendLedgerEntry(result.save, "sharpening", -spent, id));
    }
    return result;
  }

  /** Blacksmith action — routes through blacksmith.upgradeKnife, mirroring sharpenKnife exactly: atomic, one "blacksmith-upgrade" ledger entry on success, nothing on failure. */
  function upgradeKnife(id: string, stat: BlacksmithStat) {
    if (!save) return { ok: false as const, reason: "unknownKnife" as const };
    const result = upgradeKnifeFromBlacksmith(save, id, stat);
    if (result.ok) persist(appendLedgerEntry(result.save, "blacksmith-upgrade", -result.cost, id));
    return result;
  }

  /** Shop action (Economy V2 Phase 7) — routes through StaffManager.buyStaff, mirroring buyKnife/buyBoard exactly. No equip step — every owned staff member's effect applies simultaneously (see StaffManager.ts's own doc). */
  function buyStaff(id: string) {
    if (!save) return { ok: false as const, reason: "unknownStaff" as const };
    const result = buyStaffFromCatalog(save, id);
    if (result.ok) {
      const spent = save.credits - result.save.credits;
      persist(appendLedgerEntry(result.save, "staff-purchase", -spent, id));
    }
    return result;
  }

  /** Shop action (Economy V2 Phase 8) — routes through SupplierManager.selectSupplier. Free, always-available selection: no cost, no unlock level, no ownership — mirrors setEquippedKnife/setEquippedBoard's "just switch it" shape more than buyKnife/buyStaff's purchase shape. */
  function selectSupplier(id: string) {
    if (!save) return;
    const result = selectSupplierFromCatalog(save, id);
    if (result.ok) persist(result.save);
  }

  /** Settings: the unit weighed ingredients are shown and sold in (business/measure.ts). */
  function setMeasure(measure: Measure) {
    if (!save || measureOf(save) === measure) return;
    persist({ ...save, settings: { ...save.settings, measure } });
  }

  function toggleSetting(key: "sound" | "reducedMotion") {
    if (!save) return;
    const settings = { ...save.settings, [key]: !save.settings[key] };
    if (key === "sound") AudioManager.setUserSoundEnabled(settings.sound);
    persist({ ...save, settings });
  }

  /**
   * Economy V3 Phase 1 (Business Calendar) — the player's own explicit
   * "End Day" action; never auto-advances, mirrors the brief's own "no
   * forced countdown timer" rule. Campaign's `levelProgress`/`credits`
   * are completely untouched by this — the two clocks never cross.
   *
   * Economy V3 Phase 4 (Perishability) — now routes through
   * BusinessDayManager.endBusinessDay, which also sweeps any stock that
   * expired as of the new day (never a silent deletion: the swept
   * quantity/value is returned here so the Dashboard can show exactly
   * what spoiled). No ledger entry — spoilage is never a wallet
   * mutation.
   *
   * Economy V3 Phase 6 (Popularity) — endBusinessDay also applies the
   * day's popularity movement (from the real, currently-wired pricing/
   * menu-variety factors) in the same atomic result.
   *
   * Economy V3 Phase 9 (Staff) — endBusinessDay also settles today's
   * payroll; a real payment gets its own ledger entry here (mirrors
   * every other real Business Mode expense — appendLedgerEntry no-ops
   * on a 0 amount, so a staffless day creates no fake entry).
   */
  function advanceBusinessDay() {
    if (!save) {
      return {
        spoiledQuantity: 0,
        spoiledValue: 0,
        spoiledIngredientIds: [] as string[],
        popularityDelta: 0,
        popularityScore: 50,
        popularityBreakdown: { operations: 0, inspection: 0, service: 0, pull: 0, total: 0 },
        expiredSupplierId: null as string | null,
        payrollPaid: 0,
        staffLaidOff: [] as string[],
        inspectionReport: {
          overall: "PASS",
          overallReason: "All inspection categories passed.",
          categories: [],
        } as InspectionReport,
        inspectionFine: { severity: "NONE", fineAmount: 0, finePaid: 0 } as InspectionFineResult,
        dailyPnL: computeDailyPnL({
          cashBeforeSettlement: 0,
          closingCash: 0,
          accumulator: { ...DEFAULT_DAILY_ACCUMULATOR },
          staffCost: 0,
          inspectionFines: 0,
          spoilageValue: 0,
        }),
      };
    }
    // The guests who wanted to eat today, read before the day closes (an Endless day's BUSY star).
    const customersWanted = businessCustomersToday(save).demand;
    const closingDay = save.business.calendar.businessDay;
    const result = endBusinessDayImpl(save);
    const withPayroll = appendLedgerEntry(
      result.save,
      "business-staff-salary",
      -result.payrollPaid,
    );
    const fined = appendLedgerEntry(
      withPayroll,
      "inspection-fine",
      -result.inspectionFine.finePaid,
    );
    // Unified Restaurant: the Endless Restaurant pays its specialist chefs too
    // (one "business-staff-salary" entry each; let go if unaffordable).
    const paidDay = RESTAURANT_MODE
      ? paySpecialists(fined, restaurantLevelOf(fined.levelProgress)).save
      : fined;
    // Endless Restaurant: the day's stars (status only — no money, no ledger),
    // read from the closed day's own record and inspection.
    const closedDay = paidDay.business.finance.history?.at(-1);
    const dayStars =
      RESTAURANT_MODE && endlessEventsActive(paidDay) && closedDay
        ? starsForDay({
            profit: closedDay.profit,
            ordersServed: closedDay.ordersServed,
            customersWanted,
            inspectionPassed: result.inspectionReport.overall !== "FAIL",
          })
        : null;
    const starred = dayStars ? recordEndlessDayStars(paidDay, dayStars) : paidDay;
    const { save: withFine, bonus: specialBonus } = payTodaysSpecial(
      starred,
      closingDay,
      closedDay?.revenue ?? 0,
    );
    persist(withFine);
    // Economy V3 Phase 14, Checkpoint 3 — a new business day always
    // reseeds a fresh Business Service session/order queue, never carries
    // yesterday's queue (or its seeded rand stream) into the new day.
    businessRandRef.current = null;
    setBusinessServiceSession(null);
    maybeShowInterstitial(
      `business-day:${withFine.business.calendar.businessDay}`,
      withFine.levelProgress.completedLevelIds.length,
      AD_PLACEMENT.businessDayEnd,
    );
    return {
      spoiledQuantity: result.spoiledQuantity,
      spoiledValue: result.spoiledValue,
      spoiledIngredientIds: result.spoiledIngredientIds as string[],
      popularityDelta: result.popularityDelta,
      popularityScore: result.popularityScore,
      popularityBreakdown: result.popularityBreakdown,
      expiredSupplierId: result.expiredSupplierId,
      payrollPaid: result.payrollPaid,
      staffLaidOff: result.staffLaidOff as string[],
      inspectionReport: result.inspectionReport,
      inspectionFine: result.inspectionFine,
      dailyPnL: result.dailyPnL,
      ...(dayStars ? { endlessStars: dayStars } : {}),
      ...(specialBonus > 0 ? { todaysSpecialBonus: specialBonus } : {}),
    };
  }

  /** Economy V3 Phase 2 (Business Inventory) — Business Mode's own purchase action, mirroring buyKnife/buyStaff exactly: routes through the pure manager, then records the ledger entry from the manager's own reported `totalCost` (never re-derived from a credits diff, since it's already exact). Business Mode only — Campaign never calls this. */
  /** One Market purchase on `from` — the restaurant's bulk price, supplier, freshness and lb/kg (classic: the plain price). */
  function buyOn(save: SaveData, ingredientId: string, quantity: number) {
    // The restaurant's price, supplier, freshness and lb/kg apply to known ingredients only.
    const id = RESTAURANT_MODE && isKnownIngredient(ingredientId) ? ingredientId : null;
    return purchaseIngredientFromCatalog(
      save,
      ingredientId,
      quantity,
      // Unified Restaurant: wholesale buying (restaurant/bulkBuying.ts), the same discount the card quoted.
      id ? ingredientBulkDiscount(id, quantity, measureOf(save)) : 0,
      // Economy pass: the Campaign Supplier's modifier acts on Market prices.
      RESTAURANT_MODE ? supplierPriceFactor(save) : 1,
      // Premium supplier: longer freshness (supplierEffects, provisional).
      RESTAURANT_MODE ? supplierEffects(save).freshnessBonusDays : 0,
      // Settings: kilograms or pounds (business/measure.ts) — the same unit the card quoted.
      id ? lbPerMarketUnit(id, measureOf(save)) : 1,
      // The restaurant's Market sells weighed goods by the ¼ lb / ¼ kg (business/measure.ts).
      id ? marketStep(id) : 1,
    );
  }

  /** Economy V3 Phase 2 (Business Inventory) — Business Mode's own purchase action, mirroring buyKnife/buyStaff exactly: routes through the pure manager, then records the ledger entry from the manager's own reported `totalCost` (never re-derived from a credits diff, since it's already exact). Business Mode only — Campaign never calls this. */
  function purchaseIngredient(ingredientId: string, quantity: number) {
    if (!save) return { ok: false as const, reason: "unknownIngredient" as const };
    const result = buyOn(save, ingredientId, quantity);
    if (result.ok) {
      persistIngredientPurchases(result.save, [{ ingredientId, totalCost: result.totalCost }]);
    }
    return result;
  }

  /**
   * The Market plan's "Buy all" (restaurant/marketPlan.ts): each line is an
   * ordinary Market purchase, made one after another on the latest save
   * (so every quote sees the money and fridge space the earlier lines used),
   * then saved once — one "inventory-purchase" entry per line bought. A line
   * the wallet or fridge can no longer take is skipped, never half-bought.
   */
  function purchaseIngredients(lines: ReadonlyArray<{ ingredientId: string; quantity: number }>) {
    if (!save) return { bought: 0, skipped: lines.length, totalCost: 0 };
    let next = save;
    const recorded: { ingredientId: string; totalCost: number }[] = [];
    for (const line of lines) {
      const r = buyOn(next, line.ingredientId, line.quantity);
      if (!r.ok) continue;
      next = r.save;
      recorded.push({ ingredientId: line.ingredientId, totalCost: r.totalCost });
    }
    if (recorded.length > 0) persistIngredientPurchases(next, recorded);
    return {
      bought: recorded.length,
      skipped: lines.length - recorded.length,
      totalCost: recorded.reduce((t, l) => t + l.totalCost, 0),
    };
  }

  /**
   * The one place an ingredient purchase is recorded — a Market purchase or
   * a cash Rush Restock: one "inventory-purchase" ledger entry per
   * ingredient (its exact cost, described by the ingredient id), and the
   * total added to today's inventory cost in the Business P&L.
   */
  function persistIngredientPurchases(
    next: SaveData,
    lines: ReadonlyArray<{ ingredientId: string; totalCost: number }>,
  ) {
    let recorded = next;
    for (const line of lines) {
      recorded = appendLedgerEntry(
        recorded,
        "inventory-purchase",
        -line.totalCost,
        line.ingredientId,
      );
    }
    persist(
      recordInventoryPurchase(
        recorded,
        lines.reduce((sum, line) => sum + line.totalCost, 0),
        lines.length,
      ),
    );
  }

  /**
   * Rush Restock (businessRushRestock.ts) — stocks exactly what the current
   * customer's dish is missing, without a trip to the Market. "cash" pays
   * today's Market price + the rush fee and records one "inventory-purchase"
   * entry per ingredient, like purchaseIngredient above. "ad" shows a
   * rewarded ad first and, only when Bridge reports `rewarded`, stocks the
   * same units free (no money moves, so no ledger entry). The ad path reads
   * the save and the current order AFTER the ad, never the pre-ad closure.
   */
  async function rushRestockCurrentOrder(payment: RushRestockPayment): Promise<RushRestockOutcome> {
    const orderId = businessSessionRef.current?.current?.order.id;
    const dishFor = () => {
      const current = businessSessionRef.current?.current;
      return current && current.order.id === orderId
        ? businessDishForRecipeId(current.recipe.id)
        : undefined;
    };
    if (!orderId || !dishFor() || !saveRef.current) return { ok: false, reason: "notBlocked" };
    if (payment === "cash") {
      const result = rushRestock(saveRef.current, dishFor()!, "cash");
      if (!result.ok) return result;
      persistIngredientPurchases(
        result.save,
        result.lines.map((line) => ({
          ingredientId: line.ingredientId,
          totalCost: line.rushTotal,
        })),
      );
      return { ok: true, payment: "cash", totalCost: result.totalCost };
    }
    if (rushAdBusyRef.current) return { ok: false, reason: "busy" };
    rushAdBusyRef.current = true;
    try {
      const ad = await requestRewardedAd(newRushRestockRewardId(), AD_PLACEMENT.rushRestock);
      if (ad.status !== "rewarded") {
        return {
          ok: false,
          reason:
            ad.status === "not-rewarded"
              ? "notRewarded"
              : ad.status === "busy"
                ? "busy"
                : ad.status === "unavailable"
                  ? "adUnavailable"
                  : "adFailed",
        };
      }
      const dish = dishFor();
      const latest = saveRef.current;
      if (!dish || !latest) return { ok: false, reason: "orderChanged" };
      const result = rushRestock(latest, dish, "ad");
      if (!result.ok) return result;
      persist(result.save);
      return { ok: true, payment: "ad", totalCost: 0 };
    } finally {
      rushAdBusyRef.current = false;
    }
  }

  /**
   * Business Supplies — a Market purchase of smallwares, tableware or
   * takeaway packaging, mirroring purchaseRefrigerator: the pure manager
   * decides (all-or-nothing), then ONE ledger entry for its exact cost, the
   * Business P&L record (smallwares/tableware: capital; packaging: a stock
   * asset), and one persist. A failed purchase changes nothing. Business
   * Mode only — Campaign never calls this.
   */
  function purchaseSupply(supplyId: string, packs: number) {
    if (!save) return { ok: false as const, reason: "unknownSupply" as const };
    const item = getSupplyItem(supplyId);
    const result = purchaseSupplyFromCatalog(
      save,
      supplyId,
      packs,
      RESTAURANT_MODE && item && isConsumableSupply(item)
        ? { discount: bulkDiscountFor(packs), maxPacks: BULK_MAX_PACKS }
        : undefined,
    );
    if (result.ok) {
      const packaging = isConsumableSupply(result.item);
      const recorded = appendLedgerEntry(
        result.save,
        packaging ? "supply-packaging-purchase" : "supply-equipment-purchase",
        -result.totalCost,
        result.item.id,
      );
      persist(
        packaging
          ? recordPackagingPurchase(recorded, result.totalCost)
          : recordCapitalExpenditure(recorded, result.totalCost),
      );
    }
    return result;
  }

  /** Inventory → Throw Out Expired (discardExpired.ts): removes only expired stock and records it as waste. No money moves, so no ledger entry. */
  function throwOutExpired() {
    if (!save) return { ok: false as const, reason: "nothingExpired" as const };
    const result = discardExpiredStock(save);
    if (result.ok) persist(result.save);
    return result;
  }

  /** Economy V3 Phase 3 (Refrigerator) — Business Mode's own refrigerator purchase/upgrade action, mirroring purchaseIngredient exactly. Business Mode only — Campaign never calls this. */
  function purchaseRefrigerator(refrigeratorId: string) {
    if (!save) return { ok: false as const, reason: "unknownRefrigerator" as const };
    const result = purchaseRefrigeratorFromCatalog(save, refrigeratorId);
    if (result.ok) {
      persist(
        recordCapitalExpenditure(
          appendLedgerEntry(result.save, "refrigerator-purchase", -result.price, refrigeratorId),
          result.price,
        ),
      );
    }
    return result;
  }

  /** Economy V3 Phase 11 (Maintenance + Breakdowns) — Business Mode's own refrigerator repair action, mirroring purchaseRefrigerator exactly. Business Mode only — Campaign never calls this. */
  function performRefrigeratorMaintenance() {
    if (!save) return { ok: false as const, reason: "alreadyOperational" as const };
    const result = performRefrigeratorMaintenanceFromCatalog(save);
    if (result.ok) {
      persist(
        recordMaintenanceCost(
          appendLedgerEntry(result.save, "refrigerator-maintenance", -result.cost),
          result.cost,
        ),
      );
    }
    return result;
  }

  /** Economy V3 Phase 5 (Menu Pricing) — Business Mode's own menu-price action. No ledger entry: setting a price moves no credits. Business Mode only — Campaign never calls this. */
  function setMenuPrice(recipeId: string, price: number) {
    if (!save) return { ok: false as const, reason: "unknownRecipe" as const };
    const result = setMenuPriceImpl(save, recipeId, price);
    if (result.ok) persist(result.save);
    return result;
  }

  /**
   * Economy V3 Phase 16 (Active Menu) — puts a Business Dish on or off the
   * menu. No ledger entry: it moves no credits. If a waiting (current) or
   * queued (next) order is for a dish that is now OFF the menu, the
   * Business order queue is discarded — exactly like End Business Day
   * already does — so the next "Open the Counter" regenerates it from the
   * active menu only (deterministically, from the same day seed). Nothing
   * is paid or consumed before Serve, so discarding a queue never loses
   * money or stock. Business Mode only — Campaign never calls this.
   */
  function setBusinessDishActive(dishId: string, active: boolean) {
    if (!save) return { ok: false as const, reason: "unknownDish" as const };
    const result = setDishActiveImpl(save, dishId, active);
    if (!result.ok) return result;
    persist(result.save);
    const inactive = result.save.business.menuActivation.inactiveDishIds;
    const queued = [businessServiceSession?.current, businessServiceSession?.next];
    const queuedOffMenu = queued.some((o) => {
      const dish = o ? businessDishForRecipeId(o.recipe.id) : undefined;
      return !!dish && inactive.includes(dish.id);
    });
    if (queuedOffMenu) {
      businessRandRef.current = null;
      setBusinessServiceSession(null);
    }
    return result;
  }

  /** Economy V3 Phase 7 (Supplier Contracts) — signing is free, mirroring Campaign's own selectSupplier ("does not move money"). No ledger entry. Business Mode only — Campaign never calls this. */
  function signSupplierContract(supplierId: string) {
    if (!save) return { ok: false as const, reason: "unknownSupplier" as const };
    const result = signContractImpl(save, supplierId);
    if (result.ok) persist(result.save);
    return result;
  }

  /** Economy V3 Phase 7 (Supplier Contracts) — cancelling early charges the contract's own cancellationFee, recorded through the ledger from the manager's own reported `fee` (appendLedgerEntry no-ops on a 0 fee, so a free contract's cancellation creates no fake entry). Business Mode only — Campaign never calls this. */
  function cancelSupplierContract() {
    if (!save) return { ok: false as const, reason: "noActiveContract" as const };
    const result = cancelContractImpl(save);
    if (result.ok) {
      persist(
        recordSupplierCost(
          appendLedgerEntry(result.save, "supplier-contract-cancellation", -result.fee),
          result.fee,
        ),
      );
    }
    return result;
  }

  /** Economy V3 Phase 9 (Staff) — hiring is free, mirroring signSupplierContract exactly ("does not move money" — the real cost is the daily payroll endBusinessDay deducts). No ledger entry. Business Mode only — Campaign never calls this. */
  function hireStaff(role: string): { ok: boolean } {
    if (!save) return { ok: false };
    // Unified Restaurant: a specialist chef (restaurant/staffRequirements.ts), free to hire.
    if (RESTAURANT_MODE && getSpecialist(role)) {
      const hired = hireSpecialist(save, role, restaurantLevelOf(save.levelProgress));
      if (hired.ok) persist(hired.save);
      return hired;
    }
    const result = hireStaffImpl(save, role);
    if (result.ok) persist(result.save);
    return result;
  }

  /** Economy V3 Phase 9 (Staff) — firing is free (no cancellation-style fee; an employee isn't under a fixed-term contract). No ledger entry. Business Mode only — Campaign never calls this. */
  function fireStaff(role: string): { ok: boolean } {
    if (!save) return { ok: false };
    if (RESTAURANT_MODE && getSpecialist(role)) {
      const next = fireSpecialist(save, role);
      if (next !== save) persist(next);
      return { ok: next !== save };
    }
    const result = fireStaffImpl(save, role);
    if (result.ok) persist(result.save);
    return result;
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
    closingHoldRef.current = false;
    // Unified Restaurant: a service whose stock needs attention opens the
    // Pre-Service Check first (nothing starts until the player does).
    if (RESTAURANT_MODE) {
      const level = getLevel(levelId);
      const firstPlay = !!level && !isCompleted(level.id, save.levelProgress);
      // First levels (firstLevels.ts): before Level 21 a day that's due to
      // close closes quietly (the same closeDay the Closing Time button runs).
      // First levels pass 2: Grandma's leftovers, once (an older save past Level 3 too).
      const base = giveGrandmasLeftovers(quietDayEnd(save));
      // Closing time comes before the next day's first service (the Closing
      // Time sheet shows over the Order Board / Kitchen until it is done).
      if (firstPlay && restaurantDayOf(base).closingDue) {
        closingHoldRef.current = true;
        if (screen !== "board" && screen !== "kitchen") setScreen("board");
        return;
      }
      const pending = level ? servicePlanFor(base, level) : null;
      if (pending && servicePlanNeedsSheet(pending)) {
        if (pending.progress !== base.levelProgress || base !== save)
          persist({ ...base, levelProgress: pending.progress });
        setServiceCheckLevelId(levelId);
        // The check shows over the Order Board / Kitchen (e.g. after "Next Level").
        if (screen !== "board" && screen !== "kitchen") go("board");
        return;
      }
      // No sheet before Level 21: a new day opens without its opening card.
      if (pending?.opening) {
        beginLevel(levelId, openDay(base, pending.levelNumber));
        return;
      }
      if (base !== save) {
        beginLevel(levelId, base);
        return;
      }
    }
    beginLevel(levelId);
  }

  /** Before the day's ceremony starts (Level 21), a day due to close closes without its screen. */
  function quietDayEnd(s: SaveData): SaveData {
    const restaurantLevel = restaurantLevelOf(s.levelProgress);
    return restaurantDayOf(s).closingDue && !dayCeremonyAt(restaurantLevel)
      ? closeDay(s, restaurantLevel)
      : s;
  }

  /** Starts a campaign level (after its Pre-Service Check, when it had one). `from`: the save to build on (e.g. with the day just opened). */
  function beginLevel(levelId: string, from?: SaveData) {
    let base = from ?? save;
    if (!base) return;
    // A new cutting session closes the last level's cards (developer 2026-10-09:
    // they stayed over the board); queued milestone notices wait for the menus.
    setLevelRewardNotice(null);
    setStoryEvent((e) => (e?.kind === "milestone" ? null : e));
    setLateReplayBonus(null);
    const level = getLevel(levelId);
    // Unified Restaurant (phase G): the wash-up before a service — settings
    // left dirty (no soap last time) are washed now if there's soap.
    if (RESTAURANT_MODE && level && !isCompleted(level.id, base.levelProgress))
      base = markStarterCrateSeen(washUp(base, levelNumber(level.id)).save);
    startPlaySession({
      world: `chapter-${level?.chapter ?? 1}`,
      level: String(levelNumber(levelId)),
    });
    persist({ ...base, levelProgress: selectLevel(levelId, base.levelProgress) });
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
    startPlaySession({ world: "todays-special", level: String(levelNumber(level.id)) });
    setSessionMode("daily");
    setActiveLevelId(level.id);
    setScreen("gameplay");
  }

  /** Endless Service's own "Prepare" — same idea as startDaily, drawing from the rotating SERVICE-type pool instead of one daily pick. No-ops (screen stays put) if the pool is empty — the screen itself explains why rather than silently doing nothing. */
  function startEndless() {
    if (!save) return;
    const level = pickEndlessLevel(save.levelProgress, endlessIndex);
    if (!level) return;
    startPlaySession({ world: "endless", level: String(levelNumber(level.id)) });
    setSessionMode("endless");
    setActiveLevelId(level.id);
    setScreen("gameplay");
  }

  /** The one place a Business Service session's seeded rand is created/reused — a fresh generator only when none exists yet for the current session's lifetime (see the `businessRandRef` doc above). */
  function businessRand(): () => number {
    if (!businessRandRef.current) {
      businessRandRef.current = makeSeededRand(
        businessServiceSeedFor(save?.business.calendar.businessDay ?? 0),
      );
    }
    return businessRandRef.current;
  }

  /**
   * Economy V3 Phase 14, Checkpoint 3 — Business Mode's own "Start
   * Service"/"open the counter" entry point, mirroring `startService`
   * exactly: resumes the existing queue if one is already running,
   * otherwise builds a fresh one from the WHOLE curated Business Dish
   * catalog (never level-gated, never TEST_RECIPE_POOL). Navigates to the
   * new `business-service` SCREEN (never straight into "gameplay") — the
   * player reviews the generated order's dish/price/ingredient
   * availability there first (the checkpoint's own explicit "ingredient
   * availability check" gate, before an order can be accepted/started).
   */
  function startBusinessService() {
    if (!save) return;
    // Unified Restaurant: the Business engine runs only as the Endless Restaurant (after L250).
    if (!businessDayAllowed(RESTAURANT_MODE, save.levelProgress)) return;
    // Order frequency: today's queue (resumed past already-served customers
    // after a reload), or none at all once today's customers are complete.
    if (!businessServiceSession) {
      setBusinessServiceSession(businessServiceSessionForToday(save, businessRand()));
    }
    setScreen("business-service");
  }

  /** The "Start Preparing" action on the new BusinessService screen — re-verifies availability (defense in depth against a stale screen render) and only then enters the real, shared Preparation gameplay. Never bypasses Preparation with an instant calculation. */
  function enterBusinessPreparation() {
    if (!save || !businessServiceSession?.current) return;
    if (businessCustomersToday(save).complete) return;
    const dish = businessDishForRecipeId(businessServiceSession.current.recipe.id);
    if (!dish) return;
    if (!businessOrderAvailability(save, dish).available) return;
    // A Business order is its own short level for the Bridge's level messages
    // (no play session: Business interstitials follow the day's end only).
    levelStarted({ world: "business", level: String(save.business.calendar.businessDay) });
    setSessionMode("business-service");
    setScreen("gameplay");
  }

  /**
   * Records a finished Business preparation into the Business order's own
   * session (same deferred-payment rule as recordServiceResult).
   *
   * Economy V3 Phase 16 (player-experience audit, isolation fix): it no
   * longer writes Campaign's `recipeProgress`. A Business dish is played
   * through its SOURCE Campaign recipe (businessServiceCatalog.ts), so the
   * old write marked an unrelated-looking Campaign recipe (e.g. Garlic
   * Chicken -> "camp-fusion2-garlic-3way-a") as Prepared in the Cookbook
   * and set its "previous best" — Business play changing Campaign
   * progression display (CLAUDE.md §10). Business Mode keeps no per-recipe
   * mastery of its own, so nothing is lost for Business.
   */
  function recordBusinessServiceResult(score: number): number {
    if (!save || !businessServiceSession?.current) return 0;
    setBusinessServiceSession((s) => (s ? recordBusinessServiceComponents(s, score) : s));
    levelCompleted();
    return 0;
  }

  /**
   * Endless Restaurant: Today's Special's bonus, at End Business Day — 15 %
   * of the day's restaurant revenue capped at the EXISTING $50
   * (restaurantEvents.todaysSpecialBonus), only when the featured dish was
   * served that day, through the same once-per-calendar-day claim as the
   * classic daily order (hasClaimedToday / claimDaily, one "daily-reward"
   * entry): never twice a day, never a second bonus. Any other day, build or
   * save: unchanged, no bonus.
   */
  function payTodaysSpecial(
    s: SaveData,
    closedDay: number,
    revenue: number,
  ): { save: SaveData; bonus: number } {
    const now = new Date();
    if (
      !RESTAURANT_MODE ||
      !endlessEventsActive(s) ||
      s.business.todaysSpecialServedDay !== closedDay ||
      hasClaimedToday(s.dailyOrder, now)
    )
      return { save: s, bonus: 0 };
    const bonus = todaysSpecialBonus(revenue);
    if (bonus <= 0) return { save: s, bonus: 0 };
    return {
      save: appendLedgerEntry(
        { ...s, credits: s.credits + bonus, dailyOrder: claimDaily(s.dailyOrder, now) },
        "daily-reward",
        bonus,
        "todays-special",
      ),
      bonus,
    };
  }

  /**
   * The Serve action for a Business order — the ONE atomic transaction
   * (BusinessServiceManager.serveBusinessOrder): re-verifies availability,
   * consumes inventory, reads the dish's CURRENT menu price, applies the
   * popularity willingness-to-pay multiplier, pays that customer payment
   * via the existing serveCurrentOrder (pays exactly once), and counts the
   * order toward today's ordersServed — all in the SAME returned save this function
   * persists with exactly one new "business-revenue" ledger entry. Refuses
   * (returns null) on any failure — no partial charge, no partial
   * inventory consumption, matching serveActiveServiceOrder's own
   * "can never pay twice" guarantee.
   */
  function serveActiveBusinessOrder(): {
    coinsAwarded: number;
    reaction: string;
    settlement?: SettlementResult | undefined;
    isReplay?: boolean;
    businessPayment?: BusinessCustomerPayment;
    businessCustomers?: BusinessCustomersToday;
  } | null {
    if (!save || !businessServiceSession) return null;
    const result = serveBusinessOrder(businessServiceSession, save, businessRand());
    if (!result) return null;
    setBusinessServiceSession(result.session);
    const paid = withTodaysSpecialServed(
      appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id),
      result.dish.id,
    );
    persist(paid);
    return {
      coinsAwarded: result.amountCharged,
      reaction: result.reaction,
      businessPayment: result.payment,
      businessCustomers: businessCustomersToday(result.save),
    };
  }

  /** "Next Customer" for a Business order — mirrors advanceServiceQueue exactly, against the Business pool instead. */
  function advanceBusinessServiceQueue() {
    if (!save || !businessServiceSession) return;
    // Order frequency: once today's customers are complete, no next order is
    // generated — the queue closes and the player returns to Service.
    if (businessCustomersToday(save).complete) {
      setBusinessServiceSession(null);
      setSessionMode("campaign");
      setScreen("business-service");
      return;
    }
    const next = advanceBusinessServiceSessionImpl(
      businessServiceSession,
      businessRand(),
      save.business.menuActivation,
      // Endless Restaurant: Today's Special drawn more often (undefined elsewhere).
      endlessFeaturedFor(save),
    );
    setBusinessServiceSession(next);
    // Economy V3 Phase 16 (P2 correctness fix): "Next Customer" must pass
    // the SAME accept-time ingredient gate as "Start Preparing"
    // (enterBusinessPreparation) — previously it remounted Preparation on
    // the new order directly, so a player could play through an order
    // Business Inventory can't fill (Serve would then refuse it). An
    // unavailable next order now goes to the Service screen, which shows
    // exactly what's missing; an available one continues straight into
    // Preparation as before.
    if (nextCustomerDestination(save, next) === "service") {
      setSessionMode("campaign");
      setScreen("business-service");
    }
  }

  /**
   * Phase 3 — the campaign's own "Start Service" for a single Level
   * 1-40 (brief §3): builds a fresh ServiceSession from that level's
   * OWN recipe pool (buildCampaignServiceSession). No-ops if the level
   * has no recipePoolIds (a legacy level should never reach this
   * function — onSelectLevel only calls it after checking) or the pool
   * resolves empty.
   */
  function startCampaignLevel(level: LevelDefinition) {
    if (!save) return;
    if (levelAlreadyPaidInFull(level)) return;
    const session = buildCampaignServiceSession(level, save.levelProgress);
    if (!session) return;
    setCampaignServiceSession(session);
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
    setCampaignServiceSession((s) => (s ? recordAllComponents(s, score) : s));
    return 0;
  }

  /**
   * Mirrors serveActiveServiceOrder, for the campaign session — with
   * Economy V2 settlement replacing the raw per-order payment (§8):
   * one served order = one computeSettlement call, using this order's
   * OWN carried preparation score, never re-derived or double-counted.
   * A replay session (isReplay) settles for a flat 0 — no COGS, no
   * quality bonus, no revenue — while the serve/advance flow itself
   * proceeds completely normally.
   */
  function serveCampaignOrder(): {
    coinsAwarded: number;
    reaction: string;
    settlement?: SettlementResult | undefined;
    isReplay?: boolean;
  } | null {
    if (!campaignServiceSession?.current) return null;
    const { recipe, order } = campaignServiceSession.current;
    // A replay pays nothing, and neither does an order the level no longer
    // owes (its required orders were all paid before — levels/paidOrders.ts).
    const level = getLevel(campaignServiceSession.levelId);
    // Unified Restaurant: an order past the level's own is a menu guest.
    if (
      RESTAURANT_MODE &&
      level &&
      campaignServiceSession.tickets &&
      campaignServiceSession.completedCount >= ordersRequired(level)
    )
      return serveMenuGuestOrder(level, recipe);
    const isReplay =
      campaignServiceSession.isReplay ||
      !save ||
      !level ||
      !mayPayOrder(save.levelProgress, level, recipe.id);
    // Unified Restaurant: from Level 11 the order uses real stock, taken in
    // the same save as its payment; without the stock nothing is served or
    // paid. The pay itself is unchanged (Economy TODO P0).
    const stock =
      RESTAURANT_MODE && save && level
        ? consumeCampaignOrderStock(save, levelNumber(level.id), recipe, !isReplay)
        : null;
    if (stock && !stock.ok) return null;
    // Unified Restaurant (phase G): the order's place setting + napkin, or
    // takeaway packaging, taken automatically (never blocking here).
    const base =
      RESTAURANT_MODE && level && save && !isReplay
        ? takeOrderSupplies(
            stock?.ok ? stock.save : save,
            orderServiceFor(
              levelNumber(level.id),
              paidOrdersFor(save.levelProgress, level.id).length,
            ),
          )
        : stock?.ok
          ? stock.save
          : save;
    // Economy V2 Phase 9 — the full settlement breakdown is kept (not
    // just `.netResult`) so the result UI can show it, but nothing about
    // WHAT gets credited or WHEN changes: `amount` below is still exactly
    // `settlement?.netResult ?? 0`, byte-identical to before this phase.
    const computed = isReplay
      ? undefined
      : computeSettlement(
          recipe,
          campaignServiceSession.chapter ?? 1,
          order.preparationScore ?? 0,
          save?.equippedKnifeId,
          save?.equippedBoardId,
          save ? getKnifeSharpness(save, save.equippedKnifeId) : undefined,
          save?.ownedStaffIds,
          save?.selectedSupplierId,
        );
    // Unified Restaurant (economy pass P0): the food was bought as real stock,
    // so the built-in food cost isn't charged again (restaurantEconomy.ts).
    const settlement =
      computed && RESTAURANT_MODE
        ? restaurantSettlement(computed, save ? restaurantQualityBonusPct(save) : 0, {
            // Final economy pass: a service run on Grandma's goods earns no quality bonus.
            emergency: !!save && !!level && isEmergencyService(save.levelProgress, level.id),
          })
        : computed;
    const amount = settlement?.netResult ?? 0;
    const result = serveCurrentOrder(campaignServiceSession, Math.random, amount);
    if (!result) return null;
    setCampaignServiceSession(result.session);
    // Economy V2 Phase 6 — sharpness decay only ever happens on a
    // genuine (non-replay) serve, mirroring the payout amount's own
    // isReplay gate exactly (brief §11 — replay must never create a
    // persistent sharpness change). Folded into the SAME persist() call
    // as the credit award so both land atomically together.
    if (base && !isReplay) {
      const withCredits = {
        ...base,
        credits: base.credits + result.coinsAwarded,
        levelProgress: withPaidOrder(base.levelProgress, campaignServiceSession.levelId, recipe.id),
      };
      const withLedger = appendLedgerEntry(
        withCredits,
        "campaign-settlement",
        result.coinsAwarded,
        recipe.id,
      );
      persist(applySharpnessDecay(withLedger, base.equippedKnifeId, recipe));
    }
    return { coinsAwarded: result.coinsAwarded, reaction: result.reaction, settlement, isReplay };
  }

  /**
   * Unified Restaurant (phase D): a menu guest pays the dish's menu price
   * through the existing Business payment rule, uses its real stock (from
   * Level 11), and is recorded as restaurant revenue — one ledger entry,
   * the day's P&L, and the guest count saved in the same persist (so a
   * guest is never paid twice). No campaign settlement, reward or
   * paid-order record.
   */
  function serveMenuGuestOrder(level: LevelDefinition, recipe: RecipeDefinition) {
    if (!save || !campaignServiceSession) return null;
    const dish = businessDishForRecipeId(recipe.id);
    if (!dish) return null;
    const stock = consumeCampaignOrderStock(save, levelNumber(level.id), recipe, true, "guest");
    if (!stock.ok) return null;
    // A menu guest eats in (phase G): a place setting and a napkin from L31.
    const withSupplies = takeOrderSupplies(
      stock.save,
      isSystemLive("dine-in", levelNumber(level.id)) ? "dine-in" : null,
    );
    const pays = businessCustomerPayment(stock.save, dish).customerPays;
    const result = serveCurrentOrder(campaignServiceSession, Math.random, pays);
    if (!result) return null;
    setCampaignServiceSession(result.session);
    const paid = recordRevenueAndCogs(
      {
        ...withSupplies,
        credits: withSupplies.credits + result.coinsAwarded,
        levelProgress: withMenuGuestServed(withSupplies.levelProgress, level.id),
      },
      result.coinsAwarded,
      stock.cost,
    );
    persist(appendLedgerEntry(paid, "business-revenue", result.coinsAwarded, dish.id));
    return {
      coinsAwarded: result.coinsAwarded,
      reaction: result.reaction,
      settlement: undefined,
      isReplay: false,
    };
  }

  /** Phase G: from dine-in (L31) a menu guest needs a clean place setting. */
  function guestHasSetting(s: SaveData, level: LevelDefinition): boolean {
    return !isSystemLive("dine-in", levelNumber(level.id)) || cleanSettings(s) > 0;
  }

  /** Unified Restaurant (phase D): brings in the next menu guest as one more ticket of this service. */
  function takeMenuGuest() {
    if (!save || !campaignServiceSession) return;
    const level = getLevel(campaignServiceSession.levelId);
    const guest = level ? nextMenuGuest(save, level) : null;
    if (!guest || !guest.inStock || (level && !guestHasSetting(save, level))) return;
    setCampaignServiceSession((s) =>
      s && s.current?.order.status === "COMPLETED"
        ? advanceServiceSession(withExtraTicket(s, guest.recipe), [], Math.random)
        : s,
    );
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
  /**
   * After a Campaign level finishes (the player pressed Finish Level): a
   * replay may be offered the rewarded Replay Bonus; otherwise this is a
   * natural break for an interstitial. Never both (no stacked ads), and
   * nothing around the Campaign Finale.
   */
  function afterLevelFinished(
    finalSave: SaveData,
    level: LevelDefinition,
    wasReplay: boolean,
    isFinale: boolean,
  ) {
    markPlaySessionCompleted();
    if (isFinale) return;
    const offer = replayBonusOfferFor(
      finalSave,
      level,
      wasReplay,
      rewardedAdsAvailable(),
      new Date(),
    );
    if (offer) {
      setReplayOffer(offer);
      setReplayPhase("OFFER_SHOWN");
      setReplayFailure(null);
      return;
    }
    maybeShowInterstitial(
      `level-finish:${level.id}:${playSessionRef.current.id}`,
      finalSave.levelProgress.completedLevelIds.length,
    );
  }

  /**
   * The Replay Bonus transaction. The reward is committed ONLY after
   * requestRewardedAd resolved exactly `true`, then verified (wallet delta +
   * exactly one ledger entry), saved, and re-read from storage; the sheet
   * shows "Reward Granted" only once the save's ledger contains the entry.
   * Any other outcome changes nothing. A ref (not state) blocks re-entry,
   * so a double tap can never start a second request or a second commit.
   */
  async function watchReplayBonusAd() {
    const offer = replayOffer;
    const current = saveRef.current;
    if (!offer || !current || replayBusyRef.current) return;
    if (isReplayBonusClaimed(current, offer.rewardId)) return;
    replayBusyRef.current = true;
    // A retry after a failed/declined ad asks with a fresh reward id.
    const attempt = replayFailure
      ? { ...offer, rewardId: newReplayBonusRewardId(offer.levelId) }
      : offer;
    if (attempt !== offer) setReplayOffer(attempt);
    const fail = (reason: ReplayBonusFailure) => {
      setReplayFailure(reason);
      setReplayPhase("FAILED");
    };
    setReplayFailure(null);
    setReplayPhase("REQUESTING_AD");
    try {
      const result = await requestRewardedAd(attempt.rewardId);
      if (result.status !== "rewarded") {
        fail(
          result.status === "not-rewarded"
            ? "notRewarded"
            : result.status === "busy"
              ? "busy"
              : result.status === "unavailable"
                ? "adUnavailable"
                : "adFailed",
        );
        return;
      }
      setReplayPhase("REWARD_COMMITTING");
      // Read the authoritative save AFTER the ad — never the pre-ad closure.
      const before = saveRef.current;
      if (!before) return fail("saveFailed");
      const commit = commitReplayBonus(before, attempt, new Date());
      if (!commit.ok) {
        return fail(commit.reason === "invalidAmount" ? "commitMismatch" : commit.reason);
      }
      const next = syncKitchenUpgradeOwnership(commit.save);
      if (!verifyReplayBonusCommit(before, next, attempt)) return fail("commitMismatch");
      try {
        await SaveManager.save(next);
      } catch {
        await SaveManager.save(before).catch(() => undefined);
        return fail("saveFailed");
      }
      const persisted = await SaveManager.readPersisted().catch(() => null);
      const landed =
        !!persisted &&
        persisted.credits === next.credits &&
        persisted.economyLedger.some(
          (e) => e.category === "rewarded-ad" && e.description === attempt.rewardId,
        );
      if (!landed) {
        await SaveManager.save(before).catch(() => undefined);
        return fail("saveFailed");
      }
      saveRef.current = next;
      setSave(next);
      setReplayPhase("REWARD_COMMITTED");
      if (replayOfferRef.current?.rewardId !== attempt.rewardId) setLateReplayBonus(attempt.amount);
    } finally {
      replayBusyRef.current = false;
    }
  }

  function finishCampaignLevel() {
    if (!save || !campaignServiceSession) return;
    const level = getLevel(campaignServiceSession.levelId);
    if (!level) return;
    completeCampaignLevel(level);
    setCampaignServiceSession(null);
    setSessionMode("campaign");
    go("board");
  }

  /**
   * The one completion path for an order-pool or batch-group level (Finish
   * Level, leaving a satisfied level, or a retry of a level whose orders
   * were all paid already): LevelManager.completeLevel + the completion
   * reward + the story flush, folded into one save and one persist().
   */
  function completeCampaignLevel(level: LevelDefinition) {
    if (!save) return;
    // Read before completion clears the level's paid-order record (display only).
    const orderCoins = levelOrderEarnings(save, level.id);
    // Pass 2 (display only): the ingredients this level's served dishes used
    // (its paid orders, read before completion clears them).
    const usedIngredients = requirementsForRecipes(
      paidOrdersFor(save.levelProgress, level.id)
        .map((id) => getCampaignRecipe(id))
        .filter((r): r is RecipeDefinition => !!r),
    ).map((r) => r.ingredientId);
    const {
      progress: levelProgress,
      isFirstCompletion,
      rewardCoins,
    } = completeLevel(level.id, save.levelProgress);
    let nextSave = { ...save, credits: save.credits + rewardCoins, levelProgress };
    // Unified Restaurant: a first completion is one service of the day.
    // Phase G: then the wash-up (dish soap) for the settings it used.
    if (RESTAURANT_MODE && isFirstCompletion)
      nextSave = washUp(recordService(nextSave, levelNumber(level.id)), levelNumber(level.id)).save;
    // First levels: before Level 21 the day closes quietly, and Level Complete says so.
    const dayBefore = restaurantDayOf(nextSave).day;
    if (RESTAURANT_MODE && isFirstCompletion) nextSave = quietDayEnd(nextSave);
    // First levels pass 2: reaching Level 3 brings Grandma's leftovers (once).
    const hadLeftovers = !!nextSave.business.grandmasFridge;
    if (RESTAURANT_MODE && isFirstCompletion) nextSave = giveGrandmasLeftovers(nextSave);
    const leftoversNow = !hadLeftovers && !!nextSave.business.grandmasFridge;
    const newDay =
      restaurantDayOf(nextSave).day !== dayBefore ? restaurantDayOf(nextSave).day : null;
    // Economy V2 Phase 9 — the completion reward is its own real wallet
    // transaction, separate from any order settlement already recorded
    // by serveCampaignOrder (brief §21 — "do not double-record").
    if (rewardCoins > 0)
      nextSave = appendLedgerEntry(nextSave, "completion-reward", rewardCoins, level.id);
    const flush = checkStoryFlush(nextSave);
    const finalSave = flush
      ? flush.kind === "finale"
        ? applyFinaleSeen(nextSave)
        : applyMilestoneFired(nextSave, flush.milestone)
      : nextSave;
    persist(finalSave);
    if (flush) setStoryEvent(flush);
    // Level 1–10 UX pass: a story banner (Level 10's milestone) no longer
    // swallows the reward — the Level Complete notice waits for it to be
    // dismissed (it renders only while no story event is showing).
    if (rewardCoins > 0) {
      // Restaurant build: a first completion can climb the city ranking.
      const moved = RESTAURANT_MODE && isFirstCompletion ? rankChange(save, finalSave) : null;
      const n = levelNumber(level.id);
      const reachedNow = restaurantLevelOf(finalSave.levelProgress);
      const opened =
        RESTAURANT_MODE && isFirstCompletion && reachedNow > restaurantLevelOf(save.levelProgress)
          ? tabsOpeningAt(reachedNow).map((id) => TAB_OPENING_NOTE[id])
          : [];
      const grandma = RESTAURANT_MODE && isFirstCompletion ? grandmaLineFor(n) : null;
      // Pass 2: what this level's dish left in Grandma's fridge, and her leftovers arriving.
      const fridgeNotes =
        RESTAURANT_MODE && isFirstCompletion
          ? [
              ...(earlyStockAt(n) && finalSave.business.grandmasFridge
                ? [fridgeLeftLine(finalSave, usedIngredients)]
                : []),
              ...(leftoversNow ? ["🧺 Grandma's leftovers are in the fridge — free"] : []),
              // Pass 3: the dish's best stars (the engine's grade; never money).
              ...(hasLevelGoals(n) && levelStars(finalSave, level) !== null
                ? [
                    `⭐ Best prep: ${starText(levelStars(finalSave, level)!)}${
                      levelStars(finalSave, level)! > 0
                        ? ` ${STAR_GRADES[levelStars(finalSave, level)! - 1]!.grade}`
                        : ""
                    }`,
                  ]
                : []),
            ].filter((x): x is string => !!x)
          : [];
      setLevelRewardNotice({
        rewardCoins,
        orderCoins,
        ...(grandma ? { grandma } : {}),
        ...(opened.length || fridgeNotes.length ? { opened: [...fridgeNotes, ...opened] } : {}),
        ...(newDay !== null ? { newDay } : {}),
        ...(moved
          ? {
              cityRank: {
                from: moved.from,
                to: moved.to,
                passed: moved.passed.map((r) => `${r.emoji} ${r.name}`).join(", "),
              },
            }
          : {}),
      });
    }
    afterLevelFinished(finalSave, level, !isFirstCompletion, flush?.kind === "finale");
  }

  /**
   * Every order the level needs was served and paid on an earlier try, but
   * the level never completed (the game closed in between): there is
   * nothing left to serve, so it completes now instead of starting a run
   * that could only re-serve paid orders. Returns true when it did.
   */
  function levelAlreadyPaidInFull(level: LevelDefinition): boolean {
    if (!save || isCompleted(level.id, save.levelProgress)) return false;
    if (paidOrdersFor(save.levelProgress, level.id).length < ordersRequired(level)) return false;
    completeCampaignLevel(level);
    setSessionMode("campaign");
    go("board");
    return true;
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
    // Economy V2 replay safety — mirrors startCampaignLevel's own doc
    // exactly, for the batch-group architecture.
    const isReplay = isCompleted(level.id, save.levelProgress);
    if (levelAlreadyPaidInFull(level)) return;
    const fresh = createBatchGroupSession(level.id, recipes, Math.random, level.chapter, isReplay);
    // A retry carries on: customers already served and paid stay served.
    const group = isReplay
      ? fresh
      : withBatchOrdersAlreadyServed(fresh, paidOrdersFor(save.levelProgress, level.id));
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
    setBatchGroupSession((g) => (g ? recordBatchGroupComponents(g, batchViewOrderId, score) : g));
    return 0;
  }

  /**
   * Serves whichever order is currently VIEWED — refuses unless it's
   * genuinely READY (ServiceManager's own guard), same exactly-once
   * payment rule as every other mode. Mirrors serveCampaignOrder's own
   * Economy V2 settlement wiring exactly (§9): one served order = one
   * computeSettlement call, 0 on a replay session, never settled again
   * at finishBatchGroupLevel.
   */
  function serveBatchGroupViewedOrder(): {
    coinsAwarded: number;
    reaction: string;
    settlement?: SettlementResult | undefined;
    isReplay?: boolean;
  } | null {
    if (!batchGroupSession || !batchViewOrderId) return null;
    const viewed = batchGroupSession.orders.find((o) => o.order.id === batchViewOrderId);
    if (!viewed) return null;
    // Mirrors serveCampaignOrder: a replay, or a customer already paid, pays nothing.
    const level = getLevel(batchGroupSession.levelId);
    const isReplay =
      batchGroupSession.isReplay ||
      !save ||
      !level ||
      !mayPayOrder(save.levelProgress, level, viewed.recipe.id);
    // Unified Restaurant: real stock, as serveCampaignOrder.
    const stock =
      RESTAURANT_MODE && save && level
        ? consumeCampaignOrderStock(save, levelNumber(level.id), viewed.recipe, !isReplay)
        : null;
    if (stock && !stock.ok) return null;
    // Unified Restaurant (phase G): supplies, as serveCampaignOrder.
    const base =
      RESTAURANT_MODE && level && save && !isReplay
        ? takeOrderSupplies(
            stock?.ok ? stock.save : save,
            orderServiceFor(
              levelNumber(level.id),
              paidOrdersFor(save.levelProgress, level.id).length,
            ),
          )
        : stock?.ok
          ? stock.save
          : save;
    // Economy V2 Phase 9 — mirrors serveCampaignOrder's own doc exactly:
    // the full breakdown is kept for the result UI, `amount` stays
    // exactly `settlement?.netResult ?? 0`.
    const computed = isReplay
      ? undefined
      : computeSettlement(
          viewed.recipe,
          batchGroupSession.chapter ?? 1,
          viewed.order.preparationScore ?? 0,
          save?.equippedKnifeId,
          save?.equippedBoardId,
          save ? getKnifeSharpness(save, save.equippedKnifeId) : undefined,
          save?.ownedStaffIds,
          save?.selectedSupplierId,
        );
    // Unified Restaurant (economy pass P0): the food was bought as real stock,
    // so the built-in food cost isn't charged again (restaurantEconomy.ts).
    const settlement =
      computed && RESTAURANT_MODE
        ? restaurantSettlement(computed, save ? restaurantQualityBonusPct(save) : 0, {
            // Final economy pass: a service run on Grandma's goods earns no quality bonus.
            emergency: !!save && !!level && isEmergencyService(save.levelProgress, level.id),
          })
        : computed;
    const amount = settlement?.netResult ?? 0;
    const result = serveBatchGroupOrder(batchGroupSession, batchViewOrderId, Math.random, amount);
    if (!result) return null;
    setBatchGroupSession(result.group);
    // Economy V2 Phase 6 — mirrors serveCampaignOrder's own doc exactly.
    if (base && !isReplay) {
      const withCredits = {
        ...base,
        credits: base.credits + result.coinsAwarded,
        levelProgress: withPaidOrder(
          base.levelProgress,
          batchGroupSession.levelId,
          viewed.recipe.id,
        ),
      };
      const withLedger = appendLedgerEntry(
        withCredits,
        "campaign-settlement",
        result.coinsAwarded,
        viewed.recipe.id,
      );
      persist(applySharpnessDecay(withLedger, base.equippedKnifeId, viewed.recipe));
    }
    return { coinsAwarded: result.coinsAwarded, reaction: result.reaction, settlement, isReplay };
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
    completeCampaignLevel(level);
    setBatchGroupSession(null);
    setBatchViewOrderId(null);
    setSessionMode("campaign");
    go("board");
  }

  /**
   * The finale's last beat is "BACK TO THE KITCHEN", so it ends on the
   * Kitchen home screen. Every path that plays the finale has already
   * paid and saved the level (and skips its interstitial), so leaving the
   * finished preparation or the Order Board here loses nothing; the level
   * is closed like any other exit.
   */
  function finishFinale() {
    setStoryEvent(null);
    levelAbandoned();
    setSessionMode("campaign");
    go("kitchen");
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
    const { progress: levelProgress, isFirstCompletion } = completeLevel(
      activeLevel.id,
      save.levelProgress,
    );
    // Economy V2 (§7) — a plain Single level has no separate serve step
    // (unlike order-pool/batch-group), so its ONE existing payment (this
    // level's flat reward.coins, on first completion only) IS the
    // "recipe revenue component" the design doc means to replace: same
    // first-completion gate as before, just computeSettlement's netResult
    // in place of the flat reward number. 0 on replay, exactly like
    // before. NOTE: no shipped campaign level currently reaches this
    // code path (every one of the 250 levels declares recipePoolIds or
    // batchGroupRecipeIds — see the final report) — kept correct for
    // whichever future level does.
    const recipe = getCampaignRecipe(recipeId);
    const payout =
      isFirstCompletion && recipe
        ? computeSettlement(
            recipe,
            activeLevel.chapter,
            score,
            save.equippedKnifeId,
            save.equippedBoardId,
            getKnifeSharpness(save, save.equippedKnifeId),
            save.ownedStaffIds,
            save.selectedSupplierId,
          ).netResult
        : 0;
    let nextSave = {
      ...save,
      credits: save.credits + payout,
      recipeProgress,
      levelProgress,
    };
    // Economy V2 Phase 9 — this path's ONE payout IS the settlement (see
    // this function's own doc above: no separate completion-reward
    // concept here), so exactly one ledger entry, never two.
    if (isFirstCompletion && recipe && payout > 0) {
      nextSave = appendLedgerEntry(nextSave, "campaign-settlement", payout, recipe.id);
    }
    // Economy V2 Phase 6 — sharpness decay only on a genuine first
    // completion (never replay), mirroring serveCampaignOrder's own doc.
    if (isFirstCompletion && recipe) {
      nextSave = applySharpnessDecay(nextSave, save.equippedKnifeId, recipe);
    }
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
    markPlaySessionCompleted();
    return payout;
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
    markPlaySessionCompleted();
    const recipeId = activeLevel.recipeId;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };
    const now = new Date();
    const alreadyClaimed = hasClaimedToday(save.dailyOrder, now);
    const bonus = alreadyClaimed ? 0 : DAILY_ORDER_BONUS_COINS;
    const dailyOrder = alreadyClaimed ? save.dailyOrder : claimDaily(save.dailyOrder, now);
    const nextSave = appendLedgerEntry(
      { ...save, recipeProgress, dailyOrder, credits: save.credits + bonus },
      "daily-reward",
      bonus,
      recipeId,
    );
    persist(nextSave);
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
    markPlaySessionCompleted();
    const recipeId = activeLevel.recipeId;
    const prior = save.recipeProgress[recipeId];
    const best = Math.max(prior?.best ?? 0, score);
    const recipeProgress = { ...save.recipeProgress, [recipeId]: { best, done: true } };
    const { earned, endless } = applyEndlessEarn(
      save.endless,
      paidLevelReward(activeLevel),
      new Date(),
    );
    const nextSave = appendLedgerEntry(
      { ...save, recipeProgress, endless, credits: save.credits + earned },
      "endless-revenue",
      earned,
      recipeId,
    );
    persist(nextSave);
    setEndlessIndex((i) => i + 1);
    return earned;
  }

  // Once the first screen is up, fetch the Preparation/Phaser chunk in the
  // background so opening a level is instant (see lazyPreparation.ts).
  const saveLoaded = save !== null;
  useEffect(() => {
    if (!saveLoaded) return;
    // An idle slot, but never later than 500 ms: on a slow phone the Kitchen's
    // animations can keep the main thread "busy" long enough that a plain
    // idle callback starts the download too late for a quick first tap.
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (idle) idle(preloadPreparation, { timeout: 500 });
    else setTimeout(preloadPreparation, 200);
  }, [saveLoaded]);

  if (!save) {
    return (
      <GameShell>
        <LoadingScreen />
      </GameShell>
    );
  }

  // Blacksmith upgrades ride along on the knife Preparation plays with (blacksmith.effectiveKnife — the catalog knife itself when un-upgraded).
  const equippedKnife = effectiveKnife(save, knifeOrDefault(save.equippedKnifeId));
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
  // Beginner coaching (coaching.ts) runs only in a campaign level being
  // played for the first time — never on a replay, Today's Special, Endless,
  // Restaurant Service or Business.
  const coachLevelId =
    (isCampaignService || isBatchGroup || sessionMode === "campaign") &&
    save &&
    !save.levelProgress.completedLevelIds.includes(activeLevel.id)
      ? activeLevel.id
      : undefined;
  const isBusinessService = sessionMode === "business-service";
  const activeServiceSession = isCampaignService
    ? campaignServiceSession
    : isBusinessService
      ? businessServiceSession
      : null;
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
    isCampaignService || isBusinessService
      ? (activeServiceSession?.current ?? null)
      : viewedBatchOrder && batchGroupSession
        ? { ...viewedBatchOrder, session: batchGroupSession.session }
        : null;
  const showServicePrep = screen === "gameplay" && !!currentServiceOrder;
  // Pass 3 (restaurant build, Levels 1–15): the dish's goal, best stars and the
  // customer's own line, from the recipe and the save's best score (levelGoals.ts).
  const guideLevel =
    RESTAURANT_MODE && isCampaignService && campaignServiceSession
      ? levelNumber(campaignServiceSession.levelId)
      : 0;
  const levelGuide =
    currentServiceOrder && hasLevelGoals(guideLevel)
      ? {
          goal: goalFor(currentServiceOrder.recipe),
          graded: isGraded(currentServiceOrder.recipe),
          bestStars:
            typeof save?.recipeProgress[currentServiceOrder.recipe.id]?.best === "number"
              ? starsForScore(save.recipeProgress[currentServiceOrder.recipe.id]!.best!)
              : null,
          customerLine: customerLineFor(currentServiceOrder.recipe),
        }
      : null;
  const showCampaignPrep =
    screen === "gameplay" &&
    sessionMode !== "campaign-service" &&
    sessionMode !== "batch-group" &&
    sessionMode !== "business-service";
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
  // The level's required orders have ACTUALLY been served and paid (the
  // current order counts once serveCurrentOrder moved it to COMPLETED) —
  // what decides whether leaving the level finishes it (G1).
  // Unified Restaurant (phase D): once the level's own orders are served, a
  // menu guest can be taken (optional; Finish Level stays).
  const menuGuest =
    RESTAURANT_MODE &&
    save &&
    isCampaignService &&
    campaignServiceSession?.tickets &&
    campaignLevelForSession &&
    campaignServiceSession.current?.order.status === "COMPLETED" &&
    campaignWillFinishNext
      ? nextMenuGuest(save, campaignLevelForSession)
      : null;
  const campaignLevelSatisfied =
    isCampaignService && campaignServiceSession
      ? campaignServiceSession.completedCount +
          (campaignServiceSession.current?.order.status === "COMPLETED" ? 1 : 0) >=
        (campaignLevelForSession?.requiredOrders ?? 1)
      : false;

  return (
    <GameShell
      aside={
        <div className="hidden max-w-[260px] text-right md:block">
          <p className="font-hand text-[26px] leading-tight text-[color:var(--color-gold)]">
            KnifeCraft
          </p>
          <p className="mt-2 font-ui text-[12.5px] leading-relaxed text-[color:var(--color-cream)]/60">
            A cozy prep-chef arcade. Portrait-first, one thumb, no timers. Swipe across the tomato
            to begin.
          </p>
        </div>
      }
    >
      {/* Preparation is a lazy chunk (lazyPreparation.ts) — normally already
          preloaded by the time a level opens, so this fallback rarely shows. */}
      <Suspense fallback={<LoadingScreen />}>
        {showServicePrep && currentServiceOrder ? (
          <Preparation
            // Remounts for a new order the same way the campaign branch
            // remounts for a new level: the key changes ("Next Customer"
            // -> advance -> a genuinely different order id), so
            // Preparation's internal phase/step state always starts fresh
            // for the new customer.
            key={currentServiceOrder.order.id}
            {...(coachLevelId ? { coachLevelId } : {})}
            {...(levelGuide ? { levelGuide } : {})}
            service={{
              order: currentServiceOrder,
              onServe: isCampaignService
                ? serveCampaignOrder
                : isBatchGroup
                  ? serveBatchGroupViewedOrder
                  : serveActiveBusinessOrder,
              onNextOrder: isCampaignService
                ? campaignWillFinishNext
                  ? finishCampaignLevel
                  : advanceCampaignQueue
                : isBatchGroup
                  ? advanceBatchGroupView
                  : advanceBusinessServiceQueue,
              ...(isBusinessService ? { isBusinessOrder: true } : {}),
              ...(menuGuest
                ? {
                    extraAction: !guestHasSetting(save, campaignLevelForSession!)
                      ? {
                          label: `Menu guest wants ${menuGuest.dish.name} — no clean place setting`,
                          onClick: () => {},
                          disabled: true,
                        }
                      : menuGuest.inStock
                        ? {
                            label: `🍽️ Menu guest ${menuGuest.number}/${menuGuest.total}: ${menuGuest.dish.name} · ${formatUsd(menuGuest.pays)}`,
                            onClick: takeMenuGuest,
                          }
                        : {
                            label: `Menu guest wants ${menuGuest.dish.name} — not in stock`,
                            onClick: () => {},
                            disabled: true,
                          },
                  }
                : {}),
              ...((isCampaignService && campaignWillFinishNext) ||
              (isBatchGroup && batchGroupWillFinish)
                ? { nextLabel: "Finish Level" }
                : {}),
              ...(activeServiceSession ? { batchHint: batchHintFor(activeServiceSession) } : {}),
              ...(isBatchGroup && batchGroupSession && batchViewOrderId
                ? { batchHint: batchHintForGroup(batchGroupSession, batchViewOrderId) }
                : {}),
              // Economy V2 Phase 9 — display-only identity for the
              // settlement breakdown (ServiceOrderComplete resolves these
              // to catalog names itself, exactly like Shop.tsx already
              // does — never a computed economic value). Omitted entirely
              // for a plain Restaurant Service order (isCampaignService/
              // isBatchGroup both false), which never computes a
              // settlement in the first place.
              ...(isCampaignService || isBatchGroup
                ? {
                    selectedSupplierId: save.selectedSupplierId,
                    ownedStaffIds: save.ownedStaffIds,
                    knifeSharpnessValue: getKnifeSharpness(save, save.equippedKnifeId),
                  }
                : {}),
            }}
            onExit={() => {
              // Leaving a campaign level whose required orders are already
              // served and paid completes it through the same path as
              // "Finish Level" — otherwise the level stays unfinished and a
              // retry would settle its orders again as a first play.
              if (campaignLevelSatisfied) {
                finishCampaignLevel();
                return;
              }
              if (batchGroupWillFinish) {
                finishBatchGroupLevel();
                return;
              }
              setSessionMode("campaign");
              go(isBusinessService ? "business-service" : "board");
            }}
            onComplete={
              isCampaignService
                ? recordCampaignServiceResult
                : isBatchGroup
                  ? recordBatchGroupResult
                  : recordBusinessServiceResult
            }
            credits={save.credits}
            previousBest={
              // Business orders don't read or write Campaign recipe progress (V3-16 isolation fix).
              isBusinessService
                ? 0
                : (save.recipeProgress[currentServiceOrder.recipe.id]?.best ?? 0)
            }
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
            {...(coachLevelId ? { coachLevelId } : {})}
            onExit={() => {
              // Leaving an unfinished level closes it without a level message.
              levelAbandoned();
              // A finished session (never a mid-level quit) is a natural break.
              if (playSessionRef.current.completed) {
                maybeShowInterstitial(
                  `${sessionMode === "campaign" ? "level-finish" : `${sessionMode}-exit`}:${activeLevel.id}:${playSessionRef.current.id}`,
                  save.levelProgress.completedLevelIds.length,
                );
              }
              setSessionMode("campaign");
              go(sessionExitScreen);
            }}
            onComplete={sessionOnComplete}
            credits={save.credits}
            previousBest={previousBest}
            knife={equippedKnife}
            board={equippedBoard}
            {...(nextLevel
              ? {
                  nextLevel,
                  onNextLevel: () => {
                    if (playSessionRef.current.completed) {
                      maybeShowInterstitial(
                        `level-finish:${activeLevel.id}:${playSessionRef.current.id}`,
                        save.levelProgress.completedLevelIds.length,
                      );
                    }
                    onSelectLevel(nextLevel.id);
                  },
                }
              : {})}
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
              sharpenKnife={sharpenKnife}
              upgradeKnife={upgradeKnife}
              buyStaff={buyStaff}
              selectSupplier={selectSupplier}
              setEquippedKnife={setEquippedKnife}
              setEquippedBoard={setEquippedBoard}
              toggleSetting={toggleSetting}
              setMeasure={setMeasure}
              resetProgress={resetProgress}
              advanceBusinessDay={advanceBusinessDay}
              purchaseIngredient={purchaseIngredient}
              purchaseIngredients={purchaseIngredients}
              purchaseSupply={purchaseSupply}
              purchaseRefrigerator={purchaseRefrigerator}
              throwOutExpired={throwOutExpired}
              performRefrigeratorMaintenance={performRefrigeratorMaintenance}
              rushRestock={rushRestockCurrentOrder}
              buildKitchenUpgrade={buildKitchenUpgrade}
              rushAdAvailable={rewardedAdsAvailable()}
              setMenuPrice={setMenuPrice}
              setBusinessDishActive={setBusinessDishActive}
              signSupplierContract={signSupplierContract}
              cancelSupplierContract={cancelSupplierContract}
              hireStaff={hireStaff}
              fireStaff={fireStaff}
              businessServiceSession={businessServiceSession}
              onStartBusinessService={startBusinessService}
              onEnterBusinessPreparation={enterBusinessPreparation}
            />
          </Suspense>
        )}
      </Suspense>
      {RESTAURANT_MODE &&
      save &&
      restaurantDayOf(save).closingDue &&
      dayCeremonyAt(restaurantLevelOf(save.levelProgress)) &&
      (screen === "board" || screen === "kitchen") &&
      storyEvent?.kind !== "finale" ? (
        <Suspense fallback={null}>
          <ClosingTime
            save={save}
            restaurantLevel={restaurantLevelOf(save.levelProgress)}
            onClose={() => {
              closingHoldRef.current = false;
              persist(closeDay(save, restaurantLevelOf(save.levelProgress)));
            }}
          />
        </Suspense>
      ) : null}
      {RESTAURANT_MODE && serviceCheckLevelId && save ? (
        <Suspense fallback={null}>
          <ServiceCheckLayer
            save={save}
            levelId={serviceCheckLevelId}
            screen={screen}
            go={go}
            onStart={(opensDay) => {
              const id = serviceCheckLevelId;
              setServiceCheckLevelId(null);
              beginLevel(id, opensDay ? openDay(save, levelNumber(id)) : undefined);
            }}
            onClose={() => setServiceCheckLevelId(null)}
            onThrowOutExpired={() => void throwOutExpired()}
            onUsePantry={(next) => persist(next)}
            onQuickRestock={(next, lines) =>
              persistIngredientPurchases(
                next,
                lines
                  // A line too small to cost a cent moves no money, so it has no entry.
                  .filter((l) => l.cost > 0)
                  .map((l) => ({ ingredientId: l.ingredientId, totalCost: l.cost })),
              )
            }
          />
        </Suspense>
      ) : null}
      {showIntro ? <CinematicIntro onDone={completeIntro} /> : null}
      {storyEvent?.kind === "finale" ? (
        <StoryOverlay sequence={FINALE} onDone={finishFinale} />
      ) : null}
      {storyEvent?.kind === "milestone" ? (
        <MilestoneBanner
          kicker={storyEvent.milestone.kicker}
          line={storyEvent.milestone.line}
          // First levels (firstLevels.ts): Level 10's milestone is the big moment —
          // what the Market now offers (never required) and what comes next.
          {...(RESTAURANT_MODE && storyEvent.milestone.bit === 1
            ? { grand: true, rows: firstPurchaseRows(), ms: 9000 }
            : {})}
          onDismiss={() => setStoryEvent(null)}
        />
      ) : null}
      {levelRewardNotice && !storyEvent ? (
        <MilestoneBanner
          kicker="Level Complete"
          line={`${formatUsdChange(levelRewardNotice.rewardCoins)} Completion Reward`}
          {...(levelRewardNotice.orderCoins || levelRewardNotice.cityRank
            ? {
                rows: [
                  ...(levelRewardNotice.orderCoins
                    ? [
                        {
                          label: "Order payout",
                          value: formatUsdChange(levelRewardNotice.orderCoins),
                        },
                        {
                          label: "Completion reward",
                          value: formatUsdChange(levelRewardNotice.rewardCoins),
                        },
                        {
                          label: "Earned this level",
                          value: formatUsdChange(
                            levelRewardNotice.orderCoins + levelRewardNotice.rewardCoins,
                          ),
                          strong: true,
                        },
                      ]
                    : []),
                  ...(levelRewardNotice.cityRank
                    ? [
                        {
                          label: "🏆 City ranking",
                          value: `#${levelRewardNotice.cityRank.from} → #${levelRewardNotice.cityRank.to}`,
                          strong: true,
                        },
                        { label: "Passed", value: levelRewardNotice.cityRank.passed },
                      ]
                    : []),
                ],
                ms: 5600,
              }
            : {})}
          {...(levelRewardNotice.opened || levelRewardNotice.newDay
            ? {
                notes: [
                  ...(levelRewardNotice.opened ?? []),
                  ...(levelRewardNotice.newDay
                    ? [`☀️ Day ${levelRewardNotice.newDay} begins`]
                    : []),
                ],
              }
            : {})}
          {...(levelRewardNotice.grandma ? { quote: levelRewardNotice.grandma, ms: 6400 } : {})}
          onDismiss={() => setLevelRewardNotice(null)}
        />
      ) : null}
      {replayOffer ? (
        <ReplayBonusSheet
          amount={replayOffer.amount}
          phase={replayPhase}
          failure={replayFailure}
          claimed={isReplayBonusClaimed(save, replayOffer.rewardId)}
          leftToday={replayBonusesLeftToday(save, new Date())}
          onWatch={() => void watchReplayBonusAd()}
          canClose={!adActive}
          onClose={() => {
            // Closable unless an ad is on screen. If the platform's answer is still
            // pending (the dead-request guard lifted the screen block), the game
            // keeps listening: a late `true` is still committed and confirmed.
            if (adActive) return;
            setReplayOffer(null);
          }}
        />
      ) : null}
      {lateReplayBonus !== null ? (
        <MilestoneBanner
          kicker="Reward Granted"
          line={`${formatUsdChange(lateReplayBonus)} Replay Bonus`}
          onDismiss={() => setLateReplayBonus(null)}
        />
      ) : null}
      {adActive ? <AdPlayingShield /> : null}
      {milestoneNoticeQueue[0] &&
      !storyEvent &&
      !levelRewardNotice &&
      !showIntro &&
      screen !== "gameplay" ? (
        <MilestoneBanner
          key={milestoneNoticeQueue[0].id}
          kicker={milestoneNoticeQueue[0].legacy ? "🏆 Campaign Complete" : "Milestone reached"}
          line={milestoneNoticeQueue[0].label}
          onDismiss={() => setMilestoneNoticeQueue((q) => q.slice(1))}
        />
      ) : null}
      {businessNoticeQueue[0] && inBusiness && !storyEvent && !levelRewardNotice ? (
        <MilestoneBanner
          key={businessNoticeQueue[0].key}
          kicker={businessNoticeQueue[0].title}
          line={businessNoticeQueue[0].detail.split(". ")[0]!.replace(/\.$/, "") + "."}
          onDismiss={() => setBusinessNoticeQueue((q) => q.slice(1))}
        />
      ) : null}
    </GameShell>
  );
}
