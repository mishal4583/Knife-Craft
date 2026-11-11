/**
 * THE GRADUAL RAMP (developer 2026-11-11: "increase the amount of things to check gradually, so the challenge and the engagement grow").
 *
 * The mini-games' difficulty comes in five tiers that start at fixed levels (Fridge Sort 3 / 14 / 27 / 44 / 74, and so on). Between two tiers the
 * numbers used to stay flat for 10-20 levels, so a player in Levels 4-20 played the same round again and again. `rampBetween` moves a number
 * smoothly from one tier's value to the next tier's over the levels in between, and equals the tier's own value on the tier's first level, so a
 * tier's numbers are exactly what they were where the tiers start. Pure and deterministic; it moves no money and no stock.
 */

/** `a` at level `from`, `b` at level `to`, whole numbers in between (rounded), `a` before and `b` after. */
export function rampBetween(level: number, from: number, to: number, a: number, b: number): number {
  if (!(to > from)) return a;
  const t = Math.min(1, Math.max(0, (level - from) / (to - from)));
  return Math.round(a + (b - a) * t);
}

/** The ramped value of a tier table: moves from tier i's value to tier i+1's value between their first levels (the last tier is flat). */
export function rampOf<T extends { from: number }>(
  tiers: readonly T[],
  level: number,
  pick: (t: T) => number,
): number {
  let i = 0;
  for (let k = 0; k < tiers.length; k++) if (level >= tiers[k]!.from) i = k;
  const here = tiers[i]!;
  const next = tiers[i + 1];
  if (!next) return pick(here);
  return rampBetween(level, here.from, next.from, pick(here), pick(next));
}
