import { useEffect, useRef, useState } from "react";
import { paidLevelReward } from "@/game/levels/levelRewards";
import { GameBridge, type GameBridgeEvent } from "@/game/GameBridge";
import { PauseManager } from "@/game/PauseManager";
import { gameReady } from "@/game/PlayablesSDK";
import {
  INGREDIENTS,
  TECHNIQUES,
  requiredCutsFor,
  type IngredientId,
  type TechniqueId,
} from "@/game/definitions";
import { knifeOrDefault, DEFAULT_KNIFE_ID } from "@/game/knives/knifeDefinitions";
import type { KnifeDefinition } from "@/game/knives/knifeTypes";
import { boardOrDefault, DEFAULT_BOARD_ID } from "@/game/boards/boardDefinitions";
import type { BoardDefinition } from "@/game/boards/boardTypes";
import type { PrepStep } from "@/game/events";
import type { CutPath, CutResult, GameplayPhase, QualityLabel } from "@/types/game";
import type { LevelDefinition } from "@/game/levels/levelTypes";
import type { ServiceOrder } from "@/game/service/ServiceManager";
import type { SettlementResult } from "@/game/economy/economyTypes";
import type {
  BusinessCustomerPayment,
  BusinessCustomersToday,
} from "@/game/business/BusinessServiceManager";
import { preparationStepsForRecipe } from "@/game/service/stepsForRecipe";
import { GameViewport } from "./GameViewport";
import { GameHUD } from "./GameHUD";
import { CutResultPanel } from "./CutResultPanel";
import { KnifeReport } from "./KnifeReport";
import { CookingClip } from "./CookingClip";
import { OrderComplete } from "./OrderComplete";
import { ServiceOrderComplete } from "./ServiceOrderComplete";
import { Panel, KButton, DustMotes } from "../common/primitives";
import { dollars } from "@/game/money";
import { withRequiredPeelSteps } from "@/game/prepStepGuards";
import type { PreparationStep } from "@/game/levels/levelTypes";
import kitchenBg from "@/assets/kitchen-bg.jpg";

/** Inserts any Peel step a must-peel ingredient is missing, so no session can soft-lock (see prepStepGuards.ts). The HUD and the scene both index this same list. */
function completableSteps(steps: readonly PreparationStep[]): PreparationStep[] {
  return withRequiredPeelSteps(
    steps,
    (s) => ({
      ingredient: s.ingredient,
      technique: s.technique,
      ...(s.chainBreak ? { chainBreak: true } : {}),
    }),
    (s) => ({ ...s, technique: "peel", resultingState: "peeled" }),
    ({ chainBreak: _drop, ...s }) => ({ ...s, startingState: "peeled" }),
  );
}

/**
 * Preparation now consumes a LevelDefinition directly rather than a flat
 * PrepOrder (§"make sure the Level Engine is actually consuming level
 * data rather than the old flat PrepOrder flow") — `level.preparationSteps`
 * IS the session's gameplay data, handed straight to GameBridge as
 * `steps` (the old flat PrepOrder mock data has since been deleted).
 *
 * Phase 2 (restaurant-service loop) — `level` becomes optional and a new
 * `service` prop bundle takes over display/steps/completion when
 * present, so a single Preparation session can be driven by either a
 * campaign LevelDefinition OR an active restaurant ServiceOrder without
 * PreparationScene/GameBridge (the actual cutting engine) knowing or
 * caring which — both ultimately resolve to the exact same
 * PreparationStep[]/PrepStep[] shapes (see stepsForRecipe.ts). Exactly
 * one of `level`/`service` is provided by the caller (App.tsx); this
 * component never renders both.
 */
export function Preparation({
  level,
  service,
  onExit,
  onComplete,
  credits,
  previousBest,
  knife = knifeOrDefault(DEFAULT_KNIFE_ID),
  board = boardOrDefault(DEFAULT_BOARD_ID),
  nextLevel,
  onNextLevel,
}: {
  level?: LevelDefinition;
  /** Present only for a restaurant-service session (App.tsx's sessionMode === "service") — see ServiceManager.ts for the state machine behind it. */
  service?: {
    order: ServiceOrder;
    /** §17/§18 — the Serve action; returns null if the order somehow isn't READY (defensive only). Economy V2 Phase 9 — `settlement`/`isReplay` are present for a campaign/batch-group serve (never for plain Restaurant Service, which never computes a settlement) so ServiceOrderComplete can show the real breakdown without recalculating anything. */
    onServe: () => {
      coinsAwarded: number;
      reaction: string;
      settlement?: SettlementResult | undefined;
      isReplay?: boolean;
      businessPayment?: BusinessCustomerPayment;
      businessCustomers?: BusinessCustomersToday;
    } | null;
    /** §20 — advances the queue (or finishes a campaign level — see `nextLabel`) and remounts Preparation for the new current order. */
    onNextOrder: () => void;
    /** Phase 3 §16 — a one-sentence batching hint ("Batch tip: ...") when the active and next order share a real component; null otherwise. Presentation only, never gameplay-affecting. */
    batchHint?: string | null;
    /** Label for ServiceOrderComplete's advance button — defaults to "Next Customer"; a campaign level about to complete passes "Finish Level" instead (App.tsx decides which, based on ServiceSession.completedCount vs the level's own requiredOrders). */
    nextLabel?: string;
    /** Economy V2 Phase 9 — display-only identity for the settlement breakdown (App.tsx passes the raw save fields; ServiceOrderComplete resolves them to catalog names itself, exactly like Shop.tsx already does). Omitted for plain Restaurant Service. */
    selectedSupplierId?: string;
    ownedStaffIds?: readonly string[];
    knifeSharpnessValue?: number;
    /** Economy V3 Phase 14, Checkpoint 3 — true only for a Business Mode order; forwarded to ServiceOrderComplete so its payment/running-total displays real USD instead of Kitchen Coins. Absent (falsy) for every other service kind. */
    isBusinessOrder?: boolean;
  };
  onExit: () => void;
  /** Returns this run's coin reward (0 on replay — Law 2 — or always 0 for a service session, where payment is deferred to the explicit Serve action) so OrderComplete can show it without a second App->Preparation round trip. */
  onComplete: (score: number) => number;
  credits: number;
  previousBest: number;
  knife?: KnifeDefinition;
  board?: BoardDefinition;
  /** The next campaign level, only when it exists AND is already unlocked — App.tsx computes this once per render, mirroring how `previousBest` is already passed down instead of looked up in here. Never set for a service session. */
  nextLevel?: LevelDefinition | null;
  onNextLevel?: () => void;
}) {
  // The single source of "what does this session look like" — a real
  // level's own fields, or the equivalent ones derived from the active
  // recipe (recipeId doubles as SaveData.recipeProgress's key either
  // way, so mastery/Cookbook tracking works identically for both — see
  // ServiceManager/App.tsx's recordServiceResult).
  const view = service
    ? {
        recipeId: service.order.recipe.id,
        title: service.order.recipe.name,
        subtitle: service.order.recipe.chefInstruction,
        emoji: service.order.recipe.emoji,
        // The order's OWN pay (computed once at order-creation time via
        // recipePay(recipe, chapter) — see CustomerOrderManager.ts), not
        // recipe.basePayment's static per-chapter-agnostic snapshot,
        // which would show the wrong number for a reused recipe (v2
        // §2.2/§3.4 — pay depends on which chapter serves it).
        rewardCoins: service.order.order.basePayment,
        preparationSteps: completableSteps(preparationStepsForRecipe(service.order.recipe)),
      }
    : {
        recipeId: level!.recipeId,
        title: level!.title,
        subtitle: level!.subtitle,
        emoji: level!.emoji,
        rewardCoins: paidLevelReward(level!),
        preparationSteps: completableSteps(level!.preparationSteps),
      };
  const steps: PrepStep[] = view.preparationSteps.map((s) => ({
    ingredientId: s.ingredient,
    techniqueId: s.technique,
    ...(s.chainBreak ? { chainBreak: true } : {}),
    ...(s.destination ? { destination: s.destination } : {}),
  }));
  const firstStep = steps[0]!;

  const bridgeRef = useRef<GameBridge | null>(null);
  if (!bridgeRef.current) bridgeRef.current = new GameBridge();
  const bridge = bridgeRef.current;

  // Phase 4 (real batching, §4/§9) — an order a batch group already
  // satisfied via a SHARED PreparedOutput arrives here already READY
  // (recordBatchGroupComponents ran when the OTHER order was cut, never
  // this one). Starting straight at "complete" shows the Serve screen
  // immediately — the player is never asked to cut the same thing
  // twice. `result`/`onComplete` simply never fire for this order (see
  // the `awarded` effect below, guarded on `!result`), which is
  // correct: nothing new was actually cut this run.
  const [phase, setPhase] = useState<GameplayPhase>(
    service?.order.order.status === "READY" ? "complete" : "prep",
  );
  // The CURRENTLY ACTIVE step's ingredient/technique — updated on every
  // STEP_STARTED, defaulting to the session's first step so the HUD is
  // correct from the very first frame (before the scene has even booted).
  const [activeStep, setActiveStep] = useState<{
    index: number;
    ingredientId: IngredientId;
    techniqueId: TechniqueId;
    requiredCuts: number;
  }>({
    index: 0,
    ingredientId: firstStep.ingredientId,
    techniqueId: firstStep.techniqueId,
    requiredCuts: requiredCutsFor(TECHNIQUES[firstStep.techniqueId]),
  });
  const [cutProgress, setCutProgress] = useState(0);
  const [progressByAxis, setProgressByAxis] = useState({ h: 0, v: 0 });
  const [currentCutQuality, setCurrentCutQuality] = useState<QualityLabel | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<CutResult | null>(null);
  const [rewardCoins, setRewardCoins] = useState(0);
  // The cooking film after every dish: "off", buffering while the plate is
  // plated ("ready"), then "playing" once the hands have taken it away.
  const [cooking, setCooking] = useState<"off" | "ready" | "playing">("off");

  const idealPaths = useRef<CutPath[]>([]);
  const playerPaths = useRef<CutPath[]>([]);

  useEffect(() => {
    bridge.startPreparation({ steps, knife, board });

    // Fallback only — if Phaser somehow never boots (no WebGL/canvas2d,
    // an uncaught error inside the scene, ...), gameReady() still fires
    // so YouTube doesn't consider the game permanently stuck loading.
    // markReady() is idempotent; whichever path reaches it first wins.
    let readyFired = false;
    const markReady = () => {
      if (readyFired) return;
      readyFired = true;
      gameReady();
    };
    const readyFallback = window.setTimeout(markReady, 4000);

    const unsubscribe = bridge.subscribeToGameEvents((event: GameBridgeEvent) => {
      if (event.type === "SCENE_READY") {
        // The Prep screen is the game's first screen, so "Phaser has
        // booted and is accepting input" is the true "interactive"
        // signal (§22) — not merely "the save file resolved".
        window.clearTimeout(readyFallback);
        markReady();
      } else if (event.type === "CUT_STARTED") {
        setShowHint(false);
      } else if (event.type === "STEP_STARTED") {
        const { stepIndex, ingredientId, techniqueId, requiredCuts } = event.payload;
        setActiveStep({ index: stepIndex, ingredientId, techniqueId, requiredCuts });
        setCutProgress(0);
        setProgressByAxis({ h: 0, v: 0 });
      } else if (event.type === "CUT_COMPLETED") {
        // Audio/particles/hitstop for the cut itself are triggered by the
        // scene directly (they're gameplay feedback, not UI) — this only
        // drives the transient toast and the HUD's progress dots.
        const { ideal, player, cutIndex, proxyQuality, inputMode } = event.payload;
        idealPaths.current = [...idealPaths.current, ideal];
        playerPaths.current = [...playerPaths.current, player];
        setCutProgress(cutIndex);
        setProgressByAxis((prev) => ({
          ...prev,
          [event.payload.axis]: prev[event.payload.axis] + 1,
        }));
        // Tap is the relaxed, no-precision mode (§5) — the visual result
        // IS the feedback. The "Clean cut." / "Rustic, and still lovely."
        // toast stays reserved for swipe, the deeper mastery interaction.
        if (inputMode === "swipe") {
          setCurrentCutQuality(proxyQuality);
          window.setTimeout(() => setCurrentCutQuality(null), 1100);
        }
      } else if (event.type === "PLATING_STARTED") {
        // The actual plating + chef-hands sequence plays out inside the
        // Phaser canvas (see PreparationScene) — this only keeps the
        // HUD's phase honest. RECIPE_COMPLETED (and the Knife Report)
        // doesn't arrive until the hands have taken the plate away,
        // matching the reference's finishRecipe -> plating -> handoff ->
        // showResult order.
        setPhase("plating");
        setCooking("ready");
      } else if (event.type === "RECIPE_COMPLETED") {
        const { overall, evenness, consistency, rhythmBonus, qualityLabel } = event.payload;
        setResult({
          score: overall,
          evenness,
          consistency,
          rhythmBonus,
          qualityLabel,
          idealPath: idealPaths.current,
          playerPath: playerPaths.current,
        });
        // The chef cooks the dish (CookingClip), then the Knife Report.
        setCooking("playing");
      }
    });

    const unsubscribePause = PauseManager.subscribe(setPaused);

    return () => {
      window.clearTimeout(readyFallback);
      unsubscribe();
      unsubscribePause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridge/level/knife/board are fixed for this preparation run
  }, []);

  // Credit the result the moment the "complete" screen appears, not on
  // its button click — otherwise OrderComplete would render one screen
  // behind, showing credits from before this order's reward.
  const awarded = useRef(false);
  useEffect(() => {
    if (phase !== "complete" || awarded.current || !result) return;
    awarded.current = true;
    setRewardCoins(onComplete(result.score));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onComplete/result are stable for this run
  }, [phase]);

  function restart() {
    idealPaths.current = [];
    playerPaths.current = [];
    awarded.current = false;
    setCutProgress(0);
    setProgressByAxis({ h: 0, v: 0 });
    setResult(null);
    setRewardCoins(0);
    setCooking("off");
    setPhase("prep");
    setShowHint(true);
    setActiveStep({
      index: 0,
      ingredientId: firstStep.ingredientId,
      techniqueId: firstStep.techniqueId,
      requiredCuts: requiredCutsFor(TECHNIQUES[firstStep.techniqueId]),
    });
    bridge.restartPreparation();
  }

  const activeIngredient = INGREDIENTS[activeStep.ingredientId];
  const activeTechnique = TECHNIQUES[activeStep.techniqueId];
  // Phase 16 — the destination-tray requirement from Levels 81-100 (§19:
  // "small, readable, visually integrated with the cutting board... not a
  // separate screen") is satisfied by extending the SAME step-label slot
  // multi-ingredient levels already show ("Step 2 of 3"), not a new HUD
  // element. Read directly off the level's own data — no bridge/scene
  // round trip needed for a label.
  const activeDestination = view.preparationSteps[activeStep.index]?.destination;
  const stepLabel =
    steps.length > 1 || activeDestination
      ? `Step ${activeStep.index + 1} of ${steps.length}${activeDestination ? ` · for ${activeDestination}` : ""}`
      : undefined;
  // Phase 2 — the header shows WHO this is for in service mode (§10/§12:
  // "connect the chef/customer model to the active order"), rather than
  // the generic "Today's Order" campaign/daily/endless sessions show.
  // `note` (unused by GameHUD before this phase) now carries the chef's
  // own short instruction (§41), data-driven from the recipe — never
  // hardcoded here or in PreparationScene.
  const order = {
    day: service ? `${service.order.customer.avatarEmoji} ${service.order.customer.name}` : "Today",
    recipeId: view.recipeId,
    name: view.title,
    emoji: view.emoji,
    ingredients: view.preparationSteps.map((s) => INGREDIENTS[s.ingredient].name),
    reward: view.rewardCoins,
    note: view.subtitle,
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <img
        src={kitchenBg}
        alt="Warm café kitchen with copper pans, herbs and morning light"
        width={540}
        height={960}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_20%_8%,rgba(255,247,232,0.5),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(62,40,25,0.32)_0%,transparent_26%,transparent_52%,rgba(62,40,25,0.38)_100%)]" />
      <DustMotes />

      <GameHUD
        order={order}
        gameplay={{
          phase,
          ingredient: {
            id: activeIngredient.id,
            name: activeIngredient.name,
            glyph: order.emoji,
            technique: activeTechnique.name,
            targetPieces: activeStep.requiredCuts,
          },
          technique: activeTechnique.name,
          cutProgress,
          currentScore: result?.score ?? 0,
          currentCombo: 0,
          currentCutQuality,
          isPaused: paused,
          lastResult: result,
          previousBest,
          rewardCredits: view.rewardCoins,
        }}
        totalPieces={activeStep.requiredCuts}
        counts={activeTechnique.counts}
        progressByAxis={progressByAxis}
        {...(stepLabel ? { stepLabel } : {})}
        {...(service?.batchHint ? { batchHint: service.batchHint } : {})}
        onPause={() => bridge.pauseGame()}
      />

      <GameViewport bridge={bridge} />

      {showHint && phase === "prep" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[7%] z-20 flex flex-col items-center gap-2">
          <span className="font-hand text-[19px] text-ivory/90 drop-shadow-[0_2px_4px_rgba(62,40,25,0.6)]">
            {activeTechnique.interactionMode === "peel"
              ? "drag to peel"
              : activeTechnique.interactionMode === "smash"
                ? "tap to smash"
                : activeTechnique.interactionMode === "ring"
                  ? "tap across the onion to cut a ring"
                  : "tap to cut, or swipe for precision"}
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 top-[26%] z-30 flex justify-center">
        <CutResultPanel quality={currentCutQuality} />
      </div>

      {paused ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-walnut-dark/40 backdrop-blur-[3px]">
          <Panel className="anim-pop w-[74%] p-5 text-center" tone="cream">
            <p className="font-display text-[22px] font-black tracking-tight text-walnut-dark">
              Paused
            </p>
            <p className="mt-1 font-hand text-[16px] text-walnut/70">the kitchen will wait</p>
            <div className="mt-4 space-y-2">
              <KButton full onClick={() => bridge.resumeGame()}>
                Resume
              </KButton>
              <KButton
                full
                variant="cream"
                onClick={() => {
                  // Phase 4.5 fix: restarting from the pause overlay used to
                  // reset gameplay state (onRestart) without ever calling
                  // PauseManager.resume() — the scene itself stayed
                  // Phaser-paused (tweens/update loop frozen) even though
                  // the pause OVERLAY closed, since `paused` only flips via
                  // PauseManager's own subscription. Resume first, always.
                  bridge.resumeGame();
                  restart();
                }}
              >
                Restart Prep
              </KButton>
              <KButton
                full
                variant="ghost"
                onClick={() => {
                  // Phase 4.5 fix: this used to navigate to Kitchen without
                  // resuming, so PauseManager stayed paused=true globally —
                  // the NEXT Preparation mount (any level) immediately
                  // subscribed into that stale true and rendered paused
                  // from the first frame. Exiting a session must always
                  // leave PauseManager unpaused behind it.
                  bridge.resumeGame();
                  onExit();
                }}
              >
                {service?.isBusinessOrder ? "Back to Service" : "Back to Kitchen"}
              </KButton>
            </div>
          </Panel>
        </div>
      ) : null}

      {cooking !== "off" ? (
        <CookingClip
          playing={cooking === "playing"}
          onDone={() => {
            setCooking("off");
            setPhase("result");
          }}
        />
      ) : null}

      {phase === "result" && result ? (
        <KnifeReport
          dishName={view.title}
          stepName={steps.length > 1 ? "Preparation" : activeTechnique.name}
          result={result}
          onRetry={restart}
          onContinue={() => setPhase("complete")}
        />
      ) : null}

      {phase === "complete" ? (
        service ? (
          <ServiceOrderComplete
            serviceOrder={service.order}
            credits={credits}
            onServe={service.onServe}
            onNextOrder={service.onNextOrder}
            onRetry={restart}
            onExit={onExit}
            knife={knife}
            board={board}
            {...(service.nextLabel ? { nextLabel: service.nextLabel } : {})}
            {...(service.selectedSupplierId !== undefined
              ? { selectedSupplierId: service.selectedSupplierId }
              : {})}
            {...(service.ownedStaffIds ? { ownedStaffIds: service.ownedStaffIds } : {})}
            {...(service.knifeSharpnessValue !== undefined
              ? { knifeSharpnessValue: service.knifeSharpnessValue }
              : {})}
            {...(service.isBusinessOrder ? { isBusinessOrder: true } : {})}
          />
        ) : (
          <OrderComplete
            dishName={view.title}
            score={result?.score ?? 0}
            previousBest={previousBest}
            qualityLabel={result?.qualityLabel ?? "Clean"}
            rewardCoins={rewardCoins}
            credits={credits}
            onRetry={restart}
            onKitchen={onExit}
            {...(nextLevel && onNextLevel ? { nextLevelTitle: nextLevel.title, onNextLevel } : {})}
          />
        )
      ) : null}
    </div>
  );
}
