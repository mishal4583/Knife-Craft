/**
 * BLACKSMITH — per-knife upgrades that change how a cut FEELS in real
 * Preparation, never whether it succeeds or how it is graded.
 *
 * Three stats, each levels 1-5 per owned knife (level 1 = the knife exactly
 * as it plays today, so an old save or an un-upgraded knife is unchanged):
 *
 *   Sharpness — the blade passes through faster (the tap-cut sequence's
 *               CUT + IMPACT beats shorten) and a peel stroke takes a wider
 *               strip (fewer strokes to reach the SAME completion coverage).
 *   Speed     — faster wind-up and recovery between cuts (PREP + PAUSE +
 *               RETRACT beats shorten), so taps can come quicker.
 *   Handling  — a lighter, more responsive knife: taps made earlier in the
 *               current cut are queued instead of dropped (a longer input
 *               buffer window) and the post-cut hitstop freeze is shorter.
 *
 * Everything lands in `KnifeDefinition.tuning` (knifeTypes.ts), which
 * PreparationScene multiplies into the SAME timing / buffer / peel values
 * the knife's own animation profile already scales. Per knifeTypes.ts's
 * design law, none of this touches cut positions, how many cuts a step
 * needs, grading, peel completion coverage, or any payout — rhythm is
 * scored on the relative spread of intervals (CutEvaluator), so a steadier,
 * faster cadence does not move the score. Fully upgraded, a Slice tap cycle
 * shortens from ~495 ms to ~400 ms — inside the range the knife catalog
 * already spans (paring's timingMult 0.85 … cleaver's 1.15).
 *
 * Costs are flat per step ($80 / $160 / $280 / $450 — $970 per stat):
 * the first step is about one early level's income (chapter 1 averages
 * ~$123 a level), a full stat is under a mid-game knife's price.
 */
import type { SaveData } from "../SaveManager";
import type { KnifeDefinition, KnifeTuning } from "./knifeTypes";
import { findKnife } from "./knifeDefinitions";
import { isKnifeOwned } from "./KnifeManager";
import {
  knifeTapCadence,
  tapSequenceMs,
  tapBufferWindowMs,
  peelStrokeWidthFrac,
} from "./knifeTiming";
import { TAP_KNIFE, PEEL } from "../definitions";
import { dollars } from "../money";

export type BlacksmithStat = "sharpness" | "speed" | "handling";
export const BLACKSMITH_STATS: readonly BlacksmithStat[] = ["sharpness", "speed", "handling"];

export const MIN_UPGRADE_LEVEL = 1;
export const MAX_UPGRADE_LEVEL = 5;

/** Cost to go from level L to L+1, indexed by L (index 0 unused). */
const STEP_COST = [0, dollars(80), dollars(160), dollars(280), dollars(450)] as const;

/** Per-level effect tables, index = level (index 0 unused; level 1 is the neutral 1.0). */
const SHARPNESS_CUT_MULT = [1, 1, 0.95, 0.9, 0.85, 0.8] as const;
const SHARPNESS_PEEL_MULT = [1, 1, 1.06, 1.12, 1.18, 1.25] as const;
const SPEED_MOVE_MULT = [1, 1, 0.96, 0.925, 0.89, 0.85] as const;
const HANDLING_BUFFER_MULT = [1, 1, 1.5, 2, 2.5, 3] as const;
const HANDLING_HITSTOP_MULT = [1, 1, 0.875, 0.75, 0.625, 0.5] as const;

export type KnifeUpgradeLevels = Record<BlacksmithStat, number>;

function clampLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MIN_UPGRADE_LEVEL;
  return Math.max(MIN_UPGRADE_LEVEL, Math.min(MAX_UPGRADE_LEVEL, Math.round(value)));
}

/** A knife's upgrade levels — missing/corrupt data reads as level 1 (the knife as it always played). */
export function getKnifeUpgrades(
  save: Pick<SaveData, "knifeUpgrades">,
  knifeId: string,
): KnifeUpgradeLevels {
  const raw = (save.knifeUpgrades ?? {})[knifeId] ?? {};
  return {
    sharpness: clampLevel(raw.sharpness),
    speed: clampLevel(raw.speed),
    handling: clampLevel(raw.handling),
  };
}

/** Overall knife level shown in the Blacksmith: 1 + upgrade steps bought (1 … 13). */
export function knifeLevel(levels: KnifeUpgradeLevels): number {
  return 1 + BLACKSMITH_STATS.reduce((sum, s) => sum + (levels[s] - MIN_UPGRADE_LEVEL), 0);
}

/** Price of the next step for a stat at `level`, or null at max. */
export function upgradeCost(level: number): number | null {
  const l = clampLevel(level);
  if (l >= MAX_UPGRADE_LEVEL) return null;
  return STEP_COST[l]!;
}

/** The gameplay tuning a set of levels produces — every field 1.0 at level 1. */
export function knifeTuningFor(levels: KnifeUpgradeLevels): KnifeTuning {
  return {
    cutMult: SHARPNESS_CUT_MULT[levels.sharpness]!,
    peelWidthMult: SHARPNESS_PEEL_MULT[levels.sharpness]!,
    moveMult: SPEED_MOVE_MULT[levels.speed]!,
    bufferMult: HANDLING_BUFFER_MULT[levels.handling]!,
    hitstopMult: HANDLING_HITSTOP_MULT[levels.handling]!,
  };
}

/** The knife Preparation actually plays with: the catalog knife plus its Blacksmith tuning (omitted entirely when un-upgraded, so level-1 play is byte-identical to before). */
export function effectiveKnife(
  save: Pick<SaveData, "knifeUpgrades">,
  knife: KnifeDefinition,
): KnifeDefinition {
  const levels = getKnifeUpgrades(save, knife.id);
  if (BLACKSMITH_STATS.every((s) => levels[s] === MIN_UPGRADE_LEVEL)) return knife;
  return { ...knife, tuning: knifeTuningFor(levels) };
}

/**
 * Factual before -> after preview for one upgrade step, computed with the
 * SAME knifeTiming.ts maths PreparationScene runs (no separate estimate):
 * the Slice tap-cut cycle (how often a cut can land when tapping fast), the
 * tap-queue window, the post-cut pause, and the peel strip width. `next` is
 * null at max level.
 */
export type ForgeFigures = { cycleMs: number; queueMs: number; pauseMs: number; peelPct: number };
export function forgePreview(
  knife: KnifeDefinition,
  levels: KnifeUpgradeLevels,
  stat: BlacksmithStat,
): { now: ForgeFigures; next: ForgeFigures | null } {
  const figures = (lv: KnifeUpgradeLevels): ForgeFigures => {
    const tuned = { ...knife, tuning: knifeTuningFor(lv) };
    const cadence = knifeTapCadence(TAP_KNIFE, tuned);
    return {
      cycleMs: Math.round(tapSequenceMs(cadence)),
      queueMs: Math.round(tapBufferWindowMs(TAP_KNIFE.BUFFER_TAIL_MS, tuned)),
      pauseMs: Math.round(cadence.HITSTOP_MS),
      peelPct: Math.round(
        (peelStrokeWidthFrac(PEEL.STROKE_WIDTH_FRAC, tuned) / PEEL.STROKE_WIDTH_FRAC) * 100,
      ),
    };
  };
  const next =
    levels[stat] >= MAX_UPGRADE_LEVEL ? null : figures({ ...levels, [stat]: levels[stat] + 1 });
  return { now: figures(levels), next };
}

export type UpgradeKnifeResult =
  | { ok: true; save: SaveData; cost: number; level: number }
  | { ok: false; reason: "unknownKnife" | "notOwned" | "maxLevel" | "insufficientFunds" };

/**
 * Atomic, mirroring buyKnife/sharpenKnife: either credits drop by exactly
 * the step cost and that one stat rises by exactly one level, or nothing
 * changes.
 */
export function upgradeKnife(
  save: SaveData,
  knifeId: string,
  stat: BlacksmithStat,
): UpgradeKnifeResult {
  if (!findKnife(knifeId)) return { ok: false, reason: "unknownKnife" };
  if (!isKnifeOwned(save, knifeId)) return { ok: false, reason: "notOwned" };
  const levels = getKnifeUpgrades(save, knifeId);
  const cost = upgradeCost(levels[stat]);
  if (cost === null) return { ok: false, reason: "maxLevel" };
  if (save.credits < cost) return { ok: false, reason: "insufficientFunds" };
  const level = levels[stat] + 1;
  return {
    ok: true,
    cost,
    level,
    save: {
      ...save,
      credits: save.credits - cost,
      knifeUpgrades: { ...(save.knifeUpgrades ?? {}), [knifeId]: { ...levels, [stat]: level } },
    },
  };
}
