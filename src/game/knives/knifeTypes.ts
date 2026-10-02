/**
 * KNIFE_TYPES — the shape of the single authoritative knife catalog
 * (Phase 8 — design doc "KNIFE COLLECTION, OWNERSHIP & WORKSHOP SYSTEM").
 *
 * CRITICAL DESIGN LAW: nothing here is allowed to become an RPG stat.
 * There is deliberately no `damage`/`power`/`attackSpeed`/`accuracyMultiplier`/
 * `scoreMultiplier` field. `weight`/`style` and the `animation`/`audio`
 * profiles below exist to change how a cut FEELS (blade silhouette, strike
 * depth, timing cadence, board nudge, pitch/gain) — never whether a level
 * can be completed, how many cuts are required, or how forgiving grading
 * is. The starter knife (chef) must never be secretly worse than any
 * knife unlocked later; every multiplier below stays close to 1.0 for
 * exactly that reason.
 *
 * Blacksmith upgrades (blacksmith.ts) follow the same law: `tuning` only
 * speeds the tap-cut cadence, widens the tap input buffer, shortens the
 * hitstop and widens a peel stroke. It never changes cut positions, how
 * many cuts a step needs, peel completion coverage, grading, or payouts —
 * every upgrade is available to every knife, including the starter chef.
 */
import type { IngredientId, TechniqueId } from "../definitions";

export type KnifeId =
  "chef" | "santoku" | "nakiri" | "paring" | "bread" | "cleaver" | "damascus" | "obsidian";

export type KnifeWeight = "light" | "balanced" | "heavy";
export type KnifeStyle = "balanced" | "vegetable" | "detail" | "bread" | "heavy" | "signature";

/**
 * Blade silhouette, parameterized off the exact same curve construction
 * `PreparationScene.drawKnife()` already uses (heel -> straight spine ->
 * curved back to a tip -> curved cutting edge back to the heel). The
 * `chef` baseline below reproduces the ORIGINAL hardcoded constants
 * (KNIFE_GEOMETRY + the 0.4/0.58/0.68/0.3/0.28/0.58 magic numbers that
 * used to live inline in drawKnife) exactly, so the default knife's
 * silhouette is pixel-identical to before this phase.
 */
export type KnifeBladeShape = {
  bladeLenFrac: number;
  bladeHFrac: number;
  handleLenFrac: number;
  /** Heel position, in blade-length units back from the pivot (negative). */
  heelAt: number;
  /** Fraction of bladeLen where the straight spine ends and the curve toward the tip begins. */
  spineBendFrac: number;
  /** Fraction of bladeLen for the spine-curve's control point. */
  spineControlXFrac: number;
  /** Fraction of bladeLen where the tip point sits. */
  tipFrac: number;
  /** Where the tip sits: (tipRiseFrac − 0.5) × bladeH from the cutting edge — negative values lift the point toward the spine (a chef's knife), positive keep it low (a santoku's sheepsfoot, a cleaver's square front). */
  tipRiseFrac: number;
  /** Fraction of bladeLen for the cutting-edge curve's control point. */
  bellyControlXFrac: number;
  /** Belly Y offset coefficient (x bladeH) — how far the edge bulges below centerline. */
  bellyFrac: number;
  /** Bread only — draws a small sawtooth notch line along the cutting edge. Visual only, no cut-geometry change. */
  serrated: boolean;
};

export type KnifeAnimationProfile = {
  blade: KnifeBladeShape;
  /** Scales tapTiming()'s PREP/PAUSE/CUT/IMPACT/RETRACT/BUFFER_TAIL/HITSTOP durations. Kept close to 1.0 — a knife should feel different, not be a stopwatch cheat. */
  timingMult: number;
  /** Scales CUT_DEPTH_FRAC — how far the blade visually plunges past the seam. */
  depthMult: number;
  /** Scales KNIFE_LIFT_FRAC — the exit lift-off height. */
  liftMult: number;
  /** Scales ANGLE_JITTER_DEG — the small natural per-cut tilt. */
  jitterMult: number;
  /** Scales the board-nudge tween distance (boardNudge()) — a heavier knife lands a touch harder. */
  weightMult: number;
};

export type KnifeAudioProfile = {
  /** Multiplies the transient/glide/thunk frequencies AudioManager.playIngredientSlice already computes from the ingredient's own profile — layered ON TOP of, never replacing, the ingredient's sound identity. */
  pitchMult: number;
  /** Multiplies the transient/glide/thunk gains. */
  gainMult: number;
};

export type KnifeVisual = {
  bladeColor: number;
  edgeHighlight: number;
  bolsterColor: number;
  handleColor: number;
  rivetColor: number;
  /** Damascus only — drawKnife() layers a few faint wavy bands across the blade when set. */
  pattern?: "damascus";
};

/**
 * Blacksmith tuning (blacksmith.ts) — absent on every catalog knife and on
 * an un-upgraded knife, i.e. exactly 1.0 for all of these. PreparationScene
 * layers them on top of `animation`:
 *   cutMult       x CUT_MS + IMPACT_MS         (Sharpness)
 *   peelWidthMult x the peel stroke width      (Sharpness; completion coverage unchanged)
 *   moveMult      x PREP_MS + PAUSE_MS + RETRACT_MS   (Speed)
 *   bufferMult    x the tap BUFFER_TAIL window (Handling)
 *   hitstopMult   x HITSTOP_MS                 (Handling)
 */
export type KnifeTuning = {
  cutMult: number;
  peelWidthMult: number;
  moveMult: number;
  bufferMult: number;
  hitstopMult: number;
};

export type KnifeDefinition = {
  id: KnifeId;
  name: string;
  tagline: string;
  description: string;
  style: KnifeStyle;
  weight: KnifeWeight;
  price: number;
  /** Numeric level requirement — 1 means available from the start. */
  unlockLevel: number;
  /** Data-driven "Best for" identity — techniques/ingredients this knife is suited to, rendered qualitatively (emoji + label) in the Workshop. Never gates what a knife CAN cut — every knife can cut everything. */
  preferredTechniques: TechniqueId[];
  preferredIngredients: IngredientId[];
  animation: KnifeAnimationProfile;
  audio: KnifeAudioProfile;
  visual: KnifeVisual;
  /** Blacksmith upgrades — only ever set on the per-player "effective" knife (blacksmith.effectiveKnife), never in the catalog. */
  tuning?: KnifeTuning;
};
