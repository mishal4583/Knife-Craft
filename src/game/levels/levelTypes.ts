/**
 * LEVEL ENGINE — data schema (Phase 4, see KnifeCraft_Design_Document.docx
 * §9.4/§10/§11/§13/§14). This module defines the shape of level data only —
 * no gameplay logic lives here (that's LevelManager.ts) and no rendering
 * (levels stay data consumed by the existing Preparation flow, §9.2 "one
 * scene, many levels").
 *
 * IMPORTANT — this schema is deliberately wider than what Phase 4 actually
 * uses. Several fields (PreparationStep chains beyond one step, Branch,
 * PreparedOutput, multi-objective services) exist so a future level (e.g.
 * Level 81's onion-branching) can be represented WITHOUT a schema rewrite,
 * per the design doc's explicit requirement (§13/§27). Phase 4 populates
 * them with the simplest valid values and does not implement the gameplay
 * they describe.
 */
import type { IngredientId, TechniqueId } from "../definitions";

/** §9 — RUSH is deliberately absent: no countdown/timer failure mode exists or will be added (Law 5). */
export type LevelType = "RELAX" | "ORDER" | "SERVICE" | "MISE_EN_PLACE" | "SPECIAL";

/**
 * §10 — what a level requires, stated as intent. The existing gameplay
 * systems (PreparationScene / GameBridge) execute the HOW; only
 * "completeRecipe" is actually evaluated by LevelManager in Phase 4 (every
 * validation level has exactly one). The rest are represented so a future
 * SERVICE/MISE_EN_PLACE level's objective list is expressible today.
 */
export type ObjectiveDefinition =
  | { type: "completeRecipe"; recipeId: string }
  | { type: "prepareIngredient"; ingredientId: IngredientId; technique: TechniqueId }
  | { type: "completeService"; recipeIds: string[] }
  | { type: "prepareBatch"; ingredientId: IngredientId; technique: TechniqueId; units: number }
  | { type: "unlockRecipe"; recipeId: string };

/**
 * §14 — data-driven unlock graph. Deliberately NOT restricted to "previous
 * level completed" so the engine can't paint itself into a linear-only
 * corner; the AND/OR nodes are exercised for real by one of the five
 * validation levels (levelDefinitions.ts), not just declared unused.
 */
export type UnlockRequirement =
  | { type: "always" }
  | { type: "levelCompleted"; levelId: string }
  | { type: "chapterCompleted"; chapter: number }
  | { type: "and"; requirements: UnlockRequirement[] }
  | { type: "or"; requirements: UnlockRequirement[] };

/**
 * §11 — one link in a future ingredient state chain (onion: whole -> peel
 * -> halve -> slice -> rings). Phase 4 levels only ever use a single-step
 * chain (whole -> the technique's own result), matching what the existing
 * cutting engine can actually produce today (§22 — no new techniques or
 * ingredient states are implemented this phase).
 */
export type PreparationStep = {
  ingredient: IngredientId;
  startingState: string;
  technique: TechniqueId;
  resultingState: string;
  destination?: string;
  optional: boolean;
  /**
   * Phase 16 — forces a fresh ingredient instance even though this step
   * shares the previous step's `ingredient` (which would otherwise CHAIN
   * onto it, see PreparationScene.beginStep's `isChain`). This is what
   * makes Levels 81-100's "one source ingredient, multiple destinations"
   * representable: the SAME ingredient prepared a second time from
   * `startingState: "whole"` again, this time toward a different
   * `destination` — two real, independently-peeled/cut instances, not one
   * ingredient literally forking mid-cut (the existing half-plane cut
   * engine has no such primitive, and none was added — see the phase
   * report). Undefined/false everywhere in Levels 1-80, so their existing
   * chain behavior is completely unchanged.
   */
  chainBreak?: boolean;
};

// §13's old `PreparedOutput` schema-only placeholder (never referenced
// anywhere) is now implemented for real by Phase 11's organization module
// — see src/game/organization/organizationTypes.ts's own `PreparedOutput`,
// the single authoritative shape, instead of two divergent ones.

/** §13 — future one-ingredient-to-many-destinations split (Levels 81-100). Schema only. */
export type Branch = {
  sourceIngredient: IngredientId;
  sourceState: string;
  outputs: { state: string; destination: string; portionSource: string }[];
};

/**
 * §26 — kept deliberately simple ("test rewards can be simple"); the
 * documented per-band coin ranges (§8.1) are a future-content concern, not
 * a Phase 4 one. `coins` is paid exactly once, on first completion
 * (Law 2 — see LevelManager.completeLevel).
 */
export type LevelReward = { coins: number };

/**
 * §Progression pass — a non-coin reward shown/granted alongside a level's
 * completion. Deliberately references an ID from an EXISTING catalog
 * rather than inventing a parallel reward-item system: "knife"/"board" ids
 * key into KNIFE_CATALOG/BOARD_CATALOG (knifeDefinitions.ts/
 * boardDefinitions.ts — reaching the level's own number already makes the
 * item purchasable there, exactly like every other catalog entry;
 * `unlockReward` only makes that moment visible in the level-select/result
 * UI, it grants nothing by itself), "cafe_milestone" keys into
 * CAFE_MILESTONES (cafeDefinitions.ts — these DO unlock automatically,
 * café-progression-style), and "story" keys into an existing MILES entry
 * (storyDefinitions.ts) purely for display — no new story state. There is
 * deliberately no "decoration" variant: no decoration catalog/ownership
 * system exists in production (src/data/mockDecor.ts is unused mock data),
 * and inventing one is out of scope for a level-progression pass.
 */
export type LevelUnlockReward = {
  type: "knife" | "board" | "cafe_milestone" | "story";
  /** The real catalog id — a KNIFE_CATALOG/BOARD_CATALOG/CAFE_MILESTONES/MILES id, never a newly-invented one. */
  id: string;
  /** Display name for the level-select/result-screen preview. */
  name: string;
};

export type LevelDefinition = {
  id: string;
  chapter: number;
  chapterId: string;
  type: LevelType;
  title: string;
  subtitle: string;
  description: string;
  /** A small glyph for HUD/Kitchen-card display — the level's own, not borrowed from a separate order catalog. */
  emoji: string;
  /**
   * Phase 5 — bookkeeping identity only (SaveManager's recipeProgress
   * map, keyed the same way pre-Level-Engine code already worked). As of
   * Phase 5 the Level Engine drives gameplay directly from
   * `preparationSteps` below (§"make sure the Level Engine is actually
   * consuming level data rather than the old flat PrepOrder flow") — this
   * is NOT looked up against src/data/orders.ts/PrepOrder anymore. It
   * defaults to the level's own `id` for every Phase 5 campaign level;
   * kept as its own field (rather than reusing `id` directly) only
   * because a future level could legitimately want to share mastery
   * tracking with another (Phase 4's "mixed preparation" test level did
   * this on purpose) without that being baked into the id itself.
   */
  recipeId: string;
  objectives: ObjectiveDefinition[];
  /**
   * Phase 5 — this is what actually DRIVES a session's gameplay now: the
   * Preparation component reads this directly and hands it to GameBridge
   * as `steps` (see events.ts's PrepStep) — one entry per {ingredient,
   * technique}. Consecutive entries sharing the same `ingredient` CHAIN
   * (Onion: whole -> halve -> slice is two entries, same ingredient);
   * entries with a different `ingredient` prepare separately and plate
   * together at the end (Level 4/8/10). A single-entry array is the
   * common case (Level 1/2/3/7/9) and behaves exactly like Phase 4's
   * single-ingredient sessions did.
   */
  preparationSteps: PreparationStep[];
  /** §13 — always empty in Phase 4; no destination-assignment gameplay exists yet. */
  destinations: string[];
  unlockRequirements: UnlockRequirement;
  reward: LevelReward;
  milestone?: string;
  /** Populated on ~a dozen genuine reward levels — see LevelUnlockReward's own doc for why not every "milestone" level gets one. */
  unlockReward?: LevelUnlockReward;
  visualTheme?: string;
};
