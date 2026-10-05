/**
 * The full contract between GameBridge and PreparationScene. Neither side
 * imports the other directly — they only agree on these event names and
 * payload shapes over a shared Phaser.Events.EventEmitter (the "bus").
 * This is what keeps React/GameBridge decoupled from Phaser internals
 * (§5 of the migration brief): swapping the scene implementation only
 * requires it still speak this contract.
 */
import type { CutPath, QualityLabel } from "@/types/game";
import type { IngredientId, TechniqueId } from "./definitions";
import type { KnifeDefinition } from "./knives/knifeTypes";
import type { BoardDefinition } from "./boards/boardTypes";

/** Bridge → Scene commands. */
export const CMD = {
  START: "cmd:start",
  PAUSE: "cmd:pause",
  RESUME: "cmd:resume",
  RESTART: "cmd:restart",
  SET_KNIFE: "cmd:setKnife",
  SET_BOARD: "cmd:setBoard",
} as const;

/**
 * Scene → Bridge events (Bridge re-emits these to React verbatim).
 * RECIPE_COMPLETED fires LAST, once the chef's hands have taken the
 * plate away — matching knifecraft.html's actual sequence
 * (finishRecipe → replay → plating → handoff → showResult), not
 * immediately after the final cut.
 */
export const EVT = {
  CUT_STARTED: "evt:cutStarted",
  CUT_COMPLETED: "evt:cutCompleted",
  STEP_STARTED: "evt:stepStarted",
  PLATING_STARTED: "evt:platingStarted",
  PLATING_COMPLETED: "evt:platingCompleted",
  CHEF_TAKE_STARTED: "evt:chefTakeStarted",
  CHEF_TAKE_COMPLETED: "evt:chefTakeCompleted",
  RECIPE_COMPLETED: "evt:recipeCompleted",
  SCENE_READY: "evt:sceneReady",
  COACH: "evt:coach",
  /** Peel steps only: how much of the skin is off (read-only HUD feedback; the peel itself is unchanged). */
  PEEL_PROGRESS: "evt:peelProgress",
} as const;

/**
 * Phase 5 — one preparation "session" is now a SEQUENCE of steps, not a
 * single fixed ingredient+technique (§"multi-ingredient preparation
 * support"). Consecutive steps sharing the same ingredientId CHAIN — the
 * scene keeps the same pieces/cuts and just switches technique (Onion
 * whole -> halve -> slice); a step with a different ingredientId starts
 * that ingredient fresh, and its finished pieces are set aside to be
 * plated together with every other step's once the LAST step completes
 * (Level 4/8/10's "prepare several things, then one shared plate"). A
 * single-entry `steps` array (every pre-Phase-5 level) behaves exactly
 * as the old single-ingredient session did — this is a strict superset,
 * not a parallel system.
 */
export type PrepStep = {
  ingredientId: IngredientId;
  techniqueId: TechniqueId;
  /** Phase 16 — mirrors PreparationStep.chainBreak (levelTypes.ts) through to the scene; see that field's own doc. */
  chainBreak?: boolean;
  /**
   * Task: "shared-destination plating composition fix" — mirrors
   * PreparationStep.destination (levelTypes.ts, already the join of every
   * destination NAME this step's component satisfies — e.g. "Bowl" or
   * "Maya's Plate & Daniel's Plate"). Previously dropped when Preparation.tsx
   * built this scene-facing type, so PreparationScene's plating renderer
   * had no way to know which final destination a finished piece belonged
   * to and fell back to grouping by ingredientId alone — see
   * startPlating()'s own doc for the bug this caused. Undefined for any
   * step whose recipe/level never set a destination name, in which case
   * every such step in the session shares one implicit destination (the
   * existing single-plate default, unchanged).
   */
  destination?: string;
};

export type StartPreparationConfig = {
  steps: PrepStep[];
  knife: KnifeDefinition;
  board: BoardDefinition;
  /** Techniques whose steps are TAUGHT with the ghost demonstration (coaching.ts). Every other step only demonstrates after a longer pause without input. */
  teach?: TechniqueId[];
};

/** Scene -> Bridge -> React: the ghost demonstration appeared/disappeared, so the HUD's how-to card shows with it. */
export type CoachPayload = { visible: boolean; techniqueId: TechniqueId };

/** Scene -> Bridge -> React: a peel step's progress, 0–1 of the way to done (covered cells ÷ the completion threshold). Display only. */
export type PeelProgressPayload = { fraction: number };

/** Scene -> Bridge -> React: which step is now active, so the HUD can show the right ingredient/technique/progress without the whole session being one fixed pair (§ "step-aware HUD"). */
export type StepStartedPayload = {
  stepIndex: number;
  totalSteps: number;
  ingredientId: IngredientId;
  techniqueId: TechniqueId;
  /** This step's own required-cut count (or "1 unit of progress" for peel/smash) — mirrors requiredCutsFor(). */
  requiredCuts: number;
};

/**
 * Per-cut transient signal only — a new-project addition for the
 * CutResultPanel toast. The Phase 1 reference doesn't grade per cut (see
 * CutEvaluator.proxyCutQuality); the authoritative score is always
 * RECIPE_COMPLETED, computed once over every committed cut position.
 */
export type CutCompletedPayload = {
  cutIndex: number;
  totalCuts: number;
  /** Which guide set this cut landed on — lets the HUD show a per-axis pip row for a grid technique (Dice). */
  axis: "h" | "v";
  ideal: CutPath;
  player: CutPath;
  proxyQuality: QualityLabel;
  isPerfect: boolean;
  /**
   * Which input produced this cut. Tap is the relaxed, forgiving mode —
   * the visual result IS the feedback, so the UI must not show a per-cut
   * precision toast (CutResultPanel) for it; that toast stays reserved
   * for swipe, the deeper mastery interaction. The end-of-recipe Knife
   * Report is unaffected either way — it's a one-time summary, not a
   * per-cut judgment.
   */
  inputMode: "tap" | "swipe";
};

export type RecipeCompletedPayload = {
  evenness: number;
  consistency: number;
  rhythmBonus: number;
  overall: number;
  qualityLabel: QualityLabel;
  idealPaths: CutPath[];
  playerPaths: CutPath[];
};
