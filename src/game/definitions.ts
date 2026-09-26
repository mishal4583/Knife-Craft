/**
 * Data-driven gameplay configuration. The PreparationScene reads these
 * instead of branching on ingredient/technique with if/else — adding a
 * new ingredient or technique later means adding an entry here, not
 * touching scene code. Phase 1 ships exactly one of each (section 44 of
 * the earlier migration brief): more can be added without a rewrite.
 *
 * The numeric constants below (resistance curves, audio profile, knife
 * geometry) are ported from the Phase 1 reference implementation at
 * `Knifecraft Phase 1 review/knifecraft.html` (its CONFIG object) — see
 * the porting report for the file-by-file mapping.
 */
import type { Axis } from "./CutGeometry";
import type { OrganicProfile, ClusterLeaf } from "./ingredientShapes";

export type TechniqueId =
  | "slice"
  | "dice"
  | "julienne"
  | "chop"
  | "halve"
  | "peel"
  | "smash"
  | "rings"
  | "radial"
  | "rockMince"
  | "chiffonade";

/**
 * The axis/snap fields are ported from knifecraft.html's per-recipe stage
 * config (`CONFIG.recipe`/`RECIPES`): every technique fits the SAME
 * general cut model (see CutGeometry.ts) — Slice is just the case where
 * `counts` is null and neither snap flag is set. `counts` (grid quota per
 * axis) and `perpSnap` make Dice; `parallelSnap` makes Julienne.
 *
 * Phase 5 additions — Chop/Halve reuse this SAME cut/piece engine (they're
 * still `interactionMode: "cut"`, just different knobs); Peel/Smash do not
 * — a skin sweep and a single press don't produce a half-plane split, so
 * PreparationScene dispatches on `interactionMode` for those two instead
 * of running them through resolveTapCut/commitCut at all. See
 * PreparationScene's interactionMode branch in handleTap/onPointerMove.
 */
export type TechniqueDefinition = {
  id: TechniqueId;
  name: string;
  description: string;
  /** How guide lines are laid out on the board before/as cuts land. "none": peel/smash draw no cut guides. "radial": evenly-spaced dashed diameters through center — see PreparationScene.drawRadialGuides. */
  guideType: "horizontal-lines" | "grid" | "parallel-free" | "none" | "radial" | "concentric";
  /** The default/starting axis a fresh stroke resolves to. Unused (but still populated) for peel/smash. */
  axis: "h" | "v";
  /** Total cuts required — for a grid technique this is counts.h + counts.v. For peel/smash this is always 1 ("fully peeled" / "one smash"), tracked as progress rather than a cut count. */
  requiredCuts: number;
  /** Non-null only for a grid technique (Dice): per-axis cut quota. */
  counts: { h: number; v: number } | null;
  /** Dice: cut 1 sets a direction, every later cut snaps to it OR its perpendicular. */
  perpSnap: boolean;
  /** Julienne: cut 1 sets a direction, every later cut is forced parallel to it. */
  parallelSnap: boolean;
  /**
   * Phase 7 addition — Radial (Apple/Orange only). A radial cut is an
   * ORDINARY half-plane Cut whose position is pinned through the
   * ingredient's own center instead of snapped to a guide slot — a line
   * `{axis, c, slope}` with `c` fixed at the center coordinate passes
   * through the center at ANY slope, so rebuildPieces/crossSegment
   * (CutGeometry.ts) need no changes at all; only PreparationScene's own
   * position resolution (finishCut/resolveTapCut) and grading
   * (closeOutCurrentIngredient/finishRecipeNow route a radialSnap segment
   * through CutEvaluator's computeRadialGrade instead of computeGrade,
   * since parallelGroups' similar-angle bucketing doesn't fit cuts that
   * are DELIBERATELY at different angles) know about this flag.
   */
  radialSnap?: boolean;
  /** knifecraft.html per-recipe `tol` override (julienne widens rather than moving the global bands). */
  tolOverride?: { evennessTol?: number; consistencyCvTol?: number };
  /**
   * Tap-to-cut input (a new-project addition, not in the reference): when
   * true, a tap resolves to a free continuous position (CutGeometry's
   * `resolveContinuousPosition` — clamp off the ends, nudge off existing
   * seams) instead of the nearest of a small fixed guide count, and
   * `requiredCuts` is recomputed at layout time to "however many pieces
   * of a sane minimum size actually fit" so the whole ingredient can be
   * worked through by repeated tapping. Swipe is unaffected either way —
   * it always uses the guide-slot system.
   */
  continuousTap: boolean;
  /** Halve only — continuousTap's forgiving free-placement stays on, but requiredCutsFor must NOT recompute this up to a whole-ingredient count; a halve is exactly `requiredCuts` (1), always. */
  fixedRequiredCuts?: boolean;
  /**
   * §"technique implementation rule" — the FOUR families of interaction:
   * "cut" runs through the existing Cut/Piece line-splitting engine
   * (Slice/Dice/Julienne/Chop/Halve — same code path, different knobs);
   * "peel" is a drag-coverage sweep with no piece split; "smash" is a
   * single decisive press with no piece split. Both non-"cut" modes still
   * reuse piece rendering (paintPieceTexture with an empty `cons` — the
   * whole silhouette, no half-plane clip), plating, audio, and the
   * knife/impact tween choreography style — only the INPUT and the
   * completion condition are genuinely different.
   *
   * Phase 6 addition — "ring": a tap-driven technique (same choreography
   * family as smash — see PreparationScene.runRingCut), but genuinely
   * different from all of the above: the existing Cut/Piece half-plane
   * engine (CutGeometry.ts) has no radial/annulus primitive, so a ring
   * piece can't be expressed as a Piece at all. Each tap peels one
   * concentric ring band off the CURRENT pieces (paintRingPieceTexture,
   * an additive annulus-clip sibling of paintPieceTexture) — self-
   * contained, exactly like peel/smash never touching rebuildPieces.
   * Only meaningful chained after Halve (Onion → Peel → Halve → Rings) —
   * see TECHNIQUES.rings and INGREDIENTS.onion.
   */
  interactionMode: "cut" | "peel" | "smash" | "ring";
  /** Chop only — selects CHOP_KNIFE's quick rhythmic timing over TAP_KNIFE's deliberate lift-pause-cut-retract cadence, so Chop feels mechanically distinct, not reskinned Slice. */
  knifeProfile?: "default" | "chop";
  /** Chop only — a tap's target position is jittered by this fraction of the min-gap band before resolveContinuousPosition clamps it, producing naturally irregular chopped pieces instead of Slice's clean even spacing. */
  placementJitterFrac?: number;
  unlockLevel: number;
};

/** Rings' own ring count — declared standalone (not inside the RINGS block below) so TECHNIQUES.rings.requiredCuts can reference it without a declaration-order problem (RINGS itself is declared further down, alongside PEEL/SMASH). */
const RING_COUNT = 4;

export const TECHNIQUES: Record<TechniqueId, TechniqueDefinition> = {
  slice: {
    id: "slice",
    name: "Slice",
    description: "Draw the blade straight through, following the guide.",
    guideType: "horizontal-lines",
    axis: "h",
    requiredCuts: 6, // knifecraft.html recipe "tomato-slice-6" — overridden per-run when continuousTap
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: true,
    interactionMode: "cut",
    unlockLevel: 1,
  },
  dice: {
    id: "dice",
    name: "Dice",
    description: "Cut one direction, then its cross — a neat grid.",
    guideType: "grid",
    axis: "h",
    requiredCuts: 6, // 3 + 3
    counts: { h: 3, v: 3 }, // knifecraft.html recipe "tomato-dice-3x3"
    perpSnap: true,
    parallelSnap: false,
    continuousTap: false, // a grid has a real target count — tap resolves to the nearest open slot instead
    interactionMode: "cut",
    unlockLevel: 1,
  },
  julienne: {
    id: "julienne",
    name: "Julienne",
    description: "Fine, parallel strokes — every cut follows the first.",
    guideType: "parallel-free",
    axis: "v",
    requiredCuts: 10, // knifecraft.html recipe "carrot-julienne-10"
    counts: null,
    perpSnap: false,
    parallelSnap: true,
    tolOverride: { evennessTol: 1.9, consistencyCvTol: 1.5 },
    continuousTap: false,
    interactionMode: "cut",
    unlockLevel: 1,
  },
  chop: {
    id: "chop",
    name: "Chop",
    description: "Short, rhythmic strikes — repeated and satisfying, never precise.",
    guideType: "horizontal-lines",
    // Ingredient-level axisOverride still wins where set (cucumber-style) —
    // this is just the fallback for an ingredient that doesn't need one.
    axis: "v",
    requiredCuts: 8, // continuousTap recomputes via requiredCutsFor, same as Slice
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: true,
    interactionMode: "cut",
    knifeProfile: "chop",
    placementJitterFrac: 0.4,
    unlockLevel: 3,
  },
  halve: {
    id: "halve",
    name: "Halve",
    description: "One decisive cut, straight through the middle.",
    guideType: "horizontal-lines",
    axis: "h",
    requiredCuts: 1,
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: true, // still a forgiving tap-anywhere-reasonable placement, just caps at 1 cut
    fixedRequiredCuts: true,
    interactionMode: "cut",
    unlockLevel: 5,
  },
  peel: {
    id: "peel",
    name: "Peel",
    description: "Follow the skin all the way around.",
    guideType: "none",
    axis: "h",
    requiredCuts: 1, // "1 unit of progress" — the scene tracks drag coverage, not a cut count
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: false,
    interactionMode: "peel",
    unlockLevel: 9,
  },
  smash: {
    id: "smash",
    name: "Smash",
    description: "One firm, satisfying press.",
    guideType: "none",
    axis: "h",
    requiredCuts: 1,
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: false,
    interactionMode: "smash",
    unlockLevel: 9,
  },
  rings: {
    id: "rings",
    name: "Rings",
    description: "Tap across the onion to peel away one ring at a time.",
    // Pre-Phase-8: was "none" (no guide drawn at all) — "concentric"
    // triggers PreparationScene's new drawRingGuides(), dashed circles at
    // the exact fractions peelOneRingLayer already consumes, so the guide
    // and the real cut geometry can never drift apart.
    guideType: "concentric",
    axis: "h",
    requiredCuts: RING_COUNT, // one tap per concentric ring — see RINGS below
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: false,
    interactionMode: "ring",
    unlockLevel: 17,
  },
  radial: {
    id: "radial",
    name: "Radial",
    description: "Cut from the center outward — even wedges, not slices.",
    guideType: "radial",
    axis: "h",
    requiredCuts: 6, // 6 diameters through center -> 12 wedge pieces
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    radialSnap: true,
    continuousTap: false,
    interactionMode: "cut", // reuses the same Cut/Piece engine as Slice/Dice/Julienne — see radialSnap's own doc
    unlockLevel: 46,
  },
  // Phase 16 additions — Chapter 6 "Aromatics"/Chapter 8 "Bistro Kitchen".
  // Both reuse the SAME "cut" interactionMode/Cut-Piece engine every other
  // cut technique already shares (no CutGeometry/CutEvaluator change) —
  // see PreparationScene's technique dispatch, which only ever branches on
  // guideType/interactionMode/perpSnap/parallelSnap/radialSnap/knifeProfile,
  // never a literal technique id (confirmed by audit before this phase).
  rockMince: {
    id: "rockMince",
    name: "Rock Mince",
    description: "Rock the blade tip-down, back and forth — fine and fragrant.",
    guideType: "horizontal-lines",
    axis: "v",
    requiredCuts: 10, // continuousTap recomputes via requiredCutsFor, same as Chop
    counts: null,
    perpSnap: false,
    parallelSnap: false,
    continuousTap: true,
    interactionMode: "cut",
    // Reuses Chop's own knife cadence (knifeProfile is checked generically
    // by value, never by technique id) — a real new rocking-knife swing
    // animation is out of this phase's scope (documented gap, see report);
    // what IS genuinely new is the id/description/finer jitter below,
    // which change the technique's feel and required-cut count, not just
    // its label.
    knifeProfile: "chop",
    placementJitterFrac: 0.55,
    unlockLevel: 56,
  },
  chiffonade: {
    id: "chiffonade",
    name: "Chiffonade",
    description: "Stacked and rolled, then cut into fine ribbons.",
    guideType: "parallel-free",
    axis: "v",
    requiredCuts: 8,
    counts: null,
    perpSnap: false,
    parallelSnap: true, // same free-angle parallel-snap family as Julienne
    continuousTap: false,
    interactionMode: "cut",
    unlockLevel: 74,
  },
};

/**
 * TAP_KNIFE — tap-to-cut's idle rest pose and IDLE→PREP→CUT→IMPACT→RETRACT
 * animation timings (a new-project addition — the reference is swipe-
 * only). Fractions are of canvas width, following this file's existing
 * convention; offsets are relative to the ingredient's own computed
 * bounds, never a fixed screen coordinate (§26 of the design brief).
 */
export const TAP_KNIFE = {
  // Idle: resting on the board beside the ingredient, not over it (§10) —
  // right of its edge and a little below its center, never above (an
  // idle knife floating above the vegetable reads as about to strike).
  IDLE_OFFSET_X_FRAC: 0.09, // past the ingredient's right edge
  IDLE_OFFSET_Y_FRAC: 0.05, // below the ingredient's center
  IDLE_ANGLE_DEG: -20,
  // Prep: lifted above the cut point, leaning slightly toward it (§7).
  PREP_OFFSET_X_FRAC: 0.03,
  PREP_ABOVE_FRAC: 0.16,
  // Cut: how far past the seam the blade visually plunges (§7's "contact
  // the board surface, not float above it").
  CUT_DEPTH_FRAC: 0.03,
  // A small natural tilt so the blade never reads as mathematically
  // vertical/robotic (§8) — randomized per cut within this range.
  ANGLE_JITTER_DEG: 4,
  PREP_MS: 100,
  PAUSE_MS: 55,
  CUT_MS: 130,
  IMPACT_MS: 40,
  RETRACT_MS: 130,
  // How close to the end of the current sequence a new tap still buffers
  // instead of being dropped (§17).
  BUFFER_TAIL_MS: 80,
  // Reuses the SAME hitstop mechanic Perfect Slice already uses (a short
  // delay before the piece-reveal tween starts — §12's "thunk, not a
  // freeze"), just a touch lighter so Perfect Slice's own hitstop
  // (PERFECT.HITSTOP_MS, 50ms) stays the strongest beat in the game.
  HITSTOP_MS: 40,
  // A tap this far outside the ingredient's own bounds still counts (§19).
  TAP_TOLERANCE_FRAC: 0.035,
  // §4's placement rules for a continuous-tap technique. This is a SMALL
  // residual safety margin against a literal zero-width edge piece, not
  // a second independent shrink on top of the ingredient's own band
  // (bandTopClear/bandBotFrac/bandSideFrac already IS the real cuttable-
  // region margin — see resolveContinuousPosition's own doc comment for
  // why stacking a second 13%-of-band margin here used to exclude a huge
  // swath of visibly-cuttable ingredient near every edge).
  MIN_EDGE_FRAC: 0.03,
  MIN_GAP_FRAC: 0.07,
} as const;

/**
 * How many cuts a continuous-tap technique's band can actually hold at
 * TAP_KNIFE's own MIN_EDGE_FRAC/MIN_GAP_FRAC margins — derived from the
 * SAME constants `resolveContinuousPosition` clamps against, so the pip
 * count PreparationScene reports and the count the HUD renders (Preparation.tsx
 * reads this too) can never drift apart (§25's "consistent by
 * construction"). A non-continuous technique just reports its fixed
 * `requiredCuts` (Dice/Julienne — unchanged, guide-slot driven).
 */
export function requiredCutsFor(technique: TechniqueDefinition): number {
  // Halve is continuousTap (still a forgiving tap-anywhere placement) but
  // must never get recomputed up to a whole-ingredient count the way
  // Slice/Chop do — it's a single decisive cut by definition.
  if (!technique.continuousTap || technique.fixedRequiredCuts) return technique.requiredCuts;
  const usable = 1 - 2 * TAP_KNIFE.MIN_EDGE_FRAC;
  const count = Math.floor(usable / TAP_KNIFE.MIN_GAP_FRAC) - 1;
  return Math.max(6, Math.min(20, count));
}

/**
 * Phase 18 — cluster Chop override. The Claude Design port's own Phase
 * 17A report found that chopping a CLUSTER ingredient (separate leaves/
 * florets with real gaps — Basil, Parsley, Broccoli, etc.) with the same
 * parallel/continuousTap cut set every non-cluster Chop ingredient uses
 * (Onion, Potato, Carrot, Garlic) is visually indistinguishable from
 * Chiffonade — both just produce parallel ribbons. Crossing the cuts
 * (Dice's own grid fields: `counts` + `perpSnap`) gives the irregular
 * fragments Chop is supposed to produce, for free — every grid cell meets
 * a different part of the cluster, so no two fragments are the same shape.
 *
 * This is NOT a new technique id, and it does NOT touch the shared `chop`
 * TechniqueDefinition every other ingredient still uses unmodified —
 * Onion/Potato/Carrot/Garlic's own Chop is untouched by this. It's
 * resolved once per ingredient, at the same PreparationScene.beginStep
 * choke point that already assigns `this.technique`/`this.ingredient` —
 * see its call site for why that's the only place this needs to happen.
 */
export const CLUSTER_CHOP_GRID = { h: 3, v: 3 } as const;

export function resolveTechniqueFor(
  technique: TechniqueDefinition,
  ingredient: IngredientDefinition,
): TechniqueDefinition {
  if (technique.id !== "chop" || ingredient.shape !== "cluster") return technique;
  return {
    ...technique,
    guideType: "grid",
    counts: CLUSTER_CHOP_GRID,
    perpSnap: true,
    parallelSnap: false,
    continuousTap: false,
    requiredCuts: CLUSTER_CHOP_GRID.h + CLUSTER_CHOP_GRID.v,
  };
}

/**
 * CHOP_KNIFE — Chop's own IDLE→PREP→CUT→IMPACT→RETRACT timing, selected
 * instead of TAP_KNIFE whenever `technique.knifeProfile === "chop"`
 * (PreparationScene.runTapCut). Deliberately NOT a reskin of Slice's
 * cadence: PREP barely lifts the blade (a short hop, not a wind-up above
 * the ingredient), there's no PAUSE beat at the top, and RETRACT only
 * partway — the knife stays poised low, near the board, ready for the
 * next strike, instead of sailing back out to the idle rest pose between
 * every chop. The net feel is quick, repeated, rhythmic strikes — "chop
 * chop chop" — versus Slice's single deliberate lift-glide-cut.
 */
export const CHOP_KNIFE = {
  PREP_ABOVE_FRAC: 0.05, // vs TAP_KNIFE's 0.16 — a hop, not a wind-up
  PREP_OFFSET_X_FRAC: 0.015,
  CUT_DEPTH_FRAC: 0.025,
  ANGLE_JITTER_DEG: 6, // a little rougher than Slice's 4 — chopping isn't a precise draw
  PREP_MS: 55,
  PAUSE_MS: 15,
  CUT_MS: 80,
  IMPACT_MS: 30,
  RETRACT_MS: 60, // short hop back up, not a full return to idleKnifePose
  BUFFER_TAIL_MS: 60,
  HITSTOP_MS: 25, // lighter than Slice's tap hitstop — Chop's whole appeal is the rhythm, not a series of freeze-frames
} as const;

/**
 * PEEL — a real spatial drag-coverage gesture (no cut geometry at all):
 * every valid swipe segment stamps a peel-width band onto a coarse,
 * normalized (ingredient-local, resize-independent) coverage grid — see
 * PreparationScene.onPeelMove/markPeelGridCovered — so coverage tracks
 * actual NEW surface area removed, not raw pointer-travel distance.
 * Retracing an already-peeled patch marks no new cells and earns no
 * additional credit; only movement over the ingredient's real silhouette
 * counts at all. Forgiving by construction — several short, separate
 * drags accumulate rather than resetting, there's no minimum speed, and
 * completion targets a convincingly-peeled look (COMPLETION_THRESHOLD),
 * not literal 100% coverage.
 */
export const PEEL = {
  /** Fraction of the ingredient's true silhouette area (by grid cell count) that must be marked peeled before completePeel() fires and cleans up any remaining skin islands. */
  COMPLETION_THRESHOLD: 0.8,
  /** Peel stroke half-width, as a fraction of the ingredient's own average half-extent ((rx+ry)/2 or (rx+rBig)/2) — expressed in the same normalized ingredient-local units the coverage grid and mask replay both use, so it scales with the ingredient/viewport automatically rather than being a fixed pixel width. Per-ingredient override: IngredientDefinition.peelConfig?.strokeWidthFrac. */
  STROKE_WIDTH_FRAC: 0.34,
  /** Coarse coverage-grid resolution (ingredient-local normalized units, not screen pixels) — cheap and deterministic, used ONLY to decide how much of the silhouette is newly covered; the visual reveal is a smooth stroke replay (see redrawIngredientTexture's paintPeelableLayer), not this grid. */
  GRID_COLS: 22,
  GRID_ROWS: 16,
  REVEAL_MS: 260,
} as const;

/** Per-ingredient Peel tuning — every field optional, falling back to the shared PEEL constants above. Only add a field here when an ingredient genuinely needs to deviate (§18 — "do NOT create unnecessary configuration"). */
export type PeelConfig = {
  strokeWidthFrac?: number;
  completionThreshold?: number;
};

/**
 * SMASH — a single decisive press: PREP (lift) -> PRESS (plunge, flatten
 * the piece) -> HOLD (a beat at full compression, the "thunk") -> RELEASE
 * (knife lifts away, piece stays flattened). One press, never rapid
 * tapping, never a QTE — the whole sequence is time-driven, not input-
 * driven, once the single tap starts it.
 */
export const SMASH = {
  PREP_ABOVE_FRAC: 0.1,
  PREP_MS: 120,
  PRESS_MS: 90,
  HOLD_MS: 70,
  RELEASE_MS: 160,
  /** How much the piece visually flattens (scaleY) and widens (scaleX) on impact. */
  SQUASH_Y: 0.62,
  SQUASH_X: 1.22,
} as const;

/**
 * RINGS — Onion → Halve → Rings only. Same PREP→PRESS→IMPACT→RETRACT
 * choreography family as SMASH (a single tap, time-driven once started),
 * but each tap peels ONE concentric ring off the current pieces instead
 * of squashing — see PreparationScene.runRingCut/peelOneRingLayer.
 * RING_COUNT rings are shed per tap sequence, evenly dividing the
 * halved piece's own outer radius down to nothing (see TECHNIQUES.rings,
 * which reads RING_COUNT for its requiredCuts).
 */
export const RINGS = {
  RING_COUNT,
  PREP_ABOVE_FRAC: 0.1,
  PREP_MS: 110,
  PRESS_MS: 90,
  HOLD_MS: 60,
  RELEASE_MS: 150,
} as const;

/** A resistance keyframe [t 0..1 through the cut, resistance 0..1]. Shapes how the reveal eases: skin resists, then glides, then a soft exit release. */
export type ResistanceCurve = [number, number][];

export type IngredientAudioProfile = {
  filterMin: number;
  filterMax: number;
  transQ: number;
  transPeak: number;
  transVel: number;
  atkFast: number;
  atkSlow: number;
  transDecay: number;
  glideType: "lowpass" | "bandpass" | "highpass";
  glideMin: number;
  glideSpan: number;
  glideQ: number;
  glidePeak: number;
  glideVel: number;
  tailMs: number;
  tailVel: number;
  thunkHz: number;
  thunkDrop: number;
  thunkGain: number;
  thunkVel: number;
};

/**
 * Protein-only: the pale interior band a real cut opens, ported from
 * knifecraft.html's `face:{px,inset,stops}` record (source `:1323` for
 * chicken, the same mechanism the source's own baguette crumb uses via
 * `paintCutFaces`). Consumed per-piece, per-cut-edge, by
 * PreparationScene's own `paintProteinCutFace` (see its doc) — NOT by
 * the shared whole-ingredient canvas/`hasCut` mechanism every other
 * SKIN_KEEP texture file uses, since a face band's gradient runs along
 * that specific cut's own normal, which differs per cut edge on the
 * same piece (e.g. a diced protein has two). Undefined for every
 * non-protein ingredient — nothing else in production reads this field.
 */
export type ProteinFaceConfig = {
  /** Band half-width, authored px (scaled by the ingredient's own on-board size at render time). */
  px: number;
  /** How far the surface survives inward around every cut face, authored px. */
  inset: number;
  /** Gradient stops along the cut normal: [0..1 position, CSS color]. */
  stops: [number, string][];
};

/** Protein-only: the depth-wall's per-piece cut-edge roll-off — ported from knifecraft.html's `depth.edge:{px,stops}`. See `ProteinDepthConfig`'s own doc. */
export type ProteinDepthEdgeConfig = {
  px: number;
  stops: [number, string][];
};

/**
 * Protein-only 2.5D thickness system, ported from knifecraft.html's
 * `depth:{px,slab,spread,lit,mid,low,rim,edge}` record (source `:1328`
 * for chicken). Three cooperating pieces in PreparationScene, all keyed
 * off this one record being present: a per-piece sidewall extruded
 * along one world-space direction (tones walked darker from the
 * ingredient's own flesh palette, never white/grey), a piece fan-out
 * proportional to distance from each cut set's own middle (so a row of
 * slices actually parts instead of reading as one body with lines on
 * it), and the `edge` roll-off above. Undefined for every one of the
 * other 49 ingredients — nothing about their rendering changes.
 */
export type ProteinDepthConfig = {
  px: number;
  slab: number;
  spread: number;
  lit: string;
  mid: string;
  low: string;
  rim: string;
  edge: ProteinDepthEdgeConfig;
};

export type IngredientId =
  | "tomato"
  | "carrot"
  | "cucumber"
  | "onion"
  | "potato"
  | "garlic"
  | "basil"
  | "parsley"
  | "mushroom"
  | "pepper"
  | "zucchini"
  | "bread"
  | "strawberry"
  | "apple"
  | "orange"
  // ===== Phase 18 — Claude Design ingredient merge (34 new ids) =====
  | "eggplant"
  | "broccoli"
  | "corn"
  | "celery"
  | "lettuce"
  | "cabbage"
  | "cauliflower"
  | "spinach"
  | "asparagus"
  | "radish"
  | "beetroot"
  | "sweetpotato"
  | "greenbean"
  | "fennel"
  | "artichoke"
  | "peapod"
  | "pumpkin"
  | "turnip"
  | "lemon"
  | "avocado"
  | "pear"
  | "peach"
  | "pineapple"
  | "watermelon"
  | "mango"
  | "kiwi"
  | "pomegranate"
  | "grapes"
  | "coconut"
  | "cheddar"
  | "mozzarella"
  | "butter"
  | "tofu"
  | "baguette"
  // ===== Proteins — Claude Design final freeze, genuinely new ids =====
  // (chicken/steak/salmon — NOT "meat"/"fish", see CHICKEN_GEOMETRY's own doc)
  | "chicken"
  | "steak"
  | "salmon"
  // ===== New-ingredient integration pack (5 new ids) — ported from the
  // KNIFECRAFT-NEW-INGREDIENTS package's `01-ingredients.js`. IDs are the
  // package's own exact ids (not the brief's descriptive placeholders):
  // Green Chili is `chilli`, Green Onion/Scallion is `springonion`. =====
  | "ginger"
  | "chilli"
  | "lime"
  | "cilantro"
  | "springonion";

/**
 * Which Silhouette factory (ingredientShapes.ts) an ingredient's geometry
 * uses. Cucumber shares "taper" with carrot — see PreparationScene's
 * per-ingredient geometry lookup. "organic" (Pre-Phase-8) is an
 * angular-radius-profile shape — see OrganicProfile/makeOrganicSilhouette
 * in ingredientShapes.ts; kept as live infrastructure even though no
 * ingredient currently uses it (Basil/Parsley moved to "cluster" in
 * Phase 18 — see their own doc comments) rather than deleted, since
 * removing a working shape family isn't required by this phase and isn't
 * free of risk. Phase 18 additions: "cluster" (a bunch of separate lobes
 * with real gaps — herbs, florets, bundles — see makeClusterSilhouette)
 * and "block" (a straight-edged solid — cheese/tofu/butter — see
 * makeBlockSilhouette), both in ingredientShapes.ts. "fillet" (Claude
 * Design final freeze) is the one family added for the three proteins
 * only — two independent rails, the one silhouette every other family
 * is too mirror-symmetric to carry (see makeFilletSilhouette's own
 * doc); no existing ingredient uses or is affected by it.
 */
export type IngredientShape =
  "ellipse" | "taper" | "capsule" | "organic" | "polygon" | "cluster" | "block" | "fillet";

export type IngredientDefinition = {
  id: IngredientId;
  name: string;
  category: string;
  techniques: TechniqueId[];
  shape: IngredientShape;
  difficulty: number;
  /** knifecraft.html INGREDIENTS.<id>.resistance — skin -> glide -> exit. */
  resistance: ResistanceCurve;
  audio: IngredientAudioProfile;
  /** knifecraft.html geom.bandTopClear/bandBotFrac/bandSideFrac — the playable band's edges as fractions of the ingredient's own half-extents (see CutGeometry.bandRangeFor). */
  bandTopClear: number;
  bandBotFrac: number;
  bandSideFrac: number;
  /**
   * A new-project addition: which axis a TAP (no drag direction to read)
   * defaults to for this ingredient, overriding the technique's own
   * default (`TechniqueDefinition.axis`). Undefined for carrot — its
   * technique's own axis is already the right cut direction. Cucumber
   * lies flat with its length along world X, so a cut that actually
   * produces rounds has to run perpendicular to that length — axis "v" —
   * even though its technique (Slice) defaults to "h". Tomato sets the
   * same "v" override for a different reason: not anatomy, a direct
   * player request for a vertical tap-cut direction (see its own doc). A
   * swipe still follows whatever direction the player actually drags;
   * this only supplies the direction a tap, which has none, should
   * assume.
   */
  axisOverride?: Axis;
  /** Per-ingredient Peel tuning override — see PeelConfig's own doc. Undefined for every ingredient that's happy with the shared PEEL defaults. */
  peelConfig?: PeelConfig;
  /**
   * True for an ingredient whose Peel technique is INDEPENDENT of its
   * cutting techniques — Peel and Slice/Dice/Halve/Chop/Julienne can each
   * be selected and used on their own, in any order, with no forced
   * sequencing. Two things follow from this flag:
   *
   * 1. PreparationScene.requiresPeelFirst() skips its normal "peel before
   *    anything else" gate for this ingredient — without it, simply
   *    having "peel" in `techniques` would silently block every other
   *    technique (the same gate Onion/Potato/Garlic rely on) until
   *    peeled, which would break Cucumber's 24 existing campaign level
   *    steps that cut it directly with no peel step at all.
   * 2. The SKIN_KEEP-style shared-canvas skin/flesh reveal these
   *    ingredients bake in (see kiwiTexture.ts's own doc) is keyed off
   *    `this.peeled` (the real, spatial Peel technique) instead of
   *    `this.cuts.length` — see PreparationScene's paintPeelableLayer
   *    call sites. A plain cut no longer globally reveals the flesh; only
   *    genuinely peeling does. Cutting an ingredient that was never
   *    peeled shows its intact exterior at the cut faces — a deliberate
   *    consequence of decoupling the two operations, not a bug.
   *
   * Onion/Potato/Garlic/Pineapple/Watermelon/Coconut do NOT set this —
   * Peel remains mandatory-first for them, unchanged from the previous
   * phase.
   */
  peelDecoupled?: boolean;
  /** Protein-only — see ProteinFaceConfig's own doc. Undefined for every other ingredient (48 of 52 after this phase). */
  face?: ProteinFaceConfig;
  /** Protein-only — see ProteinDepthConfig's own doc. Undefined for every other ingredient. No SKIN entry exists for any protein in the source, so `peelConfig`/`peelDecoupled` are never set alongside this. */
  depth?: ProteinDepthConfig;
};

export const INGREDIENTS: Record<IngredientId, IngredientDefinition> = {
  tomato: {
    id: "tomato",
    name: "Tomato",
    category: "Vegetable",
    techniques: ["slice", "dice"],
    shape: "ellipse",
    difficulty: 1,
    // Player-requested change: Slice's own default axis ("h" — horizontal
    // cut lines, stacking rounds top-to-bottom) was the original,
    // anatomically-defensible choice, but a tap cut is now asked to run
    // top-to-bottom instead (vertical cut lines, wedging the tomato
    // left-to-right) — same axisOverride mechanism cucumber/carrot-shaped
    // ingredients already use, see its own doc. Dice is unaffected (it
    // already guides on both axes via `counts`, regardless of this field).
    axisOverride: "v",
    // A minimal, geometry-justified margin — just enough that a cut
    // literally at the pole doesn't produce a razor-sliver piece.
    // Almost the entire visible tomato is meant to be reachable (§10/§11
    // of the boundary-fix brief); this used to be 0.05/0.94/0.92, which
    // — stacked with resolveContinuousPosition's OWN edge margin — left
    // roughly a third of the visible top/bottom uncuttable.
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    resistance: [
      [0, 0.75],
      [0.12, 0.3],
      [0.5, 0.1],
      [0.85, 0.15],
      [1, 0.4],
    ],
    audio: {
      filterMin: 550,
      filterMax: 2800,
      transQ: 1.2,
      transPeak: 0.28,
      transVel: 0.34,
      atkFast: 0.006,
      atkSlow: 0.014,
      transDecay: 0.05,
      glideType: "lowpass",
      glideMin: 380,
      glideSpan: 900,
      glideQ: 0.9,
      glidePeak: 0.16,
      glideVel: 0.14,
      tailMs: 240,
      tailVel: 0.9,
      thunkHz: 95,
      thunkDrop: 50,
      thunkGain: 0.4,
      thunkVel: 0.55,
    },
  },
  carrot: {
    id: "carrot",
    name: "Carrot",
    category: "Vegetable",
    // "slice" is a genuinely supported, already-compatible technique for
    // this shape (it's the exact same horizontal taper cucumber uses,
    // just with a wide-to-narrow taper instead of near-uniform width) —
    // added so carrot has a real non-parallelSnap-locked path through
    // the SAME shared cut resolver, not a special case. julienne-carrot
    // is unaffected: its own parallelSnap rule is unchanged and correct
    // (§6/§7 of the boundary-fix brief — "julienne" itself is SUPPOSED
    // to force every cut parallel to the first; that isn't the bug).
    // "chop" added for the Level 3/8 campaign — same taper geometry,
    // same shared cut engine, just Chop's own knifeProfile/jitter knobs.
    // "dice" added for Phase 6 (Level 23) — same grid/perpSnap mechanism
    // Tomato's Dice already uses; the half-plane grid engine is shape-
    // agnostic (bandRangeFor/rebuildPieces read the silhouette generically,
    // not an ellipse-specific formula), so this is purely additive and
    // does not change julienne/slice/chop's own behavior.
    techniques: ["julienne", "slice", "chop", "dice"],
    shape: "taper",
    difficulty: 2,
    // bandSideFrac is the operative one (carrot's cuts run along its
    // length, axis "v"). Tightened from 0.85 — still a bit more
    // conservative than tomato/cucumber since the tip genuinely narrows
    // toward near-zero width, but the old value excluded far more of
    // the visible root than that taper alone justifies.
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.94,
    // knifecraft.html INGREDIENTS.carrot.resistance — rigid entry, then a sharp snap.
    resistance: [
      [0, 0.95],
      [0.18, 0.62],
      [0.42, 0.1],
      [0.8, 0.14],
      [1, 0.3],
    ],
    audio: {
      filterMin: 1500,
      filterMax: 5400,
      transQ: 2.6,
      transPeak: 0.34,
      transVel: 0.26,
      atkFast: 0.002,
      atkSlow: 0.004,
      transDecay: 0.026,
      glideType: "lowpass",
      glideMin: 460,
      glideSpan: 520,
      glideQ: 1.4,
      glidePeak: 0.07,
      glideVel: 0.05,
      tailMs: 58,
      tailVel: 0.4,
      thunkHz: 72,
      thunkDrop: 40,
      thunkGain: 0.52,
      thunkVel: 0.6,
    },
  },
  cucumber: {
    id: "cucumber",
    name: "Cucumber",
    category: "Vegetable",
    // "julienne" added for Phase 7 (Level 42) — same free-angle parallel-
    // snap engine carrot's julienne already uses, just against cucumber's
    // own near-uniform taper; purely a technique-list addition, doesn't
    // touch slice's own behavior. "peel" added later — see peelDecoupled's
    // own doc on why it's appended last and doesn't gate Slice/Julienne
    // the way Onion/Potato/Garlic's own "peel" does (Cucumber is
    // campaign-critical from Level 2 on, always cut directly with no
    // peel step in any existing level).
    techniques: ["slice", "julienne", "peel"],
    peelDecoupled: true,
    // Phase 18 (corrected) — a real `shape:'capsule'` in the actual
    // Claude Design source (confirmed by direct grep, not assumed), not a
    // taper with near-equal ends. See CUCUMBER_GEOMETRY's own doc.
    shape: "capsule",
    difficulty: 1,
    // Lies flat, length along X, like carrot — a tap's default cut runs
    // perpendicular to that (axis "v"), producing rounds; see
    // axisOverride's own doc comment.
    axisOverride: "v",
    // bandSideFrac is the one that matters here (axis "v" bands against
    // rx, the half-length). Cucumber's ends are blunt/rounded (both cap-
    // rounding ratios are 1.0 — see CUCUMBER_GEOMETRY), not a genuine
    // taper to a point like carrot's, so they deserve a margin closer to
    // tomato's than to carrot's. bandTopClear/bandBotFrac only apply if
    // a swipe ever forces axis "h" instead — carried over from carrot's
    // own values so that stays sane rather than unused.
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.96,
    // Crisp: thin skin gives way fast, almost no drag through the flesh,
    // a clean, light exit — unlike tomato's soft give or carrot's rigid
    // entry and hard snap.
    resistance: [
      [0, 0.55],
      [0.15, 0.2],
      [0.5, 0.08],
      [0.85, 0.12],
      [1, 0.22],
    ],
    audio: {
      filterMin: 900,
      filterMax: 3800,
      transQ: 1.8,
      transPeak: 0.3,
      transVel: 0.3,
      atkFast: 0.003,
      atkSlow: 0.007,
      transDecay: 0.032,
      glideType: "lowpass",
      glideMin: 420,
      glideSpan: 640,
      glideQ: 1.0,
      glidePeak: 0.1,
      glideVel: 0.08,
      tailMs: 130,
      tailVel: 0.6,
      thunkHz: 84,
      thunkDrop: 44,
      thunkGain: 0.42,
      thunkVel: 0.5,
    },
  },
  onion: {
    id: "onion",
    name: "Onion",
    category: "Vegetable",
    // Level 5's chain (whole -> peel -> halve -> slice) and Level 10's
    // (whole -> peel -> chop) are both real, data-driven paths through
    // the same shared engine — no ingredient-specific gameplay branch
    // anywhere. A real onion is peeled before it's cut, same as garlic.
    // "rings" added for Level 17's Peel -> Halve -> Rings chain — see
    // TECHNIQUES.rings/RINGS; only onion supports it.
    // "dice" added for Phase 16 (Levels 81/85 — onion split between rings
    // and dice destinations) — same grid/perpSnap mechanism every other
    // dice-capable ingredient already uses, purely additive.
    techniques: ["peel", "halve", "slice", "chop", "rings", "dice"],
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.03,
    bandBotFrac: 0.97,
    bandSideFrac: 0.96,
    // Papery skin gives with a crackle, then a crisp, watery body —
    // between tomato's soft give and cucumber's clean snap.
    resistance: [
      [0, 0.6],
      [0.1, 0.32],
      [0.5, 0.12],
      [0.85, 0.18],
      [1, 0.34],
    ],
    audio: {
      filterMin: 1100,
      filterMax: 4200,
      transQ: 2.0,
      transPeak: 0.32,
      transVel: 0.3,
      atkFast: 0.002,
      atkSlow: 0.005,
      transDecay: 0.03,
      glideType: "bandpass",
      glideMin: 500,
      glideSpan: 760,
      glideQ: 1.2,
      glidePeak: 0.12,
      glideVel: 0.1,
      tailMs: 150,
      tailVel: 0.55,
      thunkHz: 88,
      thunkDrop: 46,
      thunkGain: 0.4,
      thunkVel: 0.5,
    },
  },
  potato: {
    id: "potato",
    name: "Potato",
    category: "Vegetable",
    // Level 6's chain (whole -> peel -> halve -> chop) — reuses the exact
    // same multi-step machinery as onion's, just a different tail. A real
    // potato is peeled before it's cut.
    // "dice" added for Phase 16 (Level 72 "Potato Family": Trim -> Halve ->
    // Dice — "Trim" is implemented as this same Peel technique, since
    // trimming a potato's skin away IS peeling it; a separate near-
    // duplicate technique wasn't worth the extra peel-first-guard risk —
    // see the phase report's documented gap).
    techniques: ["peel", "halve", "chop", "dice"],
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.03,
    bandBotFrac: 0.97,
    bandSideFrac: 0.95,
    // Dense and starchy — resists through almost the whole stroke, no
    // clean glide phase the way a watery vegetable has.
    resistance: [
      [0, 0.85],
      [0.15, 0.55],
      [0.5, 0.28],
      [0.85, 0.32],
      [1, 0.48],
    ],
    audio: {
      filterMin: 350,
      filterMax: 1600,
      transQ: 0.9,
      transPeak: 0.24,
      transVel: 0.28,
      atkFast: 0.01,
      atkSlow: 0.02,
      transDecay: 0.06,
      glideType: "lowpass",
      glideMin: 260,
      glideSpan: 520,
      glideQ: 0.8,
      glidePeak: 0.14,
      glideVel: 0.12,
      tailMs: 200,
      tailVel: 0.7,
      thunkHz: 62,
      thunkDrop: 34,
      thunkGain: 0.5,
      thunkVel: 0.6,
    },
  },
  garlic: {
    id: "garlic",
    name: "Garlic",
    category: "Aromatic",
    // Peel (drag-coverage, no cut split) then Smash (single press, no cut
    // split) — genuinely different interaction families, not slicing
    // reskinned. See TechniqueDefinition.interactionMode.
    // "chop"/"rockMince" added for Phase 16 (Chapter 6 "Aromatics") — the
    // chapter's whole point is garlic worked fine ("Garlic Mince" reuses
    // Chop with a "minced" resultingState; "Rocking Knife"/L56+ introduces
    // the genuinely new Rock Mince technique on top of it).
    techniques: ["peel", "smash", "chop", "rockMince"],
    // A real clove is a teardrop, not an oval — same taper silhouette
    // carrot/cucumber already use (rounded base tapering to a real
    // point), not the ellipse factory. See GARLIC_GEOMETRY/garlicTexture.ts.
    shape: "taper",
    difficulty: 1,
    // Bands are unused by peel/smash's own input handling (neither is
    // "cut"-mode) but kept sane in case a future technique on this
    // ingredient IS cut-mode.
    bandTopClear: 0.04,
    bandBotFrac: 0.96,
    bandSideFrac: 0.95,
    // Small and dry — a quick, light give.
    resistance: [
      [0, 0.5],
      [0.15, 0.25],
      [0.5, 0.1],
      [0.85, 0.15],
      [1, 0.25],
    ],
    audio: {
      filterMin: 1800,
      filterMax: 6200,
      transQ: 3.0,
      transPeak: 0.22,
      transVel: 0.2,
      atkFast: 0.0015,
      atkSlow: 0.003,
      transDecay: 0.02,
      glideType: "bandpass",
      glideMin: 700,
      glideSpan: 400,
      glideQ: 1.6,
      glidePeak: 0.05,
      glideVel: 0.04,
      tailMs: 40,
      tailVel: 0.3,
      thunkHz: 100,
      thunkDrop: 55,
      thunkGain: 0.34,
      thunkVel: 0.4,
    },
  },
  // ---- Phase 6 (Levels 11-30, COMBINE band) additions below ----
  basil: {
    id: "basil",
    name: "Basil",
    category: "Herb",
    // Chop only (Level 11/18) — a leafy bunch, not a body with a skin to
    // peel or a center to halve.
    // "chiffonade" added for Phase 16 (Level 74 "Herb Family" — stacked,
    // rolled, cut into fine ribbons; the SAME parallel-snap cut engine
    // Julienne already uses, just against basil's own organic silhouette).
    techniques: ["chop", "chiffonade"],
    // Phase 18: upgraded from Pre-Phase-8's single-body "organic" shape to
    // a real CLUSTER — 8 separate ovate leaf lobes + 5 stems (BASIL_LEAVES,
    // ported from the Claude Design prototype's own tuned leaf data,
    // scaled by this phase's real-cm normalization pass) instead of one
    // closed angular-radius body. This is the fix for the fused-blob
    // problem the organic shape could never solve — see
    // makeClusterSilhouette's own doc. Chop resolves to a grid via
    // resolveTechniqueFor (cluster ingredients only); Chiffonade is
    // unchanged, a parallel-snap cut set through separate leaves already
    // produces leafy ribbons.
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    // Soft and quick — barely any resistance, no rigid entry.
    resistance: [
      [0, 0.35],
      [0.1, 0.15],
      [0.5, 0.06],
      [0.85, 0.1],
      [1, 0.18],
    ],
    audio: {
      filterMin: 700,
      filterMax: 3200,
      transQ: 1.4,
      transPeak: 0.2,
      transVel: 0.22,
      atkFast: 0.003,
      atkSlow: 0.006,
      transDecay: 0.03,
      glideType: "lowpass",
      glideMin: 420,
      glideSpan: 620,
      glideQ: 0.9,
      glidePeak: 0.08,
      glideVel: 0.06,
      tailMs: 90,
      tailVel: 0.4,
      thunkHz: 110,
      thunkDrop: 40,
      thunkGain: 0.24,
      thunkVel: 0.3,
    },
  },
  parsley: {
    id: "parsley",
    name: "Parsley",
    category: "Herb",
    // Same treatment as Basil (Level 13/18) — differentiated by palette
    // and a finer curly-texture paint (see parsleyTexture.ts), not a
    // reskin: a deeper saturated green and a slightly brighter, more
    // clipped audio profile so the two herbs don't sound identical either.
    // Pre-Phase-8: also a genuinely different SILHOUETTE from Basil — a
    // smaller, near-circular, high-frequency frilly/jagged edge (organic
    // shape, see PARSLEY_GEOMETRY/PARSLEY_PROFILE) instead of Basil's
    // smooth elongated leaf, so the two read as different plants even
    // both green at a glance, not just by palette.
    // "chiffonade" added for Phase 16, mirroring basil's own addition.
    // Phase 18: upgraded to "cluster" (PARSLEY_LEAVES — 20 small frilly
    // leaflets + 6 stems) for the same reason as Basil — see its own doc.
    techniques: ["chop", "chiffonade"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    resistance: [
      [0, 0.3],
      [0.1, 0.12],
      [0.5, 0.05],
      [0.85, 0.08],
      [1, 0.15],
    ],
    audio: {
      filterMin: 900,
      filterMax: 3800,
      transQ: 1.6,
      transPeak: 0.18,
      transVel: 0.2,
      atkFast: 0.0025,
      atkSlow: 0.005,
      transDecay: 0.026,
      glideType: "lowpass",
      glideMin: 480,
      glideSpan: 560,
      glideQ: 1.0,
      glidePeak: 0.07,
      glideVel: 0.05,
      tailMs: 70,
      tailVel: 0.35,
      thunkHz: 120,
      thunkDrop: 38,
      thunkGain: 0.2,
      thunkVel: 0.26,
    },
  },
  mushroom: {
    id: "mushroom",
    name: "Mushroom",
    category: "Vegetable",
    // Slice only (Level 14/19). Ported from a reference art batch as an
    // explicit vertex polygon (src/game/shapes/mushroomShape.ts) — a
    // broad domed cap, a flattened underside sweeping in, a genuinely
    // narrower and gently-bent stem — instead of a single-center radius
    // function, which could never make one zone read as dominant and the
    // other subordinate (see MUSHROOM_POLY_GEOMETRY's own doc).
    techniques: ["slice"],
    shape: "polygon",
    difficulty: 1,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    // Tender but not watery — spongy give, no sharp snap.
    resistance: [
      [0, 0.5],
      [0.12, 0.3],
      [0.5, 0.16],
      [0.85, 0.2],
      [1, 0.3],
    ],
    audio: {
      filterMin: 420,
      filterMax: 1900,
      transQ: 1.0,
      transPeak: 0.2,
      transVel: 0.24,
      atkFast: 0.007,
      atkSlow: 0.015,
      transDecay: 0.045,
      glideType: "lowpass",
      glideMin: 300,
      glideSpan: 480,
      glideQ: 0.8,
      glidePeak: 0.1,
      glideVel: 0.08,
      tailMs: 140,
      tailVel: 0.5,
      thunkHz: 68,
      thunkDrop: 32,
      thunkGain: 0.36,
      thunkVel: 0.42,
    },
  },
  pepper: {
    id: "pepper",
    name: "Bell Pepper",
    category: "Vegetable",
    // Slice (Level 15/16) and Dice (Level 27/28) — the general grid/
    // perpSnap engine is shape-agnostic, reused as-is (see carrot's own
    // Phase 6 dice addition for the same note). "julienne" added for
    // Phase 7 (Level 43/44) — same free-angle parallel-snap engine,
    // reused against the same lobed-ellipse silhouette slice/dice already use.
    techniques: ["slice", "dice", "julienne"],
    // Ported from a reference art batch as an explicit vertex polygon
    // (src/game/shapes/pepperShape.ts) — wide shoulders, a tapering body,
    // three hanging lobes at the base — replacing the old cosmetic-only
    // LOBES-on-a-plain-ellipse trick (that field never affected the
    // actual cuttable outline). Also carries Dice's perpSnap grid —
    // browser-verify grid cells still clip cleanly against the real lobes.
    shape: "polygon",
    difficulty: 2,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    // Crisp skin, firmer entry than tomato, hollow-ish body.
    resistance: [
      [0, 0.68],
      [0.14, 0.28],
      [0.5, 0.09],
      [0.85, 0.13],
      [1, 0.26],
    ],
    audio: {
      filterMin: 1000,
      filterMax: 4400,
      transQ: 2.0,
      transPeak: 0.32,
      transVel: 0.3,
      atkFast: 0.0025,
      atkSlow: 0.006,
      transDecay: 0.032,
      glideType: "lowpass",
      glideMin: 460,
      glideSpan: 700,
      glideQ: 1.1,
      glidePeak: 0.13,
      glideVel: 0.1,
      tailMs: 160,
      tailVel: 0.55,
      thunkHz: 78,
      thunkDrop: 42,
      thunkGain: 0.42,
      thunkVel: 0.5,
    },
  },
  zucchini: {
    id: "zucchini",
    name: "Zucchini",
    category: "Vegetable",
    // Slice (Level 25) and Dice (Level 26) — same ingredient definition
    // drives both preparation states, no per-level duplication.
    // KnifeCraft_Level_System_v2.docx's "Zucchini & Fennel Julienne"
    // needs `julienne` — the same generic cut-grid engine every taper
    // ingredient's julienne already uses (carrot, cucumber, ...), no new
    // texture/rendering.
    techniques: ["slice", "dice", "julienne"],
    // Lies flat, near-uniform width, blunt rounded ends — same taper
    // family as cucumber (see ZUCCHINI_GEOMETRY's own doc + PreparationScene
    // reusing traceCucumberPath for its silhouette), not carrot's fat-
    // crown-to-point taper.
    shape: "taper",
    difficulty: 1,
    axisOverride: "v",
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.96,
    // Crisp and watery, a touch firmer than cucumber.
    resistance: [
      [0, 0.6],
      [0.15, 0.24],
      [0.5, 0.09],
      [0.85, 0.13],
      [1, 0.24],
    ],
    audio: {
      filterMin: 800,
      filterMax: 3400,
      transQ: 1.7,
      transPeak: 0.28,
      transVel: 0.28,
      atkFast: 0.0035,
      atkSlow: 0.008,
      transDecay: 0.034,
      glideType: "lowpass",
      glideMin: 400,
      glideSpan: 600,
      glideQ: 1.0,
      glidePeak: 0.1,
      glideVel: 0.08,
      tailMs: 120,
      tailVel: 0.55,
      thunkHz: 80,
      thunkDrop: 42,
      thunkGain: 0.4,
      thunkVel: 0.48,
    },
  },
  // ---- Phase 7 (Levels 31-50, TRANSFORM band) additions below ----
  bread: {
    id: "bread",
    name: "Bread",
    category: "Bakery",
    // Slice only (Level 31 onward) — toast is a recipe/context result
    // built from this preparation, not a separate ingredient.
    techniques: ["slice"],
    // A near-uniform-width blunt capsule, the same taper family as
    // CUCUMBER_GEOMETRY/ZUCCHINI_GEOMETRY (see BREAD_GEOMETRY's own doc)
    // — a loaf lying flat, cross-cut into round slices.
    shape: "taper",
    difficulty: 1,
    axisOverride: "v",
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.95,
    // Crusty give at the very start (the rind), then soft crumb through
    // the middle, a touch of resistance again at the far crust.
    resistance: [
      [0, 0.7],
      [0.12, 0.4],
      [0.5, 0.14],
      [0.85, 0.2],
      [1, 0.42],
    ],
    audio: {
      filterMin: 500,
      filterMax: 2200,
      transQ: 1.1,
      transPeak: 0.26,
      transVel: 0.3,
      atkFast: 0.006,
      atkSlow: 0.013,
      transDecay: 0.048,
      glideType: "lowpass",
      glideMin: 320,
      glideSpan: 520,
      glideQ: 0.85,
      glidePeak: 0.11,
      glideVel: 0.09,
      tailMs: 160,
      tailVel: 0.55,
      thunkHz: 70,
      thunkDrop: 36,
      thunkGain: 0.4,
      thunkVel: 0.46,
    },
  },
  strawberry: {
    id: "strawberry",
    name: "Strawberry",
    category: "Fruit",
    techniques: ["slice"],
    // Ported from a reference art batch as an explicit vertex polygon
    // (src/game/shapes/strawberryShape.ts) — a heart/conical taper with
    // a scalloped twin-lobe leafy-crown dip at top, tapering to a real
    // narrow point at the base — replacing the old organic-harmonic
    // silhouette. Paint (seeds, calyx) still layers on top; see
    // strawberryTexture.ts.
    shape: "polygon",
    difficulty: 1,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    // Soft and quick, even more tender than tomato — barely any resistance.
    resistance: [
      [0, 0.4],
      [0.1, 0.18],
      [0.5, 0.07],
      [0.85, 0.1],
      [1, 0.2],
    ],
    audio: {
      filterMin: 650,
      filterMax: 3000,
      transQ: 1.3,
      transPeak: 0.24,
      transVel: 0.26,
      atkFast: 0.0035,
      atkSlow: 0.008,
      transDecay: 0.034,
      glideType: "lowpass",
      glideMin: 400,
      glideSpan: 700,
      glideQ: 0.9,
      glidePeak: 0.12,
      glideVel: 0.1,
      tailMs: 150,
      tailVel: 0.55,
      thunkHz: 92,
      thunkDrop: 46,
      thunkGain: 0.3,
      thunkVel: 0.36,
    },
  },
  apple: {
    id: "apple",
    name: "Apple",
    category: "Fruit",
    // Slice (Level 35) and Radial (Level 47) — Radial is fully generic
    // over any ellipse ingredient (see TECHNIQUES.radial's own doc), no
    // apple-specific logic anywhere. `julienne` added for KnifeCraft_
    // Level_System_v2.docx's "Celery & Apple Remoulade Prep" — the same
    // generic cut engine, no new texture/rendering. `peel` added for
    // Discrepancy #1's close-out: v2's own Recipe Index requires Apple —
    // Peel before every Apple — Radial/Julienne step. Mandatory-first
    // (no `peelDecoupled`), same convention as Onion/Potato/Garlic — see
    // appleTexture.ts's own `peeled` two-state paint for the visual half
    // of this fix.
    techniques: ["peel", "slice", "radial", "julienne"],
    // Ported from a reference art batch as an explicit vertex polygon
    // (src/game/shapes/appleShape.ts) — two upper lobes with a central
    // stem depression at top and a calyx dimple at the base, replacing
    // the old organic-harmonic silhouette. Kept anchored on the same
    // center/radius convention since Apple is also cut by Radial —
    // computeRadialGrade/drawRadialGuides never consult silhouette shape,
    // only cut angles, so this is safe.
    shape: "polygon",
    difficulty: 2,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    // Crisp, firm entry with a real snap — closer to carrot's rigidity
    // than tomato's soft give, but with a cleaner glide through the flesh.
    resistance: [
      [0, 0.72],
      [0.14, 0.32],
      [0.5, 0.1],
      [0.85, 0.14],
      [1, 0.28],
    ],
    audio: {
      filterMin: 1100,
      filterMax: 4600,
      transQ: 2.1,
      transPeak: 0.3,
      transVel: 0.28,
      atkFast: 0.0025,
      atkSlow: 0.005,
      transDecay: 0.028,
      glideType: "lowpass",
      glideMin: 480,
      glideSpan: 640,
      glideQ: 1.1,
      glidePeak: 0.11,
      glideVel: 0.09,
      tailMs: 130,
      tailVel: 0.5,
      thunkHz: 82,
      thunkDrop: 44,
      thunkGain: 0.4,
      thunkVel: 0.48,
    },
  },
  orange: {
    id: "orange",
    name: "Orange",
    category: "Fruit",
    // Radial (Level 46) — a citrus wedge cut, never a flat slice. No
    // `peel`: an orange is sold/served already peeled in this game's own
    // abstraction (unlike Onion/Potato/Garlic).
    techniques: ["radial"],
    // Near-circular ellipse, same factory as onion — see ORANGE_GEOMETRY.
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.02,
    bandBotFrac: 0.98,
    bandSideFrac: 0.97,
    // Firm rind, then a wetter, softer release through the pith/pulp.
    resistance: [
      [0, 0.78],
      [0.13, 0.4],
      [0.5, 0.13],
      [0.85, 0.18],
      [1, 0.3],
    ],
    audio: {
      filterMin: 950,
      filterMax: 4000,
      transQ: 1.9,
      transPeak: 0.3,
      transVel: 0.28,
      atkFast: 0.0025,
      atkSlow: 0.006,
      transDecay: 0.03,
      glideType: "bandpass",
      glideMin: 520,
      glideSpan: 720,
      glideQ: 1.2,
      glidePeak: 0.12,
      glideVel: 0.1,
      tailMs: 150,
      tailVel: 0.55,
      thunkHz: 86,
      thunkDrop: 44,
      thunkGain: 0.38,
      thunkVel: 0.46,
    },
  },

  // ===== PHASE 18 — Claude Design ingredient merge: 34 new ingredients =====
  // Resistance/audio ported verbatim from knifecraft.html's own
  // CONFIG.INGREDIENTS[id] — see the Phase 18 audit's technique-mapping
  // table (§G) for why every technique below maps onto an EXISTING
  // production TechniqueId; no new technique id was added for any of these.

  eggplant: {
    id: "eggplant",
    name: "Eggplant",
    category: "Vegetable",
    // KnifeCraft_Level_System_v2.docx's "Eggplant Masala Prep" needs
    // `dice` — the same generic cut-grid engine every taper ingredient's
    // dice already uses, no new texture/rendering.
    techniques: ["slice", "dice"],
    shape: "taper",
    difficulty: 1,
    // Claude Design slices the eggplant ACROSS its length —
    // `recipe eggplant-slice-8` is `axis:'v'` (knifecraft.html:1219). With
    // the generic `slice` default (`axis:'h'`) the bowed-spine top arch
    // fell outside the h-cut band and ~2 of 12 cuts landed past the tip in
    // empty space (9 pieces instead of 13) — the same failure Pea Pod had
    // before its 18I override. Same fix cucumber / zucchini / peapod carry.
    axisOverride: "v",
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.6],
      [0.14, 0.28],
      [0.5, 0.14],
      [0.85, 0.2],
      [1, 0.42],
    ],
    audio: {
      filterMin: 640,
      filterMax: 3000,
      transQ: 1.6,
      transPeak: 0.26,
      transVel: 0.3,
      atkFast: 0.005,
      atkSlow: 0.012,
      transDecay: 0.042,
      glideType: "lowpass",
      glideMin: 420,
      glideSpan: 900,
      glideQ: 1.0,
      glidePeak: 0.14,
      glideVel: 0.12,
      tailMs: 180,
      tailVel: 0.75,
      thunkHz: 98,
      thunkDrop: 52,
      thunkGain: 0.34,
      thunkVel: 0.5,
    },
  },
  broccoli: {
    id: "broccoli",
    name: "Broccoli",
    category: "Vegetable",
    techniques: ["chop"],
    shape: "cluster",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.44],
      [0.14, 0.34],
      [0.5, 0.22],
      [0.85, 0.38],
      [1, 0.66],
    ],
    audio: {
      filterMin: 820,
      filterMax: 4600,
      transQ: 2.0,
      transPeak: 0.25,
      transVel: 0.3,
      atkFast: 0.003,
      atkSlow: 0.008,
      transDecay: 0.032,
      glideType: "bandpass",
      glideMin: 1200,
      glideSpan: 1800,
      glideQ: 1.2,
      glidePeak: 0.1,
      glideVel: 0.1,
      tailMs: 120,
      tailVel: 0.55,
      thunkHz: 132,
      thunkDrop: 72,
      thunkGain: 0.28,
      thunkVel: 0.48,
    },
  },
  corn: {
    id: "corn",
    name: "Corn",
    category: "Vegetable",
    techniques: ["slice"],
    shape: "taper",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.44],
      [0.12, 0.46],
      [0.5, 0.52],
      [0.88, 0.6],
      [1, 0.78],
    ],
    audio: {
      filterMin: 880,
      filterMax: 5200,
      transQ: 2.3,
      transPeak: 0.29,
      transVel: 0.33,
      atkFast: 0.003,
      atkSlow: 0.008,
      transDecay: 0.034,
      glideType: "bandpass",
      glideMin: 1100,
      glideSpan: 1900,
      glideQ: 1.3,
      glidePeak: 0.11,
      glideVel: 0.1,
      tailMs: 130,
      tailVel: 0.6,
      thunkHz: 128,
      thunkDrop: 68,
      thunkGain: 0.3,
      thunkVel: 0.5,
    },
  },
  celery: {
    id: "celery",
    name: "Celery",
    category: "Vegetable",
    techniques: ["julienne"],
    shape: "taper",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.56],
      [0.14, 0.4],
      [0.5, 0.34],
      [0.85, 0.42],
      [1, 0.64],
    ],
    audio: {
      filterMin: 1000,
      filterMax: 6000,
      transQ: 2.5,
      transPeak: 0.3,
      transVel: 0.34,
      atkFast: 0.002,
      atkSlow: 0.007,
      transDecay: 0.03,
      glideType: "highpass",
      glideMin: 1300,
      glideSpan: 2100,
      glideQ: 1.4,
      glidePeak: 0.1,
      glideVel: 0.1,
      tailMs: 115,
      tailVel: 0.55,
      thunkHz: 136,
      thunkDrop: 74,
      thunkGain: 0.26,
      thunkVel: 0.45,
    },
  },
  lettuce: {
    id: "lettuce",
    name: "Lettuce",
    category: "Vegetable",
    techniques: ["chop", "chiffonade"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.07,
    bandBotFrac: 0.91,
    bandSideFrac: 0.89,
    resistance: [
      [0, 0.26],
      [0.1, 0.13],
      [0.5, 0.08],
      [0.88, 0.12],
      [1, 0.2],
    ],
    audio: {
      filterMin: 1000,
      filterMax: 4200,
      transQ: 1.7,
      transPeak: 0.18,
      transVel: 0.2,
      atkFast: 0.003,
      atkSlow: 0.007,
      transDecay: 0.026,
      glideType: "bandpass",
      glideMin: 1500,
      glideSpan: 1300,
      glideQ: 1.1,
      glidePeak: 0.06,
      glideVel: 0.06,
      tailMs: 65,
      tailVel: 0.38,
      thunkHz: 140,
      thunkDrop: 80,
      thunkGain: 0.17,
      thunkVel: 0.34,
    },
  },
  cabbage: {
    id: "cabbage",
    name: "Cabbage",
    category: "Vegetable",
    techniques: ["slice", "chop"],
    shape: "ellipse",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.4],
      [0.14, 0.24],
      [0.5, 0.2],
      [0.85, 0.28],
      [1, 0.44],
    ],
    audio: {
      filterMin: 900,
      filterMax: 4000,
      transQ: 1.8,
      transPeak: 0.21,
      transVel: 0.24,
      atkFast: 0.003,
      atkSlow: 0.008,
      transDecay: 0.03,
      glideType: "bandpass",
      glideMin: 1400,
      glideSpan: 1500,
      glideQ: 1.2,
      glidePeak: 0.09,
      glideVel: 0.08,
      tailMs: 95,
      tailVel: 0.44,
      thunkHz: 135,
      thunkDrop: 74,
      thunkGain: 0.24,
      thunkVel: 0.42,
    },
  },
  cauliflower: {
    id: "cauliflower",
    name: "Cauliflower",
    category: "Vegetable",
    techniques: ["chop"],
    shape: "cluster",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.46],
      [0.14, 0.32],
      [0.5, 0.26],
      [0.85, 0.4],
      [1, 0.62],
    ],
    audio: {
      filterMin: 860,
      filterMax: 4400,
      transQ: 2.0,
      transPeak: 0.24,
      transVel: 0.28,
      atkFast: 0.0035,
      atkSlow: 0.009,
      transDecay: 0.034,
      glideType: "bandpass",
      glideMin: 1300,
      glideSpan: 1700,
      glideQ: 1.25,
      glidePeak: 0.1,
      glideVel: 0.09,
      tailMs: 110,
      tailVel: 0.5,
      thunkHz: 130,
      thunkDrop: 70,
      thunkGain: 0.27,
      thunkVel: 0.46,
    },
  },
  spinach: {
    id: "spinach",
    name: "Spinach",
    category: "Vegetable",
    techniques: ["chop", "chiffonade"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.07,
    bandBotFrac: 0.9,
    bandSideFrac: 0.88,
    resistance: [
      [0, 0.24],
      [0.1, 0.11],
      [0.5, 0.06],
      [0.88, 0.09],
      [1, 0.16],
    ],
    audio: {
      filterMin: 1100,
      filterMax: 4800,
      transQ: 2.0,
      transPeak: 0.16,
      transVel: 0.18,
      atkFast: 0.002,
      atkSlow: 0.005,
      transDecay: 0.02,
      glideType: "bandpass",
      glideMin: 1700,
      glideSpan: 1300,
      glideQ: 1.15,
      glidePeak: 0.045,
      glideVel: 0.045,
      tailMs: 55,
      tailVel: 0.32,
      thunkHz: 146,
      thunkDrop: 86,
      thunkGain: 0.15,
      thunkVel: 0.32,
    },
  },
  asparagus: {
    id: "asparagus",
    name: "Asparagus",
    category: "Vegetable",
    techniques: ["slice", "chop"],
    shape: "cluster",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.94,
    resistance: [
      [0, 0.58],
      [0.14, 0.36],
      [0.5, 0.3],
      [0.85, 0.38],
      [1, 0.55],
    ],
    audio: {
      filterMin: 980,
      filterMax: 5600,
      transQ: 2.3,
      transPeak: 0.27,
      transVel: 0.31,
      atkFast: 0.0025,
      atkSlow: 0.007,
      transDecay: 0.03,
      glideType: "highpass",
      glideMin: 1250,
      glideSpan: 1900,
      glideQ: 1.35,
      glidePeak: 0.09,
      glideVel: 0.09,
      tailMs: 110,
      tailVel: 0.5,
      thunkHz: 132,
      thunkDrop: 72,
      thunkGain: 0.25,
      thunkVel: 0.42,
    },
  },
  radish: {
    id: "radish",
    name: "Radish",
    category: "Vegetable",
    // KnifeCraft_Level_System_v2.docx's "Radish & Cucumber Namasu"/"Pear
    // & Radish Side"/"Radish & Pear Fusion Cup" need `julienne` — the
    // same generic cut-grid engine every taper ingredient's julienne
    // already uses, no new texture/rendering.
    techniques: ["slice", "halve", "julienne"],
    shape: "taper",
    difficulty: 1,
    bandTopClear: 0.08,
    bandBotFrac: 0.9,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.58],
      [0.12, 0.22],
      [0.5, 0.12],
      [0.85, 0.2],
      [1, 0.42],
    ],
    audio: {
      filterMin: 900,
      filterMax: 5000,
      transQ: 2.1,
      transPeak: 0.26,
      transVel: 0.3,
      atkFast: 0.003,
      atkSlow: 0.007,
      transDecay: 0.03,
      glideType: "bandpass",
      glideMin: 1200,
      glideSpan: 1700,
      glideQ: 1.3,
      glidePeak: 0.1,
      glideVel: 0.1,
      tailMs: 110,
      tailVel: 0.55,
      thunkHz: 120,
      thunkDrop: 64,
      thunkGain: 0.27,
      thunkVel: 0.46,
    },
  },
  beetroot: {
    id: "beetroot",
    name: "Beetroot",
    category: "Vegetable",
    techniques: ["slice", "dice", "peel"],
    peelDecoupled: true,
    shape: "taper",
    difficulty: 2,
    // Claude Design slices the beet ACROSS — `recipe beetroot-slice-6` is
    // `axis:'v'` (knifecraft.html). The `R_BIG_FRAC` collision half-height
    // is well past the painted beet body, so with the generic `axis:'h'`
    // the h-cut band ran ~30 px taller than the visible beet and ~2 of 12
    // cuts landed above/below it in empty space (10 pieces instead of 13).
    // `axis:'v'` bands against the beet's true length and sidesteps it.
    axisOverride: "v",
    bandTopClear: 0.07,
    bandBotFrac: 0.9,
    bandSideFrac: 0.8,
    resistance: [
      [0, 0.64],
      [0.14, 0.42],
      [0.5, 0.36],
      [0.85, 0.44],
      [1, 0.6],
    ],
    audio: {
      filterMin: 640,
      filterMax: 2800,
      transQ: 1.5,
      transPeak: 0.25,
      transVel: 0.29,
      atkFast: 0.005,
      atkSlow: 0.012,
      transDecay: 0.04,
      glideType: "lowpass",
      glideMin: 440,
      glideSpan: 820,
      glideQ: 1.0,
      glidePeak: 0.11,
      glideVel: 0.1,
      tailMs: 130,
      tailVel: 0.55,
      thunkHz: 100,
      thunkDrop: 52,
      thunkGain: 0.34,
      thunkVel: 0.52,
    },
  },
  sweetpotato: {
    id: "sweetpotato",
    name: "Sweet Potato",
    category: "Vegetable",
    techniques: ["slice", "dice", "halve", "peel"],
    peelDecoupled: true,
    shape: "taper",
    difficulty: 2,
    // Claude Design slices ACROSS — `recipe sweetpotato-slice-6` is
    // `axis:'v'` (knifecraft.html); `sweetpotato-halve` is `axis:'v'` too.
    // With the generic `axis:'h'` the h-cut band ran ~8 px past the tuber
    // (small spine + R_BIG over the painted body) and left ~2 cuts unplaced
    // (11 pieces instead of 13). `axis:'v'` bands against the true length.
    axisOverride: "v",
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.62],
      [0.14, 0.46],
      [0.5, 0.42],
      [0.85, 0.5],
      [1, 0.66],
    ],
    audio: {
      filterMin: 560,
      filterMax: 2400,
      transQ: 1.4,
      transPeak: 0.25,
      transVel: 0.29,
      atkFast: 0.006,
      atkSlow: 0.014,
      transDecay: 0.046,
      glideType: "lowpass",
      glideMin: 400,
      glideSpan: 760,
      glideQ: 0.95,
      glidePeak: 0.12,
      glideVel: 0.11,
      tailMs: 150,
      tailVel: 0.58,
      thunkHz: 90,
      thunkDrop: 46,
      thunkGain: 0.35,
      thunkVel: 0.52,
    },
  },
  greenbean: {
    id: "greenbean",
    name: "Green Bean",
    category: "Vegetable",
    techniques: ["slice", "chop"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.94,
    resistance: [
      [0, 0.5],
      [0.12, 0.22],
      [0.5, 0.16],
      [0.85, 0.22],
      [1, 0.38],
    ],
    audio: {
      filterMin: 940,
      filterMax: 5200,
      transQ: 2.1,
      transPeak: 0.27,
      transVel: 0.3,
      atkFast: 0.0028,
      atkSlow: 0.0065,
      transDecay: 0.03,
      glideType: "highpass",
      glideMin: 1200,
      glideSpan: 1750,
      glideQ: 1.3,
      glidePeak: 0.095,
      glideVel: 0.09,
      tailMs: 105,
      tailVel: 0.48,
      thunkHz: 126,
      thunkDrop: 68,
      thunkGain: 0.26,
      thunkVel: 0.42,
    },
  },
  fennel: {
    id: "fennel",
    name: "Fennel",
    category: "Vegetable",
    techniques: ["slice", "chop", "peel"],
    peelDecoupled: true,
    shape: "ellipse",
    difficulty: 1,
    bandTopClear: 0.07,
    bandBotFrac: 0.91,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.56],
      [0.12, 0.3],
      [0.5, 0.22],
      [0.85, 0.3],
      [1, 0.46],
    ],
    audio: {
      filterMin: 720,
      filterMax: 3200,
      transQ: 1.6,
      transPeak: 0.27,
      transVel: 0.3,
      atkFast: 0.0045,
      atkSlow: 0.01,
      transDecay: 0.036,
      glideType: "bandpass",
      glideMin: 820,
      glideSpan: 1300,
      glideQ: 1.1,
      glidePeak: 0.11,
      glideVel: 0.1,
      tailMs: 130,
      tailVel: 0.52,
      thunkHz: 98,
      thunkDrop: 50,
      thunkGain: 0.32,
      thunkVel: 0.48,
    },
  },
  artichoke: {
    id: "artichoke",
    name: "Artichoke",
    category: "Vegetable",
    // KnifeCraft_Level_System_v2.docx §2.6 — "Halve then Chop" was a
    // physically-impossible prep (Trim is the real technique, not in the
    // 11-technique set); corrected to "Halve then Slice". `slice` added
    // alongside the existing `chop` (kept for the pre-v2 campaign data
    // that already uses it) — a pre-existing technique already used by
    // other cluster-shaped ingredients (e.g. springonion), not a new one.
    techniques: ["halve", "chop", "slice"],
    shape: "cluster",
    difficulty: 2,
    bandTopClear: 0.08,
    bandBotFrac: 0.9,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.66],
      [0.14, 0.46],
      [0.5, 0.3],
      [0.85, 0.4],
      [1, 0.52],
    ],
    audio: {
      filterMin: 600,
      filterMax: 2600,
      transQ: 1.5,
      transPeak: 0.26,
      transVel: 0.29,
      atkFast: 0.0048,
      atkSlow: 0.011,
      transDecay: 0.04,
      glideType: "lowpass",
      glideMin: 440,
      glideSpan: 800,
      glideQ: 1.0,
      glidePeak: 0.11,
      glideVel: 0.1,
      tailMs: 140,
      tailVel: 0.54,
      thunkHz: 92,
      thunkDrop: 48,
      thunkGain: 0.34,
      thunkVel: 0.5,
    },
  },
  peapod: {
    id: "peapod",
    name: "Pea Pod",
    category: "Vegetable",
    techniques: ["slice", "peel"],
    peelDecoupled: true,
    shape: "taper",
    difficulty: 1,
    // The Claude Design source cuts the pod ACROSS its length —
    // `recipe peapod-slice-5` is `axis:'v'` (knifecraft.html:1356), like
    // every other long taper it slices (cucumber, carrot, eggplant,
    // corn, radish, beetroot, sweet potato, mozzarella, pear are all
    // `axis:'v'`). Production's generic `slice` technique defaults to
    // `axis:'h'` (right for a round tomato, wrong for a pod): without
    // this override the whole bowed upper arch fell outside the h-cut
    // band and taps could only reach the lower half. Same fix cucumber
    // already carries.
    axisOverride: "v",
    bandTopClear: 0.09,
    bandBotFrac: 0.88,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.42],
      [0.12, 0.16],
      [0.5, 0.1],
      [0.85, 0.14],
      [1, 0.26],
    ],
    audio: {
      filterMin: 1000,
      filterMax: 5400,
      transQ: 2.2,
      transPeak: 0.24,
      transVel: 0.28,
      atkFast: 0.0025,
      atkSlow: 0.006,
      transDecay: 0.028,
      glideType: "highpass",
      glideMin: 1300,
      glideSpan: 1900,
      glideQ: 1.3,
      glidePeak: 0.08,
      glideVel: 0.08,
      tailMs: 95,
      tailVel: 0.44,
      thunkHz: 134,
      thunkDrop: 70,
      thunkGain: 0.22,
      thunkVel: 0.38,
    },
  },
  pumpkin: {
    id: "pumpkin",
    name: "Pumpkin",
    category: "Vegetable",
    // `peel` added for Discrepancy #1's close-out — v2 requires Pumpkin —
    // Peel before every Pumpkin — Dice step; mandatory-first, same as
    // Onion/Potato/Garlic. See pumpkinTexture.ts's own `peeled` two-state
    // body-gradient swap (rind vs exposed flesh) for the visual half.
    techniques: ["peel", "slice", "dice"],
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.7],
      [0.14, 0.38],
      [0.5, 0.28],
      [0.85, 0.36],
      [1, 0.5],
    ],
    audio: {
      filterMin: 600,
      filterMax: 2600,
      transQ: 1.5,
      transPeak: 0.29,
      transVel: 0.31,
      atkFast: 0.0042,
      atkSlow: 0.01,
      transDecay: 0.038,
      glideType: "lowpass",
      glideMin: 430,
      glideSpan: 780,
      glideQ: 1.0,
      glidePeak: 0.13,
      glideVel: 0.11,
      tailMs: 160,
      tailVel: 0.58,
      thunkHz: 84,
      thunkDrop: 44,
      thunkGain: 0.4,
      thunkVel: 0.54,
    },
  },
  turnip: {
    id: "turnip",
    name: "Turnip",
    category: "Vegetable",
    // `peel` added for Discrepancy #1's close-out — v2 requires Turnip —
    // Peel before every Turnip — Dice/Halve step; mandatory-first, same
    // as Onion/Potato/Garlic. See turnipTexture.ts's own `peeled`
    // two-state paint (magenta cap skin vs clean pale flesh) for the
    // visual half of this fix.
    techniques: ["peel", "slice", "dice", "halve"],
    shape: "ellipse",
    difficulty: 1,
    bandTopClear: 0.08,
    bandBotFrac: 0.9,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.6],
      [0.12, 0.26],
      [0.5, 0.18],
      [0.85, 0.26],
      [1, 0.44],
    ],
    audio: {
      filterMin: 820,
      filterMax: 4200,
      transQ: 1.9,
      transPeak: 0.27,
      transVel: 0.3,
      atkFast: 0.0032,
      atkSlow: 0.0075,
      transDecay: 0.032,
      glideType: "bandpass",
      glideMin: 1050,
      glideSpan: 1550,
      glideQ: 1.2,
      glidePeak: 0.1,
      glideVel: 0.1,
      tailMs: 115,
      tailVel: 0.52,
      thunkHz: 112,
      thunkDrop: 58,
      thunkGain: 0.3,
      thunkVel: 0.46,
    },
  },

  lemon: {
    id: "lemon",
    name: "Lemon",
    category: "Fruit",
    // Radial, not the reference's Slice-as-stopgap — see LEMON_GEOMETRY's own doc.
    techniques: ["radial"],
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.68],
      [0.14, 0.26],
      [0.5, 0.1],
      [0.85, 0.16],
      [1, 0.36],
    ],
    audio: {
      filterMin: 700,
      filterMax: 3400,
      transQ: 1.5,
      transPeak: 0.27,
      transVel: 0.32,
      atkFast: 0.005,
      atkSlow: 0.012,
      transDecay: 0.044,
      glideType: "lowpass",
      glideMin: 460,
      glideSpan: 1000,
      glideQ: 1.0,
      glidePeak: 0.14,
      glideVel: 0.12,
      tailMs: 200,
      tailVel: 0.8,
      thunkHz: 102,
      thunkDrop: 56,
      thunkGain: 0.36,
      thunkVel: 0.5,
    },
  },
  avocado: {
    id: "avocado",
    name: "Avocado",
    category: "Fruit",
    // KnifeCraft_Level_System_v2.docx's cut-fruit-oxidation fix (§2.8)
    // adds a second Avocado — Slice step (paired with an acid step) to
    // several recipes — the same generic cut engine every other ellipse
    // ingredient's slice already uses, no new texture/rendering.
    techniques: ["halve", "slice"],
    shape: "taper",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.46],
      [0.14, 0.26],
      [0.5, 0.15],
      [0.82, 0.22],
      [1, 0.44],
    ],
    audio: {
      filterMin: 520,
      filterMax: 2400,
      transQ: 1.3,
      transPeak: 0.22,
      transVel: 0.26,
      atkFast: 0.006,
      atkSlow: 0.014,
      transDecay: 0.05,
      glideType: "lowpass",
      glideMin: 380,
      glideSpan: 760,
      glideQ: 0.9,
      glidePeak: 0.13,
      glideVel: 0.11,
      tailMs: 190,
      tailVel: 0.7,
      thunkHz: 92,
      thunkDrop: 48,
      thunkGain: 0.34,
      thunkVel: 0.5,
    },
  },
  pear: {
    id: "pear",
    name: "Pear",
    category: "Fruit",
    // KnifeCraft_Level_System_v2.docx's "Pear & Radish Side"/"Radish &
    // Pear Fusion Cup" need `julienne` — the same generic cut engine
    // every other ellipse ingredient's julienne already uses, no new
    // texture/rendering beyond that. `peel` added for Discrepancy #1's
    // close-out — v2 requires Pear — Peel before every Pear — Slice/
    // Julienne step; mandatory-first, same as Onion/Potato/Garlic. See
    // pearTexture.ts's own `peeled` two-state paint (yellow-green skin
    // vs pale flesh, reusing its existing inset-flesh gradient) for the
    // visual half.
    techniques: ["peel", "slice", "halve", "julienne"],
    shape: "taper",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.62],
      [0.14, 0.34],
      [0.5, 0.24],
      [0.85, 0.3],
      [1, 0.5],
    ],
    audio: {
      filterMin: 760,
      filterMax: 3600,
      transQ: 1.7,
      transPeak: 0.27,
      transVel: 0.31,
      atkFast: 0.004,
      atkSlow: 0.011,
      transDecay: 0.04,
      glideType: "lowpass",
      glideMin: 480,
      glideSpan: 1040,
      glideQ: 1.1,
      glidePeak: 0.13,
      glideVel: 0.12,
      tailMs: 180,
      tailVel: 0.72,
      thunkHz: 104,
      thunkDrop: 54,
      thunkGain: 0.34,
      thunkVel: 0.5,
    },
  },
  peach: {
    id: "peach",
    name: "Peach",
    category: "Fruit",
    // KnifeCraft_Level_System_v2.docx's "Peach & Fennel Plate"/"Peach &
    // Cheddar Board" need `slice` — the same generic cut engine every
    // other ellipse ingredient's slice already uses, no new texture/
    // rendering (this ingredient's own overhang system is unaffected —
    // its stem/leaf still gates on `overhangGone`, independent of which
    // cut technique triggered the first cut).
    techniques: ["halve", "slice"],
    shape: "ellipse",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.5],
      [0.14, 0.24],
      [0.5, 0.14],
      [0.82, 0.24],
      [1, 0.58],
    ],
    audio: {
      filterMin: 600,
      filterMax: 2700,
      transQ: 1.3,
      transPeak: 0.22,
      transVel: 0.26,
      atkFast: 0.006,
      atkSlow: 0.015,
      transDecay: 0.052,
      glideType: "lowpass",
      glideMin: 400,
      glideSpan: 800,
      glideQ: 0.9,
      glidePeak: 0.14,
      glideVel: 0.12,
      tailMs: 200,
      tailVel: 0.7,
      thunkHz: 94,
      thunkDrop: 50,
      thunkGain: 0.35,
      thunkVel: 0.5,
    },
  },
  pineapple: {
    id: "pineapple",
    name: "Pineapple",
    category: "Fruit",
    // One of the source's exactly-three real peelable foods (`peelable =
    // SKIN && !SKIN_KEEP` — see knifecraft.html's own peel-mechanics
    // doc), so "peel" belongs first, same convention as Onion/Potato/
    // Garlic: requiresPeelFirst() reads this list generically.
    techniques: ["peel", "slice", "dice"],
    shape: "capsule", // real shape:'capsule' in the source — see PINEAPPLE_GEOMETRY's own doc
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.56],
      [0.14, 0.28],
      [0.5, 0.24],
      [0.85, 0.26],
      [1, 0.44],
    ],
    audio: {
      filterMin: 700,
      filterMax: 3400,
      transQ: 1.6,
      transPeak: 0.26,
      transVel: 0.3,
      atkFast: 0.004,
      atkSlow: 0.01,
      transDecay: 0.04,
      glideType: "lowpass",
      glideMin: 520,
      glideSpan: 1000,
      glideQ: 1.0,
      glidePeak: 0.13,
      glideVel: 0.12,
      tailMs: 190,
      tailVel: 0.68,
      thunkHz: 110,
      thunkDrop: 58,
      thunkGain: 0.33,
      thunkVel: 0.5,
    },
  },
  watermelon: {
    id: "watermelon",
    name: "Watermelon",
    category: "Fruit",
    // One of the source's exactly-three real peelable foods — see
    // pineapple's own doc above for the full rationale.
    techniques: ["peel", "slice", "dice"],
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.05,
    bandBotFrac: 0.93,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.72],
      [0.14, 0.2],
      [0.5, 0.06],
      [0.85, 0.1],
      [1, 0.28],
    ],
    audio: {
      filterMin: 640,
      filterMax: 3000,
      transQ: 1.7,
      transPeak: 0.3,
      transVel: 0.34,
      atkFast: 0.0028,
      atkSlow: 0.007,
      transDecay: 0.032,
      glideType: "lowpass",
      glideMin: 480,
      glideSpan: 1100,
      glideQ: 1.05,
      glidePeak: 0.15,
      glideVel: 0.13,
      tailMs: 200,
      tailVel: 0.78,
      thunkHz: 86,
      thunkDrop: 44,
      thunkGain: 0.38,
      thunkVel: 0.56,
    },
  },
  mango: {
    id: "mango",
    name: "Mango",
    category: "Fruit",
    techniques: ["slice", "dice", "peel"],
    peelDecoupled: true,
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.4],
      [0.14, 0.2],
      [0.5, 0.12],
      [0.82, 0.2],
      [1, 0.46],
    ],
    audio: {
      filterMin: 560,
      filterMax: 2600,
      transQ: 1.35,
      transPeak: 0.23,
      transVel: 0.27,
      atkFast: 0.0055,
      atkSlow: 0.013,
      transDecay: 0.048,
      glideType: "lowpass",
      glideMin: 400,
      glideSpan: 820,
      glideQ: 0.95,
      glidePeak: 0.135,
      glideVel: 0.12,
      tailMs: 195,
      tailVel: 0.74,
      thunkHz: 96,
      thunkDrop: 50,
      thunkGain: 0.33,
      thunkVel: 0.5,
    },
  },
  kiwi: {
    id: "kiwi",
    name: "Kiwi",
    category: "Fruit",
    techniques: ["slice", "halve", "peel"],
    peelDecoupled: true,
    shape: "ellipse",
    difficulty: 1,
    bandTopClear: 0.08,
    bandBotFrac: 0.9,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.34],
      [0.12, 0.18],
      [0.5, 0.1],
      [0.85, 0.16],
      [1, 0.3],
    ],
    audio: {
      filterMin: 480,
      filterMax: 2000,
      transQ: 1.1,
      transPeak: 0.17,
      transVel: 0.2,
      atkFast: 0.008,
      atkSlow: 0.018,
      transDecay: 0.056,
      glideType: "lowpass",
      glideMin: 340,
      glideSpan: 600,
      glideQ: 0.8,
      glidePeak: 0.12,
      glideVel: 0.1,
      tailMs: 170,
      tailVel: 0.62,
      thunkHz: 88,
      thunkDrop: 40,
      thunkGain: 0.28,
      thunkVel: 0.44,
    },
  },
  pomegranate: {
    id: "pomegranate",
    name: "Pomegranate",
    category: "Fruit",
    techniques: ["halve", "peel"],
    peelDecoupled: true,
    shape: "ellipse",
    difficulty: 1,
    bandTopClear: 0.07,
    bandBotFrac: 0.91,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.58],
      [0.1, 0.3],
      [0.5, 0.22],
      [0.85, 0.28],
      [1, 0.42],
    ],
    audio: {
      filterMin: 760,
      filterMax: 3800,
      transQ: 2.0,
      transPeak: 0.28,
      transVel: 0.32,
      atkFast: 0.004,
      atkSlow: 0.009,
      transDecay: 0.036,
      glideType: "bandpass",
      glideMin: 900,
      glideSpan: 1400,
      glideQ: 1.2,
      glidePeak: 0.1,
      glideVel: 0.1,
      tailMs: 120,
      tailVel: 0.5,
      thunkHz: 104,
      thunkDrop: 54,
      thunkGain: 0.3,
      thunkVel: 0.48,
    },
  },
  grapes: {
    id: "grapes",
    name: "Grapes",
    category: "Fruit",
    techniques: ["slice"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.08,
    bandBotFrac: 0.9,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.28],
      [0.12, 0.1],
      [0.5, 0.06],
      [0.85, 0.09],
      [1, 0.18],
    ],
    audio: {
      filterMin: 700,
      filterMax: 3200,
      transQ: 1.6,
      transPeak: 0.22,
      transVel: 0.28,
      atkFast: 0.0022,
      atkSlow: 0.005,
      transDecay: 0.026,
      glideType: "bandpass",
      glideMin: 1000,
      glideSpan: 1500,
      glideQ: 1.15,
      glidePeak: 0.08,
      glideVel: 0.08,
      tailMs: 90,
      tailVel: 0.5,
      thunkHz: 118,
      thunkDrop: 60,
      thunkGain: 0.22,
      thunkVel: 0.38,
    },
  },
  coconut: {
    id: "coconut",
    name: "Coconut",
    category: "Fruit",
    // One of the source's exactly-three real peelable foods — see
    // pineapple's own doc above for the full rationale. KnifeCraft_
    // Level_System_v2.docx §2.6 corrects the campaign recipe itself to
    // "Halve then Chop" (a coconut isn't peeled) — `chop` added here so
    // that's representable; `peel` is left in place (unused by any v2
    // campaign recipe now, but harmless, and removing it risks the
    // existing peelable-texture/reveal path this ingredient already has).
    // `peelDecoupled` added alongside it: without this, `peel` staying
    // mandatory-first would block the v2 recipe's own Halve-first chain
    // (requiresPeelFirst()/recipePrerequisiteIssues both gate on it).
    techniques: ["peel", "halve", "chop"],
    peelDecoupled: true,
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.07,
    bandBotFrac: 0.91,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.92],
      [0.1, 0.74],
      [0.4, 0.3],
      [0.7, 0.34],
      [1, 0.46],
    ],
    audio: {
      filterMin: 340,
      filterMax: 1700,
      transQ: 1.0,
      transPeak: 0.36,
      transVel: 0.3,
      atkFast: 0.002,
      atkSlow: 0.004,
      transDecay: 0.024,
      glideType: "lowpass",
      glideMin: 300,
      glideSpan: 520,
      glideQ: 0.85,
      glidePeak: 0.08,
      glideVel: 0.07,
      tailMs: 70,
      tailVel: 0.4,
      thunkHz: 64,
      thunkDrop: 34,
      thunkGain: 0.58,
      thunkVel: 0.62,
    },
  },

  cheddar: {
    id: "cheddar",
    name: "Cheddar",
    category: "Dairy",
    techniques: ["slice"],
    shape: "block",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.34],
      [0.12, 0.4],
      [0.5, 0.44],
      [0.88, 0.4],
      [1, 0.3],
    ],
    audio: {
      filterMin: 380,
      filterMax: 1500,
      transQ: 0.9,
      transPeak: 0.16,
      transVel: 0.2,
      atkFast: 0.01,
      atkSlow: 0.022,
      transDecay: 0.06,
      glideType: "lowpass",
      glideMin: 300,
      glideSpan: 520,
      glideQ: 0.7,
      glidePeak: 0.16,
      glideVel: 0.14,
      tailMs: 150,
      tailVel: 0.6,
      thunkHz: 86,
      thunkDrop: 40,
      thunkGain: 0.3,
      thunkVel: 0.45,
    },
  },
  mozzarella: {
    id: "mozzarella",
    name: "Mozzarella",
    category: "Dairy",
    techniques: ["slice"],
    shape: "taper",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.3],
      [0.12, 0.34],
      [0.5, 0.36],
      [0.88, 0.32],
      [1, 0.26],
    ],
    audio: {
      filterMin: 340,
      filterMax: 1300,
      transQ: 0.8,
      transPeak: 0.14,
      transVel: 0.18,
      atkFast: 0.012,
      atkSlow: 0.026,
      transDecay: 0.066,
      glideType: "lowpass",
      glideMin: 280,
      glideSpan: 460,
      glideQ: 0.6,
      glidePeak: 0.15,
      glideVel: 0.13,
      tailMs: 160,
      tailVel: 0.6,
      thunkHz: 82,
      thunkDrop: 36,
      thunkGain: 0.28,
      thunkVel: 0.42,
    },
  },
  butter: {
    id: "butter",
    name: "Butter",
    category: "Dairy",
    techniques: ["slice"],
    shape: "block",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.2],
      [0.12, 0.24],
      [0.5, 0.26],
      [0.88, 0.24],
      [1, 0.18],
    ],
    audio: {
      filterMin: 260,
      filterMax: 1000,
      transQ: 0.7,
      transPeak: 0.1,
      transVel: 0.14,
      atkFast: 0.016,
      atkSlow: 0.032,
      transDecay: 0.074,
      glideType: "lowpass",
      glideMin: 220,
      glideSpan: 360,
      glideQ: 0.5,
      glidePeak: 0.13,
      glideVel: 0.12,
      tailMs: 140,
      tailVel: 0.5,
      thunkHz: 74,
      thunkDrop: 30,
      thunkGain: 0.24,
      thunkVel: 0.4,
    },
  },
  tofu: {
    id: "tofu",
    name: "Tofu",
    category: "Dairy",
    techniques: ["dice"],
    shape: "block",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.24],
      [0.12, 0.28],
      [0.5, 0.3],
      [0.88, 0.28],
      [1, 0.22],
    ],
    audio: {
      filterMin: 300,
      filterMax: 1150,
      transQ: 0.7,
      transPeak: 0.12,
      transVel: 0.16,
      atkFast: 0.014,
      atkSlow: 0.03,
      transDecay: 0.07,
      glideType: "lowpass",
      glideMin: 250,
      glideSpan: 400,
      glideQ: 0.6,
      glidePeak: 0.14,
      glideVel: 0.12,
      tailMs: 150,
      tailVel: 0.55,
      thunkHz: 78,
      thunkDrop: 34,
      thunkGain: 0.26,
      thunkVel: 0.42,
    },
  },
  baguette: {
    id: "baguette",
    name: "Baguette",
    category: "Bakery",
    techniques: ["slice"],
    shape: "capsule", // real shape:'capsule' in the source — see BAGUETTE_GEOMETRY's own doc
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.92,
    resistance: [
      [0, 0.78],
      [0.1, 0.3],
      [0.5, 0.12],
      [0.88, 0.26],
      [1, 0.56],
    ],
    audio: {
      filterMin: 900,
      filterMax: 6200,
      transQ: 2.6,
      transPeak: 0.3,
      transVel: 0.34,
      atkFast: 0.002,
      atkSlow: 0.006,
      transDecay: 0.03,
      glideType: "highpass",
      glideMin: 1400,
      glideSpan: 2200,
      glideQ: 1.4,
      glidePeak: 0.1,
      glideVel: 0.1,
      tailMs: 110,
      tailVel: 0.5,
      thunkHz: 120,
      thunkDrop: 64,
      thunkGain: 0.26,
      thunkVel: 0.45,
    },
  },
  /**
   * CHICKEN BREAST — ported directly from knifecraft.html's actual
   * `chicken` profile (source `:1317`), the first food needing the new
   * `fillet` shape family (see CHICKEN_GEOMETRY's own doc): every other
   * primitive is mirror-symmetric about its long axis, and a raw
   * chicken breast is not. No SKIN entry and no peel step: a boneless
   * fillet has no shell. `face` gives every cut a real pale interior
   * band (the same mechanism the baguette's crumb uses); `depth` is the
   * 2.5D thickness system — see PreparationScene's own doc on
   * `drawDepthWall`/`shadeCutEdges`/`spreadPieces`, all gated on this
   * field being present so nothing about the other 51 ingredients'
   * rendering changes.
   */
  chicken: {
    id: "chicken",
    name: "Chicken Breast",
    category: "Protein",
    techniques: ["slice", "dice", "julienne", "halve"],
    shape: "fillet",
    difficulty: 2,
    bandTopClear: 0.1,
    bandBotFrac: 0.88,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.44],
      [0.12, 0.34],
      [0.5, 0.3],
      [0.85, 0.34],
      [1, 0.42],
    ],
    face: {
      px: 4,
      inset: 2.5,
      stops: [
        [0, "#F5CABC"],
        [0.6, "#EBB2A1"],
        [1, "#DFA08D"],
      ],
    },
    depth: {
      px: 12,
      slab: 4,
      spread: 0.17,
      lit: "#E09580",
      mid: "#C97B68",
      low: "#9E5344",
      rim: "rgba(150,74,62,0.30)",
      edge: {
        px: 18,
        stops: [
          [0, "rgba(150,74,62,0.10)"],
          [0.3, "rgba(150,74,62,0.26)"],
          [0.7, "rgba(150,74,62,0.10)"],
          [1, "rgba(158,83,68,0)"],
        ],
      },
    },
    audio: {
      filterMin: 300,
      filterMax: 1500,
      transQ: 0.85,
      transPeak: 0.17,
      transVel: 0.2,
      atkFast: 0.009,
      atkSlow: 0.02,
      transDecay: 0.058,
      glideType: "lowpass",
      glideMin: 250,
      glideSpan: 520,
      glideQ: 0.8,
      glidePeak: 0.1,
      glideVel: 0.09,
      tailMs: 135,
      tailVel: 0.5,
      thunkHz: 76,
      thunkDrop: 38,
      thunkGain: 0.3,
      thunkVel: 0.5,
    },
  },
  /**
   * RIBEYE STEAK — ported directly from knifecraft.html's actual
   * `steak` profile (source `:1353`), ZERO new geometry: it is
   * `fillet` again (see STEAK_GEOMETRY's own doc), the family the
   * source itself says was "exactly what it was built for". No SKIN
   * entry, no peel step. `face` is a lighter red, never pink — the
   * inside of beef is beef.
   */
  steak: {
    id: "steak",
    name: "Ribeye Steak",
    category: "Protein",
    techniques: ["slice", "dice"],
    shape: "fillet",
    difficulty: 2,
    bandTopClear: 0.1,
    bandBotFrac: 0.88,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.52],
      [0.1, 0.46],
      [0.5, 0.44],
      [0.86, 0.48],
      [1, 0.58],
    ],
    face: {
      px: 5,
      inset: 2.5,
      stops: [
        [0, "#C4424A"],
        [0.6, "#AE313A"],
        [1, "#97262E"],
      ],
    },
    depth: {
      px: 14,
      slab: 5,
      spread: 0.17,
      lit: "#B23840",
      mid: "#93262F",
      low: "#6B171E",
      rim: "rgba(92,22,28,0.34)",
      edge: {
        px: 20,
        stops: [
          [0, "rgba(92,22,28,0.10)"],
          [0.3, "rgba(92,22,28,0.28)"],
          [0.7, "rgba(92,22,28,0.10)"],
          [1, "rgba(107,23,30,0)"],
        ],
      },
    },
    audio: {
      filterMin: 260,
      filterMax: 1380,
      transQ: 0.88,
      transPeak: 0.19,
      transVel: 0.22,
      atkFast: 0.01,
      atkSlow: 0.022,
      transDecay: 0.064,
      glideType: "lowpass",
      glideMin: 220,
      glideSpan: 480,
      glideQ: 0.84,
      glidePeak: 0.11,
      glideVel: 0.1,
      tailMs: 150,
      tailVel: 0.52,
      thunkHz: 70,
      thunkDrop: 34,
      thunkGain: 0.33,
      thunkVel: 0.52,
    },
  },
  /**
   * SALMON FILLET — ported directly from knifecraft.html's actual
   * `salmon` profile (source `:1380`), `fillet` a third time at the
   * aspect the family was named for: one broad shoulder running out to
   * a long point. No SKIN entry (the reference is a skinned fillet), no
   * peel step.
   */
  salmon: {
    id: "salmon",
    name: "Salmon Fillet",
    category: "Protein",
    techniques: ["slice", "dice"],
    shape: "fillet",
    difficulty: 2,
    bandTopClear: 0.1,
    bandBotFrac: 0.88,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.4],
      [0.1, 0.28],
      [0.5, 0.24],
      [0.86, 0.3],
      [1, 0.4],
    ],
    face: {
      px: 5,
      inset: 2.5,
      stops: [
        [0, "#FFA582"],
        [0.6, "#F98A66"],
        [1, "#ED7A55"],
      ],
    },
    depth: {
      px: 13,
      slab: 5,
      spread: 0.17,
      lit: "#F4835F",
      mid: "#DE6B49",
      low: "#B04A31",
      rim: "rgba(150,62,42,0.30)",
      edge: {
        px: 18,
        stops: [
          [0, "rgba(150,62,42,0.10)"],
          [0.3, "rgba(150,62,42,0.26)"],
          [0.7, "rgba(150,62,42,0.10)"],
          [1, "rgba(176,74,49,0)"],
        ],
      },
    },
    audio: {
      filterMin: 320,
      filterMax: 1600,
      transQ: 0.8,
      transPeak: 0.15,
      transVel: 0.18,
      atkFast: 0.008,
      atkSlow: 0.018,
      transDecay: 0.052,
      glideType: "lowpass",
      glideMin: 280,
      glideSpan: 560,
      glideQ: 0.76,
      glidePeak: 0.09,
      glideVel: 0.08,
      tailMs: 125,
      tailVel: 0.46,
      thunkHz: 80,
      thunkDrop: 40,
      thunkGain: 0.27,
      thunkVel: 0.46,
    },
  },
  /**
   * Ginger — a RHIZOME (cluster: one thick mass + finger knobs, see
   * GINGER_LEAVES's own doc), and the first cluster-shaped ingredient to
   * be peelable: the shell is `SKIN.ginger` (gingerTexture.ts) over the
   * shaved pale base sprite. NOT peel-decoupled — like Onion/Potato/
   * Garlic/Pineapple/Watermelon/Coconut, Peel remains mandatory-first
   * (the package's own doc: "it is NOT in SKIN_KEEP: the shell comes off
   * by rubbing, never by cutting"), so `peelDecoupled` is intentionally
   * left unset here, same as those six.
   */
  ginger: {
    id: "ginger",
    name: "Ginger",
    category: "Aromatic",
    // KnifeCraft_Level_System_v2.docx places Ginger — Rock Mince (curry/
    // masala bases) and Ginger — Julienne (Chicken & Cabbage Julienne,
    // Radish & Cucumber Namasu) across many recipes. Both reuse the same
    // generic cut-grid engine every other technique on this ingredient
    // already does (CutGeometry.ts has no per-shape technique gating) —
    // no new texture/rendering, no new mechanic.
    techniques: ["peel", "slice", "chop", "rockMince", "julienne"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.1,
    bandBotFrac: 0.88,
    bandSideFrac: 0.86,
    resistance: [
      [0, 0.92],
      [0.16, 0.66],
      [0.45, 0.44],
      [0.82, 0.5],
      [1, 0.74],
    ],
    audio: {
      filterMin: 1300,
      filterMax: 4600,
      transQ: 2.4,
      transPeak: 0.3,
      transVel: 0.26,
      atkFast: 0.002,
      atkSlow: 0.005,
      transDecay: 0.028,
      glideType: "lowpass",
      glideMin: 420,
      glideSpan: 480,
      glideQ: 1.5,
      glidePeak: 0.08,
      glideVel: 0.06,
      tailMs: 64,
      tailVel: 0.42,
      thunkHz: 84,
      thunkDrop: 46,
      thunkGain: 0.46,
      thunkVel: 0.58,
    },
  },
  /**
   * Green Chili (id `chilli`, the package's own exact id) — `taper` with
   * Eggplant's own `spine` bow (CHILLI_GEOMETRY). Not peelable — a chili
   * has no shell, so no `peelConfig`/`peelDecoupled` here, same as
   * Eggplant/Avocado/Pear/Corn/Celery. The calyx + crooked stalk are
   * paint past the butt (chilliTexture.ts, same "faithful to source,
   * invisible past the collision silhouette" treatment Corn's own stalk
   * stub and Turnip's leaf stalks already carry — see cornTexture.ts's
   * own doc on why: PreparationScene's piece pipeline crops every piece,
   * including the whole uncut ingredient, to the collision silhouette's
   * own rx/rBig bounds).
   */
  chilli: {
    id: "chilli",
    name: "Green Chili",
    category: "Vegetable",
    techniques: ["slice", "chop"],
    shape: "taper",
    difficulty: 1,
    bandTopClear: 0.1,
    bandBotFrac: 0.88,
    bandSideFrac: 0.86,
    resistance: [
      [0, 0.52],
      [0.1, 0.16],
      [0.5, 0.08],
      [0.86, 0.16],
      [1, 0.34],
    ],
    audio: {
      filterMin: 1800,
      filterMax: 6200,
      transQ: 2.8,
      transPeak: 0.3,
      transVel: 0.28,
      atkFast: 0.002,
      atkSlow: 0.004,
      transDecay: 0.022,
      glideType: "bandpass",
      glideMin: 1500,
      glideSpan: 2100,
      glideQ: 1.5,
      glidePeak: 0.09,
      glideVel: 0.08,
      tailMs: 70,
      tailVel: 0.45,
      thunkHz: 140,
      thunkDrop: 74,
      thunkGain: 0.24,
      thunkVel: 0.42,
    },
  },
  /**
   * Lime — the package's own "Lemon verbatim, repalettized" fruit: same
   * `ellipse` rind/pith/flesh scaffold (LIME_GEOMETRY, limeTexture.ts),
   * cut with **Radial** for the exact same reason Lemon already is (a
   * real citrus cross-section, not the package's own Slice/Halve
   * stopgap — see LEMON_GEOMETRY's own doc) — Lemon's own geometry/
   * techniques/texture are completely untouched.
   */
  lime: {
    id: "lime",
    name: "Lime",
    category: "Fruit",
    techniques: ["radial"],
    shape: "ellipse",
    difficulty: 2,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.9,
    resistance: [
      [0, 0.7],
      [0.14, 0.26],
      [0.5, 0.1],
      [0.85, 0.16],
      [1, 0.36],
    ],
    audio: {
      filterMin: 740,
      filterMax: 3500,
      transQ: 1.5,
      transPeak: 0.27,
      transVel: 0.32,
      atkFast: 0.005,
      atkSlow: 0.012,
      transDecay: 0.042,
      glideType: "lowpass",
      glideMin: 480,
      glideSpan: 1020,
      glideQ: 1.0,
      glidePeak: 0.14,
      glideVel: 0.12,
      tailMs: 200,
      tailVel: 0.8,
      thunkHz: 106,
      thunkDrop: 58,
      thunkGain: 0.36,
      thunkVel: 0.5,
    },
  },
  /**
   * Cilantro — Parsley's own cluster primitive (CILANTRO_LEAVES), with
   * the shared `parsleyLeafShape` blade generator's new ROUND branch
   * (see parsleyTexture.ts) instead of Parsley's trifid path — same
   * techniques as Parsley/Basil, a different painted leaf shape only.
   */
  cilantro: {
    id: "cilantro",
    name: "Cilantro",
    category: "Herb",
    techniques: ["chop", "chiffonade"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.08,
    bandBotFrac: 0.9,
    bandSideFrac: 0.88,
    resistance: [
      [0, 0.18],
      [0.1, 0.08],
      [0.55, 0.04],
      [0.88, 0.06],
      [1, 0.12],
    ],
    audio: {
      filterMin: 1400,
      filterMax: 5800,
      transQ: 2.3,
      transPeak: 0.18,
      transVel: 0.2,
      atkFast: 0.002,
      atkSlow: 0.005,
      transDecay: 0.019,
      glideType: "bandpass",
      glideMin: 2050,
      glideSpan: 1500,
      glideQ: 1.25,
      glidePeak: 0.05,
      glideVel: 0.05,
      tailMs: 50,
      tailVel: 0.3,
      thunkHz: 164,
      thunkDrop: 96,
      thunkGain: 0.13,
      thunkVel: 0.3,
    },
  },
  /**
   * Green Onion / Scallion (id `springonion`, the package's own exact
   * id) — Asparagus's own `cluster` bundle rule, one lobe per stalk
   * (SPRINGONION_LEAVES) — same technique pair Green Bean's cluster
   * already uses (`slice`/`chop`), so no new shape/technique combination.
   */
  springonion: {
    id: "springonion",
    name: "Green Onion / Scallion",
    category: "Vegetable",
    techniques: ["slice", "chop"],
    shape: "cluster",
    difficulty: 1,
    bandTopClear: 0.06,
    bandBotFrac: 0.92,
    bandSideFrac: 0.94,
    resistance: [
      [0, 0.34],
      [0.14, 0.16],
      [0.5, 0.12],
      [0.85, 0.15],
      [1, 0.3],
    ],
    audio: {
      filterMin: 1150,
      filterMax: 6000,
      transQ: 2.4,
      transPeak: 0.22,
      transVel: 0.26,
      atkFast: 0.002,
      atkSlow: 0.006,
      transDecay: 0.024,
      glideType: "highpass",
      glideMin: 1450,
      glideSpan: 2000,
      glideQ: 1.35,
      glidePeak: 0.07,
      glideVel: 0.07,
      tailMs: 80,
      tailVel: 0.42,
      thunkHz: 142,
      thunkDrop: 80,
      thunkGain: 0.18,
      thunkVel: 0.36,
    },
  },
};

// KnifeStats/DEFAULT_KNIFE (Phase 8) — removed. The authoritative knife
// shape is now KnifeDefinition (src/game/knives/knifeTypes.ts), populated
// by KNIFE_CATALOG (src/game/knives/knifeDefinitions.ts) — the single
// source of truth the Workshop UI and PreparationScene both read from,
// instead of three divergent knife shapes.

// BoardVisual/DEFAULT_BOARD (Phase 9) — removed the same way. The
// authoritative board shape is now BoardDefinition (src/game/boards/
// boardTypes.ts), populated by BOARD_CATALOG (src/game/boards/
// boardDefinitions.ts).

/**
 * Board geometry, ported from knifecraft.html CONFIG.kitchen /
 * boardQuad(): a SUBTLE foreshortened trapezoid — the front edge is only
 * ~14% wider than the back (424px -> 492px in the reference's 540-wide
 * design canvas), not the dramatic wall-like convergence an earlier pass
 * in this project mistakenly drew. X extents are width-fractions, Y
 * extents height-fractions — matching how the board actually sits in a
 * portrait canvas whose aspect isn't the reference's fixed 540x960.
 */
export const BOARD_GEOMETRY = {
  FACE_TOP_Y_FRAC: 286 / 960,
  FACE_BOT_Y_FRAC: 716 / 960,
  FACE_TOP_W_FRAC: 424 / 540,
  FACE_BOT_W_FRAC: 492 / 540,
  EDGE_FRAC: 10 / 960, // the slab's visible depth below the face
  CORNER_FRAC: 22 / 540,
  GRAIN_STRIPES: 13,
} as const;

/**
 * The tomato's own silhouette, ported from knifecraft.html
 * CONFIG.INGREDIENTS.tomato.geom (rx: 148, ry: 128 in the 540-wide design
 * canvas — both width-fractions, per this file's existing convention for
 * uniformly-scaled shapes, e.g. KNIFE_GEOMETRY.DIR_BASELINE_FRAC).
 */
/**
 * Phase 18B-1 audit: this constant used to hold the source's raw authored
 * `rx:148, ry:128` directly — the one geometry constant in the file (with
 * Carrot) that predates the Phase 18 real-cm scale merge and was never
 * run through it. A from-scratch trace against knifecraft.html's own
 * `REAL_CM.tomato=[8,7.5]` / `PX_PER_CM=22.5` / `SIZE_REF_CM=10` /
 * `SIZE_GAMMA=0.5` formula (knifecraft.html:3150-3191) gives
 * k=0.7079 — i.e. the source's OWN real-world-relative tomato is
 * 104.76×90.61, not 148×128. Left unscaled, Tomato read roughly 40%
 * oversized next to every other ingredient in the 49-item roster, all of
 * which (see PEACH_GEOMETRY etc. below) DO carry the k-factor.
 */
export const TOMATO_GEOMETRY = {
  RX_FRAC: 104.76 / 540,
  RY_FRAC: 90.61 / 540,
  LOBES: 5,
} as const;

/**
 * The carrot's silhouette (a taper — flat-topped crown, tapering to a
 * point), ported from knifecraft.html CONFIG.INGREDIENTS.carrot.geom
 * (rx:210, rBig:56, rSmall:10 in the 540-wide design canvas). Phase 18B-1
 * audit: same stale-constant issue as TOMATO_GEOMETRY — these were the
 * source's raw authored numbers, never run through the real-cm scale
 * pass. `REAL_CM.carrot=[19,3.6]` gives k=0.6224 (130.71/34.86/6.22, not
 * 210/56/10). `buttRound`/`tipRound` are unitless cap-rounding ratios and
 * correctly carry over unscaled either way.
 *
 * Size-balancing correction pass: the strict real-cm-relative value above
 * read as a visually-tiny sliver in gameplay (confirmed in-browser) —
 * clearly visible/comfortably cuttable was judged to matter more than
 * literal real-world scale for a slender vegetable that's mostly julienned/
 * sliced along its own length. RX/R_BIG/R_SMALL scaled up uniformly by
 * 1.3x (BUTT_ROUND/TIP_ROUND — dimensionless cap-rounding ratios, not
 * lengths — left untouched, so the silhouette is the exact same taper,
 * just bigger, not "cartoonishly thick").
 */
export const CARROT_GEOMETRY = {
  RX_FRAC: 154.2 / 540,
  R_BIG_FRAC: 43.83 / 540,
  R_SMALL_FRAC: 8.75 / 540,
  BUTT_ROUND: 0.16,
  TIP_ROUND: 3.4,
} as const;

/**
 * The cucumber's silhouette — a real `shape:'capsule'` in the actual
 * Claude Design source (confirmed by grepping `shape:'capsule'` directly,
 * not assumed): a true stadium, barrel of radius `capR` swept between two
 * centres `rx-capR` apart — genuinely different from a taper's sqrt-eased
 * cap (see makeCapsuleSilhouette's own doc). `RX_FRAC`/`CAP_R_FRAC` are
 * this phase's real-cm-normalized scaling of the source's own authored
 * `rx:206, capR:52`, not the earlier taper-approximation numbers this
 * constant used to hold.
 */
export const CUCUMBER_GEOMETRY = {
  RX_FRAC: 158.33 / 540,
  CAP_R_FRAC: 39.97 / 540,
} as const;

/** The onion's silhouette — a near-circular ellipse (rx≈ry), same shape factory as tomato, smaller and rounder. */
export const ONION_GEOMETRY = {
  RX_FRAC: 118 / 540,
  RY_FRAC: 112 / 540,
} as const;

/** The potato's silhouette — an oblong ellipse (rx notably > ry), same shape factory as tomato. */
export const POTATO_GEOMETRY = {
  RX_FRAC: 138 / 540,
  RY_FRAC: 92 / 540,
} as const;

/**
 * The garlic clove's silhouette — a teardrop (taper), same shape factory
 * as carrot/cucumber (see ingredientShapes.ts's makeTaperSilhouette):
 * rounded at the root end (R_BIG_FRAC), tapering to a real point at the
 * tip (R_SMALL_FRAC, still non-zero — a clove's tip is pointed, not a
 * razor edge). Much smaller overall than carrot; BUTT_ROUND is generous
 * (a plump rounded base) where carrot's crown is nearly flat-topped.
 *
 * Size-balancing correction pass: at the strict real-cm-relative 68/46/13,
 * Garlic was the single smallest footprint in the entire 49+3 roster —
 * visually confirmed in-browser (post-revert of the broader pass) as a
 * genuine "tiny sliver," not an artifact of that pass. RX/R_BIG/R_SMALL
 * scaled up uniformly by 1.2x (BUTT_ROUND/TIP_ROUND — dimensionless
 * cap-rounding ratios, not lengths — left untouched, so the silhouette
 * is the exact same teardrop, just bigger); still clearly the smallest
 * aromatic and well below onion/potato.
 */
export const GARLIC_GEOMETRY = {
  RX_FRAC: 81.6 / 540,
  R_BIG_FRAC: 55.2 / 540,
  R_SMALL_FRAC: 15.6 / 540,
  BUTT_ROUND: 0.55,
  TIP_ROUND: 2.6,
} as const;

/**
 * Basil's silhouette — Pre-Phase-8: an organic elongated leaf (base
 * ellipse taller than wide) shaped by BASIL_PROFILE into a narrower tip
 * and a broader rounded base, with a slight off-axis wobble for natural
 * asymmetry. See makeOrganicSilhouette (ingredientShapes.ts).
 */
export const BASIL_GEOMETRY = {
  RX_FRAC: 74 / 540,
  RY_FRAC: 96 / 540,
} as const;

export const BASIL_PROFILE: OrganicProfile = {
  harmonics: [
    { k: 1, amp: 0.22, phaseDeg: 90 },
    { k: 3, amp: 0.07, phaseDeg: 40 },
  ],
};

/**
 * Parsley's silhouette — Pre-Phase-8: a smaller, near-circular organic
 * shape with a HIGH-frequency (k=5/7) small-bump edge for a frilly/jagged
 * read — a different harmonic character from Basil's smooth k=1/k=3 leaf,
 * not just a smaller/darker copy of it.
 */
export const PARSLEY_GEOMETRY = {
  RX_FRAC: 70 / 540,
  RY_FRAC: 66 / 540,
} as const;

export const PARSLEY_PROFILE: OrganicProfile = {
  harmonics: [
    { k: 1, amp: 0.08, phaseDeg: 200 },
    { k: 5, amp: 0.05, phaseDeg: 50 },
    { k: 7, amp: 0.09, phaseDeg: 0 },
  ],
};

/**
 * Phase 18 — CLUSTER leaf data. Basil/Parsley's real geometry now (see
 * their own INGREDIENTS entries): 8 broad ovate blades + 5 stems for
 * Basil, 20 small frilly leaflets + 6 stems for Parsley, ported from the
 * Claude Design prototype's own tuned `CONFIG.INGREDIENTS.basil/parsley
 * .geom.leaves` (Phase 17A's cluster-primitive work — see
 * PHASE17A-REPORT.md) and scaled by this phase's real-centimetre
 * normalization pass (§51a) — see the porting script's own k-factors.
 * Same 540-wide reference-canvas units as every other geometry constant
 * in this file; PreparationScene applies `scaleClusterLeaves(leaves,
 * w/540)` at layout time, mirroring `RX_FRAC * w` for a single rx/ry pair.
 * BASIL_GEOMETRY/BASIL_PROFILE (and Parsley's) are left in place, unused,
 * rather than deleted — see IngredientShape's own doc on why "organic"
 * stays live infrastructure.
 */
export const BASIL_LEAVES: ClusterLeaf[] = [
  { dx: -75.27, dy: -31.36, rx: 51.75, ry: 31.36, rot: -0.42 },
  { dx: -14.11, dy: -58.02, rx: 54.89, ry: 32.93, rot: -0.1 },
  { dx: 58.02, dy: -40.77, rx: 50.18, ry: 29.8, rot: 0.38 },
  { dx: -54.89, dy: 26.66, rx: 48.61, ry: 29.01, rot: 0.3 },
  { dx: 12.55, dy: 12.55, rx: 58.02, ry: 34.5, rot: -0.04 },
  { dx: 75.27, dy: 23.52, rx: 45.48, ry: 27.44, rot: -0.3 },
  { dx: -23.52, dy: 65.86, rx: 47.05, ry: 28.23, rot: 0.14 },
  { dx: 40.77, dy: 72.14, rx: 40.77, ry: 25.09, rot: 0.52 },
  { dx: -40.77, dy: -9.41, rx: 34.5, ry: 3.92, rot: -0.3, stem: true },
  { dx: -7.84, dy: -29.8, rx: 29.8, ry: 3.92, rot: 0.42, stem: true },
  { dx: 34.5, dy: -17.25, rx: 31.36, ry: 3.92, rot: -0.34, stem: true },
  { dx: -29.8, dy: 40.77, rx: 28.23, ry: 3.53, rot: -0.4, stem: true },
  { dx: 31.36, dy: 45.48, rx: 29.8, ry: 3.53, rot: 0.3, stem: true },
];

export const PARSLEY_LEAVES: ClusterLeaf[] = [
  { dx: -95.87, dy: -51.06, rx: 35.43, ry: 30.22, rot: -0.7 },
  { dx: -65.65, dy: -56.27, rx: 33.35, ry: 29.18, rot: -0.2 },
  { dx: -80.24, dy: -25.01, rx: 34.39, ry: 29.18, rot: 0.5 },
  { dx: -7.29, dy: -81.28, rx: 36.47, ry: 31.26, rot: -0.5 },
  { dx: 22.93, dy: -73.99, rx: 34.39, ry: 29.18, rot: 0.1 },
  { dx: 7.29, dy: -50.02, rx: 35.43, ry: 30.22, rot: 0.6 },
  { dx: 91.7, dy: -47.94, rx: 33.35, ry: 29.18, rot: -0.35 },
  { dx: 67.74, dy: -50.02, rx: 31.26, ry: 27.09, rot: 0.25 },
  { dx: 85.45, dy: -17.72, rx: 34.39, ry: 29.18, rot: 0.7 },
  { dx: -70.86, dy: 30.22, rx: 34.39, ry: 29.18, rot: -0.55 },
  { dx: -40.64, dy: 22.93, rx: 32.31, ry: 28.14, rot: 0.15 },
  { dx: -55.23, dy: 55.23, rx: 35.43, ry: 30.22, rot: 0.45 },
  { dx: 58.36, dy: 35.43, rx: 33.35, ry: 29.18, rot: -0.3 },
  { dx: 30.22, dy: 33.35, rx: 34.39, ry: 29.18, rot: 0.3 },
  { dx: 45.85, dy: 65.65, rx: 32.31, ry: 28.14, rot: 0.65 },
  { dx: -19.8, dy: 86.49, rx: 33.35, ry: 29.18, rot: -0.4 },
  { dx: 10.42, dy: 88.58, rx: 31.26, ry: 27.09, rot: 0.35 },
  { dx: 8.34, dy: 4.17, rx: 35.43, ry: 30.22, rot: -0.15 },
  { dx: 47.94, dy: 8.34, rx: 32.31, ry: 28.14, rot: 0.45 },
  { dx: -14.59, dy: 45.85, rx: 33.35, ry: 29.18, rot: 0.55 },
  { dx: -42.73, dy: -20.84, rx: 43.77, ry: 3.54, rot: -0.42, stem: true },
  { dx: 3.13, dy: -33.35, rx: 37.52, ry: 3.54, rot: 1.35, stem: true },
  { dx: 40.64, dy: -17.72, rx: 43.77, ry: 3.54, rot: -0.38, stem: true },
  { dx: -27.09, dy: 20.84, rx: 35.43, ry: 3.13, rot: 0.6, stem: true },
  { dx: 22.93, dy: 25.01, rx: 35.43, ry: 3.13, rot: -0.6, stem: true },
  { dx: -3.13, dy: 45.85, rx: 31.26, ry: 3.13, rot: 1.4, stem: true },
];

/**
 * Mushroom's silhouette is now an explicit vertex polygon ported from a
 * reference art batch (cap + underside + stem, see
 * src/game/shapes/mushroomShape.ts) rather than a single-center radius
 * profile — SCALE_FRAC converts that file's raw local-design units
 * (half-width 84, full height 138) into world px the same way every
 * other *_FRAC constant here does (world = unit * SCALE_FRAC * w),
 * picked to land close to the old organic silhouette's on-screen
 * footprint (rx≈92/540, ry≈112/540) so hitbox/tap-tolerance feel is
 * undisturbed; tune further in-browser if it reads too small/large.
 */
export const MUSHROOM_POLY_GEOMETRY = {
  SCALE_FRAC: 1.62 / 540,
} as const;

/**
 * Bell Pepper's silhouette is now an explicit vertex polygon ported from
 * a reference art batch (wide shoulders, tapering body, three hanging
 * lobes at the base — see src/game/shapes/pepperShape.ts), replacing the
 * old organic-harmonic silhouette. SCALE_FRAC originally picked to land
 * close to the old silhouette's footprint (rx≈122/540, ry≈126/540).
 * Size-balancing pass: that footprint (area rx*ry≈15372) rivalled/
 * exceeded several Category-A "among the largest" ingredients (broccoli,
 * pineapple) despite Pepper being Category C ("comfortable normal
 * footprint") — trimmed ~8% to rx≈112/540, ry≈116/540 (area≈12992),
 * comfortably inside Category C alongside fennel/onion/mozzarella while
 * staying one of the larger members of that category, matching a real
 * bell pepper's own relative size. Vertex geometry/paint untouched.
 */
export const PEPPER_POLY_GEOMETRY = {
  SCALE_FRAC: 1.73 / 540,
} as const;

/**
 * Zucchini's silhouette — a near-uniform-width blunt capsule, the SAME
 * shape family as CUCUMBER_GEOMETRY (both cap-rounding ratios at 1.0 —
 * PreparationScene reuses traceCucumberPath directly for zucchini's
 * silhouette rather than adding a new trace function), just a touch
 * shorter/thicker and painted with its own palette (zucchiniTexture.ts).
 */
export const ZUCCHINI_GEOMETRY = {
  RX_FRAC: 190 / 540,
  R_BIG_FRAC: 40 / 540,
  R_SMALL_FRAC: 37 / 540,
  BUTT_ROUND: 1.0,
  TIP_ROUND: 1.0,
} as const;

/**
 * The loaf's silhouette — same blunt-capsule taper family as
 * CUCUMBER_GEOMETRY/ZUCCHINI_GEOMETRY (PreparationScene reuses
 * traceCucumberPath directly for bread too — see its own doc), but much
 * stubbier/thicker (R_BIG≈R_SMALL close to RX) so a cross-cut reads as a
 * genuine loaf slice rather than a thin cucumber round. BUTT_ROUND/
 * TIP_ROUND lowered from a full 1.0 (a pill/stadium) to a loaf-pan
 * silhouette — mostly straight sides with just the corners rounded.
 */
export const BREAD_GEOMETRY = {
  RX_FRAC: 150 / 540,
  R_BIG_FRAC: 78 / 540,
  R_SMALL_FRAC: 76 / 540,
  BUTT_ROUND: 0.4,
  TIP_ROUND: 0.4,
} as const;

/**
 * Strawberry's silhouette is now an explicit vertex polygon ported from a
 * reference art batch (a heart/conical taper with a scalloped twin-lobe
 * leafy-crown dip at top — see src/game/shapes/strawberryShape.ts),
 * replacing the old organic-harmonic silhouette. SCALE_FRAC picked to
 * land close to the old silhouette's footprint (rx≈82/540, ry≈96/540);
 * tune in-browser.
 */
export const STRAWBERRY_POLY_GEOMETRY = {
  SCALE_FRAC: 1.33 / 540,
} as const;

/**
 * Apple's silhouette is now an explicit vertex polygon ported from a
 * reference art batch (two upper lobes with a stem depression, a calyx
 * dimple at the base — see src/game/shapes/appleShape.ts), replacing the
 * old organic-harmonic silhouette. SCALE_FRAC originally picked to land
 * close to the old silhouette's footprint (rx≈128/540, ry≈130/540).
 * Size-balancing pass: that footprint (area rx*ry≈16640) exceeded
 * Coconut's (13921) despite Apple being Category C ("comfortable normal
 * footprint") against Coconut's Category A ("among the largest") —
 * trimmed to rx≈102/540, ry≈103/540 (area≈10500), landing Apple among
 * tomato/pear/pomegranate/mozzarella, its real Category C peers, clearly
 * below every Category A member. Vertex geometry/paint untouched; still
 * anchored on the same center/radius convention Radial relies on (see
 * INGREDIENTS.apple's own doc for why that stays safe).
 */
export const APPLE_POLY_GEOMETRY = {
  SCALE_FRAC: 1.45 / 540,
} as const;

/** Orange's silhouette — a near-circular ellipse (rx≈ry), same factory as onion. */
export const ORANGE_GEOMETRY = {
  RX_FRAC: 120 / 540,
  RY_FRAC: 118 / 540,
} as const;

/**
 * ===== PHASE 18 — Claude Design ingredient merge: 34 new ingredients =====
 *
 * Every constant below is derived the SAME way TOMATO_GEOMETRY etc. are —
 * `raw px in the 540-wide reference design canvas / 540` — using the
 * corresponding ingredient's own authored geometry from the Claude Design
 * prototype (`knifecraft.html`'s `CONFIG.INGREDIENTS`), then run through
 * this phase's own real-centimetre scale-normalization pass: the SAME
 * `REAL_CM` / `PX_PER_CM=22.5` / `SIZE_REF_CM=10` / `SIZE_GAMMA=0.5`
 * formula `DESIGN.md §51a` describes, re-targeted at this production
 * board's own face size (492×430 — confirmed equal to the reference's own
 * "drawn face" by the Phase 17 ports' own regression assertions) instead
 * of blindly copying the reference's raw pixel dimensions. This is what
 * makes a Peach's pieces stay smaller than a Watermelon's, and keeps
 * every ingredient in this merged 49-item roster at a believable size
 * relative to every other one, old and new alike — see the porting
 * scripts under the Phase 18 session's scratchpad for the exact
 * per-ingredient k-factors.
 */

// ---------- ellipse ----------

/** Lemon — cut with **Radial**, not the reference's Slice-as-stopgap (see the Phase 18 audit's own §G: the reference prototype has no Radial mechanic; production already does, and it's the technique that actually produces a citrus cross-section). */
export const LEMON_GEOMETRY = { RX_FRAC: 97.82 / 540, RY_FRAC: 77.63 / 540 } as const;
export const PEACH_GEOMETRY = { RX_FRAC: 97.37 / 540, RY_FRAC: 90.99 / 540 } as const;
export const CABBAGE_GEOMETRY = { RX_FRAC: 142.49 / 540, RY_FRAC: 133.3 / 540 } as const;
export const WATERMELON_GEOMETRY = { RX_FRAC: 146.9 / 540, RY_FRAC: 133.3 / 540 } as const;
/** Mango — drawn upright (taller than wide); the reference's `ovoid` asymmetry is paint-only here, same simplification Tomato's own `lobes` already uses (the collision silhouette stays a plain symmetric ellipse). */
// OVOID is dimensionless (a ratio applied to rx by taper-fraction along
// y) — no k-scaling, ported verbatim from the source's own `ovoid`.
export const MANGO_GEOMETRY = { RX_FRAC: 87.67 / 540, RY_FRAC: 115.5 / 540, OVOID: -0.16 } as const;
export const KIWI_GEOMETRY = { RX_FRAC: 89.13 / 540, RY_FRAC: 71 / 540 } as const;
export const POMEGRANATE_GEOMETRY = { RX_FRAC: 108.55 / 540, RY_FRAC: 104.93 / 540 } as const;
export const COCONUT_GEOMETRY = { RX_FRAC: 121.86 / 540, RY_FRAC: 114.24 / 540 } as const;
export const FENNEL_GEOMETRY = { RX_FRAC: 110.78 / 540, RY_FRAC: 114.24 / 540 } as const;
// LOBES/SCALLOP are ported verbatim from the source's own `lobes`/
// `scallop` (SCALLOP is a dimensionless amplitude fraction — no
// k-scaling; LOBES is a count, not a length).
export const PUMPKIN_GEOMETRY = {
  RX_FRAC: 182.68 / 540,
  RY_FRAC: 117.78 / 540,
  LOBES: 9,
  SCALLOP: 0.032,
} as const;
export const TURNIP_GEOMETRY = { RX_FRAC: 100.31 / 540, RY_FRAC: 94.63 / 540 } as const;

// ---------- taper (includes the reference's "capsule" family — a taper with near-equal R_BIG/R_SMALL, same convention Cucumber/Zucchini/Bread already use) ----------

// taperCurve/spine/spineRx below are ported verbatim from the source's own
// geom object (knifecraft.html PAINT-adjacent SILS.taper consumers) —
// taperCurve is a dimensionless exponent (no k-scaling); spine/spineRx are
// lengths and get the SAME real-cm k-factor as rx/rBig/rSmall.
export const EGGPLANT_GEOMETRY = {
  RX_FRAC: 186.11 / 540,
  R_BIG_FRAC: 68 / 540,
  R_SMALL_FRAC: 34 / 540,
  BUTT_ROUND: 0.95,
  TIP_ROUND: 1.7,
  TAPER_CURVE: 0.62,
  SPINE_FRAC: 23.26 / 540,
  SPINE_RX_FRAC: 186.11 / 540,
} as const;
/** Avocado — `taper`, deliberately NOT `cluster` (a 2-lobe cluster's circle-union shows a waist pinch and a skin sliver at true scale — see avocadoTexture.ts's own doc). */
export const AVOCADO_GEOMETRY = {
  RX_FRAC: 124.4 / 540,
  R_BIG_FRAC: 76.3 / 540,
  R_SMALL_FRAC: 41.47 / 540,
  BUTT_ROUND: 0.92,
  TIP_ROUND: 2,
  TAPER_CURVE: 0.58,
} as const;
export const PEAR_GEOMETRY = {
  RX_FRAC: 124.49 / 540,
  R_BIG_FRAC: 81.33 / 540,
  R_SMALL_FRAC: 31.54 / 540,
  BUTT_ROUND: 0.98,
  TIP_ROUND: 1.4,
  TAPER_CURVE: 0.4,
} as const;
export const CORN_GEOMETRY = {
  RX_FRAC: 141.56 / 540,
  R_BIG_FRAC: 44.7 / 540,
  R_SMALL_FRAC: 17.14 / 540,
  BUTT_ROUND: 1,
  TIP_ROUND: 1.9,
  TAPER_CURVE: 0.86,
} as const;
export const CELERY_GEOMETRY = {
  RX_FRAC: 198.19 / 540,
  R_BIG_FRAC: 76.63 / 540,
  R_SMALL_FRAC: 60.78 / 540,
  BUTT_ROUND: 0.9,
  TIP_ROUND: 1.1,
  TAPER_CURVE: 0.8,
} as const;
/** Mozzarella — a hand-formed ovoline (fat rounded belly, pinched knot end), not a ball — `taper` already owns this profile, just different numbers from Carrot. */
export const MOZZARELLA_GEOMETRY = {
  RX_FRAC: 121.3 / 540,
  R_BIG_FRAC: 93.91 / 540,
  R_SMALL_FRAC: 56.74 / 540,
  BUTT_ROUND: 1,
  TIP_ROUND: 1.45,
  TAPER_CURVE: 0.9,
} as const;
/** Radish — a daikon, per the reference: Carrot's taper recoloured white at a stouter aspect, not a small round red radish. */
export const RADISH_GEOMETRY = {
  RX_FRAC: 154.2 / 540,
  R_BIG_FRAC: 43.83 / 540,
  R_SMALL_FRAC: 8.75 / 540,
  BUTT_ROUND: 0.62,
  TIP_ROUND: 3,
  TAPER_CURVE: 0.92,
} as const;
export const BEETROOT_GEOMETRY = {
  RX_FRAC: 108.03 / 540,
  R_BIG_FRAC: 93.73 / 540,
  R_SMALL_FRAC: 4.77 / 540,
  BUTT_ROUND: 1,
  TIP_ROUND: 1.6,
  TAPER_CURVE: 1.25,
} as const;
export const SWEETPOTATO_GEOMETRY = {
  RX_FRAC: 131.02 / 540,
  R_BIG_FRAC: 67.62 / 540,
  R_SMALL_FRAC: 52.12 / 540,
  BUTT_ROUND: 1.55,
  TIP_ROUND: 1.8,
  TAPER_CURVE: 1.0,
  SPINE_FRAC: 5.635 / 540,
  SPINE_RX_FRAC: 131.02 / 540,
} as const;
export const PEAPOD_GEOMETRY = {
  RX_FRAC: 130.46 / 540,
  R_BIG_FRAC: 29.1 / 540,
  R_SMALL_FRAC: 26.09 / 540,
  BUTT_ROUND: 2.3,
  TIP_ROUND: 2.5,
  TAPER_CURVE: 0.9,
  SPINE_FRAC: 24.08 / 540,
  SPINE_RX_FRAC: 130.46 / 540,
} as const;
/** Real `shape:'capsule'` in the actual source (`rx:212, capR:50`) — see CUCUMBER_GEOMETRY's own doc for why this is a genuine stadium, not a taper. */
export const BAGUETTE_GEOMETRY = {
  RX_FRAC: 186.76 / 540,
  CAP_R_FRAC: 44.05 / 540,
} as const;
/** Real `shape:'capsule'` in the actual source (`rx:174, capR:110`). */
export const PINEAPPLE_GEOMETRY = {
  RX_FRAC: 161.33 / 540,
  CAP_R_FRAC: 101.99 / 540,
} as const;

/**
 * ===== New-ingredient integration pack — Ginger/Green Chili/Cilantro/
 * Green Onion/Lime, ported from KNIFECRAFT-NEW-INGREDIENTS. =====
 *
 * The package's own `01-ingredients.js` gives each ingredient's geometry
 * in the SOURCE knifecraft.html's raw, pre-rescale design-canvas units —
 * the same units TOMATO_GEOMETRY's/CARROT_GEOMETRY's own "Phase 18B-1
 * audit" comments describe finding stale and re-deriving (their raw
 * 148/128 and 210/56/10 were never run through the real-cm scale pass
 * either). That pass's own exact formula (`PX_PER_CM`/`SIZE_REF_CM`/
 * `SIZE_GAMMA` combined into a per-ingredient k-factor) was a one-time
 * derivation done by scripts that no longer exist in this repo — only
 * its inputs (REAL_CM, SIZE_GAMMA=0.5) and a few worked examples survive
 * in comments, not enough to reconstruct the exact k(REAL_CM) formula
 * with confidence. Re-deriving it wrong would silently mis-size these
 * five ingredients relative to the other 52 — worse than not guessing.
 *
 * Instead, each new ingredient is scaled against the closest already-
 * correctly-scaled PRODUCTION sibling of similar real-world size (same
 * REAL_CM table both sides), using the one formula input that IS given
 * outright: `scale = (newRealCmLong / anchorRealCmLong) ^ SIZE_GAMMA`
 * (SIZE_GAMMA = 0.5), applied to the anchor's own final on-canvas size —
 * never to a reconstructed global formula. This is the same kind of
 * judgment call CARROT_GEOMETRY's own doc already documents making
 * ("size-balancing correction pass... visually tiny... scaled up 1.3x")
 * when a formula-only value read wrong in gameplay: anchored, reasoned,
 * and checked, not invented from nothing. Anchors used (all real-cm
 * values from the package's own README / production's existing
 * ingredient roster):
 *   Ginger   14x9  cluster -> anchor Basil       15x10 cluster
 *   Cilantro 17x12 cluster -> anchor Parsley     18x12 cluster
 *   Spring Onion 34x11 cluster/bundle -> anchor Asparagus 24x8 cluster (the
 *     package's own doc: "asparagus's BUNDLE verbatim")
 *   Lime     6x4.5 ellipse -> anchor Lemon        8x6  ellipse (the
 *     package's own doc: "the LEMON verbatim... repalettized")
 *   Green Chili 12x2.2 taper -> anchor Pea Pod    9x3  taper (closest
 *     existing thin taper)
 * The package's own authored shape/proportions (leaf placement, taper
 * curve, rind/pith/flesh insets) are preserved exactly, uniformly
 * rescaled by one factor per ingredient — never distorted per-axis.
 */

/**
 * Green Chili — `taper` with Eggplant's own `spine` bow (see
 * EGGPLANT_GEOMETRY). `TAPER_CURVE`/`BUTT_ROUND`/`TIP_ROUND` are
 * dimensionless (no k-scaling, copied verbatim from the package); `rx`/
 * `R_BIG_FRAC`/`R_SMALL_FRAC`/spine are lengths, scaled by this
 * ingredient's own anchor factor (see the block doc above): package raw
 * rx=198 x0.7608 = 150.64, rBig=42 x0.7608 = 31.95, rSmall=6 x0.7608 =
 * 4.56, spine=14 x0.7608 = 10.65.
 */
export const CHILLI_GEOMETRY = {
  RX_FRAC: 150.64 / 540,
  R_BIG_FRAC: 31.95 / 540,
  R_SMALL_FRAC: 4.56 / 540,
  BUTT_ROUND: 0.62,
  TIP_ROUND: 3.6,
  TAPER_CURVE: 0.82,
  SPINE_FRAC: 10.65 / 540,
  SPINE_RX_FRAC: 150.64 / 540,
} as const;

/**
 * Lime — Lemon's own `ellipse` geometry (rind/pith/flesh insets, radial
 * segment scaffold — see limeTexture.ts), scaled down from LEMON_GEOMETRY
 * by this ingredient's own anchor factor (see the block doc above):
 * rx = 97.82 x (6/8)^0.5 = 84.71, ry = 77.63 x (4.5/6)^0.5 = 67.23. A
 * genuinely separate ingredient id/geometry/texture from Lemon, not an
 * alias — Lemon's own geometry is untouched.
 */
export const LIME_GEOMETRY = { RX_FRAC: 84.71 / 540, RY_FRAC: 67.23 / 540 } as const;

// ---------- block (the real oblique/isometric box — depthX/depthY are the receding edge, ported directly from knifecraft.html's actual CONFIG.INGREDIENTS.{cheddar,butter,tofu}.geom, scaled by this phase's own k-factor exactly like rx/ry) ----------

export const CHEDDAR_GEOMETRY = {
  RX_FRAC: 114.4 / 540,
  RY_FRAC: 77.44 / 540,
  DEPTH_X_FRAC: 56.32 / 540, // 64 * k(0.88)
  DEPTH_Y_FRAC: 38.72 / 540, // 44 * k(0.88)
} as const;
export const BUTTER_GEOMETRY = {
  RX_FRAC: 114.24 / 540,
  RY_FRAC: 55.39 / 540,
  DEPTH_X_FRAC: 45.01 / 540, // 52 * k(0.8655)
  DEPTH_Y_FRAC: 29.43 / 540, // 34 * k(0.8655)
} as const;
export const TOFU_GEOMETRY = {
  RX_FRAC: 108.07 / 540,
  RY_FRAC: 81.98 / 540,
  DEPTH_X_FRAC: 54.03 / 540, // 58 * k(0.9316)
  DEPTH_Y_FRAC: 37.26 / 540, // 40 * k(0.9316)
} as const;

// ---------- fillet (proteins only — two independent rails, see makeFilletSilhouette's own doc) ----------

/**
 * CHICKEN_GEOMETRY — ported directly from knifecraft.html's actual
 * `chicken.geom` (source `:1319`): `shape:'fillet', rx:188, ry:96`, the
 * DEFAULT rail tuning (no bias/full/bow/tilt/topFull/botFull/wob
 * overrides — see `FILLET_DEFAULTS` in ingredientShapes.ts). REAL_CM
 * `[16, 9]`.
 *
 * Player-requested: a small uniform size-down pass (×0.92 on both radii,
 * same aspect ratio, silhouette shape/rail tuning otherwise untouched) —
 * 188/96 -> 173/88.3. Steak and Salmon below get the same ×0.92.
 */
export const CHICKEN_GEOMETRY = {
  RX_FRAC: 172.96 / 540,
  RY_FRAC: 88.32 / 540,
} as const;

/**
 * STEAK_GEOMETRY — ported directly from knifecraft.html's actual
 * `steak.geom` (source `:1355`): `shape:'fillet', rx:180, ry:138`, plus
 * the ribeye's own rail retuning (bias/full/bow/tilt/topFull/botFull/
 * wob) — a teardrop, one broad round shoulder running out to a blunt
 * point, so only the SAME `fillet` family's numbers change, never the
 * geometry itself. REAL_CM `[17, 13]`.
 *
 * Player-requested ×0.92 size-down (see CHICKEN_GEOMETRY's own note):
 * 180/138 -> 165.6/126.96. BIAS/FULL/BOW/TILT/TOP_FULL/BOT_FULL/WOB are
 * shape-only (unitless rail fractions) and stay exactly as tuned.
 *
 * Player-reported follow-up: still overhung the board's edge (Ingredient
 * Lab screenshot) — steak-only, one more small size-down on top of the
 * above, ×0.90: 165.6/126.96 -> 149.04/114.26 (×0.828 off the true
 * original 180/138). Chicken/Salmon are untouched by this second pass.
 */
export const STEAK_GEOMETRY = {
  RX_FRAC: 149.04 / 540,
  RY_FRAC: 114.26 / 540,
  BIAS: 0.52,
  FULL: 0.7,
  BOW: 0.05,
  TILT: 0.1,
  TOP_FULL: 0.1,
  BOT_FULL: 0.2,
  WOB: 0.05,
} as const;

/**
 * SALMON_GEOMETRY — ported directly from knifecraft.html's actual
 * `salmon.geom` (source `:1382`): `shape:'fillet', rx:200, ry:100`, the
 * long-pointed aspect the `fillet` family was named for. REAL_CM
 * `[25, 11]`.
 *
 * Player-requested ×0.92 size-down (see CHICKEN_GEOMETRY's own note):
 * 200/100 -> 184/92. BIAS/FULL/BOW/TILT/TOP_FULL/BOT_FULL/WOB are
 * shape-only (unitless rail fractions) and stay exactly as tuned.
 */
export const SALMON_GEOMETRY = {
  RX_FRAC: 184 / 540,
  RY_FRAC: 92 / 540,
  BIAS: 0.44,
  FULL: 0.54,
  BOW: 0.08,
  TILT: 0.16,
  TOP_FULL: 0.12,
  BOT_FULL: 0.14,
  WOB: 0.03,
} as const;

// ---------- cluster (leaf list IS the geometry — see BASIL_LEAVES's own doc above for the shared convention) ----------

export const BROCCOLI_LEAVES: ClusterLeaf[] = [
  { dx: 5.29, dy: -26.44, rx: 38.79, ry: 35.26, rot: -0.1 },
  { dx: 8.82, dy: 22.92, rx: 37.9, ry: 34.38, rot: 0.14 },
  { dx: 44.08, dy: -7.05, rx: 41.43, ry: 37.9, rot: 0.22 },
  { dx: 40.55, dy: -52.89, rx: 36.14, ry: 32.62, rot: -0.2 },
  { dx: 42.31, dy: 49.36, rx: 36.14, ry: 32.62, rot: 0.3 },
  { dx: 82.86, dy: -59.94, rx: 30.85, ry: 28.21, rot: 0.34 },
  { dx: 86.39, dy: -21.16, rx: 34.38, ry: 30.85, rot: -0.16 },
  { dx: 88.15, dy: 21.16, rx: 34.38, ry: 30.85, rot: 0.18 },
  { dx: 81.1, dy: 59.94, rx: 30.85, ry: 27.33, rot: -0.3 },
  { dx: 111.07, dy: -38.79, rx: 23.8, ry: 22.04, rot: 0.12 },
  { dx: 116.36, dy: 1.76, rx: 25.56, ry: 22.92, rot: -0.24 },
  { dx: 109.31, dy: 40.55, rx: 23.8, ry: 21.16, rot: 0.28 },
  { dx: 56.42, dy: -84.62, rx: 22.04, ry: 20.27, rot: -0.36 },
  { dx: 59.94, dy: 82.86, rx: 22.04, ry: 19.39, rot: 0.32 },
  { dx: 17.63, dy: -63.47, rx: 23.8, ry: 21.16, rot: 0.06 },
  { dx: 19.39, dy: 59.94, rx: 23.8, ry: 21.16, rot: -0.12 },
  { dx: -100.49, dy: 7.05, rx: 56.42, ry: 23.8, rot: 0.05, stem: true },
  { dx: -42.31, dy: -21.16, rx: 40.55, ry: 10.58, rot: -0.3, stem: true },
  { dx: -40.55, dy: -10.58, rx: 40.55, ry: 11.46, rot: -0.18, stem: true },
  { dx: -42.31, dy: 19.39, rx: 38.79, ry: 10.58, rot: 0.22, stem: true },
  { dx: -44.07, dy: 29.97, rx: 40.55, ry: 9.7, rot: 0.3, stem: true },
];

export const LETTUCE_LEAVES: ClusterLeaf[] = [
  { dx: -90.14, dy: -4.58, rx: 59.58, ry: 45.83, rot: 3.191 },
  { dx: -65.7, dy: -55, rx: 61.11, ry: 45.83, rot: 3.838 },
  { dx: -16.81, dy: -79.45, rx: 62.64, ry: 47.36, rot: 4.504 },
  { dx: 33.61, dy: -74.86, rx: 62.64, ry: 47.36, rot: 5.135 },
  { dx: 79.45, dy: -35.14, rx: 61.11, ry: 45.83, rot: 5.867 },
  { dx: 91.67, dy: 18.33, rx: 58.06, ry: 44.31, rot: 0.197 },
  { dx: -84.03, dy: 39.72, rx: 55, ry: 42.78, rot: 2.7 },
  { dx: 45.83, dy: 65.7, rx: 53.47, ry: 41.25, rot: 0.962 },
  { dx: -35.14, dy: 70.28, rx: 53.47, ry: 41.25, rot: 2.034 },
  { dx: -35.14, dy: -25.97, rx: 44.31, ry: 35.14, rot: 3.778 },
  { dx: 25.97, dy: -30.56, rx: 44.31, ry: 35.14, rot: 5.417 },
  { dx: 0, dy: 16.81, rx: 44.31, ry: 35.9, rot: 1.571 },
  { dx: 0, dy: -19.86, rx: 35.14, ry: 29.03, rot: 4.712 },
];

export const CAULIFLOWER_LEAVES: ClusterLeaf[] = [
  { dx: -5.68, dy: -28.41, rx: 41.66, ry: 37.88, rot: 0.1 },
  { dx: -9.47, dy: 24.62, rx: 40.72, ry: 36.93, rot: -0.14 },
  { dx: -47.34, dy: -7.58, rx: 44.5, ry: 40.72, rot: -0.22 },
  { dx: -43.56, dy: -56.81, rx: 38.82, ry: 35.04, rot: 0.2 },
  { dx: -45.45, dy: 53.03, rx: 38.82, ry: 35.04, rot: -0.3 },
  { dx: -89.01, dy: -64.39, rx: 33.14, ry: 30.3, rot: -0.34 },
  { dx: -92.8, dy: -22.73, rx: 36.93, ry: 33.14, rot: 0.16 },
  { dx: -94.69, dy: 22.73, rx: 36.93, ry: 33.14, rot: -0.18 },
  { dx: -87.11, dy: 64.39, rx: 33.14, ry: 29.35, rot: 0.3 },
  { dx: -119.31, dy: -41.66, rx: 25.57, ry: 23.67, rot: -0.12 },
  { dx: -124.99, dy: 1.89, rx: 27.46, ry: 24.62, rot: 0.24 },
  { dx: -117.42, dy: 43.56, rx: 25.57, ry: 22.73, rot: -0.28 },
  { dx: -60.6, dy: -90.9, rx: 23.67, ry: 21.78, rot: 0.36 },
  { dx: -64.39, dy: 89.01, rx: 23.67, ry: 20.83, rot: -0.32 },
  { dx: -18.94, dy: -68.18, rx: 25.57, ry: 22.73, rot: -0.06 },
  { dx: -20.83, dy: 64.39, rx: 25.57, ry: 22.73, rot: 0.12 },
  { dx: 107.95, dy: 7.58, rx: 60.6, ry: 25.57, rot: -0.05, stem: true },
  { dx: 45.45, dy: -22.73, rx: 43.56, ry: 11.36, rot: 0.3, stem: true },
  { dx: 43.56, dy: -11.36, rx: 43.56, ry: 12.31, rot: 0.18, stem: true },
  { dx: 45.45, dy: 20.83, rx: 41.66, ry: 11.36, rot: -0.22, stem: true },
  { dx: 47.35, dy: 32.19, rx: 43.56, ry: 10.42, rot: -0.3, stem: true },
];

export const SPINACH_LEAVES: ClusterLeaf[] = [
  { dx: -27.22, dy: -67.26, rx: 64.06, ry: 37.63, rot: -0.22 },
  { dx: 44.84, dy: -73.66, rx: 67.26, ry: 39.23, rot: 0.1 },
  { dx: 94.48, dy: -35.23, rx: 62.45, ry: 36.03, rot: 0.34 },
  { dx: 24.02, dy: -20.82, rx: 70.46, ry: 41.64, rot: -0.06 },
  { dx: 89.68, dy: 17.62, rx: 60.85, ry: 35.23, rot: 0.26 },
  { dx: 28.83, dy: 35.23, rx: 65.66, ry: 37.63, rot: 0.12 },
  { dx: -24.02, dy: 8.01, rx: 59.25, ry: 34.43, rot: -0.34 },
  { dx: -14.41, dy: 59.25, rx: 57.65, ry: 32.83, rot: -0.1 },
  { dx: -118.02, dy: -39.95, rx: 37.63, ry: 4.16, rot: -0.438, stem: true },
  { dx: -86.64, dy: -48.04, rx: 78.63, ry: 4.32, rot: -0.464, stem: true },
  { dx: -54.37, dy: -29.71, rx: 100.17, ry: 4, rot: -0.285, stem: true },
  { dx: -97.69, dy: -4.24, rx: 59.25, ry: 4.16, rot: -0.236, stem: true },
  { dx: -55.81, dy: 11.05, rx: 93.6, ry: 4, rot: -0.104, stem: true },
  { dx: -91.84, dy: 30.35, rx: 61.97, ry: 4.32, rot: -0.053, stem: true },
  { dx: -110.58, dy: 36.27, rx: 38.19, ry: 4, rot: -0.271, stem: true },
  { dx: -108.74, dy: 62.37, rx: 43.48, ry: 3.84, rot: 0.072, stem: true },
];

export const ASPARAGUS_LEAVES: ClusterLeaf[] = [
  { dx: -7.97, dy: -63.8, rx: 119.63, ry: 9.17, rot: -0.085 },
  { dx: 4.79, dy: -47.85, rx: 126.01, ry: 9.57, rot: -0.062 },
  { dx: -3.19, dy: -31.9, rx: 122.82, ry: 9.17, rot: -0.04 },
  { dx: 6.38, dy: -15.95, rx: 129.2, ry: 9.97, rot: -0.018 },
  { dx: -1.59, dy: 0, rx: 126.01, ry: 9.57, rot: 0.004 },
  { dx: 7.98, dy: 15.95, rx: 130.79, ry: 9.97, rot: 0.026 },
  { dx: -4.78, dy: 31.9, rx: 122.82, ry: 9.17, rot: 0.048 },
  { dx: 3.19, dy: 47.85, rx: 126.01, ry: 9.57, rot: 0.07 },
  { dx: -6.38, dy: 63.8, rx: 118.03, ry: 8.77, rot: 0.092 },
];

export const GREENBEAN_LEAVES: ClusterLeaf[] = [
  { dx: -6.91, dy: -55.27, rx: 86.36, ry: 8.64, rot: -0.07 },
  { dx: 4.61, dy: -36.84, rx: 90.96, ry: 9.21, rot: -0.048 },
  { dx: -2.3, dy: -18.42, rx: 88.66, ry: 8.92, rot: -0.026 },
  { dx: 5.76, dy: 0, rx: 93.26, ry: 9.5, rot: 0 },
  { dx: -3.45, dy: 18.42, rx: 89.81, ry: 8.92, rot: 0.026 },
  { dx: 3.45, dy: 36.84, rx: 92.11, ry: 9.21, rot: 0.05 },
  { dx: -5.76, dy: 55.27, rx: 85.2, ry: 8.35, rot: 0.074 },
];

export const GRAPES_LEAVES: ClusterLeaf[] = [
  { dx: -28.87, dy: -100.18, rx: 24.62, ry: 26.32 },
  { dx: 25.47, dy: -95.09, rx: 24.62, ry: 26.32 },
  { dx: -56.03, dy: -52.64, rx: 28.02, ry: 29.72 },
  { dx: 1.7, dy: -59.43, rx: 27.17, ry: 28.87 },
  { dx: 54.34, dy: -49.24, rx: 28.02, ry: 29.72 },
  { dx: -61.13, dy: 1.7, rx: 29.72, ry: 31.41 },
  { dx: 0, dy: -5.09, rx: 29.72, ry: 31.41 },
  { dx: 57.73, dy: 5.09, rx: 28.87, ry: 30.56 },
  { dx: -37.36, dy: 52.64, rx: 28.02, ry: 29.72 },
  { dx: 23.77, dy: 56.03, rx: 28.02, ry: 29.72 },
  { dx: -5.09, dy: 106.97, rx: 24.62, ry: 26.32 },
];

export const ARTICHOKE_LEAVES: ClusterLeaf[] = [
  { dx: -16.74, dy: -91.3, rx: 22.82, ry: 16.74, rot: -1.627 },
  { dx: 16.74, dy: -91.3, rx: 22.82, ry: 16.74, rot: -1.515 },
  { dx: -39.56, dy: -71.52, rx: 25.87, ry: 19.02, rot: -1.721 },
  { dx: 0, dy: -71.52, rx: 25.87, ry: 19.02, rot: -1.571 },
  { dx: 39.56, dy: -71.52, rx: 25.87, ry: 19.02, rot: -1.421 },
  { dx: -60.86, dy: -45.65, rx: 28.91, ry: 21.3, rot: -1.842 },
  { dx: -20.54, dy: -45.65, rx: 28.91, ry: 21.3, rot: -1.662 },
  { dx: 20.54, dy: -45.65, rx: 28.91, ry: 21.3, rot: -1.479 },
  { dx: 60.86, dy: -45.65, rx: 28.91, ry: 21.3, rot: -1.3 },
  { dx: -79.12, dy: -16.74, rx: 31.95, ry: 23.58, rot: -1.976 },
  { dx: -39.56, dy: -16.74, rx: 31.95, ry: 23.58, rot: -1.774 },
  { dx: 0, dy: -16.74, rx: 31.95, ry: 23.58, rot: -1.571 },
  { dx: 39.56, dy: -16.74, rx: 31.95, ry: 23.58, rot: -1.368 },
  { dx: 79.12, dy: -16.74, rx: 31.95, ry: 23.58, rot: -1.165 },
  { dx: -83.69, dy: 15.22, rx: 33.48, ry: 25.11, rot: -2.149 },
  { dx: -42.6, dy: 15.22, rx: 33.48, ry: 25.11, rot: -1.865 },
  { dx: 0, dy: 15.22, rx: 33.48, ry: 25.11, rot: -1.571 },
  { dx: 42.6, dy: 15.22, rx: 33.48, ry: 25.11, rot: -1.277 },
  { dx: 83.69, dy: 15.22, rx: 33.48, ry: 25.11, rot: -0.993 },
  { dx: -71.52, dy: 47.17, rx: 33.48, ry: 25.11, rot: -2.256 },
  { dx: -24.35, dy: 47.17, rx: 33.48, ry: 25.11, rot: -1.804 },
  { dx: 24.35, dy: 47.17, rx: 33.48, ry: 25.11, rot: -1.338 },
  { dx: 71.52, dy: 47.17, rx: 33.48, ry: 25.11, rot: -0.886 },
  { dx: -50.21, dy: 76.08, rx: 30.43, ry: 23.58, rot: -2.214 },
  { dx: 0, dy: 76.08, rx: 30.43, ry: 23.58, rot: -1.571 },
  { dx: 50.21, dy: 76.08, rx: 30.43, ry: 23.58, rot: -0.928 },
];

/**
 * Ginger — a rhizome HAND: one thick diagonal mass (`mass: true`) with
 * four unequal fingers (`tip: true`) budding off it at different angles,
 * plus two small unlabeled knobs, ported verbatim (same relative
 * dx/dy/rx/ry/rot layout) from the package's `01-ingredients.js`, scaled
 * uniformly by this ingredient's own anchor factor — see the geometry
 * block doc above (CHILLI_GEOMETRY's neighbor) for the full derivation.
 * `mass`/`tip` are read only by gingerTexture.ts's own paint code (contact
 * shadows, finger-end nodes) — geometry math ignores them, same as `stem`.
 */
export const GINGER_LEAVES: ClusterLeaf[] = [
  { dx: -6.63, dy: -14.2, rx: 70.99, ry: 26.5, rot: -0.15, mass: true },
  { dx: 45.44, dy: -7.57, rx: 45.44, ry: 22.72, rot: 0.06, mass: true },
  { dx: 35.02, dy: -40.7, rx: 28.4, ry: 17.04, rot: -0.52 },
  { dx: 92.76, dy: 8.52, rx: 29.34, ry: 16.09, rot: 0.46, tip: true },
  { dx: -27.45, dy: 19.88, rx: 43.54, ry: 17.98, rot: 0.3, tip: true },
  { dx: 35.02, dy: 29.34, rx: 35.02, ry: 15.62, rot: -0.1, tip: true },
  { dx: -71.94, dy: -5.68, rx: 34.08, ry: 16.09, rot: -0.34, tip: true },
  { dx: 4.73, dy: -45.44, rx: 17.04, ry: 10.41, rot: -0.2 },
];

/**
 * Cilantro — Parsley's own cluster primitive with a completely different,
 * package-authored leaf layout: fewer, bigger fan blades (14 main +
 * 6 mid-band/centre + 6 stems, vs. Parsley's own 20+6) painted via the
 * shared `parsleyLeafShape` blade generator's new ROUND branch (see
 * PreparationScene's `requiresPeelFirst`-adjacent leafRound wiring and
 * parsleyTexture.ts's own doc) rather than Parsley's trifid path. Ported
 * verbatim from the package, scaled uniformly by this ingredient's own
 * anchor factor (Parsley, nearly identical real-world size) — see the
 * geometry block doc above.
 */
export const CILANTRO_LEAVES: ClusterLeaf[] = [
  { dx: -86.76, dy: -40.61, rx: 40.61, ry: 35.07, rot: -0.62 },
  { dx: -48.0, dy: -57.23, rx: 38.77, ry: 33.23, rot: -0.14 },
  { dx: -77.53, dy: 3.69, rx: 37.84, ry: 32.31, rot: 0.58 },
  { dx: -5.54, dy: -75.69, rx: 41.54, ry: 36.0, rot: -0.44 },
  { dx: 33.23, dy: -60.92, rx: 38.77, ry: 33.23, rot: 0.16 },
  { dx: 84.92, dy: -35.07, rx: 37.84, ry: 32.31, rot: -0.3 },
  { dx: 77.53, dy: 7.38, rx: 39.69, ry: 34.15, rot: 0.66 },
  { dx: -60.92, dy: 42.46, rx: 39.69, ry: 34.15, rot: -0.5 },
  { dx: -20.31, dy: 68.3, rx: 38.77, ry: 33.23, rot: 0.22 },
  { dx: 31.38, dy: 64.61, rx: 37.84, ry: 32.31, rot: 0.52 },
  { dx: 64.61, dy: 40.61, rx: 36.92, ry: 31.38, rot: -0.24 },
  // MID BAND — these two exist for the centre pixel, not the silhouette
  // (see the package's own doc: a fan blade grows to the right of its
  // base point, so a leaf centred on the bunch centre would leave that
  // centre in the petiole gap).
  { dx: -31.38, dy: 1.85, rx: 40.61, ry: 35.07, rot: 0 },
  { dx: -24.0, dy: -12.92, rx: 37.84, ry: 32.31, rot: 0.14 },
  // One leaflet sitting ON the bunch centre — the only placement that
  // guarantees the centre probe lands in green rather than a fan gap.
  { dx: 0, dy: 0, rx: 38.77, ry: 33.23, rot: 0.05 },
  { dx: 44.3, dy: 5.54, rx: 37.84, ry: 32.31, rot: 0.42 },
  { dx: -27.69, dy: 24.0, rx: 38.77, ry: 33.23, rot: 0.6 },
  // Six more leaflets filling the gaps between the big fans.
  { dx: -62.77, dy: -9.23, rx: 35.07, ry: 30.46, rot: -0.86 },
  { dx: -16.61, dy: -40.61, rx: 36.0, ry: 31.38, rot: -0.28 },
  { dx: 57.23, dy: -12.92, rx: 35.07, ry: 30.46, rot: 0.9 },
  { dx: 14.77, dy: 36.92, rx: 36.0, ry: 31.38, rot: 0.34 },
  { dx: -49.84, dy: 11.08, rx: 34.15, ry: 29.54, rot: 0.18 },
  { dx: 53.54, dy: 20.31, rx: 34.15, ry: 29.54, rot: -0.66 },
  { dx: -37.84, dy: -18.46, rx: 42.46, ry: 2.95, rot: -0.42, stem: true },
  { dx: 2.77, dy: -31.38, rx: 36.92, ry: 2.95, rot: 1.35, stem: true },
  { dx: 37.84, dy: -14.77, rx: 42.46, ry: 2.95, rot: -0.38, stem: true },
  { dx: -25.84, dy: 18.46, rx: 35.07, ry: 2.58, rot: 0.6, stem: true },
  { dx: 22.15, dy: 24.0, rx: 35.07, ry: 2.58, rot: -0.6, stem: true },
  { dx: -2.77, dy: 42.46, rx: 31.38, ry: 2.58, rot: 1.4, stem: true },
];

/**
 * Spring Onion / Scallion (id `springonion`) — Asparagus's own `bundle`
 * rule: one cluster lobe per stalk (seven, fanned), a genuine bunch
 * rather than a single body, so a chop gives one chunk per stalk per
 * band. Ported verbatim from the package, scaled uniformly by this
 * ingredient's own anchor factor (Asparagus, the package's own stated
 * "same rule" sibling) — see the geometry block doc above. The
 * lengthwise white-bulb -> pale-sheath -> deep-green gradient and the
 * root fringe live entirely in springOnionTexture.ts's own paint code;
 * geometry here only carries the seven stalks' placement/size.
 */
export const SPRINGONION_LEAVES: ClusterLeaf[] = [
  { dx: 5.69, dy: -59.78, rx: 128.11, ry: 13.52, rot: -0.046 },
  { dx: 18.5, dy: -39.86, rx: 139.5, ry: 14.23, rot: -0.03 },
  { dx: 9.96, dy: -19.93, rx: 132.38, ry: 13.88, rot: -0.014 },
  { dx: 22.77, dy: 0, rx: 142.34, ry: 14.59, rot: 0.002 },
  { dx: 12.81, dy: 19.93, rx: 135.23, ry: 14.23, rot: 0.018 },
  { dx: 21.35, dy: 39.86, rx: 138.07, ry: 14.59, rot: 0.034 },
  { dx: 7.12, dy: 59.78, rx: 126.68, ry: 13.52, rot: 0.048 },
];

/**
 * Knife MOTION geometry — the generic per-frame animation system every
 * knife shares, ported from knifecraft.html CONFIG.knife. Fractions are
 * of canvas width (the reference used px in a fixed 540-wide design
 * canvas). The blade's own SHAPE (length/height/heel/tip/belly) moved to
 * KnifeBladeShape (src/game/knives/knifeTypes.ts) in Phase 8 — it varies
 * per knife, so it no longer belongs in this global constant. The chef
 * knife's blade shape in knifeDefinitions.ts reproduces the values that
 * used to live here (188/540, 23/540, 66/540, -0.32) exactly.
 */
export const KNIFE_GEOMETRY = {
  KNIFE_ROT_LERP: 0.22, // per-frame rotation smoothing toward travel direction
  DIR_BASELINE_FRAC: 24 / 540, // travel direction measured over this much movement — shorter is sampling noise
  KNIFE_LIFT_FRAC: 4 / 540, // lift-off as the blade leaves the food
  KNIFE_ENTER_MS: 110,
  KNIFE_EXIT_MS: 200,
} as const;

/** knifecraft.html CONFIG.cutFeel — the seam opens under the blade during the stroke, not only at release. */
export const CUT_FEEL = {
  CUT_REVEAL_MS: 90,
  CUT_REVEAL_MIN_MS: 45,
  SETTLE_AT: 0.6, // piece separation begins at this fraction of the reveal
} as const;

/** knifecraft.html CONFIG.physics — a felt, never consciously noticed board nudge on knife impact. */
export const BOARD_NUDGE = { PX_FRAC: 1.5 / 540, MS: 120 } as const;

/**
 * knifecraft.html CONFIG.render.SLAB_OFFSET_PX / CONFIG.physics.PIECE_SETTLE_MS:
 * a cut piece does NOT fall, stack, or rotate — it nudges outward from the
 * ingredient's center by a few px (a "slab" parting, like a knife just
 * lifted the slice a hair) and eases to rest. No rotation, same as the
 * reference — see the porting report for how skipping the "no rotation"
 * rule produced crossing, chaotic-looking pieces on angled cuts.
 *
 * Player-reported: the original 4px reference value read as "no visible
 * gap at all" once several thin bands stack up (e.g. Tomato Slice's 12
 * cuts) — doubled to 8px, still a small parting nudge (not a drop, not a
 * scatter), just one a player can actually see between adjacent pieces.
 */
export const PIECE_SETTLE = { SLAB_OFFSET_PX_FRAC: 8 / 540, MS: 240 } as const;

/** knifecraft.html CONFIG.plating — pieces fly to the ceramic, staggered, with a small arc. */
export const PLATING = {
  PLATE_STAGGER_MS: 90,
  PLATE_FLIGHT_MS: 620,
  PLATE_SETTLE_MS: 240,
  PLATE_IN_MS: 280,
  PLATE_ARC_FRAC: 44 / 540,
  PLATE_RX_FRAC: 196 / 540,
  PLATE_RY_FRAC: 150 / 540,
  PLATE_DY_FRAC: 14 / 540,
  /**
   * Plating-presentation pass — how far the fanned-out food group's
   * center reaches toward the rim, as a fraction of the plate's own
   * rx/ry (previously hardcoded inline in startPlating as 0.52/0.3).
   * Raised moderately so a completed serving reads as an intentional
   * central arrangement rather than a tiny cluster lost in the middle of
   * a mostly-empty plate — see PreparationScene.startPlating's own doc
   * for the rest of that pass (settle scale / overlap / jitter, kept
   * scene-local since nothing else reads them).
   */
  GROUP_SPREAD_X_FRAC: 0.6,
  GROUP_SPREAD_Y_FRAC: 0.4,
  /** knifecraft.html Audio.plateSettle's pentatonic ladder — one note per landing piece, climbing. */
  CHIME_LADDER: [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7],
} as const;

/**
 * knifecraft.html CONFIG.sceneflow — the chef's hands enter, take the
 * plate, and leave with it (§63 "the loop closes when someone takes the
 * plate"). HANDS_LEAD_MS: hands start reaching in slightly before the
 * last piece has finished settling, so the motions overlap naturally.
 */
export const SCENEFLOW = {
  HANDS_LEAD_MS: 300,
  HANDS_ENTER_MS: 440,
  HANDS_GRIP_MS: 60,
  HANDS_EXIT_MS: 400,
  // Vertical distances — fractions of canvas HEIGHT (the reference's 720px/800px
  // were measured against its 960-tall design canvas, not its 540 width).
  HANDS_TRAVEL_FRAC: 720 / 960,
  ARM_LENGTH_FRAC: 800 / 960,
} as const;

/** A brief pause after the last cut settles before plating begins (knifecraft.html finishRecipe: +260ms). */
export const PLATING_START_DELAY_MS = 260;

/**
 * A new addition for this project (not literally in the Phase 1
 * reference, which stays at one camera distance throughout): the scene
 * opens pulled back to establish the kitchen, then pushes in to the
 * cutting station on the player's first touch. One-time, not replayed
 * on retry — retry must stay instant.
 */
export const CAMERA = {
  KITCHEN_ZOOM: 0.92,
  CUTTING_ZOOM: 1.08,
  TRANSITION_MS: 280,
} as const;
