/**
 * THE PAINTED FACES AND EMBLEMS (Codex sheets of 2026-11-25, cut by `scripts/make-chef-assets.py`): where each picture lives. Pure paths, relative to the app's base URL; the screens
 * load them lazily and keep their emoji when one cannot load (`components/kc/common/PaintedPortrait.tsx`), so nothing is ever blank.
 *
 *  - the 49 rival chefs: `portraits/rivals/<rival-id>.webp` (the ids of `restaurant/cityRanking.ts` RIVALS);
 *  - the 5 prestige emblems: `progress/prestige/tier-<0..4>.webp` (`restaurant/restaurantPrestige.ts` PRESTIGE_TIERS);
 *  - the health inspector: `portraits/inspector/<pose>.webp`, the arrival and one reaction per grade.
 */
import { RIVALS } from "./restaurant/cityRanking";

const RIVAL_IDS: ReadonlySet<string> = new Set(RIVALS.map((r) => r.id));

/** The painted bust of a rival's chef, or null when the id is not a rival (the player, "you", an unknown id). */
export function rivalPortraitPath(rivalId: string): string | null {
  return RIVAL_IDS.has(rivalId) ? `portraits/rivals/${rivalId}.webp` : null;
}

/** How many prestige emblems there are (one per tier). */
export const PRESTIGE_EMBLEM_COUNT = 5;

/** The emblem of a prestige tier (0-4), or null for anything else. */
export function prestigeEmblemPath(tier: number): string | null {
  return Number.isInteger(tier) && tier >= 0 && tier < PRESTIGE_EMBLEM_COUNT
    ? `progress/prestige/tier-${tier}.webp`
    : null;
}

export type InspectorPose = "arrival" | "pleased" | "neutral" | "disappointed";
export const INSPECTOR_POSES: readonly InspectorPose[] = [
  "arrival",
  "pleased",
  "neutral",
  "disappointed",
];

/** The inspector's reaction to a grade: A pleased, B neutral (a warning), C disappointed. */
export function inspectorPoseFor(grade: "A" | "B" | "C"): InspectorPose {
  return grade === "A" ? "pleased" : grade === "B" ? "neutral" : "disappointed";
}

export function inspectorPath(pose: InspectorPose): string {
  return `portraits/inspector/${pose}.webp`;
}
