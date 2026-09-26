/**
 * KNIFECRAFT — UI-facing gameplay types (cut results, quality labels, the
 * in-play HUD state). The UI never mutates gameplay values; it renders these.
 */

/** Matches the Phase 1 reference's grade ladder exactly (knifecraft.html GRADE_THRESHOLDS). */
export type QualityLabel = "Masterful" | "Clean" | "Honest" | "Rustic" | "Learning";

export type Ingredient = {
  id: string;
  name: string;
  glyph: string;
  technique: string;
  targetPieces: number;
};

export type DailyOrder = {
  day: string;
  recipeId: string;
  name: string;
  emoji: string;
  ingredients: string[];
  reward: number;
  note: string;
};

export type CutPath = { points: { x: number; y: number }[] };

/**
 * Fed by the gameplay engine; the UI only renders it. Metric names match
 * the Phase 1 reference: Evenness (gaps vs. ideal even division) and
 * Consistency (spread of the rendered gaps) are 0..100; Rhythm is a
 * bonus-only delta (e.g. +7) added to the base score, never a percentage
 * and never subtracted — see CutEvaluator.
 */
export type CutResult = {
  score: number;
  evenness: number;
  consistency: number;
  rhythmBonus: number;
  qualityLabel: QualityLabel;
  idealPath: CutPath[];
  playerPath: CutPath[];
};

export type GameplayPhase = "prep" | "cutting" | "result" | "plating" | "complete";

export type GameplayState = {
  phase: GameplayPhase;
  ingredient: Ingredient;
  technique: string;
  cutProgress: number; // pieces completed
  currentScore: number;
  currentCombo: number;
  currentCutQuality: QualityLabel | null;
  isPaused: boolean;
  lastResult: CutResult | null;
  previousBest: number;
  rewardCredits: number;
};
