/**
 * KNIFE_TIMING — the pure arithmetic PreparationScene uses to turn a
 * technique's base tap cadence (TAP_KNIFE / CHOP_KNIFE) and peel defaults
 * into the equipped knife's actual values. Kept outside the Phaser scene so
 * QA exercises the exact same maths the scene runs.
 *
 * `knife.animation.timingMult` is the catalog knife's own feel (Phase 8);
 * `knife.tuning` is the Blacksmith's per-player upgrade (blacksmith.ts),
 * absent = every multiplier 1.0 = the knife exactly as it always played.
 * Neither ever reaches cut-position resolution, cut counts, peel completion
 * coverage or grading.
 */
import type { KnifeDefinition } from "./knifeTypes";

export type TapCadenceBase = {
  PREP_MS: number;
  PAUSE_MS: number;
  CUT_MS: number;
  IMPACT_MS: number;
  RETRACT_MS: number;
  BUFFER_TAIL_MS: number;
  HITSTOP_MS: number;
  CUT_DEPTH_FRAC: number;
  ANGLE_JITTER_DEG: number;
};

/** The tap-cut sequence timing for this knife (what PreparationScene.tapTiming returns, minus the untouched placement constants). */
export function knifeTapCadence<T extends TapCadenceBase>(base: T, knife: KnifeDefinition): T {
  const anim = knife.animation;
  const move = knife.tuning?.moveMult ?? 1;
  const cut = knife.tuning?.cutMult ?? 1;
  const hitstop = knife.tuning?.hitstopMult ?? 1;
  return {
    ...base,
    PREP_MS: base.PREP_MS * anim.timingMult * move,
    PAUSE_MS: base.PAUSE_MS * anim.timingMult * move,
    CUT_MS: base.CUT_MS * anim.timingMult * cut,
    IMPACT_MS: base.IMPACT_MS * anim.timingMult * cut,
    RETRACT_MS: base.RETRACT_MS * anim.timingMult * move,
    BUFFER_TAIL_MS: base.BUFFER_TAIL_MS * anim.timingMult,
    HITSTOP_MS: base.HITSTOP_MS * anim.timingMult * hitstop,
    CUT_DEPTH_FRAC: base.CUT_DEPTH_FRAC * anim.depthMult,
    ANGLE_JITTER_DEG: base.ANGLE_JITTER_DEG * anim.jitterMult,
  };
}

/** How long one tap cut keeps the knife busy — the scene's tapSeqTotalMs (a new tap is dropped or buffered until it ends). */
export function tapSequenceMs(cadence: TapCadenceBase): number {
  return (
    cadence.PREP_MS + cadence.PAUSE_MS + cadence.CUT_MS + cadence.IMPACT_MS + cadence.RETRACT_MS
  );
}

/** The input-buffer window at the end of a busy tap sequence during which a new tap is queued (not dropped) — PreparationScene.handleTap. */
export function tapBufferWindowMs(baseBufferTailMs: number, knife: KnifeDefinition): number {
  return baseBufferTailMs * (knife.tuning?.bufferMult ?? 1);
}

/** Peel stroke width fraction for this knife — PreparationScene.peelConfig. Completion coverage is never scaled. */
export function peelStrokeWidthFrac(baseWidthFrac: number, knife: KnifeDefinition): number {
  return baseWidthFrac * (knife.tuning?.peelWidthMult ?? 1);
}
