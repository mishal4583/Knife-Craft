/**
 * CUT_PLAN — which way the cut lines run and in what order a cook makes
 * them. The rules are the developer's, together with the knife-skills
 * reference in docs/KNIFE_RULES.md:
 *
 * - The cook holds the knife in the right hand and the food with the left
 *   hand in a claw grip. Slices are made ACROSS the food, the knife
 *   standing on each line (Level 1's tomato is the model). Seen from above,
 *   that means vertical cut lines for almost everything; every food is drawn
 *   lying left-right or round.
 * - The cook starts at the RIGHT end and works LEFT, the claw hand stepping
 *   back along the food. Where a second, horizontal set is genuinely
 *   needed (Dice's cross cuts), it starts nearest the cook (the bottom) and
 *   works away.
 * - Horizontal cut lines only where a cut can't be made any other way:
 *   - julienne's lengthwise strips (the reference: "slice it lengthwise into
 *     even slabs … cut into uniform strips"), which run along a food lying
 *     left-right;
 *   - Dice's cross cuts after its slices ("slice across them into evenly
 *     sized cubes");
 *   - a food drawn clearly taller than it is wide, where "across" is
 *     horizontal.
 *
 * Pure functions: PreparationScene uses them for the tap axis, the swipe
 * guides and the coaching ghost's order, and scripts/cut-rules-qa.mts
 * checks them for every level.
 */
import type { Axis } from "./CutGeometry";

/** A food is "tall" (cut lines run horizontally across it) only when its height clearly exceeds its width. */
export const TALL_ASPECT = 1.35;

/**
 * The axis of a cutting step's FIRST set of cut lines ("v" = vertical lines).
 * - `technique.cutsLengthwise` (julienne): lines along the food's length —
 *   horizontal for a food lying left-right, vertical for a tall one.
 * - `ingredient.axisOverride`: an ingredient's own explicit choice wins.
 * - Otherwise lines run across the food: vertical, unless the food is tall.
 */
export function primaryCutAxis(
  technique: { cutsLengthwise?: boolean },
  ingredient: { axisOverride?: Axis },
  rx: number,
  ry: number,
): Axis {
  if (technique.cutsLengthwise) return rx >= ry ? "h" : "v";
  if (ingredient.axisOverride) return ingredient.axisOverride;
  return ry > rx * TALL_ASPECT ? "h" : "v";
}

/**
 * Which uncut line to make (and teach) next, given the slots in ascending
 * position (left → right for vertical lines, top → bottom for horizontal)
 * and which are already used. Right to left for vertical lines, nearest the
 * cook (bottom) first for horizontal ones: both are the highest unused
 * position. -1 when every slot is used.
 */
export function nextCutIndex(used: readonly boolean[], count: number): number {
  for (let i = count - 1; i >= 0; i--) if (!used[i]) return i;
  return -1;
}

/**
 * For continuous techniques (Slice/Chop on a free band), the next slot to
 * aim at: the highest position that is still clear of every existing cut by
 * `minGap`. Undefined when none is.
 */
export function nextOpenPosition(
  positions: readonly number[],
  existing: readonly number[],
  minGap: number,
): number | undefined {
  for (let i = positions.length - 1; i >= 0; i--) {
    const p = positions[i]!;
    if (existing.every((e) => Math.abs(e - p) > minGap)) return p;
  }
  return undefined;
}
