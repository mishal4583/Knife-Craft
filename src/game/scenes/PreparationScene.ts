import Phaser from "phaser";
import {
  knifeTapCadence,
  tapBufferWindowMs,
  peelStrokeWidthFrac,
  tapSequenceMs,
} from "../knives/knifeTiming";
import { PauseManager } from "../PauseManager";
import { withRequiredPeelSteps } from "../prepStepGuards";
import { drawCoachGhost, coachCycleMs, type CoachTarget } from "./coachGhost";
import { nextCutIndex, nextOpenPosition, primaryCutAxis } from "../cutPlan";
import {
  CUT_SQUASH,
  type KnifePose,
  knifeProfile,
  knifeTipDir,
  paintKnife,
  poseForTipDir,
  quadraticPoints,
  swipeContactAlong,
  tapStrokePose,
  topViewProfile,
} from "./knifeProfile";
import { COACH_FIRST_DELAY_MS, COACH_STUCK_IDLE_MS } from "../coaching";
import { AudioManager } from "../AudioManager";
import {
  ASSIST,
  PERFECT,
  computeGrade,
  computeRadialGrade,
  computeRingsGrade,
  proxyCutQuality,
  isPerfectCut,
  qualityFor,
} from "../CutEvaluator";
import {
  type Axis,
  type Constraint,
  type Cut,
  type Piece,
  type Silhouette,
  bandRangeFor,
  dirSnap,
  fitStrokeDirection,
  idealPositions,
  interceptThrough,
  lineAngleDeg,
  liveAxis,
  pieceBounds,
  pieceCentroid,
  rebuildPieces,
  resolveContinuousPosition,
  visibleSeamSpanFor,
} from "../CutGeometry";
import {
  makeEllipseSilhouette,
  makeOrganicSilhouette,
  makePolygonSilhouette,
  makeTaperSilhouette,
  makeClusterSilhouette,
  makeBlockSilhouette,
  makeCapsuleSilhouette,
  makeFilletSilhouette,
  traceEllipsePath,
  traceOrganicPath,
  tracePolygonPath,
  traceClusterPath,
  traceBlockPath,
  traceCapsulePath,
  traceFilletPath,
  type LocalPoint,
  type ClusterLeaf,
  type EllipseModOpts,
  type FilletOpts,
} from "../ingredientShapes";
import {
  APPLE_POLY_GEOMETRY,
  BASIL_GEOMETRY,
  BASIL_PROFILE,
  BOARD_NUDGE,
  BREAD_GEOMETRY,
  CAMERA,
  CARROT_GEOMETRY,
  CHOP_KNIFE,
  CUCUMBER_GEOMETRY,
  CUT_FEEL,
  GARLIC_GEOMETRY,
  INGREDIENTS,
  KNIFE_GEOMETRY,
  MUSHROOM_POLY_GEOMETRY,
  ONION_GEOMETRY,
  ORANGE_GEOMETRY,
  PARSLEY_GEOMETRY,
  PARSLEY_PROFILE,
  PEEL,
  PEPPER_POLY_GEOMETRY,
  PIECE_SETTLE,
  PLATING,
  PLATING_START_DELAY_MS,
  POTATO_GEOMETRY,
  requiredCutsFor,
  resolveTechniqueFor,
  RINGS,
  SCENEFLOW,
  SMASH,
  STRAWBERRY_POLY_GEOMETRY,
  TAP_KNIFE,
  TECHNIQUES,
  TOMATO_GEOMETRY,
  ZUCCHINI_GEOMETRY,
  // Phase 18 — Claude Design ingredient merge geometry constants
  EGGPLANT_GEOMETRY,
  AVOCADO_GEOMETRY,
  PEAR_GEOMETRY,
  CORN_GEOMETRY,
  CELERY_GEOMETRY,
  MOZZARELLA_GEOMETRY,
  RADISH_GEOMETRY,
  BEETROOT_GEOMETRY,
  SWEETPOTATO_GEOMETRY,
  PEAPOD_GEOMETRY,
  BAGUETTE_GEOMETRY,
  PINEAPPLE_GEOMETRY,
  LEMON_GEOMETRY,
  PEACH_GEOMETRY,
  CABBAGE_GEOMETRY,
  WATERMELON_GEOMETRY,
  MANGO_GEOMETRY,
  KIWI_GEOMETRY,
  POMEGRANATE_GEOMETRY,
  COCONUT_GEOMETRY,
  FENNEL_GEOMETRY,
  PUMPKIN_GEOMETRY,
  TURNIP_GEOMETRY,
  CHEDDAR_GEOMETRY,
  BUTTER_GEOMETRY,
  TOFU_GEOMETRY,
  // Proteins — Claude Design final freeze
  CHICKEN_GEOMETRY,
  STEAK_GEOMETRY,
  SALMON_GEOMETRY,
  // New-ingredient integration pack
  CHILLI_GEOMETRY,
  LIME_GEOMETRY,
  type IngredientDefinition,
  type IngredientId,
  type TechniqueDefinition,
  type TechniqueId,
  type ProteinDepthConfig,
  type ProteinDepthEdgeConfig,
  type ProteinFaceConfig,
} from "../definitions";
import { knifeOrDefault, DEFAULT_KNIFE_ID } from "../knives/knifeDefinitions";
import type { KnifeDefinition } from "../knives/knifeTypes";
import { boardOrDefault, DEFAULT_BOARD_ID } from "../boards/boardDefinitions";
import type { BoardDefinition } from "../boards/boardTypes";
import { APPLE_SIL } from "../shapes/appleShape";
import { MUSHROOM_SIL } from "../shapes/mushroomShape";
import { PEPPER_SIL } from "../shapes/pepperShape";
import { STRAWBERRY_SIL } from "../shapes/strawberryShape";
import {
  CMD,
  EVT,
  type CutCompletedPayload,
  type PrepStep,
  type RecipeCompletedPayload,
  type StartPreparationConfig,
} from "../events";
import { computeBoardQuad, paintBoardTexture, type BoardQuad } from "../textures/boardTexture";
import { paintTomatoTexture, tomatoTextureSize } from "../textures/tomatoTexture";
import {
  getPlatingArrangement,
  seedFor,
  pieceBoundingRadius,
  computeFoodSafeRadius,
  calculateCompositionBounds,
  fitCompositionToSafeRadius,
  computeExtraShrink,
} from "../plating/platingArrangement";
import {
  carrotTextureSize,
  paintCarrotTexture,
  traceTaperPath,
  type TaperPaintOpts,
} from "../textures/carrotTexture";
import { cucumberTextureSize, paintCucumberTexture } from "../textures/cucumberTexture";
import { onionTextureSize, paintOnionTexture } from "../textures/onionTexture";
import { potatoTextureSize, paintPotatoTexture } from "../textures/potatoTexture";
import { garlicTextureSize, paintGarlicTexture, traceGarlicPath } from "../textures/garlicTexture";
import { basilTextureSize, paintBasilTexture } from "../textures/basilTexture";
import { parsleyTextureSize, paintParsleyTexture } from "../textures/parsleyTexture";
import { mushroomTextureSize, paintMushroomTexture } from "../textures/mushroomTexture";
import { pepperTextureSize, paintPepperTexture } from "../textures/pepperTexture";
import { zucchiniTextureSize, paintZucchiniTexture } from "../textures/zucchiniTexture";
import { breadTextureSize, paintBreadTexture } from "../textures/breadTexture";
import { strawberryTextureSize, paintStrawberryTexture } from "../textures/strawberryTexture";
import { appleTextureSize, paintAppleTexture } from "../textures/appleTexture";
import { orangeTextureSize, paintOrangeTexture } from "../textures/orangeTexture";
import {
  paintPieceTexture,
  paintRingPieceTexture,
  clipHalfPlaneWorld,
  clipCutBand,
} from "../textures/pieceTexture";
// Phase 18 — Claude Design ingredient merge texture modules
import { basilLeavesAt } from "../textures/basilTexture";
import { parsleyLeavesAt } from "../textures/parsleyTexture";
import {
  broccoliTextureSize,
  paintBroccoliTexture,
  broccoliLeavesAt,
} from "../textures/broccoliTexture";
import {
  lettuceTextureSize,
  paintLettuceTexture,
  lettuceLeavesAt,
} from "../textures/lettuceTexture";
import {
  cauliflowerTextureSize,
  paintCauliflowerTexture,
  cauliflowerLeavesAt,
} from "../textures/cauliflowerTexture";
import {
  spinachTextureSize,
  paintSpinachTexture,
  spinachLeavesAt,
} from "../textures/spinachTexture";
import {
  asparagusTextureSize,
  paintAsparagusTexture,
  asparagusLeavesAt,
} from "../textures/asparagusTexture";
import {
  greenBeanTextureSize,
  paintGreenBeanTexture,
  greenBeanLeavesAt,
} from "../textures/greenBeanTexture";
import { grapesTextureSize, paintGrapesTexture, grapesLeavesAt } from "../textures/grapesTexture";
import {
  artichokeTextureSize,
  paintArtichokeTexture,
  artichokeLeavesAt,
} from "../textures/artichokeTexture";
import { cheddarTextureSize, paintCheddarTexture } from "../textures/cheddarTexture";
import { butterTextureSize, paintButterTexture } from "../textures/butterTexture";
import { tofuTextureSize, paintTofuTexture } from "../textures/tofuTexture";
import { eggplantTextureSize, paintEggplantTexture } from "../textures/eggplantTexture";
import { avocadoTextureSize, paintAvocadoTexture } from "../textures/avocadoTexture";
import { pearTextureSize, paintPearTexture } from "../textures/pearTexture";
import { cornTextureSize, paintCornTexture } from "../textures/cornTexture";
import { celeryTextureSize, paintCeleryTexture } from "../textures/celeryTexture";
import { radishTextureSize, paintRadishTexture } from "../textures/radishTexture";
import { beetrootTextureSize, paintBeetrootTexture } from "../textures/beetrootTexture";
import { sweetPotatoTextureSize, paintSweetPotatoTexture } from "../textures/sweetPotatoTexture";
import { peaPodTextureSize, paintPeaPodTexture } from "../textures/peaPodTexture";
import { baguetteTextureSize, paintBaguetteTexture } from "../textures/baguetteTexture";
import { pineappleTextureSize, paintPineappleTexture } from "../textures/pineappleTexture";
import { mozzarellaTextureSize, paintMozzarellaTexture } from "../textures/mozzarellaTexture";
import { lemonTextureSize, paintLemonTexture } from "../textures/lemonTexture";
import { peachTextureSize, paintPeachTexture } from "../textures/peachTexture";
import { cabbageTextureSize, paintCabbageTexture } from "../textures/cabbageTexture";
import { watermelonTextureSize, paintWatermelonTexture } from "../textures/watermelonTexture";
import { mangoTextureSize, paintMangoTexture } from "../textures/mangoTexture";
import { kiwiTextureSize, paintKiwiTexture } from "../textures/kiwiTexture";
import { pomegranateTextureSize, paintPomegranateTexture } from "../textures/pomegranateTexture";
import { coconutTextureSize, paintCoconutTexture } from "../textures/coconutTexture";
import { fennelTextureSize, paintFennelTexture } from "../textures/fennelTexture";
import { pumpkinTextureSize, paintPumpkinTexture } from "../textures/pumpkinTexture";
import { turnipTextureSize, paintTurnipTexture } from "../textures/turnipTexture";
import { chickenTextureSize, paintChickenTexture } from "../textures/chickenTexture";
import { steakTextureSize, paintSteakTexture } from "../textures/steakTexture";
import { salmonTextureSize, paintSalmonTexture } from "../textures/salmonTexture";
// New-ingredient integration pack — Ginger/Green Chili/Cilantro/Green Onion/Lime
import { gingerTextureSize, paintGingerTexture, gingerLeavesAt } from "../textures/gingerTexture";
import { chilliTextureSize, paintChilliTexture } from "../textures/chilliTexture";
import { limeTextureSize, paintLimeTexture } from "../textures/limeTexture";
import {
  cilantroTextureSize,
  paintCilantroTexture,
  cilantroLeavesAt,
} from "../textures/cilantroTexture";
import {
  springOnionTextureSize,
  paintSpringOnionTexture,
  springOnionLeavesAt,
} from "../textures/springOnionTexture";

const PALETTE = {
  gold: 0xd8a03d, // Phase 1 palette — guides, perfect-slice spark
  ivory: 0xfef8ec,
} as const;

/**
 * Phase 18 — Claude Design ingredient merge render registries. The
 * original 15 ingredients keep their EXACT existing dispatch (the
 * per-shape `*Geometry()` methods + if/else texture chains below,
 * untouched) — these registries are consulted FIRST, and only for the 34
 * new ingredients, so a lookup miss falls through to old behavior
 * unchanged. A per-ingredient-id if/else chain, extended 34 more times
 * across 3 dispatch functions, would have worked but stopped being
 * maintainable well before this — see the Phase 18 audit's own §18 note
 * on keeping the implementation maintainable at 49 ingredients.
 */
type EllipseRenderer = {
  geom: {
    RX_FRAC: number;
    RY_FRAC: number;
    /** Optional — see ingredientShapes.ts's EllipseModOpts for the exact port rationale. Absent = the exact old closed-form ellipse (identity) for every other ellipse ingredient. */
    LOBES?: number;
    SCALLOP?: number;
    OVOID?: number;
  };
  textureSize: (rx: number, ry: number, margin: number) => { w: number; h: number };
  /**
   * `peeled` is read only by the (rare) ellipse ingredient that has "peel"
   * in its own techniques list (Watermelon, Coconut). `hasCut` is read
   * only by a SKIN_KEEP ellipse ingredient (Kiwi, Mango, Pomegranate,
   * Fennel, Turnip's TAPER_RENDERERS siblings have the taper version
   * below) that bakes its permanent-skin exterior and its cut-face flesh
   * onto the one shared canvas — see redrawIngredientTexture's own doc on
   * why this can't just be `!cuts.length` read live like the source's
   * `skinAlpha`: production paints once per state change, not once per
   * frame, so the caller must repaint on the transition instead (see
   * commitCut's first-cut repaint). Every ingredient that doesn't need
   * either flag simply ignores the extra argument(s).
   */
  /**
   * `overhangGone` — the prototype's `drawOverhang`/`geom.overhang`
   * system (stem/crown/leaf-tops painted past the collision silhouette),
   * ported as a bake-time flag rather than a live per-frame fade layer
   * (production has no such layer — see redrawIngredientTexture's own
   * doc on why every state change here is a discrete repaint, not a
   * tween). True once `this.cuts.length > 0` (the SAME "first cut has
   * happened" moment `commitCut`'s `if (this.cuts.length === 1)
   * redrawIngredientTexture()` already triggers for every ingredient —
   * see that call site's own doc), computed independently of
   * `peeled`/`hasCut` above so it never conflicts with Mango/
   * Pomegranate/Fennel's own peel-driven flesh reveal. Read only by the
   * 14 ingredients with a real `geom.overhang` in the source (Peach,
   * Corn, Celery, Pineapple, Spring Onion, Radish, Beetroot, Mango,
   * Pomegranate, Fennel, Artichoke, Pea Pod, Pumpkin, Turnip); Green
   * Chili has `keepOverhang: true` in the source and simply never reads
   * this flag (its stalk/calyx always paint, every ingredient that
   * doesn't declare an overhang ignores the extra argument too).
   */
  paint: (
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    margin: number,
    opts?: EllipseModOpts,
    peeled?: boolean,
    hasCut?: boolean,
    overhangGone?: boolean,
  ) => void;
};
type TaperRenderer = {
  geom: {
    RX_FRAC: number;
    R_BIG_FRAC: number;
    R_SMALL_FRAC: number;
    BUTT_ROUND: number;
    TIP_ROUND: number;
    /** Optional — see ingredientShapes.ts's TaperCurveOpts for the exact port rationale. Absent = an exact identity (the original linear carrot sweep, no bow). */
    TAPER_CURVE?: number;
    SPINE_FRAC?: number;
    SPINE_RX_FRAC?: number;
  };
  textureSize: (rx: number, rBig: number, margin: number) => { w: number; h: number };
  /**
   * `hasCut` — see EllipseRenderer.paint's own doc; read only by the
   * SKIN_KEEP taper ingredients (Beetroot, Sweet Potato, Pea Pod).
   * `overhangGone` — see EllipseRenderer.paint's own doc; read only by
   * the taper ingredients with a real `geom.overhang` (Corn, Celery,
   * Radish, Beetroot, Pea Pod).
   */
  paint: (
    ctx: CanvasRenderingContext2D,
    rx: number,
    rBig: number,
    rSmall: number,
    buttRound: number,
    tipRound: number,
    margin: number,
    opts?: TaperPaintOpts,
    hasCut?: boolean,
    overhangGone?: boolean,
  ) => void;
};
/** Proteins only (chicken/steak/salmon) — no `peeled`/`hasCut` slot at all: no protein has a SKIN entry or a peel step in the source, and a real cut's pale interior is a separate, per-piece system (`ProteinFaceConfig`/`paintProteinCutFace`), not baked into this shared whole-ingredient canvas. */
type FilletRenderer = {
  geom: {
    RX_FRAC: number;
    RY_FRAC: number;
    BIAS?: number;
    FULL?: number;
    BOW?: number;
    TILT?: number;
    TOP_FULL?: number;
    BOT_FULL?: number;
    WOB?: number;
  };
  textureSize: (rx: number, ry: number, margin: number) => { w: number; h: number };
  paint: (
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    margin: number,
    opts?: FilletOpts,
  ) => void;
};
type CapsuleRenderer = {
  geom: { RX_FRAC: number; CAP_R_FRAC: number };
  textureSize: (rx: number, capR: number, margin: number) => { w: number; h: number };
  /**
   * `peeled` is read only by Pineapple (the one capsule ingredient with
   * "peel" in its own techniques list) — Baguette's own paint function
   * simply ignores the extra argument. `overhangGone` — see
   * EllipseRenderer.paint's own doc; read only by Pineapple (its spiky
   * crown, a real `geom.overhang` in the source, independent of its own
   * peeled state).
   */
  paint: (
    ctx: CanvasRenderingContext2D,
    rx: number,
    capR: number,
    margin: number,
    peeled?: boolean,
    overhangGone?: boolean,
  ) => void;
};
type ClusterRenderer = {
  leavesAt: (scale: number) => ClusterLeaf[];
  textureSize: (rx: number, ry: number, margin: number) => { w: number; h: number };
  /**
   * `peeled` — see EllipseRenderer.paint's own doc for the convention;
   * read only by Ginger (the one cluster ingredient with "peel" in its
   * own techniques list, see definitions.ts). `overhangGone` — see
   * EllipseRenderer.paint's own doc; read only by Artichoke and Spring
   * Onion (both have a real `geom.overhang` in the source). Every other
   * cluster ingredient's paint function simply ignores the extra
   * argument(s).
   */
  paint: (
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    margin: number,
    leaves: ClusterLeaf[],
    peeled?: boolean,
    overhangGone?: boolean,
  ) => void;
};
type BlockRenderer = {
  geom: { RX_FRAC: number; RY_FRAC: number; DEPTH_X_FRAC: number; DEPTH_Y_FRAC: number };
  textureSize: (rx: number, ry: number, margin: number) => { w: number; h: number };
  paint: (
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    depthX: number,
    depthY: number,
    margin: number,
  ) => void;
};

const ELLIPSE_RENDERERS: Partial<Record<IngredientId, EllipseRenderer>> = {
  lemon: { geom: LEMON_GEOMETRY, textureSize: lemonTextureSize, paint: paintLemonTexture },
  peach: { geom: PEACH_GEOMETRY, textureSize: peachTextureSize, paint: paintPeachTexture },
  cabbage: { geom: CABBAGE_GEOMETRY, textureSize: cabbageTextureSize, paint: paintCabbageTexture },
  watermelon: {
    geom: WATERMELON_GEOMETRY,
    textureSize: watermelonTextureSize,
    paint: paintWatermelonTexture,
  },
  mango: { geom: MANGO_GEOMETRY, textureSize: mangoTextureSize, paint: paintMangoTexture },
  kiwi: { geom: KIWI_GEOMETRY, textureSize: kiwiTextureSize, paint: paintKiwiTexture },
  pomegranate: {
    geom: POMEGRANATE_GEOMETRY,
    textureSize: pomegranateTextureSize,
    paint: paintPomegranateTexture,
  },
  coconut: { geom: COCONUT_GEOMETRY, textureSize: coconutTextureSize, paint: paintCoconutTexture },
  fennel: { geom: FENNEL_GEOMETRY, textureSize: fennelTextureSize, paint: paintFennelTexture },
  pumpkin: { geom: PUMPKIN_GEOMETRY, textureSize: pumpkinTextureSize, paint: paintPumpkinTexture },
  turnip: { geom: TURNIP_GEOMETRY, textureSize: turnipTextureSize, paint: paintTurnipTexture },
  lime: { geom: LIME_GEOMETRY, textureSize: limeTextureSize, paint: paintLimeTexture },
};

const TAPER_RENDERERS: Partial<Record<IngredientId, TaperRenderer>> = {
  eggplant: {
    geom: EGGPLANT_GEOMETRY,
    textureSize: eggplantTextureSize,
    paint: paintEggplantTexture,
  },
  avocado: { geom: AVOCADO_GEOMETRY, textureSize: avocadoTextureSize, paint: paintAvocadoTexture },
  pear: { geom: PEAR_GEOMETRY, textureSize: pearTextureSize, paint: paintPearTexture },
  corn: { geom: CORN_GEOMETRY, textureSize: cornTextureSize, paint: paintCornTexture },
  celery: { geom: CELERY_GEOMETRY, textureSize: celeryTextureSize, paint: paintCeleryTexture },
  mozzarella: {
    geom: MOZZARELLA_GEOMETRY,
    textureSize: mozzarellaTextureSize,
    paint: paintMozzarellaTexture,
  },
  radish: { geom: RADISH_GEOMETRY, textureSize: radishTextureSize, paint: paintRadishTexture },
  beetroot: {
    geom: BEETROOT_GEOMETRY,
    textureSize: beetrootTextureSize,
    paint: paintBeetrootTexture,
  },
  sweetpotato: {
    geom: SWEETPOTATO_GEOMETRY,
    textureSize: sweetPotatoTextureSize,
    paint: paintSweetPotatoTexture,
  },
  peapod: { geom: PEAPOD_GEOMETRY, textureSize: peaPodTextureSize, paint: paintPeaPodTexture },
  chilli: { geom: CHILLI_GEOMETRY, textureSize: chilliTextureSize, paint: paintChilliTexture },
};

/**
 * World-space direction a protein's 2.5D depth wall extrudes along —
 * ported verbatim from knifecraft.html's `const DEPTH_DIR` (`:5416`,
 * "the room lights from above, depth falls away below"). Used only by
 * `paintProteinDepthWall` (proteins only — gated on `ingredient.depth`
 * being present).
 */
const PROTEIN_DEPTH_DIR = { x: 0.16, y: 1 };

/**
 * Plating-presentation-only tuning — startPlating()'s "thickness"
 * duplicate and contact-shadow (see createPlatingThickness/
 * createPlatingShadow's own docs). Deliberately scene-local, not in
 * definitions.ts's shared PLATING block: nothing outside startPlating
 * ever reads these, matching this file's existing precedent for a
 * feature-local magic number (e.g. skipPlating's own `FAST_FORWARD`).
 * None of this exists while a piece sits on the cutting board — only
 * from startPlating() onward.
 */
// A warm, fairly dark neutral — multiplied (Phaser tint) over the piece's
// own baked colors, so it reads as "this piece's own material, in
// shadow" rather than a flat generic drop-shadow color regardless of
// what's being plated (cucumber green, carrot orange, chicken pink, ...).
const PLATING_THICKNESS_TINT = 0x6b5a46;
// Side-wall thickness as a fraction of the piece's own on-screen size
// (min of its display width/height) — "proportional to the piece size",
// clamped so a tiny garnish scrap and a large watermelon wedge both get
// a believable, never-invisible, never-slab-like wall.
const PLATING_THICKNESS_FRAC = 0.11;
const PLATING_THICKNESS_MIN_PX = 3;
const PLATING_THICKNESS_MAX_PX = 15;
// Proteins already carry real cut-face/depth-wall art and read as
// "meatier" — a modest boost here, not a new depth system, just how far
// the plating duplicate pokes out from behind its own piece.
const PLATING_THICKNESS_PROTEIN_MULT = 1.35;
// The duplicate's offset from its piece, in world px per 1px of
// thickness — a small, fixed screen-space direction (mostly down, a
// touch right), like a light source that doesn't rotate with the food,
// the same convention a real drop shadow follows. Never scales into a
// "giant vertical extrusion": bounded entirely by the clamped thickness
// above.
const PLATING_THICKNESS_OFFSET_X_PER_PX = 0.3;
const PLATING_THICKNESS_OFFSET_Y_PER_PX = 1;
// Contact shadow — a soft, squashed (never a full-silhouette) ellipse
// under each piece's actual visual center, sized relative to the piece
// itself so it never reads as one generic shadow blob reused everywhere.
const PLATING_SHADOW_COLOR = 0x2a1a10;
const PLATING_SHADOW_ALPHA = 0.22;
const PLATING_SHADOW_WIDTH_MULT = 0.92;
const PLATING_SHADOW_HEIGHT_MULT = 0.36;
const PLATING_SHADOW_Y_OFFSET_FRAC = 0.22;

const FILLET_RENDERERS: Partial<Record<IngredientId, FilletRenderer>> = {
  chicken: { geom: CHICKEN_GEOMETRY, textureSize: chickenTextureSize, paint: paintChickenTexture },
  steak: { geom: STEAK_GEOMETRY, textureSize: steakTextureSize, paint: paintSteakTexture },
  salmon: { geom: SALMON_GEOMETRY, textureSize: salmonTextureSize, paint: paintSalmonTexture },
};

/** Baguette/Pineapple/Cucumber are real `shape:'capsule'` in the actual Claude Design source (confirmed by direct grep) — a true stadium, not a taper with near-equal ends. Cucumber (one of the 5 common ingredients) keeps its own dedicated capsuleGeometry() accessor, matching the pre-existing per-ingredient-method convention; Baguette/Pineapple (added this phase) live in this registry instead, same pattern as every other new-roster shape family. */
const CAPSULE_RENDERERS: Partial<Record<IngredientId, CapsuleRenderer>> = {
  baguette: {
    geom: BAGUETTE_GEOMETRY,
    textureSize: baguetteTextureSize,
    paint: paintBaguetteTexture,
  },
  pineapple: {
    geom: PINEAPPLE_GEOMETRY,
    textureSize: pineappleTextureSize,
    paint: paintPineappleTexture,
  },
};

const CLUSTER_RENDERERS: Partial<Record<IngredientId, ClusterRenderer>> = {
  basil: { leavesAt: basilLeavesAt, textureSize: basilTextureSize, paint: paintBasilTexture },
  parsley: {
    leavesAt: parsleyLeavesAt,
    textureSize: parsleyTextureSize,
    paint: paintParsleyTexture,
  },
  broccoli: {
    leavesAt: broccoliLeavesAt,
    textureSize: broccoliTextureSize,
    paint: paintBroccoliTexture,
  },
  lettuce: {
    leavesAt: lettuceLeavesAt,
    textureSize: lettuceTextureSize,
    paint: paintLettuceTexture,
  },
  cauliflower: {
    leavesAt: cauliflowerLeavesAt,
    textureSize: cauliflowerTextureSize,
    paint: paintCauliflowerTexture,
  },
  spinach: {
    leavesAt: spinachLeavesAt,
    textureSize: spinachTextureSize,
    paint: paintSpinachTexture,
  },
  asparagus: {
    leavesAt: asparagusLeavesAt,
    textureSize: asparagusTextureSize,
    paint: paintAsparagusTexture,
  },
  greenbean: {
    leavesAt: greenBeanLeavesAt,
    textureSize: greenBeanTextureSize,
    paint: paintGreenBeanTexture,
  },
  grapes: { leavesAt: grapesLeavesAt, textureSize: grapesTextureSize, paint: paintGrapesTexture },
  artichoke: {
    leavesAt: artichokeLeavesAt,
    textureSize: artichokeTextureSize,
    paint: paintArtichokeTexture,
  },
  ginger: { leavesAt: gingerLeavesAt, textureSize: gingerTextureSize, paint: paintGingerTexture },
  cilantro: {
    leavesAt: cilantroLeavesAt,
    textureSize: cilantroTextureSize,
    paint: paintCilantroTexture,
  },
  springonion: {
    leavesAt: springOnionLeavesAt,
    textureSize: springOnionTextureSize,
    paint: paintSpringOnionTexture,
  },
};

const BLOCK_RENDERERS: Partial<Record<IngredientId, BlockRenderer>> = {
  cheddar: { geom: CHEDDAR_GEOMETRY, textureSize: cheddarTextureSize, paint: paintCheddarTexture },
  butter: { geom: BUTTER_GEOMETRY, textureSize: butterTextureSize, paint: paintButterTexture },
  tofu: { geom: TOFU_GEOMETRY, textureSize: tofuTextureSize, paint: paintTofuTexture },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolates the board's actual (subtly-trapezoidal) left/right edge, in pixels, at a given y-fraction (0 at the face's top edge, 1 at its bottom edge). */
function boardEdgesAtPx(q: BoardQuad, t: number): { xL: number; xR: number } {
  return {
    xL: lerp(q.xt0, q.xb0, t),
    xR: lerp(q.xt1, q.xb1, t),
  };
}

function drawDashedLine(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash = 6,
  gap = 5,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.floor(length / (dash + gap)));
  const ux = dx / length || 0;
  const uy = dy / length || 0;
  let drawn = 0;
  for (let i = 0; i < steps; i++) {
    const sx = x1 + ux * drawn;
    const sy = y1 + uy * drawn;
    const ex = x1 + ux * Math.min(length, drawn + dash);
    const ey = y1 + uy * Math.min(length, drawn + dash);
    g.lineBetween(sx, sy, ex, ey);
    drawn += dash + gap;
  }
}

/** Onion Rings' own guide primitive (Pre-Phase-8) — a dashed ellipse at one concentric radius, same "sample the outline, alternate dash/gap" spirit as drawDashedLine, just walked around an ellipse instead of a straight segment. */
function drawDashedEllipse(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const segments = 40;
  for (let i = 0; i < segments; i += 2) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    g.lineBetween(
      cx + Math.cos(a0) * rx,
      cy + Math.sin(a0) * ry,
      cx + Math.cos(a1) * rx,
      cy + Math.sin(a1) * ry,
    );
  }
}

type RecordedPoint = { x: number; y: number; time: number };

/**
 * "enter"/"active"/"exit" are the original swipe-tracking phases —
 * unchanged. "idle" is the never-disappears resting pose (§10). The
 * "tap*" phases are the new tap-cut animation (§6/§11): IDLE -> tapPrep
 * -> tapPause -> tapCut -> tapImpact -> tapRetract -> idle. Swipe and tap
 * never touch the same phase name, so drawKnife() can dispatch cleanly.
 */
type KnifePhase =
  | "idle"
  | "enter"
  | "active"
  | "exit"
  | "tapPrep"
  | "tapPause"
  | "tapCut"
  | "tapImpact"
  | "tapRetract";

type KnifeState = {
  x: number;
  y: number;
  rot: number;
  targetRot: number;
  dirSign: number;
  dirLatch: { dx: number; dy: number } | null;
  rotInit: boolean;
  phase: KnifePhase;
  enterT: number;
  exitT: number;
  /**
   * How far along the edge (px from the pivot) the point at (x, y) is. 0 =
   * the pivot itself. A steep swipe puts the middle of the edge on the
   * finger, so the blade crosses the cut there. It eases toward
   * targetContactAlong while swiping.
   */
  contactAlong?: number;
  targetContactAlong?: number;
  /** Swipe: the dirSign the knife is easing toward (it turns over through 0). */
  targetSign?: number;
  /** Swipe: the current tip direction (radians), kept for knifeTipDir's hysteresis. */
  tipDir?: number;
  /**
   * The top-view foreshortening (topViewProfile): CUT_SQUASH while it cuts
   * (stood on its edge), 1 at rest (lying flat). Eases toward targetSquash.
   */
  squash?: number;
  targetSquash?: number;
};

/** Cumulative drag distance from the gesture's first point before it counts as a swipe rather than a tap candidate (§29's "defer swipe activation"). */
const SWIPE_ACTIVATE_PX = 10;

/**
 * PREPARATION_SCENE — owns the entire cutting-board gameplay loop:
 * pointer tracking, cut-path recording, scoring, rendering, and pause.
 * React never touches any of this directly; it only sees the events this
 * scene puts on the bus.
 *
 * The cut/piece model (CutGeometry.ts) is general — the SAME code path
 * handles Slice (single axis), Dice (two perpendicular axes, PERP_SNAP),
 * and Julienne (free-angle, PARALLEL_SNAP) — ported from knifecraft.html's
 * `cuts`/`pieces`/`cons` system, not three separate approximations. A
 * piece is rendered by clipping the ingredient's shared silhouette
 * texture against every half-plane it has accumulated (pieceTexture.ts),
 * exactly mirroring the reference's `clipHalfPlane`/`drawPieces`.
 *
 * Deliberate simplification vs. the reference: a cut's POSITION still
 * snaps to the nearest unused guide slot rather than the reference's
 * continuous free-placement + collision-avoidance scan — same reasoning
 * as the original Slice port ("the guide the player is working").
 * Direction (axis + slope, including PERP_SNAP/PARALLEL_SNAP) is exact.
 */
export class PreparationScene extends Phaser.Scene {
  private bus!: Phaser.Events.EventEmitter;

  private knifeStats: KnifeDefinition = knifeOrDefault(DEFAULT_KNIFE_ID);
  private board: BoardDefinition = boardOrDefault(DEFAULT_BOARD_ID);
  private technique: TechniqueDefinition = TECHNIQUES.slice;
  private ingredient: IngredientDefinition = INGREDIENTS.tomato;
  private ingredientId: IngredientId = "tomato";
  /** The CURRENT STEP's required cut count (or "1 unit of progress" for peel/smash) — see requiredCutsFor(). For a single-step session this behaves exactly like the old whole-session field. */
  private requiredCuts = TECHNIQUES.slice.requiredCuts;

  // ---- Phase 5: multi-step sessions (§"multi-ingredient preparation
  // support") — one session is a SEQUENCE of {ingredientId, techniqueId}
  // steps. Consecutive same-ingredient steps chain (cuts/pieces persist,
  // see beginStep); a different ingredientId starts fresh. See
  // advanceStepOrFinish/closeOutCurrentIngredient.
  private steps: PrepStep[] = [{ ingredientId: "tomato", techniqueId: "slice" }];
  private stepIndex = 0;
  /** this.cuts.length when the CURRENT step began — "cuts done in this step" = this.cuts.length - stepCutsAtStart. Resets to 0 on a fresh ingredient, stays put across a same-ingredient chain step. */
  private stepCutsAtStart = 0;
  /** Every ingredient-segment's own cuts/timestamps/silhouette, snapshotted by closeOutCurrentIngredient() — finishRecipeNow() grades each and blends them (§"multi-ingredient grading"). */
  private closedSegments: {
    cuts: Cut[];
    timestamps: number[];
    silhouette: Silhouette;
    bandFor: (axis: Axis) => { lo: number; hi: number };
    tolOverride?: { evennessTol?: number; consistencyCvTol?: number };
    /** Phase 7 — Radial (TechniqueDefinition.radialSnap): routes this segment through computeRadialGrade instead of computeGrade — see finishRecipeNow. */
    radial?: boolean;
    /** Pre-Phase-8 — Rings: routes this segment through computeRingsGrade instead of computeGrade/computeRadialGrade — see finishRecipeNow. Present (and non-empty) only for a Rings step; cuts/timestamps/silhouette/bandFor above are unused/placeholder for this branch. */
    ringDeviations?: number[];
    ringTimestamps?: number[];
  }[] = [];
  /** Finished pieces from every CLOSED-OUT ingredient, held here until the very last step's plating — see closeOutCurrentIngredient/startPlating. */
  private platedPieceImages: Phaser.GameObjects.Image[] = [];
  /**
   * Parallel to platedPieceImages (task: "production plating system
   * redesign", extended by "shared-destination plating composition fix") —
   * which ingredient/technique/destination/instance each plated image came
   * from, recorded by closeOutCurrentIngredient at the same push site.
   *
   * `instanceSeq` — one value per closeOutCurrentIngredient call (see
   * `plateInstanceSeq`), i.e. one per independently-prepared instance
   * (chainBreak or a genuinely different ingredient both start a new one).
   * This is what lets two same-ingredient instances (e.g. two chicken
   * preparations, one sliced one diced) stay visually distinct sub-
   * compositions even when they end up sharing a plate.
   *
   * `destination` — mirrors PrepStep.destination (events.ts) at close-out
   * time; startPlating groups pieces by THIS (falling back to a shared
   * default when a level never sets it, preserving the old single-plate
   * behavior), not by ingredientId — see startPlating's own doc for why
   * ingredientId-only grouping was wrong (it could neither split one
   * ingredient across two destinations nor combine several ingredients
   * that genuinely share one).
   *
   * Nothing about PreparedOutput/organizationManager is touched — that
   * system tracks preparation STATE for destination bookkeeping, never
   * pieces, and stays completely independent of this purely-visual
   * grouping.
   */
  private platedPieceMeta: {
    ingredientId: IngredientId;
    technique: TechniqueId;
    destination: string;
    instanceSeq: number;
  }[] = [];
  /** One per closeOutCurrentIngredient call — see platedPieceMeta's own doc. Reset alongside platedPieceMeta in onStart/onRestart. */
  private plateInstanceSeq = 0;
  /**
   * Plating-presentation-only additions (see startPlating's own doc) —
   * one dark "thickness" duplicate Image and one soft contact-shadow
   * Graphics PER plated piece, purely additive display objects that
   * never exist on the cutting board (createPieceImage/pieceImages never
   * touch this array). Parallel-indexed to platedPieceImages so
   * exitHands can fade them out with their piece, and every place that
   * already destroys platedPieceImages (onStart/onRestart) destroys
   * these the same way.
   */
  private platingExtras: (Phaser.GameObjects.Image | Phaser.GameObjects.Graphics)[] = [];

  private boardImg!: Phaser.GameObjects.Image; // painted once into a CanvasTexture — see textures/boardTexture.ts
  private boardTextureKey = "board-face";
  private boardQuad: BoardQuad = { xt0: 0, xt1: 0, yt: 0, xb0: 0, xb1: 0, yb: 0 };
  private guideGfx!: Phaser.GameObjects.Graphics;
  private seamGfx!: Phaser.GameObjects.Graphics; // committed cut marks + live in-stroke seam preview
  private knifeGfx!: Phaser.GameObjects.Graphics;
  // Beginner coaching (coaching.ts / coachGhost.ts): the ghost
  // demonstration's own layer and state. `coachTeach` = the techniques the
  // session teaches; a taught step demonstrates at once, every step after
  // a pause without input. Never touches cut, peel or scoring state.
  private coachGfx!: Phaser.GameObjects.Graphics;
  private coachLabel!: Phaser.GameObjects.Text;
  private coachTeach = new Set<string>();
  private coachStepT = 0;
  private coachInputT = 0;
  private coachTouched = false;
  private coachVisible = false;
  private coachCycleT = 0;
  private coachTarget: CoachTarget | null = null;
  private plateGfx!: Phaser.GameObjects.Graphics;
  private handL!: Phaser.GameObjects.Graphics;
  private handR!: Phaser.GameObjects.Graphics;

  // The active ingredient is painted ONCE into a shared CanvasTexture, and
  // every visible piece is its OWN small CanvasTexture — the ingredient's
  // silhouette clipped by every half-plane constraint the piece has
  // accumulated, then that shared source canvas blitted through the
  // clip (see textures/pieceTexture.ts). Real, correctly-shaded slices,
  // never a rotated rectangle or a fudge-factor crop.
  private ingredientTextureKey = "ingredient-face";
  private ingredientCanvas: HTMLCanvasElement | null = null;
  private ingredientSourceOriginWorld = { x: 0, y: 0 };
  private silhouette: Silhouette = makeEllipseSilhouette(0, 0, 1, 1);
  private pieceSeq = 0;
  private pieces: Piece[] = [];
  private pieceImages = new Map<Piece, Phaser.GameObjects.Image>();

  // Plate geometry — set by startPlating(), read by drawPlateShape() and the
  // hands sequence. plateCx/Cy/Rx/Ry are the OVERALL bounding box across
  // every plate (hands reach for the whole layout, one motion, exactly as
  // before); platePlates is the new per-plate geometry (one entry per
  // distinct plated ingredient — Phase 3/4's "one ingredient = one plate,
  // variable count").
  private plateCx = 0;
  private plateCy = 0;
  private plateRx = 0;
  private plateRy = 0;
  private platePlates: { cx: number; cy: number; rx: number; ry: number }[] = [];
  private hasZoomedIn = false;
  private pendingRecipePayload: RecipeCompletedPayload | null = null;

  // Layout — recomputed in pixels on every resize.
  private ingCx = 0;
  private ingCy = 0;
  private ingRx = 0; // half-extent x
  private ingRy = 0; // half-extent y (= rBig for a taper)
  private ingRBig = 0; // taper only
  private ingRSmall = 0; // taper only
  private ingPolyScale = 0; // polygon only — world px per local-design-space unit
  // Phase 18 — cluster only: the CURRENT ingredient's leaf list, already
  // scaled to world px (scaleClusterLeaves(rawLeaves, w/540)) — computed
  // once in layout(), reused by redrawIngredientTexture() and
  // traceIngredientSilhouette() so both paint the exact same bunch.
  private clusterLeaves: ClusterLeaf[] = [];
  private blockDepthX = 0; // block only — the receding oblique edge
  private blockDepthY = 0;
  // taper only — TAPER_CURVE/SPINE_FRAC/SPINE_RX_FRAC resolved once in
  // layout(), reused by redrawIngredientTexture()/traceIngredientSilhouette()
  // so silhouette, paint, and trace all bow/sweep identically. {} (the
  // TaperCurveOpts identity default) for every straight-taper ingredient.
  private taperOpts: TaperPaintOpts = {};
  // ellipse only — LOBES/SCALLOP/OVOID resolved once in layout(), reused
  // by redrawIngredientTexture()/traceIngredientSilhouette() so
  // silhouette, paint, and trace all use the same modified profile. {}
  // (the EllipseModOpts identity default) for every plain-ellipse
  // ingredient.
  private ellipseOpts: EllipseModOpts = {};
  // fillet only (proteins) — BIAS/FULL/BOW/TILT/TOP_FULL/BOT_FULL/WOB
  // resolved once in layout(), reused by redrawIngredientTexture()/
  // traceIngredientSilhouette() so silhouette and paint use the same
  // rail tuning. {} (the FilletOpts identity default, i.e. chicken's
  // own untuned rails) for every fillet ingredient that doesn't
  // override them.
  private filletOpts: FilletOpts = {};
  private boardPolyTopY = 0;
  private boardPolyBotY = 0;

  // Guide slots — candidate intercepts per axis. Slice/Dice populate both
  // (or the one) axis up front; Julienne stays empty until cut 1 picks a
  // direction (see finishCut()'s lazy populate).
  private guides: { h: number[]; v: number[] } = { h: [], v: [] };
  private usedGuide: { h: boolean[]; v: boolean[] } = { h: [], v: [] };
  private guideSlope: { h: number; v: number } = { h: 0, v: 0 };

  private cuts: Cut[] = [];
  private cutTimestamps: number[] = []; // ms
  private perfectUsed = false;

  private isDragging = false;
  private currentPath: RecordedPoint[] = [];
  // Set true once the current drag's cumulative movement passes
  // SWIPE_ACTIVATE_PX and the swipe knife has been spawned — false the
  // whole way through for a genuine tap (§29).
  private swipeActive = false;
  private knife: KnifeState | null = null;
  // Bumped whenever a NEW knife animation (swipe spawn or a fresh tap
  // sequence) takes over `this.knife` — every async step of an in-flight
  // tap sequence captures its own seq and checks it before touching scene
  // state, so an interrupted sequence's stale callbacks silently no-op
  // instead of fighting whatever superseded them (§29 "switching between
  // both").
  private knifeSeq = 0;
  private tapBusy = false;
  private tapSeqStartT = 0;
  private tapSeqTotalMs = 0;
  // Exactly one buffered next tap, accepted only in the tail window of
  // the current tap sequence (§17 "makes rapid tapping feel responsive"
  // without ever queuing more than one).
  private queuedTap: { x: number; y: number } | null = null;
  private paused = false;
  private unsubscribePause?: () => void;

  // ---- Peel (real spatial drag-coverage, no cut geometry) — see
  // onPeelDown/Move/Up, initPeelGrid, and redrawIngredientTexture's
  // paintPeelableLayer. PEEL's own doc in definitions.ts has the full
  // design writeup.
  private peeling = false;
  private peeled = false;
  /** Every valid stroke segment this Peel session, in NORMALIZED ingredient-local units (u,v roughly in [-1,1], independent of viewport/rx/ry) — replayed as a destination-out erase over the opaque skin layer on every repaint, so the visual mask survives a resize with zero pixel-copy risk. */
  private peelStrokes: { u0: number; v0: number; u1: number; v1: number }[] = [];
  /** Coarse coverage grid (peelGridCols*peelGridRows booleans, 1 = peeled) in the same normalized units — used ONLY to award real, non-duplicated area credit; the visual reveal is the smooth peelStrokes replay above, not this grid (see markPeelSegmentCovered). */
  private peelGrid: Uint8Array = new Uint8Array(0);
  /** Parallel to peelGrid — 1 if that cell's center actually falls inside the ingredient's true silhouette. An ingredient's shape proportions don't change mid-session (only its absolute rx/ry do, on resize), so this is computed once per fresh Peel step and stays valid across any later resize. */
  private peelGridInside: Uint8Array = new Uint8Array(0);
  private peelGridCols = 0;
  private peelGridRows = 0;
  private peelTotalCells = 0;
  private peelCoveredCells = 0;
  /** The last pointer position actually validated as inside the ingredient's true silhouette. A segment is only drawn/credited between two such points, so a brief excursion off the ingredient (or the pointer re-entering from outside) never draws one long illegal "teleport" stroke (§11 "only pointer movement intersecting the actual silhouette contributes"). */
  private lastValidPeelPoint: { x: number; y: number } | null = null;

  // ---- Smash (single decisive press, no cut geometry) — see runSmash.
  private smashBusy = false;

  // ---- Rings (Onion → Peel → Halve → Rings only, no cut geometry — see
  // runRingCut/peelOneRingLayer). Each tap peels one concentric ring band
  // off every CURRENT piece (normally the 2 halves Halve left behind);
  // ringRadiusFrac tracks how far in the shrinking core has gotten (1 =
  // full outer radius, 0 = fully consumed). Ring band pieces are banked
  // into ringBandImages immediately (they're "done" the instant they're
  // cut, unlike the shrinking core still held in this.pieceImages) and
  // fed into platedPieceImages by closeOutCurrentIngredient exactly like
  // every other piece — one shared plating system, no parallel path.
  private ringBusy = false;
  private ringTapsDone = 0;
  private ringRadiusFrac = 1;
  private ringBandImages: Phaser.GameObjects.Image[] = [];
  // Pre-Phase-8: per-tap accuracy tracking — each tap's radial distance
  // from center, normalized against the band it was meant to land in
  // (0 = dead center of the target band, +-1 = right at its edge). Fed
  // into computeRingsGrade at close-out, same "real cuts get graded"
  // treatment every other technique already gets.
  private ringDeviations: number[] = [];
  private ringTapTimestamps: number[] = [];

  constructor() {
    super("Preparation");
  }

  create(): void {
    this.bus = this.registry.get("bus") as Phaser.Events.EventEmitter;
    this.guideGfx = this.add.graphics();
    this.seamGfx = this.add.graphics();
    this.knifeGfx = this.add.graphics();
    this.coachGfx = this.add.graphics();
    this.coachLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Nunito, sans-serif",
        fontSize: "13px",
        fontStyle: "900",
        color: "#ffd36b",
        stroke: "#3e2819",
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.plateGfx = this.add.graphics();

    // Chef's hands — drawn once in local space (see drawHandShape), then
    // just positioned/faded by tweens; nothing about their choreography
    // depends on player input, so unlike the knife they don't need a
    // per-frame procedural redraw.
    this.handL = this.add.graphics();
    this.handR = this.add.graphics();
    this.drawHandShape(this.handL, -1);
    this.drawHandShape(this.handR, 1);
    this.handL.setVisible(false);
    this.handR.setVisible(false);

    // Depth order is explicit, not left to add-call order (the board and
    // ingredient textures are created lazily inside redrawBoard()/
    // redrawIngredient()): board face at the bottom, guides and cut
    // marks above it, pieces and the knife above that, the plate below
    // the pieces that land on it, hands on top.
    this.guideGfx.setDepth(15);
    this.seamGfx.setDepth(16);
    this.plateGfx.setDepth(18);
    this.knifeGfx.setDepth(30);
    this.coachGfx.setDepth(29);
    this.coachLabel.setDepth(29);
    this.handL.setDepth(40);
    this.handR.setDepth(40);

    // STATE A — the kitchen view: pulled back slightly to establish the
    // room. Pushes in to STATE B (the cutting view) on the player's
    // first touch — see onPointerDown. Not replayed on retry.
    this.cameras.main.setZoom(CAMERA.KITCHEN_ZOOM);

    this.layout();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize, this);

    this.unsubscribePause = PauseManager.subscribe((paused) => {
      this.paused = paused;
      if (paused) {
        this.tweens.pauseAll();
        this.scene.pause();
      } else {
        this.scene.resume();
        this.tweens.resumeAll();
      }
    });

    this.bus.on(CMD.START, this.onStart, this);
    this.bus.on(CMD.RESTART, this.onRestart, this);
    this.bus.on(CMD.SET_KNIFE, (knife: KnifeDefinition) => {
      this.knifeStats = knife;
    });
    this.bus.on(CMD.SET_BOARD, (board: BoardDefinition) => {
      this.board = board;
      this.redrawBoard();
    });

    // Pre-existing lifecycle gap, found while testing Level Engine
    // re-entry (Kitchen -> Prepare -> back -> Prepare again): SHUTDOWN
    // fires when a scene stops normally (scene.stop()), but
    // GameBridge.destroy() -> game.destroy(true) tears the whole Game
    // down via a different path that only emits DESTROY, not SHUTDOWN.
    // Without this second listener, `unsubscribePause` never ran, so the
    // dead scene's closure stayed in PauseManager's listener Set forever;
    // the next pause/resume anywhere threw on this scene's now-null
    // `this.scene` plugin and aborted before any other listener (React's
    // own included) ran. Both listeners call the same idempotent
    // unsubscribe fn, so whichever fires first is enough.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribePause?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsubscribePause?.());

    this.bus.emit(EVT.SCENE_READY);
  }

  private onStart(config: StartPreparationConfig): void {
    // Never start a session that can't be finished: a must-peel ingredient
    // gets its Peel step (see prepStepGuards.ts). Idempotent, so it agrees
    // with Preparation.tsx's own copy of the same step list.
    this.steps = withRequiredPeelSteps(
      config.steps,
      (st) => ({
        ingredient: st.ingredientId,
        technique: st.techniqueId,
        ...(st.chainBreak ? { chainBreak: true } : {}),
      }),
      (st) => ({ ...st, techniqueId: "peel" }),
      ({ chainBreak: _drop, ...st }) => st,
    );
    this.knifeStats = config.knife;
    this.board = config.board;
    this.coachTeach = new Set(config.teach ?? []);
    this.closedSegments = [];
    for (const img of this.platedPieceImages) this.destroyPieceImage(img);
    this.platedPieceImages = [];
    this.platedPieceMeta = [];
    this.plateInstanceSeq = 0;
    for (const extra of this.platingExtras) extra.destroy();
    this.platingExtras = [];
    // Defensive (Phase 7 plating-skip): a fresh Scene mount already
    // defaults both to 1, but reset explicitly rather than trust that.
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    this.beginStep(0); // fresh (index 0 has no previous step) — lays out geometry/texture and resets pieces
    // Fresh entry only — Retry/Prep Again (onRestart alone, below) must
    // stay instant and does NOT replay the kitchen-view push-in.
    this.hasZoomedIn = false;
    this.cameras.main.setZoom(CAMERA.KITCHEN_ZOOM);
  }

  /** "Restart Prep"/"Retry" — always returns to step 0 of the CURRENT session's steps, fully fresh, whichever step the player was actually on. */
  private onRestart(): void {
    // Defensive: "Restart Prep" is reachable from the pause overlay, whose
    // bus listener fires regardless of scene-pause state, so this can in
    // principle interrupt an in-flight plating/hands sequence. Clear every
    // tween and scheduled callback so nothing from the old sequence lands
    // on the fresh attempt.
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.pendingRecipePayload = null;
    this.closedSegments = [];
    for (const img of this.platedPieceImages) this.destroyPieceImage(img);
    this.platedPieceImages = [];
    this.platedPieceMeta = [];
    this.plateInstanceSeq = 0;
    for (const extra of this.platingExtras) extra.destroy();
    this.platingExtras = [];
    // A skipped plating (see skipPlating) leaves both timeScales elevated
    // on this SAME scene instance — onRestart (unlike onStart) never gets
    // a fresh mount, so a Retry right after a skip would otherwise inherit
    // a sped-up run.
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    this.beginStep(0);
  }

  /**
   * Enters step `index` of `this.steps` — the one place that decides
   * whether this is a fresh ingredient (reset pieces/cuts, repaint
   * texture, re-layout geometry) or a CHAIN continuation of the same
   * ingredient (keep pieces/cuts, just switch technique — Onion
   * whole -> halve -> slice). Index 0 is always treated as fresh (no
   * previous step to chain from). Moving OFF a genuinely different
   * ingredient banks its finished pieces/grading segment first (§
   * "multi-ingredient preparation support") — see closeOutCurrentIngredient.
   */
  private beginStep(index: number): void {
    const prevStep = index > 0 ? (this.steps[index - 1] ?? null) : null;
    const step = this.steps[index]!;
    // Phase 16 — `step.chainBreak` forces a fresh instance even for a
    // same-ingredient step (see PrepStep's own doc, events.ts); undefined
    // everywhere in Levels 1-80, so this is a strict no-op there.
    const isChain =
      prevStep !== null && prevStep.ingredientId === step.ingredientId && !step.chainBreak;
    if (!isChain && prevStep !== null) this.closeOutCurrentIngredient();

    this.stepIndex = index;
    this.ingredient = INGREDIENTS[step.ingredientId];
    // Phase 18 — a cluster ingredient's Chop resolves to a grid (Dice's own
    // fields), not the shared parallel/continuousTap Chop every other
    // ingredient keeps using — see resolveTechniqueFor's own doc.
    this.technique = resolveTechniqueFor(TECHNIQUES[step.techniqueId], this.ingredient);
    this.ingredientId = step.ingredientId;
    // For a continuous-tap technique (Slice/Chop) this is the whole-
    // ingredient count TAP_KNIFE's own placement margins can actually
    // hold — not a fixed number (§22 "do NOT impose a fixed cut limit").
    // Halve/peel/smash all resolve to exactly 1 — see requiredCutsFor.
    this.requiredCuts = requiredCutsFor(this.technique);

    if (isChain) {
      this.stepCutsAtStart = this.cuts.length;
      this.beginChainStep();
    } else {
      this.stepCutsAtStart = 0;
      // Reset the PREVIOUS ingredient's cut/peel state before layout()
      // (below) paints the fresh texture — redrawIngredientTexture() reads
      // `this.cuts.length`/`this.peeled` to decide whether a SKIN_KEEP
      // ingredient's flesh is revealed yet / whether a peelable one is
      // shown peeled, and beginFreshIngredient() (which used to own this
      // reset) doesn't run until AFTER layout(). Reading either flag
      // before this reset would carry the OUTGOING ingredient's state
      // into the new one's first paint (e.g. a just-peeled Pineapple
      // making a freshly-loaded Watermelon render pre-peeled, or a
      // just-cut Carrot making a freshly-loaded Kiwi render pre-cut).
      this.cuts = [];
      this.cutTimestamps = [];
      this.perfectUsed = false;
      this.peeled = false;
      this.layout(); // fresh ingredient needs fresh geometry + a freshly-painted texture
      this.beginFreshIngredient();
    }
    this.bus.emit(EVT.STEP_STARTED, {
      stepIndex: this.stepIndex,
      totalSteps: this.steps.length,
      ingredientId: this.ingredientId,
      techniqueId: this.technique.id,
      requiredCuts: this.requiredCuts,
    });
    this.coachStepT = this.time.now;
    this.coachInputT = this.time.now;
    this.coachTouched = false;
    this.setCoachVisible(false);
    // A new step: the knife that waited on the last cut is laid down.
    this.layKnifeDown();
  }

  /** A same-ingredient chain step (e.g. halve -> slice): pieces/cuts persist, only the technique's own guide slots and per-step input state reset. */
  private beginChainStep(): void {
    this.computeGuides();
    this.resetInputState();
    this.redrawGuides();
  }

  /**
   * A genuinely fresh ingredient (session start, or a different
   * ingredientId mid-session): the old onRestart's piece/knife reset, now
   * scoped per-ingredient rather than per-session. `cuts`/`cutTimestamps`/
   * `perfectUsed`/`peeled` are reset by the caller (beginStep) BEFORE
   * layout(), not here — see its own comment on why the texture repaint
   * needs them already cleared.
   */
  private beginFreshIngredient(): void {
    for (const img of this.pieceImages.values()) this.destroyPieceImage(img);
    this.pieceImages.clear();
    this.pieces = [{ cons: [] }];
    const whole = this.createPieceImage(this.pieces[0]!);
    whole.setAlpha(1);
    this.pieceImages.set(this.pieces[0]!, whole);

    this.computeGuides();
    this.seamGfx.clear();
    if (this.boardImg) this.boardImg.setPosition(0, 0);
    this.plateGfx.clear().setPosition(0, 0).setAlpha(1);
    this.handL.setVisible(false).setAlpha(1);
    this.handR.setVisible(false).setAlpha(1);

    // The knife rests visibly near the board from the start (§10) —
    // never null/invisible. enterT is backdated so the idle phase's own
    // fade-in (reused from KNIFE_ENTER_MS — see drawKnife) is already
    // saturated: no mystery fade-in on level load, just a knife waiting
    // to be used.
    const idle = this.idleKnifePose();
    this.knife = {
      x: idle.x,
      y: idle.y,
      rot: idle.rot,
      targetRot: idle.rot,
      dirSign: 1,
      dirLatch: null,
      rotInit: true,
      phase: "idle",
      enterT: this.time.now - KNIFE_GEOMETRY.KNIFE_ENTER_MS - 1,
      exitT: 0,
    };
    this.resetInputState();
    this.redrawGuides();
  }

  /** Tap/swipe/peel/smash busy-state reset shared by both a fresh ingredient and a same-ingredient chain step. */
  private resetInputState(): void {
    // A press/drag that began on the previous step must not finish on this
    // one (a tomato tap released after the onion arrived used to cut the
    // unpeeled onion) — drop any in-progress gesture outright.
    this.isDragging = false;
    this.currentPath = [];
    this.swipeActive = false;
    this.tapBusy = false;
    this.tapSeqStartT = 0;
    this.tapSeqTotalMs = 0;
    this.queuedTap = null;
    this.knifeSeq++;
    this.peeling = false;
    this.lastValidPeelPoint = null;
    this.initPeelGrid();
    this.smashBusy = false;
    this.ringBusy = false;
    this.ringTapsDone = 0;
    this.ringRadiusFrac = 1;
    this.ringDeviations = [];
    this.ringTapTimestamps = [];
    // Defensive only — a genuinely fresh ingredient/chain step should
    // never have leftover ring bands (closeOutCurrentIngredient always
    // drains this array first), but never silently orphan a Phaser Image
    // + CanvasTexture pair if that assumption is ever violated.
    for (const img of this.ringBandImages) this.destroyPieceImage(img);
    this.ringBandImages = [];
  }

  /**
   * Advances to the next step, or — if this was the last one — closes
   * out the current ingredient and finishes the whole recipe. Called
   * from commitCut (a "cut"-mode step reaching its required count) and
   * from completePeel/runSmash (their own one-shot completion).
   */
  private advanceStepOrFinish(): void {
    if (this.stepIndex + 1 < this.steps.length) {
      this.beginStep(this.stepIndex + 1);
    } else {
      this.closeOutCurrentIngredient({ forPlating: true });
      this.finishRecipeNow();
    }
  }

  /**
   * Banks the CURRENT ingredient's finished pieces (into platedPieceImages,
   * plated together with every other step's once the whole recipe
   * finishes) and its own grading segment(s) (into closedSegments —
   * finishRecipeNow blends every segment). Up to TWO segments can be
   * pushed here: one for any real cuts (Cut/Dice/Julienne/.../Radial —
   * including a Halve step earlier in the SAME chain) and, independently,
   * one for Rings' own tap-accuracy data — an ingredient like Onion can
   * genuinely have both in the same chain (Peel -> Halve -> Rings). A
   * peel/smash step never pushes Cut objects and never accumulates ring
   * deviations, so it naturally contributes zero grading segments here;
   * finishRecipeNow has its own fallback for an all-peel/smash session
   * (Level 9).
   *
   * `forPlating` — set only by advanceStepOrFinish's finish branch, i.e.
   * this is the recipe's LAST close-out and finishRecipeNow/startPlating
   * runs next, not another ingredient's beginStep. In that case the
   * finished pieces must NOT fade off the board: there is nothing to clear
   * room for, and the fade used to be the sole reason the board could sit
   * empty through the whole PLATING_START_DELAY_MS beat (and indefinitely
   * if frame delivery stalled before startPlating's delayedCall fired —
   * the pieces were alpha 0, and only startPlating brings them back). They
   * stay put, fully visible, and startPlating flies them to the plate from
   * exactly there.
   */
  private closeOutCurrentIngredient(opts: { forPlating?: boolean } = {}): void {
    if (this.cuts.length > 0) {
      // Snapshot both axes' bands NOW — `bandFor` itself reads live
      // scene state (this.ingCx/ingRx/...) that will belong to the NEXT
      // ingredient by the time finishRecipeNow() actually grades this
      // segment, so a lazy closure over `this.bandFor` would silently
      // grade the wrong ingredient's geometry.
      const bandSnapshot = { h: this.bandFor("h"), v: this.bandFor("v") };
      this.closedSegments.push({
        cuts: [...this.cuts],
        timestamps: [...this.cutTimestamps],
        silhouette: this.silhouette,
        bandFor: (axis: Axis) => bandSnapshot[axis],
        // exactOptionalPropertyTypes: only include the key when there's a
        // real override — an explicit `tolOverride: undefined` isn't the
        // same type as the key being absent under this tsconfig.
        ...(this.technique.tolOverride ? { tolOverride: this.technique.tolOverride } : {}),
        ...(this.technique.radialSnap ? { radial: true } : {}),
      });
    }
    if (this.ringDeviations.length > 0) {
      // A SEPARATE `if`, not `else if`: Onion's own chain is Peel -> Halve
      // -> Rings — by close-out time `this.cuts` already holds Halve's one
      // cut AND `this.ringDeviations` holds every ring tap's accuracy, both
      // real and both earned within the SAME ingredient chain. An `else
      // if` here was a real bug (caught by a deliberately-bad-aim browser
      // test scoring "Masterful" when it should have scored low) — it
      // silently dropped the ring segment whenever a cut-producing step
      // shared the chain, so ring accuracy never affected the grade at
      // all. Rings never produces Cut objects (interactionMode "ring", not
      // "cut") — this is the parallel path for a technique whose
      // "accuracy" data lives in ringDeviations/ringTapTimestamps instead
      // of cuts/cutTimestamps. cuts/silhouette/bandFor below are required
      // by the shared segment shape but unused by computeRingsGrade —
      // finishRecipeNow branches on ringDeviations before ever touching
      // them.
      const bandSnapshot = { h: this.bandFor("h"), v: this.bandFor("v") };
      this.closedSegments.push({
        cuts: [],
        timestamps: [],
        silhouette: this.silhouette,
        bandFor: (axis: Axis) => bandSnapshot[axis],
        ringDeviations: [...this.ringDeviations],
        ringTimestamps: [...this.ringTapTimestamps],
      });
    }
    // Bug fix: this used to leave the outgoing ingredient's pieces sitting
    // exactly where they were cut — the NEXT ingredient's fresh texture
    // then painted in at the same board center, so a finished tomato and
    // a whole cucumber visibly overlapped on the board at once. The
    // pieces are already logically "done" (banked into platedPieceImages
    // for the real plating moment at the end of the whole recipe) — they
    // should visually clear off the board the same way, not just sit
    // there. Fade + a small further nudge away from center reads as
    // "set aside," restrained rather than a jarring pop/teleport; they
    // fade back in during their own flight to the plate (see
    // startPlating's alpha interpolation) rather than snapping visible.
    // Rings (Onion → Peel → Halve → Rings) banks its already-removed ring
    // bands into ringBandImages as they're cut, separately from the
    // still-shrinking core in pieceImages — both feed the SAME close-out
    // fade + plating flow here, one shared plating system.
    // One destination/instance for every piece THIS call banks — the step
    // just finishing is still `this.steps[this.stepIndex]` (beginStep only
    // advances `this.stepIndex` AFTER calling this), and one call here is
    // by definition exactly one independently-prepared instance (see
    // platedPieceMeta's own doc).
    const destination = this.steps[this.stepIndex]?.destination ?? "";
    const instanceSeq = this.plateInstanceSeq++;
    for (const img of [...this.pieceImages.values(), ...this.ringBandImages]) {
      this.platedPieceImages.push(img);
      this.platedPieceMeta.push({
        ingredientId: this.ingredientId,
        technique: this.technique.id,
        destination,
        instanceSeq,
      });
      if (opts.forPlating) {
        // Last ingredient of the recipe — keep the finished pieces exactly
        // where the cut left them, fully visible, until startPlating flies
        // them off. commitCut's `isFinalCut` path already gave a real cut's
        // pieces alpha 1 with no reveal tween; a Rings core / ring band
        // (its own separate reveal is long done) just needs the fade-away
        // skipped.
        continue;
      }
      const vx = img.x - this.ingCx;
      const vy = img.y - this.ingCy;
      const m = Math.hypot(vx, vy) || 1;
      const clearPx = PIECE_SETTLE.SLAB_OFFSET_PX_FRAC * this.scale.width * 3;
      this.tweens.add({
        targets: img,
        x: img.x + (vx / m) * clearPx,
        y: img.y + (vy / m) * clearPx,
        alpha: 0,
        duration: PIECE_SETTLE.MS,
        ease: Phaser.Math.Easing.Sine.In,
      });
    }
    this.pieceImages.clear();
    this.ringBandImages = [];
  }

  /**
   * Where the knife rests when nobody's mid-cut (§10): lying flat, centred
   * under the ingredient — on the board just below it, or, when the
   * ingredient leaves no room there, on the counter just in front of the
   * board — the whole knife in view and never across the food, the way a
   * cook sets it down. Derived from the ingredient's own bounds and the
   * EQUIPPED knife's own size every time (knifeProfile), never a fixed
   * screen coordinate (§26).
   */
  private idleKnifePose(): { x: number; y: number; rot: number } {
    const w = this.scale.width;
    const profile = knifeProfile(this.knifeStats.animation.blade, w);
    const butt = Math.min(...profile.handle.map((p) => p.x));
    const reachY = this.silhouette.reachY ?? this.ingRy;
    // y is the cutting edge; the blade body sits above it.
    const belowFood = this.ingCy + reachY + w * 0.012 + profile.bladeH;
    const onCounter = this.boardPolyBotY + w * 0.02 + profile.bladeH;
    return {
      x: this.ingCx - (butt + profile.tip) / 2,
      y: belowFood <= this.boardPolyBotY - w * 0.02 ? belowFood : onCounter,
      rot: 0,
    };
  }

  /**
   * Which geometry constants a "taper"-shaped ingredient uses — carrot,
   * garlic, zucchini, and bread share the silhouette factory but not the
   * numbers. Cucumber moved to a real "capsule" shape (capsuleGeometry()
   * below) — it is genuinely `shape:'capsule'` in the actual Claude
   * Design source, not a taper with near-equal ends, so it's no longer
   * handled here.
   */
  private taperGeometry():
    | typeof CARROT_GEOMETRY
    | typeof GARLIC_GEOMETRY
    | typeof ZUCCHINI_GEOMETRY
    | typeof BREAD_GEOMETRY {
    if (this.ingredientId === "garlic") return GARLIC_GEOMETRY;
    if (this.ingredientId === "zucchini") return ZUCCHINI_GEOMETRY;
    if (this.ingredientId === "bread") return BREAD_GEOMETRY;
    return CARROT_GEOMETRY;
  }

  /** Which geometry constants a "capsule"-shaped ingredient uses — Cucumber's own real `CONFIG.INGREDIENTS.cucumber.geom` values (rx/capR), a genuine stadium shape, not a taper approximation. Baguette/Pineapple (also real capsules in the source) live in CAPSULE_RENDERERS instead, since they were only added this phase — see that registry's own doc. */
  private capsuleGeometry(): typeof CUCUMBER_GEOMETRY {
    return CUCUMBER_GEOMETRY;
  }

  /**
   * Which geometry constants an "ellipse"-shaped ingredient uses. Fixed a
   * real bug found while adding Onion/Potato/Garlic (Phase 5): this used
   * to just hardcode TOMATO_GEOMETRY inline wherever `shape === "ellipse"`
   * was checked, which was harmless while tomato was the only ellipse
   * ingredient but would have painted every new ellipse ingredient at
   * tomato's own size/aspect ratio — exactly the "taperGeometry()-less"
   * mistake taperGeometry() itself already exists to avoid for carrot vs
   * cucumber. Garlic moved to "taper" (a real teardrop clove, not an
   * oval — see GARLIC_GEOMETRY's own doc) so it's no longer handled here.
   */
  private ellipseGeometry():
    | typeof TOMATO_GEOMETRY
    | typeof ONION_GEOMETRY
    | typeof POTATO_GEOMETRY
    | typeof ORANGE_GEOMETRY {
    switch (this.ingredientId) {
      case "onion":
        return ONION_GEOMETRY;
      case "potato":
        return POTATO_GEOMETRY;
      case "orange":
        return ORANGE_GEOMETRY;
      default:
        return TOMATO_GEOMETRY;
    }
  }

  /**
   * Which geometry constants + OrganicProfile an "organic"-shaped
   * ingredient uses — Basil/Parsley, each a real angular-radius-profile
   * silhouette instead of a plain ellipse. Mushroom/Pepper/Strawberry/
   * Apple moved to "polygon" (see polygonGeometry()) once a faithful
   * vertex-polygon port became available for them; Basil/Parsley stay
   * here since no polygon port exists for them. Same lookup convention as
   * ellipseGeometry()/taperGeometry(): branch on ingredientId, not a
   * scene-wide special case.
   */
  private organicGeometry(): typeof BASIL_GEOMETRY | typeof PARSLEY_GEOMETRY {
    switch (this.ingredientId) {
      case "parsley":
        return PARSLEY_GEOMETRY;
      default:
        return BASIL_GEOMETRY;
    }
  }

  private organicProfile(): typeof BASIL_PROFILE | typeof PARSLEY_PROFILE {
    switch (this.ingredientId) {
      case "parsley":
        return PARSLEY_PROFILE;
      default:
        return BASIL_PROFILE;
    }
  }

  /**
   * The local-space vertex polygon + SCALE_FRAC a "polygon"-shaped
   * ingredient uses — Mushroom/Pepper/Strawberry/Apple, each ported
   * faithfully from a reference art batch (see src/game/shapes/*.ts) as
   * an explicit closed outline instead of a single-center radius
   * function or a lying-flat taper. Bread reverted to "taper" (see
   * taperGeometry()) so it's no longer handled here. Same lookup
   * convention as ellipseGeometry()/taperGeometry()/organicGeometry():
   * branch on ingredientId, not a scene-wide special case.
   */
  private polygonGeometry(): { pts: LocalPoint[]; scaleFrac: number } {
    switch (this.ingredientId) {
      case "pepper":
        return { pts: PEPPER_SIL, scaleFrac: PEPPER_POLY_GEOMETRY.SCALE_FRAC };
      case "strawberry":
        return { pts: STRAWBERRY_SIL, scaleFrac: STRAWBERRY_POLY_GEOMETRY.SCALE_FRAC };
      case "apple":
        return { pts: APPLE_SIL, scaleFrac: APPLE_POLY_GEOMETRY.SCALE_FRAC };
      default:
        return { pts: MUSHROOM_SIL, scaleFrac: MUSHROOM_POLY_GEOMETRY.SCALE_FRAC };
    }
  }

  /**
   * The axis a TAP defaults to (no drag direction to read one from) —
   * the ingredient's own override if it has one (cucumber: "v", so a
   * tap cuts perpendicular to its length and produces rounds), else the
   * technique's own default. A swipe never consults this — its axis
   * comes from the actual stroke direction (see finishCut's domAxis) —
   * except for the exact-diagonal tie-break below, which shares this
   * same rule for the identical reason.
   *
   * Task: "julienne centering + carrot julienne cut correction" §5-8 —
   * a PARALLEL_SNAP technique (Julienne/Chiffonade) is the one case where
   * this default must NOT follow the generic per-ingredient axisOverride
   * chain above: its entire purpose is cuts running PARALLEL to the
   * ingredient's own longer visible dimension (thin strips spanning the
   * full length), which is the OPPOSITE of what most ingredients' own
   * axisOverride is tuned for (Slice/Chop's cross-section "rounds", e.g.
   * cucumber/carrot's "v" override). Carrot has no axisOverride at all,
   * so a tap-driven Julienne fell through to the technique's own generic
   * default ("v") — cutting ACROSS its horizontal length into chopped
   * segments instead of ALONG it into strips (root cause of the reported
   * "carrot julienne looks chopped" bug). Deriving this from the
   * ingredient's OWN rendered aspect ratio (`ingRx` vs `ingRy`) — not a
   * per-ingredient hack — makes it correct for any shape generically:
   * whichever of the ingredient's two radii is larger IS its "length",
   * regardless of which ingredient. Slice/Chop/Dice/every other
   * technique's own tap-default is completely unaffected — this branch
   * only ever runs for `parallelSnap` techniques.
   */
  /**
   * The axis of this step's first set of cut lines (cutPlan.primaryCutAxis):
   * across the food (vertical lines, like Level 1's tomato) unless the cut
   * can't be made that way. Julienne's lengthwise strips and a tall food get
   * horizontal lines.
   */
  private tapDefaultAxis(): Axis {
    return primaryCutAxis(this.technique, this.ingredient, this.ingRx, this.ingRy);
  }

  /** Recomputes every pixel position from current canvas size — called on resize. */
  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // A transient parent-container collapse — a route/screen transition,
    // a new level or order remounting <Preparation>, an orientation flip —
    // makes Phaser's RESIZE-mode Scale Manager mirror a near-zero parent
    // box (it polls the parent's bounds and re-emits RESIZE on any
    // change). GameBridge's `scale.min` floors that at 1px so Phaser's own
    // renderer/CanvasTexture never see 0; this guard is the game-side
    // half. Every dimension below is `FRAC * w`, so a 1px w still rounds
    // ingRx/ingRy to 0 and would hand redrawIngredientTexture() a 1x1
    // canvas — a pointless teardown/rebuild of the shared texture for a
    // size nothing can see. Keep the last valid layout untouched instead;
    // the next real RESIZE (always emitted when the container comes back)
    // rebuilds everything. redrawBoard() already guards the same way.
    if (w <= 1 || h <= 1) return;

    this.boardQuad = computeBoardQuad(w, h);
    this.boardPolyTopY = this.boardQuad.yt;
    this.boardPolyBotY = this.boardQuad.yb;

    // The ingredient sits at the board's vertical center (knifecraft.html's
    // active.cy lands almost exactly halfway between FACE_TOP_Y/FACE_BOT_Y).
    this.ingCy = lerp(this.boardPolyTopY, this.boardPolyBotY, 0.5);
    this.ingCx =
      (this.boardQuad.xt0 + this.boardQuad.xt1 + this.boardQuad.xb0 + this.boardQuad.xb1) / 4;

    if (this.ingredient.shape === "ellipse") {
      // Phase 18: a new-roster ingredient's geometry lives in
      // ELLIPSE_RENDERERS, consulted first; a lookup miss falls through to
      // the original 4-ingredient ellipseGeometry() switch, unchanged.
      const newR = ELLIPSE_RENDERERS[this.ingredientId];
      const eg = newR ? newR.geom : this.ellipseGeometry();
      this.ingRx = eg.RX_FRAC * w;
      this.ingRy = eg.RY_FRAC * w;
      // eg is a big union (every *_GEOMETRY const `ellipseGeometry()` can
      // return, plus every ELLIPSE_RENDERERS entry's own geom) — most
      // members have none of these fields at all, so read them through an
      // explicit optional-extras view rather than "in" narrowing over the
      // whole union (which TS resolves inconsistently here under
      // exactOptionalPropertyTypes).
      const extras = eg as { LOBES?: number; SCALLOP?: number; OVOID?: number };
      this.ellipseOpts = {
        ...(extras.LOBES != null ? { lobes: extras.LOBES } : {}),
        ...(extras.SCALLOP != null ? { scallop: extras.SCALLOP } : {}),
        ...(extras.OVOID != null ? { ovoid: extras.OVOID } : {}),
      };
      this.silhouette = makeEllipseSilhouette(
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRy,
        this.ellipseOpts,
      );
    } else if (this.ingredient.shape === "organic") {
      const og = this.organicGeometry();
      this.ingRx = og.RX_FRAC * w;
      this.ingRy = og.RY_FRAC * w;
      this.silhouette = makeOrganicSilhouette(
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRy,
        this.organicProfile(),
      );
    } else if (this.ingredient.shape === "polygon") {
      // Mushroom/Pepper/Bread/Strawberry/Apple — an explicit vertex
      // polygon ported from a reference art batch (see
      // polygonGeometry()'s own doc). ingRx/ingRy come straight from the
      // silhouette's own true bounding box, not a separate FRAC pair —
      // there's only one shape-defining input (the point list) plus a
      // uniform scale, unlike ellipse/organic's independent rx/ry.
      const pg = this.polygonGeometry();
      this.ingPolyScale = pg.scaleFrac * w;
      this.silhouette = makePolygonSilhouette(this.ingCx, this.ingCy, this.ingPolyScale, pg.pts);
      this.ingRx = this.silhouette.rx;
      this.ingRy = this.silhouette.ry;
    } else if (this.ingredient.shape === "cluster") {
      // Phase 18 — Basil/Parsley + the 8 new cluster ingredients. The leaf
      // list itself IS the geometry (see makeClusterSilhouette's own doc);
      // rx/ry come from the silhouette's own fitted bounds, the same
      // "derived, never hand-written" convention `polygon` already uses.
      const cr = CLUSTER_RENDERERS[this.ingredientId]!;
      this.clusterLeaves = cr.leavesAt(w / 540);
      this.silhouette = makeClusterSilhouette(this.ingCx, this.ingCy, this.clusterLeaves);
      this.ingRx = this.silhouette.rx;
      this.ingRy = this.silhouette.ry;
    } else if (this.ingredient.shape === "block") {
      // Cheddar/Butter/Tofu — a real oblique/isometric box (six corners,
      // front+top+side planes), ported directly from knifecraft.html's
      // actual `SILS.block` — see makeBlockSilhouette's own doc.
      const br = BLOCK_RENDERERS[this.ingredientId]!;
      this.ingRx = br.geom.RX_FRAC * w;
      this.ingRy = br.geom.RY_FRAC * w;
      this.blockDepthX = br.geom.DEPTH_X_FRAC * w;
      this.blockDepthY = br.geom.DEPTH_Y_FRAC * w;
      this.silhouette = makeBlockSilhouette(
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRy,
        this.blockDepthX,
        this.blockDepthY,
      );
    } else if (this.ingredient.shape === "capsule") {
      // Cucumber/Baguette/Pineapple — a real stadium (see
      // makeCapsuleSilhouette's own doc), not a taper approximation.
      // Cucumber keeps its own dedicated capsuleGeometry() accessor
      // (matching the pre-existing per-ingredient-method convention);
      // Baguette/Pineapple live in CAPSULE_RENDERERS.
      const cr = CAPSULE_RENDERERS[this.ingredientId];
      const g = cr ? cr.geom : this.capsuleGeometry();
      this.ingRx = g.RX_FRAC * w;
      this.ingRBig = g.CAP_R_FRAC * w; // reuses the same "short axis" storage slot taper already has
      this.ingRSmall = this.ingRBig;
      this.ingRy = this.ingRBig;
      this.silhouette = makeCapsuleSilhouette(this.ingCx, this.ingCy, this.ingRx, this.ingRBig);
    } else if (this.ingredient.shape === "fillet") {
      // Chicken/Steak/Salmon only — see makeFilletSilhouette's own doc.
      const fr = FILLET_RENDERERS[this.ingredientId]!;
      this.ingRx = fr.geom.RX_FRAC * w;
      this.ingRy = fr.geom.RY_FRAC * w;
      this.filletOpts = {
        ...(fr.geom.BIAS != null ? { bias: fr.geom.BIAS } : {}),
        ...(fr.geom.FULL != null ? { full: fr.geom.FULL } : {}),
        ...(fr.geom.BOW != null ? { bow: fr.geom.BOW } : {}),
        ...(fr.geom.TILT != null ? { tilt: fr.geom.TILT } : {}),
        ...(fr.geom.TOP_FULL != null ? { topFull: fr.geom.TOP_FULL } : {}),
        ...(fr.geom.BOT_FULL != null ? { botFull: fr.geom.BOT_FULL } : {}),
        ...(fr.geom.WOB != null ? { wob: fr.geom.WOB } : {}),
      };
      this.silhouette = makeFilletSilhouette(
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRy,
        this.filletOpts,
      );
    } else {
      // "taper" — carrot and cucumber both lie flat, crown-to-tip along
      // world X, and share the exact same silhouette factory; only the
      // geometry constants differ (this.taperGeometry() below). Phase 18:
      // a new-roster taper ingredient's geometry lives in TAPER_RENDERERS,
      // consulted first, same fallback convention as the ellipse branch.
      const newR = TAPER_RENDERERS[this.ingredientId];
      const g = newR ? newR.geom : this.taperGeometry();
      this.ingRx = g.RX_FRAC * w;
      this.ingRBig = g.R_BIG_FRAC * w;
      this.ingRSmall = g.R_SMALL_FRAC * w;
      this.taperOpts = {
        ...("TAPER_CURVE" in g && g.TAPER_CURVE != null ? { taperCurve: g.TAPER_CURVE } : {}),
        ...("SPINE_FRAC" in g && g.SPINE_FRAC != null ? { spine: g.SPINE_FRAC * w } : {}),
        ...("SPINE_RX_FRAC" in g && g.SPINE_RX_FRAC != null
          ? { spineRx: g.SPINE_RX_FRAC * w }
          : {}),
      };
      // The bowed-centreline (`spine`) tapers reach `spine` px past `rBig`
      // vertically — keep ingRy (texture margin, fallback bbox) in step
      // with the silhouette's own spine-aware `ry`. Straight tapers: no-op.
      this.ingRy = this.ingRBig + Math.abs(this.taperOpts.spine ?? 0);
      this.silhouette = makeTaperSilhouette(
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRBig,
        this.ingRSmall,
        g.BUTT_ROUND,
        g.TIP_ROUND,
        this.taperOpts,
      );
    }

    this.redrawIngredientTexture();
    this.redrawBoard();
    this.redrawGuides();
  }

  /**
   * The Scale Manager's own RESIZE event — a real window resize/
   * orientation change while an ingredient is already on the board, not
   * just the initial per-ingredient call `beginStep()` makes directly to
   * `layout()`. `layout()` alone only re-derives geometry and repaints
   * the shared texture/board; it was never responsible for moving pieces
   * that already exist on screen, so a resize used to leave every
   * current piece frozen at its pre-resize size/position while the board
   * snapped to the new one — the ingredient visibly split off the board,
   * floating at the wrong scale over whatever the board no longer
   * covers. Rebuilding each existing piece's image against the freshly
   * relaid-out geometry (same `cons`, same reveal state — no re-tween)
   * keeps it locked to the board through any resize. Deliberately a
   * separate method from `layout()` itself: `beginStep()`'s own direct
   * `layout()` call happens BEFORE `beginFreshIngredient()` replaces
   * `this.pieces` for the new ingredient, so rebuilding images there
   * would burn a redraw on pieces about to be thrown away anyway.
   */
  private onScaleResize(): void {
    // Ignore a degenerate (collapsed-container) RESIZE outright — layout()
    // would no-op on it anyway, and rebuilding every piece image against
    // stale geometry for a size we're about to get a real event for is
    // wasted work. The follow-up real RESIZE does the real rebuild.
    if (this.scale.width <= 1 || this.scale.height <= 1) return;
    this.layout();
    for (const piece of this.pieces) {
      const old = this.pieceImages.get(piece);
      // No live board image means this piece has already been closed out
      // and banked into platedPieceImages (the plating window: pieces sit
      // in `this.pieces` but `pieceImages` is empty). Rebuilding one here
      // would spawn a stray duplicate at board centre that nothing ever
      // clears — the plated copy is the one flying to the plate.
      if (!old) continue;
      const wasVisible = old.alpha > 0;
      this.destroyPieceImage(old);
      const img = this.createPieceImage(piece);
      img.setAlpha(wasVisible ? 1 : 0);
      this.pieceImages.set(piece, img);
    }
  }

  /**
   * A small, reused (never recreated per stroke — only resized when its
   * own dimensions actually change, same rule redrawIngredientTexture's
   * main canvas now follows) offscreen canvas used ONLY as scratch space
   * for paintPeelableLayer's flesh layer — see that method's own doc for
   * why a second canvas is unavoidable here.
   */
  private peelScratchCanvas: HTMLCanvasElement | null = null;

  private ensurePeelScratchCanvas(w: number, h: number): CanvasRenderingContext2D | null {
    if (!this.peelScratchCanvas) this.peelScratchCanvas = document.createElement("canvas");
    if (this.peelScratchCanvas.width !== w) this.peelScratchCanvas.width = w;
    if (this.peelScratchCanvas.height !== h) this.peelScratchCanvas.height = h;
    return this.peelScratchCanvas.getContext("2d");
  }

  /**
   * Applied at every peelable ingredient's own paint call site inside
   * redrawIngredientTexture's dispatch below. While a Peel step is
   * actually in progress (this.technique.id === "peel" && !this.peeled):
   * paints skin (opaque, full silhouette) onto the REAL canvas, erases
   * every recorded peelStrokes segment from it (destination-out, clipped
   * to `clipSil` so a round stroke cap never pokes past a non-elliptical
   * silhouette like garlic's tapered tip), then paints flesh into a
   * reused SCRATCH canvas and composites it underneath via
   * "destination-over" — which only actually affects the erased
   * (transparent) pixels, revealing flesh there while leaving the intact
   * skin untouched elsewhere. Two separate canvases are required because
   * every existing peelable paint function clears its ENTIRE canvas at
   * its own top (see onionTexture.ts/potatoTexture.ts/garlicTexture.ts/
   * watermelonTexture.ts/coconutTexture.ts/pineappleTexture.ts's own
   * docs) — painting flesh then skin onto the SAME canvas would have the
   * second call's own clearRect wipe the first out. `toCanvas` converts
   * a stroke's normalized (u,v) back to this call's own canvas-local
   * pixel space — the only bit that differs per shape (ellipse:
   * cx=rx+margin,cy=ry+margin; capsule/taper: cx=rx+margin,cy=rBig+margin).
   *
   * Every other state (already peeled, or this ingredient/step isn't
   * Peel at all — which covers every non-peelable ingredient
   * automatically, since their technique.id can never BE "peel") falls
   * through to the ordinary single `paintOne(ctx, this.peeled)` call,
   * completely unchanged from before this phase.
   */
  private paintPeelableLayer(
    ctx: CanvasRenderingContext2D,
    toCanvas: (u: number, v: number) => { x: number; y: number },
    clipSil: () => void,
    paintOne: (ctx: CanvasRenderingContext2D, peeled: boolean) => void,
  ): void {
    if (this.technique.id !== "peel" || this.peeled) {
      paintOne(ctx, this.peeled);
      return;
    }
    paintOne(ctx, false); // skin, full silhouette, opaque — straight onto the real canvas
    if (this.peelStrokes.length === 0) return;
    const cfg = this.peelConfig();
    const { hw, hh } = this.peelHalfExtents();
    // Stroke width in canvas px — strokeWidthFrac is a HALF-width
    // relative to the ingredient's own average half-extent, matching
    // markPeelSegmentCovered's own normalized-grid convention, so the
    // visual stroke scales with the ingredient/viewport exactly like the
    // coverage grid does (§6). *2 turns the half-width into a full
    // ctx.lineWidth.
    const baseWidthPx = cfg.strokeWidthFrac * ((hw + hh) / 2) * 2;
    ctx.save();
    clipSil();
    ctx.clip();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.peelStrokes.forEach((s, i) => {
      // A small, deterministic width wobble along the stroke history
      // (NOT Math.random() — §9) — the same index-hashed cosine trick
      // kiwiTexture.ts's own blotch pass already uses elsewhere in this
      // codebase — so the removed band reads as organic, not a perfectly
      // uniform ruler-width strip.
      ctx.lineWidth = baseWidthPx * (1 + 0.12 * Math.sin(i * 2.399963));
      const a = toCanvas(s.u0, s.v0);
      const b = toCanvas(s.u1, s.v1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.restore();

    const scratch = this.ensurePeelScratchCanvas(ctx.canvas.width, ctx.canvas.height);
    if (!scratch) return;
    paintOne(scratch, true); // flesh, full silhouette, opaque — into the scratch canvas (its own clearRect is safe here, a separate canvas)
    ctx.save();
    clipSil();
    ctx.clip();
    ctx.globalCompositeOperation = "destination-over"; // only fills the erased (transparent) pixels — every intact skin pixel is untouched
    ctx.drawImage(scratch.canvas, 0, 0);
    ctx.restore();
  }

  /**
   * Extra canvas headroom (added to the normal `margin` below) for the 13
   * ingredients whose OWN overhang art was ported using literal, unscaled
   * pixel offsets copied straight from knifecraft.html (the established
   * convention every overhang texture in this pass follows — see e.g.
   * peachTexture.ts's/pumpkinTexture.ts's own doc comments). The normal
   * margin (`Math.max(rx,ry) * 0.16`) exists only for ordinary anti-
   * aliasing bleed and is far too small to contain a whole extra stem/
   * crown/leaf-spray reaching past the silhouette — without this, that
   * art gets silently clipped by the canvas edge (confirmed via the
   * Pumpkin's ported stem read as a flat clipped stub
   * until this was added). Each value is that ingredient's own
   * `geom.overhang`/`spriteM` extent from the prototype, in the SAME
   * literal-pixel space its ported art already uses — not scaled by rx/ry,
   * for the same reason the art itself isn't. Chilli is included (its
   * calyx/stalk needs room too, keepOverhang or not); Pineapple is not
   * (its crown is gone by the time any cut can happen — see
   * requiresPeelFirst() — so no cosmetic overhang art was added there).
   */
  private static readonly OVERHANG_MARGIN_EXTRA: Partial<Record<IngredientId, number>> = {
    peach: 76,
    corn: 68,
    celery: 134,
    springonion: 46,
    radish: 158,
    beetroot: 168,
    mango: 94,
    pomegranate: 76,
    fennel: 210,
    artichoke: 70,
    peapod: 96,
    pumpkin: 190,
    turnip: 124,
    chilli: 128,
  };

  /** Paints the active ingredient into the ONE shared source CanvasTexture every piece blits through — see textures/tomatoTexture.ts and carrotTexture.ts. */
  private redrawIngredientTexture(): void {
    const margin =
      Math.max(this.ingRx, this.ingRy) * 0.16 +
      (PreparationScene.OVERHANG_MARGIN_EXTRA[this.ingredientId] ?? 0);
    let w: number;
    let h: number;
    // "organic" ingredients (Basil/Parsley) still use the exact same
    // (ctx, rx, ry, margin) paint-function signature every ellipse
    // ingredient uses — only the real clip/collision silhouette differs
    // (traceOrganicPath vs traceEllipsePath, below). Texture painting
    // stays keyed on ingredientId regardless of shape.
    if (this.ingredient.shape === "ellipse") {
      // Phase 18: a new-roster ellipse ingredient's texture size/paint
      // live in ELLIPSE_RENDERERS, consulted first; a lookup miss falls
      // through to the original 4-ingredient dispatch, unchanged.
      const newR = ELLIPSE_RENDERERS[this.ingredientId];
      const size = newR
        ? newR.textureSize(this.ingRx, this.ingRy, margin)
        : this.ingredientId === "onion"
          ? onionTextureSize(this.ingRx, this.ingRy, margin)
          : this.ingredientId === "potato"
            ? potatoTextureSize(this.ingRx, this.ingRy, margin)
            : this.ingredientId === "orange"
              ? orangeTextureSize(this.ingRx, this.ingRy, margin)
              : tomatoTextureSize(this.ingRx, this.ingRy, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredient.shape === "organic") {
      w = (this.ingRx + margin) * 2;
      h = (this.ingRy + margin) * 2;
    } else if (this.ingredient.shape === "polygon") {
      // Mushroom/Pepper/Strawberry/Apple — each *TextureSize takes
      // (scale, margin) instead of (rx, ry, margin): the polygon's own
      // point list already encodes both dimensions, so there's only one
      // scale factor (this.ingPolyScale, resolved in layout()), not an
      // independent rx/ry pair. Bread reverted to "taper" so it's no
      // longer handled here.
      const size =
        this.ingredientId === "pepper"
          ? pepperTextureSize(this.ingPolyScale, margin)
          : this.ingredientId === "strawberry"
            ? strawberryTextureSize(this.ingPolyScale, margin)
            : this.ingredientId === "apple"
              ? appleTextureSize(this.ingPolyScale, margin)
              : mushroomTextureSize(this.ingPolyScale, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredient.shape === "cluster") {
      const size = CLUSTER_RENDERERS[this.ingredientId]!.textureSize(
        this.ingRx,
        this.ingRy,
        margin,
      );
      w = size.w;
      h = size.h;
    } else if (this.ingredient.shape === "block") {
      const size = BLOCK_RENDERERS[this.ingredientId]!.textureSize(this.ingRx, this.ingRy, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredient.shape === "capsule") {
      // Cucumber/Baguette/Pineapple — a real stadium (see
      // makeCapsuleSilhouette's own doc). CAPSULE_RENDERERS consulted
      // first (Baguette/Pineapple), falling back to Cucumber's own
      // dedicated textureSize (matching capsuleGeometry()'s own
      // per-ingredient-method convention).
      const cr = CAPSULE_RENDERERS[this.ingredientId];
      const size = cr
        ? cr.textureSize(this.ingRx, this.ingRBig, margin)
        : cucumberTextureSize(this.ingRx, this.ingRBig, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredient.shape === "fillet") {
      const size = FILLET_RENDERERS[this.ingredientId]!.textureSize(this.ingRx, this.ingRy, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredientId === "garlic") {
      const size = garlicTextureSize(this.ingRx, this.ingRBig, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredientId === "zucchini") {
      const size = zucchiniTextureSize(this.ingRx, this.ingRBig, margin);
      w = size.w;
      h = size.h;
    } else if (this.ingredientId === "bread") {
      const size = breadTextureSize(this.ingRx, this.ingRBig, margin);
      w = size.w;
      h = size.h;
    } else {
      // "taper" — Phase 18: a new-roster taper ingredient's texture
      // size/paint live in TAPER_RENDERERS, consulted first.
      const newTaperR = TAPER_RENDERERS[this.ingredientId];
      const size = newTaperR
        ? newTaperR.textureSize(this.ingRx, this.ingRBig, margin)
        : carrotTextureSize(this.ingRx, this.ingRBig, margin);
      w = size.w;
      h = size.h;
    }
    // Defensive twin of layout()'s guard: never tear down the good shared
    // texture to rebuild it at a non-positive size (Phaser's
    // createCanvas -> CanvasTexture -> getImageData throws IndexSizeError
    // on a 0 dimension). w/h are `ingRx|ingRy (+margin) * 2`, so with
    // layout() guarded they are always positive here — this only bites if
    // some other caller ever reaches this method mid-collapse.
    if (!(w > 0) || !(h > 0)) return;
    // Peel repaints this texture on every valid swipe segment (see
    // onPeelMove) — reuse the EXISTING canvas in place (just clear +
    // repaint its context) whenever the size hasn't actually changed,
    // rather than destroying and recreating a Phaser CanvasTexture (and
    // its GPU upload) on every stroke. Only a genuine size change (a
    // resize, or a fresh ingredient) still pays the destroy+recreate
    // cost — same behavior as before for every other caller of this
    // method (§23 "avoid creating persistent temporary canvases every
    // swipe... reuse the existing lifecycle").
    const existing = this.textures.exists(this.ingredientTextureKey)
      ? (this.textures.get(this.ingredientTextureKey) as Phaser.Textures.CanvasTexture)
      : null;
    let texOrNull: Phaser.Textures.CanvasTexture | null;
    if (existing && existing.width === Math.ceil(w) && existing.height === Math.ceil(h)) {
      texOrNull = existing;
    } else {
      if (existing) this.textures.remove(this.ingredientTextureKey);
      texOrNull = this.textures.createCanvas(this.ingredientTextureKey, Math.ceil(w), Math.ceil(h));
    }
    if (!texOrNull) return;
    const tex = texOrNull; // a `const` from here on, so every closure below keeps TS's null-narrowing
    if (this.ingredient.shape === "ellipse") {
      const newR = ELLIPSE_RENDERERS[this.ingredientId];
      const ecx = this.ingRx + margin;
      const ecy = this.ingRy + margin;
      const ellipseToCanvas = (u: number, v: number) => ({
        x: ecx + u * this.ingRx,
        y: ecy + v * this.ingRy,
      });
      // traceEllipsePath, not a raw ctx.ellipse() — Mango's own OVOID
      // modifier (see MANGO_GEOMETRY) makes its true silhouette a
      // genuine ovoid, not a symmetric ellipse; a plain ellipse clip
      // would let a peel stroke bleed past (or fall short of) the real
      // outline at the narrow end. Also correct, for free, for any
      // future LOBES/SCALLOP ellipse ingredient that gains Peel.
      const ellipseClipSil = () => {
        tex.context.beginPath();
        traceEllipsePath(tex.context, ecx, ecy, this.ingRx, this.ingRy, 0, this.ellipseOpts);
      };
      if (newR) {
        // `p` (paintPeelableLayer's own "show flesh right now" boolean —
        // driven by the real Peel technique, not this.cuts.length) is
        // passed as `peeled`: Watermelon/Coconut read only that slot,
        // every other ellipse ingredient ignores it. `hasCut` is a
        // SEPARATE slot with a separate source, because `p` is only
        // meaningful for an ingredient that actually HAS a "peel"
        // technique — for one that doesn't (Peach, Lemon, Cabbage),
        // `this.technique.id !== "peel"` is permanently true inside
        // paintPeelableLayer, so it always calls back with
        // `this.peeled`, which is permanently false for such an
        // ingredient — passing that as `hasCut` would mean its flesh
        // could NEVER reveal, even after a real cut. So: ingredients
        // with their own "peel" technique (Kiwi/Mango/Pomegranate/
        // Fennel, peel-decoupled) read `p` for `hasCut` too — turning
        // their skin/flesh reveal from "any cut, anywhere" into
        // "genuinely peeled" (see peelDecoupled's own doc) — while a
        // non-peel ellipse ingredient with its own hasCut gate (Peach)
        // falls back to the real `this.cuts.length > 0` cut-reveal
        // every other cut-only SKIN_KEEP ingredient uses.
        this.paintPeelableLayer(tex.context, ellipseToCanvas, ellipseClipSil, (c, p) =>
          newR.paint(
            c,
            this.ingRx,
            this.ingRy,
            margin,
            this.ellipseOpts,
            p,
            this.ingredient.techniques.includes("peel") ? p : this.cuts.length > 0,
            this.cuts.length > 0,
          ),
        );
      } else if (this.ingredientId === "onion") {
        this.paintPeelableLayer(tex.context, ellipseToCanvas, ellipseClipSil, (c, p) =>
          paintOnionTexture(c, this.ingRx, this.ingRy, margin, p),
        );
      } else if (this.ingredientId === "potato") {
        this.paintPeelableLayer(tex.context, ellipseToCanvas, ellipseClipSil, (c, p) =>
          paintPotatoTexture(c, this.ingRx, this.ingRy, margin, p),
        );
      } else if (this.ingredientId === "orange") {
        paintOrangeTexture(tex.context, this.ingRx, this.ingRy, margin);
      } else {
        paintTomatoTexture(tex.context, this.ingRx, this.ingRy, margin);
      }
    } else if (this.ingredient.shape === "organic") {
      // Unreachable in the current roster (Basil/Parsley moved to
      // "cluster" this phase — see IngredientShape's own doc on why this
      // shape stays live infrastructure rather than being deleted). Kept
      // type-safe with a plain fallback rather than removed.
      paintTomatoTexture(tex.context, this.ingRx, this.ingRy, margin);
    } else if (this.ingredient.shape === "cluster") {
      const cr = CLUSTER_RENDERERS[this.ingredientId]!;
      if (this.ingredientId === "ginger") {
        // The one peelable cluster ingredient (see ClusterRenderer's own
        // doc) — same paintPeelableLayer wrapping every other peelable
        // shape family already gets (onion/potato/garlic above, taper's
        // own fallthrough branch below), just keyed off the cluster's
        // own bounding rx/ry and traceClusterPath for the clip silhouette
        // instead of an ellipse/taper outline.
        const gcx = this.ingRx + margin;
        const gcy = this.ingRy + margin;
        this.paintPeelableLayer(
          tex.context,
          (u, v) => ({ x: gcx + u * this.ingRx, y: gcy + v * this.ingRy }),
          () => {
            tex.context.beginPath();
            traceClusterPath(tex.context, gcx, gcy, this.clusterLeaves, 0);
          },
          (c, p) => cr.paint(c, this.ingRx, this.ingRy, margin, this.clusterLeaves, p),
        );
      } else {
        cr.paint(
          tex.context,
          this.ingRx,
          this.ingRy,
          margin,
          this.clusterLeaves,
          undefined,
          this.cuts.length > 0,
        );
      }
    } else if (this.ingredient.shape === "block") {
      const br = BLOCK_RENDERERS[this.ingredientId]!;
      br.paint(tex.context, this.ingRx, this.ingRy, this.blockDepthX, this.blockDepthY, margin);
    } else if (this.ingredient.shape === "capsule") {
      const cr = CAPSULE_RENDERERS[this.ingredientId];
      if (cr) {
        const ccx = this.ingRx + margin;
        const ccy = this.ingRBig + margin;
        this.paintPeelableLayer(
          tex.context,
          (u, v) => ({ x: ccx + u * this.ingRx, y: ccy + v * this.ingRBig }),
          () => {
            tex.context.beginPath();
            traceCapsulePath(tex.context, ccx, ccy, this.ingRx, this.ingRBig, 0);
          },
          (c, p) => cr.paint(c, this.ingRx, this.ingRBig, margin, p, this.cuts.length > 0),
        );
      } else {
        const cucx = this.ingRx + margin;
        const cucy = this.ingRBig + margin;
        this.paintPeelableLayer(
          tex.context,
          (u, v) => ({ x: cucx + u * this.ingRx, y: cucy + v * this.ingRBig }),
          () => {
            tex.context.beginPath();
            traceCapsulePath(tex.context, cucx, cucy, this.ingRx, this.ingRBig, 0);
          },
          (c, p) => paintCucumberTexture(c, this.ingRx, this.ingRBig, margin, p),
        );
      }
    } else if (this.ingredient.shape === "polygon") {
      if (this.ingredientId === "pepper") {
        paintPepperTexture(tex.context, this.ingPolyScale, margin);
      } else if (this.ingredientId === "strawberry") {
        paintStrawberryTexture(tex.context, this.ingPolyScale, margin);
      } else if (this.ingredientId === "apple") {
        // Discrepancy #1's close-out: Apple gains real Peel support — the
        // first "polygon"-shape peelable ingredient, so there's no
        // existing polygon branch to copy; wired the same way every other
        // shape's own special-cased peelable ingredient (Onion/Potato/
        // Orange above) is — paintPeelableLayer, with a toCanvas/clipSil
        // pair built from this shape's own w/h and polygon point list.
        // The peel GESTURE machinery itself (peelHalfExtents/
        // initPeelGrid/onPeelMove) needs no polygon-specific change at
        // all — it already reads `this.ingRx`/`this.ingRy` and
        // `this.silhouette.inside()` generically for every shape (see
        // peelHalfExtents's own doc).
        const pcx = w / 2;
        const pcy = h / 2;
        const prx = pcx - margin;
        const pry = pcy - margin;
        this.paintPeelableLayer(
          tex.context,
          (u, v) => ({ x: pcx + u * prx, y: pcy + v * pry }),
          () => {
            tex.context.beginPath();
            tracePolygonPath(
              tex.context,
              pcx,
              pcy,
              this.ingPolyScale,
              this.polygonGeometry().pts,
              0,
            );
          },
          (c, p) => paintAppleTexture(c, this.ingPolyScale, margin, p),
        );
      } else {
        paintMushroomTexture(tex.context, this.ingPolyScale, margin);
      }
    } else if (this.ingredient.shape === "fillet") {
      // Chicken/Steak/Salmon only — no peel, no hasCut split (see
      // FilletRenderer's own doc): the whole ingredient always paints
      // the same one interior. A real cut's pale face band is a
      // separate, per-piece system — see paintProteinCutFace's own doc.
      const fr = FILLET_RENDERERS[this.ingredientId]!;
      fr.paint(tex.context, this.ingRx, this.ingRy, margin, this.filletOpts);
    } else if (this.ingredientId === "garlic") {
      const g = this.taperGeometry();
      const gcx = this.ingRx + margin;
      const gcy = this.ingRBig + margin;
      this.paintPeelableLayer(
        tex.context,
        (u, v) => ({ x: gcx + u * this.ingRx, y: gcy + v * this.ingRBig }),
        () => {
          tex.context.beginPath();
          traceGarlicPath(
            tex.context,
            gcx,
            gcy,
            this.ingRx,
            this.ingRBig,
            this.ingRSmall,
            g.BUTT_ROUND,
            g.TIP_ROUND,
            0,
          );
        },
        (c, p) =>
          paintGarlicTexture(
            c,
            this.ingRx,
            this.ingRBig,
            this.ingRSmall,
            g.BUTT_ROUND,
            g.TIP_ROUND,
            margin,
            p,
          ),
      );
    } else if (this.ingredientId === "zucchini") {
      const g = this.taperGeometry();
      paintZucchiniTexture(
        tex.context,
        this.ingRx,
        this.ingRBig,
        this.ingRSmall,
        g.BUTT_ROUND,
        g.TIP_ROUND,
        margin,
      );
    } else if (this.ingredientId === "bread") {
      const g = this.taperGeometry();
      paintBreadTexture(
        tex.context,
        this.ingRx,
        this.ingRBig,
        this.ingRSmall,
        g.BUTT_ROUND,
        g.TIP_ROUND,
        margin,
      );
    } else {
      // "taper" fallthrough — Phase 18: a new-roster taper ingredient's
      // paint lives in TAPER_RENDERERS, consulted first.
      const newTaperR = TAPER_RENDERERS[this.ingredientId];
      if (newTaperR) {
        const g = newTaperR.geom;
        const ttcx = this.ingRx + margin;
        const ttcy = this.ingRBig + margin;
        this.paintPeelableLayer(
          tex.context,
          // v's own scale must match peelHalfExtents()'s hh (this.ingRy)
          // exactly — NOT this.ingRBig — because a bowed-spine taper's
          // (Pea Pod, Sweet Potato) ingRy is rBig + |spine|, the true
          // vertical half-extent a stroke was normalized against in
          // onPeelMove. Using ingRBig here would misalign Pea Pod's own
          // curved-spine strokes toward its actual pod top.
          (u, v) => ({ x: ttcx + u * this.ingRx, y: ttcy + v * this.ingRy }),
          () => {
            tex.context.beginPath();
            traceTaperPath(
              tex.context,
              ttcx,
              ttcy,
              this.ingRx,
              this.ingRBig,
              this.ingRSmall,
              g.BUTT_ROUND,
              g.TIP_ROUND,
              0,
              this.taperOpts,
            );
          },
          (c, p) =>
            newTaperR.paint(
              c,
              this.ingRx,
              this.ingRBig,
              this.ingRSmall,
              g.BUTT_ROUND,
              g.TIP_ROUND,
              margin,
              this.taperOpts,
              p,
              this.cuts.length > 0,
            ),
        );
      } else {
        // Carrot is the only remaining plain-taper ingredient — Cucumber
        // moved to "capsule" (see the capsule branch above) and never
        // reaches here.
        const g = this.taperGeometry();
        paintCarrotTexture(
          tex.context,
          this.ingRx,
          this.ingRBig,
          this.ingRSmall,
          g.BUTT_ROUND,
          g.TIP_ROUND,
          margin,
        );
      }
    }
    tex.refresh();
    this.ingredientCanvas = tex.canvas;
    this.ingredientSourceOriginWorld = { x: this.ingCx - w / 2, y: this.ingCy - h / 2 };
  }

  /** Draws the ingredient's own outline (padded 1.5px, matching the reference's piece clip pad) in WORLD coords — the outer clip every piece's texture is built from. */
  private traceIngredientSilhouette(ctx: CanvasRenderingContext2D): void {
    if (this.ingredient.shape === "ellipse") {
      traceEllipsePath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, 1.5, this.ellipseOpts);
    } else if (this.ingredient.shape === "polygon") {
      tracePolygonPath(
        ctx,
        this.ingCx,
        this.ingCy,
        this.ingPolyScale,
        this.polygonGeometry().pts,
        1.5,
      );
    } else if (this.ingredient.shape === "organic") {
      traceOrganicPath(
        ctx,
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRy,
        this.organicProfile(),
        1.5,
      );
    } else if (this.ingredient.shape === "cluster") {
      traceClusterPath(ctx, this.ingCx, this.ingCy, this.clusterLeaves, 1.5);
    } else if (this.ingredient.shape === "block") {
      traceBlockPath(
        ctx,
        this.ingCx,
        this.ingCy,
        this.ingRx,
        this.ingRy,
        this.blockDepthX,
        this.blockDepthY,
        1.5,
      );
    } else if (this.ingredient.shape === "capsule") {
      traceCapsulePath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRBig, 1.5);
    } else if (this.ingredient.shape === "fillet") {
      traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, 1.5, this.filletOpts);
    } else {
      // Phase 18: MUST read the same BUTT_ROUND/TIP_ROUND `layout()` built
      // the real collision silhouette from — falling back to
      // this.taperGeometry() here for a new-roster ingredient would trace
      // the wrong outline (e.g. Carrot's own rounding on an Eggplant),
      // silently mismatching the piece-clip visual against the actual cut
      // geometry.
      const newTaperR = TAPER_RENDERERS[this.ingredientId];
      const g = newTaperR ? newTaperR.geom : this.taperGeometry();
      // Zucchini and Bread are both production-only (no Claude Design
      // source), so they keep their own pre-existing near-uniform-width
      // blunt-capsule-via-taper approximation (BUTT_ROUND/TIP_ROUND near
      // 1) — the plain traceTaperPath covers that, same as Carrot;
      // Cucumber itself moved to a real "capsule" shape and no longer
      // reaches this branch at all (see the capsule dispatch above).
      if (this.ingredientId === "garlic") {
        traceGarlicPath(
          ctx,
          this.ingCx,
          this.ingCy,
          this.ingRx,
          this.ingRBig,
          this.ingRSmall,
          g.BUTT_ROUND,
          g.TIP_ROUND,
          1.5,
        );
      } else {
        traceTaperPath(
          ctx,
          this.ingCx,
          this.ingCy,
          this.ingRx,
          this.ingRBig,
          this.ingRSmall,
          g.BUTT_ROUND,
          g.TIP_ROUND,
          1.5,
          this.taperOpts,
        );
      }
    }
  }

  /** Renders one piece into its own small CanvasTexture and returns the Image displaying it — see textures/pieceTexture.ts. */
  private createPieceImage(piece: Piece): Phaser.GameObjects.Image {
    const b = pieceBounds(piece.cons, this.silhouette) ?? {
      x0: this.ingCx - this.ingRx,
      y0: this.ingCy - this.ingRy,
      x1: this.ingCx + this.ingRx,
      y1: this.ingCy + this.ingRy,
      gx: this.ingCx,
      gy: this.ingCy,
    };
    // Breathing room around the piece bbox (which is now the exact
    // silhouette extent — see pieceBounds). Several painters STROKE the
    // silhouette outline (centred on the path, so it sticks out by
    // ~lineWidth/2 plus its antialiased tail); the widest is the polygon
    // outline at `2.2 * scale`, which at large viewports overhangs the
    // exact extent by several px. 6 keeps that fully inside the canvas so
    // `ctx.drawImage` clips nothing visible. Proteins (`depth` present)
    // need more: their depth-wall crescent extends `depth.px` (scaled)
    // past the silhouette in world space — see paintProteinDepthWall's
    // own doc — so the pad grows to cover it, or the wall would be
    // clipped by the piece canvas's own edge.
    const depth = this.ingredient.depth;
    const protK = this.scale.width / 540;
    const pad = depth ? 6 + depth.px * protK + 4 : 6;
    const x0 = b.x0 - pad;
    const y0 = b.y0 - pad;
    const w = Math.max(1, b.x1 - b.x0 + pad * 2);
    const h = Math.max(1, b.y1 - b.y0 + pad * 2);
    const key = `piece-${this.pieceSeq++}`;
    const tex = this.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
    const reach = Math.max(this.ingRx, this.ingRy) * 6 + 200;
    if (tex && this.ingredientCanvas) {
      // Proteins only, from here through `paintProteinCutFace` below —
      // every other ingredient's `depth`/`face` are undefined, so none
      // of this runs and their piece rendering is byte-for-byte what it
      // was before this phase. Depth wall goes UNDER the top surface
      // (painted first); cut-edge roll-off and the cut face go OVER it
      // (painted after) — the exact per-piece order the source itself
      // uses (see PreparationScene's own doc on the three functions).
      if (depth) this.paintProteinDepthWall(tex.context, piece.cons, x0, y0, reach, depth);
      paintPieceTexture(
        tex.context,
        x0,
        y0,
        (ctx) => this.traceIngredientSilhouette(ctx),
        piece.cons,
        this.ingCx,
        this.ingCy,
        reach,
        this.ingredientCanvas,
        this.ingredientSourceOriginWorld,
      );
      if (depth) this.paintProteinCutEdges(tex.context, piece.cons, x0, y0, reach, depth.edge);
      const face = this.ingredient.face;
      if (face) this.paintProteinCutFace(tex.context, piece.cons, x0, y0, reach, face);
      tex.refresh();
    }
    return this.add.image(x0, y0, key).setOrigin(0, 0).setDepth(20).setAlpha(0);
  }

  /**
   * Protein-only: the 2.5D sidewall under a piece's top surface —
   * ported from knifecraft.html's `drawDepthWall(p,gp,gnow)` (`:5417`).
   * Baked into the piece's own canvas ONCE, here, at cut-commit time —
   * this production's per-piece-texture architecture paints once, not
   * live every frame (the same tradeoff `paintPeelableLayer` already
   * makes) — using the piece's un-rotated, unscaled cutting-board state
   * (`rot=0, scale=1`, exactly what's true when a piece is first
   * created). The source's own per-frame counter-rotation only matters
   * once a piece is later rotated for plating; by then this bake has
   * already happened, and the wall rotates as one rigid unit with the
   * rest of the piece's baked art — the same way every other piece
   * visual in this project already behaves under plating rotation.
   *
   * Paints UNDER the top surface (call this BEFORE `paintPieceTexture`):
   * translates the SAME silhouette+cut clip outward along the world
   * depth direction, fills a lit/mid/low gradient, then the real
   * silhouette+cut blit on top covers all of it except the crescent
   * that pokes out on the away-facing side — which IS the sidewall.
   */
  private paintProteinDepthWall(
    ctx: CanvasRenderingContext2D,
    cons: Constraint[],
    x0: number,
    y0: number,
    reach: number,
    depth: ProteinDepthConfig,
  ): void {
    const k = this.scale.width / 540;
    const d = depth.px * k;
    const vx = PROTEIN_DEPTH_DIR.x * d;
    const vy = PROTEIN_DEPTH_DIR.y * d;
    ctx.save();
    ctx.translate(-x0, -y0);
    ctx.translate(vx, vy);
    ctx.beginPath();
    traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, 1.0, this.filletOpts);
    ctx.clip();
    for (const cn of cons) clipHalfPlaneWorld(ctx, cn, this.ingCx, this.ingCy, reach);
    const g2 = ctx.createLinearGradient(
      this.ingCx,
      this.ingCy,
      this.ingCx + vx * 0.6,
      this.ingCy + this.ingRy + d,
    );
    g2.addColorStop(0, depth.lit);
    g2.addColorStop(0.55, depth.mid);
    g2.addColorStop(1, depth.low);
    ctx.fillStyle = g2;
    ctx.fillRect(
      this.ingCx - this.ingRx - 8,
      this.ingCy - this.ingRy - 8,
      (this.ingRx + 8) * 2,
      (this.ingRy + 8) * 2 + d * 2,
    );
    if (depth.rim) {
      ctx.strokeStyle = depth.rim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, 0.4, this.filletOpts);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Protein-only: the per-piece rounded roll-off a few px inside every
   * cut boundary — ported from knifecraft.html's
   * `shadeCutEdges(p,gp,gnow)` (`:5027`), so a piece reads as a rounded
   * chunk lit from above rather than a flat panel. No live
   * reveal-progress gate (the source's own `revealK(cn.cut,gnow) < 0.35`
   * skip, for a cut still visually opening): this production's piece
   * texture paints once, after the cut has already committed, so
   * there's no "still opening" frame to gate against — the edge is
   * simply present from the moment the piece exists, the same as every
   * other paint-once effect in this project.
   *
   * The source calls this (and `paintCutFaces`) from INSIDE the same
   * silhouette+all-cons clip `drawIngredient`'s own blit already used —
   * it never restores that clip in between — so both stay confined to
   * the piece's true shape, not just to one cut's own band. `paintPieceTexture`
   * (called separately, just before this) restores its own clip when it
   * returns, so this re-establishes the identical outer clip itself
   * before doing any per-cut band painting.
   */
  private paintProteinCutEdges(
    ctx: CanvasRenderingContext2D,
    cons: Constraint[],
    x0: number,
    y0: number,
    reach: number,
    edge: ProteinDepthEdgeConfig,
  ): void {
    if (!cons.length) return;
    const k = this.scale.width / 540;
    const w = edge.px * k;
    ctx.save();
    ctx.translate(-x0, -y0);
    ctx.beginPath();
    traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, 1.5, this.filletOpts);
    ctx.clip();
    for (const cn of cons) clipHalfPlaneWorld(ctx, cn, this.ingCx, this.ingCy, reach);
    for (const cn of cons) {
      ctx.save();
      const band = clipCutBand(ctx, cn, this.ingCx, this.ingCy, w, reach);
      const g2 = ctx.createLinearGradient(
        band.px,
        band.py,
        band.px + band.nx * w,
        band.py + band.ny * w,
      );
      for (const st of edge.stops) g2.addColorStop(st[0], st[1]);
      ctx.fillStyle = g2;
      ctx.beginPath();
      traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, -1, this.filletOpts);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Protein-only: the pale interior band a real cut opens — ported from
   * knifecraft.html's `paintCutFaces(p,gp,gnow)` (`:5041`), the same
   * mechanism the source's own baguette crumb uses via this identical
   * function. See `paintProteinCutEdges`'s own doc for why there's no
   * reveal-progress gate, and why the outer silhouette+all-cons clip is
   * re-established here too.
   */
  private paintProteinCutFace(
    ctx: CanvasRenderingContext2D,
    cons: Constraint[],
    x0: number,
    y0: number,
    reach: number,
    face: ProteinFaceConfig,
  ): void {
    if (!cons.length) return;
    const k = this.scale.width / 540;
    const facePx = face.px * k;
    const inset = -face.inset * k;
    ctx.save();
    ctx.translate(-x0, -y0);
    ctx.beginPath();
    traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, 1.5, this.filletOpts);
    ctx.clip();
    for (const cn of cons) clipHalfPlaneWorld(ctx, cn, this.ingCx, this.ingCy, reach);
    for (const cn of cons) {
      ctx.save();
      const band = clipCutBand(ctx, cn, this.ingCx, this.ingCy, facePx, reach);
      const g2 = ctx.createLinearGradient(
        band.px,
        band.py,
        band.px + band.nx * facePx,
        band.py + band.ny * facePx,
      );
      for (const st of face.stops) g2.addColorStop(st[0], st[1]);
      ctx.fillStyle = g2;
      ctx.beginPath();
      traceFilletPath(ctx, this.ingCx, this.ingCy, this.ingRx, this.ingRy, inset, this.filletOpts);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private destroyPieceImage(img: Phaser.GameObjects.Image): void {
    const key = img.texture.key;
    img.destroy();
    if (this.textures.exists(key)) this.textures.remove(key);
  }

  /**
   * Paints the board face into a CanvasTexture and (re)assigns it to
   * boardImg — see textures/boardTexture.ts. Ported from knifecraft.html's
   * drawBoard(): real Canvas 2D gradients/clip/arcTo, not Graphics
   * primitives, for pixel-accurate fidelity to the reference.
   */
  private redrawBoard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    if (w <= 0 || h <= 0) return;

    if (this.textures.exists(this.boardTextureKey)) this.textures.remove(this.boardTextureKey);
    const tex = this.textures.createCanvas(this.boardTextureKey, Math.ceil(w), Math.ceil(h));
    if (!tex) return;
    paintBoardTexture(
      tex.context,
      w,
      h,
      this.board.visual.tone,
      this.board.visual.pattern,
      this.board.visual.accent,
    );
    tex.refresh();

    if (!this.boardImg) {
      this.boardImg = this.add.image(0, 0, this.boardTextureKey).setOrigin(0, 0).setDepth(0);
    } else {
      this.boardImg.setTexture(this.boardTextureKey).setPosition(0, 0);
    }
  }

  private bandFor(axis: Axis): { lo: number; hi: number } {
    return bandRangeFor(
      axis,
      this.ingCx,
      this.ingCy,
      this.ingRx,
      this.ingRy,
      this.ingredient.bandTopClear,
      this.ingredient.bandBotFrac,
      this.ingredient.bandSideFrac,
    );
  }

  private countFor(axis: Axis): number {
    return this.technique.counts ? this.technique.counts[axis] : this.requiredCuts;
  }

  /** Populates the guide slots for every technique except Julienne (whose direction isn't known until cut 1 — see finishCut()). */
  private computeGuides(): void {
    this.guideSlope = { h: 0, v: 0 };
    if (this.technique.counts) {
      const bh = this.bandFor("h");
      const bv = this.bandFor("v");
      this.guides = {
        h: idealPositions(bh.lo, bh.hi, this.technique.counts.h),
        v: idealPositions(bv.lo, bv.hi, this.technique.counts.v),
      };
    } else if (this.technique.parallelSnap) {
      this.guides = { h: [], v: [] }; // lazy — see finishCut()
    } else {
      // tapDefaultAxis(), not the raw technique.axis: cucumber overrides
      // Slice's default "h" to "v" (it lies flat, so a cut that actually
      // produces rounds runs perpendicular to its length) — the dashed
      // guides should show the direction a tap will actually cut in.
      const axis = this.tapDefaultAxis();
      const b = this.bandFor(axis);
      // requiredCutsFor, not the raw technique.requiredCuts: for a
      // continuous-tap technique the dashed guides should span the same
      // whole-ingredient count taps can actually reach, so a swipe run
      // needs the same number of strokes tap needs taps (§25 "consistent
      // by construction").
      const positions = idealPositions(b.lo, b.hi, requiredCutsFor(this.technique));
      this.guides = axis === "h" ? { h: positions, v: [] } : { h: [], v: positions };
    }
    this.usedGuide = {
      h: this.guides.h.map(() => false),
      v: this.guides.v.map(() => false),
    };
  }

  private nearestUnusedGuide(axis: Axis, target: number): { c: number; idx: number } | null {
    const positions = this.guides[axis];
    const used = this.usedGuide[axis];
    let bestIdx = -1;
    let bestDist = Infinity;
    positions.forEach((p, i) => {
      if (used[i]) return;
      const d = Math.abs(p - target);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    return bestIdx >= 0 ? { c: positions[bestIdx]!, idx: bestIdx } : null;
  }

  private redrawGuides(): void {
    this.guideGfx.clear();
    // Peel/smash have no cut-line concept at all — a dashed guide line
    // would be a meaningless leftover from the shared idealPositions()
    // math (see computeGuides), not an actual hint for either interaction.
    if (this.technique.guideType === "none") return;
    if (this.technique.guideType === "radial") {
      this.drawRadialGuides();
      return;
    }
    if (this.technique.guideType === "concentric") {
      this.drawRingGuides();
      return;
    }
    this.drawGuideAxis("h");
    this.drawGuideAxis("v");
  }

  /**
   * Rings' own guide (Pre-Phase-8) — dashed concentric ellipses at
   * `ingRx*frac, ingRy*frac` for every interior ring boundary, using the
   * ingredient's OWN fitted radii (never a generic bounding circle) — the
   * exact same fractions peelOneRingLayer already consumes, so the guide
   * can never drift out of sync with the real cut geometry. A boundary
   * already shed (ringRadiusFrac has shrunk past it) dims down, the same
   * used/unused convention drawGuideAxis already uses for linear guides.
   */
  private drawRingGuides(): void {
    const n = RINGS.RING_COUNT;
    for (let i = 1; i < n; i++) {
      const frac = i / n;
      const consumed = frac >= this.ringRadiusFrac;
      this.guideGfx.lineStyle(1.6, PALETTE.gold, consumed ? 0.06 : 0.22);
      drawDashedEllipse(
        this.guideGfx,
        this.ingCx,
        this.ingCy,
        this.ingRx * frac,
        this.ingRy * frac,
      );
    }
  }

  /**
   * Radial's own guide — evenly-spaced dashed diameters through center
   * (a "starburst"), built the same way drawGuideAxis draws its own
   * dashes (visibleSeamSpanFor + drawDashedLine), just at `requiredCuts`
   * evenly-divided angles across the 180°-periodic line-angle domain
   * instead of band positions. Deliberately simple: unlike drawGuideAxis
   * there's no per-slot used/unused dimming (a radial cut's target
   * "slot" is an angle, not a discrete band position, so there's no
   * natural 1:1 slot-to-cut mapping to fade) — every spoke stays at one
   * constant, subtle opacity throughout.
   */
  private drawRadialGuides(): void {
    const n = requiredCutsFor(this.technique);
    for (let i = 0; i < n; i++) {
      const angleDeg = (180 * i) / n;
      const rad = (angleDeg * Math.PI) / 180;
      // A near-vertical target angle keeps a cleaner slope on axis "v"
      // (avoids the numerical blow-up of tan() near 90°) — same
      // axis-choice convention resolveRadialTap/finishCut's own fit uses.
      const axis: Axis = Math.abs(Math.cos(rad)) >= Math.abs(Math.sin(rad)) ? "h" : "v";
      const slope = axis === "h" ? Math.tan(rad) : Math.cos(rad) / Math.sin(rad);
      const c = axis === "h" ? this.ingCy : this.ingCx;
      const sp = visibleSeamSpanFor({ axis, c, slope }, this.silhouette);
      this.guideGfx.lineStyle(1.6, PALETTE.gold, 0.2);
      drawDashedLine(this.guideGfx, sp.x0, sp.y0, sp.x1, sp.y1);
    }
  }

  private drawGuideAxis(axis: Axis): void {
    const positions = this.guides[axis];
    const used = this.usedGuide[axis];
    const slope = this.guideSlope[axis];
    positions.forEach((c, i) => {
      // visibleSeamSpanFor, not seamSpanFor directly (§13): a dashed
      // guide drawn at the silhouette's overall half-extent stuck out
      // past the actual (narrower, at this specific position) edge for
      // a round or tapered ingredient.
      const sp = visibleSeamSpanFor({ axis, c, slope }, this.silhouette);
      this.guideGfx.lineStyle(1.6, PALETTE.gold, used[i] ? 0.06 : 0.24);
      drawDashedLine(this.guideGfx, sp.x0, sp.y0, sp.x1, sp.y1);
    });
  }

  private toBoardSpace(pointer: Phaser.Input.Pointer): RecordedPoint {
    return { x: pointer.x, y: pointer.y, time: pointer.event?.timeStamp ?? this.time.now };
  }

  /**
   * Pre-Phase-8: a generic, data-driven required-state rule — an
   * ingredient that HAS a peel technique in its own techniques list must
   * be peeled before any other technique on it can run, whatever that
   * technique is (cut, smash, ring). Reads `this.ingredient`/`this.
   * technique` (data already on the scene), never `this.ingredientId` —
   * so this applies uniformly to Onion/Potato/Garlic without a single
   * ingredient-id branch, and would apply to any FUTURE peelable
   * ingredient for free.
   *
   * `peelDecoupled` ingredients (Cucumber/Kiwi/Pea Pod/Sweet Potato/
   * Beetroot/Fennel/Mango/Pomegranate) opt OUT of this gate — see that
   * flag's own doc in definitions.ts on why: Peel and cutting are
   * genuinely independent operations for them (Cucumber alone is cut
   * directly, with no peel step, in 24 existing campaign level steps —
   * gating it here would silently soft-lock every one of them).
   */
  /** True while the current ingredient still has to be peeled before any knife work — the one gate every cut/smash/ring entry point checks. */
  private cutBlockedUntilPeeled(): boolean {
    return this.requiresPeelFirst() && !this.peeled;
  }

  private requiresPeelFirst(): boolean {
    return (
      this.ingredient.techniques.includes("peel") &&
      !this.ingredient.peelDecoupled &&
      this.technique.id !== "peel"
    );
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.paused) return;
    this.coachTouched = true;
    this.coachInputT = this.time.now;
    this.setCoachVisible(false);
    // Plating-skip (Phase 7): pendingRecipePayload is non-null for
    // EXACTLY the window between the last action of the session finishing
    // (finishRecipeNow) and the chef's hands leaving with the plate
    // (onHandsExitComplete clears it right before emitting RECIPE_COMPLETED)
    // — never during real cutting. A tap here used to just silently no-op
    // (every technique's own guard below already blocks it); now it fast-
    // forwards straight to Dish Complete instead — see skipPlating().
    if (this.pendingRecipePayload) {
      this.skipPlating();
      return;
    }
    // A real onion/potato/garlic is peeled before it's cut, smashed, or
    // ringed — see requiresPeelFirst()'s own doc. This is the single
    // choke point every technique's input passes through first (a tap's
    // eventual runTapCut/runSmash/runRingCut and a swipe's finishCut both
    // only ever get there via this handler setting up the drag), so
    // blocking here is sufficient — no per-technique duplicate check
    // needed downstream.
    if (this.cutBlockedUntilPeeled()) return;
    const mode = this.technique.interactionMode;
    if (mode === "peel" && this.peeled) return;
    if (mode === "smash" && this.smashBusy) return;
    if (mode === "ring" && (this.ringBusy || this.ringTapsDone >= this.requiredCuts)) return;
    if (mode === "cut" && this.cuts.length - this.stepCutsAtStart >= this.requiredCuts) return;

    if (!this.hasZoomedIn) {
      // STATE A -> STATE B: a short, smooth push toward the cutting
      // station on the first touch — not a slow cinematic, and it never
      // gates input (the cut this same tap started keeps going).
      this.hasZoomedIn = true;
      this.cameras.main.zoomTo(
        CAMERA.CUTTING_ZOOM,
        CAMERA.TRANSITION_MS,
        Phaser.Math.Easing.Sine.Out,
      );
    }

    if (mode === "peel") {
      this.onPeelDown(pointer);
      return;
    }

    this.isDragging = true;
    this.swipeActive = false;
    this.currentPath = [this.toBoardSpace(pointer)];
    // The swipe knife does NOT spawn here anymore — a plain tap must
    // never trigger the drag-tracking enter/active/exit dance. It spawns
    // lazily in onPointerMove, only once real movement proves this is a
    // swipe (§29). Until then the persistent idle-pose knife just keeps
    // resting where it already is. Smash never activates a swipe at all
    // (onPointerMove returns immediately for it) — it always resolves as
    // a tap on release, however much the pointer wandered.
    this.bus.emit(EVT.CUT_STARTED);
  }

  /** Bounds test shared by the tap/peel/smash entry points — a point on the bare board or off-screen chrome doesn't count (§19's forgiving-but-not-infinite target). */
  private pointInIngredientBounds(x: number, y: number): boolean {
    const tol = TAP_KNIFE.TAP_TOLERANCE_FRAC * this.scale.width;
    // reachX/reachY (Silhouette's own true half-extent), not ingRx/ingRy
    // directly — an organic profile whose amplitude/taper pushes past
    // 1.0 (a mushroom cap wider than its own base radius) genuinely
    // reaches further than ingRx/ingRy alone would suggest; using the
    // narrower box here silently rejected real taps inside the visible
    // ingredient (the top of a tall cap) as an invisible dead zone. Falls
    // back to ingRx/ingRy for every shape where those already ARE exact.
    const rx = this.silhouette.reachX ?? this.ingRx;
    const ry = this.silhouette.reachY ?? this.ingRy;
    return (
      x >= this.ingCx - rx - tol &&
      x <= this.ingCx + rx + tol &&
      y >= this.ingCy - ry - tol &&
      y <= this.ingCy + ry + tol
    );
  }

  /** Takes over `this.knife` for swipe-drag tracking — never while a swipe is already active (avoids restarting the enter fade mid-drag). */
  private spawnKnifeOnEnter(x: number, y: number): void {
    if (this.knife && (this.knife.phase === "enter" || this.knife.phase === "active")) return;
    this.knifeSeq++; // invalidate any in-flight tap sequence's stale callbacks (§29)
    this.tapBusy = false;
    this.queuedTap = null;
    // Picked up from where it was poised on the last cut: already in the
    // hand, so no fade-in.
    const poised = !!this.knife && (this.knife.squash ?? 1) < 1;
    this.knife = {
      x,
      y,
      rot: this.knife?.rot ?? 0,
      targetRot: 0,
      dirSign: this.knife?.dirSign ?? 1,
      dirLatch: null,
      rotInit: false,
      targetSquash: CUT_SQUASH,
      ...(poised ? { squash: this.knife!.squash! } : {}),
      phase: "enter",
      enterT: poised ? this.time.now - KNIFE_GEOMETRY.KNIFE_ENTER_MS : this.time.now,
      exitT: 0,
    };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.isDown) this.coachInputT = this.time.now;
    if (this.paused) return;
    const mode = this.technique.interactionMode;
    if (mode === "peel") {
      this.onPeelMove(pointer);
      return;
    }
    // Smash and Rings never become a drag/swipe — both always resolve as
    // a single tap on release, however much the pointer wandered while
    // pressed (§"no precision punishment" — a slightly wobbly press is
    // still one clean smash/ring tap).
    if (mode === "smash" || mode === "ring") return;
    if (!this.isDragging) return;
    const p = this.toBoardSpace(pointer);
    this.currentPath.push(p);

    if (!this.swipeActive) {
      const first = this.currentPath[0]!;
      const moved = Math.hypot(p.x - first.x, p.y - first.y);
      if (moved < SWIPE_ACTIVATE_PX) return; // still just a tap candidate
      this.swipeActive = true;
      this.spawnKnifeOnEnter(first.x, first.y);
    }

    this.updateKnifeDirection();
    if (this.knife) {
      this.knife.x = p.x;
      this.knife.y = p.y;
    }
    this.redrawSeamPreview();
  }

  /**
   * knifecraft.html's blade-direction logic: direction is measured against a
   * point at least DIR_BASELINE_PX back (not the immediately previous sample —
   * that's sampling noise, not intent). The knife lies along the drag, held
   * from the cook's right hand (knifeTipDir / poseForTipDir).
   */
  private updateKnifeDirection(): void {
    if (!this.knife) return;
    const pts = this.currentPath;
    const last = pts[pts.length - 1]!;
    const baselineDist = KNIFE_GEOMETRY.DIR_BASELINE_FRAC * this.scale.width;
    let base: RecordedPoint | null = null;
    for (let i = pts.length - 2; i >= 0; i--) {
      const q = pts[i]!;
      if (Math.hypot(last.x - q.x, last.y - q.y) >= baselineDist) {
        base = q;
        break;
      }
    }
    if (!base) return;

    const dx = last.x - base.x;
    const dy = last.y - base.y;
    // The knife moves with the finger along the drag, held the way the
    // cook holds it: along the drag line, tip away from the right hand
    // (knifeTipDir), so right to left is a push cut and left to right a pull
    // cut. The middle of its edge is on the finger, and it is stood on its
    // edge (top view). It turns continuously with the drag's line. When it
    // has to face the other way it turns over in the hand (dirSign eases
    // through 0).
    const tipDir = knifeTipDir(Math.atan2(dy, dx), this.knife.tipDir);
    this.knife.tipDir = tipDir;
    const { rot, sign } = poseForTipDir(tipDir);
    this.knife.targetContactAlong = swipeContactAlong(
      knifeProfile(this.knifeStats.animation.blade, this.scale.width).tip,
    );
    this.knife.targetSquash = CUT_SQUASH;
    this.knife.dirLatch = null;
    if (this.knife.rotInit && Math.abs(rot - this.knife.rot) > Math.PI / 2) {
      // Crossing vertical: the same tip direction, drawn the other way round
      // (on a knife stood on its edge this is barely visible).
      this.knife.rot = rot;
      this.knife.dirSign = sign;
    }
    this.knife.targetRot = rot;
    this.knife.targetSign = sign;
    if (!this.knife.rotInit) {
      this.knife.rot = rot; // enters already facing travel — no swing-in from horizontal
      this.knife.dirSign = sign;
      this.knife.contactAlong = this.knife.targetContactAlong;
      this.knife.squash = CUT_SQUASH;
      this.knife.rotInit = true;
    }
  }

  /** The seam opens under the blade DURING the stroke, not only at release (knifecraft.html PRESCORE). */
  private redrawSeamPreview(): void {
    this.seamGfx.clear();
    this.redrawCommittedSeams();
    if (this.currentPath.length < 2) return;
    const first = this.currentPath[0]!;
    const last = this.currentPath[this.currentPath.length - 1]!;
    this.seamGfx.lineStyle(2, PALETTE.ivory, 0.85);
    this.seamGfx.lineBetween(first.x, first.y, last.x, last.y);
  }

  private redrawCommittedSeams(): void {
    for (const cut of this.cuts) {
      const sp = visibleSeamSpanFor(cut, this.silhouette); // §13 — never extend past the actual silhouette
      this.seamGfx.lineStyle(1.5, PALETTE.gold, 0.22);
      this.seamGfx.lineBetween(sp.x0, sp.y0, sp.x1, sp.y1);
    }
  }

  private onPointerUp(): void {
    if (this.technique.interactionMode === "peel") {
      this.onPeelUp();
      return;
    }
    if (!this.isDragging) return;
    this.isDragging = false;

    const path = this.currentPath;
    this.currentPath = [];
    const wasSwipe = this.swipeActive;
    this.swipeActive = false;

    if (!wasSwipe) {
      // The swipe knife never spawned — this is a genuine tap candidate.
      // No fade/exit to run; the resting knife just launches its own
      // cut sequence (or the tap is silently ignored/buffered — see
      // handleTap's own input-priority gate, §16).
      if (!this.paused) this.handleTap(path);
      return;
    }

    if (this.knife && this.knife.phase !== "exit") {
      this.knife.phase = "exit";
      this.knife.exitT = this.time.now;
      this.knife.targetRot = 0;
    }

    if (path.length < 2 || this.paused) {
      this.redrawSeamPreview();
      return;
    }

    const first = path[0]!;
    const last = path[path.length - 1]!;
    const travelled = Math.hypot(last.x - first.x, last.y - first.y);
    const minSwipe = 0.06 * Math.min(this.scale.width, this.scale.height);
    if (travelled < minSwipe) {
      this.redrawSeamPreview();
      return;
    }

    const cutsBefore = this.cuts.length;
    const stepBefore = this.stepIndex;
    this.finishCut(path);
    // A swipe that cut and left the step unfinished: the knife settles on
    // the cut it made instead of fading back to the board.
    if (
      this.cuts.length > cutsBefore &&
      this.stepIndex === stepBefore &&
      !this.pendingRecipePayload &&
      this.technique.interactionMode === "cut"
    ) {
      this.poiseKnifeOn(this.cuts[this.cuts.length - 1]!, last);
    }
  }

  /**
   * Tap-to-cut entry point (§2/§16). Guards mirror onPointerDown/finishCut's
   * own gates (paused, recipe already complete) plus the tap-specific
   * ones: the tap has to actually land near the ingredient (§19), and if
   * a tap-cut sequence is already in flight, this tap either buffers as
   * the ONE next cut (only in the final BUFFER_TAIL_MS of that sequence)
   * or is dropped — never queued more than one deep, never auto-fires
   * without this call (§3).
   */
  private handleTap(path: RecordedPoint[]): void {
    if (this.paused || !path.length) return;
    if (this.pendingRecipePayload) return;
    if (this.cutBlockedUntilPeeled()) return;

    const mx = path.reduce((s, p) => s + p.x, 0) / path.length;
    const my = path.reduce((s, p) => s + p.y, 0) / path.length;
    // Forgiving target: the whole ingredient area plus a tolerance band
    // outside it — a tap on the bare board or off-screen chrome is not a
    // cut (§19).
    if (!this.pointInIngredientBounds(mx, my)) return;

    if (this.technique.interactionMode === "smash") {
      if (this.smashBusy) return;
      this.runSmash(mx, my);
      return;
    }

    if (this.technique.interactionMode === "ring") {
      if (this.ringBusy || this.ringTapsDone >= this.requiredCuts) return;
      this.runRingCut(mx, my);
      return;
    }

    if (this.cuts.length - this.stepCutsAtStart >= this.requiredCuts) return;

    if (this.tapBusy) {
      const elapsed = this.time.now - this.tapSeqStartT;
      // Blacksmith Handling widens this window (bufferMult, 1.0 un-upgraded):
      // a tap earlier in the current cut is queued as the next cut rather
      // than dropped. Still one tap deep, still never auto-fires.
      const bufferTail = tapBufferWindowMs(
        this.technique.knifeProfile === "chop"
          ? CHOP_KNIFE.BUFFER_TAIL_MS
          : TAP_KNIFE.BUFFER_TAIL_MS,
        this.knifeStats,
      );
      if (this.tapSeqTotalMs - elapsed <= bufferTail) {
        this.queuedTap = { x: mx, y: my };
      }
      return;
    }
    this.runTapCut(mx, my);
  }

  // ---- Peel — a real spatial drag-coverage sweep, no Cut geometry at all
  // (see TechniqueDefinition.interactionMode). PEEL's own doc in
  // definitions.ts has the full design writeup; the short version: every
  // valid swipe segment stamps a peel-width band onto a coarse, resize-
  // independent coverage grid AND is recorded (in the same normalized
  // units) for the shared ingredient texture's destination-out erase
  // replay — see paintPeelableLayer in redrawIngredientTexture. Coverage
  // is real newly-uncovered area, not raw pointer-travel distance, so
  // retracing an already-peeled patch earns no further credit (§13).

  /** Which two geometry fields define this ingredient's own local extent, for both the peel coverage grid and the normalized stroke-history replay — every peelable ingredient is "ellipse" (ry), "taper"/"capsule" (rBig), or "polygon" (Apple — its own true bounding-box ry, set generically for every shape by layout()'s own silhouette-fit branch), so `this.ingRx`/`this.ingRy` alone are always the right pair; no per-shape or per-ingredient-id branch is needed here. */
  private peelHalfExtents(): { hw: number; hh: number } {
    // this.ingRy is kept in sync with the TRUE vertical half-extent by
    // layout() for every shape a peelable ingredient can have — an
    // ellipse's own ry, a capsule's rBig, and (critically for Pea Pod's
    // bowed spine) a taper's spine-aware `rBig + |spine|` — so this is
    // correct uniformly, with no per-shape branch needed here.
    return { hw: this.ingRx, hh: this.ingRy };
  }

  /** Resolves this ingredient's own Peel tuning, falling back to the shared PEEL defaults — see IngredientDefinition.peelConfig/PeelConfig's own doc. */
  private peelConfig(): { strokeWidthFrac: number; completionThreshold: number } {
    const cfg = this.ingredient.peelConfig;
    return {
      // Blacksmith Sharpness takes a wider strip per stroke (peelWidthMult,
      // 1.0 un-upgraded); the completion coverage below is never changed.
      strokeWidthFrac: peelStrokeWidthFrac(
        cfg?.strokeWidthFrac ?? PEEL.STROKE_WIDTH_FRAC,
        this.knifeStats,
      ),
      completionThreshold: cfg?.completionThreshold ?? PEEL.COMPLETION_THRESHOLD,
    };
  }

  /** (Re)builds the coarse coverage grid for a fresh Peel step — called from resetInputState, i.e. AFTER layout() for a genuinely fresh ingredient, so this.silhouette/ingCx/ingCy/ingRx/ingRy already reflect the CURRENT ingredient. A no-op grid (peelTotalCells stays 0) for every non-peel step — no wasted work, and onPeelMove/markPeelSegmentCovered both already guard on peelTotalCells > 0. */
  private initPeelGrid(): void {
    this.peelStrokes = [];
    this.peelCoveredCells = 0;
    this.peelTotalCells = 0;
    const cols = PEEL.GRID_COLS;
    const rows = PEEL.GRID_ROWS;
    this.peelGridCols = cols;
    this.peelGridRows = rows;
    this.peelGrid = new Uint8Array(cols * rows);
    this.peelGridInside = new Uint8Array(cols * rows);
    if (this.technique.id !== "peel") return;
    const { hw, hh } = this.peelHalfExtents();
    let total = 0;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const u = ((gx + 0.5) / cols) * 2 - 1;
        const v = ((gy + 0.5) / rows) * 2 - 1;
        const wx = this.ingCx + u * hw;
        const wy = this.ingCy + v * hh;
        if (this.silhouette.inside(wx, wy)) {
          this.peelGridInside[gy * cols + gx] = 1;
          total++;
        }
      }
    }
    this.peelTotalCells = total;
  }

  /**
   * Stamps a rounded (disc-sampled-along-a-line, never a square block —
   * §5/§9) band around the segment (u0,v0)-(u1,v1) onto the coverage
   * grid, crediting `peelCoveredCells` ONLY for cells that are both
   * inside the true silhouette and not already marked — so retracing
   * already-peeled surface changes nothing (§13). Same normalized units
   * as peelHalfExtents/peelStrokes throughout, so this needs no rx/ry
   * input at all and is unaffected by a mid-session resize.
   */
  private markPeelSegmentCovered(
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    halfWidthFrac: number,
  ): void {
    if (this.peelTotalCells === 0) return;
    const cols = this.peelGridCols;
    const rows = this.peelGridRows;
    const segLen = Math.hypot(u1 - u0, v1 - v0);
    const steps = Math.max(1, Math.ceil((segLen * Math.max(cols, rows)) / 2));
    const rCellsX = Math.max(1, Math.round((halfWidthFrac * cols) / 2));
    const rCellsY = Math.max(1, Math.round((halfWidthFrac * rows) / 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = u0 + (u1 - u0) * t;
      const v = v0 + (v1 - v0) * t;
      const gx = Math.floor(((u + 1) / 2) * cols);
      const gy = Math.floor(((v + 1) / 2) * rows);
      for (let dy = -rCellsY; dy <= rCellsY; dy++) {
        for (let dx = -rCellsX; dx <= rCellsX; dx++) {
          if ((dx * dx) / (rCellsX * rCellsX) + (dy * dy) / (rCellsY * rCellsY) > 1) continue; // keep the stamp a disc, not a square
          const cx = gx + dx;
          const cy = gy + dy;
          if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;
          const idx = cy * cols + cx;
          if (this.peelGridInside[idx] && !this.peelGrid[idx]) {
            this.peelGrid[idx] = 1;
            this.peelCoveredCells++;
          }
        }
      }
    }
  }

  /** Re-crops the single Peel-technique piece's own small canvas straight from the just-updated shared ingredient canvas, IN PLACE — no texture/GameObject destroy+recreate per stroke (§23 "avoid creating persistent temporary canvases every swipe"). Only used mid-drag, where the piece's own bbox never changes (Peel always has exactly one whole-ingredient piece; its cons stays `[]` until a later chained Halve/etc.). */
  private repaintPeelPieceImage(): void {
    const whole = this.pieces[0];
    if (!whole) return;
    const img = this.pieceImages.get(whole);
    if (!img || !this.ingredientCanvas) return;
    const tex = img.texture as Phaser.Textures.CanvasTexture;
    if (!tex.context) return;
    const b = pieceBounds(whole.cons, this.silhouette) ?? {
      x0: this.ingCx - this.ingRx,
      y0: this.ingCy - this.ingRy,
      x1: this.ingCx + this.ingRx,
      y1: this.ingCy + this.ingRy,
      gx: this.ingCx,
      gy: this.ingCy,
    };
    const pad = 6;
    const x0 = b.x0 - pad;
    const y0 = b.y0 - pad;
    const reach = Math.max(this.ingRx, this.ingRy) * 6 + 200;
    tex.context.clearRect(0, 0, tex.width, tex.height);
    paintPieceTexture(
      tex.context,
      x0,
      y0,
      (ctx) => this.traceIngredientSilhouette(ctx),
      whole.cons,
      this.ingCx,
      this.ingCy,
      reach,
      this.ingredientCanvas,
      this.ingredientSourceOriginWorld,
    );
    tex.refresh();
  }

  private onPeelDown(pointer: Phaser.Input.Pointer): void {
    const p = this.toBoardSpace(pointer);
    if (!this.pointInIngredientBounds(p.x, p.y)) return;
    this.peeling = true;
    this.lastValidPeelPoint = this.silhouette.inside(p.x, p.y) ? p : null;
    // The knife visibly contacts the ingredient and tracks the pointer for
    // the whole stroke (§7 "should feel like scrape, not slice... no
    // noticeable lag") — reuses the exact same enter/active/exit +
    // direction-smoothing machinery Slice/Chop's own swipe already relies
    // on (spawnKnifeOnEnter/updateKnifeDirection/currentPath), just
    // entered from Peel's own pointer lifecycle instead of the cut
    // swipe's onPointerDown/Move/Up.
    this.spawnKnifeOnEnter(p.x, p.y);
    this.currentPath = [p];
    this.bus.emit(EVT.CUT_STARTED); // reuses the existing "hide the tap-hint text" signal React already listens for
  }

  private onPeelMove(pointer: Phaser.Input.Pointer): void {
    if (!this.peeling || this.peeled) return;
    const p = this.toBoardSpace(pointer);

    // Knife-follow: always tracks the raw pointer, valid-or-not — exactly
    // as responsive as the normal cut swipe (§7).
    this.currentPath.push(p);
    this.updateKnifeDirection();
    if (this.knife) {
      this.knife.x = p.x;
      this.knife.y = p.y;
    }

    // Coverage/visual-mask credit: ONLY for movement that both starts and
    // ends over the ingredient's true silhouette (§11) — never a bounding-
    // box approximation, and never a stray long segment drawn across dead
    // space when the pointer re-enters from outside (lastValidPeelPoint is
    // cleared the instant the pointer leaves, so re-entry always starts a
    // fresh segment).
    const inside = this.silhouette.inside(p.x, p.y);
    if (inside && this.lastValidPeelPoint) {
      const q = this.lastValidPeelPoint;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d >= 1) {
        const { hw, hh } = this.peelHalfExtents();
        const u0 = (q.x - this.ingCx) / hw;
        const v0 = (q.y - this.ingCy) / hh;
        const u1 = (p.x - this.ingCx) / hw;
        const v1 = (p.y - this.ingCy) / hh;
        this.peelStrokes.push({ u0, v0, u1, v1 });
        const before = this.peelCoveredCells;
        this.markPeelSegmentCovered(u0, v0, u1, v1, this.peelConfig().strokeWidthFrac);
        this.redrawIngredientTexture();
        this.repaintPeelPieceImage();
        // A light, restrained tactile trail (§"never a particle
        // explosion") — real strips of skin curling away along the drag's
        // own direction, and only when genuinely NEW surface was just
        // uncovered (§13 "no fake progress from retracing").
        if (this.peelCoveredCells > before && Math.random() < 0.45) {
          this.spawnPeelFleck(p.x, p.y, Math.atan2(p.y - q.y, p.x - q.x));
        }
        // HUD feedback only (read-only): how far the skin is towards done.
        if (this.peelCoveredCells > before) {
          this.bus.emit(EVT.PEEL_PROGRESS, {
            fraction: Math.min(
              1,
              this.peelCoveredCells / (this.peelTotalCells * this.peelConfig().completionThreshold),
            ),
          });
        }
      }
    }
    this.lastValidPeelPoint = inside ? p : null;

    if (
      this.peelTotalCells > 0 &&
      this.peelCoveredCells / this.peelTotalCells >= this.peelConfig().completionThreshold
    ) {
      this.completePeel();
    }
  }

  private onPeelUp(): void {
    this.peeling = false;
    this.lastValidPeelPoint = null;
    this.currentPath = [];
    if (this.knife && this.knife.phase !== "exit") {
      this.knife.phase = "exit";
      this.knife.exitT = this.time.now;
      this.knife.targetRot = 0;
    }
  }

  /**
   * Peel's own one-shot completion — repaints the shared source texture as fully "peeled" (see garlicTexture.ts), which also cleans up any tiny remaining skin islands the coverage threshold left behind (a full, unconditional flesh repaint, not a partial patch — see redrawIngredientTexture's paintPeelableLayer gate), rebuilds the one whole-ingredient piece image against it, and advances the step. No Cut is ever created — see closeOutCurrentIngredient's "peel/smash contribute zero grading segments" note.
   *
   * Bugfix — this fires from INSIDE onPeelMove, i.e. while the finger/
   * pointer is very likely still physically down (coverage crossed the
   * threshold mid-rub, not on release). advanceStepOrFinish() below can
   * switch `this.technique` to the chain's NEXT step (e.g. Halve,
   * interactionMode "cut") immediately, synchronously — so the eventual
   * real pointer-up fires against the NEW technique, and onPointerUp's
   * own `interactionMode === "peel"` dispatch no longer matches: onPeelUp
   * never runs, the knife is never told to retire, and it's left stuck
   * in "active" phase forever — spawnKnifeOnEnter's own re-entry guard
   * then refuses every later tap (`phase === "active"` looks like a drag
   * still in progress), reading as "the knife gets locked down" right
   * after peeling finishes. Retiring the knife HERE, unconditionally,
   * the instant peeling itself completes — exactly what onPeelUp would
   * have done — means it no longer matters whether the real pointer-up
   * lands on this technique or the next one.
   */
  private completePeel(): void {
    this.peeled = true;
    this.peeling = false;
    this.lastValidPeelPoint = null;
    this.currentPath = [];
    if (this.knife && this.knife.phase !== "exit") {
      this.knife.phase = "exit";
      this.knife.exitT = this.time.now;
      this.knife.targetRot = 0;
    }
    AudioManager.playIngredientSlice(
      this.ingredientId,
      0.3,
      PEEL.REVEAL_MS,
      this.knifeStats.audio.pitchMult,
      this.knifeStats.audio.gainMult,
    );
    this.redrawIngredientTexture();
    const whole = this.pieces[0]!;
    const old = this.pieceImages.get(whole);
    if (old) this.destroyPieceImage(old);
    const fresh = this.createPieceImage(whole);
    fresh.setAlpha(0);
    this.pieceImages.set(whole, fresh);
    this.tweens.add({
      targets: fresh,
      alpha: 1,
      duration: PEEL.REVEAL_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    // The completion flourish (§"peeling needs better animation") — a
    // ring of skin flecks scatters outward the instant the last of the
    // skin comes away, on top of the existing crossfade.
    this.spawnPeelBurst(this.ingCx, this.ingCy);
    this.boardNudge();
    this.advanceStepOrFinish();
  }

  /** Populates + locks a technique-axis's guide slots the first time it's needed — shared by finishCut (swipe) and resolveTapCut (tap's guide-slot fallback for a non-continuous technique). */
  private ensureGuidesFor(axis: Axis, slope: number): void {
    if (this.guides[axis].length > 0) return;
    const b = this.bandFor(axis);
    this.guides[axis] = idealPositions(b.lo, b.hi, requiredCutsFor(this.technique));
    this.usedGuide[axis] = this.guides[axis].map(() => false);
    this.guideSlope[axis] = slope;
  }

  /**
   * Resolves a tap position into a fully-specified Cut — no drag, so no
   * fitted angle: a tap is never sloped (§4). continuousTap (Slice) uses
   * the free clamp-and-push-off-neighbors placement (resolveContinuousPosition);
   * a finite/guided technique (Dice/Julienne) reuses the exact same
   * guide-slot system a swipe would land on, just without a drag
   * direction driving which slot. Returns null only when there's
   * genuinely no room left (§4 "never an unusably tiny piece").
   */
  private resolveTapCut(x: number, y: number): Cut | null {
    // Radial (Phase 7): a tap has no drag to fit an angle from — the cut's
    // angle is simply "direction from center to the tap point," a real
    // half-plane Cut pinned through center at that angle (see
    // TechniqueDefinition.radialSnap's own doc). Bypasses the guide-slot
    // system entirely — there's no linear "position" to snap, only angle.
    if (this.technique.radialSnap) return this.resolveRadialTap(x, y);

    const axis = liveAxis(this.tapDefaultAxis(), this.technique.counts, this.cuts);
    const slope = this.cuts.length ? this.guideSlope[axis] : 0;

    if (this.technique.continuousTap) {
      const band = this.bandFor(axis);
      let rawTarget = interceptThrough(axis, slope, x, y, this.ingCx, this.ingCy);
      // Chop only: jitter the aimed-for position a little before it gets
      // clamped/pushed-off-neighbors, so repeated taps in roughly the
      // same spot still land as naturally uneven chopped pieces instead
      // of Slice's clean even spacing (§"Chop must feel mechanically
      // distinct" — a placement difference, not just a knife-animation
      // reskin).
      if (this.technique.placementJitterFrac) {
        const span = band.hi - band.lo;
        rawTarget +=
          (Math.random() * 2 - 1) *
          span *
          TAP_KNIFE.MIN_GAP_FRAC *
          this.technique.placementJitterFrac;
      }
      const existing = this.cuts.filter((c) => c.axis === axis).map((c) => c.c);
      const c = resolveContinuousPosition(
        band,
        existing,
        rawTarget,
        TAP_KNIFE.MIN_EDGE_FRAC,
        TAP_KNIFE.MIN_GAP_FRAC,
      );
      return c == null ? null : { axis, slope, c };
    }

    this.ensureGuidesFor(axis, slope);
    const target = interceptThrough(axis, slope, x, y, this.ingCx, this.ingCy);
    const guide = this.nearestUnusedGuide(axis, target);
    if (!guide) return null;
    this.usedGuide[axis][guide.idx] = true;
    return { axis, slope, c: guide.c };
  }

  /**
   * Radial's own tap resolution. Radial is N evenly-spaced diameters
   * through the centre — the exact set `drawRadialGuides` paints
   * (angleDeg = 180*i/N). A tap has no drag to fit a free angle from, and
   * — unlike a swipe, where the player naturally varies the stroke
   * direction — repeated taps in roughly the same area used to return the
   * same raw centre->tap angle every time (a duplicate cut that splits
   * nothing, so "tap doesn't progress through the radial positions").
   * Snap the tap to the NEAREST STILL-OPEN diameter instead — the same
   * "consume the nearest unused candidate" rule every linear technique's
   * tap already uses via nearestUnusedGuide. Returns null when tapped
   * dead-centre (no direction) or when every diameter is already cut.
   */
  private resolveRadialTap(x: number, y: number): Cut | null {
    const dx = x - this.ingCx;
    const dy = y - this.ingCy;
    if (Math.hypot(dx, dy) < 1) return null; // tapped exactly on center — no direction to read

    const n = requiredCutsFor(this.technique);
    const fold = (deg: number) => ((deg % 180) + 180) % 180;
    const gap = (a: number, b: number) => {
      const d = Math.abs(fold(a) - fold(b));
      return Math.min(d, 180 - d);
    };
    const slotAngle = (i: number) => (180 * i) / n;
    const nearestSlot = (deg: number): number => {
      let best = 0;
      let bestGap = Infinity;
      for (let i = 0; i < n; i++) {
        const g = gap(deg, slotAngle(i));
        if (g < bestGap) {
          bestGap = g;
          best = i;
        }
      }
      return best;
    };

    const used = new Array<boolean>(n).fill(false);
    for (const c of this.cuts) used[nearestSlot(lineAngleDeg(c.axis, c.slope))] = true;

    const tapDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let pick = -1;
    let pickGap = Infinity;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const g = gap(tapDeg, slotAngle(i));
      if (g < pickGap) {
        pickGap = g;
        pick = i;
      }
    }
    if (pick < 0) return null; // every diameter already cut

    const rad = (slotAngle(pick) * Math.PI) / 180;
    // Same axis choice drawRadialGuides uses — keeps tan()/cot() away from
    // its blow-up near 90° and keeps the cut sitting on its own guide.
    return Math.abs(Math.cos(rad)) >= Math.abs(Math.sin(rad))
      ? { axis: "h", c: this.ingCy, slope: Math.tan(rad) }
      : { axis: "v", c: this.ingCx, slope: Math.cos(rad) / Math.sin(rad) };
  }

  /**
   * The tap-cut knife animation (§6/§11): IDLE -> PREP (lift above the
   * cut point) -> a short PAUSE -> CUT (plunge down through) -> IMPACT
   * (tiny recoil "thunk", hitstop, and this is the moment the cut is
   * actually committed) -> RETRACT back to idle. Every step is a real
   * tween — the blade never teleports. `knifeSeq` is captured once and
   * checked before every continuation so an interrupted sequence (a
   * swipe starting mid-animation, or a scene restart) cleanly stops
   * touching scene state instead of fighting whatever replaced it.
   */
  /** TAP_KNIFE (Slice/Dice/Julienne/Halve) or CHOP_KNIFE (Chop) — see CHOP_KNIFE's own doc comment for why Chop needs a genuinely different cadence, not a reskinned Slice. Idle pose / bounds / placement constants stay TAP_KNIFE's always — only the animation-timing subset varies. */
  private tapTiming(): {
    PREP_MS: number;
    PAUSE_MS: number;
    CUT_MS: number;
    IMPACT_MS: number;
    RETRACT_MS: number;
    PREP_OFFSET_X_FRAC: number;
    PREP_ABOVE_FRAC: number;
    CUT_DEPTH_FRAC: number;
    ANGLE_JITTER_DEG: number;
    BUFFER_TAIL_MS: number;
    HITSTOP_MS: number;
  } {
    const base = this.technique.knifeProfile === "chop" ? CHOP_KNIFE : TAP_KNIFE;
    // Phase 8 — the equipped knife's own timing/depth/jitter multipliers
    // (KnifeAnimationProfile) layer on top of the technique's base
    // cadence, kept close to 1.0 so the FEEL changes without ever
    // changing what's required to complete a cut (none of these fields
    // feed cut-position resolution — see resolveTapCut, which runs
    // BEFORE this is consulted).
    // Phase 8 knife feel (animation.timingMult/depthMult/jitterMult) plus
    // the Blacksmith's per-player tuning — Speed shortens the wind-up and
    // recovery beats, Sharpness the pass-through beats, Handling the
    // hitstop. The arithmetic lives in knifeTiming.ts (pure, QA-tested).
    return knifeTapCadence(base, this.knifeStats);
  }

  /**
   * The tap stroke for `cut` (knifeProfile.tapStrokePose at progress k).
   * k = 0 is also the poised pose the knife waits in on its last cut.
   *
   * The knife snaps EXACTLY onto the cut line, held from the cook's right
   * hand (knifeTipDir):
   * - a vertical cut gets a fully vertical knife, tip up, handle down;
   * - a horizontal cut gets a fully horizontal one, tip left, handle right.
   *
   * It is stood on its edge (seen from above, topViewProfile), with no
   * per-cut tilt. The middle of its edge sits on the line, at the line's
   * middle over the food. For a radial cut, whose line runs through the
   * centre, that is the point on the line nearest `near` (the tap, or a
   * swipe's end), so the blade is where the player cut.
   */
  private cutStrokeFor(cut: Cut, near: { x: number; y: number }): (k: number) => KnifePose {
    const w = this.scale.width;
    const K = this.tapTiming();
    const cutPoint = this.technique.radialSnap
      ? near
      : cut.axis === "h"
        ? { x: this.ingCx, y: cut.c }
        : { x: cut.c, y: this.ingCy };
    const tipDir = knifeTipDir(Phaser.Math.DegToRad(lineAngleDeg(cut.axis, cut.slope)));
    const ux = Math.cos(tipDir);
    const uy = Math.sin(tipDir);
    const onLine = this.technique.radialSnap
      ? (() => {
          const d = (cutPoint.x - this.ingCx) * ux + (cutPoint.y - this.ingCy) * uy;
          return { x: this.ingCx + ux * d, y: this.ingCy + uy * d };
        })()
      : cutPoint;
    const tipX = knifeProfile(this.knifeStats.animation.blade, w).tip;
    const hop = K.PREP_ABOVE_FRAC * w * 0.35;
    return (k: number) => tapStrokePose(onLine, tipDir, tipX, hop, k);
  }

  /**
   * Lays the knife back down flat on its rest pose (idleKnifePose). This
   * happens when a step ends; between the cuts of one step it stays poised
   * on the last cut. It does nothing while a swipe holds the knife, or when
   * the knife is already lying down.
   */
  private layKnifeDown(): void {
    const g = this.knife;
    if (!g || g.phase === "enter" || g.phase === "active" || g.phase === "exit") return;
    if (g.phase === "idle" && (g.squash ?? 1) >= 0.999 && (g.targetSquash ?? 1) >= 1) return;
    const seq = ++this.knifeSeq;
    const idle = this.idleKnifePose();
    g.targetSquash = 1;
    g.phase = "tapRetract";
    this.tweens.add({
      targets: g,
      x: idle.x,
      y: idle.y,
      rot: idle.rot,
      dirSign: 1,
      duration: this.tapTiming().RETRACT_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => {
        if (seq !== this.knifeSeq) return;
        g.phase = "idle";
        g.targetRot = idle.rot;
      },
    });
  }

  /**
   * After a swipe that cut and left the step unfinished, the knife doesn't
   * vanish back to its rest pose. It settles poised on the cut it just made,
   * stood on its edge, ready for the next cut.
   */
  private poiseKnifeOn(cut: Cut, near: { x: number; y: number }): void {
    const g = this.knife;
    if (!g) return;
    const seq = ++this.knifeSeq;
    const pose = this.cutStrokeFor(cut, near)(0);
    // Fold the finger offset into the pivot so nothing jumps.
    const along = (g.contactAlong ?? 0) * g.dirSign;
    g.x -= Math.cos(g.rot) * along;
    g.y -= Math.sin(g.rot) * along;
    g.phase = "tapRetract"; // tween-driven, fully visible
    g.contactAlong = 0;
    g.targetContactAlong = 0;
    g.targetSquash = CUT_SQUASH;
    delete g.targetSign;
    this.tweens.add({
      targets: g,
      x: pose.x,
      y: pose.y,
      rot: pose.rot,
      dirSign: pose.sign,
      duration: this.tapTiming().RETRACT_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        if (seq !== this.knifeSeq) return;
        g.phase = "idle";
        g.targetRot = pose.rot;
        g.enterT = this.time.now - KNIFE_GEOMETRY.KNIFE_ENTER_MS - 1;
      },
    });
  }

  private runTapCut(x: number, y: number): void {
    const cut = this.resolveTapCut(x, y);
    if (!cut) {
      // No valid position — either the tap missed a real target, or (for
      // a continuous-tap technique with at least one committed cut
      // already) resolveContinuousPosition's greedy nearest-fit placement
      // has genuinely boxed itself in a little short of the nominal
      // requiredCutsFor() estimate (that count assumes perfectly even
      // spacing; real tap positions rarely land that evenly). Don't
      // leave the player stuck forever short of the target (§16 —
      // completion should track the ingredient's actual remaining room,
      // not an arbitrary fixed number): advance/finish with whatever has
      // already been cut in THIS step instead.
      if (
        this.technique.continuousTap &&
        this.cuts.length - this.stepCutsAtStart > 0 &&
        !this.pendingRecipePayload
      ) {
        this.advanceStepOrFinish();
      }
      return;
    }

    const K = this.tapTiming();
    const isChop = this.technique.knifeProfile === "chop";
    const seq = ++this.knifeSeq;
    this.tapBusy = true;
    this.tapSeqStartT = this.time.now;
    this.tapSeqTotalMs = tapSequenceMs(K);

    const w = this.scale.width;
    // Radial (Phase 7): cut.c is ALWAYS the ingredient's own center
    // (ingCy for axis "h", ingCx for axis "v" — see resolveRadialTap's
    // own doc, a radial cut is a line THROUGH center, so it carries no
    // real position, only an angle via slope). Deriving cutPoint from
    // axis/c the way every other technique does would make the knife's
    // animated strike target the exact same center point regardless of
    // where the player tapped — only its rotation would ever change,
    // which reads as "every tap cuts in the same place" even though the
    // underlying Cut geometry (and the resulting pieces) genuinely
    // differ. Using the real tap position directly fixes that — the
    // blade visibly strikes near wherever was actually tapped.
    const poseAt = this.cutStrokeFor(cut, { x, y });
    const prep = poseAt(0);

    if (!this.knife)
      this.knife = {
        ...this.idleKnifePose(),
        targetRot: 0,
        dirSign: 1,
        dirLatch: null,
        rotInit: true,
        phase: "idle",
        enterT: this.time.now,
        exitT: 0,
      };
    const g = this.knife; // stable reference the whole chain tweens against
    g.contactAlong = 0; // the stroke poses the pivot itself
    g.targetContactAlong = 0;
    g.targetSquash = CUT_SQUASH; // stood on its edge while it cuts
    g.phase = "tapPrep";

    // Drives the knife through the stroke (k = tapStrokePose's progress).
    const stroke = { k: 0 };
    const followStroke = () => {
      const p = poseAt(stroke.k);
      g.x = p.x;
      g.y = p.y;
      g.rot = p.rot;
      g.dirSign = p.sign;
    };

    // Snap into place. dirSign tweens through 0 when the knife has to face
    // the other way, so it turns over in the hand instead of spinning.
    this.tweens.add({
      targets: g,
      x: prep.x,
      y: prep.y,
      rot: prep.rot,
      dirSign: prep.sign,
      duration: K.PREP_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        if (seq !== this.knifeSeq) return;
        g.phase = "tapPause";
        this.time.delayedCall(K.PAUSE_MS, () => {
          if (seq !== this.knifeSeq) return;
          g.phase = "tapCut";
          this.tweens.add({
            targets: stroke,
            k: 1,
            duration: K.CUT_MS,
            ease: Phaser.Math.Easing.Sine.InOut,
            onUpdate: followStroke,
            onComplete: () => {
              if (seq !== this.knifeSeq) return;
              // Blade at contact — the actual cut happens here (§9/§12's "thunk").
              const stepBefore = this.stepIndex;
              this.commitCut(cut, { velocity: 0.55, inputMode: "tap" });
              const stepDone = this.stepIndex !== stepBefore || !!this.pendingRecipePayload;
              g.phase = "tapImpact";
              // A beat with the blade resting in the cut, then the lift.
              this.tweens.add({
                targets: stroke,
                k: 1,
                duration: K.IMPACT_MS,
                onComplete: () => {
                  if (seq !== this.knifeSeq) return;
                  g.phase = "tapRetract";
                  // Chop stays low, poised right where it just struck —
                  // never sails back out to the far idle-beside-board
                  // pose between strikes the way Slice does (§"rhythmic,
                  // repeated strikes" — reads as chop-chop-chop, not a
                  // series of separate deliberate slices).
                  // The knife lifts off the cut and stays poised on it,
                  // ready for the next cut, instead of going back to the
                  // board. When this cut finished the step, it is laid
                  // down flat on its rest pose.
                  const retract = stepDone ? { ...this.idleKnifePose(), sign: 1 } : prep;
                  if (stepDone) g.targetSquash = 1;
                  this.tweens.add({
                    targets: g,
                    x: retract.x,
                    y: retract.y,
                    rot: retract.rot,
                    dirSign: retract.sign,
                    duration: K.RETRACT_MS,
                    ease: Phaser.Math.Easing.Sine.InOut,
                    onComplete: () => {
                      if (seq !== this.knifeSeq) return;
                      g.phase = "idle";
                      g.targetRot = retract.rot;
                      this.tapBusy = false;
                      // Exactly one buffered tap replays now (§17) —
                      // never more, and never mid-animation.
                      if (this.queuedTap) {
                        const q = this.queuedTap;
                        this.queuedTap = null;
                        // Re-validated exactly like a fresh tap: the queued
                        // tap only ever becomes a cut on a step that still
                        // wants one and an ingredient that may be cut.
                        if (
                          !this.pendingRecipePayload &&
                          !this.cutBlockedUntilPeeled() &&
                          this.technique.interactionMode === "cut" &&
                          this.cuts.length - this.stepCutsAtStart < this.requiredCuts
                        )
                          this.runTapCut(q.x, q.y);
                      }
                    },
                  });
                },
              });
            },
          });
        });
      },
    });
  }

  /**
   * Smash's own one-shot press sequence: PREP (lift) -> PRESS (plunge) ->
   * a HOLD beat at full compression (the "thunk", and the moment the
   * piece visually flattens) -> RELEASE (knife lifts away). One
   * decisive press, time-driven start to finish — never rapid tapping,
   * never a QTE (§"Smash must remain calm"). No Cut object is ever
   * created; the single whole-ingredient piece just gets squashed via a
   * scale tween, then the step advances.
   */
  private runSmash(x: number, y: number): void {
    this.smashBusy = true;
    const seq = ++this.knifeSeq;
    const w = this.scale.width;
    const prepX = x;
    const prepY = this.ingCy - this.ingRy - SMASH.PREP_ABOVE_FRAC * w;

    if (!this.knife)
      this.knife = {
        ...this.idleKnifePose(),
        targetRot: 0,
        dirSign: 1,
        dirLatch: null,
        rotInit: true,
        phase: "idle",
        enterT: this.time.now,
        exitT: 0,
      };
    const g = this.knife;
    g.dirSign = 1;
    g.phase = "tapPrep";
    const img = this.pieceImages.get(this.pieces[0]!);

    this.tweens.add({
      targets: g,
      x: prepX,
      y: prepY,
      rot: 0,
      duration: SMASH.PREP_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        if (seq !== this.knifeSeq) return;
        g.phase = "tapCut";
        this.tweens.add({
          targets: g,
          x,
          y: this.ingCy,
          duration: SMASH.PRESS_MS,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => {
            if (seq !== this.knifeSeq) return;
            // Impact — the actual smash happens here.
            AudioManager.playIngredientSlice(
              this.ingredientId,
              1,
              SMASH.HOLD_MS,
              this.knifeStats.audio.pitchMult,
              this.knifeStats.audio.gainMult,
            );
            this.boardNudge();
            this.spawnSmashBurst(x, this.ingCy);
            if (img) {
              // A tiny hitstop before the squash actually plays — a beat
              // of "thunk", not a freeze (same trick tap-cut's own
              // hitstop uses), so the press reads as landing rather than
              // just scaling smoothly.
              this.tweens.add({
                targets: img,
                scaleX: SMASH.SQUASH_X,
                scaleY: SMASH.SQUASH_Y,
                duration: SMASH.PRESS_MS * 0.6,
                delay: 30,
                ease: Phaser.Math.Easing.Quadratic.Out,
              });
            }
            g.phase = "tapImpact";
            this.time.delayedCall(SMASH.HOLD_MS, () => {
              if (seq !== this.knifeSeq) return;
              g.phase = "tapRetract";
              const idle = this.idleKnifePose();
              this.tweens.add({
                targets: g,
                x: idle.x,
                y: idle.y,
                rot: idle.rot,
                duration: SMASH.RELEASE_MS,
                ease: Phaser.Math.Easing.Sine.InOut,
                onComplete: () => {
                  if (seq !== this.knifeSeq) return;
                  g.phase = "idle";
                  g.targetRot = idle.rot;
                  this.smashBusy = false;
                  this.advanceStepOrFinish();
                },
              });
            });
          },
        });
      },
    });
  }

  /**
   * Rings' own tap sequence (Onion → Peel → Halve → Rings only) — the
   * SAME PREP→PRESS→IMPACT→RETRACT choreography family as runSmash
   * (single tap, time-driven once started), but impact peels one
   * concentric ring band off the current pieces (peelOneRingLayer)
   * instead of squashing. requiredCuts (RINGS.RING_COUNT) taps in total;
   * advanceStepOrFinish only fires once every ring has been shed.
   */
  private runRingCut(x: number, y: number): void {
    this.ringBusy = true;
    const seq = ++this.knifeSeq;
    const w = this.scale.width;
    const prepX = x;
    const prepY = this.ingCy - this.ingRy - RINGS.PREP_ABOVE_FRAC * w;

    if (!this.knife)
      this.knife = {
        ...this.idleKnifePose(),
        targetRot: 0,
        dirSign: 1,
        dirLatch: null,
        rotInit: true,
        phase: "idle",
        enterT: this.time.now,
        exitT: 0,
      };
    const g = this.knife;
    g.dirSign = 1;
    g.phase = "tapPrep";

    this.tweens.add({
      targets: g,
      x: prepX,
      y: prepY,
      rot: 0,
      duration: RINGS.PREP_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        if (seq !== this.knifeSeq) return;
        g.phase = "tapCut";
        this.tweens.add({
          targets: g,
          x,
          y: this.ingCy,
          duration: RINGS.PRESS_MS,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => {
            if (seq !== this.knifeSeq) return;
            // Impact — the ring actually peels away here. Record how close
            // the TAP itself landed to the target band's own midline
            // before peelOneRingLayer mutates ringRadiusFrac out from
            // under it — this is what makes tap position matter for
            // grading, without changing what actually gets removed (still
            // always exactly one band — Law 1, no failure).
            this.recordRingTapAccuracy(x, y);
            AudioManager.playIngredientSlice(
              this.ingredientId,
              0.7,
              RINGS.HOLD_MS,
              this.knifeStats.audio.pitchMult,
              this.knifeStats.audio.gainMult,
            );
            this.boardNudge();
            this.spawnPeelBurst(x, this.ingCy); // same restrained flourish Peel's own completion uses — a ring lifting away reads the same way a strip of skin does
            this.peelOneRingLayer();
            this.redrawGuides(); // dims the boundary just consumed — same per-cut refresh commitCut's own guide redraw already does
            g.phase = "tapImpact";
            this.time.delayedCall(RINGS.HOLD_MS, () => {
              if (seq !== this.knifeSeq) return;
              g.phase = "tapRetract";
              const idle = this.idleKnifePose();
              this.tweens.add({
                targets: g,
                x: idle.x,
                y: idle.y,
                rot: idle.rot,
                duration: RINGS.RELEASE_MS,
                ease: Phaser.Math.Easing.Sine.InOut,
                onComplete: () => {
                  if (seq !== this.knifeSeq) return;
                  g.phase = "idle";
                  g.targetRot = idle.rot;
                  this.ringBusy = false;
                  this.ringTapsDone++;
                  if (this.ringTapsDone >= this.requiredCuts) this.advanceStepOrFinish();
                },
              });
            });
          },
        });
      },
    });
  }

  /**
   * How close a ring tap landed to the CENTER of the band it was about to
   * remove, normalized so 0 = dead center, ±1 = right at the band's own
   * outer/inner edge. `tapFrac` is the tap's own radial distance from the
   * ingredient's center in the same normalized [0,1]-ish units
   * ringRadiusFrac already uses (an ellipse's own unit-circle distance —
   * Rings is onion-only today, always shape "ellipse", so this reads
   * `ingRx`/`ingRy` directly rather than going through the generic
   * Silhouette interface). Called BEFORE peelOneRingLayer mutates
   * ringRadiusFrac, so `fracOut` here is still the pre-tap outer edge.
   */
  private recordRingTapAccuracy(x: number, y: number): void {
    const fracOut = this.ringRadiusFrac;
    const fracIn = Math.max(0, fracOut - 1 / RINGS.RING_COUNT);
    const halfBand = (fracOut - fracIn) / 2 || 1;
    const targetMid = (fracOut + fracIn) / 2;
    const tapFrac = Math.hypot((x - this.ingCx) / this.ingRx, (y - this.ingCy) / this.ingRy);
    this.ringDeviations.push((tapFrac - targetMid) / halfBand);
    this.ringTapTimestamps.push(this.time.now);
  }

  /**
   * The actual ring-removal: shrinks `ringRadiusFrac` by one band and, for
   * every CURRENT piece (normally the 2 halves Halve left behind), swaps
   * its image for a smaller "remaining core" image and banks a separate
   * "just-removed ring band" image into `ringBandImages` (fed into
   * platedPieceImages by closeOutCurrentIngredient exactly like every
   * other finished piece). Once the core radius reaches ~0 there's
   * nothing left to shrink into — that piece's entry in `pieceImages` is
   * simply dropped rather than replaced with a degenerate image.
   */
  private peelOneRingLayer(): void {
    const fracOut = this.ringRadiusFrac;
    const fracIn = Math.max(0, fracOut - 1 / RINGS.RING_COUNT);
    this.ringRadiusFrac = fracIn;
    const reach = Math.max(this.ingRx, this.ingRy) * 6 + 200;

    for (const piece of this.pieces) {
      const old = this.pieceImages.get(piece);
      if (old) this.destroyPieceImage(old);
      this.pieceImages.delete(piece);

      const band = this.createRingBandImage(piece, fracOut, fracIn, reach);
      if (band) {
        band.setAlpha(0);
        this.tweens.add({
          targets: band,
          alpha: 1,
          duration: PEEL.REVEAL_MS,
          ease: Phaser.Math.Easing.Sine.Out,
        });
        this.nudgeRingPiece(band, piece);
        this.ringBandImages.push(band);
      }

      if (fracIn > 0.02) {
        const core = this.createRingBandImage(piece, fracIn, 0, reach);
        if (core) {
          core.setAlpha(1);
          this.pieceImages.set(piece, core);
        }
      }
    }
  }

  /** Renders one ring band (or the innermost remaining disc, when `fracIn` is 0) into its own small CanvasTexture — see textures/pieceTexture.ts's paintRingPieceTexture. */
  private createRingBandImage(
    piece: Piece,
    fracOut: number,
    fracIn: number,
    reach: number,
  ): Phaser.GameObjects.Image | null {
    const b = pieceBounds(piece.cons, this.silhouette) ?? {
      x0: this.ingCx - this.ingRx,
      y0: this.ingCy - this.ingRy,
      x1: this.ingCx + this.ingRx,
      y1: this.ingCy + this.ingRy,
      gx: this.ingCx,
      gy: this.ingCy,
    };
    const pad = 6; // see createPieceImage — same shared breathing room
    const x0 = b.x0 - pad;
    const y0 = b.y0 - pad;
    const w = Math.max(1, b.x1 - b.x0 + pad * 2);
    const h = Math.max(1, b.y1 - b.y0 + pad * 2);
    const key = `ring-${this.pieceSeq++}`;
    const tex = this.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
    if (!tex || !this.ingredientCanvas) return null;
    paintRingPieceTexture(
      tex.context,
      x0,
      y0,
      (ctx) => this.traceIngredientSilhouette(ctx),
      piece.cons,
      this.ingCx,
      this.ingCy,
      reach,
      this.ingredientCanvas,
      this.ingredientSourceOriginWorld,
      {
        cx: this.ingCx,
        cy: this.ingCy,
        rxOut: this.ingRx * fracOut,
        ryOut: this.ingRy * fracOut,
        rxIn: this.ingRx * fracIn,
        ryIn: this.ingRy * fracIn,
      },
    );
    tex.refresh();
    return this.add.image(x0, y0, key).setOrigin(0, 0).setDepth(20);
  }

  /** Same outward "slab parting" nudge settlePiece() gives a fresh cut piece, along the ORIGINAL half-plane piece's own centroid direction (a ring band is a subset of that half, so its outward direction is the same one). */
  private nudgeRingPiece(img: Phaser.GameObjects.Image, piece: Piece): void {
    const centroid = pieceCentroid(piece, this.silhouette);
    const vx = centroid.gx - this.ingCx;
    const vy = centroid.gy - this.ingCy;
    const m = Math.hypot(vx, vy) || 1;
    const offset = PIECE_SETTLE.SLAB_OFFSET_PX_FRAC * this.scale.width;
    this.tweens.add({
      targets: img,
      x: img.x + (vx / m) * offset,
      y: img.y + (vy / m) * offset,
      duration: PIECE_SETTLE.MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  private finishCut(path: RecordedPoint[]): void {
    if (this.cutBlockedUntilPeeled()) return;
    if (this.cuts.length - this.stepCutsAtStart >= this.requiredCuts) return;
    // 1. Dominant-extent axis pick, redirected to the unfinished set for a grid technique.
    const xs = path.map((p) => p.x);
    const ys = path.map((p) => p.y);
    const xExt = Math.max(...xs) - Math.min(...xs);
    const yExt = Math.max(...ys) - Math.min(...ys);
    const domAxis: Axis = xExt === yExt ? this.tapDefaultAxis() : xExt > yExt ? "h" : "v";
    const fitAxis = liveAxis(domAxis, this.technique.counts, this.cuts);

    // 2. Least-squares direction fit + angle-assist taper (§ ASSIST).
    const fit = fitStrokeDirection(path, fitAxis, this.ingCx, this.ingCy);
    let assistedSlope: number;
    if (fit.angInDeg <= ASSIST.ANGLE_SNAP_DEG) assistedSlope = 0;
    else if (fit.angInDeg < ASSIST.ANGLE_FREE_DEG) {
      const pull =
        (fit.angInDeg - ASSIST.ANGLE_SNAP_DEG) / (ASSIST.ANGLE_FREE_DEG - ASSIST.ANGLE_SNAP_DEG);
      assistedSlope = fit.slope * pull;
    } else assistedSlope = fit.slope;

    // 3. PERP_SNAP (dice) / PARALLEL_SNAP (julienne) direction resolution.
    const snapped = dirSnap(
      { parallelSnap: this.technique.parallelSnap, perpSnap: this.technique.perpSnap },
      this.cuts,
      fitAxis,
      assistedSlope,
      this.technique.counts,
    );
    const finalAxis = snapped?.axis ?? fitAxis;
    const finalSlope = snapped?.slope ?? assistedSlope;

    // Radial (Phase 7): position isn't a guide-slot at all — every radial
    // cut passes through the exact center regardless of slope (see
    // TechniqueDefinition.radialSnap's own doc). Steps 1-3 above already
    // fit the real stroke angle correctly (the same free-angle math
    // Julienne's own parallel-free path uses); only the POSITION differs.
    if (this.technique.radialSnap) {
      const cut: Cut = {
        axis: finalAxis,
        c: finalAxis === "h" ? this.ingCy : this.ingCx,
        slope: finalSlope,
      };
      const vel = Phaser.Math.Clamp(travelledVelocity(path) / (0.9 * this.scale.width), 0, 1);
      this.commitCut(cut, { velocity: vel, inputMode: "swipe" });
      return;
    }

    // 4. Julienne's guides don't exist until a direction is chosen — populate them now, once.
    this.ensureGuidesFor(finalAxis, finalSlope);

    // 5. Snap position to the nearest still-open guide slot on that axis.
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const target = interceptThrough(finalAxis, finalSlope, meanX, meanY, this.ingCx, this.ingCy);
    const guide = this.nearestUnusedGuide(finalAxis, target);
    if (!guide) return; // no room left on this axis — shouldn't happen given axisFull/liveAxis, but never crash on it
    this.usedGuide[finalAxis][guide.idx] = true;

    const cut: Cut = { axis: finalAxis, c: guide.c, slope: finalSlope };
    const vel = Phaser.Math.Clamp(travelledVelocity(path) / (0.9 * this.scale.width), 0, 1);
    this.commitCut(cut, { velocity: vel, inputMode: "swipe" });
  }

  /**
   * The one cutting pipeline every input mode funnels through (§17/§29)
   * — finishCut (swipe) and runTapCut (tap) both resolve their own
   * axis/slope/position, then hand a fully-specified Cut here. From this
   * point on nothing downstream knows or cares which input produced it:
   * push the cut, the Perfect-Slice check, piece splitting, board nudge,
   * guide redraw, audio, the CUT_COMPLETED payload (tagged with
   * `inputMode` only so the UI can withhold tap's precision toast — the
   * grading math itself is identical either way), and — once every
   * required cut has landed — the whole-run grade and the handoff to
   * plating.
   */
  private commitCut(cut: Cut, opts: { velocity: number; inputMode: "tap" | "swipe" }): void {
    const now = this.time.now;
    this.cuts.push(cut);
    this.cutTimestamps.push(now);

    // Perfect Slice is a precision reward — swipe-only (§5's "no
    // precision score for tap cut" covers this too, not just the visible
    // toast: tap's free placement landing near an ideal division by
    // coincidence shouldn't fire a skill celebration for a gesture with
    // no aim involved).
    const perfect =
      opts.inputMode === "swipe" &&
      !this.perfectUsed &&
      this.cuts.length >= PERFECT.PERFECT_MIN_CUT_INDEX &&
      isPerfectCut(cut.c, this.nearestIdealDivision(cut.axis, cut.c));
    if (perfect) this.perfectUsed = true;

    this.markCutCommitted();
    // Tap gets the SAME hitstop mechanic Perfect Slice already uses — a
    // short delay before the piece-reveal tween starts (§12's "thunk,
    // not a freeze") — just lighter, so Perfect Slice's own hitstop
    // stays the strongest beat. A normal swipe cut is unchanged (no delay).
    // Chop uses its own (lighter still) hitstop — see CHOP_KNIFE's doc.
    const hitstopMs = opts.inputMode === "tap" ? this.tapTiming().HITSTOP_MS : 0;
    // The first real cut on this ingredient — and only the first, since
    // every cut after this one crops from a canvas that already has the
    // flesh baked in — repaints the ONE shared texture before applyCut()
    // below builds the new pieces' images from it. This is what turns a
    // SKIN_KEEP ingredient's `hasCut` flag (see EllipseRenderer/
    // TaperRenderer.paint's own doc) from "always false" into "true from
    // here on": redrawIngredientTexture() itself has no per-frame
    // `cuts.length` awareness the way the source's `skinAlpha` does, so
    // the state transition has to be repainted explicitly, once, right as
    // it happens. A no-op repaint (same pixels) for every ingredient that
    // doesn't read `hasCut` at all.
    if (this.cuts.length === 1) this.redrawIngredientTexture();
    // The recipe's very last cut (a single-cut technique like Halve makes
    // this the FIRST cut too) — its pieces are handed straight to the
    // plating handoff by advanceStepOrFinish -> closeOutCurrentIngredient
    // -> finishRecipeNow, with no next ingredient to make room for. They
    // must be solidly visible the instant the cut lands, not still fading
    // in over applyCut()'s 90 ms reveal: closeOutCurrentIngredient no
    // longer fades them away for the plating path (see its own doc), so
    // the reveal tween would be the ONLY thing driving their alpha up —
    // and it is frame-gated, so a stalled frame (backgrounded tab, memory
    // pressure) leaves the board reading empty until startPlating's
    // delayedCall finally fires. `immediate` skips the reveal entirely for
    // this one cut; every other cut is unchanged.
    const isFinalCut =
      this.cuts.length - this.stepCutsAtStart >= this.requiredCuts &&
      this.stepIndex + 1 >= this.steps.length;
    this.applyCut(cut, perfect, hitstopMs, isFinalCut);
    this.boardNudge();
    this.redrawGuides();

    const cutPoint = cut.axis === "h" ? { x: this.ingCx, y: cut.c } : { x: cut.c, y: this.ingCy };
    AudioManager.playIngredientSlice(
      this.ingredientId,
      opts.velocity,
      CUT_FEEL.CUT_REVEAL_MS,
      this.knifeStats.audio.pitchMult,
      this.knifeStats.audio.gainMult,
    );
    // Chop's own tiny impact tick — reinforces the rhythmic "chop chop
    // chop" feel (§"make the chop animation better"). Deliberately
    // lighter than Smash's burst (chop fires many times per ingredient,
    // Smash once) and never applied to Slice/Dice/Julienne — this is
    // Chop's own distinguishing beat, not a blanket effect.
    if (this.technique.knifeProfile === "chop") {
      this.spawnChopBurst(cutPoint.x, cutPoint.y);
    } else {
      // Phase 13A — a regular Slice/Dice/Julienne/Halve/Radial cut had NO
      // particle feedback at all (only Peel/Smash/Chop/Perfect-Slice did),
      // even though this is the technique the player uses most. A couple
      // of tiny, ingredient-toned flecks read as "a bit of juice/crumb"
      // without competing with Perfect Slice's own golden sparkle — see
      // cutFleckColor()'s own doc for why this stays a 2-tone switch
      // rather than a new per-ingredient data field.
      this.spawnCutFleck(cutPoint.x, cutPoint.y);
    }

    // visibleSeamSpanFor (§13): this feeds the CutResultPanel/KnifeReport
    // comparison diagram — a purely visual overlay — so it should hug
    // the real silhouette too, same as the guide/committed-seam marks.
    const idealSpan = visibleSeamSpanFor({ axis: cut.axis, c: cut.c, slope: 0 }, this.silhouette);
    const playerSpan = visibleSeamSpanFor(cut, this.silhouette);
    const proxyQuality = proxyCutQuality(0, 0, 1); // guide-snapped commit: always exactly on-guide (see class doc)
    const payload: CutCompletedPayload = {
      // Relative to the CURRENT STEP, not the whole (possibly
      // multi-ingredient) session — matches requiredCuts/totalCuts below
      // and what the HUD's pip row should show for a chain/multi-step run.
      cutIndex: this.cuts.length - this.stepCutsAtStart,
      totalCuts: this.requiredCuts,
      axis: cut.axis,
      ideal: this.toPercentPath(idealSpan),
      player: this.toPercentPath(playerSpan),
      proxyQuality,
      isPerfect: perfect,
      inputMode: opts.inputMode,
    };
    this.bus.emit(EVT.CUT_COMPLETED, payload);

    if (perfect) this.playPerfectSlice(cutPoint.x, cutPoint.y);

    if (this.cuts.length - this.stepCutsAtStart >= this.requiredCuts) this.advanceStepOrFinish();
  }

  /**
   * Grades the run and starts the plating handoff — knifecraft.html
   * finishRecipe(): the score is computed here, but RECIPE_COMPLETED
   * doesn't fire yet, only after the plate flies in and the chef's
   * hands take it away (see startPlating). Split out of commitCut so
   * `runTapCut` can also call it directly when a continuous-tap
   * ingredient genuinely runs out of room before reaching its nominal
   * `requiredCuts` target — see that call site's own comment.
   */
  /**
   * §"multi-ingredient grading" — by the time this runs, `closeOutCurrentIngredient`
   * has already banked every step's own {cuts, silhouette, band} segment
   * (a single-step session just has one). Each segment is graded with
   * the EXACT SAME computeGrade() math as before — the "multi-ingredient"
   * part is only that this function now averages N segments' results
   * instead of grading one fixed `this.cuts`/`this.silhouette` pair. A
   * peel/smash-only segment never gets pushed (no Cut objects exist for
   * those — see closeOutCurrentIngredient), so an all-peel/smash session
   * (Level 9) falls back to a fixed pleasant result: there's no cut-
   * accuracy concept to grade there, and Law 4 already de-emphasizes the
   * number itself (see OrderComplete/KnifeReport's presentation).
   */
  private finishRecipeNow(): void {
    const graded = this.closedSegments.map((seg) =>
      seg.ringDeviations
        ? computeRingsGrade(seg.ringDeviations, seg.ringTimestamps ?? [])
        : seg.radial
          ? computeRadialGrade(seg.cuts, seg.timestamps)
          : computeGrade(seg.cuts, seg.timestamps, seg.silhouette, seg.bandFor, seg.tolOverride),
    );
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const grade = graded.length
      ? {
          evenness: Math.round(mean(graded.map((g) => g.evenness))),
          consistency: Math.round(mean(graded.map((g) => g.consistency))),
          rhythmBonus: Math.round(mean(graded.map((g) => g.rhythmBonus))),
          overall: Math.round(mean(graded.map((g) => g.overall))),
          qualityLabel: qualityFor(Math.round(mean(graded.map((g) => g.overall)))),
        }
      : {
          evenness: 90,
          consistency: 90,
          rhythmBonus: 5,
          overall: 90,
          qualityLabel: qualityFor(90),
        };
    const idealPaths = this.closedSegments.flatMap((seg) =>
      seg.cuts.map((c) =>
        this.toPercentPath(visibleSeamSpanFor({ axis: c.axis, c: c.c, slope: 0 }, seg.silhouette)),
      ),
    );
    const playerPaths = this.closedSegments.flatMap((seg) =>
      seg.cuts.map((c) => this.toPercentPath(visibleSeamSpanFor(c, seg.silhouette))),
    );
    this.pendingRecipePayload = { ...grade, idealPaths, playerPaths };
    this.time.delayedCall(PLATING_START_DELAY_MS, () => this.startPlating());
  }

  /** The nearest ideal (evenly-divided) position on this axis — used only for the Perfect Slice check. */
  private nearestIdealDivision(axis: Axis, c: number): number {
    const b = this.bandFor(axis);
    const ideals = idealPositions(b.lo, b.hi, this.countFor(axis));
    let best = ideals[0] ?? c;
    let bestDist = Infinity;
    for (const v of ideals) {
      const d = Math.abs(v - c);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  private toPercentPath(span: { x0: number; y0: number; x1: number; y1: number }) {
    return {
      points: [
        { x: (span.x0 / this.scale.width) * 100, y: (span.y0 / this.scale.height) * 100 },
        { x: (span.x1 / this.scale.width) * 100, y: (span.y1 / this.scale.height) * 100 },
      ],
    };
  }

  private markCutCommitted(): void {
    // Clear first: the in-stroke preview line (redrawSeamPreview, drawn at
    // the swipe's own angle while dragging) is still in this Graphics'
    // buffer at commit time, and only gets cleared on the NEXT drag's
    // first pointermove — for the last cut of a recipe, there is no next
    // drag, so that stray diagonal line would otherwise sit there
    // permanently instead of being replaced by the clean committed mark.
    this.seamGfx.clear();
    this.redrawCommittedSeams();
  }

  /**
   * Ported from knifecraft.html's rebuildPieces(): every existing piece
   * the new cut actually crosses splits into two; pieces it misses stay
   * whole. Only the pieces that changed get new Images (identity-diffed
   * against the previous piece list — untouched pieces are the SAME
   * object reference, so this is cheap and exact).
   */
  private applyCut(cut: Cut, perfect: boolean, hitstopMs = 0, immediate = false): void {
    const before = this.pieces;
    const after = rebuildPieces(before, cut, this.silhouette);
    this.pieces = after;

    const removed = before.filter((p) => !after.includes(p));
    const added = after.filter((p) => !before.includes(p));

    for (const p of removed) {
      const img = this.pieceImages.get(p);
      if (img) this.destroyPieceImage(img);
      this.pieceImages.delete(p);
    }

    const addedImages = added.map((p) => {
      const img = this.createPieceImage(p);
      this.pieceImages.set(p, img);
      return img;
    });

    // The recipe's final cut (see commitCut's `isFinalCut`): no progressive
    // reveal and no settle nudge — the pieces go straight to the plating
    // handoff, so they must be fully opaque the moment they exist rather
    // than mid-fade. createPieceImage() starts them at alpha 0; snap them
    // up now. For a single-cut technique (Halve) this is also the first
    // cut, so without this the 90 ms reveal has not run a single frame by
    // the time closeOutCurrentIngredient banks them for plating.
    if (immediate) {
      for (const img of addedImages) img.setAlpha(1);
      return;
    }

    // The seam opens under the blade progressively — skin resists, then
    // glides (the ingredient's resistance curve) — reveal the newly-split
    // pieces with that SAME timing, as a fade (a crop-wipe doesn't
    // generalize to an arbitrary polygon the way it did for a single
    // horizontal band).
    const resistance = this.ingredient.resistance;
    const revealMs = Math.max(CUT_FEEL.CUT_REVEAL_MIN_MS, CUT_FEEL.CUT_REVEAL_MS);
    const state = { k: 0 };
    const applyReveal = () => {
      const eased = revealEase(state.k, resistance);
      for (const img of addedImages) img.setAlpha(eased);
    };
    const tweenConfig: Phaser.Types.Tweens.TweenBuilderConfig = {
      targets: state,
      k: 1,
      duration: revealMs,
      onUpdate: applyReveal,
      onComplete: () => {
        // Proteins only (`depth.spread` present): fan pieces along the
        // cut's own normal instead of purely radially — see
        // settleProteinPiece's own doc. Every other ingredient keeps
        // calling settlePiece() unchanged.
        const settle = this.ingredient.depth?.spread
          ? (p: Piece) => this.settleProteinPiece(p)
          : (p: Piece) => this.settlePiece(p);
        for (const p of added) settle(p);
      },
    };
    // Perfect Slice's own hitstop always wins if both apply (it never
    // will in practice — perfect is gated to swipe only, see commitCut —
    // but the priority is explicit rather than accidental).
    const delay = perfect ? PERFECT.HITSTOP_MS : hitstopMs;
    if (delay > 0) tweenConfig.delay = delay;
    this.tweens.add(tweenConfig);
  }

  /**
   * knifecraft.html rebuildPieces()/animOffsets(): a cut piece does NOT
   * fall, stack, or rotate here — it parts from the ingredient's center
   * by SLAB_OFFSET_PX (4px in the reference's design canvas — a knife-
   * width "give", not a drop) along its OWN true centroid direction, and
   * eases to rest over PIECE_SETTLE_MS. No rotation: rotating a piece by
   * the cut's angle turned any diagonal or grid cut into visibly crossing
   * shapes — orientation stays untouched until the plate-flight animation
   * fans pieces out (see startPlating()).
   */
  private settlePiece(piece: Piece): void {
    const img = this.pieceImages.get(piece);
    if (!img) return;
    const centroid = pieceCentroid(piece, this.silhouette);
    const vx = centroid.gx - this.ingCx;
    const vy = centroid.gy - this.ingCy;
    const m = Math.hypot(vx, vy) || 1;
    const offset = PIECE_SETTLE.SLAB_OFFSET_PX_FRAC * this.scale.width;
    this.tweens.add({
      targets: img,
      x: img.x + (vx / m) * offset,
      y: img.y + (vy / m) * offset,
      duration: PIECE_SETTLE.MS,
      ease: Phaser.Math.Easing.Sine.Out, // overshoot-free, per the reference's own comment
    });
  }

  /**
   * Protein-only (`ingredient.depth.spread` present): the same radial
   * "give" settlePiece() gives every piece, PLUS knifecraft.html's
   * `spreadPieces()` (`:4230`) fan-out along each committed cut set's
   * own normal, proportional to how far this piece's centroid sits from
   * that set's own midline — an affine expansion, so a row of parallel
   * slices actually parts (radial alone pushes same-side neighbours the
   * same way, so their shared gap never opens) while a fan of wedges is
   * unaffected (their own midline sits at the ingredient's own centre).
   *
   * Scoped to the piece being settled right now, using the CURRENT full
   * piece list's projection range — an intentional simplification of
   * the source's own "every piece, every cut" full re-spread, made
   * specifically to avoid touching `settlePiece()`, which all 52
   * ingredients share (see this file's own hard-firewall convention for
   * shared helpers). Pieces from an earlier cut in the same axis group
   * are not retroactively re-nudged when a later parallel cut lands;
   * each newly-settled piece is still correctly fanned relative to the
   * group as it exists at that moment.
   */
  private settleProteinPiece(piece: Piece): void {
    const img = this.pieceImages.get(piece);
    if (!img) return;
    const centroid = pieceCentroid(piece, this.silhouette);
    const vx = centroid.gx - this.ingCx;
    const vy = centroid.gy - this.ingCy;
    const m = Math.hypot(vx, vy) || 1;
    const offset = PIECE_SETTLE.SLAB_OFFSET_PX_FRAC * this.scale.width;
    let dx = (vx / m) * offset;
    let dy = (vy / m) * offset;
    const spread = this.ingredient.depth?.spread;
    if (spread && this.cuts.length) {
      const allPieces = [...this.pieceImages.keys()];
      for (const axis of ["h", "v"] as const) {
        const c0 = this.cuts.find((c) => c.axis === axis);
        if (!c0) continue;
        const mm = Math.hypot(1, c0.slope);
        const nx = axis === "h" ? -c0.slope / mm : 1 / mm;
        const ny = axis === "h" ? 1 / mm : -c0.slope / mm;
        const proj = allPieces.map((p) => {
          const c = pieceCentroid(p, this.silhouette);
          return (c.gx - this.ingCx) * nx + (c.gy - this.ingCy) * ny;
        });
        if (!proj.length) continue;
        const mid = (Math.min(...proj) + Math.max(...proj)) / 2;
        const thisProj = (centroid.gx - this.ingCx) * nx + (centroid.gy - this.ingCy) * ny;
        const d = (thisProj - mid) * spread;
        dx += nx * d;
        dy += ny * d;
      }
    }
    this.tweens.add({
      targets: img,
      x: img.x + dx,
      y: img.y + dy,
      duration: PIECE_SETTLE.MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  /** The skin color a Peel fleck should read as — each peelable ingredient has its own. Pineapple/Watermelon/Coconut ported verbatim from knifecraft.html's own `PEEL_TONE` map (the exact three ids `peelable` resolves to there). */
  private skinFleckColor(): number {
    switch (this.ingredientId) {
      case "onion":
        return 0x7c2f58;
      case "potato":
        return 0x8c6640;
      case "garlic":
        return 0xd9c093;
      case "pineapple":
        return 0x8a6a2a;
      case "watermelon":
        return 0x2c6531;
      case "coconut":
        return 0x8a5a2a;
      default:
        return PALETTE.ivory;
    }
  }

  /**
   * A small curl of skin flicking away — Peel's own tactile feedback,
   * distinct from the generic ivory sparkle (§"peeling needs better
   * animation"): a thin ingredient-colored sliver, angled across the
   * drag direction, that curls (rotates through ~140deg), drifts a short
   * distance outward, and fades — reading as a real strip of peel
   * lifting off rather than a generic dust mote. Still restrained (1-2
   * per call, never a shower).
   */
  private spawnPeelFleck(x: number, y: number, dragAngle: number): void {
    const color = this.skinFleckColor();
    const n = Phaser.Math.Between(1, 2);
    for (let i = 0; i < n; i++) {
      const jitter = Phaser.Math.FloatBetween(-0.5, 0.5);
      const fleck = this.add.ellipse(
        x + Phaser.Math.Between(-6, 6),
        y + Phaser.Math.Between(-6, 6),
        9,
        3.2,
        color,
        0.85,
      );
      fleck.setRotation(dragAngle + jitter);
      fleck.setDepth(22);
      const driftAngle = dragAngle + Math.PI / 2 + jitter; // curls away perpendicular to the drag, like a real peel strip
      const driftPx = Phaser.Math.Between(12, 22);
      this.tweens.add({
        targets: fleck,
        x: fleck.x + Math.cos(driftAngle) * driftPx,
        y: fleck.y + Math.sin(driftAngle) * driftPx - 4,
        rotation: fleck.rotation + Phaser.Math.FloatBetween(1.8, 2.6),
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 0,
        duration: 380,
        ease: Phaser.Math.Easing.Sine.Out,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  /** A ring of skin flecks bursting outward from center — Peel's completion flourish, on top of the existing texture crossfade. */
  private spawnPeelBurst(cx: number, cy: number): void {
    const petals = 10;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      this.spawnPeelFleck(
        cx + Math.cos(a) * this.ingRx * 0.3,
        cy + Math.sin(a) * this.ingRy * 0.3,
        a,
      );
    }
  }

  /**
   * Smash's own impact flourish (§"make the... smash animation better"):
   * a low, mostly-sideways puff of flesh-colored flecks at the press
   * point — reads as a press/thunk, deliberately NOT Perfect Slice's
   * full-circle golden ring (that's a precision-reward beat; this is a
   * calm, satisfying "thud"). Still restrained — one burst, no shower.
   */
  private spawnSmashBurst(x: number, y: number): void {
    const color = this.skinFleckColor();
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.15 + (Math.PI * 0.7 * i) / (n - 1); // a low fan, mostly downward/outward, not a full ring
      const dist = Phaser.Math.Between(16, 30);
      const fleck = this.add.ellipse(x, y, 5, 5, color, 0.75);
      fleck.setDepth(22);
      this.tweens.add({
        targets: fleck,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist * 0.5,
        scaleX: 0.3,
        scaleY: 0.3,
        alpha: 0,
        duration: 320,
        ease: Phaser.Math.Easing.Quadratic.Out,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  /**
   * The cut-fleck tint for a regular Slice/Dice/Julienne/Halve/Radial cut
   * (§Phase 13A "subtle juice/crumb where appropriate"). Deliberately a
   * small two-tone switch, not a new per-ingredient data field: juicy
   * produce (tomato, strawberry, pepper, orange, apple) reads as a warm
   * droplet; everything else falls back to the same pale ivory tone the
   * board/guides already use, reading as a light crumb/dust fleck.
   */
  private cutFleckColor(): number {
    switch (this.ingredientId) {
      case "tomato":
      case "strawberry":
      case "pepper":
      case "orange":
      case "apple":
        return 0xe8654a;
      default:
        return PALETTE.ivory;
    }
  }

  /**
   * A regular cut had NO particle feedback at all before this (only Peel/
   * Smash/Chop/Perfect-Slice did) despite being the technique the player
   * uses most (§Step 6). Two tiny flecks, a quick downward settle — never
   * a shower, and deliberately smaller/fewer than Smash's or even Chop's
   * own burst since Slice/Dice/Julienne can fire up to ~20 times on one
   * ingredient (§Step 14 "avoid huge particle counts").
   */
  private spawnCutFleck(x: number, y: number): void {
    const color = this.cutFleckColor();
    for (let i = 0; i < 2; i++) {
      const a = Math.PI / 2 + Phaser.Math.FloatBetween(-0.6, 0.6); // mostly downward — settling, not flying
      const dist = Phaser.Math.Between(6, 14);
      const fleck = this.add.circle(x + Phaser.Math.Between(-4, 4), y, 2.2, color, 0.7);
      fleck.setDepth(22);
      this.tweens.add({
        targets: fleck,
        x: fleck.x + Math.cos(a) * dist,
        y: fleck.y + Math.sin(a) * dist,
        scaleX: 0.3,
        scaleY: 0.3,
        alpha: 0,
        duration: 220,
        ease: Phaser.Math.Easing.Quadratic.Out,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  /** Chop's tiny per-strike tick — a quick, small flesh-colored puff, lighter than Smash's burst since Chop fires many times per ingredient. */
  private spawnChopBurst(x: number, y: number): void {
    const color = this.skinFleckColor();
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + Phaser.Math.FloatBetween(-0.9, 0.9);
      const dist = Phaser.Math.Between(8, 16);
      const fleck = this.add.ellipse(x, y, 3.5, 3.5, color, 0.7);
      fleck.setDepth(22);
      this.tweens.add({
        targets: fleck,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        scaleX: 0.3,
        scaleY: 0.3,
        alpha: 0,
        duration: 200,
        ease: Phaser.Math.Easing.Quadratic.Out,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  /** A few tiny fading circles at the cut point — restrained, not a particle explosion. */
  private spawnSparkle(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const dot = this.add.circle(
        x + Phaser.Math.Between(-14, 14),
        y + Phaser.Math.Between(-4, 4),
        2,
        PALETTE.ivory,
        0.8,
      );
      this.tweens.add({
        targets: dot,
        alpha: 0,
        y: dot.y - Phaser.Math.Between(8, 16),
        duration: 420 + i * 60,
        ease: Phaser.Math.Easing.Sine.Out,
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** knifecraft.html CONFIG.physics — felt, never consciously noticed. */
  private boardNudge(): void {
    const px = BOARD_NUDGE.PX_FRAC * this.knifeStats.animation.weightMult * this.scale.width;
    this.tweens.add({
      targets: this.boardImg,
      y: { from: px, to: 0 },
      duration: BOARD_NUDGE.MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  /** The one hero moment per recipe: hitstop, spark, chime (§13). */
  private playPerfectSlice(x: number, y: number): void {
    AudioManager.playChime();
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const dot = this.add.circle(x, y, 2.5, PALETTE.gold, 1);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        duration: 480,
        delay: PERFECT.HITSTOP_MS,
        ease: Phaser.Math.Easing.Cubic.Out,
        onComplete: () => dot.destroy(),
      });
    }
    this.spawnSparkle(x, y);
  }

  /**
   * knifecraft.html startPlating()/animPlating(): pieces fly from where
   * the last cut left them to a fan arrangement on the plate, staggered
   * ~90ms apart, each on a 620ms ease-out flight with a small arc — never
   * a straight-line pop. Chimes climb a pentatonic ladder as each piece
   * lands. PLATING_COMPLETED and the hands (which reach in slightly
   * BEFORE the last piece settles) are scheduled from this fixed
   * deadline, not from the completion callback.
   */
  private startPlating(): void {
    this.bus.emit(EVT.PLATING_STARTED);
    const w = this.scale.width;
    const arcPx = PLATING.PLATE_ARC_FRAC * w;

    // Production plating redesign (Phase 3/4) + "shared-destination plating
    // composition fix": ONE PLATE PER DESTINATION, not per ingredient.
    // Two grouping levels, both built from platedPieceMeta (parallel to
    // platedPieceImages, recorded by closeOutCurrentIngredient):
    //
    // 1. INSTANCE — one per closeOutCurrentIngredient call (`instanceSeq`),
    //    i.e. one per independently-prepared ingredient/technique. Two
    //    chicken preparations (one sliced, one diced) are ALWAYS two
    //    instances, even sharing an ingredientId — this is the exact
    //    "preparation instance" identity the chainBreak fix established,
    //    completely unaffected by anything below.
    //
    // 2. DESTINATION — `platedPieceMeta[i].destination` (PrepStep.destination,
    //    threaded from the recipe/level's own component.destinationIds via
    //    stepsForRecipe.ts/Preparation.tsx — the SAME name-joining already
    //    used for "Maya's Plate & Daniel's Plate"). Root cause of the bug
    //    this fixes: the previous grouping key was `ingredientId` alone,
    //    which could neither (a) split ONE ingredient's two instances
    //    across two real destinations (a chicken sliced for the plate and
    //    a fresh one diced for the bowl got dumped onto one ingredient-
    //    keyed plate, arranged with only the LAST technique's layout) nor
    //    (b) combine several DIFFERENT ingredients that genuinely share
    //    one destination (three toppings for one shared antipasto plate
    //    rendered as three separate mini-plates instead of one composition).
    //    Falls back to "" when a level/recipe never sets a destination
    //    name, so every such step shares one implicit destination — the
    //    exact single-plate behavior those levels already had.
    const pieceImages = this.platedPieceImages;
    const meta = this.platedPieceMeta;
    const instanceOrder: number[] = [];
    const instancePieces = new Map<number, Phaser.GameObjects.Image[]>();
    const instanceTechnique = new Map<number, TechniqueId>();
    const instanceIngredient = new Map<number, IngredientId>();
    const instanceDestination = new Map<number, string>();
    pieceImages.forEach((piece, i) => {
      const m = meta[i];
      const instanceSeq = m?.instanceSeq ?? -1;
      if (!instancePieces.has(instanceSeq)) {
        instanceOrder.push(instanceSeq);
        instancePieces.set(instanceSeq, []);
        instanceTechnique.set(instanceSeq, m?.technique ?? this.technique.id);
        instanceIngredient.set(instanceSeq, m?.ingredientId ?? this.ingredientId);
        instanceDestination.set(instanceSeq, m?.destination ?? "");
      }
      instancePieces.get(instanceSeq)!.push(piece);
    });
    const destinationOrder: string[] = [];
    const destinationInstances = new Map<string, number[]>();
    for (const instanceSeq of instanceOrder) {
      const destination = instanceDestination.get(instanceSeq)!;
      if (!destinationInstances.has(destination)) {
        destinationOrder.push(destination);
        destinationInstances.set(destination, []);
      }
      destinationInstances.get(destination)!.push(instanceSeq);
    }
    const plateCount = destinationOrder.length;

    // Grid layout (Phase 4: variable count, never hardcoded) — capped at 2
    // columns to fit the portrait board's width; a short first row absorbs
    // the remainder so 3 plates read as "one on top, two below" exactly
    // like 5 reads as "one, then two, then two" — the same rule at any n.
    const rows = Math.max(1, Math.ceil(plateCount / 2));
    const remainder = plateCount - 2 * (rows - 1);
    const perPlateScale =
      plateCount <= 1
        ? 1
        : plateCount === 2
          ? 0.62
          : Phaser.Math.Clamp(0.58 - (rows - 2) * 0.1, 0.32, 0.58);
    const baseRx = PLATING.PLATE_RX_FRAC * w * perPlateScale;
    const baseRy = PLATING.PLATE_RY_FRAC * w * perPlateScale;
    const gridCx = this.ingCx;
    const gridCy = this.ingCy + this.ingRy * 0.55 + PLATING.PLATE_DY_FRAC * w;
    const rowSpacingY = baseRy * 2 * 1.12;
    const colSpacingX = baseRx * 2 * 1.12;

    this.platePlates = destinationOrder.map((_, gi) => {
      const row = gi < remainder ? 0 : 1 + Math.floor((gi - remainder) / 2);
      const rowCount = row === 0 ? remainder : 2;
      const indexInRow = row === 0 ? gi : (gi - remainder) % 2;
      const cx = gridCx + (indexInRow - (rowCount - 1) / 2) * colSpacingX;
      const cy = gridCy + (row - (rows - 1) / 2) * rowSpacingY;
      return { cx, cy, rx: baseRx, ry: baseRy };
    });

    // Distribution/composition pass — see platingArrangement.ts's own
    // header doc for the full 4-step pipeline this implements (broad
    // count-aware raw layout -> composition bounds/center -> uniform fit
    // -> final per-piece safety clamp). Computed once per DESTINATION
    // (=one plate): every instance sharing that destination first gets its
    // OWN local composition (exactly the single-instance pipeline this
    // module already had — same technique-aware arrangement, own average
    // piece radius, own per-piece emergencyShrink), then those local
    // compositions are offset into side-by-side "slots" (same 2-col-max
    // grid rule as the plate-of-plates layout above, just sized to the
    // instances' own footprints) so multiple techniques stay visually
    // distinguishable rather than piling on top of each other — and ONLY
    // THEN is a single calculateCompositionBounds/fitCompositionToSafeRadius
    // pass run across ALL of that destination's pieces combined, giving
    // the whole plate ONE center and ONE fit (task §6: "do not reuse
    // separate group centers"). A destination with exactly one instance
    // takes the same code path with a single zero-offset slot, so nothing
    // changes for the (still overwhelmingly common) one-instance-per-
    // destination case.
    const destinationDerived = new Map<
      string,
      { centerX: number; centerY: number; fitScale: number; safeRadius: number }
    >();
    // Per-piece raw layout (technique arrangement already converted to
    // pixels and placed in its destination's shared combined space) —
    // computed once here so the flight loop below never re-derives it.
    const pieceRaw = new Map<
      Phaser.GameObjects.Image,
      {
        rawX: number;
        rawY: number;
        pieceRadius: number;
        rotationDeg: number;
        scaleMul: number;
        emergencyShrink: number;
        settleScale: number;
        halfWidth: number;
        halfHeight: number;
      }
    >();
    destinationOrder.forEach((destination, gi) => {
      const plate = this.platePlates[gi]!;
      const safeRadius = computeFoodSafeRadius(plate.rx, plate.ry);
      const instanceSeqs = destinationInstances.get(destination)!;

      // Pass 1 — each instance's own local composition, exactly as the
      // single-group pipeline already computed it, but positions stay in
      // that instance's own LOCAL space (re-centered on its own bounds
      // below, not yet placed on the shared plate).
      const instanceLocal = instanceSeqs.map((instanceSeq) => {
        const group = instancePieces.get(instanceSeq)!;
        const technique = instanceTechnique.get(instanceSeq)!;
        const ingredientId = instanceIngredient.get(instanceSeq)!;
        const localCount = group.length;
        const avgHalfDiag =
          group.reduce((sum, p) => sum + pieceBoundingRadius(p.displayWidth, p.displayHeight), 0) /
          Math.max(1, localCount);
        // `settleScale`: a 1-3 piece serving (e.g. a single slice) used to
        // shrink to a flat 0.78x and read as a lost scrap — scale UP a
        // touch for a small serving instead, so the instance's own
        // footprint always reads as an intentional plated portion.
        const settleScale = Phaser.Math.Clamp(1.3 - localCount * 0.032, 0.92, 1.2);
        // Distinct per instance (not just per ingredient) so two same-
        // ingredient instances (e.g. one sliced, one diced) never jitter
        // identically just because they share an ingredientId.
        const seed = seedFor(`${ingredientId}#${instanceSeq}`);

        const localPieces = group.map((piece, localIndex) => {
          const arrangement = getPlatingArrangement({
            technique,
            index: localIndex,
            count: localCount,
            seed,
          });
          const rawX = arrangement.xFrac * avgHalfDiag;
          const rawY = arrangement.yFrac * avgHalfDiag;
          const pieceRadius =
            pieceBoundingRadius(piece.displayWidth, piece.displayHeight) *
            settleScale *
            arrangement.scale;
          // Task: "food scale + multi-instance preparation bug" §A3/A4 —
          // the ACTUAL prepared-piece size is preserved by default
          // (emergencyShrink === 1 for every normal piece). computeExtraShrink
          // only trims a piece whose OWN bounding radius alone already
          // exceeds the plate's safe area — keyed on THAT piece's own
          // radius, never on the destination's overall combined spread, so
          // one oversized piece still never shrinks anyone else's food.
          const emergencyShrink = computeExtraShrink(safeRadius, pieceRadius);
          const renderRadius = pieceRadius * emergencyShrink;
          return {
            piece,
            rawX,
            rawY,
            radius: renderRadius,
            rotationDeg: arrangement.rotationDeg,
            scaleMul: arrangement.scale,
            emergencyShrink,
            settleScale,
            // Task: "julienne centering fix" §1/§2 — every piece Image uses
            // a top-left origin (createPieceImage's setOrigin(0,0)), so
            // `piece.x/y` is a CORNER, not the composition math's assumed
            // CENTER. Captured once here (at natural/unscaled size) so the
            // flight loop can convert the arrangement's true intended
            // center into the correct origin-space x/y for whatever
            // rotation/scale that piece actually settles at — see its own
            // doc there for why this matters far more for Julienne
            // (large, heavily-rotated, elongated pieces) than for a
            // near-square Dice cube.
            halfWidth: piece.displayWidth / 2,
            halfHeight: piece.displayHeight / 2,
          };
        });
        const {
          centerX: localCenterX,
          centerY: localCenterY,
          requiredRadius: localRequiredRadius,
        } = calculateCompositionBounds(
          localPieces.map((p) => ({ x: p.rawX, y: p.rawY, radius: p.radius })),
        );
        return { localPieces, localCenterX, localCenterY, localRequiredRadius };
      });

      // Pass 2 — arrange the instances themselves into side-by-side slots
      // (same 2-col-max/remainder-first-row rule as the multi-plate grid
      // above), spaced by the LARGEST instance's own footprint so no two
      // neighboring instances can ever overlap regardless of how lopsided
      // their piece counts are (e.g. 12 slices next to 6 dice).
      const subCount = instanceLocal.length;
      const subRows = Math.max(1, Math.ceil(subCount / 2));
      const subRemainder = subCount - 2 * (subRows - 1);
      const maxSubRadius = Math.max(1, ...instanceLocal.map((s) => s.localRequiredRadius));
      const subSpacing = maxSubRadius * 2 * 1.12;
      const combinedPieces: {
        piece: Phaser.GameObjects.Image;
        x: number;
        y: number;
        radius: number;
      }[] = [];
      instanceLocal.forEach((sub, si) => {
        let dx = 0;
        let dy = 0;
        if (subCount > 1) {
          const row = si < subRemainder ? 0 : 1 + Math.floor((si - subRemainder) / 2);
          const rowCount = row === 0 ? subRemainder : 2;
          const indexInRow = row === 0 ? si : (si - subRemainder) % 2;
          dx = (indexInRow - (rowCount - 1) / 2) * subSpacing;
          dy = (row - (subRows - 1) / 2) * subSpacing;
        }
        for (const p of sub.localPieces) {
          const x = p.rawX - sub.localCenterX + dx;
          const y = p.rawY - sub.localCenterY + dy;
          pieceRaw.set(p.piece, {
            rawX: x,
            rawY: y,
            pieceRadius: p.radius,
            rotationDeg: p.rotationDeg,
            scaleMul: p.scaleMul,
            emergencyShrink: p.emergencyShrink,
            settleScale: p.settleScale,
            halfWidth: p.halfWidth,
            halfHeight: p.halfHeight,
          });
          combinedPieces.push({ piece: p.piece, x, y, radius: p.radius });
        }
      });

      // Pass 3 — ONE composition bounds/center/fit across every piece this
      // destination combines (task §6) — never per-instance.
      const { centerX, centerY, requiredRadius } = calculateCompositionBounds(combinedPieces);
      // Task §A5 — fitScale ONLY tightens the arrangement's own SPACING
      // (controlled overlap between pieces), never the pieces' own render
      // scale (see the flight loop below, which no longer multiplies scale
      // by fitScale). Full containment is still guaranteed, just via the
      // per-piece position pull below rather than a group-wide shrink.
      const fitScale = fitCompositionToSafeRadius(requiredRadius, safeRadius);
      destinationDerived.set(destination, { centerX, centerY, fitScale, safeRadius });
    });

    // Overall bounding box across every plate — hands still reach for the
    // whole layout in one motion (Phase 5: no new pickup interaction, the
    // existing single RECIPE_COMPLETED handoff stays authoritative).
    this.plateCx = gridCx;
    this.plateCy = gridCy;
    this.plateRx = plateCount <= 1 ? baseRx : (colSpacingX * 2 + baseRx) / 2;
    this.plateRy = plateCount <= 1 ? baseRy : (rowSpacingY * rows) / 2;

    const plateIn = { t: 0 };
    this.tweens.add({
      targets: plateIn,
      t: 1,
      duration: PLATING.PLATE_IN_MS,
      onUpdate: () => this.drawPlateShape(Phaser.Math.Easing.Sine.Out(plateIn.t)),
    });

    const n = pieceImages.length;
    const stagger = n > 1 ? Math.min(PLATING.PLATE_STAGGER_MS, 900 / (n - 1)) : 0;

    pieceImages.forEach((piece, i) => {
      const destination = meta[i]?.destination ?? "";
      const plateIndex = destinationOrder.indexOf(destination);
      const plate = this.platePlates[plateIndex]!;
      const { centerX, centerY, fitScale, safeRadius } = destinationDerived.get(destination)!;
      const {
        rawX,
        rawY,
        pieceRadius,
        rotationDeg,
        scaleMul,
        emergencyShrink,
        settleScale,
        halfWidth,
        halfHeight,
      } = pieceRaw.get(piece)!;

      // Distribution/composition pass — see platingArrangement.ts's own
      // header doc: (raw position - composition center) * fitScale tightens
      // the ARRANGEMENT's own spacing/overlap (controlled overlap, task
      // §A5) — it never touches a piece's own rendered size (see
      // piece.setScale below, which uses emergencyShrink, not fitScale).
      let targetX = plate.cx + (rawX - centerX) * fitScale;
      let targetY = plate.cy + (rawY - centerY) * fitScale;
      // Final individual-piece safety clamp — POSITION-only. `pieceRadius`
      // here is already each piece's real render radius (settleScale/
      // arrangement.scale/emergencyShrink applied, fitScale never
      // involved), so pulling this piece's TARGET position in (never its
      // scale) is what actually guarantees `distance + realRadius <=
      // safeRadius` for every piece, even when fitScale's spacing-only
      // compression under-corrects for an outlier piece at the edge of a
      // tightly packed composition.
      const dist = Math.hypot(targetX - plate.cx, targetY - plate.cy);
      const maxDist = Math.max(0, safeRadius - pieceRadius);
      if (dist > maxDist && dist > 0) {
        const pull = maxDist / dist;
        targetX = plate.cx + (targetX - plate.cx) * pull;
        targetY = plate.cy + (targetY - plate.cy) * pull;
      }
      const fromX = piece.x;
      const fromY = piece.y;
      const fromAngle = piece.angle;
      const fromScale = piece.scale;
      // Task: "julienne centering fix" §1/§2 — `piece.x/y` is a top-left
      // CORNER (createPieceImage's setOrigin(0,0)), but every arrangement/
      // composition calculation above (targetX/targetY, calculateCompositionBounds,
      // fitCompositionToSafeRadius) is built entirely around "position =
      // this piece's own CENTER". Converting corner -> center HERE (via
      // the piece's own half-width/half-height, rotated by its current
      // angle) is what makes that assumption actually true on screen —
      // the flight loop below interpolates CENTER positions end to end,
      // then re-derives the correct corner for whatever angle/scale that
      // frame actually has. Rotation-invariant math (pieceBoundingRadius,
      // the containment clamp above) already used the center correctly;
      // only the final Phaser assignment didn't.
      const cornerToCenterOffset = (angleDeg: number, scale: number) => {
        const rad = Phaser.Math.DegToRad(angleDeg);
        const hw = halfWidth * scale;
        const hh = halfHeight * scale;
        return {
          x: hw * Math.cos(rad) - hh * Math.sin(rad),
          y: hw * Math.sin(rad) + hh * Math.cos(rad),
        };
      };
      const fromOffset = cornerToCenterOffset(fromAngle, fromScale);
      const fromCenterX = fromX + fromOffset.x;
      const fromCenterY = fromY + fromOffset.y;
      // An earlier-ingredient piece (multi-ingredient recipe) was faded to
      // 0 when its ingredient was cleared off the board
      // (closeOutCurrentIngredient) — gather it back to visible as it
      // flies to its plate, same beat as its position/scale. The
      // current/last ingredient's own pieces are already alpha 1, so this
      // is a no-op for them.
      const fromAlpha = piece.alpha;
      const targetAngle = fromAngle * 0.4 + rotationDeg;
      // Later pieces render above earlier ones — a stable depth order so
      // controlled overlap still reads as a real serving (each piece
      // showing enough of itself to identify) instead of a flat tie.
      // *3 spacing keeps each piece's own thickness/shadow (see below)
      // strictly between it and its neighbours' layers. Global index (not
      // per-plate) keeps depth ordering stable across the whole recipe.
      const baseDepth = 20 + i * 3;
      piece.setDepth(baseDepth + 2);
      const thickness = this.createPlatingThickness(piece, baseDepth + 1);
      const shadow = this.createPlatingShadow(baseDepth);
      this.platingExtras.push(thickness, shadow);

      const flight = { t: 0 };
      this.tweens.add({
        targets: flight,
        t: 1,
        duration: PLATING.PLATE_FLIGHT_MS,
        delay: PLATING.PLATE_IN_MS * 0.45 + i * stagger,
        onUpdate: () => {
          const e = Phaser.Math.Easing.Cubic.Out(flight.t);
          const angle = fromAngle + (targetAngle - fromAngle) * e;
          // Task §A3/A4 — the prepared piece's OWN size is preserved: no
          // group-wide fitScale here. settleScale/scaleMul are the same
          // small cosmetic (+/-20%/+/-8%) plating touches as before;
          // emergencyShrink is 1 for every normal piece and only trims a
          // piece whose own bounding radius alone can't fit the plate at
          // all (see computeExtraShrink's own doc).
          const scale = 1 + (settleScale * scaleMul * emergencyShrink - 1) * e;
          // Task: "julienne centering fix" — interpolate the piece's true
          // CENTER (arc included), then convert that center to the
          // corner-origin x/y Phaser actually needs, using THIS frame's
          // own angle/scale — not the pre-fix "just lerp piece.x/y
          // directly", which silently assumed corner === center.
          const centerX = fromCenterX + (targetX - fromCenterX) * e;
          const centerY =
            fromCenterY + (targetY - fromCenterY) * e - arcPx * Math.sin(Math.PI * flight.t);
          const offset = cornerToCenterOffset(angle, scale);
          piece.x = centerX - offset.x;
          piece.y = centerY - offset.y;
          piece.angle = angle;
          piece.alpha = fromAlpha + (1 - fromAlpha) * e;
          piece.setScale(scale);
          this.updatePlatingThickness(thickness, piece);
          this.updatePlatingShadow(shadow, piece, piece.alpha);
        },
        onComplete: () => AudioManager.playPlateChime(i),
      });
    });

    const totalMs =
      PLATING.PLATE_IN_MS * 0.45 +
      Math.max(0, n - 1) * stagger +
      PLATING.PLATE_FLIGHT_MS +
      PLATING.PLATE_SETTLE_MS;
    this.time.delayedCall(totalMs, () => this.bus.emit(EVT.PLATING_COMPLETED));
    this.time.delayedCall(Math.max(0, totalMs - SCENEFLOW.HANDS_LEAD_MS), () => this.startHands());
  }

  /**
   * Plating-only "side wall" — task: "IMPROVE PLATED FOOD PRESENTATION".
   * A second Image using the piece's OWN baked cutting-board texture (so
   * it is always the piece's real cut silhouette — never a generic
   * shape, and never a change to the piece's own texture/rendering),
   * tinted dark and, once landed, offset a few px toward a fixed
   * screen-space direction so a thin dark sliver of it shows past the
   * real piece's edge — reading as "this slice has a side" without a
   * true 3D extrusion. Created invisible (alpha 0); updatePlatingThickness
   * brings it in as the piece flies, matching the piece's own fade-in.
   * This object exists ONLY from startPlating() onward — createPieceImage
   * (the cutting-board renderer) never creates or references it, so the
   * board appearance is completely unaffected.
   */
  private createPlatingThickness(
    piece: Phaser.GameObjects.Image,
    depth: number,
  ): Phaser.GameObjects.Image {
    return this.add
      .image(piece.x, piece.y, piece.texture.key)
      .setOrigin(piece.originX, piece.originY)
      .setTint(PLATING_THICKNESS_TINT)
      .setDepth(depth)
      .setAlpha(0);
  }

  /** Per-flight-frame follow for createPlatingThickness's duplicate — see its own doc. */
  private updatePlatingThickness(
    img: Phaser.GameObjects.Image,
    piece: Phaser.GameObjects.Image,
  ): void {
    const size = Math.min(piece.displayWidth, piece.displayHeight);
    const mult = this.ingredient.depth ? PLATING_THICKNESS_PROTEIN_MULT : 1;
    const t =
      Phaser.Math.Clamp(
        size * PLATING_THICKNESS_FRAC,
        PLATING_THICKNESS_MIN_PX,
        PLATING_THICKNESS_MAX_PX,
      ) * mult;
    img.setScale(piece.scaleX, piece.scaleY);
    img.angle = piece.angle;
    img.x = piece.x + t * PLATING_THICKNESS_OFFSET_X_PER_PX;
    img.y = piece.y + t * PLATING_THICKNESS_OFFSET_Y_PER_PX;
    img.alpha = piece.alpha * 0.85; // stays a touch behind the real piece's own opacity — "subtle", not a second solid piece
  }

  /**
   * Plating-only contact shadow — a small soft, squashed ellipse under
   * each piece's actual visual center (piece.getCenter() — accounts for
   * the piece's own rotation/origin, unlike its raw x/y, which is a
   * top-left origin point), sized relative to that piece. Redrawn every
   * flight frame since a Graphics object has no texture to reuse; piece
   * counts here are always small (a recipe's whole cut output, never
   * more than a couple dozen) and this only runs during the ~1s plating
   * flight — never on the cutting board.
   */
  private createPlatingShadow(depth: number): Phaser.GameObjects.Graphics {
    return this.add.graphics().setDepth(depth);
  }

  /** Per-flight-frame redraw for createPlatingShadow — see its own doc. `alpha` is the piece's own current alpha, so the shadow fades in alongside it. */
  private updatePlatingShadow(
    shadow: Phaser.GameObjects.Graphics,
    piece: Phaser.GameObjects.Image,
    alpha: number,
  ): void {
    shadow.clear();
    if (alpha <= 0.01) return;
    const center = piece.getCenter();
    const w = piece.displayWidth * PLATING_SHADOW_WIDTH_MULT;
    const h = piece.displayHeight * PLATING_SHADOW_HEIGHT_MULT;
    const dy = piece.displayHeight * PLATING_SHADOW_Y_OFFSET_FRAC;
    shadow.fillStyle(PLATING_SHADOW_COLOR, PLATING_SHADOW_ALPHA * alpha);
    shadow.fillEllipse(center.x, center.y + dy, w, h);
  }

  /** Cream ceramic — soft shadow, subtle double rim (knifecraft.html drawPlateShape). One ellipse set per entry in platePlates — Phase 3/4's "one ingredient = one plate", drawn as one Graphics object since none of them overlap. */
  private drawPlateShape(alpha: number): void {
    this.plateGfx.clear();
    if (alpha <= 0.001) return;
    this.plateGfx.setAlpha(alpha);
    const plates =
      this.platePlates.length > 0
        ? this.platePlates
        : [{ cx: this.plateCx, cy: this.plateCy, rx: this.plateRx, ry: this.plateRy }];
    for (const { cx, rx, cy, ry } of plates) {
      this.plateGfx.fillStyle(0x3c2818, 0.22);
      this.plateGfx.fillEllipse(cx, cy + 6, rx * 2.04, ry * 2.04);
      this.plateGfx.fillStyle(0xf5efe4, 1);
      this.plateGfx.fillEllipse(cx, cy, rx * 2, ry * 2);
      this.plateGfx.fillStyle(0xfffdf9, 0.5);
      this.plateGfx.fillEllipse(cx - rx * 0.15, cy - ry * 0.15, rx * 1.3, ry * 1.3);
      this.plateGfx.lineStyle(1.5, 0x786854, 0.18);
      this.plateGfx.strokeEllipse(cx, cy, rx * 1.72, ry * 1.64);
      this.plateGfx.lineStyle(1, 0x786854, 0.22);
      this.plateGfx.strokeEllipse(cx, cy, rx * 2, ry * 2);
    }
  }

  /**
   * §63 "the loop closes when someone takes the plate" — knifecraft.html
   * handsPose()/drawArm(): two hands enter from above (decelerating),
   * hold at the rim, then leave with the plate (accelerating away —
   * "the plate is gone, not snatched"). Hands only, no face/body.
   */
  private startHands(): void {
    this.bus.emit(EVT.CHEF_TAKE_STARTED);
    const travel = SCENEFLOW.HANDS_TRAVEL_FRAC * this.scale.height;
    const restY = this.plateCy + 10;
    this.children.bringToTop(this.handL);
    this.children.bringToTop(this.handR);
    for (const [hand, side] of [
      [this.handL, -1],
      [this.handR, 1],
    ] as const) {
      hand.setPosition(this.plateCx + side * this.plateRx * 0.8, restY - travel);
      hand.setAlpha(1);
      hand.setVisible(true);
    }

    const enter = { t: 0 };
    this.tweens.add({
      targets: enter,
      t: 1,
      duration: SCENEFLOW.HANDS_ENTER_MS,
      onUpdate: () => {
        const e = Phaser.Math.Easing.Sine.Out(enter.t);
        const y = restY - travel * (1 - e);
        this.handL.y = y;
        this.handR.y = y;
      },
      onComplete: () => {
        this.time.delayedCall(SCENEFLOW.HANDS_GRIP_MS, () => this.exitHands(restY, travel));
      },
    });
  }

  private exitHands(restY: number, travel: number): void {
    const plateStartY = this.plateGfx.y;
    // Bug fix: this used to read `this.pieceImages`, which
    // closeOutCurrentIngredient() ALWAYS empties before finishRecipeNow
    // runs (every session — single-ingredient included — closes out its
    // last ingredient the same way multi-ingredient sessions close out
    // each earlier one). That meant this fade-out-with-the-plate tween
    // was iterating zero pieces on EVERY level, not just multi-ingredient
    // ones: the plated pieces flew to the plate correctly (startPlating
    // already read platedPieceImages) but then just sat there, fully
    // visible, forever, once the hands left — "vegetables remain on the
    // board instead of going with the plate."
    const pieceImages = this.platedPieceImages;
    const pieceStarts = pieceImages.map((p) => p.y);
    // The plating-only thickness/shadow extras (see startPlating's own
    // doc) leave with the plate exactly like their pieces do — captured
    // by their OWN starting alpha (not assumed to be 1, unlike a piece:
    // the thickness duplicate settles at 0.85, not 1 — see
    // updatePlatingThickness) so this fade never pops on the first frame.
    const extras = this.platingExtras;
    const extraStarts = extras.map((e) => e.y);
    const extraStartAlpha = extras.map((e) => e.alpha);
    const exit = { t: 0 };
    this.tweens.add({
      targets: exit,
      t: 1,
      duration: SCENEFLOW.HANDS_EXIT_MS,
      onUpdate: () => {
        const e = Phaser.Math.Easing.Cubic.In(exit.t); // quicker away — the plate is gone, not snatched
        const off = -travel * e;
        this.handL.y = restY + off;
        this.handR.y = restY + off;
        this.plateGfx.y = plateStartY + off;
        this.plateGfx.setAlpha(1 - e);
        pieceImages.forEach((p, i) => {
          p.y = pieceStarts[i]! + off;
          p.setAlpha(1 - e);
        });
        extras.forEach((extra, i) => {
          extra.y = extraStarts[i]! + off;
          extra.setAlpha(extraStartAlpha[i]! * (1 - e));
        });
      },
      onComplete: () => this.onHandsExitComplete(),
    });
  }

  private onHandsExitComplete(): void {
    this.bus.emit(EVT.CHEF_TAKE_COMPLETED);
    this.handL.setVisible(false);
    this.handR.setVisible(false);
    if (this.pendingRecipePayload) {
      this.bus.emit(EVT.RECIPE_COMPLETED, this.pendingRecipePayload);
      this.pendingRecipePayload = null;
    }
  }

  /**
   * Phase 7 addition — a tap/swipe during plating (onPointerDown) fast-
   * forwards straight to Dish Complete. Minimal and additive on purpose:
   * startPlating()'s whole fly-in/settle/hands sequence is already just
   * tweens + delayedCalls scheduled from one fixed deadline — cranking
   * both managers' timeScale plays that EXACT same choreography, just
   * compressed, instead of rewriting it into a second "skip" path or a
   * new scene. Reset back to 1 in onStart/onRestart so a same-instance
   * Retry never inherits a sped-up run.
   */
  private skipPlating(): void {
    const FAST_FORWARD = 12;
    this.tweens.timeScale = FAST_FORWARD;
    this.time.timeScale = FAST_FORWARD;
  }

  /** Drawn once in local space (wrist/palm at the origin); the sleeve runs up and off-canvas. */
  private drawHandShape(g: Phaser.GameObjects.Graphics, side: -1 | 1): void {
    const h = this.scale.height || 800;
    const L = SCENEFLOW.ARM_LENGTH_FRAC * h;
    const w0 = 0.019 * h;
    const w1 = 0.026 * h;

    g.setRotation(side * 0.26); // the limb leans out of frame; the camera itself never rotates

    g.fillStyle(0xc89b78, 1); // skin
    g.beginPath();
    g.moveTo(-w0, 4);
    for (const p of quadraticPoints(-w0, 4, -w1, -L * 0.45, -w1, -L, 10)) g.lineTo(p.x, p.y);
    g.lineTo(w1, -L);
    for (const p of quadraticPoints(w1, -L, w1, -L * 0.45, w0, 4, 10)) g.lineTo(p.x, p.y);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xeae2d5, 1); // cream sleeve cuff
    g.beginPath();
    g.moveTo(-w1 - 3, -L * 0.19);
    for (const p of quadraticPoints(-w1 - 3, -L * 0.19, 0, -L * 0.165, w1 + 3, -L * 0.19, 8))
      g.lineTo(p.x, p.y);
    g.lineTo(w1 + 5, -L);
    g.lineTo(-w1 - 5, -L);
    g.closePath();
    g.fillPath();

    // palm cradling the rim, thumb over it, fingers curling inward
    g.fillStyle(0xc89b78, 1);
    g.fillEllipse(0, 2, 44, 54);
    g.fillEllipse(-side * 17, -9, 18, 30);
    g.fillStyle(0xb0805f, 0.5);
    for (let i = 0; i < 3; i++) g.fillEllipse(-side * (7 + i * 8), 17 - i * 3, 13, 8.8);
  }

  override update(_time: number, _delta: number): void {
    if (this.paused) return;
    this.drawKnife();
    this.updateCoach();
  }

  /** True while the current step can't take a demonstration: input in flight, the step already done, or the plate on its way. */
  private coachBlocked(): boolean {
    if (this.pendingRecipePayload || this.tapBusy || this.isDragging || this.peeling) return true;
    if (this.cutBlockedUntilPeeled()) return true;
    const mode = this.technique.interactionMode;
    if (mode === "peel") return this.peeled;
    if (mode === "smash") return this.smashBusy;
    if (mode === "ring") return this.ringBusy || this.ringTapsDone >= this.requiredCuts;
    return this.cuts.length - this.stepCutsAtStart >= this.requiredCuts;
  }

  private setCoachVisible(visible: boolean): void {
    if (!visible) {
      this.coachGfx?.clear();
      this.coachLabel?.setVisible(false);
    }
    if (visible === this.coachVisible) return;
    this.coachVisible = visible;
    if (visible) {
      this.coachCycleT = this.time.now;
      this.coachTarget = this.coachTargetNow();
    }
    this.bus.emit(EVT.COACH, { visible, techniqueId: this.technique.id });
  }

  /** True once the player has made any progress on the current step (a cut, some peel, a ring, a smash). */
  private coachStepProgressed(): boolean {
    return (
      this.cuts.length - this.stepCutsAtStart > 0 ||
      this.peelCoveredCells > 0 ||
      this.ringTapsDone > 0 ||
      this.smashBusy
    );
  }

  /** Shows/advances/hides the ghost demonstration — see coaching.ts for when. */
  private updateCoach(): void {
    const now = this.time.now;
    // Only taught steps of a first-time beginner level, and only while it helps:
    // at the start until the first touch, then again only if the player is stuck.
    const due =
      this.coachTeach.has(this.technique.id) &&
      (!this.coachTouched
        ? now - this.coachStepT >= COACH_FIRST_DELAY_MS
        : !this.coachStepProgressed() && now - this.coachInputT >= COACH_STUCK_IDLE_MS);
    if (!due || this.coachBlocked()) {
      this.setCoachVisible(false);
      return;
    }
    this.setCoachVisible(true);
    let t = now - this.coachCycleT;
    const cycle = this.coachTarget ? coachCycleMs(this.coachTarget) : 0;
    if (t >= cycle) {
      // A new loop: re-aim at whatever is next now.
      this.coachCycleT = now;
      t = 0;
      this.coachTarget = this.coachTargetNow();
    }
    if (!this.coachTarget) {
      this.coachGfx.clear();
      this.coachLabel.setVisible(false);
      return;
    }
    const label = drawCoachGhost(
      this.coachGfx,
      this.coachTarget,
      t,
      this.scale.width,
      this.knifeStats.animation.blade,
    );
    if (label) {
      this.coachLabel
        .setText(label.text)
        .setPosition(label.x, label.y)
        .setAlpha(label.alpha)
        .setVisible(true);
    } else {
      this.coachLabel.setVisible(false);
    }
  }

  /**
   * Where the demonstration points: the cut a tap would make next (the same
   * axis, slot and position rules resolveTapCut uses), the skin still left
   * to peel, the middle to smash, or the next ring. Read-only.
   */
  private coachTargetNow(): CoachTarget | null {
    const mode = this.technique.interactionMode;
    const cx = this.ingCx;
    const cy = this.ingCy;
    if (mode === "smash") return { kind: "press", x: cx, y: cy };
    if (mode === "ring") {
      const frac = Math.max(1 / RINGS.RING_COUNT, this.ringRadiusFrac - 1 / RINGS.RING_COUNT);
      return {
        kind: "press",
        x: cx,
        y: cy,
        ring: { cx, cy, rx: this.ingRx * frac, ry: this.ingRy * frac },
      };
    }
    if (mode === "peel") {
      // The grid row with the most skin left; sweep across its inside cells.
      const cols = this.peelGridCols;
      const rows = this.peelGridRows;
      let bestRow = -1;
      let bestLeft = 0;
      for (let gy = 0; gy < rows; gy++) {
        let left = 0;
        for (let gx = 0; gx < cols; gx++) {
          const i = gy * cols + gx;
          if (this.peelGridInside[i] && !this.peelGrid[i]) left++;
        }
        if (left > bestLeft) {
          bestLeft = left;
          bestRow = gy;
        }
      }
      const { hw, hh } = this.peelHalfExtents();
      if (bestRow < 0) {
        return {
          kind: "drag",
          x0: cx - hw * 0.6,
          y0: cy,
          x1: cx + hw * 0.6,
          y1: cy,
          width: hh * 0.4,
        };
      }
      let lo = cols;
      let hi = -1;
      for (let gx = 0; gx < cols; gx++) {
        if (this.peelGridInside[bestRow * cols + gx]) {
          lo = Math.min(lo, gx);
          hi = Math.max(hi, gx);
        }
      }
      const u = (gx: number) => ((gx + 0.5) / cols) * 2 - 1;
      const y = cy + (((bestRow + 0.5) / rows) * 2 - 1) * hh;
      return {
        kind: "drag",
        x0: cx + u(lo) * hw,
        y0: y,
        x1: cx + u(hi) * hw,
        y1: y,
        width: Math.max(14, hh * 0.4),
      };
    }

    // Cutting.
    let cut: { axis: Axis; c: number; slope: number } | null = null;
    if (this.technique.radialSnap) {
      const n = requiredCutsFor(this.technique);
      const fold = (deg: number) => ((deg % 180) + 180) % 180;
      const used = new Array<boolean>(n).fill(false);
      for (const k of this.cuts) {
        const a = fold(lineAngleDeg(k.axis, k.slope));
        let best = 0;
        let bestGap = Infinity;
        for (let i = 0; i < n; i++) {
          const d = Math.abs(a - (180 * i) / n);
          const g = Math.min(d, 180 - d);
          if (g < bestGap) {
            bestGap = g;
            best = i;
          }
        }
        used[best] = true;
      }
      const pick = used.findIndex((u) => !u);
      if (pick < 0) return null;
      const rad = (((180 * pick) / n) * Math.PI) / 180;
      cut =
        Math.abs(Math.cos(rad)) >= Math.abs(Math.sin(rad))
          ? { axis: "h", c: cy, slope: Math.tan(rad) }
          : { axis: "v", c: cx, slope: Math.cos(rad) / Math.sin(rad) };
    } else {
      const axis = liveAxis(this.tapDefaultAxis(), this.technique.counts, this.cuts);
      const slope = this.cuts.length ? this.guideSlope[axis] : 0;
      const band = this.bandFor(axis);
      const positions = this.guides[axis].length
        ? this.guides[axis]
        : idealPositions(band.lo, band.hi, requiredCutsFor(this.technique));
      if (this.technique.continuousTap) {
        const existing = this.cuts.filter((k) => k.axis === axis).map((k) => k.c);
        const minGap = (band.hi - band.lo) * TAP_KNIFE.MIN_GAP_FRAC;
        // Right to left (nearest the cook first for horizontal lines).
        const aim = nextOpenPosition(positions, existing, minGap);
        const c =
          aim === undefined
            ? null
            : resolveContinuousPosition(
                band,
                existing,
                aim,
                TAP_KNIFE.MIN_EDGE_FRAC,
                TAP_KNIFE.MIN_GAP_FRAC,
              );
        if (c == null) return null;
        cut = { axis, c, slope };
      } else {
        const used = this.usedGuide[axis] ?? [];
        // Right to left (nearest the cook first for horizontal lines).
        const idx = nextCutIndex(used, positions.length);
        if (idx < 0) return null;
        cut = { axis, c: positions[idx]!, slope };
      }
    }
    const sp = visibleSeamSpanFor(cut, this.silhouette);
    // Radial: tap partway out along the spoke (a dead-centre tap has no direction).
    const f = this.technique.radialSnap ? 0.78 : 0.5;
    return {
      kind: "cut",
      x0: sp.x0,
      y0: sp.y0,
      x1: sp.x1,
      y1: sp.y1,
      tx: sp.x0 + (sp.x1 - sp.x0) * f,
      ty: sp.y0 + (sp.y1 - sp.y0) * f,
      cx,
      cy,
    };
  }

  /** Ported from knifecraft.html drawKnifeBody/drawKnife: a curved blade + walnut handle, edge riding the seam. */
  private drawKnife(): void {
    this.knifeGfx.clear();
    if (!this.knife) return;
    const K = KNIFE_GEOMETRY;
    const now = this.time.now;

    // Only the swipe-tracking phases auto-lerp rot toward a live
    // targetRot (updateKnifeDirection sets that every pointermove). The
    // idle rest pose and every tap phase drive x/y/rot directly via
    // tweens with their own easing — lerping on top of that would fight it.
    if (
      this.knife.phase === "enter" ||
      this.knife.phase === "active" ||
      this.knife.phase === "exit"
    ) {
      this.knife.rot += (this.knife.targetRot - this.knife.rot) * K.KNIFE_ROT_LERP;
      const along = this.knife.contactAlong ?? 0;
      this.knife.contactAlong =
        along + ((this.knife.targetContactAlong ?? 0) - along) * K.KNIFE_ROT_LERP;
      if (this.knife.targetSign !== undefined)
        this.knife.dirSign += (this.knife.targetSign - this.knife.dirSign) * K.KNIFE_ROT_LERP;
    }
    const sq = this.knife.squash ?? 1;
    this.knife.squash = sq + ((this.knife.targetSquash ?? 1) - sq) * 0.3;

    let alpha = 1;
    let liftY = 0;
    if (this.knife.phase === "enter") {
      const k = Phaser.Math.Clamp((now - this.knife.enterT) / K.KNIFE_ENTER_MS, 0, 1);
      alpha = k;
      if (k >= 1) this.knife.phase = "active";
    } else if (this.knife.phase === "exit") {
      const k = Phaser.Math.Clamp((now - this.knife.exitT) / K.KNIFE_EXIT_MS, 0, 1);
      const eased = Phaser.Math.Easing.Cubic.Out(k);
      alpha = 1 - eased;
      liftY = -K.KNIFE_LIFT_FRAC * this.knifeStats.animation.liftMult * this.scale.width * eased;
      if (k >= 1) {
        // Rest near the board instead of vanishing (§10) — the handoff
        // happens while fully faded out (alpha is 0 this exact frame),
        // so repositioning here is invisible; next frame quietly fades
        // back in in place, at rest, never a visible teleport.
        const idle = this.idleKnifePose();
        this.knife.x = idle.x;
        this.knife.y = idle.y;
        this.knife.rot = idle.rot;
        this.knife.targetRot = idle.rot;
        this.knife.contactAlong = 0;
        this.knife.targetContactAlong = 0;
        this.knife.dirSign = 1;
        delete this.knife.targetSign;
        delete this.knife.tipDir;
        this.knife.squash = 1;
        this.knife.targetSquash = 1;
        this.knife.phase = "idle";
        this.knife.enterT = now;
      }
    } else if (this.knife.phase === "idle") {
      // Reuses KNIFE_ENTER_MS as the idle-arrival fade — enterT is
      // backdated at level load (onRestart) so there's no fade there,
      // only on the handoff above.
      const k = Phaser.Math.Clamp((now - this.knife.enterT) / K.KNIFE_ENTER_MS, 0, 1);
      alpha = k;
    }

    // Phase 8 — every dimension and color below comes from the EQUIPPED
    // knife's own KnifeBladeShape/KnifeVisual (src/game/knives/) instead
    // of the old global KNIFE_GEOMETRY constant + hardcoded hex colors.
    // The chef knife's shape/colors reproduce the original hardcoded
    // values exactly, so the default silhouette is unchanged. Only the
    // SHAPE varies — the curve CONSTRUCTION (heel -> straight spine ->
    // curve to tip -> curve back along the edge -> heel) is identical for
    // every knife, so this never touches cut geometry, only what gets
    // drawn on top of it.
    const shape = this.knifeStats.animation.blade;
    const visual = this.knifeStats.visual;
    // The shared silhouette (knifeProfile.ts) — the coaching ghost draws the same one.
    const profile = topViewProfile(knifeProfile(shape, this.scale.width), this.knife.squash ?? 1);
    // Graphics has no save/restore or canvas-transform stack in this Phaser
    // version — position/rotate/scale the GameObject itself instead, and
    // draw the path in its local space. The blade is drawn shifted up by
    // half its own height so local y=0 is the cutting EDGE, which is what
    // ends up riding the seam once the object is positioned on it.
    const g = this.knifeGfx;
    g.setAlpha(alpha);
    const along = (this.knife.contactAlong ?? 0) * this.knife.dirSign;
    g.setPosition(
      this.knife.x - Math.cos(this.knife.rot) * along,
      this.knife.y - Math.sin(this.knife.rot) * along + liftY,
    );
    g.setRotation(this.knife.rot);
    g.setScale(this.knife.dirSign, 1);

    // A soft shadow falls down-right on the board whatever the knife's
    // angle: the world-space offset, turned into the Graphics' local space.
    const sw = this.scale.width * 0.008;
    const cos = Math.cos(this.knife.rot);
    const sin = Math.sin(this.knife.rot);
    const shadow = {
      x: (sw * 0.6 * cos + sw * sin) * this.knife.dirSign,
      y: -sw * 0.6 * sin + sw * cos,
    };
    paintKnife(g, profile, shape, visual, shadow);
  }
}

/** knifecraft.html resistAt/revealProgress: time fraction -> spatial progress, skin drags, flesh glides. */
function revealEase(k: number, curve: readonly (readonly [number, number])[]): number {
  const resistAt = (x: number): number => {
    for (let i = 1; i < curve.length; i++) {
      const cur = curve[i]!;
      if (x <= cur[0]) {
        const prev = curve[i - 1]!;
        const span = cur[0] - prev[0] || 1;
        return prev[1] + (cur[1] - prev[1]) * ((x - prev[0]) / span);
      }
    }
    return curve[curve.length - 1]![1];
  };
  const N = 16;
  let tot = 0;
  let acc = 0;
  for (let i = 0; i < N; i++) tot += 1 - resistAt((i + 0.5) / N);
  const upto = Math.floor(k * N);
  for (let i = 0; i < upto; i++) acc += 1 - resistAt((i + 0.5) / N);
  if (upto < N) acc += (1 - resistAt((upto + 0.5) / N)) * (k * N - upto);
  return tot ? Phaser.Math.Clamp(acc / tot, 0, 1) : k;
}

function travelledVelocity(path: RecordedPoint[]): number {
  const first = path[0]!;
  const last = path[path.length - 1]!;
  const dist = Math.hypot(last.x - first.x, last.y - first.y);
  const dt = Math.max(1, last.time - first.time);
  return (dist / dt) * 16.7; // px per frame-ish, just needs to be a stable relative velocity signal
}
