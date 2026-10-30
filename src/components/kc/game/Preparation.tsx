import { useEffect, useRef, useState } from "react";
import { paidLevelReward } from "@/game/levels/levelRewards";
import { GameBridge, type GameBridgeEvent } from "@/game/GameBridge";
import { PauseManager } from "@/game/PauseManager";
import { AudioManager } from "@/game/AudioManager";
import { gameReady, levelPaused, levelResumed } from "@/game/PlayablesSDK";
import { startPerformanceSampling } from "@/game/telemetry/performanceSample";
import {
  COMBO,
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
import type { PrepStep, SpecialsPayload } from "@/game/events";
import { CHAOS, CHAOS_COPY } from "@/game/kitchenChaos";
import { VARIANTS } from "@/game/specialVariants";
import { specialsReportLines } from "@/game/specialsReport";
import {
  PERSONALITIES,
  personalityForOrder,
  presentedCustomer,
  regularParMs,
} from "@/game/customers/personalities";
import {
  recordSessionDish,
  sessionDish,
  tierFor,
  tierMilestone,
  type PresentationTier,
} from "@/game/signatureDishes";
import { resolveTechniqueFor } from "@/game/definitions";
import { BookPageNote } from "./BookPageNote";
import {
  customerMoment,
  momentsForRun,
  momentsOf,
  nextRunKey,
  recordMoment,
} from "@/game/kitchenMoments";
import { MomentChip } from "../moments/MomentChip";
import { MomentPreview } from "../moments/MomentPreview";
import type { InspectionReport } from "@/game/business/businessInspection";
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
import { dishKindFor } from "@/game/recipes/dishKind";
import { taughtTechniques, showsBeginnerHint, COACH_TEXT, CUT_WAYS } from "@/game/coaching";
import { checklistFor } from "@/game/restaurant/levelChecklist";
import {
  AUTO_COLLECT_MS,
  AUTO_NEXT_MS,
  AUTO_SERVE_MS,
  PREP_COOK_GRADE,
  PREP_COOK_MS,
  PREP_COOK_SCORE,
} from "@/game/restaurant/prepCookAuto";
import { OrderComplete } from "./OrderComplete";
import { ServiceOrderComplete } from "./ServiceOrderComplete";
import { ServiceFloor, type FloorMode } from "./ServiceFloor";
import { OvenStep } from "./OvenStep";
import { ovenStepFor, trayItemFor } from "@/game/cooking/ovenStep";
import {
  MAX_PARTY,
  REACTION_FACE,
  finishPartyDelivery,
  heldPlatesOf,
  markPartyHeld,
  markPartyServed,
  seatInParty,
  type PartyDish,
} from "@/game/restaurant/serviceFloor";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
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
 * The instruction shown in the HUD. Some recipes/levels peel an ingredient
 * their text never mentions (Level 8 "Halve the potato evenly.", Level 9's
 * garlic), and completableSteps can add a required Peel too. The
 * instruction then says so first — "Peel the potato first." — so the text
 * matches what the player actually has to do. An ingredient counts as
 * mentioned when one clause of the text names both "peel" and it.
 */
function withPeelNote(instruction: string, steps: readonly PreparationStep[]): string {
  const clauses = instruction.toLowerCase().split(/[.;,]/);
  const unmentioned = [
    ...new Set(
      steps
        .filter((s) => s.technique === "peel")
        .map((s) => INGREDIENTS[s.ingredient].name.toLowerCase()),
    ),
  ].filter((name) => !clauses.some((c) => c.includes("peel") && c.includes(name)));
  if (unmentioned.length === 0) return instruction;
  const names = unmentioned.map((n) => `the ${n}`).join(" and ");
  return `Peel ${names} first. ${instruction}`.trim();
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
  coachLevelId,
  levelGuide,
  onExit,
  onComplete,
  credits,
  previousBest,
  knife = knifeOrDefault(DEFAULT_KNIFE_ID),
  board = boardOrDefault(DEFAULT_BOARD_ID),
  nextLevel,
  onNextLevel,
  specials,
  kitchenArt,
  floor,
  ovenCooking,
}: {
  level?: LevelDefinition;
  /** The campaign level being played for the FIRST time (App decides) — which techniques it teaches (coaching.ts). Omitted for replays, Today's Special, Endless, Restaurant Service and Business: no coaching there. */
  coachLevelId?: string;
  /** Pass 3 (restaurant build, Levels 1–15, levelGoals.ts): the dish's goal, its best stars (null = not cooked yet), whether the engine grades it, and the customer's own line. */
  levelGuide?: {
    goal: string;
    graded: boolean;
    bestStars: 0 | 1 | 2 | 3 | null;
    customerLine: string;
  };
  /** Present only for a restaurant-service session (App.tsx's sessionMode === "service") — see ServiceManager.ts for the state machine behind it. */
  service?: {
    order: ServiceOrder;
    /** §17/§18 — the Serve action; returns null if the order somehow isn't READY (defensive only). Economy V2 Phase 9 — `settlement`/`isReplay` are present for a campaign/batch-group serve (never for plain Restaurant Service, which never computes a settlement) so ServiceOrderComplete can show the real breakdown without recalculating anything. */
    onServe: (opts?: { joinCash?: boolean }) => {
      /** The cash now on the table (a party's pile when plates were served together). */
      tableCash?: { payCents: number; tipCents: number } | null;
      coinsAwarded: number;
      reaction: string;
      settlement?: SettlementResult | undefined;
      isReplay?: boolean;
      /** Phase 2 (C3): the customer tip credited with this payment, in cents (0 or absent: none). */
      tip?: number;
      /** Phase 2 (C2): the dish grade, from the same score its pay was computed from; the customer reaction follows it. */
      quality?: QualityLabel;
      businessPayment?: BusinessCustomerPayment;
      businessCustomers?: BusinessCustomersToday;
    } | null;
    /** Credit individual physical cash pieces after swipes, then finalize the transaction. */
    onCashPieceCollected?: (cents: number, isTip: boolean) => void;
    onCashRemaining?: (cents: number) => void;
    onCashCollected?: () => void;
    /** §20 — advances the queue (or finishes a campaign level — see `nextLabel`) and remounts Preparation for the new current order. */
    onNextOrder: () => void;
    /** Phase 3 §16 — a one-sentence batching hint ("Batch tip: ...") when the active and next order share a real component; null otherwise. Presentation only, never gameplay-affecting. */
    batchHint?: string | null;
    /** Label for ServiceOrderComplete's advance button — defaults to "Next Customer"; a campaign level about to complete also passes `endsLevel` (App.tsx decides which, based on ServiceSession.completedCount vs the level's own requiredOrders). */
    nextLabel?: string;
    /** Economy V2 Phase 9 — display-only identity for the settlement breakdown (App.tsx passes the raw save fields; ServiceOrderComplete resolves them to catalog names itself, exactly like Shop.tsx already does). Omitted for plain Restaurant Service. */
    selectedSupplierId?: string;
    ownedStaffIds?: readonly string[];
    knifeSharpnessValue?: number;
    /** Economy V3 Phase 14, Checkpoint 3 — true only for a Business Mode order; forwarded to ServiceOrderComplete so its payment/running-total displays real USD instead of Kitchen Coins. Absent (falsy) for every other service kind. */
    isBusinessOrder?: boolean;
    /** Unified Restaurant: an optional second action after a serve (a menu guest). */
    extraAction?: { label: string; onClick: () => void; disabled?: boolean };
    /**
     * The service's customers still to come after this one, with what they ordered (null:
     * not known yet) — they arrive with this one as a party (developer 2026-10-26). Absent: none.
     */
    partyWaiting?: readonly (PartyDish | null)[];
    /**
     * How many of the NEXT orders ask for this very dish (customers who came together and
     * ordered the same): they are cut one plate after another, cooked once and served together
     * (App.tsx `sharedPrep`). Absent / 0: this order is prepared alone.
     */
    sameDishAhead?: number;
    /**
     * Required orders still to come after this one. While the party this order sits with has
     * places left and orders to fill them, its plate is HELD (paid, kept back) and goes out with
     * the whole table when the party's last order is served.
     */
    ticketsAfter?: number;
    /** This serve is the level's last: "Next Customer" completes the level and nobody's arrival follows. */
    endsLevel?: boolean;
    /** Takes the cash left on the table into the wallet (App.collectTableCash). */
    onCollectTableCash?: () => void;
    /** A hired Prep Cook (restaurant/prepCookAuto.ts): cuts this order for the player; `auto` also serves, collects and moves on. */
    prepCook?: { auto: boolean; onAuto: () => void };
    /** Phase 2 (restaurant/serviceFlow.ts): customers waiting at the door, and the first one's patience left (0..1, null: no clock). */
    door?: { waiting: number; walkedOut: number; patience: number | null };
  };
  onExit: () => void;
  /** Returns this run's coin reward (0 on replay — Law 2 — or always 0 for a service session, where payment is deferred to the explicit Serve action) so OrderComplete can show it without a second App->Preparation round trip. */
  onComplete: (score: number, portions?: number) => number;
  credits: number;
  previousBest: number;
  knife?: KnifeDefinition;
  board?: BoardDefinition;
  /** The next campaign level, only when it exists AND is already unlocked — App.tsx computes this once per render, mirroring how `previousBest` is already passed down instead of looked up in here. Never set for a service session. */
  nextLevel?: LevelDefinition | null;
  onNextLevel?: () => void;
  /**
   * Phase 3 (C/D) — what this order may get (App decides): a Kitchen Chaos
   * event, a special ingredient variant, and — restaurant build — the live
   * inspection the Kitchen Inspection event reads at the Knife Report (no
   * fine, no state). Absent: neither (the scene then decides nothing).
   */
  specials?: {
    chaosEligible: boolean;
    variantEligible: boolean;
    inspect?: () => InspectionReport;
    /** Phase 4 (B): the level side of a special customer's eligibility (customers/personalities.ts) — App decides. */
    customerEligible?: boolean;
  };
  /**
   * Phase 5 (A4): the painting behind the cutting board — the built kitchen
   * tier's own art (KitchenBackground's skins), so the workstation shows the
   * restoration too. Absent (the starting Humble Kitchen): the original
   * cutting-screen painting, unchanged.
   */
  kitchenArt?: string;
  /**
   * Transformation Phase B (restaurant build, service orders): the dining
   * room the customer walks into (ServiceFloor) — the built stage's map
   * painting. Presentation only; absent: no floor (the classic game).
   */
  floor?: { stage: KitchenMapArtStage; mapUrl: string; reducedMotion: boolean };
  /** Transformation Phase C (restaurant build): the interactive oven replaces the cooking film for its recipes (ovenStep.ts). */
  ovenCooking?: boolean;
}) {
  // The single source of "what does this session look like" — a real
  // level's own fields, or the equivalent ones derived from the active
  // recipe (recipeId doubles as SaveData.recipeProgress's key either
  // way, so mastery/Cookbook tracking works identically for both — see
  // ServiceManager/App.tsx's recordServiceResult).
  const givenSteps = service
    ? preparationStepsForRecipe(service.order.recipe)
    : level!.preparationSteps;
  const onePortionSteps = completableSteps(givenSteps);
  // Customers who ordered the same dish: cut plate 1, then plate 2 …, cook once, serve together.
  // Decided once per order (the order's status moves on while it is cut).
  const [portions] = useState(() =>
    service && service.order.order.status !== "READY"
      ? 1 + Math.max(0, Math.min(MAX_PARTY - 1, Math.floor(service.sameDishAhead ?? 0)))
      : 1,
  );
  const playableSteps =
    portions > 1
      ? Array.from({ length: portions }, (_, k) =>
          onePortionSteps.map((s) => ({
            ...s,
            destination: `${s.destination || "Plate"} ${k + 1}`,
          })),
        ).flat()
      : onePortionSteps;
  const view = service
    ? {
        recipeId: service.order.recipe.id,
        title: service.order.recipe.name,
        subtitle:
          portions > 1
            ? `${portions} plates together · ${withPeelNote(service.order.recipe.chefInstruction, onePortionSteps)}`
            : withPeelNote(service.order.recipe.chefInstruction, playableSteps),
        emoji: service.order.recipe.emoji,
        // The order's OWN pay (computed once at order-creation time via
        // recipePay(recipe, chapter) — see CustomerOrderManager.ts), not
        // recipe.basePayment's static per-chapter-agnostic snapshot,
        // which would show the wrong number for a reused recipe (v2
        // §2.2/§3.4 — pay depends on which chapter serves it).
        rewardCoins: service.order.order.basePayment,
        preparationSteps: playableSteps,
      }
    : {
        recipeId: level!.recipeId,
        title: level!.title,
        subtitle: withPeelNote(level!.subtitle, playableSteps),
        emoji: level!.emoji,
        rewardCoins: paidLevelReward(level!),
        preparationSteps: playableSteps,
      };
  const steps: PrepStep[] = view.preparationSteps.map((s) => ({
    ingredientId: s.ingredient,
    techniqueId: s.technique,
    ...(s.chainBreak ? { chainBreak: true } : {}),
    ...(s.destination ? { destination: s.destination } : {}),
  }));
  const firstStep = steps[0]!;
  // Phase C: this dish is baked in the interactive oven instead of the film.
  const ovenStep = !!ovenCooking && ovenStepFor(view.recipeId);

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
  // Phase 1 (B1) — the live combo, straight off the scene's CUT_COMPLETED
  // payload. Never computed here: the scene owns it (COMBO in
  // definitions.ts), so there is one counter, not a UI copy that can
  // drift out of step with the board.
  const [combo, setCombo] = useState(0);
  // The milestone toast currently on screen ("Clean ×5!"), or null.
  const [comboMilestone, setComboMilestone] = useState<number | null>(null);
  // Phase 3 (A): Fever Mode, straight from the scene's EVT.FEVER (fever.ts) — the
  // vignette, the countdown bar (it pauses with the game) and the end cue.
  const [fever, setFever] = useState<{ ms: number } | null>(null);
  const [feverDone, setFeverDone] = useState(false);
  const feverDoneTimer = useRef<number | null>(null);
  // Phase 3 (C/D): this order's chaos event and variant (EVT.SPECIALS, once per
  // order; a restart keeps them), the card that announces them, the
  // avalanche while it is on the board, and Grandma's Challenge.
  const [orderSpecials, setOrderSpecials] = useState<SpecialsPayload>({
    chaos: null,
    variant: null,
  });
  const orderChaos = useRef<SpecialsPayload["chaos"]>(null);
  const orderVariant = useRef<SpecialsPayload["variant"]>(null);
  const variantOnBoard = useRef(false);
  const [specialsCard, setSpecialsCard] = useState(false);
  const specialsTimer = useRef<number | null>(null);
  const [avalanche, setAvalanche] = useState<{ left: number; total: number; on: boolean } | null>(
    null,
  );
  const grandmaBest = useRef(0);
  const [grandmaDone, setGrandmaDone] = useState(false);
  const [inspection, setInspection] = useState<InspectionReport | null>(null);
  const specialsRef = useRef(specials);
  // Phase 4 (B): this order's special customer (customers/personalities.ts) —
  // decided once per order id and cached there, so a StrictMode double render
  // or a remount of the same order sees the same one. Presentation only: the
  // order, its customer id and its payment are untouched.
  const [personality] = useState(() =>
    service
      ? personalityForOrder(service.order.order.id, {
          service: true,
          teaching:
            !!coachLevelId &&
            taughtTechniques(
              coachLevelId,
              steps.map((s) => s.techniqueId),
            ).length > 0,
          levelOk: !!specials?.customerEligible,
        })
      : null,
  );
  const shownCustomer = service
    ? presentedCustomer(service.order.customer, personality?.id ?? null)
    : null;
  // Phase B: the service floor — the customer arrives before the cut and the
  // plate reaches the table after Serve; the one before walks out as they
  // arrive. It only shows; the order's own actions stay the existing ones.
  const [floorMode, setFloorMode] = useState<FloorMode | null>(
    // A plate prepared together with the one before it arrives ready: its customer is already seated.
    service && floor && service.order.order.status !== "READY" ? "arrive" : null,
  );
  // This plate was held for the table: a short "waiting for the rest" note, then the next order.
  const [holding, setHolding] = useState(false);
  // Parties (developer 2026-10-26): this order's place at its party's table, decided once.
  const [partySeat] = useState(() =>
    service && floor && shownCustomer
      ? seatInParty(
          service.order.order.id,
          shownCustomer.id,
          { emoji: view.emoji, name: view.title },
          service.partyWaiting ?? [],
          Date.now(),
        )
      : null,
  );
  // Plates of this party already cooked and waiting for the table (decided once per order).
  const [platesWaiting] = useState(() => (service ? heldPlatesOf(service.order.order.id) : 0));
  const [servedQuality, setServedQuality] = useState<QualityLabel | undefined>(undefined);
  // What the serve earned: left on the table until the player sweeps it in.
  const [servedCash, setServedCash] = useState<{ payCents: number; tipCents: number } | null>(null);
  const [serviceCashRemaining, setServiceCashRemaining] = useState(0);
  const specialsShown = useRef(false);
  /** Runs the existing advance at once; the party walks out when the next one arrives. */
  const departThen = (next: () => void) => {
    if (floor && service)
      markPartyServed(
        service.order.order.id,
        view.emoji,
        REACTION_FACE[servedQuality ?? result?.qualityLabel ?? "Honest"],
        Date.now(),
      );
    next();
  };
  // The Regular's par (cosmetic): unpaused prep time against regularParMs.
  const [regularPar] = useState(() =>
    regularParMs(
      steps.reduce((n, s) => {
        const t = resolveTechniqueFor(TECHNIQUES[s.techniqueId], INGREDIENTS[s.ingredientId]);
        return n + (t.interactionMode === "cut" ? requiredCutsFor(t) : 1);
      }, 0),
    ),
  );
  const prepMs = useRef(0);
  const [regularWaiting, setRegularWaiting] = useState<"no" | "showing" | "shown">("no");
  const regularChecked = useRef(false);
  const regularTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (regularTimer.current !== null) window.clearTimeout(regularTimer.current);
    },
    [],
  );
  // Phase 4 (A7): the run's longest combo (for this visit's record) and the
  // recipe-book page this dish wrote, if any (shown after the Knife Report).
  const bestCombo = useRef(0);
  const [bookNote, setBookNote] = useState<{
    tier: PresentationTier | null;
    variant: SpecialsPayload["variant"];
  } | null>(null);
  const reportContinued = useRef(false);
  // Phase 6: this run's Kitchen Moments (kitchenMoments.ts) — the run's key,
  // the Perfect Slices and the combo of the ingredient each landed on, and the
  // chip / preview. Memory only; a new run (Prepare Again) is a new key.
  const runKey = useRef<string | null>(null);
  const stepIndexNow = useRef(0);
  const stepCombo = useRef<number[]>([]);
  const perfectSteps = useRef<Set<number>>(new Set());
  const [momentTick, setMomentTick] = useState(0);
  const [momentsHidden, setMomentsHidden] = useState(false);
  const [momentPreview, setMomentPreview] = useState(false);
  useEffect(() => {
    specialsRef.current = specials;
  });
  // The highest milestone already announced for THIS step — so a
  // threshold fires on the cut that reaches it and never again on the
  // cuts after it. Reset by STEP_STARTED along with the combo itself.
  const firedMilestone = useRef(0);
  const milestoneTimer = useRef<number | null>(null);
  const [progressByAxis, setProgressByAxis] = useState({ h: 0, v: 0 });
  const [currentCutQuality, setCurrentCutQuality] = useState<QualityLabel | null>(null);
  const [showHint, setShowHint] = useState(true);
  // The ghost demonstration is on the board (the scene says when) — show its how-to card.
  const [coachVisible, setCoachVisible] = useState(false);
  // Phase 2 (A2): the scene is offering the bench scraper (EVT.CLEANUP) — show how, and a Skip.
  const [cleanupOffered, setCleanupOffered] = useState(false);
  // How much of the board the cloth has wiped clean (0–1), for the card's bar.
  const [cleanupProgress, setCleanupProgress] = useState(0);
  // A peel step's progress (0–1) from the scene's PEEL_PROGRESS — HUD feedback only.
  const [peelFraction, setPeelFraction] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<CutResult | null>(null);
  const [rewardCoins, setRewardCoins] = useState(0);
  // The cooking film after every dish: "off", buffering while the plate is
  // plated ("ready"), then "playing" once the hands have taken it away.
  const [cooking, setCooking] = useState<"off" | "ready" | "playing">("off");

  const idealPaths = useRef<CutPath[]>([]);
  const playerPaths = useRef<CutPath[]>([]);

  // A new order on the pass (W3): Preparation remounts per order, so the bell rings once each.
  useEffect(() => AudioManager.playSfx("bell"), []);
  // Phase 4 (B): a special customer's arrival card, with the order's own
  // twist if it has one (the same card, a few seconds, never a touch).
  useEffect(() => {
    // Phase B: after the arrival (the card would play unseen under it).
    if (!personality || phase !== "prep" || floorMode || specialsShown.current) return;
    specialsShown.current = true;
    setSpecialsCard(true);
    if (specialsTimer.current !== null) window.clearTimeout(specialsTimer.current);
    specialsTimer.current = window.setTimeout(() => setSpecialsCard(false), 3400);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as the order arrives
  }, [floorMode]);
  // The Regular's clock: counts unpaused cutting time only; past his par he
  // checks his watch once (on the order card — never over the board).
  useEffect(() => {
    if (personality?.id !== "impatient-regular" || phase !== "prep") return;
    const tick = window.setInterval(() => {
      if (paused) return;
      // Phase B: the customer's arrival isn't prep time.
      if (floorMode) return;
      prepMs.current += 250;
      if (prepMs.current >= regularPar && !regularChecked.current) {
        regularChecked.current = true;
        setRegularWaiting("showing");
        regularTimer.current = window.setTimeout(() => setRegularWaiting("shown"), 3000);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [personality, phase, paused, regularPar, floorMode]);
  // The cutting board is the game's active play: its frame rate is sampled (telemetry).
  useEffect(() => startPerformanceSampling(), []);

  useEffect(() => {
    // Campaign levels teach their new techniques (coaching.ts); Restaurant
    // Service and Business only get the demonstration when idle.
    const campaignId = coachLevelId;
    bridge.startPreparation({
      steps,
      knife,
      board,
      teach: campaignId
        ? taughtTechniques(
            campaignId,
            steps.map((s) => s.techniqueId),
          )
        : [],
      ...(specials
        ? {
            specials: {
              chaosEligible: specials.chaosEligible,
              variantEligible: specials.variantEligible,
              restaurant: !!specials.inspect,
            },
          }
        : {}),
    });

    // Fallback only — if Phaser somehow never boots (no WebGL/canvas2d,
    // an uncaught error inside the scene, ...), gameReady() still fires
    // so the platform doesn't consider the game permanently stuck loading.
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
      } else if (event.type === "COACH") {
        setCoachVisible(event.payload.visible);
        if (event.payload.visible) setShowHint(false);
      } else if (event.type === "FEVER") {
        if (event.payload.state === "start") {
          setFever({ ms: event.payload.ms });
        } else {
          setFever(null);
          if (event.payload.reason === "time" || event.payload.reason === "plating") {
            setFeverDone(true);
            if (feverDoneTimer.current !== null) window.clearTimeout(feverDoneTimer.current);
            feverDoneTimer.current = window.setTimeout(() => setFeverDone(false), 1200);
          }
        }
      } else if (event.type === "SPECIALS") {
        setOrderSpecials(event.payload);
        orderChaos.current = event.payload.chaos;
        orderVariant.current = event.payload.variant;
        variantOnBoard.current =
          !!event.payload.variant &&
          VARIANTS[event.payload.variant].base === firstStep.ingredientId;
        if (event.payload.chaos || event.payload.variant) {
          setSpecialsCard(true);
          if (specialsTimer.current !== null) window.clearTimeout(specialsTimer.current);
          specialsTimer.current = window.setTimeout(() => setSpecialsCard(false), 3200);
        }
      } else if (event.type === "AVALANCHE") {
        const { state, left, total } = event.payload;
        setAvalanche({ left, total, on: state === "start" || state === "progress" });
        if (state === "start") setSpecialsCard(false); // the avalanche card takes over
      } else if (event.type === "CLEANUP") {
        const { state, progress } = event.payload;
        setCleanupOffered(state === "offered" || state === "progress");
        setCleanupProgress(progress ?? 0);
      } else if (event.type === "PEEL_PROGRESS") {
        setPeelFraction(event.payload.fraction);
      } else if (event.type === "CUT_STARTED") {
        setShowHint(false);
      } else if (event.type === "STEP_STARTED") {
        const { stepIndex, ingredientId, techniqueId, requiredCuts } = event.payload;
        setActiveStep({ index: stepIndex, ingredientId, techniqueId, requiredCuts });
        stepIndexNow.current = stepIndex;
        // Phase 3 (D): a variant that comes later in the order is announced again as it reaches the board.
        const v = orderVariant.current;
        if (v && !variantOnBoard.current && VARIANTS[v].base === ingredientId) {
          variantOnBoard.current = true;
          setSpecialsCard(true);
          if (specialsTimer.current !== null) window.clearTimeout(specialsTimer.current);
          specialsTimer.current = window.setTimeout(() => setSpecialsCard(false), 2400);
        }
        setCutProgress(0);
        setProgressByAxis({ h: 0, v: 0 });
        setPeelFraction(0);
        // A new ingredient starts a new run (COMBO's doc) — and releases
        // the replay latch below, because the scene has now confirmed a
        // fresh session actually began.
        setCombo(0);
        setComboMilestone(null);
        firedMilestone.current = 0;
        restarting.current = false;
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
        // Phase 1 (B1/B3) — the combo, and its milestone toast. The
        // threshold check reads the scene's own combo (never a second
        // counter kept here) and `firedMilestone` makes each milestone
        // announce itself exactly once per step, instead of re-firing on
        // every cut after it.
        const nextCombo = event.payload.combo;
        setCombo(nextCombo);
        bestCombo.current = Math.max(bestCombo.current, nextCombo);
        // Phase 6: the combo each ingredient reached, and where a Perfect Slice landed.
        stepCombo.current[stepIndexNow.current] = Math.max(
          stepCombo.current[stepIndexNow.current] ?? 0,
          nextCombo,
        );
        if (event.payload.isPerfect) perfectSteps.current.add(stepIndexNow.current);
        // Phase 3 (C): Grandma's Challenge reads the same combo.
        if (orderChaos.current === "grandma" && nextCombo > grandmaBest.current) {
          grandmaBest.current = nextCombo;
          if (nextCombo === CHAOS.GRANDMA_COMBO) {
            setGrandmaDone(true);
            AudioManager.playChime();
          }
        }
        const reached = COMBO.MILESTONES.filter((m) => m <= nextCombo).pop() ?? 0;
        if (reached > firedMilestone.current) {
          firedMilestone.current = reached;
          setComboMilestone(reached);
          AudioManager.playComboMilestone(COMBO.MILESTONES.indexOf(reached));
          if (milestoneTimer.current !== null) window.clearTimeout(milestoneTimer.current);
          milestoneTimer.current = window.setTimeout(() => setComboMilestone(null), COMBO.TOAST_MS);
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
        // Phase 6: the Kitchen Moments this finished run earned — computed once,
        // here, from the run's own result (never on a render).
        {
          const key = nextRunKey(view.recipeId);
          runKey.current = key;
          const business = !!service?.isBusinessOrder;
          const before =
            baselineBest.current > 0 ? { best: baselineBest.current, done: true } : undefined;
          for (const m of momentsForRun({
            runKey: key,
            dishName: view.title,
            dishEmoji: view.emoji,
            score: overall,
            grade: qualityLabel,
            previousBest: business ? 0 : baselineBest.current,
            perfects: [...perfectSteps.current].map((s) => ({ combo: stepCombo.current[s] ?? 0 })),
            bestCombo: bestCombo.current,
            variant: orderVariant.current,
            tierReached: business ? null : tierMilestone(before, overall),
          }))
            recordMoment(m);
          setMomentTick((t) => t + 1);
        }
        // Phase 3 (C): the friendly inspector reads the restaurant as it is now.
        if (orderChaos.current === "inspection")
          setInspection(specialsRef.current?.inspect?.() ?? null);
        // The chef cooks the dish (CookingClip), then the Knife Report.
        setCooking("playing");
      }
    });

    const unsubscribePause = PauseManager.subscribe(setPaused);

    return () => {
      window.clearTimeout(readyFallback);
      if (milestoneTimer.current !== null) window.clearTimeout(milestoneTimer.current);
      if (feverDoneTimer.current !== null) window.clearTimeout(feverDoneTimer.current); // unmount
      if (specialsTimer.current !== null) window.clearTimeout(specialsTimer.current); // unmount
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
    setRewardCoins(onComplete(result.score, portions));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onComplete/result are stable for this run
  }, [phase]);

  /**
   * Phase 1 (B6) — one replay per press. Two presses in the same frame
   * (or a double-tap, where the second lands before React has rendered
   * the result screen away) would otherwise each clear `awarded` and
   * each call bridge.restartPreparation() — which is how one run can be
   * completed, and so credited, twice. The latch opens again only when
   * the scene confirms a fresh run really started (STEP_STARTED above),
   * never on a timer.
   */
  const restarting = useRef(false);

  /**
   * B4/B5 — the player's best BEFORE this run. App.tsx reads `previousBest`
   * live off the save, and this run's own score goes into that save the
   * moment the player continues past the report (the `awarded` effect
   * above). Snapshotting it here — and again on each replay, before the
   * new run can possibly finish — keeps "New Best!" and the improvement
   * line comparing against the right number instead of against this very
   * run's result.
   */
  const baselineBest = useRef(previousBest);

  function restart() {
    bestCombo.current = 0;
    prepMs.current = 0;
    regularChecked.current = false;
    if (regularTimer.current !== null) window.clearTimeout(regularTimer.current);
    setRegularWaiting("no");
    setBookNote(null);
    reportContinued.current = false;
    runKey.current = null;
    stepCombo.current = [];
    perfectSteps.current = new Set();
    setMomentsHidden(false);
    setMomentPreview(false);
    if (restarting.current) return;
    restarting.current = true;
    baselineBest.current = previousBest;
    setCombo(0);
    setComboMilestone(null);
    setFever(null); // the scene ends it on restart too (endFever)
    setFeverDone(false);
    setAvalanche((a) => (a ? { ...a, on: false } : a)); // the scene clears it on restart (once per order)
    grandmaBest.current = 0;
    setGrandmaDone(false);
    setInspection(null);
    firedMilestone.current = 0;
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

  /**
   * Phase 4 (C) — Knife Report → serve/complete, once per run (a double tap
   * can't advance twice). When this dish writes something new into the
   * recipe book (signatureDishes.tierMilestone, or a variant met for the
   * first time this visit) the completion card carries a small book page
   * (BookPageNote) — part of that card, never a stage of its own. Business
   * orders keep no recipe record (V3-16), so they never get one.
   */
  function continueFromReport() {
    if (reportContinued.current || !result) return;
    reportContinued.current = true;
    if (!service?.isBusinessOrder) {
      const before =
        baselineBest.current > 0 ? { best: baselineBest.current, done: true } : undefined;
      const tier = tierMilestone(before, result.score);
      const v = orderSpecials.variant;
      const newVariant = v && !sessionDish([view.recipeId])?.variants.includes(v) ? v : null;
      recordSessionDish(view.recipeId, bestCombo.current, v);
      if (tier || newVariant) setBookNote({ tier, variant: newVariant });
    }
    setPhase("complete");
  }

  /** Every plate has reached the table (or the customer has sat down to order): they are all served now, and a complete party is gone. */
  const floorDone = () => {
    if (service)
      finishPartyDelivery(
        service.order.order.id,
        view.emoji,
        REACTION_FACE[servedQuality ?? result?.qualityLabel ?? "Honest"],
        Date.now(),
      );
    setFloorMode(null);
  };

  // The hired Prep Cook cuts this whole order (restaurant/prepCookAuto.ts): a plain Honest plate,
  // straight to the Serve card. Only before the player's first cut, once the customer has sat down.
  const [cookBusy, setCookBusy] = useState(false);
  const cookTimer = useRef<number | null>(null);
  const cookReady =
    !!service?.prepCook &&
    service.order.order.status !== "READY" &&
    phase === "prep" &&
    (!floorMode || floorMode === "arrive") &&
    !paused &&
    !cookBusy &&
    activeStep.index === 0 &&
    cutProgress === 0;
  function sendPrepCook() {
    if (!cookReady) return;
    if (floorMode === "arrive") floorDone();
    setCookBusy(true);
    cookTimer.current = window.setTimeout(
      () => {
        cookTimer.current = null;
        reportContinued.current = true;
        setResult({
          score: PREP_COOK_SCORE,
          evenness: 0.75,
          consistency: 0.75,
          rhythmBonus: 0,
          qualityLabel: PREP_COOK_GRADE,
          idealPath: [],
          playerPath: [],
        });
        setCookBusy(false);
        setPhase("complete");
      },
      floor?.reducedMotion ? 300 : PREP_COOK_MS,
    );
  }
  useEffect(
    () => () => {
      if (cookTimer.current !== null) window.clearTimeout(cookTimer.current);
    },
    [],
  );
  const activeIngredient = INGREDIENTS[activeStep.ingredientId];
  const activeTechnique = TECHNIQUES[activeStep.techniqueId];
  // Phase 16 — the destination-tray requirement from Levels 81-100 (§19:
  // "small, readable, visually integrated with the cutting board... not a
  // separate screen") is satisfied by extending the SAME step-label slot
  // multi-ingredient levels already show ("Step 2 of 3"), not a new HUD
  // element. Read directly off the level's own data — no bridge/scene
  // round trip needed for a label.
  const activeDestination = view.preparationSteps[activeStep.index]?.destination;
  // Level 1–10 UX pass: no "Step 1 of 1" on a single-step level — only where
  // the food goes ("For Bowl"); a multi-step session keeps "Step 2 of 3 · for Bowl".
  const stepLabel =
    steps.length > 1
      ? `Step ${activeStep.index + 1} of ${steps.length}${activeDestination ? ` · for ${activeDestination}` : ""}`
      : activeDestination
        ? `For ${activeDestination}`
        : undefined;
  // Phase 2 — the header shows WHO this is for in service mode (§10/§12:
  // "connect the chef/customer model to the active order"), rather than
  // the generic "Today's Order" campaign/daily/endless sessions show.
  // `note` (unused by GameHUD before this phase) now carries the chef's
  // own short instruction (§41), data-driven from the recipe — never
  // hardcoded here or in PreparationScene.
  const order = {
    day: shownCustomer ? `${shownCustomer.avatarEmoji} ${shownCustomer.name}` : "Today",
    recipeId: view.recipeId,
    name: view.title,
    emoji: view.emoji,
    ingredients: view.preparationSteps.map((s) => INGREDIENTS[s.ingredient].name),
    reward: view.rewardCoins,
    note: view.subtitle,
  };

  return (
    <div className="kc-prep relative h-full w-full overflow-hidden bg-cream">
      <img
        src={kitchenArt ?? kitchenBg}
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
          currentCombo: combo,
          currentCutQuality,
          isPaused: paused,
          lastResult: result,
          previousBest,
          rewardCredits: view.rewardCoins,
        }}
        totalPieces={activeStep.requiredCuts}
        fever={!!fever}
        counts={activeTechnique.counts}
        progressByAxis={progressByAxis}
        {...(activeTechnique.interactionMode === "peel"
          ? { peelFraction: cutProgress >= activeStep.requiredCuts ? 1 : peelFraction }
          : {})}
        {...(stepLabel ? { stepLabel } : {})}
        {...(service?.batchHint ? { batchHint: service.batchHint } : {})}
        {...(levelGuide
          ? {
              guide: {
                ...levelGuide,
                // The dish's real steps, ticked by the scene's own STEP_STARTED events.
                checklist: checklistFor(steps, activeStep.index, phase !== "prep"),
              },
            }
          : {})}
        onPause={() => {
          bridge.pauseGame();
          levelPaused();
        }}
      />

      <GameViewport bridge={bridge} />

      {/* Phase 3 (C/D) — the order's twist, announced as it starts (a few
          seconds, never a touch), and Grandma's live progress. */}
      {specialsCard &&
      phase === "prep" &&
      (orderSpecials.chaos || orderSpecials.variant || personality) ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-[22%] z-30 flex justify-center px-4"
          data-testid="specials-card"
          data-chaos={orderSpecials.chaos ?? ""}
          data-variant={orderSpecials.variant ?? ""}
          data-customer={personality?.id ?? ""}
        >
          <div className="anim-pop w-full max-w-[340px] rounded-[18px] border border-gold/40 bg-walnut-dark/85 px-4 py-2.5 text-center shadow-lift backdrop-blur-[2px]">
            {personality ? (
              <div
                className="kc-arrive flex items-center gap-2.5 text-left"
                data-testid="customer-arrival"
              >
                <span
                  className={
                    "relative shrink-0 leading-none " +
                    (personality.id === "giant-eater" ? "text-[42px]" : "text-[32px]") +
                    (personality.id === "mystery-customer" ? " kc-silhouette" : "")
                  }
                  aria-hidden="true"
                >
                  {PERSONALITIES[personality.id].avatarEmoji}
                  <span className="absolute -bottom-1 -right-2 text-[16px]">
                    {PERSONALITIES[personality.id].badge}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-gold">
                    {PERSONALITIES[personality.id].name}
                  </span>
                  <span className="block font-ui text-[13.5px] font-bold leading-snug text-ivory">
                    {PERSONALITIES[personality.id].entrance}
                  </span>
                </span>
              </div>
            ) : null}
            {orderSpecials.chaos ? (
              <>
                <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-gold">
                  {CHAOS_COPY[orderSpecials.chaos].icon} {CHAOS_COPY[orderSpecials.chaos].title}
                </p>
                <p className="font-ui text-[14px] font-bold leading-snug text-ivory">
                  {CHAOS_COPY[orderSpecials.chaos].line}
                </p>
              </>
            ) : null}
            {orderSpecials.variant ? (
              <p className="font-ui text-[13.5px] font-extrabold leading-snug text-gold">
                ✨ Special: {VARIANTS[orderSpecials.variant].emoji}{" "}
                {VARIANTS[orderSpecials.variant].name}!
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {regularWaiting === "showing" && phase === "prep" ? (
        <div
          className="pointer-events-none absolute left-3 top-[22%] z-20"
          data-testid="regular-waiting"
        >
          <span className="anim-pop rounded-full border border-gold/40 bg-walnut-dark/75 px-2.5 py-1 font-ui text-[12px] font-extrabold text-gold shadow-soft">
            ⏱️ The Regular checks his watch…
          </span>
        </div>
      ) : null}
      {orderSpecials.chaos === "grandma" && phase === "prep" && !specialsCard ? (
        <div
          className="pointer-events-none absolute right-3 top-[22%] z-20"
          data-testid="grandma-progress"
        >
          <span className="rounded-full border border-gold/40 bg-walnut-dark/75 px-2.5 py-1 font-ui text-[12px] font-extrabold text-gold shadow-soft">
            {grandmaDone ? `👵 ×${CHAOS.GRANDMA_COMBO} ✓` : `👵 ×${combo} / ${CHAOS.GRANDMA_COMBO}`}
          </span>
        </div>
      ) : null}

      {/* Phase 3 (A) — Fever Mode: warm edges that leave the board's middle
          clear, and a thin countdown along the very top (it stops while the
          game is paused). Both pointer-events-none: Fever never takes a touch. */}
      {fever && phase === "prep" ? (
        <>
          <div
            className="kc-fever-vignette pointer-events-none absolute inset-0 z-[15] bg-[radial-gradient(120%_90%_at_50%_45%,transparent_58%,rgba(232,140,40,0.3)_100%)]"
            data-testid="fever-vignette"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[5px] bg-walnut-dark/30">
            <div
              className="kc-fever-bar h-full bg-[linear-gradient(90deg,#f6c453,#e8862f)]"
              data-testid="fever-bar"
              style={{
                animationDuration: `${fever.ms}ms`,
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          </div>
        </>
      ) : null}

      {/* Phase 2 (A2) — the bench scraper. Same slot and look as the coach
          card, which it replaces while it is up; the card itself lets every
          touch through to the board (the swipe is the whole interaction),
          except its Skip, which leaves the debris and goes straight to
          cutting, so the scrape can never hold a player up. */}
      {/* Phase 3 (C) — the Vegetable Avalanche: same slot as the scraper (they
          never share a start); touches go through to the board except Skip. */}
      {avalanche?.on && phase === "prep" ? (
        <div
          className="kc-prep-side pointer-events-none absolute inset-x-0 bottom-[6%] z-20 flex justify-center px-4"
          data-testid="avalanche"
        >
          <div className="anim-pop w-full max-w-[400px] rounded-[18px] border border-gold/40 bg-walnut-dark/80 px-4 py-3 text-center shadow-lift backdrop-blur-[2px]">
            <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-gold">
              {CHAOS_COPY.avalanche.icon} {CHAOS_COPY.avalanche.title}
            </p>
            <p className="mt-0.5 font-ui text-[15px] font-bold leading-snug text-ivory">
              Swipe through them to clear the board ·{" "}
              <span data-testid="avalanche-left">{avalanche.left}</span> left
            </p>
            <button
              type="button"
              className="pointer-events-auto mt-1 min-h-12 rounded-full px-5 font-ui text-[13px] font-extrabold uppercase tracking-[0.12em] text-ivory/70"
              onClick={() => bridge.skipAvalanche()}
              data-testid="avalanche-skip"
            >
              Skip
            </button>
          </div>
        </div>
      ) : cleanupOffered && phase === "prep" ? (
        <div
          className="kc-prep-side pointer-events-none absolute inset-x-0 bottom-[6%] z-20 flex justify-center px-4"
          data-testid="board-cleanup"
        >
          <div className="anim-pop w-full max-w-[400px] rounded-[18px] border border-gold/40 bg-walnut-dark/80 px-4 py-3 text-center shadow-lift backdrop-blur-[2px]">
            <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-gold">
              Clean the board
            </p>
            <p className="mt-0.5 font-ui text-[15px] font-bold leading-snug text-ivory">
              🧽 Wipe it with the cloth
            </p>
            <div
              className="mx-auto mt-2 flex h-2 w-40 gap-1"
              data-testid="board-cleanup-progress"
              data-progress={Math.round(cleanupProgress * 100)}
              aria-hidden
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="relative flex-1 overflow-hidden rounded-full bg-ivory/15">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-gold transition-[width] duration-200"
                    style={{
                      width: `${Math.max(0, Math.min(1, cleanupProgress * 5 - i)) * 100}%`,
                    }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : coachVisible && phase === "prep" ? (
        <div
          className="kc-prep-side pointer-events-none absolute inset-x-0 bottom-[6%] z-20 flex justify-center px-4"
          data-testid="coach-card"
        >
          <div className="anim-pop w-full max-w-[400px] rounded-[18px] border border-gold/40 bg-walnut-dark/80 px-4 py-3 text-center shadow-lift backdrop-blur-[2px]">
            <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-gold">
              {COACH_TEXT[activeTechnique.id].title}
            </p>
            <p className="mt-0.5 font-ui text-[15.5px] font-bold leading-snug text-ivory">
              {COACH_TEXT[activeTechnique.id].how}
            </p>
            <p className="mt-1 font-hand text-[16px] leading-snug text-ivory/75">
              {COACH_TEXT[activeTechnique.id].why}
            </p>
            {activeTechnique.interactionMode === "cut" ? (
              <div className="mt-1.5 space-y-0.5 text-left font-ui text-[12.5px] font-bold leading-snug text-ivory/80">
                {CUT_WAYS.map((way) => (
                  <p key={way.label}>
                    <span className="mr-1.5 inline-block min-w-[44px] rounded-full bg-gold/20 px-1.5 text-center text-[11px] font-extrabold tracking-[0.1em] text-gold">
                      {way.label}
                    </span>
                    {way.text}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : showHint && phase === "prep" && showsBeginnerHint(coachLevelId) ? (
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

      {/* Phase 1 (B3) — the combo milestone. A small pill BELOW the board
          and above the hint line, so it covers neither the cutting
          surface nor the order card; pointer-events-none so it can never
          swallow a cut. It auto-clears after COMBO.TOAST_MS. */}
      {comboMilestone !== null && phase === "prep" ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[19%] z-30 flex justify-center px-4"
          data-testid="combo-milestone"
        >
          <span className="anim-pop rounded-full border border-gold/40 bg-walnut-dark/80 px-3.5 py-1 font-ui text-[13px] font-extrabold uppercase tracking-[0.14em] text-gold shadow-lift backdrop-blur-[2px]">
            {fever ? `🔥 Fever! · Clean ×${comboMilestone}!` : `Clean ×${comboMilestone}!`}
          </span>
        </div>
      ) : feverDone && phase !== "result" && phase !== "complete" ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[19%] z-30 flex justify-center px-4"
          data-testid="fever-done"
        >
          <span className="anim-pop rounded-full border border-gold/40 bg-walnut-dark/80 px-3.5 py-1 font-ui text-[13px] font-extrabold uppercase tracking-[0.14em] text-gold shadow-lift backdrop-blur-[2px]">
            🔥 What a run!
          </span>
        </div>
      ) : null}

      {paused ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-walnut-dark/40 backdrop-blur-[3px]">
          <Panel className="anim-pop w-[74%] p-5 text-center" tone="cream">
            <p className="font-display text-[22px] font-black tracking-tight text-walnut-dark">
              Paused
            </p>
            <p className="mt-1 font-hand text-[17px] text-walnut/70">the kitchen will wait</p>
            <div className="mt-4 space-y-2">
              <KButton
                full
                onClick={() => {
                  bridge.resumeGame();
                  levelResumed();
                }}
              >
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
                  levelResumed();
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

      {cookBusy ? (
        <div
          data-testid="prep-cook-busy"
          className="absolute inset-0 z-[55] grid place-items-center bg-walnut-dark/70"
        >
          <p className="rounded-[18px] bg-ivory px-5 py-3 text-center font-display text-[18px] font-extrabold text-walnut-dark shadow-lift">
            👨‍🍳 Prep Cook is cutting
            <span className="block font-hand text-[16px] font-normal text-walnut/75">
              {view.emoji} {view.title}
            </span>
          </p>
        </div>
      ) : null}
      {platesWaiting > 0 && !floorMode ? (
        <div
          data-testid="party-held"
          className="pointer-events-none absolute left-1/2 top-2 z-[60] -translate-x-1/2 rounded-full bg-walnut-dark/80 px-3 py-1 font-ui text-[12px] font-extrabold text-ivory shadow-soft"
        >
          🍽️ {platesWaiting} {platesWaiting === 1 ? "plate" : "plates"} ready for the table
        </div>
      ) : null}
      {service?.door && service.door.waiting > 0 ? (
        <div
          data-testid="door-queue"
          data-waiting={service.door.waiting}
          className="pointer-events-none absolute right-2 top-2 z-[60] flex items-center gap-1.5 rounded-full bg-walnut-dark/80 px-3 py-1 font-ui text-[12.5px] font-extrabold text-ivory shadow-soft"
        >
          🚪 {service.door.waiting} waiting
          {service.door.patience !== null ? (
            <span aria-hidden className="block h-1.5 w-8 overflow-hidden rounded-full bg-ivory/25">
              <span
                className={`block h-full rounded-full ${service.door.patience > 0.35 ? "bg-sage" : "bg-tomato"}`}
                style={{ width: `${Math.round(service.door.patience * 100)}%` }}
              />
            </span>
          ) : null}
        </div>
      ) : null}
      {holding ? (
        <div
          data-testid="party-holding"
          className="pointer-events-none absolute inset-0 z-[70] grid place-items-center bg-walnut-dark/55"
        >
          <p className="rounded-[18px] bg-ivory px-5 py-3 text-center font-display text-[18px] font-extrabold text-walnut-dark shadow-lift">
            🍽️ Plate ready
            <span className="block font-hand text-[16px] font-normal text-walnut/75">
              waiting for the rest of the table
            </span>
          </p>
        </div>
      ) : null}
      {floorMode && service && floor && shownCustomer && partySeat ? (
        <ServiceFloor
          key={floorMode}
          mode={floorMode}
          stage={floor.stage}
          mapUrl={floor.mapUrl}
          seat={partySeat}
          customer={shownCustomer}
          line={levelGuide?.customerLine ?? shownCustomer.greeting}
          dish={{ emoji: view.emoji, name: view.title }}
          {...(servedQuality ? { quality: servedQuality } : {})}
          reducedMotion={floor.reducedMotion}
          onDone={floorDone}
          {...(cookReady && service?.prepCook
            ? { prepCook: { ...service.prepCook, onCut: sendPrepCook } }
            : {})}
        />
      ) : null}

      {cooking === "playing" && ovenStep ? (
        <OvenStep
          dish={{ emoji: view.emoji, name: view.title }}
          tray={trayItemFor(view.recipeId)}
          reducedMotion={!!floor?.reducedMotion}
          onDone={() => {
            setCooking("off");
            setPhase("result");
          }}
        />
      ) : null}

      {cooking !== "off" && !ovenStep ? (
        <CookingClip
          playing={cooking === "playing"}
          kind={dishKindFor(view.recipeId, view.title)}
          {...(orderSpecials.chaos === "rush-hour" ? { rate: CHAOS.RUSH_CLIP_RATE } : {})}
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
          previousBest={baselineBest.current}
          specials={specialsReportLines({
            chaos: orderSpecials.chaos,
            variant: orderSpecials.variant,
            grandmaBest: grandmaBest.current,
            evenness: result.evenness,
            avalanche: avalanche
              ? { sliced: avalanche.total - avalanche.left, total: avalanche.total }
              : null,
            inspection,
          })}
          onRetry={restart}
          onContinue={continueFromReport}
        />
      ) : null}

      {/* Phase 6: a dish's Kitchen Moments — a quiet chip on its completion
          screen; the card preview only when the player asks. */}
      {phase === "complete" && runKey.current && momentTick >= 0
        ? (() => {
            const moments = momentsOf(runKey.current);
            if (moments.length === 0) return null;
            return momentPreview ? (
              <MomentPreview moments={moments} onClose={() => setMomentPreview(false)} />
            ) : !momentsHidden ? (
              <MomentChip
                moments={moments}
                onOpen={() => setMomentPreview(true)}
                onDismiss={() => setMomentsHidden(true)}
              />
            ) : null;
          })()
        : null}

      {phase === "complete" ? (
        service ? (
          <ServiceOrderComplete
            hidden={holding}
            serviceOrder={
              shownCustomer ? { ...service.order, customer: shownCustomer } : service.order
            }
            personality={personality}
            onCustomerMoment={(c) => {
              if (!personality) return;
              runKey.current ??= nextRunKey(view.recipeId);
              if (
                recordMoment(
                  customerMoment({
                    runKey: runKey.current,
                    dishName: view.title,
                    personality: personality.id,
                    line: c.line,
                    ...(c.reveal ? { reveal: c.reveal } : {}),
                  }),
                )
              )
                setMomentTick((t) => t + 1);
            }}
            {...(bookNote
              ? {
                  bookNote: (
                    <BookPageNote
                      emoji={view.emoji}
                      recipeId={view.recipeId}
                      tier={bookNote.tier}
                      variant={bookNote.variant}
                    />
                  ),
                }
              : {})}
            {...(personality?.id === "impatient-regular"
              ? { prep: { ms: prepMs.current, parMs: regularPar } }
              : {})}
            {...(result ? { plateTier: tierFor(result.score, true) } : {})}
            credits={credits}
            cashAtTable={!!floor}
            {...(floor && service.onCollectTableCash
              ? {
                  // One tap takes the cash left on the table into the wallet (no swipe screen).
                  onCollectCash: () => {
                    service.onCollectTableCash!();
                    setServiceCashRemaining(0);
                    setServedCash(null);
                  },
                }
              : {})}
            {...(floor ? { cashRemainingOverride: serviceCashRemaining } : {})}
            {...(service.onCashPieceCollected
              ? { onCashPieceCollected: service.onCashPieceCollected }
              : {})}
            onCashRemaining={(left) => service.onCashRemaining?.(left)}
            {...(service.onCashCollected ? { onCashCollected: service.onCashCollected } : {})}
            onServe={() => {
              // Served together: while party-mates are still to be cooked this plate is held (paid,
              // kept back); the last one sends every plate out at once.
              const hold =
                !!floor &&
                !!partySeat &&
                partySeat.party.size > 1 &&
                partySeat.slot < partySeat.party.size - 1 &&
                (service.ticketsAfter ?? 0) > 0;
              const joinCash = !!floor && heldPlatesOf(service.order.order.id) > 0;
              const served = service.onServe({ joinCash });
              const onTable = served
                ? (served.tableCash ?? { payCents: served.coinsAwarded, tipCents: served.tip ?? 0 })
                : null;
              if (served && onTable)
                setServiceCashRemaining(served.isReplay ? 0 : onTable.payCents + onTable.tipCents);
              // The plate goes to the table only for a real serve (paid once, by App).
              if (served && floor) {
                const grade = served.quality ?? result?.qualityLabel;
                setServedQuality(grade);
                setServedCash(served.isReplay ? null : onTable);
                if (hold) {
                  markPartyHeld(
                    service.order.order.id,
                    view.emoji,
                    REACTION_FACE[grade ?? "Honest"],
                    Date.now(),
                  );
                  setHolding(true);
                  window.setTimeout(() => service.onNextOrder(), 1100);
                } else setFloorMode("deliver");
              }
              return served;
            }}
            onNextOrder={() =>
              // The level's last Next Customer completes the level: nobody's arrival follows it.
              service.endsLevel ? service.onNextOrder() : departThen(service.onNextOrder)
            }
            onRetry={restart}
            onExit={onExit}
            {...(service.prepCook?.auto ? { auto: true, onStopAuto: service.prepCook.onAuto } : {})}
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
            {...(service.extraAction
              ? {
                  extraAction: {
                    ...service.extraAction,
                    onClick: () =>
                      service.extraAction!.disabled
                        ? undefined
                        : departThen(service.extraAction!.onClick),
                  },
                }
              : {})}
          />
        ) : (
          <OrderComplete
            {...(bookNote
              ? {
                  bookNote: (
                    <BookPageNote
                      emoji={view.emoji}
                      recipeId={view.recipeId}
                      tier={bookNote.tier}
                      variant={bookNote.variant}
                    />
                  ),
                }
              : {})}
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
