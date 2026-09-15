/**
 * KNIFE_DEFINITIONS — the single authoritative knife catalog (Phase 8).
 *
 * Everything that used to live in `src/components/kc/data.ts`'s `KNIVES`
 * mock array (rendered but not save-backed) and `src/game/definitions.ts`'s
 * inert `KnifeStats`/`DEFAULT_KNIFE` (reached Phaser but had zero effect)
 * is replaced by this one catalog — the Workshop UI and PreparationScene
 * both read from it, so there is exactly one place a knife's identity is
 * defined (§"single source of truth").
 *
 * Prices/unlock levels are the brief's INITIAL economy values, not final
 * balance — kept as plain data here specifically so they can be retuned
 * later without touching any consuming code.
 */
import type { IngredientId, TechniqueId } from "../definitions";
import type {
  KnifeAnimationProfile,
  KnifeAudioProfile,
  KnifeDefinition,
  KnifeVisual,
} from "./knifeTypes";

export const DEFAULT_KNIFE_ID = "chef" as const;

/** The chef's-knife blade shape reproduces the ORIGINAL hardcoded drawKnife()/KNIFE_GEOMETRY constants exactly — pixel-identical default silhouette. */
const CHEF_ANIMATION: KnifeAnimationProfile = {
  blade: {
    bladeLenFrac: 188 / 540,
    bladeHFrac: 23 / 540,
    handleLenFrac: 66 / 540,
    heelAt: -0.32,
    spineBendFrac: 0.4,
    spineControlXFrac: 0.58,
    tipFrac: 0.68,
    tipRiseFrac: 0.3,
    bellyControlXFrac: 0.28,
    bellyFrac: 0.58,
    serrated: false,
  },
  timingMult: 1,
  depthMult: 1,
  liftMult: 1,
  jitterMult: 1,
  weightMult: 1,
};

const CHEF_VISUAL: KnifeVisual = {
  bladeColor: 0xc9cfd6,
  edgeHighlight: 0xfafcfe,
  bolsterColor: 0xb9bfc7,
  handleColor: 0x7a4f34,
  rivetColor: 0xd8ccb8,
};

const NEUTRAL_AUDIO: KnifeAudioProfile = { pitchMult: 1, gainMult: 1 };

export const KNIFE_CATALOG: KnifeDefinition[] = [
  {
    id: "chef",
    name: "Chef's Knife",
    tagline: "The one you reach for",
    description:
      "A balanced, everyday all-rounder. Every technique in the kitchen starts here — nothing later in the collection cuts better than this, only differently.",
    style: "balanced",
    weight: "balanced",
    price: 0,
    unlockLevel: 1,
    preferredTechniques: ["slice", "dice", "chop", "halve"],
    preferredIngredients: ["tomato", "carrot", "onion"],
    animation: CHEF_ANIMATION,
    audio: NEUTRAL_AUDIO,
    visual: CHEF_VISUAL,
  },
  {
    id: "santoku",
    name: "Santoku",
    tagline: "Three virtues, one blade",
    description:
      "A broad Japanese-style vegetable knife. Clean vegetable cuts, a slightly lighter motion, and a crisp, satisfying release — the advantage is in the feel, not the speed.",
    style: "vegetable",
    weight: "light",
    price: 350,
    unlockLevel: 10,
    preferredTechniques: ["slice", "dice", "julienne"],
    preferredIngredients: ["cucumber", "zucchini", "carrot"],
    animation: {
      blade: {
        bladeLenFrac: 172 / 540,
        bladeHFrac: 32 / 540,
        handleLenFrac: 60 / 540,
        heelAt: -0.3,
        spineBendFrac: 0.42,
        spineControlXFrac: 0.6,
        tipFrac: 0.82,
        tipRiseFrac: 0.16,
        bellyControlXFrac: 0.3,
        bellyFrac: 0.52,
        serrated: false,
      },
      timingMult: 0.95,
      depthMult: 0.95,
      liftMult: 1.05,
      jitterMult: 0.85,
      weightMult: 0.9,
    },
    audio: { pitchMult: 1.06, gainMult: 0.95 },
    visual: {
      bladeColor: 0xd7dde3,
      edgeHighlight: 0xfefefe,
      bolsterColor: 0xc7ccd2,
      handleColor: 0xb98a54,
      rivetColor: 0xe6dcc8,
    },
  },
  {
    id: "nakiri",
    name: "Nakiri",
    tagline: "Made for the garden",
    description:
      "A wide, straight-edged vegetable chopper. Best for Chop, Dice and Julienne — a heavier downward presentation and a clean, straight blade movement.",
    style: "vegetable",
    weight: "heavy",
    price: 700,
    unlockLevel: 25,
    preferredTechniques: ["chop", "dice", "julienne"],
    preferredIngredients: ["carrot", "potato", "cucumber"],
    animation: {
      blade: {
        bladeLenFrac: 175 / 540,
        bladeHFrac: 36 / 540,
        handleLenFrac: 58 / 540,
        heelAt: -0.28,
        spineBendFrac: 0.6,
        spineControlXFrac: 0.78,
        tipFrac: 0.94,
        tipRiseFrac: 0.06,
        bellyControlXFrac: 0.3,
        bellyFrac: 0.5,
        serrated: false,
      },
      timingMult: 1.05,
      depthMult: 1.1,
      liftMult: 0.95,
      jitterMult: 0.8,
      weightMult: 1.15,
    },
    audio: { pitchMult: 0.94, gainMult: 1.05 },
    visual: {
      bladeColor: 0xb8c0c9,
      edgeHighlight: 0xf2f4f6,
      bolsterColor: 0xa3aab2,
      handleColor: 0x4a3625,
      rivetColor: 0xcfc6b4,
    },
  },
  {
    id: "paring",
    name: "Paring Knife",
    tagline: "Small work, close hands",
    description:
      "A small, narrow blade for detail preparation — garlic, strawberries, trimming. A shorter knife movement and a lighter, more delicate contact sound.",
    style: "detail",
    weight: "light",
    price: 500,
    unlockLevel: 15,
    preferredTechniques: ["peel", "halve", "slice"],
    preferredIngredients: ["garlic", "strawberry", "potato"],
    animation: {
      blade: {
        bladeLenFrac: 96 / 540,
        bladeHFrac: 14 / 540,
        handleLenFrac: 54 / 540,
        heelAt: -0.34,
        spineBendFrac: 0.38,
        spineControlXFrac: 0.56,
        tipFrac: 0.62,
        tipRiseFrac: 0.34,
        bellyControlXFrac: 0.26,
        bellyFrac: 0.6,
        serrated: false,
      },
      timingMult: 0.85,
      depthMult: 0.8,
      liftMult: 0.9,
      jitterMult: 0.7,
      weightMult: 0.75,
    },
    audio: { pitchMult: 1.12, gainMult: 0.85 },
    visual: {
      bladeColor: 0xe2e7ec,
      edgeHighlight: 0xffffff,
      bolsterColor: 0xcfd4d9,
      handleColor: 0x5f8a86,
      rivetColor: 0xf0ead9,
    },
  },
  {
    id: "bread",
    name: "Bread Knife",
    tagline: "For the bakery table",
    description:
      "A long serrated blade for bakery prep. A visibly toothed edge, a slightly different cut animation, and a distinct bread-cut sound.",
    style: "bread",
    weight: "balanced",
    price: 850,
    unlockLevel: 30,
    preferredTechniques: ["slice"],
    preferredIngredients: ["bread"],
    animation: {
      blade: {
        bladeLenFrac: 210 / 540,
        bladeHFrac: 20 / 540,
        handleLenFrac: 64 / 540,
        heelAt: -0.3,
        spineBendFrac: 0.36,
        spineControlXFrac: 0.56,
        tipFrac: 0.72,
        tipRiseFrac: 0.26,
        bellyControlXFrac: 0.26,
        bellyFrac: 0.54,
        serrated: true,
      },
      timingMult: 1.1,
      depthMult: 1.0,
      liftMult: 1.0,
      jitterMult: 1.1,
      weightMult: 1.0,
    },
    audio: { pitchMult: 0.97, gainMult: 1.0 },
    visual: {
      bladeColor: 0xcfd2c8,
      edgeHighlight: 0xf6f4ea,
      bolsterColor: 0xb9bfc7,
      handleColor: 0xa97a3f,
      rivetColor: 0xe8dcb8,
    },
  },
  {
    id: "cleaver",
    name: "Cleaver",
    tagline: "Confident and heavy",
    description:
      "A large, heavy blade for heavy preparation — bigger vegetables, a stronger board impact, a deeper thunk. Not more powerful, just heavier.",
    style: "heavy",
    weight: "heavy",
    price: 1100,
    unlockLevel: 40,
    preferredTechniques: ["chop", "smash"],
    preferredIngredients: ["potato", "onion", "garlic"],
    animation: {
      blade: {
        bladeLenFrac: 150 / 540,
        bladeHFrac: 46 / 540,
        handleLenFrac: 56 / 540,
        heelAt: -0.26,
        spineBendFrac: 0.62,
        spineControlXFrac: 0.8,
        tipFrac: 0.96,
        tipRiseFrac: 0.04,
        bellyControlXFrac: 0.32,
        bellyFrac: 0.48,
        serrated: false,
      },
      timingMult: 1.15,
      depthMult: 1.25,
      liftMult: 0.9,
      jitterMult: 1.15,
      weightMult: 1.35,
    },
    audio: { pitchMult: 0.85, gainMult: 1.18 },
    visual: {
      bladeColor: 0x9aa3ab,
      edgeHighlight: 0xe4e8eb,
      bolsterColor: 0x8e959d,
      handleColor: 0x3d2a1a,
      rivetColor: 0xc9bfa8,
    },
  },
  {
    id: "damascus",
    name: "Damascus Knife",
    tagline: "Folded sixty-four times",
    description:
      "The signature blade — a rippled Damascus pattern, a balanced all-purpose feel. Nothing about it is required. The reward is simply owning something beautiful.",
    style: "signature",
    weight: "balanced",
    price: 1800,
    unlockLevel: 50,
    preferredTechniques: ["slice", "dice", "julienne", "chop", "halve"],
    preferredIngredients: ["tomato", "apple", "orange"],
    animation: {
      blade: {
        bladeLenFrac: 192 / 540,
        bladeHFrac: 24 / 540,
        handleLenFrac: 68 / 540,
        heelAt: -0.32,
        spineBendFrac: 0.4,
        spineControlXFrac: 0.58,
        tipFrac: 0.7,
        tipRiseFrac: 0.3,
        bellyControlXFrac: 0.28,
        bellyFrac: 0.58,
        serrated: false,
      },
      timingMult: 1.0,
      depthMult: 1.0,
      liftMult: 1.0,
      jitterMult: 0.9,
      weightMult: 1.0,
    },
    audio: { pitchMult: 1.02, gainMult: 1.0 },
    visual: {
      bladeColor: 0xcdd3da,
      edgeHighlight: 0xffffff,
      bolsterColor: 0xc2b280,
      handleColor: 0x5c2f24,
      rivetColor: 0xd4af6a,
      pattern: "damascus",
    },
  },
  {
    // Progression pass — Level 90's "CHEF'S SPECIAL" milestone reward.
    // Named distinctly from the starter "chef" knife (id "chef", already
    // "Chef's Knife") to avoid a duplicate-name collision; a true top
    // tier above Damascus, unlocked once Chapter 9 "Branching Kitchen" is
    // cleared. Geometry/visual values are new data within the SAME
    // procedural blade system every other knife already uses (no image
    // assets) — heavier than Damascus (a serious branching-service tool)
    // but not as blunt as the Cleaver.
    id: "obsidian",
    name: "Obsidian Knife",
    tagline: "Ground from a single dark stone",
    description:
      "The chef's own knife, given to you once the kitchen can run a full branching service without them. Heavier than Damascus, quieter than the Cleaver — a knife for someone who no longer needs to be told what to do with it.",
    style: "signature",
    weight: "heavy",
    price: 2200,
    unlockLevel: 90,
    preferredTechniques: ["slice", "dice", "julienne", "chop", "halve", "rockMince"],
    preferredIngredients: ["chicken", "steak", "onion"],
    animation: {
      blade: {
        bladeLenFrac: 196 / 540,
        bladeHFrac: 30 / 540,
        handleLenFrac: 64 / 540,
        heelAt: -0.3,
        spineBendFrac: 0.46,
        spineControlXFrac: 0.62,
        tipFrac: 0.78,
        tipRiseFrac: 0.22,
        bellyControlXFrac: 0.3,
        bellyFrac: 0.54,
        serrated: false,
      },
      timingMult: 1.05,
      depthMult: 1.1,
      liftMult: 1.0,
      jitterMult: 0.75,
      weightMult: 1.2,
    },
    audio: { pitchMult: 0.9, gainMult: 1.08 },
    visual: {
      bladeColor: 0x2a2a30,
      edgeHighlight: 0xd8d8e2,
      bolsterColor: 0x1c1c20,
      handleColor: 0x1a1410,
      rivetColor: 0xb08d4a,
      pattern: "damascus",
    },
  },
];

export function findKnife(id: string): KnifeDefinition | undefined {
  return KNIFE_CATALOG.find((k) => k.id === id);
}

export function knifeOrDefault(id: string): KnifeDefinition {
  return findKnife(id) ?? KNIFE_CATALOG[0]!;
}

/** Emoji for a technique's "Best for" chip — display-only, purely qualitative. */
export const TECHNIQUE_EMOJI: Record<TechniqueId, string> = {
  slice: "🔪",
  dice: "🎲",
  julienne: "🍜",
  chop: "🪓",
  halve: "✂️",
  peel: "🥔",
  smash: "💥",
  rings: "⭕",
  radial: "☀️",
  rockMince: "🌀",
  chiffonade: "🎗️",
};

/** Emoji for an ingredient's "Best for" chip — display-only, purely qualitative. */
export const INGREDIENT_EMOJI: Record<IngredientId, string> = {
  tomato: "🍅",
  carrot: "🥕",
  cucumber: "🥒",
  onion: "🧅",
  potato: "🥔",
  garlic: "🧄",
  basil: "🌿",
  parsley: "🌱",
  mushroom: "🍄",
  pepper: "🫑",
  zucchini: "🥬",
  bread: "🍞",
  strawberry: "🍓",
  apple: "🍎",
  orange: "🍊",
  // Phase 18 — Claude Design ingredient merge
  eggplant: "🍆",
  broccoli: "🥦",
  corn: "🌽",
  celery: "🥬",
  lettuce: "🥬",
  cabbage: "🥬",
  cauliflower: "🥦",
  spinach: "🥬",
  asparagus: "🥬",
  radish: "🥕",
  beetroot: "🥕",
  sweetpotato: "🍠",
  greenbean: "🫘",
  fennel: "🥬",
  artichoke: "🥬",
  peapod: "🫛",
  pumpkin: "🎃",
  turnip: "🥕",
  lemon: "🍋",
  avocado: "🥑",
  pear: "🍐",
  peach: "🍑",
  pineapple: "🍍",
  watermelon: "🍉",
  mango: "🥭",
  kiwi: "🥝",
  pomegranate: "🍎",
  grapes: "🍇",
  coconut: "🥥",
  cheddar: "🧀",
  mozzarella: "🧀",
  butter: "🧈",
  tofu: "⬜",
  baguette: "🥖",
  chicken: "🍗",
  steak: "🥩",
  salmon: "🐟",
};
