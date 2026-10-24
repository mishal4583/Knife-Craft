import { COMBO } from "./definitions";

/**
 * KNIFE FEEL — what the blade itself does while cutting (developer
 * 2026-10-24: "add effects to the knife while cutting so the cutting is
 * satisfying and the player gets dopamine from it"). Presentation only: it
 * reads the cut's combo / perfect / last-cut facts and never touches cuts,
 * grades, pay or progress. The scene draws it (scenes/knifeFx.ts).
 *
 * When each effect comes (it builds with the player's run, so the blade
 * gets more alive the better they cut):
 *
 *  every cut     a glint runs heel → tip along the edge (and the spine);
 *                a faint afterimage of the edge stays in the cut; 5 ms buzz.
 *  juicy food    juice beads stay on the blade, slide to the edge and drip.
 *  combo ×5      tier 1: the edge warms (ivory).
 *  combo ×10     tier 2: a gold edge with a soft glow (Fever lights here).
 *  combo ×15     tier 3: a pulsing white-gold edge, sparks off the tip.
 *  milestones    (COMBO.MILESTONES) a brighter glint and a star at the tip.
 *  Perfect Slice the whole blade flashes white; a star at the tip.
 *  last cut      a double glint, a soft metallic "shing", a tip star, and
 *                the juice flicked off the blade — the ingredient is done.
 *  Reduced Motion: only the edge's colour and a short flash.
 */
export const KNIFE_FX = {
  /** The glint's run along the edge, and how much of the edge it lights. */
  GLINT_MS: 260,
  GLINT_SPAN: 0.16,
  /** The second glint of the last cut, after the first. */
  GLINT_ECHO_MS: 170,
  /** The edge's afterimage in the cut. */
  AFTERIMAGE_MS: 220,
  /** Perfect Slice's white flash. */
  FLASH_MS: 260,
  /** Juice beads on the blade: at most this many; how long one lasts. */
  WET_MAX: 8,
  WET_MS: 2600,
  /** The combo each blade tier starts at. */
  TIER_AT: [5, 10, 15] as readonly number[],
  /** Phone buzz per moment (ms). */
  HAPTIC: { cut: 5, milestone: 14, perfect: 18, last: 24 },
} as const;

export type BladeTier = 0 | 1 | 2 | 3;

/** How hot the edge runs: the combo's tier; Fever is at least tier 2. */
export function bladeTier(combo: number, fever = false): BladeTier {
  let t = 0;
  for (const at of KNIFE_FX.TIER_AT) if (combo >= at) t++;
  if (fever) t = Math.max(t, 2);
  return t as BladeTier;
}

export type CutMoment = {
  /** The glint's brightness, 0–1. */
  glint: number;
  /** A second glint just after (the last cut). */
  echo: boolean;
  /** The whole blade flashes (Perfect Slice). */
  flash: boolean;
  /** A star at the tip. */
  star: boolean;
  /** The metallic "shing" (the last cut). */
  shing: boolean;
  /** Flick the juice off the blade (the last cut). */
  flick: boolean;
  /** Phone buzz, ms. */
  haptic: number;
  tier: BladeTier;
};

/** What one cut gets, from what the cut was. */
export function cutMoment(c: {
  combo: number;
  perfect: boolean;
  last: boolean;
  fever?: boolean;
}): CutMoment {
  const tier = bladeTier(c.combo, c.fever);
  const milestone = COMBO.MILESTONES.includes(c.combo);
  const H = KNIFE_FX.HAPTIC;
  return {
    glint: Math.min(1, 0.55 + tier * 0.12 + (milestone ? 0.25 : 0) + (c.perfect ? 0.3 : 0)),
    echo: c.last,
    flash: c.perfect,
    star: c.perfect || milestone || c.last || tier >= 3,
    shing: c.last,
    flick: c.last,
    haptic: c.last ? H.last : c.perfect ? H.perfect : milestone ? H.milestone : H.cut,
    tier,
  };
}
