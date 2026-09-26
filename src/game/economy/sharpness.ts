/**
 * SHARPNESS — Economy V2 Phase 6. The equipped knife's current cutting
 * condition: a small, visible, deterministic quality/yield modifier —
 * never a timer, never randomness, never a fail state (Phase 6 brief
 * §1/§2). A dull knife still completes every valid recipe; the only
 * consequence is a small additional effective COGS.
 *
 * Decay is driven entirely by the EXISTING recipe effort metric
 * (`recipeBase`, recipePay.ts) — never a second recipe classification.
 * recipeBase across all 221 campaign recipes ranges 29-330 (median 136,
 * mean 141.9) — LOSS_DIVISOR=50 with a [1,5] clamp was chosen from this
 * real distribution (not guessed): a typical order (median) costs ~3
 * points, the largest finale recipe is capped at 5, and even the
 * smallest recipe still costs the minimum 1 (the mechanic is never
 * literally invisible). Starting at 100 and never sharpening, a knife
 * used continuously drains over roughly one chapter's worth of orders —
 * frequent enough to be visible, far too slow to be a grind.
 */
import { dollars } from "../money";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { recipeBase } from "../recipes/recipePay";
import type { SaveData } from "../SaveManager";

export const DEFAULT_SHARPNESS = 100;
/** Deterministic fixed price (Phase 6 brief §7 — "no percentage-of-wallet pricing"). Tiny relative to campaign income (smallest chapter's own net is 1,234c; SHARPEN_COST is 4% of even THAT worst case) — never a solvency concern. */
export const SHARPEN_COST = dollars(50);

const LOSS_DIVISOR = 50;
const MIN_LOSS_PER_ORDER = 1;
const MAX_LOSS_PER_ORDER = 5;

/** The hard ceiling on sharpness's OWN economic effect — at 0 sharpness (Very Dull), finalCOGS is inflated by at most this fraction. Comparable to, and never stacking past, Phase 5's own per-item magnitudes (3-4%) — see equipmentSpecialization.ts's own MAX_TOTAL_COGS_REDUCTION. Sharpness only ever ADDS cost (never a bonus beyond neutral at 100), so it can never combine with equipment's reduction to create an "excessive economic advantage" (Phase 6 brief §10) — the two move in opposite directions by construction. */
const MAX_SHARPNESS_PENALTY = 0.05;

export function clampSharpness(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Missing/untracked knives default to fully sharp (Phase 6 brief §3 — "missing sharpness data must default to a full-sharp state"), for both a genuinely new knife and an old save that predates this field entirely. */
export function getKnifeSharpness(save: Pick<SaveData, "knifeSharpness">, knifeId: string): number {
  const raw = save.knifeSharpness[knifeId];
  return typeof raw === "number" ? clampSharpness(raw) : DEFAULT_SHARPNESS;
}

export type SharpnessLabel = "Freshly Sharpened" | "Sharp" | "Worn" | "Dull" | "Very Dull";

/** Display-only banding (Phase 6 brief §4) — never read by economy logic, which always uses the raw 0-100 value. */
export function sharpnessLabel(sharpness: number): SharpnessLabel {
  const s = clampSharpness(sharpness);
  if (s === 100) return "Freshly Sharpened";
  if (s >= 75) return "Sharp";
  if (s >= 40) return "Worn";
  if (s >= 1) return "Dull";
  return "Very Dull";
}

/**
 * Deterministic workload-based loss for ONE completed/served recipe —
 * see this file's own header for the corpus-calibrated divisor/clamp.
 * Never Math.random(); the exact same recipe always costs the exact
 * same amount of sharpness, auditable directly from `recipeBase`.
 */
export function sharpnessLossFor(recipe: RecipeDefinition): number {
  const workload = recipeBase(recipe);
  return Math.min(
    MAX_LOSS_PER_ORDER,
    Math.max(MIN_LOSS_PER_ORDER, Math.round(workload / LOSS_DIVISOR)),
  );
}

/**
 * Pure — returns a NEW save with the given knife's sharpness reduced by
 * `sharpnessLossFor(recipe)`, clamped to [0,100]. Callers are
 * responsible for only calling this on a genuine, non-replay completion
 * (Phase 6 brief §11 — replay must never create a persistent sharpness
 * change, exactly like it never creates a persistent credits/upkeep
 * change elsewhere in this codebase).
 */
export function applySharpnessDecay(
  save: SaveData,
  knifeId: string,
  recipe: RecipeDefinition,
): SaveData {
  const current = getKnifeSharpness(save, knifeId);
  const next = clampSharpness(current - sharpnessLossFor(recipe));
  return { ...save, knifeSharpness: { ...save.knifeSharpness, [knifeId]: next } };
}

/**
 * The one COGS-side effect sharpness has on settlement (Phase 6 brief
 * §8/§9 — "prefer one clear mechanic rather than stacking several
 * hidden modifiers"): a smooth, linear penalty from 0 at full sharpness
 * to MAX_SHARPNESS_PENALTY at zero. Never touches quality-bonus rate,
 * never touches qualityFor()/grade thresholds — a completely separate,
 * single-purpose knob from both the quality-grade waste factor and
 * Phase 5's equipment specialization.
 */
export function getSharpnessModifier(sharpness: number): number {
  const s = clampSharpness(sharpness);
  return ((100 - s) / 100) * MAX_SHARPNESS_PENALTY;
}

export function canSharpenKnife(save: SaveData): boolean {
  return save.credits >= SHARPEN_COST;
}

export type SharpenKnifeResult =
  { ok: true; save: SaveData } | { ok: false; reason: "insufficientFunds" };

/**
 * Atomic (Phase 6 brief §7): either credits drop by exactly SHARPEN_COST
 * and sharpness becomes exactly 100, or NOTHING changes at all. Never
 * creates debt/negative credits — the insufficient-funds path returns
 * the save completely untouched.
 */
export function sharpenKnife(save: SaveData, knifeId: string): SharpenKnifeResult {
  if (save.credits < SHARPEN_COST) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - SHARPEN_COST,
      knifeSharpness: { ...save.knifeSharpness, [knifeId]: DEFAULT_SHARPNESS },
    },
  };
}
