/**
 * Phase 1 (B4/B5) — how a finished run compares with the player's own
 * best for that recipe, and therefore whether the Knife Report may
 * celebrate it.
 *
 * The baseline is `SaveData.recipeProgress[recipeId].best`: the score
 * the game ALREADY stores and already compares against (it is what
 * drives OrderComplete's "your best plate yet"). Nothing new is
 * persisted for this and no save field is added.
 *
 * The comparison metric is the run's overall cut score — the same 0–100
 * the Knife Report's grade is derived from — so "cleaner" means "graded
 * better", not a second, parallel notion of cleanliness.
 *
 * It compares against the player's BEST, not their last attempt: the
 * save keeps only the best, so wording it "than last time" would be a
 * claim the data cannot support.
 *
 * Lives in its own module rather than inside KnifeReport.tsx so it can
 * be unit-tested directly (scripts/phase1-cutting-qa.mts) without the
 * component file having to export a non-component.
 */
export type BestVerdict =
  | { kind: "first" }
  | { kind: "none" }
  /** `gain` is the whole-percent improvement over the old best, or null when it rounds below 1% (never show "+0%"). */
  | { kind: "best"; gain: number | null };

export function bestVerdict(score: number, previousBest: number): BestVerdict {
  // An invalid or empty result is never a comparison and never a
  // celebration — an incomplete order reaches here as score 0.
  if (!Number.isFinite(score) || score <= 0) return { kind: "none" };
  // No usable baseline: a missing record, a zero, a negative or a
  // non-finite best all mean "never completed before", which is a
  // first result, not an improvement over anything.
  if (!Number.isFinite(previousBest) || previousBest <= 0) return { kind: "first" };
  // Equal is not better — only a genuine improvement celebrates.
  if (score <= previousBest) return { kind: "none" };
  const gain = Math.round(((score - previousBest) / previousBest) * 100);
  return { kind: "best", gain: gain >= 1 ? gain : null };
}

/**
 * Phase 1 (B4, developer 2026-10-21) — the old best and the new score as
 * the Knife Report prints them ("Best 72 → 85"). The engine's scores are
 * whole numbers (CutEvaluator rounds `overall`), so this is normally just
 * the two integers. A saved best can still hold a fraction (an older or
 * hand-edited save), and a gain under half a point would then round to
 * "60 → 60" right under "New Best!". So the pair uses the fewest decimal
 * places (0–2) at which the two values actually differ.
 */
export function formatScorePair(before: number, after: number): [string, string] {
  let places = 0;
  while (places < 2 && before.toFixed(places) === after.toFixed(places)) places++;
  return [before.toFixed(places), after.toFixed(places)];
}
